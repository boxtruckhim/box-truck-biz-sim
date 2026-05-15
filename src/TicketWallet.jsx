// TicketWallet.jsx  —  Box Truck Boss  ·  IAP Ticket Wallet
// Combined Hero Card (Layout A) + Vault Grid (Layout E)
// Icon: 🎫  (admission ticket — HQ=🏢, Terminal=dock art, Arcade=🕹️)

import React, {
  useState, useEffect, useCallback, useMemo, useRef, memo,
} from 'react';
import ReactDOM from 'react-dom';

const FONT = "'Outfit','SF Pro Display',-apple-system,sans-serif";
const MONO = "'Courier New',Courier,monospace";

// ── Pack display + priority ─────────────────────────────────────────────
const PACK_CONFIG = {
  'com.boxtruckboss.legend_bundle':  { name:'Legend Bundle',  short:'Legend',    color:'#40e880', priority:0 },
  'com.boxtruckboss.roadboss_pack':  { name:'Road Boss Pack', short:'Road Boss', color:'#d8d0c8', priority:1 },
  'com.boxtruckboss.dayone_pack':    { name:'Day-One Pack',   short:'Day-One',   color:'#a060ff', priority:2 },
  'com.boxtruckboss.starter_bundle': { name:'Starter Bundle', short:'Starter',   color:'#c8a020', priority:3 },
};
const PACK_PRIORITY_ORDER = [
  'com.boxtruckboss.legend_bundle',
  'com.boxtruckboss.roadboss_pack',
  'com.boxtruckboss.dayone_pack',
  'com.boxtruckboss.starter_bundle',
];
function getPackConfig(packId) {
  return PACK_CONFIG[packId] || { name:packId||'Pack', short:'Pack', color:'#888', priority:99 };
}

