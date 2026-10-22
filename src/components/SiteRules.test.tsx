// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DEFAULT_REQUIREMENTS, type Requirements } from '../lib/generate';
import { MAX_RULES_TEXT_LENGTH, parseRuleText } from '../lib/ruleText';
import { currentSlow, dismissSlow } from '../state/slow';
import { SiteRules } from './SiteRules';

vi.mock('../lib/ruleText', { spy: true });

afterEach(() => {
  dismissSlow();
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ initial = DEFAULT_REQUIREMENTS }: { initial?: Requirements }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SiteRules value={value} onChange={setValue} />
      <button type="button" onClick={() => setValue((v) => ({ ...v, count: v.count + 1 }))}>
        Elsewhere
      </button>
      <output data-testid="req">{JSON.stringify(value)}</output>
    </>
  );
}
const req = () => JSON.parse(screen.getByTestId('req').textContent!) as Requirements;
const box = () => screen.getByRole('textbox', { name: "The site's password rules" }) as HTMLTextAreaElement;
const status = () => within(document.getElementById('paste-rules')!).getByRole('status');
const paste = (text: string) => fireEvent.paste(box(), { clipboardData: { getData: () => text } });

describe('SiteRules', () => {
  it('reads the text once per change: renders, "Fill in" and a paste with its preview read nothing more', () => {
    render(<Harness />);
    const reads = vi.mocked(parseRuleText);
    reads.mockClear();
    fireEvent.change(box(), { target: { value: 'Must be 9-21 characters.' } });
    expect(reads).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Elsewhere' })); // the form changes, the text does not
    fireEvent.click(screen.getByRole('button', { name: 'Fill in' })); // fills from the reading already shown
    expect(req()).toMatchObject({ minLength: 9, maxLength: 21 });
    expect(reads).toHaveBeenCalledTimes(1);
    // A paste fills in and previews from one reading, and the renders its fill causes read nothing.
    paste('Must be 10-22 characters.');
    fireEvent.change(box(), { target: { value: 'Must be 10-22 characters.' } });
    expect(req()).toMatchObject({ minLength: 10, maxLength: 22 });
    expect(status().textContent).toBe('Filled in: 10-22 characters.');
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it('refuses a paste that would take the text past the cap, says why, and changes nothing', () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: 'Rules: ' } });
    box().setSelectionRange(7, 7);
    const long = 'x'.repeat(MAX_RULES_TEXT_LENGTH - 6);
    expect(paste(long)).toBe(false); // the browser's paste is stopped
    expect(box().value).toBe('Rules: ');
    expect(status().textContent).toBe(
      `Not pasted. The rules text is ${MAX_RULES_TEXT_LENGTH + 1} characters; ${MAX_RULES_TEXT_LENGTH} is the most this tool reads. Copy just the password rules.`,
    );
    expect(status().className).toBe('field-error');
    expect(req()).toEqual(DEFAULT_REQUIREMENTS);
    // Typing goes back to the preview.
    fireEvent.change(box(), { target: { value: 'Rules: 9-21 characters' } });
    expect(status().textContent).toBe('Understood: 9-21 characters.');
  });

  it('counts only what a paste leaves: replacing a selection with text that fits is taken', () => {
    render(<Harness />);
    fireEvent.change(box(), { target: { value: 'something long to replace' } });
    box().setSelectionRange(0, box().value.length);
    const fits = 'Must be 11-23 characters.'.padEnd(MAX_RULES_TEXT_LENGTH, ' ');
    expect(paste(fits)).toBe(true);
    fireEvent.change(box(), { target: { value: fits } });
    expect(req()).toMatchObject({ minLength: 11, maxLength: 23 });
  });

  it('holds at most the cap and says when it is full; any other way past it is refused', () => {
    render(<Harness />);
    expect(box().maxLength).toBe(MAX_RULES_TEXT_LENGTH);
    fireEvent.change(box(), { target: { value: 'a'.repeat(MAX_RULES_TEXT_LENGTH) } });
    expect(screen.getByText(`The box is full: it holds at most ${MAX_RULES_TEXT_LENGTH} characters.`)).toBeTruthy();
    // A drop, or anything else past maxLength, is refused as a paste is.
    fireEvent.change(box(), { target: { value: 'a'.repeat(MAX_RULES_TEXT_LENGTH + 5) } });
    expect(box().value).toHaveLength(MAX_RULES_TEXT_LENGTH);
    expect(status().textContent).toMatch(new RegExp(`^Not pasted\\. The rules text is ${MAX_RULES_TEXT_LENGTH + 5} characters`));
  });

  it('reports a reading over 2 s as slow work', async () => {
    render(<Harness />);
    vi.mocked(parseRuleText).mockImplementationOnce(() => {
      vi.spyOn(performance, 'now').mockReturnValueOnce(performance.now() + 2500); // the clock read after the work
      return { rules: {}, excludedSymbols: '', understood: [], unsupported: [] };
    });
    fireEvent.change(box(), { target: { value: 'A slow text.' } });
    expect(currentSlow()).toEqual({ what: 'Reading the pasted rules', ms: expect.any(Number) });
    expect(currentSlow()!.ms).toBeGreaterThan(2000);
  });
});
