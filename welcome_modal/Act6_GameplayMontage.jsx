/**
 * Act 6 — The Skills That Save Your Career (22s) — v3 CINEMATIC UPGRADE
 *
 * v1 was a slideshow.
 * v2 added handheld jitter, focus drift, three-tier haze, dust motes, and
 *   per-flash live ticking elements.
 * v3 (this version) adds the full cinematic-trailer stack: anamorphic-style
 *   lens flare on bloom transitions, halation glow around bright photo highlights,
 *   chromatic aberration at frame edges, occasional warm light leak sweep,
 *   per-flash Ken Burns motion variations (push, pull, dolly tilt), gate weave
 *   on the photo plate, photo crossfade through bloom (next photo bleeds in
 *   80ms before bloom ends — eliminates the flash-of-black between flashes),
 *   subtle scanline veil, and caption breathing drift.
 *
 * The intent is no longer "good slideshow" — it is "feels shot on real glass
 * by a real camera operator in a graded color pipeline." Every layer is doing
 * one specific job from the cinematic-trailer reference (Top Gun Maverick
 * training montage, Sicario night scenes, Better Call Saul desert):
 *
 *   GATE WEAVE        — film registration micro-jitter (vertical sub-px)
 *   HANDHELD JITTER   — operator hand 3-axis drift
 *   FOCUS BREATH      — autofocus micro-hunt (blur 0 → 0.55px → 0)
 *   KEN BURNS         — per-flash distinct camera move (push/pull/dolly tilt)
 *   HAZE TRIPLE       — three depth layers of SVG-turbulence atmosphere
 *   DUST MOTES        — 18 fine + bokeh particles
 *   HALATION          — radial red-orange glow around hot pixels (filmic)
 *   CHROMATIC ABER.   — RGB channel offset at frame corners (lens fringing)
 *   ANAMORPHIC FLARE  — horizontal cyan streak fires with each bloom
 *   LIGHT LEAK        — occasional warm gradient sweep (timed to F5 only)
 *   GRAIN STEPS       — 4-frame stepped grain (35mm motion picture)
 *   SCANLINES         — extremely subtle horizontal banding (CRT/film cadence)
 *   VIGNETTE          — radial darken for focal anchor
 *   PHOTO CROSSFADE   — next photo bleeds in 80ms inside the bloom window
 *   CAPTION BREATH    — sub-pixel vertical drift on caption text
 *
 * EMOTIONAL CONTRACT: Aspirational. "Here's what you're going to learn."
 *
 * COLOR REGISTER PER FLASH:
 *   Flash 1 — defect alarm        — red/amber pulse
 *   Flash 2 — reaction urgency    — yellow/amber alert
 *   Flash 3 — federal authority   — cold blue (echoes Act 5)
 *   Flash 4 — alignment success   — yellow → green progression
 *   Flash 5 — industrial confidence — warm amber, golden hour
 *
 * MARCUS DIALOGUE (locked v3.1):
 *   "Catch it on the dipstick — not on the highway."
 *   "React in the moment."
 *   "Survive the Level 1 inspection."
 *   "Back into the dock — without scraping the trailer."
 *   "Operate the liftgate without dropping the load — or yourself."
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

const ACT_DURATION_MS = 22000;
const FLASH_DURATION_MS = 4400;
const BLOOM_DURATION_MS = 120;
const CAPTION_DELAY_MS = 400;
const SVG_DELAY_MS = 600;
const SVG_ENTRANCE_MS = 350;

const FLASHES = [
  { key: 'flash1Engine',     label: 'DEFECT',   register: 'red',   caption: 'Catch it on the dipstick — not on the highway.' },
  { key: 'flash2POV',        label: 'REACT',    register: 'amber', caption: 'Pay attention and react in the moment.' },
  { key: 'flash3Inspection', label: 'DOT',      register: 'cold',  caption: 'Pass your DOT Inspections.' },
  { key: 'flash4Dock',       label: 'DOCK',     register: 'green', caption: 'Back into the dock — without scraping the trailer.' },
  { key: 'flash5Liftgate',   label: 'LIFTGATE', register: 'amber', caption: 'Operate the liftgate without dropping the load — or yourself.' },
];

// Easing utilities
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeOutBack  = (t) => {
  const c1 = 1.70158;
  return 1 + (c1 + 1) * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Act6GameplayMontage = React.memo(function Act6GameplayMontage({
  imageUrls = {},
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('6', elapsedMs);

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

  const rawIndex = Math.floor((elapsedMs || 0) / FLASH_DURATION_MS);
  const flashIndex = Math.max(0, Math.min(4, isFinite(rawIndex) ? rawIndex : 0));
  const localMs = (elapsedMs || 0) - flashIndex * FLASH_DURATION_MS;

  const bloomOpacity = useMemo(() => {
    if (localMs >= BLOOM_DURATION_MS) return 0;
    const peak = 50;
    if (localMs <= peak) return localMs / peak;
    return 1 - (localMs - peak) / (BLOOM_DURATION_MS - peak);
  }, [localMs]);

  // Caption: slide-in (translateY 8px → 0) + opacity, eased
  const captionState = useMemo(() => {
    if (localMs < CAPTION_DELAY_MS) return { opacity: 0, y: 8 };
    const t = Math.min(1, (localMs - CAPTION_DELAY_MS) / 500);
    const e = easeOutCubic(t);
    return { opacity: e, y: lerp(8, 0, e) };
  }, [localMs]);

  const svgEntrance = useMemo(() => {
    if (localMs < SVG_DELAY_MS) return { opacity: 0, scale: 0.85 };
    const t = Math.min(1, (localMs - SVG_DELAY_MS) / SVG_ENTRANCE_MS);
    const eased = easeOutBack(t);
    return { opacity: easeOutCubic(t), scale: 0.85 + eased * 0.15 };
  }, [localMs]);

  // Per-flash Ken Burns motion variation — eliminates the "all-zoom-in" feel.
  // Each flash gets its own camera move, like a real DP would do per shot:
  //   F1 (engine):    push-in into the engine bay (1.00 → 1.06)
  //   F2 (POV deer):  pull-back slightly + slow pan-right (mimics watching the deer pass)
  //   F3 (DOT):       slow push-in toward the driver (1.00 → 1.04 + slight up-tilt)
  //   F4 (dock):      dolly-tilt — push-in + sliding the angle a touch (1.00 → 1.05 + 0.4° tilt)
  //   F5 (liftgate):  slow pull-back to reveal (1.05 → 1.00 — opposite direction)
  const kenBurns = useMemo(() => {
    const t = localMs / FLASH_DURATION_MS;
    const eT = easeOutCubic(t);
    switch (flashIndex) {
      case 0: return { scale: 1.00 + eT * 0.06, x: 0,             y: 0,            rot: 0 };
      case 1: return { scale: 1.04 - eT * 0.02, x: -1.2 + eT * 2, y: 0,            rot: 0 };
      case 2: return { scale: 1.00 + eT * 0.04, x: 0,             y: -eT * 0.8,    rot: 0 };
      case 3: return { scale: 1.00 + eT * 0.05, x: 0,             y: 0,            rot: eT * 0.4 };
      case 4: return { scale: 1.05 - eT * 0.05, x: 0,             y: 0,            rot: 0 };
      default: return { scale: 1.0, x: 0, y: 0, rot: 0 };
    }
  }, [flashIndex, localMs]);

  // For the photo crossfade through bloom: in the LAST 80ms of each flash, we
  // pre-render the NEXT flash's photo on top, fading it in 0 → 1. The bloom
  // covers the actual swap moment so the eye reads it as one continuous reveal,
  // not "flash of black + new photo." When localMs > 4320 (4400 - 80), we are
  // in this overlap window.
  const overlapNextOpacity = useMemo(() => {
    if (flashIndex >= 4) return 0; // last flash; nothing after
    if (localMs < 4320) return 0;
    return Math.min(1, (localMs - 4320) / 80);
  }, [flashIndex, localMs]);

  const svgStyle = {
    opacity: svgEntrance.opacity,
    transform: `scale(${svgEntrance.scale.toFixed(3)})`,
  };

  const flash = FLASHES[flashIndex];
  // F4 is now SVG-only (no photo) — full top-down dock alignment animation.
  // All other flashes use their respective photo.
  const isPhotoFlash = flashIndex !== 3;
  const photoUrl = isPhotoFlash ? (imageUrls[flash.key] || '') : '';

  const photoPositionByFlash = {
    flash1Engine: 'center 40%',
    flash2POV: 'center 40%',
    flash3Inspection: 'center 40%',
    flash4Dock: '72% 50%',
    flash5Liftgate: 'center 45%',
  };

  // Pre-compute next photo info for the crossfade overlap. If the next flash
  // is the synthetic F4 dock (flashIndex+1 === 3), skip crossfade entirely —
  // the bloom + synthetic-yard backdrop handles the cut.
  const nextFlash = flashIndex < 4 ? FLASHES[flashIndex + 1] : null;
  const nextIsPhoto = nextFlash && (flashIndex + 1) !== 3;
  const nextPhotoUrl = nextIsPhoto ? (imageUrls[nextFlash.key] || '') : '';
  const nextPhotoPos = nextIsPhoto ? (photoPositionByFlash[nextFlash.key] || 'center 40%') : 'center 40%';

  // Halation tint per flash — uses the dominant color register, cranked up
  // so the filmic glow is actually visible rather than hiding in the noise.
  const halationTint = useMemo(() => {
    switch (flashIndex) {
      case 0: return 'rgba(255, 90, 60, 0.78)';   // red defect
      case 1: return 'rgba(255, 200, 80, 0.72)';  // amber react
      case 2: return 'rgba(110, 170, 230, 0.65)'; // cold blue DOT
      case 3: return 'rgba(110, 230, 150, 0.65)'; // green dock
      case 4: return 'rgba(255, 170, 80, 0.85)';  // amber liftgate (golden hour)
      default: return 'rgba(255, 200, 130, 0.65)';
    }
  }, [flashIndex]);

  // Anamorphic flare strikes hard during bloom and decays fast; second pulse
  // at flash entry around svg overlay arrival (~700ms) for the "weight settles" feel.
  const flareOpacity = useMemo(() => {
    if (localMs < BLOOM_DURATION_MS) {
      // Primary flare: synchronous with bloom peak, decays slightly slower
      const peak = 50;
      if (localMs <= peak) return localMs / peak * 0.85;
      return Math.max(0, 0.85 * (1 - (localMs - peak) / 250));
    }
    return 0;
  }, [localMs]);

  // Light leak: only fires during Flash 5 (golden hour liftgate) — the warm
  // cinematic moment that earns a dramatic light leak sweep
  const lightLeakOpacity = useMemo(() => {
    if (flashIndex !== 4) return 0;
    if (localMs < 800 || localMs > 3000) return 0;
    const t = (localMs - 800) / 2200;
    // Bell curve peak at middle
    return Math.sin(t * Math.PI) * 0.42;
  }, [flashIndex, localMs]);

  return (
    <div className="a6-stage">
      <style>{ACT6_STYLES}</style>

      {/* GATE WEAVE WRAPPER — film registration micro-jitter (vertical, ~0.3s) */}
      <div className="a6-gate-weave">
        {/* HANDHELD CAMERA WRAPPER — only animates on Flash 2 (REACT moment).
            Other flashes are observational/composed; handheld jitter on those
            reads as "wobbly slideshow" rather than cinematic. The REACT flash
            is the only beat where a real cinematographer would actually use
            handheld — to communicate the driver's adrenaline + reaction. */}
        <div className={`a6-handheld${flashIndex === 1 ? ' a6-handheld-active' : ''}`}>
          {/* Main photo plate with per-flash Ken Burns transform */}
          {isPhotoFlash ? (
            <div
              className="a6-photo a6-photo-current"
              style={{
                backgroundImage: `url("${photoUrl}")`,
                backgroundPosition: photoPositionByFlash[flash.key] || 'center 40%',
                transform: `scale(${kenBurns.scale.toFixed(4)}) translate(${kenBurns.x.toFixed(3)}%, ${kenBurns.y.toFixed(3)}%) rotate(${kenBurns.rot.toFixed(3)}deg)`,
              }}
            />
          ) : (
            // F4 dock — synthetic top-down yard backdrop. The SVG alignment
            // animation in <Flash4Dock /> renders above this on the SVG layer.
            <div className="a6-dock-yard" />
          )}

          {/* Photo crossfade — next flash's photo fades in during the last 80ms
              of the current flash, covered by the bloom. Eliminates flash-of-black.
              Skipped when next flash is non-photo (F4 dock yard SVG). */}
          {nextIsPhoto && overlapNextOpacity > 0 && (
            <div
              className="a6-photo a6-photo-next"
              style={{
                backgroundImage: `url("${nextPhotoUrl}")`,
                backgroundPosition: nextPhotoPos,
                opacity: overlapNextOpacity,
                transform: 'scale(1.0)',
              }}
            />
          )}

          {/* CHROMATIC ABERRATION — RGB channel offset edges (lens fringing) */}
          <div className="a6-chromatic" />

          {/* HALATION — radial film glow tinted to flash register */}
          <div
            className="a6-halation"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, transparent 30%, ${halationTint} 75%, transparent 100%)`,
            }}
          />

          {/* THREE-TIER ATMOSPHERIC HAZE */}
          <div className="a6-haze a6-haze-far"  />
          <div className="a6-haze a6-haze-mid"  />
          <div className="a6-haze a6-haze-near" />

          {/* DUST PARTICLES */}
          <DustParticles />

          {/* VIGNETTE GRADE */}
          <div className="a6-grade" />

          {/* SUBTLE SCANLINES — extremely low-opacity, repeating-linear-gradient */}
          <div className="a6-scanlines" />

          {/* GRAIN — animated film steps */}
          <div className="a6-grain" />

          {/* WARM TINT MULTIPLY — subtle sub-frame warming */}
          <div className="a6-warm-tint" />

          {/* LIGHT LEAK — golden hour sweep on Flash 5 only */}
          {lightLeakOpacity > 0.001 && (
            <div className="a6-light-leak" style={{ opacity: lightLeakOpacity }} />
          )}
        </div>
      </div>

      {/* SVG OVERLAY (per-flash, rAF-driven) */}
      <div className={`a6-svg a6-svg-${flash.register}`} style={svgStyle}>
        {flashIndex === 0 && <Flash1Defect    localMs={localMs} />}
        {flashIndex === 1 && <Flash2React     localMs={localMs} />}
        {flashIndex === 2 && <Flash3DOT       localMs={localMs} />}
        {flashIndex === 3 && <Flash4Dock      localMs={localMs} />}
        {flashIndex === 4 && <Flash5Liftgate  localMs={localMs} />}
      </div>

      <div className="a6-cine top" />
      <div className="a6-cine bot" />

      <div
        className="a6-caption"
        style={{
          opacity: captionState.opacity,
          transform: `translateY(${captionState.y.toFixed(2)}px)`,
        }}
      >
        {flash.caption}
      </div>

      {/* ANAMORPHIC LENS FLARE — horizontal cyan streak fires with bloom */}
      {flareOpacity > 0.001 && (
        <div className="a6-anamorphic" style={{ opacity: flareOpacity }} />
      )}

      {/* WHITE BLOOM */}
      {bloomOpacity > 0.001 && (
        <div className="a6-bloom" style={{ opacity: bloomOpacity }} />
      )}

      <button className="a6-skip-btn" onClick={onSkip} aria-label="Skip act">
        SKIP
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DUST PARTICLES — 12 small drifting motes for atmospheric depth
// ─────────────────────────────────────────────────────────────────────────────
const DustParticles = React.memo(function DustParticles() {
  const particles = [];
  for (let i = 0; i < 12; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed / 233280) * 100;
    const y = ((seed * 7) % 233280) / 233280 * 100;
    const sz = 1 + ((seed * 3) % 100) / 100 * 1.5;
    const dur = 18 + ((seed * 5) % 100) / 100 * 22;
    const delay = -((seed * 11) % 100) / 100 * dur;
    particles.push({ x, y, sz, dur, delay, key: i });
  }
  return (
    <div className="a6-dust">
      {particles.map((p) => (
        <div
          key={p.key}
          className="a6-mote"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.sz}px`,
            height: `${p.sz}px`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 1 — Dipstick scan, locks onto the oil-level reading zone
