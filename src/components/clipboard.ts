/** Select an element's text so the user can copy it by hand. */
export function selectText(el: Element | null): void {
  if (!el || typeof document === 'undefined') return;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus();
    el.select(); // a field's text is its value, not its contents
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * Copy text to the clipboard. The clipboard API rejects outside secure
 * contexts and when the page is not focused; then the text in `fallback`
 * is selected instead so one keystroke finishes the job. Returns whether
 * the copy itself worked.
 */
export async function copyText(text: string, fallback?: Element | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    selectText(fallback ?? null);
    return false;
  }
}

export type CopyState = 'idle' | 'copied' | 'failed';

export const COPY_MESSAGES: Record<CopyState, string> = {
  idle: '',
  copied: 'Copied',
  failed: 'Copy failed. The text is selected: press Ctrl+C (⌘C on a Mac).',
};
