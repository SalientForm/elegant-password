// Builds the "Fun" page prompt: a complete spec of this app that another
// developer or model could rebuild it from. It is assembled from the live
// constants, so it always matches the code.

import { RUBRIC, SECONDS, LEVELS, LEVEL_WIDTH } from './difficulty';
import { EASE_EXCLUDED, EASE_RULES, LONG_REACH } from './ease';
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
import { BITS_PER_ENGLISH_LETTER, MAX_TWISTS_PER_WORD, MEMORABILITY, MEMORABILITY_BANDS, MEMORABLE_DIGITS_CHOICES, STRENGTH_BANDS, SYMBOL_ALPHABET } from './score';
import { SELECTED_KEY } from './selectedStore';
import { SESSION_KEY } from './sessionStore';
import { DEFAULT_WORKER_TIMEOUT_MS } from './generator';
import { MODE_KEY, REQUIREMENTS_KEY, SENTENCE_OPTIONS_KEY, SORT_KEY } from './settingsStore';
import { RULE_KEYS, SITE_PRESETS } from './sitePresets';
import { BUILT_IN_MAPPINGS, MAPPING_KIND_LABELS, type MappingKind } from './twists';
import { ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS } from './words';
import algorithmFlow from '../../docs/algorithm-flow.md?raw';
import testTitles from './testTitles.json';


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

