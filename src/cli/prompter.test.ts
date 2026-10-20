import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');
const calls: { fn: string; opts: Record<string, unknown> }[] = [];
let answer: unknown;

vi.mock('@clack/prompts', () => {
  const prompt = (fn: string) => async (opts: Record<string, unknown>) => {
    calls.push({ fn, opts });
    return answer;
  };
  const log = (fn: string) => (message: string, opts: Record<string, unknown>) => void calls.push({ fn, opts: { message, ...opts } });
  return {
    select: prompt('select'),
    text: prompt('text'),
    password: prompt('password'),
    confirm: prompt('confirm'),
    note: (message: string, title: string, opts: Record<string, unknown>) => void calls.push({ fn: 'note', opts: { message, title, ...opts } }),
    log: { warn: log('warn'), error: log('error'), info: log('info') },
    isCancel: (v: unknown) => v === CANCEL,
  };
});

const { clackPrompter } = await import('./prompter');
const { Cancelled } = await import('./io');

beforeEach(() => {
  calls.length = 0;
  answer = undefined;
});

describe('the clack prompter', () => {
  it('puts a disabled choice\'s reason in its label, since a disabled choice cannot be focused to show a hint', async () => {
    answer = 'auto';
    await clackPrompter().select({
      message: 'Separator',
      options: [
        { value: 'auto', label: 'Auto', hint: 'Automatic' },
        { value: ' ', label: 'Space', hint: 'not allowed: spaces are not allowed', disabled: true },
      ],
      initialValue: 'auto',
    });
    expect(calls[0]!.opts.options).toEqual([
      { value: 'auto', label: 'Auto', hint: 'Automatic' },
      { value: ' ', label: 'Space (not allowed: spaces are not allowed)', disabled: true },
    ]);
    expect(calls[0]!.opts.initialValue).toBe('auto');
  });

  it('draws every prompt and message on stderr, keeping stdout for passwords', async () => {
    const p = clackPrompter();
    answer = 'x';
    await p.text({ message: 'm' });
    await p.secret({ message: 'm' });
    answer = true;
    await p.confirm({ message: 'm' });
    p.note('n', 't');
    p.warn('w');
    p.error('e');
    p.info('i');
    expect(calls.map((c) => c.fn)).toEqual(['text', 'password', 'confirm', 'note', 'warn', 'error', 'info']);
    for (const c of calls) expect(c.opts.output, c.fn).toBe(process.stderr);
  });

  it('passes validation through, reading a missing value as empty', async () => {
    answer = 'ok';
    const validate = vi.fn((v: string) => (v ? undefined : 'empty'));
    await clackPrompter().text({ message: 'm', validate });
    const passed = calls[0]!.opts.validate as (v: string | undefined) => string | undefined;
    expect(passed(undefined)).toBe('empty');
    expect(passed('a')).toBeUndefined();
  });

  it('turns Ctrl+C at any prompt into Cancelled', async () => {
    answer = CANCEL;
    const p = clackPrompter();
    await expect(p.select({ message: 'm', options: [] })).rejects.toBeInstanceOf(Cancelled);
    await expect(p.text({ message: 'm' })).rejects.toBeInstanceOf(Cancelled);
    await expect(p.secret({ message: 'm' })).rejects.toBeInstanceOf(Cancelled);
    await expect(p.confirm({ message: 'm' })).rejects.toBeInstanceOf(Cancelled);
  });
});
