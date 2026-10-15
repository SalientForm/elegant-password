// Phone smoke tests (Pixel 7 viewport, touch), in the narrow layouts. On a
// phone (600 px and below) the open column fills the width under a bar stuck
// to the top: the page links behind a hamburger at its left, the three column
// tabs centred. Between that and 800 px the other two columns shrink to a
// button each in thin strips; between 800 and 1100 px two columns stay open
// and only the third shrinks. Every feature stays reachable, and nothing
// anywhere scrolls sideways or is clipped, down to the narrowest flagship
// phone (360 px): no element may stick out past the right edge or its column,
// and the page cannot be scrolled horizontally at all.

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
/** The button a shrunken column has become. */
const strip = (page: Page, name: string) => page.getByRole('button', { name, exact: true, expanded: false });
const strips = (page: Page) => page.locator('main > .strip > button');

/**
 * Fails unless every strip's button is centred in its strip both ways, dimmed
 * to 65 %, and reads bottom to top left of the open column (rotated) and top
 * to bottom right of it.
 */
async function centred(page: Page, where: string) {
  const open = page.locator('main > .sidebar:not([hidden]), main > .results:not([hidden]), main > .aside:not([hidden])');
  const openLeft = (await open.first().boundingBox())!.x; // the leftmost open column
  const found = await strips(page).evaluateAll((buttons) =>
    buttons.map((b) => {
      const s = b.parentElement!.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return { dx: Math.abs(Math.round(r.left + r.width / 2 - (s.left + s.width / 2))), dy: Math.abs(Math.round(r.top + r.height / 2 - (s.top + s.height / 2))), opacity: cs.opacity, vertical: cs.writingMode === 'vertical-rl', rotated: cs.transform !== 'none', left: s.left };
    }),
  );
  expect(found, `${where}: buttons centred, dimmed, vertical, rotated only left of the open column`).toEqual(
    found.map((f) => ({ dx: 0, dy: 0, opacity: '0.65', vertical: true, rotated: f.left < openLeft, left: f.left })),
  );
}

/**
 * Fails if anything sticks out past the right edge, past the open column (where
 * a strip would cover it), or has its text cut off (a password shortened with
 * an ellipsis is the one intended cut), or if the page can be scrolled sideways.
 */
