/**
 * acp-handlers.ts
 *
 * Re-exports the /admininventory custom-player interaction handlers so that
 * interactionCreate.ts can import from lib/ (the correct layer) rather
 * than directly from commands/.
 *
 * The actual implementation stays in commands/admin-inventory.ts.
 * This file is the authoritative import target going forward.
 */
export {
  handleAcpPositionSelect,
  handleAcpPlayerSelect,
} from "../commands/admin-inventory.js";
