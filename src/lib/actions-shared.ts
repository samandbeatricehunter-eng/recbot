/**
 * actions-shared.ts
 * Shared types, session store, and UI helpers for all actions-hub split files.
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


// ── Types ──────────────────────────────────────────────────────────────────────

type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

interface ActionsSession {
  guildId: string;
  userId: string;
  flow?: string;
  // wager flow
  scheduleGameId?: string;
  wagerTeam?: string;
  wagerOpponentId?: string;
  wagerOpponentTeam?: string;
  wagerAmount?: number;
  wagerChallengerId?: string;
  wagerChallengerTeam?: string;
  wagerSpread?: number;
  wagerSide?: "home" | "away";
  wagerHomeTeam?: string;
  wagerAwayTeam?: string;
  wagerHomeDiscordId?: string;
  wagerAwayDiscordId?: string;
  // roster flow (legacy — purchase flow still uses these)
  selectedTeamId?: number;
  selectedTeamName?: string;
  // roster card / player-card flow
  rosterViewTeamId?: number;
  rosterViewTeamName?: string;
  rosterViewSource?: "my" | "any";
  rosterViewSeasonId?: number;
  rosterViewPosition?: string;
  rosterCardPlayerId?: number;
  rosterCardPage?: number;
  // purchase flow
  purchaseType?: string;
  rosterPosition?: string;
  selectedPlayerId?: number;
  selectedPlayerName?: string;
  selectedPlayerPos?: string;
  selectedPlayerDev?: number;
  selectedPlayerAge?: number;
  selectedLegendId?: number;
  selectedLegendName?: string;
  selectedLegendCost?: number;
  // training package flow
  trainingTier?: string;
  trainingGoal?: "speed" | "power" | "balanced" | "position";
  trainingPlayerId?: number;
  trainingPlayerName?: string;
  trainingPlayerPos?: string;
  trainingPlayerOvr?: number;
  // standings flow
  standingsConf?: "AFC" | "NFC" | "ALL";
  // rules view flow
  acRulesSection?: string;
  acRulesPage?: number;
  // team request / waitlist flow
  pendingTeamRequest?: string;
  // free agent player-card flow
  faPos?: string;
  faCardPlayerId?: number;
  faCardPage?: number;
  faSeasonId?: number;
  faDevFilters?: number[];   // multi-select: 0=normal,1=star,2=ss,3=xf (empty=all)
  faSortStack?: string[];    // ordered sort keys, priority = index 0 first (max 5)
  faSortPage?: number;       // current sort-button page (0=special, 1-5=attrs)
  faNameFilter?: string;
  // all-players browse/filter flow
  apPos?: string;
  apCardPlayerId?: number;
  apCardPage?: number;
  apSeasonId?: number;
  apNameFilter?: string;
  apDevFilters?: number[];   // multi-select: 0=normal,1=star,2=ss,3=xf (empty=all)
  apSortStack?: string[];    // ordered sort keys, priority = index 0 first (max 5)
  apSortPage?: number;       // current sort-button page (0=special, 1-5=attrs)
  expiresAt: number;
}

// ── Session store ──────────────────────────────────────────────────────────────

const sessions = new Map<string, ActionsSession>();
const SESSION_TTL_MS = 15 * 60 * 1000;

function sessionKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

function getSession(guildId: string, userId: string): ActionsSession {
  const key = sessionKey(guildId, userId);
  const existing = sessions.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing;
  const fresh: ActionsSession = { guildId, userId, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(key, fresh);
  return fresh;
}

function touchSession(sess: ActionsSession) {
  sess.expiresAt = Date.now() + SESSION_TTL_MS;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function backToHubRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
  );
}

function cancelRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Cancel").setStyle(ButtonStyle.Secondary),
  );
}

// Position groups for roster display (mirrors my-roster.ts)
const OFFENSE_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Quarterback",    positions: ["QB"] },
  { label: "Running Back",   positions: ["HB", "FB"] },
  { label: "Wide Receiver",  positions: ["WR"] },
  { label: "Tight End",      positions: ["TE"] },
  { label: "Offensive Line", positions: ["LT", "LG", "C", "RG", "RT"] },
];
const DEFENSE_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Defensive Line",  positions: ["LE", "RE", "DT", "DE", "LEDGE", "REDGE"] },
  { label: "MIKE Linebacker", positions: ["MLB", "MIKE"] },
  { label: "SAM Linebacker",  positions: ["LOLB", "SAM"] },
  { label: "WILL Linebacker", positions: ["ROLB", "WILL"] },
  { label: "Cornerback",      positions: ["CB"] },
  { label: "Safety",          positions: ["FS", "SS", "S"] },
];
const SPECIAL_TEAMS_POSITIONS = ["K", "P", "KR", "PR", "LS"];
const OFFENSE_SET = new Set(OFFENSE_GROUPS.flatMap(g => g.positions));
const DEFENSE_SET = new Set(DEFENSE_GROUPS.flatMap(g => g.positions));

// ── Roster card / player-card constants ────────────────────────────────────────

const ROSTER_CARD_POSITIONS = [
  "QB","HB","FB","WR","TE","LT","LG","C","RG","RT",
  "LEDGE","REDGE","DT","WILL","MIKE","SAM","CB","FS","SS","K","P","LS",
];

// Canonical sort order for all position dropdowns
const CANONICAL_POS_ORDER = ["QB","HB","FB","WR","TE","LT","LG","C","RG","RT","LEDGE","REDGE","DT","WILL","MIKE","SAM","CB","FS","SS","K","P","LS"];
const CANONICAL_POS_IDX   = new Map(CANONICAL_POS_ORDER.map((p, i) => [p, i]));
function sortByCanonical(positions: string[]): string[] {
  return [...positions].sort((a, b) => {
    const ai = CANONICAL_POS_IDX.get(a) ?? 999;
    const bi = CANONICAL_POS_IDX.get(b) ?? 999;
    return ai !== bi ? ai - bi : a.localeCompare(b);
  });
}

// ── Keys that are displayed elsewhere (page 1/bio) and should NOT appear on the attributes page ──
const ATTR_PAGE_SKIP = new Set([
  "height", "heightInches", "weight",
  "throwAcc", "throwAccuracy", "throwAccRating", "throwAccuracyRating",
  "handedness", "throwingHand", "playerHandedness",
  "college", "collegeName", "playerCollege",
  "conf", "confidence", "confRating", "confidenceRating", // shown on page 1 bio section
  // contract / financial — shown separately if non-zero, not in raw attr dump
  "desiredBonus", "contractBonus", "signingBonus", "contractSalary", "capHit",
]);

// ── Player trait system ────────────────────────────────────────────────────────
// Boolean traits: value 1 = Yes, value 0 = No (skip the 0s).
// Scale traits: map each numeric value to a label.
const BOOL_TRAIT_LABELS: Record<string, string> = {
  clutchTrait:        "Clutch",
  highMotorTrait:     "High Motor",
  dropOpenPassTrait:  "Drops Open Passes",
  yacTrait:           "YAC Em Up",
  sensePressTrait:    "Sense Pressure",
  bigGameTrait:       "Big Game",
  playBallTrait:      "Play Ball",
  tightSpiralTrait:   "Tight Spiral",
  coverBallTrait:     "Covers Ball",
  fightForYardsTrait: "Fight for Yards",
  heavyBallTrait:     "Heavy Ball",
  posFeetTrait:       "Positive Feet",
  catcherTrait:       "Possession Receiver",
  stripBallTrait:     "Strip Ball",
  fakeOutTrait:       "Fake Out",
  hunchbackTrait:     "Hunchback",
  dlBullRushTrait:    "DL Bull Rush",
  dlSpinTrait:        "DL Spin Move",
  dlSwimTrait:        "DL Swim Move",
};

const SCALE_TRAIT_LABELS: Record<string, string[]> = {
  penaltyTrait:   ["Disciplined", "Normal", "Penalty"],
  forcePassTrait: ["Paranoid",    "Ideal",  "Aggressive"],
  lBStyleTrait:   ["Balanced",    "Run Stop","Pass Rush"],
  qBStyleTrait:   ["Pocket",      "Scrambler","Balanced"],
};

function renderTraitSection(attrs: Record<string, number | string>): string | null {
  const active: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    const num = Number(v);
    if (isNaN(num)) continue;

    if (BOOL_TRAIT_LABELS[k]) {
      if (num === 1) active.push(`✅ ${BOOL_TRAIT_LABELS[k]}`);
    } else if (SCALE_TRAIT_LABELS[k]) {
      const label = SCALE_TRAIT_LABELS[k]![num];
      if (label) active.push(`${SCALE_TRAIT_LABELS[k]!.join("/")} → **${label}**`);
    } else if (k.endsWith("Trait") || k.endsWith("trait")) {
      // Unknown trait — show label + value only when non-zero
      if (num !== 0) active.push(`${k.replace(/Trait$/, "").replace(/([A-Z])/g, " $1").trim()} **${num}**`);
    }
  }
  return active.length > 0 ? active.join("\n") : null;
}

const ATTR_ABBR: Record<string, string> = {
  // ── Full Rating-suffixed keys ────────────────────────────────────────────────
  speedRating: "SPD", accelerationRating: "ACC", agilityRating: "AGI",
  strengthRating: "STR", jumpingRating: "JMP", awareRating: "AWR",
  staminaRating: "STA", injuryRating: "INJ", toughnessRating: "TGH",
  throwPowerRating: "THP", throwAccuracyShortRating: "SAC", throwAccuracyMidRating: "MAC",
  throwAccuracyDeepRating: "DAC", throwOnRunRating: "TOR", throwUnderPressureRating: "TUP",
  breakSackRating: "BSK", playActionRating: "PAC",
  caryingRating: "CAR", carryingRating: "CAR", bCVisionRating: "BCV", ballCarrierVisionRating: "BCV",
  elusivenessRating: "ELU", breakTackleRating: "BTK", stiffArmRating: "SFA",
  spinMoveRating: "SPM", jukeMoveRating: "JKM", truckingRating: "TRK", changeOfDirectionRating: "COD",
  catchRating: "CTH", catchInTrafficRating: "CIT", spectacularCatchRating: "SPC",
  shortRouteRunRating: "SRR", medRouteRunRating: "MRR", deepRouteRunRating: "DRR", releaseRating: "RLS",
  passBlockRating: "PBK", runBlockRating: "RBK", impactBlockRating: "IBL",
  passBlockPowerRating: "PBP", passBlockFinesseRating: "PBF",
  runBlockPowerRating: "RBP", runBlockFinesseRating: "RBF", leadBlockRating: "LBK",
  powerMovesRating: "PMV", finessMovesRating: "FMV", blockShedRating: "BSH",
  pursuitRating: "PUR", tackleRating: "TAK", hitPowerRating: "HPW",
  manCoverRating: "MCV", zoneCoverRating: "ZCV", pressRating: "PRS", playRecRating: "PRC",
  kickPowerRating: "KPW", kickAccuracyRating: "KAC",
  puntPowerRating: "PNP", puntAccuracyRating: "PNA", kickReturnRating: "KR",
  // ── Abbreviated aliases (short form, no "Rating" suffix) ────────────────────
  accel: "ACC", jump: "JMP", tough: "TGH",
  bCV: "BCV", carry: "CAR",
  cIT: "CIT", routeRunDeep: "DRR", routeRunMed: "MRR", routeRunShort: "SRR", specCatch: "SPC",
  finesseMoves: "FMV",
  kickAcc: "KAC", kickRet: "KR", longSnap: "LSN",
  throwAccDeep: "DAC", throwAccMid: "MAC", throwAccShort: "SAC",
  truck: "TRK",
  conf: "CNF", confidence: "CNF",
  // ── Short-Rating hybrid variants (EA exports "accelRating" vs "accelerationRating") ──
  accelRating: "ACC", jumpRating: "JMP", toughRating: "TGH",
  bCVRating: "BCV", carryRating: "CAR",
  cITRating: "CIT", routeRunDeepRating: "DRR", routeRunMedRating: "MRR",
  routeRunShortRating: "SRR", specCatchRating: "SPC",
  finesseMovesRating: "FMV",  // also fixes the "finessMovesRating" typo variant already above
  kickAccRating: "KAC", kickRetRating: "KR", longSnapRating: "LSN",
  throwAccDeepRating: "DAC", throwAccMidRating: "MAC", throwAccShortRating: "SAC",
  truckRating: "TRK",
};

/**
 * Groups are defined by ABBREVIATION (not raw DB key).
 * We first convert every raw DB key → abbreviation using ATTR_ABBR,
 * then bucket by group using these abbr lists. This makes the display
 * robust regardless of whether the DB stores "speedRating" or "speed".
 */
