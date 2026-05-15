/**
 * HOSRuleEngine.js
 * Pure JavaScript HOS validation module — no React, no DOM, no side effects.
 * Imported by: HOSPuzzle.jsx · DOTInspection.jsx · RoadReady.jsx L3 · App.jsx
 *
 * 49 CFR Part 395 — Hours of Service, Property-Carrying CMVs
 * Verified against FMCSA primary sources, April 2026.
 *
 * Box Truck Boss Phase 4c — Build Plan v2 §7.2
 *
 * SUPPORTED RULES (all verified against eCFR Title 49 Part 395):
 *   • §395.3(a)(1)     10 consecutive hours off duty before driving
 *   • §395.3(a)(2)     14-hour on-duty window (does not pause for breaks)
 *   • §395.3(a)(3)(i)  11-hour max driving
 *   • §395.3(a)(3)(ii) 30-min break after 8h cumulative driving
 *   • §395.3(b)(c)     60-hr/7-day or 70-hr/8-day; 34-hour restart
 *   • §395.1(b)(1)     Adverse driving conditions extension (+2h)
 *   • §395.1(e)(1)     150 air-mile short-haul exemption (any CMV)
 *   • §395.1(e)(2)     150 air-mile short-haul extension (non-CDL; 16h, 2/7)
 *   • §395.1(o)        16-hour "Big Day" exception (property-carrier, 1/7)
 *   • §395.28(a)       Personal Conveyance (off-duty special driving category)
 *
 * PERSONAL CONVEYANCE MODEL:
 *   Entries may carry a `pc: true` annotation. PC is RECORDED as off-duty
 *   per §395.8 and the 2018 FMCSA regulatory guidance. The engine treats
 *   PC entries identically to OFF_DUTY for all clock math (rest, window,
 *   weekly, break reset). The annotation exists so the UI and logs can
 *   display PC distinctly and so future validation can check whether PC
 *   use matches the 7 allowable uses from FMCSA guidance.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// DUTY STATUS CONSTANTS
// ─────────────────────────────────────────────────────────────────
const TYPE = {
  DRIVING:             'driving',
  ON_DUTY_NOT_DRIVING: 'on_duty_not_driving',
  OFF_DUTY:            'off_duty',
  SLEEPER_BERTH:       'sleeper_berth',
};

// ─────────────────────────────────────────────────────────────────
// REGULATORY CONSTANTS  (49 CFR 395.3)
// All limits expressed in minutes for integer arithmetic.
// ─────────────────────────────────────────────────────────────────
const R = {
  // Core driving/window limits
  MAX_DRIVING_MIN:        11 * 60,   // 660 min — max driving after 10h off
  WINDOW_MIN:             14 * 60,   // 840 min — on-duty window (does NOT pause)
  PRIOR_REST_MIN:         10 * 60,   // 600 min — rest required before new window

  // 30-minute break rule
  BREAK_TRIGGER_MIN:       8 * 60,   // 480 min — cumulative driving before break needed
  BREAK_SATISFY_MIN:      30,        // 30 min  — minimum qualifying break duration

  // Weekly limits
  WEEKLY_60_MIN:          60 * 60,   // 3600 min — 60-hr / 7-day limit
  WEEKLY_70_MIN:          70 * 60,   // 4200 min — 70-hr / 8-day limit
  WEEKLY_60_DAYS:          7,
  WEEKLY_70_DAYS:          8,

  // Restart
  RESTART_MIN:            34 * 60,   // 2040 min — consecutive off/SB for weekly reset

  // Adverse driving conditions exception (49 CFR 395.1(b))
  ADVERSE_DRIVING_EXT:     2 * 60,   // 120 min — driving extension in adverse conditions

  // 16-hour Big Day exception (49 CFR 395.1(o))
  // Property-carrier driver, 1 per 7 consecutive days, extends the 14-hour
  // window to 16 hours. Does NOT extend the 11-hour driving limit.
  BIG_DAY_WINDOW_MIN:     16 * 60,   // 960 min — extended window under §395.1(o)
  BIG_DAY_MIN_DAYS_BETWEEN: 7,        // must not have used in previous 6 days

  // Convenience
  DAY_MIN:              1440,        // minutes in one game day
};

// ─────────────────────────────────────────────────────────────────
// VIOLATION TYPE CATALOG
// ─────────────────────────────────────────────────────────────────
const VT = {
  DRIVING_LIMIT:       'DRIVING_LIMIT',
  WINDOW_LIMIT:        'WINDOW_LIMIT',
  BREAK_REQUIRED:      'BREAK_REQUIRED',
  WEEKLY_LIMIT:        'WEEKLY_LIMIT',
  NO_QUALIFYING_REST:  'NO_QUALIFYING_REST',
  SHORT_HAUL_CLAIMED:  'SHORT_HAUL_CLAIMED',
  BIG_DAY_INVALID:     'BIG_DAY_INVALID',    // §395.1(o) claim disqualified
  FALSE_LOG:           'FALSE_LOG',
  ELD_MISSING:         'ELD_MISSING',
  OVERLAP:             'OVERLAP',
};

// ─────────────────────────────────────────────────────────────────
// FORM-AND-MANNER FLAG TYPES
// Per 49 CFR §395.8(f), the driver's record of duty status must reflect
// actual work activities in a complete and truthful manner. Form-and-
// manner issues are not HOS rule violations (no hour limit broken), but
// they're flagged during DOT audits — CSA weight typically 1 for minor
// form issues, 3-5 for patterns that suggest falsification or obvious
// gaps in the record.
//
// The distinction that matters for gameplay:
//   • VT.* violations   = rule broken, hard compliance failure
//   • FT.* form flags   = log doesn't tell a plausible story; inspector
//                         reviewing during a roadside check would flag this
//
// References:
//   49 CFR §395.8      — RODS form, grid, and manner requirements
//   49 CFR §395.28     — Personal Conveyance (when PC is/isn't valid)
//   FMCSA Interpretation Notice, 2018 — PC between loads is not allowed
// ─────────────────────────────────────────────────────────────────
const FT = {
  FORM_NO_PRETRIP_BEFORE_DRIVE:  'FORM_NO_PRETRIP_BEFORE_DRIVE',
  FORM_NO_POSTTRIP_BEFORE_REST:  'FORM_NO_POSTTRIP_BEFORE_REST',
  FORM_PC_BETWEEN_LOADS:         'FORM_PC_BETWEEN_LOADS',
  FORM_BREAK_NOT_QUALIFYING:     'FORM_BREAK_NOT_QUALIFYING',
  FORM_DRIVE_WITHOUT_10H_REST:   'FORM_DRIVE_WITHOUT_10H_REST',
  FORM_POSTTRIP_UNREALISTIC:     'FORM_POSTTRIP_UNREALISTIC',
  FORM_SHIFT_NO_ON_DUTY_BOOKEND: 'FORM_SHIFT_NO_ON_DUTY_BOOKEND',
};

// ─────────────────────────────────────────────────────────────────
// SEQUENCE VIOLATION TYPES (Batch 4e)
// Sequence violations are harder than form-and-manner flags: they
// indicate the log tells a structurally impossible story (work
// before pre-trip, post-trip followed by more driving, etc.).
// These are MAJOR-severity violations that put the filing into
// VIOLATION tier — not COMPLIANT_WITH_FLAGS.
//
// Unlike HOS rule violations (which are time-based), sequence
// violations are order-based. They depend on the scenario's declared
// sequenceRoles for each card template (see HOSScenarios.js).
//
// Regulatory grounding: §395.8(f) form-and-manner, §396.13 pre-trip
// requirement, §396.11 post-trip requirement. The sequence rules
// codify what a physically-possible operational day looks like.
// ─────────────────────────────────────────────────────────────────
const ST = {
  SEQ_PRETRIP_NOT_FIRST:       'SEQ_PRETRIP_NOT_FIRST',
  SEQ_POSTTRIP_NOT_LAST:       'SEQ_POSTTRIP_NOT_LAST',
  SEQ_WORK_AFTER_POSTTRIP:     'SEQ_WORK_AFTER_POSTTRIP',
  SEQ_SHIFT_END_WITHOUT_START: 'SEQ_SHIFT_END_WITHOUT_START',
  // Batch 4e-2: final-tile and pre-rest structural rules
  SEQ_MISSING_CLOSING_REST:    'SEQ_MISSING_CLOSING_REST',
  SEQ_POSTTRIP_NOT_BEFORE_REST: 'SEQ_POSTTRIP_NOT_BEFORE_REST',
  // Batch 4f-2: missing drive transition (logical sequencing)
  // Real-world drivers must drive between activities at different
  // physical locations. A log that shows "unload at dock" → "post-trip
  // at yard" with no drive between is a falsified log — physically
  // impossible. Severity escalates: a single instance is form-and-manner
  // (MINOR), multiple instances in one log indicate falsification (MAJOR).
  SEQ_MISSING_DRIVE_TRANSITION: 'SEQ_MISSING_DRIVE_TRANSITION',
  SEQ_FALSIFIED_PATTERN:        'SEQ_FALSIFIED_PATTERN',
  // Batch 4f-3: abandoned filing (driver closed the puzzle without filing).
  // Generated by HOSPuzzle.handleClose when skipPenaltyOnClose=true and
  // the player closes before reaching the summary screen. Treated as a
  // major form-and-manner violation per §395.8(g) — logs must be
  // certified by the end of each 24-hour period. A missing log is itself
  // a major form-and-manner violation and a red flag in any DOT audit
  // of the preceding 7 days.
  SEQ_ABANDONED_FILING:         'SEQ_ABANDONED_FILING',
};

// ─────────────────────────────────────────────────────────────────
// SEVERITY LEVELS
// ─────────────────────────────────────────────────────────────────
const SEV = {
  CRITICAL: 'critical',   // OOS-worthy
  MAJOR:    'major',      // citation-level
  MINOR:    'minor',      // warning-level
};

// ─────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Sort entries by startMinute ascending.
 * @param {Array} entries
 * @returns {Array} sorted copy (does NOT mutate input)
 */
function _sorted(entries) {
  return [...entries].sort((a, b) => a.startMinute - b.startMinute);
}

/**
 * End minute of an entry.
 */
function _end(e) {
  return e.startMinute + e.durationMinutes;
}

/**
 * Returns true when the entry type counts as "driving".
 */
function _isDriving(type) {
  return type === TYPE.DRIVING;
}

/**
 * Returns true when the entry type counts as "on duty" (driving OR on-duty-not-driving).
 * Off duty and sleeper berth do NOT count as on-duty hours.
 */
function _isOnDuty(type) {
  return type === TYPE.DRIVING || type === TYPE.ON_DUTY_NOT_DRIVING;
}

/**
 * Returns true when the entry type counts as qualifying rest
 * (off duty OR sleeper berth, for both prior-rest and restart purposes).
 */
function _isRest(type) {
  return type === TYPE.OFF_DUTY || type === TYPE.SLEEPER_BERTH;
}

/**
 * Returns true when the entry type satisfies the 30-minute break requirement.
 * Per 49 CFR 395.3(a)(3)(ii): off duty, sleeper berth, OR on-duty not driving.
 */
function _isBreakEligible(type) {
  return type === TYPE.OFF_DUTY ||
         type === TYPE.SLEEPER_BERTH ||
         type === TYPE.ON_DUTY_NOT_DRIVING;
}

/**
 * Validate that entries do not overlap and have positive durations.
 * @returns {Array<{rule, description, severity, atMinute}>} violations
 */
function _checkIntegrity(entries) {
  const violations = [];
  const sorted = _sorted(entries);

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.durationMinutes <= 0) {
      violations.push({
        rule: VT.OVERLAP,
        description: `Entry "${e.label || e.type}" has zero or negative duration.`,
        severity: SEV.MINOR,
        atMinute: e.startMinute,
      });
    }
    if (i > 0 && e.startMinute < _end(sorted[i - 1])) {
      violations.push({
        rule: VT.OVERLAP,
        description: `Entries overlap: "${sorted[i-1].label || sorted[i-1].type}" and "${e.label || e.type}".`,
        severity: SEV.MINOR,
        atMinute: e.startMinute,
      });
    }
  }
  return violations;
}

/**
 * Find the end minute of the most recent qualifying rest period (≥ minRestMin)
 * that occurs at or before `atMinute`. Returns -Infinity if none found.
 *
 * A "qualifying rest period" is a continuous block of off-duty and/or
 * sleeper-berth time totaling at least minRestMin consecutive minutes.
 *
 * @param {Array}  entries    sorted entries
 * @param {number} minRestMin minimum rest duration in minutes
 * @param {number} [atMinute] look backwards from this minute (default: Infinity)
 * @returns {number} end minute of the qualifying rest, or -Infinity
 */
function _findLastQualifyingRestEnd(entries, minRestMin, atMinute = Infinity) {
  const sorted = _sorted(entries);

  // Walk backwards through entries, accumulating consecutive rest blocks
  let restStart = -1;
  let restEnd   = -1;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    if (_end(e) > atMinute) continue;   // skip entries after our reference point

    if (_isRest(e.type)) {
      if (restEnd < 0) {
        // Start accumulating
        restEnd   = _end(e);
        restStart = e.startMinute;
      } else if (e.startMinute + e.durationMinutes === restStart ||
                 _end(e) === restStart) {
        // Contiguous rest block (or gap-free adjacency)
        restStart = e.startMinute;
      } else if (_end(e) < restStart) {
        // Gap between this entry and the current rest block — non-contiguous
        // Check if the block we've accumulated is sufficient
        if (restEnd - restStart >= minRestMin) {
          return restEnd;
        }
        // Not sufficient; reset and start a new accumulation
        restEnd   = _end(e);
        restStart = e.startMinute;
      }
      // If there's no gap (entries are contiguous), extend restStart
    } else {
      // Non-rest entry encountered — check if current rest block is sufficient
      if (restEnd >= 0 && restEnd - restStart >= minRestMin) {
        return restEnd;
      }
      // Reset
      restEnd   = -1;
      restStart = -1;
    }
  }

  // Check what's accumulated at the beginning
  if (restEnd >= 0 && restEnd - restStart >= minRestMin) {
    return restEnd;
  }

  return -Infinity;
}

