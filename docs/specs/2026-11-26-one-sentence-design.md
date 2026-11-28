---
state: under-review
summary: >
  One sentence box in place of the Generated Sentence and Custom Sentence tabs: Generate draws a sentence into it,
  the user may type or edit it, and every option works on every sentence. The drawing options (leading number,
  shorthand, made-up nouns, shortest) learn to work on the user's own sentence, the fitting options (shrink, drop,
  small-word initials, padding, length tag, target length) on a drawn one, and a configuration is checked by its rules
  alone. The user's decision of 2026-11-26.
---

# One sentence: one box, one set of options

Status: **decisions taken**, 2026-11-26; its plan is
`docs/plans/2026-11-26-one-sentence-plan.md`. Acts on the third
item of `TODO.md` under "Asked for by Dossier", "One sentence mode: one UI
and one algorithm", and takes the user's decision of 2026-11-26: there are
not two ways to manage a sentence, because a drawn sentence can be edited
into the user's own, and **every option works on every sentence**. Its
config format was settled in the core package's spec
(`docs/specs/2026-11-03-core-package-design.md`, §4.2); §8 below changes only
what the `sentence` section's keys are said to apply to.

## 1. Goal

The Source text card has two tabs, Generated Sentence and Custom Sentence,
and the options are split between them without saying so. A user sees a
setting and cannot tell whether it does anything to the sentence in front
of them. This spec removes the tabs and gives every option a meaning for
every sentence:

- one sentence box: Generate draws a sentence into it, and the user may
  type their own or edit the drawn one;
- passwords are always made from the sentence in the box;
- every option in the Options column applies to whatever sentence is in
  the box, drawn or the user's;
- a configuration is checked one way, by its rules, whatever sentence
  comes later.

## 2. Today

Two engines, chosen by the tab (`Mode`, `'generated' | 'sentence'`):

- **Drawing** (`generate.ts`): the planner picks a sentence shape and a
  length window that fit the rules exactly, then draws words into it.
  The bits are exact: one pick from each list, for an attacker who knows
  the tool and the settings.
- **Fitting** (`fromSentence.ts`): a sentence of any length is fitted to
  the rules: long words shrink, small words become initials or drop, and a
  short one is padded. Its bits are an estimate from the text.

An edited drawn sentence is already built by the fitting engine
(`GenerateInputs.edited`). Which settings each engine reads:

| Setting | Drawing | Fitting | Shown |
|---|---|---|---|
| Rules, comfort, swaps, random initials, glue, ease swaps | ✓ | ✓ | Options column |
| Strength target, Shortest, Leading number | ✓ | warns only (target) | Options column |
| Shorthand, Made-up nouns | ✓ | — | Options column, Style |
| Shrink words of N+ letters, shrink style | — | ✓ | Custom Sentence tab |
| Small words become a capital, Drop words | — | ✓ | Custom Sentence tab |
| Padding, Length tag, Compress toward N | — | ✓ | Custom Sentence tab |

Where the two disagree outside the engines:

- **Checking.** The web app gates on the rules alone (`ruleProblems`)
  for both tabs; `tep g` runs the full check (`problemsOf`: the rules,
  then "no sentence fits", "too few letters", "no closing symbol") when it
  draws and the rules alone with `--sentence`; the package's
  `resolveConfig` runs the full check for every configuration.
- **A kept drawn sentence** fails when the rules change under it ("The
  sentence does not fit these rules … Draw a new sentence"), where a typed
  one would be fitted.
- **Swaps the sentence cannot use** are shown disabled for a typed
  sentence only.
- **The strength panel** is "Bits: for an attacker who knows this tool"
  (exact) on one tab and "Bits for your sentence" (estimated) on the
  other.

## 3. One sentence

The sentence card holds one box. It is empty, drawn, or the user's:

- **Drawn**: Generate put it there and it has not been edited since. Its
  passwords are built by the drawing engine and its bits are exact.
- **The user's**: they typed it, or edited a drawn one. Its passwords are
  built by the fitting engine and score as the user's own sentence (the
  TODO's decision of 2026-11-03: an edited sentence shows the scores, not
  exact bits).

Two buttons beside the box:

- **New sentence** draws a sentence into the box, replacing what is there.
- **Refresh** (on the Suggestions card, as today) makes new versions of
  the sentence in the box; with the box empty it draws one first.

Undoing an edit back to the drawn text makes the sentence drawn again, as
`setEditedSentence` does today. Clearing the box and submitting draws a
new one (today it returns to the last drawn sentence; with one box there
is nothing to return to that the box does not show).

