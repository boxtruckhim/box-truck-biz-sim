/**
 * Act 5 — The Score That Follows You (10s) — Box Truck Boss Welcome Modal
 *
 * Following the locked v3.1 storyboard at lines 564-666. This is the cold,
 * sober, federal-document beat that contrasts with Act 4's warm intimate
 * voicemail. Plays from 0:30 to 0:40 in the full Welcome Modal cinematic.
 *
 * EMOTIONAL CONTRACT: Sobered. "There's a real consequence system."
 *
 * VISUAL ARCHITECTURE:
 * Pure SVG/HTML stylized FMCSA SMS dashboard — no photographs. Federal-document
 * tan-on-black aesthetic with IBM Plex Mono technical type. The 7 BASIC categories
 * render as horizontal percentile bars. A violation event punches Vehicle
 * Maintenance from 62 (yellow) to 87 (red, above the 80% intervention threshold).
 * Three consequence cards animate in sequentially: Insurance premium up, brokers
 * grey out, AUTHORITY AT RISK warning. The act closes with a "730 DAYS" stamp
 * landing across the dashboard with paper-impact bounce.
 *
 * COLOR GRADE:
 * Cold blue-white (federal/consequence), red (above threshold), tan/parchment
 * (federal-document), monospace gray (technical type). NO warm amber — that
 * vocabulary is reserved for Marcus moments. The contrast against Act 4's warm
 * lamp-light is the most important tonal shift in the cinematic.
 *
 * TIMING (relative to act start, 10000ms total):
 *   0       - 800ms:    Cross-dissolve in, dashboard renders, bars settle
 *   1000ms              VO line 1: "The fine? You'll pay it. That's not what hurts."
 *   2200ms              VO line 2: "One bad inspection — and your CSA score takes the hit."
 *   3800ms              VIOLATION FLASH — Vehicle Maintenance punches 62 → 87
 *   4000ms              VO line 3 + Insurance card slides in from right
 *   5500ms              VO line 4 + Broker cards grey out (3 cards, 50ms staggered)
 *   7000ms              VO line 5 + AUTHORITY AT RISK warning card
 *   8200ms              VO line 6: "And it follows you. For seven hundred and thirty days."
 *   8500ms              "730 DAYS" stamp lands (rotation, paper-impact)
 *   9000ms - 10000ms    Hold on stamped dashboard before hard cut to Act 6
 *
 * MARCUS DIALOGUE (locked v3.1):
 *   "The fine? You'll pay it. That's not what hurts."
 *   "One bad inspection — and your CSA score takes the hit."
 *   "Your insurance premium goes up."
 *   "The good brokers stop calling you back."
 *   "Keep at it — and you lose your motor carrier authority."
 *   "And it follows you. For seven hundred and thirty days."
 *
 * REGULATORY ACCURACY (verified against FMCSA SMS methodology):
 *   - 7 BASIC categories listed in correct FMCSA order
 *   - Vehicle Maintenance threshold = 80th percentile (correct)
 *   - Higher percentile = worse performance (correct)
 *   - 24-month (730-day) violation retention period (correct per SMS rules)
 *   - All three cascade consequences verified via FMCSA, Truckstop, AltLINE,
 *     Pride Transportation sources
 *
 * PROPS:
 *   companyName: string             — sanitized company name (placeholder DOT data)
 *   onComplete:  () => void         — called when act finishes (10.0s)
 *   onSkip:      () => void         — optional skip handler
 *
 * INTEGRATION:
 *   For Stage 3 production this component mounts inside WelcomeModal.jsx as the
 *   5th of 12 acts. Imports from WelcomeModalShared.jsx for stage container,
 *   cinema bars, caption, atmospherics. No external image assets — pure SVG/HTML.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';
import {
  CinematicStage,
  CinemaBars,
  CinematicCaption,
  AtmosphericLayers,
} from '../WelcomeModalShared.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// MARCUS DIALOGUE — locked from storyboard v3.1 Act 5
// Six segments tightly synchronized with the cascade animation choreography.
// ─────────────────────────────────────────────────────────────────────────────

// VOICEMAIL_SEGMENTS — Marcus dialogue across the 22-second consequence cascade.
//
// PACING (revised v1.2): All segments retimed at ~170 WPM with 400ms breath gaps
// between consecutive lines and a 600ms intro silence after the cross-dissolve
// from Act 4 completes. This matches the natural narrator cadence validated in
// Act 4 (189 WPM avg with 400-500ms gaps). Same dialogue locked from storyboard
// v3.1 — only the per-segment durations changed.
//
// The v1.1 build crammed all 51 words into 10 seconds (294 WPM avg, peaks of
// 400 WPM that no human VO can deliver) with two overlapping captions. v1.2
// extends to 22 seconds matching Act 4's 83% speech / 17% silence breakdown.
//
// All choreography events below this comment block reference these new
// timestamps — violation flash, insurance card, broker greyout, AUTHORITY
// warning, and 730 DAYS stamp all re-synchronized.
const VOICEMAIL_SEGMENTS = [
  { startMs:   600, endMs:  3780, text: "The fine? You'll pay it, but that's not what hurts." },
  { startMs:  4180, endMs:  7710, text: "One bad inspection — and your CSA score takes the hit." },
  { startMs:  8110, endMs:  9870, text: "Your insurance premium goes up." },
  { startMs: 10270, endMs: 12740, text: "The good brokers stop calling you back." },
  { startMs: 13140, endMs: 16670, text: "Keep at it — and you'll lose your MC (Motor Carrier Authority)." },
  { startMs: 17070, endMs: 20600, text: "Each violation follows you. For an entire 2 years." },
];

const ACT_DURATION_MS = 22000;

// ─────────────────────────────────────────────────────────────────────────────
// FMCSA BASIC CATEGORIES — verified against FMCSA SMS methodology
// Higher percentile = worse performance. Threshold = intervention trigger.
// Vehicle Maintenance is the category that gets hit by the violation event.
// ─────────────────────────────────────────────────────────────────────────────

const BASIC_CATEGORIES = [
  { id: 'unsafe_driving',     name: 'Unsafe Driving',                 percentile: 38, threshold: 65 },
  { id: 'crash_indicator',    name: 'Crash Indicator',                percentile: 42, threshold: 65 },
  { id: 'hos_compliance',     name: 'Hours-of-Service Compliance',    percentile: 51, threshold: 65 },
  { id: 'vehicle_maintenance', name: 'Vehicle Maintenance',           percentile: 62, threshold: 80, isViolated: true, postViolationPercentile: 87 },
  { id: 'controlled_substances', name: 'Controlled Substances/Alcohol', percentile: 18, threshold: 80 },
  { id: 'hazmat_compliance',  name: 'Hazardous Materials Compliance', percentile: 24, threshold: 80 },
  { id: 'driver_fitness',     name: 'Driver Fitness',                 percentile: 33, threshold: 80 },
];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act5TheScore = React.memo(function Act5TheScore({
  companyName = 'kid',
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('5', elapsedMs);

  // Master timer — single rAF loop with cleanup. Same pattern as Act 4.
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

  // Compute current dialogue segment. v1.2 segments don't overlap so .find() is
  // sufficient — at most one segment active at any elapsed time.
  const currentSegment = useMemo(() => {
    return VOICEMAIL_SEGMENTS.find(
      (seg) => elapsedMs >= seg.startMs && elapsedMs < seg.endMs
    ) || null;
  }, [elapsedMs]);

  // ─── ANIMATION STATE COMPUTATIONS ─────────────────────────────────────────
  // Each animation event has its own clean derivation from elapsedMs.

  // ═══════════════════════════════════════════════════════════════════════════
  // CHOREOGRAPHY TIMING CONSTANTS — v1.2
  //
  // Centralized so the entire timeline can be retuned by editing one place.
  // Each event syncs to a specific dialogue beat from VOICEMAIL_SEGMENTS above.
  // The previous v1.1 build had these scattered as magic numbers throughout
  // the file, which made the pacing fix harder than it should have been.
  // ═══════════════════════════════════════════════════════════════════════════
  const TIMING = {
    // Dashboard initial state
    dashboardEnterEnd:        600,    // 0-600ms scale 0.96 → 1.0
    barsSettleStart:          200,
    barsSettleEnd:           1500,    // bars fill to starting positions

    // Violation event — synced to end of line 2 ("CSA score takes the hit")
    violationFlashStart:     7000,
    violationFlashEnd:       7280,    // 280ms red radial pulse
    vmTransitionStart:       7000,
    vmTransitionEnd:         7700,    // 62 → 87 with punch-in scale

    // Dashboard first compression — happens after violation lands
    compress1Start:          7700,
    compress1End:            8700,    // 1.0 → 0.78 scale, shift up 60px

    // Insurance card — synced to line 3 ("Your insurance premium goes up")
    insuranceCardStart:      8000,
    insuranceCardEnd:        8700,    // slide in from left over 700ms

    // Broker greyout cascade — synced to line 4 ("brokers stop calling")
    broker1Greyed:          10300,
    broker2Greyed:          10450,    // staggered 150ms
    broker3Greyed:          10600,

    // Dashboard second compression — happens just before authority warning
    compress2Start:         12700,
    compress2End:           13700,    // 0.78 → 0.70 scale, shift up to -100px

    // AUTHORITY warning — synced to line 5 ("lose your motor carrier authority")
    authorityStart:         13100,
    authorityEnd:           13800,    // entrance with paper-impact bounce
    insuranceDim1Start:     13100,    // insurance card dims to 0.5
    insuranceDim1End:       13600,
    authorityFadeOutStart:  16500,    // fade authority before stamp lands
    authorityFadeOutEnd:    17000,

    // 730 DAYS stamp — synced to line 6 climax ("seven hundred and thirty days")
    stampStart:             17500,
    stampEnd:               18000,    // rotation + scale bounce
    insuranceDim2Start:     17500,    // insurance card dims to 0.25
    insuranceDim2End:       18000,
    brokerDimStart:         17500,    // broker stack fades to 0.6
    brokerDimEnd:           18000,

    // Final dwell — closing held frame before transition to Act 6
    dwellStart:             18000,
    dwellEnd:               22000,    // 4 seconds of held closing frame
  };

  // Dashboard entrance: scale up from 0.96 over the first 600ms
  const dashboardEnterProgress = Math.min(1, elapsedMs / TIMING.dashboardEnterEnd);
  const dashboardOpacity = dashboardEnterProgress;

  // Dashboard COMPRESSION choreography — as consequences land, the dashboard
  // visually retreats. This is the storytelling beat: the user sees the
  // dashboard literally lose ground as reality piles on.
  let dashboardCompressScale = 1.0;
  let dashboardShiftY = 0;
  if (elapsedMs >= TIMING.violationFlashStart && elapsedMs < TIMING.violationFlashEnd) {
    // Brief violation impact bounce (small punch outward)
    const t = (elapsedMs - TIMING.violationFlashStart) / (TIMING.violationFlashEnd - TIMING.violationFlashStart);
    dashboardCompressScale = 1.0 + (t < 0.5 ? t * 0.04 : (1 - t) * 0.04);
  } else if (elapsedMs >= TIMING.compress1Start && elapsedMs < TIMING.compress1End) {
    // First compression: 1.0 → 0.78, shift up to -60px
    const t = (elapsedMs - TIMING.compress1Start) / (TIMING.compress1End - TIMING.compress1Start);
    dashboardCompressScale = 1.0 - t * 0.22;
    dashboardShiftY = -t * 60;
  } else if (elapsedMs >= TIMING.compress1End && elapsedMs < TIMING.compress2Start) {
    // Hold at first compression during broker greyout
    dashboardCompressScale = 0.78;
    dashboardShiftY = -60;
  } else if (elapsedMs >= TIMING.compress2Start && elapsedMs < TIMING.compress2End) {
    // Second compression: 0.78 → 0.70, shift further up to -100px
    const t = (elapsedMs - TIMING.compress2Start) / (TIMING.compress2End - TIMING.compress2Start);
    dashboardCompressScale = 0.78 - t * 0.08;
    dashboardShiftY = -60 - t * 40;
  } else if (elapsedMs >= TIMING.compress2End) {
    // Hold at deepest compression for authority warning + stamp
    dashboardCompressScale = 0.70;
    dashboardShiftY = -100;
  }

  // Final dashboard transform combines entrance scale, compression, and shift
  const initialEnterScale = 0.96 + dashboardEnterProgress * 0.04;
  const dashboardScale = initialEnterScale * dashboardCompressScale;

  // Bars settle into starting positions (ease in)
  const barsSettleProgress = Math.min(1, Math.max(0,
    (elapsedMs - TIMING.barsSettleStart) / (TIMING.barsSettleEnd - TIMING.barsSettleStart)
  ));

  // VIOLATION FLASH — pulse hits hard then fades
  const violationFlashIntensity = (elapsedMs >= TIMING.violationFlashStart && elapsedMs < TIMING.violationFlashEnd)
    ? Math.max(0, 1 - (elapsedMs - TIMING.violationFlashStart) / (TIMING.violationFlashEnd - TIMING.violationFlashStart))
    : 0;

  // Vehicle Maintenance bar transition: 62 → 87 with punch-in
  const vmTransitionProgress = Math.max(0, Math.min(1,
    (elapsedMs - TIMING.vmTransitionStart) / (TIMING.vmTransitionEnd - TIMING.vmTransitionStart)
  ));
  const vmCurrentPercentile = 62 + (87 - 62) * vmTransitionProgress;
  const vmPunchScale = vmTransitionProgress < 0.5
    ? 1 + vmTransitionProgress * 2 * 0.08
    : 1 + (1 - (vmTransitionProgress - 0.5) * 2) * 0.08;
  const vmIsRed = vmTransitionProgress > 0.6;

  // Insurance card slides in from LEFT
  const insuranceCardProgress = Math.max(0, Math.min(1,
    (elapsedMs - TIMING.insuranceCardStart) / (TIMING.insuranceCardEnd - TIMING.insuranceCardStart)
  ));
  const insuranceCardX = -120 + insuranceCardProgress * 120; // -120% → 0%
  const insuranceCardOpacity = insuranceCardProgress;

  // Broker cards grey out staggered
  const broker1Greyed = elapsedMs >= TIMING.broker1Greyed;
  const broker2Greyed = elapsedMs >= TIMING.broker2Greyed;
  const broker3Greyed = elapsedMs >= TIMING.broker3Greyed;

  // Insurance card dims twice: once when authority warning arrives (to 0.5),
  // again when stamp lands (to 0). This produces the layered focus shift.
  let insuranceCardFinalOpacity;
  if (elapsedMs < TIMING.insuranceDim1Start) {
    insuranceCardFinalOpacity = insuranceCardOpacity;
  } else if (elapsedMs < TIMING.insuranceDim2Start) {
    const dim1 = Math.min(1, (elapsedMs - TIMING.insuranceDim1Start) / (TIMING.insuranceDim1End - TIMING.insuranceDim1Start));
    insuranceCardFinalOpacity = insuranceCardOpacity * (1 - dim1 * 0.5);
  } else {
    // Fade fully to 0 when stamp lands so the closing frame is clean
    const dim2 = Math.min(1, (elapsedMs - TIMING.insuranceDim2Start) / (TIMING.insuranceDim2End - TIMING.insuranceDim2Start));
    insuranceCardFinalOpacity = insuranceCardOpacity * 0.5 * (1 - dim2);
  }

  // Broker stack fades to 0 when stamp lands (audit fix: was 0.6, now 0 for cleaner closing)
  const brokerStackOpacity = elapsedMs < TIMING.brokerDimStart
    ? 1
    : Math.max(0, 1 - (elapsedMs - TIMING.brokerDimStart) / (TIMING.brokerDimEnd - TIMING.brokerDimStart));

  // AUTHORITY AT RISK warning entrance + fade-out
  const authorityProgress = Math.max(0, Math.min(1,
    (elapsedMs - TIMING.authorityStart) / (TIMING.authorityEnd - TIMING.authorityStart)
  ));
  const authorityScale = authorityProgress < 0.6
    ? 0.92 + authorityProgress * (1 / 0.6) * 0.16  // 0.92 → 1.08
    : 1.08 - (authorityProgress - 0.6) * (1 / 0.4) * 0.08;  // 1.08 → 1.0
  const authorityFadeOut = elapsedMs < TIMING.authorityFadeOutStart
    ? 1
    : Math.max(0, 1 - (elapsedMs - TIMING.authorityFadeOutStart) / (TIMING.authorityFadeOutEnd - TIMING.authorityFadeOutStart));
  const authorityOpacity = authorityProgress * authorityFadeOut;

  // 730 DAYS stamp lands with rotation and impact bounce
  const stampProgress = Math.max(0, Math.min(1,
    (elapsedMs - TIMING.stampStart) / (TIMING.stampEnd - TIMING.stampStart)
  ));
  const stampRotation = -8 + stampProgress * 8;  // -8° → 0°
  const stampScale = stampProgress < 0.5
    ? 1.15 - stampProgress * 2 * 0.15
    : 1.0 + (stampProgress - 0.5) * 2 * 0.05 * (1 - stampProgress);
  const stampOpacity = stampProgress;

  // Dashboard global tint: cools to deeper blue when violation lands
  const dashboardChillFactor = elapsedMs < TIMING.violationFlashStart
    ? 0
    : Math.min(1, (elapsedMs - TIMING.violationFlashStart) / 800);

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <CinematicStage className="a5-stage">
      <style>{ACT5_STYLES}</style>

      {/* ─── DASHBOARD CONTAINER ─── */}
      <div
        className="a5-dashboard"
        style={{
          transform: `translateY(${dashboardShiftY}px) scale(${dashboardScale})`,
          opacity: dashboardOpacity,
        }}
      >
        {/* Header strip — federal-document */}
        <div className="a5-dashboard-header">
          <div className="a5-fmcsa-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L21 6 L21 12 C21 17 17 21 12 22 C7 21 3 17 3 12 L3 6 Z"
                stroke="#c7b87a" strokeWidth="1.4" fill="rgba(199,184,122,0.06)" />
              <path d="M8 12 L11 15 L16 9" stroke="#c7b87a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </svg>
            <div className="a5-fmcsa-text">
              <div className="a5-fmcsa-line1">FMCSA · SAFETY MEASUREMENT SYSTEM</div>
              <div className="a5-fmcsa-line2">U.S. DEPARTMENT OF TRANSPORTATION</div>
            </div>
          </div>
          <div className="a5-header-meta">
            <div className="a5-meta-label">CARRIER</div>
            <div className="a5-meta-value">DOT-3847291</div>
          </div>
        </div>

        {/* Carrier name strip */}
        <div className="a5-carrier-strip">
          <span className="a5-carrier-name">{(companyName || 'BOX TRUCK BOSS').toUpperCase()}, LLC</span>
          <span className="a5-carrier-status" style={{
            color: dashboardChillFactor > 0.5 ? '#e85d4f' : '#c7b87a',
            transition: 'color 200ms linear',
          }}>
            {dashboardChillFactor > 0.5 ? 'INTERVENTION ALERT' : 'BASIC PRIORITIZATION'}
          </span>
        </div>

        {/* 7 BASIC category bars */}
        <div className="a5-basics-list">
          {BASIC_CATEGORIES.map((basic, idx) => {
            const isVehicleMaint = basic.id === 'vehicle_maintenance';
            const currentValue = isVehicleMaint ? vmCurrentPercentile : basic.percentile;
            const aboveThreshold = currentValue > basic.threshold;
            const barWidth = barsSettleProgress * (currentValue / 100) * 100;

            // Bar color: green/yellow/red based on threshold proximity
            let barColor = '#7a9a6b';  // green-tan (well below threshold)
            if (currentValue > basic.threshold * 0.75) barColor = '#c7b87a';  // tan-yellow (approaching)
            if (currentValue > basic.threshold * 0.95) barColor = '#d4914f';  // amber-warning
            if (aboveThreshold) barColor = '#e85d4f';  // red (above threshold)

            return (
              <div key={basic.id} className="a5-basic-row">
                <div className="a5-basic-label">{basic.name.toUpperCase()}</div>
                <div className="a5-basic-bar-track">
                  {/* Threshold marker line */}
                  <div
                    className="a5-threshold-marker"
                    style={{ left: `${basic.threshold}%` }}
                  />
                  {/* Active bar fill */}
                  <div
                    className="a5-basic-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                      transform: isVehicleMaint ? `scaleY(${vmPunchScale})` : 'scaleY(1)',
                      boxShadow: aboveThreshold
                        ? `0 0 12px ${barColor}80, inset 0 0 8px ${barColor}40`
                        : 'none',
                    }}
                  />
                  {/* Percentile text */}
                  <div
                    className="a5-basic-percentile"
                    style={{ color: aboveThreshold ? '#ffb4ad' : '#c7b87a' }}
                  >
                    {Math.round(currentValue)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer status — fades out when dashboard compression begins, so the
            footer text doesn't collide with the caption (now at bottom:160px,
            below all consequence cards with comfortable 80px clearance above
            the footer text). */}
        <div
          className="a5-footer"
          style={{
            opacity: elapsedMs < TIMING.violationFlashStart
              ? 1
              : Math.max(0, 1 - (elapsedMs - TIMING.violationFlashStart) / 500),
          }}
        >
          <span>EVALUATION PERIOD: 24 MONTHS</span>
          <span>UPDATED: {(new Date().getFullYear())}-05</span>
        </div>
      </div>

      {/* ─── VIOLATION FLASH OVERLAY ─── */}
      {violationFlashIntensity > 0 && (
        <div
          className="a5-violation-flash"
          style={{ opacity: violationFlashIntensity * 0.75 }}
        />
      )}

      {/* ─── INSURANCE PREMIUM CARD (slides in from right at 4000ms) ─── */}
      {insuranceCardProgress > 0 && (
        <div
          className="a5-insurance-card"
          style={{
            transform: `translateX(${insuranceCardX}%)`,
            opacity: insuranceCardFinalOpacity,
          }}
        >
          <div className="a5-card-header">
            <span className="a5-card-eyebrow">INSURANCE</span>
            <svg className="a5-arrow-up" width="16" height="16" viewBox="0 0 16 16">
              <path d="M8 2 L8 13 M3 7 L8 2 L13 7" stroke="#e85d4f" strokeWidth="1.8"
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="a5-card-body">
            <div className="a5-premium-row">
              <span className="a5-premium-label">PREVIOUS</span>
              <span className="a5-premium-old">$12,400/yr</span>
            </div>
            <div className="a5-premium-row">
              <span className="a5-premium-label">RENEWAL</span>
              <span className="a5-premium-new">$18,900/yr</span>
            </div>
            <div className="a5-premium-delta">+52% — CSA SCORE FACTOR</div>
          </div>
        </div>
      )}

      {/* ─── BROKER CONTACT CARDS (grey out at 5500ms staggered) ─── */}
      <div
        className="a5-broker-stack"
        style={{ opacity: brokerStackOpacity }}
      >
        <BrokerCard name="Greenline Logistics" load="$2.40/mi · 1,247 loads" greyed={broker1Greyed} delay={0} />
        <BrokerCard name="Premier Freight Co." load="$2.65/mi · 892 loads" greyed={broker2Greyed} delay={150} />
        <BrokerCard name="Continental Brokerage" load="$2.55/mi · 1,108 loads" greyed={broker3Greyed} delay={300} />
      </div>

      {/* ─── AUTHORITY AT RISK WARNING (animates in at 7000ms) ─── */}
      {authorityProgress > 0 && (
        <div
          className="a5-authority-warning"
          style={{
            transform: `translate(-50%, -50%) scale(${authorityScale})`,
            opacity: authorityOpacity,
          }}
        >
          <svg className="a5-authority-shield" width="32" height="32" viewBox="0 0 32 32">
            <path d="M16 3 L27 7 L27 16 C27 23 22 28 16 30 C10 28 5 23 5 16 L5 7 Z"
              stroke="#e85d4f" strokeWidth="1.8" fill="rgba(232,93,79,0.12)" />
            <path d="M16 11 L16 18 M16 22 L16 23" stroke="#e85d4f" strokeWidth="2.4"
              fill="none" strokeLinecap="round" />
          </svg>
          <div className="a5-authority-text">
            <div className="a5-authority-eyebrow">FMCSA · ENFORCEMENT NOTICE</div>
            <div className="a5-authority-headline">OPERATING AUTHORITY AT RISK</div>
          </div>
        </div>
      )}

      {/* ─── 730 DAYS STAMP (lands at 8500ms with paper-impact) ─── */}
      {stampProgress > 0 && (
        <div
          className="a5-stamp-container"
          style={{
            transform: `translate(-50%, -50%) rotate(${stampRotation}deg) scale(${stampScale})`,
            opacity: stampOpacity,
          }}
        >
          <div className="a5-stamp">
            <div className="a5-stamp-corner a5-stamp-corner-tl" />
            <div className="a5-stamp-corner a5-stamp-corner-tr" />
            <div className="a5-stamp-corner a5-stamp-corner-bl" />
            <div className="a5-stamp-corner a5-stamp-corner-br" />
            <div className="a5-stamp-eyebrow">VIOLATION RETENTION</div>
            <div className="a5-stamp-number">2</div>
            <div className="a5-stamp-label">YEARS</div>
          </div>
        </div>
      )}

      {/* ─── COLD COLOR GRADE OVERLAY (deepens after violation) ─── */}
      <div
        className="a5-color-grade"
        style={{ opacity: 0.6 + dashboardChillFactor * 0.25 }}
      />

      {/* ─── ATMOSPHERIC LAYERS — vignette + grain only (no warm tint) ─── */}
      <AtmosphericLayers
        vignette={true}
        scanlines={true}
        grain={true}
        warmTint={false}
        lightShaft={false}
      />

      {/* ─── CINEMA BARS ─── */}
      <CinemaBars barHeight={32} delayMs={100} />

      {/* ─── DIALOGUE CAPTION ───
          Positioned at bottom:160 instead of the shared default 232 because
          Act 5 has consequence cards (insurance, broker stack, authority
          warning) occupying the bottom 300-735 zone. With caption at the
          default 232, only ~50px separates the caption from the cards
          above — the dense colored borders and shadows of the cards visually
          compete with the caption text.

          Lowering to 160 places the caption in clear empty space:
            ~125px gap above the caption (cards bottom y=735 → caption top y=857)
            ~80px  gap below the caption (caption bottom y=880 → footer y=960)
          The footer fades out anyway during the violation flash, but during
          seg1/seg2 (before fade) this 80px gap keeps the small dim footer
          text visually distinct from the prominent white caption.

          Font-size, color, shadow, fade-in animation all unchanged — only
          the vertical position differs from other acts to suit Act 5's
          unique multi-card lower-third layout. */}
      <CinematicCaption text={currentSegment ? currentSegment.text : null} bottom={160} />

      {/* ─── SKIP BUTTON ─── */}
      <button className="a5-skip-btn" onClick={onSkip} aria-label="Skip act">
        Skip
      </button>
    </CinematicStage>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENT — BrokerCard
// Three of these stack vertically at the right edge. They start as "active"
// (full opacity, green status indicator) and grey out sequentially when
// the cascade reaches the broker beat.
// ─────────────────────────────────────────────────────────────────────────────

const BrokerCard = React.memo(function BrokerCard({ name, load, greyed, delay }) {
  return (
    <div
      className={`a5-broker-card ${greyed ? 'is-greyed' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="a5-broker-header">
        <span className="a5-broker-name">{name}</span>
        <span className={`a5-broker-status ${greyed ? 'is-rejected' : 'is-active'}`}>
          {greyed ? 'BELOW THRESHOLD' : 'ACTIVE'}
        </span>
      </div>
      <div className="a5-broker-load">{load}</div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — federal document tan-on-black aesthetic
// ─────────────────────────────────────────────────────────────────────────────

const ACT5_STYLES = `
.a5-stage {
  background: #06080d;
}

/* ═══ DASHBOARD ═══ */
.a5-dashboard {
  position: absolute;
  inset: 60px 14px 60px 14px;
  background: #0a0e15;
  border: 1px solid rgba(199, 184, 122, 0.20);
  border-radius: 4px;
  padding: 14px 16px;
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 20;
  transform-origin: center center;
  will-change: transform, opacity;
  box-shadow:
    inset 0 0 1px rgba(199, 184, 122, 0.15),
    0 4px 24px rgba(0, 0, 0, 0.6);
}

.a5-dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 0.5px solid rgba(199, 184, 122, 0.20);
}

.a5-fmcsa-mark {
  display: flex;
  align-items: center;
  gap: 8px;
}

.a5-fmcsa-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.a5-fmcsa-line1 {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.10em;
  color: #c7b87a;
}

.a5-fmcsa-line2 {
  font-size: 7px;
  font-weight: 500;
  letter-spacing: 0.16em;
  color: rgba(199, 184, 122, 0.55);
}

.a5-header-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.a5-meta-label {
  font-size: 7px;
  letter-spacing: 0.16em;
  color: rgba(199, 184, 122, 0.45);
  font-weight: 500;
}

.a5-meta-value {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.10em;
  color: #c7b87a;
}

.a5-carrier-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0 8px;
  border-bottom: 0.5px solid rgba(199, 184, 122, 0.15);
}

.a5-carrier-name {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #d8cfa3;
}

.a5-carrier-status {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: #c7b87a;
}

/* ═══ BASIC CATEGORY BARS ═══ */
.a5-basics-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  padding: 4px 0;
}

.a5-basic-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.a5-basic-label {
  font-size: 8.5px;
  font-weight: 500;
  letter-spacing: 0.10em;
  color: rgba(216, 207, 163, 0.85);
}

.a5-basic-bar-track {
  position: relative;
  height: 14px;
  background: rgba(199, 184, 122, 0.06);
  border: 0.5px solid rgba(199, 184, 122, 0.15);
  border-radius: 1px;
  overflow: visible;
}

.a5-threshold-marker {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background: rgba(199, 184, 122, 0.55);
  z-index: 2;
  pointer-events: none;
}

.a5-threshold-marker::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -2px;
  width: 5px;
  height: 5px;
  background: rgba(199, 184, 122, 0.65);
  transform: rotate(45deg);
}

.a5-basic-bar-fill {
  position: absolute;
  top: 0; bottom: 0; left: 0;
  border-radius: 1px;
  transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms linear, box-shadow 200ms linear;
  transform-origin: center center;
  will-change: width, transform, box-shadow;
}

.a5-basic-percentile {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  font-size: 9px;
  font-weight: 600;
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: 0.05em;
  z-index: 3;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
}

/* ═══ FOOTER ═══ */
.a5-footer {
  display: flex;
  justify-content: space-between;
  font-size: 7px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: rgba(199, 184, 122, 0.40);
  padding-top: 8px;
  border-top: 0.5px solid rgba(199, 184, 122, 0.15);
}

/* ═══ VIOLATION FLASH ═══ */
.a5-violation-flash {
  position: absolute;
  inset: 0;
  z-index: 25;
  background: radial-gradient(ellipse at 50% 50%,
    rgba(232, 93, 79, 0.65) 0%,
    rgba(232, 93, 79, 0.30) 50%,
    transparent 90%);
  pointer-events: none;
  mix-blend-mode: screen;
}

/* ═══ INSURANCE CARD ═══ */
/* Positioned in the lower-LEFT zone after the dashboard compresses upward.
   Sits at bottom 300px. The caption now lives below at bottom 160px (lowered
   from the default 232px so it's clear of the cards), so there's no caption
   collision in this zone. Width constrained so the card doesn't reach the
   broker stack on the right. */
.a5-insurance-card {
  position: absolute;
  bottom: 300px;
  left: 16px;
  width: 220px;
  background: rgba(15, 10, 8, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(232, 93, 79, 0.55);
  border-radius: 4px;
  padding: 10px 12px;
  z-index: 30;
  box-shadow:
    0 0 16px rgba(232, 93, 79, 0.25),
    0 8px 24px rgba(0, 0, 0, 0.65);
  font-family: 'IBM Plex Mono', monospace;
  will-change: transform, opacity;
}

.a5-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.a5-card-eyebrow {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #ffb4ad;
}

.a5-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.a5-premium-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 10px;
}

.a5-premium-label {
  color: rgba(199, 184, 122, 0.55);
  font-size: 8px;
  letter-spacing: 0.10em;
}

.a5-premium-old {
  color: rgba(216, 207, 163, 0.60);
  text-decoration: line-through;
  font-weight: 500;
}

.a5-premium-new {
  color: #ffb4ad;
  font-weight: 600;
}

.a5-premium-delta {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 0.5px solid rgba(232, 93, 79, 0.30);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.10em;
  color: #e85d4f;
  text-align: center;
}

/* ═══ BROKER CARDS ═══ */
/* Positioned in lower-RIGHT zone, vertically aligned with insurance card
   at bottom 300px. Three cards stack at 300-450px from bottom. */
.a5-broker-stack {
  position: absolute;
  bottom: 300px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 28;
  pointer-events: none;
}

.a5-broker-card {
  width: 180px;
  background: rgba(15, 10, 8, 0.85);
  border: 0.5px solid rgba(199, 184, 122, 0.30);
  border-radius: 3px;
  padding: 7px 10px;
  font-family: 'IBM Plex Mono', monospace;
  transition: opacity 400ms ease-out, filter 400ms ease-out, border-color 400ms ease-out;
}

.a5-broker-card.is-greyed {
  opacity: 0.32;
  filter: grayscale(0.8);
  border-color: rgba(232, 93, 79, 0.35);
}

.a5-broker-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}

