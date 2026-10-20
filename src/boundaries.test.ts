// The web app and the CLI share one core (src/lib) and must not drift
// apart. These tests hold the layout of docs/plans/2026-10-20-tep-cli-plan.md
// §0 in place: what each directory may import, and that both front ends
// reach the engine through the same shared calls instead of their own
// copies.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;

function filesUnder(dir: string): string[] {
  const abs = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(abs, name);
    if (statSync(path).isDirectory()) return filesUnder(relative(ROOT, path));
    return /\.(ts|tsx)$/.test(name) ? [relative(ROOT, path)] : [];
  });
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file);
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');

/** The code with comments taken out, so a comment that mentions localStorage is not a use of it. */
const code = (file: string) =>
  source(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

interface Import {
  from: string;
  names: string[];
  /** `import type`: erased when compiled, so it loads nothing. */
  typeOnly: boolean;
}

/** Every static import and re-export: where from, and the names taken (types included). */
function importsOf(file: string): Import[] {
  const out: Import[] = [];
  const text = code(file);
  for (const m of text.matchAll(/(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clause = m[2]!;
    const braced = clause.match(/\{([\s\S]*)\}/)?.[1] ?? '';
    const names = braced
      .split(',')
      .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]!.trim())
      .filter(Boolean);
    const plain = clause.replace(/\{[\s\S]*\}/, '').replace(/[,\s]/g, '');
    if (plain && plain !== '*' && !plain.startsWith('*as')) names.push(plain);
    out.push({ from: m[3]!, names, typeOnly: !!m[1] });
  }
  for (const m of text.matchAll(/import\s+['"]([^'"]+)['"]/g)) out.push({ from: m[1]!, names: [], typeOnly: false });
  for (const m of text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ from: m[1]!, names: [], typeOnly: false });
  return out;
}

const LIB = filesUnder('src/lib');
const CLI = filesUnder('src/cli');
const WEB = [...filesUnder('src/components'), ...filesUnder('src/state'), 'src/App.tsx', 'src/main.tsx', 'src/worker.ts'];

