// ═════════════════════════════════════════════════════════════════════════════
// ACT 2 — TITLE DROP (v2.0)
// ═════════════════════════════════════════════════════════════════════════════
//
// Runtime: 3.0 seconds total
//
// Cinematic contract:
//   • Begins on black (Act 1 cut to black at 6.0s of preceding act)
//   • Title "BOX TRUCK BOSS" snaps on with documentary hardness
//   • Holds bright with micro-motion: breathing + slow zoom + light streak
//   • Fades to black, handing off to Act 3
//
// v2.0 changes from v1.0:
//   1. Tagline REMOVED — let the cinema carry the meaning
//   2. Anton font BUNDLED — vintage industrial typography, base64-embedded
//      so it works without network. Heaviest weight, chunkier letterforms,
//      reads as "stamped on a freightliner" rather than generic system
//      fallback. Direct lineage with truck-yard signage aesthetic.
//   3. Horizontal warm-light streak sweeps across the title during held
//      breath — echoes Act 1's lamp idiom (warmth, light) and gives the
//      title living motion without crowding the frame.
//
// Choreography:
//   0 - 50ms:    Title snaps on with overshoot (opacity 0 → 1.05)
//   50 - 100ms:  Settle from overshoot (1.05 → 1.0)
//   100 - 800ms: Hold (no light streak yet — title establishes itself)
//   800 - 2400ms: Light streak sweeps slowly L→R across letters (1.6s)
//   100 - 2700ms: Background breathing + slow zoom continues throughout
//   2700 - 3000ms: Fade to black (300ms ease-out cubic)
//
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';
import {
  CinematicStage,
  CinemaBars,
  AtmosphericLayers,
} from '../WelcomeModalShared.jsx';

const ACT2_DURATION = 3000;
const TITLE_TEXT = 'BOX TRUCK BOSS';

