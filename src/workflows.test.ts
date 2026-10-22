// The GitHub workflows cannot run here, so this holds their shape: the checks
// live once, in check.yml, and both CI and the Pages deploy call it, the
// deploy only after it passes and neither granting it more than reading.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const DIR = join(new URL('..', import.meta.url).pathname, '.github/workflows');

type Job = { uses?: string; needs?: string; permissions?: Record<string, string>; steps?: { run?: string; uses?: string }[] };
type Workflow = { on: Record<string, unknown>; jobs: Record<string, Job> };
const workflow = (name: string) => parse(readFileSync(join(DIR, name), 'utf8')) as Workflow;

const CHECK = './.github/workflows/check.yml';

describe('the workflows', () => {
  it('hold the checks once, in a reusable check.yml, in order', () => {
    const check = workflow('check.yml');
    expect(Object.keys(check.on)).toEqual(['workflow_call']);
    const job = check.jobs.check!;
    expect(job.permissions).toEqual({ contents: 'read' });
    const runs = job.steps!.flatMap((s) => (s.run ? [s.run] : []));
    expect(runs).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm typecheck',
      'pnpm test',
      'pnpm build:cli',
      'pnpm exec playwright install --with-deps chromium',
      'pnpm test:e2e',
    ]);
    expect(job.steps!.map((s) => s.uses).filter(Boolean)).toEqual([
      'actions/checkout@v5',
      'pnpm/action-setup@v4',
      'actions/setup-node@v5',
      'actions/upload-artifact@v4',
    ]);
  });

  it('are called by CI and by the deploy, which builds only after the check and grants it only reading', () => {
    const ci = workflow('ci.yml');
    expect(ci.jobs.check).toEqual({ uses: CHECK });
    const pages = workflow('pages.yml');
    expect(pages.jobs.check).toEqual({ uses: CHECK, permissions: { contents: 'read' } });
    expect(pages.jobs.build!.needs).toBe('check');
    expect(pages.jobs.deploy!.needs).toBe('build');
  });

  it('run the browser suite nowhere but check.yml', () => {
    for (const name of ['ci.yml', 'pages.yml']) {
      const runs = Object.values(workflow(name).jobs).flatMap((j) => (j.steps ?? []).map((s) => s.run ?? ''));
      expect(runs.filter((r) => /test:e2e|typecheck|pnpm test\b/.test(r)), name).toEqual([]);
    }
  });
});
