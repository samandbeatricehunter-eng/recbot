const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "events", "interactionCreate.ts");

if (!fs.existsSync(file)) {
  throw new Error("Missing src/events/interactionCreate.ts");
}

let s = fs.readFileSync(file, "utf8");

if (!s.includes("new-server-setup-handlers.js")) {
  s = s.replace(
    'import { handleGameOfficeInteraction } from "../lib/game-office-handlers.js";',
    'import { handleGameOfficeInteraction } from "../lib/game-office-handlers.js"; import { handleNewServerSetupInteraction } from "../lib/new-server-setup-handlers.js";'
  );
}

function insertAfter(anchor, insert) {
  if (!s.includes(anchor)) {
    throw new Error("Could not find anchor: " + anchor);
  }
  if (!s.includes(insert.trim())) {
    s = s.replace(anchor, anchor + "\n" + insert);
  }
}

insertAfter(
  "async function handleButton(interaction: ButtonInteraction) {",
  `  if (interaction.customId?.startsWith("ns_")) {
    const handled = await handleNewServerSetupInteraction(interaction);
    if (handled) return;
  }
`
);

insertAfter(
  "async function handleSelectMenu(interaction: StringSelectMenuInteraction) {",
  `  if (interaction.customId?.startsWith("ns_")) {
    const handled = await handleNewServerSetupInteraction(interaction);
    if (handled) return;
  }
`
);

insertAfter(
  "async function handleModal(interaction: ModalSubmitInteraction) {",
  `  if (interaction.customId?.startsWith("ns_")) {
    const handled = await handleNewServerSetupInteraction(interaction);
    if (handled) return;
  }
`
);

fs.writeFileSync(file + ".bak-new-server-routing-" + Date.now(), s, "utf8");
fs.writeFileSync(file, s, "utf8");

console.log("New server setup routing patched.");
