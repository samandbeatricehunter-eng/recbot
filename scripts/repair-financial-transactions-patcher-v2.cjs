const fs = require('fs');
const path = require('path');

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'scripts'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

const root = findProjectRoot(process.cwd());
const candidates = [
  path.join(root, 'scripts', 'apply-financial-transactions-and-startup-fixes.cjs'),
  path.join(process.cwd(), 'apply-financial-transactions-and-startup-fixes.cjs'),
  path.join(process.cwd(), 'scripts', 'apply-financial-transactions-and-startup-fixes.cjs'),
];

const target = candidates.find((p) => fs.existsSync(p));

if (!target) {
  console.error('Could not find apply-financial-transactions-and-startup-fixes.cjs');
  console.error('Run this from either the project root or the scripts folder.');
  process.exit(1);
}

let src = fs.readFileSync(target, 'utf8');

const before = src;

// Fix the remaining nested template literal inside the patch script's generated TypeScript.
// This line was causing Node to parse ${...} while loading the patch script.
src = src.replace(
  /return `\*\*\$\{n\}\.\*\* \$\{flag\} \*\*\$\{renderTxAmount\(Number\(tx\.amount \?\? 0\)\)\}\*\* — \$\{String\(tx\.type\)\}\\\\n\$\{String\(tx\.description \?\? 'No description'\)\}\\\\n_\$\{date\} CST_`;/g,
  "return '**' + n + '.** ' + flag + ' **' + renderTxAmount(Number(tx.amount ?? 0)) + '** — ' + String(tx.type) + '\\\\n' + String(tx.description ?? 'No description') + '\\\\n_' + date + ' CST_';"
);

// Also catch a looser version in case whitespace or escaping changed.
src = src.replace(
  /return `\*\*\$\{n\}\.\*\* \$\{flag\} \*\*\$\{renderTxAmount\(Number\(tx\.amount \?\? 0\)\)\}\*\* — \$\{String\(tx\.type\)\}\\n\$\{String\(tx\.description \?\? 'No description'\)\}\\n_\$\{date\} CST_`;/g,
  "return '**' + n + '.** ' + flag + ' **' + renderTxAmount(Number(tx.amount ?? 0)) + '** — ' + String(tx.type) + '\\n' + String(tx.description ?? 'No description') + '\\n_' + date + ' CST_';"
);

if (src === before) {
  console.warn('No matching nested transaction template line was found.');
  console.warn('The patcher may already be repaired, or the line differs from the expected form.');
} else {
  fs.writeFileSync(target, src, 'utf8');
  console.log(`Repaired ${path.relative(root, target)}`);
}

console.log('Now run:');
console.log('node scripts/apply-financial-transactions-and-startup-fixes.cjs');
