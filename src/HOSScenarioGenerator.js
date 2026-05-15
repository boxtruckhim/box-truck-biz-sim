/**
 * HOSScenarioGenerator.js
 * Dynamic HOS scenario builder — Batch 4f-1
 *
 * Consumes the player's actual day (dispatched loads, fuel purchases,
 * detention events, weather, truck state, level) and produces a scenario
 * object compatible with HOSPuzzle. Used for the End-Day HOS filing flow,
 * where the log must reflect the actual activities of the day.
 *
 * This is the opposite of the 6 canned scenarios in HOSScenarios.js —
 * those are for practice-mode learning. Real delivery-flow filing uses
 * THIS generator so the log matches reality.
 *
 * API:
 *
 *   generateDynamicScenario(ctx) → scenario
 *
 *     ctx = {
 *       currentDay:        number,       // in-game day
 *       level:             number,       // player level (controls decoy count)
 *       truck:             object,       // the truck whose log is being filed
 *       loadsForDay:       array,        // loads dispatched/delivered today
 *       fuelPurchases:     array,        // [{location, timeMinute}]
 *       detentionEvents:   array,        // [{location, durationMinutes, timeMinute}]
 *       weatherState:      string,       // 'clear', 'rain', 'snow', 'storm'
 *       priorShiftEnd:     number|null,  // minute-of-day when yesterday's shift
 *                                        // ended (used for 10h rest anchor)
 *       weeklyHoursUsed:   number,       // from truck.hosDaysOnDuty cycle
 *       weeklyPolicy:      string,       // '60/7' or '70/8'
 *     }
 *
 *     Returns scenario with:
 *       id, title, briefing, hand, canonicalSolution, validationOptions,
 *       scoring, _dynamic: true (marker for HOSPuzzle to skip selector).
 *
 * Regulation grounding (this tile data IS the log):
 *   - §395.8(a) — RODS must show time at each duty status change
 *   - §395.8(e) — Location at each change of duty status
 *   - §395.8(f)(5) — Total mileage for the day
 *   - §395.8(f)(7) — Shipping document numbers / commodity reference
 *   - §395.3(a)(3)(ii) — 30-min break after 8h driving
 *   - §395.3(a)(1)(2) — 11h/14h core limits
 *
 * Box Truck Boss · Phase 4f-1
 */

'use strict';

import { TYPE } from './HOSRuleEngine.js';
import { CARD_TEMPLATES } from './HOSScenarios.js';

// ─────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────

const DEFAULT_MPH               = 55;    // avg fleet speed for box trucks on mixed routes
const MPH_BAD_WEATHER           = 45;    // rain/snow slows the average
const MPH_URBAN_LAST_MILE       = 40;    // <50mi legs often include city traffic
const MIN_DRIVE_MINUTES         = 15;    // never generate a drive tile <15 min

// Batch 4f-1 hotfix: maximum single drive tile duration.
// 49 CFR §395.3(a)(3)(ii) requires a 30-min break after 8h cumulative
// driving. Any single drive block longer than 8h is physically impossible
// on a compliant log. We cap each drive TILE at 7h 50m so the player has
// room to place a mandatory-break card BEFORE the 8h trigger fires.
//
// Real-world drivers also naturally log multiple drive entries even on
// long-haul days — fuel stops, meal breaks, natural rest pauses all cause
// duty-status changes that split the drive into chunks on the real ELD.
const MAX_SINGLE_DRIVE_MIN      = 470;   // 7h 50m — safety margin under 8h trigger

const DEFAULT_PRETRIP_MINUTES   = 30;
const DEFAULT_POSTTRIP_MINUTES  = 30;
const DEFAULT_REST_MINUTES      = 600;   // 10h minimum
const DEFAULT_FUEL_MINUTES      = 20;    // fuel purchase off-duty

// Pallet-count / facility-type → load/unload duration
// Based on real operational data: warehouse dock with dock-doors = fast;
// curbside/liftgate delivery = slow.
const LOAD_DUR_SMALL   = 20;   // ≤4 pallets at dock: 20 min
const LOAD_DUR_MEDIUM  = 45;   // 5-15 pallets at dock: 45 min
const LOAD_DUR_LARGE   = 75;   // 16+ pallets, or liftgate, or warehouse-style: 75 min

// Level → decoy tile count (per Batch 4f Q3 user pick)
// L1-5: labeled + no decoys
// L6-15: strict match + 1 decoy
// L16-30: strict match + 2-3 decoys + unlabeled
// L31+: strict match + up to 4 decoys + timer
function decoyCountForLevel(level) {
  if (level == null) return 0;
  if (level <= 5)  return 0;
  if (level <= 15) return 1;
  if (level <= 30) return 2 + (Math.random() < 0.5 ? 1 : 0);  // 2 or 3
  return 3 + (Math.random() < 0.5 ? 1 : 0);                   // 3 or 4
}

