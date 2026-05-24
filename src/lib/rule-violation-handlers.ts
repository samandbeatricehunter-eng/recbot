/**
 * rule-violation-handlers.ts
 * Rule violation report flow.
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

// ── Rule Violation ─────────────────────────────────────────────────────────────

export async function handleViolationModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_violation")
    .setTitle("Report a Rule Violation")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("week_number")
          .setLabel("Week number this occurred")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(4)
          .setPlaceholder("e.g. 5"),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("violation_type")
          .setLabel("Type of violation")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setPlaceholder("e.g. Stat padding, Rage quit, Missed game, etc."),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("offender")
          .setLabel("Offender — username or team name")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("description")
          .setLabel("Describe what happened")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(900)
          .setPlaceholder("Provide details, evidence links, context, etc."),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("media_urls")
          .setLabel("Media URLs (optional, space or comma separated)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(500)
          .setPlaceholder("https://... (screenshots, clips, etc.)"),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleViolationSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const weekNumber    = interaction.fields.getTextInputValue("week_number").trim();
  const violationType = interaction.fields.getTextInputValue("violation_type").trim();
  const offender      = interaction.fields.getTextInputValue("offender").trim();
  const rawDesc       = interaction.fields.getTextInputValue("description").trim();
  const rawMedia      = interaction.fields.getTextInputValue("media_urls").trim();
  const description   = `[${violationType}] Against: ${offender}\n\n${rawDesc}`;
  const gid           = interaction.guildId!;

  // Parse media URLs (space or comma separated)
  const mediaUrls = rawMedia
    ? rawMedia.split(/[\s,]+/).map(u => u.trim()).filter(u => u.startsWith("http"))
    : [];

  const [season, user] = await Promise.all([
    getOrCreateActiveSeason(gid),
    getOrCreateUser(interaction.user.id, interaction.user.username, gid),
  ]);

  // Insert and retrieve the new violation ID
  const [inserted] = await db.insert(ruleViolationsTable).values({
    reporterId:   interaction.user.id,
    guildId:      gid,
    seasonId:     season.id,
    reporterTeam: user.team ?? null,
    opponentTeam: offender,
    weekNumber,
    description,
    mediaUrls,
    status:       "pending",
  }).returning({ id: ruleViolationsTable.id });

  const violationId = inserted?.id ?? 0;

  // Send to commissioner log
  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.VIOLATION_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);

  if (logChannelId) {
    const channel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      const reportEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("🚨 Rule Violation Report")
        .setDescription(`**Reporter:** ${user.team ?? interaction.user.username} (<@${interaction.user.id}>)`)
        .addFields(
          { name: "⚠️ Violation Type",  value: violationType, inline: true },
          { name: "👤 Offender",         value: offender,      inline: true },
          { name: "📅 Week",             value: weekNumber,    inline: true },
          { name: "📝 Description",      value: rawDesc,       inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `Violation ID: ${violationId}` });

      if (mediaUrls.length > 0) {
        reportEmbed.addFields({ name: "🖼️ Media", value: mediaUrls.join("\n"), inline: false });
        if (mediaUrls[0]) reportEmbed.setImage(mediaUrls[0]);
      }

      const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ac_rv_approve:${violationId}`)
          .setLabel("✅ Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ac_rv_deny:${violationId}`)
          .setLabel("❌ Deny")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ac_rv_note:${interaction.user.id}`)
          .setLabel("📋 Add Note")
          .setStyle(ButtonStyle.Secondary),
      );

      const commMsg = await (channel as TextChannel).send({ embeds: [reportEmbed], components: [btnRow] }).catch(() => null);
      if (commMsg && violationId) {
        await db.update(ruleViolationsTable)
          .set({ commMessageId: commMsg.id })
          .where(eq(ruleViolationsTable.id, violationId));
      }
    }
  }

  await interaction.reply({
    ephemeral: true,
    embeds: [new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle("🚨 Violation Report Submitted")
      .setDescription(`Your report against **${offender}** for **${violationType}** has been sent to the commissioners.\n\nThey will review it and take appropriate action.`)],
  });
}

export async function handleViolationApprove(interaction: ButtonInteraction) {
  const violationId = parseInt(interaction.customId.split(":")[1] ?? "0", 10);
  if (!violationId) { await interaction.reply({ content: "❌ Invalid violation ID.", ephemeral: true }); return; }

  const gid = interaction.guildId!;
  const [violation] = await db.select().from(ruleViolationsTable)
    .where(and(eq(ruleViolationsTable.id, violationId), eq(ruleViolationsTable.guildId, gid)));
  if (!violation) { await interaction.reply({ content: "❌ Violation not found.", ephemeral: true }); return; }

  await db.update(ruleViolationsTable)
    .set({ status: "approved" })
    .where(eq(ruleViolationsTable.id, violationId));

  // Post to VIOLATION_LOG channel
  const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.VIOLATION_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
    ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);

  if (logChannelId) {
    const ch = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (ch?.isTextBased()) {
      const approvedEmbed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Violation Approved")
        .addFields(
          { name: "📝 Description", value: violation.description ?? "N/A", inline: false },
          { name: "👤 Offender",    value: violation.opponentTeam ?? "N/A", inline: true },
          { name: "📅 Week",        value: violation.weekNumber ?? "N/A",   inline: true },
          { name: "🔍 Reviewed by", value: `<@${interaction.user.id}>`,     inline: true },
        )
        .setTimestamp()
        .setFooter({ text: `Violation ID: ${violationId}` });

      if (violation.mediaUrls?.length) {
        approvedEmbed.addFields({ name: "🖼️ Media", value: violation.mediaUrls.join("\n"), inline: false });
        if (violation.mediaUrls[0]) approvedEmbed.setImage(violation.mediaUrls[0]);
      }
      await (ch as TextChannel).send({ embeds: [approvedEmbed] }).catch(console.error);
    }
  }

  // DM reporter
  if (violation.reporterId) {
    const reporter = await interaction.client.users.fetch(violation.reporterId).catch(() => null);
    if (reporter) {
      await reporter.send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Violation Report Approved")
          .setDescription(`Your violation report (ID: ${violationId}) has been **approved** by the commissioners.\n\nThank you for keeping the league fair.`)
          .setTimestamp()],
      }).catch(console.error);
    }
  }

  // Update the original commissioner message to show resolved state
  await interaction.update({
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ac_rv_noop")
          .setLabel("✅ Approved")
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
      ) as ActionRowBuilder<any>,
    ],
  });
}

export async function handleViolationDeny(interaction: ButtonInteraction) {
  const violationId = interaction.customId.split(":")[1] ?? "0";
  const modal = new ModalBuilder()
    .setCustomId(`ac_rv_deny_submit:${violationId}`)
    .setTitle("Deny Violation Report")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason for denial")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(800)
          .setPlaceholder("Explain why the report is being denied…"),
      ),
    );
  await interaction.showModal(modal);
}

export async function handleViolationDenySubmit(interaction: ModalSubmitInteraction) {
  const violationId = parseInt(interaction.customId.split(":")[1] ?? "0", 10);
  const reason      = interaction.fields.getTextInputValue("reason").trim();
  const gid         = interaction.guildId!;

  if (!violationId) { await interaction.reply({ content: "❌ Invalid violation ID.", ephemeral: true }); return; }

  const [violation] = await db.select().from(ruleViolationsTable)
    .where(and(eq(ruleViolationsTable.id, violationId), eq(ruleViolationsTable.guildId, gid)));
  if (!violation) { await interaction.reply({ content: "❌ Violation not found.", ephemeral: true }); return; }

  await db.update(ruleViolationsTable)
    .set({ status: "denied" })
    .where(eq(ruleViolationsTable.id, violationId));

  // DM reporter with deny reason
  if (violation.reporterId) {
    const reporter = await interaction.client.users.fetch(violation.reporterId).catch(() => null);
    if (reporter) {
      await reporter.send({
        embeds: [new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("❌ Violation Report Denied")
          .setDescription(`Your violation report (ID: ${violationId}) has been **denied** by the commissioners.`)
          .addFields({ name: "📋 Reason", value: reason, inline: false })
          .setTimestamp()],
      }).catch(console.error);
    }
  }

  // Try to update the original commissioner message buttons
  try {
    const logChannelId = await getGuildChannel(gid, CHANNEL_KEYS.VIOLATION_LOG)
      ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER_LOG)
      ?? await getGuildChannel(gid, CHANNEL_KEYS.COMMISSIONER);
    if (logChannelId && violation.commMessageId) {
      const ch = await interaction.client.channels.fetch(logChannelId).catch(() => null);
      if (ch?.isTextBased()) {
        const msg = await (ch as TextChannel).messages.fetch(violation.commMessageId).catch(() => null);
        if (msg) {
          await msg.edit({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId("ac_rv_noop")
                  .setLabel("❌ Denied")
                  .setStyle(ButtonStyle.Danger)
                  .setDisabled(true),
              ) as ActionRowBuilder<any>,
            ],
          }).catch(console.error);
        }
      }
    }
  } catch { /* swallow */ }

  await interaction.reply({
    ephemeral: true,
    content: `✅ Violation #${violationId} has been denied and the reporter has been notified.`,
  });
}

