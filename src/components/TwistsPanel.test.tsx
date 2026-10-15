// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { DEFAULT_MAPPING_SETTINGS, type MappingSettings } from '../lib/mappingStore';
import { BUILT_IN_MAPPINGS } from '../lib/twists';
import { relevantTo, TwistsPanel } from './TwistsPanel';

afterEach(cleanup);

function Harness({ req: initialReq = DEFAULT_REQUIREMENTS, relevant }: { req?: Requirements; relevant?: (m: { from: string }) => boolean }) {
  const [req, setReq] = useState(initialReq);
  const [settings, setSettings] = useState<MappingSettings>(DEFAULT_MAPPING_SETTINGS);
  return (
    <>
      <TwistsPanel req={req} onReqChange={setReq} settings={settings} onSettingsChange={setSettings} relevant={relevant} />
      <output data-testid="state">{JSON.stringify({ twists: req.twists, disabled: settings.disabled, custom: settings.custom })}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId('state').textContent!) as { twists: number; disabled: string[]; custom: { from: string; to: string }[] };

describe('TwistsPanel', () => {
  it('switches built-in mappings off and on, and counts them', () => {
    render(<Harness />);
    const chip = screen.getByRole('button', { name: 'a→@' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(`${BUILT_IN_MAPPINGS.length} on`)).toBeTruthy();
    fireEvent.click(chip);
    expect(state().disabled).toEqual(['a>@']);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(`${BUILT_IN_MAPPINGS.length - 1} on`)).toBeTruthy();
    fireEvent.click(chip);
    expect(state().disabled).toEqual([]);
  });

  it('adds, rejects and removes custom mappings, and resets to the defaults', () => {
    render(<Harness />);
    const replace = screen.getByLabelText('Replace') as HTMLInputElement;
    const withField = screen.getByLabelText('With') as HTMLInputElement;
    const add = screen.getByRole('button', { name: 'Add' });
    const reset = screen.getByRole('button', { name: 'Reset mappings to defaults' });
    expect((reset as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(replace, { target: { value: 'A' } });
    fireEvent.change(withField, { target: { value: '4' } });
    fireEvent.click(add);
    expect(screen.getByText(/already exists/i)).toBeTruthy(); // "A" is lowercased first, and a>4 is built in

    fireEvent.change(replace, { target: { value: 'cat' } });
    fireEvent.change(withField, { target: { value: 'K@' } });
    fireEvent.click(add);
    expect(screen.getByText(/lowercase letters only/)).toBeTruthy();
    expect(state().custom).toEqual([]);

    fireEvent.change(withField, { target: { value: 'k@' } });
    fireEvent.click(add);
    expect(state().custom).toEqual([{ from: 'cat', to: 'k@' }]);
    expect(replace.value).toBe('');
    expect(screen.queryByText(/lowercase letters only/)).toBeNull();
    expect((reset as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove cat to k@' }));
    expect(state().custom).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'e→3' }));
    fireEvent.click(reset);
    expect(state()).toMatchObject({ disabled: [], custom: [] });
  });

  it('explains mappings the site rules block, and sets the minimum swaps', () => {
    render(<Harness req={{ ...DEFAULT_REQUIREMENTS, allowedSymbols: '@', avoidPinkyStretch: true }} />);
    expect(screen.getByRole('button', { name: 'a→@' }).title).toMatch(/On: click to skip/);
    expect(screen.getByRole('button', { name: 's→$' }).title).toMatch(/not an allowed symbol/);
    cleanup();
    render(<Harness req={{ ...DEFAULT_REQUIREMENTS, allowedSymbols: '!$', avoidPinkyStretch: true }} />);
    expect(screen.getByRole('button', { name: 'l→!' }).title).toMatch(/pinky stretch/);
    const swaps = within(screen.getByText('Minimum swaps').closest('fieldset')!);
    fireEvent.click(swaps.getByRole('button', { name: '3' }));
    expect(state().twists).toBe(3);
    fireEvent.click(swaps.getByRole('button', { name: 'None' }));
    expect(state().twists).toBe(0);
  });

  it('disables mappings that cannot apply to the sentence', () => {
    const relevant = relevantTo(['sally', 'eats', 'sweets']);
    expect(relevant({ from: 'ee' })).toBe(true);
    expect(relevant({ from: 'ph' })).toBe(false);
    render(<Harness relevant={relevant} />);
    const ph = screen.getByRole('button', { name: 'ph→f' }) as HTMLButtonElement;
    expect(ph.disabled).toBe(true);
    expect(ph.title).toMatch(/not in your sentence/);
    expect((screen.getByRole('button', { name: 'ee→ea' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(ph);
    expect(state().disabled).toEqual([]); // a disabled chip cannot be toggled
  });
});
