// A Content-Security-Policy for the built app. The app never talks to the
// network, so the policy says so: scripts and styles only from the same
// origin, no connections, no frames, no plugins. Added only to the
// production build: the dev server needs inline scripts for hot reloading.

import type { HtmlTagDescriptor, Plugin } from 'vite';

export const CSP_DIRECTIVES: Record<string, string> = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self'",
  'img-src': "'self' data:",
  'font-src': "'self'",
  'connect-src': "'none'",
  'object-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'none'",
};

export const CSP = Object.entries(CSP_DIRECTIVES)
  .map(([k, v]) => `${k} ${v}`)
  .join('; ');

export const cspTag: HtmlTagDescriptor = {
  tag: 'meta',
  attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
  injectTo: 'head-prepend',
};

export function cspPlugin(): Plugin {
  return {
    name: 'elegant-passwords:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [cspTag],
    },
  };
}