function easeRules(): string {
  const shown = (end: boolean) => EASE_RULES.filter((r) => !!r.end === end).map((r) => code(`${r.from}→${r.to}`) + (r.notBefore ? ` (not before ${[...r.notBefore].join(' ')})` : ''));
  return `anywhere after the first letter ${shown(false).join(' ')}; at the end of the word only ${shown(true).join(' ')}`;
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
    ['minLength / maxLength', `${d.minLength} / ${d.maxLength}`, 'Whole numbers, min ≥ 1, max ≥ min (fields 1-256)'],
    ['minUppercase', String(d.minUppercase), `0-${MAX_UPPERCASE}, "at least N"`],
    ['minDigits', String(d.minDigits), `0-${MAX_DIGITS}, "at least N"`],
    ['minSymbols', String(d.minSymbols), `0-${MAX_SYMBOLS}, "at least N"`],
    ['allowedSymbols', code(d.allowedSymbols), 'Symbols the site accepts'],
    ['allowSpaces', String(d.allowSpaces), 'Whether the site accepts spaces'],
    ['separator', `${code(d.separator)} (Automatic)`, 'Automatic, a space, none, or any one symbol the site allows; Automatic resolves to whatever the rules allow (Rendering, section 6)'],
    ['includeNumber', String(d.includeNumber), 'Include a number even when digits are not required (ticked and disabled while digits are)'],
    ['targetBits', String(d.targetBits), `Presets: ${STRENGTH_PRESETS.map((p) => `${p.label} ${p.bits}`).join(', ')}; or custom (0-256)`],
    ['comfort', d.comfort, `strict / balanced / relaxed (keeps ${Object.values(COMFORT_SHARE).map((s) => `${s * 100}%`).join(' / ')} of each word pool)`],
    ['twists ("Minimum swaps")', String(d.twists), `0-${MAX_TWISTS} random swaps or misspellings per password, applied whenever the letters allow`],
    ['initials', String(d.initials), `0-${MAX_INITIALS} words typed as one capital letter`],
    ['shorthand', String(d.shorthand), `0-${MAX_SHORTHAND} words typed as first letter + last consonant`],
    ['madeUp', String(d.madeUp), `0-${MAX_MADE_UP} nouns replaced by made-up words of at most two key rolls`],
    ['glue', String(d.glue), 'Attach numbers and small-word initials to the next word'],
    ['avoidPinkyStretch', String(d.avoidPinkyStretch), 'Toggle; on by default'],
    ['easeSwaps', String(d.easeSwaps), 'Toggle "Ease awkward words with deliberate swaps" (section 7); off by default'],
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

Build a client-only web app, **Elegant Passwords**, that makes passwords that are hard to guess, easy to remember and fast to type. Implement everything below exactly; where a number is given, use it.

## 1. Principles

- **Memorable**: every password reads as a grammatical sentence, or comes from a sentence the user typed.
- **Fast to type**: prefer nearby keys, finger rolls along one row (${code('asdf')}) and close-together digits (${code('357')} over ${code('129')}); avoid long reaches, row jumps, one finger changing rows, Shift and pinky stretches. Case never alternates inside a word; made-up words are all lowercase or ALL CAPS.
- **Honest strength**: entropy assumes the attacker knows the app, its word lists and every rule; only random choices count, fixed rules count as zero.
- **Private**: no network. Randomness comes only from ${code('crypto.getRandomValues')}, with rejection sampling for uniform integers.
- **Explained**: every password says why it is memorable, fast and strong, and how it meets each rule.

## 2. Stack

TypeScript, React + Vite, Vitest, Playwright; Node 24, pnpm. Dev server 127.0.0.1:4270, preview 4271; Playwright serves the build on 4272 and the dev server on 4273. Pure logic in ${code('src/lib/')} (no React), UI in ${code('src/components/')}, one provider in ${code('src/state/')}, worker entry ${code('src/worker.ts')}, build-time CSP plugin ${code('build/csp.ts')}. Modules: ${['random', 'keyboard', 'words', 'ease', 'grammar', 'lengthModel', 'twists', 'mappingStore', 'generate', 'fromSentence', 'fluff', 'text', 'score', 'difficulty', 'sort', 'typingTest', 'engine', 'generator', 'storage', 'settingsStore', 'sessionStore', 'selectedStore', 'validation', 'sitePresets', 'ruleText', 'devStats', 'specPrompt'].map(code).join(', ')}.

## 3. Pages and layout

Hash routing; tabs **Passwords** (${code('#/')}), **Scoring** (${code('#/scoring')}), **Fun** (${code('#/fun')}); the Passwords page stays mounted, hidden, while another page shows, so its settings, sentence and typing runs survive. The header spans the full width, opaque and lighter than the top of the page gradient it sits on: that colour mixed with 20 % white (the "bar colour"), then taken 75 % of the way to the panel colour; it has a subtle drop shadow; it holds the title area and the three page tabs, whose light bottom border is underlined by the header's own bottom line, a shade darker. Above the tabs, left-justified: the title "Thuh Eleg@nt Pa$$word!" with the one-line description beneath it (13 pt, the same on every page: "Passwords that read like a sentence, sit comfortably under your fingers, and are still hard to guess."); "brought to you by SalientForm" at the right end of that row, small, italic, 30 % opacity, only "SalientForm" bold, scrolling with the page.

**Passwords page.** Content at most 1380 px wide, centred, 0.75 rem above the title row, no padding below. The page background is a top-to-bottom gradient over the whole document: the page colour mixed with 20 % black at the top (20 % of brightness darker), the page colour at the bottom; light and dark themes alike.
- Grid: 300 px | ${code('minmax(0, 1fr)')} | 340 px, gap 1.5 rem, items aligned to start. Left: requirements form, swaps panel. Middle: a sentence card holding the mode tabs (Make up a sentence / Use my sentence) and, under them, the generated sentence of the first card or the sentence field; a Suggestions card holding the "Suggestions" heading, a row with the order toggle on the left (three buttons, remembered in localStorage: "Memorability", most memorable first; "Difficulty", easiest to type first, the default; "Strength", strongest first) and Refresh on the right, any message, and a card per password (on the page background); then the strength panel as a card of its own. Right: Test a password, then My list.
- The two toggle groups, mode tabs and order, share one style: a pill on the page colour with a darker border (10 px corners, 0.3 rem padding and gap), each choice a near-white button (the panel colour with 30 % of the page colour) with the same darker border and 7 px corners, the active one filled with the soft accent, with an accent border and text. On a phone the order labels are smaller (0.75 rem) and share one row at equal widths, wrapping only when one no longer fits.
- Scrolling: each column is ${code('position: sticky; top: 0; max-height: 100vh; overflow-y: auto')} with a thin scrollbar. The page scrolls first, carrying header, tabs and all three columns up together, and can scroll exactly until the columns reach the top of the viewport (page height = header + tallest column box). From there each column scrolls alone and only within its own content; wheel-up at a column's top chains to the page and brings the header back. Because browsers scroll the element under the pointer before the page, a non-passive wheel listener on the columns' container routes wheel-down to the page (prevent the default, ${code('scrollBy')} the smaller of the delta and the distance left) until the page reaches its stop: the columns' top less their sticky top, capped at the page's maximum scroll, counted as reached within 1 px. Wheel-up is never intercepted, nor is Ctrl+wheel or ⌘+wheel (pinch zoom). While changes are pending the middle column's bottom spacer grows to 5 rem, so the floating buttons never cover its end.
- Each column has 1 rem above its first panel (padding) and 1 rem below its last panel: a ${code('::after')} spacer of 1 rem with a negative top margin cancelling the grid gap, not padding (some browsers leave bottom padding unreachable).
- Discard / Submit changes float fixed at the bottom centre above everything, safe-area inset respected.
- From 801 to 1100 px two columns stay open, Suggestions and one outer column, and the third shrinks to a button in a strip at its side; Options is the open one whenever the page loads or the width enters this range (the choice is not kept), and the strip's button trades the outer columns. The open columns stick and scroll as on the desktop.
- From 601 to 800 px one column stays open and the other two shrink to a button each, "Options", "Suggestions" and "Testing", keeping column order; Suggestions is open at first; a button opens its column and shrinks the open one, and focus moves into the opened column. Each button is centred vertically and horizontally in a thin strip as tall as the viewport and stuck to its top, so it is always in reach; its label runs vertically, bottom to top in a strip left of the open column and top to bottom in one right of it, at 65 % opacity (full on hover or focus). The open column sits in normal flow and the page scrolls normally, keeping 5 rem (plus the safe-area inset) clear at its foot for the floating buttons; shrunken columns stay mounted but hidden, so an open Why? or a typing run is not lost. This holds down to a flagship phone's width (360 px).
- At 600 px and below (phones) the open column takes the whole width and there are no strips. The header keeps the title area but loses the page tabs and its bottom margin. Directly under it a phone bar runs the full viewport width and sticks to the top: no gap, the header (shadow included) drawn over it, opaque, half way from the bar colour to the panel colour, with a light bottom line and a subtle drop shadow, its content lined up with the page's. The three page links fold into a menu behind a hamburger at its left, the bare symbol with no border, face or shadow (accessible name "Pages"; Escape, a tap outside or choosing a page closes it, Escape there does not discard changes, and focus that was inside the menu returns to the hamburger). The three column tabs, Options / Suggestions / Testing, sit centred (WAI-ARIA tabs whose panels are the columns), styled like the toggle groups: near-white tabs with the darker border, 7 px corners and 0.5 rem side padding, the active one filled (soft accent, accent border), on a pill of the page colour at 50 % transparency with the darker border and 10 px corners; at 400 px and below their text is 0.7 rem; below 360 px the empty track mirroring the hamburger gives its room to the tabs. On the Scoring and Fun pages the page's name stands where the tabs would be. The title row above scrolls away as usual.
- On a phone every panel (Passwords and Scoring pages) runs edge to edge with square corners and no gaps, closed by one darker line below it, so a single line separates two cards; the first meets the bar's own bottom line.
- Nothing scrolls sideways at any width: the page is clipped horizontally; passwords sit on one line, cut with an ellipsis; the title scales with the viewport and the credit wraps under it; card and badge rows wrap; the keyboard map is sized in em; at 800 px and below app tables stack into labelled lines, prose tables use a fixed layout with wrapping cells and code blocks wrap; touch targets grow on coarse pointers.

**Scoring page**: how bits are counted (the exact plan, cold scoring, words off the lists, choosing a favourite, time to guess per preset at the three attacker speeds), the full difficulty rubric, memorability. **Fun page**: headed "Rebuild this app from one prompt"; this prompt, generated from the live constants, rendered from markdown with ${code('marked')} (app-generated content only), with its word count, "Copy prompt" and "Download .md" (${code('elegant-passwords-spec.md')}) of the raw markdown; between the heading and the prompt, "How this app was made": tiles for estimated tokens used (output, cache reads, cache writes and fresh input, over N calls), LLM models used (each model's share of tokens and calls), estimated cost over the API (each model's tokens at its list prices, 1-hour cache writes at their own rate, split by model and kind of token, with the date of the prices; a model without a known price is named and left out), lines of code (non-blank, app and tests), time in development (first prompt to last commit, and the time the AI was at work: gaps under 5 minutes), commits, tests and prompts typed (with tool calls, sessions and subagents), snapshotted by ${code('pnpm stats')} from the project's Claude Code transcripts and git, with the date of the snapshot. Both end with a 1 rem bottom margin.

## 4. Requirements form (left column)

Headed "Requirement options". Fieldsets in order: Length (minimum, maximum); Must contain; Site allows (Spaces, Symbols); Strength (the four presets as buttons, then a custom target); Typing comfort (three buttons with a hint for the one chosen, then Avoid pinky stretches); Style (separator, include a number, capital initials, two-letter words and made-up nouns as None / 1 / 2 / 3 buttons, glue, number of suggestions).

${requirementsTable()}

- **Site rules** (first in the form): one-tap presets in the strength presets' two-column style, each a full set of the site-rule fields (${RULE_KEYS.map(code).join(', ')}) and nothing else, so strength, comfort, style and swaps are untouched: ${SITE_PRESETS.map((p) => `"${p.label}" (${p.rules.minLength}-${p.rules.maxLength}, uppercase ${p.rules.minUppercase}, digits ${p.rules.minDigits}, symbols ${p.rules.minSymbols} from ${p.rules.allowedSymbols ? code(p.rules.allowedSymbols) : 'none'}, spaces ${p.rules.allowSpaces ? 'allowed' : 'not allowed'})`).join('; ')}. The preset the rules match exactly (allowed symbols compared as a set) is shown pressed. A preset or pasted rules never leave the form contradicting itself: a separator they rule out becomes Automatic, said in a line under the presets ("No symbols: separator set to Automatic (none), as \";\" is not allowed.", shown while the form still holds what that tap made) or in the paste message.
- **Paste the site's rules**: a disclosure under the presets opens a text box. A pure, deterministic parser (no network, no model) reads lengths ("8-20", "between 8 and 20", "at least 8", "8 or more", "no more than 20", "up to 20", "fewer than 17", "exactly 8"), uppercase, digit and symbol requirements with "at least N" counts, explicit symbol lists (as the allowed set; "such as" lists are only examples; "except" or "must not contain" lists are removed from the allowed set), "no spaces" / "spaces allowed", and "letters and numbers only" / "no special characters". It returns only what it found plus a line for each; typing shows "Understood: …" live, a paste or "Fill in" applies at once and says "Filled in: …"; anything not mentioned stays as it was. Fixes go to what the text did not say, and each is named: a new minimum above the maximum raises the maximum (and the reverse); counts are capped at the form's maximum; a required symbol with none allowed brings back the default symbols; required characters past a stated maximum lower the unstated counts, largest first ("symbols lowered to 1 to fit"); a separator ruled out becomes Automatic. Text with no rules says "No password rules found in that text; nothing changed." Both presets and pasted rules are drafts like any other edit.
- Each "must contain" row is a checkbox plus an "at least N" field; checking sets 1, unchecking 0; all three on by default.
- **Drafts and Submit**: every edit to the rules, swaps, sentence or sentence options is a draft. While a draft differs from what is applied, Discard and Submit changes float (no backdrop, no text, strong shadow). Enter anywhere submits (not on a button, link or select, nor in the add-mapping form, where Enter adds the mapping; Ctrl+Enter and ⌘+Enter always do), Escape discards. In a number field Enter first commits the clamped value, so what is submitted is what the field shows. Submitting saves and regenerates; Refresh submits any draft, then rolls. Switching mode is immediate. A draft whose rules contradict themselves cannot be submitted (next item).
- **Contradictions** (${code('ruleProblems')} in ${code('src/lib/validation.ts')}, one pure function the form, the provider, stored settings and the engine share): each length a whole number 1-256 and the minimum not above the maximum; each count in its range; the required uppercase letters, digits and symbols together within the maximum ("8 uppercase letters + 4 digits + 1 symbol need at least 13 characters, more than the maximum of 10."); a required symbol with no keyboard symbol allowed; a chosen separator the rules forbid (with "Choose Automatic to use one the site allows."), a letter or digit, more than one character, or off the keyboard; target 0-256 bits; comfort one of three; initials, two-letter words, made-up nouns and swaps 0-3; 1-20 suggestions. Each problem names its fields: the message shows in red under the fieldset of the first, every field named gets a red border, ${code('aria-invalid')} and ${code('aria-describedby')} pointing at the message. While there is any, Submit changes is disabled with a card above it in the floating bar ("Fix this to submit:" or "Fix N problems to submit:" and the first message, plus "Show", which opens Options and focuses that field), Enter and Ctrl+Enter do nothing, and Refresh is disabled; the last batch stays on screen. What only planning can find (no made-up sentence fits 4-8 characters) still comes back from the engine as an error in place of the suggestions; nothing is ever generated from a contradiction. Characters in the symbols field the tool never uses (letters, digits, spaces, symbols off the keyboard) are named in a hint ("Not used: …"), without blocking.
- Number fields keep the text as typed; only whole numbers in range commit while typing ("1" on the way to "10" is not snapped); blur clamps into range or restores the last value. Clearing an "at least" field never unticks its box.
- Separator ("Separator between words"): three buttons, Automatic (the default), Space and None, then a one-character box (placeholder "or ;", pressed-looking while it holds the separator) for any symbol of your own; emptying the box goes back to Automatic. Space is disabled while spaces are not allowed, unless it is already the choice (then the error says so). A line under it explains the choice (Automatic and what it resolves to under the current rules, e.g. 'Automatic: ";" under these rules.'; a space on the thumb; none; the character; a pinky stretch kept because chosen) or shows the problem instead.
- Requirement errors show as a message in place of the suggestions. Any other render error is caught by an error boundary with the message and a reload button.

## 5. Keyboard model and typing cost

- US QWERTY with staggered rows: number row offset 0, top 1.5, home 1.75, bottom 2.25 key widths; space on the thumb; standard touch-typing fingers.
- **Roll**: the neighbouring key on the same row under the same hand (${code('asdf')}, ${code('ert')}, the index finger's ${code('fg')}).
- Transition cost: roll ${COST.roll}; repeat ${COST.repeat}; otherwise distance × ${COST.distance} + rows crossed × ${COST.rowChange} + ${COST.sameFinger} if one finger changes rows (${code('e→d')}); any move to or from space ${COST.thumb}; each shifted character +${COST.shift}.
- Characters the model has no key for (é, £, a tab) are charged as a shifted press of the key furthest from home (a dead key, AltGr or compose sequence); scoring never throws on pasted text.
- **Pinky stretch**: a pinky-column key more than ${PINKY_REACH} key widths from that pinky's home (${code('a')} or ${code(';')}): \`\`! ) - _ = + \\ | ~ \` \`\`, ${code('] }')}, the digits 1 and 0. Not ${code("p [ ' / ? : \"")}.

