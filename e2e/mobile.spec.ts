// Phone smoke tests (Pixel 7 viewport, touch). The three columns collapse
// into Options / Suggestions / My list tabs, every feature stays reachable,
// and nothing anywhere scrolls sideways: no element may stick out past the
// right edge, and the page cannot be scrolled horizontally at all.

import { expect, test as base, type Page } from '@playwright/test';

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
const section = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

/** Fails if anything sticks out past the right edge, or if the page can be scrolled sideways. */
async function noSideways(page: Page, where: string) {
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => {
    const out = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.right > window.innerWidth + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className.toString().split(' ').slice(0, 2).join('.')}`);
    window.scrollTo(400, window.scrollY);
    return { out: [...new Set(out)].slice(0, 8), scrollX: window.scrollX };
  });
  expect(result.out, `${where}: elements past the right edge`).toEqual([]);
  expect(result.scrollX, `${where}: horizontal scroll position`).toBe(0);
}

const settled = async (page: Page) => {
  await expect(cards(page).first()).toBeVisible();
  await expect(page.locator('.batch.stale')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Working' })).toHaveCount(0);
};

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone project only');
  await page.goto('/');
});

test('collapses into three tabs and keeps every feature reachable without sideways scrolling', async ({ page }) => {
  const tabs = page.getByRole('tablist', { name: 'Sections' }).getByRole('tab');
  await expect(tabs).toHaveText(['Options', 'Suggestions', 'My list']);
  await settled(page);
  await noSideways(page, 'suggestions');
  await cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();
  await expect(page.getByText('Fast to type')).toBeVisible();
  await noSideways(page, 'suggestions with Why open');

  await section(page, 'Options').click();
  await expect(page.getByText('Site requirements')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Swaps', exact: true })).toBeVisible();
  await noSideways(page, 'options');
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unapplied changes' })).toBeVisible();
  await noSideways(page, 'options with floating buttons');
  await page.getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unapplied changes' })).toHaveCount(0);

  await section(page, 'Suggestions').click();
  await settled(page);
  const first = (await cards(page).first().locator('.password').textContent())!;
  await cards(page).first().getByRole('button', { name: 'Add', exact: true }).click();

  await section(page, 'My list').click();
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  const list = page.getByRole('list', { name: 'My passwords' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(first);
  await noSideways(page, 'my list');
});

test('sentence mode and its keyboard map fit a phone', async ({ page }) => {
  await settled(page);
  await page.getByRole('tab', { name: 'Use my sentence', exact: true }).click();
  await page.getByLabel('Your sentence', { exact: true }).fill('Sally eats sweets on Sundays');
  await page.keyboard.press('Enter');
  await settled(page);
  await cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();
  await expect(cards(page).first()).toContainText('Sally eats sweets on Sundays');
  await noSideways(page, 'sentence mode with Why open');
});

test('the Scoring and Fun pages fit a phone', async ({ page }) => {
  await page.goto('/#/scoring');
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await noSideways(page, 'scoring');
  await page.goto('/#/fun');
  await expect(page.locator('.prose')).toBeVisible();
  await noSideways(page, 'fun');
});
