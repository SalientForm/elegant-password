// What a password's "Why?" says, as plain sentences: the web card renders
// them (with its keyboard map and tables around them), and `tep g
// --explain` prints them, so the two always explain a password the same
// way. Everything here is read from the suggestion, its cold score and the
// separator, like the card always did.

import { describeRemoved, easeOf, type Ease } from './ease';
import type { Suggestion } from './generate';
import { isPinkyStretch, type TypingProfile } from './keyboard';
import { scoreCold, type ScoredWord } from './score';
import { MAPPING_KIND_LABELS, type AppliedTwist } from './twists';

export const ROW_NAMES = ['number row', 'top row', 'home row', 'bottom row', 'space bar'];

/** Why Shift is pressed: the capitals, then any shifted symbols. */
export function shiftReasons(password: string, minUppercase: number, initials: number): string {
  const reasons = initials
    ? [`${initials} capital initial${initials > 1 ? 's' : ''}`]
    : minUppercase === 1
      ? ['the opening capital']
      : minUppercase > 1
        ? ['held once for the word in capitals']
        : [];
  const shiftedSymbols = [...new Set(password.match(/[!@#$%^&*()_+{}|:"<>?~]/g) ?? [])];
  if (shiftedSymbols.length) reasons.push(shiftedSymbols.map((c) => `"${c}"`).join(' '));
  return reasons.join(' and ');
}

/** What the separator does for typing. */
export function separatorPhrase(sep: string): string {
  if (sep === ' ') return 'Spaces between words go to your thumb, so your fingers never leave the letters.';
  if (sep === '') return 'Words run together with no separator keys at all.';
  const stretch = isPinkyStretch(sep) ? ' It is a pinky stretch, kept because you chose it.' : '';
  return `Words are joined with "${sep}", the same key every time, so it becomes a rhythm.${stretch}`;
}

/** Words typed as one capital letter. */
export const capitalInitials = (words: Suggestion['words']) => words.filter((w) => /^[A-Z]$/.test(w.text));

/** The "Fast to type" lines, in the card's order. */
export function typingLines(s: Pick<Suggestion, 'password' | 'words'> & { typing: TypingProfile }, context: { minUppercase: number; separator: string }): string[] {
  const { typing, password } = s;
  const letterRows = typing.rowsUsed.filter((r) => r > 0 && r < 4);
  return [
    typing.shiftPresses === 0
      ? 'All lowercase: no Shift key at all.'
      : `${typing.shiftPresses} Shift press${typing.shiftPresses > 1 ? 'es' : ''} (${shiftReasons(password, context.minUppercase, capitalInitials(s.words).length)}).${typing.caseChanges <= 1 ? ' Case never alternates.' : ` Capital initials flip the case ${typing.caseChanges} times.`}`,
    `${Math.round(typing.sameRowShare * 100)}% of letter-to-letter moves stay on the same keyboard row.`,
    `Average reach is ${typing.averageDistance.toFixed(1)} key widths, with ${typing.sameFingerPairs} same-finger${typing.sameFingerPairs === 1 ? ' pair' : ' pairs'}.`,
    `Letters come from the ${letterRows.map((r) => ROW_NAMES[r]).join(', ')}${typing.rowsUsed.includes(0) ? ', plus short trips to the number row' : ''}.`,
    separatorPhrase(context.separator),
  ];
}

/** Hint words that were shortened or dropped. A deliberately swapped word is whole as typed ("cool" as "cul"). */
export const changedWordsOf = (words: readonly ScoredWord[]) => words.filter((w) => w.form === 'dropped' || [...w.text].length < [...(w.form === 'eased' ? w.base : w.word)].length);

/** The deliberate swaps in a password, read from its cold score. */
export const easedOf = (words: readonly ScoredWord[]): Ease[] =>
  words.flatMap((w) => {
    const e = w.form === 'eased' ? easeOf(w.word) : undefined;
    return e ? [e] : [];
  });

/** The deliberate swaps in a password, read from the password and its hint. */
export const easedIn = (password: string, hint: string): Ease[] => easedOf(scoreCold(password, hint).words);

/** A deliberate swap as a sentence: "i → y in "wise" (wyse) removes the same-finger jump e-d". */
export const easedLine = (e: Ease) => `${e.rule.from} → ${e.rule.to} in "${e.word}" (${e.text}) removes ${describeRemoved(e)} (deliberate swap)`;

/** A swap's kind as the card names it: "symbol swap", "number swap", "misspelling"... */
export const twistKind = (t: AppliedTwist) => MAPPING_KIND_LABELS[t.mapping.kind].toLowerCase().replace(/s$/, '');

/** A random swap as a sentence: "a → @ in "cat" (symbol swap)". */
export const twistLine = (t: AppliedTwist) => `${t.mapping.from} → ${t.mapping.to || '–'} in "${t.before}" (${twistKind(t)})`;

/** Where the random swaps landed, when that adds strength. */
export const twistOptionsLine = (s: Pick<Suggestion, 'twistOptions' | 'twistBits'>) =>
  s.twistOptions > 1
    ? `Remember the sentence first, then the swaps. Where they landed was one of ${s.twistOptions.toLocaleString('en')} possibilities, which adds ${s.twistBits.toFixed(1)} bits.`
    : undefined;