function isVeteranLevel(level) { return (level || 0) >= 31; }

// L16+ → optionally hide city labels (unlabeled generic "shipper" text)
function shouldUseGenericLabels(level) {
  return (level || 0) >= 16 && Math.random() < 0.5;
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function asLabel(city) {
  if (!city) return 'Terminal';
  if (typeof city === 'string') return city;
  // Load origin/destination objects typically have {name, state}
  if (city.name && city.state) return `${city.name}, ${city.state}`;
  if (city.name) return city.name;
  return 'Terminal';
}

/**
 * Derive drive duration in minutes from miles + weather + route character.
 * Urban last-mile legs (<50 mi) use a lower MPH to reflect traffic.
 * Bad weather knocks another 10mph off the average.
 */
function minutesForMiles(miles, weatherState) {
  if (!miles || miles <= 0) return MIN_DRIVE_MINUTES;
  let mph = DEFAULT_MPH;
  if (miles < 50)                 mph = MPH_URBAN_LAST_MILE;
  if (weatherState === 'rain')    mph = Math.max(mph - 5, 35);
  if (weatherState === 'snow' ||
      weatherState === 'storm')   mph = Math.max(mph - 10, 30);
  const minutes = Math.max(MIN_DRIVE_MINUTES, Math.round(miles / mph * 60));
  return minutes;
}

/**
 * Batch 4f-1 hotfix: split a drive duration into 2-4 tiles when long.
 *
 * Returns an array of per-segment durations (in minutes) that collectively
 * equal the input total minutes (± rounding). Each segment is capped at
 * MAX_SINGLE_DRIVE_MIN (7h 50m) so no single tile ever exceeds the 8-hour
 * cumulative-driving break trigger.
 *
 * Rationale: the user asked for "drive time split into 2-4 tiles" to allow
 * intermediate pickup/delivery/fuel/break tiles between drive segments.
 * This also matches real ELD behavior — a driver's log never shows 8+
 * continuous hours of driving, even on long-haul days.
 *
 * Sizing ladder:
 *    ≤  240 min (4h)        → 1 tile (no split — short local run)
 *    241-420 min (4-7h)     → 2 tiles
 *    421-700 min (7-11.7h)  → 3 tiles
 *      > 700 min            → 4 tiles (with mandatory break auto-required)
 *
 * All tiles are clamped to MAX_SINGLE_DRIVE_MIN as a hard cap.
 *
 * @param {number} totalMinutes
 * @returns {Array<number>} segment durations that sum to ~totalMinutes
 */
function planDriveSegments(totalMinutes) {
  const total = Math.max(MIN_DRIVE_MINUTES, Math.round(totalMinutes));
  if (total <= 240) return [total];                              // 1 tile
  let n;
  if (total <= 420)      n = 2;
  else if (total <= 700) n = 3;
  else                   n = 4;

  // Equal-split the duration across n segments, each capped at the hard limit.
  const base = Math.floor(total / n);
  const remainder = total - (base * n);
  const segments = Array(n).fill(base);
  // Distribute remainder minutes to the first segments (evens out rounding)
  for (let i = 0; i < remainder; i++) segments[i] += 1;
  // Apply the MAX cap — if any segment exceeds, spill into the next one
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] > MAX_SINGLE_DRIVE_MIN) {
      const spill = segments[i] - MAX_SINGLE_DRIVE_MIN;
      segments[i] = MAX_SINGLE_DRIVE_MIN;
      segments[i + 1] += spill;
    }
  }
  // Final segment also capped — if it's over, expand to N+1 segments
  if (segments[segments.length - 1] > MAX_SINGLE_DRIVE_MIN) {
    const spill = segments[segments.length - 1] - MAX_SINGLE_DRIVE_MIN;
    segments[segments.length - 1] = MAX_SINGLE_DRIVE_MIN;
    segments.push(spill);
  }
  return segments.map(m => Math.max(MIN_DRIVE_MINUTES, m));
}

/**
 * Load/unload duration from pallet count + facility type + liftgate flag.
 */
function minutesForPickup(load) {
  const pallets         = load.pallets || 0;
  const liftgateRequired = !!load.liftgateRequired;
  const facility        = load.facilityType || '';
  // Liftgate or any warehouse-style facility bumps duration
  if (liftgateRequired || facility === 'warehouse' || pallets >= 16) return LOAD_DUR_LARGE;
  if (pallets >= 5)                                                   return LOAD_DUR_MEDIUM;
  return LOAD_DUR_SMALL;
}

