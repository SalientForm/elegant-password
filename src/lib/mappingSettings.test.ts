import { describe, expect, it } from 'vitest';
import { activeMappings, customMappingProblem, DEFAULT_MAPPING_SETTINGS, isBuiltInKey, mappingSettingsProblems } from './mappingSettings';
import { BUILT_IN_MAPPINGS } from './twists';

describe('mapping settings', () => {
  it('turns the defaults into every built-in mapping', () => {
    expect(activeMappings(DEFAULT_MAPPING_SETTINGS)).toEqual(BUILT_IN_MAPPINGS);
  });

  it('knows the built-in keys', () => {
    expect(isBuiltInKey('a>@')).toBe(true);
    expect(isBuiltInKey('a>#')).toBe(false);
  });

  it('finds every unusable entry, with where it is', () => {
    expect(
      mappingSettingsProblems({
        disabled: ['a>@', 'nope'],
        custom: [
          { from: 'cat', to: 'k@' },
          { from: 'Cat', to: 'k' },
          { from: 'cat', to: 'k@' },
        ],
      }),
    ).toEqual([
      { path: ['disabled', 1], message: '"nope" is not a built-in swap. Built-in swaps are written "from>to", such as "a>@" or "ph>f".' },
      { path: ['custom', 1], message: 'Cat>k: Replace: 1-8 lowercase letters.' },
      { path: ['custom', 2], message: 'cat>k@ is listed twice.', duplicateOf: 0 },
    ]);
    expect(mappingSettingsProblems(DEFAULT_MAPPING_SETTINGS)).toEqual([]);
  });
});

describe('customMappingProblem', () => {
  it('is the one rule for a custom swap: valid, not a built-in, not listed already', () => {
    expect(customMappingProblem({ from: 'cat', to: 'k@' }, [])).toBeUndefined();
    expect(customMappingProblem({ from: 'Cat', to: 'k@' }, [])).toMatchObject({ kind: 'invalid', message: 'Replace: 1-8 lowercase letters.' });
    expect(customMappingProblem({ from: 'ph', to: 'f' }, [])).toEqual({ kind: 'built-in', message: 'ph>f is a built-in swap already, so it needs no custom entry.' });
    expect(customMappingProblem({ from: 'cat', to: 'k@' }, [{ from: 'dog', to: 'd0g' }, { from: 'cat', to: 'k@' }])).toEqual({ kind: 'duplicate', message: 'cat>k@ is listed twice.', duplicateOf: 1 });
  });
});
