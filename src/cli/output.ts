// How tep g prints passwords: a table at a terminal, the passwords alone
// when piped, or JSON. Every figure and every sentence comes from the shared
// core (scoreReadings, the explain lines), so the terminal says what the web
// card says.

import type { TypingMode } from '../lib/difficulty';
import type { Outcome } from '../lib/engine';
import { easedIn, easedLine, twistLine, twistOptionsLine, typingLines } from '../lib/explain';
import { roleLabel, type Plan, type Suggestion } from '../lib/generate';
import { isMadeUpNoun } from '../lib/grammar';
import { READING_ORDER, scoreReadings, type Band, type ScoreReadings } from '../lib/readings';
import type { SortOrder } from '../lib/sort';
import type { Format } from './flagList';

/** ANSI styling, or none. */
export interface Paint {
  green(s: string): string;
  yellow(s: string): string;
  red(s: string): string;
  dim(s: string): string;
  bold(s: string): string;
}

const wrap = (open: number, close: number) => (s: string) => `\u001b[${open}m${s}\u001b[${close}m`;
export const COLOR: Paint = { green: wrap(32, 39), yellow: wrap(33, 39), red: wrap(31, 39), dim: wrap(2, 22), bold: wrap(1, 22) };
export const PLAIN: Paint = { green: (s) => s, yellow: (s) => s, red: (s) => s, dim: (s) => s, bold: (s) => s };

/** Whether to colour a stream: a terminal, NO_COLOR unset, --no-color not given. */
export const useColor = (isTTY: boolean, env: Record<string, string | undefined>, flag: boolean) => isTTY && flag && !env.NO_COLOR;

const byBand = (p: Paint, band: Band | null) => (band === 'high' ? p.green : band === 'mid' ? p.yellow : band === 'low' ? p.red : p.dim);
/** Difficulty is coloured by level: effortless and easy green, moderate yellow, demanding and hard red. */
const byLevel = (p: Paint, level: number) => (level <= 1 ? p.green : level === 2 ? p.yellow : p.red);

export function badges(r: ScoreReadings, p: Paint): string {
  return READING_ORDER.map((key) => (key === 'difficulty' ? byLevel(p, r.difficulty.level) : byBand(p, r[key].band))(`${r[key].label} ${r[key].value}`)).join('  ');
}

export interface Shown {
  outcome: Extract<Outcome, { ok: true }>;
  /** The suggestions as shown: rescored for the typing mode and ordered. */
  suggestions: Suggestion[];
  typingMode: TypingMode;
  sort: SortOrder;
  minUppercase: number;
  /** Warnings for stderr, also put in the JSON. */
  warnings: string[];
}

const readingsOf = (s: Suggestion) => scoreReadings({ strength: s.strength, raw: s.raw, difficulty: s.difficulty, memorability: s.memorability });

/** The plan's exact strength and where it comes from (made-up sentences only). */
export function planLines(plan: Plan): string[] {
  const parts = plan.breakdown.map((b) => `${b.label} ${b.bits.toFixed(1)} (${b.poolSize.toLocaleString('en')})`);
  return [
    `Plan: ${plan.bits.toFixed(1)} bits for anyone who knows exactly how tep works, ${plan.meetsTarget ? 'meeting' : 'short of'} the target.`,
    `  From: ${parts.join(', ')}${plan.lengthPenaltyBits > 0.05 ? `; less ${plan.lengthPenaltyBits.toFixed(1)} for the length limits` : ''}.`,
  ];
}

/** The "Why?" of one password, as lines. */
export function explainLines(s: Suggestion, context: { separator: string; minUppercase: number }): string[] {
  const words = s.words.map((w) => {
    const role = roleLabel(w, isMadeUpNoun(w.original));
    return w.text === w.original ? `${w.text} (${role})` : `${w.text} for "${w.original}" (${role})`;
  });
  const out = [`Words: ${words.join(', ')}`];
  for (const step of s.steps) out.push(`Step: ${step}`);
  for (const t of s.twists) out.push(`Swap: ${twistLine(t)}`);
  const options = twistOptionsLine(s);
  if (options) out.push(options);
  for (const e of easedIn(s.password, s.hint)) out.push(`Deliberate swap: ${easedLine(e)}`);
  out.push('Fast to type:', ...typingLines(s, context).map((l) => `  ${l}`));
  out.push('Rules:', ...s.checks.map((c) => `  ${c.met ? 'met' : 'NOT met'}: ${c.rule}: ${c.how}`));
  return out;
}

export function renderTable(shown: Shown, p: Paint, explain: boolean): string {
  const { suggestions, outcome } = shown;
  const width = Math.max(...suggestions.map((s) => [...s.password].length));
  const index = String(suggestions.length).length;
  const context = { separator: outcome.separator, minUppercase: shown.minUppercase };
  const lines: string[] = [];
  if (explain && outcome.plan) lines.push(...planLines(outcome.plan).map((l) => p.dim(l)), '');
  suggestions.forEach((s, i) => {
    const n = String(i + 1).padStart(index);
    // The bits are this session's figure (an attacker who knows tep and the swaps in force), not a score: dim, after the badges.
    lines.push(`${p.dim(n)}  ${p.bold(s.password)}${' '.repeat(width - [...s.password].length)}   ${badges(readingsOf(s), p)}  ${p.dim(`${s.bits.toFixed(1)} bits`)}`);
    const pad = ' '.repeat(index + 2);
    lines.push(`${pad}${p.dim(`hint: ${s.hint}`)}`);
    if (explain) {
      lines.push(...explainLines(s, context).map((l) => `${pad}${l}`));
      if (i < suggestions.length - 1) lines.push('');
    }
  });
  return `${lines.join('\n')}\n`;
}

export const renderPlain = (shown: Shown) => `${shown.suggestions.map((s) => s.password).join('\n')}\n`;

export function renderJson(shown: Shown, explain: boolean): string {
  const { outcome } = shown;
  const context = { separator: outcome.separator, minUppercase: shown.minUppercase };
  return `${JSON.stringify(
    {
      mode: outcome.source,
      typingMode: shown.typingMode,
      separator: outcome.separator,
      sort: shown.sort,
      warnings: shown.warnings,
      ...(explain && outcome.plan ? { plan: { bits: outcome.plan.bits, meetsTarget: outcome.plan.meetsTarget, breakdown: outcome.plan.breakdown } } : {}),
      suggestions: shown.suggestions.map((s) => {
        const r = readingsOf(s);
        return {
          password: s.password,
          hint: s.hint,
          strength: s.strength,
          raw: s.raw,
          bits: s.bits,
          difficulty: s.difficulty.score,
          difficultyLabel: s.difficulty.label,
          memorability: s.memorability,
          readings: { strength: r.strength.text, raw: r.raw.text, difficulty: r.difficulty.text, memorability: r.memorability.text },
          ...(explain ? { explain: explainLines(s, context) } : {}),
        };
      }),
    },
    null,
    2,
  )}\n`;
}

export function render(format: Format, shown: Shown, p: Paint, explain: boolean): string {
  if (format === 'json') return renderJson(shown, explain);
  if (format === 'plain') return renderPlain(shown);
  return renderTable(shown, p, explain);
}
