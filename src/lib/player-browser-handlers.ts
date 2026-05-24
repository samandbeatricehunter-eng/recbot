/**
 * player-browser-handlers.ts
 * View player cards, free agent browser, all-players browser (ROW 2).
 * Extracted from lib/actions-handlers.ts.
 */
/**
 * /actions hub — all member-facing interactions with prefix ac_
 * Session TTL: 15 minutes (keyed by `${guildId}:${userId}`)
 */
import {
  ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction,
  EmbedBuilder, Colors,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  TextChannel, PermissionFlagsBits,
} from "discord.js";
import { db } from "@workspace/db";
import {
  usersTable, userSavingsTable, userRecordsTable, globalUserRecordsTable,
  franchiseRostersTable, franchiseMcaTeamsTable, seasonsTable,
  wagersTable, interviewRequestsTable, coinTransactionsTable,
  seasonStatsTable, teamSeasonStatsTable, purchasesTable, inventoryTable,
  legendsTable, franchiseScheduleTable,
  guildTweetsTable, autoPilotRequestsTable, ruleViolationsTable,
  playerEaIdsTable, customPlayersTable,
  playerSeasonStatsTable, waitlistTable, payoutConfigTable,
  seasonStatTierConfigsTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, sql, isNotNull, isNull, ne, sum, max, inArray, notInArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  getOrCreateUser, getOrCreateActiveSeason, getRosterSeasonId, getScheduleSeasonId, getPurchasedLegendIds,
  deductBalance, logTransaction, addBalance, getGuildChannel, CHANNEL_KEYS,
  getSeasonStats, getSeasonRules, getInventoryCount,
  getOrSeedRules, getAllSections, isAdminUser, getTeamLegendCount,
} from "./db-helpers.js";
import {
  getPayoutValue, getAllPayoutConfig, getMilestoneTiers, getAllPayoutKeys, PAYOUT_KEYS,
} from "./payout-config.js";
import { getServerSettings, requireMcaEnabled } from "./server-settings.js";
import { getArticleStandings, getSeasonRecords, getAllTimeRecords } from "./gcs-fallback.js";
import { devBadge, devBadgeText, DEV_LEGEND, DEV_EMOJI, DEV_TRAIT_LABELS } from "./dev-trait.js";
import { weekLabel } from "./week-helpers.js";
import {
  INTERVIEW_QUESTIONS, pickThreeIndices, getQuestionPool, interviewTypeLabel,
  type InterviewType,
} from "../commands/interviewrequest.js";
import { buildActionsHubEmbed, buildActionsHubRows, buildUnlinkedHubEmbed, buildUnlinkedHubRows } from "../commands/actions.js";
import { buildUserProfilePages, buildProfileNavRow, buildProfileBackRow } from "./user-stats-embed.js";
import { getSavingsInterestRateBps } from "./savings-interest.js";
import { PLAYOFF_WEEK_META } from "./playoff-matchups-runner.js";
import { buildRulesPages } from "./admin-operations-handlers.js";
import {
  insufficientFunds, sendCommissionerNotification, getRosterRows, DEV_LABEL,
} from "./purchase-shared.js";
import { ATTRIBUTES, NFL_TEAMS, NFL_DIVISION_MAP, LIMITS, lookupNflDivision, eaPortraitUrl, LEGEND_CUSTOM_PURCHASE_WEEKS } from "./constants.js";
import { STAT_CATEGORIES, STAT_TIER_DEFAULTS } from "./stat-categories.js";
import { createSession } from "./custom-player-session.js";



import type { ActionsSession } from "./actions-shared.js";
import {
  getSession, touchSession, backToHubRow, cancelRow,
  buildRosterEmbed, buildRosterNavRows, buildRosterPageEmbed,
  buildRosterCardEmbed, buildRosterCardNavRow,
  ROSTER_POSITIONS, POSITION_GROUPS, POSITIONS_PER_GROUP,
  ATTR_GROUPS, ATTR_LABELS, ATTR_PAGES, ATTR_EMOJI,
  DEV_LABEL_LONG, devBadgeFromTrait,
} from "./actions-shared.js";

// ── Roster Card — View Player Cards flow ──────────────────────────────────────

export async function handleRcPosPick(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterViewTeamName || !sess.rosterViewSeasonId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired. Please open the roster again.")], components: [backToHubRow()] });
    return;
  }
  const gid = interaction.guildId!;

  // Fetch which positions are actually on this roster
  const posRows = await db.selectDistinct({ position: franchiseRostersTable.position })
    .from(franchiseRostersTable)
    .where(and(
      eq(franchiseRostersTable.seasonId, sess.rosterViewSeasonId),
      eq(franchiseRostersTable.teamId, sess.rosterViewTeamId),
    ));
  const onRoster = new Set(posRows.map(r => r.position?.toUpperCase() ?? ""));

  const positions = ROSTER_CARD_POSITIONS.filter(p => onRoster.has(p));
  if (!positions.length) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ No players found on this roster. Make sure MCA data has been imported.")], components: [buildRosterNavRows(sess.rosterViewSource ?? "my")[1]] });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_rc_possel")
    .setPlaceholder("Select a position…")
    .addOptions(positions.map(p => new StringSelectMenuOptionBuilder().setLabel(p).setValue(p)));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`🃏 ${sess.rosterViewTeamName} — Player Cards`).setDescription("Select a position to browse players.")],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_rc_back_to_roster").setLabel("← Back to Roster").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleRcPosSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterViewTeamName || !sess.rosterViewSeasonId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired.")], components: [backToHubRow()] });
    return;
  }
  const position = interaction.values[0]!;
  sess.rosterViewPosition = position;

  await showPlayerDropdown(interaction, sess, position);
}

