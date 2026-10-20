// How errors read on stderr: "tep g: error: <what is wrong>", then the
// details indented. Pure, so the Fun page's CLI prompt shows real ones.

import type { Problem } from '../lib/consistency';
import { CliError, EXIT } from './errors';
import { explainProblem, renderExplained, type Refer } from './messages';
import type { Paint } from './output';
import type { Resolved } from './resolve';

/** Every contradiction in resolved settings, as one error: each problem with its values, their sources and a fix. */
export function contradictionError(problems: Problem[], r: Resolved): CliError {
  const refer: Refer = { source: (f) => r.sources[f.name]! };
  const details = problems.flatMap((p, i) => {
    const [title, ...rest] = renderExplained(explainProblem(p, r.generation.req, refer), '     ');
    return [`${problems.length > 1 ? `${i + 1}. ` : ''}${title}`, ...rest, ''];
  });
  details.pop();
  return new CliError(
    EXIT.contradiction,
    `these settings contradict each other${problems.length > 1 ? ` (${problems.length} problems)` : ''}, so no passwords were made:`,
    details,
  );
}

/** An error as main prints it, under the command's name. */
export const renderError = (name: string, e: CliError, p: Paint) => `${p.red(`${name}: error:`)} ${e.title}\n${e.details.map((d) => (d ? `  ${d}\n` : '\n')).join('')}`;

/** A warning or a note as tep g prints it on stderr: the first line after the label, the rest indented. */
export function renderNotice(name: string, kind: 'warning' | 'note', lines: readonly string[], p: Paint): string {
  const [first, ...rest] = lines;
  return `${(kind === 'warning' ? p.yellow : p.dim)(`${name}: ${kind}:`)} ${first}\n${rest.map((l) => `  ${l}\n`).join('')}`;
}
