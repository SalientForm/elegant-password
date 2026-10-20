import { describe, expect, it } from 'vitest';
import { isOwnHost, OWN_HOSTS } from './origin';

describe('the app\'s own origin', () => {
  it('is a local server, and nothing on a shared host', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'LOCALHOST']) expect(isOwnHost(host), host).toBe(true);
    for (const host of ['salientform.github.io', 'github.io', 'lean.tail4b6ff1.ts.net', '']) expect(isOwnHost(host), host).toBe(false);
  });

  it('takes the hosts the build names, lower-cased and trimmed', () => {
    // VITE_OWN_HOSTS is read once at load; the tests run without it, so only the local hosts are in the set.
    expect([...OWN_HOSTS].every((h) => h === h.toLowerCase().trim())).toBe(true);
  });
});
