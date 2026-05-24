/**
 * team-stats-handlers.ts
 * Team stats interaction section.
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

// ── Team Stats ────────────────────────────────────────────────────────────────

export async function handleTeamStatsTeamPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid      = interaction.guildId!;
  const season   = await getOrCreateActiveSeason(gid);
  const allTeams = await db.select({
    mcaTeamId:  franchiseMcaTeamsTable.teamId,
    fullName:   franchiseMcaTeamsTable.fullName,
    nickName:   franchiseMcaTeamsTable.nickName,
    conference: franchiseMcaTeamsTable.conference,
    isHuman:    franchiseMcaTeamsTable.isHuman,
  })
    .from(franchiseMcaTeamsTable)
    .where(and(eq(franchiseMcaTeamsTable.seasonId, season.id), eq(franchiseMcaTeamsTable.isHuman, true)))
    .orderBy(franchiseMcaTeamsTable.fullName);

  if (!allTeams.length) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ No teams found.")], components: [backToHubRow()] });
    return;
  }

  // Split by conference; fall back to NFL_DIVISION_MAP if conference field is null
  const afcTeams = allTeams.filter(t => {
    const c = t.conference?.toUpperCase();
    if (c === "AFC") return true;
    if (c === "NFC") return false;
    return NFL_DIVISION_MAP[t.nickName ?? ""]?.conference === "AFC";
  });
  const nfcTeams = allTeams.filter(t => {
    const c = t.conference?.toUpperCase();
    if (c === "NFC") return true;
    if (c === "AFC") return false;
    return NFL_DIVISION_MAP[t.nickName ?? ""]?.conference === "NFC";
  });

  // Use MCA teamId as value — teamSeasonStatsTable.teamId stores MCA ids
  const makeMenu = (conf: string, list: typeof allTeams) =>
    new StringSelectMenuBuilder()
      .setCustomId("ac_teamstats_sel")
      .setPlaceholder(`${conf} — pick a team…`)
      .addOptions(list.slice(0, 25).map(t =>
        new StringSelectMenuOptionBuilder().setLabel(t.fullName).setValue(String(t.mcaTeamId)),
      ));

  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  if (afcTeams.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(makeMenu("🔴 AFC", afcTeams)));
  if (nfcTeams.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(makeMenu("🔵 NFC", nfcTeams)));
  components.push(cancelRow() as any);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("🏟️ Team Stats — Select Team").setDescription("Pick a team from the **AFC** or **NFC** dropdown.")],
    components,
  });
}

export async function handleTeamStatsShow(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  // Value is MCA teamId (not serial PK)
  const mcaTeamId = Number(interaction.values[0]);
  const gid       = interaction.guildId!;
  const season    = await getOrCreateActiveSeason(gid);

  const [teamRow, statsRow] = await Promise.all([
    db.select({ fullName: franchiseMcaTeamsTable.fullName })
      .from(franchiseMcaTeamsTable)
      .where(and(eq(franchiseMcaTeamsTable.seasonId, season.id), eq(franchiseMcaTeamsTable.teamId, mcaTeamId)))
      .limit(1).then(r => r[0]),
    db.select().from(teamSeasonStatsTable)
      .where(and(eq(teamSeasonStatsTable.seasonId, season.id), eq(teamSeasonStatsTable.teamId, mcaTeamId)))
      .limit(1).then(r => r[0]),
  ]);

  const teamName = teamRow?.fullName ?? "Unknown Team";

  if (!statsRow) {
    await interaction.update({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle(`🏟️ ${teamName} — Team Stats`).setDescription("No team stats found yet this season. Import MCA data to populate.")], components: [backToHubRow()] });
    return;
  }

  const ppg = statsRow.offPtsPerGame > 0 ? statsRow.offPtsPerGame.toFixed(1) : "N/A";
  const offPct = statsRow.offRedZonePct > 0 ? `${statsRow.offRedZonePct.toFixed(1)}%` : "N/A";
  const defPct = statsRow.defRedZonePct > 0 ? `${statsRow.defRedZonePct.toFixed(1)}%` : "N/A";

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🏟️ ${teamName} — Season ${season.seasonNumber} Stats`)
    .setDescription(`**Record: ${statsRow.wins}W-${statsRow.losses}L**`)
    .addFields(
      { name: "📤 Offense",       value: `Pass: ${statsRow.offPassYds.toLocaleString()} yds\nRush: ${statsRow.offRushYds.toLocaleString()} yds\nTotal: ${statsRow.offYds.toLocaleString()} yds\nPts/Game: ${ppg}\nRed Zone%: ${offPct}`, inline: true },
      { name: "📥 Defense",       value: `Pass Yds Allowed: ${statsRow.defPassYds.toLocaleString()}\nRush Yds Allowed: ${statsRow.defRushYds.toLocaleString()}\nSacks: ${statsRow.teamSacks}\nINTs: ${statsRow.teamInts}\nRZ% Allowed: ${defPct}`, inline: true },
      { name: "🔄 Turnovers",     value: `Turnover Diff: **${statsRow.turnoverDiff >= 0 ? "+" : ""}${statsRow.turnoverDiff}**\nFumbles Rec: ${statsRow.defFumblesRec}`, inline: true },
    )
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [backToHubRow()] });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROW 3 — League Info
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleStandingsConfPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_standings_conf:AFC").setLabel("🔴 AFC").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ac_standings_conf:NFC").setLabel("🔵 NFC").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_standings_conf:ALL").setLabel("🌐 Both").setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_inthehunt").setLabel("🎯 In The Hunt").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_teamstowatch").setLabel("👀 Teams to Watch").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back").setStyle(ButtonStyle.Secondary),
  );
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("📈 Standings")
      .setDescription("Choose a conference view, or check In The Hunt / Teams to Watch.")],
    components: [row1, row2],
  });
}

export async function handleStandingsShow(interaction: ButtonInteraction, sess: ActionsSession) {
  const conf = interaction.customId.split(":")[1] as "AFC" | "NFC" | "ALL";
  const gid  = interaction.guildId!;
  await interaction.deferUpdate();

  const season       = await getOrCreateActiveSeason(gid);
  const allStandings = await getArticleStandings(season.id, 18);

  if (conf === "ALL") {
    const afc = allStandings.filter(t => t.conference === "AFC");
    const nfc = allStandings.filter(t => t.conference === "NFC");
    if (!afc.length && !nfc.length) {
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("League Standings").setDescription("No game data yet.")], components: [backToHubRow()] });
      return;
    }
    const embeds: EmbedBuilder[] = [];
    const buildConf = (conference: "AFC" | "NFC", teams: typeof allStandings) => {
      const sorted = [...teams].sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
      const lines  = sorted.map((t, i) => `**${i + 1}.** ${t.teamName} — ${t.wins}W-${t.losses}L (${t.pointDifferential >= 0 ? "+" : ""}${t.pointDifferential} pts)`);
      return new EmbedBuilder()
        .setColor(conference === "AFC" ? Colors.Red : Colors.Blue)
        .setTitle(`🏈 ${conference} Standings — Season ${season.seasonNumber}`)
        .setDescription(lines.join("\n") || "No data");
    };
    if (afc.length) embeds.push(buildConf("AFC", afc));
    if (nfc.length) embeds.push(buildConf("NFC", nfc));
    await interaction.editReply({ embeds, components: [backToHubRow()] });
    return;
  }

  const confTeams = allStandings.filter(t => t.conference === conf);
  if (!confTeams.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle(`${conf} Standings`).setDescription("No data yet.")], components: [backToHubRow()] });
    return;
  }

  const sorted = [...confTeams].sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
  const lines  = sorted.map((t, i) => `**${i + 1}.** ${t.teamName} — ${t.wins}W-${t.losses}L (${t.pointDifferential >= 0 ? "+" : ""}${t.pointDifferential} pts)`);

  const embed = new EmbedBuilder()
    .setColor(conf === "AFC" ? Colors.Red : Colors.Blue)
    .setTitle(`🏈 ${conf} Standings — Season ${season.seasonNumber}`)
    .setDescription(lines.join("\n"))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleInTheHunt(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const season       = await getOrCreateActiveSeason(gid);
  const allStandings = await getArticleStandings(season.id, 18);

  if (!allStandings.length) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("🎯 In The Hunt").setDescription("No standings data yet.")],
      components: [backToHubRow()],
    });
    return;
  }

  const DIVISIONS = ["East", "North", "South", "West"] as const;

  const embeds: EmbedBuilder[] = [];

  for (const conf of ["AFC", "NFC"] as const) {
    const confTeams = allStandings.filter(t => t.conference === conf);
    if (!confTeams.length) continue;

    // Division leaders
    const divWinners = new Set<string>();
    for (const div of DIVISIONS) {
      const leader = confTeams
        .filter(t => t.division === div)
        .sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential)[0];
      if (leader) divWinners.add(leader.teamName);
    }

    const sortedWinners   = confTeams.filter(t =>  divWinners.has(t.teamName)).sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
    const sortedWildCards = confTeams.filter(t => !divWinners.has(t.teamName)).sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
    const seeds = [...sortedWinners, ...sortedWildCards];

    const wildCardSeeds = seeds.slice(4, 7);  // seeds 5-7
    const bubbleTeams   = seeds.slice(7, 10); // seeds 8-10
    const cutline       = wildCardSeeds[2];   // last team "in"

    const lines: string[] = [];

    lines.push("**Division Leaders (Seeds 1-4):**");
    sortedWinners.forEach((t, i) => {
      lines.push(`**#${i + 1}** ${t.teamName} — ${t.wins}-${t.losses}`);
    });

    if (wildCardSeeds.length) {
      lines.push("");
      lines.push("**🎯 Wild Card Race (Seeds 5-7):**");
      wildCardSeeds.forEach((t, i) => {
        const pd = t.pointDifferential >= 0 ? `+${t.pointDifferential}` : `${t.pointDifferential}`;
        lines.push(`✅ **#${i + 5}** ${t.teamName} — ${t.wins}-${t.losses} | PD ${pd} *(IN)*`);
      });
    }

    if (bubbleTeams.length && cutline) {
      lines.push("");
      lines.push("**⚠️ On The Bubble:**");
      bubbleTeams.forEach(t => {
        const gb = cutline.wins - t.wins;
        const pd = t.pointDifferential >= 0 ? `+${t.pointDifferential}` : `${t.pointDifferential}`;
        lines.push(`• ${t.teamName} — ${t.wins}-${t.losses} | PD ${pd} *(${gb} win${gb !== 1 ? "s" : ""} back)*`);
      });
    } else if (!wildCardSeeds.length) {
      lines.push("\n*Not enough teams to determine wild card race.*");
    }

    embeds.push(
      new EmbedBuilder()
        .setColor(conf === "AFC" ? Colors.Blue : Colors.Red)
        .setTitle(`🎯 ${conf} Playoff Hunt — Season ${season.seasonNumber}`)
        .setDescription(lines.join("\n"))
        .setTimestamp(),
    );
  }

  if (!embeds.length) {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("🎯 In The Hunt").setDescription("No conference data available.")],
      components: [backToHubRow()],
    });
    return;
  }

  await interaction.editReply({ embeds, components: [backToHubRow()] });
}

export async function handleTeamsToWatch(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid  = interaction.guildId!;
  await interaction.deferUpdate();

  const season       = await getOrCreateActiveSeason(gid);
  const allStandings = await getArticleStandings(season.id, 18);

  if (!allStandings.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("👀 Teams to Watch").setDescription("No standings data yet.")], components: [backToHubRow()] });
    return;
  }

  // Hot teams: most wins, best point differential among top-4 per conf
  const sorted = [...allStandings].sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
  const hot    = sorted.slice(0, 4);
  const cold   = [...sorted].sort((a, b) => a.wins - b.wins || a.pointDifferential - b.pointDifferential).slice(0, 4);

  const hotLines  = hot.map((t, i)  => `**${i + 1}.** ${t.teamName} (${t.conference}) — ${t.wins}W-${t.losses}L | ${t.pointDifferential >= 0 ? "+" : ""}${t.pointDifferential} pts`);
  const coldLines = cold.map((t, i) => `**${i + 1}.** ${t.teamName} (${t.conference}) — ${t.wins}W-${t.losses}L | ${t.pointDifferential >= 0 ? "+" : ""}${t.pointDifferential} pts`);

  const embed = new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle(`👀 Teams to Watch — Season ${season.seasonNumber}`)
    .addFields(
      { name: "🔥 Best Performing",      value: hotLines.join("\n")  || "N/A", inline: false },
      { name: "❄️ Struggling Teams",     value: coldLines.join("\n") || "N/A", inline: false },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleAnyUserStatsTeamPick(interaction: ButtonInteraction, sess: ActionsSession) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("👤 Any User Stats — Pick Conference")],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_anyus_conf:AFC").setLabel("🔵 AFC").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ac_anyus_conf:NFC").setLabel("🔴 NFC").setStyle(ButtonStyle.Danger),
      ),
      cancelRow(),
    ],
  });
}

export async function handleAnyUserStatsConfPick(interaction: ButtonInteraction, sess: ActionsSession) {
  const conf = interaction.customId.split(":")[1] as "AFC" | "NFC";
  const gid  = interaction.guildId!;

  const allUsers = await db.select({ discordId: usersTable.discordId, discordUsername: usersTable.discordUsername, team: usersTable.team })
    .from(usersTable)
    .where(and(
      eq(usersTable.guildId, gid),
      isNotNull(usersTable.team),
      ne(usersTable.team, ""),
    ))
    .orderBy(usersTable.team);

  const confUsers = allUsers.filter(u => {
    const teamKey = (u.team ?? "").replace(/^(.*\s)?/, "").trim(); // try nickname last word
    const fullKey = (u.team ?? "").trim();
    const info = NFL_DIVISION_MAP[fullKey] ?? NFL_DIVISION_MAP[teamKey];
    return info?.conference === conf;
  });

  if (!confUsers.length) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription(`❌ No ${conf} users found.`)],
      components: [backToHubRow()],
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ac_anyus_sel")
    .setPlaceholder(`Select a ${conf} team owner…`)
    .addOptions(
      confUsers.slice(0, 25).map(u =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${u.team ?? u.discordUsername}`)
          .setDescription(`@${u.discordUsername}`)
          .setValue(u.discordId),
      ),
    );

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`👤 Any User Stats — ${conf} Owners`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), cancelRow()],
  });
}

export async function handleAnyUserStatsShow(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const targetId = interaction.values[0]!;
  const gid      = interaction.guildId!;
  await interaction.deferUpdate();

  const [season, settings] = await Promise.all([
    getOrCreateActiveSeason(gid),
    getServerSettings(gid),
  ]);
  const rules = await getSeasonRules(season);

  const [targetUser, savingsRow, recordRow, seasonStatsRow, globalRecord, eaIds, lastTxns] = await Promise.all([
    db.select().from(usersTable).where(and(eq(usersTable.discordId, targetId), eq(usersTable.guildId, gid))).limit(1).then(r => r[0]),
    db.select({ balance: userSavingsTable.balance }).from(userSavingsTable).where(eq(userSavingsTable.discordId, targetId)).limit(1).then(r => r[0]),
    db.select().from(userRecordsTable).where(and(eq(userRecordsTable.discordId, targetId), eq(userRecordsTable.seasonId, season.id))).limit(1).then(r => r[0]),
    getSeasonStats(targetId, season.id),
    db.select({ wins: globalUserRecordsTable.wins, losses: globalUserRecordsTable.losses })
      .from(globalUserRecordsTable).where(eq(globalUserRecordsTable.discordId, targetId)).limit(1).then(r => r[0]),
    db.select({ eaId: playerEaIdsTable.eaId, console: playerEaIdsTable.console, slot: playerEaIdsTable.slot })
      .from(playerEaIdsTable).where(eq(playerEaIdsTable.discordId, targetId)).orderBy(playerEaIdsTable.slot),
    db.select({ amount: coinTransactionsTable.amount, description: coinTransactionsTable.description, createdAt: coinTransactionsTable.createdAt })
      .from(coinTransactionsTable)
      .where(and(eq(coinTransactionsTable.discordId, targetId), eq(coinTransactionsTable.guildId, gid)))
      .orderBy(desc(coinTransactionsTable.createdAt)).limit(10),
  ]);

  if (!targetUser) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription("❌ User not found.")], components: [backToHubRow()] });
    return;
  }

  // Legends scoped to this guild via seasonId → seasonsTable.guildId join
  const legendRows = await db.select({ legendName: inventoryTable.legendName, legendCategory: inventoryTable.legendCategory })
    .from(inventoryTable)
    .innerJoin(seasonsTable, eq(inventoryTable.seasonId, seasonsTable.id))
    .where(and(
      eq(inventoryTable.itemType, "legend"),
      eq(seasonsTable.guildId, gid),
      eq(inventoryTable.discordId, targetId),
    ));

  // Custom players scoped to this guild via seasonId → seasonsTable.guildId join
  const customPlayerRows = await db.select({
    firstName: customPlayersTable.firstName, lastName: customPlayersTable.lastName,
    position: customPlayersTable.position, packageTier: customPlayersTable.packageTier,
  }).from(customPlayersTable)
    .innerJoin(seasonsTable, eq(customPlayersTable.seasonId, seasonsTable.id))
    .where(and(
      eq(customPlayersTable.discordId, targetId),
      eq(seasonsTable.guildId, gid),
      ne(customPlayersTable.status, "refunded"),
    ));

  const savings = savingsRow?.balance ?? 0;
  const total   = targetUser.balance + savings;
  const ssW     = recordRow?.wins          ?? 0;
  const ssL     = recordRow?.losses        ?? 0;
  const atW     = globalRecord?.wins       ?? 0;
  const atL     = globalRecord?.losses     ?? 0;
  const sbW     = recordRow?.superbowlWins ?? 0;

  const embed = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`👤 ${targetUser.team ?? targetUser.discordUsername} — User Stats`)
    .addFields(
      { name: "💰 Balance",       value: `Wallet: **${targetUser.balance.toLocaleString()}**\nSavings: **${savings.toLocaleString()}**\nTotal: **${total.toLocaleString()}**`, inline: true },
      { name: "📊 Season Record", value: `${ssW}W-${ssL}L`, inline: true },
      { name: "🏆 All-Time",      value: `${atW}W-${atL}L | ${sbW} SB${sbW !== 1 ? "s" : ""}`, inline: true },
    );

  if (eaIds.length) {
    embed.addFields({ name: "🎮 EA IDs", value: eaIds.map(e => `${e.console.toUpperCase()}: **${e.eaId}**`).join("\n"), inline: false });
  }

  if (seasonStatsRow) {
    const { devUpsPurchased, ageResetsPurchased } = seasonStatsRow;
    const ecoOn  = settings.coinEconomy;
    const devOn  = ecoOn && settings.devUpgradesEnabled;
    const ageOn  = ecoOn && settings.ageResetsEnabled;
    const devFmt = devOn ? `${devUpsPurchased ?? 0} (${rules.devUpsCap})`       : `${devUpsPurchased ?? 0} (n/a)`;
    const ageFmt = ageOn ? `${ageResetsPurchased ?? 0} (${rules.ageResetsCap})` : `${ageResetsPurchased ?? 0} (n/a)`;
    embed.addFields({
      name: "🛒 This Season's Purchases",
      value: `Dev Ups: ${devFmt} | Age Resets: ${ageFmt}`,
      inline: false,
    });
  }

  const vaultLegends   = legendRows.filter(l => l.legendCategory === "permanent");
  const currentLegends = legendRows.filter(l => l.legendCategory !== "permanent");
  if (legendRows.length) {
    const parts: string[] = [];
    if (currentLegends.length) parts.push(`Season: ${currentLegends.map(l => l.legendName).join(", ")}`);
    if (vaultLegends.length)   parts.push(`Vault: ${vaultLegends.map(l => l.legendName).join(", ")}`);
    embed.addFields({ name: "🏅 Legends", value: parts.join("\n"), inline: false });
  }

  if (customPlayerRows.length) {
    embed.addFields({
      name: "⚡ Custom Players",
      value: customPlayerRows.map(p => `${p.firstName} ${p.lastName} (${p.position}) — ${p.packageTier}`).join("\n"),
      inline: false,
    });
  }

  if (lastTxns.length) {
    const txLines = lastTxns.map(t => {
      const sign = t.amount >= 0 ? "+" : "";
      const ts   = `<t:${Math.floor(new Date(t.createdAt).getTime() / 1000)}:d>`;
      return `${ts} **${sign}${t.amount.toLocaleString()}** — ${t.description}`;
    });
    embed.addFields({ name: "📋 Last 10 Transactions", value: txLines.join("\n"), inline: false });
  }

  embed.setTimestamp();
  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROW 4 — Rankings & Payouts
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleSeasonPR(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const season  = await getOrCreateActiveSeason(gid);
  // Query directly — do NOT overlay allTimeSuperbowlWins (cross-guild contamination risk).
  // seasonId is unique per guild so this is already guild-scoped.
  const dbRows = await db.select().from(userRecordsTable)
    .where(eq(userRecordsTable.seasonId, season.id));

  if (!dbRows.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle(`📊 Season ${season.seasonNumber} Power Rankings`).setDescription("No game records yet.")], components: [backToHubRow()] });
    return;
  }

  const ranked = dbRows.map(r => ({
    discordId:         r.discordId,
    discordUsername:   r.discordUsername,
    team:              r.team ?? null,
    wins:              r.wins,
    losses:            r.losses,
    pointDifferential: r.pointDifferential,
    playoffWins:       r.playoffWins,
    playoffLosses:     r.playoffLosses,
    superbowlWins:     r.superbowlWins,
    superbowlLosses:   r.superbowlLosses,
    gp: r.wins + r.losses,
    pr: calcPRScore(r.wins, r.losses, r.pointDifferential),
    label: r.team ?? r.discordUsername,
  })).sort((a, b) => b.pr - a.pr);

  const medals = ["🥇", "🥈", "🥉"];
  const lines  = ranked.map((r, i) => {
    const badge   = medals[i] ?? `**${ordinal(i + 1)}**`;
    const winPct  = r.gp > 0 ? ((r.wins / r.gp) * 100).toFixed(1) : "0.0";
    const postseason = [
      r.playoffWins + r.playoffLosses > 0 ? `PO: ${r.playoffWins}W-${r.playoffLosses}L` : "",
      r.superbowlWins + r.superbowlLosses > 0 ? `🏆SB: ${r.superbowlWins}W-${r.superbowlLosses}L` : "",
    ].filter(Boolean).join(" | ");
    return `${badge} **${r.label}** — ${r.wins}W-${r.losses}L | ${fmtDiff(r.pointDifferential)} pts | ${winPct}% | PR: ${r.pr.toFixed(1)}${postseason ? ` *(${postseason})*` : ""}`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(`📊 Season ${season.seasonNumber} Power Rankings`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: "PR Score = 60% × (W-L Diff) + 40% × (Point Diff)" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleAllTimePR(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  // Get season IDs belonging to this guild only — avoids cross-guild record contamination.
  const guildSeasonRows = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.guildId, gid));
  const guildSeasonIds = guildSeasonRows.map(s => s.id);

  const dbRows = guildSeasonIds.length
    ? await db.select().from(userRecordsTable).where(inArray(userRecordsTable.seasonId, guildSeasonIds))
    : [];

  // Load current guild roster for team labels and allTimeSuperbowlWins (guild-scoped)
  const guildUsers = await db.select({
    discordId:            usersTable.discordId,
    discordUsername:      usersTable.discordUsername,
    team:                 usersTable.team,
    allTimeSuperbowlWins: usersTable.allTimeSuperbowlWins,
    allTimeSuperbowlLosses: usersTable.allTimeSuperbowlLosses,
  }).from(usersTable).where(eq(usersTable.guildId, gid));

  const guildTeamMap = new Map(guildUsers.map(u => [u.discordId, u]));

  // Aggregate across seasons (within this guild)
  const agg = new Map<string, {
    discordId: string; discordUsername: string; team: string | null;
    wins: number; losses: number; pointDifferential: number;
    playoffWins: number; playoffLosses: number; superbowlWins: number; superbowlLosses: number;
  }>();
  for (const r of dbRows) {
    const ex = agg.get(r.discordId);
    if (ex) {
      ex.wins               += r.wins;
      ex.losses             += r.losses;
      ex.pointDifferential  += r.pointDifferential;
      ex.playoffWins        += r.playoffWins;
      ex.playoffLosses      += r.playoffLosses;
      ex.superbowlWins      += r.superbowlWins;
      ex.superbowlLosses    += r.superbowlLosses;
      if (r.team) ex.team    = r.team;
      ex.discordUsername     = r.discordUsername;
    } else {
      agg.set(r.discordId, {
        discordId:         r.discordId,
        discordUsername:   r.discordUsername,
        team:              r.team ?? null,
        wins:              r.wins,
        losses:            r.losses,
        pointDifferential: r.pointDifferential,
        playoffWins:       r.playoffWins,
        playoffLosses:     r.playoffLosses,
        superbowlWins:     r.superbowlWins,
        superbowlLosses:   r.superbowlLosses,
      });
    }
  }

  // Overlay allTimeSuperbowlWins/Losses from usersTable (guild-scoped — no cross-guild bleed)
  for (const [id, rec] of agg) {
    const u = guildTeamMap.get(id);
    if (u) {
      rec.superbowlWins   = Math.max(rec.superbowlWins,   u.allTimeSuperbowlWins   ?? 0);
      rec.superbowlLosses = Math.max(rec.superbowlLosses, u.allTimeSuperbowlLosses ?? 0);
    }
  }

  // Filter to only users who are in this guild
  const filtered = [...agg.values()].filter(r => guildTeamMap.has(r.discordId));

  if (!filtered.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("🏆 All-Time Power Rankings").setDescription("No all-time records yet.")], components: [backToHubRow()] });
    return;
  }

  const ranked = filtered.map(r => {
    const u = guildTeamMap.get(r.discordId);
    const currentTeam = u?.team ?? null;
    let teamSuffix: string;
    if (currentTeam && currentTeam.trim() !== "") {
      teamSuffix = ` (${currentTeam})`;
    } else if (r.team && r.team.trim() !== "") {
      teamSuffix = ` (PREV "${r.team}")`;
    } else {
      teamSuffix = "";
    }
    return {
      ...r,
      gp:    r.wins + r.losses,
      pr:    calcPRScore(r.wins, r.losses, r.pointDifferential),
      label: `${r.discordUsername}${teamSuffix}`,
    };
  }).sort((a, b) => b.pr - a.pr);

  const medals = ["🥇", "🥈", "🥉"];
  const lines  = ranked.map((r, i) => {
    const badge   = medals[i] ?? `**${ordinal(i + 1)}**`;
    const winPct  = r.gp > 0 ? ((r.wins / r.gp) * 100).toFixed(1) : "0.0";
    const postseason = [
      r.playoffWins + r.playoffLosses > 0 ? `PO: ${r.playoffWins}W-${r.playoffLosses}L` : "",
      r.superbowlWins + r.superbowlLosses > 0 ? `🏆SB: ${r.superbowlWins}W-${r.superbowlLosses}L` : "",
    ].filter(Boolean).join(" | ");
    return `${badge} **${r.label}** — ${r.wins}W-${r.losses}L | ${fmtDiff(r.pointDifferential)} pts | ${winPct}% | PR: ${r.pr.toFixed(1)}${postseason ? ` *(${postseason})*` : ""}`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Purple)
    .setTitle("🏆 All-Time Power Rankings")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "PR Score = 60% × (W-L Diff) + 40% × (Point Diff)" })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleGlobalPR(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  // Step 1: fetch guild members only (for the display list)
  const guildUsers = await db.select({
    discordId:       usersTable.discordId,
    team:            usersTable.team,
    discordUsername: usersTable.discordUsername,
    walletBalance:   usersTable.balance,
  }).from(usersTable)
    .where(and(
      eq(usersTable.guildId, gid),
      isNotNull(usersTable.team),
      ne(usersTable.team, ""),
      ne(usersTable.discordUsername, "Open Slot"),
    ));

  if (!guildUsers.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Blue).setTitle("🌐 Global Power Rankings").setDescription("No linked users found in this server.")], components: [backToHubRow()] });
    return;
  }

  // Step 2: fetch ALL global records (for accurate global rank)
  const allGlobalRecords = await db.select({
    discordId: globalUserRecordsTable.discordId,
    wins:      globalUserRecordsTable.wins,
    losses:    globalUserRecordsTable.losses,
    pointDiff: globalUserRecordsTable.pointDifferential,
  }).from(globalUserRecordsTable);

  // Step 3: rank ALL global records by PR score
  const globalRanked = allGlobalRecords
    .map(r => ({ discordId: r.discordId, pr: calcPRScore(r.wins ?? 0, r.losses ?? 0, r.pointDiff ?? 0), wins: r.wins ?? 0, losses: r.losses ?? 0, pd: r.pointDiff ?? 0 }))
    .sort((a, b) => b.pr - a.pr);

  const globalRankMap = new Map<string, { rank: number; wins: number; losses: number; pd: number; pr: number }>();
  globalRanked.forEach((r, i) => globalRankMap.set(r.discordId, { rank: i + 1, wins: r.wins, losses: r.losses, pd: r.pd, pr: r.pr }));

  // Step 3b: aggregate global playoff / SB data from userRecordsTable across all seasons & guilds
  const allSeasonRecords = await db.select({
    discordId:      userRecordsTable.discordId,
    playoffWins:    userRecordsTable.playoffWins,
    playoffLosses:  userRecordsTable.playoffLosses,
    superbowlWins:  userRecordsTable.superbowlWins,
    superbowlLosses: userRecordsTable.superbowlLosses,
  }).from(userRecordsTable);

  const globalPostseasonMap = new Map<string, { pw: number; pl: number; sw: number; sl: number }>();
  for (const r of allSeasonRecords) {
    const ex = globalPostseasonMap.get(r.discordId);
    if (ex) {
      ex.pw += r.playoffWins;
      ex.pl += r.playoffLosses;
      ex.sw += r.superbowlWins;
      ex.sl += r.superbowlLosses;
    } else {
      globalPostseasonMap.set(r.discordId, { pw: r.playoffWins, pl: r.playoffLosses, sw: r.superbowlWins, sl: r.superbowlLosses });
    }
  }

  // Step 4: fetch savings balances for guild users
  const guildIds = guildUsers.map(u => u.discordId);
  const savingsRows = guildIds.length
    ? await db.select({ discordId: userSavingsTable.discordId, balance: userSavingsTable.balance })
        .from(userSavingsTable)
        .where(inArray(userSavingsTable.discordId, guildIds))
    : [];
  const savingsMap = new Map(savingsRows.map(s => [s.discordId, s.balance]));

  // Step 5: build display rows for guild users (sorted by global rank)
  const displayRows = guildUsers
    .map(u => {
      const g  = globalRankMap.get(u.discordId);
      const ps = globalPostseasonMap.get(u.discordId);
      return {
        discordId:     u.discordId,
        username:      u.discordUsername ?? u.discordId,
        team:          u.team ?? "",
        globalRank:    g?.rank ?? 99999,
        wins:          g?.wins ?? 0,
        losses:        g?.losses ?? 0,
        pd:            g?.pd ?? 0,
        pr:            g?.pr ?? 0,
        totalCoins:    (u.walletBalance ?? 0) + (savingsMap.get(u.discordId) ?? 0),
        playoffWins:   ps?.pw ?? 0,
        playoffLosses: ps?.pl ?? 0,
        superbowlWins: ps?.sw ?? 0,
        superbowlLosses: ps?.sl ?? 0,
      };
    })
    .sort((a, b) => a.globalRank - b.globalRank);

  const medals = ["🥇", "🥈", "🥉"];
  const lines = displayRows.map(r => {
    const gp        = r.wins + r.losses;
    const winPct    = gp > 0 ? ((r.wins / gp) * 100).toFixed(1) : "0.0";
    const rankBadge = medals[r.globalRank - 1] ?? `**#${r.globalRank}**`;
    const label     = r.team ? `${r.username} (${r.team})` : r.username;
    const postseason = [
      r.playoffWins + r.playoffLosses > 0 ? `PO: ${r.playoffWins}W-${r.playoffLosses}L` : "",
      r.superbowlWins + r.superbowlLosses > 0 ? `🏆SB: ${r.superbowlWins}W-${r.superbowlLosses}L` : "",
    ].filter(Boolean).join(" | ");
    return `${rankBadge} ${label} — ${r.wins}W-${r.losses}L | ${fmtDiff(r.pd)} pts | ${winPct}% | PR: ${r.pr.toFixed(1)} | 🪙 ${r.totalCoins.toLocaleString()}${postseason ? ` *(${postseason})*` : ""}`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("🌐 Global Power Rankings")
    .setDescription(lines.join("\n") || "No data")
    .setFooter({ text: `${displayRows.length} members shown • Global rank shown (#) • Coins = wallet + savings` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleWeeklyPayouts(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const [
    h2hWin, h2hLoss, cpuWin,
    hlPay, hlPostPay, hlLimit,
    streamPay,
    tweetPay, tweetLimit,
    interviewPay,
    gotwReg, gotwPo, potwBonus,
  ] = await Promise.all([
    getPayoutValue(PAYOUT_KEYS.H2H_WIN,                gid),
    getPayoutValue(PAYOUT_KEYS.H2H_LOSS,               gid),
    getPayoutValue(PAYOUT_KEYS.CPU_WIN,                gid),
    getPayoutValue(PAYOUT_KEYS.HIGHLIGHT_PAYOUT,       gid),
    getPayoutValue(PAYOUT_KEYS.HIGHLIGHT_PLAYOFF_PAYOUT, gid),
    getPayoutValue(PAYOUT_KEYS.HIGHLIGHT_LIMIT,        gid),
    getPayoutValue(PAYOUT_KEYS.STREAM_PAYOUT,          gid),
    getPayoutValue(PAYOUT_KEYS.TWEET_PAYOUT,           gid),
    getPayoutValue(PAYOUT_KEYS.TWEET_WEEKLY_LIMIT,     gid),
    getPayoutValue(PAYOUT_KEYS.INTERVIEW_PAYOUT,       gid),
    getPayoutValue(PAYOUT_KEYS.GOTW_REGULAR_BONUS,     gid),
    getPayoutValue(PAYOUT_KEYS.GOTW_PLAYOFF_BONUS,     gid),
    getPayoutValue(PAYOUT_KEYS.POTW_BONUS,             gid),
  ]);

  const hlCapNote   = hlLimit > 0 ? ` *(max ${hlLimit}/week)*` : "";
  const tweetCapNote = tweetLimit > 0 ? ` *(max ${tweetLimit}/week)*` : " *(no weekly limit)*";

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("📅 Weekly Payout Schedule")
    .setDescription("Coins earned each week through games, activity, and league engagement.")
    .addFields(
      {
        name: "🏈 Game Results",
        value: [
          `H2H Win: **${h2hWin.toLocaleString()}** coins`,
          `H2H Loss: **${h2hLoss.toLocaleString()}** coins`,
          `CPU / Force Win: **${cpuWin.toLocaleString()}** coins`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "📺 Activity Payouts",
        value: [
          `Highlight (Regular Season): **${hlPay.toLocaleString()}** coins per video${hlCapNote}`,
          `Highlight (Postseason): **${hlPostPay.toLocaleString()}** coins per video${hlCapNote}`,
          `Twitch Stream: **${streamPay.toLocaleString()}** coins per side (streamer + opponent)`,
          `Tweet: **${tweetPay.toLocaleString()}** coins per post${tweetCapNote}`,
          `Interview: **${interviewPay.toLocaleString()}** coins per approved submission`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "🏆 Weekly Bonuses",
        value: [
          `GOTW Correct Guess (Regular Season): **${gotwReg.toLocaleString()}** coins`,
          `GOTW Correct Guess (Playoffs): **${gotwPo.toLocaleString()}** coins`,
          `Player of the Week Winner: **${potwBonus.toLocaleString()}** coins`,
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "Payout amounts set by your commissioner · /admin-payout" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleEosPayouts(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const season = await getOrCreateActiveSeason(gid);

  const [configMap, tierRows] = await Promise.all([
    getAllPayoutConfig(gid),
    db.select().from(seasonStatTierConfigsTable)
      .where(eq(seasonStatTierConfigsTable.seasonId, season.id)),
  ]);
  const allKeys = getAllPayoutKeys();

  // ── Flat payout categories ───────────────────────────────────────────────────
  const cats: Record<string, string[]> = {};
  for (const meta of allKeys) {
    const val = configMap.get(meta.key as any) ?? meta.defaultValue;
    const cat = meta.category ?? "General";
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(`${meta.description}: **${val.toLocaleString()}** coins`);
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("💰 Payout Tiers");

  for (const [cat, items] of Object.entries(cats)) {
    const chunk = items.join("\n");
    if (chunk) embed.addFields({ name: cat, value: chunk.slice(0, 1024), inline: false });
  }

  // ── Stat tier thresholds (passing yards, rushing yards, etc.) ────────────────
  const tiersByCategory = new Map<string, { tier: number; threshold: number; payout: number }[]>();
  for (const row of tierRows) {
    if (!tiersByCategory.has(row.statCategory)) tiersByCategory.set(row.statCategory, []);
    tiersByCategory.get(row.statCategory)!.push({ tier: row.tier, threshold: row.threshold, payout: row.payout });
  }
  for (const [key, defaults] of Object.entries(STAT_TIER_DEFAULTS)) {
    if (!tiersByCategory.has(key)) {
      tiersByCategory.set(key, defaults.map((d, i) => ({ tier: i + 1, threshold: d.threshold, payout: d.payout })));
    }
  }

  const dirSym = (dir: string) => dir === "higher" ? "≥" : "≤";
  const statLines: string[] = [];
  for (const cat of STAT_CATEGORIES) {
    const tiers = tiersByCategory.get(cat.key);
    if (!tiers || !tiers.length) continue;
    const sorted = [...tiers].sort((a, b) => a.tier - b.tier);
    const sym    = dirSym(cat.direction);
    const tierStr = sorted.map(t => `T${t.tier}:${sym}${t.threshold.toLocaleString()} →${t.payout}c`).join(" | ");
    statLines.push(`**${cat.label}:** ${tierStr}`);
  }
  if (statLines.length) {
    embed.addFields({ name: "📊 EOS Stat Tier Bonuses", value: statLines.join("\n").slice(0, 1024), inline: false });
  }

  embed.setTimestamp();
  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleMilestonePayouts(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const tiers = await getMilestoneTiers(gid);

  if (!tiers.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("🎯 Milestone Payouts").setDescription("No milestone tiers configured yet. Ask a commissioner to set them up with `/admin-payout`.")], components: [backToHubRow()] });
    return;
  }

  const lines = tiers.map(t =>
    `**Tier ${t.tier}** — ${t.bonus.toLocaleString()} coins (Threshold: ${t.wins.toLocaleString()} wins)`
  );

  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("🎯 Milestone Payout Tiers")
    .setDescription(lines.join("\n"))
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROW 5 — Requests
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleActiveTeams(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const users = await db.select({ discordId: usersTable.discordId, team: usersTable.team })
    .from(usersTable)
    .where(and(eq(usersTable.guildId, gid), isNotNull(usersTable.team), ne(usersTable.team, "")));

  // Build team → discordId map using economy_users.team which is always the
  // canonical NFL_TEAMS name set by the admin link button
  const activeMap = new Map<string, string>();
  for (const u of users) {
    if (u.discordId.startsWith("unlinked_") || !u.team) continue;
    activeMap.set(u.team, u.discordId);
  }

  if (!activeMap.size) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("🟢 Active Teams").setDescription("No active teams found.")], components: [backToHubRow()] });
    return;
  }

  const CONF_EMOJI: Record<string, string> = { AFC: "🔴", NFC: "🔵" };
  const DIV_ORDER = ["East", "North", "South", "West"] as const;

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`🟢 Active Teams (${activeMap.size})`)
    .setTimestamp();

  for (const conf of ["AFC", "NFC"] as const) {
    for (const div of DIV_ORDER) {
      const divTeams = NFL_TEAMS.filter(t => NFL_DIVISION_MAP[t]?.conference === conf && NFL_DIVISION_MAP[t]?.division === div);
      const activeLines = divTeams
        .filter(t => activeMap.has(t))
        .map(t => `• **${t}** — <@${activeMap.get(t)!}>`);

      if (activeLines.length) {
        embed.addFields({ name: `${CONF_EMOJI[conf]} ${conf} ${div}`, value: activeLines.join("\n"), inline: true });
      }
    }
  }

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleOpenTeams(interaction: ButtonInteraction, sess: ActionsSession) {
  const gid = interaction.guildId!;
  await interaction.deferUpdate();

  const takenRows = await db.select({ team: usersTable.team, discordId: usersTable.discordId })
    .from(usersTable)
    .where(and(eq(usersTable.guildId, gid), isNotNull(usersTable.team)));

  // Taken = teams held by real (non-unlinked) users.
  // usersTable.team is always a canonical NFL_TEAMS name (set by admin on link).
  // MCA nickNames like "Bolts", "Jags", "G-Men", "Niners", "Pack", "Pats" do NOT
  // match NFL_TEAMS, so we rely on usersTable — not MCA — as the source of truth.
  const taken = new Set<string>();
  for (const r of takenRows) {
    if (!r.discordId || r.discordId.startsWith("unlinked_")) continue;
    if (r.team) taken.add(r.team);
  }

  const openTeams = NFL_TEAMS.filter(t => !taken.has(t));

  if (!openTeams.length) {
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(Colors.Grey).setTitle("🔴 Open Teams").setDescription("All 32 teams are currently claimed!")], components: [backToHubRow()] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle(`🔴 Open Teams (${openTeams.length} available)`)
    .setTimestamp();

  const OPEN_CONF_EMOJI: Record<string, string> = { AFC: "🔴", NFC: "🔵" };
  const DIV_ORDER_OPEN = ["East", "North", "South", "West"] as const;
  for (const conf of ["AFC", "NFC"] as const) {
    for (const div of DIV_ORDER_OPEN) {
      const divTeams = openTeams
        .filter(t => NFL_DIVISION_MAP[t]?.conference === conf && NFL_DIVISION_MAP[t]?.division === div)
        .sort();
      if (divTeams.length) {
        embed.addFields({ name: `${OPEN_CONF_EMOJI[conf]} ${conf} ${div}`, value: divTeams.map(t => `• ${t}`).join("\n"), inline: true });
      }
    }
  }

  await interaction.editReply({ embeds: [embed], components: [backToHubRow()] });
}

export async function handleAutoPilotModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_autopilot")
    .setTitle("Request Auto-Pilot Coverage")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("weeks")
          .setLabel("How many weeks do you need coverage?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("e.g. 2")
          .setMaxLength(3),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for Auto-Pilot request")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
          .setPlaceholder("Briefly explain why you need auto-pilot coverage…"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("arrangement")
          .setLabel("Any arrangement details? (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300)
          .setPlaceholder("e.g. Back by Week 8, sim-only, specific plays, etc."),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleAutoPilotSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const weeks       = interaction.fields.getTextInputValue("weeks").trim();
  const reason      = interaction.fields.getTextInputValue("reason").trim();
  const arrangement = interaction.fields.getTextInputValue("arrangement").trim();
  const gid         = interaction.guildId!;

  const weeksNum = parseInt(weeks, 10);
  if (isNaN(weeksNum) || weeksNum < 1) {
    await interaction.reply({ content: "❌ Invalid week count.", ephemeral: true }); return;
  }

  const [season, user] = await Promise.all([
    getOrCreateActiveSeason(gid),
    getOrCreateUser(interaction.user.id, interaction.user.username, gid),
  ]);

  await db.insert(autoPilotRequestsTable).values({
    discordId:      interaction.user.id,
    guildId:        gid,
    teamName:       user.team ?? null,
    weeksRequested: weeksNum,
    reason:         arrangement ? `${reason}\n\nArrangement: ${arrangement}` : reason,
    status:         "pending",
  });

  // Notify commissioner log
  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);

  if (logChannelId) {
    const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      const requestEmbed = new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("✈️ Auto-Pilot Request")
        .setDescription(`**${user.team ?? interaction.user.username}** (<@${interaction.user.id}>) has requested auto-pilot coverage.`)
        .addFields(
          { name: "⏱️ Weeks", value: String(weeksNum), inline: true },
          { name: "📝 Reason", value: reason, inline: false },
        )
        .setTimestamp();
      if (arrangement) requestEmbed.addFields({ name: "📋 Arrangement", value: arrangement, inline: false });

      const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ac_ap_approve:${interaction.user.id}`).setLabel("✅ Approve").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ac_ap_deny:${interaction.user.id}`).setLabel("❌ Deny").setStyle(ButtonStyle.Danger),
      );

      await (channel as TextChannel).send({ embeds: [requestEmbed], components: [btnRow] }).catch(console.error);
    }
  }

  await interaction.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle("⏳ Auto-Pilot Request Submitted")
      .setDescription(`Your auto-pilot request for **${weeksNum} week${weeksNum !== 1 ? "s" : ""}** has been sent to the commissioners.\n\n**Reason:** ${reason}`)],
  });
}

export async function handleApproveAutoPilot(interaction: ButtonInteraction) {
  const targetId = interaction.customId.split(":")[1];
  const gid      = interaction.guildId!;

  await db.update(autoPilotRequestsTable)
    .set({ status: "approved", reviewedBy: interaction.user.id, reviewedAt: new Date() })
    .where(and(
      eq(autoPilotRequestsTable.discordId, targetId!),
      eq(autoPilotRequestsTable.guildId, gid),
      eq(autoPilotRequestsTable.status, "pending"),
    ));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ Auto-Pilot Approved").setDescription(`Auto-pilot request for <@${targetId}> has been **approved** by <@${interaction.user.id}>.`)],
    components: [],
  });

  // DM the user
  const client = interaction.client;
  const dUser  = await client.users.fetch(targetId!).catch(() => null);
  if (dUser) {
    await dUser.send({ content: `✅ Your auto-pilot request has been **approved** by the commissioners. You're covered!` }).catch(() => {});
  }
}

export async function handleDenyAutoPilot(interaction: ButtonInteraction) {
  const targetId = interaction.customId.split(":")[1];
  const gid      = interaction.guildId!;

  await db.update(autoPilotRequestsTable)
    .set({ status: "denied", reviewedBy: interaction.user.id, reviewedAt: new Date() })
    .where(and(
      eq(autoPilotRequestsTable.discordId, targetId!),
      eq(autoPilotRequestsTable.guildId, gid),
      eq(autoPilotRequestsTable.status, "pending"),
    ));

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Auto-Pilot Denied").setDescription(`Auto-pilot request for <@${targetId}> has been **denied** by <@${interaction.user.id}>.`)],
    components: [],
  });

  const client = interaction.client;
  const dUser  = await client.users.fetch(targetId!).catch(() => null);
  if (dUser) {
    await dUser.send({ content: `❌ Your auto-pilot request has been **denied** by the commissioners. Please reach out if you have questions.` }).catch(() => {});
  }
}


