import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { WEEK_SEQUENCE, weekLabel } from "./week-helpers.js";

const SETUP_WEEK_OPTIONS = WEEK_SEQUENCE.filter((w) => w !== "offseason").slice(0, 25);

type SetupState = {
  commissionerIds?: string[];
  seasonNumber?: number | null;
  currentWeek?: string | null;
  advanceHours?: number | null;
};

export async function setupIsCompleted(guildId: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT setup_completed
    FROM server_settings
    WHERE guild_id = ${guildId}
    LIMIT 1
  `);
  return Boolean((result as any).rows?.[0]?.setup_completed);
}

export async function userCanRunNewServerSetup(interaction: ChatInputCommandInteraction | any): Promise<boolean> {
  return Boolean(interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));
}

async function ensureServerSettings(guildId: string) {
  await db.execute(sql`
    INSERT INTO server_settings (guild_id)
    VALUES (${guildId})
    ON CONFLICT (guild_id) DO NOTHING
  `);
}

async function ensureSetupRow(guildId: string, userId: string) {
  await db.execute(sql`
    INSERT INTO new_server_setups (guild_id, started_by, status)
    VALUES (${guildId}, ${userId}, 'started')
    ON CONFLICT (guild_id) DO NOTHING
  `);
}

async function getSetupState(guildId: string): Promise<SetupState> {
  const result = await db.execute(sql`
    SELECT commissioner_ids, season_number, current_week, advance_hours
    FROM new_server_setups
    WHERE guild_id = ${guildId}
    LIMIT 1
  `);
  const row = (result as any).rows?.[0] ?? {};
  return {
    commissionerIds: Array.isArray(row.commissioner_ids) ? row.commissioner_ids : [],
    seasonNumber: row.season_number == null ? 1 : Number(row.season_number),
    currentWeek: row.current_week ?? null,
    advanceHours: row.advance_hours == null ? null : Number(row.advance_hours),
  };
}

export function buildNewServerSetupIntro(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xb68b2d)
    .setTitle("REC League: New Server Setup")
    .setDescription([
      "This one-time setup initializes the server for REC League operations.",
      "",
      "**Step 1:** Select up to 6 commissioners.",
      "**Step 2:** Review/Edit rules using the structured rules manager.",
      "**Step 3:** Set season, week, and advance cadence.",
      "",
      "The commissioner selector supports searching large servers and is not limited to 25 preloaded users.",
    ].join("\n"));
}

export function buildNewServerSetupRows(): ActionRowBuilder<any>[] {
  const commissioners = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId("ns_commissioners_select")
      .setPlaceholder("Select 1-6 commissioners")
      .setMinValues(1)
      .setMaxValues(6),
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_rules")
      .setLabel("Review/Edit Rules")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ns_league_settings")
      .setLabel("Set Season / Week / Advance")
      .setStyle(ButtonStyle.Primary),
  );

  return [commissioners, buttons];
}

function progressEmbed(text: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xb68b2d).setTitle("REC League: New Server Setup").setDescription(text);
}

function buildSettingsEmbed(state: SetupState): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xb68b2d)
    .setTitle("REC League: Season Setup")
    .setDescription([
      "Set the active league season, current week, and advance cadence.",
      "",
      "**Season:** " + String(state.seasonNumber ?? 1),
      "**Week:** " + (state.currentWeek ? weekLabel(state.currentWeek) : "Not selected"),
      "**Advance:** " + (state.advanceHours ? String(state.advanceHours) + " hours" : "Not selected"),
      "",
      "Season is limited to whole numbers from 1 to 9.",
    ].join("\n"));
}

function buildSettingsRows(state: SetupState): ActionRowBuilder<any>[] {
  const season = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ns_season_select")
      .setPlaceholder("Season: " + String(state.seasonNumber ?? 1))
      .addOptions(Array.from({ length: 9 }, (_, i) => {
        const n = i + 1;
        return { label: "Season " + n, value: String(n), description: "Set active season to " + n, default: (state.seasonNumber ?? 1) === n };
      })),
  );

  const week = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ns_week_select")
      .setPlaceholder(state.currentWeek ? "Week: " + weekLabel(state.currentWeek) : "Select current week")
      .addOptions(SETUP_WEEK_OPTIONS.map((w) => ({ label: weekLabel(w), value: w, default: state.currentWeek === w }))),
  );

  const advance = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ns_advance_select")
      .setPlaceholder(state.advanceHours ? "Advance: " + state.advanceHours + " hours" : "Select advance cadence")
      .addOptions([
        { label: "24 Hours", value: "24", default: state.advanceHours === 24 },
        { label: "48 Hours", value: "48", default: state.advanceHours === 48 },
        { label: "72 Hours", value: "72", default: state.advanceHours === 72 },
        { label: "96 Hours", value: "96", default: state.advanceHours === 96 },
        { label: "Other / Custom", value: "custom", description: "Enter a custom number of hours" },
      ]),
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ns_setup_back").setLabel("Back to Setup").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ns_complete_setup").setLabel("Complete Setup").setStyle(ButtonStyle.Success),
  );

  return [season, week, advance, buttons];
}

async function updateSetupValue(guildId: string, userId: string, patch: { seasonNumber?: number; currentWeek?: string; advanceHours?: number }) {
  await ensureServerSettings(guildId);
  await ensureSetupRow(guildId, userId);
  if (patch.seasonNumber != null) {
    await db.execute(sql`UPDATE new_server_setups SET season_number = ${patch.seasonNumber}, updated_at = NOW() WHERE guild_id = ${guildId}`);
  }
  if (patch.currentWeek != null) {
    await db.execute(sql`UPDATE new_server_setups SET current_week = ${patch.currentWeek}, updated_at = NOW() WHERE guild_id = ${guildId}`);
  }
  if (patch.advanceHours != null) {
    await db.execute(sql`UPDATE new_server_setups SET advance_hours = ${patch.advanceHours}, updated_at = NOW() WHERE guild_id = ${guildId}`);
  }
}

async function showSettingsPanel(interaction: any) {
  const state = await getSetupState(interaction.guildId);
  await interaction.update({ embeds: [buildSettingsEmbed(state)], components: buildSettingsRows(state) });
}

export async function handleNewServerSetupInteraction(interaction: any): Promise<boolean> {
  const customId = interaction.customId;
  if (!customId?.startsWith?.("ns_")) return false;

  if (!interaction.guildId) {
    await interaction.reply({ content: "This setup can only be used inside a server.", ephemeral: true });
    return true;
  }

  const isAdmin = Boolean(interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator));
  if (!isAdmin) {
    await interaction.reply({ content: "❌ Only Discord server administrators can use this setup.", ephemeral: true });
    return true;
  }

  await ensureServerSettings(interaction.guildId);

  if (customId === "ns_setup_back" && interaction.isButton()) {
    await interaction.update({ embeds: [buildNewServerSetupIntro()], components: buildNewServerSetupRows() });
    return true;
  }

  if (customId === "ns_commissioners_select" && interaction.isUserSelectMenu()) {
    const ids = interaction.values.slice(0, 6);
    const idsArray = "{" + ids.join(",") + "}";
    await ensureSetupRow(interaction.guildId, interaction.user.id);
    await db.execute(sql`
      UPDATE new_server_setups
      SET commissioner_ids = ${idsArray}::text[], started_by = ${interaction.user.id}, status = 'commissioners_selected', updated_at = NOW()
      WHERE guild_id = ${interaction.guildId}
    `);

    for (const discordId of ids) {
      await db.execute(sql`
        INSERT INTO league_commissioners (guild_id, discord_id, role, created_by)
        VALUES (${interaction.guildId}, ${discordId}, 'commissioner', ${interaction.user.id})
        ON CONFLICT (guild_id, discord_id) DO NOTHING
      `);
      await db.execute(sql`
        INSERT INTO league_members (guild_id, discord_id, role, is_commissioner)
        VALUES (${interaction.guildId}, ${discordId}, 'commissioner', true)
        ON CONFLICT (guild_id, discord_id) DO UPDATE SET role = 'commissioner', is_commissioner = true, updated_at = NOW()
      `);
    }

    await interaction.update({
      embeds: [progressEmbed("✅ Commissioners saved.\n\nNext: review/edit rules and configure season settings.")],
      components: buildNewServerSetupRows(),
    });
    return true;
  }

  if (customId === "ns_league_settings" && interaction.isButton()) {
    await ensureSetupRow(interaction.guildId, interaction.user.id);
    await updateSetupValue(interaction.guildId, interaction.user.id, { seasonNumber: 1 });
    await showSettingsPanel(interaction);
    return true;
  }

  if (customId === "ns_season_select" && interaction.isStringSelectMenu()) {
    const n = Number(interaction.values[0]);
    if (!Number.isInteger(n) || n < 1 || n > 9) {
      await interaction.reply({ content: "❌ Season must be a whole number from 1 to 9.", ephemeral: true });
      return true;
    }
    await updateSetupValue(interaction.guildId, interaction.user.id, { seasonNumber: n });
    await showSettingsPanel(interaction);
    return true;
  }

  if (customId === "ns_week_select" && interaction.isStringSelectMenu()) {
    await updateSetupValue(interaction.guildId, interaction.user.id, { currentWeek: interaction.values[0] });
    await showSettingsPanel(interaction);
    return true;
  }

  if (customId === "ns_advance_select" && interaction.isStringSelectMenu()) {
    const selected = interaction.values[0];
    if (selected === "custom") {
      const modal = new ModalBuilder().setCustomId("ns_custom_advance_modal").setTitle("Custom Advance Hours");
      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("advance_hours").setLabel("Advance cadence in hours").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder("Example: 36"),
      ));
      await interaction.showModal(modal);
      return true;
    }
    await updateSetupValue(interaction.guildId, interaction.user.id, { advanceHours: Number(selected) });
    await showSettingsPanel(interaction);
    return true;
  }

  if (customId === "ns_custom_advance_modal" && interaction.isModalSubmit()) {
    const n = Number(interaction.fields.getTextInputValue("advance_hours"));
    if (!Number.isInteger(n) || n < 1) {
      await interaction.reply({ content: "❌ Advance hours must be a whole number greater than 0.", ephemeral: true });
      return true;
    }
    await updateSetupValue(interaction.guildId, interaction.user.id, { advanceHours: n });
    const state = await getSetupState(interaction.guildId);
    await interaction.reply({ embeds: [buildSettingsEmbed(state)], components: buildSettingsRows(state), ephemeral: true });
    return true;
  }

  if (customId === "ns_complete_setup" && interaction.isButton()) {
    const state = await getSetupState(interaction.guildId);
    const seasonNumber = state.seasonNumber ?? 1;
    const currentWeek = state.currentWeek;
    const advanceHours = state.advanceHours;
    if (!currentWeek || !advanceHours) {
      await interaction.reply({ content: "❌ Select both current week and advance cadence before completing setup.", ephemeral: true });
      return true;
    }
    await db.execute(sql`UPDATE seasons SET is_active = false WHERE guild_id = ${interaction.guildId}`);
    await db.execute(sql`
      INSERT INTO seasons (guild_id, season_number, is_active, current_week)
      VALUES (${interaction.guildId}, ${seasonNumber}, true, ${currentWeek})
    `);
    await db.execute(sql`
      UPDATE server_settings
      SET setup_completed = true, setup_completed_at = NOW(), setup_completed_by = ${interaction.user.id}, advance_hours = ${advanceHours}, updated_at = NOW()
      WHERE guild_id = ${interaction.guildId}
    `);
    await db.execute(sql`
      UPDATE new_server_setups
      SET completed_by = ${interaction.user.id}, season_number = ${seasonNumber}, current_week = ${currentWeek}, advance_hours = ${advanceHours}, status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE guild_id = ${interaction.guildId}
    `);
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.Green).setTitle("✅ REC Server Setup Complete").setDescription("Server initialization is complete. Next step: import league data.")],
      components: [],
    });
    return true;
  }

  return false;
}
