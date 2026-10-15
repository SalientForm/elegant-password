import { describe, expect, it } from 'vitest';
import { buildSpecPrompt } from './specPrompt';
import { BUILT_IN_MAPPINGS } from './twists';
import { RUBRIC } from './difficulty';

describe('spec prompt', () => {
  const prompt = buildSpecPrompt();

  it('covers every page, mode and option', () => {
    for (const s of ['Elegant Passwords', 'Fun', 'Use my sentence', 'Make up a sentence', 'avoidPinkyStretch', 'initials', 'glue', 'minUppercase', 'Minimum swaps', 'Made-up nouns', 'Roll', 'Finger rolls', 'Reduce to 12', 'shorthand', 'Difficulty rubric', 'max 32']) {
      expect(prompt, s).toContain(s);
    }
  });

  it('lists every mapping and rubric criterion from the live constants', () => {
    for (const m of BUILT_IN_MAPPINGS) expect(prompt).toContain(`\`${m.from}→${m.to}\``);
    for (const c of RUBRIC) expect(prompt).toContain(`| ${c.name} |`);
  });
});
