// ═══════════════════════════════════════════════════════════════════════════
// DOTInspection.jsx — Phase 1 Skeleton
// ═══════════════════════════════════════════════════════════════════════════
// Box Truck Boss · Phase 4b · Cab POV Realism
//
// This component dramatizes a DOT Level I / II / III roadside inspection.
// The player sits in the cab; the officer runs the inspection sequence.
// Player agency: produce documents on request, operate cab controls on cue,
// transfer ELD data, and watch the walkaround.
//
// Phase 1 ships: skeleton state machine, timer lifecycle, audio context,
// props contract, hero image references, and an empty render tree that
// matches the master plan layout. NO gameplay logic yet.
//
// Master plan: DOT_Inspection_Master_Plan_v5.docx (§10 integration contract,
// §13 build spec, §3.3 state machine).
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { validateSchedule, getViolationDetails, VT } from './HOSPuzzle';

// ─── ASSET HOSTING ────────────────────────────────────────────────────────
// Assets are hosted on GitHub to match the _GH_BASE pattern used elsewhere
// in App.jsx (driver portraits, soundtrack, ambient audio). Browsers cache
// aggressively after first hit, and hosting externally keeps the Capacitor
// APK lean. If GitHub is unreachable the component falls back to background
// colors and text-only Marcus coaching — never crashes.
const _DOT_GH_BASE = 'https://raw.githubusercontent.com/boxtruckhim/box-truck-biz-sim/main/';

// ─── HERO IMAGE PATHS ─────────────────────────────────────────────────────
// Files live at {_DOT_GH_BASE}images/inspection/NN_name.jpg.
const HERO = {
  highway:        _DOT_GH_BASE + 'images/inspection/01_highway.jpg',
  prepassAmber:   _DOT_GH_BASE + 'images/inspection/02_prepass_amber.jpg',
  prepassRed:     _DOT_GH_BASE + 'images/inspection/03_prepass_red.jpg',
  officerApproach:_DOT_GH_BASE + 'images/inspection/04_officer_approach.jpg',
  officerWindow:  _DOT_GH_BASE + 'images/inspection/05_officer_window.jpg',
  dvir:           _DOT_GH_BASE + 'images/inspection/06_dvir.jpg',
  oosSticker:     _DOT_GH_BASE + 'images/inspection/07_oos_sticker.jpg',
  cabPristine:    _DOT_GH_BASE + 'images/inspection/08_cab_pristine.jpg',
  cabClean:       _DOT_GH_BASE + 'images/inspection/09_cab_clean.jpg',
  cabAverage:     _DOT_GH_BASE + 'images/inspection/10_cab_average.jpg',
  cabMessy:       _DOT_GH_BASE + 'images/inspection/11_cab_messy.jpg',
  cabDisaster:    _DOT_GH_BASE + 'images/inspection/12_cab_disaster.jpg',
};

const VIDEO = {
  highwayLoop:    _DOT_GH_BASE + 'videos/inspection/highway_loop.mp4',
  walkaroundLoop: _DOT_GH_BASE + 'videos/inspection/walkaround_loop.mp4',
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────
// Consistent with the v4 preview aesthetic and Box Truck Boss's dark-industrial
// visual language. All colors referenced in styles below.
const T = {
  bg:       '#08090b',
  bg1:      '#0e1014',
  bg2:      '#14171d',
  panel:    '#1a1d24',
  border:   'rgba(255,255,255,0.06)',
  border2:  'rgba(255,255,255,0.12)',
  text:     'rgba(255,255,255,0.92)',
  text2:    'rgba(255,255,255,0.62)',
  text3:    'rgba(255,255,255,0.38)',
  amber:      '#FFB020',
  amberSoft:  '#FFC24D',
  amberDim:   'rgba(255,176,32,0.14)',
  amberGlow:  'rgba(255,176,32,0.45)',
  red:        '#FF3B3B',
  redDim:     'rgba(255,59,59,0.18)',
  redGlow:    'rgba(255,59,59,0.55)',
  green:      '#22C55E',
  greenSoft:  '#44FF88',
  greenDim:   'rgba(34,197,94,0.15)',
  greenGlow:  'rgba(34,197,94,0.45)',
  blue:       '#3B82F6',
  blueSoft:   '#60A5FA',
  blueDim:    'rgba(59,130,246,0.14)',
  fontSans:    "'Outfit', 'SF Pro Display', -apple-system, sans-serif",
  fontMono:    "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  fontDisplay: "'Oxanium', 'Outfit', sans-serif",
};

// ─── FINITE STATE MACHINE ─────────────────────────────────────────────────
// Per master plan §3.3 — 10 states, each with a target next state (or null
// to indicate a branching/terminal state resolved by other logic).
// Durations are in milliseconds. MIN_DURATION ensures the player has at
// least that long before the state can advance even if logic is instant.
const STATES = {
  CINEMATIC:        'cinematic',
  APPROACH:         'approach',
  FIRST_IMPRESSION: 'first_impression',
  DOCUMENTS:        'documents',
  ELD_TRANSFER:     'eld_transfer',
  SAFETY_DEMOS:     'safety_demos',
  WALKAROUND:       'walkaround',
  FINDINGS_REVIEW:  'findings_review',
  OUTCOME:          'outcome',
  COMPLETE:         'complete',
};

// Minimum time each state holds before the FSM will advance.
// In Phase 1 these are used by the skeleton auto-advancer.
// Phases 2-6 will add event-driven transitions (document tapped, etc).
const STATE_MIN_DURATION_MS = {
  [STATES.CINEMATIC]:        12000,
  [STATES.APPROACH]:         3000,
  [STATES.FIRST_IMPRESSION]: 3500,
  [STATES.DOCUMENTS]:       30000,
  [STATES.ELD_TRANSFER]:   20000,
  [STATES.SAFETY_DEMOS]:   30000,
  [STATES.WALKAROUND]:     45000,
  [STATES.FINDINGS_REVIEW]: 6000,
  [STATES.OUTCOME]:        15000,
  [STATES.COMPLETE]:            0,
};

// Linear progression map. In Phase 1 every state advances to the next.
// Phase 5 will add branching (e.g., OUTCOME can branch to KNOWINGLY).
const STATE_NEXT = {
  [STATES.CINEMATIC]:        STATES.APPROACH,
  [STATES.APPROACH]:         STATES.FIRST_IMPRESSION,
  [STATES.FIRST_IMPRESSION]: STATES.DOCUMENTS,
  [STATES.DOCUMENTS]:        STATES.ELD_TRANSFER,
  [STATES.ELD_TRANSFER]:     STATES.SAFETY_DEMOS,
  [STATES.SAFETY_DEMOS]:     STATES.WALKAROUND,
  [STATES.WALKAROUND]:       STATES.FINDINGS_REVIEW,
  [STATES.FINDINGS_REVIEW]:  STATES.OUTCOME,
  [STATES.OUTCOME]:          STATES.COMPLETE,
  [STATES.COMPLETE]:         null,
};

// Which phases auto-advance on a timer vs. wait for an event-driven handler.
// Handler-driven phases (DOCUMENTS, ELD_TRANSFER, SAFETY_DEMOS, WALKAROUND)
// call advanceToPhase themselves when the player completes the sequence.
// A watchdog timer (5 min) still fires as a safety net if a handler fails.
const AUTO_ADVANCE_PHASES = {
  [STATES.CINEMATIC]:        true,
  [STATES.APPROACH]:         true,
  [STATES.FIRST_IMPRESSION]: true,
  [STATES.DOCUMENTS]:        false,
  [STATES.ELD_TRANSFER]:     false,
  [STATES.SAFETY_DEMOS]:     false,
  [STATES.WALKAROUND]:       false,
  [STATES.FINDINGS_REVIEW]:  true,
  [STATES.OUTCOME]:          true,
  [STATES.COMPLETE]:         false,
};
const WATCHDOG_DURATION_MS = 300000;

// Human-readable phase labels for the officer card "phase pill".
const PHASE_LABELS = {
  [STATES.CINEMATIC]:        'APPROACH',
  [STATES.APPROACH]:         'APPROACH',
  [STATES.FIRST_IMPRESSION]: 'GREETING',
  [STATES.DOCUMENTS]:        'DOCUMENTS',
  [STATES.ELD_TRANSFER]:     'ELD TRANSFER',
  [STATES.SAFETY_DEMOS]:     'SAFETY DEMO',
  [STATES.WALKAROUND]:       'WALKAROUND',
  [STATES.FINDINGS_REVIEW]:  'REVIEW',
  [STATES.OUTCOME]:          'VERDICT',
  [STATES.COMPLETE]:         'COMPLETE',
};

// ─── PROFESSIONALISM SCORING CONSTANTS ────────────────────────────────────
// Per master plan §6. Score is internal state only — NEVER displayed as a
// number in the UI. Surfaces as officer badge color, speech tone, and
// Marcus closing commentary.
const PRO_SCORE = {
  INITIAL: 50,
  MIN: 0,
  MAX: 100,
  // Starting impression modifiers (master plan §6.1)
  CAB_PRISTINE:        +15,
  CAB_CLEAN:           +10,
  CAB_AVERAGE:           0,
  CAB_MESSY:           -20,
  CAB_DISASTER:        -30,
  DOCS_ORGANIZED:      +10,
  DOCS_DISORGANIZED:   -15,
  STAYED_IN_CAB:        +5,
  EXITED_UNINVITED:    -10,
  HANDS_VISIBLE:        +5,
  VALID_CVSA_DECAL:    +15,
  // Runtime modifiers (master plan §6.2) — consumed in Phases 2-5
  DOC_FAST:             +3,
  DOC_OK:               +1,
  DOC_SLOW:             -2,
  DOC_WRONG:            -5,
  ELD_FIRST_TRY:        +8,
  ELD_RETRY:            -4,
  CAB_CTRL_CORRECT:     +3,
  CAB_CTRL_WRONG:       -3,
  DEMEANOR_POLITE:      +5,
  DEMEANOR_CURT:       -10,
  ACCEPTED_FINDING:     +5,
  ARGUED_FINDING:      -15,
};

// Professionalism score tier thresholds (for officer visual feedback)
const PRO_TIER = {
  HIGH_THRESHOLD: 80,
  LOW_THRESHOLD:  30,
};

// ─── CAB CLEANLINESS STATE LOOKUP ─────────────────────────────────────────
// Per master plan §7.1 — 5 discrete visual states.
// cabCleanliness prop is 0-100; this maps to a qualitative tier.
const CAB_TIERS = [
  { max: 15,  key: 'disaster', image: HERO.cabDisaster, label: 'DISASTER', proMod: PRO_SCORE.CAB_DISASTER },
  { max: 40,  key: 'messy',    image: HERO.cabMessy,    label: 'MESSY',    proMod: PRO_SCORE.CAB_MESSY    },
  { max: 65,  key: 'average',  image: HERO.cabAverage,  label: 'AVERAGE',  proMod: PRO_SCORE.CAB_AVERAGE  },
  { max: 85,  key: 'clean',    image: HERO.cabClean,    label: 'CLEAN',    proMod: PRO_SCORE.CAB_CLEAN    },
  { max: 100, key: 'pristine', image: HERO.cabPristine, label: 'PRISTINE', proMod: PRO_SCORE.CAB_PRISTINE },
];

const cabTierFor = (cleanliness) => {
  const c = Math.max(0, Math.min(100, cleanliness ?? 70));
  return CAB_TIERS.find(t => c <= t.max) || CAB_TIERS[0];
};

// ─── INSPECTION LEVEL ─────────────────────────────────────────────────────
const LEVEL = {
  I:   'I',   // Full 37-step North American Standard
  II:  'II',  // Walk-Around Driver/Vehicle
  III: 'III', // Driver/Credential/Administrative
};

// Initial level selection by CSA score (Phase 1 placeholder — Phase 3
// will add randomization, CVSA Roadcheck seasonal bias, etc.)
const initialInspectionLevel = (csaScore) => {
  if (csaScore >= 60) return LEVEL.I;
  if (csaScore >= 30) return LEVEL.II;
  return LEVEL.III;
};

// ─── TIMER CONFIGURATION ──────────────────────────────────────────────────
// Officer impatience timer total duration, per inspection level.
// Level I inspections take longer; officers expect this.
const OFFICER_TIMER_MS = {
  [LEVEL.I]:   6 * 60 * 1000, // 6 minutes
  [LEVEL.II]:  5 * 60 * 1000, // 5 minutes
  [LEVEL.III]: 3 * 60 * 1000, // 3 minutes
};

// Tick interval for the officer impatience countdown display.
const TIMER_TICK_MS = 250;

// ─── AUDIO CONFIGURATION ──────────────────────────────────────────────────
// Web Audio API tones. Phase 1 only defines the constants; Phase 6 wires them up.
const AUDIO = {
  PHASE_TRANSITION: { freq: 440, dur: 0.12, type: 'sine',     vol: 0.08 },
  DOCUMENT_TAP:     { freq: 660, dur: 0.08, type: 'triangle', vol: 0.10 },
  WRONG_DOC:        { freq: 180, dur: 0.22, type: 'sawtooth', vol: 0.08 },
  OFFICER_APPROACH: { freq: 220, dur: 0.30, type: 'sine',     vol: 0.06 },
  FINDING_CLEAN:    { freq: 880, dur: 0.06, type: 'sine',     vol: 0.08 },
  FINDING_WARN:     { freq: 440, dur: 0.14, type: 'square',   vol: 0.09 },
  FINDING_OOS:      { freq: 130, dur: 0.40, type: 'sawtooth', vol: 0.12 },
  KNOWING_STAMP:    { freq:  90, dur: 0.60, type: 'sawtooth', vol: 0.14 },
  CLEAN_PASS:       { freq: 720, dur: 0.30, type: 'sine',     vol: 0.10 },
};

// ─── PHASE 2: DOT COMPLIANCE FOLDER — DOCUMENT CATALOG ─────────────────
// Per master plan §5.2 — 8 canonical documents, always in this order.
// Each has a stable id, display label, regulation reference, and an SVG
// icon path. The icon paths are rendered inside a <svg viewBox="0 0 24 24">.
// Colors are provided by the parent via currentColor.
const DOT_COMPLIANCE_DOCS = [
  {
    id: 'license',
    label: 'Driver License',
    sublabel: 'Class B + Medical',
    cfr: '49 CFR 383',
    iconPath: 'M4 7 h16 v10 h-16 z M6 9 c0 -1 1 -2 2 -2 s2 1 2 2 s -1 2 -2 2 s-2 -1 -2 -2 Z M12 10 h6 M12 12 h6 M12 14 h4',
  },
  {
    id: 'medcard',
    label: 'Medical Card',
    sublabel: 'Examiner Cert',
    cfr: '49 CFR 391.43',
    iconPath: 'M4 5 h16 v14 h-16 z M12 9 v6 M9 12 h6',
  },
  {
    id: 'registration',
    label: 'Registration',
    sublabel: 'State DMV',
    cfr: 'State',
    iconPath: 'M4 5 h16 v14 h-16 z M6 9 h12 M6 12 h12 M6 15 h8',
  },
  {
    id: 'insurance',
    label: 'Insurance',
    sublabel: '$750K Minimum',
    cfr: '49 CFR 387',
    iconPath: 'M12 3 L20 7 v7 c0 4 -4 7 -8 7 s-8 -3 -8 -7 V7 Z M9 11 l2 2 l4 -4',
  },
  {
    id: 'annual',
    label: 'Annual Inspection',
    sublabel: 'Periodic Cert',
    cfr: '49 CFR 396.17',
    iconPath: 'M12 4 a8 8 0 1 1 0 16 a8 8 0 1 1 0 -16 Z M8 12 l3 3 l5 -5',
  },
  {
    id: 'dvir',
    label: "Today's DVIR",
    sublabel: 'Pre-Trip Report',
    cfr: '49 CFR 396.11',
    iconPath: 'M4 5 h16 v14 h-16 z M8 3 h8 v3 h-8 z M6 11 h12 M6 14 h12 M6 17 h8',
  },
  {
    id: 'eld_card',
    label: 'ELD Card',
    sublabel: 'Transfer + Malfunction',
    cfr: '49 CFR 395.22',
    iconPath: 'M4 6 h16 v12 h-16 z M6 8 h12 v6 h-12 z M8 16 h2 M12 16 h2 M16 16 h1',
  },
  {
    id: 'dot_number',
    label: 'DOT Authority',
    sublabel: 'Carrier Operating',
    cfr: 'FMCSA Reg',
    iconPath: 'M6 4 h12 v16 h-12 z M9 8 h6 M9 11 h6 M10 15 h4 M10 17 h4',
  },
];

// Load folder — just BOL. HazMat not in current game design per user direction.
const LOAD_DOCS = [
  {
    id: 'bol',
    label: 'Bill of Lading',
    sublabel: "Today's shipment",
    cfr: 'Shipper',
    iconPath: 'M5 4 h14 v16 h-14 z M7 8 h10 M7 11 h10 M7 14 h6 M8 17 h3',
  },
];

// ─── PHASE 2: CAB CONTROLS CATALOG ──────────────────────────────────────
// Per master plan §4.4 — officer requests demonstrations of these.
// Primary: 6 most common controls, always visible in 3x2 grid.
// Secondary: high beam + individual L/R signals, revealed on toggle.
const CAB_CONTROLS_PRIMARY = [
  { id: 'headlights', label: 'Headlights', sublabel: 'Low Beam',
    iconPath: 'M7 10 c0 -3 2 -5 5 -5 s5 2 5 5 M7 10 v5 h10 v-5 M3 9 l2 1 M21 9 l-2 1 M19 12 h2 M3 12 h2 M19 15 l2 1 M3 15 l2 -1' },
  { id: 'flashers', label: '4-Way', sublabel: 'Hazards',
    iconPath: 'M12 2 L14 10 L22 10 L16 14 L18 22 L12 17 L6 22 L8 14 L2 10 L10 10 Z', filled: true },
  { id: 'horn', label: 'Horn', sublabel: 'Electric',
    iconPath: 'M3 10 v4 h3 l6 4 v-12 l-6 4 z M15 9 c2 2 2 4 0 6 M18 7 c4 3 4 7 0 10' },
  { id: 'brakes', label: 'Brake Pedal', sublabel: 'Service',
    iconPath: 'M9 4 h6 v10 h-6 z M12 14 v4 M5 18 h14' },
  { id: 'low_air', label: 'Low Air', sublabel: 'Warning Test',
    iconPath: 'M12 4 a8 8 0 1 1 0 16 a8 8 0 1 1 0 -16 Z M12 12 v-5 M12 12 l3 2' },
  { id: 'signals', label: 'Turn Signal', sublabel: 'L / R Cycle',
    iconPath: 'M4 12 l6 -6 v4 h8 v4 h-8 v4 z', filled: true },
];

const CAB_CONTROLS_SECONDARY = [
  { id: 'high_beam', label: 'High Beam', sublabel: 'Bright',
    iconPath: 'M7 10 c0 -3 2 -5 5 -5 s5 2 5 5 M7 10 v5 h10 v-5 M2 8 l3 1 M22 8 l-3 1 M19 12 h3 M2 12 h3 M19 16 l3 1 M2 16 l3 -1 M19 5 l2 -2 M5 5 l-2 -2' },
  { id: 'left_signal', label: 'Left Signal', sublabel: 'Turn L',
    iconPath: 'M20 12 l-6 -6 v4 h-8 v4 h8 v4 z', filled: true },
  { id: 'right_signal', label: 'Right Signal', sublabel: 'Turn R',
    iconPath: 'M4 12 l6 -6 v4 h8 v4 h-8 v4 z', filled: true },
  { id: 'air_horn', label: 'Air Horn', sublabel: 'Compressed',
    iconPath: 'M3 10 v4 h3 l6 4 v-12 l-6 4 z M16 6 l2 -2 M16 18 l2 2 M16 9 h3 M16 12 h4 M16 15 h3' },
];

// ─── PHASE 2: DEMO OFFICER DIALOG + REQUEST TARGETS ─────────────────────
// Phase 3 will replace these with a branching dialog bank driven by the
// scenario engine and randomization. Phase 2 uses static demo text so the
// player can verify each phase's interaction panel works.
const DEMO_OFFICER_DIALOG = {
  [STATES.APPROACH]:         "Good afternoon. Routine check — stay in the cab please.",
  [STATES.FIRST_IMPRESSION]: "Level II inspection. Hands on the wheel, I'll come to you.",
  [STATES.DOCUMENTS]:        "License and registration, please.",
  [STATES.ELD_TRANSFER]:     "Transfer your ELD logs. Routing code coming up.",
  [STATES.SAFETY_DEMOS]:     "Cycle your headlights — low beam.",
  [STATES.WALKAROUND]:       "Stand by. I'll be walking around the truck.",
  [STATES.FINDINGS_REVIEW]:  "Reviewing my findings — one moment.",
  [STATES.OUTCOME]:          "",
};

const DEMO_REQUEST_TARGETS = {
  [STATES.DOCUMENTS]:    { kind: 'doc',     id: 'license'    },
  [STATES.SAFETY_DEMOS]: { kind: 'control', id: 'headlights' },
};

// ─── PHASE 2: MARCUS RADIO LINES ────────────────────────────────────────
// Phase 2 ships a subset; full voice bank (master plan §14) lands in Phase 3.
const MARCUS_LINES = {
  walkaround: "Hands visible. Don't volunteer anything. Every pre-trip you ran clean earns its keep right here.",
  first_impression_clean: "Clean cab, organized folder. That's the posture that gets waved through.",
  first_impression_messy: "Cab's a disaster. That officer's going to look twice at everything now.",
};

// ─── PHASE 2: ELD ROUTING CODE GENERATOR ────────────────────────────────
// Per master plan §4.3 — each inspection gets a fresh code.
// Format: 3 letters + dash + 4 digits (e.g., ALV-4821).
// Deterministic per inspection so the code is stable across re-renders.
const generateRoutingCode = (seed) => {
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ'; // skip I/O/Q to avoid confusion
  let s = (seed | 0) || Math.floor(Date.now() / 1000);
  const r = (mod) => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s % mod;
  };
  const a = letters[r(letters.length)];
  const b = letters[r(letters.length)];
  const c = letters[r(letters.length)];
  const n = (1000 + r(9000)).toString();
  return `${a}${b}${c}-${n}`;
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: SCENARIO RUNTIME — DEFECT POOL, DIALOGUE BANK, MARCUS COACH
// ═══════════════════════════════════════════════════════════════════════════

// ─── SEEDED RNG ─────────────────────────────────────────────────────────
// Linear congruential generator. Deterministic per inspection when seeded
// from inspectionStartMs. Used by the scenario generator and walkaround
// finding producer so re-renders never change the outcome mid-inspection.
function makeRng(seed) {
  let s = (seed | 0) || Math.floor(Date.now() / 1000);
  return {
    next: () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s;
    },
    int: (mod) => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s % mod;
    },
    float: () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    },
    pick: (arr) => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return arr[s % arr.length];
    },
    chance: (p) => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return (s / 0x7fffffff) < p;
    },
  };
}

// ─── TRUCK ZONES ────────────────────────────────────────────────────────
// Per master plan §8 — the six inspection zones the officer walks through.
// Order reflects a realistic CVSA walkaround path: start at driver side,
// circle the truck, finish at rear. Each zone has a dwell time range.
// Phase 4 adds `pos` (CSS percentage coordinates over the tactical truck image)
// and `officerPos` (where the officer sprite stands when inspecting this zone).
const TRUCK_ZONES = [
  { id: 'driver_side',    label: 'Driver Side',     dwellMs: [5500, 8500], defectCategories: ['brakes', 'tires', 'lights', 'body'],
    pos: { x: 22, y: 50 }, officerPos: { x: 12, y: 58 } },
  { id: 'front',          label: 'Front',           dwellMs: [4000, 6500], defectCategories: ['lights', 'glass', 'body'],
    pos: { x: 6,  y: 57 }, officerPos: { x: 2,  y: 62 } },
  { id: 'passenger_side', label: 'Passenger Side',  dwellMs: [4500, 7500], defectCategories: ['tires', 'lights', 'fuel'],
    pos: { x: 65, y: 30 }, officerPos: { x: 78, y: 22 } },
  { id: 'rear',           label: 'Rear / Liftgate', dwellMs: [6000, 9000], defectCategories: ['lights', 'brakes', 'liftgate', 'cargo'],
    pos: { x: 80, y: 40 }, officerPos: { x: 92, y: 44 } },
  { id: 'under_vehicle',  label: 'Under Vehicle',   dwellMs: [4500, 7000], defectCategories: ['frame', 'brakes', 'exhaust', 'driveshaft'],
    pos: { x: 38, y: 56 }, officerPos: { x: 38, y: 68 } },
  { id: 'cab_exterior',   label: 'Cab Exterior',    dwellMs: [3000, 4500], defectCategories: ['mirrors', 'glass'],
    pos: { x: 18, y: 33 }, officerPos: { x: 8,  y: 40 } },
];

// Phase 4 visual extension to HERO map. The truck tactical image hosted on GitHub
// at images/inspection/13_truck_tactical.jpg.
const TACTICAL_IMAGE = _DOT_GH_BASE + 'images/inspection/13_truck_tactical.jpg';

