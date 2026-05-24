/**
 * wager-handlers.ts
 * Wager flow — steps 1-4 (game select → team pick → spread → opponent).
 * Extracted from lib/actions-handlers.ts.
 */
/**
 * actions-handlers.ts  (slimmed — see individual handler files for extracted sections)
 *
 * Contains: types, session store, shared helpers, roster card builders,
 *           main dispatch (handleActionsInteraction), coins section,
 *           ROW 2 main roster display (handleMyRoster, handleAnyRosterShow).
 *
 * Delegated to split files:
 *   purchase-flow-handlers.ts   — ROW 1 purchase flows
 *   wager-handlers.ts           — Wager flow
 *   player-browser-handlers.ts  — ROW 2 player/FA/all-players browser
 *   team-stats-handlers.ts      — Team stats
 *   rule-violation-handlers.ts  — Rule violation
 *   team-request-handlers.ts    — Request open team + waitlist
 */
/**
 * actions-handlers.ts  (slimmed — see individual handler files for extracted sections)
 *
 * Contains: types, session store, shared helpers, roster card builders,
 *           main dispatch (handleActionsInteraction), coins section,
 *           ROW 2 main roster display (handleMyRoster, handleAnyRosterShow).
 *
 * Delegated to split files:
 *   purchase-flow-handlers.ts   — ROW 1 purchase flows
 *   wager-handlers.ts           — Wager flow
 *   player-browser-handlers.ts  — ROW 2 player/FA/all-players browser
 *   team-stats-handlers.ts      — Team stats
 *   rule-violation-handlers.ts  — Rule violation
 *   team-request-handlers.ts    — Request open team + waitlist
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
import { buildActionsHubEmbed, buildActionsHubRows, buildUnlinkedHubEmbed, buildUnlinkedHubRows } from "../lib/actions-hub-embeds.js";
import { buildUserProfilePages, buildProfileNavRow, buildProfileBackRow } from "./user-stats-embed.js";
import { getSavingsInterestRateBps } from "./savings-interest.js";
import { PLAYOFF_WEEK_META } from "./playoff-matchups-runner.js";
import { buildRulesPages } from "./admin-rules-handlers.js";
import {
  insufficientFunds, sendCommissionerNotification, getRosterRows, DEV_LABEL,
} from "./purchase-shared.js";
import { ATTRIBUTES, NFL_TEAMS, NFL_DIVISION_MAP, LIMITS, lookupNflDivision, eaPortraitUrl, LEGEND_CUSTOM_PURCHASE_WEEKS } from "./constants.js";
import { STAT_CATEGORIES, STAT_TIER_DEFAULTS } from "./stat-categories.js";
import { createSession } from "./custom-player-session.js";


import { weekKeyToIndex, spreadLabel, spreadDescription, buildOpponentSelectRows, handleWagerStart, handleWagerGameSelect, handleWagerTeamPick, handleWagerSpreadSelect, handleWagerBackToTeam, handleWagerSpreadNext, handleWagerAmountSubmit, handleWagerOpponentSelect, handleWagerBackToSpread, handleWagerSend } from "./wager-handlers.js";
import { handleRcPosPick, handleRcPosSel, showPlayerDropdown, handleRcPlayerSel, showPlayerCardPage, handleRcCardPage, handleRcBackToPlayers, handleRcTeamStats, handleRcBackToRoster, sortStackLabel, sortBtnLabel, buildSortPageRows, buildSortNavRow, buildDevFilterRow, toggleSortKey, toggleDevFilter, buildWeightedScoreExpr, buildApOrderBy, buildSortStackSummary, buildApFilterSummary, handleFreeAgentsPosPick, handleFaPosSel, showFaPlayerList, handleFaPlayerSel, showFaCard, handleFaCardPage, handleFaBackToPlayers, handleAllPlayersPosPick, handleAllPlayersPosSel, showApPlayerList, handleApPlayerSel, showApCard, handleApCardPage, handleApBackToPlayers, buildApFilterActionRow, showApFilterScreen, handleApFilterScreen, handleApSortToggle, handleApDevToggle, handleApDevClear, handleApSortClear, handleApSortPage, handleApFilterNameModal, handleApFilterNameSubmit, handleApFilterApply, handleApFilterClear, buildFaFilterSummary, buildFaFilterActionRow, showFaFilterScreen, handleFaFilterScreen, handleFaSortToggle, handleFaDevToggle, handleFaDevClear, handleFaSortClear, handleFaSortPage, handleFaFilterNameModal, handleFaFilterNameSubmit, handleFaFilterApply, handleFaFilterClear } from "./player-browser-handlers.js";
import { handleTeamStatsTeamPick, handleTeamStatsShow, handleStandingsConfPick, handleStandingsShow, handleInTheHunt, handleTeamsToWatch, handleAnyUserStatsTeamPick, handleAnyUserStatsConfPick, handleAnyUserStatsShow, handleSeasonPR, handleAllTimePR, handleGlobalPR, handleWeeklyPayouts, handleEosPayouts, handleMilestonePayouts, handleActiveTeams, handleOpenTeams, handleAutoPilotModal, handleAutoPilotSubmit, handleApproveAutoPilot, handleDenyAutoPilot } from "./team-stats-handlers.js";
import { handleViolationModal, handleViolationSubmit, handleViolationApprove, handleViolationDeny, handleViolationDenySubmit, handleViolationNote, handleRulesStart, buildRulesSectionEmbed, buildRulesSectionButtons, handleRulesSection, handleRulesPage, handleRulesDisplayChoice, handleRulesDisplayFull, handleRulesDisplayByNumModal, handleRulesByNumSubmit, handleRulesClose } from "./rule-violation-handlers.js";
import { buildOpenTeamSelectRows, buildAllTeamSelectRows, getTakenTeams, handleReqOpenTeam, handleReqOpenTeamSel, handleReqOpenTeamSubmit, handleReqAddWaitlist, handleReqWaitlistSel, handleReqWaitlistNext, handleReqRmWaitlist, handleReqRmWaitlistConfirm, handleSchedule } from "./team-request-handlers.js";
import { getSession, touchSession } from "./actions-shared.js";
export * from "./actions-shared.js";

import { weekKeyToIndex, spreadLabel, spreadDescription, buildOpponentSelectRows, handleWagerStart, handleWagerGameSelect, handleWagerTeamPick, handleWagerSpreadSelect, handleWagerBackToTeam, handleWagerSpreadNext, handleWagerAmountSubmit, handleWagerOpponentSelect, handleWagerBackToSpread, handleWagerSend } from "./wager-handlers.js";
import { handleRcPosPick, handleRcPosSel, showPlayerDropdown, handleRcPlayerSel, showPlayerCardPage, handleRcCardPage, handleRcBackToPlayers, handleRcTeamStats, handleRcBackToRoster, sortStackLabel, sortBtnLabel, buildSortPageRows, buildSortNavRow, buildDevFilterRow, toggleSortKey, toggleDevFilter, buildWeightedScoreExpr, buildApOrderBy, buildSortStackSummary, buildApFilterSummary, handleFreeAgentsPosPick, handleFaPosSel, showFaPlayerList, handleFaPlayerSel, showFaCard, handleFaCardPage, handleFaBackToPlayers, handleAllPlayersPosPick, handleAllPlayersPosSel, showApPlayerList, handleApPlayerSel, showApCard, handleApCardPage, handleApBackToPlayers, buildApFilterActionRow, showApFilterScreen, handleApFilterScreen, handleApSortToggle, handleApDevToggle, handleApDevClear, handleApSortClear, handleApSortPage, handleApFilterNameModal, handleApFilterNameSubmit, handleApFilterApply, handleApFilterClear, buildFaFilterSummary, buildFaFilterActionRow, showFaFilterScreen, handleFaFilterScreen, handleFaSortToggle, handleFaDevToggle, handleFaDevClear, handleFaSortClear, handleFaSortPage, handleFaFilterNameModal, handleFaFilterNameSubmit, handleFaFilterApply, handleFaFilterClear } from "./player-browser-handlers.js";
import { handleTeamStatsTeamPick, handleTeamStatsShow, handleStandingsConfPick, handleStandingsShow, handleInTheHunt, handleTeamsToWatch, handleAnyUserStatsTeamPick, handleAnyUserStatsConfPick, handleAnyUserStatsShow, handleSeasonPR, handleAllTimePR, handleGlobalPR, handleWeeklyPayouts, handleEosPayouts, handleMilestonePayouts, handleActiveTeams, handleOpenTeams, handleAutoPilotModal, handleAutoPilotSubmit, handleApproveAutoPilot, handleDenyAutoPilot } from "./team-stats-handlers.js";
import { handleViolationModal, handleViolationSubmit, handleViolationApprove, handleViolationDeny, handleViolationDenySubmit, handleViolationNote, handleRulesStart, buildRulesSectionEmbed, buildRulesSectionButtons, handleRulesSection, handleRulesPage, handleRulesDisplayChoice, handleRulesDisplayFull, handleRulesDisplayByNumModal, handleRulesByNumSubmit, handleRulesClose } from "./rule-violation-handlers.js";
import { buildOpenTeamSelectRows, buildAllTeamSelectRows, getTakenTeams, handleReqOpenTeam, handleReqOpenTeamSel, handleReqOpenTeamSubmit, handleReqAddWaitlist, handleReqWaitlistSel, handleReqWaitlistNext, handleReqRmWaitlist, handleReqRmWaitlistConfirm, handleSchedule, handleCoins, handleBankTransfer, handleBankTransferDir, handleBankTransferSubmit, handleSendCoinsModal, handleSendCoinsSubmit } from "./team-request-handlers.js";
import { getSession, touchSession } from "./actions-shared.js";
export * from "./actions-shared.js";


import type { ActionsSession } from "./actions-shared.js";
import {
  getSession, touchSession, backToHubRow, cancelRow,
  buildRosterEmbed, buildRosterNavRows, buildRosterPageEmbed,
  buildRosterCardEmbed, buildRosterCardNavRow,
  ROSTER_POSITIONS, POSITION_GROUPS, POSITIONS_PER_GROUP,
  ATTR_GROUPS, ATTR_LABELS, ATTR_PAGES, ATTR_EMOJI,
  DEV_LABEL_LONG, devBadgeFromTrait,
} from "./actions-shared.js";

// ── Wager ─────────────────────────────────────────────────────────────────────

/** Convert a currentWeek string (e.g. "1", "wildcard") to the integer weekIndex
 *  stored in franchise_schedule rows. Regular seasons are 0-based; playoffs use
 *  the canonical 1018/1019/1020/1022 values from PLAYOFF_WEEK_META. */
