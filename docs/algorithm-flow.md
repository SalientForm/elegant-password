# Algorithm flow: from site rules to a password

How Elegant Passwords turns a set of requirements into a password, where each
criterion is enforced, and how a password is scored afterwards. The code is
the source of truth; this is the map. Generic criteria (anything of the form
"at least N of class X", or "between A and B long") are handled by one
mechanism each. Specific criteria (the separator, pinky stretches, initials,
two-letter words, made-up nouns, glue, deliberate and random swaps) each have
their own step.

## 1. The criteria

| Criterion | Kind | Where it is enforced |
| --- | --- | --- |
| Length between min and max | generic (range) | Planning: the length model counts only word sequences whose letters plus separators and closing marks fit. Swaps are limited to a length window. Sentence mode compresses to the target; a sentence under the minimum is padded (section 3) and anything still outside the range is refused. |
| At least N uppercase letters | generic (class count) | Planning never picks a shape with fewer letters than N; swaps keep at least N letters; rendering capitalises the first letter (N = 1) or whole words (N ≥ 2). Capital initials and ALL-CAPS made-up nouns count first. |
| At least N digits | generic (class count) | Generated: the number has N digits. Sentence: digit swaps first (`e→3`, `for→4`), then a comfortable N-digit number is appended. |
| At least N symbols | generic (class count) | Symbol separators count; the shortfall is symbol swaps (sentence mode, a random number of them up to three) or a closing symbol drawn at random for each password from the allowed comfortable set (never the separator), repeated. |
| Only these symbols, spaces or not | generic (alphabet) | Every symbol the tool picks on its own (separator, closing mark, swap output) is filtered by the allowed set; closing marks and swap outputs are never the separator character, since a password never starts or ends with its separator (when the separator is the only allowed symbol and marks are needed, the request is refused). A separator chosen by hand must be allowed or the request is rejected. |
| Separator | specific | `auto` → space if allowed, else the first allowed and comfortable of `; . - , _`, else none. A chosen separator is honoured even if it is a stretch. |
| Avoid pinky stretches | specific | Symbols more than one key from a pinky's home are removed from the set the tool may pick from (swap outputs, closing marks, automatic separator). If every allowed symbol is a stretch, one is used and a warning says so. |
| Typing comfort | specific | Each word pool (and the number pool) is ranked by typing cost and cut to the easiest 40 / 70 / 100 %. With deliberate swaps on, words are ranked as typed with their swap. |
| Deliberate swaps (typing ease) | specific | Off by default. A whole word with a same-finger jump or a reach of 6+ key widths is typed with one fixed sound-alike misspelling that removes it (`wise` → `wyse`, `ease.ts`). A fixed function of the word: 0 bits. Planning counts words at their typed length with unchanged pool sizes; letters only, so the separator and symbol rules never meet it; sentence mode swaps the words still whole unless that leaves too few letters for the uppercase rule. |
| Target bits | specific | Among templates that reach the target, the shortest expected length wins; otherwise the strongest, with a warning. |
| Number | specific | Placed in front of a random noun phrase; the position is counted as bits. |
| Capital initials | specific | Fixed-priority positions become one capital letter; the slot's pool becomes its distinct initials, so the count stays exact. Never swapped. |
| Two-letter words | specific | Fixed-priority positions become first letter + last consonant; pool becomes distinct pairs. Never swapped. |
| Made-up nouns | specific | The first N noun slots draw from the key-roll words (all lowercase or ALL CAPS). Never swapped, never recased. |
| Glue | specific | The number and small-word initials attach to the next word without a separator; the separator count drops accordingly. |
| Swaps (twists) | specific | Exactly N where the letters allow, placed uniformly among every distinct outcome inside the length and letter limits, on the words as typed (deliberate swaps included); fewer with a warning when they do not. |
| Count | generic | Each suggestion is an independent draw. |

## 2. Make up a sentence

```mermaid
flowchart TD
  A[Requirements] --> B[validate: ranges, counts, whole numbers]
  B --> C[resolve separator and closing mark\nallowed set ∩ comfortable set]
  C --> D{for each template × number placement}
  D --> E[shape: initials, two-letter, made-up, glue positions]
  E --> F[overhead = separators + closing marks\nletters must fit min−overhead … max−overhead]
  F --> G{enough letters\nfor the uppercase rule?}
  G -- no --> D
  G -- yes --> H[LengthModel: count sequences by total letters,\nwords as typed with deliberate swaps when on\nbits = log2 Σ counts]
  H --> I[choose plan: meets target → shortest;\nelse strongest + warning]
  I --> J[sample variant ∝ count, total length ∝ count,\nword lengths ∝ completions, word uniform;\nthe hint keeps each word as written]
  J --> K[swaps: skip number, initials, two-letter, made-up;\nkeep the first letter; stay in the length window;\nkeep enough letters; pick uniformly among outcomes]
  K --> L[render: capitals, glue, separator, closing marks]
  L --> M[cold score from password + hint]
  M --> N[checks: every rule ✓/✗, warnings]
```