// ── WALLET_CARD_META ─────────────────────────────────────────────────────
const WALLET_CARD_META = {
  aqua_marine: { name:'Aqua Marine', border:'#20b0b0', bg:'#020e14', icon:'⚓', foil:false, shimmer:true, prize:'3 MATCH=$500 · HAUL=$250 · PORT=$50', serial:'BTB-AM' },
  broker_wont_answer: { name:'Broker Won’t Answer', border:'#aa6622', bg:'#080604', icon:'📵', foil:false, shimmer:false, prize:'INVOICE=$750 · FOLLOW-UP=$250 · VOICEMAIL=$50', serial:'BTB-BWA' },
  cash_blitz: { name:'Cash Blitz', border:'#00e87a', bg:'#000803', icon:'💵', foil:false, shimmer:false, prize:'MATCH 4 NUMS · 2× DOUBLER · 5× BLITZ', serial:'BTB-CB' },
  chrome_legend: { name:'Chrome Legend', border:'#b0b8c8', bg:'#0a0c10', icon:'🏆', foil:true, shimmer:true, prize:'3 MATCH=$1,000 · 2 MATCH=$200 · ANY=$50', serial:'BTB-CL' },
  classic_68: { name:'1968 Classic', border:'#b8001e', bg:'#1a0e04', icon:'🎟️', foil:false, shimmer:false, prize:'6=$5,000 · 5=$500 · 4=$100 · 3=$25', serial:'BTB-68' },
  copper_mile: { name:'Copper Mile', border:'#b06020', bg:'#100804', icon:'🔧', foil:false, shimmer:false, prize:'3 MATCH=$500 · 2 MATCH=$100 · ANY=$25', serial:'BTB-CM' },
  dead_haul_premier: { name:'Dead Haul Premier', border:'#ff4466', bg:'#050507', icon:'💀', foil:false, shimmer:false, prize:'LEGEND TIER — CLASSIFIED', serial:'BTB-DHP' },
  dead_haul_special: { name:'Dead Haul Special', border:'#ff4466', bg:'#050507', icon:'💀', foil:false, shimmer:false, prize:'TIER 1 = CLASSIFIED · TIER 2 = CLASSIFIED', serial:'BTB-DHS' },
  deep_space_freight: { name:'Deep Space Freight', border:'#4466ff', bg:'#030208', icon:'🚀', foil:false, shimmer:true, prize:'HYPERJUMP=$5,000 · ORBIT=$1,500 · LAUNCH=$500', serial:'BTB-DSF' },
  detention_clock: { name:'Detention Clock', border:'#e8a020', bg:'#080600', icon:'⏱️', foil:false, shimmer:false, prize:'WAIT WIN=$500 · PARTIAL=$250 · ANY=$50', serial:'BTB-DC' },
  diamond_haul: { name:'Diamond Haul', border:'#00ffcc', bg:'#020a08', icon:'💎', foil:true, shimmer:true, prize:'DIAMOND=$5,000 · GEM=$1,000 · CRYSTAL=$250', serial:'BTB-DH' },
  diesel_dollar_grid: { name:'Diesel Dollar Grid', border:'#50ff8c', bg:'#060c06', icon:'⛽', foil:false, shimmer:false, prize:'5=$5,000 · 4=$500 · 3=$100 · 2=$25', serial:'BTB-DDG' },
  diner_receipt: { name:'Diner Receipt', border:'#c8281e', bg:'#1e1008', icon:'🍳', foil:false, shimmer:false, prize:'≤$28=$300 · $29-$40=$100 · $41-$52=$35', serial:'BTB-DR' },
  first_light_lb: { name:'First Light', border:'#ffaa44', bg:'#060c18', icon:'🌅', foil:false, shimmer:true, prize:'PROFIT=$2,500 · STRONG=$750 · SLIM=$250', serial:'BTB-FL' },
  fortune_dragon: { name:'Fortune Dragon', border:'#cc2200', bg:'#080200', icon:'🐉', foil:true, shimmer:true, prize:'DRAGON=$5,000 · FLAME=$1,500 · CLAW=$500', serial:'BTB-FD' },
  fuel_gauge_zero: { name:'Fuel Gauge Zero', border:'#ff4400', bg:'#100400', icon:'⛽', foil:false, shimmer:false, prize:'FULL TANK=$500 · HALF=$250 · EMPTY=$0', serial:'BTB-FGZ' },
  gold_foil_standard: { name:'Gold Foil Standard', border:'#c8920a', bg:'#080700', icon:'🏆', foil:true, shimmer:true, prize:'3-MATCH=$5,000 · 2-MATCH=$500 · PAIR=$25', serial:'BTB-GFS' },
  gold_rush_miles: { name:'Gold Rush Miles', border:'#FFB830', bg:'#0d0800', icon:'🏆', foil:false, shimmer:true, prize:'6=$5,000 · 5=$500 · 4=$100 · 3=$25', serial:'BTB-GRM' },
  gold_rush_miles_lb: { name:'Gold Rush Miles LB', border:'#FFB830', bg:'#0d0800', icon:'🏆', foil:false, shimmer:true, prize:'6=$5,000 · 5=$500 · 4=$100 · WI GRID', serial:'BTB-GRM' },
  golden_empire: { name:'Golden Empire', border:'#c8a020', bg:'#0a0800', icon:'👑', foil:true, shimmer:true, prize:'JACKPOT=$5,000 · MATCH=$500 · BASE=$50', serial:'BTB-GE' },
  haul_ticket: { name:'Haul Ticket', border:'#c89020', bg:'#0e1830', icon:'🚛', foil:false, shimmer:false, prize:'3 TRUCK=$500 · 3 FUEL=$100 · 3 WRENCH=$25', serial:'BTB-HT' },
  insurance_cert: { name:'Insurance Certificate', border:'#B22222', bg:'#0d0404', icon:'📄', foil:false, shimmer:false, prize:'TRIPLE MATCH=$2,500 · PAIR=$750', serial:'BTB-IC' },
  jackpot_haul: { name:'Jackpot Haul', border:'#cc44ff', bg:'#0a0118', icon:'🎰', foil:false, shimmer:true, prize:'3× SLOTS=$5,000 · 3× TRUCK=$2,500 · GRID=$250', serial:'BTB-JH' },
  jackpot_holographic: { name:'Jackpot Holographic', border:'#ff66cc', bg:'#030208', icon:'💎', foil:true, shimmer:true, prize:'3× MATCH=$10,000 · HOLOGRAPHIC WILD', serial:'BTB-JH2' },
  lumper_wants_cash: { name:'Lumper Wants Cash', border:'#aa2222', bg:'#060404', icon:'💸', foil:false, shimmer:false, prize:'NEGOTIATE=$750 · PARTIAL=$250 · PAY=$50', serial:'BTB-LWC' },
  midnight_money_grid: { name:'Midnight Money Grid', border:'#4af0d0', bg:'#030508', icon:'🌙', foil:false, shimmer:true, prize:'5 SYMBOLS · 2× + 5× SURGE MULTIPLIERS', serial:'BTB-MMG' },
  midnight_run_grid: { name:'Midnight Run Grid', border:'#e8a020', bg:'#080a10', icon:'🌙', foil:false, shimmer:false, prize:'6=$5,000 · 5=$500 · 4=$100 · 3=$25', serial:'BTB-MRG' },
  napkin_plan: { name:'Napkin Plan', border:'#886644', bg:'#080601', icon:'📝', foil:false, shimmer:false, prize:'MILLION=$5,000 · PROFIT=$1,000 · MARGIN=$250', serial:'BTB-NP' },
  neon_jackpot_city: { name:'Neon Jackpot City', border:'#cc44ff', bg:'#0a0118', icon:'🎰', foil:false, shimmer:true, prize:'JACKPOT=$10,000 · PRIZE POOL SPINS', serial:'BTB-NJC' },
  onyx_edge: { name:'Onyx Edge', border:'#606060', bg:'#040404', icon:'⚫', foil:false, shimmer:false, prize:'3 MATCH=$1,000 · 2 MATCH=$200 · ANY=$50', serial:'BTB-OE' },
  prime_rate_premier: { name:'Prime Rate Premier', border:'#c89020', bg:'#0c0806', icon:'⛽', foil:true, shimmer:true, prize:'TOP PULL=$5,000 · BIG BEAT=$2,500 · BEAT=$500', serial:'BTB-PRP2' },
  prime_rate_pull: { name:'Prime Rate Pull', border:'#c89020', bg:'#0c0806', icon:'⛽', foil:true, shimmer:true, prize:'3 MATCH=$5,000 · 2 MATCH=$500 · ANY=$50', serial:'BTB-PRP' },
  purple_royale: { name:'Purple Royale', border:'#9060d0', bg:'#0a0614', icon:'💜', foil:true, shimmer:true, prize:'3 MATCH=$750 · 2 MATCH=$100 · ANY=$25', serial:'BTB-PR' },
  rate_con_document: { name:'Rate Con Document', border:'#1a3a6a', bg:'#0e1218', icon:'📋', foil:false, shimmer:false, prize:'BEAT MARKET=$300 · BEAT BROKER=$100 · AT=$50', serial:'BTB-RC' },
  silver_mile: { name:'Silver Mile', border:'#6080b0', bg:'#181c2a', icon:'🛣️', foil:false, shimmer:false, prize:'3 MATCH=$750 · 2 MATCH=$100 · ANY=$25', serial:'BTB-SM' },
  solar_haul: { name:'Solar Haul', border:'#ff9900', bg:'#080400', icon:'☀️', foil:true, shimmer:true, prize:'SOLAR=$5,000 · FLARE=$1,000 · CORONA=$250', serial:'BTB-SH' },
  speedway_85: { name:'85 Speedway', border:'#cc2200', bg:'#050000', icon:'🏁', foil:false, shimmer:false, prize:'PODIUM=$2,500 · FINISH=$750 · LAP=$250', serial:'BTB-SP' },
  stunning_fortune: { name:'Stunning Fortune', border:'#4090ff', bg:'#020818', icon:'💎', foil:false, shimmer:true, prize:'6=$5,000 · 5=$500 · 4=$100 · 3=$25', serial:'BTB-SF' },
  the_exit: { name:'The Exit', border:'#88aa44', bg:'#060604', icon:'🚪', foil:false, shimmer:false, prize:'FREEDOM=$2,500 · DETOUR=$500 · TURN=$100', serial:'BTB-TE' },
  thunder_road: { name:'Thunder Road', border:'#00d4ff', bg:'#040008', icon:'⚡', foil:false, shimmer:true, prize:'CHECK=$50 · TRUCK=$150 · STAR=$300 · CANCEL', serial:'BTB-TR' },
  titanium_x: { name:'Titanium X', border:'#8090b0', bg:'#0a0c12', icon:'⚙️', foil:true, shimmer:true, prize:'200X=$2,500 · 50X=$750 · 20X=$250 · PAIR=$75', serial:'BTB-TX' },
  triple_7_truck: { name:'Triple 7 Truck', border:'#cc2200', bg:'#050000', icon:'7️⃣', foil:false, shimmer:false, prize:'7-7-7=$777 · STAR=$150 · CASH=$100 · WILD', serial:'BTB-T7' },
  void_radiant: { name:'Void Radiant', border:'#8800ff', bg:'#02000a', icon:'🌌', foil:false, shimmer:true, prize:'VOID=$5,000 · RADIANT=$1,000 · PULSE=$250', serial:'BTB-VR' },
  open_road_daily: { name:'Open Road Daily', border:'#ffb830', bg:'#060804', icon:'🛣️', foil:false, shimmer:false, prize:'4 MATCH=$500 · CHECKPOINT=$100 · ANY=$25', serial:'BTB-ORD' },
  owner_op_legend: { name:'Owner-Op Legend', border:'#40e880', bg:'#04080e', icon:'👑', foil:true, shimmer:true, prize:'LEGEND TIER — ONE IN THIRTY DAYS', serial:'BTB-OOL' },
};

