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
  await page.waitForTimeout(400); // past any debounce: a wrongly triggered regeneration would have landed by now
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

test('the sentence stays through Refresh, a rule change and a reload; only "New sentence" draws another', async ({ page }) => {
  const before = await settledPasswords(page);
  const sentence = page.getByTestId('generated-sentence');
  const shown = await sentence.inputValue();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect.poll(async () => passwords(page)).not.toEqual(before);
  await expect(sentence).toHaveValue(shown);
  await page.getByRole('button', { name: 'Relaxed', exact: true }).click();
  await page.getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await expect(sentence).toHaveValue(shown);
  await page.reload();
  await settledPasswords(page);
  await expect(sentence).toHaveValue(shown);
  await page.getByRole('button', { name: 'New sentence', exact: true }).click();
  await expect(sentence).not.toHaveValue(shown);
});

test('adds a password to my list, scores it the same, and keeps the list across a reload', async ({ page }) => {
  const shown = await settledPasswords(page);
  const first = cards(page).first();
  const bits = (await first.locator('.badge.strength').textContent())!.replace(/[^0-9]/g, '');
  // zxcvbn's word is the card's fourth badge, worked out in the page.
  await expect(first.locator('.badge.zxcvbn')).toHaveText(/^zxcvbn (very weak|weak|good|strong)$/);
  await expect(first.locator('.card-head .badge').nth(3)).toHaveClass(/zxcvbn/);
  await first.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Added', exact: true })).toBeDisabled();
  const list = page.getByRole('list', { name: 'My passwords' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText(shown[0]!);
  await expect(list).toContainText('Hint:');
  await expect(list.locator('.badge.strength')).toHaveText(`Strength ${bits}`);
  // The password just added is now the one under test, hint and all three badges included.
  const practice = page.locator('.typing-result');
  await expect(practice).toContainText(`Testing: ${shown[0]}`);
  await expect(practice).toContainText('Hint:'); // shown as text: a known hint cannot be edited
  await expect(page.getByLabel('Hint for the password under test', { exact: true })).toHaveCount(0);
  await expect(practice.locator('.badge.strength')).toHaveText(`Strength ${bits}`);
  await expect(practice.locator('.badge.memorability')).toHaveText(/^Memorability \d+$/);
  // The zxcvbn reading: the library loads (a chunk of its own, allowed by the CSP) and the reading is kept with the entry.
  const reading = list.locator('.badge.zxcvbn');
  await expect(reading).toHaveText(/^zxcvbn (very weak|weak|good|strong)$/);
  const said = await reading.textContent();
  await expect(list.locator('.zxcvbn-line')).toHaveText(/^zxcvbn: (very weak|weak|good|strong) \(.+ to crack\)$/);

  await page.reload();
  expect(await settledPasswords(page)).toEqual(shown);
  await expect(page.getByRole('list', { name: 'My passwords' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('list', { name: 'My passwords' }).locator('.badge.zxcvbn')).toHaveText(said!);
  await page.getByRole('button', { name: /^Remove .* from my list$/ }).click();
  await expect(page.getByText('Nothing yet')).toBeVisible();
});

test('turns my own sentence into passwords, applied with Ctrl+Enter, and keeps them across a reload', async ({ page }) => {
  await settledPasswords(page);
  await page.getByRole('tab', { name: 'Make up a sentence' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Use my sentence' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Type a sentence to turn into a password, then submit it.')).toBeVisible();

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

test('a desktop has no Copy button on a card (the password is selected like text), and a password cut short reveals on click', async ({ page }) => {
  await settledPasswords(page);
  await expect(cards(page).first().getByRole('button', { name: 'Copy' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy sentence' })).toBeVisible(); // the sentence is not a password: its Copy button stays
  // A long own sentence under a wide length limit makes a password wider than its column: it ends in an ellipsis and is a button.
  await page.getByLabel('Maximum', { exact: true }).fill('120');
  await page.getByRole('tab', { name: 'Use my sentence' }).click();
  await page.getByLabel('Your sentence', { exact: true }).fill('Sally eats sweets on Sundays with her friends and family every single week of the whole year');
  await page.keyboard.press('Control+Enter');
  await expect(applyBar(page)).toHaveCount(0);
  const password = cards(page).first().locator('.password');
  await expect(password).toHaveClass(/can-reveal/);
  await expect(password).toHaveAttribute('aria-expanded', 'false');
  const folded = (await password.boundingBox())!;
  await password.click();
  await expect(password).toHaveAttribute('aria-expanded', 'true');
  await expect(password).toHaveClass(/revealed/);
  const whole = (await password.boundingBox())!;
  expect(whole.height).toBeGreaterThan(folded.height); // wrapped onto more lines, nothing copied
  await password.click();
  await expect(password).toHaveAttribute('aria-expanded', 'false');
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

/** Every check on every card is met: opens each card's "Why?" in turn. */
async function everyCheckMet(page: Page) {
  for (const card of await cards(page).all()) {
    await card.getByRole('button', { name: 'Why?', exact: true }).click();
    await expect(card.locator('.checks li.met').first()).toBeVisible();
    await expect(card.locator('.checks li.unmet')).toHaveCount(0);
  }
}

test('a site preset that rules out the separator still makes passwords: the separator becomes Automatic, and the form says so', async ({ page }) => {
  const before = await settledPasswords(page);
  // A separator chosen by hand, as every earlier version saved it: ";".
  await page.getByLabel('Separator symbol', { exact: true }).fill(';');
  await applyBar(page).getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  await settledPasswords(page);

  await page.getByRole('button', { name: /^No symbols/ }).click();
  await expect(page.getByText('No symbols: separator set to Auto (none), as ";" is not allowed.')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Separator between words' }).getByRole('button', { name: 'Auto', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.field-error')).toHaveCount(0);
  await expect(applyBar(page).getByRole('button', { name: 'Submit changes', exact: true })).toBeEnabled();
  await applyBar(page).getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  const after = await settledPasswords(page);
  expect(after).not.toEqual(before);
  await expect(page.getByRole('alert')).toHaveCount(0);
  for (const password of after) expect(password, 'letters and digits only').toMatch(/^[A-Za-z0-9]+$/);
  await everyCheckMet(page);
});

test('pasted "3 of the following 4" rules fill in three named kinds and make passwords that meet them; a paste past the cap is refused', async ({ page, context }) => {
  await settledPasswords(page);
  const box = page.getByRole('textbox', { name: "The site's password rules" });
  const status = page.locator('#paste-rules').getByRole('status');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Your password must be 10-24 characters and contain at least 3 of the following:\n• Uppercase letters (A-Z)\n• Lowercase letters (a-z)\n• Numbers (0-9)\n• Symbols'));
  await box.click();
  await page.keyboard.press('Control+V');
  await expect(status).toHaveText('Filled in: 10-24 characters, at least 3 of uppercase, lowercase, digits and symbols (kept as an uppercase letter, a lowercase letter and a digit).');
  await applyBar(page).getByRole('button', { name: 'Submit changes', exact: true }).click();
  await expect(applyBar(page)).toHaveCount(0);
  for (const password of await settledPasswords(page)) {
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
  }
  await everyCheckMet(page);

  // The box's cap is the core's: a paste that would pass it is refused whole, and the text stays.
  const cap = Number(await box.getAttribute('maxlength'));
  expect(cap).toBeGreaterThan(0);
  const before = await box.inputValue();
  await page.evaluate((n) => navigator.clipboard.writeText('x'.repeat(n)), cap);
  await box.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Control+V');
  await expect(status).toHaveText(new RegExp(`^Not pasted\\. The rules text is ${before.length + cap} characters; ${cap} is the most this tool reads\\.`));
  await expect(box).toHaveValue(before);
});

test('an impossible combination shows its error beside the fields, blocks Submit, Enter and Refresh, and works once corrected', async ({ page }) => {
  const before = await settledPasswords(page);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('elegant-passwords:requirements:v1') ?? '{}'));
  const was = await saved();
  // Symbols are required by default; emptying the allowed symbols leaves none to use.
  const symbols = page.getByRole('textbox', { name: 'Symbols', exact: true });
  await symbols.fill('');
  const error = page.locator('#problems-allows .field-error');
  await expect(error).toHaveText('A symbol is required, but no symbols are allowed. List the symbols the site accepts, or untick Symbols under Must contain.');
  await expect(symbols).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Minimum symbols', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  const submit = applyBar(page).getByRole('button', { name: 'Submit changes', exact: true });
  await expect(submit).toBeDisabled();
  await expect(applyBar(page).getByRole('alert')).toContainText('Fix this to submit: A symbol is required');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeDisabled();
  await symbols.press('Enter');
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(400); // past any debounce: a wrongly applied draft would have regenerated by now
  expect(await passwords(page)).toEqual(before);
  expect(await saved()).toEqual(was);
  await expect(applyBar(page)).toBeVisible();

  // A second contradiction is listed too; "Show" takes focus to the first.
  await page.getByLabel('Minimum', { exact: true }).fill('40');
  await expect(page.locator('#problems-length .field-error')).toHaveText('The minimum length (40) is above the maximum (32).');
  await expect(applyBar(page).getByRole('alert')).toContainText('Fix 2 problems to submit:');
  await applyBar(page).getByRole('button', { name: 'Show', exact: true }).click();
  await expect(page.getByLabel('Minimum', { exact: true })).toBeFocused();

  // Corrected: the errors go, and Submit works.
  await page.getByLabel('Minimum', { exact: true }).fill('12');
  await page.getByRole('checkbox', { name: 'Symbols', exact: true }).uncheck();
  await expect(page.locator('.field-error')).toHaveCount(0);
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(applyBar(page)).toHaveCount(0);
  const after = await settledPasswords(page);
  expect(after).not.toEqual(before);
  expect(await saved()).toMatchObject({ allowedSymbols: '', minSymbols: 0 });
  await everyCheckMet(page);
});

test('saved settings that contradict themselves load repaired, with a note, and still make passwords', async ({ page }) => {
  await settledPasswords(page);
  await page.evaluate(() => {
    const key = 'elegant-passwords:requirements:v1';
    localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key)!), minLength: 40, maxLength: 32, separator: ' ', allowSpaces: false }));
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByText('Some saved settings could not be used, so they are back to their defaults: minimum length, separator.')).toBeVisible();
  await settledPasswords(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.field-error')).toHaveCount(0);
  await everyCheckMet(page);
});

test('the Fun page shows both specs, the app first, and downloads each', async ({ page }) => {
  await page.getByRole('link', { name: 'Fun' }).click();
  await expect(page.getByText('Build "Elegant Passwords"')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('elegant-passwords-spec.md');
  // The command line's prompt comes second, built on the app's shared core.
  await page.getByRole('tab', { name: '2. The command line' }).click();
  await expect(page.getByText('Build "tep", the Elegant Passwords command line')).toBeVisible();
  const cli = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .md', exact: true }).click();
  expect((await cli).suggestedFilename()).toBe('tep-cli-spec.md');
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
    // Exactly 12 when the pieces allow; when the gap is smaller than the tag (a number of its own met the digit rule),
    // the tag alone covers it and states the true total.
    expect(p.length).toBeGreaterThanOrEqual(12);
    expect(p.length).toBeLessThanOrEqual(13);
    expect(p).toMatch(new RegExp(`%${p.length}$`));
  }
});

test('tests a typed password in the masthead: speed, corrections, strength, and the lock', async ({ page, context }) => {
  const field = page.getByLabel('Typing test', { exact: true });
  await field.click();
  await field.pressSequentially('Sleepy;otterx', { delay: 20 });
  await page.keyboard.press('Backspace');
  await field.pressSequentially('s', { delay: 20 });
  await page.keyboard.press('Enter');
  const status = page.locator('.typing-result');
  await expect(status).toContainText('Testing: Sleepy;otters');
  await expect(status).toContainText('Typed correctly');
  await expect(status).toContainText('1 correction');
  const hintField = page.getByLabel('Hint for the password under test', { exact: true });
  await expect(hintField).toHaveValue(''); // typed by hand: no hint yet
  await expect(status.locator('.badge.strength')).toHaveText(/^Strength \d+$/);
  await expect(status.locator('.badge.difficulty')).toHaveText(/^Difficulty \d+$/);
  await expect(status.locator('.badge.memorability')).toHaveText('Memorability n/a');
  await hintField.fill('sleepy otters');
  await expect(status.locator('.badge.memorability')).toHaveText(/^Memorability \d+$/); // a hint added by hand scores memorability
  // Pasting into the field chooses that password to test instead of typing it.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('Pasted;words;77'));
  await field.click();
  await page.keyboard.press('Control+V');
  await expect(status).toContainText('Testing: Pasted;words;77');
  await expect(field).toHaveValue('');
  await field.pressSequentially('Sleepy;otter', { delay: 10 });
  await page.keyboard.press('Enter');
  await expect(status).toContainText('Did not match'); // the pasted password stays under test
  await expect(status).toContainText('Testing: Pasted;words;77');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(status).toHaveCount(0);
  await field.pressSequentially('Sleepy;otters', { delay: 10 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.typing-result')).toContainText('Testing: Sleepy;otters'); // after Clear, the next run sets the target
});

test('orders suggestions by difficulty by default, and by strength or memorability on request', async ({ page }) => {
  await settledPasswords(page);
  const numbers = async (badge: string) => (await page.locator(`article.card .badge.${badge}`).allTextContents()).map((t) => Number(t.match(/\d+/)![0]));
  await expect(cards(page).first().locator('.badge.memorability')).toHaveText(/^Memorability \d+$/);
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
  await expect(page.getByRole('heading', { name: 'Strength, Raw and bits' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeVisible();
  await expect(page.getByText('Finger rolls')).toBeVisible();
  await page.getByRole('link', { name: 'Passwords', exact: true }).click();
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
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      return { pageY: window.scrollY, left: top('main > .sidebar'), middle: top('main > .results'), right: top('main > .aside'), stop: Math.min(main.getBoundingClientRect().top + window.scrollY - stickyTop, maxScroll) };
    });
  const start = await state();
  expect(start.pageY).toBe(0);
  // Wheel over the middle column (moving the pointer by coordinates: hover() would scroll it into view first):
  // the page moves first, the header scrolls up, the columns do not scroll yet.
  const over = async (selector: string) => {
    const box = (await page.locator(selector).boundingBox())!;
    await page.mouse.move(box.x + Math.min(60, box.width / 2), Math.max(10, box.y + 40));
  };
  await over('main > .results');
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
  await over('main > .sidebar');
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

test('the page background is a top-to-bottom gradient, 20% darker at the top, spanning the whole document', async ({ page }) => {
  await settledPasswords(page);
  const look = await page.evaluate(() => {
    const probe = (background: string) => {
      const el = document.createElement('div');
      el.style.background = background;
      document.body.append(el);
      const colour = getComputedStyle(el).backgroundColor;
      el.remove();
      return colour;
    };
    const brightness = (c: string) => Math.max(...c.match(/[\d.]+/g)!.slice(0, 3).map(Number)) / (c.startsWith('rgb') ? 255 : 1); // rgb(0-255) or color(srgb 0-1)
    const root = getComputedStyle(document.documentElement);
    return { image: root.backgroundImage, attachment: root.backgroundAttachment, top: brightness(probe('var(--bg-top)')), bottom: brightness(probe('var(--bg)')), rootHeight: document.documentElement.getBoundingClientRect().height, docHeight: document.documentElement.scrollHeight };
  });
  expect(look.image).toContain('linear-gradient');
  expect(look.attachment).toBe('scroll'); // the gradient belongs to the document, not the viewport
  expect(look.rootHeight).toBeGreaterThanOrEqual(look.docHeight - 1); // so it spans the whole page
  expect(look.top).toBeLessThan(look.bottom);
  expect(look.top / look.bottom).toBeGreaterThan(0.77); // 20% of brightness darker at the top: no more, no less
  expect(look.top / look.bottom).toBeLessThan(0.83);
});

test('every small icon button has the same border colour and a subtle drop shadow', async ({ page }) => {
  await settledPasswords(page);
  await cards(page).first().getByRole('button', { name: 'Add', exact: true }).click(); // a list entry brings Remove and Copy buttons too
  const look = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.icon-button')]
      .filter((b) => b.offsetWidth > 0 && b.getAttribute('aria-pressed') !== 'true' && !b.classList.contains('primary')) // Refresh is the one filled, primary icon button
      .map((b) => ({ name: b.getAttribute('aria-label'), border: getComputedStyle(b).borderColor, shadow: getComputedStyle(b).boxShadow })),
  );
  expect(look.length).toBeGreaterThan(4);
  expect(new Set(look.map((b) => b.border)).size, `one border colour: ${JSON.stringify(look)}`).toBe(1);
  expect(look.every((b) => b.shadow !== 'none')).toBe(true);
});

test('the header is opaque, lighter than the gradient top, shadowed, and underlines the tabs with a slightly darker line', async ({ page }) => {
  await settledPasswords(page);
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
    const brightness = (c: string) => Math.max(...parts(c).slice(0, 3)) / (c.startsWith('rgb') ? 255 : 1);
    const header = document.querySelector('header.app-header')!;
    const nav = header.querySelector('nav')!;
    const hs = getComputedStyle(header);
    const headerBox = header.getBoundingClientRect();
    return {
      holdsTitleAndTabs: !!header.querySelector('h1') && nav.getAttribute('aria-label') === 'Pages',
      top: brightness(probe('var(--bg-top)')),
      header: brightness(hs.backgroundColor),
      alpha: parts(hs.backgroundColor)[3] ?? 1,
      shadow: hs.boxShadow,
      headerLine: brightness(hs.borderBottomColor),
      tabsLine: brightness(getComputedStyle(nav).borderBottomColor),
      fullWidth: headerBox.left <= 0 && headerBox.right >= window.innerWidth - 1,
    };
  });
  expect(look.holdsTitleAndTabs).toBe(true);
  expect(look.alpha).toBe(1);
  expect(look.header).toBeGreaterThan(look.top);
  expect(look.header - look.top).toBeLessThan(0.2); // three quarters of the way from the bar to the panel colour: lighter than the phone bar, still short of white
  expect(look.shadow).not.toBe('none');
  expect(look.headerLine).toBeLessThan(look.tabsLine); // the header's line is the darker of the two, just below the tabs' border
  expect(look.fullWidth).toBe(true);
});

test('the floating buttons never cover the end of the middle column', async ({ page }) => {
  await settledPasswords(page);
  await page.getByRole('button', { name: 'Strict', exact: true }).click();
  await expect(applyBar(page)).toBeVisible();
  const gap = await page.evaluate(() => {
    window.scrollTo(0, 1e9); // the page to its stop, where the columns stick
    const column = document.querySelector<HTMLElement>('main > .results')!;
    column.scrollTop = 1e9; // the column to its end
    const bar = document.querySelector('.apply-bar')!.getBoundingClientRect();
    const last = [...column.children].filter((c) => !c.classList.contains('apply-bar')).at(-1)!.getBoundingClientRect();
    return bar.top - last.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0); // the last panel ends above the buttons
});

test('badge tips are never clipped by a card and stay inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 700 }); // a three-column width (1101 px and up) where the list sits near the right edge
  await settledPasswords(page);
  const first = cards(page).first();
  await first.getByRole('button', { name: 'Add', exact: true }).click();
  // In the list, at the right edge of the screen.
  await page.getByRole('list', { name: 'My passwords' }).locator('.badge.memorability').first().hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  let box = (await tip.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await page.mouse.move(0, 0);
  await expect(tip).toHaveCount(0);
  // On a card: the tip sits outside the card's clipping box, fully visible.
  await first.locator('.badge.strength').hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  box = (await page.getByRole('tooltip').boundingBox())!;
  expect(box.width).toBeGreaterThan(100);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  // The tip is rendered at the document level, outside the card element, so the card's overflow cannot cut it: it is in the body, not the article, and nothing clips it.
  expect(await page.getByRole('tooltip').evaluate((el) => el.closest('article') === null && el.parentElement === document.body)).toBe(true);
  expect(box.height).toBeGreaterThan(10);
});

test('Practise on a card makes it the password under test without adding it', async ({ page }) => {
  const shown = await settledPasswords(page);
  await cards(page).nth(1).getByRole('button', { name: 'Practise', exact: true }).click();
  await expect(page.locator('.typing-result')).toContainText(`Testing: ${shown[1]}`);
  await expect(page.getByLabel('Typing test', { exact: true })).toBeFocused();
  await expect(page.getByText('Nothing yet')).toBeVisible(); // nothing was added
});

test('Forget this session draws a new sentence and clears the password under test', async ({ page }) => {
  const shown = await settledPasswords(page);
  await cards(page).first().getByRole('button', { name: 'Practise', exact: true }).click();
  const forget = page.getByRole('button', { name: 'Forget this session', exact: true });
  await forget.click();
  await page.getByRole('button', { name: 'Really forget?', exact: true }).click();
  await expect(page.locator('.typing-result')).toHaveCount(0);
  await expect.poll(async () => (await settledPasswords(page))[0]).not.toBe(shown[0]);
});

test('framed by a page on another origin, the build shows only a notice and a link to a tab of its own; the dev server stays frameable', async ({ page, context, baseURL }, info) => {
  // The framing page is served by request interception on an origin of its own, as a clickjacking page would be: no server, no port.
  // Chromium lets a page off the local network frame one on it only when granted local network access, and grants that only to a secure page,
  // hence https; the deployed app is not on the local network, so the grant stands in for that.
  const app = `${baseURL}/`;
  await context.grantPermissions(['local-network-access'], { origin: 'https://framer.test' });
  await page.route('https://framer.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Framer</title><iframe src="${app}" width="1280" height="800"></iframe>` }),
  );
  await page.goto('https://framer.test/');
  const frame = page.frameLocator('iframe');
  if (info.project.name === 'dev') {
    await expect(frame.locator('article.card')).toHaveCount(5); // preview panes frame the dev server
    return;
  }
  await expect(frame.getByRole('heading', { name: 'Elegant Passwords opens in its own tab' })).toBeVisible();
  await expect(frame.locator('header, article.card, nav')).toHaveCount(0); // no app was mounted
  await expect(frame.locator('code')).toHaveText(app);
  const link = frame.getByRole('link', { name: 'Open Elegant Passwords in a new tab' });
  await expect(link).toHaveAttribute('href', app);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await expect(tab).toHaveURL(app);
  await expect(cards(tab)).toHaveCount(5); // at the top of its own tab, the app runs
});