// ─── DEFECT POOL ────────────────────────────────────────────────────────
// Per master plan §8.2 — weighted by 2025 CVSA Roadcheck statistics:
// brakes 41%, tires 21.4%, lights 12.3%, cargo securement 8.1%, other 17.2%.
// Each defect has a zone (where it's found), category, severity, CFR ref,
// short description (for findings feed), and base probability.
//
// Severity tiers:
//   'clean'  — not actually a defect, positive notation (e.g., "DOT card valid")
//   'minor'  — notation only, no citation (warning letter or verbal)
//   'major'  — citation + CSA points but vehicle still roadworthy
//   'oos'    — Out of Service, vehicle cannot proceed until repaired
const DEFECT_POOL = [
  // BRAKES (41% of violations)
  { id: 'brake_slack_adj',     zone: 'driver_side',    category: 'brakes', severity: 'major', cfr: '49 CFR 393.47', desc: 'Brake slack adjuster out of stroke',           baseProb: 0.14, csaPts: 4 },
  { id: 'brake_drum_crack',    zone: 'driver_side',    category: 'brakes', severity: 'oos',   cfr: '49 CFR 393.47', desc: 'Brake drum visible crack (driver side axle)',  baseProb: 0.06, csaPts: 10 },
  { id: 'brake_hose_chafe',    zone: 'under_vehicle',  category: 'brakes', severity: 'minor', cfr: '49 CFR 393.45', desc: 'Brake hose chafing (intermediate shaft)',      baseProb: 0.12, csaPts: 2 },
  { id: 'brake_air_leak',      zone: 'under_vehicle',  category: 'brakes', severity: 'oos',   cfr: '49 CFR 393.50', desc: 'Air leak detected >3 psi/min (rear chamber)',  baseProb: 0.04, csaPts: 10 },
  { id: 'brake_caliper',       zone: 'passenger_side', category: 'brakes', severity: 'major', cfr: '49 CFR 393.47', desc: 'Brake caliper pad wear below minimum',         baseProb: 0.10, csaPts: 4 },

  // TIRES (21.4% of violations)
  { id: 'tire_tread_steer',    zone: 'front',          category: 'tires',  severity: 'major', cfr: '49 CFR 393.75', desc: 'Steer tire tread 3/32" (below 4/32 minimum)',  baseProb: 0.09, csaPts: 6 },
  { id: 'tire_tread_drive',    zone: 'passenger_side', category: 'tires',  severity: 'major', cfr: '49 CFR 393.75', desc: 'Drive tire tread 1/32" (below 2/32 minimum)',  baseProb: 0.11, csaPts: 6 },
  { id: 'tire_sidewall_cut',   zone: 'driver_side',    category: 'tires',  severity: 'oos',   cfr: '49 CFR 393.75', desc: 'Sidewall cut exposing cord (driver rear)',     baseProb: 0.03, csaPts: 10 },
  { id: 'tire_flat_dual',      zone: 'passenger_side', category: 'tires',  severity: 'oos',   cfr: '49 CFR 393.75', desc: 'Flat tire on dual-wheel assembly',             baseProb: 0.02, csaPts: 10 },
  { id: 'tire_underinflated',  zone: 'driver_side',    category: 'tires',  severity: 'minor', cfr: '49 CFR 393.75', desc: 'Drive tire underinflated 20% below spec',      baseProb: 0.14, csaPts: 2 },

  // LIGHTS (12.3% of violations)
  { id: 'light_headlamp',      zone: 'front',          category: 'lights', severity: 'minor', cfr: '49 CFR 393.9',  desc: 'Right headlamp inoperable',                    baseProb: 0.10, csaPts: 2 },
  { id: 'light_turn_rear',     zone: 'rear',           category: 'lights', severity: 'major', cfr: '49 CFR 393.9',  desc: 'Left rear turn signal inoperable',             baseProb: 0.07, csaPts: 4 },
  { id: 'light_clearance',     zone: 'driver_side',    category: 'lights', severity: 'minor', cfr: '49 CFR 393.11', desc: 'Two clearance lamps inoperable (driver side)', baseProb: 0.09, csaPts: 2 },
  { id: 'light_reflector',     zone: 'rear',           category: 'lights', severity: 'minor', cfr: '49 CFR 393.11', desc: 'Rear reflector damaged',                       baseProb: 0.11, csaPts: 1 },
  { id: 'light_plate',         zone: 'rear',           category: 'lights', severity: 'minor', cfr: '49 CFR 393.11', desc: 'License plate lamp inoperable',                baseProb: 0.08, csaPts: 1 },

  // CARGO / LIFTGATE (8.1%)
  { id: 'cargo_strap_fray',    zone: 'rear',           category: 'cargo',  severity: 'minor', cfr: '49 CFR 393.100',desc: 'Cargo tie-down strap frayed',                  baseProb: 0.10, csaPts: 2 },
  { id: 'cargo_etrack_damage', zone: 'rear',           category: 'cargo',  severity: 'minor', cfr: '49 CFR 393.104',desc: 'E-track anchor point bent',                    baseProb: 0.05, csaPts: 2 },
  { id: 'liftgate_hose_leak',  zone: 'rear',           category: 'liftgate',severity:'major', cfr: '49 CFR 393.60', desc: 'Liftgate hydraulic hose leak',                 baseProb: 0.05, csaPts: 4 },
  { id: 'liftgate_platform',   zone: 'rear',           category: 'liftgate',severity:'minor', cfr: '49 CFR 393.60', desc: 'Liftgate platform surface damage',             baseProb: 0.06, csaPts: 2 },

  // FRAME / DRIVESHAFT / EXHAUST (rare but severe)
  { id: 'frame_crack',         zone: 'under_vehicle',  category: 'frame',  severity: 'oos',   cfr: '49 CFR 393.201',desc: 'Frame member cracked (right rail)',            baseProb: 0.015,csaPts: 10 },
  { id: 'driveshaft_ujoint',   zone: 'under_vehicle',  category: 'driveshaft',severity:'major',cfr:'49 CFR 393.89', desc: 'U-joint retaining cap loose',                  baseProb: 0.04, csaPts: 4 },
  { id: 'exhaust_leak',        zone: 'under_vehicle',  category: 'exhaust',severity: 'minor', cfr: '49 CFR 393.83', desc: 'Exhaust clamp loose at muffler',               baseProb: 0.08, csaPts: 2 },

  // GLASS / MIRRORS / BODY
  { id: 'windshield_crack',    zone: 'front',          category: 'glass',  severity: 'major', cfr: '49 CFR 393.60', desc: 'Windshield crack in sightline (>1 inch)',      baseProb: 0.06, csaPts: 4 },
  { id: 'mirror_damage',       zone: 'cab_exterior',   category: 'mirrors',severity: 'minor', cfr: '49 CFR 393.80', desc: 'Driver side mirror cracked',                   baseProb: 0.04, csaPts: 2 },
  { id: 'body_panel',          zone: 'driver_side',    category: 'body',   severity: 'minor', cfr: '49 CFR 393.203',desc: 'Driver door step damage',                      baseProb: 0.05, csaPts: 1 },

  // FUEL
  { id: 'fuel_cap_missing',    zone: 'passenger_side', category: 'fuel',   severity: 'major', cfr: '49 CFR 393.65', desc: 'Fuel tank cap missing',                        baseProb: 0.03, csaPts: 4 },
  { id: 'fuel_leak_line',      zone: 'passenger_side', category: 'fuel',   severity: 'oos',   cfr: '49 CFR 393.65', desc: 'Fuel line drip leak',                          baseProb: 0.02, csaPts: 10 },

  // ─── Phase 4.0M B-7 Part B additions ─────────────────────────────────────
  // These entries are not seeded by zone-walkaround (their zones don't appear
  // in zoneSequence). They're surfaced exclusively via the DVIR chain when
  // RoadReady's pre-trip emits the corresponding hotspot in preTripDefectsMissed.
  // Real CVSA inspection items per FMCSR 49 CFR 393.95 / 391.41 / 396.11.
  //
  // PAPERWORK / DOCUMENTS (zone: 'documents' — DVIR chain only)
  { id: 'docs_dvir_unsigned',  zone: 'documents',      category: 'paperwork', severity: 'major', cfr: '49 CFR 396.11', desc: 'Previous DVIR unsigned by driver',           baseProb: 0,    csaPts: 4 },
  { id: 'docs_medical_card',   zone: 'documents',      category: 'paperwork', severity: 'oos',   cfr: '49 CFR 391.41', desc: 'Medical examiner certificate expired',       baseProb: 0,    csaPts: 10 },
  // SAFETY EQUIPMENT (zone: 'safety_equipment' — DVIR chain only)
  { id: 'safety_extinguisher', zone: 'safety_equipment', category: 'safety', severity: 'oos',   cfr: '49 CFR 393.95', desc: 'Fire extinguisher pressure below operating range', baseProb: 0, csaPts: 10 },
  // SUSPENSION (zone: 'under_vehicle' — DVIR chain only; very rare in walkaround anyway)
  { id: 'suspension_leaf_broken', zone: 'under_vehicle', category: 'suspension', severity: 'oos', cfr: '49 CFR 393.207',desc: 'Leaf spring broken (rear axle)',           baseProb: 0,    csaPts: 10 },
];

// ─── Phase 4.0M B-7 Part A — RoadReady → DOTInspection ID translation map ─
// Pairs RoadReady's visual-hotspot defect IDs with DOTInspection's regulatory
// finding codes. RoadReady's DEFECT_POOL.id namespace is "what tile did the
// player tap on the SVG truck?" — DOTInspection's namespace is "what code
// would an officer cite?". Both naming conventions are correct for their
// concern; this map is the bridge.
//
// Coverage: 17 of 25 RR defects map to DOT entries (13 direct + 4 mapped to
// new B-7 Part B entries). The remaining 8 (engine_block, radiator,
// belt_area, grille_latch, gauge_cluster, ground_fluid_l/r, rollup_door)
// either don't translate to DOT findings (engine internals aren't roadside
// citable) or map to an approximate DOT entry (ground_fluid → fuel_leak_line).
// Unmapped RR IDs simply don't surface in the DVIR chain — the missed defect
// counted toward CSA at RoadReady completion, but the officer doesn't cite
// it because there's no accurate regulatory analog.
const RR_TO_DOT_DEFECT_MAP = {
  // Direct semantic matches
  'headlight_r':                'light_headlamp',
  'windshield':                 'windshield_crack',
  'steer_tire_l':               'tire_tread_steer',
  'steer_tire_r':               'tire_sidewall_cut',
  'drive_tire_l':               'tire_sidewall_cut',
  'region_1776107447761':       'brake_drum_crack',          // brake drum cracked steer L
  'region_1776108466827':       'brake_caliper',             // brake drum drive R heat
  'rear_light_l':               'light_turn_rear',
  'driveshaft':                 'driveshaft_ujoint',
  'region_1776063149339':       'liftgate_hose_leak',        // liftgate motor leak
  'hydraulic_arms':             'liftgate_hose_leak',        // hydraulic cylinder weeping
  'straps_left':                'cargo_strap_fray',
  'floor':                      'cargo_etrack_damage',
  // Approximate maps (best regulatory analog)
  'ground_fluid_l':             'fuel_leak_line',
  'ground_fluid_r':             'fuel_leak_line',
  'rollup_door':                'body_panel',
  // Maps to Phase 4.0M B-7 Part B additions
  'prev_dvir':                  'docs_dvir_unsigned',
  'med_card':                   'docs_medical_card',
  'fire_ext':                   'safety_extinguisher',
  'region_1776109026005':       'suspension_leaf_broken',    // leaf spring
  // Dynamic PSI tire IDs from RoadReady runtime (low-pressure variants)
  'psi_steer_l_low':            'tire_underinflated',
  'psi_steer_r_low':            'tire_underinflated',
  'psi_drive_l_low':            'tire_underinflated',
  'psi_drive_r_low':            'tire_underinflated',
  'psi_drive_l_inner_low':      'tire_underinflated',
  'psi_drive_r_inner_low':      'tire_underinflated',
  // Dynamic air-brake IDs from RoadReady runtime
  'gauge_cluster_ab_no_warn':   'brake_air_leak',
  'gauge_cluster_ab_low_gov':   'brake_air_leak',
  'gauge_cluster_ab_slow':      'brake_air_leak',
  // Intentionally unmapped (not roadside citable):
  //   engine_block, radiator, belt_area, grille_latch, gauge_cluster
};

/**
 * Translates a RoadReady defect ID to the corresponding DOT pool ID.
 * If the input ID is already a DOT ID (e.g., legacy callers), returns it
 * unchanged. If no translation exists, returns null so the caller can skip
 * surfacing the finding without crashing.
 *
 * @param {string} rrId — RoadReady defect ID (or already-translated DOT ID)
 * @returns {string|null} — DOT defect ID or null if untranslatable
 */
function rrIdToDotId(rrId) {
  if (typeof rrId !== 'string' || !rrId) return null;
  if (RR_TO_DOT_DEFECT_MAP[rrId]) return RR_TO_DOT_DEFECT_MAP[rrId];
  // Already a DOT ID? Pass through.
  if (DEFECT_POOL.some(d => d.id === rrId)) return rrId;
  return null;
}

// Clean notations — positive findings that can appear on well-maintained trucks.
const CLEAN_NOTATIONS = [
  { id: 'clean_tread',      zone: 'driver_side',    severity: 'clean', desc: 'Steer tire tread within spec' },
  { id: 'clean_lights',     zone: 'front',          severity: 'clean', desc: 'All headlamps functional' },
  { id: 'clean_drive_tires',zone: 'passenger_side', severity: 'clean', desc: 'Drive tires within spec, lug nuts secure' },
  { id: 'clean_rear_lights',zone: 'rear',           severity: 'clean', desc: 'Rear lighting array all operational' },
  { id: 'clean_liftgate',   zone: 'rear',           severity: 'clean', desc: 'Liftgate hydraulic integrity verified' },
  { id: 'clean_frame',      zone: 'under_vehicle',  severity: 'clean', desc: 'Frame and driveshaft nominal' },
  { id: 'clean_mirrors',    zone: 'cab_exterior',   severity: 'clean', desc: 'Mirrors secure and properly adjusted' },
];

// ─── OFFICER DIALOGUE BANK ──────────────────────────────────────────────
// Per master plan §4.2 — dialogue varies by inspection level and by
// professionalism tier (how the officer is reading the driver's demeanor).
// Phase 3 uses these in place of Phase 2's DEMO_OFFICER_DIALOG.
const DIALOG = {
  // Greetings — vary by professionalism tier
  greeting: {
    high: [
      "Afternoon. Routine check today. Hands on the wheel, we'll make this quick.",
      "Good to see you. Level {L} inspection. I'll come to your window.",
      "Afternoon, driver. Everything looks in order up front. Stay with me.",
    ],
    neutral: [
      "Level {L} inspection today. Hands on the wheel, I'll come to you.",
      "Pulling you in for a Level {L}. Stay in the cab, I'll be back to the window.",
      "Routine Level {L} check. Keep your hands where I can see them please.",
    ],
    low: [
      "Level {L} inspection. Stay in the cab. Don't move until I tell you.",
      "I'm pulling you in for a Level {L}. Hands on the wheel, driver.",
      "Level {L} check. Let's see how your paperwork looks.",
    ],
  },
  // Document request phrasing
  request_doc: {
    high: [
      "Your {DOC}, when you're ready.",
      "{DOC}, please.",
      "I'll need your {DOC}.",
    ],
    neutral: [
      "{DOC}, please.",
      "Let me see your {DOC}.",
      "I need your {DOC}.",
    ],
    low: [
      "{DOC}. Now.",
      "Give me your {DOC}.",
      "{DOC}, driver.",
    ],
  },
  // Acknowledgment when correct doc is handed over
  ack_doc_correct: {
    high: ["Thank you.", "Appreciate it.", "Good."],
    neutral: ["Thanks.", "OK.", "Got it."],
    low: ["Fine.", "Next.", ""],
  },
  // Wrong doc handed over
  wrong_doc: {
    1: ["Not quite — I asked for your {DOC}.",
        "That's not what I need. {DOC}, please.",
        "Different document. I need your {DOC}."],
    2: ["Your {DOC}, driver. Pay attention.",
        "Again — {DOC}. Not that one.",
        "Let's try this again. {DOC}."],
    3: ["Driver, I've asked three times. {DOC}.",
        "This is the last time. {DOC}.",
        "Focus up. {DOC}."],
  },
  // Phase 4.0M B-7 Part D — flagged doc handed over.
  // Player produced the document the officer requested, but it's non-compliant
  // because RoadReady's pre-trip flagged it (unsigned DVIR or expired medcard).
  // Tier-aware. The officer is professional regardless of pro tier — these
  // are real regulatory findings, not personality moments.
  flagged_doc: {
    prev_dvir: {
      high: ["This DVIR isn't signed, driver. 49 CFR 396.11.",
             "I see the form, but no signature. That's a problem.",
             "Pre-trip's documented but never signed. We'll note that."],
      neutral: ["Your DVIR isn't signed. That's a violation.",
                "DVIR's here but unsigned. Going in the report.",
                "No driver signature on this DVIR. 396.11."],
      low: ["Unsigned DVIR. Citation.",
            "DVIR isn't signed. Going in the report.",
            "No signature, no compliance. Cited."],
    },
    med_card: {
      high: ["This medical card is expired, driver. We'll need to address that.",
             "Your medcard's past its date. Out-of-service item.",
             "Med cert's expired. That's an OOS finding."],
      neutral: ["Medical card is expired. That's an OOS item.",
                "Med cert is past expiration. Citation.",
                "Expired medical card. 391.41."],
      low: ["Expired medcard. OOS.",
            "Med cert's expired. You're done driving today.",
            "Expired med cert. Truck stays here."],
    },
  },
  // Safety demo requests
  request_demo: {
    headlights:    "Cycle your headlights for me — low beam.",
    high_beam:     "Now high beam.",
    flashers:      "Four-way flashers on.",
    horn:          "Sound your electric horn.",
    air_horn:      "Now sound your air horn.",
    brakes:        "Press your brake pedal and hold. I'm watching the lamps.",
    low_air:       "Pump the brake pedal. I want to hear your low-air warning.",
    signals:       "Left turn signal. Now right.",
    left_signal:   "Left turn signal.",
    right_signal:  "Right turn signal.",
  },
  // Cab control acknowledgments
  ack_demo_correct: ["Good.", "Thank you.", "Next.", "OK."],
  // ELD transfer
  eld_prompt: [
    "Transfer your ELD logs to FMCSA. I'll read you the routing code.",
    "I need your logs. Web service transfer — here's the code.",
    "ELD data transfer, please. Use the roadside portal.",
  ],
  eld_code: "Routing code: {CODE}. Initiate when ready.",
  eld_complete: ["Got it. Logs received.", "Transfer confirmed.", "I have your logs."],
  // Walkaround transition
  walkaround_start: [
    "Now I'll walk around the truck. Stay in the cab, hands on the wheel.",
    "I'm going to inspect the vehicle. Don't get out unless I ask.",
    "Standing by for walkaround. Keep your hands visible.",
  ],
  // Findings review
  findings_review_intro: {
    clean:    ["Nothing to flag. Paperwork's in order.", "Your equipment checks out. Good inspection.", "No violations. You're good to go."],
    warning:  ["I've got a couple things I want to point out.", "Few items to note. Nothing serious.", "Couple of findings for you."],
    citation: ["I've found some violations. We're going to write this up.", "This is going to be a citation.", "Some of this needs addressing before your next run."],
    oos:      ["I'm placing this vehicle out of service.", "You're not leaving with this truck. Out of service.", "This vehicle goes out of service right now."],
  },
  // Timer impatience
  impatient: [
    "Let's move this along, driver.",
    "Come on. Pick up the pace.",
    "I don't have all day.",
  ],
  impatient_second: [
    "Driver appears unprepared. Noting that.",
    "This is taking too long.",
    "Are we going to be here all day?",
  ],
};

// ─── MARCUS RADIO COACH BANK ────────────────────────────────────────────
// Per master plan §14. Marcus is the player's dispatcher and radio coach.
// Lines fire at specific moments: inspection start, professionalism shifts,
// walkaround tension, etc. Phase 3 adds ~25 lines; Phase 7 adds voice audio.
const MARCUS_RADIO = {
  // Fires once at CINEMATIC end / APPROACH start
  approach: {
    high: [
      "Clean cab, organized folder. You've done the work — now keep your cool.",
      "Your pre-trip was solid. This is where that investment pays off. Stay professional.",
    ],
    neutral: [
      "DOT pulled us in. Remember: stay in the cab, hands visible, answer what's asked.",
      "Inspection time. You know the drill. Keep it simple, keep it honest.",
    ],
    low: [
      "Cab's a mess. That officer is going to look twice at everything. Try to stay calm.",
      "We didn't leave the yard looking great. Damage control mode — don't volunteer anything.",
    ],
  },
  // Fires mid-documents if wrong doc handed over twice
  wrong_doc_nudge: [
    "Slow down. Read the badge. Don't panic-tap.",
    "Breathe. He asked for ONE document. Give him that one.",
    "You're rushing. That's how this goes sideways.",
  ],
  // Phase 4.0M B-7 Part D — fires when player taps a doc the officer asked for
  // BUT it was flagged in RoadReady's DVIR chain. Connects the missed pre-trip
  // moment back to the live consequence so the player understands why this hit.
  flagged_doc_nudge: [
    "That's what you missed at the yard. He sees it now — keep your cool.",
    "Pre-trip caught up with us. Don't argue, just take it.",
    "You let that one slide this morning. He noticed. Stay professional.",
  ],
  // Fires at WALKAROUND start
  walkaround: {
    clean_pretrip: [
      "Hands visible. Don't volunteer anything. Every pre-trip you ran clean earns its keep right here.",
      "You did the work at the yard. Let the truck speak for itself now.",
    ],
    missed_pretrip: [
      "Hands visible. Don't volunteer anything. He's going to find what you missed — don't help him.",
      "This is where missed defects show up. Ride it out. Don't offer explanations.",
    ],
    run_hope_warning: [
      "Brother, you ran with a known defect. If he finds it, we've got bigger problems than a citation.",
      "Hands on the wheel. That defect you saw? If he sees it too, we're in knowing-violation territory.",
    ],
  },
  // Fires at FINDINGS_REVIEW if findings contain OOS
  oos_warning: [
    "That's an Out of Service finding. Don't argue. Just take the paperwork.",
    "OOS tag. Don't argue. We'll sort it out — right now, just be professional.",
  ],
  // Fires at FINDINGS_REVIEW if clean
  clean_praise: [
    "Clean pass. That's what separating the pros looks like. Nice work.",
    "Zero findings. That's 15 minutes well spent on the pre-trip.",
  ],
  // Generic professionalism nudges — reserved for Phase 5 polish wiring.
  // Intended trigger: when proScore drops by ≥10 in a short window (e.g. the
  // player hit multiple wrong-doc penalties in a row). Currently unused;
  // the bank is wired through marcusSay() but no handler calls it yet.
  pro_drop: [
    "Your tone just cost you some points with him. Reset.",
    "Easy. Don't lose him.",
  ],
};

// ─── PHASE 7: MARCUS TTS AUDIO MAP ──────────────────────────────────────
// Maps (category, tier, index) → MP3 filename in public/audio/marcus/.
// Generated via openai.fm with Ash voice (see Marcus_TTS_Generation_Guide.md).
// If a file is missing at runtime, marcusSay falls back to text-only display —
// the game remains fully playable without audio.
//
// Structure mirrors MARCUS_RADIO exactly:
//   - Arrays: indexed by position in the line array
//   - Objects keyed by tier: nested by tier → array index
//
// Files live at {_DOT_GH_BASE}audio/marcus/*.mp3.
const MARCUS_AUDIO_BASE = _DOT_GH_BASE + 'audio/marcus/';
const MARCUS_AUDIO_MAP = {
  approach: {
    high:    ['approach_high_1.mp3',    'approach_high_2.mp3'],
    neutral: ['approach_neutral_1.mp3', 'approach_neutral_2.mp3'],
    low:     ['approach_low_1.mp3',     'approach_low_2.mp3'],
  },
  wrong_doc_nudge: [
    'wrong_doc_nudge_1.mp3',
    'wrong_doc_nudge_2.mp3',
    'wrong_doc_nudge_3.mp3',
  ],
  walkaround: {
    clean_pretrip:    ['walkaround_clean_1.mp3',    'walkaround_clean_2.mp3'],
    missed_pretrip:   ['walkaround_missed_1.mp3',   'walkaround_missed_2.mp3'],
    run_hope_warning: ['walkaround_runhope_1.mp3',  'walkaround_runhope_2.mp3'],
  },
  oos_warning: [
    'oos_warning_1.mp3',
    'oos_warning_2.mp3',
  ],
  clean_praise: [
    'clean_praise_1.mp3',
    'clean_praise_2.mp3',
  ],
  pro_drop: [
    'pro_drop_1.mp3',
    'pro_drop_2.mp3',
  ],
};

// ─── PROFESSIONALISM RUNTIME MODIFIERS (PHASE 3 WIRING) ─────────────────
// These constants already exist in Phase 1's PRO_SCORE object. Phase 3
// defines which ones fire at which events. The mapping here keeps the
// firing logic centralized for auditability.
const PRO_EVENTS = {
  DOC_FAST:         { threshold: 3000, mod: PRO_SCORE.DOC_FAST, label: 'Fast doc' },
  DOC_OK:           { threshold: 7000, mod: PRO_SCORE.DOC_OK,   label: 'Doc on time' },
  DOC_SLOW:         { threshold: Infinity, mod: PRO_SCORE.DOC_SLOW, label: 'Slow doc' },
  WRONG_DOC_1:      { mod: -5,  label: 'Wrong doc (1st)' },
  WRONG_DOC_2:      { mod: -8,  label: 'Wrong doc (2nd)' },
  WRONG_DOC_3:      { mod: -12, label: 'Wrong doc (3rd+)' },
  // Phase 4.0M B-7 Part D — flagged doc produced (DVIR unsigned / medcard expired).
  // Distinct from wrong-doc (which is a tap mismatch). Player produced what was
  // asked for, but the document itself is non-compliant. Magnitude between
  // WRONG_DOC_2 and WRONG_DOC_3 — significant but not catastrophic.
  DOC_FLAGGED:      { mod: -10, label: 'Flagged doc produced' },
  ELD_FIRST_TRY:    { mod: PRO_SCORE.ELD_FIRST_TRY, label: 'ELD first try' },
  CAB_CTRL_CORRECT: { mod: PRO_SCORE.CAB_CTRL_CORRECT, label: 'Correct demo' },
  CAB_CTRL_WRONG:   { mod: PRO_SCORE.CAB_CTRL_WRONG,   label: 'Wrong demo' },
  TIMER_EXPIRED_1:  { mod: -5,  label: 'Timer expired (1st)' },
  TIMER_EXPIRED_2:  { mod: -8,  label: 'Timer expired (2nd)' },
};

// ─── PHASE 5: FINE COMPUTATION TABLE ────────────────────────────────────
// Per FMCSA 2025-2026 civil penalty schedule (49 CFR Part 386 Appendix B,
// updated Dec 2024 and May 2025). These are federal maximums — actual fines
// are at the inspector's/court's discretion. State surcharges may apply.
//
// Sources cross-referenced:
//   - FMCSA Final Rule Dec 30, 2024 (Civil Penalty 2025 Adjustments)
//   - 49 CFR Part 386 Appendix B (May 30, 2025 update)
//   - Industry-observed average citation amounts (2025-2026 reports)
//
// Methodology: per-finding fine is the realistic assessed amount (not the
// maximum), because real officers typically assess at the lower end unless
// there's a pattern of neglect or an accident history.
const FINE_TABLE = {
  // Per-finding fines — assessed against each individual finding
  minor:  250,   // notation-level violations (bulb out, reflector damage, etc.)
  major:  550,   // citations requiring correction + CSA impact
  oos:   1200,   // Out of Service threshold violations (tire sidewall, brake drum)

  // Categorical penalties (stacked on top of per-finding fines)
  KNOWINGLY_OPERATED_OOS: 19277, // Master plan §9 — operating OOS vehicle
  FALSIFIED_DVIR:         12700, // Master plan §9 — knowing falsification
  MISSING_DVIR:            1270, // 49 CFR 396.11 failure to complete
  DISPATCHING_UNREPAIRED: 15420, // Carrier permits unrepaired dispatch
  HOS_VIOLATION:           4812, // Driver HOS non-recordkeeping (max per violation)
  HOS_FALSIFICATION:      15846, // Knowing falsification of HOS records

  // Repair cost estimates (for OOS outcomes — rough market ranges)
  REPAIR_MINOR: 450,      // bulb + reflector + minor items
  REPAIR_MAJOR: 1800,     // brake pad, tire replacement
  REPAIR_OOS:   3500,     // full brake job, frame weld, major tire issue
  REPAIR_KNOWINGLY: 5500, // compounded OOS repair on already-known defect
};

/**
 * Compute the total fine assessed for this inspection outcome.
 * Also returns a line-itemized breakdown suitable for display on citation
 * and OOS screens.
 *
 * @param {Array} findings - the findings array from the inspection
 * @param {string} outcome - 'clean' | 'citation' | 'oos' | 'knowingly' | 'incomplete'
 * @param {Object} opts - additional context:
 *   hasHosViolation: boolean
 *   isKnowinglyPath: boolean (overlap with outcome but explicit)
 * @returns {{ total: number, items: Array<{label, amount, cfr}> }}
 */
