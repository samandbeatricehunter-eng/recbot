/**
 * vps-handlers.ts
 *
 * Re-exports all /viewplayerstats interaction handlers so that
 * interactionCreate.ts can import from lib/ (the correct layer) rather
 * than directly from commands/.
 *
 * The actual implementation stays in commands/viewplayerstats.ts.
 * This file is the authoritative import target going forward.
 */
export {
  handleTeamSelect,
  handlePositionSelect,
  handlePlayerSelect,
} from "../commands/viewplayerstats.js";