function minutesForDelivery(load) {
  // Unloading is typically slightly longer than loading — receivers are
  // pickier about checking in, signing DVIR, etc.
  return minutesForPickup(load) + 10;
}

/**
 * Build a hand-card specification with custom label and duration.
 * Returns the minimum object required by HOSPuzzle's buildHandFromScenario.
 */
function card(templateId, opts = {}) {
  return {
    templateId,
    required:        opts.required !== false,
    durationMinutes: opts.durationMinutes,
    label:           opts.label,
    instanceNo:      opts.instanceNo || 1,
  };
}

/**
 * Build a canonical-solution step — matches the structure in HOSScenarios.js.
 */
function step(templateId, startMin, durMin, extras = {}) {
  return {
    templateId,
    startMinute:     startMin,
    durationMinutes: durMin,
    ...extras,
  };
}

/**
 * Batch 4f-1 hotfix: emit 1-4 drive tiles for a single drive segment,
 * respecting the 8-hour cap. Returns the new timeCursor position.
 *
 * Mutates the passed-in `hand` and `canonicalSolution` arrays in place —
 * same pattern the main generator loop uses for all other tile emissions.
 *
 * For short legs (≤4h) this is identical to the old single-tile emission.
 * For longer legs, it emits N=2-4 tiles each labeled "Drive leg X of N"
 * so the player can see the sequence, and each capped at 7h 50m.
 *
 * @param {object} ctx - {
 *     miles, startCursor, origin, destination, currentLocation,
 *     weatherState, useGenericLabels, driveType (optional),
 *     hand, canonicalSolution, isDeadhead (optional)
 *   }
 * @returns {number} new timeCursor position
 */
function emitDriveSegments(ctx) {
  const {
    miles, startCursor, origin, destination, currentLocation,
    weatherState, useGenericLabels,
    hand, canonicalSolution,
    driveType,          // optional override (driveShort / driveLong / driveFinal)
    isDeadhead = false,
  } = ctx;

  const totalMin = minutesForMiles(miles, weatherState);
  const segments = planDriveSegments(totalMin);
  const n = segments.length;

  // Default driveType: short for <100mi single-leg, long otherwise.
  // Multi-segment long drives all use driveLong for consistency.
  const effectiveDriveType = driveType
    || (n > 1 ? 'driveLong' : (miles >= 100 ? 'driveLong' : 'driveShort'));

  let cursor = startCursor;

  for (let i = 0; i < n; i++) {
    const segMin = segments[i];
    const legPrefix = n > 1 ? `Drive leg ${i + 1}/${n}` : 'Drive';
    const label = useGenericLabels
      ? (isDeadhead
          ? `${legPrefix} (deadhead, ${Math.round(miles / n)} mi)`
          : `${legPrefix} (${Math.round(miles / n)} mi)`)
      : (isDeadhead
          ? (n > 1
              ? `${legPrefix} ${currentLocation} → ${destination} (deadhead, ${Math.round(miles / n)} mi)`
              : `Drive ${currentLocation} → ${destination} (deadhead ${miles} mi)`)
          : (n > 1
              ? `${legPrefix} toward ${destination} (${Math.round(miles / n)} mi)`
              : `Drive ${origin || currentLocation} → ${destination} (${miles} mi)`));

    hand.push(card(effectiveDriveType, {
      required:        true,
      durationMinutes: segMin,
      label,
      instanceNo:      hand.filter(h => h.templateId === effectiveDriveType).length + 1,
    }));
    canonicalSolution.push(step(effectiveDriveType, cursor, segMin, {
      locationLabel: label,
    }));
    cursor += segMin;
  }

  return cursor;
}

// ─────────────────────────────────────────────────────────────────────
// DECOY TILE GENERATION
// Level-scaled tempting wrong-choices that test discernment.
// ─────────────────────────────────────────────────────────────────────

/**
 * Pool of tempting decoy cards to sample from. Each describes a card
 * that would be WRONG to place in most scenarios — the player should
 * resist using it. Match tests the player's understanding.
 */
