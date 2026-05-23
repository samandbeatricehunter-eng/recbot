import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type StoreMcaRawPayloadInput = {
  guildId?: string | null;
  leagueId?: string | number | null;
  seasonId?: string | number | null;
  week?: string | number | null;
  sourceName?: string | null;
  exportType?: string | null;
  fileName?: string | null;
  importedBy?: string | null;
  payload: unknown;
};

function asText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function recordKey(row: any, index: number): string {
  return String(
    row?.id ??
    row?.playerId ??
    row?.rosterId ??
    row?.teamId ??
    row?.gameId ??
    row?.weekIndex ??
    row?.scheduleId ??
    index
  );
}

export async function storeMcaRawPayload(input: StoreMcaRawPayloadInput): Promise<{ snapshotId: number; recordsStored: number }> {
  const payload = input.payload as any;

  const snapshotRows = await db.execute(sql`
    insert into mca_import_snapshots (
      guild_id,
      league_id,
      season_id,
      week,
      source_name,
      export_type,
      file_name,
      imported_by,
      raw_json
    ) values (
      ${asText(input.guildId)},
      ${asText(input.leagueId)},
      ${asText(input.seasonId)},
      ${asText(input.week)},
      ${input.sourceName ?? "bot-league-data"},
      ${input.exportType ?? "unknown"},
      ${input.fileName ?? null},
      ${input.importedBy ?? null},
      ${JSON.stringify(payload)}::jsonb
    )
    returning id
  `);

  const snapshotId = Number((snapshotRows as any).rows?.[0]?.id ?? (snapshotRows as any)[0]?.id);
  if (!snapshotId) throw new Error("Failed to create MCA import snapshot");

  let recordsStored = 0;

  if (payload && typeof payload === "object") {
    for (const [listName, value] of Object.entries(payload)) {
      if (!Array.isArray(value)) continue;

      for (let i = 0; i < value.length; i += 250) {
        const batch = value.slice(i, i + 250);
        if (!batch.length) continue;

        const valuesSql = batch.map((row: any, offset: number) => sql`(
          ${snapshotId},
          ${asText(input.guildId)},
          ${asText(input.leagueId)},
          ${asText(input.seasonId)},
          ${listName},
          ${i + offset},
          ${recordKey(row, i + offset)},
          ${JSON.stringify(row)}::jsonb
        )`);

        await db.execute(sql`
          insert into mca_raw_records (
            snapshot_id,
            guild_id,
            league_id,
            season_id,
            list_name,
            record_index,
            record_key,
            raw_json
          ) values ${sql.join(valuesSql, sql`,`)}
        `);

        recordsStored += batch.length;
      }
    }
  }

  return { snapshotId, recordsStored };
}
