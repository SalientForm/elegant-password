// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    const input = screen.getByLabelText('Password to test') as HTMLInputElement;
    typeInto(input, 'Sleepy;otterx<s', clock);
    enter(input, clock);
    const result = screen.getByRole('status');
    expect(result.textContent).toContain('Testing:');
    expect(result.textContent).toContain('Sleepy;otters');
    expect(result.textContent).toMatch(/Typed correctly/);
    expect(result.textContent).toMatch(/1 correction/);
    expect(result.textContent).toMatch(/1\.5 s for 13 characters/); // first key to Enter: 15 keys 100 ms apart
    expect(result.textContent).toMatch(/≈\d+ bits/);
    expect(result.textContent).toMatch(/Difficulty \d+/);
    expect(input.value).toBe(''); // ready for the next run
  });

  it('checks later runs against the target, and the lock keeps the target through a mistyped Enter', () => {
    const clock = { t: 0 };
    render(<TypingTest now={() => clock.t} />);
    const input = screen.getByLabelText('Password to test') as HTMLInputElement;
    typeInto(input, 'abc', clock);
    enter(input, clock);
    // Unlocked: a different entry becomes the new target.
    typeInto(input, 'abd', clock);
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toContain('Testing: abd');
    // Locked: a mistake is reported and the target stays.
    fireEvent.click(screen.getByLabelText('Lock password'));
    typeInto(input, 'abx', clock);
    enter(input, clock);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Testing: abd');
    expect(status.textContent).toMatch(/Did not match/);
    expect(status.textContent).toMatch(/\(locked\)/);
    expect(status.textContent).toMatch(/Previous runs:/);
    // Enter on an empty field does nothing.
    enter(input, clock);
    expect(screen.getByRole('status').textContent).toContain('Testing: abd');
  });

  it('can hide the text as it is typed, and tells password managers to leave the field alone', () => {
    render(<TypingTest />);
    const input = screen.getByLabelText('Password to test') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.autocomplete).toBe('off');
    for (const [attr, value] of Object.entries(MANAGER_OPT_OUT)) expect(input.getAttribute(attr), attr).toBe(value);
    expect(input.closest('form')).toBeNull(); // not a login form either
    fireEvent.click(screen.getByLabelText('Show as typed'));
    expect(input.type).toBe('password');
    for (const attr of Object.keys(MANAGER_OPT_OUT)) expect(input.getAttribute(attr), attr).toBeTruthy();
  });
});