/**
 * Find contiguous rest blocks and return them as { start, end, durationMin }.
 * Used by findLastQualifyingRestEnd and restart detection.
 */
function _getRestBlocks(entries, atMinute = Infinity) {
  const sorted = _sorted(entries).filter(e => e.startMinute < atMinute);
  const blocks = [];
  let   block  = null;

  for (const e of sorted) {
    const end = Math.min(_end(e), atMinute);
    if (_isRest(e.type)) {
      if (!block) {
        block = { start: e.startMinute, end };
      } else if (e.startMinute <= block.end) {
        // Extend or merge contiguous rest
        block.end = Math.max(block.end, end);
      } else {
        blocks.push({ ...block, durationMin: block.end - block.start });
        block = { start: e.startMinute, end };
      }
    } else {
      if (block) {
        blocks.push({ ...block, durationMin: block.end - block.start });
        block = null;
      }
    }
  }
  if (block) blocks.push({ ...block, durationMin: block.end - block.start });
  return blocks;
}

/**
 * Find the end minute of the most recent qualifying rest period,
 * using block-based logic that properly handles contiguous rest entries.
 * Returns -Infinity if no qualifying rest found before atMinute.
 */
function _lastQualifyingRestEnd(entries, minRestMin, atMinute = Infinity) {
  const blocks = _getRestBlocks(entries, atMinute);
  // Walk backwards
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].durationMin >= minRestMin) {
      return blocks[i].end;
    }
  }
  return -Infinity;
}

/**
 * Find the most recent 34-consecutive-hour off/SB block that completes
 * on or before atMinute. Returns the END minute of that block, or -Infinity.
 */
function _lastRestartEnd(entries, atMinute = Infinity) {
  return _lastQualifyingRestEnd(entries, R.RESTART_MIN, atMinute);
}

/**
 * Sum of on-duty minutes (driving + on-duty-not-driving) within [fromMin, toMin).
 */
function _sumOnDutyInRange(entries, fromMin, toMin) {
  let total = 0;
  for (const e of entries) {
    if (!_isOnDuty(e.type)) continue;
    const s = Math.max(e.startMinute, fromMin);
    const x = Math.min(_end(e),       toMin);
    if (x > s) total += x - s;
  }
  return total;
}

/**
 * Sum of driving minutes within [fromMin, toMin).
 */
function _sumDrivingInRange(entries, fromMin, toMin) {
  let total = 0;
  for (const e of entries) {
    if (!_isDriving(e.type)) continue;
    const s = Math.max(e.startMinute, fromMin);
    const x = Math.min(_end(e),       toMin);
    if (x > s) total += x - s;
  }
  return total;
}

/**
 * Determine the start of the current on-duty "shift" — the end of the most
 * recent qualifying 10-hour rest period before `atMinute`.
 * Returns the minute at which the current shift began, or -Infinity if none.
 */
function _currentShiftStart(entries, atMinute = Infinity) {
  // Per 49 CFR 395.3: the 14-hour window opens when the driver FIRST COMES ON DUTY
  // after the qualifying ≥10h rest — NOT at the moment the rest period ends.
  // FMCSA guidance: "The 14-hour period begins when the driver first comes on duty
  // after 10 consecutive hours off duty." (FMCSA Hours of Service Q&A, 2023)
  const restEnd = _lastQualifyingRestEnd(entries, R.PRIOR_REST_MIN, atMinute);
  if (restEnd === -Infinity) return -Infinity;
  const sorted = _sorted(entries);
  for (const e of sorted) {
    if (e.startMinute < restEnd) continue;   // skip entries before rest end
    if (e.startMinute >= atMinute) break;    // past our check window
    if (_isOnDuty(e.type)) return e.startMinute; // first on-duty = shift start
  }
  return -Infinity; // rest completed but no on-duty activity yet
}

/**
 * Find the last time the driver had a qualifying 30-minute break
 * (off-duty, sleeper berth, or on-duty-not-driving ≥ 30 min)
 * before `atMinute`. Returns the END minute of that break, or -Infinity.
 *
 * Note: the break must be a CONTIGUOUS block of break-eligible time.
 */
function _lastBreakEnd(entries, atMinute = Infinity) {
  const sorted = _sorted(entries);
  // Build contiguous break blocks from break-eligible entries
  const blocks = [];
  let   block  = null;

  for (const e of sorted) {
    if (_end(e) > atMinute) break;
    if (_isBreakEligible(e.type)) {
      if (!block) {
        block = { start: e.startMinute, end: _end(e) };
      } else if (e.startMinute <= block.end) {
        block.end = Math.max(block.end, _end(e));
      } else {
        blocks.push({ ...block, dur: block.end - block.start });
        block = { start: e.startMinute, end: _end(e) };
      }
    } else {
      if (block) {
        blocks.push({ ...block, dur: block.end - block.start });
        block = null;
      }
    }
  }
  if (block) blocks.push({ ...block, dur: block.end - block.start });

  // Walk backwards for the most recent ≥30-min block
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].dur >= R.BREAK_SATISFY_MIN) return blocks[i].end;
  }
  return -Infinity;
}

/**
 * Compute cumulative driving minutes since the later of:
 *   a) the current shift start (last ≥10h rest end), or
 *   b) the last qualifying ≥30-min break end.
 * This is the value that triggers the break requirement at 8h.
 */
function _drivingMinsSinceLastBreak(entries, atMinute = Infinity) {
  const shiftStart = _currentShiftStart(entries, atMinute);
  const lastBreak  = _lastBreakEnd(entries, atMinute);
  const countFrom  = Math.max(shiftStart, lastBreak, 0);

  return _sumDrivingInRange(entries, countFrom, atMinute);
}

// ─────────────────────────────────────────────────────────────────
// EXPORTED FUNCTIONS

// ─────────────────────────────────────────────────────────────────
// BIG DAY HELPER
// ─────────────────────────────────────────────────────────────────

/**
 * Evaluate whether a claimed 16-hour Big Day exception (§395.1(o)) is valid.
 * Returns { valid: boolean, disqualifiers: string[] }.
 *
 * Ineligibility rules (all must be satisfied):
 *   (1) Driver returned to normal work-reporting location AND was released
 *       from duty there for the previous 5 duty tours.
 *   (2) On this Big Day tour, driver returns to work-reporting location
 *       AND is released within 16 consecutive hours.
 *   (3) Not used in the previous 6 consecutive days (unless a 34-hour
 *       restart intervened).
 *   (4) Driver is not using the §395.1(e)(2) non-CDL short-haul exception
 *       on the same day.
 */
