# L17: Strength reads non-English letters as non-English

Audit checklist L17. Written 2026-10-22 at commit `c28f0f2`.

## 1. The problem

The finding (M3, 2026-10-21): in Minimal-quick mode Strength read below
the card's bits for 58 % of suggestions (median -0.5 bits, p5 -7.0; 1 % or
less in the other modes). Strength assumes an attacker who knows less than
the bits' attacker, so it should not read lower.

Since `31a31f8` no typing mode uses made-up nouns by default, so the
figure was measured again, more widely: each typing mode at its own
profile and with made-up nouns 1-3, capital initials 2-3, two-letter words
1-3, glue, and the Minimal target with "shortest" (100 seeded batches of
five per setting; script in `.claude/scratch/l17/compare.test.ts`). Two
references: the card's bits, and the exact figure, the plan's bits plus
the card's swap bits when that is lower. The card's bits ignore the
length window (`docs/algorithm-flow.md`, section 4), and "shortest" cuts
it to the fewest characters that reach the target, so with it on the card
overstates what the attacker who knows the tool needs.

Strength below the bits, before the change:

| Setting | Ten-finger | Two-finger | One-handed | Minimal-quick |
| --- | --- | --- | --- | --- |
| own profile (no made-up noun) | 1.2 % (worst -2.9) | 0.2 % | 0 % | 1.0 % (0 % below exact) |
| made-up nouns 1 | 8.4 % (-6.6) | 0.8 % | 1.2 % | 51.6 % (0 % below exact) |
| made-up nouns 2 (3 the same: at these targets the sentences have two nouns) | 38.7 % (-10.4) | 1.0 % | 2.0 % | 100 % (0 % below exact) |
| two-letter words 3 | 5.0 % (-4.0) | 0 % | 0 % | 0 % |
| Minimal + shortest | 59.4 % (0 % below exact) | 1.6 % (0 %) | 1.8 % (0 %) | as its profile |
| Minimal + shortest, made-up 2 | 100 % (0 % below exact) | 32 % (0 %) | 32 % (0 %) | as made-up 2 |

Capital initials and glue: 0.6 % or less, within 2 bits.

## 2. What Strength undercounts

Three causes, read off the passwords that fall below (examples in the
scratch scripts' output):

1. **The card's bits in "shortest" plans** (Minimal-quick, and the
   Minimal target with shortest in any mode). Strength is never below the
   exact figure there, in any mode or setting measured; the gap is the
   card's figure counting the whole length range. Not Strength's to fix.
2. **Letters with no vowel read as English.** Strength reads every run of
   letters as English-like text at 2.3 bits a letter. A made-up noun is a
   key roll (`bvsd`, `HJK`, `DFHJ`, `hjktr`), a two-letter word is a
   word's first and last consonants (`Sr`, `ht`, `Fn`); neither is
   English, and English words have a vowel. The sign that this is an
   undercount, not chance: over the whole made-up noun list Strength
   averaged 13.25 bits against the tool's pick of log2 14,666 = 13.84. An
   attacker who does not know the tool cannot do better on average than
   one who does, so a reading below the pick on average is too generous to
   the attacker. The two-letter lists: Strength 4.70 bits for every form
   against picks of 4.8 to 7.8.
3. **Uniform picks from lists that mix short and long strings.** The tool
   picks a made-up noun as one of 14,666 whether it is `iuy` or
   `qwerasdf`, a number as one of 69 whether it is `7` or `47`, and counts
   a swap by where it landed even when it leaves the text as long
   (`bikes` as `bykez`). An attacker who does not know the tool tries
   short strings first, so for these Strength's lower figure is the honest
   one: raising it would mean pricing every short string as if it came
   from the tool's longest list.

Capitals are not a cause: a run in capitals adds one bit, and the tool's
list holds each made-up noun in lower case and in capitals, one bit too.

## 3. Options considered

- **Floor Strength at the bits or at the tool's lists.** Breaks the rule:
  the bits need the session, and Strength must not know this tool's lists.
- **An English dictionary**, reading any letter run not in it as random.
  Strength has no word lists by design, and it is a large new dataset.
- **A table of letter pairs English never uses** (built from zxcvbn's
  English Wikipedia list, as `common.ts` is built from SecLists). Measured:
  it flags 25 to 48 % of the made-up nouns that have a vowel, and 0.1 to
  0.2 % of English words (`halfway`, `briefcase`, `pyjamas`, `pumpkins`),
  which would then read too high: overstating is the worse error in a
  strength meter. A new data file and generator for a residue that only
  made-up nouns, an option the user chooses, reach. Not now.
- **A higher English rate for short words** (a count of English words by
  length). Needs that count, raises every short word, and does not touch
  key rolls with a vowel.
- **Read three-letter walks everywhere.** Lowers Strength; English has
  three-letter steps (`rst`, `nop`), which is why walks start at four.
- **Chosen: English words have a vowel.** Generic (a fact about English,
  not about this tool), small, and it reads higher only strings that are
  not English.

## 4. The decision

A run of letters is **not English** when it has two or more Latin letters
and none of a, e, i, o, u, y (`isNotEnglish` in `src/lib/strength.ts`).
Such a run reads as the fewer of two readings, and never below its English
reading:

- **consonants**: each letter one pick of 20 (`CONSONANT_CHOICES`), and a
  keyboard or alphabet walk of three letters or more in it one pick of
  1,000. Three, not four: the reason to wait for four is that English has
  three-letter steps, and this run is not English.