The box keeps today's limits: one line, `MAX_HINT_LENGTH` characters,
Enter submits.

## 4. Every option on every sentence

What each option does to each kind of sentence once this is built. A row
marked *new* is behaviour that does not exist today.

| Option | A drawn sentence | The user's sentence |
|---|---|---|
| Rules (lengths, letters, digits, symbols, separator) | Planned to fit (as today) | Fitted (as today) |
| Comfort, swaps, random initials, glue, ease swaps | As today | As today |
| Strength target | Chooses the plan (as today) | Warns when the estimate misses it (as today) |
| Shortest | Cuts the window to the fewest characters that reach the target (as today) | *new*: compresses toward the shortest length whose estimate reaches the target |
| Leading number | Draws a number first (as today) | *new*: a number drawn as the drawing engine draws one goes first, unless the sentence already has a number |
| Shorthand (0–3) | As today | *new*: that many random words of four or more letters are typed as their first and last consonant ("gently" → "gy"); the hint keeps the word |
| Made-up nouns (0–3) | As today | *new*: that many words found on the tool's noun list become made-up nouns of at most two key rolls; the hint shows the made-up noun, as a drawn sentence's does; a warning says when fewer nouns were found |
| Compress toward N | *new*: the window is cut to the lengths nearest N that the rules allow, and the bits are counted over that window | Fitted toward N (as today) |
| Shrink, shrink from N letters, small-word capitals, dropping | *new*: used when a drawn sentence is fitted (§5.3, §5.4) | As today |
| Padding, length tag | *new*: used when a drawn sentence is fitted (§5.3, §5.4) | As today |

A drawn sentence is planned to fit, so the fitting options in the last two
rows act on it only when it does not fit: the rules changed after it was
drawn (§5.3), or no plan fits them (§5.4). The Options column says that
under their heading rather than greying them out: they are in force, with
nothing to do.

Shortest and Compress toward N can both be set. **Compress toward N
wins** for every sentence, and Shortest shows as overridden beside it
(decision 2, §11).

## 5. The engine

### 5.1 One entry

`runInputs` takes the sentence in the box, never a mode:

```ts
interface GenerateInputs {
  req: Requirements;
  sentenceOptions: SentenceOptions;   // the fitting options, for every sentence
  mappings: readonly Mapping[];
  /** null: draw one. A drawn sentence: keep it. A string: the user's own. */
  sentence: GeneratedSentence | string | null;
}
```

`Mode`, `MODES`, `GenerationSettings.mode` and `editedSentence` go: the
web app's draft holds the box's text and the drawn sentence it came from,
and passes a string once the two differ. The outcome keeps its `source`
(`'drawn' | 'own'`), which the cards and the strength panel read.
`inputsKey` keys on the sentence in the box, so the result changes only
when the sentence or a setting does.

### 5.2 The fitting engine learns the drawing options

`fromSentence` gains leading number, shorthand, made-up nouns and Shortest
as §4 says, each a step in the order its comment lists, and each counted
in the estimate the way it already counts random initials (the choice of
which words, and what was drawn). Shorthand and made-up nouns skip the
words the uppercase and lowercase rules need, as random initials do.
Made-up nouns find nouns on the drawing engine's noun list
(`NOUNS`, `words.ts`), so only known words are replaced; a sentence with none
gets the warning, not a failure.

### 5.3 A kept drawn sentence under new rules

`keptSentence` fails today when the kept sentence cannot be built as
drawn: a number the rules now leave out or need, a shape no longer in the
window. Instead it is fitted by the fitting engine like the user's own,
with a warning: "The rules changed since this sentence was drawn, so it
was fitted like your own and its bits are estimated. Draw a new sentence
for exact bits." Its source is `'own'`. A kept sentence that still fits
as drawn is built as today.

### 5.4 When no plan fits

