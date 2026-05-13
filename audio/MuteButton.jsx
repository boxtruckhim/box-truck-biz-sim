/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * MuteButton.jsx — top-right mute toggle, persistent across acts
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Small speaker icon, two states (🔊 / 🔇). Mounted at the modal root,
 * persists across all acts. Reads initial state from storage, syncs to
 * mixer + storage on every toggle.
 *
 * Touch-target compliant (44×44px hit area) with a smaller visual icon.
 * Same styling family as the Skip button.
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useContext, useEffect, useState } from 'react';
import { AudioMixerContext } from './AudioMixerContext.jsx';
import { getMuted, setMuted as persistMuted } from './welcomeModalStorage.js';

export function MuteButton() {
  const ctx = useContext(AudioMixerContext);
  const [muted, setMutedLocal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Restore mute preference on mount
  useEffect(() => {
    (async () => {
      const initial = await getMuted();
      setMutedLocal(initial);
      setLoaded(true);
    })();
  }, []);

  // Keep mixer in sync (e.g., if AudioMixerContext recreates the mixer)
  useEffect(() => {
    if (!loaded) return;
    if (ctx?.mixer) ctx.mixer.setMuted(muted);
  }, [muted, ctx?.mixer, loaded]);

  const toggle = () => {
    const next = !muted;
    setMutedLocal(next);
    persistMuted(next);
    if (ctx?.mixer) ctx.mixer.setMuted(next);
  };

  return (
    <>
      <style>{MUTE_BUTTON_STYLES}</style>
      <button
        className="wm-mute-btn"
        onClick={toggle}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={muted}
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 4 L7 8 H4 V16 H7 L12 20 V4 Z"
              fill="rgba(253, 246, 227, 0.65)"
              stroke="none"
            />
            <line x1="16" y1="9" x2="22" y2="15" stroke="rgba(253, 246, 227, 0.65)" strokeWidth="2" strokeLinecap="round" />
            <line x1="22" y1="9" x2="16" y2="15" stroke="rgba(253, 246, 227, 0.65)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 4 L7 8 H4 V16 H7 L12 20 V4 Z"
              fill="rgba(253, 246, 227, 0.65)"
              stroke="none"
            />
            <path
              d="M16 9 Q19 12 16 15"
              fill="none"
              stroke="rgba(253, 246, 227, 0.65)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M18 7 Q22 12 18 17"
              fill="none"
              stroke="rgba(253, 246, 227, 0.45)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </>
  );
}

const MUTE_BUTTON_STYLES = `
.wm-mute-btn {
  position: absolute;
  top: 50px;
  right: 18px;
  z-index: 90;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding: 0;
  border-radius: 4px;
  transition: opacity 0.2s ease;
  opacity: 0.85;
}
.wm-mute-btn:hover { opacity: 1; }
.wm-mute-btn:focus { outline: none; }
.wm-mute-btn:active { transform: scale(0.94); }
`;
