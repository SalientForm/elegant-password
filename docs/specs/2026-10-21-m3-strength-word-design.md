# Strength's word names its band, not a preset

Status: **proposed**, 2026-10-21. Acts on item M3 of
`docs/audits/2026-10-21-audit-checklist.md`. Line numbers are at commit
`b9b5e65` on `feature/audit-medium`.

## 1. The problem

The Strength badge's tip reads "Strength 67 bits, very strong: for an
attacker who knows English and the usual habits but not this tool; from
the password alone". The word comes from `strengthWord`
(`src/lib/readings.ts:18-23`), which names the highest strength preset
the figure reaches (`STRENGTH_PRESETS`, `src/lib/generate.ts:161-167`):
everyday (40), strong (50), very strong (60), master password (72), or
"weak" below 40.

The presets are targets for the bits: the figure for an attacker who
knows this tool exactly. Each carries a use ("Password manager or disk
encryption" for Master password), and the Scoring page's "Time to guess"
table times them "for an attacker who knows the tool". Strength assumes
an attacker who knows less, so it reads higher, by design. Measuring it
on the bits' ladder tells a user who chose Everyday that most of what
they were given suits a password manager.

How it came about: on 2026-10-15 (`15933f4`) the Strength badge was the
bits figure, and the preset words fitted it. On 2026-10-20 (`d9af54e`)
Strength became its own score, from the password alone, and the bits
moved beside the badges; the word was carried over unchanged.

### 1.1 Strength above bits is expected

Confirmed in the code and the docs. `strengthBits`
(`src/lib/strength.ts`) reads letters as English-like text at 2.3 bits
each and knows no word list, sentence pattern or swap table; the bits
(`scoreCold` with the session's swaps, `src/lib/score.ts`) count only the
tool's random choices. `docs/decisions.md` ("A score is a pure function
of the password") and the algorithm flow §4 table give the three
attackers; the bits panel already says the badges assume an attacker who
does not know the tool. The figure is right. What is wrong is the word
put beside it.

### 1.2 Measured

Generated mode, the built-in swaps, random draws; 1,000 suggestions at
the defaults, 500 for each other row; scratch script under
`.claude/scratch/m3/`. "Bits" is each card's dim figure; "plan" is the
bits panel's exact figure.

| Settings | Plan, median | Card bits, median | Strength p5 / median / p95 | Word today | Band |
| --- | --- | --- | --- | --- | --- |
| Defaults (ten-finger, Everyday 40) | 42.7 | 52.3 | 58 / 67 / 76 | very strong 71 %, master password 21 %, strong 9 %, everyday 0.3 % | green 99.7 % |
| Ten-finger, Strong 50 | 48.5 | 61.3 | 63 / 70 / 77 | very strong 66 %, master password 34 % | green 100 % |
| Ten-finger, Master password 72 | 48.5 | 61.2 | 62 / 70 / 76 | very strong 66 %, master password 33 %, strong 1 % | green 100 % |
| Two-finger mode | 42.1 | 44.1 | 49 / 57 / 64 | strong 67 %, very strong 26 %, everyday 7 % | green 93 % |
| One-handed mode | 43.1 | 48.2 | 51 / 60 / 70 | strong 48 %, very strong 48 %, master password 3 %, everyday 2 % | green 98 % |
| Minimal-quick mode (Minimal 4) | 20.1 | 38.4 | 35 / 36 / 42 | weak 63 %, everyday 37 % | red 63 % |

The audit's wording overstates it: at HEAD not every default password
reads "master password", one in five does, and seven in ten read "very
strong", a preset 20 bits above the one chosen. Its "plan of 52" is the
card's bits figure (median 52.3); the plan proper is 42.7. The point
stands: 99.8 % of default suggestions are named a preset above the one
chosen, and 37 % of default batches of five (400 measured) show at least
one "master password", 23 % two or more, since a batch shares its
sentence.

Strength minus the card's bits, at the median: 14.0 bits ten-finger, 11.2
two-finger, 11.2 one-handed, -0.5 Minimal-quick (§6).

## 2. The decision

### 2.1 The word follows the colour band

The badge already has three bands, decided 2026-10-20 and recorded in
`docs/decisions.md`: green from 50 bits, yellow from 40, red below
(`STRENGTH_BANDS`, `src/lib/score.ts:423`). The word becomes the band's
word, so the tip says in words what the colour shows, and nothing more:

| Band | Figure as shown | Word |
| --- | --- | --- |
| green (`high`) | 50 or more | high |
| yellow (`mid`) | 40 to 49 | fair |
| red (`low`) | below 40 | low |

`strengthWord(bits)` stays, with that name and signature, and returns
`STRENGTH_WORDS[strengthLevel(bits)]`; `STRENGTH_WORDS` is exported from
`readings.ts` so the Scoring page and the Fun page's spec prompt print
the same three words. Word and colour cannot disagree, since one is read
off the other, and both are judged on the rounded figure as today.

`readings.ts` no longer imports `STRENGTH_PRESETS`, so it stops
importing `generate.ts` at all.

The words are chosen to clash with no other vocabulary on the page: not
the presets' (Everyday, Strong, Very strong, Master password), not
zxcvbn's (very weak, weak, good, strong), not Difficulty's (Effortless,
Easy, Moderate, Demanding, Hard). §7 leaves the wording to the user.

### 2.2 The Scoring page states the bands by number

`src/components/ScoringPage.tsx:54-56` says the badge "is green from the
Strong preset at 50 bits, yellow from Everyday at 40". It becomes "The
badge is green from 50 bits, yellow from 40 and red below, judged on the
figure as shown; its tip says high, fair or low. The presets below are
targets for the bits, not Strength readings." The thresholds do not move.

## 3. Alternatives rejected

- **Keep the preset words and qualify them** ("very strong, for an
  attacker who does not know this tool"). The words still carry the
  presets' uses, and the tip grows longer to say less.
- **A ladder of its own for Strength**, five words at thresholds chosen
  for its attacker. Nothing calibrates them; it would be a second scale
  invented to look like the first.
- **Words from the bits, or Strength relative to the target.** The bits
  need the session and the target is a setting; the user's rule is that
  Strength comes from the password alone, the same everywhere and a year
  later.
- **No word at all**, as Memorability's tip has none. Simpler, and the
  figure stays. Rejected as the recommendation because the badge is an
  image to a screen reader whose name is the whole reading: without a
  word, the band (red in particular, in the typing test) is colour alone.
  It is the user's alternative in §7.
- **zxcvbn's words**, or "strong / fair / weak". "Strong" is a preset
  and zxcvbn's top word; the same word on two badges with different
  meanings is the problem this item fixes.
- **Moving the bands** so the defaults are not all green. The bands are a
  recorded decision, a badge's green means 50 bits or more; this item is
  about the word only.

## 4. What users see change

- Every Strength tip, on a card, in My list and in the typing test:
  "Strength 67 bits, high: …", "Strength 45 bits, fair: …", "Strength 36
  bits, low: …". The rest of the sentence is unchanged.
- The badge's accessible name, which is that sentence.
- `tep g --format json`: `readings.strength` carries the new word. The
  table prints figures only and does not change.
- The Scoring page sentence of §2.2.
- The Fun page's spec prompt: the tip example at `specPrompt.ts:283` and
  the target-bits note at `:90`.

Nothing stored changes: My list saves the password, hint and zxcvbn
reading, and the readings are worked out when shown.

## 5. Deliberately not changed

- The Strength figure, its model, and the bands' thresholds (50 and 40).
- The presets, their labels, hints and bits, the CLI's `--strength`
  names, and the "Time to guess" table.
- The bits panel and its green ("meets your target").
- Memorability's tip, which has a band and no word.
- The zxcvbn badge.

## 6. Found on the way, not this item

In Minimal-quick mode Strength is below the card's bits for 58 % of
suggestions (median -0.5 bits, p5 -7.0): for that mode's short
made-up nouns and capitals, reading letters at 2.3 bits each gives less
than the tool's own pick from its list. It is 1 % or less in the other
three modes. Strength is meant to assume less knowledge than the bits,
so it should not read lower. Offered to the lead for the checklist as a
Low; it does not affect the word.

## 7. The price

- Less resolution in the tip: green is one word where it was three
  (strong, very strong, master password). The figure carries the
  resolution, and those words were the misleading part.
- Every test that matches the old words changes (§8).

## 8. Tests that prove it

- `src/lib/readings.test.ts`, "strength badge": "is green from 50 bits,
  yellow from 40, red below, and says high, fair or low" (the band
  boundaries 72, 50, 49, 40, 39, 4 with their words); new, "names its band
  and never a preset, at every figure from 0 to 256" (for each integer,
  `strengthWord` is `STRENGTH_WORDS[strengthLevel(n)]` and is not any
  preset label in lower case).
- `src/lib/readings.test.ts`, "score readings": the two sentences that
  carry a word, "fair" at 49 and "high" at 50.
- `src/components/SuggestionCard.test.tsx:79` and
  `src/components/SelectedList.test.tsx:44`: the tip matches
  `(high|fair|low)`.
- `src/App.test.tsx`, "has a Scoring page with the rubric and the bits
  explanation, …": the page says the tip reads high, fair or low.

## 9. Open questions

1. **The three words.** Recommended: high, fair, low, as designed here.
   Alternatives: no word (§3), or the band's numbers ("50 or more").
   Wording of a label is the user's.
2. **The Scoring page sentence of §2.2**, which drops "the Strong
   preset" and "Everyday" from the band description and says the presets
   are targets for the bits. Recommended: yes, so nothing on the page
   reads Strength on the presets' ladder.
3. **§6 as a new checklist row.** Recommended: add it as a Low (the lead's
   call, not this item's).
