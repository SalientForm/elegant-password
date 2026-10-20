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
    // Every open column (two of them in the medium range) is checked against its own right edge. On a phone there is no
    // strip to cover anything and the cards run edge to edge past the column's padding, so the edge is the viewport's.
    const phone = document.querySelector('main.phone') !== null;
    const past = [...document.querySelectorAll('main > .sidebar:not([hidden]), main > .results:not([hidden]), main > .aside:not([hidden])')].flatMap((column) => {
      const edge = (phone ? window.innerWidth : column.getBoundingClientRect().right) + 1;
      return [...column.querySelectorAll('*')]
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.right > edge;
        })
        .map((el) => `${name(column)} > ${name(el)}`);
    });
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
  const { width, scrolled, barPadding } = await page.evaluate(() => ({
    width: window.innerWidth,
    scrolled: window.scrollY > 400,
    barPadding: parseFloat(getComputedStyle(document.querySelector('.phone-bar')!).paddingLeft) || 0, // the bar may run full width with its content inset
  }));
  expect(bar.y, `${where}: bar never above the top`).toBeGreaterThanOrEqual(-0.5);
  if (scrolled) expect(bar.y, `${where}: bar stuck to the top once the title has scrolled away`).toBeLessThanOrEqual(0.5);
  expect(menu.x, `${where}: hamburger at the left`).toBeLessThanOrEqual(bar.x + barPadding + 1);
  expect(Math.abs(tabs.x + tabs.width / 2 - width / 2), `${where}: tabs centred`).toBeLessThanOrEqual(1);
  expect(menu.x + menu.width, `${where}: hamburger clear of the tabs`).toBeLessThanOrEqual(tabs.x);
  // Opaque, slightly lighter than the top of the page gradient it covers, with no shadow.
  const look = await page.evaluate(() => {
    const probe = (background: string) => {
      const el = document.createElement('div');
      el.style.background = background;
      document.body.append(el);
      const colour = getComputedStyle(el).backgroundColor;
      el.remove();
      return colour;
    };
    const parts = (c: string) => c.match(/[\d.]+/g)!.map(Number);
    const brightness = (c: string) => Math.max(...parts(c).slice(0, 3)) / (c.startsWith('rgb') ? 255 : 1); // rgb(0-255) or color(srgb 0-1)
    const bar = getComputedStyle(document.querySelector('.phone-bar')!);
    return { top: brightness(probe('var(--bg-top)')), bar: brightness(bar.backgroundColor), alpha: parts(bar.backgroundColor)[3] ?? 1, shadow: bar.boxShadow };
  });
  expect(look.alpha, `${where}: bar opaque`).toBe(1);
  expect(look.bar, `${where}: bar lighter than the top of the gradient`).toBeGreaterThan(look.top);
  expect(look.bar - look.top, `${where}: only slightly lighter`).toBeLessThan(0.15);
  expect(look.shadow, `${where}: no shadow`).toBe('none');
}