export function weekKeyToIndex(weekKey: string): number | null {
  const num = parseInt(weekKey, 10);
  if (!isNaN(num) && num >= 1 && num <= 18) return num - 1;
  const meta = PLAYOFF_WEEK_META[weekKey];
  return meta ? meta.weekIndex : null;
}

// ── Wager helpers ─────────────────────────────────────────────────────────────

export function spreadLabel(spread: number): string {
  return spread > 0 ? `+${spread}` : `${spread}`;
}

export function spreadDescription(myTeam: string, theirTeam: string, spread: number): string {
  if (spread < 0) return `**${myTeam}** must win by more than **${Math.abs(spread)}** points\n\`${myTeam} score − ${Math.abs(spread)} > ${theirTeam} score\``;
  if (spread === 0) return `**${myTeam}** must win outright\n\`${myTeam} score > ${theirTeam} score\``;
  return `**${myTeam}** can lose by up to **${spread}** points and still cover\n\`${myTeam} score > ${theirTeam} score − ${spread}\``;
}

export async function buildOpponentSelectRows(
  gid: string,
  excludeDiscordId: string,
  selectedOpponentId?: string,
): Promise<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[]> {
  const linkedUsers = await db.select({
    discordId: usersTable.discordId,
    discordUsername: usersTable.discordUsername,
    team: usersTable.team,
  }).from(usersTable)
    .where(and(
      eq(usersTable.guildId, gid),
      isNotNull(usersTable.team),
      ne(usersTable.team, ""),
      ne(usersTable.discordId, excludeDiscordId),
    ));

  const afcUsers = linkedUsers.filter(u => lookupNflDivision(u.team!)?.conference === "AFC");
  const nfcUsers = linkedUsers.filter(u => lookupNflDivision(u.team!)?.conference === "NFC");

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

  if (afcUsers.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ac_wager_opponent_afc")
      .setPlaceholder("AFC — Pick Opponent")
      .addOptions(afcUsers.slice(0, 25).map(u =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${u.team} — ${u.discordUsername}`)
          .setValue(u.discordId)
          .setDefault(u.discordId === selectedOpponentId),
      ));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  if (nfcUsers.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ac_wager_opponent_nfc")
      .setPlaceholder("NFC — Pick Opponent")
      .addOptions(nfcUsers.slice(0, 25).map(u =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${u.team} — ${u.discordUsername}`)
          .setValue(u.discordId)
          .setDefault(u.discordId === selectedOpponentId),
      ));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_wager_send")
      .setLabel("📨 Send Wager")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!selectedOpponentId),
    new ButtonBuilder().setCustomId("ac_wager_back_to_spread").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  ));

  return rows;
}