const ATTR_GROUPS: { label: string; abbrs: string[] }[] = [
  { label: "⚡ Physical / Athletic", abbrs: ["SPD","ACC","AGI","STR","JMP","AWR","COD","STA","INJ","TGH"] },
  { label: "🏈 Throwing",            abbrs: ["THP","SAC","MAC","DAC","TOR","TUP","BSK","PAC"] },
  { label: "🏃 Ball Carrying",       abbrs: ["CAR","BCV","ELU","BTK","TRK","SFA","SPM","JKM","KR"] },
  { label: "🙌 Receiving",           abbrs: ["CTH","CIT","SPC","SRR","MRR","DRR","RLS"] },
  { label: "🛡️ Blocking",            abbrs: ["PBK","RBK","IBL","PBP","PBF","RBP","RBF","LBK"] },
  { label: "🔴 Pass Rush",           abbrs: ["PMV","FMV","BSH"] },
  { label: "💪 Run Defense",         abbrs: ["PUR","TAK","HPW"] },
  { label: "🔒 Coverage",            abbrs: ["MCV","ZCV","PRS","PRC"] },
  { label: "🦵 Kicking / Punting",   abbrs: ["KPW","KAC","PNP","PNA","LSN"] },
];

interface StatDef { key: string; label: string; isFloat?: boolean }
const STAT_SECTIONS: { title: string; stats: StatDef[] }[] = [
  { title: "🏈 Passing",   stats: [
    { key: "passYds", label: "Pass Yards" }, { key: "passTDs", label: "TDs" },
    { key: "passInts", label: "INTs" }, { key: "passComp", label: "Comp" },
    { key: "passAtt", label: "Att" }, { key: "timesSacked", label: "Sacked" },
  ]},
  { title: "🏃 Rushing",   stats: [
    { key: "rushYds", label: "Rush Yards" }, { key: "rushTDs", label: "TDs" },
    { key: "rushAtt", label: "Att" }, { key: "fumbles", label: "Fumbles" },
  ]},
  { title: "🙌 Receiving", stats: [
    { key: "recRec", label: "Receptions" }, { key: "recYds", label: "Rec Yards" }, { key: "recTDs", label: "TDs" },
  ]},
  { title: "🛡️ Defense",   stats: [
    { key: "totalTackles", label: "Tackles" }, { key: "tackleSolo", label: "Solo" },
    { key: "tackleAssist", label: "Assist" }, { key: "sacks", label: "Sacks", isFloat: true },
    { key: "defInts", label: "INTs" }, { key: "forcedFumbles", label: "FF" },
    { key: "defFumblesRec", label: "Fum Rec" }, { key: "tacklesForLoss", label: "TFLs", isFloat: true },
    { key: "defTDs", label: "Def TDs" },
  ]},
  { title: "🦵 Kicking",   stats: [
    { key: "fgMade", label: "FG Made" }, { key: "fgAtt", label: "FG Att" },
    { key: "fgLong", label: "FG Long" }, { key: "xpMade", label: "XP Made" }, { key: "xpAtt", label: "XP Att" },
  ]},
  { title: "💨 Punting",   stats: [
    { key: "puntAtt", label: "Punts" }, { key: "puntYds", label: "Yds" },
    { key: "puntLong", label: "Long" }, { key: "puntIn20", label: "In-20" }, { key: "puntTouchbacks", label: "TBs" },
  ]},
  { title: "↩️ Returns",   stats: [
    { key: "krYds", label: "KR Yds" }, { key: "krTDs", label: "KR TDs" }, { key: "krAtt", label: "KR Att" },
    { key: "prYds", label: "PR Yds" }, { key: "prTDs", label: "PR TDs" }, { key: "prAtt", label: "PR Att" },
  ]},
];

