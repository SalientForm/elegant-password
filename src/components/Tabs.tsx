import { useRef } from 'react';

export interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: readonly Tab<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  /** Prefix for the tab and panel element ids. */
  idPrefix: string;
  className?: string;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/**
 * A tab list following the WAI-ARIA tabs pattern: one tab stop, arrow keys
 * (and Home/End) move between tabs and select them, each tab names the
 * panel it controls.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, idPrefix, className = 'mode-tabs' }: TabsProps<T>) {
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  const move = (from: T, step: number | 'first' | 'last') => {
    const i = tabs.findIndex((t) => t.id === from);
    const j = step === 'first' ? 0 : step === 'last' ? tabs.length - 1 : (i + step + tabs.length) % tabs.length;
    const next = tabs[j]!.id;
    onChange(next);
    buttons.current.get(next)?.focus();
  };

  return (
    <div className={className} role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            type="button"
            role="tab"
            key={tab.id}
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            ref={(el) => {
              if (el) buttons.current.set(tab.id, el);
              else buttons.current.delete(tab.id);
            }}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              const keys: Record<string, number | 'first' | 'last'> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' };
              const step = keys[e.key];
              if (step === undefined) return;
              e.preventDefault();
              move(tab.id, step);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface PanelProps {
  idPrefix: string;
  id: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}

export function TabPanel({ idPrefix, id, active, className, children }: PanelProps) {
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} hidden={!active} className={className}>
      {active && children}
    </div>
  );
}
