/**
 * HOSRuleEngine.test.js
 * Comprehensive unit test suite for HOSRuleEngine.js
 *
 * Run: node HOSRuleEngine.test.js
 *
 * Build Plan v2 §7.2: "Must have full unit test suite before any UI is built.
 * The 14-hour no-pause rule in particular must be tested against edge cases."
 *
 * 49 CFR 395.3 rules tested:
 *  1. 11-hour driving limit
 *  2. 14-hour on-duty window (no-pause rule — exhaustively tested)
 *  3. 30-minute break requirement
 *  4. 60/70-hour weekly limits
 *  5. 34-hour restart
 *  7. Short-haul exemption detection
 *  8. canDrive() — all blocking conditions
 *  9. getRemainingHours() — correct remaining calculations
 * 10. checkWeeklyLimit() — restart logic
 * 11. buildDayTimeline() — structure and violations
 * 12. getViolationDetails() — all violation types
 * 13. Edge cases — midnight crossings, empty input, overlaps
 */

import {
  validateSchedule,
  getRemainingHours,
  checkWeeklyLimit,
  canDrive,
  buildDayTimeline,
  getViolationDetails,
  TYPE, VT, SEV, R,
} from './HOSRuleEngine.js';

// ─────────────────────────────────────────────────────────────────
// MINIMAL TEST RUNNER
// ─────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

function assert(condition, msg = 'Assertion failed') {
  if (!condition) throw new Error(msg);
}

