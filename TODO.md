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
