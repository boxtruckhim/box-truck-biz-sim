/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 12: The Handoff to the Horizon
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The synthesis. Combines the three strongest concepts from the 24-variant
 * exploration into one continuous take:
 *
 *   ▸ V17 emotional core   — Marcus offers brass-and-black vehicle keys
 *                            directly to camera (POV handoff — the player
 *                            IS the recipient)
 *   ▸ V1  photographic     — Coastal sunset highway as the destination
 *   ▸ V12 Marcus voice     — Four captions bridging into the close:
 *                            "It's time to put the hustle in motion."
 *
 * EMOTIONAL CONTRACT: The handoff is earned. The road is what was promised.
 *
 * ─── ASSETS (real photography, no illustration) ──────────────────────────
 *
 *   carkeys_optimized.jpg — Pexels photo #32437446 by Amar (CC0). A real
 *     tanned working hand offering a single industrial-style utility key
 *     against an out-of-focus warm industrial backdrop. The single hero
 *     key is more cinematic than a key jangle, and the natural skin tone
 *     reads as Marcus's Latino character without any color grading.
 *     Source 4000×6000 portrait, optimized to 1000×1500 JPEG q80 (~85 KB).
 *     Available as window.__ACT12_HANDOFF.
 *
 *   coastal_optimized.jpg — V1's hero photograph (user-provided), real
 *     coastal Pacific highway at golden hour. 1280x720 JPEG q80 (~127 KB).
 *     Available as window.__ACT12_HERO.
 *
 *   Total bundled imagery: ~241 KB of real photographic detail.
 *
 * ─── WHY THIS PHOTO (vs prior iterations) ────────────────────────────────
 *
 *   Iteration history:
 *     v1: Pexels #7642000 — two hands exchanging keys. House/skeleton
 *         keys, wrong for vehicle context.
 *     v2: Pexels #97079 — POV hand offering a car key fob. Unambiguously
 *         a vehicle key, but fair-skinned hand didn't match Marcus's
 *         Latino character. Also read as "luxury car" not "work truck."
 *     v3 (current): Pexels #32437446 — tanned working hand, single
 *         utility key, industrial warm bokeh background.
 *
 *   Why v3 wins:
 *     • Natural darker skin tone matches Marcus without color grading
 *     • Key is industrial/utility — reads as a work key, not consumer fob
 *     • Visible calluses and worker hand details add character
 *     • Warm industrial bokeh aligns with Act 12's sunset color palette
 *     • Portrait native orientation fits the stage naturally
 *     • Single hero key is more cinematic than a key cluster
 *     • Captions ("Keys are all yours") work fine — the line is idiomatic
 *
 * ─── FOCAL-POINT MATH (verified via annotation) ──────────────────────────
 *
 *   Photo dimensions:       1000 × 1500 px (portrait, 2:3)
 *   Stage dimensions:       480 × 1040 px (portrait, ~0.46)
 *   Photo focal points:
 *     - Key blade tip:  (47%, 36%)  — top of blade, with cuts
 *     - Key bow:        (47%, 58%)  — silver rectangular grip area
 *     - Finger grip:    (47%, 65%)  — thumb+forefinger holding the key
 *     - Hand center:    (50%, 82%)  — back of hand visible at bottom
 *
 *   Camera transforms (image scaled then translated):
 *     Beat 1:  scale(1.00) translate(-260px, -460px)   — bottom anchored, full hand+key visible
 *     Beat 2:  scale(1.50) translate(-510px, -735px)   — mid push, tracking up
 *     Beat 3:  scale(2.00) translate(-760px, -1010px)  — full key centered, ready for bloom
 *
 * ─── 4-BEAT CHOREOGRAPHY (extended +500ms per scene per user feedback) ──
 *
 *   0    →  600ms   Cross-fade in (handoff photo materializes)
 *   600  → 2000ms   BEAT 1 (1.4s) — wide established. Marcus VO: "Keys are
 *                   all yours."
 *   2000 → 4000ms   BEAT 2 (2.0s) — push-in toward key fob. Marcus VO:
 *                   "Keep it safe."
 *   4000 → 5700ms   BEAT 3 (1.7s) — tight on fob. Bloom begins. Marcus VO:
 *                   "The road's been waiting, kid." (this caption carries
 *                   the Act 4 voicemail bookend — "Welcome aboard, kid…")
 *   5700 → 7600ms   BEAT 4 (1.9s) — bloom resolves to sunset, DAY 1 lands.
 *                   Marcus VO close: "It's time to put the hustle in
 *                   motion." (extended to 1.6s for the longer line)
 *   7900ms+         CTA materializes with no caption competition.
 *   8300ms+         CTA tappable.
 *
 * ─── ZERO-OVERLAP LAYOUT (per user feedback) ─────────────────────────────
 *
 *   Marcus's "It's time to put the hustle in motion." caption ends at
 *   7600ms (BEFORE the CTA begins materializing at 7900ms). At no point
 *   are caption + CTA both on screen — visual focus shifts cleanly from
 *   caption to CTA.
 *
 *   Vertical layout (no element overlaps another):
 *     y ≈ 460     DAY 1 headline (top: 44%, was 56% then 49%)
 *     y ≈ 552     Subtitle "The road is open."
 *     y ≈ 552→704 Empty (152px breathing room)
 *     y ≈ 704     CTA top (bottom: 280px)
 *     y ≈ 760     CTA bottom
 *     y ≈ 760→916 Empty (156px breathing room)
 *     y ≈ 916     Caption zone scrim top (only visible during active caption)
 *     y ≈ 994     Caption text baseline
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