function getMeta(tierId) {
  if (!tierId) return { name:'Ticket', border:'#c89020', bg:'#0e1830', icon:'🎟️', foil:false, shimmer:false, prize:'SCRATCH TO REVEAL', serial:'BTB' };
  return WALLET_CARD_META[tierId] || {
    name: tierId.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()),
    border:'#c89020', bg:'#0e1830', icon:'🎟️', foil:false, shimmer:false,
    prize:'SCRATCH TO REVEAL', serial:'BTB',
  };
}
function sortTickets(arr) {
  return [...arr].sort((a,b) => {
    const pa = getPackConfig(a.packId).priority;
    const pb = getPackConfig(b.packId).priority;
    return pa !== pb ? pa - pb : (a.packIndex||0) - (b.packIndex||0);
  });
}
function getSerial(t) {
  return getMeta(t.tierId).serial + '-' + String((t.packIndex||0)+1).padStart(3,'0');
}

// -- CSS injection -----------------------------------------------------------
let _twOk = false;
function injectWalletCSS() {
  if (_twOk) return; _twOk = true;
  const s = document.createElement('style');
  s.id = 'btb-tw2-css';
  s.textContent = `
/* === PERFORMANCE OVERHAUL ===
   All animations now use only transform+opacity (GPU-compositable).
   will-change added to animated elements.
   tw-scan::after top -> translateY (compositable).
   foil/shimmer paused when card not visible via animation-play-state.
*/
@keyframes tw-fadein    { from{opacity:0}to{opacity:1} }
@keyframes tw-gridin    { from{opacity:0;transform:translateY(14px) scale(.93)}to{opacity:1;transform:none} }
@keyframes tw-foil      { 0%{background-position:0% 30%}33%{background-position:100% 70%}66%{background-position:50% 0%}100%{background-position:0% 30%} }
@keyframes tw-foil2     { 0%{opacity:.55;background-position:100% 50%}50%{opacity:.9;background-position:0% 50%}100%{opacity:.55;background-position:100% 50%} }
@keyframes tw-shimmer   { 0%{transform:translateX(-160%) skewX(-12deg)}100%{transform:translateX(380%) skewX(-12deg)} }
@keyframes tw-heroglow  { 0%,100%{opacity:.12;transform:translateX(-50%) scaleX(.85)}50%{opacity:.42;transform:translateX(-50%) scaleX(1)} }
@keyframes tw-stamp     { 0%{transform:translate(-50%,-50%) scale(.04) rotate(-18deg);opacity:0}55%{transform:translate(-50%,-50%) scale(1.1) rotate(2deg);opacity:1}80%{transform:translate(-50%,-50%) scale(.97) rotate(-1deg)}100%{transform:translate(-50%,-50%) scale(1) rotate(-2deg);opacity:1} }
@keyframes tw-perf      { 0%,100%{opacity:.2}50%{opacity:.5} }
@keyframes tw-hero      { from{opacity:0;transform:translateY(12px) scale(.94)}to{opacity:1;transform:none} }
@keyframes tw-heroexit  { from{opacity:1;transform:none}to{opacity:0;transform:translateY(-8px) scale(.96)} }
@keyframes tw-particle  { 0%{transform:translate(var(--px),var(--py)) scale(1.3);opacity:1}100%{transform:translate(calc(var(--px)*4.5),calc(var(--py)*4.5)) scale(0);opacity:0} }
@keyframes tw-badgepop  { 0%{transform:scale(.4)}60%{transform:scale(1.26)}80%{transform:scale(.95)}100%{transform:scale(1)} }
@keyframes tw-scan-move { from{transform:translateY(-100%)}to{transform:translateY(600%)} }
@keyframes tw-breathe   { 0%,100%{opacity:.7}50%{opacity:1} }
@keyframes tw-float     { 0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)} }
@keyframes tw-pulse     { 0%,100%{opacity:.35}50%{opacity:.9} }
@keyframes tw-glowring  { 0%{transform:translate(-50%,-50%) scale(1);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
@keyframes tw-vaultopen { 0%{opacity:0;transform:scaleX(0) translateX(-50%)}100%{opacity:1;transform:scaleX(1) translateX(0)} }
@keyframes tw-iconpop   { 0%{transform:scale(1)}40%{transform:scale(1.16) rotate(-3deg)}70%{transform:scale(.96) rotate(1deg)}100%{transform:scale(1) rotate(0)} }

.tw2 { font-family:Outfit,'SF Pro Display',-apple-system,sans-serif; -webkit-tap-highlight-color:transparent; user-select:none; }
.tw2-scroll::-webkit-scrollbar{width:3px}
.tw2-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.tw2-vc {
  position:relative;border-radius:12px;overflow:hidden;cursor:pointer;
  transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s;
  -webkit-tap-highlight-color:transparent;
  will-change:transform;
  contain:layout style paint;
}
.tw2-vc:hover{transform:translateY(-3px) scale(1.03)}
.tw2-vc:active{transform:scale(.95)!important}
.tw2-vc.sel{transform:translateY(-3px) scale(1.03)}
.tw2-foil{
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:4;
  background:linear-gradient(135deg,transparent 0%,rgba(255,255,255,.04) 22%,transparent 36%,rgba(255,255,255,.08) 50%,transparent 64%,rgba(255,255,255,.04) 78%,transparent 100%);
  background-size:200% 200%;animation:tw-foil 6s ease-in-out infinite;
  will-change:background-position;
}
.tw2-shim{
  position:absolute;top:0;height:100%;width:38%;pointer-events:none;z-index:5;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);
  animation:tw-shimmer 5s ease-in-out infinite;
  will-change:transform;
}
/* scan line: uses translateY (compositable) instead of top (triggers layout) */
.tw2-scan{
  position:absolute;inset:0;pointer-events:none;z-index:6;overflow:hidden;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.08) 3px,rgba(0,0,0,.08) 4px);
}
.tw2-scan::after{
  content:'';position:absolute;left:0;right:0;height:22%;top:0;
  background:linear-gradient(transparent,rgba(0,0,0,.06),transparent);
  animation:tw-scan-move 5s linear infinite;
  will-change:transform;
}
.tw2-stamp{
  position:absolute;top:50%;left:50%;z-index:20;
  transform:translate(-50%,-50%) rotate(-8deg);
  border:2px solid rgba(255,60,60,.65);border-radius:5px;
  padding:3px 8px;background:rgba(18,0,0,.9);
  font-size:8px;font-weight:900;letter-spacing:2px;
  color:rgba(255,80,80,.8);text-transform:uppercase;
  pointer-events:none;font-family:'Courier New',monospace;
  animation:tw-stamp .42s cubic-bezier(.2,.8,.4,1.2) both;
  will-change:transform,opacity;
}
.tw2-stamp.win{border-color:rgba(255,215,0,.65);color:rgba(255,215,0,.88);background:rgba(18,14,0,.92)}
.tw2-hero-card{animation:tw-hero .38s cubic-bezier(.22,1,.36,1);will-change:transform,opacity}
.tw2-btn{transition:transform .14s cubic-bezier(.22,1,.36,1)}
.tw2-btn:active{transform:scale(.95)!important}
.tw2-pill{
  padding:6px 13px;border-radius:20px;cursor:pointer;white-space:nowrap;flex-shrink:0;
  font-size:10px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;
  transition:transform .16s,opacity .16s;-webkit-tap-highlight-color:transparent;border:1.5px solid transparent;
}
.tw2-pill:active{transform:scale(.92)}

/* selected: use opacity-only breathe (compositable) instead of box-shadow */
.tw2-vc.sel{animation:tw-breathe 2s ease-in-out infinite!important;transform:translateY(-3px) scale(1.03)}
.tw2-vc.sel .tw2-foil{animation-duration:3s}
.tw2-vc.sel .tw2-shim{animation-duration:2.2s}

.tw2-hero-glow-ring{
  position:absolute;top:50%;left:50%;width:60px;height:60px;
  border-radius:50%;border:1.5px solid var(--bc,#8844ff);
  pointer-events:none;animation:tw-glowring 2.4s ease-out infinite;
  will-change:transform,opacity;
}

.tw2-foil-premium{
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:4;mix-blend-mode:screen;
  background:linear-gradient(105deg,
    transparent 20%, rgba(255,100,200,.07) 30%, rgba(100,200,255,.10) 40%,
    transparent 50%, rgba(255,215,0,.06) 60%, rgba(200,100,255,.09) 70%,
    transparent 80%);
  background-size:300% 300%;animation:tw-foil2 7s ease-in-out infinite;
  will-change:background-position,opacity;
}

.tw2-card-opening{
  animation:tw-vaultopen .32s cubic-bezier(.22,1,.36,1)!important;
  will-change:transform,opacity;
}

/* Reduce animation load: pause foil/shimmer on non-selected cells in large grids */
@media (prefers-reduced-motion: reduce) {
  .tw2-foil, .tw2-foil-premium, .tw2-shim, .tw2-scan::after,
  .tw2-hero-glow-ring, .tw2-heroglow { animation: none !important; }
}
  
`;
  document.head.appendChild(s);
}

