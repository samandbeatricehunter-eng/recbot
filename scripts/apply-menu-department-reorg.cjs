#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const root = findProjectRoot();
const backupDir = path.join(root, 'patch-backups', `menu-department-reorg-${Date.now()}`);
fs.mkdirSync(backupDir, { recursive: true });

function file(rel) { return path.join(root, rel); }
function backup(rel) {
  const src = file(rel);
  if (!fs.existsSync(src)) return;
  const dest = path.join(backupDir, rel.replace(/[\\/]/g, '__'));
  fs.copyFileSync(src, dest);
}
function write(rel, content) {
  const p = file(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  backup(rel);
  fs.writeFileSync(p, content, 'utf8');
  console.log(`Wrote ${rel}`);
}
function patch(rel, fn) {
  const p = file(rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}`);
  backup(rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) console.log(`No changes needed in ${rel}`);
  else {
    fs.writeFileSync(p, after, 'utf8');
    console.log(`Patched ${rel}`);
  }
}

const actionsTs = `import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import { getServerSettings } from "../lib/server-settings.js";
import type { ServerSettings } from "../lib/server-settings.js";

import {
  isAdminUser,
  getOrCreateUser,
  getOrCreateActiveSeason,
} from "../lib/db-helpers.js";

import { weekLabel } from "../lib/week-helpers.js";
import { REC_THEME } from "../lib/embeds.js";

export const data = new SlashCommandBuilder()
  .setName("menu")
  .setDescription("REC League Coaches Office");

export function buildActionsHubEmbed(
  settings: ServerSettings,
  isAdmin: boolean,
  seasonNum?: number,
  weekStr?: string,
  teamName?: string | null,
): EmbedBuilder {
  const teamLabel = teamName?.trim() ? teamName.trim() : "Unassigned";
  const adminLabel = isAdmin ? " - ADMIN" : "";

  const seasonHeader =
    seasonNum != null && weekStr
      ? \`Season \${seasonNum} - \${weekStr} - \${teamLabel}\${adminLabel}\`
      : \`REC League - \${teamLabel}\${adminLabel}\`;

  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("REC League: Coaches Office")
    .setDescription(
      \`\${seasonHeader}\\n\\n\` +
        "Welcome back, Coach. Select a department below to handle your business.\\n\\n" +
        "**GM's Office** — schedule, rosters, standings, and power rankings.\\n" +
        "**Financials** — store, bank, milestones, and wagers.\\n" +
        "**Media** — press conferences, headlines, transactions, and rivalries.\\n" +
        "**League Operations** — rules, reports, auto-pilot, teams, and commissioner tools."
    )
    .setImage("attachment://rec-embed-banner.png")
    .setFooter({
      text: "REC League Coaches Office • Menu expires after 15 minutes",
    });
}

export function buildActionsHubRows(
  settings: ServerSettings,
  isAdmin: boolean,
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const selectorRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ac_office_select")
      .setPlaceholder("Select a department")
      .addOptions(
        {
          label: "GM's Office",
          value: "gmoffice",
          description: "Schedule, rosters, standings, Season PR, and All-Time PR",
          emoji: "🏟️",
        },
        {
          label: "Financials",
          value: "financials",
          description: "Store, bank, milestones, and wagers",
          emoji: "💰",
        },
        {
          label: "Media",
          value: "media",
          description: "Press conferences, headlines, transactions, and rivalries",
          emoji: "🎙️",
        },
        {
          label: "League Operations",
          value: "league_operations",
          description: "Rules, reports, auto-pilot, teams, and commissioner tools",
          emoji: "🏛️",
        },
      ),
  );

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_close")
      .setLabel("Close Menu")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Secondary),
  );

  return [selectorRow, closeRow];
}

export function buildUnlinkedHubEmbed(
  seasonNum?: number,
  weekStr?: string,
): EmbedBuilder {
  const header = seasonNum != null && weekStr ? \`Season \${seasonNum} - \${weekStr}\\n\\n\` : "";

  return new EmbedBuilder()
    .setColor(REC_THEME.gold)
    .setTitle("REC League: Coaches Office")
    .setDescription(
      header +
        "You are not currently linked to a team.\\n\\n" +
        "Use League Operations to view open/user teams, or contact a commissioner to get linked."
    )
    .setImage("attachment://rec-embed-banner.png")
    .setFooter({ text: "Contact a commissioner to get linked to a team" });
}

export function buildUnlinkedHubRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const selectorRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ac_office_select")
      .setPlaceholder("Select a department")
      .addOptions(
        {
          label: "League Operations",
          value: "league_operations",
          description: "Rules, open teams, active teams, and reports",
          emoji: "🏛️",
        },
        {
          label: "GM's Office",
          value: "gmoffice",
          description: "Browse rosters, standings, and rankings",
          emoji: "🏟️",
        },
      ),
  );

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ac_close")
      .setLabel("Close Menu")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Secondary),
  );

  return [selectorRow, closeRow];
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const [settings, member, user, season] = await Promise.all([
    getServerSettings(gid),
    interaction.guild?.members.fetch(uid).catch(() => null),
    getOrCreateUser(uid, interaction.user.username, gid),
    getOrCreateActiveSeason(gid),
  ]);

  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const isDbAdmin = await isAdminUser(uid, gid);
  const isAdmin = isDiscordAdmin || isDbAdmin;

  const seasonNum = season.seasonNumber;
  const wkStr = weekLabel(season.currentWeek);

  const banner = new AttachmentBuilder("./assets/rec-embed-banner.png");

  if (!user.team && !isAdmin) {
    await interaction.editReply({
      embeds: [buildUnlinkedHubEmbed(seasonNum, wkStr)],
      components: buildUnlinkedHubRows(),
      files: [banner],
    });
    return;
  }

  await interaction.editReply({
    embeds: [buildActionsHubEmbed(settings, isAdmin, seasonNum, wkStr, user.team)],
    components: buildActionsHubRows(settings, isAdmin),
    files: [banner],
  });
}
`;

const routerTs = `import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from "discord.js";
import { db } from "@workspace/db";
import { usersTable, userSavingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isAdminUser, getOrCreateActiveSeason } from "./db-helpers.js";
import { weekLabel } from "./week-helpers.js";
import { handleActionsInteraction } from "./actions-handlers.js";
import { buildAdminOpsEmbed, buildAdminOpsRows } from "../commands/admin-operations.js";

type DepartmentInteraction = StringSelectMenuInteraction | ButtonInteraction;

function backRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Coaches Office").setStyle(ButtonStyle.Secondary),
  );
}

function deptSelect(customId: string, placeholder: string, options: Array<{ label: string; value: string; description: string; emoji?: string }>) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(...options),
  );
}

async function routeToExistingAction(interaction: StringSelectMenuInteraction, customId: string) {
  const proxied = new Proxy(interaction as any, {
    get(target, prop, receiver) {
      if (prop === "customId") return customId;
      if (prop === "isStringSelectMenu") return () => false;
      if (prop === "isButton") return () => true;
      return Reflect.get(target, prop, receiver);
    },
  });

  const handled = await handleActionsInteraction(proxied as any);
  if (!handled && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: "That menu option is not wired yet.", ephemeral: true });
  }
}

async function getFinancialSummary(discordId: string) {
  const walletRows = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.discordId, discordId));

  const savingsRows = await db
    .select({ balance: userSavingsTable.balance })
    .from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, discordId));

  const wallet = walletRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  const savings = savingsRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  return { wallet, savings, total: wallet + savings };
}

async function showGmOffice(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("GM's Office")
    .setDescription(
      "Manage the football side of your franchise.\n\n" +
      "**Schedule** — view your weekly matchup slate.\n" +
      "**All Rosters** — view any roster; free agents should be accessed from the roster workflow.\n" +
      "**Standings** — view league standings and playoff picture.\n" +
      "**Season PR** — current season power rankings.\n" +
      "**All-Time PR** — historical league power rankings."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_gm_select", "Select a GM's Office workflow", [
        { label: "Schedule", value: "ac_schedule", description: "View your schedule", emoji: "📅" },
        { label: "All Rosters", value: "ac_anyroster", description: "Browse rosters and free agents", emoji: "👥" },
        { label: "Standings", value: "ac_standings", description: "View standings", emoji: "📊" },
        { label: "Season PR", value: "ac_seasonpr", description: "View current season power rankings", emoji: "🥇" },
        { label: "All-Time PR", value: "ac_alltimepr", description: "View historical power rankings", emoji: "🏆" },
      ]),
      backRow(),
    ],
  });
}

async function showFinancials(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const summary = await getFinancialSummary(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Financials")
    .setDescription(
      "Manage your REC economy activity.\n\n" +
      ` + "`**Wallet:** ${summary.wallet.toLocaleString()} coins\n`" + ` +
      ` + "`**Savings:** ${summary.savings.toLocaleString()} coins\n`" + ` +
      ` + "`**Total Across Servers:** ${summary.total.toLocaleString()} coins\n\n`" + ` +
      "Weekly and EOS payout menus are set aside for now."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_financials_select", "Select a Financials workflow", [
        { label: "Store", value: "ac_purchase", description: "Purchase upgrades, legends, and custom options", emoji: "🛒" },
        { label: "Bank", value: "ac_coins", description: "Wallet, savings, transfers, and sending money", emoji: "🏦" },
        { label: "Milestones", value: "ac_milestonepayouts", description: "View milestone rewards", emoji: "🎯" },
        { label: "Wager", value: "ac_wager", description: "Create or manage wagers", emoji: "⚔️" },
      ]),
      backRow(),
    ],
  });
}

async function showMedia(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Media")
    .setDescription(
      "Control your team's public narrative.\n\n" +
      "**Call Press Conference** — request the interview workflow.\n" +
      "**Headlines** — league headline feed.\n" +
      "**League Transactions** — transaction activity.\n" +
      "**Rivalries** — rivalry tracking."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_media_select", "Select a Media workflow", [
        { label: "Call Press Conference", value: "ac_interview", description: "Open the interview workflow", emoji: "🎙️" },
        { label: "Headlines", value: "stub_headlines", description: "League headline feed", emoji: "📰" },
        { label: "League Transactions", value: "stub_transactions", description: "View league transactions", emoji: "🔁" },
        { label: "Rivalries", value: "stub_rivalries", description: "View rivalry activity", emoji: "🔥" },
      ]),
      backRow(),
    ],
  });
}

async function showLeagueOperations(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("League Operations")
    .setDescription(
      "Handle rules, reports, team availability, and commissioner operations.\n\n" +
      "Commissioner's Office is restricted to commissioners and Discord administrators."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_ops_select", "Select a League Operations workflow", [
        { label: "Rules", value: "ac_rules", description: "View league rules", emoji: "📕" },
        { label: "Report Violation", value: "ac_violation", description: "Report a user violating league rules", emoji: "🚨" },
        { label: "Request Auto-Pilot", value: "ac_autopilot", description: "Submit an auto-pilot request", emoji: "✈️" },
        { label: "Open Teams", value: "ac_openteams", description: "View open teams", emoji: "🔴" },
        { label: "Active/User Teams", value: "ac_activeteams", description: "View assigned user teams", emoji: "🟢" },
        { label: "Commissioner's Office", value: "admin_ops", description: "Open commissioner tools", emoji: "🛡️" },
      ]),
      backRow(),
    ],
  });
}

async function openCommissionersOffice(interaction: StringSelectMenuInteraction) {
  const gid = interaction.guildId!;
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const isDbAdmin = await isAdminUser(interaction.user.id, gid);

  if (!isDiscordAdmin && !isDbAdmin) {
    await interaction.update({ embeds: [], components: [], content: "❌ You are not a commissioner and cannot access the Commissioner's Office." });
    return;
  }

  const season = await getOrCreateActiveSeason(gid).catch(() => null);
  const wkStr = season ? weekLabel(season.currentWeek) : undefined;

  await interaction.update({
    content: undefined,
    embeds: [buildAdminOpsEmbed(season?.seasonNumber ?? undefined, wkStr)],
    components: buildAdminOpsRows(),
  });
}

async function showStub(interaction: StringSelectMenuInteraction, title: string) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle(title).setDescription("This workflow is staged for the department menu but is not wired yet.")],
    components: [backRow()],
  });
}

export async function handleMenuDepartmentInteraction(interaction: DepartmentInteraction): Promise<boolean> {
  const customId = (interaction as any).customId;
  if (!customId || !customId.startsWith("ac_")) return false;

  if (interaction.isButton() && customId === "ac_hub") return false;
  if (!interaction.isStringSelectMenu()) return false;

  const value = interaction.values[0];

  if (customId === "ac_office_select") {
    if (value === "gmoffice") { await showGmOffice(interaction); return true; }
    if (value === "financials") { await showFinancials(interaction); return true; }
    if (value === "media") { await showMedia(interaction); return true; }
    if (value === "league_operations") { await showLeagueOperations(interaction); return true; }
  }

  if (["ac_gm_select", "ac_financials_select", "ac_media_select", "ac_ops_select"].includes(customId)) {
    if (value === "admin_ops") { await openCommissionersOffice(interaction); return true; }
    if (value === "stub_headlines") { await showStub(interaction, "Headlines"); return true; }
    if (value === "stub_transactions") { await showStub(interaction, "League Transactions"); return true; }
    if (value === "stub_rivalries") { await showStub(interaction, "Rivalries"); return true; }
    if (value?.startsWith("ac_")) { await routeToExistingAction(interaction, value); return true; }
  }

  return false;
}
`;

write('src/commands/actions.ts', actionsTs);
write('src/lib/menu-department-router.ts', routerTs);

patch('src/events/interactionCreate.ts', (content) => {
  if (!content.includes('menu-department-router.js')) {
    const importLine = 'import { handleMenuDepartmentInteraction } from "../lib/menu-department-router.js"; ';
    const actionsImportRegex = /(import[^;]+actions-handlers\.js";\s*)/;
    if (actionsImportRegex.test(content)) {
      content = content.replace(actionsImportRegex, `$1${importLine}`);
    } else {
      content = importLine + content;
    }
  }

  const marker = 'if (interaction.isAutocomplete()) {';
  const routeBlock = 'if ((interaction.isStringSelectMenu() || interaction.isButton()) && typeof (interaction as any).customId === "string") { const handledMenuDepartment = await handleMenuDepartmentInteraction(interaction as any); if (handledMenuDepartment) return; } ';
  if (!content.includes('handledMenuDepartment')) {
    if (!content.includes(marker)) throw new Error('Could not find autocomplete marker in src/events/interactionCreate.ts');
    content = content.replace(marker, routeBlock + marker);
  }
  return content;
});

patch('src/index.ts', (content) => {
  content = content.replace(/import \* as adminOperations from "\.\/commands\/admin-operations\.js";\s*/g, '');
  content = content.replace(/,\s*adminOperations,\s*/g, ', ');
  content = content.replace(/\s*adminOperations,\s*/g, ' ');
  return content;
});

console.log('\nDone. Backups saved to: ' + backupDir);
console.log('Next steps:');
console.log('1) npm run dev');
console.log('2) Run /menu and test each department selector.');
console.log("3) Commissioner's Office is now accessed through League Operations only.");
