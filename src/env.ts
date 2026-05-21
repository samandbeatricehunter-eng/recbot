import "dotenv/config";

DISCORD_TOKEN=MTUwNjcxMjgyODIwMTkzMDg1NA.Gtl3t3.SQa1rm0HHOV3eWM1t_ZOmMSCxl7kGY6c_tAk9M
DISCORD_CLIENT_ID=1506712828201930854
DISCORD_GUILD_ID=1506713925792567380
SUPABASE_URL=postgresql://postgres:[RECLeagueMgmt]@db.kyooxpjsxvsatrariafq.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5b294cGpzeHZzYXRyYXJpYWZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI5OTIyOSwiZXhwIjoyMDk0ODc1MjI5fQ.Lh-h7fz1yaszPSqO3KL-pWBs6YCFyNDyPjAOrFla6bc

const required = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

export const env = {
  discordToken: process.env.DISCORD_TOKEN!,
  discordClientId: process.env.DISCORD_CLIENT_ID!,
  discordGuildId: process.env.DISCORD_GUILD_ID!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};
