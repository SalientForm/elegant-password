// Helpers for the CLI's tests: layers built in one line, a fake terminal, and
// scratch directories that are removed when the test file is done.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

import type { TypingMode } from '../lib/difficulty';
import type { ClipboardRunner } from './clipboard';
import { Cancelled, type Io, type Prompter, type SelectOption } from './io';
import { emptyLayer, type Layer } from './resolve';
import { SITE_NAMES } from './names';
import type { Source } from './sources';

const scratchDirs: string[] = [];
afterAll(() => {
  for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh temporary directory, removed with every other one this file made once its tests are done. */
export function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratchDirs.push(dir);
  return dir;
}

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

// ---------------------------------------------------------------- a fake terminal

/** One scripted answer. A select picks the option whose label starts with the text given. `first` means: from here on, the first allowed choice everywhere, a text's own initial value, and q at the review. */
export type Step = { select: string } | { text: string } | { secret: string } | { confirm: boolean } | { cancel: true } | { escape: true } | { first: true };

export interface Asked {
  kind: 'select' | 'text' | 'secret' | 'confirm';
  message: string;
  options?: SelectOption<unknown>[];
  initial?: unknown;
  /** Answers the question's validation refused, with the reason. */
  refused?: { value: string; reason: string }[];
}

/** A prompter that answers from a script and records every question and message. */
export class ScriptedPrompter implements Prompter {
  readonly asked: Asked[] = [];
  readonly said: { kind: 'note' | 'warn' | 'error' | 'info'; message: string; title?: string }[] = [];
  /** As wide as any line, unless a test narrows it to see the wrapping. */
  noteWidth = Number.POSITIVE_INFINITY;
  private i = 0;
  /** Once a `first` step is reached: every later question takes its first allowed answer. */
  private sticky = false;

  constructor(private readonly steps: Step[]) {}

  private next(kind: Asked['kind'], message: string): Step {
    if (!this.sticky) {
      const step = this.steps[this.i];
      if (step && 'first' in step) {
        this.sticky = true;
        this.i++;
      }
    }
    if (this.sticky) return { first: true };
    const step = this.steps[this.i++];
    if (!step) throw new Error(`The script ran out at a ${kind}: "${message}". Asked so far: ${this.asked.map((a) => a.message).join(' | ')}`);
    if ('cancel' in step) throw new Cancelled();
    if ('escape' in step) throw new Cancelled('escape');
    const want = 'select' in step ? 'select' : 'text' in step ? 'text' : 'secret' in step ? 'secret' : 'confirm';
    if (want !== kind) throw new Error(`The script expected a ${want} but tep asked a ${kind}: "${message}" (step ${this.i})`);
    return step;
  }

  async select<T>(q: { message: string; options: SelectOption<T>[]; initialValue?: T }): Promise<T> {
    this.asked.push({ kind: 'select', message: q.message, options: q.options as SelectOption<unknown>[], initial: q.initialValue });
    const step = this.next('select', q.message) as { select: string } | { first: true };
    const option = 'first' in step ? q.options.find((o) => !o.disabled) : q.options.find((o) => o.label.startsWith(step.select));
    if ('first' in step && !option) throw new Error(`No allowed option in "${q.message}"`);
    if ('first' in step) return option!.value;
    if (!option) throw new Error(`No option starting "${step.select}" in "${q.message}": ${q.options.map((o) => o.label).join(' | ')}`);
    if (option.disabled) throw new Error(`"${option.label}" is disabled in "${q.message}" (${option.hint}); a terminal would not let it be picked`);
    return option.value;
  }

  private async typed(kind: 'text' | 'secret', q: { message: string; initialValue?: string; validate?: (v: string) => string | undefined }): Promise<string> {
    const asked: Asked = { kind, message: q.message, initial: q.initialValue, refused: [] };
    this.asked.push(asked);
    for (;;) {
      const step = this.next(kind, q.message) as { text?: string; secret?: string } | { first: true };
      const value = 'first' in step ? (/^Change a line/.test(q.message) ? 'q' : (q.initialValue ?? '')) : (kind === 'text' ? step.text : step.secret)!;
      const reason = q.validate?.(value);
      if (!reason) return value;
      asked.refused!.push({ value, reason });
    }
  }

  text(q: { message: string; initialValue?: string; validate?: (v: string) => string | undefined }) {
    return this.typed('text', q);
  }
  secret(q: { message: string; validate?: (v: string) => string | undefined }) {
    return this.typed('secret', q);
  }
  async confirm(q: { message: string; initialValue?: boolean }): Promise<boolean> {
    this.asked.push({ kind: 'confirm', message: q.message, initial: q.initialValue });
    const step = this.next('confirm', q.message) as { confirm: boolean } | { first: true };
    return 'first' in step ? (q.initialValue ?? true) : step.confirm;
  }
  note(message: string, title?: string) {
    this.said.push({ kind: 'note', message, ...(title ? { title } : {}) });
  }
  warn(message: string) {
    this.said.push({ kind: 'warn', message });
  }
  error(message: string) {
    this.said.push({ kind: 'error', message });
  }
  info(message: string) {
    this.said.push({ kind: 'info', message });
  }
  /** Whether every step was used. */
  get done() {
    return this.i === this.steps.length;
  }
}

export interface FakeIo extends Io {
  out: () => string;
  err: () => string;
  prompts: ScriptedPrompter;
  copied: { command: string[]; input: string }[];
}

/** A terminal for tests: captured output, a scripted prompter, a recording clipboard. */
export function fakeIo(over: { stdoutTTY?: boolean; stdinTTY?: boolean; stdin?: string; steps?: Step[]; env?: Record<string, string | undefined>; cwd?: string; platform?: NodeJS.Platform; tools?: string[]; clipboardFails?: boolean } = {}): FakeIo {
  let out = '';
  let err = '';
  const prompts = new ScriptedPrompter(over.steps ?? []);
  const copied: { command: string[]; input: string }[] = [];
  const clipboard: ClipboardRunner = {
    exists: (command) => (over.tools ?? []).includes(command),
    run: (command, input) => {
      copied.push({ command, input });
      return over.clipboardFails ? { status: 1, stderr: 'no display' } : { status: 0, stderr: '' };
    },
  };
  return {
    stdout: { write: (s) => void (out += s), isTTY: over.stdoutTTY ?? false },
    stderr: { write: (s) => void (err += s), isTTY: false },
    stdin: { isTTY: over.stdinTTY ?? false, readAll: async () => over.stdin ?? '' },
    env: over.env ?? {},
    cwd: over.cwd ?? '/nonexistent-tep-test-dir',
    platform: over.platform ?? 'linux',
    now: () => new Date(2026, 9, 20),
    prompter: () => prompts,
    clipboard,
    out: () => out,
    err: () => err,
    prompts,
    copied,
  };
}
