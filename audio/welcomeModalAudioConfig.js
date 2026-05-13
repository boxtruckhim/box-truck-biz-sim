/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * welcomeModalAudioConfig.js — music timeline + per-act cue data
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for what audio plays when. The shapes match the
 * v2 design doc:
 *
 *   WELCOME_MODAL_MUSIC_TIMELINE — modal-level music beds with per-act
 *                                 volume modulation and fade configuration
 *   ACT{N}_AUDIO_CUES            — per-act { vo, sfx } arrays
 *   ALL_AUDIO_MANIFEST           — derived preload list for the mixer
 *
 * VO cue timings extracted verbatim from the locked Act components in
 * /home/claude/welcome_modal/act*\/Act*.jsx — same startMs/endMs windows
 * the captions use, so VO and captions sync naturally.
 * ════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// MUSIC TIMELINE
// ─────────────────────────────────────────────────────────────────────────────

export const WELCOME_MODAL_MUSIC_TIMELINE = [
  {
    file: 'music_predawn_yard.mp3',
    spansActs: ['1', '2', '3'],
    actVolumes: { '1': 0.40, '2': 0.40, '3': 0.40 },
    fadeInMs: 1000,
    fadeOutMs: 600,
  },
  {
    file: 'music_voicemail.mp3',
    spansActs: ['4'],
    actVolumes: { '4': 0.40 },
    fadeInMs: 600,
    fadeOutMs: 600,
  },
  {
    file: 'music_csa_score.mp3',
    spansActs: ['5'],
    actVolumes: { '5': 0.50 },
    fadeInMs: 600,
    fadeOutMs: 600,
  },
  {
    file: 'music_curriculum.mp3',
    spansActs: ['6', '7'],
    actVolumes: { '6': 0.45, '7': 0.50 },
    fadeInMs: 600,
    fadeOutMs: 600,
  },
  {
    // The load-bearing bed — spans 4 acts with progressive volume modulation.
    // Christopher Galovan "Immersed" or similar; modulates from near-silent
    // (Act 8 despair) to full prestige bloom (Act 9-10).
    file: 'music_despair_to_hope.mp3',
    spansActs: ['8', '8_5', '9', '10'],
    actVolumes: { '8': 0.07, '8_5': 0.25, '9': 0.60, '10': 0.60 },
    fadeInMs: 1000,
    fadeOutMs: 1000,
  },
  // Act 11 has NO bed — silence is the act (SFX-only)
  {
    file: 'music_launch.mp3',
    spansActs: ['12'],
    actVolumes: { '12': 0.65 },
    fadeInMs: 800,
    fadeOutMs: 0,  // hard-stop at modal close
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PER-ACT CUES — extracted from locked Act components
// ─────────────────────────────────────────────────────────────────────────────

export const ACT1_AUDIO_CUES = {
  vo: [],
  sfx: [],
};

export const ACT2_AUDIO_CUES = {
  vo: [],
  sfx: [],
};

export const ACT3_AUDIO_CUES = {
  vo: [],
  sfx: [
    // Phone notification chime — fires when the missed-call card appears.
    // (User's combined file also serves as Act 4's voicemail beep.)
    { startMs: 1800, file: 'sfx_phone_notification.mp3', volume: 0.75 },
  ],
};

export const ACT4_AUDIO_CUES = {
  vo: [
    { startMs:   800, endMs:  2400, file: 'marcus_act4_01_hey_marcus.mp3',          volume: 1.0 },
    { startMs:  2900, endMs:  5500, file: 'marcus_act4_02_dispatching_23_years.mp3', volume: 1.0 },
    { startMs:  6000, endMs:  9700, file: 'marcus_act4_03_rich_or_broke.mp3',       volume: 1.0 },
    { startMs: 10200, endMs: 13800, file: 'marcus_act4_04_first_ninety_days.mp3',   volume: 1.0 },
    { startMs: 14200, endMs: 15800, file: 'marcus_act4_05_log_in_tomorrow.mp3',     volume: 1.0 },
    { startMs: 16100, endMs: 17900, file: 'marcus_act4_06_pick_up_the_phone.mp3',   volume: 1.0 },
    { startMs: 19500, endMs: 22500, file: 'marcus_act4_07_prepare_yourself.mp3',    volume: 1.0 },
  ],
  sfx: [
    // Voicemail beep at start — reuses Act 3's combined phone-notification file
    { startMs: 200, file: 'sfx_phone_notification.mp3', volume: 0.55 },
  ],
};

export const ACT5_AUDIO_CUES = {
  vo: [
    { startMs:   600, endMs:  3780, file: 'marcus_act5_01_not_what_hurts.mp3',         volume: 1.0 },
    { startMs:  4180, endMs:  7710, file: 'marcus_act5_02_csa_score_takes_hit.mp3',    volume: 1.0 },
    { startMs:  8110, endMs:  9870, file: 'marcus_act5_03_insurance_premium.mp3',      volume: 1.0 },
    { startMs: 10270, endMs: 12740, file: 'marcus_act5_04_brokers_stop_calling.mp3',   volume: 1.0 },
    { startMs: 13140, endMs: 16670, file: 'marcus_act5_05_lose_your_MC.mp3',           volume: 1.0 },
    { startMs: 17070, endMs: 20600, file: 'marcus_act5_06_two_years.mp3',              volume: 1.0 },
  ],
  sfx: [
    // 3 cascade stamps land just after each major consequence is named
    { startMs:  7400, file: 'sfx_csa_stamp_01.mp3',      volume: 0.65 },
    { startMs: 12500, file: 'sfx_csa_stamp_02.mp3',      volume: 0.65 },
    { startMs: 16400, file: 'sfx_csa_stamp_03.mp3',      volume: 0.65 },
    // Heavier "730 DAYS" landing — the closing punctuation of the act
    { startMs: 20400, file: 'sfx_csa_stamp_730_days.mp3', volume: 0.80 },
  ],
};

export const ACT6_AUDIO_CUES = {
  vo: [
    { startMs:   400, endMs:  4000, file: 'marcus_act6_01_catch_on_dipstick.mp3',   volume: 1.0 },
    { startMs:  4800, endMs:  8400, file: 'marcus_act6_02_react_in_the_moment.mp3', volume: 1.0 },
    { startMs:  9200, endMs: 12800, file: 'marcus_act6_03_pass_DOT_inspections.mp3',volume: 1.0 },
    { startMs: 13600, endMs: 17200, file: 'marcus_act6_04_back_into_the_dock.mp3',  volume: 1.0 },
    { startMs: 18000, endMs: 21600, file: 'marcus_act6_05_operate_the_liftgate.mp3',volume: 1.0 },
  ],
  sfx: [],
};

export const ACT7_AUDIO_CUES = {
  vo: [
    // Marcus's coach-register lines layered over the decision flashes
    { startMs:   400, endMs:  4600, file: 'marcus_act7_01_negotiate_with_brokers.mp3',      volume: 1.0 },
    { startMs:  5400, endMs:  9600, file: 'marcus_act7_02_hire_right_drivers_KYP.mp3',     volume: 1.0 },
    { startMs: 10400, endMs: 14600, file: 'marcus_act7_03_strategic_about_every_truck.mp3',volume: 1.0 },
    { startMs: 15400, endMs: 18600, file: 'marcus_act7_04_run_company_efficiently.mp3',    volume: 1.0 },
  ],
  sfx: [
    // 4 decision strikes — fire at the start of each visual flash.
    // SYNTHESIZED (no file required). Variants progress 1 → 4 (light → decisive).
    { startMs:     0, synth: 'decision_strike', params: { variant: 1 }, volume: 0.70 },
    { startMs:  5000, synth: 'decision_strike', params: { variant: 2 }, volume: 0.75 },
    { startMs: 10000, synth: 'decision_strike', params: { variant: 3 }, volume: 0.80 },
    { startMs: 15000, synth: 'decision_strike', params: { variant: 4 }, volume: 0.85 },
  ],
};

export const ACT8_AUDIO_CUES = {
  vo: [
    { startMs:   600, endMs:  4500, file: 'marcus_act8_01_truck_breaks_you_break.mp3', volume: 1.0 },
    { startMs:  5400, endMs:  6900, file: 'marcus_act8_02_both.mp3',                    volume: 1.0 },
    { startMs: 10300, endMs: 14500, file: 'marcus_act8_03_how_you_respond.mp3',         volume: 1.0 },
  ],
  sfx: [
    // Rain ambience plays for the full act — the de facto bed.
    // Music bed E is near-silent at 7% during this act; rain carries the texture.
    { startMs: 0, endMs: 16000, file: 'sfx_rain_ambience.mp3', volume: 0.55 },
  ],
};

export const ACT8_5_AUDIO_CUES = {
  vo: [
    { startMs:  200, endMs: 2200, file: 'marcus_act8_5_01_not_for_the_weak.mp3',         volume: 1.0 },
    { startMs: 2400, endMs: 4400, file: 'marcus_act8_5_02_resilient_resourceful.mp3',    volume: 1.0 },
    { startMs: 4600, endMs: 7600, file: 'marcus_act8_5_03_in_your_corner.mp3',           volume: 1.0 },
  ],
  sfx: [
    // No specific SFX — the warm-pad music swell carries this bridge act
  ],
};

export const ACT9_AUDIO_CUES = {
  vo: [
    { startMs:  1800, endMs:  3700, file: 'marcus_act9_01_one_becomes_three.mp3',       volume: 1.0 },
    { startMs:  8000, endMs: 10500, file: 'marcus_act9_02_becomes_a_fleet.mp3',         volume: 1.0 },
    { startMs: 10500, endMs: 15700, file: 'marcus_act9_03_name_in_this_industry.mp3',   volume: 1.0 },
  ],
  sfx: [
    // Bay door rumble — fires as the curtain rises and the truck reveals
    { startMs: 500, file: 'sfx_bay_door_rumble.mp3', volume: 0.65 },
  ],
};

export const ACT10_AUDIO_CUES = {
  vo: [],
  sfx: [
    // X-ray pulse when the truck silhouette emerges. SYNTHESIZED.
    { startMs: 2000, synth: 'xray_pulse', volume: 0.55 },
  ],
};

export const ACT11_AUDIO_CUES = {
  vo: [
    { startMs:   200, endMs:  2700, file: 'marcus_act11_01_not_forgiving.mp3',            volume: 1.0 },
    { startMs:  2900, endMs:  7500, file: 'marcus_act11_02_life_savings_dozen_ways.mp3', volume: 1.0 },
    { startMs:  7800, endMs: 12000, file: 'marcus_act11_03_face_all_of_them.mp3',         volume: 1.0 },
  ],
  sfx: [
    // 3 compliance failures land on the cork board.
    // Each = paper rustle (SYNTHESIZED) → stamp impact (file).
    { startMs: 1500, synth: 'paper_rustle', volume: 0.55 },
    { startMs: 2000, file:  'sfx_compliance_stamp.mp3', volume: 0.75 },

    { startMs: 5500, synth: 'paper_rustle', volume: 0.55 },
    { startMs: 6000, file:  'sfx_compliance_stamp.mp3', volume: 0.75 },

    { startMs: 9500, synth: 'paper_rustle', volume: 0.55 },
    { startMs: 10000, file: 'sfx_compliance_stamp.mp3', volume: 0.75 },
  ],
};

export const ACT12_AUDIO_CUES = {
  vo: [
    { startMs:  800, endMs: 2200, file: 'marcus_act12_01_keys_are_yours.mp3',     volume: 1.0 },
    { startMs: 2400, endMs: 3900, file: 'marcus_act12_02_keep_it_safe.mp3',       volume: 1.0 },
    { startMs: 4400, endMs: 5700, file: 'marcus_act12_03_road_been_waiting.mp3',  volume: 1.0 },
    { startMs: 6000, endMs: 9100, file: 'marcus_act12_04_hustle_in_motion.mp3',   volume: 1.0 },
  ],
  sfx: [
    // Truck ignition catches during Marcus's "And now... it's officially time
    // to put the hustle in motion." — engine starting is the cinematic's
    // diegetic handoff into the game.
    { startMs: 6500, file: 'sfx_truck_ignition.mp3', volume: 0.80 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CONVENIENT MAP — actKey → cue object
// ─────────────────────────────────────────────────────────────────────────────

export const ACT_CUES_BY_KEY = {
  '1':   ACT1_AUDIO_CUES,
  '2':   ACT2_AUDIO_CUES,
  '3':   ACT3_AUDIO_CUES,
  '4':   ACT4_AUDIO_CUES,
  '5':   ACT5_AUDIO_CUES,
  '6':   ACT6_AUDIO_CUES,
  '7':   ACT7_AUDIO_CUES,
  '8':   ACT8_AUDIO_CUES,
  '8_5': ACT8_5_AUDIO_CUES,
  '9':   ACT9_AUDIO_CUES,
  '10':  ACT10_AUDIO_CUES,
  '11':  ACT11_AUDIO_CUES,
  '12':  ACT12_AUDIO_CUES,
};

// ─────────────────────────────────────────────────────────────────────────────
// PRELOAD MANIFEST (derived)
// ─────────────────────────────────────────────────────────────────────────────

function gatherFiles() {
  const marcus = new Set();
  const sfx    = new Set();

  Object.values(ACT_CUES_BY_KEY).forEach((cues) => {
    (cues.vo  || []).forEach((c) => { if (c.file) marcus.add(c.file); });
    (cues.sfx || []).forEach((c) => { if (c.file) sfx.add(c.file); });
  });

  return { marcus: [...marcus], sfx: [...sfx] };
}

const _files = gatherFiles();

export const ALL_AUDIO_MANIFEST = [
  // Marcus VO files
  ..._files.marcus.map((file) => ({ category: 'marcus', file })),
  // Music bed files
  ...WELCOME_MODAL_MUSIC_TIMELINE.map((bed) => ({ category: 'music', file: bed.file })),
  // SFX files (synth cues are skipped — no preload needed)
  ..._files.sfx.map((file) => ({ category: 'sfx', file })),
];
