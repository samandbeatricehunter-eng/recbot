/**
 * team-request-handlers.ts
 * Request open team and waitlist flows.
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

// ── Helpers: build open-team and all-team dual dropdowns ─────────────────────

export function buildOpenTeamSelectRows(
  afcOpen: string[],
  nfcOpen: string[],
  selected?: string,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  if (afcOpen.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ac_req_openteam_sel_afc")
      .setPlaceholder("🔵 AFC — Pick an open team")
      .addOptions(afcOpen.map(t =>
        new StringSelectMenuOptionBuilder().setLabel(t).setValue(t).setDefault(t === selected),
      ));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  if (nfcOpen.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ac_req_openteam_sel_nfc")
      .setPlaceholder("🔴 NFC — Pick an open team")
      .addOptions(nfcOpen.map(t =>
        new StringSelectMenuOptionBuilder().setLabel(t).setValue(t).setDefault(t === selected),
      ));
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  }

  return rows;
}

export function buildAllTeamSelectRows(
  selected?: string,
): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const afc = NFL_TEAMS.filter(t => NFL_DIVISION_MAP[t]?.conference === "AFC").sort();
  const nfc = NFL_TEAMS.filter(t => NFL_DIVISION_MAP[t]?.conference === "NFC").sort();

  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  const afcMenu = new StringSelectMenuBuilder()
    .setCustomId("ac_req_waitlist_sel_afc")
    .setPlaceholder("🔵 AFC — Pick your target team")
    .addOptions(afc.map(t =>
      new StringSelectMenuOptionBuilder().setLabel(t).setValue(t).setDefault(t === selected),
    ));
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(afcMenu));

  const nfcMenu = new StringSelectMenuBuilder()
    .setCustomId("ac_req_waitlist_sel_nfc")
    .setPlaceholder("🔴 NFC — Pick your target team")
    .addOptions(nfc.map(t =>
      new StringSelectMenuOptionBuilder().setLabel(t).setValue(t).setDefault(t === selected),
    ));
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(nfcMenu));

  return rows;
}

// ── Shared helper: resolve currently taken teams from usersTable ───────────────
export async function getTakenTeams(gid: string): Promise<Set<string>> {
  const takenRows = await db.select({ team: usersTable.team, discordId: usersTable.discordId })
    .from(usersTable)
    .where(and(eq(usersTable.guildId, gid), isNotNull(usersTable.team)));

  // usersTable.team is always canonical (NFL_TEAMS name set by admin on link).
  // MCA nickNames like "Bolts", "Jags", "G-Men", "Niners", "Pack", "Pats" do NOT
  // match NFL_TEAMS, so we rely on usersTable — not MCA — as the source of truth.
  const taken = new Set<string>();
  for (const r of takenRows) {
    if (!r.discordId || r.discordId.startsWith("unlinked_")) continue;
    if (r.team) taken.add(r.team);
  }
  return taken;
}

// ── Request Open Team: step 1 — show dual dropdowns with open teams ───────────

export async function handleReqOpenTeam(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  sess.pendingTeamRequest = undefined;

  const taken = await getTakenTeams(gid);
  const open     = NFL_TEAMS.filter(t => !taken.has(t));
  const afcOpen  = open.filter(t => NFL_DIVISION_MAP[t]?.conference === "AFC").sort();
  const nfcOpen  = open.filter(t => NFL_DIVISION_MAP[t]?.conference === "NFC").sort();

  if (!open.length) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Grey)
        .setTitle("🔴 No Open Teams")
        .setDescription("All 32 teams are currently claimed. You can add yourself to the waitlist instead.")],
      components: [backToHubRow()],
    });
    return;
  }

  const selectRows = buildOpenTeamSelectRows(afcOpen, nfcOpen);
  const actionRow  = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_req_openteam_submit").setLabel("✅ Submit Request").setStyle(ButtonStyle.Success).setDisabled(true),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder<any>;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🏈 Request an Open Team")
    .setDescription("Pick a team from either dropdown below, then click **Submit Request**.\n\n⚠️ You may only select **one team**. Selecting from one conference clears the other.");

  await interaction.editReply({ embeds: [embed], components: [...selectRows, actionRow] });
}

// ── Request Open Team: step 2 — user selects a team ─────────────────────────

export async function handleReqOpenTeamSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const team = interaction.values[0]!;
  await interaction.deferUpdate();

  sess.pendingTeamRequest = team;

  const taken   = await getTakenTeams(gid);
  const open    = NFL_TEAMS.filter(t => !taken.has(t));
  const afcOpen = open.filter(t => NFL_DIVISION_MAP[t]?.conference === "AFC").sort();
  const nfcOpen = open.filter(t => NFL_DIVISION_MAP[t]?.conference === "NFC").sort();

  const selectRows = buildOpenTeamSelectRows(afcOpen, nfcOpen, team);
  const actionRow  = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_req_openteam_submit").setLabel("✅ Submit Request").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder<any>;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("🏈 Request an Open Team")
    .setDescription(`Pick a team from either dropdown below, then click **Submit Request**.\n\n✅ **Selected:** ${team}\n\nClick **Submit Request** to send your request to the commissioner.`);

  await interaction.editReply({ embeds: [embed], components: [...selectRows, actionRow] });
}

// ── Request Open Team: step 3 — submit to commissioner log ───────────────────

export async function handleReqOpenTeamSubmit(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const uid  = interaction.user.id;
  const team = sess.pendingTeamRequest;
  await interaction.deferUpdate();

  if (!team) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ No Team Selected").setDescription("Please select a team from the dropdown first.")],
      components: [backToHubRow()],
    });
    return;
  }

  // Verify team is still open at submit time
  const taken = await getTakenTeams(gid);
  if (taken.has(team)) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("⚠️ Team No Longer Available")
        .setDescription(`The **${team}** were claimed since you started browsing. Please go back and pick another team.`)],
      components: [backToHubRow()],
    });
    return;
  }

  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);

  if (logChannelId) {
    const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Yellow)
          .setTitle("🔔 Open Team Request")
          .setDescription(`<@${uid}> has requested an open team.`)
          .addFields({ name: "🏈 Team Requested", value: team, inline: true })
          .setTimestamp()],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`treq_link|${uid}|${team}`)
              .setLabel("🔗 Link User")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`treq_deny|${uid}|${team}`)
              .setLabel("❌ Deny Request")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      }).catch(console.error);
    }
  }

  sess.pendingTeamRequest = undefined;

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Request Submitted")
      .setDescription(`Your request for the **${team}** has been sent to the commissioner. You'll be notified once a decision is made.`)],
    components: [backToHubRow()],
  });
}

// ── Add to Waitlist: step 1 — show dual dropdowns with ALL teams ──────────────

export async function handleReqAddWaitlist(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;
  await interaction.deferUpdate();

  // Check if already on waitlist
  const [existing] = await db.select({ id: waitlistTable.id, status: waitlistTable.status, team: waitlistTable.team })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.guildId, gid), eq(waitlistTable.discordId, uid)));

  if (existing) {
    const teamInfo = existing.team ? ` for the **${existing.team}**` : "";
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⚠️ Already on Waitlist")
        .setDescription(`You're already on the waitlist${teamInfo} (status: **${existing.status}**).\n\nUse **Remove from Waitlist** if you'd like to change your team preference.`)],
      components: [backToHubRow()],
    });
    return;
  }

  sess.pendingTeamRequest = undefined;

  const selectRows = buildAllTeamSelectRows();
  const actionRow  = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_req_waitlist_next").setLabel("📋 Add to Waitlist").setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder<any>;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("📋 Add to Waitlist")
    .setDescription(
      "Pick the **specific team** you want to waitlist for, then click **Add to Waitlist**.\n\n" +
      "If that team is already open, you'll be redirected to Request it directly.\n" +
      "If it's taken, you'll be added to the waitlist and notified when they become available.",
    );

  await interaction.editReply({ embeds: [embed], components: [...selectRows, actionRow] });
}

// ── Add to Waitlist: step 2 — user selects their target team ─────────────────

export async function handleReqWaitlistSel(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const team = interaction.values[0]!;
  await interaction.deferUpdate();

  sess.pendingTeamRequest = team;

  const selectRows = buildAllTeamSelectRows(team);
  const actionRow  = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_req_waitlist_next").setLabel("📋 Add to Waitlist").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder<any>;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle("📋 Add to Waitlist")
    .setDescription(
      "Pick the **specific team** you want to waitlist for, then click **Add to Waitlist**.\n\n" +
      `✅ **Selected:** ${team}\n\nClick **Add to Waitlist** to continue.`,
    );

  await interaction.editReply({ embeds: [embed], components: [...selectRows, actionRow] });
}

// ── Add to Waitlist: step 3 — check open/taken and act ───────────────────────

export async function handleReqWaitlistNext(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const uid  = interaction.user.id;
  const team = sess.pendingTeamRequest;
  await interaction.deferUpdate();

  if (!team) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ No Team Selected").setDescription("Please select a team from the dropdown first.")],
      components: [backToHubRow()],
    });
    return;
  }

  // Check if team is open or taken
  const taken = await getTakenTeams(gid);

  if (!taken.has(team)) {
    // Team is open — redirect to Request Open Team flow
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("🟢 Team Is Open!")
        .setDescription(`The **${team}** are actually available right now! Use **Request Open Team** to claim them directly instead of waiting.`)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ac_req_openteam").setLabel("🏈 Request Open Team").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back").setStyle(ButtonStyle.Secondary),
        ) as ActionRowBuilder<any>,
      ],
    });
    return;
  }

  // Team is taken — add to waitlist
  const [existing] = await db.select({ id: waitlistTable.id })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.guildId, gid), eq(waitlistTable.discordId, uid)));

  if (existing) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⚠️ Already on Waitlist")
        .setDescription("You're already on the waitlist. Use **Remove from Waitlist** first if you want to change your team preference.")],
      components: [backToHubRow()],
    });
    return;
  }

  await db.insert(waitlistTable).values({ guildId: gid, discordId: uid, addedBy: uid, team, status: "waiting" });

  // Notify commissioner
  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);
  if (logChannelId) {
    const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle("📋 Waitlist Request")
          .setDescription(`<@${uid}> has added themselves to the waitlist for the **${team}**.`)
          .setTimestamp()],
      }).catch(console.error);
    }
  }

  sess.pendingTeamRequest = undefined;

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Added to Waitlist")
      .setDescription(`You've been added to the waitlist for the **${team}**!\n\nYou'll receive a DM when the ${team} become available. The commissioner has also been notified.`)],
    components: [backToHubRow()],
  });
}

// ── Remove from Waitlist: confirm step ───────────────────────────────────────

export async function handleReqRmWaitlist(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;
  await interaction.deferUpdate();

  const [existing] = await db.select({ id: waitlistTable.id, status: waitlistTable.status, team: waitlistTable.team })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.guildId, gid), eq(waitlistTable.discordId, uid)));

  if (!existing) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("ℹ️ Not on Waitlist").setDescription("You are not currently on the waitlist.")],
      components: [backToHubRow()],
    });
    return;
  }

  const teamInfo = existing.team ? ` for the **${existing.team}**` : "";

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_req_rmwl_confirm").setLabel("✅ Yes, Remove Me").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Cancel").setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder<any>;

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle("⚠️ Confirm Waitlist Removal")
      .setDescription(`You are currently on the waitlist${teamInfo} (status: **${existing.status}**).\n\nAre you sure you want to remove yourself?`)],
    components: [confirmRow],
  });
}

export async function handleReqRmWaitlistConfirm(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;
  await interaction.deferUpdate();

  const [existing] = await db.select({ team: waitlistTable.team })
    .from(waitlistTable)
    .where(and(eq(waitlistTable.guildId, gid), eq(waitlistTable.discordId, uid)));

  await db.delete(waitlistTable).where(and(eq(waitlistTable.guildId, gid), eq(waitlistTable.discordId, uid)));

  const teamInfo = existing?.team ? ` (${existing.team})` : "";

  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);
  if (logChannelId) {
    const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Grey)
          .setTitle("📋 Waitlist Removal")
          .setDescription(`<@${uid}> has removed themselves from the waitlist${teamInfo}.`)
          .setTimestamp()],
      }).catch(console.error);
    }
  }

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Removed from Waitlist")
      .setDescription("You've been removed from the waitlist. You can re-add yourself at any time.")],
    components: [backToHubRow()],
  });
}

// ── Season Schedule ────────────────────────────────────────────────────────────

export async function handleSchedule(interaction: ButtonInteraction, sess: ActionsSession) {
  await interaction.deferUpdate();

  const guildId = sess.guildId;
  const userId  = sess.userId;

  const MIN_COMPLETED_STATUS = 2;

  const user = await getOrCreateUser(userId, interaction.user.username, guildId);

  if (!user.team) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("📅 Season Schedule").setDescription("❌ You don't have a registered team. Ask the commissioner to set you up.")],
      components: [backToHubRow() as ActionRowBuilder<any>],
    });
    return;
  }

  const season           = await getOrCreateActiveSeason(guildId);
  const scheduleSeasonId = await getScheduleSeasonId(guildId);

  // Use scheduleSeasonId for the MCA lookup so team names are consistent with
  // the schedule data — e.g. if the active season has no schedule yet, both
  // the MCA entry and the schedule rows come from the same prior season.
  const [mcaEntry] = await db
    .select({ fullName: franchiseMcaTeamsTable.fullName, nickName: franchiseMcaTeamsTable.nickName })
    .from(franchiseMcaTeamsTable)
    .where(and(
      eq(franchiseMcaTeamsTable.seasonId,  scheduleSeasonId),
      eq(franchiseMcaTeamsTable.discordId, userId),
    ))
    .limit(1);

  const candidateNames: string[] = [];
  if (mcaEntry?.fullName) candidateNames.push(mcaEntry.fullName.toLowerCase().trim());
  if (mcaEntry?.nickName) candidateNames.push(mcaEntry.nickName.toLowerCase().trim());
  if (user.team)          candidateNames.push(user.team.toLowerCase().trim());

  const uniqueNames = [...new Set(candidateNames)];

  const nameConditions = uniqueNames.flatMap(name => [
    sql`lower(${franchiseScheduleTable.homeTeamName}) = ${name}`,
    sql`lower(${franchiseScheduleTable.awayTeamName}) = ${name}`,
  ]);

  const allGames = await db
    .select()
    .from(franchiseScheduleTable)
    .where(and(
      eq(franchiseScheduleTable.seasonId, scheduleSeasonId),
      or(...nameConditions),
    ))
    .orderBy(asc(franchiseScheduleTable.weekIndex));

  const regularGames = allGames.filter(g => g.weekIndex >= 0 && g.weekIndex <= 17);

  // Resolve the season number to display — may differ from the active season
  // when scheduleSeasonId falls back to a prior season's data.
  let displaySeasonNumber = season.seasonNumber;
  if (scheduleSeasonId !== season.id) {
    const [altSeason] = await db.select({ seasonNumber: seasonsTable.seasonNumber })
      .from(seasonsTable).where(eq(seasonsTable.id, scheduleSeasonId)).limit(1);
    if (altSeason) displaySeasonNumber = altSeason.seasonNumber;
  }

  if (regularGames.length === 0) {
    const teamDisplay = mcaEntry?.fullName ?? user.team;
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("📅 Season Schedule").setDescription(`📭 No schedule data found for **${teamDisplay}** in Season ${displaySeasonNumber}. Make sure the full season schedule has been imported.`)],
      components: [backToHubRow() as ActionRowBuilder<any>],
    });
    return;
  }

  const scheduleTeamName = regularGames[0]
    ? (uniqueNames.find(n =>
        regularGames[0]!.homeTeamName.toLowerCase().trim() === n ||
        regularGames[0]!.awayTeamName.toLowerCase().trim() === n
      ) ?? uniqueNames[0]!)
    : uniqueNames[0]!;

  const played = regularGames.filter(g => g.status >= MIN_COMPLETED_STATUS).length;

  const lines = regularGames.map(g => {
    const isHome   = g.homeTeamName.toLowerCase().trim() === scheduleTeamName;
    const opponent = isHome ? g.awayTeamName : g.homeTeamName;
    const location = isHome ? "vs" : "@";
    const myScore  = isHome ? g.homeScore : g.awayScore;
    const oppScore = isHome ? g.awayScore : g.homeScore;
    const weekNum  = g.weekIndex + 1;

    if (g.status >= MIN_COMPLETED_STATUS && myScore !== null && oppScore !== null) {
      const tied  = myScore === oppScore;
      const won   = myScore > oppScore;
      const label = tied ? "T" : (won ? "W" : "L");
      const emoji = tied ? "🤝" : (won ? "✅" : "❌");
      return `**Wk ${weekNum}** ${location} ${opponent} — ${emoji} **${label}** (${myScore}–${oppScore})`;
    }
    return `**Wk ${weekNum}** ${location} ${opponent} — ⏳ Upcoming`;
  });

  const description = lines.join("\n");
  const displayName = mcaEntry?.fullName ?? user.team ?? "Your Team";

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle(`📅 ${displayName} — Season ${displaySeasonNumber} Schedule`)
        .setDescription(description.length > 4000 ? description.slice(0, 3997) + "..." : description)
        .setFooter({ text: `${played} of ${regularGames.length} games played` })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
      ) as ActionRowBuilder<any>,
    ],
  });
}

// ── Coins ─────────────────────────────────────────────────────────────────────

export async function handleCoins(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const user = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);

  const savingsRow = (await db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, interaction.user.id))
    .limit(1))[0];

  const savings = savingsRow?.balance ?? 0;
  const total   = user.balance + savings;

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("🪙 Your Coin Balance")
    .addFields(
      { name: "💰 Wallet",  value: `**${user.balance.toLocaleString()}** coins`, inline: true },
      { name: "🏦 Savings", value: `**${savings.toLocaleString()}** coins`, inline: true },
      { name: "📊 Total",   value: `**${total.toLocaleString()}** coins`, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_send_coins_modal").setLabel("📤 Send Coins").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_transfer").setLabel("💸 Transfer").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleBankTransfer(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const [user, savingsRow, rateBps, lastRunRow] = await Promise.all([
    getOrCreateUser(interaction.user.id, interaction.user.username, gid),
    db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
      .where(eq(userSavingsTable.discordId, interaction.user.id)).limit(1).then(r => r[0]),
    getSavingsInterestRateBps(),
    db.select({ value: payoutConfigTable.value }).from(payoutConfigTable)
      .where(eq(payoutConfigTable.key, "savings_last_interest_at")).limit(1).then(r => r[0]),
  ]);
  const savings = savingsRow?.balance ?? 0;

  // Projected daily interest
  const projectedInterest = rateBps > 0 && savings > 0
    ? Math.ceil(savings * rateBps / 10000)
    : 0;
  const ratePercent = (rateBps / 100).toFixed(2);

  // Time until next payout
  let nextPayoutStr = "~24h from last payout";
  if (lastRunRow?.value) {
    const lastRunMs   = lastRunRow.value * 1000;
    const nextRunMs   = lastRunMs + 24 * 60 * 60 * 1000;
    const msleft      = nextRunMs - Date.now();
    if (msleft > 0) {
      const hLeft = Math.floor(msleft / (60 * 60 * 1000));
      const mLeft = Math.floor((msleft % (60 * 60 * 1000)) / 60000);
      nextPayoutStr = `~${hLeft}h ${mLeft}m`;
    } else {
      nextPayoutStr = "very soon";
    }
  }

  let interestFieldValue: string;
  if (rateBps <= 0) {
    interestFieldValue = "No interest rate currently set.";
  } else if (savings <= 0) {
    interestFieldValue = `Rate: **${ratePercent}%**/day\nDeposit coins to start earning.`;
  } else {
    interestFieldValue = `**+${projectedInterest.toLocaleString()} coins** next payout\nRate: **${ratePercent}%**/day · Next: **${nextPayoutStr}**`;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("💸 Transfer — Choose Direction")
    .setDescription("Move coins between your wallet and savings account.")
    .addFields(
      { name: "💰 Wallet",  value: `**${user.balance.toLocaleString()}** coins`, inline: true },
      { name: "🏦 Savings", value: `**${savings.toLocaleString()}** coins`, inline: true },
      { name: "📈 Projected Interest", value: interestFieldValue, inline: false },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_transfer_dir:IN").setLabel("➡ Wallet → Savings").setStyle(ButtonStyle.Primary).setDisabled(user.balance <= 0),
    new ButtonBuilder().setCustomId("ac_transfer_dir:OUT").setLabel("⬅ Savings → Wallet").setStyle(ButtonStyle.Success).setDisabled(savings <= 0),
    new ButtonBuilder().setCustomId("ac_coins").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleBankTransferDir(interaction: ButtonInteraction) {
  const dir   = interaction.customId.split(":")[1] as "IN" | "OUT";
  const label = dir === "IN" ? "Wallet → Savings" : "Savings → Wallet";
  const modal = new ModalBuilder()
    .setCustomId(`ac_modal_transfer:${dir}`)
    .setTitle(`Transfer: ${label}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("Amount to transfer (coins)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. 500")
          .setRequired(true)
          .setMaxLength(20),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleBankTransferSubmit(interaction: ModalSubmitInteraction) {
  const dir       = interaction.customId.split(":")[1] as "IN" | "OUT";
  const amountStr = interaction.fields.getTextInputValue("amount").trim();
  const amount    = parseInt(amountStr, 10);
  const gid       = interaction.guildId!;

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: "❌ Please enter a valid positive amount.", ephemeral: true });
    return;
  }

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  const savingsRow = (await db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, interaction.user.id)).limit(1))[0];
  const savings = savingsRow?.balance ?? 0;

  if (dir === "IN") {
    if (user.balance < amount) {
      await interaction.reply({ content: `❌ Insufficient wallet balance. You have **${user.balance.toLocaleString()}** coins.`, ephemeral: true });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: user.balance - amount })
        .where(and(eq(usersTable.discordId, interaction.user.id), eq(usersTable.guildId, gid)));
      if (savingsRow) {
        await tx.update(userSavingsTable)
          .set({ balance: savings + amount })
          .where(eq(userSavingsTable.discordId, interaction.user.id));
      } else {
        await tx.insert(userSavingsTable).values({ discordId: interaction.user.id, balance: amount });
      }
    });
    await interaction.reply({
      content: `✅ Transferred **${amount.toLocaleString()}** coins to savings.\n💰 Wallet: **${(user.balance - amount).toLocaleString()}** | 🏦 Savings: **${(savings + amount).toLocaleString()}**`,
      ephemeral: true,
    });
  } else {
    if (savings < amount) {
      await interaction.reply({ content: `❌ Insufficient savings balance. You have **${savings.toLocaleString()}** coins in savings.`, ephemeral: true });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: user.balance + amount })
        .where(and(eq(usersTable.discordId, interaction.user.id), eq(usersTable.guildId, gid)));
      if (savingsRow) {
        await tx.update(userSavingsTable)
          .set({ balance: savings - amount })
          .where(eq(userSavingsTable.discordId, interaction.user.id));
      }
    });
    await interaction.reply({
      content: `✅ Transferred **${amount.toLocaleString()}** coins to wallet.\n💰 Wallet: **${(user.balance + amount).toLocaleString()}** | 🏦 Savings: **${(savings - amount).toLocaleString()}**`,
      ephemeral: true,
    });
  }
}

