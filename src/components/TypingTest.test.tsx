// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syncGenerator } from '../lib/generator';
import { scoreAlone, scoreCold } from '../lib/score';
import { SELECTED_KEY } from '../lib/selectedStore';
import { memoryStore } from '../lib/storage';
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
    const input = screen.getByLabelText('Test and practice') as HTMLInputElement;
    typeInto(input, 'Sleepy;otterx<s', clock);
    enter(input, clock);
    const result = screen.getByRole('status');
    expect(result.textContent).toContain('Testing:');
    expect(result.textContent).toContain('Sleepy;otters');
    expect(result.textContent).toMatch(/Typed correctly/);
    expect(result.textContent).toMatch(/1 correction/);
    expect(result.textContent).toMatch(/1\.5 s for 13 characters/); // first key to Enter: 15 keys 100 ms apart
    expect(result.textContent).toMatch(/S \d+/); // strength from the text alone
    expect(result.textContent).toMatch(/D \d+/);
    expect(result.textContent).toContain('M n/a'); // no hint, so no memorability
    expect(input.value).toBe(''); // ready for the next run
  });

  it('keeps the password under test through mistyped runs until Clear, and takes a typed-in hint', () => {
    const clock = { t: 0 };
    render(<TypingTest now={() => clock.t} />);
    const input = screen.getByLabelText('Test and practice') as HTMLInputElement;
    expect((screen.getByRole('button', { name: 'Clear' }) as HTMLButtonElement).disabled).toBe(true);
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
    expect(hintField.placeholder).toBe('(hint n/a)');
    expect(within(status).getByText('M n/a')).toBeTruthy();
    fireEvent.change(hintField, { target: { value: 'a b c' } });
    expect(within(screen.getByRole('status')).getByText(/^M \d+$/)).toBeTruthy();
    // Clear drops the password under test; the next run sets a new one.
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
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
      <PasswordsProvider generator={syncGenerator()} local={local} session={memoryStore()} debounceMs={0}>
        <TypingTest now={() => clock.t} />
      </PasswordsProvider>,
    );
    const input = screen.getByLabelText('Test and practice') as HTMLInputElement;
    // An unknown password: it becomes the target, with no hint, and nothing lands in the field.
    fireEvent.paste(input, { clipboardData: { getData: () => 'Pasted;secret;42\n' } });
    expect(input.value).toBe('');
    expect(screen.getByRole('status').textContent).toContain('Testing: Pasted;secret;42');
    expect((screen.getByLabelText('Hint for the password under test') as HTMLInputElement).value).toBe(''); // unknown: a hint may be typed in
    // A password that is in the list brings its hint along, and that hint is not editable.
    fireEvent.paste(input, { clipboardData: { getData: () => 'jr;B;5ls;Fpc' } });
    expect(screen.getByRole('status').textContent).toContain('Hint: jupiter brings 5 leds for piece');
    expect(screen.queryByLabelText('Hint for the password under test')).toBeNull();
    expect(within(screen.getByRole('status')).getByText(/^M \d+$/)).toBeTruthy();
    // Typing it afterwards is checked against it.
    typeInto(input, 'jr;B;5ls;Fpc', clock);
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toMatch(/Typed correctly/);
    // An empty paste changes nothing.
    fireEvent.paste(input, { clipboardData: { getData: () => '  ' } });
    expect(screen.getByRole('status').textContent).toContain('Testing: jr;B;5ls;Fpc');
  });

  it('can hide the text as it is typed, and gives password managers nothing to latch on to', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Test and practice') as HTMLInputElement;
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
      <PasswordsProvider generator={syncGenerator()} local={local} session={memoryStore()} debounceMs={0}>
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
    expect(within(status).getByText(`S ${cold.bits.toFixed(0)}`)).toBeTruthy();
    expect(within(status).getByText(`D ${cold.difficulty.score}`)).toBeTruthy();
    expect(within(status).getByText(`M ${cold.memorability.score}`)).toBeTruthy();
    // After Clear, a password typed in by hand is next: no hint, so no memorability; strength and difficulty from the text alone.
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    const input = screen.getByLabelText('Test and practice') as HTMLInputElement;
    typeInto(input, 'xyzzy-42', clock);
    enter(input, clock);
    const after = screen.getByRole('status');
    expect(after.textContent).toContain('Testing: xyzzy-42');
    expect((screen.getByLabelText('Hint for the password under test') as HTMLInputElement).value).toBe(''); // editable: it arrived without one
    expect(within(after).getByText('M n/a')).toBeTruthy();
    expect(within(after).getByText(`S ${scoreAlone('xyzzy-42').bits.toFixed(0)}`)).toBeTruthy();
    expect(within(after).getByText(`D ${scoreAlone('xyzzy-42').difficulty.score}`)).toBeTruthy();
  });
});