- **an English word with one letter changed**: its English reading plus
  log2 of its length (which letter) plus log2 26 (what it was), so a
  misspelling that removed the only vowel (`fqrns` for `ferns`) is not
  read as random letters.

Plus one bit for a capital, as before.

**A run that may be part of a swapped word keeps the English reading**:
one beside a digit, beside one of `@ ! |` (they often stand for a vowel),
or beside a symbol typed only once in the password with a letter on its
far side (`knig#ts`). A separator goes between every two words, so a
symbol typed more than once is taken for one, and the runs beside it are
read on their own. Without this, `dr1lls` would read `dr` and `ls` as
consonants, 9 bits more for one common swap.

## 5. What changes

After the change (same batches):

| Setting | Ten-finger | Two-finger | One-handed | Minimal-quick |
| --- | --- | --- | --- | --- |
| own profile | 1.2 % (unchanged) | 0 % | 0 % | 1.0 % (0 % below exact) |
| made-up nouns 1 | 3.2 % (-3.2) | 0 % | 0.2 % | 32.8 % (0 % below exact) |
| made-up nouns 2 | 16.5 % (-10.4) | 1.0 % | 0 % | 84.2 % (0 % below exact) |
| two-letter words 3 | 0.2 % (-0.0) | 0 % | 0 % | 0 % |
| Minimal + shortest, made-up 2 | 100 % (0 % below exact) | 0.2 % (0 %) | 2.6 % (0 %) | as made-up 2 |

Over the made-up noun list Strength now averages 14.92 bits (pick 13.84);
over the two-letter lists 7.2 to 7.8 (picks 4.8 to 7.8).

Strength's colour bands (high / fair / low):

- **Defaults (ten-finger)**: unchanged, 100 % high (p5/50/95 56/66/74);
  Strength changes for 0.2 % of cards (two-letter forms the length rule
  made).
- **Two-finger**: 99.2 % to 99.8 % high (36 % of cards change: its
  two-letter word). **One-handed**: 100 % high, unchanged (30 % change).
  **Minimal-quick**: unchanged (0.6 / 87.6 / 11.8 %), no card changes.
- With made-up nouns 2: ten-finger 68.6 / 31.1 / 0.2 to 85.6 / 14.4 / 0;
  two-finger 25 / 72 / 3 to 62.4 / 36.6 / 1.0; one-handed 19 / 76 / 5 to
  52.6 / 47.4 / 0; Minimal-quick 0 / 43.2 / 56.8 to 1.0 / 62.6 / 36.4.
- With two-letter words 3: ten-finger 87.8 % to 99.0 % high;
  Minimal-quick 0 / 0 / 100 to 0 / 53.2 / 46.8.

Walks still read low: `qwertyuiop` 11.0, `asdfasdfasdf` 11.6, `zxcvbnm`
7.8, `qazwsx` 7.8, `mnbvcxz` 10.1 (all unchanged); `bvc` 6.9 to 10.0,
`HJK` 7.9 to 11.0. Unchanged: `Password1!`, `Tr0ub4dor&3`, `dr1lls`,
`Sm@rt`, `rhythm`, `correct horse battery staple`.

**The residue**, and why it stays:

- *Shortest plans*: below the card's bits, never below the exact figure
  (cause 1). The card's bits not knowing the length window is documented
  in the algorithm flow; the user may want it revisited (section 7).
- *Made-up nouns with a vowel*, outside shortest (ten-finger 3.2 % and
  16.5 %, other modes 1 % or less): `cviu`, `fdyu`, `OIFD` look like
  English letters to an attacker without a dictionary (cause 3, and
  option "letter pairs" above).
- *Everything else*, 1.2 % or less, within 3 bits: swaps the bits count by
  position that leave the text as long, and doubled letters cut to one
  (`Pretty` read as `Prety`).

Text that states Strength's rules says the new one, with its figures read
from the core (`VOWELS`, `CONSONANT_CHOICES`, `MIN_CONSONANT_WALK`,
`VOWEL_STAND_INS`): the Scoring page, the Fun page's app prompt
(`src/prompts/specPrompt.ts`), the README and the algorithm flow's table;
a dated bullet in `docs/decisions.md`, Scoring. "A swap never changes a
word's strength" becomes "a swap changes a word's strength only through
what the text shows". The bits, Raw, Difficulty and Memorability do not
change; Strength still uses no list, table or setting of this app.

## 6. Tests

- Unit (`src/lib/strength.test.ts`): runs with no vowel read as consonants
  (`bvsd`, `HJK`, `ht`, `CVB`), walks of three in them one pick; the
  one-letter-changed reading caps a misspelling (`fqrns`); the exemptions
  (`dr1lls`, `Sm@rt`, `1nk`, `knig#ts`, a separator typed twice does not
  exempt); y counts as a vowel (`rhythm`, `fly`); another script is
  unchanged; a run never reads below its English reading (random strings);
  the walks and trivial passwords still read low.
- Over the made-up noun list: Strength's mean is at least the pick (it was
  below).
- Seeded batches (property style): in every shortest plan, with and
  without made-up nouns, Strength is never below the exact figure; in
  every mode and shape without made-up nouns, outside shortest, Strength
  is below the card's bits for at most 2 % of cards and never by more than
  3 bits.
- The existing suite stays green (`pnpm test`); `pnpm test:titles`.

## 7. Open questions

- Whether a card's bits in a shortest plan should be capped at the plan's
  exact figure plus its swap bits. A change to the bits, not to Strength,
  so not part of L17.
