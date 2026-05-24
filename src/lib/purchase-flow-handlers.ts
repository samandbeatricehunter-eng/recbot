/**
 * purchase-flow-handlers.ts
 * ROW 1 purchase flows (age reset, dev up, custom player, legend, training, contract mods).
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


