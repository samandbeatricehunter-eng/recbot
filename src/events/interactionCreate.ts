import { weekLabel } from "../lib/week-helpers.js";
import {
  DRAFT_TOGGLE_PREFIX, DRAFT_CLOSE_BUTTON_ID,
  getActiveSession, togglePresence, refreshPresence, endDraftSession,
} from "../lib/draft-presence-manager.js";
import {
  scoreH2HMatchups, postGotwToChannel,
} from "../lib/gotw-helpers.js";
import { buildTeamToDiscord } from "../lib/weekly-matchups-runner.js";
import { getPayoutValue, PAYOUT_KEYS } from "../lib/payout-config.js";
import { waitlistTable } from "@workspace/db";
import {
  WAITLIST_ACCEPT_PREFIX, WAITLIST_DENY_PREFIX,
} from "../commands/waitlist.js";
import {
  handleTsRepairRecords,
  handleTsResyncData,
  handleTsEosTestRun,
  handleTsRepairPlayoff,
  handleTsPlayoffProceed,
  handleTsPlayoffConfirm,
  handleTsPlayoffCancel,
  handleTsEosManual,
  handleTsEosManualConfirm,
  handleTsEosManualCancel,
  handleTsEosReset,
  handleTsEosResetConfirm,
  handleTsEosResetCancel,
  handleTsRepairSchedules,
  handleTsSchedReviewWeek,
  handleTsSchedWeekModal,
  handleTsSchedSel,
  handleTsSchedDelete,
  handleTsImportSchedule,
} from "../lib/admin-troubleshoot-handlers.js";
import {
  handleLeagueDataButton,
  handleLeagueDataModal,
  handleLeagueDataSelect,
} from "../lib/league-data-handlers.js";



import {
  handleNewServerSetupInteraction,
  isNewServerSetupCustomId,
} from "../lib/new-server-setup-handlers.js";
import { handleMenuDepartmentInteraction } from "../lib/menu-department-router.js";

