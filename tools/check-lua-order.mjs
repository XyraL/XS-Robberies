// A `local function` is only visible after its declaration. Calling one earlier
// in the file silently resolves to a nil global, which the syntax checker
// cannot see and which only shows up when a player triggers that exact path.
//
//   node tools/check-lua-order.mjs [path]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || '.';
const files = [];

const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.git') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.lua')) files.push(full);
    }
};

walk(base);

let problems = 0;

for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const lineOf = (index) => src.slice(0, index).split('\n').length;

    const declared = new Map();
    const declRe = /^[ \t]*local function ([A-Za-z_][A-Za-z0-9_]*)/gm;
    let d;
    while ((d = declRe.exec(src))) {
        if (!declared.has(d[1])) declared.set(d[1], d.index);
    }

    for (const [name, at] of declared) {
        const callRe = new RegExp(`[^A-Za-z0-9_.:]${name}\\s*\\(`, 'g');
        let c;
        while ((c = callRe.exec(src))) {
            if (c.index >= at) break;

            // A forward declaration (`local name` on its own) makes it legal.
            const forward = new RegExp(`^[ \\t]*local ${name}\\b(?!\\s*=?\\s*function)`, 'm');
            if (forward.test(src.slice(0, c.index))) break;

            console.log(`  ${file}`);
            console.log(`      ${name}() called on line ${lineOf(c.index)}, declared on line ${lineOf(at)}`);
            problems++;
            break;
        }
    }
}

console.log(problems === 0
    ? `  ${files.length} Lua files, no local function used before its declaration.`
    : `  ${problems} use-before-declaration problem(s).`);

process.exit(problems === 0 ? 0 : 1);
