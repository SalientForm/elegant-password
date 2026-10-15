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
  const bits = (await first.locator('.bits-label').textContent())!.replace(/[^0-9]/g, '');
  await first.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Added', exact: true })).toBeDisabled();
  const list = page.getByRole('list', { name: 'My passwords' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(shown[0]!);
  await expect(list).toContainText('Hint:');
  await expect(list.locator('.bits-label')).toContainText(bits);

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

  await page.getByLabel('Your sentence').fill(SENTENCE);
  await expect(applyBar(page)).toBeVisible();
  await page.keyboard.press('Control+Enter');
  await expect(applyBar(page)).toHaveCount(0);
  const mine = await settledPasswords(page);
  await openWhy(page);
  await expect(cards(page).first()).toContainText(SENTENCE);
  expect(mine.length).toBeGreaterThan(0);

  await page.reload();
  expect(await settledPasswords(page)).toEqual(mine);
  await expect(page.getByLabel('Your sentence')).toHaveValue(SENTENCE);
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
  const count = page.getByLabel('Suggestions');
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
  await page.getByLabel('Your sentence').fill('Hi there');
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
  const field = page.getByLabel('Password to test');
  await field.click();
  await field.pressSequentially('Sleepy;otterx', { delay: 20 });
  await page.keyboard.press('Backspace');
  await field.pressSequentially('s', { delay: 20 });
  await page.keyboard.press('Enter');
  const status = page.locator('.typing-result');
  await expect(status).toContainText('Testing: Sleepy;otters');
  await expect(status).toContainText('Typed correctly');
  await expect(status).toContainText('1 correction');
  await expect(status).toContainText('bits');
  await expect(status).toContainText('Difficulty');
  await page.getByLabel('Lock password').check();
  await field.pressSequentially('Sleepy;otter', { delay: 10 });
  await page.keyboard.press('Enter');
  await expect(status).toContainText('Did not match');
  await expect(status).toContainText('Testing: Sleepy;otters');
});

test('orders suggestions easiest first by default and strongest first on request', async ({ page }) => {
  await settledPasswords(page);
  const difficulties = async () => (await page.locator('article.card .badge.difficulty').allTextContents()).map((t) => Number(t.match(/\d+/)![0]));
  await expect(cards(page).first().locator('.badge.memorability')).toHaveText(/^M \d+$/);
  await expect(cards(page).first().locator('.badge.difficulty')).toHaveAttribute('title', /^Difficulty \d+, /);
  const easy = await difficulties();
  expect([...easy].sort((a, b) => a - b)).toEqual(easy);
  await page.getByRole('button', { name: 'Strongest first', exact: true }).click();
  const bits = (await page.locator('article.card .bits-label').allTextContents()).map((t) => Number(t.match(/\d+/)![0]));
  expect([...bits].sort((a, b) => b - a)).toEqual(bits);
  await page.reload();
  await settledPasswords(page);
  await expect(page.getByRole('button', { name: 'Strongest first', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the Scoring page explains bits and shows the rubric', async ({ page }) => {
  await page.getByRole('link', { name: 'Scoring' }).click();
  await expect(page.getByRole('heading', { name: 'Strength, in bits' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await expect(page.getByText('Finger rolls')).toBeVisible();
  await page.getByRole('link', { name: 'Passwords' }).click();
  await expect(cards(page).first()).toBeVisible();
});
