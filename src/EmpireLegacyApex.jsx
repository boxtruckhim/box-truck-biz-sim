/**
 * EmpireLegacyApex.jsx
 * Empire Legacy apex cinematic — Box Truck Boss Phase 4.0L-2
 *
 * Standalone React 18 component. Same directory as App.jsx, HOSPuzzle.jsx, etc.
 * Plays a ~13-second cinematic sequence when the player sells their company
 * with empire-eligibility criteria met. After the cinematic completes, fires
 * onComplete() so App.jsx can route to the existing gameover screen.
 *
 * SEQUENCE OVERVIEW:
 *   Phase A · Apex auto-plays (0–4.5s)
 *     Mountain scene fades in, sun pulse + ray breath start, title appears,
 *     drone glide begins, ambient pad fades in (low C-G open fifth).
 *   Phase B · Indefinite pause for HEADLINES tap (>= 4.5s)
 *     HEADLINES button appears with golden glow pulse. Player taps when ready.
 *   Phase C · Transition (~1.5s)
 *     Sun-anchored white flash from (86.1%, 28.1%) blooms outward. Apex
 *     blurs/scales/fades. Cinema bars expand to cover, then retract. Warm
 *     ambient persists into the dark stage where the press release will land.
 *   Phase D · Newspaper cascade (~5s)
 *     Press release card slides up + scales in with overshoot. BREAKING bar
 *     pops in with scaleY bounce. Cascade reveal: brand → eyebrow → headline
 *     → deck → byline → 3 stat cards → body → timestamp. Verified badge slams
 *     in with green glow. Highlight ring scribbles around hero stat. Card sits
 *     STATIC for reading (no idle float).
 *   Phase E · Indefinite pause for VIEW FINAL RESULTS tap
 *     Live dot pulses, badge glows softly, ring pulses. Card stays still.
 *   Phase F · Exit (~0.6s)
 *     Card scales down + fades. onComplete() fires. App.jsx routes to gameover.
 *
 * AUDIO ARCHITECTURE (sparse cinematic philosophy):
 *   Through-line — sustained warm pad holds the entire newspaper section
 *     (apexAmbience pad during apex; newspaperBed pad during press release)
 *   Punctuation — only 5 cues during newspaper cascade (pressLand, pressHeadline,
 *     3 stat pops, verifiedSlam, highlightChirp) plus reused apexInvite for
 *     FINAL RESULTS button
 *   Cut entirely from production: BREAKING bar audio, all 4 ticks (brand,
 *     eyebrow, byline, timestamp), deck/body reveals (notification clutter)
 *   Audio cues are scheduled via useEffect with cleanup — no ghost timeouts.
 *
 * PROPS:
 *   companyValue: number      — sale value (displayed as headline)
 *   currentDay: number        — day count (displayed in eyebrow)
 *   sellGrade: string         — grade letter ("S+", "S", etc., displayed in stat card)
 *   prestigeLevel: number     — for "P5" or similar context display (optional)
 *   loadCount?: number        — total loads completed (optional, defaults computed)
 *   imageUrl: string          — URL of the mountain alpenglow image
 *   playApexSFX: function     — App.jsx's apex SFX function. Signature:
 *                                 playApexSFX(cueName: string) — fires named cue
 *                                 playApexSFX('stopBed', fadeSeconds?: number) — stops sustained pad
 *   onComplete: function      — fires when player taps VIEW FINAL RESULTS
 *
 * PRODUCTION NOTES:
 *   - React.memo wrapper · CSS-only animations · useEffect with cleanup
 *   - Mobile-first 9:16 portrait at max-width 480px
 *   - All interactive elements have 44×44px touch targets
 *   - WebkitTapHighlightColor: transparent for clean Android tap feedback
 *   - Sun-anchored elements at exactly (86.1%, 28.1%) — measured via whiteness
 *     detection on the source image, verified pixel-accurate
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING HELPERS — keeps component self-contained
// ═══════════════════════════════════════════════════════════════════════════

const formatCompanyValue = (n) => {
  // $12,400,000 → "$12.4M"; $1,800,000 → "$1.8M"; $980,000 → "$980K"
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m.toFixed(m >= 10 ? 1 : 2).replace(/\.?0+$/, '')}M`;
  }
  if (n >= 1_000) {
    return `$${Math.round(n / 1_000)}K`;
  }
  return `$${n}`;
};

const formatDay = (n) => n.toLocaleString();

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const EmpireLegacyApex = memo(function EmpireLegacyApex({
  companyValue = 12_400_000,
  currentDay = 1234,
  sellGrade = 'S+',
  prestigeLevel = 5,
  loadCount = 2847,
  imageUrl,
  playApexSFX,
  onComplete,
}) {
  // ─── Phase state ──────────────────────────────────────────────────────────
  // 'apex' → 'transitioning' → 'newspaper' → 'exiting' → 'finished'
  // CSS animations are gated by [data-phase] attribute on the stage frame.
  const [phase, setPhase] = useState('apex');

  // Refs for timeout tracking (cleanup on unmount or phase reset)
  const timeoutsRef = useRef([]);

  // Helper: schedule a tracked timeout that auto-clears on cleanup
  const schedule = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Helper: clear all pending timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  // Safe SFX wrapper — no-op if playApexSFX prop missing
  const sfx = useCallback((cue, ...args) => {
    if (typeof playApexSFX === 'function') {
      try { playApexSFX(cue, ...args); } catch (e) { /* swallow audio errors */ }
    }
  }, [playApexSFX]);

  // ─── PHASE A: APEX AUTO-PLAYS (on mount) ─────────────────────────────────
  // Fire ambient pad immediately, title swell at 0.7s, invite ding at 4.5s.
  useEffect(() => {
    sfx('apexAmbience');                                // bed fades in over 2.0s
    schedule(() => sfx('apexTitleSwell'), 700);         // CSS title fade-in 0.7s
    schedule(() => sfx('apexInvite'), 4500);            // CSS HEADLINES button 4.5s

    // Cleanup on unmount: stop pad, clear timeouts
    return () => {
      sfx('stopBed', 0.2);
      clearAllTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PHASE B → C: HEADLINES tapped → start transition ─────────────────────
  const handleHeadlinesTap = useCallback(() => {
    if (phase !== 'apex') return;
    sfx('apexCommit');
    setPhase('transitioning');

    // Sun burst at start of transition (synced with CSS sun-flash animation)
    sfx('sunBurst');

    // After 1.0s transition window, enter newspaper phase + start cascade audio
    schedule(() => {
      setPhase('newspaper');

      // Newspaper through-line bed (warm F major)
      sfx('newspaperBed');

      // Sparse punctuation cues — synced to CSS animation start times
      schedule(() => sfx('pressLand'), 2000);          // CSS card lands at 2.1s
      schedule(() => sfx('pressHeadline'), 2400);      // CSS pressFadeUp 2.4s
      schedule(() => sfx('pressStatPop1'), 3100);      // CSS statCardIn 3.1s
      schedule(() => sfx('pressStatPop2'), 3250);      // CSS statCardIn 3.25s
      schedule(() => sfx('pressStatPop3'), 3400);      // CSS statCardIn 3.4s
      schedule(() => sfx('verifiedSlam'), 4600);       // CSS verifiedSlam 4.6s
      schedule(() => sfx('highlightChirp'), 5600);     // CSS highlightRing 5.6s
      schedule(() => sfx('apexInvite'), 6500);         // CSS finalBtnIn 6.5s
    }, 1000);
  }, [phase, sfx, schedule]);

  // ─── PHASE E → F: VIEW FINAL RESULTS tapped → exit ───────────────────────
  const handleFinalResultsTap = useCallback(() => {
    if (phase !== 'newspaper') return;
    sfx('apexCommit');
    sfx('stopBed', 0.6);                                // fade newspaper bed
    setPhase('exiting');

    // After 0.6s exit window, fire onComplete
    schedule(() => {
      setPhase('finished');
      // Slight extra delay to let the finished state render before unmounting
      schedule(() => {
        if (typeof onComplete === 'function') onComplete();
      }, 100);
    }, 600);
  }, [phase, sfx, schedule, onComplete]);

  // ─── Display values ───────────────────────────────────────────────────────
  const displayValue = formatCompanyValue(companyValue);
  const displayDay = formatDay(currentDay);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS_STAGE}</style>
      <div className="ela-stage-frame" data-phase={phase}>

        {/* Dark backdrop emerges during transition */}
        <div className="ela-dark-stage"></div>

        {/* APEX LAYER — fades during transition */}
        <div className="ela-apex-layer">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="ela-apex-scene"
              draggable={false}
            />
          )}
          <div className="ela-sun-rays"></div>
          <div className="ela-sun-glow"></div>
          <div className="ela-corner-vignette"></div>
          <div className="ela-grain"></div>
          <div className="ela-top-darken"></div>
          <div className="ela-title-block">
            <div className="ela-eyebrow">FINAL DELIVERY · DAY {displayDay}</div>
            <div className="ela-apex-title">EMPIRE LEGACY</div>
            <div className="ela-subtitle">From one truck to a transport empire</div>
          </div>
          <button
            type="button"
            className="ela-headlines-btn"
            onClick={handleHeadlinesTap}
            aria-label="View headlines"
          >
            HEADLINES →
          </button>
        </div>

        {/* TRANSITION ELEMENTS */}
        <div className="ela-sun-flash"></div>
        <div className="ela-warm-ambient"></div>

        {/* PRESS RELEASE LAYER */}
        <div className="ela-press-layer">
          <article className="ela-press-card">
            <div className="ela-press-toprow">
              <span className="ela-live">BREAKING</span>
              <span>DAY {displayDay} · 4:18 PM EST</span>
            </div>
            <div className="ela-press-brand">
              <div className="ela-press-logo">freight<span>wire</span></div>
              <div className="ela-press-section">Mergers &amp; Exits</div>
            </div>
            <div className="ela-press-content">
              <div className="ela-press-eyebrow">Transaction · Empire Legacy</div>
              <div className="ela-press-headline">
                "Trucking Empire" Sells for Record {displayValue}
              </div>
              <div className="ela-press-deck">
                Owner-operator's {displayDay}-day climb culminates in {sellGrade} grade exit · 365-day clean compliance record at sale
              </div>
              <div className="ela-press-byline-row">
                <div className="ela-press-avatar">MR</div>
                <div className="ela-press-author">
                  <strong>M. Rodriguez</strong>
                  <span>Lead Dispatcher · 18 yrs covering carriers</span>
                </div>
              </div>
              <div className="ela-press-stat-cards">
                <div className="ela-press-stat-card ela-highlight">
                  <div className="ela-num">{displayValue}</div>
                  <div className="ela-lbl">Exit Value</div>
                </div>
                <div className="ela-press-stat-card">
                  <div className="ela-num">{displayDay}</div>
                  <div className="ela-lbl">Days</div>
                </div>
                <div className="ela-press-stat-card">
                  <div className="ela-num">{sellGrade}</div>
                  <div className="ela-lbl">Grade</div>
                </div>
              </div>
              <div className="ela-press-body">
                <p>The transportation sector witnessed a milestone yesterday as the company built from a single 26-foot box truck closed at one of the highest exit valuations in its market segment.</p>
              </div>
              <div className="ela-press-timestamp">Posted 2 min ago</div>
              <button
                type="button"
                className="ela-final-results-btn"
                onClick={handleFinalResultsTap}
                aria-label="View final results"
              >
                View Final Results
              </button>
            </div>
            <div className="ela-press-verified">VERIFIED EXIT</div>
          </article>
        </div>

        {/* CINEMA BARS — slide in for apex, expand briefly during transition, retract for newspaper */}
        <div className="ela-cine-top"></div>
        <div className="ela-cine-bottom"></div>

      </div>
    </>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// CSS — All styles prefixed with `ela-` to prevent collision with App.jsx