export default function Act2TitleDrop({
  onComplete = () => {},
  onSkip = () => {},
  antonB64 = null,
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('2', elapsedMs);
  const startRef = useRef(performance.now());
  const completedRef = useRef(false);

  useEffect(() => {
    let frameId;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= ACT2_DURATION) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [onComplete]);

  // ─── TITLE OPACITY ───
  let titleOpacity;
  if (elapsedMs < 50) {
    const t = elapsedMs / 50;
    titleOpacity = t * 1.05;
  } else if (elapsedMs < 100) {
    const t = (elapsedMs - 50) / 50;
    titleOpacity = 1.05 - t * 0.05;
  } else if (elapsedMs < 2700) {
    const breathPhase = ((elapsedMs - 100) / 2000) * Math.PI * 2;
    titleOpacity = 1.0 + Math.sin(breathPhase) * 0.02;
  } else {
    const t = (elapsedMs - 2700) / 300;
    const eased = 1 - Math.pow(1 - t, 3);
    titleOpacity = 1.0 * (1 - eased);
  }

  // ─── SUBTLE ZOOM-IN ───
  let titleScale;
  if (elapsedMs < 100) {
    const t = Math.min(elapsedMs / 100, 1);
    titleScale = 0.985 + t * 0.015;
  } else if (elapsedMs < 2700) {
    const t = (elapsedMs - 100) / 2600;
    titleScale = 1.0 + t * 0.025;
  } else {
    titleScale = 1.025;
  }

  // ─── LIGHT STREAK MASK POSITION ───
  // The duplicate-title layer is masked by a horizontal gradient with a
  // narrow opaque slice. Animating mask-position from -50% to 150% moves
  // the visible slice from off-left of the letters to off-right.
  // Sine fade-in/out at edges so streak appears and disappears smoothly
  // as it enters/exits the letters.
  let streakPosition = -50;
  let streakOpacity = 0;
  if (elapsedMs >= 800 && elapsedMs < 2400) {
    const t = (elapsedMs - 800) / 1600;
    streakPosition = -50 + t * 200;  // -50% → 150%
    streakOpacity = Math.sin(t * Math.PI);
  }

  // Skip on key/click
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  return (
    <>
      <Act2Styles antonB64={antonB64} />
      <CinematicStage onClick={onSkip}>
        <div className="a2-background" />

        <div
          className="a2-title-container"
          style={{
            opacity: titleOpacity,
            transform: `translate(-50%, -50%) scale(${titleScale})`,
          }}
        >
          <div className="a2-title">
            <span className="a2-title-line">BOX</span>
            <span className="a2-title-line">TRUCK</span>
            <span className="a2-title-line">BOSS</span>

            {/* Light streak: a duplicate title layer in brighter color,
                positioned identically over the original. A moving CSS mask
                gradient reveals only a horizontal slice — so only the
                letters within that slice become brighter as the streak
                "crosses" them. Empty space between letters stays unchanged
                because the duplicate has no fill there to reveal.
                
                The streak layer is aria-hidden because it duplicates text
                that's already in the DOM via the original title. */}
            <div
              className="a2-title-streak"
              aria-hidden="true"
              style={{
                opacity: streakOpacity,
                WebkitMaskPosition: `${streakPosition}% center`,
                maskPosition: `${streakPosition}% center`,
              }}
            >
              <span className="a2-title-line">BOX</span>
              <span className="a2-title-line">TRUCK</span>
              <span className="a2-title-line">BOSS</span>
            </div>
          </div>
        </div>

        <AtmosphericLayers
          vignette={true}
          scanlines={false}
          grain={true}
          warmTint={false}
          lightShaft={false}
        />

        <CinemaBars barHeight={32} delayMs={0} />
      </CinematicStage>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

function getAct2Styles(antonB64) {
  const fontFace = antonB64
    ? `@font-face {
         font-family: 'Anton';
         src: url(data:font/ttf;base64,${antonB64}) format('truetype');
         font-weight: 400;
         font-display: block;
       }`
    : '';

  return `
${fontFace}

.a2-background {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center,
    #0a0c12 0%,
    #060809 60%,
    #030405 100%);
  z-index: 1;
}

.a2-title-container {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 10;
  text-align: center;
  pointer-events: none;
  transform-origin: center center;
  will-change: transform, opacity;
}

.a2-title {
  position: relative;
  display: inline-block;
  font-family: 'Anton', 'Bebas Neue', Impact, 'Arial Narrow', sans-serif;
  font-weight: 400;
  font-size: clamp(56px, 13vw, 110px);
  letter-spacing: 0.10em;
  line-height: 0.95;
  color: #f5d29a;
  text-transform: uppercase;
  text-shadow:
    0 0 14px rgba(255, 195, 110, 0.40),
    0 0 28px rgba(255, 170, 80, 0.22),
    0 0 56px rgba(255, 145, 60, 0.10),
    0 1px 0 rgba(0, 0, 0, 0.85);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.a2-title-line {
  display: block;
}

/* LIGHT STREAK via masked duplicate title layer.
   The duplicate renders the same Anton text in a brighter warm color
   (closer to white-warm). A horizontal mask gradient with a narrow
   opaque slice (~30% wide) means only that slice of the duplicate is
   visible at any time. Animating mask-position L→R moves the visible
   slice across the letters.
   
   Effect: the letters within the streak slice appear brighter, while
   empty space between letters stays untouched (because the duplicate
   has nothing to show there).
   
   The mask-size is 300% so we have positions 0%-100% to cover the streak
   moving across the title from left edge to right edge.
   
   Multiple stops in the gradient give the streak soft edges:
   - 0% to 35%: transparent (left dark zone)
   - 35% to 50%: ramps up to opaque (leading edge of streak)
   - 50% to 65%: ramps down to transparent (trailing edge)
   - 65% to 100%: transparent (right dark zone)
   
   With mask-size 300% and mask-position 0% center, the visible slice is
   in the center-right area. As mask-position increases, the slice moves
   leftward visually (because we're scrolling the mask image rightward
   relative to the masked element). To get a left-to-right SWEEP effect,
   we animate mask-position from -50% (slice off left) to 150% (slice off right).
*/
.a2-title-streak {
  position: absolute;
  inset: 0;
  /* Brighter warm color — when this layer overlaps the original through
     the mask, the letters appear brighter (mix-blend-mode: screen would
     also work, but additive opacity via direct color is more predictable). */
  color: #fff5d8;
  text-shadow:
    0 0 18px rgba(255, 220, 145, 0.75),
    0 0 32px rgba(255, 195, 110, 0.45);
  pointer-events: none;
  /* Mask: only show a narrow horizontal slice. mask-size 300% means the
     gradient is 3x the element width, so positions span -100% to 200%. */
  -webkit-mask-image: linear-gradient(90deg,
    transparent 0%,
    transparent 35%,
    rgba(0, 0, 0, 0.7) 45%,
    black 50%,
    rgba(0, 0, 0, 0.7) 55%,
    transparent 65%,
    transparent 100%);
  mask-image: linear-gradient(90deg,
    transparent 0%,
    transparent 35%,
    rgba(0, 0, 0, 0.7) 45%,
    black 50%,
    rgba(0, 0, 0, 0.7) 55%,
    transparent 65%,
    transparent 100%);
  -webkit-mask-size: 300% 100%;
  mask-size: 300% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  will-change: opacity;
}

.a2-title-streak .a2-title-line {
  display: block;
}
`;
}

function Act2Styles({ antonB64 }) {
  useEffect(() => {
    const id = 'act2-styles';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = getAct2Styles(antonB64);
  }, [antonB64]);
  return null;
}