// ── Wager Step 1: Game Select ─────────────────────────────────────────────────

export async function handleWagerStart(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  const settings = await getServerSettings(gid);
  if (!settings.coinEconomy || !settings.wagerEnabled) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Wagers are currently disabled by the commissioners.")], components: [backToHubRow()] });
    return;
  }

  const season = await getOrCreateActiveSeason(gid);
  const weekIndex = weekKeyToIndex((season as any).currentWeek ?? "1");

  if (weekIndex === null) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager").setDescription("No schedule data found for the current week. Ask a commissioner to import the schedule from MCA.")], components: [backToHubRow()] });
    return;
  }

  let scheduleRows = await db.select({
    id: franchiseScheduleTable.id, homeTeamId: franchiseScheduleTable.homeTeamId,
    awayTeamId: franchiseScheduleTable.awayTeamId, homeTeamName: franchiseScheduleTable.homeTeamName,
    awayTeamName: franchiseScheduleTable.awayTeamName,
  }).from(franchiseScheduleTable)
    .where(and(eq(franchiseScheduleTable.seasonId, season.id), eq(franchiseScheduleTable.weekIndex, weekIndex)))
    .limit(32);

  if (scheduleRows.length === 0 && weekIndex >= 1000) {
    scheduleRows = await db.select({
      id: franchiseScheduleTable.id, homeTeamId: franchiseScheduleTable.homeTeamId,
      awayTeamId: franchiseScheduleTable.awayTeamId, homeTeamName: franchiseScheduleTable.homeTeamName,
      awayTeamName: franchiseScheduleTable.awayTeamName,
    }).from(franchiseScheduleTable)
      .where(and(eq(franchiseScheduleTable.seasonId, season.id), eq(franchiseScheduleTable.weekIndex, weekIndex - 1000)))
      .limit(32);
  }

  if (!scheduleRows.length) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager").setDescription("No schedule data found for the current week. Ask a commissioner to import the schedule from MCA.")], components: [backToHubRow()] });
    return;
  }

  // Filter to H2H: both teams must have a linked discord user via franchise_mca_teams
  const mcaTeams = await db.select({
    teamId: franchiseMcaTeamsTable.teamId,
    discordId: franchiseMcaTeamsTable.discordId,
  }).from(franchiseMcaTeamsTable)
    .where(and(eq(franchiseMcaTeamsTable.seasonId, season.id), isNotNull(franchiseMcaTeamsTable.discordId)));

  const linkedTeamIds = new Set(mcaTeams.filter(m => m.discordId).map(m => m.teamId));
  const h2hGames = scheduleRows.filter(g => linkedTeamIds.has(g.homeTeamId) && linkedTeamIds.has(g.awayTeamId));

  if (!h2hGames.length) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager").setDescription("No head-to-head games found this week (both teams must be linked to active users).")], components: [backToHubRow()] });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_wager_game")
    .setPlaceholder("Select a game to wager on…")
    .addOptions(h2hGames.slice(0, 25).map(g =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${g.homeTeamName} vs ${g.awayTeamName}`)
        .setValue(String(g.id)),
    ));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager — Step 1 of 4").setDescription("Select the head-to-head game you want to wager on.\n\nOnly games where **both teams are linked to active users** are shown.")],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), cancelRow()],
  });
}

// ── Wager Step 2: Team Pick ───────────────────────────────────────────────────

export async function handleWagerGameSelect(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const gameId = Number(interaction.values[0]);
  sess.scheduleGameId = String(gameId);

  const gid = interaction.guildId!;
  const season = await getOrCreateActiveSeason(gid);

  const game = (await db.select().from(franchiseScheduleTable).where(eq(franchiseScheduleTable.id, gameId)).limit(1))[0];
  if (!game) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Game not found.")], components: [backToHubRow()] });
    return;
  }

  // Resolve which discord users are linked to each side
  const [homeMca] = await db.select({ discordId: franchiseMcaTeamsTable.discordId })
    .from(franchiseMcaTeamsTable)
    .where(and(eq(franchiseMcaTeamsTable.seasonId, season.id), eq(franchiseMcaTeamsTable.teamId, game.homeTeamId)))
    .limit(1);
  const [awayMca] = await db.select({ discordId: franchiseMcaTeamsTable.discordId })
    .from(franchiseMcaTeamsTable)
    .where(and(eq(franchiseMcaTeamsTable.seasonId, season.id), eq(franchiseMcaTeamsTable.teamId, game.awayTeamId)))
    .limit(1);

  sess.wagerHomeTeam      = game.homeTeamName;
  sess.wagerAwayTeam      = game.awayTeamName;
  sess.wagerHomeDiscordId = homeMca?.discordId ?? undefined;
  sess.wagerAwayDiscordId = awayMca?.discordId ?? undefined;

  const userLine = (homeMca?.discordId && awayMca?.discordId)
    ? `\n🏠 <@${homeMca.discordId}> vs ✈️ <@${awayMca.discordId}>`
    : "";

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_wager_pick:home").setLabel(`🏠 ${game.homeTeamName}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_wager_pick:away").setLabel(`✈️ ${game.awayTeamName}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Cancel").setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager — Step 2 of 4").setDescription(`**${game.homeTeamName} vs ${game.awayTeamName}**${userLine}\n\nWhich team are you backing?`)],
    components: [row],
  });
}

