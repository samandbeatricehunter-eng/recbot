/**
 * admin-rules-handlers.ts
 * Rules Hub display + Rules Modal Handlers (add/edit/delete/paginate).
 * Also exports buildRulesPages, previously on admin-operations-handlers.ts.
 * Extracted from lib/admin-operations-handlers.ts.
 */
/**
 * /admin-operations hub — admin-facing interactions with prefix ao_
 * Session TTL: 15 minutes (keyed by `${guildId}:${userId}`)
 */
import {
  ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction,
  EmbedBuilder, Colors, TextChannel, ChannelType, MessageFlags,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, ComponentType,
} from "discord.js";
import { db } from "@workspace/db";
import {
  seasonsTable, franchiseScheduleTable, usersTable, gameChannelsTable,
  gotwHistoryTable, franchiseMcaTeamsTable, leagueTwitterTable,
  playerSeasonStatsTable, playerStatWeekProcessedTable,
  gameLogTable, userRecordsTable, statPaddingViolationsTable,
  defaultTeamLogosTable, waitlistTable,
  serverSettingsTable, franchiseRostersTable, inventoryTable, legendsTable, customPlayersTable,
  guildChannelsTable,
} from "@workspace/db";
import { eq, and, sql, ne, desc } from "drizzle-orm";
import {
  getOrCreateActiveSeason, addBalance, logTransaction,
  getGuildChannel, CHANNEL_KEYS,
  getOrSeedRules, setRules, getAllSections,
  getScheduleSeasonId,
} from "./db-helpers.js";
import { WEEK_SEQUENCE, weekLabel } from "./week-helpers.js";
import { lookupNflDivision } from "./constants.js";
import { generateFranchiseArticle, generateWeekPreview } from "./franchise-article.js";
import { runWildcardAutomation, runOffseasonHistoricalPost } from "./wildcard-automation.js";
import { runEosAutoPost } from "./eos-auto-post.js";
import { getPayoutValue, PAYOUT_KEYS } from "./payout-config.js";
import { sendArticleChunked } from "./send-article.js";
import { runWeeklyMatchupsFlow } from "./weekly-matchups-runner.js";
import { createPrivateGameChannelsForWeek } from "./game-channel-manager.js";
import { PLAYOFF_WEEK_META, runPlayoffMatchupsFlow, payoutPlayoffRoundResults, autoDivisionBonus } from "./playoff-matchups-runner.js";
import axios from "axios";
import { autoPayoutPlayoffGotw, purgeChannel } from "./gotw-helpers.js";
import { checkAndNotifyWaitlist } from "../commands/waitlist.js";
import { buildMatchupBanner, resolveLogoBuf } from "./matchup-image.js";
import { generateMatchupBreakdown } from "./matchup-ai-breakdown.js";
import { globalLogoPath } from "./gcs-reader.js";
import { buildAdminOpsEmbed, buildAdminOpsRows, buildAdminImportAdvanceEmbed, buildAdminImportAdvanceRows, buildAdminEconomyEmbed, buildAdminEconomyRows, buildAdminServerEmbed, buildAdminServerRows } from "../commands/admin-operations.js";
import { buildPayoutHubEmbed, buildPayoutHubRows } from "./admin-payout-handlers.js";
import { buildUserDataHubEmbed, buildUserDataHubRows } from "./admin-user-handlers.js";
import {
  buildTroubleshootEmbed, buildTroubleshootRows,
  handleTsMilestoneAudit,
} from "./admin-troubleshoot-handlers.js";
import { runNewServerInit, runExistingServerInit } from "../commands/admin-initialize.js";
import { registerCommandsForGuild } from "./register-commands.js";
import { buildLeagueDataMainMenu } from "./league-data-handlers.js";
import { getServerSettings, buildSettingsEmbed, buildSettingsRows } from "./server-settings.js";
import { setGuildChannel } from "./db-helpers.js";
import { rebuildHistoricalChannel } from "./wildcard-automation.js";
import OpenAI from "./openai-fallback.js";



function buildAdminBackRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ao_admin_root")
      .setLabel("Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildAdminRootMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_admin_department_select")
        .setPlaceholder("Select admin department")
        .addOptions(
          { label: "Import/Advance", value: "import_advance", description: "Import, advance, set week/season, weekly matchups", emoji: "📥" },
          { label: "Manage Economy", value: "manage_economy", description: "Payouts and economy workflows", emoji: "💰" },
          { label: "Manage Server", value: "manage_server", description: "Users, settings, troubleshooting, bug reports", emoji: "🛠️" },
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ao_close").setLabel("Close").setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function buildImportAdvanceMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_import_advance_select")
        .setPlaceholder("Select Import/Advance workflow")
        .addOptions(
          { label: "Import", value: "league_data", description: "Formerly League Data", emoji: "📥" },
          { label: "Advance Week", value: "advance_week", description: "Advance to the next league week", emoji: "⏭️" },
          { label: "Run Weekly Matchups", value: "run_weekly_matchups", description: "Post game channels, matchups, and GOTW flow", emoji: "🏈" },
          { label: "Set Week", value: "set_week", description: "Manually set current week", emoji: "📅" },
          { label: "Set Season", value: "set_season", description: "Manually set current season", emoji: "🏆" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

function buildManageEconomyMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_manage_economy_select")
        .setPlaceholder("Select Economy workflow")
        .addOptions(
          { label: "Payouts", value: "payouts", description: "Open payout management", emoji: "💰" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

function buildManageServerMenuRows(): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("ao_manage_server_select")
        .setPlaceholder("Select Server workflow")
        .addOptions(
          { label: "User Data", value: "user_data", description: "Manage user/team data", emoji: "👥" },
          { label: "Store Settings", value: "store_settings", description: "Manage store options", emoji: "🏪" },
          { label: "Server Settings", value: "server_settings", description: "Manage server settings", emoji: "⚙️" },
          { label: "Troubleshoot", value: "troubleshoot", description: "Repair/check bot data", emoji: "🧰" },
          { label: "Report Bug", value: "report_bug", description: "Report a bot issue", emoji: "🐞" },
        ),
    ),
    buildAdminBackRow(),
  ];
}

async function showAdminRootMenu(interaction: any) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0xB68B2D).setTitle("Commissioner's Office").setDescription("Select an admin department below.")],
    components: buildAdminRootMenuRows(),
  });
}

async function showAdminDepartmentMenu(interaction: any, title: string, description: string, components: any[]) {
  await interaction.update({
    embeds: [new EmbedBuilder().setColor(0xB68B2D).setTitle(title).setDescription(description)],
    components,
  });
}
const openaiClient = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey:  process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "dummy",
});


// ── Shared types ──────────────────────────────────────────────────────────────
// ── Types ──────────────────────────────────────────────────────────────────────

type AnyInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

interface AoSession {
  guildId: string;
  userId: string;
  rulesSection?: string;
  rulesPage?: number;
  adminsAddPage?: number;
  expiresAt: number;
}

// ── Session management ─────────────────────────────────────────────────────────

const aoSessions = new Map<string, AoSession>();
const AO_SESSION_TTL = 15 * 60 * 1000;

