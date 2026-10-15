// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(req().easeSwaps).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ease awkward words with deliberate swaps' }));
    expect(req().easeSwaps).toBe(true);
    const twos = screen.getAllByRole('button', { name: '2' });
    fireEvent.click(twos[0]!); // initials
    fireEvent.click(twos[1]!); // two-letter words
    fireEvent.click(twos[2]!); // made-up nouns
    expect(req()).toMatchObject({ initials: 2, shorthand: 2, madeUp: 2 });
    fireEvent.click(screen.getByRole('checkbox', { name: /Glue numbers/ }));
    expect(req().glue).toBe(true);
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
