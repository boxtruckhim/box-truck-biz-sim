/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * welcomeModalStorage.js — persistence abstraction (localStorage)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Persists two pieces of welcome-modal state across sessions:
 *
 *   bx.welcomeModal.seenAt   ISO timestamp · null = never seen
 *   bx.welcomeModal.muted    boolean       · default false
 *
 * Uses localStorage. Works in all target environments:
 *   • Browser dev (Vite)         ✓ — uses window.localStorage
 *   • Production browser         ✓ — uses window.localStorage
 *   • Capacitor Android WebView  ✓ — WebView provides localStorage natively
 *
 * If localStorage is unavailable (e.g. private browsing with storage
 * disabled), the helpers return safe defaults — the modal degrades
 * gracefully to "always show, never persist mute."
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Future enhancement: native Capacitor Preferences
 *
 * If you want more durable native persistence on Android (survives app
 * data clears better than localStorage), install @capacitor/preferences
 * via `npm install @capacitor/preferences` and add a branch in getValue()
 * / setValue() that checks `window.Capacitor?.isNativePlatform()` and uses
 * the Preferences plugin's get/set/remove methods when available.
 * The localStorage paths below remain as the web/fallback path.
 *
 * For MVP, localStorage in the Capacitor WebView is sufficient — mute
 * state and seen-state survive normal app launches.
 * ════════════════════════════════════════════════════════════════════════════
 */

const KEY_SEEN_AT = 'bx.welcomeModal.seenAt';
const KEY_MUTED   = 'bx.welcomeModal.muted';

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL GETTERS / SETTERS
// ─────────────────────────────────────────────────────────────────────────────

async function getValue(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (err) {
    // localStorage disabled (private browsing, quota exceeded, etc.)
  }
  return null;
}

async function setValue(key, value) {
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
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(KEY_SEEN_AT);
      localStorage.removeItem(KEY_MUTED);
    }
  } catch (err) {
    // swallow
  }
}