function getAoSession(guildId: string, userId: string): AoSession {
  const key = `${guildId}:${userId}`;
  let sess = aoSessions.get(key);
  if (!sess || sess.expiresAt < Date.now()) {
    sess = { guildId, userId, expiresAt: Date.now() + AO_SESSION_TTL };
    aoSessions.set(key, sess);
  }
  sess.expiresAt = Date.now() + AO_SESSION_TTL;
  return sess;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

const RULES_PAGE_CHAR_LIMIT = 3800;



export function buildRulesPages(rules: string[]): string[] {
  if (rules.length === 0) return ["_No rules in this section yet._"];
  const pages: string[] = [];
  let current = "";
  for (let i = 0; i < rules.length; i++) {
    const line = `**${i + 1}.** ${rules[i]}`;
    const candidate = current ? current + "\n\n" + line : line;
    if (candidate.length > RULES_PAGE_CHAR_LIMIT && current) {
      pages.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) pages.push(current);
  return pages;
}

function buildRulesEmbed(
  section: string,
  sectionMeta: { title: string; color: number },
  rules: string[],
  page = 0,
): EmbedBuilder {
  const pages   = buildRulesPages(rules);
  const maxPage = Math.max(0, pages.length - 1);
  const safePage = Math.min(Math.max(0, page), maxPage);
  const content  = pages[safePage] ?? "_No rules in this section yet._";
  const footer   = pages.length > 1
    ? `Section: ${section} · ${rules.length} rule${rules.length !== 1 ? "s" : ""} · Page ${safePage + 1}/${pages.length}`
    : `Section: ${section} · ${rules.length} rule${rules.length !== 1 ? "s" : ""}`;

  return new EmbedBuilder()
    .setColor(sectionMeta.color)
    .setTitle(sectionMeta.title)
    .setDescription(content)
    .setFooter({ text: footer });
}

function buildRulesButtonsWithPage(rulesCount: number, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder>[] {
  const editDisabled   = rulesCount === 0;
  const deleteDisabled = rulesCount === 0;
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_rules_add").setLabel("➕ Add Rule").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("ao_rules_edit").setLabel("✏️ Edit Rule").setStyle(ButtonStyle.Primary).setDisabled(editDisabled),
    new ButtonBuilder().setCustomId("ao_rules_delete").setLabel("🗑️ Delete Rule").setStyle(ButtonStyle.Danger).setDisabled(deleteDisabled),
    new ButtonBuilder().setCustomId("ao_rules_back_sections").setLabel("← Sections").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );
  if (totalPages <= 1) return [row1];
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ao_rules_page:${page - 1}`).setLabel("◀ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`ao_rules_page:${page + 1}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
  );
  return [row1, row2];
}


// ── Main dispatch ──────────────────────────────────────────────────────────────


// ── Rules Hub ─────────────────────────────────────────────────────────────────

export async function handleRulesHub(interaction: ButtonInteraction | StringSelectMenuInteraction, _sess: AoSession) {
  const guildId  = interaction.guildId!;
  const sections = await getAllSections(guildId);
  const entries  = Object.entries(sections);

  if (entries.length === 0) {
    await (interaction as any).update({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle("📋 Rules")
          .setDescription("No rule sections found. Run `/adminrules new-section` to create one first."),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
        ) as ActionRowBuilder<any>,
      ],
    });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("ao_rules_section")
    .setPlaceholder("Select a section to view/edit...")
    .addOptions(
      entries.slice(0, 25).map(([key, meta]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(meta.title.replace(/[\u{1F300}-\u{1FFFF}]/gu, "").trim() || key)
          .setValue(key)
          .setDescription(`Section: ${key}`),
      ),
    );

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_hub_back").setLabel("← Back to Hub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("ao_hub_close").setLabel("✖ Close").setStyle(ButtonStyle.Danger),
  );

  await (interaction as any).update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📋 View / Edit Rules")
        .setDescription("Select a section to view its rules and manage them."),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<any>,
      backRow,
    ],
  });
}

export async function handleRulesSection(interaction: StringSelectMenuInteraction, sess: AoSession) {
  const guildId = interaction.guildId!;
  const section = interaction.values[0]!;
  sess.rulesSection = section;
  sess.rulesPage    = 0;

  const sections = await getAllSections(guildId);
  const meta     = sections[section];
  if (!meta) {
    await interaction.update({ content: "❌ Section not found.", components: [] });
    return;
  }

  const rules      = await getOrSeedRules(section, guildId);
  const totalPages = buildRulesPages(rules).length;
  const embed      = buildRulesEmbed(section, meta, rules, 0);
  const btns       = buildRulesButtonsWithPage(rules.length, 0, totalPages);

  await interaction.update({ embeds: [embed], components: btns });
}

