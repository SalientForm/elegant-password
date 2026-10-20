// The names tep accepts for typing modes, site presets and strength
// presets: derived from the labels in the shared core, never a second list
// kept by hand, so a preset added to the app is a name tep knows.

import { TYPING_MODES, type TypingMode } from '../lib/difficulty';
import { SITE_PRESETS, type SitePreset } from '../lib/sitePresets';

/** A label as a name to type: "Short max (16)" -> "short-max-16", "8-20, few symbols" -> "8-20-few-symbols". */
export const slugOf = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Edit distance counting a swap of two neighbouring letters as one edit ("spcae" is one from "space"), for "did you mean". */
export function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, d[i - 2]![j - 2]! + 1);
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

/** The candidate `input` is most likely a slip for: within a third of its length in edits, or one it starts. Undefined when none is close. */
export function closest(input: string, candidates: readonly string[]): string | undefined {
  const typed = input.toLowerCase();
  if (!typed) return undefined;
  const prefixed = candidates.filter((c) => c.startsWith(typed));
  if (prefixed.length === 1) return prefixed[0];
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = distance(typed, c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best !== undefined && bestD <= Math.max(1, Math.floor(Math.max(typed.length, best.length) / 3)) ? best : undefined;
}

export interface Named<T> {
  name: string;
  /** Other names that mean the same. */
  aliases: string[];
  label: string;
  value: T;
}

/** The typing modes: their ids, and their labels where those differ ("minimal-quick" for quick). */
export const MODE_NAMES: readonly Named<TypingMode>[] = TYPING_MODES.map((m) => ({
  name: m.id,
  aliases: slugOf(m.label) === m.id ? [] : [slugOf(m.label)],
  label: m.label,
  value: m.id,
}));

/** The site presets by name. */
export const SITE_NAMES: readonly Named<SitePreset>[] = SITE_PRESETS.map((p) => ({ name: slugOf(p.label), aliases: [], label: p.label, value: p }));

export type Lookup<T> = { ok: true; value: T; name: string } | { ok: false; error: string };

/** The entry `input` names, or a message listing the names there are and the likeliest one meant. */
export function lookup<T>(what: string, names: readonly Named<T>[], input: string): Lookup<T> {
  const typed = input.trim().toLowerCase();
  const hit = names.find((n) => n.name === typed || n.aliases.includes(typed));
  if (hit) return { ok: true, value: hit.value, name: hit.name };
  const all = names.flatMap((n) => [n.name, ...n.aliases]);
  const near = closest(typed, all);
  return {
    ok: false,
    error: `"${input}" is not a ${what}. The ${what}s are: ${names.map((n) => (n.aliases.length ? `${n.name} (or ${n.aliases.join(', ')})` : n.name)).join(', ')}.${near ? ` Did you mean ${near}?` : ''}`,
  };
}

/** A mode's name as tep writes it. */
export const modeName = (mode: TypingMode) => MODE_NAMES.find((m) => m.value === mode)!.name;
/** A site preset's name as tep writes it. */
export const siteName = (preset: SitePreset) => SITE_NAMES.find((s) => s.value === preset)!.name;
