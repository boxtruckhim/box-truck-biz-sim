/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 11: The Compliance Promise (V6 Cork Board)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 11 seconds of content + 600ms cross-dissolve = 11600ms total component
 * duration. Spotlight investigative-wall register: a cork board of real
 * FMCSA enforcement consequences, populated note-by-note with red push-pins
 * thrown dart-style into the board. Replaces the previous V1 DVIR Dashboard
 * variant per user direction (V6 won the concept comparison).
 *
 * EMOTIONAL CONTRACT: Trust deepened through visceral evidence. The
 * cinematic moves from "you'll pass the test" register to "look at what
 * happens to people who don't." Marcus's VO closes the cinematic's core
 * thesis: the simulator forces you to face every failure mode safely
 * before you risk your savings on it for real.
 *
 * Reference register: All The President's Men investigative wall ·
 * Spotlight detective board · Sicario evidence-room corkboard
 *
 * ─── ASSET ──────────────────────────────────────────────────────────────
 *
 *   Primary asset: cork_optimized.jpg (Pexels photo #5988420 by Eva
 *   Bronzini — CC0 / Pexels License, no attribution required). 3712×5568
 *   source, center-cropped to 480/1040 portrait aspect, downsampled to
 *   720×1560, JPEG q78 progressive ≈ 400KB. Bundled as data URI in
 *   IMAGE_DATA_URIS.js. Real photographic cork — granular oak chips
 *   pressed into board, natural warm tan with darker inclusions.
 *
 * ─── ANIMATION CHOREOGRAPHY (timeline in act-local ms) ─────────────────
 *
 *   0     →  400ms    Cork board fades in (cross-dissolve handoff from Act 10)
 *
 *   PER-NOTE SEQUENCE (NOTE_INTERVAL_MS = 1500ms, starts at 200ms):
 *     Note N starts at: 200 + N * 1500
 *
 *     +  0 →  280ms    Paper-drop-in: note translates from -40px above target
 *                      with rotation overshoot (8° beyond target, settles to
 *                      layout angle), opacity 0 → 1, drop shadow grows.
 *                      Top edge has slight rotateX (curl up like unattached
 *                      paper falling), settles flat as it lands.
 *
 *     + 280 →  680ms   READING WINDOW 1 (unpinned). Note sits readable on cork
 *                      with paper shadow. Top corners still slightly lifted
 *                      (no pin holding it). User reads source + headline.
 *
 *     + 680 →  860ms   PIN DART-THROW (180ms). Pin appears at offstage origin
 *                      (varies per pin — simulating different throwing angles
 *                      from a person at the board) at scale 1.6 with motion-
 *                      blur filter, translates rapidly toward note's pin-anchor
 *                      (top-center), shrinking to scale 1.0 and blur 4px → 0px
 *                      on the way (3D depth illusion of coming AT the board
 *                      from camera-side). Slight rotateZ spin during flight.
 *
 *     + 860 →  980ms   PIN IMPACT. Note vibrates ±2.2px translate via damped
 *                      sine oscillation (4 cycles, exponential decay), then
 *                      snaps flat. Pin scales 1.15 → 1.0. Cork-puncture shadow
 *                      indent appears beneath pin.
 *
 *     + 980 → 1500ms   READING WINDOW 2 (pinned). Note + pin in place. User
 *                      reads sub-line / fine print. Next note begins at +1500.
 *
 *   ───── 6 NOTES TOTAL → last note pinned at 200 + 5*1500 + 980 = 8680ms ─────
 *
 *   9200 →  9700ms   "PREPARES YOU FOR / EVERY ONE." gold-bordered stamp
 *                    lands paper-impact bounce — rotation -6° → 0°,
 *                    scale 1.10 → 1.04 → 1.00, opacity fade-in.
 *
 *   9700 → 11000ms   Hold full composite (last reading window).
 *
 *  11000 → 11600ms   Cross-dissolve out (handoff to Act 12 launch).
 *
 * ─── MARCUS VO CAPTIONS (storyboard v3.1, conviction-final) ────────────
 *
 *   200  → 2200ms   "Trucking is not forgiving."
 *  2400  → 6500ms   "You could put your life savings into a truck — and
 *                    lose it all tomorrow. A dozen ways."
 *  6800  → 10500ms  "Box Truck Boss makes you face all of them."
 *
 *   The "makes you face" phrasing per v3.1 — game-challenge language for
 *   the simulator-fan audience rather than training-program register.
 *
 * ─── 6 HEADLINES (cork board notes, asymmetric natural layout) ─────────
 *
 *   Pulled from real FMCSA enforcement actions and trade press:
 *
 *   #  POSITION         ROT     SOURCE                HEADLINE
 *   1  ( 6%,  8%)       -3.5°   Land Line · 2024      CARRIER LOSES AUTHORITY
 *   2  (50%, 13%)       +4.5°   Trucking News         OWNER-OP LOSES HOME
 *   3  ( 4%, 36%)       +3°     Overdrive · 2025      FATAL CRASH
 *   4  (49%, 41%)       -4.5°   FreightWaves          ELD FRAUD CASE
 *   5  ( 7%, 62%)       -2.5°   CCJ · 2024            FLEET SHUTDOWN
 *   6  (51%, 67%)       +5.5°   DOT Bulletin          OUT-OF-SERVICE ORDER
 *
 * ─── PROPS INTERFACE ────────────────────────────────────────────────────
 *
 *   onComplete    Called once at ACT_DURATION_MS — sequence advances to Act 12
 *   onSkip        Called when player taps SKIP — immediate jump
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

