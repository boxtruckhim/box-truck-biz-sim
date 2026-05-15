/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Audio Calibration Studio v3 (Live Preview Edition)
 * src/CalibrationStudio.jsx
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Major upgrades over v2:
 *   • LIVE CINEMATIC PREVIEW — mount the real Act component, watch the
 *     animation play, see exactly when each audio cue fires relative to
 *     the visuals.
 *   • PLAY / STOP / RESTART controls — drives both visuals + audio
 *     scheduler from a single RAF clock.
 *   • LIVE TIMELINE — playhead glides along the timeline as the act plays,
 *     cue markers light up as they fire, easy to see timing relationships.
 *   • EXPORT VERIFIED — every download includes a structural validity check
 *     that confirms ACT_CUES_BY_KEY has all 13 keys, ALL_AUDIO_MANIFEST has
 *     correct { category, file } objects (the v2 bug), and the generated
 *     code parses as valid JavaScript. Status badge shows ✓ or ✗ before you
 *     ever click Download.
 *
 * How to use:
 *   1. Drop this file into src/CalibrationStudio.jsx (replaces v2)
 *   2. App.jsx already has the URL-param trigger from before
 *   3. Visit http://localhost:5173/?calibrate=true
 *   4. Pick an act → click ▶ Play → watch + listen
 *   5. Edit cues. Click ▶ Play again to verify changes.
 *   6. When done, expand Export → confirm ✓ VALID badge → Download
 *   7. Replace src/welcomeModalAudioConfig.js with the downloaded file
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// ─── Import the actual Act components for live preview ──────────────────────
import Act1_ColdOpen              from '../welcome_modal/act1/Act1_ColdOpen.jsx';
import Act2_TitleDrop             from '../welcome_modal/act2/Act2_TitleDrop.jsx';
import Act3_MissedCall            from '../welcome_modal/act3/Act3_MissedCall.jsx';
import Act4_TheMentor             from '../welcome_modal/act4/Act4_TheMentor.jsx';
import Act5_TheScore              from '../welcome_modal/act5/Act5_TheScore.jsx';
import Act6_GameplayMontage       from '../welcome_modal/act6/Act6_GameplayMontage.jsx';
import Act7_Decisions             from '../welcome_modal/act7/Act7_Decisions.jsx';
import Act8_TheJob                from '../welcome_modal/act8/Act8_TheJob.jsx';
import Act8_5_TheChoice           from '../welcome_modal/act8_5/Act8_5_TheChoice.jsx';
import Act9_TheLongGame           from '../welcome_modal/act9/Act9_TheLongGame.jsx';
import Act10_ThePromise           from '../welcome_modal/act10/Act10_ThePromise.jsx';
import Act11_TheCompliancePromise from '../welcome_modal/act11/Act11_TheCompliancePromise.jsx';
import Act12_Launch               from '../welcome_modal/act12/Act12_Launch.jsx';

const ACT_COMPONENTS = {
  '1': Act1_ColdOpen, '2': Act2_TitleDrop, '3': Act3_MissedCall,
  '4': Act4_TheMentor, '5': Act5_TheScore, '6': Act6_GameplayMontage,
  '7': Act7_Decisions, '8': Act8_TheJob, '8_5': Act8_5_TheChoice,
  '9': Act9_TheLongGame, '10': Act10_ThePromise,
  '11': Act11_TheCompliancePromise, '12': Act12_Launch,
};

// ─── Asset paths (same as WelcomeModal — for visual props) ──────────────────
const BASE = '/welcome_modal_assets';
const ASSETS = {
  act1: { terminalYard: `${BASE}/act1_terminal_yard.png` },
  act3: { woodTexture: `${BASE}/wood_grain.jpg` },
  act4: {
    cbRadio:   `${BASE}/act4_cbradio.png`,
    paperwork: `${BASE}/act4_paperwork.png`,
    wide:      `${BASE}/act4_wide.png`,
  },
  act6: {
    flash1Engine:     `${BASE}/act6_engine.png`,
    flash2POV:        `${BASE}/act6_pov.png`,
    flash3Inspection: `${BASE}/act6_inspection.png`,
    flash5Liftgate:   `${BASE}/act6_liftgate.png`,
    truckTop:         `${BASE}/act6_dock.png`,
  },
  act7: {
    flash2Driver: `${BASE}/act7_driver.png`,
    flash3Truck:  `${BASE}/act7_truck.png`,
    mapBg:        `${BASE}/act7_dispatch.jpeg`,
  },
  act8: {
    midnightRun:  `${BASE}/act8_midnight_run.jpeg`,
    stormyNight:  `${BASE}/act8_stormy_night.png`,
    dotInspector: `${BASE}/act8_dot_inspector.png`,
  },
  act10: { xrayTruck: `${BASE}/act10_xray_truck.png` },
  act11: { cork: `${BASE}/cork_optimized.jpg` },
  act12: {
    handoff: `${BASE}/handoff_optimized.jpg`,
    hero:    `${BASE}/coastal_optimized.jpg`,
  },
};

// ─── Audio file URL resolution ──────────────────────────────────────────────
function resolveAudioUrl(filename) {
  if (!filename) return null;
  if (filename.startsWith('marcus_')) return `/audio/marcus/welcome/${filename}`;
  if (filename.startsWith('music_'))  return `/audio/music/welcome/${filename}`;
  if (filename.startsWith('sfx_'))    return `/audio/sfx/welcome/${filename}`;
  return `/audio/${filename}`;
}

function categoryForFile(filename) {
  if (filename.startsWith('marcus_')) return 'marcus';
  if (filename.startsWith('music_'))  return 'music';
  if (filename.startsWith('sfx_'))    return 'sfx';
  return null; // shouldn't happen — used for validation
}

// ─── Available files for dropdowns ──────────────────────────────────────────
const AVAILABLE_FILES = {
  music: [
    'music_predawn_yard.mp3', 'music_voicemail.mp3', 'music_csa_score.mp3',
    'music_curriculum.mp3', 'music_despair_to_hope.mp3', 'music_launch.mp3',
  ],
  marcus: [
    'marcus_act4_01_hey_marcus.mp3','marcus_act4_02_dispatching_23_years.mp3',
    'marcus_act4_03_rich_or_broke.mp3','marcus_act4_04_first_ninety_days.mp3',
    'marcus_act4_05_log_in_tomorrow.mp3','marcus_act4_06_pick_up_the_phone.mp3',
    'marcus_act4_07_prepare_yourself.mp3',
    'marcus_act5_01_not_what_hurts.mp3','marcus_act5_02_csa_score_takes_hit.mp3',
    'marcus_act5_03_insurance_premium.mp3','marcus_act5_04_brokers_stop_calling.mp3',
    'marcus_act5_05_lose_your_MC.mp3','marcus_act5_06_two_years.mp3',
    'marcus_act6_01_catch_on_dipstick.mp3','marcus_act6_02_react_in_the_moment.mp3',
    'marcus_act6_03_pass_DOT_inspections.mp3','marcus_act6_04_back_into_the_dock.mp3',
    'marcus_act6_05_operate_the_liftgate.mp3',
    'marcus_act7_01_negotiate_with_brokers.mp3','marcus_act7_02_hire_right_drivers_KYP.mp3',
    'marcus_act7_03_strategic_about_every_truck.mp3','marcus_act7_04_run_company_efficiently.mp3',
    'marcus_act8_01_truck_breaks_you_break.mp3','marcus_act8_02_both.mp3',
    'marcus_act8_03_how_you_respond.mp3',
    'marcus_act8_5_01_not_for_the_weak.mp3','marcus_act8_5_02_resilient_resourceful.mp3',
    'marcus_act8_5_03_in_your_corner.mp3',
    'marcus_act9_01_one_becomes_three.mp3','marcus_act9_02_becomes_a_fleet.mp3',
    'marcus_act9_03_name_in_this_industry.mp3',
    'marcus_act11_01_not_forgiving.mp3','marcus_act11_02_life_savings_dozen_ways.mp3',
    'marcus_act11_03_face_all_of_them.mp3',
    'marcus_act12_01_keys_are_yours.mp3','marcus_act12_02_keep_it_safe.mp3',
    'marcus_act12_03_road_been_waiting.mp3','marcus_act12_04_hustle_in_motion.mp3',
  ],
  sfx: [
    'sfx_phone_notification.mp3','sfx_csa_stamp_01.mp3','sfx_csa_stamp_02.mp3',
    'sfx_csa_stamp_03.mp3','sfx_csa_stamp_730_days.mp3','sfx_rain_ambience.mp3',
    'sfx_bay_door_rumble.mp3','sfx_compliance_stamp.mp3','sfx_truck_ignition.mp3',
  ],
  synth: ['paper_rustle','decision_strike','xray_pulse'],
};