// ── Wager Step 3: Spread Select ───────────────────────────────────────────────

export async function handleWagerTeamPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const side = interaction.customId.split(":")[1]! as "home" | "away";
  sess.wagerSide = side;
  sess.wagerTeam = side === "home" ? sess.wagerHomeTeam : sess.wagerAwayTeam;
  sess.wagerChallengerTeam = sess.wagerTeam;

  const myTeam    = sess.wagerTeam ?? "Your Team";
  const theirTeam = side === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");

  const spreadOptions: StringSelectMenuOptionBuilder[] = [];
  for (let s = -10; s <= 10; s++) {
    const label = s === 0 ? "0 (straight win)" : s > 0 ? `+${s}` : `${s}`;
    const desc  = s < 0 ? `${myTeam} must win by more than ${Math.abs(s)}`
      : s === 0        ? `${myTeam} must win outright`
      :                  `${myTeam} can lose by up to ${s} and still cover`;
    spreadOptions.push(new StringSelectMenuOptionBuilder().setLabel(label).setValue(String(s)).setDescription(desc));
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_wager_spread")
    .setPlaceholder("Select your point spread…")
    .addOptions(spreadOptions);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager — Step 3 of 4").setDescription(`You're backing **${myTeam}** vs **${theirTeam}**.\n\nSelect your point spread. Negative means your team must win by more; positive means they can lose by that much and still cover.`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), cancelRow()],
  });
}