// Photo: a driver checking the engine oil dipstick at golden hour. The yellow
// dipstick handle is visible upper-center; the metal rod descends to the
// reading tip at lower-center (~42% x, 66% y in frame). Ring scans across the
// engine bay then locks onto the dipstick tip — the moment of "oil's low."
// VO: "Catch it on the dipstick — not on the highway."
// ─────────────────────────────────────────────────────────────────────────────
function Flash1Defect({ localMs }) {
  const lockStart = 1100;
  const lockEnd   = 1300;

  // Final lock target: dipstick reading area — coords manually calibrated by
  // the designer using CALIBRATE_F1_interactive.html.
  const lockX = 61.6;
  const lockY = 54.9;

  let ringX = lockX, ringY = lockY, ringSize = 70, ringPulseSpeed = 0.8;
  let opacity = 0;

  if (localMs >= 200 && localMs < lockStart) {
    const t = (localMs - 200) / (lockStart - 200);
    const phase = Math.floor(t * 3);
    // Scan path: coolant reservoir (upper-left) → engine block (mid-right) → dipstick tip
    const points = [
      { x: 22, y: 30 },
      { x: 65, y: 45 },
      { x: lockX, y: lockY },
    ];
    const p = points[Math.min(2, phase)];
    ringX = p.x; ringY = p.y;
    ringSize = 70;
    ringPulseSpeed = 0.4;
    opacity = clamp(t * 1.5, 0, 1);
  } else if (localMs >= lockStart && localMs < lockEnd) {
    const t = (localMs - lockStart) / (lockEnd - lockStart);
    const e = easeOutBack(t);
    ringX = lockX; ringY = lockY;
    ringSize = lerp(70, 110, e);
    ringPulseSpeed = 0.8;
    opacity = 1;
  } else if (localMs >= lockEnd) {
    ringX = lockX; ringY = lockY;
    ringSize = 110;
    ringPulseSpeed = 1.4;
    opacity = 1;
  }

  const tagState = (() => {
    if (localMs < lockEnd) return { opacity: 0, y: 12 };
    const t = clamp((localMs - lockEnd) / 400, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, y: lerp(12, 0, e) };
  })();

  const pulseT = (localMs % (ringPulseSpeed * 1000)) / (ringPulseSpeed * 1000);
  const pulseScale = 1 + Math.sin(pulseT * Math.PI * 2) * 0.09;
  const pulseOpacity = 0.55 + Math.sin(pulseT * Math.PI * 2) * 0.3;

  return (
    <>
      <div
        className="f1-ring"
        style={{
          left: `${ringX}%`, top: `${ringY}%`,
          width: `${ringSize}px`, height: `${ringSize}px`,
          marginLeft: `-${ringSize / 2}px`,
          marginTop: `-${ringSize / 2}px`,
          opacity,
          transform: `scale(${pulseScale.toFixed(3)})`,
          boxShadow: `
            0 0 ${30 + Math.sin(pulseT * Math.PI * 2) * 10}px rgba(255, 85, 68, ${pulseOpacity}),
            inset 0 0 18px rgba(255, 85, 68, 0.3)
          `,
        }}
      />
      <div
        className="f1-tag"
        style={{
          opacity: tagState.opacity,
          transform: `translate(-50%, ${tagState.y.toFixed(2)}px)`,
        }}
      >
        <span className="label">⚠ DEFECT</span>
        <span className="val">OIL LOW · ADD 2 QUARTS</span>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 2 — REACT punch + bar fill + reaction time roll + deer ring entry
// ─────────────────────────────────────────────────────────────────────────────
function Flash2React({ localMs }) {
  const reactState = (() => {
    if (localMs < 600) return { opacity: 0, scale: 0.5, shakeX: 0 };
    const t = clamp((localMs - 600) / 300, 0, 1);
    const eIn = easeOutBack(t);
    const opacity = clamp(t * 1.5, 0, 1);
    let scale = 0.5 + eIn * 0.65;
    if (t > 0.6) scale = 1.15 - (t - 0.6) / 0.4 * 0.15;
    const shakeMs = localMs - 600;
    const shakeX = shakeMs < 250
      ? Math.sin(shakeMs / 22) * (1 - shakeMs / 250) * 4
      : 0;
    return { opacity, scale, shakeX };
  })();

  const barFillPct = (() => {
    if (localMs < 800) return 0;
    const t = clamp((localMs - 800) / 1500, 0, 1);
    return easeOutQuart(t) * 38;
  })();

  const reactionTime = (() => {
    if (localMs < 800) return 1.20;
    const t = clamp((localMs - 800) / 1500, 0, 1);
    return lerp(1.20, 0.84, easeOutQuart(t));
  })();

  const ringState = (() => {
    if (localMs < 1000) return { opacity: 0, scale: 1.5 };
    const enterT = clamp((localMs - 1000) / 350, 0, 1);
    const e = easeOutBack(enterT);
    const opacity = clamp(enterT * 1.5, 0, 1);
    const enterScale = lerp(1.5, 1, e);
    const pulseT = (localMs % 800) / 800;
    const pulseScale = 1 + Math.sin(pulseT * Math.PI * 2) * 0.12;
    return { opacity, scale: enterScale * pulseScale };
  })();

  const labelOpacity = clamp((localMs - 800) / 400, 0, 1);

  return (
    <>
      <div
        className="f2-react"
        style={{
          opacity: reactState.opacity,
          transform: `translateX(calc(-50% + ${reactState.shakeX.toFixed(2)}px)) scale(${reactState.scale.toFixed(3)})`,
        }}
      >
        REACT
      </div>
      <div className="f2-bar-wrap">
        <div className="f2-bar" style={{ width: `${barFillPct.toFixed(2)}%` }} />
      </div>
      <div className="f2-time" style={{ opacity: labelOpacity }}>
        REACTION · {reactionTime.toFixed(2)}s
      </div>
      <div
        className="f2-deer-ring"
        style={{
          opacity: ringState.opacity,
          transform: `translate(-50%, -50%) scale(${ringState.scale.toFixed(3)})`,
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 3 — Banner slide + points roll + PASS pill scale-bounce
// ─────────────────────────────────────────────────────────────────────────────
function Flash3DOT({ localMs }) {
  const bannerState = (() => {
    if (localMs < 600) return { opacity: 0, y: 60 };
    const t = clamp((localMs - 600) / 500, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: clamp(t * 1.5, 0, 1), y: lerp(60, 0, e) };
  })();

  const pointsCount = (() => {
    if (localMs < 1300) return 0;
    const t = clamp((localMs - 1300) / 1700, 0, 1);
    return Math.floor(easeOutQuart(t) * 37);
  })();

  const passState = (() => {
    if (localMs < 2800) return { opacity: 0, scale: 0.7, glow: 0 };
    const t = clamp((localMs - 2800) / 350, 0, 1);
    const e = easeOutBack(t);
    const opacity = clamp(t * 1.5, 0, 1);
    const scale = lerp(0.7, 1.0, e);
    const glowMs = localMs - 2800;
    const glow = glowMs < 600
      ? (glowMs < 200 ? glowMs / 200 : 1 - (glowMs - 200) / 400)
      : 0;
    return { opacity, scale, glow };
  })();

  return (
    <div
      className="f3-banner"
      style={{
        opacity: bannerState.opacity,
        transform: `translateY(${bannerState.y.toFixed(2)}px)`,
      }}
    >
      <div className="f3-badge">DOT</div>
      <div className="f3-text">
        <div className="title">DOT INSPECTION</div>
        <div className="sub">FMCSA · {pointsCount} POINTS REVIEWED</div>
      </div>
      <div
        className="f3-status"
        style={{
          opacity: passState.opacity,
          transform: `scale(${passState.scale.toFixed(3)})`,
          boxShadow: `0 0 ${20 * passState.glow}px rgba(111, 204, 136, ${0.8 * passState.glow})`,
        }}
      >
        PASS
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 4 — Distance roll + line draws + dial fill + check entry
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// FLASH 4 — Top-down dock alignment animation (SVG only, no photo).
// Aerial view of a box truck backing into a loading dock. Truck silhouette
// translates upward from the bottom of the frame to the dock door over 3s,
// alignment trajectory lines are drawn from the rear of the truck to the
// dock, and a real-time distance counter ticks down from 24.0 ft → 2.4 ft.
// At ~3.3s the alignment dial fills to full and a green "ALIGNED" check
// pulses. Painted yellow dock guide stripes provide depth on the asphalt.
// This sequence reads as gameplay because the truck IS moving in real time.
// ─────────────────────────────────────────────────────────────────────────────
function Flash4Dock({ localMs }) {
  // Distance counter — ticks down from 24.0 ft over 3s (lockEnd ~3000ms)
  const distance = (() => {
    if (localMs < 600) return 24.0;
    const t = clamp((localMs - 600) / 2400, 0, 1);
    return lerp(24.0, 2.4, easeOutQuart(t));
  })();

  // Truck Y position — backs UP toward the dock.
  //   START:  truckY = 680 (full truck visible at frame bottom)
  //   END:    truckY = 216 (rear of truck at TOP of dock door — fully flush)
  //
  // PNG truck is 525px tall; truck rear = top of image (y = truckY - 156),
  // cab front = bottom of image (y = truckY + 369).
  // At final truckY=216: rear=60 (right at the top of the dock door opening
  // which spans y=60-180), cab=585 (still visible mid-frame). The truck has
  // backed all the way into the dock door — visually flush with the door's
  // top edge as if the rear has fully entered the loading bay.
  //
  // SLOWED FURTHER: travel duration extended to 3700ms (was 3200ms) using
  // easeOutCubic (gentler than easeOutQuart) so the truck moves at a more
  // realistic backing pace — slow steady reverse, no fast kick at start.
  const truckY = (() => {
    if (localMs < 600) return 680;
    const t = clamp((localMs - 600) / 3700, 0, 1);
    return lerp(680, 216, easeOutCubic(t));
  })();

  // Truck X drift — REDUCED to 1.5px peak (was 4px). A skilled driver backing
  // straight into a dock makes very minor steering corrections, not noticeable
  // swings. The drift now reads as "subtle realism" instead of "wobble".
  const truckX = (() => {
    if (localMs < 1400) return 0;
    if (localMs < 2000) {
      const t = (localMs - 1400) / 600;
      return easeOutCubic(t) * 1.5;
    }
    if (localMs < 3200) {
      const t = (localMs - 2000) / 1200;
      return 1.5 - easeOutCubic(t) * 1.5;
    }
    return 0;
  })();

  // Dashed alignment trajectory — drawn via stroke-dashoffset
  const lineDrawT = clamp((localMs - 800) / 1400, 0, 1);
  const lineDashOffset = lerp(440, 0, easeOutCubic(lineDrawT));

  // Alignment dial — fills as truck approaches dock. Adjusted timing to match
  // slower 3700ms truck travel (lockEnd at ~4000ms instead of 3500ms).
  const dialAngle = (() => {
    if (localMs < 1500) return 0;
    if (localMs < 4000) {
      const t = (localMs - 1500) / 2500;
      return easeOutCubic(t) * 270;
    }
    if (localMs < 4250) {
      const t = (localMs - 4000) / 250;
      return 270 + easeOutBack(t) * 90;
    }
    return 360;
  })();
  const dialFull = dialAngle >= 359;

  const checkState = (() => {
    if (localMs < 4000) return { opacity: 0, scale: 0.6 };
    const t = clamp((localMs - 4000) / 350, 0, 1);
    const e = easeOutBack(t);
    return { opacity: clamp(t * 1.5, 0, 1), scale: lerp(0.6, 1.0, e) };
  })();

  const dialFillStyle = {
    background: `conic-gradient(from -90deg,
                  ${dialFull ? '#6fcc88' : '#ffd24a'} 0deg ${dialAngle}deg,
                  rgba(80,80,80,0.3) ${dialAngle}deg 360deg)`,
    boxShadow: `0 0 ${dialFull ? 20 : 14}px rgba(${dialFull ? '111, 204, 136' : '255, 210, 74'}, ${dialFull ? 0.55 : 0.4})`,
  };

  // ALIGNED label appears at the end (after truck arrives at dock at ~4300ms)
  const alignedOpacity = clamp((localMs - 4100) / 300, 0, 1);

  // ── REVERSE ALARM PULSE RINGS ──
  // Pulses STOP when truck reaches dock (localMs > 4000) — replaced by docked confirmation.
  const reverseActive = localMs >= 600 && localMs < 4000;
  const pulse = (offsetMs) => {
    if (!reverseActive) return { scale: 0, opacity: 0 };
    const cycleMs = 1200;
    const phase = ((localMs - 600 + offsetMs) % cycleMs) / cycleMs; // 0..1
    if (phase < 0 || phase > 0.75) return { scale: 0, opacity: 0 };
    const t = phase / 0.75;
    return { scale: 0.3 + t * 2.7, opacity: 0.85 * (1 - t) };
  };
  const pulseA = pulse(0);
  const pulseB = pulse(400);
  const pulseC = pulse(800);

  // ── TAILLIGHT PULSE ──
  const reverseLightOn = reverseActive ? 0.95 : 0.0;
  const brakeLightPulse = (() => {
    if (localMs < 4000) return 0;
    // Pulse 3 times after stopping
    const t = (localMs - 4000) / 400;
    if (t > 1.0) return 0.7; // settle (less time available before flash ends)
    return Math.abs(Math.sin(t * Math.PI * 2.5)) * 0.95;
  })();

  // ── TIRE SKID TRAILS ──
  // Length matches the slower 3700ms travel.
  const skidProgress = clamp((localMs - 600) / 3700, 0, 1);
  const skidLength = skidProgress * 460; // truck travels 464 units (680→216)

  return (
    <>
      <svg className="f4-svg" viewBox="0 0 480 1040" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="f4-trajectory-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6fcc88" stopOpacity="0.95" />
            <stop offset="60%"  stopColor="#ffd24a" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffd24a" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="f4-paint-stripe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e8c869" stopOpacity="0.0" />
            <stop offset="35%"  stopColor="#e8c869" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#d4a93f" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="f4-skid-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#000" stopOpacity="0.0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="f4-dock-light" cx="50%" cy="0%" r="60%">
            <stop offset="0%"   stopColor="#ffd28e" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffd28e" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="f4-pulse-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd24a" stopOpacity="0.0" />
            <stop offset="60%"  stopColor="#ffd24a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffaa1a" stopOpacity="0.0" />
          </radialGradient>
          <radialGradient id="f4-tail-red" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ff4422" stopOpacity="1" />
            <stop offset="60%"  stopColor="#cc1a08" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#cc1a08" stopOpacity="0.0" />
          </radialGradient>
          <radialGradient id="f4-tail-white" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#fffaee" stopOpacity="1" />
            <stop offset="60%"  stopColor="#ffe4a0" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffe4a0" stopOpacity="0.0" />
          </radialGradient>
          <pattern id="f4-asphalt" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#1a1c1f" />
            <circle cx="2" cy="2" r="0.4" fill="#2a2c30" />
            <circle cx="4.5" cy="4.5" r="0.3" fill="#2a2c30" />
            <circle cx="5" cy="1.5" r="0.25" fill="#15171a" />
          </pattern>
          <pattern id="f4-warning-stripes" x="0" y="0" width="14" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="14" height="10" fill="#1a1a1a" />
            <rect x="0" y="0" width="7" height="10" fill="#e8b823" />
          </pattern>
        </defs>

        {/* ── ASPHALT YARD BASE ── */}
        <rect width="480" height="1040" fill="url(#f4-asphalt)" />

        {/* ── DOCK BUILDING (top of frame) ── */}
        {/* Building wall background */}
        <rect x="0" y="0" width="480" height="32" fill="#0e1014" />
        {/* Building wall above platform — corrugated metal feel */}
        <rect x="0" y="32" width="480" height="100" fill="#1f2226" />
        <g opacity="0.35" stroke="#0a0c0e" strokeWidth="0.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <line key={`w${i}`} x1={i * 24} y1="32" x2={i * 24} y2="132" />
          ))}
        </g>
        {/* Concrete loading platform */}
        <rect x="0" y="132" width="480" height="80" fill="#2c2e32" />
        {/* Dock door opening (truck backs into this) — recessed shadow */}
        <rect x="178" y="58" width="124" height="124" fill="#000" opacity="0.85" />
        <rect x="180" y="60" width="120" height="120" fill="#0a0c0e" />
        {/* Dock door interior glow (warm amber, suggests workers + light inside) */}
        <rect x="180" y="60" width="120" height="120" fill="url(#f4-dock-light)" />
        {/* Dock leveler plate (the metal flap that bridges truck rear to platform) */}
        <rect x="184" y="180" width="112" height="14" fill="#3a3c3f" />
        <line x1="184" y1="184" x2="296" y2="184" stroke="#1a1c1f" strokeWidth="0.8" />
        <line x1="184" y1="188" x2="296" y2="188" stroke="#1a1c1f" strokeWidth="0.8" />
        {/* Warning stripes painted on dock face below the door */}
        <rect x="170" y="194" width="140" height="14" fill="url(#f4-warning-stripes)" opacity="0.75" />
        {/* Concrete platform edge highlight */}
        <line x1="0" y1="212" x2="480" y2="212" stroke="#3a3d42" strokeWidth="2" />
        <line x1="0" y1="214" x2="480" y2="214" stroke="#16181b" strokeWidth="1" />
        {/* Loading dock bumpers (rubber pads either side of the door) */}
        <rect x="172" y="200" width="14" height="14" fill="#0a0a0a" rx="2" />
        <rect x="294" y="200" width="14" height="14" fill="#0a0a0a" rx="2" />
        {/* Dock door label */}
        <text x="240" y="22" textAnchor="middle"
              fontFamily="IBM Plex Mono, monospace" fontSize="11"
              fill="#9da1a8" letterSpacing="2">DOCK 4</text>
        {/* Second-story building windows (tiny, suggests warehouse depth) */}
        <g opacity="0.65">
          <rect x="40"  y="52" width="20" height="14" fill="#3a4d6a" />
          <rect x="80"  y="52" width="20" height="14" fill="#2a3550" />
          <rect x="380" y="52" width="20" height="14" fill="#3a4d6a" />
          <rect x="420" y="52" width="20" height="14" fill="#2a3550" />
        </g>
        {/* Dock-door brand placards */}
        <rect x="40" y="148" width="80" height="18" fill="#0a0c0e" stroke="#3a3c40" strokeWidth="0.5" rx="1" />
        <text x="80" y="161" textAnchor="middle"
              fontFamily="IBM Plex Mono, monospace" fontSize="9"
              fill="#7d8088" letterSpacing="1.5">RECEIVING</text>
        <rect x="360" y="148" width="80" height="18" fill="#0a0c0e" stroke="#3a3c40" strokeWidth="0.5" rx="1" />
        <text x="400" y="161" textAnchor="middle"
              fontFamily="IBM Plex Mono, monospace" fontSize="9"
              fill="#7d8088" letterSpacing="1.5">BAY 04</text>

        {/* ── PAINTED YELLOW GUIDE STRIPES (perspective converging) ── */}
        <g opacity="0.55">
          <path d="M 130 1010 L 200 220" stroke="url(#f4-paint-stripe)"
                strokeWidth="6" strokeLinecap="round" strokeDasharray="20 16" />
          <path d="M 350 1010 L 280 220" stroke="url(#f4-paint-stripe)"
                strokeWidth="6" strokeLinecap="round" strokeDasharray="20 16" />
        </g>

        {/* ── TIRE SKID TRAILS (drawn behind the truck as it moves) ── */}
        {/* Two parallel light-gray traces showing where the truck has been.
            Wheels on the PNG sit at ~truckY+330 (near cab/rear-axle).
            Skid lines extend from there DOWNWARD to truck's start position (680). */}
        {skidLength > 4 && (
          <g opacity="0.32">
            <line x1={232 + truckX} y1={truckY + 360}
                  x2={232 + truckX} y2={Math.min(1010, truckY + 360 + (680 - truckY))}
                  stroke="#000" strokeWidth="3" strokeLinecap="round" />
            <line x1={248 + truckX} y1={truckY + 360}
                  x2={248 + truckX} y2={Math.min(1010, truckY + 360 + (680 - truckY))}
                  stroke="#000" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}

        {/* ── ALIGNMENT TRAJECTORY (drawn live via dashoffset) ── */}
        {/* Lines project from the rear of the truck (y=-30 above truck-anchor)
            UP to the dock door area (y=-(truckY-180), i.e. dock door's bottom
            edge in scene coords). The negation mapping: rear is in truck-local
            coords, dock is in scene coords, so we offset by truckY.
            Formula: y2 = -(truckY - 180) ensures it always points UP. */}
        <g style={{ transform: `translate(${truckX.toFixed(2)}px, ${truckY.toFixed(2)}px)` }}>
          <line x1="200" y1="-30" x2="220" y2={(180 - truckY).toFixed(0)}
                stroke="url(#f4-trajectory-grad)" strokeWidth="2.5"
                strokeDasharray="440" strokeDashoffset={lineDashOffset}
                strokeLinecap="round" opacity="0.85" />
          <line x1="280" y1="-30" x2="260" y2={(180 - truckY).toFixed(0)}
                stroke="url(#f4-trajectory-grad)" strokeWidth="2.5"
                strokeDasharray="440" strokeDashoffset={lineDashOffset}
                strokeLinecap="round" opacity="0.85" />
        </g>

        {/* ── REVERSE ALARM PULSE RINGS (radiating from rear of truck) ── */}
        {/* Three staggered pulses create continuous beep cadence. Each ring
            originates at the rear-center of the truck (which is the TOP since
            truck is backing up — top-down rear is at y=truckY-150 in scene coords). */}
        {[pulseA, pulseB, pulseC].map((p, i) => p.opacity > 0.001 && (
          <circle key={`pulse-${i}`}
            cx={240 + truckX}
            cy={truckY - 150}
            r={50 * p.scale}
            fill="none"
            stroke="#ffd24a"
            strokeWidth="2"
            opacity={p.opacity}
          />
        ))}
        {/* Soft amber glow at rear (cumulative pulse halo) */}
        {reverseActive && (
          <circle
            cx={240 + truckX}
            cy={truckY - 150}
            r="60"
            fill="url(#f4-pulse-grad)"
            opacity={0.5 + Math.abs(Math.sin(localMs * 0.005)) * 0.3}
          />
        )}

        {/* ── BOX TRUCK — REAL FREIGHTLINER M2 106 TOP-DOWN PNG ── */}
        {/* Replaces the prior SVG silhouette with the actual rendered box-truck
            image (rotated so cab points DOWN/AWAY from dock and rear of box
            faces UP toward the dock — truck is reversing). PNG sourced from
            the project GitHub repo at:
            Freightliner M2 106 no background/freightliner-m2-106-top.png
            Loaded via window.A6_TRUCK_TOP. Aspect ratio 1349/360 ≈ 3.75.
            At width 140, the image is ~525 tall — proper 26ft proportions. */}
        <g style={{
          transform: `translate(${truckX.toFixed(2)}px, ${truckY.toFixed(2)}px)`,
        }}>
          {/* Cast shadow under the truck (visible at cab/wheels area) */}
          <ellipse cx="240" cy="320" rx="78" ry="14" fill="#000" opacity="0.42" />
          {/* The truck PNG itself */}
          {typeof window !== 'undefined' && window.A6_TRUCK_TOP && (
            <image
              href={window.A6_TRUCK_TOP}
              x="170"
              y="-156"
              width="140"
              height="525"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          {/* REAR LIGHT BAR — backing white lights + red brake/tail lights.
              Positioned at the rear edge (top of PNG) where lights would be on
              an actual M2 106 rear roll-up door panel. */}
          {/* Reverse white lights (innermost) */}
          <circle cx="220" cy="-148" r="4.5" fill="url(#f4-tail-white)" opacity={reverseLightOn} />
          <circle cx="260" cy="-148" r="4.5" fill="url(#f4-tail-white)" opacity={reverseLightOn} />
          {/* Red taillights (outer) — pulse on stop */}
          <circle cx="186" cy="-148" r="4.5" fill="url(#f4-tail-red)" opacity={0.55 + brakeLightPulse * 0.45} />
          <circle cx="294" cy="-148" r="4.5" fill="url(#f4-tail-red)" opacity={0.55 + brakeLightPulse * 0.45} />
        </g>
      </svg>

      {/* ── BACKUP CAMERA HUD FRAME (corner brackets — game-style overlay) ── */}
      {/* Subtle indication that the player is seeing this as if through a
          backup camera. Four bracket marks at the frame corners, dimmed. */}
      <div className="f4-hud-corners">
        <span className="f4-hud-corner tl" />
        <span className="f4-hud-corner tr" />
        <span className="f4-hud-corner bl" />
        <span className="f4-hud-corner br" />
      </div>

      {/* Distance counter (top-right of frame) */}
      <div className="f4-counter">
        <div className="label">DISTANCE</div>
        <div className="val">{distance.toFixed(1)}</div>
        <div className="unit">FEET</div>
      </div>

      {/* Alignment dial */}
      <div className="f4-dial" style={dialFillStyle}>
        <div className="check" style={{
          opacity: checkState.opacity,
          transform: `scale(${checkState.scale.toFixed(3)})`,
          color: dialFull ? '#6fcc88' : '#ffd24a',
        }}>✓</div>
      </div>

      {/* ALIGNED label — appears at end of approach */}
      <div className="f4-aligned" style={{ opacity: alignedOpacity }}>
        ALIGNED
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 5 — Liftgate load-vs-capacity bar + cycle counter
// PSI was wrong context (air-brake metric, not liftgate). Real liftgate ops
// metric is: load weight / gate capacity, with green/amber/red zones, plus
// daily cycle count (battery awareness — 10-15 cycles is the typical ceiling
// before the truck batteries can't keep up). 1,847 LB load / 3,000 LB
// capacity = 62% (amber zone — manageable but at the upper-mid range).
// ─────────────────────────────────────────────────────────────────────────────
function Flash5Liftgate({ localMs }) {
  // Load weight rolls 0 → 1,847 LB over 1.8s
  const load = (() => {
    if (localMs < 600) return 0;
    if (localMs < 2400) {
      const t = (localMs - 600) / 1800;
      return Math.round(easeOutQuart(t) * 1847);
    }
    return 1847;
  })();

  // Capacity bar fill — synchronizes with load (0 → 62% over 1.8s)
  const fillPct = (load / 3000) * 100;

  // Card opacity — slide in from right
  const cardState = (() => {
    if (localMs < 600) return { opacity: 0, x: 20 };
    const t = clamp((localMs - 600) / 500, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, x: lerp(20, 0, e) };
  })();

  const loadOpacity = clamp((localMs - 1000) / 400, 0, 1);

  // Color band: 0-50% green, 50-80% amber, 80-100% red
  const fillColor = fillPct < 50 ? '#6fcc88' : fillPct < 80 ? '#ffd24a' : '#ff6b4a';

  return (
    <>
      {/* GATE LOAD card — top-right */}
      <div
        className="f5-gate-card"
        style={{
          opacity: cardState.opacity,
          transform: `translateX(${cardState.x.toFixed(2)}px)`,
        }}
      >
        <div className="f5-gc-header">
          <span className="f5-gc-label">LIFTGATE LOAD</span>
          <span className="f5-gc-cap">/ 3,000 LB CAP</span>
        </div>
        <div className="f5-gc-bar-track">
          <div
            className="f5-gc-bar-fill"
            style={{
              width: `${fillPct.toFixed(1)}%`,
              background: `linear-gradient(90deg, #6fcc88 0%, #6fcc88 50%, #ffd24a 75%, ${fillColor} 100%)`,
              boxShadow: `0 0 12px ${fillColor}88`,
            }}
          />
          {/* Tick marks for 50% and 80% capacity boundaries */}
          <div className="f5-gc-tick" style={{ left: '50%' }} />
          <div className="f5-gc-tick" style={{ left: '80%' }} />
        </div>
        <div className="f5-gc-readout">
          <span className="f5-gc-load">{load.toLocaleString()}</span>
          <span className="f5-gc-unit">LB</span>
          <span className="f5-gc-pct">{fillPct.toFixed(0)}%</span>
        </div>
      </div>
      {/* CYCLE chip removed per design review — battery-cycle awareness is a
          fleet-management concern, not a single-delivery metric. GATE LOAD
          alone tells the safety story (overload kills) and the photo carries
          the rest of the action. The lower-left area is intentionally clean. */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const ACT6_STYLES = `
.a6-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* GATE WEAVE — film registration jitter (vertical sub-pixel, ~0.3s period).
   Real motion picture film "weaves" slightly through the gate of the projector
   because the perforations don't seat with mathematical perfection. Period
   should NOT be a multiple of the handheld jitter to avoid visible patterns. */
/* GATE WEAVE — disabled per user request. The wrapper is kept for layout but
   no animation: only F2 (React) is allowed to shake the screen. */
.a6-gate-weave {
  position: absolute;
  inset: 0;
  z-index: 1;
}
@keyframes a6GateWeave {
  0%, 100% { transform: translateY(0); }
  20%      { transform: translateY(-0.4px); }
  40%      { transform: translateY(0.3px); }
  60%      { transform: translateY(-0.2px); }
  80%      { transform: translateY(0.4px); }
}

/* HANDHELD CAMERA WRAPPER — only enabled on Flash 2 (REACT) via active class */
.a6-handheld {
  position: absolute;
  inset: -1.5%;
  z-index: 1;
  will-change: transform;
}
.a6-handheld-active {
  animation: a6Handheld 13.7s ease-in-out infinite;
}
@keyframes a6Handheld {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  17%  { transform: translate(0.35%, -0.18%) rotate(0.08deg); }
  35%  { transform: translate(-0.22%, 0.31%) rotate(-0.06deg); }
  52%  { transform: translate(0.18%, 0.12%) rotate(0.04deg); }
  68%  { transform: translate(-0.31%, -0.22%) rotate(-0.07deg); }
  84%  { transform: translate(0.12%, 0.28%) rotate(0.05deg); }
}

/* PHOTO LAYER */
.a6-photo {
  position: absolute;
  inset: 0;
  background-color: #050402;
  background-size: cover;
  background-repeat: no-repeat;
  transform-origin: center center;
  will-change: transform, filter;
  filter: blur(0px);
}
.a6-photo-current {
  z-index: 1;
  animation: a6FocusBreath 9s ease-in-out infinite;
}
.a6-photo-next {
  z-index: 2;
  /* No focus breath on the incoming photo — avoid double-blur during overlap */
}
@keyframes a6FocusBreath {
  0%, 100% { filter: blur(0px); }
  50%      { filter: blur(0.55px); }
}

/* CHROMATIC ABERRATION — RGB channel offset, strongest at corners.
   Implemented as a layered radial gradient that simulates the red/cyan fringing
   around bright frame-edge highlights. Cranked to be visibly cinematic without
   becoming a stylistic gimmick. */
.a6-chromatic {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 80% at 0% 0%,
      rgba(255, 60, 50, 0.18) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 0%,
      rgba(50, 180, 255, 0.18) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 0% 100%,
      rgba(50, 180, 255, 0.16) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 100%,
      rgba(255, 60, 50, 0.16) 0%, transparent 40%);
  mix-blend-mode: screen;
}

/* HALATION — radial film glow tinted to flash register.
   Cranked: 0.55 base opacity (was 0.35), wider blur radius, screen blend.
   The tint color is set inline per flash. */
.a6-halation {
  position: absolute;
  inset: -10%;
  z-index: 4;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(40px);
  opacity: 0.6;
  will-change: background;
}

/* THREE-TIER ATMOSPHERIC HAZE — Hurlbut diffusion technique.
   Each layer drifts at a different speed creating depth — far layer slow, near
   layer slightly faster. Using SVG turbulence gives much more textural depth
   than a plain linear gradient (the v2 implementation). */
.a6-haze {
  position: absolute;
  inset: -20%;
  z-index: 5;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.a6-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.025' numOctaves='3' seed='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 0.18 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 200% 150%;
  opacity: 0.22;
  animation: a6HazeFar 38s linear infinite;
  filter: blur(12px);
}
.a6-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.025 0.04' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.75  0 0 0 0.22 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 180% 130%;
  opacity: 0.20;
  animation: a6HazeMid 26s linear infinite;
  filter: blur(8px);
}
.a6-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.06' numOctaves='2' seed='13'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.82  0 0 0 0.16 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 160% 120%;
  opacity: 0.16;
  animation: a6HazeNear 18s linear infinite;
  filter: blur(5px);
}
@keyframes a6HazeFar {
  0%   { transform: translateX(-2%) translateY(0%) scale(1.02); }
  50%  { transform: translateX(2%) translateY(-1%) scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%) scale(1.02); }
}
@keyframes a6HazeMid {
  0%   { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%) scale(1.06); }
  100% { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
}
@keyframes a6HazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
  50%  { transform: translateX(2%) translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
}

/* DUST PARTICLE FIELD */
.a6-dust {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}
.a6-mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 210, 0.85) 0%, rgba(255, 240, 210, 0) 70%);
  box-shadow: 0 0 4px rgba(255, 240, 210, 0.4);
  will-change: transform, opacity;
  animation-name: a6MoteDrift;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  opacity: 0;
}
@keyframes a6MoteDrift {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.55; }
  50%  { transform: translate(20px, -40px); opacity: 0.65; }
  90%  { opacity: 0.4; }
  100% { transform: translate(40px, -80px); opacity: 0; }
}

/* VIGNETTE GRADE */
.a6-grade {
  position: absolute;
  inset: 0;
  z-index: 7;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%);
}

/* SUBTLE SCANLINES — extremely low opacity, simulates film/CRT cadence */
.a6-scanlines {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.0) 0px,
    rgba(0, 0, 0, 0.0) 2px,
    rgba(0, 0, 0, 0.08) 3px,
    rgba(0, 0, 0, 0.0) 4px
  );
  mix-blend-mode: multiply;
  opacity: 0.4;
}

/* GRAIN — animated film steps */
.a6-grain {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.55;
  animation: a6GrainShift 0.5s steps(4) infinite;
}
@keyframes a6GrainShift {
  0%   { background-position: 0 0; }
  25%  { background-position: 23px -41px; }
  50%  { background-position: -67px 11px; }
  75%  { background-position: 31px 53px; }
  100% { background-position: 0 0; }
}

/* WARM TINT MULTIPLY — subtle sub-frame warming for unified mood */
.a6-warm-tint {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(80, 40, 10, 0.07) 0%,
    rgba(40, 20, 5, 0.04) 50%,
    rgba(10, 5, 2, 0.13) 100%);
  mix-blend-mode: multiply;
}

/* LIGHT LEAK — golden hour warm sweep that fires during Flash 5 only.
   Shaped like a real light leak: angled gradient with soft edges and a
   blown-out core, screen-blended over the photo. Driven by inline opacity. */
.a6-light-leak {
  position: absolute;
  inset: -10%;
  z-index: 11;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 35% at 90% 25%,
      rgba(255, 230, 170, 0.85) 0%,
      rgba(255, 200, 120, 0.45) 25%,
      rgba(255, 170, 80, 0.15) 50%,
      transparent 70%);
  mix-blend-mode: screen;
  filter: blur(6px);
  will-change: opacity;
}

/* ANAMORPHIC LENS FLARE — horizontal cyan streak that fires with each bloom.
   Real anamorphic lenses produce a horizontal blue/cyan streak when a hot
   point of light hits the front element. The streak is wider than tall, has
   a bright sharp core, and fades fast at the edges. */
.a6-anamorphic {
  position: absolute;
  left: -10%;
  right: -10%;
  top: 50%;
  height: 8px;
  margin-top: -4px;
  z-index: 85;
  pointer-events: none;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(120, 200, 255, 0.4) 15%,
    rgba(180, 230, 255, 0.95) 50%,
    rgba(120, 200, 255, 0.4) 85%,
    transparent 100%);
  filter: blur(2px);
  box-shadow: 0 0 60px rgba(120, 200, 255, 0.55);
  mix-blend-mode: screen;
  will-change: opacity;
}
.a6-anamorphic::after {
  content: '';
  position: absolute;
  left: 30%;
  right: 30%;
  top: -8px;
  bottom: -8px;
  background: radial-gradient(ellipse,
    rgba(220, 240, 255, 0.7) 0%,
    rgba(140, 200, 255, 0.3) 30%,
    transparent 70%);
  filter: blur(8px);
}

/* SVG OVERLAY CONTAINER */
.a6-svg {
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  transform-origin: center center;
  will-change: opacity, transform;
}

/* CINEMA BARS */
.a6-cine {
  position: absolute;
  left: 0; right: 0;
  height: 32px;
  background: #000;
  z-index: 80;
}
.a6-cine.top { top: 0; }
.a6-cine.bot { bottom: 0; }

/* CAPTION */
.a6-caption {
  position: absolute;
  left: 24px; right: 24px;
  bottom: 56px;
  z-index: 70;
  text-align: center;
  color: #f5d29a;
  font-family: 'Outfit', sans-serif;
  font-size: 17px;
  font-weight: 500;
  line-height: 1.3;
  letter-spacing: 0.005em;
  text-shadow:
    0 0 12px rgba(0,0,0,0.95),
    0 2px 8px rgba(0,0,0,0.8),
    0 0 20px rgba(255, 200, 130, 0.15);
  will-change: opacity, transform;
}

/* WHITE-FLASH BLOOM */
.a6-bloom {
  position: absolute;
  inset: 0;
  z-index: 90;
  background: #fff;
  pointer-events: none;
  will-change: opacity;
}

/* SKIP BUTTON */
.a6-skip-btn {
  position: absolute;
  bottom: 12px;
  right: 16px;
  z-index: 100;
  background: rgba(0,0,0,0.5);
  color: rgba(245, 210, 154, 0.85);
  border: 1px solid rgba(245, 210, 154, 0.35);
  border-radius: 4px;
  padding: 8px 14px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
  min-height: 44px;
}
.a6-skip-btn:hover, .a6-skip-btn:active {
  background: rgba(0,0,0,0.7);
  color: #f5d29a;
}

/* FLASH 1 — Engine bay defect callout */
.f1-ring {
  position: absolute;
  border: 2.5px solid #ff5544;
  border-radius: 50%;
  will-change: opacity, transform, box-shadow, left, top, width, height;
}
.f1-ring::after {
  content: '';
  position: absolute;
  inset: -8px;
  border: 1px solid rgba(255, 85, 68, 0.45);
  border-radius: 50%;
}
.f1-tag {
  position: absolute;
  left: 50%; top: 80%;
  background: rgba(20, 8, 8, 0.92);
  border: 1px solid rgba(255, 85, 68, 0.6);
  border-radius: 3px;
  padding: 8px 14px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #ffd0c4;
  white-space: nowrap;
  will-change: opacity, transform;
}
.f1-tag .label { color: #ff8877; font-weight: 600; }
.f1-tag .val   { color: #f5d29a; margin-left: 8px; }

/* FLASH 2 — REACT prompt + hazard ring + reaction bar.
   Ring position calibrated by manual selection — sits over the deer/hazard. */
.f2-deer-ring {
  position: absolute;
  left: 78.5%; top: 39.6%;
  width: 56px; height: 56px;
  border: 2px solid rgba(255, 220, 90, 0.95);
  border-radius: 50%;
  box-shadow: 0 0 22px rgba(255, 200, 60, 0.6);
  will-change: opacity, transform;
}
.f2-react {
  position: absolute;
  left: 50%; top: 18%;
  font-family: 'Anton', sans-serif;
  font-size: 56px;
  letter-spacing: 0.18em;
  color: #ffd24a;
  text-shadow:
    0 0 24px rgba(255, 200, 60, 0.7),
    0 0 8px #000,
    0 4px 12px rgba(0,0,0,0.9);
  will-change: opacity, transform;
}
.f2-bar-wrap {
  position: absolute;
  left: 18%; right: 18%;
  top: 30%;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}
.f2-bar {
  height: 100%;
  background: linear-gradient(90deg, #ffd24a, #ff8844 70%, #ff4422);
  box-shadow: 0 0 12px rgba(255, 180, 50, 0.6);
  will-change: width;
}
.f2-time {
  position: absolute;
  left: 18%;
  top: calc(30% + 14px);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  color: #f5d29a;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
  will-change: opacity;
}

/* FLASH 3 — DOT INSPECTION banner */
.f3-banner {
  position: absolute;
  left: 0; right: 0;
  bottom: 16%;
  padding: 14px 20px;
  background: rgba(8, 14, 28, 0.88);
  border-top: 1px solid rgba(120, 170, 220, 0.4);
  border-bottom: 1px solid rgba(120, 170, 220, 0.4);
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  will-change: opacity, transform;
}
.f3-badge {
  flex-shrink: 0;
  width: 38px; height: 38px;
  border: 1.5px solid #b8d0e8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b8d0e8;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  line-height: 1;
  background: radial-gradient(circle at 30% 30%, rgba(120,170,220,0.15), transparent 60%);
}
.f3-text { flex: 1; }
.f3-text .title {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.18em;
  color: #d8e8fa;
  font-weight: 600;
  line-height: 1;
}
.f3-text .sub {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #8fa8c8;
  margin-top: 4px;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.f3-status {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #6fcc88;
  border: 1px solid #6fcc88;
  border-radius: 2px;
  padding: 4px 8px;
  background: rgba(70, 140, 90, 0.12);
  will-change: opacity, transform, box-shadow;
}

/* FLASH 4 — Dock alignment overlay */
/* Synthetic dock yard backdrop — dark asphalt with subtle texture, replaces
   the photo for F4 only. Sits behind the SVG layer at z=1. */
.a6-dock-yard {
  position: absolute; inset: 0;
  z-index: 1;
  background:
    radial-gradient(ellipse at 50% 18%, rgba(40, 50, 65, 0.7) 0%, transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(15, 18, 22, 0.95) 0%, transparent 60%),
    linear-gradient(180deg, #14171b 0%, #1a1d22 50%, #0c0e11 100%);
}

.f4-svg { position: absolute; inset: 0; z-index: 1; }

/* Backup-camera HUD corner brackets — game UI register, suggests "you are
   looking through the in-cab backup camera". Subtle but distinctive. */
.f4-hud-corners {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}
.f4-hud-corner {
  position: absolute;
  width: 24px; height: 24px;
  border: 2px solid rgba(245, 210, 154, 0.55);
}
.f4-hud-corner.tl { top: 8%;    left:  6%; border-right: none; border-bottom: none; }
.f4-hud-corner.tr { top: 8%;    right: 6%; border-left:  none; border-bottom: none; }
.f4-hud-corner.bl { bottom: 16%; left:  6%; border-right: none; border-top:    none; }
.f4-hud-corner.br { bottom: 16%; right: 6%; border-left:  none; border-top:    none; }

.f4-counter {
  position: absolute;
  top: 14%; right: 6%;
  z-index: 5;
  background: rgba(8, 14, 28, 0.9);
  border: 1px solid rgba(255, 220, 90, 0.45);
  padding: 10px 14px;
  border-radius: 3px;
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
}
.f4-counter .label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #b8b09a;
  margin-bottom: 4px;
}
.f4-counter .val {
  font-size: 28px;
  font-weight: 600;
  color: #ffd24a;
  letter-spacing: 0.05em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.f4-counter .unit {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}
.f4-dial {
  position: absolute;
  right: 6%; bottom: 22%;
  z-index: 5;
  width: 60px; height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: background, box-shadow;
}
.f4-dial::before {
  content: '';
  position: absolute;
  inset: 5px;
  background: rgba(8, 14, 28, 0.95);
  border-radius: 50%;
}
.f4-dial .check {
  position: relative;
  font-size: 22px;
  font-weight: 600;
  z-index: 1;
  font-family: 'IBM Plex Mono', monospace;
  will-change: opacity, transform;
}
.f4-aligned {
  position: absolute;
  bottom: 22%;
  left: 6%;
  z-index: 5;
  background: rgba(20, 50, 30, 0.85);
  border: 1px solid #6fcc88;
  border-radius: 3px;
  padding: 8px 14px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.22em;
  color: #6fcc88;
  font-weight: 600;
  box-shadow: 0 0 18px rgba(111, 204, 136, 0.35);
  will-change: opacity;
}

/* FLASH 5 — Liftgate gate-load capacity bar + cycle chip
   Replaces the prior PSI gauge (wrong context — air-brake metric).
   Real liftgate ops metric is load weight vs gate capacity, with cycle
   count for battery awareness. */

/* Main GATE LOAD card — top-right of frame */
.f5-gate-card {
  position: absolute;
  top: 13%; right: 6%; left: 22%;
  z-index: 5;
  background: rgba(8, 14, 28, 0.92);
  border: 1px solid rgba(245, 210, 154, 0.35);
  border-radius: 3px;
  padding: 10px 14px;
  font-family: 'IBM Plex Mono', monospace;
  will-change: opacity, transform;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.f5-gc-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.f5-gc-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #f5d29a;
  font-weight: 600;
}
.f5-gc-cap {
  font-size: 8.5px;
  letter-spacing: 0.14em;
  color: #888;
}
.f5-gc-bar-track {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(245, 210, 154, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}
.f5-gc-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 2px;
  transition: width 60ms linear;
  will-change: width, background, box-shadow;
}
.f5-gc-tick {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 1px;
  background: rgba(255, 255, 255, 0.3);
  pointer-events: none;
}
.f5-gc-readout {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.f5-gc-load {
  font-size: 18px;
  font-weight: 600;
  color: #f5d29a;
  letter-spacing: 0.03em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.f5-gc-unit {
  font-size: 10px;
  color: #888;
  margin-right: auto;
}
.f5-gc-pct {
  font-size: 13px;
  color: #ffd24a;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
}

/* CYCLE chip — small lower-left indicator (battery-cycle awareness) */
.f5-cycle {
  position: absolute;
  bottom: 22%;
  left: 6%;
  z-index: 5;
  background: rgba(8, 14, 28, 0.88);
  border: 1px solid rgba(255, 200, 80, 0.4);
  border-radius: 3px;
  padding: 6px 10px;
  font-family: 'IBM Plex Mono', monospace;
  display: flex;
  align-items: baseline;
  gap: 5px;
  will-change: opacity, transform;
  transform-origin: left center;
  box-shadow: 0 0 10px rgba(255, 200, 80, 0.18);
}
.f5-cy-label {
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: #b8b09a;
}
.f5-cy-num {
  font-size: 18px;
  font-weight: 700;
  color: #ffd24a;
  letter-spacing: 0.04em;
  line-height: 1;
}
.f5-cy-of {
  font-size: 9px;
  color: #888;
  letter-spacing: 0.1em;
}

/* REDUCED MOTION */
@media (prefers-reduced-motion: reduce) {
  .a6-handheld, .a6-photo, .a6-grain, .a6-haze, .a6-mote {
    animation: none !important;
  }
}
`;

export default Act6GameplayMontage;