.a5-broker-name {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #d8cfa3;
}

.a5-broker-status {
  font-size: 7px;
  font-weight: 600;
  letter-spacing: 0.10em;
  padding: 1px 5px;
  border-radius: 2px;
}

.a5-broker-status.is-active {
  color: #7a9a6b;
  background: rgba(122, 154, 107, 0.15);
}

.a5-broker-status.is-rejected {
  color: #ffb4ad;
  background: rgba(232, 93, 79, 0.18);
}

.a5-broker-load {
  font-size: 8px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: rgba(216, 207, 163, 0.55);
}

/* ═══ AUTHORITY AT RISK WARNING ═══ */
/* Positioned at top:55% — well clear of the compressed dashboard's lower bars
   at this beat (dashboard is at scale 0.70, shifted up 100px, so its bottom
   edge sits around 35% from top). max-width prevents right-edge clipping
   on 480px mobile viewport. */
.a5-authority-warning {
  position: absolute;
  left: 50%;
  top: 55%;
  transform: translate(-50%, -50%);
  background: rgba(15, 8, 8, 0.95);
  border: 1.5px solid #e85d4f;
  border-radius: 4px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 35;
  box-shadow:
    0 0 24px rgba(232, 93, 79, 0.45),
    0 12px 32px rgba(0, 0, 0, 0.85);
  font-family: 'IBM Plex Mono', monospace;
  transform-origin: center center;
  will-change: transform, opacity;
  max-width: 380px;
  width: max-content;
}

