/**
 * HOSScenarios.js
 * Scenario data for HOSPuzzle — pure data, no React, no UI logic.
 *
 * Every scenario has:
 *   - briefing context (what the player is facing)
 *   - a dealt hand of cards (scenario-specific)
 *   - a canonical solution (FMCSA-compliant timeline)
 *   - validation options (including short-haul and Big Day contexts where applicable)
 *   - a gate function (checks App.jsx state to see if scenario is unlocked)
 *   - learning moments (side-by-side annotations after completion)
 *
 * DUTY STATUS ACCURACY:
 *   Only the 4 federally-defined duty statuses are represented:
 *     OFF_DUTY            (off the clock, resting)
 *     SLEEPER_BERTH       (off the clock, in sleeper)
 *     DRIVING             (at the controls)
 *     ON_DUTY_NOT_DRIVING (working but not driving — loading, unloading,
 *                          inspections, fueling when on-duty, etc.)
 *   There is no separate 'paperwork' or 'lunch' duty status. Paperwork
 *   while on the clock is ON_DUTY_NOT_DRIVING bundled into the
 *   load/unload/inspection card it accompanies. A lunch break off the
 *   clock is OFF_DUTY and may qualify as the 30-min break if ≥30 min.
 *
 *   Personal Conveyance (PC) is OFF_DUTY with a `pc: true` annotation,
 *   matching §395.8 and the 2018 FMCSA regulatory guidance. PC time
 *   counts identically to off-duty for all HOS math (rest accumulation,
 *   break satisfaction, weekly totals). The annotation exists for UI
 *   display and future use-case validation.
 *
 * All canonical solutions validated against HOSRuleEngine.js.
 *
 * FMCSA primary-source reference:
 *   - 49 CFR 395.3(a)        10/11/14-hour core rules
 *   - 49 CFR 395.3(a)(3)(ii) 30-min break
 *   - 49 CFR 395.3(b)(c)     60/70-hr weekly, 34-hr restart
 *   - 49 CFR 395.1(e)(1)(2)  short-haul exemptions
 *   - 49 CFR 395.1(o)        16-hour Big Day exception
 *   - 49 CFR 395.28(a)       Personal Conveyance special driving category
 *   - 2018 FMCSA guidance    Personal Conveyance 7 allowable / 8 disallowed uses
 *   - 49 CFR 395.8 narrative FMCSA's canonical Richmond→Newark compliant day
 *
 * Box Truck Boss Phase 4c · Scenario Data Batch
 */

'use strict';

import { TYPE } from './HOSRuleEngine.js';

