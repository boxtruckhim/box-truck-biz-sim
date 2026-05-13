/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 8: What Trucking Actually Feels Like
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frame 1:18 → 1:34 (15.5s of content + 1000ms fade = 16500ms component
 * duration, v3). Slowed across two passes for proper emotional digestion —
 * v2 added breath between lines, v3 extended the punchline hold so the
 * "Ultimately, it's all about how you respond" caption has comfortable
 * reading time. Documentary photoreal · grim · low-light · vulnerability.
 * Music DROPS OUT almost entirely — atmospheric beds carry it. Silence
 * between cues is part of the act.
 *
 * Reference register: Sicario nighttime drug-route, Better Call Saul bleak
 * desert, the documentary DRIVEN driver-isolation segments.
 *
 * EMOTIONAL CONTRACT: Honesty. "This game won't lie to me about how hard
 * it is." This is the single most vulnerable beat in the cinematic — the
 * dread before Act 9's prestige rise. The closing line "It's all about
 * how you respond." is the pivot from victim to agent — gives the player
 * ownership over the dread before the upturn.
 *
 * ─── FOUR FLASHES (slowed for emotional digestion, v3.1 — caption read room) ─
 *
 *   FLASH 1 — 2 AM Breakdown          0 → 3500ms     (3.5s)
 *   FLASH 2 — Stormy Highway       3500 → 7000ms     (3.5s)
 *   FLASH 3 — Driver Crisis Call   7000 → 9700ms     (2.7s)  [SILENT BEAT]
 *   FLASH 4 — DOT Scale at Night   9700 → 15500ms    (5.8s — held until fade)
 *   FADE                          15500 → 16500ms    (1000ms — longest)
 *
 * ─── MARCUS DIALOGUE (storyboard v3.1, paced with significant breath) ─────
 *
 *   Line 1   600 →  4500ms   "Some nights the truck breaks down. Some nights
 *                              you do."             (3.9s, 165 WPM)
 *   [900ms breath — lets "you do" land]
 *   Line 2  5400 →  6900ms   "Some nights it's both."       (1.5s)
 *   [100ms beat into silent F3 — contrast]
 *   [SILENT 7000-9700: phone vibrate + voicemail beep at 8500ms]
 *   [600ms beat post-cut to F4]
 *   Line 3 10300 → 14500ms   "Ultimately, it's all about how you respond."  (4.2s)
 *   [1000ms post-line breath — strobe ambient holds, photo lingers, fade begins]
 *
 * Pacing history:
 *   v1 (10s total) — punchline had only 200ms before fade. Felt rushed.
 *   v2 (15s total) — extended F4 to 3.3s; line 3 caption 1.6s, breath 1.1s.
 *   v3 (16.5s total) — extended F4 to 4.8s but caption only 2.7s — fixed
 *                      the rushed feel but reader still didn't have enough
 *                      time on the punchline. Also had a 1s photo-gone gap
 *                      between F4.end and fade-start.
 *   v3.1 (16.5s total) — caption sustained 4.2s for comfortable reading on
 *                        the most important line of the cinematic. F4
 *                        held until fade begins so the photo doesn't
 *                        disappear before the fade-to-near-black. The
 *                        punchline now LANDS properly with 1.0s of
 *                        post-caption silence on the held DOT scene.
 *
 * ─── ASSETS ────────────────────────────────────────────────────────────────
 *
 *   window.A8_IMAGES.MIDNIGHT_RUN   — empty wet asphalt under streetlights
 *                                     (vanishing-point composition, fog)
 *   window.A8_IMAGES.STORMY_NIGHT   — broken truck on shoulder, steam rising,
 *                                     lightning, oncoming headlights
 *   window.A8_IMAGES.DOT_INSPECTOR  — DOT officer silhouette at weigh
 *                                     station, red/blue strobe reflections
 *
 *   Flash 3's iPhone "JAMES — DRIVER" call screen is pure SVG, no photo asset.
 *
 * ─── INTEGRATION CONTRACT ──────────────────────────────────────────────────
 *
 *   Props: onComplete (called at ACT_DURATION_MS), onSkip (immediate jump)
 *   Standalone defaults provided so the component runs in calibration HTML
 *   without parent wiring.
 *
 *   Same React.memo + rAF-loop-with-cleanup pattern as Act 5 / Act 6 / Act 7.
 *   No external image deps — photos loaded via window.A8_IMAGES at runtime.
 *   No Framer/GSAP — CSS keyframes + React state for the full animation.
 *
 * ─── TRANSITION OUT ────────────────────────────────────────────────────────
 *
 *   Slow fade through near-black at 14500ms, 1000ms duration. Longest
 *   transition in the cinematic — gives the viewer real breath after
 *   Marcus's punchline (which now sustains 2.7s on screen for comfortable
 *   reading time) before Act 9's prestige rise. Cubic-eased so the
 *   deepening feels deliberate rather than abrupt.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

import {
  CinematicStage,
  CinemaBars,
  CinematicCaption,
  AtmosphericLayers,
} from '../WelcomeModalShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// ═══ TIMING: SLOWED FOR EMOTIONAL DIGESTION ═══
//
// Storyboard v3.1 specifies "deliberately longer holds than Act 6/7" and
// "the silence between cues is part of the act." The original 10s budget
// felt rushed — Marcus's punchline didn't have room to land before the
// fade started, and the silent phone beat at 2s wasn't long enough to
// register as a deliberate cinematic moment vs. just a quick interlude.
//
// Revised to 14s of visible content + 1s slow fade = 15s total. This
// preserves the storyboard's structural intent while letting each beat
// breathe properly:
//
//   F1 — 0      → 3500ms   (3.5s, was 3.0s)  — establishing breakdown
//   F2 — 3500   → 7000ms   (3.5s, was 3.0s)  — storm + lightning + line 2
//   F3 — 7000   → 9700ms   (2.7s, was 2.0s)  — silent phone beat (longer)
//   F4 — 9700   → 13000ms  (3.3s, was 2.0s)  — punchline + breath to land
//   FADE — 13000 → 14000ms (1000ms, was 800ms) — longest transition, hold
//
// Marcus dialogue gets significant breath between lines (storyboard intent):
//
//   Line 1 — 600 → 4500   "Some nights the truck breaks down.
//                            Some nights you do."          (3.9s)
//        ⇒ 900ms breath after, lets "you do" land
//   Line 2 — 5400 → 6900  "Some nights it's both."         (1.5s)
//        ⇒ 100ms beat into silent F3, contrast through cut
//   [SILENT BEAT — 7000 → 9700] phone vibrates throughout, beep at 8500ms
//        ⇒ 600ms beat into F4 (you're holding for the punchline)
//   Line 3 — 10300 → 11900 "It's all about how you respond." (1.6s)
//        ⇒ 1100ms post-line breath BEFORE fade, lets the line LAND
//

const ACT_DURATION_MS = 16000;   // 15.0s content + 1000ms slow fade-out (v3.2 — trimmed 0.5s post-caption silence per feedback)
const CONTENT_END_MS  = 15000;   // visible-content end; fade begins here
const FADE_OUT_MS     = 1000;    // slow fade through near-black (longest in cinematic)

const FLASH_TIMINGS = [
  { start: 0,     end: 3500,  type: 'breakdown'    },  // midnightrun
  { start: 3500,  end: 7000,  type: 'storm'        },  // stormy_highway
  { start: 7000,  end: 9700,  type: 'phonecall'    },  // SVG iPhone (silent beat — 2.7s)
  { start: 9700,  end: 15000, type: 'dot_scale'    },  // dot_inspector + punchline (5.3s — held until fade begins; trimmed 0.5s)
];

