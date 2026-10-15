// Smoke tests for the UI in a real browser, against the production build and
// the dev server (see playwright.config.ts). Each test gets a fresh browser
// context, so storage starts empty. Any console error fails the test.

import { expect, test as base, type Page } from '@playwright/test';

const SENTENCE = 'Sally eats sweets on Sundays';

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

const cards = (page: Page) => page.locator('article.card');
const passwords = (page: Page) => page.locator('article.card .password').allTextContents();
const applyBar = (page: Page) => page.getByRole('region', { name: 'Unapplied changes' });

/** The passwords on screen once a batch has settled: the same set a moment later and no "Working…". */
async function settledPasswords(page: Page): Promise<string[]> {
  await expect(cards(page).first()).toBeVisible();
  await expect(page.locator('.batch.stale')).toHaveCount(0); // the batch on screen was made from the applied inputs
  await expect(page.getByRole('status').filter({ hasText: 'Working' })).toHaveCount(0);
  return passwords(page);
}
const openWhy = (page: Page) => cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads a batch of passwords that pass their checks, and is never stuck working', async ({ page }, info) => {
  await expect(cards(page)).toHaveCount(5);
  await expect(page.getByRole('status').filter({ hasText: 'Working' })).toHaveCount(0);
  // Every "Why?" starts closed; open the first: every rule is met.
  await expect(page.getByText('Fast to type')).toHaveCount(0);
  await openWhy(page);
  await expect(cards(page).first().getByRole('heading', { name: /^Memorability: \d+ \/ 100$/ })).toBeVisible();
  await expect(cards(page).first().locator('.checks li.unmet')).toHaveCount(0);
  await expect(cards(page).first().locator('.checks li.met').first()).toBeVisible();
  // The built page carries the Content-Security-Policy; the dev server cannot (hot reloading needs inline scripts).
  const csp = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(csp).toHaveCount(info.project.name === 'built' ? 1 : 0);
  await expect(page.getByRole('list', { name: 'My passwords' })).toHaveCount(0);
  await expect(page.getByText('Nothing yet')).toBeVisible();
});

