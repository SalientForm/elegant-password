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
  await expect(page.getByRole('status').filter({ hasText: 'Working' })).toHaveCount(0);
  return passwords(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads a batch of passwords that pass their checks, and is never stuck working', async ({ page }, info) => {
  await expect(cards(page)).toHaveCount(5);
  await expect(page.getByRole('status').filter({ hasText: 'Working' })).toHaveCount(0);
  // The first card's "Why?" is open; every rule is met.
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

  await page.getByRole('button', { name: 'Strict' }).click();
  await expect(applyBar(page)).toBeVisible();
  expect(await passwords(page)).toEqual(before); // nothing regenerated
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).not.toBe('strict');

  await applyBar(page).getByRole('button', { name: 'Discard' }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Strict' })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Strict' }).click();
  await applyBar(page).getByRole('button', { name: 'Apply changes' }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect.poll(async () => passwords(page)).not.toEqual(before);
  const applied = await settledPasswords(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).toBe('strict');

  await page.reload();
  expect(await settledPasswords(page)).toEqual(applied);
  await expect(page.getByRole('button', { name: 'Strict' })).toHaveAttribute('aria-pressed', 'true');
  await expect(applyBar(page)).toHaveCount(0);
});

test('"New passwords" rolls a fresh batch and applies any draft', async ({ page }) => {
  const before = await settledPasswords(page);
  await page.getByRole('button', { name: 'Relaxed' }).click();
  await page.getByRole('button', { name: 'New passwords' }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect.poll(async () => passwords(page)).not.toEqual(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}').comfort)).toBe('relaxed');
});

test('adds a password to my list, scores it the same, and keeps the list across a reload', async ({ page }) => {
  const shown = await settledPasswords(page);
  const first = cards(page).first();
  const bits = (await first.locator('.bits-label').textContent())!.replace(/[^0-9]/g, '');
  await first.getByRole('button', { name: 'Add to my list' }).click();
  await expect(first.getByRole('button', { name: 'In my list' })).toBeDisabled();
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
  await expect(cards(page).first()).toContainText(SENTENCE);
  const mine = await settledPasswords(page);
  expect(mine.length).toBeGreaterThan(0);

  await page.reload();
  expect(await settledPasswords(page)).toEqual(mine);
  await expect(page.getByLabel('Your sentence')).toHaveValue(SENTENCE);
  await expect(page.getByRole('tab', { name: 'Use my sentence' })).toHaveAttribute('aria-selected', 'true');
});

test('copies a password to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const shown = await settledPasswords(page);
  await cards(page).first().getByRole('button', { name: 'Copy' }).click();
  await expect(cards(page).first().getByRole('button', { name: 'Copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown[0]);
});

test('number fields can be typed through and apply as a draft', async ({ page }) => {
  await settledPasswords(page);
  const count = page.getByLabel('Suggestions');
  await count.click();
  await count.fill('');
  await count.pressSequentially('10');
  await expect(count).toHaveValue('10');
  await expect(applyBar(page)).toBeVisible();
  await applyBar(page).getByRole('button', { name: 'Apply changes' }).click();
  await expect(cards(page)).toHaveCount(10);
});

test('the Fun page shows the spec and downloads it', async ({ page }) => {
  await page.getByRole('link', { name: 'Fun' }).click();
  await expect(page.getByText('Build "Elegant Passwords"')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md' }).click();
  expect((await download).suggestedFilename()).toBe('elegant-passwords-spec.md');
  await page.getByRole('link', { name: 'Elegant Passwords' }).click();
  await expect(cards(page).first()).toBeVisible(); // state survived the visit
});