export async function handleRulesPage(interaction: ButtonInteraction, sess: AoSession) {
  const guildId = interaction.guildId!;
  const page    = parseInt(interaction.customId.split(":")[1] ?? "0", 10);
  const section = sess.rulesSection;

  if (!section) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  sess.rulesPage = page;

  const sections = await getAllSections(guildId);
  const meta     = sections[section];
  if (!meta) {
    await interaction.update({ content: "❌ Section not found.", components: [] });
    return;
  }

  const rules      = await getOrSeedRules(section, guildId);
  const totalPages = buildRulesPages(rules).length;
  const safePage   = Math.min(Math.max(0, page), Math.max(0, totalPages - 1));
  const embed      = buildRulesEmbed(section, meta, rules, safePage);
  const btns       = buildRulesButtonsWithPage(rules.length, safePage, totalPages);

  await interaction.update({ embeds: [embed], components: btns });
}

export async function handleRulesAdd(interaction: ButtonInteraction, sess: AoSession) {
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("ao_modal_rules_add")
    .setTitle("Add New Rule");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_text")
        .setLabel("Rule Text")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Enter the full text of the new rule...")
        .setRequired(true)
        .setMaxLength(1500),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleRulesEdit(interaction: ButtonInteraction, sess: AoSession) {
  const guildId = interaction.guildId!;
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const rules = await getOrSeedRules(sess.rulesSection, guildId);
  if (rules.length === 0) {
    await interaction.reply({ content: "❌ No rules to edit in this section.", ephemeral: true });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("ao_rules_edit_sel")
    .setPlaceholder("Select the rule number to edit...")
    .addOptions(
      rules.slice(0, 25).map((text, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`Rule ${i + 1}`)
          .setValue(String(i + 1))
          .setDescription(text.length > 50 ? text.slice(0, 47) + "..." : text),
      ),
    );

  const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("ao_rules_back_sections").setLabel("← Back to Sections").setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("✏️ Edit Rule — Select Rule Number")
        .setDescription("Choose which rule you want to edit. A form will appear with the current text pre-filled."),
    ],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select) as ActionRowBuilder<any>,
      cancelRow,
    ],
  });
}

export async function handleRulesEditSel(interaction: StringSelectMenuInteraction, sess: AoSession) {
  const guildId  = interaction.guildId!;
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const ruleNum = parseInt(interaction.values[0]!, 10);
  const rules   = await getOrSeedRules(sess.rulesSection, guildId);
  const ruleText = rules[ruleNum - 1] ?? "";

  const modal = new ModalBuilder()
    .setCustomId("ao_modal_rules_edit")
    .setTitle(`Edit Rule ${ruleNum}`);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_num")
        .setLabel("Rule Number (do not change)")
        .setStyle(TextInputStyle.Short)
        .setValue(String(ruleNum))
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_text")
        .setLabel("Rule Text")
        .setStyle(TextInputStyle.Paragraph)
        .setValue(ruleText)
        .setRequired(true)
        .setMaxLength(1500),
    ),
  );

  await interaction.showModal(modal);
}

export async function handleRulesDelete(interaction: ButtonInteraction, sess: AoSession) {
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("ao_modal_rules_delete")
    .setTitle("Delete Rule");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("rule_num")
        .setLabel("Rule Number to Delete")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 3")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3),
    ),
  );

  await interaction.showModal(modal);
}

// ── Rules Modal Handlers ───────────────────────────────────────────────────────

