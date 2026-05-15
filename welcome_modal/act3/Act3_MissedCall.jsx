// ═════════════════════════════════════════════════════════════════════════════
// ACT 3 — THE MISSED CALL
// ═════════════════════════════════════════════════════════════════════════════
//
// Runtime: 3.5 seconds total
//
// Cinematic contract:
//   • Begins on near-black (Act 2 fades to black at 3.0s)
//   • Phone screen wakes up on a dark desk, casting cold blue-white light
//   • Notification appears: "MARCUS RODRIGUEZ — DISPATCH — 1 NEW VOICEMAIL"
//   • Time stamp 4:47 AM (matches Act 1's pre-dawn timing — diegetic continuity)
//   • Slight phone vibration cue, brief held beat
//   • Camera push-in toward phone screen as transition setup for Act 4
//   • Hand-off: Act 4's voicemail card animates in from below as if "this is
//     the voicemail playing" — same iOS visual language, same call.
//
// Atmospheric continuity:
//   • Warm spill from upper-right corner — implied off-screen desk lamp,
//     same idiom as Act 1's lamp glow. Color thread between acts.
//   • Anton typography for "MARCUS RODRIGUEZ" — same display font as Act 2
//   • Cinema bars + vignette + grain (continues throughout cinematic)
//   • No scanlines (same as Act 2 — would distract from phone screen detail)
//
// Choreography:
//   0 - 200ms:   Black with subtle ambient warm spill
//   200 - 600ms: Phone screen "wakes up" — fade-in with subtle scale overshoot
//   600 - 1100ms: Vibration cue — phone shakes left-right 3-4 times (subtle)
//   1100 - 2400ms: Held — viewer reads the notification
//   2400 - 3500ms: Slow push-in toward phone screen (1.05 → 1.12 scale)
//                  Hand-off to Act 4 in final 200ms
//
// ═════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';
import {
  CinematicStage,
  CinemaBars,
  AtmosphericLayers,
} from '../WelcomeModalShared.jsx';

const ACT3_DURATION = 3500;