export async function showPlayerDropdown(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  sess: ActionsSession,
  position: string,
) {
  const players = await db.select({
    playerId: franchiseRostersTable.playerId,
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
  })
    .from(franchiseRostersTable)
    .where(and(
      eq(franchiseRostersTable.seasonId, sess.rosterViewSeasonId!),
      eq(franchiseRostersTable.teamId, sess.rosterViewTeamId!),
      sql`upper(${franchiseRostersTable.position}) = upper(${position})`,
    ))
    .orderBy(desc(franchiseRostersTable.overall));

  if (!players.length) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setDescription(`No **${position}** players found on this team's roster.`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_rc_cards").setLabel("← Back to Positions").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_rc_playersel")
    .setPlaceholder(`Select a ${position}…`)
    .addOptions(players.slice(0, 25).map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.firstName} ${p.lastName} — OVR ${p.overall}${devBadgeText(p.devTrait ?? 0)}`)
        .setValue(String(p.playerId)),
    ));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`🃏 ${sess.rosterViewTeamName} — ${position}`).setDescription("Select a player to view their full player card.")],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_rc_cards").setLabel("← Back to Positions").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleRcPlayerSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterViewSeasonId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired.")], components: [backToHubRow()] });
    return;
  }
  const playerId = Number(interaction.values[0]);
  sess.rosterCardPlayerId = playerId;
  sess.rosterCardPage     = 1;
  await showPlayerCardPage(interaction, sess);
}

export async function showPlayerCardPage(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  sess: ActionsSession,
) {
  const page = sess.rosterCardPage ?? 1;
  const [rosterRow, statsRow, seasonRow] = await Promise.all([
    db.select().from(franchiseRostersTable)
      .where(and(
        eq(franchiseRostersTable.seasonId, sess.rosterViewSeasonId!),
        eq(franchiseRostersTable.teamId, sess.rosterViewTeamId!),
        eq(franchiseRostersTable.playerId, sess.rosterCardPlayerId!),
      )).limit(1).then(r => r[0]),
    db.select().from(playerSeasonStatsTable)
      .where(and(
        eq(playerSeasonStatsTable.seasonId, sess.rosterViewSeasonId!),
        eq(playerSeasonStatsTable.playerId, sess.rosterCardPlayerId!),
      )).limit(1).then(r => r[0]),
    db.select({ seasonNumber: seasonsTable.seasonNumber })
      .from(seasonsTable)
      .where(eq(seasonsTable.id, sess.rosterViewSeasonId!))
      .limit(1).then(r => r[0]),
  ]);

  if (!rosterRow) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Player not found.")], components: [backToHubRow()] });
    return;
  }

  const seasonNum = seasonRow?.seasonNumber ?? 1;
  const pages     = buildPlayerCardPages(rosterRow, statsRow, seasonNum);
  const embed     = pages[page - 1] ?? pages[0]!;

  await interaction.update({
    embeds: [embed],
    components: [
      buildCardPageRow(page, pages.length),
      buildCardBackRow(),
    ],
  });
}

export async function handleRcCardPage(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterCardPlayerId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired.")], components: [backToHubRow()] });
    return;
  }
  const page = Number(interaction.customId.split(":")[1]);
  if (!Number.isFinite(page) || page < 1 || page > 3) return;
  sess.rosterCardPage = page;
  await showPlayerCardPage(interaction, sess);
}

export async function handleRcBackToPlayers(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.rosterViewPosition) {
    await handleRcPosPick(interaction, sess);
    return;
  }
  await showPlayerDropdown(interaction, sess, sess.rosterViewPosition);
}

export async function handleRcTeamStats(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterViewTeamName || !sess.rosterViewSeasonId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired. Please open the roster again.")], components: [backToHubRow()] });
    return;
  }
  const [teamStats, seasonRow] = await Promise.all([
    db.select().from(teamSeasonStatsTable)
      .where(and(
        eq(teamSeasonStatsTable.seasonId, sess.rosterViewSeasonId),
        eq(teamSeasonStatsTable.teamId, sess.rosterViewTeamId),
      )).limit(1).then(r => r[0]),
    db.select({ seasonNumber: seasonsTable.seasonNumber })
      .from(seasonsTable)
      .where(eq(seasonsTable.id, sess.rosterViewSeasonId))
      .limit(1).then(r => r[0]),
  ]);

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_rc_back_to_roster").setLabel("← Back to Roster").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
  );

  if (!teamStats) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle(`🏟️ ${sess.rosterViewTeamName} — Team Stats`).setDescription("No team stats found yet this season. Import MCA data to populate.")],
      components: [backRow],
    });
    return;
  }

  const embed = buildTeamStatsEmbed(sess.rosterViewTeamName, seasonRow?.seasonNumber ?? 1, teamStats);
  await interaction.update({ embeds: [embed], components: [backRow] });
}

export async function handleRcBackToRoster(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.rosterViewTeamId || !sess.rosterViewTeamName || !sess.rosterViewSeasonId) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired.")], components: [backToHubRow()] });
    return;
  }
  const embed = new EmbedBuilder();
  await buildRosterEmbed(interaction.guildId!, sess.rosterViewSeasonId, sess.rosterViewTeamId, sess.rosterViewTeamName, embed);
  await interaction.update({ embeds: [embed], components: buildRosterNavRows(sess.rosterViewSource ?? "my") });
}

// ── Free Agents & All Players — shared constants ──────────────────────────────

const BROWSE_POSITIONS = ["QB","HB","FB","WR","TE","LT","LG","C","RG","RT","LEDGE","REDGE","DT","WILL","MIKE","SAM","CB","FS","SS","K","P","LS"];
const FA_TEAM_ID_BROWSE = 999;

const ABBR_TO_ATTR_KEY: Record<string, string> = {
  SPD: "speedRating", ACC: "accelerationRating", AGI: "agilityRating",
  STR: "strengthRating", JMP: "jumpingRating", AWR: "awareRating",
  COD: "changeOfDirectionRating",
  THP: "throwPowerRating", SAC: "throwAccuracyShortRating", MAC: "throwAccuracyMidRating",
  DAC: "throwAccuracyDeepRating", TOR: "throwOnRunRating", TUP: "throwUnderPressureRating",
  BSK: "breakSackRating", PAC: "playActionRating",
  CAR: "carryingRating", BCV: "bCVisionRating", ELU: "elusivenessRating",
  BTK: "breakTackleRating", TRK: "truckingRating",
  CTH: "catchRating", SRR: "shortRouteRunRating", MRR: "medRouteRunRating", DRR: "deepRouteRunRating",
  SFA: "stiffArmRating", SPM: "spinMoveRating", JKM: "jukeMoveRating",
  CIT: "catchInTrafficRating", SPC: "spectacularCatchRating", RLS: "releaseRating",
  PBK: "passBlockRating", RBK: "runBlockRating", IBL: "impactBlockRating",
  PBP: "passBlockPowerRating", PBF: "passBlockFinesseRating",
  RBP: "runBlockPowerRating", RBF: "runBlockFinesseRating", LBK: "leadBlockRating",
  PMV: "powerMovesRating", FMV: "finessMovesRating", BSH: "blockShedRating",
  PUR: "pursuitRating", TAK: "tackleRating", HPW: "hitPowerRating",
  MCV: "manCoverRating", ZCV: "zoneCoverRating", PRS: "pressRating", PRC: "playRecRating",
  // Kicking — used by primary sort (not attr sort dropdown)
  KPW: "kickPowerRating", KAC: "kickAccuracyRating", KR: "kickReturnRating",
};

/**
 * EA exports sometimes use "short-Rating" hybrid key names instead of the
 * full canonical names.  When the primary key returns NULL from the JSON,
 * fall back to the alternate form so composite scores aren't silently zeroed.
 */
const ABBR_ATTR_FALLBACKS: Record<string, string> = {
  ACC: "accelRating",
  JMP: "jumpRating",
  TGH: "toughRating",
  BCV: "bCVRating",
  CAR: "carryRating",
  CIT: "cITRating",
  SRR: "routeRunShortRating",
  MRR: "routeRunMedRating",
  DRR: "routeRunDeepRating",
  SPC: "specCatchRating",
  FMV: "finesseMovesRating",  // primary ABBR_TO_ATTR_KEY has the EA typo "finessMovesRating"
  TRK: "truckRating",
  KAC: "kickAccRating",
  KR:  "kickRetRating",
};

const AP_ATTR_NAMES: Record<string, string> = {
  // Offensive
  SPD: "Speed", ACC: "Acceleration", AGI: "Agility", STR: "Strength", JMP: "Jumping",
  AWR: "Awareness", COD: "Change of Direction",
  THP: "Throw Power", SAC: "Short Acc", MAC: "Mid Acc", DAC: "Deep Acc",
  TOR: "Throw on Run", TUP: "Throw Under Press", BSK: "Break Sack", PAC: "Play Action",
  CAR: "Carrying", BCV: "Ball Carrier Vision", ELU: "Elusiveness", BTK: "Break Tackle", TRK: "Trucking",
  CTH: "Catching", SRR: "Short Route Run", MRR: "Mid Route Run", DRR: "Deep Route Run",
  // Defensive / Blocking / Skill
  PBK: "Pass Block", RBK: "Run Block", IBL: "Impact Block",
  PBP: "Pass Block Power", PBF: "Pass Block Finesse",
  RBP: "Run Block Power", RBF: "Run Block Finesse", LBK: "Lead Block",
  PMV: "Power Moves", FMV: "Finesse Moves", BSH: "Block Shed",
  PUR: "Pursuit", TAK: "Tackle", HPW: "Hit Power",
  MCV: "Man Coverage", ZCV: "Zone Coverage", PRS: "Press", PRC: "Play Recognition",
  SFA: "Stiff Arm", SPM: "Spin Move", JKM: "Juke Move", RLS: "Release",
  SPC: "Spec Catch", CIT: "Catch in Traffic",
  // Kicking sort labels (used in primary sort summary display)
  KPW: "Kick Power", KAC: "Kick Accuracy", KR: "Kick Return",
};

// ── Multi-sort helpers ─────────────────────────────────────────────────────────

const SORT_PRIMARY_LABELS: Record<string, string> = {
  overall_desc: "OVR ↓", overall_asc: "OVR ↑",
  age_asc: "Younger", age_desc: "Older",
  height_desc: "Height ↓", height_asc: "Height ↑",
  weight_desc: "Weight ↓", weight_asc: "Weight ↑",
  contract_asc: "Contract ↑", contract_desc: "Contract ↓",
  kpw_desc: "KPW ↓", kac_desc: "KAC ↓", kr_desc: "KR ↓",
};

/** Return a short human-readable label for a sort key */
export function sortStackLabel(key: string): string {
  if (SORT_PRIMARY_LABELS[key]) return SORT_PRIMARY_LABELS[key];
  if (AP_ATTR_NAMES[key]) return `${AP_ATTR_NAMES[key]} ↓`;
  return key;
}

/**
 * Exponential weights by priority position.
 * 1st pick → 1.0, 2nd → 0.5, 3rd → 0.25, 4th → 0.125, 5th → 0.0625
 */
const SORT_WEIGHTS = [1.0, 0.5, 0.25, 0.125, 0.0625];
const SORT_WEIGHT_LABELS = ["100%", "50%", "25%", "12.5%", "6.25%"];

// ── Sort page data ─────────────────────────────────────────────────────────────

/** Page 0: Special/primary sorts (OVR, Age, physical stats, kicking) */
const SORT_PAGE_0_KEYS = [
  "overall_desc", "overall_asc", "age_asc", "age_desc", "height_desc",
  "weight_desc", "contract_desc", "kpw_desc", "kac_desc", "kr_desc",
];

/** Pages 1-5: All 48 attributes in category order, 10 per page */
const SORT_ATTR_PAGES: string[][] = [
  ["SPD","ACC","AGI","STR","JMP","AWR","COD","THP","SAC","MAC"],   // Athletic + Throwing
  ["DAC","TOR","TUP","BSK","PAC","CAR","BCV","ELU","BTK","TRK"],   // Throwing + Ball Carry
  ["SFA","SPM","JKM","CTH","SRR","MRR","DRR","SPC","CIT","RLS"],   // Ball Carry + Receiving
  ["PBK","RBK","IBL","PBP","PBF","RBP","RBF","LBK","PMV","FMV"],   // Blocking + Pass Rush
  ["BSH","PUR","TAK","HPW","MCV","ZCV","PRS","PRC"],                // Defense + Coverage
];

const SORT_ALL_PAGES: string[][] = [SORT_PAGE_0_KEYS, ...SORT_ATTR_PAGES];

const SORT_PAGE_LABELS = [
  "Pg 1/6 — Special",
  "Pg 2/6 — Athletic / Throwing",
  "Pg 3/6 — Throwing / Ball Carry",
  "Pg 4/6 — Ball Carry / Receiving",
  "Pg 5/6 — Blocking / Rush",
  "Pg 6/6 — Defense / Coverage",
];

/** Short label for a sort button (used as button label text). */
export function sortBtnLabel(key: string, sortStack: string[]): string {
  const base = SORT_PRIMARY_LABELS[key] ?? key; // attr keys are their own abbr (SPD, ACC…)
  const idx  = sortStack.indexOf(key);
  if (idx < 0) return base;
  return `${base} (${SORT_WEIGHT_LABELS[idx] ?? "~6%"})`.slice(0, 80);
}

/** Rows 1 & 2 — sort toggle buttons for the current page (up to 10 keys, 5 per row). */
export function buildSortPageRows(prefix: string, page: number, sortStack: string[]): ActionRowBuilder<ButtonBuilder>[] {
  const pageKeys = SORT_ALL_PAGES[page] ?? [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let r = 0; r < 2; r++) {
    const keys = pageKeys.slice(r * 5, (r + 1) * 5);
    if (!keys.length) break;
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...keys.map(key =>
          new ButtonBuilder()
            .setCustomId(`${prefix}_stog|${key}`)
            .setLabel(sortBtnLabel(key, sortStack))
            .setStyle(sortStack.includes(key) ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
      ),
    );
  }
  return rows;
}

/** Row 3 — sort page navigation + clear sort. */
export function buildSortNavRow(prefix: string, page: number, sortStack: string[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}_sprev`).setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId(`${prefix}_spage_lbl`)
      .setLabel(SORT_PAGE_LABELS[page] ?? `Pg ${page + 1}/${SORT_ALL_PAGES.length}`)
      .setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId(`${prefix}_snext`).setLabel("▶ Next")
      .setStyle(ButtonStyle.Secondary).setDisabled(page >= SORT_ALL_PAGES.length - 1),
    new ButtonBuilder().setCustomId(`${prefix}_sort_clear`).setLabel("🗑 Clear Sort")
      .setStyle(ButtonStyle.Danger).setDisabled(sortStack.length === 0),
  );
}