.a5-authority-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.a5-authority-eyebrow {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.20em;
  color: rgba(232, 93, 79, 0.85);
}

.a5-authority-headline {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ffb4ad;
}

/* ═══ 730 DAYS STAMP ═══ */
/* The closing impact. Positioned at top 46% (slightly above center) where
   the compressed dashboard has cleared the most space and the stamp lands
   in clean separation from the consequence cards below. Lands during the
   deepest compression (8500ms) when dashboard is at 0.70 scale and shifted up. */
.a5-stamp-container {
  position: absolute;
  left: 50%;
  top: 46%;
  transform-origin: center center;
  z-index: 40;
  pointer-events: none;
  will-change: transform, opacity;
}

.a5-stamp {
  position: relative;
  background: transparent;
  border: 3px solid #e85d4f;
  padding: 12px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  font-family: 'IBM Plex Mono', monospace;
  box-shadow:
    inset 0 0 1px rgba(232, 93, 79, 0.5),
    0 0 24px rgba(232, 93, 79, 0.30);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65));
}

.a5-stamp-corner {
  position: absolute;
  width: 8px; height: 8px;
  border: 3px solid #e85d4f;
}
.a5-stamp-corner-tl { top: -3px; left: -3px; border-right: none; border-bottom: none; }
.a5-stamp-corner-tr { top: -3px; right: -3px; border-left: none; border-bottom: none; }
.a5-stamp-corner-bl { bottom: -3px; left: -3px; border-right: none; border-top: none; }
.a5-stamp-corner-br { bottom: -3px; right: -3px; border-left: none; border-top: none; }