import {
  CinematicStage,
  CinemaBars,
} from '../WelcomeModalShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// TIMING (act-local ms)
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = {
  // Hero photo cross-fade in
  heroFadeStart:     0,
  heroFadeEnd:       600,

  // Beat 1 — wide handoff (camera holds)
  beat1Start:        600,
  beat1End:          2000,    // was 1500 (+500ms scene extension)

  // Beat 2 — push-in toward keys
  beat2Start:        2000,    // was 1500 (shifted +500)
  beat2End:          4000,    // was 3000 (+500 from prior shift + 500 own extension)

  // Beat 3 — tight on keys, bloom begins
  beat3Start:        4000,    // was 3000 (shifted +1000)
  beat3End:          5700,    // was 4200 (+1000 + 500 own)
  bloomStart:        5000,    // was 3500 (shifted +1500)
  bloomFullSize:     6000,    // was 4500

  // Beat 4 — cross-fade to sunset, DAY 1 + CTA reveal
  beat4Start:        5700,    // was 4200
  sunsetCrossfade:   5900,    // was 4400
  sunsetFull:        6400,    // was 4900
  dayHeadlineStart:  6000,    // was 4500
  dayHeadlineEnd:    6500,    // was 5000
  subtitleStart:     9100,    // was 7600 — starts after extended caption 4 ends
  subtitleEnd:       9700,    // was 8200
  ctaStart:          9400,    // was 7900 — clean 300ms gap after caption4End
  ctaEnd:            10000,   // was 8500
  ctaTappableMs:     9800,    // was 8300

  // Caption VO timing (Marcus's lines).
  //
  // Caption 4 EXTENDED by +1500ms (now 3.1s display time) for the longer
  // new text "And now, it's officially time to put the hustle in motion."
  // (58 chars) — needs more time to read comfortably.
  //
  // Caption 4 ENDS at 9100ms — fully gone before the CTA begins materializing
  // at 9400ms. Zero overlap between caption text and CTA. Cinematic sequencing:
  //   6000-9100: DAY 1 reveals + caption 4 together (3.1s for the longer line)
  //   9100-9400: caption gone, subtitle types in, CTA still hidden
  //   9400-10000: CTA materializes (caption fully cleared)
  //   9800+:     CTA tappable
  caption1Start:     800,
  caption1End:       2200,    // was 1700 (+500ms read time)
  caption2Start:     2400,    // was 1900 (+500 shift)
  caption2End:       3900,    // was 2900 (+1000 = +500 shift + 500 read time)
  caption3Start:     4400,    // was 3200 (+1200 shift)
  caption3End:       5700,    // was 4200 (+1500 = +1000 shift + 500 read time)
  caption4Start:     6000,
  caption4End:       9100,    // was 7600 — extended +1500ms for longer text ("And now, it's officially time to put the hustle in motion.")
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMS — verified focal points for the real photograph
// ─────────────────────────────────────────────────────────────────────────────

const BEAT_TRANSFORMS = {
  // scale, translateX (px), translateY (px) — applied to a 1000x1500 portrait
  // photo displayed at native pixels (1px = 1px) inside a 480x1040 stage.
  //
  // FRAMING STRATEGY (per user feedback):
  //   Beat 1 anchors the photo's BOTTOM edge to the stage's BOTTOM edge —
  //   "the display screen is from the bottom of the image, up." This shows
  //   the full hand at the bottom plus the full key plus some bokeh above.
  //   As the camera pushes in (Beats 2 → 3), it also tilts UP so that the
  //   key body lands at stage center when fully zoomed in, just before
  //   the bloom transition fires.
  //
  // Photo focal points (Pexels #32437446):
  //   - Key blade tip:  (50%, 36%)
  //   - Key center:     (50%, 51%)  — midpoint of visible key body
  //   - Key bow:        (50%, 58%)
  //   - Hand center:    (50%, 82%)
  //
  // Math (using measured key center x=50%):
  //   Beat 1: photo bottom 1500 maps to stage bottom 1040 → ty = -460
  //           photo x=500 (50%) maps to stage center 240 → tx = -260
  //   Beat 3: key center (50%, 51%) at scale 2.0 → photo (1000, 1530)
  //           maps to stage center (240, 520) → tx = -760, ty = -1010
  //   Beat 2: linear midpoint of Beat 1 and Beat 3 at scale 1.5
  //
  beat1: { scale: 1.00, tx: -260, ty: -460  },   // bottom-anchored — full hand + full key visible
  beat2: { scale: 1.50, tx: -510, ty: -735  },   // mid push — tracking up toward key
  beat3: { scale: 2.00, tx: -760, ty: -1010 },   // full key centered — bloom emerges from here
};

// ─────────────────────────────────────────────────────────────────────────────
// EASINGS
// ─────────────────────────────────────────────────────────────────────────────

const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuint   = (t) => 1 - Math.pow(1 - t, 5);
const easeInQuad     = (t) => t * t;
const clamp01        = (v) => Math.max(0, Math.min(1, v));
const lerp           = (a, b, t) => a + (b - a) * t;

// Paper-impact bounce for CTA materialize
const paperBounce = (t) => {
  if (t < 0.5) return 1.10 - (1.10 - 1.04) * easeOutCubic(t / 0.5);
  return 1.04 - (1.04 - 1.00) * easeOutCubic((t - 0.5) / 0.5);
};

// Pulse for CTA idle state
const ctaPulse = (cycleMs) => {
  const t = (cycleMs % 2000) / 2000;
  return 1.0 + 0.0125 + 0.025 * Math.sin(t * Math.PI * 2) * 0.5;
};
const ctaGlowPulse = (cycleMs) => {
  const t = (cycleMs % 2000) / 2000;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act12Launch = React.memo(function Act12Launch({
  onComplete = () => {},
  onSkip     = () => {},
  companyName = null,
  // Optional override for the headline. Defaults to 1 — the cinematic is
  // architected for "DAY 1" as the thematic payoff and the CTA "Start Your
  // Run" only matches dayNumber=1. The prop exists purely so the same
  // component can be reused in the future (e.g., a "Day 100" milestone
  // celebration screen) without refactoring. Do NOT wire this to the live
  // game day for the welcome modal — see component-header comment block.
  dayNumber  = 1,
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('12', elapsedMs);
  const [ctaPressed, setCtaPressed] = useState(false);

  // Master timer
  useEffect(() => {
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = now - startTime;
      setElapsedMs(elapsed);
      // Continue ticking as long as the cinematic is alive
      // (no auto-complete — user taps CTA to exit)
      if (elapsed < 30000) {  // safety cap to avoid runaway
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handoffUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.__ACT12_HANDOFF) return window.__ACT12_HANDOFF;
    return null;
  }, []);
  const sunsetUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.__ACT12_HERO) return window.__ACT12_HERO;
    return null;
  }, []);

  // Marcus VO captions
  const captions = useMemo(() => [
    { id: 1, text: 'Keys are all yours.',                                       start: PHASES.caption1Start, end: PHASES.caption1End },
    { id: 2, text: 'Keep it safe.',                                             start: PHASES.caption2Start, end: PHASES.caption2End },
    { id: 3, text: "The road's been waiting, kid.",                             start: PHASES.caption3Start, end: PHASES.caption3End },
    { id: 4, text: "And now, it's officially time to put the hustle in motion.", start: PHASES.caption4Start, end: PHASES.caption4End },
  ], [companyName]);

  // ─── DERIVED VISUAL STATE ───────────────────────────────────────────────

  // Hero fade-in (cross-dissolve from Act 11)
  const heroFade = useMemo(
    () => clamp01((elapsedMs - PHASES.heroFadeStart) / (PHASES.heroFadeEnd - PHASES.heroFadeStart)),
    [elapsedMs]
  );

  // CONTINUOUS SLOW ZOOM (replaces the previous 3-segment interpolation)
  //
  // Why: Cinematically, a single sustained push-in (Kubrick-style) feels
  // more emotional and weighted than 3 discrete beat poses connected by
  // interpolation. The captions already provide the pacing rhythm —
  // doubling that rhythm with stepped camera beats was busy.
  //
  // This implementation eases continuously from Beat 1 (wide, hand
  // anchored to bottom) to Beat 3 (tight, key centered) across the full
  // ~5.1 second window. Single easeInOutCubic curve — gentle acceleration,
  // mostly linear middle, gentle deceleration. No inter-segment velocity
  // changes. The viewer's eye is on one continuous journey toward the key.
  //
  // Beat 2 transform values remain in BEAT_TRANSFORMS for reference, but
  // are no longer interpolated through — the zoom passes through that
  // pose organically as the linear midpoint of Beat 1 ↔ Beat 3.
  const handoffTransform = useMemo(() => {
    if (elapsedMs < PHASES.beat1Start) {
      return { scale: BEAT_TRANSFORMS.beat1.scale, tx: BEAT_TRANSFORMS.beat1.tx, ty: BEAT_TRANSFORMS.beat1.ty };
    }
    if (elapsedMs >= PHASES.beat4Start) {
      return { scale: BEAT_TRANSFORMS.beat3.scale, tx: BEAT_TRANSFORMS.beat3.tx, ty: BEAT_TRANSFORMS.beat3.ty };
    }
    // Single continuous zoom: Beat 1 pose → Beat 3 pose over the full window
    const t = clamp01((elapsedMs - PHASES.beat1Start) / (PHASES.beat4Start - PHASES.beat1Start));
    const e = easeInOutCubic(t);
    return {
      scale: lerp(BEAT_TRANSFORMS.beat1.scale, BEAT_TRANSFORMS.beat3.scale, e),
      tx:    lerp(BEAT_TRANSFORMS.beat1.tx,    BEAT_TRANSFORMS.beat3.tx,    e),
      ty:    lerp(BEAT_TRANSFORMS.beat1.ty,    BEAT_TRANSFORMS.beat3.ty,    e),
    };
  }, [elapsedMs]);

  // Golden bloom (begins growing during beat 3, expands through beat 4)
  const bloomState = useMemo(() => {
    if (elapsedMs < PHASES.bloomStart) return { scale: 0, opacity: 0 };
    if (elapsedMs > PHASES.bloomFullSize + 800) return { scale: 6.0, opacity: 0 };  // faded out
    if (elapsedMs < PHASES.bloomFullSize) {
      const t = (elapsedMs - PHASES.bloomStart) / (PHASES.bloomFullSize - PHASES.bloomStart);
      const e = easeInOutCubic(t);
      return {
        scale:   lerp(0.1, 6.0, e),
        opacity: t < 0.7 ? t / 0.7 : 1.0,
      };
    }
    // Faded phase: bloom holds max scale, opacity drops to 0 over 800ms
    const fadeT = (elapsedMs - PHASES.bloomFullSize) / 800;
    return { scale: 6.0, opacity: 1 - fadeT };
  }, [elapsedMs]);

  // Sunset cross-fade in (Beat 4)
  const sunsetFade = useMemo(() => {
    if (elapsedMs < PHASES.sunsetCrossfade) return 0;
    if (elapsedMs > PHASES.sunsetFull) return 1;
    const t = (elapsedMs - PHASES.sunsetCrossfade) / (PHASES.sunsetFull - PHASES.sunsetCrossfade);
    return easeOutCubic(t);
  }, [elapsedMs]);

  // Sunset Ken Burns (begins when sunset is visible, continues indefinitely)
  const sunsetKenBurns = useMemo(() => {
    if (elapsedMs < PHASES.sunsetCrossfade) return 1.0;
    // Linear continuous push: 1.00 → 1.045 over the first 5 seconds of sunset,
    // then continues drifting slowly indefinitely for cinematic life
    const t = (elapsedMs - PHASES.sunsetCrossfade) / 5000;
    return 1.00 + 0.045 * Math.min(t, 1) + 0.005 * Math.sin((elapsedMs - PHASES.sunsetCrossfade) / 2400);
  }, [elapsedMs]);

  // DAY 1 headline reveal
  const dayHeadlineState = useMemo(() => {
    if (elapsedMs < PHASES.dayHeadlineStart) {
      return { opacity: 0, scale: 0.92, letterSpacing: 0.32 };
    }
    if (elapsedMs > PHASES.dayHeadlineEnd) {
      return { opacity: 1, scale: 1.0, letterSpacing: 0.18 };
    }
    const t = (elapsedMs - PHASES.dayHeadlineStart) /
              (PHASES.dayHeadlineEnd - PHASES.dayHeadlineStart);
    return {
      opacity:       easeOutCubic(t),
      scale:         0.92 + 0.08 * easeOutQuint(t),
      letterSpacing: 0.32 - 0.14 * easeOutCubic(t),
    };
  }, [elapsedMs]);

  // Subtitle "The road is open." typing
  const subtitleVisibleChars = useMemo(() => {
    if (elapsedMs < PHASES.subtitleStart) return 0;
    if (elapsedMs > PHASES.subtitleEnd)   return SUBTITLE_TEXT.length;
    const t = (elapsedMs - PHASES.subtitleStart) /
              (PHASES.subtitleEnd - PHASES.subtitleStart);
    return Math.floor(t * SUBTITLE_TEXT.length);
  }, [elapsedMs]);

  // CTA materialize state
  const ctaState = useMemo(() => {
    if (elapsedMs < PHASES.ctaStart) return { opacity: 0, scale: 0.92, borderProgress: 0, glowPulse: 0 };
    if (elapsedMs > PHASES.ctaEnd) {
      const idleMs = elapsedMs - PHASES.ctaEnd;
      return {
        opacity: 1,
        scale: ctaPulse(idleMs),
        borderProgress: 1,
        glowPulse: ctaGlowPulse(idleMs),
      };
    }
    const t = (elapsedMs - PHASES.ctaStart) / (PHASES.ctaEnd - PHASES.ctaStart);
    return {
      opacity:        Math.min(1, t * 3),
      scale:          paperBounce(t),
      borderProgress: easeOutCubic(t),
      glowPulse:      0,
    };
  }, [elapsedMs]);

  // Active caption (display Marcus's currently-speaking line)
  const activeCaption = useMemo(() => {
    return captions.find((c) => elapsedMs >= c.start && elapsedMs < c.end);
  }, [elapsedMs, captions]);

  // Caption-scrim opacity — fades in slightly before the caption text appears
  // and fades out slightly after it disappears. Keeps the scrim from lingering
  // and competing with the CTA visually when no caption is on screen.
  const captionScrimOpacity = useMemo(() => {
    const FADE = 180;  // ms fade in/out window
    let maxOp = 0;
    for (const c of captions) {
      if (elapsedMs < c.start - FADE) continue;
      if (elapsedMs > c.end + FADE) continue;
      let op;
      if (elapsedMs < c.start) {
        op = (elapsedMs - (c.start - FADE)) / FADE;
      } else if (elapsedMs < c.end) {
        op = 1;
      } else {
        op = 1 - (elapsedMs - c.end) / FADE;
      }
      if (op > maxOp) maxOp = op;
    }
    return clamp01(maxOp);
  }, [elapsedMs, captions]);

  // CTA tappability
  const ctaTappable = elapsedMs >= PHASES.ctaTappableMs;

  const handleCtaPress = useCallback(() => {
    if (!ctaTappable || ctaPressed) return;
    setCtaPressed(true);
    setTimeout(() => onComplete(), 250);
  }, [ctaTappable, ctaPressed, onComplete]);

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <CinematicStage>
      <style>{ACT12_STYLES}</style>

      <div className="a12s-stage">

        {/* ═══ HANDOFF PHOTO LAYER (Beats 1-3) ═══ */}
        {/* Photo positioned with explicit transform — gives precise focal-
            point control across the camera move. Photo size 1500x1000, scaled
            and translated to focus on the action. */}
        <div
          className="a12s-photo-frame"
          style={{
            opacity: heroFade * (1 - sunsetFade),
          }}
        >
          {handoffUrl && (
            <img
              className="a12s-handoff"
              src={handoffUrl}
              alt=""
              style={{
                transform: `translate(${handoffTransform.tx.toFixed(1)}px, ${handoffTransform.ty.toFixed(1)}px) scale(${handoffTransform.scale.toFixed(4)})`,
              }}
            />
          )}
          {/* Depot color grade — warm overlay for "dawn light through door" feel */}
          <div className="a12s-depot-grade" />
          {/* Vignette */}
          <div className="a12s-vignette" />
          {/* Subtle film grain */}
          <div className="a12s-grain" />
        </div>

        {/* ═══ SUNSET PHOTO LAYER (Beat 4+) ═══ */}
        <div
          className="a12s-sunset-frame"
          style={{ opacity: sunsetFade }}
        >
          {sunsetUrl && (
            <div
              className="a12s-sunset"
              style={{
                backgroundImage: `url("${sunsetUrl}")`,
                transform: `scale(${sunsetKenBurns.toFixed(4)})`,
              }}
            />
          )}
          {/* Sun-anchored radial glow */}
          <div className="a12s-sun-glow" />
          {/* Bottom darkening for CTA/text legibility */}
          <div className="a12s-bottom-grade" />
        </div>

        {/* ═══ GOLDEN BLOOM (Beat 3 → Beat 4 transition) ═══ */}
        {/* Radial gradient overlay that grows from the keys' position. Uses
            screen blend mode for additive light — preserves photo detail
            until the bloom intentionally takes over. */}
        <div
          className="a12s-bloom"
          style={{
            opacity: bloomState.opacity,
            transform: `translate(-50%, -50%) scale(${bloomState.scale.toFixed(3)})`,
          }}
        />

        {/* ═══ DAY 1 + SUBTITLE (Beat 4) ═══ */}
        <div className="a12s-text-zone" style={{ opacity: sunsetFade }}>
          <div
            className="a12s-day-headline"
            style={{
              opacity: dayHeadlineState.opacity,
              transform: `scale(${dayHeadlineState.scale.toFixed(3)})`,
              letterSpacing: `${dayHeadlineState.letterSpacing.toFixed(3)}em`,
            }}
          >
            DAY {dayNumber}
          </div>
          <div className="a12s-subtitle">
            {SUBTITLE_TEXT.substring(0, subtitleVisibleChars)}
            {subtitleVisibleChars < SUBTITLE_TEXT.length && (
              <span className="a12s-subtitle-cursor">|</span>
            )}
          </div>
        </div>

        {/* ═══ CTA BUTTON (Beat 4+, persistent) ═══ */}
        <button
          className={`a12s-cta ${ctaTappable ? 'tappable' : ''} ${ctaPressed ? 'pressed' : ''}`}
          onClick={handleCtaPress}
          disabled={!ctaTappable}
          style={{
            opacity: ctaState.opacity,
            transform: `translate(-50%, 0) scale(${ctaState.scale.toFixed(4)})`,
          }}
          aria-label="Start your run"
        >
          <svg className="a12s-cta-border" viewBox="0 0 240 56" preserveAspectRatio="none">
            <rect
              x="1" y="1" width="238" height="54" rx="3"
              fill="none"
              stroke="rgba(255, 200, 110, 0.95)"
              strokeWidth="1.5"
              strokeDasharray="584"
              strokeDashoffset={584 * (1 - ctaState.borderProgress)}
              style={{
                filter: `drop-shadow(0 0 ${(8 + (ctaState.glowPulse || 0) * 6).toFixed(1)}px rgba(255, 195, 95, ${(0.5 + (ctaState.glowPulse || 0) * 0.4).toFixed(2)}))`,
              }}
            />
          </svg>
          <span className="a12s-cta-arrow">▶</span>
          <span className="a12s-cta-label">START YOUR RUN</span>
        </button>

        {/* ═══ CINEMA BARS ═══ */}
        <CinemaBars barHeight={28} delayMs={0} />

        {/* ═══ MARCUS CAPTION ZONE (continuous through all 4 beats) ═══ */}
        <div className="a12s-caption-zone">
          <div
            className="a12s-caption-scrim"
            style={{ opacity: captionScrimOpacity }}
          />
          {activeCaption && (
            <div className="a12s-caption-text" key={activeCaption.id}>
              {activeCaption.text}
            </div>
          )}
        </div>

        {/* ═══ SKIP BUTTON ═══ */}
        <button
          className="a12s-skip-btn"
          onClick={onSkip}
          aria-label="Skip act"
        >
          Skip
        </button>
      </div>
    </CinematicStage>
  );
});

