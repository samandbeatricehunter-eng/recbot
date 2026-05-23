/*
  REC Bot admin slash-command cleanup.
  Goal:
  - Hide/remove old admin slash commands from Discord registration.
  - Keep /menu registered.
  - Keep /new-server-setup registered only if src/commands/new-server-setup.ts exists.
  - Leave admin operation handler code intact so Commissioner Office can still open it internally.

  Run from project root:
    node apply-remove-admin-slash-commands.cjs

  Then re-register commands:
    npm run deploy
  or restart the bot if your ready event registers guild commands.
*/
const fs = require('fs');
const path = require('path');

function findRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find project root. Run this from the recbot project folder.');
}

const root = findRoot();
const stamp = Date.now();
function p(...parts) { return path.join(root, ...parts); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content, 'utf8'); }
function backup(file) {
  if (fs.existsSync(file)) fs.copyFileSync(file, file + `.bak-admin-cleanup-${stamp}`);
}

const hasNewServerSetup = fs.existsSync(p('src', 'commands', 'new-server-setup.ts'));

// 1) Rewrite command-list.ts so the only registered slash commands are /menu and optional /new-server-setup.
const commandListPath = p('src', 'lib', 'command-list.ts');
if (!fs.existsSync(commandListPath)) throw new Error('Missing src/lib/command-list.ts');
backup(commandListPath);
const commandList = `import type { ServerSettings } from "@workspace/db";
import * as actions from "../commands/actions.js";
${hasNewServerSetup ? 'import * as newServerSetup from "../commands/new-server-setup.js";\n' : ''}
/**
 * Builds the list of slash command JSON payloads to register with Discord.
 * Public command surface is intentionally limited. Admin workflows are reached
 * through /menu > League Operations > Commissioner's Office.
 */
export function buildCommandJSON(settings: ServerSettings | null = null): object[] {
  const entries: Array<{ data: { toJSON(): object } }> = [
    actions,
    ${hasNewServerSetup ? 'newServerSetup,' : ''}
  ];

  return entries.map((m) => m.data.toJSON());
}
`;
write(commandListPath, commandList);
console.log('Updated src/lib/command-list.ts');

// 2) Patch deploy-commands.ts allowed set if present.
const deployPath = p('src', 'deploy-commands.ts');
if (fs.existsSync(deployPath)) {
  backup(deployPath);
  let deploy = read(deployPath);
  deploy = deploy.replace(/const allowed = new Set\(\[[^\]]*\]\);/g,
    `const allowed = new Set(["menu"${hasNewServerSetup ? ', "new-server-setup"' : ''}]);`);
  deploy = deploy.replace(/Only keep the two allowed commands:[^\n]*/g,
    `Only keep the allowed commands: menu${hasNewServerSetup ? ' and new-server-setup' : ''}`);
  write(deployPath, deploy);
  console.log('Updated src/deploy-commands.ts');
}

// 3) Patch src/index.ts command registration list conservatively: remove admin modules from client.commands registration.
// This file is currently heavily minified into one line, so we avoid rewriting imports and only replace the commands array.
const indexPath = p('src', 'index.ts');
if (fs.existsSync(indexPath)) {
  backup(indexPath);
  let index = read(indexPath);

  // Ensure optional import exists for new-server-setup if file exists.
  if (hasNewServerSetup && !index.includes('new-server-setup.js')) {
    index = index.replace(
      'import * as actions from "./commands/actions.js";',
      'import * as actions from "./commands/actions.js"; import * as newServerSetup from "./commands/new-server-setup.js";'
    );
  }

  const newCommandsArray = `const commands = [ actions${hasNewServerSetup ? ', newServerSetup' : ''} ];`;
  const before = index;
  index = index.replace(/const commands = \[[\s\S]*?\]; for \(const command of commands\)/,
    `${newCommandsArray} for (const command of commands)`);

  if (index === before) {
    console.warn('WARNING: Could not locate commands array in src/index.ts. Command list/deploy were still patched.');
  } else {
    write(indexPath, index);
    console.log('Updated src/index.ts command registration array');
  }
}

// 4) Create a local note with next commands.
const notePath = p('ADMIN_COMMAND_CLEANUP_NEXT_STEPS.txt');
write(notePath, `Admin command cleanup applied.\n\nNext steps:\n1. Run: npm run deploy\n   - This clears global commands and re-registers only /menu${hasNewServerSetup ? ' and /new-server-setup' : ''}.\n2. Restart the bot: npm run dev\n3. In Discord, wait up to a minute and refresh/reopen the command picker.\n\nIf old slash commands still appear, they are stale Discord guild commands. Run:\n   npm run deploy\n\nIf there is no new-server-setup.ts file yet, this script intentionally registered only /menu.\n`);
console.log('Wrote ADMIN_COMMAND_CLEANUP_NEXT_STEPS.txt');
console.log('Done. Now run: npm run deploy');
