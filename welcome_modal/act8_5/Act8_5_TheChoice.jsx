/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 8.5: The Choice (BRIDGE) — v5 CONSISTENT
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 8.2-second emotional pivot beat between Act 8 (despair — DOT strobes,
 * rain, breakdowns) and Act 9 (hope rising — Bay 01 doors lifting).
 *
 * v5 CONSISTENCY PASS — two fixes from audit feedback:
 *
 *   1. CAPTIONS now use the canonical CinematicCaption component from
 *      WelcomeModalShared.jsx — same typography, color, shadow stack, and
 *      entrance animation as Acts 1, 4, 8, 9, etc. No more 26px italic
 *      word-by-word reveal with warm wash — that was breaking consistency
 *      with the rest of the cinematic. Now: 16px Outfit, color #fdf6e3,
 *      simple fade+translateY entrance, positioned lower-third like every
 *      other act.
 *
 *   2. WARM GLOW redesigned to eliminate the rectangular boundary
 *      previously visible in the upper-right corner. The new approach
 *      uses a full-stage element with an ELLIPSE radial-gradient
 *      centered off-stage to the upper-right. Because the element
 *      covers the full stage and the gradient fades smoothly to
 *      transparent within the visible area, there are no element edges
 *      to read as a rectangle.
 *
 *   Atmospheric layers retained: god rays, multi-tier parallax dust,
 *   distant bokeh, DOF bokeh highlights, camera move, color temperature
 *   evolution, vignette + grain, cinema bars.
 *
 * ─── DIALOGUE SEGMENTS ─────────────────────────────────────────────────────
 *
 *   0   → 600ms     Cross-fade in from Act 8
 *   200 → 2200ms    Line 1: "Trucking is not for the weak."
 *   2400 → 4400ms   Line 2: "Stay resilient. Stay resourceful."
 *   4600 → 7600ms   Line 3: "I will be here, in your corner throughout this journey."
 *   7600 → 8200ms   Cross-fade out into Act 9
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';
import { CinematicCaption, CinemaBars } from '../WelcomeModalShared.jsx';

const ACT_DURATION_MS = 8200;

