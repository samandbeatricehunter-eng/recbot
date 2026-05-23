const fs = require('fs');
const path = require('path');

function findRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Could not locate project root. Run this inside the recbot project.');
}

const root = findRoot();
const adminCmdPath = path.join(root, 'src', 'commands', 'admin-operations.ts');
const handlerPath = path.join(root, 'src', 'lib', 'admin-operations-handlers.ts');

function read(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
  return fs.readFileSync(p, 'utf8');
}
function write(p, data) {
  fs.writeFileSync(p, data, 'utf8');
}
function backup(p, label) {
  const b = `${p}.bak-${label}-${Date.now()}`;
  fs.copyFileSync(p, b);
  console.log(`Backup created: ${path.relative(root, b)}`);
}

function overwriteAdminCommand() {
  backup(adminCmdPath, 'admin-menu-selector-v3');
  const code = `import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";

import { isAdminUser, getOrCreateActiveSeason } from "../lib/db-helpers.js";
import { weekLabel } from "../lib/week-helpers.js";

export const data = new SlashCommandBuilder()
  .setName("admin-menu")
  .setDescription("Commissioner's Office — admin operations hub")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export function buildAdminOpsEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  const header = seasonNum != null && weekStr
    ? `Season ${seasonNum} - ${weekStr}\n\n`
    : "";

  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office")
    .setDescription(
      header +
      "Select an admin department below.\n\n" +
      "**Import/Advance**\n" +
      "Import data, advance the week, set week/season, or run weekly matchups.\n\n" +
      "**Manage Economy**\n" +
      "Open payout management tools.\n\n" +
      "**Manage Server**\n" +
      "User data, store settings, server settings, troubleshooting, and bug reports."
    )
    .setFooter({ text: "Commissioner's Office • selections expire after 15 minutes" })
    .setTimestamp();
}

export function buildAdminOpsRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_dept_select")
      .setPlaceholder("Select an admin department")
      .addOptions(
        {
          label: "Import/Advance",
          value: "import_advance",
          description: "League data, advancing, week/season controls, matchups",
          emoji: "📥",
        },
        {
          label: "Manage Economy",
          value: "manage_economy",
          description: "Payout management tools",
          emoji: "💰",
        },
        {
          label: "Manage Server",
          value: "manage_server",
          description: "Users, store settings, server settings, troubleshoot, bugs",
          emoji: "🛠️",
        },
      ),
  );

  const close = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_hub_close")
      .setLabel("Close Menu")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Secondary),
  );

  return [selector as ActionRowBuilder, close as ActionRowBuilder];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;

  const member = await interaction.guild?.members.fetch(uid).catch(() => null);
  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const isBotAdmin = await isAdminUser(uid, gid);

  if (!isDiscordAdmin && !isBotAdmin) {
    await interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  const season = await getOrCreateActiveSeason(gid).catch(() => null);
  const wkStr = season ? weekLabel(season.currentWeek) : undefined;

  await interaction.reply({
    embeds: [buildAdminOpsEmbed(season?.seasonNumber ?? undefined, wkStr)],
    components: buildAdminOpsRows(),
    ephemeral: true,
  });
}
`;
  write(adminCmdPath, code);
  console.log('Updated src/commands/admin-operations.ts');
}

