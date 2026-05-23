#!/usr/bin/env node
/**
 * Repairs the syntax break introduced by the previous interactionCreate patch.
 *
 * Run from project root:
 *   node repair-interaction-create-syntax.cjs
 *   npm run dev
 */

const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "events", "interactionCreate.ts");
if (!fs.existsSync(file)) throw new Error("Missing src/events/interactionCreate.ts");

let s = fs.readFileSync(file, "utf8");
const original = s;

function backup() {
  fs.copyFileSync(file, file + ".bak-syntax-repair-" + Date.now());
}

// Remove malformed block expressions created by prior script.
s = s.replace(
  /\{\s*const\s+handled\s*=\s*await\s+handleActionsInteraction\s*\(\s*interaction\s*\)\s*;\s*if\s*\(\s*handled\s*\)\s*return\s*;\s*\}/g,
  "await handleActionsInteraction(interaction); return;"
);

// If the replacement landed after an arrow/ternary/object expression, normalize the common invalid forms.
s = s.replace(
  /\?\s*await\s+handleActionsInteraction\s*\(\s*interaction\s*\)\s*;\s*return\s*;/g,
  "? await handleActionsInteraction(interaction)"
);

s = s.replace(
  /:\s*await\s+handleActionsInteraction\s*\(\s*interaction\s*\)\s*;\s*return\s*;/g,
  ": await handleActionsInteraction(interaction)"
);

// Remove any remaining dead direct calls to the non-existent league operations handler.
s = s.replace(
  /await\s+handleLeagueOperationsMenuInteraction\s*\(\s*interaction\s*\)\s*;?/g,
  "await handleActionsInteraction(interaction); return;"
);

s = s.replace(
  /const\s+handled\s*=\s*await\s+handleLeagueOperationsMenuInteraction\s*\(\s*interaction\s*\)\s*;/g,
  "const handled = await handleActionsInteraction(interaction);"
);

// Make sure a compatibility function exists only if references remain.
const stillCallsShim = s.includes("handleLeagueOperationsMenuInteraction(");
const definesShim =
  /function\s+handleLeagueOperationsMenuInteraction\s*\(/.test(s) ||
  /const\s+handleLeagueOperationsMenuInteraction\s*=/.test(s);

if (stillCallsShim && !definesShim) {
  const imports = [...s.matchAll(/^import[\s\S]*?;\s*$/gm)];
  if (imports.length === 0) throw new Error("Could not locate import section.");
  const last = imports[imports.length - 1];
  const insertAt = last.index + last[0].length;
  s =
    s.slice(0, insertAt) +
    `\n\nasync function handleLeagueOperationsMenuInteraction(interaction: any): Promise<boolean> {\n  return handleActionsInteraction(interaction);\n}\n` +
    s.slice(insertAt);
}

// Safer: remove the early AC safety net if it caused malformed insertion and rely on existing ac_ routing.
s = s.replace(
  /\n\s*\/\/ AC EARLY ROUTING SAFETY NET[\s\S]*?\n\s*\}\n(?=\s*(?:\/\/|const|if|if\s*\(|interaction\.|$))/,
  "\n"
);

// Ensure the old ac_ router still exists somewhere.
if (!s.includes("handleActionsInteraction(interaction)")) {
  console.warn("Warning: no handleActionsInteraction(interaction) call detected after cleanup.");
}

// Write.
if (s !== original) {
  backup();
  fs.writeFileSync(file, s.replace(/\r\n/g, "\n"), "utf8");
  console.log("Repaired interactionCreate.ts syntax.");
} else {
  console.log("No changes made.");
}

console.log("Next: npm run dev");
