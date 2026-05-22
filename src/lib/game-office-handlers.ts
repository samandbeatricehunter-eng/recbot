import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  Colors,
  TextChannel,
} from "discord.js";
import { db } from "@workspace/db";
import {
  gameChannelsTable,
  gameScheduleProposalsTable,
  gameAdminRequestsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const TIMEZONES = ["CST", "EST", "PST", "AKST"] as const;
type RecTimezone = (typeof TIMEZONES)[number];

const TZ_OFFSETS: Record<RecTimezone, number> = {
  CST: -6,
  EST: -5,
  PST: -8,
  AKST: -9,
};

type GameChannelRow = typeof gameChannelsTable.$inferSelect;

type GameOfficeInteraction = StringSelectMenuInteraction | ModalSubmitInteraction;

function isRecTimezone(value: string): value is RecTimezone {
  return (TIMEZONES as readonly string[]).includes(value);
}

function cleanDateInput(value: string): string {
  const raw = value.trim().toLowerCase();
  const now = new Date();
  const addDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  if (raw === "today") return addDays(0);
  if (raw === "tomorrow") return addDays(1);
  if (raw === "next day" || raw === "day after tomorrow") return addDays(2);

  return value.trim();
}

function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const raw = value.trim().toLowerCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return { hour, minute };
}

function parseDateTimeToUtc(dateInput: string, timeInput: string, timezone: RecTimezone): Date | null {
  const date = cleanDateInput(dateInput);
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const time = parseTimeInput(timeInput);
  if (!time) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const offset = TZ_OFFSETS[timezone];

  // Convert provided local league time to UTC using REC-supported timezone labels.
  return new Date(Date.UTC(year, month - 1, day, time.hour - offset, time.minute, 0, 0));
}