import {
  handleActionsInteraction,
} from "../lib/actions-handlers.js";
import { handleAdminOperationsInteraction } from "../lib/admin-operations-handlers.js";
import {
  handleClose,
  handleGotw,
  handleGotwSelectAfc,
  handleGotwSelectNfc,
  handleGotwFinalize,
  handleGotwBonus,
  handleGotwBonusModal,
  handlePotw,
  handlePotwSelectAfc,
  handlePotwSelectNfc,
  handlePotwBack,
  handlePotwFinalize,
  handlePotwBonus,
  handlePotwBonusModal,
  handleAddCoins,
  handleAddCoinsSelectAfc,
  handleAddCoinsSelectNfc,
  handleAddCoinsNext,
  handleAddCoinsModal,
  handleRemoveCoins,
  handleRemoveCoinsNext,
  handleRemoveCoinsModal,
  handleTransfer,
  handleTransferSelectAfc,
  handleTransferSelectNfc,
  handleTransferNext,
  handleTransferModal,
  handleGame,
  handleGameSelect,
  handleGameWinnerHome,
  handleGameWinnerAway,
  handleGameWinnerCpu,
  handleGameModalHomeWins,
  handleGameModalAwayWins,
  handleGameModalCpuWins,
  handleCorrect,
  handleCorrectWeekSelect,
  handleCorrectGameSelect,
  handleCorrectNewWinner,
  handleCorrectSwap,
  handleCorrectModalSame,
  handleCorrectModalSwap,
  handleSetPay,
  handleSetPayReg,
  handleSetPayRegModal,
  handleSetPayChannel,
  handleSetPayChannelModal,
  handleSetPayHighlightCapModal,
  handleSetPayPlayoff,
  handleSetPayPo1Btn,
  handleSetPayPo2Btn,
  handleSetPayPo1Modal,
  handleSetPayPo2Modal,
  handleNewMember,
  handleNewMemberModal,
  handleReferral,
  handleReferralModal,
  handleEos,
  handleEosKeySelect,
  handleEosEditModal,
  handleEosStatTierModal,
  handleMilestone,
  handleMilestoneAdd,
  handleMilestoneEdit,
  handleMilestoneEditModal,Modal,Modal,
} from "../lib/admin-payout-handlers.js";
import {
  handleSsClose,
  handleSsCancel,
  handleSsArch,
  handleSsArchPos,
  handleSsArchPrev,
  handleSsArchNext,
  handleSsArchEdit,
  handleSsArchBackToView,
  handleSsArchEditGroup,
  handleSsArchEditModal,
  handleSsLt,
  handleSsLtPos,
  handleSsLtLegend,
  handleSsLtModel,
  handleSsLtBackToPos,
  handleSsLtBackToModel,
  handleSsLtEdit,
  handleSsLtCreate,
  handleSsLtBackToView,
  handleSsLtEditGroup,
  handleSsLtEditModal,
} from "../lib/admin-store-handlers.js";
import {
  handleUdClose,
  handleUdCancel,
  handleUdViewTeams,
  handleUdLink,
  handleUdLinkTeamAfc,
  handleUdLinkTeamNfc,
  handleUdLinkMember,
  handleUdLinkNext,
  handleUdLinkModal,
  handleUdUnlink,
  handleUdUnlinkTeamAfc,
  handleUdUnlinkTeamNfc,
  handleUdUnlinkConfirm,
  handleUdViewEdit,
  handleUdVeTeamAfc,
  handleUdVeTeamNfc,
  handleUdVeLoad,
  handleUdEditEconomy,
  handleUdEditRecords,
  handleUdEditAllTime,
  handleUdEditEconomyModal,
  handleUdEditRecordsModal,
  handleUdEditAllTimeModal,
  handleUdDelete,
  handleUdDeleteUserSelect,
  handleUdDeleteToggle,
  handleUdDeleteConfirm,
  handleTreqLinkButton,
  handleTreqDenyButton,
  handleTreqDenyReasonModal,
} from "../lib/admin-user-handlers.js";
import {
  handleCcpPos,
  handleCcpArch,
  handleCcpOlPos,
  handleCcpPkg,
  handleCcpDev,
  handleCcpAttrSel,
  handleCcpAttrSelPrev,
  handleCcpAttrSelNext,
  handleCcpAttrPagePrev,
  handleCcpAttrPageNext,
  handleCcpAttrAdjust,
  handleCcpSubmitAttrs,
  handleCcpPreConfirm,
  handleCcpConfirm,
  handleCcpCancel,
  handleCcpApplied,
  handleCcpRefund,
  handleCcpRefundModal,
  handleCcpModal,
  handleCcpHand,
  handleCcpHeight,
  handleCcpWeight,
  handleCcpMotionStyle,
  handleCcpQbDetailsModal,
  handleCcpAppearanceModal,
} from "../lib/custom-player-interactions.js";
import { handleAcpPositionSelect, handleAcpPlayerSelect } from "../lib/acp-handlers.js";
import { handleVcaNav, handleVcaAttrPageNav, handleViewArchetypeSelect } from "../lib/vca-handlers.js";
import { handleTeamSelect, handlePositionSelect, handlePlayerSelect } from "../lib/vps-handlers.js";
function computeIsSetupInteraction(interaction: Interaction): boolean {
  return (
    (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
    typeof (interaction as any).customId === "string" &&
    isNewServerSetupCustomId((interaction as any).customId)
  );
}

export const name = "interactionCreate";

export async function execute(interaction: Interaction) {


  // NSS EARLY ROUTING SAFETY NET
  if (
    (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
    isNewServerSetupCustomId(interaction.customId)
  ) {
    try {
      const handled = await handleNewServerSetupInteraction(interaction);
      if (handled) return;
    } catch (err) {
      console.error(`[new-server-setup] ${interaction.customId}:`, err);
      const msg = { content: "❌ Something went wrong in server setup. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
      return;
    }
  }

  // ── Role guard ─────────────────────────────────────────────────────────────
  // All interactions from guild members must have at least one assigned role
  // beyond @everyone (which every user has by default).
  // Exception: /menu and all ac_ interactions are exempt because the menu
  // itself handles the linked/unlinked branching — the unlinked hub is
  // specifically designed for users who have no role yet.
  const isMenuCommand    = interaction.isChatInputCommand() && interaction.commandName === "menu";
  const isActionsInteraction = (
    (interaction.isButton() || interaction.isStringSelectMenu()) &&
    typeof (interaction as any).customId === "string" &&
    (
      (interaction as any).customId.startsWith("ac_") ||
      (interaction as any).customId.startsWith("go_")
    )
  );

  if (interaction.inGuild() && interaction.member && !isMenuCommand && !isActionsInteraction && !computeIsSetupInteraction(interaction)) {
    const roles = (interaction.member as any).roles;
    // GuildMemberRoleManager exposes .cache (Collection); raw API payloads give a string[]
    const roleCount: number = roles?.cache?.size ?? (Array.isArray(roles) ? roles.length : 0);

  const isSetupInteraction = (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit())
    && typeof (interaction as any).customId === "string"
    && isNewServerSetupCustomId((interaction as any).customId);

    if (roleCount <= 1) {
      if ((interaction.isStringSelectMenu() || interaction.isButton()) && typeof (interaction as any).customId === "string") { const handledMenuDepartment = await handleMenuDepartmentInteraction(interaction as any); if (handledMenuDepartment) return; } if (("customId" in interaction) && typeof (interaction as any).customId === "string" && (interaction as any).customId.startsWith("ns_")) {
  const handled = await handleNewServerSetupInteraction(interaction as any);
  if (handled) return;
}
if (interaction.isAutocomplete()) {
        await interaction.respond([]).catch(() => {});
      } else if (interaction.isRepliable()) {
        await interaction.reply({
          content: "❌ You must have a role assigned in this server to use the bot.",
          ephemeral: true,
        }).catch(() => {});
      }
      return;
    }
  }

  if (interaction.isAutocomplete()) {
    const client = interaction.client as any;
    const command = client.commands?.get(interaction.commandName);
    if (!command?.autocomplete) return;
    try { await command.autocomplete(interaction); } catch (err) { console.error("Autocomplete error:", err); }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const client = interaction.client as any;
    const command = client.commands?.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      const errorMsg = { content: "An error occurred while executing that command.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg).catch(() => {});
      else await interaction.reply(errorMsg).catch(() => {});
    }
    return;
  }

  if (interaction.isButton()) {
    try { await handleButton(interaction); }
    catch (err) {
      console.error(`[button] ${interaction.customId}:`, err);
      const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    try { await handleSelectMenu(interaction); }
    catch (err) {
      console.error(`[select] ${interaction.customId}:`, err);
      const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try { await handleModal(interaction); }
    catch (err) {
      console.error(`[modal] ${interaction.customId}:`, err);
      const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {});
      else await interaction.reply(msg).catch(() => {});
    }
  }
}

// ── Button handler ─────────────────────────────────────────────────────────────
async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId?.startsWith("ns_")) {
    const handled = await handleNewServerSetupInteraction(interaction);
    if (handled) return;
  }

  const parts = interaction.customId.split(":");
  const [action, secondPart, userId, purchaseType] = parts;

  // ── Team request commissioner buttons (treq_link|uid|team, treq_deny|uid|team) ─
  if (interaction.customId.startsWith("treq_link|")) { await handleTreqLinkButton(interaction); return; }
  if (interaction.customId.startsWith("treq_deny|")) { await handleTreqDenyButton(interaction); return; }

  // ── Admin troubleshoot panel buttons ─────────────────────────────────────────
  if (action === "ts_repair_records")    { await handleTsRepairRecords(interaction);    return; }
  if (action === "ts_resync_data")       { await handleTsResyncData(interaction);       return; }
  if (action === "ts_eos_testrun")       { await handleTsEosTestRun(interaction);       return; }
  if (action === "ts_repair_playoff")    { await handleTsRepairPlayoff(interaction);    return; }
  if (action === "ts_playoff_proceed")   { await handleTsPlayoffProceed(interaction);   return; }
  if (action === "ts_playoff_confirm")   { await handleTsPlayoffConfirm(interaction);   return; }
  if (action === "ts_playoff_cancel")    { await handleTsPlayoffCancel(interaction);    return; }
  if (action === "ts_eos_manual")        { await handleTsEosManual(interaction);        return; }
  if (action === "ts_eos_manual_confirm"){ await handleTsEosManualConfirm(interaction); return; }
  if (action === "ts_eos_manual_cancel") { await handleTsEosManualCancel(interaction);  return; }
  if (action === "ts_eos_reset")         { await handleTsEosReset(interaction);         return; }
  if (action === "ts_eos_reset_confirm") { await handleTsEosResetConfirm(interaction);  return; }
  if (action === "ts_eos_reset_cancel")  { await handleTsEosResetCancel(interaction);   return; }
  if (action === "ts_repair_schedules")  { await handleTsRepairSchedules(interaction);  return; }
  if (action === "ts_sched_review_week") { await handleTsSchedReviewWeek(interaction);  return; }
  if (action === "ts_sched_delete")      { await handleTsSchedDelete(interaction);      return; }
  if (action === "ts_import_schedule")   { await handleTsImportSchedule(interaction);   return; }

  // ── League Data wizard — all ld_ prefixed buttons ─────────────────────────
  if (action?.startsWith("ld_")) {
    await handleLeagueDataButton(interaction);
    return;
  }

  // ── League Operations / Commissioner Office intercept ─────────────────────
  // league-ops button intercept
  if (interaction.customId === "ac_commissioner_office" || interaction.customId === "ac_league_ops_back") {
    await handleActionsInteraction(interaction);
    return;
  }

  // ── Actions hub — dispatch all ac_ prefixed interactions ─────────────────────
  if (action?.startsWith("ac_")) {
    const handledDept = await handleMenuDepartmentInteraction(interaction as any);
    if (handledDept) return;
    await handleActionsInteraction(interaction);
    return;
  }

  // ── Admin Operations hub — dispatch all ao_ prefixed interactions ─────────────
  if (action?.startsWith("ao_")) {
    const handled = await handleAdminOperationsInteraction(interaction);
    if (handled) return;
  }

  // ── Archetype viewer — archetype nav ─────────────────────────────────────────
  // Button IDs: vca_prev:POSITION:IDX   vca_next:POSITION:IDX
  if (action === "vca_prev" || action === "vca_next") {
    const position = secondPart ?? "";
    const idx      = parseInt(parts[2] ?? "0", 10);
    await handleVcaNav(interaction, action === "vca_prev" ? "prev" : "next", position, idx);
    return;
  }

  // ── Archetype viewer — attribute page nav ─────────────────────────────────────
  // Button IDs: vca_apage_prev:POSITION:ARCHIDX:ATTRPAGE  vca_apage_next:...
  if (action === "vca_apage_prev" || action === "vca_apage_next") {
    const position    = secondPart ?? "";
    const archIdx     = parseInt(parts[2] ?? "0", 10);
    const attrPage    = parseInt(parts[3] ?? "0", 10);
    await handleVcaAttrPageNav(interaction, action === "vca_apage_prev" ? "prev" : "next", position, archIdx, attrPage);
    return;
  }

  // ── Purchase flow — attribute page nav ────────────────────────────────────────
  // Button IDs: ccp_apage_prev:sessionId   ccp_apage_next:sessionId
  if (action === "ccp_apage_prev") { await handleCcpAttrPagePrev(interaction, secondPart ?? ""); return; }
  if (action === "ccp_apage_next") { await handleCcpAttrPageNext(interaction, secondPart ?? ""); return; }

  // ── Purchase flow — archetype browser nav ─────────────────────────────────────
  if (action === "ccp_arch_prev") { await handleCcpArchPrev(interaction, secondPart ?? ""); return; }
  if (action === "ccp_arch_next") { await handleCcpArchNext(interaction, secondPart ?? ""); return; }
  if (action === "ccp_arch_pick") { await handleCcpArchPick(interaction, secondPart ?? ""); return; }

  // ── Purchase flow — attribute selector page nav ───────────────────────────────
  if (action === "ccp_asel_prev") { await handleCcpAttrSelPrev(interaction, secondPart ?? ""); return; }
  if (action === "ccp_asel_next") { await handleCcpAttrSelNext(interaction, secondPart ?? ""); return; }

  // ── Custom player builder ─────────────────────────────────────────────────────
  if (action === "ccp_attr_plus1")  { await handleCcpAttrAdjust(interaction, secondPart ?? "", 1);  return; }
  if (action === "ccp_attr_minus1") { await handleCcpAttrAdjust(interaction, secondPart ?? "", -1); return; }
  if (action === "ccp_submit_attrs")  { await handleCcpSubmitAttrs(interaction, secondPart ?? "");    return; }
  if (action === "ccp_preconfirm")    { await handleCcpPreConfirm(interaction, secondPart ?? "");    return; }
  if (action === "ccp_confirm")       { await handleCcpConfirm(interaction, secondPart ?? "");        return; }
  if (action === "ccp_cancel")        { await handleCcpCancel(interaction, secondPart ?? "");         return; }
  if (action === "ccp_applied")       { await handleCcpApplied(interaction, secondPart ?? "");        return; }
  if (action === "ccp_refund")        { await handleCcpRefund(interaction, secondPart ?? "");         return; }

  // ── Draft presence — per-user toggle ─────────────────────────────────────
  if (action === DRAFT_TOGGLE_PREFIX) {
    await interaction.deferUpdate();
    const targetDiscordId = secondPart ?? "";

    // Permission check: only the target user or an admin may click this button
    const clickerId  = interaction.user.id;
    const isSelfToggle = clickerId === targetDiscordId;

    let isAdmin = false;
    if (!isSelfToggle) {
      const member = interaction.guild?.members.cache.get(clickerId)
        ?? await interaction.guild?.members.fetch(clickerId).catch(() => null);
      const hasDiscordAdmin = member?.permissions.has(0x8n) ?? false; // ADMINISTRATOR bit
      const hasDbAdmin      = await isAdminUser(clickerId, interaction.guildId!);
      isAdmin = hasDiscordAdmin || hasDbAdmin;
    }

    if (!isSelfToggle && !isAdmin) {
      await interaction.followUp({
        content: "❌ You can only toggle your own presence status.",
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.guildId ?? "";
    const session = await getActiveSession(guildId);
    if (!session) {
      await interaction.followUp({ content: "⚠️ No active draft session.", ephemeral: true });
      return;
    }

    const newStatus = await togglePresence(session.id, targetDiscordId);
    if (newStatus === null) {
      await interaction.followUp({
        content: "⚠️ That user is not registered in the league.",
        ephemeral: true,
      });
      return;
    }

    await refreshPresence(interaction.client, session.id);

    const label = isSelfToggle
      ? `You are now **${newStatus ? "Present ✅" : "Away 🔴"}**`
      : `<@${targetDiscordId}> is now **${newStatus ? "Present ✅" : "Away 🔴"}**`;

    await interaction.followUp({ content: label, ephemeral: true });
    return;
  }

  // ── Draft presence — close button ─────────────────────────────────────────
  if (action === DRAFT_CLOSE_BUTTON_ID) {
    await interaction.deferUpdate();

    const member = interaction.guild?.members.cache.get(interaction.user.id)
      ?? await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const hasDiscordAdmin = member?.permissions.has(0x8n) ?? false;
    const hasDbAdmin      = await isAdminUser(interaction.user.id, interaction.guildId!);

    if (!hasDiscordAdmin && !hasDbAdmin) {
      await interaction.followUp({
        content: "❌ Only admins can close the draft.",
        ephemeral: true,
      });
      return;
    }

    const session = await getActiveSession(interaction.guildId ?? "");
    if (!session) {
      await interaction.followUp({ content: "⚠️ No active draft session.", ephemeral: true });
      return;
    }

    await interaction.followUp({
      content: "✅ Closing draft room… channel will be deleted in 10 seconds.",
      ephemeral: true,
    });

    endDraftSession(interaction.client, session.id).catch(console.error);
    return;
  }

  // ── Co-Commissioner action approval ────────────────────────────────────────
  if (action === "cocomm-approve" || action === "cocomm-deny") {
    await interaction.deferUpdate();
    // Only full Commissioners (not Co-Commissioners) can approve/deny
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const isFullCommissioner = member?.roles.cache.some(r => r.name === "Commissioner") ?? false;
    if (!isFullCommissioner) {
      await interaction.followUp({ content: "❌ Only Commissioners can approve or deny Co-Commissioner actions.", ephemeral: true });
      return;
    }

    purgeExpiredCoCommActions();
    const actionId = secondPart ?? "";
    const pending  = pendingCoCommActions.get(actionId);

    if (!pending) {
      const expiredEmbed = new EmbedBuilder()
        .setColor(Colors.Grey)
        .setTitle("⏰ Action Expired or Already Handled")
        .setDescription("This Co-Commissioner action is no longer pending.")
        .setTimestamp();
      await interaction.editReply({ embeds: [expiredEmbed], components: [] }).catch(() => {});
      return;
    }

    if (action === "cocomm-deny") {
      pendingCoCommActions.delete(actionId);
      const deniedEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("❌ Co-Commissioner Action Denied")
        .addFields(
          { name: "Requested By", value: `<@${pending.issuerId}>`, inline: true },
          { name: "Denied By",    value: `<@${interaction.user.id}>`, inline: true },
          { name: "Action",       value: pending.summaryText },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [deniedEmbed], components: [] }).catch(() => {});
      return;
    }

    // Approve — execute the action
    pendingCoCommActions.delete(actionId);
    const ctx: AdminActionContext = {
      client:  interaction.client,
      guild:   interaction.guild,
      actorId: pending.issuerId,
    };
    const result = await executeAdminAction(pending.action, ctx);
    const approvedEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Co-Commissioner Action Approved & Executed")
      .addFields(
        { name: "Requested By", value: `<@${pending.issuerId}>`, inline: true },
        { name: "Approved By",  value: `<@${interaction.user.id}>`, inline: true },
        { name: "Action",       value: pending.summaryText },
        { name: "Result",       value: result },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [approvedEmbed], components: [] }).catch(() => {});
    return;
  }

  // ── Purchase: approve ────────────────────────────────────────────────────────
  if (action === "approve_purchase") {
    const purchaseId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId)).limit(1);
    const purchase = purchases[0];
    if (!purchase)                      { await interaction.followUp({ content: "❌ Purchase not found.",  ephemeral: true }); return; }
    if (purchase.status === "approved") { await interaction.followUp({ content: "⚠️ Already approved.",    ephemeral: true }); return; }
    if (purchase.status === "refunded") { await interaction.followUp({ content: "⚠️ Already refunded.",    ephemeral: true }); return; }

    await db.update(purchasesTable).set({ status: "approved", approvedAt: new Date() }).where(eq(purchasesTable.id, purchaseId));

    if (purchaseType === "legend" && purchase.legendId) {
      // Look up the owner's current team so the inventory entry is stamped with the team,
      // not the user — this makes the inventory follow the franchise across ownership changes.
      const ownerTeamRows = await db
        .select({ team: usersTable.team })
        .from(usersTable)
        .where(and(eq(usersTable.discordId, userId!), eq(usersTable.guildId, interaction.guildId!)))
        .limit(1);
      const ownerTeam = ownerTeamRows[0]?.team ?? null;

      await db.insert(inventoryTable).values({
        discordId: userId!, seasonId: purchase.seasonId, purchaseId: purchase.id,
        itemType: "legend", legendId: purchase.legendId,
        legendName: purchase.playerName, playerPosition: purchase.playerPosition,
        legendCategory: "current",
        team: ownerTeam,
      });
      await db.update(legendsTable).set({ isAvailable: false }).where(eq(legendsTable.id, purchase.legendId));
    }

    const purchaseTypeLabel: Record<string, string> = {
      legend: "Legend Player",
      attribute: "Attribute Upgrade",
      dev_up: "Dev Upgrade",
      age_reset: "Age Reset",
      custom_player_bronze: "Custom Player (Bronze)",
      custom_player_silver: "Custom Player (Silver)",
      custom_player_gold: "Custom Player (Gold)",
    };
    const itemLabel = purchaseTypeLabel[purchaseType ?? ""] ?? (purchaseType ?? "Store Purchase");
    const itemName = purchase.playerName ?? purchase.attributeName ?? "(unnamed)";
    const purchaseDescLines = [
      `**User:** <@${userId}>`,
      `**Item:** ${itemLabel} — ${itemName}${purchase.playerPosition ? ` (${purchase.playerPosition})` : ""}`,
      `**Cost:** ${purchase.cost.toLocaleString()} coins`,
      purchase.notes ? `**Notes:** ${purchase.notes}` : null,
      `\n✅ Applied in-game by ${interaction.user.toString()}`,
    ].filter(Boolean).join("\n");

    const approvedEmbed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Applied In-Game")
      .setDescription(purchaseDescLines)
      .setFooter({ text: `Purchase #${purchaseId} • Season ${purchase.seasonId}` })
      .setTimestamp();
    await interaction.editReply({
      embeds: [approvedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("approved_done").setLabel("✅ Applied").setStyle(ButtonStyle.Success).setDisabled(true),
      )],
    });

    try {
      const user = await interaction.client.users.fetch(userId!);
      let msg = "";
      if (purchaseType === "legend")                      msg = `🏆 Your legend **${purchase.playerName}** has been added to the draft pool! Check \`/inventory\`.`;
      else if (purchaseType === "attribute")              msg = `⚡ Your **${purchase.attributeName}** attribute upgrade has been applied!`;
      else if (purchaseType === "dev_up")                 msg = `📈 Your dev upgrade for **${purchase.playerName}** has been applied!`;
      else if (purchaseType === "age_reset")              msg = `🔄 Your age reset for **${purchase.playerName}** has been applied!`;
      else if (purchaseType?.startsWith("custom_player")) msg = `🎨 Your custom player **${purchase.playerName}** has been applied!`;
      await user.send(`✅ **Purchase #${purchaseId} Approved!**\n${msg}`).catch(() => {});
    } catch (_) {}

    // ── Draft tracker post (legend + custom player only) ──────────────────────
    if (purchaseType === "legend" || purchaseType?.startsWith("custom_player")) {
      try {
        const draftTrackerChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.DRAFT_TRACKER);
        const draftChannel = draftTrackerChannelId ? await interaction.client.channels.fetch(draftTrackerChannelId).catch(() => null) : null;
        if (draftChannel?.isTextBased()) {
          const tierLabel = purchaseType?.startsWith("custom_player")
            ? ` (${purchaseType.replace("custom_player_", "").toUpperCase()} tier)`
            : "";
          const itemLabel = purchaseType === "legend" ? "Legend" : "Custom Player";

          const draftEmbed = new EmbedBuilder()
            .setColor(Colors.Gold)
            .setTitle(`🏈 ${itemLabel} Purchase — Draft Tracker`)
            .addFields(
              { name: "Player",    value: `<@${userId}>`, inline: true },
              { name: "Item",      value: `${purchase.playerName ?? "Unknown"}${tierLabel}`, inline: true },
              { name: "Purchase",  value: `#${purchaseId}`, inline: true },
            )
            .setTimestamp();

          const draftRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`draft_drafted:${purchaseId}`)
              .setLabel("✅ Drafted")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`draft_revoked:${purchaseId}`)
              .setLabel("❌ Revoked")
              .setStyle(ButtonStyle.Danger),
          );

          const draftMsg = await (draftChannel as any).send({ embeds: [draftEmbed], components: [draftRow] });
          await db.update(purchasesTable)
            .set({ draftTrackerMessageId: draftMsg.id })
            .where(eq(purchasesTable.id, purchaseId));
        }
      } catch (err) { console.error("Failed to post to draft tracker channel:", err); }

      // ── General channel announcement (legend only) ──────────────────────────
      if (purchaseType === "legend") {
        try {
          const generalChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.GENERAL);
          const generalChannel = generalChannelId ? await interaction.client.channels.fetch(generalChannelId).catch(() => null) : null;
          if (generalChannel?.isTextBased()) {
            const announceEmbed = new EmbedBuilder()
              .setColor(Colors.Gold)
              .setTitle("🏆 Legend Purchased!")
              .setDescription(`<@${userId}> just acquired **${purchase.playerName ?? "a Legend"}** from the store!`)
              .setTimestamp();
            await (generalChannel as any).send({ embeds: [announceEmbed] });
          }
        } catch (err) { console.error("Failed to post legend announcement to general channel:", err); }
      }
    }
    return;
  }

  // ── Purchase: refund ─────────────────────────────────────────────────────────
  if (action === "refund_purchase") {
    const purchaseId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId)).limit(1);
    const purchase = purchases[0];
    if (!purchase)                      { await interaction.followUp({ content: "❌ Purchase not found.", ephemeral: true }); return; }
    if (purchase.status === "refunded") { await interaction.followUp({ content: "⚠️ Already refunded.",  ephemeral: true }); return; }

    await db.update(purchasesTable).set({ status: "refunded" }).where(eq(purchasesTable.id, purchaseId));
    await addBalance(userId!, purchase.cost, interaction.guildId!);
    await logTransaction(userId!, purchase.cost, "purchase_refund",
      `Refund: ${purchase.purchaseType.replace(/_/g, " ")}${purchase.playerName ? ` — ${purchase.playerName}` : ""}`,
      interaction.guildId!, interaction.user.id);

    if (purchase.purchaseType === "attribute" && purchase.attributeName && purchase.seasonId) {
      const qtyMatch = purchase.notes?.match(/qty:(\d+)/);
      const attrQty  = qtyMatch ? parseInt(qtyMatch[1]!, 10) : 1;
      const isCore   = CORE_ATTRIBUTES.has(purchase.attributeName);
      if (isCore) {
        await db.update(seasonStatsTable)
          .set({ coreAttrPurchased: sql`GREATEST(0, ${seasonStatsTable.coreAttrPurchased} - ${attrQty})` })
          .where(and(eq(seasonStatsTable.discordId, userId!), eq(seasonStatsTable.seasonId, purchase.seasonId)));
      } else {
        await db.update(seasonStatsTable)
          .set({ nonCoreAttrPurchased: sql`GREATEST(0, ${seasonStatsTable.nonCoreAttrPurchased} - ${attrQty})` })
          .where(and(eq(seasonStatsTable.discordId, userId!), eq(seasonStatsTable.seasonId, purchase.seasonId)));
      }
    }

    if (purchaseType === "legend") {
      await db.update(usersTable)
        .set({ totalLegendPurchases: sql`GREATEST(0, ${usersTable.totalLegendPurchases} - 1)`, updatedAt: new Date() })
        .where(eq(usersTable.discordId, userId!));
    }
    await db.delete(inventoryTable).where(and(eq(inventoryTable.purchaseId, purchaseId), eq(inventoryTable.discordId, userId!)));

    const refundedEmbed = new EmbedBuilder()
      .setColor(Colors.Red).setTitle("🔄 Purchase Refunded")
      .setDescription(`Purchase **#${purchaseId}** refunded. **${purchase.cost.toLocaleString()} coins** returned.\nRefunded by: ${interaction.user.toString()}`)
      .setTimestamp();
    await interaction.editReply({
      embeds: [refundedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("refunded_done").setLabel("🔄 Refunded").setStyle(ButtonStyle.Danger).setDisabled(true),
      )],
    });

    try {
      const user = await interaction.client.users.fetch(userId!);
      await user.send(`🔄 **Purchase #${purchaseId} Refunded**\n**${purchase.cost.toLocaleString()} coins** returned to your balance.`).catch(() => {});
    } catch (_) {}
    return;
  }

  // ── Draft tracker: drafted (remove message) ──────────────────────────────────
  if (action === "draft_drafted") {
    const purchaseId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();
    try {
      await interaction.message.delete();
    } catch (err) { console.error("Failed to delete draft tracker message:", err); }
    return;
  }

  // ── Draft tracker: revoked (refund + remove message) ─────────────────────────
  if (action === "draft_revoked") {
    const purchaseId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    const purchases = await db.select().from(purchasesTable).where(eq(purchasesTable.id, purchaseId)).limit(1);
    const purchase = purchases[0];
    if (!purchase) { await interaction.followUp({ content: "❌ Purchase not found.", ephemeral: true }); return; }
    if (purchase.status === "refunded") { await interaction.followUp({ content: "⚠️ Already refunded.", ephemeral: true }); return; }

    const buyerId = purchase.discordId;

    // Refund coins
    await db.update(purchasesTable).set({ status: "refunded" }).where(eq(purchasesTable.id, purchaseId));
    await addBalance(buyerId, purchase.cost, interaction.guildId!);
    await logTransaction(buyerId, purchase.cost, "purchase_refund",
      `Draft revoked: ${purchase.purchaseType.replace(/_/g, " ")}${purchase.playerName ? ` — ${purchase.playerName}` : ""}`,
      interaction.guildId!, interaction.user.id);

    if (purchase.purchaseType === "attribute" && purchase.attributeName && purchase.seasonId) {
      const qtyMatch = purchase.notes?.match(/qty:(\d+)/);
      const attrQty  = qtyMatch ? parseInt(qtyMatch[1]!, 10) : 1;
      const isCore   = CORE_ATTRIBUTES.has(purchase.attributeName);
      if (isCore) {
        await db.update(seasonStatsTable)
          .set({ coreAttrPurchased: sql`GREATEST(0, ${seasonStatsTable.coreAttrPurchased} - ${attrQty})` })
          .where(and(eq(seasonStatsTable.discordId, buyerId), eq(seasonStatsTable.seasonId, purchase.seasonId)));
      } else {
        await db.update(seasonStatsTable)
          .set({ nonCoreAttrPurchased: sql`GREATEST(0, ${seasonStatsTable.nonCoreAttrPurchased} - ${attrQty})` })
          .where(and(eq(seasonStatsTable.discordId, buyerId), eq(seasonStatsTable.seasonId, purchase.seasonId)));
      }
    }

    // Restore legend to store if applicable
    if (purchase.purchaseType === "legend" && purchase.legendId) {
      await db.update(legendsTable).set({ isAvailable: true }).where(eq(legendsTable.id, purchase.legendId));
      await db.update(usersTable)
        .set({ totalLegendPurchases: sql`GREATEST(0, ${usersTable.totalLegendPurchases} - 1)`, updatedAt: new Date() })
        .where(eq(usersTable.discordId, buyerId));
    }

    // Remove from inventory
    await db.delete(inventoryTable).where(eq(inventoryTable.purchaseId, purchaseId));

    // DM the buyer
    try {
      const buyer = await interaction.client.users.fetch(buyerId);
      const itemLabel = purchase.playerName ?? purchase.purchaseType.replace(/_/g, " ");
      await buyer.send(
        `❌ **Your ${itemLabel} purchase (#${purchaseId}) has been revoked by the commissioner.**\n` +
        `**${purchase.cost.toLocaleString()} coins** have been returned to your balance.`
      ).catch(() => {});
    } catch (_) {}

    // Delete the draft tracker message
    try {
      await interaction.message.delete();
    } catch (err) { console.error("Failed to delete draft tracker message after revoke:", err); }
    return;
  }


  // ── Interview: approve ───────────────────────────────────────────────────────
  // ── Wager: opponent accepts ───────────────────────────────────────────────
  if (action === "wager_accept") {
    const wagerId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    const rows = await db.select().from(wagersTable).where(eq(wagersTable.id, wagerId)).limit(1);
    const wager = rows[0];
    if (!wager) { await interaction.followUp({ content: "❌ Wager not found.", ephemeral: true }); return; }
    if (wager.status !== "pending") {
      await interaction.followUp({ content: `⚠️ This wager is no longer pending (status: **${wager.status}**).`, ephemeral: true });
      return;
    }
    if (interaction.user.id !== wager.opponentId) {
      await interaction.followUp({ content: "❌ Only the challenged player can accept this wager.", ephemeral: true });
      return;
    }

    // Verify both users still have sufficient funds — scoped to the wager's guild
    const wagerGuildId = wager.guildId ?? interaction.guildId!;
    const [challengerRow] = await db.select({ balance: usersTable.balance })
      .from(usersTable).where(and(eq(usersTable.discordId, wager.challengerId), eq(usersTable.guildId, wagerGuildId))).limit(1);
    const [opponentRow] = await db.select({ balance: usersTable.balance })
      .from(usersTable).where(and(eq(usersTable.discordId, wager.opponentId), eq(usersTable.guildId, wagerGuildId))).limit(1);

    const challengerBal = challengerRow?.balance ?? 0;
    const opponentBal   = opponentRow?.balance   ?? 0;

    if (challengerBal < wager.amount) {
      await db.update(wagersTable).set({ status: "cancelled" }).where(eq(wagersTable.id, wagerId));
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(Colors.Red).setTitle("❌ Wager Cancelled")
          .setDescription(`<@${wager.challengerId}> no longer has enough coins to cover this wager.\n**Wager #${wagerId}** has been cancelled.`)
          .setTimestamp()],
        components: [],
      });
      return;
    }
    if (opponentBal < wager.amount) {
      await interaction.followUp({
        content: `❌ You don't have enough coins. Balance: **${opponentBal.toLocaleString()}**, wager: **${wager.amount.toLocaleString()}**.`,
        ephemeral: true,
      });
      return;
    }

    // Deduct from both — coins go into holding (tracked by wager record)
    await addBalance(wager.challengerId, -wager.amount, wagerGuildId);
    await logTransaction(wager.challengerId, -wager.amount, "removecoins",
      `Wager #${wagerId} held: ${wager.teamFor} vs ${wager.teamAgainst}`, wagerGuildId, wager.opponentId);

    await addBalance(wager.opponentId, -wager.amount, wagerGuildId);
    await logTransaction(wager.opponentId, -wager.amount, "removecoins",
      `Wager #${wagerId} held: ${wager.teamAgainst} vs ${wager.teamFor}`, wagerGuildId, wager.challengerId);

    await db.update(wagersTable).set({ status: "active" }).where(eq(wagersTable.id, wagerId));

    // Resolve display names for embed field names (mentions don't render in field names)
    const challengerMember = await interaction.guild?.members.fetch(wager.challengerId).catch(() => null);
    const opponentMember   = await interaction.guild?.members.fetch(wager.opponentId).catch(() => null);
    const challengerName   = challengerMember?.displayName ?? wager.challengerUsername;
    const opponentName     = opponentMember?.displayName   ?? wager.opponentUsername;

    // Edit the challenge message to show active state
    const activeEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("⚔️ Wager Active — Awaiting Result")
      .setDescription(`<@${wager.challengerId}> vs <@${wager.opponentId}>`)
      .addFields(
        { name: "💰 Pot",                           value: `**${wager.pot.toLocaleString()} coins** in holding` },
        { name: `🏈 ${challengerName} is taking`,  value: `**${wager.teamFor}**`,    inline: true },
        { name: `🏈 ${opponentName} is taking`,    value: `**${wager.teamAgainst}**`, inline: true },
        { name: "📋 Status",                       value: "🔒 Coins held — commissioner will declare the winner" },
      )
      .setFooter({ text: `Wager #${wagerId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [activeEmbed], components: [] });

    // Post to commissioner channel with winner buttons
    const commChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.COMMISSIONER);
    // Derive home/away team names from wager fields
    const homeTeamLabel = wager.challengerSide === "home" ? wager.teamFor : wager.teamAgainst;
    const awayTeamLabel = wager.challengerSide === "away" ? wager.teamFor : wager.teamAgainst;
    const spreadInfo    = wager.spread !== null && wager.spread !== undefined
      ? `Challenger's spread: **${wager.spread > 0 ? "+" : ""}${wager.spread}** on ${wager.teamFor}`
      : "No spread set (straight win)";

    const commEmbed = new EmbedBuilder()
      .setColor(Colors.Gold)
      .setTitle("⚔️ Wager — Confirm Result")
      .setDescription("Enter the **final score margin** (home score − away score) and the spread will be applied automatically to determine the winner.")
      .addFields(
        { name: "🏠 Home Team",                value: `**${homeTeamLabel}** — <@${wager.challengerSide === "home" ? wager.challengerId : wager.opponentId}>`, inline: true },
        { name: "✈️ Away Team",                value: `**${awayTeamLabel}** — <@${wager.challengerSide === "away" ? wager.challengerId : wager.opponentId}>`, inline: true },
        { name: "💰 Pot",                      value: `**${wager.pot.toLocaleString()} coins**`, inline: false },
        { name: "📊 Spread",                   value: spreadInfo, inline: false },
      )
      .setFooter({ text: `Wager #${wagerId} • Enter the margin via "Confirm Home Win" or "Confirm Away Win"` })
      .setTimestamp();

    const commRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`wager_confirm:home:${wagerId}`)
        .setLabel(`🏠 Confirm Home Win`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`wager_confirm:away:${wagerId}`)
        .setLabel(`✈️ Confirm Away Win`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`wager_rescind:${wagerId}`)
        .setLabel("↩️ Rescind")
        .setStyle(ButtonStyle.Danger),
    );

    try {
      const commChannel = await interaction.client.channels.fetch(commChannelId);
      if (commChannel?.isTextBased()) {
        const commMsg = await (commChannel as any).send({ embeds: [commEmbed], components: [commRow] });
        await db.update(wagersTable)
          .set({ commissionerMessageId: commMsg.id })
          .where(eq(wagersTable.id, wagerId));
      }
    } catch (err) { console.error("Failed to post wager to commissioner channel:", err); }

    // DM both players
    for (const [uid, myTeam, theirTeam] of [
      [wager.challengerId, wager.teamFor,    wager.teamAgainst],
      [wager.opponentId,   wager.teamAgainst, wager.teamFor],
    ] as [string, string, string][]) {
      try {
        const u = await interaction.client.users.fetch(uid);
        await u.send(
          `⚔️ **Wager #${wagerId} is now active!**\n` +
          `**${wager.amount.toLocaleString()} coins** have been held from your balance.\n` +
          `You are taking **${myTeam}** against **${theirTeam}**.\n` +
          `The commissioner will declare the winner once the game is played. The pot of **${wager.pot.toLocaleString()} coins** goes to the winner.`
        ).catch(() => {});
      } catch (_) {}
    }
    return;
  }

  // ── Wager: opponent refuses ───────────────────────────────────────────────
  if (action === "wager_refuse") {
    const wagerId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    const rows = await db.select().from(wagersTable).where(eq(wagersTable.id, wagerId)).limit(1);
    const wager = rows[0];
    if (!wager) { await interaction.followUp({ content: "❌ Wager not found.", ephemeral: true }); return; }
    if (wager.status !== "pending") {
      await interaction.followUp({ content: `⚠️ This wager is no longer pending (status: **${wager.status}**).`, ephemeral: true });
      return;
    }
    if (interaction.user.id !== wager.opponentId) {
      await interaction.followUp({ content: "❌ Only the challenged player can refuse this wager.", ephemeral: true });
      return;
    }

    await db.update(wagersTable)
      .set({ status: "refused", resolvedAt: new Date(), resolvedBy: interaction.user.id })
      .where(eq(wagersTable.id, wagerId));

    const refusedEmbed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle("❌ Wager Refused")
      .setDescription(`<@${wager.opponentId}> refused the wager challenge from <@${wager.challengerId}>.`)
      .addFields(
        { name: `🏈 <@${wager.challengerId}> was taking`, value: `**${wager.teamFor}**`,    inline: true },
        { name: `🏈 <@${wager.opponentId}> was taking`,   value: `**${wager.teamAgainst}**`, inline: true },
      )
      .setFooter({ text: `Wager #${wagerId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [refusedEmbed], components: [] });

    // DM the challenger
    try {
      const challenger = await interaction.client.users.fetch(wager.challengerId);
      await challenger.send(
        `❌ <@${wager.opponentId}> (**${wager.opponentUsername}**) refused your wager challenge.\n` +
        `Wager #${wagerId} (${wager.teamFor} vs ${wager.teamAgainst}) — no coins were deducted.`
      ).catch(() => {});
    } catch (_) {}
    return;
  }

  // ── Wager: commissioner opens margin modal (Confirm Home/Away Win) ────────
  if (action === "wager_confirm") {
    // customId format: wager_confirm:<home|away>:<wagerId>
    const winningSide = secondPart as "home" | "away";  // "home" or "away"
    const wagerId     = parseInt(parts[2] ?? "0", 10);

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.reply({ content: "❌ Only commissioners can confirm wager results.", ephemeral: true });
      return;
    }

    const [wager] = await db.select().from(wagersTable).where(eq(wagersTable.id, wagerId)).limit(1);
    if (!wager) { await interaction.reply({ content: "❌ Wager not found.", ephemeral: true }); return; }
    if (wager.status !== "active") {
      await interaction.reply({ content: `⚠️ This wager is not active (status: **${wager.status}**).`, ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`wager_margin:${winningSide}:${wagerId}`)
      .setTitle(`Enter Final Score`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("home_score")
            .setLabel("Home Team Score")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. 28")
            .setRequired(true)
            .setMaxLength(3),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("away_score")
            .setLabel("Away Team Score")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g. 21")
            .setRequired(true)
            .setMaxLength(3),
        ),
      );
    await interaction.showModal(modal);
    return;
  }

  // ── Wager: commissioner rescinds (refunds both sides) ─────────────────────
  if (action === "wager_rescind") {
    const wagerId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.followUp({ content: "❌ Only commissioners can rescind wagers.", ephemeral: true });
      return;
    }

    const [wager] = await db.select().from(wagersTable).where(eq(wagersTable.id, wagerId)).limit(1);
    if (!wager) { await interaction.followUp({ content: "❌ Wager not found.", ephemeral: true }); return; }
    if (wager.status !== "active") {
      await interaction.followUp({ content: `⚠️ This wager is not active (status: **${wager.status}**).`, ephemeral: true });
      return;
    }

    const wagerGuildId = wager.guildId ?? interaction.guildId!;
    await addBalance(wager.challengerId, wager.amount, wagerGuildId);
    await logTransaction(wager.challengerId, wager.amount, "addcoins", `Wager #${wagerId} rescinded — refund`, wagerGuildId, interaction.user.id);
    await addBalance(wager.opponentId, wager.amount, wagerGuildId);
    await logTransaction(wager.opponentId, wager.amount, "addcoins", `Wager #${wagerId} rescinded — refund`, wagerGuildId, interaction.user.id);

    await db.update(wagersTable).set({ status: "rescinded", resolvedAt: new Date(), resolvedBy: interaction.user.id }).where(eq(wagersTable.id, wagerId));

    const embed = new EmbedBuilder()
      .setColor(Colors.Grey)
      .setTitle("↩️ Wager Rescinded")
      .setDescription(`Wager #${wagerId} has been rescinded by <@${interaction.user.id}>.\nBoth players have been refunded **${wager.amount.toLocaleString()} coins**.`)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed], components: [] });

    for (const uid of [wager.challengerId, wager.opponentId]) {
      try {
        const u = await interaction.client.users.fetch(uid);
        await u.send(`↩️ **Wager #${wagerId} has been rescinded** by a commissioner. Your **${wager.amount.toLocaleString()} coins** have been refunded.`).catch(() => {});
      } catch (_) {}
    }
    return;
  }

  // ── Stream payout: approve ───────────────────────────────────────────────────
  if (action === "stream_approve") {
    const payoutId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.followUp({ content: "❌ Only commissioners can approve payouts.", ephemeral: true });
      return;
    }

    const [payout] = await db
      .select().from(pendingChannelPayoutsTable)
      .where(eq(pendingChannelPayoutsTable.id, payoutId))
      .limit(1);

    if (!payout) { await interaction.followUp({ content: "❌ Payout record not found.", ephemeral: true }); return; }
    if (payout.status !== "pending") {
      await interaction.followUp({ content: `⚠️ This payout has already been **${payout.status}**.`, ephemeral: true });
      return;
    }

    // Award coins to streamer
    await addBalance(payout.discordId, payout.amount, interaction.guildId!);
    await logTransaction(payout.discordId, payout.amount, "addcoins",
      `Stream payout — Week ${payout.week}`, interaction.guildId!, interaction.user.id);

    // Award coins to H2H opponent if applicable
    if (payout.opponentDiscordId && payout.opponentAmount) {
      await addBalance(payout.opponentDiscordId, payout.opponentAmount, interaction.guildId!);
      await logTransaction(payout.opponentDiscordId, payout.opponentAmount, "addcoins",
        `Stream payout (opponent) — Week ${payout.week}`, interaction.guildId!, interaction.user.id);
    }

    await db.update(pendingChannelPayoutsTable)
      .set({ status: "approved", resolvedAt: new Date(), resolvedBy: interaction.user.id })
      .where(eq(pendingChannelPayoutsTable.id, payoutId));

    // React ✅ to original message
    try {
      const origChannel = await interaction.client.channels.fetch(payout.channelId).catch(() => null);
      if (origChannel?.isTextBased()) {
        const origMsg = await (origChannel as TextChannel).messages.fetch(payout.messageId).catch(() => null);
        if (origMsg) await origMsg.react("✅").catch(() => {});
      }
    } catch (_) {}

    // DM the streamer
    try {
      const u = await interaction.client.users.fetch(payout.discordId);
      await u.send(`🎮 Your stream payout for Week ${payout.week} was approved! **+${payout.amount} coins** added.`).catch(() => {});
    } catch (_) {}

    // DM the opponent if applicable
    if (payout.opponentDiscordId && payout.opponentAmount) {
      try {
        const u = await interaction.client.users.fetch(payout.opponentDiscordId);
        await u.send(`🎮 A league member streamed your Week ${payout.week} game — you received **+${payout.opponentAmount} coins**!`).catch(() => {});
      } catch (_) {}
    }

    // Look up streamer's team scoped to THIS guild — prevents cross-guild team names appearing
    const [streamerUserRow] = await db.select({ team: usersTable.team })
      .from(usersTable)
      .where(and(eq(usersTable.discordId, payout.discordId), eq(usersTable.guildId, payout.guildId)))
      .limit(1);
    const streamerTeam = streamerUserRow?.team ?? null;

    let streamUrl = "(see original message)";
    try {
      const origCh = await interaction.client.channels.fetch(payout.channelId).catch(() => null);
      if (origCh?.isTextBased()) {
        const origMsg = await (origCh as TextChannel).messages.fetch(payout.messageId).catch(() => null);
        const match = origMsg?.content.match(/https?:\/\/(?:[\w-]+\.)?twitch\.tv\/\S+/i);
        if (match) streamUrl = match[0];
      }
    } catch (_) {}

    const isH2H = !!payout.opponentDiscordId;
    const streamDescLines = [
      `**Streamer:** <@${payout.discordId}>${streamerTeam ? ` (${streamerTeam})` : ""}`,
      `**Opponent:** ${isH2H ? `${payout.opponentTeam ?? ""} — <@${payout.opponentDiscordId}>` : "CPU (no payout)"}`,
      `**Stream:** ${streamUrl}`,
      `**Week:** ${payout.week}`,
      "",
      `**Coins Awarded:**`,
      `+${payout.amount} coins → <@${payout.discordId}>`,
      isH2H ? `+${payout.opponentAmount} coins → <@${payout.opponentDiscordId}> (H2H opponent)` : null,
      "",
      `✅ Approved by ${interaction.user.toString()}`,
    ].filter((l): l is string => l !== null).join("\n");

    const approvedEmbed = new EmbedBuilder()
      .setColor(Colors.Green).setTitle("✅ Stream Payout Approved")
      .setDescription(streamDescLines)
      .setFooter({ text: `Payout #${payoutId} • Week ${payout.week}` })
      .setTimestamp();

    await interaction.editReply({
      embeds: [approvedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("stream_done").setLabel("✅ Approved").setStyle(ButtonStyle.Success).setDisabled(true),
      )],
    });
    return;
  }

  // ── Stream payout: deny ──────────────────────────────────────────────────────
  if (action === "stream_deny") {
    const payoutId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.followUp({ content: "❌ Only commissioners can deny payouts.", ephemeral: true });
      return;
    }

    const [payout] = await db
      .select().from(pendingChannelPayoutsTable)
      .where(eq(pendingChannelPayoutsTable.id, payoutId))
      .limit(1);

    if (!payout) { await interaction.followUp({ content: "❌ Payout record not found.", ephemeral: true }); return; }
    if (payout.status !== "pending") {
      await interaction.followUp({ content: `⚠️ Already **${payout.status}**.`, ephemeral: true });
      return;
    }

    await db.update(pendingChannelPayoutsTable)
      .set({ status: "denied", resolvedAt: new Date(), resolvedBy: interaction.user.id })
      .where(eq(pendingChannelPayoutsTable.id, payoutId));

    const [deniedStreamerRow] = await db.select({ team: usersTable.team })
      .from(usersTable)
      .where(and(eq(usersTable.discordId, payout.discordId), eq(usersTable.guildId, payout.guildId)))
      .limit(1);

    const deniedEmbed = new EmbedBuilder()
      .setColor(Colors.Red).setTitle("❌ Stream Payout Denied")
      .setDescription(
        `**Streamer:** <@${payout.discordId}>${deniedStreamerRow?.team ? ` (${deniedStreamerRow.team})` : ""}\n` +
        `**Opponent:** ${payout.opponentDiscordId ? `${payout.opponentTeam ?? ""} — <@${payout.opponentDiscordId}>` : "CPU"}\n` +
        `**Week:** ${payout.week}\n\n` +
        `❌ Denied by ${interaction.user.toString()}`
      )
      .setFooter({ text: `Payout #${payoutId} • Week ${payout.week}` })
      .setTimestamp();

    await interaction.editReply({
      embeds: [deniedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("stream_denied_done").setLabel("❌ Denied").setStyle(ButtonStyle.Danger).setDisabled(true),
      )],
    });
    return;
  }

  // ── Highlight payout: approve ────────────────────────────────────────────────
  if (action === "highlight_approve") {
    const payoutId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.followUp({ content: "❌ Only commissioners can approve payouts.", ephemeral: true });
      return;
    }

    const [payout] = await db
      .select().from(pendingChannelPayoutsTable)
      .where(eq(pendingChannelPayoutsTable.id, payoutId))
      .limit(1);

    if (!payout) { await interaction.followUp({ content: "❌ Payout record not found.", ephemeral: true }); return; }
    if (payout.status !== "pending") {
      await interaction.followUp({ content: `⚠️ This payout has already been **${payout.status}**.`, ephemeral: true });
      return;
    }

    await addBalance(payout.discordId, payout.amount, interaction.guildId!);
    await logTransaction(payout.discordId, payout.amount, "addcoins",
      `Highlight video payout — Week ${payout.week}`, interaction.guildId!, interaction.user.id);

    await db.update(pendingChannelPayoutsTable)
      .set({ status: "approved", resolvedAt: new Date(), resolvedBy: interaction.user.id })
      .where(eq(pendingChannelPayoutsTable.id, payoutId));

    // React ✅ to original message
    try {
      const origChannel = await interaction.client.channels.fetch(payout.channelId).catch(() => null);
      if (origChannel?.isTextBased()) {
        const origMsg = await (origChannel as TextChannel).messages.fetch(payout.messageId).catch(() => null);
        if (origMsg) await origMsg.react("✅").catch(() => {});
      }
    } catch (_) {}

    // DM the poster
    try {
      const u = await interaction.client.users.fetch(payout.discordId);
      await u.send(`🎬 Your highlight video payout for Week ${payout.week} was approved! **+${payout.amount} coins** added.`).catch(() => {});
    } catch (_) {}

    const [hlPosterRow] = await db.select({ team: usersTable.team })
      .from(usersTable).where(eq(usersTable.discordId, payout.discordId)).limit(1);

    const approvedEmbed = new EmbedBuilder()
      .setColor(Colors.Green).setTitle("✅ Highlight Payout Approved")
      .setDescription(
        `**Poster:** <@${payout.discordId}>${hlPosterRow?.team ? ` (${hlPosterRow.team})` : ""}\n` +
        `**Week:** ${payout.week}\n\n` +
        `**Coins Awarded:**\n+${payout.amount} coins → <@${payout.discordId}>\n\n` +
        `✅ Approved by ${interaction.user.toString()}`
      )
      .setFooter({ text: `Payout #${payoutId} • Week ${payout.week}` })
      .setTimestamp();

    await interaction.editReply({
      embeds: [approvedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("highlight_done").setLabel("✅ Approved").setStyle(ButtonStyle.Success).setDisabled(true),
      )],
    });
    return;
  }

  // ── Highlight payout: deny ───────────────────────────────────────────────────
  if (action === "highlight_deny") {
    const payoutId = parseInt(secondPart ?? "0", 10);
    await interaction.deferUpdate();

    if (!(await isAdminUser(interaction.user.id, interaction.guildId!))) {
      await interaction.followUp({ content: "❌ Only commissioners can deny payouts.", ephemeral: true });
      return;
    }

    const [payout] = await db
      .select().from(pendingChannelPayoutsTable)
      .where(eq(pendingChannelPayoutsTable.id, payoutId))
      .limit(1);

    if (!payout) { await interaction.followUp({ content: "❌ Payout record not found.", ephemeral: true }); return; }
    if (payout.status !== "pending") {
      await interaction.followUp({ content: `⚠️ Already **${payout.status}**.`, ephemeral: true });
      return;
    }

    await db.update(pendingChannelPayoutsTable)
      .set({ status: "denied", resolvedAt: new Date(), resolvedBy: interaction.user.id })
      .where(eq(pendingChannelPayoutsTable.id, payoutId));

    const [hlDeniedPosterRow] = await db.select({ team: usersTable.team })
      .from(usersTable).where(eq(usersTable.discordId, payout.discordId)).limit(1);

    const deniedEmbed = new EmbedBuilder()
      .setColor(Colors.Red).setTitle("❌ Highlight Payout Denied")
      .setDescription(
        `**Poster:** <@${payout.discordId}>${hlDeniedPosterRow?.team ? ` (${hlDeniedPosterRow.team})` : ""}\n` +
        `**Week:** ${payout.week}\n\n` +
        `❌ Denied by ${interaction.user.toString()}`
      )
      .setFooter({ text: `Payout #${payoutId} • Week ${payout.week}` })
      .setTimestamp();

    await interaction.editReply({
      embeds: [deniedEmbed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("highlight_denied_done").setLabel("❌ Denied").setStyle(ButtonStyle.Danger).setDisabled(true),
      )],
    });
    return;
  }

  // ── Interview: open answer modal (player-facing) ──────────────────────────
  // ── Archetype viewer ──────────────────────────────────────────────────────────
  if (action === "vca_pos") { await handleViewArchetypeSelect(interaction); return; }

  // ── View player stats — team select ───────────────────────────────────────────
  // customId format: viewps_team:<seasonId>:<conference>
  if (action === "viewps_team") {
    const seasonId = parseInt(parts[1] ?? "0", 10);
    await handleTeamSelect(interaction, seasonId);
    return;
  }

  // ── View player stats — position select ───────────────────────────────────────
  // customId format: viewps_pos:<seasonId>:<teamId>
  if (action === "viewps_pos") {
    const seasonId = parseInt(parts[1] ?? "0", 10);
    const teamId   = parseInt(parts[2] ?? "0", 10);
    await handlePositionSelect(interaction, seasonId, teamId);
    return;
  }

  // ── View player stats — player select ─────────────────────────────────────────
  // customId format: viewps_player:<seasonId>:<teamId>
  if (action === "viewps_player") {
    const seasonId = parseInt(parts[1] ?? "0", 10);
    const teamId   = parseInt(parts[2] ?? "0", 10);
    await handlePlayerSelect(interaction, seasonId, teamId);
    return;
  }

  // ── Custom player builder ─────────────────────────────────────────────────────
  if (action === "ccp_pos")          { await handleCcpPos(interaction, sessionId);          return; }
  if (action === "ccp_arch")         { await handleCcpArch(interaction, sessionId);         return; }
  if (action === "ccp_ol_pos")       { await handleCcpOlPos(interaction, sessionId);        return; }
  if (action === "ccp_motion_style") { await handleCcpMotionStyle(interaction, sessionId);  return; }
  if (action === "ccp_dev")          { await handleCcpDev(interaction, sessionId);          return; }
  if (action === "ccp_pkg")          { await handleCcpPkg(interaction, sessionId);          return; }
  if (action === "ccp_attr_sel")     { await handleCcpAttrSel(interaction, sessionId);      return; }
  if (action === "ccp_hand")         { await handleCcpHand(interaction, sessionId);         return; }
  if (action === "ccp_height")       { await handleCcpHeight(interaction, sessionId);       return; }
  if (action === "ccp_weight")       { await handleCcpWeight(interaction, sessionId);       return; }

  // ── Admin: add custom player — position select ─────────────────────────────
  // customId: acp_pos:<targetDiscordId>:<seasonId>:<notesEncoded>
  if (action === "acp_pos") { await handleAcpPositionSelect(interaction); return; }

  // ── Admin: add custom player — player select ───────────────────────────────
  // customId: acp_player:<targetDiscordId>:<seasonId>:<notesEncoded>
  if (action === "acp_player") { await handleAcpPlayerSelect(interaction); return; }

  // ── GOTY: commissioner selected the 2 winners ─────────────────────────────────
  if (action === "goty_winners") {
    const seasonId   = parseInt(parts[1] ?? "0", 10);
    const winnerIds  = interaction.values; // 2 Discord user IDs

    await interaction.deferUpdate();

    const gotyCoins = await getPayoutValue(PAYOUT_KEYS.GOTY_WINNER);

    const winnerLines: string[] = [];

    for (const discordId of winnerIds) {
      const [userRow] = await db.select({ team: usersTable.team })
        .from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
      const team = userRow?.team ?? "Unknown";

      if (gotyCoins > 0) {
        await addBalance(discordId, gotyCoins, interaction.guildId!);
        await logTransaction(discordId, gotyCoins, "addcoins",
          `GOTY Award Winner — Season ${seasonId}`, interaction.guildId!, interaction.user.id);
      }

      winnerLines.push(`🏆 <@${discordId}> (${team})`);

      try {
        const u = await interaction.client.users.fetch(discordId);
        await u.send(
          `🎮 **You've been selected as a Game of the Year Award winner!**\n\n` +
          `**+${gotyCoins} 🪙 coins** have been added to your balance!\n\n` +
          `You also receive **1 free XF promotion** for any player on your roster. ` +
          `This cannot be saved and must be used before the start of the next season. ` +
          `Coordinate with the commissioner to apply it!`
        ).catch(() => {});
      } catch (_) {}
    }

    // Post to general channel
    const gotyCount   = winnerIds.length;
    const gotyNoun    = gotyCount === 1 ? "winner" : "winners";
    const gotyEach    = gotyCount === 1 ? "The winner receives" : "Each winner receives";

    try {
      const gotyGeneralChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.GENERAL);
      const generalChannel = gotyGeneralChannelId ? await interaction.client.channels.fetch(gotyGeneralChannelId).catch(() => null) : null;
      if (generalChannel?.isTextBased()) {
        const announceEmbed = new EmbedBuilder()
          .setTitle(`🎮 GAME OF THE YEAR AWARD ${gotyNoun.toUpperCase()}!`)
          .setColor(Colors.Gold)
          .setDescription(
            `Congratulations to this season's **Game of the Year** award ${gotyNoun}!\n\n` +
            winnerLines.join("\n") + "\n\n" +
            `${gotyEach} **+${gotyCoins} 🪙** and a **free XF promotion** for any player on their roster.\n` +
            `⚠️ The XF promotion cannot be saved — it must be used before the start of the next season.`
          )
          .setTimestamp();
        await (generalChannel as TextChannel).send({ content: "@everyone", embeds: [announceEmbed] });
      }
    } catch (err) { console.error("Failed to post GOTY announcement:", err); }

    // Clear the GOTY channel to prepare it for next season
    try {
      const gotyChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.GOTY);
      const gotyChannel = gotyChannelId ? await interaction.client.channels.fetch(gotyChannelId).catch(() => null) : null;
      if (gotyChannel?.isTextBased()) {
        const tc = gotyChannel as TextChannel;
        const msgs = await tc.messages.fetch({ limit: 100 });
        if (msgs.size > 0) {
          await tc.bulkDelete(msgs, true).catch(async () => {
            for (const m of msgs.values()) await m.delete().catch(() => {});
          });
        }
      }
    } catch (err) { console.error("Failed to clear GOTY channel:", err); }

    // Update the commissioner message to show done state
    const doneEmbed = new EmbedBuilder()
      .setTitle("✅ GOTY Winners Selected")
      .setColor(Colors.Green)
      .setDescription(winnerLines.join("\n"))
      .addFields(
        { name: "Coins Awarded", value: `+${gotyCoins} 🪙 each`, inline: true },
        { name: "GOTY Channel", value: "Cleared for next season ✅", inline: true },
      )
      .setFooter({ text: `Selected by ${interaction.user.username}` })
      .setTimestamp();
    await interaction.editReply({ embeds: [doneEmbed], components: [] });
    return;
  }

  // ── GOTW: admin selected a specific game ─────────────────────────────────────
  if (action === "gotw_select") {
    const seasonId  = parseInt(parts[1] ?? "0", 10);
    const weekIndex = parseInt(parts[2] ?? "0", 10);
    const weekNum   = weekIndex + 1;

    // Value format: {awayDiscordId}:{homeDiscordId}
    const selectedValue  = interaction.values[0] ?? "";
    const [awayDiscordId, homeDiscordId] = selectedValue.split(":");

    await interaction.deferUpdate();

    const [awayUser] = await db.select({ team: usersTable.team })
      .from(usersTable).where(and(eq(usersTable.discordId, awayDiscordId!), eq(usersTable.guildId, interaction.guildId!))).limit(1);
    const [homeUser] = await db.select({ team: usersTable.team })
      .from(usersTable).where(and(eq(usersTable.discordId, homeDiscordId!), eq(usersTable.guildId, interaction.guildId!))).limit(1);

    const awayTeam = awayUser?.team ?? "Away Team";
    const homeTeam = homeUser?.team ?? "Home Team";

    const result = await postGotwToChannel(
      interaction.client, seasonId, weekIndex, weekNum,
      awayTeam, homeTeam, awayDiscordId!, homeDiscordId!, 0,
      interaction.guildId!,
    );

    const gotwChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.GOTW);
    if (result) {
      await interaction.editReply({
        content: gotwChannelId
          ? `✅ GOTW posted to <#${gotwChannelId}>!\n**${awayTeam} vs ${homeTeam}**`
          : `✅ GOTW posted!\n**${awayTeam} vs ${homeTeam}**`,
        components: [],
      });
    } else {
      await interaction.editReply({
        content: gotwChannelId
          ? `❌ Failed to post GOTW. Check that the bot has access to <#${gotwChannelId}>.`
          : `❌ Failed to post GOTW.`,
        components: [],
      });
    }
    return;
  }

  // ── Admin-Payout Hub selects ──────────────────────────────────────────────────
  if (action === "ap_gotw_afc")        { await handleGotwSelectAfc(interaction);      return; }
  if (action === "ap_gotw_nfc")        { await handleGotwSelectNfc(interaction);      return; }
  if (action === "ap_potw_afc")        { await handlePotwSelectAfc(interaction);      return; }
  if (action === "ap_potw_nfc")        { await handlePotwSelectNfc(interaction);      return; }
  if (action === "ap_addcoins_afc")    { await handleAddCoinsSelectAfc(interaction);  return; }
  if (action === "ap_addcoins_nfc")    { await handleAddCoinsSelectNfc(interaction);  return; }
  if (action === "ap_removecoins_afc") { await handleRemoveCoinsSelectAfc(interaction); return; }
  if (action === "ap_removecoins_nfc") { await handleRemoveCoinsSelectNfc(interaction); return; }
  if (action === "ap_transfer_afc")    { await handleTransferSelectAfc(interaction);  return; }
  if (action === "ap_transfer_nfc")    { await handleTransferSelectNfc(interaction);  return; }
  if (action === "ap_game_select")     { await handleGameSelect(interaction);         return; }
  if (action === "ap_correct_week")    { await handleCorrectWeekSelect(interaction);  return; }
  if (action === "ap_correct_game")    { await handleCorrectGameSelect(interaction);  return; }
  if (action === "ap_eos_key")         { await handleEosKeySelect(interaction);       return; }

  // ── Admin User Data Hub — select menus ────────────────────────────────────
  if (action === "ud_link_team_afc")   { await handleUdLinkTeamAfc(interaction);     return; }
  if (action === "ud_link_team_nfc")   { await handleUdLinkTeamNfc(interaction);     return; }
  if (action === "ud_link_member")     { await handleUdLinkMember(interaction);      return; }
  if (action === "ud_unlink_team_afc") { await handleUdUnlinkTeamAfc(interaction);   return; }
  if (action === "ud_unlink_team_nfc") { await handleUdUnlinkTeamNfc(interaction);   return; }
  if (action === "ud_ve_team_afc")     { await handleUdVeTeamAfc(interaction);       return; }
  if (action === "ud_ve_team_nfc")     { await handleUdVeTeamNfc(interaction);       return; }
  if (action === "ud_delete_user")     { await handleUdDeleteUserSelect(interaction); return; }

  // ── Admin Store Settings Hub ────────────────────────────────────────────────
  if (action === "ss_arch_pos")       { await handleSsArchPos(interaction);       return; }
  if (action === "ss_arch_edit_group") { await handleSsArchEditGroup(interaction); return; }
  if (action === "ss_lt_pos")         { await handleSsLtPos(interaction);         return; }
  if (action === "ss_lt_legend")      { await handleSsLtLegend(interaction);      return; }
  if (action === "ss_lt_model")       { await handleSsLtModel(interaction);       return; }
  if (action === "ss_lt_edit_group")  { await handleSsLtEditGroup(interaction);   return; }
}