function _bigDayIsValid(options) {
  if (!options || options.bigDayClaimed !== true) {
    return { valid: false, disqualifiers: [] };
  }
  const ctx = options.bigDayContext || {};
  const disqual = [];

  if (ctx.priorFiveDutyToursReturnedHome === false) {
    disqual.push(
      '§395.1(o)(1) requires return to normal work-reporting location for previous 5 duty tours.'
    );
  }

  if (ctx.returnsToHomeTerminal === false) {
    disqual.push(
      '§395.1(o)(2) requires return to normal work-reporting location on the Big Day tour.'
    );
  }
  if (typeof ctx.onDutyShiftHours === 'number' && ctx.onDutyShiftHours > 16) {
    disqual.push(
      '§395.1(o)(2) requires release within 16 consecutive hours; shift was ' +
      ctx.onDutyShiftHours + 'h.'
    );
  }

  if (typeof ctx.daysSinceLastBigDay === 'number' &&
      ctx.daysSinceLastBigDay < R.BIG_DAY_MIN_DAYS_BETWEEN &&
      ctx.had34hRestartSinceLastBigDay !== true) {
    disqual.push(
      '§395.1(o)(3) requires 7 days between Big Day uses (or a 34-hour restart); ' +
      'last used ' + ctx.daysSinceLastBigDay + ' day(s) ago.'
    );
  }

  if (options.shortHaulClaimed === true &&
      options.shortHaulContext &&
      options.shortHaulContext.exemption === 'e2') {
    disqual.push(
      'Drivers using §395.1(e)(2) non-CDL short-haul are ineligible for §395.1(o) on the same day.'
    );
  }

  return { valid: disqual.length === 0, disqualifiers: disqual };
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API — validateSchedule
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────

/**
 * validateSchedule
 *
 * Validates a complete schedule of duty status entries.
 * Checks all applicable HOS rules and returns all violations found.
 *
 * @param {Array<{
 *   type:            'driving'|'on_duty_not_driving'|'off_duty'|'sleeper_berth',
 *   startMinute:     number,   minutes from start of tracking period
 *   durationMinutes: number,
 *   label?:          string,
 * }>} entries - Array of duty status entries (need not be sorted)
 *
 * @param {{
 *   weeklyPolicy?:      '60/7'|'70/8',  default '70/8'
 *   adverseDriving?:    boolean,         default false
 *   currentMinute?:     number,          reference "now"; default last entry end
 * }} [options]
 *
 * @returns {{
 *   isCompliant:  boolean,
 *   violations:   Array<{ rule, description, severity, atMinute }>
 * }}
 */
function validateSchedule(entries, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { isCompliant: true, violations: [] };
  }

  const {
    weeklyPolicy    = '70/8',
    adverseDriving  = false,
  } = options;

  const sorted = _sorted(entries);
  const lastEntry = sorted[sorted.length - 1];
  const currentMinute = options.currentMinute ?? _end(lastEntry);

  const violations = [];

  // ── 0. Structural integrity ──────────────────────────────────
  const integrity = _checkIntegrity(entries);
  violations.push(...integrity);

  // ── 0b. Prior-rest sufficiency (Batch 4f-2) ──────────────────
  // §395.3(a)(1): driver may not drive without first taking 10 consecutive
  // hours off duty. We check this post-hoc by examining whether any
  // DRIVING entry begins without a qualifying ≥10h rest preceding it.
  //
  // The buildEngineEntries helper in HOSPuzzle.jsx prepends a prior-rest
  // tile reflecting actual continuity (or synthetic 10h fallback). If the
  // gap from yesterday's shift end to today's first activity was < 10h,
  // the prepended tile is correctly < 600 min, and this check fires.
  //
  // We only fire ONCE per schedule — multiple drives in the same shift
  // share the same prior-rest anchor. Use the FIRST drive as the anchor.
  {
    const firstDrive = _sorted(entries).find(e => e.type === TYPE.DRIVING);
    if (firstDrive) {
      const restEnd = _findLastQualifyingRestEnd(entries, R.PRIOR_REST_MIN, firstDrive.startMinute);
      if (restEnd === -Infinity) {
        // No 10h rest precedes the first drive — find the longest preceding
        // rest to report the deficit
        const sortedAll = _sorted(entries);
        let longestPriorRest = 0;
        for (const e of sortedAll) {
          if (e.startMinute >= firstDrive.startMinute) break;
          if (_isRest(e.type) && !e.pc) {
            const dur = e.durationMinutes || 0;
            if (dur > longestPriorRest) longestPriorRest = dur;
          }
        }
        const needed = R.PRIOR_REST_MIN - longestPriorRest;
        violations.push({
          rule:        VT.NO_QUALIFYING_REST,
          description: `Insufficient prior rest. Driver must take ${_fmt(R.PRIOR_REST_MIN)} ` +
                       `consecutive off-duty time before driving (49 CFR §395.3(a)(1)). ` +
                       `Longest prior rest in this log is ${_fmt(longestPriorRest)}; ` +
                       `${_fmt(needed)} additional rest needed before today's first drive at ` +
                       `minute ${firstDrive.startMinute}.`,
          severity:    SEV.MAJOR,
          atMinute:    firstDrive.startMinute,
        });
      }
    }
  }

  // ── 1. Identify current shift start ─────────────────────────
  const shiftStart = _currentShiftStart(entries, currentMinute);

  if (shiftStart === -Infinity) {
    // No qualifying prior rest found — this is a full history without a visible
    // 10-hour reset. We still validate what we can from the beginning.
  }

  // ── 2. 11-hour driving limit ──────────────────────────────────
  // Driving hours since start of current shift (after last ≥10h rest).
  const drivingHoursThisShift = shiftStart > -Infinity
    ? _sumDrivingInRange(entries, shiftStart, currentMinute)
    : _sumDrivingInRange(entries, 0, currentMinute);

  const maxDrivingMin = R.MAX_DRIVING_MIN +
    (adverseDriving ? R.ADVERSE_DRIVING_EXT : 0);

  if (drivingHoursThisShift > maxDrivingMin) {
    const overBy = drivingHoursThisShift - maxDrivingMin;
    const violationStart = shiftStart > -Infinity
      ? shiftStart + maxDrivingMin
      : maxDrivingMin;
    violations.push({
      rule:        VT.DRIVING_LIMIT,
      description: `Driving limit exceeded: ${_fmt(drivingHoursThisShift)} driven, ` +
                   `limit is ${_fmt(maxDrivingMin)} after 10 consecutive hours off duty. ` +
                   `Over by ${_fmt(overBy)}.`,
      severity:    SEV.CRITICAL,
      atMinute:    violationStart,
    });
  }

  // ── 3a. 16-Hour Big Day exception validation (49 CFR 395.1(o)) ──
  // Property-carrier driver may extend the 14-hour window to 16 hours if:
  //   (1) Driver returned to normal work-reporting location and was released
  //       from duty there for the previous 5 duty tours.
  //   (2) Driver returns to normal work-reporting location AND is released
  //       within 16 hours after coming on-duty following 10h off-duty.
  //   (3) Driver has NOT used this exemption in the previous 6 consecutive
  //       days (reset if 34-hour restart intervened).
  // Additionally, drivers using the (e)(2) non-CDL short-haul exception on
  // the same day are INELIGIBLE for §395.1(o) per FMCSA/JJ Keller guidance.
  const bigDayCheck = _bigDayIsValid(options);
  const bigDayValid = bigDayCheck.valid;

  if (options.bigDayClaimed && !bigDayValid) {
    violations.push({
      rule:        VT.BIG_DAY_INVALID,
      description: '16-hour Big Day exception (49 CFR 395.1(o)) claimed but ' +
                   'INVALID. Disqualifiers: ' + bigDayCheck.disqualifiers.join(' '),
      severity:    SEV.MAJOR,
      atMinute:    currentMinute,
    });
  }

  // ── 3b. On-duty window (14-hour default, 16-hour if valid Big Day) ────
  // Window opens when the driver first comes on duty after the qualifying ≥10h rest.
  // (49 CFR 395.3 / FMCSA Q&A: window starts at first on-duty activity, NOT at rest-end)
  // Window is NOT paused by breaks.
  if (shiftStart > -Infinity) {
    const windowLimit = bigDayValid ? R.BIG_DAY_WINDOW_MIN : R.WINDOW_MIN;
    const effectiveWindowEnd = shiftStart + windowLimit;
    const windowLabel = bigDayValid ? '16-hour (Big Day §395.1(o))' : '14-hour';

    // Check if any driving occurs after the window closes
    for (const e of sorted) {
      if (!_isDriving(e.type)) continue;
      if (e.startMinute >= effectiveWindowEnd) {
        violations.push({
          rule:        VT.WINDOW_LIMIT,
          description: 'Driving started at minute ' + e.startMinute + ' but the ' + windowLabel + ' ' +
                       'on-duty window closed at minute ' + effectiveWindowEnd + ' ' +
                       '(window opened at minute ' + shiftStart + '). ' +
                       'The on-duty window does NOT pause for breaks or off-duty time.',
          severity:    SEV.CRITICAL,
          atMinute:    e.startMinute,
        });
        break;
      }
      if (_end(e) > effectiveWindowEnd) {
        violations.push({
          rule:        VT.WINDOW_LIMIT,
          description: 'Driving entry crosses the ' + windowLabel + ' window boundary at minute ' + effectiveWindowEnd + '. ' +
                       'Window opened at minute ' + shiftStart + '.',
          severity:    SEV.CRITICAL,
          atMinute:    effectiveWindowEnd,
        });
        break;
      }
    }
  }

  // ── 4. 30-minute break requirement ────────────────────────────
  // Required after 8 cumulative driving hours without a qualifying break.
  // Walk through entries chronologically and track cumulative driving.
  {
    const breakStart = shiftStart > -Infinity ? shiftStart : 0;
    let cumDriving = 0;
    let lastBreakPoint = breakStart;
    let breakViolationFired = false;

    for (const e of sorted) {
      if (e.startMinute < breakStart) continue;
      if (e.startMinute >= currentMinute) break;

      if (_isBreakEligible(e.type) && e.durationMinutes >= R.BREAK_SATISFY_MIN) {
        // Qualifying break — reset cumulative driving counter
        cumDriving   = 0;
        lastBreakPoint = _end(e);
      } else if (_isDriving(e.type)) {
        const s = Math.max(e.startMinute, lastBreakPoint);
        const x = Math.min(_end(e), currentMinute);
        if (x > s) {
          cumDriving += x - s;
          if (cumDriving > R.BREAK_TRIGGER_MIN && !breakViolationFired) {
            const violationAtMinute = lastBreakPoint + R.BREAK_TRIGGER_MIN;
            violations.push({
              rule:        VT.BREAK_REQUIRED,
              description: `30-minute break required: driver has accumulated ` +
                           `${_fmt(cumDriving)} of driving without a qualifying break ` +
                           `(limit is ${_fmt(R.BREAK_TRIGGER_MIN)}). ` +
                           `A break of ≥30 min (off-duty, sleeper, or on-duty not driving) ` +
                           `must occur before exceeding 8 cumulative driving hours. ` +
                           `49 CFR 395.3(a)(3).`,
              severity:    SEV.MAJOR,
              atMinute:    violationAtMinute,
            });
            breakViolationFired = true;
          }
        }
      }
      // Note: on-duty-not-driving blocks SHORTER than 30 min do NOT reset
      // the break counter — they just pause driving accumulation.
    }
  }

  // ── 5. Weekly on-duty limit ────────────────────────────────────
  const weeklyCheck = checkWeeklyLimit(entries, currentMinute, weeklyPolicy);
  if (weeklyCheck.exceeded) {
    violations.push({
      rule:        VT.WEEKLY_LIMIT,
      description: `Weekly on-duty limit exceeded: ${_fmt(weeklyCheck.used)} used ` +
                   `of ${_fmt(weeklyCheck.limit)} allowed in the last ` +
                   `${weeklyCheck.days} days. Over by ${_fmt(weeklyCheck.used - weeklyCheck.limit)}.`,
      severity:    SEV.CRITICAL,
      atMinute:    currentMinute,
    });
  }

  // ── 6. Short-haul exemption validation (49 CFR 395.1(e)) ──────
  // Short-haul is VALID only if the operation actually qualifies.
  // Per user context decisions:
  //   (e)(1) standard 150 air-mile — any CMV driver returning to home
  //          within 14 consecutive hours (prior 10h off still required).
  //   (e)(2) non-CDL 150 air-mile extension — allows up to 16h on-duty
  //          on up to 2 days per 7-day period (5 days still capped at 14h).
  // When VALID: driver exempt from 30-min break (§395.3(a)(3)(ii)) and ELD.
  // When INVALID: emit SHORT_HAUL_CLAIMED with specific disqualifier(s).
  const shContext     = options.shortHaulContext || null;
  const shClaimed     = !!options.shortHaulClaimed;
  let   shValid       = false;   // used downstream to skip break check if valid

  if (shClaimed) {
    const ctx = shContext || {};
    const exemption = ctx.exemption || 'e1';          // 'e1' | 'e2'
    const disqual   = [];

    // Condition 1: within 150 air-mile radius
    if (typeof ctx.routeAirMiles === 'number' && ctx.routeAirMiles > 150) {
      disqual.push(`Route exceeds 150 air miles (${ctx.routeAirMiles} mi).`);
    }

    // Condition 2: returns to normal work reporting location
    if (ctx.returnsToHomeTerminal === false) {
      disqual.push('Driver does not return to normal work reporting location.');
    }

    // Condition 3 — exemption-specific time limits
    const onDutyShiftHours = typeof ctx.onDutyShiftHours === 'number'
      ? ctx.onDutyShiftHours
      : null;

    if (exemption === 'e1') {
      // (e)(1) — released within 14 consecutive hours
      if (onDutyShiftHours !== null && onDutyShiftHours > 14) {
        disqual.push(
          `§395.1(e)(1) requires release within 14 consecutive hours; shift was ${onDutyShiftHours}h.`
        );
      }
    } else if (exemption === 'e2') {
      // (e)(2) — non-CDL only, 14h normal with 16h on ≤2 days per 7
      if (ctx.requiresCDL === true) {
        disqual.push(
          '§395.1(e)(2) applies only to drivers of vehicles NOT requiring a CDL.'
        );
      }
      if (onDutyShiftHours !== null && onDutyShiftHours > 16) {
        disqual.push(
          `§395.1(e)(2) allows up to 16 hours on-duty; shift was ${onDutyShiftHours}h.`
        );
      }
      // (e)(2) 16h days capped at 2 per 7 — if caller passes the prior-week count
      if (typeof ctx.sixteenHourDaysUsedThisWeek === 'number' &&
          onDutyShiftHours !== null && onDutyShiftHours > 14 &&
          ctx.sixteenHourDaysUsedThisWeek >= 2) {
        disqual.push(
          `§395.1(e)(2) allows the 16-hour extension on only 2 days per 7; ` +
          `already used ${ctx.sixteenHourDaysUsedThisWeek} this week.`
        );
      }
    } else {
      disqual.push(`Unknown exemption code "${exemption}" (use 'e1' or 'e2').`);
    }

    if (disqual.length > 0) {
      violations.push({
        rule:        VT.SHORT_HAUL_CLAIMED,
        description: `Short-haul exemption (49 CFR 395.1(${exemption === 'e2' ? 'e)(2' : 'e)(1'})) ` +
                     `claimed but INVALID. Disqualifiers: ${disqual.join(' ')}`,
        severity:    SEV.MAJOR,
        atMinute:    currentMinute,
      });
    } else {
      // Exemption is VALID — mark so we can skip the 30-min break check later.
      shValid = true;
    }
  }

  // If a valid short-haul exemption is claimed, §395.3(a)(3)(ii) explicitly
  // exempts those drivers from the 30-min break. Strip any BREAK_REQUIRED
  // violation that was emitted above.
  if (shValid) {
    for (let i = violations.length - 1; i >= 0; i--) {
      if (violations[i].rule === VT.BREAK_REQUIRED) violations.splice(i, 1);
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations,
  };
}

/**
 * getRemainingHours
 *
 * Returns how many minutes remain under each HOS limit at a given point
 * in time, based on a history of duty status entries.
 *
 * @param {Array}  entries       Duty status history
 * @param {number} [currentMinute]  Reference "now" (default: end of last entry)
 * @param {{weeklyPolicy?: '60/7'|'70/8'}} [options]
 *
 * @returns {{
 *   driving:          number,  minutes remaining on 11-hr driving limit
 *   window:           number,  minutes remaining in 14-hr on-duty window
 *   weeklyOnDuty:     number,  minutes remaining on weekly 60/70-hr limit
 *   untilBreakNeeded: number,  driving minutes remaining before 30-min break required
 * }}
 */
function getRemainingHours(entries, currentMinute, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      driving:          R.MAX_DRIVING_MIN,
      window:           R.WINDOW_MIN,
      weeklyOnDuty:     R.WEEKLY_70_MIN,
      untilBreakNeeded: R.BREAK_TRIGGER_MIN,
    };
  }

  const sorted = _sorted(entries);
  const lastEntry = sorted[sorted.length - 1];
  const now = currentMinute ?? _end(lastEntry);
  const { weeklyPolicy = '70/8' } = options;
  const bigDayValid = _bigDayIsValid(options).valid;
  const windowLimit = bigDayValid ? R.BIG_DAY_WINDOW_MIN : R.WINDOW_MIN;

  const shiftStart = _currentShiftStart(entries, now);

  // Driving remaining
  const drivingUsed = shiftStart > -Infinity
    ? _sumDrivingInRange(entries, shiftStart, now)
    : _sumDrivingInRange(entries, 0, now);
  const drivingRemaining = Math.max(0, R.MAX_DRIVING_MIN - drivingUsed);

  // Window remaining (14h default, 16h if valid Big Day)
  let windowRemaining = windowLimit; // If no shift has started, full window available
  if (shiftStart > -Infinity) {
    const effectiveWindowEnd = shiftStart + windowLimit;
    windowRemaining = Math.max(0, effectiveWindowEnd - now);
  }

  // Weekly remaining
  const weeklyCheck = checkWeeklyLimit(entries, now, weeklyPolicy);
  const weeklyRemaining = Math.max(0, weeklyCheck.remaining);

  // Break: minutes of driving remaining before 30-min break is required
  const drivingSinceBreak = _drivingMinsSinceLastBreak(entries, now);
  const untilBreakNeeded  = Math.max(0, R.BREAK_TRIGGER_MIN - drivingSinceBreak);

  return {
    driving:          drivingRemaining,
    window:           windowRemaining,
    weeklyOnDuty:     weeklyRemaining,
    untilBreakNeeded,
  };
}

/**
 * checkWeeklyLimit
 *
 * Evaluates the 60-hr/7-day or 70-hr/8-day on-duty limit.
 * Accounts for 34-hour restarts that reset the weekly clock.
 *
 * @param {Array}  entries
 * @param {number} [currentMinute]  Reference "now"
 * @param {'60/7'|'70/8'} [policy]  default '70/8'
 *
 * @returns {{
 *   used:             number,   on-duty minutes used in the current cycle
 *   limit:            number,   cycle limit in minutes
 *   remaining:        number,   minutes remaining in cycle
 *   days:             number,   days in cycle (7 or 8)
 *   exceeded:         boolean,
 *   restartAvailable: boolean,  true if driver has ≥34h off/SB accumulated
 *   restartEndsAt:    number|null, minute at which a 34h restart would complete
 * }}
 */
function checkWeeklyLimit(entries, currentMinute, policy = '70/8') {
  const sorted = _sorted(entries);
  const lastEntry = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const now = currentMinute ?? (lastEntry ? _end(lastEntry) : 0);

  const [limitHrs, numDays] = policy === '60/7'
    ? [60, R.WEEKLY_60_DAYS]
    : [70, R.WEEKLY_70_DAYS];
  const limitMin = limitHrs * 60;

  // Find the most recent 34-hour restart
  const restartEnd = _lastRestartEnd(entries, now);
  const lookbackStart = restartEnd > -Infinity
    ? restartEnd
    : now - numDays * R.DAY_MIN;

  const used = _sumOnDutyInRange(entries, lookbackStart, now);

  // Determine if a restart is currently available or in progress
  // (driver has been off duty for ≥34 consecutive hours ending at/after now)
  const currentRestStart = _getCurrentContinuousRestStart(entries, now);
  const restSoFar = currentRestStart !== null ? now - currentRestStart : 0;
  const restartAvailable = restSoFar >= R.RESTART_MIN;
  const restartEndsAt = currentRestStart !== null && !restartAvailable
    ? currentRestStart + R.RESTART_MIN
    : null;

  return {
    used,
    limit:            limitMin,
    remaining:        Math.max(0, limitMin - used),
    days:             numDays,
    exceeded:         used > limitMin,
    restartAvailable,
    restartEndsAt,
  };
}

