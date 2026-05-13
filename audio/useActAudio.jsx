/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * useActAudio.jsx — per-act audio wiring hook
 * ════════════════════════════════════════════════════════════════════════════
 *
 * One line in each Act component:
 *
 *   useActAudio('8_5', elapsedMs);
 *
 * The hook:
 *   • Looks up the act's cue object from welcomeModalAudioConfig
 *   • Calls mixer.enterAct(...) on mount  (handles music bed transitions)
 *   • Calls mixer.update(elapsedMs) on every tick
 *   • Calls mixer.exitAct() on unmount
 *
 * If the mixer isn't available (e.g., context missing or audio failed
 * to initialize), the hook is a no-op. Visuals proceed regardless.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { useContext, useEffect } from 'react';
import { AudioMixerContext } from './AudioMixerContext.jsx';
import { ACT_CUES_BY_KEY } from './welcomeModalAudioConfig.js';

/**
 * Wire audio for the current Act.
 *
 * @param {string} actKey - one of: '1','2','3','4','5','6','7','8','8_5','9','10','11','12'
 * @param {number} elapsedMs - milliseconds since the act started (RAF-driven)
 * @param {object} [override] - optional cue override (useful for testing
 *                              or for custom acts not in ACT_CUES_BY_KEY)
 */
export function useActAudio(actKey, elapsedMs, override) {
  const ctx = useContext(AudioMixerContext);
  const mixer = ctx?.mixer;

  // Enter/exit act on mount/unmount or when actKey changes
  useEffect(() => {
    if (!mixer) return;
    const cues = override || ACT_CUES_BY_KEY[actKey] || { vo: [], sfx: [] };
    mixer.enterAct(actKey, cues);
    return () => {
      mixer.exitAct();
    };
  }, [mixer, actKey, override]);

  // Drive the scheduler on every tick
  useEffect(() => {
    if (!mixer) return;
    mixer.update(elapsedMs);
  }, [mixer, elapsedMs]);
}
