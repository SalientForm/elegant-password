// The real prompts: @clack/prompts, drawn on stderr so stdout stays for
// passwords (tep g --sentence - | wl-copy prompts at the terminal and pipes
// only the password). Ctrl+C at any prompt becomes Cancelled.

import * as clack from '@clack/prompts';
import { Cancelled, type Prompter } from './io';

const output = process.stderr;

function unwrap<T>(value: T): Exclude<T, symbol> {
  if (clack.isCancel(value)) throw new Cancelled();
  return value as Exclude<T, symbol>;
}

export function clackPrompter(): Prompter {
  return {
    async select(q) {
      // A disabled option cannot be focused, so its hint would never show: the reason goes in its label.
      const options = q.options.map((o) => ({
        value: o.value,
        label: o.disabled && o.hint ? `${o.label} (${o.hint})` : o.label,
        ...(o.hint && !o.disabled ? { hint: o.hint } : {}),
        ...(o.disabled ? { disabled: true } : {}),
      }));
      return unwrap(
        await clack.select({
          message: q.message,
          options: options as Parameters<typeof clack.select<typeof q.options[number]['value']>>[0]['options'],
          ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}),
          output,
        }),
      );
    },
    async text(q) {
      return unwrap(
        await clack.text({
          message: q.message,
          ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}),
          ...(q.placeholder ? { placeholder: q.placeholder } : {}),
          ...(q.validate ? { validate: (v: string | undefined) => q.validate!(v ?? '') } : {}),
          output,
        }),
      );
    },
    async secret(q) {
      return unwrap(await clack.password({ message: q.message, ...(q.validate ? { validate: (v: string | undefined) => q.validate!(v ?? '') } : {}), output }));
    },
    async confirm(q) {
      return unwrap(await clack.confirm({ message: q.message, ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}), output }));
    },
    note: (message, title) => clack.note(message, title, { output }),
    // clack's box takes 6 columns: its bar and two spaces on each side.
    get noteWidth() {
      return (output.columns || 80) - 6;
    },
    warn: (message) => clack.log.warn(message, { output }),
    error: (message) => clack.log.error(message, { output }),
    info: (message) => clack.log.info(message, { output }),
  };
}
