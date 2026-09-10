// html/js/mock.js hand-mirrors the stage schema in shared/stages.lua so the
// browser preview lays out real fields. Nothing keeps the two in step, and a
// field added to the Lua but not the mock means you are previewing a panel the
// game will never render.
//
//   node tools/check-mock-schema.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const lua = readFileSync(root + 'shared/stages.lua', 'utf8');
const mock = readFileSync(root + 'html/js/mock.js', 'utf8');

const keysIn = (src, re) => {
    const out = new Set();
    for (const m of src.matchAll(re)) out.add(m[1]);
    return out;
};

// Field keys, and the stage type ids each schema declares.
const luaFields = keysIn(lua, /\{\s*key\s*=\s*'([A-Za-z]+)'/g);
const mockFields = keysIn(mock, /\{\s*key:\s*'([A-Za-z]+)'/g);

const luaTypes = keysIn(lua, /^define\('([a-z]+)'/gm);
const mockTypes = keysIn(mock, /^\s*\['([a-z]+)',\s*'/gm);

const report = (what, a, b, aName, bName) => {
    const missing = [...a].filter(k => !b.has(k));
    if (missing.length === 0) return 0;
    console.log(`  ${what} in ${aName} but not ${bName}: ${missing.join(', ')}`);
    return missing.length;
};

let problems = 0;
problems += report('fields', luaFields, mockFields, 'shared/stages.lua', 'mock.js');
problems += report('fields', mockFields, luaFields, 'mock.js', 'shared/stages.lua');
problems += report('stage types', luaTypes, mockTypes, 'shared/stages.lua', 'mock.js');
problems += report('stage types', mockTypes, luaTypes, 'mock.js', 'shared/stages.lua');

console.log(problems === 0
    ? `  mock schema matches: ${luaFields.size} field keys, ${luaTypes.size} stage types.`
    : `  ${problems} difference(s) — the preview does not match the game.`);

process.exit(problems === 0 ? 0 : 1);
