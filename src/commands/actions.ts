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

// Hub embed/row builders moved to lib/actions-hub-embeds.ts
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
