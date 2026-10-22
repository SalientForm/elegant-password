# Plan: L7 and L9 (spec `docs/specs/2026-10-22-l7-l9-build-deploy-design.md`)

1. **Frame guard.** `src/frameGuard.ts`: `isFramed(win)`, `refusesFrame(prod, win)`,
   `showFramedNotice(root, href)`; `src/frameGuard.test.ts`. `src/main.tsx` checks
   before `installScrollbars` and `createRoot`. `.framed-notice` in `src/styles.css`.
   `pnpm typecheck`, `pnpm test`. Commit.
2. **Smoke test.** A framing page served by `page.route` on `http://framer.test/`;
   built: notice, no app, link opens the app in a new page; dev: the framed app renders.
   `pnpm test:titles`; `flock /tmp/ep-e2e.lock pnpm test:e2e`. Commit with step 1 or after.
3. **Reusable check workflow.** `.github/workflows/check.yml`; `ci.yml` and `pages.yml`
   call it. `src/workflows.test.ts` parses the three and checks the calls, `needs: check`,
   and the permissions. `pnpm test:titles`, `pnpm test`. Commit.
4. **Documentation.** README (Deploy, Use, Layout), `docs/decisions.md` (Build and deploy),
   `TODO.md` (Protect the saved list: the header). Commit.
5. **Fold and close.** Delete the spec and this plan; rows L7 and L9 `built`, naming the
   decisions' place and the commits. `pnpm typecheck`, `pnpm test`, `pnpm build`, e2e via
   flock. Commit.
