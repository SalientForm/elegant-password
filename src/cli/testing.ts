// Helpers for the CLI's tests: layers built in one line.

import type { TypingMode } from '../lib/difficulty';
import { emptyLayer, type Layer } from './resolve';
import { SITE_NAMES } from './names';
import type { Source } from './sources';

export const flag = (name: string): Source => ({ kind: 'flag', flag: `--${name}` });
export const fileAt = (line: number, key: string, file = 'tep.yml'): Source => ({ kind: 'file', file, line, key });

/** A flags layer: values by field name, plus an optional site preset and mode. */
export function flagsLayer(values: Record<string, unknown>, extra: { site?: string; mode?: TypingMode; rules?: string } = {}): Layer {
  const layer = emptyLayer();
  for (const [name, value] of Object.entries(values)) layer.values[name] = { value, source: flag(name) };
  if (extra.site) layer.site = { value: SITE_NAMES.find((s) => s.name === extra.site)!.value, source: flag('site') };
  if (extra.mode) layer.mode = { value: extra.mode, source: flag('mode') };
  if (extra.rules) layer.rulesText = { value: extra.rules, source: flag('rules') };
  return layer;
}

/** A file layer: values by "group.name" key, each on its own line from 3 down, plus an optional site preset and mode. */
export function fileLayer(values: Record<string, unknown>, extra: { site?: string; mode?: TypingMode; file?: string } = {}): Layer {
  const layer = emptyLayer();
  const file = extra.file ?? 'tep.yml';
  let line = 3;
  for (const [key, value] of Object.entries(values)) layer.values[key.split('.')[1]!] = { value, source: fileAt(line++, key, file) };
  if (extra.mode) layer.mode = { value: extra.mode, source: fileAt(1, 'mode', file) };
  if (extra.site) layer.site = { value: SITE_NAMES.find((s) => s.name === extra.site)!.value, source: fileAt(2, 'site', file) };
  return layer;
}
