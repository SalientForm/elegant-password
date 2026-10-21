import { useSyncExternalStore } from 'react';
import { currentSlow, dismissSlow, SLOW_MS, subscribeSlow } from '../state/slow';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/**
 * A floating error while some work took longer than SLOW_MS: a snackbar in
 * the error colour, 1.5 rem above the foot of the page (above the
 * unapplied-changes bar when both show), naming what was slow and how long
 * it took, until Dismiss (or Escape inside it). A newer failure replaces it.
 */
export function SlowNotice() {
  const slow = useSyncExternalStore(subscribeSlow, currentSlow);
  if (!slow) return null;
  return (
    <div
      className="slow-notice"
      role="region"
      aria-label="Slow work"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          dismissSlow();
        }
      }}
    >
      <div className="snackbar failed">
        <p className="snackbar-text" role="alert">
          {slow.what} took {seconds(slow.ms)}, over the {seconds(SLOW_MS)} this app allows. Looser settings, shorter text or a faster device make it quicker.
        </p>
        <div className="snackbar-actions">
          <button type="button" className="ghost" onClick={dismissSlow}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