// -- Particle burst ----------------------------------------------------------
function spawnParticles(el, color) {
  if (!el) return;
  for (let i = 0; i < 14; i++) {
    const p   = document.createElement('div');
    const ang = (i / 14) * 360;
    const dst = 26 + Math.random() * 24;
    const sz  = 2.5 + Math.random() * 2.5;
    const px  = Math.cos(ang * Math.PI / 180) * dst;
    const py  = Math.sin(ang * Math.PI / 180) * dst;
    p.style.cssText = `position:absolute;top:50%;left:50%;width:${sz}px;height:${sz}px;`
      + `border-radius:50%;background:${color};pointer-events:none;z-index:30;`
      + `--px:${px}px;--py:${py}px;transform:translate(-50%,-50%);`
      + `animation:tw-particle ${0.38+Math.random()*.3}s ease-out ${i*16}ms forwards`;
    el.appendChild(p);
    setTimeout(() => p.parentNode && p.parentNode.removeChild(p), 900);
  }
}

// -- HeroCard ----------------------------------------------------------------
const HeroCard = memo(function HeroCard({ ticket, onScratch, onPrev, onNext, heroIdx, total, played }) {
  const meta   = getMeta(ticket.tierId);
  const pack   = getPackConfig(ticket.packId);
  const serial = getSerial(ticket);
  const won    = ticket.cumulativeCash || 0;
  const isWin  = played && won > 0;
  const pRef   = React.useRef(null);

  function doScratch() {
    if (played) return;
    spawnParticles(pRef.current, meta.border);
    setTimeout(() => onScratch(ticket), 130);
  }

  return (
    <div className="tw2-hero-card" style={{ position:'relative', marginBottom:2 }}>
      {/* Ambient floor glow */}
      <div style={{
        position:'absolute', bottom:-24, left:'50%', transform:'translateX(-50%)',
        width:'68%', height:58, borderRadius:'50%',
        background:`radial-gradient(ellipse at center, ${meta.border}65 0%, transparent 72%)`,
        filter:'blur(22px)', pointerEvents:'none', zIndex:0,
        animation:'tw-heroglow 3s ease-in-out infinite',
      }}/>
      {/* Glow rings — pulse outward from card center */}
      {!played && <div className="tw2-hero-glow-ring" style={{'--bc':meta.border,top:'50%',left:'50%',animationDelay:'0s'}}/>}
      {!played && <div className="tw2-hero-glow-ring" style={{'--bc':meta.border,top:'50%',left:'50%',animationDelay:'.8s',width:90,height:90}}/>}
      {/* Card */}
      <div ref={pRef} style={{
        position:'relative', zIndex:1, background:meta.bg, willChange:'transform',
        border:`2px solid ${meta.border}`,
        borderRadius:16, overflow:'hidden',
        boxShadow:`0 0 0 1px ${meta.border}22, 0 12px 42px -8px rgba(0,0,0,.88), 0 0 50px -14px ${meta.border}42`,
      }}>
        {meta.foil    && <><div className="tw2-foil"/><div className="tw2-foil-premium"/></>}
        {meta.shimmer && !played && <div className="tw2-shim"/>}
        {played       && <div className="tw2-scan"/>}
        {/* Perforation strip */}
        <div style={{
          height:5, animation:'tw-perf 2.8s ease-in-out infinite',
          background:`radial-gradient(circle at 50% 50%, rgba(0,0,0,.9) 40%, ${meta.border} 40%, ${meta.border} 62%, transparent 62%) 0 0/8px 5px`,
          backgroundColor:`${meta.border}18`,
        }}/>
        <div style={{ padding:'18px 18px 16px', display:'flex', flexDirection:'column', alignItems:'center' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', marginBottom:14 }}>
            <div style={{ fontSize:8.5, fontFamily:'Courier New,monospace', color:`${meta.border}80`, letterSpacing:1.2 }}>{serial}</div>
            <div style={{
              fontSize:8, fontWeight:900, letterSpacing:1, textTransform:'uppercase',
              padding:'3px 9px', borderRadius:5,
              background:`${pack.color}22`, color:pack.color, border:`1px solid ${pack.color}44`,
            }}>{pack.short}</div>
          </div>
          {/* Icon */}
          <div style={{
            fontSize:58, lineHeight:1, marginBottom:13,
            filter:played?'grayscale(1) opacity(.35)':`drop-shadow(0 0 20px ${meta.border}78) drop-shadow(0 0 6px ${meta.border}40)`,
            transition:'filter .3s',
            animation: played ? 'none' : 'tw-float 4s ease-in-out infinite',
          }}>{meta.icon}</div>
          {/* Name */}
          <div style={{
            fontSize:19, fontWeight:900, letterSpacing:.8, textTransform:'uppercase',
            color:played?'rgba(255,255,255,.3)':'rgba(255,255,255,.96)',
            textAlign:'center', marginBottom:4, lineHeight:1.15,
          }}>{meta.name}</div>
          {/* Prize */}
          <div style={{
            fontSize:9.5, fontFamily:'Courier New,monospace', letterSpacing:.5,
            color:played?'rgba(255,255,255,.2)':'rgba(255,255,255,.34)',
            textAlign:'center', marginBottom:13, lineHeight:1.5,
          }}>{meta.prize}</div>
          {/* Position */}
          <div style={{ fontSize:8, color:'rgba(255,255,255,.18)', letterSpacing:1, marginBottom:14 }}>
            {'Ticket ' + ((ticket.packIndex||0)+1) + ' of ' + (ticket.packSize||1) + ' \u00b7 ' + pack.name}
          </div>
          {/* CTA */}
          {played ? (
            <div style={{
              padding:'11px 24px',
              background:isWin?'rgba(255,215,0,.08)':'rgba(255,255,255,.04)',
              border:`1px solid ${isWin?'rgba(255,215,0,.28)':'rgba(255,255,255,.1)'}`,
              borderRadius:9, fontSize:14, fontWeight:900,
              color:isWin?'#FFD700':'rgba(255,255,255,.28)', textAlign:'center',
            }}>{isWin ? ('Won $' + won.toLocaleString()) : 'No Win'}</div>
          ) : (
            <button className="tw2-btn" onClick={doScratch} style={{
              width:'100%', padding:'15px 0',
              background:`linear-gradient(135deg, ${meta.border}32, ${meta.border}18)`,
              border:`2px solid ${meta.border}92`, borderRadius:10, cursor:'pointer',
              fontSize:14, fontWeight:900, letterSpacing:1.5, textTransform:'uppercase',
              color:meta.border, fontFamily:"'Outfit',sans-serif",
              boxShadow:`0 0 24px -6px ${meta.border}58`,
              WebkitTapHighlightColor:'transparent', minHeight:52,
            }}>
              {'\u25B6 Scratch This Ticket'}
            </button>
          )}
        </div>
        {played && (
          <div className={'tw2-stamp' + (isWin ? ' win' : '')}>
            {isWin ? ('+$' + won.toLocaleString()) : 'No Win'}
          </div>
        )}
      </div>
      {/* Nav */}
      {total > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, paddingTop:10 }}>
          <button className="tw2-btn" onClick={onPrev} disabled={heroIdx===0} style={{
            width:34, height:34, borderRadius:'50%',
            background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)',
            cursor:heroIdx===0?'not-allowed':'pointer', fontSize:15,
            color:heroIdx===0?'rgba(255,255,255,.2)':'rgba(255,255,255,.65)',
            WebkitTapHighlightColor:'transparent',
          }}>{'\u2039'}</button>
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            {Array.from({length:Math.min(total,9)}, (_,i) => {
              const denom = Math.max(1, total-1);
              const active = total<=9 ? i===heroIdx : Math.round(i*(denom)/8)===Math.round(heroIdx*8/denom);
              return React.createElement('div', { key:i, style:{
                width:active?20:6, height:6, borderRadius:3,
                background:active?meta.border:'rgba(255,255,255,.18)',
                transition:'all .28s cubic-bezier(.22,1,.36,1)',
              }});
            })}
          </div>
          <button className="tw2-btn" onClick={onNext} disabled={heroIdx===total-1} style={{
            width:34, height:34, borderRadius:'50%',
            background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)',
            cursor:heroIdx===total-1?'not-allowed':'pointer', fontSize:15,
            color:heroIdx===total-1?'rgba(255,255,255,.2)':'rgba(255,255,255,.65)',
            WebkitTapHighlightColor:'transparent',
          }}>{'\u203A'}</button>
        </div>
      )}
    </div>
  );
});

