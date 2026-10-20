import { describe, expect, it } from 'vitest';
import { loadSelected, parseSelected, saveSelected, withEntry, withoutEntry } from './selectedStore';
import { memoryStore } from './storage';

const entry = (password: string, hint = 'a hint') => ({ password, hint, addedAt: '2026-10-15T12:00:00.000Z' });

describe('selected passwords', () => {
  it('adds one at a time, never the same password twice, and removes by password', () => {
    let list = withEntry([], entry('one'));
    list = withEntry(list, entry('two'));
    list = withEntry(list, entry('one', 'different hint'));
    expect(list.map((e) => e.password)).toEqual(['one', 'two']);
    expect(list[0]!.hint).toBe('a hint');
    list = withoutEntry(list, 'one');
    expect(list.map((e) => e.password)).toEqual(['two']);
  });

  it('stores only the password and hint (and when it was added)', () => {
    const store = memoryStore();
    saveSelected(store, [entry('p1', 'h1')]);
    expect(JSON.parse(store.getItem('elegant-passwords:selected:v1')!)).toEqual([{ password: 'p1', hint: 'h1', addedAt: '2026-10-15T12:00:00.000Z' }]);
    expect(loadSelected(store)).toEqual([entry('p1', 'h1')]);
    expect(loadSelected(undefined)).toEqual([]);
  });

  it('drops malformed entries and repeats', () => {
    expect(parseSelected('x')).toEqual([]);
    expect(parseSelected([{ password: '', hint: 'h' }, { password: 'p', hint: 3 }, { password: 'p', hint: 'h', addedAt: 'bad' }, { password: 'p', hint: 'again' }, null])).toEqual([
      { password: 'p', hint: 'h', addedAt: new Date(0).toISOString() },
    ]);
  });
});