// ── Roster card — shared UI helpers ───────────────────────────────────────────

function buildRosterNavRows(source: "my" | "any"): ActionRowBuilder<ButtonBuilder>[] {
  const backId = source === "my" ? "ac_hub" : "ac_anyroster";
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ac_rc_cards").setLabel("🃏 View Player Cards").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ac_rc_teamstats").setLabel("📊 View Team Stats").setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(backId).setLabel("← Back").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
    ),
  ];
}

function buildCardPageRow(page: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ac_rc_cardpage:${page - 1}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId("ac_rc_cardpage_num").setLabel(`Page ${page} / ${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`ac_rc_cardpage:${page + 1}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= total),
  );
}
function buildCardBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_rc_back_to_players").setLabel("← Back to Players").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ac_close").setLabel("✖ Close Menu").setStyle(ButtonStyle.Danger),
  );
}

// ── Roster card — page builder ─────────────────────────────────────────────────

type RosterRow  = typeof franchiseRostersTable.$inferSelect;
type StatsRow   = typeof playerSeasonStatsTable.$inferSelect;

function buildPlayerCardPages(roster: RosterRow, stats: StatsRow | undefined, seasonNum: number): EmbedBuilder[] {
  const fullName  = `${roster.firstName} ${roster.lastName}`;
  const jersey    = roster.jerseyNum != null ? `#${roster.jerseyNum}` : "";
  const title     = `${fullName} — ${jersey} ${roster.position}`;
  const teamLine  = `**Team:** ${roster.teamName}`;
  const devLabel  = DEV_TRAIT_LABELS[roster.devTrait] ?? `Dev ${roster.devTrait}`;
  const devBadgeVal = devBadge(roster.devTrait ?? 0);
  const attrs     = (roster.attributes ?? {}) as Record<string, number | string>;
  const abilities = roster.abilities as { zone?: string; superstar?: string[] } | null;
  const TOTAL     = 3;
  const portrait  = roster.portraitUrl ?? eaPortraitUrl(roster.playerId);

  // ── Bio helpers ────────────────────────────────────────────────────────────
  const contractStr = roster.contractYearsLeft == null ? "Unknown"
    : roster.contractYearsLeft <= 0 ? "Free Agent"
    : roster.contractYearsLeft === 1 ? "Contract Year"
    : `${roster.contractYearsLeft} yrs remaining`;

  const rawH = attrs["height"] ?? attrs["heightInches"];
  const heightIn = rawH != null ? Number(rawH) : NaN;
  const heightStr = !isNaN(heightIn) && heightIn > 0 ? `${Math.floor(heightIn / 12)}'${heightIn % 12}"` : null;
  const rawW = attrs["weight"];
  const weightStr = rawW != null && Number(rawW) > 0 ? `${Number(rawW)} lbs` : null;
  const physLine = heightStr && weightStr ? `${heightStr} / ${weightStr}` : heightStr ?? weightStr ?? null;

  const rawCollege = attrs["college"] ?? attrs["collegeName"] ?? attrs["playerCollege"];
  const collegeStr = rawCollege != null && String(rawCollege).trim() !== "" ? String(rawCollege) : null;

  // ── Season stats helpers ───────────────────────────────────────────────────
  const statLines: { title: string; line: string }[] = [];
  if (stats) {
    for (const section of STAT_SECTIONS) {
      const parts = section.stats
        .filter(s => { const v = (stats as any)[s.key]; return v != null && v !== 0; })
        .map(s => {
          const v = (stats as any)[s.key] as number;
          return `**${s.label}:** ${s.isFloat ? v.toFixed(1) : v.toLocaleString()}`;
        });
      // Inject completion % directly into passing section
      if (section.title.includes("Pass") && stats.passAtt > 0) {
        const pct = ((stats.passComp / stats.passAtt) * 100).toFixed(1);
        parts.push(`**Pct:** ${pct}%`);
      }
      if (parts.length) statLines.push({ title: section.title, line: parts.join("  ·  ") });
    }
  }

  // ── Page 1: Bio + Season Stats ─────────────────────────────────────────────
  const p1 = new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(title)
    .setDescription(teamLine)
    .addFields(
      { name: "Overall",    value: String(roster.overall),                        inline: true },
      { name: "Age",        value: roster.age != null ? String(roster.age) : "—", inline: true },
      { name: "Jersey",     value: jersey || "—",                                  inline: true },
      { name: "Dev Trait",  value: devBadgeVal ? `${devBadgeVal} ${devLabel}` : devLabel, inline: true },
      { name: "Contract",   value: contractStr,                                    inline: true },
    );
  if (physLine)   p1.addFields({ name: "Height / Weight", value: physLine,   inline: true });
  if (collegeStr) p1.addFields({ name: "College",         value: collegeStr, inline: true });
  const rawConf = attrs["conf"] ?? attrs["confidence"];
  const confVal = rawConf != null ? Number(rawConf) : NaN;
  if (!isNaN(confVal) && confVal > 0) p1.addFields({ name: "🧠 Confidence", value: String(confVal), inline: true });
  const rawBonus = attrs["desiredBonus"] ?? attrs["contractBonus"] ?? attrs["signingBonus"];
  const bonusVal = rawBonus != null ? Number(rawBonus) : NaN;
  if (!isNaN(bonusVal) && bonusVal > 0) p1.addFields({ name: "💰 Desired Bonus", value: `$${bonusVal.toLocaleString()}`, inline: true });

  // Stats section on page 1
  if (statLines.length) {
    for (const { title: stTitle, line } of statLines) {
      p1.addFields({ name: stTitle, value: line, inline: false });
    }
  } else {
    p1.addFields({ name: "Season Stats", value: "*No stats recorded yet this season.*", inline: false });
  }
  p1.setFooter({ text: `Page 1/${TOTAL} · Season ${seasonNum} · ${roster.position} · ID ${roster.playerId}` });

  // ── Page 2: Abilities ─────────────────────────────────────────────────────
  const p2 = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(title)
    .setDescription(teamLine);

  const hasAbils = abilities && (abilities.zone || abilities.superstar?.length);
  if (hasAbils) {
    if (abilities.zone) {
      p2.addFields({ name: `${DEV_EMOJI.xfactor} X-Factor Zone Ability`, value: abilities.zone, inline: false });
    }
    if (abilities.superstar?.length) {
      const lines = abilities.superstar.map(a => `${DEV_EMOJI.superstar} ${a}`);
      p2.addFields({ name: "Superstar Abilities", value: lines.join("\n"), inline: false });
    }
  } else {
    p2.addFields({ name: "💥 Abilities", value: "*No active abilities.*", inline: false });
  }
  const traitText = renderTraitSection(attrs);
  p2.addFields({ name: "🧠 Traits", value: traitText ?? "*No active traits.*", inline: false });
  p2.setFooter({ text: `Page 2/${TOTAL} · Season ${seasonNum} · ${roster.position} · ID ${roster.playerId}` });

  // ── Page 3: In-Game Attributes ────────────────────────────────────────────
  const p3 = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(title)
    .setDescription(teamLine);

  // ── Step 1: Build abbr→value map from raw attributes ─────────────────────
  // Convert every raw DB key to its abbreviation first, dedup by abbr.
  // This works regardless of whether the DB stores "speedRating", "speed", etc.
  // Skip trait fields — they are rendered on Page 2 instead.
  const isTraitKey = (k: string) => k.endsWith("Trait") || k.endsWith("trait");
  const abbrValMap = new Map<string, number>();
  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (ATTR_PAGE_SKIP.has(rawKey)) continue;
    if (isTraitKey(rawKey)) continue;
    if (typeof rawVal !== "number") continue;
    const abbr = ATTR_ABBR[rawKey];
    if (abbr && !abbrValMap.has(abbr)) {
      abbrValMap.set(abbr, rawVal);
    }
  }

  // ── Step 2: Render by group using the abbr map ────────────────────────────
  let hasAnyAttr = false;
  const renderedAbbrs = new Set<string>();

  for (const group of ATTR_GROUPS) {
    const pairs: string[] = [];
    for (const abbr of group.abbrs) {
      const val = abbrValMap.get(abbr);
      if (val == null) continue;
      renderedAbbrs.add(abbr);
      pairs.push(`${abbr} **${val}**`);
    }
    if (pairs.length) {
      hasAnyAttr = true;
      p3.addFields({ name: group.label, value: pairs.join("  "), inline: false });
    }
  }

  // ── Step 3: Anything with an abbr not in any group goes to "Other" ────────
  const otherPairs: string[] = [];
  for (const [abbr, val] of abbrValMap) {
    if (!renderedAbbrs.has(abbr)) otherPairs.push(`${abbr} **${val}**`);
  }
  // Also show raw keys that had NO abbreviation entry (truly unknown attrs)
  // Skip trait keys (shown on Page 2) and zero-value entries (meaningless for unknown fields)
  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (ATTR_PAGE_SKIP.has(rawKey)) continue;
    if (isTraitKey(rawKey)) continue;
    if (typeof rawVal !== "number") continue;
    if (rawVal === 0) continue;
    if (!ATTR_ABBR[rawKey]) otherPairs.push(`${rawKey.replace(/Rating$/, "")} **${rawVal}**`);
  }
  if (otherPairs.length) {
    hasAnyAttr = true;
    p3.addFields({ name: "📦 Other", value: otherPairs.slice(0, 20).join("  "), inline: false });
  }
  if (!hasAnyAttr) p3.addFields({ name: "Attributes", value: "*No attribute data available.*", inline: false });
  p3.setFooter({ text: `Page 3/${TOTAL} · Season ${seasonNum} · ${roster.position} · ID ${roster.playerId}` });

  if (portrait) p1.setThumbnail(portrait);

  return [p1, p2, p3];
}

