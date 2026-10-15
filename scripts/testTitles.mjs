// Collects every unit and smoke test title into src/lib/testTitles.json so the
// Fun-page prompt can list them: everything a test checks is in the spec.
// Run with `pnpm test:titles`; a unit test fails when the file is stale.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/lib/testTitles.json');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') yield* walk(p);
    } else if (/\.(test|spec)\.tsx?$/.test(name)) yield p;
  }
}

const TITLE = /\b(describe|it|test)(?:\.(?:each|skip|only)\([^)]*\))?\(\s*(['"`])((?:\\.|(?!\2).)*)\2/g;

export function collect() {
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'e2e'))].sort();
  return files.map((file) => {
    const text = readFileSync(file, 'utf8');
    const titles = [];
    for (const m of text.matchAll(TITLE)) titles.push({ kind: m[1] === 'describe' ? 'group' : 'test', title: m[3].replace(/\\'/g, "'") });
    return { file: relative(ROOT, file), titles };
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  writeFileSync(OUT, JSON.stringify(collect(), null, 2) + '\n');
  const n = collect().reduce((s, f) => s + f.titles.filter((t) => t.kind === 'test').length, 0);
  console.log(`${n} test titles written to ${relative(ROOT, OUT)}`);
}
