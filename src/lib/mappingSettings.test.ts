import { describe, expect, it } from 'vitest';
import { activeMappings, DEFAULT_MAPPING_SETTINGS, isBuiltInKey, mappingSettingsProblems } from './mappingSettings';
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
