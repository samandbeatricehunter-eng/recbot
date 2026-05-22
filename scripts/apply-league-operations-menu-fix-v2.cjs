const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const root = findProjectRoot();
const eventsPath = path.join(root, 'src', 'events', 'interactionCreate.ts');
const handlerPath = path.join(root, 'src', 'lib', 'league-operations-menu.ts');

if (!fs.existsSync(eventsPath)) {
  console.error('Could not find src/events/interactionCreate.ts from', root);
  process.exit(1);
}

function backup(file) {
  const b = file + '.bak-league-operations-v2-' + Date.now();
  fs.copyFileSync(file, b);
  console.log('Backup created:', path.relative(root, b));
}

const handlerCode = `import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
} from "discord.js";
import { isAdminUser, getOrCreateActiveSeason } from "./db-helpers.js";
import { weekLabel } from "./week-helpers.js";
import { buildAdminOpsEmbed, buildAdminOpsRows } from "../commands/admin-operations.js";
import { buildActionsHubEmbed, buildActionsHubRows } from "../commands/actions.js";
import { getServerSettings } from "./server-settings.js";
import { getOrCreateUser } from "./db-helpers.js";

export type LeagueOpsInteraction = ButtonInteraction | StringSelectMenuInteraction;

function buildLeagueOperationsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("League Operations")
    .setDescription(
      "Manage league rules, conduct reports, Auto-Pilot requests, team availability, and commissioner tools."
    )
    .setFooter({ text: "REC League Operations • Use Back to return to Coaches Office" });
}

function buildLeagueOperationsRows(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_rules")
      .setLabel("Rules")
      .setEmoji("📕")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ac_violation")
      .setLabel("Report Violation")
      .setEmoji("🚨")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ac_autopilot")
      .setLabel("Request Auto-Pilot")
      .setEmoji("✈️")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_openteams")
      .setLabel("Open Teams")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ac_activeteams")
      .setLabel("Active/User Teams")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ac_commissioner_office")
      .setLabel("Commissioner's Office")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Primary),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_league_ops_back")
      .setLabel("Back to Coaches Office")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ac_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2, row3];
}

async function canUseCommissionerOffice(interaction: LeagueOpsInteraction): Promise<boolean> {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;
  const member = await interaction.guild?.members.fetch(uid).catch(() => null);
  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const hasCommissionerRole = member?.roles.cache.some((role) => role.name === "Commissioner") ?? false;
  const isDbAdmin = await isAdminUser(uid, gid);
  return isDiscordAdmin || hasCommissionerRole || isDbAdmin;
}

export async function handleLeagueOperationsMenuInteraction(interaction: LeagueOpsInteraction): Promise<boolean> {
  const id = interaction.customId;

  if (interaction.isStringSelectMenu() && id === "ac_office_select") {
    const selected = interaction.values[0];
    if (selected !== "league_operations") return false;

    await interaction.update({
      embeds: [buildLeagueOperationsEmbed()],
      components: buildLeagueOperationsRows(),
    });
    return true;
  }

  if (id === "ac_league_ops_back") {
    const gid = interaction.guildId!;
    const uid = interaction.user.id;
    const [settings, user, season, member] = await Promise.all([
      getServerSettings(gid),
      getOrCreateUser(uid, interaction.user.username, gid),
      getOrCreateActiveSeason(gid),
      interaction.guild?.members.fetch(uid).catch(() => null),
    ]);
    const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
    const isDbAdmin = await isAdminUser(uid, gid);
    const isAdmin = isDiscordAdmin || isDbAdmin;
    const wkStr = weekLabel(season.currentWeek);

    await interaction.update({
      embeds: [buildActionsHubEmbed(settings, isAdmin, season.seasonNumber, wkStr, user.team)],
      components: buildActionsHubRows(settings, isAdmin),
    });
    return true;
  }

  if (id === "ac_commissioner_office") {
    const allowed = await canUseCommissionerOffice(interaction);
    if (!allowed) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.DarkGrey)
            .setTitle("Menu Closed")
            .setDescription("Commissioner's Office access denied."),
        ],
        components: [],
      });
      await interaction.followUp({
        content: "❌ You are not a commissioner and cannot access the Commissioner's Office.",
        ephemeral: true,
      });
      return true;
    }

    const season = await getOrCreateActiveSeason(interaction.guildId!).catch(() => null);
    const wkStr = season ? weekLabel(season.currentWeek) : undefined;
    await interaction.update({
      embeds: [buildAdminOpsEmbed(season?.seasonNumber ?? undefined, wkStr)],
      components: buildAdminOpsRows(),
    });
    return true;
  }

  return false;
}
`;

fs.writeFileSync(handlerPath, handlerCode, 'utf8');
console.log('Wrote:', path.relative(root, handlerPath));

backup(eventsPath);
let src = fs.readFileSync(eventsPath, 'utf8');

// Add import.
if (!src.includes('handleLeagueOperationsMenuInteraction')) {
  const marker = 'import { handleAdminOperationsInteraction } from "../lib/admin-operations-handlers.js";';
  if (src.includes(marker)) {
    src = src.replace(marker, marker + '\nimport { handleLeagueOperationsMenuInteraction } from "../lib/league-operations-menu.js";');
  } else {
    const importEnd = src.lastIndexOf('import ');
    src = 'import { handleLeagueOperationsMenuInteraction } from "../lib/league-operations-menu.js";\n' + src;
  }
}

// Patch handleButton: intercept ac_commissioner_office and ac_league_ops_back before generic ac_ routing.
if (!src.includes('league-ops button intercept')) {
  const target = '// ── Actions hub — dispatch all ac_ prefixed interactions';
  const insert = `// ── League Operations / Commissioner Office intercept ─────────────────────\n  // league-ops button intercept\n  if (interaction.customId === "ac_commissioner_office" || interaction.customId === "ac_league_ops_back") {\n    const handled = await handleLeagueOperationsMenuInteraction(interaction);\n    if (handled) return;\n  }\n\n  `;
  if (src.includes(target)) {
    src = src.replace(target, insert + target);
  } else {
    const generic = 'if (action?.startsWith("ac_")) {';
    if (src.includes(generic)) src = src.replace(generic, insert + generic);
    else console.warn('Could not find ac_ button dispatch anchor; button intercept not inserted.');
  }
}

// Patch handleSelectMenu: intercept ac_office_select league_operations before generic ac_ routing.
if (!src.includes('league-ops select intercept')) {
  const selectInsert = `\n  // ── League Operations selector intercept ─────────────────────────────────\n  // league-ops select intercept\n  if (interaction.customId === "ac_office_select" && interaction.values?.[0] === "league_operations") {\n    const handled = await handleLeagueOperationsMenuInteraction(interaction);\n    if (handled) return;\n  }\n`;

  const functionRegex = /(async function handleSelectMenu\s*\(\s*interaction:\s*StringSelectMenuInteraction\s*\)\s*\{)/;
  if (functionRegex.test(src)) {
    src = src.replace(functionRegex, `$1${selectInsert}`);
  } else {
    const genericSelectAc = 'if (action?.startsWith("ac_")) {';
    const idx = src.indexOf(genericSelectAc, src.indexOf('handleSelectMenu'));
    if (idx !== -1) {
      src = src.slice(0, idx) + selectInsert + src.slice(idx);
    } else {
      console.warn('Could not find handleSelectMenu anchor; select intercept not inserted.');
    }
  }
}

fs.writeFileSync(eventsPath, src, 'utf8');
console.log('Patched:', path.relative(root, eventsPath));
console.log('\nDone. Restart with: npm run dev');
