/**
 * The hooks of Elegant Passwords for the Workspace Wayfinder checks, named by the root package.json `wayfinder.hooks`: what the
 * checks cannot read for themselves from the product's code, and any checks of its own. Every export is optional; each
 * hook receives { settings, repoRoot, readRepo, exists }.
 *
 * The web app has no router library: src/App.tsx switches between three pages on the location's hash (`#/`,
 * `#/scoring`, `#/fun`), listed once in its `PAGES` table, which also draws the header's navigation. Inside the
 * Passwords page, `COLUMNS` are the three sections (tabs on a phone) and `MODE_TABS` the two ways to make the sentence.
 */

const APP = 'src/App.tsx';

/** The `{ …, label: '…' }` rows of the array constant `name` in src/App.tsx, in source order. */
function rowsOf(source, name) {
  const table = source.match(new RegExp(`const ${name}\\b[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!table) throw new Error(`${APP}: no ${name} table, which workspace.hooks.mjs reads`);
  return [...table[1].matchAll(/\{([^}]*)\}/g)].map(([, row]) => ({
    href: row.match(/href:\s*'([^']*)'/)?.[1],
    label: row.match(/label:\s*'([^']*)'/)?.[1],
  }));
}

/** A hash link (`#/scoring`) as the route path the page serves (`/scoring`). */
const routeOf = (href) => href.replace(/^#/, '') || '/';

/**
 * The product's routes and its navigation's paths: the hash pages of `PAGES`, which are both. The assess-features
 * skill builds the route mirror (settings.productRoutes) from them, and the check keeps the two equal.
 */
export function productRoutes({ readRepo }) {
  const paths = rowsOf(readRepo(APP), 'PAGES').map((row) => routeOf(row.href));
  return { routes: paths, sidebar: paths, source: APP };
}

/**
 * The product's navigation labels, which some Platform Docs page should mention: the header's pages, the Passwords
 * page's sections and its two sentence modes.
 */
export function navLabels({ readRepo }) {
  const source = readRepo(APP);
  return ['PAGES', 'COLUMNS', 'MODE_TABS'].flatMap((name) => rowsOf(source, name).map((row) => row.label));
}
