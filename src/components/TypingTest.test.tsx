// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { difficultyAlone, scoreCold } from '../lib/score';
import { strengthBits } from '../lib/strength';
import { SELECTED_KEY } from '../state/selectedStore';
import { memoryStore } from '../state/storage';
import { PasswordsProvider, usePasswords } from '../state/PasswordsProvider';
import { MANAGER_OPT_OUT, TypingTest } from './TypingTest';

afterEach(cleanup);

/** Type into the field key by key, `gap` ms apart, with "<" meaning Backspace. */
function typeInto(input: HTMLInputElement, text: string, clock: { t: number }, gap = 100) {
  let value = input.value;
  for (const ch of text) {
    clock.t += gap;
    if (ch === '<') {
      fireEvent.keyDown(input, { key: 'Backspace' });
      value = value.slice(0, -1);
    } else {
      fireEvent.keyDown(input, { key: ch });
      value += ch;
    }
    fireEvent.change(input, { target: { value } });
  }
}
const enter = (input: HTMLInputElement, clock: { t: number }, gap = 100) => {
  clock.t += gap;
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('TypingTest', () => {
  it('scores the first run from the recorded keystrokes and sets it as the password under test', () => {
    const clock = { t: 0 };
    render(<TypingTest now={() => clock.t} />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    typeInto(input, 'Sleepy;otterx<s', clock);
    enter(input, clock);
    const result = screen.getByRole('status');
    expect(result.textContent).toContain('Testing:');
    expect(result.textContent).toContain('Sleepy;otters');
    expect(result.textContent).toMatch(/Typed correctly/);
    expect(result.textContent).toMatch(/1 correction/);
    expect(result.textContent).toMatch(/1\.5 s for 13 characters/); // first key to Enter: 15 keys 100 ms apart
    expect(result.textContent).toMatch(/Strength \d+/); // strength from the text alone
    expect(result.textContent).toMatch(/Difficulty \d+/);
    expect(result.textContent).toContain('Memorability n/a'); // no hint, so no memorability
    expect(input.value).toBe(''); // ready for the next run
  });

  it('keeps the password under test through mistyped runs until Clear, and takes a typed-in hint', () => {
    const clock = { t: 0 };
    render(<TypingTest now={() => clock.t} />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull(); // nothing to clear yet
    typeInto(input, 'abc', clock);
    enter(input, clock);
    // A different entry is a mistyped run, not a new target.
    typeInto(input, 'abd', clock);
    enter(input, clock);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Testing: abc');
    expect(status.textContent).toMatch(/Did not match/);
    expect(status.textContent).toMatch(/Previous runs:/);
    // Enter on an empty field does nothing.
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toContain('Testing: abc');
    // A hint can be added by hand; memorability then scores.
    const hintField = screen.getByLabelText('Hint for the password under test') as HTMLInputElement;
    expect(hintField.placeholder).toBe('none yet: type one to score memorability');
    expect(within(status).getByText('Memorability n/a')).toBeTruthy();
    fireEvent.change(hintField, { target: { value: 'a b c' } });
    expect(within(screen.getByRole('status')).getByText(/^Memorability \d+$/)).toBeTruthy();
    // The cancel icon next to the password under test drops it; the next run sets a new one.
    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect(clearButton.closest('.testing-row')).toBeTruthy(); // beside "Testing:"
    expect(clearButton.querySelector('svg')).toBeTruthy(); // an icon, not a word
    fireEvent.click(clearButton);
    expect(screen.queryByRole('status')).toBeNull();
    typeInto(input, 'xyz', clock);
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toContain('Testing: xyz');
  });

  it('treats a paste as choosing the password to test, with its hint when it is a known one', () => {
    const local = memoryStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'jr;B;5ls;Fpc', hint: 'jupiter brings 5 leds for piece', addedAt: '2026-10-15T00:00:00.000Z' }]));
    const clock = { t: 0 };
    render(
      <PasswordsProvider local={local} session={memoryStore()} debounceMs={0}>
        <TypingTest now={() => clock.t} />
      </PasswordsProvider>,
    );
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    // An unknown password: it becomes the target, with no hint, and nothing lands in the field.
    fireEvent.paste(input, { clipboardData: { getData: () => 'Pasted;secret;42\n' } });
    expect(input.value).toBe('');
    expect(screen.getByRole('status').textContent).toContain('Testing: Pasted;secret;42');
    expect((screen.getByLabelText('Hint for the password under test') as HTMLInputElement).value).toBe(''); // unknown: a hint may be typed in
    // A password that is in the list brings its hint along, and that hint is not editable.
    fireEvent.paste(input, { clipboardData: { getData: () => 'jr;B;5ls;Fpc' } });
    expect(screen.getByRole('status').textContent).toContain('Hint: jupiter brings 5 leds for piece');
    expect(screen.queryByLabelText('Hint for the password under test')).toBeNull();
    expect(within(screen.getByRole('status')).getByText(/^Memorability \d+$/)).toBeTruthy();
    // Typing it afterwards is checked against it.
    typeInto(input, 'jr;B;5ls;Fpc', clock);
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toMatch(/Typed correctly/);
    // An empty paste changes nothing; spaces alone are refused, and say so.
    fireEvent.paste(input, { clipboardData: { getData: () => '' } });
    expect(screen.getByRole('status').textContent).toContain('Testing: jr;B;5ls;Fpc');
    fireEvent.paste(input, { clipboardData: { getData: () => '  ' } });
    expect(screen.getByRole('status').textContent).toContain('Testing: jr;B;5ls;Fpc');
    expect(screen.getByRole('alert').textContent).toContain('only spaces');
  });

  it('keeps a pasted password exactly, spaces at either end included, and refuses more than one line', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    fireEvent.paste(input, { clipboardData: { getData: () => '  Audit Secret  ' } });
    expect(screen.getByRole('status').querySelector('.password')?.textContent).toBe('  Audit Secret  ');
    fireEvent.paste(input, { clipboardData: { getData: () => 'first line\nsecond line' } });
    expect(screen.getByRole('alert').textContent).toContain('more than one line');
    expect(screen.getByRole('status').querySelector('.password')?.textContent).toBe('  Audit Secret  '); // the old one stands
    fireEvent.paste(input, { clipboardData: { getData: () => 'one line\r\n' } }); // a line copied whole brings its line break
    expect(screen.getByRole('status').querySelector('.password')?.textContent).toBe('one line');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('leaves Enter alone while an IME is composing', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'かな' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(input.value).toBe('かな'); // no run: the Enter accepted a candidate
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('measures a soft keyboard that names no keys from how the text changes', () => {
    const clock = { t: 0 };
    render(<TypingTest now={() => clock.t} />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    for (const value of ['c', 'ca', 'cat', 'ca', 'cat']) {
      clock.t += 200;
      fireEvent.keyDown(input, { key: 'Unidentified' });
      fireEvent.change(input, { target: { value } });
    }
    clock.t += 200;
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toMatch(/1 correction \(Backspace or Delete\).*over 5 keystrokes/);
  });

  it('says a common password is not allowed', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    fireEvent.paste(input, { clipboardData: { getData: () => 'dragon' } });
    expect(screen.getByRole('alert').textContent).toMatch(/Not allowed: number \d+ of the 10,001 most common passwords/);
  });

  it('can hide the text as it is typed, and gives password managers nothing to latch on to', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.autocomplete).toBe('off');
    for (const [attr, value] of Object.entries(MANAGER_OPT_OUT)) expect(input.getAttribute(attr), attr).toBe(value);
    expect(input.closest('form')).toBeNull(); // not a login form either
    for (const attr of ['name', 'id', 'aria-label', 'placeholder', 'autocomplete']) expect(input.getAttribute(attr) ?? '', attr).not.toMatch(/pass|pwd|login|user/i);
    fireEvent.click(screen.getByLabelText('Show as typed'));
    expect(input.type).toBe('text'); // hidden by CSS masking, never a password-type input
    expect(input.className).toMatch(/masked/);
  });

  it('takes the password last added to the list, with its hint, and scores all three badges; a typed one has no hint', () => {
    const local = memoryStore();
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: 'Old;one', hint: 'old one', addedAt: '2026-10-15T00:00:00.000Z' }]));
    const clock = { t: 0 };
    function Adder() {
      const p = usePasswords();
      return <button onClick={() => p.addSelected({ password: '13;Worthy;storks;openly;pet;twisty;toys', hint: '13 worthy storks openly pet twisty toys' })}>add</button>;
    }
    render(
      <PasswordsProvider local={local} session={memoryStore()} debounceMs={0}>
        <Adder />
        <TypingTest now={() => clock.t} />
      </PasswordsProvider>,
    );
    // On mount the latest list entry is under test, with its hint shown as text: not editable.
    expect(screen.getByRole('status').textContent).toContain('Testing: Old;one');
    expect(screen.getByRole('status').textContent).toContain('Hint: old one');
    expect(screen.queryByLabelText('Hint for the password under test')).toBeNull();
    fireEvent.click(screen.getByText('add'));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Testing: 13;Worthy;storks;openly;pet;twisty;toys');
    expect(status.textContent).toContain('Hint: 13 worthy storks openly pet twisty toys');
    expect(screen.queryByLabelText('Hint for the password under test')).toBeNull();
    const cold = scoreCold('13;Worthy;storks;openly;pet;twisty;toys', '13 worthy storks openly pet twisty toys');
    expect(within(status).getByText(`Strength ${Math.round(strengthBits('13;Worthy;storks;openly;pet;twisty;toys'))}`)).toBeTruthy();
    expect(within(status).getByText(/^Raw \d+$/)).toBeTruthy();
    expect(within(status).getByText(`Difficulty ${cold.difficulty.score}`)).toBeTruthy();
    expect(within(status).getByText(`Memorability ${cold.memorability.score}`)).toBeTruthy();
    // After Clear, a password typed in by hand is next: no hint, so no memorability; difficulty from the text alone (strength never needs a hint).
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    typeInto(input, 'xyzzy-42', clock);
    enter(input, clock);
    const after = screen.getByRole('status');
    expect(after.textContent).toContain('Testing: xyzzy-42');
    expect((screen.getByLabelText('Hint for the password under test') as HTMLInputElement).value).toBe(''); // editable: it arrived without one
    expect(within(after).getByText('Memorability n/a')).toBeTruthy();
    expect(within(after).getByText(`Strength ${Math.round(strengthBits('xyzzy-42'))}`)).toBeTruthy();
    expect(within(after).getByText(`Difficulty ${difficultyAlone('xyzzy-42').score}`)).toBeTruthy();
  });

  it('cuts a long password under test with an ellipsis, and a click shows the whole of it, like the list', () => {
    const local = memoryStore();
    const long = '13;Worthy;storks;openly;pet;twisty;toys;and;more;words;yet';
    local.setItem(SELECTED_KEY, JSON.stringify([{ password: long, hint: '13 worthy storks openly pet twisty toys and more words yet', addedAt: '2026-10-15T00:00:00.000Z' }]));
    render(
      <PasswordsProvider local={local} session={memoryStore()} debounceMs={0}>
        <TypingTest />
      </PasswordsProvider>,
    );
    const code = screen.getByText(long);
    expect(code.className).toContain('password'); // the same one-line, ellipsis style as My list
    expect(code.getAttribute('title')).toBeNull(); // the browser's tooltip is never used
    expect(code.getAttribute('role')).toBeNull(); // it fits (jsdom has no layout), so it is plain text
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 120 });
    try {
      // Masked, the dots are what is shown, cut off and revealed alike: hiding the text hides it everywhere.
      fireEvent.click(screen.getByLabelText('Show as typed'));
      const dots = '•'.repeat(long.length);
      const masked = screen.getByRole('button', { name: dots });
      fireEvent.click(masked);
      expect(masked.getAttribute('aria-expanded')).toBe('true');
      expect(masked.textContent).toBe(dots);
    } finally {
      delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    }
  });
});

