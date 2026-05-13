/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss — Welcome Modal · Act 9: The Long Game (v2 — Fleet Reveal)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Frame 1:32 → 1:47 (14s of content + 1000ms fade-out = 15000ms total).
 * Cinematic warehouse / fleet reveal sequence — four garage bays roll up
 * sequentially, each revealing a different medium-duty truck with headlights
 * blazing into the dark interior. Camera pans between bays then pulls back
 * to a hero wide shot of the full fleet.
 *
 * REPLACES THE V1 SLIDESHOW: v1 was a two-photo cross-dissolve which read as
 * a PowerPoint despite the cinematic stack. v2 is a real cinematic sequence
 * built around the architectural drama of doors rolling up + headlights
 * snapping on + camera motion between bays — the iconic equipment-reveal idiom
 * every movie/commercial uses.
 *
 * EMOTIONAL CONTRACT: Hope. "I can build something." The progression from
 * one bay to a fleet of four = visual proof of growth. Marcus delivers the
 * VO over the reveal cadence, with the final punchline ("a name in this
 * industry") landing on the wide pull-back shot of the full fleet.
 *
 * ─── FOUR BAYS, FOUR TRUCKS (research-accurate medium-duty fleet) ──────────
 *
 *   BAY 01 — Freightliner M2 106  (American conventional, vertical-bar grille)
 *   BAY 02 — Mack MD              (American conventional, tall hood, Mack badge)
 *   BAY 03 — Hino 258             (Japanese cab-over, flat front)
 *   BAY 04 — International 4300   (American conventional, chrome grille)
 *
 * These are FRONT-VIEW silhouettes drawn as SVG paths — recognizable by
 * profile/grille style without copyright-encumbered stock imagery.
 * Each truck is BACKLIT (interior bay light + dual headlight bloom) which
 * is how every cinematic equipment reveal is shot — silhouette + bloom
 * reads MORE dramatic than detailed photography.
 *
 * ─── CHOREOGRAPHY (14s of content) ──────────────────────────────────────────
 *
 *   PHASE A — Establish      0    →   1500ms   (1.5s)
 *     Wide on warehouse exterior. Four bays closed.
 *
 *   PHASE B — Bay 1 Reveal   1500 →   3700ms   (2.2s)
 *     Camera dollies in. Door rolls up over 1.4s.
 *     Headlights snap ON at door 50%. Steam billows.
 *     Bay label fades in: "BAY 01 · FREIGHTLINER M2 106"
 *
 *   PHASE C — Pan to Bay 2   3700 →   4500ms   (0.8s)
 *
 *   PHASE D — Bay 2 Reveal   4500 →   6500ms   (2.0s)
 *     Mack MD silhouette. "BAY 02 · MACK MD"
 *
 *   PHASE E — Pan to Bay 3   6500 →   7300ms
 *
 *   PHASE F — Bay 3 Reveal   7300 →   9300ms   (2.0s)
 *     Hino 258 (cab-over silhouette — visibly different)
 *     "BAY 03 · HINO 258" — FLEET THRESHOLD reached
 *
 *   PHASE G — Pan to Bay 4   9300 →  10100ms
 *
 *   PHASE H — Bay 4 Reveal   10100 → 12100ms   (2.0s)
 *     International 4300. "BAY 04 · INTERNATIONAL 4300"
 *
 *   PHASE I — Wide Pull-Back 12100 → 14000ms   (1.9s)
 *     Camera pulls back to reveal ALL four bays open with all four
 *     trucks lit. THE FLEET money shot.
 *
 *   FADE                     14000 → 15000ms   (1.0s gentle dim into Act 10)
 *
 * ─── MARCUS DIALOGUE (hope-register, fleet-accurate) ───────────────────────
 *
 *   Line 1   1800 →  3700ms   "One truck becomes three."  (Bay 1 reveal)
 *   Line 2   6800 →  9000ms   "Three becomes a fleet."    (Bay 3 reveal)
 *   Line 3  10500 → 13800ms   "A fleet becomes a name in this industry."
 *
 *   Updated from v1 ("One truck becomes two. Two becomes a fleet.") which
 *   was technically incorrect — fleet starts at 3 trucks per industry
 *   consensus (DAT, VEC Fleet, California CARB, TruckersReport).
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

import {
  CinematicStage,
  CinemaBars,
  CinematicCaption,
} from '../WelcomeModalShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ACT_DURATION_MS = 18500;
const CONTENT_END_MS  = 17500;
const FADE_OUT_MS     = 1000;

const PHASES = {
  establishStart:   0,
  establishEnd:     1500,
  bay1RevealStart:  1500,
  bay1DoorEnd:      2900,
  bay1RevealEnd:    3700,
  pan1End:          4500,
  bay2RevealStart:  4500,
  bay2DoorEnd:      5900,
  bay2RevealEnd:    6700,
  pan2End:          7500,
  bay3RevealStart:  7500,    // Marcus line 2 ("Three becomes a fleet") lands here
  bay3DoorEnd:      8900,
  bay3RevealEnd:    9700,
  pan3End:          10500,
  bay4RevealStart:  10500,
  bay4DoorEnd:      11900,
  bay4RevealEnd:    12700,
  pan4End:          13500,
  bay5RevealStart:  13500,   // 5th truck — Peterbilt
  bay5DoorEnd:      14900,
  bay5RevealEnd:    15700,
  pullbackStart:    15700,   // Marcus line 3 punchline lands during this tracking shot
  pullbackEnd:      17500,
};

const VOICEMAIL_SEGMENTS = [
  { startMs:  1800, endMs:  3700, text: "One truck becomes three." },                                       // Bay 1 reveal
  { startMs:  8000, endMs:  10500, text: "Three becomes a fleet." },                                         // Bay 3 (fleet threshold)
  { startMs: 10500, endMs: 15700, text: "And eventually, a fleet becomes a name in this industry." },        // Bay 4 reveal → end of Bay 5 reveal (5.2s read time, ends before pullback)
];

const TRUCKS = [
  { id: 'freightliner',  bayLabel: 'BAY 01', name: 'FREIGHTLINER M2 106' },
  { id: 'mack',          bayLabel: 'BAY 02', name: 'MACK MD' },
  { id: 'hino',          bayLabel: 'BAY 03', name: 'HINO 195' },         // Cabover (corrected from 258)
  { id: 'international', bayLabel: 'BAY 04', name: 'INTERNATIONAL 4300' },
  { id: 'peterbilt',     bayLabel: 'BAY 05', name: 'PETERBILT 337' },     // 5th truck (industry-spec fleet threshold)
];

const BAY_WIDTH = 480;
const BAY_TOP = 60;
const BAY_FLOOR = 820;
const BAY_CENTERS = [240, 720, 1200, 1680, 2160];

const SVG_W = 2400;
const SVG_H = 1040;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act9TheLongGame = React.memo(function Act9TheLongGame({
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('9', elapsedMs);

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

  const currentSegment = VOICEMAIL_SEGMENTS.find(
    s => elapsedMs >= s.startMs && elapsedMs < s.endMs
  ) || null;

  // ─── CAMERA CHOREOGRAPHY ──────────────────────────────────────────────────
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let cameraX, cameraScale;

  if (elapsedMs < PHASES.establishEnd) {
    // Establishing: center on Bay 1's exterior (door closed). Slightly pulled
    // back (scale 0.78) to show bay 1 + a hint of bay 2's left edge — gives
    // the viewer a sense of "more bays to come" without trying to fit all 4
    // in a portrait frame (which would shrink everything to a thin strip).
    const t = elapsedMs / PHASES.establishEnd;
    cameraX = 320;       // slightly right of Bay 1 to see hint of Bay 2
    cameraScale = 0.78 + easeOutCubic(t) * 0.04;
  } else if (elapsedMs < PHASES.bay1RevealEnd) {
    // Establishment → Bay 1 dolly: push in from (320, 0.82) to (240, 1.0)
    const t = (elapsedMs - PHASES.establishEnd) / (PHASES.bay1RevealEnd - PHASES.establishEnd);
    const eased = easeOutCubic(t);
    cameraX = 320 + (240 - 320) * eased;
    cameraScale = 0.82 + (1.0 - 0.82) * eased;
  } else if (elapsedMs < PHASES.pan1End) {
    const t = (elapsedMs - PHASES.bay1RevealEnd) / (PHASES.pan1End - PHASES.bay1RevealEnd);
    const eased = easeInOutCubic(t);
    cameraX = BAY_CENTERS[0] + (BAY_CENTERS[1] - BAY_CENTERS[0]) * eased;
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.bay2RevealEnd) {
    cameraX = BAY_CENTERS[1];
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.pan2End) {
    const t = (elapsedMs - PHASES.bay2RevealEnd) / (PHASES.pan2End - PHASES.bay2RevealEnd);
    const eased = easeInOutCubic(t);
    cameraX = BAY_CENTERS[1] + (BAY_CENTERS[2] - BAY_CENTERS[1]) * eased;
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.bay3RevealEnd) {
    cameraX = BAY_CENTERS[2];
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.pan3End) {
    const t = (elapsedMs - PHASES.bay3RevealEnd) / (PHASES.pan3End - PHASES.bay3RevealEnd);
    const eased = easeInOutCubic(t);
    cameraX = BAY_CENTERS[2] + (BAY_CENTERS[3] - BAY_CENTERS[2]) * eased;
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.bay4RevealEnd) {
    cameraX = BAY_CENTERS[3];
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.pan4End) {
    const t = (elapsedMs - PHASES.bay4RevealEnd) / (PHASES.pan4End - PHASES.bay4RevealEnd);
    const eased = easeInOutCubic(t);
    cameraX = BAY_CENTERS[3] + (BAY_CENTERS[4] - BAY_CENTERS[3]) * eased;
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.bay5RevealEnd) {
    cameraX = BAY_CENTERS[4];
    cameraScale = 1.0;
  } else if (elapsedMs < PHASES.pullbackEnd) {
    // FINAL TRACKING SHOT — horizontal pan from Bay 5 (the latest, fleet-as-name)
    // back to Bay 1 (the origin), with slight zoom-out at the end.
    // Marcus's punchline "A fleet becomes a name in this industry" lands during
    // this pan — viewer reviews the entire fleet as the line resolves.
    //
    // This is the Tarantino "follow shot" idiom — much stronger cinematic
    // than zooming out in a portrait viewport.
    const t = (elapsedMs - PHASES.bay5RevealEnd) / (PHASES.pullbackEnd - PHASES.bay5RevealEnd);
    const eased = easeOutCubic(t);
    cameraX = BAY_CENTERS[4] + (BAY_CENTERS[0] - BAY_CENTERS[4]) * eased;
    // Slight zoom-out at the END (last 30% of pan) for the closing wide shot
    const zoomT = Math.max(0, (t - 0.7) / 0.3);
    cameraScale = 1.0 - zoomT * 0.18;  // 1.0 → 0.82
  } else {
    cameraX = BAY_CENTERS[0];
    cameraScale = 0.82;
  }

  // ─── PER-BAY DOOR/HEADLIGHT/LABEL/STEAM STATE ─────────────────────────────
  const computeBayState = (bayIdx) => {
    const startKey = `bay${bayIdx + 1}RevealStart`;
    const doorEndKey = `bay${bayIdx + 1}DoorEnd`;
    const start = PHASES[startKey];
    const doorEnd = PHASES[doorEndKey];

    if (elapsedMs < start) {
      return { doorOpen: 0, headlights: 0, label: 0, steam: 0 };
    }

    const doorT = Math.min(1, (elapsedMs - start) / (doorEnd - start));
    const doorOpen = easeOutCubic(doorT);

    // Headlights ramp during door rise (not after).
    // At door 25%, headlights begin glowing faintly — visible through the gap.
    // At door 90%, headlights are at full intensity.
    // This creates the cinematic effect of the beam progressively shining
    // through as the door rolls up — the most evocative beat of the reveal.
    let headlights = 0;
    if (doorOpen >= 0.25) {
      headlights = Math.min(1, (doorOpen - 0.25) / 0.65);
      headlights = Math.pow(headlights, 0.7);  // ease — quicker initial glow ramp
    }

    let label = 0;
    if (doorOpen >= 0.7) {
      label = Math.min(1, (doorOpen - 0.7) / 0.25);
    }

    let steam = 0;
    if (doorOpen >= 0.3 && doorOpen <= 0.85) {
      const sx = (doorOpen - 0.55) / 0.30;
      steam = Math.exp(-sx * sx * 2);
    }

    return { doorOpen, headlights, label, steam };
  };

  const bayStates = [0, 1, 2, 3, 4].map(computeBayState);

  // ─── ANAMORPHIC FLARE — fires at headlight snap-on + during pullback ──────
  let anamorphicOpacity = 0;
  for (let i = 0; i < 5; i++) {
    const s = bayStates[i];
    if (s.headlights > 0.7) {
      anamorphicOpacity = Math.max(anamorphicOpacity, (s.headlights - 0.7) / 0.3 * 0.55);
    }
  }
  if (elapsedMs >= PHASES.pullbackStart && elapsedMs < PHASES.pullbackEnd) {
    const pt = (elapsedMs - PHASES.pullbackStart) / (PHASES.pullbackEnd - PHASES.pullbackStart);
    anamorphicOpacity = Math.max(anamorphicOpacity, easeOutCubic(pt) * 0.65);
  }

  // ─── FADE ─────────────────────────────────────────────────────────────────
  const fadeT = elapsedMs >= CONTENT_END_MS
    ? Math.min(1, (elapsedMs - CONTENT_END_MS) / FADE_OUT_MS)
    : 0;
  const fadeOpacity = fadeT * fadeT * fadeT;

  // ─── DUST MOTES ───────────────────────────────────────────────────────────
  const motes = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        id: i,
        left: Math.random() * 100,
        top: 30 + Math.random() * 55,
        width: 1.5 + Math.random() * 3,
        dur: 11 + Math.random() * 12,
        delay: -Math.random() * 18,
      });
    }
    return arr;
  }, []);

  // ─── DYNAMIC VIEWBOX (camera framing) ─────────────────────────────────────
  //
  // Instead of applying CSS transforms to the SVG element (which compound
  // poorly with slice preserveAspectRatio), animate the viewBox attribute
  // directly. The viewBox defines what slice of SVG coordinates is visible,
  // so cameraX/cameraScale map cleanly to viewBox x/width/height.
  //
  // Viewport is 480×1040 (portrait). For a given cameraScale, the viewBox
  // width = 480 / cameraScale (since SVG units are 1:1 with screen pixels
  // when scale=1.0). At scale=0.42 (pull-back), viewBox width = 1143 →
  // wider field of view, fits all 4 bays.
  const viewportAspect = 480 / 1040;  // portrait
  const vbW = 480 / cameraScale;
  const vbH = vbW / viewportAspect;
  const vbX = cameraX - vbW / 2;
  // Center vertically on the bay structure (y center ~530)
  const vbY = 530 - vbH / 2;

  return (
    <CinematicStage className="a9-stage">
      <style>{ACT9_STYLES}</style>

      {/* ═══ MASTER SCENE ═══ */}
      <div className="a9-scene-wrap">
        <svg
          className="a9-scene-svg"
          viewBox={`${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="a9-floor" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#1a1612" />
              <stop offset="50%"  stopColor="#0e0a07" />
              <stop offset="100%" stopColor="#080604" />
            </linearGradient>
            <linearGradient id="a9-backwall" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#0a0805" />
              <stop offset="40%"  stopColor="#0d0a06" />
              <stop offset="100%" stopColor="#06050a" />
            </linearGradient>
            <linearGradient id="a9-beam" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%"   stopColor="#2a2520" />
              <stop offset="50%"  stopColor="#3a352c" />
              <stop offset="100%" stopColor="#1a1612" />
            </linearGradient>
            <linearGradient id="a9-door" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#28231d" />
              <stop offset="50%"  stopColor="#3d362c" />
              <stop offset="100%" stopColor="#1c1814" />
            </linearGradient>
            <linearGradient id="a9-door-edge" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#0c0a07" />
              <stop offset="50%"  stopColor="#1a1612" />
              <stop offset="100%" stopColor="#0c0a07" />
            </linearGradient>
            <radialGradient id="a9-bay-glow">
              <stop offset="0%"   stopColor="rgba(255, 200, 130, 0.55)" />
              <stop offset="35%"  stopColor="rgba(220, 150, 80, 0.30)" />
              <stop offset="70%"  stopColor="rgba(140, 80, 40, 0.10)" />
              <stop offset="100%" stopColor="rgba(20, 12, 6, 0)" />
            </radialGradient>
            <radialGradient id="a9-headlight">
              <stop offset="0%"   stopColor="rgba(255, 250, 240, 1.0)" />
              <stop offset="20%"  stopColor="rgba(245, 240, 230, 0.85)" />
              <stop offset="50%"  stopColor="rgba(220, 220, 230, 0.30)" />
              <stop offset="100%" stopColor="rgba(180, 180, 200, 0)" />
            </radialGradient>
            <linearGradient id="a9-beam-fwd" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%"   stopColor="rgba(255, 250, 230, 0.7)" />
              <stop offset="50%"  stopColor="rgba(255, 245, 220, 0.25)" />
              <stop offset="100%" stopColor="rgba(255, 240, 200, 0)" />
            </linearGradient>
            <radialGradient id="a9-steam">
              <stop offset="0%"   stopColor="rgba(190, 175, 160, 0.7)" />
              <stop offset="50%"  stopColor="rgba(140, 130, 120, 0.35)" />
              <stop offset="100%" stopColor="rgba(80, 75, 70, 0)" />
            </radialGradient>
            <linearGradient id="a9-truck-body" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#040302" />
              <stop offset="80%"  stopColor="#080604" />
              <stop offset="100%" stopColor="#020201" />
            </linearGradient>
            <radialGradient id="a9-floor-reflect" cx="0.5" cy="0" r="0.7">
              <stop offset="0%"   stopColor="rgba(255, 245, 215, 0.65)" />
              <stop offset="40%"  stopColor="rgba(255, 220, 170, 0.30)" />
              <stop offset="80%"  stopColor="rgba(180, 140, 90, 0.08)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>

            {/* ═══ POOL-RADIAL — soft elongated falloff for floor light pool ═══ */}
            <radialGradient id="a9-pool-radial" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%"   stopColor="rgba(255, 248, 225, 0.78)" />
              <stop offset="20%"  stopColor="rgba(255, 240, 200, 0.50)" />
              <stop offset="50%"  stopColor="rgba(255, 220, 165, 0.20)" />
              <stop offset="80%"  stopColor="rgba(220, 180, 130, 0.06)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>

            {/* ═══ VOLUMETRIC LIGHTING FILTERS ═══
                 Progressive Gaussian blur for cinematic light beams.
                 Multiple passes simulate atmospheric Mie scattering. */}
            <filter id="a9-beam-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
            <filter id="a9-beam-haze" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <filter id="a9-pool-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="a9-headlight-bloom" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" />
            </filter>

            {/* ═══ ANAMORPHIC STREAK FILTERS ═══
                 Per Lindsey Optics (cinematography reference): real anamorphic
                 lens flares are SHARP horizontally, SOFT vertically — produced
                 by the lens's asymmetric squeeze ratio. SVG asymmetric Gaussian
                 blur (stdDeviation="X Y" with different X and Y) reproduces this
                 effect natively. */}
            <filter id="a9-streak-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0 3" />
            </filter>
            <filter id="a9-streak-haze" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2 7" />
            </filter>
          </defs>

          {/* Back wall */}
          <rect x="0" y="0" width={SVG_W} height={BAY_FLOOR} fill="url(#a9-backwall)" />
          {/* Floor */}
          <rect x="0" y={BAY_FLOOR} width={SVG_W} height={SVG_H - BAY_FLOOR} fill="url(#a9-floor)" />

          {/* Distant warehouse stencil */}
          <g opacity="0.4">
            <text
              x={SVG_W / 2} y="80"
              textAnchor="middle"
              fill="rgba(180, 140, 90, 0.18)"
              fontFamily="'IBM Plex Mono', monospace"
              fontSize="20"
              letterSpacing="0.45em"
              fontWeight="500"
            >
              FLEET MAINTENANCE BAY
            </text>
            <line x1="380" y1="100" x2={SVG_W - 380} y2="100"
                  stroke="rgba(180, 140, 90, 0.10)" strokeWidth="1" />
          </g>

          {/* Bays */}
          {TRUCKS.map((truck, idx) => {
            const bayX = idx * BAY_WIDTH;
            const state = bayStates[idx];
            return (
              <BayGroup
                key={truck.id}
                truck={truck}
                bayX={bayX}
                state={state}
                truckIdx={idx}
              />
            );
          })}

          {/* Foreground floor haze */}
          <rect x="0" y={BAY_FLOOR - 80} width={SVG_W} height="120"
                fill="url(#a9-floor)" opacity="0.5" />
        </svg>
      </div>

      {/* Bay label HUD */}
      <BayLabelHUD
        elapsedMs={elapsedMs}
        bayStates={bayStates}
        trucks={TRUCKS}
        cameraScale={cameraScale}
        cameraX={cameraX}
      />

      {/* Cinematic stack */}
      <div className="a9-chromatic" />
      <div className="a9-halation" />
      <div className="a9-haze a9-haze-far" />
      <div className="a9-haze a9-haze-mid" />
      <div className="a9-haze a9-haze-near" />
      <div className="a9-dust">
        {motes.map(m => (
          <div
            key={m.id}
            className="a9-mote"
            style={{
              left: `${m.left}%`,
              top: `${m.top}%`,
              width: `${m.width}px`,
              height: `${m.width}px`,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="a9-warm-grade" />
      <div className="a9-vignette" />
      <div className="a9-scanlines" />
      <div className="a9-grain" />
      <CinemaBars barHeight={22} delayMs={0} />
      <CinematicCaption text={currentSegment ? currentSegment.text : null} />

      <div className="a9-fade-out" style={{ opacity: fadeOpacity * 0.95 }} />
      <button className="a9-skip-btn" onClick={onSkip} aria-label="Skip act">
        Skip
      </button>
    </CinematicStage>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BayGroup — single bay (door + truck + lighting)
// ─────────────────────────────────────────────────────────────────────────────

const BayGroup = ({ truck, bayX, state, truckIdx }) => {
  const W = BAY_WIDTH;
  const innerLeft = 32;
  const innerRight = W - 32;
  const innerTop = BAY_TOP + 36;        // sits below the 62px header band
  const innerBottom = BAY_FLOOR;
  const innerWidth = innerRight - innerLeft;
  const innerHeight = innerBottom - innerTop;

  // Cinematic framing: lift the truck above the bay floor so the headlights sit
  // near viewport center — Roger Deakins' nighttime hero-shot rule (Sicario,
  // Blade Runner 2049). Empty headroom is reduced by ~half, and the wheel-level
  // gap between bumper and floor becomes the brightest cinematic floor pool
  // (Michael Mann garage idiom from Heat / Collateral).
  const TRUCK_LIFT = 155;
  const truckBaseY = innerBottom - TRUCK_LIFT;

  const doorVisibleHeight = innerHeight * (1 - state.doorOpen);

  return (
    <g transform={`translate(${bayX}, 0)`}>
      <rect x="0" y={BAY_TOP} width="32" height={BAY_FLOOR - BAY_TOP} fill="url(#a9-beam)" />
      <rect x={W - 32} y={BAY_TOP} width="32" height={BAY_FLOOR - BAY_TOP} fill="url(#a9-beam)" />
      <rect x="0" y={BAY_TOP} width={W} height="62" fill="url(#a9-beam)" />
      {/* Defined bay-marker band — slightly darker, so the BAY # label reads as a
          designed marker rather than floating text on a gradient. Subtle bottom
          stroke gives it a film-frame edge. */}
      <rect x="0" y={BAY_TOP + 18} width={W} height="34" fill="rgba(0, 0, 0, 0.35)" />
      <rect x="0" y={BAY_TOP + 51} width={W} height="0.5" fill="rgba(199, 184, 122, 0.18)" />

      <text
        x={W / 2} y={BAY_TOP + 41}
        textAnchor="middle"
        fill="rgba(255, 215, 155, 0.95)"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="18"
        fontWeight="700"
        letterSpacing="0.36em"
      >
        {truck.bayLabel}
      </text>

      <defs>
        <clipPath id={`a9-bay-clip-${truckIdx}`}>
          <rect x={innerLeft} y={innerTop} width={innerWidth} height={innerHeight} />
        </clipPath>
      </defs>

      <g clipPath={`url(#a9-bay-clip-${truckIdx})`}>
        <rect
          x={innerLeft} y={innerTop}
          width={innerWidth} height={innerHeight}
          fill="#040302"
        />

        {state.doorOpen > 0.1 && (
          <ellipse
            cx={innerLeft + innerWidth / 2}
            cy={innerTop + 60}
            rx={innerWidth * 0.55}
            ry="180"
            fill="url(#a9-bay-glow)"
            opacity={Math.min(1, state.doorOpen * 1.4)}
          />
        )}

        <g
          opacity={state.doorOpen > 0.3 ? Math.min(1, (state.doorOpen - 0.3) * 2.5) : 0}
          transform={`translate(${innerLeft + innerWidth / 2}, ${truckBaseY})`}
        >
          <TruckSilhouette type={truck.id} headlights={state.headlights} />
        </g>

        {/* ═══ VOLUMETRIC HEADLIGHT BEAMS ═══
             Anchored to per-truck headlight (cx, cy) positions from HEADLIGHT_BLOOMS.
             Multi-layer Gaussian blur simulates atmospheric Mie scattering.
             Bezier curves replace cartoonish triangles. Naturally clipped by bay
             interior — beam reveals progressively as door rises.
             Beam still extends to bay floor (innerBottom-based) even though truck
             is lifted, creating the cinematic wheel-clearance light pool. */}
        {state.headlights > 0.1 && (
          <VolumetricBeams
            truckId={truck.id}
            cx={innerLeft + innerWidth / 2}
            truckBaseY={truckBaseY}
            beamFloorY={innerBottom + 33}
            intensity={state.headlights}
            doorOpen={state.doorOpen}
            bayIdx={truckIdx}
          />
        )}

        {state.steam > 0.05 && (
          <g opacity={state.steam}>
            <ellipse cx={innerLeft + innerWidth * 0.38} cy={truckBaseY - 60}
                     rx="60" ry="22" fill="url(#a9-steam)" />
            <ellipse cx={innerLeft + innerWidth * 0.62} cy={truckBaseY - 80}
                     rx="55" ry="18" fill="url(#a9-steam)" />
            <ellipse cx={innerLeft + innerWidth * 0.50} cy={truckBaseY - 110}
                     rx="70" ry="25" fill="url(#a9-steam)" opacity="0.65" />
          </g>
        )}
      </g>

      {doorVisibleHeight > 4 && (
        <g>
          <rect
            x={innerLeft} y={innerTop}
            width={innerWidth} height={doorVisibleHeight}
            fill="url(#a9-door)"
          />
          {Array.from({ length: Math.ceil(doorVisibleHeight / 24) }).map((_, i) => {
            const y = innerTop + i * 24;
            if (y >= innerTop + doorVisibleHeight) return null;
            return (
              <line
                key={i}
                x1={innerLeft} y1={y}
                x2={innerRight} y2={y}
                stroke="rgba(0, 0, 0, 0.55)"
                strokeWidth="1.5"
              />
            );
          })}
          <rect
            x={innerLeft} y={innerTop + doorVisibleHeight - 6}
            width={innerWidth} height="6"
            fill="url(#a9-door-edge)"
          />
        </g>
      )}

      <rect
        x={innerLeft} y={innerBottom}
        width={innerWidth} height="2"
        fill="rgba(0, 0, 0, 0.7)"
      />
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HEADLIGHT_BLOOMS — per-truck headlight position dict (truck-local coords).
// Beams originate from these (cx, cy) positions for proper anchoring.
// ─────────────────────────────────────────────────────────────────────────────

const HEADLIGHT_BLOOMS = {
  freightliner:  { cxLeft: -75, cxRight: 75, cy: -146, size: 13 },
  mack:          { cxLeft: -78, cxRight: 78, cy: -156, size: 14 },
  hino:          { cxLeft: -92, cxRight: 92, cy: -184, size: 14 },
  international: { cxLeft: -82, cxRight: 82, cy: -152, size: 16 },
  peterbilt:     { cxLeft: -90, cxRight: 90, cy: -152, size: 17 },
};

// ─────────────────────────────────────────────────────────────────────────────
// VolumetricBeams — cinematic per-truck headlight light cones with:
//  - Multi-layer Gaussian-blurred beams (atmospheric Mie scattering)
//  - Soft floor pools rotated along beam direction
//  - Headlight bloom enhancement
//  - Animated dust particles drifting through beam (seeded per bay)
// Naturally clipped by bay interior — door rise reveals beam progressively.
// ─────────────────────────────────────────────────────────────────────────────

// Seeded LCG (linear congruential) pseudo-random — stable particles per bay
const seededRand = (seed) => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

const VolumetricBeams = ({ truckId, cx, truckBaseY, beamFloorY, intensity, doorOpen, bayIdx }) => {
  const spec = HEADLIGHT_BLOOMS[truckId];
  if (!spec) return null;

  // Headlight stage positions (relative to bay group)
  const Lx = cx + spec.cxLeft;
  const Rx = cx + spec.cxRight;
  const Hy = truckBaseY + spec.cy;
  const Yend = beamFloorY + 50;            // beam reaches just past floor for fade-out
  const Ypool = beamFloorY - 15;           // pool sits where bay meets floor

  // ─── DUST SPAWN ORIGIN ─────────────────────────────────────────────────
  // Beams + horizontal streaks emanate FROM the headlight position (Hy).
  // Dust particles, however, spawn BELOW the truck body (at truckBaseY)
  // so they appear only in the wheel-clearance / beam-cone region under
  // each truck — NOT over the cab/grille area between the headlights.
  // This matches a real volumetric-light effect: the beam itself is bright
  // at the source, but visible mote density is only seen where the cone
  // catches floating dust BELOW the vehicle.
  // Tunable via the Light FX Calibration Tool → Act 9 Beam Dust tab.
  const dustStartY = truckBaseY + 10;      // 10px below truck base for visual gap

  // Generate dust particles using seeded random (stable per bay)
  // 14 per side = 28 total, scattered along beam path BELOW the truck
  const rand = seededRand(7919 * (bayIdx + 1) + 31);
  const dust = [];
  for (const [hlx, side] of [[Lx, -1], [Rx, 1]]) {
    for (let i = 0; i < 14; i++) {
      const t = Math.pow(rand(), 0.7);   // bias toward mid-beam
      const beamDx = side * 95;
      const perp = (rand() - 0.5) * 35 * t;
      const px = hlx + beamDx * t + perp * 0.4;
      // Dust py spans from dustStartY (truck base + 10) DOWN to Yend (past floor),
      // NOT from Hy (headlight). This keeps dust under the truck where the
      // beam is visible against the floor, not floating over the cab.
      const py = dustStartY + (Yend - dustStartY) * t + Math.abs(perp) * 0.2;
      const pr = 0.4 + rand() * 0.9;
      const midIntensity = 4 * t * (1 - t);  // peaks at t=0.5
      const baseOpacity = (0.25 + rand() * 0.40) * midIntensity;
      // Animation params for drift + sparkle
      const driftDur = 6 + rand() * 8;     // 6-14s drift cycle
      const sparkleDur = 3 + rand() * 5;   // 3-8s sparkle cycle
      const driftDelay = -rand() * driftDur;
      const sparkleDelay = -rand() * sparkleDur;
      dust.push({ px, py, pr, baseOpacity, driftDur, sparkleDur, driftDelay, sparkleDelay, key: `d${bayIdx}-${i}-${side}` });
    }
  }

  // Beam intensity controlled by `intensity` (state.headlights, 0-1 ramp)
  const beamOp = intensity;

  return (
    <g opacity={beamOp}>
      {/* ═══ LEFT BEAM — three layers: outer haze → mid cone → inner core ═══ */}
      <path
        d={`M ${Lx - 6} ${Hy}
            Q ${Lx - 60} ${(Hy + Yend) / 2 + 15}
              ${Lx - 145} ${Yend + 30}
            L ${Lx + 15} ${Yend + 30}
            Q ${Lx + 5} ${(Hy + Yend) / 2 + 5}
              ${Lx + 6} ${Hy} Z`}
        fill="rgba(255, 245, 215, 0.10)"
        filter="url(#a9-beam-haze)"
      />
      <path
        d={`M ${Lx - 4} ${Hy}
            Q ${Lx - 35} ${(Hy + Yend) / 2 + 5}
              ${Lx - 95} ${Yend}
            L ${Lx + 5} ${Yend}
            Q ${Lx + 2} ${(Hy + Yend) / 2}
              ${Lx + 4} ${Hy} Z`}
        fill="rgba(255, 248, 225, 0.22)"
        filter="url(#a9-beam-soft)"
      />
      <path
        d={`M ${Lx - 3} ${Hy}
            Q ${Lx - 18} ${(Hy + Yend) / 2}
              ${Lx - 48} ${Yend}
            L ${Lx - 8} ${Yend}
            Q ${Lx - 2} ${(Hy + Yend) / 2 - 5}
              ${Lx + 3} ${Hy} Z`}
        fill="rgba(255, 252, 240, 0.45)"
        filter="url(#a9-beam-soft)"
      />

      {/* ═══ RIGHT BEAM — mirror of left ═══ */}
      <path
        d={`M ${Rx + 6} ${Hy}
            Q ${Rx + 60} ${(Hy + Yend) / 2 + 15}
              ${Rx + 145} ${Yend + 30}
            L ${Rx - 15} ${Yend + 30}
            Q ${Rx - 5} ${(Hy + Yend) / 2 + 5}
              ${Rx - 6} ${Hy} Z`}
        fill="rgba(255, 245, 215, 0.10)"
        filter="url(#a9-beam-haze)"
      />
      <path
        d={`M ${Rx + 4} ${Hy}
            Q ${Rx + 35} ${(Hy + Yend) / 2 + 5}
              ${Rx + 95} ${Yend}
            L ${Rx - 5} ${Yend}
            Q ${Rx - 2} ${(Hy + Yend) / 2}
              ${Rx - 4} ${Hy} Z`}
        fill="rgba(255, 248, 225, 0.22)"
        filter="url(#a9-beam-soft)"
      />
      <path
        d={`M ${Rx + 3} ${Hy}
            Q ${Rx + 18} ${(Hy + Yend) / 2}
              ${Rx + 48} ${Yend}
            L ${Rx + 8} ${Yend}
            Q ${Rx + 2} ${(Hy + Yend) / 2 - 5}
              ${Rx - 3} ${Hy} Z`}
        fill="rgba(255, 252, 240, 0.45)"
        filter="url(#a9-beam-soft)"
      />

      {/* ═══ FLOOR LIGHT POOLS ═══ Soft elongated ellipses, rotated along beam */}
      <ellipse
        cx={Lx - 65} cy={Ypool} rx="105" ry="20"
        fill="url(#a9-pool-radial)"
        filter="url(#a9-pool-glow)"
        transform={`rotate(-12 ${Lx - 65} ${Ypool})`}
        opacity="0.85"
      />
      <ellipse
        cx={Lx - 60} cy={Ypool} rx="55" ry="12"
        fill="rgba(255, 250, 230, 0.55)"
        filter="url(#a9-beam-soft)"
        transform={`rotate(-12 ${Lx - 60} ${Ypool})`}
      />
      <ellipse
        cx={Rx + 65} cy={Ypool} rx="105" ry="20"
        fill="url(#a9-pool-radial)"
        filter="url(#a9-pool-glow)"
        transform={`rotate(12 ${Rx + 65} ${Ypool})`}
        opacity="0.85"
      />
      <ellipse
        cx={Rx + 60} cy={Ypool} rx="55" ry="12"
        fill="rgba(255, 250, 230, 0.55)"
        filter="url(#a9-beam-soft)"
        transform={`rotate(12 ${Rx + 60} ${Ypool})`}
      />
      <ellipse
        cx={cx} cy={Ypool + 8} rx="170" ry="26"
        fill="url(#a9-pool-radial)"
        filter="url(#a9-pool-glow)"
        opacity="0.40"
      />

      {/* ═══ HEADLIGHT BLOOM ENHANCEMENT ═══ Soft glow around bright cores */}
      <g filter="url(#a9-headlight-bloom)" opacity="0.55">
        <circle cx={Lx} cy={Hy} r={spec.size * 1.6} fill="rgba(255, 250, 235, 0.65)" />
        <circle cx={Rx} cy={Hy} r={spec.size * 1.6} fill="rgba(255, 250, 235, 0.65)" />
      </g>

      {/* ═══ ANAMORPHIC LENS STREAKS ═══
           Per-headlight horizontal lens-flare streaks — the signature cinematic
           "anamorphic squeeze" look. Each streak is anchored to its headlight
           in truck-local coords, so streaks pan naturally with the bay during
           camera moves and only appear when that bay's headlights are on.
           Vertical-only Gaussian blur creates the sharp-horizontal/soft-vertical
           smear characteristic of real anamorphic lenses (Lindsey Optics ref).
           Cool blue-white tint contrasts the warm headlight beam — classic
           cinematic warm/cool color split. Width capped at ~170px per side to
           stay safely within the bay clip (no bleed into adjacent bays). */}
      {intensity > 0.3 && (
        <g style={{ mixBlendMode: 'screen' }} opacity={Math.min(1, (intensity - 0.3) / 0.4)}>
          {/* LEFT HEADLIGHT — three-layer streak: outer haze → mid → bright core */}
          <ellipse cx={Lx} cy={Hy} rx="170" ry="3.5"
                   fill="rgba(170, 200, 245, 0.22)"
                   filter="url(#a9-streak-haze)" />
          <ellipse cx={Lx} cy={Hy} rx="110" ry="2"
                   fill="rgba(215, 230, 255, 0.50)"
                   filter="url(#a9-streak-soft)" />
          <ellipse cx={Lx} cy={Hy} rx="55" ry="0.9"
                   fill="rgba(255, 255, 255, 0.90)"
                   filter="url(#a9-streak-soft)" />

          {/* RIGHT HEADLIGHT — mirror of left */}
          <ellipse cx={Rx} cy={Hy} rx="170" ry="3.5"
                   fill="rgba(170, 200, 245, 0.22)"
                   filter="url(#a9-streak-haze)" />
          <ellipse cx={Rx} cy={Hy} rx="110" ry="2"
                   fill="rgba(215, 230, 255, 0.50)"
                   filter="url(#a9-streak-soft)" />
          <ellipse cx={Rx} cy={Hy} rx="55" ry="0.9"
                   fill="rgba(255, 255, 255, 0.90)"
                   filter="url(#a9-streak-soft)" />
        </g>
      )}

      {/* ═══ ANIMATED DUST PARTICLES IN BEAM ═══
           Gated to the SAME intensity threshold as the anamorphic streaks
           (>0.3, fading in over 0.3→0.7) so the headlight bloom + horizontal
           streak + dust particle triad always appears together as the bay
           door opens. Without this gate, dust would show in a faint beam
           before the streaks appeared — breaking visual coherence between
           the three headlight effects.
           Each particle drifts vertically and sparkles in/out on its own
           desync'd CSS animation cycle. */}
      {intensity > 0.3 && (
        <g
          className="a9-beam-dust"
          opacity={Math.min(1, (intensity - 0.3) / 0.4)}
        >
          {dust.map(d => (
            <circle
              key={d.key}
              cx={d.px}
              cy={d.py}
              r={d.pr}
              className="a9-mote-particle"
              fill="rgba(255, 248, 225, 1)"
              style={{
                '--mote-base-op': d.baseOpacity.toFixed(3),
                '--drift-dur': `${d.driftDur.toFixed(1)}s`,
                '--sparkle-dur': `${d.sparkleDur.toFixed(1)}s`,
                '--drift-delay': `${d.driftDelay.toFixed(1)}s`,
                '--sparkle-delay': `${d.sparkleDelay.toFixed(1)}s`,
              }}
            />
          ))}
        </g>
      )}
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Truck silhouettes (high-detail traced from real reference photos —
// see build_truck_comparison.py for source SVG generation logic)
// ─────────────────────────────────────────────────────────────────────────────

const TruckSilhouette = ({ type, headlights }) => {
  switch (type) {
    case 'freightliner':  return <FreightlinerM2106 headlights={headlights} />;
    case 'mack':          return <MackMD headlights={headlights} />;
    case 'hino':          return <Hino195 headlights={headlights} />;
    case 'international': return <International4300 headlights={headlights} />;
    case 'peterbilt':     return <Peterbilt337 headlights={headlights} />;
    default: return null;
  }
};

const HeadlightPair = ({ y, spread, intensity, size = 14 }) => (
  <>
    <circle cx={-spread} cy={y} r={size * 1.1} fill="url(#a9-headlight)" opacity={intensity} />
    <circle cx={-spread} cy={y} r={size * 2.2} fill="url(#a9-headlight)" opacity={intensity * 0.55} />
    <circle cx={-spread} cy={y} r={size * 4.5} fill="url(#a9-headlight)" opacity={intensity * 0.20} />
    <circle cx={spread} cy={y} r={size * 1.1} fill="url(#a9-headlight)" opacity={intensity} />
    <circle cx={spread} cy={y} r={size * 2.2} fill="url(#a9-headlight)" opacity={intensity * 0.55} />
    <circle cx={spread} cy={y} r={size * 4.5} fill="url(#a9-headlight)" opacity={intensity * 0.20} />
  </>
);

const FreightlinerM2106 = ({ headlights }) => (
<g>
  {/* BOX BODY (taller above cab — real 26ft proportions) */}
  <rect x="-147.5" y="-480" width="295" height="295" fill="#0a0907"/>
  <rect x="-147.5" y="-480" width="295" height="3" fill="#1f1a14" opacity="0.7"/>
  <rect x="-143.5" y="-477" width="287" height="2" fill="#040302"/>
  <rect x="-147.5" y="-480" width="3" height="295" fill="#040302" opacity="0.6"/>
  <rect x="144.5" y="-480" width="3" height="295" fill="#040302" opacity="0.6"/>
  <line x1="-98.33333333333334" y1="-472" x2="-98.33333333333334" y2="-189" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="-49.16666666666667" y1="-472" x2="-49.16666666666667" y2="-189" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="0.0" y1="-472" x2="0.0" y2="-189" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="49.16666666666666" y1="-472" x2="49.16666666666666" y2="-189" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="98.33333333333331" y1="-472" x2="98.33333333333331" y2="-189" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  {/* BOX TOP CORNER CLEARANCE LIGHTS (DOT-spec amber, realistic subtle glow) */}
  <rect x="-144.0" y="-474.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="-143.0" y="-473.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="-140.5" cy="-472.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-140.5" cy="-472.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="-140.5" cy="-472.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="-140.5" cy="-472.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  <rect x="137.0" y="-474.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="138.0" y="-473.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="140.5" cy="-472.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="140.5" cy="-472.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="140.5" cy="-472.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="140.5" cy="-472.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  
  {/* CAB ROOF — squared aluminum */}
  <rect x="-118" y="-355" width="236" height="115" fill="#070504"/>
  {/* CAB ROOF CLEARANCE LIGHT ROW (4 lights, DOT identification — subtle, realistic) */}
  <rect x="-38.5" y="-362.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-37.5" y="-361.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-36" cy="-360.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-36" cy="-360.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-36" cy="-360.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="-14.5" y="-362.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-13.5" y="-361.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-12" cy="-360.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-12" cy="-360.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-12" cy="-360.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="9.5" y="-362.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="10.5" y="-361.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="12" cy="-360.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="12" cy="-360.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="12" cy="-360.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="33.5" y="-362.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="34.5" y="-361.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="36" cy="-360.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="36" cy="-360.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="36" cy="-360.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  {/* Roof highlight strip */}
  <rect x="-118" y="-355" width="236" height="3" fill="#1a1612" opacity="0.6"/>
  
  {/* MIRRORS — Freightliner signature: large square mirrors with arms */}
  <rect x="-145" y="-330" width="6" height="48" fill="#0a0908"/>
  <rect x="139" y="-330" width="6" height="48" fill="#0a0908"/>
  {/* Mirror heads */}
  <rect x="-152" y="-340" width="20" height="50" fill="#080605" stroke="#1a1612" strokeWidth="0.5"/>
  <rect x="132" y="-340" width="20" height="50" fill="#080605" stroke="#1a1612" strokeWidth="0.5"/>
  {/* Mirror down-view window */}
  <rect x="-149" y="-285" width="14" height="22" fill="#060403"/>
  <rect x="135" y="-285" width="14" height="22" fill="#060403"/>
  
  {/* WINDSHIELD — modest slope, 2500 sq in solar tinted */}
  <path d="M -110 -345 L 110 -345 L 102 -260 L -102 -260 Z" 
        fill="rgba(15, 22, 32, 0.9)" 
        stroke="rgba(110, 125, 140, 0.4)" 
        strokeWidth="1.3"/>
  {/* Windshield wipers (faint) */}
  <line x1="-60" y1="-262" x2="-30" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  <line x1="20" y1="-262" x2="50" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  
  {/* HOOD — sloped slightly forward */}
  <path d="M -98 -250 L 98 -250 L 105 -175 L 110 -120 L -110 -120 L -105 -175 Z"
        fill="#080604"/>
  {/* Hood center crease */}
  <line x1="0" y1="-248" x2="0" y2="-178" stroke="#1a1612" strokeWidth="0.8" opacity="0.5"/>
  {/* Hood Freightliner emblem (top center) */}
  <rect x="-12" y="-244" width="24" height="6" fill="rgba(180, 150, 100, 0.4)" rx="1"/>
  
  {/* GRILLE — vertical bars (Century Class style) */}
  <rect x="-72" y="-185" width="144" height="58" fill="#050403" 
        stroke="rgba(90, 78, 60, 0.6)" strokeWidth="1.2"/>
  {/* Vertical grille bars */}
  <line x1="-55" y1="-180" x2="-55" y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  <line x1="-35" y1="-180" x2="-35" y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  <line x1="-15" y1="-180" x2="-15" y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  <line x1="15"  y1="-180" x2="15"  y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  <line x1="35"  y1="-180" x2="35"  y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  <line x1="55"  y1="-180" x2="55"  y2="-130" stroke="rgba(75, 62, 48, 0.55)" strokeWidth="1.4"/>
  {/* Horizontal divider */}
  <line x1="-72" y1="-160" x2="72" y2="-160" stroke="rgba(75, 62, 48, 0.4)" strokeWidth="1"/>
  {/* Freightliner emblem on grille (small horizontal bar) */}
  <rect x="-26" y="-158" width="52" height="6" fill="rgba(180, 150, 100, 0.45)" rx="1"/>
  
  {/* HEADLIGHT HOUSINGS — rectangular composite halogen (M2 signature) */}
  {/* These are tilted slightly upward at outer edges */}
  <path d="M -98 -158 L -52 -160 L -52 -135 L -98 -132 Z" 
        fill="#0d0b09" 
        stroke="rgba(120, 100, 70, 0.4)" 
        strokeWidth="1"/>
  <path d="M 52 -160 L 98 -158 L 98 -132 L 52 -135 Z" 
        fill="#0d0b09" 
        stroke="rgba(120, 100, 70, 0.4)" 
        strokeWidth="1"/>
  {/* Inner headlight detail (the actual halogen lens) */}
  <ellipse cx="-75" cy="-146" rx="14" ry="8" fill="rgba(40, 35, 28, 0.9)"/>
  <ellipse cx="75" cy="-146" rx="14" ry="8" fill="rgba(40, 35, 28, 0.9)"/>
  {/* Side marker amber */}
  <rect x="-100" y="-152" width="3" height="8" fill="rgba(180, 100, 30, 0.6)"/>
  <rect x="97" y="-152" width="3" height="8" fill="rgba(180, 100, 30, 0.6)"/>
  
  {/* HEADLIGHT BLOOM (the actual blazing light) */}
  <HeadlightPair y={-146} spread={75} intensity={headlights} size={13} />
  
  {/* BUMPER — heavy chrome wrap-around */}
  <rect x="-118" y="-118" width="236" height="22" fill="#161310"
        stroke="rgba(110, 90, 65, 0.4)" strokeWidth="0.8"/>
  {/* Bumper highlight strip */}
  <rect x="-118" y="-118" width="236" height="2" fill="#3a322a" opacity="0.5"/>
  {/* Center recess for license plate */}
  <rect x="-22" y="-114" width="44" height="14" fill="#060403"/>
  {/* Tow hooks on bumper */}
  <rect x="-86" y="-104" width="6" height="6" fill="#3a322a"/>
  <rect x="80" y="-104" width="6" height="6" fill="#3a322a"/>
  
  {/* STEP PLATE — diamond plate texture */}
  <rect x="-100" y="-93" width="200" height="6" fill="#0a0807"/>
  
  {/* (no wheels — bay floor obscures lower body in dark interior) */}
</g>
);

const MackMD = ({ headlights }) => (
<g>
  {/* BOX BODY (taller above cab — real 26ft proportions) */}
  <rect x="-147.5" y="-485" width="295" height="305" fill="#0a0907"/>
  <rect x="-147.5" y="-485" width="295" height="3" fill="#1f1a14" opacity="0.7"/>
  <rect x="-143.5" y="-482" width="287" height="2" fill="#040302"/>
  <rect x="-147.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <rect x="144.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <line x1="-98.33333333333334" y1="-477" x2="-98.33333333333334" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="-49.16666666666667" y1="-477" x2="-49.16666666666667" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="0.0" y1="-477" x2="0.0" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="49.16666666666666" y1="-477" x2="49.16666666666666" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="98.33333333333331" y1="-477" x2="98.33333333333331" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  {/* BOX TOP CORNER CLEARANCE LIGHTS (DOT-spec amber, realistic subtle glow) */}
  <rect x="-144.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="-143.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="-140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="-140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="-140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  <rect x="137.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="138.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  
  {/* CAB ROOF — slightly taller than M2 */}
  <rect x="-115" y="-360" width="230" height="120" fill="#070504"/>
  <rect x="-115" y="-360" width="230" height="3" fill="#1a1612" opacity="0.6"/>
  {/* CAB ROOF CLEARANCE LIGHT ROW (4 lights, DOT identification — subtle, realistic) */}
  <rect x="-38.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-37.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-36" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-36" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-36" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="-14.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-13.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-12" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-12" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-12" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="9.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="10.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="12" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="12" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="12" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="33.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="34.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="36" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="36" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="36" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  
  {/* MIRRORS — Mack signature with bulldog accents */}
  <rect x="-141" y="-335" width="6" height="52" fill="#0a0908"/>
  <rect x="135" y="-335" width="6" height="52" fill="#0a0908"/>
  <rect x="-148" y="-345" width="20" height="55" fill="#080605"/>
  <rect x="128" y="-345" width="20" height="55" fill="#080605"/>
  {/* Tiny "MACK" badge on mirror back (visible from behind) */}
  <rect x="-145" y="-335" width="14" height="3" fill="rgba(180, 150, 100, 0.3)"/>
  <rect x="131" y="-335" width="14" height="3" fill="rgba(180, 150, 100, 0.3)"/>
  
  {/* WINDSHIELD */}
  <path d="M -106 -350 L 106 -350 L 100 -265 L -100 -265 Z"
        fill="rgba(15, 22, 32, 0.9)" 
        stroke="rgba(110, 125, 140, 0.4)" 
        strokeWidth="1.3"/>
  <line x1="-58" y1="-267" x2="-28" y2="-290" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  <line x1="22" y1="-267" x2="52" y2="-290" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  
  {/* HOOD — sloped (Mack signature for visibility) */}
  <path d="M -94 -255 L 94 -255 L 102 -180 L 108 -120 L -108 -120 L -102 -180 Z"
        fill="#080604"/>
  {/* Hood air intake (small slits on top) */}
  <rect x="-18" y="-252" width="36" height="3" fill="#040302"/>
  <rect x="-18" y="-247" width="36" height="2" fill="#040302"/>
  
  {/* BULLDOG HOOD ORNAMENT — Mack iconic feature */}
  <g transform="translate(0, -253)">
    {/* Bulldog body silhouette (tiny) */}
    <ellipse cx="0" cy="-2" rx="8" ry="4" fill="rgba(180, 150, 100, 0.55)"/>
    <ellipse cx="-3" cy="-4" rx="3" ry="2" fill="rgba(180, 150, 100, 0.65)"/>
    <ellipse cx="3" cy="-4" rx="3" ry="2" fill="rgba(180, 150, 100, 0.65)"/>
  </g>
  
  {/* GRILLE — Anthem-style HORIZONTAL bold slats (Mack signature) */}
  <rect x="-78" y="-188" width="156" height="62" fill="#050403"
        stroke="rgba(120, 95, 60, 0.7)" strokeWidth="1.5"/>
  {/* Horizontal slats */}
  <rect x="-72" y="-184" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-178" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-172" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-166" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-160" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-154" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-148" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-142" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-136" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  <rect x="-72" y="-130" width="144" height="2.5" fill="rgba(95, 78, 55, 0.6)"/>
  
  {/* MACK BADGE on grille (centered) */}
  <rect x="-32" y="-164" width="64" height="20" fill="rgba(20, 15, 10, 0.95)" rx="2"/>
  <text x="0" y="-150" textAnchor="middle" fontSize="11" 
        fontFamily="'Outfit', sans-serif" fontWeight="800"
        fill="rgba(220, 180, 110, 0.8)" letterSpacing="0.1em">
    MACK
  </text>
  
  {/* HEADLIGHTS — LED rectangular projector (modern Mack MD signature) */}
  <path d="M -100 -180 L -55 -185 L -55 -135 L -100 -130 Z"
        fill="#0d0b09" 
        stroke="rgba(140, 110, 75, 0.55)" 
        strokeWidth="1.5"/>
  <path d="M 55 -185 L 100 -180 L 100 -130 L 55 -135 Z"
        fill="#0d0b09" 
        stroke="rgba(140, 110, 75, 0.55)" 
        strokeWidth="1.5"/>
  {/* LED projector circles inside housing */}
  <circle cx="-78" cy="-160" r="9" fill="rgba(35, 30, 25, 0.95)" 
          stroke="rgba(160, 130, 90, 0.5)" strokeWidth="0.8"/>
  <circle cx="-78" cy="-145" r="5" fill="rgba(35, 30, 25, 0.95)" 
          stroke="rgba(160, 130, 90, 0.5)" strokeWidth="0.8"/>
  <circle cx="78" cy="-160" r="9" fill="rgba(35, 30, 25, 0.95)" 
          stroke="rgba(160, 130, 90, 0.5)" strokeWidth="0.8"/>
  <circle cx="78" cy="-145" r="5" fill="rgba(35, 30, 25, 0.95)" 
          stroke="rgba(160, 130, 90, 0.5)" strokeWidth="0.8"/>
  {/* Side amber turn signals (Mack pattern) */}
  <rect x="-100" y="-178" width="6" height="14" fill="rgba(180, 100, 30, 0.55)"/>
  <rect x="94" y="-178" width="6" height="14" fill="rgba(180, 100, 30, 0.55)"/>
  
  {/* HEADLIGHT BLOOM */}
  <HeadlightPair y={-156} spread={78} intensity={headlights} size={14} />
  
  {/* BUMPER — heavy steel (Mack signature: chrome trim option) */}
  <rect x="-115" y="-118" width="230" height="24" fill="#161310"
        stroke="rgba(120, 95, 65, 0.5)" strokeWidth="1"/>
  <rect x="-115" y="-118" width="230" height="2" fill="#3a322a" opacity="0.5"/>
  {/* Center license plate frame */}
  <rect x="-22" y="-112" width="44" height="14" fill="#060403"/>
  {/* Bumper fog lights (Mack option) */}
  <circle cx="-76" cy="-104" r="5" fill="rgba(20, 15, 10, 0.95)" stroke="rgba(140, 110, 75, 0.5)" strokeWidth="0.7"/>
  <circle cx="76" cy="-104" r="5" fill="rgba(20, 15, 10, 0.95)" stroke="rgba(140, 110, 75, 0.5)" strokeWidth="0.7"/>
  
  {/* STEEL GRATED STEPS (Mack signature) */}
  <rect x="-100" y="-93" width="200" height="6" fill="#080604"/>
  <line x1="-95" y1="-90" x2="95" y2="-90" stroke="#1a1612" strokeWidth="0.5" opacity="0.6"/>
  
</g>
);

const Hino195 = ({ headlights }) => (
<g>
  {/* BOX BODY (taller above cab — real 26ft proportions) */}
  <rect x="-152.5" y="-475" width="305" height="295" fill="#0a0907"/>
  <rect x="-152.5" y="-475" width="305" height="3" fill="#1f1a14" opacity="0.7"/>
  <rect x="-148.5" y="-472" width="297" height="2" fill="#040302"/>
  <rect x="-152.5" y="-475" width="3" height="295" fill="#040302" opacity="0.6"/>
  <rect x="149.5" y="-475" width="3" height="295" fill="#040302" opacity="0.6"/>
  <line x1="-101.66666666666666" y1="-467" x2="-101.66666666666666" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="-50.83333333333333" y1="-467" x2="-50.83333333333333" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="0.0" y1="-467" x2="0.0" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="50.83333333333334" y1="-467" x2="50.83333333333334" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="101.66666666666669" y1="-467" x2="101.66666666666669" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  {/* BOX TOP CORNER CLEARANCE LIGHTS (DOT-spec amber, realistic subtle glow) */}
  <rect x="-149.0" y="-469.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="-148.0" y="-468.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="-145.5" cy="-467.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-145.5" cy="-467.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="-145.5" cy="-467.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="-145.5" cy="-467.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  <rect x="142.0" y="-469.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="143.0" y="-468.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="145.5" cy="-467.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="145.5" cy="-467.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="145.5" cy="-467.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="145.5" cy="-467.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  
  {/* CABOVER CAB FACE — WIDER than tall (real Hino 195 proportion: ~1.23:1)
       Width 270 (-135 to 135), Height 220 (-340 to -120) */}
  <rect x="-135" y="-340" width="270" height="220" fill="#070504"/>
  {/* CAB ROOF CLEARANCE LIGHT ROW (4 lights, DOT identification — subtle, realistic) */}
  <rect x="-38.5" y="-347.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-37.5" y="-346.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-36" cy="-345.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-36" cy="-345.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-36" cy="-345.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="-14.5" y="-347.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-13.5" y="-346.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-12" cy="-345.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-12" cy="-345.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-12" cy="-345.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="9.5" y="-347.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="10.5" y="-346.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="12" cy="-345.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="12" cy="-345.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="12" cy="-345.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="33.5" y="-347.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="34.5" y="-346.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="36" cy="-345.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="36" cy="-345.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="36" cy="-345.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  
  {/* Roof line / sun visor band at top */}
  <rect x="-135" y="-340" width="270" height="3" fill="#1a1612" opacity="0.7"/>
  <rect x="-130" y="-337" width="260" height="4" fill="#040302"/>
  
  {/* WINDSHIELD — large but proper proportion (~45% of cab face height)
       Slight trapezoidal shape with TOP slightly wider (cabover slant) */}
  <path d="M -120 -333 L 120 -333 L 116 -243 L -116 -243 Z"
        fill="rgba(18, 25, 35, 0.92)" 
        stroke="rgba(120, 135, 150, 0.45)" 
        strokeWidth="1.5"/>
  {/* Inner windshield glass highlight (subtle reflection) */}
  <path d="M -116 -329 L 116 -329 L 113 -247 L -113 -247 Z" 
        fill="none" stroke="rgba(140, 155, 170, 0.10)" strokeWidth="1"/>
  {/* Windshield wipers (parked at bottom) */}
  <line x1="-70" y1="-245" x2="-25" y2="-275" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.4"/>
  <line x1="25" y1="-245" x2="70" y2="-275" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.4"/>
  {/* Center A-pillar mullion (Hino has a thin center divider sometimes) */}
  <line x1="0" y1="-333" x2="0" y2="-243" stroke="rgba(70, 80, 95, 0.18)" strokeWidth="1"/>
  
  {/* LOWER WINDSHIELD TRIM — thin black band */}
  <rect x="-120" y="-243" width="240" height="6" fill="#040302"/>
  
  {/* BODY CLADDING ZONE — black plastic horizontal section with badge */}
  <rect x="-128" y="-237" width="256" height="22" fill="#0a0807"/>
  {/* HINO badge centered on cladding */}
  <rect x="-26" y="-232" width="52" height="14" fill="rgba(20, 15, 10, 0.95)" rx="2"/>
  <text x="0" y="-221" textAnchor="middle" fontSize="10" 
        fontFamily="'Outfit', sans-serif" fontWeight="800"
        fill="rgba(200, 150, 80, 0.75)" letterSpacing="0.06em">
    HINO
  </text>
  
  {/* LOWER CAB FACE — contains grille center + headlights flanking */}
  <rect x="-135" y="-215" width="270" height="65" fill="#060504"/>
  
  {/* CENTER GRILLE — narrow horizontal grille (Hino signature: small intake) */}
  <rect x="-50" y="-210" width="100" height="40" fill="#040302"
        stroke="rgba(110, 90, 60, 0.55)" strokeWidth="1.2"/>
  {/* Horizontal grille slats */}
  <line x1="-46" y1="-202" x2="46" y2="-202" stroke="rgba(85, 70, 48, 0.55)" strokeWidth="1.5"/>
  <line x1="-46" y1="-194" x2="46" y2="-194" stroke="rgba(85, 70, 48, 0.55)" strokeWidth="1.5"/>
  <line x1="-46" y1="-186" x2="46" y2="-186" stroke="rgba(85, 70, 48, 0.55)" strokeWidth="1.5"/>
  <line x1="-46" y1="-178" x2="46" y2="-178" stroke="rgba(85, 70, 48, 0.55)" strokeWidth="1.5"/>
  
  {/* HEADLIGHTS — LARGE rectangular units flanking the grille (Hino 195 signature)
       Positioned higher than I had before — they're prominent UPPER face features */}
  {/* Left headlight: large rectangle with slight outward angle */}
  <path d="M -130 -213 L -55 -210 L -55 -158 L -130 -160 Z"
        fill="#0d0b09"
        stroke="rgba(135, 110, 75, 0.55)"
        strokeWidth="1.4"/>
  {/* Right headlight: mirror image */}
  <path d="M 55 -210 L 130 -213 L 130 -160 L 55 -158 Z"
        fill="#0d0b09"
        stroke="rgba(135, 110, 75, 0.55)"
        strokeWidth="1.4"/>
  
  {/* Headlight inner reflector detail (multi-chamber Hino signature) */}
  {/* Left */}
  <rect x="-122" y="-204" width="60" height="20" fill="rgba(35, 30, 25, 0.9)" rx="1"/>
  <line x1="-92" y1="-204" x2="-92" y2="-184" stroke="rgba(80, 65, 45, 0.35)" strokeWidth="0.8"/>
  <rect x="-122" y="-180" width="60" height="16" fill="rgba(35, 30, 25, 0.9)" rx="1"/>
  {/* Right */}
  <rect x="62" y="-204" width="60" height="20" fill="rgba(35, 30, 25, 0.9)" rx="1"/>
  <line x1="92" y1="-204" x2="92" y2="-184" stroke="rgba(80, 65, 45, 0.35)" strokeWidth="0.8"/>
  <rect x="62" y="-180" width="60" height="16" fill="rgba(35, 30, 25, 0.9)" rx="1"/>
  
  {/* Side amber turn signals (corner) */}
  <rect x="-134" y="-205" width="6" height="14" fill="rgba(180, 100, 30, 0.55)"/>
  <rect x="128" y="-205" width="6" height="14" fill="rgba(180, 100, 30, 0.55)"/>
  
  {/* HINO MIRRORS — extend WIDE (cabover signature, very prominent)
       Mounted at top of cab — main mirror + spotter below */}
  {/* Mirror struts */}
  <rect x="-148" y="-340" width="4" height="135" fill="#0a0908"/>
  <rect x="144" y="-340" width="4" height="135" fill="#0a0908"/>
  {/* Main mirror heads (large) */}
  <rect x="-160" y="-330" width="22" height="65" fill="#080605"
        stroke="#1a1612" strokeWidth="0.5"/>
  <rect x="138" y="-330" width="22" height="65" fill="#080605"
        stroke="#1a1612" strokeWidth="0.5"/>
  {/* Mirror surface (slightly lighter to suggest reflection) */}
  <rect x="-156" y="-326" width="14" height="55" fill="rgba(60, 70, 80, 0.4)"/>
  <rect x="142" y="-326" width="14" height="55" fill="rgba(60, 70, 80, 0.4)"/>
  {/* Spotter mirror below main (Hino signature for cabover visibility) */}
  <rect x="-160" y="-260" width="22" height="22" fill="#080605"
        stroke="#1a1612" strokeWidth="0.5"/>
  <rect x="138" y="-260" width="22" height="22" fill="#080605"
        stroke="#1a1612" strokeWidth="0.5"/>
  
  {/* HEADLIGHT BLOOM */}
  <HeadlightPair y={-184} spread={92} intensity={headlights} size={14} />
  
  {/* BUMPER — heavy three-piece bumper with fog light cutouts */}
  <rect x="-130" y="-150" width="260" height="30" fill="#161310"
        stroke="rgba(110, 90, 65, 0.4)" strokeWidth="0.8"/>
  {/* Bumper highlight strip */}
  <rect x="-130" y="-150" width="260" height="2" fill="#3a322a" opacity="0.5"/>
  {/* Center license plate recess */}
  <rect x="-26" y="-145" width="52" height="20" fill="#060403"/>
  {/* Side fog light recesses */}
  <circle cx="-92" cy="-132" r="6" fill="#040302" stroke="rgba(110, 90, 65, 0.3)" strokeWidth="0.8"/>
  <circle cx="92" cy="-132" r="6" fill="#040302" stroke="rgba(110, 90, 65, 0.3)" strokeWidth="0.8"/>
  {/* Bumper edge detail */}
  <line x1="-130" y1="-122" x2="130" y2="-122" stroke="#040302" strokeWidth="1"/>
  
  {/* (no wheels — bay floor obscures lower body in dark interior) */}
</g>
);

const International4300 = ({ headlights }) => (
<g>
  {/* BOX BODY (taller above cab — real 26ft proportions) */}
  <rect x="-147.5" y="-485" width="295" height="305" fill="#0a0907"/>
  <rect x="-147.5" y="-485" width="295" height="3" fill="#1f1a14" opacity="0.7"/>
  <rect x="-143.5" y="-482" width="287" height="2" fill="#040302"/>
  <rect x="-147.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <rect x="144.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <line x1="-98.33333333333334" y1="-477" x2="-98.33333333333334" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="-49.16666666666667" y1="-477" x2="-49.16666666666667" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="0.0" y1="-477" x2="0.0" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="49.16666666666666" y1="-477" x2="49.16666666666666" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="98.33333333333331" y1="-477" x2="98.33333333333331" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  {/* BOX TOP CORNER CLEARANCE LIGHTS (DOT-spec amber, realistic subtle glow) */}
  <rect x="-144.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="-143.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="-140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="-140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="-140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  <rect x="137.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="138.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  
  {/* CAB ROOF */}
  <rect x="-118" y="-358" width="236" height="120" fill="#070504"/>
  <rect x="-118" y="-358" width="236" height="3" fill="#1a1612" opacity="0.6"/>
  {/* CAB ROOF CLEARANCE LIGHT ROW (4 lights, DOT identification — subtle, realistic) */}
  <rect x="-38.5" y="-365.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-37.5" y="-364.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-36" cy="-363.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-36" cy="-363.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-36" cy="-363.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="-14.5" y="-365.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-13.5" y="-364.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-12" cy="-363.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-12" cy="-363.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-12" cy="-363.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="9.5" y="-365.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="10.5" y="-364.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="12" cy="-363.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="12" cy="-363.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="12" cy="-363.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="33.5" y="-365.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="34.5" y="-364.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="36" cy="-363.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="36" cy="-363.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="36" cy="-363.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  
  {/* MIRRORS */}
  <rect x="-145" y="-335" width="6" height="50" fill="#0a0908"/>
  <rect x="139" y="-335" width="6" height="50" fill="#0a0908"/>
  <rect x="-152" y="-345" width="20" height="55" fill="#080605"/>
  <rect x="132" y="-345" width="20" height="55" fill="#080605"/>
  
  {/* WINDSHIELD */}
  <path d="M -110 -348 L 110 -348 L 102 -260 L -102 -260 Z"
        fill="rgba(15, 22, 32, 0.9)"
        stroke="rgba(110, 125, 140, 0.4)"
        strokeWidth="1.3"/>
  <line x1="-58" y1="-262" x2="-28" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  <line x1="22" y1="-262" x2="52" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  
  {/* HOOD with raised CENTER RIDGE (DuraStar signature) */}
  <path d="M -98 -250 L 98 -250 L 105 -175 L 110 -120 L -110 -120 L -105 -175 Z"
        fill="#080604"/>
  {/* Center hood ridge */}
  <path d="M -16 -250 L 16 -250 L 14 -175 L -14 -175 Z" fill="#0a0807"/>
  <line x1="-16" y1="-248" x2="-14" y2="-177" stroke="#1a1612" strokeWidth="0.8" opacity="0.6"/>
  <line x1="16" y1="-248" x2="14" y2="-177" stroke="#1a1612" strokeWidth="0.8" opacity="0.6"/>
  {/* INTERNATIONAL emblem on hood top */}
  <rect x="-14" y="-244" width="28" height="6" fill="rgba(180, 150, 100, 0.45)" rx="1"/>
  
  {/* GRILLE — distinctive HORIZONTAL CHROME bars (International signature) */}
  <rect x="-80" y="-188" width="160" height="64" fill="#050403"
        stroke="rgba(190, 160, 115, 0.75)" strokeWidth="2"/>
  {/* Horizontal chrome slats (thicker, more prominent than Mack) */}
  <rect x="-72" y="-182" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-174" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-166" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-158" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-150" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-142" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  <rect x="-72" y="-134" width="144" height="3" fill="rgba(195, 165, 120, 0.6)"/>
  {/* INTERNATIONAL "i" badge centered */}
  <rect x="-9" y="-162" width="18" height="18" fill="rgba(20, 15, 10, 0.95)" rx="2"/>
  <text x="0" y="-148" textAnchor="middle" fontSize="14" 
        fontFamily="'Outfit', sans-serif" fontWeight="800"
        fill="rgba(220, 180, 110, 0.8)">i</text>
  
  {/* HEADLIGHTS — DUAL ROUND with chrome surround (DuraStar signature) */}
  {/* Big outer round + inner round (high beam + low beam) */}
  <circle cx="-82" cy="-152" r="20" fill="#0d0b09"
          stroke="rgba(190, 160, 115, 0.7)" strokeWidth="2.5"/>
  <circle cx="82" cy="-152" r="20" fill="#0d0b09"
          stroke="rgba(190, 160, 115, 0.7)" strokeWidth="2.5"/>
  {/* Inner reflector bowl detail */}
  <circle cx="-82" cy="-152" r="14" fill="rgba(35, 30, 25, 0.95)"/>
  <circle cx="82" cy="-152" r="14" fill="rgba(35, 30, 25, 0.95)"/>
  {/* Center LED/halogen point */}
  <circle cx="-82" cy="-152" r="3" fill="rgba(140, 110, 75, 0.4)"/>
  <circle cx="82" cy="-152" r="3" fill="rgba(140, 110, 75, 0.4)"/>
  {/* Side amber turn signals */}
  <rect x="-104" y="-156" width="8" height="14" fill="rgba(180, 100, 30, 0.6)" rx="1"/>
  <rect x="96" y="-156" width="8" height="14" fill="rgba(180, 100, 30, 0.6) " rx="1"/>
  
  {/* HEADLIGHT BLOOM */}
  <HeadlightPair y={-152} spread={82} intensity={headlights} size={16} />
  
  {/* BUMPER */}
  <rect x="-118" y="-118" width="236" height="22" fill="#161310"
        stroke="rgba(170, 140, 100, 0.5)" strokeWidth="1"/>
  <rect x="-118" y="-118" width="236" height="2" fill="#3a322a" opacity="0.5"/>
  <rect x="-22" y="-114" width="44" height="14" fill="#060403"/>
  {/* INTERNATIONAL bumper text (subtle) */}
  <rect x="40" y="-104" width="24" height="3" fill="rgba(140, 110, 75, 0.3)"/>
  
  {/* STEP PLATE */}
  <rect x="-100" y="-93" width="200" height="6" fill="#0a0807"/>
  
</g>
);

const Peterbilt337 = ({ headlights }) => (
<g>
  {/* BOX BODY (taller above cab — real 26ft proportions) */}
  <rect x="-147.5" y="-485" width="295" height="305" fill="#0a0907"/>
  <rect x="-147.5" y="-485" width="295" height="3" fill="#1f1a14" opacity="0.7"/>
  <rect x="-143.5" y="-482" width="287" height="2" fill="#040302"/>
  <rect x="-147.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <rect x="144.5" y="-485" width="3" height="305" fill="#040302" opacity="0.6"/>
  <line x1="-98.33333333333334" y1="-477" x2="-98.33333333333334" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="-49.16666666666667" y1="-477" x2="-49.16666666666667" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="0.0" y1="-477" x2="0.0" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="49.16666666666666" y1="-477" x2="49.16666666666666" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  <line x1="98.33333333333331" y1="-477" x2="98.33333333333331" y2="-184" stroke="#040302" strokeWidth="0.6" opacity="0.55"/>
  {/* BOX TOP CORNER CLEARANCE LIGHTS (DOT-spec amber, realistic subtle glow) */}
  <rect x="-144.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="-143.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="-140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="-140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="-140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  <rect x="137.0" y="-479.5" width="7" height="5.5" fill="#0d0703" rx="0.6"/>
  <rect x="138.0" y="-478.7" width="5" height="3.5" fill="rgba(40, 22, 8, 0.95)" rx="0.4"/>
  <circle cx="140.5" cy="-477.0" r="1.8" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="140.5" cy="-477.0" r="4.5" fill="rgba(255, 165, 55, 0.35)"/>
  <circle cx="140.5" cy="-477.0" r="11" fill="rgba(255, 160, 50, 0.13)"/>
  <circle cx="140.5" cy="-477.0" r="20" fill="rgba(255, 155, 45, 0.06)"/>
  
  {/* CAB ROOF */}
  <rect x="-115" y="-360" width="230" height="115" fill="#070504"/>
  <rect x="-115" y="-360" width="230" height="3" fill="#1a1612" opacity="0.6"/>
  {/* CAB ROOF CLEARANCE LIGHT ROW (4 lights, DOT identification — subtle, realistic) */}
  <rect x="-38.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-37.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-36" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-36" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-36" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="-14.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="-13.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="-12" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="-12" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="-12" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="9.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="10.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="12" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="12" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="12" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  <rect x="33.5" y="-367.0" width="5" height="3.5" fill="#0d0703" rx="0.5"/>
  <rect x="34.5" y="-366.3" width="3" height="2.2" fill="rgba(40, 22, 8, 0.95)" rx="0.3"/>
  <circle cx="36" cy="-365.2" r="1.2" fill="rgba(255, 175, 60, 0.95)"/>
  <circle cx="36" cy="-365.2" r="3" fill="rgba(255, 165, 55, 0.32)"/>
  <circle cx="36" cy="-365.2" r="7" fill="rgba(255, 160, 50, 0.10)"/>
  
  {/* MIRRORS */}
  <rect x="-141" y="-335" width="6" height="50" fill="#0a0908"/>
  <rect x="135" y="-335" width="6" height="50" fill="#0a0908"/>
  <rect x="-148" y="-345" width="20" height="55" fill="#080605"/>
  <rect x="128" y="-345" width="20" height="55" fill="#080605"/>
  
  {/* WINDSHIELD */}
  <path d="M -106 -350 L 106 -350 L 100 -260 L -100 -260 Z"
        fill="rgba(15, 22, 32, 0.9)"
        stroke="rgba(110, 125, 140, 0.4)"
        strokeWidth="1.3"/>
  <line x1="-58" y1="-262" x2="-28" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  <line x1="22" y1="-262" x2="52" y2="-285" stroke="rgba(40, 35, 30, 0.7)" strokeWidth="1.2"/>
  
  {/* HOOD — VERY SLANTED (Peterbilt signature) */}
  {/* Wider at bottom, narrower at top, dramatic angled fender lines */}
  <path d="M -82 -250 L 82 -250 L 100 -195 L 112 -120 L -112 -120 L -100 -195 Z"
        fill="#080604"/>
  {/* Hood center crease (Peterbilt has a very pronounced crease) */}
  <line x1="0" y1="-248" x2="0" y2="-198" stroke="#1a1612" strokeWidth="1.2" opacity="0.7"/>
  {/* Hood vents on each side (Peterbilt signature) */}
  <rect x="-72" y="-200" width="20" height="2" fill="#040302"/>
  <rect x="-72" y="-195" width="20" height="2" fill="#040302"/>
  <rect x="52" y="-200" width="20" height="2" fill="#040302"/>
  <rect x="52" y="-195" width="20" height="2" fill="#040302"/>
  {/* Peterbilt iconic emblem at top of hood */}
  <ellipse cx="0" cy="-242" rx="14" ry="5" fill="rgba(200, 165, 100, 0.55)"/>
  <text x="0" y="-238" textAnchor="middle" fontSize="6" 
        fontFamily="'Outfit', sans-serif" fontWeight="800"
        fill="rgba(20, 15, 10, 0.85)" letterSpacing="0.05em">PETE</text>
  
  {/* GRILLE — Peterbilt signature: VERTICAL bars with chrome surround */}
  <rect x="-65" y="-188" width="130" height="64" fill="#050403"
        stroke="rgba(195, 165, 120, 0.75)" strokeWidth="2"/>
  {/* Vertical chrome bars (more spaced than Freightliner) */}
  <line x1="-50" y1="-184" x2="-50" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  <line x1="-32" y1="-184" x2="-32" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  <line x1="-14" y1="-184" x2="-14" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  <line x1="14" y1="-184" x2="14" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  <line x1="32" y1="-184" x2="32" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  <line x1="50" y1="-184" x2="50" y2="-128" stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.8"/>
  {/* Horizontal divider (Peterbilt has a chrome bar across grille) */}
  <line x1="-65" y1="-156" x2="65" y2="-156" stroke="rgba(195, 165, 120, 0.7)" strokeWidth="2"/>
  {/* PETERBILT badge below divider */}
  <rect x="-32" y="-152" width="64" height="14" fill="rgba(20, 15, 10, 0.95)" rx="1"/>
  <text x="0" y="-141" textAnchor="middle" fontSize="8" 
        fontFamily="'Outfit', sans-serif" fontWeight="800"
        fill="rgba(220, 180, 110, 0.8)" letterSpacing="0.08em">
    PETERBILT
  </text>
  
  {/* HEADLIGHTS — ROUND with CHROME bezels (classic Peterbilt) */}
  {/* Each headlight is on the outer fender, NOT in the grille */}
  <circle cx="-90" cy="-152" r="22" fill="#0d0b09"
          stroke="rgba(200, 165, 120, 0.75)" strokeWidth="3"/>
  <circle cx="90" cy="-152" r="22" fill="#0d0b09"
          stroke="rgba(200, 165, 120, 0.75)" strokeWidth="3"/>
  {/* Inner reflector */}
  <circle cx="-90" cy="-152" r="16" fill="rgba(35, 30, 25, 0.95)"/>
  <circle cx="90" cy="-152" r="16" fill="rgba(35, 30, 25, 0.95)"/>
  {/* Bulb cluster */}
  <circle cx="-90" cy="-152" r="4" fill="rgba(160, 130, 90, 0.4)"/>
  <circle cx="90" cy="-152" r="4" fill="rgba(160, 130, 90, 0.4)"/>
  {/* Side lower amber turn signals (small) */}
  <rect x="-110" y="-138" width="6" height="10" fill="rgba(180, 100, 30, 0.55)" rx="1"/>
  <rect x="104" y="-138" width="6" height="10" fill="rgba(180, 100, 30, 0.55)" rx="1"/>
  
  {/* HEADLIGHT BLOOM */}
  <HeadlightPair y={-152} spread={90} intensity={headlights} size={17} />
  
  {/* BUMPER — heavy chrome-trimmed */}
  <rect x="-118" y="-118" width="236" height="22" fill="#161310"
        stroke="rgba(195, 165, 120, 0.6)" strokeWidth="1.2"/>
  <rect x="-118" y="-118" width="236" height="2" fill="#3a322a" opacity="0.5"/>
  <rect x="-22" y="-114" width="44" height="14" fill="#060403"/>
  {/* Tow hooks */}
  <rect x="-86" y="-104" width="6" height="6" fill="rgba(180, 150, 100, 0.5)"/>
  <rect x="80" y="-104" width="6" height="6" fill="rgba(180, 150, 100, 0.5)"/>
  
  <rect x="-100" y="-93" width="200" height="6" fill="#0a0807"/>
  
</g>
);

// ─────────────────────────────────────────────────────────────────────────────
// Bay Label HUD
// ─────────────────────────────────────────────────────────────────────────────

const BayLabelHUD = ({ elapsedMs, bayStates, trucks, cameraScale, cameraX }) => {
  // Pick the bay nearest to camera that's currently revealed (label > 0.05).
  // This way during the tracking pullback, the HUD updates to match the bay
  // the camera is currently framing — not stuck on the last-revealed bay.
  let activeIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < 5; i++) {
    if (bayStates[i].label > 0.05 && cameraScale > 0.6) {
      const dist = Math.abs(cameraX - BAY_CENTERS[i]);
      if (dist < bestDist) {
        bestDist = dist;
        activeIdx = i;
      }
    }
  }

  if (activeIdx === -1) return null;

  const opacity = bayStates[activeIdx].label;
  if (opacity < 0.05) return null;

  const truck = trucks[activeIdx];

  return (
    <div className="a9-bay-label-hud" style={{ opacity }}>
      <div className="a9-bay-label-eyebrow">{truck.bayLabel}</div>
      <div className="a9-bay-label-name">{truck.name}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────

const ACT9_STYLES = `
.a9-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.a9-scene-wrap {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
}
.a9-scene-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  will-change: transform;
}
.a9-bay-label-hud {
  position: absolute;
  left: 32px;
  bottom: 110px;
  z-index: 50;
  font-family: 'IBM Plex Mono', monospace;
  pointer-events: none;
  will-change: opacity;
  transition: opacity 220ms ease-out;
}
.a9-bay-label-eyebrow {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 200, 130, 0.85);
  letter-spacing: 0.32em;
  text-shadow: 0 0 12px rgba(255, 180, 100, 0.5);
}
.a9-bay-label-name {
  font-family: 'Outfit', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 245, 230, 0.96);
  letter-spacing: 0.12em;
  margin-top: 4px;
  text-shadow:
    0 0 16px rgba(0, 0, 0, 0.95),
    0 2px 6px rgba(0, 0, 0, 0.85);
}
.a9-chromatic {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 80% at 0% 0%,
      rgba(255, 100, 50, 0.13) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 0%,
      rgba(120, 200, 255, 0.10) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 0% 100%,
      rgba(120, 200, 255, 0.10) 0%, transparent 40%),
    radial-gradient(ellipse 80% 80% at 100% 100%,
      rgba(255, 100, 50, 0.13) 0%, transparent 40%);
  mix-blend-mode: screen;
}
.a9-halation {
  position: absolute;
  inset: -10%;
  z-index: 4;
  pointer-events: none;
  mix-blend-mode: screen;
  filter: blur(42px);
  opacity: 0.45;
  background: radial-gradient(ellipse at 50% 50%,
    rgba(255, 195, 130, 0.35) 0%,
    rgba(220, 150, 80, 0.15)  35%,
    transparent              75%);
}
.a9-haze {
  position: absolute;
  inset: -20%;
  z-index: 5;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.a9-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.014 0.022' numOctaves='3' seed='5'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 0.84  0 0 0 0 0.55  0 0 0 0.18 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 220% 160%;
  opacity: 0.24;
  animation: a9HazeFar 44s linear infinite;
  filter: blur(13px);
}
.a9-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.024 0.038' numOctaves='2' seed='9'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 0.90  0 0 0 0 0.70  0 0 0 0.20 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 190% 140%;
  opacity: 0.20;
  animation: a9HazeMid 30s linear infinite;
  filter: blur(8px);
}
.a9-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.038 0.058' numOctaves='2' seed='15'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 0.93  0 0 0 0 0.82  0 0 0 0.14 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 170% 130%;
  opacity: 0.16;
  animation: a9HazeNear 22s linear infinite;
  filter: blur(5px);
}
@keyframes a9HazeFar {
  0%   { transform: translateX(-2%) translateY(0%)   scale(1.02); }
  50%  { transform: translateX(2%)  translateY(-1%)  scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%)   scale(1.02); }
}
@keyframes a9HazeMid {
  0%   { transform: translateX(3%)  translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%)  scale(1.06); }
  100% { transform: translateX(3%)  translateY(-0.5%) scale(1.03); }
}
@keyframes a9HazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%)  scale(1.04); }
  50%  { transform: translateX(2%)    translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%)  scale(1.04); }
}
.a9-dust {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
}
.a9-mote {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(255, 230, 175, 0.85) 0%,
    rgba(255, 220, 160, 0)   70%);
  box-shadow: 0 0 5px rgba(255, 220, 160, 0.45);
  will-change: transform, opacity;
  animation-name: a9MoteDrift;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  opacity: 0;
}
@keyframes a9MoteDrift {
  0%   { transform: translate(0, 0);          opacity: 0;    }
  12%  { opacity: 0.55; }
  50%  { transform: translate(28px, -36px);   opacity: 0.65; }
  88%  { opacity: 0.40; }
  100% { transform: translate(56px, -72px);   opacity: 0;    }
}

/* ═══ HEADLIGHT BEAM DUST PARTICLES ═══
   Each particle gets unique timing via CSS custom properties, so they drift
   independently. Combined drift (slow vertical float) + sparkle (opacity fade in/out)
   creates the volumetric atmosphere of dust catching light in a real beam. */
.a9-beam-dust {
  pointer-events: none;
}
.a9-mote-particle {
  animation:
    a9BeamDustDrift var(--drift-dur, 10s) ease-in-out infinite var(--drift-delay, 0s),
    a9BeamDustSparkle var(--sparkle-dur, 5s) ease-in-out infinite var(--sparkle-delay, 0s);
  transform-box: fill-box;
  transform-origin: center;
  will-change: transform, opacity;
}
@keyframes a9BeamDustDrift {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(2px, -3px); }
  50%  { transform: translate(-1px, -5px); }
  75%  { transform: translate(-3px, -2px); }
  100% { transform: translate(0, 0); }
}
@keyframes a9BeamDustSparkle {
  0%   { opacity: 0; }
  20%  { opacity: calc(var(--mote-base-op) * 0.4); }
  50%  { opacity: var(--mote-base-op); }
  80%  { opacity: calc(var(--mote-base-op) * 0.5); }
  100% { opacity: 0; }
}
.a9-warm-grade {
  position: absolute;
  inset: 0;
  z-index: 14;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 60%,
    rgba(255, 200, 130, 0.04)  0%,
    rgba(220, 140, 70, 0.08)  60%,
    rgba(80, 40, 15, 0.16) 100%);
  mix-blend-mode: multiply;
}
.a9-vignette {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  background: radial-gradient(ellipse at center,
    transparent 30%,
    rgba(0, 0, 0, 0.55) 100%);
}
.a9-scanlines {
  position: absolute;
  inset: 0;
  z-index: 16;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.0) 0px,
    rgba(0, 0, 0, 0.0) 2px,
    rgba(0, 0, 0, 0.07) 3px,
    rgba(0, 0, 0, 0.0) 4px
  );
  mix-blend-mode: multiply;
  opacity: 0.40;
}
.a9-grain {
  position: absolute;
  inset: 0;
  z-index: 17;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  mix-blend-mode: overlay;
  opacity: 0.55;
  animation: a9GrainShift 0.5s steps(4) infinite;
}
@keyframes a9GrainShift {
  0%   { background-position: 0 0; }
  25%  { background-position: 23px -41px; }
  50%  { background-position: -67px 11px; }
  75%  { background-position: 31px 53px; }
  100% { background-position: 0 0; }
}
.a9-fade-out {
  position: absolute;
  inset: 0;
  z-index: 99;
  background: #060403;
  pointer-events: none;
  will-change: opacity;
}
.a9-skip-btn {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 95;
  padding: 8px 16px;
  background: rgba(20, 16, 10, 0.65);
  color: rgba(255, 240, 215, 0.55);
  border: 0.5px solid rgba(255, 240, 215, 0.20);
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
.a9-skip-btn:hover { color: rgba(255, 250, 235, 0.85); }
.perf-reduce-motion .a9-haze,
.perf-reduce-motion .a9-mote,
.perf-reduce-motion .a9-grain {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .a9-haze,
  .a9-mote,
  .a9-grain {
    animation: none !important;
  }
}
`;

export default Act9TheLongGame;
export { TruckSilhouette };
