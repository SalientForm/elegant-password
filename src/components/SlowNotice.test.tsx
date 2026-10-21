// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { dismissSlow, reportSlow } from '../state/slow';
import { SlowNotice } from './SlowNotice';

afterEach(() => {
  dismissSlow();
  cleanup();
});

const report = async (what: string, ms: number) => {
  await act(async () => {
    reportSlow(what, ms);
    await Promise.resolve();
  });
};

describe('SlowNotice', () => {
  it('shows nothing until work is slow, then names it and how long it took, as an alert', async () => {
    render(<SlowNotice />);
    expect(screen.queryByRole('alert')).toBeNull();
    await report('Making passwords', 3420);
    expect(screen.getByRole('alert').textContent).toBe(
      'Making passwords took 3.4 s, over the 2.0 s this app allows. Looser settings, shorter text or a faster device make it quicker.',
    );
  });

  it('is dismissed by its button or by Escape inside it, and a newer failure replaces it', async () => {
    render(<SlowNotice />);
    await report('Making passwords', 2500);
    await report("zxcvbn's reading", 2100);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toMatch(/^zxcvbn's reading took 2\.1 s/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    await report('Making passwords', 2500);
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('button', { name: 'Dismiss' }), { key: 'Escape' });
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