// Animation timings exactly match the audio cue schedule. Edits to either
// MUST stay in sync.
// ═══════════════════════════════════════════════════════════════════════════

const CSS_STAGE = `
.ela-stage-frame {
  position: fixed; inset: 0; z-index: 100020;
  background: #000;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-tap-highlight-color: transparent;
}

/* ============================================================
   APEX LAYER
   ============================================================ */
.ela-apex-layer {
  position: absolute; inset: 0; z-index: 10;
  pointer-events: none;
  opacity: 1;
}
.ela-apex-scene {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: center;
  z-index: 1; opacity: 0;
  user-select: none;
  animation: elaSceneIn 1.4s ease-out forwards,
             elaDroneGlide 22s ease-in-out 1.4s forwards;
}
@keyframes elaSceneIn { to { opacity: 1; } }
@keyframes elaDroneGlide {
  from { transform: scale(1.0); }
  to { transform: scale(1.10) translate(-1.8%, 0.6%); }
}

/* When stage transitions out of apex, dismiss apex layer */
.ela-stage-frame[data-phase="transitioning"] .ela-apex-layer,
.ela-stage-frame[data-phase="newspaper"] .ela-apex-layer,
.ela-stage-frame[data-phase="exiting"] .ela-apex-layer,
.ela-stage-frame[data-phase="finished"] .ela-apex-layer {
  animation: elaApexDismiss 1.0s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}
@keyframes elaApexDismiss {
  0%   { opacity: 1; filter: blur(0) brightness(1); transform: scale(1); }
  40%  { opacity: 1; filter: blur(0) brightness(1.5); transform: scale(1.02); }
  100% { opacity: 0; filter: blur(24px) brightness(0.3); transform: scale(1.18); }
}

/* SUN-ANCHORED ELEMENTS — exactly at sun position (86.1%, 28.1%) */
.ela-sun-glow {
  position: absolute;
  left: 86.1%; top: 28.1%;
  width: 24%; aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%; z-index: 6; pointer-events: none;
  background: radial-gradient(circle,
    rgba(255, 250, 210, 0.55) 0%,
    rgba(255, 200, 80, 0.22) 40%,
    rgba(255, 140, 30, 0.08) 60%,
    transparent 75%);
  filter: blur(2px); mix-blend-mode: screen;
  animation: elaSunPulse 5s ease-in-out infinite;
}
@keyframes elaSunPulse {
  0%, 100% { box-shadow: 0 0 60px rgba(255, 220, 120, 0.5);
    transform: translate(-50%, -50%) scale(1); }
  50% { box-shadow: 0 0 120px rgba(255, 220, 120, 0.85);
    transform: translate(-50%, -50%) scale(1.10); }
}

.ela-sun-rays {
  position: absolute;
  left: 86.1%; top: 28.1%;
  width: 200%; aspect-ratio: 1;
  transform: translate(-50%, -50%);
  z-index: 5; pointer-events: none;
  background: conic-gradient(from 0deg,
    transparent 0deg, rgba(255, 230, 140, 0.10) 4deg, transparent 9deg,
    transparent 28deg, rgba(255, 230, 140, 0.08) 32deg, transparent 37deg,
    transparent 64deg, rgba(255, 230, 140, 0.10) 68deg, transparent 73deg,
    transparent 102deg, rgba(255, 230, 140, 0.07) 106deg, transparent 111deg,
    transparent 142deg, rgba(255, 230, 140, 0.09) 146deg, transparent 151deg,
    transparent 180deg, rgba(255, 230, 140, 0.10) 184deg, transparent 189deg,
    transparent 220deg, rgba(255, 230, 140, 0.07) 224deg, transparent 229deg,
    transparent 260deg, rgba(255, 230, 140, 0.09) 264deg, transparent 269deg,
    transparent 298deg, rgba(255, 230, 140, 0.08) 302deg, transparent 307deg,
    transparent 336deg, rgba(255, 230, 140, 0.10) 340deg, transparent 345deg);
  filter: blur(2px); mix-blend-mode: screen;
  animation: elaRayBreath 18s ease-in-out infinite;
}
@keyframes elaRayBreath {
  0%, 100% { transform: translate(-50%, -50%) rotate(-6deg) scale(0.98); opacity: 0.55; }
  50% { transform: translate(-50%, -50%) rotate(6deg) scale(1.08); opacity: 0.85; }
}

/* TITLE BLOCK */
.ela-title-block {
  position: absolute; top: 7%; left: 0; right: 0;
  text-align: center; z-index: 30; padding: 0 20px;
  opacity: 0;
  animation: elaTitleFade 1s ease-out 0.7s forwards;
}
@keyframes elaTitleFade {
  from { opacity: 0; transform: translateY(-22px); }
  to { opacity: 1; transform: translateY(0); }
}
.ela-eyebrow {
  font-size: 0.55rem; letter-spacing: 4.5px;
  color: rgba(255, 248, 220, 0.95); font-weight: 800;
  text-transform: uppercase; margin-bottom: 8px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.95);
}
.ela-apex-title {
  font-size: clamp(1.5rem, 5.5vw, 2rem); font-weight: 900;
  letter-spacing: 3.5px; color: #fff8dc;
  text-shadow: 0 0 32px rgba(255, 215, 0, 1.0),
               0 4px 18px rgba(0, 0, 0, 0.95),
               0 0 70px rgba(255, 140, 28, 0.6);
  margin-bottom: 6px;
  animation: elaTitleGlow 4s ease-in-out 1.7s infinite;
}
@keyframes elaTitleGlow {
  0%, 100% { text-shadow: 0 0 28px rgba(255, 215, 0, 0.8),
    0 4px 18px rgba(0, 0, 0, 0.95), 0 0 60px rgba(255, 140, 28, 0.4); }
  50% { text-shadow: 0 0 56px rgba(255, 215, 0, 1.0),
    0 4px 18px rgba(0, 0, 0, 0.95), 0 0 100px rgba(255, 140, 28, 0.85); }
}
.ela-subtitle {
  font-size: 0.78rem; font-style: italic;
  color: rgba(255, 248, 220, 0.95);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
}

.ela-top-darken {
  position: absolute; top: 0; left: 0; right: 0; height: 24%;
  z-index: 25; pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0.1) 70%, transparent 100%);
  opacity: 0;
  animation: elaFadeIn 1.4s ease-out 0.5s forwards;
}
@keyframes elaFadeIn { to { opacity: 1; } }

/* CINEMA BARS — single shared system, three-stage chain */
.ela-cine-top, .ela-cine-bottom {
  position: absolute; left: 0; right: 0; background: #000; z-index: 80;
}
.ela-cine-top {
  top: 0; height: 28px; transform: translateY(-100%);
  animation: elaCineDown 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
}
.ela-cine-bottom {
  bottom: 0; height: 28px; transform: translateY(100%);
  animation: elaCineUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards;
}
@keyframes elaCineDown { to { transform: translateY(0); } }
@keyframes elaCineUp   { to { transform: translateY(0); } }

.ela-stage-frame[data-phase="transitioning"] .ela-cine-top {
  animation: elaCineExpandTop 0.6s cubic-bezier(0.4, 0, 0.6, 1) 0.2s forwards,
             elaCineRetractTop 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1.1s forwards;
}
.ela-stage-frame[data-phase="transitioning"] .ela-cine-bottom {
  animation: elaCineExpandBottom 0.6s cubic-bezier(0.4, 0, 0.6, 1) 0.2s forwards,
             elaCineRetractBottom 0.7s cubic-bezier(0.22, 1, 0.36, 1) 1.1s forwards;
}
.ela-stage-frame[data-phase="newspaper"] .ela-cine-top,
.ela-stage-frame[data-phase="exiting"] .ela-cine-top,
.ela-stage-frame[data-phase="finished"] .ela-cine-top,
.ela-stage-frame[data-phase="newspaper"] .ela-cine-bottom,
.ela-stage-frame[data-phase="exiting"] .ela-cine-bottom,
.ela-stage-frame[data-phase="finished"] .ela-cine-bottom {
  display: none;
}
@keyframes elaCineExpandTop      { from { height: 28px; } to { height: 50%; } }
@keyframes elaCineExpandBottom   { from { height: 28px; } to { height: 50%; } }
@keyframes elaCineRetractTop     { from { height: 50%; } to { height: 0; } }
@keyframes elaCineRetractBottom  { from { height: 50%; } to { height: 0; } }

/* HEADLINES BUTTON */
.ela-headlines-btn {
  position: absolute; bottom: 48px; left: 50%;
  transform: translateX(-50%);
  padding: 13px 36px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.28), rgba(255, 170, 0, 0.12));
  border: 1.5px solid rgba(255, 215, 0, 0.65);
  border-radius: 12px;
  color: #ffd700;
  font-size: 0.74rem; font-weight: 800; letter-spacing: 2.5px;
  cursor: pointer; z-index: 60;
  text-transform: uppercase;
  box-shadow: 0 4px 24px rgba(255, 215, 0, 0.25),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
  opacity: 0;
  pointer-events: auto;  /* override parent's pointer-events:none */
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px; min-width: 44px;
  animation: elaBtnIn 0.7s ease-out 4.5s forwards,
             elaBtnPulse 2.4s ease-in-out 5.5s infinite;
}
.ela-headlines-btn:hover {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 170, 0, 0.18));
  transform: translateX(-50%) translateY(-1px);
  box-shadow: 0 6px 32px rgba(255, 215, 0, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.ela-headlines-btn:active { transform: translateX(-50%) translateY(0) scale(0.97); }
@keyframes elaBtnIn {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes elaBtnPulse {
  0%, 100% { box-shadow: 0 4px 24px rgba(255, 215, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 215, 0, 0.65); }
  50% { box-shadow: 0 4px 40px rgba(255, 215, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 215, 0, 0.95); }
}
.ela-stage-frame[data-phase="transitioning"] .ela-headlines-btn,
.ela-stage-frame[data-phase="newspaper"] .ela-headlines-btn,
.ela-stage-frame[data-phase="exiting"] .ela-headlines-btn,
.ela-stage-frame[data-phase="finished"] .ela-headlines-btn {
  animation: elaBtnOut 0.3s ease-in forwards;
  pointer-events: none;
}
@keyframes elaBtnOut {
  to { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.96); }
}

.ela-corner-vignette {
  position: absolute; inset: 0; z-index: 8; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.5) 100%);
}
.ela-grain {
  position: absolute; inset: -50% -50% -50% -50%; z-index: 35;
  pointer-events: none; opacity: 0.07; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  animation: elaGrainShift 0.6s steps(6) infinite;
}
@keyframes elaGrainShift {
  0%, 100% { transform: translate(0, 0); }
  10% { transform: translate(-3%, -5%); }
  30% { transform: translate(2%, -7%); }
  50% { transform: translate(6%, 4%); }
  70% { transform: translate(4%, 8%); }
  90% { transform: translate(-5%, 3%); }
}

/* ============================================================
   TRANSITION ELEMENTS — fire when stage enters "transitioning"
   ============================================================ */
.ela-sun-flash {
  position: absolute;
  left: 86.1%; top: 28.1%;
  width: 0; height: 0;
  transform: translate(-50%, -50%);
  border-radius: 50%; z-index: 70; pointer-events: none;
  background: radial-gradient(circle,
    rgba(255, 250, 220, 1) 0%,
    rgba(255, 220, 140, 0.8) 30%,
    rgba(255, 180, 80, 0.4) 50%,
    transparent 75%);
  opacity: 0;
}
.ela-stage-frame[data-phase="transitioning"] .ela-sun-flash {
  animation: elaSunFlash 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes elaSunFlash {
  0%   { width: 0; height: 0; opacity: 0; }
  20%  { width: 60vmin; height: 60vmin; opacity: 1; }
  60%  { width: 200vmin; height: 200vmin; opacity: 0.9; }
  100% { width: 300vmin; height: 300vmin; opacity: 0; }
}

.ela-dark-stage {
  position: absolute; inset: 0; z-index: 5;
  background: radial-gradient(ellipse at 50% 38%,
    rgba(40, 28, 20, 1) 0%,
    rgba(15, 10, 8, 1) 50%,
    rgba(5, 4, 4, 1) 100%);
  opacity: 0;
}
.ela-stage-frame[data-phase="transitioning"] .ela-dark-stage,
.ela-stage-frame[data-phase="newspaper"] .ela-dark-stage,
.ela-stage-frame[data-phase="exiting"] .ela-dark-stage,
.ela-stage-frame[data-phase="finished"] .ela-dark-stage {
  animation: elaDarkStageIn 1.0s ease-out 0.4s forwards;
}
@keyframes elaDarkStageIn { to { opacity: 1; } }

.ela-warm-ambient {
  position: absolute; left: 50%; top: 38%;
  width: 90%; aspect-ratio: 1;
  transform: translate(-50%, -50%);
  z-index: 6; pointer-events: none;
  background: radial-gradient(circle,
    rgba(255, 180, 80, 0.18) 0%,
    rgba(255, 140, 40, 0.08) 40%,
    transparent 70%);
  filter: blur(20px); opacity: 0;
}
.ela-stage-frame[data-phase="transitioning"] .ela-warm-ambient,
.ela-stage-frame[data-phase="newspaper"] .ela-warm-ambient,
.ela-stage-frame[data-phase="exiting"] .ela-warm-ambient {
  animation: elaWarmIn 0.8s ease-out 0.4s forwards,
             elaWarmFade 4s ease-out 1.2s forwards;
}
@keyframes elaWarmIn { to { opacity: 1; } }
@keyframes elaWarmFade { to { opacity: 0.4; } }

/* ============================================================
   PRESS RELEASE LAYER
   ============================================================ */
.ela-press-layer {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  padding: 30px 22px;
  pointer-events: none; opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-layer,
.ela-stage-frame[data-phase="exiting"] .ela-press-layer {
  animation: elaPressLayerIn 0.4s ease-out 1.0s forwards;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-layer { pointer-events: auto; }
@keyframes elaPressLayerIn { to { opacity: 1; } }

.ela-press-card {
  width: 100%; max-width: 380px;
  background: #fff; color: #0f172a;
  font-family: -apple-system, 'SF Pro Display', 'Inter', sans-serif;
  border-radius: 14px;
  position: relative;
  transform: translateY(80px) scale(0.85);
  opacity: 0;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05),
              0 12px 24px rgba(0, 0, 0, 0.4),
              0 30px 60px rgba(0, 0, 0, 0.5),
              0 0 80px rgba(255, 180, 80, 0.15);
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-card {
  animation: elaPressCardIn 1.0s cubic-bezier(0.22, 1.05, 0.36, 1) 1.1s forwards;
}
.ela-stage-frame[data-phase="exiting"] .ela-press-card {
  animation: elaPressCardIn 1.0s cubic-bezier(0.22, 1.05, 0.36, 1) 1.1s forwards,
             elaPressCardOut 0.6s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}
@keyframes elaPressCardIn {
  0%   { transform: translateY(80px) scale(0.85); opacity: 0; }
  60%  { transform: translateY(-8px) scale(1.02); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes elaPressCardOut {
  to { transform: translateY(20px) scale(0.92); opacity: 0; }
}

/* TOP BREAKING BAR */
.ela-press-toprow {
  background: #dc2626; color: #fff;
  padding: 9px 18px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.6rem; letter-spacing: 1.5px;
  text-transform: uppercase; font-weight: 700;
  border-radius: 14px 14px 0 0;
  transform-origin: top center;
  opacity: 0; transform: scaleY(0.3) translateY(-4px);
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-toprow,
.ela-stage-frame[data-phase="exiting"] .ela-press-toprow {
  animation: elaToprowPop 0.5s cubic-bezier(0.4, 1.6, 0.6, 1) 1.6s forwards;
}
@keyframes elaToprowPop {
  0%   { opacity: 0; transform: scaleY(0.3) translateY(-4px); }
  60%  { opacity: 1; transform: scaleY(1.05) translateY(0); }
  100% { opacity: 1; transform: scaleY(1) translateY(0); }
}
.ela-live { display: flex; align-items: center; gap: 6px; }
.ela-live::before {
  content: ''; width: 7px; height: 7px; border-radius: 50%;
  background: #fff;
  animation: elaLiveBlink 1.2s ease-in-out infinite;
}
@keyframes elaLiveBlink {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
  50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(255, 255, 255, 0); }
}

/* BRAND ROW */
.ela-press-brand {
  padding: 14px 22px 10px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid #e2e8f0;
  opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-brand,
.ela-stage-frame[data-phase="exiting"] .ela-press-brand {
  animation: elaPressFadeUp 0.5s ease-out 2.0s forwards;
}
.ela-press-logo {
  font-size: 0.95rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;
}
.ela-press-logo span { color: #dc2626; }
.ela-press-section {
  font-size: 0.55rem; letter-spacing: 2px; color: #64748b;
  text-transform: uppercase; font-weight: 600;
}

.ela-press-content {
  padding: 20px 22px 22px;
  border-radius: 0 0 14px 14px;
}
.ela-press-eyebrow {
  font-size: 0.55rem; letter-spacing: 2.5px; color: #dc2626;
  font-weight: 800; text-transform: uppercase; margin-bottom: 10px;
  opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-eyebrow,
.ela-stage-frame[data-phase="exiting"] .ela-press-eyebrow {
  animation: elaPressFadeUp 0.5s ease-out 2.2s forwards;
}
.ela-press-headline {
  font-size: 1.45rem; font-weight: 900; line-height: 1.05;
  color: #0f172a; margin-bottom: 10px; letter-spacing: -1px;
  opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-headline,
.ela-stage-frame[data-phase="exiting"] .ela-press-headline {
  animation: elaPressFadeUp 0.6s ease-out 2.4s forwards;
}
.ela-press-deck {
  font-size: 0.78rem; color: #475569; line-height: 1.55;
  margin-bottom: 14px; opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-deck,
.ela-stage-frame[data-phase="exiting"] .ela-press-deck {
  animation: elaPressFadeUp 0.5s ease-out 2.7s forwards;
}
.ela-press-byline-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0;
  border-top: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 14px; opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-byline-row,
.ela-stage-frame[data-phase="exiting"] .ela-press-byline-row {
  animation: elaPressFadeUp 0.5s ease-out 3.0s forwards;
}
.ela-press-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #dc2626 0%, #ff8c1c 100%);
  color: #fff; font-weight: 900; font-size: 0.75rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ela-press-author { font-size: 0.7rem; line-height: 1.3; }
.ela-press-author strong { display: block; color: #0f172a; font-weight: 700; }
.ela-press-author span { color: #64748b; font-size: 0.6rem; }

@keyframes elaPressFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* STAT CARDS */
.ela-press-stat-cards {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
  margin-bottom: 14px;
}
.ela-press-stat-card {
  background: linear-gradient(180deg, #f8fafc, #f1f5f9);
  border: 1px solid #e2e8f0;
  border-radius: 8px; padding: 11px 6px;
  text-align: center; position: relative; overflow: hidden;
  opacity: 0; transform: translateY(10px) scale(0.9);
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-stat-card:nth-child(1),
.ela-stage-frame[data-phase="exiting"] .ela-press-stat-card:nth-child(1) {
  animation: elaStatCardIn 0.5s cubic-bezier(0.4, 1.5, 0.6, 1) 3.1s forwards;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-stat-card:nth-child(2),
.ela-stage-frame[data-phase="exiting"] .ela-press-stat-card:nth-child(2) {
  animation: elaStatCardIn 0.5s cubic-bezier(0.4, 1.5, 0.6, 1) 3.25s forwards;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-stat-card:nth-child(3),
.ela-stage-frame[data-phase="exiting"] .ela-press-stat-card:nth-child(3) {
  animation: elaStatCardIn 0.5s cubic-bezier(0.4, 1.5, 0.6, 1) 3.4s forwards;
}
@keyframes elaStatCardIn {
  0%   { opacity: 0; transform: translateY(10px) scale(0.9); }
  60%  { transform: translateY(-3px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.ela-press-stat-card .ela-num {
  font-size: 1.05rem; font-weight: 900;
  color: #dc2626; letter-spacing: -0.5px;
}
.ela-press-stat-card .ela-lbl {
  font-size: 0.5rem; color: #64748b; letter-spacing: 1.5px;
  margin-top: 3px; text-transform: uppercase;
}

/* HIGHLIGHT RING — around the hero stat ($12.4M) */
.ela-press-stat-card.ela-highlight::before {
  content: ''; position: absolute; inset: -3px;
  border: 2px solid rgba(220, 38, 38, 0.7);
  border-radius: 11px; pointer-events: none;
  transform: scale(1.4); opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-stat-card.ela-highlight::before,
.ela-stage-frame[data-phase="exiting"] .ela-press-stat-card.ela-highlight::before {
  animation: elaHighlightRing 0.6s cubic-bezier(0.4, 1.5, 0.6, 1) 5.6s forwards,
             elaHighlightPulse 2s ease-in-out 6.2s infinite;
}
@keyframes elaHighlightRing {
  0%   { transform: scale(1.4); opacity: 0; }
  60%  { transform: scale(0.95); opacity: 1; }
  100% { transform: scale(1); opacity: 0.85; }
}
@keyframes elaHighlightPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
}

/* BODY TEXT */
.ela-press-body {
  font-size: 0.76rem; line-height: 1.6; color: #334155;
  margin-bottom: 14px; opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-body,
.ela-stage-frame[data-phase="exiting"] .ela-press-body {
  animation: elaPressFadeUp 0.5s ease-out 3.6s forwards;
}
.ela-press-body p { margin-bottom: 8px; }

/* VERIFIED EXIT BADGE */
.ela-press-verified {
  position: absolute; top: 60px; right: -8px;
  padding: 7px 14px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff; font-size: 0.6rem; font-weight: 800;
  letter-spacing: 1.5px; text-transform: uppercase;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5),
              0 0 0 2px rgba(255, 255, 255, 0.9) inset;
  transform: rotate(8deg) scale(2.5);
  opacity: 0; z-index: 30;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-verified,
.ela-stage-frame[data-phase="exiting"] .ela-press-verified {
  animation: elaVerifiedSlam 0.5s cubic-bezier(0.4, 2, 0.6, 1) 4.6s forwards,
             elaVerifiedGlow 2.5s ease-in-out 5.6s infinite;
}
.ela-press-verified::before {
  content: '✓'; margin-right: 5px;
  font-size: 0.85rem; font-weight: 900;
}
@keyframes elaVerifiedSlam {
  0%   { transform: rotate(20deg) scale(2.5); opacity: 0; }
  50%  { transform: rotate(8deg) scale(0.9); opacity: 1; }
  100% { transform: rotate(8deg) scale(1); opacity: 1; }
}
@keyframes elaVerifiedGlow {
  0%, 100% { box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5),
    0 0 0 2px rgba(255, 255, 255, 0.9) inset; }
  50% { box-shadow: 0 4px 24px rgba(16, 185, 129, 0.85),
    0 0 0 2px rgba(255, 255, 255, 0.9) inset; }
}

/* TIMESTAMP */
.ela-press-timestamp {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.55rem; color: #94a3b8;
  letter-spacing: 1px; text-transform: uppercase;
  font-weight: 600; margin-bottom: 14px; opacity: 0;
}
.ela-stage-frame[data-phase="newspaper"] .ela-press-timestamp,
.ela-stage-frame[data-phase="exiting"] .ela-press-timestamp {
  animation: elaPressFadeUp 0.4s ease-out 3.8s forwards;
}
.ela-press-timestamp::before {
  content: ''; width: 5px; height: 5px; border-radius: 50%;
  background: #10b981;
  animation: elaTsBlink 2s ease-in-out infinite;
}
@keyframes elaTsBlink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

/* VIEW FINAL RESULTS BUTTON */
.ela-final-results-btn {
  width: 100%; padding: 13px 20px;
  background: linear-gradient(135deg, #dc2626 0%, #ff5050 100%);
  border: none; border-radius: 10px;
  color: #fff; font-size: 0.78rem; font-weight: 800;
  letter-spacing: 1.8px; cursor: pointer; text-transform: uppercase;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35),
              inset 0 1px 0 rgba(255, 255, 255, 0.2);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  opacity: 0; transform: translateY(8px);
}
.ela-stage-frame[data-phase="newspaper"] .ela-final-results-btn,
.ela-stage-frame[data-phase="exiting"] .ela-final-results-btn {
  animation: elaFinalBtnIn 0.6s cubic-bezier(0.22, 1.05, 0.36, 1) 6.5s forwards,
             elaFinalBtnPulse 3s ease-in-out 7.5s infinite;
}
.ela-final-results-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5),
              inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.ela-final-results-btn:active { transform: translateY(0) scale(0.98); }
.ela-final-results-btn::after {
  content: '→'; font-size: 1rem; font-weight: 900;
}
@keyframes elaFinalBtnIn { to { opacity: 1; transform: translateY(0); } }
@keyframes elaFinalBtnPulse {
  0%, 100% { box-shadow: 0 4px 16px rgba(220, 38, 38, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.2); }
  50% { box-shadow: 0 4px 28px rgba(220, 38, 38, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.3); }
}

/* Reduce-motion accessibility */
@media (prefers-reduced-motion: reduce) {
  .ela-stage-frame *,
  .ela-stage-frame *::before,
  .ela-stage-frame *::after {
    animation-duration: 0.001s !important;
    animation-delay: 0s !important;
  }
}
`;

export default EmpireLegacyApex;