export default function Act3MissedCall({
  onComplete = () => {},
  onSkip = () => {},
  antonB64 = null,
  woodTextureUri = null,
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('3', elapsedMs);
  const startRef = useRef(performance.now());
  const completedRef = useRef(false);

  useEffect(() => {
    let frameId;
    const tick = () => {
      const now = performance.now();
      const elapsed = now - startRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= ACT3_DURATION) {
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

  // ─── PHONE OPACITY + INITIAL SCALE OVERSHOOT ───
  // Phone fades in 200-600ms with a slight overshoot to mimic display
  // turning on (real phone screens have a brief peak in brightness when
  // they wake up).
  let phoneOpacity = 0;
  let phoneWakeScale = 0.98;  // starts slightly small
  if (elapsedMs < 200) {
    phoneOpacity = 0;
  } else if (elapsedMs < 500) {
    // Quick fade-in with slight overshoot
    const t = (elapsedMs - 200) / 300;
    phoneOpacity = t * 1.05;
    phoneWakeScale = 0.98 + t * 0.025;  // 0.98 → 1.005
  } else if (elapsedMs < 600) {
    // Settle from overshoot
    const t = (elapsedMs - 500) / 100;
    phoneOpacity = 1.05 - t * 0.05;
    phoneWakeScale = 1.005 - t * 0.005;  // 1.005 → 1.0
  } else {
    phoneOpacity = 1.0;
    phoneWakeScale = 1.0;
  }

  // ─── VIBRATION CUE (600-1100ms) ───
  // Subtle horizontal shake, 3-4 oscillations, then settles.
  // ±1.5px translation at 12Hz frequency.
  let vibrateX = 0;
  let screenBrightnessPulse = 0;
  if (elapsedMs >= 600 && elapsedMs < 1100) {
    const t = (elapsedMs - 600) / 500;
    // Shake amplitude decreases over time (bounce-like)
    const decay = 1 - t;
    const phase = t * Math.PI * 12;  // 12Hz total over 500ms
    vibrateX = Math.sin(phase) * 1.5 * decay;
    // Brightness pulse: peaks at vibration peaks (where |sin| is max).
    // Math.abs(Math.sin(phase)) gives 0..1 with peaks at every half-cycle.
    // Multiply by decay so pulses fade with the vibration.
    // 0.07 max brightness boost = ~7% screen brightness flash.
    screenBrightnessPulse = Math.abs(Math.sin(phase)) * 0.07 * decay;
  }

  // ─── PUSH-IN SCALE (2400-3500ms) ───
  // Slow camera push toward phone — readies hand-off to Act 4.
  // Scale 1.0 → 1.12 over 1100ms with ease-out cubic.
  let pushScale = 1.0;
  if (elapsedMs >= 2400) {
    const t = Math.min((elapsedMs - 2400) / 1100, 1);
    const eased = 1 - Math.pow(1 - t, 3);  // ease-out cubic
    pushScale = 1.0 + eased * 0.12;
  }

  // ─── COMBINED SCALE ───
  const combinedScale = phoneWakeScale * pushScale;

  // ─── BACKGROUND OPACITY (warm spill fades in slowly) ───
  // The warm spill from the off-screen desk lamp is faintly visible from
  // the start — it's the "always-on" atmospheric warmth. No animation
  // needed beyond the initial fade-in matching the phone.
  const warmSpillOpacity = Math.min(elapsedMs / 600, 1.0);

  // ─── HAND-OFF FADE (last 200ms — matches Act 4's 800ms fade-in) ───
  // Subtle darkening at the very end so the transition to Act 4 reads as
  // a continuous "the voicemail begins playing" rather than a hard cut.
  let exitOpacity = 1.0;
  if (elapsedMs >= 3300) {
    const t = (elapsedMs - 3300) / 200;
    exitOpacity = 1.0 - t * 0.3;  // dim to 70% (Act 4 fades in over the rest)
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
      <Act3Styles antonB64={antonB64} />
      <CinematicStage onClick={onSkip}>
        {/* ─── BASE BACKGROUND (deep dark fallback) ─── */}
        <div
          className="a3-background"
          style={{ opacity: 1.0 }}
        />

        {/* ─── DESK SURFACE (rich wood grain photo) ───
            Real photograph from Unsplash CC0. Dimmed via filter to keep
            cinematic dark register. Provides physical grounding —
            phone reads as "placed on Marcus's desk" rather than floating.
            
            The texture is passed in via prop or window global so the
            component stays self-contained even when the photo isn't
            available (graceful fallback to dark gradient). */}
        {woodTextureUri && (
          <div
            className="a3-desk-surface"
            style={{
              backgroundImage: `url(${woodTextureUri})`,
            }}
          />
        )}

        {/* ─── DESK VIGNETTE (darken edges to keep cinematic frame) ─── */}
        {woodTextureUri && <div className="a3-desk-vignette" />}

        {/* ─── WARM SPILL FROM UPPER-RIGHT (off-screen desk lamp) ─── */}
        <div
          className="a3-warm-spill"
          style={{ opacity: warmSpillOpacity * 0.7 }}
        />

        {/* ─── COLD LIGHT SPILL FROM PHONE (radial, around phone position) ─── */}
        {/* The phone screen casts cold blue-white light on the desk around it.
            This element fades in with the phone and provides the "phone is
            the only direct light source" effect. */}
        <div
          className="a3-phone-spill"
          style={{ opacity: phoneOpacity * 0.85 }}
        />

        {/* ─── PHONE CONTAINER (transformed by vibrate + push-in + wake scale) ─── */}
        <div
          className="a3-phone-wrap"
          style={{
            opacity: phoneOpacity * exitOpacity,
            transform: `translate(calc(-50% + ${vibrateX}px), -50%) rotate(-1.5deg) scale(${combinedScale})`,
          }}
        >
          <div className="a3-phone">
            {/* iOS-style notification screen content */}
            <div
              className="a3-phone-screen"
              style={{
                /* Brightness pulse on vibration — screen flashes ~7%
                   brighter at each vibration peak (synced to 12Hz shake).
                   Calculated below in main render fn. */
                filter: `brightness(${1.0 + screenBrightnessPulse})`,
              }}
            >
              {/* iOS status bar — tiny, anchored to top of screen.
                  Time on left, signal/battery icons on right. */}
              <div className="a3-status-bar">
                <span className="a3-status-time">5:47</span>
                <div className="a3-status-icons">
                  {/* Cellular signal — three dots ascending */}
                  <span className="a3-icon-cell">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </span>
                  {/* Battery — rounded rect with fill bar */}
                  <span className="a3-icon-battery">
                    <span className="a3-battery-fill"></span>
                  </span>
                </div>
              </div>

              {/* Dynamic Island — black pill at top center.
                  This is the "instant iPhone recognition" element. */}
              <div className="a3-dynamic-island"></div>

              {/* Notification content — centered vertically below
                  the status bar / Dynamic Island. */}
              <div className="a3-notification">
                <div className="a3-phone-time">5:47 AM</div>
                <div className="a3-phone-name">
                  <span>MARCUS</span>
                  <span>RODRIGUEZ</span>
                </div>
                <div className="a3-phone-meta">Dispatch</div>
                <div className="a3-phone-vm-label">1 NEW VOICEMAIL</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── ATMOSPHERIC LAYERS ─── */}
        <AtmosphericLayers
          vignette={true}
          scanlines={false}
          grain={true}
          warmTint={false}
          lightShaft={false}
        />

        {/* ─── CINEMA BARS ─── */}
        <CinemaBars barHeight={32} delayMs={0} />
      </CinematicStage>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

function getAct3Styles(antonB64) {
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

/* BASE BACKGROUND: deep dark with very subtle warm tint at the bottom
   (suggesting the desk surface). Almost pure black.
   Acts as fallback if wood texture isn't provided. */
.a3-background {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse at 50% 80%, #14100a 0%, #0a0805 35%, #050402 70%),
    #050402;
  z-index: 1;
}

/* DESK SURFACE: wood grain texture photograph (Unsplash CC0).
   Filter dims and adds slight contrast to keep cinematic dark register.
   Texture should be visible at edges but heavily shadowed under the phone
   (handled by the vignette layer). */
.a3-desk-surface {
  position: absolute;
  inset: 0;
  z-index: 2;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  filter: brightness(0.55) contrast(1.05);
}

/* DESK VIGNETTE: dark radial overlay over the texture. Crushes the
   corners to deep shadow while keeping the area around the phone
   slightly more visible. Maintains cinematic letterbox feel. */
.a3-desk-vignette {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: radial-gradient(
    ellipse 80% 80% at center,
    transparent 0%,
    transparent 30%,
    rgba(0, 0, 0, 0.5) 70%,
    rgba(0, 0, 0, 0.85) 100%
  );
  pointer-events: none;
}

/* WARM SPILL FROM UPPER-RIGHT: implied off-screen desk lamp, same idiom
   as Act 1. Soft warm radial gradient in the upper-right corner area. */
.a3-warm-spill {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 60% 50% at 85% 15%,
    rgba(255, 195, 110, 0.18) 0%,
    rgba(255, 170, 80, 0.08) 40%,
    transparent 75%
  );
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: screen;
}

/* COLD LIGHT SPILL FROM PHONE: radial gradient centered on the phone's
   position, casting cold blue-white light on the surrounding "desk".
   Provides the visual cue that the phone IS the light source.
   Positioned slightly larger than the phone itself. */
.a3-phone-spill {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-1.5deg);
  width: 90%;
  height: 90%;
  background: radial-gradient(
    ellipse 35% 50% at center,
    rgba(170, 200, 240, 0.30) 0%,
    rgba(140, 180, 230, 0.15) 25%,
    rgba(120, 160, 220, 0.06) 50%,
    transparent 75%
  );
  pointer-events: none;
  z-index: 5;
  mix-blend-mode: screen;
}

/* PHONE WRAP: positioning + transformation container.
   The wrap handles position (centered), vibration, push-in scale, and
   the slight -1.5° rotation that makes the phone feel "set down on the
   desk casually" rather than perfectly aligned. */
.a3-phone-wrap {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 10;
  width: 55%;
  max-width: 280px;
  /* aspect-ratio drives height — phones are roughly 9:19.5 */
  aspect-ratio: 9 / 19.5;
  pointer-events: none;
  transform-origin: center center;
  will-change: transform, opacity;
}

/* PHONE BODY: dark frame with rounded corners. The "physical" phone. */
.a3-phone {
  position: absolute;
  inset: 0;
  background: #0a0a0c;
  border-radius: 28px;
  /* Multi-layer shadow gives the phone depth + casts cold light spill */
  box-shadow:
    /* Inner frame highlight */
    0 0 0 2px #1a1a1d,
    /* Drop shadow under phone */
    0 8px 24px rgba(0, 0, 0, 0.85),
    /* Cold glow from screen */
    0 0 60px 12px rgba(160, 200, 255, 0.18),
    0 0 120px 30px rgba(140, 180, 230, 0.08);
}

/* SCREEN: inset from phone body, dark blue-black background.
   Notification content inside.
   v1.1: Layout changed to accommodate status bar and Dynamic Island —
   content positioned with absolute layers rather than flex centering. */
.a3-phone-screen {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  bottom: 8px;
  background: linear-gradient(180deg, #0c1018 0%, #0a0e15 60%, #08101a 100%);
  border-radius: 22px;
  overflow: hidden;
  color: white;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Smooth brightness transition — when filter changes via inline style,
     it transitions smoothly rather than stepping. */
  transition: filter 60ms linear;
}

/* iOS STATUS BAR — anchored to top, contains time + signal + battery */
.a3-status-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: clamp(20px, 4.5vw, 28px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(12px, 3vw, 18px);
  z-index: 5;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'Segoe UI', Roboto, sans-serif;
  font-size: clamp(9px, 2vw, 12px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0;
}

.a3-status-time {
  /* time digits — sized to fit with iOS status bar feel */
  font-variant-numeric: tabular-nums;
}

.a3-status-icons {
  display: flex;
  align-items: center;
  gap: clamp(4px, 1vw, 6px);
}

/* CELLULAR SIGNAL — four ascending dots (iOS style) */
.a3-icon-cell {
  display: inline-flex;
  align-items: flex-end;
  gap: 1.5px;
  height: clamp(7px, 1.6vw, 10px);
}

.a3-icon-cell .dot {
  width: clamp(2px, 0.5vw, 3px);
  height: clamp(2px, 0.5vw, 3px);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
}

.a3-icon-cell .dot:nth-child(2) {
  height: clamp(3px, 0.7vw, 4px);
}

.a3-icon-cell .dot:nth-child(3) {
  height: clamp(4px, 1vw, 6px);
}

.a3-icon-cell .dot:nth-child(4) {
  height: clamp(5px, 1.2vw, 7px);
}

/* BATTERY — rounded rect with fill bar (iOS style) */
.a3-icon-battery {
  position: relative;
  width: clamp(16px, 3.5vw, 22px);
  height: clamp(7px, 1.6vw, 10px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 2px;
  margin-left: 2px;
}

/* Battery nub on right side */
.a3-icon-battery::after {
  content: '';
  position: absolute;
  top: 25%;
  right: -3px;
  width: 1.5px;
  height: 50%;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 0 1px 1px 0;
}

.a3-battery-fill {
  position: absolute;
  top: 1px;
  left: 1px;
  bottom: 1px;
  width: 75%;  /* 75% battery — Marcus's working dispatcher phone */
  background: rgba(255, 255, 255, 0.85);
  border-radius: 1px;
}

/* DYNAMIC ISLAND — black pill at top center, the iconic iPhone Pro element */
.a3-dynamic-island {
  position: absolute;
  top: clamp(7px, 1.5vw, 10px);
  left: 50%;
  transform: translateX(-50%);
  width: clamp(60px, 14vw, 90px);
  height: clamp(18px, 4vw, 26px);
  background: #000;
  border-radius: 999px;
  z-index: 6;
  /* Subtle inner shadow suggests recess */
  box-shadow:
    inset 0 0 4px rgba(0, 0, 0, 0.8),
    0 1px 0 rgba(255, 255, 255, 0.04);
}

/* NOTIFICATION CONTAINER — centered below status bar, holds the actual
   missed-call content. */
.a3-notification {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 18px 12px;
  /* Push content slightly down from center to clear Dynamic Island */
  padding-top: clamp(36px, 8vw, 50px);
}

/* TIME: subtle, near top of layout */
.a3-phone-time {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'Segoe UI', Roboto, sans-serif;
  font-size: clamp(11px, 2.6vw, 16px);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.02em;
  margin-bottom: clamp(12px, 3vw, 20px);
}

/* NAME: Anton industrial typography — same as Act 2.
   Two-line stack ("MARCUS / RODRIGUEZ") for monumental presence. */
.a3-phone-name {
  font-family: 'Anton', Impact, 'Arial Narrow', sans-serif;
  font-weight: 400;
  font-size: clamp(18px, 5vw, 30px);
  line-height: 0.95;
  letter-spacing: 0.04em;
  color: white;
  text-align: center;
  text-transform: uppercase;
  margin-bottom: clamp(6px, 1.5vw, 10px);
  /* Subtle warm glow on the name — threads to Act 1/Act 2 amber */
  text-shadow:
    0 0 8px rgba(255, 220, 145, 0.20),
    0 0 16px rgba(255, 195, 110, 0.10);
}

.a3-phone-name span {
  display: block;
}

/* META: "Dispatch" subtitle, smaller, lighter */
.a3-phone-meta {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'Segoe UI', Roboto, sans-serif;
  font-size: clamp(8px, 1.8vw, 11px);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: clamp(20px, 5vw, 32px);
}

/* VOICEMAIL BUTTON: amber-bordered pill, threads warm color */
.a3-phone-vm-label {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display',
               'Segoe UI', Roboto, sans-serif;
  font-size: clamp(8px, 1.8vw, 11px);
  font-weight: 600;
  color: rgba(255, 200, 120, 0.95);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 16px);
  border: 1px solid rgba(255, 200, 120, 0.35);
  border-radius: 6px;
  background: rgba(255, 195, 110, 0.04);
  text-shadow: 0 0 6px rgba(255, 200, 120, 0.25);
}
`;
}

function Act3Styles({ antonB64 }) {
  useEffect(() => {
    const id = 'act3-styles';
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = getAct3Styles(antonB64);
  }, [antonB64]);
  return null;
}