const DECOY_POOL = [
  // Personal conveyance — tempting because it looks free, but PC abuse
  // is a major violation (drivers can't use PC to move loaded toward a
  // shipper, can't PC to extend a shift).
  { templateId: 'personalConveyance',
    label: 'PC: drive home from dock (loaded?)',
    durationMinutes: 30 },

  { templateId: 'personalConveyance',
    label: 'PC: drive to next load pickup',
    durationMinutes: 45 },

  // Extra break that isn't needed
  { templateId: 'mandatoryBreak',
    label: 'Extra coffee break',
    durationMinutes: 30,
    instanceNo: 9 },   // high instanceNo keeps it distinct from required break

  // Fuel stop that wasn't actually taken today
  { templateId: 'fuelStop',
    label: 'Bonus fuel stop (none purchased)',
    durationMinutes: 20,
    instanceNo: 9 },
];

function pickDecoyTiles(count) {
  if (count <= 0) return [];
  const pool = [...DECOY_POOL];
  const out = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const spec = pool.splice(idx, 1)[0];
    out.push(card(spec.templateId, {
      required:        false,
      durationMinutes: spec.durationMinutes,
      label:           spec.label,
      instanceNo:      spec.instanceNo || i + 2,
    }));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// DAY-BOUNDARY SLICING
// When a load spans two days (pickup Day 5, deliver Day 6), each day's
// log gets only the activities that occurred on that day.
// ─────────────────────────────────────────────────────────────────────

/**
 * Split a list of loads into activity portions by game-day.
 *
 * Each load has:
 *   dispatchedOnDay   - day the load was dispatched
 *   deliveredOnDay    - day the load was actually delivered (may differ)
 *   pickupTimeMinute  - minute-of-day when pickup completed
 *   deliveryTimeMinute - minute-of-day when delivery completed
 *   overnightRestDay  - if multi-day, which day held the 10h rest midway
 *
 * For a `forDay = N` log, we include:
 *   - Pickup: only if dispatchedOnDay === N
 *   - Delivery: only if deliveredOnDay === N
 *   - Drive: only the portion whose time-in-day is on day N
 *
 * Simplification for Batch 4f-1: loads that start AND end on the same
 * day are fully included in that day's log. Multi-day loads contribute
 * only the pickup + first leg on dispatched day, and delivery + last
 * leg on delivered day (the overnight sleeper berth is implicit and
 * auto-generated as a rest tile on both days).
 */
function partitionLoadsByDay(loadsForDay, forDay) {
  const result = {
    pickupLoads:    [],
    deliveryLoads:  [],
    throughLoads:   [],   // loads where BOTH pickup and delivery are on this day
    carryoverLoads: [],   // loads dispatched a prior day, delivered today
  };
  for (const load of (loadsForDay || [])) {
    if (!load) continue;
    const dispatched = load.dispatchedOnDay;
    const delivered  = load.deliveredOnDay;
    if (dispatched === forDay && delivered === forDay) {
      result.throughLoads.push(load);
      result.pickupLoads.push(load);
      result.deliveryLoads.push(load);
    } else if (dispatched === forDay && delivered !== forDay) {
      // Pickup today, delivery tomorrow (or later)
      result.pickupLoads.push(load);
    } else if (delivered === forDay && dispatched !== forDay) {
      // Dispatched earlier, delivered today
      result.deliveryLoads.push(load);
      result.carryoverLoads.push(load);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// MAIN GENERATOR
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a scenario from the day's actual activity.
 *
 * @param {object} ctx - see file header for shape
 * @returns {object}   - scenario compatible with HOSPuzzle
 */
export function generateDynamicScenario(ctx) {
  const {
    currentDay    = 1,
    level         = 1,
    truck         = {},
    loadsForDay   = [],
    fuelPurchases = [],
    detentionEvents = [],
    weatherState  = 'clear',
    priorShiftEnd = null,
    weeklyHoursUsed = 0,
    weeklyPolicy  = '70/8',
  } = ctx || {};

  // Partition loads by their role on this specific day
  const parts = partitionLoadsByDay(loadsForDay, currentDay);

  // If literally no activity at all today, the log is a full off-duty day.
  // This skips normal puzzle generation entirely — caller should handle this.
  const hasAnyActivity =
    parts.pickupLoads.length   > 0 ||
    parts.deliveryLoads.length > 0 ||
    parts.carryoverLoads.length > 0;

  if (!hasAnyActivity) {
    return generateOffDutyDayScenario({ currentDay, level, truck, weeklyPolicy });
  }

  // Shift anchor: 7:00 AM default, unless prior rest ended later
  const anchorMinute = priorShiftEnd != null && priorShiftEnd >= 0
    ? Math.min(Math.max(priorShiftEnd, 300), 540)    // clamp 5am-9am
    : 420;                                            // default 7 AM

  // Starting location
  const startCity = asLabel(truck.location || truck.homeTerminal || 'Home terminal');

  // ─── Build the hand (the cards the player will place) ───────────────
  const hand = [];
  const canonicalSolution = [];
  const useGenericLabels = shouldUseGenericLabels(level);

  // Pre-trip (always first)
  hand.push(card('preTrip',  { required: true, label: `Pre-trip at ${startCity}` }));
  canonicalSolution.push(step('preTrip', anchorMinute, DEFAULT_PRETRIP_MINUTES, {
    locationLabel: startCity,
  }));

  // Build chronological chain of work tiles
  let timeCursor = anchorMinute + DEFAULT_PRETRIP_MINUTES;
  let currentLocation = startCity;

  // Each "operation" is either carryover-delivery, pickup-drive-delivery,
  // or just a pickup (when load delivers tomorrow).
  // We process in the order the loads will actually execute today.
  //
  // Simplification: the player's loads for a day are assumed to execute
  // in the order they were dispatched. In reality this matches how
  // App.jsx batches dispatches — one after another per truck.

  // 1. Carryover deliveries first (yesterday's pickups, delivered today)
  //    These typically start with a short drive from the overnight rest
  //    location to the receiver, then the delivery.
  for (let i = 0; i < parts.carryoverLoads.length; i++) {
    const load = parts.carryoverLoads[i];
    const origin      = asLabel(load.origin);
    const destination = asLabel(load.destination);
    const legMiles    = Math.min(load.miles || 0, 300);   // cap at ~5h for a single leg
    const unloadMin   = minutesForDelivery(load);

    // Drive to receiver (carryover) — emits 1+ tiles capped at 8h each
    timeCursor = emitDriveSegments({
      miles: legMiles, startCursor: timeCursor,
      origin, destination, currentLocation,
      weatherState, useGenericLabels,
      hand, canonicalSolution,
    });
    currentLocation = destination;

    // Deliver
    const deliveryLabel = useGenericLabels
      ? `Unload (${load.pallets || 0} plt, ${load.commodity || 'cargo'})`
      : `Unload at ${destination} (${load.pallets || 0} plt${load.liftgateRequired ? ', liftgate' : ''})`;
    hand.push(card('unloadCargo', {
      required:        true,
      durationMinutes: unloadMin,
      label:           deliveryLabel,
      instanceNo:      hand.filter(h => h.templateId === 'unloadCargo').length + 1,
    }));
    canonicalSolution.push(step('unloadCargo', timeCursor, unloadMin, {
      locationLabel: deliveryLabel,
    }));
    timeCursor += unloadMin;
  }

  // 2. Same-day through-loads and today's new pickups
  //    Pickup → drive → delivery (if through) OR pickup → drive (if overnight)
  for (let i = 0; i < parts.pickupLoads.length; i++) {
    const load = parts.pickupLoads[i];
    if (parts.carryoverLoads.includes(load)) continue;  // already handled
    const origin      = asLabel(load.origin);
    const destination = asLabel(load.destination);
    const loadMin     = minutesForPickup(load);
    const deliverMin  = minutesForDelivery(load);

    // If truck is not at origin, there's a deadhead leg first
    const needsDeadhead = currentLocation !== origin;
    const deadheadMiles = needsDeadhead
      ? Math.max(0, load.deadheadOrigin || 0)
      : 0;

    if (needsDeadhead && deadheadMiles > 0) {
      // Deadhead drive — uses driveShort type by convention, but still
      // capped at 8h per tile via the auto-split logic
      timeCursor = emitDriveSegments({
        miles: deadheadMiles, startCursor: timeCursor,
        origin, destination: origin, currentLocation,
        weatherState, useGenericLabels,
        hand, canonicalSolution,
        driveType: 'driveShort',
        isDeadhead: true,
      });
      currentLocation = origin;
    }

    // Pickup (loadCargo)
    const pickupLabel = useGenericLabels
      ? `Load (${load.pallets || 0} plt, ${load.commodity || 'cargo'})`
      : `Load at ${origin} (${load.pallets || 0} plt, ${load.commodity || 'cargo'})`;
    hand.push(card('loadCargo', {
      required:        true,
      durationMinutes: loadMin,
      label:           pickupLabel,
      instanceNo:      hand.filter(h => h.templateId === 'loadCargo').length + 1,
    }));
    canonicalSolution.push(step('loadCargo', timeCursor, loadMin, {
      locationLabel: pickupLabel,
    }));
    timeCursor += loadMin;

    // Is this a through-load (delivered today) or overnight (delivered tomorrow)?
    const throughToday = parts.throughLoads.includes(load);

    if (throughToday) {
      // Drive to destination — split into 1-4 tiles, each capped at 8h
      const miles = Math.max(0, load.miles || 0);
      timeCursor = emitDriveSegments({
        miles, startCursor: timeCursor,
        origin, destination, currentLocation,
        weatherState, useGenericLabels,
        hand, canonicalSolution,
      });
      currentLocation = destination;

      // Deliver
      const deliveryLabel = useGenericLabels
        ? `Unload (${load.pallets || 0} plt)`
        : `Unload at ${destination} (${load.pallets || 0} plt)`;
      hand.push(card('unloadCargo', {
        required:        true,
        durationMinutes: deliverMin,
        label:           deliveryLabel,
        instanceNo:      hand.filter(h => h.templateId === 'unloadCargo').length + 1,
      }));
      canonicalSolution.push(step('unloadCargo', timeCursor, deliverMin, {
        locationLabel: deliveryLabel,
      }));
      timeCursor += deliverMin;
    } else {
      // Overnight load — drive partway toward destination. Use half the miles.
      // Still emits multiple tiles if that partial exceeds 8h.
      const partialMiles = Math.round((load.miles || 0) * 0.5);
      timeCursor = emitDriveSegments({
        miles: partialMiles, startCursor: timeCursor,
        origin, destination, currentLocation,
        weatherState, useGenericLabels,
        hand, canonicalSolution,
      });
      currentLocation = 'En route';
    }
  }

  // 3. Fuel stops (actual purchases today)
  for (let i = 0; i < fuelPurchases.length; i++) {
    const fs = fuelPurchases[i];
    const fsLoc = asLabel(fs.location || currentLocation);
    hand.push(card('fuelStop', {
      required:        true,
      durationMinutes: DEFAULT_FUEL_MINUTES,
      label:           useGenericLabels ? 'Fuel stop' : `Fuel at ${fsLoc}`,
      instanceNo:      hand.filter(h => h.templateId === 'fuelStop').length + 1,
    }));
    // Add to canonical in approximate midday position — caller can reorder
    canonicalSolution.push(step('fuelStop', timeCursor, DEFAULT_FUEL_MINUTES, {
      locationLabel: useGenericLabels ? 'Fuel stop' : `Fuel at ${fsLoc}`,
    }));
    timeCursor += DEFAULT_FUEL_MINUTES;
  }

  // 4. Detention events (if any happened today)
  for (let i = 0; i < detentionEvents.length; i++) {
    const d = detentionEvents[i];
    const dLoc  = asLabel(d.location || currentLocation);
    const dMin  = d.durationMinutes || 120;
    hand.push(card('detention', {
      required:        true,
      durationMinutes: dMin,
      label:           useGenericLabels ? 'Detention at dock' : `Detention at ${dLoc}`,
      instanceNo:      hand.filter(h => h.templateId === 'detention').length + 1,
    }));
    canonicalSolution.push(step('detention', timeCursor, dMin, {
      locationLabel: useGenericLabels ? 'Detention at dock' : `Detention at ${dLoc}`,
    }));
    timeCursor += dMin;
  }

  // 5. 30-min break — required if total driving exceeds 8h (480 min).
  //    Batch 4f-1 hotfix: insert the break into canonicalSolution at the
  //    7-hour cumulative-driving mark (proactive placement — canonical
  //    pattern per the canned scenarios). Without this, a long-haul
  //    canonical solution would produce a BREAK_REQUIRED HOS violation
  //    when played straight, because the break would only be appended
  //    at the end rather than placed between drive segments.
  const totalDrivingMin = canonicalSolution
    .filter(s => {
      const t = CARD_TEMPLATES[s.templateId];
      return t && t.type === TYPE.DRIVING;
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  if (totalDrivingMin > 480 - 60) {  // also require break if close to threshold
    // Add to hand (player must place it)
    hand.push(card('mandatoryBreak', {
      required:        true,
      durationMinutes: 30,
      label:           'Required 30-min break',
    }));

    // Insert into canonicalSolution at the 7h (420 min) cumulative-driving
    // mark. Walk canonicalSolution in order, track cumulative driving
    // duration, and splice in the mandatoryBreak right before the drive
    // segment that would push cumulative past 420 min. All subsequent
    // entries (including postTrip + closing rest, if they exist) get
    // their startMinute shifted by +30 to account for the inserted break.
    const BREAK_THRESHOLD_MIN = 420;   // proactive: place break BEFORE 8h limit
    const BREAK_DURATION      = 30;
    let cumulativeDriving     = 0;
    let insertIdx             = -1;
    let insertAtMinute        = 0;

    for (let i = 0; i < canonicalSolution.length; i++) {
      const s = canonicalSolution[i];
      const t = CARD_TEMPLATES[s.templateId];
      if (t && t.type === TYPE.DRIVING) {
        // If adding this segment would push cumulative past 420, the break
        // must go BEFORE it. Insert at position i; break starts at s.startMinute.
        if (cumulativeDriving + s.durationMinutes > BREAK_THRESHOLD_MIN) {
          insertIdx      = i;
          insertAtMinute = s.startMinute;
          break;
        }
        cumulativeDriving += s.durationMinutes;
      }
    }

    if (insertIdx >= 0) {
      const breakStep = step('mandatoryBreak', insertAtMinute, BREAK_DURATION, {
        locationLabel: 'Required 30-min break',
      });
      // Splice in the break and shift all subsequent entries by +30 min
      canonicalSolution.splice(insertIdx, 0, breakStep);
      for (let j = insertIdx + 1; j < canonicalSolution.length; j++) {
        canonicalSolution[j].startMinute += BREAK_DURATION;
      }
      // timeCursor tracked the end-of-last-placement minute; advance it too
      timeCursor += BREAK_DURATION;
    }
  }

  // 6. Post-trip (always second-to-last)
  const endLoc = currentLocation === 'En route'
    ? asLabel(truck.homeTerminal || 'Home terminal')
    : currentLocation;
  hand.push(card('postTrip', { required: true, label: `Post-trip at ${endLoc}` }));
  canonicalSolution.push(step('postTrip', timeCursor, DEFAULT_POSTTRIP_MINUTES, {
    locationLabel: endLoc,
  }));
  timeCursor += DEFAULT_POSTTRIP_MINUTES;

  // 7. Closing rest (always last — satisfies SEQ_MISSING_CLOSING_REST rule)
  const restMin = DEFAULT_REST_MINUTES;
  hand.push(card('restPeriod10h', { required: true, label: `10-hour rest at ${endLoc}` }));
  canonicalSolution.push(step('restPeriod10h', timeCursor, restMin, {
    locationLabel: `10-hour rest at ${endLoc}`,
  }));

  // 7b. Optional flexible drive cards — give the player freedom to add
  // drive time anywhere their actual day required it. Real drives often
  // include short legs the prescriptive cards don't model: parking-spot
  // to shipper dock, off-ramp to truck stop, around-the-block to a
  // different loading bay. These cards are required:false so the player
  // is free to place 0, 1, or 2 of them. They aren't in canonicalSolution
  // (placing or skipping them doesn't break canonical-match scoring as
  // long as it stays within the start-time tolerance window).
  hand.push(card('driveExtra', { required: false, instanceNo: 1 }));
  hand.push(card('driveExtra', { required: false, instanceNo: 2 }));

  // 8. Decoy tiles (level-scaled)
  const decoys = pickDecoyTiles(decoyCountForLevel(level));
  for (const d of decoys) hand.push(d);

  // ─── Build the briefing ─────────────────────────────────────────────
  const totalMilesToday = (loadsForDay || [])
    .reduce((s, l) => s + (l.miles || 0), 0);
  const pickupCount    = parts.pickupLoads.length;
  const deliveryCount  = parts.deliveryLoads.length;
  const carryoverCount = parts.carryoverLoads.length;

  const briefing = {
    runData: {
      originCity:       startCity,
      destCity:         endLoc,
      distanceMiles:    totalMilesToday,
      estimatedDriveHours: Math.round(totalDrivingMin / 60 * 10) / 10,
      pickupWindow:     '—',
      deliveryDeadline: '—',
    },
    priorWeek: {
      hoursUsed:     weeklyHoursUsed,
      policy:        weeklyPolicy,
      last34Restart: null,
    },
    truckInfo: {
      hasSleeperBerth: !!truck.hasSleeperBerth,
      vehicleType:     truck.vehicleType || 'Non-CDL 26ft box truck',
      truckId:         truck.id || null,
      // Batch 4f-2: odometer audit trail. Prefer the precise values from
      // App.jsx's buildDynamicHOSContext (computed via getRouteInfo so the
      // end reading matches the truck's actual physical advance). Fall back
      // to mileage + totalMilesToday if ctx didn't supply them (e.g., older
      // scaffolding paths or tests that bypass buildDynamicHOSContext).
      odometerStart:   typeof truck.odometerStart === 'number'
                         ? truck.odometerStart
                         : (truck.mileage || 0),
      odometerEnd:     typeof truck.odometerEnd === 'number'
                         ? truck.odometerEnd
                         : (truck.mileage || 0) + totalMilesToday,
    },
    daySummary: {
      pickupCount, deliveryCount, carryoverCount,
      totalMilesToday,
      fuelStops:      fuelPurchases.length,
      detentionCount: detentionEvents.length,
      weatherState,
      weeklyContext:
        weeklyHoursUsed > 55
          ? `You are at ${weeklyHoursUsed}h of ${weeklyPolicy.split('/')[0]}h weekly limit — close to restart territory.`
          : (weeklyHoursUsed > 40
              ? `You are at ${weeklyHoursUsed}h weekly.`
              : `Weekly cycle healthy (${weeklyHoursUsed}h used).`),
    },
    teachingPoints: [
      'This log reflects your actual day — the pickups, deliveries, and drives you ran.',
      'Tile counts must match reality: a log with fewer pickups than you actually ran is a falsification flag.',
      'Post-trip closes the day; 10-hour rest starts the clock for tomorrow. Always place those last two tiles in that order.',
    ],
  };

  // ─── Assemble the scenario ──────────────────────────────────────────
  const scenarioId = `dynamic_day_${currentDay}_truck_${truck.id || 'X'}`;
  return {
    id:       scenarioId,
    title:    `Day ${currentDay} Logbook · Truck #${truck.id || ''}`,
    _dynamic: true,
    briefing,
    hand,
    canonicalSolution,
    validationOptions: {
      weeklyPolicy,
      // Short-haul only applies if the entire day is within 150 air-mile
      // radius of home terminal. Most game-generated days exceed this.
      shortHaulClaimed: false,
    },
    scoring: {
      orderMustMatch:     true,
      startTimeTolerance: 60,   // looser tolerance for dynamic scenarios
      perfectBonus:       50 + (isVeteranLevel(level) ? 100 : 0),
    },
    learningMoments: [
      { title: 'Log matches reality',
        text:  'Every pickup/delivery/drive tile on your log corresponds to '
             + 'an actual event in your dispatch record. Inspectors cross-reference '
             + 'ELD-recorded GPS breadcrumbs with your logged duty changes — '
             + 'discrepancies between the two are the #1 falsification indicator.' },
      { title: 'Your day, your log',
        text:  `Today you handled ${pickupCount} pickup${pickupCount !== 1 ? 's' : ''}, `
             + `${deliveryCount} delivery${deliveryCount !== 1 ? 'ies' : ''}, `
             + `and drove ${totalMilesToday} miles. `
             + 'The log has tiles for each of those — placing them in the right order '
             + 'tells the honest story of your shift.' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────
// OFF-DUTY DAY (no activity)
// ─────────────────────────────────────────────────────────────────────

/**
 * Generate a "pure off-duty" scenario for days where the player didn't
 * dispatch any loads personally (but still needs a log entry).
 */
export function generateOffDutyDayScenario({ currentDay, level = 1, truck = {}, weeklyPolicy = '70/8' } = {}) {
  const loc = asLabel(truck.location || truck.homeTerminal || 'Home terminal');
  return {
    id:       `dynamic_offduty_day_${currentDay}_truck_${truck.id || 'X'}`,
    title:    `Day ${currentDay} Logbook · Off Duty`,
    _dynamic: true,
    _offDuty: true,
    briefing: {
      runData: {
        originCity: loc, destCity: loc,
        distanceMiles: 0, estimatedDriveHours: 0,
        pickupWindow: '—', deliveryDeadline: '—',
      },
      priorWeek: { hoursUsed: 0, policy: weeklyPolicy, last34Restart: null },
      truckInfo: { hasSleeperBerth: false, vehicleType: 'Non-CDL 26ft box truck', truckId: truck.id || null },
      daySummary: {
        pickupCount: 0, deliveryCount: 0, carryoverCount: 0,
        totalMilesToday: 0, fuelStops: 0, detentionCount: 0,
        weatherState: 'clear',
        weeklyContext: 'Off-duty day — no driving activity.',
      },
      teachingPoints: [
        'Even a 24-hour off-duty day requires a logbook entry. The log shows "24h off-duty" as continuous.',
        'Off-duty days can contribute to a 34-hour restart — useful when approaching the weekly limit.',
      ],
    },
    hand: [
      card('extendedRest', { required: true, durationMinutes: 1440,
                              label: '24-hour off-duty day' }),
    ],
    canonicalSolution: [
      step('extendedRest', 0, 1440, { locationLabel: loc }),
    ],
    validationOptions: { weeklyPolicy },
    scoring: { orderMustMatch: false, startTimeTolerance: 240, perfectBonus: 10 },
  };
}

export default {
  generateDynamicScenario,
  generateOffDutyDayScenario,
};
