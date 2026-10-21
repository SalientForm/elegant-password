// The choices a user picks from, with the words each front end shows for
// them: the web form's buttons and hints, the CLI's flags and the wizard's
// menus all read these lists, so a label or a hint changes everywhere at
// once.

import type { LengthTag } from './fluff';
import type { ShrinkStyle } from './fromSentence';
import { COMFORT_SHARE, type Comfort } from './grammar';
import { automaticSeparator, SEPARATOR_PREFERENCE, type Requirements } from './generate';
import { isFarShift, isPinkyStretch } from './keyboard';
import type { SortOrder } from './sort';
import { allowedSymbolSet, separatorProblem } from './validation';

export interface Choice<T> {
  value: T;
  label: string;
  /** A sentence about the choice, for a tooltip or a menu hint. */
  hint: string;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

export const COMFORT_CHOICES: readonly Choice<Comfort>[] = [
  { value: 'strict', label: 'Strict', hint: `Only the easiest ${percent(COMFORT_SHARE.strict)} of words. Smoothest to type, a little longer.` },
  { value: 'balanced', label: 'Balanced', hint: `Drops the ${percent(1 - COMFORT_SHARE.balanced)} of words with the most awkward reaches.` },
  { value: 'relaxed', label: 'Relaxed', hint: 'Every word. Shortest for a given strength.' },
];

export const comfortLabel = (comfort: Comfort) => COMFORT_CHOICES.find((c) => c.value === comfort)!.label;

/** The separators that are not a symbol: Auto, a space, or none. */
export const SEPARATOR_KINDS: readonly Choice<string>[] = [
  { value: 'auto', label: 'Auto', hint: `Whatever the site allows: "${SEPARATOR_PREFERENCE[0]}" if it can, else a space, else the first allowed and comfortable of "${SEPARATOR_PREFERENCE.slice(1).join(' ')}", else none` },
  { value: ' ', label: 'Space', hint: 'A space, typed with the thumb' },
  { value: '', label: 'None', hint: 'The words run together' },
];

/** True when the separator is one symbol rather than Auto, Space or None. */
export const isSymbolSeparator = (separator: string) => !SEPARATOR_KINDS.some((c) => c.value === separator);

/** Whether the tool may pick a symbol on its own under the comfort rules: the pinky rule and Shift reach. */
export const comfortableFor = (req: Pick<Requirements, 'avoidPinkyStretch' | 'shiftReach'>) => (c: string) =>
  !(req.avoidPinkyStretch && isPinkyStretch(c)) && !(req.shiftReach && isFarShift(c));

export interface SeparatorChoice extends Choice<string> {
  /** Why these rules rule the choice out (separatorProblem), or undefined when it can be used. */
  problem?: string;
}

/** Every separator these rules could take: Auto, Space, None, then each allowed keyboard symbol, each with why it cannot be used, if it cannot. */
export function separatorChoices(req: Pick<Requirements, 'allowSpaces' | 'allowedSymbols'>): SeparatorChoice[] {
  const kinds = SEPARATOR_KINDS.map((c) => ({ ...c, problem: separatorProblem(c.value, req) }));
  const symbols = allowedSymbolSet(req).map((c) => ({ value: c, label: `"${c}"`, hint: `Words are joined with "${c}"`, problem: separatorProblem(c, req) }));
  return [...kinds, ...symbols];
}

/** How a resolved separator reads in a sentence. */
export const describeSeparator = (separator: string) => (separator === ' ' ? 'a space' : separator === '' ? 'none, so the words run together' : `"${separator}"`);

export interface SeparatorNote {
  text: string;
  /** Which case: a plain symbol is the one the form adds how to undo it to ("Clear the box for Auto."). */
  kind: 'auto' | 'space' | 'none' | 'stretch' | 'far' | 'symbol';
}

/** What the chosen separator means under these rules: the form's hint under the separator, and the wizard's. */
export function separatorNote(req: Requirements): SeparatorNote {
  const symbol = isSymbolSeparator(req.separator);
  if (req.separator === 'auto') {
    const others = SEPARATOR_PREFERENCE.slice(1)
      .filter(comfortableFor(req))
      .map((c) => `"${c}"`)
      .join(' ');
    const text = `Auto: ${describeSeparator(automaticSeparator(req))} under these rules. It is "${SEPARATOR_PREFERENCE[0]}" whenever the site allows it (home row, no Shift, and it counts as a symbol), else a space, else the first allowed of ${others}, else none.`;
    return { text, kind: 'auto' };
  }
  if (req.separator === ' ') return { text: 'A space: typed with the thumb.', kind: 'space' };
  if (req.separator === '') return { text: 'None: the words run together.', kind: 'none' };
  if (symbol && req.avoidPinkyStretch && isPinkyStretch(req.separator)) return { text: `"${req.separator}" is a pinky stretch; kept because you chose it.`, kind: 'stretch' };
  if (symbol && req.shiftReach && isFarShift(req.separator)) return { text: `"${req.separator}" needs a Shift key out of one hand's reach; kept because you chose it.`, kind: 'far' };
  return { text: `Words are joined with "${req.separator}".`, kind: 'symbol' };
}

/** The "must contain" counts, in form order: kept with the rules that check them. */
export { MUST_CONTAIN } from './validation';

/** The orders suggestions can be shown in, with the toggle's words. */
export const SORT_CHOICES: readonly Choice<SortOrder>[] = [
  { value: 'memorability', label: 'Memorability', hint: 'Most memorable first' },
  { value: 'difficulty', label: 'Difficulty', hint: 'Easiest to type first' },
  { value: 'strength', label: 'Strength', hint: 'Strongest first' },
];

/** How "Use my sentence" shrinks long words. */
export const SHRINK_CHOICES: readonly Choice<ShrinkStyle>[] = [
  { value: 'none', label: 'Keep', hint: 'Words stay whole unless the target length needs them shorter.' },
  { value: 'vowels', label: 'Drop vowels', hint: 'sweets → swts, jupiter → jptr' },
  { value: 'ends', label: 'First + last', hint: 'Two letters, first and last consonant: jupiter → jr, piece → pc' },
];

/** The tag that ends padding in "Use my sentence". */
export const LENGTH_TAG_CHOICES: readonly Choice<LengthTag>[] = [
  { value: 'total', label: '%total: the whole length (%50 = 50 characters in all)', hint: 'The tag says the whole length.' },
  { value: 'factor', label: '@factor: a number that divides the length before it (@3)', hint: 'The tag gives a number that divides the length before it.' },
  { value: 'none', label: 'None', hint: 'Padding goes untagged.' },
];
