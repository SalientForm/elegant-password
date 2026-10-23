// Every contradiction and warning, worded for the command line: what is
// wrong, the values involved and where each came from, and how to fix it,
// with the flag or key to change and, where the engine can tell, the value
// that would work ("raise the maximum length to 14 or more"). The facts
// come from the shared core (problemsOf, warningsOf); only the words are
// the CLI's.

import type { Problem, TargetWarning } from '../lib/consistency';
import { problemsOf } from '../lib/consistency';
import { plan, type Requirements } from '../lib/generate';
import { capitalise, plural } from '../lib/text';
import { allowedSymbolSet, MAX_LENGTH, MIN_LENGTH } from '../lib/validation';
import { describeValue, reqField, type CliField } from './fields';
import { describeSource, howToChange, type Source } from './sources';

export interface Explained {
  /** What is wrong, in one sentence. */
  title: string;
  /** Each value involved and where it came from. */
  values: string[];
  /** How to fix it. */
  fix: string;
}

/** How a message refers to settings: where a value came from, and how to change it. */
export interface Refer {
  source(f: CliField): Source;
}

const ok = (req: Requirements) => problemsOf(req).length === 0;
const valueIn = (req: Requirements, f: CliField) => (f.target.kind === 'req' ? req[f.target.key] : undefined);

/** The smallest maximum length above the current one at which the requirements work, holding the rest; undefined when none does. */
export function smallestWorkingMax(req: Requirements): number | undefined {
  let lo = req.maxLength + 1;
  let hi = MAX_LENGTH;
  if (lo > hi || !ok({ ...req, maxLength: hi })) return undefined;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ok({ ...req, maxLength: mid })) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The largest minimum length below the current one at which the requirements work; undefined when none does. */
export function largestWorkingMin(req: Requirements): number | undefined {
  let lo = MIN_LENGTH;
  let hi = req.minLength - 1;
  if (hi < lo || !ok({ ...req, minLength: lo })) return undefined;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ok({ ...req, minLength: mid })) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The largest value below the current one of a count field at which the requirements work; undefined when none does. */
export function largestWorkingCount(req: Requirements, key: 'minUppercase' | 'minLowercase' | 'minDigits' | 'minSymbols' | 'initials' | 'shorthand' | 'madeUp'): number | undefined {
  for (let n = req[key] - 1; n >= 0; n--) if (ok({ ...req, [key]: n })) return n;
  return undefined;
}