export async function handleWagerSpreadSelect(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const spread = parseInt(interaction.values[0]!, 10);
  sess.wagerSpread = spread;

  const myTeam    = sess.wagerTeam ?? "Your Team";
  const theirTeam = sess.wagerSide === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("⚔️ Place a Wager — Step 3 of 4 (Spread Confirmed)")
      .setDescription(
        `**Spread: ${spreadLabel(spread)}**\n\n` +
        spreadDescription(myTeam, theirTeam, spread) + "\n\n" +
        `If scores are tied after the spread is applied, the bet is a **push** — both players get their coins back.\n\n` +
        `Click **Next** to enter your wager amount.`,
      )],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ac_wager_spread_next").setLabel("Next →").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ac_wager_back_to_team").setLabel("← Back").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
    )],
  });
}

export async function handleWagerBackToTeam(interaction: ButtonInteraction, sess: ActionsSession) {
  const homeTeam = sess.wagerHomeTeam ?? "Home";
  const awayTeam = sess.wagerAwayTeam ?? "Away";
  const userLine = (sess.wagerHomeDiscordId && sess.wagerAwayDiscordId)
    ? `\n🏠 <@${sess.wagerHomeDiscordId}> vs ✈️ <@${sess.wagerAwayDiscordId}>`
    : "";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_wager_pick:home").setLabel(`🏠 ${homeTeam}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_wager_pick:away").setLabel(`✈️ ${awayTeam}`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Cancel").setStyle(ButtonStyle.Secondary),
  );
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("⚔️ Place a Wager — Step 2 of 4").setDescription(`**${homeTeam} vs ${awayTeam}**${userLine}\n\nWhich team are you backing?`)],
    components: [row],
  });
}

