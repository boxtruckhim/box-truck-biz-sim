/**
 * Act 1 — Cold Open (5s) — Box Truck Boss Welcome Modal
 *
 * Following the locked v3.1 storyboard at lines 281-329. The first 5 seconds of
 * the entire cinematic. Establishes the documentary photoreal register and the
 * emotional contract: dread/seriousness. Reference: first minute of Sicario,
 * the patrol-strobes opening of True Detective S1.
 *
 * EMOTIONAL CONTRACT: Immediate seriousness. "This isn't a casual mobile game."
 *
 * VISUAL ARCHITECTURE:
 * Single photographic asset — `terminal_yard_dawn.png` — shows 4-5 box trucks
 * at a commercial trucking terminal at pre-dawn. Cold blue-white floodlights
 * across wet pavement, exhaust steam from idle stacks, dispatch building in
 * deep background with one warm yellow window glow. That glow is Marcus,
 * already inside, before he's introduced.
 *
 * The camera applies a slow Ken Burns push-in toward the dispatch window over
 * 4 seconds. By 0:04 the warm window is the visual anchor. At 0:045 a single
 * low orchestral note swells (audio handled in Stage 4). At 0:05 hard cut to
 * black for 100ms before Act 2.
 *
 * COLD-OPEN COLOR REGISTER:
 * Cold blue-white (sodium-vapor floodlights), navy/black (pre-dawn sky),
 * single accent of warm yellow (the dispatch window — Marcus's lamp). The
 * warm/cold contrast is load-bearing: Marcus is the warmth in the cold world
 * the player is about to enter. Acts 2-12 pay off this opening promise.
 *
 * Cold register is the inverse of Act 4 (warm Marcus voicemail) and same
 * register as Act 5 (cold federal dashboard). NO warm tint atmospheric layer
 * — the warmth is localized to the window light only.
 *
 * NO DIALOGUE:
 * Silent except for ambient and the single low note. The visual carries the
 * weight. This is the only act in the cinematic without Marcus speaking,
 * which makes Act 4's first words ("Hey kid — it's Marcus.") land harder.
 *
 * PHOTO ASSET:
 * The placeholder rendering uses an SVG composite that approximates the
 * intended photograph. When the production photo lands, swap the
 * `placeholderSvg` data URI for a real image URL — motion treatment
 * is asset-independent, all calibration translates directly. See
 * ACT1_IMAGE_PROMPT.md for the production photo specification.
 *
 * TIMING (5000ms total):
 *   0     - 200ms:    cinema bars slide in
 *   0     - 4000ms:   Ken Burns push toward window, scale 1.0 → 1.04
 *   3700  - 4500ms:   window glow intensifies (filter brightness 1.0 → 1.15)
 *   4000  - 4900ms:   final push, low orchestral note begins (audio Stage 4)
 *   4900  - 5000ms:   hard cut to black
 *
 * PROPS:
 *   imageUrl:   string|null  — production photo URL (null falls back to placeholder)
 *   onComplete: () => void   — called when act finishes (5.0s)
 *   onSkip:     () => void   — only available after act ends (storyboard rule)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';
import {
  CinematicStage,
  CinemaBars,
  AtmosphericLayers,
} from '../WelcomeModalShared.jsx';

const ACT_DURATION_MS = 6000;

// ─────────────────────────────────────────────────────────────────────────────
// SVG PLACEHOLDER — Terminal Yard at Pre-Dawn
//
// Captures the intended photograph's composition and palette so the motion
// treatment can be calibrated against something representative. Production
// will replace this with a generated photographic image — see prop `imageUrl`.
//
// COMPOSITION:
//   - Sky upper third (deep pre-dawn navy with subtle horizon glow)
//   - Yard mid third (cold blue-white floodlit pavement, truck silhouettes)
//   - Foreground lower third (wet pavement reflections)
//   - Dispatch building right side, single warm yellow window mid-frame-right
//
// COLOR PALETTE (matches the production photo specification):
//   #0A0E14  Pre-dawn sky (deep navy-black)
//   #131922  Mid-sky (slightly lighter)
//   #1F2933  Distant building silhouettes
//   #2E3A47  Truck silhouettes (cold)
//   #4A5868  Floodlit pavement (cold blue-white tint)
//   #FFB347  Dispatch window glow (warm yellow — Marcus's lamp)
//   #FFD584  Window glow center (warmer warm)
// ─────────────────────────────────────────────────────────────────────────────

const TERMINAL_YARD_PLACEHOLDER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <!-- Sky gradient: deep pre-dawn navy with subtle horizon glow -->
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#070A12"/>
      <stop offset="40%" stop-color="#0A0E14"/>
      <stop offset="80%" stop-color="#131922"/>
      <stop offset="100%" stop-color="#1A2230"/>
    </linearGradient>

    <!-- Pavement gradient: cold blue-white floodlight pools across wet ground -->
    <radialGradient id="floodlight1" cx="0.25" cy="0.55" r="0.4">
      <stop offset="0%" stop-color="#5A6878" stop-opacity="0.85"/>
      <stop offset="50%" stop-color="#3A4858" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#1F2933" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="floodlight2" cx="0.55" cy="0.62" r="0.35">
      <stop offset="0%" stop-color="#4A5868" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#2E3A47" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#1F2933" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="floodlight3" cx="0.78" cy="0.58" r="0.3">
      <stop offset="0%" stop-color="#3A4858" stop-opacity="0.65"/>
      <stop offset="50%" stop-color="#252F3B" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1F2933" stop-opacity="0"/>
    </radialGradient>

    <!-- Wet pavement reflection band -->
    <linearGradient id="wetPavement" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1F2933"/>
      <stop offset="50%" stop-color="#2A3540"/>
      <stop offset="100%" stop-color="#0F1620"/>
    </linearGradient>

    <!-- Dispatch window warm glow -->
    <radialGradient id="windowGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FFE4A8" stop-opacity="1"/>
      <stop offset="40%" stop-color="#FFB347" stop-opacity="0.95"/>
      <stop offset="80%" stop-color="#D4843A" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#8B5A2B" stop-opacity="0"/>
    </radialGradient>

    <!-- Window light spilling onto building face -->
    <radialGradient id="windowSpill" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FFB347" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#A87838" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <!-- Truck silhouette gradient (slightly graduated for subtle depth) -->
    <linearGradient id="truckBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#384452"/>
      <stop offset="50%" stop-color="#2C3742"/>
      <stop offset="100%" stop-color="#1F2933"/>
    </linearGradient>

    <!-- Distant haze for atmospheric perspective -->
    <linearGradient id="atmosphericHaze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1F2933" stop-opacity="0"/>
      <stop offset="50%" stop-color="#2A3540" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1F2933" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- ═══ SKY ═══ -->
  <rect x="0" y="0" width="1200" height="700" fill="url(#sky)"/>

  <!-- Subtle distant horizon glow (suggesting the dawn just beyond) -->
  <ellipse cx="900" cy="690" rx="500" ry="40" fill="#2A3540" opacity="0.5"/>
  <ellipse cx="900" cy="700" rx="350" ry="20" fill="#384452" opacity="0.35"/>

  <!-- ═══ DISTANT BUILDINGS / DEEP BACKGROUND ═══ -->
  <!-- Industrial silhouettes far back, very dim -->
  <rect x="0" y="620" width="180" height="80" fill="#161D26" opacity="0.85"/>
  <rect x="180" y="640" width="120" height="60" fill="#181F28" opacity="0.85"/>

  <!-- Warehouse silhouette behind trucks -->
  <rect x="80" y="540" width="600" height="160" fill="#181F28"/>
  <!-- Roof line of warehouse -->
  <polygon points="80,540 380,510 680,540" fill="#1A2230"/>

  <!-- ═══ DISPATCH BUILDING (RIGHT SIDE) ═══ -->
  <!-- Two-story dispatch office, slight angle, deep background -->
  <g>
    <!-- Building face -->
    <rect x="800" y="450" width="320" height="280" fill="#171E26"/>
    <!-- Slight perspective face on right -->
    <polygon points="1120,450 1180,470 1180,720 1120,730" fill="#0F1620"/>
    <!-- Roof edge -->
    <rect x="800" y="445" width="380" height="8" fill="#0A0E14"/>

    <!-- Window light spill on building face — warm wash around the window -->
    <circle cx="975" cy="585" r="180" fill="url(#windowSpill)"/>

    <!-- THE WINDOW — Marcus's window. The visual anchor. -->
    <!-- Window frame -->
    <rect x="940" y="560" width="80" height="60" fill="#3A2818"/>
    <!-- Window glow (will get brightness boost via filter) -->
    <rect x="945" y="565" width="70" height="50" fill="url(#windowGlow)" id="dispatch-window"/>
    <!-- Window cross bars (subtle) -->
    <line x1="980" y1="565" x2="980" y2="615" stroke="#3A2818" stroke-width="1.5" opacity="0.6"/>
    <line x1="945" y1="590" x2="1015" y2="590" stroke="#3A2818" stroke-width="1.5" opacity="0.6"/>

    <!-- Subtle silhouette hint inside window (a body, suggesting Marcus inside) -->
    <ellipse cx="980" cy="600" rx="14" ry="22" fill="#2A1A0A" opacity="0.45"/>

    <!-- Building details: vent stack, antenna -->
    <rect x="850" y="440" width="8" height="20" fill="#0A0E14"/>
    <line x1="900" y1="450" x2="900" y2="420" stroke="#0A0E14" stroke-width="1.5"/>
    <circle cx="900" cy="418" r="2" fill="#3A2818"/>
  </g>

  <!-- ═══ PAVEMENT / GROUND ═══ -->
  <rect x="0" y="700" width="1200" height="900" fill="url(#wetPavement)"/>

  <!-- Floodlight pools on pavement (cold blue-white) -->
  <ellipse cx="300" cy="880" rx="280" ry="100" fill="url(#floodlight1)"/>
  <ellipse cx="660" cy="990" rx="240" ry="90" fill="url(#floodlight2)"/>
  <ellipse cx="940" cy="930" rx="200" ry="75" fill="url(#floodlight3)"/>

  <!-- Wet pavement specular highlights (long horizontal smears suggesting water) -->
  <rect x="180" y="880" width="320" height="3" fill="#5A6878" opacity="0.4"/>
  <rect x="500" y="950" width="380" height="4" fill="#4A5868" opacity="0.5"/>
  <rect x="220" y="1080" width="500" height="3" fill="#3A4858" opacity="0.35"/>
  <rect x="600" y="1180" width="420" height="4" fill="#4A5868" opacity="0.45"/>

  <!-- ═══ TRUCKS ═══ -->
  <!-- Five 26ft box trucks parked in a row, three-quarter angle from low -->
  <!-- Truck 1 (leftmost, partial — cuts the frame on the left) -->
  <g>
    <!-- Box body -->
    <rect x="-30" y="780" width="320" height="200" fill="url(#truckBody)"/>
    <!-- Cab area (rounded front) -->
    <rect x="240" y="800" width="60" height="180" fill="#252F3B"/>
    <!-- Wheels -->
    <ellipse cx="40" cy="990" rx="28" ry="28" fill="#0A0E14"/>
    <ellipse cx="40" cy="990" rx="14" ry="14" fill="#252F3B"/>
    <ellipse cx="180" cy="990" rx="28" ry="28" fill="#0A0E14"/>
    <ellipse cx="180" cy="990" rx="14" ry="14" fill="#252F3B"/>
    <ellipse cx="270" cy="990" rx="22" ry="22" fill="#0A0E14"/>
    <!-- Cab roof line (catches floodlight) -->
    <rect x="-30" y="780" width="320" height="3" fill="#5A6878" opacity="0.4"/>
    <!-- Side reflective stripe -->
    <rect x="-30" y="900" width="320" height="2" fill="#FFB347" opacity="0.3"/>
  </g>

  <!-- Truck 2 -->
  <g>
    <!-- Box body -->
    <rect x="320" y="800" width="280" height="180" fill="url(#truckBody)"/>
    <rect x="555" y="815" width="50" height="165" fill="#252F3B"/>
    <ellipse cx="375" cy="990" rx="26" ry="26" fill="#0A0E14"/>
    <ellipse cx="375" cy="990" rx="13" ry="13" fill="#252F3B"/>
    <ellipse cx="500" cy="990" rx="26" ry="26" fill="#0A0E14"/>
    <ellipse cx="500" cy="990" rx="13" ry="13" fill="#252F3B"/>
    <ellipse cx="580" cy="990" rx="20" ry="20" fill="#0A0E14"/>
    <rect x="320" y="800" width="280" height="3" fill="#5A6878" opacity="0.3"/>
    <rect x="320" y="908" width="280" height="2" fill="#FFB347" opacity="0.25"/>
    <!-- Faint exhaust steam rising from this truck -->
    <ellipse cx="555" cy="785" rx="32" ry="18" fill="#5A6878" opacity="0.25"/>
    <ellipse cx="565" cy="765" rx="42" ry="22" fill="#4A5868" opacity="0.2"/>
    <ellipse cx="575" cy="740" rx="48" ry="26" fill="#3A4858" opacity="0.15"/>
  </g>

  <!-- Truck 3 (center) -->
  <g>
    <rect x="610" y="810" width="260" height="170" fill="url(#truckBody)"/>
    <rect x="830" y="822" width="48" height="158" fill="#252F3B"/>
    <ellipse cx="660" cy="985" rx="24" ry="24" fill="#0A0E14"/>
    <ellipse cx="660" cy="985" rx="12" ry="12" fill="#252F3B"/>
    <ellipse cx="780" cy="985" rx="24" ry="24" fill="#0A0E14"/>
    <ellipse cx="780" cy="985" rx="12" ry="12" fill="#252F3B"/>
    <ellipse cx="850" cy="985" rx="18" ry="18" fill="#0A0E14"/>
    <rect x="610" y="810" width="260" height="3" fill="#5A6878" opacity="0.35"/>
    <rect x="610" y="912" width="260" height="2" fill="#FFB347" opacity="0.28"/>
  </g>

  <!-- Truck 4 (rightmost visible, partially behind dispatch building) -->
  <g opacity="0.85">
    <rect x="700" y="820" width="200" height="155" fill="url(#truckBody)"/>
    <rect x="870" y="828" width="38" height="148" fill="#252F3B"/>
    <ellipse cx="745" cy="980" rx="22" ry="22" fill="#0A0E14"/>
    <ellipse cx="745" cy="980" rx="11" ry="11" fill="#252F3B"/>
    <ellipse cx="855" cy="980" rx="22" ry="22" fill="#0A0E14"/>
    <ellipse cx="855" cy="980" rx="11" ry="11" fill="#252F3B"/>
    <rect x="700" y="820" width="200" height="3" fill="#5A6878" opacity="0.3"/>
  </g>

  <!-- ═══ ATMOSPHERIC HAZE BETWEEN TRUCKS ═══ -->
  <!-- Subtle haze layer to suggest cold morning atmosphere -->
  <rect x="0" y="850" width="1200" height="100" fill="url(#atmosphericHaze)"/>

  <!-- ═══ FLOODLIGHT POLES (visual anchor that cuts the frame) ═══ -->
  <g>
    <!-- Pole 1 -->
    <rect x="115" y="240" width="4" height="540" fill="#0A0E14"/>
    <rect x="105" y="230" width="24" height="14" fill="#161D26"/>
    <!-- Light source glow -->
    <circle cx="117" cy="237" r="8" fill="#A8C0D8" opacity="0.65"/>
    <circle cx="117" cy="237" r="22" fill="#5A7088" opacity="0.25"/>

    <!-- Pole 2 -->
    <rect x="555" y="280" width="4" height="500" fill="#0A0E14"/>
    <rect x="545" y="270" width="24" height="14" fill="#161D26"/>
    <circle cx="557" cy="277" r="7" fill="#A8C0D8" opacity="0.6"/>
    <circle cx="557" cy="277" r="20" fill="#5A7088" opacity="0.22"/>

    <!-- Pole 3 (further back, smaller) -->
    <rect x="1080" y="320" width="3" height="430" fill="#0A0E14" opacity="0.85"/>
    <rect x="1072" y="312" width="20" height="12" fill="#161D26" opacity="0.85"/>
    <circle cx="1082" cy="318" r="5" fill="#A8C0D8" opacity="0.5"/>
    <circle cx="1082" cy="318" r="15" fill="#5A7088" opacity="0.18"/>
  </g>
</svg>
`.trim();

// Convert SVG string to data URI for use as background-image
const PLACEHOLDER_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(TERMINAL_YARD_PLACEHOLDER_SVG)}`;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act1ColdOpen = React.memo(function Act1ColdOpen({
  imageUrl = null,    // Production photo URL — null = use SVG placeholder
  onComplete = () => {},
  onSkip = () => {},  // Storyboard rule: Skip not available during Act 1
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('1', elapsedMs);
  const stageRef = useRef(null);

  // Master timer — single rAF loop with cleanup
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

  // ─── CROSS-DEVICE WINDOW POSITION CALIBRATION ───────────────────────────
  // The user's calibration (left:81.4%, top:47.1%, width:9.2%, height:4.2%)
  // was measured at viewport 480×1040. On other viewport sizes, the photo
  // crops differently due to background-size:cover, which shifts where the
  // window pixel lands in viewport space.
  //
  // This effect computes the actual window viewport position based on:
  //   - Source photo dimensions (1672×941)
  //   - Source window position (87.86%, 49.57% — pixel-measured)
  //   - Source window dimensions (1.44%, 2.66% — pixel-measured)
  //   - Current viewport dimensions
  //   - background-position values used by photo layer
  //
  // The result is set as CSS custom properties on the stage element, which
  // the glow CSS classes consume via var(). Recomputes on viewport resize.
  useEffect(() => {
    const PHOTO_W = 1672;
    const PHOTO_H = 941;
    const SRC_WINDOW_CX = 87.86 / 100;  // source-x of window center
    const SRC_WINDOW_CY = 49.57 / 100;  // source-y of window center
    const SRC_WINDOW_W = 1.44 / 100;    // source-width of window pane
    const SRC_WINDOW_H = 2.66 / 100;    // source-height of window pane

    // background-position used by .a1-photo-layer at END pose (90% 25%).
    // The window position only matters during the window-glow phase
    // (4.2s onward) when the pan has settled at the END pose.
    const BG_POS_X_END = 0.90;
    const BG_POS_Y_END = 0.25;

    function computeWindowPosition() {
      const stageRefEl = stageRef.current;
      if (!stageRefEl) return;

      // Walk up to find the actual stage element (.wm-stage from CinematicStage)
      // which is the ancestor of the glow layers. CSS variables must be set on
      // an ancestor for the glow layers to inherit them via var().
      const stage = stageRefEl.parentElement;
      if (!stage) return;

      const vw = stageRefEl.clientWidth;
      const vh = stageRefEl.clientHeight;
      if (vw === 0 || vh === 0) return;

      const photoAspect = PHOTO_W / PHOTO_H;
      const viewportAspect = vw / vh;

      // background-size: cover scaling — fit larger dimension
      let scaleFactor, displayedW, displayedH;
      if (photoAspect > viewportAspect) {
        // Photo wider than viewport — height matches viewport
        scaleFactor = vh / PHOTO_H;
        displayedW = PHOTO_W * scaleFactor;
        displayedH = vh;
      } else {
        // Photo taller than viewport — width matches viewport
        scaleFactor = vw / PHOTO_W;
        displayedW = vw;
        displayedH = PHOTO_H * scaleFactor;
      }

      // Compute background-position offset
      const overflowX = displayedW - vw;
      const overflowY = displayedH - vh;
      const imageOffsetX = -BG_POS_X_END * overflowX;
      const imageOffsetY = -BG_POS_Y_END * overflowY;

      // Window position in viewport (before photo's scale transform)
      const winX = SRC_WINDOW_CX * displayedW + imageOffsetX;
      const winY = SRC_WINDOW_CY * displayedH + imageOffsetY;
      const winWidth = SRC_WINDOW_W * displayedW;
      const winHeight = SRC_WINDOW_H * displayedH;

      // v2.1 fix: apply the photo's scale 1.10 from center origin so the
      // computed values represent where the window appears ON SCREEN at the
      // END pose. The user calibrated visually against the scaled photo,
      // so glow positions need to match that post-scale visual position.
      // The glow container does NOT scale (we removed its animation), so
      // these values get used directly as CSS without further transformation.
      const PHOTO_SCALE = 1.10;
      const cx = vw / 2;
      const cy = vh / 2;
      const winXScaled = cx + (winX - cx) * PHOTO_SCALE;
      const winYScaled = cy + (winY - cy) * PHOTO_SCALE;
      const winWidthScaled = winWidth * PHOTO_SCALE;
      const winHeightScaled = winHeight * PHOTO_SCALE;

      // Convert to viewport percentages
      const winXPct = (winXScaled / vw) * 100;
      const winYPct = (winYScaled / vh) * 100;
      const winWPct = (winWidthScaled / vw) * 100;
      const winHPct = (winHeightScaled / vh) * 100;

      // Pad window dimensions slightly for the core glow (so the warm glow
      // extends just past the actual window edges, like a bright bulb's
      // visible halo). User calibration was 9.2% × 4.2% which is ~6x the
      // raw window pixel dimensions — extending the visible glow beyond the
      // window itself.
      const corePadFactorX = 9.2 / winWPct;
      const corePadFactorY = 4.2 / winHPct;
      const coreWPct = winWPct * corePadFactorX;
      const coreHPct = winHPct * corePadFactorY;
      const coreLeftPct = winXPct - coreWPct / 2;
      const coreTopPct = winYPct - coreHPct / 2;

      // Pavement reflection sits below building base, centered on window x
      const pavementWPct = coreWPct * 2.4;
      const pavementHPct = coreHPct * 3.3;
      const pavementLeftPct = winXPct - pavementWPct / 2;
      const pavementTopPct = 62;  // building base is ~62% on calibration vp

      // v2.1: DISABLED — JS-computed values are off by ~1% due to imprecise
      // source-photo window measurement. The user's visual calibration is
      // ground truth and is set as the CSS fallback. Re-enable this if/when
      // we have more accurate source-photo measurements or need cross-device
      // adaptation more than calibration-viewport precision.
      //
      // stage.style.setProperty('--core-left', `${coreLeftPct.toFixed(2)}%`);
      // stage.style.setProperty('--core-top', `${coreTopPct.toFixed(2)}%`);
      // stage.style.setProperty('--core-width', `${coreWPct.toFixed(2)}%`);
      // stage.style.setProperty('--core-height', `${coreHPct.toFixed(2)}%`);
      // stage.style.setProperty('--pavement-left', `${pavementLeftPct.toFixed(2)}%`);
      // stage.style.setProperty('--pavement-top', `${pavementTopPct.toFixed(2)}%`);
      // stage.style.setProperty('--pavement-width', `${pavementWPct.toFixed(2)}%`);
      // stage.style.setProperty('--pavement-height', `${pavementHPct.toFixed(2)}%`);
      // (kept the variable computation above for future re-enabling)
      void coreLeftPct; void coreTopPct; void coreWPct; void coreHPct;
      void pavementLeftPct; void pavementTopPct; void pavementWPct; void pavementHPct;
    }

    // Compute immediately and on every resize
    computeWindowPosition();
    window.addEventListener('resize', computeWindowPosition);
    return () => window.removeEventListener('resize', computeWindowPosition);
  }, []);

  // Resolve image source: production photo if provided, else SVG placeholder
  const photoSrc = imageUrl || PLACEHOLDER_DATA_URI;

  // ─── ANIMATION STATE COMPUTATIONS ─────────────────────────────────────────

  // Pan/zoom is now CSS-keyframe-driven (see ACT1_STYLES below). React only
  // tracks elapsed time for the glow boost timing and cut-to-black logic.
  // Converting from React-state animation eliminates 60fps reconciliation,
  // which was causing stutter — CSS keyframes run on the compositor thread.

  // GLOW CHOREOGRAPHY: "the lamp cuts on as the camera arrives"
  // The lamp snaps on with a quick warm-up curve (200ms ramp + 100ms settle)
  // like a real interior light being switched on. Synchronizes with the
  // orchestral note swell at the moment the pan completes.
  //
  //   0 - 4500ms:    No glow boost (photo's existing dim warm pixels only)
  //   4500 - 4700ms: Lamp cuts on with overshoot (opacity 0 → 1.1)
  //   4700 - 4800ms: Settle from overshoot (1.1 → 1.0)
  //   4800 - 5800ms: Held at full brightness with subtle "alive" breathing
  //   5800 - 6000ms: Cut to black
  let windowBrightnessBoost;
  if (elapsedMs < 4500) {
    windowBrightnessBoost = 0;
  } else if (elapsedMs < 4700) {
    // Quick ramp with slight overshoot — Marcus reached the lamp, flipped switch
    const t = (elapsedMs - 4500) / 200;
    windowBrightnessBoost = t * 1.1;
  } else if (elapsedMs < 4800) {
    // Settle from overshoot
    const t = (elapsedMs - 4700) / 100;
    windowBrightnessBoost = 1.1 - t * 0.1;
  } else {
    // Held at full with subtle breathing (±3%)
    const breathPhase = ((elapsedMs - 4800) / 2000) * Math.PI * 2;
    windowBrightnessBoost = 1.0 + Math.sin(breathPhase) * 0.03;
  }

  // Hard cut to black at 5800ms (last 200ms of the act).
  // Documentary editing — no fade, no dissolve. The cut hits hard.
  const HOLD_END = 5800;
  const CUT_DURATION = 200;
  const cutToBlackOpacity = elapsedMs < HOLD_END
    ? 0
    : Math.min(1, (elapsedMs - HOLD_END) / CUT_DURATION);

  // Stage opacity: photo holds at 1.0 until the cut begins
  const photoOpacity = 1 - cutToBlackOpacity;

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <CinematicStage className="a1-stage">
      <style>{ACT1_STYLES}</style>

      {/* Stage-sized reference div for viewport measurement and CSS variables.
          Sits inset:0 within CinematicStage so it has the same dimensions.
          The glow layers query via parent's CSS variables for positioning. */}
      <div ref={stageRef} className="a1-stage-ref" />

      {/* ─── PHOTO + WINDOW GLOW (single SVG — shared coordinate system) ───
          The photo IMAGE and the glow elements are rendered together inside
          one SVG. They share the same viewBox and the same pan/zoom transform,
          which guarantees the glow stays locked to the window pixel position
          regardless of viewport size. (Mirror of the Act 7 F4 fix where the
          map image and the city dots were moved into the same SVG.)

          The CSS keyframe animation (a1-pan-zoom) drives the camera move on
          the .a1-pan-zoom-group inside the SVG; both the photo and the glow
          transform together because they're both children of that group. */}
      <svg
        className="a1-photo-svg"
        viewBox="0 0 480 1040"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: photoOpacity }}
      >
        <defs>
          {/* ═══ 4-LAYER PHOTOGRAPHIC WARM-WINDOW GLOW ═══

              Real lit windows at twilight have layered light structure:
                1. Pane core   — bright, near-white-yellow at the actual pane
                2. Pane bloom  — soft warm halo right around the pane
                3. Atmosphere  — wide diffuse warm scatter in the night air
                4. Pavement    — vertically elongated reflection on wet asphalt

              Each layer uses mix-blend-mode: screen (additive light), so they
              compose into a coherent photographic glow rather than a flat
              amber blob. Color temperature shifts across the radial:
                center  ~3200K warm-white  rgb(255, 248, 220)
                mid     ~2900K warm amber  rgb(255, 195, 110)
                outer   ~2400K deep amber  rgb(220, 130, 50)
              This temperature falloff is what reads as "real incandescent
              light source" rather than "Photoshop glow filter."  */}

          {/* LAYER 1 GRADIENT — PANE CORE
              The actual lit window pane: bright warm-white center, with
              high opacity held out to ~60% of the radius (so the pane
              "fills" with bright light), then sharp shoulder into the
              warm-orange edge. cy=42% biases the brightest spot slightly
              upward, mimicking a ceiling-mounted lamp inside the room. */}
          <radialGradient id="a1-core-grad" cx="50%" cy="42%" r="55%">
            <stop offset="0%"   stopColor="rgb(255, 250, 228)" stopOpacity="1.0"  />
            <stop offset="38%"  stopColor="rgb(255, 235, 180)" stopOpacity="0.97" />
            <stop offset="60%"  stopColor="rgb(255, 215, 140)" stopOpacity="0.85" />
            <stop offset="78%"  stopColor="rgb(255, 180, 90)"  stopOpacity="0.45" />
            <stop offset="92%"  stopColor="rgb(255, 150, 60)"  stopOpacity="0.15" />
            <stop offset="100%" stopColor="rgb(220, 120, 50)"  stopOpacity="0"    />
          </radialGradient>

          {/* LAYER 2 GRADIENT — PANE BLOOM
              The "halation" right around the bright pane — light blooming
              from the pane edges into the immediate surrounding air. Soft
              amber, falls off smoothly. Slight offset cy=48% to follow the
              pane's bias. */}
          <radialGradient id="a1-bloom-grad" cx="50%" cy="48%" r="50%">
            <stop offset="0%"   stopColor="rgb(255, 200, 130)" stopOpacity="0.60" />
            <stop offset="35%"  stopColor="rgb(255, 165, 80)"  stopOpacity="0.34" />
            <stop offset="70%"  stopColor="rgb(220, 130, 50)"  stopOpacity="0.10" />
            <stop offset="100%" stopColor="rgb(180, 90, 30)"   stopOpacity="0"    />
          </radialGradient>

          {/* LAYER 3 GRADIENT — ATMOSPHERIC SCATTER
              The wide diffuse warmth in the night air around the window —
              what Hollywood calls "atmospheric perspective." Subtle but
              critical: this is what makes a glowing window feel like it's
              actually in a humid pre-dawn air rather than pasted onto a
              flat photo. Very low opacity throughout (max 0.30) and a
              wider warm-orange palette. */}
          <radialGradient id="a1-atm-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgb(255, 175, 90)"  stopOpacity="0.28" />
            <stop offset="32%"  stopColor="rgb(255, 145, 65)"  stopOpacity="0.14" />
            <stop offset="68%"  stopColor="rgb(220, 100, 40)"  stopOpacity="0.04" />
            <stop offset="100%" stopColor="rgb(180, 80, 30)"   stopOpacity="0"    />
          </radialGradient>

          {/* LAYER 4 GRADIENT — PAVEMENT REFLECTION
              Wet asphalt directly below the building reflects the warm
              window light. The reflection is vertically elongated (light
              hitting the ground at an oblique angle stretches into a
              streak), warm amber, falling off downward. cy=8% puts the
              hot spot near the top of the ellipse — closest to the
              building base where the reflection is brightest. */}
          <radialGradient id="a1-pavement-grad" cx="50%" cy="8%" r="95%">
            <stop offset="0%"   stopColor="rgb(255, 200, 130)" stopOpacity="0.55" />
            <stop offset="18%"  stopColor="rgb(255, 170, 90)"  stopOpacity="0.40" />
            <stop offset="42%"  stopColor="rgb(220, 135, 55)"  stopOpacity="0.20" />
            <stop offset="75%"  stopColor="rgb(180, 100, 35)"  stopOpacity="0.06" />
            <stop offset="100%" stopColor="rgb(140, 60, 20)"   stopOpacity="0"    />
          </radialGradient>

          {/* FILTER — pane core soft halo (existing, slightly tightened) */}
          <filter id="a1-core-halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
          {/* FILTER — pane bloom soft blur for halation feel */}
          <filter id="a1-bloom-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          {/* FILTER — atmospheric scatter heavy blur for "in the air" diffusion */}
          <filter id="a1-atm-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          {/* FILTER — pavement reflection blur for soft wet-asphalt wash
              (avoids the ellipse reading as an obvious oval blob; instead
              the warm light feels embedded in the pavement texture). */}
          <filter id="a1-pavement-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
        </defs>

        {/* The pan/zoom group — both photo AND glow are children. They share
            the same coordinate system, so the glow stays locked to the window
            pixel at the END pose regardless of viewport size.

            COORDINATE SYSTEM EXPLANATION:
            - viewBox is 0 0 480 1040 (matches calibration viewport).
            - Photo is positioned at (-1227, -3) with size 1848×1040, which
              represents the cover-fit photo at END POSE bg-position 90% 25%.
              At end pose pre-scale, the window (source u=0.8786, v=0.4957)
              lands at viewBox (-1227 + 0.8786×1848, -3 + 0.4957×1040) =
              (397.1, 512.45).
            - Glow ellipses are placed at (397, 512) — same as the window.
            - The group transform animates from start→end:
                START: translate(269, 3) scale(1.0)  — pre-scale, panned right
                END:   translate(0, 0)   scale(1.10) — final scaled position
              transform-origin is the viewBox center (240, 520) so the scale
              spreads outward from the visible center, matching the original
              CSS background-position+scale semantics.
            - At END pose, the glow ends up at viewport (412.8, 511.7) =
              (86.0%, 49.2%) — the user's exact calibration.

            The transform-box: view-box CSS property (in ACT1_STYLES) makes
            the px values in transform translate refer to viewBox units, so
            the alignment scales perfectly with any viewport size — same fix
            as Act 7 F4 where the map and cities share an SVG viewBox. */}
        <g className="a1-pan-zoom-group">
          {/* PHOTO at END POSE pre-scale coordinates. Cover-fit math:
              natural photo 1672×941 → cover-scaled to 1848×1040 to fill
              480-wide viewport (vertical aspect dominates: 1040/941 = 1.105).
              x=-1227 places the photo so its 90% point aligns with the
              viewport's 90% point (matching CSS background-position: 90%). */}
          <image
            href={photoSrc}
            x="-1227" y="-3"
            width="1848" height="1040"
            preserveAspectRatio="none"
          />

          {/* ═══ LAYER 3 — ATMOSPHERIC SCATTER ═══
              Drawn FIRST (behind everything else) so the bloom and core
              read brighter against it. Wide soft warm diffusion in the
              night air. Heavy blur (stdDev=6) makes it feel like real
              atmospheric haze. Opacity scales 0.7 of boost so it's
              visible but doesn't overpower. Width slightly > height
              (75×56) — atmospheric scatter spreads horizontally more
              than vertically because air is denser near the ground. */}
          <ellipse
            cx="397" cy="510"
            rx="75" ry="56"
            fill="url(#a1-atm-grad)"
            filter="url(#a1-atm-blur)"
            style={{
              opacity: windowBrightnessBoost * 0.70,
              mixBlendMode: 'screen',
            }}
          />

          {/* ═══ LAYER 4 — PAVEMENT REFLECTION ═══
              Wet asphalt streak below the building. More elongated than v1
              (radius 42×92, ratio ~2.2 — was 48×66 ratio 1.4) so it reads
              as a "warm light streak on wet ground" rather than an oval
              blob. Heavy blur (stdDev=4) softens the ellipse edges so the
              warm wash feels embedded in the pavement rather than floating
              on top. Opacity 0.72 of boost — present but doesn't dominate. */}
          <ellipse
            cx="397" cy="710"
            rx="42" ry="92"
            fill="url(#a1-pavement-grad)"
            filter="url(#a1-pavement-blur)"
            style={{
              opacity: windowBrightnessBoost * 0.72,
              mixBlendMode: 'screen',
            }}
          />

          {/* ═══ LAYER 2 — PANE BLOOM ═══
              Tight halation right around the lit pane. Larger than the
              core (28×26 vs core's 19×21) so it forms a soft warm halo
              extending just beyond the pane edge. stdDev=3 blur for
              halation feel. Opacity 0.85 of boost — strong enough to
              read as bloom but doesn't wash out the bright core inside. */}
          <ellipse
            cx="397" cy="512"
            rx="28" ry="26"
            fill="url(#a1-bloom-grad)"
            filter="url(#a1-bloom-blur)"
            style={{
              opacity: windowBrightnessBoost * 0.85,
              mixBlendMode: 'screen',
            }}
          />

          {/* ═══ LAYER 1 — PANE CORE ═══
              The actual lit window pane: bright warm-white at center,
              filling out to ~60% radius before transitioning to the
              warm-amber edge. Slightly oval (19×21 — taller than wide)
              to match the pane's natural rectangle proportion. cy=510
              is 2px above the geometric center to align with the
              cy=42% bias inside the gradient.

              This is the BRIGHTEST layer — full opacity scaling with
              boost. The core-halo filter (stdDev=2, lightly tightened
              from v1's stdDev=3) gives a tight warm halo right at the
              pane edge without spreading too far (the bloom layer
              handles the wider spread). */}
          <ellipse
            cx="397" cy="510"
            rx="19" ry="21"
            fill="url(#a1-core-grad)"
            filter="url(#a1-core-halo)"
            style={{
              opacity: windowBrightnessBoost,
              mixBlendMode: 'screen',
            }}
          />
        </g>
      </svg>

      {/* ─── ATMOSPHERIC LAYERS ─── */}
      {/* Cold register: vignette + scanlines + grain. NO warm tint (the warmth
          is localized to the window only). NO light shaft (this is exterior
          pre-dawn, no interior lamp casting a shaft). */}
      <AtmosphericLayers
        vignette={true}
        scanlines={true}
        grain={true}
        warmTint={false}
        lightShaft={false}
      />

      {/* ─── COLD COLOR GRADE ─── */}
      {/* Subtle blue-white wash deepening the cold register. Same idiom as Act 5
          but milder — this is establishing the cold, not punctuating it. */}
      <div className="a1-cold-grade" />

      {/* ─── HARD CUT TO BLACK ─── */}
      {cutToBlackOpacity > 0 && (
        <div
          className="a1-cut-to-black"
          style={{ opacity: cutToBlackOpacity }}
        />
      )}

      {/* ─── CINEMA BARS ─── */}
      <CinemaBars barHeight={32} delayMs={0} />

      {/* No skip button during Act 1 — storyboard rule.
          Skip becomes available starting Act 2. */}
    </CinematicStage>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — cold pre-dawn register
