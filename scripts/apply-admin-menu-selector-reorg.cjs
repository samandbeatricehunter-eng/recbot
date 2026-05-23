const fs = require('fs');
const path = require('path');

const root = process.cwd();
const adminCmdPath = path.join(root, 'src', 'commands', 'admin-operations.ts');
const handlerPath = path.join(root, 'src', 'lib', 'admin-operations-handlers.ts');

function mustRead(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
  return fs.readFileSync(p, 'utf8');
}
function backup(p) {
  const b = `${p}.bak-admin-selector-${Date.now()}`;
  fs.copyFileSync(p, b);
  console.log(`Backup created: ${path.relative(root, b)}`);
}
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); console.log(`Updated: ${path.relative(root, p)}`); }

function overwriteAdminCommand() {
  mustRead(adminCmdPath);
  backup(adminCmdPath);
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
  .setDescription("Commissioner's Office — manage imports, economy, server settings, and admin tools")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export function buildAdminOpsEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  const header = seasonNum != null && weekStr
    ? \`Season \${seasonNum} - \${weekStr}\n\n\`
    : "";

  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office")
    .setDescription(
      header +
      "Select an administrative department below.\n\n" +
      "**Import/Advance**\n" +
      "League imports, weekly advancement, matchup posting, week controls, and season controls.\n\n" +
      "**Manage Economy**\n" +
      "Payout tools and economy management workflows.\n\n" +
      "**Manage Server**\n" +
      "User data, store settings, server settings, troubleshooting, and bug reports."
    )
    .setFooter({ text: "Commissioner's Office • Selections expire after 15 minutes" })
    .setTimestamp();
}

export function buildAdminOpsRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_admin_main_select")
      .setPlaceholder("Select admin department")
      .addOptions(
        {
          label: "Import/Advance",
          value: "import_advance",
          description: "Imports, advance week, weekly matchup flow, week/season controls",
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
          description: "Users, store settings, server settings, troubleshooting, bug reports",
          emoji: "⚙️",
        },
      ),
  ) as ActionRowBuilder;

  const close = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_hub_close")
      .setLabel("Close Menu")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Secondary),
  ) as ActionRowBuilder;

  return [selector, close];
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
}

function patchHandlers() {
  let code = mustRead(handlerPath);
  backup(handlerPath);

  // Add reusable department submenu builders after session helper.
  if (!code.includes('function buildAdminImportAdvanceEmbed(')) {
    const anchor = 'function getAoSession(guildId: string, userId: string): AoSession {';
    const idx = code.indexOf(anchor);
    if (idx === -1) throw new Error('Could not find getAoSession anchor.');
    const endIdx = code.indexOf('// ── Shared helpers', idx);
    if (endIdx === -1) throw new Error('Could not find shared helpers anchor.');
    const insert = `

function buildAdminBackRow(): ActionRowBuilder[] {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
    ) as ActionRowBuilder,
  ];
}

function buildAdminImportAdvanceEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Import/Advance")
    .setDescription(
      "Select the workflow you want to run.\n\n" +
      "**Import** — League data import and MCA tools.\n" +
      "**Advance Week** — Advance the league week.\n" +
      "**Run Weekly Matchups** — Create game channels first, then post weekly matchups and GOTW.\n" +
      "**Set Week** — Manually set the current week.\n" +
      "**Set Season** — Manually set the active season number."
    );
}

function buildAdminImportAdvanceRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_import_advance_select")
      .setPlaceholder("Select Import/Advance workflow")
      .addOptions(
        { label: "Import", value: "league_data", description: "Formerly League Data", emoji: "📥" },
        { label: "Advance Week", value: "advance_week", description: "Advance week with league automation", emoji: "⏩" },
        { label: "Run Weekly Matchups", value: "run_weekly_matchups", description: "Create game channels, then post matchups/GOTW", emoji: "🏈" },
        { label: "Set Week", value: "set_week", description: "Manually change current week", emoji: "📅" },
        { label: "Set Season", value: "set_season", description: "Manually change active season", emoji: "🏆" },
      ),
  ) as ActionRowBuilder;
  return [selector, ...buildAdminBackRow()];
}

function buildAdminEconomyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Manage Economy")
    .setDescription("Select an economy workflow.\n\n**Payouts** — Open the payout management hub.");
}

function buildAdminEconomyRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_manage_economy_select")
      .setPlaceholder("Select economy workflow")
      .addOptions(
        { label: "Payouts", value: "payouts", description: "Open payout management hub", emoji: "💰" },
      ),
  ) as ActionRowBuilder;
  return [selector, ...buildAdminBackRow()];
}

function buildAdminServerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office: Manage Server")
    .setDescription(
      "Select a server management workflow.\n\n" +
      "**User Data** — Manage user economy, records, and links.\n" +
      "**Store Settings** — Archetypes, legends, prices, and caps.\n" +
      "**Server Settings** — Feature toggles, rules, admins, and setup.\n" +
      "**Troubleshoot** — Repair and maintenance tools.\n" +
      "**Report Bug** — Submit a bot issue."
    );
}

function buildAdminServerRows(): ActionRowBuilder[] {
  const selector = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ao_manage_server_select")
      .setPlaceholder("Select server workflow")
      .addOptions(
        { label: "User Data", value: "user_data", description: "User records, economy, and team links", emoji: "👤" },
        { label: "Store Settings", value: "store_settings", description: "Prices, caps, legends, archetypes", emoji: "🛒" },
        { label: "Server Settings", value: "server_settings", description: "Feature toggles, rules, admins, setup", emoji: "⚙️" },
        { label: "Troubleshoot", value: "troubleshoot", description: "Repair and maintenance tools", emoji: "🛠️" },
        { label: "Report Bug", value: "report_bug", description: "Submit a bug report", emoji: "🐛" },
      ),
  ) as ActionRowBuilder;
  return [selector, ...buildAdminBackRow()];
}
`;
    code = code.slice(0, endIdx) + insert + '\n' + code.slice(endIdx);
  }

  // Add dispatch cases near top after hub back block.
  if (!code.includes('id === "ao_admin_main_select"')) {
    const anchor = '// ── Set Week';
    const idx = code.indexOf(anchor);
    if (idx === -1) throw new Error('Could not find Set Week dispatch anchor.');
    const insert = `
  // ── Admin selector hub ─────────────────────────────────────────────────────
  if (id === "ao_admin_main_select") {
    const choice = (interaction as StringSelectMenuInteraction).values[0];
    if (choice === "import_advance") {
      await (interaction as StringSelectMenuInteraction).update({ embeds: [buildAdminImportAdvanceEmbed()], components: buildAdminImportAdvanceRows() });
      return true;
    }
    if (choice === "manage_economy") {
      await (interaction as StringSelectMenuInteraction).update({ embeds: [buildAdminEconomyEmbed()], components: buildAdminEconomyRows() });
      return true;
    }
    if (choice === "manage_server") {
      await (interaction as StringSelectMenuInteraction).update({ embeds: [buildAdminServerEmbed()], components: buildAdminServerRows() });
      return true;
    }
  }

  if (id === "ao_import_advance_select") {
    const choice = (interaction as StringSelectMenuInteraction).values[0];
    if (choice === "league_data") { await handleLeagueDataHub(interaction as any); return true; }
    if (choice === "advance_week") { await handleAdvanceWeek(interaction as any); return true; }
    if (choice === "run_weekly_matchups") { await handleRunWeeklyMatchups(interaction as any); return true; }
    if (choice === "set_week") { await handleSetWeek(interaction as any); return true; }
    if (choice === "set_season") { await handleSetSeasonNum(interaction as any); return true; }
  }

  if (id === "ao_manage_economy_select") {
    const choice = (interaction as StringSelectMenuInteraction).values[0];
    if (choice === "payouts") { await handlePayoutsHub(interaction as any); return true; }
  }

  if (id === "ao_manage_server_select") {
    const choice = (interaction as StringSelectMenuInteraction).values[0];
    if (choice === "user_data") { await handleUserDataHub(interaction as any); return true; }
    if (choice === "store_settings") { await handleStoreSettingsHub(interaction as any); return true; }
    if (choice === "server_settings") { await handleServerSettingsHub(interaction as any); return true; }
    if (choice === "troubleshoot") { await handleTroubleshootHub(interaction as any); return true; }
    if (choice === "report_bug") { await handleReportBug(interaction as any); return true; }
  }

  if (id === "ao_modal_run_weekly_matchups") { await handleRunWeeklyMatchupsModal(interaction as ModalSubmitInteraction); return true; }

