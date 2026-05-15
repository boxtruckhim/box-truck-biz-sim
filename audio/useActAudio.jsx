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

export function useActAudio(actKey, elapsedMs, override) {
  const ctx = useContext(AudioMixerContext);
  const mixer = ctx?.mixer;

  useEffect(() => {
    if (!mixer) return;
    const cues = override || ACT_CUES_BY_KEY[actKey] || { vo: [], sfx: [] };
    mixer.enterAct(actKey, cues);
    return () => {
      mixer.exitAct();
    };
  }, [mixer, actKey, override]);

  useEffect(() => {
    if (!mixer) return;
    mixer.update(elapsedMs);
  }, [mixer, elapsedMs]);
}
