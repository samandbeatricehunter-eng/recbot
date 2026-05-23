const fs = require('fs');
const path = require('path');

function rootDir() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Run this from the recbot project root or a folder inside it.');
}

const ROOT = rootDir();
const adminCmdPath = path.join(ROOT, 'src', 'commands', 'admin-operations.ts');
const handlerPath = path.join(ROOT, 'src', 'lib', 'admin-operations-handlers.ts');

function backup(file) {
  const dest = file + '.bak-admin-selector-v4-' + Date.now();
  fs.copyFileSync(file, dest);
  console.log('Backup created:', path.relative(ROOT, dest));
}

const adminOperationsTs = `import {
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
  .setDescription("Commissioner's Office — manage league operations")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function seasonHeader(seasonNum?: number, weekStr?: string): string {
  return seasonNum != null && weekStr ? "Season " + seasonNum + " - " + weekStr + "\\n\\n" : "";
}

export function buildAdminOpsEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office")
    .setDescription(
      seasonHeader(seasonNum, weekStr) +
      "Select an administrative department below.\\n\\n" +
      "**Import/Advance**\\nLeague data import, advance week, weekly matchups, set week, and set season.\\n\\n" +
      "**Manage Economy**\\nPayout tools and economy management.\\n\\n" +
      "**Manage Server**\\nUser data, store settings, server settings, troubleshooting, and bug reports."
    )
    .setFooter({ text: "Commissioner's Office • selections expire after 15 minutes" })
    .setTimestamp();
}

export function buildAdminOpsRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_main_select")
      .setPlaceholder("Select an admin department")
      .addOptions(
        {
          label: "Import/Advance",
          value: "import_advance",
          description: "Import league data, advance, set week/season, weekly matchups",
          emoji: "📥",
        },
        {
          label: "Manage Economy",
          value: "manage_economy",
          description: "Payouts and economy tools",
          emoji: "💰",
        },
        {
          label: "Manage Server",
          value: "manage_server",
          description: "Users, store/server settings, troubleshoot, bug reports",
          emoji: "⚙️",
        },
      ),
  );

  const close = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_hub_close")
      .setLabel("Close Menu")
      .setStyle(ButtonStyle.Danger),
  );

  return [selector as ActionRowBuilder, close as ActionRowBuilder];
}

export function buildAdminImportAdvanceEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Import/Advance")
    .setDescription(
      seasonHeader(seasonNum, weekStr) +
      "Choose the import or weekly operations workflow to run.\\n\\n" +
      "**Import** — formerly League Data.\\n" +
      "**Advance Week** — advances the active week.\\n" +
      "**Run Weekly Matchups** — creates private game channels, then posts matchups/GOTW.\\n" +
      "**Set Week** — manually set current week.\\n" +
      "**Set Season** — manually set active season number."
    );
}

export function buildAdminImportAdvanceRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_import_advance_select")
      .setPlaceholder("Select Import/Advance action")
      .addOptions(
        { label: "Import", value: "import", description: "League data import tools", emoji: "📥" },
        { label: "Advance Week", value: "advance_week", description: "Advance the active league week", emoji: "⏩" },
        { label: "Run Weekly Matchups", value: "run_weekly_matchups", description: "Create game channels, then post matchups/GOTW", emoji: "🏈" },
        { label: "Set Week", value: "set_week", description: "Manually set the current week", emoji: "📅" },
        { label: "Set Season", value: "set_season", description: "Manually set active season number", emoji: "🏆" },
      ),
  );
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("Back").setStyle(ButtonStyle.Secondary),
  );
  return [selector as ActionRowBuilder, back as ActionRowBuilder];
}

export function buildAdminEconomyEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Manage Economy")
    .setDescription(seasonHeader(seasonNum, weekStr) + "Choose an economy workflow.");
}

export function buildAdminEconomyRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_economy_select")
      .setPlaceholder("Select economy action")
      .addOptions({ label: "Payouts", value: "payouts", description: "Open payout management hub", emoji: "💰" }),
  );
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("Back").setStyle(ButtonStyle.Secondary),
  );
  return [selector as ActionRowBuilder, back as ActionRowBuilder];
}

export function buildAdminServerEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Manage Server")
    .setDescription(seasonHeader(seasonNum, weekStr) + "Choose a server management workflow.");
}

export function buildAdminServerRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_server_select")
      .setPlaceholder("Select server action")
      .addOptions(
        { label: "User Data", value: "user_data", description: "Manage user links, economy, and records", emoji: "👤" },
        { label: "Store Settings", value: "store_settings", description: "Prices, caps, archetypes, and templates", emoji: "🏪" },
        { label: "Server Settings", value: "server_settings", description: "Feature toggles, rules, admins, server setup", emoji: "⚙️" },
        { label: "Troubleshoot", value: "troubleshoot", description: "Repair and maintenance tools", emoji: "🛠️" },
        { label: "Report Bug", value: "report_bug", description: "Send a bot bug report", emoji: "🐞" },
      ),
  );
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("Back").setStyle(ButtonStyle.Secondary),
  );
  return [selector as ActionRowBuilder, back as ActionRowBuilder];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;

  const member = await interaction.guild?.members.fetch(uid).catch(() => null);
  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const isBotAdmin = await isAdminUser(uid, gid);

  if (!isDiscordAdmin && !isBotAdmin) {
    await interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });
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

function overwriteAdminCommand() {
  if (!fs.existsSync(adminCmdPath)) throw new Error('Missing ' + adminCmdPath);
  backup(adminCmdPath);
  fs.writeFileSync(adminCmdPath, adminOperationsTs, 'utf8');
  console.log('Updated', path.relative(ROOT, adminCmdPath));
}

function patchHandlers() {
  if (!fs.existsSync(handlerPath)) throw new Error('Missing ' + handlerPath);
  backup(handlerPath);
  let s = fs.readFileSync(handlerPath, 'utf8');

  const oldImport = 'import { buildAdminOpsEmbed, buildAdminOpsRows } from "../commands/admin-operations.js";';
  const newImport = 'import { buildAdminOpsEmbed, buildAdminOpsRows, buildAdminImportAdvanceEmbed, buildAdminImportAdvanceRows, buildAdminEconomyEmbed, buildAdminEconomyRows, buildAdminServerEmbed, buildAdminServerRows } from "../commands/admin-operations.js";';
  if (s.includes(oldImport)) s = s.replace(oldImport, newImport);
  else if (!s.includes('buildAdminImportAdvanceEmbed')) console.warn('Warning: admin-operations import anchor not found.');

  if (!s.includes('async function handleAdminMainSelect')) {
    const helper = `