export async function handleViolationNote(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`ac_rv_note_submit:${interaction.customId.split(":")[1]}`)
    .setTitle("Commissioner Note")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("note")
          .setLabel("Commissioner note / ruling")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );
  await interaction.showModal(modal);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROW 5 — Rules (read-only view with optional public display)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handleRulesStart(interaction: ButtonInteraction, sess: ActionsSession) {
  const guildId  = interaction.guildId!;
  const sections = await getAllSections(guildId);
  const entries  = Object.entries(sections);

  if (entries.length === 0) {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Orange).setTitle("📜 Rules").setDescription("No rule sections have been set up yet.")],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ac_rules_close").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
        ) as ActionRowBuilder<any>,
      ],
    });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("ac_rules_section")
    .setPlaceholder("Select a rules section...")
    .addOptions(
      entries.slice(0, 25).map(([key, meta]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(meta.title.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim() || key)
          .setValue(key),
      ),
    );

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_rules_close").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📜 League Rules")
        .setDescription("Select a section to view the rules."),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<any>,
      closeRow,
    ],
  });
}

export function buildRulesSectionEmbed(
  section: string,
  meta: { title: string; color: number },
  rules: string[],
  page: number,
): EmbedBuilder {
  const pages    = buildRulesPages(rules);
  const maxPage  = Math.max(0, pages.length - 1);
  const safePage = Math.min(Math.max(0, page), maxPage);
  const content  = pages[safePage] ?? "_No rules in this section yet._";
  const footer   = pages.length > 1
    ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} · Page ${safePage + 1}/${pages.length}`
    : `${rules.length} rule${rules.length !== 1 ? "s" : ""}`;
  return new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(meta.title)
    .setDescription(content)
    .setFooter({ text: footer });
}

export function buildRulesSectionButtons(rules: string[], page: number, totalPages: number): ActionRowBuilder<ButtonBuilder>[] {
  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_rules_display").setLabel("📢 Display Publicly").setStyle(ButtonStyle.Primary).setDisabled(rules.length === 0),
    new ButtonBuilder().setCustomId("ac_rules_goback").setLabel("← Sections").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_rules_close").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
  );
  if (totalPages <= 1) return [navRow];
  const pageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ac_rules_page:${page - 1}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`ac_rules_page:${page + 1}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );
  return [navRow, pageRow];
}

