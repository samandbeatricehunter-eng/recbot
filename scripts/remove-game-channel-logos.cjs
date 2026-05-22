const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'lib', 'game-channel-manager.ts');

if (!fs.existsSync(file)) {
  console.error(`Could not find ${file}`);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const original = src;

function removeNamedImport(name) {
  const pattern = new RegExp(`\\n?\\s*${name},`, 'g');
  src = src.replace(pattern, '');
}

// Remove unused Discord imports.
for (const name of ['AttachmentBuilder', 'Colors', 'TextChannel']) {
  removeNamedImport(name);
}

// Remove db table import for default logos.
removeNamedImport('defaultTeamLogosTable');

// Remove matchup image/gcs imports entirely.
src = src.replace(/\nimport \{ buildMatchupBanner, resolveLogoBuf \} from "\.\/matchup-image\.js";\n/g, '\n');
src = src.replace(/\nimport \{ globalLogoPath \} from "\.\/gcs-reader\.js";\n/g, '\n');

// Remove resolveLogoPath helper.
src = src.replace(/\nfunction resolveLogoPath\([\s\S]*?\n}\n\nexport interface CreatePrivateGameChannelsOptions/, '\nexport interface CreatePrivateGameChannelsOptions');

// Change Promise.all destructure from three values to two.
src = src.replace('const [mcaTeams, defaultLogos, allUsers] = await Promise.all([', 'const [mcaTeams, allUsers] = await Promise.all([');

// Remove defaultTeamLogosTable query block from Promise.all.
src = src.replace(/\n\s*db\n\s*\.select\(\{\n\s*teamId: defaultTeamLogosTable\.teamId,\n\s*fullName: defaultTeamLogosTable\.fullName,\n\s*nickName: defaultTeamLogosTable\.nickName,\n\s*logoUrl: defaultTeamLogosTable\.logoUrl,\n\s*\}\)\n\s*\.from\(defaultTeamLogosTable\),\n/g, '\n');

// Remove default logo maps block.
src = src.replace(/\n\s*const defaultById = new Map<number, string>\(\);\n\s*const defaultByName = new Map<string, string>\(\);\n\n\s*for \(const d of defaultLogos\) \{[\s\S]*?\n\s*}\n\n\s*const teamToDiscord = new Map<string, string>\(\);/, '\n  const teamToDiscord = new Map<string, string>();');

// Remove async matchup banner/logo generation block.
src = src.replace(/\n\s*const awayMca = teamToMca\.get\([\s\S]*?\n\s*\}\)\(\);/g, '');

// Tidy extra blank lines.
src = src.replace(/\n{3,}/g, '\n\n');

if (src === original) {
  console.warn('No changes were made. The file may already be patched, or the source format differs from expected.');
} else {
  fs.writeFileSync(file, src, 'utf8');
  console.log('Updated src/lib/game-channel-manager.ts');
  console.log('Removed team logo lookup and matchup banner generation.');
}
