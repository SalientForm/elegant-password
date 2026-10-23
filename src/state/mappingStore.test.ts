import { describe, expect, it } from 'vitest';
import { activeMappings } from '../lib/mappingSettings';
import { BUILT_IN_MAPPINGS } from '../lib/twists';
import { loadMappingSettings, parseMappingSettings, saveMappingSettings, STORAGE_KEY } from './mappingStore';

describe('mapping settings', () => {
  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
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
    expect(parseMappingSettings(undefined)).toEqual({ disabled: [], custom: [] });
    // Kept only what the swaps panel would add: not "A>4" (malformed), "b>8" (a built-in) or a second "cat>k@".
    expect(
      parseMappingSettings({ disabled: ['nope', 'a>@', 3], custom: [{ from: 'A', to: '4' }, { from: 'b', to: '8' }, { from: 'cat', to: 'k@' }, { from: 'cat', to: 'k@' }] }),
    ).toEqual({
      disabled: ['a>@'],
      custom: [{ from: 'cat', to: 'k@' }],
    });
  });

  it('survives blocked storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadMappingSettings(broken)).toEqual({ disabled: [], custom: [] });
    expect(() => saveMappingSettings({ disabled: [], custom: [] }, broken)).not.toThrow();
  });
});

describe('mapping settings when the browser blocks storage', () => {
  it('neither loads nor saves through a localStorage whose getter throws: an undefined store means defaults, quietly', () => {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      expect(loadMappingSettings(undefined)).toEqual({ disabled: [], custom: [] });
      expect(() => saveMappingSettings({ disabled: ['a>@'], custom: [] }, undefined)).not.toThrow();
    } finally {
      if (had) Object.defineProperty(globalThis, 'localStorage', had);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});