/** Row 4 — dev trait filter toggle buttons. */
export function buildDevFilterRow(prefix: string, devFilters: number[]): ActionRowBuilder<ButtonBuilder> {
  const has = (v: number) => devFilters.includes(v);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}_dtog|0`).setLabel("Show Normal")
      .setStyle(has(0) ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}_dtog|1`).setLabel("Show Star")
      .setStyle(has(1) ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}_dtog|2`).setLabel("Show SS")
      .setStyle(has(2) ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}_dtog|3`).setLabel("Show XF")
      .setStyle(has(3) ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${prefix}_dev_clear`).setLabel("Clear Dev")
      .setStyle(ButtonStyle.Danger).setDisabled(devFilters.length === 0),
  );
}

/** Toggle one sort key in the stack (max 5). */
export function toggleSortKey(stack: string[], key: string): string[] {
  if (stack.includes(key)) return stack.filter(k => k !== key);
  if (stack.length >= 5) return stack; // already at max
  return [...stack, key];
}

/** Toggle one dev-trait value in the filter array. */
export function toggleDevFilter(filters: number[], val: number): number[] {
  return filters.includes(val) ? filters.filter(v => v !== val) : [...filters, val];
}

/**
 * Build a single composite SQL score expression from the sort stack.
 * Each term is a normalized (0-1) value multiplied by its exponential weight.
 * The resulting expression is sorted DESC so the "best fit" player ranks first.
 *
 * This produces Madden-style scouting: a player strong across ALL priorities
 * beats a player maxed on only the first pick but weak on others.
 */
export function buildWeightedScoreExpr(stack: string[]): SQL | null {
  if (!stack.length) return null;

  const terms: string[] = [];

  for (let i = 0; i < stack.length; i++) {
    const key = stack[i]!;
    const w   = SORT_WEIGHTS[i] ?? 0.0625;

    if (ABBR_TO_ATTR_KEY[key]) {
      // 0-99 Madden attribute — normalize by 99.
      // Try both canonical and hybrid EA key names so the score isn't silently zeroed.
      const attrKey  = ABBR_TO_ATTR_KEY[key];
      const fallback = ABBR_ATTR_FALLBACKS[key];
      const coalesce = fallback
        ? `COALESCE((attributes->>'${attrKey}')::numeric, (attributes->>'${fallback}')::numeric, 0)`
        : `COALESCE((attributes->>'${attrKey}')::numeric, 0)`;
      terms.push(`${coalesce} / 99.0 * ${w}`);
    } else {
      const parts = key.split("_");
      const dir   = parts[parts.length - 1]; // "asc" or "desc"
      const field = parts.slice(0, -1).join("_");
      switch (field) {
        case "overall":
          // 0-99 range
          terms.push(dir === "desc"
            ? `COALESCE(overall, 0) / 99.0 * ${w}`
            : `(99.0 - COALESCE(overall, 99)) / 99.0 * ${w}`);
          break;
        case "age":
          // Typical Madden age range 21-45; asc = younger is better
          terms.push(dir === "asc"
            ? `(45.0 - COALESCE(age, 45)) / 24.0 * ${w}`
            : `(COALESCE(age, 21) - 21.0) / 24.0 * ${w}`);
          break;
        case "height":
          // Height stored as inches (~66-80)
          terms.push(dir === "desc"
            ? `(COALESCE((attributes->>'height')::numeric, 66) - 66.0) / 14.0 * ${w}`
            : `(80.0 - COALESCE((attributes->>'height')::numeric, 80)) / 14.0 * ${w}`);
          break;
        case "weight":
          // Weight stored as lbs (~150-380)
          terms.push(dir === "desc"
            ? `(COALESCE((attributes->>'weight')::numeric, 150) - 150.0) / 230.0 * ${w}`
            : `(380.0 - COALESCE((attributes->>'weight')::numeric, 380)) / 230.0 * ${w}`);
          break;
        case "contract":
          // Contract years remaining (~0-7); asc = shorter deal is better
          terms.push(dir === "asc"
            ? `(7.0 - COALESCE(contract_years_left, 7)) / 7.0 * ${w}`
            : `COALESCE(contract_years_left, 0) / 7.0 * ${w}`);
          break;
        case "kpw":
          terms.push(`COALESCE((attributes->>'kickPowerRating')::numeric, 0) / 99.0 * ${w}`);
          break;
        case "kac":
          terms.push(`COALESCE((attributes->>'kickAccuracyRating')::numeric, 0) / 99.0 * ${w}`);
          break;
        case "kr":
          terms.push(`COALESCE((attributes->>'kickReturnRating')::numeric, 0) / 99.0 * ${w}`);
          break;
      }
    }
  }

  if (!terms.length) return null;
  return sql.raw(`(${terms.join(" + ")}) DESC NULLS LAST`);
}

export function buildApOrderBy(sess: ActionsSession): SQL[] {
  const expr = buildWeightedScoreExpr(sess.apSortStack ?? []);
  return [expr ?? desc(franchiseRostersTable.overall)];
}

export function buildSortStackSummary(stack: string[]): string {
  if (!stack.length) return "";
  const WEIGHT_LABELS = ["100%", "50%", "25%", "12.5%", "6.25%"];
  return "**Sort (weighted):** " + stack.map((k, i) =>
    `${sortStackLabel(k)} [${WEIGHT_LABELS[i] ?? "~6%"}]`,
  ).join(" · ");
}

export function buildApFilterSummary(sess: ActionsSession): string {
  const parts: string[] = [];
  if (sess.apNameFilter) parts.push(`Name: "${sess.apNameFilter}"`);
  const devFilters = sess.apDevFilters ?? [];
  if (devFilters.length > 0) {
    const devLabels: Record<number, string> = { 0: "Normal", 1: "★ Star", 2: "🌟 SS", 3: "⚡ XF" };
    parts.push(`Dev: ${devFilters.map(v => devLabels[v] ?? v).join(", ")}`);
  }
  const sortLine = buildSortStackSummary(sess.apSortStack ?? []);
  if (sortLine) parts.push(sortLine);
  return parts.length ? parts.join("\n") : "";
}

// ── Free Agents — player-card flow ───────────────────────────────────────────

export async function handleFreeAgentsPosPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_fa_pos")
    .setPlaceholder("Select a position…")
    .addOptions(BROWSE_POSITIONS.map(p => new StringSelectMenuOptionBuilder().setLabel(p).setValue(p)));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("🆓 Free Agents — Select Position")
      .setDescription("Choose a position to view available free agents.")],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_anyroster").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleFaPosSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const pos = interaction.values[0]!;
  const gid = interaction.guildId!;
  const seasonId = await getRosterSeasonId(gid);
  sess.faPos = pos;
  sess.faSeasonId = seasonId;
  await showFaPlayerList(interaction, sess);
}

export async function showFaPlayerList(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const pos = sess.faPos!;
  const seasonId = sess.faSeasonId!;

  const conditions: SQL<unknown>[] = [
    eq(franchiseRostersTable.seasonId, seasonId),
    eq(franchiseRostersTable.teamId, FA_TEAM_ID_BROWSE),
    sql`upper(${franchiseRostersTable.position}) = upper(${pos})`,
  ];
  const faDevFiltersX = sess.faDevFilters ?? [];
  if (faDevFiltersX.length > 0) conditions.push(inArray(franchiseRostersTable.devTrait, faDevFiltersX));
  if (sess.faNameFilter) {
    const namePat = `%${sess.faNameFilter}%`;
    conditions.push(sql`upper(${franchiseRostersTable.lastName}) like upper(${namePat})`);
  }

  const faWeightedExpr = buildWeightedScoreExpr(sess.faSortStack ?? []);
  const orderExprs: SQL[] = [faWeightedExpr ?? desc(franchiseRostersTable.overall)];

  const players = await db.select({
    playerId:  franchiseRostersTable.playerId,
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
    age:       franchiseRostersTable.age,
  }).from(franchiseRostersTable)
    .where(and(...conditions))
    .orderBy(...orderExprs)
    .limit(24);

  if (!players.length) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Grey)
        .setTitle(`🆓 Free Agents — ${pos}`)
        .setDescription("No free agents found at this position.\n\nMake sure MCA data includes free agent roster data.")],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_freeagents").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const hasFilters = !!(sess.faNameFilter || (sess.faDevFilters?.length) || (sess.faSortStack?.length));
  const filterSummary = buildFaFilterSummary(sess);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_fa_player")
    .setPlaceholder("Select a free agent to view their card…")
    .addOptions(players.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.firstName} ${p.lastName} — OVR ${p.overall}${devBadgeText(p.devTrait ?? 0)}`)
        .setDescription(`Age: ${p.age ?? "?"}`)
        .setValue(String(p.playerId)),
    ));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Green)
      .setTitle(`🆓 Free Agents — ${pos}`)
      .setDescription(`Top ${players.length} free agents. Select one for their player card.\n${DEV_LEGEND}${filterSummary ? `\n${filterSummary}` : ""}`)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_fa_filter").setLabel("🔍 Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_freeagents").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleFaPlayerSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const playerId = Number(interaction.values[0]);
  sess.faCardPlayerId = playerId;
  sess.faCardPage = 1;
  await showFaCard(interaction, sess);
}

