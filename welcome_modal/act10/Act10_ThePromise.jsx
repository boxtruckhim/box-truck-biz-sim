/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 10: The Promise
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frame 1:38 → 1:48 (10s of content + 600ms cross-dissolve = 10600ms component
 * duration). Editorial brand · X-ray showpiece · investment claim. The act
 * after Act 9's prestige rise — where the cinematic stops describing and
 * starts CLAIMING. "Most games show you the truck. This one shows you the
 * industry."
 *
 * EMOTIONAL CONTRACT: Conviction. "This is genuinely a real simulator."
 *
 * Reference register: Apple keynote feature reveal, the X-ray sequence in
 * Tron Legacy, deep-dive product reveal from a luxury car launch.
 *
 * ─── ASSET (per ASSET_STRATEGY_AND_PROMPTS.md, production choice locked) ──
 *
 *   Production asset: box_truck_xray_top_left.png — Variant C, aerial 3/4
 *   angle from upper-left, empty cargo. Selected for its architectural /
 *   blueprint editorial feel matching Act 10's "Apple keynote feature
 *   reveal" register. Black background blends seamlessly via
 *   mix-blend-mode: screen.
 *
 *   The component supports 3 X-ray variants via the `xrayVariant` prop:
 *     - "top_left"    (DEFAULT, production)  — aerial 3/4 angle, empty cargo
 *     - "transparent"                         — rear doors open, glass-blue X-ray
 *     - "xray3"                               — rear doors closed, sharper engine
 *   All three remain bundled so any can be swapped in via prop without
 *   rebuilding.
 *
 * ─── ANIMATION CHOREOGRAPHY (timeline in act-local ms) ─────────────────────
 *
 *   0     →  1200ms   X-ray α-style entrance
 *                       translateY 20px → 0, scale 0.92 → 1.0, opacity 0 → 1
 *                       cubic-bezier(0.16, 1, 0.3, 1) — Empire Legacy easing
 *   1000  →  3000ms   Translucent blue pulse expands outward from X-ray center
 *                       radius 0 → 380, opacity 0.45 → 0
 *   1500  →  3000ms   Headline line 1 ("MOST GAMES SHOW YOU") slides in
 *   2000  →  3500ms   Headline line 2 ("THE TRUCK.") slides in
 *   4500  →  6000ms   Subhead line 1 ("This one shows you") slides in
 *   5000  →  6500ms   Subhead line 2 ("the industry.") slides in
 *   7500  →  8200ms   VERIFIED INVESTMENT stamp paper-impact lands
 *                       rotation -8° → 0°, scale 1.10 → 1.04 → 1.00
 *   8200  → 10000ms   Hold full composite (Marcus VO punchline lands here)
 *  10000  → 10600ms   Cross-dissolve out (600ms)
 *
 * ─── MARCUS DIALOGUE (storyboard v3.1, conviction, slower delivery) ──────
 *
 *   Line 1   1000 →  3000ms   "Most games show you the truck."
 *   Line 2   3500 →  5500ms   "This one shows you the industry."
 *   Line 3   6000 →  9000ms   "The brokers. The loads.
 *                              The inspections. The score."
 *   Line 4   9200 → 10000ms   "What it actually takes to last."
 *
 *   CAPTION DISPLAY POLICY (UX fix): Lines 1 and 2 are NOT shown as captions
 *   because the on-screen kinetic typography ("MOST GAMES SHOW YOU / THE
 *   TRUCK." and "This one shows you / the industry.") IS verbatim what
 *   Marcus says — captioning the same text twice creates visual redundancy
 *   and a sense of overlap. Typography acts as open-caption for lines 1+2.
 *   Captions ARE shown for lines 3 (four-noun rhythm) and 4 (punchline)
 *   because those are audio-only with no on-screen typography equivalent.
 *
 *   The "actually" word in the closer is intentional — implies this simulator
 *   delivers what other simulators only suggest.
 *
 * ─── PROPS INTERFACE ─────────────────────────────────────────────────────
 *
 *   onComplete    Called once at ACT_DURATION_MS — sequence advances
 *   onSkip        Called when player taps SKIP — immediate jump to next act
 *   xrayVariant   "transparent" | "xray3" | "top_left" (default: "transparent")
 *   xrayImageUrl  Optional override — direct data URI / URL string. If set,
 *                 this takes priority over xrayVariant.
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo } from 'react';
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

