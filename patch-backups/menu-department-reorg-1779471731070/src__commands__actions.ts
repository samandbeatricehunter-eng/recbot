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
    .setImage("attachment://rec-embed-banner.png")
    .setFooter({
      text: "REC League Menu"
    });
}

export function buildActionsHubRows(
  settings: ServerSettings,
  isAdmin: boolean,
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {

  const selectorRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(

      new StringSelectMenuBuilder()
        .setCustomId("ac_office_select")
        .setPlaceholder("Select a department")

        .addOptions(

          {
            label: "GM's Office",
            value: "gmoffice",
            description: "Schedules, rosters, standings, and team data",

            emoji: {
              id: "1507124884193546463",
              name: "gmofficeemoji",
            },
          },

          {
            label: "Financials",
            value: "financials",
            description: "Wallet, savings, wagers, store, inventory, and payouts",

            emoji: {
              id: "1507125613503447172",
              name: "financialsemoji",
            },
          },

          {
            label: "Media",
            value: "media",
            description: "Interviews, press conferences, tweets, and league buzz",

            emoji: {
              id: "1507126260248346706",
              name: "mediaemoji",
            },
          },

          {
            label: "League Operations",
            value: "league_operations",
            description: "Rules, reports, open teams, user teams, and tools",
            emoji: {
              id: "1507126980410343534",
              name: "leagueoperationsemoji",
            },
          },
        ),
    );

  return [selectorRow];
}

export function buildUnlinkedHubEmbed(
  seasonNum?: number,
  weekStr?: string,
): EmbedBuilder {
  const header =
    seasonNum != null && weekStr
      ? `Season ${seasonNum} - ${weekStr}\n\n`
      : "";

  return new EmbedBuilder()
    .setColor(REC_THEME.gold)
    .setTitle("REC League: Coaches Office")
    .setDescription(
      header +
        `You are not currently linked to a team.\n\n` +
        `Use the selector below to browse league information or request a franchise.`
    )
    .setImage("attachment://rec-embed-banner.png")
    .setFooter({
      text: "Contact a commissioner to get linked to a team",
    });
}

export function buildUnlinkedHubRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const selectorRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ac_unlinked_select")
        .setPlaceholder("Select an option")
        .addOptions(
          {
            label: "Open Teams",
            value: "openteams",
            description: "Browse available franchises",
            emoji: "🔴",
          },
          {
            label: "User Teams",
            value: "activeteams",
            description: "View currently assigned teams",
            emoji: "🟢",
          },
          {
            label: "Rules",
            value: "rules",
            description: "View league rules",
            emoji: "📕",
          },
        ),
    );


  return [selectorRow];
}

export async function execute(
  interaction: ChatInputCommandInteraction,
) {
  const gid = interaction.guildId!;
  const uid = interaction.user.id;

  await interaction.deferReply({
    ephemeral: true,
  });

  const [settings, member, user, season] = await Promise.all([
    getServerSettings(gid),
    interaction.guild?.members.fetch(uid).catch(() => null),
    getOrCreateUser(uid, interaction.user.username, gid),
    getOrCreateActiveSeason(gid),
  ]);

  const isDiscordAdmin =
    member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;

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
    embeds: [
      buildActionsHubEmbed(
        settings,
        isAdmin,
        seasonNum,
        wkStr,
        user.team,
      ),
    ],
    components: buildActionsHubRows(settings, isAdmin),
    files: [banner],
  });
}