import {
  CinematicStage,
  CinemaBars,
} from '../WelcomeModalShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ACT_DURATION_MS = 12500;     // was 11000 — extended +1500ms for caption read time
const FADE_OUT_MS     = 600;
const CONTENT_END_MS  = ACT_DURATION_MS - FADE_OUT_MS;

// ═══ NOTE TIMING (per-note phase durations) ═══
const FIRST_NOTE_START_MS = 200;
const NOTE_INTERVAL_MS    = 1500;   // between successive notes
const NOTE_DROP_MS        = 280;    // paper falls onto cork
const NOTE_READ_BEFORE_MS = 400;    // reading window before pin
const PIN_THROW_MS        = 180;    // dart-flight duration
const PIN_IMPACT_MS       = 120;    // vibration + settle
// (READ_AFTER) 1500 - (DROP + READ_BEFORE + THROW + IMPACT) = 1500 - 980 = 520ms

// ═══ FINAL STAMP ═══
// Shifted +1500ms to remain aligned with the end of Caption 3 (which now
// extends to 12000ms instead of 10500ms).
const STAMP_START_MS  = 10700;     // was 9200
const STAMP_LAND_MS   = 11200;     // was 9700

// ═══ HEADLINES (asymmetric natural layout) ═══
const HEADLINES = [
  { id: 'h1',
    x: 6,  y: 8,   rot: -3.5,
    source: 'Land Line · 2024',
    overline: '37 BASIC violations',
    headline: 'CARRIER LOSES AUTHORITY',
    sub: 'CSA score forced shutdown' },
  { id: 'h2',
    x: 50, y: 13,  rot:  4.5,
    source: 'Trucking News',
    overline: 'Insurance lapsed',
    headline: 'OWNER-OP LOSES HOME',
    sub: '$1.4M judgment after crash' },
  { id: 'h3',
    x: 4,  y: 36,  rot:  3,
    source: 'Overdrive · 2025',
    overline: 'Brake neglect traced',
    headline: 'FATAL CRASH',
    sub: '"Pre-trip would have caught it"' },
  { id: 'h4',
    x: 49, y: 41,  rot: -4.5,
    source: 'FreightWaves',
    overline: '$190,000 fine',
    headline: 'ELD FRAUD CASE',
    sub: 'Three drivers indicted' },
  { id: 'h5',
    x: 7,  y: 58,  rot: -2.5,
    source: 'CCJ · 2024',
    overline: 'CSA over 90',
    headline: 'FLEET SHUTDOWN',
    sub: 'Operating authority revoked' },
  { id: 'h6',
    x: 51, y: 63,  rot:  5.5,
    source: 'DOT Bulletin',
    overline: 'Unauthorized operation',
    headline: 'OUT-OF-SERVICE ORDER',
    sub: '$19,277 / day per CFR §392' },
];

