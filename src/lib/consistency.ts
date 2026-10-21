// Whether a set of requirements can be used at all, and what to warn about
// when it can. One answer for every front end: a contradiction is anything
// ruleProblems finds, or, failing that, anything that stops planning
// (no sentence fits the window, too few letters to capitalise, no closing
// mark). A strength target the rules cannot reach is not a contradiction:
// the engine makes the strongest passwords the rules allow, and says so.

import { plan, planProblem, type PlanProblem, type Requirements } from './generate';
import { MAX_TARGET_BITS, ruleProblems, type RuleProblem } from './validation';

export type Problem = (RuleProblem & { source: 'rules' }) | (Omit<PlanProblem, 'code'> & { source: 'plan'; code: PlanProblem['code']; fields: (keyof Requirements)[] });

/** The fields a planning problem comes down to, for naming where the values came from. */
export const PLAN_PROBLEM_FIELDS: Record<PlanProblem['code'], (keyof Requirements)[]> = {
  'no-fit': ['minLength', 'maxLength'],
  'too-few-letters': ['minUppercase', 'minLowercase', 'maxLength', 'initials', 'shorthand', 'madeUp'],
  'no-closing': ['minSymbols', 'allowedSymbols', 'separator'],
  rules: [],
};

/** Every contradiction in these requirements; empty when passwords can be made from them. Planning is only asked once the rules agree. */
export function problemsOf(req: Requirements): Problem[] {
  const rules = ruleProblems(req);
  if (rules.length) return rules.map((p) => ({ ...p, source: 'rules' as const }));
  const p = planProblem(req);
  return p ? [{ ...p, source: 'plan', fields: PLAN_PROBLEM_FIELDS[p.code] }] : [];
}

export interface TargetWarning {
  code: 'target-unreachable';
  /** The target asked for, in bits. */
  target: number;
  /** The most the rules allow, in bits: what the passwords will have. */
  reached: number;
  message: string;
}

/** What is worth saying about requirements that have no contradiction: a target the rules cannot reach. Empty for requirements with problems. */
export function warningsOf(req: Requirements): TargetWarning[] {
  if (problemsOf(req).length) return [];
  const { plan: p } = plan(req);
  if (p.meetsTarget) return [];
  return [
    {
      code: 'target-unreachable',
      target: req.targetBits,
      reached: p.bits,
      message: `The target of ${req.targetBits} bits is out of reach: these rules allow at most ${p.bits.toFixed(1)} bits, so the strongest passwords they allow are made instead.`,
    },
  ];
}

/** The most bits any plan reaches under these rules, whatever the target: for saying which strength targets are within reach. Undefined when the requirements cannot be planned. */
export function reachableBits(req: Requirements): number | undefined {
  const open = { ...req, targetBits: MAX_TARGET_BITS, shortest: false };
  if (problemsOf(open).length) return undefined;
  return plan(open).plan.bits;
}
