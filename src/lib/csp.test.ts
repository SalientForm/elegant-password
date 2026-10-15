import { describe, expect, it } from 'vitest';
import { CSP, CSP_DIRECTIVES, cspPlugin, cspTag } from '../../build/csp';

describe('content security policy', () => {
  it('allows nothing but the app itself', () => {
    expect(CSP).not.toMatch(/unsafe-inline|unsafe-eval|http|\*/);
    expect(CSP_DIRECTIVES['connect-src']).toBe("'none'");
    expect(CSP_DIRECTIVES['script-src']).toBe("'self'");
    expect(CSP_DIRECTIVES['worker-src']).toBe("'self'");
    expect(CSP_DIRECTIVES['object-src']).toBe("'none'");
    expect(CSP_DIRECTIVES['base-uri']).toBe("'none'");
  });

  it('injects a meta tag into the built page only', () => {
    const plugin = cspPlugin();
    expect(plugin.apply).toBe('build');
    const hook = plugin.transformIndexHtml as { handler: () => unknown[] };
    expect(hook.handler()).toEqual([cspTag]);
    expect(cspTag.attrs).toMatchObject({ 'http-equiv': 'Content-Security-Policy', content: CSP });
  });
});
