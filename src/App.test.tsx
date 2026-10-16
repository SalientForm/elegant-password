// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { REQUIREMENTS_KEY } from './lib/settingsStore';
import { MEDIUM, NARROW, PHONE } from './components/useMediaQuery';

afterEach(cleanup);
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = '';
});

const cards = () => screen.getAllByRole('article');

describe('App', () => {
  it('shows suggestions, lets one be added to the list, and keeps both across a reload', { timeout: 30_000 }, async () => {
    const first = render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const card = cards()[0]!;
    const password = within(card).getByText((_, el) => el?.classList.contains('password') === true).textContent!;
    fireEvent.click(within(card).getByRole('button', { name: 'Add' }));
    const list = screen.getByRole('list', { name: 'My passwords' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toContain(password);
    expect(list.textContent).toMatch(/Hint:/);
    expect(within(card).getByRole('button', { name: 'Added' })).toBeTruthy();
    const passwords = cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);

    first.unmount();
    render(<App />);
    await waitFor(() => expect(cards().length).toBe(passwords.length));
    const again = cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);
    expect(again).toEqual(passwords);
    expect(within(screen.getByRole('list', { name: 'My passwords' })).getAllByRole('listitem')).toHaveLength(1);
  });

  it('has accessible mode tabs and a status while working', async () => {
    render(<App />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tablist', { name: /sentence/i })).toBeTruthy();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel')).toBeTruthy();
    expect(screen.getByLabelText('Your sentence')).toBeTruthy();
  });
});

