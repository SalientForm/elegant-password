// Random walks through tep config (spec §9): whatever allowed choice or
// in-range value is picked at every question, review edits included, the
// wizard never meets a contradiction, never reaches a question with no
// allowed answer, saves a file tep g can use, and keeps every question within
// the work it may cost. pnpm measure:wizard times the same walks against the
// budget.

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { problemsOf } from '../lib/consistency';
import { randomInt, type RandomSource } from '../lib/random';
import { seeded } from '../lib/testRandom';
import { layerOf, loadConfig } from './config';
import { configCommand } from './configCommand';
import { QUESTION_BUDGET_MS, QUESTION_FAIL_MS } from './constraints';
import { EXIT } from './errors';
import type { Prompter, SelectOption } from './io';
import { resolve } from './resolve';
import { fakeIo, flagsLayer, scratch } from './testing';

/** The work done since the last answer: plannings the CLI asked for, length models built. */
const work = vi.hoisted(() => ({ plannings: 0, models: 0 }));

vi.mock('../lib/consistency', async (importOriginal) => {
  const m = await importOriginal<typeof import('../lib/consistency')>();
  return {
    ...m,
    problemsOf: (...args: Parameters<typeof m.problemsOf>) => {
      work.plannings++;
      return m.problemsOf(...args);
    },
  };
});

vi.mock('../lib/lengthModel', async (importOriginal) => {
  const m = await importOriginal<typeof import('../lib/lengthModel')>();
  class CountedLengthModel extends m.LengthModel {
    constructor(...args: ConstructorParameters<typeof m.LengthModel>) {
      super(...args);
      work.models++;
    }
  }
  return { ...m, LengthModel: CountedLengthModel };
});

/**
 * The budget expressed as work: what one question may cost, from one answer
 * to the next question. About twice the worst measured (183 plannings, 181
 * length models, 2026-10-21), and well inside the planning cache's limit
 * (MODEL_CACHE_LIMIT in src/lib/generate.ts), so one question never pushes
 * out the models the next relies on. Counts, not a clock, so a coverage run
 * or a busy machine cannot fail it; pnpm measure:wizard takes the time.
 */
const MAX_PLANNINGS_PER_QUESTION = 400;
const MAX_MODELS_PER_QUESTION = 400;

interface Gap {
  message: string;
  plannings: number;
  models: number;
  /** Wall time, in milliseconds. */
  ms: number;
}

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
  readonly gaps: Gap[] = [];
  /** Review lines wider than the box: the review wraps its own lines, so none should be. */
  readonly overflows: string[] = [];
  /** A box from a phone-narrow terminal to a wide one. */
  readonly noteWidth: number;
  private last = performance.now();
  private edits = 0;

  constructor(
    private readonly rng: RandomSource,
    private readonly maxEdits: number,
  ) {
    this.noteWidth = 24 + randomInt(100, rng);
    work.plannings = 0;
    work.models = 0;
  }

  private pick<T>(items: readonly T[]): T {
    return items[randomInt(items.length, this.rng)]!;
  }

  private time(message: string) {
    this.gaps.push({ message, plannings: work.plannings, models: work.models, ms: performance.now() - this.last });
  }
  private done<T>(v: T): T {
    work.plannings = 0;
    work.models = 0;
    this.last = performance.now();
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
  note(message: string) {
    this.overflows.push(...message.split('\n').filter((l) => l.length > this.noteWidth));
  }
  warn() {}
  info() {}
  error(message: string) {
    this.errors.push(message);
  }
}

/** The 40 seeded walks, with their correctness assertions; every question's work and wall time. */
async function walkAll(): Promise<Gap[]> {
  const gaps: Gap[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const cwd = scratch('tep-walk-');
    const io = fakeIo({ stdinTTY: true, cwd });
    const prompter = new RandomPrompter(seeded(seed), seed % 7);
    io.prompter = () => prompter;
    const code = await configCommand([], io);
    expect(prompter.errors, `seed ${seed}`).toEqual([]);
    expect(prompter.deadEnds, `seed ${seed}`).toEqual([]);
    expect(prompter.overflows, `seed ${seed}: review lines wider than ${prompter.noteWidth}`).toEqual([]);
    expect(code, `seed ${seed}: ${io.err()}`).toBe(EXIT.ok);
    // Saved, or quit by a "no" to overwriting (only when a file exists, so never here): either way, a saved file is consistent.
    const loaded = loadConfig(join(cwd, 'tep.yml'), 'tep.yml');
    const r = resolve(layerOf(loaded), flagsLayer({}), { tty: true });
    expect(problemsOf(r.generation.req), `seed ${seed}`).toEqual([]);
    gaps.push(...prompter.gaps.map((g) => ({ ...g, message: `seed ${seed}: ${g.message}` })));
  }
  return gaps;
}

const most = (gaps: Gap[], key: 'plannings' | 'models') => Math.max(...gaps.map((g) => g[key]));

describe('random walks through tep config', () => {
  it('never meet a contradiction, never reach a dead end, fit the review to the box, save a file tep g can use, and keep each question within its work', async () => {
    const gaps = await walkAll();
    expect(gaps.filter((g) => g.plannings > MAX_PLANNINGS_PER_QUESTION), `questions over ${MAX_PLANNINGS_PER_QUESTION} plannings`).toEqual([]);
    expect(gaps.filter((g) => g.models > MAX_MODELS_PER_QUESTION), `questions over ${MAX_MODELS_PER_QUESTION} length models`).toEqual([]);
    // The counters count: planning still goes through problemsOf, models through LengthModel.
    expect(most(gaps, 'plannings')).toBeGreaterThan(0);
    expect(most(gaps, 'models')).toBeGreaterThan(0);
  }, 300_000);

  it.skipIf(!process.env.MEASURE_WIZARD)('times every question against the budget (pnpm measure:wizard)', async () => {
    const gaps = await walkAll();
    const slowest = [...gaps].sort((a, b) => b.ms - a.ms);
    const row = (g: Gap) => `${g.ms.toFixed(0).padStart(6)} ms (target ${QUESTION_BUDGET_MS})  ${String(g.plannings).padStart(4)} plannings  ${String(g.models).padStart(4)} models  ${g.message}`;
    const over = slowest.filter((g) => g.ms > QUESTION_BUDGET_MS);
    console.log(
      [
        `${gaps.length} questions in 40 walks, wall time; the target is ${QUESTION_BUDGET_MS} ms a question, a failure over ${QUESTION_FAIL_MS} ms`,
        `most work in one question: ${most(gaps, 'plannings')} plannings, ${most(gaps, 'models')} length models`,
        'the five slowest:',
        ...slowest.slice(0, 5).map(row),
        over.length ? `over the ${QUESTION_BUDGET_MS} ms target (not a failure below ${QUESTION_FAIL_MS} ms):` : `none over the ${QUESTION_BUDGET_MS} ms target`,
        ...over.map(row),
      ].join('\n'),
    );
    expect(slowest.filter((g) => g.ms > QUESTION_FAIL_MS).map(row), `questions over ${QUESTION_FAIL_MS} ms`).toEqual([]);
  }, 300_000);
});