`;
    code = code.slice(0, idx) + insert + code.slice(idx);
  }

  // Add Run Weekly Matchups handler functions before Post Custom Article section.
  if (!code.includes('async function handleRunWeeklyMatchups(')) {
    const anchor = '// ── Post Custom Article';
    const idx = code.indexOf(anchor);
    if (idx === -1) throw new Error('Could not find Post Custom Article anchor.');
    const insert = `
// ── Run Weekly Matchups combined flow ─────────────────────────────────────────
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
}

async function handleRunWeeklyMatchupsModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const season = await getOrCreateActiveSeason(guildId);
  const guild = interaction.guild;

  if (!guild) {
    await interaction.editReply({ content: "❌ Could not access guild." });
    return;
  }

  const raw = interaction.fields.getTextInputValue("week_num").trim();
  const weekNum = parseInt(raw, 10);

  if (isNaN(weekNum) || weekNum < 1 || weekNum > 22) {
    await interaction.editReply({ content: "❌ Invalid week number. Enter 1–18 for regular season, 19–22 for playoffs." });
    return;
  }

  const playoffIndexMap: Record<number, number> = { 19: 1018, 20: 1019, 21: 1020, 22: 1022 };
  const weekIndex = weekNum <= 18 ? weekNum - 1 : (playoffIndexMap[weekNum] ?? -1);

  if (weekIndex === -1) {
    await interaction.editReply({ content: "❌ Could not resolve week index." });
    return;
  }

  const playoffLabels: Record<number, string> = {
    19: "Wild Card",
    20: "Divisional Round",
    21: "Conference Championship",
    22: "Super Bowl",
  };

  const isPlayoff = weekNum > 18;
  const displayLabel = isPlayoff
    ? \`Season \${season.seasonNumber} — \${playoffLabels[weekNum] ?? "Playoffs"}\`
    : \`Season \${season.seasonNumber} — Week \${weekNum}\`;

  await interaction.editReply({ content: \`⏳ Running weekly matchup flow for **\${displayLabel}**. Creating private game channels first...\` });

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

    await interaction.editReply({
      content:
        \`✅ Private game channel step complete for **\${displayLabel}**.\n\` +
        \`Created: \${channelSummary.created} | H2H Games: \${channelSummary.h2hGames} | Total Schedule: \${channelSummary.totalGames}\n\n\` +
        "⏳ Posting matchups/GOTW flow now...",
    });

    const backRow = [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
      ) as ActionRowBuilder,
    ];

    if (PLAYOFF_WEEK_META[season.currentWeek ?? ""]) {
      const currentWeek = season.currentWeek ?? "";
      const summary = await runPlayoffMatchupsFlow(
        interaction.client,
        season,
        currentWeek as keyof typeof PLAYOFF_WEEK_META,
        guildId,
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle("✅ Weekly Matchups Complete")
            .setDescription(
              \`Private channels created first.\n\n\` +
              (summary || \`Playoff matchup flow completed for **\${weekLabel(currentWeek)}**.\`),
            ),
        ],
        components: backRow,
        content: "",
      });
      return;
    }

    const displayWeekNum = weekNum <= 18 ? weekNum : 1;

    await runWeeklyMatchupsFlow({
      client: interaction.client,
      guild,
      season,
      displayWeekNum,
      payoutWeekIndex: null,
      guildId,
      replyFn: async ({ content, components }) => {
        await interaction.followUp({ content, components: components ?? [], ephemeral: true }).catch(() => {});
      },
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ Weekly Matchups Complete")
          .setDescription(
            \`Private game channels were created first.\n\n\` +
            \`Matchups/GOTW flow completed for **\${displayLabel}**.\n\n\` +
            \`Created Channels: \${channelSummary.created}\n\` +
            \`H2H Games: \${channelSummary.h2hGames}\n\` +
            \`Total Schedule Games: \${channelSummary.totalGames}\`,
          ),
      ],
      components: backRow,
      content: "",
    });
  } catch (err) {
    console.error("[admin-operations] Run Weekly Matchups error:", err);
    await interaction.editReply({ content: \`❌ Run Weekly Matchups failed: \${err}\` });
  }
}

`;
    code = code.slice(0, idx) + insert + code.slice(idx);
  }

  write(handlerPath, code);
}

overwriteAdminCommand();
patchHandlers();
console.log('\nDone. Restart with: npm run dev');
