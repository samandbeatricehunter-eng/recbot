#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function writeFileIfChanged(filePath, content) {
  const abs = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (fs.existsSync(abs)) {
    const current = fs.readFileSync(abs, 'utf8');
    if (current === content) {
      console.log('Unchanged:', filePath);
      return;
    }
    const backup = abs + `.bak-${Date.now()}`;
    fs.copyFileSync(abs, backup);
    console.log('Backup created:', path.relative(process.cwd(), backup));
  }
  fs.writeFileSync(abs, content, 'utf8');
  console.log('Wrote:', filePath);
}

const edgeFunction = String.raw`import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

function getString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function getRecordKey(row: any, fallback: number): string {
  return getString(
    row?.id ??
    row?.playerId ??
    row?.rosterId ??
    row?.teamId ??
    row?.gameId ??
    row?.weekIndex ??
    row?.scheduleId ??
    fallback
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
    }

    const providedKey = req.headers.get("x-madden-import-key");
    const expectedKey = Deno.env.get("MADDEN_IMPORT_KEY");

    if (!expectedKey || providedKey !== expectedKey) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json() as JsonRecord;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ ok: false, error: "Missing Supabase secrets" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const guildId = getString(payload.guildId ?? payload.guild_id ?? req.headers.get("x-guild-id"));
    const leagueId = getString(payload.leagueId ?? payload.league_id ?? payload.franchiseId ?? req.headers.get("x-league-id"));
    const seasonId = getString(payload.seasonId ?? payload.season_id ?? payload.seasonIndex ?? req.headers.get("x-season-id"));
    const week = getString(payload.week ?? payload.weekIndex ?? req.headers.get("x-week"));

    const { data: snapshot, error: snapshotError } = await supabase
      .from("mca_import_snapshots")
      .insert({
        guild_id: guildId || null,
        league_id: leagueId || null,
        season_id: seasonId || null,
        week: week || null,
        source_name: "madden-export",
        export_type: "full_export",
        file_name: req.headers.get("x-file-name"),
        imported_by: req.headers.get("x-imported-by"),
        raw_json: payload,
      })
      .select("id")
      .single();

    if (snapshotError) throw snapshotError;

    const rawRecords: JsonRecord[] = [];

    for (const [listName, value] of Object.entries(payload)) {
      if (!Array.isArray(value)) continue;
      value.forEach((row: any, index: number) => {
        rawRecords.push({
          snapshot_id: snapshot.id,
          guild_id: guildId || null,
          league_id: leagueId || null,
          season_id: seasonId || null,
          list_name: listName,
          record_index: index,
          record_key: getRecordKey(row, index),
          raw_json: row,
        });
      });
    }

    let recordsStored = 0;

    for (let i = 0; i < rawRecords.length; i += 500) {
      const batch = rawRecords.slice(i, i + 500);
      const { error: batchError } = await supabase.from("mca_raw_records").insert(batch);
      if (batchError) throw batchError;
      recordsStored += batch.length;
    }

    return Response.json({
      ok: true,
      snapshotId: snapshot.id,
      recordsStored,
      arrayListsStored: Object.entries(payload).filter(([, v]) => Array.isArray(v)).length,
    });
  } catch (error) {
    console.error("[madden-import]", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});
`;

const functionReadme = String.raw`# madden-import Edge Function

Endpoint:
https://YOUR_PROJECT_REF.functions.supabase.co/madden-import

Required header:
x-madden-import-key: YOUR_SECRET_IMPORT_KEY

Recommended headers:
x-guild-id: DISCORD_GUILD_ID
x-league-id: MADDEN_LEAGUE_ID
x-season-id: SEASON_ID
x-week: CURRENT_WEEK
x-file-name: export-name.json
x-imported-by: discord user id or admin name
`;

const envExample = String.raw`# Supabase Edge Function Secrets
# Set these with: supabase secrets set KEY="value"

MADDEN_IMPORT_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
`;

writeFileIfChanged('supabase/functions/madden-import/index.ts', edgeFunction);
writeFileIfChanged('supabase/functions/madden-import/README.md', functionReadme);
writeFileIfChanged('.env.supabase-functions.example', envExample);

console.log('\nNext steps:');
console.log('1. Run supabase_madden_import_setup.sql in Supabase SQL Editor.');
console.log('2. supabase login');
console.log('3. supabase link --project-ref YOUR_PROJECT_REF');
console.log('4. supabase secrets set MADDEN_IMPORT_KEY="your-key"');
console.log('5. supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"');
console.log('6. supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
console.log('7. supabase functions deploy madden-import');
