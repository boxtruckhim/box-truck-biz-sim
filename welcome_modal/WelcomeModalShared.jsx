/**
 * WelcomeModalShared.jsx — Shared cinematic motion architecture
 *
 * Single source of truth for cinematic motion across all 12 acts of the
 * Welcome Modal. Extracted from Act 4 v3.1 after the visual language was
 * locked. All photo-anchored acts (1, 4, 8, 9, 12) and SVG-supported acts
 * (5, 10, 11) import these components and configure per-act parameters.
 *
 * COMPONENTS:
 *   <CinematicStage>       — Outer container with handheld jitter + reduce-motion handling
 *   <PhotoLayer>           — Single photo with Ken Burns motion + focus drift
 *   <VolumetricHaze>       — Three-layer SVG turbulence diffusion (Hurlbut technique)
 *   <ParticleField>        — Three-tier depth-of-field particle system
 *   <CinemaBars>           — Top/bottom letterbox bars with Empire Legacy easing
 *   <CinematicCaption>     — Netflix-prestige typography with shadowed text
 *   <AtmosphericLayers>    — Vignette + scanlines + grain + warm tint stack
 *
 * ACCESSIBILITY:
 *   All motion components respect:
 *   1. App.jsx parent class .perf-reduce-motion (inherited automatically)
 *   2. Standalone @media (prefers-reduced-motion: reduce) for direct-render contexts
 *   Pattern matches EmpireLegacyApex.jsx:927-935 reduce-motion handling.
 *
 * USAGE PATTERN (per-act):
 *   <CinematicStage>
 *     <PhotoLayer src={imgUrl} kenBurnsScale={[1.0, 1.08]} drift={[1.5, -0.5]} />
 *     <VolumetricHaze intensity="strong" />
 *     <ParticleField tier="depth-of-field" lampPosition={[0.5, 0.35]} />
 *     <AtmosphericLayers />
 *     <CinemaBars />
 *     <CinematicCaption text={dialogue} />
 *   </CinematicStage>
 *
 * SHARED CSS:
 *   Each component injects scoped styles via a <style> tag. To avoid duplicate
 *   stylesheets when multiple components mount in the same act, we use a
 *   module-level `stylesInjected` flag and inject the full bundle only once
 *   per page load. See SHARED_STYLES at the bottom of this file.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION GUARD
// ─────────────────────────────────────────────────────────────────────────────

let stylesInjected = false;
const useSharedStyles = () => {
  // Inject once per page. Subsequent component mounts read from the same
  // stylesheet rather than re-injecting (prevents duplicate animation rules
  // from causing flicker or doubled CSS specificity issues).
  useEffect(() => {
    if (stylesInjected) return;
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-welcome-modal-shared', 'true');
    styleEl.textContent = SHARED_STYLES;
    document.head.appendChild(styleEl);
    stylesInjected = true;
  }, []);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CinematicStage — outer container
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outer container for any cinematic act. Provides:
 *   - Handheld camera jitter (sub-pixel drift on 11.7s irrational period)
 *   - Reduce-motion class inheritance from App.jsx parent
 *   - Tap-highlight suppression for mobile
 *   - Standard cinematic font stack
 *
 * Children render inside this stage container with z-index ordering managed
 * by their individual styles.
 */