export async function handleWagerSpreadNext(interaction: ButtonInteraction, _sess: ActionsSession) {
  await interaction.showModal(
    new ModalBuilder()
      .setCustomId("ac_modal_wageramount")
      .setTitle("Wager Amount")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("amount")
            .setLabel("Coins to wager (each player stakes this)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. 500")
            .setRequired(true)
            .setMaxLength(10),
        ),
      ),
  );
}

// ── Wager Step 4: Opponent Select → Send ─────────────────────────────────────

export async function handleWagerAmountSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const amountStr = interaction.fields.getTextInputValue("amount").trim();
  const amount    = parseInt(amountStr, 10);

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: "❌ Invalid amount. Enter a positive whole number.", ephemeral: true });
    return;
  }

  const gid  = interaction.guildId!;
  const user = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  if (user.balance < amount) {
    await interaction.reply({ content: `❌ Insufficient coins. You have **${user.balance.toLocaleString()}**, wager is **${amount.toLocaleString()}**.`, ephemeral: true });
    return;
  }

  sess.wagerAmount = amount;

  const myTeam    = sess.wagerTeam ?? "Your Team";
  const theirTeam = sess.wagerSide === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");
  const spread    = sess.wagerSpread ?? 0;

  const rows = await buildOpponentSelectRows(gid, interaction.user.id);

  if (rows.length === 1) {
    await interaction.reply({ content: "❌ No other linked users found to wager against.", ephemeral: true });
    return;
  }

  await interaction.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("⚔️ Place a Wager — Step 4 of 4")
      .setDescription(
        `**Your pick:** ${myTeam} (${spreadLabel(spread)})\n` +
        `**Amount:** ${amount.toLocaleString()} coins each\n\n` +
        spreadDescription(myTeam, theirTeam, spread) + "\n\n" +
        `Select the opponent you want to challenge from the dropdowns below, then click **Send Wager**.`,
      )],
    components: rows as ActionRowBuilder<any>[],
  });
}

export async function handleWagerOpponentSelect(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const opponentId = interaction.values[0]!;
  sess.wagerOpponentId = opponentId;

  const gid = interaction.guildId!;
  const [oppRecord] = await db.select({ discordUsername: usersTable.discordUsername, team: usersTable.team })
    .from(usersTable).where(and(eq(usersTable.discordId, opponentId), eq(usersTable.guildId, gid))).limit(1);
  sess.wagerOpponentTeam = oppRecord?.team ?? undefined;

  const myTeam    = sess.wagerTeam ?? "Your Team";
  const theirTeam = sess.wagerSide === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");
  const spread    = sess.wagerSpread ?? 0;
  const amount    = sess.wagerAmount ?? 0;

  const rows = await buildOpponentSelectRows(gid, interaction.user.id, opponentId);

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("⚔️ Place a Wager — Step 4 of 4")
      .setDescription(
        `**Your pick:** ${myTeam} (${spreadLabel(spread)})\n` +
        `**Amount:** ${amount.toLocaleString()} coins each\n\n` +
        `✅ **Opponent selected:** <@${opponentId}> (${oppRecord?.team ?? "Unknown"})\n\n` +
        `Click **Send Wager** to challenge them, or pick a different opponent above.`,
      )],
    components: rows as ActionRowBuilder<any>[],
  });
}

export async function handleWagerBackToSpread(interaction: ButtonInteraction, sess: ActionsSession) {
  const myTeam    = sess.wagerTeam ?? "Your Team";
  const theirTeam = sess.wagerSide === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");
  const spread    = sess.wagerSpread ?? 0;

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("⚔️ Place a Wager — Step 3 of 4 (Spread Confirmed)")
      .setDescription(
        `**Spread: ${spreadLabel(spread)}**\n\n` +
        spreadDescription(myTeam, theirTeam, spread) + "\n\n" +
        `Click **Next** to set your wager amount.`,
      )],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ac_wager_spread_next").setLabel("Next →").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ac_wager_back_to_team").setLabel("← Back").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
    )],
  });
}

