// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { DEFAULT_SENTENCE_OPTIONS, fromSentence, type SentenceOptions } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { seeded } from '../lib/testRandom';
import { SentenceInput, SentenceStrength } from './SentenceMode';

afterEach(cleanup);

function Harness() {
  const [value, setValue] = useState('');
  const [options, setOptions] = useState<SentenceOptions>(DEFAULT_SENTENCE_OPTIONS);
  return (
    <>
      <SentenceInput value={value} onChange={setValue} options={options} onOptionsChange={setOptions} />
      <output data-testid="opts">{JSON.stringify({ value, ...options })}</output>
    </>
  );
}
const opts = () => JSON.parse(screen.getByTestId('opts').textContent!) as SentenceOptions & { value: string };

describe('SentenceInput', () => {
  it('edits the sentence and every option', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Your sentence'), { target: { value: 'Sally eats sweets' } });
    expect(opts().value).toBe('Sally eats sweets');
    fireEvent.click(screen.getByRole('button', { name: 'First + last' }));
    expect(opts().shrink).toBe('ends');
    expect(screen.getByRole('button', { name: 'First + last' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/jupiter → jr, piece → pc/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Shrink words of'), { target: { value: '4' } });
    expect(opts().shrinkFrom).toBe(4);
    fireEvent.click(screen.getByRole('checkbox', { name: /Small words become/ }));
    expect(opts().smallWordInitials).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: /Short targets may drop/ }));
    expect(opts().allowDropping).toBe(false);
    fireEvent.change(screen.getByLabelText('Compress toward (characters)'), { target: { value: '12' } });
    expect(opts().targetLength).toBe(12);
    fireEvent.change(screen.getByLabelText('Compress toward (characters)'), { target: { value: '' } });
    expect(opts().targetLength).toBeNull();
  });

  it('submits on Enter in the sentence field', () => {
    const onSubmit = vi.fn();
    render(<SentenceInput value="Sally eats sweets" onChange={() => {}} options={DEFAULT_SENTENCE_OPTIONS} onOptionsChange={() => {}} onSubmit={onSubmit} />);
    const field = screen.getByLabelText('Your sentence') as HTMLInputElement;
    expect(field.tagName).toBe('INPUT');
    fireEvent.keyDown(field, { key: 'a' });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('controls padding and its length tag', () => {
    render(<Harness />);
    const tag = screen.getByLabelText('Length tag at the end of the padding') as HTMLSelectElement;
    fireEvent.change(tag, { target: { value: 'factor' } });
    expect(opts().lengthTag).toBe('factor');
    fireEvent.click(screen.getByRole('checkbox', { name: /Pad a sentence/ }));
    expect(opts().padding).toBe(false);
    expect(tag.disabled).toBe(true);
  });

  it('summarises the random bits across the batch', () => {
    const r = fromSentence('the otters eat their salad at noon', { ...DEFAULT_REQUIREMENTS, twists: 2, count: 4 }, undefined, { rng: seeded(6) });
    render(<SentenceStrength suggestions={r.suggestions} sentence="the otters eat their salad at noon" />);
    const heading = screen.getByRole('heading', { name: 'How strong is this sentence?' });
    const shown = screen.getByTestId('sentence-in-question');
    expect(shown.textContent).toBe('the otters eat their salad at noon');
    expect(heading.compareDocumentPosition(shown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // directly below the heading
    const lo = Math.min(...r.suggestions.map((s) => s.bits)).toFixed(1);
    expect(screen.getByText(new RegExp(`add about ${lo.replace('.', '[.]')}`))).toBeTruthy();
  });
});