export async function handleSendCoinsModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_sendcoins")
    .setTitle("Send Coins")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("recipient").setLabel("Recipient's Discord username or @mention").setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("amount").setLabel("Amount (coins)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("e.g. 100"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("note").setLabel("Note (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleSendCoinsSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const recipientInput = interaction.fields.getTextInputValue("recipient").trim().replace(/[<@!>]/g, "");
  const amountStr      = interaction.fields.getTextInputValue("amount").trim();
  const note           = interaction.fields.getTextInputValue("note").trim();
  const gid            = interaction.guildId!;
  const amount         = parseInt(amountStr, 10);

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: "❌ Invalid amount.", ephemeral: true }); return;
  }

  // Try to find recipient by Discord ID or username
  const recipientRow = (await db.select({ discordId: usersTable.discordId, discordUsername: usersTable.discordUsername })
    .from(usersTable)
    .where(and(
      eq(usersTable.guildId, gid),
      sql`lower(${usersTable.discordUsername}) = lower(${recipientInput}) OR ${usersTable.discordId} = ${recipientInput}`,
    ))
    .limit(1))[0];

  if (!recipientRow) {
    await interaction.reply({ content: `❌ Could not find user **${recipientInput}** in this server.`, ephemeral: true }); return;
  }

  if (recipientRow.discordId === interaction.user.id) {
    await interaction.reply({ content: "❌ You can't send coins to yourself.", ephemeral: true }); return;
  }

  const sender = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  if (sender.balance < amount) {
    await interaction.reply({ content: `❌ Insufficient coins. You have **${sender.balance.toLocaleString()}**, trying to send **${amount.toLocaleString()}**.`, ephemeral: true }); return;
  }

  await getOrCreateUser(recipientRow.discordId, recipientRow.discordUsername, gid);
  await deductBalance(interaction.user.id, amount, gid);
  await addBalance(recipientRow.discordId, amount, gid);
  await logTransaction(interaction.user.id, -amount, "sendcoins_sent",     `Sent to ${recipientRow.discordUsername}${note ? `: ${note}` : ""}`,        gid, recipientRow.discordId);
  await logTransaction(recipientRow.discordId, amount, "sendcoins_received", `Received from ${interaction.user.username}${note ? `: ${note}` : ""}`, gid, interaction.user.id);

  await interaction.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Coins Sent")
      .setDescription(`Sent **${amount.toLocaleString()} coins** to **${recipientRow.discordUsername}**${note ? `\n*"${note}"*` : ""}`)],
    components: [backToHubRow()],
  });
}