export async function handleWagerSend(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;

  if (!sess.wagerOpponentId || !sess.wagerTeam || !sess.wagerAmount || sess.wagerSpread === undefined || !sess.wagerSide) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Missing wager details. Please start over from the hub.")], components: [backToHubRow()] });
    return;
  }

  const challenger = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  if (challenger.balance < sess.wagerAmount) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ Insufficient coins. Your balance: **${challenger.balance.toLocaleString()}**, wager: **${sess.wagerAmount.toLocaleString()}**.`)], components: [backToHubRow()] });
    return;
  }

  const teamFor     = sess.wagerTeam;
  const teamAgainst = sess.wagerSide === "home" ? (sess.wagerAwayTeam ?? "Opponent") : (sess.wagerHomeTeam ?? "Opponent");

  const [oppRecord] = await db.select({ discordUsername: usersTable.discordUsername })
    .from(usersTable).where(and(eq(usersTable.discordId, sess.wagerOpponentId), eq(usersTable.guildId, gid))).limit(1);

  await getOrCreateUser(sess.wagerOpponentId, oppRecord?.discordUsername ?? "Unknown", gid);

  const [wager] = await db.insert(wagersTable).values({
    guildId:            gid,
    challengerId:       interaction.user.id,
    challengerUsername: interaction.user.username,
    opponentId:         sess.wagerOpponentId,
    opponentUsername:   oppRecord?.discordUsername ?? "Unknown",
    amount:             sess.wagerAmount,
    pot:                sess.wagerAmount * 2,
    teamFor,
    teamAgainst,
    status:             "pending",
    spread:             sess.wagerSpread,
    challengerSide:     sess.wagerSide,
    scheduleGameId:     sess.scheduleGameId ? parseInt(sess.scheduleGameId, 10) : undefined,
  }).returning();

  if (!wager) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ Failed to create wager record. Please try again.")], components: [backToHubRow()] });
    return;
  }

  // Close the ephemeral menu
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ Wager Challenge Sent").setDescription(`Challenge sent to <@${sess.wagerOpponentId}>! Check the channel for the challenge message.\n\n**Wager #${wager.id}**`)],
    components: [],
  });

  // Post public challenge to the channel
  const [challengerMember, opponentMember] = await Promise.all([
    interaction.guild?.members.fetch(interaction.user.id).catch(() => null),
    interaction.guild?.members.fetch(sess.wagerOpponentId).catch(() => null),
  ]);
  const challengerName = challengerMember?.displayName ?? interaction.user.username;
  const opponentName   = opponentMember?.displayName ?? oppRecord?.discordUsername ?? "Opponent";

  const spread    = sess.wagerSpread;
  const spreadStr = spreadLabel(spread);
  const spreadDesc = spreadDescription(teamFor, teamAgainst, spread);

  const challengeEmbed = new EmbedBuilder()
    .setColor(Colors.Yellow)
    .setTitle("⚔️ Wager Challenge!")
    .setDescription(`<@${interaction.user.id}> has challenged <@${sess.wagerOpponentId}> to a coin wager!`)
    .addFields(
      { name: "💰 Stake",                         value: `**${sess.wagerAmount.toLocaleString()} coins** each (pot: **${(sess.wagerAmount * 2).toLocaleString()}**)` },
      { name: `🏈 ${challengerName} is backing`,  value: `**${teamFor}** (spread: ${spreadStr})`, inline: true },
      { name: `🏈 ${opponentName} is backing`,    value: `**${teamAgainst}**`,                    inline: true },
      { name: "📊 Challenger's Spread",            value: spreadDesc },
      { name: "📋 Status",                         value: "⏳ Waiting for opponent to respond…" },
    )
    .setFooter({ text: `Wager #${wager.id}` })
    .setTimestamp();

  const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`wager_accept:${wager.id}`).setLabel("✅ Accept Wager").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`wager_refuse:${wager.id}`).setLabel("❌ Refuse").setStyle(ButtonStyle.Danger),
  );

  try {
    if (interaction.channel) {
      const msg = await (interaction.channel as any).send({
        content: `<@${sess.wagerOpponentId}> — you have a wager challenge!`,
        embeds:  [challengeEmbed],
        components: [challengeRow],
      });
      await db.update(wagersTable).set({ challengeMessageId: msg.id }).where(eq(wagersTable.id, wager.id));
    }
  } catch (err) {
    console.error("Failed to send wager challenge message:", err);
  }
}