function computeFineTotal(findings, outcome, opts = {}) {
  const items = [];
  if (outcome === 'clean' || outcome === 'incomplete') {
    return { total: 0, items };
  }
  // Per-finding fines
  for (const f of findings || []) {
    if (f.severity === 'oos') {
      items.push({
        label: f.desc || 'Out of Service defect',
        amount: FINE_TABLE.oos,
        cfr: f.cfr || '—',
        severity: 'oos',
      });
    } else if (f.severity === 'major') {
      items.push({
        label: f.desc || 'Major violation',
        amount: FINE_TABLE.major,
        cfr: f.cfr || '—',
        severity: 'major',
      });
    } else if (f.severity === 'minor') {
      items.push({
        label: f.desc || 'Minor violation',
        amount: FINE_TABLE.minor,
        cfr: f.cfr || '—',
        severity: 'minor',
      });
    }
    // Clean findings contribute $0 — no item emitted
  }
  // HOS violation surcharge (if surfaced as a finding or flagged via opts)
  const hasHosFinding = (findings || []).some(f => f.category === 'hos');
  if (hasHosFinding || opts.hasHosViolation) {
    items.push({
      label: 'Hours-of-Service violation',
      amount: FINE_TABLE.HOS_VIOLATION,
      cfr: '49 CFR 395',
      severity: 'major',
    });
  }
  // Knowingly operated OOS vehicle — the big one
  if (outcome === 'knowingly') {
    items.push({
      label: 'Operating an OOS vehicle (knowing violation)',
      amount: FINE_TABLE.KNOWINGLY_OPERATED_OOS,
      cfr: '49 CFR 396.9(c)(2)',
      severity: 'knowingly',
    });
  }
  const total = items.reduce((sum, it) => sum + it.amount, 0);
  return { total, items };
}

/**
 * Compute a rough repair cost estimate for OOS outcomes. Used on the OOS
 * screen to show the player what fixing the truck will cost.
 */
function computeRepairEstimate(findings, outcome) {
  if (outcome === 'clean' || outcome === 'incomplete') return 0;
  let total = 0;
  for (const f of findings || []) {
    if (f.severity === 'oos') total += FINE_TABLE.REPAIR_OOS;
    else if (f.severity === 'major') total += FINE_TABLE.REPAIR_MAJOR;
    else if (f.severity === 'minor') total += FINE_TABLE.REPAIR_MINOR;
  }
  if (outcome === 'knowingly') total += FINE_TABLE.REPAIR_KNOWINGLY;
  return total;
}

/**
 * Compute the CVSA decal expiration date. Per master plan §9: clean passes
 * award a 90-day decal extension.
 * @param {number} currentDay - game day counter (1-indexed)
 * @returns {number} the day (1-indexed) the decal expires
 */
function computeDecalExpiration(currentDay) {
  return (currentDay ?? 1) + 90;
}


// ─── SCENARIO GENERATOR ─────────────────────────────────────────────────
// Per master plan §3 — seeded procedural scenario that operates inside a
// scripted shell. Given inspection context (level, truck state, DVIR chain),
// produces a complete scenario plan:
//   - Document request sequence (N docs drawn from canonical order)
//   - Cab control demo sequence
//   - Zone visit order for walkaround
//   - Defect seed list (what CAN be found; realization happens per-zone)
//   - Greeting, timing, dialog variant seeds
//
// Document counts per level:
//   Level III (Driver/Admin):  3-4 docs  (license, medcard, registration, eld_card most common)
//   Level II  (Walkaround):    4-5 docs  (adds insurance, DVIR)
//   Level I   (Full 37-step):  6-8 docs  (all including annual, DOT authority)
const DOC_COUNT_BY_LEVEL = {
  [LEVEL.III]: [3, 4],
  [LEVEL.II]:  [4, 5],
  [LEVEL.I]:   [6, 8],
};

const CONTROL_COUNT_BY_LEVEL = {
  [LEVEL.III]: [0, 0],   // Driver/Admin — usually no safety demos
  [LEVEL.II]:  [3, 4],   // Walkaround — standard set
  [LEVEL.I]:   [5, 7],   // Full — most or all controls
};

