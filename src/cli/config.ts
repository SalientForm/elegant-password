// tep's config file: YAML, version 1 (spec §6). Read with every problem
// reported at once, each with its line, the line itself, what was found and
// what is expected; written back with comments, atomically, so a file is
// never left half-written.

import { closeSync, fsyncSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isMap, isPair, isScalar, isSeq, LineCounter, parseDocument, type Document, type Node } from 'yaml';
import { z } from 'zod';
import { mappingSettingsProblems, type MappingSettings } from '../lib/mappingSettings';
import { configError } from './errors';
import { fieldsIn, keyPath, parseValue, type FieldGroup } from './fields';
import { closest, lookup, MODE_NAMES, SITE_NAMES } from './names';
import { emptyLayer, type Layer } from './resolve';
import type { Source } from './sources';

export { CONFIG_VERSION } from './configVersion';
import { CONFIG_VERSION } from './configVersion';
export const DEFAULT_CONFIG_FILE = 'tep.yml';
/** A tep config is a few hundred bytes; anything this big is the wrong file. */
export const MAX_CONFIG_BYTES = 64 * 1024;

const TOP_KEYS = ['version', 'mode', 'site', 'rules', 'options', 'sentence', 'swaps', 'output'] as const;

export { emptyModel, type ConfigModel } from './configModel';
import { emptyModel, type ConfigModel } from './configModel';

export interface LoadedConfig {
  model: ConfigModel;
  /** The line each key path ("rules.max-length", "mode") is on. */
  lines: Record<string, number>;
  /** The file as messages name it. */
  file: string;
}

interface Issue {
  line: number;
  message: string;
}