// ─────────────────────────────────────────────────────────────────────────────
// CARD TEMPLATE CATALOG
// Replaces and extends the old CARD_TEMPLATES from HOSPuzzle.jsx.
// Each scenario's hand references these by templateId.
// ─────────────────────────────────────────────────────────────────────────────
export const CARD_TEMPLATES = {

  // ─────────────────────────────────────────────────────────────────────
  // sequenceRole (Batch 4e): declares where in the shift structure each
  // card type belongs. Used by the engine's checkSequenceCompliance() to
  // validate placement order. Roles in chronological order:
  //
  //   'shift_start'   — Must be the FIRST work activity of a shift.
  //                     Currently only pre-trip inspection qualifies.
  //   'shift_middle'  — Normal work/drive/break activities in the middle
  //                     of the shift. Order within this role is flexible.
  //   'shift_end'     — Must be the LAST work activity of a shift.
  //                     Currently only post-trip inspection qualifies.
  //   'after_shift'   — Off-duty rest that closes the day. Placed after
  //                     shift_end, never inside a shift.
  //
  // Players CAN place cards in wrong order (teaching moment), but wrong
  // ordering produces a SEQUENCE VIOLATION surfaced in the summary.
  // ─────────────────────────────────────────────────────────────────────

  // ── INSPECTIONS (on-duty not driving) ──
  preTrip: {
    id: 'preTrip',
    label: 'Pre-trip inspection',
    shortLabel: 'Pre-trip',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 30,
    category: 'inspection',
    sequenceRole: 'shift_start',
    educational: 'Required before every departure. 49 CFR 392.7 + carrier policy. On-duty status.',
    icon: '🔍',
  },
  postTrip: {
    id: 'postTrip',
    label: 'Post-trip inspection',
    shortLabel: 'Post-trip',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 30,
    category: 'inspection',
    sequenceRole: 'shift_end',
    educational: 'Federal DVIR requirement if defects found. 49 CFR 396.11. On-duty status.',
    icon: '🔎',
  },

  // ── DRIVING (driving status) ──
  driveShort: {
    id: 'driveShort',
    label: 'Drive (local leg)',
    shortLabel: 'Drive',
    type: TYPE.DRIVING,
    defaultMinutes: 60,                 // 1 hr — override per scenario
    category: 'driving',
    sequenceRole: 'shift_middle',
    educational: 'All time at the driving controls. Counts toward the 11-hour limit and 14-hour window.',
    icon: '🛣️',
  },
  driveLong: {
    id: 'driveLong',
    label: 'Drive (highway leg)',
    shortLabel: 'Drive',
    type: TYPE.DRIVING,
    defaultMinutes: 240,                // 4 hr — override per scenario
    category: 'driving',
    sequenceRole: 'shift_middle',
    educational: 'Long driving segments build cumulative driving time toward the 8-hour break trigger.',
    icon: '🛣️',
  },
  driveFinal: {
    id: 'driveFinal',
    label: 'Drive final leg',
    shortLabel: 'Final drive',
    type: TYPE.DRIVING,
    defaultMinutes: 60,                 // 1 hr — override per scenario
    category: 'driving',
    sequenceRole: 'shift_middle',
    educational: 'The final push. Watch the 14-hour window — it does NOT pause.',
    icon: '🏁',
  },
  driveExtra: {
    id: 'driveExtra',
    label: 'Drive (between stops)',
    shortLabel: 'Drive',
    type: TYPE.DRIVING,
    defaultMinutes: 30,                 // 30 min — short flexible drive
    category: 'driving',
    sequenceRole: 'shift_middle',
    educational: 'Optional drive tile. Use to add drive time between any '
      + 'two activities — for example, the drive from your overnight '
      + 'parking spot to the shipper dock, between deliveries in the same '
      + 'city, or any short leg not covered by required drive cards. '
      + 'Counts toward the 11-hour driving limit and 14-hour window like '
      + 'any other driving. Place 0, 1, 2, or more depending on how your '
      + 'actual day flowed.',
    icon: '🛣️',
  },

  // ── DOCK / LOADING (on-duty not driving) ──
  loadCargo: {
    id: 'loadCargo',
    label: 'Load cargo at shipper',
    shortLabel: 'Load',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 45,
    category: 'dock',
    sequenceRole: 'shift_middle',
    educational: 'On-duty not driving. Counts toward 14-hour window, not 11-hour driving limit.',
    icon: '📦',
  },
  unloadCargo: {
    id: 'unloadCargo',
    label: 'Unload at delivery',
    shortLabel: 'Unload',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 60,
    category: 'dock',
    sequenceRole: 'shift_middle',
    educational: 'On-duty not driving. Counts toward 14-hour window, not 11-hour driving limit.',
    icon: '📤',
  },
  detention: {
    id: 'detention',
    label: 'Detention at dock',
    shortLabel: 'Detention',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 240,                // 4 hr — classic detention scenario
    category: 'dock',
    sequenceRole: 'shift_middle',
    educational: 'Detention is on-duty waiting. Burns your 14-hour window without driving. ' +
                 'Your driving clock does NOT advance during detention, but your shift window does.',
    icon: '⏳',
  },
  loadMultistop: {
    id: 'loadMultistop',
    label: 'Stop: load/unload',
    shortLabel: 'Stop',
    type: TYPE.ON_DUTY_NOT_DRIVING,
    defaultMinutes: 45,
    category: 'dock',
    sequenceRole: 'shift_middle',
    educational: 'Multi-stop routes accumulate on-duty time quickly. Plan your day carefully.',
    icon: '📍',
  },

  // ── BREAKS (off-duty) ──
  mandatoryBreak: {
    id: 'mandatoryBreak',
    label: '30-min off-duty break',
    shortLabel: 'Break 30m',
    type: TYPE.OFF_DUTY,
    defaultMinutes: 30,
    category: 'break',
    sequenceRole: 'shift_middle',
    educational: 'Off-duty time. Serves as the 30-min break required after 8 cumulative ' +
                 'driving hours (§395.3(a)(3)(ii)). The rule accepts off-duty, sleeper berth, ' +
                 'or on-duty-not-driving — but off-duty is the most common choice. ' +
                 'Short-haul drivers are exempt from this rule entirely.',
    icon: '☕',
  },
  fuelStop: {
    id: 'fuelStop',
    label: 'Fuel stop',
    shortLabel: 'Fuel',
    type: TYPE.OFF_DUTY,
    defaultMinutes: 30,
    category: 'break',
    sequenceRole: 'shift_middle',
    educational: 'If ≥30 min off-duty, counts as qualifying 30-min break. Does NOT pause the 14-hour window.',
    icon: '⛽',
  },

  // ── REST (off-duty or sleeper berth) ──
  restPeriod10h: {
    id: 'restPeriod10h',
    label: '10-hour rest',
    shortLabel: 'Rest 10h',
    type: TYPE.OFF_DUTY,
    defaultMinutes: 600,
    category: 'rest',
    sequenceRole: 'after_shift',
    educational: 'Required 10 consecutive hours off before new driving shift. Resets 11h drive + 14h window. 49 CFR 395.3(a)(1).',
    icon: '🛌',
  },
  sleeperBerth10h: {
    id: 'sleeperBerth10h',
    label: '10-hour sleeper berth',
    shortLabel: 'SB 10h',
    type: TYPE.SLEEPER_BERTH,
    defaultMinutes: 600,
    category: 'rest',
    sequenceRole: 'after_shift',
    educational: 'Sleeper berth time counts as rest for the 10-hour reset. Requires sleeper-equipped truck.',
    icon: '🛏️',
    requiresSleeperBerth: true,
  },
  extendedRest: {
    id: 'extendedRest',
    label: 'Extended rest (off-duty)',
    shortLabel: 'Rest',
    type: TYPE.OFF_DUTY,
    defaultMinutes: 720,                // 12 hours default
    category: 'rest',
    sequenceRole: 'after_shift',
    educational: 'Long off-duty block. Used to fill a 34-hour restart day or overnight rest.',
    icon: '💤',
  },

  // ── PERSONAL CONVEYANCE (49 CFR 395.28(a) + 2018 FMCSA guidance) ──
  // PC is LOGGED AS OFF-DUTY per §395.8. The `pc: true` annotation on
  // the card flags it for UI display and future use-case validation.
  // For all HOS clock math (rest accumulation, break satisfaction,
  // weekly totals) the engine treats PC entries identically to off-duty.
  personalConveyance: {
    id: 'personalConveyance',
    label: 'Personal Conveyance (PC)',
    shortLabel: 'PC',
    type: TYPE.OFF_DUTY,
    defaultMinutes: 30,
    category: 'pc',
    sequenceRole: 'shift_middle',
    pc: true,
    educational: 'Moving the CMV off-duty for personal use. Carrier must authorize ' +
                 'PC in your ELD configuration. Allowed: commuting terminal↔home, ' +
                 'driving to nearby rest after loading/unloading, lodging↔restaurants. ' +
                 'NOT allowed: moving closer to next load, bobtailing to retrieve ' +
                 'another load, bypassing rest to gain operational readiness. ' +
                 '49 CFR 395.28(a) + 2018 FMCSA guidance.',
    icon: '🚗',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a canonical-solution entry.
 * @param {string} templateId  - Key in CARD_TEMPLATES
 * @param {number} startHour   - Hour-of-day (0-24, can use .5 for half-hours)
 * @param {number} durMinutes  - Duration in minutes
 * @param {object} [extra]     - Optional fields (locationLabel, scenarioOverrideLabel)
 */
function step(templateId, startHour, durMinutes, extra = {}) {
  return {
    templateId,
    startMinute:     Math.round(startHour * 60),
    durationMinutes: durMinutes,
    ...extra,
  };
}

/**
 * Build a hand card spec. Scenario cards can override templates' default
 * duration and label for scenario-specific framing.
 */
function hand(templateId, overrides = {}) {
  return { templateId, ...overrides };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE 6 SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

export const SCENARIOS = [

  // ═══ SCENARIO 1 — SHORT LOCAL RUN ═══════════════════════════════════════
  // Always available. Pre-MC Authority eligible. Teaches basic log structure.
  // 80 mi round trip, 2.5h drive, 4.75h on-duty total. No break required.
  {
    id:         'short_local_run',
    title:      'Short Local Run',
    subtitle:   '80-mile round trip, home by noon',
    difficulty: 'easy',
    order:      1,

    gate: () => ({ unlocked: true, reason: null }),   // always available

    briefing: {
      scenario: "A local shipper needs you to make two deliveries today. Both stops are within 40 miles of your home base. You'll be home before lunch.",
      runData: {
        originCity:          'Home Base',
        destCity:            'Two Local Customers',
        distanceMiles:       80,
        estimatedDriveHours: 2.5,
        pickupWindow:        '07:00 (ready at dock)',
        deliveryDeadline:    '11:30',
      },
      priorWeek: {
        hoursUsed:      24,
        policy:         '70/8',
        last34Restart:  null,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        'Pre-trip and post-trip inspections are ON-DUTY time, not off-duty.',
        "For short days under 8 hours of driving, no 30-minute break is required.",
        'Even a simple day requires a proper logbook entry for each duty change.',
      ],
    },

    hand: [
      hand('preTrip',       { required: true }),
      hand('driveShort',    { required: true, durationMinutes: 60,  label: 'Drive to Customer 1' }),
      hand('unloadCargo',   { required: true, durationMinutes: 45,  label: 'Deliver Customer 1' }),
      hand('driveShort',    { required: true, durationMinutes: 45,  label: 'Drive to Customer 2', instanceNo: 2 }),
      hand('unloadCargo',   { required: true, durationMinutes: 30,  label: 'Deliver Customer 2', instanceNo: 2 }),
      hand('driveShort',    { required: true, durationMinutes: 45,  label: 'Drive home', instanceNo: 3 }),
      hand('postTrip',      { required: true }),
      hand('restPeriod10h', { required: true }),   // Batch 4e-2: shift must close with rest
      // Optional flexible drive cards — player can place wherever they
      // need extra drive time (e.g., parking lot to shipper, between
      // deliveries within the same city, etc.).
      hand('driveExtra',    { required: false, instanceNo: 1 }),
      hand('driveExtra',    { required: false, instanceNo: 2 }),
      // Optional cards to tempt misuse — should NOT be placed
      hand('mandatoryBreak',{ required: false }),
      hand('fuelStop',      { required: false, durationMinutes: 15 }),
    ],

    canonicalSolution: [
      step('preTrip',     7,     30,  { locationLabel: 'Home terminal' }),
      step('driveShort',  7.5,   60,  { locationLabel: 'Home → Customer 1' }),
      step('unloadCargo', 8.5,   45,  { locationLabel: 'Customer 1' }),
      step('driveShort',  9.25,  45,  { locationLabel: 'Customer 1 → Customer 2', instanceNo: 2 }),
      step('unloadCargo', 10,    30,  { locationLabel: 'Customer 2', instanceNo: 2 }),
      step('driveShort',  10.5,  45,  { locationLabel: 'Customer 2 → Home', instanceNo: 3 }),
      step('postTrip',    11.25, 30,  { locationLabel: 'Home terminal' }),
      step('restPeriod10h', 11.75, 600, { locationLabel: 'Home — 10h rest' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
      shortHaulClaimed: true,
      shortHaulContext: {
        exemption:             'e1',
        routeAirMiles:         40,
        returnsToHomeTerminal: true,
        onDutyShiftHours:      4.75,
      },
    },

    scoring: {
      orderMustMatch:     true,
      startTimeTolerance: 30,
      perfectBonus:       50,
    },

    learningMoments: [
      { timeRange: [420, 450],
        annotation: 'Pre-trip is ON-DUTY. Your 14-hour window starts here.' },
      { timeRange: [450, 690],
        annotation: 'Short-haul day: no 30-min break needed — under 8h cumulative driving.' },
      { timeRange: [675, 705],
        annotation: 'Post-trip is also ON-DUTY. Your shift ends when you log OFF.' },
    ],
  },

  // ═══ SCENARIO 2 — LONG DAY TRANSIT ══════════════════════════════════════
  // Level 1+, post-MC Authority. Teaches 30-min break, 14h window pressure.
  // 550 mi, 9h drive, 12h on-duty shift.
  {
    id:         'long_day_transit',
    title:      'Long Day Transit',
    subtitle:   '550 mi interstate, break + window',
    difficulty: 'medium',
    order:      2,

    gate: (ctx) => ({
      unlocked: !!ctx.hasMcAuthority,
      reason:   ctx.hasMcAuthority
        ? null
        : 'Unlocks after MC Authority activates (routes exceed 150 air miles).',
    }),

    briefing: {
      scenario: "Pickup at the Chicago warehouse 05:30, delivery in Memphis by end of day. Interstate run. Full HOS applies — no short-haul exemption once you cross 150 air miles.",
      runData: {
        originCity:          'Chicago, IL',
        destCity:            'Memphis, TN',
        distanceMiles:       550,
        estimatedDriveHours: 9,
        pickupWindow:        '05:30',
        deliveryDeadline:    '17:00',
      },
      priorWeek: {
        hoursUsed:      42,
        policy:         '70/8',
        last34Restart:  null,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        'After 8 cumulative driving hours, federal rule REQUIRES a 30-minute break. Take it proactively.',
        'The 14-hour window does NOT pause for breaks or off-duty time.',
        'Plan your break BEFORE you need it — at ~4-5 hours into driving, not at 7:55.',
      ],
    },

    hand: [
      hand('preTrip',        { required: true }),
      hand('driveLong',      { required: true, durationMinutes: 270, label: 'Drive leg 1' }),
      hand('mandatoryBreak', { required: true,  instanceNo: 1, label: '30-min break (required)' }),
      hand('driveLong',      { required: true, durationMinutes: 210, label: 'Drive leg 2', instanceNo: 2 }),
      hand('mandatoryBreak', { required: false, instanceNo: 2, label: 'Midday off-duty break' }),
      hand('driveShort',     { required: true, durationMinutes: 60,  label: 'Drive final leg' }),
      hand('unloadCargo',    { required: true }),
      // Batch 4f-2: realism — drive between dock and yard. Optional
      // canonical (engine flags missing transition; smart strip keeps
      // it in Hard mode because it's in canonical).
      hand('driveExtra',     { required: false, instanceNo: 3,
                               durationMinutes: 30,
                               label: 'Drive to Memphis yard' }),
      hand('postTrip',       { required: true }),
      hand('restPeriod10h',  { required: true }),   // Batch 4e-2: shift must close with rest
      // Optional flexible drive cards — for any short legs the required
      // drive cards don't cover (e.g., yard-to-highway, dock-to-truckstop).
      hand('driveExtra',     { required: false, instanceNo: 1 }),
      hand('driveExtra',     { required: false, instanceNo: 2 }),
      // Traps
      hand('fuelStop',       { required: false }),
      hand('personalConveyance', { required: false, durationMinutes: 20,
                                   label: 'Drive to next loadboard check-in (PC?)' }),
    ],

    canonicalSolution: [
      step('preTrip',        5,      30, { locationLabel: 'Chicago yard' }),
      step('driveLong',      5.5,   270, { locationLabel: 'IL → IN → KY' }),
      step('mandatoryBreak', 10,     30, { locationLabel: 'Truck stop, KY',
                                           instanceNo: 1,
                                           why: 'Proactive break before 8h cumulative driving.' }),
      step('driveLong',      10.5,  210, { locationLabel: 'KY → TN', instanceNo: 2 }),
      step('mandatoryBreak', 14,     30, { locationLabel: 'TN rest area',
                                           instanceNo: 2,
                                           why: 'Midday off-duty — qualifies as another break + rest.',
                                           optional: true }),
      step('driveShort',     14.5,   60, { locationLabel: 'Final → Memphis' }),
      step('unloadCargo',    15.5,   60, { locationLabel: 'Memphis dock' }),
      // Batch 4f-2 (audit fix): unloadCargo and postTrip happen at the
      // same physical location (delivery destination — driver post-trips
      // at the dock or adjacent rest area, not a separate yard). The
      // engine's exception list treats this pair as same-location.
      // Canonical times reflect that — postTrip starts immediately after
      // unload completes, no drive between.
      step('postTrip',       16.5,   30, { locationLabel: 'Memphis dock' }),
      step('restPeriod10h',  17.0,  600, { locationLabel: 'Memphis — 10h rest' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
      // Short-haul NOT claimed. This is interstate, >150 air miles.
    },

    scoring: {
      orderMustMatch:      true,
      startTimeTolerance:  30,
      perfectBonus:        100,
      optionalCardBonus:   15,
    },

    learningMoments: [
      { timeRange: [300, 330],
        annotation: 'Shift starts 05:00. Your 14-hour window now closes at 19:00 — no matter what.' },
      { timeRange: [600, 630],
        annotation: 'Proactive 30-min break: cumulative driving was 4.5h, well before the 8h trigger.' },
      { timeRange: [1020, 1050],
        annotation: 'Total driving: 9h. Shift: 12h. Window used: 12 of 14h. Safely compliant.' },
    ],
  },

  // ═══ SCENARIO 3 — OVERNIGHT WITH DELIVERY ═══════════════════════════════
  // Level 5+. Teaches 11h driving limit and running a full legal day.
  // 700 mi, 11h drive (at limit), 14h shift (at limit).
  {
    id:         'overnight_with_delivery',
    title:      'Overnight With Delivery',
    subtitle:   '700 mi, day 1 of a 2-day run',
    difficulty: 'medium',
    order:      3,

    gate: (ctx) => ({
      unlocked: (ctx.level || 1) >= 5 && !!ctx.hasMcAuthority,
      reason:   ctx.level >= 5 && ctx.hasMcAuthority
        ? null
        : 'Unlocks at Level 5 after MC Authority.',
    }),

    briefing: {
      scenario: "700-mile run, day 1 of 2. You'll drive to the 11-hour limit, complete delivery, then sleep at the truck stop for the mandatory 10-hour rest.",
      runData: {
        originCity:          'Minneapolis, MN',
        destCity:            'St. Louis, MO',
        distanceMiles:       700,
        estimatedDriveHours: 11,
        pickupWindow:        '04:30',
        deliveryDeadline:    '18:00',
      },
      priorWeek: {
        hoursUsed:      36,
        policy:         '70/8',
        last34Restart:  null,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        'The 11-hour driving limit is absolute. Plan two breaks to split driving into three legs.',
        'Your day ends IN the 10-hour rest — rest starts the moment you log OFF.',
        'Running to the full 11h is legal but leaves no margin. Weather or traffic = violation.',
      ],
    },

    hand: [
      hand('preTrip',        { required: true }),
      hand('driveLong',      { required: true, durationMinutes: 240, label: 'Drive leg 1' }),
      hand('fuelStop',       { required: true,  label: 'Fuel + break', durationMinutes: 30 }),
      hand('driveLong',      { required: true, durationMinutes: 240, label: 'Drive leg 2', instanceNo: 2 }),
      hand('mandatoryBreak', { required: true,  instanceNo: 1, label: 'Off-duty break' }),
      hand('driveLong',      { required: true, durationMinutes: 180, label: 'Drive leg 3', instanceNo: 3 }),
      hand('unloadCargo',    { required: true, durationMinutes: 30 }),  // Batch 4f-2: shaved 60→30 to fit drive
      // Batch 4f-2: realism — drive from delivery to overnight parking.
      hand('driveExtra',     { required: false, instanceNo: 3,
                               durationMinutes: 30,
                               label: 'Drive to truck stop' }),
      hand('postTrip',       { required: true }),
      hand('restPeriod10h',  { required: true }),
      // Optional flexible drive cards — for short legs not covered by
      // the required drive cards (parking-to-highway, off-ramp-to-dock).
      hand('driveExtra',     { required: false, instanceNo: 1 }),
      hand('driveExtra',     { required: false, instanceNo: 2 }),
      // Traps — PC is NOT allowed mid-run to bypass rest.
      // This card tests whether the player knows when PC is legitimate.
      hand('personalConveyance', { required: false, durationMinutes: 20,
                                   label: 'PC: drive toward next load?' }),
    ],

    canonicalSolution: [
      step('preTrip',       4.5,    30, { locationLabel: 'Minneapolis yard' }),
      step('driveLong',     5,     240, { locationLabel: 'MN → IA' }),
      step('fuelStop',      9,      30, { locationLabel: 'Iowa pilot',
                                          why: 'Fuel + qualifying 30-min break combined.' }),
      step('driveLong',     9.5,   240, { locationLabel: 'IA → MO', instanceNo: 2 }),
      step('mandatoryBreak',13.5,   30, { locationLabel: 'MO rest area',
                                          instanceNo: 1 }),
      step('driveLong',    14,     180, { locationLabel: 'Final to St. Louis', instanceNo: 3,
                                          why: 'Brings cumulative driving to 11h — at the legal limit.' }),
      step('unloadCargo',  17,      30, { locationLabel: 'St. Louis delivery' }),
      // Batch 4f-2 (audit fix): postTrip happens at the same physical
      // location as unloadCargo (engine exempts this pair from drive-
      // transition requirement). The driver post-trips at the dock or
      // adjacent rest area, then takes the 10-hour rest.
      step('postTrip',     17.5,    30, { locationLabel: 'St. Louis delivery' }),
      step('restPeriod10h',18,     600, { locationLabel: 'On-site sleep',
                                          why: '10 consecutive hours off resets for tomorrow.' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
    },

    scoring: {
      orderMustMatch:     true,
      startTimeTolerance: 30,
      perfectBonus:       150,
    },

    learningMoments: [
      { timeRange: [540, 570],
        annotation: 'Fuel stop doubles as qualifying 30-min break when ≥30 min off-duty.' },
      { timeRange: [840, 1020],
        annotation: 'Final leg brings you to exactly 11h driving — the federal ceiling.' },
      { timeRange: [1110, 1710],
        annotation: '10-hour rest is CONSECUTIVE. No work activities inside this block.' },
    ],
  },

  // ═══ SCENARIO 4 — 34-HOUR RESTART DAY ═══════════════════════════════════
  // Level 10+. Teaches the 34-hour restart mechanic.
  // 0 mi, 0h drive, 0h on-duty. Pure rest day.
  {
    id:         'restart_34h',
    title:      '34-Hour Restart Day',
    subtitle:   'Reset the weekly clock',
    difficulty: 'medium',
    order:      4,

    gate: (ctx) => ({
      unlocked: (ctx.level || 1) >= 10 && !!ctx.hasMcAuthority,
      reason:   ctx.level >= 10 && ctx.hasMcAuthority
        ? null
        : 'Unlocks at Level 10 after MC Authority.',
    }),

    briefing: {
      scenario: "You've run hard this week — 68 of your 70 weekly hours are used. Today's mission: stay off-duty so tomorrow morning you can drive again on a fresh weekly clock.",
      runData: {
        originCity:          'Home Base',
        destCity:            '(no route today)',
        distanceMiles:       0,
        estimatedDriveHours: 0,
        pickupWindow:        'N/A',
        deliveryDeadline:    'N/A',
      },
      priorWeek: {
        hoursUsed:      68,
        policy:         '70/8',
        last34Restart:  null,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        'After 34 consecutive hours off-duty, your 60- or 70-hour weekly clock resets to zero.',
        'Any work activity — even 5 minutes of on-duty — restarts the 34-hour clock.',
        'Restart days are a strategic choice, not a requirement. Plan them before you hit the cap.',
      ],
    },

    hand: [
      hand('extendedRest', { required: true, durationMinutes: 720, label: 'Morning off-duty',       instanceNo: 1 }),
      hand('extendedRest', { required: true, durationMinutes: 720, label: 'Afternoon/evening off',  instanceNo: 2 }),
      // Traps: placing ANY on-duty card breaks the restart.
      // (All ON-DUTY cards — inspections or loading — would break the 34h block.)
      hand('preTrip',      { required: false }),
      hand('loadMultistop',{ required: false, durationMinutes: 30,
                             label: 'Quick dispatch drop-by (on-duty)' }),
      // A PC move is tempting but NOT appropriate mid-restart — any CMV
      // movement requires carrier authorization and counts as... still
      // off-duty in the engine, but this trap teaches that PC to get a
      // head-start on tomorrow's run is explicitly called out as disallowed
      // by FMCSA's 2018 guidance.
      hand('personalConveyance', { required: false, durationMinutes: 30,
                                   label: 'PC: drive CMV to run errands?' }),
    ],

    canonicalSolution: [
      step('extendedRest', 0,   720, { locationLabel: 'Home',                   instanceNo: 1 }),
      step('extendedRest', 12,  720, { locationLabel: 'Home (afternoon/night)', instanceNo: 2,
                                        why: 'Two 12-hour off-duty blocks = 24h. Restart continues into tomorrow.' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
    },

    scoring: {
      orderMustMatch:     false,
      startTimeTolerance: 60,
      perfectBonus:       75,
    },

    learningMoments: [
      { timeRange: [0, 1440],
        annotation: 'Zero on-duty time today. Any work activity breaks the restart.' },
      { timeRange: [1200, 1440],
        annotation: 'Restart continues past midnight — you need 34 consecutive off-duty hours total.' },
    ],
  },

  // ═══ SCENARIO 5 — DETENTION + BIG DAY (49 CFR 395.1(o)) ═════════════════
  // Level 15+. 300 mi, 8h drive. Shipper holds you for 5h detention —
  // leaves you unable to finish the day within the standard 14-hour window.
  // The ONLY way to legally complete this day is to invoke the §395.1(o)
  // 16-hour Big Day exception. The scenario tests whether the player knows:
  //   1. When the exception is needed (standard 14h window is insufficient).
  //   2. Whether they qualify (prior 5 duty tours, returns home, shift ≤16h,
  //      not used in prior 6 days, not also using (e)(2) non-CDL short-haul).
  // Without Big Day: WINDOW_LIMIT violation at minute 1200 (20:00).
  // With valid Big Day: fully compliant, shift ends at 21:30 (15.5h).
  {
    id:         'detention_day',
    title:      'Detention Day',
    subtitle:   "5h dock wait — you'll need Big Day",
    difficulty: 'hard',
    order:      5,

    gate: (ctx) => ({
      unlocked: (ctx.level || 1) >= 15 && !!ctx.hasMcAuthority,
      reason:   ctx.level >= 15 && ctx.hasMcAuthority
        ? null
        : 'Unlocks at Level 15 after MC Authority.',
    }),

    briefing: {
      scenario:
        "The shipper told you they'd be loaded by 09:00. It's 14:00 before you leave the dock. " +
        "Your 14-hour window started at 06:00 — it closes at 20:00, and your driving isn't done. " +
        "There IS a legal way to finish: §395.1(o) — the 16-hour Big Day exception. " +
        "But you only qualify if every condition checks out. Review your prior week carefully.",
      runData: {
        originCity:          'Nashville, TN',
        destCity:            'Birmingham, AL',
        distanceMiles:       300,
        estimatedDriveHours: 8,
        pickupWindow:        '06:30 (scheduled) — actual 14:00',
        deliveryDeadline:    '22:00 (with Big Day)',
      },
      priorWeek: {
        hoursUsed:      48,
        policy:         '70/8',
        last34Restart:  null,
        // Prior context used by Big Day qualification:
        returnedHomeLastFiveTours:    true,   // required for §395.1(o)(1)
        daysSinceLastBigDay:          10,     // well over 7-day minimum
        had34hRestartSinceLastBigDay: false,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        '§395.1(o) — the 16-hour "Big Day" exception extends the 14-hour window to 16 hours, once per 7 days.',
        'Qualification: returned home for prior 5 duty tours + return home today + ≤16h on-duty + not used in prior 6 days.',
        'Big Day does NOT extend the 11-hour driving limit. Only the window.',
        'If you claim Big Day without qualifying, that\'s a falsified log — same penalty as a window violation.',
      ],
    },

    hand: [
      hand('preTrip',       { required: true }),
      hand('driveLong',     { required: true, durationMinutes: 120,
                              label: 'Drive to shipper' }),
      hand('loadCargo',     { required: true, durationMinutes: 30 }),
      hand('detention',     { required: true, durationMinutes: 300,
                              label: '5-hour detention' }),
      hand('driveLong',     { required: true, durationMinutes: 270,    // Batch 4f-2: shaved 300→270 to fit drive
                              label: 'Drive to Birmingham area', instanceNo: 2 }),
      hand('mandatoryBreak',{ required: true, label: 'Required 30-min break' }),
      hand('driveShort',    { required: true, durationMinutes: 60,
                              label: 'Final leg' }),
      hand('unloadCargo',   { required: true, durationMinutes: 30 }),
      // Batch 4f-2: realism — drive from delivery dock to yard.
      hand('driveExtra',    { required: false, instanceNo: 3,
                              durationMinutes: 30,
                              label: 'Drive to Birmingham yard' }),
      hand('postTrip',      { required: true }),
      hand('restPeriod10h', { required: true }),  // Batch 4e-2: shift must close with rest
      // Optional flexible drive cards — for any short legs not covered
      // by the required drive cards (parking-to-shipper, dock-to-truckstop).
      hand('driveExtra',    { required: false, instanceNo: 1 }),
      hand('driveExtra',    { required: false, instanceNo: 2 }),
      // Traps — the lone PC card is tempting but NOT appropriate while
      // you're still working your way to the delivery. PC is for
      // moving the CMV off-duty for personal reasons.
      hand('personalConveyance', { required: false, durationMinutes: 20,
                                   label: 'PC: drive to dinner mid-run?' }),
    ],

    canonicalSolution: [
      step('preTrip',        6,     30,  { locationLabel: 'Nashville yard' }),
      step('driveLong',      6.5,  120,  { locationLabel: 'To shipper' }),
      step('loadCargo',      8.5,   30,  { locationLabel: 'Shipper dock',
                                           why: 'On-duty loading.' }),
      step('detention',      9,    300,  { locationLabel: 'Stuck at shipper',
                                           why: 'Window burns 09:00–14:00 while you wait. 8h of your 14h gone.' }),
      step('driveLong',     14,    270,  { locationLabel: 'Toward Birmingham',  // Batch 4f-2: shaved 300→270
                                           instanceNo: 2,
                                           why: 'Drive from minute 840 to 1110. Cumulative drive now 6.5h.' }),
      step('mandatoryBreak',18.5,   30,  { locationLabel: 'AL rest area',
                                           why: '30-min break BEFORE hitting 8h cumulative drive.' }),
      step('driveShort',    19,     60,  { locationLabel: 'Final push to Birmingham',
                                           why: 'Drive 19:00–20:00 stays inside the 14h boundary (20:00). ' +
                                                'But §395.1(o) Big Day extension still claimed for safety margin.' }),
      step('unloadCargo',   20,     30,  { locationLabel: 'Birmingham dock' }),
      // Batch 4f-2 (audit fix): postTrip happens at the same physical
      // location as unloadCargo (engine exempts this pair from drive-
      // transition requirement). Driver post-trips at the dock.
      step('postTrip',      20.5,   30,  { locationLabel: 'Birmingham dock' }),
      step('restPeriod10h', 21.0,  600,  { locationLabel: 'Birmingham — 10h rest' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
      bigDayClaimed: true,
      bigDayContext: {
        priorFiveDutyToursReturnedHome: true,
        returnsToHomeTerminal:          true,
        onDutyShiftHours:               15.5,
        daysSinceLastBigDay:            10,
        had34hRestartSinceLastBigDay:   false,
      },
    },

    scoring: {
      orderMustMatch:     true,
      startTimeTolerance: 30,
      perfectBonus:       250,
    },

    learningMoments: [
      { timeRange: [540, 840],
        annotation: '5-hour detention: on-duty waiting. Window burns, driving clock preserved.' },
      { timeRange: [1140, 1170],
        annotation: '30-min break before the 8h cumulative driving trigger.' },
      { timeRange: [1170, 1230],
        annotation: '19:30–20:30 drive CROSSES the 14h window boundary. Big Day is what makes this legal.' },
      { timeRange: [1260, 1290],
        annotation: 'Shift ends 21:30 = 15.5h from start — within the 16h Big Day ceiling.' },
    ],
  },

  // ═══ SCENARIO 6 — SHORT-HAUL EXEMPTION DAY ══════════════════════════════
  // PRE-MC ONLY. Disappears forever once MC Authority activates.
  // 100-mile radius, 5.5h drive, 8.5h on-duty, multi-stop.
  {
    id:         'short_haul_exemption',
    title:      'Short-Haul Exemption Day',
    subtitle:   'Local routes under §395.1(e)',
    difficulty: 'easy',
    order:      6,

    gate: (ctx) => ({
      unlocked: !ctx.hasMcAuthority,
      reason:   !ctx.hasMcAuthority
        ? null
        : 'This scenario is retired — once your MC Authority activates and routes exceed 150 air miles, §395.1(e) no longer applies.',
    }),

    briefing: {
      scenario: "Before MC Authority, you're running local work inside a 100-mile radius of your home base. The short-haul exemption at 49 CFR 395.1(e)(1) lets you use simpler time records instead of an ELD, and exempts you from the 30-minute break rule.",
      runData: {
        originCity:          'Home Base',
        destCity:            'Three Local Stops',
        distanceMiles:       140,
        estimatedDriveHours: 5.5,
        pickupWindow:        '06:00',
        deliveryDeadline:    '14:30',
      },
      priorWeek: {
        hoursUsed:      38,
        policy:         '70/8',
        last34Restart:  null,
      },
      truckInfo: {
        hasSleeperBerth: false,
        vehicleType:     'Non-CDL 26ft box truck',
      },
      teachingPoints: [
        '§395.1(e)(1) — 150 air-mile radius, return home within 14 hours, for any CMV driver.',
        '§395.1(e)(2) — because your truck is non-CDL (≤26k GVWR), you ALSO have a bonus: up to 16 on-duty hours on up to 2 days per week.',
        'Once MC Authority activates and you run interstate beyond 150 miles, these exemptions disappear forever.',
      ],
    },

    hand: [
      hand('preTrip',       { required: true }),
      hand('driveShort',    { required: true, durationMinutes: 90, label: 'Drive to Stop 1' }),
      hand('loadMultistop', { required: true, durationMinutes: 45, label: 'Stop 1: load', instanceNo: 1 }),
      hand('driveShort',    { required: true, durationMinutes: 60, label: 'Drive to Stop 2', instanceNo: 2 }),
      hand('loadMultistop', { required: true, durationMinutes: 30, label: 'Stop 2: load', instanceNo: 2 }),
      hand('driveShort',    { required: true, durationMinutes: 90, label: 'Drive to Stop 3', instanceNo: 3 }),
      hand('loadMultistop', { required: true, durationMinutes: 45, label: 'Stop 3: load', instanceNo: 3 }),
      hand('driveShort',    { required: true, durationMinutes: 90, label: 'Return home',    instanceNo: 4 }),
      hand('postTrip',      { required: true }),
      hand('restPeriod10h', { required: true }),    // Batch 4e-2: shift must close with rest
      // Optional flexible drive cards — short multi-stop runs frequently
      // need extra short drives between stops (loop around the block to
      // a different dock, side-trip for fuel that isn't a fuel stop tile).
      hand('driveExtra',    { required: false, instanceNo: 1 }),
      hand('driveExtra',    { required: false, instanceNo: 2 }),
      // Traps: these are technically valid to place but unnecessary under short-haul
      hand('mandatoryBreak',{ required: false }),   // teaches: short-haul exempts from this
    ],

    canonicalSolution: [
      step('preTrip',       6,     30, { locationLabel: 'Home base' }),
      step('driveShort',    6.5,   90, { locationLabel: 'Home → Stop 1' }),
      step('loadMultistop', 8,     45, { locationLabel: 'Stop 1',                instanceNo: 1 }),
      step('driveShort',    8.75,  60, { locationLabel: 'Stop 1 → Stop 2',       instanceNo: 2 }),
      step('loadMultistop', 9.75,  30, { locationLabel: 'Stop 2',                instanceNo: 2 }),
      step('driveShort',   10.25,  90, { locationLabel: 'Stop 2 → Stop 3',       instanceNo: 3 }),
      step('loadMultistop',11.75,  45, { locationLabel: 'Stop 3',                instanceNo: 3 }),
      step('driveShort',   12.5,   90, { locationLabel: 'Stop 3 → Home',         instanceNo: 4 }),
      step('postTrip',     14,     30, { locationLabel: 'Home base',
                                         why: 'Released within 14 hours — (e)(1) requirement met.' }),
      step('restPeriod10h',14.5,  600, { locationLabel: 'Home — 10h rest' }),
    ],

    validationOptions: {
      weeklyPolicy: '70/8',
      shortHaulClaimed: true,
      shortHaulContext: {
        exemption:             'e1',
        routeAirMiles:         100,
        returnsToHomeTerminal: true,
        onDutyShiftHours:      8.5,
        // (e)(2) eligibility check — even though we're claiming (e)(1),
        // the engine could auto-fall-back if we wanted:
        requiresCDL:                 false,
        sixteenHourDaysUsedThisWeek: 0,
      },
    },

    scoring: {
      orderMustMatch:     true,
      startTimeTolerance: 30,
      perfectBonus:       75,
    },

    learningMoments: [
      { timeRange: [360, 390],
        annotation: 'Short-haul drivers keep a simple time record, not full RODS.' },
      { timeRange: [660, 720],
        annotation: 'No 30-min break required — §395.3(a)(3)(ii) exempts short-haul drivers.' },
      { timeRange: [840, 870],
        annotation: 'Released within 14 hours. (e)(1) requirement met. Perfect compliance.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all scenarios available to the player given their current App.jsx state.
 * Each scenario's `gate` function is called with this context.
 *
 * @param {object} ctx  Context passed to gate functions:
 *   - hasMcAuthority: boolean
 *   - level:          number
 *   - currentDay:     number
 *   - truckId:        string
 *   - truckData:      object — expected to have `upgrades: string[]` and `hasSleeperBerth`
 * @returns {Array<{scenario, unlocked, reason}>} all scenarios plus their unlock state
 */
export function getScenarios(ctx = {}) {
  return SCENARIOS.map(scenario => {
    const gateResult = scenario.gate(ctx);
    return { scenario, unlocked: gateResult.unlocked, reason: gateResult.reason };
  });
}

/**
 * Look up a single scenario by id.
 */
export function getScenarioById(id) {
  return SCENARIOS.find(s => s.id === id) || null;
}

export default SCENARIOS;