function formatInRecTimezone(date: Date, timezone: RecTimezone): string {
  const offset = TZ_OFFSETS[timezone];
  const shifted = new Date(date.getTime() + offset * 60 * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  let hour = shifted.getUTCHours();
  const minute = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${yyyy}-${mm}-${dd} ${hour}:${minute} ${ampm} ${timezone}`;
}

function formatAllRecTimezones(date: Date): string {
  return TIMEZONES.map((tz) => `**${tz}:** ${formatInRecTimezone(date, tz)}`).join("\n");
}

function buildMainPanelRows(): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("go_main_select")
        .setPlaceholder("Select a matchup action")
        .addOptions(
          {
            label: "Schedule Match",
            value: "schedule_match",
            description: "Offer a date and time to play this matchup.",
            emoji: "📅",
          },
          {
            label: "Cancel Schedule",
            value: "cancel_schedule",
            description: "Cancel an agreed schedule and notify commissioners.",
            emoji: "❌",
          },
          {
            label: "Request Fair Sim",
            value: "request_fair_sim",
            description: "Ask commissioners to review this matchup for a fair sim.",
            emoji: "⚖️",
          },
          {
            label: "Request Force Win",
            value: "request_force_win",
            description: "Ask commissioners to review this matchup for a force win.",
            emoji: "🏁",
          },
        ),
    ),
  ];
}

export function buildGameOfficeEmbed(game: Pick<GameChannelRow, "awayTeamName" | "homeTeamName" | "weekIndex">): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xb68b2d)
    .setTitle("REC Game Office")
    .setDescription(
      `**${game.awayTeamName} vs ${game.homeTeamName}**\n` +
      `Week Index: **${game.weekIndex}**\n\n` +
      "Use the selector below to schedule the matchup or request commissioner review."
    )
    .setFooter({ text: "Only matchup users may use these controls. Commissioners can review all requests." });
}

export function buildGameOfficeRows(): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return buildMainPanelRows();
}

async function findGameByChannel(channelId: string): Promise<GameChannelRow | null> {
  const [game] = await db
    .select()
    .from(gameChannelsTable)
    .where(eq(gameChannelsTable.channelId, channelId))
    .limit(1);

  return game ?? null;
}

function isParticipant(game: GameChannelRow, discordId: string): boolean {
  return game.awayDiscordId === discordId || game.homeDiscordId === discordId;
}

function opponentFor(game: GameChannelRow, discordId: string): string | null {
  if (game.awayDiscordId === discordId) return game.homeDiscordId;
  if (game.homeDiscordId === discordId) return game.awayDiscordId;
  return null;
}

async function requireGameAndParticipant(interaction: GameOfficeInteraction): Promise<GameChannelRow | null> {
  const channelId = interaction.channelId;
  const game = await findGameByChannel(channelId);

  if (!game) {
    await interaction.reply({ content: "❌ This channel is not linked to a REC game matchup.", ephemeral: true });
    return null;
  }

  if (!isParticipant(game, interaction.user.id)) {
    await interaction.reply({ content: "❌ Only the two users in this matchup can use this Game Office control.", ephemeral: true });
    return null;
  }

  return game;
}

async function showTimezoneSelector(interaction: StringSelectMenuInteraction) {
  const game = await requireGameAndParticipant(interaction);
  if (!game) return;

  await interaction.reply({
    content: "Select the timezone for your schedule offer.",
    ephemeral: true,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("go_timezone_select")
          .setPlaceholder("Choose timezone")
          .addOptions(
            { label: "CST", value: "CST", description: "Central time" },
            { label: "EST", value: "EST", description: "Eastern time" },
            { label: "PST", value: "PST", description: "Pacific time" },
            { label: "AKST", value: "AKST", description: "Alaska time" },
          ),
      ),
    ],
  });
}

async function showScheduleModal(interaction: StringSelectMenuInteraction) {
  const game = await requireGameAndParticipant(interaction);
  if (!game) return;

  const timezone = interaction.values[0];
  if (!timezone || !isRecTimezone(timezone)) {
    await interaction.reply({ content: "❌ Invalid timezone selected.", ephemeral: true });
    return;
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDay = new Date(today);
  nextDay.setDate(nextDay.getDate() + 2);

  const modal = new ModalBuilder()
    .setCustomId(`go_modal_schedule:${timezone}`)
    .setTitle("Schedule Match");

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("date")
        .setLabel("Date")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`${today.toISOString().slice(0, 10)}, ${tomorrow.toISOString().slice(0, 10)}, or ${nextDay.toISOString().slice(0, 10)}`)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("time")
        .setLabel(`Time (${timezone})`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("7:30 PM")
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("notes")
        .setLabel("Additional notes")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Optional availability details")
        .setRequired(false)
        .setMaxLength(800),
    ),
  );

  await interaction.showModal(modal);
}

function buildOpponentResponseRows(proposalId: number): ActionRowBuilder<StringSelectMenuBuilder>[] {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`go_proposal_response:${proposalId}`)
        .setPlaceholder("Respond to this schedule proposal")
        .addOptions(
          { label: "Agree", value: "agree", description: "Accept the proposed schedule.", emoji: "✅" },
          { label: "Counter", value: "counter", description: "Offer a different date/time.", emoji: "🔁" },
          { label: "Decline / Request FS", value: "decline_fs", description: "Decline and request a fair sim review.", emoji: "⚖️" },
        ),
    ),
  ];
}

async function handleScheduleModal(interaction: ModalSubmitInteraction, timezone: RecTimezone) {
  const game = await requireGameAndParticipant(interaction);
  if (!game) return;

  const opponentId = opponentFor(game, interaction.user.id);
  if (!opponentId) {
    await interaction.reply({ content: "❌ Could not resolve opponent for this matchup.", ephemeral: true });
    return;
  }

  const dateInput = interaction.fields.getTextInputValue("date");
  const timeInput = interaction.fields.getTextInputValue("time");
  const notes = interaction.fields.getTextInputValue("notes")?.trim() || null;
  const proposedAtUtc = parseDateTimeToUtc(dateInput, timeInput, timezone);

  if (!proposedAtUtc) {
    await interaction.reply({
      content: "❌ Invalid date/time. Use a date like `2026-05-22` and a time like `7:30 PM`.",
      ephemeral: true,
    });
    return;
  }

  const [proposal] = await db
    .insert(gameScheduleProposalsTable)
    .values({
      gameChannelId: game.id,
      proposerDiscordId: interaction.user.id,
      opponentDiscordId: opponentId,
      proposedDate: cleanDateInput(dateInput),
      proposedTime: timeInput.trim(),
      timezone,
      proposedAtUtc,
      notes,
      status: "pending",
    })
    .returning();

  await interaction.reply({ content: "✅ Schedule proposal posted.", ephemeral: true });

  const channel = interaction.channel as TextChannel;
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Gold)
        .setTitle("Schedule Proposal")
        .setDescription(
          `<@${interaction.user.id}> has offered to schedule this matchup.\n\n` +
          `**Original Offer:** ${cleanDateInput(dateInput)} at ${timeInput.trim()} ${timezone}\n\n` +
          `**Converted Times**\n${formatAllRecTimezones(proposedAtUtc)}\n\n` +
          `**Notes:**\n${notes || "_No notes provided._"}\n\n` +
          `Waiting on <@${opponentId}>.`
        )
        .setTimestamp(),
    ],
    components: buildOpponentResponseRows(proposal.id),
  });
}

async function handleProposalResponse(interaction: StringSelectMenuInteraction, proposalId: number) {
  const [proposal] = await db
    .select()
    .from(gameScheduleProposalsTable)
    .where(eq(gameScheduleProposalsTable.id, proposalId))
    .limit(1);

  if (!proposal) {
    await interaction.reply({ content: "❌ Schedule proposal not found.", ephemeral: true });
    return;
  }

  if (interaction.user.id !== proposal.opponentDiscordId) {
    await interaction.reply({ content: "❌ Only the opponent can respond to this schedule proposal.", ephemeral: true });
    return;
  }

  const response = interaction.values[0];

  if (response === "agree") {
    await db
      .update(gameScheduleProposalsTable)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(eq(gameScheduleProposalsTable.id, proposal.id));

    await interaction.update({ components: [] });

    await (interaction.channel as TextChannel).send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle("Schedule Confirmed")
          .setDescription(
            `<@${proposal.proposerDiscordId}> and <@${proposal.opponentDiscordId}> have agreed to play.\n\n` +
            `**Confirmed Times**\n${formatAllRecTimezones(new Date(proposal.proposedAtUtc!))}`
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (response === "counter") {
    const modal = new ModalBuilder()
      .setCustomId(`go_modal_counter:${proposal.id}`)
      .setTitle("Counter Schedule");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("date").setLabel("Counter Date").setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("time").setLabel("Counter Time").setStyle(TextInputStyle.Short).setPlaceholder("7:30 PM").setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("timezone").setLabel("Timezone: CST, EST, PST, or AKST").setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("notes").setLabel("Notes").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(800),
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  if (response === "decline_fs") {
    const modal = new ModalBuilder()
      .setCustomId(`go_modal_decline_fs:${proposal.id}`)
      .setTitle("Decline / Request Fair Sim");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );

    await interaction.showModal(modal);
  }
}

async function handleCounterModal(interaction: ModalSubmitInteraction, originalProposalId: number) {
  const [original] = await db.select().from(gameScheduleProposalsTable).where(eq(gameScheduleProposalsTable.id, originalProposalId)).limit(1);
  if (!original) {
    await interaction.reply({ content: "❌ Original proposal not found.", ephemeral: true });
    return;
  }

  const game = await findGameByChannel(interaction.channelId);
  if (!game || !isParticipant(game, interaction.user.id)) {
    await interaction.reply({ content: "❌ Only matchup users can counter this schedule.", ephemeral: true });
    return;
  }

  const timezoneRaw = interaction.fields.getTextInputValue("timezone").trim().toUpperCase();
  if (!isRecTimezone(timezoneRaw)) {
    await interaction.reply({ content: "❌ Timezone must be CST, EST, PST, or AKST.", ephemeral: true });
    return;
  }

  const dateInput = interaction.fields.getTextInputValue("date");
  const timeInput = interaction.fields.getTextInputValue("time");
  const notes = interaction.fields.getTextInputValue("notes")?.trim() || null;
  const proposedAtUtc = parseDateTimeToUtc(dateInput, timeInput, timezoneRaw);
  const opponentId = opponentFor(game, interaction.user.id);

  if (!opponentId || !proposedAtUtc) {
    await interaction.reply({ content: "❌ Could not process counter proposal. Check date/time formatting.", ephemeral: true });
    return;
  }

  await db.update(gameScheduleProposalsTable).set({ status: "countered", respondedAt: new Date() }).where(eq(gameScheduleProposalsTable.id, original.id));

  const [proposal] = await db.insert(gameScheduleProposalsTable).values({
    gameChannelId: game.id,
    proposerDiscordId: interaction.user.id,
    opponentDiscordId: opponentId,
    proposedDate: cleanDateInput(dateInput),
    proposedTime: timeInput.trim(),
    timezone: timezoneRaw,
    proposedAtUtc,
    notes,
    status: "pending",
    parentProposalId: original.id,
  }).returning();

  await interaction.reply({ content: "✅ Counter proposal posted.", ephemeral: true });

  await (interaction.channel as TextChannel).send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle("Schedule Counter Proposal")
        .setDescription(
          `<@${interaction.user.id}> has countered the schedule offer.\n\n` +
          `**Original Counter:** ${cleanDateInput(dateInput)} at ${timeInput.trim()} ${timezoneRaw}\n\n` +
          `**Converted Times**\n${formatAllRecTimezones(proposedAtUtc)}\n\n` +
          `**Notes:**\n${notes || "_No notes provided._"}\n\n` +
          `Waiting on <@${opponentId}>.`
        )
        .setTimestamp(),
    ],
    components: buildOpponentResponseRows(proposal.id),
  });
}

async function openRequestModal(interaction: StringSelectMenuInteraction, type: "fair_sim" | "force_win" | "cancel_schedule") {
  const game = await requireGameAndParticipant(interaction);
  if (!game) return;

  const title = type === "fair_sim" ? "Request Fair Sim" : type === "force_win" ? "Request Force Win" : "Cancel Schedule";
  const modal = new ModalBuilder().setCustomId(`go_modal_request:${type}`).setTitle(title);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000),
    ),
  );

  await interaction.showModal(modal);
}

async function handleRequestModal(interaction: ModalSubmitInteraction, type: "fair_sim" | "force_win" | "cancel_schedule") {
  const game = await requireGameAndParticipant(interaction);
  if (!game) return;

  const reason = interaction.fields.getTextInputValue("reason").trim();

  const [request] = await db.insert(gameAdminRequestsTable).values({
    gameChannelId: game.id,
    requesterDiscordId: interaction.user.id,
    requestType: type,
    reason,
    status: "pending",
  }).returning();

  const title = type === "fair_sim" ? "Fair Sim Requested" : type === "force_win" ? "Force Win Requested" : "Schedule Canceled";

  await interaction.reply({ content: `✅ ${title} posted for commissioner review.`, ephemeral: true });

  await (interaction.channel as TextChannel).send({
    embeds: [
      new EmbedBuilder()
        .setColor(type === "cancel_schedule" ? Colors.Orange : Colors.Red)
        .setTitle(title)
        .setDescription(
          `<@${interaction.user.id}> submitted a **${type.replace(/_/g, " ")}** request.\n\n` +
          `**Reason:**\n${reason}\n\n` +
          `Commissioners should review this request.\nRequest ID: **${request.id}**`
        )
        .setTimestamp(),
    ],
  });
}

async function handleDeclineFairSimModal(interaction: ModalSubmitInteraction, proposalId: number) {
  const [proposal] = await db.select().from(gameScheduleProposalsTable).where(eq(gameScheduleProposalsTable.id, proposalId)).limit(1);
  if (!proposal) {
    await interaction.reply({ content: "❌ Proposal not found.", ephemeral: true });
    return;
  }

  const game = await findGameByChannel(interaction.channelId);
  if (!game || interaction.user.id !== proposal.opponentDiscordId) {
    await interaction.reply({ content: "❌ Only the opponent can decline this proposal.", ephemeral: true });
    return;
  }

  const reason = interaction.fields.getTextInputValue("reason").trim();

  await db.update(gameScheduleProposalsTable).set({ status: "declined_fs", respondedAt: new Date() }).where(eq(gameScheduleProposalsTable.id, proposal.id));

  const [request] = await db.insert(gameAdminRequestsTable).values({
    gameChannelId: game.id,
    requesterDiscordId: interaction.user.id,
    requestType: "fair_sim",
    reason,
    status: "pending",
  }).returning();

  await interaction.reply({ content: "✅ Fair sim request posted.", ephemeral: true });

  await (interaction.channel as TextChannel).send({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle("Schedule Declined / Fair Sim Requested")
        .setDescription(
          `<@${interaction.user.id}> declined the proposed schedule and requested a fair sim review.\n\n` +
          `**Reason:**\n${reason}\n\n` +
          `Commissioners should review this request.\nRequest ID: **${request.id}**`
        )
        .setTimestamp(),
    ],
  });
}

export async function handleGameOfficeInteraction(interaction: GameOfficeInteraction): Promise<boolean> {
  const id = interaction.customId;

  if (interaction.isStringSelectMenu()) {
    if (id === "go_main_select") {
      const action = interaction.values[0];
      if (action === "schedule_match") return void await showTimezoneSelector(interaction), true;
      if (action === "cancel_schedule") return void await openRequestModal(interaction, "cancel_schedule"), true;
      if (action === "request_fair_sim") return void await openRequestModal(interaction, "fair_sim"), true;
      if (action === "request_force_win") return void await openRequestModal(interaction, "force_win"), true;
    }

    if (id === "go_timezone_select") {
      await showScheduleModal(interaction);
      return true;
    }

    if (id.startsWith("go_proposal_response:")) {
      const proposalId = Number(id.split(":")[1]);
      await handleProposalResponse(interaction, proposalId);
      return true;
    }
  }

  if (interaction.isModalSubmit()) {
    if (id.startsWith("go_modal_schedule:")) {
      const tz = id.split(":")[1];
      if (!isRecTimezone(tz)) {
        await interaction.reply({ content: "❌ Invalid timezone.", ephemeral: true });
        return true;
      }
      await handleScheduleModal(interaction, tz);
      return true;
    }

    if (id.startsWith("go_modal_counter:")) {
      const proposalId = Number(id.split(":")[1]);
      await handleCounterModal(interaction, proposalId);
      return true;
    }

    if (id.startsWith("go_modal_decline_fs:")) {
      const proposalId = Number(id.split(":")[1]);
      await handleDeclineFairSimModal(interaction, proposalId);
      return true;
    }

    if (id.startsWith("go_modal_request:")) {
      const type = id.split(":")[1] as "fair_sim" | "force_win" | "cancel_schedule";
      await handleRequestModal(interaction, type);
      return true;
    }
  }

  return false;
}
