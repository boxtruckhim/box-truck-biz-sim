// ═══════════════════════════════════════════════════════════════════════════
// ScratchShop.jsx — Box Truck Boss · IAP Scratch-Off Shop · Phase 4
//
// Self-contained React 18 companion component (same pattern as DockMaster.jsx,
// FreightRunner.jsx, ScratchOff.jsx). No external libraries.
// CSS animations injected once via <style> tag.
//
// SCREENS:
//   age_gate  → shop → [odds_screen | confirm → processing → success | error]
//
// PROPS CONTRACT (integration with App.jsx):
//   onClose()                         — close the shop overlay
//   iapAgeConfirmed                   — boolean, persisted in save schema v3
//   setIapAgeConfirmed(bool)          — setter
//   iapOddsAcknowledged               — boolean, persisted in save schema v3
//   setIapOddsAcknowledged(bool)      — setter
//   iapPurchases                      — array, receipt log
//   setIapPurchases(arr|fn)           — setter
//   ticketQueue                       — array, pre-purchased tickets
//   setTicketQueue(arr|fn)            — setter
//   truckVouchers                     — number
//   setTruckVouchers(n|fn)            — setter
//   prizeWallet                       — array of wallet items
//   setPrizeWallet(arr|fn)            — setter
//   fuelCardExpiry                    — number|null (ms timestamp)
//   setFuelCardExpiry(ts|null)        — setter
//   brokerNetworkExpiry               — number|null (ms timestamp)
//   setBrokerNetworkExpiry(ts|null)   — setter
//   fleetExpansionTokens              — number
//   setFleetExpansionTokens(n|fn)     — setter
//   goldenRateConQueue                — array of premium load offers
//   setGoldenRateConQueue(arr|fn)     — setter
//   selectedEdition                   — 'demo'|'basic'|'enterprise'
//   truckStatus                       — array of truck objects (for fleet count)
//   cash                              — current player cash (number)
//   currentDay                        — current game day (number)
//   level                             — player level 1–100+ (number)
//   prestigeLevel                     — prestige count 0+ (number)
//   addNotification(msg, type)        — App.jsx notification system
//   currentUser                       — Firebase user object | null
//   onInitiatePurchase(packId, onSuccess, onError) — Phase 5: Capacitor IAP hook
//   onRestorePurchases(onSuccess, onError)         — Phase 5: restore hook
//   onLogLegendAcknowledgment(packId, userId)      — Phase 5: Firebase log hook
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import {
  PRODUCT_IDS,
  PACKS,
  ODDS_TABLE,
  ODDS_TOTAL_WEIGHT,
  DISCLOSED_WIN_RATE,
  DISCLOSED_JACKPOT_ODDS,
  isNonConsumable,
  requiresEditionDisclosure,
  getEditionDisclosureText,
  getOddsTableForDisplay,
  buildTicketQueue,
} from './iapPacks';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 · STYLE CONSTANTS
// Matches App.jsx / ScratchOff.jsx dark design language exactly.
// ─────────────────────────────────────────────────────────────────────────────
const FONT  = "'Outfit','SF Pro Display',-apple-system,sans-serif";
const MONO  = "'Courier New',Courier,monospace";

const C = {
  bg0:      '#050810',
  bg1:      '#0a0f1c',
  bg2:      '#111828',
  bg3:      '#1a2438',
  gold:     '#FFD700',
  goldDim:  '#c89020',
  goldFaint:'rgba(255,215,0,0.10)',
  white:    '#ffffff',
  text:     '#e8ecf4',
  muted:    'rgba(255,255,255,0.45)',
  dim:      'rgba(255,255,255,0.22)',
  border:   'rgba(255,255,255,0.08)',
  borderMid:'rgba(255,255,255,0.14)',
  success:  '#22c55e',
  error:    '#ef4444',
  warn:     '#f59e0b',
};

// Pack accent colours — mirrors iapPacks.js pack color fields
const PACK_ACCENTS = {
  [PRODUCT_IDS.STARTER_BUNDLE]: { main: '#c8a020', glow: 'rgba(200,160,32,0.28)', text: '#ffe580' },
  [PRODUCT_IDS.DAYONE_PACK]:    { main: '#a060ff', glow: 'rgba(160,96,255,0.28)', text: '#d0aaff' },
  [PRODUCT_IDS.ROADBOSS_PACK]:  { main: '#9ab0c8', glow: 'rgba(154,176,200,0.28)', text: '#d8e8f8' },
  [PRODUCT_IDS.LEGEND_BUNDLE]:  { main: '#40e880', glow: 'rgba(64,232,128,0.28)', text: '#a0ffcc' },
};

