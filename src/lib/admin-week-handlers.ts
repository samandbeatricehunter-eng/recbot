/**
 * admin-week-handlers.ts
 * Set Week + Advance Week interactive flow + core advance-week logic.
 * Extracted from lib/admin-operations-handlers.ts.
 */
/**
 * /admin-operations hub — admin-facing interactions with prefix ao_
 * Session TTL: 15 minutes (keyed by `${guildId}:${userId}`)
 */
import {
  ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction,
  EmbedBuilder, Colors, TextChannel, ChannelType, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, ComponentType,
} from "discord.js";
import { db } from "@workspace/db";
import {
  seasonsTable, franchiseScheduleTable, usersTable, gameChannelsTable,
  gotwHistoryTable, franchiseMcaTeamsTable, leagueTwitterTable,
  playerSeasonStatsTable, playerStatWeekProcessedTable,
  gameLogTable, userRecordsTable, statPaddingViolationsTable,
  defaultTeamLogosTable, waitlistTable,
  serverSettingsTable, franchiseRostersTable, inventoryTable, legendsTable, customPlayersTable,
  guildChannelsTable,
} from "@workspace/db";
import { eq, and, sql, ne, desc } from "drizzle-orm";
import {
  getOrCreateActiveSeason, addBalance, logTransaction,
  getGuildChannel, CHANNEL_KEYS,
  getOrSeedRules, setRules, getAllSections,
  getScheduleSeasonId,
} from "./db-helpers.js";
import { WEEK_SEQUENCE, weekLabel } from "./week-helpers.js";
import { lookupNflDivision } from "./constants.js";
import { generateFranchiseArticle, generateWeekPreview } from "./franchise-article.js";
import { runWildcardAutomation, runOffseasonHistoricalPost } from "./wildcard-automation.js";
import { runEosAutoPost } from "./eos-auto-post.js";
import { getPayoutValue, PAYOUT_KEYS } from "./payout-config.js";
import { sendArticleChunked } from "./send-article.js";
import { runWeeklyMatchupsFlow } from "./weekly-matchups-runner.js";
import { createPrivateGameChannelsForWeek } from "./game-channel-manager.js";
import { PLAYOFF_WEEK_META, runPlayoffMatchupsFlow, payoutPlayoffRoundResults, autoDivisionBonus } from "./playoff-matchups-runner.js";
import axios from "axios";
import { autoPayoutPlayoffGotw, purgeChannel } from "./gotw-helpers.js";
import { checkAndNotifyWaitlist } from "../commands/waitlist.js";
import { buildMatchupBanner, resolveLogoBuf } from "./matchup-image.js";
import { generateMatchupBreakdown } from "./matchup-ai-breakdown.js";
import { globalLogoPath } from "./gcs-reader.js";
import { buildAdminOpsEmbed, buildAdminOpsRows, buildAdminImportAdvanceEmbed, buildAdminImportAdvanceRows, buildAdminEconomyEmbed, buildAdminEconomyRows, buildAdminServerEmbed, buildAdminServerRows } from "../commands/admin-operations.js";
import { buildPayoutHubEmbed, buildPayoutHubRows } from "./admin-payout-handlers.js";
import { buildUserDataHubEmbed, buildUserDataHubRows } from "./admin-user-handlers.js";
import {
  buildTroubleshootEmbed, buildTroubleshootRows,
  handleTsMilestoneAudit,
} from "./admin-troubleshoot-handlers.js";
import { runNewServerInit, runExistingServerInit } from "../commands/admin-initialize.js";
import { registerCommandsForGuild } from "./register-commands.js";
import { buildLeagueDataMainMenu } from "./league-data-handlers.js";
import { getServerSettings, buildSettingsEmbed, buildSettingsRows } from "./server-settings.js";
import { setGuildChannel } from "./db-helpers.js";
import { rebuildHistoricalChannel } from "./wildcard-automation.js";
import OpenAI from "./openai-fallback.js";



function buildAdminBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_admin_root")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildAdminRootMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_admin_department_select")
        .setPlaceholder("Select admin department")
        .addOptions(
          { label: "Import/Advance", value: "import_advance", description: "Import, advance, set week/season, weekly matchups", emoji: "📥" },
          { label: "Manage Economy", value: "manage_economy", description: "Payouts and economy workflows", emoji: "💰" },
          { label: "Manage Server", value: "manage_server", description: "Users, settings, troubleshooting, bug reports", emoji: "🛠️" },
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ao_close").setLabel("Close").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildImportAdvanceMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_import_advance_select")
        .setPlaceholder("Select Import/Advance workflow")
        .addOptions(
          { label: "Import", value: "league_data", description: "Formerly League Data", emoji: "📥" },
          { label: "Advance Week", value: "advance_week", description: "Advance to the next league week", emoji: "⏭️" },
          { label: "Run Weekly Matchups", value: "run_weekly_matchups", description: "Post game channels, matchups, and GOTW flow", emoji: "🏈" },
          { label: "Set Week", value: "set_week", description: "Manually set current week", emoji: "📅" },
          { label: "Set Season", value: "set_season", description: "Manually set current season", emoji: "🏆" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

function buildManageEconomyMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_manage_economy_select")
        .setPlaceholder("Select Economy workflow")
        .addOptions(
          { label: "Payouts", value: "payouts", description: "Open payout management", emoji: "💰" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

function buildManageServerMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_manage_server_select")
        .setPlaceholder("Select Server workflow")
        .addOptions(
          { label: "User Data", value: "user_data", description: "Manage user/team data", emoji: "👥" },
          { label: "Store Settings", value: "store_settings", description: "Manage store options", emoji: "🏪" },
          { label: "Server Settings", value: "server_settings", description: "Manage server settings", emoji: "⚙️" },
          { label: "Troubleshoot", value: "troubleshoot", description: "Repair/check bot data", emoji: "🧰" },
          { label: "Report Bug", value: "report_bug", description: "Report a bot issue", emoji: "🐞" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

async function showAdminRootMenu(interaction: any) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0xB68B2D).setTitle("Commissioner's Office").setDescription("Select an admin department below.")],
    components: buildAdminRootMenuRows(),
  });
}

async function showAdminDepartmentMenu(interaction: any, title: string, description: string, components: any[]) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0xB68B2D).setTitle(title).setDescription(description)],
    components,
  });
}
const openaiClient = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey:  process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "dummy",
});


// ── Local AoSession type (mirrors admin-operations-handlers.ts) ───────────────
// ── Types ──────────────────────────────────────────────────────────────────────

type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

interface AoSession {
  guildId: string;
  userId: string;
  rulesSection?: string;
  rulesPage?: number;
  adminsAddPage?: number;
  expiresAt: number;
}

// ── Session management ─────────────────────────────────────────────────────────

const aoSessions = new Map<string, AoSession>();
const AO_SESSION_TTL = 15 * 60 * 1000;