export const CinematicStage = React.memo(function CinematicStage({
  children,
  className = '',
  style = {},
}) {
  useSharedStyles();
  return (
    <div className={`wm-stage ${className}`} style={style}>
      {children}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PhotoLayer — Ken Burns motion + focus drift
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single photographic layer with calibrated Ken Burns motion and subtle focus
 * drift breathing. Crossfades between sibling PhotoLayers happen via opacity
 * controlled by the parent component (typically the Act's master timeline).
 *
 * PROPS:
 *   src               Image URL (GitHub raw URL for production, base64 for calibration)
 *   opacity           Current opacity (0-1) — driven by parent timeline
 *   kenBurnsScale     [from, to] scale range, e.g. [1.0, 1.08]
 *   drift             [shiftX%, shiftY%] over the layer's full duration
 *   progress          Current progress (0-1) within this layer's lifetime
 *   focusDriftPeriod  Seconds for the blur-breathing cycle (default 9s)
 *   focusDriftDelay   Seconds offset into the breathing cycle (default 0)
 *   backgroundPosition CSS bg-position (default 'center 40%')
 *   zIndex            Stacking order (default 1)
 */
export const PhotoLayer = React.memo(function PhotoLayer({
  src,
  opacity = 1,
  kenBurnsScale = [1.0, 1.05],
  drift = [0, 0],
  progress = 0,
  focusDriftPeriod = 9,
  focusDriftDelay = 0,
  backgroundPosition = 'center 40%',
  zIndex = 1,
}) {
  useSharedStyles();

  const [scaleFrom, scaleTo] = kenBurnsScale;
  const [driftX, driftY] = drift;
  const currentScale = scaleFrom + (scaleTo - scaleFrom) * Math.max(0, Math.min(1, progress));
  const currentDriftX = driftX * Math.max(0, Math.min(1, progress));
  const currentDriftY = driftY * Math.max(0, Math.min(1, progress));

  return (
    <div
      className="wm-photo-layer"
      style={{
        opacity,
        backgroundImage: src ? `url("${src}")` : 'none',
        backgroundPosition,
        transform: `scale(${currentScale}) translate(${currentDriftX}%, ${currentDriftY}%)`,
        zIndex,
        animationDuration: `${focusDriftPeriod}s`,
        animationDelay: `${focusDriftDelay}s`,
      }}
    />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. VolumetricHaze — Hurlbut diffusion technique
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three-layer volumetric haze that softens HD photo edges into 35mm film
 * texture. SVG turbulence noise drifting at three different speeds creates
 * depth-of-field atmospheric diffusion.
 *
 * Reference: Shane Hurlbut ASC on Act of Valor — "the texture of smoke
 * helped us cross-cut seamlessly from 35mm motion picture film and the 5D".
 *
 * PROPS:
 *   intensity   'subtle' | 'standard' | 'strong'  (default 'standard')
 *               subtle    = opacities [0.12, 0.15, 0.10]  — for bright outdoor scenes
 *               standard  = opacities [0.20, 0.28, 0.25]  — for indoor/dim scenes (Act 4)
 *               strong    = opacities [0.32, 0.38, 0.30]  — for night/extreme low-light
 */
export const VolumetricHaze = React.memo(function VolumetricHaze({ intensity = 'standard' }) {
  useSharedStyles();
  return (
    <>
      <div className={`wm-haze-layer wm-haze-near wm-haze-${intensity}`} />
      <div className={`wm-haze-layer wm-haze-mid wm-haze-${intensity}`} />
      <div className={`wm-haze-layer wm-haze-far wm-haze-${intensity}`} />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ParticleField — three-tier depth-of-field particle system
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Three-tier particle system creating depth-of-field atmospheric particles:
 *   Tier 1: Fine dust motes drifting upward through lamp shaft (background)
 *   Tier 2: Larger room dust drifting horizontally (mid-depth)
 *   Tier 3: Bright bokeh sparkles catching light (foreground occasional)
 *
 * Particles are deterministically positioned via seeded pseudo-random so they
 * render consistently across mounts. Density and lamp position can be tuned
 * per-act.
 *
 * PROPS:
 *   density        'minimal' | 'standard' | 'rich'  (default 'standard')
 *                  minimal  = 12 fine + 3 large + 2 bokeh   — for sparse outdoor scenes
 *                  standard = 24 fine + 6 large + 4 bokeh   — for indoor scenes (Act 4)
 *                  rich     = 36 fine + 9 large + 6 bokeh   — for atmospheric establishing
 *   lampPosition   [xPercent, yPercent] center of particle origin (default [50, 35])
 *   seed           Number to vary particle layout across acts (default 0)
 */
export const ParticleField = React.memo(function ParticleField({
  density = 'standard',
  lampPosition = [50, 35],
  seed = 0,
}) {
  useSharedStyles();

  const counts = useMemo(() => ({
    minimal:  { fine: 12, large: 3, bokeh: 2 },
    standard: { fine: 24, large: 6, bokeh: 4 },
    rich:     { fine: 36, large: 9, bokeh: 6 },
  }[density] || { fine: 24, large: 6, bokeh: 4 }), [density]);

  const fineMotes = useMemo(() => generateFineMotes(counts.fine, seed), [counts.fine, seed]);
  const largeParticles = useMemo(() => generateLargeParticles(counts.large, seed), [counts.large, seed]);
  const bokehSparkles = useMemo(() => generateBokehSparkles(counts.bokeh, lampPosition, seed), [counts.bokeh, lampPosition, seed]);

  return (
    <div className="wm-particle-container">
      {fineMotes.map((m, i) => (
        <div
          key={`fine-${seed}-${i}`}
          className="wm-mote wm-mote-fine"
          style={{
            left: `${m.x}%`, top: `${m.y}%`,
            width: `${m.size}px`, height: `${m.size}px`,
            opacity: m.opacity,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
          }}
        />
      ))}
      {largeParticles.map((p, i) => (
        <div
          key={`large-${seed}-${i}`}
          className="wm-mote wm-mote-large"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
      {bokehSparkles.map((b, i) => (
        <div
          key={`bokeh-${seed}-${i}`}
          className="wm-mote wm-mote-bokeh"
          style={{
            left: `${b.x}%`, top: `${b.y}%`,
            width: `${b.size}px`, height: `${b.size}px`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
});

// Deterministic particle generators — same seed produces same layout
function generateFineMotes(count, seed) {
  return Array.from({ length: count }, (_, i) => {
    const idx = i + seed * 1000;
    const s = (idx * 9301 + 49297) % 233280;
    return {
      x: (s / 233280) * 100,
      y: 15 + (((idx * 7919) % 65536) / 65536) * 75,
      delay: ((idx * 12347) % 16000) / 1000,
      duration: 8 + ((idx * 4621) % 7000) / 1000,
      size: 1.2 + ((idx * 8179) % 1200) / 1000,
      opacity: 0.18 + ((idx * 5743) % 4500) / 10000,
    };
  });
}

function generateLargeParticles(count, seed) {
  return Array.from({ length: count }, (_, i) => {
    const idx = i + seed * 1000;
    const s = (idx * 17389 + 81247) % 419430;
    return {
      x: (s / 419430) * 100,
      y: 25 + (((idx * 4231) % 65536) / 65536) * 50,
      delay: ((idx * 23371) % 22000) / 1000,
      duration: 14 + ((idx * 9851) % 8000) / 1000,
      size: 2.8 + ((idx * 13877) % 2500) / 1000,
      opacity: 0.15 + ((idx * 7589) % 2500) / 10000,
    };
  });
}

function generateBokehSparkles(count, lampPosition, seed) {
  const [lampX, lampY] = lampPosition;
  return Array.from({ length: count }, (_, i) => {
    const idx = i + seed * 1000;
    const s = (idx * 31397 + 102931) % 999983;
    // Bias bokeh sparkles toward the lamp position (within 35% radius)
    const angleSeed = ((idx * 23851) % 65536) / 65536;
    const angle = angleSeed * Math.PI * 2;
    const radiusSeed = ((idx * 41753) % 65536) / 65536;
    const radius = 5 + radiusSeed * 30;
    return {
      x: Math.max(8, Math.min(92, lampX + Math.cos(angle) * radius)),
      y: Math.max(20, Math.min(80, lampY + Math.sin(angle) * radius)),
      delay: 2 + ((idx * 41753) % 14000) / 1000,
      duration: 4 + ((idx * 17389) % 5000) / 1000,
      size: 4.5 + ((idx * 28391) % 3500) / 1000,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CinemaBars — Empire Legacy idiom letterbox
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top/bottom letterbox bars with Empire Legacy's signature easing.
 * Slides in on cubic-bezier(0.22, 1, 0.36, 1) at 0.1s delay.
 *
 * PROPS:
 *   barHeight    Bar height in pixels (default 32)
 *   delayMs      Delay before slide-in begins (default 100)
 *   visible      Whether bars should be visible (default true; can be set
 *                false to retract bars between phases)
 */
export const CinemaBars = React.memo(function CinemaBars({
  barHeight = 32,
  delayMs = 100,
  visible = true,
}) {
  useSharedStyles();
  const heightStyle = { height: `${barHeight}px` };
  const animationStyle = visible
    ? { animation: `wmCineSlideIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms forwards` }
    : { transform: 'translateY(-100%)' };
  const animationStyleBottom = visible
    ? { animation: `wmCineSlideInBottom 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms forwards` }
    : { transform: 'translateY(100%)' };
  return (
    <>
      <div className="wm-cine-top" style={{ ...heightStyle, ...animationStyle }} />
      <div className="wm-cine-bottom" style={{ ...heightStyle, ...animationStyleBottom }} />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CinematicCaption — Netflix-prestige typography
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Caption display with Netflix-prestige typography:
 *   - Pure white shadowed text, no border, no container
 *   - Multi-layer shadow stack for legibility against any photo
 *   - Subtle warm bloom tying to Welcome Modal's lamp-light atmosphere
 *
 * The component re-mounts on text change (via React key) to trigger the
 * fade-in animation. Pass null/undefined for text to hide the caption.
 *
 * PROPS:
 *   text       Caption text to display (or null to hide)
 *   bottom     Bottom offset in pixels (default 232px — above voicemail card)
 *   fontSize   Font size in pixels (default 16)
 */
export const CinematicCaption = React.memo(function CinematicCaption({
  text,
  bottom = 232,
  fontSize = 16,
}) {
  useSharedStyles();
  if (!text) return null;
  return (
    <div className="wm-caption" key={text} style={{ bottom: `${bottom}px` }}>
      <div className="wm-caption-text" style={{ fontSize: `${fontSize}px` }}>
        {text}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. AtmosphericLayers — vignette + scanlines + grain + warm tint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persistent atmospheric overlay stack that runs during all photo-anchored
 * acts. Adds the "filmed not animated" character to any cinematic.
 *
 * PROPS:
 *   vignette    Enable corner darkening (default true)
 *   scanlines   Enable subtle CRT-like scanline texture (default true)
 *   grain       Enable animated film grain (default true)
 *   warmTint    Enable warm color cast (default true)
 *   lightShaft  Enable subtle frame-wide warm enhancement (default true)
 */
export const AtmosphericLayers = React.memo(function AtmosphericLayers({
  vignette = true,
  scanlines = true,
  grain = true,
  warmTint = true,
  lightShaft = true,
}) {
  useSharedStyles();
  return (
    <>
      {lightShaft && <div className="wm-light-shaft" />}
      {vignette && <div className="wm-vignette" />}
      {scanlines && <div className="wm-scanlines" />}
      {grain && <div className="wm-grain" />}
      {warmTint && <div className="wm-warm-tint" />}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES — single CSS bundle injected once per page load
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_STYLES = `
/* ═══ STAGE ═══ */
.wm-stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  color: #f0e6c8;
  -webkit-tap-highlight-color: transparent;
  animation: wmHandheldJitter 11.7s ease-in-out infinite;
}

@keyframes wmHandheldJitter {
  0%   { transform: translate(0px, 0px); }
  17%  { transform: translate(-0.3px, 0.4px); }
  29%  { transform: translate(0.4px, -0.2px); }
  43%  { transform: translate(-0.4px, -0.3px); }
  61%  { transform: translate(0.2px, 0.4px); }
  79%  { transform: translate(-0.2px, -0.4px); }
  100% { transform: translate(0px, 0px); }
}

/* ═══ PHOTO LAYER ═══ */
.wm-photo-layer {
  position: absolute;
  inset: 0;
  background-color: #050402;
  background-size: cover;
  background-repeat: no-repeat;
  transform-origin: center center;
  will-change: transform, opacity, filter;
  animation: wmFocusDrift 9s ease-in-out infinite;
}

@keyframes wmFocusDrift {
  0%, 100% { filter: blur(0px); }
  50%      { filter: blur(0.6px); }
}

/* ═══ VOLUMETRIC HAZE — Hurlbut diffusion ═══ */
.wm-haze-layer {
  position: absolute;
  inset: -20%;
  z-index: 8;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.wm-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.025' numOctaves='3' seed='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 0.18 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 200% 150%;
  animation: wmHazeFar 38s linear infinite;
  filter: blur(12px);
}
.wm-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.025 0.04' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.75  0 0 0 0.22 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 180% 130%;
  animation: wmHazeMid 26s linear infinite;
  filter: blur(8px);
}
.wm-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.06' numOctaves='2' seed='13'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.82  0 0 0 0.16 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 160% 120%;
  animation: wmHazeNear 18s linear infinite;
  filter: blur(5px);
}

/* Intensity variants */
.wm-haze-far.wm-haze-subtle   { opacity: 0.12; }
.wm-haze-far.wm-haze-standard { opacity: 0.25; }
.wm-haze-far.wm-haze-strong   { opacity: 0.32; }
.wm-haze-mid.wm-haze-subtle   { opacity: 0.15; }
.wm-haze-mid.wm-haze-standard { opacity: 0.28; }
.wm-haze-mid.wm-haze-strong   { opacity: 0.38; }
.wm-haze-near.wm-haze-subtle   { opacity: 0.10; }
.wm-haze-near.wm-haze-standard { opacity: 0.20; }
.wm-haze-near.wm-haze-strong   { opacity: 0.30; }

@keyframes wmHazeFar {
  0%   { transform: translateX(-2%) translateY(0%) scale(1.02); }
  50%  { transform: translateX(2%) translateY(-1%) scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%) scale(1.02); }
}
@keyframes wmHazeMid {
  0%   { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%) scale(1.06); }
  100% { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
}
@keyframes wmHazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
  50%  { transform: translateX(2%) translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
}

/* ═══ LIGHT SHAFT ═══ */
.wm-light-shaft {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 50% 35%,
      rgba(255, 200, 130, 0.10) 0%,
      rgba(255, 170, 80, 0.05) 35%,
      transparent 65%),
    radial-gradient(ellipse 30% 70% at 30% 50%,
      rgba(255, 180, 100, 0.06) 0%,
      transparent 70%);
  mix-blend-mode: screen;
  animation: wmShaftBreath 5.5s ease-in-out infinite;
}
@keyframes wmShaftBreath {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1.05; }
}

/* ═══ PARTICLE SYSTEMS ═══ */
.wm-particle-container {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  overflow: hidden;
}
.wm-mote {
  position: absolute;
  border-radius: 50%;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  will-change: transform, opacity;
  pointer-events: none;
}
.wm-mote-fine {
  background: radial-gradient(circle, rgba(255, 220, 160, 0.95) 0%, rgba(255, 200, 120, 0.4) 50%, transparent 100%);
  filter: blur(0.4px);
  animation-name: wmMoteFineDrift;
}
@keyframes wmMoteFineDrift {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  50%  { transform: translate(8px, -22px); }
  90%  { opacity: 1; }
  100% { transform: translate(-4px, -48px); opacity: 0; }
}
.wm-mote-large {
  background: radial-gradient(circle, rgba(255, 215, 150, 0.7) 0%, rgba(255, 195, 110, 0.25) 60%, transparent 100%);
  filter: blur(1px);
  animation-name: wmMoteLargeDrift;
}
@keyframes wmMoteLargeDrift {
  0%   { transform: translate(0, 0) scale(1); opacity: 0; }
  15%  { opacity: 0.85; }
  50%  { transform: translate(18px, -14px) scale(1.1); opacity: 1; }
  85%  { opacity: 0.7; }
  100% { transform: translate(36px, -32px) scale(0.9); opacity: 0; }
}
.wm-mote-bokeh {
  background: radial-gradient(circle,
    rgba(255, 240, 200, 1) 0%,
    rgba(255, 220, 150, 0.85) 25%,
    rgba(255, 180, 90, 0.4) 55%,
    transparent 100%);
  filter: blur(1.5px);
  box-shadow: 0 0 8px rgba(255, 220, 150, 0.4);
  animation-name: wmMoteBokehFlash;
}
@keyframes wmMoteBokehFlash {
  0%, 100% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  20%      { transform: translate(2px, -3px) scale(1); opacity: 0.85; }
  50%      { transform: translate(4px, -8px) scale(1.15); opacity: 1; }
  80%      { transform: translate(6px, -14px) scale(0.95); opacity: 0.5; }
}

/* ═══ ATMOSPHERIC LAYERS ═══ */
.wm-vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0, 0, 0, 0.35) 78%, rgba(0, 0, 0, 0.65) 100%);
  z-index: 10;
  pointer-events: none;
}
.wm-scanlines {
  position: absolute; inset: 0;
  background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.0) 0px, rgba(0, 0, 0, 0.0) 2px, rgba(0, 0, 0, 0.10) 3px, rgba(0, 0, 0, 0.0) 4px);
  z-index: 11;
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: multiply;
}
.wm-grain {
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' /></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.4'/></svg>");
  z-index: 12;
  pointer-events: none;
  opacity: 0.18;
  mix-blend-mode: overlay;
  animation: wmGrainShift 0.5s steps(4) infinite;
}
@keyframes wmGrainShift {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(-1%, 1%); }
  50%  { transform: translate(1%, -1%); }
  75%  { transform: translate(-1%, -1%); }
  100% { transform: translate(0, 0); }
}
.wm-warm-tint {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(80, 40, 10, 0.10) 0%, rgba(40, 20, 5, 0.05) 50%, rgba(10, 5, 2, 0.18) 100%);
  z-index: 13;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* ═══ CINEMA BARS ═══ */
.wm-cine-top, .wm-cine-bottom {
  position: absolute;
  left: 0; right: 0;
  background: #000;
  z-index: 80;
  will-change: transform;
}
/* Subtle parchment-tan separator line at the cinema bar / stage boundary.
   Without this, dark SVG-driven acts (like Act 5's federal dashboard) don't
   visually distinguish the letterbox from the stage. The 0.5px line at low
   opacity reads as the edge of a film frame rather than a UI border. */
.wm-cine-top    { top: 0;    transform: translateY(-100%); border-bottom: 0.5px solid rgba(199, 184, 122, 0.20); }
.wm-cine-bottom { bottom: 0; transform: translateY(100%);  border-top:    0.5px solid rgba(199, 184, 122, 0.20); }
@keyframes wmCineSlideIn       { to { transform: translateY(0); } }
@keyframes wmCineSlideInBottom { to { transform: translateY(0); } }

/* ═══ CINEMATIC CAPTION — Netflix-prestige typography ═══ */
.wm-caption {
  position: absolute;
  left: 24px; right: 24px;
  z-index: 60;
  text-align: center;
  pointer-events: none;
  animation: wmCaptionEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes wmCaptionEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.wm-caption-text {
  display: inline-block;
  font-family: 'Outfit', sans-serif;
  font-weight: 400;
  line-height: 1.42;
  color: #fdf6e3;
  letter-spacing: 0.005em;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.95),
    0 2px 16px rgba(0, 0, 0, 0.85),
    0 0 28px rgba(255, 180, 90, 0.18);
  max-width: 100%;
  padding: 0;
}

/* ═══ REDUCE-MOTION ACCESSIBILITY (dual activation) ═══ */
/* Activation path 1: App.jsx applies .perf-reduce-motion to its root container.
   Activation path 2: Standalone @media (prefers-reduced-motion: reduce) for
   direct-render contexts like the calibration REVIEW.html harness. */
.perf-reduce-motion .wm-stage,
.perf-reduce-motion .wm-haze-layer,
.perf-reduce-motion .wm-light-shaft,
.perf-reduce-motion .wm-mote,
.perf-reduce-motion .wm-grain,
.perf-reduce-motion .wm-photo-layer {
  animation: none !important;
}

/* When reduce-motion is on, the cinema bar slide-in animation is disabled,
   so the bars would stay at their starting off-screen position. Snap them
   to the visible position instead — they're a unifying visual frame, not
   a motion effect, and the cinematic register depends on their presence. */
.perf-reduce-motion .wm-cine-top,
.perf-reduce-motion .wm-cine-bottom {
  transform: translateY(0) !important;
}

/* Caption needs the same treatment — its entrance animation is disabled under
   reduce-motion, so we set opacity:1 directly. */
.perf-reduce-motion .wm-caption {
  opacity: 1 !important;
  transform: translateY(0) !important;
}

@media (prefers-reduced-motion: reduce) {
  .wm-stage,
  .wm-haze-layer,
  .wm-light-shaft,
  .wm-mote,
  .wm-grain,
  .wm-photo-layer {
    animation: none !important;
  }
  .wm-cine-top,
  .wm-cine-bottom {
    transform: translateY(0) !important;
  }
  .wm-caption {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export default {
  CinematicStage,
  PhotoLayer,
  VolumetricHaze,
  ParticleField,
  CinemaBars,
  CinematicCaption,
  AtmosphericLayers,
};