export async function showFaCard(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const gid = interaction.guildId!;
  const playerId = sess.faCardPlayerId!;
  const page = sess.faCardPage ?? 1;
  const seasonId = sess.faSeasonId ?? (await getRosterSeasonId(gid));
  const season = await getOrCreateActiveSeason(gid);

  const [roster, stats] = await Promise.all([
    db.select().from(franchiseRostersTable)
      .where(and(eq(franchiseRostersTable.seasonId, seasonId), eq(franchiseRostersTable.playerId, playerId)))
      .limit(1).then(r => r[0]),
    db.select().from(playerSeasonStatsTable)
      .where(and(eq(playerSeasonStatsTable.seasonId, seasonId), eq(playerSeasonStatsTable.playerId, playerId)))
      .limit(1).then(r => r[0]),
  ]);

  if (!roster) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Player not found.")],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_fa_back_to_players").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const pages = buildPlayerCardPages(roster, stats, season.seasonNumber ?? 1);
  const safePage = Math.min(Math.max(1, page), pages.length);
  const TOTAL = pages.length;

  await interaction.update({
    embeds: [pages[safePage - 1]!],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ac_fa_cardpage:${safePage - 1}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 1),
        new ButtonBuilder().setCustomId("ac_fa_cardpage_num").setLabel(`Page ${safePage} / ${TOTAL}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`ac_fa_cardpage:${safePage + 1}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= TOTAL),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_fa_back_to_players").setLabel("← Back to Players").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleFaCardPage(interaction: ButtonInteraction, sess: ActionsSession) {
  const page = Number(interaction.customId.split(":")[1]);
  if (!Number.isFinite(page) || page < 1 || page > 10) return;
  sess.faCardPage = page;
  await showFaCard(interaction, sess);
}

