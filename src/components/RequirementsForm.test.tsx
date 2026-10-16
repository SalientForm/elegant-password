// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { RequirementsForm } from './RequirementsForm';
import { SETTLE_MS } from './useShownProblems';

afterEach(cleanup);

function Harness({ initial = DEFAULT_REQUIREMENTS }: { initial?: Requirements }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <RequirementsForm value={value} onChange={setValue} />
      <output data-testid="req">{JSON.stringify(value)}</output>
    </>
  );
}
const req = () => JSON.parse(screen.getByTestId('req').textContent!) as Requirements;
const pasteStatus = () => within(document.getElementById('paste-rules')!).getByRole('status');

describe('RequirementsForm', () => {
  it('edits lengths, counts, the allowed symbols and spaces', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '40' } });
    expect(req().maxLength).toBe(40);
    fireEvent.change(screen.getByLabelText('Minimum'), { target: { value: '16' } });
    expect(req().minLength).toBe(16);
    fireEvent.change(screen.getByLabelText('Suggestions'), { target: { value: '8' } });
    expect(req().count).toBe(8);
    fireEvent.change(screen.getByRole('textbox', { name: 'Symbols' }), { target: { value: '@#' } });
    expect(req().allowedSymbols).toBe('@#');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Spaces' }));
    expect(req().allowSpaces).toBe(false);
  });

  it('turns "must contain" rules on and off and sets their counts', () => {
    render(<Harness />);
    const digits = screen.getByRole('checkbox', { name: 'Digits' });
    const atLeast = screen.getByLabelText('Minimum digits') as HTMLInputElement;
    fireEvent.change(atLeast, { target: { value: '3' } });
    expect(req().minDigits).toBe(3);
    fireEvent.click(digits);
    expect(req().minDigits).toBe(0);
    expect(atLeast.disabled).toBe(true);
    fireEvent.click(digits);
    expect(req().minDigits).toBe(1);
    // The number is implied once digits are required.
    const number = screen.getByRole('checkbox', { name: /Include a number/ }) as HTMLInputElement;
    expect(number.checked).toBe(true);
    expect(number.disabled).toBe(true);
    fireEvent.click(digits);
    expect(number.disabled).toBe(false);
    fireEvent.click(number);
    expect(req().includeNumber).toBe(false);
  });

  it('sets the strength preset, comfort, the pinky rule and the shape options', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Master password/ }));
    expect(req().targetBits).toBe(72);
    expect(screen.getByRole('button', { name: /Master password/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Custom target (bits)'), { target: { value: '55' } });
    expect(req().targetBits).toBe(55);
    fireEvent.click(screen.getByRole('button', { name: 'Strict' }));
    expect(req().comfort).toBe('strict');
    expect(screen.getByText(/Only the easiest 40%/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avoid pinky stretches' }));
    expect(req().avoidPinkyStretch).toBe(false);
    expect(req().easeSwaps).toBe(true); // on by default
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ease awkward words with deliberate swaps' }));
    expect(req().easeSwaps).toBe(false);
    const twos = screen.getAllByRole('button', { name: '2' });
    fireEvent.click(twos[0]!); // initials
    fireEvent.click(twos[1]!); // two-letter words
    fireEvent.click(twos[2]!); // made-up nouns
    expect(req()).toMatchObject({ initials: 2, shorthand: 2, madeUp: 2 });
    fireEvent.click(screen.getByRole('checkbox', { name: /Glue numbers/ }));
    expect(req().glue).toBe(true);
  });

  it('sets the site rules from a preset, leaving strength, comfort, style and swaps alone, and marks the preset that matches', () => {
    const mine = { ...DEFAULT_REQUIREMENTS, targetBits: 60, comfort: 'strict' as const, separator: 'auto', twists: 3, initials: 1, glue: true };
    render(<Harness initial={mine} />);
    const pressed = () => screen.getAllByRole('button', { pressed: true }).map((b) => b.querySelector('strong')?.textContent ?? b.textContent);
    expect(pressed()).toContain('Typical site');
    fireEvent.click(screen.getByRole('button', { name: /Short max \(16\)/ }));
    expect(req()).toEqual({ ...mine, minLength: 8, maxLength: 16, minUppercase: 1, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%&*', allowSpaces: false });
    expect(pressed()).toContain('Short max (16)');
    expect(pressed()).not.toContain('Typical site');
    // Any edit away from the preset's rules un-marks it; editing back marks it again.
    fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '18' } });
    expect(screen.getByRole('button', { name: /Short max \(16\)/ }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '16' } });
    expect(screen.getByRole('button', { name: /Short max \(16\)/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /NIST passphrase/ }));
    expect(req()).toMatchObject({ minLength: 15, maxLength: 64, minUppercase: 0, minDigits: 0, minSymbols: 0, allowSpaces: true, targetBits: 60, comfort: 'strict' });
  });

  it('sets a separator a preset rules out to Automatic, says so beside the presets, and shows no error', () => {
    render(<Harness initial={{ ...DEFAULT_REQUIREMENTS, separator: ';' }} />);
    fireEvent.click(screen.getByRole('button', { name: /No symbols/ }));
    expect(req()).toMatchObject({ separator: 'auto', allowedSymbols: '', minSymbols: 0, allowSpaces: false });
    expect(screen.getByText('No symbols: separator set to Auto (none), as ";" is not allowed.').getAttribute('role')).toBe('status');
    expect(document.querySelector('.field-error')).toBeNull();
    expect(screen.getByRole('button', { name: 'Auto' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/^Auto: none, so the words run together under these rules/)).toBeTruthy();
    // The note is about that tap: it goes once the form moves on.
    fireEvent.click(screen.getByRole('button', { name: /Typical site/ }));
    expect(screen.queryByText(/separator set to Auto/)).toBeNull();
    expect(screen.getByText(/^Auto: ";" under these rules/)).toBeTruthy();
    // A separator the preset allows is left alone, with nothing to say.
    fireEvent.change(screen.getByLabelText('Separator symbol'), { target: { value: '#' } });
    fireEvent.click(screen.getByRole('button', { name: /Short max \(16\)/ }));
    expect(req().separator).toBe('#');
    expect(screen.queryByText(/separator set to Auto/)).toBeNull();
  });

  it('shows each contradiction beside the fields at fault, marks them, and clears it once fixed', () => {
    render(<Harness />);
    const max = screen.getByLabelText('Maximum');
    fireEvent.change(max, { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Minimum'), { target: { value: '20' } });
    expect(screen.getByText('The minimum length (20) is above the maximum (10).').closest('#problems-length')).toBeTruthy();
    expect(max.getAttribute('aria-invalid')).toBe('true');
    expect(max.getAttribute('aria-describedby')).toBe('problems-length');
    expect(screen.getByLabelText('Minimum').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(max, { target: { value: '30' } });
    expect(screen.queryByText(/is above the maximum/)).toBeNull();
    expect(max.getAttribute('aria-invalid')).toBeNull();

    // The user's own example: symbols required, and the symbols field emptied.
    const symbols = screen.getByRole('textbox', { name: 'Symbols' });
    fireEvent.change(symbols, { target: { value: '' } });
    expect(screen.getByText(/^A symbol is required, but no symbols are allowed\./).closest('#problems-allows')).toBeTruthy();
    expect(symbols.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Minimum symbols').getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Symbols' })); // untick: no longer required
    expect(document.querySelector('.field-error')).toBeNull();

    // More required characters than the maximum allows.
    fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Minimum'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Minimum uppercase letters'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Minimum digits'), { target: { value: '4' } });
    expect(document.querySelector('.field-error')).toBeNull(); // 12 fits exactly
    fireEvent.change(screen.getByLabelText('Maximum'), { target: { value: '11' } });
    expect(screen.getByText('8 uppercase letters + 4 digits need at least 12 characters, more than the maximum of 11.')).toBeTruthy();
    expect(screen.getByLabelText('Minimum digits').getAttribute('aria-describedby')).toBe('problems-length');
  });

  it('says which characters in the symbols field are not used, without blocking anything', () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Symbols' }), { target: { value: '!@ aé' } });
    expect(screen.getByText(/^Not used: space "a" "é"\. Only keyboard symbols count here; letters and digits are always allowed, and spaces go by the Spaces box\.$/)).toBeTruthy();
    expect(document.querySelector('.field-error')).toBeNull();
  });

  it('fills in the rules from pasted text, says what it understood, and leaves the rest alone', () => {
    const mine = { ...DEFAULT_REQUIREMENTS, targetBits: 50, separator: 'auto' };
    render(<Harness initial={mine} />);
    const toggle = screen.getByRole('button', { name: "Paste the site's rules" });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const box = screen.getByRole('textbox', { name: "The site's password rules" });
    // Typed text is previewed, not applied, until "Fill in".
    fireEvent.change(box, { target: { value: 'Must be 8-20 characters and include at least one number and one of !@#$%' } });
    expect(pasteStatus().textContent).toBe('Understood: 8-20 characters, a digit, a symbol from !@#$%.');
    expect(req()).toEqual(mine);
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    expect(req()).toEqual({ ...mine, minLength: 8, maxLength: 20, minDigits: 1, minSymbols: 1, allowedSymbols: '!@#$%' });
    expect(pasteStatus().textContent).toBe('Filled in: 8-20 characters, a digit, a symbol from !@#$%.');
  });

  it('fills in at once when text is pasted', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: "Paste the site's rules" }));
    const box = screen.getByRole('textbox', { name: "The site's password rules" });
    fireEvent.paste(box);
    fireEvent.change(box, { target: { value: '• 10-16 characters\n• No spaces' } });
    expect(req()).toMatchObject({ minLength: 10, maxLength: 16, allowSpaces: false });
    expect(pasteStatus().textContent).toBe('Filled in: 10-16 characters, no spaces.');
    // Typing afterwards goes back to previewing.
    fireEvent.change(box, { target: { value: '• 10-16 characters\n• No spaces\n• Max 12' } });
    expect(req().maxLength).toBe(16);
  });

  it('never leaves pasted rules contradicting the separator: it becomes Automatic and the message says so', () => {
    render(<Harness initial={{ ...DEFAULT_REQUIREMENTS, separator: ';' }} />);
    fireEvent.click(screen.getByRole('button', { name: "Paste the site's rules" }));
    const box = screen.getByRole('textbox', { name: "The site's password rules" });
    fireEvent.paste(box);
    fireEvent.change(box, { target: { value: 'Use letters and numbers only. No spaces.' } });
    expect(req()).toMatchObject({ separator: 'auto', allowedSymbols: '', minSymbols: 0, allowSpaces: false });
    expect(pasteStatus().textContent).toBe('Filled in: no symbols, no spaces, separator set to Auto (none), as ";" is not allowed.');
    expect(document.querySelector('.field-error')).toBeNull();
  });

  it('says so plainly and changes nothing when the text holds no rules', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: "Paste the site's rules" }));
    const box = screen.getByRole('textbox', { name: "The site's password rules" });
    fireEvent.change(box, { target: { value: 'Welcome back! Sign in to continue.' } });
    expect(pasteStatus().textContent).toBe('No password rules recognised yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' }));
    expect(pasteStatus().textContent).toBe('No password rules found in that text; nothing changed.');
    expect(req()).toEqual(DEFAULT_REQUIREMENTS);
  });

  it('offers Automatic, Space, None or a symbol of your own as the separator, and explains each choice or its problem', () => {
    render(<Harness initial={{ ...DEFAULT_REQUIREMENTS, allowedSymbols: ';-' }} />);
    const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
    const field = screen.getByLabelText('Separator symbol') as HTMLInputElement;
    expect(pressed('Auto')).toBe('true'); // the default
    expect(field.value).toBe('');
    expect(screen.getByText(/^Auto: ";" under these rules\. It is ";" whenever the site allows it/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '-' } });
    expect(req().separator).toBe('-');
    expect(pressed('Auto')).toBe('false');
    expect(field.className).toContain('active');
    expect(screen.getByText(/pinky stretch; kept because you chose it/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '#' } });
    expect(req().separator).toBe('#');
    expect(screen.getByText('"#" is chosen as the separator, but it is not an allowed symbol. Choose Auto to use one the site allows.')).toBeTruthy();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(field, { target: { value: 'x' } });
    expect(screen.getByText(/not a letter or digit/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '' } });
    expect(req().separator).toBe('auto'); // emptied: back to Automatic
    fireEvent.click(screen.getByRole('button', { name: 'Space' }));
    expect(req().separator).toBe(' ');
    expect(screen.getByText(/typed with the thumb/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Separator between words' })).getByRole('button', { name: 'None' }));
    expect(req().separator).toBe('');
    expect(screen.getByText('None: the words run together.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(req().separator).toBe('auto');
  });

  it('cannot pick Space while spaces are not allowed, and flags a Space picked before they were ruled out', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Space' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Spaces' })); // the user rules spaces out after choosing one
    const space = screen.getByRole('button', { name: 'Space' }) as HTMLButtonElement;
    expect(space.disabled).toBe(false); // still the choice, so it can be seen and changed
    expect(space.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/^Space is chosen as the separator, but spaces are not allowed\./).closest('#problems-separator')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(document.querySelector('.field-error')).toBeNull();
    expect((screen.getByRole('button', { name: 'Space' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/^Auto: ";" under these rules/)).toBeTruthy();
  });
});