export async function handleRulesSection(interaction: StringSelectMenuInteraction, sess: ActionsSession) {
  const guildId = interaction.guildId!;
  const section = interaction.values[0]!;
  sess.acRulesSection = section;
  sess.acRulesPage    = 0;

  const sections = await getAllSections(guildId);
  const meta     = sections[section];
  if (!meta) {
    await interaction.update({ content: "❌ Section not found.", components: [] });
    return;
  }

  const rules      = await getOrSeedRules(section, guildId);
  const totalPages = buildRulesPages(rules).length;
  const embed      = buildRulesSectionEmbed(section, meta, rules, 0);

  await interaction.update({ embeds: [embed], components: buildRulesSectionButtons(rules, 0, totalPages) });
}

export async function handleRulesPage(interaction: ButtonInteraction, sess: ActionsSession) {
  const guildId  = interaction.guildId!;
  const page     = parseInt(interaction.customId.split(":")[1] ?? "0", 10);
  const section  = sess.acRulesSection;

  if (!section) {
    await interaction.reply({ content: "❌ Session expired — open /menu again.", ephemeral: true });
    return;
  }

  const sections = await getAllSections(guildId);
  const meta     = sections[section];
  if (!meta) {
    await interaction.update({ content: "❌ Section not found.", components: [] });
    return;
  }

  const rules      = await getOrSeedRules(section, guildId);
  const totalPages = buildRulesPages(rules).length;
  const safePage   = Math.min(Math.max(0, page), Math.max(0, totalPages - 1));
  sess.acRulesPage = safePage;
  const embed      = buildRulesSectionEmbed(section, meta, rules, safePage);

  await interaction.update({ embeds: [embed], components: buildRulesSectionButtons(rules, safePage, totalPages) });
}

