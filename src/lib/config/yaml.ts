// Reading a configuration from YAML text, as a tep.yml holds it: parsed
// with the yaml package (a key twice, a tag and anything else it warns
// about refused, anchors and aliases too), then checked as plain data
// (check.ts), each problem given the line it is on. The web app never
// imports this module, so yaml stays out of its bundle.

import { isAlias, isMap, isPair, isScalar, isSeq, LineCounter, parseDocument, visit, type Document, type Node } from 'yaml';
import { checkConfig, valueAt, type CheckCode, type CheckedModel, type ExtraSections, type KeyPath } from './check';
import { MAX_CONFIG_BYTES } from './version';

/**
 * A problem a front end may word its own way, with what its wording needs:
 * the checker's, text too big to be a configuration, an anchor or an alias.
 * Each still has a message, worded for no front end in particular.
 */
export type YamlCode = CheckCode | { code: 'too-big'; bytes: number } | { code: 'anchor' | 'alias'; name: string; hint?: string };

export type YamlProblem = {
  /** The key path, as "rules.max-length" or "swaps.custom.2"; none for the text as a whole or a problem YAML itself finds. */
  path?: string;
  line: number;
  message: string;
} & (YamlCode | { code?: undefined });

export type FromYaml<G extends string = never> =
  | {
      ok: true;
      config: CheckedModel<G>;
      /** The line each key path ("mode", "rules.max-length", "swaps") is set on. */
      lines: Record<string, number>;
    }
  | { ok: false; problems: YamlProblem[] };

