// Snapshots how this app was built into src/lib/devStats.json for the Fun page:
// tokens and models from the Claude Code transcripts of this project (they live
// only on the machine that built it, so this runs by hand, not in the build),
// commits from git, lines of code and tests from the tree. Only counts, dates
// and model ids are written; no transcript text leaves the machine.
// Run with `pnpm stats`.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'src/lib/devStats.json');
/** Claude Code keeps a project's transcripts under its path with every slash turned into a dash. */
const TRANSCRIPTS = join(homedir(), '.claude/projects', ROOT.replace(/\//g, '-'));
/** Activity with no event for longer than this is a pause, not working time. */
const IDLE_MS = 5 * 60_000;

function* walk(dir, test) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', 'test-results', '.claude', '.git'].includes(name)) yield* walk(p, test);
    } else if (test(name)) yield p;
  }
}

function transcripts() {
  const calls = new Map(); // one entry per API call: a reply split over several lines repeats its usage
  const times = [];
  let prompts = 0;
  let tools = 0;
  let subagents = 0;
  let sessions = 0;
  let firstPrompt = null;
  for (const file of walk(TRANSCRIPTS, (n) => n.endsWith('.jsonl'))) {
    const sub = file.includes('/subagents/');
    if (sub) subagents++;
    else sessions++;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o.timestamp) times.push(Date.parse(o.timestamp));
      const m = o.message ?? {};
      if (o.type === 'assistant' && m.usage && m.model && m.model !== '<synthetic>') {
        calls.set(m.id ?? o.requestId, { model: m.model, usage: m.usage });
        for (const c of Array.isArray(m.content) ? m.content : []) if (c?.type === 'tool_use') tools++;
      }
      // A prompt the user typed (images and system notifications arrive with another source).
      if (o.type === 'user' && !sub && o.promptSource === 'sdk') {
        prompts++;
        if (!firstPrompt || o.timestamp < firstPrompt) firstPrompt = o.timestamp;
      }
    }
  }
  const byModel = new Map();
  for (const { model, usage } of calls.values()) {
    const t = byModel.get(model) ?? { model, calls: 0, input: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 };
    t.calls++;
    t.input += usage.input_tokens ?? 0;
    t.cacheWrite += usage.cache_creation_input_tokens ?? 0;
    t.cacheWrite1h += usage.cache_creation?.ephemeral_1h_input_tokens ?? 0; // the rest are 5-minute writes, priced lower
    t.cacheRead += usage.cache_read_input_tokens ?? 0;
    t.output += usage.output_tokens ?? 0;
    byModel.set(model, t);
  }
  times.sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] <= IDLE_MS) activeMs += times[i] - times[i - 1];
  const models = [...byModel.values()].sort((a, b) => b.input + b.cacheWrite + b.cacheRead + b.output - (a.input + a.cacheWrite + a.cacheRead + a.output));
  return { models, prompts, tools, subagents, sessions, firstPrompt, activeMinutes: Math.round(activeMs / 60_000) };
}

/** Non-blank lines of the app's own source, split into app code and tests. */
function lines() {
  const count = { app: 0, tests: 0, files: 0 };
  const files = [...walk(join(ROOT, 'src'), (n) => /\.(tsx?|css)$/.test(n)), ...walk(join(ROOT, 'e2e'), (n) => /\.tsx?$/.test(n)), ...walk(join(ROOT, 'scripts'), (n) => n.endsWith('.mjs')), ...walk(join(ROOT, 'build'), (n) => n.endsWith('.ts')), ...['index.html', 'vite.config.ts', 'playwright.config.ts'].map((f) => join(ROOT, f)).filter(existsSync)];
  for (const file of files) {
    const n = readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).length;
    const rel = relative(ROOT, file);
    if (/\.(test|spec)\.tsx?$/.test(rel) || rel.startsWith('e2e/')) count.tests += n;
    else count.app += n;
    count.files++;
  }
  return count;
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

export function collect() {
  const t = transcripts();
  const titles = JSON.parse(readFileSync(join(ROOT, 'src/lib/testTitles.json'), 'utf8'));
  return {
    asOf: new Date().toISOString(),
    firstPrompt: t.firstPrompt,
    lastCommit: new Date(git('log', '-1', '--format=%cI')).toISOString(),
    activeMinutes: t.activeMinutes,
    commits: Number(git('rev-list', '--count', 'HEAD')),
    lines: lines(),
    tests: titles.reduce((s, f) => s + f.titles.filter((x) => x.kind === 'test').length, 0),
    prompts: t.prompts,
    toolCalls: t.tools,
    sessions: t.sessions,
    subagents: t.subagents,
    models: t.models,
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  if (!existsSync(TRANSCRIPTS)) throw new Error(`No Claude Code transcripts at ${TRANSCRIPTS}: run this on the machine the app was built on.`);
  const stats = collect();
  writeFileSync(OUT, JSON.stringify(stats, null, 2) + '\n');
  console.log(`Development stats written to ${relative(ROOT, OUT)}`);
  console.log(JSON.stringify({ ...stats, models: stats.models.map((m) => m.model) }));
}
