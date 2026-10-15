// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { NumberField } from './NumberField';

afterEach(cleanup);

function Harness({ min = 2, max = 20, allowEmpty = false, initial = 6 as number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <NumberField aria-label="n" value={value} min={min} max={max} allowEmpty={allowEmpty} onCommit={setValue} />
      <output data-testid="value">{value === null ? 'null' : String(value)}</output>
    </>
  );
}

describe('NumberField', () => {
  it('can be typed through: "1" on the way to "10" is not snapped to the minimum', () => {
    render(<Harness />);
    const input = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    expect(input.value).toBe('1'); // kept as typed
    expect(screen.getByTestId('value').textContent).toBe('6'); // not committed: out of range
    fireEvent.change(input, { target: { value: '10' } });
    expect(screen.getByTestId('value').textContent).toBe('10');
  });

  it('clamps into range on blur and restores the last value for nonsense', () => {
    render(<Harness />);
    const input = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('value').textContent).toBe('20');
    expect(input.value).toBe('20');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('value').textContent).toBe('20'); // clearing does not commit anything
    fireEvent.blur(input);
    expect(input.value).toBe('20');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(screen.getByTestId('value').textContent).toBe('2');
  });

  it('commits null for an empty field when allowed, and follows outside changes', () => {
    const commit = vi.fn();
    const { rerender } = render(<NumberField aria-label="n" value={12} min={1} max={256} allowEmpty onCommit={commit} />);
    const input = screen.getByLabelText('n') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(commit).toHaveBeenLastCalledWith(null);
    rerender(<NumberField aria-label="n" value={40} min={1} max={256} allowEmpty onCommit={commit} />);
    expect(input.value).toBe('40');
  });
});