// ─────────────────────────────────────────────────────────────────────────────

const ACT1_STYLES = `
.a1-stage {
  background: #050709;
}

/* Stage-sized reference div for viewport measurement. Invisible. */
.a1-stage-ref {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* ═══ PHOTO + GLOW SVG ═══ */
/* The photo IMAGE and the glow elements live inside this single SVG so they
   share one coordinate system (matching the Act 7 F4 fix). The pan/zoom
   animation is applied to a wrapping <g> inside the SVG, transforming both
   the photo and the glow together — the glow stays locked to the window
   pixel position regardless of viewport size. */
.a1-photo-svg {
  position: absolute;
  inset: 0;
  z-index: 5;
  width: 100%;
  height: 100%;
  background-color: #050709;
  /* Filter applied here on the SVG — static (doesn't change during animation)
     so the GPU can cache the filter result. */
  filter: contrast(1.05) saturate(1.08) blur(0.3px);
  display: block;
  will-change: opacity;
}

/* Pan/zoom group — drives the camera move via CSS transform. The transform
   shifts BOTH the photo and the glow elements (which are siblings inside
   this group), so the glow stays locked to the window pixel forever.

   transform-box: view-box makes CSS transform px values reference the SVG's
   viewBox coordinate system (0-480 horizontal, 0-1040 vertical) instead of
   the bounding-box. This is the critical fix that lets the alignment scale
   correctly with any viewport size — same idea as Act 7 F4 where the map
   and the dots share an SVG viewBox. */
.a1-pan-zoom-group {
  transform-box: view-box;
  transform-origin: 240px 520px;  /* center of viewBox 0 0 480 1040 */
  /* Smoother camera move per user feedback ("less laggy"). The previous
     bezier (0.45, 0.05, 0.55, 0.95) was a tight S-curve that nearly
     stopped at both ends, producing visible plateaus that read as
     stuttering. Material Design's standard easing (0.4, 0, 0.2, 1) eases
     more gracefully — quick acceleration, mostly linear middle, smooth
     deceleration — no perceptible stop-start moments.
     Duration kept at 4500ms because the glow choreography is anchored
     to that timing (lamp cuts on at 4500ms when the pan settles). */
  animation: a1-pan-zoom 4500ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  /* Force GPU compositing for smoother playback on lower-end devices */
  will-change: transform;
  backface-visibility: hidden;
}

/* Pan-zoom keyframes (viewBox-px values, applied via transform-box: view-box):
   - Establishing (0%):  translate(269, 3) scale(1.0) — equivalent to CSS
                         background-position: 70% 35%, scale 1.0 at the
                         calibration viewport. The +269 horizontal shifts
                         the photo right (window starts off-screen right),
                         the +3 is a tiny vertical offset matching bg-pos
                         35% vs 25%.
   - End pose (100%):    translate(0, 0) scale(1.10) — the photo and glow
                         are already laid out at end-pose pre-scale coords,
                         so the end transform just applies the 1.10 zoom
                         from viewBox center. After this transform, the
                         glow ends up at viewport (86%, 49.2%) — exactly
                         the user's calibrated position.

   Cubic-bezier eases the camera move with a slow start and slow end, leaving
   a smooth middle — the cinematic "settling into the moment" feel. */
@keyframes a1-pan-zoom {
  0% {
    transform: translate(269px, 3px) scale(1.0);
  }
  100% {
    transform: translate(0px, 0px) scale(1.10);
  }
}

/* ═══ WINDOW GLOW — 3-LAYER COMPOSITE ═══ */
/* All layer positions calibrated by the USER via interactive drag-to-position
   tool. The window in the production photo is at:
     center: (86.0%, 49.2%)
     dimensions: 9.2% wide × 4.2% tall
   This is much SMALLER than my pixel-sampling analysis suggested — the
   pixel-sampler found warm pixel CLUSTERS (which extend beyond the window
   itself due to the warm light spilling onto the wall), not the window
   pane itself. The window is tighter than the warm pixel cluster.
   
   v1.5 sizes all glow layers proportionally to the real (small) window:
   - Core matches window exactly (the lit pane)
   - Bloom ~1.6x the window size (warm wash on adjacent wall)
   - Pavement reflection sits below window on wet asphalt */

/* (Old .a1-window-core and .a1-window-pavement-reflection CSS rules removed —
   the glow is now rendered as SVG <ellipse> elements inside the .a1-photo-svg,
   sharing the same coordinate system as the photo so they stay locked to the
   window pixel position regardless of viewport size.) */

/* ═══ COLD COLOR GRADE ═══ */
/* Cold blue-white wash. Counterpart to Act 4's warm amber tint and shares
   register with Act 5's cold federal grade. Subtle — the photo's own cold
   palette does most of the work; this just deepens it. */
.a1-cold-grade {
  position: absolute;
  inset: 0;
  z-index: 14;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 30%,
      rgba(38, 56, 80, 0.12) 0%,
      rgba(20, 28, 44, 0.18) 60%,
      rgba(8, 12, 20, 0.32) 100%);
  mix-blend-mode: multiply;
}

/* ═══ HARD CUT TO BLACK ═══ */
.a1-cut-to-black {
  position: absolute;
  inset: 0;
  z-index: 95;  /* Above cinema bars (z:80) but below any future skip UI */
  background: #000000;
  pointer-events: none;
  will-change: opacity;
}

/* ═══ REDUCE-MOTION ═══ */
/* Act 1 is single-photo with a Ken Burns push. Under reduce-motion, the
   push is disabled — photo stays at the END pose so the user still sees the
   warm window prominently, just without animation. */
.perf-reduce-motion .a1-pan-zoom-group {
  animation: none !important;
  transform: translateX(-125.42%) scale(1.10) !important;
}
@media (prefers-reduced-motion: reduce) {
  .a1-pan-zoom-group {
    animation: none !important;
    transform: translateX(-125.42%) scale(1.10) !important;
  }
}
`;

export default Act1ColdOpen;
