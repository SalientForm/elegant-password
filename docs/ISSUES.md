# Issues

Reviewed: 2026-11-25

Known problems and limits in what exists today. Each says how to work around it and what would fix it; an issue is
deleted once it is fixed. Ideas and planned work are not issues: they belong in [TODO.md](TODO.md) and
[ROADMAP.md](ROADMAP.md), each linked.

## My list is not kept on the shared GitHub Pages origin

- **Area:** app
- **Found:** 2026-10-20
- **Workaround:** Run the app locally (`pnpm dev`), or deploy it on a domain of its own (`PAGES_DOMAIN`, the README's
  [Deploy](../README.md#deploy)).
- **Fix:** EP-25

At https://salientform.github.io/elegant-password/ every site of the organisation can read the same storage, so My
list and the current batch stay in memory for the visit and are gone on reload (`src/state/origin.ts`). Where the list
is stored, it is localStorage in plain text.

## Copy never clears the clipboard

- **Area:** app
- **Found:** 2026-10-22
- **Workaround:** Copy something else after pasting the password.
- **Fix:** EP-19

Neither the Copy buttons nor `tep --copy` clear the clipboard, so a password stays there until something replaces it,
where clipboard history and sync can keep it (`docs/decisions.md`, "Input and persistence"; audit L16).

## Framing is refused by a script, not by a header

- **Area:** app
- **Found:** 2026-10-22
- **Workaround:** —
- **Fix:** EP-25

GitHub Pages sends no headers the app can set, and a Content-Security-Policy meta tag cannot stop another site framing
the page. The built app checks at start-up instead and, framed, mounts nothing (`src/frameGuard.ts`).

## Difficulty is scored for a physical QWERTY keyboard

- **Area:** core
- **Found:** 2026-10-20
- **Workaround:** —
- **Fix:** EP-24

The typing model assumes QWERTY on a physical keyboard. The typing test reads a soft keyboard's typing, but Difficulty
is not claimed to be reliable for phones or for other layouts.
