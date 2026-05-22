#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function projectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function backup(file) {
  const bak = file + '.bak-league-operations-' + Date.now();
  fs.copyFileSync(file, bak);
  console.log('Backup created:', path.relative(projectRoot(), bak));
}

const root = projectRoot();
const actionsHandlersPath = path.join(root, 'src', 'lib', 'actions-handlers.ts');

if (!fs.existsSync(actionsHandlersPath)) {
  console.error('Could not find src/lib/actions-handlers.ts from:', root);
  process.exit(1);
}

let src = read(actionsHandlersPath);
backup(actionsHandlersPath);

// 1) Add admin ops import if missing.
if (!src.includes('../commands/admin-operations.js')) {
  const actionsImportRe = /import \{ buildActionsHubEmbed, buildActionsHubRows, buildUnlinkedHubEmbed, buildUnlinkedHubRows \} from "\.\.\/commands\/actions\.js";\s*/;
  if (!actionsImportRe.test(src)) {
    console.error('Could not find actions command import. No changes applied.');
    process.exit(1);
  }
  src = src.replace(actionsImportRe, (m) => m + 'import { buildAdminOpsEmbed, buildAdminOpsRows } from "../commands/admin-operations.js";\n');
}

// 2) Add League Operations helpers.
const helperMarker = '// REC_LEAGUE_OPERATIONS_HELPERS_START';
if (!src.includes(helperMarker)) {
  const helper = [
    helperMarker,
    'function buildLeagueOperationsEmbed(): EmbedBuilder {',
    '  return new EmbedBuilder()',
    '    .setColor(0xB68B2D)',
    '    .setTitle("League Operations")',
    '    .setDescription(',
    '      "Use the controls below for league rules, reports, team status, auto-pilot requests, and commissioner tools.\\n\\n" +',
    '      "**Rules** — View league rules.\\n" +',
    '      "**Report Violation** — Report a gameplay or conduct violation.\\n" +',
    '      "**Auto-Pilot** — Request opponent auto-pilot review.\\n" +',
    '      "**Open Teams** — View available franchises.\\n" +',
    '      "**User Teams** — View currently assigned teams.\\n" +',
    '      "**Commissioner\'s Office** — Commissioner/admin tools only."',
    '    );',
    '}',
    '',
    'function buildLeagueOperationsRows(): ActionRowBuilder<ButtonBuilder>[] {',
    '  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(',
    '    new ButtonBuilder().setCustomId("ac_rules").setLabel("Rules").setStyle(ButtonStyle.Secondary),',
    '    new ButtonBuilder().setCustomId("ac_violation").setLabel("Report Violation").setStyle(ButtonStyle.Danger),',
    '    new ButtonBuilder().setCustomId("ac_autopilot").setLabel("Request Auto-Pilot").setStyle(ButtonStyle.Secondary),',
    '  );',
    '',
    '  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(',
    '    new ButtonBuilder().setCustomId("ac_openteams").setLabel("Open Teams").setStyle(ButtonStyle.Secondary),',
    '    new ButtonBuilder().setCustomId("ac_activeteams").setLabel("User Teams").setStyle(ButtonStyle.Secondary),',
    '    new ButtonBuilder().setCustomId("ac_commissioners_office").setLabel("Commissioner\'s Office").setStyle(ButtonStyle.Primary),',
    '  );',
    '',
    '  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(',
    '    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Coaches Office").setStyle(ButtonStyle.Secondary),',
    '    new ButtonBuilder().setCustomId("ac_close").setLabel("Close").setStyle(ButtonStyle.Danger),',
    '  );',
    '',
    '  return [row1, row2, row3];',
    '}',
    '// REC_LEAGUE_OPERATIONS_HELPERS_END',
    ''
  ].join('\n');

  const insertAfter = 'function cancelRow(): ActionRowBuilder { return new ActionRowBuilder().addComponents( new ButtonBuilder().setCustomId("ac_hub").setLabel("✖ Cancel").setStyle(ButtonStyle.Secondary), ); }';
  if (src.includes(insertAfter)) {
    src = src.replace(insertAfter, insertAfter + '\n\n' + helper);
  } else {
    // Fallback: insert before roster constants.
    const fallbackMarker = '// ── Roster card / player-card constants';
    if (!src.includes(fallbackMarker)) {
      console.error('Could not find a safe helper insertion point. No changes applied.');
      process.exit(1);
    }
    src = src.replace(fallbackMarker, helper + '\n' + fallbackMarker);
  }
}

// 3) Add dispatch logic near the top of handleActionsInteraction.
const dispatchMarker = '// REC_LEAGUE_OPERATIONS_DISPATCH_START';
if (!src.includes(dispatchMarker)) {
  const dispatch = [
    dispatchMarker,
    '  // League Operations department from /menu selector.',
    '  if (interaction.isStringSelectMenu?.() && id === "ac_office_select") {',
    '    const selected = (interaction as StringSelectMenuInteraction).values?.[0];',
    '    if (selected === "league_operations") {',
    '      await (interaction as StringSelectMenuInteraction).update({',
    '        embeds: [buildLeagueOperationsEmbed()],',
    '        components: buildLeagueOperationsRows(),',
    '      });',
    '      return true;',
    '    }',
    '  }',
    '',
    '  if (id === "ac_league_operations") {',
    '    await (interaction as ButtonInteraction).update({',
    '      embeds: [buildLeagueOperationsEmbed()],',
    '      components: buildLeagueOperationsRows(),',
    '    });',
    '    return true;',
    '  }',
    '',
    '  if (id === "ac_commissioners_office") {',
    '    const member = await interaction.guild?.members.fetch(userId).catch(() => null);',
    '    const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;',
    '    const isDbAdmin = await isAdminUser(userId, guildId);',
    '    if (!isDiscordAdmin && !isDbAdmin) {',
    '      await (interaction as ButtonInteraction).update({',
    '        embeds: [',
    '          new EmbedBuilder()',
    '            .setColor(Colors.Red)',
    '            .setTitle("Commissioner\'s Office")',
    '            .setDescription("You are not a commissioner and cannot access this office."),',
    '        ],',
    '        components: [],',
    '      });',
    '      return true;',
    '    }',
    '',
    '    const season = await getOrCreateActiveSeason(guildId).catch(() => null);',
    '    const wkStr = season ? weekLabel(season.currentWeek) : undefined;',
    '    await (interaction as ButtonInteraction).update({',
    '      embeds: [buildAdminOpsEmbed(season?.seasonNumber ?? undefined, wkStr)],',
    '      components: buildAdminOpsRows() as any,',
    '    });',
    '    return true;',
    '  }',
    dispatchMarker.replace('START','END')
  ].join('\n');

  const anchor = 'const sess = getSession(guildId, userId);';
  if (!src.includes(anchor)) {
    console.error('Could not find handleActionsInteraction session anchor. No changes applied.');
    process.exit(1);
  }
  src = src.replace(anchor, anchor + '\n\n' + dispatch);
}

write(actionsHandlersPath, src);
console.log('Patched src/lib/actions-handlers.ts');
console.log('Next: npm run dev');
