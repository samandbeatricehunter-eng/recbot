import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  Guild,
  PermissionFlagsBits,
} from "discord.js";
import { db } from "@workspace/db";
import {
  franchiseMcaTeamsTable,
  franchiseScheduleTable,
  gameChannelsTable,
  usersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { buildGameOfficeEmbed, buildGameOfficeRows } from "./game-office-handlers.js";

function toChannelName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function findOrCreateCommissionerRole(guild: Guild) {
  await guild.roles.fetch();

  const existing = guild.roles.cache.find((role) => role.name === "Commissioner");
  if (existing) return existing;

  return guild.roles.create({
    name: "Commissioner",
    reason: "REC League commissioner access for private game channels",
  });
}

export interface CreatePrivateGameChannelsOptions {
  guild: Guild;
  guildId: string;
  seasonId: number;
  seasonNumber: number;
  scheduleSeasonId: number;
  weekIndex: number;
  displayLabel: string;
}

export interface CreatePrivateGameChannelsResult {
  created: number;
  h2hGames: number;
  totalGames: number;
  results: string[];
}

export async function createPrivateGameChannelsForWeek(
  options: CreatePrivateGameChannelsOptions,
): Promise<CreatePrivateGameChannelsResult> {
  const { guild, guildId, seasonId, seasonNumber, scheduleSeasonId, weekIndex, displayLabel } = options;

  const games = await db
    .select()
    .from(franchiseScheduleTable)
    .where(and(eq(franchiseScheduleTable.seasonId, scheduleSeasonId), eq(franchiseScheduleTable.weekIndex, weekIndex)));

  const [mcaTeams, allUsers] = await Promise.all([
    db
      .select({
        teamId: franchiseMcaTeamsTable.teamId,
        fullName: franchiseMcaTeamsTable.fullName,
        nickName: franchiseMcaTeamsTable.nickName,
        discordId: franchiseMcaTeamsTable.discordId,
        logoUrl: franchiseMcaTeamsTable.logoUrl,
      })
      .from(franchiseMcaTeamsTable)
      .where(eq(franchiseMcaTeamsTable.seasonId, scheduleSeasonId)),

    db
      .select({ discordId: usersTable.discordId, team: usersTable.team })
      .from(usersTable)
      .where(eq(usersTable.guildId, guildId)),
  ]);
  const teamToDiscord = new Map<string, string>();
  const teamToMca = new Map<string, (typeof mcaTeams)[number]>();
  const discordIdToMca = new Map<string, (typeof mcaTeams)[number]>();
  const discordIdToProperTeam = new Map<string, string>();

  for (const t of mcaTeams) {
    const keys = [t.fullName.toLowerCase().trim(), t.nickName.toLowerCase().trim()];
    for (const k of keys) {
      if (!teamToMca.has(k)) teamToMca.set(k, t);
      if (t.discordId && !t.discordId.startsWith("unlinked_") && !teamToDiscord.has(k)) teamToDiscord.set(k, t.discordId);
    }
    if (t.discordId && !t.discordId.startsWith("unlinked_")) discordIdToMca.set(t.discordId, t);
  }

  for (const u of allUsers) {
    if (u.team && !u.discordId.startsWith("unlinked_")) {
      const k = u.team.toLowerCase().trim();
      if (!teamToDiscord.has(k)) teamToDiscord.set(k, u.discordId);
      discordIdToProperTeam.set(u.discordId, u.team);
    }
  }

  for (const t of mcaTeams) {
    const byNick = teamToDiscord.get(t.nickName.toLowerCase().trim());
    if (byNick) {
      if (!teamToDiscord.has(t.fullName.toLowerCase().trim())) teamToDiscord.set(t.fullName.toLowerCase().trim(), byNick);
      if (!discordIdToMca.has(byNick)) discordIdToMca.set(byNick, t);
    }
  }

  const h2hGames = games.filter((g) =>
    teamToDiscord.has(g.awayTeamName.toLowerCase().trim()) &&
    teamToDiscord.has(g.homeTeamName.toLowerCase().trim()),
  );

  await guild.channels.fetch();
  const matchupCategory = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes("GAMEDAY"),
  );

  if (!matchupCategory) {
    throw new Error("Could not find a GAMEDAY CENTER category. Create one in Discord first.");
  }

  const commissionerRole = await findOrCreateCommissionerRole(guild);

  const existingChannelRows = await db
    .select()
    .from(gameChannelsTable)
    .where(and(eq(gameChannelsTable.seasonId, scheduleSeasonId), eq(gameChannelsTable.weekIndex, weekIndex)));

  const existingRowByKey = new Map(
    existingChannelRows.map((r) => [`${r.awayTeamName.toLowerCase().trim()}|${r.homeTeamName.toLowerCase().trim()}`, r]),
  );

  const results: string[] = [];
  let created = 0;

  for (const g of h2hGames) {
    const awayDiscordId = teamToDiscord.get(g.awayTeamName.toLowerCase().trim())!;
    const homeDiscordId = teamToDiscord.get(g.homeTeamName.toLowerCase().trim())!;
    const awayProper = discordIdToProperTeam.get(awayDiscordId) ?? g.awayTeamName;
    const homeProper = discordIdToProperTeam.get(homeDiscordId) ?? g.homeTeamName;
    const gameKey = `${awayProper.toLowerCase().trim()}|${homeProper.toLowerCase().trim()}`;
    const existingRow = existingRowByKey.get(gameKey);

    if (existingRow) {
      const liveChannel = guild.channels.cache.get(existingRow.channelId);
      if (liveChannel) {
        results.push(`⏭️ **${awayProper} vs ${homeProper}** — channel already exists (<#${existingRow.channelId}>)`);
        continue;
      }
      await db.delete(gameChannelsTable).where(eq(gameChannelsTable.id, existingRow.id));
      existingRowByKey.delete(gameKey);
    }

    const awayNick = discordIdToMca.get(awayDiscordId)?.nickName ?? awayProper.split(/\s+/).pop()!;
    const homeNick = discordIdToMca.get(homeDiscordId)?.nickName ?? homeProper.split(/\s+/).pop()!;
    const chanName = `${toChannelName(awayNick)}-vs-${toChannelName(homeNick)}`;

    try {
      const newChannel = await guild.channels.create({
        name: chanName,
        type: ChannelType.GuildText,
        parent: matchupCategory.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: awayDiscordId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: homeDiscordId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: commissionerRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
          },
          {
            id: guild.client.user!.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });

      const awayMention = `<@${awayDiscordId}>`;
      const homeMention = `<@${homeDiscordId}>`;

      await newChannel.send(
        `**${awayProper} vs ${homeProper}** — ${displayLabel}\n` +
        `${awayMention} ${homeMention}\nThis is your private matchup channel. Commissioners can also view this channel.`,
      );

      const panelMessage = await newChannel.send({
        embeds: [buildGameOfficeEmbed({ awayTeamName: awayProper, homeTeamName: homeProper, weekIndex })],
        components: buildGameOfficeRows(),
      });

      await db.insert(gameChannelsTable).values({
        guildId,
        seasonId: scheduleSeasonId,
        activeSeasonId: seasonId,
        weekIndex,
        scheduleGameId: String((g as any).id ?? (g as any).gameId ?? `${weekIndex}:${awayProper}:${homeProper}`),
        channelId: newChannel.id,
        awayTeamName: awayProper,
        homeTeamName: homeProper,
        awayDiscordId,
        homeDiscordId,
        commissionerRoleId: commissionerRole.id,
        panelMessageId: panelMessage.id,
        status: "open",
      });

      created++;
      results.push(`✅ Created <#${newChannel.id}>`);
    } catch (err) {
      console.error(`[game-channel-manager] Channel creation error for ${chanName}:`, err);
      results.push(`❌ Failed to create private channel for **${awayProper} vs ${homeProper}**`);
    }
  }

  return {
    created,
    h2hGames: h2hGames.length,
    totalGames: games.length,
    results,
  };
}