/** The characters YAML gives a meaning to at the start of a plain value. */
const YAML_SPECIAL = /[!&*#{}[\],:|>'"%@`?-]/;
const QUOTE_HINT = 'Symbols such as ! & * # { } [ ] , : have a meaning in YAML; put a value that has them in double quotes, as in symbols: "!@#$%".';

/** Read and check a config file's text. Throws a config error (exit 4) listing every problem. */
export function parseConfig(text: string, file: string): LoadedConfig {
  const counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: counter, uniqueKeys: true, prettyErrors: false });
  const lineAt = (offset: number | undefined) => (offset === undefined ? 1 : counter.linePos(offset).line);
  const lines = text.split(/\r?\n/);
  const issues: Issue[] = [];
  const add = (line: number, message: string) => issues.push({ line, message });

  for (const e of [...doc.errors, ...doc.warnings]) {
    const line = lineAt(e.pos[0]);
    const what =
      e.code === 'DUPLICATE_KEY'
        ? 'a key appears twice in the same section; keep one'
        : e.code === 'TAG_RESOLVE_FAILED'
          ? `${e.message.split('\n')[0]}: a value starting with "!" is read as a YAML tag, not as text. ${QUOTE_HINT}`
          : `${e.message.split('\n')[0]}${YAML_SPECIAL.test(lines[line - 1]?.split(':').slice(1).join(':') ?? '') ? `. ${QUOTE_HINT}` : ''}`;
    add(line, what);
  }
  if (issues.length) throw invalid(file, issues, lines);

  const model = emptyModel();
  const where: Record<string, number> = {};
  const root = doc.contents;
  if (root === null || (isScalar(root) && (root.value === null || root.value === ''))) {
    throw configError(`${file} is empty.`, `A tep config starts with "version: ${CONFIG_VERSION}". Run tep config to write one, or delete ${file}.`);
  }
  if (!isMap(root)) {
    throw invalid(file, [{ line: lineAt(root.range?.[0]), message: `the file must be a map of keys (version: ${CONFIG_VERSION}, mode: ..., rules: ...), not ${kindOf(root)}` }], lines);
  }

  const keyLine = (path: (string | number)[]) => lineAt(nodeAt(doc, path, true)?.range?.[0]);
  const valueLine = (path: (string | number)[]) => lineAt(nodeAt(doc, path, false)?.range?.[0] ?? nodeAt(doc, path, true)?.range?.[0]);
  const data = doc.toJS() as Record<string, unknown>;

  // The shape, with zod: which keys may be where, and which must be maps.
  const group = (g: FieldGroup) => z.strictObject(Object.fromEntries(fieldsIn(g).map((f) => [f.name, z.unknown().optional()]))).nullable();
  const shape = z.strictObject({
    version: z.unknown().optional(),
    mode: z.unknown().optional(),
    site: z.unknown().optional(),
    rules: group('rules').optional(),
    options: z.unknown().optional(),
    sentence: group('sentence').optional(),
    swaps: z.strictObject({ off: z.array(z.unknown()).nullable().optional(), custom: z.array(z.unknown()).nullable().optional() }).nullable().optional(),
    output: group('output').optional(),
  });
  const checked = shape.safeParse(data);
  if (!checked.success) {
    for (const issue of checked.error.issues) {
      const path = issue.path as (string | number)[];
      if (issue.code === 'unrecognized_keys') {
        const section = path.length ? path.join('.') : 'the top level';
        const allowed = path.length === 0 ? [...TOP_KEYS] : path[0] === 'swaps' ? ['off', 'custom'] : fieldsIn(path[0] as FieldGroup).map((f) => f.name);
        for (const key of issue.keys) {
          const near = closest(key, allowed);
          add(keyLine([...path, key]), `unknown key "${key}" in ${section}.${near ? ` Did you mean ${near}?` : ''} The keys there are: ${allowed.join(', ')}.`);
        }
      } else if (issue.code === 'invalid_type') {
        const name = path.join('.');
        const expected = issue.expected === 'object' ? 'a map of keys' : issue.expected === 'array' ? 'a list' : issue.expected;
        add(valueLine(path), `${name} must be ${expected}; found ${describeFound(nodeAt(doc, path, false))}.`);
      } else {
        add(valueLine(path), `${path.join('.') || 'the file'}: ${issue.message}`);
      }
    }
    throw invalid(file, issues, lines);
  }

  // version: required, and one this tep reads.
  const version = data.version;
  if (version === undefined) add(1, `the file has no version. Add "version: ${CONFIG_VERSION}" as its first line.`);
  else if (typeof version === 'number' && Number.isInteger(version) && version > CONFIG_VERSION) {
    add(valueLine(['version']), `version ${version} was written by a newer tep; this one reads version ${CONFIG_VERSION}. Upgrade tep, or run tep config to write a version ${CONFIG_VERSION} file.`);
  } else if (version !== CONFIG_VERSION) add(valueLine(['version']), `version must be ${CONFIG_VERSION}; found ${describeFound(nodeAt(doc, ['version'], false))}.`);

  if (data.mode !== undefined && data.mode !== null) {
    const r = typeof data.mode === 'string' ? lookup('typing mode', MODE_NAMES, data.mode) : { ok: false as const, error: `the typing mode must be one of ${MODE_NAMES.map((m) => m.name).join(', ')}` };
    if (r.ok) {
      model.mode = r.value;
      where.mode = valueLine(['mode']);
    } else add(valueLine(['mode']), `mode: ${r.error}`);
  }
  if (data.site !== undefined && data.site !== null) {
    const r = typeof data.site === 'string' ? lookup('site preset', SITE_NAMES, data.site) : { ok: false as const, error: `the site preset must be one of ${SITE_NAMES.map((s) => s.name).join(', ')}` };
    if (r.ok) {
      model.site = r.name;
      where.site = valueLine(['site']);
    } else add(valueLine(['site']), `site: ${r.error}`);
  }

  const readGroup = (g: FieldGroup, into: Record<string, unknown>) => {
    const section = data[g] as Record<string, unknown> | null | undefined;
    if (!section) return;
    for (const f of fieldsIn(g)) {
      if (!(f.name in section)) continue;
      const raw = section[f.name];
      const r = parseValue(f, raw);
      const line = valueLine([g, f.name]);
      if (r.ok) {
        into[f.name] = r.value;
        where[keyPath(f)] = line;
      } else add(line, `${keyPath(f)} ${r.error}${raw === null && (f.kind.type === 'symbols' || f.kind.type === 'separator') ? `. A "#" after a space starts a comment in YAML, so the value was read as nothing. ${QUOTE_HINT}` : ''}.`);
    }
  };
  readGroup('rules', model.rules);
  readGroup('sentence', model.sentence);
  readGroup('output', model.output);

  // options: "preset", or a map of option values.
  const options = data.options;
  if (options === undefined || options === null || options === 'preset') {
    model.options = 'preset';
    if (options === 'preset') where.options = valueLine(['options']);
  } else if (typeof options === 'object' && !Array.isArray(options)) {
    const allowed = fieldsIn('options').map((f) => f.name);
    for (const key of Object.keys(options)) {
      if (!allowed.includes(key)) {
        const near = closest(key, allowed);
        add(keyLine(['options', key]), `unknown key "${key}" in options.${near ? ` Did you mean ${near}?` : ''} The keys there are: ${allowed.join(', ')}.`);
      }
    }
    model.options = {};
    readGroup('options', model.options);
  } else {
    add(valueLine(['options']), `options must be "preset" (the typing mode's own options) or a map of option values; found ${describeFound(nodeAt(doc, ['options'], false))}.`);
  }

  // swaps: built-in swaps switched off, and the user's own.
  const swaps = data.swaps as { off?: unknown[] | null; custom?: unknown[] | null } | null | undefined;
  if (swaps) {
    const settings: MappingSettings = { disabled: [], custom: [] };
    // Where each kept entry is in the file, since malformed ones are left out of the settings.
    const at = { disabled: [] as number[], custom: [] as number[] };
    (swaps.off ?? []).forEach((key, i) => {
      if (typeof key === 'string') {
        settings.disabled.push(key);
        at.disabled.push(i);
      }
      else add(valueLine(['swaps', 'off', i]), `swaps.off entry ${i + 1} must be a built-in swap written "from>to", such as "a>@"; found ${describeFound(nodeAt(doc, ['swaps', 'off', i], false))}.`);
    });
    (swaps.custom ?? []).forEach((entry, i) => {
      const e = entry as Record<string, unknown> | null;
      const keys = e && typeof e === 'object' ? Object.keys(e) : [];
      if (!e || typeof e !== 'object' || Array.isArray(e) || typeof e.from !== 'string' || typeof e.to !== 'string' || keys.some((k) => k !== 'from' && k !== 'to')) {
        add(valueLine(['swaps', 'custom', i]), `swaps.custom entry ${i + 1} must be a map with "from" and "to", such as { from: ph, to: f }; found ${describeFound(nodeAt(doc, ['swaps', 'custom', i], false))}.`);
      } else {
        settings.custom.push({ from: e.from, to: e.to });
        at.custom.push(i);
      }
    });
    for (const p of mappingSettingsProblems(settings)) {
      const [list, kept] = p.path;
      const i = at[list][kept]!;
      const name = list === 'disabled' ? 'off' : 'custom';
      const also = p.duplicateOf === undefined ? '' : ` (also entry ${at.custom[p.duplicateOf]! + 1})`;
      add(valueLine(['swaps', name, i]), `swaps.${name} entry ${i + 1}: ${p.message.replace(/\.$/, '')}${also}.`);
    }
    model.swaps = settings;
    where.swaps = keyLine(['swaps']);
  }

  if (issues.length) throw invalid(file, issues, lines);
  return { model, lines: where, file };
}