const ACT_DURATION_MS = 10000;
const FADE_OUT_MS     = 600;          // cross-dissolve to Act 11
const CONTENT_END_MS  = ACT_DURATION_MS - FADE_OUT_MS;

// ═══ ANIMATION PHASES ═══
const PHASES = {
  // X-ray α-entrance (Empire Legacy easing)
  xrayEntranceStart: 0,
  xrayEntranceEnd:   1200,

  // Blue radial pulse outward (single pulse)
  pulseStart:        1000,
  pulseEnd:          3000,

  // Headline kinetic typography (line 1: setup, line 2: punchline)
  headLine1Start:    1500,
  headLine1End:      3000,
  headLine2Start:    2000,
  headLine2End:      3500,

  // Subhead kinetic typography (industry pivot)
  subLine1Start:     4500,
  subLine1End:       6000,
  subLine2Start:     5000,
  subLine2End:       6500,

  // Gold "VERIFIED INVESTMENT" stamp (paper-impact bounce)
  stampStart:        7500,
  stampImpact:       7800,            // scale overshoots peak here
  stampSettle:       8200,            // settles into rest position
};

// ═══ DIALOGUE / VO TIMING (no captions for Act 10) ═══
//
// Act 10 is an editorial brand showpiece — the on-screen kinetic typography
// (headline + subhead + VERIFIED INVESTMENT stamp) carries the entire message.
// Captioning Marcus's voiceover here would only echo what the visuals already
// say, creating visual noise without adding meaning.
//
// VO timing kept here for documentation / audio integration only:
//   Line 1:  1000–3000ms — "Most games show you the truck."     (typography)
//   Line 2:  3500–5500ms — "This one shows you the industry."   (typography)
//   Line 3:  6000–9000ms — "The brokers. The loads.
//                          The inspections. The score."          (audio-only)
//   Line 4:  9200–10000ms — "What it actually takes to last."   (audio-only)
//
// VO segment array intentionally empty — no captions render in Act 10.
const VOICEMAIL_SEGMENTS = [];

// ═══ EASINGS ═══
const easeOutCubic   = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint   = (t) => 1 - Math.pow(1 - t, 5);
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Empire Legacy custom α-easing — cubic-bezier(0.16, 1, 0.3, 1)
// Approximated via easeOutQuint for our needs (very similar curve)
const easeOutAlpha   = (t) => 1 - Math.pow(1 - t, 5);