describe('problems while a number is typed', () => {
  afterEach(() => vi.useRealTimers());

  it('does not flash "minimum above maximum" on the way from 1 to 16; it shows after a pause, and a fix clears at once', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const max = screen.getByLabelText('Maximum');
    max.focus();
    act(() => void fireEvent.input(max, { target: { value: '1' } })); // the first digit of 16: committed, and below the minimum
    expect(req().maxLength).toBe(1);
    expect(screen.queryByText(/is above the maximum/)).toBeNull();
    expect(max.getAttribute('aria-invalid')).toBeNull();
    act(() => void fireEvent.input(max, { target: { value: '16' } }));
    act(() => void vi.advanceTimersByTime(SETTLE_MS));
    expect(screen.queryByText(/is above the maximum/)).toBeNull(); // 16 is fine: nothing ever showed

    act(() => void fireEvent.input(max, { target: { value: '1' } }));
    act(() => void vi.advanceTimersByTime(SETTLE_MS)); // a pause on a value that really is wrong
    expect(screen.getByText(/is above the maximum/)).toBeTruthy();
    act(() => void fireEvent.input(max, { target: { value: '20' } }));
    expect(screen.queryByText(/is above the maximum/)).toBeNull(); // fixed: gone without waiting
  });

  it('shows a problem at once when the field is left', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const max = screen.getByLabelText('Maximum');
    max.focus();
    act(() => void fireEvent.input(max, { target: { value: '5' } }));
    expect(screen.queryByText(/is above the maximum/)).toBeNull();
    act(() => max.blur());
    expect(screen.getByText(/is above the maximum/)).toBeTruthy();
  });
});