// ─── Act metadata ───────────────────────────────────────────────────────────
const ACT_META = {
  '1':   { name: 'Cold Open',              duration:  6000 },
  '2':   { name: 'Title Drop',             duration:  4500 },
  '3':   { name: 'Missed Call',            duration:  4500 },
  '4':   { name: 'The Mentor (Voicemail)', duration: 22500 },
  '5':   { name: 'The Score (CSA)',        duration: 22000 },
  '6':   { name: 'Gameplay Montage',       duration: 22000 },
  '7':   { name: 'Decisions',              duration: 19000 },
  '8':   { name: 'The Job (Rain)',         duration: 16000 },
  '8_5': { name: 'The Choice',             duration:  8200 },
  '9':   { name: 'The Long Game',          duration: 18500 },
  '10':  { name: 'The Promise (X-ray)',    duration: 10000 },
  '11':  { name: 'Compliance Promise',     duration: 12500 },
  '12':  { name: 'Launch (Day 1)',         duration: 10000 },
};

const ACT_ORDER = ['1','2','3','4','5','6','7','8','8_5','9','10','11','12'];

// ─── DEFAULT_CONFIG — mirrors current welcomeModalAudioConfig.js ────────────
const DEFAULT_CONFIG = {
  music: [
    { file: 'music_predawn_yard.mp3',    spansActs: ['1','2','3'],          actVolumes: {'1':0.40,'2':0.40,'3':0.40},               fadeInMs:1000, fadeOutMs:600 },
    { file: 'music_voicemail.mp3',       spansActs: ['4'],                  actVolumes: {'4':0.40},                                  fadeInMs: 600, fadeOutMs:600 },
    { file: 'music_csa_score.mp3',       spansActs: ['5'],                  actVolumes: {'5':0.50},                                  fadeInMs: 600, fadeOutMs:600 },
    { file: 'music_curriculum.mp3',      spansActs: ['6','7'],              actVolumes: {'6':0.45,'7':0.50},                         fadeInMs: 600, fadeOutMs:600 },
    { file: 'music_despair_to_hope.mp3', spansActs: ['8','8_5','9','10'],   actVolumes: {'8':0.07,'8_5':0.25,'9':0.60,'10':0.60},   fadeInMs:1000, fadeOutMs:1000 },
    { file: 'music_launch.mp3',          spansActs: ['12'],                 actVolumes: {'12':0.65},                                 fadeInMs: 800, fadeOutMs:0 },
  ],
  acts: {
    '1':   { vo: [], sfx: [] },
    '2':   { vo: [], sfx: [] },
    '3':   { vo: [], sfx: [
      { startMs: 1800, file: 'sfx_phone_notification.mp3', volume: 0.75 },
    ]},
    '4':   { vo: [
      { startMs:   800, endMs:  2400, file: 'marcus_act4_01_hey_marcus.mp3',           volume: 1.0 },
      { startMs:  2900, endMs:  5500, file: 'marcus_act4_02_dispatching_23_years.mp3', volume: 1.0 },
      { startMs:  6000, endMs:  9700, file: 'marcus_act4_03_rich_or_broke.mp3',        volume: 1.0 },
      { startMs: 10200, endMs: 13800, file: 'marcus_act4_04_first_ninety_days.mp3',    volume: 1.0 },
      { startMs: 14200, endMs: 15800, file: 'marcus_act4_05_log_in_tomorrow.mp3',      volume: 1.0 },
      { startMs: 16100, endMs: 17900, file: 'marcus_act4_06_pick_up_the_phone.mp3',    volume: 1.0 },
      { startMs: 19500, endMs: 22500, file: 'marcus_act4_07_prepare_yourself.mp3',     volume: 1.0 },
    ], sfx: [
      { startMs: 200, file: 'sfx_phone_notification.mp3', volume: 0.55 },
    ]},
    '5':   { vo: [
      { startMs:   600, endMs:  3780, file: 'marcus_act5_01_not_what_hurts.mp3',       volume: 1.0 },
      { startMs:  4180, endMs:  7710, file: 'marcus_act5_02_csa_score_takes_hit.mp3',  volume: 1.0 },
      { startMs:  8110, endMs:  9870, file: 'marcus_act5_03_insurance_premium.mp3',    volume: 1.0 },
      { startMs: 10270, endMs: 12740, file: 'marcus_act5_04_brokers_stop_calling.mp3', volume: 1.0 },
      { startMs: 13140, endMs: 16670, file: 'marcus_act5_05_lose_your_MC.mp3',         volume: 1.0 },
      { startMs: 17070, endMs: 20600, file: 'marcus_act5_06_two_years.mp3',            volume: 1.0 },
    ], sfx: [
      { startMs:  7400, file: 'sfx_csa_stamp_01.mp3',       volume: 0.65 },
      { startMs: 12500, file: 'sfx_csa_stamp_02.mp3',       volume: 0.65 },
      { startMs: 16400, file: 'sfx_csa_stamp_03.mp3',       volume: 0.65 },
      { startMs: 20400, file: 'sfx_csa_stamp_730_days.mp3', volume: 0.80 },
    ]},
    '6':   { vo: [
      { startMs:   400, endMs:  4000, file: 'marcus_act6_01_catch_on_dipstick.mp3',   volume: 1.0 },
      { startMs:  4800, endMs:  8400, file: 'marcus_act6_02_react_in_the_moment.mp3', volume: 1.0 },
      { startMs:  9200, endMs: 12800, file: 'marcus_act6_03_pass_DOT_inspections.mp3',volume: 1.0 },
      { startMs: 13600, endMs: 17200, file: 'marcus_act6_04_back_into_the_dock.mp3',  volume: 1.0 },
      { startMs: 18000, endMs: 21600, file: 'marcus_act6_05_operate_the_liftgate.mp3',volume: 1.0 },
    ], sfx: [] },
    '7':   { vo: [
      { startMs:   400, endMs:  4600, file: 'marcus_act7_01_negotiate_with_brokers.mp3',       volume: 1.0 },
      { startMs:  5400, endMs:  9600, file: 'marcus_act7_02_hire_right_drivers_KYP.mp3',       volume: 1.0 },
      { startMs: 10400, endMs: 14600, file: 'marcus_act7_03_strategic_about_every_truck.mp3',  volume: 1.0 },
      { startMs: 15400, endMs: 18600, file: 'marcus_act7_04_run_company_efficiently.mp3',     volume: 1.0 },
    ], sfx: [
      { startMs:     0, synth: 'decision_strike', params: { variant: 1 }, volume: 0.70 },
      { startMs:  5000, synth: 'decision_strike', params: { variant: 2 }, volume: 0.75 },
      { startMs: 10000, synth: 'decision_strike', params: { variant: 3 }, volume: 0.80 },
      { startMs: 15000, synth: 'decision_strike', params: { variant: 4 }, volume: 0.85 },
    ]},
    '8':   { vo: [
      { startMs:   600, endMs:  4500, file: 'marcus_act8_01_truck_breaks_you_break.mp3', volume: 1.0 },
      { startMs:  5400, endMs:  6900, file: 'marcus_act8_02_both.mp3',                    volume: 1.0 },
      { startMs: 10300, endMs: 14500, file: 'marcus_act8_03_how_you_respond.mp3',         volume: 1.0 },
    ], sfx: [
      { startMs: 0, endMs: 16000, file: 'sfx_rain_ambience.mp3', volume: 0.55 },
    ]},
    '8_5': { vo: [
      { startMs:  200, endMs: 2200, file: 'marcus_act8_5_01_not_for_the_weak.mp3',      volume: 1.0 },
      { startMs: 2400, endMs: 4400, file: 'marcus_act8_5_02_resilient_resourceful.mp3', volume: 1.0 },
      { startMs: 4600, endMs: 7600, file: 'marcus_act8_5_03_in_your_corner.mp3',        volume: 1.0 },
    ], sfx: [] },
    '9':   { vo: [
      { startMs:  1800, endMs:  3700, file: 'marcus_act9_01_one_becomes_three.mp3',     volume: 1.0 },
      { startMs:  8000, endMs: 10500, file: 'marcus_act9_02_becomes_a_fleet.mp3',       volume: 1.0 },
      { startMs: 10500, endMs: 15700, file: 'marcus_act9_03_name_in_this_industry.mp3', volume: 1.0 },
    ], sfx: [
      { startMs: 500, file: 'sfx_bay_door_rumble.mp3', volume: 0.65 },
    ]},
    '10':  { vo: [], sfx: [
      { startMs: 2000, synth: 'xray_pulse', volume: 0.55 },
    ]},
    '11':  { vo: [
      { startMs:   200, endMs:  2700, file: 'marcus_act11_01_not_forgiving.mp3',           volume: 1.0 },
      { startMs:  2900, endMs:  7500, file: 'marcus_act11_02_life_savings_dozen_ways.mp3', volume: 1.0 },
      { startMs:  7800, endMs: 12000, file: 'marcus_act11_03_face_all_of_them.mp3',        volume: 1.0 },
    ], sfx: [
      { startMs: 1500,  synth: 'paper_rustle', volume: 0.55 },
      { startMs: 2000,  file:  'sfx_compliance_stamp.mp3', volume: 0.75 },
      { startMs: 5500,  synth: 'paper_rustle', volume: 0.55 },
      { startMs: 6000,  file:  'sfx_compliance_stamp.mp3', volume: 0.75 },
      { startMs: 9500,  synth: 'paper_rustle', volume: 0.55 },
      { startMs: 10000, file:  'sfx_compliance_stamp.mp3', volume: 0.75 },
    ]},
    '12':  { vo: [
      { startMs:  800, endMs: 2200, file: 'marcus_act12_01_keys_are_yours.mp3',    volume: 1.0 },
      { startMs: 2400, endMs: 3900, file: 'marcus_act12_02_keep_it_safe.mp3',      volume: 1.0 },
      { startMs: 4400, endMs: 5700, file: 'marcus_act12_03_road_been_waiting.mp3', volume: 1.0 },
      { startMs: 6000, endMs: 9100, file: 'marcus_act12_04_hustle_in_motion.mp3',  volume: 1.0 },
    ], sfx: [
      { startMs: 6500, file: 'sfx_truck_ignition.mp3', volume: 0.80 },
    ]},
  },
};