function buildScenario({ seed, level, csaScore, cabCleanliness, truckHealthScore,
                         preTripDefectsFound, preTripDefectsMissed, runCancelChoice,
                         hosCompliance, activeCvsaDecal,
                         brakeType, hasAirHorn }) {
  const rng = makeRng(seed);

  // Phase 4.0M B-7 Part D — DVIR chain flag computation.
  // When RoadReady's pre-trip missed prev_dvir or med_card, those IDs flow in
  // via preTripDefectsMissed. We use these flags both to (a) ensure the DVIR
  // doc is requested during DOCUMENTS phase, and (b) trigger the rejection
  // branch in handleDocTap so the player lives through the moment of the
  // officer noticing — not just seeing it appear in findings_review.
  const dvirFlagged = (preTripDefectsMissed || []).includes('prev_dvir');
  const medCardFlagged = (preTripDefectsMissed || []).includes('med_card');

  // --- Document request sequence ---
  const [minD, maxD] = DOC_COUNT_BY_LEVEL[level] || DOC_COUNT_BY_LEVEL[LEVEL.II];
  const docCount = minD + rng.int(Math.max(1, maxD - minD + 1));
  // Always include license + medcard; sample others from canonical list.
  const mandatoryDocIds = ['license', 'medcard'];
  const optionalDocIds = DOT_COMPLIANCE_DOCS
    .filter(d => !mandatoryDocIds.includes(d.id))
    .map(d => d.id);
  // Shuffle optional docs (Fisher-Yates with seeded RNG)
  const shuffled = [...optionalDocIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const docSequence = [
    ...mandatoryDocIds,
    ...shuffled.slice(0, Math.max(0, docCount - mandatoryDocIds.length)),
  ];
  // Always include BOL during Level II/I for shipping paperwork verification
  if (level !== LEVEL.III && rng.chance(0.8)) {
    docSequence.push('bol');
  }
  // If HOS violations present, always request ELD card
  if (hosCompliance?.violations?.length > 0 && !docSequence.includes('eld_card')) {
    docSequence.push('eld_card');
  }
  // Phase 4.0M B-7 Part D — if DVIR chain flagged prev_dvir as missed, ensure
  // the DVIR doc is requested so the rejection moment lands during DOCUMENTS.
  // (medcard is already in mandatoryDocIds, so med_card flag drives only the
  // rejection branch in handleDocTap, not a sequence change.)
  if (dvirFlagged && !docSequence.includes('dvir')) {
    docSequence.push('dvir');
  }

  // --- Cab control demo sequence ---
  // Filter the control pool based on truck equipment:
  //   - 'low_air' only applicable to air-brake trucks
  //   - 'air_horn' only applicable to trucks with an air horn
  // This honors the truckData contract per the project spec: the scenario
  // asks only for demonstrations relevant to the actual truck configuration.
  const [minC, maxC] = CONTROL_COUNT_BY_LEVEL[level] || [3, 4];
  const controlCount = minC + rng.int(Math.max(1, maxC - minC + 1));
  const allControlIds = [
    ...CAB_CONTROLS_PRIMARY
      .filter(c => c.id !== 'low_air' || brakeType === 'air')
      .map(c => c.id),
    ...CAB_CONTROLS_SECONDARY
      .filter(c => c.id !== 'air_horn' || hasAirHorn === true)
      .map(c => c.id),
  ];
  const shuffledCtrls = [...allControlIds];
  for (let i = shuffledCtrls.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [shuffledCtrls[i], shuffledCtrls[j]] = [shuffledCtrls[j], shuffledCtrls[i]];
  }
  const controlSequence = shuffledCtrls.slice(0, controlCount);

  // --- Walkaround zone order ---
  // Always follows CVSA canonical path for realism (driver side → front → ...)
  // Phase 3 uses fixed order; Phase 4 adds officer sprite movement along path.
  const zoneSequence = Level_I_zones_for(level, rng);

  // --- Defect seed list ---
  // Truck health score drives base probability multiplier. A truck at
  // THS=50 is twice as likely to have defects as one at THS=85.
  // CSA score has a smaller effect (inspector "priors" mostly don't matter
  // to what's actually found, but a lower-scoring truck gets slightly more).
  const thsMultiplier = Math.max(0.4, Math.min(2.2, (100 - (truckHealthScore ?? 75)) / 35 + 0.5));
  const csaMultiplier = 1 + (csaScore / 200); // +0 to +0.5 across the range
  const defectSeeds = [];
  // Per-zone defect filter: only consider defects in this inspection's zones
  const zoneIds = new Set(zoneSequence.map(z => z.id));
  for (const def of DEFECT_POOL) {
    if (!zoneIds.has(def.zone)) continue;
    const p = Math.min(0.85, def.baseProb * thsMultiplier * csaMultiplier);
    if (rng.chance(p)) defectSeeds.push(def);
  }
  // Pre-trip missed defects always surface in walkaround
  // (that's the whole point — you missed it, he finds it).
  // Phase 4.0M B-7: RoadReady's defect IDs are visual hotspot identifiers.
  // Translate via RR_TO_DOT_DEFECT_MAP to get the corresponding regulatory
  // finding code before looking up the pool entry.
  for (const missedId of (preTripDefectsMissed || [])) {
    const dotId = rrIdToDotId(missedId);
    if (!dotId) continue;
    const hit = DEFECT_POOL.find(d => d.id === dotId);
    if (hit && !defectSeeds.find(d => d.id === dotId)) defectSeeds.push(hit);
  }
  // Pre-trip FOUND but run_hope'd defects also surface (knowingly path)
  const knowinglyHits = [];
  if (runCancelChoice === 'run_hope') {
    for (const foundId of (preTripDefectsFound || [])) {
      // Phase 4.0M B-7: same translation step for the knowingly path.
      const dotId = rrIdToDotId(foundId);
      if (!dotId) continue;
      const hit = DEFECT_POOL.find(d => d.id === dotId && d.severity === 'oos');
      if (hit) {
        knowinglyHits.push(hit);
        if (!defectSeeds.find(d => d.id === hit.id)) defectSeeds.push(hit);
      }
    }
  }

  // --- Dialog tier based on starting professionalism ---
  // Pre-computed here so the greeting is stable for the duration of the inspection.
  const startingProScore = computeInitialProScore(cabCleanliness, activeCvsaDecal);
  const tier = startingProScore >= PRO_TIER.HIGH_THRESHOLD ? 'high'
             : startingProScore <  PRO_TIER.LOW_THRESHOLD  ? 'low'
             : 'neutral';

  return {
    seed,
    level,
    tier,
    docSequence,
    controlSequence,
    zoneSequence,
    defectSeeds,
    knowinglyHits,
    // Phase 4.0M B-7 Part D — DVIR chain flags forwarded so handleDocTap
    // can route flagged-doc taps through the rejection branch instead of
    // the standard success branch.
    flaggedDocs: {
      dvir: dvirFlagged,
      medcard: medCardFlagged,
    },
    // Rollup stats for quick access
    totalDocs: docSequence.length,
    totalControls: controlSequence.length,
    totalZones: zoneSequence.length,
    hasPotentialOOS: defectSeeds.some(d => d.severity === 'oos'),
    hasKnowingly: knowinglyHits.length > 0,
    hasHosViolation: (hosCompliance?.violations?.length || 0) > 0,
  };
}

// Zone order helper — Level III skips full walkaround, Level II/I do full loop.
function Level_I_zones_for(level, rng) {
  if (level === LEVEL.III) return []; // no walkaround
  if (level === LEVEL.II) {
    // Level II = walk-around; typically ~4 zones
    return [TRUCK_ZONES[0], TRUCK_ZONES[1], TRUCK_ZONES[2], TRUCK_ZONES[3]];
  }
  // Level I = full inspection, all 6 zones
  return [...TRUCK_ZONES];
}

// Helper used by scenario generator to pre-compute tier without instantiating component.
function computeInitialProScore(cabCleanliness, activeCvsaDecal) {
  const tier = cabTierFor(cabCleanliness);
  let s = PRO_SCORE.INITIAL + tier.proMod;
  if (tier.key === 'pristine' || tier.key === 'clean') s += PRO_SCORE.DOCS_ORGANIZED;
  if (tier.key === 'messy' || tier.key === 'disaster') s += PRO_SCORE.DOCS_DISORGANIZED;
  if (activeCvsaDecal) s += PRO_SCORE.VALID_CVSA_DECAL;
  s += PRO_SCORE.STAYED_IN_CAB + PRO_SCORE.HANDS_VISIBLE;
  return Math.max(PRO_SCORE.MIN, Math.min(PRO_SCORE.MAX, s));
}

// ─── DIALOG LOOKUP HELPERS ──────────────────────────────────────────────
// Given a dialog category and tier, returns a random line using the scenario
// RNG (so calling twice in a row doesn't re-roll the same line).
function pickDialog(category, tier, rng, replacements = {}) {
  const bank = DIALOG[category];
  if (!bank) return '';
  const lines = Array.isArray(bank) ? bank : (bank[tier] || bank.neutral || []);
  if (!lines || lines.length === 0) return '';
  const line = lines[rng.int(lines.length)] || '';
  // Template replacements: {L}, {DOC}, {CODE}, etc.
  return line.replace(/\{(\w+)\}/g, (m, key) => replacements[key] ?? m);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function DOTInspection({
  // Required callbacks
  onComplete,
  onClose,

  // Context
  mode = 'delivery',        // 'delivery' | 'practice'
  level = 1,
  currentDay = 1,
  cash = 0,
  csaScore = 0,

  // Truck
  truckId = 'T-1',
  truckData = null,
  truckStatus = null,        // the individual truck object (with cabCleanliness, cvsaDecalExpires, truckHealthScore etc.)

  // Cross-game state
  hosCompliance = { isCompliant: true, violations: [] },
  preTripDefectsFound = [],
  preTripDefectsMissed = [],
  runCancelChoice = null,    // 'park' | 'cancel_repair' | 'run_pm' | 'run_hope' | null
  activeCvsaDecal = false,

  // Utilities from parent
  addNotification = () => {},
  formatCurrency = (n) => `$${n}`,

  // Settings (pass-through from App.jsx)
  sfxEnabled = true,
  sfxVolume = 0.5,

  // Phase 1 diagnostics — off in production, on in test harness
  debugMode = false,

  // Phase 5 test harness — when set, bypass gameplay and jump directly to
  // OUTCOME with pre-seeded findings. Production callers never set this.
  // Shape: { outcome: 'clean'|'citation'|'oos'|'knowingly', findings: [...] }
  testHarnessForceOutcome = null,
}) {
  // ─── Derived initial values ─────────────────────────────────────────────
  const initialLevel  = useMemo(() => initialInspectionLevel(csaScore), [csaScore]);
  const cabTier       = useMemo(() => cabTierFor(truckStatus?.cabCleanliness), [truckStatus?.cabCleanliness]);
  const totalTimerMs  = useMemo(() => OFFICER_TIMER_MS[initialLevel], [initialLevel]);

  // Pre-inspection calculated starting professionalism (master plan §6.1)
  const initialProScore = useMemo(() => {
    let s = PRO_SCORE.INITIAL;
    s += cabTier.proMod;
    // DOT Compliance folder presence: inferred from cab tier (clean/pristine shows it)
    if (cabTier.key === 'pristine' || cabTier.key === 'clean') s += PRO_SCORE.DOCS_ORGANIZED;
    if (cabTier.key === 'messy' || cabTier.key === 'disaster') s += PRO_SCORE.DOCS_DISORGANIZED;
    // CVSA decal on truck = positive signal
    if (activeCvsaDecal) s += PRO_SCORE.VALID_CVSA_DECAL;
    // Driver assumed to have stayed in cab + hands visible by default
    s += PRO_SCORE.STAYED_IN_CAB + PRO_SCORE.HANDS_VISIBLE;
    return Math.max(PRO_SCORE.MIN, Math.min(PRO_SCORE.MAX, s));
  }, [cabTier, activeCvsaDecal]);

  // ─── CORE STATE ─────────────────────────────────────────────────────────
  const [phase, setPhase]                 = useState(STATES.CINEMATIC);
  const [phaseStartTime, setPhaseStartTime] = useState(() => Date.now());
  const [proScore, setProScore]           = useState(initialProScore);
  // setInspectionLevel is reserved for Phase 3+ scenario-driven level escalation
  // (Level III → II → I based on professionalism tier per master plan §3).
  // Currently unused — ignore lint warning.
  // eslint-disable-next-line no-unused-vars
  const [inspectionLevel, setInspectionLevel] = useState(initialLevel);
  const [timerRemainingMs, setTimerRemainingMs] = useState(totalTimerMs);
  const [findings, setFindings]           = useState([]);
  const [documentsHandedOver, setDocumentsHandedOver] = useState(() => new Set());
  const [abandonedByPlayer, setAbandonedByPlayer] = useState(false);
  const [inspectionStartMs] = useState(() => Date.now());

  // ─── PHASE 3 RUNTIME STATE ──────────────────────────────────────────────
  // The scenario object built once from seed + context. Drives the entire
  // inspection: document sequence, control sequence, zone order, defect pool.
  // Memoized so it never changes mid-inspection.
  const scenario = useMemo(() => buildScenario({
    seed: inspectionStartMs,
    level: initialLevel,
    csaScore,
    cabCleanliness: truckStatus?.cabCleanliness,
    truckHealthScore: truckStatus?.truckHealthScore ?? 75,
    preTripDefectsFound,
    preTripDefectsMissed,
    runCancelChoice,
    hosCompliance,
    activeCvsaDecal,
    // Truck configuration from truckData — drives conditional control filtering.
    // Air-brake trucks get 'low_air'; hydraulic do not. Trucks with air horn
    // get 'air_horn' in secondary controls.
    brakeType: truckData?.brakeType,
    hasAirHorn: truckData?.hasAirHorn,
  }), [
    inspectionStartMs, initialLevel, csaScore,
    truckStatus?.cabCleanliness, truckStatus?.truckHealthScore,
    preTripDefectsFound, preTripDefectsMissed, runCancelChoice,
    hosCompliance, activeCvsaDecal,
    truckData?.brakeType, truckData?.hasAirHorn,
  ]);

  // Scenario RNG — seeded identically to scenario.seed so dialog picks are
  // stable per inspection but vary between inspections.
  const dialogRngRef = useRef(null);
  if (!dialogRngRef.current) {
    dialogRngRef.current = makeRng(inspectionStartMs ^ 0x5a5a5a);
  }

  // Which doc/control is the officer asking for RIGHT NOW.
  const [requestTarget, setRequestTarget] = useState(null);

  // Index into scenario.docSequence tracking how many docs have been completed.
  const [docRequestIndex, setDocRequestIndex] = useState(0);

  // Index into scenario.controlSequence for safety demos progression.
  const [controlRequestIndex, setControlRequestIndex] = useState(0);

  // Per-request timestamp — used to compute fast/ok/slow professionalism mods.
  const [requestStartedAt, setRequestStartedAt] = useState(0);

  // Wrong-doc attempt counter (per currently-requested document).
  // Resets when the correct doc is handed over or request changes.
  const [wrongDocAttempts, setWrongDocAttempts] = useState(0);

  // Which cab controls has the player already demonstrated this inspection.
  const [activatedControls, setActivatedControls] = useState(() => new Set());

  // Whether the "Secondary" cab controls row is currently expanded.
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);

  // ELD transfer state machine: 'idle' → 'transferring' → 'complete'
  const [eldState, setEldState] = useState('idle');

  // Has the ELD transfer been attempted? (For "first try" professionalism bonus.)
  const [eldAttempts, setEldAttempts] = useState(0);

  // Walkaround zone progression: which zone is the officer currently "at"
  const [walkZoneIndex, setWalkZoneIndex] = useState(0);

  // Current officer dialog line — dynamic, driven by scenario engine.
  const [officerDialog, setOfficerDialog] = useState('');

  // Current Marcus radio coach line — fires at key moments.
  const [marcusLine, setMarcusLine] = useState('');

  // Times the impatience timer has reached zero in this inspection.
  const [timerExpiredCount, setTimerExpiredCount] = useState(0);

  // Phase 5: outcome payload captured once at OUTCOME phase entry.
  // Reading from state (not re-computing every render) keeps the outcome
  // display stable even if findings somehow change after review.
  const [outcomePayload, setOutcomePayload] = useState(null);

  // Stable per-inspection routing code. Deterministic from inspection start.
  const routingCode = useMemo(
    () => generateRoutingCode(inspectionStartMs),
    [inspectionStartMs]
  );

  // ─── REFS ───────────────────────────────────────────────────────────────
  // Audio context — useRef so cleanup always closes it.
  const audioCtxRef = useRef(null);

  // Phase transition timer — tracked for proper cleanup.
  const phaseTimerRef = useRef(null);

  // Officer impatience tick interval — tracked for proper cleanup.
  const impatienceTickRef = useRef(null);

  // ELD transfer simulation timeout — tracked for cleanup.
  const eldTransferTimerRef = useRef(null);

  // Walkaround zone dwell timer — tracked for cleanup.
  const walkTimerRef = useRef(null);

  // Handler-chain timer (brief ack-then-advance delays inside interaction
  // handlers). Single ref; only one handler delay active at a time.
  const handlerTimerRef = useRef(null);

  // Latest findings snapshot — ref so the phase-entry effect can read without
  // re-running every time a finding is added. Synced on every render.
  const findingsRef = useRef([]);
  findingsRef.current = findings;

  // Cleanup-on-unmount flag
  const unmountedRef = useRef(false);

  // Track whether onComplete has fired (prevents double-fire on rapid cleanup)
  const completedRef = useRef(false);

  // Phase 6: tab visibility pause. When the tab backgrounds, we pause the
  // impatience tick so the officer doesn't "get impatient" while the player
  // is dealing with a phone notification or switched apps.
  const tabHiddenRef = useRef(false);

  // Phase 6: rolling window of recent negative proScore deltas. Each entry
  // is { ts, delta } where ts is Date.now() and delta is the negative mod.
  // Used to trigger MARCUS_RADIO.pro_drop when cumulative drops exceed a
  // threshold in a short window.
  const proHistoryRef = useRef([]);

  // Phase 7: currently-playing Marcus audio element. Held in ref so we can
  // pause/release on new line or on unmount. Prevents overlapping Marcus
  // lines — a new line stops any line currently playing.
  const marcusAudioRef = useRef(null);

  // Keep latest values reachable from cleanup without causing re-renders.
  // Useful when onClose needs the latest professionalism state.
  const latestStateRef = useRef({});
  latestStateRef.current = {
    phase, proScore, inspectionLevel, findings, documentsHandedOver,
    abandonedByPlayer, inspectionStartMs,
  };

  // ─── COMPLETION HANDLERS ────────────────────────────────────────────────
  // Build the onComplete payload per master plan §10.4 and the project
  // brief's integration contract. Payload shape:
  //   outcome, cashEarned, csaImpact, defectsFound, defectsMissed,
  //   fineTotal, fineItems, repairEstimate, cvsaDecalExpiresDay,
  //   findings, professionalismScore, finalInspectionLevel,
  //   cvsaDecalAwarded, timeToComplete
  const buildOutcomePayload = useCallback(() => {
    const s = latestStateRef.current;
    let outcome;
    if (s.abandonedByPlayer) {
      outcome = 'incomplete';
    } else {
      const hasOos = s.findings.some(f => f.severity === 'oos');
      const hasMajor = s.findings.some(f => f.severity === 'major');
      // Knowingly check — OOS defect that was in pre-trip found list AND player chose run_hope.
      // Phase 4.0M B-7: preTripDefectsFound contains RR IDs; translate to DOT IDs
      // before comparing against s.findings (which contain DOT-pool entries).
      const knowinglyFinding = (runCancelChoice === 'run_hope')
        && (preTripDefectsFound || []).some(rrId => {
          const dotId = rrIdToDotId(rrId);
          return dotId && s.findings.some(f => f.id === dotId && f.severity === 'oos');
        });
      if (knowinglyFinding) outcome = 'knowingly';
      else if (hasOos) outcome = 'oos';
      else if (hasMajor) outcome = 'citation';
      else outcome = 'clean';
    }
    // CSA impact — sum of csaPts across findings (negative because CSA scores
    // going UP is bad for the carrier; csaImpact negative = score worsens).
    const csaImpact = -1 * s.findings.reduce((sum, f) => sum + (f.csaPts || 0), 0);

    // defectsFound — ids of all defects the officer caught during inspection.
    // defectsMissed — pre-trip defects NOT surfaced (player successfully
    // addressed them before dispatch).
    // Phase 4.0M B-7: defectsMissed preserves the original RR IDs so App.jsx's
    // accounting stays consistent with what was passed in. Translation only
    // happens for the comparison against s.findings (which use DOT IDs).
    const defectsFound = s.findings
      .filter(f => f.severity === 'major' || f.severity === 'oos')
      .map(f => f.id);
    const defectsMissed = (preTripDefectsMissed || [])
      .filter(rrId => {
        const dotId = rrIdToDotId(rrId);
        // Untranslatable RR IDs always count as "missed" (officer can't cite
        // an engine-internal seep, but the player still drove with it).
        if (!dotId) return true;
        return !s.findings.some(f => f.id === dotId);
      });

    // Phase 5: fine + repair computation via shared helpers.
    const hasHosViolation = (hosCompliance?.violations?.length || 0) > 0;
    const { total: fineTotal, items: fineItems } =
      computeFineTotal(s.findings, outcome, { hasHosViolation });
    const repairEstimate = computeRepairEstimate(s.findings, outcome);

    // Cash earned — fines are net-negative to the player's account. App.jsx
    // computes the full delivery payout delta; this component reports the
    // pure inspection-side impact (negative = fines assessed).
    const cashEarned = -1 * fineTotal;

    // CVSA decal expiration day: only awarded on clean pass. null otherwise.
    const cvsaDecalExpiresDay = outcome === 'clean'
      ? computeDecalExpiration(currentDay)
      : null;

    return {
      outcome,
      cashEarned,
      csaImpact,
      defectsFound,
      defectsMissed,
      fineTotal,
      fineItems,
      repairEstimate,
      cvsaDecalExpiresDay,
      findings: s.findings.slice(),
      professionalismScore: s.proScore,
      finalInspectionLevel: s.inspectionLevel,
      cvsaDecalAwarded: outcome === 'clean',
      timeToComplete: Math.round((Date.now() - s.inspectionStartMs) / 1000),
    };
  }, [runCancelChoice, preTripDefectsFound, preTripDefectsMissed, hosCompliance, currentDay]);


  // ─── AUDIO LIFECYCLE ────────────────────────────────────────────────────
  // Create the AudioContext lazily on first use, close it on unmount.
  // Non-negotiable: no ghost AudioContexts.
  const ensureAudioCtx = useCallback(() => {
    if (!sfxEnabled) return null;
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtxRef.current = new AC();
      return audioCtxRef.current;
    } catch (e) {
      if (debugMode) console.warn('[DOTInspection] AudioContext creation failed:', e);
      return null;
    }
  }, [sfxEnabled, debugMode]);

  const playTone = useCallback((cfg) => {
    if (!sfxEnabled || !cfg) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = cfg.type || 'sine';
      osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
      const v = (cfg.vol ?? 0.1) * sfxVolume;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + cfg.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + cfg.dur + 0.02);
    } catch (e) {
      if (debugMode) console.warn('[DOTInspection] playTone failed:', e);
    }
  }, [sfxEnabled, sfxVolume, ensureAudioCtx, debugMode]);

  // ─── PHASE ADVANCEMENT ──────────────────────────────────────────────────
  // Central phase transition function. All state changes go through here.
  const advanceToPhase = useCallback((nextPhase) => {
    if (unmountedRef.current) return;
    if (!nextPhase) return;
    if (debugMode) console.log('[DOTInspection] advance:', phase, '→', nextPhase);
    playTone(AUDIO.PHASE_TRANSITION);
    setPhase(nextPhase);
    setPhaseStartTime(Date.now());
  }, [phase, playTone, debugMode]);

  // ─── FSM AUTO-ADVANCE (ceremonial phases only) ──────────────────────────
  // Phases with event-driven handlers (DOCUMENTS, ELD_TRANSFER, SAFETY_DEMOS,
  // WALKAROUND) manage their own progression — the respective handlers call
  // advanceToPhase when their sequence completes. Auto-advance ONLY covers:
  //   - CINEMATIC → APPROACH      (after cinematic video)
  //   - APPROACH → FIRST_IMPRESSION (officer walks up)
  //   - FIRST_IMPRESSION → DOCUMENTS (officer arrives at window)
  //   - FINDINGS_REVIEW → OUTCOME   (officer delivers verdict)
  //   - OUTCOME → COMPLETE          (outcome screen dwell)
  //
  // This prevents the race condition where auto-advance fires mid-interaction
  // during DOCUMENTS/ELD/SAFETY_DEMOS/WALKAROUND and skips player content.
  // Handler-driven phases still have a 5-minute watchdog timer as a safety
  // net so the FSM never permanently hangs. See AUTO_ADVANCE_PHASES constant.
  useEffect(() => {
    if (phase === STATES.COMPLETE) return;
    const autoAdvance = AUTO_ADVANCE_PHASES[phase] === true;
    const dur = autoAdvance
      ? (STATE_MIN_DURATION_MS[phase] ?? 5000)
      : WATCHDOG_DURATION_MS;
    phaseTimerRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      const next = STATE_NEXT[phase];
      if (next) {
        if (!autoAdvance && debugMode) {
          console.warn(`[DOTInspection] Watchdog firing for ${phase} — handler-driven progression did not complete in ${WATCHDOG_DURATION_MS}ms`);
        }
        advanceToPhase(next);
      }
    }, dur);
    return () => {
      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
        phaseTimerRef.current = null;
      }
    };
  }, [phase, advanceToPhase, debugMode]);

  // ─── OFFICER IMPATIENCE TIMER ───────────────────────────────────────────
  // Counts down while the inspection is active. Does not count down during
  // cinematic (player hasn't "met" the officer yet) or complete states.
  // Phase 6: the tick also skips when the tab is backgrounded, preventing
  // the officer from "getting impatient" while the player is away.
  useEffect(() => {
    const timerActive =
      phase !== STATES.CINEMATIC &&
      phase !== STATES.COMPLETE;
    if (!timerActive) return;
    impatienceTickRef.current = setInterval(() => {
      if (unmountedRef.current) return;
      if (tabHiddenRef.current) return; // pause while tab is hidden
      setTimerRemainingMs(prev => Math.max(0, prev - TIMER_TICK_MS));
    }, TIMER_TICK_MS);
    return () => {
      if (impatienceTickRef.current) {
        clearInterval(impatienceTickRef.current);
        impatienceTickRef.current = null;
      }
    };
  }, [phase]);

  // ─── PHASE 3: PROFESSIONALISM SCORE MUTATOR ─────────────────────────────
  // Central helper that applies a professionalism delta with clamping and
  // debug logging. Wraps the setter so every modification goes through one
  // auditable choke point.
  //
  // Phase 6: also tracks negative deltas in a rolling 10-second window. When
  // cumulative drops reach -10 points, fire Marcus' pro_drop bank (with a
  // 20-second cooldown to prevent repeated firing after sustained bad streaks).
  const applyProMod = useCallback((delta, label) => {
    if (!delta || unmountedRef.current) return;
    setProScore(prev => {
      const next = Math.max(PRO_SCORE.MIN, Math.min(PRO_SCORE.MAX, prev + delta));
      if (debugMode) console.log(`[DOTInspection] pro: ${prev} → ${next} (${delta >= 0 ? '+' : ''}${delta} ${label})`);
      return next;
    });
    // Phase 6: rolling-window pro_drop trigger
    if (delta < 0) {
      const now = Date.now();
      const history = proHistoryRef.current;
      // Add current drop
      history.push({ ts: now, delta });
      // Prune entries older than 10 seconds
      const WINDOW_MS = 10000;
      while (history.length > 0 && now - history[0].ts > WINDOW_MS) {
        history.shift();
      }
      // Cumulative drop in window
      const cumulativeDrop = history.reduce((sum, e) => sum + e.delta, 0);
      // Cooldown check (20s)
      const COOLDOWN_MS = 20000;
      if (cumulativeDrop <= -10 && (now - proDropCooldownRef.current) > COOLDOWN_MS) {
        proDropCooldownRef.current = now;
        if (marcusSayRef.current) {
          marcusSayRef.current('pro_drop');
        }
        if (debugMode) console.log(`[DOTInspection] Marcus pro_drop fired (cumulative ${cumulativeDrop} in window)`);
      }
    }
  }, [debugMode]);

  // ─── PHASE 3: FINDINGS FEED MUTATOR ─────────────────────────────────────
  // Adds a finding to the live feed. Findings accumulate throughout the
  // inspection; Phase 5 reads the final list to compute outcome.
  const addFinding = useCallback((finding) => {
    if (unmountedRef.current || !finding) return;
    setFindings(prev => {
      // De-dupe by id so repeated walkthroughs don't stack the same finding
      if (prev.some(f => f.id === finding.id)) return prev;
      const enriched = {
        ...finding,
        timestamp: Date.now() - inspectionStartMs,
      };
      if (debugMode) console.log('[DOTInspection] finding added:', enriched.id, enriched.severity);
      return [...prev, enriched];
    });
    // Play tone matched to severity
    if (finding.severity === 'oos') playTone(AUDIO.FINDING_OOS);
    else if (finding.severity === 'major') playTone(AUDIO.FINDING_WARN);
    else if (finding.severity === 'minor') playTone(AUDIO.FINDING_WARN);
    else if (finding.severity === 'clean') playTone(AUDIO.FINDING_CLEAN);
  }, [inspectionStartMs, playTone, debugMode]);

  // ─── PHASE 3: OFFICER DIALOG SETTER HELPER ──────────────────────────────
  const speak = useCallback((category, replacements = {}) => {
    const line = pickDialog(category, scenario.tier, dialogRngRef.current, replacements);
    if (line) setOfficerDialog(line);
  }, [scenario.tier]);

  // ─── PHASE 3: MARCUS LINE SETTER HELPER ─────────────────────────────────
  // Phase 7: also plays the corresponding TTS audio file if present in
  // public/audio/marcus/. Falls back silently to text-only if the file is
  // missing or audio is disabled. Any currently-playing Marcus line is
  // stopped when a new one fires (prevents overlap).
  const marcusSay = useCallback((category, tier) => {
    const bank = MARCUS_RADIO[category];
    if (!bank) return;
    const lines = Array.isArray(bank) ? bank : (bank[tier || scenario.tier] || bank.neutral || []);
    if (!lines || lines.length === 0) return;
    const index = dialogRngRef.current.int(lines.length);
    const line = lines[index];
    setMarcusLine(line || '');

    // Phase 7: try to play the matching audio file
    if (!sfxEnabled) return;
    const audioBank = MARCUS_AUDIO_MAP[category];
    if (!audioBank) return;
    const audioEntry = Array.isArray(audioBank)
      ? audioBank[index]
      : ((audioBank[tier || scenario.tier] || [])[index]);
    if (!audioEntry) return;

    // Stop any currently-playing Marcus line
    if (marcusAudioRef.current) {
      try {
        marcusAudioRef.current.pause();
        marcusAudioRef.current.src = '';
      } catch (_) { /* no-op */ }
      marcusAudioRef.current = null;
    }

    try {
      const el = new Audio(MARCUS_AUDIO_BASE + audioEntry);
      el.volume = Math.max(0, Math.min(1, (sfxVolume ?? 0.5) * 0.9));
      el.addEventListener('ended', () => {
        if (marcusAudioRef.current === el) marcusAudioRef.current = null;
      });
      el.addEventListener('error', () => {
        // File missing or failed to load — silent fallback. Text still shown.
        if (marcusAudioRef.current === el) marcusAudioRef.current = null;
        if (debugMode) console.warn('[DOTInspection] Marcus audio missing:', audioEntry);
      });
      marcusAudioRef.current = el;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay policy rejection or similar — silent fallback.
          if (marcusAudioRef.current === el) marcusAudioRef.current = null;
        });
      }
    } catch (e) {
      if (debugMode) console.warn('[DOTInspection] Marcus audio error:', e);
    }
  }, [scenario.tier, sfxEnabled, sfxVolume, debugMode]);

  // Phase 6: sync marcusSay into a ref so applyProMod (defined earlier in
  // render order) can call the latest marcusSay without a circular dep.
  const marcusSayRef = useRef(null);
  marcusSayRef.current = marcusSay;

  // Phase 6: cooldown timestamp to prevent pro_drop Marcus line from
  // firing too often. Once triggered, suppress for 20 seconds.
  const proDropCooldownRef = useRef(0);

  // ─── PHASE 3: PHASE ENTRY EFFECTS ───────────────────────────────────────
  // When phase transitions, update scenario-driven targets, speak appropriate
  // dialog, fire Marcus coaching at key moments.
  useEffect(() => {
    switch (phase) {
      case STATES.APPROACH: {
        // Phase 6: officer approach audio cue — low sustained sine that
        // builds atmospheric presence as the officer walks up.
        playTone(AUDIO.OFFICER_APPROACH);
        speak('greeting', { L: scenario.level });
        marcusSay('approach');
        setRequestTarget(null);
        break;
      }
      case STATES.FIRST_IMPRESSION: {
        // No new dialog — the greeting carries over. Nothing to target.
        setRequestTarget(null);
        break;
      }
      case STATES.DOCUMENTS: {
        // Start with the first doc in the sequence
        const firstDocId = scenario.docSequence[0];
        const doc = DOT_COMPLIANCE_DOCS.find(d => d.id === firstDocId)
                  || LOAD_DOCS.find(d => d.id === firstDocId);
        if (doc) {
          setRequestTarget({ kind: 'doc', id: firstDocId });
          setDocRequestIndex(0);
          setRequestStartedAt(Date.now());
          setWrongDocAttempts(0);
          speak('request_doc', { DOC: doc.label });
        }
        break;
      }
      case STATES.ELD_TRANSFER: {
        setRequestTarget(null);
        const promptLine = pickDialog('eld_prompt', scenario.tier, dialogRngRef.current);
        const codeLine = DIALOG.eld_code.replace('{CODE}', routingCode);
        setOfficerDialog(`${promptLine} ${codeLine}`);
        break;
      }
      case STATES.SAFETY_DEMOS: {
        if (scenario.controlSequence.length === 0) {
          // Level III skips safety demos entirely — advance to WALKAROUND
          // (which also skips to FINDINGS_REVIEW if zoneSequence is empty).
          setRequestTarget(null);
          if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
          handlerTimerRef.current = setTimeout(() => {
            handlerTimerRef.current = null;
            if (unmountedRef.current) return;
            advanceToPhase(STATES.WALKAROUND);
          }, 600);
          break;
        }
        const firstCtrlId = scenario.controlSequence[0];
        setRequestTarget({ kind: 'control', id: firstCtrlId });
        setControlRequestIndex(0);
        setRequestStartedAt(Date.now());
        const line = DIALOG.request_demo[firstCtrlId] || 'Demonstrate.';
        setOfficerDialog(line);
        // Auto-expand secondary if first control is secondary
        const isSecondary = CAB_CONTROLS_SECONDARY.some(c => c.id === firstCtrlId);
        if (isSecondary) setSecondaryExpanded(true);
        break;
      }
      case STATES.WALKAROUND: {
        setRequestTarget(null);
        speak('walkaround_start');
        // Marcus coaching varies by DVIR state and runCancelChoice
        if (runCancelChoice === 'run_hope' && preTripDefectsFound?.length > 0) {
          marcusSay('walkaround', 'run_hope_warning');
        } else if (preTripDefectsMissed?.length > 0) {
          marcusSay('walkaround', 'missed_pretrip');
        } else {
          marcusSay('walkaround', 'clean_pretrip');
        }
        // Re-entry safety: clear any stale walk timer before resetting index.
        // Prevents test-harness phase jumps or re-mounts from leaving a ghost
        // walk timer that advances walkZoneIndex on stale state.
        if (walkTimerRef.current) {
          clearTimeout(walkTimerRef.current);
          walkTimerRef.current = null;
        }
        setWalkZoneIndex(0);
        break;
      }
      case STATES.FINDINGS_REVIEW: {
        setRequestTarget(null);
        // Read findings via ref to avoid making this effect depend on `findings`
        // (which would cause it to re-fire every time walkaround adds a finding).
        const latestFindings = findingsRef.current || [];
        const hasOos = latestFindings.some(f => f.severity === 'oos');
        const hasMajor = latestFindings.some(f => f.severity === 'major');
        const hasMinor = latestFindings.some(f => f.severity === 'minor');
        const tierKey = hasOos ? 'oos' : hasMajor ? 'citation' : hasMinor ? 'warning' : 'clean';
        const line = pickDialog('findings_review_intro', tierKey, dialogRngRef.current);
        setOfficerDialog(line);
        if (hasOos) marcusSay('oos_warning');
        else if (tierKey === 'clean') marcusSay('clean_praise');
        break;
      }
      case STATES.OUTCOME: {
        // Phase 5: compute the outcome payload ONCE on phase entry and cache
        // it in state. The OutcomeScreen consumes this. We also fire an
        // outcome-appropriate audio cue.
        setRequestTarget(null);
        const payload = buildOutcomePayload();
        setOutcomePayload(payload);
        // Audio cue matched to outcome severity
        if (payload.outcome === 'clean')       playTone(AUDIO.CLEAN_PASS);
        else if (payload.outcome === 'citation') playTone(AUDIO.FINDING_WARN);
        else if (payload.outcome === 'oos')      playTone(AUDIO.FINDING_OOS);
        else if (payload.outcome === 'knowingly') playTone(AUDIO.KNOWING_STAMP);
        break;
      }
      default: {
        setRequestTarget(null);
      }
    }
    // Note: speak/marcusSay are stable callbacks; scenario is memoized.
    // findings intentionally NOT in deps — read via findingsRef.current instead.
  }, [phase, scenario, runCancelChoice, preTripDefectsFound, preTripDefectsMissed,
      routingCode, speak, marcusSay, buildOutcomePayload, playTone]);

  // ─── PHASE 3: WALKAROUND ENGINE ─────────────────────────────────────────
  // Drives the officer through zones at realistic intervals. Each zone:
  //   1. Officer "arrives" — zone is set as current
  //   2. Zone dwell timer starts (5-9 seconds)
  //   3. Findings for that zone surface during dwell based on defectSeeds
  //   4. Officer moves to next zone
  // When all zones are complete, the FSM auto-advances to FINDINGS_REVIEW.
  useEffect(() => {
    if (phase !== STATES.WALKAROUND) return;
    if (scenario.zoneSequence.length === 0) {
      // No walkaround for Level III — skip straight ahead
      advanceToPhase(STATES.FINDINGS_REVIEW);
      return;
    }
    const zoneIndex = walkZoneIndex;
    if (zoneIndex >= scenario.zoneSequence.length) {
      // All zones visited — advance to review
      advanceToPhase(STATES.FINDINGS_REVIEW);
      return;
    }
    const zone = scenario.zoneSequence[zoneIndex];
    // Fire findings for this zone mid-dwell
    const zoneDefects = scenario.defectSeeds.filter(d => d.zone === zone.id);
    // Emit findings at ~40% of dwell time
    const [minD, maxD] = zone.dwellMs;
    const dwell = minD + dialogRngRef.current.int(Math.max(1, maxD - minD + 1));
    const findingTime = Math.round(dwell * 0.4);
    const findingTimer = setTimeout(() => {
      if (unmountedRef.current) return;
      if (zoneDefects.length === 0) {
        // Emit a clean notation for this zone ~50% of the time
        if (dialogRngRef.current.chance(0.5)) {
          const cleanOpt = CLEAN_NOTATIONS.find(c => c.zone === zone.id);
          if (cleanOpt) addFinding(cleanOpt);
        }
      } else {
        zoneDefects.forEach(d => addFinding(d));
      }
    }, findingTime);
    // Move to next zone after full dwell
    walkTimerRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      clearTimeout(findingTimer);
      setWalkZoneIndex(i => i + 1);
    }, dwell);
    return () => {
      clearTimeout(findingTimer);
      if (walkTimerRef.current) {
        clearTimeout(walkTimerRef.current);
        walkTimerRef.current = null;
      }
    };
  }, [phase, walkZoneIndex, scenario, addFinding, advanceToPhase]);

  // ─── PHASE 3: HOS VIOLATION SURFACING ───────────────────────────────────
  // If HOS violations are present, surface them as findings when the
  // inspection enters ELD_TRANSFER. This is the moment the officer would
  // realistically discover HOS problems (after reviewing transferred logs).
  useEffect(() => {
    if (phase !== STATES.ELD_TRANSFER) return;
    if (eldState !== 'complete') return;
    const violations = hosCompliance?.violations || [];
    if (violations.length === 0) return;
    violations.forEach((v, i) => {
      try {
        const details = getViolationDetails ? getViolationDetails(v) : { label: String(v), severity: 'major' };
        addFinding({
          id: `hos_${v}_${i}`,
          zone: 'driver_records',
          category: 'hos',
          severity: details.severity === 'oos' ? 'oos' : 'major',
          cfr: '49 CFR 395',
          desc: `HOS violation: ${details.label || v}`,
          csaPts: details.severity === 'oos' ? 10 : 5,
        });
      } catch (e) {
        if (debugMode) console.warn('[DOTInspection] HOS surface failed:', e);
      }
    });
  }, [phase, eldState, hosCompliance, addFinding, debugMode]);

  // ─── PHASE 3: ELD TRANSFER AUTO-RESET ───────────────────────────────────
  // When the phase leaves ELD_TRANSFER, reset state + clear timer.
  useEffect(() => {
    if (phase !== STATES.ELD_TRANSFER && eldState !== 'idle') {
      if (eldTransferTimerRef.current) {
        clearTimeout(eldTransferTimerRef.current);
        eldTransferTimerRef.current = null;
      }
      setEldState('idle');
    }
  }, [phase, eldState]);

  // ─── PHASE 3: SECONDARY CONTROLS AUTO-COLLAPSE ──────────────────────────
  useEffect(() => {
    if (phase !== STATES.SAFETY_DEMOS && secondaryExpanded) {
      setSecondaryExpanded(false);
    }
  }, [phase, secondaryExpanded]);

  // ─── PHASE 3: TIMER EXPIRED HANDLING ────────────────────────────────────
  // When the impatience timer hits zero, apply a soft professionalism penalty
  // and officer grows impatient. Never causes hard failure.
  useEffect(() => {
    if (timerRemainingMs === 0 && timerExpiredCount === 0) {
      setTimerExpiredCount(1);
      applyProMod(PRO_EVENTS.TIMER_EXPIRED_1.mod, PRO_EVENTS.TIMER_EXPIRED_1.label);
      setOfficerDialog(pickDialog('impatient', scenario.tier, dialogRngRef.current));
      // Reset timer with a smaller budget for "second chance"
      setTimerRemainingMs(Math.floor(totalTimerMs * 0.4));
    } else if (timerRemainingMs === 0 && timerExpiredCount === 1) {
      setTimerExpiredCount(2);
      applyProMod(PRO_EVENTS.TIMER_EXPIRED_2.mod, PRO_EVENTS.TIMER_EXPIRED_2.label);
      setOfficerDialog(pickDialog('impatient_second', scenario.tier, dialogRngRef.current));
      // Third expiration adds a finding
      addFinding({
        id: 'driver_unprepared',
        zone: 'driver_records',
        category: 'administrative',
        severity: 'minor',
        cfr: 'Notation',
        desc: 'Driver appeared unprepared — extended inspection time',
        csaPts: 1,
      });
      setTimerRemainingMs(Math.floor(totalTimerMs * 0.3));
    }
  }, [timerRemainingMs, timerExpiredCount, totalTimerMs, applyProMod, scenario.tier, addFinding]);

  // ─── PHASE 3: INTERACTION HANDLERS ──────────────────────────────────────
  // Document tap with full scenario-driven progression, wrong-doc tiered
  // penalties, professionalism timing bonus, and automatic advancement
  // to the next requested document.
  const handleDocTap = useCallback((doc, folder) => {
    if (!doc) return;
    const isRequested = requestTarget?.kind === 'doc' && requestTarget.id === doc.id;

    // Phase 4.0M B-7 Part D — flagged-doc rejection branch.
    // Player produced the requested doc, but it was flagged in the DVIR chain
    // (RoadReady's preTripDefectsMissed contained prev_dvir or med_card).
    // The officer "rejects" it — distinct from wrong_doc (tap mismatch).
    // We mark it handed-over so the chain advances; findings_review will also
    // surface the regulatory finding. Player gets the live moment AND the
    // verdict-screen citation — two reinforcing beats from one missed pre-trip.
    const flaggedDocs = scenario?.flaggedDocs || {};
    const isFlaggedRejection = isRequested && (
      (doc.id === 'dvir'    && flaggedDocs.dvir) ||
      (doc.id === 'medcard' && flaggedDocs.medcard)
    );

    if (isFlaggedRejection) {
      playTone(AUDIO.WRONG_DOC);
      applyProMod(PRO_EVENTS.DOC_FLAGGED.mod, PRO_EVENTS.DOC_FLAGGED.label);
      // Mark as handed over so player can't re-tap; chain advances forward.
      setDocumentsHandedOver(prev => {
        const next = new Set(prev);
        next.add(doc.id);
        return next;
      });
      // Reset wrong-doc counter — this isn't a tap mismatch, it's a content issue.
      setWrongDocAttempts(0);
      // Officer dialog — flagged-doc rejection line, tier-aware.
      const flagKey = doc.id === 'dvir' ? 'prev_dvir' : 'med_card';
      const tierBank = DIALOG.flagged_doc?.[flagKey] || {};
      const tier = scenario?.tier || 'neutral';
      const lines = tierBank[tier] || tierBank.neutral || [];
      if (lines.length > 0) {
        const line = lines[dialogRngRef.current.int(lines.length)];
        setOfficerDialog(line);
      }
      // Marcus nudge — connects the live moment back to the missed pre-trip.
      marcusSay('flagged_doc_nudge');
      // Advance to next doc in sequence (same flow as success branch from here,
      // just with longer dwell time so the rejection beat has room to land).
      const nextIndex = docRequestIndex + 1;
      if (nextIndex < scenario.docSequence.length) {
        const nextDocId = scenario.docSequence[nextIndex];
        const nextDoc = DOT_COMPLIANCE_DOCS.find(d => d.id === nextDocId)
                      || LOAD_DOCS.find(d => d.id === nextDocId);
        if (nextDoc) {
          setDocRequestIndex(nextIndex);
          setRequestTarget({ kind: 'doc', id: nextDocId });
          setRequestStartedAt(Date.now());
          if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
          handlerTimerRef.current = setTimeout(() => {
            handlerTimerRef.current = null;
            if (unmountedRef.current) return;
            speak('request_doc', { DOC: nextDoc.label });
          }, 1500); // ~600ms more dwell than success-path's 900ms — let the rejection land
        }
      } else {
        // No more docs — advance to ELD with extra dwell so rejection registers.
        if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
        handlerTimerRef.current = setTimeout(() => {
          handlerTimerRef.current = null;
          if (unmountedRef.current) return;
          advanceToPhase(STATES.ELD_TRANSFER);
        }, 1800);
      }
      return;
    }

    if (isRequested) {
      // Correct doc — compute timing mod and advance
      playTone(AUDIO.DOCUMENT_TAP);
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed <= PRO_EVENTS.DOC_FAST.threshold) {
        applyProMod(PRO_EVENTS.DOC_FAST.mod, PRO_EVENTS.DOC_FAST.label);
      } else if (elapsed <= PRO_EVENTS.DOC_OK.threshold) {
        applyProMod(PRO_EVENTS.DOC_OK.mod, PRO_EVENTS.DOC_OK.label);
      } else {
        applyProMod(PRO_EVENTS.DOC_SLOW.mod, PRO_EVENTS.DOC_SLOW.label);
      }
      setDocumentsHandedOver(prev => {
        const next = new Set(prev);
        next.add(doc.id);
        return next;
      });
      setWrongDocAttempts(0);
      // Speak acknowledgment
      speak('ack_doc_correct');
      // Advance to next doc in sequence
      const nextIndex = docRequestIndex + 1;
      if (nextIndex < scenario.docSequence.length) {
        const nextDocId = scenario.docSequence[nextIndex];
        const nextDoc = DOT_COMPLIANCE_DOCS.find(d => d.id === nextDocId)
                      || LOAD_DOCS.find(d => d.id === nextDocId);
        if (nextDoc) {
          setDocRequestIndex(nextIndex);
          setRequestTarget({ kind: 'doc', id: nextDocId });
          setRequestStartedAt(Date.now());
          // Delay the next request slightly so player sees ack first
          if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
          handlerTimerRef.current = setTimeout(() => {
            handlerTimerRef.current = null;
            if (unmountedRef.current) return;
            speak('request_doc', { DOC: nextDoc.label });
          }, 900);
        }
      } else {
        // All docs done — advance to ELD
        if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
        handlerTimerRef.current = setTimeout(() => {
          handlerTimerRef.current = null;
          if (unmountedRef.current) return;
          advanceToPhase(STATES.ELD_TRANSFER);
        }, 1200);
      }
    } else {
      // Wrong doc — tiered penalty
      playTone(AUDIO.WRONG_DOC);
      const nextAttempts = wrongDocAttempts + 1;
      setWrongDocAttempts(nextAttempts);
      const event = nextAttempts === 1 ? PRO_EVENTS.WRONG_DOC_1
                  : nextAttempts === 2 ? PRO_EVENTS.WRONG_DOC_2
                  : PRO_EVENTS.WRONG_DOC_3;
      applyProMod(event.mod, event.label);
      const requestedDoc = DOT_COMPLIANCE_DOCS.find(d => d.id === requestTarget?.id)
                         || LOAD_DOCS.find(d => d.id === requestTarget?.id);
      const tierKey = Math.min(3, nextAttempts);
      const lines = DIALOG.wrong_doc[tierKey] || [];
      if (lines.length > 0 && requestedDoc) {
        const line = lines[dialogRngRef.current.int(lines.length)]
          .replace('{DOC}', requestedDoc.label);
        setOfficerDialog(line);
      }
      if (nextAttempts >= 2) marcusSay('wrong_doc_nudge');
      if (debugMode) console.log('[DOTInspection] wrong doc tapped:', doc.id, 'attempt:', nextAttempts);
    }
  }, [requestTarget, requestStartedAt, docRequestIndex, scenario, wrongDocAttempts,
      playTone, applyProMod, speak, marcusSay, advanceToPhase, debugMode]);

  const handleControlTap = useCallback((controlId) => {
    if (!controlId) return;
    const isRequested = requestTarget?.kind === 'control' && requestTarget.id === controlId;

    if (isRequested) {
      playTone(AUDIO.DOCUMENT_TAP);
      applyProMod(PRO_EVENTS.CAB_CTRL_CORRECT.mod, PRO_EVENTS.CAB_CTRL_CORRECT.label);
      setActivatedControls(prev => {
        const next = new Set(prev);
        next.add(controlId);
        return next;
      });
      // Advance to next control
      const nextIndex = controlRequestIndex + 1;
      if (nextIndex < scenario.controlSequence.length) {
        const nextCtrlId = scenario.controlSequence[nextIndex];
        setControlRequestIndex(nextIndex);
        setRequestTarget({ kind: 'control', id: nextCtrlId });
        setRequestStartedAt(Date.now());
        const isSecondary = CAB_CONTROLS_SECONDARY.some(c => c.id === nextCtrlId);
        if (isSecondary) setSecondaryExpanded(true);
        if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
        handlerTimerRef.current = setTimeout(() => {
          handlerTimerRef.current = null;
          if (unmountedRef.current) return;
          const line = DIALOG.request_demo[nextCtrlId] || 'Demonstrate.';
          setOfficerDialog(line);
        }, 700);
      } else {
        // All controls done — advance to walkaround
        const ackLines = DIALOG.ack_demo_correct;
        setOfficerDialog(ackLines[dialogRngRef.current.int(ackLines.length)]);
        if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
        handlerTimerRef.current = setTimeout(() => {
          handlerTimerRef.current = null;
          if (unmountedRef.current) return;
          advanceToPhase(STATES.WALKAROUND);
        }, 1000);
      }
    } else {
      // Wrong control
      applyProMod(PRO_EVENTS.CAB_CTRL_WRONG.mod, PRO_EVENTS.CAB_CTRL_WRONG.label);
      if (debugMode) console.log('[DOTInspection] wrong control:', controlId);
    }
  }, [requestTarget, controlRequestIndex, scenario, playTone, applyProMod, advanceToPhase, debugMode]);

  const handleToggleSecondary = useCallback(() => {
    setSecondaryExpanded(prev => !prev);
  }, []);

  const handleInitiateEldTransfer = useCallback((method) => {
    if (eldState !== 'idle') return;
    playTone(AUDIO.DOCUMENT_TAP);
    setEldState('transferring');
    // Capture attempt number BEFORE the async increment so we can correctly
    // detect the first successful transfer. eldAttempts is read from the
    // closure (stale-safe because the handler is re-memoized when it changes).
    const isFirstAttempt = eldAttempts === 0;
    setEldAttempts(prev => prev + 1);
    if (debugMode) console.log('[DOTInspection] ELD transfer initiated via', method, 'first?', isFirstAttempt);
    // Simulate transfer duration
    const transferTimeout = setTimeout(() => {
      eldTransferTimerRef.current = null;
      if (unmountedRef.current) return;
      setEldState('complete');
      playTone(AUDIO.FINDING_CLEAN);
      // First-try bonus — only applies if this was the first attempt.
      if (isFirstAttempt) {
        applyProMod(PRO_EVENTS.ELD_FIRST_TRY.mod, PRO_EVENTS.ELD_FIRST_TRY.label);
      }
      // Officer acknowledges transfer
      setOfficerDialog(pickDialog('eld_complete', scenario.tier, dialogRngRef.current));
      // Advance phase after acknowledgment shown
      if (handlerTimerRef.current) clearTimeout(handlerTimerRef.current);
      handlerTimerRef.current = setTimeout(() => {
        handlerTimerRef.current = null;
        if (unmountedRef.current) return;
        // Level III skips safety demos + walkaround — straight to findings review
        if (scenario.level === LEVEL.III) {
          advanceToPhase(STATES.FINDINGS_REVIEW);
        } else {
          advanceToPhase(STATES.SAFETY_DEMOS);
        }
      }, 1800);
    }, 2600);
    eldTransferTimerRef.current = transferTimeout;
  }, [eldState, eldAttempts, scenario, playTone, applyProMod, advanceToPhase, debugMode]);


  // Fires onComplete exactly once.
  const fireComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      const payload = buildOutcomePayload();
      if (debugMode) console.log('[DOTInspection] onComplete:', payload);
      onComplete?.(payload);
    } catch (e) {
      if (debugMode) console.error('[DOTInspection] onComplete handler threw:', e);
    }
  }, [onComplete, buildOutcomePayload, debugMode]);

  // When phase hits COMPLETE, fire onComplete.
  useEffect(() => {
    if (phase === STATES.COMPLETE && !completedRef.current) {
      fireComplete();
    }
  }, [phase, fireComplete]);

  // Player abandons via close button.
  const handleAbandonment = useCallback(() => {
    if (unmountedRef.current || completedRef.current) return;
    setAbandonedByPlayer(true);
    // Fire a partial payload via onClose, NOT onComplete (they are distinct).
    try {
      onClose?.();
    } catch (e) {
      if (debugMode) console.error('[DOTInspection] onClose handler threw:', e);
    }
  }, [onClose, debugMode]);

  // ─── PHASE 5 TEST HARNESS: FORCE OUTCOME ────────────────────────────────
  // When testHarnessForceOutcome prop is provided, seed findings and jump
  // directly to the OUTCOME phase. This bypasses gameplay entirely and is
  // used only for UI testing the four outcome screens. Production callers
  // never set this prop.
  useEffect(() => {
    if (!testHarnessForceOutcome) return;
    if (unmountedRef.current) return;
    const { findings: seedFindings } = testHarnessForceOutcome;
    if (Array.isArray(seedFindings)) {
      setFindings(seedFindings.map((f, i) => ({
        ...f,
        timestamp: i * 100,
      })));
    }
    // Jump phase. Use setTimeout(0) so setFindings has a chance to commit
    // before the OUTCOME phase-entry effect reads findingsRef.
    const t = setTimeout(() => {
      if (unmountedRef.current) return;
      advanceToPhase(STATES.OUTCOME);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // ─── PHASE 6: TAB VISIBILITY PAUSE ────────────────────────────────────
  // When the user backgrounds the tab (app switch on mobile, tab switch on
  // desktop), mark tabHiddenRef so the impatience tick knows to skip the
  // decrement. This prevents the officer from "getting impatient" while
  // the player is dealing with a phone notification or took a phone call.
  // Other timers (phase auto-advance, walkaround, ELD transfer) are not
  // paused — they use their own short durations and complete naturally
  // once the tab returns. The unmountedRef guards in their callbacks
  // already handle the edge case where the component unmounts while hidden.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (unmountedRef.current) return;
      tabHiddenRef.current = document.hidden === true;
      if (debugMode) console.log('[DOTInspection] tab visibility:', document.hidden ? 'hidden' : 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [debugMode]);

  // ─── UNMOUNT CLEANUP ────────────────────────────────────────────────────
  // Fires last, regardless of why the component unmounts. Ensures every
  // timer, interval, and AudioContext is released.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
      if (impatienceTickRef.current) { clearInterval(impatienceTickRef.current); impatienceTickRef.current = null; }
      if (eldTransferTimerRef.current) { clearTimeout(eldTransferTimerRef.current); eldTransferTimerRef.current = null; }
      if (walkTimerRef.current) { clearTimeout(walkTimerRef.current); walkTimerRef.current = null; }
      if (handlerTimerRef.current) { clearTimeout(handlerTimerRef.current); handlerTimerRef.current = null; }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch (_) { /* no-op */ }
        audioCtxRef.current = null;
      }
      // Phase 7: stop any playing Marcus audio to prevent it from continuing
      // after the component unmounts (e.g., player closes inspection mid-line).
      if (marcusAudioRef.current) {
        try {
          marcusAudioRef.current.pause();
          marcusAudioRef.current.src = '';
        } catch (_) { /* no-op */ }
        marcusAudioRef.current = null;
      }
    };
  }, []);

  // ─── PHASE 2 TEST HARNESS SUPPORT ───────────────────────────────────────
  // When debugMode is true, expose a window.__jumpPhase(stateKey) helper so
  // the test harness can jump between phases without waiting for auto-advance.
  // NEVER executes in production (debugMode defaults to false).
  useEffect(() => {
    if (!debugMode || typeof window === 'undefined') return;
    window.__jumpPhase = (stateKey) => {
      const target = STATES[stateKey?.toUpperCase()] || stateKey;
      if (Object.values(STATES).includes(target)) {
        if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
        setPhase(target);
        setPhaseStartTime(Date.now());
      }
    };
    return () => {
      if (window.__jumpPhase) delete window.__jumpPhase;
    };
  }, [debugMode]);

  // ─── DERIVED RENDER VALUES ──────────────────────────────────────────────
  const timerPct = totalTimerMs > 0 ? (timerRemainingMs / totalTimerMs) : 0;
  const timerWarning = timerPct <= 0.25;
  const timerDisplay = useMemo(() => {
    const s = Math.ceil(timerRemainingMs / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  }, [timerRemainingMs]);

  const proTier = proScore >= PRO_TIER.HIGH_THRESHOLD ? 'high'
                : proScore <  PRO_TIER.LOW_THRESHOLD  ? 'low'
                : 'neutral';
  const officerBadgeColor = proTier === 'high' ? T.green : proTier === 'low' ? T.red : T.amber;

  const phaseLabel = PHASE_LABELS[phase] || '—';

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  // Cab background depends on current phase + cleanliness tier.
  // During walkaround we show the video loop if available; otherwise the
  // clean cab image. During cinematic/approach we show PrePass/approach stills.
  const backgroundImage = (() => {
    if (phase === STATES.CINEMATIC)        return HERO.highway;
    if (phase === STATES.APPROACH)         return HERO.officerApproach;
    if (phase === STATES.FIRST_IMPRESSION) return HERO.officerWindow;
    // Documents / ELD / Safety / Walkaround / Review / Outcome: show cab interior
    return cabTier.image;
  })();

  return (
    <div style={styles.root} data-phase={phase} data-pro-tier={proTier}>
      {/* Inline keyframe / animation CSS */}
      <style>{animationCSS}</style>

      {/* ═══ LAYER 1: Full-bleed background image ═══ */}
      <div
        style={{
          ...styles.backgroundLayer,
          backgroundImage: `url(${backgroundImage})`,
        }}
        aria-hidden="true"
      />
      <div style={styles.backgroundOverlay} aria-hidden="true" />

      {/* ═══ LAYER 2: Cinematic-only content (PrePass stills) ═══ */}
      {phase === STATES.CINEMATIC && (
        <PrePassCinematic phaseStartTime={phaseStartTime} />
      )}

      {/* ═══ LAYER 3: Always-visible UI chrome ═══ */}
      <div style={styles.uiLayer}>

        {/* Top: Officer card with impatience timer */}
        <OfficerCard
          inspectionLevel={inspectionLevel}
          phaseLabel={phaseLabel}
          timerDisplay={timerDisplay}
          timerPct={timerPct}
          timerWarning={timerWarning}
          officerBadgeColor={officerBadgeColor}
          proTier={proTier}
          onClose={handleAbandonment}
          timerHidden={phase === STATES.CINEMATIC || phase === STATES.COMPLETE}
        />

        {/* Officer speech bubble — between officer card and viewport.
            Shows the officer's current dialog for the active phase. */}
        {phase !== STATES.CINEMATIC && phase !== STATES.COMPLETE && officerDialog && (
          <OfficerSpeechBubble text={officerDialog} />
        )}

        {/* Middle: viewport (windshield preview + findings rail) */}
        {phase !== STATES.CINEMATIC && phase !== STATES.COMPLETE && (
          <Viewport
            findings={findings}
            phase={phase}
            zoneSequence={scenario.zoneSequence}
            currentZoneIndex={walkZoneIndex}
            activatedControls={activatedControls}
            requestTarget={requestTarget}
          />
        )}

        {/* Bottom: interaction panel (phase-aware). Phase 2 dispatches to
            DOTComplianceFolder + BOLClipboard, CabControlsPanel,
            ELDDevicePanel, or WalkaroundWatching based on phase. */}
        {phase !== STATES.CINEMATIC && phase !== STATES.COMPLETE && (
          <InteractionPanel
            phase={phase}
            requestTarget={requestTarget}
            handedOverDocs={documentsHandedOver}
            activatedControls={activatedControls}
            secondaryExpanded={secondaryExpanded}
            routingCode={routingCode}
            eldState={eldState}
            marcusLine={marcusLine}
            onDocTap={handleDocTap}
            onControlTap={handleControlTap}
            onToggleSecondary={handleToggleSecondary}
            onInitiateEldTransfer={handleInitiateEldTransfer}
          />
        )}

        {/* Outcome overlay — appears when phase === OUTCOME with payload ready */}
        {phase === STATES.OUTCOME && outcomePayload && (
          <OutcomeScreen
            payload={outcomePayload}
            currentDay={currentDay}
            formatCurrency={formatCurrency}
            onContinue={() => advanceToPhase(STATES.COMPLETE)}
          />
        )}

        {/* Phase 1 debug ribbon — only in dev mode */}
        {debugMode && <DebugRibbon
          phase={phase}
          proScore={proScore}
          inspectionLevel={inspectionLevel}
          cabTier={cabTier}
          runCancelChoice={runCancelChoice}
          timerMs={timerRemainingMs}
        />}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS (all internal, none exported)
// ═════════════════════════════════════════════════════════════════════════
// Note: the Phase 1 CinematicLayer was replaced by PrePassCinematic in Phase 4.
// See the "PHASE 4 VISUAL SUB-COMPONENTS" section further down for the
// cinematic/tactical/windshield implementations.

/** Officer card at the top with badge, level, phase pill, and impatience timer. */
function OfficerCard({
  inspectionLevel,
  phaseLabel,
  timerDisplay,
  timerPct,
  timerWarning,
  officerBadgeColor,
  proTier,
  onClose,
  timerHidden,
}) {
  return (
    <div style={styles.officerCard}>
      <div style={{ ...styles.officerAccent, background: officerBadgeColor }} />
      <div
        style={{
          ...styles.officerBadge,
          boxShadow: proTier === 'high' ? `0 0 12px ${T.greenGlow}`
                   : proTier === 'low'  ? `0 0 12px ${T.redGlow}`
                   : 'none',
        }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} aria-hidden="true">
          <path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14 L7 18 L9 12 L4 8 L10 8 Z" fill="#2a1f04" />
        </svg>
      </div>
      <div style={styles.officerInfo}>
        <div style={styles.officerLabel}>inspector · cvsa level {inspectionLevel.toLowerCase()}</div>
        <div style={styles.officerName}>T. Alvarez · Badge 4821</div>
        {!timerHidden && (
          <div style={styles.timerRow}>
            <div style={styles.timerTrack}>
              <div
                style={{
                  ...styles.timerFill,
                  width: `${Math.max(0, Math.min(100, timerPct * 100))}%`,
                  background: timerWarning
                    ? `linear-gradient(90deg, #FF8C2A, ${T.red})`
                    : `linear-gradient(90deg, ${T.amberSoft}, ${T.amber})`,
                }}
              />
            </div>
            <div
              style={{
                ...styles.timerCount,
                color: timerWarning ? T.red : T.text2,
              }}
            >
              {timerDisplay}
            </div>
          </div>
        )}
      </div>
      <div style={styles.phasePill}>{phaseLabel}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close inspection"
        style={styles.closeBtn}
      >
        ×
      </button>
    </div>
  );
}

/** Viewport: windshield preview area + live findings rail. Phase 1 empty. */
function Viewport({
  findings,
  phase,
  zoneSequence,
  currentZoneIndex,
  activatedControls,
  requestTarget,
}) {
  // Pick the right windshield content based on phase
  const content = (() => {
    // Walkaround with zones → tactical view
    if (phase === STATES.WALKAROUND && zoneSequence && zoneSequence.length > 0) {
      return (
        <WalkaroundTacticalView
          zoneSequence={zoneSequence}
          currentZoneIndex={currentZoneIndex}
          findings={findings}
        />
      );
    }
    // All other interactive phases (including WALKAROUND with empty zones for
    // Level III) fall through to the windshield POV. The walkaround engine
    // auto-advances past this when zoneSequence is empty.
    if (phase === STATES.DOCUMENTS || phase === STATES.ELD_TRANSFER ||
        phase === STATES.SAFETY_DEMOS || phase === STATES.FIRST_IMPRESSION ||
        phase === STATES.APPROACH || phase === STATES.FINDINGS_REVIEW ||
        phase === STATES.WALKAROUND) {
      return (
        <WindshieldPOV
          phase={phase}
          activatedControls={activatedControls}
          requestTarget={requestTarget}
        />
      );
    }
    // Fallback — only reachable during brief transition moments.
    return (
      <div style={styles.windshieldPlaceholder}>
        <div style={styles.windshieldPhase}>{PHASE_LABELS[phase] || ''}</div>
      </div>
    );
  })();

  return (
    <div style={styles.viewport}>
      <div style={styles.windshield}>
        {content}
      </div>
      <div style={styles.findingsRail}>
        <div style={styles.findingsHeader}>
          <span style={styles.findingsHeaderLabel}>LIVE FINDINGS</span>
          <span style={styles.findingsHeaderRec} />
        </div>
        <div style={styles.findingsList}>
          {findings.length === 0 ? (
            <div style={styles.findingsEmpty}>awaiting officer…</div>
          ) : (
            findings.map((f, i) => (
              <FindingPop key={f.id ?? i} finding={f} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Interaction panel — the bottom half of the screen. Phase-aware. */
function InteractionPanel({
  phase,
  requestTarget,        // { kind: 'doc' | 'control', id: string } | null
  handedOverDocs,       // Set of doc ids already handed over
  activatedControls,    // Set of control ids already activated
  secondaryExpanded,    // boolean — whether secondary cab controls are revealed
  routingCode,          // string — the ELD routing code for this inspection
  eldState,             // 'idle' | 'transferring' | 'complete'
  marcusLine,           // string — Marcus radio coach line (Phase 3)
  onDocTap,             // (doc, folder) => void
  onControlTap,         // (controlId) => void
  onToggleSecondary,    // () => void
  onInitiateEldTransfer,// () => void
}) {
  // Dispatch the correct Phase 2 surface based on current phase.
  const body = (() => {
    switch (phase) {
      case STATES.DOCUMENTS:
        return (
          <FolderDispatcher
            requestedDocId={requestTarget?.kind === 'doc' ? requestTarget.id : null}
            handedOverDocs={handedOverDocs}
            onDocTap={onDocTap}
          />
        );
      case STATES.ELD_TRANSFER:
        return (
          <ELDDevicePanel
            routingCode={routingCode}
            eldState={eldState}
            onInitiateTransfer={onInitiateEldTransfer}
          />
        );
      case STATES.SAFETY_DEMOS:
        return (
          <CabControlsPanel
            requestedControlId={requestTarget?.kind === 'control' ? requestTarget.id : null}
            activatedControls={activatedControls}
            secondaryExpanded={secondaryExpanded}
            onControlTap={onControlTap}
            onToggleSecondary={onToggleSecondary}
          />
        );
      case STATES.WALKAROUND:
        return <WalkaroundWatching marcusLine={marcusLine} />;
      case STATES.APPROACH:
      case STATES.FIRST_IMPRESSION:
      case STATES.FINDINGS_REVIEW:
        return <PanelWaitingState phase={phase} />;
      default:
        return (
          <div style={styles.panelSkeletonMsg}>
            Phase 1 skeleton — interaction pending
            <div style={styles.panelSkeletonSub}>{panelDescriptionFor(phase)}</div>
          </div>
        );
    }
  })();

  return (
    <div style={styles.interactPanel}>
      <div style={styles.panelHeader}>
        <span style={styles.panelHeaderLabel}>{panelLabelFor(phase)}</span>
        <span style={styles.panelHeaderTag}>{PHASE_LABELS[phase] || '—'}</span>
      </div>
      <div style={styles.panelBody}>
        {body}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PHASE 2 SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════

/**
 * OfficerSpeechBubble — contextual dialog card shown between the officer
 * card and the viewport. Displays what the officer is currently saying.
 * Phase 2 uses DEMO_OFFICER_DIALOG; Phase 3 replaces with dynamic dialog.
 */
function OfficerSpeechBubble({ text, emphasis }) {
  if (!text) return null;
  return (
    <div
      style={{
        ...styles.speechBubble,
        borderLeftColor: emphasis === 'urgent' ? T.red
                       : emphasis === 'warn'   ? T.amber
                       : T.amberSoft,
      }}
    >
      <div style={styles.speechLabel}>OFFICER</div>
      <div style={styles.speechText}>"{text}"</div>
    </div>
  );
}

/**
 * FolderDispatcher — lays out the DOT Compliance folder (60%) side-by-side
 * with the BOL Clipboard (35%). The requested doc determines which surface
 * pulses amber. Tapping a document fires onDocTap.
 */
function FolderDispatcher({ requestedDocId, handedOverDocs, onDocTap }) {
  const dotRequested = DOT_COMPLIANCE_DOCS.some(d => d.id === requestedDocId);
  const loadRequested = LOAD_DOCS.some(d => d.id === requestedDocId);

  return (
    <div style={styles.folderDispatch}>
      <DOTComplianceFolder
        docs={DOT_COMPLIANCE_DOCS}
        requestedDocId={requestedDocId}
        handedOverDocs={handedOverDocs}
        isActive={dotRequested}
        onDocTap={(doc) => onDocTap?.(doc, 'dot')}
      />
      <BOLClipboard
        docs={LOAD_DOCS}
        requestedDocId={requestedDocId}
        handedOverDocs={handedOverDocs}
        isActive={loadRequested}
        onDocTap={(doc) => onDocTap?.(doc, 'load')}
      />
    </div>
  );
}

/**
 * DOTComplianceFolder — 8 document cards in a fan-out layout.
 * Pulses amber when the officer is requesting a DOT document.
 */
function DOTComplianceFolder({ docs, requestedDocId, handedOverDocs, isActive, onDocTap }) {
  return (
    <div
      style={{
        ...styles.folderContainer,
        ...(isActive ? styles.folderContainerActive : null),
      }}
    >
      <div style={styles.folderHeader}>
        <div style={styles.folderIcon}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M3 6 h7 l2 2 h9 v11 h-18 z" stroke={T.amberSoft} strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <div style={styles.folderLabel}>DOT COMPLIANCE</div>
        <div style={styles.folderCount}>{docs.length}</div>
      </div>
      <div style={styles.docGrid}>
        {docs.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            requested={doc.id === requestedDocId}
            handedOver={handedOverDocs?.has(doc.id)}
            onTap={() => onDocTap?.(doc)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * BOLClipboard — a single BOL card styled as a metal clipboard.
 * Narrower than the DOT folder.
 */
function BOLClipboard({ docs, requestedDocId, handedOverDocs, isActive, onDocTap }) {
  const bol = docs[0]; // we only have BOL for now
  return (
    <div
      style={{
        ...styles.clipboardContainer,
        ...(isActive ? styles.folderContainerActive : null),
      }}
    >
      <div style={styles.clipboardClip} aria-hidden="true">
        <div style={styles.clipboardClipTab} />
      </div>
      <div style={styles.clipboardHeader}>
        <div style={styles.folderLabel}>SHIPMENT</div>
      </div>
      <div style={styles.clipboardCards}>
        <DocumentCard
          doc={bol}
          requested={bol.id === requestedDocId}
          handedOver={handedOverDocs?.has(bol.id)}
          onTap={() => onDocTap?.(bol)}
          variant="clipboard"
        />
      </div>
    </div>
  );
}

/**
 * DocumentCard — individual document card with idle/requested/handed/wrong
 * visual states. Used by both DOTComplianceFolder and BOLClipboard.
 */
function DocumentCard({ doc, requested, handedOver, wrong, onTap, variant }) {
  const [pressed, setPressed] = React.useState(false);
  const pressTimerRef = React.useRef(null);
  React.useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };
  }, []);
  const stateClass = handedOver ? 'handed' : wrong ? 'wrong' : requested ? 'requested' : 'idle';

  const handleTap = () => {
    if (handedOver) return; // already handed over, no-op
    setPressed(true);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      setPressed(false);
    }, 160);
    onTap?.();
  };

  const accentColor = handedOver ? T.green
                     : wrong     ? T.red
                     : requested ? T.amber
                     : T.border2;

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={handedOver}
      aria-label={doc.label}
      style={{
        ...styles.docCard,
        ...(variant === 'clipboard' ? styles.docCardClipboard : null),
        borderColor: accentColor,
        boxShadow: requested && !handedOver
          ? `0 0 14px ${T.amberGlow}, inset 0 0 0 1px ${T.amber}`
          : handedOver
          ? `0 0 8px ${T.greenGlow}`
          : 'none',
        animation: requested && !handedOver ? 'docPulse 1.1s ease-in-out infinite' : 'none',
        transform: pressed ? 'scale(0.96)' : 'scale(1)',
        opacity: handedOver ? 0.5 : 1,
      }}
      data-state={stateClass}
    >
      <div style={styles.docCardIcon}>
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }} aria-hidden="true">
          <path
            d={doc.iconPath}
            stroke={accentColor}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={styles.docCardBody}>
        <div style={styles.docCardLabel}>{doc.label}</div>
        <div style={styles.docCardSublabel}>{doc.sublabel}</div>
      </div>
      {handedOver && (
        <div style={styles.handedStamp} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12">
            <path d="M5 12 l4 4 l10 -10" stroke={T.greenSoft} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

/**
 * CabControlsPanel — 6 primary controls in a 3×2 grid, with a Secondary
 * button that reveals high beam + individual L/R signals.
 */
function CabControlsPanel({
  requestedControlId,
  activatedControls,
  secondaryExpanded,
  onControlTap,
  onToggleSecondary,
}) {
  return (
    <div style={styles.cabControlsPanel}>
      <div style={styles.cabControlsGrid}>
        {CAB_CONTROLS_PRIMARY.map((c) => (
          <CabControlButton
            key={c.id}
            control={c}
            requested={c.id === requestedControlId}
            activated={activatedControls?.has(c.id)}
            onTap={() => onControlTap?.(c.id)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleSecondary}
        aria-label={secondaryExpanded ? 'Hide secondary controls' : 'Show secondary controls'}
        aria-expanded={secondaryExpanded}
        style={styles.secondaryToggle}
      >
        <span>{secondaryExpanded ? '▾ HIDE SECONDARY' : '▸ SECONDARY CONTROLS'}</span>
      </button>
      {secondaryExpanded && (
        <div style={styles.cabControlsSecondary}>
          {CAB_CONTROLS_SECONDARY.map((c) => (
            <CabControlButton
              key={c.id}
              control={c}
              requested={c.id === requestedControlId}
              activated={activatedControls?.has(c.id)}
              onTap={() => onControlTap?.(c.id)}
              variant="secondary"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Individual cab control button — three visual states. */
function CabControlButton({ control, requested, activated, onTap, variant }) {
  const [pressed, setPressed] = React.useState(false);
  const pressTimerRef = React.useRef(null);
  React.useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
    };
  }, []);

  const handleTap = () => {
    setPressed(true);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      setPressed(false);
    }, 120);
    onTap?.();
  };

  const accentColor = activated ? T.green
                     : requested ? T.amber
                     : T.border2;

  return (
    <button
      type="button"
      onClick={handleTap}
      aria-label={control.label}
      aria-pressed={activated ? 'true' : 'false'}
      style={{
        ...styles.cabCtrlBtn,
        ...(variant === 'secondary' ? styles.cabCtrlBtnSecondary : null),
        borderColor: accentColor,
        boxShadow: requested && !activated
          ? `0 0 14px ${T.amberGlow}, inset 0 0 0 1px ${T.amber}`
          : activated
          ? `0 0 10px ${T.greenGlow}, inset 0 0 0 1px ${T.green}`
          : 'none',
        background: activated
          ? 'linear-gradient(180deg, rgba(34,197,94,0.10), rgba(34,197,94,0.04))'
          : requested
          ? 'linear-gradient(180deg, rgba(255,176,32,0.10), rgba(255,176,32,0.03))'
          : 'rgba(255,255,255,0.02)',
        animation: requested && !activated ? 'ctrlPulse 1.1s ease-in-out infinite' : 'none',
        transform: pressed ? 'scale(0.94)' : 'scale(1)',
      }}
    >
      <div style={styles.cabCtrlIconWrap}>
        <svg viewBox="0 0 24 24" style={{ width: 24, height: 24 }} aria-hidden="true">
          <path
            d={control.iconPath}
            stroke={accentColor}
            strokeWidth="1.6"
            fill={control.filled ? accentColor : 'none'}
            fillOpacity={control.filled ? 0.3 : 0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={styles.cabCtrlLabel}>{control.label}</div>
      <div style={styles.cabCtrlSublabel}>{control.sublabel}</div>
      {activated && (
        <div style={styles.cabCtrlCheck} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="10" height="10">
            <path d="M5 12 l4 4 l10 -10" stroke={T.greenSoft} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

/**
 * ELDDevicePanel — dashboard-quality ELD device mockup with green-mono LCD.
 * Shows the routing code, transfer method selector, and Initiate button.
 */
function ELDDevicePanel({ routingCode, eldState, onInitiateTransfer }) {
  const [selectedMethod, setSelectedMethod] = React.useState('web');

  const statusText = eldState === 'transferring' ? 'TRANSFERRING…'
                   : eldState === 'complete'    ? 'TRANSFER COMPLETE'
                   : 'READY TO TRANSFER';

  const statusColor = eldState === 'complete' ? T.green
                    : eldState === 'transferring' ? T.amberSoft
                    : T.greenSoft;

  return (
    <div style={styles.eldPanel}>
      <div style={styles.eldDevice}>
        {/* Device frame */}
        <div style={styles.eldBezel}>
          <div style={styles.eldScreen}>
            <div style={styles.eldScreenScanlines} aria-hidden="true" />
            <div style={styles.eldScreenContent}>
              <div style={styles.eldTopRow}>
                <span style={styles.eldTopLabel}>ROADSIDE TRANSFER</span>
                <span style={styles.eldTopDot} />
              </div>
              <div style={styles.eldCodeLabel}>ROUTING CODE</div>
              <div style={styles.eldCode}>{routingCode || '— — — - — — — —'}</div>
              <div style={styles.eldStatus}>
                <span style={{ ...styles.eldStatusText, color: statusColor }}>
                  {statusText}
                </span>
              </div>
              {eldState === 'transferring' && (
                <div style={styles.eldProgressTrack}>
                  <div style={styles.eldProgressFill} />
                </div>
              )}
            </div>
          </div>
          <div style={styles.eldBezelLabel}>ELD · KEEPTRUCKIN-LIKE</div>
        </div>
      </div>

      {/* Transfer method selector */}
      <div style={styles.eldMethodRow}>
        {['web', 'email'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSelectedMethod(m)}
            style={{
              ...styles.eldMethodBtn,
              ...(selectedMethod === m ? styles.eldMethodBtnSel : null),
            }}
            aria-pressed={selectedMethod === m ? 'true' : 'false'}
          >
            {m === 'web' ? 'FMCSA WEB' : 'EMAIL'}
          </button>
        ))}
      </div>

      {/* Initiate button */}
      <button
        type="button"
        onClick={() => onInitiateTransfer?.(selectedMethod)}
        disabled={eldState !== 'idle'}
        style={{
          ...styles.eldInitiateBtn,
          opacity: eldState !== 'idle' ? 0.5 : 1,
          cursor: eldState !== 'idle' ? 'default' : 'pointer',
        }}
      >
        {eldState === 'complete' ? '✓ TRANSFER COMPLETE'
          : eldState === 'transferring' ? '⟳ TRANSFERRING…'
          : 'INITIATE TRANSFER'}
      </button>
    </div>
  );
}

/**
 * WalkaroundWatching — passive observation screen with tension dots and
 * a Marcus radio coaching line. No player interaction; findings feed
 * updates in the viewport's side rail (existing Phase 1 component).
 */
function WalkaroundWatching({ marcusLine }) {
  const line = marcusLine || MARCUS_LINES.walkaround;
  return (
    <div style={styles.walkWatch}>
      <div style={styles.walkDotsRow} aria-label="Officer walking around truck">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              ...styles.walkDot,
              animationDelay: `${i * 0.22}s`,
            }}
          />
        ))}
      </div>
      <div style={styles.walkMessage}>OBSERVING THE WALKAROUND</div>
      <div style={styles.walkSubmessage}>Hands on the wheel. Stay in the cab.</div>
      <div style={styles.walkMarcusRow}>
        <div style={styles.walkMarcusIcon}>
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
            <path d="M3 12 a9 9 0 1 1 18 0 a9 9 0 1 1 -18 0 Z M12 7 v5 l4 2" stroke={T.amberSoft} strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <div style={styles.walkMarcusText}>
          <span style={styles.walkMarcusLabel}>MARCUS · RADIO:</span> {line}
        </div>
      </div>
    </div>
  );
}

/** Small waiting-state panel for phases without dedicated interaction. */
function PanelWaitingState({ phase }) {
  return (
    <div style={styles.waitingPanel}>
      <div style={styles.waitingDots}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              ...styles.waitingDot,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      <div style={styles.waitingText}>
        {phase === STATES.APPROACH ? 'Officer approaching…'
          : phase === STATES.FIRST_IMPRESSION ? 'Initial scan…'
          : phase === STATES.FINDINGS_REVIEW ? 'Officer reviewing findings…'
          : 'Standing by…'}
      </div>
    </div>
  );
}

// Note: Phase 1's OutcomeSkeleton was replaced by OutcomeScreen in Phase 5.
// See PHASE 5 OUTCOME SCREENS section further down for CleanPass, Citation,
// OutOfService, KnowinglyOperated, and OutcomeScreen dispatcher.

/** Dev-mode diagnostic ribbon — hidden in production. */
function DebugRibbon({ phase, proScore, inspectionLevel, cabTier, runCancelChoice, timerMs }) {
  const proTier = proScore >= PRO_TIER.HIGH_THRESHOLD ? 'high'
                : proScore <  PRO_TIER.LOW_THRESHOLD  ? 'low'
                : 'neutral';
  return (
    <div
      style={styles.debugRibbon}
      data-phase={phase}
      data-pro-score={proScore}
      data-pro-tier={proTier}
      data-inspection-level={inspectionLevel}
      data-cab-tier={cabTier?.key}
      data-run-cancel-choice={runCancelChoice ?? ''}
      data-timer-ms={timerMs}
    >
      <span>phase: <b>{phase}</b></span>
      <span>pro: <b>{proScore}</b></span>
      <span>level: <b>{inspectionLevel}</b></span>
      <span>cab: <b>{cabTier.key}</b></span>
      <span>rcc: <b>{runCancelChoice ?? '—'}</b></span>
      <span>t: <b>{Math.ceil(timerMs / 1000)}s</b></span>
    </div>
  );
}

// ─── Helper: phase-specific panel labels ────────────────────────────────
function panelLabelFor(phase) {
  switch (phase) {
    case STATES.APPROACH:         return 'WAITING';
    case STATES.FIRST_IMPRESSION: return 'GREETING';
    case STATES.DOCUMENTS:        return "DRIVER'S FOLDER";
    case STATES.ELD_TRANSFER:     return 'ELD DEVICE';
    case STATES.SAFETY_DEMOS:     return 'CAB CONTROLS';
    case STATES.WALKAROUND:       return 'WATCHING';
    case STATES.FINDINGS_REVIEW:  return 'REVIEW';
    case STATES.OUTCOME:          return 'OUTCOME';
    default:                      return 'INSPECTION';
  }
}

function panelDescriptionFor(phase) {
  switch (phase) {
    case STATES.APPROACH:         return 'Officer walking to driver window.';
    case STATES.FIRST_IMPRESSION: return 'Cab scan. Demeanor prompt pending.';
    case STATES.DOCUMENTS:        return 'DOT Compliance folder + Load folder (Phase 2).';
    case STATES.ELD_TRANSFER:     return 'ELD device mockup + routing code flow (Phase 2).';
    case STATES.SAFETY_DEMOS:     return 'Cab control grid (Phase 2).';
    case STATES.WALKAROUND:       return 'Passive observation. Findings feed populates.';
    case STATES.FINDINGS_REVIEW:  return 'Officer returns with verdict.';
    case STATES.OUTCOME:          return 'Clean / Citation / OOS / Knowingly screens (Phase 5).';
    default:                      return '';
  }
}

// ═════════════════════════════════════════════════════════════════════════
// PHASE 4 VISUAL SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════

/**
 * PrePassCinematic — the opening 8-second sequence during CINEMATIC phase.
 * Stages: highway loop video → amber transponder → red transponder → approach.
 * Uses `highway_loop.mp4` as ambient motion, overlaid with PrePass hero stills.
 */
function PrePassCinematic({ phaseStartTime }) {
  const [stage, setStage] = React.useState(0);
  const stageTimersRef = React.useRef([]);

  React.useEffect(() => {
    // Clear any previous timers when phaseStartTime resets
    stageTimersRef.current.forEach(t => clearTimeout(t));
    stageTimersRef.current = [];
    setStage(0);
    // Stage schedule — comfortable pacing per user feedback + v5 plan §8.1 intent.
    // Total: 12 seconds (3s highway badge → 3s amber → 3s red → 3s officer approach).
    // Note: STATE_MIN_DURATION_MS[CINEMATIC] must also = 12000 for phase auto-advance
    // to line up with stage 3 completion.
    stageTimersRef.current = [
      setTimeout(() => setStage(1), 3000),   // highway badge → PrePass amber
      setTimeout(() => setStage(2), 6000),   // amber → red
      setTimeout(() => setStage(3), 9000),   // red → officer approach
    ];
    return () => {
      stageTimersRef.current.forEach(t => clearTimeout(t));
      stageTimersRef.current = [];
    };
  }, [phaseStartTime]);

  return (
    <div style={styles.cineContainer}>
      {/* ── PERSISTENT BACKGROUND LAYERS ────────────────────────────────────
          Per v5 plan §8.1 ("Truck on highway → PrePass amber → red → officer"),
          the highway is the *setting* for the entire approach, not just the first
          moment. Video stays mounted and looping continuously as the base layer
          so we never get a "video stops mid-playback" perception. PrePass and
          officer stages use opaque JPG backgrounds to cover the video when they
          fade in; between transitions (700ms fade), the video shows through,
          which reinforces continuity of place. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disableRemotePlayback
        disablePictureInPicture
        controls={false}
        src={VIDEO.highwayLoop}
        poster={HERO.highway}
        style={styles.cineVideo}
      />
      <div style={styles.cineDimLayer} />

      {/* Stage 0: highway badge (video shows through naturally) */}
      <div style={{ ...styles.cineStage, opacity: stage === 0 ? 1 : 0 }}>
        <div style={{ ...styles.cineOverlay, alignItems: 'flex-end' }}>
          <div style={{ ...styles.cineBadge, borderLeftColor: T.blueSoft, color: T.blueSoft }}>
            <div style={styles.cineBadgeEyebrow}>HIGHWAY · I-95 N</div>
            <div style={styles.cineBadgeTitle}>WEIGH STATION 3 MILES</div>
          </div>
        </div>
      </div>

      {/* Stage 1: PrePass amber */}
      <div style={{
        ...styles.cineStage,
        opacity: stage === 1 ? 1 : 0,
        backgroundImage: `url(${HERO.prepassAmber})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{ ...styles.cineOverlay, alignItems: 'flex-start', paddingTop: 48 }}>
          <div style={{ ...styles.cineBadge, borderLeftColor: T.amberSoft, color: T.amberSoft }}>
            <div style={styles.cineBadgeEyebrow}>PREPASS · TRANSPONDER</div>
            <div style={styles.cineBadgeTitle}>WEIGH STATION AHEAD</div>
            <div style={styles.cineBadgeSub}>ACTIVE · MONITORING</div>
          </div>
        </div>
      </div>

      {/* Stage 2: PrePass red */}
      <div style={{
        ...styles.cineStage,
        opacity: stage === 2 ? 1 : 0,
        backgroundImage: `url(${HERO.prepassRed})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={styles.cineFlashRed} />
        <div style={{ ...styles.cineOverlay, alignItems: 'flex-start', paddingTop: 48 }}>
          <div style={{ ...styles.cineBadge, borderLeftColor: T.red, color: T.red, animation: 'redFlash 600ms ease-in-out infinite' }}>
            <div style={styles.cineBadgeEyebrow}>⚠ INSPECTION FLAGGED</div>
            <div style={styles.cineBadgeTitle}>PULL IN NOW</div>
            <div style={styles.cineBadgeSub}>MANDATORY STOP</div>
          </div>
        </div>
      </div>

      {/* Stage 3: officer approach */}
      <div style={{
        ...styles.cineStage,
        opacity: stage === 3 ? 1 : 0,
        backgroundImage: `url(${HERO.officerApproach})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div style={{ ...styles.cineOverlay, alignItems: 'flex-end' }}>
          <div style={{ ...styles.cineBadge, borderLeftColor: T.amber, color: T.amberSoft }}>
            <div style={styles.cineBadgeEyebrow}>OFFICER APPROACHING</div>
            <div style={styles.cineBadgeTitle}>STAY IN THE CAB</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * WalkaroundTacticalView — during WALKAROUND phase, shows an aerial truck
 * photo with the officer sprite moving between zones. Findings land as
 * colored markers at zone coordinates. Ambient walkaround video loops behind.
 */
function WalkaroundTacticalView({ zoneSequence, currentZoneIndex, findings }) {
  const currentZone = zoneSequence[currentZoneIndex];
  // Map findings to zone positions (skip HOS / administrative which have no physical location)
  const placedFindings = findings
    .filter(f => f.zone && TRUCK_ZONES.some(z => z.id === f.zone))
    .map(f => {
      const z = TRUCK_ZONES.find(z2 => z2.id === f.zone);
      return { ...f, _pos: z.pos };
    });

  return (
    <div style={styles.tacticalContainer}>
      {/* Ambient walkaround video — subtle motion behind truck image */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disableRemotePlayback
        disablePictureInPicture
        controls={false}
        src={VIDEO.walkaroundLoop}
        poster={TACTICAL_IMAGE}
        style={styles.tacticalAmbientVideo}
      />
      <div style={styles.tacticalVideoDim} />

      {/* Truck tactical image */}
      <div
        style={{
          ...styles.tacticalTruckImage,
          backgroundImage: `url(${TACTICAL_IMAGE})`,
        }}
      >
        {/* Zone hotspots — current zone pulses amber; visited zones show faded green */}
        {TRUCK_ZONES.map((z, i) => {
          const isCurrent = currentZone?.id === z.id;
          const isVisited = zoneSequence.findIndex(zz => zz.id === z.id) < currentZoneIndex
                         && zoneSequence.some(zz => zz.id === z.id);
          return (
            <div
              key={z.id}
              style={{
                ...styles.zoneHotspot,
                left: `${z.pos.x}%`,
                top: `${z.pos.y}%`,
                background: isCurrent ? T.amber : isVisited ? T.green : 'transparent',
                borderColor: isCurrent ? T.amber : isVisited ? T.greenGlow : T.border2,
                boxShadow: isCurrent
                  ? `0 0 18px ${T.amberGlow}`
                  : isVisited ? `0 0 6px ${T.greenGlow}` : 'none',
                opacity: isCurrent ? 1 : isVisited ? 0.65 : 0.18,
                animation: isCurrent ? 'zonePulse 1.3s ease-in-out infinite' : 'none',
              }}
              aria-label={`${z.label}${isCurrent ? ' (current)' : isVisited ? ' (inspected)' : ''}`}
            />
          );
        })}

        {/* Officer sprite at current zone's officerPos */}
        {currentZone && (
          <OfficerSprite
            left={currentZone.officerPos.x}
            top={currentZone.officerPos.y}
          />
        )}

        {/* Defect markers at zone positions */}
        {placedFindings.map((f, i) => (
          <div
            key={f.id || i}
            style={{
              ...styles.defectMarker,
              left: `${f._pos.x}%`,
              top: `${f._pos.y + 3}%`,
              background: f.severity === 'oos' ? T.red
                        : f.severity === 'major' ? '#FF8C2A'
                        : f.severity === 'minor' ? T.amber
                        : T.green,
              boxShadow: f.severity === 'oos' ? `0 0 10px ${T.redGlow}` : 'none',
              animation: 'defectLand 600ms ease-out',
            }}
            title={f.desc}
            aria-label={f.desc}
          />
        ))}
      </div>

      {/* Zone label overlay at top */}
      <div style={styles.tacticalZoneLabel}>
        <span style={styles.tacticalZoneEyebrow}>
          ZONE {currentZoneIndex + 1} / {zoneSequence.length}
        </span>
        <span style={styles.tacticalZoneName}>
          {currentZone?.label || '—'}
        </span>
      </div>
    </div>
  );
}

/**
 * OfficerSprite — silhouette figure with reflective vest stripes.
 * Positioned via CSS percentage coordinates. Smoothly transitions as
 * currentZone changes (walkaround animation).
 */
function OfficerSprite({ left, top, small }) {
  const size = small ? 28 : 38;
  return (
    <div
      style={{
        ...styles.officerSprite,
        left: `${left}%`,
        top: `${top}%`,
        width: size,
        height: size * 2.0,
      }}
      aria-label="DOT Officer"
    >
      <svg viewBox="0 0 30 60" style={{ width: '100%', height: '100%' }} aria-hidden="true">
        {/* Officer silhouette with reflective vest — rendered as paths with no external image */}
        {/* Head */}
        <circle cx="15" cy="6" r="4" fill="#0d0f14" stroke="#222" strokeWidth="0.4" />
        {/* Hat brim */}
        <path d="M 9 5 Q 15 3 21 5 L 21 6 Q 15 4 9 6 Z" fill="#0a0c10" />
        {/* Body torso */}
        <path d="M 9 11 Q 15 10 21 11 L 22 30 L 8 30 Z" fill="#14181f" stroke="#1a1d24" strokeWidth="0.3" />
        {/* Reflective vest — two amber-yellow stripes across chest */}
        <rect x="8" y="14" width="14" height="1.8" fill="#FFC24D" opacity="0.9" />
        <rect x="8" y="19" width="14" height="1.8" fill="#FFC24D" opacity="0.9" />
        {/* Vest side panels */}
        <path d="M 7.5 13 L 7.5 27 L 9 27 L 9 13 Z" fill="#FFC24D" opacity="0.85" />
        <path d="M 21 13 L 21 27 L 22.5 27 L 22.5 13 Z" fill="#FFC24D" opacity="0.85" />
        {/* Arms */}
        <path d="M 9 11 L 6 22 L 7 24 L 10 13 Z" fill="#0d0f14" />
        <path d="M 21 11 L 24 22 L 23 24 L 20 13 Z" fill="#0d0f14" />
        {/* Legs */}
        <rect x="10" y="30" width="4" height="22" fill="#0a0c10" />
        <rect x="16" y="30" width="4" height="22" fill="#0a0c10" />
        {/* Clipboard in hand */}
        <rect x="3" y="22" width="5" height="7" fill="#2a2d34" stroke="#404550" strokeWidth="0.3" rx="0.5" />
        <rect x="3.5" y="23" width="4" height="0.4" fill="#FFC24D" opacity="0.7" />
        <rect x="3.5" y="24" width="4" height="0.4" fill="rgba(255,255,255,0.3)" />
        <rect x="3.5" y="25" width="4" height="0.4" fill="rgba(255,255,255,0.3)" />
      </svg>
    </div>
  );
}

/**
 * WindshieldPOV — the player's view out the driver window for non-walkaround
 * phases. Shows dashboard elements, officer visible outside (image 05), and
 * any active light-response overlays from cab control demonstrations.
 */
function WindshieldPOV({ phase, activatedControls, requestTarget }) {
  // Active light responses based on recently-activated controls
  const hasHeadlights = activatedControls?.has('headlights');
  const hasHighBeam = activatedControls?.has('high_beam');
  const hasFlashers = activatedControls?.has('flashers');
  const hasLeftSig = activatedControls?.has('left_signal') || activatedControls?.has('signals');
  const hasRightSig = activatedControls?.has('right_signal') || activatedControls?.has('signals');
  const hasBrakes = activatedControls?.has('brakes');

  // When a light control is currently requested (not yet activated), we
  // subtly emphasize that to guide the player — pre-light anticipation.
  const pulsingControl = requestTarget?.kind === 'control' ? requestTarget.id : null;

  return (
    <div style={styles.windshieldPov}>
      {/* Light overlay beams (from inside — headlights project forward onto road) */}
      {(hasHeadlights || hasHighBeam) && (
        <div style={{
          ...styles.beamOverlay,
          opacity: hasHighBeam ? 0.55 : 0.35,
          filter: hasHighBeam ? 'blur(8px)' : 'blur(14px)',
        }} aria-hidden="true" />
      )}

      {/* 4-Way flashers — amber corner blinks */}
      {hasFlashers && (
        <>
          <div style={{ ...styles.flasherCorner, top: 8, left: 8, animation: 'flasherBlink 650ms step-end infinite' }} />
          <div style={{ ...styles.flasherCorner, top: 8, right: 8, animation: 'flasherBlink 650ms step-end infinite' }} />
          <div style={{ ...styles.flasherCorner, bottom: 8, left: 8, animation: 'flasherBlink 650ms step-end infinite' }} />
          <div style={{ ...styles.flasherCorner, bottom: 8, right: 8, animation: 'flasherBlink 650ms step-end infinite' }} />
        </>
      )}

      {/* Turn signal arrow overlays */}
      {hasLeftSig && (
        <div style={{ ...styles.signalArrow, left: 10, animation: 'signalBlink 700ms step-end infinite' }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M20 12 l-10 -8 v5 h-6 v6 h6 v5 z" fill="#FFC24D" />
          </svg>
        </div>
      )}
      {hasRightSig && (
        <div style={{ ...styles.signalArrow, right: 10, animation: 'signalBlink 700ms step-end infinite' }} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M4 12 l10 -8 v5 h6 v6 h-6 v5 z" fill="#FFC24D" />
          </svg>
        </div>
      )}

      {/* Brake indicator — red glow at bottom */}
      {hasBrakes && (
        <div style={styles.brakeGlow} aria-hidden="true" />
      )}

      {/* Officer visible through the window — image 05 cropped to appear "outside" */}
      {(phase === STATES.DOCUMENTS || phase === STATES.ELD_TRANSFER ||
        phase === STATES.SAFETY_DEMOS || phase === STATES.FIRST_IMPRESSION) && (
        <div
          style={{
            ...styles.povOfficerWindow,
            backgroundImage: `url(${HERO.officerWindow})`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Control hint when officer is requesting a cab control */}
      {pulsingControl && phase === STATES.SAFETY_DEMOS && (
        <div style={styles.controlHint}>
          <div style={styles.controlHintPulse} />
          <div style={styles.controlHintText}>WATCH FOR LIGHTS</div>
        </div>
      )}
    </div>
  );
}

/**
 * FindingPop — a small animated entry that can be placed into the findings
 * rail (augments the Phase 1 findings row with a pop-in animation).
 */
function FindingPop({ finding, index }) {
  const color = finding.severity === 'oos' ? T.red
              : finding.severity === 'major' ? '#FF8C2A'
              : finding.severity === 'minor' ? T.amber
              : finding.severity === 'clean' ? T.green
              : T.amberSoft;
  return (
    <div
      style={{
        ...styles.findingRow,
        ...styles.findingPopRow,
        borderLeftColor: color,
      }}
      data-finding-severity={finding.severity}
      data-finding-zone={finding.zone}
    >
      <div style={{ ...styles.findingDot, background: color }} />
      <div style={styles.findingText}>
        <span style={{ color, fontWeight: 600 }}>
          [{(finding.severity || 'info').toUpperCase()}]
        </span>{' '}
        {finding.desc || finding.description || ''}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// PHASE 5 OUTCOME SCREENS
// ═════════════════════════════════════════════════════════════════════════
// Four full-fidelity outcome screens replacing the Phase 1 OutcomeSkeleton.
// The OutcomeScreen dispatcher selects based on `outcome` which comes from
// buildOutcomePayload. Each screen renders its own visual identity, stats,
// and a Continue button that fires onContinue (wired to advance FSM to
// COMPLETE, which then fires onComplete).
//
// Screens: CleanPass, Citation, OutOfService, KnowinglyOperated.

/**
 * CvsaDecal — hexagonal CVSA-style decal, inspired by real CVSA design but
 * distinct. Animated stamp-down on mount. Rendered with inline SVG.
 * @param {number} level - inspection level (1/2/3)
 * @param {string} decalNumber - displayed decal number
 * @param {number} expiresDay - game day the decal expires
 * @param {number} currentDay - today's game day (to compute "Valid X days")
 */
function CvsaDecal({ level, decalNumber, expiresDay, currentDay }) {
  const daysValid = Math.max(0, (expiresDay ?? 0) - (currentDay ?? 0));
  const roman = level === 1 || level === 'I'   ? 'I'
              : level === 2 || level === 'II'  ? 'II'
              : level === 3 || level === 'III' ? 'III'
              : 'II';
  return (
    <div style={styles.cvsaDecalWrap} aria-label={`CVSA Level ${roman} decal, valid ${daysValid} days`}>
      <div style={styles.cvsaDecalStamp}>
        <svg viewBox="0 0 160 180" style={{ width: '100%', height: '100%' }} aria-hidden="true">
          {/* Outer hex */}
          <polygon
            points="80,4 148,38 148,122 80,156 12,122 12,38"
            fill="url(#decalGradient)"
            stroke="#0b3a1e"
            strokeWidth="2.5"
          />
          {/* Inner hex */}
          <polygon
            points="80,16 136,44 136,116 80,144 24,116 24,44"
            fill="none"
            stroke="#0b3a1e"
            strokeWidth="1.2"
            opacity="0.5"
          />
          {/* Top arc text: CVSA */}
          <text x="80" y="42" textAnchor="middle"
                fontFamily="Oxanium, sans-serif" fontSize="18" fontWeight="800"
                fill="#0b3a1e" letterSpacing="3">CVSA</text>
          {/* Level roman */}
          <text x="80" y="90" textAnchor="middle"
                fontFamily="Oxanium, sans-serif" fontSize="44" fontWeight="800"
                fill="#0b3a1e" letterSpacing="2">{roman}</text>
          {/* Decal number */}
          <text x="80" y="112" textAnchor="middle"
                fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="600"
                fill="#0b3a1e" opacity="0.85">№ {decalNumber}</text>
          {/* Bottom arc text */}
          <text x="80" y="134" textAnchor="middle"
                fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="600"
                fill="#0b3a1e" letterSpacing="1.4">DECAL · VALID</text>
          {/* Defs */}
          <defs>
            <linearGradient id="decalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#66C97A" />
              <stop offset="60%"  stopColor="#35A955" />
              <stop offset="100%" stopColor="#1C7A3A" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div style={styles.cvsaDecalGlow} aria-hidden="true" />
      <div style={styles.cvsaDecalValidBadge}>
        <div style={styles.cvsaDecalValidLabel}>VALID</div>
        <div style={styles.cvsaDecalValidDays}>{daysValid} DAYS</div>
      </div>
    </div>
  );
}

/**
 * CleanPass — the best outcome. Player earned a CVSA decal + no fines.
 * Green theme, celebratory but professional.
 */
function CleanPass({ payload, level, currentDay, onContinue, continueEnabled }) {
  // Phase 6: defensive destructuring — any missing field defaults to a safe
  // value so a malformed payload (e.g., from testHarnessForceOutcome) can
  // never crash the outcome screen.
  const findings = payload?.findings ?? [];
  const finalInspectionLevel = payload?.finalInspectionLevel ?? 'II';
  const cvsaDecalExpiresDay = payload?.cvsaDecalExpiresDay ?? ((currentDay ?? 1) + 90);
  const timeToComplete = payload?.timeToComplete ?? 0;
  const nonCleanFindings = findings.filter(f => f?.severity && f.severity !== 'clean');
  return (
    <div style={{ ...styles.outcomeScreen, ...styles.outcomeScreenClean }}>
      <div style={styles.outcomeRipple} aria-hidden="true" />
      <div style={styles.outcomeHeader}>
        <div style={styles.outcomeEyebrowGreen}>INSPECTION COMPLETE</div>
        <div style={styles.outcomeTitleClean}>CLEAN PASS</div>
      </div>
      <CvsaDecal
        level={finalInspectionLevel}
        decalNumber={String(Math.floor(100000 + Math.random() * 900000))}
        expiresDay={cvsaDecalExpiresDay}
        currentDay={currentDay}
      />
      <div style={styles.outcomeStatsBlock}>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>FINDINGS</span>
          <span style={styles.outcomeStatValueClean}>
            {nonCleanFindings.length === 0 ? 'NONE' : 'NOTATIONS ONLY'}
          </span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>CSA IMPACT</span>
          <span style={styles.outcomeStatValueClean}>NO CHANGE</span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>DECAL EXPIRES</span>
          <span style={styles.outcomeStatValueClean}>DAY {cvsaDecalExpiresDay}</span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>TIME</span>
          <span style={styles.outcomeStatValue}>{timeToComplete}s</span>
        </div>
      </div>
      <div style={styles.outcomeMessage}>
        "Appreciate the thorough inspection. Have a safe run."
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={!continueEnabled}
        style={{
          ...styles.outcomeContinueBtn,
          ...styles.outcomeContinueBtnClean,
          opacity: continueEnabled ? 1 : 0.4,
          cursor: continueEnabled ? 'pointer' : 'default',
        }}
      >
        CONTINUE
      </button>
    </div>
  );
}

/**
 * Citation — amber theme, itemized fine list, CSA impact shown prominently.
 */
function Citation({ payload, formatCurrency, onContinue, continueEnabled }) {
  const fineItems = payload?.fineItems ?? [];
  const fineTotal = payload?.fineTotal ?? 0;
  const csaImpact = payload?.csaImpact ?? 0;
  const defectsFound = payload?.defectsFound ?? [];
  const timeToComplete = payload?.timeToComplete ?? 0;
  return (
    <div style={{ ...styles.outcomeScreen, ...styles.outcomeScreenCitation }}>
      <div style={styles.outcomeHeader}>
        <div style={styles.outcomeEyebrowAmber}>INSPECTION COMPLETE</div>
        <div style={styles.outcomeTitleCitation}>CITATION ISSUED</div>
      </div>
      <div style={styles.outcomeFineList}>
        <div style={styles.outcomeFineHeader}>ASSESSED PENALTIES</div>
        {fineItems.length > 0 ? (
          fineItems.map((item, i) => (
            <div key={i} style={styles.outcomeFineRow}>
              <div style={styles.outcomeFineCellLabel}>
                <div style={styles.outcomeFineLabelText}>{item?.label ?? '—'}</div>
                <div style={styles.outcomeFineCfr}>{item?.cfr ?? '—'}</div>
              </div>
              <div style={{
                ...styles.outcomeFineCellAmount,
                color: item?.severity === 'oos' ? '#FF8585'
                     : item?.severity === 'major' ? '#FFC24D'
                     : '#FFD88A',
              }}>
                {formatCurrency(item?.amount ?? 0)}
              </div>
            </div>
          ))
        ) : (
          <div style={{ ...styles.outcomeFineRow, padding: '8px' }}>
            <div style={styles.outcomeFineLabelText}>No itemized findings</div>
          </div>
        )}
        <div style={styles.outcomeFineTotalRow}>
          <span style={styles.outcomeFineTotalLabel}>TOTAL</span>
          <span style={styles.outcomeFineTotalAmount}>{formatCurrency(fineTotal)}</span>
        </div>
      </div>
      <div style={styles.outcomeStatsBlock}>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>CSA IMPACT</span>
          <span style={styles.outcomeStatValueWarn}>{csaImpact} pts</span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>FINDINGS</span>
          <span style={styles.outcomeStatValue}>{defectsFound.length} cited</span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>TIME</span>
          <span style={styles.outcomeStatValue}>{timeToComplete}s</span>
        </div>
      </div>
      <div style={styles.outcomeMessage}>
        Correct all cited violations before your next dispatch.
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={!continueEnabled}
        style={{
          ...styles.outcomeContinueBtn,
          ...styles.outcomeContinueBtnAmber,
          opacity: continueEnabled ? 1 : 0.4,
          cursor: continueEnabled ? 'pointer' : 'default',
        }}
      >
        ACKNOWLEDGE
      </button>
    </div>
  );
}

/**
 * OutOfService — red theme, OOS sticker image, tow icon, repair cost.
 * Delivery cancelled.
 */
function OutOfService({ payload, formatCurrency, onContinue, continueEnabled }) {
  const fineItems = payload?.fineItems ?? [];
  const fineTotal = payload?.fineTotal ?? 0;
  const repairEstimate = payload?.repairEstimate ?? 0;
  const csaImpact = payload?.csaImpact ?? 0;
  return (
    <div style={{ ...styles.outcomeScreen, ...styles.outcomeScreenOOS }}>
      <div style={styles.outcomeFlashRed} aria-hidden="true" />
      <div style={styles.outcomeHeader}>
        <div style={styles.outcomeEyebrowRed}>⚠ INSPECTION COMPLETE</div>
        <div style={styles.outcomeTitleOOS}>OUT OF SERVICE</div>
      </div>
      <div
        style={{
          ...styles.outcomeOOSSticker,
          backgroundImage: `url(${HERO.oosSticker})`,
        }}
        aria-label="OOS sticker"
      >
        <div style={styles.outcomeOOSStickerOverlay}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            {/* Tow icon */}
            <path d="M3 13 v5 h3 M3 13 h13 v5 h5 l-1 -4 l-4 -1 M16 18 a1.5 1.5 0 1 0 0.01 0 M7 18 a1.5 1.5 0 1 0 0.01 0"
                  stroke="#FF3B3B" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={styles.outcomeOOSStickerText}>VEHICLE GROUNDED</span>
        </div>
      </div>
      <div style={styles.outcomeFineList}>
        <div style={styles.outcomeFineHeader}>OOS VIOLATIONS</div>
        {fineItems.length > 0 ? (
          fineItems.slice(0, 6).map((item, i) => (
            <div key={i} style={styles.outcomeFineRow}>
              <div style={styles.outcomeFineCellLabel}>
                <div style={styles.outcomeFineLabelText}>{item?.label ?? '—'}</div>
                <div style={styles.outcomeFineCfr}>{item?.cfr ?? '—'}</div>
              </div>
              <div style={{
                ...styles.outcomeFineCellAmount,
                color: item?.severity === 'oos' ? '#FF8585' : '#FFC24D',
              }}>
                {formatCurrency(item?.amount ?? 0)}
              </div>
            </div>
          ))
        ) : null}
        <div style={styles.outcomeFineTotalRow}>
          <span style={styles.outcomeFineTotalLabel}>FINES</span>
          <span style={{ ...styles.outcomeFineTotalAmount, color: '#FF8585' }}>
            {formatCurrency(fineTotal)}
          </span>
        </div>
        <div style={styles.outcomeFineTotalRow}>
          <span style={styles.outcomeFineTotalLabel}>REPAIR EST.</span>
          <span style={{ ...styles.outcomeFineTotalAmount, color: '#FFC24D' }}>
            {formatCurrency(repairEstimate)}
          </span>
        </div>
      </div>
      <div style={styles.outcomeStatsBlock}>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>CSA IMPACT</span>
          <span style={styles.outcomeStatValueRed}>{csaImpact} pts</span>
        </div>
        <div style={styles.outcomeStatRow}>
          <span style={styles.outcomeStatLabel}>DELIVERY</span>
          <span style={styles.outcomeStatValueRed}>CANCELLED</span>
        </div>
      </div>
      <div style={styles.outcomeMessage}>
        Vehicle cannot move until all OOS violations are corrected. Tow required.
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={!continueEnabled}
        style={{
          ...styles.outcomeContinueBtn,
          ...styles.outcomeContinueBtnRed,
          opacity: continueEnabled ? 1 : 0.4,
          cursor: continueEnabled ? 'pointer' : 'default',
        }}
      >
        ACCEPT OOS ORDER
      </button>
    </div>
  );
}

/**
 * KnowinglyOperated — the heaviest outcome. Red flash on mount, stamp
 * animation, consequence grid with educational content.
 */
function KnowinglyOperated({ payload, formatCurrency, onContinue, continueEnabled }) {
  const fineTotal = payload?.fineTotal ?? 0;
  const csaImpact = payload?.csaImpact ?? 0;
  const stackedOos = Math.max(0, fineTotal - 19277);
  return (
    <div style={{ ...styles.outcomeScreen, ...styles.outcomeScreenKnowingly }}>
      <div style={styles.outcomeFlashRedIntense} aria-hidden="true" />
      <div style={styles.outcomeHeader}>
        <div style={styles.outcomeEyebrowRed}>SERIOUS VIOLATION</div>
      </div>
      {/* Stamp graphic */}
      <div style={styles.knowinglyStampWrap}>
        <div style={styles.knowinglyStamp}>
          <div style={styles.knowinglyStampText}>KNOWINGLY</div>
          <div style={styles.knowinglyStampText}>OPERATED</div>
          <div style={styles.knowinglyStampCfr}>49 CFR 396.9(c)(2)</div>
        </div>
      </div>
      {/* Consequence grid — educational */}
      <div style={styles.consequenceGrid}>
        <div style={styles.consequenceCell}>
          <div style={styles.consequenceLabel}>Knowing Violation</div>
          <div style={styles.consequenceAmountRed}>
            {formatCurrency(19277)}
          </div>
        </div>
        <div style={styles.consequenceCell}>
          <div style={styles.consequenceLabel}>Stacked OOS Fines</div>
          <div style={styles.consequenceAmountRed}>
            {formatCurrency(stackedOos)}
          </div>
        </div>
        <div style={styles.consequenceCell}>
          <div style={styles.consequenceLabel}>Total Exposure</div>
          <div style={styles.consequenceAmountRedLarge}>
            {formatCurrency(fineTotal)}
          </div>
        </div>
        <div style={styles.consequenceCell}>
          <div style={styles.consequenceLabel}>CSA Impact</div>
          <div style={styles.consequenceAmountRed}>
            {csaImpact} pts
          </div>
        </div>
        <div style={styles.consequenceCellWide}>
          <div style={styles.consequenceLabel}>Record Duration</div>
          <div style={styles.consequenceDurationText}>
            Stays on carrier safety record for 24 months · May trigger audit
          </div>
        </div>
      </div>
      <div style={styles.outcomeMessage}>
        <span style={{ color: '#FFC24D', fontWeight: 600 }}>MARCUS · RADIO:</span>{' '}
        "We'll sort it. First thing is don't argue with him. Just sign it and we deal with it back at the yard."
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={!continueEnabled}
        style={{
          ...styles.outcomeContinueBtn,
          ...styles.outcomeContinueBtnRed,
          opacity: continueEnabled ? 1 : 0.4,
          cursor: continueEnabled ? 'pointer' : 'default',
        }}
      >
        SIGN PAPERWORK
      </button>
    </div>
  );
}

/**
 * OutcomeScreen — dispatcher that picks the right screen based on outcome.
 * Handles Continue button debounce and unified prop passing.
 */
function OutcomeScreen({ payload, currentDay, formatCurrency, onContinue }) {
  const [continueEnabled, setContinueEnabled] = useState(false);
  const continueTimerRef = useRef(null);
  useEffect(() => {
    // Disable continue for 1.5s to prevent accidental dismissal
    continueTimerRef.current = setTimeout(() => {
      continueTimerRef.current = null;
      setContinueEnabled(true);
    }, 1500);
    return () => {
      if (continueTimerRef.current) {
        clearTimeout(continueTimerRef.current);
        continueTimerRef.current = null;
      }
    };
  }, []);

  const fmt = formatCurrency || (n => `$${(n || 0).toLocaleString()}`);
  const common = { payload, formatCurrency: fmt, onContinue, continueEnabled };

  switch (payload?.outcome) {
    case 'clean':
      return <CleanPass {...common} level={payload.finalInspectionLevel} currentDay={currentDay} />;
    case 'citation':
      return <Citation {...common} />;
    case 'oos':
      return <OutOfService {...common} />;
    case 'knowingly':
      return <KnowinglyOperated {...common} />;
    default:
      // Fallback — 'incomplete' or unknown
      return (
        <div style={{ ...styles.outcomeScreen, ...styles.outcomeScreenCitation }}>
          <div style={styles.outcomeHeader}>
            <div style={styles.outcomeEyebrowAmber}>INCOMPLETE</div>
            <div style={styles.outcomeTitleCitation}>INSPECTION ABANDONED</div>
          </div>
          <div style={styles.outcomeMessage}>
            You walked away from the inspection. The officer noted it.
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!continueEnabled}
            style={{
              ...styles.outcomeContinueBtn,
              ...styles.outcomeContinueBtnAmber,
              opacity: continueEnabled ? 1 : 0.4,
            }}
          >
            CONTINUE
          </button>
        </div>
      );
  }
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════
// All inline styles as a single module-scoped const to avoid re-allocation
// on every render. Component styles reference tokens from T (design tokens).

const styles = {
  // Root: full-bleed portrait container, max 460px wide.
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    overflow: 'hidden',
    background: T.bg,
    fontFamily: T.fontSans,
    color: T.text,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    userSelect: 'none',
  },

  // Background image layer — behind everything.
  backgroundLayer: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    transition: 'background-image 600ms ease-in-out',
    zIndex: 0,
  },

  // Dark gradient on top of background so UI text remains legible.
  backgroundOverlay: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(180deg, rgba(5,6,10,0.55) 0%, rgba(5,6,10,0.35) 30%, rgba(5,6,10,0.75) 70%, rgba(5,6,10,0.92) 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },

  // Note: Phase 1 'cinematic*' styles removed in Phase 4 — replaced by the
  // PrePassCinematic sub-component which has its own styles (cineContainer
  // etc). See PHASE 4 STYLES section further down.

  // Main UI layer — constrained max-width portrait.
  uiLayer: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: 460,
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 12px 16px',
    gap: 10,
    overflow: 'hidden',
  },

  // ─── Officer card ────────────────────────────────────────────────────
  officerCard: {
    position: 'relative',
    background: 'linear-gradient(180deg, rgba(26,29,36,0.95), rgba(16,19,26,0.95))',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: '9px 44px 9px 14px',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    flexShrink: 0,
  },
  officerAccent: {
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    width: 3,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  officerBadge: {
    width: 34, height: 34,
    flexShrink: 0,
    background: 'radial-gradient(circle at 30% 30%, #D4AF37, #8B6914 60%, #4a3608 100%)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #D4AF37',
    transition: 'box-shadow 400ms ease',
  },
  officerInfo: {
    flex: 1,
    minWidth: 0,
  },
  officerLabel: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.text3,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    lineHeight: 1.2,
  },
  officerName: {
    fontSize: 12,
    fontWeight: 600,
    color: T.text,
    marginTop: 1,
  },
  timerRow: {
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  timerTrack: {
    flex: 1,
    height: 4,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    transition: 'width 250ms linear, background 300ms ease',
  },
  timerCount: {
    fontFamily: T.fontMono,
    fontSize: 11,
    minWidth: 34,
    textAlign: 'right',
    fontWeight: 500,
    transition: 'color 300ms ease',
  },
  phasePill: {
    position: 'absolute',
    top: 8,
    right: 40,
    fontFamily: T.fontMono,
    fontSize: 9,
    padding: '3px 7px',
    borderRadius: 3,
    background: T.amberDim,
    color: T.amberSoft,
    border: `1px solid ${T.amberDim}`,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  closeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    color: T.text2,
    fontSize: 18,
    fontWeight: 400,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 150ms ease',
    touchAction: 'manipulation',
  },

  // ─── Viewport (windshield + findings rail) ──────────────────────────
  viewport: {
    display: 'grid',
    gridTemplateColumns: '1fr 120px',
    gap: 8,
    minHeight: 180,
    flexShrink: 0,
  },
  windshield: {
    position: 'relative',
    aspectRatio: '16/11',
    background: 'rgba(5,6,10,0.35)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    overflow: 'hidden',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  windshieldPlaceholder: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    color: T.text3,
    textAlign: 'center',
    padding: 12,
  },
  windshieldPhase: {
    fontFamily: T.fontDisplay,
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: T.amberSoft,
  },

  findingsRail: {
    background: 'rgba(4,5,10,0.8)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: '10px 8px 8px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 180,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    overflow: 'hidden',
  },
  findingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 6,
    borderBottom: `1px dashed ${T.border2}`,
    flexShrink: 0,
  },
  findingsHeaderLabel: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.text3,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  findingsHeaderRec: {
    display: 'inline-block',
    width: 6, height: 6,
    borderRadius: '50%',
    background: T.red,
    boxShadow: `0 0 6px ${T.redGlow}`,
    animation: 'recDot 1s ease-in-out infinite',
  },
  findingsList: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  findingsEmpty: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text3,
    letterSpacing: '0.08em',
    textAlign: 'center',
    padding: '20px 8px',
    fontStyle: 'italic',
  },
  findingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 2px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  findingDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  findingText: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text2,
    lineHeight: 1.25,
    letterSpacing: '0.02em',
  },

  // ─── Interaction panel ───────────────────────────────────────────────
  interactPanel: {
    flex: 1,
    background: 'rgba(4,5,10,0.7)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: 12,
    minHeight: 160,
    display: 'flex',
    flexDirection: 'column',
    backdropFilter: 'blur(3px)',
    WebkitBackdropFilter: 'blur(3px)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 10,
    borderBottom: `1px dashed ${T.border2}`,
    flexShrink: 0,
  },
  panelHeaderLabel: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text3,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  panelHeaderTag: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.amberSoft,
    letterSpacing: '0.14em',
    fontWeight: 600,
  },
  panelBody: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  panelSkeletonMsg: {
    fontFamily: T.fontDisplay,
    fontSize: 13,
    color: T.amberSoft,
    letterSpacing: '0.14em',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  panelSkeletonSub: {
    fontFamily: T.fontMono,
    fontSize: 10,
    color: T.text3,
    letterSpacing: '0.06em',
    marginTop: 6,
    lineHeight: 1.5,
    textTransform: 'none',
    fontWeight: 400,
    maxWidth: 320,
    margin: '6px auto 0',
  },

  // Note: Phase 1 outcomeSkeleton* styles were removed in Phase 5 — replaced
  // by OutcomeScreen with full theme variants (see PHASE 5 OUTCOME SCREENS
  // styles section below).

  // ═════════════════════════════════════════════════════════════════════
  // PHASE 2 STYLES
  // ═════════════════════════════════════════════════════════════════════

  // ─── Officer Speech Bubble ───────────────────────────────────────────
  speechBubble: {
    position: 'relative',
    padding: '8px 12px 9px 14px',
    background: 'linear-gradient(180deg, rgba(26,29,36,0.92), rgba(16,19,26,0.92))',
    border: `1px solid ${T.border2}`,
    borderLeft: `3px solid ${T.amberSoft}`,
    borderRadius: 8,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    flexShrink: 0,
    animation: 'speechFadeIn 400ms ease-out',
  },
  speechLabel: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.amberSoft,
    letterSpacing: '0.2em',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  speechText: {
    fontFamily: T.fontSans,
    fontSize: 13,
    color: T.text,
    fontStyle: 'italic',
    lineHeight: 1.35,
    letterSpacing: '0.01em',
  },

  // ─── Folder dispatcher layout ────────────────────────────────────────
  folderDispatch: {
    display: 'flex',
    gap: 8,
    width: '100%',
    height: '100%',
    alignItems: 'stretch',
  },
  folderContainer: {
    flex: '1 1 60%',
    background: 'linear-gradient(160deg, #1a1408 0%, #0f0a04 100%)',
    border: `1px solid ${T.border2}`,
    borderRadius: 8,
    padding: '8px 8px 6px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 300ms ease, border-color 300ms ease',
    minWidth: 0,
  },
  folderContainerActive: {
    borderColor: T.amber,
    boxShadow: `0 0 18px ${T.amberGlow}, inset 0 0 0 1px ${T.amberDim}`,
  },
  folderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    marginBottom: 6,
    borderBottom: `1px dashed ${T.border2}`,
    flexShrink: 0,
  },
  folderIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderLabel: {
    flex: 1,
    fontFamily: T.fontMono,
    fontSize: 8.5,
    color: T.amberSoft,
    letterSpacing: '0.18em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  folderCount: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text3,
    padding: '1px 6px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    letterSpacing: '0.08em',
  },
  docGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 5,
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },

  // ─── BOL Clipboard ───────────────────────────────────────────────────
  clipboardContainer: {
    position: 'relative',
    flex: '0 0 35%',
    background: 'linear-gradient(160deg, #1a1d24 0%, #0e1014 100%)',
    border: `1px solid ${T.border2}`,
    borderRadius: 6,
    padding: '14px 6px 6px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 300ms ease, border-color 300ms ease',
    minWidth: 0,
  },
  clipboardClip: {
    position: 'absolute',
    top: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 36,
    height: 12,
    background: 'linear-gradient(180deg, #2a2d35 0%, #1a1d24 100%)',
    border: `1px solid ${T.border2}`,
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  clipboardClipTab: {
    width: 14,
    height: 3,
    background: 'rgba(255,255,255,0.12)',
    borderRadius: 1,
  },
  clipboardHeader: {
    paddingBottom: 4,
    marginBottom: 5,
    borderBottom: `1px dashed ${T.border2}`,
    flexShrink: 0,
  },
  clipboardCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    flex: 1,
    minHeight: 0,
  },

  // ─── Document Card (used inside folder AND clipboard) ────────────────
  docCard: {
    position: 'relative',
    padding: '7px 6px',
    background: 'rgba(255,255,255,0.015)',
    border: '1px solid',
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
    color: T.text2,
    transition: 'transform 140ms ease, border-color 200ms ease, box-shadow 200ms ease, background 200ms ease',
    minHeight: 44,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    textAlign: 'left',
    fontFamily: T.fontSans,
  },
  docCardClipboard: {
    padding: '8px 8px',
  },
  docCardIcon: {
    flexShrink: 0,
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCardBody: {
    flex: 1,
    minWidth: 0,
  },
  docCardLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: T.text,
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  docCardSublabel: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.text3,
    letterSpacing: '0.06em',
    lineHeight: 1.3,
    marginTop: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  handedStamp: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    background: 'rgba(34,197,94,0.15)',
    border: `1px solid ${T.greenGlow}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Cab Controls Panel ──────────────────────────────────────────────
  cabControlsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
  },
  cabControlsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  cabControlsSecondary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
    paddingTop: 5,
    borderTop: `1px dashed ${T.border2}`,
    animation: 'secondaryReveal 260ms ease-out',
  },
  cabCtrlBtn: {
    position: 'relative',
    padding: '8px 4px 7px',
    border: '1px solid',
    borderRadius: 6,
    cursor: 'pointer',
    color: T.text,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 62,
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'transform 120ms ease, border-color 200ms ease, box-shadow 200ms ease, background 200ms ease',
    fontFamily: T.fontSans,
  },
  cabCtrlBtnSecondary: {
    minHeight: 54,
    opacity: 0.95,
  },
  cabCtrlIconWrap: {
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabCtrlLabel: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.02em',
    textAlign: 'center',
  },
  cabCtrlSublabel: {
    fontFamily: T.fontMono,
    fontSize: 7.5,
    color: T.text3,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  cabCtrlCheck: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 14,
    height: 14,
    background: 'rgba(34,197,94,0.18)',
    border: `1px solid ${T.green}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryToggle: {
    padding: '5px 8px',
    background: 'rgba(255,255,255,0.03)',
    border: `1px dashed ${T.border2}`,
    borderRadius: 4,
    color: T.text3,
    fontFamily: T.fontMono,
    fontSize: 9,
    letterSpacing: '0.14em',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  },

  // ─── ELD Device Panel ────────────────────────────────────────────────
  eldPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '4px 0',
  },
  eldDevice: {
    width: '100%',
    maxWidth: 280,
  },
  eldBezel: {
    background: 'linear-gradient(180deg, #2a2d35 0%, #15171d 100%)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: 8,
    boxShadow: '0 4px 14px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  eldScreen: {
    position: 'relative',
    background: '#0a1a0e',
    border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 4,
    padding: '10px 10px 12px',
    overflow: 'hidden',
    minHeight: 118,
  },
  eldScreenScanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(34,197,94,0.04) 2px, rgba(34,197,94,0.04) 3px)',
    pointerEvents: 'none',
    opacity: 0.6,
  },
  eldScreenContent: {
    position: 'relative',
    zIndex: 1,
  },
  eldTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 8,
    borderBottom: '1px dashed rgba(34,197,94,0.2)',
  },
  eldTopLabel: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: '#44FF88',
    letterSpacing: '0.14em',
    fontWeight: 600,
  },
  eldTopDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#44FF88',
    boxShadow: '0 0 6px rgba(68,255,136,0.6)',
    animation: 'eldBlink 1.4s ease-in-out infinite',
  },
  eldCodeLabel: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: 'rgba(68,255,136,0.6)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  eldCode: {
    fontFamily: T.fontMono,
    fontSize: 22,
    color: '#44FF88',
    letterSpacing: '0.18em',
    fontWeight: 700,
    textShadow: '0 0 8px rgba(68,255,136,0.6)',
    marginBottom: 10,
  },
  eldStatus: {
    paddingTop: 6,
    borderTop: '1px dashed rgba(34,197,94,0.2)',
  },
  eldStatusText: {
    fontFamily: T.fontMono,
    fontSize: 9,
    letterSpacing: '0.14em',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  eldProgressTrack: {
    height: 3,
    background: 'rgba(34,197,94,0.15)',
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  eldProgressFill: {
    height: '100%',
    background: '#44FF88',
    boxShadow: '0 0 6px rgba(68,255,136,0.6)',
    animation: 'eldProgress 2.6s ease-out forwards',
  },
  eldBezelLabel: {
    fontFamily: T.fontMono,
    fontSize: 7.5,
    color: T.text3,
    letterSpacing: '0.16em',
    textAlign: 'center',
    marginTop: 5,
    textTransform: 'uppercase',
  },
  eldMethodRow: {
    display: 'flex',
    gap: 6,
    width: '100%',
    maxWidth: 280,
  },
  eldMethodBtn: {
    flex: 1,
    padding: '7px 10px',
    background: 'rgba(255,255,255,0.02)',
    border: `1px solid ${T.border2}`,
    borderRadius: 4,
    color: T.text2,
    fontFamily: T.fontMono,
    fontSize: 9.5,
    letterSpacing: '0.14em',
    fontWeight: 600,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'background 180ms ease, border-color 180ms ease, color 180ms ease',
  },
  eldMethodBtnSel: {
    background: T.amberDim,
    borderColor: T.amber,
    color: T.amberSoft,
  },
  eldInitiateBtn: {
    width: '100%',
    maxWidth: 280,
    padding: '11px 14px',
    background: 'linear-gradient(180deg, #FFB020 0%, #E89A10 100%)',
    border: '1px solid #FFB020',
    borderRadius: 6,
    color: '#1a0f04',
    fontFamily: T.fontMono,
    fontSize: 11,
    letterSpacing: '0.18em',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
    transition: 'transform 120ms ease, opacity 200ms ease',
    boxShadow: '0 3px 10px rgba(255,176,32,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
  },

  // ─── Walkaround watching (passive) ───────────────────────────────────
  walkWatch: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '4px 4px 0',
  },
  walkDotsRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  walkDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: T.amber,
    boxShadow: `0 0 8px ${T.amberGlow}`,
    animation: 'walkDotBounce 1.2s ease-in-out infinite',
  },
  walkMessage: {
    fontFamily: T.fontDisplay,
    fontSize: 13,
    color: T.amberSoft,
    letterSpacing: '0.16em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  walkSubmessage: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text3,
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  walkMarcusRow: {
    display: 'flex',
    gap: 7,
    alignItems: 'flex-start',
    padding: '6px 8px',
    background: 'rgba(255,176,32,0.06)',
    border: `1px solid ${T.amberDim}`,
    borderRadius: 6,
    width: '100%',
    maxWidth: 380,
  },
  walkMarcusIcon: {
    flexShrink: 0,
    marginTop: 1,
  },
  walkMarcusText: {
    flex: 1,
    fontSize: 10.5,
    color: T.text2,
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  walkMarcusLabel: {
    fontFamily: T.fontMono,
    fontStyle: 'normal',
    fontSize: 8,
    color: T.amberSoft,
    letterSpacing: '0.16em',
    fontWeight: 700,
    marginRight: 4,
  },

  // ─── Waiting panel (for APPROACH / FIRST_IMPRESSION / REVIEW) ────────
  waitingPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 0',
  },
  waitingDots: {
    display: 'flex',
    gap: 5,
  },
  waitingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.amberSoft,
    animation: 'waitingDotPulse 1.2s ease-in-out infinite',
  },
  waitingText: {
    fontFamily: T.fontMono,
    fontSize: 10,
    color: T.text3,
    letterSpacing: '0.1em',
    fontStyle: 'italic',
  },

  // ═════════════════════════════════════════════════════════════════════
  // PHASE 4 STYLES — CINEMATIC · TACTICAL · WINDSHIELD POV · EFFECTS
  // ═════════════════════════════════════════════════════════════════════

  // ─── PrePass Cinematic ───────────────────────────────────────────────
  cineContainer: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
    overflow: 'hidden',
    background: '#000',
  },
  cineStage: {
    position: 'absolute',
    inset: 0,
    transition: 'opacity 700ms ease-in-out',
  },
  cineVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cineDimLayer: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.75) 100%)',
    pointerEvents: 'none',
  },
  cineOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '28px 22px',
    zIndex: 2,
  },
  cineBadge: {
    padding: '12px 16px',
    background: 'rgba(0,0,0,0.72)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderLeft: '3px solid',
    borderRadius: 6,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    maxWidth: 340,
  },
  cineBadgeEyebrow: {
    fontFamily: T.fontMono,
    fontSize: 10,
    letterSpacing: '0.22em',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: 4,
    opacity: 0.9,
  },
  cineBadgeTitle: {
    fontFamily: T.fontDisplay,
    fontSize: 20,
    letterSpacing: '0.14em',
    fontWeight: 800,
    textTransform: 'uppercase',
    lineHeight: 1.1,
  },
  cineBadgeSub: {
    fontFamily: T.fontMono,
    fontSize: 9,
    letterSpacing: '0.18em',
    fontWeight: 500,
    textTransform: 'uppercase',
    marginTop: 6,
    opacity: 0.75,
  },
  cineFlashRed: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(255,59,59,0.25) 0%, transparent 60%)',
    animation: 'redPulse 1s ease-in-out infinite',
    pointerEvents: 'none',
  },

  // ─── Tactical (Walkaround) ───────────────────────────────────────────
  tacticalContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/11',
    minHeight: 200,
    overflow: 'hidden',
    borderRadius: 10,
    border: `1px solid ${T.border2}`,
    backgroundColor: '#000',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
  },
  tacticalAmbientVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.35,
    filter: 'blur(6px) saturate(0.7)',
    zIndex: 0,
  },
  tacticalVideoDim: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)',
    zIndex: 1,
  },
  tacticalTruckImage: {
    position: 'absolute',
    inset: 6,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    zIndex: 2,
  },
  tacticalZoneLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    padding: '4px 8px 5px',
    background: 'rgba(0,0,0,0.72)',
    border: `1px solid ${T.amberDim}`,
    borderLeft: `2px solid ${T.amber}`,
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    zIndex: 10,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  tacticalZoneEyebrow: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.text3,
    letterSpacing: '0.14em',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  tacticalZoneName: {
    fontFamily: T.fontDisplay,
    fontSize: 11,
    color: T.amberSoft,
    letterSpacing: '0.1em',
    fontWeight: 700,
    textTransform: 'uppercase',
  },

  // Zone hotspot dot (on truck)
  zoneHotspot: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: '50%',
    border: '1.5px solid',
    transition: 'all 600ms ease',
    pointerEvents: 'none',
    zIndex: 3,
  },
  // Defect marker (lands with animation when finding emitted)
  defectMarker: {
    position: 'absolute',
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: '50%',
    border: '1.5px solid rgba(0,0,0,0.6)',
    zIndex: 5,
    pointerEvents: 'auto',
    cursor: 'help',
  },
  // Officer sprite on tactical view
  officerSprite: {
    position: 'absolute',
    transform: 'translate(-50%, -85%)',
    transition: 'left 900ms cubic-bezier(0.4, 0.0, 0.2, 1), top 900ms cubic-bezier(0.4, 0.0, 0.2, 1)',
    zIndex: 6,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))',
  },

  // ─── Windshield POV (non-walkaround phases) ──────────────────────────
  windshieldPov: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 2,
  },
  beamOverlay: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '140%',
    height: '40%',
    background: 'radial-gradient(ellipse at center top, rgba(255,240,200,0.65) 0%, rgba(255,240,200,0.2) 40%, transparent 70%)',
    pointerEvents: 'none',
    transition: 'opacity 260ms ease, filter 260ms ease',
  },
  flasherCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: T.amber,
    boxShadow: `0 0 10px ${T.amberGlow}`,
  },
  signalArrow: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    filter: `drop-shadow(0 0 6px ${T.amberGlow})`,
  },
  brakeGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    background: 'linear-gradient(180deg, transparent 0%, rgba(255,59,59,0.2) 60%, rgba(255,59,59,0.5) 100%)',
    animation: 'brakePulse 800ms ease-in-out infinite',
    pointerEvents: 'none',
  },
  povOfficerWindow: {
    position: 'absolute',
    top: '6%',
    right: '-4%',
    width: '42%',
    height: '70%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderRadius: 6,
    opacity: 0.78,
    pointerEvents: 'none',
    filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.45))',
    maskImage: 'radial-gradient(ellipse at 40% 50%, black 55%, transparent 85%)',
    WebkitMaskImage: 'radial-gradient(ellipse at 40% 50%, black 55%, transparent 85%)',
  },
  controlHint: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(0,0,0,0.72)',
    border: `1px solid ${T.amberDim}`,
    borderRadius: 14,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  controlHintPulse: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: T.amber,
    boxShadow: `0 0 8px ${T.amberGlow}`,
    animation: 'recDot 1s ease-in-out infinite',
  },
  controlHintText: {
    fontFamily: T.fontMono,
    fontSize: 8,
    color: T.amberSoft,
    letterSpacing: '0.16em',
    fontWeight: 600,
    textTransform: 'uppercase',
  },

  // ─── Finding pop (enhanced findings row) ─────────────────────────────
  findingPopRow: {
    borderLeft: '2px solid',
    paddingLeft: 6,
    animation: 'findingPopIn 450ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // ─── Debug ribbon (dev mode only) ────────────────────────────────────
  debugRibbon: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.75)',
    borderTop: `1px solid ${T.amberDim}`,
    fontFamily: T.fontMono,
    fontSize: 10,
    color: T.text2,
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
    zIndex: 30,
    letterSpacing: '0.04em',
  },

  // ─── PHASE 5: OUTCOME SCREENS ─────────────────────────────────────────
  // Base modal overlay shared by all four outcome screens. Theme overlays
  // (clean/citation/oos/knowingly) add their tint and accent color.

  outcomeScreen: {
    position: 'absolute',
    inset: 0,
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '28px 20px 24px',
    overflowY: 'auto',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    animation: 'outcomeFadeIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
  },
  outcomeScreenClean: {
    background: 'radial-gradient(ellipse at 50% 30%, rgba(34, 130, 60, 0.38) 0%, rgba(5, 20, 10, 0.96) 70%)',
  },
  outcomeScreenCitation: {
    background: 'radial-gradient(ellipse at 50% 30%, rgba(200, 140, 30, 0.30) 0%, rgba(20, 14, 5, 0.96) 70%)',
  },
  outcomeScreenOOS: {
    background: 'radial-gradient(ellipse at 50% 30%, rgba(200, 40, 40, 0.34) 0%, rgba(30, 5, 5, 0.97) 70%)',
  },
  outcomeScreenKnowingly: {
    background: 'radial-gradient(ellipse at 50% 25%, rgba(220, 30, 30, 0.45) 0%, rgba(35, 3, 3, 0.98) 65%)',
  },

  outcomeHeader: {
    textAlign: 'center',
    marginBottom: 14,
    zIndex: 2,
  },
  outcomeEyebrowGreen: {
    fontFamily: T.fontMono,
    fontSize: 10,
    letterSpacing: '0.22em',
    color: '#44FF88',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: 600,
  },
  outcomeEyebrowAmber: {
    fontFamily: T.fontMono,
    fontSize: 10,
    letterSpacing: '0.22em',
    color: T.amber,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: 600,
  },
  outcomeEyebrowRed: {
    fontFamily: T.fontMono,
    fontSize: 10,
    letterSpacing: '0.22em',
    color: '#FF6666',
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: 700,
  },
  outcomeTitleClean: {
    fontFamily: T.fontDisplay,
    fontSize: 28,
    letterSpacing: '0.14em',
    color: '#BEFFD1',
    fontWeight: 800,
    textShadow: '0 0 24px rgba(68, 255, 136, 0.4)',
  },
  outcomeTitleCitation: {
    fontFamily: T.fontDisplay,
    fontSize: 26,
    letterSpacing: '0.14em',
    color: T.amberSoft,
    fontWeight: 800,
    textShadow: '0 0 20px rgba(255, 176, 32, 0.35)',
  },
  outcomeTitleOOS: {
    fontFamily: T.fontDisplay,
    fontSize: 26,
    letterSpacing: '0.16em',
    color: '#FFB0B0',
    fontWeight: 800,
    textShadow: '0 0 22px rgba(255, 59, 59, 0.5)',
  },

  // Clean pass ripple — expanding green ring
  outcomeRipple: {
    position: 'absolute',
    top: '18%',
    left: '50%',
    width: 10,
    height: 10,
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    border: '2px solid rgba(68, 255, 136, 0.6)',
    pointerEvents: 'none',
    zIndex: 1,
    animation: 'cleanRipple 1400ms cubic-bezier(0, 0.55, 0.45, 1) both',
  },
  // OOS red flash — brief red overlay on mount
  outcomeFlashRed: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255, 40, 40, 0.5)',
    pointerEvents: 'none',
    zIndex: 1,
    animation: 'flashRed 700ms ease-out forwards',
  },
  outcomeFlashRedIntense: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255, 20, 20, 0.75)',
    pointerEvents: 'none',
    zIndex: 1,
    animation: 'flashRedIntense 900ms ease-out forwards',
  },

  // ─── CVSA DECAL ─────────────────────────────────────────────────────
  cvsaDecalWrap: {
    position: 'relative',
    width: 170,
    height: 190,
    margin: '12px 0 18px',
    zIndex: 2,
  },
  cvsaDecalStamp: {
    position: 'absolute',
    inset: 0,
    animation: 'decalStamp 800ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
    filter: 'drop-shadow(0 4px 14px rgba(0, 0, 0, 0.55))',
  },
  cvsaDecalGlow: {
    position: 'absolute',
    inset: -12,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(68, 255, 136, 0.35) 0%, rgba(68, 255, 136, 0) 70%)',
    pointerEvents: 'none',
    zIndex: -1,
    animation: 'decalGlow 2600ms ease-in-out infinite',
  },
  cvsaDecalValidBadge: {
    position: 'absolute',
    bottom: -8,
    right: -12,
    background: '#0b3a1e',
    color: '#BEFFD1',
    border: '1.5px solid #66C97A',
    padding: '5px 8px',
    borderRadius: 6,
    fontFamily: T.fontMono,
    fontWeight: 700,
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  },
  cvsaDecalValidLabel: {
    fontSize: 7,
    letterSpacing: '0.16em',
    color: '#66C97A',
    marginBottom: 1,
  },
  cvsaDecalValidDays: {
    fontSize: 11,
    letterSpacing: '0.08em',
    color: '#BEFFD1',
  },

  // ─── STATS BLOCK ─────────────────────────────────────────────────────
  outcomeStatsBlock: {
    width: '100%',
    maxWidth: 380,
    background: 'rgba(8, 10, 14, 0.7)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 14,
    zIndex: 2,
  },
  outcomeStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: `1px dashed ${T.border1}`,
    fontFamily: T.fontMono,
  },
  outcomeStatLabel: {
    fontSize: 10,
    letterSpacing: '0.14em',
    color: T.text3,
    textTransform: 'uppercase',
  },
  outcomeStatValue: {
    fontSize: 13,
    fontWeight: 600,
    color: T.text1,
  },
  outcomeStatValueClean: {
    fontSize: 13,
    fontWeight: 700,
    color: '#66C97A',
  },
  outcomeStatValueWarn: {
    fontSize: 13,
    fontWeight: 700,
    color: T.amber,
  },
  outcomeStatValueRed: {
    fontSize: 13,
    fontWeight: 700,
    color: '#FF8585',
  },

  // ─── FINE LIST (citation + OOS) ──────────────────────────────────────
  outcomeFineList: {
    width: '100%',
    maxWidth: 380,
    background: 'rgba(8, 10, 14, 0.7)',
    border: `1px solid ${T.border2}`,
    borderRadius: 10,
    padding: '8px 10px',
    marginBottom: 14,
    zIndex: 2,
  },
  outcomeFineHeader: {
    fontFamily: T.fontMono,
    fontSize: 10,
    letterSpacing: '0.16em',
    color: T.amber,
    textTransform: 'uppercase',
    padding: '4px 4px 8px',
    borderBottom: `1px solid ${T.border1}`,
    marginBottom: 4,
    fontWeight: 600,
  },
  outcomeFineRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    padding: '7px 4px',
    borderBottom: `1px dashed ${T.border1}`,
  },
  outcomeFineCellLabel: {
    flex: 1,
    minWidth: 0,
  },
  outcomeFineLabelText: {
    fontFamily: T.fontBody,
    fontSize: 12,
    color: T.text1,
    lineHeight: 1.3,
  },
  outcomeFineCfr: {
    fontFamily: T.fontMono,
    fontSize: 9,
    color: T.text3,
    marginTop: 2,
    letterSpacing: '0.06em',
  },
  outcomeFineCellAmount: {
    fontFamily: T.fontMono,
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
  },
  outcomeFineTotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 4px',
    borderTop: `2px solid ${T.border2}`,
    marginTop: 4,
  },
  outcomeFineTotalLabel: {
    fontFamily: T.fontMono,
    fontSize: 11,
    letterSpacing: '0.18em',
    color: T.text2,
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  outcomeFineTotalAmount: {
    fontFamily: T.fontDisplay,
    fontSize: 18,
    fontWeight: 800,
    color: T.text1,
  },

  // ─── OOS STICKER ─────────────────────────────────────────────────────
  outcomeOOSSticker: {
    position: 'relative',
    width: 180,
    height: 110,
    margin: '0 0 14px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: '2px solid #FF3B3B',
    borderRadius: 4,
    boxShadow: '0 0 22px rgba(255, 59, 59, 0.4), inset 0 0 18px rgba(0, 0, 0, 0.5)',
    zIndex: 2,
  },
  outcomeOOSStickerOverlay: {
    position: 'absolute',
    bottom: -11,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#0c0305',
    border: '1.5px solid #FF3B3B',
    padding: '5px 11px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
  outcomeOOSStickerText: {
    fontFamily: T.fontMono,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.16em',
    color: '#FF8585',
  },

  // ─── KNOWINGLY STAMP ─────────────────────────────────────────────────
  knowinglyStampWrap: {
    position: 'relative',
    marginBottom: 18,
    zIndex: 2,
  },
  knowinglyStamp: {
    border: '3px solid #FF3B3B',
    padding: '10px 22px',
    transform: 'rotate(-7deg)',
    fontFamily: T.fontDisplay,
    color: '#FFB0B0',
    textAlign: 'center',
    background: 'rgba(50, 4, 4, 0.85)',
    boxShadow: '0 0 22px rgba(255, 40, 40, 0.35)',
    animation: 'knowinglyStamp 700ms cubic-bezier(0.2, 1, 0.3, 1.4) both',
  },
  knowinglyStampText: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '0.18em',
    lineHeight: 1.05,
  },
  knowinglyStampCfr: {
    fontFamily: T.fontMono,
    fontSize: 9,
    letterSpacing: '0.2em',
    color: '#FF8585',
    marginTop: 4,
  },

  // ─── CONSEQUENCE GRID ────────────────────────────────────────────────
  consequenceGrid: {
    width: '100%',
    maxWidth: 380,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    marginBottom: 14,
    zIndex: 2,
  },
  consequenceCell: {
    background: 'rgba(35, 4, 4, 0.7)',
    border: '1px solid rgba(255, 59, 59, 0.35)',
    borderRadius: 6,
    padding: '8px 10px',
  },
  consequenceCellWide: {
    gridColumn: '1 / -1',
    background: 'rgba(35, 4, 4, 0.6)',
    border: '1px dashed rgba(255, 59, 59, 0.35)',
    borderRadius: 6,
    padding: '7px 10px',
  },
  consequenceLabel: {
    fontFamily: T.fontMono,
    fontSize: 9,
    letterSpacing: '0.14em',
    color: '#FFA8A8',
    textTransform: 'uppercase',
    marginBottom: 3,
    fontWeight: 600,
  },
  consequenceAmountRed: {
    fontFamily: T.fontMono,
    fontSize: 14,
    fontWeight: 700,
    color: '#FF8585',
  },
  consequenceAmountRedLarge: {
    fontFamily: T.fontDisplay,
    fontSize: 18,
    fontWeight: 800,
    color: '#FFB0B0',
  },
  consequenceDurationText: {
    fontFamily: T.fontBody,
    fontSize: 11,
    color: T.text2,
    lineHeight: 1.35,
  },

  // ─── OUTCOME MESSAGE + CONTINUE BUTTON ───────────────────────────────
  outcomeMessage: {
    maxWidth: 380,
    fontFamily: T.fontBody,
    fontSize: 13,
    color: T.text2,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 1.4,
    marginBottom: 16,
    padding: '0 10px',
    zIndex: 2,
  },
  outcomeContinueBtn: {
    minWidth: 200,
    minHeight: 48,
    padding: '12px 26px',
    border: 'none',
    borderRadius: 8,
    fontFamily: T.fontDisplay,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    WebkitTapHighlightColor: 'transparent',
    transition: 'transform 120ms ease, box-shadow 200ms ease, opacity 300ms ease',
    zIndex: 2,
  },
  outcomeContinueBtnClean: {
    background: 'linear-gradient(180deg, #35A955 0%, #1C7A3A 100%)',
    color: '#FFFFFF',
    boxShadow: '0 0 18px rgba(68, 255, 136, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  outcomeContinueBtnAmber: {
    background: 'linear-gradient(180deg, #E89920 0%, #A66412 100%)',
    color: '#FFFFFF',
    boxShadow: '0 0 18px rgba(255, 176, 32, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  outcomeContinueBtnRed: {
    background: 'linear-gradient(180deg, #C62A2A 0%, #7A1313 100%)',
    color: '#FFFFFF',
    boxShadow: '0 0 20px rgba(255, 59, 59, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
};

// Keyframes — injected as a single <style> tag inside the component root.
const animationCSS = `
  @keyframes outcomeFadeIn {
    from { opacity: 0; transform: scale(0.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes recDot {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
  }
  @keyframes timerWarn {
    from { box-shadow: 0 0 3px rgba(255,59,59,0.4); }
    to   { box-shadow: 0 0 10px rgba(255,59,59,0.9); }
  }
  /* Phase 2 animations */
  @keyframes speechFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes docPulse {
    0%, 100% { box-shadow: 0 0 14px rgba(255,176,32,0.45), inset 0 0 0 1px #FFB020; }
    50%      { box-shadow: 0 0 22px rgba(255,176,32,0.75), inset 0 0 0 1px #FFB020; }
  }
  @keyframes ctrlPulse {
    0%, 100% { box-shadow: 0 0 12px rgba(255,176,32,0.45), inset 0 0 0 1px #FFB020; }
    50%      { box-shadow: 0 0 20px rgba(255,176,32,0.8),  inset 0 0 0 1px #FFB020; }
  }
  @keyframes secondaryReveal {
    from { opacity: 0; transform: translateY(-4px); max-height: 0; }
    to   { opacity: 1; transform: translateY(0);    max-height: 200px; }
  }
  @keyframes eldBlink {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.3; }
  }
  @keyframes eldProgress {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes walkDotBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40%           { transform: translateY(-6px); opacity: 1; }
  }
  @keyframes waitingDotPulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40%           { opacity: 1;   transform: scale(1); }
  }
  /* Phase 4 animations — cinematic, tactical, windshield POV */
  @keyframes redPulse {
    0%, 100% { opacity: 0.4; }
    50%      { opacity: 0.9; }
  }
  @keyframes redFlash {
    0%, 100% { background-color: rgba(0,0,0,0.72); }
    50%      { background-color: rgba(60,0,0,0.85); }
  }
  @keyframes zonePulse {
    0%, 100% { transform: scale(1);   box-shadow: 0 0 14px rgba(255,176,32,0.6); }
    50%      { transform: scale(1.3); box-shadow: 0 0 22px rgba(255,176,32,0.95); }
  }
  @keyframes defectLand {
    0%   { transform: scale(0) translateY(-10px); opacity: 0; }
    60%  { transform: scale(1.4) translateY(0);   opacity: 1; }
    100% { transform: scale(1) translateY(0);     opacity: 0.92; }
  }
  @keyframes findingPopIn {
    0%   { transform: translateX(-6px) scale(0.9); opacity: 0; }
    60%  { transform: translateX(2px)  scale(1.03); opacity: 1; }
    100% { transform: translateX(0)    scale(1);   opacity: 1; }
  }
  @keyframes flasherBlink {
    0%, 49%  { opacity: 1; }
    50%, 100% { opacity: 0.15; }
  }
  @keyframes signalBlink {
    0%, 49%   { opacity: 1; filter: drop-shadow(0 0 8px rgba(255,176,32,0.9)); }
    50%, 100% { opacity: 0.15; filter: drop-shadow(0 0 2px rgba(255,176,32,0.3)); }
  }
  @keyframes brakePulse {
    0%, 100% { opacity: 0.75; }
    50%      { opacity: 1; }
  }

  /* ─── PHASE 5 OUTCOME SCREEN KEYFRAMES ─── */
  @keyframes decalStamp {
    0%   { transform: scale(1.55) rotate(-8deg); opacity: 0; }
    55%  { transform: scale(0.92) rotate(1.5deg); opacity: 1; }
    78%  { transform: scale(1.03) rotate(-0.6deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes decalGlow {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50%      { opacity: 0.85; transform: scale(1.08); }
  }
  @keyframes cleanRipple {
    0%   { width: 10px; height: 10px; opacity: 0.85; border-width: 3px; }
    100% { width: 420px; height: 420px; opacity: 0; border-width: 1px; }
  }
  @keyframes knowinglyStamp {
    0%   { transform: scale(2.2) rotate(-14deg); opacity: 0; }
    45%  { transform: scale(0.88) rotate(-5deg); opacity: 1; }
    70%  { transform: scale(1.04) rotate(-7.5deg); }
    100% { transform: scale(1) rotate(-7deg); }
  }
  @keyframes flashRed {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes flashRedIntense {
    0%   { opacity: 1; }
    15%  { opacity: 0.85; }
    35%  { opacity: 0.5; }
    100% { opacity: 0; }
  }

  /* ─── PHASE 6: REDUCED MOTION ACCESSIBILITY ─── */
  /* Users who have enabled "Reduce Motion" in their OS (macOS, iOS, Android,
     Windows) get a near-instant transition/animation experience. Per WCAG
     2.3.3 this prevents vestibular trigger for the ~30% of users with
     motion sensitivity. We keep content visible — animations still "run"
     for 0.01ms — but no longer move, pulse, or flash.
     This is a global override; it applies to every animation and transition
     inside the component, including cinematic videos (which browsers also
     honor for reduced-motion via their own autoplay logic). */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default React.memo(DOTInspection);