// Display order for pack cards in the shop (hero pack first)
const PACK_ORDER = [
  PRODUCT_IDS.LEGEND_BUNDLE,
  PRODUCT_IDS.ROADBOSS_PACK,
  PRODUCT_IDS.DAYONE_PACK,
  PRODUCT_IDS.STARTER_BUNDLE,
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 · CSS INJECTION
// Injected once into document.head. ID 'ss-styles' prevents duplicates.
// ─────────────────────────────────────────────────────────────────────────────
const SS_CSS = `
@keyframes ssFadeIn {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0);    }
}
@keyframes ssSlideUp {
  from { opacity:0; transform:translateY(24px) scale(0.97); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
@keyframes ssSpin {
  to { transform: rotate(360deg); }
}
@keyframes ssPulse {
  0%,100% { opacity:1; }
  50%      { opacity:0.6; }
}
@keyframes ssGlow {
  0%,100% { box-shadow: 0 0 8px var(--ss-accent,#FFD700); }
  50%      { box-shadow: 0 0 20px var(--ss-accent,#FFD700), 0 0 40px var(--ss-accent,#FFD700); }
}
@keyframes ssBonusPulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(var(--ss-rgb),0.30); }
  50%      { box-shadow: 0 0 0 4px rgba(var(--ss-rgb),0.0);  }
}
        @keyframes ssShimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes ssCheckPop {
  0%   { transform:scale(0.6); opacity:0; }
  60%  { transform:scale(1.2); }
  100% { transform:scale(1);   opacity:1; }
}
@keyframes ssSuccessBounce {
  0%   { transform:scale(0.5) rotate(-10deg); opacity:0; }
  60%  { transform:scale(1.15) rotate(3deg); }
  80%  { transform:scale(0.95) rotate(-1deg); }
  100% { transform:scale(1) rotate(0deg); opacity:1; }
}

/* Root overlay */
.ss-overlay {
  position:fixed; inset:0; z-index:100010;
  background:rgba(3,5,14,0.96);
  display:flex; flex-direction:column;
  align-items:center; justify-content:flex-start;
  font-family:${FONT};
  -webkit-tap-highlight-color:transparent;
  overflow:hidden;
}

/* Header bar */
.ss-header {
  width:100%; max-width:480px;
  display:flex; align-items:center; gap:10px;
  padding:14px 16px 10px;
  padding-top:max(14px, env(safe-area-inset-top, 0px));
  border-bottom:1px solid ${C.border};
  flex-shrink:0;
}
.ss-header-title {
  flex:1; font-size:1.05rem; font-weight:700;
  color:${C.text}; letter-spacing:0.5px;
}
.ss-header-btn {
  min-width:44px; min-height:44px;
  display:flex; align-items:center; justify-content:center;
  background:none; border:none; cursor:pointer;
  color:${C.muted}; font-size:0.78rem; font-weight:600;
  letter-spacing:0.5px; border-radius:8px;
  padding:0 10px;
  transition:color 0.15s, background 0.15s;
  -webkit-tap-highlight-color:transparent;
}
.ss-header-btn:hover { color:${C.text}; background:rgba(255,255,255,0.06); }
.ss-close-btn {
  font-size:1.2rem; color:${C.muted};
}

/* Scrollable body */
.ss-body {
  flex:1; width:100%; max-width:480px;
  overflow-y:auto; overflow-x:hidden;
  -webkit-overflow-scrolling:touch;
  padding:16px 14px 24px;
}
.ss-body::-webkit-scrollbar { width:3px; }
.ss-body::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }

/* Pack card */
.ss-pack-card {
  border-radius:14px;
  border:1px solid var(--ss-accent-border, ${C.border});
  background:${C.bg1};
  margin-bottom:14px;
  overflow:hidden;
  animation:ssFadeIn 0.25s ease both;
  position:relative;
  transition:transform 0.15s, box-shadow 0.15s;
}
.ss-pack-card:hover {
  transform:translateY(-1px);
  box-shadow:0 4px 24px var(--ss-glow, rgba(0,0,0,0.5));
}
.ss-pack-header {
  padding:12px 14px 10px;
  display:flex; align-items:center; gap:10px;
  border-bottom:1px solid rgba(255,255,255,0.05);
  background: linear-gradient(135deg,
    rgba(var(--ss-rgb),0.12) 0%,
    rgba(var(--ss-rgb),0.04) 100%
  );
}
.ss-pack-badge {
  font-size:0.6rem; font-weight:800; letter-spacing:1px;
  padding:3px 8px; border-radius:20px;
  background:var(--ss-accent,${C.gold}); color:#050810;
  flex-shrink:0;
}
.ss-pack-name {
  flex:1; font-size:0.95rem; font-weight:700;
  color:${C.text}; line-height:1.2;
}
.ss-pack-price {
  font-size:1.1rem; font-weight:800;
  color:var(--ss-text, ${C.gold});
  flex-shrink:0;
}
.ss-pack-body {
  padding:12px 14px 14px;
}
.ss-pack-desc {
  font-size:0.8rem; color:${C.muted}; line-height:1.5;
  margin-bottom:10px;
}
.ss-prize-row {
  display:flex; align-items:flex-start; gap:7px;
  margin-bottom:5px;
}
.ss-prize-dot {
  width:5px; height:5px; border-radius:50%;
  background:var(--ss-accent, ${C.gold});
  flex-shrink:0; margin-top:5px;
}
.ss-prize-text {
  font-size:0.78rem; color:${C.text}; line-height:1.4;
}
.ss-prize-text strong { color:var(--ss-text,${C.gold}); }
.ss-ticket-chips {
  display:flex; flex-wrap:wrap; gap:5px;
  margin:8px 0;
}
.ss-ticket-chip {
  font-size:0.65rem; font-weight:700; letter-spacing:0.5px;
  padding:3px 8px; border-radius:12px;
  background:rgba(255,255,255,0.07);
  border:1px solid rgba(255,255,255,0.12);
  color:${C.muted};
}
.ss-divider {
  height:1px; background:${C.border}; margin:10px 0;
}
.ss-odds-badge {
  font-size:0.68rem; color:${C.muted};
  display:flex; align-items:center; gap:6px;
  margin-bottom:10px;
}
.ss-odds-link {
  color:var(--ss-text,${C.gold}); text-decoration:none;
  font-weight:600; cursor:pointer;
}
.ss-floor-note {
  font-size:0.7rem; color:${C.success};
  font-weight:600; margin-bottom:8px;
}
.ss-owned-banner {
  font-size:0.72rem; font-weight:700; letter-spacing:0.5px;
  color:${C.success}; text-align:center;
  padding:10px; background:rgba(34,197,94,0.08);
  border:1px solid rgba(34,197,94,0.2); border-radius:8px;
}
.ss-buy-btn {
  width:100%; min-height:48px;
  display:flex; align-items:center; justify-content:center; gap:8px;
  border:none; border-radius:10px; cursor:pointer;
  font-family:${FONT}; font-size:0.92rem; font-weight:800;
  letter-spacing:0.5px;
  background:var(--ss-accent,${C.gold}); color:#050810;
  transition:opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  -webkit-tap-highlight-color:transparent;
}
.ss-buy-btn:hover { opacity:0.9; box-shadow:0 4px 16px var(--ss-glow,rgba(0,0,0,0.4)); }
.ss-buy-btn:active { transform:scale(0.98); }
.ss-buy-btn:disabled {
  opacity:0.35; cursor:not-allowed; transform:none;
}

/* Age gate screen */
.ss-age-gate {
  animation:ssSlideUp 0.28s ease both;
  padding:4px 0 8px;
}
.ss-age-icon {
  text-align:center; font-size:2.4rem; margin-bottom:10px; margin-top:4px;
}
.ss-age-title {
  text-align:center; font-size:1.1rem; font-weight:800;
  color:${C.text}; margin-bottom:6px;
}
.ss-age-subtitle {
  text-align:center; font-size:0.8rem; color:${C.muted};
  margin-bottom:18px; line-height:1.5;
}
.ss-info-box {
  background:${C.bg2}; border:1px solid ${C.borderMid};
  border-radius:10px; padding:14px; margin-bottom:14px;
}
.ss-info-box-title {
  font-size:0.72rem; font-weight:700; letter-spacing:0.8px;
  color:${C.muted}; margin-bottom:8px; text-transform:uppercase;
}
.ss-info-row {
  display:flex; align-items:flex-start; gap:8px; margin-bottom:7px;
}
.ss-info-row:last-child { margin-bottom:0; }
.ss-info-bullet { color:${C.gold}; flex-shrink:0; }
.ss-info-text { font-size:0.8rem; color:${C.text}; line-height:1.4; }
.ss-odds-summary {
  background:rgba(255,215,0,0.06);
  border:1px solid rgba(255,215,0,0.18);
  border-radius:8px; padding:12px; margin-bottom:14px;
}
.ss-odds-summary-row {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:5px;
}
.ss-odds-summary-row:last-child { margin-bottom:0; }
.ss-odds-label { font-size:0.78rem; color:${C.muted}; }
.ss-odds-val   { font-size:0.78rem; color:${C.gold}; font-weight:700; }
.ss-checkbox-row {
  display:flex; align-items:flex-start; gap:12px;
  padding:14px; background:${C.bg2};
  border:1px solid ${C.border}; border-radius:10px;
  margin-bottom:16px; cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.ss-checkbox {
  width:22px; height:22px; border-radius:6px; flex-shrink:0;
  border:2px solid ${C.borderMid};
  background:${C.bg3};
  display:flex; align-items:center; justify-content:center;
  transition:all 0.15s; margin-top:1px;
}
.ss-checkbox.checked {
  background:${C.gold}; border-color:${C.gold};
  animation:ssCheckPop 0.2s ease;
}
.ss-checkbox-label {
  font-size:0.82rem; color:${C.text}; line-height:1.5; flex:1;
}
.ss-confirm-btn {
  width:100%; min-height:50px;
  display:flex; align-items:center; justify-content:center;
  border:none; border-radius:12px; cursor:pointer;
  font-family:${FONT}; font-size:0.95rem; font-weight:800;
  letter-spacing:0.5px; color:#050810;
  background:${C.gold};
  transition:opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color:transparent;
}
.ss-confirm-btn:disabled {
  opacity:0.3; cursor:not-allowed;
}
.ss-confirm-btn:not(:disabled):active { transform:scale(0.98); }
.ss-link-btn {
  background:none; border:none; cursor:pointer;
  color:${C.gold}; font-size:0.78rem; font-weight:600;
  font-family:${FONT}; padding:4px 0; text-decoration:underline;
  -webkit-tap-highlight-color:transparent;
}

/* Odds screen */
.ss-odds-screen { animation:ssFadeIn 0.22s ease both; }
.ss-odds-intro {
  font-size:0.82rem; color:${C.muted}; line-height:1.6;
  margin-bottom:16px;
}
.ss-odds-table {
  width:100%; border-collapse:collapse;
  margin-bottom:16px;
}
.ss-odds-table th {
  font-size:0.65rem; font-weight:700; letter-spacing:0.8px;
  color:${C.muted}; text-transform:uppercase;
  padding:8px 10px; border-bottom:1px solid ${C.border};
  text-align:left;
}
.ss-odds-table td {
  padding:9px 10px; border-bottom:1px solid rgba(255,255,255,0.04);
  font-size:0.78rem; color:${C.text}; vertical-align:middle;
}
.ss-odds-table tr:first-child td { color:${C.gold}; font-weight:700; }
.ss-odds-table tr:last-child td { color:${C.muted}; }
.ss-total-row {
  background:rgba(255,215,0,0.06);
  border:1px solid rgba(255,215,0,0.14);
  border-radius:8px; padding:12px;
  margin-bottom:14px;
}
.ss-total-label { font-size:0.72rem; color:${C.muted}; margin-bottom:3px; }
.ss-total-val   { font-size:1.0rem; color:${C.gold}; font-weight:800; }
.ss-url-box {
  background:${C.bg2}; border:1px solid ${C.border};
  border-radius:8px; padding:10px 14px;
  margin-bottom:16px;
  display:flex; align-items:center; gap:8px;
}
.ss-url-label { font-size:0.72rem; color:${C.muted}; }
.ss-url-val   { font-size:0.78rem; color:${C.gold}; font-weight:600; }
.ss-scroll-hint {
  text-align:center; font-size:0.72rem; color:${C.muted};
  margin-bottom:10px; display:flex; align-items:center;
  justify-content:center; gap:5px;
  animation:ssPulse 1.8s ease infinite;
}
.ss-scroll-hint.done { animation:none; color:${C.success}; }

/* Confirm dialog */
.ss-confirm-overlay {
  position:fixed; inset:0; z-index:100020;
  background:rgba(3,5,14,0.85);
  display:flex; align-items:flex-end; justify-content:center;
  padding:0 0 env(safe-area-inset-bottom,0px);
  animation:ssFadeIn 0.18s ease;
}
.ss-confirm-sheet {
  width:100%; max-width:480px;
  background:${C.bg1};
  border-radius:20px 20px 0 0;
  border-top:1px solid ${C.border};
  max-height:88vh; overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  animation:ssSlideUp 0.24s ease;
  padding-bottom:env(safe-area-inset-bottom,16px);
}
.ss-confirm-sheet::-webkit-scrollbar { display:none; }
.ss-confirm-handle {
  width:40px; height:4px; border-radius:2px;
  background:${C.border}; margin:12px auto 16px;
}
.ss-confirm-pack-header {
  padding:0 16px 14px;
  display:flex; align-items:center; gap:12px;
  border-bottom:1px solid ${C.border};
}
.ss-confirm-pack-icon {
  width:44px; height:44px; border-radius:12px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:1.5rem;
  background:linear-gradient(135deg,
    rgba(var(--ss-rgb),0.2),
    rgba(var(--ss-rgb),0.06)
  );
  border:1px solid rgba(var(--ss-rgb),0.3);
}
.ss-confirm-pack-name {
  flex:1; font-size:1.0rem; font-weight:800; color:${C.text};
}
.ss-confirm-pack-price {
  font-size:1.2rem; font-weight:900;
  color:var(--ss-text,${C.gold});
}
.ss-confirm-body { padding:14px 16px; }
.ss-confirm-prizes-title {
  font-size:0.68rem; font-weight:700; letter-spacing:0.8px;
  color:${C.muted}; text-transform:uppercase; margin-bottom:8px;
}
.ss-confirm-prize-item {
  display:flex; align-items:flex-start; gap:7px; margin-bottom:6px;
}
.ss-confirm-prize-dot {
  width:5px; height:5px; border-radius:50%;
  background:var(--ss-accent,${C.gold});
  flex-shrink:0; margin-top:5px;
}
.ss-confirm-prize-text {
  font-size:0.8rem; color:${C.text}; line-height:1.4;
}

/* Expandable odds section in confirm dialog */
.ss-expand-row {
  display:flex; align-items:center; justify-content:space-between;
  padding:11px 0; cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  border-top:1px solid ${C.border};
}
.ss-expand-label {
  font-size:0.78rem; font-weight:700; color:${C.muted};
  display:flex; align-items:center; gap:6px;
}
.ss-expand-arrow {
  font-size:0.7rem; color:${C.muted};
  transition:transform 0.18s;
}
.ss-expand-arrow.open { transform:rotate(180deg); }
.ss-expand-content {
  overflow:hidden; transition:max-height 0.25s ease, opacity 0.2s;
  max-height:0; opacity:0;
}
.ss-expand-content.open { max-height:400px; opacity:1; }
.ss-mini-odds-row {
  display:flex; justify-content:space-between;
  padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04);
}
.ss-mini-odds-row:last-child { border-bottom:none; }
.ss-mini-odds-tier { font-size:0.75rem; color:${C.muted}; }
.ss-mini-odds-val  { font-size:0.75rem; color:${C.gold}; font-weight:700; }

/* Legend Bundle disclosure block */
.ss-legend-warn {
  margin:12px 0; padding:12px;
  background:rgba(245,158,11,0.08);
  border:1px solid rgba(245,158,11,0.3);
  border-radius:10px;
  animation:ssSlideUp 0.22s ease;
}
.ss-legend-warn-title {
  font-size:0.72rem; font-weight:800; letter-spacing:0.5px;
  color:${C.warn}; margin-bottom:6px;
  display:flex; align-items:center; gap:5px;
}
.ss-legend-warn-body {
  font-size:0.78rem; color:${C.text}; line-height:1.5;
}
.ss-legend-ack-row {
  display:flex; align-items:flex-start; gap:10px;
  padding:12px; background:${C.bg2};
  border:1px solid ${C.border}; border-radius:10px;
  margin-top:10px; cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.ss-legend-ack-label {
  font-size:0.8rem; color:${C.text}; line-height:1.5; flex:1;
}
.ss-confirm-actions {
  display:flex; gap:10px; padding:14px 16px 0;
}
.ss-cancel-btn {
  flex:1; min-height:50px;
  display:flex; align-items:center; justify-content:center;
  border:1px solid ${C.borderMid}; border-radius:10px; cursor:pointer;
  font-family:${FONT}; font-size:0.88rem; font-weight:700;
  color:${C.muted}; background:none;
  transition:background 0.15s;
  -webkit-tap-highlight-color:transparent;
}
.ss-cancel-btn:hover { background:rgba(255,255,255,0.05); }
.ss-proceed-btn {
  flex:2; min-height:50px;
  display:flex; align-items:center; justify-content:center;
  border:none; border-radius:10px; cursor:pointer;
  font-family:${FONT}; font-size:0.88rem; font-weight:800;
  letter-spacing:0.3px; color:#050810;
  background:var(--ss-accent,${C.gold});
  transition:opacity 0.15s, transform 0.1s;
  -webkit-tap-highlight-color:transparent;
}
.ss-proceed-btn:disabled { opacity:0.35; cursor:not-allowed; }
.ss-proceed-btn:not(:disabled):active { transform:scale(0.98); }
.ss-type-note {
  text-align:center; font-size:0.7rem; color:${C.muted};
  padding:10px 16px 16px; line-height:1.5;
}

/* Processing screen */
.ss-processing {
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  min-height:200px; padding:32px 16px;
  gap:16px; animation:ssFadeIn 0.2s ease;
}
.ss-spinner {
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(255,215,0,0.15);
  border-top-color:${C.gold};
  animation:ssSpin 0.9s linear infinite;
}
.ss-processing-title {
  font-size:1.0rem; font-weight:700; color:${C.text};
}
.ss-processing-sub {
  font-size:0.8rem; color:${C.muted}; text-align:center;
  line-height:1.5;
}

/* Success screen */
.ss-success {
  display:flex; flex-direction:column;
  align-items:center; padding:24px 16px;
  gap:12px; animation:ssFadeIn 0.25s ease;
}
.ss-success-icon {
  font-size:3rem;
  animation:ssSuccessBounce 0.5s ease;
}
.ss-success-title {
  font-size:1.1rem; font-weight:800;
  color:${C.text}; text-align:center;
}
.ss-success-sub {
  font-size:0.82rem; color:${C.muted};
  text-align:center; line-height:1.6;
  max-width:300px;
}
.ss-success-unlocks {
  background:${C.bg2}; border:1px solid ${C.border};
  border-radius:10px; padding:12px; width:100%;
}
.ss-success-unlock-row {
  display:flex; align-items:center; gap:8px;
  margin-bottom:7px;
}
.ss-success-unlock-row:last-child { margin-bottom:0; }
.ss-success-check { color:${C.success}; font-size:0.9rem; }
.ss-success-unlock-text { font-size:0.8rem; color:${C.text}; }

/* Error screen */
.ss-error {
  display:flex; flex-direction:column;
  align-items:center; padding:28px 16px;
  gap:12px; animation:ssFadeIn 0.22s ease;
}
.ss-error-icon  { font-size:2.6rem; }
.ss-error-title {
  font-size:1.0rem; font-weight:800;
  color:${C.error}; text-align:center;
}
.ss-error-msg {
  font-size:0.8rem; color:${C.muted};
  text-align:center; line-height:1.5; max-width:300px;
}
.ss-error-actions {
  display:flex; gap:10px; width:100%; margin-top:4px;
}

/* Shop footer */
.ss-footer {
  border-top:1px solid ${C.border};
  padding:12px 14px;
  display:flex; flex-direction:column;
  align-items:center; gap:8px;
  flex-shrink:0;
  width:100%; max-width:480px;
}
.ss-restore-btn {
  min-height:44px; min-width:44px;
  display:flex; align-items:center; justify-content:center; gap:7px;
  background:none; border:1px solid ${C.border};
  border-radius:8px; cursor:pointer; padding:0 16px;
  font-family:${FONT}; font-size:0.78rem; font-weight:600;
  color:${C.muted};
  transition:color 0.15s, border-color 0.15s, background 0.15s;
  -webkit-tap-highlight-color:transparent;
}
.ss-restore-btn:hover {
  color:${C.text}; border-color:${C.borderMid};
  background:rgba(255,255,255,0.04);
}
.ss-legal-note {
  font-size:0.62rem; color:${C.dim};
  text-align:center; line-height:1.5; max-width:380px;
}
.ss-legal-note a {
  color:rgba(255,255,255,0.3); text-decoration:underline; text-underline-offset:2px;
}
.ss-legal-note a:hover, .ss-legal-note a:focus {
  color:rgba(255,255,255,0.5); outline:none;
}
`;

function injectShopCSS() {
  if (document.getElementById('ss-styles')) return;
  const el = document.createElement('style');
  el.id = 'ss-styles';
  el.textContent = SS_CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 · AGE GATE SCREEN
// Full regulatory disclosure + age confirmation checkbox.
// Required before any pack can be viewed or purchased.
// Persisted in save schema v3 — shown only once per account.
// ─────────────────────────────────────────────────────────────────────────────
const AgeGateScreen = memo(function AgeGateScreen({ onConfirm, onViewOdds, onClose }) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="ss-age-gate">
      <div className="ss-age-icon">⚠️</div>
      <div className="ss-age-title">Before You Enter the Shop</div>
      <div className="ss-age-subtitle">
        This shop contains loot boxes — paid items with randomised rewards.
        Please read the following before continuing.
      </div>

      <div className="ss-info-box">
        <div className="ss-info-box-title">What You Need to Know</div>
        <div className="ss-info-row">
          <span className="ss-info-bullet">🎲</span>
          <span className="ss-info-text">Ticket packs contain randomised prizes awarded by chance.</span>
        </div>
        <div className="ss-info-row">
          <span className="ss-info-bullet">📋</span>
          <span className="ss-info-text">All prize odds are fully disclosed before every purchase.</span>
        </div>
        <div className="ss-info-row">
          <span className="ss-info-bullet">💰</span>
          <span className="ss-info-text">All prizes are in-game items only — no real money is awarded.</span>
        </div>
        <div className="ss-info-row">
          <span className="ss-info-bullet">🚛</span>
          <span className="ss-info-text">Fleet prizes go to your Prize Wallet if your truck cap is full — they never expire.</span>
        </div>
        <div className="ss-info-row">
          <span className="ss-info-bullet">🔒</span>
          <span className="ss-info-text">Purchases are processed securely by Apple or Google. We never see your payment details.</span>
        </div>
      </div>

      <div className="ss-odds-summary">
        <div className="ss-info-box-title" style={{ marginBottom: 8 }}>Odds Summary</div>
        <div className="ss-odds-summary-row">
          <span className="ss-odds-label">Overall win rate</span>
          <span className="ss-odds-val">{DISCLOSED_WIN_RATE}</span>
        </div>
        <div className="ss-odds-summary-row">
          <span className="ss-odds-label">Grand Jackpot ($5,000)</span>
          <span className="ss-odds-val">{DISCLOSED_JACKPOT_ODDS}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="ss-link-btn" onClick={onViewOdds}>
            📊 View Full Odds Disclosure →
          </button>
        </div>
      </div>

      <div
        className="ss-checkbox-row"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => setChecked(v => !v)}
        onKeyDown={e => e.key === ' ' && setChecked(v => !v)}
      >
        <div className={`ss-checkbox${checked ? ' checked' : ''}`}>
          {checked && <span style={{ color: '#050810', fontSize: '0.85rem', fontWeight: 900 }}>✓</span>}
        </div>
        <span className="ss-checkbox-label">
          I am <strong>18 years of age or older</strong> and I understand that this
          shop contains randomised loot box purchases with disclosed odds.
        </span>
      </div>

      {/* ── AGE RATING + COPPA NOTICE (A6, A7, G4) ───────────────────────────
          Apple ASG 5.1.1(v): apps with loot boxes / IAP must not be targeted at
          or accessible to children under 13. ESRB rating 17+ / PEGI 18.
          Google Play Families Policy: apps with paid randomised items cannot
          participate in the Families programme or be accessible to children.
          Under-13 users must not be able to enter this shop.
      ── */}
      <div style={{
        marginTop: 10,
        padding: '10px 12px',
        background: 'rgba(255,100,0,0.06)',
        border: '0.5px solid rgba(255,100,0,0.2)',
        borderRadius: 8,
        fontSize: '0.72rem',
        color: 'rgba(255,255,255,0.45)',
        lineHeight: 1.55,
        textAlign: 'left',
      }}>
        <strong style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 3 }}>
          ⚠️ Age Restriction — 17+ Only
        </strong>
        This shop contains randomised loot box purchases (paid items with random
        rewards). This feature is rated{' '}
        <strong style={{ color: 'rgba(255,255,255,0.6)' }}>17+</strong>{' '}
        by ESRB and <strong style={{ color: 'rgba(255,255,255,0.6)' }}>PEGI 18</strong>.
        If you are under 17, please exit now.{' '}
        Purchases are not available to players under 13.{' '}
        Parental controls are available through your device settings.
      </div>

      <button
        className="ss-confirm-btn"
        disabled={!checked}
        onClick={() => checked && onConfirm()}
      >
        Enter the Scratch Shop
      </button>

      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <button className="ss-link-btn" style={{ color: C.muted }} onClick={onClose}>
          No thanks — go back
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 · ODDS DISCLOSURE SCREEN
// Full disclosed odds table with scroll-to-bottom gate.
// Google Play compliance: player must scroll to bottom before closing.
// Apple recommendation: links to hosted odds page.
// ─────────────────────────────────────────────────────────────────────────────
const OddsScreen = memo(function OddsScreen({ onBack, onAcknowledge, alreadyAcknowledged }) {
  const [scrolledToBottom, setScrolledToBottom] = useState(alreadyAcknowledged);
  const scrollRef = useRef(null);
  const oddsRows  = useMemo(() => getOddsTableForDisplay(), []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) setScrolledToBottom(true);
  }, []);

  return (
    <div className="ss-odds-screen">
      <div className="ss-odds-intro">
        The following odds apply to all Box Truck Boss scratch-off tickets,
        regardless of which pack they came from. Odds are fixed and are not
        affected by previous outcomes, player level, or any other factor.
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ overflowY: 'auto', maxHeight: '45vh', marginBottom: 12 }}
      >
        <table className="ss-odds-table">
          <thead>
            <tr>
              <th>Prize Tier</th>
              <th>In-Game Cash</th>
              <th>Odds</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {oddsRows.map(row => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.cashRange}</td>
                <td style={{ fontFamily: MONO }}>{row.oddsDisplay}</td>
                <td style={{ fontFamily: MONO }}>{row.probability}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ss-total-row">
          <div className="ss-total-label">OVERALL WIN RATE</div>
          <div className="ss-total-val">{DISCLOSED_WIN_RATE}</div>
        </div>

        <div className="ss-total-row" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="ss-total-label">GRAND JACKPOT ODDS</div>
          <div className="ss-total-val">{DISCLOSED_JACKPOT_ODDS}</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="ss-info-box">
            <div className="ss-info-box-title">Important Notes</div>
            <div className="ss-info-row">
              <span className="ss-info-bullet">📌</span>
              <span className="ss-info-text">
                Consumable pack prize floors: Day-One Pack guarantees a minimum of
                $15,000 in-game cash across all 6 tickets. Road Boss Pack guarantees
                a minimum of $25,000 across all 19 tickets. The floor is enforced
                progressively — the system monitors cumulative payouts across all
                tickets and adjusts later tickets as needed to ensure the minimum
                is always met, with no single forced payout exceeding $5,000.
              </span>
            </div>
            <div className="ss-info-row">
              <span className="ss-info-bullet">📌</span>
              <span className="ss-info-text">
                Non-consumable packs (Starter Bundle, Legend Bundle) include fixed
                guaranteed prizes applied immediately on purchase, independent of
                scratch-off ticket outcomes.
              </span>
            </div>
            <div className="ss-info-row">
              <span className="ss-info-bullet">🆓</span>
              <span className="ss-info-text">
                <strong>ELD Malfunction</strong> and <strong>Paper Log</strong> are free daily cards available to all players —
                no purchase required. These compliance-focused cards teach federal ELD regulations
                and hours-of-service logging, knowledge every commercial driver needs.
              </span>
            </div>
            <div className="ss-info-row">
              <span className="ss-info-bullet">📌</span>
              <span className="ss-info-text">
                All prizes are in-game only. Special Prize tier includes
                non-cash awards such as Fuel Cards, Broker Network Unlocks,
                Golden Rate Cons, and Truck Vouchers.
              </span>
            </div>
          </div>
        </div>

        <div className="ss-url-box">
          <div>
            <div className="ss-url-label">Full odds disclosure also available at:</div>
            <div className="ss-url-val">boxtruckboss.com/odds</div>
          </div>
        </div>

        {/* Spacer to ensure scroll is detectable */}
        <div style={{ height: 8 }} />
      </div>

      <div
        className={`ss-scroll-hint${scrolledToBottom ? ' done' : ''}`}
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {scrolledToBottom
          ? '✓ You have read the odds disclosure'
          : '↓ Scroll to the bottom to continue'}
      </div>

      <button
        className="ss-confirm-btn"
        disabled={!scrolledToBottom}
        onClick={onAcknowledge}
        style={{ marginBottom: 12 }}
      >
        {alreadyAcknowledged ? 'Close Odds Disclosure' : 'I Have Read the Odds'}
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 · PACK CARD COMPONENT
// Renders a single IAP pack card in the main shop listing.
// Shows odds summary, guaranteed prizes, cascade inclusions, prize floor.
// ─────────────────────────────────────────────────────────────────────────────

// ── Daily Bonus Deal — deterministic day-of-week rotation ─────────────────────
// Returns { label, description, apply(setters) } for the given packId on current day.
// The price NEVER changes — the bonus is extra virtual content added to the purchase.
// apply(setters) is called inside applyPackPurchaseLocally when the pack is bought today.
// Transient: never written to iapPurchases or save state.
function getDailyBonus(packId) {
  const day = new Date().getDay(); // 0=Sun,1=Mon,...,6=Sat
  const schedule = [
    // Sun: Road Boss → +1 Dead Haul Special ticket (prestige rarity)
    { packId: PRODUCT_IDS.ROADBOSS_PACK,  label: 'SUNDAY BONUS', desc: '+1 Dead Haul Special ticket (prestige rarity)',
      apply: (s) => s.setTicketQueue(q => [...q, { id: 'bonus-dhs-' + Date.now(), tierId: 'dead_haul_special', packId: PRODUCT_IDS.ROADBOSS_PACK, addedAt: Date.now(), played: false, availableAt: 0 }]) },
    // Mon: Starter → +$2,500 bonus cash
    { packId: PRODUCT_IDS.STARTER_BUNDLE, label: 'MONDAY BONUS', desc: '+$2,500 bonus in-game cash',
      apply: (s) => typeof s.setCash === 'function' && s.setCash(c => c + 2500) },
    // Tue: Day-One → +2 Haul Ticket plays
    { packId: PRODUCT_IDS.DAYONE_PACK,    label: 'TUESDAY BONUS', desc: '+2 bonus Haul Ticket plays',
      apply: (s) => { const now = Date.now(); s.setTicketQueue(q => [...q,
        { id: 'bonus-ht1-' + now, tierId: 'haul_ticket', packId: PRODUCT_IDS.DAYONE_PACK, addedAt: now, played: false, availableAt: 0 },
        { id: 'bonus-ht2-' + now, tierId: 'haul_ticket', packId: PRODUCT_IDS.DAYONE_PACK, addedAt: now + 1, played: false, availableAt: 0 },
      ]); } },
    // Wed: Road Boss → +1 Prime Rate Pull ticket
    { packId: PRODUCT_IDS.ROADBOSS_PACK,  label: 'WEDNESDAY BONUS', desc: '+1 Prime Rate Pull ticket',
      apply: (s) => s.setTicketQueue(q => [...q, { id: 'bonus-prp-' + Date.now(), tierId: 'prime_rate_pull', packId: PRODUCT_IDS.ROADBOSS_PACK, addedAt: Date.now(), played: false, availableAt: 0 }]) },
    // Thu: Starter → +3-day Double XP
    { packId: PRODUCT_IDS.STARTER_BUNDLE, label: 'THURSDAY BONUS', desc: '+3-day Double XP boost',
      apply: (s) => typeof s.setXpBoostExpiresAt === 'function' && s.setXpBoostExpiresAt(prev => Math.max(prev || 0, Date.now()) + 3 * 86400000) },
    // Fri: Day-One → +1 Silver Mile ticket
    { packId: PRODUCT_IDS.DAYONE_PACK,    label: 'FRIDAY BONUS', desc: '+1 Silver Mile ticket',
      apply: (s) => s.setTicketQueue(q => [...q, { id: 'bonus-sm-' + Date.now(), tierId: 'silver_mile', packId: PRODUCT_IDS.DAYONE_PACK, addedAt: Date.now(), played: false, availableAt: 0 }]) },
    // Sat: Road Boss → +$5,000 bonus cash
    { packId: PRODUCT_IDS.ROADBOSS_PACK,  label: 'SATURDAY BONUS', desc: '+$5,000 bonus in-game cash',
      apply: (s) => typeof s.setCash === 'function' && s.setCash(c => c + 5000) },
  ];
  const entry = schedule[day];
  if (!entry || entry.packId !== packId) return null;
  return { label: entry.label, desc: entry.desc, apply: entry.apply };
}

const PackCard = memo(function PackCard({
  pack,
  isOwned,         // non-consumable already purchased
  dailyBonus,      // { label, desc } | null — today's bonus for this pack
  onBuy,
  onViewOdds,
}) {
  const accent = PACK_ACCENTS[pack.id] || { main: C.gold, glow: C.goldFaint, text: C.gold };

  // Summarise ticket manifest for display
  const ticketCounts = useMemo(() => {
    const counts = {};
    (pack.tickets || []).forEach(t => {
      const label = t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([label, count]) => `${count} × ${label}`);
  }, [pack.tickets]);

  // Convert ticket count to a friendly summary string
  const ticketTotal = pack.tickets?.length || 0;
  const ticketSuffix = pack.id === PRODUCT_IDS.LEGEND_BUNDLE ? ' (1/day for 30 days)' : '';

  const cssVars = {
    '--ss-accent': accent.main,
    '--ss-accent-border': `${accent.main}40`,
    '--ss-glow': accent.glow,
    '--ss-text': accent.text,
    '--ss-rgb': hexToRgb(accent.main),
  };

  return (
    <div className="ss-pack-card" style={cssVars}>
      {/* Card header */}
      <div className="ss-pack-header">
        <div className="ss-pack-badge">{pack.badgeLabel}</div>
        <div className="ss-pack-name">{pack.displayName}</div>
        <div className="ss-pack-price">{pack.price}</div>
      </div>

      {/* Card body */}
      <div className="ss-pack-body">
        <div className="ss-pack-desc">{pack.description}</div>

        {/* ── Road Boss Scratch Slot Highlight ── */}
        {pack.id === PRODUCT_IDS.ROADBOSS_PACK && (
          <div style={{
            marginBottom: 8, padding: '8px 12px', borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(var(--ss-rgb),0.12), rgba(var(--ss-rgb),0.06))',
            border: '1.5px solid rgba(var(--ss-rgb),0.40)',
            display: 'flex', alignItems: 'center', gap: 9,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{'\uD83C\uDF9F\uFE0F'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--ss-text)', letterSpacing: 0.3 }}>
                2 Free Scratches Every Day — Forever
              </div>
              <div style={{ fontSize: '0.65rem', color: C.muted, marginTop: 2, lineHeight: 1.4 }}>
                Road Boss permanently unlocks a 2nd daily free scratch slot in the Arcade Hub
              </div>
            </div>
          </div>
        )}

        {/* Ticket manifest */}
        <div style={{ marginBottom: 8 }}>
          <div className="ss-info-box-title" style={{ marginBottom: 5 }}>
            Includes ({ticketTotal} Tickets{ticketSuffix})
          </div>
          <div className="ss-ticket-chips">
            {ticketCounts.map(tc => (
              <span key={tc} className="ss-ticket-chip">{tc}</span>
            ))}
          </div>
        </div>

        {/* Guaranteed prizes */}
        {(pack.guaranteedPrizes || []).length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div className="ss-info-box-title" style={{ marginBottom: 5 }}>
              Guaranteed
            </div>
            {pack.guaranteedPrizes.map((p, i) => (
              <div key={i} className="ss-prize-row">
                <div className="ss-prize-dot" />
                <div className="ss-prize-text">{p.description}</div>
              </div>
            ))}
          </div>
        )}


        {/* Cascade pack inclusions — Road Boss gets Starter, Legend gets all 3 */}
        {(pack.cascadePackIds || []).length > 0 && (() => {
          const cascadeNames = {
            [PRODUCT_IDS.STARTER_BUNDLE]: { name: 'Starter Bundle', price: '$1.99', icon: '🥇',
              summary: '8 tickets · $2,500 cash · badge · 2% fuel discount' },
            [PRODUCT_IDS.DAYONE_PACK]:    { name: 'Day-One Pack',   price: '$4.99', icon: '🎁',
              summary: '11 tickets · truck voucher · XP boost' },
            [PRODUCT_IDS.ROADBOSS_PACK]:  { name: 'Road Boss Pack', price: '$9.99', icon: '🚛',
              summary: '19 tickets · broker network · scratch slot' },
          };
          const totalSaved = (pack.cascadePackIds || []).reduce((sum, id) => {
            const info = cascadeNames[id];
            return sum + (info ? parseFloat(info.price.replace('$','')) : 0);
          }, 0);
          return (
            <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(var(--ss-rgb),0.06)', border: '1px solid rgba(var(--ss-rgb),0.2)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--ss-text)',
                letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>
                📦 Also Includes — ${totalSaved.toFixed(2)} in Value FREE
              </div>
              {(pack.cascadePackIds || []).map(cascadeId => {
                const info = cascadeNames[cascadeId];
                if (!info) return null;
                return (
                  <div key={cascadeId} style={{ display: 'flex', alignItems: 'flex-start',
                    gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{info.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700,
                        color: 'var(--ss-text)', letterSpacing: 0.3 }}>
                        {info.name}
                        <span style={{ fontSize: '0.65rem', fontWeight: 400,
                          color: C.muted, marginLeft: 5 }}>(normally {info.price})</span>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: C.dim2, marginTop: 1 }}>
                        {info.summary}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: C.success,
                      fontWeight: 800, flexShrink: 0 }}>FREE</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Daily Bonus Deal — shows when today's bonus applies to this pack ── */}
        {dailyBonus && (
          <div style={{
            marginBottom: 8, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(var(--ss-rgb),0.10)',
            border: '1.5px solid rgba(var(--ss-rgb),0.45)',
            animation: 'ssBonusPulse 2.4s ease-in-out infinite',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 900,
                background: 'var(--ss-text)', color: '#050810',
                padding: '2px 7px', borderRadius: 20, letterSpacing: 1 }}>
                {dailyBonus.label}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--ss-text)', fontWeight: 700,
                letterSpacing: 0.5 }}>TODAY ONLY</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ss-text)', fontWeight: 600,
              lineHeight: 1.4 }}>{dailyBonus.desc}</div>
            <div style={{ fontSize: '0.62rem', color: C.muted, marginTop: 2 }}>
              Automatically applied when you purchase today. Price unchanged.
            </div>
          </div>
        )}

        {/* Prize floor note for consumables */}
        {pack.prizeFloor && (
          <div className="ss-floor-note">
            🛡️ Guaranteed floor: ${pack.prizeFloor.toLocaleString()} in-game cash
            minimum across all {ticketTotal} tickets
          </div>
        )}

        {/* Pack type note */}
        <div className="ss-divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.7rem', color: C.muted }}>
            {pack.type === 'non_consumable'
              ? '🔒 One-time purchase · Never expires'
              : '🔄 Consumable · Purchase multiple times'}
          </span>
        </div>

        {/* Odds disclosure summary — legally required on pack card */}
        <div className="ss-odds-badge">
          <span>📊 Win rate: {DISCLOSED_WIN_RATE}</span>
          <span>·</span>
          <span>Jackpot: {DISCLOSED_JACKPOT_ODDS}</span>
          <button className="ss-odds-link" onClick={onViewOdds} style={{ fontSize: '0.68rem' }}>
            Full Odds
          </button>
        </div>

        {/* Buy button or owned state */}
        {isOwned ? (
          <div className="ss-owned-banner">✓ PURCHASED — ACTIVE ON YOUR ACCOUNT</div>
        ) : (
          <button className="ss-buy-btn" onClick={() => onBuy(pack.id)}>
            Buy Now — {pack.price}
          </button>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 · PURCHASE CONFIRM DIALOG
// Bottom sheet with full prize details, expandable odds, and (for Legend
// Bundle on capped editions) the Option B tap-to-confirm acknowledgment.
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmDialog = memo(function ConfirmDialog({
  pack,
  edition,
  onCancel,
  onConfirm,          // onConfirm(legendAcknowledged: boolean)
  processing,
}) {
  const [oddsOpen,       setOddsOpen]       = useState(false);
  const [legendAck,      setLegendAck]      = useState(false);

  const needsEditionDisclosure = requiresEditionDisclosure(pack.id, edition);
  const disclosureText         = getEditionDisclosureText(pack.id);
  const accent                 = PACK_ACCENTS[pack.id] || { main: C.gold, glow: C.goldFaint, text: C.gold };
  const oddsRows               = useMemo(() => getOddsTableForDisplay(), []);

  const canProceed = processing
    ? false
    : needsEditionDisclosure
      ? legendAck
      : true;

  const cssVars = {
    '--ss-accent': accent.main,
    '--ss-glow':   accent.glow,
    '--ss-text':   accent.text,
    '--ss-rgb':    hexToRgb(accent.main),
  };

  const packIcon = {
    [PRODUCT_IDS.STARTER_BUNDLE]: '🥇',
    [PRODUCT_IDS.DAYONE_PACK]:    '🎁',
    [PRODUCT_IDS.ROADBOSS_PACK]:  '🚛',
    [PRODUCT_IDS.LEGEND_BUNDLE]:  '👑',
  }[pack.id] || '🎟️';

  return (
    <div className="ss-confirm-overlay" onClick={e => e.target === e.currentTarget && !processing && onCancel()}>
      <div className="ss-confirm-sheet" style={cssVars}>
        <div className="ss-confirm-handle" />

        {/* Pack header */}
        <div className="ss-confirm-pack-header">
          <div className="ss-confirm-pack-icon">{packIcon}</div>
          <div className="ss-confirm-pack-name">{pack.displayName}</div>
          <div className="ss-confirm-pack-price">{pack.price}</div>
        </div>

        {/* Body */}
        <div className="ss-confirm-body">

          {/* Prizes list */}
          <div className="ss-confirm-prizes-title">You Will Receive</div>
          <div style={{ marginBottom: 4 }}>
            <div className="ss-confirm-prize-item">
              <div className="ss-confirm-prize-dot" />
              <div className="ss-confirm-prize-text">
                <strong>{pack.tickets?.length || 0}</strong> scratch-off ticket{pack.tickets?.length !== 1 ? 's' : ''}
                {pack.id === PRODUCT_IDS.LEGEND_BUNDLE ? ' (delivered daily, 1 per day)' : ''}
              </div>
            </div>
            {(pack.guaranteedPrizes || []).map((p, i) => (
              <div key={i} className="ss-confirm-prize-item">
                <div className="ss-confirm-prize-dot" />
                <div className="ss-confirm-prize-text">{p.description}</div>
              </div>
            ))}

            {/* Cascade pack inclusions shown in confirm dialog */}
            {(pack.cascadePackIds || []).length > 0 && (() => {
              const packMeta = {
                [PRODUCT_IDS.STARTER_BUNDLE]: { name: 'Starter Bundle ($1.99)',   tickets: 8,  icon: '🥇' },
                [PRODUCT_IDS.DAYONE_PACK]:    { name: 'Day-One Pack ($4.99)',     tickets: 11, icon: '🎁' },
                [PRODUCT_IDS.ROADBOSS_PACK]:  { name: 'Road Boss Pack ($9.99)',   tickets: 19, icon: '🚛' },
              };
              return (pack.cascadePackIds || []).map(cascadeId => {
                const meta = packMeta[cascadeId];
                if (!meta) return null;
                return (
                  <div key={cascadeId} className="ss-confirm-prize-item">
                    <div className="ss-confirm-prize-dot" style={{ background: C.success }} />
                    <div className="ss-confirm-prize-text" style={{ color: C.success }}>
                      {meta.icon} {meta.name} — {meta.tickets} tickets included FREE
                    </div>
                  </div>
                );
              });
            })()}

            {pack.prizeFloor && (
              <div className="ss-confirm-prize-item">
                <div className="ss-confirm-prize-dot" style={{ background: C.success }} />
                <div className="ss-confirm-prize-text" style={{ color: C.success }}>
                  Guaranteed minimum ${pack.prizeFloor.toLocaleString()} in-game cash
                </div>
              </div>
            )}
          </div>

          {/* Legend Bundle edition disclosure — Option B */}
          {needsEditionDisclosure && disclosureText && (
            <>
              <div className="ss-legend-warn">
                <div className="ss-legend-warn-title">⚠️ Fleet Capacity Notice</div>
                <div className="ss-legend-warn-body">{disclosureText}</div>
              </div>
              <div
                className="ss-legend-ack-row"
                role="checkbox"
                aria-checked={legendAck}
                tabIndex={0}
                onClick={() => setLegendAck(v => !v)}
                onKeyDown={e => e.key === ' ' && setLegendAck(v => !v)}
              >
                <div className={`ss-checkbox${legendAck ? ' checked' : ''}`}
                  style={{ width: 22, height: 22 }}>
                  {legendAck && (
                    <span style={{ color: '#050810', fontSize: '0.85rem', fontWeight: 900 }}>✓</span>
                  )}
                </div>
                <span className="ss-legend-ack-label">
                  I understand that fleet prizes I cannot immediately use will be
                  held in my Prize Wallet and never expire.
                </span>
              </div>
            </>
          )}

          {/* Expandable odds section — UX best practice + legal requirement */}
          <div>
            <div
              className="ss-expand-row"
              role="button"
              tabIndex={0}
              onClick={() => setOddsOpen(v => !v)}
              onKeyDown={e => e.key === 'Enter' && setOddsOpen(v => !v)}
            >
              <span className="ss-expand-label">
                📊 View Odds Before Buying
              </span>
              <span className={`ss-expand-arrow${oddsOpen ? ' open' : ''}`}>▼</span>
            </div>
            <div className={`ss-expand-content${oddsOpen ? ' open' : ''}`}>
              <div style={{ paddingBottom: 8 }}>
                {oddsRows.map(row => (
                  <div key={row.label} className="ss-mini-odds-row">
                    <span className="ss-mini-odds-tier">{row.label}</span>
                    <span className="ss-mini-odds-val">{row.oddsDisplay} ({row.probability})</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: '0.7rem', color: C.muted }}>
                  Full disclosure: boxtruckboss.com/odds
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="ss-confirm-actions">
          <button className="ss-cancel-btn" onClick={onCancel} disabled={processing}>
            Cancel
          </button>
          <button
            className="ss-proceed-btn"
            disabled={!canProceed}
            onClick={() => onConfirm(legendAck)}
          >
            {processing
              ? '⏳ Processing...'
              : needsEditionDisclosure && !legendAck
                ? 'Confirm to Enable'
                : `Confirm — ${pack.price}`}
          </button>
        </div>

        <div className="ss-type-note">
          {pack.type === 'non_consumable'
            ? 'One-time purchase — you will be charged only once. Purchases managed by Apple or Google.'
            : 'Consumable purchase — can be bought again. Managed by Apple or Google.'}
          {' '}All prizes are <strong>in-game currency only</strong> — no real money is awarded.
          {' '}
          <a
            href="https://boxtruckboss.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'underline', fontSize: 'inherit' }}
            aria-label="Privacy Policy (opens in browser)"
          >Privacy Policy</a>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 · PROCESSING & SUCCESS & ERROR SCREENS
// ─────────────────────────────────────────────────────────────────────────────
const ProcessingScreen = memo(function ProcessingScreen() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div className="ss-processing" aria-live="assertive" aria-atomic="true">
      <div className="ss-spinner" />
      <div className="ss-processing-title">Processing Purchase</div>
      <div className="ss-processing-sub">
        Verifying with {isIOS ? 'Apple' : 'Google'}…{'\n'}
        Please do not close the app.
      </div>
      {/* Android hardware back-button warning (U1 — critical for Google Play) */}
      {!isIOS && (
        <div style={{
          marginTop: 14,
          padding: '8px 12px',
          background: 'rgba(255,200,0,0.07)',
          border: '0.5px solid rgba(255,200,0,0.2)',
          borderRadius: 8,
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.55,
          textAlign: 'center',
          maxWidth: 280,
          margin: '14px auto 0',
        }}>
          ⚠️ Do <strong style={{ color: 'rgba(255,255,255,0.7)' }}>not</strong> press
          the Back button while your purchase is being verified.
          Your payment may still be charged.
        </div>
      )}
    </div>
  );
});

const SuccessScreen = memo(function SuccessScreen({ pack, unlockedItems, onDone }) {
  return (
    <div className="ss-success">
      <div className="ss-success-icon">🎉</div>
      <div className="ss-success-title">Purchase Complete!</div>
      <div className="ss-success-sub">
        {pack.displayName} has been added to your account.
        {pack.id === PRODUCT_IDS.LEGEND_BUNDLE
          ? ' All four packs loaded — your first Legend ticket is ready now!'
          : pack.id === PRODUCT_IDS.ROADBOSS_PACK
            ? ' Road Boss + Starter Bundle loaded — 27 tickets ready to scratch!'
            : ' Your tickets are ready to scratch!'}
      </div>
      {unlockedItems.length > 0 && (
        <div className="ss-success-unlocks">
          {unlockedItems.map((item, i) => (
            <div key={i} className="ss-success-unlock-row">
              <span className="ss-success-check">✓</span>
              <span className="ss-success-unlock-text">{item}</span>
            </div>
          ))}
        </div>
      )}
      <button className="ss-confirm-btn" onClick={onDone} style={{ marginTop: 4 }}>
        Back to Shop
      </button>
    </div>
  );
});

const ErrorScreen = memo(function ErrorScreen({ message, onRetry, onDone }) {
  return (
    <div className="ss-error">
      <div className="ss-error-icon">❌</div>
      <div className="ss-error-title">Purchase Failed</div>
      <div className="ss-error-msg">{message}</div>
      <div className="ss-error-actions">
        <button className="ss-cancel-btn" onClick={onDone} style={{ flex: 1 }}>
          Cancel
        </button>
        {onRetry && (
          <button className="ss-confirm-btn" onClick={onRetry} style={{ flex: 2 }}>
            Try Again
          </button>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 · UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Convert hex colour string to "R,G,B" for CSS custom properties */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0,2), 16);
  const g = parseInt(h.substring(2,4), 16);
  const b = parseInt(h.substring(4,6), 16);
  return `${r},${g},${b}`;
}


/**
 * Build the list of "unlocked items" summary strings for the Success screen.
 * Called after a successful purchase so the player sees what they got.
 */
function buildUnlockSummary(pack) {
  const items = [];
  const ticketCount = pack.tickets?.length || 0;

  if (pack.id === PRODUCT_IDS.LEGEND_BUNDLE) {
    items.push(`${ticketCount} Legend Bundle tickets queued`);
    items.push('+ Full Starter Bundle — 8 tickets + $2,500 cash + badge + 2% fuel discount');
    items.push('+ Full Day-One Pack — 11 tickets + truck voucher + XP boost');
    items.push('+ Full Road Boss Pack — 19 tickets + broker network + scratch slot');
    items.push('Fleet Boss badge + Owner-Op Legend gate removed permanently');
    items.push('Kenworth T680 reserved — scratch Owner-Op Legend card to claim');
    items.push('$2,500 welcome cash · $30,000+ guaranteed in Legend winnings');
  } else if (pack.id === PRODUCT_IDS.ROADBOSS_PACK) {
    items.push(`${ticketCount} Road Boss Pack tickets added to your queue`);
    items.push('+ Full Starter Bundle included FREE — 8 tickets + $2,500 cash + 2% fuel discount + badge');
    items.push('Broker Network, Training Mode, 2nd scratch slot unlocked');
  } else if (pack.id === PRODUCT_IDS.DAYONE_PACK) {
    items.push(`${ticketCount} tickets added to your queue`);
    items.push('Truck Voucher — 50% off next Garage purchase');
    items.push('7-day Double XP + Day-One Driver badge');
  } else if (pack.id === PRODUCT_IDS.STARTER_BUNDLE) {
    items.push(`${ticketCount} Starter Bundle tickets — yours to keep forever`);
    items.push('BTB Supporter badge unlocked on Career Wall');
    items.push('Permanent 2% fuel discount on all loads');
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 · PRIZE APPLICATION HELPERS
// Applied locally in the client after server-side receipt validation succeeds.
// Phase 6 will add deeper App.jsx prize handlers for Golden Rate Con etc.
// These setters update the v3 IAP state in App.jsx via passed-in prop setters.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * applyPackPurchaseLocally(pack, setters, edition, truckCount, fleetExpansionTokens)
 * Updates all relevant v3 state after a confirmed purchase.
 * Returns an array of notification strings for App.jsx's addNotification.
 */
function applyPackPurchaseLocally(pack, setters, edition, truckCount, existingFleetTokens, dailyBonus) {
  const now = Date.now();
  const notifications = [];

  // 1. Add tickets to queue
  const newTickets = buildTicketQueue(pack.id, now);
  setters.setTicketQueue(prev => [...prev, ...newTickets]);

  // 2. (Skin system removed — no skin handling needed)


  // 3. Apply guaranteed prizes
  (pack.guaranteedPrizes || []).forEach(prize => {
    switch (prize.type) {
      case 'cash': {
        // Deliver cash immediately at purchase — no split across tickets.
        // This guarantees the advertised amount ($10K Starter, $100K Legend).
        const cashAmount = prize.amount || 0;
        if (cashAmount > 0 && typeof setters.setCash === 'function') {
          setters.setCash(c => c + cashAmount);
          notifications.push(`💵 $${cashAmount.toLocaleString()} in-game cash added to your account!`);
        }
        break;
      }

      case 'truck_voucher':
        setters.setTruckVouchers(prev => prev + 1);
        notifications.push(`🏷️ Truck Voucher added — 50% off your next Garage purchase!`);
        break;

      case 'fleet_expansion_token': {
        // Edition-aware: enterprise converts to cash (via Phase 6), others go to wallet
        if (edition === 'enterprise') {
          // Phase 6 will award the $10K cash conversion via addNotification in App.jsx
          notifications.push('💰 Fleet Expansion Token → converted to $10,000 in-game cash (Fleet Edition)');
        } else {
          setters.setFleetExpansionTokens(prev => prev + (prize.count || 1));
          notifications.push(`🔑 Fleet Expansion Token added to wallet — raises your truck cap by 1!`);
        }
        break;
      }

      case 'golden_rate_con':
        // B6 fix: call the App.jsx handler that creates the actual premium load
        // and injects it into the Dispatch Board (applyGoldenRateCon).
        if (typeof setters.onApplyGoldenRateCon === 'function') {
          setters.onApplyGoldenRateCon();
        }
        notifications.push('📋 Golden Rate Con added to your Dispatch Board — check your loads!');
        break;

      case 'truck_award_pending': {
        // Truck is reserved but NOT delivered at purchase.
        // It will be awarded when the LB player scratches Card 32 (Owner-Op Legend Premier).
        // OwnerOpLegendPremierCard.onComplete passes isTruck:true → App.jsx calls applyTruckAward.
        notifications.push(
          '🚛 Kenworth T680 reserved — scratch your Owner-Op Legend card to claim it!'
        );
        break;
      }

      case 'truck_award': {
        // Edition-aware: fleet edition grants immediately (Phase 6), capped editions → Prize Wallet
        const needsWallet = edition !== 'enterprise';
        if (needsWallet) {
          setters.setPrizeWallet(prev => [...prev, {
            prizeType: 'truck_award',
            prizeData: { truckId: prize.truckId },
            earnedAt:  now,
            packId:    pack.id,
            description: prize.description,
          }]);
          notifications.push('🚛 Kenworth T680 added to Prize Wallet — expand your fleet to claim it!');
        } else {
          notifications.push('🚛 Kenworth T680 awarded — check your Garage!');
        }
        break;
      }

      case 'remove_ool_gate':
        // B5 fix: call App.jsx's setIapOolGateRemoved(true) via the passed callback.
        if (typeof setters.onApplyOolGate === 'function') {
          setters.onApplyOolGate();
        }
        notifications.push('👑 Owner-Op Legend 30-day gate removed permanently!');
        break;

      case 'badge':
        notifications.push(`🏆 ${prize.badgeId === 'fleet_boss' ? 'Fleet Boss' : prize.badgeId === 'btb_supporter' ? 'BTB Supporter' : 'Day-One Driver'} badge unlocked on Career Wall!`);
        break;


      // ── v4 IAP Upgrade prize types ─────────────────────────────────────
      case 'permanent_fuel_discount': {
        const addPct = prize.discountPct || 0;
        if (typeof setters.setPermanentFuelDiscountPct === 'function') {
          setters.setPermanentFuelDiscountPct(prev => Math.min(40, (prev || 0) + addPct));
        }
        notifications.push(`⛽ Permanent ${addPct}% fuel discount applied to all future loads!`);
        break;
      }

      case 'xp_boost': {
        const days = prize.durationDays || 7;
        const newExpiry = Math.max(
          (setters._xpBoostExpiresAt || 0),
          Date.now()
        ) + days * 86400000;
        if (typeof setters.setXpBoostExpiresAt === 'function') {
          setters.setXpBoostExpiresAt(newExpiry);
        }
        notifications.push(`⭐ ${prize.multiplier || 2}× XP boost activated for ${days} days!`);
        break;
      }

      case 'broker_training':
        if (typeof setters.setBrokerTrainingUnlocked === 'function') {
          setters.setBrokerTrainingUnlocked(true);
        }
        notifications.push('🃏 Broker Negotiation Training Mode unlocked — hints visible during Poker!');
        break;

      case 'extra_scratch_slot':
        if (typeof setters.setMaxDailyScratchesAllowed === 'function') {
          setters.setMaxDailyScratchesAllowed(2);
        }
        notifications.push('🎰 2nd daily scratch slot unlocked permanently!');
        break;

      case 'cosmetic_tag': {
        const tierOrder = { starter: 1, day_one: 2, road_boss: 3, legend: 4 };
        const newTier = prize.tier || 'starter';
        if (typeof setters.setHighestIAPTier === 'function') {
          setters.setHighestIAPTier(prev => {
            const cur = tierOrder[prev] || 0;
            const inc = tierOrder[newTier] || 0;
            return inc > cur ? newTier : prev;
          });
        }
        const tagLabels = { starter: 'BTB Supporter', day_one: 'Day-One Driver', road_boss: 'Road Boss', legend: 'Legend Driver' };
        notifications.push(`🎖️ "${tagLabels[newTier] || newTier}" tag unlocked in dispatcher comms!`);
        break;
      }

      case 'streak_protection':
        // Granted via pack; actual usage is handled in the daily scratch gate
        notifications.push('🛡️ Streak Protection activated — 1 missed day per week won\'t break your streak!');
        break;

      case 'broker_network_permanent':
        if (typeof setters.setBrokerNetworkPermanent === 'function') {
          setters.setBrokerNetworkPermanent(true);
        }
        notifications.push('📋 Broker Network permanently unlocked — premium loads always visible!');
        break;

      default:
        break;
    }
  });

  // ── 3b. Cascade packs — add tickets + apply guaranteed prizes for each ─────────
  // Road Boss  → also grants full Starter Bundle
  // Legend     → also grants Starter + Day-One + Road Boss in full
  (pack.cascadePackIds || []).forEach(cascadePackId => {
    const cascadePack = PACKS[cascadePackId];
    if (!cascadePack) return;

    // Add cascaded pack's tickets to the queue
    const cascadeTickets = buildTicketQueue(cascadePackId, now);
    setters.setTicketQueue(prev => [...prev, ...cascadeTickets]);

    // Apply cascaded pack's guaranteed prizes
    (cascadePack.guaranteedPrizes || []).forEach(prize => {
      switch (prize.type) {
        case 'cash':
          if (typeof setters.setCash === 'function') setters.setCash(c => c + (prize.amount || 0));
          notifications.push(`💵 +$${(prize.amount || 0).toLocaleString()} in-game cash (${cascadePack.displayName})`);
          break;
        case 'truck_voucher':
          if (typeof setters.setTruckVouchers === 'function') setters.setTruckVouchers(n => n + 1);
          notifications.push(`🎟️ Truck Voucher — ${prize.discountPct || 50}% off next truck (${cascadePack.displayName})`);
          break;
        case 'fleet_expansion_token':
          if (typeof setters.setFleetExpansionTokens === 'function')
            setters.setFleetExpansionTokens(prev => prev + (prize.count || 1));
          notifications.push(`🔓 ${prize.count || 1}× Fleet Expansion Token (${cascadePack.displayName})`);
          break;
        case 'permanent_fuel_discount': {
          const addPct = prize.discountPct || 0;
          if (typeof setters.setPermanentFuelDiscountPct === 'function')
            setters.setPermanentFuelDiscountPct(prev => Math.min(40, (prev || 0) + addPct));
          notifications.push(`⛽ +${addPct}% permanent fuel discount (${cascadePack.displayName})`);
          break;
        }
        case 'badge':
          notifications.push(`🏆 ${prize.badgeId === 'btb_supporter' ? 'BTB Supporter' : prize.badgeId === 'day_one_driver' ? 'Day-One Driver' : prize.badgeId} badge unlocked (${cascadePack.displayName})`);
          break;
        case 'cosmetic_tag': {
          const tierOrder = { starter: 1, day_one: 2, road_boss: 3, legend: 4 };
          const newTier = prize.tier || 'starter';
          if (typeof setters.setHighestIAPTier === 'function') {
            setters.setHighestIAPTier(prev => {
              const cur = tierOrder[prev] || 0;
              const inc = tierOrder[newTier] || 0;
              return inc > cur ? newTier : prev;
            });
          }
          break;
        }
        case 'xp_boost': {
          const days = prize.durationDays || 7;
          const newExpiry = Math.max((setters._xpBoostExpiresAt || 0), Date.now()) + days * 86400000;
          if (typeof setters.setXpBoostExpiresAt === 'function') setters.setXpBoostExpiresAt(newExpiry);
          notifications.push(`⭐ ${prize.multiplier || 2}× XP boost for ${days} days (${cascadePack.displayName})`);
          break;
        }
        case 'broker_training':
          if (typeof setters.setBrokerTrainingUnlocked === 'function') setters.setBrokerTrainingUnlocked(true);
          notifications.push(`🃏 Broker Training Mode unlocked (${cascadePack.displayName})`);
          break;
        case 'extra_scratch_slot':
          if (typeof setters.setMaxDailyScratchesAllowed === 'function') setters.setMaxDailyScratchesAllowed(2);
          notifications.push(`🎰 2nd daily scratch slot unlocked (${cascadePack.displayName})`);
          break;
        case 'streak_protection':
          notifications.push(`🛡️ Streak Protection activated (${cascadePack.displayName})`);
          break;
        case 'broker_network_unlock': {
          const days2 = prize.durationDays || 7;
          const expiry2 = Date.now() + days2 * 86400000;
          if (typeof setters.setBrokerNetworkExpiry === 'function') setters.setBrokerNetworkExpiry(expiry2);
          notifications.push(`📋 Broker Network unlocked for ${days2} days (${cascadePack.displayName})`);
          break;
        }
        case 'golden_rate_con':
          if (typeof setters.setGoldenRateConQueue === 'function')
            setters.setGoldenRateConQueue(prev => [...prev, { addedAt: now, source: cascadePack.id }]);
          notifications.push(`⭐ Golden Rate Con load added (${cascadePack.displayName})`);
          break;
        default:
          break;
      }
    });

    notifications.push(`📦 ${cascadePack.displayName} included — ${cascadeTickets.length} tickets added!`);
  });

  // 4. Log purchase receipt reference
  setters.setIapPurchases(prev => [...prev, {
    packId:               pack.id,
    packName:             pack.displayName,
    purchasedAt:          now,
    ticketCount:          newTickets.length,
    cumulativeCashPayout: 0,  // B2 fix: initialized to 0; incremented by handleIAPScratchComplete
  }]);

  // Apply today's daily bonus (transient — not written to iapPurchases)
  if (dailyBonus && typeof dailyBonus.apply === 'function') {
    try {
      dailyBonus.apply(setters);
      notifications.push('\uD83C\uDF81 Today\'s bonus applied: ' + dailyBonus.desc);
    } catch (_e) { /* fail silently — bonus is non-critical */ }
  }

  return notifications;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 · MAIN SCRATCHSHOP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScratchShop
 * Main shop component. Handles all screen transitions and purchase flow.
 * Wrapped in React.memo for performance — only re-renders on prop changes.
 */
const ScratchShop = memo(function ScratchShop({
  // Navigation
  onClose,
  // v3 IAP state (all from App.jsx)
  iapAgeConfirmed       = false,
  setIapAgeConfirmed,
  iapOddsAcknowledged   = false,
  setIapOddsAcknowledged,
  iapPurchases          = [],
  setIapPurchases,
  ticketQueue           = [],
  setTicketQueue,
  truckVouchers         = 0,
  setTruckVouchers,
  prizeWallet           = [],
  setPrizeWallet,
  fuelCardExpiry        = null,
  setFuelCardExpiry,
  brokerNetworkExpiry   = null,
  setBrokerNetworkExpiry,
  fleetExpansionTokens  = 0,
  setFleetExpansionTokens,
  goldenRateConQueue    = [],
  setGoldenRateConQueue,
  // Game state (read-only)
  selectedEdition       = 'demo',
  truckStatus           = [],
  cash                  = 0,
  currentDay            = 1,
  level                 = 1,
  prestigeLevel         = 0,
  // App.jsx helpers
  addNotification,
  currentUser           = null,
  // Phase 5 hooks (stubbed until Capacitor IAP plugin is wired)
  onInitiatePurchase,   // (packId, onSuccess, onError) => void
  onRestorePurchases,   // (onSuccess, onError) => void
  onLogLegendAcknowledgment, // (packId, userId) => void
  // Phase 11 integration fixes: deferred guaranteed prize callbacks
  setCash,                   // App.jsx cash setter — for immediate cash prize delivery
  onApplyOolGate,            // () => void — fires setIapOolGateRemoved(true) in App.jsx
  onLegendPurchaseComplete,  // () => void — fires showLegendArrival modal in App.jsx
  onApplyGoldenRateCon,      // () => void — fires applyGoldenRateCon() in App.jsx
  // v4 IAP upgrade setters
  permanentFuelDiscountPct  = 0,
  setPermanentFuelDiscountPct,
  xpBoostExpiresAt          = null,
  setXpBoostExpiresAt,
  brokerTrainingUnlocked    = false,
  setBrokerTrainingUnlocked,
  maxDailyScratchesAllowed  = 1,
  setMaxDailyScratchesAllowed,
  highestIAPTier            = null,
  setHighestIAPTier,
  setBrokerNetworkPermanent,
}) {
  // ── CSS injection (once) ──────────────────────────────────────────────────
  useEffect(() => { injectShopCSS(); }, []);
  // ── Screen state machine ──────────────────────────────────────────────────
  // 'age_gate' → 'shop' → ['odds_screen' | 'confirm' → 'processing' → 'success' | 'error']
  const [screen,          setScreen]          = useState(
    iapAgeConfirmed ? 'shop' : 'age_gate'
  );
  const [previousScreen,  setPreviousScreen]  = useState('shop');
  const [selectedPackId,  setSelectedPackId]  = useState(null);
  // Scroll body to top whenever screen changes (bodyRef declared after screen state)
  const bodyRef = useRef(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [screen]);
  const [purchaseError,   setPurchaseError]   = useState('');
  const [lastPurchasedPack, setLastPurchasedPack] = useState(null);
  const [successUnlocks,  setSuccessUnlocks]  = useState([]);
  const [isRestoring,     setIsRestoring]     = useState(false);

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeTruckCount = useMemo(
    () => truckStatus.filter(t => !t.decommissioned).length,
    [truckStatus]
  );

  // Which non-consumable packs this user has already purchased
  const ownedPackIds = useMemo(() => {
    const owned = new Set();
    iapPurchases.forEach(p => {
      if (isNonConsumable(p.packId)) owned.add(p.packId);
    });
    return owned;
  }, [iapPurchases]);

  const selectedPack = selectedPackId ? PACKS[selectedPackId] : null;

  // ── Navigation helpers ────────────────────────────────────────────────────
  const goTo = useCallback((newScreen) => {
    setPreviousScreen(prev => screen === 'age_gate' ? 'age_gate' : prev);
    setScreen(newScreen);
  }, [screen]);

  const goBack = useCallback(() => {
    setScreen(previousScreen || 'shop');
  }, [previousScreen]);

  const openOdds = useCallback(() => {
    setPreviousScreen(screen);
    setScreen('odds_screen');
  }, [screen]);

  // ── Age gate confirmation ─────────────────────────────────────────────────
  const handleAgeConfirm = useCallback(() => {
    setIapAgeConfirmed?.(true);
    setScreen('shop');
  }, [setIapAgeConfirmed]);

  // ── Odds screen acknowledgment ────────────────────────────────────────────
  const handleOddsAcknowledge = useCallback(() => {
    setIapOddsAcknowledged?.(true);
    // Return to previous screen (shop or confirm dialog)
    setScreen(previousScreen || 'shop');
  }, [setIapOddsAcknowledged, previousScreen]);

  // ── Open purchase confirm dialog ──────────────────────────────────────────
  const handleBuy = useCallback((packId) => {
    setSelectedPackId(packId);
    setPurchaseError('');
    setScreen('confirm');
  }, []);

  // ── Purchase confirmation → initiate IAP ──────────────────────────────────
  const handleConfirmPurchase = useCallback((legendAcknowledged) => {
    if (!selectedPack) return;

    // Log Legend Bundle acknowledgment to Firebase (Option B requirement)
    if (
      selectedPack.id === PRODUCT_IDS.LEGEND_BUNDLE &&
      legendAcknowledged &&
      onLogLegendAcknowledgment
    ) {
      onLogLegendAcknowledgment(selectedPack.id, currentUser?.uid || 'unknown');
    }

    setScreen('processing');

    // ── Initiate platform IAP ─────────────────────────────────────────────
    // onInitiatePurchase is provided by App.jsx.
    // Phase 5 will wire this to cordova-plugin-purchase + Firebase validation.
    // Phase 4 stub: if not provided, simulate a successful purchase for dev testing.
    const initiate = onInitiatePurchase || defaultPurchaseStub;

    initiate(
      selectedPack.id,
      // onSuccess callback — called after Firebase receipt validation passes
      (receiptData) => {
        // Apply prizes locally
        const setters = {
          setTicketQueue, setTruckVouchers,
          setPrizeWallet, setFleetExpansionTokens, setGoldenRateConQueue,
          setFuelCardExpiry, setBrokerNetworkExpiry, setIapPurchases,
          setCash,                // for case 'cash' prize delivery
          // B5+B6: deferred guaranteed prize callbacks wired from App.jsx
          onApplyOolGate,
          onLegendPurchaseComplete,
          onApplyGoldenRateCon,
          // v4 IAP upgrade setters
          setPermanentFuelDiscountPct,
          setXpBoostExpiresAt,
          _xpBoostExpiresAt: xpBoostExpiresAt,
          setBrokerTrainingUnlocked,
          setMaxDailyScratchesAllowed,
          setHighestIAPTier,
          setBrokerNetworkPermanent,
        };

        const todayBonus = getDailyBonus(selectedPack.id);
        const notifications = applyPackPurchaseLocally(
          selectedPack, setters, selectedEdition,
          activeTruckCount, fleetExpansionTokens, todayBonus
        );

        // Fire all notifications via App.jsx
        notifications.forEach(msg => addNotification?.(msg, 'success'));

        // Build success screen unlock list
        const unlocks = buildUnlockSummary(selectedPack);
        setSuccessUnlocks(unlocks);
        setLastPurchasedPack(selectedPack);
        setScreen('success');
        // Notify App.jsx to show the Legend Bundle arrival modal
        if (selectedPack.id === PRODUCT_IDS.LEGEND_BUNDLE) {
          onLegendPurchaseComplete?.();
        }
      },
      // onError callback
      (errMsg) => {
        setPurchaseError(
          errMsg || 'The purchase could not be completed. Please check your payment method and try again.'
        );
        setScreen('error');
      }
    );
  }, [
    selectedPack, onInitiatePurchase, onLogLegendAcknowledgment,
    currentUser, selectedEdition, activeTruckCount, fleetExpansionTokens,
    setTicketQueue, setTruckVouchers, setPrizeWallet,
    setFleetExpansionTokens, setGoldenRateConQueue, setFuelCardExpiry,
    setBrokerNetworkExpiry, setIapPurchases, addNotification,
  ]);

  // ── Restore purchases ─────────────────────────────────────────────────────
  const handleRestorePurchases = useCallback(() => {
    if (isRestoring) return;
    setIsRestoring(true);

    const restore = onRestorePurchases || defaultRestoreStub;

    restore(
      (restoredProducts) => {
        setIsRestoring(false);
        if (!restoredProducts || restoredProducts.length === 0) {
          addNotification?.('No purchases found to restore.', 'info');
        } else {
          // Re-apply entitlements for all restored non-consumables
          restoredProducts.forEach(productId => {
          });
          addNotification?.(
            `✅ ${restoredProducts.length} purchase${restoredProducts.length !== 1 ? 's' : ''} restored successfully.`,
            'success'
          );
        }
      },
      (errMsg) => {
        setIsRestoring(false);
        addNotification?.(
          `❌ Restore failed: ${errMsg || 'Unknown error. Please try again.'}`,
          'error'
        );
      }
    );
  }, [
    isRestoring, onRestorePurchases, addNotification,
  ]);

  // ── Screen rendering ──────────────────────────────────────────────────────
  const renderBody = () => {
    switch (screen) {
      case 'age_gate':
        return (
          <AgeGateScreen
            onConfirm={handleAgeConfirm}
            onViewOdds={openOdds}
            onClose={onClose}
          />
        );

      case 'odds_screen':
        return (
          <OddsScreen
            onBack={goBack}
            onAcknowledge={handleOddsAcknowledge}
            alreadyAcknowledged={iapOddsAcknowledged}
          />
        );

      case 'processing':
        return <ProcessingScreen />;

      case 'success':
        return (
          <SuccessScreen
            pack={lastPurchasedPack}
            unlockedItems={successUnlocks}
            onDone={() => {
              setSelectedPackId(null);
              setLastPurchasedPack(null);
              setScreen('shop');
            }}
          />
        );

      case 'error':
        return (
          <ErrorScreen
            message={purchaseError}
            onRetry={() => setScreen('confirm')}
            onDone={() => {
              setSelectedPackId(null);
              setScreen('shop');
            }}
          />
        );

      case 'shop':
      default:
        return (
          <>
            {/* Wallet summary strip if player has active benefits */}
            {(truckVouchers > 0 || fuelCardExpiry > Date.now() || brokerNetworkExpiry > Date.now() || prizeWallet.length > 0) && (
              <div className="ss-info-box" style={{ marginBottom: 14 }}>
                <div className="ss-info-box-title">Your Active Benefits</div>
                {truckVouchers > 0 && (
                  <div className="ss-info-row">
                    <span className="ss-info-bullet">🏷️</span>
                    <span className="ss-info-text">{truckVouchers}× Truck Voucher (50% off next truck)</span>
                  </div>
                )}
                {fuelCardExpiry > Date.now() && (
                  <div className="ss-info-row">
                    <span className="ss-info-bullet">⛽</span>
                    <span className="ss-info-text">
                      Fuel Card active — 15% fuel savings until{' '}
                      {new Date(fuelCardExpiry).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {brokerNetworkExpiry > Date.now() && (
                  <div className="ss-info-row">
                    <span className="ss-info-bullet">📋</span>
                    <span className="ss-info-text">
                      Broker Network active until{' '}
                      {new Date(brokerNetworkExpiry).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {prizeWallet.length > 0 && (
                  <div className="ss-info-row">
                    <span className="ss-info-bullet">🎁</span>
                    <span className="ss-info-text">
                      {prizeWallet.length} prize{prizeWallet.length !== 1 ? 's' : ''} waiting in your Prize Wallet — expand your fleet to claim
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Pack cards */}
            {PACK_ORDER.map(packId => {
              const pack = PACKS[packId];
              if (!pack) return null;
              return (
                <PackCard
                  key={packId}
                  pack={pack}
                  isOwned={ownedPackIds.has(packId)}
                  dailyBonus={getDailyBonus(packId)}
                  onBuy={handleBuy}
                  onViewOdds={openOdds}
                />
              );
            })}

            {/* Spacer so last card isn't hidden behind footer */}
            <div style={{ height: 8 }} />
          </>
        );
    }
  };

  // ── Header configuration per screen ──────────────────────────────────────
  const headerConfig = useMemo(() => {
    switch (screen) {
      case 'age_gate':
        return { title: '⚠️ Shop Notice', showOdds: false, showBack: false };
      case 'odds_screen':
        return { title: '📊 Odds Disclosure', showOdds: false, showBack: true };
      case 'processing':
        return { title: '🎟️ Scratch Shop', showOdds: false, showBack: false };
      case 'success':
        return { title: '🎉 Purchase Complete', showOdds: false, showBack: false };
      case 'error':
        return { title: '❌ Purchase Failed', showOdds: false, showBack: false };
      default:
        return { title: '🎟️ Scratch Shop', showOdds: true, showBack: false };
    }
  }, [screen]);

  const showFooter = screen === 'shop';
  const showConfirmDialog = screen === 'confirm' && selectedPack;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="ss-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Scratch Shop"
    >
      {/* Header */}
      <div className="ss-header">
        {headerConfig.showBack && (
          <button className="ss-header-btn" onClick={goBack} aria-label="Go back">
            ← Back
          </button>
        )}
        <div className="ss-header-title">{headerConfig.title}</div>
        {headerConfig.showOdds && (
          <button className="ss-header-btn" onClick={openOdds} aria-label="View odds">
            📊 Odds
          </button>
        )}
        {screen !== 'processing' && (
          <button
            className="ss-header-btn ss-close-btn"
            onClick={onClose}
            aria-label="Close shop"
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="ss-body" ref={bodyRef}>
        {renderBody()}
      </div>

      {/* Footer — only on main shop screen */}
      {showFooter && (
        <div className="ss-footer">
          <button
            className="ss-restore-btn"
            onClick={handleRestorePurchases}
            disabled={isRestoring}
            aria-label="Restore previous purchases"
          >
            {isRestoring ? '⏳ Restoring…' : '🔄 Restore Purchases'}
          </button>
          <div className="ss-legal-note">
            Prices in USD. Purchases processed by Apple or Google.
            All purchases subject to their respective Terms of Service.
            All prize odds are disclosed prior to purchase.
            Non-consumable purchases can be restored via &ldquo;Restore Purchases&rdquo;.{' '}
            <span style={{ display: 'inline-block', marginTop: 4 }}>
              Refund requests must be submitted through Apple or Google — we cannot
              process refunds directly.{' '}
              <a
                href="https://support.apple.com/en-us/HT204084"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}
                aria-label="Apple refund policy (opens in browser)"
              >Apple refund</a>
              {' / '}
              <a
                href="https://support.google.com/googleplay/answer/2479637"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}
                aria-label="Google Play refund policy (opens in browser)"
              >Google refund</a>
              {'.'}
            </span>
            <span style={{ display: 'block', marginTop: 4 }}>
              <a
                href="https://boxtruckboss.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}
                aria-label="Privacy Policy (opens in browser)"
              >Privacy Policy</a>
              {' · '}
              <a
                href="https://boxtruckboss.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}
                aria-label="Terms of Service (opens in browser)"
              >Terms of Service</a>
              {' · '}
              <a
                href="https://boxtruckboss.com/odds"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}
                aria-label="Full odds disclosure (opens in browser)"
              >Odds Disclosure</a>
            </span>
          </div>
        </div>
      )}

      {/* Purchase confirm dialog — renders on top of shop */}
      {showConfirmDialog && (
        <ConfirmDialog
          pack={selectedPack}
          edition={selectedEdition}
          processing={false}
          onCancel={() => {
            setSelectedPackId(null);
            setScreen('shop');
          }}
          onConfirm={handleConfirmPurchase}
        />
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 · DEV STUBS
// These replace the real Capacitor IAP plugin in development/testing.
// Phase 5 will provide the real implementations via App.jsx props.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * defaultPurchaseStub
 * Simulates a successful purchase in dev/testing environments where
 * cordova-plugin-purchase is not available.
 * Phase 5 will replace this with the real Capacitor IAP call.
 */
function defaultPurchaseStub(packId, onSuccess, onError) {
  console.warn('[ScratchShop] onInitiatePurchase not provided — using dev stub. Phase 5 will wire real IAP.');
  // Simulate a 1.5s processing delay then succeed
  setTimeout(() => {
    onSuccess({ stub: true, packId, validatedAt: Date.now() });
  }, 1500);
}

/**
 * defaultRestoreStub
 * Simulates an empty restore in dev environments.
 */
function defaultRestoreStub(onSuccess, onError) {
  console.warn('[ScratchShop] onRestorePurchases not provided — using dev stub.');
  setTimeout(() => { onSuccess([]); }, 800);
}

export default ScratchShop;
