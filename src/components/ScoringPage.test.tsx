// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { generate, DEFAULT_REQUIREMENTS } from '../lib/generate';
import { MEMORABILITY_BANDS } from '../lib/score';
import { BUILT_IN_MAPPINGS } from '../lib/twists';
import { ZXCVBN_VERSION } from '../lib/zxcvbnReading';
import { ScoringPage } from './ScoringPage';
import { StrengthPanel } from './StrengthPanel';

afterEach(cleanup);

/** The page's text with its line breaks and indents read as single spaces. */
const textOf = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');

describe('the figures the Scoring page names', () => {
  it('reads them from the core, so they say what the code does', () => {
    const text = textOf(render(<ScoringPage />).container);
    expect(text).toContain('(lower case 26, upper case 26, digits 10, symbols 33, anything else about 50)');
    expect(text).toContain('its digits at 3.3 bits each');
    expect(text).toContain(`estimator, ${ZXCVBN_VERSION})`);
    expect(text).toContain('(10,000 guesses a second) reads as one of four words:');
    expect(text).toContain(`run over ${BUILT_IN_MAPPINGS.length + 1} mappings, not ${BUILT_IN_MAPPINGS.length}`);
    expect(text).toContain('a long reach (six key widths or more');
    expect(text).toContain('at three attacker speeds');
    expect(text).toContain('from Effortless (0) to Hard (4) by fixed cut-points. A criterion earns weight × level ÷ 4 points');
    expect(text).toContain('Totals: 0–20 effortless, 21–40 easy, 41–60 moderate, 61–80 demanding, 81–100 hard.');
    expect(text).toContain('"Shortest that meets the target" gives Minimal-quick the shortest sentence');
    expect(text).toContain('"Keep Shift within reach" keeps every One-handed Shift stroke');
    expect(text).toContain(`green above ${MEMORABILITY_BANDS.green}, yellow above ${MEMORABILITY_BANDS.yellow}, and red at ${MEMORABILITY_BANDS.yellow} or below`);
  });

  it("names the attackers' speeds under the bits panel", () => {
    const plan = generate({ ...DEFAULT_REQUIREMENTS, count: 1 }).plan;
    const text = textOf(render(<StrengthPanel plan={plan} target={DEFAULT_REQUIREMENTS.targetBits} />).container);
    expect(text).toContain('at 10, 100,000 and 100 billion guesses per second.');
  });
});