/**
 * Find the start of the current continuous rest block (off-duty or SB)
 * ending at `atMinute`. Returns null if the driver is not currently resting.
 */
function _getCurrentContinuousRestStart(entries, atMinute) {
  const sorted = _sorted(entries);
  let restStart = null;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const e = sorted[i];
    if (_end(e) > atMinute) continue;

    if (_end(e) === atMinute || (e.startMinute <= atMinute && _end(e) >= atMinute)) {
      if (_isRest(e.type)) {
        restStart = e.startMinute;
      } else {
        break;
      }
    } else if (_end(e) < atMinute) {
      if (_isRest(e.type) && restStart !== null) {
        restStart = e.startMinute;
      } else {
        break;
      }
    }
  }
  return restStart;
}

/**
 * canDrive
 *
 * Determines whether the driver is legally allowed to drive at `currentMinute`,
 * given their duty history. Returns the first limiting factor found.
 *
 * @param {Array}  entries
 * @param {number} [currentMinute]  Reference "now"
 * @param {{weeklyPolicy?, adverseDriving?}} [options]
 *
 * @returns {{
 *   allowed:        boolean,
 *   reason:         string|null,   human-readable reason if not allowed
 *   limitingFactor: string|null,   VT.* constant identifying the limit
 *   restoreAt:      number|null,   minute at which driving would become legal again
 * }}
 */
function canDrive(entries, currentMinute, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { allowed: true, reason: null, limitingFactor: null, restoreAt: null };
  }

  const sorted = _sorted(entries);
  const lastEntry = sorted[sorted.length - 1];
  const now = currentMinute ?? _end(lastEntry);
  const { weeklyPolicy = '70/8', adverseDriving = false } = options;
  const bigDayValid = _bigDayIsValid(options).valid;
  const windowLimit = bigDayValid ? R.BIG_DAY_WINDOW_MIN : R.WINDOW_MIN;

  const shiftStart  = _currentShiftStart(entries, now);
  const maxDriving  = R.MAX_DRIVING_MIN + (adverseDriving ? R.ADVERSE_DRIVING_EXT : 0);

  // ── Check 1: Qualifying prior rest ────────────────────────────
  if (shiftStart === -Infinity) {
    // No qualifying rest found at all in history — check if enough rest present
    const restBlocks = _getRestBlocks(entries, now);
    const lastBlock  = restBlocks[restBlocks.length - 1];
    if (!lastBlock || lastBlock.durationMin < R.PRIOR_REST_MIN) {
      const needed = R.PRIOR_REST_MIN - (lastBlock ? lastBlock.durationMin : 0);
      return {
        allowed:        false,
        reason:         `Driver must have ${_fmtH(R.PRIOR_REST_MIN)} of consecutive off-duty time ` +
                        `before driving. ${_fmtH(needed)} more rest required.`,
        limitingFactor: VT.NO_QUALIFYING_REST,
        restoreAt:      lastBlock ? lastBlock.start + R.PRIOR_REST_MIN : now + R.PRIOR_REST_MIN,
      };
    }
  }

  // ── Check 2: 11-hour driving limit ────────────────────────────
  const drivingUsed = shiftStart > -Infinity
    ? _sumDrivingInRange(entries, shiftStart, now)
    : 0;
  if (drivingUsed >= maxDriving) {
    return {
      allowed:        false,
      reason:         `11-hour driving limit reached: ${_fmtH(drivingUsed)} driven this shift. ` +
                      `Driver must take ${_fmtH(R.PRIOR_REST_MIN)} consecutive off duty.`,
      limitingFactor: VT.DRIVING_LIMIT,
      restoreAt:      now + (R.PRIOR_REST_MIN - _currentContinuousRestDuration(entries, now)),
    };
  }

  // ── Check 3: on-duty window (14h default, 16h if valid Big Day) ───
  if (shiftStart > -Infinity) {
    const effectiveWindowEnd = shiftStart + windowLimit;
    const windowLabel = bigDayValid ? '16-hour Big Day' : '14-hour';
    if (now >= effectiveWindowEnd) {
      return {
        allowed:        false,
        reason:         `${windowLabel} on-duty window has expired. Window opened at minute ${shiftStart}, ` +
                        `closed at minute ${effectiveWindowEnd}. ` +
                        `The window does NOT pause for breaks. ` +
                        `Driver must take ${_fmtH(R.PRIOR_REST_MIN)} consecutive off duty before driving again.`,
        limitingFactor: VT.WINDOW_LIMIT,
        restoreAt:      now + (R.PRIOR_REST_MIN - _currentContinuousRestDuration(entries, now)),
      };
    }
  }

  // ── Check 4: 30-minute break required ─────────────────────────
  const drivingSinceBreak = _drivingMinsSinceLastBreak(entries, now);
  if (drivingSinceBreak >= R.BREAK_TRIGGER_MIN) {
    return {
      allowed:        false,
      reason:         `30-minute break required: ${_fmtH(drivingSinceBreak)} driven without a qualifying break ` +
                      `(off-duty, sleeper berth, or on-duty not driving ≥30 min). 49 CFR 395.3(a)(3).`,
      limitingFactor: VT.BREAK_REQUIRED,
      restoreAt:      now + R.BREAK_SATISFY_MIN,
    };
  }

  // ── Check 5: Weekly limit ─────────────────────────────────────
  const weekly = checkWeeklyLimit(entries, now, weeklyPolicy);
  if (weekly.exceeded) {
    return {
      allowed:        false,
      reason:         `Weekly on-duty limit reached: ${_fmtH(weekly.used)} used of ` +
                      `${_fmtH(weekly.limit)} allowed in ${weekly.days} days. ` +
                      `A 34-hour restart (consecutive off-duty time) is required.`,
      limitingFactor: VT.WEEKLY_LIMIT,
      restoreAt:      weekly.restartEndsAt,
    };
  }

  return { allowed: true, reason: null, limitingFactor: null, restoreAt: null };
}

/**
 * How long has the driver been continuously off-duty/SB ending at `atMinute`?
 * Returns 0 if the driver is currently on duty or has no rest entries.
 */
function _currentContinuousRestDuration(entries, atMinute) {
  const blocks = _getRestBlocks(entries, atMinute);
  if (!blocks.length) return 0;
  const last = blocks[blocks.length - 1];
  // Only counts if the block ends at (or covers) atMinute
  if (last.end >= atMinute) {
    return last.durationMin;
  }
  return 0;
}

/**
 * buildDayTimeline
 *
 * Builds an annotated timeline data structure for UI rendering.
 * Intended for a single-day view (HOSPuzzle.jsx card display).
 *
 * @param {Array}   entries         Duty status entries for the day
 * @param {number}  [dayStartMin]   Minute that "day" begins (default: 0)
 * @param {number}  [dayEndMin]     Minute that "day" ends (default: 1440)
 * @param {{weeklyPolicy?}} [options]
 *
 * @returns {{
 *   segments:     Array<Segment>,       timeline blocks suitable for rendering
 *   brackets:     Array<Bracket>,       annotated brackets (window, driving limit)
 *   markers:      Array<Marker>,        violation markers on the timeline
 *   summary:      { drivingMin, onDutyMin, restMin, drivingPct, windowUsedPct }
 *   violations:   Array<Violation>,
 * }}
 *
 * Segment: { type, startMin, endMin, durationMin, label, color, violates }
 * Bracket: { id, startMin, endMin, label, type: 'window'|'driving'|'break', warningMin }
 * Marker:  { atMin, rule, description, severity }
 */
function buildDayTimeline(entries, dayStartMin = 0, dayEndMin = 1440, options = {}) {
  const sorted = _sorted(entries);

  // ── Segments ──────────────────────────────────────────────────
  const segments = sorted
    .filter(e => _end(e) > dayStartMin && e.startMinute < dayEndMin)
    .map(e => ({
      type:        e.type,
      startMin:    Math.max(e.startMinute, dayStartMin),
      endMin:      Math.min(_end(e), dayEndMin),
      durationMin: Math.min(_end(e), dayEndMin) - Math.max(e.startMinute, dayStartMin),
      label:       e.label || _typeLabel(e.type),
      color:       _typeColor(e.type),
      violates:    false,   // updated below
    }));

  // ── Validate ──────────────────────────────────────────────────
  const validation = validateSchedule(entries, {
    ...options,
    currentMinute: dayEndMin,
  });

  // Tag violating segments
  for (const v of validation.violations) {
    for (const seg of segments) {
      if (seg.startMin <= v.atMinute && v.atMinute < seg.endMin) {
        seg.violates = true;
      }
    }
  }

  // ── Brackets ──────────────────────────────────────────────────
  const brackets = [];
  const shiftStart = _currentShiftStart(entries, dayEndMin);

  if (shiftStart > -Infinity) {
    const bigDayValid = _bigDayIsValid(options).valid;
    const windowLimit = bigDayValid ? R.BIG_DAY_WINDOW_MIN : R.WINDOW_MIN;
    const windowEnd   = shiftStart + windowLimit;
    brackets.push({
      id:         bigDayValid ? 'window_16' : 'window_14',
      startMin:   shiftStart,
      endMin:     windowEnd,
      label:      bigDayValid ? '16-hr window (Big Day)' : '14-hr window',
      type:       'window',
      warningMin: windowEnd - 60,   // warn 1h before close
    });
    brackets.push({
      id:         'driving_11',
      startMin:   shiftStart,
      endMin:     shiftStart + R.MAX_DRIVING_MIN,
      label:      '11-hr driving limit',
      type:       'driving',
      warningMin: shiftStart + R.MAX_DRIVING_MIN - 60,
    });
    brackets.push({
      id:         'break_trigger',
      startMin:   shiftStart,
      endMin:     shiftStart + R.BREAK_TRIGGER_MIN,  // 8-hr driving accumulator
      label:      '8-hr break trigger',
      type:       'break',
      warningMin: shiftStart + R.BREAK_TRIGGER_MIN - 30,
    });
  }

  // ── Summary ───────────────────────────────────────────────────
  const drivingMin = _sumDrivingInRange(entries, dayStartMin, dayEndMin);
  const onDutyMin  = _sumOnDutyInRange(entries, dayStartMin, dayEndMin);
  const restMin    = (dayEndMin - dayStartMin) - onDutyMin;
  const windowSpan = shiftStart > -Infinity ? R.WINDOW_MIN : 0;

  return {
    segments,
    brackets,
    markers: validation.violations.map(v => ({
      atMin:       v.atMinute,
      rule:        v.rule,
      description: v.description,
      severity:    v.severity,
    })),
    summary: {
      drivingMin,
      onDutyMin,
      restMin:      Math.max(0, restMin),
      drivingPct:   windowSpan > 0 ? Math.round(drivingMin / windowSpan * 100) : 0,
      windowUsedPct: windowSpan > 0
        ? Math.round((onDutyMin / R.WINDOW_MIN) * 100)
        : 0,
    },
    violations: validation.violations,
  };
}

/**
 * getViolationDetails
 *
 * Returns detailed educational content for a given violation type.
 * Used by HOSPuzzle, DOTInspection, and RoadReady Layer 3.
 *
 * @param {string} violationType - One of the VT.* constants
 * @returns {{
 *   code:         string,
 *   title:        string,
 *   regulation:   string,
 *   description:  string,
 *   consequence:  string,
 *   fineRange:    string,
 *   csaPoints:    string,
 *   marcusQuote:  string,
 * }}
 */