.a5-stamp-eyebrow {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.20em;
  color: rgba(232, 93, 79, 0.85);
  margin-bottom: 4px;
}

.a5-stamp-number {
  font-size: 60px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #ffb4ad;
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}

.a5-stamp-label {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #ffb4ad;
  margin-top: -2px;
}

/* ═══ COLD COLOR GRADE OVERLAY ═══ */
/* Subtle cold-blue cast over the entire frame, deepening when violation lands.
   Counterpart to Act 4's warm amber tint — establishes the federal/consequence
   color register that distinguishes Act 5 from Marcus's intimate voicemail. */
.a5-color-grade {
  position: absolute;
  inset: 0;
  z-index: 14;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 30%,
      rgba(38, 56, 80, 0.18) 0%,
      rgba(20, 28, 44, 0.10) 60%,
      rgba(8, 12, 20, 0.25) 100%);
  mix-blend-mode: multiply;
  transition: opacity 200ms linear;
}

/* ═══ SKIP BUTTON ═══ */
.a5-skip-btn {
  position: absolute;
  bottom: 44px;
  right: 14px;
  z-index: 90;
  background: rgba(0, 0, 0, 0.5);
  color: rgba(199, 184, 122, 0.55);
  border: 0.5px solid rgba(199, 184, 122, 0.25);
  border-radius: 22px;
  padding: 6px 14px;
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.2s ease, color 0.2s ease, transform 0.2s ease;
  opacity: 0;
  animation: a5SkipFadeIn 0.6s ease-out 1.2s forwards;
  min-width: 44px;
  min-height: 28px;
}
@keyframes a5SkipFadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.a5-skip-btn:hover, .a5-skip-btn:active {
  color: rgba(199, 184, 122, 0.95);
  transform: scale(1.05);
}

/* ═══ REDUCE-MOTION ═══ */
/* Inherited from WelcomeModalShared — disables jitter and grain animation.
   Act 5's visual events (bar fills, card slides, stamp landing) are
   information-conveying rather than decorative atmosphere, so they're
   preserved even under reduce-motion. The narrative still functions:
   bars settle, violation lands, cards appear, stamp lands. The user
   just doesn't get the handheld jitter or animated film grain. */
.perf-reduce-motion .a5-stage,
.perf-reduce-motion .a5-skip-btn {
  animation: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .a5-stage,
  .a5-skip-btn {
    animation: none !important;
  }
  .a5-basic-bar-fill {
    transition: width 0.001s linear !important;
  }
  .a5-broker-card {
    transition: opacity 0.001s linear, filter 0.001s linear, border-color 0.001s linear !important;
  }
}
`;

export default Act5TheScore;
