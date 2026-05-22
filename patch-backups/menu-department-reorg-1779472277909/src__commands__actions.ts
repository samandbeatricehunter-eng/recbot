import {
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
      ? `Season ${seasonNum} - ${weekStr} - ${teamLabel}${adminLabel}`
      : `REC League - ${teamLabel}${adminLabel}`;

  return new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("REC League: Coaches Office")
    .setDescription(
      `${seasonHeader}\n\n` +
        "Welcome back, Coach. Select a department below to handle your business.\n\n" +
        "**GM's Office** — schedule, rosters, standings, and power rankings.\n" +
        "**Financials** — store, bank, milestones, and wagers.\n" +
        "**Media** — press conferences, headlines, transactions, and rivalries.\n" +
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
  const header = seasonNum != null && weekStr ? `Season ${seasonNum} - ${weekStr}\n\n` : "";

  return new EmbedBuilder()
    .setColor(REC_THEME.gold)
    .setTitle("REC League: Coaches Office")
    .setDescription(
      header +
        "You are not currently linked to a team.\n\n" +
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