// Marcus dialogue segments — slower cadence (~165 WPM) with significant
// pauses between lines. Lines 1 and 3 have post-delivery breath before
// the next beat starts, so each line has space to LAND. Line 3 (the
// punchline) is sustained 4.2s on screen so the reader has comfortable
// reading time for the most important line of the entire cinematic —
// followed by 1.0s of strobe-ambient silence with the photo still held
// before the slow fade begins.
const VOICEMAIL_SEGMENTS = [
  { startMs:   600, endMs:  4500, text: "Some nights the truck breaks down. Some nights you do." },
  { startMs:  5400, endMs:  6900, text: "Some nights it's both." },
  { startMs: 10300, endMs: 14500, text: "Ultimately, it's all about how you respond." },
];

// Flash 3 silent-beat punctuation — the cinematic's quietest moment
const PHONE_VIBRATE_START_MS = 6900;   // vibrate begins as line 2 ends
const PHONE_VIBRATE_END_MS   = 9600;   // vibrate ends 100ms before F4
const VOICEMAIL_BEEP_MS      = 8500;   // single beep ~midway through silent F3

// Flash 2 punctuation — single lightning flicker
// Now syncs with line 2 start ("Some nights it's both") for emotional emphasis
const LIGHTNING_FLICKER_MS  = 5400;
const LIGHTNING_FLICKER_DUR = 220;     // slightly longer flicker arc (was 180)

// Flash 1 punctuation — hazard pulse cycle (loops throughout flash)
const HAZARD_PULSE_PERIOD_MS = 1100;   // amber pulse every 1.1s (slow)

