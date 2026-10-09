// Remembered dismissal: a strip closed by the visitor stays closed on later visits (rememberDismiss).
// The flag lives in localStorage under the caller's key. Storage can throw (private mode, blocked cookies),
// so every access is guarded and a failure simply means "not dismissed" or "not remembered".

/**
 * True when the visitor closed this strip before under `key`.
 * Returns false when storage is unavailable or throws.
 */
export function isDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/**
 * Stores the dismissal under `key`, so later visits start with the strip hidden.
 * Failures are ignored: the strip still closes for the current visit.
 */
export function rememberDismissal(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Storage is unavailable, so the dismissal lasts only for this page view.
  }
}
