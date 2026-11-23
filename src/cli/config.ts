// tep's config file: YAML, version 2, version 1 still read (spec §6). Read by the core
// (src/lib/config/yaml.ts) with tep's output section, every problem
// reported at once, each with its line, the line itself, what was found and
// what is expected, in tep's words; written back with comments, atomically,
// so a file is never left half-written.

import { closeSync, fsyncSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { configFromYaml, type YamlProblem } from '../lib/config/yaml';
import { CliError, configError } from './errors';
import { fieldsIn, keyPath, type FieldGroup } from './fields';
import { SITE_NAMES } from '../lib/config/names';
import { emptyLayer, type Layer } from './resolve';
import type { Source } from './sources';

export { CONFIG_VERSION, MAX_CONFIG_BYTES } from '../lib/config/version';
import { CONFIG_VERSION, MAX_CONFIG_BYTES, VERSIONS_READ } from '../lib/config/version';
export const DEFAULT_CONFIG_FILE = 'tep.yml';

export { emptyModel, type ConfigModel } from './configModel';
import type { ConfigModel } from './configModel';

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

/** Read and check a config file's text. Throws a config error (exit 4) listing every problem. */
export function parseConfig(text: string, file: string): LoadedConfig {
  const read = configFromYaml(text, { output: fieldsIn('output') });
  if (read.ok) return { model: read.config, lines: read.lines, file };
  for (const p of read.problems) {
    if (p.code === 'empty') throw configError(`${file} is empty.`, `A tep config starts with "version: ${CONFIG_VERSION}". Run tep config to write one, or delete ${file}.`);
    if (p.code === 'too-big') throw tooBig(file, p.bytes);
  }
  throw invalid(file, read.problems.map((p) => ({ line: p.line, message: worded(p) })), text.split(/\r?\n/));
}

/** A problem in tep's words: the core words the ones that would name tep for no front end, and gives a code instead. */
function worded(p: YamlProblem): string {
  switch (p.code) {
    case 'newer-version':
      return `version ${p.version} was written by a newer tep; this one reads ${VERSIONS_READ}. Upgrade tep, or run tep config to write a version ${CONFIG_VERSION} file.`;
    case 'anchor':
      return `"&${p.name}" is a YAML anchor, and anchors are not supported in a tep config. Take it out.${p.hint ? ` ${p.hint}` : ''}`;
    case 'alias':
      return `"*${p.name}" is a YAML alias, and aliases are not supported in a tep config. Write the value itself.${p.hint ? ` ${p.hint}` : ''}`;
    default:
      return p.message;
  }
}

/** Every problem in a file, one per line, with the line quoted. */
function invalid(file: string, issues: Issue[], lines: string[]) {
  const sorted = [...issues].sort((a, b) => a.line - b.line);
  return configError(
    `${file} is not a valid tep config (${sorted.length === 1 ? '1 problem' : `${sorted.length} problems`}):`,
    ...sorted.flatMap((i) => [`${file}:${i.line}: ${i.message}`, `    ${String(i.line).padStart(3)} | ${lines[i.line - 1] ?? ''}`]),
  );
}

/** A file far too big to be a config, by its size in bytes. */
const tooBig = (display: string, bytes: number) =>
  configError(`${display} is ${Math.round(bytes / 1024)} KB, too big to be a tep config (they are a few hundred bytes).`, 'Check that this is the file you meant.');

/** The layer a config file adds to the flags, with each value's source: the file and line. */
export function layerOf(loaded: LoadedConfig): Layer {
  const { model, lines, file } = loaded;
  const layer = emptyLayer();
  const at = (key: string, line: number | undefined): Source => ({ kind: 'file', file, line: line ?? 1, key });
  // A version 1 file names the typing mode "mode": a message names the key as the file has it.
  const modeKey = 'mode' in lines ? 'mode' : 'typing-mode';
  if (model.typingMode) layer.mode = { value: model.typingMode, source: at(modeKey, lines[modeKey]) };
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
    if (e instanceof CliError) throw e;
    throw fsError(e, display);
  }
  if (size > MAX_CONFIG_BYTES) throw tooBig(display, size);
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
  realpathSync?: typeof realpathSync;
  statSync?: typeof statSync;
}

const realFs: WriteFs = { openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, realpathSync, statSync };

/**
 * Write `text` to `path` atomically: to a temporary file beside it, flushed
 * to disk, then renamed over the target, so a crash or Ctrl+C leaves either
 * the old file or the new one, never half of one. A symlink is followed, so
 * the file it points to is what changes; an existing file keeps its mode,
 * a new one is 0644 (a config holds no secret). Messages name `display`,
 * the path as the user wrote it.
 */
export function writeAtomic(path: string, text: string, fs: WriteFs = realFs, display = path): void {
  let target = path;
  let mode = 0o644;
  try {
    target = fs.realpathSync?.(path) ?? path;
    const st = fs.statSync?.(target);
    if (st) mode = st.mode & 0o777;
  } catch {
    // Not there yet: a new file at the path given.
  }
  const tmp = join(dirname(target), `.${basename(target)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(tmp, 'wx', mode);
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, target);
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
      `${display} could not be written: ${code === 'EACCES' || code === 'EPERM' ? 'permission denied' : code === 'ENOSPC' ? 'the disk is full' : code === 'ENOENT' ? 'its directory does not exist' : (e as Error).message}.`,
      'Nothing was changed.',
    );
  }
}
