/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * welcomeModalStorage.js — persistence abstraction
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Persists two pieces of welcome-modal state across sessions:
 *
 *   bx.welcomeModal.seenAt   ISO timestamp · null = never seen
 *   bx.welcomeModal.muted    boolean       · default false
 *
 * Uses @capacitor/preferences on native (survives app updates better) and
 * localStorage on web. The two backends share an identical interface so
 * the consumer doesn't care which is active.
 *
 * If both fail (e.g. private browsing with localStorage disabled), the
 * helpers return safe defaults — the modal degrades gracefully to
 * "always show, never persist mute."
 * ════════════════════════════════════════════════════════════════════════════
 */

const KEY_SEEN_AT = 'bx.welcomeModal.seenAt';
const KEY_MUTED   = 'bx.welcomeModal.muted';

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DETECTION
// ─────────────────────────────────────────────────────────────────────────────

let _capacitorPrefs = null;
let _capacitorChecked = false;

/**
 * Try to load @capacitor/preferences. Returns the Preferences object or null.
 * Cached after first attempt — no repeated import attempts.
 */
async function getCapacitorPrefs() {
  if (_capacitorChecked) return _capacitorPrefs;
  _capacitorChecked = true;
  try {
    // Dynamic import so the bundler doesn't fail if Capacitor isn't installed
    const mod = await import('@capacitor/preferences');
    _capacitorPrefs = mod.Preferences || null;
  } catch (err) {
    _capacitorPrefs = null;  // not in a Capacitor environment, or plugin missing
  }
  return _capacitorPrefs;
}

/**
 * Detect whether we're running inside a Capacitor native shell.
 * Note: Capacitor adds `window.Capacitor` when present.
 */
function isCapacitorNative() {
  return typeof window !== 'undefined'
    && window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL GETTERS / SETTERS
// ─────────────────────────────────────────────────────────────────────────────

async function getValue(key) {
  // Try Capacitor Preferences first if we're on native
  if (isCapacitorNative()) {
    const prefs = await getCapacitorPrefs();
    if (prefs) {
      try {
        const { value } = await prefs.get({ key });
        return value;  // null if unset
      } catch (err) {
        // fall through to localStorage
      }
    }
  }
  // Web fallback
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch (err) {
    return null;  // localStorage disabled (private browsing, quota, etc.)
  }
}

async function setValue(key, value) {
  if (isCapacitorNative()) {
    const prefs = await getCapacitorPrefs();
    if (prefs) {
      try {
        await prefs.set({ key, value: String(value) });
        return true;
      } catch (err) {
        // fall through
      }
    }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(value));
      return true;
    }
  } catch (err) {
    // localStorage disabled or quota exceeded
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the timestamp when the user last saw the welcome modal.
 * Returns null if they've never seen it.
 * @returns {Promise<string|null>}
 */
export async function getSeenAt() {
  return await getValue(KEY_SEEN_AT);
}

/**
 * Mark the welcome modal as seen with the current timestamp.
 */
export async function setSeenAt(timestamp = new Date().toISOString()) {
  return await setValue(KEY_SEEN_AT, timestamp);
}

/**
 * Get the user's mute preference for the modal. Defaults to false.
 * @returns {Promise<boolean>}
 */
export async function getMuted() {
  const raw = await getValue(KEY_MUTED);
  return raw === 'true';
}

/**
 * Set the user's mute preference.
 */
export async function setMuted(muted) {
  return await setValue(KEY_MUTED, muted ? 'true' : 'false');
}

/**
 * Clear all welcome-modal state. Useful for "restart onboarding" debug flows.
 */
export async function clearWelcomeModalState() {
  if (isCapacitorNative()) {
    const prefs = await getCapacitorPrefs();
    if (prefs) {
      try {
        await prefs.remove({ key: KEY_SEEN_AT });
        await prefs.remove({ key: KEY_MUTED });
      } catch (err) { /* swallow */ }
    }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY_SEEN_AT);
      localStorage.removeItem(KEY_MUTED);
    }
  } catch (err) { /* swallow */ }
}