## 6. Make up a sentence (generated mode)

### Word pools
${list(pools.map(([name, n]) => `${n} ${name}`))}
- Lowercase a-z, 3-8 letters, common, no duplicates; a joiner pool of only ${code('and')}.
- **Typing comfort** ranks each pool (words and numbers) by mean transition cost (of each word as typed with its deliberate swap when easeSwaps is on, section 7; the pools keep the words as written and the same sizes) and keeps the easiest share (${Object.entries(COMFORT_SHARE).map(([k, v]) => `${k} ${v * 100}%`).join(', ')}), never fewer than ${MIN_POOL}.
- **Made-up nouns**: ${KEY_ROLLS.length} key rolls (2-4 contiguous letters along one row under one hand, either direction: ${code('ert')}, ${code('dfg')}, ${code('lkj')}); a made-up noun is one roll or two joined (${code('ertdfg')}), 3-8 letters, all lowercase or ALL CAPS: ${MADE_UP_NOUNS.length.toLocaleString('en')} words, about ${Math.log2(MADE_UP_NOUNS.length).toFixed(1)} bits each, filling the first N noun slots.

### Sentence templates
Clauses, shortest first:
${list(CLAUSES.map((c) => c.map((s) => SLOT_LABELS[s]).join(' ')))}

Plus every "clause + ${code('and')} + clause" whose first clause has at least 4 words.

