// Random walks through tep config (spec §9): whatever allowed choice or
// in-range value is picked at every question, review edits included, the
// wizard never meets a contradiction, never reaches a question with no
// allowed answer, saves a file tep g can use, and shapes every question
// within the time budget.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { problemsOf } from '../lib/consistency';
import { randomInt, type RandomSource } from '../lib/random';
import { seeded } from '../lib/testRandom';
import { layerOf, loadConfig } from './config';
import { configCommand } from './configCommand';
import { QUESTION_BUDGET_MS } from './constraints';
import { EXIT } from './errors';
import type { Prompter, SelectOption } from './io';
import { resolve } from './resolve';
import { fakeIo, flagsLayer } from './testing';

/**
 * The budget for shaping one question (user decision, 2026-10-20); CI
 * machines are slower. Measured as this process's CPU time, not wall time:
 * Vitest runs test files in parallel processes, and time spent waiting for
 * a core is the scheduler's, not the wizard's.
 */
const BUDGET_MS = QUESTION_BUDGET_MS * (process.env.CI ? 3 : 1);
const cpuMs = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

const RULE_TEXTS = [
  'Must be 8-20 characters and include at least one number and one of !@#$%',
  'At least 12 characters, no spaces',
  'Passwords must be 6 to 64 characters long',
  'Letters and numbers only, 10-16 characters',
  'Must be 4-6 characters', // does not fit: the wizard asks each rule
];
const SYMBOL_POOL = '!@#$%^&*-_.,?;:+=';

class RandomPrompter implements Prompter {
  readonly errors: string[] = [];
  readonly deadEnds: string[] = [];
  readonly gaps: { message: string; ms: number }[] = [];
  private last = cpuMs();
  private edits = 0;

  constructor(
    private readonly rng: RandomSource,
    private readonly maxEdits: number,
  ) {}

  private pick<T>(items: readonly T[]): T {
    return items[randomInt(items.length, this.rng)]!;
  }

  private time(message: string) {
    this.gaps.push({ message, ms: cpuMs() - this.last });
  }
  private done<T>(v: T): T {
    this.last = cpuMs();
    return v;
  }

  async select<T>(q: { message: string; options: SelectOption<T>[] }): Promise<T> {
    this.time(q.message);
    const allowed = q.options.filter((o) => !o.disabled);
    if (!allowed.length) this.deadEnds.push(q.message);
    return this.done(this.pick(allowed).value);
  }

  async text(q: { message: string; initialValue?: string; validate?: (v: string) => string | undefined }): Promise<string> {
    if (!/^Change a line/.test(q.message)) this.time(q.message);
    const ok = (v: string) => !q.validate?.(v);
    let answer: string | undefined;
    const review = q.message.match(/^Change a line \(1-(\d+)\)/);
    const range = q.message.match(/\((\d+)-(\d+)\)$/);
    if (review) answer = this.edits++ < this.maxEdits ? String(1 + randomInt(Number(review[1]), this.rng)) : 's';
    else if (range) {
      const [lo, hi] = [Number(range[1]), Number(range[2])];
      answer = String(this.pick([lo, hi, lo + randomInt(hi - lo + 1, this.rng)]));
    } else if (/^Strength target, in bits/.test(q.message)) answer = String(randomInt(257, this.rng));
    else if (/^Paste/.test(q.message)) answer = this.pick(RULE_TEXTS);
    else if (/^Allowed symbols/.test(q.message)) {
      for (let i = 0; i < 20 && answer === undefined; i++) {
        const s = [...SYMBOL_POOL].filter(() => randomInt(3, this.rng) === 0).join('');
        if (ok(s)) answer = s;
      }
      answer ??= [q.initialValue ?? '', SYMBOL_POOL, ''].find(ok);
      if (answer === undefined) this.deadEnds.push(q.message);
    }
    if (answer === undefined || !ok(answer)) throw new Error(`The walk has no answer for "${q.message}" (${answer}: ${answer !== undefined ? q.validate?.(answer) : ''})`);
    return this.done(answer);
  }

  async secret(): Promise<string> {
    throw new Error('tep config never asks a secret');
  }
  async confirm(): Promise<boolean> {
    return this.done(randomInt(2, this.rng) === 0);
  }
  note() {}
  warn() {}
  info() {}
  error(message: string) {
    this.errors.push(message);
  }
}

describe('random walks through tep config', () => {
  it('never meet a contradiction, never reach a dead end, and save a file tep g can use', async () => {
    const slow: { message: string; ms: number }[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const cwd = mkdtempSync(join(tmpdir(), 'tep-walk-'));
      const io = fakeIo({ stdinTTY: true, cwd });
      const prompter = new RandomPrompter(seeded(seed), seed % 7);
      io.prompter = () => prompter;
      const code = await configCommand([], io);
      expect(prompter.errors, `seed ${seed}`).toEqual([]);
      expect(prompter.deadEnds, `seed ${seed}`).toEqual([]);
      expect(code, `seed ${seed}: ${io.err()}`).toBe(EXIT.ok);
      // Saved, or quit by a "no" to overwriting (only when a file exists, so never here): either way, a saved file is consistent.
      const loaded = loadConfig(join(cwd, 'tep.yml'), 'tep.yml');
      const r = resolve(layerOf(loaded), flagsLayer({}), { tty: true });
      expect(problemsOf(r.generation.req), `seed ${seed}`).toEqual([]);
      slow.push(...prompter.gaps.filter((g) => g.ms > BUDGET_MS));
    }
    expect(slow, `questions over the ${BUDGET_MS} ms budget`).toEqual([]);
  }, 300_000);
});