export async function handleFaBackToPlayers(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.faPos || !sess.faSeasonId) { await handleFreeAgentsPosPick(interaction, sess); return; }
  await showFaPlayerList(interaction, sess);
}

// ── All Players — Position picker, player list with filters, player cards ──────

export async function handleAllPlayersPosPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_ap_pos")
    .setPlaceholder("Select a position…")
    .addOptions(BROWSE_POSITIONS.map(p => new StringSelectMenuOptionBuilder().setLabel(p).setValue(p)));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("🌐 All Players — Select Position")
      .setDescription("Choose a position to browse all players across the league.")],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_anyroster").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleAllPlayersPosSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const pos = interaction.values[0]!;
  const gid = interaction.guildId!;
  const seasonId = await getRosterSeasonId(gid);
  if (sess.apPos !== pos) {
    sess.apNameFilter = undefined;
    sess.apDevFilters = [];
    sess.apSortStack  = [];
    sess.apSortPage   = 0;
  }
  sess.apPos = pos;
  sess.apSeasonId = seasonId;
  await showApPlayerList(interaction, sess);
}

export async function showApPlayerList(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const pos = sess.apPos!;
  const seasonId = sess.apSeasonId!;

  const conditions: SQL<unknown>[] = [
    eq(franchiseRostersTable.seasonId, seasonId),
    sql`upper(${franchiseRostersTable.position}) = upper(${pos})`,
    sql`${franchiseRostersTable.teamId} != ${FA_TEAM_ID_BROWSE}`,
  ];
  if (sess.apNameFilter) {
    const namePat = `%${sess.apNameFilter}%`;
    conditions.push(sql`upper(${franchiseRostersTable.lastName}) like upper(${namePat})`);
  }
  const apDevFiltersQ = sess.apDevFilters ?? [];
  if (apDevFiltersQ.length > 0) conditions.push(inArray(franchiseRostersTable.devTrait, apDevFiltersQ));

  const orderExprs = buildApOrderBy(sess);
  const players = await db.select({
    playerId:  franchiseRostersTable.playerId,
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
    age:       franchiseRostersTable.age,
    teamName:  franchiseRostersTable.teamName,
  }).from(franchiseRostersTable)
    .where(and(...conditions))
    .orderBy(...orderExprs)
    .limit(24);

  const filterSummary = buildApFilterSummary(sess);

  const noResultEmbed = new EmbedBuilder().setColor(Colors.Grey)
    .setTitle(`🌐 All Players — ${pos}`)
    .setDescription(`No players found matching your filters.\n\n${filterSummary}`);
  const noResultBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_ap_filter").setLabel("Filter / Sort").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_allplayers").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
  );

  if (!players.length) {
    await interaction.update({ embeds: [noResultEmbed], components: [noResultBtns] });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_ap_player")
    .setPlaceholder("Select a player for their card…")
    .addOptions(players.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.firstName} ${p.lastName} — OVR ${p.overall}${devBadgeText(p.devTrait ?? 0)}`)
        .setDescription(`${p.teamName ?? "?"} · Age ${p.age ?? "?"}`)
        .setValue(String(p.playerId)),
    ));

  const descParts = [`Top ${players.length} ${pos}s. Select one for their player card.`];
  if (filterSummary) descParts.push(filterSummary);
  descParts.push(DEV_LEGEND);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`🌐 All Players — ${pos}`).setDescription(descParts.join("\n"))],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_ap_filter").setLabel("Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_allplayers").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleApPlayerSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  sess.apCardPlayerId = Number(interaction.values[0]);
  sess.apCardPage = 1;
  await showApCard(interaction, sess);
}

export async function showApCard(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const gid = interaction.guildId!;
  const playerId = sess.apCardPlayerId!;
  const page = sess.apCardPage ?? 1;
  const seasonId = sess.apSeasonId ?? (await getRosterSeasonId(gid));
  const season = await getOrCreateActiveSeason(gid);

  const [roster, stats] = await Promise.all([
    db.select().from(franchiseRostersTable)
      .where(and(eq(franchiseRostersTable.seasonId, seasonId), eq(franchiseRostersTable.playerId, playerId)))
      .limit(1).then(r => r[0]),
    db.select().from(playerSeasonStatsTable)
      .where(and(eq(playerSeasonStatsTable.seasonId, seasonId), eq(playerSeasonStatsTable.playerId, playerId)))
      .limit(1).then(r => r[0]),
  ]);

  if (!roster) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Player not found.")],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_ap_back_to_players").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const pages = buildPlayerCardPages(roster, stats, season.seasonNumber ?? 1);
  const safePage = Math.min(Math.max(1, page), pages.length);
  const TOTAL = pages.length;

  await interaction.update({
    embeds: [pages[safePage - 1]!],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ac_ap_cardpage:${safePage - 1}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 1),
        new ButtonBuilder().setCustomId("ac_ap_cardpage_num").setLabel(`Page ${safePage} / ${TOTAL}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`ac_ap_cardpage:${safePage + 1}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= TOTAL),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_ap_back_to_players").setLabel("← Back to Players").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleApCardPage(interaction: ButtonInteraction, sess: ActionsSession) {
  const page = Number(interaction.customId.split(":")[1]);
  if (!Number.isFinite(page) || page < 1 || page > 10) return;
  sess.apCardPage = page;
  await showApCard(interaction, sess);
}

export async function handleApBackToPlayers(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.apPos || !sess.apSeasonId) { await handleAllPlayersPosPick(interaction, sess); return; }
  await showApPlayerList(interaction, sess);
}

// ── All Players — Filter / Sort screen ────────────────────────────────────────

// Shared filter component builder — works for both AP and FA (prefix = "ac_ap" or "ac_fa")
// sortStack: ordered list of active sort keys (up to 5), priority = index 0 first
/** Row 5 — action buttons for AP filter screen. */
export function buildApFilterActionRow(sess: ActionsSession): ActionRowBuilder<ButtonBuilder> {
  const hasFilters = !!(sess.apNameFilter || (sess.apDevFilters?.length) || (sess.apSortStack?.length));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_ap_filter_name")
      .setLabel(sess.apNameFilter ? `🔍 "${sess.apNameFilter.slice(0, 20)}"` : "🔍 Name Search")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_ap_filter_apply").setLabel("✅ Apply & View").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ac_ap_filter_clear").setLabel("🗑 Clear All").setStyle(ButtonStyle.Danger).setDisabled(!hasFilters),
    new ButtonBuilder().setCustomId("ac_ap_back_to_players").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );
}

export async function showApFilterScreen(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const page      = sess.apSortPage ?? 0;
  const sortStack = sess.apSortStack ?? [];
  const devFilters = sess.apDevFilters ?? [];
  const summary   = buildApFilterSummary(sess);
  const stackFull = sortStack.length >= 5;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🔍 Filter / Sort — ${sess.apPos ?? "All Players"}`)
    .setDescription(
      `Toggle buttons to build your sort priority (green = active). Up to **5 sort keys** max.\n` +
      (stackFull ? "⚠️ Sort full — deactivate a key before adding another.\n" : "") +
      `\n${summary || "*No active filters.*"}`,
    );

  const rows = [
    ...buildSortPageRows("ac_ap", page, sortStack),
    buildSortNavRow("ac_ap", page, sortStack),
    buildDevFilterRow("ac_ap", devFilters),
    buildApFilterActionRow(sess),
  ];
  await interaction.update({ embeds: [embed], components: rows as any[] });
}

