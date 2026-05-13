/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * TapToBeginOverlay.jsx — autoplay-unlock gate
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Modal-spanning overlay shown over Act 1's first frame. On tap:
 *   1. Calls mixer.unlockAudio() (creates AudioContext, primes elements)
 *   2. Fires onBegin() — host modal starts the cinematic clock
 *   3. Fades the overlay out
 *
 * Cinematic-grade styling: same typography family as captions
 * (Outfit, color #fdf6e3, warm bloom shadow), pulsing play affordance,
 * "TAP TO BEGIN" + sub-line "🔊 Best with sound on".
 *
 * Also shows preload progress if audio is still loading.
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useContext, useEffect, useState } from 'react';
import { AudioMixerContext } from './AudioMixerContext.jsx';

export function TapToBeginOverlay({ onBegin }) {
  const ctx = useContext(AudioMixerContext);
  const [dismissed, setDismissed] = useState(false);

  const handleTap = () => {
    if (dismissed) return;
    if (ctx?.mixer) {
      ctx.mixer.unlockAudio();
    }
    setDismissed(true);
    // Wait for the fade-out before firing onBegin so the cinematic doesn't
    // start until the overlay is visually gone (300ms)
    setTimeout(() => {
      if (onBegin) onBegin();
    }, 300);
  };

  return (
    <>
      <style>{TAP_TO_BEGIN_STYLES}</style>
      <div
        className={`ttb-overlay ${dismissed ? 'ttb-overlay--dismissing' : ''}`}
        onClick={handleTap}
        onTouchStart={handleTap}
        role="button"
        aria-label="Tap to begin"
      >
        <div className="ttb-center">
          <div className="ttb-play-icon" aria-hidden="true">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="38" className="ttb-play-ring" />
              <polygon points="32,24 32,56 58,40" className="ttb-play-tri" />
            </svg>
          </div>
          <div className="ttb-headline">TAP TO BEGIN</div>
          <div className="ttb-subline">
            <span aria-hidden="true">🔊</span> Best with sound on
          </div>
          {ctx && !ctx.ready && (
            <div className="ttb-loading">Loading…</div>
          )}
        </div>
      </div>
    </>
  );
}

const TAP_TO_BEGIN_STYLES = `
.ttb-overlay {
  position: absolute;
  inset: 0;
  z-index: 100;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.82) 80%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  transition: opacity 300ms ease-out;
  opacity: 1;
}
.ttb-overlay--dismissing {
  opacity: 0;
  pointer-events: none;
}

.ttb-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.ttb-play-icon {
  width: 80px;
  height: 80px;
  animation: ttb-pulse 2.2s ease-in-out infinite;
  filter: drop-shadow(0 0 18px rgba(255, 180, 90, 0.35));
}
.ttb-play-ring {
  fill: none;
  stroke: rgba(253, 246, 227, 0.85);
  stroke-width: 2;
}
.ttb-play-tri {
  fill: rgba(253, 246, 227, 0.92);
}

.ttb-headline {
  font-size: 19px;
  font-weight: 500;
  letter-spacing: 0.22em;
  color: #fdf6e3;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.95),
    0 2px 16px rgba(0, 0, 0, 0.85),
    0 0 28px rgba(255, 180, 90, 0.18);
}

.ttb-subline {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: rgba(253, 246, 227, 0.68);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ttb-loading {
  margin-top: 8px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: rgba(253, 246, 227, 0.45);
  text-transform: uppercase;
}

@keyframes ttb-pulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50%      { transform: scale(1.06); opacity: 1; }
}
`;
