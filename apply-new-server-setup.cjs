const fs = require("fs");
const path = require("path");

function rootDir() {
  let dir = process.cwd();
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "src"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("Run this from inside the recbot project.");
}
const root = rootDir();
function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("Wrote", rel);
}
function patch(rel, mutator) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error("Missing file: " + rel);
  const before = fs.readFileSync(p, "utf8");
  const after = mutator(before);
  if (after !== before) {
    fs.writeFileSync(p + ".bak-new-server-setup-" + Date.now(), before, "utf8");
    fs.writeFileSync(p, after, "utf8");
    console.log("Patched", rel);
  } else {
    console.log("No changes needed for", rel);
  }
}

write("src/commands/new-server-setup.ts", String.raw`import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { buildNewServerSetupIntro, buildNewServerSetupRows, userCanRunNewServerSetup, setupIsCompleted } from "../lib/new-server-setup-handlers.js";

export const data = new SlashCommandBuilder()
  .setName("new-server-setup")
  .setDescription("One-time REC League server initialization")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ content: "This command can only be used inside a server.", ephemeral: true });
    return;
  }

  const allowed = await userCanRunNewServerSetup(interaction);
  if (!allowed) {
    await interaction.reply({ content: "❌ Only Discord server administrators can run /new-server-setup.", ephemeral: true });
    return;
  }

  const completed = await setupIsCompleted(interaction.guildId);
  if (completed) {
    await interaction.reply({
      content: "✅ This server has already completed REC setup. Use /menu → League Operations → Commissioner’s Office for future changes.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildNewServerSetupIntro()],
    components: buildNewServerSetupRows(),
    ephemeral: true,
  });
}
`);

write("src/lib/new-server-setup-handlers.ts", String.raw) `import {
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
  const rows = await db.execute(sql`
  select setup_completed
  from server_settings
  where guild_id = ${guildId}
  limit 1
`);
  return Boolean((rows as any).rows?.[0]?.setup_completed);
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
    new ButtonBuilder().setCustomId("ns_edit_rules").setLabel("Review/Edit Rules").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ns_league_settings").setLabel("Set Season / Week / Advance").setStyle(ButtonStyle.Primary),
  );
  return [commissioners, actions];
}

function setupProgressEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xB68B2D).setTitle("REC League: New Server Setup").setDescription(message);
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

  if (customId === "ns_edit_rules" && interaction.isButton?.()) {
    const modal = new ModalBuilder().setCustomId("ns_rules_modal").setTitle("REC League Rules");
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
    await interaction.showModal(modal);
    return true;
  }

  if (customId === "ns_league_settings" && interaction.isButton?.()) {
    const modal = new ModalBuilder().setCustomId("ns_settings_modal").setTitle("Season / Week / Advance");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("season_number").setLabel("Current Season #").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("1")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("current_week").setLabel("Current Week").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("week_1, week_2, wild_card, divisional, etc.")),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("advance_hours").setLabel("Advance cadence in hours").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("24, 48, 72, 96, or custom number")),
    );
    await interaction.showModal(modal);
    return true;
  }

  if (customId === "ns_rules_modal" && interaction.isModalSubmit?.()) {
    const rulesText = interaction.fields.getTextInputValue("rules_text") ?? "";
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

    await db.execute(sql`update seasons set is_active = false where guild_id = ${interaction.guildId}`);
    await db.execute(sql`insert into seasons (guild_id, season_number, is_active, current_week) values (${interaction.guildId}, ${seasonNumber}, true, ${currentWeek})`);
    await db.execute(sql`
      update server_settings
      set setup_completed = true, setup_completed_at = now(), setup_completed_by = ${interaction.user.id}, advance_hours = ${advanceHours}, updated_at = now()
      where guild_id = ${interaction.guildId}
    `);
    await db.execute(sql`
      insert into new_server_setups (guild_id, started_by, completed_by, season_number, current_week, advance_hours, status, completed_at)
      values (${interaction.guildId}, ${interaction.user.id}, ${interaction.user.id}, ${seasonNumber}, ${currentWeek}, ${advanceHours}, 'completed', now())
      on conflict (guild_id) do update set completed_by = excluded.completed_by, season_number = excluded.season_number, current_week = excluded.current_week, advance_hours = excluded.advance_hours, status = 'completed', completed_at = now(), updated_at = now()
    `);

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ REC Server Setup Complete").setDescription("Commissioners, rules, season, week, and advance cadence are now initialized. Next: import league data, then use Commissioner’s Office → Manage Server → User Data to link teams/users if needed.")],
      ephemeral: true,
    });
    return true;
  }

  return false;
}
`);

patch("src/lib/command-list.ts", (s) => {
  if (!s.includes("new-server-setup.js")) {
    s = s.replace('import * as actions from "../commands/actions.js";', 'import * as actions from "../commands/actions.js"; import * as newServerSetup from "../commands/new-server-setup.js";');
    s = s.replace('actions,', 'actions, newServerSetup,');
  }
  return s;
});

patch("src/deploy-commands.ts", (s) => s.replace('const allowed = new Set(["menu"]);', 'const allowed = new Set(["menu", "new-server-setup"]);'));

patch("src/index.ts", (s) => {
  if (!s.includes('commands/new-server-setup.js')) {
    s = s.replace('import * as actions from "./commands/actions.js";', 'import * as actions from "./commands/actions.js"; import * as newServerSetup from "./commands/new-server-setup.js";');
    s = s.replace('actions, h2hrecord, globalrecords,', 'actions, newServerSetup, h2hrecord, globalrecords,');
  }
  return s;
});

patch("src/events/interactionCreate.ts", (s) => {
  if (!s.includes('new-server-setup-handlers.js')) {
    s = s.replace('import { handleGameOfficeInteraction } from "../lib/game-office-handlers.js";', 'import { handleGameOfficeInteraction } from "../lib/game-office-handlers.js"; import { handleNewServerSetupInteraction } from "../lib/new-server-setup-handlers.js";');
  }
  if (!s.includes('handleNewServerSetupInteraction(interaction as any)')) {
    const marker = 'if (interaction.isAutocomplete()) {';
    const insert = 'if (("customId" in interaction) && typeof (interaction as any).customId === "string" && (interaction as any).customId.startsWith("ns_")) { const handled = await handleNewServerSetupInteraction(interaction as any); if (handled) return; } ';
    s = s.replace(marker, insert + marker);
  }
  return s;
});

console.log("\nNew server setup patch applied.");
console.log("1) Run SQL: 001_new_server_setup_tables.sql in Supabase.");
console.log("2) Run: npm run register");
console.log("3) Run: npm run dev");