test('edits are a draft until applied; applying saves, regenerates, and survives a reload', async ({ page }) => {
  const before = await settledPasswords(page);
  await expect(applyBar(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await expect(applyBar(page)).toBeVisible();
  expect(await passwords(page)).toEqual(before); // nothing regenerated
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).not.toBe('strict');

  await applyBar(page).getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Strict', exact: true })).toHaveAttribute('aria-pressed', 'false');

  // Escape discards too, and plain Enter submits.
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await page.getByRole('heading', { name: 'Suggestions' }).click();
  await page.keyboard.press('Escape');
  await expect(applyBar(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await page.getByRole('heading', { name: 'Suggestions' }).click();
  await page.keyboard.press('Enter');
  await expect(applyBar(page)).toHaveCount(0);
  await expect.poll(async () => passwords(page)).not.toEqual(before);
  const applied = await settledPasswords(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).toBe('strict');

  await page.reload();
  expect(await settledPasswords(page)).toEqual(applied);
  await expect(page.getByRole('button', { name: 'Strict', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(applyBar(page)).toHaveCount(0);
});

test('"Refresh" rolls a fresh batch and applies any draft', async ({ page }) => {
  const before = await settledPasswords(page);
  await page.getByRole('button', { name: 'Relaxed', exact: true }).click();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect.poll(async () => passwords(page)).not.toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).toBe('relaxed');
});

test('adds a password to my list, scores it the same, and keeps the list across a reload', async ({ page }) => {
  const shown = await settledPasswords(page);
  const first = cards(page).first();
  const bits = (await first.locator('.badge.strength').textContent())!.replace(/[^0-9]/g, '');
  await first.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Added', exact: true })).toBeDisabled();
  const list = page.getByRole('list', { name: 'My passwords' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(shown[0]!);
  await expect(list).toContainText('Hint:');
  await expect(list.locator('.badge.strength')).toHaveText(`S ${bits}`);
  // The password just added is now the one under test, hint and all three badges included.
  const practice = page.locator('.typing-result');
  await expect(practice).toContainText(`Testing: ${shown[0]}`);
  await expect(practice).toContainText('Hint:');
  await expect(practice.locator('.badge.strength')).toHaveText(`S ${bits}`);
  await expect(practice.locator('.badge.memorability')).toHaveText(/^M \d+$/);

  await page.reload();
  expect(await settledPasswords(page)).toEqual(shown);
  await expect(page.getByRole('list', { name: 'My passwords' }).getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: /^Remove .* from my list$/ }).click();
  await expect(page.getByText('Nothing yet')).toBeVisible();
});

test('turns my own sentence into passwords, applied with Ctrl+Enter, and keeps them across a reload', async ({ page }) => {
  await settledPasswords(page);
  await page.getByRole('tab', { name: 'Make up a sentence' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Use my sentence' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Type a sentence to turn into a password, then apply it.')).toBeVisible();

  await page.getByLabel('Your sentence', { exact: true }).fill(SENTENCE);
  await expect(applyBar(page)).toBeVisible();
  await page.keyboard.press('Control+Enter');
  await expect(applyBar(page)).toHaveCount(0);
  const mine = await settledPasswords(page);
  await openWhy(page);
  await expect(cards(page).first()).toContainText(SENTENCE);
  expect(mine.length).toBeGreaterThan(0);

  await page.reload();
  expect(await settledPasswords(page)).toEqual(mine);
  await expect(page.getByLabel('Your sentence', { exact: true })).toHaveValue(SENTENCE);
  await expect(page.getByRole('tab', { name: 'Use my sentence' })).toHaveAttribute('aria-selected', 'true');
});

test('copies a password with the Copy button or by clicking the password itself', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const shown = await settledPasswords(page);
  await cards(page).first().getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(cards(page).first().getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown[0]);
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await cards(page).nth(1).locator('.password').click();
  await expect(page.locator('.copy-bubble')).toHaveText('Copied!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown[1]);
  await expect(page.locator('.copy-bubble')).toHaveCount(0, { timeout: 4000 }); // gone after two seconds
});

test('number fields can be typed through and apply as a draft', async ({ page }) => {
  await settledPasswords(page);
  const count = page.getByLabel('Suggestions', { exact: true });
  await count.click();
  await count.fill('');
  await count.pressSequentially('10');
  await expect(count).toHaveValue('10');
  await expect(applyBar(page)).toBeVisible();
  await applyBar(page).getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(cards(page)).toHaveCount(10);
});

test('the Fun page shows the spec and downloads it', async ({ page }) => {
  await page.getByRole('link', { name: 'Fun' }).click();
  await expect(page.getByText('Build "Elegant Passwords"')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('elegant-passwords-spec.md');
  await page.getByRole('link', { name: 'Passwords' }).click();
  await expect(cards(page).first()).toBeVisible(); // state survived the visit
});

test('pads a short sentence to the minimum with a length tag that states the length', async ({ page }) => {
  await settledPasswords(page);
  await page.getByRole('tab', { name: 'Use my sentence' }).click();
  await page.getByLabel('Your sentence', { exact: true }).fill('Hi there');
  await page.keyboard.press('Enter'); // Enter in the sentence field submits at once
  const mine = await settledPasswords(page);
  await openWhy(page);
  await expect(cards(page).first()).toContainText('padded to the 12-character minimum');
  for (const p of mine) {
    expect(p.length).toBe(12);
    expect(p).toMatch(/%12$/);
  }
});

test('tests a typed password in the masthead: speed, corrections, strength, and the lock', async ({ page }) => {
  const field = page.getByLabel('Test and practice', { exact: true });
  await field.click();
  await field.pressSequentially('Sleepy;otterx', { delay: 20 });
  await page.keyboard.press('Backspace');
  await field.pressSequentially('s', { delay: 20 });
  await page.keyboard.press('Enter');
  const status = page.locator('.typing-result');
  await expect(status).toContainText('Testing: Sleepy;otters');
  await expect(status).toContainText('Typed correctly');
  await expect(status).toContainText('1 correction');
  await expect(status).toContainText('Hint: (hint n/a)'); // typed by hand: no hint
  await expect(status.locator('.badge.strength')).toHaveText(/^S \d+$/);
  await expect(status.locator('.badge.difficulty')).toHaveText(/^D \d+$/);
  await expect(status.locator('.badge.memorability')).toHaveText('M n/a');
  await page.getByLabel('Lock password', { exact: true }).check();
  await field.pressSequentially('Sleepy;otter', { delay: 10 });
  await page.keyboard.press('Enter');
  await expect(status).toContainText('Did not match');
  await expect(status).toContainText('Testing: Sleepy;otters');
});

test('orders suggestions by difficulty by default, and by strength or memorability on request', async ({ page }) => {
  await settledPasswords(page);
  const numbers = async (badge: string) => (await page.locator(`article.card .badge.${badge}`).allTextContents()).map((t) => Number(t.match(/\d+/)![0]));
  await expect(cards(page).first().locator('.badge.memorability')).toHaveText(/^M \d+$/);
  await cards(page).first().locator('.badge.difficulty').hover();
  await expect(page.getByRole('tooltip')).toHaveText(/^Difficulty \d+, /); // at once, the app's own tip
  await page.mouse.move(0, 0);
  const easy = await numbers('difficulty');
  expect([...easy].sort((a, b) => a - b)).toEqual(easy);
  await page.getByRole('button', { name: 'Strength', exact: true }).click();
  const bits = await numbers('strength');
  expect([...bits].sort((a, b) => b - a)).toEqual(bits);
  await page.getByRole('button', { name: 'Memorability', exact: true }).click();
  const memo = await numbers('memorability');
  expect([...memo].sort((a, b) => b - a)).toEqual(memo);
  await page.reload();
  await settledPasswords(page);
  await expect(page.getByRole('button', { name: 'Memorability', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the Scoring page explains bits and shows the rubric', async ({ page }) => {
  await page.getByRole('link', { name: 'Scoring' }).click();
  await expect(page.getByRole('heading', { name: 'Strength, in bits' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await expect(page.getByText('Finger rolls')).toBeVisible();
  await page.getByRole('link', { name: 'Passwords' }).click();
  await expect(cards(page).first()).toBeVisible();
});

test('the header scrolls away first, then each column scrolls on its own', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await settledPasswords(page);
  // Make the middle column taller than the viewport by opening a card, then start from the very top.
  await openWhy(page);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('main > *')) el.scrollTop = 0;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
  const state = () =>
    page.evaluate(() => {
      const top = (sel: string) => document.querySelector<HTMLElement>(sel)!.scrollTop;
      const main = document.querySelector('main')!;
      const stickyTop = parseFloat(getComputedStyle(main.firstElementChild!).top) || 0;
      return { pageY: window.scrollY, left: top('main > .sidebar'), middle: top('main > .results'), right: top('main > .aside'), stop: main.getBoundingClientRect().top + window.scrollY - stickyTop };
    });
  const start = await state();
  expect(start.pageY).toBe(0);
  // Wheel over the middle column: the page moves first, the header scrolls up, the columns do not scroll yet.
  const middle = page.locator('main > .results');
  await middle.hover();
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(150);
  const afterOne = await state();
  expect(afterOne.pageY).toBeGreaterThan(0);
  expect(afterOne.pageY).toBeLessThanOrEqual(Math.ceil(start.stop)); // the page stops where the columns stick (whole pixels)
  expect(afterOne.middle).toBe(0);
  // Keep going: once the header is gone, only the middle column scrolls, and the others stay put.
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 200);
  await page.waitForTimeout(200);
  const afterMany = await state();
  expect(Math.abs(afterMany.pageY - start.stop)).toBeLessThanOrEqual(1);
  expect(afterMany.middle).toBeGreaterThan(0);
  expect(afterMany.left).toBe(0);
  expect(afterMany.right).toBe(0);
  // Scrolling the left column moves only the left column, and never past its own content.
  await page.locator('main > .sidebar').hover();
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 300);
  await page.waitForTimeout(200);
  const left = await state();
  expect(left.left).toBeGreaterThan(0);
  expect(left.middle).toBe(afterMany.middle);
  const maxLeft = await page.evaluate(() => { const el = document.querySelector<HTMLElement>('main > .sidebar')!; return el.scrollHeight - el.clientHeight; });
  expect(left.left).toBeLessThanOrEqual(maxLeft);
  expect(Math.abs(left.pageY - start.stop)).toBeLessThanOrEqual(1); // the page itself goes no further
  // The end of a column is reachable: its last content is fully inside the box once scrolled to the max.
  const reach = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('main > .sidebar')!;
    el.scrollTop = el.scrollHeight;
    const last = el.querySelector<HTMLElement>('.panel:last-of-type')!;
    return { bottom: last.getBoundingClientRect().bottom, box: el.getBoundingClientRect().bottom };
  });
  expect(reach.bottom).toBeLessThanOrEqual(reach.box + 1);
});
