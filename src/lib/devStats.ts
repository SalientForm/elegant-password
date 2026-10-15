import snapshot from './devStats.json';

/** How the app was built, snapshotted by `pnpm stats` (scripts/devStats.mjs). */
export type DevStats = typeof snapshot;
export const DEV_STATS: DevStats = snapshot;

export interface Stat {
  label: string;
  value: string;
  detail: string;
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

const total = (m: DevStats['models'][number]) => m.input + m.cacheWrite + m.cacheRead + m.output;
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
