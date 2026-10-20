// Everything tep touches outside itself, behind one interface, so every
// command can be run in a test with a fake terminal: the streams, the
// environment, the clock, the prompts and the clipboard.

import type { ClipboardRunner } from './clipboard';

export interface OutStream {
  write(text: string): void;
  isTTY: boolean;
}

export interface Io {
  stdout: OutStream;
  stderr: OutStream;
  stdin: {
    isTTY: boolean;
    /** Everything on stdin, once it closes. */
    readAll(): Promise<string>;
  };
  env: Record<string, string | undefined>;
  /** Where relative paths start. */
  cwd: string;
  platform: NodeJS.Platform;
  now(): Date;
  /** The interactive prompts; only asked for when stdin is a terminal. */
  prompter(): Prompter;
  clipboard: ClipboardRunner;
}

export interface SelectOption<T> {
  value: T;
  label: string;
  /** Shown beside the option: what it means, or why it cannot be chosen. */
  hint?: string;
  /** Shown, dimmed, but cannot be chosen. */
  disabled?: boolean;
}

/** The user pressed Ctrl+C (or Escape) at a prompt. */
export class Cancelled extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'Cancelled';
  }
}

/** Interactive questions. Each throws Cancelled when the user cancels. */
export interface Prompter {
  select<T>(q: { message: string; options: SelectOption<T>[]; initialValue?: T }): Promise<T>;
  /** A line of text. `validate` returns why an answer is refused, or undefined to accept it. */
  text(q: { message: string; initialValue?: string; placeholder?: string; validate?: (value: string) => string | undefined }): Promise<string>;
  /** A line of text that is not shown as it is typed. */
  secret(q: { message: string; validate?: (value: string) => string | undefined }): Promise<string>;
  confirm(q: { message: string; initialValue?: boolean }): Promise<boolean>;
  /** A block of information, with an optional title. */
  note(message: string, title?: string): void;
  /** The columns a note's lines can use. A longer line is wrapped at the box's left edge, so callers wrap first (wrap.ts) to keep their columns. */
  readonly noteWidth: number;
  warn(message: string): void;
  error(message: string): void;
  info(message: string): void;
}