/** Fails unless every visible card is stacked exactly when its password at full width and its buttons cannot share a row. */
async function stackingConsistent(page: Page, where: string) {
  const wrong = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('article.card .card-head')]
      .filter((head) => head.closest('[hidden]') === null)
      .map((head) => {
        const width = (el: Element) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect().width;
        };
        const row = head.querySelector('.card-row')!;
        const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
        const should = width(head.querySelector('.password')!) + width(head.querySelector('.card-buttons')!) + gap > row.clientWidth + 1;
        return { password: head.querySelector('.password')!.textContent, stacked: head.classList.contains('stacked'), should };
      })
      .filter((c) => c.stacked !== c.should),
  );
  expect(wrong, `${where}: cards stacked exactly when the password and buttons cannot share a row`).toEqual([]);
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
  await expect(page.getByRole('heading', { name: 'Requirement options' })).toBeVisible();
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
  await expect(menu).toHaveAttribute('aria-controls', 'phone-pages');
  await expect(page.locator('#phone-pages')).toBeHidden(); // in the document, hidden, so the button's aria-controls has a target
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
  await expect(page.getByRole('heading', { name: 'Requirement options' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Requirement options' })).toBeVisible();
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

  // The bottom of the range is still the sticky two-column layout: no phone padding under the page, no stacked tables,
  // and the page scrolls exactly to where the columns stick.
  await page.setViewportSize({ width: 830, height: 800 });
  await page.reload();
  await settled(page);
  await expect(page.locator('main')).toHaveClass('columns medium outer-options');
  const layout = await page.evaluate(() => ({
    padding: getComputedStyle(document.querySelector('.app')!).paddingBottom,
    thead: getComputedStyle(document.querySelector('table.stack thead')!).display,
    maxScroll: document.documentElement.scrollHeight - window.innerHeight,
    columnsTop: document.querySelector('main')!.getBoundingClientRect().top + window.scrollY,
  }));
  expect(layout.padding).toBe('0px');
  expect(layout.thead).not.toBe('none');
  expect(Math.abs(layout.maxScroll - layout.columnsTop)).toBeLessThanOrEqual(1);
});

test('cards stack on a phone and un-stack once there is room again; a batch that arrives in a hidden column measures itself when shown', async ({ page }) => {
  await settled(page);
  await expect(page.locator('article.card .card-head.stacked').first()).toBeVisible(); // a phone column is too narrow for most passwords beside their buttons
  await stackingConsistent(page, 'phone');
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(200);
  await expect(page.locator('article.card .card-head.stacked')).toHaveCount(0); // room again (a 600 px row): nothing stays stacked
  await stackingConsistent(page, 'desktop after phone');

  await page.setViewportSize({ width: 760, height: 1000 });
  await page.reload();
  await settled(page);
  await strip(page, 'Options').click(); // Suggestions is hidden now
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await page.getByRole('button', { name: 'Submit changes', exact: true }).click(); // the new batch mounts in the hidden column
  await expect(page.getByRole('region', { name: 'Unapplied changes' })).toHaveCount(0);
  await strip(page, 'Suggestions').click();
  await settled(page);
  await expect(page.locator('article.card .card-head.stacked')).toHaveCount(0); // a 760 px window fits every password beside its buttons
  await stackingConsistent(page, 'shown after mounting hidden');
});

test('fits the narrowest flagship phone with nothing clipped in any column', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.reload();
  await settled(page);
  await barLaidOut(page, '360');
  await cards(page).first().getByRole('button', { name: 'Why?', exact: true }).click();
  await noSideways(page, '360: suggestions with Why open');
  await tab(page, 'Options').click();
  await expect(page.getByRole('heading', { name: 'Requirement options' })).toBeVisible();
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

/*
 * The phone layout itself, pinned so a later style change cannot quietly undo
 * it: a full-width bar meeting the header, tabs that fit, edge-to-edge cards
 * split by one line, a bare hamburger, and the three order choices on one row.
 */

/** Fails unless every visible card spans the viewport with square corners, only a bottom line, and touches the next card in its column. */
async function cardsEdgeToEdge(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const visible = (el: Element) => el.getBoundingClientRect().width > 0;
    const panels = [...document.querySelectorAll('.panel')].filter(visible);
    const looks = panels.map((p) => {
      const b = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      return {
        card: p.className,
        left: Math.round(b.left),
        width: Math.round(b.width),
        radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
        borders: { top: cs.borderTopWidth, right: cs.borderRightWidth, left: cs.borderLeftWidth, bottom: cs.borderBottomWidth, bottomStyle: cs.borderBottomStyle },
      };
    });
    // Consecutive cards in one column: a card directly followed by another.
    const gaps = panels
      .filter((p) => p.nextElementSibling?.classList.contains('panel') && visible(p.nextElementSibling))
      .map((p) => ({ pair: `${p.className} > ${p.nextElementSibling!.className}`, gap: Math.round(p.nextElementSibling!.getBoundingClientRect().top - p.getBoundingClientRect().bottom) }));
    return { width: window.innerWidth, looks, gaps };
  });
  expect(found.looks.length, `${where}: cards shown`).toBeGreaterThan(0);
  expect(found.looks, `${where}: cards full width, square, closed by one bottom line`).toEqual(
    found.looks.map((l) => ({ card: l.card, left: 0, width: found.width, radii: ['0px', '0px', '0px', '0px'], borders: { top: '0px', right: '0px', left: '0px', bottom: '1px', bottomStyle: 'solid' } })),
  );
  expect(found.gaps.length, `${where}: at least one pair of consecutive cards`).toBeGreaterThan(0);
  expect(found.gaps, `${where}: no gap between consecutive cards`).toEqual(found.gaps.map((g) => ({ pair: g.pair, gap: 0 })));
}