const SUBMENU_HELPERS = `

// ── Selector-based Commissioner's Office menus ───────────────────────────────
function adminBackRow(): ActionRowBuilder[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ao_hub_close").setLabel("Close Menu").setStyle(ButtonStyle.Secondary),
    ) as ActionRowBuilder,
  ];
}

function buildAdminDepartmentEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Commissioner's Office" })
    .setTimestamp();
}

function buildImportAdvanceComponents(): ActionRowBuilder[] {
  const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_import_advance_select")
      .setPlaceholder("Select an import or advance workflow")
      .addOptions(
        { label: "Import", value: "league_data", description: "Formerly League Data", emoji: "📥" },
        { label: "Advance Week", value: "advance_week", description: "Advance to the next week", emoji: "⏩" },
        { label: "Run Weekly Matchups", value: "run_weekly_matchups", description: "Create game channels, post matchups, then start GOTW", emoji: "🏈" },
        { label: "Set Week", value: "set_week", description: "Set the current week manually", emoji: "📅" },
        { label: "Set Season", value: "set_season", description: "Set the active season number", emoji: "🏆" },
      ),
  );
  return [select as ActionRowBuilder, ...adminBackRow()];
}

function buildManageEconomyComponents(): ActionRowBuilder[] {
  const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_manage_economy_select")
      .setPlaceholder("Select an economy workflow")
      .addOptions(
        { label: "Payouts", value: "payouts", description: "Open payout management", emoji: "💰" },
      ),
  );
  return [select as ActionRowBuilder, ...adminBackRow()];
}

function buildManageServerComponents(): ActionRowBuilder[] {
  const select = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_manage_server_select")
      .setPlaceholder("Select a server management workflow")
      .addOptions(
        { label: "User Data", value: "user_data", description: "Manage user economy, records, and team links", emoji: "👤" },
        { label: "Store Settings", value: "store_settings", description: "Manage store, archetypes, templates, prices, and caps", emoji: "🛒" },
        { label: "Server Settings", value: "server_settings", description: "Feature toggles, rules, admins, channels, and setup", emoji: "⚙️" },
        { label: "Troubleshoot", value: "troubleshoot", description: "Repair and maintenance tools", emoji: "🧰" },
        { label: "Report Bug", value: "report_bug", description: "Submit a bug report", emoji: "🐞" },
      ),
  );
  return [select as ActionRowBuilder, ...adminBackRow()];
}

async function handleAdminDepartmentSelect(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];

  if (value === "import_advance") {
    await interaction.update({
      embeds: [buildAdminDepartmentEmbed(
        "Commissioner's Office: Import/Advance",
        "Select a workflow below.\n\n" +
        "**Import** — league data import tools.\n" +
        "**Advance Week** — advance the active season week.\n" +
        "**Run Weekly Matchups** — create private game channels, post matchups, and start GOTW.\n" +
        "**Set Week / Set Season** — manually adjust league timing."
      )],
      components: buildImportAdvanceComponents(),
    });
    return true;
  }

  if (value === "manage_economy") {
    await interaction.update({
      embeds: [buildAdminDepartmentEmbed(
        "Commissioner's Office: Manage Economy",
        "Select an economy workflow below.\n\n**Payouts** opens the payout management hub."
      )],
      components: buildManageEconomyComponents(),
    });
    return true;
  }

  if (value === "manage_server") {
    await interaction.update({
      embeds: [buildAdminDepartmentEmbed(
        "Commissioner's Office: Manage Server",
        "Select a server management workflow below."
      )],
      components: buildManageServerComponents(),
    });
    return true;
  }

  return false;
}

async function handleImportAdvanceSelect(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];
  if (value === "league_data") return handleLeagueDataHub(interaction as any);
  if (value === "advance_week") return handleAdvanceWeek(interaction as any);
  if (value === "run_weekly_matchups") return handleRunWeeklyMatchups(interaction as any);
  if (value === "set_week") return handleSetWeek(interaction as any);
  if (value === "set_season") return handleSetSeasonNum(interaction as any);
  return false;
}

async function handleManageEconomySelect(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];
  if (value === "payouts") return handlePayoutsHub(interaction as any);
  return false;
}

async function handleManageServerSelect(interaction: StringSelectMenuInteraction) {
  const value = interaction.values[0];
  if (value === "user_data") return handleUserDataHub(interaction as any);
  if (value === "store_settings") return handleStoreSettingsHub(interaction as any);
  if (value === "server_settings") return handleServerSettingsHub(interaction as any);
  if (value === "troubleshoot") return handleTroubleshootHub(interaction as any);
  if (value === "report_bug") return handleReportBug(interaction as any);
  return false;
}

async function handleRunWeeklyMatchups(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  const guildId = interaction.guildId!;
  const season = await getOrCreateActiveSeason(guildId);
  const currWeek = parseInt(season.currentWeek ?? "1", 10);
  const defaultW = isNaN(currWeek) ? "1" : String(currWeek);

  const modal = new ModalBuilder()
    .setCustomId("ao_modal_run_weekly_matchups")
    .setTitle("Run Weekly Matchups");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("week_num")
        .setLabel("Week # (1-18, 19=Wild Card, 20-22=playoffs)")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(2)
        .setPlaceholder(defaultW)
        .setValue(defaultW),
    ),
  );

  await interaction.showModal(modal);
  return true;
}

async function handleRunWeeklyMatchupsModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const season = await getOrCreateActiveSeason(guildId);
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Could not access guild." });
    return true;
  }

  const raw = interaction.fields.getTextInputValue("week_num").trim();
  const weekNum = parseInt(raw, 10);
  if (isNaN(weekNum) || weekNum < 1 || weekNum > 22) {
    await interaction.editReply({ content: "❌ Invalid week number. Enter 1-18 for regular season, 19-22 for playoffs." });
    return true;
  }

  const playoffIndexMap: Record<number, number> = { 19: 1018, 20: 1019, 21: 1020, 22: 1022 };
  const weekIndex = weekNum <= 18 ? weekNum - 1 : (playoffIndexMap[weekNum] ?? -1);
  if (weekIndex === -1) {
    await interaction.editReply({ content: "❌ Could not resolve week index." });
    return true;
  }

  const playoffLabels: Record<number, string> = {
    19: "Wild Card",
    20: "Divisional Round",
    21: "Conference Championship",
    22: "Super Bowl",
  };
  const displayLabel = weekNum > 18
    ? `Season ${season.seasonNumber} — ${playoffLabels[weekNum] ?? `Playoff Wk ${weekNum}`}`
    : `Season ${season.seasonNumber} — Week ${weekNum}`;

  try {
    const schedSeasonId = await getScheduleSeasonId(guildId);
    const channelSummary = await createPrivateGameChannelsForWeek({
      guild,
      guildId,
      seasonId: season.id,
      seasonNumber: season.seasonNumber,
      scheduleSeasonId: schedSeasonId,
      weekIndex,
      displayLabel,
    });

    let matchupSummary = "";
    if (PLAYOFF_WEEK_META[season.currentWeek ?? ""]) {
      matchupSummary = await runPlayoffMatchupsFlow(
        interaction.client,
        season,
        (season.currentWeek ?? "") as keyof typeof PLAYOFF_WEEK_META,
        guildId,
      );
    } else {
      await runWeeklyMatchupsFlow({
        client: interaction.client,
        guild: interaction.guild,
        season,
        displayWeekNum: weekNum,
        payoutWeekIndex: null,
        guildId,
        replyFn: async ({ content, components }) => {
          await interaction.followUp({ content, components: components ?? [], ephemeral: true }).catch(() => {});
        },
      });
      matchupSummary = `Weekly matchup flow completed for ${displayLabel}.`;
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Weekly Matchups Complete")
          .setDescription(
            `**${displayLabel}**\n\n` +
            `Private Game Channels Created: **${channelSummary.created}**\n` +
            `H2H Games: **${channelSummary.h2hGames}**\n` +
            `Total Scheduled Games: **${channelSummary.totalGames}**\n\n` +
            matchupSummary
          ),
      ],
      components: adminBackRow(),
    });
  } catch (err) {
    console.error("[admin-operations] Run Weekly Matchups error:", err);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Red)
          .setTitle("❌ Weekly Matchups Failed")
          .setDescription(String(err)),
      ],
      components: adminBackRow(),
    });
  }

  return true;
}
`;