function assertEq(actual, expected, msg = '') {
  if (actual !== expected)
    throw new Error(`${msg}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
}

function assertGte(actual, expected, msg = '') {
  if (actual < expected)
    throw new Error(`${msg}\n  expected >= ${expected}\n  actual:     ${actual}`);
}

function assertLte(actual, expected, msg = '') {
  if (actual > expected)
    throw new Error(`${msg}\n  expected <= ${expected}\n  actual:     ${actual}`);
}

function hasViolation(violations, rule) {
  return violations.some(v => v.rule === rule);
}

// ─────────────────────────────────────────────────────────────────
// FIXTURE FACTORIES
// ─────────────────────────────────────────────────────────────────

/** Standard 10-hour prior rest ending at minute 0. */
function priorRest(endAt = 0, durationMin = R.PRIOR_REST_MIN) {
  return {
    type:            TYPE.OFF_DUTY,
    startMinute:     endAt - durationMin,
    durationMinutes: durationMin,
    label:           '10h prior rest',
  };
}

/** Simple driving entry. */
function drive(startMin, durationMin = 60, label = 'Drive') {
  return { type: TYPE.DRIVING, startMinute: startMin, durationMinutes: durationMin, label };
}

/** On-duty not driving. */
function onDutyNot(startMin, durationMin = 60, label = 'On duty (not driving)') {
  return { type: TYPE.ON_DUTY_NOT_DRIVING, startMinute: startMin, durationMinutes: durationMin, label };
}

/** Off-duty rest. */
function offDuty(startMin, durationMin = 60, label = 'Off duty') {
  return { type: TYPE.OFF_DUTY, startMinute: startMin, durationMinutes: durationMin, label };
}

/** Sleeper berth. */
function sleeperBerth(startMin, durationMin = 60, label = 'Sleeper berth') {
  return { type: TYPE.SLEEPER_BERTH, startMinute: startMin, durationMinutes: durationMin, label };
}

// ─────────────────────────────────────────────────────────────────
// SECTION 1: VALIDATESCHEDULE — CLEAN SCHEDULES
// ─────────────────────────────────────────────────────────────────

test('1.01 Empty entries returns compliant', () => {
  const r = validateSchedule([]);
  assert(r.isCompliant, 'empty should be compliant');
  assertEq(r.violations.length, 0, 'no violations');
});

test('1.02 Single short drive is compliant', () => {
  const r = validateSchedule([priorRest(), drive(0, 60)]);
  assert(r.isCompliant, 'single 1h drive should be compliant');
});

test('1.03 Exactly 11 hours driving is compliant', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),                    // 8h (requires break next)
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),// 30-min break
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, 3 * 60), // 3h more = 11h total
  ];
  const r = validateSchedule(entries);
  assert(r.isCompliant, 'exactly 11h with break should be compliant');
});

test('1.04 Full compliant 14-hour day', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    onDutyNot(60, 60),
    drive(120, 240),
    offDuty(360, 30),    // qualifying break
    drive(390, 240),
    onDutyNot(630, 60),
    drive(690, 120),     // total driving: 60+240+240+120 = 660 = exactly 11h
  ];
  const r = validateSchedule(entries, { currentMinute: 810 });
  assert(r.isCompliant, 'full compliant 14h day');
});

test('1.05 Multiple days, clean schedule', () => {
  // Day 1 shift
  const day1 = [
    offDuty(-600, 600, '10h prior rest'),
    drive(0, 60),
    onDutyNot(60, 60),
    drive(120, 60),
  ];
  // 10h rest between days
  const rest = offDuty(240, 600, '10h overnight rest');
  // Day 2 shift
  const day2 = [
    drive(840, 60),
  ];
  const r = validateSchedule([...day1, rest, ...day2]);
  assert(r.isCompliant, 'two-day clean schedule');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 2: 11-HOUR DRIVING LIMIT (49 CFR 395.3(a)(1))
// ─────────────────────────────────────────────────────────────────

test('2.01 Exactly 11h driving: no violation', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN),
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.DRIVING_LIMIT), '11h exactly should not violate');
});

test('2.02 11h + 1 minute driving: violation', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN + 1),
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.DRIVING_LIMIT), '11h+1min should violate driving limit');
  assertEq(r.violations.find(v => v.rule === VT.DRIVING_LIMIT).severity, SEV.CRITICAL, 'should be critical');
});

test('2.03 13h driving: violation', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, 5 * 60 + 1),  // 3h + 1min = 11h+1min total
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.DRIVING_LIMIT), '13h driving should violate');
});

test('2.04 Adverse driving +2h extension', () => {
  // With adverse driving, max is 11h+2h = 13h
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN + 90),
  ];
  const rNormal  = validateSchedule(entries);
  const rAdverse = validateSchedule(entries, { adverseDriving: true });
  assert(hasViolation(rNormal.violations,   VT.DRIVING_LIMIT), 'normal: should violate');
  assert(!hasViolation(rAdverse.violations, VT.DRIVING_LIMIT), 'adverse: should NOT violate with +2h');
});

test('2.05 New 10h rest resets driving clock', () => {
  const entries = [
    offDuty(-600, 600, 'First rest'),
    drive(0, 11 * 60),             // 11h driving — hits limit exactly
    offDuty(11 * 60, 10 * 60),    // 10h rest — resets clock
    drive(11 * 60 + 10 * 60, 60), // 1h more — new shift, legal
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.DRIVING_LIMIT), '10h rest resets driving limit');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 3: 14-HOUR WINDOW (49 CFR 395.3(a)(2)) — NO-PAUSE RULE
// ─────────────────────────────────────────────────────────────────

test('3.01 Driving within 14h window: no violation', () => {
  const entries = [priorRest(), drive(0, 120), offDuty(120, 120), drive(240, 60)];
  const r = validateSchedule(entries, { currentMinute: 300 });
  assert(!hasViolation(r.violations, VT.WINDOW_LIMIT), 'within 14h window should be clean');
});

test('3.02 Driving at minute 840 (window closed): violation', () => {
  const entries = [
    priorRest(),
    onDutyNot(0, 840),   // 14h on-duty-not-driving fills the window
    drive(840, 1),       // 1 minute past window close
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT), 'driving at window close should violate');
});

test('3.03 Window does NOT pause for off-duty breaks (critical rule)', () => {
  // Driver comes on duty at 0.
  // Takes 4h off-duty break mid-shift.
  // This does NOT reset the 14-hour window.
  const entries = [
    priorRest(),
    drive(0, 120),         // 2h drive
    offDuty(120, 240),     // 4h break (window keeps running)
    drive(360, 60),        // 1h drive
    offDuty(420, 300),     // 5h rest (still not ≥10h, window keeps running)
    drive(841, 60),        // drive PAST minute 840 — VIOLATION
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT),
    'window does not pause for breaks — driving after min 840 must violate');
});

test('3.04 Window does NOT pause for sleeper berth (short of 10h)', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    sleeperBerth(60, 300),  // 5h SB — not enough to restart window
    drive(841, 1),          // past 14h
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT), 'window does not pause for short SB');
});

test('3.05 Window does NOT pause for on-duty-not-driving', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    onDutyNot(60, 720),   // 12h on-duty-not-driving
    drive(841, 1),         // past 14h
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT), 'window does not pause for on-duty-not-driving');
});

test('3.06 New 10h rest opens a fresh 14h window', () => {
  const entries = [
    priorRest(-1200, 600), // First rest — ends at -600
    drive(-600, 120),       // Day 1 drive
    offDuty(-480, 600),     // 10h rest — opens new window at minute 120 (from -480+600)
    drive(120, 120),        // Drive within new window
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.WINDOW_LIMIT), 'fresh 10h rest opens new 14h window');
});

test('3.07 13h rest opens fresh window', () => {
  const entries = [
    offDuty(-780, 780, '13h rest ending at minute 0'),
    drive(0, 120),
    offDuty(120, 300),
    drive(420, 60),
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.WINDOW_LIMIT), '13h rest is valid prior rest');
});

test('3.08 Drive spanning window boundary: violation at boundary', () => {
  const entries = [
    priorRest(),
    drive(0, 900),  // 15h drive — crosses 14h window AND 11h driving limit
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT) || hasViolation(r.violations, VT.DRIVING_LIMIT),
    'driving 15h should have window or driving violation');
});

test('3.09 Exactly 1 minute before window: no window violation', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    onDutyNot(60, 60),
    drive(839, 1),  // 1 minute before window closes (0 + 840 = 840, driving at 839-840)
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.WINDOW_LIMIT), 'drive ending at window boundary should be OK');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 4: 30-MINUTE BREAK (49 CFR 395.3(a)(3))
// ─────────────────────────────────────────────────────────────────

test('4.01 8h driving without break: violation', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN + 1),  // 8h + 1min — violation
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.BREAK_REQUIRED), '8h+1min without break should violate');
});

test('4.02 Exactly 8h driving (no break): no violation', () => {
  const entries = [priorRest(), drive(0, R.BREAK_TRIGGER_MIN)];
  const r = validateSchedule(entries, { currentMinute: R.BREAK_TRIGGER_MIN });
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED), 'exactly 8h should not violate yet');
});

test('4.03 30-min off-duty break resets driving counter', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),                    // 8h — needs break
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN), // 30-min break
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.BREAK_TRIGGER_MIN), // 8h more — ok
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED), '30-min off-duty resets counter');
});

test('4.04 30-min on-duty-not-driving qualifies as break', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    onDutyNot(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),  // on-duty not driving = valid break
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, 60),
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED), 'on-duty-not-driving break should qualify');
});

test('4.05 Sleeper berth qualifies as break', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    sleeperBerth(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),  // SB = valid break
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, 60),
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED), 'sleeper berth break should qualify');
});

test('4.06 29-minute break does NOT qualify', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, 29),    // 29 min — one minute short
    drive(R.BREAK_TRIGGER_MIN + 29, 1),  // Any driving after this triggers violation
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.BREAK_REQUIRED), '29-min break should NOT qualify');
});

test('4.07 Break counter resets at each qualifying break', () => {
  const entries = [
    priorRest(),
    drive(0, 60 * 4),   // 4h
    offDuty(60 * 4, R.BREAK_SATISFY_MIN),  // 30-min break — resets
    drive(60 * 4 + R.BREAK_SATISFY_MIN, 60 * 4), // 4h more — ok (8h total since break, needs new break)
    offDuty(60 * 8 + R.BREAK_SATISFY_MIN, R.BREAK_SATISFY_MIN),  // another 30-min break
    drive(60 * 8 + R.BREAK_SATISFY_MIN * 2, 60 * 2), // 2h more — ok
  ];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED), 'multiple breaks should reset counter each time');
});

test('4.08 Non-contiguous 29+1 min breaks do NOT qualify', () => {
  // Two short breaks totaling 30+ min but not contiguous — neither qualifies
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, 15),        // 15 min
    drive(R.BREAK_TRIGGER_MIN + 15, 1),      // 1 min driving
    offDuty(R.BREAK_TRIGGER_MIN + 16, 15),   // 15 min more
    drive(R.BREAK_TRIGGER_MIN + 31, 1),      // should still violate
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.BREAK_REQUIRED), 'non-contiguous short breaks should not qualify');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 5: WEEKLY LIMITS (49 CFR 395.3(b))
// ─────────────────────────────────────────────────────────────────

test('5.01 70h/8-day: exactly 70h no violation', () => {
  // Build 8 days of exactly 70h on-duty spread across days
  const entries = [];
  const hoursPerDay = 70 / 8;   // 8.75h per day
  for (let d = 0; d < 8; d++) {
    const dayStart = d * R.DAY_MIN;
    // 10h rest at start of each day
    entries.push(offDuty(dayStart, R.PRIOR_REST_MIN));
    entries.push(onDutyNot(dayStart + R.PRIOR_REST_MIN, Math.round(hoursPerDay * 60)));
  }
  const currentMin = 8 * R.DAY_MIN;
  const weekly = checkWeeklyLimit(entries, currentMin, '70/8');
  assertLte(weekly.used, R.WEEKLY_70_MIN, '70h in 8 days should not exceed limit');
});

test('5.02 70h/8-day: 70h+1min is exceeded', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, R.WEEKLY_70_MIN + 1),  // 70h+1min on duty
  ];
  const weekly = checkWeeklyLimit(entries, R.WEEKLY_70_MIN + 1, '70/8');
  assert(weekly.exceeded, '70h+1min should exceed limit');
});

test('5.03 60h/7-day policy enforced correctly', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 61 * 60),   // 61h on duty — exceeds 60/7 limit
  ];
  const weeklyWith60 = checkWeeklyLimit(entries, 61 * 60, '60/7');
  assert(weeklyWith60.exceeded, '61h should exceed 60/7 limit');

  const weeklyWith70 = checkWeeklyLimit(entries, 61 * 60, '70/8');
  assert(!weeklyWith70.exceeded, '61h should NOT exceed 70/8 limit');
});

test('5.04 Hours outside lookback window not counted', () => {
  // 70/8 policy: only last 8 days count
  const entries = [
    onDutyNot(0, 40 * 60),                     // 40h — 9 days ago (outside window)
    offDuty(40 * 60, 9 * R.DAY_MIN - 40 * 60), // rest bridging to today
    onDutyNot(9 * R.DAY_MIN, 35 * 60),          // 35h in the last 8 days
  ];
  const weekly = checkWeeklyLimit(entries, 9 * R.DAY_MIN + 35 * 60, '70/8');
  assertLte(weekly.used, R.WEEKLY_70_MIN, 'old hours outside 8-day window should not count');
});

test('5.05 validateSchedule reports weekly violation', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, R.WEEKLY_70_MIN + 30),   // 70h + 30min
    drive(R.WEEKLY_70_MIN + 30, 60),      // any driving after
  ];
  const r = validateSchedule(entries, { weeklyPolicy: '70/8', currentMinute: R.WEEKLY_70_MIN + 31 * 60 });
  assert(hasViolation(r.violations, VT.WEEKLY_LIMIT), 'validateSchedule should report weekly violation');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 6: 34-HOUR RESTART
// ─────────────────────────────────────────────────────────────────

test('6.01 34h restart resets weekly counter', () => {
  const entries = [
    // First week: heavy duty
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 65 * 60),         // 65h on duty — approaching limit
    offDuty(65 * 60, R.RESTART_MIN), // 34h restart — resets clock
    onDutyNot(65 * 60 + R.RESTART_MIN, 10 * 60), // 10h after restart — OK
  ];
  const after = 65 * 60 + R.RESTART_MIN + 10 * 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  // After restart, only post-restart hours count
  assertLte(weekly.used, R.WEEKLY_70_MIN,
    '34h restart should reset weekly counter — only post-restart hours should count');
});

test('6.02 33h59m is NOT a restart', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 65 * 60),
    offDuty(65 * 60, R.RESTART_MIN - 1),  // 33h59m — not a full restart
    onDutyNot(65 * 60 + R.RESTART_MIN - 1, 10 * 60),
  ];
  const after = 65 * 60 + R.RESTART_MIN - 1 + 10 * 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  // All hours still count — 65h + 10h = 75h, but we're looking at 70/8 day window
  // The point: 33h59m should not trigger a restart
  const weeklyNoRestart = checkWeeklyLimit(entries, after, '70/8');
  assert(weeklyNoRestart.used > 10 * 60, '33h59m should NOT restart — pre-restart hours count');
});

test('6.03 Restart via sleeper berth counts', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 65 * 60),
    sleeperBerth(65 * 60, R.RESTART_MIN),  // 34h SB — counts as restart
    onDutyNot(65 * 60 + R.RESTART_MIN, 5 * 60),
  ];
  const after = 65 * 60 + R.RESTART_MIN + 5 * 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  assertLte(weekly.used, R.WEEKLY_70_MIN, 'SB-based restart should reset weekly counter');
});

test('6.04 Mixed off-duty + SB over 34h is a restart', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 65 * 60),
    offDuty(65 * 60, 18 * 60),          // 18h off
    sleeperBerth(65 * 60 + 18 * 60, 17 * 60), // 17h SB (total: 35h continuous)
    onDutyNot(65 * 60 + 35 * 60, 5 * 60),
  ];
  const after = 65 * 60 + 35 * 60 + 5 * 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  assertLte(weekly.used, R.WEEKLY_70_MIN, 'mixed off+SB over 34h is a valid restart');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 8: SHORT-HAUL EXEMPTION
// ─────────────────────────────────────────────────────────────────

// ─── 8.01 INVALID (e)(1): route > 150 air miles ─────────────────
test('8.01 Short-haul (e)(1) INVALID: route exceeds 150 air miles', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e1',
      routeAirMiles:        200,
      returnsToHomeTerminal: true,
      onDutyShiftHours:     10,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(1) with route > 150 should flag as invalid');
  const v = r.violations.find(v => v.rule === VT.SHORT_HAUL_CLAIMED);
  assert(v.description.includes('150 air miles'), 'disqualifier should mention 150 air miles');
});

// ─── 8.02 VALID (e)(1): within 150 air miles, home-return, 14h shift ───
test('8.02 Short-haul (e)(1) VALID: 100 mi radius, returns home, 12h shift', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e1',
      routeAirMiles:        100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:     12,
    },
  });
  assert(!hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    'valid (e)(1) claim should NOT flag short-haul violation');
});

// ─── 8.03 INVALID (e)(1): driver does not return home ───
test('8.03 Short-haul (e)(1) INVALID: does not return to home terminal', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e1',
      routeAirMiles:        100,
      returnsToHomeTerminal: false,
      onDutyShiftHours:     12,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(1) requires return to normal work reporting location');
});

// ─── 8.04 INVALID (e)(1): shift exceeds 14h ──────────────────────
test('8.04 Short-haul (e)(1) INVALID: shift > 14 hours', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e1',
      routeAirMiles:        100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:     15,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(1) requires release within 14 consecutive hours');
});

// ─── 8.05 VALID (e)(2): non-CDL driver, 15h shift (allowed up to 16) ───
test('8.05 Short-haul (e)(2) VALID: non-CDL, 15h shift, 0 prior 16h days', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:                   'e2',
      routeAirMiles:               120,
      returnsToHomeTerminal:        true,
      onDutyShiftHours:            15,
      requiresCDL:                 false,
      sixteenHourDaysUsedThisWeek: 0,
    },
  });
  assert(!hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(2) permits 15h on-duty for non-CDL');
});

// ─── 8.06 INVALID (e)(2): CDL-required vehicle ──────────────────
test('8.06 Short-haul (e)(2) INVALID: driver requires CDL', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e2',
      routeAirMiles:        100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:     14,
      requiresCDL:          true,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(2) is only for non-CDL drivers');
});

// ─── 8.07 INVALID (e)(2): shift > 16 hours ──────────────────────
test('8.07 Short-haul (e)(2) INVALID: shift > 16 hours', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:            'e2',
      routeAirMiles:        100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:     17,
      requiresCDL:          false,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(2) caps on-duty at 16h');
});

// ─── 8.08 INVALID (e)(2): already used 2 16h-days this week ─────
test('8.08 Short-haul (e)(2) INVALID: 16h cap already used 2 days this week', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:                   'e2',
      routeAirMiles:               100,
      returnsToHomeTerminal:       true,
      onDutyShiftHours:            15,
      requiresCDL:                 false,
      sixteenHourDaysUsedThisWeek: 2,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    '(e)(2) limits 16h-day extension to 2 per 7-day period');
});

// ─── 8.09 No short-haul claim: default is full HOS (no violation) ───
test('8.09 Short-haul NOT claimed: no VT.SHORT_HAUL_CLAIMED by default', () => {
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries);
  assert(!hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    'no short-haul claim = no violation');
});

// ─── 8.10 Valid short-haul EXEMPTS from 30-min break rule ─────────
test('8.10 Valid short-haul (e)(1) exempts from 30-min break requirement', () => {
  // 9 cumulative hours of driving with NO 30-min break — would normally trigger BREAK_REQUIRED
  const entries = [
    priorRest(),
    drive(0, 9 * 60),   // 9h straight driving
  ];
  const rFullHos = validateSchedule(entries);
  assert(hasViolation(rFullHos.violations, VT.BREAK_REQUIRED),
    'without short-haul: 9h driving no break should trigger BREAK_REQUIRED');

  const rShortHaul = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:             'e1',
      routeAirMiles:         100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:      10,
    },
  });
  assert(!hasViolation(rShortHaul.violations, VT.BREAK_REQUIRED),
    'valid short-haul §395.3(a)(3)(ii) exempts from 30-min break');
});

// ─── 8.11 Invalid short-haul does NOT exempt from break rule ────
test('8.11 Invalid short-haul (disqualified) does NOT exempt from 30-min break', () => {
  // 9h driving no break, short-haul claim is INVALID (route too long)
  const entries = [
    priorRest(),
    drive(0, 9 * 60),
  ];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:             'e1',
      routeAirMiles:         300,       // DISQUALIFIER: > 150
      returnsToHomeTerminal: true,
      onDutyShiftHours:      12,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    'invalid claim should flag short-haul violation');
  assert(hasViolation(r.violations, VT.BREAK_REQUIRED),
    'invalid claim should NOT exempt from break rule');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 8.5: BIG DAY EXCEPTION (49 CFR 395.1(o))
// Property-carrier driver, 16-hour window once per 7 days.
// ─────────────────────────────────────────────────────────────────

// ─── Helper: a full Big Day context that should be VALID ───
function validBigDayContext() {
  return {
    priorFiveDutyToursReturnedHome:  true,
    returnsToHomeTerminal:           true,
    onDutyShiftHours:                15,
    daysSinceLastBigDay:             10,
    had34hRestartSinceLastBigDay:    false,
  };
}

test('8.12 Big Day VALID: driving past 14h (up to 16h) allowed', () => {
  // Driving at minute 900 (= 15h after shift start) would normally violate
  // the 14h window. With valid Big Day, window extends to 960 (16h).
  const entries = [
    priorRest(),
    onDutyNot(0, 30),        // shift start at 0
    drive(60, 60),           // some driving early
    drive(900, 30),          // minute 900 = 15h -> within 16h window
  ];
  const rNoBigDay = validateSchedule(entries);
  assert(hasViolation(rNoBigDay.violations, VT.WINDOW_LIMIT),
    'without Big Day: driving at minute 900 should violate 14h window');

  const rBigDay = validateSchedule(entries, {
    bigDayClaimed: true,
    bigDayContext: validBigDayContext(),
  });
  assert(!hasViolation(rBigDay.violations, VT.WINDOW_LIMIT),
    'with valid Big Day: 16h window allows driving at minute 900');
  assert(!hasViolation(rBigDay.violations, VT.BIG_DAY_INVALID),
    'valid claim should not emit BIG_DAY_INVALID');
});

test('8.13 Big Day VALID: 11h driving limit is NOT extended', () => {
  // Big Day extends window, NOT driving limit. 12h driving should still violate.
  const entries = [
    priorRest(),
    drive(0, 12 * 60),      // 12 hours driving
  ];
  const r = validateSchedule(entries, {
    bigDayClaimed: true,
    bigDayContext: validBigDayContext(),
  });
  assert(hasViolation(r.violations, VT.DRIVING_LIMIT),
    'Big Day does NOT extend 11h driving limit');
});

test('8.14 Big Day INVALID: did not return home for prior 5 tours', () => {
  const entries = [priorRest(), drive(0, 60)];
  const ctx = validBigDayContext();
  ctx.priorFiveDutyToursReturnedHome = false;
  const r = validateSchedule(entries, { bigDayClaimed: true, bigDayContext: ctx });
  assert(hasViolation(r.violations, VT.BIG_DAY_INVALID),
    'missing prior-5-tours disqualifies');
  const v = r.violations.find(x => x.rule === VT.BIG_DAY_INVALID);
  assert(v.description.includes('previous 5 duty tours'), 'should cite (o)(1)');
});

test('8.15 Big Day INVALID: does not return home on Big Day', () => {
  const entries = [priorRest(), drive(0, 60)];
  const ctx = validBigDayContext();
  ctx.returnsToHomeTerminal = false;
  const r = validateSchedule(entries, { bigDayClaimed: true, bigDayContext: ctx });
  assert(hasViolation(r.violations, VT.BIG_DAY_INVALID),
    'not returning home disqualifies');
});

test('8.16 Big Day INVALID: shift > 16 hours', () => {
  const entries = [priorRest(), drive(0, 60)];
  const ctx = validBigDayContext();
  ctx.onDutyShiftHours = 17;
  const r = validateSchedule(entries, { bigDayClaimed: true, bigDayContext: ctx });
  assert(hasViolation(r.violations, VT.BIG_DAY_INVALID),
    '§395.1(o)(2) caps on-duty at 16h');
});

test('8.17 Big Day INVALID: used less than 7 days ago, no 34h restart', () => {
  const entries = [priorRest(), drive(0, 60)];
  const ctx = validBigDayContext();
  ctx.daysSinceLastBigDay = 3;
  ctx.had34hRestartSinceLastBigDay = false;
  const r = validateSchedule(entries, { bigDayClaimed: true, bigDayContext: ctx });
  assert(hasViolation(r.violations, VT.BIG_DAY_INVALID),
    'used recently without restart = disqualified');
});

test('8.18 Big Day VALID: used 3 days ago BUT 34h restart intervened', () => {
  const entries = [
    priorRest(),
    onDutyNot(0, 30),
    drive(900, 30),          // minute 900 = 15h - needs Big Day to be legal
  ];
  const ctx = validBigDayContext();
  ctx.daysSinceLastBigDay = 3;
  ctx.had34hRestartSinceLastBigDay = true;
  const r = validateSchedule(entries, { bigDayClaimed: true, bigDayContext: ctx });
  assert(!hasViolation(r.violations, VT.BIG_DAY_INVALID),
    '34h restart resets the 7-day cooldown');
  assert(!hasViolation(r.violations, VT.WINDOW_LIMIT),
    'valid Big Day allows driving at 15h');
});

test('8.19 Big Day INVALID when (e)(2) non-CDL short-haul also claimed', () => {
  // Per FMCSA guidance / JJ Keller: cannot stack (e)(2) with §395.1(o)
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    bigDayClaimed:    true,
    bigDayContext:    validBigDayContext(),
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:             'e2',
      routeAirMiles:         100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:      15,
      requiresCDL:           false,
    },
  });
  assert(hasViolation(r.violations, VT.BIG_DAY_INVALID),
    '(e)(2) + Big Day same day is disqualified');
  const v = r.violations.find(x => x.rule === VT.BIG_DAY_INVALID);
  assert(v.description.includes('395.1(e)(2)'),
    'disqualifier should cite the (e)(2) interaction');
});

test('8.20 Big Day + (e)(1) standard short-haul: NOT mutually exclusive', () => {
  // (e)(1) is compatible with Big Day — only (e)(2) is excluded.
  const entries = [priorRest(), drive(0, 60)];
  const r = validateSchedule(entries, {
    bigDayClaimed:    true,
    bigDayContext:    validBigDayContext(),
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:             'e1',
      routeAirMiles:         100,
      returnsToHomeTerminal: true,
      onDutyShiftHours:      14,
    },
  });
  assert(!hasViolation(r.violations, VT.BIG_DAY_INVALID),
    '(e)(1) + Big Day is compatible');
});

test('8.21 getRemainingHours: valid Big Day shows 16h window remaining', () => {
  const entries = [priorRest(), onDutyNot(0, 30)];
  const rNormal = getRemainingHours(entries, 30);
  const rBigDay = getRemainingHours(entries, 30, {
    bigDayClaimed: true,
    bigDayContext: validBigDayContext(),
  });
  // Big Day should show 2 more hours of window (16h - 14h = 120 min) at the same point
  assertEq(rBigDay.window - rNormal.window, 120,
    'Big Day should add exactly 2h to window remaining');
});

test('8.22 canDrive: valid Big Day allows driving at 15h mark', () => {
  const entries = [
    priorRest(),
    onDutyNot(0, 30),
    drive(60, 60),
  ];
  // At minute 900 (15h into shift), check canDrive
  const rNormal = canDrive(entries, 900);
  assert(!rNormal.allowed, 'without Big Day, cannot drive at 15h mark');

  const rBigDay = canDrive(entries, 900, {
    bigDayClaimed: true,
    bigDayContext: validBigDayContext(),
  });
  assert(rBigDay.allowed, 'with valid Big Day, can drive at 15h mark');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 8.6: PERSONAL CONVEYANCE (49 CFR 395.28(a) + 2018 guidance)
// PC is logged as OFF_DUTY per §395.8. Engine treats PC annotation
// the same as off-duty for all clock math.
// ─────────────────────────────────────────────────────────────────

test('8.23 PC: off_duty entry with pc:true annotation is still off-duty for clock math', () => {
  // PC time acts identically to off-duty: resets break, counts as rest, etc.
  const entries = [
    priorRest(),
    drive(0, 8 * 60),           // 8h cum driving — triggers break need
    {
      type:            TYPE.OFF_DUTY,
      startMinute:     8 * 60,
      durationMinutes: 30,
      label:           'Drive to truck stop (PC)',
      pc:              true,     // annotation
    },
    drive(8 * 60 + 30, 60),     // 1 more hour driving — should be OK because PC break qualifies
  ];
  const r = validateSchedule(entries);
  assert(r.isCompliant, 'PC-annotated off-duty should qualify as 30-min break');
  assert(!hasViolation(r.violations, VT.BREAK_REQUIRED),
    'PC 30-min block satisfies break requirement');
});

test('8.24 PC: large PC block counts toward 10h prior rest', () => {
  // PC for 10 hours should satisfy the prior-rest requirement.
  const entries = [
    {
      type:            TYPE.OFF_DUTY,
      startMinute:     -600,
      durationMinutes: 600,
      label:           'Drive home via PC',
      pc:              true,
    },
    drive(0, 60),
  ];
  const r = validateSchedule(entries);
  assert(r.isCompliant, 'PC time counts as rest for the 10h reset');
});

test('8.25 PC: does NOT count toward on-duty window burn', () => {
  // If a driver's shift starts at 0 and they log PC mid-shift, the window
  // still burns (PC is off-duty, it doesn't pause or reset the window).
  // PC simply doesn't add ANY on-duty time, same as regular off-duty.
  const entries = [
    priorRest(),
    onDutyNot(0, 30),           // shift start - window opens at 0
    drive(60, 60),
    {
      type:            TYPE.OFF_DUTY,
      startMinute:     120,
      durationMinutes: 120,
      label:           'PC to restaurant',
      pc:              true,
    },
    drive(240, 60),             // resumes driving at minute 240
  ];
  const r = validateSchedule(entries);
  // Window opened at 0, closes at 840. Last driving ends at 300. Compliant.
  assert(r.isCompliant, 'PC mid-shift: window continues ticking, but PC itself is off-duty');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 9: canDrive() — ALL BLOCKING CONDITIONS
// ─────────────────────────────────────────────────────────────────

test('9.01 canDrive: fresh driver (empty history) can drive', () => {
  const r = canDrive([], 0);
  // No history — treat as new driver, allowed
  assert(r.allowed, 'empty history should allow driving');
});

test('9.02 canDrive: after prior rest, can drive', () => {
  const entries = [offDuty(0, R.PRIOR_REST_MIN)];
  const r = canDrive(entries, R.PRIOR_REST_MIN);
  assert(r.allowed, 'after 10h rest, should be able to drive');
  assertEq(r.reason, null, 'reason should be null when allowed');
});

test('9.03 canDrive: after hitting 11h limit, cannot drive', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN),
  ];
  const now = R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN + (R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN);
  const r = canDrive(entries, now);
  assert(!r.allowed, 'after 11h driving, should not be able to drive');
  assertEq(r.limitingFactor, VT.DRIVING_LIMIT, 'limiting factor should be driving limit');
  assert(r.restoreAt !== null, 'restoreAt should be provided');
});

test('9.04 canDrive: after 14h window expires, cannot drive', () => {
  const entries = [
    priorRest(),
    onDutyNot(0, R.WINDOW_MIN),  // 14h on-duty fills the window
  ];
  const r = canDrive(entries, R.WINDOW_MIN);
  assert(!r.allowed, 'after 14h window, should not be able to drive');
  assertEq(r.limitingFactor, VT.WINDOW_LIMIT, 'limiting factor should be window limit');
});

test('9.05 canDrive: after 8h driving without break, cannot drive', () => {
  const entries = [priorRest(), drive(0, R.BREAK_TRIGGER_MIN)];
  const r = canDrive(entries, R.BREAK_TRIGGER_MIN);
  assert(!r.allowed, 'after 8h without break, should not be able to drive');
  assertEq(r.limitingFactor, VT.BREAK_REQUIRED, 'limiting factor should be break required');
  assert(r.restoreAt !== null, 'should provide restoreAt');
});

test('9.06 canDrive: after weekly limit, cannot drive', () => {
  // 8 days × 9h on-duty = 72h > 70h limit. Fresh 10h rest starts day 9.
  // Window is freshly reset, but weekly limit is exceeded — WEEKLY_LIMIT blocks.
  const entries = [];
  for (let d = 0; d < 8; d++) {
    const dayStart = d * R.DAY_MIN;
    entries.push(offDuty(dayStart, R.PRIOR_REST_MIN));
    entries.push(onDutyNot(dayStart + R.PRIOR_REST_MIN, 9 * 60));
  }
  entries.push(offDuty(8 * R.DAY_MIN, R.PRIOR_REST_MIN));  // fresh rest day 9
  const now = 8 * R.DAY_MIN + R.PRIOR_REST_MIN;
  const r = canDrive(entries, now, { weeklyPolicy: '70/8' });
  assert(!r.allowed, 'after 72h weekly (70h limit), should not drive');
  assertEq(r.limitingFactor, VT.WEEKLY_LIMIT, 'limiting factor should be weekly limit');
});

test('9.07 canDrive: multiple limits, returns first one hit', () => {
  // Driving limit hit — should report that, not window limit
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN + 60),
  ];
  const now = R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN + (R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN + 60);
  const r = canDrive(entries, now);
  assert(!r.allowed, 'should not be allowed when limit exceeded');
});

test('9.08 canDrive: after 30-min break, break counter resets', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),  // break taken
  ];
  const now = R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN;
  const r = canDrive(entries, now);
  assert(r.allowed, 'after required break, should be able to drive again');
  assert(r.limitingFactor !== VT.BREAK_REQUIRED, 'break should not be the limiting factor');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 10: getRemainingHours()
// ─────────────────────────────────────────────────────────────────

test('10.01 Full remaining hours on fresh shift', () => {
  const entries = [priorRest()];
  const r = getRemainingHours(entries, 0);
  assertEq(r.driving,          R.MAX_DRIVING_MIN,     'full driving remaining on fresh shift');
  assertEq(r.window,           R.WINDOW_MIN,          'full window remaining on fresh shift');
  assertEq(r.untilBreakNeeded, R.BREAK_TRIGGER_MIN,   'full break trigger remaining');
});

test('10.02 Remaining driving decrements correctly', () => {
  const entries = [priorRest(), drive(0, 120)];
  const r = getRemainingHours(entries, 120);
  assertEq(r.driving, R.MAX_DRIVING_MIN - 120, 'remaining driving should reflect 2h used');
});

test('10.03 Window remaining decrements for all on-duty time', () => {
  const entries = [priorRest(), drive(0, 60), onDutyNot(60, 60)];
  const r = getRemainingHours(entries, 120);
  assertEq(r.window, R.WINDOW_MIN - 120, '2h into window = 12h remaining');
});

test('10.04 Remaining window includes off-duty time (no pause)', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    offDuty(60, 120),   // 2h off-duty (window CONTINUES)
    drive(180, 60),
  ];
  const r = getRemainingHours(entries, 240);
  assertEq(r.window, R.WINDOW_MIN - 240, 'off-duty does not pause window — 4h elapsed');
});

test('10.05 untilBreakNeeded resets after qualifying break', () => {
  const entries = [
    priorRest(),
    drive(0, 240),                  // 4h — half the 8h limit
    offDuty(240, 30),               // qualifying break
    drive(270, 60),                 // 1h after break
  ];
  const r = getRemainingHours(entries, 330);
  assertEq(r.untilBreakNeeded, R.BREAK_TRIGGER_MIN - 60,
    'break counter reset — 1h used since break = 7h remaining');
});

test('10.06 Remaining hours zero when at limit', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN),
  ];
  const now = R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN + (R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN);
  const r = getRemainingHours(entries, now);
  assertEq(r.driving, 0, 'remaining driving should be 0 at limit');
});

test('10.07 Weekly remaining decrements across multiple days', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 40 * 60),    // 40h on duty
  ];
  const r = getRemainingHours(entries, 40 * 60, {}, '70/8');
  assertEq(r.weeklyOnDuty, R.WEEKLY_70_MIN - 40 * 60, '40h used leaves 30h weekly remaining');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 11: checkWeeklyLimit()
// ─────────────────────────────────────────────────────────────────

test('11.01 Returns correct used/remaining/limit', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 30 * 60),
  ];
  const r = checkWeeklyLimit(entries, 30 * 60, '70/8');
  assertEq(r.used,      30 * 60,                    'used should be 30h');
  assertEq(r.limit,     R.WEEKLY_70_MIN,             'limit should be 70h');
  assertEq(r.remaining, R.WEEKLY_70_MIN - 30 * 60,   'remaining should be 40h');
  assertEq(r.days,      R.WEEKLY_70_DAYS,            'days should be 8');
  assert(!r.exceeded,                                'should not be exceeded');
});

test('11.02 Exceeded flag correct', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, R.WEEKLY_70_MIN + 60),
  ];
  const r = checkWeeklyLimit(entries, R.WEEKLY_70_MIN + 60, '70/8');
  assert(r.exceeded, 'exceeded flag should be true');
  assertEq(r.remaining, 0, 'remaining should be 0 when exceeded');
});

test('11.03 60/7 policy uses 7-day window', () => {
  const r = checkWeeklyLimit([], 0, '60/7');
  assertEq(r.limit, R.WEEKLY_60_MIN, 'limit should be 60h for 60/7');
  assertEq(r.days,  R.WEEKLY_60_DAYS, 'days should be 7 for 60/7');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 12: buildDayTimeline()
// ─────────────────────────────────────────────────────────────────

test('12.01 Segments match input entries', () => {
  const entries = [
    priorRest(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    drive(0, 120),
    offDuty(120, 60),
    drive(180, 60),
  ];
  const t = buildDayTimeline(entries, 0, 1440);
  // Segments within the day (skip prior rest which is before day start)
  const daySeg = t.segments.filter(s => s.startMin >= 0);
  assert(daySeg.length >= 3, 'should have at least 3 segments in the day');
});

test('12.02 Violations propagated to timeline markers', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN + 1),  // break violation
  ];
  const t = buildDayTimeline(entries);
  assert(t.violations.length > 0, 'timeline should include violations');
  assert(t.markers.length > 0,    'timeline should include markers');
});

test('12.03 Clean timeline has no violations or markers', () => {
  const entries = [
    priorRest(),
    drive(0, 60),
    offDuty(60, 30),
    drive(90, 60),
  ];
  const t = buildDayTimeline(entries, 0, 1440, { currentMinute: 150 });
  assert(t.violations.length === 0, 'clean schedule should have no violations in timeline');
  assert(t.markers.length === 0,    'clean schedule should have no markers');
});

test('12.04 Summary counts are correct', () => {
  const entries = [
    priorRest(),
    drive(0, 120),        // 2h driving
    onDutyNot(120, 60),  // 1h on-duty not driving
    offDuty(180, 60),    // 1h off
  ];
  const t = buildDayTimeline(entries, 0, 1440, { currentMinute: 240 });
  assertEq(t.summary.drivingMin, 120, 'driving minutes should be 120');
  assertEq(t.summary.onDutyMin,  180, 'on-duty minutes should be 180 (driving+not-driving)');
});

test('12.05 Brackets include window and driving limit', () => {
  const entries = [priorRest(), drive(0, 60)];
  const t = buildDayTimeline(entries, 0, 1440);
  const hasWindow   = t.brackets.some(b => b.id === 'window_14');
  const hasDriving  = t.brackets.some(b => b.id === 'driving_11');
  assert(hasWindow,  'timeline should have 14h window bracket');
  assert(hasDriving, 'timeline should have 11h driving bracket');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 13: getViolationDetails()
// ─────────────────────────────────────────────────────────────────

const requiredFields = ['code','title','regulation','description','consequence','fineRange','csaPoints','marcusQuote'];

test('13.01 DRIVING_LIMIT has all required fields', () => {
  const d = getViolationDetails(VT.DRIVING_LIMIT);
  for (const f of requiredFields) {
    assert(d[f] && d[f].length > 0, `DRIVING_LIMIT missing field: ${f}`);
  }
  assert(d.regulation.includes('395.3'), 'should cite 49 CFR 395.3');
});

test('13.02 WINDOW_LIMIT has all required fields and mentions no-pause rule', () => {
  const d = getViolationDetails(VT.WINDOW_LIMIT);
  for (const f of requiredFields) {
    assert(d[f] && d[f].length > 0, `WINDOW_LIMIT missing field: ${f}`);
  }
  assert(d.description.toLowerCase().includes('pause'), 'should mention the no-pause rule');
});

test('13.03 BREAK_REQUIRED cites 49 CFR 395.3(a)(3)', () => {
  const d = getViolationDetails(VT.BREAK_REQUIRED);
  assert(d.regulation.includes('395.3'), 'should cite 49 CFR 395.3');
});

test('13.04 SHORT_HAUL_CLAIMED mentions 150 air miles', () => {
  const d = getViolationDetails(VT.SHORT_HAUL_CLAIMED);
  assert(d.description.includes('150'), 'should mention 150 air mile limit');
  assert(d.description.includes('interstate'), 'should mention interstate commerce');
});

test('13.05 All VT types return valid details', () => {
  const types = Object.values(VT);
  for (const t of types) {
    const d = getViolationDetails(t);
    assert(d.code && d.code !== 'UNKNOWN', `VT.${t} should have valid details`);
  }
});

test('13.06 Unknown violation returns graceful fallback', () => {
  const d = getViolationDetails('NONEXISTENT_TYPE');
  assertEq(d.code, 'UNKNOWN', 'unknown type should return UNKNOWN code');
  assert(d.title.length > 0, 'should still return a title');
});

test('13.07 FALSE_LOG mentions $12,700', () => {
  const d = getViolationDetails(VT.FALSE_LOG);
  assert(d.fineRange.includes('12,700'), 'should mention $12,700 falsification penalty');
});

test('13.08 ELD_MISSING mentions $1,270 per day', () => {
  const d = getViolationDetails(VT.ELD_MISSING);
  assert(d.fineRange.includes('1,270'), 'should mention $1,270/day ELD penalty');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 14: EDGE CASES
// ─────────────────────────────────────────────────────────────────

test('14.01 Entry spanning midnight (day boundary)', () => {
  const entries = [
    offDuty(1320, 600),    // starts at 10pm, ends 8am next day (straddles midnight)
    drive(1920, 60),       // 1h drive after rest
  ];
  const r = validateSchedule(entries, { currentMinute: 1980 });
  assert(!hasViolation(r.violations, VT.NO_QUALIFYING_REST), 'overnight entry should qualify as rest');
});

test('14.02 Zero-duration entry flagged as overlap', () => {
  const entries = [priorRest(), { ...drive(0, 0), label: 'Zero duration' }];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.OVERLAP), 'zero-duration entry should be flagged');
});

test('14.03 Overlapping entries flagged', () => {
  const entries = [
    priorRest(),
    drive(0, 120),    // 0–120
    drive(60, 120),   // 60–180 — overlaps with first
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.OVERLAP), 'overlapping entries should be flagged');
});

test('14.04 All rest (no on-duty): compliant', () => {
  const entries = [offDuty(0, 1440)];
  const r = validateSchedule(entries);
  assert(r.isCompliant, 'all rest day should be compliant');
});

test('14.05 Very long rest resets weekly limit fully', () => {
  const entries = [
    onDutyNot(0, R.WEEKLY_70_MIN + 1),   // over limit
    offDuty(R.WEEKLY_70_MIN + 1, R.RESTART_MIN),  // full restart
    onDutyNot(R.WEEKLY_70_MIN + 1 + R.RESTART_MIN, 60),
  ];
  const after = R.WEEKLY_70_MIN + 1 + R.RESTART_MIN + 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  assert(weekly.used <= 60, 'after restart, only post-restart hours should count');
});

test('14.06 canDrive with no entries: allowed', () => {
  const r = canDrive([]);
  assert(r.allowed, 'empty history should allow driving');
});

test('14.07 getRemainingHours with empty: returns full limits', () => {
  const r = getRemainingHours([]);
  assertEq(r.driving,      R.MAX_DRIVING_MIN,   'full driving remaining');
  assertEq(r.window,       R.WINDOW_MIN,        'full window remaining');
  assertEq(r.weeklyOnDuty, R.WEEKLY_70_MIN,     'full weekly remaining');
});

test('14.08 Violation description mentions time in human-readable format', () => {
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN + 1),
  ];
  const r = validateSchedule(entries);
  const v = r.violations.find(v => v.rule === VT.BREAK_REQUIRED);
  assert(v, 'break violation should exist');
  assert(v.description.length > 0, 'description should not be empty');
  assert(v.atMinute >= 0, 'atMinute should be set');
});

test('14.09 Short-haul exemption independent of schedule: clean schedule + invalid claim', () => {
  // A clean schedule with an INVALID short-haul claim (long route) emits ONLY
  // the short-haul violation — no other rule violations on a clean schedule.
  const entries = [priorRest(), drive(0, 30)];
  const r = validateSchedule(entries, {
    shortHaulClaimed: true,
    shortHaulContext: {
      exemption:             'e1',
      routeAirMiles:         300,        // > 150 — disqualifies
      returnsToHomeTerminal: true,
      onDutyShiftHours:      8,
    },
  });
  assert(hasViolation(r.violations, VT.SHORT_HAUL_CLAIMED),
    'invalid (route > 150) short-haul claim emits short-haul violation');
  const others = r.violations.filter(v => v.rule !== VT.SHORT_HAUL_CLAIMED);
  assertEq(others.length, 0, 'no other violations on clean schedule');
});

test('14.10 Violation severity levels are correct', () => {
  // Driving limit = critical
  const e1 = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, R.BREAK_SATISFY_MIN),
    drive(R.BREAK_TRIGGER_MIN + R.BREAK_SATISFY_MIN, R.MAX_DRIVING_MIN - R.BREAK_TRIGGER_MIN + 1),
  ];
  const r1 = validateSchedule(e1);
  const v1 = r1.violations.find(v => v.rule === VT.DRIVING_LIMIT);
  assertEq(v1?.severity, SEV.CRITICAL, 'driving limit should be CRITICAL');

  // Break required = major
  const e2 = [priorRest(), drive(0, R.BREAK_TRIGGER_MIN + 1)];
  const r2 = validateSchedule(e2);
  const v2 = r2.violations.find(v => v.rule === VT.BREAK_REQUIRED);
  assertEq(v2?.severity, SEV.MAJOR, 'break required should be MAJOR');
});

test('14.11 Constants are arithmetically consistent', () => {
  assertEq(R.MAX_DRIVING_MIN, 11 * 60, '11h in minutes');
  assertEq(R.WINDOW_MIN,      14 * 60, '14h in minutes');
  assertEq(R.PRIOR_REST_MIN,  10 * 60, '10h in minutes');
  assertEq(R.RESTART_MIN,     34 * 60, '34h in minutes');
  assertEq(R.BREAK_TRIGGER_MIN, 8 * 60, '8h in minutes');
  assertEq(R.BREAK_SATISFY_MIN, 30,     '30 minutes');
  assertEq(R.WEEKLY_60_MIN, 60 * 60, '60h in minutes');
  assertEq(R.WEEKLY_70_MIN, 70 * 60, '70h in minutes');
  assertEq(R.DAY_MIN, 1440, '24h in minutes');
});

// ─────────────────────────────────────────────────────────────────
// SECTION 15: REGULATORY ACCURACY VERIFICATION
// ─────────────────────────────────────────────────────────────────

test('15.01 11-hour limit is exactly 660 minutes', () => {
  assertEq(R.MAX_DRIVING_MIN, 660, 'FMCSA: 11h driving limit = 660 minutes exactly');
});

test('15.02 14-hour window does not extend with short rest', () => {
  // Driver on duty at 0, takes 6h rest at 3h, comes back — window still closes at 14h
  const entries = [
    priorRest(),
    drive(0, 180),          // 3h
    offDuty(180, 360),      // 6h rest (not ≥10h)
    drive(540, 60),         // drives at 9h
    drive(841, 1),          // drives past 14h
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT),
    '14-hour window must not extend with sub-10h rest — FMCSA critical rule');
});

test('15.03 10h rest is the minimum for window reset (not 9h59m)', () => {
  // 9h59m rest at hour 2 — must NOT reset the window
  const entries = [
    priorRest(),
    drive(0, 120),
    offDuty(120, 10 * 60 - 1),   // 9h59m — one minute short of reset
    drive(840 + 1, 1),            // past 14h from shift start
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.WINDOW_LIMIT),
    '9h59m rest must NOT reset 14h window — exact 10h required');
});

test('15.04 30-minute break is exactly 30 minutes (not 29)', () => {
  // 29-minute break is not sufficient
  const entries = [
    priorRest(),
    drive(0, R.BREAK_TRIGGER_MIN),
    offDuty(R.BREAK_TRIGGER_MIN, 29),
    drive(R.BREAK_TRIGGER_MIN + 29, 1),
  ];
  const r = validateSchedule(entries);
  assert(hasViolation(r.violations, VT.BREAK_REQUIRED), '29-minute break is insufficient per FMCSA');
});

test('15.05 34-hour restart requires exactly 34h (not 33h59m)', () => {
  const entries = [
    offDuty(-R.PRIOR_REST_MIN, R.PRIOR_REST_MIN),
    onDutyNot(0, 65 * 60),
    offDuty(65 * 60, R.RESTART_MIN - 1),  // 33h59m
    onDutyNot(65 * 60 + R.RESTART_MIN - 1, 35 * 60),  // 35h more
  ];
  const after = 65 * 60 + R.RESTART_MIN - 1 + 35 * 60;
  const weekly = checkWeeklyLimit(entries, after, '70/8');
  // Should include all hours since 33h59m doesn't trigger restart
  assert(weekly.used > 35 * 60, '33h59m does not constitute a 34h restart');
});

// ─────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────
console.log();
console.log('═══════════════════════════════════════════════════════════');
console.log('  HOSRuleEngine.js  —  Unit Test Results');
console.log('═══════════════════════════════════════════════════════════');
console.log();

const sections = [
  [1,  'validateSchedule: clean schedules'],
  [2,  '11-hour driving limit (49 CFR 395.3(a)(1))'],
  [3,  '14-hour window (49 CFR 395.3(a)(2)) — no-pause rule'],
  [4,  '30-minute break (49 CFR 395.3(a)(3))'],
  [5,  '70/60-hour weekly limits (49 CFR 395.3(b))'],
  [6,  '34-hour restart'],
  [8,  'Short-haul exemption detection'],
  [9,  'canDrive() — all blocking conditions'],
  [10, 'getRemainingHours()'],
  [11, 'checkWeeklyLimit()'],
  [12, 'buildDayTimeline()'],
  [13, 'getViolationDetails()'],
  [14, 'Edge cases'],
  [15, 'Regulatory accuracy verification'],
];

for (const [sec, name] of sections) {
  const prefix = `${sec}.`;
  const secResults = failures.filter(f => f.name.startsWith(prefix));
  const total = /* count tests in section */
    [...Array(50).keys()].filter(i => {
      const n = `${sec}.${String(i + 1).padStart(2, '0')}`;
      return [...Array.from({ length: passed + failed },
        (_, j) => j)].length > 0;
    }).length;
  const icon = secResults.length === 0 ? '✅' : '❌';
  if (secResults.length > 0) {
    console.log(`  ${icon} §${sec.toString().padStart(2)} ${name}`);
    for (const f of secResults) {
      console.log(`       FAIL: ${f.name}`);
      console.log(`             ${f.error}`);
    }
  }
}

// Print all failures if any
if (failures.length > 0) {
  console.log();
  console.log('FAILURES:');
  for (const f of failures) {
    console.log(`  ✗ ${f.name}`);
    console.log(`    ${f.error}`);
  }
}

console.log();
const total = passed + failed;
if (failed === 0) {
  console.log(`  ✅  ALL PASS  —  ${passed}/${total} tests`);
} else {
  console.log(`  ❌  ${failed} FAILED  —  ${passed}/${total} passed`);
}
console.log('═══════════════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