// Paper-impact bounce — overshoot + settle
const paperImpactBounce = (t) => {
  // 0..0.5 = scale overshoot from 1.10 → 1.04 (heavy stamp slamming down)
  // 0.5..1 = settle from 1.04 → 1.00 (paper rebound)
  if (t < 0.5) {
    const u = t / 0.5;
    return 1.10 - (1.10 - 1.04) * easeOutCubic(u);  // 1.10 → 1.04
  } else {
    const u = (t - 0.5) / 0.5;
    return 1.04 - (1.04 - 1.00) * easeOutCubic(u);  // 1.04 → 1.00
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act10ThePromise = React.memo(function Act10ThePromise({
  onComplete    = () => {},
  onSkip        = () => {},
  xrayVariant   = 'top_left',     // Variant C — aerial 3/4 angle, locked in production
  xrayImageUrl  = null,            // optional explicit override
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('10', elapsedMs);

  // Resolve the X-ray image URL from props, or fall back to global registry
  // (loaded by host page via Act 10's IMAGE_DATA_URIS.js).
  const xrayUrl = useMemo(() => {
    if (xrayImageUrl) return xrayImageUrl;
    if (typeof window !== 'undefined' && window.__ACT10_XRAY_IMAGES) {
      return window.__ACT10_XRAY_IMAGES[xrayVariant] || window.__ACT10_XRAY_IMAGES.transparent;
    }
    return null;
  }, [xrayVariant, xrayImageUrl]);

  // Master timer — single rAF loop with cleanup. Same pattern as Acts 5-9.
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

  // ─── DERIVED STATE ────────────────────────────────────────────────────────

  // X-ray α-style entrance state
  const xrayEntranceState = useMemo(() => {
    const t = clamp01((elapsedMs - PHASES.xrayEntranceStart) /
                      (PHASES.xrayEntranceEnd - PHASES.xrayEntranceStart));
    const e = easeOutAlpha(t);
    return {
      translateY: 20 - 20 * e,             // 20 → 0
      scale:      0.92 + 0.08 * e,         // 0.92 → 1.0
      opacity:    e,                        // 0 → 1
    };
  }, [elapsedMs]);

  // Blue radial pulse — single emanation
  const pulseState = useMemo(() => {
    if (elapsedMs < PHASES.pulseStart) return { opacity: 0, scale: 0 };
    if (elapsedMs > PHASES.pulseEnd)   return { opacity: 0, scale: 1 };
    const t = (elapsedMs - PHASES.pulseStart) / (PHASES.pulseEnd - PHASES.pulseStart);
    const e = easeOutCubic(t);
    return {
      scale:   e,                           // 0 → 1 (geometric expansion)
      opacity: 0.45 * (1 - t),              // 0.45 → 0 linear (independent of scale)
    };
  }, [elapsedMs]);

  // Headline typography state (two lines staggered)
  const headLine1 = useMemo(
    () => slideInState(elapsedMs, PHASES.headLine1Start, PHASES.headLine1End),
    [elapsedMs]
  );
  const headLine2 = useMemo(
    () => slideInState(elapsedMs, PHASES.headLine2Start, PHASES.headLine2End),
    [elapsedMs]
  );

  // Subhead typography state (two lines staggered)
  const subLine1 = useMemo(
    () => slideInState(elapsedMs, PHASES.subLine1Start, PHASES.subLine1End),
    [elapsedMs]
  );
  const subLine2 = useMemo(
    () => slideInState(elapsedMs, PHASES.subLine2Start, PHASES.subLine2End),
    [elapsedMs]
  );

  // Gold VERIFIED INVESTMENT stamp — paper-impact bounce
  const stampState = useMemo(() => {
    if (elapsedMs < PHASES.stampStart) {
      return { opacity: 0, rotation: -8, scale: 1.1 };
    }
    if (elapsedMs > PHASES.stampSettle) {
      return { opacity: 1, rotation: 0, scale: 1.0 };
    }
    const t = (elapsedMs - PHASES.stampStart) / (PHASES.stampSettle - PHASES.stampStart);
    return {
      opacity:  Math.min(1, t * 4),         // fade in fast (first 25%)
      rotation: -8 + 8 * easeOutQuint(t),   // -8° → 0°
      scale:    paperImpactBounce(t),       // 1.10 → 1.04 → 1.00
    };
  }, [elapsedMs]);

  // Cross-dissolve to Act 11
  const fadeOpacity = elapsedMs >= CONTENT_END_MS
    ? Math.min(1, (elapsedMs - CONTENT_END_MS) / FADE_OUT_MS)
    : 0;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <CinematicStage>
      <style>{ACT10_STYLES}</style>

      <div className="a10-stage">
        {/* X-ray illustration centerpiece — photographic asset
            (box_truck_xray_*.png) with black background blended via
            mix-blend-mode: screen so only the cyan-blue X-ray glow shows
            through against the pure-black canvas. Per ASSET_STRATEGY_AND_PROMPTS.md
            and storyboard v3.1 §act-10. */}
        <div
          className="a10-xray-container"
          style={{
            opacity: xrayEntranceState.opacity,
            transform: `translate(-50%, ${xrayEntranceState.translateY.toFixed(2)}px) scale(${xrayEntranceState.scale.toFixed(3)})`,
          }}
        >
          {xrayUrl ? (
            <img
              src={xrayUrl}
              alt="26ft box truck X-ray illustration"
              className="a10-xray-img"
              draggable={false}
            />
          ) : (
            // Fallback: render SVG X-ray if no image asset is loaded
            // (e.g. standalone preview without IMAGE_DATA_URIS.js)
            <XrayBoxTruckFallback />
          )}
          {/* Translucent blue radial pulse — emanates from X-ray center */}
          <div
            className="a10-xray-pulse"
            style={{
              opacity: pulseState.opacity,
              transform: `translate(-50%, -50%) scale(${0.05 + pulseState.scale * 1.6})`,
            }}
          />
        </div>

        {/* Kinetic typography — headline + subhead */}
        <div className="a10-typography">
          <div
            className="a10-head-line-1"
            style={lineStyle(headLine1)}
          >
            MOST GAMES SHOW YOU
          </div>
          <div
            className="a10-head-line-2"
            style={lineStyle(headLine2)}
          >
            THE TRUCK.
          </div>

          <div className="a10-divider" style={{ opacity: subLine1.opacity * 0.4 }} />

          <div
            className="a10-sub-line-1"
            style={lineStyle(subLine1)}
          >
            This one shows you
          </div>
          <div
            className="a10-sub-line-2"
            style={lineStyle(subLine2)}
          >
            the industry.
          </div>
        </div>

        {/* Gold VERIFIED INVESTMENT stamp */}
        <VerifiedInvestmentStamp state={stampState} />

        {/* Atmospheric layers (vignette, scanlines, grain) */}
        <AtmosphericLayers
          vignette
          scanlines
          grain
          warmTint={false}
          lightShaft={false}
        />

        {/* Cinema bars only — no captions in Act 10 (editorial brand showpiece;
            kinetic typography carries the message). */}
        <CinemaBars barHeight={28} delayMs={0} />

        {/* Cross-dissolve out */}
        <div className="a10-fade-out" style={{ opacity: fadeOpacity }} />

        {/* Skip button */}
        <button
          className="a10-skip-btn"
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
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// Standard slide-in state: opacity 0→1, translateY 12→0 over duration
function slideInState(elapsedMs, startMs, endMs) {
  if (elapsedMs < startMs) return { opacity: 0, translateY: 12 };
  if (elapsedMs > endMs)   return { opacity: 1, translateY: 0  };
  const t = (elapsedMs - startMs) / (endMs - startMs);
  const e = easeOutCubic(t);
  return {
    opacity:    e,
    translateY: 12 - 12 * e,
  };
}

function lineStyle(state) {
  return {
    opacity: state.opacity,
    transform: `translateY(${state.translateY.toFixed(2)}px)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// X-RAY BOX TRUCK SVG (FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used only when the photographic X-ray asset isn't loaded (e.g. when running
// the standalone preview without IMAGE_DATA_URIS.js). Production sequence
// always uses the photographic asset.
//
// Side-view 26ft box truck rendered as a blueprint-style X-ray. All elements
// stroked in cyan-blue with low opacity, blended via mix-blend-mode: screen
// against pure black background.
// ─────────────────────────────────────────────────────────────────────────────

const XrayBoxTruckFallback = React.memo(function XrayBoxTruckFallback() {
  return (
    <svg
      viewBox="0 0 800 360"
      xmlns="http://www.w3.org/2000/svg"
      className="a10-xray-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Outer-edge cyan glow filter */}
        <filter id="a10-glow-outer" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="a10-glow-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      <g style={{ mixBlendMode: 'screen' }}>
        {/* Simplified outer silhouette only (full anatomy version preserved
            in earlier git history; this fallback prioritizes load speed). */}
        <g stroke="rgba(180, 225, 255, 0.85)" strokeWidth="1.5" fill="none" filter="url(#a10-glow-outer)">
          <path d="M 78 245 L 78 165 Q 78 145 95 145 L 100 145
                   Q 110 105 130 105 L 175 105 Q 185 105 188 115 L 188 245 Z" />
          <rect x="200" y="80" width="500" height="170" />
          <circle cx="135" cy="260" r="36" />
          <circle cx="555" cy="260" r="36" />
          <circle cx="630" cy="260" r="36" />
        </g>
      </g>
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFIED INVESTMENT STAMP
// ─────────────────────────────────────────────────────────────────────────────
//
// Gold rectangular stamp mimicking the EmpireLegacyApex VERIFIED EXIT idiom.
// Paper-impact bounce: rotation -8° → 0°, scale 1.10 → 1.04 → 1.00 over 700ms.
// Slight asymmetric ink-bleed on the border to feel hand-stamped rather than
// vector-perfect.
// ─────────────────────────────────────────────────────────────────────────────

const VerifiedInvestmentStamp = React.memo(function VerifiedInvestmentStamp({ state }) {
  return (
    <div
      className="a10-stamp-container"
      style={{
        opacity: state.opacity,
        transform: `translate(-50%, -50%) rotate(${state.rotation.toFixed(2)}deg) scale(${state.scale.toFixed(3)})`,
      }}
    >
      <div className="a10-stamp-border">
        <div className="a10-stamp-inner-border">
          <div className="a10-stamp-text-row">VERIFIED</div>
          <div className="a10-stamp-text-row a10-stamp-text-bold">INVESTMENT</div>
          <div className="a10-stamp-divider" />
          <div className="a10-stamp-meta">BOX TRUCK BOSS · LIVE OPS</div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ACT10_STYLES = `
.a10-stage {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* ═══ X-RAY CONTAINER ═══ */
.a10-xray-container {
  position: absolute;
  left: 50%;
  top: 12%;          /* upper-third anchor (rule of thirds) — was 28% */
  /* translate(-50%, 0) is the CSS-baseline centering; inline-style transform
     (set by React) overrides this with the full translate+scale animation,
     and includes translate(-50%, ...) to maintain the centering. */
  transform: translate(-50%, 0);
  width: 96%;
  max-width: 480px;
  aspect-ratio: 800 / 540;  /* match photo aspect ~1.5:1 */
  z-index: 10;
  pointer-events: none;
  will-change: transform, opacity;
}

.a10-xray-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  /* Mix-blend-mode screen: the X-ray photo has black background, so this
     makes the black areas transparent and only the cyan-blue glow shows
     against the pure-black canvas. Per storyboard v3.1 §act-10. */
  mix-blend-mode: screen;
  filter: drop-shadow(0 0 24px rgba(120, 195, 255, 0.22));
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.a10-xray-svg {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 0 16px rgba(120, 195, 255, 0.18));
}

/* Translucent blue radial pulse — emanates from X-ray center.
   Sized as 280x280 base, scaled up via inline transform. */
.a10-xray-pulse {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at center,
    rgba(140, 200, 255, 0)    0%,
    rgba(120, 190, 255, 0.18) 45%,
    rgba(100, 180, 250, 0.42) 75%,
    rgba(90, 170, 245, 0.22)  92%,
    rgba(80, 160, 240, 0)     100%);
  mix-blend-mode: screen;
  will-change: transform, opacity;
  transform: translate(-50%, -50%) scale(0.05);
}

/* ═══ KINETIC TYPOGRAPHY ═══ */
.a10-typography {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;          /* was 60% — moved up to follow X-ray reposition */
  text-align: center;
  z-index: 20;
  pointer-events: none;
  padding: 0 28px;
}

.a10-head-line-1 {
  font-family: 'Outfit', sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.34em;
  color: rgba(232, 205, 150, 0.95);
  text-transform: uppercase;
  margin-bottom: 6px;
  will-change: transform, opacity;
  transition: opacity 80ms linear;
  /* Subtle warm glow + dark drop-shadow backstop so the subtitle stays legible
     against the cyan-blue X-ray bloom behind it. Glow halo is intentionally
     smaller and dimmer than the "THE TRUCK." line below so the visual
     hierarchy stays intact (subtitle subordinate, headline dominant). */
  text-shadow:
    0 0 10px rgba(255, 200, 130, 0.45),
    0 0 4px  rgba(255, 195, 120, 0.55),
    0 1px 3px rgba(0, 0, 0, 0.75),
    0 0 1px  rgba(0, 0, 0, 0.85);
}
.a10-head-line-2 {
  font-family: 'Outfit', sans-serif;
  font-size: 38px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: rgba(255, 220, 165, 1);
  text-shadow:
    0 0 24px rgba(255, 200, 130, 0.55),
    0 0 12px rgba(255, 195, 120, 0.7),
    0 2px 0 rgba(0, 0, 0, 0.5);
  text-transform: uppercase;
  line-height: 1.0;
  margin-bottom: 22px;
  will-change: transform, opacity;
}

.a10-divider {
  width: 36px;
  height: 1px;
  margin: 0 auto 22px auto;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(220, 195, 140, 0.65) 50%,
    transparent 100%);
}

.a10-sub-line-1 {
  font-family: 'Outfit', sans-serif;
  font-size: 16px;
  font-weight: 400;
  font-style: italic;
  letter-spacing: 0.04em;
  color: rgba(220, 215, 200, 0.82);
  margin-bottom: 6px;
  will-change: transform, opacity;
}
.a10-sub-line-2 {
  font-family: 'Outfit', sans-serif;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgba(255, 220, 165, 0.98);
  text-shadow:
    0 0 18px rgba(255, 200, 130, 0.45),
    0 2px 0 rgba(0, 0, 0, 0.5);
  line-height: 1.0;
  will-change: transform, opacity;
}

/* ═══ VERIFIED INVESTMENT STAMP ═══ */
.a10-stamp-container {
  position: absolute;
  left: 50%;
  top: 82%;          /* was 86% — moved up with the rest of the composition */
  transform: translate(-50%, -50%);
  z-index: 30;
  pointer-events: none;
  will-change: transform, opacity;
}

.a10-stamp-border {
  border: 2.5px solid rgba(255, 200, 110, 0.92);
  padding: 4px;
  border-radius: 2px;
  box-shadow:
    0 0 18px rgba(255, 195, 95, 0.35),
    inset 0 0 8px rgba(255, 195, 95, 0.10);
  background: rgba(0, 0, 0, 0.35);
  /* Slight asymmetric ink-bleed on outer border */
  filter: drop-shadow(-0.5px 0.5px 0 rgba(220, 165, 75, 0.4))
          drop-shadow(0.5px -0.3px 0 rgba(220, 165, 75, 0.4));
}
.a10-stamp-inner-border {
  border: 1px solid rgba(255, 200, 110, 0.55);
  padding: 10px 22px 9px 22px;
  text-align: center;
  font-family: 'IBM Plex Mono', monospace;
  color: rgba(255, 215, 145, 0.96);
}
.a10-stamp-text-row {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.32em;
  line-height: 1;
}
.a10-stamp-text-bold {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.18em;
  margin-top: 2px;
  color: rgba(255, 220, 160, 1);
  text-shadow: 0 0 6px rgba(255, 195, 95, 0.6);
}
.a10-stamp-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 200, 110, 0.5);
  margin: 6px 0 5px 0;
}
.a10-stamp-meta {
  font-size: 7px;
  font-weight: 500;
  letter-spacing: 0.28em;
  opacity: 0.85;
}

/* ═══ FADE OUT (cross-dissolve into Act 11) ═══ */
.a10-fade-out {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 90;
  pointer-events: none;
}

/* ═══ SKIP BUTTON ═══ */
.a10-skip-btn {
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
.a10-skip-btn:active { transform: scale(0.96); }
`;

export default Act10ThePromise;
