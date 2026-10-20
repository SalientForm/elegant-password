// Where secrets may be kept in the browser's storage. On GitHub Pages the
// app shares its origin (salientform.github.io) with every other site the
// organisation publishes, and any of them could read that origin's storage.
// So My list and the current batch go to localStorage and sessionStorage
// only on the app's own origin: a local server, or the hosts named at build
// time (VITE_OWN_HOSTS, set by the deploy once the app has a domain).
// Settings hold no secrets and are stored everywhere.

const fromBuild = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_OWN_HOSTS ?? '')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Hosts where the app is on an origin of its own. */
export const OWN_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', ...fromBuild]);

export const isOwnHost = (hostname: string) => OWN_HOSTS.has(hostname.toLowerCase());

/** Whether this page runs on the app's own origin, so secrets may be stored. */
export const isOwnOrigin = () => typeof window !== 'undefined' && isOwnHost(window.location.hostname);
