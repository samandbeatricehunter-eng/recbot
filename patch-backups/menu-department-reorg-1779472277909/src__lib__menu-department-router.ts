import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from "discord.js";
import { db } from "@workspace/db";
import { usersTable, userSavingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isAdminUser, getOrCreateActiveSeason } from "./db-helpers.js";
import { weekLabel } from "./week-helpers.js";
import { handleActionsInteraction } from "./actions-handlers.js";
import { buildAdminOpsEmbed, buildAdminOpsRows } from "../commands/admin-operations.js";

type DepartmentInteraction = StringSelectMenuInteraction | ButtonInteraction;

function backRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ac_hub").setLabel("← Back to Coaches Office").setStyle(ButtonStyle.Secondary),
  );
}

function deptSelect(customId: string, placeholder: string, options: Array<{ label: string; value: string; description: string; emoji?: string }>) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(...options),
  );
}

async function routeToExistingAction(interaction: StringSelectMenuInteraction, customId: string) {
  const proxied = new Proxy(interaction as any, {
    get(target, prop, receiver) {
      if (prop === "customId") return customId;
      if (prop === "isStringSelectMenu") return () => false;
      if (prop === "isButton") return () => true;
      return Reflect.get(target, prop, receiver);
    },
  });

  const handled = await handleActionsInteraction(proxied as any);
  if (!handled && !interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: "That menu option is not wired yet.", ephemeral: true });
  }
}

async function getFinancialSummary(discordId: string) {
  const walletRows = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.discordId, discordId));

  const savingsRows = await db
    .select({ balance: userSavingsTable.balance })
    .from(userSavingsTable)
    .where(eq(userSavingsTable.discordId, discordId));

  const wallet = walletRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  const savings = savingsRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
  return { wallet, savings, total: wallet + savings };
}

async function showGmOffice(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("GM's Office")
    .setDescription(
      "Manage the football side of your franchise." 
      +
      "**Schedule** — view your weekly matchup slate." 
      +
      "**All Rosters** — view any roster; free agents should be accessed from the roster workflow." 
      +
      "**Standings** — view league standings and playoff picture."
      +
      "**Season PR** — current season power rankings." 
      +
      "**All-Time PR** — historical league power rankings."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_gm_select", "Select a GM's Office workflow", [
        { label: "Schedule", value: "ac_schedule", description: "View your schedule", emoji: "📅" },
        { label: "All Rosters", value: "ac_anyroster", description: "Browse rosters and free agents", emoji: "👥" },
        { label: "Standings", value: "ac_standings", description: "View standings", emoji: "📊" },
        { label: "Season PR", value: "ac_seasonpr", description: "View current season power rankings", emoji: "🥇" },
        { label: "All-Time PR", value: "ac_alltimepr", description: "View historical power rankings", emoji: "🏆" },
      ]),
      backRow(),
    ],
  });
}

async function showFinancials(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const summary = await getFinancialSummary(interaction.user.id);
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle("Financials")
    .setDescription(
      "Manage your REC economy activity." 
      +
      `**Wallet:** ${summary.wallet.toLocaleString()} coins` +
      `**Savings:** ${summary.savings.toLocaleString()} coins` +
      `**Total Across Servers:** ${summary.total.toLocaleString()} coins` +
      "Weekly and EOS payout menus are set aside for now."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_financials_select", "Select a Financials workflow", [
        { label: "Store", value: "ac_purchase", description: "Purchase upgrades, legends, and custom options", emoji: "🛒" },
        { label: "Bank", value: "ac_coins", description: "Wallet, savings, transfers, and sending money", emoji: "🏦" },
        { label: "Milestones", value: "ac_milestonepayouts", description: "View milestone rewards", emoji: "🎯" },
        { label: "Wager", value: "ac_wager", description: "Create or manage wagers", emoji: "⚔️" },
      ]),
      backRow(),
    ],
  });
}