// ─── LocalStorage persistence ───────────────────────────────────────────────
const STORAGE_KEY = 'bx.welcomeModal.audioCalibration.v3';
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    return JSON.parse(raw);
  } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
}
function saveConfig(cfg) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) {} }
function clearConfig() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT — generates a welcomeModalAudioConfig.js that's IDENTICAL in shape
// to the canonical file. Critical: ALL_AUDIO_MANIFEST entries are objects
// with `category` and `file` (the v2 bug was bare strings).
// ═══════════════════════════════════════════════════════════════════════════
function cueToJs(c, includeEndMs) {
  const parts = [`startMs: ${c.startMs}`];
  if (includeEndMs && c.endMs != null) parts.push(`endMs: ${c.endMs}`);
  if (!includeEndMs && c.endMs != null) parts.push(`endMs: ${c.endMs}`);
  if (c.file)  parts.push(`file: ${JSON.stringify(c.file)}`);
  if (c.synth) parts.push(`synth: ${JSON.stringify(c.synth)}`);
  if (c.params) parts.push(`params: ${JSON.stringify(c.params)}`);
  if (c.volume != null) parts.push(`volume: ${c.volume}`);
  return `{ ${parts.join(', ')} }`;
}

function generateConfigFile(config) {
  const out = [];
  out.push("/**");
  out.push(" * ════════════════════════════════════════════════════════════════════════════");
  out.push(" * Box Truck Boss · Welcome Modal · welcomeModalAudioConfig.js");
  out.push(" * Generated by Calibration Studio v3");
  out.push(" * ════════════════════════════════════════════════════════════════════════════");
  out.push(" */");
  out.push("");

  // Music timeline
  out.push("export const WELCOME_MODAL_MUSIC_TIMELINE = [");
  config.music.forEach(m => {
    out.push(`  { file: ${JSON.stringify(m.file)}, spansActs: ${JSON.stringify(m.spansActs)}, actVolumes: ${JSON.stringify(m.actVolumes)}, fadeInMs: ${m.fadeInMs}, fadeOutMs: ${m.fadeOutMs} },`);
  });
  out.push("];");
  out.push("");

  // Per-act cues
  ACT_ORDER.forEach(actKey => {
    const a = config.acts[actKey] || { vo: [], sfx: [] };
    const constName = `ACT${actKey.toUpperCase()}_AUDIO_CUES`;
    out.push(`export const ${constName} = {`);
    out.push(`  vo: [`);
    a.vo.forEach(c => out.push(`    ${cueToJs(c, true)},`));
    out.push(`  ],`);
    out.push(`  sfx: [`);
    a.sfx.forEach(c => out.push(`    ${cueToJs(c, false)},`));
    out.push(`  ],`);
    out.push(`};`);
    out.push("");
  });

  // ACT_CUES_BY_KEY map
  out.push("export const ACT_CUES_BY_KEY = {");
  ACT_ORDER.forEach(k => {
    out.push(`  ${JSON.stringify(k)}: ACT${k.toUpperCase()}_AUDIO_CUES,`);
  });
  out.push("};");
  out.push("");

  // ALL_AUDIO_MANIFEST — CRITICAL: must be { category, file } objects
  out.push("// ─── ALL_AUDIO_MANIFEST: { category, file } objects required by AudioMixer.preload ───");
  const allFiles = new Set();
  config.music.forEach(m => { if (m.file) allFiles.add(m.file); });
  ACT_ORDER.forEach(k => {
    const a = config.acts[k] || { vo: [], sfx: [] };
    a.vo.forEach(c => c.file && allFiles.add(c.file));
    a.sfx.forEach(c => c.file && allFiles.add(c.file));
  });

  out.push("export const ALL_AUDIO_MANIFEST = [");
  Array.from(allFiles).sort().forEach(f => {
    const cat = categoryForFile(f);
    if (cat) {
      out.push(`  { category: ${JSON.stringify(cat)}, file: ${JSON.stringify(f)} },`);
    }
  });
  out.push("];");
  out.push("");

  return out.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATE — confirm the generated file has all required exports and shapes
// Returns { valid: bool, errors: string[], warnings: string[] }
// ═══════════════════════════════════════════════════════════════════════════
function validateOutput(text, config) {
  const errors = [];
  const warnings = [];

  // Check required exports
  const requiredExports = [
    'WELCOME_MODAL_MUSIC_TIMELINE',
    'ACT_CUES_BY_KEY',
    'ALL_AUDIO_MANIFEST',
    ...ACT_ORDER.map(k => `ACT${k.toUpperCase()}_AUDIO_CUES`),
  ];
  for (const exp of requiredExports) {
    if (!text.includes(`export const ${exp}`)) {
      errors.push(`Missing export: ${exp}`);
    }
  }

  // ACT_CUES_BY_KEY must have all 13 keys
  for (const k of ACT_ORDER) {
    if (!text.match(new RegExp(`"${k}":\\s*ACT${k.toUpperCase()}_AUDIO_CUES`))) {
      errors.push(`ACT_CUES_BY_KEY missing or wrong reference for key '${k}'`);
    }
  }

  // ALL_AUDIO_MANIFEST entries must have { category, file } shape (not bare strings)
  const manifestMatch = text.match(/export const ALL_AUDIO_MANIFEST = \[([\s\S]+?)\];/);
  if (manifestMatch) {
    const body = manifestMatch[1];
    const entries = body.trim().split('\n').filter(l => l.trim().startsWith('{'));
    if (entries.length === 0) {
      warnings.push('ALL_AUDIO_MANIFEST is empty (no audio files referenced)');
    }
    for (const entry of entries) {
      if (!entry.includes('category:') || !entry.includes('file:')) {
        errors.push(`ALL_AUDIO_MANIFEST entry is missing category or file: ${entry.trim().slice(0, 60)}`);
      }
    }
  } else {
    errors.push('ALL_AUDIO_MANIFEST block not found');
  }

  // Parse-check: try to evaluate as a module (best-effort syntax check)
  try {
    // Strip export keywords to make it parseable as plain JS
    const stripped = text
      .replace(/export const /g, 'const ')
      .replace(/export function /g, 'function ');
    // Use Function constructor to check parsing — won't execute side effects
    new Function(stripped);
  } catch (e) {
    errors.push(`Generated file has syntax error: ${e.message}`);
  }

  // Sanity: every cue file should have a recognizable category
  ACT_ORDER.forEach(k => {
    const a = config.acts[k] || { vo: [], sfx: [] };
    [...a.vo, ...a.sfx].forEach(c => {
      if (c.file && !categoryForFile(c.file)) {
        warnings.push(`Cue file has unrecognized prefix (must start marcus_/music_/sfx_): ${c.file}`);
      }
    });
  });

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO AUDIO PLAYER — independent of the real AudioMixer.
// Plays/stops HTMLAudioElements based on cue timing, with synth cue skip.
// ═══════════════════════════════════════════════════════════════════════════
function useStudioAudio() {
  const cacheRef = useRef(new Map());

  const ensureLoaded = useCallback((filename) => {
    if (!filename) return null;
    if (cacheRef.current.has(filename)) return cacheRef.current.get(filename);
    const url = resolveAudioUrl(filename);
    const a = new Audio(url);
    a.preload = 'auto';
    cacheRef.current.set(filename, a);
    return a;
  }, []);

  const playCue = useCallback((cue) => {
    if (cue.synth) {
      // We don't play synth cues in the studio (would need AudioContext setup);
      // they fire correctly in the real game. Mark visually only.
      return;
    }
    const a = ensureLoaded(cue.file);
    if (!a) return;
    try {
      a.volume = Math.min(1, Math.max(0, cue.volume ?? 1));
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (e) {}
  }, [ensureLoaded]);

  const stopCue = useCallback((cue) => {
    if (!cue.file) return;
    const a = cacheRef.current.get(cue.file);
    if (a && !a.paused) { try { a.pause(); a.currentTime = 0; } catch (e) {} }
  }, []);

  const stopAll = useCallback(() => {
    cacheRef.current.forEach(a => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
  }, []);

  const previewOne = useCallback((filename, volume = 1) => {
    if (!filename) return;
    const a = ensureLoaded(filename);
    if (!a) return;
    try {
      a.volume = Math.min(1, Math.max(0, volume));
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch (e) {}
  }, [ensureLoaded]);

  return { playCue, stopCue, stopAll, previewOne };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function CalibrationStudio() {
  const [config, setConfig] = useState(loadConfig);
  const [selectedAct, setSelectedAct] = useState('1');
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [actRunKey, setActRunKey] = useState(0);
  const [firedCueKeys, setFiredCueKeys] = useState(new Set());

  // Auto-save on every change
  useEffect(() => { saveConfig(config); }, [config]);

  // Set window globals for Acts 8/10/11/12 that need them
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ACT11_CORK    = ASSETS.act11.cork;
    window.__ACT12_HANDOFF = ASSETS.act12.handoff;
    window.__ACT12_HERO    = ASSETS.act12.hero;
    window.A6_TRUCK_TOP    = ASSETS.act6.truckTop;
    window.A7_MAP_BG       = ASSETS.act7.mapBg;
    window.A8_IMAGES = {
      MIDNIGHT_RUN:  ASSETS.act8.midnightRun,
      STORMY_NIGHT:  ASSETS.act8.stormyNight,
      DOT_INSPECTOR: ASSETS.act8.dotInspector,
    };
  }, []);

  const audio = useStudioAudio();

  // Playback RAF loop
  useEffect(() => {
    if (!playing) return;
    let rafId;
    const startTime = performance.now();
    const tick = (now) => {
      const t = now - startTime;
      const dur = ACT_META[selectedAct].duration;
      if (t >= dur) {
        setElapsedMs(dur);
        setPlaying(false);
        return;
      }
      setElapsedMs(t);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, selectedAct, actRunKey]);

  // Audio scheduler — fire cues as their windows open
  const lastFiredRef = useRef(new Set());
  useEffect(() => {
    if (!playing) return;
    const a = config.acts[selectedAct] || { vo: [], sfx: [] };
    const allCues = [...(a.vo || []), ...(a.sfx || [])];
    for (const cue of allCues) {
      const key = `${cue.file || cue.synth}@${cue.startMs}`;
      if (elapsedMs >= cue.startMs && (!cue.endMs || elapsedMs < cue.endMs) && !lastFiredRef.current.has(key)) {
        lastFiredRef.current.add(key);
        audio.playCue(cue);
        // mark for visual indicator
        setFiredCueKeys(prev => { const n = new Set(prev); n.add(key); return n; });
      }
      // Stop file cues whose endMs has passed
      if (cue.file && cue.endMs != null && elapsedMs >= cue.endMs) {
        audio.stopCue(cue);
      }
    }
  }, [elapsedMs, playing, selectedAct, config, audio]);

  // Start playback handler
  const handlePlay = () => {
    audio.stopAll();
    lastFiredRef.current = new Set();
    setFiredCueKeys(new Set());
    setElapsedMs(0);
    setActRunKey(k => k + 1);
    setPlaying(true);
  };
  const handleStop = () => {
    setPlaying(false);
    audio.stopAll();
  };

  // Switch act — stop playback first
  const switchAct = (k) => {
    setPlaying(false);
    audio.stopAll();
    setElapsedMs(0);
    setFiredCueKeys(new Set());
    lastFiredRef.current = new Set();
    setSelectedAct(k);
  };

  // Mutations
  const updateAct = useCallback((actKey, updater) => {
    setConfig(prev => ({
      ...prev,
      acts: { ...prev.acts, [actKey]: updater(prev.acts[actKey] || { vo: [], sfx: [] }) }
    }));
  }, []);
  const updateCue = (actKey, type, idx, patch) =>
    updateAct(actKey, a => ({ ...a, [type]: a[type].map((c, i) => i === idx ? { ...c, ...patch } : c) }));
  const deleteCue = (actKey, type, idx) =>
    updateAct(actKey, a => ({ ...a, [type]: a[type].filter((_, i) => i !== idx) }));
  const duplicateCue = (actKey, type, idx) =>
    updateAct(actKey, a => {
      const orig = a[type][idx];
      const newCue = { ...orig, startMs: orig.startMs + 500 };
      if (orig.endMs != null) newCue.endMs = orig.endMs + 500;
      const newArr = [...a[type]]; newArr.splice(idx + 1, 0, newCue);
      return { ...a, [type]: newArr };
    });
  const addCue = (actKey, type, kind) =>
    updateAct(actKey, a => {
      let newCue;
      if (kind === 'vo')        newCue = { startMs: 0, endMs: 2000, file: AVAILABLE_FILES.marcus[0], volume: 1.0 };
      else if (kind === 'sfx_file')  newCue = { startMs: 0, file: AVAILABLE_FILES.sfx[0], volume: 0.7 };
      else if (kind === 'sfx_synth') newCue = { startMs: 0, synth: AVAILABLE_FILES.synth[0], volume: 0.6 };
      return { ...a, [type]: [...a[type], newCue].sort((x,y) => x.startMs - y.startMs) };
    });
  const sortCues = (actKey) =>
    updateAct(actKey, a => ({
      vo:  [...a.vo].sort((x,y) => x.startMs - y.startMs),
      sfx: [...a.sfx].sort((x,y) => x.startMs - y.startMs),
    }));

  // Export
  const exportText = useMemo(() => generateConfigFile(config), [config]);
  const validation = useMemo(() => validateOutput(exportText, config), [exportText, config]);

  const handleDownload = () => {
    if (!validation.valid) {
      if (!window.confirm(`Output has ${validation.errors.length} error(s). Download anyway?\n\n${validation.errors.join('\n')}`)) return;
    }
    const blob = new Blob([exportText], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'welcomeModalAudioConfig.js';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus('✓ Copied!'); setTimeout(() => setCopyStatus(''), 2000);
    } catch (e) { setCopyStatus('✗ Copy failed'); setTimeout(() => setCopyStatus(''), 3000); }
  };
  const handleReset = () => {
    if (window.confirm('Reset ALL edits to defaults? Cannot be undone.')) {
      clearConfig(); setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG))); setElapsedMs(0);
    }
  };
  const handleResetAct = () => {
    if (window.confirm(`Reset Act ${selectedAct} to defaults?`)) {
      setConfig(prev => ({ ...prev, acts: { ...prev.acts, [selectedAct]: JSON.parse(JSON.stringify(DEFAULT_CONFIG.acts[selectedAct])) }}));
      setElapsedMs(0);
    }
  };

  const currentAct = config.acts[selectedAct] || { vo: [], sfx: [] };
  const meta       = ACT_META[selectedAct];
  const ActCompo   = ACT_COMPONENTS[selectedAct];

  // Per-Act prop wiring
  const actProps = useMemo(() => {
    const p = { name: 'kid', onComplete: () => setPlaying(false), onSkip: () => setPlaying(false) };
    switch (selectedAct) {
      case '1':  p.imageUrl = ASSETS.act1.terminalYard; break;
      case '3':  p.woodTextureUri = ASSETS.act3.woodTexture; break;
      case '4':  p.imageUrls = ASSETS.act4; break;
      case '6':  p.imageUrls = ASSETS.act6; break;
      case '7':  p.imageUrls = ASSETS.act7; break;
      case '10': p.xrayImageUrl = ASSETS.act10.xrayTruck; break;
    }
    return p;
  }, [selectedAct]);

  return (
    <div style={styles.root}>
      <style>{globalStyles}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div>
            <div style={styles.title}>🎚️ Audio Calibration Studio v3</div>
            <div style={styles.subtitle}>Live preview · 13-act welcome cinematic</div>
          </div>
          <div style={styles.headerActions}>
            <button onClick={() => setShowMusic(s => !s)}  style={styles.btnSecondary}>{showMusic ? 'Hide' : 'Show'} Music</button>
            <button onClick={() => setShowExport(s => !s)} style={styles.btnPrimary}>{showExport ? 'Hide' : 'Show'} Export</button>
            <button onClick={handleReset}                   style={styles.btnDanger}>Reset ALL</button>
          </div>
        </div>
      </div>

      {/* MUSIC PANEL (toggle) */}
      {showMusic && <MusicPanel config={config} setConfig={setConfig} audio={audio} />}

      {/* EXPORT PANEL */}
      {showExport && (
        <div style={styles.exportPanel}>
          <div style={styles.exportHeader}>
            <div>
              <strong style={{color: validation.valid ? '#aef0bb' : '#f88'}}>
                {validation.valid ? '✓ VALID' : `✗ ${validation.errors.length} ERROR(S)`}
              </strong>
              {validation.errors.length > 0 && (
                <ul style={styles.errorList}>
                  {validation.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <div style={{color:'#f5c542', fontSize:'11px', marginTop:'4px'}}>
                  {validation.warnings.length} warning(s) — non-blocking
                </div>
              )}
            </div>
            <div>
              <button onClick={handleDownload} style={styles.btnPrimary} disabled={!validation.valid}>⬇ Download .js</button>
              <button onClick={handleCopy}     style={styles.btnSecondary}>📋 Copy</button>
              {copyStatus && <span style={styles.copyStatus}>{copyStatus}</span>}
            </div>
          </div>
          <textarea readOnly value={exportText} style={styles.exportTextarea} onClick={e => e.target.select()} />
        </div>
      )}

      {/* ACT TABS */}
      <div style={styles.actTabs}>
        {ACT_ORDER.map(k => {
          const a = config.acts[k] || { vo: [], sfx: [] };
          const count = a.vo.length + a.sfx.length;
          return (
            <button key={k} onClick={() => switchAct(k)} style={{...styles.actTab, ...(selectedAct === k ? styles.actTabActive : {})}}>
              <div style={styles.actTabNum}>Act {k}</div>
              <div style={styles.actTabName}>{ACT_META[k].name}</div>
              <div style={styles.actTabCount}>{count} cue{count !== 1 ? 's' : ''}</div>
            </button>
          );
        })}
      </div>

      {/* MAIN PREVIEW + TIMELINE */}
      <div style={styles.mainArea}>
        {/* LEFT: Live cinematic */}
        <div style={styles.cinematicCol}>
          <div style={styles.cinematicHeader}>
            <h2 style={styles.actTitle}>Act {selectedAct}: {meta.name}</h2>
            <div style={styles.actDur}>{(meta.duration/1000).toFixed(1)}s · VO {currentAct.vo.length} · SFX {currentAct.sfx.length}</div>
          </div>
          <div style={styles.cinematicFrame}>
            {playing && ActCompo ? (
              <ActCompo key={`${selectedAct}-${actRunKey}`} {...actProps} />
            ) : (
              <div style={styles.cinematicPlaceholder}>
                <div style={{fontSize:'24px', marginBottom:'8px'}}>▶</div>
                <div>Click PLAY to preview Act {selectedAct} with audio</div>
                <div style={{fontSize:'11px', color:'#666', marginTop:'8px'}}>
                  Synth cues (decision_strike, paper_rustle, xray_pulse) fire silently<br />
                  in preview — they require AudioContext setup. They work correctly in production.
                </div>
              </div>
            )}
          </div>
          <div style={styles.controls}>
            {!playing
              ? <button onClick={handlePlay} style={styles.btnPlay}>▶ PLAY</button>
              : <button onClick={handleStop} style={styles.btnStop}>■ STOP</button>}
            <div style={styles.timeDisplay}>
              <span style={styles.timeNow}>{(elapsedMs/1000).toFixed(2)}s</span>
              <span style={styles.timeTotal}> / {(meta.duration/1000).toFixed(2)}s</span>
            </div>
            <button onClick={() => sortCues(selectedAct)} style={styles.btnSecondary}>Sort by time</button>
            <button onClick={handleResetAct}             style={styles.btnDanger}>Reset Act</button>
          </div>
        </div>

        {/* RIGHT: Cue editor */}
        <div style={styles.editorCol}>
          {/* Timeline strip */}
          <Timeline
            duration={meta.duration}
            voCues={currentAct.vo}
            sfxCues={currentAct.sfx}
            elapsedMs={elapsedMs}
            playing={playing}
            firedKeys={firedCueKeys}
          />

          {/* VO cues */}
          <CueListSection
            title="🎙️ Marcus VO Cues" type="vo" cues={currentAct.vo}
            files={AVAILABLE_FILES.marcus} audio={audio}
            onUpdate={(idx, patch) => updateCue(selectedAct, 'vo', idx, patch)}
            onDelete={idx => deleteCue(selectedAct, 'vo', idx)}
            onDuplicate={idx => duplicateCue(selectedAct, 'vo', idx)}
            onAdd={() => addCue(selectedAct, 'vo', 'vo')}
            cueColor="#3b82f6" hasEndMs={true}
          />

          {/* SFX cues */}
          <CueListSection
            title="🔊 SFX Cues" type="sfx" cues={currentAct.sfx}
            files={AVAILABLE_FILES.sfx} synthOptions={AVAILABLE_FILES.synth} audio={audio}
            onUpdate={(idx, patch) => updateCue(selectedAct, 'sfx', idx, patch)}
            onDelete={idx => deleteCue(selectedAct, 'sfx', idx)}
            onDuplicate={idx => duplicateCue(selectedAct, 'sfx', idx)}
            onAddFile={() => addCue(selectedAct, 'sfx', 'sfx_file')}
            onAddSynth={() => addCue(selectedAct, 'sfx', 'sfx_synth')}
            cueColor="#f59e0b" hasEndMs={false}
          />
        </div>
      </div>

      <div style={styles.spacer} />
    </div>
  );
}

// ─── TIMELINE WITH PLAYHEAD ─────────────────────────────────────────────────
function Timeline({ duration, voCues, sfxCues, elapsedMs, playing, firedKeys }) {
  const all = [
    ...voCues.map(c => ({ ...c, _type: 'vo' })),
    ...sfxCues.map(c => ({ ...c, _type: 'sfx' })),
  ];
  const playheadPct = (elapsedMs / duration) * 100;
  return (
    <div style={styles.timeline}>
      <div style={styles.timelineLabel}>
        Timeline: {(elapsedMs/1000).toFixed(2)}s / {(duration/1000).toFixed(1)}s
        {playing && <span style={styles.playingDot} />}
      </div>
      <div style={styles.timelineTrack}>
        {/* time tick marks */}
        {Array.from({length: Math.ceil(duration/5000) + 1}, (_, i) => {
          const t = i * 5000;
          if (t > duration) return null;
          return (
            <div key={i} style={{...styles.timelineTick, left: `${(t/duration)*100}%`}}>
              <div style={styles.timelineTickLabel}>{t/1000}s</div>
            </div>
          );
        })}
        {/* cue markers */}
        {all.map((c, i) => {
          const startPct = (c.startMs / duration) * 100;
          const widthPct = c.endMs != null ? ((c.endMs - c.startMs) / duration) * 100 : 0.5;
          const cueKey = `${c.file || c.synth}@${c.startMs}`;
          const fired = firedKeys.has(cueKey);
          const color = c._type === 'vo' ? '#3b82f6' : '#f59e0b';
          return (
            <div key={i}
              style={{
                ...styles.timelineMarker,
                left: `${startPct}%`,
                width: `${Math.max(widthPct, 0.6)}%`,
                backgroundColor: color,
                top: c._type === 'vo' ? '8px' : '24px',
                boxShadow: fired ? `0 0 8px ${color}` : 'none',
                opacity: fired ? 1 : 0.65,
              }}
              title={`${c._type.toUpperCase()} @ ${c.startMs}ms: ${c.file || c.synth}`}
            />
          );
        })}
        {/* playhead */}
        <div style={{...styles.playhead, left: `${playheadPct}%`, opacity: playing ? 1 : 0.3}} />
      </div>
    </div>
  );
}

// ─── CUE LIST SECTION ───────────────────────────────────────────────────────
function CueListSection({ title, type, cues, files, synthOptions, audio, onUpdate, onDelete, onDuplicate, onAdd, onAddFile, onAddSynth, hasEndMs, cueColor }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={{...styles.sectionTitle, color: cueColor}}>{title}</h3>
        <div style={styles.sectionMeta}>{cues.length} cue{cues.length !== 1 ? 's' : ''}</div>
      </div>
      {cues.length === 0 && <div style={styles.empty}>No {type.toUpperCase()} cues yet.</div>}
      {cues.map((cue, idx) => (
        <CueRow key={`${type}-${idx}`} cue={cue} idx={idx}
          files={files} synthOptions={synthOptions} audio={audio}
          onUpdate={patch => onUpdate(idx, patch)}
          onDelete={() => onDelete(idx)}
          onDuplicate={() => onDuplicate(idx)}
          hasEndMs={hasEndMs} cueColor={cueColor} />
      ))}
      <div style={styles.addRow}>
        {type === 'vo' && <button onClick={onAdd} style={styles.btnAdd}>+ Add VO Cue</button>}
        {type === 'sfx' && (
          <>
            <button onClick={onAddFile}  style={styles.btnAdd}>+ Add SFX (file)</button>
            <button onClick={onAddSynth} style={styles.btnAdd}>+ Add SFX (synth)</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CUE ROW ────────────────────────────────────────────────────────────────
function CueRow({ cue, idx, files, synthOptions, audio, onUpdate, onDelete, onDuplicate, hasEndMs, cueColor }) {
  const isSynth = !!cue.synth;
  return (
    <div style={{...styles.cueRow, borderLeftColor: cueColor}}>
      <div style={styles.cueRowTop}>
        <div style={styles.cueIdx}>#{idx + 1}</div>
        <label style={styles.fieldLabel}>startMs
          <input type="number" value={cue.startMs}
            onChange={e => onUpdate({ startMs: parseInt(e.target.value, 10) || 0 })}
            style={styles.numInput} step="50" />
        </label>
        {(hasEndMs || cue.endMs != null) && (
          <label style={styles.fieldLabel}>endMs
            <input type="number" value={cue.endMs ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                onUpdate({ endMs: v });
              }}
              style={styles.numInput} step="50" />
          </label>
        )}
        <label style={styles.fieldLabel}>volume
          <input type="number" value={cue.volume ?? 1.0}
            onChange={e => onUpdate({ volume: parseFloat(e.target.value) || 0 })}
            style={styles.numInput} step="0.05" min="0" max="1" />
        </label>
        <div style={styles.cueActions}>
          {cue.file && <button onClick={() => audio.previewOne(cue.file, cue.volume ?? 1)} style={styles.btnIcon} title="Preview">▶</button>}
          <button onClick={onDuplicate} style={styles.btnIcon}       title="Duplicate">⎘</button>
          <button onClick={onDelete}    style={styles.btnIconDanger} title="Delete">✕</button>
        </div>
      </div>
      <div style={styles.cueRowBottom}>
        {!isSynth ? (
          <label style={styles.fieldLabelWide}>file
            <select value={cue.file || ''}
              onChange={e => onUpdate({ file: e.target.value, synth: undefined, params: undefined })}
              style={styles.fileSelect}>
              {(files || []).map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label style={styles.fieldLabel}>synth
              <select value={cue.synth}
                onChange={e => onUpdate({ synth: e.target.value, file: undefined })}
                style={styles.fileSelect}>
                {(synthOptions || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            {cue.synth === 'decision_strike' && (
              <label style={styles.fieldLabel}>variant
                <input type="number" value={cue.params?.variant ?? 1}
                  onChange={e => onUpdate({ params: { ...cue.params, variant: parseInt(e.target.value, 10) || 1 } })}
                  style={styles.numInput} min="1" max="4" />
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MUSIC PANEL ────────────────────────────────────────────────────────────
function MusicPanel({ config, setConfig, audio }) {
  const updateMusic = (idx, patch) =>
    setConfig(p => ({ ...p, music: p.music.map((m, i) => i === idx ? { ...m, ...patch } : m) }));
  const updateMusicVolume = (idx, actKey, value) =>
    setConfig(p => ({ ...p, music: p.music.map((m, i) => i === idx ? { ...m, actVolumes: { ...m.actVolumes, [actKey]: value } } : m) }));
  const deleteMusic = (idx) => {
    if (!window.confirm('Delete this music bed?')) return;
    setConfig(p => ({ ...p, music: p.music.filter((_, i) => i !== idx) }));
  };
  const addMusic = () => setConfig(p => ({ ...p, music: [...p.music, { file: AVAILABLE_FILES.music[0], spansActs: ['1'], actVolumes: {'1': 0.5}, fadeInMs: 600, fadeOutMs: 600 }]}));
  return (
    <div style={styles.musicPanel}>
      <div style={styles.musicHeader}>
        <strong>🎵 Music Timeline</strong>
        <button onClick={addMusic} style={styles.btnAdd}>+ Add Music Bed</button>
      </div>
      {config.music.map((m, i) => (
        <div key={i} style={styles.musicCard}>
          <div style={styles.cueRowTop}>
            <label style={styles.fieldLabelWide}>file
              <select value={m.file} onChange={e => updateMusic(i, { file: e.target.value })} style={styles.fileSelect}>
                {AVAILABLE_FILES.music.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <button onClick={() => audio.previewOne(m.file, 0.6)} style={styles.btnIcon}>▶</button>
            <button onClick={() => deleteMusic(i)} style={styles.btnIconDanger}>✕</button>
          </div>
          <div style={styles.musicRow}>
            <label style={styles.fieldLabel}>fadeInMs
              <input type="number" value={m.fadeInMs}  onChange={e => updateMusic(i, { fadeInMs: parseInt(e.target.value, 10) || 0 })}  style={styles.numInput} step="50" /></label>
            <label style={styles.fieldLabel}>fadeOutMs
              <input type="number" value={m.fadeOutMs} onChange={e => updateMusic(i, { fadeOutMs: parseInt(e.target.value, 10) || 0 })} style={styles.numInput} step="50" /></label>
            <label style={styles.fieldLabelWide}>spansActs (comma-separated)
              <input type="text" value={m.spansActs.join(',')}
                onChange={e => updateMusic(i, { spansActs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                style={styles.textInput} /></label>
          </div>
          <div style={styles.musicVolumesRow}>
            <span style={{fontSize:'11px', color:'#888'}}>Per-act volumes:</span>
            {m.spansActs.map(actKey => (
              <label key={actKey} style={styles.fieldLabelTiny}>Act {actKey}
                <input type="number" value={m.actVolumes[actKey] ?? 0.5}
                  onChange={e => updateMusicVolume(i, actKey, parseFloat(e.target.value) || 0)}
                  style={styles.numInputTiny} step="0.05" min="0" max="1" />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const globalStyles = `
  body { margin: 0; background: #0a0a0a; color: #e5e5e5; font-family: 'SF Pro Display', system-ui, sans-serif; }
  input, select, button { font-family: inherit; font-size: 13px; }
  button { cursor: pointer; transition: all 0.15s; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  input:focus, select:focus { outline: 2px solid #d4a027; outline-offset: 1px; }
`;
const styles = {
  root: { minHeight: '100vh', padding: '12px', maxWidth: '1500px', margin: '0 auto' },
  header: { borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '12px' },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' },
  title: { fontSize: '22px', fontWeight: 700, color: '#d4a027' },
  subtitle: { fontSize: '12px', color: '#888' },
  headerActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnPrimary:   { padding: '8px 16px', background: '#d4a027', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 600 },
  btnSecondary: { padding: '8px 16px', background: '#2a2a2a', color: '#e5e5e5', border: '1px solid #444', borderRadius: '4px' },
  btnDanger:    { padding: '8px 16px', background: '#5b1f1f', color: '#fff', border: 'none', borderRadius: '4px' },
  btnAdd:       { padding: '6px 12px', background: '#1f4426', color: '#aef0bb', border: '1px solid #2c5e34', borderRadius: '4px', fontWeight: 600 },
  btnIcon:      { padding: '4px 10px', background: '#2a2a2a', color: '#e5e5e5', border: '1px solid #444', borderRadius: '3px', fontSize: '14px' },
  btnIconDanger:{ padding: '4px 10px', background: '#2a1010', color: '#f88', border: '1px solid #5b1f1f', borderRadius: '3px', fontSize: '14px' },
  btnPlay:      { padding: '10px 24px', background: '#1f4426', color: '#aef0bb', border: '1px solid #2c5e34', borderRadius: '4px', fontWeight: 700, fontSize: '14px' },
  btnStop:      { padding: '10px 24px', background: '#5b1f1f', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '14px' },

  actTabs: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px', padding: '6px', background: '#161616', borderRadius: '6px', border: '1px solid #2a2a2a' },
  actTab:        { padding: '8px 10px', background: '#1a1a1a', color: '#aaa', border: '1px solid #2a2a2a', borderRadius: '4px', minWidth: '88px', textAlign: 'left' },
  actTabActive:  { background: '#2d2410', color: '#f5c542', border: '1px solid #d4a027' },
  actTabNum:     { fontSize: '11px', fontWeight: 700, color: '#d4a027' },
  actTabName:    { fontSize: '12px', marginTop: '2px' },
  actTabCount:   { fontSize: '10px', color: '#666', marginTop: '2px' },

  mainArea: { display: 'grid', gridTemplateColumns: '480px 1fr', gap: '12px' },

  cinematicCol: {},
  cinematicHeader: { padding: '8px 12px', background: '#161616', borderRadius: '6px 6px 0 0', borderBottom: 'none', border: '1px solid #2a2a2a' },
  actTitle:   { margin: 0, fontSize: '18px', color: '#f5c542' },
  actDur:     { fontSize: '11px', color: '#888', marginTop: '4px' },
  cinematicFrame: { width: '480px', height: '780px', background: '#000', border: '1px solid #2a2a2a', borderTop: 'none', borderRadius: '0', overflow: 'hidden', position: 'relative' },
  cinematicPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', textAlign: 'center', padding: '20px' },
  controls:   { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#161616', borderRadius: '0 0 6px 6px', border: '1px solid #2a2a2a', borderTop: 'none', flexWrap: 'wrap' },
  timeDisplay: { fontFamily: 'SF Mono, monospace', fontSize: '14px' },
  timeNow:     { color: '#f5c542', fontWeight: 700 },
  timeTotal:   { color: '#666' },

  editorCol: { display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 },

  timeline: { padding: '12px', background: '#161616', borderRadius: '6px', border: '1px solid #2a2a2a' },
  timelineLabel: { fontSize: '11px', color: '#888', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' },
  playingDot: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#aef0bb', boxShadow: '0 0 8px #aef0bb', animation: 'pulse 1s infinite' },
  timelineTrack: { position: 'relative', height: '44px', background: '#0a0a0a', borderRadius: '3px', border: '1px solid #2a2a2a' },
  timelineTick:  { position: 'absolute', top: 0, bottom: 0, width: '1px', background: '#222' },
  timelineTickLabel: { position: 'absolute', bottom: '-16px', fontSize: '9px', color: '#666', whiteSpace: 'nowrap', transform: 'translateX(-50%)' },
  timelineMarker:{ position: 'absolute', height: '12px', borderRadius: '2px', minWidth: '2px', transition: 'box-shadow 0.2s, opacity 0.2s' },
  playhead:      { position: 'absolute', top: 0, bottom: 0, width: '2px', background: '#aef0bb', boxShadow: '0 0 6px #aef0bb', transition: 'left 0.1s linear', pointerEvents: 'none' },

  section:     { padding: '10px', background: '#161616', borderRadius: '6px', border: '1px solid #2a2a2a' },
  sectionHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  sectionTitle: { margin: 0, fontSize: '14px' },
  sectionMeta:  { fontSize: '11px', color: '#888' },
  empty:        { fontSize: '12px', color: '#666', fontStyle: 'italic', padding: '8px', textAlign: 'center', background: '#0a0a0a', borderRadius: '4px' },
  cueRow:       { padding: '8px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderLeft: '3px solid', borderRadius: '4px', marginBottom: '6px' },
  cueRowTop:    { display: 'flex', alignItems: 'flex-end', gap: '8px', flexWrap: 'wrap' },
  cueRowBottom: { display: 'flex', alignItems: 'flex-end', gap: '8px', marginTop: '6px', flexWrap: 'wrap' },
  cueIdx:       { fontSize: '11px', fontWeight: 700, color: '#666', width: '24px', paddingBottom: '6px' },
  fieldLabel:    { display: 'flex', flexDirection: 'column', fontSize: '10px', color: '#888', textTransform: 'uppercase' },
  fieldLabelWide:{ display: 'flex', flexDirection: 'column', fontSize: '10px', color: '#888', textTransform: 'uppercase', flex: 1, minWidth: '180px' },
  fieldLabelTiny:{ display: 'flex', flexDirection: 'column', fontSize: '9px', color: '#888' },
  numInput:     { width: '70px', padding: '4px 6px', background: '#0a0a0a', color: '#fff', border: '1px solid #444', borderRadius: '3px', marginTop: '2px' },
  numInputTiny: { width: '52px', padding: '2px 4px', background: '#0a0a0a', color: '#fff', border: '1px solid #444', borderRadius: '3px', marginTop: '2px', fontSize: '11px' },
  textInput:    { padding: '4px 6px', background: '#0a0a0a', color: '#fff', border: '1px solid #444', borderRadius: '3px', marginTop: '2px' },
  fileSelect:   { padding: '4px 6px', background: '#0a0a0a', color: '#fff', border: '1px solid #444', borderRadius: '3px', marginTop: '2px' },
  cueActions:   { display: 'flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' },
  addRow:       { marginTop: '8px', display: 'flex', gap: '6px' },

  exportPanel:    { padding: '10px', background: '#161616', borderRadius: '6px', marginBottom: '12px', border: '1px solid #d4a027' },
  exportHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' },
  errorList:      { margin: '4px 0 0 0', padding: '4px 0 4px 18px', fontSize: '11px', color: '#f88' },
  exportTextarea: { width: '100%', height: '280px', padding: '8px', background: '#0a0a0a', color: '#aef0bb', border: '1px solid #2a2a2a', borderRadius: '4px', fontFamily: 'SF Mono, monospace', fontSize: '11px', resize: 'vertical', boxSizing: 'border-box' },
  copyStatus:     { marginLeft: '12px', color: '#aef0bb', fontSize: '12px' },

  musicPanel:  { padding: '10px', background: '#161616', borderRadius: '6px', marginBottom: '12px', border: '1px solid #2a2a2a' },
  musicHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  musicCard:   { padding: '8px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '4px', marginBottom: '6px' },
  musicRow:    { display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' },
  musicVolumesRow: { display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '6px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '4px' },

  spacer: { height: '40px' },
};
