#!/usr/bin/env node
/**
 * Opens every page of the workspace in a browser and prints what went wrong on each: an error in the console, an
 * error the page threw, a request that failed, a page with no main region or heading, or the Not found page. §5 of
 * the onboarding runs it against the dev server and against the preview, each already running:
 *
 *   node <skillsDir>/wayfinder-onboard/scripts/walk-pages.mjs http://127.0.0.1:<port>/   (the base path included)
 *
 * The pages are the workspace's own (`workspace.validPaths`), read from the app through Vite, so a page the workspace
 * gains is walked without a list kept by hand. The app is the folder of the root package.json's `wayfinder.config`
 * (`<app>/src/workspace.config.mts`), as the onboarding lays it out.
 *
 * It drives Chromium through the repository's own Playwright (`playwright` or `@playwright/test`), which the kit does
 * not install. Exits 0 when every page is clean, 1 on a problem, and 2 when it cannot walk (no Playwright, no
 * browser, no server at the URL): then it lists the pages to open by hand.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRepo, repoRoot } from '@salientform/workspace-wayfinder/check/index.mjs';

const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base)) {
  console.error('usage: walk-pages.mjs <url of the running workspace, its base path included>');
  process.exit(2);
}
const require = createRequire(path.join(repoRoot, 'package.json'));

/** The repository's own copy of `name`, imported, or undefined when it has none. */
async function repositoryPackage(name) {
  try {
    return await import(pathToFileURL(require.resolve(name)).href);
  } catch {
    return undefined;
  }
}

/** The workspace's valid paths, from its app through a Vite server that serves nothing. */
async function workspacePaths() {
  const config = JSON.parse(readRepo('package.json')).wayfinder?.config;
  if (typeof config !== 'string') throw new Error('package.json has no wayfinder.config');
  const app = path.join(repoRoot, path.dirname(path.dirname(config)));
  const vite = await repositoryPackage('vite');
  if (!vite) throw new Error('the repository has no vite');
  const server = await vite.createServer({
    configFile: path.join(app, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    // The kit's modules import the `virtual:` ones its plugins serve: Vite has to transform them, not node load them.
    ssr: { noExternal: ['@salientform/workspace-wayfinder'] },
    logLevel: 'error',
  });
  try {
    const { workspace } = await server.ssrLoadModule('/src/workspace.tsx');
    return [...workspace.validPaths].sort();
  } finally {
    await server.close();
  }
}

/** By hand: the URLs to open, and why the script could not. */
function unwalked(reason, urls) {
  console.error(`not walked: ${reason}`);
  console.error(`open each of these ${urls.length} pages yourself, with the browser's console open:`);
  for (const url of urls) console.error(`  ${url}`);
  process.exit(2);
}

const root = base.endsWith('/') ? base : `${base}/`;
const urls = (await workspacePaths()).map((p) => new URL(p.replace(/^\//, ''), root).href);
// Either package's CommonJS module arrives as `default` when imported.
const loaded = [await repositoryPackage('playwright'), await repositoryPackage('@playwright/test')];
const playwright = loaded.map((m) => (m?.chromium ? m : m?.default)).find((m) => m?.chromium);
if (!playwright) unwalked('the repository has no Playwright (`playwright` or `@playwright/test`)', urls);

let browser;
try {
  browser = await playwright.chromium.launch();
} catch (error) {
  unwalked(`Chromium did not start (${error.message.split('\n')[0]}); \`npx playwright install chromium\` installs it`, urls);
}
const page = await browser.newPage();
const problems = [];
let current = '';
page.on('console', (m) => m.type() === 'error' && problems.push(`${current}: console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`${current}: page error: ${e.message}`));
page.on('requestfailed', (r) => problems.push(`${current}: request failed: ${r.url()} (${r.failure()?.errorText})`));
try {
  for (const url of urls) {
    current = url;
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
    } catch (error) {
      if (url === urls[0]) unwalked(`${url} did not load (${error.message.split('\n')[0]}): is the server running?`, urls);
      problems.push(`${url}: did not load: ${error.message.split('\n')[0]}`);
      continue;
    }
    const main = page.locator('main');
    if (!(await main.isVisible())) problems.push(`${url}: no main region`);
    else if (!(await main.getByRole('heading').first().isVisible())) problems.push(`${url}: no heading`);
    if ((await main.getByText(/matches this address/).count()) > 0) problems.push(`${url}: the Not found page`);
  }
} finally {
  await browser.close();
}
if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problem(s) on ${urls.length} pages`);
  process.exit(1);
}
console.log(`pages OK — ${urls.length} pages at ${root}, no console error, page error or failed request`);