// ═══ PIN THROW ORIGINS ═══
//
// Each pin originates from the SAME SIDE of the screen as its note. The
// (dxFrom, dyFrom) is the pin's offset from its anchor point at t=0 — the
// pin animates from this offset back to (0, 0) over the throw duration.
// Sign convention: negative x = left-of-anchor, positive x = right; negative
// y = above-anchor, positive y = below.
//
// Note layout cheatsheet (for reference):
//   h1 ( 6%,  8%) top-left      → pin from UPPER-LEFT
//   h2 (50%, 13%) top-right     → pin from UPPER-RIGHT
//   h3 ( 4%, 36%) middle-left   → pin from MIDDLE-LEFT
//   h4 (49%, 41%) middle-right  → pin from MIDDLE-RIGHT
//   h5 ( 7%, 62%) bottom-left   → pin from LOWER-LEFT
//   h6 (51%, 67%) bottom-right  → pin from LOWER-RIGHT
//
const PIN_ORIGINS = [
  { dxFrom: -200, dyFrom: -140 },   // h1 — upper-left (note is top-left)
  { dxFrom:  220, dyFrom: -150 },   // h2 — upper-right (note is top-right)
  { dxFrom: -210, dyFrom:  -50 },   // h3 — middle-left (note is mid-left)
  { dxFrom:  210, dyFrom:  -50 },   // h4 — middle-right (note is mid-right)
  { dxFrom: -200, dyFrom:  150 },   // h5 — lower-left (note is bottom-left)
  { dxFrom:  210, dyFrom:  160 },   // h6 — lower-right (note is bottom-right)
];

// ═══ MARCUS VO CAPTIONS ═══
// Each caption extended by +500ms duration per user feedback ("everything
// is moving too fast"). Sequence shifts cumulatively to preserve gaps.
const VOICEMAIL_SEGMENTS = [
  { startMs:  200, endMs:  2700, text: 'Trucking is not forgiving.' },                                                       // +500ms duration
  { startMs: 2900, endMs:  7500, text: 'You could put your life savings into a truck — and lose it all tomorrow. A dozen ways.' },  // +500ms duration, shifted +500ms
  { startMs: 7800, endMs: 12000, text: 'Box Truck Boss makes you face all of them.' },                                       // +500ms duration, shifted +1000ms
];

// ═══ EASINGS ═══
const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint   = (t) => 1 - Math.pow(1 - t, 5);
// Pin throw — accelerates into target (ease-in)
const dartEase       = (t) => Math.pow(t, 1.6);

// Damped sine oscillation for impact vibration (4 cycles, exponential decay)
const vibrateAt = (t01) => {
  if (t01 < 0 || t01 > 1) return 0;
  const decay = Math.exp(-3.5 * t01);
  return Math.sin(t01 * Math.PI * 8) * decay * 2.2;   // ±2.2px max
};