export async function handleApFilterScreen(interaction: ButtonInteraction, sess: ActionsSession) {
  await showApFilterScreen(interaction, sess);
}

export async function handleApSortToggle(interaction: ButtonInteraction, sess: ActionsSession, key: string) {
  sess.apSortStack = toggleSortKey(sess.apSortStack ?? [], key);
  await showApFilterScreen(interaction, sess);
}

export async function handleApDevToggle(interaction: ButtonInteraction, sess: ActionsSession, val: number) {
  sess.apDevFilters = toggleDevFilter(sess.apDevFilters ?? [], val);
  await showApFilterScreen(interaction, sess);
}

export async function handleApDevClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.apDevFilters = [];
  await showApFilterScreen(interaction, sess);
}

export async function handleApSortClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.apSortStack = [];
  await showApFilterScreen(interaction, sess);
}

export async function handleApSortPage(interaction: ButtonInteraction, sess: ActionsSession, dir: "prev" | "next") {
  const current = sess.apSortPage ?? 0;
  const total = SORT_ALL_PAGES.length;
  sess.apSortPage = dir === "next" ? Math.min(current + 1, total - 1) : Math.max(current - 1, 0);
  await showApFilterScreen(interaction, sess);
}

export async function handleApFilterNameModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_ap_name")
    .setTitle("Search by Player Last Name")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("ap_name_input")
          .setLabel("Last name (partial match)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Smith, Allen, Mahomes")
          .setRequired(false)
          .setMaxLength(50),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleApFilterNameSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const raw = interaction.fields.getTextInputValue("ap_name_input").trim();
  sess.apNameFilter = raw.length ? raw : undefined;
  await interaction.deferUpdate();
  if (!sess.apPos || !sess.apSeasonId) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired. Use /menu to start again.")],
      components: [],
    });
    return;
  }
  // Re-query and show player list (can't call interaction.update after modal deferUpdate)
  const pos = sess.apPos!;
  const seasonId = sess.apSeasonId!;
  const conditions: SQL<unknown>[] = [
    eq(franchiseRostersTable.seasonId, seasonId),
    sql`upper(${franchiseRostersTable.position}) = upper(${pos})`,
    sql`${franchiseRostersTable.teamId} != ${FA_TEAM_ID_BROWSE}`,
  ];
  if (sess.apNameFilter) {
    const namePat = `%${sess.apNameFilter}%`;
    conditions.push(sql`upper(${franchiseRostersTable.lastName}) like upper(${namePat})`);
  }
  const apDevF = sess.apDevFilters ?? [];
  if (apDevF.length > 0) conditions.push(inArray(franchiseRostersTable.devTrait, apDevF));
  const orderExprs = buildApOrderBy(sess);
  const players = await db.select({
    playerId:  franchiseRostersTable.playerId,
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
    age:       franchiseRostersTable.age,
    teamName:  franchiseRostersTable.teamName,
  }).from(franchiseRostersTable)
    .where(and(...conditions))
    .orderBy(...orderExprs)
    .limit(24);

  const filterSummary = buildApFilterSummary(sess);
  if (!players.length) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle(`🌐 All Players — ${pos}`)
        .setDescription(`No players found matching your filters.\n\n${filterSummary}`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_ap_filter").setLabel("Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_allplayers").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_ap_player")
    .setPlaceholder("Select a player for their card…")
    .addOptions(players.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.firstName} ${p.lastName} — OVR ${p.overall}${devBadgeText(p.devTrait ?? 0)}`)
        .setDescription(`${p.teamName ?? "?"} · Age ${p.age ?? "?"}`)
        .setValue(String(p.playerId)),
    ));

  const descParts = [`Top ${players.length} ${pos}s. Select one for their player card.`];
  if (filterSummary) descParts.push(filterSummary);
  descParts.push(DEV_LEGEND);

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`🌐 All Players — ${pos}`).setDescription(descParts.join("\n"))],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_ap_filter").setLabel("Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_allplayers").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleApFilterApply(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.apPos || !sess.apSeasonId) { await handleAllPlayersPosPick(interaction, sess); return; }
  await showApPlayerList(interaction, sess);
  sess.apNameFilter = undefined;
  sess.apDevFilters = [];
  sess.apSortStack  = [];
  sess.apSortPage   = 0;
}

export async function handleApFilterClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.apNameFilter = undefined;
  sess.apDevFilters = [];
  sess.apSortStack  = [];
  sess.apSortPage   = 0;
  await showApFilterScreen(interaction, sess);
}

// ── Free Agents — Filter / Sort screen ────────────────────────────────────────

export function buildFaFilterSummary(sess: ActionsSession): string {
  const parts: string[] = [];
  if (sess.faNameFilter) parts.push(`Name: "${sess.faNameFilter}"`);
  const devFilters = sess.faDevFilters ?? [];
  if (devFilters.length > 0) {
    const devLabels: Record<number, string> = { 0: "Normal", 1: "★ Star", 2: "🌟 SS", 3: "⚡ XF" };
    parts.push(`Dev: ${devFilters.map(v => devLabels[v] ?? v).join(", ")}`);
  }
  const sortLine = buildSortStackSummary(sess.faSortStack ?? []);
  if (sortLine) parts.push(sortLine);
  return parts.length ? parts.join("\n") : "";
}

/** Row 5 — action buttons for FA filter screen. */
export function buildFaFilterActionRow(sess: ActionsSession): ActionRowBuilder<ButtonBuilder> {
  const hasFilters = !!(sess.faNameFilter || (sess.faDevFilters?.length) || (sess.faSortStack?.length));
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_fa_filter_name")
      .setLabel(sess.faNameFilter ? `🔍 "${sess.faNameFilter.slice(0, 20)}"` : "🔍 Name Search")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_fa_filter_apply").setLabel("✅ Apply & View").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ac_fa_filter_clear").setLabel("🗑 Clear All").setStyle(ButtonStyle.Danger).setDisabled(!hasFilters),
    new ButtonBuilder().setCustomId("ac_fa_back_to_players").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );
}

export async function showFaFilterScreen(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  sess: ActionsSession,
) {
  const page       = sess.faSortPage ?? 0;
  const sortStack  = sess.faSortStack ?? [];
  const devFilters = sess.faDevFilters ?? [];
  const summary    = buildFaFilterSummary(sess);
  const stackFull  = sortStack.length >= 5;

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`🔍 Filter / Sort — FA ${sess.faPos ?? "Free Agents"}`)
    .setDescription(
      `Toggle buttons to build your sort priority (green = active). Up to **5 sort keys** max.\n` +
      (stackFull ? "⚠️ Sort full — deactivate a key before adding another.\n" : "") +
      `\n${summary || "*No active filters.*"}`,
    );

  const rows = [
    ...buildSortPageRows("ac_fa", page, sortStack),
    buildSortNavRow("ac_fa", page, sortStack),
    buildDevFilterRow("ac_fa", devFilters),
    buildFaFilterActionRow(sess),
  ];
  await interaction.update({ embeds: [embed], components: rows as any[] });
}

export async function handleFaFilterScreen(interaction: ButtonInteraction, sess: ActionsSession) {
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaSortToggle(interaction: ButtonInteraction, sess: ActionsSession, key: string) {
  sess.faSortStack = toggleSortKey(sess.faSortStack ?? [], key);
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaDevToggle(interaction: ButtonInteraction, sess: ActionsSession, val: number) {
  sess.faDevFilters = toggleDevFilter(sess.faDevFilters ?? [], val);
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaDevClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.faDevFilters = [];
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaSortClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.faSortStack = [];
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaSortPage(interaction: ButtonInteraction, sess: ActionsSession, dir: "prev" | "next") {
  const current = sess.faSortPage ?? 0;
  const total = SORT_ALL_PAGES.length;
  sess.faSortPage = dir === "next" ? Math.min(current + 1, total - 1) : Math.max(current - 1, 0);
  await showFaFilterScreen(interaction, sess);
}

export async function handleFaFilterNameModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_fa_name")
    .setTitle("Search FA by Player Last Name")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("fa_name_input")
          .setLabel("Last name (partial match)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. Smith, Allen, Mahomes")
          .setRequired(false)
          .setMaxLength(50),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleFaFilterNameSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const raw = interaction.fields.getTextInputValue("fa_name_input").trim();
  sess.faNameFilter = raw.length ? raw : undefined;
  await interaction.deferUpdate();
  if (!sess.faPos || !sess.faSeasonId) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Session expired. Use /menu to start again.")],
      components: [],
    });
    return;
  }
  // Re-query FA player list (can't call interaction.update after modal deferUpdate — must use editReply)
  const pos = sess.faPos!;
  const seasonId = sess.faSeasonId!;
  const conditions: SQL<unknown>[] = [
    eq(franchiseRostersTable.seasonId, seasonId),
    eq(franchiseRostersTable.teamId, FA_TEAM_ID_BROWSE),
    sql`upper(${franchiseRostersTable.position}) = upper(${pos})`,
  ];
  const faDevFiltersX = sess.faDevFilters ?? [];
  if (faDevFiltersX.length > 0) conditions.push(inArray(franchiseRostersTable.devTrait, faDevFiltersX));
  if (sess.faNameFilter) {
    const namePat = `%${sess.faNameFilter}%`;
    conditions.push(sql`upper(${franchiseRostersTable.lastName}) like upper(${namePat})`);
  }

  const faWeightedExpr = buildWeightedScoreExpr(sess.faSortStack ?? []);
  const orderExprs: SQL[] = [faWeightedExpr ?? desc(franchiseRostersTable.overall)];

  const players = await db.select({
    playerId:  franchiseRostersTable.playerId,
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
    age:       franchiseRostersTable.age,
  }).from(franchiseRostersTable)
    .where(and(...conditions))
    .orderBy(...orderExprs)
    .limit(24);

  const filterSummary = buildFaFilterSummary(sess);
  if (!players.length) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle(`🆓 Free Agents — ${pos}`)
        .setDescription(`No free agents found.\n\n${filterSummary}`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_fa_filter").setLabel("🔍 Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_freeagents").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      )],
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_fa_player")
    .setPlaceholder("Select a free agent to view their card…")
    .addOptions(players.map(p =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${p.firstName} ${p.lastName} — OVR ${p.overall}${devBadgeText(p.devTrait ?? 0)}`)
        .setDescription(`Age: ${p.age ?? "?"}`)
        .setValue(String(p.playerId)),
    ));

  await interaction.editReply({
    embeds: [new EmbedBuilder().setColor(Colors.Green)
      .setTitle(`🆓 Free Agents — ${pos}`)
      .setDescription(`${players.length} results.\n${DEV_LEGEND}\n${filterSummary}`)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_fa_filter").setLabel("🔍 Filter / Sort").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_freeagents").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

export async function handleFaFilterApply(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.faPos || !sess.faSeasonId) { await handleFreeAgentsPosPick(interaction, sess); return; }
  await showFaPlayerList(interaction, sess);
  sess.faNameFilter = undefined;
  sess.faDevFilters = [];
  sess.faSortStack  = [];
  sess.faSortPage   = 0;
}

export async function handleFaFilterClear(interaction: ButtonInteraction, sess: ActionsSession) {
  sess.faNameFilter  = undefined;
  sess.faDevFilters  = [];
  sess.faSortStack   = [];
  sess.faSortPage    = 0;
  await showFaFilterScreen(interaction, sess);
}

// ── Player Stats — removed; stats accessible via player cards in Rosters/FA/AP ─