describe('TypingTest with characters off the US keyboard', () => {
  it('scores a run such as “café” instead of taking the page down', () => {
    const clock = { t: 0 };
    render(
      <PasswordsProvider local={memoryStore()} session={memoryStore()} debounceMs={0}>
        <TypingTest now={() => clock.t} />
      </PasswordsProvider>,
    );
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    typeInto(input, 'café£1', clock);
    enter(input, clock);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Testing: café£1');
    expect(status.textContent).toContain('Typed correctly');
    expect(within(status).getByText(/^Strength \d+$/)).toBeTruthy();
    expect(within(status).getByText(/^Difficulty \d+$/)).toBeTruthy();
  });
});

describe('TypingTest and the list shrinking', () => {
  it('keeps the password under test, and its runs, when the latest list entry is removed; only an addition retargets', () => {
    const local = memoryStore();
    local.setItem(
      SELECTED_KEY,
      JSON.stringify([
        { password: 'Old;one', hint: 'old one', addedAt: '2026-10-15T00:00:00.000Z' },
        { password: 'New;two', hint: 'new two', addedAt: '2026-10-15T01:00:00.000Z' },
      ]),
    );
    const clock = { t: 0 };
    function Remover() {
      const p = usePasswords();
      return <button onClick={() => p.removeSelected('New;two')}>remove latest</button>;
    }
    render(
      <PasswordsProvider local={local} session={memoryStore()} debounceMs={0}>
        <Remover />
        <TypingTest now={() => clock.t} />
      </PasswordsProvider>,
    );
    expect(screen.getByRole('status').textContent).toContain('Testing: New;two');
    const input = screen.getByLabelText('Typing test') as HTMLInputElement;
    typeInto(input, 'New;two', clock);
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toContain('Typed correctly');
    fireEvent.click(screen.getByText('remove latest'));
    expect(screen.getByRole('status').textContent).toContain('Testing: New;two'); // still, with its run
    expect(screen.getByRole('status').textContent).toContain('Typed correctly');
  });
});