test('phone: the bar spans the full width and meets the header with no gap', async ({ page }) => {
  await settled(page);
  const header = (await page.locator('.app-header').boundingBox())!;
  const bar = (await page.locator('.phone-bar').boundingBox())!;
  const width = await page.evaluate(() => window.innerWidth);
  expect(bar.x, 'bar starts at the left edge').toBe(0);
  expect(bar.width, 'bar as wide as the viewport').toBe(width);
  expect(Math.abs(bar.y - (header.y + header.height)), 'bar starts where the header ends').toBeLessThanOrEqual(0.5);
});

test('phone: the section tabs fit their text at 320 and 390 px and the page never scrolls sideways', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await page.reload();
    await settled(page);
    const tabs = await page.getByRole('tablist', { name: 'Sections' }).getByRole('tab').evaluateAll((buttons) =>
      buttons.map((b) => {
        // The label's own bounds against the tab's: the open tab's feet reach past its sides, so its scrollWidth is no guide.
        const range = document.createRange();
        range.selectNodeContents(b);
        const text = range.getBoundingClientRect();
        const box = b.getBoundingClientRect();
        return { tab: b.textContent, overflows: text.left < box.left - 0.5 || text.right > box.right + 0.5 };
      }),
    );
    expect(tabs, `${width}: no tab's text overflows`).toEqual(['Options', 'Suggestions', 'Testing'].map((tab) => ({ tab, overflows: false })));
    for (const name of ['Options', 'Testing', 'Suggestions']) {
      await tab(page, name).click();
      const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
      expect(sizes.scrollWidth, `${width}, ${name}: page no wider than the viewport`).toBe(sizes.innerWidth);
    }
  }
});

test('phone: a blocked Submit says why without scrolling sideways, and "Show" opens Options at the field', async ({ page }) => {
  for (const width of [320, 360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await page.reload();
    await settled(page);
    await tab(page, 'Options').click();
    await noSideways(page, `${width}: the separator choices`);
    await page.getByRole('textbox', { name: 'Symbols', exact: true }).fill('');
    await page.getByLabel('Minimum', { exact: true }).fill('40');
    const bar = page.getByRole('region', { name: 'Unapplied changes' });
    await expect(bar.getByRole('alert')).toContainText('Fix 2 problems to submit:');
    await expect(bar.getByRole('button', { name: 'Submit changes', exact: true })).toBeDisabled();
    await noSideways(page, `${width}: options with errors`);
    await tab(page, 'Suggestions').click();
    await noSideways(page, `${width}: suggestions under a blocked bar`);
    await bar.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(tab(page, 'Options')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Minimum', { exact: true })).toBeFocused();
    await bar.getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(bar).toHaveCount(0);
  }
});

test('phone: cards run edge to edge with square corners, one line below each and no gap between them', async ({ page }) => {
  await settled(page);
  await cardsEdgeToEdge(page, 'suggestions');
  await tab(page, 'Options').click();
  await expect(page.getByRole('heading', { name: 'Requirement options' })).toBeVisible();
  await cardsEdgeToEdge(page, 'options');
  await tab(page, 'Testing').click();
  await expect(page.getByLabel('Test and practice', { exact: true })).toBeVisible();
  await cardsEdgeToEdge(page, 'testing');
});

test('phone: the hamburger is the bare symbol, with no background, border or shadow', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Pages', exact: true });
  const chrome = () =>
    menu.evaluate((b) => {
      const cs = getComputedStyle(b);
      return { background: cs.backgroundColor, borders: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor], shadow: cs.boxShadow };
    });
  const bare = { background: 'rgba(0, 0, 0, 0)', borders: Array(4).fill('rgba(0, 0, 0, 0)'), shadow: 'none' };
  expect(await chrome(), 'at rest').toEqual(bare);
  await menu.hover();
  expect(await chrome(), 'hovered').toEqual(bare);
});

test('phone: the three order choices share one row at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.reload();
  await settled(page);
  const order = page.locator('.results-tools .segmented.sort > button');
  await expect(order).toHaveText(['Memorability', 'Difficulty', 'Strength']);
  const rows = await order.evaluateAll((buttons) => buttons.map((b) => ({ top: Math.round(b.getBoundingClientRect().top), overflows: b.scrollWidth > b.clientWidth })));
  expect(rows, 'all three at the same height, none cut').toEqual(rows.map(() => ({ top: rows[0]!.top, overflows: false })));
});

test('the Scoring and Fun pages fit a phone', async ({ page }) => {
  await page.goto('/#/scoring');
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await noSideways(page, 'scoring');
  await page.goto('/#/fun');
  await expect(page.locator('.prose')).toBeVisible();
  await noSideways(page, 'fun');
});