export async function handleRulesDisplayChoice(interaction: ButtonInteraction, sess: ActionsSession) {
  if (!sess.acRulesSection) {
    await interaction.reply({ content: "❌ Session expired — open /menu again.", ephemeral: true });
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_rules_display_full").setLabel("📋 Full Section").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("ac_rules_display_bynum").setLabel("🔢 By Rule #").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_rules_goback").setLabel("← Back").setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📢 Display Rules")
        .setDescription("Choose how to display the rules publicly in this channel:"),
    ],
    components: [row],
  });
}

export async function handleRulesDisplayFull(interaction: ButtonInteraction, sess: ActionsSession) {
  const guildId = interaction.guildId!;
  if (!sess.acRulesSection) {
    await interaction.reply({ content: "❌ Session expired — open /menu again.", ephemeral: true });
    return;
  }

  const sections = await getAllSections(guildId);
  const meta     = sections[sess.acRulesSection]!;
  const rules    = await getOrSeedRules(sess.acRulesSection, guildId);
  const lines    = rules.length > 0
    ? rules.map((r, i) => `**${i + 1}.** ${r}`)
    : ["_No rules in this section yet._"];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(meta.title)
    .setDescription(lines.join("\n\n"))
    .setTimestamp();

  await (interaction.channel as TextChannel | null)?.send({ embeds: [embed] }).catch(console.error);

  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setDescription("✅ Rules posted to the channel.")],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ac_rules_goback").setLabel("← Sections").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ac_rules_close").setLabel("✖ Close").setStyle(ButtonStyle.Secondary),
      ) as ActionRowBuilder<any>,
    ],
  });
}

export async function handleRulesDisplayByNumModal(interaction: ButtonInteraction, _sess: ActionsSession) {
  const modal = new ModalBuilder()
    .setCustomId("ac_modal_rules_bynum")
    .setTitle("Display Rule by Number");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_num")
        .setLabel("Rule Number")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 3")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleRulesByNumSubmit(interaction: ModalSubmitInteraction, sess: ActionsSession) {
  const guildId = interaction.guildId!;
  if (!sess.acRulesSection) {
    await interaction.reply({ content: "❌ Session expired — open /menu again.", ephemeral: true });
    return;
  }

  const ruleNum = parseInt(interaction.fields.getTextInputValue("rule_num"), 10);
  if (isNaN(ruleNum) || ruleNum < 1) {
    await interaction.reply({ content: "❌ Invalid rule number.", ephemeral: true });
    return;
  }

  const sections = await getAllSections(guildId);
  const meta     = sections[sess.acRulesSection]!;
  const rules    = await getOrSeedRules(sess.acRulesSection, guildId);

  if (ruleNum > rules.length) {
    await interaction.reply({ content: `❌ Rule #${ruleNum} does not exist. This section has ${rules.length} rule(s).`, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.title} — Rule #${ruleNum}`)
    .setDescription(rules[ruleNum - 1]!)
    .setTimestamp();

  await (interaction.channel as TextChannel | null)?.send({ embeds: [embed] }).catch(console.error);

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(Colors.Green).setDescription(`✅ Rule #${ruleNum} posted to the channel.`)],
    ephemeral: true,
  });
}

export async function handleRulesClose(interaction: ButtonInteraction) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.DarkGrey).setDescription("📜 Rules closed.")],
    components: [],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UNLINKED USER — Request handlers
// ═══════════════════════════════════════════════════════════════════════════════