// ── Roster card — shared team-stats embed builder ──────────────────────────────

function buildTeamStatsEmbed(
  teamName: string,
  seasonNum: number,
  statsRow: typeof teamSeasonStatsTable.$inferSelect,
): EmbedBuilder {
  const ppg    = statsRow.offPtsPerGame > 0 ? statsRow.offPtsPerGame.toFixed(1) : "N/A";
  const offPct = statsRow.offRedZonePct > 0 ? `${statsRow.offRedZonePct.toFixed(1)}%` : "N/A";
  const defPct = statsRow.defRedZonePct > 0 ? `${statsRow.defRedZonePct.toFixed(1)}%` : "N/A";
  return new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🏟️ ${teamName} — Season ${seasonNum} Stats`)
    .setDescription(`**Record: ${statsRow.wins}W-${statsRow.losses}L**`)
    .addFields(
      { name: "📤 Offense", value: `Pass: ${statsRow.offPassYds.toLocaleString()} yds\nRush: ${statsRow.offRushYds.toLocaleString()} yds\nTotal: ${statsRow.offYds.toLocaleString()} yds\nPts/Game: ${ppg}\nRed Zone%: ${offPct}`, inline: true },
      { name: "📥 Defense", value: `Pass Yds Allowed: ${statsRow.defPassYds.toLocaleString()}\nRush Yds Allowed: ${statsRow.defRushYds.toLocaleString()}\nSacks: ${statsRow.teamSacks}\nINTs: ${statsRow.teamInts}\nRZ% Allowed: ${defPct}`, inline: true },
      { name: "🔄 Turnovers", value: `Turnover Diff: **${statsRow.turnoverDiff >= 0 ? "+" : ""}${statsRow.turnoverDiff}**\nFumbles Rec: ${statsRow.defFumblesRec}`, inline: true },
    )
    .setTimestamp();
}

function formatPlayerLine(p: {
  firstName: string; lastName: string;
  position: string; overall: number; devTrait: number;
  jerseyNum: number | null; age: number | null;
  contractYearsLeft: number | null;
}): string {
  const num  = p.jerseyNum != null ? `#${p.jerseyNum} ` : "";
  const age  = p.age != null ? ` | Age ${p.age}` : "";
  const flag = p.contractYearsLeft === 1 ? " 📋" : "";
  return `${num}**${p.firstName} ${p.lastName}** (${p.position}) — OVR ${p.overall}${age}${devBadge(p.devTrait)}${flag}`;
}

