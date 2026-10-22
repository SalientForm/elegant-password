# L1 and L4: "3 of the following 4" kept as three named kinds; the pasted rules read once and capped

Status: **accepted**, 2026-10-22 (the user authorised building on this
recommendation). Acts on L1 and L4 of
`docs/audits/2026-10-21-audit-checklist.md`, grouped there as "both the
pasted rules". Line numbers at `c28f0f2`.

## 1. The problems

### 1.1 L1: a choice of kinds is read as all of them

The site's rules are per-class minimums (`minUppercase`, `minLowercase`,
`minDigits`, `minSymbols`), so the app cannot say "any 3 of these 4".
`parseRuleText` (`src/lib/ruleText.ts:265`, `ownPolarity`, and the
neighbour pass under it) gives every class a "must" it takes from its
neighbours, so a choice becomes all four, and the form says it
understood all four. Measured at `c28f0f2`:

| Text | Read as |
| --- | --- |
| At least 3 of the following 4: uppercase, lowercase, numbers, symbols | all four required |
| Include characters from at least three of these categories: (four bullets) | all four required |
| Your password must contain at least 3 of the following: (four "A ..." bullets) | all four required |
| Must be 8-64 characters and contain three of the following: uppercase letters, lowercase letters, numbers, and symbols | 8-64, all four required |
| Use at least two of: letters, numbers, symbols | a digit and a symbol |
| At least one uppercase, one lowercase, and one number or symbol | all four required |
| include at least one number or symbol | a digit and a symbol |
| Must contain any 3 of: A-Z, a-z, 0-9, !@#$% | a symbol from !@#$% only |
| 3 of 4 character types | nothing |

Requiring every kind does make passwords the site accepts, but it says
something the site did not ask, costs the user a symbol they did not need
(the hardest kind to type on most keyboards and modes), and a test
(`ruleText.test.ts`, "requiring each one satisfies it") fixed the wrong
reading in place.

### 1.2 L4: the box re-reads on every render, and takes any length

`SiteRules` calls `parseRuleText(text)` in its body
(`src/components/SiteRules.tsx:58`), so every render reads the text again,
including the renders a fill causes (the form's `value` changes, so the
memoised component renders once more for the same text). A paste reads it
twice more. The textarea (`:100`) has no `maxLength`, and `tep --rules`
and the wizard's paste take any length.

Measured at `c28f0f2` (Node 24, the development desktop, best of 2-5
runs; `.claude/scratch/l1/measure.test.ts`), the cost is linear to
mildly quadratic and small:

| Characters | A checklist, repeated | One line of class words, no sentence ends | Random ASCII | Random rule words |
| --- | --- | --- | --- | --- |
| 512 | 0.6 ms | 0.6 ms | 0.0 ms | 0.4 ms |
| 2,048 | 1.0 ms | 2.3 ms | 0.1 ms | 0.8 ms |
| 8,192 | 4.1 ms | 12.8 ms | 0.2 ms | 3.7 ms |
| 65,536 | 34 ms | 192 ms | 1.7 ms | 56 ms |

So the cap is not needed for speed at any real length; it bounds the work
(a pasted book is 1 MB) and keeps the box to what a sign-up page shows.

## 2. The decisions

### 2.1 L1: a choice of N kinds is kept as N named kinds

**A rule that asks for N of a list of kinds is kept by requiring N
specific kinds from that list, and the understood text names them.**
Every password then meets the site's rule; nothing else is claimed. Not
taken: requiring every kind (says what the site did not ask, and costs a
symbol); reporting the rule as not kept (the tool can keep it, so
refusing would make `tep --rules` fail on the most common rule on the
web); a new "N of M" field in `Requirements` (the generator, the
validation, the checks, the CLI fields, the config file and both forms
for one rule a choice of minimums already meets).

**Which kinds are kept**, in order, deterministic and from the text alone:

1. Letters, when listed: every password is built from words, so they are
   always met and set nothing.
2. Kinds the text requires anyway ("must include a symbol" elsewhere),
   or that an earlier choice in the same text kept: already met.
3. Then the cheapest to type: a lowercase letter, an uppercase letter, a
   digit, a symbol. A lowercase letter costs nothing (the words are
   lowercase), a capital is one shift, a digit is the number row, a
   symbol is usually a shifted reach and the one the modes avoid.

A kind the text rules out is never chosen ("letters and numbers only",
"no special characters" for symbols; "no digits" and the like for the
others, which are already named as not kept). The form's own settings are
not consulted: the reading is the text's, so the preview and `tep` say
the same thing for the same words. A kind not kept is left as the form
had it (a symbol the user already requires stays required; it still
meets the rule).

**What is said**: one line for the rule, naming what was asked and what
was kept:

- N of 2 or more: "at least 3 of uppercase, lowercase, digits and
  symbols (kept as an uppercase letter, a lowercase letter and a digit)".
- N = 1: "a digit or a symbol (kept as a digit)".
- A member with its own count keeps it: "at least 2 digits" in the list
  is kept as "2 digits".
- Kinds the choice keeps get no line of their own; a kind the text also
  requires elsewhere keeps its own line.
- A choice met by letters alone ("a letter or a number") sets nothing, so
  it says nothing, as for any text that changes nothing.

**What is not kept is said** (in `unsupported`, so the web lists it under
"Not kept" and `tep` refuses it), and nothing of that rule is applied:

- Fewer kinds recognised than N ("at least 3 of the kinds listed: this
  tool recognised only uppercase and digits"), including none.
- Fewer than N left once the text's own exclusions are taken out ("at
  least 3 of uppercase, lowercase and symbols: the text rules out
  symbols").
- A count of kinds with no list, of other than 4 ("at least 3 of 5
  kinds: the text does not name them").

**N equal to the kinds listed is all of them**: "2 of the following:
uppercase, digits" requires both, said as now, one line each.

### 2.2 L1: the phrasings read as a choice

A choice opens with a count of kinds, after the length patterns have
taken their numbers:

- "N of", "N out of M", "any N of", "N or more of", "at least / a
  minimum of N of", each optionally followed by "the", "these",
  "following", "listed", M, and a class word ("categories", "character
  types", "classes", "sets", "groups", "kinds").
- "N (different) character types / classes / categories / sets" without
  "of".
- Not "one of each" (all of them), and not "one of" a single kind ("one
  of !@#$%", "at least one of the following symbols: ! @ #"): a choice
  needs N of 2 or more, or N = 1 over two or more kinds.

Its members are, in the same clause after the count, the class mentions
up to the first that says "no", "optional" or "at most". When the clause
holds none after the count and ends in a colon or says "following" or
"below", the members are the lines under it (bullets, ticks, a numbered
list), up to the first non-blank line with no class mention, or with a
"no", "optional" or "at most", or until M kinds are in. With no list at
all, and a class word with M absent or 4 ("3 of 4 character types",
"characters from 3 character classes"), the members are the usual four:
uppercase, lowercase, digits, symbols, and the line names them.

**"Or" between kinds is a choice of one**: two or more required mentions
joined only by "or" (or "and/or"), as in "at least one number or symbol",
"a capital or a digit", "uppercase, lowercase, and one number or symbol"
(the first two stay required, the pair is a choice). A "no" before them
is untouched ("no spaces or symbols" rules both out, as now).

**"A-Z", "a-z" and "0-9" name the kinds** (uppercase, lowercase, digits)
when they stand alone, so "any 3 of: A-Z, a-z, 0-9, !@#$%" reads as a
choice of four. Read before the text is lowercased, so the case tells
"A-Z" from "a-z".

A symbol list inside a choice ("special characters (!@#$%^&*)") still
sets the allowed symbols, as everywhere; one given as examples ("for
example, !, $, #, %") describes the kind and sets nothing.

### 2.3 L4: read once per text

- `SiteRules` reads the text in a `useMemo` on the text, so a render
  without a new text reads nothing.
- The paste's fill and the preview share one reading: a one-entry memo of
  the last text read (the parser is pure, so the entry is always right).
  A paste is one reading; "Fill in" on previewed text is none.
- The reading is `timed` ("Reading the pasted rules"): work over 2 s
  shows the floating error, as every other piece of the page's work.

### 2.4 L4: a cap of 2,000 characters, defined once in the core

- `MAX_RULES_TEXT_LENGTH = 2000` in `src/lib/ruleText.ts`, UTF-16 code
  units as every other field. Four times a hint (512), since a copied
  sign-up form carries labels, headings and advice around its rules; the
  longest real rules text in the tests is about 330 characters. At the
  cap the worst measured reading is about 2.3 ms on a desktop (§1.2), so
  a phone several times slower is still far inside the 2 s line.
- `rulesTextLengthProblem(text)` gives the one message both front ends
  use: "The rules text is 5300 characters; 2000 is the most this tool
  reads. Copy just the password rules." `parseRuleText` itself returns
  nothing but a not-kept line for longer text, so no route reads an
  unbounded text.
- **Web**: the textarea has `maxLength`, so typing stops at the cap, and
  a hint says the box is full when it is. A paste that would take the
  text past the cap is refused (the text stays as it was, nothing is
  filled in) and the status says why, in the error colour, until the text
  changes. Refused rather than cut: a cut paste would fill in the rules
  from its first part and drop the rest, and the one "nothing is quietly
  weakened" rule of the box would then rest on the user reading a note.
- **tep**: `--rules` past the cap is a usage error (exit 2) with that
  message; the wizard's paste prompt refuses it in its validation, with
  that message, and asks again.
- The cap is stated by interpolation wherever it is named: the README,
  `docs/decisions.md`, the Fun page's spec and CLI prompts, `tep`'s flag
  description, the web hint.

## 3. Tests

- `ruleText.test.ts`: each wording in §1.1 and §2.2 as a case (rules,
  understood, unsupported), the old "requiring each one" case corrected,
  the "a number or symbol" case corrected; a property that a choice never
  sets every listed kind when N is fewer; the cap and its message.
- `SiteRules.test.tsx` (new): one reading per text across renders and a
  fill; a paste past the cap refused with the message; `maxLength` set;
  the full-box hint.
- `RequirementsForm.test.tsx`: a pasted "3 of 4" fills in three kinds and
  says so.
- CLI: `generate.test.ts` / `resolve.test.ts` for `--rules` with a choice
  and past the cap; `wizard.test.ts` for the paste prompt's refusal.
- e2e: the smoke suite does not cover the paste box; one smoke test is
  added for what jsdom cannot show (a real paste fills in a "3 of 4"
  text; `maxLength` holds in the browser).