async function showMedia(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0xB68B2D)
    .setTitle("Media")
    .setDescription(
      "Control your team's public narrative." +
      "**Call Press Conference** — request the interview workflow." +
      "**Headlines** — league headline feed." +
      "**League Transactions** — transaction activity." +
      "**Rivalries** — rivalry tracking."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_media_select", "Select a Media workflow", [
        { label: "Call Press Conference", value: "ac_interview", description: "Open the interview workflow", emoji: "🎙️" },
        { label: "Headlines", value: "stub_headlines", description: "League headline feed", emoji: "📰" },
        { label: "League Transactions", value: "stub_transactions", description: "View league transactions", emoji: "🔁" },
        { label: "Rivalries", value: "stub_rivalries", description: "View rivalry activity", emoji: "🔥" },
      ]),
      backRow(),
    ],
  });
}

async function showLeagueOperations(interaction: StringSelectMenuInteraction | ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("League Operations")
    .setDescription(
      "Handle rules, reports, team availability, and commissioner operations." +
      "Commissioner's Office is restricted to commissioners and Discord administrators."
    );

  await interaction.update({
    embeds: [embed],
    components: [
      deptSelect("ac_ops_select", "Select a League Operations workflow", [
        { label: "Rules", value: "ac_rules", description: "View league rules", emoji: "📕" },
        { label: "Report Violation", value: "ac_violation", description: "Report a user violating league rules", emoji: "🚨" },
        { label: "Request Auto-Pilot", value: "ac_autopilot", description: "Submit an auto-pilot request", emoji: "✈️" },
        { label: "Open Teams", value: "ac_openteams", description: "View open teams", emoji: "🔴" },
        { label: "Active/User Teams", value: "ac_activeteams", description: "View assigned user teams", emoji: "🟢" },
        { label: "Commissioner's Office", value: "admin_ops", description: "Open commissioner tools", emoji: "🛡️" },
      ]),
      backRow(),
    ],
  });
}

async function openCommissionersOffice(interaction: StringSelectMenuInteraction) {
  const gid = interaction.guildId!;
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  const isDiscordAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  const isDbAdmin = await isAdminUser(interaction.user.id, gid);

  if (!isDiscordAdmin && !isDbAdmin) {
    await interaction.update({ embeds: [], components: [], content: "❌ You are not a commissioner and cannot access the Commissioner's Office." });
    return;
  }

  const season = await getOrCreateActiveSeason(gid).catch(() => null);
  const wkStr = season ? weekLabel(season.currentWeek) : undefined;

  await interaction.update({
    content: undefined,
    embeds: [buildAdminOpsEmbed(season?.seasonNumber ?? undefined, wkStr)],
    components: buildAdminOpsRows(),
  });
}

async function showStub(interaction: StringSelectMenuInteraction, title: string) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(Colors.Yellow).setTitle(title).setDescription("This workflow is staged for the department menu but is not wired yet.")],
    components: [backRow()],
  });
}

export async function handleMenuDepartmentInteraction(interaction: DepartmentInteraction): Promise<boolean> {
  const customId = (interaction as any).customId;
  if (!customId || !customId.startsWith("ac_")) return false;

  if (interaction.isButton() && customId === "ac_hub") return false;
  if (!interaction.isStringSelectMenu()) return false;

  const value = interaction.values[0];

  if (customId === "ac_office_select") {
    if (value === "gmoffice") { await showGmOffice(interaction); return true; }
    if (value === "financials") { await showFinancials(interaction); return true; }
    if (value === "media") { await showMedia(interaction); return true; }
    if (value === "league_operations") { await showLeagueOperations(interaction); return true; }
  }

  if (["ac_gm_select", "ac_financials_select", "ac_media_select", "ac_ops_select"].includes(customId)) {
    if (value === "admin_ops") { await openCommissionersOffice(interaction); return true; }
    if (value === "stub_headlines") { await showStub(interaction, "Headlines"); return true; }
    if (value === "stub_transactions") { await showStub(interaction, "League Transactions"); return true; }
    if (value === "stub_rivalries") { await showStub(interaction, "Rivalries"); return true; }
    if (value?.startsWith("ac_")) { await routeToExistingAction(interaction, value); return true; }
  }

  return false;
}