Today the planner refuses rules that no sentence shape fits ("No sentence
fits between 8 and 10 characters …", too few letters, no closing symbol),
and the message suggests the user's own sentence. Instead Generate draws
the nearest plan (the smallest shape over the window, or the one with the
most letters) and fits it with the fitting options, with the same warning
as §5.3 ("No sentence the tool draws fits these rules, so the nearest was
fitted and its bits are estimated."). Only when fitting also fails does
Generate fail, with the fitting engine's own reason (decision 1, §11).

So the drawing-only problems (`planProblem`: no-fit, too-few-letters,
no-closing) stop being failures of a configuration. They stay available
to say, before generating, that a drawn sentence will be fitted (§6).

## 6. Checking a configuration

One gate everywhere: the rules alone (`ruleProblems`: a value out of
range, minimum above maximum, counts over the maximum, symbols required
with none allowed, a separator the rules do not allow or that cannot be
one). These refuse a configuration in the web app, in `tep` and in the
package, whatever sentence comes later.

`planProblem` becomes a warning, on the keys it names: "Generate cannot
draw a sentence that fits these rules exactly, so it fits the nearest one
and estimates its bits." The strength-target warning (`warningsOf`) stays
a warning, and says it is about a drawn sentence. `problemsOf` goes, and
`consistency.ts` with it if nothing else uses it.

- The package's `resolveConfig` refuses on `ruleProblems` and warns on
  the rest. `generate` fails only when the sentence cannot be made to fit.
- `tep g` checks the same way with or without `--sentence`.
- The web app already gates on `ruleProblems`; it shows the drawing
  warning in the options column.

## 7. The web app

- **The sentence card** is the box with Copy and New sentence beside it,
  and "About this sentence" rewritten for one box: drawn, edited, typed,
  and which bits each shows. The tabs and `MODE_TABS` go.
- **The Options column** gains a **Fitting** card (today's
  `SentenceInput` options without the sentence field): shrink, small-word
  capitals, dropping, padding and its tag, and compress toward N, under
  the line that they act whenever a sentence does not fit as it is. It
  sits after Style.
- **Swaps** the sentence cannot use show disabled for any sentence in the
  box, drawn included.
- **The strength panel** is one panel, exact for a drawn sentence and
  estimated for the user's, its heading saying which.
- **The cards**' labels follow `source`, as today.
- **Stored state.** The draft holds `sentence` (the box's text) and
  `drawn` (the drawn sentence, or null). A session saved before this reads
  once: its open tab's sentence goes in the box (Custom's text, or
  Generated's edited text, or its drawn sentence), and the other tab's is
  dropped. The open-tab key goes, as the core spec's §6 says it will.
- **The rebuild prompt** (`src/prompts/specPrompt.ts`) describes one box.

## 8. `tep` and the package

- `tep g` draws without `--sentence` and fits the sentence with it, as
  today, under one check (§6). `--sentence` still never goes in a
  configuration. The wizard's constraints (`src/cli/constraints.ts`)
  refuse an answer only for a rule problem; an answer the planner cannot
  draw for is taken, with the drawing warning. The wizard still asks no
  fitting questions: their defaults serve, and `tep config` sets them.
- The config format does not change: version 2 still. The `sentence`
  section's seven keys keep their names and values; what changes is
  their description, "how a sentence that does not fit as it is gets
  fitted", in `config/fields.ts`, `tep config`'s comments and the
  package's `FIELDS`. The core spec's §4.2 says they apply only to a
  sentence the user wrote or edited; this spec supersedes that sentence.
- The package's `generate(settings, { sentence })` keeps its shape; a
  `DrawnSentence` the rules no longer fit comes back fitted (§5.3), with
  `bits` left out.

## 9. Documentation

README (the sentence card, the options), `docs/algorithm-flow.md` (one
entry, §5.2 to §5.4), `docs/decisions.md` (this decision and decisions 1
and 2), and the TODO item removed once built. This spec and its plan are
deleted once their decisions are in those docs.

## 10. Out of scope

- Keyboard patterns (`TODO.md`): an app mode of its own, not a sentence.
- Exact bits for the user's sentence: an edited sentence is the user's
  (2026-11-03).
- New config keys: none is needed (§8).

## 11. Decisions

Taken on 2026-11-26, the user's: one sentence box, no tabs, and every
option working on every sentence (§1, §4); and these four, each as
recommended:

1. **When no plan fits, Generate fits the nearest drawn sentence (§5.4).**
   It is the only way "every option on every sentence" holds for rules
   the planner cannot meet, and it removes the drawing-only failures.
   Rejected: today's refusal, with its message pointing at the user's own
   sentence.
2. **Compress toward N wins over Shortest when both are set (§4).** N is
   a length the user asked for; Shortest is a policy. Rejected: Shortest
   winning whenever the target is met before N.
3. **Made-up nouns in the user's sentence come from the noun list
   (§5.2).** No part-of-speech guessing and no new list. Rejected: any
   word of four or more letters, which can replace a name the user wanted
   to keep.
4. **Order of work.** §6's one check goes first, on the core package's
   branch, since it is the check the package ships with. The rest comes
   after the core package plan's P5 (the built package) and before its P6
   (the web app keeps one configuration), so P6 moves a store that has
   one sentence.
