# To do

## Deliberate swaps for typing ease

Every easy-to-remember word is valid, however awkward it is to type. Instead
of filtering hard words out, the generator should be able to make them easier
on the way to the final password with deliberate swaps: changes picked
because they replace an awkward key sequence, not at random.

- Example: a word with a long reach or a same-finger jump gets a swap that
  removes it (a misspelling or a mapping whose output sits on an easier
  path), keeping the word recognisable.
- Deliberate swaps are chosen by a fixed rule, so they add no strength and
  must not be counted as bits (unlike today's random swaps).
- Once this exists, revisit the comfort filter, which currently drops the
  hardest 30% of each list by default, and the 2026-10-15 word review that
  removed 169 hard, uncommon words. Those words could come back.
- Not started: the current algorithm is unchanged.