describe('src/lib, the shared core', () => {
  it('imports only from src/lib', () => {
    const outside = LIB.filter((f) => !isTest(f)).flatMap((f) =>
      importsOf(f)
        .filter((i) => !i.from.startsWith('./'))
        .map((i) => `${f} imports ${i.from}`),
    );
    expect(outside).toEqual([]);
  });

  it('uses no browser or Node global, so it runs in both', () => {
    const globals = /\b(window|document|localStorage|sessionStorage|navigator|process)\.|\bnew Worker\b|\brequire\(|['"]node:/;
    const uses = LIB.filter((f) => !isTest(f)).flatMap((f) =>
      code(f)
        .split('\n')
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => globals.test(line))
        .map(({ line, n }) => `${f}:${n}: ${line.trim()}`),
    );
    expect(uses).toEqual([]);
  });

  it('has tests that reach into neither front end', () => {
    const reaching = LIB.filter(isTest).flatMap((f) =>
      importsOf(f)
        .filter((i) => /\/(components|state|cli|prompts)\/|^react/.test(i.from))
        .map((i) => `${f} imports ${i.from}`),
    );
    expect(reaching).toEqual([]);
  });
});

describe('the front ends', () => {
  it('keep apart: the web never imports the CLI', () => {
    const crossing = WEB.flatMap((f) =>
      importsOf(f)
        .filter((i) => /(^|\/)cli\//.test(i.from))
        .map((i) => `${f} imports ${i.from}`),
    );
    expect(crossing).toEqual([]);
  });

  it('keep apart: the CLI imports only src/lib, Node, its own packages and package.json', () => {
    const allowed = /^(\.\/|\.\.\/lib\/|node:|yaml$|zod$|@clack\/prompts$|\.\.\/\.\.\/package\.json$|vitest$)/;
    const outside = CLI.flatMap((f) =>
      importsOf(f)
        .filter((i) => !allowed.test(i.from) && !(isTest(f) && /^\.\.\/\.\.\//.test(i.from)))
        .map((i) => `${f} imports ${i.from}`),
    );
    expect(outside).toEqual([]);
  });

  /**
   * The engine's inner steps, which a front end must reach only through the
   * shared pipeline (inputsFor, runInputs, presentSuggestions) and readings
   * (scoreReadings). A front end importing one of these is a front end
   * about to do the step its own way.
   */
  const INNER = ['generate', 'fromSentence', 'scoreCold', 'scoreAlone', 'scoreDifficulty', 'difficultyIn', 'sortSuggestions', 'activeMappings', 'strengthLevel', 'memorabilityLevel', 'strengthWord'];

  it('the CLI reaches the engine only through the shared pipeline', () => {
    const inner = CLI.filter((f) => !isTest(f)).flatMap((f) =>
      importsOf(f)
        .filter((i) => i.from.startsWith('../lib/'))
        .flatMap((i) => i.names.filter((n) => INNER.includes(n)).map((n) => `${f} imports ${n} from ${i.from}`)),
    );
    expect(inner).toEqual([]);
  });

  it('the web builds its inputs, orders its suggestions and reads its badges through the same shared calls', () => {
    const names = (file: string, from: string) => importsOf(file).filter((i) => i.from === from).flatMap((i) => i.names);
    expect(names('src/state/PasswordsProvider.tsx', '../lib/pipeline')).toContain('inputsFor');
    expect(names('src/App.tsx', './lib/pipeline')).toContain('presentSuggestions');
    expect(importsOf('src/App.tsx').flatMap((i) => i.names)).not.toContain('sortSuggestions');
    expect(importsOf('src/App.tsx').flatMap((i) => i.names)).not.toContain('difficultyIn');
    expect(names('src/components/SuggestionCard.tsx', '../lib/readings')).toContain('scoreReadings');
    expect(code('src/state/PasswordsProvider.tsx')).not.toMatch(/mappings:\s*appliedMappings/);
  });
});

/** The source file a relative import loads, or undefined for a package or a non-code file. */
function resolveImport(from: string, spec: string): string | undefined {
  if (!spec.startsWith('.')) return undefined;
  const base = join(ROOT, from, '..', spec.split('?')[0]!);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile() && /\.tsx?$/.test(candidate)) return relative(ROOT, candidate);
    } catch {
      // Not this one.
    }
  }
  return undefined;
}

/** Every source file the browser loads from these entries, following imports that are not type-only. */
function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const i of importsOf(file)) {
      if (i.typeOnly) continue;
      const next = resolveImport(file, i.from);
      if (next) queue.push(next);
    }
  }
  return seen;
}

describe('the browser bundle', () => {
  it('loads nothing that needs Node or the CLI\'s packages, though the Fun page shows the CLI\'s prompt', () => {
    const files = reachable(['src/main.tsx', 'src/worker.ts']);
    expect([...files].some((f) => f.startsWith('src/cli/'))).toBe(true); // the CLI prompt draws on the CLI's pure modules
    const bad = [...files].flatMap((f) =>
      importsOf(f)
        .filter((i) => !i.typeOnly && /^(node:|yaml$|zod$|@clack\/)/.test(i.from))
        .map((i) => `${f} imports ${i.from}`),
    );
    expect(bad).toEqual([]);
  });
});

describe('this test', () => {
  it('reads imports of every shape the code uses', () => {
    const sample = importsOf('src/state/PasswordsProvider.tsx');
    expect(sample.find((i) => i.from === '../lib/pipeline')?.names).toEqual(['inputsFor']);
    expect(sample.find((i) => i.from === 'react')?.names).toContain('createContext');
    expect(sample.find((i) => i.from === '../lib/generate')?.names).toEqual(['GeneratedSentence', 'Requirements', 'Suggestion']);
    expect(sample.find((i) => i.from === '../lib/generate')?.typeOnly).toBe(true);
    expect(resolveImport('src/App.tsx', './lib/pipeline')).toBe('src/lib/pipeline.ts');
    expect(resolveImport('src/App.tsx', 'react')).toBeUndefined();
  });
});