function patchHandler() {
  let src = read(handlerPath);
  backup(handlerPath, 'admin-menu-selector-v3');

  if (!src.includes('function adminBackRow()')) {
    const anchor = '// ── Main dispatch';
    if (!src.includes(anchor)) throw new Error('Could not find main dispatch anchor in admin-operations-handlers.ts');
    src = src.replace(anchor, SUBMENU_HELPERS + '\n' + anchor);
  }

  const dispatchInsert = `
  // ── Selector-based Commissioner's Office departments ───────────────────────
  if (id === "ao_admin_dept_select") { await handleAdminDepartmentSelect(interaction as StringSelectMenuInteraction); return true; }
  if (id === "ao_import_advance_select") { await handleImportAdvanceSelect(interaction as StringSelectMenuInteraction); return true; }
  if (id === "ao_manage_economy_select") { await handleManageEconomySelect(interaction as StringSelectMenuInteraction); return true; }
  if (id === "ao_manage_server_select") { await handleManageServerSelect(interaction as StringSelectMenuInteraction); return true; }
  if (id === "ao_run_weekly_matchups") { await handleRunWeeklyMatchups(interaction as ButtonInteraction); return true; }
  if (id === "ao_modal_run_weekly_matchups") { await handleRunWeeklyMatchupsModal(interaction as ModalSubmitInteraction); return true; }
`;

  if (!src.includes('ao_admin_dept_select')) {
    const anchor = '// ── Hub close';
    if (!src.includes(anchor)) throw new Error('Could not find hub close anchor in admin-operations-handlers.ts');
    src = src.replace(anchor, dispatchInsert + '\n  ' + anchor);
  }

  // Remove old media/historical/custom article from visible hub only; existing handlers can stay for backward compatibility.
  write(handlerPath, src);
  console.log('Patched src/lib/admin-operations-handlers.ts');
}

overwriteAdminCommand();
patchHandler();
console.log('Admin menu selector reorg v3 applied. Restart with: npm run dev');