// ── Coins ─────────────────────────────────────────────────────────────────────

export async function handleCoins(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const user = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);

  const savingsRow = (await db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, interaction.user.id))
    .limit(1))[0];

  const savings = savingsRow?.balance ?? 0;
  const total   = user.balance + savings;

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("🪙 Your Coin Balance")
    .addFields(
      { name: "💰 Wallet",  value: `**${user.balance.toLocaleString()}** coins`, inline: true },
      { name: "🏦 Savings", value: `**${savings.toLocaleString()}** coins`, inline: true },
      { name: "📊 Total",   value: `**${total.toLocaleString()}** coins`, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_send_coins_modal").setLabel("📤 Send Coins").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_transfer").setLabel("💸 Transfer").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleBankTransfer(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  const [user, savingsRow, rateBps, lastRunRow] = await Promise.all([
    getOrCreateUser(interaction.user.id, interaction.user.username, gid),
    db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
      .where(eq(userSavingsTable.discordId, interaction.user.id)).limit(1).then(r => r[0]),
    getSavingsInterestRateBps(),
    db.select({ value: payoutConfigTable.value }).from(payoutConfigTable)
      .where(eq(payoutConfigTable.key, "savings_last_interest_at")).limit(1).then(r => r[0]),
  ]);
  const savings = savingsRow?.balance ?? 0;

  // Projected daily interest
  const projectedInterest = rateBps > 0 && savings > 0
    ? Math.ceil(savings * rateBps / 10000)
    : 0;
  const ratePercent = (rateBps / 100).toFixed(2);

  // Time until next payout
  let nextPayoutStr = "~24h from last payout";
  if (lastRunRow?.value) {
    const lastRunMs   = lastRunRow.value * 1000;
    const nextRunMs   = lastRunMs + 24 * 60 * 60 * 1000;
    const msleft      = nextRunMs - Date.now();
    if (msleft > 0) {
      const hLeft = Math.floor(msleft / (60 * 60 * 1000));
      const mLeft = Math.floor((msleft % (60 * 60 * 1000)) / 60000);
      nextPayoutStr = `~${hLeft}h ${mLeft}m`;
    } else {
      nextPayoutStr = "very soon";
    }
  }

  let interestFieldValue: string;
  if (rateBps <= 0) {
    interestFieldValue = "No interest rate currently set.";
  } else if (savings <= 0) {
    interestFieldValue = `Rate: **${ratePercent}%**/day\nDeposit coins to start earning.`;
  } else {
    interestFieldValue = `**+${projectedInterest.toLocaleString()} coins** next payout\nRate: **${ratePercent}%**/day · Next: **${nextPayoutStr}**`;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("💸 Transfer — Choose Direction")
    .setDescription("Move coins between your wallet and savings account.")
    .addFields(
      { name: "💰 Wallet",  value: `**${user.balance.toLocaleString()}** coins`, inline: true },
      { name: "🏦 Savings", value: `**${savings.toLocaleString()}** coins`, inline: true },
      { name: "📈 Projected Interest", value: interestFieldValue, inline: false },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_transfer_dir:IN").setLabel("➡ Wallet → Savings").setStyle(ButtonStyle.Primary).setDisabled(user.balance <= 0),
    new ButtonBuilder().setCustomId("ac_transfer_dir:OUT").setLabel("⬅ Savings → Wallet").setStyle(ButtonStyle.Success).setDisabled(savings <= 0),
    new ButtonBuilder().setCustomId("ac_coins").setLabel("← Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

export async function handleBankTransferDir(interaction: ButtonInteraction) {
  const dir   = interaction.customId.split(":")[1] as "IN" | "OUT";
  const label = dir === "IN" ? "Wallet → Savings" : "Savings → Wallet";
  const modal = new ModalBuilder()
    .setCustomId(`ac_modal_transfer:${dir}`)
    .setTitle(`Transfer: ${label}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("amount")
          .setLabel("Amount to transfer (coins)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("e.g. 500")
          .setRequired(true)
          .setMaxLength(20),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleBankTransferSubmit(interaction: ModalSubmitInteraction) {
  const dir       = interaction.customId.split(":")[1] as "IN" | "OUT";
  const amountStr = interaction.fields.getTextInputValue("amount").trim();
  const amount    = parseInt(amountStr, 10);
  const gid       = interaction.guildId!;

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: "❌ Please enter a valid positive amount.", ephemeral: true });
    return;
  }

  const user = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  const savingsRow = (await db.select({ balance: userSavingsTable.balance }).from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, interaction.user.id)).limit(1))[0];
  const savings = savingsRow?.balance ?? 0;

  if (dir === "IN") {
    if (user.balance < amount) {
      await interaction.reply({ content: `❌ Insufficient wallet balance. You have **${user.balance.toLocaleString()}** coins.`, ephemeral: true });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: user.balance - amount })
        .where(and(eq(usersTable.discordId, interaction.user.id), eq(usersTable.guildId, gid)));
      if (savingsRow) {
        await tx.update(userSavingsTable)
          .set({ balance: savings + amount })
          .where(eq(userSavingsTable.discordId, interaction.user.id));
      } else {
        await tx.insert(userSavingsTable).values({ discordId: interaction.user.id, balance: amount });
      }
    });
    await interaction.reply({
      content: `✅ Transferred **${amount.toLocaleString()}** coins to savings.\n💰 Wallet: **${(user.balance - amount).toLocaleString()}** | 🏦 Savings: **${(savings + amount).toLocaleString()}**`,
      ephemeral: true,
    });
  } else {
    if (savings < amount) {
      await interaction.reply({ content: `❌ Insufficient savings balance. You have **${savings.toLocaleString()}** coins in savings.`, ephemeral: true });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(usersTable)
        .set({ balance: user.balance + amount })
        .where(and(eq(usersTable.discordId, interaction.user.id), eq(usersTable.guildId, gid)));
      if (savingsRow) {
        await tx.update(userSavingsTable)
          .set({ balance: savings - amount })
          .where(eq(userSavingsTable.discordId, interaction.user.id));
      }
    });
    await interaction.reply({
      content: `✅ Transferred **${amount.toLocaleString()}** coins to wallet.\n💰 Wallet: **${(user.balance + amount).toLocaleString()}** | 🏦 Savings: **${(savings - amount).toLocaleString()}**`,
      ephemeral: true,
    });
  }
}

export async function handleSendCoinsModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_sendcoins")
    .setTitle("Send Coins")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("recipient").setLabel("Recipient's Discord username or @mention").setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("amount").setLabel("Amount (coins)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("e.g. 100"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("note").setLabel("Note (optional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleSendCoinsSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const recipientInput = interaction.fields.getTextInputValue("recipient").trim().replace(/[<@!>]/g, "");
  const amountStr      = interaction.fields.getTextInputValue("amount").trim();
  const note           = interaction.fields.getTextInputValue("note").trim();
  const gid            = interaction.guildId!;
  const amount         = parseInt(amountStr, 10);

  if (isNaN(amount) || amount < 1) {
    await interaction.reply({ content: "❌ Invalid amount.", ephemeral: true }); return;
  }

  // Try to find recipient by Discord ID or username
  const recipientRow = (await db.select({ discordId: usersTable.discordId, discordUsername: usersTable.discordUsername })
    .from(usersTable)
    .where(and(
      eq(usersTable.guildId, gid),
      sql`lower(${usersTable.discordUsername}) = lower(${recipientInput}) OR ${usersTable.discordId} = ${recipientInput}`,
    ))
    .limit(1))[0];

  if (!recipientRow) {
    await interaction.reply({ content: `❌ Could not find user **${recipientInput}** in this server.`, ephemeral: true }); return;
  }

  if (recipientRow.discordId === interaction.user.id) {
    await interaction.reply({ content: "❌ You can't send coins to yourself.", ephemeral: true }); return;
  }

  const sender = await getOrCreateUser(interaction.user.id, interaction.user.username, gid);
  if (sender.balance < amount) {
    await interaction.reply({ content: `❌ Insufficient coins. You have **${sender.balance.toLocaleString()}**, trying to send **${amount.toLocaleString()}**.`, ephemeral: true }); return;
  }

  await getOrCreateUser(recipientRow.discordId, recipientRow.discordUsername, gid);
  await deductBalance(interaction.user.id, amount, gid);
  await addBalance(recipientRow.discordId, amount, gid);
  await logTransaction(interaction.user.id, -amount, "sendcoins_sent",     `Sent to ${recipientRow.discordUsername}${note ? `: ${note}` : ""}`,        gid, recipientRow.discordId);
  await logTransaction(recipientRow.discordId, amount, "sendcoins_received", `Received from ${interaction.user.username}${note ? `: ${note}` : ""}`, gid, interaction.user.id);

  await interaction.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Coins Sent")
      .setDescription(`Sent **${amount.toLocaleString()} coins** to **${recipientRow.discordUsername}**${note ? `\n*"${note}"*` : ""}`)],
    components: [backToHubRow()],
  });
}




