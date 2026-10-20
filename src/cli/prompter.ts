// The real prompts: @clack/prompts, drawn on stderr so stdout stays for
// passwords (tep g --sentence - | wl-copy prompts at the terminal and pipes
// only the password). Ctrl+C or Escape at any prompt becomes Cancelled,
// which says which key it was: clack reports both the same way, so the key
// itself is listened for while a prompt is open.

import * as clack from '@clack/prompts';
import { Cancelled, type Prompter } from './io';

const output = process.stderr;

/** The last key pressed while a prompt was open: "escape", or "ctrl-c" for the interrupt character. */
let lastKey: string | undefined;
const onKeypress = (_: string | undefined, key?: { name?: string; sequence?: string }) => {
  lastKey = key?.sequence === '\u0003' ? 'ctrl-c' : key?.name;
};

/** Run a clack prompt; a cancelled one throws Cancelled with the key that cancelled it. */
async function ask<T>(run: () => Promise<T>): Promise<Exclude<T, symbol>> {
  lastKey = undefined;
  process.stdin.on('keypress', onKeypress);
  try {
    const value = await run();
    if (clack.isCancel(value)) throw new Cancelled(lastKey === 'escape' ? 'escape' : 'ctrl-c');
    return value as Exclude<T, symbol>;
  } finally {
    process.stdin.off('keypress', onKeypress);
  }
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
      return ask(() =>
        clack.select({
          message: q.message,
          options: options as Parameters<typeof clack.select<typeof q.options[number]['value']>>[0]['options'],
          ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}),
          output,
        }),
      );
    },
    async text(q) {
      return ask(() =>
        clack.text({
          message: q.message,
          ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}),
          ...(q.placeholder ? { placeholder: q.placeholder } : {}),
          ...(q.validate ? { validate: (v: string | undefined) => q.validate!(v ?? '') } : {}),
          output,
        }),
      );
    },
    async secret(q) {
      // Nothing is shown as it is typed, not even a mark per character: that would give the sentence's length away.
      return ask(() => clack.password({ message: q.message, mask: '', ...(q.validate ? { validate: (v: string | undefined) => q.validate!(v ?? '') } : {}), output }));
    },
    async confirm(q) {
      return ask(() => clack.confirm({ message: q.message, ...(q.initialValue !== undefined ? { initialValue: q.initialValue } : {}), output }));
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
