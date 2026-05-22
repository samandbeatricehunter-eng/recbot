#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'src', 'commands', 'actions.ts');

if (!fs.existsSync(file)) {
  console.error(`Could not find ${file}`);
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');
const backup = `${file}.bak-banner-top-${Date.now()}`;
fs.writeFileSync(backup, src, 'utf8');

// Remove embed-linked banner image so Discord renders the uploaded file as a normal attachment above the embed.
src = src.replace(/\n\s*\.setImage\("attachment:\/\/rec-embed-banner\.png"\)/g, '');

// If an old thumbnail version exists, remove it too.
src = src.replace(/\n\s*\.setThumbnail\("attachment:\/\/rec-embed-banner\.png"\)/g, '');

fs.writeFileSync(file, src, 'utf8');

console.log('Updated src/commands/actions.ts');
console.log(`Backup created: ${backup}`);
console.log('Banner attachment will now render above the /menu embed instead of inside the embed body.');
