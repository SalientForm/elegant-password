// Builds the "Fun" page prompt: a complete spec of this app that another
// developer or model could rebuild it from. It is assembled from the live
// constants, so it always matches the code.

import { RUBRIC, SECONDS, LEVELS } from './difficulty';
import { DEFAULT_SENTENCE_OPTIONS, SMALL_WORDS } from './fromSentence';
import {
  ATTACK_SCENARIOS,
  DEFAULT_REQUIREMENTS,
  END_PREFERENCE,
  MAX_DIGITS,
  MAX_INITIALS,
  MAX_SHORTHAND,
  MAX_MADE_UP,
  MAX_SYMBOLS,
  MAX_TWISTS,
  MAX_UPPERCASE,
  SEPARATOR_PREFERENCE,
  STRENGTH_PRESETS,
} from './generate';
import {
  CLAUSES,
  COMFORT_SHARE,
  INITIAL_PRIORITY,
  KEY_ROLLS,
  MADE_UP_NOUNS,
  MIN_POOL,
  SHORTHAND_PRIORITY,
  SLOT_LABELS,
  SMALL_SLOTS,
} from './grammar';
import { COST, PINKY_REACH } from './keyboard';
import { STORAGE_KEY } from './mappingStore';
import { SELECTED_KEY } from './selectedStore';
import { SESSION_KEY } from './sessionStore';
import { MODE_KEY, REQUIREMENTS_KEY, SENTENCE_OPTIONS_KEY } from './settingsStore';
import { BUILT_IN_MAPPINGS, MAPPING_KIND_LABELS, type MappingKind } from './twists';
import { ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS } from './words';

const code = (s: string) => `\`${s}\``;
const list = (items: readonly string[]) => items.map((i) => `- ${i}`).join('\n');

function mappingSection(): string {
  return (['symbol', 'digit', 'spelling'] as MappingKind[])
    .map((kind) => {
      const items = BUILT_IN_MAPPINGS.filter((m) => m.kind === kind).map((m) => code(`${m.from}→${m.to}`));
      return `**${MAPPING_KIND_LABELS[kind]} (${items.length})**: ${items.join(' ')}`;
    })
    .join('\n\n');
}

function rubricTable(): string {
  const head = `| Criterion | Measures | Weight | ${LEVELS.slice(1).map((l) => `${l} from`).join(' | ')} |`;
  const rule = `|${' --- |'.repeat(3 + LEVELS.length - 1)}`;
  const rows = RUBRIC.map(
    (c) => `| ${c.name} | ${c.measures} | ${c.weight} | ${c.cutPoints.map((v) => c.format(v)).join(' | ')} |`,
  );
  return [head, rule, ...rows].join('\n');
}

