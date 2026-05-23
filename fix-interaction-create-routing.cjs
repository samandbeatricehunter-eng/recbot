#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "events", "interactionCreate.ts");
if (!fs.existsSync(file)) throw new Error("Missing src/events/interactionCreate.ts");

let s = fs.readFileSync(file, "utf8");
const original = s;

function backup() {
  fs.copyFileSync(file, file + ".bak-routing-repair-" + Date.now());
}

function insertAfterImports(text) {
  const imports = [...s.matchAll(/^import[\s\S]*?;\s*$/gm)];
  if (imports.length === 0) throw new Error("Could not locate import section.");
  const last = imports[imports.length - 1];
  const pos = last.index + last[0].length;
  s = s.slice(0, pos) + "\n" + text.trimEnd() + "\n" + s.slice(pos);
}

const needsSetupImport = s.includes("isNewServerSetupCustomId") || s.includes("handleNewServerSetupInteraction");
const hasSetupImport = /import\s*\{[\s\S]*isNewServerSetupCustomId[\s\S]*\}\s*from\s*["']\.\.\/lib\/new-server-setup-handlers\.js["'];/.test(s);
if (needsSetupImport && !hasSetupImport) {
  s = s.replace(/import\s*\{[\s\S]*?\}\s*from\s*["']\.\.\/lib\/new-server-setup-handlers\.js["'];\s*/g, "");
  insertAfterImports(`
import {
  handleNewServerSetupInteraction,
  isNewServerSetupCustomId,
} from "../lib/new-server-setup-handlers.js";
`);
}

if (!s.includes("function computeIsSetupInteraction") && s.includes("isSetupInteraction")) {
  insertAfterImports(`
function computeIsSetupInteraction(interaction: Interaction): boolean {
  return (
    (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
    typeof (interaction as any).customId === "string" &&
    isNewServerSetupCustomId((interaction as any).customId)
  );
}
`);
}
s = s.replace(/&&\s*!isSetupInteraction/g, "&& !computeIsSetupInteraction(interaction)");

s = s.replace(
  /await\s+handleLeagueOperationsMenuInteraction\s*\(\s*interaction\s*\)\s*;?/g,
  `{
    const handled = await handleActionsInteraction(interaction);
    if (handled) return;
  }`
);

s = s.replace(
  /const\s+handled\s*=\s*await\s+handleLeagueOperationsMenuInteraction\s*\(\s*interaction\s*\)\s*;/g,
  `const handled = await handleActionsInteraction(interaction);`
);

const callsLeagueOps = s.includes("handleLeagueOperationsMenuInteraction(");
const definesLeagueOps = /function\s+handleLeagueOperationsMenuInteraction\s*\(/.test(s)
  || /const\s+handleLeagueOperationsMenuInteraction\s*=/.test(s);

if (callsLeagueOps && !definesLeagueOps) {
  if (!s.includes("handleActionsInteraction")) {
    throw new Error("handleLeagueOperationsMenuInteraction is referenced, but handleActionsInteraction is not available.");
  }
  insertAfterImports(`
async function handleLeagueOperationsMenuInteraction(interaction: any): Promise<boolean> {
  return handleActionsInteraction(interaction);
}
`);
}

if (!s.includes("AC EARLY ROUTING SAFETY NET")) {
  const m = s.match(/export\s+async\s+function\s+execute\s*\(\s*interaction\s*:\s*Interaction\s*\)\s*\{/m);
  if (m && m.index !== undefined) {
    const pos = m.index + m[0].length;
    s = s.slice(0, pos) + `

  // AC EARLY ROUTING SAFETY NET
  if (
    (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) &&
    typeof (interaction as any).customId === "string" &&
    (interaction as any).customId.startsWith("ac_")
  ) {
    try {
      const handled = await handleActionsInteraction(interaction as any);
      if (handled) return;
    } catch (err) {
      console.error(\`[actions] \${(interaction as any).customId}:\`, err);
      const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
      if ((interaction as any).replied || (interaction as any).deferred) await (interaction as any).followUp(msg).catch(() => {});
      else await (interaction as any).reply(msg).catch(() => {});
      return;
    }
  }
` + s.slice(pos);
  }
}

if (s !== original) {
  backup();
  fs.writeFileSync(file, s.replace(/\r\n/g, "\n"), "utf8");
  console.log("Patched src/events/interactionCreate.ts");
} else {
  console.log("No changes needed in interactionCreate.ts");
}
