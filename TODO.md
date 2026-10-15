# To do

## Deliberate swaps for typing ease: done, off by default

Built in `src/lib/ease.ts` (rule and table), wired through planning,
sampling, sentence mode, cold scoring, the card's "Why?" and the "Ease
awkward words with deliberate swaps" setting. Measured on 600 suggestions
at the defaults (balanced comfort, 2 swaps), 2,000 for the before/after pairs:

- 180 of the 2,242 list words have a deliberate swap; 1,351 have an awkward
  move by the keyboard model. About 31% of suggestions get at least one.
- Those passwords are 0.9 points easier on typing alone (1.7 with no random
  swaps), but each swap is one more spelling to remember, so net of memory
  load the gain is 0.2 (0.6). Over all suggestions: mean difficulty 41.4 ->
  41.3, same-finger pairs per 10 keys 0.65 -> 0.62, memorability 73.4 ->
  72.6. Not clearly better, so the setting is off by default.
- Comfort filter: ranked as typed, only 35 of the 662 words the balanced
  share drops come back (and 35 others make room). Relaxed comfort costs
  about 4 difficulty points over balanced (45.5 vs 41.4) and swaps win back
  0.6 of them, so the default stays balanced.
- The 169 words of the 2026-10-15 review: 107 were already back. Of the
  other 62, three are restored ("blazing", "bleak", "seize": their swaps put
  them inside the balanced share); no swap helps the remaining 59 enough.

Follow-ups:

- Reach more words. Most awkward moves left are cross-hand reaches the
  model charges heavily (`l-e`, `a-p`, `s-o`) and same-finger pairs no
  sound-alike spelling removes (`e-d`, `u-n`, `b-r`). A larger table that
  stays readable, or a model that rewards alternating hands, would be
  needed before turning swaps on by default or relaxing the filter.
- Sentence mode (seen while testing, not caused by this change): a sentence
  whose most compressed ladder state lacks the letters the uppercase rule
  needs is refused even when a less compressed state has them ("ducks" with
  5 capitals required). `fitLength` returns that state's problem without
  searching the less compressed ones.