export async function handleModalRulesAdd(interaction: ModalSubmitInteraction, sess: AoSession) {
  const guildId = interaction.guildId!;
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const newText = interaction.fields.getTextInputValue("rule_text").trim();
  if (!newText) {
    await interaction.reply({ content: "❌ Rule text cannot be empty.", ephemeral: true });
    return;
  }

  const rules = await getOrSeedRules(sess.rulesSection, guildId);
  rules.push(newText);
  await setRules(sess.rulesSection, rules, interaction.user.id, guildId);

  const sections = await getAllSections(guildId);
  const meta     = sections[sess.rulesSection]!;
  const totalPages = buildRulesPages(rules).length;
  const page       = Math.min(sess.rulesPage ?? 0, Math.max(0, totalPages - 1));
  const embed    = buildRulesEmbed(sess.rulesSection, meta, rules, page);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Rule Added")
        .setDescription(`Rule **#${rules.length}** has been added to **${meta.title}**.`),
      embed,
    ],
    components: buildRulesButtonsWithPage(rules.length, page, totalPages),
    ephemeral: true,
  });
}

export async function handleModalRulesEdit(interaction: ModalSubmitInteraction, sess: AoSession) {
  const guildId  = interaction.guildId!;
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const ruleNum  = parseInt(interaction.fields.getTextInputValue("rule_num"), 10);
  const newText  = interaction.fields.getTextInputValue("rule_text").trim();

  if (isNaN(ruleNum) || ruleNum < 1) {
    await interaction.reply({ content: "❌ Invalid rule number.", ephemeral: true });
    return;
  }
  if (!newText) {
    await interaction.reply({ content: "❌ Rule text cannot be empty.", ephemeral: true });
    return;
  }

  const rules = await getOrSeedRules(sess.rulesSection, guildId);
  if (ruleNum > rules.length) {
    await interaction.reply({ content: `❌ Rule #${ruleNum} does not exist. This section has ${rules.length} rule(s).`, ephemeral: true });
    return;
  }

  rules[ruleNum - 1] = newText;
  await setRules(sess.rulesSection, rules, interaction.user.id, guildId);

  const sections  = await getAllSections(guildId);
  const meta      = sections[sess.rulesSection]!;
  const totalPages = buildRulesPages(rules).length;
  const page       = Math.min(sess.rulesPage ?? 0, Math.max(0, totalPages - 1));
  const embed      = buildRulesEmbed(sess.rulesSection, meta, rules, page);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Rule Updated")
        .setDescription(`Rule **#${ruleNum}** in **${meta.title}** has been updated.`),
      embed,
    ],
    components: buildRulesButtonsWithPage(rules.length, page, totalPages),
    ephemeral: true,
  });
}

export async function handleModalRulesDelete(interaction: ModalSubmitInteraction, sess: AoSession) {
  const guildId = interaction.guildId!;
  if (!sess.rulesSection) {
    await interaction.reply({ content: "❌ Session expired — please start over.", ephemeral: true });
    return;
  }

  const ruleNum = parseInt(interaction.fields.getTextInputValue("rule_num"), 10);
  if (isNaN(ruleNum) || ruleNum < 1) {
    await interaction.reply({ content: "❌ Invalid rule number.", ephemeral: true });
    return;
  }

  const rules = await getOrSeedRules(sess.rulesSection, guildId);
  if (ruleNum > rules.length) {
    await interaction.reply({ content: `❌ Rule #${ruleNum} does not exist. This section has ${rules.length} rule(s).`, ephemeral: true });
    return;
  }

  const [deleted] = rules.splice(ruleNum - 1, 1);
  await setRules(sess.rulesSection, rules, interaction.user.id, guildId);

  const sections   = await getAllSections(guildId);
  const meta       = sections[sess.rulesSection]!;
  const totalPages = buildRulesPages(rules).length;
  const page       = Math.min(sess.rulesPage ?? 0, Math.max(0, totalPages - 1));
  const embed      = buildRulesEmbed(sess.rulesSection, meta, rules, page);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle("🗑️ Rule Deleted")
        .setDescription(
          `Rule **#${ruleNum}** has been removed from **${meta.title}**.\n` +
          `_Deleted text: "${deleted?.slice(0, 100)}${(deleted?.length ?? 0) > 100 ? "..." : ""}"_\n\n` +
          `Remaining rules have been renumbered.`
        ),
      embed,
    ],
    components: buildRulesButtonsWithPage(rules.length, page, totalPages),
    ephemeral: true,
  });
}

