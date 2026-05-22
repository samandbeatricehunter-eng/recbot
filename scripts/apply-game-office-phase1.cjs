const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
  console.log(`patched ${file}`);
}

function patchOnce(text, search, replacement, label) {
  if (text.includes(replacement)) {
    console.log(`already patched: ${label}`);
    return text;
  }
  if (!text.includes(search)) {
    throw new Error(`Could not find patch target: ${label}`);
  }
  return text.replace(search, replacement);
}

function patchAdminOperations(root) {
  const file = path.join(root, 'src/lib/admin-operations-handlers.ts');
  let text = read(file);

  text = patchOnce(
    text,
    'import { runWeeklyMatchupsFlow } from "./weekly-matchups-runner.js";',
    'import { runWeeklyMatchupsFlow } from "./weekly-matchups-runner.js";\nimport { createPrivateGameChannelsForWeek } from "./game-channel-manager.js";',
    'admin-operations helper import',
  );

  const start = text.indexOf('async function handlePostGameChannelsModal(interaction: ModalSubmitInteraction)');
  const endMarker = '// ── Post Custom Article';
  const end = text.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error('Could not locate handlePostGameChannelsModal block.');
  }

  const replacement = `async function handlePostGameChannelsModal(interaction: ModalSubmitInteraction) {
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
    await interaction.editReply({
      content: "❌ Invalid week number. Enter 1–18 for regular season, 19–22 for playoffs.",
    });
    return;
  }

  const playoffIndexMap: Record<number, number> = {
    19: 1018,
    20: 1019,
    21: 1020,
    22: 1022,
  };

  const weekIndex = weekNum <= 18 ? weekNum - 1 : (playoffIndexMap[weekNum] ?? -1);

  if (weekIndex === -1) {
    await interaction.editReply({ content: "❌ Could not resolve week index." });
    return;
  }

  const isPlayoff = weekNum > 18;
  const playoffLabels: Record<number, string> = {
    19: "Wild Card",
    20: "Divisional Round",
    21: "Conference Championship",
    22: "Super Bowl",
  };

  const displayLabel = isPlayoff
    ? \`Season \${season.seasonNumber} — \${playoffLabels[weekNum] ?? \`Playoff Wk \${weekNum}\`}\`
    : \`Season \${season.seasonNumber} — Week \${weekNum}\`;

  const schedSeasonId = await getScheduleSeasonId(guildId);

  try {
    const summary = await createPrivateGameChannelsForWeek({
      guild,
      guildId,
      seasonId: season.id,
      seasonNumber: season.seasonNumber,
      scheduleSeasonId: schedSeasonId,
      weekIndex,
      displayLabel,
    });

    if (summary.totalGames === 0) {
      await interaction.editReply({
        content: \`❌ No schedule data found for **\${displayLabel}**. Import the schedule first using Admin Tools under /menu.\`,
      });
      return;
    }

    if (summary.h2hGames === 0) {
      await interaction.editReply({
        content: \`ℹ️ No H2H matchups found for **\${displayLabel}** — all \${summary.totalGames} game\${summary.totalGames !== 1 ? "s" : ""} are CPU matchups. No channels created.\`,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(summary.created > 0 ? Colors.Green : Colors.Blurple)
      .setTitle(\`Post Game Channels — \${displayLabel}\`)
      .setDescription(summary.results.length > 0 ? summary.results.join("\\n") : "No H2H games processed.")
      .addFields(
        { name: "Private Channels Created", value: String(summary.created), inline: true },
        { name: "H2H Games", value: String(summary.h2hGames), inline: true },
        { name: "Total Schedule", value: String(summary.totalGames), inline: true },
      )
      .setFooter({ text: "Channels are private to matchup users and the Commissioner role." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[admin-operations] Post Game Channels error:", err);
    await interaction.editReply({ content: \`❌ Failed to post game channels: \${err}\` });
  }
}

`;

  text = text.slice(0, start) + replacement + text.slice(end);
  write(file, text);
}

function patchSchema(root) {
  const file = path.join(root, 'src/schema/discord-economy.ts');
  let text = read(file);

  const start = text.indexOf('export const gameChannelsTable = pgTable("game_channels"');
  const endMarker = '// ── Trade Block:';
  const end = text.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    throw new Error('Could not locate gameChannelsTable block.');
  }

  const replacement = `export const gameChannelsTable = pgTable("game_channels", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id"),
  seasonId: integer("season_id").notNull(),
  activeSeasonId: integer("active_season_id"),
  weekIndex: integer("week_index").notNull(),
  scheduleGameId: text("schedule_game_id"),
  channelId: text("channel_id").notNull(),
  awayTeamName: text("away_team_name").notNull().default(""),
  homeTeamName: text("home_team_name").notNull().default(""),
  awayDiscordId: text("away_discord_id"),
  homeDiscordId: text("home_discord_id"),
  commissionerRoleId: text("commissioner_role_id"),
  panelMessageId: text("panel_message_id"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  channelIdx: uniqueIndex("game_channels_channel_id_idx").on(t.channelId),
}));

export const gameScheduleProposalsTable = pgTable("game_schedule_proposals", {
  id: serial("id").primaryKey(),
  gameChannelId: integer("game_channel_id").notNull(),
  proposerDiscordId: text("proposer_discord_id").notNull(),
  opponentDiscordId: text("opponent_discord_id").notNull(),
  proposedDate: text("proposed_date").notNull(),
  proposedTime: text("proposed_time").notNull(),
  timezone: text("timezone").notNull(),
  proposedAtUtc: timestamp("proposed_at_utc"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  parentProposalId: integer("parent_proposal_id"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const gameAdminRequestsTable = pgTable("game_admin_requests", {
  id: serial("id").primaryKey(),
  gameChannelId: integer("game_channel_id").notNull(),
  requesterDiscordId: text("requester_discord_id").notNull(),
  requestType: text("request_type").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  commissionerNotes: text("commissioner_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

`;

  text = text.slice(0, start) + replacement + text.slice(end);
  write(file, text);
}

function patchInteractionCreate(root) {
  const file = path.join(root, 'src/events/interactionCreate.ts');
  let text = read(file);

  text = patchOnce(
    text,
    'import { handleAdminOperationsInteraction } from "../lib/admin-operations-handlers.js";',
    'import { handleAdminOperationsInteraction } from "../lib/admin-operations-handlers.js";\nimport { handleGameOfficeInteraction } from "../lib/game-office-handlers.js";',
    'interactionCreate Game Office import',
  );

  text = text.replace(
    'startsWith("ac_");',
    'startsWith("ac_") || (interaction as any).customId.startsWith("go_");',
  );

  const goDispatch = `
  // ── Game Office — private matchup scheduling controls ─────────────────────
  if (action?.startsWith("go_")) {
    const handled = await handleGameOfficeInteraction(interaction as any);
    if (handled) return;
  }
`;

  const afterAoDispatch = `// ── Admin Operations hub — dispatch all ao_ prefixed interactions ───────────── if (action?.startsWith("ao_")) { const handled = await handleAdminOperationsInteraction(interaction); if (handled) return; }`;
  if (!text.includes('Game Office — private matchup scheduling controls')) {
    text = text.replace(afterAoDispatch, afterAoDispatch + goDispatch);
  } else {
    console.log('already patched: interactionCreate go dispatch');
  }

  write(file, text);
}

const root = process.cwd();
patchAdminOperations(root);
patchSchema(root);
patchInteractionCreate(root);
console.log('\nDone. Now run the SQL migration in sql/game-office-phase1.sql, then npm run dev.');