// ── Wager margin modal handler ─────────────────────────────────────────────────
async function handleWagerMarginModal(interaction: ModalSubmitInteraction) {
  // customId: wager_margin:<winningSide>:<wagerId>
  const parts   = interaction.customId.split(":");
  // parts[1] is the button side (home/away) — not used; spread math determines winner from scores
  const wagerId = parseInt(parts[2] ?? "0", 10);

  const homeScoreStr = interaction.fields.getTextInputValue("home_score").trim();
  const awayScoreStr = interaction.fields.getTextInputValue("away_score").trim();
  const homeScore    = parseInt(homeScoreStr, 10);
  const awayScore    = parseInt(awayScoreStr, 10);

  if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
    await interaction.reply({ content: "❌ Invalid scores. Enter non-negative whole numbers.", ephemeral: true });
    return;
  }

  const [wager] = await db.select().from(wagersTable).where(eq(wagersTable.id, wagerId)).limit(1);
  if (!wager) { await interaction.reply({ content: "❌ Wager not found.", ephemeral: true }); return; }
  if (wager.status !== "active") {
    await interaction.reply({ content: `⚠️ This wager is not active (status: **${wager.status}**).`, ephemeral: true });
    return;
  }

  const wagerGuildId = wager.guildId ?? interaction.guildId!;
  const spread       = wager.spread ?? 0;

  // Spread math: challenger net = (challengerSideScore - opponentSideScore) + spread
  // Positive → challenger wins; negative → opponent wins; zero → push
  const challengerScore = wager.challengerSide === "home" ? homeScore : awayScore;
  const opponentScore   = wager.challengerSide === "home" ? awayScore : homeScore;
  const net             = (challengerScore - opponentScore) + spread;

  const isPush     = net === 0;
  const challWins  = net > 0;

  const winnerId   = isPush ? null : challWins ? wager.challengerId : wager.opponentId;
  const loserId    = isPush ? null : challWins ? wager.opponentId   : wager.challengerId;
  const winnerTeam = !winnerId ? null : challWins ? wager.teamFor   : wager.teamAgainst;
  const loserTeam  = !loserId  ? null : challWins ? wager.teamAgainst : wager.teamFor;

  if (isPush) {
    // Refund both
    await addBalance(wager.challengerId, wager.amount, wagerGuildId);
    await logTransaction(wager.challengerId, wager.amount, "addcoins", `Wager #${wagerId} — push (spread tie) refund`, wagerGuildId, interaction.user.id);
    await addBalance(wager.opponentId, wager.amount, wagerGuildId);
    await logTransaction(wager.opponentId, wager.amount, "addcoins", `Wager #${wagerId} — push (spread tie) refund`, wagerGuildId, interaction.user.id);
    await db.update(wagersTable).set({ status: "push", resolvedAt: new Date(), resolvedBy: interaction.user.id }).where(eq(wagersTable.id, wagerId));

    const embed = new EmbedBuilder()
      .setColor(Colors.Grey)
      .setTitle("🤝 Wager Push — Coins Refunded")
      .setDescription(
        `Final score: **${wager.teamFor} ${challengerScore} — ${opponentScore} ${wager.teamAgainst}**\n` +
        `Spread: **${spread > 0 ? "+" : ""}${spread}** → Net: **0** (push)\n\n` +
        `Both players have been refunded **${wager.amount.toLocaleString()} coins**.`,
      )
      .setFooter({ text: `Wager #${wagerId}` }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
    // Also try to clear the buttons from the original commissioner message
    if (wager.commissionerMessageId && interaction.channel) {
      try {
        const msg = await (interaction.channel as any).messages.fetch(wager.commissionerMessageId);
        await msg.edit({ components: [] });
      } catch (_) {}
    }

    for (const uid of [wager.challengerId, wager.opponentId]) {
      try { const u = await interaction.client.users.fetch(uid); await u.send(`🤝 **Wager #${wagerId} — Push!** Scores tied after spread — your **${wager.amount.toLocaleString()} coins** have been refunded.`).catch(() => {}); } catch (_) {}
    }
  } else {
    // Winner takes pot
    await addBalance(winnerId!, wager.pot, wagerGuildId);
    await logTransaction(winnerId!, wager.pot, "addcoins", `Wager #${wagerId} won: ${winnerTeam} vs ${loserTeam}`, wagerGuildId, interaction.user.id);
    await db.update(wagersTable).set({ status: "completed", winnerId: winnerId!, resolvedAt: new Date(), resolvedBy: interaction.user.id }).where(eq(wagersTable.id, wagerId));

    const homeTeamLabel = wager.challengerSide === "home" ? wager.teamFor : wager.teamAgainst;
    const awayTeamLabel = wager.challengerSide === "away" ? wager.teamFor : wager.teamAgainst;

    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle("✅ Wager Resolved")
      .setDescription(`Final: **${homeTeamLabel} ${homeScore} — ${awayScore} ${awayTeamLabel}**`)
      .addFields(
        { name: "📊 Spread Applied", value: `Spread: **${spread > 0 ? "+" : ""}${spread}** on ${wager.teamFor} → Net: **${net > 0 ? "+" : ""}${net}**`, inline: false },
        { name: "🏆 Winner", value: `<@${winnerId!}> (${winnerTeam})`, inline: true },
        { name: "📉 Loser",  value: `<@${loserId!}> (${loserTeam})`,  inline: true },
        { name: "💰 Payout", value: `**${wager.pot.toLocaleString()} coins** → <@${winnerId!}>`, inline: false },
        { name: "🔖 Decided by", value: `<@${interaction.user.id}>`, inline: false },
      )
      .setFooter({ text: `Wager #${wagerId}` }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
    // Also try to clear the buttons from the original commissioner message
    if (wager.commissionerMessageId && interaction.channel) {
      try {
        const msg = await (interaction.channel as any).messages.fetch(wager.commissionerMessageId);
        await msg.edit({ components: [] });
      } catch (_) {}
    }

    try { const wu = await interaction.client.users.fetch(winnerId!); await wu.send(`🏆 **You won Wager #${wagerId}!** You took **${winnerTeam}** and covered the spread — **${wager.pot.toLocaleString()} coins** added to your balance.`).catch(() => {}); } catch (_) {}
    try { const lu = await interaction.client.users.fetch(loserId!); await lu.send(`📉 **Wager #${wagerId} result:** You lost. You took **${loserTeam}** and didn't cover — your **${wager.amount.toLocaleString()} coins** have been paid out to the winner.`).catch(() => {}); } catch (_) {}
  }
}

// ── Modal handler ──────────────────────────────────────────────────────────────
async function handleModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId?.startsWith("ns_")) {
    const handled = await handleNewServerSetupInteraction(interaction);
    if (handled) return;
  }

  const parts  = interaction.customId.split(":");
  const action = parts[0]!;
  const idStr  = parts[1];

  // ── League Data wizard — all ld_ prefixed modal submissions ──────────────────
  if (action?.startsWith("ld_")) {
    await handleLeagueDataModal(interaction);
    return;
  }

  // ── Actions hub — dispatch all ac_ prefixed modal submissions ─────────────────
  if (action?.startsWith("ac_")) {
    const handledDept = await handleMenuDepartmentInteraction(interaction as any);
    if (handledDept) return;
    await handleActionsInteraction(interaction);
    return;
  }

  // ── Admin Operations hub — dispatch all ao_ prefixed modal submissions ─────────
  if (action?.startsWith("ao_")) {
    const handled = await handleAdminOperationsInteraction(interaction);
    if (handled) return;
  }

  // ── Admin troubleshoot — schedule review modal ────────────────────────────────
  if (action === "ts_modal_sched_week") { await handleTsSchedWeekModal(interaction); return; }

  // ── Wager margin modal (commissioner enters final score) ─────────────────────
  if (action === "wager_margin") { await handleWagerMarginModal(interaction); return; }

  // ── Custom player builder ─────────────────────────────────────────────────────
  if (action === "ccp_modal")            { await handleCcpModal(interaction, idStr ?? "");            return; }
  if (action === "ccp_refund_modal")     { await handleCcpRefundModal(interaction, idStr ?? "");      return; }
  if (action === "ccp_qb_details_modal") { await handleCcpQbDetailsModal(interaction, idStr ?? "");   return; }
  if (action === "ccp_appearance_modal") { await handleCcpAppearanceModal(interaction, idStr ?? "");  return; }

  // ── Interview denial ─────────────────────────────────────────────────────────

  // ── Interview: submit answers (player-facing modal) ───────────────────────

  // ── EOS payout: edit amount submitted ────────────────────────────────────────
  if (action === "eos_edit_modal") {
    const payoutId = parseInt(idStr ?? "0", 10);
    const rawAmount = interaction.fields.getTextInputValue("new_amount").trim();
    const newAmount = parseInt(rawAmount, 10);

    if (isNaN(newAmount) || newAmount <= 0) {
      await interaction.reply({ content: "❌ Invalid amount — enter a positive whole number.", ephemeral: true });
      return;
    }

    const [payout] = await db.select().from(pendingEosPayoutsTable)
      .where(eq(pendingEosPayoutsTable.id, payoutId)).limit(1);
    if (!payout) { await interaction.reply({ content: "❌ Payout not found.", ephemeral: true }); return; }
    if (payout.status !== "pending") {
      await interaction.reply({ content: `⚠️ This payout is already **${payout.status}** and can't be edited.`, ephemeral: true });
      return;
    }

    await db.update(pendingEosPayoutsTable)
      .set({ totalCoins: newAmount })
      .where(eq(pendingEosPayoutsTable.id, payoutId));

    // Update the commissioner message buttons with new amount
    if (payout.commissionerMessageId) {
      try {
        const commChannelId = await getGuildChannel(interaction.guildId!, CHANNEL_KEYS.COMMISSIONER);
        const ch = commChannelId ? await interaction.client.channels.fetch(commChannelId) : null;
        if (ch?.isTextBased()) {
          const msg = await (ch as TextChannel).messages.fetch(payout.commissionerMessageId).catch(() => null);
          if (msg) {
            const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`eos_approve:${payoutId}:${payout.discordId}`)
                .setLabel(`✅ Approve (${newAmount.toLocaleString()} coins)`)
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`eos_edit:${payoutId}`)
                .setLabel("✏️ Edit Amount")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`eos_reject:${payoutId}`)
                .setLabel("🗑️ Reject")
                .setStyle(ButtonStyle.Danger),
            );
            await msg.edit({ components: [updatedRow] });
          }
        }
      } catch (err) { console.error("Failed to update commissioner message after EOS edit:", err); }
    }

    await interaction.reply({
      content: `✅ Payout #${payoutId} updated to **${newAmount.toLocaleString()} coins**. Click Approve to award.`,
      ephemeral: true,
    });
    return;
  }

  // ── Admin-Payout Hub modals ────────────────────────────────────────────────
  // ap_modal_potw removed — POTW now uses dropdown select menus, not modals
  if (action === "ap_modal_addcoins")       { await handleAddCoinsModal(interaction);      return; }
  if (action === "ap_modal_removecoins")    { await handleRemoveCoinsModal(interaction);   return; }
  if (action === "ap_modal_transfer")       { await handleTransferModal(interaction);      return; }
  if (action === "ap_modal_game_home_wins") { await handleGameModalHomeWins(interaction);  return; }
  if (action === "ap_modal_game_away_wins") { await handleGameModalAwayWins(interaction);  return; }
  if (action === "ap_modal_game_cpu_wins")  { await handleGameModalCpuWins(interaction);   return; }
  if (action === "ap_modal_correct_same")   { await handleCorrectModalSame(interaction);   return; }
  if (action === "ap_modal_correct_swap")   { await handleCorrectModalSwap(interaction);   return; }
  if (action === "ap_modal_setpay_reg")     { await handleSetPayRegModal(interaction);     return; }
  if (action === "ap_modal_setpay_po1")     { await handleSetPayPo1Modal(interaction);     return; }
  if (action === "ap_modal_setpay_po2")     { await handleSetPayPo2Modal(interaction);     return; }
  if (action === "ap_modal_newmember")      { await handleNewMemberModal(interaction);     return; }
  if (action === "ap_modal_gotwbonus")        { await handleGotwBonusModal(interaction);       return; }
  if (action === "ap_modal_potwbonus")        { await handlePotwBonusModal(interaction);       return; }
  if (action === "ap_modal_eos_edit")       { await handleEosEditModal(interaction);        return; }
  if (action === "ap_modal_eos_stat_tier")  { await handleEosStatTierModal(interaction);    return; }
  if (action === "ap_modal_milestone_edit") { await handleMilestoneEditModal(interaction);  return; }
  if (action === "ap_modal_setpay_channel") { await handleSetPayChannelModal(interaction);  return; }
  if (action === "ap_modal_referral")       { await handleReferralModal(interaction);        return; }

  // ── Team request denial modal (treq_deny_reason|uid|msgId|team) ────────────
  if (interaction.customId.startsWith("treq_deny_reason|")) { await handleTreqDenyReasonModal(interaction); return; }

  // ── Admin User Data Hub modals ─────────────────────────────────────────────
  if (action === "ud_modal_link")          { await handleUdLinkModal(interaction);          return; }
  if (action === "ud_modal_edit_economy")  { await handleUdEditEconomyModal(interaction);   return; }
  if (action === "ud_modal_edit_records")  { await handleUdEditRecordsModal(interaction);   return; }
  if (action === "ud_modal_edit_alltime")  { await handleUdEditAllTimeModal(interaction);   return; }

  // ── Admin Store Settings Hub modals ────────────────────────────────────────
  if (action === "ss_modal_arch_edit")          { await handleSsArchEditModal(interaction);          return; }
  if (action === "ss_modal_lt_edit")            { await handleSsLtEditModal(interaction);            return; }
}