/** The characters YAML gives a meaning to at the start of a plain value. */
const YAML_SPECIAL = /[!&*#{}[\],:|>'"%@`?-]/;
/** How to quote a value, with an example for the key at hand. */
const quoteHint = (key = 'symbols') => `Symbols such as ! & * # { } [ ] , : have a meaning in YAML; put a value that has them in double quotes, as in ${/separator$/.test(key) ? `${key}: ";"` : /symbols$/.test(key) ? `${key}: "!@#$%"` : `${key}: "..."`}.`;
/** The key a line of the text sets, for an example in a hint. */
const keyOnLine = (line: string | undefined) => line?.match(/^\s*([a-z-]+)\s*:/)?.[1];

/**
 * Read a configuration's YAML text: its model in the engine's terms, with
 * the line each key is on, or every problem at once in line order. A front
 * end with sections of its own passes their fields, as `checkConfig` takes
 * them.
 */
export function configFromYaml<G extends string = never>(text: string, extra?: ExtraSections<G>): FromYaml<G> {
  if (text.length > MAX_CONFIG_BYTES) {
    const bytes = new TextEncoder().encode(text).length;
    return { ok: false, problems: [{ line: 1, message: `the text is ${Math.round(bytes / 1024)} KB, too big to be a configuration (they are a few hundred bytes).`, code: 'too-big', bytes }] };
  }
  const counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: counter, uniqueKeys: true, prettyErrors: false });
  const lineAt = (offset: number | undefined) => (offset === undefined ? 1 : counter.linePos(offset).line);
  const lines = text.split(/\r?\n/);
  const problems: YamlProblem[] = [];
  const failed = (): FromYaml<G> => ({ ok: false, problems: problems.sort((a, b) => a.line - b.line) });

  for (const e of [...doc.errors, ...doc.warnings]) {
    const line = lineAt(e.pos[0]);
    const message =
      e.code === 'DUPLICATE_KEY'
        ? 'a key appears twice in the same section; keep one'
        : e.code === 'TAG_RESOLVE_FAILED'
          ? `${e.message.split('\n')[0]}: a value starting with "!" is read as a YAML tag, not as text. ${quoteHint(keyOnLine(lines[line - 1]))}`
          : `${e.message.split('\n')[0]}${YAML_SPECIAL.test(lines[line - 1]?.split(':').slice(1).join(':') ?? '') ? `. ${quoteHint(keyOnLine(lines[line - 1]))}` : ''}`;
    problems.push({ line, message });
  }
  // Anchors (&name) and aliases (*name) only repeat a value elsewhere in the text, which a configuration never needs; an
  // alias to nothing, or one that loops back on itself, would otherwise fail deep inside the YAML reader.
  if (doc.contents) visit(doc, (_key, node) => {
    // A map's range starts at its first key, a line below its anchor: the anchor is found on the line that has it.
    const anchor = isScalar(node) || isMap(node) || isSeq(node) ? node.anchor : undefined;
    const anchorLine = anchor ? lines.findIndex((l) => l.includes(`&${anchor}`)) + 1 : 0;
    const line = anchorLine || lineAt((node as Node).range?.[0]);
    // A value starting with "*" or "&" (a symbol list, a separator) is read as one, so the quoting hint comes too.
    const hint = quoteHint(keyOnLine(lines[line - 1]));
    if (isAlias(node)) {
      problems.push({ line, message: `"*${node.source}" is a YAML alias, and aliases are not supported in a configuration. Write the value itself. ${hint}`, code: 'alias', name: node.source, hint });
    } else if (anchor) {
      const scalarHint = isScalar(node) ? hint : undefined;
      problems.push({ line, message: `"&${anchor}" is a YAML anchor, and anchors are not supported in a configuration. Take it out.${scalarHint ? ` ${scalarHint}` : ''}`, code: 'anchor', name: anchor, hint: scalarHint });
    }
  });
  if (problems.length) return failed();

  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: 0 });
  } catch (e) {
    // Aliases are refused above; anything else the reader cannot turn into values is still the text's problem.
    problems.push({ line: 1, message: `the file cannot be read as values: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}` });
    return failed();
  }

  const checked = checkConfig(data, extra);
  if (checked.ok) return { ok: true, config: checked.config, lines: linesOf(doc, lineAt) };
  for (const { path, key, field, ...rest } of checked.problems) {
    // An unknown key is on its key's line; a value on its own line, or its key's when it has none.
    const line = lineAt(key ? nodeAt(doc, path, true)?.range?.[0] : (nodeAt(doc, path, false)?.range?.[0] ?? nodeAt(doc, path, true)?.range?.[0]));
    let message = rest.message;
    // An unquoted "#" after a space starts a comment, so `separator: #` reads as nothing: say so, with how to quote it.
    if ((field?.kind.type === 'symbols' || field?.kind.type === 'separator') && valueAt(data, path) === null) {
      message += ` A "#" after a space starts a comment in YAML, so the value was read as nothing. ${quoteHint(path.join('.'))}.`;
    }
    problems.push({ ...rest, ...(path.length ? { path: path.join('.') } : {}), line, message });
  }
  return failed();
}

/** The node at a key path: the key's node when `key`, else the value's. */
function nodeAt(doc: Document, path: KeyPath, key: boolean): Node | undefined {
  let node: unknown = doc.contents;
  for (let i = 0; i < path.length; i++) {
    const step = path[i]!;
    if (isMap(node)) {
      const pair = node.items.find((p) => isPair(p) && isScalar(p.key) && p.key.value === step);
      if (!pair) return undefined;
      if (i === path.length - 1 && key) return pair.key as Node;
      node = pair.value;
    } else if (isSeq(node) && typeof step === 'number') {
      node = node.items[step];
    } else return undefined;
  }
  return (node ?? undefined) as Node | undefined;
}

/** The line each key path is set on, two levels deep: a value's own line, or for a section (a map or a list) its key's. */
function linesOf(doc: Document, lineAt: (offset: number | undefined) => number): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (map: unknown, prefix: string) => {
    if (!isMap(map)) return;
    for (const pair of map.items) {
      if (!isScalar(pair.key)) continue;
      const path = `${prefix}${String(pair.key.value)}`;
      const section = isMap(pair.value) || isSeq(pair.value);
      out[path] = lineAt(((section ? undefined : (pair.value as Node | null)) ?? pair.key).range?.[0]);
      if (!prefix) walk(pair.value, `${path}.`);
    }
  };
  walk(doc.contents, '');
  return out;
}