async function noSideways(page: Page, where: string) {
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => {
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${(el as HTMLElement).className.toString().split(' ').slice(0, 2).join('.')}`;
    const out = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.right > window.innerWidth + 1;
      })
      .map(name);
    const column = document.querySelector('main > .sidebar:not([hidden]), main > .results:not([hidden]), main > .aside:not([hidden])');
    const edge = column ? column.getBoundingClientRect().right + 1 : Infinity;
    const past = column
      ? [...column.querySelectorAll('*')]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width > 0 && b.right > edge;
          })
          .map(name)
      : [];
    const cut = [...document.querySelectorAll('button, label, span, h2, h3, p, th, td')]
      .filter((el) => (el as HTMLElement).offsetWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && !el.closest('.pw-tip-anchor'))
      .map(name);
    window.scrollTo(400, window.scrollY);
    return { out: [...new Set(out)].slice(0, 8), past: [...new Set(past)].slice(0, 8), cut: [...new Set(cut)].slice(0, 8), scrollX: window.scrollX };
  });
  expect(result.out, `${where}: elements past the right edge`).toEqual([]);
  expect(result.past, `${where}: elements past the open column`).toEqual([]);
  expect(result.cut, `${where}: text cut off`).toEqual([]);
  expect(result.scrollX, `${where}: horizontal scroll position`).toBe(0);
}

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const openColumn = (page: Page) => page.locator('main > .sidebar:not([hidden]), main > .results:not([hidden]), main > .aside:not([hidden])');

/** Fails unless the bar is stuck to the top with the hamburger at the left and the tabs centred. */
async function barLaidOut(page: Page, where: string) {
  const bar = (await page.locator('.phone-bar').boundingBox())!;
  const menu = (await page.getByRole('button', { name: 'Pages', exact: true }).boundingBox())!;
  const tabs = (await page.getByRole('tablist', { name: 'Sections' }).boundingBox())!;
  const { width, scrolled } = await page.evaluate(() => ({ width: window.innerWidth, scrolled: window.scrollY > 400 }));
  expect(bar.y, `${where}: bar never above the top`).toBeGreaterThanOrEqual(-0.5);
  if (scrolled) expect(bar.y, `${where}: bar stuck to the top once the title has scrolled away`).toBeLessThanOrEqual(0.5);
  expect(menu.x, `${where}: hamburger at the left`).toBeLessThanOrEqual(bar.x + 1);
  expect(Math.abs(tabs.x + tabs.width / 2 - width / 2), `${where}: tabs centred`).toBeLessThanOrEqual(1);
  expect(menu.x + menu.width, `${where}: hamburger clear of the tabs`).toBeLessThanOrEqual(tabs.x);
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

test('phone: the open column fills the width under a bar with the page menu at the left and the column tabs centred', async ({ page }) => {
  await expect(page.locator('main')).toHaveClass('columns narrow phone focus-suggestions');
  await expect(strips(page)).toHaveCount(0); // the tabs do the strips' job
  await expect(page.getByRole('tablist', { name: 'Sections' }).getByRole('tab')).toHaveText(['Options', 'Suggestions', 'Testing']);
  await barLaidOut(page, 'suggestions');
  const width = await page.evaluate(() => window.innerWidth);
  expect((await openColumn(page).boundingBox())!.width, 'the open column takes the whole width').toBeGreaterThanOrEqual(width - 40);
  await settled(page);
  await noSideways(page, 'suggestions');
  await cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();
  await expect(page.getByText('Fast to type')).toBeVisible();
  await noSideways(page, 'suggestions with Why open');

  await tab(page, 'Options').click();
  await expect(page.getByText('Site requirements')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Swaps', exact: true })).toBeVisible();
  await noSideways(page, 'options');
  await tab(page, 'Suggestions').click();
  await expect(cards(page).first().getByRole('button', { name: 'Hide why', exact: true })).toBeVisible(); // still open: the column was hidden, not thrown away

  await tab(page, 'Options').click();
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unapplied changes' })).toBeVisible();
  await noSideways(page, 'options with floating buttons');
  await page.getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unapplied changes' })).toHaveCount(0);

  await tab(page, 'Suggestions').click();
  await settled(page);
  const first = (await cards(page).first().locator('.password').textContent())!;
  await cards(page).first().getByRole('button', { name: 'Add', exact: true }).click();

  await tab(page, 'Testing').click();
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  const list = page.getByRole('list', { name: 'My passwords' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(first);
  await noSideways(page, 'testing');

  // The bar floats: scrolled down, it is still at the top.
  await tab(page, 'Suggestions').click();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(150);
  await barLaidOut(page, 'scrolled');

  // The page links are behind the hamburger; choosing one closes the menu and the page's name takes the tabs' place.
  const menu = page.getByRole('button', { name: 'Pages', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0);
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Pages' }).getByRole('link')).toHaveText(['Passwords', 'Scoring', 'Fun']);
  await page.getByRole('link', { name: 'Scoring', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0);
  await expect(page.locator('.phone-page')).toHaveText('Scoring');
  await noSideways(page, 'scoring');
  await menu.click();
  await page.getByRole('link', { name: 'Passwords', exact: true }).click();
  await settled(page);
});

test('between phone and desktop widths, the other two columns shrink to buttons in strips that stay in reach', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1100 });
  await page.reload();
  await settled(page);
  await expect(page.locator('main')).toHaveClass('columns narrow focus-suggestions');
  await expect(page.locator('.phone-bar')).toHaveCount(0);
  await expect(strips(page)).toHaveText(['Options', 'Testing']); // Suggestions is open at first, in the middle
  await centred(page, 'suggestions');
  await noSideways(page, 'suggestions');

  await strip(page, 'Options').click();
  await expect(strips(page)).toHaveText(['Suggestions', 'Testing']);
  await expect(page.getByText('Site requirements')).toBeVisible();
  await centred(page, 'options');
  await noSideways(page, 'options');

  await strip(page, 'Testing').click();
  await expect(strips(page)).toHaveText(['Options', 'Suggestions']);
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  await centred(page, 'testing');
  await noSideways(page, 'testing');

  await strip(page, 'Suggestions').click();
  await settled(page);
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(150);
  const boxes = await strips(page).evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), bottom: Math.round(r.bottom) })));
  const height = await page.evaluate(() => window.innerHeight);
  for (const box of boxes) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(height);
  }
  await centred(page, 'scrolled');
});

test('in the medium range two columns stay open: Options and Suggestions at first, Testing a button; the outer columns trade places', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.reload();
  await settled(page);
  await expect(page.locator('main')).toHaveClass('columns medium outer-options');
  await expect(strips(page)).toHaveText(['Testing']);
  await expect(page.getByText('Site requirements')).toBeVisible();
  await centred(page, 'medium');
  await noSideways(page, 'medium: options and suggestions');
  await strip(page, 'Testing').click();
  await expect(page.locator('main')).toHaveClass('columns medium outer-list');
  await expect(strips(page)).toHaveText(['Options']);
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
  await centred(page, 'medium: testing open');
  await noSideways(page, 'medium: suggestions and testing');
  // Entering the range again (here: a reload) starts over with Options open.
  await page.reload();
  await settled(page);
  await expect(strips(page)).toHaveText(['Testing']);
});

test('fits the narrowest flagship phone with nothing clipped in any column', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  await settled(page);
  await barLaidOut(page, '360');
  await cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();
  await noSideways(page, '360: suggestions with Why open');
  await tab(page, 'Options').click();
  await expect(page.getByText('Site requirements')).toBeVisible();
  await noSideways(page, '360: options');
  await tab(page, 'Testing').click();
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  await noSideways(page, '360: testing');
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