function fieldChunks(label: string, lines: string[]): { name: string; value: string }[] {
  if (!lines.length) return [];
  const chunks: { name: string; value: string }[] = [];
  let cur: string[] = [], len = 0;
  for (const line of lines) {
    const add = (cur.length ? 1 : 0) + line.length;
    if (len + add > 1020 && cur.length) {
      chunks.push({ name: chunks.length === 0 ? label : `${label} (cont.)`, value: cur.join("\n") });
      cur = []; len = 0;
    }
    cur.push(line); len += add;
  }
  if (cur.length) chunks.push({ name: chunks.length === 0 ? label : `${label} (cont.)`, value: cur.join("\n") });
  return chunks;
}

async function buildRosterEmbed(guildId: string, seasonId: number, teamId: number, teamLabel: string, embed: EmbedBuilder) {
  const rows = await db.select({
    firstName: franchiseRostersTable.firstName,
    lastName:  franchiseRostersTable.lastName,
    position:  franchiseRostersTable.position,
    overall:   franchiseRostersTable.overall,
    devTrait:  franchiseRostersTable.devTrait,
    jerseyNum: franchiseRostersTable.jerseyNum,
    age:       franchiseRostersTable.age,
    contractYearsLeft: franchiseRostersTable.contractYearsLeft,
  }).from(franchiseRostersTable)
    .where(and(eq(franchiseRostersTable.seasonId, seasonId), eq(franchiseRostersTable.teamId, teamId)))
    .orderBy(franchiseRostersTable.overall);

  if (!rows.length) {
    embed.setDescription("No roster data found for this team. Make sure MCA data has been imported.");
    return embed;
  }

  const sorted = [...rows].sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
  const offense = sorted.filter(p => OFFENSE_SET.has(p.position ?? ""));
  const defense = sorted.filter(p => DEFENSE_SET.has(p.position ?? ""));
  const special = sorted.filter(p => SPECIAL_TEAMS_POSITIONS.includes(p.position ?? ""));

  const addGroup = (group: { label: string; positions: string[] }, players: typeof sorted) => {
    const grpRows = group.positions.flatMap(pos =>
      players.filter(p => p.position?.toUpperCase() === pos).map(p => formatPlayerLine(p as any))
    );
    for (const chunk of fieldChunks(`⚡ ${group.label}`, grpRows)) {
      embed.addFields(chunk);
    }
  };

  embed.setTitle(`🏈 ${teamLabel} Roster`).setColor(Colors.Blue).setTimestamp();
  // Custom emojis only render in description/fields — not in footers
  embed.setDescription(DEV_LEGEND);
  embed.addFields({ name: "📤 Offense", value: "━━━━━━━━━━━", inline: false });
  for (const g of OFFENSE_GROUPS) addGroup(g, offense);
  embed.addFields({ name: "📥 Defense", value: "━━━━━━━━━━━", inline: false });
  for (const g of DEFENSE_GROUPS) addGroup(g, defense);
  if (special.length) {
    const lines = special.map(p => formatPlayerLine(p as any));
    for (const chunk of fieldChunks("🏟️ Special Teams", lines)) embed.addFields(chunk);
  }
  return embed;
}

// ── PR helpers (mirrors records.ts) ───────────────────────────────────────────

function calcPRScore(wins: number, losses: number, pointDiff: number): number {
  return 0.6 * (wins - losses) + 0.4 * pointDiff;
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
function fmtDiff(n: number): string { return n >= 0 ? `+${n}` : `${n}`; }






