// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromSentence } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS, generate, type Requirements, type Suggestion } from '../lib/generate';
import { seeded } from '../lib/testRandom';
import { memorabilityLevel, strengthLevel, strengthWord, SuggestionCard, type CardContext } from './SuggestionCard';

afterEach(cleanup);

const first = (over: Partial<Requirements>, seed = 1) => {
  const r = generate({ ...DEFAULT_REQUIREMENTS, count: 1, ...over }, { rng: seeded(seed) });
  return { s: r.suggestions[0]!, context: { separator: r.plan.separator, minUppercase: r.plan.minUppercase, source: 'generated' as const } };
};
const show = (s: Suggestion, context: CardContext, index = 0, extra: Partial<React.ComponentProps<typeof SuggestionCard>> = {}) =>
  render(<SuggestionCard suggestion={s} context={context} index={index} {...extra} />);

describe('SuggestionCard', () => {
  it('explains the opening capital, same-row moves and the separator, and lists every check', () => {
    const { s, context } = first({ separator: ';' });
    show(s, context);
    expect(screen.queryByText('Fast to type')).toBeNull(); // closed until asked
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    const why = screen.getByText('Fast to type').closest('section')!;
    expect(within(why).getByText(/the opening capital/)).toBeTruthy();
    expect(within(why).getByText(/same keyboard row/)).toBeTruthy();
    expect(within(why).getByText(/joined with ";"/)).toBeTruthy();
    expect(screen.getByText((_, el) => el?.classList.contains('hint-line') === true).textContent).toBe(`Hint: ${s.hint}`);
    for (const c of s.checks) expect(screen.getByText(c.rule)).toBeTruthy();
    // The memorability breakdown is in the "Why?" block and agrees with the badge.
    expect(screen.getByRole('heading', { name: `Memorability: ${s.memorability} / 100` })).toBeTruthy();
    expect(screen.getByText(/hint words keep their full length/)).toBeTruthy();
    expect(screen.getByText(/brevity \d+%/)).toBeTruthy();
    expect(screen.getByText(/^(No spelling differs from the hint, so no penalty\.|\d+ spellings? differs? from the hint: −\d+ points\.)$/)).toBeTruthy();
  });

  it('explains whole-word capitals, initials, spaces, no separator and a chosen stretch', () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    const caps = first({ minUppercase: 3, separator: ' ' });
    show(caps.s, caps.context);
    open();
    expect(screen.getByText(/held once for the word in capitals/)).toBeTruthy();
    expect(screen.getByText(/Spaces between words go to your thumb/)).toBeTruthy();
    cleanup();
    const initials = first({ initials: 2, separator: '', twists: 0 }, 21);
    show(initials.s, initials.context);
    open();
    expect(screen.getByText(/2 capital initials/)).toBeTruthy();
    expect(screen.getByText(/became “[A-Z]” \(1 of \d+ letters\)/)).toBeTruthy(); // initials explained in the memorability section
    expect(screen.getByText(/Capital letters stand for whole words/)).toBeTruthy();
    expect(screen.getByText(/run together with no separator/)).toBeTruthy();
    cleanup();
    const dash = first({ separator: '-' });
    show(dash.s, dash.context);
    open();
    expect(screen.getByText(/pinky stretch, kept because you chose it/)).toBeTruthy();
  });

  it('shows the user\'s own sentence with its change steps and the random bits', () => {
    const r = fromSentence('jupiter brings 5 leds for piece', { ...DEFAULT_REQUIREMENTS, separator: ';', glue: true, initials: 1, twists: 1, minLength: 8, count: 1 }, undefined, { rng: seeded(12) });
    const s = r.suggestions[0]!;
    show(s, { separator: ';', minUppercase: 1, source: 'sentence' });
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText(/It is your own sentence/)).toBeTruthy();
    expect(screen.queryByText(/your word/)).toBeNull(); // chips carry no "your word" label
    for (const step of s.steps) expect(screen.getByText(step)).toBeTruthy();
    expect(screen.getByText(`S ${s.bits.toFixed(0)}`).getAttribute('title')).toMatch(/^Strength \d+ bits, .*only the random initials and swaps/);
    expect(screen.queryByText(/random bits/)).toBeNull();
    fireEvent.mouseEnter(screen.getByText(s.password).parentElement!);
    expect(screen.queryByRole('tooltip')).toBeNull(); // it fits, so no tip
    expect(screen.getByText(`D ${s.difficulty.score}`).getAttribute('title')).toBe(`Difficulty ${s.difficulty.score}, ${s.difficulty.label.toLowerCase()}`);
    expect(screen.getByText(`M ${s.memorability}`)).toBeTruthy();
    expect(screen.getByText(`S ${s.bits.toFixed(0)}`).getAttribute('title')).toMatch(/^Strength \d+ bits, (master password|very strong|strong|everyday|weak); counts only the random initials and swaps/);
  });

  it('toggles "Why?", marks unmet checks, and adds to the list', () => {
    const { s, context } = first({});
    const onAdd = vi.fn();
    const broken: Suggestion = { ...s, checks: [...s.checks, { rule: 'Made-up rule', met: false, how: 'never' }] };
    show(broken, context, 1, { onAdd });
    expect(screen.queryByText('Fast to type')).toBeNull(); // closed by default
    fireEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText('Fast to type')).toBeTruthy();
    expect(screen.getByText('Made-up rule').closest('li')!.className).toBe('unmet');
    fireEvent.click(screen.getByRole('button', { name: 'Hide why' }));
    expect(screen.queryByText('Fast to type')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(broken);
    cleanup();
    show(s, context, 0, { onAdd, selected: true });
    expect((screen.getByRole('button', { name: 'Added' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('memorability badge colours', () => {
  it('is green above 75, yellow above 45, red at or below 45', () => {
    expect(memorabilityLevel(100)).toBe('high');
    expect(memorabilityLevel(76)).toBe('high');
    expect(memorabilityLevel(75)).toBe('mid');
    expect(memorabilityLevel(46)).toBe('mid');
    expect(memorabilityLevel(45)).toBe('low');
    expect(memorabilityLevel(0)).toBe('low');
  });
});

describe('strength badge', () => {
  it('is green from 50 bits, yellow from 40, red below, and names the preset reached', () => {
    expect(strengthLevel(72)).toBe('high');
    expect(strengthLevel(50)).toBe('high');
    expect(strengthLevel(49)).toBe('mid');
    expect(strengthLevel(40)).toBe('mid');
    expect(strengthLevel(39)).toBe('low');
    expect(strengthWord(80)).toBe('master password');
    expect(strengthWord(65)).toBe('very strong');
    expect(strengthWord(55)).toBe('strong');
    expect(strengthWord(41)).toBe('everyday');
    expect(strengthWord(12)).toBe('weak');
  });
});