/** The node at a path: the key's node when `key`, else the value's. */
function nodeAt(doc: Document, path: (string | number)[], key: boolean): Node | undefined {
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

function kindOf(node: unknown): string {
  if (isSeq(node)) return 'a list';
  if (isMap(node)) return 'a map';
  if (isScalar(node)) return node.value === null ? 'nothing' : typeof node.value === 'string' ? `the text "${node.value}"` : `${JSON.stringify(node.value)}`;
  return 'something else';
}

const describeFound = (node: Node | undefined) => (node === undefined ? 'nothing' : kindOf(node));

/** Every problem in a file, one per line, with the line quoted. */
function invalid(file: string, issues: Issue[], lines: string[]) {
  const sorted = [...issues].sort((a, b) => a.line - b.line);
  return configError(
    `${file} is not a valid tep config (${sorted.length === 1 ? '1 problem' : `${sorted.length} problems`}):`,
    ...sorted.flatMap((i) => [`${file}:${i.line}: ${i.message}`, `    ${String(i.line).padStart(3)} | ${lines[i.line - 1] ?? ''}`]),
  );
}

/** The layer a config file adds to the flags, with each value's source: the file and line. */
export function layerOf(loaded: LoadedConfig): Layer {
  const { model, lines, file } = loaded;
  const layer = emptyLayer();
  const at = (key: string, line: number | undefined): Source => ({ kind: 'file', file, line: line ?? 1, key });
  if (model.mode) layer.mode = { value: model.mode, source: at('mode', lines.mode) };
  if (model.site) layer.site = { value: SITE_NAMES.find((s) => s.name === model.site)!.value, source: at('site', lines.site) };
  const put = (g: FieldGroup, values: Record<string, unknown>) => {
    for (const f of fieldsIn(g)) if (f.name in values) layer.values[f.name] = { value: values[f.name], source: at(keyPath(f), lines[keyPath(f)]) };
  };
  put('rules', model.rules);
  if (model.options !== 'preset') put('options', model.options);
  put('sentence', model.sentence);
  put('output', model.output);
  if (model.swaps) layer.mappings = { value: model.swaps, source: at('swaps', lines.swaps) };
  return layer;
}

/** Read a config file from disk. A missing file named by -c, an unreadable one or a far too large one is a config error that says which. */
export function readConfigFile(path: string, display = path): string {
  let size: number;
  try {
    const st = statSync(path);
    if (st.isDirectory()) throw configError(`${display} is a directory, not a config file.`, `Name the file itself, as in -c ${join(display, DEFAULT_CONFIG_FILE)}.`);
    size = st.size;
  } catch (e) {
    if ((e as { exitCode?: number }).exitCode) throw e;
    throw fsError(e, display);
  }
  if (size > MAX_CONFIG_BYTES) {
    throw configError(`${display} is ${Math.round(size / 1024)} KB, too big to be a tep config (they are a few hundred bytes).`, 'Check that this is the file you meant.');
  }
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    throw fsError(e, display);
  }
}