function getAoSession(guildId: string, userId: string): AoSession {
  const key = `${guildId}:${userId}`;
  let sess = aoSessions.get(key);
  if (!sess || sess.expiresAt < Date.now()) {
    sess = { guildId, userId, expiresAt: Date.now() + AO_SESSION_TTL };
    aoSessions.set(key, sess);
  }
  sess.expiresAt = Date.now() + AO_SESSION_TTL;
  return sess;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

const RULES_PAGE_CHAR_LIMIT = 3800;



// ── Set Week ───────────────────────────────────────────────────────────────────

export async function handleSetWeek(interaction: ButtonInteraction) {
  const guildId = interaction.guildId!;
  const season  = await getOrCreateActiveSeason(guildId);
  const current = season.currentWeek ?? "1";

  const weekOptions = WEEK_SEQUENCE.map(w => ({
    label: weekLabel(w),
    value: w,
    default: w === current,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("ao_setwk_sel")
    .setPlaceholder(`Current: ${weekLabel(current)}`)
    .addOptions(weekOptions.map(o =>
      new StringSelectMenuOptionBuilder()
        .setLabel(o.label)
        .setValue(o.value)
        .setDefault(o.default),
    ));

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📅 Set Week")
        .setDescription(
          `Current week: **${weekLabel(current)}**\n\n` +
          "Select a week to set. **No auto-actions will run** — channels, GOTW, and articles are NOT triggered.\n" +
          "Use **⏩ Advance Week** if you want all auto-actions."
        ),
    ],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<any>, backRow],
  });
}

export async function handleSetWeekSelect(interaction: StringSelectMenuInteraction, _sess: AoSession) {
  const guildId = interaction.guildId!;
  const newWeek = interaction.values[0]!;
  const season  = await getOrCreateActiveSeason(guildId);
  const oldLabel = weekLabel(season.currentWeek ?? "1");
  const newLabel = weekLabel(newWeek);

  await db.update(seasonsTable)
    .set({ currentWeek: newWeek })
    .where(eq(seasonsTable.id, season.id));

  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("📅 Week Updated")
    .setDescription(
      `Week changed from **${oldLabel}** → **${newLabel}**.\n\n` +
      "No auto-actions were triggered. Use **⏩ Advance Week** for full auto-processing."
    )
    .setTimestamp();

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({ embeds: [embed], components: [backRow] });
}

// ── Advance Week ───────────────────────────────────────────────────────────────

export async function handleAdvanceWeek(interaction: ButtonInteraction) {
  const guildId = interaction.guildId!;
  const season  = await getOrCreateActiveSeason(guildId);
  const current = season.currentWeek ?? "1";

  const currentIdx = WEEK_SEQUENCE.indexOf(current);
  const nextIdx    = currentIdx === -1 ? 0 : Math.min(currentIdx + 1, WEEK_SEQUENCE.length - 1);
  const nextWeek   = WEEK_SEQUENCE[nextIdx]!;

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_advance_confirm").setLabel("✅ Confirm Advance").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("✖ Cancel").setStyle(ButtonStyle.Danger),
  );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⏩ Advance Week — Confirm")
        .setDescription(
          `**Current week:** ${weekLabel(current)}\n` +
          `**Next week:** **${weekLabel(nextWeek)}**\n\n` +
          "This will run **all auto-actions**:\n" +
          "• Create matchup channels for H2H games\n" +
          "• Award GOTW participation bonuses\n" +
          "• Process playoff payouts (if applicable)\n" +
          "• Post AI franchise articles\n" +
          "• Trigger League Twitter burst\n" +
          "• And more...\n\n" +
          "**Are you sure?**"
        ),
    ],
    components: [confirmRow],
  });
}

export async function handleAdvanceConfirm(interaction: ButtonInteraction) {
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Yellow)
        .setTitle("⏩ Advancing Week...")
        .setDescription("Please wait — running all auto-actions..."),
    ],
    components: [],
  });

  try {
    await performAdvanceWeek(interaction);
  } catch (err) {
    console.error("[admin-operations] Advance week error:", err);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("❌ Advance Week Failed")
          .setDescription(`An error occurred: ${err}`),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
        ) as ActionRowBuilder<any>,
      ],
    });
  }
}

// ── Advance Week — Core Logic (adapted from advanceweek.ts) ───────────────────

export async function postCommissionerNotice(
  client:  import("discord.js").Client,
  guildId: string,
  message: string,
): Promise<void> {
  try {
    const chId = await getGuildChannel(guildId, CHANNEL_KEYS.COMMISSIONER_LOG);
    if (!chId) return;
    const ch = (client.channels.cache.get(chId) ?? await client.channels.fetch(chId).catch(() => null)) as TextChannel | null;
    if (ch?.isTextBased()) await (ch as TextChannel).send({ content: message }).catch(() => {});
  } catch (err) {
    console.error("[admin-operations] Failed to post commissioner notice:", err);
  }
}

export function toChannelName(teamName: string): string {
  return teamName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/-$/, "");
}

