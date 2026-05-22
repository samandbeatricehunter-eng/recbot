/*
  Run from your project root OR from the scripts folder.
  Fixes syntax errors in scripts/apply-financial-transactions-and-startup-fixes.cjs
  caused by unescaped nested template literals inside the patcher's generated code.
*/
const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const root = findProjectRoot();
const file = path.join(root, 'scripts', 'apply-financial-transactions-and-startup-fixes.cjs');

if (!fs.existsSync(file)) {
  console.error(`Could not find ${file}`);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const before = src;

// Fix generated-code template literals that accidentally terminate the patcher's outer template string.
src = src.replace(/return `\+\$\{amount\}`;/g, 'return "+" + amount;');

src = src.replace(
  /return `\*\*\$\{n\}\.\*\* \$\{flag\} \*\*\$\{renderTxAmount\(Number\(tx\.amount \?\? 0\)\)\}\*\* — \$\{String\(tx\.type\)\}\\n\$\{String\(tx\.description \?\? 'No description'\)\}\\n_\$\{date\} CST_`;/g,
  "return '**' + n + '.** ' + flag + ' **' + renderTxAmount(Number(tx.amount ?? 0)) + '** — ' + String(tx.type) + '\\n' + String(tx.description ?? 'No description') + '\\n_' + date + ' CST_';"
);

src = src.replace(
  /\.setFooter\(\{ text: `Showing up to your last 30 transactions • Page \$\{safePage \+ 1\}\/\$\{totalPages\} • ⚠️ pending\/unconfirmed\/applied-check item` \}\);/g,
  ".setFooter({ text: 'Showing up to your last 30 transactions • Page ' + (safePage + 1) + '/' + totalPages + ' • ⚠️ pending/unconfirmed/applied-check item' });"
);

src = src.replace(/\.setCustomId\(`ac_fin_tx_prev:\$\{safePage\}`\)/g, ".setCustomId('ac_fin_tx_prev:' + safePage)");
src = src.replace(/\.setCustomId\(`ac_fin_tx_next:\$\{safePage\}`\)/g, ".setCustomId('ac_fin_tx_next:' + safePage)");

// A broader safety pass inside this known helper block: remove remaining template backticks around custom IDs if present.
src = src.replace(/`ac_fin_tx_prev:\$\{([^}]+)\}`/g, "'ac_fin_tx_prev:' + $1");
src = src.replace(/`ac_fin_tx_next:\$\{([^}]+)\}`/g, "'ac_fin_tx_next:' + $1");

if (src === before) {
  console.log('No changes were made. The script may already be repaired, or the failing template text has changed.');
} else {
  fs.writeFileSync(file, src, 'utf8');
  console.log(`Repaired ${path.relative(root, file)}`);
  console.log('Now run: node scripts/apply-financial-transactions-and-startup-fixes.cjs');
}