function getViolationDetails(violationType) {
  const catalog = {
    [VT.DRIVING_LIMIT]: {
      code:        'HOS-11',
      title:       '11-Hour Driving Limit',
      regulation:  '49 CFR 395.3(a)(1)',
      description: 'A property-carrying CMV driver may drive a maximum of 11 hours ' +
                   'after 10 consecutive hours off duty. Once 11 hours of driving ' +
                   'time is reached, the driver must take at least 10 consecutive hours off.',
      consequence: 'Driver placed out-of-service. Cannot resume driving until qualifying rest is taken.',
      fineRange:   '$1,000–$16,000 per violation (49 CFR 386.81)',
      csaPoints:   '7 points — HOS violation (critical)',
      marcusQuote: '"Your log didn\'t match the road. That\'s not a paperwork problem — that\'s a federal problem."',
    },
    [VT.WINDOW_LIMIT]: {
      code:        'HOS-14',
      title:       '14-Hour On-Duty Window',
      regulation:  '49 CFR 395.3(a)(2)',
      description: 'A driver may not drive beyond the 14th consecutive hour after ' +
                   'coming on duty, following 10 consecutive hours off duty. ' +
                   'This window does NOT pause for breaks, off-duty periods, or ' +
                   'sleeper berth time taken within the window. ' +
                   'This is the most frequently misunderstood HOS rule for non-CDL operators.',
      consequence: 'Driver placed out-of-service. Window is a hard wall — no exceptions ' +
                   'except adverse driving conditions (49 CFR 395.1(b)).',
      fineRange:   '$1,000–$16,000 per violation (49 CFR 386.81)',
      csaPoints:   '7 points — HOS violation (critical)',
      marcusQuote: '"Build your day before the day builds you. Once that 14-hour clock starts, it doesn\'t stop."',
    },
    [VT.BREAK_REQUIRED]: {
      code:        'HOS-30',
      title:       '30-Minute Break Required',
      regulation:  '49 CFR 395.3(a)(3)',
      description: 'A driver must take a 30-minute consecutive break before driving ' +
                   'after accumulating 8 hours of driving time without a qualifying break. ' +
                   'A qualifying break is: off-duty, sleeper berth, OR on-duty not driving ' +
                   'for at least 30 uninterrupted minutes.',
      consequence: 'Citation issued. Driver must take qualifying break before resuming driving.',
      fineRange:   '$1,000–$11,000 per violation',
      csaPoints:   '3 points — HOS violation (moderate)',
      marcusQuote: '"File your log before you roll. That 30 minutes isn\'t optional — it\'s the law."',
    },
    [VT.WEEKLY_LIMIT]: {
      code:        'HOS-70',
      title:       'Weekly On-Duty Limit (70/8)',
      regulation:  '49 CFR 395.3(b)',
      description: 'A driver may not drive after accumulating 70 on-duty hours ' +
                   '(driving + on-duty not driving) in 8 consecutive days ' +
                   '(or 60 hours in 7 days, depending on carrier policy). ' +
                   'A 34-hour restart (consecutive off-duty time) resets the weekly clock.',
      consequence: 'Driver placed out-of-service until the weekly limit resets via restart or calendar rollover.',
      fineRange:   '$1,000–$16,000 per violation',
      csaPoints:   '7 points — HOS violation (critical)',
      marcusQuote: '"You can\'t borrow tomorrow\'s hours to finish today\'s load."',
    },
    [VT.NO_QUALIFYING_REST]: {
      code:        'HOS-REST',
      title:       'No Qualifying Rest Before Shift',
      regulation:  '49 CFR 395.3(a)(1)',
      description: 'A driver must have at least 10 consecutive hours off duty ' +
                   '(or in the sleeper berth) before starting a new driving shift. ' +
                   'The 10-hour rest period resets both the 11-hour driving limit ' +
                   'and the 14-hour on-duty window.',
      consequence: 'Driver placed out-of-service. Cannot drive until 10 consecutive hours of rest are completed.',
      fineRange:   '$1,000–$16,000 per violation',
      csaPoints:   '7 points — HOS violation (critical)',
      marcusQuote: '"10 hours down before the wheels turn. Not a suggestion."',
    },
    [VT.SHORT_HAUL_CLAIMED]: {
      code:        'HOS-SH',
      title:       'Short-Haul Exemption Invalid',
      regulation:  '49 CFR 395.1(e)',
      description: 'The short-haul exemption applies only when the driver operates ' +
                   'within a 150 air-mile radius of the normal work reporting location ' +
                   'AND returns to that location at end of day. Two variants exist: ' +
                   '(e)(1) standard — released within 14 consecutive hours, applies to all CMV drivers; ' +
                   '(e)(2) non-CDL — allows up to 16 on-duty hours on up to 2 days per 7-day period ' +
                   'for drivers of vehicles not requiring a CDL. ' +
                   'Once a driver operates beyond 150 air miles (typically on activation of ' +
                   'MC Authority and interstate hauling), neither variant applies. Full HOS ' +
                   'recordkeeping and ELD are required.',
      consequence: 'Claiming an exemption you do not qualify for = falsified records. ' +
                   'Missing DVIR $1,270/day, HOS violation $1,000–$16,000 per occurrence.',
      fineRange:   '$1,000–$16,000 per violation + ELD non-compliance penalties',
      csaPoints:   '5–8 points — HOS/ELD violation',
      marcusQuote: '"If your load crosses the 150 air-mile line, you\'re no longer short-haul. Period."',
    },
    [VT.BIG_DAY_INVALID]: {
      code:        'HOS-BIGDAY',
      title:       '16-Hour Big Day Exception Invalid',
      regulation:  '49 CFR 395.1(o)',
      description: 'The Big Day exception lets property-carrying drivers extend the ' +
                   '14-hour on-duty window to 16 hours, once every 7 consecutive days. ' +
                   'It does NOT extend the 11-hour driving limit. To qualify, the driver ' +
                   'must have returned to the normal work-reporting location for the ' +
                   'previous 5 duty tours, must return there on this Big Day, must be ' +
                   'released from duty within 16 hours, and must not have used the ' +
                   'exception in the previous 6 days (unless a 34-hour restart intervened). ' +
                   'Drivers using the §395.1(e)(2) non-CDL short-haul exception on the ' +
                   'same day are ineligible.',
      consequence: "Claimed Big Day that doesn't qualify = driving past the 14-hour " +
                   'window without legal cover. Same penalties as a regular window violation.',
      fineRange:   '$1,000–16,000 per violation',
      csaPoints:   '5–7 points — HOS window violation',
      marcusQuote: "\"Big Day saves you once a week — but only if every condition checks out. Know before you claim.\"",
    },
    [VT.FALSE_LOG]: {
      code:        'HOS-FALSE',
      title:       'Falsified Log / ELD Record',
      regulation:  '49 CFR 395.8(e)',
      description: 'Knowingly falsifying records of duty status — including editing ' +
                   'ELD entries to conceal violations — is a federal offense. ' +
                   'The ELD mandate requires tamper-evident records. ' +
                   'Carriers face up to $12,700 per day for ELD non-compliance.',
      consequence: 'Criminal charges possible. Driver disqualification. Carrier liability.',
      fineRange:   '$12,700/day (carrier) · Criminal charges (driver)',
      csaPoints:   '10 points — critical/falsification',
      marcusQuote: '"Your log didn\'t match the road. That\'s not a paperwork problem — that\'s a federal problem."',
    },
    [VT.ELD_MISSING]: {
      code:        'HOS-ELD',
      title:       'ELD Required — Not Present',
      regulation:  '49 CFR 395.8(a) / ELD mandate (49 CFR 395.20–495.34)',
      description: 'Electronic logging device (ELD) is required for all CMV drivers ' +
                   'subject to HOS regulations in interstate commerce. ' +
                   'The short-haul exemption does NOT apply to Box Truck Boss operations ' +
                   '(routes exceed 150 air miles). An approved ELD must be mounted, ' +
                   'functional, and synced with the driver\'s records of duty status.',
      consequence: 'Carrier: $1,270/day for each day ELD is missing. Driver: citation, possible OOS.',
      fineRange:   '$1,270/day (ELD non-compliance) · $16,000 (falsification)',
      csaPoints:   '5 points — ELD violation',
      marcusQuote: '"That ELD isn\'t optional. Non-CDL does not mean no ELD on an interstate run."',
    },
    [VT.OVERLAP]: {
      code:        'LOG-OVERLAP',
      title:       'Log Entry Overlap',
      regulation:  '49 CFR 395.8',
      description: 'Duty status entries must not overlap and must have positive durations. ' +
                   'Each minute of the driver\'s day must be accounted for in exactly one status.',
      consequence: 'Inaccurate record — citation for falsification possible.',
      fineRange:   'Up to $12,700/day',
      csaPoints:   'Up to 10 points',
      marcusQuote: '"Every minute of your day is on that log. Make it accurate."',
    },
  };

  const detail = catalog[violationType];
  if (!detail) {
    return {
      code:        'UNKNOWN',
      title:       'Unknown violation type',
      regulation:  'N/A',
      description: `No detail available for violation type: ${violationType}`,
      consequence: 'Unknown',
      fineRange:   'Unknown',
      csaPoints:   'Unknown',
      marcusQuote: '"Something went wrong. Check your logs."',
    };
  }
  return detail;
}

// ─────────────────────────────────────────────────────────────────
// FORM-AND-MANNER FLAG DETAILS
// ─────────────────────────────────────────────────────────────────

/**
 * getFormFlagDetails — returns regulatory + pedagogical detail for a
 * form-and-manner flag code. Used by HOSPuzzle's summary screen and
 * Coach's Note to explain what the inspector would see.
 *
 * @param {string} flagCode - One of the FT.* codes
 * @returns {{code, title, regulation, csaWeight, fineRange, description, fix}}
 */
function getFormFlagDetails(flagCode) {
  const table = {
    [FT.FORM_NO_PRETRIP_BEFORE_DRIVE]: {
      code:        'FORM-PT-01',
      title:       'No pre-trip inspection before driving',
      regulation:  '49 CFR §396.13; §395.8(f)',
      csaWeight:   '1 (form-and-manner)',
      fineRange:   'Warning to $500',
      description: 'Driving shift began without a pre-trip inspection on the log. '
                 + 'Pre-trip is required and must appear as on-duty time in RODS.',
      fix:         'Place a pre-trip inspection card (ON_DUTY) before your first '
                 + 'DRIVING card. Typical duration 15-30 minutes.',
    },
    [FT.FORM_NO_POSTTRIP_BEFORE_REST]: {
      code:        'FORM-PT-02',
      title:       'No post-trip inspection before rest',
      regulation:  '49 CFR §396.11; §395.8(f)',
      csaWeight:   '1 (form-and-manner)',
      fineRange:   'Warning to $500',
      description: 'Driving shift ended and went straight to 10-hour rest without '
                 + 'a post-trip DVIR. A post-trip DVIR is required after every '
                 + 'driving day to document vehicle condition.',
      fix:         'Place a post-trip inspection card (ON_DUTY) after your last '
                 + 'DRIVING card, before the 10-hour rest. Typical duration 15-30 min.',
    },
    [FT.FORM_PC_BETWEEN_LOADS]: {
      code:        'FORM-PC-01',
      title:       'Personal Conveyance used between loads',
      regulation:  '49 CFR §395.28(a); 2018 FMCSA Interpretation',
      csaWeight:   '3 (possible falsification indicator)',
      fineRange:   '$1,000–$5,000',
      description: 'PC time logged between two driving blocks in the same shift. '
                 + 'PC is for off-duty personal travel only — using PC to advance '
                 + 'a load or reposition for work is improper. Inspectors treat '
                 + 'improper PC as additional driving time, which can cascade into '
                 + 'HOS violations on audit.',
      fix:         'Remove the PC block, or use ON_DUTY if the travel was work-related. '
                 + 'PC is only appropriate for genuine off-duty personal travel.',
    },
    [FT.FORM_BREAK_NOT_QUALIFYING]: {
      code:        'FORM-BR-01',
      title:       'Break too short to qualify',
      regulation:  '49 CFR §395.3(a)(3)(ii)',
      csaWeight:   '1 (form-and-manner)',
      fineRange:   'Warning to $500',
      description: 'A card labeled "break" was under 30 minutes. The 30-minute '
                 + 'break must be at least 30 consecutive minutes off-duty or in '
                 + 'sleeper berth to count.',
      fix:         'Extend the break card to at least 30 minutes, or remove the '
                 + '"break" label if it was meant as brief off-duty time.',
    },
    [FT.FORM_DRIVE_WITHOUT_10H_REST]: {
      code:        'FORM-DR-01',
      title:       'Drove without 10-hour qualifying rest',
      regulation:  '49 CFR §395.3(a)(1)',
      csaWeight:   '5 (rule-adjacent)',
      fineRange:   '$1,000–$11,000',
      description: 'Driving begins without 10 consecutive hours off-duty or in '
                 + 'sleeper berth preceding it. This is close to an HOS violation — '
                 + 'depending on circumstances inspectors may cite §395.3(a)(1) '
                 + 'directly rather than form-and-manner.',
      fix:         'Add a 10-hour OFF_DUTY (or SLEEPER_BERTH) block before the first '
                 + 'DRIVING block of the shift.',
    },
    [FT.FORM_POSTTRIP_UNREALISTIC]: {
      code:        'FORM-PT-03',
      title:       'Post-trip duration outside normal range',
      regulation:  '49 CFR §396.11; §395.8(f)',
      csaWeight:   '1 (form-and-manner)',
      fineRange:   'Warning',
      description: 'A real post-trip inspection takes 15–60 minutes. Outside that '
                 + 'range, inspectors may question whether the inspection was '
                 + 'actually performed or if the time is being miscategorized.',
      fix:         'Adjust post-trip duration to 15-30 minutes — the typical range.',
    },
    [FT.FORM_SHIFT_NO_ON_DUTY_BOOKEND]: {
      code:        'FORM-SH-01',
      title:       'Shift has no on-duty-not-driving activity',
      regulation:  '49 CFR §395.8(f)',
      csaWeight:   '1 (form-and-manner)',
      fineRange:   'Warning to $500',
      description: 'The shift consists entirely of DRIVING with no pre-trip, '
                 + 'loading, paperwork, fueling, or post-trip recorded. Real '
                 + 'operational days always include on-duty (not driving) time.',
      fix:         'Add pre-trip and post-trip cards to bookend the driving work. '
                 + 'If the shift included loading or fueling, log those too.',
    },
  };
  return table[flagCode] || {
    code:        flagCode,
    title:       flagCode,
    regulation:  'Unknown',
    csaWeight:   'Unknown',
    fineRange:   'Unknown',
    description: 'Form-and-manner flag. See 49 CFR §395.8(f).',
    fix:         'Review your log for sequencing and completeness.',
  };
}

// ─────────────────────────────────────────────────────────────────
// UTILITY / FORMATTING HELPERS (internal — not exported)
// ─────────────────────────────────────────────────────────────────

