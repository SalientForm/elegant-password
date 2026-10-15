// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { TabPanel, Tabs } from './Tabs';

afterEach(cleanup);

const TABS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
] as const;

function Harness() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return (
    <>
      <Tabs tabs={TABS} value={value} onChange={setValue} label="Letters" idPrefix="t" />
      {TABS.map((t) => (
        <TabPanel key={t.id} idPrefix="t" id={t.id} active={value === t.id}>
          panel {t.label}
        </TabPanel>
      ))}
    </>
  );
}

describe('Tabs', () => {
  it('follows the ARIA tabs pattern: one tab stop, tabs name their panels, panels name their tabs', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Letters' });
    expect(list).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    const panel = screen.getByRole('tabpanel');
    expect(panel.id).toBe(tabs[0]!.getAttribute('aria-controls'));
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0]!.id);
    expect(panel.textContent).toBe('panel Alpha');
  });

  it('moves with the arrow keys, wraps, and jumps with Home and End', () => {
    render(<Harness />);
    const [a, b, c] = screen.getAllByRole('tab');
    a!.focus();
    fireEvent.keyDown(a!, { key: 'ArrowRight' });
    expect(b!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(b);
    expect(screen.getByRole('tabpanel').textContent).toBe('panel Beta');
    fireEvent.keyDown(b!, { key: 'ArrowLeft' });
    fireEvent.keyDown(a!, { key: 'ArrowLeft' });
    expect(c!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(c!, { key: 'Home' });
    expect(a!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(a!, { key: 'End' });
    expect(c!.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(b!);
    expect(b!.getAttribute('aria-selected')).toBe('true');
  });
});
