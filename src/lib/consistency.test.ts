import { describe, expect, it } from 'vitest';
import { PLAN_PROBLEM_FIELDS, problemsOf, reachableBits, warningsOf } from './consistency';
import { DEFAULT_REQUIREMENTS, plan, planProblem, RequirementsError, type Requirements } from './generate';
import { ruleProblems } from './validation';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

/** One example of each planning problem, found with the rules themselves in agreement. */
const PLAN_CASES: Record<'no-fit' | 'too-few-letters' | 'no-closing', Partial<Requirements>> = {
  'no-fit': { minLength: 4, maxLength: 6, minUppercase: 0, minDigits: 0, minSymbols: 0 },
  'too-few-letters': { minUppercase: 8, maxLength: 12, initials: 3, shorthand: 3, madeUp: 3 },
  'no-closing': { allowedSymbols: ';', separator: ';', minSymbols: 8, maxLength: 20 },
};

describe('problemsOf', () => {
  it('finds nothing in the defaults or any mode-free preset of them', () => {
    expect(problemsOf(DEFAULT_REQUIREMENTS)).toEqual([]);
  });

  it('reports every rule problem, tagged as the rules, before planning is tried', () => {
    const r = req({ minLength: 40, maxLength: 32, minSymbols: 1, allowedSymbols: '' });
    const problems = problemsOf(r);
    expect(problems.map((p) => p.code)).toEqual(ruleProblems(r).map((p) => p.code));
    expect(problems.every((p) => p.source === 'rules')).toBe(true);
    expect(problems.map((p) => p.code)).toEqual(['min-above-max', 'symbols-none-allowed']);
  });

  for (const [code, over] of Object.entries(PLAN_CASES)) {
    it(`reports a planning problem (${code}) once the rules agree, naming the fields it comes down to`, () => {
      const r = req(over);
      expect(ruleProblems(r)).toEqual([]);
      const problems = problemsOf(r);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({ source: 'plan', code, fields: PLAN_PROBLEM_FIELDS[code as keyof typeof PLAN_CASES] });
      // The same message plan() throws: the early exit changes the speed, not the answer.
      expect(() => plan(r)).toThrow(new RequirementsError(problems[0]!.message));
    });
  }

  it('agrees with plan() on whether requirements can be planned, across a sweep of length windows and shapes', () => {
    for (let max = 4; max <= 40; max += 3) {
      for (const madeUp of [0, 3]) {
        for (const minUppercase of [0, 1, 4]) {
          const r = req({ minLength: Math.min(8, max), maxLength: max, madeUp, minUppercase, minSymbols: 0, minDigits: 0 });
          let throws: string | undefined;
          try {
            plan(r);
          } catch (e) {
            throws = (e as Error).message;
          }
          expect(planProblem(r)?.message, JSON.stringify({ max, madeUp, minUppercase })).toBe(throws);
        }
      }
    }
  });
});

describe('warningsOf', () => {
  it('says nothing when the target is within reach', () => {
    expect(warningsOf(DEFAULT_REQUIREMENTS)).toEqual([]);
  });

  it('warns when the rules cannot reach the target, with the bits they do reach, and is not a problem', () => {
    const r = req({ minLength: 8, maxLength: 16, allowedSymbols: '!@#$%&*', allowSpaces: false, targetBits: 50 });
    expect(problemsOf(r)).toEqual([]);
    const [w] = warningsOf(r);
    expect(w).toMatchObject({ code: 'target-unreachable', target: 50 });
    expect(w!.reached).toBeCloseTo(plan(r).plan.bits, 9);
    expect(w!.reached).toBeLessThan(50);
    expect(w!.message).toBe(`The target of 50 bits is out of reach: these rules allow at most ${w!.reached.toFixed(1)} bits, so the strongest passwords they allow are made instead.`);
  });

  it('says nothing about requirements that have problems: those are reported, not warned about', () => {
    expect(warningsOf(req({ minLength: 40, maxLength: 32 }))).toEqual([]);
  });
});

describe('reachableBits', () => {
  it('is the bits of the strongest plan, whatever the target or Shortest', () => {
    const r = req({ targetBits: 4, shortest: true });
    const bits = reachableBits(r)!;
    expect(bits).toBeCloseTo(plan({ ...r, targetBits: 256, shortest: false }).plan.bits, 9);
    expect(bits).toBeGreaterThan(40);
  });

  it('decides which strength targets warn: at or below it none, above it one', () => {
    const r = req({ minLength: 8, maxLength: 16 });
    const bits = reachableBits(r)!;
    expect(warningsOf({ ...r, targetBits: Math.floor(bits) })).toEqual([]);
    expect(warningsOf({ ...r, targetBits: Math.ceil(bits) + 1 })).toHaveLength(1);
  });

  it('is undefined when the requirements cannot be planned', () => {
    expect(reachableBits(req(PLAN_CASES['no-fit']))).toBeUndefined();
  });
});
