import { KEYBOARD_ROWS, lookupKey } from '../lib/keyboard';

/** QWERTY board with the keys a password uses lit up, brighter for repeats. */
export function KeyboardMap({ text }: { text: string }) {
  const uses = new Map<string, number>();
  let shift = 0;
  let space = 0;
  for (const c of text) {
    const k = lookupKey(c);
    if (!k) continue;
    if (k.shifted) shift++;
    if (k.key.base === ' ') space++;
    else uses.set(k.key.base, (uses.get(k.key.base) ?? 0) + 1);
  }
  const max = Math.max(1, ...uses.values());
  const heat = (n = 0) => (n ? ({ '--heat': String(0.3 + (0.7 * n) / max) } as React.CSSProperties) : undefined);
  const cls = (n: number, extra = '') => `key${extra}${n ? ' used' : ''}${n / max > 0.4 ? ' hot' : ''}`;

  return (
    <div className="keyboard" aria-hidden>
      {KEYBOARD_ROWS.map((row, y) => (
        <div className="krow" key={y} style={{ paddingLeft: `${row.offset * 1.9}em` }}>
          {row.keys.map((k) => (
            <span key={k} className={cls(uses.get(k) ?? 0)} style={heat(uses.get(k))}>
              {k}
            </span>
          ))}
        </div>
      ))}
      <div className="krow">
        <span className={cls(shift, ' wide')} style={heat(shift)}>
          shift
        </span>
        <span className={cls(space, ' space')} style={heat(space)}>
          space
        </span>
      </div>
    </div>
  );
}
