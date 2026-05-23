const fs = require("fs");
const path = require("path");

const root = process.cwd();
const handlersPath = path.join(root, "src", "lib", "league-data-handlers.ts");

if (!fs.existsSync(handlersPath)) {
  console.error("Could not find src/lib/league-data-handlers.ts");
  process.exit(1);
}

let source = fs.readFileSync(handlersPath, "utf8");

if (!source.includes('storeRawMcaImport')) {
  source = 'import { storeRawMcaImport } from "./mca-raw-storage";\n' + source;
}

const anchor = "await interaction.editReply";

if (!source.includes(anchor)) {
  console.error("Could not find import completion anchor");
  process.exit(1);
}

const injection = `
try {
  await storeRawMcaImport({
    guildId: interaction.guildId ?? "",
    importedBy: interaction.user.id,
    payload: franchiseData,
    sourceName: "bot-import",
    exportType: "full_import",
  });

  console.log("[MCA RAW STORAGE] Snapshot + raw records stored successfully");
} catch (err) {
  console.error("[MCA RAW STORAGE ERROR]", err);
}

`;

source = source.replace(anchor, injection + anchor);

fs.writeFileSync(handlersPath, source);

console.log("Patched league-data-handlers.ts successfully");
