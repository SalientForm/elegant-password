// What a link made by pnpm link:cli points to, and whether a link is one.
// Shared by scripts/linkCli.mjs (Node runs this TypeScript as it is) and
// tep uninstall, so the two cannot disagree about what is tep's to replace
// or remove: only a link to a checkout's built tep.

/** The built executable, relative to a checkout. */
export const BUILT_TEP = 'dist-cli/tep.mjs';

/** Whether a symlink's target is a checkout's built tep. */
export const isTepLink = (target: string): boolean => target === BUILT_TEP || target.endsWith(`/${BUILT_TEP}`);
