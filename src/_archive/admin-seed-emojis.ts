/**
 * /admin-seed-emojis — Upload custom emojis to the server.
 * Currently seeds button-office emoji for the /menu button.
 */

import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, Colors,
} from "discord.js";
import { readFileSync } from "fs";
import { join } from "path";
import { isAdminUser } from "../lib/db-helpers.js";
import { db } from "@workspace/db";
import { guildEmojisTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export const data = new SlashCommandBuilder()
  .setName("admin-seed-emojis")
  .setDescription("Upload custom emojis to the server (button-office, etc.)")
  .setDefaultMemberPermissions(0);

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  // ── Permission check ─────────────────────────────────────────────────────────
  const isAdmin = await isAdminUser(userId, guildId);
  if (!isAdmin) {
    await interaction.reply({
      content: "❌ You do not have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply("❌ Must be run in a Discord server.");
      return;
    }

    const results: { name: string; status: string; emojiId?: string }[] = [];

    // ── Upload button-office emoji ───────────────────────────────────────────────
    try {
      const imagePath = join(process.cwd(), "assets", "button-office.png");
      const imageBuffer = readFileSync(imagePath);

      // Check if emoji already exists
      let existingEmoji = guild.emojis.cache.find(e => e.name === "button_office");
      if (existingEmoji) {
        results.push({
          name: "button_office",
          status: "✅ Already exists",
          emojiId: existingEmoji.id,
        });
      } else {
        const newEmoji = await guild.emojis.create({
          attachment: imageBuffer,
          name: "button_office",
          reason: "REC League menu button emoji",
        });
        results.push({
          name: "button_office",
          status: "✅ Created",
          emojiId: newEmoji.id,
        });
        existingEmoji = newEmoji;
      }

      // ── Store emoji ID in database ─────────────────────────────────────────────
      if (existingEmoji) {
        await db.insert(guildEmojisTable)
          .values({
            guildId,
            emojiName: "button_office",
            emojiId: existingEmoji.id,
            uploadedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [guildEmojisTable.guildId, guildEmojisTable.emojiName],
            set: { emojiId: existingEmoji.id, uploadedAt: new Date() },
          });
      }
    } catch (err) {
      results.push({
        name: "button_office",
        status: `❌ ${(err as Error).message}`,
      });
    }

    // ── Build response ───────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Emojis Seeded")
      .setDescription(
        results
          .map(r => `**${r.name}** — ${r.status}${r.emojiId ? ` (ID: ${r.emojiId})` : ""}`)
          .join("\n")
      )
      .setFooter({ text: "The /menu button will now use the button-office emoji." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error("[admin-seed-emojis] Error:", err);
    await interaction.editReply({
      content: `❌ Error: ${(err as Error).message}`,
    });
  }
}
