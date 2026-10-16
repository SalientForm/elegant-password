// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { RequirementsForm } from './RequirementsForm';

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

  it('warns beside the presets when one rules out the chosen separator', () => {
    render(<Harness />);
    expect(screen.queryByText(/Pick another under Style/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /No symbols/ }));
    expect(req().separator).toBe(';'); // style is the user's: left as it was
    expect(screen.getByText(/";" is chosen as the separator, but it is not an allowed symbol\. Pick another under Style/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Typical site/ }));
    expect(screen.queryByText(/Pick another under Style/)).toBeNull();
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

  it('uses a separator only when ticked, accepts any allowed character, and explains problems', () => {
    render(<Harness initial={{ ...DEFAULT_REQUIREMENTS, allowedSymbols: ';-' }} />);
    const box = screen.getByRole('checkbox', { name: 'Use a separator between words' }) as HTMLInputElement;
    expect(box.checked).toBe(true); // the default ";"
    const field = screen.getByLabelText('Separator character') as HTMLInputElement;
    expect(field.value).toBe(';');
    fireEvent.change(field, { target: { value: '-' } });
    expect(req().separator).toBe('-');
    expect(screen.getByText(/pinky stretch; kept because you chose it/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '#' } });
    expect(req().separator).toBe('#');
    expect(screen.getByText(/not an allowed symbol/)).toBeTruthy();
    fireEvent.change(field, { target: { value: 'x' } });
    expect(screen.getByText(/not a letter or digit/)).toBeTruthy();
    fireEvent.change(field, { target: { value: '' } });
    expect(req().separator).toBe('auto'); // empty means the fastest allowed
    expect(screen.getByText(/fastest the site allows/)).toBeTruthy();
    fireEvent.change(field, { target: { value: ' ' } });
    expect(req().separator).toBe(' ');
    expect(screen.getByText(/typed with the thumb/)).toBeTruthy();
    fireEvent.click(box);
    expect(req().separator).toBe('');
    expect(screen.queryByLabelText('Separator character')).toBeNull();
    fireEvent.click(box);
    expect(req().separator).toBe(' '); // back to the last one chosen
  });
});
