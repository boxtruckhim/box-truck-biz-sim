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

      // Preload — don't block ready state; we want the tap-to-begin overlay
      // to appear immediately even while audio loads in the background.
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
