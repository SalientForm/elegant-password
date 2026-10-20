// Wrapping for boxes drawn at the terminal. The prompter's box wraps a long
// line at the screen's edge and starts the rest at the box's left side, which
// breaks columns apart; a line wrapped here first keeps its run-on text under
// its own column instead.

/** Below this many columns for the text, a hanging indent leaves too little room and the run-on lines start at the left. */
const MIN_TEXT = 16;

/**
 * A line cut into lines of at most `width` columns, at spaces where it can,
 * every line after the first starting with `indent` spaces. A word longer
 * than a line is split. A width of Infinity leaves the line whole.
 */
export function wrapHanging(line: string, width: number, indent: number): string[] {
  if (line.length <= width) return [line];
  const w = Math.max(1, Math.floor(width));
  const pad = ' '.repeat(w - indent >= MIN_TEXT ? indent : 0);
  const out: string[] = [];
  let current = '';
  let gap = '';
  for (const [, space, word] of line.matchAll(/( +)|([^ ]+)/g)) {
    if (space !== undefined) {
      // Spaces at the very start stay; between words they wait for the next word.
      if (current.trim()) gap += space;
      else current += space;
      continue;
    }
    let rest = word!;
    if (current.trim() && current.length + gap.length + rest.length > w) {
      // A word too long for any line is split from where the line is, not moved down first, if there is room left.
      const tooLong = rest.length > w - pad.length;
      if (!tooLong || current.length + gap.length >= w) {
        out.push(current);
        current = pad;
        gap = '';
      }
    }
    current += gap;
    gap = '';
    while (current.length + rest.length > w) {
      const room = w - current.length;
      if (room <= 0) {
        current = pad; // only a lead of spaces as wide as the line gets here: dropped
        continue;
      }
      out.push(current + rest.slice(0, room));
      rest = rest.slice(room);
      current = pad;
    }
    current += rest;
  }
  if (current.trim()) out.push(current);
  return out;
}
