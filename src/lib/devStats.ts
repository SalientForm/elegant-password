import snapshot from './devStats.json';

/** How the app was built, snapshotted by `pnpm stats` (scripts/devStats.mjs). */
export type DevStats = typeof snapshot;
export const DEV_STATS: DevStats = snapshot;

export interface Stat {
  label: string;
  value: string;
  detail: string;
}

/**
 * Claude API list prices in USD per million tokens, from
 * https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-15).
 * Both models bill their whole 1M context at these rates; no batch or regional discount is assumed.
 */
export const PRICES_AS_OF = '2026-10-15';
export const PRICES: Record<string, { input: number; write5m: number; write1h: number; read: number; output: number }> = {
  'claude-fable-5-1': { input: 10, write5m: 12.5, write1h: 20, read: 0.25, output: 50 },
  'claude-opus-5-5': { input: 4, write5m: 5, write1h: 8, read: 0.2, output: 20 },
};

type ModelUsage = DevStats['models'][number];

/** What one model's recorded usage would have cost over the API, by kind of token; null for a model without a known price. */
export function apiCost(m: ModelUsage): { input: number; writes: number; reads: number; output: number; total: number } | null {
  const p = PRICES[m.model];
  if (!p) return null;
  const mtok = (n: number, price: number) => (n / 1e6) * price;
  const input = mtok(m.input, p.input);
  const writes = mtok(m.cacheWrite - m.cacheWrite1h, p.write5m) + mtok(m.cacheWrite1h, p.write1h);
  const reads = mtok(m.cacheRead, p.read);
  const output = mtok(m.output, p.output);
  return { input, writes, reads, output, total: input + writes + reads + output };
}

/** `$212`, or `$0.42` under ten dollars. */
export function dollars(x: number): string {
  return x >= 10 ? `$${Math.round(x).toLocaleString('en')}` : `$${x.toFixed(2)}`;
}

/** `claude-opus-5-5` -> `Claude Opus 5.5`: words capitalised, the trailing numbers joined as a version, a dated snapshot suffix dropped. */
export function modelName(id: string): string {
  const parts = id.split('-');
  if (/^\d{8}$/.test(parts[parts.length - 1]!)) parts.pop();
  const version = [];
  while (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]!)) version.unshift(parts.pop()!);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  return version.length ? `${name} ${version.join('.')}` : name;
}

/** 237_512_000 -> `238M`, 9_500 -> `9.5K`: one decimal below 100 of a unit, none above. */
export function compact(n: number): string {
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, unit] of units) {
    if (n >= size) {
      const v = n / size;
      return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;
    }
  }
  return String(n);
}

/** 1266 -> `21 h 6 min`; under an hour, minutes only. */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const total = (m: ModelUsage) => m.input + m.cacheWrite + m.cacheRead + m.output;
const n = (x: number) => x.toLocaleString('en');

/** The figures the Fun page shows, in order. */
export function devStatList(s: DevStats = DEV_STATS): Stat[] {
  const sum = (key: 'input' | 'cacheWrite' | 'cacheRead' | 'output') => s.models.reduce((t, m) => t + m[key], 0);
  const tokens = s.models.reduce((t, m) => t + total(m), 0);
  const calls = s.models.reduce((t, m) => t + m.calls, 0);
  const wallMinutes = (Date.parse(s.lastCommit) - Date.parse(s.firstPrompt)) / 60_000;
  return [
    {
      label: 'Estimated tokens used',
      value: compact(tokens),
      detail: `${compact(sum('output'))} written by the models, ${compact(sum('cacheRead'))} re-read from cache, ${compact(sum('cacheWrite'))} cached, ${compact(sum('input'))} fresh input, over ${n(calls)} calls`,
    },
    {
      label: s.models.length === 1 ? 'LLM model used' : 'LLM models used',
      value: s.models.map((m) => modelName(m.model)).join(', '),
      detail: s.models.map((m) => `${modelName(m.model)}: ${Math.round((100 * total(m)) / tokens)} % of tokens, ${n(m.calls)} calls`).join('; '),
    },
    costStat(s),
    {
      label: 'Lines of code',
      value: n(s.lines.app + s.lines.tests),
      detail: `${n(s.lines.app)} app, ${n(s.lines.tests)} tests, in ${n(s.lines.files)} files (non-blank lines)`,
    },
    {
      label: 'Time in development',
      value: duration(wallMinutes),
      detail: `from the first prompt to the last commit; ${duration(s.activeMinutes)} of it with the AI at work`,
    },
    { label: 'Commits', value: n(s.commits), detail: 'on main' },
    { label: 'Tests', value: n(s.tests), detail: 'unit and end-to-end' },
    {
      label: 'Prompts',
      value: n(s.prompts),
      detail: `typed by a person, answered with ${n(s.toolCalls)} tool calls across ${n(s.sessions)} sessions and ${n(s.subagents)} subagents`,
    },
  ];
}

/** The estimated API bill: each model's tokens at its list prices, split by model and by kind of token. */
function costStat(s: DevStats): Stat {
  const costs = s.models.map((m) => ({ m, c: apiCost(m) }));
  const priced = costs.filter((x): x is { m: ModelUsage; c: NonNullable<ReturnType<typeof apiCost>> } => x.c !== null);
  const sum = (key: 'input' | 'writes' | 'reads' | 'output') => priced.reduce((t, x) => t + x.c[key], 0);
  const unpriced = costs.filter((x) => !x.c).map((x) => modelName(x.m.model));
  return {
    label: 'Estimated cost over the API',
    value: dollars(priced.reduce((t, x) => t + x.c.total, 0)),
    detail:
      `${priced.map((x) => `${modelName(x.m.model)} ${dollars(x.c.total)}`).join(', ')}: ` +
      `${dollars(sum('output'))} output, ${dollars(sum('writes'))} cache writes, ${dollars(sum('reads'))} cache reads, ${dollars(sum('input'))} input, ` +
      `at list prices as of ${PRICES_AS_OF}` +
      (unpriced.length ? `; not counted: ${unpriced.join(', ')} (no known price)` : ''),
  };
}
