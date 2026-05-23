#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const root = findProjectRoot();
console.log('Project root:', root);

function file(...parts) {
  return path.join(root, ...parts);
}

function mustRead(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function writeBackup(p) {
  const backup = `${p}.bak-admin-selector-${Date.now()}`;
  fs.copyFileSync(p, backup);
  console.log('Backup created:', path.relative(root, backup));
}

function patchAdminOperationsCommand() {
  const p = file('src', 'commands', 'admin-operations.ts');
  let s = mustRead(p);
  writeBackup(p);

  // Add StringSelectMenuBuilder import if needed.
  s = s.replace(/(ButtonStyle,\s*)/m, '$1StringSelectMenuBuilder, ');
  if (!s.includes('StringSelectMenuBuilder')) {
    s = s.replace(/from "discord\.js";/, ', StringSelectMenuBuilder } from "discord.js";');
  }

  // Replace old button-row builder bodies by injecting new helper builders before execute.
  if (!s.includes('buildAdminMenuSelectorRows')) {
    const insert = String.raw`

function buildAdminMenuSelectorRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_department_select")
      .setPlaceholder("Select admin department")
      .addOptions(
        {
          label: "Import/Advance",
          value: "import_advance",
          description: "Import data, advance week, set week/season, run weekly matchups",
          emoji: "📥",
        },
        {
          label: "Manage Economy",
          value: "manage_economy",
          description: "Payouts and economy workflows",
          emoji: "💰",
        },
        {
          label: "Manage Server",
          value: "manage_server",
          description: "Users, store settings, server settings, troubleshooting, bug reports",
          emoji: "🛠️",
        },
      ),
  );

  const close = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Secondary),
  );

  return [selector, close];
}
`;
    s = s.replace(/(export async function execute\s*\()/, insert + '\n$1');
  }

  // Replace likely components call with selector rows. Conservative replacement.
  s = s.replace(/components:\s*buildAdminMenuRows\([^\)]*\)/g, 'components: buildAdminMenuSelectorRows()');
  s = s.replace(/components:\s*rows/g, 'components: buildAdminMenuSelectorRows()');

  fs.writeFileSync(p, s);
  console.log('Patched:', path.relative(root, p));
}

function patchAdminOperationsHandlers() {
  const p = file('src', 'lib', 'admin-operations-handlers.ts');
  let s = mustRead(p);
  writeBackup(p);

  const needsStringSelectImport = !s.includes('StringSelectMenuBuilder');
  if (needsStringSelectImport) {
    s = s.replace(/(ButtonStyle,\s*)/m, '$1StringSelectMenuBuilder, ');
  }

  if (!s.includes('buildImportAdvanceMenuRows')) {
    const helper = String.raw`

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
`;
    // Put helpers near top after imports.
    s = s.replace(/(import[^;]+;\s*)+/s, (m) => m + helper);
  }

  // Add selector handling near dispatcher. Try to inject after function entry if exists.
  if (!s.includes('ao_admin_department_select')) {
    console.log('WARNING: helper insertion failed unexpectedly.');
  }

  const dispatcherNeedle = /export async function handleAdminOperationsInteraction\s*\([^)]*\)\s*\{/;
  const dispatchBlock = String.raw`

  const customId = "customId" in interaction ? interaction.customId : undefined;

  if (customId === "ao_admin_root") {
    await showAdminRootMenu(interaction);
    return;
  }

  if (interaction.isStringSelectMenu?.() && customId === "ao_admin_department_select") {
    const value = interaction.values[0];
    if (value === "import_advance") {
      await showAdminDepartmentMenu(interaction, "Commissioner's Office: Import/Advance", "Select an import or advance workflow.", buildImportAdvanceMenuRows());
      return;
    }
    if (value === "manage_economy") {
      await showAdminDepartmentMenu(interaction, "Commissioner's Office: Manage Economy", "Select an economy workflow.", buildManageEconomyMenuRows());
      return;
    }
    if (value === "manage_server") {
      await showAdminDepartmentMenu(interaction, "Commissioner's Office: Manage Server", "Select a server workflow.", buildManageServerMenuRows());
      return;
    }
  }

  if (interaction.isStringSelectMenu?.() && customId === "ao_import_advance_select") {
    const value = interaction.values[0];
    const map: Record<string, string> = {
      league_data: "ao_leaguedata",
      advance_week: "ao_advanceweek",
      run_weekly_matchups: "ao_postgamechannels",
      set_week: "ao_setweek",
      set_season: "ao_setseason",
    };
    (interaction as any).customId = map[value] ?? customId;
  }

  if (interaction.isStringSelectMenu?.() && customId === "ao_manage_economy_select") {
    const value = interaction.values[0];
    const map: Record<string, string> = { payouts: "ao_payouts" };
    (interaction as any).customId = map[value] ?? customId;
  }

  if (interaction.isStringSelectMenu?.() && customId === "ao_manage_server_select") {
    const value = interaction.values[0];
    const map: Record<string, string> = {
      user_data: "ao_userdata",
      store_settings: "ao_storesettings",
      server_settings: "ao_serversettings",
      troubleshoot: "ao_troubleshoot",
      report_bug: "ao_reportbug",
    };
    (interaction as any).customId = map[value] ?? customId;
  }
`;

  if (!s.includes('ao_import_advance_select') || !s.includes('run_weekly_matchups')) {
    throw new Error('Helper block was not inserted correctly.');
  }

  if (!s.includes('const customId = "customId" in interaction ? interaction.customId : undefined;')) {
    s = s.replace(dispatcherNeedle, (m) => m + dispatchBlock);
  }

  // Remove references/options for deleted workflows if present in labels. Conservative cosmetic cleanup.
  s = s.replace(/Post Custom Article/g, '');
  s = s.replace(/Rerun Media Cycle/g, '');
  s = s.replace(/Rerun Season Historical/g, '');

  fs.writeFileSync(p, s);
  console.log('Patched:', path.relative(root, p));
}

try {
  patchAdminOperationsCommand();
  patchAdminOperationsHandlers();
  console.log('Admin menu selector reorg v2 patch complete.');
} catch (err) {
  console.error(err);
  process.exit(1);
}