function requirementsTable(): string {
  const d = DEFAULT_REQUIREMENTS;
  const rows: [string, string, string][] = [
    ['minLength / maxLength', `${d.minLength} / ${d.maxLength}`, 'Whole numbers, min ≥ 1, max ≥ min'],
    ['minUppercase', String(d.minUppercase), `0-${MAX_UPPERCASE}, "at least N"`],
    ['minDigits', String(d.minDigits), `0-${MAX_DIGITS}, "at least N"`],
    ['minSymbols', String(d.minSymbols), `0-${MAX_SYMBOLS}, "at least N"`],
    ['allowedSymbols', code(d.allowedSymbols), 'Symbols the site accepts'],
    ['allowSpaces', String(d.allowSpaces), 'Whether the site accepts spaces'],
    ['separator', code(d.separator), `auto, space, ${[';', '.', '-', ',', '_'].map(code).join(', ')}, or none (a symbol between words is optional)`],
    ['includeNumber', String(d.includeNumber), 'Include a number even when digits are not required'],
    ['targetBits', String(d.targetBits), `Presets: ${STRENGTH_PRESETS.map((p) => `${p.label} ${p.bits}`).join(', ')}; or custom`],
    ['comfort', d.comfort, `strict / balanced / relaxed (keeps ${Object.values(COMFORT_SHARE).map((s) => `${s * 100}%`).join(' / ')} of each word pool)`],
    ['twists ("Minimum swaps")', String(d.twists), `0-${MAX_TWISTS} random swaps or misspellings per password, applied whenever the letters allow`],
    ['initials', String(d.initials), `0-${MAX_INITIALS} words typed as one capital letter`],
    ['shorthand', String(d.shorthand), `0-${MAX_SHORTHAND} words typed as first letter + last consonant`],
    ['madeUp', String(d.madeUp), `0-${MAX_MADE_UP} nouns replaced by made-up words of at most two key rolls`],
    ['glue', String(d.glue), 'Attach numbers and small-word initials to the next word'],
    ['avoidPinkyStretch', String(d.avoidPinkyStretch), 'Toggle; on by default'],
    ['count', String(d.count), '1-20 suggestions'],
  ];
  return ['| Option | Default | Range / meaning |', '| --- | --- | --- |', ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

export function buildSpecPrompt(): string {
  const pools = [
    ['adjectives', ADJECTIVES.length],
    ['plural nouns', NOUNS.length],
    ['transitive verbs (plural present)', VERBS.length],
    ['adverbs (before the verb)', ADVERBS.length],
    ['endings (time/place)', ENDINGS.length],
    ['prepositions', PREPOSITIONS.length],
  ] as const;

  return `# Build "Elegant Passwords"

You are building a password generator web app called **Elegant Passwords**. It creates passwords that are **hard to guess, easy to remember and fast to type**. Implement everything below exactly. Where a number is given, use it.

## 1. Principles

- **Memorable**: passwords read as a grammatical sentence, or come from a sentence the user typed.
- **Fast to type**: prefer keys close together, finger rolls along one row (like ${code('asdf')}) and close-together digits (${code('357')} beats ${code('129')}); avoid long reaches, row jumps, one finger moving between rows, Shift and pinky stretches. Never alternate case inside a word; made-up words are all lowercase or ALL CAPS.
- **Honest strength**: report entropy assuming the attacker knows this app, its word lists and every rule. Only random choices count. Fixed rules (capitalisation, separators, closing marks) count as zero.
- **Private**: everything runs in the browser. No network calls. Randomness comes only from ${code('crypto.getRandomValues')}, with rejection sampling for uniform integers.
- **Explained**: every password comes with a plain-language explanation of why it is memorable, fast and strong, and how it meets each rule.

## 2. Stack and structure

- TypeScript, React + Vite, Vitest. Node 24, pnpm. Static client-only app.
- Dev server on 127.0.0.1:4270, preview on 4271.
- Pure logic lives in ${code('src/lib/')} (no React); UI in ${code('src/components/')}; one provider in ${code('src/state/')}; the worker entry in ${code('src/worker.ts')}; the build-time CSP plugin in ${code('build/csp.ts')}.
- Modules: ${['random', 'keyboard', 'words', 'grammar', 'lengthModel', 'twists', 'mappingStore', 'generate', 'fromSentence', 'text', 'score', 'difficulty', 'engine', 'generator', 'storage', 'settingsStore', 'sessionStore', 'selectedStore', 'specPrompt'].map(code).join(', ')}.

## 3. Pages

1. **Elegant Passwords** (main page, ${code('#/')}): requirements form, swaps panel, two modes (Make up a sentence / Use my sentence) as an accessible tab list, suggestion cards, strength panel, difficulty rubric, and "My list" (the user's saved passwords).
2. **Fun** (${code('#/fun')}): shows this prompt, generated from the live constants, with Copy and Download buttons.

Hash routing; a top nav links both pages.

## 4. Requirements form (left column)

${requirementsTable()}

- Each "must contain" row is a checkbox plus an "at least N" number input; checking sets 1, unchecking sets 0. All three are on by default.
- Number inputs can be typed through: the text stays as typed ("1" on the way to "10" is not snapped to the minimum); only whole numbers in range are committed as you type, and leaving the field clamps into range or restores the last value. Clearing an "at least" field never unticks its box.
- Validation errors are shown in place of suggestions as a readable message, never thrown at the user. Any other render error is caught by an error boundary that shows the message and a reload button.
- Separator choices that the site does not allow are disabled; stretchy ones are labelled "(pinky stretch)" while the pinky toggle is on.

## 5. Keyboard model and typing cost

- Model a US QWERTY board with staggered rows: number row offset 0, top row 1.5, home row 1.75, bottom row 2.25 key widths; space bar on the thumb. Standard touch-typing finger assignment.
- **Roll**: the neighbouring key on the same row under the same hand, like each step of ${code('asdf')}, ${code('ert')} or the index finger's sideways ${code('fg')}.
- Transition cost between consecutive keys: roll ${COST.roll}; repeat ${COST.repeat}; otherwise distance × ${COST.distance} + rows crossed × ${COST.rowChange} + ${COST.sameFinger} if one finger moves between rows (like ${code('e→d')}); any move to or from space ${COST.thumb}; each shifted character +${COST.shift}.
- **Pinky stretch**: a key on a pinky column more than ${PINKY_REACH} key widths from that pinky's home key (${code('a')} or ${code(';')}). Blocks \`\`! ) - _ = + \\ | ~ \` \`\` and ${code('] }')}, and the digits 1 and 0. Allows ${code("p [ ' / ? : \"")}.

## 6. Make up a sentence (generated mode)

### Word pools
${list(pools.map(([name, n]) => `${n} ${name}`))}
- All lowercase a-z, 3-8 letters, common, no duplicates. A joiner pool containing only ${code('and')}.
- **Typing comfort** ranks each pool (words and numbers) by average transition cost and keeps the easiest share (${Object.entries(COMFORT_SHARE).map(([k, v]) => `${k} ${v * 100}%`).join(', ')}), never fewer than ${MIN_POOL}.
- **Made-up nouns**: ${KEY_ROLLS.length} key rolls (2-4 contiguous letters along one row under one hand, either direction: ${code('ert')}, ${code('dfg')}, ${code('lkj')}). A made-up noun is one roll or two joined (${code('ert')} + ${code('dfg')} → ${code('ertdfg')}), 3-8 letters, in all lowercase or ALL CAPS: ${MADE_UP_NOUNS.length.toLocaleString('en')} words, about ${Math.log2(MADE_UP_NOUNS.length).toFixed(1)} bits each. They fill the first N noun slots.

### Sentence templates
Clauses, shortest first:
${list(CLAUSES.map((c) => c.map((s) => SLOT_LABELS[s]).join(' ')))}

Plus every pair "clause + ${code('and')} + clause" where the first clause has at least 4 words.

### Number
- Numbers 2-99 (plural nouns stay grammatical). For N required digits, every N-digit number. Filtered by typing comfort like words, so close-together digits are kept.
- The number goes in front of a randomly chosen noun phrase (start of sentence, after the verb, after a preposition, after "and"). Each placement is a separate variant; the position adds bits and is counted.

### Exact entropy and sampling
- For each variant, compute by dynamic programming the number of word sequences whose total letters fit the length range (minLength/maxLength minus separators and closing marks). Entropy = log2(sum over variants).
- Sample uniformly from exactly that set: pick a variant in proportion to its count, pick a total length in proportion to its count, then each word's length in proportion to the remaining completions, then a uniform word of that length.
- **Plan choice**: among templates meeting the target bits, choose the shortest expected length; otherwise the strongest, with a warning saying what to relax.
- **Uppercase guarantee**: a shape whose fewest possible letters (initials 1, two-letter words 2, whole words the shortest in the pool; numbers and made-up nouns 0) is below minUppercase is never planned, so every password can meet the rule. If nothing is left, the error says to raise the maximum or use fewer initials, two-letter words and made-up nouns.

### Rendering
- **Separator**: the chosen one; "auto" uses space if allowed, else the first allowed and comfortable of ${SEPARATOR_PREFERENCE.map(code).join(' ')}, else none.
- **Symbols**: symbol separators count toward minSymbols; any shortfall is a repeated closing mark, preferring ${END_PREFERENCE.map(code).join(' ')} (first comfortable allowed one).
- **Uppercase**: capital initials and ALL-CAPS made-up nouns count first. Then for 1, capitalise the first letter of the first ordinary word; for more, write whole ordinary words in capitals from the start until the count is met (Shift held once, no case flipping). Made-up nouns are never recased, which also keeps the count exact.
- **Capital initials**: N words become one capital letter, chosen by fixed priority ${INITIAL_PRIORITY.map((s) => SLOT_LABELS[s]).join(' > ')} (skipping made-up nouns). The slot's pool becomes its distinct initials, so entropy stays exact. Show a word to picture for each initial.
- **Two-letter words**: N words are typed as their first letter and last consonant (${code('gently → gy')}), by priority ${SHORTHAND_PRIORITY.map((s) => SLOT_LABELS[s]).join(' > ')}, skipping initials. The slot's pool becomes its distinct two-letter forms, so entropy stays exact.
- **Glue**: when on, the number and small-word initials (${SMALL_SLOTS.map((s) => SLOT_LABELS[s]).join(', ')}) attach to the next word without a separator.

## 7. Swaps (twists)

Random swaps and misspellings applied after the sentence is chosen. "Minimum swaps" (0-${MAX_TWISTS}, default ${DEFAULT_REQUIREMENTS.twists}) are applied whenever the letters allow; if a password ends up with fewer, a warning says so and suggests what to change.

${mappingSection()}

- Users can switch any built-in mapping off and add their own (replace = 1-8 lowercase letters; with = up to 8 characters from lowercase letters, digits and keyboard symbols, empty means delete; capitals are rejected with a message, since a capital inside a word would make the case alternate). Saved to localStorage under ${code(STORAGE_KEY)} as ${code('{ disabled: string[], custom: {from,to}[] }')}; malformed data is dropped, blocked storage is tolerated. A reset button restores defaults.
- Mappings whose output uses a symbol the site disallows, or a pinky stretch while the toggle is on, are skipped (shown struck through).
- Twists never touch the number, initials, made-up nouns or two-letter words, only match lowercase letters, never overlap, keep the first letter a letter when it will be capitalised, and never make a word vanish (a deletion that would leave nothing is not an option).
- **Counting**: per word, enumerate every distinct spelling reachable with up to N non-overlapping twists, at the fewest twists that make it. Combine words with a DP over (twists used, length change, letter change) so results stay within the length limits and keep enough letters for the uppercase rule. Pick uniformly among distinct results; bits = log2(count). Fall back to fewer twists if none fit. The same table answers "how many outcomes were there" when a password is scored cold.

## 8. Use my sentence

The user types a sentence (never stored, never put in the URL). Options: shrink words of ${DEFAULT_SENTENCE_OPTIONS.shrinkFrom}+ letters in a style (keep; drop vowels, the default; or first + last consonant, ${code('jupiter → jr')}); small words become capital initials (default on); short targets may drop words entirely (default on); compress toward N characters (default: the site maximum). The symbol between words is optional (separator "None").

1. Normalise: strip accents, lowercase, remove apostrophes, split on anything not a-z0-9.
2. Small words (${[...SMALL_WORDS].slice(0, 12).join(', ')}, …) become one capital letter. Then the "initials" option turns that many random other words into initials; enumerate distinct outcomes and count log2 as bits.
3. Shrink long words in the chosen style (${code('sweets → swts')} or ${code('jupiter → jr')}).
4. **Compression ladder**, one small change per step: drop vowels from the longest word; trim its second-to-last letter until two letters remain (${code('jptr → jpr → jr')}); shorten long numbers to their leading digits; drop small words (if allowed); reduce the longest word to an initial; finally drop the shortest piece (if allowed; prefer spare numbers), keeping at least two pieces. No step may leave fewer letters than the uppercase rule needs.
5. **Exact fitting by binary search**: every ladder step shortens the bare text, so the states are ordered. Binary-search them for the least-compressed state whose finished password fits [min, target or max]; each state is finished at most once and the result reused, so a long sentence costs log2(states) finishes instead of one per state. States whose bare length is clearly too long are skipped first; the ladder is cached per sentence; spellings are memoised per mapping list. If even the starting state is under the minimum, back off: keep the longest words whole one at a time, then use fewer random initials.
6. Finishing a state: capitalise first (so swaps can never remove the capitals the rule needs); required digits come from digit swaps, else a comfortable number of the needed length is appended; required symbols come from separators, then symbol swaps, then repeated closing marks; then the user's random swaps, kept within the length limits and the target; then glue, separator and closing marks.

**Guarantee**: any sentence with at least one letter can be reduced to 12 characters that pass every rule (with up to 2 uppercase, 2 digits and 2 symbols required), with dropping allowed. Property tests check this on hundreds of random messy sentences across all separators, shrink styles, initials, glue and swap settings.

Example: "jupiter brings 5 leds for piece", ${code(';')} separator, glue on, 1 initial, target 12 → ${code('jr;B;5ls;Fpc')}.

Strength in this mode: the sentence's guessability cannot be measured. The card's figure is the cold score (section 14) of the password against the sentence, which counts only the random initials and swaps; warn that quotes, lyrics and personal facts are weak.

## 9. Suggestion cards

Each card shows the password, its bits and difficulty (both from the cold score, section 14), Copy, "Add to my list", and an expandable "Why?" with:
- **Easy to remember**: the hint (the sentence to remember); word chips labelled by part of speech, "made-up noun" or "your word"; twisted and initial words marked with the original; the twists or change steps listed; the number of ways the twists could land.
- **Fast to type**: Shift presses and why (and how often capital initials flip the case), share of same-row moves, average reach, same-finger pairs, rows used, separator note, and a keyboard heat map of the keys used.
- **Difficulty score** table (below).
- **Meets the requirements**: every rule with ✓/✗ and how it was met.

## 10. Strength panel

- Total bits against the target; a table of each slot's pool size and bits, plus the number position and any loss from length limits. This is the exact entropy of the current plan; each card's figure is scored from its own password and hint and may sit a little above it (it does not know the length limits).
- One static sentence on choice bias: seeing several suggestions, or pressing New passwords until you like one, leans the choice toward what you find likeable, and the figures do not discount for it. No count-based discount is shown: a score must not depend on how many were seen.
- Average time to guess (half the space) at: ${ATTACK_SCENARIOS.map((a) => `${a.scenario} (${a.guessesPerSecond.toExponential(0)}/s)`).join('; ')}.

## 11. Difficulty rubric (0-100)

Each criterion lands on a level ${LEVELS.map((l, i) => `${i} ${l}`).join(', ')} by fixed cut-points and earns weight × level ÷ 4 points; weights sum to 100. For ${RUBRIC.filter((c) => c.higherIsEasier).map((c) => c.name).join(', ')}, more is easier, so a level starts at or below its cut-point. Totals: 0-20 Effortless, 21-40 Easy, 41-60 Moderate, 61-80 Demanding, 81-100 Hard.

${rubricTable()}

Typing time model: ${SECONDS.keystroke} s per keystroke + ${SECONDS.perCost} s × transition cost + ${SECONDS.shift} s per Shift. Memory load counts words, the number and each twist. Show the full rubric in a collapsible panel.

## 14. Cold scoring

Everything a card or a saved entry says about a password's strength and difficulty comes from one pure function of two strings: ${code('scoreCold(password, hint)')}. Nothing else goes in (not the settings, not how many suggestions were shown, not how many times New passwords was pressed), so a password scores the same wherever and whenever it appears.

1. Normalise the hint into words (as in section 8, step 1).
2. Align each word in the password, in order: as the whole word, a shortened form (vowels dropped, interior letters trimmed, first + last consonant, a number's leading digits), a capital initial, or a swapped spelling of any of those (up to 3 swaps, built-in mappings). Longest match wins, then fewest swaps. Look in place first, then one character on (past a separator); never skip symbols blindly, since a swap can put one at the start of a word. A word found nowhere is "dropped".
3. Match the words to a sentence template (with the number placed anywhere it may go). If one fits: find the most restrictive typing-comfort level whose pools contain every word; sentence bits = Σ log2(pool size at that level, using the initials pool or pairs pool for those forms, ${MADE_UP_NOUNS.length.toLocaleString('en')} for a made-up noun) + log2(number placements). Several fitting templates → the fewest bits. No fit → sentence bits 0, plus log2 C(eligible words, initials found) for which words became random initials (your own sentence).
4. Swap bits = log2 of the number of distinct outcomes for exactly the swaps found, from the same DP as section 7, over the aligned base forms, with the first letter protected when the first word is sentence-cased.
5. Difficulty = the rubric on the password with memory load = hint words + swaps.

Left out on purpose: length limits (unknown cold), the user's own mapping list (always the built-in 64), any selection bias. The result is memoised and plain data.

## 15. State, persistence and performance

- One React provider owns the requirements, sentence options, mode, mappings, sentence, current batch and the user's list, and exposes them through a hook. Components never generate; they ask the provider.
- Generation is one pure function ${code('runInputs(inputs) → outcome')} (never throws: requirement problems and bugs come back as messages). It runs in a Web Worker when the browser has one, inline otherwise, through one interface; answers are matched to requests by id and superseded answers are dropped. Changes are debounced; the old batch stays on screen, dimmed, until the new one is ready; a status says "Working…".
- A key of the inputs that matter (mode, requirements, mappings; the sentence and its options only in sentence mode) is stored with each batch. On reload the batch is shown again and nothing is regenerated unless an input differs. "New passwords" bumps a round counter stored alongside.
- localStorage: requirements (${code(REQUIREMENTS_KEY)}), sentence options (${code(SENTENCE_OPTIONS_KEY)}), mode (${code(MODE_KEY)}), mappings (${code(STORAGE_KEY)}), the list (${code(SELECTED_KEY)}). sessionStorage: the current batch, round and sentence (${code(SESSION_KEY)}), kept through a refresh and gone when the tab closes. Every value read back is parsed as untrusted and falls back to defaults field by field.
- **My list**: add a suggestion one at a time (a password already listed is not added twice); each entry stores only the password, the hint and when it was added; it is displayed with its cold score, Copy and Remove; "Remove all" asks once.

## 16. Security and accessibility

- The built page carries a Content-Security-Policy meta tag (first in head) allowing scripts, styles and the worker from the same origin only, no connections, no objects, no base URI, no form actions; the dev server does not (it needs inline scripts for hot reloading). ${code('referrer: no-referrer')} always.
- Copy uses the clipboard API and, when it is unavailable or rejects (insecure context, page not focused), selects the text and says so in a status region instead of silently failing.
- Downloads revoke their object URL after a delay, never synchronously, so the browser can start the download.
- The mode switch is a WAI-ARIA tab list: one tab stop, arrow keys, Home and End move and select, each tab names its panel. Segmented buttons expose ${code('aria-pressed')}; busy state is on the results region; status text uses ${code('role="status"')}.

## 12. Tests (Vitest)

- Randomness: uniform integers, weighted choice.
- Counting: the DP count equals brute force on small pools; sampling is uniform over the valid set.
- Every requirement combination produces passwords that pass all checks, use only allowed symbols, and never alternate case unless initials or ALL-CAPS made-up nouns are on.
- Made-up nouns are at most two rolls and never mixed case; rolls like ${code('asdf')} rate easy.
- **Reduce to 12**: property tests on random messy sentences (long words, small words, long numbers, punctuation, accents) prove every one reduces to ≤ 12 characters passing every rule, and never compresses below a 4-8 minimum when there is enough material.
- Twist counts are exact (dedupe identical results), uniform, respect skips, length limits and the pinky rule.
- Sentence mode reproduces the examples above and explains what cannot be fitted.
- Storage round-trips and tolerates bad data. Rubric weights sum to 100 with rising cut-points.
- Every requirement combination (random fuzz) meets the uppercase rule, including with initials, two-letter words and letter-removing swaps; swaps never touch two-letter words; custom mappings reject capitals; a deletion never empties a word.
- Cold scores are pure, serialisable, agree with the cards, read the documented examples, and find swapped words with a symbol at the start.
- The provider restores a batch without regenerating, regenerates on input change or request, persists settings and the list, ignores superseded answers; the worker generator matches answers by id and falls back inline on failure.
- Components (jsdom): number fields can be typed through and clamp on blur; tabs follow the ARIA pattern; the error boundary shows the message; Copy reports failure and selects the text; the download revokes late; the app keeps passwords and the list across a remount.

## 13. Acceptance

- Default settings (max ${DEFAULT_REQUIREMENTS.maxLength} characters, target ${DEFAULT_REQUIREMENTS.targetBits} bits, ${DEFAULT_REQUIREMENTS.twists} swaps, separator ${code(DEFAULT_REQUIREMENTS.separator)} so the default never needs a pinky stretch) produce five sentence passwords that meet the target and pass all rules.
- Changing any option regenerates instantly (well under 100 ms for 20 suggestions with 3 twists).
- Light and dark themes; layout stacks on narrow screens.
`;
}