/** The smallest maximum length at which the strength target is reached, holding the rest; undefined when none reaches it. */
export function smallestMaxForTarget(req: Requirements): number | undefined {
  const reaches = (maxLength: number) => ok({ ...req, maxLength }) && plan({ ...req, maxLength }).plan.meetsTarget;
  let lo = Math.max(req.minLength, req.maxLength + 1);
  let hi = MAX_LENGTH;
  if (lo > hi || !reaches(hi)) return undefined;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (reaches(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function valueLine(req: Requirements, f: CliField, refer: Refer): string {
  return `${f.label}: ${describeValue(f, valueIn(req, f))} (from ${describeSource(refer.source(f))})`;
}

const list = (items: string[], last = 'or') => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`);

/** A contradiction in full. */
export function explainProblem(problem: Problem, req: Requirements, refer: Refer): Explained {
  const F = (key: keyof Requirements) => reqField(key)!;
  const change = (key: keyof Requirements) => howToChange(F(key), refer.source(F(key)));
  const values = (...keys: (keyof Requirements)[]) => keys.filter((k) => reqField(k)).map((k) => valueLine(req, F(k), refer));
  const counts = (['minUppercase', 'minLowercase', 'minDigits', 'minSymbols'] as const).filter((k) => req[k] > 0);

  switch (problem.code) {
    case 'min-above-max': {
      // Each way out is checked with the engine before it is offered: a minimum lowered to a maximum no sentence fits is no way out.
      const lowerTo = ok({ ...req, minLength: req.maxLength }) ? req.maxLength : largestWorkingMin({ ...req, minLength: req.maxLength });
      const raiseTo = ok({ ...req, maxLength: req.minLength }) ? req.minLength : smallestWorkingMax({ ...req, maxLength: req.minLength });
      const ways = [
        ...(lowerTo !== undefined ? [`lower the minimum length to ${lowerTo} or less (${change('minLength')})`] : []),
        ...(raiseTo !== undefined ? [`raise the maximum length to ${raiseTo} or more (${change('maxLength')})`] : []),
      ];
      return {
        title: `The minimum length (${req.minLength}) is above the maximum length (${req.maxLength}).`,
        values: values('minLength', 'maxLength'),
        fix: ways.length ? `${capitalise(ways.length === 2 ? `${ways[0]}, or ${ways[1]}` : list(ways))}.` : `Widen the length range (${change('minLength')}, ${change('maxLength')}).`,
      };
    }
    case 'counts-exceed-max': {
      const sum = counts.reduce((n, k) => n + req[k], 0);
      return {
        title: `${list(counts.map((k) => plural(req[k], F(k).label.replace(/^required /, '').replace(/s$/, ''))), 'and')} need at least ${sum} characters, more than the maximum length of ${req.maxLength}.`,
        values: values('maxLength', ...counts),
        fix: `Raise the maximum length to ${sum} or more (${change('maxLength')}), or require fewer: ${list(counts.map((k) => `${F(k).label} (${change(k)})`))}.`,
      };
    }
    case 'symbols-none-allowed':
      return {
        title: `${req.minSymbols === 1 ? 'A symbol is' : `${req.minSymbols} symbols are`} required, but no symbols are allowed${req.allowedSymbols ? ` (none of "${req.allowedSymbols}" is a keyboard symbol)` : ''}.`,
        values: values('minSymbols', 'allowedSymbols'),
        fix: `List the symbols the site accepts (${change('allowedSymbols')}), such as "!@#$%", or require none (set ${change('minSymbols')} to 0).`,
      };
    case 'separator-not-allowed': {
      const allowed = allowedSymbolSet(req);
      const title =
        req.separator === ' '
          ? 'The separator is a space, but spaces are not allowed.'
          : `The separator is "${req.separator}", which is not one of the allowed symbols (${allowed.length ? `"${allowed.join('')}"` : 'none are allowed'}).`;
      const allow = req.separator === ' ' ? `allow spaces (${change('allowSpaces')})` : `allow "${req.separator}" (${change('allowedSymbols')})`;
      return {
        title,
        values: values('separator', req.separator === ' ' ? 'allowSpaces' : 'allowedSymbols'),
        fix: `Set the separator to auto, which always picks one the rules allow (${change('separator')}), or ${allow}.`,
      };
    }
    case 'separator-invalid':
      return {
        title: problem.message,
        values: values('separator'),
        fix: `Set the separator to auto, space, none or one keyboard symbol (${change('separator')}).`,
      };
    case 'no-fit': {
      // The required characters take room too: they are named when they are part of the squeeze, with a way to require fewer.
      const max = smallestWorkingMax(req);
      const min = largestWorkingMin(req);
      const fewer = counts.flatMap((k) => {
        const n = largestWorkingCount(req, k);
        return n !== undefined ? [`require at most ${plural(n, F(k).label.replace(/^required /, '').replace(/s$/, ''))} (${change(k)})`] : [];
      });
      const ways = [
        ...(max !== undefined ? [`raise the maximum length to ${max} or more (${change('maxLength')})`] : []),
        ...(min !== undefined ? [`lower the minimum length to ${min} or less (${change('minLength')})`] : []),
        ...fewer,
      ];
      const withCounts = counts.length ? ` with ${list(counts.map((k) => plural(req[k], F(k).label.replace(/^required /, '').replace(/s$/, ''))), 'and')}` : '';
      return {
        title: `No made-up sentence fits between ${req.minLength} and ${req.maxLength} characters${withCounts}.`,
        values: values('minLength', 'maxLength', ...counts),
        fix: `${ways.length ? `${capitalise(list(ways))}. ` : 'Widen the length range. '}Or use your own sentence with --sentence -, which can be shortened further.`,
      };
    }
    case 'too-few-letters': {
      const max = smallestWorkingMax(req);
      const upper = largestWorkingCount(req, 'minUppercase');
      const lowerCount = req.minLowercase > 0 ? largestWorkingCount(req, 'minLowercase') : undefined;
      const shapes = (['initials', 'shorthand', 'madeUp'] as const).filter((k) => req[k] > 0);
      const ways = [
        ...(max !== undefined ? [`raise the maximum length to ${max} or more (${change('maxLength')})`] : []),
        ...(upper !== undefined ? [`require at most ${plural(upper, 'uppercase letter')} (${change('minUppercase')})`] : []),
        ...(lowerCount !== undefined ? [`require at most ${plural(lowerCount, 'lowercase letter')} (${change('minLowercase')})`] : []),
        ...shapes.map((k) => `use fewer ${F(k).label} (${change(k)})`),
      ];
      return {
        title:
          req.minLowercase > 0
            ? `No made-up sentence between ${req.minLength} and ${req.maxLength} characters has ${plural(req.minUppercase + req.minLowercase, 'letter')} for ${plural(req.minUppercase, 'capital')} and ${plural(req.minLowercase, 'lowercase letter')}.`
            : `No made-up sentence between ${req.minLength} and ${req.maxLength} characters has ${plural(req.minUppercase, 'letter')} to capitalise.`,
        values: values('minUppercase', ...(req.minLowercase > 0 ? (['minLowercase'] as const) : []), 'maxLength', ...shapes),
        fix: `${capitalise(list(ways))}.`,
      };
    }
    case 'no-closing': {
      const fewer = largestWorkingCount(req, 'minSymbols');
      return {
        title: `${req.minSymbols === 1 ? 'A symbol is' : `${req.minSymbols} symbols are`} required, but the only allowed symbol is the separator "${req.separator === 'auto' ? allowedSymbolSet(req)[0] : req.separator}", and a password cannot end with its separator, so there is nothing to close it with.`,
        values: values('minSymbols', 'allowedSymbols', 'separator'),
        fix: `Allow another symbol (${change('allowedSymbols')}), choose another separator (${change('separator')})${fewer !== undefined ? `, or require at most ${plural(fewer, 'symbol')} (${change('minSymbols')})` : ''}.`,
      };
    }
    case 'range':
    case 'rules':
    default: {
      const f = problem.fields.map((k) => reqField(k)).filter((x): x is CliField => !!x);
      return {
        title: problem.message,
        values: f.map((x) => valueLine(req, x, refer)),
        fix: f.length ? `Change ${list(f.map((x) => howToChange(x, refer.source(x))))}.` : 'Change the settings named above.',
      };
    }
  }
}

/** The unreachable-target warning in full. A maximum the site's own rules set (a preset, or the pasted wording) is not offered for raising: a longer password would be refused. */
export function explainWarning(w: TargetWarning, req: Requirements, refer: Refer): Explained {
  const strength = reqField('targetBits')!;
  const maxLength = reqField('maxLength')!;
  const maxSource = refer.source(maxLength);
  const sitesRule = maxSource.kind === 'site' || maxSource.kind === 'rules-text';
  const reach = sitesRule ? undefined : smallestMaxForTarget(req);
  const lower = `lower the target (${howToChange(strength, refer.source(strength))})`;
  return {
    title: `The strength target, ${describeValue(strength, w.target)}, is out of reach: these rules allow at most ${w.reached.toFixed(1)} bits, so tep makes the strongest passwords they allow.`,
    values: [valueLine(req, strength, refer), valueLine(req, maxLength, refer)],
    fix: reach !== undefined
      ? `A maximum length of ${reach} would reach it (${howToChange(maxLength, maxSource)}), or ${lower}.`
      : sitesRule
        ? `${capitalise(lower)}; the maximum length of ${req.maxLength} is the site's own rule, so a longer password would be refused.`
        : `${capitalise(lower)}.`,
  };
}

/** Lines for printing: the title, then each value and the fix, indented. */
export function renderExplained(e: Explained, indent = '  '): string[] {
  return [e.title, ...e.values.map((v) => `${indent}${v}`), `${indent}Fix: ${e.fix}`];
}