const SUBTITLE_TEXT = 'The road is open.';

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ACT12_STYLES = `
.a12s-stage {
  position: absolute;
  inset: 0;
  background: #0a0805;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* ═══ HANDOFF PHOTO LAYER ═══ */
.a12s-photo-frame {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}
.a12s-handoff {
  position: absolute;
  top: 0; left: 0;
  width: 1000px;
  height: 1500px;
  transform-origin: 0 0;
  will-change: transform;
  /* No filter blur — preserves photographic detail */
  pointer-events: none;
  user-select: none;
}

/* Depot color grade — warm overlay simulating dawn light spilling in */
.a12s-depot-grade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 50% 30%,
      rgba(255, 170, 80, 0.18) 0%,
      rgba(255, 140, 60, 0.08) 35%,
      transparent 70%);
  mix-blend-mode: screen;
}

/* Cinematic vignette */
.a12s-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 100% 100% at 50% 50%,
      transparent 30%,
      rgba(0, 0, 0, 0.25) 70%,
      rgba(0, 0, 0, 0.55) 100%);
}

/* Subtle film grain (SVG noise) */
.a12s-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

/* ═══ SUNSET PHOTO LAYER ═══ */
.a12s-sunset-frame {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: hidden;
  pointer-events: none;
}
.a12s-sunset {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: 50% center;
  background-repeat: no-repeat;
  will-change: transform;
  transform-origin: 65% 50%;
}

.a12s-sun-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 70% 50% at 88% 40%,
    rgba(255, 200, 100, 0.30) 0%,
    rgba(255, 170, 70,  0.18) 30%,
    rgba(255, 140, 50,  0.06) 60%,
    transparent 100%);
  mix-blend-mode: screen;
}

.a12s-bottom-grade {
  position: absolute;
  left: 0; right: 0;
  bottom: 0;
  height: 50%;
  pointer-events: none;
  background: linear-gradient(180deg,
    transparent 0%,
    rgba(20, 8, 0, 0.20) 35%,
    rgba(20, 8, 0, 0.55) 75%,
    rgba(15, 5, 0, 0.85) 100%);
}

/* ═══ GOLDEN BLOOM (transition between handoff and sunset) ═══ */
/* Centered on the stage; positioned where the keys appear in Beat 3
   composition (roughly stage center after the push-in). Scales up from
   small point to 6x stage size, then fades. */
.a12s-bloom {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 480px;
  height: 480px;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(circle,
    rgba(255, 245, 215, 0.95) 0%,
    rgba(255, 215, 145, 0.85) 18%,
    rgba(255, 180, 80, 0.55) 38%,
    rgba(255, 145, 60, 0.20) 65%,
    transparent 100%);
  mix-blend-mode: screen;
  will-change: transform, opacity;
}

/* ═══ DAY 1 + SUBTITLE TYPOGRAPHY ZONE ═══ */
/* Moved up to top:38% (was 56% → 49% → 44% → 38%). With DAY 1 group
   ending around y≈487 on a 1040px stage (or y≈341 on a 728px laptop
   stage), and CTA top now at bottom:15% (proportional), there's at least
   200px of breathing room between subtitle and CTA on any device size. */
.a12s-text-zone {
  position: absolute;
  left: 0; right: 0;
  top: 38%;
  z-index: 30;
  text-align: center;
  pointer-events: none;
  will-change: opacity;
}
.a12s-day-headline {
  font-family: 'Outfit', 'SF Pro Display', sans-serif;
  font-size: 56px;
  font-weight: 900;
  color: rgba(255, 232, 175, 1);
  text-transform: uppercase;
  line-height: 1;
  text-shadow:
    0 0 24px rgba(255, 195, 95, 0.65),
    0 0 12px rgba(255, 200, 110, 0.85),
    0 2px 0 rgba(80, 40, 10, 0.55),
    0 4px 16px rgba(0, 0, 0, 0.55);
  will-change: transform, opacity, letter-spacing;
}
.a12s-subtitle {
  margin-top: 14px;
  font-family: 'Outfit', sans-serif;
  font-size: 17px;
  font-weight: 400;
  font-style: italic;
  color: rgba(252, 240, 218, 0.95);
  letter-spacing: 0.02em;
  text-shadow:
    0 0 12px rgba(0, 0, 0, 0.85),
    0 1px 3px rgba(0, 0, 0, 0.7);
  min-height: 22px;
}
.a12s-subtitle-cursor {
  display: inline-block;
  margin-left: 1px;
  color: rgba(255, 215, 145, 0.9);
  animation: a12s-cursor-blink 700ms steps(2) infinite;
}
@keyframes a12s-cursor-blink {
  0%, 49%   { opacity: 1; }
  50%, 100% { opacity: 0; }
}

/* ═══ CTA BUTTON ═══ */
/* Switched from fixed bottom:280px → proportional bottom:15%. The fixed
   pixel value caused collision with the subtitle on smaller stages (the
   master sequence's max-height:95vh shrinks the stage on laptops to ~728px,
   pushing fixed-pixel elements upward into other elements).
   
   Now bottom:15% scales correctly:
     1040px stage → CTA at y=828–884 (gap from subtitle ≈ 340px)
     728px stage  → CTA at y=563–619 (gap from subtitle ≈ 220px)
   And the CTA sits clearly toward the BOTTOM of the display in both cases. */
.a12s-cta {
  position: absolute;
  left: 50%;
  bottom: 15%;
  z-index: 35;
  width: 240px;
  height: 56px;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'Outfit', sans-serif;
  -webkit-tap-highlight-color: transparent;
  transform-origin: center;
  will-change: transform, opacity;
  transition: background 120ms ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 200, 110, 0.10);
}
.a12s-cta:disabled { cursor: default; }
.a12s-cta.tappable:active { background: rgba(40, 20, 5, 0.6); }
.a12s-cta.pressed {
  transform: translate(-50%, 0) scale(0.96) !important;
}
.a12s-cta-border {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.a12s-cta-arrow {
  font-size: 14px;
  color: rgba(255, 215, 145, 0.95);
  font-family: 'Outfit', sans-serif;
  font-weight: 600;
  margin-right: 2px;
}
.a12s-cta-label {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(255, 232, 175, 1);
  text-shadow:
    0 0 8px rgba(255, 195, 95, 0.5),
    0 1px 1px rgba(0, 0, 0, 0.7);
}

/* ═══ CAPTION ZONE (Marcus VO bookend lines) ═══ */
/* Switched from fixed pixels → proportional (bottom:3%, height:10%) for
   the same reason as the CTA. Scrim opacity is driven by JS so it only
   appears when a caption is actively visible.
   
   On a 1040px stage: caption zone occupies y=905–1009 (caption text near y=985)
   On a 728px stage:  caption zone occupies y=634–706 (caption text near y=688) */
.a12s-caption-zone {
  position: absolute;
  left: 0; right: 0;
  bottom: 3%;
  z-index: 60;
  pointer-events: none;
  height: 10%;
}
.a12s-caption-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    rgba(0, 0, 0, 0)    0%,
    rgba(0, 0, 0, 0.40) 25%,
    rgba(0, 0, 0, 0.80) 65%,
    rgba(0, 0, 0, 0.92) 100%);
  pointer-events: none;
  will-change: opacity;
  transition: opacity 80ms linear;
}
.a12s-caption-text {
  position: absolute;
  left: 24px; right: 24px;
  bottom: 14px;
  text-align: center;
  font-family: 'Outfit', 'SF Pro Display', sans-serif;
  font-size: 17px;
  font-weight: 500;
  font-style: italic;
  letter-spacing: 0.005em;
  line-height: 1.32;
  color: rgba(252, 240, 218, 0.97);
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 0 4px rgba(0, 0, 0, 0.7);
  animation: a12s-caption-in 320ms ease-out;
}
@keyframes a12s-caption-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ═══ SKIP BUTTON ═══ */
.a12s-skip-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgba(220, 195, 140, 0.30);
  background: rgba(0, 0, 0, 0.45);
  color: rgba(220, 195, 140, 0.78);
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
.a12s-skip-btn:active { transform: scale(0.96); }
`;

export default Act12Launch;