// -- VaultCell ---------------------------------------------------------------
const VaultCell = memo(function VaultCell({ ticket, selected, onSelect, delay, played }) {
  const meta  = getMeta(ticket.tierId);
  const pack  = getPackConfig(ticket.packId);
  const won   = ticket.cumulativeCash || 0;
  const isWin = played && won > 0;
  return (
    <div
      className={'tw2-vc' + (selected ? ' sel' : '')}
      onClick={() => onSelect(ticket.id)}
      style={{
        background:meta.bg,
        border:`1.5px solid ${selected ? meta.border : meta.border + '58'}`,
        boxShadow:selected
          ? `0 0 0 1.5px ${meta.border}, 0 0 26px -5px ${meta.border}70`
          : `0 0 0 .5px ${meta.border}22`,
        opacity:played ? .55 : 1,
        animation:`tw-gridin .38s cubic-bezier(.22,1,.36,1) ${delay}ms both`,
        '--bc':meta.border,
      }}
    >
      {meta.foil    && !played && <><div className="tw2-foil"/><div className="tw2-foil-premium"/></>}
      {meta.shimmer && !played && <div className="tw2-shim"/>}
      {played && <div className="tw2-scan"/>}
      {/* Bottom color bleed */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:3,
        background:meta.border, opacity:selected?.92:.42,
        transition:'opacity .2s', zIndex:3,
      }}/>
      {/* Glow when selected */}
      {selected && <div style={{
        position:'absolute', bottom:-8, left:0, right:0, height:22,
        background:`radial-gradient(ellipse at center, ${meta.border}58 0%, transparent 72%)`,
        filter:'blur(5px)', pointerEvents:'none', zIndex:0,
        animation:'tw-heroglow 2s ease-in-out infinite',
      }}/>}
      {/* Perforation */}
      <div style={{
        height:3, position:'relative', zIndex:2,
        background:`radial-gradient(circle at 50% 50%, rgba(0,0,0,.9) 40%, ${meta.border} 40%, ${meta.border} 62%, transparent 62%) 0 0/6px 3px`,
        backgroundColor:`${meta.border}10`,
      }}/>
      {/* Content */}
      <div style={{ padding:'8px 7px 10px', position:'relative', zIndex:2 }}>
        <div style={{ fontSize:7, fontFamily:'Courier New,monospace', color:'rgba(255,255,255,.16)', letterSpacing:.5, marginBottom:5 }}>
          {getSerial(ticket)}
        </div>
        <div style={{
          fontSize:24, lineHeight:1, marginBottom:6,
          filter:played?'grayscale(1)':selected?`drop-shadow(0 0 8px ${meta.border}80)`:undefined,
        }}>{meta.icon}</div>
        <div style={{
          fontSize:9.5, fontWeight:900, letterSpacing:.5, textTransform:'uppercase',
          color:played?'rgba(255,255,255,.3)':selected?'rgba(255,255,255,.98)':'rgba(255,255,255,.88)',
          lineHeight:1.2, marginBottom:4,
        }}>{meta.name}</div>
        <div style={{
          fontSize:7, fontWeight:800, letterSpacing:.6, textTransform:'uppercase',
          color:pack.color, opacity:played?.35:.75, marginBottom:5,
        }}>{pack.short}</div>
        <div style={{ fontSize:6.5, fontFamily:'Courier New,monospace', color:'rgba(255,255,255,.2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {meta.prize.split(' \u00b7 ')[0]}
        </div>
      </div>
      {/* Badge */}
      <div style={{
        position:'absolute', top:7, right:6, zIndex:8,
        fontSize:6, fontWeight:900, letterSpacing:.8, textTransform:'uppercase',
        padding:'2px 4px', borderRadius:3,
        background:played?(isWin?'rgba(255,215,0,.12)':'rgba(255,255,255,.05)'):`${meta.border}15`,
        color:played?(isWin?'#FFD700':'rgba(255,255,255,.28)'):meta.border,
        border:`1px solid ${played?(isWin?'rgba(255,215,0,.22)':'rgba(255,255,255,.07)'):meta.border+'30'}`,
      }}>{played?(isWin?'\u2713':'\u2715'):'\u2736'}</div>
      {played && (
        <div className={'tw2-stamp' + (isWin ? ' win' : '')} style={{ fontSize:7.5, padding:'2px 6px', letterSpacing:1.5 }}>
          {isWin ? ('+$' + won.toLocaleString()) : 'No Win'}
        </div>
      )}
    </div>
  );
});

// -- EmptyState --------------------------------------------------------------
const EmptyState = memo(function EmptyState({ tab, onOpenShop }) {
  return (
    <div style={{ padding:'52px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
      <div style={{ fontSize:48, opacity:.22, animation:'tw-float 3s ease-in-out infinite' }}>
        {tab==='ready' ? '\u{1F3AB}' : '\u{1F4EB}'}
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,.3)', letterSpacing:.3 }}>
        {tab==='ready' ? 'No tickets in your wallet' : 'No played tickets yet'}
      </div>
      <div style={{ fontSize:11, color:'rgba(255,255,255,.2)', lineHeight:1.7, maxWidth:240 }}>
        {tab==='ready'
          ? 'Purchase a pack in the Scratch Shop to fill your wallet with premium tickets.'
          : 'Scratch your first ticket to see your history here.'}
      </div>
      {tab==='ready' && (
        <button className="tw2-btn" onClick={onOpenShop} style={{
          padding:'13px 28px', marginTop:4,
          background:'rgba(136,68,255,.18)', border:'1.5px solid rgba(136,68,255,.42)',
          borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:900,
          color:'#c8a8ff', letterSpacing:1, textTransform:'uppercase',
          WebkitTapHighlightColor:'transparent', minHeight:50,
        }}>Open Scratch Shop</button>
      )}
    </div>
  );
});

// -- TicketWallet (main) -----------------------------------------------------
const TicketWallet = memo(function TicketWallet({
  ticketQueue   = [],
  iapPurchases  = [],
  onClose,
  onScratchTicket,
  onOpenShop,
  level         = 1,
  prestigeLevel = 0,
}) {
  React.useEffect(() => { injectWalletCSS(); }, []);

  const [visible,    setVisible]    = useState(false);
  const [tab,        setTab]        = useState('ready');
  const [selectedId, setSelectedId] = useState(null);
  const [packFilter, setPackFilter] = useState('all');
  const [heroIdx,    setHeroIdx]    = useState(0);
  const [openSweep,  setOpenSweep]  = useState(true);
  const scrollRef = useRef(null);
  const prevTabRef = useRef('ready');

  // Entrance + opening sweep
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 20);
    const t2 = setTimeout(() => setOpenSweep(false), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Reset on tab change
  useEffect(() => {
    if (prevTabRef.current !== tab) {
      prevTabRef.current = tab;
      setSelectedId(null);
      setHeroIdx(0);
      setPackFilter('all');
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }
  });

  // Tickets
  const ready  = useMemo(() => sortTickets(ticketQueue.filter(t => !t.played)), [ticketQueue]);
  const played = useMemo(() => sortTickets(ticketQueue.filter(t =>  t.played)), [ticketQueue]);
  const isPlayedTab = tab === 'played';
  const pool = isPlayedTab ? played : ready;

  // Pack filters (only packs with tickets in current view)
  const availPacks = useMemo(() => {
    const seen = new Set(pool.map(t => t.packId));
    return PACK_PRIORITY_ORDER.filter(p => seen.has(p));
  }, [pool]);

  const filtered = useMemo(() => {
    return packFilter === 'all' ? pool : pool.filter(t => t.packId === packFilter);
  }, [pool, packFilter]);

  // Hero
  const safeIdx    = Math.min(heroIdx, Math.max(0, filtered.length - 1));
  const heroTicket = filtered[safeIdx] || null;

  // Stats
  const totalWon      = useMemo(() => played.reduce((s,t) => s + (t.cumulativeCash||0), 0), [played]);
  const totalInvested = useMemo(() => (iapPurchases || []).reduce((s,p) => s + (p.priceUSD||0), 0), [iapPurchases]);

  // Sync selectedId to heroIdx
  useEffect(() => {
    if (filtered.length > 0 && filtered[safeIdx]) setSelectedId(filtered[safeIdx].id);
  }, [safeIdx, filtered.length]);

  const handleSelect = useCallback((id) => {
    const idx = filtered.findIndex(t => t.id === id);
    if (idx >= 0) { setHeroIdx(idx); setSelectedId(id); }
    if (scrollRef.current) { scrollRef.current.scrollTo({ top:0, behavior:'smooth' }); }
  }, [filtered]);

  const handleScratch = useCallback((ticket) => { onScratchTicket?.(ticket); }, [onScratchTicket]);
  const handlePrev    = useCallback(() => setHeroIdx(i => Math.max(0, i-1)), []);
  const handleNext    = useCallback(() => setHeroIdx(i => Math.min(Math.max(0,filtered.length-1), i+1)), [filtered.length]);

  // Active hero meta for accent colors
  const heroMeta = useMemo(() => heroTicket ? getMeta(heroTicket.tierId) : null, [heroTicket]);

  return ReactDOM.createPortal(
    <div className="tw2" style={{
      position:'fixed', inset:0, zIndex:9992,
      background:'linear-gradient(180deg,#08021a 0%,#04010f 40%,#050008 100%)',
      display:'flex', flexDirection:'column',
      opacity:visible?1:0, transition:'opacity .26s ease',
    }}>

      {/* HEADER */}
      <div style={{
        flexShrink:0, padding:'14px 16px 12px',
        background:'linear-gradient(180deg,#0e0420 0%,#080212 100%)',
        borderBottom:'1px solid rgba(120,60,255,.18)',
        position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', bottom:0, left:'6%', right:'6%', height:1,
          background:'linear-gradient(90deg,transparent,rgba(160,80,255,.55),transparent)', pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="tw2-btn" onClick={onClose} style={{
            background:'rgba(136,68,255,.18)', border:'1.5px solid rgba(136,68,255,.55)',
            borderRadius:8, padding:'7px 14px', cursor:'pointer',
            fontSize:12, fontWeight:900, color:'rgba(220,180,255,.9)',
            WebkitTapHighlightColor:'transparent', minHeight:40, flexShrink:0,
            letterSpacing:.5, boxShadow:'0 0 10px rgba(100,50,200,.2)',
          }}>{'\u2190 Exit'}</button>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7 }}>
              <span style={{ fontSize:19, lineHeight:1 }}>{'\u{1F3AB}'}</span>
              <div style={{ fontSize:13, fontWeight:900, letterSpacing:1.5, color:'#e8d8ff', textTransform:'uppercase' }}>Ticket Wallet</div>
            </div>
            <div style={{ fontSize:8.5, color:'rgba(180,140,255,.38)', letterSpacing:1.5, marginTop:2, textTransform:'uppercase' }}>
              {'Box Truck Boss \u00b7 Premium Collection'}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{
              fontSize:24, fontWeight:900, color:'#d0b8ff', fontFamily:'Courier New,monospace', lineHeight:1,
              animation:ready.length>0?'tw-badgepop .4s ease-out':'none',
            }}>{ready.length}</div>
            <div style={{ fontSize:7.5, letterSpacing:1.5, color:'rgba(180,140,255,.32)', textTransform:'uppercase', marginTop:1 }}>Ready</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:'flex', flexShrink:0, background:'#060010', borderBottom:'1px solid rgba(120,60,255,.1)' }}>
        {[{id:'ready',label:'Ready to Scratch',cnt:ready.length},{id:'played',label:'History',cnt:played.length}].map(({id,label,cnt}) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, padding:'10px 0', border:'none', background:'transparent', cursor:'pointer',
            fontSize:9, fontWeight:800, letterSpacing:1.5, textTransform:'uppercase',
            color:tab===id?'#c8a0ff':'rgba(180,140,255,.3)',
            borderBottom:`2px solid ${tab===id?'#8844ff':'transparent'}`,
            WebkitTapHighlightColor:'transparent', transition:'color .15s, border-color .15s',
          }}>
            {label}
            <span style={{
              display:'inline-block', marginLeft:5, fontSize:8, fontWeight:900,
              padding:'1px 6px', borderRadius:3, verticalAlign:'middle',
              background:tab===id?'rgba(136,68,255,.25)':'rgba(255,255,255,.06)',
              color:tab===id?'#c090ff':'rgba(255,255,255,.22)',
              animation:tab===id&&cnt>0?'tw-badgepop .3s ease-out':'none',
            }}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* PACK FILTER PILLS */}
      {availPacks.length > 1 && (
        <div className="tw2-scroll" style={{
          display:'flex', gap:7, padding:'8px 12px', flexShrink:0, overflowX:'auto',
          background:'#050010', borderBottom:'1px solid rgba(120,60,255,.07)',
        }}>
          {[null, ...availPacks].map((pid) => {
            const pc     = pid ? getPackConfig(pid) : { short:'All', color:'rgba(255,255,255,.6)', name:'All Packs' };
            const id     = pid || 'all';
            const active = packFilter === id;
            return (
              <div key={id} className="tw2-pill" onClick={() => { setPackFilter(id); setHeroIdx(0); }} style={{
                background:active?`${pc.color}25`:'rgba(255,255,255,.04)',
                borderColor:active?`${pc.color}62`:'rgba(255,255,255,.09)',
                color:active?pc.color:'rgba(255,255,255,.38)',
              }}>{pid ? pc.short : 'All'}</div>
            );
          })}
        </div>
      )}

      {/* SCROLL BODY */}
      <div className="tw2-scroll" ref={scrollRef} style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'14px 12px 24px' }}>
        {filtered.length === 0 ? (
          <EmptyState tab={tab} onOpenShop={onOpenShop}/>
        ) : (
          <>
            {heroTicket && (
              <HeroCard
                ticket={heroTicket}
                onScratch={handleScratch}
                onPrev={handlePrev}
                onNext={handleNext}
                heroIdx={safeIdx}
                total={filtered.length}
                played={isPlayedTab}
              />
            )}
            {filtered.length > 1 && (
              <>
                {/* Vault label */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:20, marginBottom:10 }}>
                  <div style={{ flex:1, height:1, background:`linear-gradient(90deg, transparent, ${heroMeta?heroMeta.border+'30':'rgba(120,60,255,.14)'})` }}/>
                  <div style={{ fontSize:8.5, letterSpacing:2, color:'rgba(180,140,255,.28)', textTransform:'uppercase', flexShrink:0 }}>
                    {'The Vault \u00b7 ' + filtered.length + ' Tickets'}
                  </div>
                  <div style={{ flex:1, height:1, background:`linear-gradient(270deg, transparent, ${heroMeta?heroMeta.border+'30':'rgba(120,60,255,.14)'})` }}/>
                </div>
                {/* 3-col grid */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {filtered.map((t,i) => (
                    <VaultCell key={t.id} ticket={t} selected={t.id===selectedId}
                      onSelect={handleSelect} delay={Math.min(i*22,180)} played={isPlayedTab}/>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Opening shimmer sweep */}
      {openSweep && (
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none', zIndex:9999, overflow:'hidden',
        }}>
          <div style={{
            position:'absolute', top:0, bottom:0, width:'40%',
            background:'linear-gradient(90deg,transparent,rgba(255,255,255,.04),rgba(160,80,255,.06),transparent)',
            animation:'tw-shimmer .85s ease-out .15s forwards',
            transform:'skewX(-12deg)',
          }}/>
        </div>
      )}

      {/* FOOTER */}
      <div style={{
        flexShrink:0,
        background:'linear-gradient(180deg,#060010 0%,#04000c 100%)',
        borderTop:'1px solid rgba(120,60,255,.12)',
      }}>
        <button onClick={onClose} style={{
          display:'block', width:'100%', padding:'11px 0',
          background:'rgba(136,68,255,.12)', border:'none',
          borderBottom:'1px solid rgba(120,60,255,.12)',
          cursor:'pointer', fontSize:13, fontWeight:900,
          color:'rgba(200,160,255,.75)', letterSpacing:1.5,
          textTransform:'uppercase', WebkitTapHighlightColor:'transparent',
          fontFamily:"'Outfit','SF Pro Display',-apple-system,sans-serif",
        }}>✕ &nbsp;Exit Ticket Wallet</button>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-evenly',
          padding:'10px 12px',
        }}>
        {[
          { num:ready.length,                   lbl:'Unplayed' },
          { num:played.length,                  lbl:'Played'   },
          { num:'$' + totalWon.toLocaleString(), lbl:'Won'      },
          { num:'$' + totalInvested.toFixed(2),  lbl:'Invested' },
        ].map((s,i) => (
          <React.Fragment key={s.lbl}>
            {i > 0 && <div style={{ width:1, height:26, background:'rgba(120,60,255,.18)' }}/>}
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:900, color:'#c0a0ff', fontFamily:'Courier New,monospace', lineHeight:1 }}>{s.num}</div>
              <div style={{ fontSize:7, letterSpacing:1.3, color:'rgba(180,140,255,.3)', textTransform:'uppercase', marginTop:2 }}>{s.lbl}</div>
            </div>
          </React.Fragment>
        ))}
        </div>
      </div>

    </div>,
    document.body
  );
});

export default TicketWallet;