// ── Selector-based admin hub routing ─────────────────────────────────────────
async function getActiveSeasonDisplay(guildId: string) {
  const season = await getOrCreateActiveSeason(guildId).catch(() => null);
  const wkStr = season ? weekLabel(season.currentWeek) : undefined;
  return { season, wkStr };
}

async function handleAdminMainSelect(interaction: StringSelectMenuInteraction) {
  const guildId = interaction.guildId!;
  const selected = interaction.values[0];
  const { season, wkStr } = await getActiveSeasonDisplay(guildId);

  if (selected === "import_advance") {
    await interaction.update({
      embeds: [buildAdminImportAdvanceEmbed(season?.seasonNumber ?? undefined, wkStr)],
      components: buildAdminImportAdvanceRows(),
    });
    return;
  }

  if (selected === "manage_economy") {
    await interaction.update({
      embeds: [buildAdminEconomyEmbed(season?.seasonNumber ?? undefined, wkStr)],
      components: buildAdminEconomyRows(),
    });
    return;
  }

  if (selected === "manage_server") {
    await interaction.update({
      embeds: [buildAdminServerEmbed(season?.seasonNumber ?? undefined, wkStr)],
      components: buildAdminServerRows(),
    });
    return;
  }

  await interaction.reply({ content: "Unknown admin department.", ephemeral: true });
}

async function handleAdminImportAdvanceSelect(interaction: StringSelectMenuInteraction) {
  const selected = interaction.values[0];

  if (selected === "import") return handleLeagueDataHub(interaction as any);
  if (selected === "advance_week") return handleAdvanceWeek(interaction as any);
  if (selected === "set_week") return handleSetWeek(interaction as any);
  if (selected === "set_season") return handleSetSeasonNum(interaction as any);
  if (selected === "run_weekly_matchups") return handleRunWeeklyMatchups(interaction);

  await interaction.reply({ content: "Unknown Import/Advance action.", ephemeral: true });
}

async function handleAdminEconomySelect(interaction: StringSelectMenuInteraction) {
  const selected = interaction.values[0];
  if (selected === "payouts") return handlePayoutsHub(interaction as any);
  await interaction.reply({ content: "Unknown economy action.", ephemeral: true });
}