// Paper-impact bounce — 1.10 → 1.04 → 1.00 across t=0..1
const stampBounce = (t) => {
  if (t < 0.5) return 1.10 - (1.10 - 1.04) * easeOutCubic(t / 0.5);
  return 1.04 - (1.04 - 1.00) * easeOutCubic((t - 0.5) / 0.5);
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ─────────────────────────────────────────────────────────────────────────────
// PER-NOTE STATE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

function computeNoteState(noteIndex, elapsedMs) {
  const noteStart     = FIRST_NOTE_START_MS + noteIndex * NOTE_INTERVAL_MS;
  const dropEnd       = noteStart + NOTE_DROP_MS;
  const readBeforeEnd = dropEnd + NOTE_READ_BEFORE_MS;
  const pinThrowEnd   = readBeforeEnd + PIN_THROW_MS;
  const impactEnd     = pinThrowEnd + PIN_IMPACT_MS;

  // Note has not yet appeared
  if (elapsedMs < noteStart) {
    return {
      noteVisible: false,
      paperOpacity: 0,
      paperRotateBoost: 0,
      paperTranslateY: -40,
      pinVisible: false,
      pinProgress: 0,
      pinScale: 1,
      pinBlur: 0,
      vibrateOffset: 0,
      cornerLift: 0,
      pinned: false,
    };
  }

  // PHASE A — Paper drops onto cork
  if (elapsedMs < dropEnd) {
    const t = (elapsedMs - noteStart) / NOTE_DROP_MS;
    const e = easeOutQuint(t);
    return {
      noteVisible: true,
      paperOpacity: e,
      paperRotateBoost: (1 - e) * 8 * (noteIndex % 2 === 0 ? -1 : 1),
      paperTranslateY: -40 * (1 - e),
      pinVisible: false,
      pinProgress: 0,
      pinScale: 1,
      pinBlur: 0,
      vibrateOffset: 0,
      cornerLift: 1 - e * 0.3,
      pinned: false,
    };
  }

  // PHASE B — Reading window 1 (unpinned)
  if (elapsedMs < readBeforeEnd) {
    return {
      noteVisible: true,
      paperOpacity: 1,
      paperRotateBoost: 0,
      paperTranslateY: 0,
      pinVisible: false,
      pinProgress: 0,
      pinScale: 1,
      pinBlur: 0,
      vibrateOffset: 0,
      cornerLift: 0.7,
      pinned: false,
    };
  }

  // PHASE C — Pin dart-throws
  if (elapsedMs < pinThrowEnd) {
    const t = (elapsedMs - readBeforeEnd) / PIN_THROW_MS;
    const e = dartEase(t);
    return {
      noteVisible: true,
      paperOpacity: 1,
      paperRotateBoost: 0,
      paperTranslateY: 0,
      pinVisible: true,
      pinProgress: e,
      pinScale: 1.6 - 0.6 * e,
      pinBlur: 4 * (1 - e),
      vibrateOffset: 0,
      cornerLift: 0.7,
      pinned: false,
    };
  }

  // PHASE D — Pin impact (note vibrates, pin settles)
  if (elapsedMs < impactEnd) {
    const t = (elapsedMs - pinThrowEnd) / PIN_IMPACT_MS;
    return {
      noteVisible: true,
      paperOpacity: 1,
      paperRotateBoost: 0,
      paperTranslateY: 0,
      pinVisible: true,
      pinProgress: 1,
      pinScale: 1.0 + 0.15 * (1 - easeOutCubic(t)),
      pinBlur: 0,
      vibrateOffset: vibrateAt(t),
      cornerLift: 0.7 - 0.7 * easeOutCubic(t),
      pinned: true,
    };
  }

  // PHASE E — Pinned, settled
  return {
    noteVisible: true,
    paperOpacity: 1,
    paperRotateBoost: 0,
    paperTranslateY: 0,
    pinVisible: true,
    pinProgress: 1,
    pinScale: 1,
    pinBlur: 0,
    vibrateOffset: 0,
    cornerLift: 0,
    pinned: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act11TheCompliancePromise = React.memo(function Act11TheCompliancePromise({
  onComplete = () => {},
  onSkip     = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('11', elapsedMs);

  // Master timer
  useEffect(() => {
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      if (elapsed >= ACT_DURATION_MS + FADE_OUT_MS) {
        setElapsedMs(ACT_DURATION_MS + FADE_OUT_MS);
        onComplete();
        return;
      }
      setElapsedMs(elapsed);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  // Cork texture URL from global registry
  const corkUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.__ACT11_CORK) return window.__ACT11_CORK;
    return null;
  }, []);

  // Cork board entrance fade
  const corkFade = useMemo(
    () => clamp01(elapsedMs / 400),
    [elapsedMs]
  );

  // Per-note state
  const noteStates = useMemo(
    () => HEADLINES.map((_, i) => computeNoteState(i, elapsedMs)),
    [elapsedMs]
  );

  // Final stamp state
  const stampState = useMemo(() => {
    if (elapsedMs < STAMP_START_MS) return { opacity: 0, rotation: -6, scale: 1.10 };
    if (elapsedMs > STAMP_LAND_MS)  return { opacity: 1, rotation:  0, scale: 1.00 };
    const t = (elapsedMs - STAMP_START_MS) / (STAMP_LAND_MS - STAMP_START_MS);
    return {
      opacity:  Math.min(1, t * 4),
      rotation: -6 + 6 * easeOutQuint(t),
      scale:    stampBounce(t),
    };
  }, [elapsedMs]);

  // Marcus caption (active segment)
  const currentSegment = useMemo(() => {
    return VOICEMAIL_SEGMENTS.find(s => elapsedMs >= s.startMs && elapsedMs < s.endMs) || null;
  }, [elapsedMs]);

  // Cross-dissolve out
  const fadeOpacity = elapsedMs >= CONTENT_END_MS
    ? Math.min(1, (elapsedMs - CONTENT_END_MS) / FADE_OUT_MS)
    : 0;

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <CinematicStage>
      <style>{ACT11_STYLES}</style>

      {/* SVG defs for pin gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <radialGradient id="a11-pin-red" cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#ff8a78" />
            <stop offset="22%"  stopColor="#e63a30" />
            <stop offset="68%"  stopColor="#a51810" />
            <stop offset="100%" stopColor="#5a0a07" />
          </radialGradient>
          <radialGradient id="a11-pin-spec" cx="32%" cy="25%" r="18%">
            <stop offset="0%"   stopColor="rgba(255, 255, 255, 0.95)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
          </radialGradient>
        </defs>
      </svg>

      <div className="a11-stage">
        {/* Cork board — full-stage real photographic texture */}
        <div
          className="a11-cork"
          style={{
            opacity: corkFade,
            backgroundImage: corkUrl ? `url("${corkUrl}")` : 'none',
          }}
        />

        {/* Warm cinematic vignette + tint over cork */}
        <div className="a11-cork-vignette" style={{ opacity: corkFade }} />
        <div className="a11-cork-warm-grade" style={{ opacity: corkFade * 0.7 }} />

        {/* Newspaper-clipping notes with pins */}
        {HEADLINES.map((h, i) => (
          <CorkNote key={h.id} headline={h} state={noteStates[i]} pinOrigin={PIN_ORIGINS[i]} />
        ))}

        {/* Final gold-bordered stamp */}
        <FinalStamp state={stampState} />

        {/* Cinema bars */}
        <CinemaBars barHeight={28} delayMs={0} />

        {/*
          DEDICATED CAPTION ZONE — bottom strip with scrim gradient.
          Sits ABOVE cork + notes (z-index higher), below cinema bars +
          fade-out + skip-button. The scrim fades from transparent at the
          top of the strip to ~92% black at the bottom, creating a clear
          visual separation between the cork board content (where notes
          live) and the caption text. Captions never overlap with the
          paper notes — they live in their own letterbox-style band.
        */}
        <div className="a11-caption-zone">
          <div className="a11-caption-scrim" />
          {currentSegment && (
            <div className="a11-caption-text">
              {currentSegment.text}
            </div>
          )}
        </div>

        {/* Cross-dissolve out */}
        <div className="a11-fade-out" style={{ opacity: fadeOpacity }} />

        {/* Skip button */}
        <button
          className="a11-skip-btn"
          onClick={onSkip}
          aria-label="Skip act"
        >
          Skip
        </button>
      </div>
    </CinematicStage>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CORK NOTE — newspaper clipping with paper texture + dart-thrown push pin
// ─────────────────────────────────────────────────────────────────────────────

const CorkNote = React.memo(function CorkNote({ headline, state, pinOrigin }) {
  const {
    noteVisible, paperOpacity, paperRotateBoost, paperTranslateY,
    pinVisible, pinProgress, pinScale, pinBlur,
    vibrateOffset, cornerLift, pinned,
  } = state;

  if (!noteVisible) return null;

  // Pin trajectory: starts at (dxFrom, dyFrom) offset, ends at (0, 0)
  const pinTx = (1 - pinProgress) * pinOrigin.dxFrom;
  const pinTy = (1 - pinProgress) * pinOrigin.dyFrom;
  // Slight rotation during flight (spin) — settles to 0 at impact
  const pinRotZ = (1 - pinProgress) * (pinOrigin.dxFrom > 0 ? 25 : -25);

  return (
    <div
      className="a11-note-wrap"
      style={{
        left: `${headline.x}%`,
        top:  `${headline.y}%`,
        transform: `
          translate(${vibrateOffset.toFixed(2)}px, ${(paperTranslateY + Math.abs(vibrateOffset) * 0.3).toFixed(2)}px)
          rotate(${(headline.rot + paperRotateBoost).toFixed(2)}deg)
        `,
        opacity: paperOpacity,
      }}
    >
      {/* Paper layer with shadow that grows as paper settles */}
      <div
        className={`a11-note-paper ${pinned ? 'pinned' : 'unpinned'}`}
        style={{
          transform: `perspective(800px) rotateX(${(cornerLift * 4).toFixed(2)}deg)`,
          transformOrigin: 'top center',
        }}
      >
        {/* Paper grain texture (multi-layer noise) */}
        <div className="a11-note-grain" />
        {/* Edge wear (vintage darkening at bottom-right) */}
        <div className="a11-note-edge-wear" />

        {/* Content */}
        <div className="a11-note-source">{headline.source}</div>
        <div className="a11-note-overline">{headline.overline}</div>
        <div className="a11-note-headline">{headline.headline}</div>
        <div className="a11-note-divider" />
        <div className="a11-note-sub">{headline.sub}</div>
      </div>

      {/* Push pin at top-center */}
      {pinVisible && (
        <div
          className="a11-pin-wrap"
          style={{
            transform: `translate(${pinTx.toFixed(1)}px, ${pinTy.toFixed(1)}px) scale(${pinScale.toFixed(3)}) rotate(${pinRotZ.toFixed(1)}deg)`,
            filter: pinBlur > 0.1 ? `blur(${pinBlur.toFixed(1)}px)` : 'none',
            opacity: pinProgress > 0.05 ? 1 : 0,
          }}
        >
          <PushPinSVG />
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PUSH PIN SVG — face-on view of a real push pin
// ─────────────────────────────────────────────────────────────────────────────

const PushPinSVG = React.memo(function PushPinSVG() {
  return (
    <svg className="a11-pin-svg" viewBox="-22 -22 44 44" xmlns="http://www.w3.org/2000/svg">
      {/* Cork puncture indent shadow */}
      <ellipse cx="2" cy="3" rx="13" ry="13"
               fill="rgba(0, 0, 0, 0.32)"
               filter="blur(2px)" />

      {/* Brass shaft slice peeking out at bottom (metal pin going INTO cork) */}
      <ellipse cx="0.5" cy="9.5" rx="2.4" ry="1.2"
               fill="#7a6248"
               opacity="0.65" />

      {/* Pin head body — 3D red plastic dome */}
      <circle cx="0" cy="0" r="11" fill="url(#a11-pin-red)" />

      {/* Inner shadow ring (gives the dome curvature) */}
      <circle cx="0" cy="0" r="11" fill="none"
              stroke="rgba(70, 10, 5, 0.4)"
              strokeWidth="0.8" />

      {/* Specular highlight — bright white spot upper-left */}
      <ellipse cx="-3.4" cy="-4.2" rx="3.5" ry="2.5"
               fill="url(#a11-pin-spec)"
               opacity="0.95" />

      {/* Outer rim shadow (ground contact line) */}
      <circle cx="0" cy="0.5" r="11.2" fill="none"
              stroke="rgba(0, 0, 0, 0.28)"
              strokeWidth="0.6" />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FINAL STAMP — gold-bordered "PREPARES YOU FOR / EVERY ONE" card
// ─────────────────────────────────────────────────────────────────────────────

const FinalStamp = React.memo(function FinalStamp({ state }) {
  return (
    <div
      className="a11-final-stamp"
      style={{
        opacity: state.opacity,
        transform: `translate(-50%, -50%) rotate(${state.rotation.toFixed(2)}deg) scale(${state.scale.toFixed(3)})`,
      }}
    >
      <div className="a11-final-stamp-inner">
        <div className="a11-final-overline">PREPARES YOU FOR</div>
        <div className="a11-final-headline">EVERY ONE.</div>
        <div className="a11-final-divider" />
        <div className="a11-final-meta">BOX TRUCK BOSS · LIVE OPS</div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ACT11_STYLES = `
.a11-stage {
  position: absolute;
  inset: 0;
  background: #0c0905;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* ═══ CORK BACKGROUND (real photographic texture) ═══ */
.a11-cork {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 1;
  /* Slight Ken-Burns drift — cork "alive" via subtle 1.04x scale over act */
  animation: a11-cork-drift 11000ms linear;
  will-change: transform;
}
@keyframes a11-cork-drift {
  0%   { transform: scale(1.00); }
  100% { transform: scale(1.04); }
}

/* Warm cinematic vignette over cork */
.a11-cork-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%,
    transparent 35%,
    rgba(20, 10, 5, 0.45) 75%,
    rgba(10, 5, 2, 0.85) 100%);
}

/* Warm-grade overlay — slight amber wash for cinematic color grade */
.a11-cork-warm-grade {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(255, 200, 130, 0.04) 0%,
    rgba(180, 130, 60, 0.06) 50%,
    rgba(80, 40, 15, 0.08) 100%);
  mix-blend-mode: overlay;
}

/* ═══ CORK NOTES ═══ */
.a11-note-wrap {
  position: absolute;
  z-index: 10;
  width: 200px;
  pointer-events: none;
  will-change: transform, opacity;
  /* Drop shadow on cork (paper raised above board) */
  filter: drop-shadow(2px 4px 4px rgba(20, 10, 0, 0.55))
          drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.a11-note-paper {
  position: relative;
  background:
    linear-gradient(135deg,
      #f5ecd0 0%,
      #efe2bc 35%,
      #e8d6a8 75%,
      #d8c498 100%);
  border: 0.5px solid rgba(120, 90, 50, 0.4);
  padding: 10px 14px 12px;
  font-family: 'Times New Roman', Georgia, serif;
  color: #1a1208;
  border-radius: 1px;
  box-shadow:
    inset 0 0 8px rgba(120, 80, 40, 0.10),
    inset 0 -2px 3px rgba(140, 100, 50, 0.12);
  transform-origin: top center;
  will-change: transform;
}

/* Pinned variant — slight darken at top under pin */
.a11-note-paper.pinned::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 36px;
  height: 14px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center top,
    rgba(60, 30, 0, 0.18) 0%,
    transparent 70%);
  pointer-events: none;
  z-index: 1;
}

/* Paper grain — multi-layer noise dots for fiber texture */
.a11-note-grain {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 23% 41%, rgba(180, 140, 80, 0.12) 0.5px, transparent 1px),
    radial-gradient(circle at 67% 73%, rgba(120, 80, 40, 0.10) 0.5px, transparent 1px),
    radial-gradient(circle at 84% 19%, rgba(160, 120, 70, 0.08) 0.5px, transparent 1px),
    radial-gradient(circle at 11% 88%, rgba(100, 70, 30, 0.10) 0.5px, transparent 1px);
  background-size: 8px 8px, 12px 12px, 10px 10px, 14px 14px;
  background-position: 0 0, 2px 3px, 5px 1px, 1px 4px;
  pointer-events: none;
  border-radius: inherit;
  mix-blend-mode: multiply;
  opacity: 0.7;
}

/* Edge wear — darker bottom-right corner */
.a11-note-edge-wear {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(120deg,
    transparent 65%,
    rgba(120, 80, 30, 0.10) 92%,
    rgba(80, 50, 15, 0.18) 100%);
  border-radius: inherit;
}

.a11-note-source {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 8px;
  font-weight: 700;
  color: #6a3018;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  margin-bottom: 4px;
  position: relative;
  z-index: 2;
}

.a11-note-overline {
  font-family: 'Times New Roman', serif;
  font-size: 9px;
  font-weight: 400;
  font-style: italic;
  color: #5a3018;
  letter-spacing: 0.04em;
  margin-bottom: 1px;
  position: relative;
  z-index: 2;
}

.a11-note-headline {
  font-family: 'Times New Roman', Georgia, serif;
  font-size: 13.5px;
  font-weight: 800;
  line-height: 1.05;
  color: #100804;
  letter-spacing: 0.005em;
  margin-bottom: 6px;
  position: relative;
  z-index: 2;
  text-shadow:
    0 0.5px 0 rgba(0, 0, 0, 0.15),
    0 0 1px rgba(40, 20, 8, 0.10);
}

.a11-note-divider {
  width: 100%;
  height: 0.5px;
  background: rgba(80, 40, 10, 0.4);
  margin: 6px 0 5px;
  position: relative;
  z-index: 2;
}

.a11-note-sub {
  font-family: 'Times New Roman', serif;
  font-size: 9.5px;
  font-style: italic;
  font-weight: 400;
  color: #3a2010;
  line-height: 1.25;
  position: relative;
  z-index: 2;
}

/* ═══ PUSH PIN ═══ */
.a11-pin-wrap {
  position: absolute;
  left: 50%;
  top: -8px;
  width: 22px;
  height: 22px;
  margin-left: -11px;
  z-index: 30;
  pointer-events: none;
  will-change: transform, filter, opacity;
  transform-origin: center;
}

.a11-pin-svg {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(1.5px 3px 2.5px rgba(20, 10, 0, 0.55))
          drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}

/* ═══ FINAL STAMP ═══ */
.a11-final-stamp {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 40;
  transform: translate(-50%, -50%);
  pointer-events: none;
  will-change: transform, opacity;
}

.a11-final-stamp-inner {
  background: rgba(8, 5, 2, 0.94);
  border: 2.5px solid rgba(255, 200, 110, 0.95);
  border-radius: 2px;
  padding: 16px 32px 14px;
  text-align: center;
  box-shadow:
    0 0 32px rgba(255, 195, 95, 0.45),
    0 6px 20px rgba(0, 0, 0, 0.7),
    inset 0 0 8px rgba(255, 195, 95, 0.12);
  filter: drop-shadow(-0.5px 0.5px 0 rgba(220, 165, 75, 0.4))
          drop-shadow(0.5px -0.3px 0 rgba(220, 165, 75, 0.4));
}

.a11-final-overline {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.30em;
  color: rgba(255, 200, 110, 0.95);
  font-weight: 700;
}

.a11-final-headline {
  font-family: 'Outfit', 'SF Pro Display', sans-serif;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.10em;
  color: rgba(255, 220, 160, 1);
  text-shadow: 0 0 12px rgba(255, 195, 95, 0.65);
  margin-top: 4px;
  line-height: 1;
}

.a11-final-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 200, 110, 0.55);
  margin: 8px 0 6px;
}

.a11-final-meta {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7.5px;
  letter-spacing: 0.28em;
  color: rgba(255, 200, 110, 0.85);
  font-weight: 600;
}

/* ═══ DEDICATED CAPTION ZONE ═══
   Bottom strip with scrim that visually separates the caption from the
   cork board content above. Captions never overlap with notes because
   they live inside this designated letterbox-style band.                 */
.a11-caption-zone {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 28px;          /* sit just above the bottom cinema bar */
  z-index: 60;           /* above cork (z=1), notes (z=10), pins (z=30), stamp (z=40) */
  pointer-events: none;
  height: 180px;
}

/* Scrim gradient — transparent at top of zone, opaque-black at bottom.
   This creates a clean visual handoff: cork zone → caption zone with no
   abrupt cut, just a soft darkening that ensures legibility regardless
   of how long Marcus's caption wraps. */
.a11-caption-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    rgba(0, 0, 0, 0)    0%,
    rgba(0, 0, 0, 0.40) 28%,
    rgba(0, 0, 0, 0.78) 60%,
    rgba(0, 0, 0, 0.92) 100%);
  pointer-events: none;
}

/* Caption text — sits inside the dark portion of the scrim for max
   legibility. Anchored to bottom of zone so multi-line wraps grow upward
   into the dark band, never down into the cork zone. */
.a11-caption-text {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 18px;
  text-align: center;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.005em;
  line-height: 1.32;
  color: rgba(245, 235, 215, 0.97);
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 4px rgba(0, 0, 0, 0.7);
  /* Smooth crossfade between caption changes */
  animation: a11-caption-in 220ms ease-out;
}
@keyframes a11-caption-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ═══ FADE OUT ═══ */
.a11-fade-out {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 90;
  pointer-events: none;
}

/* ═══ SKIP BUTTON ═══ */
.a11-skip-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(220, 195, 140, 0.35);
  background: rgba(0, 0, 0, 0.5);
  color: rgba(220, 195, 140, 0.85);
  font-family: 'Outfit', sans-serif;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 64px;
  min-height: 44px;
}
.a11-skip-btn:active { transform: scale(0.96); }
`;

export default Act11TheCompliancePromise;
