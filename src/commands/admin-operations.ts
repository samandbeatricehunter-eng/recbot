import {
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
  return seasonNum != null && weekStr ? "Season " + seasonNum + " - " + weekStr + "\n\n" : "";
}

export function buildAdminOpsEmbed(seasonNum?: number, weekStr?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Commissioner's Office")
    .setDescription(
      seasonHeader(seasonNum, weekStr) +
      "Select an administrative department below.\n\n" +
      "**Import/Advance**\nLeague data import, advance week, weekly matchups, set week, and set season.\n\n" +
      "**Manage Economy**\nPayout tools and economy management.\n\n" +
      "**Manage Server**\nUser data, store settings, server settings, troubleshooting, and bug reports."
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
      "Choose the import or weekly operations workflow to run.\n\n" +
      "**Import** — formerly League Data.\n" +
      "**Advance Week** — advances the active week.\n" +
      "**Run Weekly Matchups** — creates private game channels, then posts matchups/GOTW.\n" +
      "**Set Week** — manually set current week.\n" +
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
