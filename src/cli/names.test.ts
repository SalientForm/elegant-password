import { describe, expect, it } from 'vitest';
import { SITE_PRESETS } from '../lib/sitePresets';
import { closest, distance, lookup, MODE_NAMES, modeName, SITE_NAMES, siteName, slugOf } from './names';

describe('names', () => {
  it('derives the site preset names from their labels, as the spec lists them', () => {
    expect(SITE_NAMES.map((s) => s.name)).toEqual(['typical-site', 'no-spaces', 'no-symbols', 'short-max-16', '8-20-few-symbols', 'nist-passphrase']);
    expect(SITE_NAMES.map((s) => s.value)).toEqual(SITE_PRESETS);
    expect(siteName(SITE_PRESETS[3]!)).toBe('short-max-16');
  });

  it('names the typing modes by id, with Minimal-quick also accepted for quick', () => {
    expect(MODE_NAMES.map((m) => [m.name, ...m.aliases])).toEqual([['two-finger'], ['ten-finger'], ['one-handed'], ['quick', 'minimal-quick']]);
    expect(modeName('quick')).toBe('quick');
  });

  it('never gives two things one name', () => {
    for (const names of [MODE_NAMES, SITE_NAMES]) {
      const all = names.flatMap((n) => [n.name, ...n.aliases]);
      expect(new Set(all).size).toBe(all.length);
    }
  });

  it('slugs labels to lowercase words joined by hyphens', () => {
    expect(slugOf('Short max (16)')).toBe('short-max-16');
    expect(slugOf('  Very strong!! ')).toBe('very-strong');
  });

  it('looks up names and aliases, case and spaces aside', () => {
    expect(lookup('typing mode', MODE_NAMES, ' Minimal-Quick ')).toEqual({ ok: true, value: 'quick', name: 'quick' });
    expect(lookup('site preset', SITE_NAMES, 'no-spaces')).toMatchObject({ ok: true, name: 'no-spaces' });
  });

  it('refuses an unknown name with every name there is and the likeliest one meant', () => {
    const r = lookup('typing mode', MODE_NAMES, 'two-fingers');
    expect(r).toEqual({
      ok: false,
      error: '"two-fingers" is not a typing mode. The typing modes are: two-finger, ten-finger, one-handed, quick (or minimal-quick). Did you mean two-finger?',
    });
    expect(lookup('site preset', SITE_NAMES, 'zzz')).toMatchObject({ ok: false, error: expect.not.stringContaining('Did you mean') });
  });

  it('finds the closest candidate within a third of its length, or by a unique prefix', () => {
    expect(distance('kitten', 'sitting')).toBe(3);
    expect(distance('spcae', 'space')).toBe(1);
    expect(closest('balansed', ['strict', 'balanced', 'relaxed'])).toBe('balanced');
    expect(closest('nist', ['typical-site', 'nist-passphrase'])).toBe('nist-passphrase');
    expect(closest('q', ['quick', 'ten-finger'])).toBe('quick');
    expect(closest('xyzzy', ['strict', 'balanced'])).toBeUndefined();
    expect(closest('', ['a'])).toBeUndefined();
  });
});