async function handleAdminServerSelect(interaction: StringSelectMenuInteraction) {
  const selected = interaction.values[0];
  if (selected === "user_data") return handleUserDataHub(interaction as any);
  if (selected === "store_settings") return handleStoreSettingsHub(interaction as any);
  if (selected === "server_settings") return handleServerSettingsHub(interaction as any);
  if (selected === "troubleshoot") return handleTroubleshootHub(interaction as any);
  if (selected === "report_bug") return handleReportBug(interaction as any);
  await interaction.reply({ content: "Unknown server action.", ephemeral: true });
}

async function handleRunWeeklyMatchups(interaction: StringSelectMenuInteraction) {
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
        .setLabel("Week # to run")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(2)
        .setPlaceholder(defaultW)
        .setValue(defaultW),
    ),
  );

  await interaction.showModal(modal);
}

async function handleRunWeeklyMatchupsModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "❌ Could not access guild." });
    return;
  }

  const raw = interaction.fields.getTextInputValue("week_num").trim();
  const weekNum = parseInt(raw, 10);
  if (isNaN(weekNum) || weekNum < 1 || weekNum > 22) {
    await interaction.editReply({ content: "❌ Invalid week number. Use 1-22." });
    return;
  }

  const season = await getOrCreateActiveSeason(guildId);
  const scheduleSeasonId = await getScheduleSeasonId(guildId);
  const displayLabel = weekLabel(String(weekNum));

  await interaction.editReply({ content: "Running weekly matchup workflow: creating game channels first, then posting matchups/GOTW..." });

  let channelSummary = "";
  try {
    const result = await createPrivateGameChannelsForWeek({
      guild,
      guildId,
      seasonId: Number(season.id),
      seasonNumber: Number(season.seasonNumber ?? 1),
      scheduleSeasonId,
      weekIndex: weekNum,
      displayLabel,
    });
    channelSummary = "Game channels: " + result.created + " created / " + result.h2hGames + " H2H games.";
  } catch (err) {
    console.error("[admin-operations] Run Weekly Matchups channel creation error:", err);
    channelSummary = "Game channel step failed: " + String(err);
  }

  try {
    await runWeeklyMatchupsFlow({
      client: interaction.client,
      guild,
      season,
      displayWeekNum: weekNum,
      payoutWeekIndex: null,
      guildId,
      replyFn: async ({ content, components }) => {
        await interaction.followUp({ content, components: components ?? [], ephemeral: true }).catch(() => {});
      },
    });

    await interaction.editReply({
      content: "✅ Run Weekly Matchups completed.\\n" + channelSummary,
    });
  } catch (err) {
    console.error("[admin-operations] Run Weekly Matchups post error:", err);
    await interaction.editReply({
      content: "⚠️ Game channel step finished, but matchup/GOTW posting failed.\\n" + channelSummary + "\\nError: " + String(err),
    });
  }
}
`;
    const anchor = '// ── Payouts Hub';
    if (s.includes(anchor)) s = s.replace(anchor, helper + '\n' + anchor);
    else s += '\n' + helper;
  }

  if (!s.includes('id === "ao_admin_main_select"')) {
    const dispatch = `
  // ── Selector-based admin hub routing ───────────────────────────────────────
  if (id === "ao_admin_main_select") {
    await handleAdminMainSelect(interaction as StringSelectMenuInteraction);
    return true;
  }
  if (id === "ao_admin_import_advance_select") {
    await handleAdminImportAdvanceSelect(interaction as StringSelectMenuInteraction);
    return true;
  }
  if (id === "ao_admin_economy_select") {
    await handleAdminEconomySelect(interaction as StringSelectMenuInteraction);
    return true;
  }
  if (id === "ao_admin_server_select") {
    await handleAdminServerSelect(interaction as StringSelectMenuInteraction);
    return true;
  }
  if (id === "ao_modal_run_weekly_matchups") {
    await handleRunWeeklyMatchupsModal(interaction as ModalSubmitInteraction);
    return true;
  }
`;
    const anchor = '  // ── Set Week';
    if (s.includes(anchor)) s = s.replace(anchor, dispatch + '\n' + anchor);
    else throw new Error('Could not find dispatch insertion anchor in admin-operations-handlers.ts');
  }

  fs.writeFileSync(handlerPath, s, 'utf8');
  console.log('Patched', path.relative(ROOT, handlerPath));
}

overwriteAdminCommand();
patchHandlers();
console.log('Done. Run: npm run dev');
