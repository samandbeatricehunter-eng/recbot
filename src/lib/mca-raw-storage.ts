import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

type StoreRawMcaImportArgs = {
  guildId?: string;
  leagueId?: string;
  seasonId?: string;
  week?: string;
  importedBy?: string;
  sourceName?: string;
  exportType?: string;
  fileName?: string;
  payload: Record<string, unknown>;
};

function recordKey(row: unknown, index: number): string {
  if (!row || typeof row !== "object") return String(index);

  const value = row as Record<string, unknown>;

  return String(
    value.id ??
      value.playerId ??
      value.rosterId ??
      value.teamId ??
      value.gameId ??
      value.weekIndex ??
      value.scheduleId ??
      index,
  );
}

export async function storeRawMcaImport(args: StoreRawMcaImportArgs): Promise<{
  snapshotId: number;
  recordsStored: number;
}> {
  const payload = args.payload ?? {};

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
    )
    values (
      ${args.guildId ?? null},
      ${args.leagueId ?? null},
      ${args.seasonId ?? null},
      ${args.week ?? null},
      ${args.sourceName ?? "bot-import"},
      ${args.exportType ?? "full_import"},
      ${args.fileName ?? null},
      ${args.importedBy ?? null},
      ${JSON.stringify(payload)}::jsonb
    )
    returning id
  `);

  const snapshotId = Number((snapshotRows as any).rows?.[0]?.id);

  if (!snapshotId) {
    throw new Error("Failed to create MCA import snapshot.");
  }

  let recordsStored = 0;

  for (const [listName, value] of Object.entries(payload)) {
    if (!Array.isArray(value)) continue;

    for (let i = 0; i < value.length; i += 250) {
      const batch = value.slice(i, i + 250);

      for (let j = 0; j < batch.length; j++) {
        const index = i + j;
        const row = batch[j];

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
          )
          values (
            ${snapshotId},
            ${args.guildId ?? null},
            ${args.leagueId ?? null},
            ${args.seasonId ?? null},
            ${listName},
            ${index},
            ${recordKey(row, index)},
            ${JSON.stringify(row)}::jsonb
          )
        `);

        recordsStored++;
      }
    }
  }

  return {
    snapshotId,
    recordsStored,
  };
}
