// The browser preview reads its stage schema from html/js/mock-catalogue.js,
// which is generated from shared/stages.lua. This catches the two drifting
// apart: a field added to the Lua after the catalogue was last generated means
// the preview shows a panel the game will not render.
//
//   node tools/check-mock-schema.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const lua = readFileSync(root + 'shared/stages.lua', 'utf8');
const raw = readFileSync(root + 'html/js/mock-catalogue.js', 'utf8');
const catalogue = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));

const luaFields = new Set([...lua.matchAll(/\{\s*key\s*=\s*'([a-zA-Z]+)'/g)].map(m => m[1]));
const luaTypes = new Set([...lua.matchAll(/define\('([a-z]+)'/g)].map(m => m[1]));

const mockFields = new Set();
const mockTypes = new Set();
for (const type of catalogue.stageTypes) {
    mockTypes.add(type.id);
    for (const f of type.fields) mockFields.add(f.key);
}

const diff = (a, b) => [...a].filter(x => !b.has(x));
const problems = [
    ['fields in shared/stages.lua but not the catalogue', diff(luaFields, mockFields)],
    ['fields in the catalogue but not shared/stages.lua', diff(mockFields, luaFields)],
    ['stage types in shared/stages.lua but not the catalogue', diff(luaTypes, mockTypes)],
    ['stage types in the catalogue but not shared/stages.lua', diff(mockTypes, luaTypes)],
].filter(([, list]) => list.length);

for (const [label, list] of problems) console.log(`  ${label}: ${list.join(', ')}`);

const count = problems.reduce((n, [, list]) => n + list.length, 0);
console.log(count
    ? `  ${count} difference(s). Regenerate html/js/mock-catalogue.js from the Lua.`
    : `  ${luaTypes.size} stage types and ${luaFields.size} fields match the preview catalogue.`);
process.exit(count ? 1 : 0);
