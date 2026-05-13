/**
 * Act 7 — The Decisions That Build a Company (16s) — v2 CINEMATIC UPGRADE
 *
 * v1 had no atmospheric layer at all — just photo + vignette + grain.
 * v2 (this) adds the full cinematic-trailer stack matched to Act 6:
 *
 *   GATE WEAVE        — film registration micro-jitter (vertical sub-px, 0.31s)
 *   HANDHELD JITTER   — operator hand 3-axis drift (13.7s irrational period)
 *   FOCUS BREATH      — autofocus micro-hunt (blur 0 → 0.55px → 0)
 *   KEN BURNS         — per-flash distinct camera move (push/pan/dolly/pull)
 *   HAZE TRIPLE       — three depth layers of SVG-turbulence atmosphere
 *   DUST MOTES        — 14 fine particles drifting upward
 *   HALATION          — radial flash-tinted glow around hot pixels (filmic)
 *   CHROMATIC ABER.   — RGB channel offset at frame corners (lens fringing)
 *   ANAMORPHIC FLARE  — horizontal cyan streak fires with each bloom
 *   GRAIN STEPS       — 4-frame stepped grain (35mm motion picture)
 *   SCANLINES         — extremely subtle horizontal banding
 *   VIGNETTE          — radial darken for focal anchor
 *   WARM TINT         — sub-frame multiply overlay
 *   PHOTO CROSSFADE   — next photo bleeds in 80ms inside bloom window
 *   CAPTION BREATH    — sub-pixel slide-in on caption text
 *
 * Plays from 1:02 to 1:18 in the cinematic, immediately following Act 6 with
 * NO transition gap. Same gameplay-flash documentary register as Act 6 (hard
 * cuts, white-flash blooms between, music continues, Marcus VO over each
 * flash). The verbs shift from SKILLS (Catch / React / Survive / Back / Run)
 * to DECISIONS (Negotiate / Hire / Buy / Run) — this is the player rising
 * from operator to operator-of-the-operation.
 *
 * EMOTIONAL CONTRACT: Ambition. "I see how I become a real carrier."
 *
 * COLOR REGISTER PER FLASH (escalation):
 *   Flash 1 — broker negotiation     — dark navy + green money UI
 *   Flash 2 — driver hire            — warm light + blue uniform + amber stats
 *   Flash 3 — truck auction          — gold + sunset + amber bid ticker
 *   Flash 4 — operations dashboard   — dispatch room (callback to Act 4) + cyan HUD
 *
 * MARCUS DIALOGUE (locked v3 revisions):
 *   "Negotiate the rate."
 *   "Know your personnel. Hire the right driver."
 *   "Be strategic about every truck you buy."
 *   "Run your company efficiently — or it won't be your company for long."
 *
 * PROPS:
 *   imageUrls:   { flash2Driver, flash3Truck, flash4Dispatch }
 *                Note: Flash 1 has no photo (synthetic UI only)
 *   onComplete:  () => void  — called at 16000ms
 *   onSkip:      () => void  — optional skip handler
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

// Per-flash durations in milliseconds. Per design review: scenes 1, 2, 3 are
// info-dense (load card, driver profile, auction) — viewers need an extra
// second on each to fully process. Scene 4 (dispatch board) stays at 4s
// because the map visual reads quickly. Total Act 7 = 19s (was 16s).
const FLASH_DURATIONS = [5000, 5000, 5000, 4000];
const FLASH_OFFSETS = FLASH_DURATIONS.reduce((acc, dur, i) => {
  acc.push((acc[i - 1] || 0) + (i === 0 ? 0 : FLASH_DURATIONS[i - 1]));
  return acc;
}, []);
// FLASH_OFFSETS = [0, 5000, 10000, 15000]
const ACT_DURATION_MS = FLASH_DURATIONS.reduce((a, b) => a + b, 0); // 19000

// Default flash duration used by inner-flash component animations that compute
// progress fractions; kept at 4000 so existing animation start/end times still
// fire at the same absolute ms within each flash. The extra time at the end
// becomes additional "settled" reading time — exactly the design intent.
const FLASH_DURATION_MS = 4000;

const BLOOM_DURATION_MS = 100;
const CAPTION_FADE_IN_MS = 200;
const CAPTION_DELAY_MS = 400;
const SVG_DELAY_MS = 600;
const SVG_ENTRANCE_MS = 350;

// ─────────────────────────────────────────────────────────────────────────────
// FLASH DEFINITIONS — locked from storyboard v3.1 Act 7 (lines 748-815)
// ─────────────────────────────────────────────────────────────────────────────
const FLASHES = [
  {
    key: null,                      // No photo — fully synthetic UI
    label: 'NEGOTIATE',
    register: 'navy',
    caption: 'Negotiate with brokers.',
  },
  {
    key: 'flash2Driver',
    label: 'HIRE',
    register: 'amber',
    caption: 'Hire the right drivers and know your personnel (KYP).',
  },
  {
    key: 'flash3Truck',
    label: 'BUY',
    register: 'gold',
    caption: 'Be strategic about every truck you buy.',
  },
  {
    key: 'flash4Dispatch',
    label: 'RUN',
    register: 'cyan',
    caption: "Run your company efficiently — or it won't be your company for long.",
  },
];

// Easing utilities (matches Act 6)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Act7Decisions = React.memo(function Act7Decisions({
  imageUrls = {},
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('7', elapsedMs);

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

  // Per-flash routing: locate which flash window elapsedMs falls into by
  // walking through cumulative offsets. Defensive clamp matches Act 6 v6.1.
  const computeFlashIndex = () => {
    const e = isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    for (let i = FLASH_DURATIONS.length - 1; i >= 0; i--) {
      if (e >= FLASH_OFFSETS[i]) return i;
    }
    return 0;
  };
  const flashIndex = computeFlashIndex();
  const currentFlashDuration = FLASH_DURATIONS[flashIndex];
  const localMs = (elapsedMs || 0) - FLASH_OFFSETS[flashIndex];

  // White-flash bloom: 0 → 1 → 0 over 100ms with peak at 40ms
  const bloomOpacity = useMemo(() => {
    if (localMs >= BLOOM_DURATION_MS) return 0;
    const peak = 40;
    if (localMs <= peak) return localMs / peak;
    return 1 - (localMs - peak) / (BLOOM_DURATION_MS - peak);
  }, [localMs]);

  // Caption opacity: fades 400-600ms, holds
  const captionOpacity = useMemo(() => {
    if (localMs < CAPTION_DELAY_MS) return 0;
    return Math.min(1, (localMs - CAPTION_DELAY_MS) / CAPTION_FADE_IN_MS);
  }, [localMs]);

  // SVG overlay entrance: scale 0.85→1.0 with easeOutBack overshoot
  const svgEntrance = useMemo(() => {
    if (localMs < SVG_DELAY_MS) return { opacity: 0, scale: 0.85 };
    const t = Math.min(1, (localMs - SVG_DELAY_MS) / SVG_ENTRANCE_MS);
    const eased = easeOutBack(t);
    return {
      opacity: easeOutCubic(t),
      scale: 0.85 + eased * 0.15,
    };
  }, [localMs]);

  // Per-flash Ken Burns motion variation — eliminates the "all-zoom-in" feel.
  //   F1 (synth UI):     no transform (clean UI; the live ticker is the motion)
  //   F2 (driver):       slow push-in (1.00 → 1.04)
  //   F3 (truck):        slow pan-right + slight pull-back (1.04 → 1.02)
  //   F4 (dispatch):     dolly-tilt (push-in + slight rotation)
  // Uses currentFlashDuration so motion fills the full (variable-length) flash.
  const kenBurns = useMemo(() => {
    const t = localMs / currentFlashDuration;
    const eT = easeOutCubic(t);
    switch (flashIndex) {
      case 0: return { scale: 1.0, x: 0, y: 0, rot: 0 };
      case 1: return { scale: 1.00 + eT * 0.04, x: 0, y: -eT * 0.6, rot: 0 };
      case 2: return { scale: 1.04 - eT * 0.02, x: -1.0 + eT * 1.5, y: 0, rot: 0 };
      case 3: return { scale: 1.00 + eT * 0.05, x: 0, y: 0, rot: eT * 0.4 };
      default: return { scale: 1.0, x: 0, y: 0, rot: 0 };
    }
  }, [flashIndex, localMs, currentFlashDuration]);

  // Caption: slide-in (translateY 8px → 0) + opacity, eased
  const captionState = useMemo(() => {
    if (localMs < CAPTION_DELAY_MS) return { opacity: 0, y: 8 };
    const t = Math.min(1, (localMs - CAPTION_DELAY_MS) / 500);
    const e = easeOutCubic(t);
    return { opacity: e, y: 8 - 8 * e };
  }, [localMs]);

  const svgStyle = {
    opacity: svgEntrance.opacity,
    transform: `scale(${svgEntrance.scale.toFixed(3)})`,
  };

  const flash = FLASHES[flashIndex];
  const photoUrl = flash.key ? imageUrls[flash.key] : null;

  // Per-flash photo background-position
  const photoPositionByFlash = {
    flash2Driver:   'center 40%',
    flash3Truck:    'center 50%',
    flash4Dispatch: 'center 35%',
  };

  // Pre-compute next-flash photo for crossfade-through-bloom
  const nextFlash = flashIndex < 3 ? FLASHES[flashIndex + 1] : null;
  const nextPhotoUrl = (nextFlash && nextFlash.key) ? (imageUrls[nextFlash.key] || '') : '';
  const nextPhotoPos = (nextFlash && nextFlash.key) ? (photoPositionByFlash[nextFlash.key] || 'center 40%') : 'center 40%';
  const overlapNextOpacity = useMemo(() => {
    if (flashIndex >= 3) return 0;
    const crossfadeStart = currentFlashDuration - 80;
    if (localMs < crossfadeStart) return 0;
    return Math.min(1, (localMs - crossfadeStart) / 80);
  }, [flashIndex, localMs, currentFlashDuration]);

  // Halation tint per flash — flash-register-specific filmic glow
  const halationTint = useMemo(() => {
    switch (flashIndex) {
      case 0: return 'rgba(110, 230, 150, 0.65)'; // green money negotiate
      case 1: return 'rgba(255, 200, 100, 0.78)'; // amber hire
      case 2: return 'rgba(255, 170, 80, 0.85)';  // gold sunset auction
      case 3: return 'rgba(110, 200, 230, 0.72)'; // cyan dispatch HUD
      default: return 'rgba(255, 200, 130, 0.65)';
    }
  }, [flashIndex]);

  // Anamorphic lens flare on bloom entry
  const flareOpacity = useMemo(() => {
    if (localMs < BLOOM_DURATION_MS) {
      const peak = 40;
      if (localMs <= peak) return localMs / peak * 0.85;
      return Math.max(0, 0.85 * (1 - (localMs - peak) / 220));
    }
    return 0;
  }, [localMs]);

  return (
    <div className="a7-stage">
      <style>{ACT7_STYLES}</style>

      {/* GATE WEAVE WRAPPER — film registration micro-jitter (vertical, 0.31s) */}
      <div className="a7-gate-weave">
        {/* HANDHELD CAMERA WRAPPER (subtle 3-axis drift) */}
        <div className="a7-handheld">
          {/* PHOTO LAYER OR SYNTHETIC BACKDROP — with per-flash Ken Burns */}
          {photoUrl ? (
            <div
              className="a7-photo a7-photo-current"
              style={{
                backgroundImage: `url("${photoUrl}")`,
                backgroundPosition: photoPositionByFlash[flash.key] || 'center 40%',
                transform: `scale(${kenBurns.scale.toFixed(4)}) translate(${kenBurns.x.toFixed(3)}%, ${kenBurns.y.toFixed(3)}%) rotate(${kenBurns.rot.toFixed(3)}deg)`,
              }}
            />
          ) : (
            <div className="a7-synthetic-backdrop" />
          )}

          {/* PHOTO CROSSFADE — next flash's photo fades in during last 80ms */}
          {nextFlash && nextFlash.key && overlapNextOpacity > 0 && (
            <div
              className="a7-photo a7-photo-next"
              style={{
                backgroundImage: `url("${nextPhotoUrl}")`,
                backgroundPosition: nextPhotoPos,
                opacity: overlapNextOpacity,
                transform: 'scale(1.0)',
              }}
            />
          )}

          {/* CHROMATIC ABERRATION — RGB channel offset edges (lens fringing) */}
          <div className="a7-chromatic" />

          {/* HALATION — radial film glow tinted to flash register */}
          <div
            className="a7-halation"
            style={{
              background: `radial-gradient(ellipse at 50% 45%, transparent 30%, ${halationTint} 75%, transparent 100%)`,
            }}
          />

          {/* THREE-TIER ATMOSPHERIC HAZE */}
          <div className="a7-haze a7-haze-far"  />
          <div className="a7-haze a7-haze-mid"  />
          <div className="a7-haze a7-haze-near" />

          {/* DUST PARTICLE FIELD */}
          <DustParticles7 />

          {/* VIGNETTE GRADE */}
          <div className="a7-grade" />

          {/* SUBTLE SCANLINES */}
          <div className="a7-scanlines" />

          {/* GRAIN — animated film steps */}
          <div className="a7-grain" />

          {/* WARM TINT MULTIPLY */}
          <div className="a7-warm-tint" />
        </div>
      </div>

      {/* SVG OVERLAY (per-flash) */}
      <div className={`a7-svg a7-svg-${flash.register}`} style={svgStyle}>
        {flashIndex === 0 && <Flash1Negotiate localMs={localMs} />}
        {flashIndex === 1 && <Flash2Hire      localMs={localMs} />}
        {flashIndex === 2 && <Flash3Buy       localMs={localMs} />}
        {flashIndex === 3 && <Flash4Run       localMs={localMs} />}
      </div>

      {/* CINEMA BARS */}
      <div className="a7-cine top" />
      <div className="a7-cine bot" />

      {/* CAPTION (Marcus VO) — with slide-in */}
      <div
        className="a7-caption"
        style={{
          opacity: captionState.opacity,
          transform: `translateY(${captionState.y.toFixed(2)}px)`,
        }}
      >
        {flash.caption}
      </div>

      {/* ANAMORPHIC LENS FLARE — horizontal cyan streak fires with bloom */}
      {flareOpacity > 0.001 && (
        <div className="a7-anamorphic" style={{ opacity: flareOpacity }} />
      )}

      {/* WHITE-FLASH BLOOM */}
      {bloomOpacity > 0.001 && (
        <div className="a7-bloom" style={{ opacity: bloomOpacity }} />
      )}

      {/* SKIP BUTTON */}
      <button className="a7-skip-btn" onClick={onSkip} aria-label="Skip act">
        SKIP
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DUST PARTICLES — 14 drifting motes for atmospheric depth
// ─────────────────────────────────────────────────────────────────────────────
const DustParticles7 = React.memo(function DustParticles7() {
  const particles = [];
  for (let i = 0; i < 14; i++) {
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed / 233280) * 100;
    const y = ((seed * 7) % 233280) / 233280 * 100;
    const sz = 1 + ((seed * 3) % 100) / 100 * 1.5;
    const dur = 18 + ((seed * 5) % 100) / 100 * 22;
    const delay = -((seed * 11) % 100) / 100 * dur;
    particles.push({ x, y, sz, dur, delay, key: i });
  }
  return (
    <div className="a7-dust">
      {particles.map((p) => (
        <div
          key={p.key}
          className="a7-mote"
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
// FLASH 1 — Negotiate the rate
// Synthetic UI: load card on dark navy register. Broker chip, lane, rate
// figures, ACCEPT / COUNTER prompt. Money green on dark blue.
// ─────────────────────────────────────────────────────────────────────────────
// FLASH 1 — Negotiate the rate
// Synthetic UI: load card on dark navy register. Broker chip, lane, rate
// figures, COUNTER / ACCEPT row. Money green on dark blue.
//
// KINETIC TIMELINE:
//   0-200ms:    Bloom carries from prior cut
//   600-1100ms: Card slides up + opacity 0→1 (slide-in from below)
//   1100-1500ms: Lane row + stats tick into place
//   1500ms:     COUNTER row appears with "thinking" dot pulse
//   1500-2400ms: COUNTER value ticks $0 → $2,150 (the counter offer ladder)
//   2400-2700ms: Green LOCK check stamps in over COUNTER, dot stops pulsing
// ─────────────────────────────────────────────────────────────────────────────
function Flash1Negotiate({ localMs }) {
  // Card slide-in from below
  const cardState = (() => {
    if (localMs < 600) return { opacity: 0, y: 18 };
    const t = clamp((localMs - 600) / 500, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, y: lerp(18, 0, e) };
  })();

  // COUNTER row appears at 1500ms
  const counterRowOpacity = clamp((localMs - 1500) / 300, 0, 1);

  // COUNTER value ticks up $0 → $2,150
  const counterVal = (() => {
    if (localMs < 1500) return 0;
    if (localMs < 2400) {
      const t = (localMs - 1500) / 900;
      return Math.round(easeOutQuart(t) * 2150);
    }
    return 2150;
  })();

  // "Thinking" dot pulse — visible while counter is ticking, fades when locked
  const thinkingT = (localMs % 800) / 800;
  const thinkingOpacity = (() => {
    if (localMs < 1500) return 0;
    if (localMs > 2400) return 0;
    return 0.4 + Math.sin(thinkingT * Math.PI * 2) * 0.4;
  })();

  // LOCK check appears at 2400ms with scale-bounce, then continues to gently pulse
  const lockState = (() => {
    if (localMs < 2400) return { opacity: 0, scale: 0.6 };
    const t = clamp((localMs - 2400) / 320, 0, 1);
    const e = easeOutBack(t);
    const baseScale = lerp(0.6, 1.0, e);
    // After bounce settles (>2720ms), continuous gentle pulse
    if (localMs > 2720) {
      const pulseT = ((localMs - 2720) % 1400) / 1400;
      const pulse = 1.0 + Math.sin(pulseT * Math.PI * 2) * 0.06;
      return { opacity: clamp(t * 1.5, 0, 1), scale: pulse };
    }
    return { opacity: clamp(t * 1.5, 0, 1), scale: baseScale };
  })();

  // ACCEPT button — continuous shine sweep after deal locks (>2400ms)
  // Cycle: sweep starts every 1500ms, takes 800ms to cross
  const acceptShine = (() => {
    if (localMs < 2400) return -1; // hidden
    const cycleMs = 1500;
    const sweepDur = 800;
    const phase = (localMs - 2400) % cycleMs;
    if (phase > sweepDur) return -1;
    return phase / sweepDur; // 0..1
  })();
  const acceptGlow = (() => {
    if (localMs < 2400) return 0;
    const t = ((localMs - 2400) % 1500) / 1500;
    return 0.5 + Math.abs(Math.sin(t * Math.PI)) * 0.5;
  })();

  return (
    <div className="f1-loadcard-wrap">
      <div
        className="f1-loadcard"
        style={{
          opacity: cardState.opacity,
          transform: `translateY(${cardState.y.toFixed(2)}px)`,
        }}
      >
        <div className="f1-card-header">
          <div className="f1-broker-chip">
            <div className="f1-broker-avatar">RB</div>
            <div className="f1-broker-info">
              <div className="f1-broker-name">RIVERBROOK LOGISTICS</div>
              <div className="f1-broker-rating">★★★★☆ · BROKER</div>
            </div>
          </div>
          <div className="f1-load-id">LOAD #4729</div>
        </div>

        <div className="f1-lane">
          <div className="f1-lane-pt">
            <div className="f1-lane-city">CHICAGO, IL</div>
            <div className="f1-lane-time">PICKUP · TUE 0800</div>
          </div>
          <div className="f1-lane-arrow">→</div>
          <div className="f1-lane-pt">
            <div className="f1-lane-city">ATLANTA, GA</div>
            <div className="f1-lane-time">DELIVER · WED 1500</div>
          </div>
        </div>

        <div className="f1-stats">
          <div className="f1-stat">
            <div className="f1-stat-label">MILES</div>
            <div className="f1-stat-val">714</div>
          </div>
          <div className="f1-stat">
            <div className="f1-stat-label">BROKER OFFER</div>
            <div className="f1-stat-val">$1,820</div>
          </div>
          <div className="f1-stat">
            <div className="f1-stat-label">$ / MI</div>
            <div className="f1-stat-val">$2.55</div>
          </div>
        </div>

        {/* COUNTER row — appears mid-flash with ticking value and pulse dot */}
        <div className="f1-counter-row" style={{ opacity: counterRowOpacity }}>
          <div className="f1-counter-label">YOUR COUNTER</div>
          <div className="f1-counter-val-wrap">
            <span
              className="f1-thinking-dot"
              style={{ opacity: thinkingOpacity.toFixed(2) }}
            />
            <span className="f1-counter-val">${counterVal.toLocaleString()}</span>
            <span
              className="f1-counter-check"
              style={{
                opacity: lockState.opacity,
                transform: `scale(${lockState.scale.toFixed(3)})`,
              }}
            >
              ✓
            </span>
          </div>
        </div>

        <div className="f1-actions">
          <div className="f1-btn f1-btn-counter">COUNTER</div>
          <div
            className="f1-btn f1-btn-accept"
            style={{
              boxShadow: acceptGlow > 0
                ? `0 0 ${(8 + acceptGlow * 16).toFixed(0)}px rgba(111, 204, 136, ${(0.3 + acceptGlow * 0.5).toFixed(2)})`
                : 'none',
            }}
          >
            ACCEPT
            {acceptShine >= 0 && (
              <span
                className="f1-btn-shine"
                style={{ left: `${(acceptShine * 140 - 30).toFixed(1)}%` }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 2 — Hire the right driver
// Pre_Trip_Man photo + DRIVER PROFILE scouting card overlay (top-right).
// Shows name, 3 stat bars (Reliability / Experience / CSA), and HIRE pill.
// ─────────────────────────────────────────────────────────────────────────────
// FLASH 2 — Hire the right driver
// Photo + DRIVER PROFILE scouting card (top-right). Stat bars fill staggered
// with number tickers, then HIRE pill stamps in.
//
// KINETIC TIMELINE:
//   0-500ms:    Bloom + photo settles
//   500-900ms:  Card slides in from right
//   900-1700ms: Reliability bar fills 0→94%, number ticks 0→94
//   1100-1900ms: Experience bar fills 0→78%, number ticks 0→78 (+200ms offset)
//   1300-2100ms: CSA Score bar fills 0→88%, number ticks 0→88 (+400ms offset)
//   2400-2700ms: HIRE pill stamps in with scale-bounce
// ─────────────────────────────────────────────────────────────────────────────
function Flash2Hire({ localMs }) {
  // Card slide-in from right
  const cardState = (() => {
    if (localMs < 500) return { opacity: 0, x: 24 };
    const t = clamp((localMs - 500) / 400, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, x: lerp(24, 0, e) };
  })();

  // Helper to compute a bar's fill % and number based on start/end + target
  const barProgress = (startMs, durationMs, target) => {
    if (localMs < startMs) return { pct: 0, num: 0 };
    if (localMs < startMs + durationMs) {
      const t = (localMs - startMs) / durationMs;
      const e = easeOutQuart(t);
      return { pct: e * target, num: Math.round(e * target) };
    }
    return { pct: target, num: target };
  };

  const reliability = barProgress(900, 800, 94);
  const experience  = barProgress(1100, 800, 78);
  const csa         = barProgress(1300, 800, 88);

  // HIRE pill stamps in at 2400ms, then continues to subtly glow-pulse
  const hireState = (() => {
    if (localMs < 2400) return { opacity: 0, scale: 0.5, glow: 0 };
    const t = clamp((localMs - 2400) / 350, 0, 1);
    const e = easeOutBack(t);
    const baseScale = lerp(0.5, 1.0, e);
    // After stamp settles (>2750ms), continuous glow pulse
    if (localMs > 2750) {
      const pulseT = ((localMs - 2750) % 1600) / 1600;
      const glow = 0.4 + Math.abs(Math.sin(pulseT * Math.PI)) * 0.6;
      const microPulse = 1.0 + Math.sin(pulseT * Math.PI * 2) * 0.025;
      return { opacity: clamp(t * 1.5, 0, 1), scale: microPulse, glow };
    }
    return { opacity: clamp(t * 1.5, 0, 1), scale: baseScale, glow: 0.5 };
  })();

  return (
    <div
      className="f2-card"
      style={{
        opacity: cardState.opacity,
        transform: `translateX(${cardState.x.toFixed(2)}px)`,
      }}
    >
      <div className="f2-card-header">
        <div className="f2-card-name">JAMES OKAFOR</div>
        <div className="f2-card-cdl">TWIC · PASSPORT · DOT MED</div>
      </div>
      <div className="f2-stats">
        <div className="f2-stat">
          <div className="f2-stat-label">RELIABILITY</div>
          <div className="f2-bar">
            <div className="f2-bar-fill" style={{ width: `${reliability.pct.toFixed(1)}%` }} />
          </div>
          <div className="f2-stat-val" style={{ fontVariantNumeric: 'tabular-nums' }}>{reliability.num}</div>
        </div>
        <div className="f2-stat">
          <div className="f2-stat-label">EXPERIENCE</div>
          <div className="f2-bar">
            <div className="f2-bar-fill" style={{ width: `${experience.pct.toFixed(1)}%` }} />
          </div>
          <div className="f2-stat-val" style={{ fontVariantNumeric: 'tabular-nums' }}>{experience.num}</div>
        </div>
        <div className="f2-stat">
          <div className="f2-stat-label">CSA SCORE</div>
          <div className="f2-bar">
            <div className="f2-bar-fill f2-bar-good" style={{ width: `${csa.pct.toFixed(1)}%` }} />
          </div>
          <div className="f2-stat-val" style={{ fontVariantNumeric: 'tabular-nums' }}>{csa.num}</div>
        </div>
      </div>
      <div
        className="f2-hire-pill"
        style={{
          opacity: hireState.opacity,
          transform: `scale(${hireState.scale.toFixed(3)})`,
          boxShadow: hireState.glow > 0
            ? `0 0 ${(8 + hireState.glow * 18).toFixed(0)}px rgba(111, 204, 136, ${(0.35 + hireState.glow * 0.45).toFixed(2)})`
            : 'none',
        }}
      >
        ✓ HIRE
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 3 — Buy the right truck
// box_truck_hero_realistic photo + auction overlay: LOT # top-left, BID ticker
// top-right (with up-arrow), GAVEL/STRIKE banner across the middle-bottom.
// ─────────────────────────────────────────────────────────────────────────────
// FLASH 3 — Buy the right truck
// Photo + auction overlay. The current bid TICKS UP through 3 prior bids
// before settling at the player's $42,500 winning bid. Then the gavel
// rotates -45° → 0° (strike motion) and a SOLD stamp lands with scale impact.
//
// KINETIC TIMELINE:
//   0-400ms:    LOT badge appears top-left
//   400-1100ms: Bid history rows slot in: BIDDER 04 $38,500 (400),
//               BIDDER 12 $40,000 (700), YOU $41,500 (1000)
//   1100-2300ms: CURRENT BID counts $38,500 → $42,500 (your final bid)
//   2400-2700ms: SECONDS-LEFT countdown ticks 8 → 0 to amplify urgency
//   2800-3000ms: Gavel rotates -45° → 0° in one strike
//   3000-3300ms: SOLD stamp lands (scale 0.4 → 1.05 → 1.0) with ripple ring
// ─────────────────────────────────────────────────────────────────────────────
function Flash3Buy({ localMs }) {
  // LOT badge fade-in
  const lotOpacity = clamp(localMs / 400, 0, 1);

  // Bid history rows (3 rows, slotted in at 400/700/1000ms)
  const bidRows = [
    { time: 400,  label: 'BIDDER 04', val: '$38,500' },
    { time: 700,  label: 'BIDDER 12', val: '$40,000' },
    { time: 1000, label: 'YOU',       val: '$41,500' },
  ];

  // Current bid counts up from $38,500 → $42,500 over 1.1-2.3s
  const currentBid = (() => {
    if (localMs < 1100) return 38500;
    if (localMs < 2300) {
      const t = (localMs - 1100) / 1200;
      const e = easeOutQuart(t);
      return Math.round(lerp(38500, 42500, e));
    }
    return 42500;
  })();

  // Time-left countdown (8 → 0 over 2400-2800ms) — pure tension
  const timeLeft = (() => {
    if (localMs < 2400) return 8;
    if (localMs < 2800) {
      const t = (localMs - 2400) / 400;
      return Math.max(0, 8 - Math.floor(t * 9));
    }
    return 0;
  })();

  // Gavel strike — rotation -45° → 0° between 2800-3000ms with overshoot
  const gavelRot = (() => {
    if (localMs < 2800) return -45;
    if (localMs < 2960) {
      const t = (localMs - 2800) / 160;
      return -45 + easeOutQuart(t) * 45;
    }
    return 0;
  })();

  // Gavel scale impact — punches at strike moment (2960ms)
  const gavelScale = (() => {
    if (localMs < 2960) return 1.0;
    if (localMs < 3060) {
      const t = (localMs - 2960) / 100;
      return 1.0 + Math.sin(t * Math.PI) * 0.25; // bounce 1.0 → 1.25 → 1.0
    }
    return 1.0;
  })();

  // Camera shake on gavel impact — DISABLED per user request (no screen
  // shaking outside of Act 6 F2). The white flash, scale punch, dust pop, and
  // ripple rings still convey impact without the screen-shake.
  const shake = { x: 0, y: 0 };

  // Strike flash — bright white bloom on impact, decays fast
  const strikeFlashOpacity = (() => {
    if (localMs < 2960) return 0;
    if (localMs < 3160) {
      const t = (localMs - 2960) / 200;
      return (1 - t) * 0.85;
    }
    return 0;
  })();

  // SOLD stamp — lands at 2960ms (synced with gavel impact)
  const soldState = (() => {
    if (localMs < 2960) return { opacity: 0, scale: 0.4, flash: 0 };
    if (localMs < 3120) {
      const t = (localMs - 2960) / 160;
      return {
        opacity: clamp(t * 2, 0, 1),
        scale: lerp(0.4, 1.12, easeOutBack(t)),
        flash: 1 - t,
      };
    }
    if (localMs < 3320) {
      const t = (localMs - 3120) / 200;
      return {
        opacity: 1,
        scale: lerp(1.12, 1.0, t),
        flash: 0,
      };
    }
    return { opacity: 1, scale: 1.0, flash: 0 };
  })();

  // SOLD ripple rings — TWO concentric rings expanding from stamp center
  const ripple = (delayMs) => {
    if (localMs < 2960 + delayMs) return { opacity: 0, scale: 0.4 };
    if (localMs < 3460 + delayMs) {
      const t = (localMs - (2960 + delayMs)) / 500;
      return { opacity: 1 - t, scale: lerp(0.4, 3.6, easeOutQuart(t)) };
    }
    return { opacity: 0, scale: 3.6 };
  };
  const rippleA = ripple(0);
  const rippleB = ripple(120);

  // Bid value flash green when sold (the "you won" emphasis)
  const bidWonGlow = (() => {
    if (localMs < 2960) return 0;
    if (localMs < 3260) {
      const t = (localMs - 2960) / 300;
      return (1 - t) * 1.0;
    }
    return 0.3; // settled green tint
  })();

  // ── BACKGROUND BIDDER PADDLES — silhouettes raising at staggered times ──
  const paddle = (raiseAtMs, downAtMs) => {
    if (localMs < raiseAtMs) return { y: 30, opacity: 0 };
    if (localMs < raiseAtMs + 200) {
      const t = (localMs - raiseAtMs) / 200;
      const e = easeOutBack(t);
      return { y: lerp(30, 0, e), opacity: t };
    }
    if (localMs < downAtMs) return { y: 0, opacity: 0.65 };
    if (localMs < downAtMs + 250) {
      const t = (localMs - downAtMs) / 250;
      return { y: lerp(0, 30, t), opacity: 0.65 * (1 - t) };
    }
    return { y: 30, opacity: 0 };
  };
  const paddle04 = paddle(600, 1400);
  const paddle12 = paddle(900, 1700);
  const paddleYou = paddle(1100, 2400); // YOUR paddle stays up longer through your bid

  // ── DUST PARTICLE POP — 8 particles burst outward on gavel strike ──
  const dustParticles = (() => {
    if (localMs < 2960 || localMs > 3500) return [];
    const t = clamp((localMs - 2960) / 540, 0, 1);
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const angle = (i / 8) * Math.PI * 2;
      const dist = easeOutQuart(t) * 90;
      return {
        key: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - t * 12, // slight upward drift
        opacity: 1 - t,
        scale: 1 - t * 0.5,
      };
    });
  })();

  // ── AUCTIONEER ANNOUNCEMENT TICKER ──
  // The voice of the auctioneer expressed in text. Phases through:
  //   0-1500ms:    "BIDDING OPEN"
  //   1500-2200ms: "GOING ONCE..."
  //   2200-2800ms: "GOING TWICE..."
  //   2800+:       "SOLD!"
  const announcement = (() => {
    if (localMs < 1500) return { text: 'BIDDING OPEN', cls: 'open' };
    if (localMs < 2200) return { text: 'GOING ONCE...', cls: 'once' };
    if (localMs < 2800) return { text: 'GOING TWICE...', cls: 'twice' };
    return { text: 'SOLD!', cls: 'sold' };
  })();

  // Live indicator pulse — blinks during active bidding
  const livePulse = 0.5 + Math.abs(Math.sin(localMs * 0.003 * Math.PI)) * 0.5;

  return (
    <div className="f3-shake-wrap" style={{ transform: `translate(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px)` }}>
      <div className="f3-lot" style={{ opacity: lotOpacity }}>
        <div className="f3-lot-label">LOT #</div>
        <div className="f3-lot-num">217</div>
      </div>

      {/* AUCTIONEER ANNOUNCEMENT TICKER — top of frame */}
      <div className={`f3-announce f3-announce-${announcement.cls}`}>
        <span className="f3-announce-dot" style={{ opacity: livePulse }} />
        <span className="f3-announce-text">{announcement.text}</span>
      </div>

      {/* BACKGROUND BIDDER PADDLES — SVG silhouettes rising and falling */}
      <svg className="f3-paddles" viewBox="0 0 480 700" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="f3-paddle-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1a1d22" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0a0c0e" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {/* Paddle 04 — left-side bidder */}
        <g style={{ transform: `translate(0, ${paddle04.y.toFixed(1)}px)`, opacity: paddle04.opacity.toFixed(2) }}>
          {/* Arm */}
          <rect x="78" y="540" width="14" height="160" fill="url(#f3-paddle-grad)" rx="2" />
          {/* Paddle face */}
          <rect x="60" y="490" width="50" height="60" fill="#e6c97a" stroke="#3a2d10" strokeWidth="1.5" rx="2" />
          {/* Paddle handle */}
          <rect x="80" y="540" width="10" height="14" fill="#7a5e2a" />
          <text x="85" y="525" textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="22" fontWeight="700" fill="#3a2d10">04</text>
        </g>
        {/* Paddle 12 — right-side bidder */}
        <g style={{ transform: `translate(0, ${paddle12.y.toFixed(1)}px)`, opacity: paddle12.opacity.toFixed(2) }}>
          <rect x="388" y="540" width="14" height="160" fill="url(#f3-paddle-grad)" rx="2" />
          <rect x="370" y="490" width="50" height="60" fill="#e6c97a" stroke="#3a2d10" strokeWidth="1.5" rx="2" />
          <rect x="390" y="540" width="10" height="14" fill="#7a5e2a" />
          <text x="395" y="525" textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="22" fontWeight="700" fill="#3a2d10">12</text>
        </g>
        {/* YOUR paddle — center, raised highest, brighter */}
        <g style={{ transform: `translate(0, ${paddleYou.y.toFixed(1)}px)`, opacity: paddleYou.opacity.toFixed(2) }}>
          <rect x="228" y="540" width="14" height="160" fill="url(#f3-paddle-grad)" rx="2" />
          <rect x="206" y="478" width="58" height="68" fill="#ffd24a" stroke="#3a2d10" strokeWidth="1.8" rx="2" />
          <rect x="230" y="540" width="10" height="14" fill="#7a5e2a" />
          <text x="235" y="516" textAnchor="middle" fontFamily="Outfit, sans-serif" fontSize="24" fontWeight="800" fill="#3a2d10">07</text>
        </g>
      </svg>

      {/* Bid history sidebar (left side, sequenced rows) */}
      <div className="f3-bid-history">
        {bidRows.map((row, i) => {
          const t = clamp((localMs - row.time) / 250, 0, 1);
          return (
            <div
              key={i}
              className="f3-bid-row"
              style={{
                opacity: t,
                transform: `translateY(${(8 - t * 8).toFixed(2)}px)`,
              }}
            >
              <span className="f3-bid-bidder">{row.label}</span>
              <span className="f3-bid-amt">{row.val}</span>
            </div>
          );
        })}
      </div>

      {/* CURRENT BID — top right, ticks up, glows green when won */}
      <div
        className="f3-bid"
        style={{
          boxShadow: bidWonGlow > 0
            ? `0 0 ${(20 * bidWonGlow + 6).toFixed(0)}px rgba(111, 204, 136, ${(0.6 * bidWonGlow + 0.2).toFixed(2)})`
            : '0 4px 18px rgba(0,0,0,0.55)',
          borderColor: bidWonGlow > 0
            ? `rgba(111, 204, 136, ${(0.6 + bidWonGlow * 0.4).toFixed(2)})`
            : 'rgba(245, 210, 154, 0.5)',
        }}
      >
        <div className="f3-bid-label">CURRENT BID</div>
        <div
          className="f3-bid-val"
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: bidWonGlow > 0 ? '#9be0a8' : '#ffd24a',
          }}
        >
          ${currentBid.toLocaleString()}
        </div>
        <div className="f3-bid-arrow">▲ +$500</div>
      </div>

      {/* Time-left countdown (urgency cue) */}
      {timeLeft >= 0 && localMs > 2200 && localMs < 2960 && (
        <div
          className="f3-timer"
          style={{
            opacity: clamp((localMs - 2200) / 200, 0, 1),
            transform: `scale(${(1 + Math.sin((localMs / 80) * Math.PI * 2) * 0.04).toFixed(3)})`,
          }}
        >
          <span className="f3-timer-label">TIME</span>
          <span className="f3-timer-val">{timeLeft}s</span>
        </div>
      )}

      {/* DUST PARTICLE POP from gavel strike */}
      <div className="f3-dust-pop">
        {dustParticles.map(p => (
          <div
            key={p.key}
            className="f3-dust-particle"
            style={{
              transform: `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${p.scale.toFixed(2)})`,
              opacity: p.opacity.toFixed(2),
            }}
          />
        ))}
      </div>

      {/* STRIKE WHITE FLASH BLOOM — fires on gavel impact */}
      {strikeFlashOpacity > 0.001 && (
        <div className="f3-strike-flash" style={{ opacity: strikeFlashOpacity.toFixed(3) }} />
      )}

      {/* Gavel + SOLD stamp banner */}
      <div className="f3-strike-wrap">
        {/* TWO concentric ripple rings */}
        <div
          className="f3-strike-ripple"
          style={{
            opacity: rippleA.opacity.toFixed(2),
            transform: `translate(-50%, -50%) scale(${rippleA.scale.toFixed(2)})`,
          }}
        />
        <div
          className="f3-strike-ripple f3-strike-ripple-b"
          style={{
            opacity: rippleB.opacity.toFixed(2),
            transform: `translate(-50%, -50%) scale(${rippleB.scale.toFixed(2)})`,
          }}
        />
        <div
          className="f3-strike"
          style={{
            opacity: soldState.opacity,
            transform: `scale(${soldState.scale.toFixed(3)})`,
            boxShadow: soldState.flash > 0
              ? `0 0 ${(50 * soldState.flash).toFixed(0)}px rgba(255, 220, 100, ${soldState.flash.toFixed(2)})`
              : '0 8px 28px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="f3-strike-icon"
            style={{
              transform: `rotate(${gavelRot.toFixed(1)}deg) scale(${gavelScale.toFixed(3)})`,
            }}
          >
            ⚒
          </div>
          <div className="f3-strike-text">SOLD · FREIGHTLINER M2 106</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLASH 4 — Run your company
// marcus_dispatch_room_wide photo (callback to Act 4 — same space, now with
// the player operating it as the dispatcher) + synthetic dispatch HUD: route
// list with multiple loads pinging through statuses (ASSIGNED → IN TRANSIT →
// DELIVERED), cyan/amber accents.
// ─────────────────────────────────────────────────────────────────────────────
// FLASH 4 — Run your company
// marcus_dispatch_room_wide photo (callback to Act 4) + dispatch HUD with
// rows that slot in sequentially, status indicators that ping, KPI numbers
// that tick up, and a small SVG route map with lines that draw via
// stroke-dashoffset.
//
// KINETIC TIMELINE:
//   0-400ms:    Bloom + photo
//   500-700ms:  HUD frame slides in from top
//   800ms:      Row 1 (L-4729 CHI→ATL IN TRANSIT) slots in
//   1100ms:     Row 2 (L-4730 DET→MEM ASSIGNED) slots in
//   1400ms:     Row 3 (L-4728 CLE→PIT DELIVERED) slots in with green check ping
//   1800-2800ms: KPI ticker numbers count up (94%, $2,400, 7/8)
//   1500-3000ms: Route lines on mini-map draw via stroke-dashoffset
// ─────────────────────────────────────────────────────────────────────────────
function Flash4Run({ localMs }) {
  // HUD slide-in from top
  const hudState = (() => {
    if (localMs < 500) return { opacity: 0, y: -16 };
    const t = clamp((localMs - 500) / 350, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, y: lerp(-16, 0, e) };
  })();

  // Row entry — each row appears at staggered times
  const rowAppear = (startMs) => {
    if (localMs < startMs) return { opacity: 0, x: 14 };
    const t = clamp((localMs - startMs) / 280, 0, 1);
    const e = easeOutCubic(t);
    return { opacity: e, x: lerp(14, 0, e) };
  };

  const row1 = rowAppear(800);   // IN TRANSIT
  const row2 = rowAppear(1100);  // ASSIGNED
  const row3 = rowAppear(1400);  // DELIVERED

  // KPI counters — tick up over 1800-2800ms
  const kpiTick = (target, start = 1800, dur = 1000) => {
    if (localMs < start) return 0;
    if (localMs < start + dur) {
      const t = (localMs - start) / dur;
      return easeOutQuart(t) * target;
    }
    return target;
  };
  const kpiOnTime = Math.round(kpiTick(94));
  const kpiRevenue = Math.round(kpiTick(2400));
  const kpiActiveNum = Math.round(kpiTick(7));

  // Route lines draw from 1500ms over 1500ms (stroke-dashoffset).
  // After that, lines have continuous DASH FLOW to suggest "data moving" /
  // trucks in transit. The dashoffset keeps decrementing perpetually.
  const routeT = clamp((localMs - 1500) / 1500, 0, 1);
  const routeOffset = (() => {
    if (localMs < 1500) return 180;
    if (localMs < 3000) {
      // Drawing phase: 180 → 0
      return lerp(180, 0, easeOutCubic(routeT));
    }
    // After draw complete: continuous flow (cycles 0 → -10 forever)
    return -((localMs - 3000) * 0.04 % 10);
  })();

  // Route flow dasharray — dashed pattern "6 4" suggests packets moving forward
  const routeDashArray = localMs >= 3000 ? '6 4' : '180';

  // Status ping animation — small pulse on each row's status badge as it lands,
  // then continues with a slow ambient pulse so the badges feel alive.
  const statusPing = (rowAppearMs, ambientFreq = 1.4) => {
    if (localMs < rowAppearMs) return 1;
    if (localMs < rowAppearMs + 400) {
      const t = (localMs - rowAppearMs) / 400;
      return 1 + Math.sin(t * Math.PI) * 0.18;
    }
    // Ambient continuous pulse after entry settles
    const phase = ((localMs - rowAppearMs - 400) % (ambientFreq * 1000)) / (ambientFreq * 1000);
    return 1 + Math.sin(phase * Math.PI * 2) * 0.04;
  };

  // Status text glow opacity for each row (continuous blink)
  const statusGlow = (rowAppearMs, period) => {
    if (localMs < rowAppearMs + 400) return 0;
    const phase = ((localMs - rowAppearMs - 400) % period) / period;
    return 0.4 + Math.abs(Math.sin(phase * Math.PI)) * 0.6;
  };

  // City glow nodes pulse on arrival, then settle with continuous breathing
  const nodeGlow = (atTime) => {
    if (localMs < atTime) return 0;
    if (localMs < atTime + 600) {
      const t = (localMs - atTime) / 600;
      return Math.sin(t * Math.PI) * 0.9;
    }
    // Continuous gentle breathing after arrival pulse
    const phase = ((localMs - atTime - 600) % 2200) / 2200;
    return 0.35 + Math.abs(Math.sin(phase * Math.PI)) * 0.25;
  };

  return (
    <>
      {/* Subtle vignette + dim layer for HUD legibility — renders BEHIND the
          map SVG so it doesn't darken the map content itself. */}
      <div className="f4-mapbg-dim" />

      {/* ── FULL-FRAME SVG: map image + cities + routes + truck markers ──
          The map IMAGE is rendered as an SVG <image> element FIRST (drawn
          underneath everything else), which guarantees the map and the
          cities/routes share the EXACT SAME coordinate system. No matter
          what viewport size renders this SVG, the cities will always sit
          on the correct geographic positions on the map.

          The map image is positioned at (0, 0) with size (480, 534) — same
          480-wide map area at the top of the viewport, with cities placed
          at calibrated geographic positions within that map. */}
      <svg className="f4-mapsvg" viewBox="0 0 480 1040" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Route line gradient — cyan/blue glow matching the map's color */}
          <linearGradient id="f4-route-amber" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#ffd24a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff9b3a" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="f4-route-cyan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#7dd3ee" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#5cb8d4" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="f4-route-green" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#6fcc88" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#4ea872" stopOpacity="0.85" />
          </linearGradient>
          {/* City glow filters */}
          <radialGradient id="f4-city-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd24a" stopOpacity="0.7" />
            <stop offset="60%"  stopColor="#ff9b3a" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ff9b3a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="f4-city-glow-green" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#6fcc88" stopOpacity="0.7" />
            <stop offset="60%"  stopColor="#4ea872" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4ea872" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── MAP IMAGE — renders FIRST (underneath cities/routes) ──
            x=0, y=0, width=480, height=534 — fills the upper portion of the
            SVG viewport. Cities are placed in this same SVG at coordinates
            within (0-480, 0-534), so they're guaranteed to land on the map. */}
        {typeof window !== 'undefined' && window.A7_MAP_BG && (
          <image href={window.A7_MAP_BG}
                 x="0" y="0" width="480" height="534"
                 preserveAspectRatio="none" />
        )}

        {/* ── ROUTES (drawn first so cities sit on top) ──
            City positions calibrated by the designer using the F4 calibrator
            tool — exact pixel positions on the up-moved map (top:0).
              CHI (Chicago):    (198, 204)
              ATL (Atlanta):    (259, 332)
              DET (Detroit):    (262, 185)
              MEM (Memphis):    (181, 304)
              CLE (Cleveland):  (277, 211)
              PIT (Pittsburgh): (302, 223)
        */}

        {/* CHI → ATL (IN TRANSIT — amber, drawing in 800-1500ms then continuous flow) */}
        <line x1="198" y1="204" x2="259" y2="332"
              stroke="url(#f4-route-amber)" strokeWidth="2.5"
              strokeDasharray={routeDashArray} strokeDashoffset={routeOffset}
              strokeLinecap="round"
              filter="drop-shadow(0 0 4px rgba(255, 180, 60, 0.8))"
              opacity={clamp((localMs - 700) / 300, 0, 1)} />

        {/* DET → MEM (ASSIGNED — cyan, drawing in 1100-1800ms) */}
        <line x1="262" y1="185" x2="181" y2="304"
              stroke="url(#f4-route-cyan)" strokeWidth="2"
              strokeDasharray={routeDashArray} strokeDashoffset={routeOffset}
              strokeLinecap="round"
              filter="drop-shadow(0 0 4px rgba(125, 211, 238, 0.7))"
              opacity={clamp((localMs - 1000) / 300, 0, 1) * 0.85} />

        {/* CLE → PIT (DELIVERED — green, drawing in 1400-2100ms) */}
        <line x1="277" y1="211" x2="302" y2="223"
              stroke="url(#f4-route-green)" strokeWidth="2.5"
              strokeDasharray={routeDashArray} strokeDashoffset={routeOffset}
              strokeLinecap="round"
              filter="drop-shadow(0 0 5px rgba(111, 204, 136, 0.85))"
              opacity={clamp((localMs - 1300) / 300, 0, 1)} />

        {/* ── CITY MARKERS — outer halo + inner dot, pulse on activation ── */}
        {/* CHI (origin of L-4729, IN TRANSIT) */}
        <circle cx="198" cy="204" r={(8 + nodeGlow(800) * 6).toFixed(1)}
                fill="url(#f4-city-glow)" opacity={(0.5 + nodeGlow(800) * 0.5).toFixed(2)} />
        <circle cx="198" cy="204" r="3" fill="#ffd24a"
                opacity={clamp((localMs - 750) / 250, 0, 1).toFixed(2)} />
        {/* ATL (destination of L-4729) */}
        <circle cx="259" cy="332" r={(8 + nodeGlow(2400) * 6).toFixed(1)}
                fill="url(#f4-city-glow)" opacity={(0.5 + nodeGlow(2400) * 0.5).toFixed(2)} />
        <circle cx="259" cy="332" r="3" fill="#ffd24a"
                opacity={clamp((localMs - 1500) / 300, 0, 1).toFixed(2)} />
        {/* DET (origin of L-4730, ASSIGNED) */}
        <circle cx="262" cy="185" r={(7 + nodeGlow(1100) * 5).toFixed(1)}
                fill="url(#f4-city-glow)" opacity={(0.4 + nodeGlow(1100) * 0.4).toFixed(2)} />
        <circle cx="262" cy="185" r="2.5" fill="#a8d8ec"
                opacity={clamp((localMs - 1050) / 250, 0, 1).toFixed(2)} />
        {/* MEM (destination of L-4730) */}
        <circle cx="181" cy="304" r={(7 + nodeGlow(2200) * 5).toFixed(1)}
                fill="url(#f4-city-glow)" opacity={(0.4 + nodeGlow(2200) * 0.4).toFixed(2)} />
        <circle cx="181" cy="304" r="2.5" fill="#a8d8ec"
                opacity={clamp((localMs - 1500) / 300, 0, 1).toFixed(2)} />
        {/* CLE (origin of L-4728, DELIVERED) */}
        <circle cx="277" cy="211" r={(8 + nodeGlow(1400) * 5).toFixed(1)}
                fill="url(#f4-city-glow-green)" opacity={(0.5 + nodeGlow(1400) * 0.5).toFixed(2)} />
        <circle cx="277" cy="211" r="3" fill="#6fcc88"
                opacity={clamp((localMs - 1350) / 250, 0, 1).toFixed(2)} />
        {/* PIT (destination of L-4728) */}
        <circle cx="302" cy="223" r={(8 + nodeGlow(1800) * 5).toFixed(1)}
                fill="url(#f4-city-glow-green)" opacity={(0.6 + nodeGlow(1800) * 0.5).toFixed(2)} />
        <circle cx="302" cy="223" r="3" fill="#6fcc88"
                opacity={clamp((localMs - 1750) / 250, 0, 1).toFixed(2)} />

        {/* ── TRUCK MARKERS (travel along routes after 1700ms) ── */}
        {/* L-4729 truck travels CHI→ATL — currently mid-route. */}
        {(() => {
          if (localMs < 1700) return null;
          const t = ((localMs - 1700) % 4000) / 4000;
          const eased = easeOutCubic(t * 0.65 + 0.35);
          const x = lerp(198, 259, eased);
          const y = lerp(204, 332, eased);
          return (
            <g>
              <circle cx={x} cy={y} r="6" fill="rgba(255, 220, 100, 0.4)" />
              <circle cx={x} cy={y} r="3" fill="#ffe48a" />
            </g>
          );
        })()}
        {/* L-4730 truck just departed DET→MEM — near origin. */}
        {(() => {
          if (localMs < 1900) return null;
          const t = ((localMs - 1900) % 5000) / 5000;
          const eased = easeOutCubic(t * 0.3);
          const x = lerp(262, 181, eased);
          const y = lerp(185, 304, eased);
          return (
            <g>
              <circle cx={x} cy={y} r="5" fill="rgba(125, 211, 238, 0.4)" />
              <circle cx={x} cy={y} r="2.5" fill="#bce8f7" />
            </g>
          );
        })()}
        {/* L-4728 was DELIVERED — show small green confirm at destination */}
        {localMs >= 1700 && (
          <g>
            <circle cx="302" cy="223" r="9"
                    fill="none" stroke="#6fcc88" strokeWidth="0.8"
                    opacity={0.6 + Math.abs(Math.sin(localMs * 0.003)) * 0.4} />
          </g>
        )}

        {/* ── CITY LABELS — positioned to NOT obscure the city dots ── */}
        <g fontFamily="IBM Plex Mono, monospace" fontSize="9" fontWeight="600"
           letterSpacing="0.1em" fill="#e8f4ff" opacity={clamp((localMs - 1100) / 400, 0, 1)}>
          <text x="184" y="195" textAnchor="end">CHI</text>
          <text x="270" y="345" textAnchor="start">ATL</text>
          <text x="262" y="174" textAnchor="middle">DET</text>
          <text x="167" y="296" textAnchor="end">MEM</text>
          <text x="277" y="202" textAnchor="middle">CLE</text>
          <text x="311" y="217" textAnchor="start">PIT</text>
        </g>
      </svg>

      {/* ── DISPATCH HUD: title bar at top, load rows + KPI strip at bottom ── */}
      <div
        className="f4-hud-title-bar"
        style={{
          opacity: hudState.opacity,
          transform: `translateY(${hudState.y.toFixed(2)}px)`,
        }}
      >
        <span className="f4-hud-title">DISPATCH BOARD</span>
        <span className="f4-hud-time">TUE · 14:32</span>
      </div>

      <div
        className="f4-hud-bottom"
        style={{
          opacity: hudState.opacity,
          transform: `translateY(${(-hudState.y).toFixed(2)}px)`,
        }}
      >
        <div
          className="f4-load f4-load-1"
          style={{
            opacity: row1.opacity,
            transform: `translateX(${row1.x.toFixed(2)}px)`,
          }}
        >
          <div className="f4-load-id">L-4729</div>
          <div className="f4-load-route">CHI → ATL</div>
          <div
            className="f4-load-status f4-status-transit"
            style={{
              transform: `scale(${statusPing(800, 1.2).toFixed(3)})`,
              boxShadow: `0 0 ${(4 + statusGlow(800, 1200) * 8).toFixed(0)}px rgba(255, 180, 80, ${(0.3 + statusGlow(800, 1200) * 0.4).toFixed(2)})`,
            }}
          >
            IN TRANSIT
          </div>
        </div>
        <div
          className="f4-load f4-load-2"
          style={{
            opacity: row2.opacity,
            transform: `translateX(${row2.x.toFixed(2)}px)`,
          }}
        >
          <div className="f4-load-id">L-4730</div>
          <div className="f4-load-route">DET → MEM</div>
          <div
            className="f4-load-status f4-status-assigned"
            style={{
              transform: `scale(${statusPing(1100, 2.2).toFixed(3)})`,
              opacity: (0.7 + statusGlow(1100, 2200) * 0.3).toFixed(2),
            }}
          >
            ASSIGNED
          </div>
        </div>
        <div
          className="f4-load f4-load-3"
          style={{
            opacity: row3.opacity,
            transform: `translateX(${row3.x.toFixed(2)}px)`,
          }}
        >
          <div className="f4-load-id">L-4728</div>
          <div className="f4-load-route">CLE → PIT</div>
          <div
            className="f4-load-status f4-status-delivered"
            style={{ transform: `scale(${statusPing(1400, 1.8).toFixed(3)})` }}
          >
            ✓ DELIVERED
          </div>
        </div>

        {/* KPI strip below load rows */}
        <div className="f4-kpis" style={{ opacity: clamp((localMs - 1700) / 300, 0, 1) }}>
          <div className="f4-kpi">
            <div className="f4-kpi-label">ON-TIME</div>
            <div className="f4-kpi-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {kpiOnTime}<span className="f4-kpi-unit">%</span>
            </div>
          </div>
          <div className="f4-kpi">
            <div className="f4-kpi-label">REVENUE</div>
            <div className="f4-kpi-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="f4-kpi-unit">$</span>{kpiRevenue.toLocaleString()}
            </div>
          </div>
          <div className="f4-kpi">
            <div className="f4-kpi-label">ACTIVE</div>
            <div className="f4-kpi-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {kpiActiveNum}<span className="f4-kpi-unit"> / 8</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES (single inline <style> block)
// ─────────────────────────────────────────────────────────────────────────────
const ACT7_STYLES = `
.a7-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* GATE WEAVE — film registration jitter (vertical sub-pixel, ~0.31s irrational
   period, NOT a multiple of handheld jitter to avoid visible patterns). */
/* GATE WEAVE — disabled per user request (no screen shake on Act 7 anywhere).
   Wrapper kept for layout consistency, but no animation. */
.a7-gate-weave {
  position: absolute;
  inset: 0;
  z-index: 1;
}
@keyframes a7GateWeave {
  0%, 100% { transform: translateY(0); }
  20%      { transform: translateY(-0.4px); }
  40%      { transform: translateY(0.3px); }
  60%      { transform: translateY(-0.2px); }
  80%      { transform: translateY(0.4px); }
}

/* HANDHELD CAMERA WRAPPER — disabled in v3. Act 7 is observational/business
   register; handheld jitter on these flashes reads as wobbly rather than
   cinematic. Wrapper kept for layout but with no animation. */
.a7-handheld {
  position: absolute;
  inset: -1.5%;
  z-index: 1;
}

/* Photo layer (Flashes 2-4) */
.a7-photo {
  position: absolute; inset: 0;
  background-color: #050402;
  background-size: cover;
  background-repeat: no-repeat;
  transform-origin: center center;
  will-change: transform, filter;
  filter: blur(0px);
}
.a7-photo-current {
  z-index: 1;
  animation: a7FocusBreath 9s ease-in-out infinite;
}
.a7-photo-next {
  z-index: 2;
}
@keyframes a7FocusBreath {
  0%, 100% { filter: blur(0px); }
  50%      { filter: blur(0.55px); }
}

/* Synthetic backdrop (Flash 1 only) — dark navy register */
.a7-synthetic-backdrop {
  position: absolute; inset: 0;
  z-index: 1;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(40, 70, 120, 0.35) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 80%, rgba(20, 30, 60, 0.4) 0%, transparent 60%),
    linear-gradient(135deg, #0a1220 0%, #06080f 60%, #050708 100%);
}

/* CHROMATIC ABERRATION — RGB channel offset at frame corners */
.a7-chromatic {
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

/* HALATION — radial film glow tinted to flash register */
.a7-halation {
  position: absolute;
  inset: -10%;
  z-index: 4;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(40px);
  opacity: 0.6;
  will-change: background;
}

/* THREE-TIER ATMOSPHERIC HAZE — Hurlbut diffusion technique */
.a7-haze {
  position: absolute;
  inset: -20%;
  z-index: 5;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.a7-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.025' numOctaves='3' seed='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 0.18 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 200% 150%;
  opacity: 0.22;
  animation: a7HazeFar 38s linear infinite;
  filter: blur(12px);
}
.a7-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.025 0.04' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.75  0 0 0 0.22 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 180% 130%;
  opacity: 0.20;
  animation: a7HazeMid 26s linear infinite;
  filter: blur(8px);
}
.a7-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.06' numOctaves='2' seed='13'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.82  0 0 0 0.16 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 160% 120%;
  opacity: 0.16;
  animation: a7HazeNear 18s linear infinite;
  filter: blur(5px);
}
@keyframes a7HazeFar {
  0%   { transform: translateX(-2%) translateY(0%) scale(1.02); }
  50%  { transform: translateX(2%) translateY(-1%) scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%) scale(1.02); }
}
@keyframes a7HazeMid {
  0%   { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%) scale(1.06); }
  100% { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
}
@keyframes a7HazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
  50%  { transform: translateX(2%) translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
}

/* DUST PARTICLE FIELD */
.a7-dust {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}
.a7-mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 240, 210, 0.85) 0%, rgba(255, 240, 210, 0) 70%);
  box-shadow: 0 0 4px rgba(255, 240, 210, 0.4);
  will-change: transform, opacity;
  animation-name: a7MoteDrift;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  opacity: 0;
}
@keyframes a7MoteDrift {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.55; }
  50%  { transform: translate(20px, -40px); opacity: 0.65; }
  90%  { opacity: 0.4; }
  100% { transform: translate(40px, -80px); opacity: 0; }
}

/* VIGNETTE GRADE */
.a7-grade {
  position: absolute; inset: 0;
  z-index: 7;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%);
}

/* SUBTLE SCANLINES */
.a7-scanlines {
  position: absolute; inset: 0;
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
.a7-grain {
  position: absolute; inset: 0;
  z-index: 9;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.55;
  animation: a7GrainShift 0.5s steps(4) infinite;
}
@keyframes a7GrainShift {
  0%   { background-position: 0 0; }
  25%  { background-position: 23px -41px; }
  50%  { background-position: -67px 11px; }
  75%  { background-position: 31px 53px; }
  100% { background-position: 0 0; }
}

/* WARM TINT MULTIPLY */
.a7-warm-tint {
  position: absolute; inset: 0;
  z-index: 10;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(80, 40, 10, 0.07) 0%,
    rgba(40, 20, 5, 0.04) 50%,
    rgba(10, 5, 2, 0.13) 100%);
  mix-blend-mode: multiply;
}

/* ANAMORPHIC LENS FLARE — horizontal cyan streak fires with bloom */
.a7-anamorphic {
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
.a7-anamorphic::after {
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

.a7-svg {
  position: absolute; inset: 0;
  z-index: 50;
  pointer-events: none;
  transform-origin: center center;
  will-change: opacity, transform;
}

.a7-cine {
  position: absolute;
  left: 0; right: 0;
  height: 32px;
  background: #000;
  z-index: 80;
}
.a7-cine.top { top: 0; }
.a7-cine.bot { bottom: 0; }

.a7-caption {
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
  will-change: opacity;
}

.a7-bloom {
  position: absolute;
  inset: 0;
  z-index: 90;
  background: #fff;
  pointer-events: none;
  will-change: opacity;
}

.a7-skip-btn {
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

/* ============================================================== */
/* FLASH 1 — Synthetic load card                                  */
/* ============================================================== */
.f1-loadcard-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
}
.f1-loadcard {
  width: 100%;
  max-width: 400px;
  background: linear-gradient(180deg, rgba(20, 32, 50, 0.95), rgba(12, 20, 36, 0.96));
  border: 1px solid rgba(120, 160, 220, 0.28);
  border-radius: 8px;
  padding: 18px 18px 16px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  font-family: 'IBM Plex Mono', monospace;
  will-change: opacity, transform;
}
.f1-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
}
.f1-broker-chip {
  display: flex;
  align-items: center;
  gap: 10px;
}
.f1-broker-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2a4870, #1a2a44);
  border: 1px solid rgba(160, 200, 240, 0.4);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #e0eaf4;
}
.f1-broker-info {
  line-height: 1.2;
}
.f1-broker-name {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #d8e0ec;
  font-weight: 600;
}
.f1-broker-rating {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #88a0c0;
  margin-top: 3px;
}
.f1-load-id {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #88a0c0;
}

.f1-lane {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding: 14px 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}
.f1-lane-pt {
  flex: 1;
  text-align: center;
}
.f1-lane-city {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #f0f4fa;
}
.f1-lane-time {
  font-size: 9px;
  letter-spacing: 0.14em;
  color: #88a0c0;
  margin-top: 3px;
}
.f1-lane-arrow {
  font-size: 18px;
  color: #6fcc88;
  font-weight: 300;
}

.f1-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 18px;
}
.f1-stat {
  flex: 1;
  text-align: center;
}
.f1-stat-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #88a0c0;
  margin-bottom: 4px;
}
.f1-stat-val {
  font-size: 18px;
  font-weight: 600;
  color: #e0eaf4;
  letter-spacing: 0.04em;
}
.f1-money {
  color: #6fcc88;
  text-shadow: 0 0 8px rgba(111, 204, 136, 0.3);
}

.f1-actions {
  display: flex;
  gap: 10px;
}
.f1-btn {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  border-radius: 4px;
}
.f1-btn-counter {
  border: 1px solid rgba(160, 180, 220, 0.4);
  color: #c8d4e4;
}
.f1-btn-accept {
  background: linear-gradient(180deg, #4ea872, #2e7c52);
  color: #fff;
  border: 1px solid rgba(120, 220, 160, 0.5);
  position: relative;
  overflow: hidden;
}
.f1-btn-shine {
  position: absolute;
  top: 0; bottom: 0;
  width: 30%;
  pointer-events: none;
  background: linear-gradient(105deg,
    transparent 0%,
    rgba(255, 255, 255, 0.0) 30%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0.0) 70%,
    transparent 100%);
  will-change: left;
}

/* COUNTER row — appears mid-flash with thinking dot pulse + lock check */
.f1-counter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 14px;
  background: linear-gradient(180deg, rgba(40, 70, 30, 0.4), rgba(20, 50, 20, 0.5));
  border: 1px solid rgba(111, 204, 136, 0.5);
  border-radius: 4px;
  box-shadow: 0 0 14px rgba(111, 204, 136, 0.18);
  will-change: opacity;
}
.f1-counter-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: #a8d8b8;
  font-weight: 600;
}
.f1-counter-val-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.f1-thinking-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffd24a;
  box-shadow: 0 0 6px rgba(255, 210, 74, 0.7);
  will-change: opacity;
}
.f1-counter-val {
  font-size: 18px;
  font-weight: 700;
  color: #6fcc88;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  text-shadow: 0 0 10px rgba(111, 204, 136, 0.4);
  min-width: 78px;
  text-align: right;
}
.f1-counter-check {
  font-size: 14px;
  color: #6fcc88;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(111, 204, 136, 0.6);
  will-change: opacity, transform;
}

/* ============================================================== */
/* FLASH 2 — Driver profile scouting card                         */
/* ============================================================== */
.f2-card {
  position: absolute;
  /* Top-right placement */
  top: 14%;
  right: 6%;
  width: 64%;
  max-width: 280px;
  background: rgba(8, 14, 28, 0.92);
  border: 1px solid rgba(245, 210, 154, 0.45);
  border-radius: 6px;
  padding: 14px 16px 12px;
  font-family: 'IBM Plex Mono', monospace;
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
  will-change: opacity, transform;
}
.f2-card-header {
  border-bottom: 1px solid rgba(245, 210, 154, 0.2);
  padding-bottom: 8px;
  margin-bottom: 10px;
}
.f2-card-name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #f5d29a;
}
.f2-card-cdl {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #b8b09a;
  margin-top: 3px;
}
.f2-stats { margin-bottom: 12px; }
.f2-stat {
  display: grid;
  grid-template-columns: 80px 1fr 28px;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.f2-stat-label {
  font-size: 8.5px;
  letter-spacing: 0.16em;
  color: #b8b09a;
}
.f2-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}
.f2-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffd24a, #f5d29a);
  box-shadow: 0 0 6px rgba(255, 200, 100, 0.4);
  will-change: width;
  border-radius: 2px;
}
.f2-bar-fill.f2-bar-good {
  background: linear-gradient(90deg, #6fcc88, #a0e0b0);
  box-shadow: 0 0 6px rgba(111, 204, 136, 0.5);
}
.f2-stat-val {
  font-size: 11px;
  color: #f0e6c8;
  font-weight: 600;
  text-align: right;
}
.f2-hire-pill {
  display: inline-block;
  padding: 6px 12px;
  background: rgba(70, 140, 90, 0.15);
  border: 1px solid #6fcc88;
  border-radius: 3px;
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #6fcc88;
  font-weight: 600;
  will-change: opacity, transform;
  box-shadow: 0 0 14px rgba(111, 204, 136, 0.3);
}

/* ============================================================== */
/* FLASH 3 — Auction bid                                          */
/* ============================================================== */

/* Wrapper that absorbs the camera-shake transform on gavel impact */
.f3-shake-wrap {
  position: absolute; inset: 0;
  will-change: transform;
}

/* Background bidder paddles SVG — fills full frame at low opacity */
.f3-paddles {
  position: absolute; inset: 0;
  z-index: 1;
  pointer-events: none;
  width: 100%; height: 100%;
  opacity: 0.55;
  will-change: contents;
}

/* AUCTIONEER ANNOUNCEMENT TICKER — top of frame, color shifts per phase */
.f3-announce {
  position: absolute;
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(8, 8, 12, 0.88);
  border: 1px solid rgba(245, 210, 154, 0.35);
  padding: 6px 16px 6px 14px;
  border-radius: 100px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  font-weight: 600;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: background 0.3s ease, border-color 0.3s ease;
  z-index: 6;
}
.f3-announce-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #ffd24a;
  box-shadow: 0 0 8px rgba(255, 210, 74, 0.85);
  flex-shrink: 0;
  will-change: opacity;
}
.f3-announce-text {
  color: #f5d29a;
}
.f3-announce-open .f3-announce-text  { color: #b8d6ff; }
.f3-announce-once .f3-announce-text  { color: #ffd24a; }
.f3-announce-twice .f3-announce-text { color: #ff9b3a; }
.f3-announce-twice .f3-announce-dot  { background: #ff9b3a; box-shadow: 0 0 12px rgba(255, 155, 58, 0.9); }
.f3-announce-sold {
  background: rgba(40, 14, 8, 0.95);
  border-color: rgba(255, 100, 80, 0.7);
}
.f3-announce-sold .f3-announce-text {
  color: #ff6b48;
  letter-spacing: 0.3em;
  font-weight: 800;
}
.f3-announce-sold .f3-announce-dot {
  background: #ff4422;
  box-shadow: 0 0 14px rgba(255, 68, 34, 0.95);
}

/* DUST PARTICLE POP — burst from gavel strike center */
.f3-dust-pop {
  position: absolute;
  left: 50%;
  top: 75%;
  width: 1px; height: 1px;
  pointer-events: none;
  z-index: 8;
}
.f3-dust-particle {
  position: absolute;
  left: 0; top: 0;
  width: 6px; height: 6px;
  margin-left: -3px; margin-top: -3px;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 230, 180, 0.95) 0%,
    rgba(255, 200, 120, 0.6) 40%,
    rgba(220, 180, 100, 0.0) 100%);
  filter: blur(1px);
  will-change: transform, opacity;
}

/* STRIKE WHITE FLASH — full-frame bloom at gavel impact moment */
.f3-strike-flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 75%,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 240, 200, 0.4) 30%,
    rgba(255, 240, 200, 0) 60%);
  z-index: 7;
  pointer-events: none;
  will-change: opacity;
}

/* Second concentric ripple ring (delayed 120ms behind primary) */
.f3-strike-ripple-b {
  border-color: rgba(255, 200, 80, 0.6) !important;
  border-width: 2px !important;
}

.f3-lot {
  position: absolute;
  top: 12%; left: 6%;
  background: rgba(8, 8, 12, 0.85);
  border: 1px solid rgba(255, 220, 130, 0.45);
  padding: 8px 12px;
  border-radius: 3px;
  font-family: 'IBM Plex Mono', monospace;
  text-align: center;
  will-change: opacity;
  z-index: 5;
}
.f3-lot-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #b8a880;
}
.f3-lot-num {
  font-size: 22px;
  font-weight: 600;
  color: #ffd24a;
  letter-spacing: 0.05em;
  line-height: 1;
  margin-top: 3px;
}

/* Bid history sidebar — left side, rows slot in */
.f3-bid-history {
  position: absolute;
  top: 26%;
  left: 6%;
  width: 38%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'IBM Plex Mono', monospace;
}
.f3-bid-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 10px;
  background: rgba(8, 8, 12, 0.78);
  border: 1px solid rgba(255, 220, 130, 0.25);
  border-radius: 3px;
  will-change: opacity, transform;
}
.f3-bid-bidder {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #b8a880;
}
.f3-bid-amt {
  font-size: 13px;
  font-weight: 600;
  color: #f5d29a;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.f3-bid {
  position: absolute;
  top: 12%; right: 6%;
  background: rgba(8, 8, 12, 0.88);
  border: 1px solid rgba(255, 220, 130, 0.55);
  padding: 10px 14px;
  border-radius: 3px;
  font-family: 'IBM Plex Mono', monospace;
  text-align: right;
}
.f3-bid-label {
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #b8a880;
}
.f3-bid-val {
  font-size: 22px;
  font-weight: 600;
  color: #ffd24a;
  letter-spacing: 0.04em;
  line-height: 1;
  margin-top: 3px;
  text-shadow: 0 0 10px rgba(255, 200, 80, 0.4);
}
.f3-bid-arrow {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #6fcc88;
  margin-top: 4px;
}

/* Time-left countdown chip — pulses urgency */
.f3-timer {
  position: absolute;
  top: 26%;
  right: 6%;
  background: rgba(50, 12, 8, 0.92);
  border: 1.5px solid #ff6b4a;
  border-radius: 3px;
  padding: 6px 10px;
  font-family: 'IBM Plex Mono', monospace;
  display: flex;
  align-items: baseline;
  gap: 6px;
  box-shadow: 0 0 14px rgba(255, 107, 74, 0.35);
  will-change: opacity, transform;
  transform-origin: center;
}
.f3-timer-label {
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: #ffb89a;
}
.f3-timer-val {
  font-size: 16px;
  font-weight: 700;
  color: #ff8c6f;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

/* Strike wrap — contains gavel/SOLD card AND the expanding ripple ring */
.f3-strike-wrap {
  position: absolute;
  bottom: 22%; left: 8%; right: 8%;
  pointer-events: none;
}
.f3-strike-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 60px;
  margin-left: -100px;
  margin-top: -30px;
  border-radius: 6px;
  border: 2px solid rgba(255, 220, 100, 0.8);
  box-shadow: 0 0 24px rgba(255, 220, 100, 0.5);
  will-change: opacity, transform;
}
.f3-strike {
  position: relative;
  background: linear-gradient(180deg, rgba(60, 36, 8, 0.92), rgba(40, 22, 4, 0.94));
  border: 1.5px solid rgba(255, 200, 80, 0.7);
  padding: 14px 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Anton', sans-serif;
  letter-spacing: 0.06em;
  box-shadow: 0 0 30px rgba(255, 180, 60, 0.35);
  will-change: opacity, transform, box-shadow;
  transform-origin: center;
}
.f3-strike-icon {
  font-size: 28px;
  color: #ffd24a;
  flex-shrink: 0;
  display: inline-block;
  transform-origin: center bottom;
  will-change: transform;
}
.f3-strike-text {
  font-size: 16px;
  color: #fff5d8;
  letter-spacing: 0.12em;
}

/* ============================================================== */
/* FLASH 4 — Dispatch HUD                                         */
/* ============================================================== */
/* ── F4 NEW LAYOUT: full-frame map background + top title bar + bottom HUD ── */

/* US map background — moved to TOP of viewport per design feedback so the
   dots and route lines align with the map directly without empty space above.
   Map occupies y=0 to y=534. The dispatch HUD + caption sit below the map. */
.f4-mapbg {
  position: absolute;
  top: 0; left: 0;
  width: 480px;
  height: 534px;
  background-color: #050a14;
  background-position: center center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  z-index: 0;
}
/* Vignette overlay — only dim the viewport edges where HUD/caption sit. The
   map area itself stays bright so geographic features remain crisp. */
.f4-mapbg-dim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(180deg,
      rgba(2, 6, 14, 0.55) 0%,
      rgba(2, 6, 14, 0.0) 6%,
      rgba(2, 6, 14, 0.0) 50%,
      rgba(2, 6, 14, 0.55) 60%,
      rgba(2, 6, 14, 0.92) 78%,
      rgba(2, 6, 14, 0.95) 100%);
}

/* Full-frame SVG overlay for cities, routes, truck markers */
.f4-mapsvg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

/* Top title bar — overlays the top of the map. Strong dark background ensures
   legibility against the cyan map underneath. */
.f4-hud-title-bar {
  position: absolute;
  top: 14px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(2, 6, 14, 0.92);
  border: 1px solid rgba(125, 211, 238, 0.55);
  border-radius: 100px;
  padding: 6px 14px;
  font-family: 'IBM Plex Mono', monospace;
  z-index: 4;
  white-space: nowrap;
  max-width: 92%;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  will-change: opacity, transform;
}
.f4-hud-title-bar .f4-hud-title {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: #a8d8ec;
  font-weight: 600;
}
.f4-hud-title-bar .f4-hud-time {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #708090;
  border-left: 1px solid rgba(80, 130, 160, 0.5);
  padding-left: 10px;
}

/* Bottom HUD container — load rows + KPI strip.
   Positioned higher (bottom: 18%) so the Marcus VO caption (which sits at
   bottom: 56px) lands BELOW the HUD without overlap. */
.f4-hud-bottom {
  position: absolute;
  left: 6%; right: 6%; bottom: 18%;
  background: rgba(4, 10, 20, 0.92);
  border: 1px solid rgba(80, 180, 220, 0.5);
  border-radius: 5px;
  padding: 9px 12px 11px;
  font-family: 'IBM Plex Mono', monospace;
  z-index: 4;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  will-change: opacity, transform;
}

/* --- legacy keys kept for backward-compat (load-row + kpi cells use these) --- */
.f4-hud {
  position: absolute;
  top: 12%; left: 6%; right: 6%;
  background: transparent;
  border: none;
  padding: 0;
  font-family: 'IBM Plex Mono', monospace;
  z-index: 4;
}
.f4-hud-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(80, 180, 220, 0.25);
  padding-bottom: 6px;
  margin-bottom: 8px;
}
.f4-hud-title {
  font-size: 11px;
  letter-spacing: 0.18em;
  color: #a8d8ec;
  font-weight: 600;
}
.f4-hud-time {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #708090;
}

.f4-load {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid rgba(80, 120, 160, 0.15);
  will-change: opacity, transform;
}
.f4-load:last-child { border-bottom: none; }
.f4-load-id {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #708090;
  font-weight: 600;
}
.f4-load-route {
  font-size: 11px;
  color: #d8e8f0;
  letter-spacing: 0.06em;
}
.f4-load-status {
  font-size: 9px;
  letter-spacing: 0.16em;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 2px;
  transform-origin: center;
  will-change: transform;
}
.f4-status-assigned {
  background: rgba(80, 130, 180, 0.18);
  color: #a8c8e8;
  border: 1px solid rgba(80, 130, 180, 0.4);
}
.f4-status-transit {
  background: rgba(255, 180, 60, 0.18);
  color: #ffd24a;
  border: 1px solid rgba(255, 180, 60, 0.5);
}
.f4-status-delivered {
  background: rgba(70, 160, 110, 0.2);
  color: #6fcc88;
  border: 1px solid rgba(70, 160, 110, 0.5);
}

/* KPI strip below load rows */
.f4-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid rgba(80, 180, 220, 0.25);
  will-change: opacity;
}
.f4-kpi {
  text-align: center;
}
.f4-kpi-label {
  font-size: 8.5px;
  letter-spacing: 0.18em;
  color: #708090;
  margin-bottom: 3px;
}
.f4-kpi-val {
  font-size: 16px;
  font-weight: 700;
  color: #a8d8ec;
  letter-spacing: 0.04em;
  line-height: 1;
}
.f4-kpi-unit {
  font-size: 10px;
  color: #708090;
  font-weight: 500;
  margin-left: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .a7-photo { transform: none !important; }
}
`;

export default Act7Decisions;