Why planning before sampling: the entropy must be known exactly, so the set
of possible passwords is counted first and the password is then drawn
uniformly from exactly that set. Fixed rules (which positions become
initials, how capitals are applied, the separator, deliberate swaps) add no
bits and are not random. A deliberate swap is a function of its word, no two
list words share a swapped spelling, and the model counts each word at its
typed length, so the count stays exact with them on.

## 3. Use my sentence

```mermaid
flowchart TD
  A[Sentence] --> B[normalise: strip accents, lowercase,\nremove apostrophes, split on non a-z0-9]
  B --> C[tokens: word / number / small word]
  C --> D[small words → capital initials;\nN random words → initials\nkeeping enough letters for the uppercase rule]
  D --> E[shrink long words: drop vowels or first + last]
  E --> F[compression ladder: one small change per step\nvowels → interior letters → long numbers → drop small words\n→ longest word to initial → drop shortest piece]
  F --> G[binary search the ladder for the least-compressed\nstate whose finished password fits the target]
  G --> H[finish a state: deliberate swaps on whole words;\ncapitalise a random word;\ndigits by swaps or a number in front or at the end;\nsymbols by separators, some swaps, a closing symbol drawn per password;\nrandom swaps in the length window; glue and join]
  H --> I{fits min…target?}
  I -- too long even when fully compressed --> J[explain: use fewer words or raise the maximum]
  I -- too short at the start --> K[back off: keep long words whole,\nthen fewer random initials]
  K -- still short --> P[pad, planned once:\nword if > 3 short → repeated digit/symbol\n→ digit run → closing marks → length tag last\n%N = whole length, @N divides the length before it]
  P --> L
  I -- yes --> L[cold score from password + sentence]
```

Padding is arithmetic, not trial: a total tag's number is the one N with
N = length + 1 + digits(N), so 47 characters get `%50` and 48 get `%51`;
a factor tag picks the smallest divisor of the length to its left. The
filler before the tag is sized to land exactly on the minimum.

The ladder is monotone: every step shortens the bare text, so the first
state that fits is found with log₂(states) finishes instead of one per
state. Each state is finished once; the result is reused.

## 4. Scoring a password cold

A password is scored from two strings only: the password and its hint. No
setting, count, or history goes in, so the same password scores the same
everywhere it appears (a card, the saved list, a year later).

```mermaid
flowchart TD
  A[password + hint] --> B[normalise the hint into words]
  B --> C[align each word in the password:\nwhole, deliberately swapped, shortened, initial, number,\nor randomly swapped spelling, deliberate winning a tie;\nstep over one separator when nothing matches in place]
  C --> C2[repeated digits or symbols count as the\nsame word; a length tag's digits are a number word]
  C2 --> D{hint matches a\nsentence template?}
  D -- yes --> E[most restrictive comfort level whose pools\ncontain every word, pools ranked as written or as typed,\nfewer bits kept → pool sizes →\nsentence bits = Σ log2 sizes + number position]
  D -- no --> F[sentence bits = 0;\ninitial-choice bits = log2 C(eligible words, initials)]
  E --> G[swap bits = log2 of the distinct outcomes\nfor exactly the random swaps found;\ndeliberate swaps 0 bits]
  F --> G
  G --> H[difficulty rubric on the password,\nmemory load = words + random and deliberate swaps]
```

What it deliberately leaves out: the length limits (not knowable cold, so the
card can sit a little above the plan's exact figure), the user's own mapping
list (always the built-in 64; deliberate swaps follow their own fixed table),
whether deliberate swaps were on (both comfort rankings are tried and the
lower figure kept), and any selection bias. Choosing a favourite
among suggestions, or rolling again until one is liked, is a bias the figures
do not discount; the strength panel says so in one sentence.

## 5. When the flow runs

Edits are a draft. The flow above runs when the draft is applied (the
floating "Submit changes" bar, Ctrl+Enter, or "Refresh", which applies
and rolls), and once on load if the stored batch was not made from the
applied inputs. Applied inputs are persisted; drafts are not.

## 6. Guarantees that tests hold

- Every generated password passes every check across random requirement
  combinations (`generate.test.ts`), including uppercase rules with
  initials, two-letter words and letter-removing swaps.
- Any sentence with a letter reduces to 12 characters that pass every rule
  (`reduceTo12.test.ts`).
- Swap counts are exact and sampling is uniform; a word never vanishes;
  enough letters always remain (`twists.test.ts`).
- Cold scores are pure, serialisable, and agree with what the cards show
  (`score.test.ts`, `generate.test.ts`).
- Deliberate swaps only ever remove an awkward move, keep the first letter,
  never merge two words, are recognised cold at zero bits and never read as
  random swaps, and keep the plan's count equal to a brute-force count over
  the typed lengths (`ease.test.ts`, `score.test.ts`, `generate.test.ts`).
