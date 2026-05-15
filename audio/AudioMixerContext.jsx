/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * AudioMixerContext.jsx — React provider owning the AudioMixer
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Mount once at the welcome-modal root. Children get access to the mixer
 * via useContext(AudioMixerContext) — typically through useActAudio.
 *
 * Lifecycle:
 *   • On mount: create AudioMixer, set music timeline, kick off preload
 *   • Children read mixer via context
 *   • On unmount: shutdown the mixer (stops playback, releases resources)
 *
 * Also exposes preload state so the modal root can show a loading hint
 * under the "TAP TO BEGIN" overlay if preload is slow.
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { createContext, useEffect, useRef, useState } from 'react';
import { AudioMixer } from './audioMixer.js';
import {
  WELCOME_MODAL_MUSIC_TIMELINE,
  ALL_AUDIO_MANIFEST,
} from './welcomeModalAudioConfig.js';
import { getMuted } from './welcomeModalStorage.js';

export const AudioMixerContext = createContext(null);

export function AudioMixerProvider({ children, basePaths }) {
  const mixerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [preloadStats, setPreloadStats] = useState({ loaded: 0, failed: [] });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Restore mute preference from persistence
      const muted = await getMuted();

      const mixer = new AudioMixer({
        basePaths,
        muted,
        onWarn: (msg) => {
          // In production this could be wired to telemetry. For now: console.
          if (typeof console !== 'undefined') console.warn('[AudioMixer]', msg);
        },
      });

      mixer.setMusicTimeline(WELCOME_MODAL_MUSIC_TIMELINE);
      mixerRef.current = mixer;

      // ORDER MATTERS for autoplay policy:
      //
      //   1) prepareElements — synchronously creates every Audio element
      //      so they all exist before unlock primes them.
      //   2) unlockAudio    — primes every existing Audio element by
      //      play+pause within the user gesture window. After this, each
      //      element can be played without further gestures.
      //   3) preload        — awaits canplaythrough on each existing
      //      element. Reuses the primed elements (no re-creation).
      //
      // If unlock runs before prepareElements, the elements created later
      // are NOT primed and their first play() call silently queues until
      // the browser's engagement heuristics let it through — typically
      // around the second or third Act. That manifests as "Act 1 silent".
      try {
        mixer.prepareElements(ALL_AUDIO_MANIFEST);
        mixer.unlockAudio();
      } catch (e) {
        // Best-effort — z-index/modal still covers cinematic; audio just
        // unlocks via the user's first in-modal click instead.
      }

      // Preload audio files (waits for canplaythrough on each).
      const stats = await mixer.preload(ALL_AUDIO_MANIFEST);
      if (cancelled) return;

      setPreloadStats(stats);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (mixerRef.current) {
        mixerRef.current.shutdown();
        mixerRef.current = null;
      }
    };
  }, [basePaths]);

  const value = {
    mixer:    mixerRef.current,
    ready,
    preloadStats,
  };

  return (
    <AudioMixerContext.Provider value={value}>
      {children}
    </AudioMixerContext.Provider>
  );
}