// Marcus dialogue segments — three lines with deliberate breath between.
// Each segment has explicit start/end timestamps so the caption sits on
// screen for the full reading duration before yielding to the next line.
const VOICEMAIL_SEGMENTS = [
  { startMs:  200, endMs: 2200, text: 'Trucking is not for the weak.' },
  { startMs: 2400, endMs: 4400, text: 'Stay resilient. Stay resourceful.' },
  { startMs: 4600, endMs: 7600, text: 'I will be here, in your corner throughout this journey.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLE FIELD GENERATORS
// ═══════════════════════════════════════════════════════════════════════════
function seededRandom(seed) {
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

const DUST_MIDGROUND = Array.from({ length: 16 }, (_, i) => {
  const s1 = seededRandom(i * 13 + 7);
  const s2 = seededRandom(i * 17 + 23);
  return {
    id: `m${i}`,
    x: 55 + s1 * 42,
    y: 5 + s2 * 62,
    size: 1.5 + (i % 3),
    delay: (i * 0.27) % 2.6,
    duration: 5.0 + (i * 0.4) % 2.5,
    opacity: 0.22 + (s1 * 0.30),
  };
});

const DUST_FOREGROUND = Array.from({ length: 5 }, (_, i) => {
  const s1 = seededRandom(i * 41 + 13);
  const s2 = seededRandom(i * 59 + 31);
  return {
    id: `f${i}`,
    x: 30 + s1 * 60,
    y: 15 + s2 * 60,
    size: 5 + (i * 2),
    delay: (i * 1.1) % 3.0,
    duration: 8.0 + (i * 1.0),
    opacity: 0.10 + (s2 * 0.10),
  };
});

const DUST_BACKGROUND = Array.from({ length: 28 }, (_, i) => {
  const s1 = seededRandom(i * 7 + 3);
  const s2 = seededRandom(i * 11 + 5);
  return {
    id: `b${i}`,
    x: s1 * 100,
    y: s2 * 80,
    size: 0.8 + (i % 2) * 0.6,
    delay: (i * 0.15) % 4.0,
    duration: 7.0 + (i * 0.2) % 3.0,
    opacity: 0.10 + (s1 * 0.12),
  };
});

const DISTANT_BOKEH = [
  { x: 22, y: 88, size: 4, opacity: 0.18, hue: 'amber' },
  { x: 78, y: 92, size: 5, opacity: 0.22, hue: 'amber' },
  { x: 14, y: 78, size: 3, opacity: 0.12, hue: 'blue' },
  { x: 92, y: 82, size: 4, opacity: 0.16, hue: 'amber' },
  { x: 8,  y: 95, size: 3, opacity: 0.10, hue: 'blue' },
];

const BOKEH_HIGHLIGHTS = [
  { x: 72, y: 12, size: 14, opacity: 0.18 },
  { x: 88, y: 28, size: 22, opacity: 0.14 },
  { x: 68, y: 35, size: 10, opacity: 0.22 },
  { x: 82, y: 8,  size: 18, opacity: 0.12 },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
const Act8_5_TheChoice = React.memo(function Act8_5_TheChoice({
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('8_5', elapsedMs);

  useEffect(() => {
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const t = now - startTime;
      setElapsedMs(t);
      if (t >= ACT_DURATION_MS) {
        onComplete();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  // Master cross-fade in/out
  const fadeInOpacity  = Math.min(1, elapsedMs / 600);
  const fadeOutOpacity = Math.max(0, 1 - Math.max(0, elapsedMs - 7600) / 600);
  const stageOpacity = fadeInOpacity * fadeOutOpacity;

  // Subtle camera zoom over the 8.2s — pushes toward the warm glow source
  const cameraScale = 1.0 + Math.min(1, elapsedMs / ACT_DURATION_MS) * 0.05;

  // Color temperature evolution — cool at start (still in Act 8's despair),
  // warmer at end (Marcus's presence growing as Act 9's hope approaches)
  const warmthRamp = 0.60 + Math.min(1, elapsedMs / ACT_DURATION_MS) * 0.40;

  // Warm lamp breathing — subtle ±4% intensity drift, ~3s period
  const glowBreathe = 1 + Math.sin((elapsedMs / 3000) * Math.PI * 2) * 0.04;

  // Active dialogue segment (or null if in a silent gap)
  const currentSegment = VOICEMAIL_SEGMENTS.find(
    s => elapsedMs >= s.startMs && elapsedMs < s.endMs
  ) || null;

  return (
    <div className="a85-stage" style={{ opacity: stageOpacity }}>
      <style>{ACT8_5_STYLES}</style>

      {/* CAMERA WRAPPER — slow zoom across the act */}
      <div
        className="a85-camera"
        style={{ transform: `scale(${cameraScale})` }}
      >

        {/* LAYER 1 — Deep background gradient */}
        <div className="a85-deep-bg" />

        {/* LAYER 2 — Distant bokeh light points */}
        <div className="a85-distant-bokeh">
          {DISTANT_BOKEH.map((b, i) => (
            <div
              key={i}
              className={`a85-distant-pt a85-distant-${b.hue}`}
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: `${b.size}px`,
                height: `${b.size}px`,
                opacity: b.opacity * warmthRamp,
              }}
            />
          ))}
        </div>

        {/* LAYER 3 — Volumetric atmospheric haze (full-stage, fades smoothly) */}
        <div className="a85-volumetric-haze" style={{ opacity: 0.55 * warmthRamp }} />

        {/* LAYER 4 — God rays — volumetric light shafts emerging from warm zone */}
        <div className="a85-god-rays" style={{ opacity: 0.7 * warmthRamp * glowBreathe }} />
        <div className="a85-god-rays-soft" style={{ opacity: 0.45 * warmthRamp }} />

        {/* LAYER 5 — Warm lamp glow (FIXED: full-stage element with elliptical
            radial gradient that fades smoothly to transparent within the
            visible stage — no rectangular boundary visible) */}
        <div className="a85-warm-glow" style={{ opacity: 0.85 * warmthRamp * glowBreathe }} />
        <div className="a85-warm-glow-soft" style={{ opacity: 0.50 * warmthRamp }} />

        {/* LAYER 6 — DOF bokeh highlights */}
        <div className="a85-bokeh-layer">
          {BOKEH_HIGHLIGHTS.map((b, i) => (
            <div
              key={i}
              className="a85-bokeh"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: `${b.size * 2}px`,
                height: `${b.size * 2}px`,
                opacity: b.opacity * warmthRamp,
              }}
            />
          ))}
        </div>

        {/* LAYERS 7-9 — Multi-tier dust system (background / mid / foreground) */}
        <div className="a85-dust-layer a85-dust-bg">
          {DUST_BACKGROUND.map(m => (
            <div
              key={m.id}
              className="a85-mote a85-mote-bg"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity * warmthRamp,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="a85-dust-layer">
          {DUST_MIDGROUND.map(m => (
            <div
              key={m.id}
              className="a85-mote"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity * warmthRamp,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="a85-dust-layer a85-dust-fg">
          {DUST_FOREGROUND.map(m => (
            <div
              key={m.id}
              className="a85-mote a85-mote-fg"
              style={{
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity,
                animationDelay: `${m.delay}s`,
                animationDuration: `${m.duration}s`,
              }}
            />
          ))}
        </div>

        <div className="a85-vignette" />
        <div className="a85-grain" />
      </div>

      {/* CANONICAL CINEMATIC CAPTION — matches Acts 1, 4, 8, 9, 10, 11, 12.
          16px Outfit 400, color #fdf6e3, shadow stack with warm bloom,
          fade+translateY entrance over 0.5s. Position lower-third. */}
      <CinematicCaption text={currentSegment ? currentSegment.text : null} />

      {/* Cinema letterbox bars — canonical, matches all other acts */}
      <CinemaBars barHeight={28} delayMs={0} />

      {/* Skip button — same idiom as Acts 4 and 8 */}
      <button className="a85-skip-btn" onClick={onSkip} aria-label="Skip act">
        Skip
      </button>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const ACT8_5_STYLES = `
.a85-stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  transition: opacity 100ms linear;
}

.a85-camera {
  position: absolute;
  inset: 0;
  transform-origin: 88% 14%;
  will-change: transform;
}

/* LAYER 1: Deep background — cool dark, echoes Act 8's night atmosphere */
.a85-deep-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 100%, rgba(20, 18, 25, 1) 0%, transparent 70%),
    radial-gradient(ellipse 90% 70% at 70% 20%, rgba(35, 22, 12, 1) 0%, transparent 75%),
    linear-gradient(180deg, #050306 0%, #080608 50%, #050306 100%);
}

/* LAYER 2: Distant bokeh light points */
.a85-distant-bokeh { position: absolute; inset: 0; pointer-events: none; }
.a85-distant-pt {
  position: absolute;
  border-radius: 50%;
  filter: blur(1.5px);
  mix-blend-mode: screen;
}
.a85-distant-amber {
  background: radial-gradient(circle, rgba(255, 195, 130, 1) 0%, rgba(255, 165, 95, 0.5) 50%, transparent 100%);
  box-shadow: 0 0 8px rgba(255, 175, 110, 0.6);
}
.a85-distant-blue {
  background: radial-gradient(circle, rgba(120, 165, 220, 1) 0%, rgba(80, 120, 180, 0.4) 50%, transparent 100%);
  box-shadow: 0 0 6px rgba(100, 150, 200, 0.5);
}

/* LAYER 3: Volumetric haze — full-stage with ellipse gradients that all fade smoothly */
.a85-volumetric-haze {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 50% at 88% 18%, rgba(255, 195, 140, 0.12) 0%, rgba(255, 170, 110, 0.06) 35%, transparent 70%),
    radial-gradient(ellipse 50% 45% at 25% 75%, rgba(80, 90, 110, 0.07) 0%, transparent 65%);
  filter: blur(22px);
  mix-blend-mode: screen;
  pointer-events: none;
}

/* LAYER 4: God rays — volumetric light shafts emerging from warm zone */
.a85-god-rays {
  position: absolute;
  inset: -30%;
  background: conic-gradient(
    from 160deg at 80% 18%,
    transparent 0deg,
    rgba(255, 200, 135, 0) 8deg,
    rgba(255, 195, 130, 0.10) 14deg,
    rgba(255, 200, 135, 0) 22deg,
    rgba(255, 195, 130, 0.08) 32deg,
    rgba(255, 200, 135, 0) 42deg,
    rgba(255, 195, 130, 0.12) 56deg,
    rgba(255, 200, 135, 0) 70deg,
    rgba(255, 195, 130, 0.07) 84deg,
    rgba(255, 200, 135, 0) 96deg,
    rgba(255, 195, 130, 0.10) 108deg,
    transparent 120deg,
    transparent 360deg
  );
  filter: blur(6px);
  mix-blend-mode: screen;
  pointer-events: none;
}

.a85-god-rays-soft {
  position: absolute;
  inset: -40%;
  background: conic-gradient(
    from 155deg at 80% 18%,
    transparent 0deg,
    rgba(255, 180, 115, 0.06) 30deg,
    transparent 60deg,
    rgba(255, 180, 115, 0.04) 90deg,
    transparent 120deg,
    transparent 360deg
  );
  filter: blur(18px);
  mix-blend-mode: screen;
  pointer-events: none;
}

/* LAYER 5: WARM LAMP GLOW — FIXED
   The previous version used a positioned element with hard rectangular
   edges that became visible because the radial-gradient inside didn't
   fully fade to transparent by the time it hit those edges. Result: a
   subtle rectangular boundary in the upper-right corner.

   New approach: element covers full stage (no edges to fade against),
   with the radial-gradient centered in the upper-right and using ellipse
   sizing so it fades smoothly to transparent within the visible area.
   The gradient stops are spaced to keep the visible portion well within
   the transparent zone before any element-edge could become visible. */
.a85-warm-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 65% 42% at 88% 14%,
    rgba(255, 215, 155, 0.62) 0%,
    rgba(255, 195, 130, 0.48) 12%,
    rgba(255, 175, 110, 0.32) 28%,
    rgba(255, 155, 90, 0.18) 46%,
    rgba(255, 135, 75, 0.08) 65%,
    rgba(255, 120, 65, 0.02) 82%,
    transparent 100%
  );
  mix-blend-mode: screen;
  pointer-events: none;
  filter: blur(2px);
}

.a85-warm-glow-soft {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 95% 70% at 88% 14%,
    rgba(255, 195, 130, 0.28) 0%,
    rgba(255, 175, 105, 0.18) 18%,
    rgba(255, 155, 85, 0.10) 38%,
    rgba(255, 135, 75, 0.04) 58%,
    transparent 80%
  );
  mix-blend-mode: screen;
  pointer-events: none;
  filter: blur(12px);
}

/* LAYER 6: DOF bokeh highlights */
.a85-bokeh-layer { position: absolute; inset: 0; pointer-events: none; }
.a85-bokeh {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%,
    rgba(255, 220, 165, 0.85) 0%,
    rgba(255, 195, 130, 0.5) 40%,
    rgba(255, 170, 105, 0.15) 80%,
    transparent 100%);
  filter: blur(2px);
  mix-blend-mode: screen;
}

/* LAYERS 7-9: Multi-tier dust */
.a85-dust-layer { position: absolute; inset: 0; pointer-events: none; }
.a85-mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 225, 175, 1) 0%,
    rgba(255, 195, 135, 0.6) 50%,
    transparent 100%);
  animation-name: a85-mote-drift-mid;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  filter: blur(0.3px);
  mix-blend-mode: screen;
  box-shadow: 0 0 4px rgba(255, 200, 140, 0.6);
}
.a85-mote-fg {
  filter: blur(2.5px);
  animation-name: a85-mote-drift-fg;
  box-shadow: 0 0 8px rgba(255, 195, 130, 0.5);
  background: radial-gradient(circle,
    rgba(255, 215, 165, 0.9) 0%,
    rgba(255, 180, 120, 0.4) 60%,
    transparent 100%);
}
.a85-mote-bg {
  filter: blur(0.5px);
  animation-name: a85-mote-drift-bg;
  box-shadow: 0 0 2px rgba(255, 190, 130, 0.4);
}

@keyframes a85-mote-drift-mid {
  0%   { transform: translate(0, 0); }
  100% { transform: translate(-12px, -38px); }
}
@keyframes a85-mote-drift-fg {
  0%   { transform: translate(0, 0); }
  100% { transform: translate(-18px, -55px); }
}
@keyframes a85-mote-drift-bg {
  0%   { transform: translate(0, 0); }
  100% { transform: translate(-6px, -22px); }
}

/* Vignette + grain */
.a85-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.40) 75%,
    rgba(0, 0, 0, 0.75) 100%);
  pointer-events: none;
}

.a85-grain {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
  opacity: 0.05;
  mix-blend-mode: overlay;
  pointer-events: none;
  animation: a85-grain-shift 0.25s steps(2) infinite;
}

@keyframes a85-grain-shift {
  0%   { transform: translate(0, 0); }
  100% { transform: translate(-1px, 1px); }
}

/* Skip button — same idiom as Act 4 / Act 8 */
.a85-skip-btn {
  position: absolute;
  bottom: 50px;
  right: 18px;
  z-index: 80;
  background: transparent;
  border: none;
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 245, 230, 0.55);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  padding: 6px 10px;
  border-radius: 4px;
  transition: color 0.2s ease;
}
.a85-skip-btn:hover { color: rgba(255, 245, 230, 0.85); }
`;

export default Act8_5_TheChoice;