export async function performAdvanceWeek(interaction: ButtonInteraction): Promise<void> {
  const guildId    = interaction.guildId!;
  const season     = await getOrCreateActiveSeason(guildId);

  const announceChannelId = await getGuildChannel(guildId, CHANNEL_KEYS.ANNOUNCEMENTS);
  const offseasonWipeIds  = (await Promise.all([
    getGuildChannel(guildId, CHANNEL_KEYS.PAYOUTS),
    getGuildChannel(guildId, CHANNEL_KEYS.HIGHLIGHTS),
    getGuildChannel(guildId, CHANNEL_KEYS.STREAM),
    getGuildChannel(guildId, CHANNEL_KEYS.HEADLINES),
    getGuildChannel(guildId, CHANNEL_KEYS.MATCHUPS),
    getGuildChannel(guildId, CHANNEL_KEYS.SCHEDULE),
    getGuildChannel(guildId, CHANNEL_KEYS.ANNOUNCEMENTS),
    getGuildChannel(guildId, CHANNEL_KEYS.LEAGUE_TWITTER),
  ])).filter((id): id is string => !!id);

  const currentIdx    = WEEK_SEQUENCE.indexOf(season.currentWeek ?? "1");
  const wouldClamp    = currentIdx !== -1 && currentIdx + 1 >= WEEK_SEQUENCE.length;
  const isTrainingEnd = season.currentWeek === "training_camp" && wouldClamp;

  // ── Auto-rollover: Training Camp → Week 1 of next season ─────────────────────
  let autoRolloverNote = "";
  if (isTrainingEnd) {
    const maxSeasons   = await getMaxSeasons(guildId);
    const nextNumber   = (season.seasonNumber ?? 0) + 1;

    if (nextNumber > maxSeasons) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle("🏁 Franchise Complete")
            .setDescription(
              `This franchise has reached its **${maxSeasons}-season limit**.\n\n` +
              `Season ${season.seasonNumber} is the final season — you cannot advance past it.\n\n` +
              `• Use **🔢 Set Season Number** to re-activate any previous season.\n` +
              `• Or increase the franchise length via \`/admin-initialize\`.`
            ),
        ],
        components: buildAdminOpsRows(),
      });
      return;
    }

    // Rollover current-season legends → permanent (4-cap per user)
    const PERMANENT_CAP = 4;
    const currentLegends = await db.select().from(inventoryTable)
      .where(and(
        eq(inventoryTable.seasonId, season.id),
        eq(inventoryTable.itemType, "legend"),
        sql`${inventoryTable.legendCategory} = 'current'`,
      ));
    let legendsPromoted = 0, legendsReturned = 0;
    const byUser: Record<string, typeof currentLegends> = {};
    for (const item of currentLegends) {
      if (!byUser[item.discordId]) byUser[item.discordId] = [];
      byUser[item.discordId]!.push(item);
    }
    for (const [userId, legends] of Object.entries(byUser)) {
      const [userRow] = await db.select({ team: usersTable.team }).from(usersTable)
        .where(and(eq(usersTable.discordId, userId), eq(usersTable.guildId, guildId))).limit(1);
      const teamName = userRow?.team ?? null;
      const [countRow] = await db.select({ c: sql<string>`count(*)` }).from(inventoryTable)
        .where(and(
          eq(inventoryTable.discordId, userId),
          eq(inventoryTable.itemType, "legend"),
          sql`${inventoryTable.legendCategory} = 'permanent'`,
        ));
      const existing  = parseInt(countRow?.c ?? "0", 10);
      const slotsLeft = Math.max(0, PERMANENT_CAP - existing);
      const toPromote = legends.slice(0, slotsLeft);
      const toReturn  = legends.slice(slotsLeft);
      for (const item of toPromote) {
        await db.update(inventoryTable)
          .set({ legendCategory: "permanent", ...(teamName ? { team: teamName } : {}) })
          .where(eq(inventoryTable.id, item.id));
        legendsPromoted++;
      }
      for (const item of toReturn) {
        if (item.legendId) {
          await db.update(legendsTable).set({ isAvailable: true }).where(eq(legendsTable.id, item.legendId));
        }
        await db.delete(inventoryTable).where(eq(inventoryTable.id, item.id));
        await db.update(usersTable)
          .set({ totalLegendPurchases: sql`GREATEST(0, ${usersTable.totalLegendPurchases} - 1)`, updatedAt: new Date() })
          .where(eq(usersTable.discordId, userId));
        legendsReturned++;
      }
    }

    // Rollover active custom players → permanent inventory
    const activeCustomPlayers = await db.select().from(customPlayersTable)
      .where(and(eq(customPlayersTable.seasonId, season.id), ne(customPlayersTable.status, "refunded")));
    let customPlayersRolled = 0;
    const tierToItemType = (tier: string): "custom_player_gold" | "custom_player_silver" | "custom_player_bronze" =>
      tier === "gold" ? "custom_player_gold" : tier === "silver" ? "custom_player_silver" : "custom_player_bronze";
    for (const cp of activeCustomPlayers) {
      const [existingCp] = await db.select({ id: inventoryTable.id }).from(inventoryTable)
        .where(and(
          eq(inventoryTable.discordId, cp.discordId),
          eq(inventoryTable.seasonId, season.id),
          eq(inventoryTable.itemType, tierToItemType(cp.packageTier)),
          sql`${inventoryTable.playerName} = ${`${cp.firstName} ${cp.lastName}`}`,
          sql`${inventoryTable.legendCategory} = 'permanent'`,
        )).limit(1);
      if (existingCp) continue;
      const [cpUser] = await db.select({ team: usersTable.team }).from(usersTable)
        .where(and(eq(usersTable.discordId, cp.discordId), eq(usersTable.guildId, guildId))).limit(1);
      await db.insert(inventoryTable).values({
        discordId:      cp.discordId,
        seasonId:       season.id,
        purchaseId:     0,
        itemType:       tierToItemType(cp.packageTier),
        playerName:     `${cp.firstName} ${cp.lastName}`,
        playerPosition: cp.position,
        legendCategory: "permanent",
        ...(cpUser?.team ? { team: cpUser.team } : {}),
      });
      customPlayersRolled++;
    }

    // Activate Season N+1 — prefer the record pre-seeded at Superbowl → Offseason;
    // fall back to creating a fresh one if that step was skipped.
    await db.update(seasonsTable)
      .set({ isActive: false })
      .where(eq(seasonsTable.guildId, guildId));

    const existingNext = await db.select().from(seasonsTable)
      .where(and(eq(seasonsTable.guildId, guildId), eq(seasonsTable.seasonNumber, nextNumber)))
      .limit(1);

    let newSeasonRecord: { id: number; seasonNumber: number } | undefined;
    let carryTeams = 0, carryRosters = 0;

    if (existingNext.length > 0) {
      // Season N+1 was already seeded at Superbowl → Offseason — just activate it.
      const [activated] = await db.update(seasonsTable)
        .set({ isActive: true })
        .where(eq(seasonsTable.id, existingNext[0]!.id))
        .returning({ id: seasonsTable.id, seasonNumber: seasonsTable.seasonNumber });
      newSeasonRecord = activated;
      // Count existing carry-forward rows for the summary note
      const [tc] = await db.select({ c: sql<string>`count(*)` }).from(franchiseMcaTeamsTable)
        .where(eq(franchiseMcaTeamsTable.seasonId, existingNext[0]!.id));
      const [rc] = await db.select({ c: sql<string>`count(*)` }).from(franchiseRostersTable)
        .where(eq(franchiseRostersTable.seasonId, existingNext[0]!.id));
      carryTeams  = parseInt(tc?.c ?? "0", 10);
      carryRosters = parseInt(rc?.c ?? "0", 10);
    } else {
      // Fallback: create Season N+1 and copy teams/rosters now
      const [created] = await db.insert(seasonsTable)
        .values({ guildId, seasonNumber: nextNumber, isActive: true })
        .returning({ id: seasonsTable.id, seasonNumber: seasonsTable.seasonNumber });
      newSeasonRecord = created;

      if (newSeasonRecord) {
        const prevTeams = await db.select().from(franchiseMcaTeamsTable)
          .where(eq(franchiseMcaTeamsTable.seasonId, season.id));
        if (prevTeams.length > 0) {
          const teamRows = prevTeams.map(t => ({
            seasonId: newSeasonRecord!.id, teamId: t.teamId, fullName: t.fullName,
            nickName: t.nickName, userName: t.userName, isHuman: t.isHuman, discordId: t.discordId,
          }));
          await db.insert(franchiseMcaTeamsTable).values(teamRows).onConflictDoNothing();
          carryTeams = teamRows.length;

          const prevRosters = await db.select().from(franchiseRostersTable)
            .where(eq(franchiseRostersTable.seasonId, season.id));
          if (prevRosters.length > 0) {
            const rosterRows = prevRosters.map(r => ({
              seasonId: newSeasonRecord!.id, teamId: r.teamId, teamName: r.teamName,
              discordId: r.discordId, playerId: r.playerId, firstName: r.firstName,
              lastName: r.lastName, position: r.position, overall: r.overall,
              devTrait: r.devTrait, age: r.age, jerseyNum: r.jerseyNum,
              contractYearsLeft: r.contractYearsLeft, attributes: r.attributes,
            }));
            for (let i = 0; i < rosterRows.length; i += 500) {
              await db.insert(franchiseRostersTable).values(rosterRows.slice(i, i + 500)).onConflictDoNothing();
            }
            carryRosters = rosterRows.length;
          }
        }
      }
    }

    const isLastSeason = nextNumber === maxSeasons;
    const rosterNote = carryTeams > 0
      ? `• ${carryTeams} team links + ${carryRosters} roster rows active for Season ${nextNumber}.`
      : "• No roster data seeded — MCA import required.";
    autoRolloverNote = [
      `🎉 **Season ${nextNumber} of ${maxSeasons} has begun!**` + (isLastSeason ? " ⚠️ This is the final season." : ""),
      `• ${legendsPromoted} legend(s) moved to permanent vaults${legendsReturned > 0 ? `; ${legendsReturned} returned to store (vault full)` : ""}.`,
      customPlayersRolled > 0 ? `• ${customPlayersRolled} custom player(s) rolled over to permanent inventories.` : "",
      rosterNote,
    ].filter(Boolean).join("\n");
    console.log(`[admin-operations] Auto season rollover: Season ${season.seasonNumber} → ${nextNumber} (guildId=${guildId})`);

    // Point season reference at the new active record for the week update below
    Object.assign(season, { id: newSeasonRecord!.id, seasonNumber: nextNumber });
  }

  const nextIdx = isTrainingEnd ? 0 : (currentIdx === -1 ? 0 : Math.min(currentIdx + 1, WEEK_SEQUENCE.length - 1));
  const newWeek = WEEK_SEQUENCE[nextIdx]!;

  await db.update(seasonsTable)
    .set({ currentWeek: newWeek })
    .where(eq(seasonsTable.id, season.id));

  const channelLines: string[] = [];

  // ── Wipe preseason stats when advancing from Training Camp → Week 1 ─────────
  let preseasonWipeNote = "";
  if (season.currentWeek === "training_camp" && newWeek === "1") {
    try {
      await Promise.all([
        db.delete(playerSeasonStatsTable)      .where(eq(playerSeasonStatsTable.seasonId,      season.id)),
        db.delete(playerStatWeekProcessedTable).where(eq(playerStatWeekProcessedTable.seasonId, season.id)),
        db.delete(gameLogTable)                .where(eq(gameLogTable.seasonId,                 season.id)),
        db.delete(userRecordsTable)            .where(eq(userRecordsTable.seasonId,              season.id)),
        db.delete(statPaddingViolationsTable)  .where(eq(statPaddingViolationsTable.seasonId,   season.id)),
      ]);
      preseasonWipeNote =
        "✅ Preseason stats cleared (player stats, game logs, W/L records, and violation flags have been reset for the regular season).";
      console.log(`[admin-operations] Preseason stats wiped for season ${season.id}`);
    } catch (err) {
      preseasonWipeNote = "⚠️ Preseason stat wipe partially failed — check logs.";
      console.error("[admin-operations] Preseason stat wipe error:", err);
    }
  }

  // ── GOTW bonus + cleanup for the week we're leaving ───────────────────────────
  const oldWeekNum = parseInt(season.currentWeek ?? "1", 10);
  if (!isNaN(oldWeekNum) && oldWeekNum >= 1 && oldWeekNum <= 18) {
    const oldWeekIndex = oldWeekNum - 1;

    try {
      const [gotwRow] = await db.select()
        .from(gotwHistoryTable)
        .where(and(
          eq(gotwHistoryTable.seasonId,  season.id),
          eq(gotwHistoryTable.weekIndex, oldWeekIndex),
        ))
        .limit(1);

      if (gotwRow) {
        const scheduleGames = await db.select()
          .from(franchiseScheduleTable)
          .where(and(
            eq(franchiseScheduleTable.seasonId,  season.id),
            eq(franchiseScheduleTable.weekIndex, oldWeekIndex),
          ));

        const mcaForGotw = await db.select({
          discordId: franchiseMcaTeamsTable.discordId,
          fullName:  franchiseMcaTeamsTable.fullName,
          nickName:  franchiseMcaTeamsTable.nickName,
        })
          .from(franchiseMcaTeamsTable)
          .where(eq(franchiseMcaTeamsTable.seasonId, season.id));

        const gotwNameToId = new Map<string, string>();
        for (const t of mcaForGotw) {
          if (t.discordId) {
            gotwNameToId.set(t.fullName.toLowerCase().trim(), t.discordId);
            gotwNameToId.set(t.nickName.toLowerCase().trim(), t.discordId);
          }
        }

        const gotwGame = scheduleGames.find(g => {
          const awayId = gotwNameToId.get(g.awayTeamName.toLowerCase().trim());
          const homeId = gotwNameToId.get(g.homeTeamName.toLowerCase().trim());
          if (awayId && homeId) {
            return (
              (awayId === gotwRow.discordId1 && homeId === gotwRow.discordId2) ||
              (awayId === gotwRow.discordId2 && homeId === gotwRow.discordId1)
            );
          }
          const away = g.awayTeamName.toLowerCase().trim();
          const home = g.homeTeamName.toLowerCase().trim();
          const t1   = gotwRow.teamName1.toLowerCase().trim();
          const t2   = gotwRow.teamName2.toLowerCase().trim();
          return (
            (away.includes(t1) || t1.includes(away)) && (home.includes(t2) || t2.includes(home)) ||
            (away.includes(t2) || t2.includes(away)) && (home.includes(t1) || t1.includes(home))
          );
        });

        if (gotwGame && gotwGame.status === 3) {
          const GOTW_BONUS = 10;
          await addBalance(gotwRow.discordId1, GOTW_BONUS, guildId);
          await logTransaction(gotwRow.discordId1, GOTW_BONUS, "addcoins",
            `GOTW participant bonus — Week ${oldWeekNum}`, "system");
          await addBalance(gotwRow.discordId2, GOTW_BONUS, guildId);
          await logTransaction(gotwRow.discordId2, GOTW_BONUS, "addcoins",
            `GOTW participant bonus — Week ${oldWeekNum}`, "system");

          channelLines.push(
            `🏆 GOTW bonus: **+${GOTW_BONUS} coins** awarded to <@${gotwRow.discordId1}> & <@${gotwRow.discordId2}>`,
          );

          for (const discordId of [gotwRow.discordId1, gotwRow.discordId2]) {
            try {
              const user = await interaction.client.users.fetch(discordId);
              await user.send(
                `🏆 **GOTW Bonus!** You participated in this week's Game of the Week and earned **+${GOTW_BONUS} coins**!`
              ).catch(() => {});
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error("[admin-operations] GOTW bonus error:", err);
    }
  }

  // ── Playoff payouts — fires when leaving a playoff week ──────────────────────
  const leavingPlayoffMeta = PLAYOFF_WEEK_META[season.currentWeek ?? ""];
  if (leavingPlayoffMeta) {
    const leavingLabel = leavingPlayoffMeta.label;

    try {
      const roundPayoutSummary = await payoutPlayoffRoundResults(
        interaction.client,
        season,
        season.currentWeek!,
        guildId,
      );
      if (roundPayoutSummary) channelLines.push(roundPayoutSummary);
    } catch (err) {
      console.error("[admin-operations] Playoff round payout error:", err);
      await postCommissionerNotice(
        interaction.client, guildId,
        `⚠️ **${leavingLabel} Payout Failed**\n` +
        `An error occurred while issuing playoff W/L records and coins: ${err}.\n` +
        "Payouts for this round were NOT fully issued. Use the admin economy tools to issue missing coins manually.",
      );
    }

    try {
      const payoutSummary = await autoPayoutPlayoffGotw(
        interaction.client,
        season.id,
        leavingPlayoffMeta.weekIndex,
        season.currentWeek!,
        guildId,
      );
      if (payoutSummary) channelLines.push(payoutSummary);
    } catch (err) {
      console.error("[admin-operations] Playoff GOTW payout error:", err);
      await postCommissionerNotice(
        interaction.client, guildId,
        `⚠️ **${leavingLabel} GOTW Payout Failed**\nPlayoff GOTW poll payouts errored: ${err}.`,
      );
    }
  }

  const oldLabel = weekLabel(season.currentWeek ?? "1");
  const newLabel = weekLabel(newWeek);

  // ── Channel lifecycle ──────────────────────────────────────────────────────
  const guild = interaction.guild;

  if (guild) {
    const oldChannels = await db.select()
      .from(gameChannelsTable)
      .where(eq(gameChannelsTable.seasonId, season.id));

    let deleted = 0;
    for (const row of oldChannels) {
      try {
        const ch = guild.channels.cache.get(row.channelId)
          ?? await guild.channels.fetch(row.channelId).catch(() => null);
        if (ch) {
          await ch.delete("Advance week — removing previous week's matchup channels");
          deleted++;
        }
      } catch (_) {}
    }

    if (oldChannels.length > 0) {
      await db.delete(gameChannelsTable)
        .where(eq(gameChannelsTable.seasonId, season.id));
      if (deleted > 0) channelLines.push(`🗑️ Removed **${deleted}** previous matchup channel${deleted !== 1 ? "s" : ""}`);
    }

    const newWeekNum = parseInt(newWeek, 10);
    let channelWeekIndex: number | null = null;
    let channelWeekDisplayLabel = weekLabel(newWeek);

    if (!isNaN(newWeekNum) && newWeekNum >= 1 && newWeekNum <= 18) {
      channelWeekIndex = newWeekNum - 1;
    } else if (PLAYOFF_WEEK_META[newWeek]) {
      channelWeekIndex = PLAYOFF_WEEK_META[newWeek]!.weekIndex;
    }

    if (channelWeekIndex !== null) {
      const weekIndex = channelWeekIndex;

      const games = await db.select()
        .from(franchiseScheduleTable)
        .where(and(
          eq(franchiseScheduleTable.seasonId,  season.id),
          eq(franchiseScheduleTable.weekIndex, weekIndex),
        ));

      const [mcaTeams, defaultLogos] = await Promise.all([
        db.select({
          fullName:  franchiseMcaTeamsTable.fullName,
          nickName:  franchiseMcaTeamsTable.nickName,
          discordId: franchiseMcaTeamsTable.discordId,
          teamId:    franchiseMcaTeamsTable.teamId,
          logoUrl:   franchiseMcaTeamsTable.logoUrl,
        }).from(franchiseMcaTeamsTable)
          .where(eq(franchiseMcaTeamsTable.seasonId, season.id)),
        db.select({
          teamId:   defaultTeamLogosTable.teamId,
          fullName: defaultTeamLogosTable.fullName,
          nickName: defaultTeamLogosTable.nickName,
          logoUrl:  defaultTeamLogosTable.logoUrl,
        }).from(defaultTeamLogosTable),
      ]);

      const defaultById   = new Map<number, string>();
      const defaultByName = new Map<string, string>();
      for (const d of defaultLogos) {
        defaultById.set(d.teamId, d.logoUrl);
        defaultByName.set(d.fullName.toLowerCase().trim(), d.logoUrl);
        defaultByName.set(d.nickName.toLowerCase().trim(), d.logoUrl);
      }

      const teamToDiscord = new Map<string, string>();
      const teamToMca     = new Map<string, typeof mcaTeams[0]>();
      for (const t of mcaTeams) {
        const keys = [
          t.fullName.toLowerCase().trim(),
          t.nickName.toLowerCase().trim(),
          String(t.teamId),
        ];
        for (const key of keys) {
          if (!teamToMca.has(key)) teamToMca.set(key, t);
          if (t.discordId && !t.discordId.startsWith("unlinked_") && !teamToDiscord.has(key))
            teamToDiscord.set(key, t.discordId);
        }
      }

      const discordIdToMca = new Map<string, typeof mcaTeams[0]>();
      for (const t of mcaTeams) {
        if (t.discordId && !t.discordId.startsWith("unlinked_")) discordIdToMca.set(t.discordId, t);
      }

      const allUsers = await db.select({
        discordId: usersTable.discordId,
        team:      usersTable.team,
      }).from(usersTable).where(eq(usersTable.guildId, guildId));
      for (const u of allUsers) {
        if (u.team && !u.discordId.startsWith("unlinked_") && !teamToDiscord.has(u.team.toLowerCase().trim())) {
          teamToDiscord.set(u.team.toLowerCase().trim(), u.discordId);
        }
      }

      const discordIdToProperTeam = new Map<string, string>();
      for (const u of allUsers) {
        if (u.team && !u.discordId.startsWith("unlinked_")) discordIdToProperTeam.set(u.discordId, u.team);
      }

      // Alias full team names to real Discord IDs resolved via nickname, and enrich discordIdToMca
      for (const t of mcaTeams) {
        const byNick = teamToDiscord.get(t.nickName.toLowerCase().trim());
        if (byNick) {
          if (!teamToDiscord.has(t.fullName.toLowerCase().trim()))
            teamToDiscord.set(t.fullName.toLowerCase().trim(), byNick);
          if (!discordIdToMca.has(byNick)) discordIdToMca.set(byNick, t);
        }
      }

      const h2hGames = games.filter(g => {
        const awayId = teamToDiscord.get(g.awayTeamName.toLowerCase().trim());
        const homeId = teamToDiscord.get(g.homeTeamName.toLowerCase().trim());
        return awayId && homeId;
      });

      if (h2hGames.length === 0 && games.length > 0) {
        channelLines.push("📭 No H2H matchups found in schedule for this week — no channels created");
      } else if (games.length === 0) {
        channelLines.push("📭 No schedule data found for this week — run `/franchiseupdate` first");
      }

      await guild.channels.fetch();
      const matchupCategory = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes("GAMEDAY"),
      );
      const resolvedCategoryId = matchupCategory?.id ?? null;

      if (!resolvedCategoryId) {
        channelLines.push("⚠️ Could not find a GAMEDAY CENTER category in this server — matchup channels not created.");
      }

      let created = 0;
      for (const g of resolvedCategoryId ? h2hGames : []) {
        const awayDiscordId = teamToDiscord.get(g.awayTeamName.toLowerCase().trim())!;
        const homeDiscordId = teamToDiscord.get(g.homeTeamName.toLowerCase().trim())!;
        const awayProper    = discordIdToProperTeam.get(awayDiscordId) ?? g.awayTeamName;
        const homeProper    = discordIdToProperTeam.get(homeDiscordId) ?? g.homeTeamName;
        const awayNick      = discordIdToMca.get(awayDiscordId)?.nickName ?? discordIdToProperTeam.get(awayDiscordId) ?? g.awayTeamName.split(/\s+/).pop()!;
        const homeNick      = discordIdToMca.get(homeDiscordId)?.nickName ?? discordIdToProperTeam.get(homeDiscordId) ?? g.homeTeamName.split(/\s+/).pop()!;
        const chanName      = `${toChannelName(awayNick)}-vs-${toChannelName(homeNick)}`;

        try {
          const newChannel = await guild.channels.create({
            name:   chanName,
            type:   ChannelType.GuildText,
            parent: resolvedCategoryId!,
          });

          await newChannel.lockPermissions();

          const awayMention2 = awayDiscordId && !awayDiscordId.startsWith("unlinked_") ? `<@${awayDiscordId}>` : awayProper;
          const homeMention2 = homeDiscordId && !homeDiscordId.startsWith("unlinked_") ? `<@${homeDiscordId}>` : homeProper;
          await newChannel.send(
            `🏈 **${awayProper} vs ${homeProper}** — ${channelWeekDisplayLabel}\n` +
            `${awayMention2} ${homeMention2}\n` +
            `Good luck this week!`,
          );

          await db.insert(gameChannelsTable).values({
            seasonId:     season.id,
            weekIndex,
            channelId:    newChannel.id,
            awayTeamName: awayProper,
            homeTeamName: homeProper,
          });

          // ── Matchup banner + AI breakdown (fire-and-forget) ───────────────────
          (async () => {
            try {
              const awayMca = teamToMca.get(g.awayTeamName.toLowerCase().trim()) ?? discordIdToMca.get(awayDiscordId);
              const homeMca = teamToMca.get(g.homeTeamName.toLowerCase().trim()) ?? discordIdToMca.get(homeDiscordId);

              function resolveLogoPath(teamName: string, mca: typeof mcaTeams[0] | undefined): string | null {
                const key = teamName.toLowerCase().trim();
                if (mca?.logoUrl) return mca.logoUrl;
                if (mca?.teamId != null) {
                  const byId = defaultById.get(mca.teamId);
                  if (byId) return byId;
                }
                const exact = defaultByName.get(key);
                if (exact) return exact;
                for (const d of defaultLogos) {
                  if (key.includes(d.nickName.toLowerCase().trim())) return d.logoUrl;
                }
                if (mca?.teamId != null && mca.teamId <= 31) return globalLogoPath(mca.teamId);
                return null;
              }

              const awayGcsPath = resolveLogoPath(awayProper, awayMca);
              const homeGcsPath = resolveLogoPath(homeProper, homeMca);

              if (awayGcsPath && homeGcsPath) {
                const [awayBuf, homeBuf] = await Promise.all([
                  resolveLogoBuf(awayGcsPath),
                  resolveLogoBuf(homeGcsPath),
                ]);
                if (awayBuf && homeBuf) {
                  const bannerBuf  = await buildMatchupBanner(awayBuf, homeBuf);
                  const attachment = new AttachmentBuilder(bannerBuf, { name: "matchup-banner.png" });
                  const bannerEmbed = new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle(`${awayProper} @ ${homeProper}`)
                    .setDescription(`<@${awayDiscordId}> **vs** <@${homeDiscordId}>`)
                    .setImage("attachment://matchup-banner.png")
                    .setFooter({ text: channelWeekDisplayLabel });
                  await newChannel.send({ embeds: [bannerEmbed], files: [attachment] });
                }
              }

            } catch (postErr) {
              console.error(`[admin-operations] Failed to post banner/breakdown for ${chanName}:`, postErr);
            }
          })();

          created++;
        } catch (chErr) {
          console.error(`[admin-operations] Failed to create channel for ${chanName}:`, chErr);
          channelLines.push(`⚠️ Could not create channel for **${g.awayTeamName} vs ${g.homeTeamName}**`);
        }
      }

      if (created > 0) {
        channelLines.push(`✅ Created **${created}** matchup channel${created !== 1 ? "s" : ""}${resolvedCategoryId ? `` : ""}`);
      }
    }
  }

  // ── Build reply embed ──────────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(autoRolloverNote ? Colors.Gold : Colors.Green)
    .setTitle(autoRolloverNote ? "🎉 Season Rollover — Week 1 Begins!" : "📅 League Week Updated")
    .addFields(
      { name: "Previous Week", value: oldLabel,         inline: true },
      { name: "Current Week",  value: `**${newLabel}**`, inline: true },
    )
    .setTimestamp();

  if (autoRolloverNote) {
    embed.addFields({ name: "🔄 Season Rollover", value: autoRolloverNote });
  }

  if (channelLines.length > 0) {
    embed.addFields({ name: "📺 Matchup Channels", value: channelLines.join("\n") });
  }

  if (preseasonWipeNote) {
    embed.addFields({ name: "🧹 Preseason Data Cleared", value: preseasonWipeNote });
  }

  if (newWeek === "wildcard") {
    embed.addFields({
      name: "🏈 Wildcard Week — Auto-Actions Running",
      value: [
        "The following are running automatically in the background:",
        "• Playoff seeds set from MCA standings",
        "• Division winner bonuses issued to seeds 1–4 each conference",
        "• Matchup embeds + GOTW polls posted",
        "",
        "Seeds 1–4 earn **+75 coins/playoff win**.",
        "Seeds 5–7 (wildcard) earn **+100 coins/playoff win**.",
        "All playoff losers receive **+50 coins** upon elimination.",
      ].join("\n"),
    });
    embed.setColor(Colors.Yellow);
  }

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  ) as ActionRowBuilder<any>;

  await interaction.editReply({ embeds: [embed], components: [backRow] });

  // ── Franchise articles ────────────────────────────────────────────────────
  if (!isNaN(oldWeekNum) && oldWeekNum >= 1 && oldWeekNum <= 18 && newWeek !== "1" && guild) {
    const headlinesChannelId = await getGuildChannel(guildId, CHANNEL_KEYS.HEADLINES);
    const headlinesChannel   = headlinesChannelId
      ? (interaction.client.channels.cache.get(headlinesChannelId) ?? await interaction.client.channels.fetch(headlinesChannelId).catch(() => null))
      : null;

    if (headlinesChannel && headlinesChannel.isTextBased()) {
      (async () => {
        const tc = headlinesChannel as TextChannel;
        const completedWeekIndex = oldWeekNum - 1;

        try {
          const recapArticle = await generateFranchiseArticle(
            season.id,
            season.seasonNumber,
            completedWeekIndex,
            weekLabel(newWeek),
          );
          await sendArticleChunked(
            tc,
            `@everyone\n📰 **REC League — Week ${oldWeekNum} Recap**\n\n`,
            recapArticle,
          );
        } catch (err) {
          console.error("[admin-operations] Failed to generate recap article:", err);
          try {
            await tc.send({
              content: `📰 **REC League — Week ${oldWeekNum} Recap**\n\n_The AI recap could not be generated for this week._`,
            });
          } catch { /* nothing */ }
        }

        const newWeekNum2 = parseInt(newWeek, 10);
        if (!isNaN(newWeekNum2) && newWeekNum2 >= 1 && newWeekNum2 <= 18) {
          try {
            const previewArticle = await generateWeekPreview(
              season.id,
              season.seasonNumber,
              newWeekNum2 - 1,
            );
            await sendArticleChunked(
              tc,
              `@everyone\n📋 **REC League — Week ${newWeekNum2} Preview**\n\n`,
              previewArticle,
            );
          } catch (err) {
            console.error("[admin-operations] Failed to generate preview article:", err);
            try {
              await tc.send({
                content: `📋 **REC League — Week ${newWeekNum2} Preview**\n\n_The AI preview could not be generated for this week._`,
              });
            } catch { /* nothing */ }
          }
        }
      })();
    }
  }

  // ── Wildcard automation + auto-reseed + division bonus + matchup flow ─────
  if (newWeek === "wildcard" && season.currentWeek === "18") {
    (async () => {
      // 1. Auto-reseed playoff seeds from saved MCA standings
      try {
        const apiDomain  = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim() ?? "";
        const apiBase    = `https://${apiDomain}/api`;
        const webhookKey = process.env["MADDEN_WEBHOOK_KEY"] ?? "";
        const reseedRes  = await axios.post(`${apiBase}/internal/reseed-from-standings`, {}, {
          validateStatus: () => true,
          headers: webhookKey ? { Authorization: `Bearer ${webhookKey}` } : {},
        });
        const body = typeof reseedRes.data === "object" && reseedRes.data !== null
          ? reseedRes.data as { ok: boolean; message?: string; details?: { applied: number } }
          : { ok: false, message: `HTTP ${reseedRes.status}` };
        if (body.ok) {
          console.log(`[admin-operations] Auto-reseed: ${body.details?.applied ?? "?"} seeds applied.`);
        } else {
          console.error("[admin-operations] Auto-reseed failed:", body.message);
          await postCommissionerNotice(
            interaction.client, guildId,
            "⚠️ **Wildcard Auto-Reseed Failed**\n" +
            `The automatic playoff seeding from standings failed: ${body.message ?? "unknown error"}.\n` +
            "Playoff seeds were not set. Use the API endpoint manually or set seeds via the admin economy tools.",
          );
        }
      } catch (err) {
        console.error("[admin-operations] Auto-reseed error:", err);
        await postCommissionerNotice(
          interaction.client, guildId,
          `⚠️ **Wildcard Auto-Reseed Error**\nReseed threw an exception: ${err}.\nPlayoff seeds may not be set correctly.`,
        );
      }

      // 2. Division winner bonus (seeds 1–4 each conference)
      try {
        const divResult = await autoDivisionBonus(interaction.client, guildId);
        console.log("[admin-operations] Division bonus result:", divResult);
      } catch (err) {
        console.error("[admin-operations] Division bonus error:", err);
        await postCommissionerNotice(
          interaction.client, guildId,
          `⚠️ **Division Winner Bonus Failed**\nThe automatic division winner bonus threw an error: ${err}.\n` +
          "Issue the bonus manually via the economy admin tools.",
        );
      }

      // 3. Wildcard automation (in-game awards, season PR, GOTY poll, etc.)
      try {
        await runWildcardAutomation(interaction.client, season.id, season.seasonNumber, interaction.guild);
      } catch (err) {
        console.error("[admin-operations] Wildcard automation error:", err);
      }

      // 4. Playoff matchup embeds + GOTW polls
      try {
        const matchupSummary = await runPlayoffMatchupsFlow(interaction.client, season, "wildcard", guildId);
        console.log("[admin-operations] Wildcard matchups:", matchupSummary);
      } catch (err) {
        console.error("[admin-operations] Wildcard matchups flow error:", err);
        await postCommissionerNotice(
          interaction.client, guildId,
          `⚠️ **Wildcard Matchups Flow Failed**\nFailed to post Wild Card matchup embeds and GOTW polls: ${err}.`,
        );
      }
    })();
  }

  // ── Divisional / Conference / Superbowl matchup flow ──────────────────────
  if (["divisional", "conference", "superbowl"].includes(newWeek)) {
    (async () => {
      try {
        const matchupSummary = await runPlayoffMatchupsFlow(
          interaction.client, season, newWeek as keyof typeof PLAYOFF_WEEK_META, guildId,
        );
        console.log(`[admin-operations] ${newWeek} matchups:`, matchupSummary);
      } catch (err) {
        console.error(`[admin-operations] ${newWeek} matchups flow error:`, err);
        await postCommissionerNotice(
          interaction.client, guildId,
          `⚠️ **${weekLabel(newWeek)} Matchups Flow Failed**\nFailed to post matchup embeds and GOTW polls: ${err}.`,
        );
      }
    })();
  }

  // ── EOS payout auto-post ──────────────────────────────────────────────────
  if (newWeek === "wildcard") {
    (async () => {
      try {
        const result = await runEosAutoPost(interaction.client, season.id, guildId);
        const lines = [
          `📋 **End-of-Season Payout Summaries Posted** to the commissioner log.`,
          `• **${result.posted}** user payout${result.posted !== 1 ? "s" : ""} queued for approval`,
        ];
        if (result.skipped > 0) lines.push(`• **${result.skipped}** already had records for this season (skipped)`);
        if (result.errors > 0)  lines.push(`• ⚠️ **${result.errors}** failed — check bot console`);
        lines.push("Use the **Edit Amount** buttons in the commissioner log to adjust before approving.");
        await interaction.followUp({ content: lines.join("\n"), ephemeral: true });
      } catch (err) {
        console.error("[admin-operations] EOS auto-post error:", err);
        await interaction.followUp({ content: `⚠️ EOS auto-post failed: ${err}`, ephemeral: true }).catch(() => {});
      }
    })();
  }

  // ── Offseason historical post + channel wipes + roster carryforward ──────
  if (newWeek === "offseason") {
    (async () => {
      try {
        await runOffseasonHistoricalPost(interaction.client, season.id, season.seasonNumber);
      } catch (err) {
        console.error("[admin-operations] Offseason historical post error:", err);
      }

      // ── Auto-carryforward: seed Season N+1 with current season's roster ─────
      try {
        const maxSeasons  = await getMaxSeasons(guildId);
        const nextNumber  = (season.seasonNumber ?? 0) + 1;

        if (nextNumber <= maxSeasons) {
          // Create Season N+1 as inactive staging record (idempotent)
          const existingNext = await db.select({ id: seasonsTable.id })
            .from(seasonsTable)
            .where(and(eq(seasonsTable.guildId, guildId), eq(seasonsTable.seasonNumber, nextNumber)))
            .limit(1);

          let nextSeasonId: number;
          if (existingNext.length > 0) {
            nextSeasonId = existingNext[0]!.id;
          } else {
            const [created] = await db.insert(seasonsTable)
              .values({ guildId, seasonNumber: nextNumber, isActive: false })
              .returning({ id: seasonsTable.id });
            nextSeasonId = created!.id;
          }

          // Upsert team links from Season N → Season N+1
          const prevTeams = await db.select().from(franchiseMcaTeamsTable)
            .where(eq(franchiseMcaTeamsTable.seasonId, season.id));
          let carryTeams = 0;
          for (const t of prevTeams) {
            await db.insert(franchiseMcaTeamsTable)
              .values({
                seasonId: nextSeasonId, teamId: t.teamId, fullName: t.fullName,
                nickName: t.nickName, userName: t.userName, isHuman: t.isHuman,
                discordId: t.discordId, updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [franchiseMcaTeamsTable.seasonId, franchiseMcaTeamsTable.teamId],
                set: {
                  fullName: t.fullName, nickName: t.nickName, userName: t.userName,
                  isHuman: t.isHuman, discordId: t.discordId, updatedAt: new Date(),
                },
              });
            carryTeams++;
          }

          // Replace rosters in Season N+1 with Season N's most recent import
          await db.delete(franchiseRostersTable).where(eq(franchiseRostersTable.seasonId, nextSeasonId));
          const prevRosters = await db.select().from(franchiseRostersTable)
            .where(eq(franchiseRostersTable.seasonId, season.id));
          let carryRosters = 0;
          if (prevRosters.length > 0) {
            const rosterRows = prevRosters.map(r => ({
              seasonId: nextSeasonId, teamId: r.teamId, teamName: r.teamName,
              discordId: r.discordId, playerId: r.playerId, firstName: r.firstName,
              lastName: r.lastName, position: r.position, overall: r.overall,
              devTrait: r.devTrait, age: r.age, jerseyNum: r.jerseyNum,
              contractYearsLeft: r.contractYearsLeft, attributes: r.attributes,
            }));
            for (let i = 0; i < rosterRows.length; i += 500) {
              await db.insert(franchiseRostersTable).values(rosterRows.slice(i, i + 500));
            }
            carryRosters = rosterRows.length;
          }

          console.log(`[admin-operations] Offseason carryforward: ${carryTeams} teams + ${carryRosters} rosters seeded into Season ${nextNumber} (id=${nextSeasonId})`);
          await interaction.followUp({
            content:
              `📋 **Season ${nextNumber} roster seeded automatically.**\n` +
              `• ${carryTeams} team links + ${carryRosters} roster rows copied from Season ${season.seasonNumber ?? "N"}.\n` +
              `MCA will overwrite with fresh data on next import.`,
            ephemeral: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("[admin-operations] Offseason carryforward error:", err);
        await interaction.followUp({
          content: `⚠️ Season roster carryforward failed — check bot logs. You can re-run manually with \`/season carryforward\` if needed.`,
          ephemeral: true,
        }).catch(() => {});
      }

      for (const chId of offseasonWipeIds) {
        try {
          const ch = interaction.client.channels.cache.get(chId)
            ?? await interaction.client.channels.fetch(chId).catch(() => null);
          if (ch?.isTextBased()) {
            await purgeChannel(ch as TextChannel).catch(err =>
              console.error(`[admin-operations] Offseason wipe error (${chId}):`, err),
            );
          }
        } catch (err) {
          console.error(`[admin-operations] Could not wipe channel ${chId}:`, err);
        }
      }

      try {
        await db.delete(leagueTwitterTable).where(eq(leagueTwitterTable.seasonId, season.id));
      } catch (err) {
        console.error("[admin-operations] Failed to wipe league twitter DB rows:", err);
      }

      try {
        const announceCh = announceChannelId
          ? (interaction.client.channels.cache.get(announceChannelId)
              ?? await interaction.client.channels.fetch(announceChannelId).catch(() => null))
          : null;
        if (announceCh?.isTextBased()) {
          await (announceCh as TextChannel).send({
            content:
              `@everyone\n` +
              `📣 **The rule change voting period has begun!**\n\n` +
              `If you are requesting a specific rule change to be voted on by the league, ` +
              `please post it in the **League Announcements** channel immediately to be considered.\n\n` +
              `⚠️ This opportunity **ends once the Draft has begun**. Get your proposals in now!`,
          });
        }
      } catch (err) {
        console.error("[admin-operations] Offseason announcement error:", err);
      }
    })();
  }

  // ── Training Camp announcement ────────────────────────────────────────────
  if (newWeek === "training_camp") {
    (async () => {
      try {
        const announceCh = announceChannelId
          ? (interaction.client.channels.cache.get(announceChannelId)
              ?? await interaction.client.channels.fetch(announceChannelId).catch(() => null))
          : null;
        if (announceCh?.isTextBased()) {
          await (announceCh as TextChannel).send({
            content:
              `@everyone\n` +
              `🏕️ **Training Camp has begun!**\n\n` +
              `The offseason is over — it's time to build your roster and get ready for the upcoming season.\n\n` +
              `📋 All attribute upgrades, dev upgrades, and store purchases are now open for the new season.`,
          });
        }
      } catch (err) {
        console.error("[admin-operations] Training Camp announcement error:", err);
      }
    })();
  }

  // ── New season announcement + full schedule ───────────────────────────────
  if (newWeek === "1" && (!season.currentWeek || season.currentWeek === "offseason" || season.currentWeek === "training_camp")) {
    (async () => {
      try {
        const announceCh = announceChannelId
          ? (interaction.client.channels.cache.get(announceChannelId)
              ?? await interaction.client.channels.fetch(announceChannelId).catch(() => null))
          : null;
        if (announceCh?.isTextBased()) {
          await (announceCh as TextChannel).send({
            content:
              `@everyone\n` +
              `🏈 **A new season has begun!**\n\n` +
              `We have officially advanced to **Season ${season.seasonNumber}**.\n` +
              `Good luck to everyone this season — let's get to work! 💪`,
          });
        }
      } catch (err) {
        console.error("[admin-operations] New season announcement error:", err);
      }

      try {
        await db.update(usersTable).set({ playoffSeed: null, playoffConference: null });
        console.log("[admin-operations] Cleared playoff seeds for new season");
      } catch (err) {
        console.error("[admin-operations] Failed to clear playoff seeds:", err);
      }

      try {
        const commId = await getGuildChannel(guildId, CHANNEL_KEYS.TRANSACTIONS)
          ?? await getGuildChannel(guildId, CHANNEL_KEYS.COMMISSIONER);
        if (commId) {
          const commCh = interaction.client.channels.cache.get(commId)
            ?? await interaction.client.channels.fetch(commId).catch(() => null);
          if (commCh?.isTextBased()) {
            const messages = await (commCh as TextChannel).messages.fetch({ limit: 100 });
            for (const msg of messages.values()) {
              if (!msg.components.length || !msg.editable) continue;
              const NON_REFUNDABLE = new Set(["legend", "custom_player"]);
              let modified = false;
              const newRows: ReturnType<typeof ButtonBuilder.from>[][] = [];
              for (const row of msg.components) {
                if (row.type !== ComponentType.ActionRow) continue;
                const kept: ReturnType<typeof ButtonBuilder.from>[] = [];
                for (const c of (row as any).components ?? []) {
                  if (c.type !== ComponentType.Button) {
                    kept.push(ButtonBuilder.from(c.toJSON?.() ?? c));
                    continue;
                  }
                  const cid: string = c.customId ?? "";
                  if (!cid.startsWith("refund_purchase:")) {
                    kept.push(ButtonBuilder.from(c.toJSON?.() ?? c));
                    continue;
                  }
                  const purchaseType: string = cid.split(":")[3] ?? "";
                  if (NON_REFUNDABLE.has(purchaseType) || purchaseType.startsWith("custom_player")) {
                    modified = true;
                  } else {
                    kept.push(ButtonBuilder.from(c.toJSON?.() ?? c));
                  }
                }
                if (kept.length > 0) newRows.push(kept);
              }
              if (modified) {
                const actionRows = newRows.map(btns =>
                  new ActionRowBuilder<ButtonBuilder>().addComponents(btns)
                );
                await msg.edit({ components: actionRows }).catch(() => null);
              }
            }
          }
        }
      } catch (err) {
        console.error("[admin-operations] Refund button removal error:", err);
      }

    })();
  }

  // ── Weekly matchups flow ──────────────────────────────────────────────────
  const _newWeekNum = parseInt(newWeek, 10);
  if (!isNaN(_newWeekNum) && _newWeekNum >= 1 && _newWeekNum <= 18) {
    (async () => {
      try {
        await runWeeklyMatchupsFlow({
          client:          interaction.client,
          guild:           interaction.guild,
          season,
          displayWeekNum:  _newWeekNum,
          payoutWeekIndex: (!isNaN(oldWeekNum) && oldWeekNum >= 1) ? oldWeekNum - 1 : null,
          guildId,
          replyFn: async ({ content, components }) => {
            await interaction.followUp({
              content,
              components: components ?? [],
              ephemeral:  true,
            });
          },
        });
      } catch (err) {
        console.error("[admin-operations] Weekly matchups flow error:", err);
        try {
          await interaction.followUp({
            content: `⚠️ Week advanced, but the weekly matchups flow failed: ${err}`,
            ephemeral: true,
          });
        } catch { /* nothing */ }
      }
    })();
  }

  // ── Playoff matchups flow ─────────────────────────────────────────────────
  if (PLAYOFF_WEEK_META[newWeek]) {
    (async () => {
      try {
        const summary = await runPlayoffMatchupsFlow(
          interaction.client,
          season,
          newWeek,
          guildId,
        );
        await interaction.followUp({ content: summary, ephemeral: true }).catch(() => {});
      } catch (err) {
        console.error("[admin-operations] Playoff matchups flow error:", err);
        try {
          await interaction.followUp({
            content: `⚠️ Week advanced, but the playoff matchups flow failed: ${err}`,
            ephemeral: true,
          });
        } catch { /* nothing */ }
      }
    })();
  }

  // ── Waitlist scan ─────────────────────────────────────────────────────────
  checkAndNotifyWaitlist(
    interaction.client,
    interaction.guild,
    guildId,
  ).catch(err => console.error("[admin-operations] Waitlist scan error:", err));
}