// Flash 4 punctuation — strobe pulse (police/DOT light bar)
const STROBE_PERIOD_MS = 500;          // 500ms full red/blue cycle

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act8TheJob = React.memo(function Act8TheJob({
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('8', elapsedMs);

  // Master timer — single rAF loop with cleanup. Same pattern as Act 5/6/7.
  useEffect(() => {
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      if (elapsed >= ACT_DURATION_MS) {
        setElapsedMs(ACT_DURATION_MS);
        onComplete();
        return;
      }
      setElapsedMs(elapsed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  // ─── DERIVED STATE ────────────────────────────────────────────────────────

  // Resolve image data URIs from the global registry (loaded by host page).
  const images = useMemo(() => (
    typeof window !== 'undefined' && window.A8_IMAGES ? window.A8_IMAGES : {}
  ), []);

  // ─── RAIN PARTICLE SYSTEM (Variation B: streaks + ground splashes) ────────
  //
  // Generated ONCE on mount via useMemo (no deps) so the random offsets are
  // stable across re-renders. The original CSS implementation used
  // repeating-linear-gradient — but that produced visibly banded/striped
  // rain that read as cartoony. This particle approach generates discrete
  // streaks at randomized x-positions, durations, and animation-delays so
  // the rain looks organic — no two drops in the same place at the same time.
  //
  // Three depth layers (near/mid/far) with progressively smaller drops,
  // longer fall durations, and lower opacity — a real parallax depth.
  // Plus 80 ground splashes scattered in the lower 28% of the frame, each
  // expanding+fading to simulate water hitting the wet pavement.
  const rainStreaks = useMemo(() => {
    const layers = [
      { depth: 'near', count: 30, durMin: 0.55, durMax: 0.75 },
      { depth: 'mid',  count: 50, durMin: 0.85, durMax: 1.15 },
      { depth: 'far',  count: 70, durMin: 1.30, durMax: 1.80 },
    ];
    const streaks = [];
    let id = 0;
    for (const { depth, count, durMin, durMax } of layers) {
      for (let i = 0; i < count; i++) {
        const left = Math.random() * 110 - 5;          // -5%..105% (overshoot for diagonal)
        const dur  = durMin + Math.random() * (durMax - durMin);
        const delay = -Math.random() * dur;            // negative so animation starts mid-cycle
        streaks.push({
          id: id++,
          depth,
          left,
          dur,
          delay,
        });
      }
    }
    return streaks;
  }, []);

  const rainSplashes = useMemo(() => {
    // 80 splashes scattered across the lower 28% of the frame (the "ground"
    // visible in the photo — the wet pavement). Each has a randomized
    // delay so they don't all fire at once, and a randomized duration
    // (0.35-0.75s) so each splash has its own rhythm.
    const splashes = [];
    for (let i = 0; i < 80; i++) {
      splashes.push({
        id: i,
        left: Math.random() * 100,
        top: 70 + Math.random() * 28,                  // 70-98% (lower 28%)
        dur: 0.35 + Math.random() * 0.40,
        delay: -Math.random() * 4,                     // 0-4s spread
      });
    }
    return splashes;
  }, []);

  // Active flash (which photo / overlay is in front-of-stage right now).
  const currentFlashIdx = FLASH_TIMINGS.findIndex(
    f => elapsedMs >= f.start && elapsedMs < f.end
  );
  const currentFlash = currentFlashIdx >= 0 ? FLASH_TIMINGS[currentFlashIdx] : FLASH_TIMINGS[0];

  // Time within the current flash, normalized to [0, 1] for Ken Burns push.
  const flashElapsed = Math.max(0, elapsedMs - currentFlash.start);
  const flashDuration = currentFlash.end - currentFlash.start;
  const flashT = Math.min(1, flashElapsed / flashDuration);

  // Active dialogue segment (or null if in a silent gap).
  const currentSegment = VOICEMAIL_SEGMENTS.find(
    s => elapsedMs >= s.startMs && elapsedMs < s.endMs
  ) || null;

  // ─── PER-FLASH ANIMATION SCALARS ──────────────────────────────────────────

  // FLASH 1 — slow Ken Burns push toward the suggested truck position.
  // Photo scale eases from 1.04 → 1.10 over 3s. Origin slightly right-of-center
  // so the push converges toward where the hazard pulse sits in the photo.
  const f1Scale = 1.04 + flashT * 0.06;
  const f1OriginX = 56;  // % — slightly right-of-center (hazard pulse position)
  const f1OriginY = 42;  // % — vanishing-point row

  // FLASH 1 — hazard amber pulse intensity (sin wave, slow-period).
  const hazardPhase = (elapsedMs / HAZARD_PULSE_PERIOD_MS) * Math.PI * 2;
  // Pulse goes 0.35 → 1.0 → 0.35 — never fully off (real hazards are bright)
  const hazardIntensity = currentFlash.type === 'breakdown'
    ? 0.35 + 0.65 * (Math.sin(hazardPhase) * 0.5 + 0.5)
    : 0;

  // FLASH 2 — Ken Burns subtle drift (no zoom — the rain motion provides
  // the kinetic energy on its own; zoom would compete with rain particles).
  // Tiny scale 1.02 → 1.04 over 3s.
  const f2Scale = 1.02 + flashT * 0.02;

  // FLASH 2 — lightning flicker (single hit at LIGHTNING_FLICKER_MS).
  const flashLocalT = elapsedMs - LIGHTNING_FLICKER_MS;
  let lightningOpacity = 0;
  if (flashLocalT >= 0 && flashLocalT < LIGHTNING_FLICKER_DUR) {
    // Sharp attack 0-30ms, plateau 30-60ms, decay 60-180ms.
    if (flashLocalT < 30) lightningOpacity = flashLocalT / 30 * 0.85;
    else if (flashLocalT < 60) lightningOpacity = 0.85;
    else lightningOpacity = 0.85 * (1 - (flashLocalT - 60) / 120);
  }

  // FLASH 3 — phone vibrate (only active during phone-call flash window).
  // The CSS animation handles the actual jitter motion; this just gates it.
  const phoneVibrating = elapsedMs >= PHONE_VIBRATE_START_MS &&
                          elapsedMs < PHONE_VIBRATE_END_MS;

  // FLASH 3 — voicemail beep (single 250ms ping with visual flash).
  const beepLocalT = elapsedMs - VOICEMAIL_BEEP_MS;
  let beepFlash = 0;
  if (beepLocalT >= 0 && beepLocalT < 250) {
    beepFlash = Math.max(0, 1 - beepLocalT / 250);
  }

  // FLASH 4 — slow zoom toward the silhouetted DOT officer.
  // Officer is at roughly (0.27, 0.50) of the photo (left-center).
  // Photo scales 1.05 → 1.18 over 2s — strong push for "cinematic dread".
  const f4Scale = 1.05 + flashT * 0.13;
  const f4OriginX = 27;
  const f4OriginY = 50;

  // FLASH 4 — strobe pulse (red/blue alternating).
  // Real police strobes are very fast — ~150ms each color. Pulse modulates
  // the intensity of two color overlays.
  const strobePhase = (elapsedMs / STROBE_PERIOD_MS) * Math.PI * 2;
  const redStrobe  = currentFlash.type === 'dot_scale'
    ? Math.max(0, Math.sin(strobePhase)) * 0.55
    : 0;
  const blueStrobe = currentFlash.type === 'dot_scale'
    ? Math.max(0, -Math.sin(strobePhase)) * 0.55
    : 0;

  // ─── FADE OUT ─────────────────────────────────────────────────────────────

  // Slow fade-to-near-black over the last 1000ms (longest transition in
  // the cinematic — punctuates Marcus's punchline before Act 9 begins).
  // Eases out so the deepening darkness feels deliberate rather than abrupt.
  const fadeT = elapsedMs >= CONTENT_END_MS
    ? Math.min(1, (elapsedMs - CONTENT_END_MS) / FADE_OUT_MS)
    : 0;
  // Cubic ease for cinematic deceleration
  const fadeOpacity = fadeT < 0.5
    ? 4 * fadeT * fadeT * fadeT
    : 1 - Math.pow(-2 * fadeT + 2, 3) / 2;

  // ─── HARD-CUT CROSSFADE BETWEEN FLASHES ───────────────────────────────────

  // Photo opacity scalar for each flash. We do "hard cuts" between flashes
  // (60ms crossfade only — hard documentary edit feel) rather than long
  // dissolves. Each photo opacity is binary-ish.
  const flashOpacity = (idx) => {
    const f = FLASH_TIMINGS[idx];
    const CUT_DUR = 60;  // 60ms crossfade between flashes
    if (elapsedMs < f.start - CUT_DUR) return 0;
    if (elapsedMs < f.start) return (elapsedMs - (f.start - CUT_DUR)) / CUT_DUR;
    if (elapsedMs < f.end - CUT_DUR) return 1;
    if (elapsedMs < f.end) return 1 - (elapsedMs - (f.end - CUT_DUR)) / CUT_DUR;
    return 0;
  };

  // ─── BLOOM TRANSITION FLASHES ─────────────────────────────────────────────
  //
  // Between every flash boundary, fire a brief bright bloom (white wash) to
  // simulate the "light overload at cut" feel of cinematic editing — Act 6's
  // signature transition idiom. Without this, the documentary hard cuts feel
  // like a slideshow; with it, each transition has connective tissue.
  //
  // Bloom shape: sharp 30ms attack from black, peak 0.45 opacity at flash
  // boundary, exponential decay over 220ms after.
  const BLOOM_BOUNDARIES = [3500, 7000, 9700];  // F1→F2, F2→F3, F3→F4
  let bloomOpacity = 0;
  for (const b of BLOOM_BOUNDARIES) {
    const dt = elapsedMs - b;
    if (dt > -30 && dt < 220) {
      let v;
      if (dt < 0)        v = ((dt + 30) / 30) * 0.45;     // 30ms attack
      else if (dt < 60)  v = 0.45;                          // 60ms plateau
      else               v = 0.45 * Math.exp(-(dt - 60) / 70);  // exp decay
      bloomOpacity = Math.max(bloomOpacity, v);
    }
  }

  // ─── ANAMORPHIC LENS FLARE — fires on dramatic punctuation ────────────────
  //
  // Fires during: lightning hit (Flash 2), strobe peaks (Flash 4). The
  // horizontal cyan streak is the J.J. Abrams / Blade Runner signature —
  // adds "premium cinematography" punch to the act's emotional peaks.
  let anamorphicOpacity = 0;
  let anamorphicTint = 'cyan';  // cyan default for cold register
  // Lightning flicker triggers anamorphic
  if (flashLocalT >= 0 && flashLocalT < LIGHTNING_FLICKER_DUR) {
    if (flashLocalT < 30)      anamorphicOpacity = (flashLocalT / 30) * 0.92;
    else if (flashLocalT < 80) anamorphicOpacity = 0.92;
    else                       anamorphicOpacity = 0.92 * (1 - (flashLocalT - 80) / 100);
    anamorphicTint = 'white';   // cold-white for lightning
  }
  // Strobe peaks during Flash 4 (peaks every 250ms — twice the strobe period)
  if (currentFlash.type === 'dot_scale') {
    // Trigger a flare on each strobe peak (red AND blue peaks)
    const strobeIntensity = Math.abs(Math.sin(strobePhase));
    if (strobeIntensity > 0.85) {
      anamorphicOpacity = Math.max(anamorphicOpacity, (strobeIntensity - 0.85) / 0.15 * 0.50);
      // Tint matches whichever color is currently hotter
      anamorphicTint = Math.sin(strobePhase) > 0 ? 'red' : 'blue';
    }
  }

  // ─── HALATION COLOR (per-flash warm/cold register) ────────────────────────
  // Halation is the orange-red halo around bright contrast boundaries on
  // film. We tint it per flash to match the dominant light source:
  //   F1: warm orange   (matching the streetlamp + hazard glow)
  //   F2: cool white    (matching the lightning + headlights)
  //   F3: dim warm      (very subtle — phone screen is the only light)
  //   F4: red-blue mix  (matching the police strobes)
  let halationGradient = 'radial-gradient(ellipse at 50% 50%, rgba(255, 175, 80, 0.42) 0%, rgba(220, 130, 50, 0.18) 35%, transparent 75%)';
  if (currentFlash.type === 'storm') {
    halationGradient = 'radial-gradient(ellipse at 70% 25%, rgba(180, 200, 240, 0.32) 0%, rgba(120, 160, 220, 0.16) 40%, transparent 80%)';
  } else if (currentFlash.type === 'phonecall') {
    halationGradient = 'radial-gradient(ellipse at 50% 45%, rgba(255, 220, 180, 0.18) 0%, rgba(180, 130, 80, 0.08) 40%, transparent 80%)';
  } else if (currentFlash.type === 'dot_scale') {
    halationGradient = 'radial-gradient(ellipse at 8% 60%, rgba(255, 80, 100, 0.32) 0%, transparent 50%), radial-gradient(ellipse at 45% 38%, rgba(80, 130, 255, 0.32) 0%, transparent 50%)';
  }

  // ─── HANDHELD JITTER GATE — Flash 2 storm only ────────────────────────────
  // Storm has natural kinetic energy (rain, wind, lightning) — handheld
  // jitter adds the "filmed from inside the storm" feel. Other flashes are
  // observational/static, so jitter would feel wrong (slideshow-y).
  const handheldActive = currentFlash.type === 'storm';

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <CinematicStage className="a8-stage">
      <style>{ACT8_STYLES}</style>

      {/* ═══ HANDHELD JITTER WRAPPER ═══
          Camera-shake effect that activates ONLY during Flash 2 (storm).
          The storm has natural kinetic energy (rain, wind, lightning) so
          the handheld jitter reads as "filmed from inside the storm" —
          adds visceral energy. Other flashes are observational/static so
          jitter would read as wobbly/wrong.
          Class toggles via React state — when handheldActive is false,
          the wrapper is just a static container with no animation. */}
      <div className={`a8-handheld${handheldActive ? ' a8-handheld-active' : ''}`}>

      {/* ═══ ATMOSPHERIC GATE WEAVE ═══
          Subtle camera-registration jitter (sub-pixel, vertical, irrational
          period). Carries through all 4 flashes. Same idiom as Acts 6/7. */}
      <div className="a8-gate-weave">

        {/* ═══ FLASH 1 — 2 AM BREAKDOWN ═══ */}
        {flashOpacity(0) > 0 && (
          <div
            className="a8-flash-frame"
            style={{ opacity: flashOpacity(0) }}
          >
            <div
              className="a8-photo a8-photo-breakdown"
              style={{
                backgroundImage: images.MIDNIGHT_RUN ? `url("${images.MIDNIGHT_RUN}")` : 'none',
                transform: `scale(${f1Scale})`,
                transformOrigin: `${f1OriginX}% ${f1OriginY}%`,
              }}
            />
            {/* Hazard amber pulse pair — suggests the rear hazards of a
                truck pulled over on the right shoulder mid-distance. The
                two-light spacing reads as "vehicle width" rather than
                "ambient scene light." Positioned in the dark band of the
                photo where the pulse can register; color is red-orange
                (more saturated than the yellow-amber streetlamps) to
                read as warning lights rather than infrastructure. */}
            <div
              className="a8-hazard-pulse a8-hazard-pulse-l"
              style={{ opacity: hazardIntensity * flashOpacity(0) }}
            />
            <div
              className="a8-hazard-pulse a8-hazard-pulse-r"
              style={{ opacity: hazardIntensity * flashOpacity(0) }}
            />
            {/* Subtle steam-rising overlay above the hazard pair — barely
                visible suggestion of an overheated engine venting steam.
                The slow drift gives the act its "ambient breath" feel. */}
            <div
              className="a8-steam-rise"
              style={{
                opacity: 0.28 * flashOpacity(0),
              }}
            />
          </div>
        )}

        {/* ═══ FLASH 2 — STORMY HIGHWAY ═══ */}
        {flashOpacity(1) > 0 && (
          <div
            className="a8-flash-frame"
            style={{ opacity: flashOpacity(1) }}
          >
            <div
              className="a8-photo a8-photo-storm"
              style={{
                backgroundImage: images.STORMY_NIGHT ? `url("${images.STORMY_NIGHT}")` : 'none',
                transform: `scale(${f2Scale})`,
                transformOrigin: '50% 50%',
              }}
            />
            {/* Rain particle system (Variation B — streaks + ground splashes).
                Replaces the original banded repeating-linear-gradient rain
                which read as cartoony. Each streak is a discrete element
                with randomized position/timing — no two drops align in
                space or phase, giving organic rain texture. Ground
                splashes in the lower 28% of frame simulate water hitting
                wet pavement (small expanding ellipses, fade in+out). */}
            <div className="a8-rain-layer">
              {rainStreaks.map(s => (
                <div
                  key={`s${s.id}`}
                  className={`a8-rain-streak a8-rain-${s.depth}`}
                  style={{
                    left: `${s.left}%`,
                    animationDuration: `${s.dur.toFixed(3)}s`,
                    animationDelay: `${s.delay.toFixed(3)}s`,
                  }}
                />
              ))}
              {rainSplashes.map(p => (
                <div
                  key={`p${p.id}`}
                  className="a8-rain-splash"
                  style={{
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    animationDuration: `${p.dur.toFixed(3)}s`,
                    animationDelay: `${p.delay.toFixed(3)}s`,
                  }}
                />
              ))}
            </div>
            {/* Lightning flicker — single hit ~mid-flash. White wash with
                slight blue tint, sharp attack + fast decay. */}
            <div
              className="a8-lightning"
              style={{ opacity: lightningOpacity }}
            />
          </div>
        )}

        {/* ═══ FLASH 3 — DRIVER CRISIS CALL (silent beat) ═══ */}
        {flashOpacity(2) > 0 && (
          <div
            className="a8-flash-frame"
            style={{ opacity: flashOpacity(2) }}
          >
            {/* Dark phone-screen background — near-black with subtle haze */}
            <div className="a8-phone-bg" />

            {/* SVG iPhone mockup — incoming-call screen.
                Vibrate animation gated by phoneVibrating boolean. */}
            <div
              className={`a8-phone-frame${phoneVibrating ? ' a8-phone-vibrating' : ''}`}
            >
              <PhoneCallScreen beepFlash={beepFlash} />
            </div>
          </div>
        )}

        {/* ═══ FLASH 4 — DOT SCALE AT NIGHT ═══ */}
        {flashOpacity(3) > 0 && (
          <div
            className="a8-flash-frame"
            style={{ opacity: flashOpacity(3) }}
          >
            <div
              className="a8-photo a8-photo-dot"
              style={{
                backgroundImage: images.DOT_INSPECTOR ? `url("${images.DOT_INSPECTOR}")` : 'none',
                transform: `scale(${f4Scale})`,
                transformOrigin: `${f4OriginX}% ${f4OriginY}%`,
              }}
            >
              {/* Strobe overlays NESTED INSIDE the photo div so they inherit
                  its transform — gradient origins stay locked to the actual
                  police light positions in the photo regardless of Ken Burns
                  scale. Same idiom as Act 1's locked window glow. */}
              <div
                className="a8-strobe-red"
                style={{ opacity: redStrobe * flashOpacity(3) }}
              />
              <div
                className="a8-strobe-blue"
                style={{ opacity: blueStrobe * flashOpacity(3) }}
              />
            </div>
          </div>
        )}

      </div>

      </div>{/* end a8-handheld */}

      {/* ═══════════════════════════════════════════════════════════════════
          FULL CINEMATIC STACK — ported from Act 7's complete rig and tuned
          for Act 8's cold/grim register. These layers PERSIST across all
          four flashes (they do not unmount/remount per flash) so the
          atmosphere never resets — that's what kills the "slideshow" feel.

          Layer order (z-index):
            3   Chromatic aberration (corner RGB offset)
            4   Halation (color-matched per flash)
            5   Three-tier turbulent haze (Sicario fog signature)
            6   Dust mote particle field
           14   Cold color grade (deepens the register)
           15   Vignette grade
           16   Scanlines (multiply blend)
           17   Animated grain (overlay blend, 4-step)
           85   Anamorphic lens flare (fires on lightning + strobes)
           90   Bloom transitions (fires at flash boundaries)
          ════════════════════════════════════════════════════════════════ */}

      {/* CHROMATIC ABERRATION — RGB channel offset at frame corners.
          Subtle scope: 0.14 alpha vs Act 7's 0.18, since Act 8's
          dark register makes warm-cold corner shifts read more loudly. */}
      <div className="a8-chromatic" />

      {/* HALATION — radial film glow tinted to flash register. The gradient
          changes per flash via inline style: warm-orange in F1, cool-white
          in F2, dim-warm in F3, red-blue mix in F4. Heavy 40px blur for
          authentic "light bleeding into film" feel (Dehancer reference). */}
      <div
        className="a8-halation"
        style={{ background: halationGradient }}
      />

      {/* THREE-TIER ATMOSPHERIC HAZE — Hurlbut diffusion technique
          (referenced by Deakins on Sicario / Blade Runner 2049). Each
          layer uses a different SVG turbulence pattern + animation period
          + blur amount, so they parallax across each other creating
          authentic atmospheric depth. */}
      <div className="a8-haze a8-haze-far" />
      <div className="a8-haze a8-haze-mid" />
      <div className="a8-haze a8-haze-near" />

      {/* DUST MOTE FIELD — drifting particles. 8 motes at staggered
          positions/animation-delays for organic randomness. They drift
          slowly upward across the act, never resetting. */}
      <div className="a8-dust">
        <div className="a8-mote" style={{ left: '12%', top: '78%',
          width: 3, height: 3, animationDuration: '13s', animationDelay: '0s' }} />
        <div className="a8-mote" style={{ left: '28%', top: '85%',
          width: 2, height: 2, animationDuration: '17s', animationDelay: '-3s' }} />
        <div className="a8-mote" style={{ left: '46%', top: '72%',
          width: 4, height: 4, animationDuration: '21s', animationDelay: '-7s' }} />
        <div className="a8-mote" style={{ left: '63%', top: '88%',
          width: 2, height: 2, animationDuration: '15s', animationDelay: '-2s' }} />
        <div className="a8-mote" style={{ left: '78%', top: '74%',
          width: 3, height: 3, animationDuration: '19s', animationDelay: '-9s' }} />
        <div className="a8-mote" style={{ left: '88%', top: '82%',
          width: 2, height: 2, animationDuration: '14s', animationDelay: '-5s' }} />
        <div className="a8-mote" style={{ left: '34%', top: '65%',
          width: 2, height: 2, animationDuration: '23s', animationDelay: '-11s' }} />
        <div className="a8-mote" style={{ left: '70%', top: '60%',
          width: 3, height: 3, animationDuration: '16s', animationDelay: '-4s' }} />
      </div>

      {/* COLD COLOR GRADE — subtle blue-grey wash deepening the cold
          register. NOT a warm tint (this isn't a Marcus-intimate beat,
          it's the world being honest). Multiply blend, opacity-modulated
          slightly per flash so each scene has its own register. */}
      <div className="a8-cold-grade" />

      {/* VIGNETTE — radial darkening at frame corners. Heavier than
          Acts 6/7 (0.62 vs 0.55) for the despair register. */}
      <div className="a8-vignette" />

      {/* SCANLINES — subtle horizontal repeating lines, multiply blend.
          Sells the documentary/film register subliminally. */}
      <div className="a8-scanlines" />

      {/* ANIMATED GRAIN — SVG turbulence noise, 4-step shift cycle
          at 0.5s. Heavier than Acts 6/7 (0.55→0.65 opacity) for the
          documentary/16mm register reference. */}
      <div className="a8-grain" />

      {/* ANAMORPHIC LENS FLARE — horizontal streak that fires on lightning
          (Flash 2) and strobe peaks (Flash 4). The tint shifts: cold-white
          for lightning, red OR blue for the strobe phase being peaked.
          Same J.J. Abrams / Blade Runner signature flare from Act 7's
          F1-decline visual idiom. */}
      <div
        className={`a8-anamorphic a8-anamorphic-${anamorphicTint}`}
        style={{ opacity: anamorphicOpacity }}
      />

      {/* BLOOM TRANSITIONS — fires at each flash boundary (3000, 6000,
          8000ms) to bridge cuts with light overload. Same idiom as Act 6's
          flash transitions. Without this, the hard cuts feel slideshow-y;
          with it, transitions have visual continuity. */}
      <div
        className="a8-bloom"
        style={{ opacity: bloomOpacity }}
      />

      {/* ═══ CINEMA BARS ═══ */}
      <CinemaBars barHeight={32} delayMs={0} />

      {/* ═══ DIALOGUE CAPTION ═══
          Default position (bottom: 232px) works for Act 8 — there are no
          lower-third overlay cards (unlike Act 5). The caption sits above
          the bottom cinema bar in clean dark space. */}
      <CinematicCaption text={currentSegment ? currentSegment.text : null} />

      {/* ═══ FADE-TO-NEAR-BLACK ═══
          Slow 800ms fade at end. Goes to ~96% opacity (not full black) so
          Act 9 can pick up from a deep but not pure-black register. */}
      <div
        className="a8-fade-out"
        style={{ opacity: fadeOpacity * 0.96 }}
      />

      {/* ═══ SKIP BUTTON ═══ */}
      <button className="a8-skip-btn" onClick={onSkip} aria-label="Skip act">
        Skip
      </button>
    </CinematicStage>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PHONE CALL SCREEN — SVG iPhone mockup with "JAMES — DRIVER" inbound call
// ─────────────────────────────────────────────────────────────────────────────

const PhoneCallScreen = React.memo(function PhoneCallScreen({ beepFlash }) {
  // The phone occupies the central area of the stage. Mockup uses iOS-
  // typical layout: status bar at top, "incoming call" label, large name,
  // subtitle, decline/answer buttons at bottom.

  return (
    <svg
      className="a8-phone-svg"
      viewBox="0 0 280 580"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Phone screen gradient — top-down dark warm wash like a real
            night-mode call screen with a contact silhouette behind. */}
        <linearGradient id="a8-phone-screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1a1612" />
          <stop offset="38%"  stopColor="#2a221c" />
          <stop offset="62%"  stopColor="#1f1814" />
          <stop offset="100%" stopColor="#0e0a08" />
        </linearGradient>

        {/* Avatar gradient — silhouette circle */}
        <radialGradient id="a8-avatar-grad" cx="50%" cy="35%" r="70%">
          <stop offset="0%"   stopColor="#3a322a" />
          <stop offset="100%" stopColor="#1a1410" />
        </radialGradient>

        {/* Beep flash — temporary green ring that flashes on voicemail beep */}
        <radialGradient id="a8-beep-flash" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(120, 220, 140, 0.4)" />
          <stop offset="60%"  stopColor="rgba(120, 220, 140, 0.0)" />
          <stop offset="100%" stopColor="rgba(120, 220, 140, 0)" />
        </radialGradient>
      </defs>

      {/* iPhone outer chassis — rounded rect with subtle edge highlight */}
      <rect
        x="2" y="2" width="276" height="576" rx="38" ry="38"
        fill="#0a0a0c"
        stroke="#1d1d22" strokeWidth="1"
      />

      {/* Screen safe area */}
      <rect
        x="10" y="10" width="260" height="560" rx="32" ry="32"
        fill="url(#a8-phone-screen)"
      />

      {/* Status bar — time + signal/battery icons (simplified) */}
      <text x="32" y="36" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="14" fontWeight="600" fill="rgba(255, 245, 230, 0.85)">
        2:47
      </text>
      {/* Signal bars */}
      <g fill="rgba(255, 245, 230, 0.85)">
        <rect x="216" y="28" width="3" height="6" rx="0.5" />
        <rect x="221" y="26" width="3" height="8" rx="0.5" />
        <rect x="226" y="24" width="3" height="10" rx="0.5" />
        <rect x="231" y="22" width="3" height="12" rx="0.5" />
      </g>
      {/* Battery */}
      <g>
        <rect x="240" y="24" width="22" height="11" rx="2.5" ry="2.5"
              fill="none" stroke="rgba(255, 245, 230, 0.6)" strokeWidth="1" />
        <rect x="262" y="27" width="2" height="5" rx="0.5"
              fill="rgba(255, 245, 230, 0.6)" />
        <rect x="242" y="26" width="14" height="7" rx="1" ry="1"
              fill="rgba(255, 245, 230, 0.85)" />
      </g>

      {/* "Incoming call..." subhead */}
      <text x="140" y="78" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="12" fontWeight="500" fill="rgba(255, 245, 230, 0.55)"
            textAnchor="middle" letterSpacing="0.1em">
        INCOMING CALL
      </text>

      {/* Avatar circle (silhouette) */}
      <circle cx="140" cy="190" r="62"
              fill="url(#a8-avatar-grad)"
              stroke="rgba(255, 245, 230, 0.10)" strokeWidth="1.5" />
      {/* Generic person silhouette inside avatar */}
      <g transform="translate(140 190)" fill="rgba(255, 245, 230, 0.20)">
        {/* Head */}
        <circle cx="0" cy="-12" r="14" />
        {/* Shoulders */}
        <path d="M -28 30 Q -28 8 0 8 Q 28 8 28 30 Z" />
      </g>

      {/* Caller name — large display */}
      <text x="140" y="294" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="34" fontWeight="600" fill="rgba(255, 245, 230, 0.96)"
            textAnchor="middle" letterSpacing="0.005em">
        James
      </text>

      {/* Caller subtitle — DRIVER */}
      <text x="140" y="318" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="13" fontWeight="500" fill="rgba(255, 245, 230, 0.55)"
            textAnchor="middle" letterSpacing="0.18em">
        DRIVER
      </text>

      {/* Mobile / call type */}
      <text x="140" y="340" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="12" fontWeight="400" fill="rgba(255, 245, 230, 0.40)"
            textAnchor="middle" letterSpacing="0.05em">
        mobile
      </text>

      {/* Decline button — red circle with end-call icon */}
      <g transform="translate(82 472)">
        <circle cx="0" cy="0" r="32" fill="#e0392c" />
        {/* End-call phone icon (rotated 135deg) */}
        <g transform="rotate(135)" fill="white">
          <path d="M -10 -3 Q -10 -8 -7 -8 L -3 -8 Q 0 -8 0 -5 L 0 -2 Q 0 0 -2 0 L -3 0 Q -1 5 4 7 L 4 6 Q 5 4 7 4 L 9 4 Q 12 4 12 7 L 12 11 Q 12 14 7 14 Q -10 14 -10 -3 Z" />
        </g>
      </g>

      {/* Accept button — green circle with phone icon */}
      <g transform="translate(198 472)">
        <circle cx="0" cy="0" r="32" fill="#34c759" />
        <g fill="white">
          <path d="M -10 -3 Q -10 -8 -7 -8 L -3 -8 Q 0 -8 0 -5 L 0 -2 Q 0 0 -2 0 L -3 0 Q -1 5 4 7 L 4 6 Q 5 4 7 4 L 9 4 Q 12 4 12 7 L 12 11 Q 12 14 7 14 Q -10 14 -10 -3 Z" />
        </g>
      </g>

      {/* Decline / Accept labels */}
      <text x="82"  y="524" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="11" fontWeight="500" fill="rgba(255, 245, 230, 0.55)"
            textAnchor="middle" letterSpacing="0.05em">
        Decline
      </text>
      <text x="198" y="524" fontFamily="-apple-system, 'SF Pro Display', sans-serif"
            fontSize="11" fontWeight="500" fill="rgba(255, 245, 230, 0.55)"
            textAnchor="middle" letterSpacing="0.05em">
        Accept
      </text>

      {/* Voicemail beep flash — green ring expanding from avatar
          (only visible during the 250ms beep window). */}
      {beepFlash > 0 && (
        <circle
          cx="140" cy="190"
          r={62 + (1 - beepFlash) * 28}
          fill="none"
          stroke={`rgba(120, 220, 140, ${0.7 * beepFlash})`}
          strokeWidth="2"
        />
      )}
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CSS (single template literal injected via <style>)
// ─────────────────────────────────────────────────────────────────────────────

const ACT8_STYLES = `
.a8-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* ═══ GATE WEAVE — film registration jitter ═══
   Sub-pixel vertical, irrational period (~0.31s) so it doesn't visibly
   beat with anything else. Same idiom as Acts 6/7. */
.a8-gate-weave {
  position: absolute;
  inset: 0;
  z-index: 1;
  animation: a8GateWeave 0.31s linear infinite;
}
@keyframes a8GateWeave {
  0%   { transform: translateY(0px); }
  25%  { transform: translateY(0.18px); }
  50%  { transform: translateY(-0.14px); }
  75%  { transform: translateY(0.22px); }
  100% { transform: translateY(0px); }
}

/* ═══ FLASH FRAME ═══
   Each flash renders inside its own absolute frame so the photos can
   crossfade independently without layout interaction. */
.a8-flash-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
}

/* ═══ PHOTO ═══
   Cover-fit background image. Each flash sets its own scale + origin
   inline (Ken Burns push). will-change hints for GPU compositing.
   focus-breath animation modulates blur subtly — sells "depth of field"
   like a real lens slowly racking focus. */
.a8-photo {
  position: absolute;
  inset: 0;
  background-color: #050402;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center center;
  will-change: transform, filter;
  transition: none;
  /* Subtle filter for documentary grade — slight contrast push, slight
     desaturation. Keeps the photos from feeling overprocessed. */
  filter: contrast(1.06) saturate(0.92) brightness(0.95);
  animation: a8FocusBreath 11s ease-in-out infinite;
}
@keyframes a8FocusBreath {
  0%, 100% { filter: contrast(1.06) saturate(0.92) brightness(0.95) blur(0px); }
  50%      { filter: contrast(1.08) saturate(0.90) brightness(0.94) blur(0.45px); }
}

/* ═══ HANDHELD JITTER ═══
   When .a8-handheld-active is set (Flash 2 storm only), apply a pseudo-
   random sub-pixel-and-rotation jitter to simulate handheld camera in
   storm conditions. The wrapper has no jitter when not active so other
   flashes stay rock-steady (observational register). */
.a8-handheld {
  position: absolute;
  inset: -2%;
  z-index: 0;
  width: 104%;
  height: 104%;
}
.a8-handheld-active {
  animation: a8HandheldJitter 1.7s linear infinite;
}
@keyframes a8HandheldJitter {
  0%   { transform: translate(0px, 0px)     rotate(0deg);    }
  10%  { transform: translate(0.6px, -0.4px) rotate(0.05deg); }
  22%  { transform: translate(-0.4px, 0.7px) rotate(-0.07deg);}
  37%  { transform: translate(0.8px, 0.3px)  rotate(0.04deg); }
  51%  { transform: translate(-0.7px, -0.5px) rotate(-0.06deg);}
  68%  { transform: translate(0.5px, 0.6px)  rotate(0.05deg); }
  82%  { transform: translate(-0.6px, -0.3px) rotate(-0.04deg);}
  100% { transform: translate(0px, 0px)     rotate(0deg);    }
}

/* ─── FLASH 1 — HAZARD AMBER PULSES ─────────────────────────────────────
   Positioned in the DARK shoulder area at (63%, 53%) viewport — measured
   from the photo at brightness ~27/255, so the amber pulse reads cleanly
   against true black background instead of getting lost in the photo's
   ambient streetlamp warmth (which is at brightness ~145+ near the
   vanishing point and would absorb anything we tried to add there).

   Two pulses spaced 4% apart suggest the rear hazard pair of a truck
   pulled over on the right shoulder — the classic "broken-down semi"
   silhouette cue. Color shifted to red-orange (more saturated than the
   yellow-amber streetlamps in the photo) so the eye reads them as
   warning lights rather than infrastructure. */
.a8-hazard-pulse {
  position: absolute;
  top: 51%;
  width: 14px;
  height: 7px;
  border-radius: 50%;
  background: radial-gradient(ellipse at center,
    rgba(255, 130, 30, 1.0)    0%,
    rgba(255, 90, 20, 0.85)   38%,
    rgba(220, 60, 15, 0.30)   70%,
    transparent 100%);
  filter: blur(1px);
  mix-blend-mode: screen;
  pointer-events: none;
  /* Box-shadow gives the warm halo extending well beyond the pulse body */
  box-shadow:
    0 0 14px 4px rgba(255, 110, 25, 0.65),
    0 0 30px 12px rgba(255, 80, 15, 0.32),
    0 0 56px 22px rgba(200, 50, 10, 0.14);
  z-index: 3;
}
/* Left rear hazard */
.a8-hazard-pulse-l { left: 60%; }
/* Right rear hazard — paired ~4% apart to suggest truck width */
.a8-hazard-pulse-r { left: 66%; }

/* Subtle steam rising — vertical fade ABOVE the hazard pair position.
   The hazards are at viewport (60-66%, 51%); steam rises from there
   upward. Soft and slow-drifting — suggestion of an overheated engine
   venting, not a literal steam column. */
.a8-steam-rise {
  position: absolute;
  left: 59%;
  top: 36%;
  width: 36px;
  height: 16%;
  background: linear-gradient(to top,
    rgba(220, 215, 210, 0)     0%,
    rgba(220, 215, 210, 0.22) 35%,
    rgba(200, 195, 190, 0.12) 70%,
    rgba(200, 195, 190, 0)   100%);
  filter: blur(9px);
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 3;
  animation: a8SteamDrift 4s ease-in-out infinite;
}
@keyframes a8SteamDrift {
  0%   { transform: translateX(0) translateY(0); opacity: 1.0; }
  50%  { transform: translateX(-3px) translateY(-4px); opacity: 0.85; }
  100% { transform: translateX(0) translateY(0); opacity: 1.0; }
}

/* ─── FLASH 2 — RAIN PARTICLE SYSTEM (Variation B) ──────────────────────
   Discrete tapered streaks (each rendered as a separate element with
   randomized position/timing) plus ground splashes in the lower 28% of
   the frame. Replaces the original repeating-linear-gradient approach
   which produced visibly banded rain that read as cartoony.

   Each streak is a thin div with a vertical gradient (transparent →
   bright → transparent) that gives it the motion-blur taper of real
   rain. Three depth layers create parallax: near (largest, fastest,
   brightest) / mid / far (smallest, slowest, faintest).

   Ground splashes are flat ellipses (wider than tall) that scale-up
   and fade — simulating water hitting wet pavement. */
.a8-rain-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  overflow: hidden;
}

/* RAIN STREAK — base styling shared by all depth layers */
.a8-rain-streak {
  position: absolute;
  top: -10%;
  width: 1.5px;
  background: linear-gradient(to bottom,
    rgba(180, 200, 220, 0)   0%,
    rgba(200, 215, 230, 0.55) 30%,
    rgba(220, 230, 240, 0.85) 70%,
    rgba(180, 200, 220, 0)   100%);
  border-radius: 1px;
  pointer-events: none;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  /* Slight wind angle — rotated at the depth-layer level so all rain
     reads as wind-driven from the same direction (rather than stripes). */
}
/* NEAR layer — closest to camera, biggest, fastest, sharpest */
.a8-rain-near {
  width: 1.8px;
  height: 28px;
  animation-name: a8RainNearFall;
}
/* MID layer */
.a8-rain-mid {
  width: 1.2px;
  height: 18px;
  opacity: 0.7;
  animation-name: a8RainMidFall;
}
/* FAR layer — atmospheric distance, faintest */
.a8-rain-far {
  width: 0.8px;
  height: 11px;
  opacity: 0.4;
  animation-name: a8RainFarFall;
}
@keyframes a8RainNearFall {
  0%   { transform: translateY(-50%)   rotate(10deg); }
  100% { transform: translateY(1300%)  rotate(10deg); }
}
@keyframes a8RainMidFall {
  0%   { transform: translateY(-50%)   rotate(8deg); }
  100% { transform: translateY(1500%)  rotate(8deg); }
}
@keyframes a8RainFarFall {
  0%   { transform: translateY(-50%)   rotate(6deg); }
  100% { transform: translateY(1800%)  rotate(6deg); }
}

/* GROUND SPLASH — small expanding ellipse (wide+flat) that fades.
   Simulates water hitting wet pavement: appear briefly, expand outward,
   fade. The ellipse aspect ratio (radial-gradient ellipse with height
   compressed) reads as horizontal water spread on a flat surface. */
.a8-rain-splash {
  position: absolute;
  width: 8px;
  height: 2px;
  border-radius: 50%;
  background: radial-gradient(ellipse,
    rgba(220, 230, 240, 0.7) 0%,
    rgba(180, 200, 220, 0.3) 60%,
    transparent 100%);
  pointer-events: none;
  opacity: 0;
  animation-name: a8SplashImpact;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes a8SplashImpact {
  0%   { transform: scale(0.3); opacity: 0;   }
  20%  { transform: scale(1);   opacity: 0.8; }
  50%  { transform: scale(2.2); opacity: 0.4; }
  100% { transform: scale(3.5); opacity: 0;   }
}

/* Lightning flicker — a full-frame white-blue wash that fires once at
   ~mid-flash. Opacity is React-state-driven (not CSS animated) so the
   flicker lands on a precise frame. */
.a8-lightning {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 70% 25%,
    rgba(220, 230, 250, 1.0)  0%,
    rgba(180, 200, 230, 0.55) 30%,
    rgba(120, 140, 180, 0.18) 70%,
    transparent 100%);
  pointer-events: none;
  z-index: 5;
  mix-blend-mode: screen;
}

/* ─── FLASH 3 — PHONE CALL ─────────────────────────────────────────────── */
.a8-phone-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 50%,
      rgba(28, 22, 18, 0.95)   0%,
      rgba(8, 6, 5, 1.0)      85%,
      rgba(0, 0, 0, 1.0)     100%);
  z-index: 2;
}
.a8-phone-frame {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 280px;
  height: 580px;
  margin-left: -140px;
  margin-top: -290px;
  z-index: 3;
  transform-origin: center center;
  filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.85))
          drop-shadow(0 0 22px rgba(255, 220, 180, 0.06));
}
.a8-phone-vibrating {
  animation: a8PhoneVibrate 80ms linear infinite;
}
/* Phone vibrate — sub-pixel horizontal jitter at high frequency */
@keyframes a8PhoneVibrate {
  0%   { transform: translate(0, 0); }
  20%  { transform: translate(1.4px, -0.6px); }
  40%  { transform: translate(-1.2px, 0.7px); }
  60%  { transform: translate(1.0px, 0.5px); }
  80%  { transform: translate(-1.3px, -0.4px); }
  100% { transform: translate(0, 0); }
}
.a8-phone-svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* ─── FLASH 4 — STROBES (calibrated via Light FX Calibration Tool) ─────── */
/* Strobe overlays are CHILDREN of .a8-photo-dot, so they inherit the photo's
   Ken Burns transform. Gradient origin %s correspond to actual police-light
   pixel positions in dot_inspector_scale.png (calibrated by the user via the
   Light FX Calibration Tool) and stay locked through scale changes. */
.a8-strobe-red {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 50% 30% at 17.8% 54.6%,
    rgba(255, 35, 60, 0.85)   0%,
    rgba(220, 25, 50, 0.40)  22%,
    rgba(150, 15, 35, 0.12)  50%,
    transparent             100%);
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: screen;
}
.a8-strobe-blue {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 45% 28% at 27.2% 54.7%,
    rgba(40, 90, 255, 0.80)   0%,
    rgba(30, 70, 220, 0.36)  25%,
    rgba(20, 50, 160, 0.12)  52%,
    transparent             100%);
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: screen;
}

/* ═══ COLD COLOR GRADE ═══
   Subtle blue-white wash deepening the cold register. Counterpart to
   Act 4's warm tint. Heavy enough to be felt, light enough not to
   compete with the strobes in Flash 4. */
/* ═══════════════════════════════════════════════════════════════════════
   FULL CINEMATIC STACK — ported from Act 7 with cold-register tuning
   ═══════════════════════════════════════════════════════════════════════ */

/* CHROMATIC ABERRATION — RGB channel offset at frame corners.
   The corners of camera lenses in real life produce slight color fringing
   (red/cyan or blue/yellow) due to chromatic dispersion. In digital this
   is normally corrected; in cinema-cinematography it's deliberately left
   in or amplified for the "shot on film" register. */
.a8-chromatic {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 80% at 0% 0%,
      rgba(255, 60, 50, 0.14) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 0%,
      rgba(50, 180, 255, 0.14) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 0% 100%,
      rgba(50, 180, 255, 0.12) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 100%,
      rgba(255, 60, 50, 0.12) 0%, transparent 40%);
  mix-blend-mode: screen;
}

/* HALATION — radial film glow, color-matched per flash via inline style.
   The orange-red-blue halo around bright contrast boundaries. Heavy 40px
   blur for authentic "light bleeding into film" feel — Dehancer Pro
   physical-process simulation, ported to CSS gradients. */
.a8-halation {
  position: absolute;
  inset: -10%;
  z-index: 4;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(40px);
  opacity: 0.55;
  will-change: background;
  transition: background 320ms ease-in-out;
}

/* THREE-TIER ATMOSPHERIC HAZE — Hurlbut diffusion / Deakins fog.
   Each layer is a different SVG turbulence pattern (different baseFrequency,
   numOctaves, seed) animated at different periods so they parallax across
   each other creating authentic atmospheric depth.

   Cold register tint: feColorMatrix outputs a subtle blue-grey haze rather
   than the warm haze of Acts 6/7. */
.a8-haze {
  position: absolute;
  inset: -20%;
  z-index: 5;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.a8-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.014 0.024' numOctaves='3' seed='3'/><feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.85  0 0 0 0 0.95  0 0 0 0.20 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 220% 160%;
  opacity: 0.26;
  animation: a8HazeFar 42s linear infinite;
  filter: blur(13px);
}
.a8-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.024 0.038' numOctaves='2' seed='11'/><feColorMatrix values='0 0 0 0 0.85  0 0 0 0 0.90  0 0 0 0 0.96  0 0 0 0.22 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 190% 140%;
  opacity: 0.22;
  animation: a8HazeMid 29s linear infinite;
  filter: blur(8px);
}
.a8-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.038 0.058' numOctaves='2' seed='17'/><feColorMatrix values='0 0 0 0 0.92  0 0 0 0 0.95  0 0 0 0 0.98  0 0 0 0.16 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 170% 130%;
  opacity: 0.18;
  animation: a8HazeNear 21s linear infinite;
  filter: blur(5px);
}
@keyframes a8HazeFar {
  0%   { transform: translateX(-2%) translateY(0%)   scale(1.02); }
  50%  { transform: translateX(2%)  translateY(-1%)  scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%)   scale(1.02); }
}
@keyframes a8HazeMid {
  0%   { transform: translateX(3%)  translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%)  scale(1.06); }
  100% { transform: translateX(3%)  translateY(-0.5%) scale(1.03); }
}
@keyframes a8HazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%)  scale(1.04); }
  50%  { transform: translateX(2%)    translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%)  scale(1.04); }
}

/* DUST PARTICLE FIELD */
.a8-dust {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}
.a8-mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(245, 240, 230, 0.85) 0%,
    rgba(245, 240, 230, 0)   70%);
  box-shadow: 0 0 4px rgba(245, 240, 230, 0.4);
  will-change: transform, opacity;
  animation-name: a8MoteDrift;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  opacity: 0;
}
@keyframes a8MoteDrift {
  0%   { transform: translate(0, 0);          opacity: 0;    }
  12%  { opacity: 0.45; }
  50%  { transform: translate(18px, -42px);   opacity: 0.55; }
  88%  { opacity: 0.30; }
  100% { transform: translate(36px, -84px);   opacity: 0;    }
}

/* VIGNETTE — heavier than Acts 6/7 (0.62 vs 0.55) for despair register */
.a8-vignette {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 28%,
    rgba(0, 0, 0, 0.62) 100%);
}

/* SCANLINES — subtle horizontal repeating dark lines */
.a8-scanlines {
  position: absolute;
  inset: 0;
  z-index: 16;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.0) 0px,
    rgba(0, 0, 0, 0.0) 2px,
    rgba(0, 0, 0, 0.09) 3px,
    rgba(0, 0, 0, 0.0) 4px
  );
  mix-blend-mode: multiply;
  opacity: 0.45;
}

/* GRAIN — animated film noise. 4-step shift cycle at 0.5s. Heavier than
   Acts 6/7 (0.65 vs 0.55) for the documentary/16mm register. */
.a8-grain {
  position: absolute;
  inset: 0;
  z-index: 17;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.22 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.65;
  animation: a8GrainShift 0.5s steps(4) infinite;
}
@keyframes a8GrainShift {
  0%   { background-position: 0 0; }
  25%  { background-position: 23px -41px; }
  50%  { background-position: -67px 11px; }
  75%  { background-position: 31px 53px; }
  100% { background-position: 0 0; }
}

/* ANAMORPHIC LENS FLARE — horizontal streak that fires on dramatic
   punctuation. Tinted variants for different light sources:
     -white  cold-white for lightning
     -red    DOT police strobe red phase
     -blue   DOT police strobe blue phase
     -cyan   default cold register (J.J. Abrams idiom)
   Position is mid-frame (top: 50%); the streak extends past frame edges
   for the "long lens flare" feel. */
.a8-anamorphic {
  position: absolute;
  left: -10%;
  right: -10%;
  top: 50%;
  height: 8px;
  margin-top: -4px;
  z-index: 85;
  pointer-events: none;
  filter: blur(2.5px);
  mix-blend-mode: screen;
  will-change: opacity;
}
.a8-anamorphic-white {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(220, 230, 250, 0.4) 14%,
    rgba(245, 248, 255, 0.95) 50%,
    rgba(220, 230, 250, 0.4) 86%,
    transparent 100%);
  box-shadow: 0 0 70px rgba(220, 230, 250, 0.65);
}
.a8-anamorphic-red {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 80, 90, 0.4) 14%,
    rgba(255, 130, 140, 0.92) 50%,
    rgba(255, 80, 90, 0.4) 86%,
    transparent 100%);
  box-shadow: 0 0 60px rgba(255, 90, 100, 0.6);
}
.a8-anamorphic-blue {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(70, 130, 255, 0.4) 14%,
    rgba(140, 180, 255, 0.92) 50%,
    rgba(70, 130, 255, 0.4) 86%,
    transparent 100%);
  box-shadow: 0 0 60px rgba(80, 140, 255, 0.6);
}
.a8-anamorphic-cyan {
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(120, 200, 255, 0.4) 15%,
    rgba(180, 230, 255, 0.92) 50%,
    rgba(120, 200, 255, 0.4) 85%,
    transparent 100%);
  box-shadow: 0 0 60px rgba(120, 200, 255, 0.55);
}

/* BLOOM TRANSITIONS — white wash flash that fires at flash boundaries to
   bridge cuts with light overload. Same idiom as Act 6's flash transitions.
   Without this, the documentary hard cuts feel slideshow-y; with it, the
   transitions have light-physics continuity. */
.a8-bloom {
  position: absolute;
  inset: 0;
  z-index: 90;
  background: #fff;
  pointer-events: none;
  will-change: opacity;
}

/* ═══════════════════════════════════════════════════════════════════════ */

.a8-cold-grade {
  position: absolute;
  inset: 0;
  z-index: 14;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 50%,
      rgba(28, 38, 58, 0.10)  0%,
      rgba(18, 26, 44, 0.18) 60%,
      rgba(6, 10, 18, 0.42) 100%);
  mix-blend-mode: multiply;
}

/* ═══ FADE-TO-NEAR-BLACK ═══
   Final 800ms fade. Goes to 0.96 opacity (not 1.0) so we hit a deep
   crushed-black rather than pure-black — keeps faint registration with
   the photo register beneath. Act 9 will pick up from this depth.
   z-index 99 places it above ALL cinematic effects (bloom, anamorphic,
   grain, cinema bars) so the fade is uniform across every visible layer. */
.a8-fade-out {
  position: absolute;
  inset: 0;
  z-index: 99;
  background: #020203;
  pointer-events: none;
  will-change: opacity;
}

/* ═══ SKIP BUTTON ═══
   Same idiom as other acts — bottom-right, dim, low-emphasis. */
.a8-skip-btn {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 95;
  padding: 8px 16px;
  background: rgba(20, 20, 24, 0.65);
  color: rgba(220, 215, 200, 0.55);
  border: 0.5px solid rgba(220, 215, 200, 0.20);
  border-radius: 16px;
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  backdrop-filter: blur(8px);
}
.a8-skip-btn:hover { color: rgba(255, 245, 230, 0.85); }

/* ═══ REDUCE-MOTION ACCESSIBILITY ═══ */
.perf-reduce-motion .a8-gate-weave,
.perf-reduce-motion .a8-handheld-active,
.perf-reduce-motion .a8-rain-streak,
.perf-reduce-motion .a8-rain-splash,
.perf-reduce-motion .a8-steam-rise,
.perf-reduce-motion .a8-phone-vibrating,
.perf-reduce-motion .a8-photo,
.perf-reduce-motion .a8-haze,
.perf-reduce-motion .a8-mote,
.perf-reduce-motion .a8-grain {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .a8-gate-weave,
  .a8-handheld-active,
  .a8-rain-streak,
  .a8-rain-splash,
  .a8-steam-rise,
  .a8-phone-vibrating,
  .a8-photo,
  .a8-haze,
  .a8-mote,
  .a8-grain {
    animation: none !important;
  }
}
`;

export default Act8TheJob;
