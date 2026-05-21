import "dotenv/config";
import { REST, Routes } from "discord.js";
import { buildCommandJSON } from "./lib/command-list.js";
import { getServerSettings } from "./lib/server-settings.js";

const token    = process.env["DISCORD_TOKEN"]!;
const clientId = process.env["DISCORD_CLIENT_ID"]!;
const guildId  = process.env["DISCORD_GUILD_ID"];

if (!token || !clientId) {
  throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set");
}

async function deploy() {
  const rest = new REST().setToken(token);

  // Clear global commands — guild commands are used instead (registered per-guild
  // by the ready/guildCreate events) to prevent duplicates.
  console.log("Clearing global commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log("✅ Global commands cleared");

  if (guildId) {
    // Load settings so disabled features are excluded from the primary guild too
    const settings = await getServerSettings(guildId).catch(() => null);
    let commands = buildCommandJSON(settings);
    // Only keep the two allowed commands: admin-menu and menu
    const allowed = new Set(["admin-menu", "menu"]);
    commands = commands.filter((c: any) => allowed.has(c.name));
    console.log(`Registering ${commands.length} commands to guild ${guildId}...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`✅ Guild commands registered for ${guildId}`);
  }
}

deploy().catch(console.error);