function fsError(e: unknown, display: string) {
  const code = (e as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') return configError(`${display} does not exist.`, `Check the path, or run "tep config ${display}" to write it.`);
  if (code === 'EACCES' || code === 'EPERM') return configError(`${display} cannot be read: permission denied.`, `Check its permissions (ls -l ${display}).`);
  return configError(`${display} cannot be read: ${(e as Error).message}`);
}

/** Load and check a config file. */
export const loadConfig = (path: string, display = path): LoadedConfig => parseConfig(readConfigFile(path, display), display);

// ---------------------------------------------------------------- writing (the text itself: configText.ts)

export interface WriteFs {
  openSync: typeof openSync;
  writeSync: typeof writeSync;
  fsyncSync: typeof fsyncSync;
  closeSync: typeof closeSync;
  renameSync: typeof renameSync;
  unlinkSync: typeof unlinkSync;
}

const realFs: WriteFs = { openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync };

/**
 * Write `text` to `path` atomically: to a temporary file beside it, flushed
 * to disk, then renamed over the target, so a crash or Ctrl+C leaves either
 * the old file or the new one, never half of one. Mode 0644: a config holds
 * no secret.
 */
export function writeAtomic(path: string, text: string, fs: WriteFs = realFs): void {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(tmp, 'wx', 0o644);
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, path);
  } catch (e) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // Already closed.
      }
    }
    try {
      fs.unlinkSync(tmp);
    } catch {
      // Never created, or already renamed.
    }
    const code = (e as NodeJS.ErrnoException).code;
    throw configError(
      `${path} could not be written: ${code === 'EACCES' || code === 'EPERM' ? 'permission denied' : code === 'ENOSPC' ? 'the disk is full' : code === 'ENOENT' ? 'its directory does not exist' : (e as Error).message}.`,
      'Nothing was changed.',
    );
  }
}
