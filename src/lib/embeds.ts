import { EmbedBuilder } from "discord.js";

export const REC_THEME = {
  gold: 0xd4af37,
  darkGold: 0xb8891f,
  charcoal: 0x1e1e1e,
  darkGray: 0x2b2d31,
  green: 0x3ba55d,
  red: 0xed4245,
  orange: 0xf59e0b,
};

function baseEmbed(title: string, description: string, color = REC_THEME.gold) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "REAL. ELITE. COMPETITION." })
    .setTimestamp();
}

export function successEmbed(title: string, description: string) {
  return baseEmbed(`✅ ${title}`, description, REC_THEME.gold);
}

export function errorEmbed(title: string, description: string) {
  return baseEmbed(`❌ ${title}`, description, REC_THEME.red);
}

export function infoEmbed(title: string, description: string) {
  return baseEmbed(`🏆 ${title}`, description, REC_THEME.gold);
}

export function warningEmbed(title: string, description: string) {
  return baseEmbed(`⚠️ ${title}`, description, REC_THEME.orange);
}

export function pendingEmbed(title: string, description: string) {
  return baseEmbed(`⏳ ${title}`, description, REC_THEME.darkGold);
}

export function recEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor(REC_THEME.gold)
    .setTitle(`🏆 ${title}`)
    .setDescription(description ?? null)
    .setFooter({ text: "REAL. ELITE. COMPETITION." })
    .setTimestamp();
}