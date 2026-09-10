// Nothing outside the bridges may name another XS resource. A bridge may
// list one as one option among several; runtime code may not reach for one
// directly, or this stops being standalone.
//
//   node tools/check-standalone.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Where naming one is legitimate: the bridges that pick a backend, and the
// manifest comment that lists what is supported.
const ALLOWED = ['bridge' + sep, 'fxmanifest.lua', 'config.lua'];

const files = [];
const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'tools') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.lua') || entry.endsWith('.js')) files.push(full);
    }
};

walk(root);

const SIBLINGS = 'mdt|dispatch|evidence|phone|drugs|airdrops|admin|trucking|npcs|drone|criminaltablet|multicharacter|paintball|restaurantcreator|taxijob';
const NAME = new RegExp(`(?:XS-|cipher-)(?:${SIBLINGS})`, 'gi');

let problems = 0;

for (const file of files) {
    const relative = file.slice(root.length);
    if (ALLOWED.some(a => relative.startsWith(a))) continue;

    const src = readFileSync(file, 'utf8');
    const hits = new Set();
    for (const m of src.matchAll(NAME)) hits.add(m[0]);

    if (hits.size > 0) {
        console.log(`  ${relative} reaches for ${[...hits].join(', ')}`);
        problems++;
    }
}

// A bridge must never be the only path — each needs a fallback or a registry.
const dispatch = readFileSync(root + join('bridge', 'dispatch.lua'), 'utf8');
if (!dispatch.includes('AddBlipForCoord')) {
    console.log('  bridge/dispatch.lua has no notification fallback');
    problems++;
}

const target = readFileSync(root + join('bridge', 'target.lua'), 'utf8');
if (!target.includes("'builtin'")) {
    console.log('  bridge/target.lua has no built-in interaction fallback');
    problems++;
}

const mdt = readFileSync(root + join('bridge', 'mdt.lua'), 'utf8');
if (!mdt.includes("register('generic'") || !mdt.includes('RegisterMdtProvider')) {
    console.log('  bridge/mdt.lua has no generic provider or registry');
    problems++;
}

console.log(problems === 0
    ? `  ${files.length} files: nothing outside the bridges depends on another XS script.`
    : `  ${problems} coupling problem(s).`);

process.exit(problems === 0 ? 0 : 1);
