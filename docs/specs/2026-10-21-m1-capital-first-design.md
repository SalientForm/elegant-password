# M1: the opening capital is a word's first character

Audit checklist M1. Written 2026-10-21 at commit `b91a253`.

## 1. The problem

In generated mode the swaps are applied first and the capital placed
after (`generateOnce` in `src/lib/generate.ts`: `applyTwists`, then
`render`, which calls `applyUppercase`). The swaps keep the first
character of the first ordinary word a letter (`protectFirstLetter`),
because that is where the capital goes with Shift reach off. With Shift
reach on, `applyUppercase` moves the capital to a word whose first letter
capitalises within one hand's reach, and that word was not protected: a
swap can put a symbol or digit in front, and the capital lands on the
next letter.

Measured on 400 batches of five per setting (defaults, seeds 1-400):

| Shift reach | Swaps 1 | Swaps 2 | Swaps 3 |
| --- | --- | --- | --- |
| off | 0 % | 0 % | 0 % |
| on | 0.95 % | 1.55 % | 1.80 % |

Examples: `35;high;@Lpacaz;water;masks`, `70;gnar1y;bonnets;5Ave;twe@ds`,
`6;trim;jug6lers;0Rd4;actors`. The capital is chosen after the swaps,
so the swap can also decide which word gets it: `@corns` reads as a word
in reach (its first letter is `c`) where `acorns` would too, but a
swap that turns `bear` into `8ear` makes a word out of reach (`B`)
look like one in reach (`E`).

Sentence mode is not affected: it capitalises before the swaps
(`finish` in `src/lib/fromSentence.ts`), and swaps match lowercase
letters only.

## 2. The decision

- **The capital's word is chosen from the words as typed, before the
  swaps**, by the rule `applyUppercase` already uses (a word in reach
  first with Shift reach on, else the first eligible word). Only when one
  capital is needed and the words have none (no capital initials, no
  made-up noun in capitals).
- **The swaps keep that word's first character a letter.**
  `TwistOptions.protectFirstLetter: boolean` (the first twistable word)
  becomes `capitalAt?: number` (the word position that carries the
  opening capital). The rule at that position is the one
  `protectFirstLetter` had: a swap at the start must start with a
  lowercase letter (`ph` to `f` stays allowed).
- **The capital goes on that word**, whatever the swaps did to the
  others: `render` takes the chosen position instead of choosing again.
- **The cold scorer protects the word that carries the capital**, the
  first twistable word that starts with a capital and a lowercase letter
  (`/^[A-Z][a-z]/`), not only the first twistable word. So the bits count
  what generation can make: with Shift reach on, the word the capital
  moved to keeps its first letter, and the first word does not. The same
  holds for sentence mode, which puts the capital on a random word.

## 3. What changes for a user

- With Shift reach on, no password puts the capital after a swapped-in
  symbol or digit; the capital is always a word's first character.
- With Shift reach on, a swap may now land on the first letter of the
  first word when the capital is elsewhere (it was protected for no
  reason), and the bits figure counts it.
- With Shift reach off, a password whose first word is a two-letter form
  (`Jr wise elks`): the capital is on the two-letter form as before; the
  first whole word is no longer protected, which is what the scorer
  already counted.
- With Shift reach off and the first word ordinary, nothing changes: the
  same word is chosen and protected as before, and a seeded batch is the
  same passwords.

Not changed: sentence mode's generation, more than one capital (whole
words in capitals after the swaps, so `@CORNS` stays a word typed with
Shift held), Strength, Raw, Difficulty and Memorability (twist counts
feed only the session's bits).

## 4. Tests

- Generated mode, Shift reach on and off, swaps 1-3, many seeds: the
  opening capital is the first character of its word in every password.
- A seeded batch with Shift reach off is unchanged (the existing seeded
  tests stay green unchanged).
- `applyTwists` with `capitalAt` keeps that word's start and lets the
  others' starts be swapped.
- The cold scorer counts the start of the word with the capital as
  protected when it is not the first twistable word.

## 5. Open questions

None: the fix follows the rule the code already states (the capital is
sentence-like, on a word's first letter).
