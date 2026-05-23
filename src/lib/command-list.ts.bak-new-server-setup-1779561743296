import type { ServerSettings } from "@workspace/db";
import * as actions from "../commands/actions.js";

/**
 * Builds the list of slash command JSON payloads to register with Discord.
 * Public command surface is intentionally limited. Admin workflows are reached
 * through /menu > League Operations > Commissioner's Office.
 */
export function buildCommandJSON(settings: ServerSettings | null = null): object[] {
  const entries: Array<{ data: { toJSON(): object } }> = [
    actions,
    
  ];

  return entries.map((m) => m.data.toJSON());
}
