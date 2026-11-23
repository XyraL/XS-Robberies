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

const petty = readFileSync(root + 'shared/petty.lua', 'utf8');
const pettyKinds = new Set([...petty.matchAll(/define\('([a-z]+)'/g)].map(m => m[1]));
const mockPetty = catalogue.petty || { kinds: [], shops: {} };
const mockKinds = new Set(mockPetty.kinds.map(k => k.id));

const configBody = petty.slice(petty.indexOf('local function config('), petty.indexOf('\nend', petty.indexOf('local function config(')));
const luaConfigKeys = new Set([...configBody.matchAll(/^\s*(?:local\s+)?(?:cfg\.)?([a-zA-Z]+)\s*=(?!=)/gm)].map(m => m[1]).filter(k => !['cfg', 'local'].includes(k)));

const mockConfigKeys = new Set();
const collect = (value) => {
    if (Array.isArray(value)) return;
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            mockConfigKeys.add(k);
            collect(v);
        }
    }
};
mockPetty.kinds.forEach(k => collect(k.defaults));

const shopKeys = new Set(Object.keys(mockPetty.shops || {}));
const luaShopBody = petty.slice(petty.indexOf('Petty.shopDefaults = {'), petty.indexOf('}', petty.indexOf('clerks = {}')));
const luaShopKeys = new Set([...luaShopBody.matchAll(/^\s*([a-zA-Z]+)\s*=/gm)].map(m => m[1]));

const problems = [
    ['fields in shared/stages.lua but not the catalogue', diff(luaFields, mockFields)],
    ['fields in the catalogue but not shared/stages.lua', diff(mockFields, luaFields)],
    ['stage types in shared/stages.lua but not the catalogue', diff(luaTypes, mockTypes)],
    ['stage types in the catalogue but not shared/stages.lua', diff(mockTypes, luaTypes)],
    ['petty crimes in shared/petty.lua but not the catalogue', diff(pettyKinds, mockKinds)],
    ['petty crimes in the catalogue but not shared/petty.lua', diff(mockKinds, pettyKinds)],
    ['petty settings in shared/petty.lua but not the catalogue', diff(luaConfigKeys, mockConfigKeys)],
    ['petty settings in the catalogue but not shared/petty.lua', [...mockConfigKeys].filter(k => !new RegExp(`\\b${k}\\s*=`).test(petty))],
    ['shop clerk settings that differ', [...diff(luaShopKeys, shopKeys), ...diff(shopKeys, luaShopKeys)]],
].filter(([, list]) => list.length);

for (const [label, list] of problems) console.log(`  ${label}: ${list.join(', ')}`);

const count = problems.reduce((n, [, list]) => n + list.length, 0);
console.log(count
    ? `  ${count} difference(s). Regenerate html/js/mock-catalogue.js from the Lua.`
    : `  ${luaTypes.size} stage types, ${luaFields.size} fields, ${pettyKinds.size} petty crimes and ${mockConfigKeys.size} petty settings match the preview catalogue.`);
process.exit(count ? 1 : 0);
