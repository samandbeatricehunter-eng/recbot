/**
 * vca-handlers.ts
 *
 * Re-exports all /viewcustomarchetypes interaction handlers so that
 * interactionCreate.ts can import from lib/ (the correct layer) rather
 * than directly from commands/.
 *
 * The actual implementation stays in commands/viewcustomarchetypes.ts.
 * This file is the authoritative import target going forward.
 */
export {
  handleViewArchetypeSelect,
  handleVcaNav,
  handleVcaAttrPageNav,
} from "../commands/viewcustomarchetypes.js";