### Number
- 2-99 (plural nouns stay grammatical); for N required digits, every N-digit number; comfort-filtered like words.
- Placed before a randomly chosen noun phrase (sentence start, after the verb, after a preposition, after "and"); each placement is a variant and the position is counted as bits.

### Exact entropy and sampling
- Per variant, count by dynamic programming the word sequences whose letters fit minLength/maxLength less separators and closing marks. Entropy = log2 of the sum over variants.
- Sample uniformly from exactly that set: variant ∝ count, total length ∝ count, each word's length ∝ remaining completions, then a uniform word of that length.
- **Plan choice**: among templates that meet the target bits, the shortest expected length; otherwise the strongest, with a warning saying what to relax.
- **Uppercase guarantee**: never plan a shape whose fewest possible letters (initials 1, two-letter words 2, whole words the pool's shortest; numbers and made-up nouns 0) is below minUppercase. If none is left, the error says to raise the maximum or use fewer initials, two-letter words and made-up nouns.

### Rendering
- **Separator**: as chosen; Automatic is ${code(SEPARATOR_PREFERENCE[0])} whenever it is allowed (home row, no Shift, and it counts toward the symbol rule; so the default rules give exactly the old ${code(';')} default), else a space if allowed, else the first allowed and comfortable of ${SEPARATOR_PREFERENCE.slice(1).map(code).join(' ')}, else none. Automatic is never a problem, whatever the rules. Saved requirements carry ${code('version: 2')}. In an older record ${code(';')} was the default rather than a choice and loads as Automatic (the same passwords wherever ${code(';')} is allowed), and "auto" (which meant a space first) with spaces allowed loads as a space, so no passwords change.
- **Symbols**: symbol separators count toward minSymbols; the shortfall is a closing symbol drawn at random for each password from the comfortable allowed symbols other than the separator (all allowed ones if every one is a stretch), so a batch does not all end in the same mark, repeated as many times as needed; it adds no counted bits. The plan's own closing mark, used for overhead and warnings, prefers ${END_PREFERENCE.map(code).join(' ')}. Shapes whose separators fall short with no other symbol for closing marks are skipped, so a longer sentence can meet the rule with separators alone; only when no shape can does the error name the separator.
- **Edges**: the last step of making any password strips leading and trailing spaces and separator characters: ${code(';test;')} with ${code(';')} becomes ${code('test')}.
- **Uppercase**: capital initials and ALL-CAPS made-up nouns count first; then for 1, capitalise the first letter of the first ordinary word (in sentence mode, of a random word, for variety); for more, whole ordinary words in capitals from the start (sentence mode: from a random word, wrapping round) until met. The choice of word is not counted as bits. Made-up nouns are never recased.
- **Capital initials**: N words become one capital letter by fixed priority ${INITIAL_PRIORITY.map((s) => SLOT_LABELS[s]).join(' > ')}, skipping made-up nouns; the slot's pool becomes its distinct initials. Show a word to picture for each.
- **Two-letter words**: N words typed as first letter + last consonant (${code('gently → gy')}) by priority ${SHORTHAND_PRIORITY.map((s) => SLOT_LABELS[s]).join(' > ')}, skipping initials; the slot's pool becomes its distinct pairs.
- **Glue**: the number and small-word initials (${SMALL_SLOTS.map((s) => SLOT_LABELS[s]).join(', ')}) attach to the next word without a separator.
- **Warnings** (above the cards): the target is out of reach within the length limits (what to relax); swaps are on but every enabled mapping is unusable; every allowed symbol is a pinky stretch (the closing mark used); no separator and no glue, so words run together; some passwords got fewer swaps than the minimum.

## 7. Swaps (twists)

Random swaps and misspellings applied after the sentence is chosen. "Minimum swaps" (0-${MAX_TWISTS}, default ${DEFAULT_REQUIREMENTS.twists}) are applied whenever the letters allow, and half the time one more (never above ${MAX_TWISTS}), for variety; fewer than the minimum gets a warning saying what to change.

${mappingSection()}

- The panel, headed "Swaps": "Minimum swaps" as None / 1 / 2 / 3 buttons; the mappings in groups with a count of those on; each a toggle whose tip says why it is skipped, if it is. Any built-in mapping can be switched off; custom ones: replace = 1-8 lowercase letters, with = up to 8 lowercase letters, digits or keyboard symbols (empty deletes; capitals rejected). Saved in localStorage under ${code(STORAGE_KEY)} as ${code('{ disabled: string[], custom: {from,to}[] }')}; malformed data dropped, blocked storage tolerated; "Reset mappings to defaults" (disabled while they are) restores them.
- Mappings whose output uses a disallowed symbol, the separator character (a swap could put it at a word's edge, where the edge trim would remove it), or a pinky stretch while that rule is on, are skipped (struck through). In "Use my sentence", mappings whose "replace" letters occur nowhere in the sentence are disabled.
- Swaps never touch the number, initials, made-up nouns or two-letter words; match lowercase letters only; never overlap; keep the first letter a letter when it will be capitalised; never make a word vanish.
- **Counting**: per word, every distinct spelling reachable with up to N non-overlapping swaps, at the fewest swaps that make it; combine words with a DP over (swaps used, length change, letter change) so results stay within the length limits and keep enough letters for the uppercase rule; pick uniformly; bits = log2(count); fall back to fewer swaps if none fit. The same table counts outcomes when a password is scored cold.

### Deliberate swaps for typing ease (easeSwaps, off by default)

Instead of filtering awkward words out, a word that is awkward to type is typed with one fixed misspelling that removes the awkward move (${code('wise → wyse')}, ${code('kids → kyds')}, ${code('cool → cul')}, ${code('lazy → lasy')}, ${code('bricks → brix')}). The rule, a fixed function of the word alone (not its neighbours, the separator, the settings or the mapping switches), so it adds zero bits and the cold scorer can recompute it from the hint:
1. **Awkward moves** in a word of lowercase letters: a same-finger jump (two different keys, one finger, not a roll: ${code('ed')}, ${code('un')}, ${code('ki')}) or a long reach (${LONG_REACH} key widths or more between consecutive keys: ${code('w-i')}, ${code('a-i')}). A word with none is left alone.
2. **Candidates**: every place one of these sound-alike misspellings applies: ${easeRules()}. Never the first letter, never half of a double letter (${code('jazzy')} keeps its ${code('zz')}).
3. A candidate counts only if it leaves fewer awkward moves, takes less time on the rubric's typing-time model (section 11, without Shift), keeps at least 3 letters, and is not a word on any list nor one of ${[...EASE_EXCLUDED].map(code).join(' ')} (it would read as another word).
4. The winner leaves the fewest awkward moves, then is quickest; ties go to the rule listed first, then the leftmost place. One swap per word at most.
5. A spelling two list words would share is given to neither, so no two words merge and plan counts stay exact; a word of the user's own never takes a spelling a list word has.
- Applies to whole words only: never the number, initials, two-letter words, made-up nouns, shortened words or padding. Outputs are letters only, so they never meet the separator or the symbol rules. Generated mode draws words already swapped: the length model counts each word at its typed length, pool sizes (and bits) are unchanged, and the hint keeps the words as written. Random swaps then land on the swapped spelling and are counted from it. Sentence mode swaps the words still whole when finishing a state, before capitals, unless that would leave too few letters for the uppercase rule (then none are swapped).
- The card's "Why?" lists them apart from random swaps ("i → y in “wise” (wyse) removes the long reach w-i", "deliberate swap"); the strength panel names them among the fixed rules.

## 8. Use my sentence

A single-line field (Enter submits; never in the URL; kept in sessionStorage once applied). Options: shrink words of ${DEFAULT_SENTENCE_OPTIONS.shrinkFrom}+ letters (2-20; keep; drop vowels, default; first + last consonant, ${code('jupiter → jr')}); small words become capital initials (default on); short targets may drop words (default on); compress toward N characters (1-256; empty, the default, means the site maximum); pad a sentence under the minimum (default on) with a length tag last (${code('%total')} default, ${code('@factor')}, or none; the choice is disabled while padding is off). The total tag starts with the first comfortable allowed of ${code('%')} ${code('$')} ${code('#')}, the factor tag with ${code('@')}; when the site allows none, padding goes untagged and a hint under the choice says so. A symbol between words is optional (separator None).

1. Normalise: strip accents, lowercase, remove apostrophes, split on anything not a-z0-9.
2. Small words (${[...SMALL_WORDS].slice(0, 12).join(', ')}, …) become one capital letter; then "initials" turns that many other words into initials, a set drawn uniformly among those that keep enough letters for the uppercase rule (drawn, never enumerated, so a pasted paragraph costs nothing).
3. Shrink long words in the chosen style (${code('sweets → swts')}, ${code('jupiter → jr')}).
4. **Compression ladder**, one small change per step: drop vowels from the longest word; trim its second-to-last letter down to two (${code('jptr → jpr → jr')}); shorten long numbers to leading digits; drop small words (if allowed); reduce the longest word to an initial; drop the shortest piece (if allowed, spare numbers first), keeping at least two pieces. No step leaves fewer letters than the uppercase rule needs.
5. **Fitting by binary search**: the ladder is ordered, so binary-search it for the least-compressed state whose finished password fits [min, target or max]; finish each state at most once and reuse the result; first step back past states at the compressed end with a problem of their own (too few letters for the uppercase rule, too few separators when the separator is the only allowed symbol), searching only the states before; skip states whose bare length is clearly too long; cache the ladder per sentence; memoise spellings per mapping list. If the starting state is under the minimum, back off: keep the longest words whole one at a time, then use fewer random initials. Shrinking never removes the letters the uppercase rule needs: long words stay whole until enough remain. When the least-compressed state that is short enough is under the minimum and the state before it is over the maximum, the short state is the one padding completes.
6. Finishing a state: deliberate swaps on the words still whole when easeSwaps is on (section 7); capitalise next, on a random word (swaps cannot remove needed capitals); required digits half the time from digit swaps (at most 3 for the rule), the rest from a comfortable number of the needed length put in front or at the end at random and added to the hint in the same place; required symbols from separators, then a random number of symbol swaps (0 up to the shortfall, at most 3), then a closing symbol drawn for the password, repeated; then the random swaps, the minimum or half the time one more (never above ${MAX_TWISTS}), within the limits and target; then glue, separator, closing marks, edge trim.
7. **Padding**, only when still under the minimum after the back-off: arithmetic, no retry. The tag goes last and states a number about the finished password, so its length is known first; the gap before it is filled exactly, in order: a whole word from the comfortable adjective and noun pools (only when more than 3 short and one fits exactly); a digit or symbol a swap put inside a word repeated up to 3 times (${code('$t33l → $t33333l')}); a memorable digit run (${code('123')}, ${code('4321')}; a single digit only when no mark is available); closing marks (${code('!')} if allowed and comfortable, else the closing symbol). ${code('%N')} (or ${code('$N')}, ${code('#N')}, whichever is allowed) states the whole length, N the smallest number at or above the minimum with N = length + 1 + digits(N): 47 characters get ${code('%50')}, 48 get ${code('%51')}, and a 7-character body under a minimum of 10 gets ${code('%10')}, never ${code('%9')}. ${code('@N')} states the smallest divisor (≥ 2) of the length to its left, one-digit then two-digit. A gap smaller than the tag gets the tag alone with the true total unless that passes the maximum, then marks. Padding words and digit runs are tokens (chips labelled "padding"), never glued onto by the number before them; words, runs and the tag are appended to the hint.

**Guarantee**: any sentence with a letter reduces to 12 characters passing every rule (up to 2 uppercase, 2 digits, 2 symbols required) with dropping allowed; property tests check hundreds of random messy sentences across all settings. Example: "jupiter brings 5 leds for piece", ${code(';')}, glue on, 1 initial, target 12 → ${code('jr;B;5ls;Fpc')}.

Suggestions are distinct passwords: up to 10 × count attempts, repeats dropped. Warnings: a sentence under four words is easier to guess; some versions could not reach the compress-toward length; only N different versions fit; some passwords got fewer swaps than the minimum. An empty applied sentence shows "Type a sentence to turn into a password, then apply it." and Refresh is disabled while the sentence field is empty.

Strength panel in this mode: headed "How strong is this sentence?", the sentence printed beneath, the bits the batch scored (a range when they differ) and how (section 12). It says this estimates the text, not how guessable the sentence is to someone who knows the user, and that quotes, lyrics and personal facts are weak.

## 9. Suggestion cards

Ordered by the toggle: Memorability (descending, then lower difficulty, then more bits), Difficulty (ascending, then more bits, then higher memorability; default) or Strength (bits descending, then lower difficulty, then higher memorability); stable for ties. Two rows:
- Top: the password on one line (ellipsis when wider than the space, and only then an instant tip with the full text); clicking it copies it with a "Copied!" bubble at the cursor for two seconds; it is keyboard-reachable. Right-justified icon buttons (every small icon button in the app shares one border colour, a white face and a subtle drop shadow) with accessible names and tips: "Why?" (info icon; chevron and "Hide why" when open), Copy (check and "Copied" briefly after), "Add" (plus; check and "Added", disabled, once listed).
- When a card is too narrow for the password at its full width and the buttons on one row (measured per card, again on resize), the password, the badges and the buttons each take a row, centred.
- Second: three badges from the cold score (section 12), "S 48" (green from ${STRENGTH_BANDS.green} bits, yellow from ${STRENGTH_BANDS.yellow}, red below), "D 44", "M 71", each with a 1 px border in its colour. Hover or focus opens the instant tip with the full reading: "Strength 48 bits, everyday" (preset reached: master password, very strong, strong, everyday, weak; "scored from the password and its hint alone"), "Difficulty 44, moderate" (the rubric's label), "Memorability 71 of 100: how closely it still looks like its hint".
- **Instant tips** (passwords and badges): rendered at the document level with fixed positioning so nothing clips them; kept inside the viewport (shifted left at the right edge, flipped above when there is no room below); open at once on hover or focus; stay while the pointer is over them; selectable; close on leave, scroll or Escape. A badge anchor is a tab stop with a visible focus ring (its tip is how a keyboard user reads it); the password's anchor is not, since the password itself is a button.
- Every "Why?" starts closed. It expands to: **Easy to remember** (the hint; word chips by part of speech or "made-up noun", none for the user's own words, "padding" for padding; changed words show the original; the change steps; deliberate swaps, listed apart as a fixed rule that adds no strength; the random swaps; how many ways the random swaps could land); **Fast to type** (Shift presses and why, case flips, same-row share, average reach, same-finger pairs, rows used, separator note, keyboard heat map); **Difficulty score** table; **Memorability** (the score with its parts: words keeping full length and what each shortened or dropped word became, fidelity %, character count and brevity %, spellings differing from the hint and their penalty); **Meets the requirements** (each rule ✓/✗ and how).

## 10. Strength panel

Headed "Why this sentence is strong": total bits against the target; a table of each slot's pool size and bits, the number position, and any loss from the length limits. It is the exact entropy of the plan; a card's cold figure may sit a little above it (it ignores length limits). One static sentence on choice bias (seeing several suggestions, or pressing Refresh until one pleases, leans the choice; no count-based discount). Average time to guess (half the space) at: ${ATTACK_SCENARIOS.map((a) => `${a.scenario} (${a.guessesPerSecond.toExponential(0)}/s)`).join('; ')}.

## 11. Difficulty rubric (0-100)

Each criterion lands on a level ${LEVELS.map((l, i) => `${i} ${l}`).join(', ')} by fixed cut-points and earns weight × level ÷ 4; weights sum to 100. For ${RUBRIC.filter((c) => c.higherIsEasier).map((c) => c.name).join(', ')}, more is easier, so a level starts at or below its cut-point. Totals: ${LEVELS.map((l, i) => `${i === 0 ? 0 : i * LEVEL_WIDTH + 1}-${(i + 1) * LEVEL_WIDTH} ${l}`).join(', ')}.

${rubricTable()}

Typing time: ${SECONDS.keystroke} s per keystroke + ${SECONDS.perCost} s × transition cost + ${SECONDS.shift} s per Shift. Memory load = words, the number and each swap, deliberate ones included. The full rubric lives on the Scoring page.

## 12. Cold scoring

Everything a card, a list entry or the tester says about strength, difficulty and memorability comes from ${code('scoreCold(password, hint)')}, a pure function of those two strings: no settings, counts or history, so a password scores the same wherever it appears.

1. Normalise the hint into words (section 8, step 1).
2. Align each word in the password in order, as the whole word, its deliberate swap (section 7, recomputed from the hint word; form "eased"), a shortened form (vowels dropped, interior trimmed, first + last consonant, a number's leading digits), a capital initial, or a swapped spelling of any of those (up to ${MAX_TWISTS_PER_WORD} swaps for a word of up to 10 letters, 2 up to 16, 1 beyond, since enumerating spellings grows with length; built-in mappings); a repeated digit or symbol counts as the same word. Longest match wins, then fewest swaps, then the deliberate spelling as the base (reading it as random swaps of the plain word would overstate the bits; a random swap that happens to produce it is read as deliberate, the lower figure). Match in place first, then along the run of symbols that follows; a word found nowhere is "dropped".
3. Match the words to a template (number anywhere it may go). If one fits: the most restrictive comfort level whose pools contain every word, trying the pools ranked as written and as typed with deliberate swaps and keeping the fewer bits (the password cannot say for sure which made it, and the lower figure is never above the true one); sentence bits = Σ log2(pool size at that level; initials or pairs pool for those forms; ${MADE_UP_NOUNS.length.toLocaleString('en')} for a made-up noun) + log2(number placements); several fits → the fewest bits. No fit → the same rule for every word whatever its origin: a number by its digits (log2 10 each; a repeat, consecutive run or well-known skip is one pick of log2 ${MEMORABLE_DIGITS_CHOICES}); a word on the lists as one pick from the smallest list holding it (its initials list when an initial); any other word as English-like text at ${BITS_PER_ENGLISH_LETTER} bits per letter, its initial log2 26; a dropped word 0; plus log2 C(eligible words, initials found), eligible meaning neither a number nor a small word.
4. Swap bits = log2 of the distinct outcomes for exactly the random swaps found, from the DP of section 7 over the aligned base forms (a deliberately swapped word's base is its swapped spelling), first letter protected when the first word is sentence-cased. Deliberate swaps add 0 bits.
5. Difficulty = the rubric on the password, memory load = hint words + random swaps + deliberate swaps.
6. **Memorability**, 0-100: each hint word gets a size credit (1 at full length, swapped or not; the fraction kept when shortened; 0 when dropped); fidelity = mean credit, weight ${MEMORABILITY.fidelityWeight}; brevity = 1 at ${MEMORABILITY.shortAt} characters or fewer, 0 at ${MEMORABILITY.longAt} or more, linear between, weight ${MEMORABILITY.brevityWeight}; minus ${MEMORABILITY.swapPenalty} per swapped word (random or deliberate), at most ${MEMORABILITY.maxSwapPenalty}; rounded, never below 0. Badge colours: green above ${MEMORABILITY_BANDS.green}, yellow above ${MEMORABILITY_BANDS.yellow}, red otherwise.

Left out on purpose: length limits, the user's own mapping list (always the ${BUILT_IN_MAPPINGS.length} built-in), selection bias. Memoised; plain data.

## 13. State and persistence

- One React provider owns the draft and applied settings (requirements, sentence options, mappings, sentence), the mode, the order, the current batch and the list, exposed through a hook. Forms edit the draft; generation and persistence use what is applied.
- Generation is one pure function ${code('runInputs(inputs) → outcome')} that never throws (problems come back as messages). It runs in a Web Worker when available, else inline, behind one interface; answers match requests by id; superseded answers are dropped; a request starts 120 ms after the last change (debounced); the worker is created on first use and again after dispose; if it fails or is silent for ${DEFAULT_WORKER_TIMEOUT_MS / 1000} s, outstanding and later requests run inline. The old batch stays on screen, dimmed, until the new one is ready; a "Working…" status shows.
- Each batch is stored with a key of the inputs that matter (mode, requirements, mappings; sentence and its options only in sentence mode) and a round counter that Refresh bumps. On reload the batch is shown again and nothing regenerates unless an input differs.
- localStorage: applied requirements (${code(REQUIREMENTS_KEY)}), sentence options (${code(SENTENCE_OPTIONS_KEY)}), mode (${code(MODE_KEY)}), order (${code(SORT_KEY)}), mappings (${code(STORAGE_KEY)}), the list (${code(SELECTED_KEY)}). sessionStorage: the batch, round and applied sentence (${code(SESSION_KEY)}), validated down to the fields the cards read (typing profile numbers, breakdown rows). Drafts are never stored. Every value read back is parsed as untrusted and falls back field by field; a stored requirement set with a contradiction (anything ${code('ruleProblems')} finds) is repaired by resetting as few fields as will do to their defaults, the separator first (so a separator the rules forbid goes back to Automatic rather than the rules being loosened), never discarded, and a warning above the form names the fields reset ("Some saved settings could not be used, so they are back to their defaults: minimum length, separator.") until the next submit; keys are matched as own properties, so a stored "toString" or "constructor" is odd data, not a value.
- **My list**: add a suggestion one at a time (no duplicates), newest last; each entry stores only password, hint and date added (date never displayed); shown with the password at 13 pt on one line (ellipsis and instant tip only when cut off), "Hint:" and the hint (or "none") beneath, the same three badges as a card, Copy and Remove (trash) icon buttons; clicking the password copies it; "Remove all" asks once ("Really remove all?", cancelled on blur).

## 14. Test a password

Top of the right column. A plain text field labelled "Test and practice" (name and id ${code('practice-text')}, placeholder "type it here, then Enter"; never a password-type input, "Show as typed" (on by default) off masks with CSS; ${code('autocomplete="off"')}, ${code('data-bwignore')}, ${code('data-1p-ignore')}, ${code('data-lpignore')}, ${code('data-form-type="other"')}; not inside a form) records every key press with a timestamp (every named key is excluded, modifiers, navigation, AltGr, dead and IME keys, except Backspace and Delete). Enter ends a run: the field's text is the attempt and the field clears.
- The password under test is the one last added to My list (set at once, with its hint; only an addition does this, removing entries never retargets), the first run's text, or a paste (never inserted; its first line, trimmed, with the hint of a matching list entry or on-screen suggestion). It stays, mistyped runs included, until the clear button (circle-with-bar cancel icon, accessible name "Clear", at the right of the "Testing:" row), a paste, or a new list entry replaces it.
- The "Testing:" row shows the password on one line like My list: cut with an ellipsis when wider than the column, and only then an instant tip with the full text (dots when masked). A known hint is shown as text and cannot be edited; a password that arrived without one gets a "Hint" field (placeholder "(hint n/a)"; Enter returns focus to the practice field).
- With a hint, S, D and M badges are the cold score (section 12); without, S and D come from ${code('scoreAlone')} (letter runs on the lists as list picks, other letters ${BITS_PER_ENGLISH_LETTER} bits each, digits log2 10 each unless a memorable run or repeat (then log2 ${MEMORABLE_DIGITS_CHOICES}), symbols log2 ${SYMBOL_ALPHABET} each, a run of one repeated symbol log2 ${SYMBOL_ALPHABET} + log2(run length + 1); plus the rubric, memory load = the runs) and M reads "M n/a" with a tip saying memorability needs a hint.
- Per run: "Typed correctly" or "Did not match"; seconds from first key to Enter, characters, words per minute (5 characters a word), the rubric's expected seconds; corrections (Backspace, Delete); accuracy (keystrokes minus a wasted key and its removal, over keystrokes); up to four earlier runs (time, fixes, mismatch) in one line. Nothing is stored or sent.

## 15. Algorithm flow (validation)

${code('docs/algorithm-flow.md')}, included verbatim: every criterion must be enforced at the step named for it, and the flowcharts give the order of operations.

${algorithmFlow.replace(/^# .*\n/, '').replace(/^## /gm, '### ')}

## 16. Security and accessibility

- The built page carries a Content-Security-Policy meta tag (first in head): scripts, styles and the worker from the same origin only; no connections, objects, base URI or form actions. The dev server does not (hot reloading needs inline scripts). ${code('referrer: no-referrer')} always.
- Copy uses the clipboard API; a status region announces success (visually hidden) and, when the API is unavailable or rejects, says that the text was selected instead.
- Downloads revoke their object URL after a delay, never synchronously.
- Mode and section tabs follow the WAI-ARIA tabs pattern (one tab stop; arrow keys, Home and End move and select; each tab names its panel). Toggle buttons expose ${code('aria-pressed')}; the results region carries ${code('aria-busy')}; status text uses ${code('role="status"')}; every icon button has an accessible name.

## 17. Tests

Vitest for units and components (jsdom), Playwright for the browser against the production build, the dev server and a phone viewport. Key properties: uniform sampling and exact counts (DP equals brute force); every requirement combination passes every check; **Reduce to 12** on hundreds of random messy sentences; swap counts exact and limits respected; padding arithmetic exact; cold scores pure and plain data; the provider restores without regenerating and only regenerates on submit or Refresh; nothing scrolls sideways on a phone; the columns scroll as section 3 says.

### Every test, by file

Everything a test checks is part of this spec. Generated from the test files (${code('pnpm test:titles')}); a test fails if it is out of date. Indented lines are the tests inside a group.

${testTitles.map((f) => `**${f.file}**\n${f.titles.map((t) => (t.kind === 'group' ? `- ${t.title}` : `  - ${t.title}`)).join('\n')}`).join('\n\n')}

## 18. Acceptance

- Default settings (max ${DEFAULT_REQUIREMENTS.maxLength} characters, target ${DEFAULT_REQUIREMENTS.targetBits} bits, ${DEFAULT_REQUIREMENTS.twists} swaps, separator ${code(DEFAULT_REQUIREMENTS.separator)}) produce five sentence passwords that meet the target and pass every rule.
- Submitting a change regenerates well under 100 ms for 20 suggestions with 3 swaps, off the main thread, with the previous batch kept on screen until the new one is ready.
- Light and dark themes. In the dark theme raised surfaces step up from the panel colour toward white (header 8 %, phone bar 5 %, unselected toggles 4 %), and the darker line goes 18 % toward white instead of black so it stays visible. The layout and scrolling of section 3 hold on desktop; on a phone the open column fills the width under the bar of tabs, up to 800 px the other columns are buttons in strips, up to 1100 px two columns stay open, every feature is reachable, and nothing is clipped or scrolls sideways at any width down to 360 px.
`;
}
