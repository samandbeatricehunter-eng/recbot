const fs = require('fs');
const path = require('path');

function findRoot() {
  let dir = process.cwd();
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error('Run this from inside the recbot project.');
}
const root = findRoot();
function backupAndWrite(rel, content) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) fs.writeFileSync(p + '.bak-ns-buttons-' + Date.now(), fs.readFileSync(p, 'utf8'), 'utf8');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  console.log('Wrote', rel);
}
function patch(rel, fn) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { console.warn('Missing', rel); return; }
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(p + '.bak-ns-route-' + Date.now(), before, 'utf8');
    fs.writeFileSync(p, after, 'utf8');
    console.log('Patched', rel);
  } else console.log('No changes needed for', rel);
}

const handler = String.raw`import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function setupIsCompleted(guildId: string): Promise<boolean> {
  try {
    const rows = await db.execute(sql.raw("select setup_completed from server_settings where guild_id = '" + guildId.replace(/'/g, "''") + "' limit 1"));
    return Boolean((rows as any).rows?.[0]?.setup_completed);
  } catch (err) {
    console.warn("[new-server-setup] setupIsCompleted check failed; treating as incomplete", err);
    return false;
  }
}

export async function userCanRunNewServerSetup(interaction: ChatInputCommandInteraction | any): Promise<boolean> {
  const member = interaction.member;
  return Boolean(member?.permissions?.has?.(PermissionFlagsBits.Administrator));
}

async function ensureServerSettings(guildId: string) {
  await db.execute(sql`
    insert into server_settings (guild_id)
    values (${guildId})
    on conflict (guild_id) do nothing
  `);
}

export function buildNewServerSetupIntro(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("REC League: New Server Setup")
    .setDescription(
      "This one-time setup initializes the server for REC League operations.\n\n" +
      "**Step 1:** Select up to 6 commissioners.\n" +
      "**Step 2:** Review/edit league rules.\n" +
      "**Step 3:** Set current season, week, and advance cadence.\n\n" +
      "Use Discord’s user selector below. It supports searching large servers and is not limited to 25 preloaded options."
    );
}

export function buildNewServerSetupRows(): ActionRowBuilder<any>[] {
  const commissioners = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("ns_commissioners_select")
      .setPlaceholder("Select 1–6 commissioners")
      .setMinValues(1)
      .setMaxValues(6),
  );

  const actions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ns_edit_rules")
      .setLabel("Review/Edit Rules")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ns_league_settings")
      .setLabel("Set Season / Week / Advance")
      .setStyle(ButtonStyle.Primary),
  );

  return [commissioners, actions];
}

function setupProgressEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("REC League: New Server Setup")
    .setDescription(message);
}

function buildRulesModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ns_rules_modal")
    .setTitle("REC League Rules");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rules_text")
        .setLabel("Rules text / notes")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(4000)
        .setPlaceholder("Paste or summarize your league rules here. You can refine this later."),
    ),
  );

  return modal;
}

function buildSettingsModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId("ns_settings_modal")
    .setTitle("Season / Week / Advance");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("season_number")
        .setLabel("Current Season #")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("1"),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("current_week")
        .setLabel("Current Week")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("week_1, week_2, wild_card, divisional, etc."),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("advance_hours")
        .setLabel("Advance cadence in hours")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder("24, 48, 72, 96, or custom number"),
    ),
  );

  return modal;
}

export async function handleNewServerSetupInteraction(interaction: any): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId || !customId.startsWith("ns_")) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "This setup can only be used in a server.", ephemeral: true }).catch(() => {});
    return true;
  }

  const isAdmin = Boolean(interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));
  if (!isAdmin) {
    await interaction.reply({ content: "❌ Only Discord server administrators can use new server setup.", ephemeral: true }).catch(() => {});
    return true;
  }

  // IMPORTANT: for modal-opening buttons, do not perform DB writes before showModal.
  // Discord requires modal responses quickly, and slow DB checks can make the interaction fail.
  if (customId === "ns_edit_rules" && interaction.isButton?.()) {
    await interaction.showModal(buildRulesModal());
    return true;
  }

  if (customId === "ns_league_settings" && interaction.isButton?.()) {
    await interaction.showModal(buildSettingsModal());
    return true;
  }

  const completed = await setupIsCompleted(interaction.guildId);
  if (completed) {
    await interaction.reply({ content: "✅ New server setup has already been completed for this server.", ephemeral: true }).catch(() => {});
    return true;
  }

  await ensureServerSettings(interaction.guildId);

  if (customId === "ns_commissioners_select" && interaction.isUserSelectMenu?.()) {
    const ids = interaction.values.slice(0, 6);
    const idsArray = "{" + ids.join(",") + "}";

    await db.execute(sql`
      insert into new_server_setups (guild_id, started_by, commissioner_ids, status)
      values (${interaction.guildId}, ${interaction.user.id}, ${idsArray}::text[], 'commissioners_selected')
      on conflict (guild_id) do update set
        commissioner_ids = excluded.commissioner_ids,
        started_by = excluded.started_by,
        status = 'commissioners_selected',
        updated_at = now()
    `);

    for (const discordId of ids) {
      await db.execute(sql`
        insert into league_commissioners (guild_id, discord_id, role, created_by)
        values (${interaction.guildId}, ${discordId}, 'commissioner', ${interaction.user.id})
        on conflict (guild_id, discord_id) do nothing
      `);
      await db.execute(sql`
        insert into league_members (guild_id, discord_id, role, is_commissioner)
        values (${interaction.guildId}, ${discordId}, 'commissioner', true)
        on conflict (guild_id, discord_id) do update set
          role = 'commissioner',
          is_commissioner = true,
          updated_at = now()
      `);
    }

    await interaction.update({
      embeds: [setupProgressEmbed("✅ Commissioners saved.\n\nNext: review/edit rules, then set season/week/advance cadence.")],
      components: buildNewServerSetupRows(),
    });
    return true;
  }

  if (customId === "ns_rules_modal" && interaction.isModalSubmit?.()) {
    const rulesText = interaction.fields.getTextInputValue("rules_text") ?? "";
    await ensureServerSettings(interaction.guildId);
    await db.execute(sql`update server_settings set rules_text = ${rulesText}, updated_at = now() where guild_id = ${interaction.guildId}`);
    await db.execute(sql`
      insert into new_server_setups (guild_id, started_by, rules_text, status)
      values (${interaction.guildId}, ${interaction.user.id}, ${rulesText}, 'rules_saved')
      on conflict (guild_id) do update set rules_text = excluded.rules_text, status = 'rules_saved', updated_at = now()
    `);
    await interaction.reply({ content: "✅ Rules saved. Continue with Season / Week / Advance settings.", ephemeral: true });
    return true;
  }

  if (customId === "ns_settings_modal" && interaction.isModalSubmit?.()) {
    const seasonNumber = Number(interaction.fields.getTextInputValue("season_number"));
    const currentWeek = interaction.fields.getTextInputValue("current_week").trim();
    const advanceHours = Number(interaction.fields.getTextInputValue("advance_hours"));

    if (!Number.isFinite(seasonNumber) || seasonNumber < 1 || !Number.isFinite(advanceHours) || advanceHours < 1 || !currentWeek) {
      await interaction.reply({ content: "❌ Invalid setup values. Season and advance hours must be numbers, and current week cannot be blank.", ephemeral: true });
      return true;
    }

    await ensureServerSettings(interaction.guildId);
    await db.execute(sql`update seasons set is_active = false where guild_id = ${interaction.guildId}`);
    await db.execute(sql`insert into seasons (guild_id, season_number, is_active, current_week) values (${interaction.guildId}, ${seasonNumber}, true, ${currentWeek})`);
    await db.execute(sql`
      update server_settings
      set setup_completed = true,
          setup_completed_at = now(),
          setup_completed_by = ${interaction.user.id},
          advance_hours = ${advanceHours},
          updated_at = now()
      where guild_id = ${interaction.guildId}
    `);
    await db.execute(sql`
      insert into new_server_setups (guild_id, started_by, completed_by, season_number, current_week, advance_hours, status, completed_at)
      values (${interaction.guildId}, ${interaction.user.id}, ${interaction.user.id}, ${seasonNumber}, ${currentWeek}, ${advanceHours}, 'completed', now())
      on conflict (guild_id) do update set
        completed_by = excluded.completed_by,
        season_number = excluded.season_number,
        current_week = excluded.current_week,
        advance_hours = excluded.advance_hours,
        status = 'completed',
        completed_at = now(),
        updated_at = now()
    `);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("✅ REC Server Setup Complete")
          .setDescription("Commissioners, rules, season, week, and advance cadence are now initialized. Next: import league data, then use Commissioner’s Office → Manage Server → User Data to link teams/users if needed."),
      ],
      ephemeral: true,
    });
    return true;
  }

  return false;
}
`;
backupAndWrite('src/lib/new-server-setup-handlers.ts', handler);

patch('src/events/interactionCreate.ts', (s) => {
  if (!s.includes('new-server-setup-handlers.js')) {
    const importLine = 'import { handleNewServerSetupInteraction } from "../lib/new-server-setup-handlers.js";\n';
    s = importLine + s;
  }
  if (!s.includes('handleNewServerSetupInteraction(interaction as any)')) {
    const marker = 'export async function execute(interaction:';
    const idx = s.indexOf(marker);
    if (idx === -1) return s;
    const braceIdx = s.indexOf('{', idx);
    if (braceIdx === -1) return s;
    const insert = '\n  if (("customId" in interaction) && typeof (interaction as any).customId === "string" && (interaction as any).customId.startsWith("ns_")) {\n    const handled = await handleNewServerSetupInteraction(interaction as any);\n    if (handled) return;\n  }\n';
    return s.slice(0, braceIdx + 1) + insert + s.slice(braceIdx + 1);
  }
  return s;
});

console.log('\nApplied new server setup button/modal fix.');
console.log('Restart with: npm run dev');
