# L7 and L9: the built app refuses a frame; one check workflow

Audit items L7 and L9 of `docs/audits/2026-10-21-audit-checklist.md`,
grouped on 2026-10-22 (build and deploy). The user authorised building on
the recommendation below.

## 1. L7: the Pages site can be framed

### 1.1 The finding

The Content-Security-Policy is a meta tag (`build/csp.ts`), because GitHub
Pages sends no response headers the app can set. Browsers ignore
`frame-ancestors` and `X-Frame-Options` in a meta tag, so any site can put
the deployed app in an iframe and lay its own page over it (clickjacking:
a button that seems to be the attacker's is the app's Copy, or the typing
test reads what the user types into a field they think is someone else's).

### 1.2 Decision

- **The built app refuses to run in a frame.** At start-up, before React
  is created, `src/frameGuard.ts` checks whether the page is framed
  (`window.top !== window.self`; an access that throws counts as framed).
  If it is, no app is mounted: the root holds only a short notice and a
  link that opens the app in a tab of its own.
- **Production build only**, as the CSP is (`import.meta.env.PROD`). The
  dev server stays frameable: preview panes frame it. `pnpm preview` serves
  the production build, so it refuses frames too.
- **The check lives in the bundle**, in `src/main.tsx`'s first statement
  that renders anything: the CSP forbids inline scripts, so it cannot be an
  inline `<script>` in `index.html`. The modules `main.tsx` imports are
  evaluated first (ES modules evaluate their imports before the importer),
  but none of them renders, reads storage or starts generation at import;
  the provider does all of that, and the provider is never mounted.
- **The notice is built with the DOM, not React, and not static markup in
  `index.html`.** Static markup would show to every visitor until a script
  hid it, or be hidden until a script showed it: a script is needed either
  way, and a visitor without scripts sees no app in either case, framed or
  not (the app is all script). Rendering it with React would create a root
  and pull the notice into the component tree for one paragraph and a
  link. `document.createElement` and `textContent` need nothing the CSP
  forbids (no `innerHTML`, no inline style: the look is a class in
  `src/styles.css`).
- **The link opens a new tab** (`target="_blank"`, `rel="noopener
  noreferrer"`) at the app's own address (`location.href`). `_top` would
  navigate the framing page away, which a sandboxed frame without
  `allow-top-navigation-by-user-activation` blocks; a new tab works in more
  frames, shows the app's real address in its own bar, and `noopener`
  leaves the new tab no handle on the page that framed it. A sandbox
  without `allow-popups` blocks the tab too; the notice says the address,
  so it can be typed.
- **Wording**: a heading "Elegant Passwords opens in its own tab", a
  sentence "This page has put it inside another site's page, where what you
  type and copy could be watched or covered. It runs only on its own." and
  the link "Open Elegant Passwords in a new tab", then the address as
  text ("Or go to …").
- **The proper fix is a header.** Once the app is on a host that sends
  headers, it sends `Content-Security-Policy: frame-ancestors 'none'` (and
  may drop the script check). Recorded in `TODO.md` where the move to a
  domain of its own is described ("Protect the saved list"): a custom
  domain on GitHub Pages still cannot send headers, so the move alone does
  not fix it.

### 1.3 Tests

- Unit (`src/frameGuard.test.ts`, jsdom): `isFramed` is false at the top,
  true when `top` differs, true when reading `top` throws;
  `refusesFrame(prod)` is false outside production even when framed;
  `showFramedNotice` replaces the root's content with the heading, the
  sentence, the address and the link (its `href`, `target` and `rel`).
- Smoke (`e2e/smoke.spec.ts`, both projects): a framing page on an origin
  of its own, served by Playwright's request interception
  (`page.route('http://framer.test/**')`, so no server and no port), holds
  an iframe pointing at the app. On `built` the frame shows the notice and
  no app (no header, no cards), and its link opens the app in a new page
  that renders a batch. On `dev` the framed app renders a batch. The
  framing page is cross-origin, as a clickjacking page would be.
- No new port: interception needs none.

## 2. L9: the check job is copy-pasted

### 2.1 Decision

- **One reusable workflow, `.github/workflows/check.yml`** (`on:
  workflow_call`), holding the `check` job exactly as it was: Ubuntu, 30
  minute limit, checkout, pnpm from `packageManager`, Node 24 with the pnpm
  cache, frozen install, typecheck, unit tests, the CLI build, the
  Playwright Chromium install with its system packages, the browser suite,
  and the report uploaded on failure.
- **`ci.yml` and `pages.yml` call it** (`jobs.check.uses:
  ./.github/workflows/check.yml`). `ci.yml` keeps its triggers,
  permissions and concurrency; `pages.yml` keeps its `build` job's `needs:
  check` and the deploy after it.
- **Permissions**: a called workflow's token can only be narrowed from the
  caller's. `pages.yml`'s calling job sets `contents: read` (its workflow
  grants `pages: write` and `id-token: write` for the deploy), and
  `check.yml`'s job sets `contents: read` too, so the check never holds
  more than reading the repository, whoever calls it.
- **No concurrency in `check.yml`**: the callers own it, and a group in the
  called workflow would be shared between them.
- **The job's name in the checks list becomes `check / check`** (caller
  job, then the called job). A branch protection rule requiring `check`
  would need the new name.
- **Validation**: the three files parse as YAML and the callers name the
  called file (a unit test, `src/workflows.test.ts`, so a later edit that
  copies the job back or drops `needs: check` fails). `actionlint` is not
  available offline here. A workflow cannot run locally; the first push
  shows whether it runs.

## 3. Documentation

When built: README "Deploy" and "Use" say what the workflows and the build
now do; `docs/decisions.md` "Build and deploy" replaces the bullet that the
meta tag "cannot carry `frame-ancestors`" with the frame decision, and
states the one check workflow; `TODO.md` gains the header. Then this spec
and its plan are deleted and rows L7 and L9 are set to `built`.
