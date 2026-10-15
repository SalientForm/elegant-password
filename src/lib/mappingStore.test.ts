import { describe, expect, it } from 'vitest';
import { activeMappings, loadMappingSettings, parseMappingSettings, saveMappingSettings, STORAGE_KEY } from './mappingStore';
import { BUILT_IN_MAPPINGS } from './twists';

describe('mapping settings', () => {
  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveMappingSettings({ disabled: ['a>@'], custom: [{ from: 'cat', to: 'k@' }] }, storage);
    expect(store.has(STORAGE_KEY)).toBe(true);
    const loaded = loadMappingSettings(storage);
    expect(loaded).toEqual({ disabled: ['a>@'], custom: [{ from: 'cat', to: 'k@' }] });
    const active = activeMappings(loaded);
    expect(active).toHaveLength(BUILT_IN_MAPPINGS.length);
    expect(active.at(-1)).toEqual({ from: 'cat', to: 'k@', kind: 'custom' });
  });

  it('drops malformed data instead of failing', () => {
    expect(parseMappingSettings('not json')).toEqual({ disabled: [], custom: [] });
    expect(parseMappingSettings(JSON.stringify({ disabled: ['nope', 'a>@', 3], custom: [{ from: 'A', to: '4' }, { from: 'b', to: '8' }] }))).toEqual({
      disabled: ['a>@'],
      custom: [{ from: 'b', to: '8' }],
    });
  });

  it('survives blocked storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadMappingSettings(broken)).toEqual({ disabled: [], custom: [] });
    expect(() => saveMappingSettings({ disabled: [], custom: [] }, broken)).not.toThrow();
  });
});