/** Format minutes as "Xh Ym" string. */
function _fmt(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format minutes as "X.Xh" decimal string. */
function _fmtH(minutes) {
  return `${(minutes / 60).toFixed(1)}h`;
}

/** Human-readable label for a duty status type. */
function _typeLabel(type) {
  return {
    [TYPE.DRIVING]:             'Driving',
    [TYPE.ON_DUTY_NOT_DRIVING]: 'On Duty (Not Driving)',
    [TYPE.OFF_DUTY]:            'Off Duty',
    [TYPE.SLEEPER_BERTH]:       'Sleeper Berth',
  }[type] || type;
}

/** Color token for UI rendering (maps to game's color system). */
function _typeColor(type) {
  return {
    [TYPE.DRIVING]:             '#3a7ae8',   // blue
    [TYPE.ON_DUTY_NOT_DRIVING]: '#f59f00',   // amber
    [TYPE.OFF_DUTY]:            '#22c570',   // green
    [TYPE.SLEEPER_BERTH]:       '#7c5cbf',   // purple
  }[type] || '#888888';
}

// ─────────────────────────────────────────────────────────────────
// FORM-AND-MANNER DETECTION
// ─────────────────────────────────────────────────────────────────

/**
 * Heuristic label matching — entries have human-readable labels that tell
 * us what kind of activity the card represents. The engine shouldn't need
 * to know template IDs (those belong to HOSScenarios.js), so we match on
 * label substrings.
 */
function _labelIs(entry, kind) {
  const l = String(entry.label || '').toLowerCase();
  switch (kind) {
    case 'pretrip':   return l.includes('pre-trip') || l.includes('pretrip');
    case 'posttrip':  return l.includes('post-trip') || l.includes('posttrip');
    case 'break':     return l.includes('break') && !l.includes('breakfast');
    case 'load':      return l.includes('load') || l.includes('unload') || l.includes('cargo') || l.includes('pickup') || l.includes('deliver');
    case 'fuel':      return l.includes('fuel');
    default:          return false;
  }
}

/**
 * checkFormAndManner — detect log-quality issues that aren't HOS rule
 * violations but would be flagged during a DOT audit or roadside inspection
 * review of the driver's previous 7 days.
 *
 * Examples:
 *   - Driving block appears without a pre-trip inspection earlier in the shift
 *   - Shift ends with driving but no post-trip before the 10-hour rest
 *   - Personal Conveyance block sits between two driving blocks (§395.28
 *     violation: PC isn't allowed to advance a load)
 *   - A 30-minute "break" marker is actually <30 min of continuous off-duty
 *   - Driving begins without a qualifying 10-hour rest preceding it
 *
 * These are real form-and-manner concerns. A driver can file a log that's
 * technically HOS-compliant (no hour limit broken) but still tells an
 * implausible story — an inspector reviewing the driver's past 7 days will
 * flag these. CSA weight for form-and-manner is typically 1; pattern-level
 * falsification indicators can escalate to weight 3-7.
 *
 * @param {Array} entries - Sorted duty status entries (as passed to validateSchedule)
 * @param {Object} [context] - Optional scenario context (not currently used,
 *                             reserved for scenario-specific flag tuning)
 * @returns {Array<{code, severity, description, atMinute?}>} Form flags
 */
function checkFormAndManner(entries, context = {}) {
  const flags = [];
  if (!Array.isArray(entries) || entries.length === 0) return flags;
  const sorted = _sorted(entries);

  // ── Find "shift segments" — work blocks separated by 10h+ rest ────
  // A shift starts at the first on-duty/driving after a qualifying rest
  // and ends before the next qualifying rest. We detect shifts so we can
  // look for missing pre-trip/post-trip per shift.
  const shifts = [];
  let curShift = null;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const isRest = (e.type === TYPE.OFF_DUTY || e.type === TYPE.SLEEPER_BERTH);
    const isQualifyingRest = isRest && (e.durationMinutes || 0) >= R.PRIOR_REST_MIN;

    if (isQualifyingRest) {
      if (curShift) {
        curShift.endIndex = i - 1;
        shifts.push(curShift);
        curShift = null;
      }
    } else {
      const isWork = (e.type === TYPE.ON_DUTY_NOT_DRIVING || e.type === TYPE.DRIVING);
      if (isWork && !curShift) {
        curShift = { startIndex: i, endIndex: i };
      } else if (curShift) {
        curShift.endIndex = i;
      }
    }
  }
  if (curShift) {
    curShift.endIndex = sorted.length - 1;
    shifts.push(curShift);
  }

  // ── For each shift, check form-and-manner expectations ────────────
  for (const shift of shifts) {
    const shiftEntries = sorted.slice(shift.startIndex, shift.endIndex + 1);
    const shiftHasDriving = shiftEntries.some(e => e.type === TYPE.DRIVING);
    if (!shiftHasDriving) continue;   // no driving → no pre/post-trip required

    const firstDrivingIdx = shiftEntries.findIndex(e => e.type === TYPE.DRIVING);
    const lastDrivingIdx  = (() => {
      for (let j = shiftEntries.length - 1; j >= 0; j--) {
        if (shiftEntries[j].type === TYPE.DRIVING) return j;
      }
      return -1;
    })();

    // ── FLAG: no pre-trip inspection before first driving ──
    // The first on-duty(not driving) block before driving should be a
    // pre-trip. If the first non-rest block is a drive, or if the blocks
    // before it don't look like a pre-trip, flag it.
    const beforeFirstDrive = shiftEntries.slice(0, firstDrivingIdx);
    const hasPreTripBeforeDrive = beforeFirstDrive.some(e =>
      e.type === TYPE.ON_DUTY_NOT_DRIVING && _labelIs(e, 'pretrip')
    );
    if (!hasPreTripBeforeDrive) {
      const firstDrive = shiftEntries[firstDrivingIdx];
      flags.push({
        code:        FT.FORM_NO_PRETRIP_BEFORE_DRIVE,
        severity:    SEV.MINOR,
        description: 'Driving block began without a pre-trip inspection. '
                   + '49 CFR §396.13 requires pre-trip inspection; FMCSA '
                   + 'guidance treats pre-trip time as on-duty work that '
                   + 'must appear in the RODS.',
        atMinute:    firstDrive.startMinute,
      });
    }

    // ── FLAG: no post-trip before 10h rest ──
    // After the last driving block in a shift, there should be a post-trip
    // on-duty block before a qualifying rest. If the last driving block
    // leads directly into a rest with no post-trip, flag it.
    if (lastDrivingIdx >= 0) {
      const afterLastDrive = shiftEntries.slice(lastDrivingIdx + 1);
      const hasPostTripAfterDrive = afterLastDrive.some(e =>
        e.type === TYPE.ON_DUTY_NOT_DRIVING && _labelIs(e, 'posttrip')
      );
      if (!hasPostTripAfterDrive) {
        // Only flag if the shift actually ends (is followed by a rest or
        // end-of-entries); partial days shouldn't be flagged.
        const shiftFollowedByRest = (shift.endIndex < sorted.length - 1)
          && (sorted[shift.endIndex + 1].type === TYPE.OFF_DUTY
              || sorted[shift.endIndex + 1].type === TYPE.SLEEPER_BERTH);
        if (shiftFollowedByRest) {
          const lastDrive = shiftEntries[lastDrivingIdx];
          flags.push({
            code:        FT.FORM_NO_POSTTRIP_BEFORE_REST,
            severity:    SEV.MINOR,
            description: 'Shift ended with driving but no post-trip inspection '
                       + 'was recorded before the 10-hour rest. 49 CFR §396.11 '
                       + 'requires a post-trip DVIR at the end of each driving day.',
            atMinute:    lastDrive.startMinute + lastDrive.durationMinutes,
          });
        }
      }
    }
  }

  // ── FLAG: Personal Conveyance used between loads ──
  // Per 2018 FMCSA interpretation of §395.28(a), PC is off-duty time
  // traveling for personal reasons. PC CANNOT be used to advance a load,
  // travel from shipper to receiver, or reposition for work. So if a
  // PC block appears with driving-for-work on both sides without a
  // qualifying rest in between, that's improper PC use.
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (!e.pc) continue;   // only PC-flagged blocks matter here
    // Find the nearest work-driving block before and after this PC
    let driveBefore = null, driveAfter = null;
    for (let j = i - 1; j >= 0; j--) {
      const p = sorted[j];
      // If we hit a qualifying rest first, the "chain" is broken — PC is fine
      if ((p.type === TYPE.OFF_DUTY || p.type === TYPE.SLEEPER_BERTH)
          && (p.durationMinutes || 0) >= R.PRIOR_REST_MIN && !p.pc) break;
      if (p.type === TYPE.DRIVING) { driveBefore = p; break; }
    }
    for (let j = i + 1; j < sorted.length; j++) {
      const n = sorted[j];
      if ((n.type === TYPE.OFF_DUTY || n.type === TYPE.SLEEPER_BERTH)
          && (n.durationMinutes || 0) >= R.PRIOR_REST_MIN && !n.pc) break;
      if (n.type === TYPE.DRIVING) { driveAfter = n; break; }
    }
    if (driveBefore && driveAfter) {
      flags.push({
        code:        FT.FORM_PC_BETWEEN_LOADS,
        severity:    SEV.MAJOR,
        description: 'Personal Conveyance used between two driving blocks in '
                   + 'the same shift. Per 2018 FMCSA guidance on §395.28(a), '
                   + 'PC cannot be used to advance a load or reposition for '
                   + 'work — it must be off-duty personal travel. Improper '
                   + 'PC use is treated as driving time by inspectors.',
        atMinute:    e.startMinute,
      });
    }
  }

  // ── FLAG: "Break" label but duration < 30 min ──
  // A qualifying 30-minute break per §395.3(a)(3)(ii) must be 30
  // consecutive minutes off-duty or sleeper. If a card is labeled "break"
  // but its duration is less than 30 min, it won't count toward the
  // break requirement — and the sequence looks suspicious to inspectors.
  const QUALIFYING_BREAK_MIN = 30;   // 49 CFR §395.3(a)(3)(ii)
  for (const e of sorted) {
    if (_labelIs(e, 'break') && (e.durationMinutes || 0) < QUALIFYING_BREAK_MIN
        && (e.type === TYPE.OFF_DUTY || e.type === TYPE.SLEEPER_BERTH)) {
      flags.push({
        code:        FT.FORM_BREAK_NOT_QUALIFYING,
        severity:    SEV.MINOR,
        description: `A break of ${e.durationMinutes} minutes does not meet the `
                   + '30-minute qualifying break requirement in §395.3(a)(3)(ii). '
                   + 'The break must be 30 consecutive minutes off-duty or in '
                   + 'sleeper berth.',
        atMinute:    e.startMinute,
      });
    }
  }

  // ── FLAG: Driving begins without a preceding 10h qualifying rest ──
  // Before any driving block can legitimately start a shift, there must
  // be ≥10h of off-duty or sleeper berth somewhere before the shift starts
  // (the first on-duty block of that shift). Detection checks the rest
  // immediately preceding the shift's first on-duty entry.
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.type !== TYPE.DRIVING) continue;

    // Is this the first drive of a NEW shift? A new shift = this drive is
    // preceded by a qualifying rest with no intervening work.
    let isFirstDriveOfShift = true;
    let shiftStartIdx = i;
    for (let j = i - 1; j >= 0; j--) {
      const p = sorted[j];
      if (p.type === TYPE.DRIVING) { isFirstDriveOfShift = false; break; }
      if (p.type === TYPE.ON_DUTY_NOT_DRIVING) {
        // Walking through the shift backward — this is the new shift start (so far)
        shiftStartIdx = j;
        continue;
      }
      // p is OFF_DUTY or SLEEPER_BERTH
      if (!p.pc && (p.durationMinutes || 0) >= R.PRIOR_REST_MIN) {
        break;  // found qualifying rest — shift starts right after this
      }
      // Short rest or PC — keep walking (still "in shift")
    }

    if (!isFirstDriveOfShift) continue;

    // Now measure the rest accumulated immediately before shiftStartIdx
    let restBefore = 0;
    for (let j = shiftStartIdx - 1; j >= 0; j--) {
      const p = sorted[j];
      if (p.type === TYPE.OFF_DUTY || p.type === TYPE.SLEEPER_BERTH) {
        if (!p.pc) restBefore += (p.durationMinutes || 0);
      } else {
        break;   // hit work — stop counting rest
      }
    }

    if (restBefore < R.PRIOR_REST_MIN) {
      flags.push({
        code:        FT.FORM_DRIVE_WITHOUT_10H_REST,
        severity:    SEV.MAJOR,
        description: 'Driving began without a 10-hour qualifying rest '
                   + 'preceding it. §395.3(a)(1) requires 10 consecutive '
                   + 'hours off-duty before driving. The logbook shows '
                   + 'only ' + _fmtH(restBefore) + ' of rest.',
        atMinute:    e.startMinute,
      });
      break;   // one flag per schedule is enough
    }
  }

  // ── FLAG: Post-trip duration unrealistic ──
  // A post-trip inspection of under 15 min is suspicious; over 60 min
  // is equally so. Real post-trips run 15-30 minutes.
  for (const e of sorted) {
    if (e.type !== TYPE.ON_DUTY_NOT_DRIVING) continue;
    if (!_labelIs(e, 'posttrip')) continue;
    const dur = e.durationMinutes || 0;
    if (dur < 15 || dur > 60) {
      flags.push({
        code:        FT.FORM_POSTTRIP_UNREALISTIC,
        severity:    SEV.MINOR,
        description: `Post-trip inspection duration (${dur} min) is outside `
                   + 'the typical 15–60 minute range. Inspectors may question '
                   + 'whether the post-trip was actually performed.',
        atMinute:    e.startMinute,
      });
    }
  }

  // ── FLAG: Shift has no on-duty-not-driving bookend ──
  // A shift consisting entirely of DRIVING blocks with no pre-trip or
  // post-trip bookends is operationally implausible. This catches the
  // "pure driving" shift pattern that's a red flag in audits.
  for (const shift of shifts) {
    const shiftEntries = sorted.slice(shift.startIndex, shift.endIndex + 1);
    if (!shiftEntries.some(e => e.type === TYPE.DRIVING)) continue;
    const hasAnyOnDuty = shiftEntries.some(e => e.type === TYPE.ON_DUTY_NOT_DRIVING);
    if (!hasAnyOnDuty) {
      flags.push({
        code:        FT.FORM_SHIFT_NO_ON_DUTY_BOOKEND,
        severity:    SEV.MINOR,
        description: 'Shift contains only driving — no on-duty-not-driving '
                   + 'activity recorded. Real operational days include pre-trip, '
                   + 'loading, paperwork, or fueling on-duty time. A shift of '
                   + 'pure driving is a form-and-manner red flag.',
        atMinute:    shiftEntries[0].startMinute,
      });
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────────
// SEQUENCE COMPLIANCE CHECKING
// ─────────────────────────────────────────────────────────────────

/**
 * checkSequenceCompliance — verify that the player's placed cards
 * follow the scenario's declared sequence roles.
 *
 * Rules enforced:
 *   1. shift_start (e.g., pre-trip) must be the FIRST work activity
 *      of the shift. If a driving or shift_middle card appears before
 *      shift_start, we raise SEQ_PRETRIP_NOT_FIRST.
 *
 *   2. shift_end (e.g., post-trip) must be the LAST work activity of
 *      the shift. Work cards appearing after shift_end raise
 *      SEQ_WORK_AFTER_POSTTRIP. If multiple shift_end cards exist,
 *      the first one "closes" the shift.
 *
 *   3. shift_end without a prior shift_start raises
 *      SEQ_SHIFT_END_WITHOUT_START.
 *
 *   4. Order within shift_middle is flexible — no rules enforced.
 *      HOS rule validation (validateSchedule) handles semantic order
 *      like "break at the 8-hour mark."
 *
 * This function operates on "placed cards" — the entries the player
 * has explicitly placed on the timeline, WITH their sequence roles
 * resolved from the scenario. The synthetic prior-rest anchor in the
 * engine's entry list is not part of this check; it's not a placed
 * card with a role.
 *
 * @param {Array<{type, startMinute, durationMinutes, sequenceRole?}>} placedEntries
 *        Entries in TIMELINE-PLACEMENT order (the order the player
 *        dropped them). Each may have a `sequenceRole` from the
 *        card template.
 * @param {Object} [context] - Reserved for future scenario-specific tuning
 * @returns {Array<{code, severity, description, atMinute?, placementIndex?}>}
 */
function checkSequenceCompliance(placedEntries, context = {}) {
  const violations = [];
  if (!Array.isArray(placedEntries) || placedEntries.length === 0) return violations;

  // We evaluate in CHRONOLOGICAL order (by startMinute), not placement
  // order. The engine's contract is "this is what the log looks like on
  // the logbook grid." Sequence role rules apply to how the DAY reads
  // chronologically, not the order fingers happened to tap cards.
  const sorted = [...placedEntries]
    .filter(e => e && typeof e.startMinute === 'number')
    .sort((a, b) => a.startMinute - b.startMinute);

  // ── Build shift segmentation (same approach as checkFormAndManner) ──
  // A shift is bounded by qualifying rest (≥10h off-duty/sleeper). Within
  // each shift we check role ordering.
  const shifts = [];
  let curShift = null;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const isRest = (e.type === TYPE.OFF_DUTY || e.type === TYPE.SLEEPER_BERTH)
                   && !e.pc;
    const isQualifyingRest = isRest && (e.durationMinutes || 0) >= R.PRIOR_REST_MIN;
    const isWork = e.type === TYPE.DRIVING || e.type === TYPE.ON_DUTY_NOT_DRIVING;

    if (isQualifyingRest) {
      if (curShift) {
        curShift.endIndex = i - 1;
        shifts.push(curShift);
        curShift = null;
      }
    } else if (isWork || (isRest && !isQualifyingRest)) {
      // Work OR short rest (within a shift). PC also counts as in-shift.
      if (!curShift) {
        curShift = { startIndex: i, endIndex: i };
      } else {
        curShift.endIndex = i;
      }
    } else if (e.pc && curShift) {
      // PC with active shift — keep the shift alive
      curShift.endIndex = i;
    }
  }
  if (curShift) {
    curShift.endIndex = sorted.length - 1;
    shifts.push(curShift);
  }

  // ── For each shift, evaluate role ordering ──
  for (const shift of shifts) {
    const shiftEntries = sorted.slice(shift.startIndex, shift.endIndex + 1);

    // Find role positions within the shift
    const firstShiftStartIdx = shiftEntries.findIndex(e => e.sequenceRole === 'shift_start');
    const firstShiftEndIdx   = shiftEntries.findIndex(e => e.sequenceRole === 'shift_end');

    // ── SEQ_PRETRIP_NOT_FIRST ──
    // If any non-rest work card appears BEFORE the first shift_start,
    // that's a sequence violation. Exception: if there is no shift_start
    // card in this shift at all, the FORM_NO_PRETRIP_BEFORE_DRIVE
    // form-flag handles it — we don't double-report.
    if (firstShiftStartIdx > 0) {
      const priorWork = shiftEntries.slice(0, firstShiftStartIdx).find(e =>
        e.type === TYPE.DRIVING
        || (e.type === TYPE.ON_DUTY_NOT_DRIVING && e.sequenceRole !== 'shift_start')
      );
      if (priorWork) {
        violations.push({
          code:     ST.SEQ_PRETRIP_NOT_FIRST,
          severity: SEV.MAJOR,
          rule:     'SEQUENCE',
          description: 'Pre-trip inspection must be the first on-duty '
                     + 'activity of the shift. Driving or other work was '
                     + 'logged before pre-trip. 49 CFR §396.13 requires '
                     + 'pre-trip BEFORE operating the vehicle; logging it '
                     + 'after is log falsification.',
          atMinute:     priorWork.startMinute,
        });
      }
    }

    // ── SEQ_WORK_AFTER_POSTTRIP ──
    // If any work card appears AFTER the first shift_end, the shift
    // structure is broken. Post-trip closes the day.
    if (firstShiftEndIdx >= 0 && firstShiftEndIdx < shiftEntries.length - 1) {
      const afterEnd = shiftEntries.slice(firstShiftEndIdx + 1).find(e =>
        e.type === TYPE.DRIVING
        || (e.type === TYPE.ON_DUTY_NOT_DRIVING && e.sequenceRole !== 'shift_end')
      );
      if (afterEnd) {
        violations.push({
          code:     ST.SEQ_WORK_AFTER_POSTTRIP,
          severity: SEV.MAJOR,
          rule:     'SEQUENCE',
          description: 'Work activity logged after the post-trip inspection. '
                     + 'Post-trip closes the driving day per 49 CFR §396.11. '
                     + 'Additional work on the same shift after post-trip '
                     + 'indicates either a log error or a missing rest period.',
          atMinute:     afterEnd.startMinute,
        });
      }
    }

    // ── SEQ_SHIFT_END_WITHOUT_START ──
    // Post-trip logged but no pre-trip preceded it in the same shift.
    // (If there's NO driving at all in the shift, this doesn't apply —
    // post-trip requirement is driving-day-bound.)
    if (firstShiftEndIdx >= 0 && firstShiftStartIdx < 0) {
      const hasDriving = shiftEntries.some(e => e.type === TYPE.DRIVING);
      if (hasDriving) {
        violations.push({
          code:     ST.SEQ_SHIFT_END_WITHOUT_START,
          severity: SEV.MAJOR,
          rule:     'SEQUENCE',
          description: 'Post-trip inspection logged, but no pre-trip '
                     + 'inspection preceded it in this shift. Every driving '
                     + 'shift must have a pre-trip; logging only the '
                     + 'post-trip means the pre-trip was either skipped '
                     + '(§396.13 violation) or falsified.',
          atMinute:     shiftEntries[firstShiftEndIdx].startMinute,
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Batch 4e-2: FINAL-TILE STRUCTURAL RULES
  //
  // A driving day must close with rest. This matches §395.3(a)(1):
  // "After a driver has come off duty for 10 consecutive hours, a new
  // driving period begins." Inversely: a shift that does not end in
  // 10h rest cannot legally start a new driving period.
  //
  // Rule A (SEQ_MISSING_CLOSING_REST): if the chronologically last
  // placed tile is NOT a qualifying rest (sequenceRole = 'after_shift'),
  // the log is missing the required closing rest. Only fires if a
  // shift exists (i.e., any DRIVING tile was placed). Pure-rest days
  // like 34h restart already end in rest and are naturally compliant.
  //
  // Rule B (SEQ_POSTTRIP_NOT_BEFORE_REST): the tile immediately before
  // the closing rest must be post-trip. This reflects real-world
  // practice: DVIR is filed as the last act of the driving day, then
  // rest begins. If the sequence is "drive → rest" with no post-trip,
  // either post-trip was skipped (§396.11 violation) or falsified.
  //
  // These rules apply to the log AS A WHOLE, not per-shift — because
  // the user's requirement is about the final tile of the entire log.
  // ────────────────────────────────────────────────────────────────

  const hasAnyDriving = sorted.some(e => e.type === TYPE.DRIVING);

  if (hasAnyDriving && sorted.length > 0) {
    const lastEntry = sorted[sorted.length - 1];
    const secondToLast = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
    const lastIsClosingRest = lastEntry.sequenceRole === 'after_shift';

    // Rule A: last tile must be closing rest
    if (!lastIsClosingRest) {
      violations.push({
        code:     ST.SEQ_MISSING_CLOSING_REST,
        severity: SEV.MAJOR,
        rule:     'SEQUENCE',
        description: 'Driving day does not end in a qualifying rest period. '
                   + 'The last tile in your log should be a 10-hour off-duty '
                   + 'reset, 10-hour sleeper berth, or 34-hour cycle reset. '
                   + 'Per 49 CFR §395.3(a)(1), a new driving period can only '
                   + 'begin AFTER 10 consecutive hours off duty — a log that '
                   + 'doesn\'t show that rest is incomplete.',
        atMinute:   lastEntry.startMinute,
      });
    }

    // Rule B: if the log DOES end in rest, the tile before must be post-trip
    // (and only if there was driving — pure rest days don't need post-trip)
    if (lastIsClosingRest && secondToLast) {
      const secondRole = secondToLast.sequenceRole;
      if (secondRole !== 'shift_end') {
        violations.push({
          code:     ST.SEQ_POSTTRIP_NOT_BEFORE_REST,
          severity: SEV.MAJOR,
          rule:     'SEQUENCE',
          description: 'The tile immediately before your 10-hour rest should '
                     + 'be the post-trip inspection. Per 49 CFR §396.11, a '
                     + 'DVIR is filed at the END of each driving day — '
                     + 'between your last work activity and the rest period. '
                     + 'A log that goes directly from driving or loading to '
                     + 'rest without a post-trip means the inspection was '
                     + 'either skipped (§396.11 violation) or falsified.',
          atMinute:   secondToLast.startMinute,
        });
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Batch 4f-2: MISSING DRIVE TRANSITION RULE
  //
  // Real-world drivers must drive between activities at different
  // physical locations. Pre-trip happens at the yard; pickup happens
  // at the shipper's dock; rest happens at a truck stop. The driver
  // physically cannot teleport between these locations — every
  // transition between locations requires drive time on the log.
  //
  // A log that shows "unload at dock" → "post-trip at yard" with
  // no drive between is prima facie evidence of falsification under
  // §395.8 — physically impossible records. DOT inspectors who notice
  // this pattern can write the driver up for falsifying logs.
  //
  // What counts as a "missing drive transition":
  //   - preTrip is followed by a non-DRIVING activity (must drive
  //     from yard to first stop)
  //   - postTrip is preceded by a non-DRIVING activity (must drive
  //     to where post-trip happens)
  //   - load/unload/break/fuel is preceded OR followed by another
  //     non-DRIVING activity (must drive between activities at
  //     different locations)
  //
  // Exceptions (no drive required):
  //   - detention IMMEDIATELY after loadCargo (driver waiting at
  //     same shipper, no movement)
  //   - Off-shift rest (after_shift sequenceRole) following any
  //     activity — rest happens wherever the truck is parked
  //   - The very first or last entry of the log (no neighbor to
  //     check against)
  //
  // SEVERITY ESCALATION:
  //   - 1 missed drive transition → MINOR (form-and-manner level,
  //     +1 to +3 CSA points, raises inspection probability for 7 days
  //     but doesn't fail the log on its own)
  //   - 2+ missed drive transitions in the same log → ALSO emit a
  //     SEQ_FALSIFIED_PATTERN MAJOR violation (pattern indicates
  //     systematic falsification, $12,700 federal fine range)
  //
  // The MINOR severity individual violations are still useful
  // pedagogically — they pinpoint exactly which transitions were
  // missed so the player learns the rule.
  // ────────────────────────────────────────────────────────────────

  const missingDriveTransitions = _findMissingDriveTransitions(sorted);
  for (const miss of missingDriveTransitions) {
    violations.push({
      code:     ST.SEQ_MISSING_DRIVE_TRANSITION,
      severity: SEV.MINOR,
      rule:     'SEQUENCE',
      description: miss.description,
      atMinute: miss.atMinute,
    });
  }

  // Pattern escalation: multiple missed transitions in one log
  // indicate systematic falsification, not a one-off mistake.
  if (missingDriveTransitions.length >= 2) {
    violations.push({
      code:     ST.SEQ_FALSIFIED_PATTERN,
      severity: SEV.MAJOR,
      rule:     'SEQUENCE',
      description: `Log contains ${missingDriveTransitions.length} missing drive `
                 + `transitions between activities at different locations. A single `
                 + `missed drive is a form-and-manner issue, but a pattern of `
                 + `${missingDriveTransitions.length} in one day reads as systematic `
                 + `log falsification under §395.8. DOT inspectors flag this pattern `
                 + `as evidence the driver is not maintaining accurate records of duty `
                 + `status — a major violation with fines up to $12,700.`,
      atMinute: missingDriveTransitions[0].atMinute,
    });
  }

  return violations;
}

/**
 * Find missing drive transitions in a sorted log.
 *
 * Returns an array of { atMinute, description, prevTemplate, currTemplate }
 * for each adjacent pair of non-driving entries that should have had
 * a drive between them.
 *
 * @param {Array} sorted - chronologically sorted entries
 * @returns {Array} list of missing-transition descriptors
 */
function _findMissingDriveTransitions(sorted) {
  const misses = [];
  if (sorted.length < 2) return misses;

  // Helper: is this entry an off-shift rest tile?
  const isOffShiftRest = (e) => e.sequenceRole === 'after_shift';

  // Helper: is this entry a "transition activity" — one of the templates
  // that the user identified as requiring drive bracketing?
  // preTrip, postTrip, loadCargo, unloadCargo, mandatoryBreak, fuelStop,
  // loadMultistop. NOT detention (special case — same location as load).
  const isTransitionActivity = (e) => {
    const tplId = e.templateId || '';
    return tplId === 'preTrip'
        || tplId === 'postTrip'
        || tplId === 'loadCargo'
        || tplId === 'unloadCargo'
        || tplId === 'loadMultistop'
        || tplId === 'mandatoryBreak'
        || tplId === 'fuelStop';
  };

  // Helper: are two adjacent entries an exception pair where no drive
  // is required? These are pairs where, in the most common real-world
  // operation pattern, the two activities happen at the same physical
  // location:
  //
  //   loadCargo ↔ detention:    driver waiting at shipper while load is
  //                             prepared / paperwork processed.
  //
  //   unloadCargo ↔ postTrip:   driver delivers at consignee, then post-
  //                             trips at the same delivery dock or
  //                             adjacent rest area. The closing inspection
  //                             happens where the truck was last used.
  //                             (Some operations DO require a dock→yard
  //                             drive — those scenarios should explicitly
  //                             include a `driveExtra` card to model it.)
  //
  //   unloadCargo ↔ detention:  driver waiting at consignee for receiver
  //                             to verify and sign BOL.
  //
  //   fuelStop ↔ mandatoryBreak: driver fuels at truck stop, takes the
  //                             30-min break at the same fuel island /
  //                             adjacent rest area.
  //
  // NOT exempted: preTrip ↔ loadCargo. The most common real-world pattern
  // is: pre-trip at company yard, drive to shipper, load. A log without
  // a drive between them indicates either: (a) the operation is shipper-
  // adjacent (rare — should be modeled explicitly with same-location data),
  // or (b) the driver omitted the drive (a falsification pattern). Keeping
  // this in the violation set catches (b) reliably.
  const isExceptionPair = (prev, curr) => {
    const a = prev.templateId, b = curr.templateId;
    const pair = (x, y) => (a === x && b === y) || (a === y && b === x);
    return pair('loadCargo',   'detention')
        || pair('unloadCargo', 'postTrip')
        || pair('unloadCargo', 'detention')
        || pair('fuelStop',    'mandatoryBreak');
  };

  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const curr = sorted[i + 1];

    // Skip if either is DRIVING — drive IS the transition
    if (prev.type === TYPE.DRIVING || curr.type === TYPE.DRIVING) continue;

    // Skip if either is off-shift rest (rest happens wherever truck is)
    if (isOffShiftRest(prev) || isOffShiftRest(curr)) continue;

    // Skip if neither is a transition activity (e.g., two consecutive
    // detention tiles, two consecutive off-duty tiles within shift)
    if (!isTransitionActivity(prev) && !isTransitionActivity(curr)) continue;

    // Skip exception pairs (loadCargo + detention)
    if (isExceptionPair(prev, curr)) continue;

    // This is a missing-drive transition.
    misses.push({
      atMinute: curr.startMinute,
      prevTemplate: prev.templateId,
      currTemplate: curr.templateId,
      description: `Missing drive transition between ${prev.templateId || prev.type} `
                 + `and ${curr.templateId || curr.type}. Real-world drivers must drive `
                 + `between activities at different physical locations — the truck `
                 + `cannot teleport. A log that shows two non-driving activities `
                 + `back-to-back at different places is a §395.8 form-and-manner `
                 + `issue (incomplete record of duty status). Add a drive tile `
                 + `between them or the log reads as falsified.`,
    });
  }

  return misses;
}

/**
 * getSequenceViolationDetails — pedagogical detail for a sequence
 * violation code. Mirrors getViolationDetails / getFormFlagDetails.
 *
 * @param {string} code - One of ST.*
 * @returns {{code, title, regulation, csaWeight, fineRange, description, fix}}
 */
function getSequenceViolationDetails(code) {
  const table = {
    [ST.SEQ_PRETRIP_NOT_FIRST]: {
      code:        'SEQ-01',
      title:       'Pre-trip not first in shift',
      regulation:  '49 CFR §396.13; §395.8(f)',
      csaWeight:   '5 (log falsification indicator)',
      fineRange:   '$1,000–$12,700',
      description: 'The pre-trip inspection was logged AFTER driving or '
                 + 'other work began. §396.13 requires pre-trip inspection '
                 + 'BEFORE operating the vehicle. An inspector reviewing '
                 + 'this log would see the time ordering doesn\'t match '
                 + 'reality — either the inspection was skipped or the '
                 + 'timestamps are false. Either way: a sequence violation.',
      fix:         'Place the pre-trip card FIRST in your shift, before any '
                 + 'driving or loading. It should be the first on-duty '
                 + 'activity after your 10-hour rest.',
    },
    [ST.SEQ_POSTTRIP_NOT_LAST]: {
      code:        'SEQ-02',
      title:       'Post-trip not last in shift',
      regulation:  '49 CFR §396.11; §395.8(f)',
      csaWeight:   '3 (form-and-manner serious)',
      fineRange:   '$500–$5,000',
      description: 'The post-trip inspection appeared mid-shift with more '
                 + 'work following it. Post-trip closes the driving day — '
                 + 'the DVIR is filed after all work is complete.',
      fix:         'Place the post-trip card LAST in your shift, after all '
                 + 'driving, loading, and other work is done. The 10-hour '
                 + 'rest immediately follows.',
    },
    [ST.SEQ_WORK_AFTER_POSTTRIP]: {
      code:        'SEQ-03',
      title:       'Work logged after post-trip',
      regulation:  '49 CFR §396.11; §395.8(f)',
      csaWeight:   '5 (log falsification indicator)',
      fineRange:   '$1,000–$12,700',
      description: 'Driving or on-duty work was logged AFTER the post-trip '
                 + 'inspection closed the shift. This is structurally '
                 + 'impossible on a real log — the DVIR is filed as the '
                 + 'last act before rest. The log shows either falsified '
                 + 'times or a skipped rest period.',
      fix:         'Either move the post-trip card to actually be last, or '
                 + 'insert a 10-hour rest between the post-trip and the '
                 + 'following work (starting a new shift).',
    },
    [ST.SEQ_SHIFT_END_WITHOUT_START]: {
      code:        'SEQ-04',
      title:       'Post-trip without pre-trip',
      regulation:  '49 CFR §396.13; §395.8(f)',
      csaWeight:   '5 (log falsification indicator)',
      fineRange:   '$1,000–$12,700',
      description: 'A post-trip inspection was logged but no pre-trip '
                 + 'inspection preceded it in the shift. Every driving '
                 + 'day requires a pre-trip — its absence from the log '
                 + 'means either the inspection was skipped (§396.13 '
                 + 'violation) or the log is falsified.',
      fix:         'Place a pre-trip card at the start of the shift, '
                 + 'before any driving.',
    },
    [ST.SEQ_MISSING_CLOSING_REST]: {
      code:        'SEQ-05',
      title:       'Log does not end in rest',
      regulation:  '49 CFR §395.3(a)(1); §395.8(f)',
      csaWeight:   '5 (log falsification / incomplete log)',
      fineRange:   '$1,000–$12,700',
      description: 'Your driving day must close with a qualifying rest '
                 + 'period before a new driving period can begin. The last '
                 + 'tile in your log should be one of: 10-hour off-duty '
                 + 'reset (daily), 10-hour sleeper berth, or 34-hour cycle '
                 + 'reset (weekly). A log that ends with work — driving, '
                 + 'loading, or post-trip — is either incomplete or the '
                 + 'rest period was falsified to appear shorter than it was.',
      fix:         'Place a 10-hour rest tile (or 34-hour reset) as the '
                 + 'LAST tile in your log, right after the post-trip '
                 + 'inspection. This shows the inspector when your next '
                 + 'shift can legally begin.',
    },
    [ST.SEQ_POSTTRIP_NOT_BEFORE_REST]: {
      code:        'SEQ-06',
      title:       'No post-trip before rest',
      regulation:  '49 CFR §396.11; §395.8(f)',
      csaWeight:   '5 (log falsification / inspection skipped)',
      fineRange:   '$1,000–$12,700',
      description: 'Your log shows work going directly to rest without a '
                 + 'post-trip inspection in between. Per §396.11, the DVIR '
                 + '(Driver Vehicle Inspection Report) is filed at the END '
                 + 'of each driving day — it\'s the last on-duty activity '
                 + 'before the 10-hour rest. A log missing this step '
                 + 'indicates either the inspection was skipped or the '
                 + 'timestamps are false.',
      fix:         'Place the post-trip inspection as the tile immediately '
                 + 'before your closing 10-hour rest. Order should be: '
                 + '(your last work) → post-trip → 10h rest.',
    },
    [ST.SEQ_MISSING_DRIVE_TRANSITION]: {
      code:        'SEQ-07',
      title:       'Missing drive between activities at different locations',
      regulation:  '49 CFR §395.8 (form-and-manner); §395.8(e) (false reports)',
      csaWeight:   '1 (form-and-manner) — escalates to 5 if pattern detected',
      fineRange:   '$1,270 per occurrence (form-and-manner)',
      description: 'Your log shows two non-driving activities at different '
                 + 'physical locations back-to-back, with no drive tile '
                 + 'between them. Real-world drivers must drive between a '
                 + 'shipper\'s dock and a yard, between a fuel stop and a '
                 + 'truck stop — the truck cannot teleport. A log that '
                 + 'omits these transitions is incomplete under §395.8 '
                 + '(record of duty status must show every change in duty '
                 + 'status). DOT inspectors who notice the pattern can flag '
                 + 'the log as form-and-manner; multiple instances suggest '
                 + 'falsification.',
      fix:         'Add a short driving tile between the two activities. '
                 + 'Even a 15–30 minute drive from the dock to a nearby '
                 + 'yard or truck stop is a real on-duty driving event '
                 + 'that must appear on the log.',
    },
    [ST.SEQ_FALSIFIED_PATTERN]: {
      code:        'SEQ-08',
      title:       'Falsification pattern: multiple missing drive transitions',
      regulation:  '49 CFR §395.8(e); §390.35 (false records prohibited)',
      csaWeight:   '7 (log falsification — high CSA point value)',
      fineRange:   '$1,270–$12,700 per violation, plus driver disqualification risk',
      description: 'Your log contains multiple missing drive transitions. '
                 + 'A single missed drive is a form-and-manner issue; a '
                 + 'pattern of them indicates systematic log falsification '
                 + 'under §395.8(e). DOT inspectors specifically look for '
                 + 'this pattern as evidence the driver is not maintaining '
                 + 'an accurate record of duty status. This is a major CSA '
                 + 'event — high point value, federal fines, and potential '
                 + 'driver-out-of-service if the inspector concludes the '
                 + 'log is willfully falsified rather than carelessly '
                 + 'incomplete.',
      fix:         'Review every transition between non-driving activities '
                 + 'in your log. Wherever you went from one physical '
                 + 'location to another, there must be a drive tile '
                 + 'showing how you got there.',
    },
    [ST.SEQ_ABANDONED_FILING]: {
      code:        'SEQ-09',
      title:       'Driver abandoned logbook without filing',
      regulation:  '49 CFR §395.8(g); §395.8(a)(1)(i)',
      csaWeight:   '5 (log falsification / missing log)',
      fineRange:   '$1,270 per day of non-compliance',
      description: 'The driver opened the HOS logbook for this shift but '
                 + 'closed it without filing a completed record. Under '
                 + '§395.8(g), every driver must certify their record of '
                 + 'duty status by signing it at the end of each 24-hour '
                 + 'period. A missing daily log is itself a major form-'
                 + 'and-manner violation and a red flag in any DOT audit '
                 + 'of the preceding seven days. An inspector who pulls '
                 + 'the prior week\'s logs and finds a missing day will '
                 + 'treat the entire week with elevated scrutiny.',
      fix:         'Open the HOS logbook BEFORE you start your shift, '
                 + 'place every duty-status tile as the day unfolds, and '
                 + 'tap "FILE LOGBOOK" before going off duty. If you must '
                 + 'leave the puzzle mid-day, your dispatcher can auto-'
                 + 'file a partial log, but a self-filed log is always '
                 + 'cleaner.',
    },
  };
  return table[code] || {
    code, title: code,
    regulation:  'Unknown',
    csaWeight:   'Unknown',
    fineRange:   'Unknown',
    description: 'Sequence violation.',
    fix:         'Review the sequence of placed cards.',
  };
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API EXPORTS
// ─────────────────────────────────────────────────────────────────

export {
  // Core validated functions
  validateSchedule,
  getRemainingHours,
  checkWeeklyLimit,
  canDrive,
  buildDayTimeline,
  getViolationDetails,
  checkFormAndManner,
  getFormFlagDetails,
  checkSequenceCompliance,
  getSequenceViolationDetails,

  // Constants (consumed by HOSPuzzle.jsx for UI)
  TYPE,
  VT,
  FT,
  ST,
  SEV,
  R,
};

export default {
  validateSchedule,
  getRemainingHours,
  checkWeeklyLimit,
  canDrive,
  buildDayTimeline,
  getViolationDetails,
  checkFormAndManner,
  getFormFlagDetails,
  checkSequenceCompliance,
  getSequenceViolationDetails,
  TYPE,
  VT,
  FT,
  ST,
  SEV,
  R,
};
