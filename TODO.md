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
- Done (2026-10-15, with the rule-contradiction work): sentence mode no
  longer refuses a sentence whose most compressed ladder state lacks the
  letters for the uppercase rule ("ducks" with 5 capitals) or the separators
  for the symbol rule; `fitLength` steps back past such states and searches
  the ones before.

## Future considerations

Not planned yet; kept here so they are not lost. Roughly smallest first.

### Keyboard layouts, and phones

The typing model assumes QWERTY on a physical keyboard. Add Dvorak, Colemak,
AZERTY and QWERTZ. More distinctive is a phone keyboard model: there the cost
is not reach but switching layers (letters, numbers, symbols, Shift), so a
"typed mostly on a phone" setting would favour passwords that stay on the
letter layer and group digits and symbols together.

### Protect the saved list

My list keeps passwords in localStorage in plain text. Offer to encrypt it
with a passphrase (WebCrypto: PBKDF2 or Argon2 to AES-GCM), or a "hints
only" mode that keeps the sentence and drops the password. Scoring is
unaffected either way: it already needs only the password and hint.

### Recall practice

The typing test measures typing, not memory. A spaced-repetition drill would
show the hint, ask for the password, and schedule the next try further out
after each success (a day, three days, a week), all stored locally. It aims
at the real failure: forgetting the password, not mistyping it.

### Offline and installable

Everything already runs in the browser. A service worker and manifest make it
installable and usable offline, which turns "never sent anywhere" from a
promise into something a user can check by switching the network off.

### Browser extension

Read a site's rules from the `passwordrules` attribute or Apple's public
password-rules quirks list, suggest a password that fits, and fill it in.
Cold scoring already depends only on the password and hint, so the engine
needs no changes to run there.

### Other languages

Word lists in other languages, paired with their keyboard layouts (Spanish
on Spanish QWERTY, German on QWERTZ). The grammar, comfort model and padding
all assume English today, so this is real work, but it would show the design
generalises.

### Master password mode

A separate flow for the one password typed every day (a password manager's,
a laptop's): longer sentences, 70 bits or more, and recall practice built in,
since this is the password people actually forget.