describe('App: apply changes', () => {
  const passwordsShown = () => cards().map((c) => within(c).getByText((_, el) => el?.classList.contains('password') === true).textContent);

  it('floats an apply bar only while there are unapplied changes, and applies on request', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull();
    const before = passwordsShown();

    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    const bar = screen.getByRole('region', { name: 'Unapplied changes' });
    expect(bar).toBeTruthy();
    // Nothing applied yet: same passwords, nothing saved.
    expect(passwordsShown()).toEqual(before);
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:requirements:v1')!).comfort).toBe('balanced');

    fireEvent.click(within(bar).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Strict' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull());
    await waitFor(() => expect(passwordsShown()).not.toEqual(before), { timeout: 10_000 });
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:requirements:v1')!).comfort).toBe('strict');
  });

  it('treats a site preset and pasted rules as a draft: nothing is saved until submitted, and Discard undoes them', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const saved = () => JSON.parse(window.localStorage.getItem(REQUIREMENTS_KEY)!) as { minLength: number; maxLength: number; allowSpaces: boolean; minDigits: number };

    fireEvent.click(screen.getByRole('button', { name: /No spaces/ }));
    const bar = screen.getByRole('region', { name: 'Unapplied changes' });
    expect(saved().allowSpaces).toBe(true);
    fireEvent.click(within(bar).getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('button', { name: /Typical site/ }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: "Paste the site's rules" }));
    const box = screen.getByRole('textbox', { name: "The site's password rules" });
    fireEvent.paste(box);
    fireEvent.change(box, { target: { value: 'Password must be 14-40 characters and contain at least 2 numbers.' } });
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy();
    expect(saved()).toMatchObject({ minLength: 12, maxLength: 32, minDigits: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    await waitFor(() => expect(saved()).toMatchObject({ minLength: 14, maxLength: 40, minDigits: 2 }));
    expect(screen.queryByRole('region', { name: 'Unapplied changes' })).toBeNull();
  });

  it('blocks Submit and Refresh while the rules contradict themselves, keeps the last passwords, and shows where to fix it', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const before = passwordsShown();
    fireEvent.change(screen.getByRole('textbox', { name: 'Symbols' }), { target: { value: '' } });
    const bar = screen.getByRole('region', { name: 'Unapplied changes' });
    expect((within(bar).getByRole('button', { name: 'Submit changes' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(bar).getByRole('alert').textContent).toMatch(/A symbol is required, but no symbols are allowed/);
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await new Promise((r) => setTimeout(r, 200));
    expect(passwordsShown()).toEqual(before);
    expect(JSON.parse(window.localStorage.getItem(REQUIREMENTS_KEY)!).allowedSymbols).not.toBe('');
    // "Show" puts focus on the first field at fault.
    fireEvent.click(within(bar).getByRole('button', { name: 'Show' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Symbols' })));
    // Corrected, it submits.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Symbols' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(REQUIREMENTS_KEY)!)).toMatchObject({ allowedSymbols: '', minSymbols: 0 }));
    await waitFor(() => expect(passwordsShown()).not.toEqual(before), { timeout: 10_000 });
  });

  it('turns a typed sentence into passwords when applied, and keeps them across a reload', { timeout: 30_000 }, async () => {
    const first = render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.keyDown(screen.getAllByRole('tab')[0]!, { key: 'ArrowRight' });
    fireEvent.change(screen.getByLabelText('Your sentence'), { target: { value: 'Sally eats sweets on Sundays' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit changes' }));
    // Open the first card's "Why?": it shows the hint, the sentence itself.
    await waitFor(() => {
      const c = cards()[0]!;
      const why = within(c).queryByRole('button', { name: 'Why?' });
      if (why) fireEvent.click(why);
      expect(within(c).getByText(/Sally eats sweets on Sundays/)).toBeTruthy();
    }, { timeout: 10_000 });
    const shown = passwordsShown();
    first.unmount();
    render(<App />);
    await waitFor(() => expect(cards().length).toBe(shown.length));
    expect(passwordsShown()).toEqual(shown);
    expect((screen.getByLabelText('Your sentence') as HTMLTextAreaElement).value).toBe('Sally eats sweets on Sundays');
  });
});

describe('App: order and pages', () => {
  const scores = () => cards().map((c) => Number(within(c).getByText(/^D \d+$/).textContent!.match(/\d+/)![0]));
  const bits = () => cards().map((c) => Number(within(c).getByText(/^S \d+$/).textContent!.match(/\d+/)![0]));

  it('orders by difficulty by default, and by strength or memorability on request', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const easy = scores();
    expect([...easy].sort((a, b) => a - b)).toEqual(easy);
    expect(screen.getByRole('button', { name: 'Difficulty' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    const strong = bits();
    expect([...strong].sort((a, b) => b - a)).toEqual(strong);
    expect(JSON.parse(window.localStorage.getItem('elegant-passwords:sort:v1')!)).toBe('strength');
    fireEvent.click(screen.getByRole('button', { name: 'Memorability' }));
    const memo = cards().map((c) => Number(within(c).getByText(/^M \d+$/).textContent!.match(/\d+/)![0]));
    expect([...memo].sort((a, b) => b - a)).toEqual(memo);
  });

  it('shows the first suggestion\'s sentence under the mode tabs while making one up', async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const shown = screen.getByTestId('generated-sentence').textContent;
    expect(screen.queryByText('Fast to type')).toBeNull(); // every "Why?" starts closed
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Why?' }));
    const firstHint = within(cards()[0]!).getByText((_, el) => el?.classList.contains('hint-line') === true).textContent!.replace('Hint: ', '');
    expect(shown).toBe(firstHint);
    fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
    const top = within(cards()[0]!);
    const why = top.queryByRole('button', { name: 'Why?' });
    if (why) fireEvent.click(why); // a card keeps its own open state when the order changes
    const newFirst = top.getByText((_, el) => el?.classList.contains('hint-line') === true).textContent!.replace('Hint: ', '');
    expect(screen.getByTestId('generated-sentence').textContent).toBe(newFirst); // follows the order
  });

  it('keeps the mode tabs in the sentence card, every suggestion in the Suggestions card, and the strength panel apart', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const sentenceCard = screen.getByRole('tablist', { name: 'How to make the sentence' }).closest('.panel')!;
    expect(sentenceCard.className).toBe('panel sentence-card');
    expect(sentenceCard.contains(screen.getByTestId('generated-sentence'))).toBe(true);
    const suggestions = screen.getByRole('heading', { name: 'Suggestions' }).closest('.panel')!;
    expect(suggestions.className).toBe('panel suggestions');
    expect(suggestions.contains(screen.getByRole('group', { name: 'Order' }))).toBe(true);
    expect(suggestions.contains(screen.getByRole('button', { name: 'Refresh' }))).toBe(true);
    for (const c of cards()) expect(suggestions.contains(c)).toBe(true);
    const strength = screen.getByRole('heading', { name: 'Why this sentence is strong' }).closest('.panel')!;
    expect(suggestions.contains(strength)).toBe(false);
    expect(sentenceCard.contains(strength)).toBe(false);
  });

  it('has a Scoring page with the rubric and the bits explanation, and keeps the typing test and list in the right column', async () => {
    render(<App />);
    expect(screen.getByLabelText('Test and practice')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My list' })).toBeTruthy();
    expect(screen.queryByText('How difficulty is scored')).toBeNull();
    window.location.hash = '#/scoring';
    fireEvent(window, new Event('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Strength, in bits' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeTruthy();
    expect(screen.getByText('Finger rolls')).toBeTruthy();
    // Deliberate swaps come with their words: no memory load, no memorability penalty.
    expect(screen.getByText(/adds nothing to memory load and costs no memorability/)).toBeTruthy();
    expect(screen.getByText(/a deliberate swap costs nothing/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Scoring' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByText(/read like a sentence/)).toBeTruthy(); // the one app description, on every page
  });

  it('shows the title above the tabs with the description beside it and the SalientForm credit', () => {
    render(<App />);
    const title = screen.getByRole('heading', { level: 1 });
    expect(title.textContent).toBe('Thuh Eleg@nt Pa$$word!');
    const nav = screen.getByRole('navigation', { name: 'Pages' });
    expect(title.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // title first, tabs after
    const credit = screen.getByText((_, el) => el?.classList.contains('brand') === true);
    expect(credit.textContent?.replace(/\s+/g, ' ').trim()).toBe('brought to you by SalientForm');
    expect(credit.querySelector('strong')?.textContent).toBe('SalientForm'); // only the name is bold
    const license = screen.getByRole('link', { name: 'MIT License' });
    expect(license.getAttribute('href')).toBe('https://github.com/SalientForm/elegant-password/blob/main/LICENSE');
    expect(credit.compareDocumentPosition(license) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // beneath the credit
    expect(screen.getByText(/read like a sentence/)).toBeTruthy();
  });
});

describe('App in the medium range', () => {
  const mediumScreen = () =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === MEDIUM, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });
  const strips = () => screen.queryAllByRole('button', { expanded: false }).filter((b) => b.className === 'strip-button');
  const shown = (id: string) => !document.getElementById(`section-panel-${id}`)!.hidden;

  it('shows two columns, Options and Suggestions at first with Testing shrunk to a button; the outer columns trade places, Suggestions stays', { timeout: 30_000 }, async () => {
    mediumScreen();
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const main = document.querySelector('main')!;
    expect(main.className).toBe('columns medium outer-options');
    expect(strips().map((b) => `${b.textContent} (${b.parentElement!.className})`)).toEqual(['Testing (strip right)']);
    expect([shown('options'), shown('suggestions'), shown('list')]).toEqual([true, true, false]);
    expect(screen.getByText('Requirement options')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Testing' }));
    expect(main.className).toBe('columns medium outer-list');
    expect(strips().map((b) => `${b.textContent} (${b.parentElement!.className})`)).toEqual(['Options (strip left)']);
    expect([shown('options'), shown('suggestions'), shown('list')]).toEqual([false, true, true]);
    expect(document.activeElement).toBe(document.getElementById('section-panel-list')); // focus follows the opened column
    expect(cards().length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(main.className).toBe('columns medium outer-options');
    expect([shown('options'), shown('suggestions'), shown('list')]).toEqual([true, true, false]);
  });
});

describe('App when too narrow for three columns', () => {
  const narrowScreen = () =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === NARROW || query === MEDIUM, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });
  const strips = () => screen.queryAllByRole('button', { expanded: false }).filter((b) => b.className === 'strip-button');
  const stripLabels = () => strips().map((b) => b.textContent);
  const visibleHeadings = () => screen.getAllByRole('heading').map((h) => h.textContent); // hidden columns are out of the accessibility tree

  it('keeps one column open and shrinks the other two to Options, Suggestions and Testing buttons, in column order', { timeout: 30_000 }, async () => {
    narrowScreen();
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(stripLabels()).toEqual(['Options', 'Testing']); // Suggestions is open at first
    expect(document.getElementById('section-panel-options')!.hidden).toBe(true);
    expect(document.getElementById('section-panel-list')!.hidden).toBe(true);
    expect(screen.queryByRole('textbox', { name: 'Test and practice' })).toBeNull(); // hidden columns are out of the accessibility tree
    const main = document.querySelector('main')!;
    expect(main.className).toBe('columns narrow focus-suggestions');
    // The strips keep their columns' places; the shrunken columns stay in the DOM, hidden. A strip left of the
    // open column reads bottom to top ("left"), one right of it top to bottom ("right").
    expect([...main.children].slice(0, 5).map((c) => `${c.className}${(c as HTMLElement).hidden ? ' (hidden)' : ''}`)).toEqual(['strip left', 'sidebar (hidden)', 'results', 'strip right', 'aside (hidden)']);
    for (const b of strips()) expect(b.getAttribute('aria-controls')).toBe(`section-panel-${b.textContent === 'Options' ? 'options' : 'list'}`);

    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(stripLabels()).toEqual(['Suggestions', 'Testing']);
    expect(main.className).toBe('columns narrow focus-options');
    expect(strips().map((b) => b.parentElement!.className)).toEqual(['strip right', 'strip right']); // both right of the open column
    expect(document.activeElement).toBe(document.getElementById('section-panel-options')); // focus follows the opened column
    expect(screen.getByText('Requirement options')).toBeTruthy();
    expect(screen.getByText('Swaps')).toBeTruthy();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Testing' }));
    expect(stripLabels()).toEqual(['Options', 'Suggestions']);
    expect(strips().map((b) => b.parentElement!.className)).toEqual(['strip left', 'strip left']); // both left of it
    expect(screen.getByRole('textbox', { name: 'Test and practice' })).toBeTruthy();
    expect(visibleHeadings()).toContain('My list');
    expect(visibleHeadings()).not.toContain('Suggestions');
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy(); // the floating buttons follow

    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
    expect(stripLabels()).toEqual(['Options', 'Testing']);
    expect(screen.getByRole('tablist', { name: 'How to make the sentence' })).toBeTruthy();
    expect(cards().length).toBeGreaterThan(0);
  });

  it('keeps a shrunken column mounted, so what was open in it is still open when it comes back', { timeout: 30_000 }, async () => {
    narrowScreen();
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.click(within(cards()[0]!).getByRole('button', { name: 'Why?' }));
    expect(within(cards()[0]!).getByRole('button', { name: 'Hide why' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Testing' }));
    expect(document.getElementById('section-panel-suggestions')!.hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Suggestions' }));
    expect(document.getElementById('section-panel-suggestions')!.hidden).toBe(false);
    expect(within(cards()[0]!).getByRole('button', { name: 'Hide why' })).toBeTruthy();
  });
});

describe('App on a phone', () => {
  const phoneScreen = () =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === NARROW || query === MEDIUM || query === PHONE, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
  afterEach(() => {
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });

  it('gives the open column the whole width under a bar: the page links behind a hamburger at the left, the column tabs centred', { timeout: 30_000 }, async () => {
    phoneScreen();
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const main = document.querySelector('main')!;
    expect(main.className).toBe('columns narrow phone focus-suggestions');
    expect(main.querySelector('.strip')).toBeNull(); // the tabs in the bar do the strips' job
    expect(document.querySelector('.phone-bar > :first-child')!.className).toBe('phone-menu'); // the menu comes first, at the left
    const tabs = within(screen.getByRole('tablist', { name: 'Sections' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Options', 'Suggestions', 'Testing']);
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull(); // the page links are folded away
    expect(document.getElementById('section-panel-options')!.hidden).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Options' }));
    expect(main.className).toBe('columns narrow phone focus-options');
    expect(screen.getByRole('tabpanel', { name: 'Options' })).toBe(document.getElementById('section-panel-options')); // the tab controls the column
    expect(screen.getByText('Requirement options')).toBeTruthy();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Testing' }));
    expect(screen.getByRole('textbox', { name: 'Test and practice' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Suggestions' }));
    expect(cards().length).toBeGreaterThan(0);

    const menu = screen.getByRole('button', { name: 'Pages' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(menu.getAttribute('aria-controls')).toBe('phone-pages');
    expect(document.getElementById('phone-pages')!.hidden).toBe(true); // the menu it controls exists, hidden, while closed
    fireEvent.click(menu);
    expect(document.getElementById('phone-pages')!.hidden).toBe(false);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const links = within(screen.getByRole('navigation', { name: 'Pages' })).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Passwords', 'Scoring', 'Fun']);
    expect(links[0]!.getAttribute('aria-current')).toBe('page');
    within(screen.getByRole('navigation', { name: 'Pages' })).getByRole('link', { name: 'Scoring' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull(); // Escape closes the menu
    expect(document.activeElement).toBe(menu); // and focus returns to the hamburger rather than dropping to the body
    fireEvent.click(menu);
    window.location.hash = '#/scoring';
    fireEvent(window, new Event('hashchange'));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Difficulty, 0 to 100' })).toBeTruthy());
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull(); // choosing a page closes it
    expect(screen.queryByRole('tablist', { name: 'Sections' })).toBeNull(); // no columns here: the page's name stands in
    expect(document.querySelector('.phone-page')!.textContent).toBe('Scoring');
    window.location.hash = '';
  });
});

describe('App: Enter inside forms and number fields', () => {
  it('lets Enter in the add-mapping form add the mapping even while changes are pending, instead of submitting the draft', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Strict' })); // a pending draft
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy();
    const replace = screen.getByLabelText('Replace') as HTMLInputElement;
    const withField = screen.getByLabelText('With') as HTMLInputElement;
    fireEvent.change(replace, { target: { value: 'cat' } });
    fireEvent.change(withField, { target: { value: 'k@' } });
    expect(fireEvent.keyDown(withField, { key: 'Enter' })).toBe(true); // not prevented: the form's own submission goes ahead
    expect(screen.getByRole('region', { name: 'Unapplied changes' })).toBeTruthy(); // and the draft was not submitted by it
    fireEvent.submit(withField.closest('form')!);
    expect(screen.getByRole('button', { name: /Remove cat to k@/ })).toBeTruthy();
  });

  it('applies the clamped number a field shows when Enter is pressed in it, not an earlier valid prefix', { timeout: 30_000 }, async () => {
    render(<App />);
    await waitFor(() => expect(cards().length).toBeGreaterThan(0), { timeout: 10_000 });
    const count = screen.getByLabelText('Suggestions') as HTMLInputElement;
    fireEvent.focus(count);
    fireEvent.change(count, { target: { value: '3' } }); // "3" on the way to "30": committed as a draft
    fireEvent.change(count, { target: { value: '30' } }); // over the maximum of 20: not committed
    fireEvent.keyDown(count, { key: 'Enter' });
    await waitFor(() => expect(JSON.parse(localStorage.getItem(REQUIREMENTS_KEY)!).count).toBe(20));
    expect(count.value).toBe('20');
  });
});

describe('App header', () => {
  it('is one header holding the title area and the page tabs on desktop; on a phone the sticky bar sits outside it', { timeout: 30_000 }, async () => {
    const { unmount } = render(<App />);
    const header = screen.getByRole('banner');
    expect(header.className).toBe('app-header');
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe('Thuh Eleg@nt Pa$$word!');
    expect(within(header).getByRole('navigation', { name: 'Pages' })).toBeTruthy();
    unmount();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === NARROW || query === MEDIUM || query === PHONE, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }),
    });
    try {
      render(<App />);
      const phoneHeader = screen.getByRole('banner');
      expect(within(phoneHeader).getByRole('heading', { level: 1 })).toBeTruthy();
      expect(phoneHeader.querySelector('.phone-bar')).toBeNull(); // the bar must stick on its own, so it is not inside the header
      expect(document.querySelector('.phone-bar')).toBeTruthy();
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
  });
});
