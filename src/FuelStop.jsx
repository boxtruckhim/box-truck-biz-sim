// ═══════════════════════════════════════════════════════════════════════════
// FuelStop.jsx  —  Diesel Desk  ·  Box Truck Boss Phase 1 Game 2
// ───────────────────────────────────────────────────────────────────────────
// Mechanic: Corridor Lite + Diesel Timing hybrid
//   • Route-aware corridor with 1–4 regional fuel stops (scales with routeDistance)
//   • Live price ticker at each stop — lock rate to commit, then fill/skip
//   • Player's existing level/IAP discount pre-applied & displayed everywhere
//   • Post-round receipt showing savings vs auto-dispatch baseline
//   • Embedded Direction C: market event flashes explain price moves (Marcus voice)
//
// Integration contract (props from App.jsx):
//   onComplete({ cashSaved: number, tokensEarned: number, outcome: string })
//   onClose()
//   routeDistance: number        miles on the active run
//   currentFuelPrice: number     baseline $/gal in the game world
//   cash: number
//   currentDay: number
//   level: number
//   prestigeLevel: number
//   addNotification: (msg, type) => void
//   formatCurrency: (n) => string
//
// Technical notes:
//   • React 18 + hooks only — no class components
//   • All animations: CSS keyframes injected once via <style> tag
//   • All timers: useEffect with cleanup (non-negotiable)
//   • No external image dependencies — CSS/SVG only
//   • Android/Capacitor: touch events primary, WebkitTapHighlightColor transparent
//   • Min 44×44px on all interactive elements
//   • React.memo wrapper for performance
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';

// ─── GAME CONSTANTS ────────────────────────────────────────────────────────
const MPG           = 10;       // box truck miles per gallon — industry range 9–11, 10 used for clean math
const TANK_CAP      = 70;       // gallon tank capacity — standard dual-tank box truck (2×35 gal = 70 total)
const TICK_MS       = 1050;     // price tick interval (ms)
const NOISE_AMP     = 0.075;    // ± random walk amplitude per tick ($/gal)
const MEAN_REVERT   = 0.17;     // mean reversion strength toward stop base price
const PARTIAL_GAL   = 20;       // "top-off" button fill amount (proportional to 70-gal tank)
const SAFETY_MULT   = 1.08;     // safety factor for canSkip check
const STYLE_TAG_ID  = 'fs-kf';  // unique id for injected keyframe <style>

// ─── REGIONAL STOP CATALOGUE ───────────────────────────────────────────────
// priceMult: multiplier relative to currentFuelPrice (regional reality)
// A shuffle + selection builds the per-run corridor, ensuring variety
const STOP_CATALOG = [
  { label: 'Pilot FJ',     code: 'PFJ', col: '#1a56a0', priceMult: 1.04 },
  { label: "Love's TS",    code: 'LVS', col: '#d4820a', priceMult: 0.94 },
  { label: 'TA/Petro',     code: 'TA',  col: '#8b2a10', priceMult: 0.97 },
  { label: 'Murphy USA',   code: 'MRP', col: '#1a7a3a', priceMult: 0.86 },
  { label: 'Shell TS',     code: 'SHL', col: '#c4940f', priceMult: 1.09 },
  { label: 'Pilot FJ',     code: 'PFJ', col: '#1a56a0', priceMult: 0.91 },
  { label: "Love's TS",    code: 'LVS', col: '#d4820a', priceMult: 1.05 },
  { label: 'TA/Petro',     code: 'TA',  col: '#8b2a10', priceMult: 0.89 },
  { label: 'Speedway TS',  code: 'SPW', col: '#9b3a10', priceMult: 1.07 },
  { label: 'Wex Fleet',    code: 'WEX', col: '#4a6070', priceMult: 0.95 },
];

// ─── MARKET EVENT FLASH DATA ───────────────────────────────────────────────
// Fires rarely during price ticking — explains price moves (C-mechanic education)
const MARKET_EVENTS = [
  { prob: 0.07, delta: +0.07, msg: 'EIA report: crude inventory drawdown this week' },
  { prob: 0.06, delta: -0.08, msg: 'Gulf Coast terminal restocking — supply up' },
  { prob: 0.06, delta: +0.09, msg: 'Refinery maintenance reducing regional output' },
  { prob: 0.05, delta: -0.06, msg: 'Demand forecast revised downward by EIA' },
  { prob: 0.04, delta: +0.11, msg: 'OPEC+ signals production cut next quarter' },
  { prob: 0.05, delta: -0.07, msg: 'Seasonal shift — heating oil demand off-peak' },
];

// ─── MARCUS RODRIGUEZ TIP DATABASE ────────────────────────────────────────
const MARCUS = {
  cheapStop:     "That's a low regional price. Lock when you see a down-tick — cheapest window on this corridor.",
  priceyStop:    "High-cost region. If your tank can reach the next stop, consider skipping ahead.",
  lowTank:       "Tank under 25% — fill now regardless of price. A dry truck costs more than any surcharge.",
  goodLock:      "Clean lock. You caught it near the dip. That's the read experienced drivers make.",
  borderLock:    "Decent timing. A little above the session low but well clear of the spike.",
  badLock:       "Bought near the peak. Next time watch for two consecutive down-ticks before locking.",
  optimalRun:    "Textbook corridor strategy. Cheapest regional price, timed right.",
  goodRun:       "Solid fuel discipline. You beat the auto-dispatch baseline this run.",
  averageRun:    "Room to improve on the next corridor. Study the regional price map before you lock.",
  poorRun:       "Fuel cost came in above baseline. Watch the trend bars — lock on the down-ticks.",
};



// ─── MARCUS TYPEWRITER — 30ms/char reveal for live-dialogue feel ────────────
const useTypewriter = (text, active = true, speed = 30) => {
  const [displayed, setDisplayed] = React.useState('');
  React.useEffect(() => {
    if (!active || !text) { setDisplayed(text || ''); return; }
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return displayed;
};

// ─── WEB AUDIO SOUND ENGINE ────────────────────────────────────────────────
// All 10 game sounds synthesised with the Web Audio API — zero files,
// zero network requests, works offline on Capacitor iOS/Android.
// AudioContext is created on the player's first gesture (browser policy).
// Mute state is read via a ref so play() stays a stable reference.
//
// Sound index:
//   tick_down / tick_up / tick_flat  price-tick direction (every 1.05s)
//   dip_hint                         price near session low
//   lock                             rate committed
//   fill_full / fill_partial         tank filled
//   skip                             stop passed without fueling
//   market_event                     breaking-news price flash
//   receipt_print                    thermal printer on receipt reveal
//   outcome_optimal/good/average/poor  run-end harmonic chord
//
const useSoundEngine = (muted) => {
  const ctxRef   = useRef(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // Close context on unmount
  useEffect(() => () => { ctxRef.current?.close().catch(() => {}); ctxRef.current = null; }, []);

  // Must be called inside a user-gesture handler (iOS/Android autoplay policy)
  const initCtx = useCallback(() => {
    if (!ctxRef.current) {
      try { ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  // Stable — reads muted via ref, safe in any deps array
  const play = useCallback((type) => {
    if (mutedRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === 'closed') return;
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.82;
    master.connect(ctx.destination);
    try {
      const osc = (type_, freq) => {
        const o = ctx.createOscillator(); o.type = type_; o.frequency.value = freq; return o;
      };
      const gain = () => ctx.createGain();
      const wire = (...nodes) => { nodes.reduce((a, b) => { a.connect(b); return b; }); };
      switch (type) {
        case 'tick_down': {
          const o = osc('sine', 880), g = gain();
          o.frequency.exponentialRampToValueAtTime(620, t + 0.085);
          g.gain.setValueAtTime(0.055, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
          wire(o, g, master); o.start(t); o.stop(t + 0.09); break;
        }
        case 'tick_up': {
          const o = osc('sine', 620), g = gain();
          o.frequency.exponentialRampToValueAtTime(880, t + 0.085);
          g.gain.setValueAtTime(0.055, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.085);
          wire(o, g, master); o.start(t); o.stop(t + 0.09); break;
        }
        case 'tick_flat': {
          const o = osc('triangle', 700), g = gain();
          g.gain.setValueAtTime(0.018, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
          wire(o, g, master); o.start(t); o.stop(t + 0.048); break;
        }
        case 'dip_hint': {
          [{ f: 523.25, v: 0.16, on: 0 }, { f: 659.25, v: 0.10, on: 0.035 }].forEach(({ f, v, on }) => {
            const o = osc('sine', f), g = gain(); const s = t + on;
            g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(v, s + 0.022);
            g.gain.exponentialRampToValueAtTime(0.001, s + 0.30);
            wire(o, g, master); o.start(s); o.stop(s + 0.32);
          }); break;
        }
        case 'lock': {
          // High transient click
          const o1 = osc('square', 1400), g1 = gain();
          o1.frequency.exponentialRampToValueAtTime(180, t + 0.048);
          g1.gain.setValueAtTime(0.16, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
          wire(o1, g1, master); o1.start(t); o1.stop(t + 0.06);
          // Low body thud
          const o2 = osc('sine', 90), g2 = gain();
          o2.frequency.exponentialRampToValueAtTime(38, t + 0.16);
          g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.22, t + 0.028);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          wire(o2, g2, master); o2.start(t); o2.stop(t + 0.20); break;
        }
        case 'fill_full':
        case 'fill_partial': {
          const full = type === 'fill_full';
          const dur  = full ? 0.22 : 0.14;
          const vol  = full ? 0.20 : 0.14;
          // Liquid noise burst
          const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
          const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = b;
          const fil = ctx.createBiquadFilter(); fil.type = 'bandpass'; fil.frequency.value = 380; fil.Q.value = 0.9;
          const gn = gain();
          gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
          wire(src, fil, gn, master); src.start(t);
          // Ascending tones (C5 E5 for partial; add G5 for full)
          const notes = full ? [523.25, 659.25, 783.99] : [523.25, 659.25];
          notes.forEach((f, i) => {
            const o = osc('triangle', f), g = gain(); const on = t + (full ? 0.11 : 0.065) + i * 0.075;
            g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(full ? 0.13 : 0.11, on + 0.018);
            g.gain.exponentialRampToValueAtTime(0.001, on + 0.14);
            wire(o, g, master); o.start(on); o.stop(on + 0.16);
          }); break;
        }
        case 'skip': {
          const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.16), ctx.sampleRate);
          const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
          const src = ctx.createBufferSource(); src.buffer = b;
          const fil = ctx.createBiquadFilter(); fil.type = 'highpass'; fil.frequency.value = 2200;
          const gn = gain();
          gn.gain.setValueAtTime(0.09, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
          wire(src, fil, gn, master); src.start(t); break;
        }
        case 'market_event': {
          [0, 0.115].forEach(delay => {
            const o = osc('sine', 1046.5), g = gain(); const on = t + delay;
            g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(0.13, on + 0.010);
            g.gain.setValueAtTime(0.13, on + 0.042); g.gain.exponentialRampToValueAtTime(0.001, on + 0.072);
            wire(o, g, master); o.start(on); o.stop(on + 0.08);
          }); break;
        }
        case 'receipt_print': {
          for (let i = 0; i < 14; i++) {
            const on = t + i * 0.036; const dur = 0.021;
            const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
            const d = b.getChannelData(0); for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
            const src = ctx.createBufferSource(); src.buffer = b;
            const fil = ctx.createBiquadFilter(); fil.type = 'bandpass'; fil.frequency.value = 900; fil.Q.value = 2.2;
            const gn = gain();
            gn.gain.setValueAtTime(0.065, on); gn.gain.exponentialRampToValueAtTime(0.001, on + dur);
            wire(src, fil, gn, master); src.start(on);
          } break;
        }
        case 'outcome_optimal': { // Warm major-7 chord C5-E5-G5-B5
          [523.25, 659.25, 783.99, 987.77].forEach((f, i) => {
            const o = osc('triangle', f), g = gain(); const on = t + i * 0.042;
            g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(0.12, on + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, on + 0.52);
            wire(o, g, master); o.start(on); o.stop(on + 0.56);
          }); break;
        }
        case 'outcome_good': { // Major triad C5-E5-G5
          [523.25, 659.25, 783.99].forEach((f, i) => {
            const o = osc('triangle', f), g = gain(); const on = t + i * 0.036;
            g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(0.11, on + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, on + 0.40);
            wire(o, g, master); o.start(on); o.stop(on + 0.44);
          }); break;
        }
        case 'outcome_average': { // Single resolved note C5
          const o = osc('triangle', 523.25), g = gain();
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.10, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          wire(o, g, master); o.start(t); o.stop(t + 0.32); break;
        }
        case 'outcome_poor': { // Descending minor 3rd C5 → A4
          const o = osc('triangle', 523.25), g = gain();
          o.frequency.exponentialRampToValueAtTime(440.00, t + 0.22);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          wire(o, g, master); o.start(t); o.stop(t + 0.32); break;
        }
        default: break;
      }
    } catch (_) { /* silent fail — sound is enhancement, not critical path */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — reads muted via mutedRef

  return { play, initCtx };
};

// ─── LEVEL DISCOUNT CALCULATOR (mirrors App.jsx getLevelPerks) ─────────────
// Returns the level-based fuel discount (0.0 → 0.10)
// IAP card (15%) and permanent IAP discount stack in App.jsx on top of this.
// The game prop `currentFuelPrice` already incorporates regional/difficulty mults,
// so we only need to apply the level-based layer here.
const getLevelDiscount = (level) => {
  const l = Math.min(level || 1, 20);
  return l >= 3 ? Math.min(0.10, ((l - 2) / 18) * 0.10) : 0;
};

const getDiscountBreakdown = (level) => {
  const l = Math.min(level || 1, 20);
  const pct = Math.round(getLevelDiscount(l) * 100);
  if (l < 3) return { label: 'Fuel network unlocks at Level 3', pct: 0 };
  return {
    label: `Level ${l} fuel network · ${pct}% off · IAP card stacks on top`,
    pct,
  };
};

// ─── ROUTE GENERATOR ───────────────────────────────────────────────────────
// Builds 1–4 stops scaled to routeDistance with realistic price variation.
// Guarantees at least one notably cheap stop for strategic value.
const generateRoute = (routeDistance, currentFuelPrice) => {
  const dist   = Math.max(50, routeDistance || 200);
  const cpf    = Math.max(1.0, currentFuelPrice || 3.15);

  // Stop count by distance tier
  const count = dist < 150 ? 1
    : dist < 350          ? 2
    : dist < 560          ? 3
    : 4;

  // Shuffle catalog
  const shuffled = [...STOP_CATALOG]
    .map(s => ({ ...s, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort);

  // Guarantee a cheap stop (priceMult ≤ 0.91) somewhere in the corridor
  const cheapEntry = STOP_CATALOG
    .filter(s => s.priceMult <= 0.91)
    .sort(() => Math.random() - 0.5)[0];
  const cheapIdx  = count > 1
    ? (count === 2 ? 1 : Math.floor(count * 0.45))
    : 0;

  const selected = shuffled.slice(0, count);
  if (count > 1) selected.splice(cheapIdx, 1, cheapEntry);

  // Mile markers — spread stops along the route
  const positions = [0, 0.36, 0.62, 0.84];

  const stops = selected.map((tmpl, i) => {
    // Per-run ±5¢ random variance on top of template priceMult
    const runVar   = (Math.random() - 0.5) * 0.10;
    const mult     = Math.max(0.78, Math.min(1.30, tmpl.priceMult + runVar));
    const basePrice = +(cpf * mult).toFixed(3);

    return {
      idx:       i,
      label:     tmpl.label,
      code:      tmpl.code,
      col:       tmpl.col,
      mile:      Math.round(dist * positions[i]),
      basePrice,           // mean price the ticker revolves around
      priceMult: mult,
    };
  });

  // Starting tank: 26–44% (realistic post-previous-run depletion)
  const startGal = +(TANK_CAP * (0.26 + Math.random() * 0.18)).toFixed(1);
  const galNeeded = +(dist / MPG).toFixed(1);

  return { stops, startGal, totalMiles: dist, galNeeded };
};

// ─── CSS KEYFRAMES ─────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes fs-slideUp {
  from { opacity:0; transform:translateY(22px) scale(0.98); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
@keyframes fs-fadeIn {
  from { opacity:0; }
  to   { opacity:1; }
}
@keyframes fs-priceFlash {
  0%   { opacity:1; transform:translateY(0);   }
  18%  { opacity:0.2; transform:translateY(-3px); }
  55%  { opacity:1; transform:translateY(0);   }
  100% { opacity:1; }
}
@keyframes fs-lockBurst {
  0%   { transform:scale(1);    }
  28%  { transform:scale(0.93); }
  60%  { transform:scale(1.05); }
  100% { transform:scale(1);    }
}
@keyframes fs-routePulse {
  0%, 100% { box-shadow:0 0 0 0 rgba(255,153,0,0.6); }
  50%       { box-shadow:0 0 0 6px rgba(255,153,0,0);  }
}
@keyframes fs-receiptReveal {
  from { opacity:0; transform:translateY(28px) scaleY(0.90); transform-origin:top; }
  to   { opacity:1; transform:translateY(0)    scaleY(1);    }
}
@keyframes fs-tipSlide {
  from { opacity:0; transform:translateX(-10px); }
  to   { opacity:1; transform:translateX(0);     }
}
@keyframes fs-tankFill {
  from { width:0%; }
}
@keyframes fs-hudPulse {
  0%, 100% { opacity:1;    }
  50%       { opacity:0.45; }
}
@keyframes fs-eventPop {
  0%   { opacity:0; transform:translateY(8px);  }
  15%  { opacity:1; transform:translateY(0);    }
  80%  { opacity:1; }
  100% { opacity:0; }
}
@keyframes fs-successPop {
  0%   { transform:scale(0.82); opacity:0; }
  55%  { transform:scale(1.06); }
  100% { transform:scale(1);    opacity:1; }
}
@keyframes fs-introPulse {
  0%, 100% { opacity:0.6; transform:scaleX(1);    }
  50%       { opacity:1;   transform:scaleX(1.02); }
}
@keyframes fs-barMorph {
  from { height:4px; }
}
@keyframes fs-dipHint {
  0%, 100% { box-shadow:0 0 0 0 rgba(255,153,0,0.45); }
  50%       { box-shadow:0 0 0 9px rgba(255,153,0,0);   }
}
@keyframes fs-wave {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes fs-waveUrg {
  0%   { transform: translateX(0) scaleY(1.0); }
  50%  { transform: translateX(-25%) scaleY(1.4); }
  100% { transform: translateX(-50%) scaleY(1.0); }
}
@keyframes fs-vignette {
  0%, 100% { opacity: 0.55; }
  50%       { opacity: 0.85; }
}
@keyframes fs-flipIn {
  0%   { transform: rotateX(-90deg); opacity: 0; }
  60%  { transform: rotateX(12deg);  opacity: 1; }
  100% { transform: rotateX(0deg);   opacity: 1; }
}
@keyframes fs-particle {
  0%   { transform: translate(-50%,-50%) scale(1);   opacity:1; }
  100% { transform: translate(calc(-50% + var(--pTx,10px)), calc(-50% + var(--pTy,-18px))) scale(0.3); opacity:0; }
}
@keyframes fs-sparkDraw {
  from { stroke-dashoffset: var(--dash-len, 200); }
  to   { stroke-dashoffset: 0; }
}
@keyframes fs-receiptLine {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
@keyframes fs-lockGlow {
  0%   { box-shadow:0 0 0   rgba(0,212,122,0.6); }
  40%  { box-shadow:0 0 28px rgba(0,212,122,0.22); }
  100% { box-shadow:0 0 0   rgba(0,212,122,0);   }
}
@keyframes fs-warnBorder {
  0%, 100% { border-color:rgba(255,72,88,0.18); }
  50%       { border-color:rgba(255,72,88,0.60); }
}
@keyframes fs-intCard {
  from { opacity:0; transform:translateY(14px) scale(0.985); }
  to   { opacity:1; transform:translateY(0)    scale(1);     }
}
@keyframes fs-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes fs-ledFlicker {
  0%, 95%, 100% { opacity:1; }
  96%            { opacity:0.88; }
  97%            { opacity:1; }
  98%            { opacity:0.92; }
}
@keyframes fs-dipBadge {
  from { opacity:0; transform:translateY(-4px); }
  to   { opacity:1; transform:translateY(0);    }
}
@keyframes fs-stopEnter {
  from { opacity:0; transform:translateX(18px) scale(0.97); }
  to   { opacity:1; transform:translateX(0)    scale(1);    }
}
`;

// ─── STYLE HELPERS ─────────────────────────────────────────────────────────
const F = "'Outfit','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif";
const M = "'Courier New',Courier,monospace";

const COLORS = {
  bg:      '#07080f',
  surface: '#0b0e18',
  card:    '#0d1929',
  cardAlt: '#0f1c2e',
  border:  'rgba(255,153,0,0.18)',
  amber:   '#FF9900',
  amberDim:'rgba(255,153,0,0.10)',
  green:   '#00d47a',
  greenDim:'rgba(0,212,122,0.10)',
  red:     '#ff4858',
  redDim:  'rgba(255,72,88,0.10)',
  text:    '#c8d8e8',
  textMid: '#7a90a8',
  textDim: '#3d5060',
  white:   '#e8f0f8',
};

const tank_color = (pct) =>
  pct < 25 ? COLORS.red : pct < 50 ? COLORS.amber : COLORS.green;

// Shared touch-friendly button base
const BTN_BASE = {
  fontFamily: F,
  fontWeight: 700,
  cursor: 'pointer',
  border: 'none',
  borderRadius: 10,
  minHeight: 46,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
  userSelect: 'none',
  transition: 'opacity 0.15s',
};

// ══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

// ─── HEADER BAR ────────────────────────────────────────────────────────────
const Header = React.memo(({ currentDay, onClose, phase, stopIdx, stopCount, soundMuted, onToggleSound }) => {
  const progressPct = stopCount > 0
    ? Math.round((stopIdx / stopCount) * 100)
    : 0;

  return (
    <div style={{
      background: COLORS.surface,
      borderBottom: `1px solid ${COLORS.border}`,
      padding: `max(10px, env(safe-area-inset-top, 10px)) 14px 10px`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Close button */}
      {phase !== 'receipt' && (
        <button
          onClick={onClose}
          style={{
            ...BTN_BASE,
            width: 44, height: 44, minHeight: 44,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: COLORS.textMid,
            fontSize: 15,
            flexShrink: 0,
          }}
          aria-label="Close fuel game"
        >
          ✕
        </button>
      )}

      {/* Title block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: F,
          fontWeight: 700,
          fontSize: 13,
          color: COLORS.amber,
          letterSpacing: '0.4px',
          lineHeight: 1.2,
        }}>
          Diesel Desk
        </div>
        <div style={{
          fontFamily: M,
          fontSize: 9,
          color: COLORS.textDim,
          letterSpacing: '0.6px',
          marginTop: 1,
        }}>
          {phase === 'intro'    && 'ROUTE BRIEFING'}
          {phase === 'corridor' && `STOP ${stopIdx + 1} / ${stopCount} · EN ROUTE`}
          {phase === 'receipt'  && 'RUN COMPLETE'}
        </div>
      </div>

      {/* Day badge */}
      <div style={{
        fontFamily: M,
        fontSize: 10,
        color: COLORS.textDim,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6,
        padding: '4px 9px',
        flexShrink: 0,
      }}>
        Day {currentDay}
      </div>

      {/* Mute toggle — always visible so player can silence mid-run */}
      <button
        onClick={onToggleSound}
        style={{
          ...BTN_BASE,
          width: 44, height: 44, minHeight: 44,
          borderRadius: 10,
          background: soundMuted ? 'rgba(255,153,0,0.08)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${soundMuted ? 'rgba(255,153,0,0.25)' : 'rgba(255,255,255,0.08)'}`,
          color: soundMuted ? COLORS.amber : COLORS.textMid,
          fontSize: 17,
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        }}
        aria-label={soundMuted ? 'Unmute sound' : 'Mute sound'}
      >
        {soundMuted ? '🔇' : '🔊'}
      </button>

      {/* Progress bar (corridor only) */}
      {phase === 'corridor' && stopCount > 1 && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 2,
          background: 'rgba(255,153,0,0.12)',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: COLORS.amber,
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </div>
  );
});

// ─── HUD STRIP ─────────────────────────────────────────────────────────────
const HUD = React.memo(({ tankGal, cashSpent, milesLeft, formatCurrency, streak }) => {
  const pct = Math.round((tankGal / TANK_CAP) * 100);
  const col = tank_color(pct);
  const lowFuel = pct < 25;

  return (
    <div style={{
      background: COLORS.surface,
      borderBottom: `1px solid rgba(255,153,0,0.10)`,
      padding: '8px 14px',
      flexShrink: 0,
      border: lowFuel ? '1px solid rgba(255,72,88,0.35)' : undefined,
      animation: lowFuel ? 'fs-warnBorder 1.4s ease-in-out infinite' : 'none',
      transition: 'border-color 0.4s',
    }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
        {/* Tank */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontFamily: M, fontSize: 8, color: COLORS.textDim, letterSpacing: '0.5px' }}>
            TANK
          </div>
          <div style={{
            fontFamily: M, fontSize: 14, fontWeight: 700,
            color: col,
            animation: lowFuel ? 'fs-hudPulse 1.2s ease-in-out infinite' : 'none',
          }}>
            {pct}%
          </div>
        </div>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

        {/* Miles left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontFamily: M, fontSize: 8, color: COLORS.textDim, letterSpacing: '0.5px' }}>
            MI LEFT
          </div>
          <div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            {milesLeft.toLocaleString()}
          </div>
        </div>

        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

        {/* Spent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontFamily: M, fontSize: 8, color: COLORS.textDim, letterSpacing: '0.5px' }}>
            SPENT
          </div>
          <div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: COLORS.red }}>
            {formatCurrency(cashSpent)}
          </div>
        </div>

        {/* Streak badge — appears after 2+ consecutive good-timing fills */}
        {streak >= 2 && (
          <>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              <div style={{ fontFamily: M, fontSize: 8, color: COLORS.amber, letterSpacing: '0.5px' }}>
                STREAK
              </div>
              <div style={{ fontFamily: M, fontSize: 14, fontWeight: 700, color: COLORS.amber, animation: 'fs-hudPulse 1.4s ease-in-out infinite' }}>
                🔥{streak}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Liquid wave tank gauge */}
      <div style={{
        background: 'rgba(0,0,0,0.35)',
        borderRadius: 5,
        height: 14,
        overflow: 'hidden',
        position: 'relative',
        border: `1px solid ${col}22`,
        transition: 'border-color 0.4s',
      }}>
        {/* Fill level backdrop */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: `${pct}%`,
          background: `${col}22`,
          transition: 'width 0.55s ease',
        }} />
        {/* Animated SVG wave */}
        <svg
          viewBox="0 0 200 14"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            top: 0, left: `calc(${pct}% - 200px)`,
            width: 200, height: 14,
            transition: 'left 0.55s ease',
            overflow: 'visible',
          }}
          aria-hidden="true"
        >
          <defs>
            <clipPath id="fs-wave-clip">
              <rect x="100" y="0" width="100" height="14" />
            </clipPath>
          </defs>
          {/* Double-width wave path for seamless loop */}
          <g style={{ animation: lowFuel ? 'fs-waveUrg 0.7s linear infinite' : 'fs-wave 1.8s linear infinite' }}>
            <path
              d="M0,7 Q12.5,3 25,7 Q37.5,11 50,7 Q62.5,3 75,7 Q87.5,11 100,7 Q112.5,3 125,7 Q137.5,11 150,7 Q162.5,3 175,7 Q187.5,11 200,7 L200,14 L0,14 Z"
              fill={col}
              opacity="0.75"
            />
            <path
              d="M0,9 Q12.5,5 25,9 Q37.5,13 50,9 Q62.5,5 75,9 Q87.5,13 100,9 Q112.5,5 125,9 Q137.5,13 150,9 Q162.5,5 175,9 Q187.5,13 200,9 L200,14 L0,14 Z"
              fill={col}
              opacity="0.35"
            />
          </g>
        </svg>
        {/* Percentage label centred in gauge */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: M, fontSize: 8, fontWeight: 700,
          color: pct > 40 ? '#000' : col,
          letterSpacing: '0.8px',
          zIndex: 2,
          mixBlendMode: pct > 40 ? 'normal' : 'normal',
          textShadow: pct > 40 ? 'none' : '0 0 4px rgba(0,0,0,0.8)',
        }}>
          {pct}% · {tankGal.toFixed(1)} gal
        </div>
      </div>
    </div>
  );
});

// ─── ROUTE BAR ─────────────────────────────────────────────────────────────
const RouteBar = React.memo(({ stops, stopIdx, fills, totalMiles }) => {
  const filledAt  = new Set(fills.map(f => f.stopIdx));
  const allPrices = stops.map(s => s.basePrice);
  const cheapest  = Math.min(...allPrices);

  return (
    <div style={{ padding: '8px 16px 4px', position: 'relative' }}>
      {/* Road strip — asphalt texture base */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg,#1a1f2a 0%,#12161f 100%)',
        borderRadius: 8,
        height: 40,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Dashed centre line — animated for motion feel */}
        <div style={{
          position: 'absolute',
          top: '50%', left: 0, right: 0,
          height: 2,
          background: 'repeating-linear-gradient(90deg,rgba(255,200,0,0.5) 0px,rgba(255,200,0,0.5) 14px,transparent 14px,transparent 28px)',
          transform: 'translateY(-50%)',
        }} />

        {/* Progress bar — road driven so far */}
        {stopIdx > 0 && (
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0,
            width: `${Math.round((stopIdx / (stops.length)) * 100)}%`,
            background: 'linear-gradient(90deg,rgba(0,212,122,0.08),rgba(0,212,122,0.03))',
            transition: 'width 0.6s ease',
            borderRight: '2px solid rgba(0,212,122,0.30)',
          }} />
        )}

        {/* Stop exit signs */}
        {stops.map((stop, i) => {
          const xPct   = Math.round(((i + 0.5) / (stops.length + 0.5)) * 100);
          const done    = i < stopIdx;
          const current = i === stopIdx;
          const cheap   = stop.basePrice === cheapest && !done;
          const filled  = filledAt.has(i);

          const bgSign = done    ? 'rgba(0,212,122,0.22)'
            : current            ? 'rgba(255,153,0,0.25)'
            : cheap              ? 'rgba(0,212,122,0.12)'
            :                      'rgba(255,255,255,0.07)';
          const borderSign = done ? 'rgba(0,212,122,0.5)'
            : current             ? COLORS.amber
            : cheap               ? 'rgba(0,212,122,0.4)'
            :                       'rgba(255,255,255,0.14)';

          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${xPct}%`,
              top: '50%',
              transform: 'translate(-50%,-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}>
              {/* Exit sign chip */}
              <div style={{
                background: bgSign,
                border: `1px solid ${borderSign}`,
                borderRadius: 4,
                padding: '2px 5px',
                fontFamily: M,
                fontSize: 8,
                fontWeight: 700,
                color: done    ? COLORS.green
                  : current    ? COLORS.amber
                  : cheap      ? COLORS.green
                  :              COLORS.textMid,
                whiteSpace: 'nowrap',
                animation: current ? 'fs-routePulse 2s ease-in-out infinite' : 'none',
                transition: 'all 0.3s',
                lineHeight: 1.4,
              }}>
                {done && filled ? `✓ ${stop.code}`
                  : done        ? `→ ${stop.code}`
                  : cheap       ? `★ ${stop.code}`
                  :               stop.code}
              </div>
              {/* Price tag below sign */}
              <div style={{
                fontFamily: M, fontSize: 7,
                color: cheap && !done ? COLORS.green : COLORS.textDim,
                fontWeight: cheap && !done ? 700 : 400,
                letterSpacing: '0.2px',
              }}>
                ${stop.basePrice.toFixed(2)}
              </div>
            </div>
          );
        })}

        {/* Destination — city skyline silhouette */}
        <div style={{
          position: 'absolute',
          right: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          {/* Minimal skyline SVG */}
          <svg width="20" height="14" viewBox="0 0 20 14" fill="rgba(74,158,255,0.55)" aria-hidden="true">
            <rect x="1" y="6" width="3" height="8"/>
            <rect x="5" y="3" width="3" height="11"/>
            <rect x="9" y="5" width="2" height="9"/>
            <rect x="12" y="1" width="4" height="13"/>
            <rect x="17" y="5" width="2" height="9"/>
          </svg>
          <div style={{ fontFamily: M, fontSize: 7, color: '#3a6898', letterSpacing: '0.3px' }}>
            DEST
          </div>
        </div>
      </div>

      {/* Total miles label */}
      <div style={{ fontFamily: M, fontSize: 8, color: COLORS.textDim, textAlign: 'right', marginTop: 3, letterSpacing: '0.3px' }}>
        {totalMiles} mi corridor
      </div>
    </div>
  );
});

// ─── PRICE BOARD ───────────────────────────────────────────────────────────

// ─── FLIP DIGIT — split-flap mechanical animation per character ──────────────
// Each digit gets a fresh key when its character changes, triggering fs-flipIn.
// Only changed digits animate — stable digits (like the decimal point) stay still.
const FlipDigit = React.memo(({ char, color, fontSize = 44 }) => (
  <span
    style={{
      display: 'inline-block',
      fontFamily: M,
      fontSize,
      fontWeight: 700,
      color,
      lineHeight: 1,
      animation: 'fs-flipIn 0.22s cubic-bezier(0.23,1,0.32,1)',
      willChange: 'transform, opacity',
      perspective: 200,
    }}
  >
    {char}
  </span>
));

const PriceBoard = React.memo(({ pumpPrice, effPrice, priceHist, locked, priceKey, dipHint }) => {
  const hist    = priceHist.length ? priceHist : [pumpPrice];
  const maxP    = Math.max(...hist);
  const minP    = Math.min(...hist);
  const range   = maxP - minP || 0.04;

  const prev    = hist.length > 1 ? hist[hist.length - 2] : pumpPrice;
  const rising  = pumpPrice > prev;
  const falling = pumpPrice < prev;

  const borderCol = locked
    ? 'rgba(0,212,122,0.40)'
    : dipHint
    ? 'rgba(255,153,0,0.50)'
    : 'rgba(255,153,0,0.15)';

  return (
    <div style={{
      background: locked ? '#00100a' : '#000',
      borderRadius: 10,
      padding: '12px 16px',
      border: `1px solid ${borderCol}`,
      marginBottom: 10,
      transition: 'background 0.6s, border-color 0.3s',
      position: 'relative',
      overflow: 'hidden',
      animation: locked ? 'fs-lockGlow 0.9s ease-out forwards' : 'none',
    }}>
      {/* CRT scan-line overlay — static subtle lines */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 10,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)',
        pointerEvents: 'none', zIndex: 2,
      }} />

      {/* Main price row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, position: 'relative', zIndex: 3 }}>
        {/* Pump price (LED) */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontFamily: M, fontSize: 8, color: locked ? '#1a4a30' : '#2a3a44',
            letterSpacing: '1.5px', marginBottom: 4,
          }}>
            {locked ? 'LOCKED RATE' : 'PUMP PRICE'}
          </div>
          {/* Flip-clock: each digit animates independently when its value changes */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center',
            gap: 0, letterSpacing: '3px', lineHeight: 1,
            animation: locked ? 'fs-ledFlicker 8s ease-in-out infinite' : 'none',
            transition: 'color 0.4s',
          }}>
            {pumpPrice.toFixed(3).split('').map((ch, i) => (
              <FlipDigit
                key={`p${i}-${ch}`}
                char={ch}
                color={locked ? COLORS.green : COLORS.amber}
                fontSize={44}
              />
            ))}
          </div>
          <div style={{ fontFamily: F, fontSize: 9, color: locked ? '#1a4a30' : '#2a3a44', marginTop: 3 }}>
            $/gallon — regional
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: locked ? 'rgba(0,212,122,0.15)' : 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

        {/* Effective price */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontFamily: M, fontSize: 8, color: locked ? '#1a4a30' : '#2a3a44', letterSpacing: '1.5px', marginBottom: 4 }}>
            YOUR RATE
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center',
            gap: 0, letterSpacing: '2px', lineHeight: 1,
            animation: locked ? 'fs-ledFlicker 8s ease-in-out infinite' : 'none',
          }}>
            {effPrice.toFixed(3).split('').map((ch, i) => (
              <FlipDigit
                key={`e${i}-${ch}`}
                char={ch}
                color={COLORS.green}
                fontSize={28}
              />
            ))}
          </div>
          <div style={{ fontFamily: F, fontSize: 9, color: locked ? '#1a4a30' : '#2a3a44', marginTop: 3 }}>
            after your discount
          </div>
        </div>
      </div>

      {/* SVG spark line + trend + session range */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 12,
        position: 'relative', zIndex: 3,
      }}>
        {/* Spark line SVG */}
        {hist.length > 1 && (() => {
          const W = 110, H = 28;
          const step = W / (hist.length - 1);
          const pts = hist.map((p, i) => {
            const x = +(i * step).toFixed(1);
            const y = +(H - 2 - ((p - minP) / range) * (H - 6)).toFixed(1);
            return `${x},${y}`;
          });
          const polyline = pts.join(' ');
          const approxLen = Math.round(hist.length * step * 1.2);
          const lineCol = locked ? COLORS.green
            : falling            ? COLORS.green
            : rising             ? COLORS.red
            :                      COLORS.textDim;
          return (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
              style={{ flexShrink: 0, willChange: 'transform' }}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="fs-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineCol} stopOpacity="0.20" />
                  <stop offset="100%" stopColor={lineCol} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points={`${pts[0]} ${pts[pts.length-1].split(',')[0]},${H} 0,${H}`}
                fill="url(#fs-spark-fill)"
                stroke="none"
              />
              <polyline
                key={hist.length}
                points={polyline}
                fill="none"
                stroke={lineCol}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  strokeDasharray: approxLen,
                  strokeDashoffset: approxLen,
                  animation: `fs-sparkDraw 0.5s ease-out forwards`,
                  '--dash-len': approxLen,
                }}
              />
              <circle
                cx={pts[pts.length - 1].split(',')[0]}
                cy={pts[pts.length - 1].split(',')[1]}
                r="3"
                fill={lineCol}
              />
            </svg>
          );
        })()}

        {/* Trend label */}
        <div style={{
          fontFamily: M,
          fontSize: 10,
          color: locked ? COLORS.green
            : rising    ? COLORS.red
            : falling   ? COLORS.green
            :              COLORS.textDim,
          letterSpacing: '0.3px',
          flexShrink: 0,
        }}>
          {locked   ? '🔒 LOCKED'
            : rising  ? '▲ rising'
            : falling ? '▼ falling'
            :           '→ flat'}
        </div>

        {/* Session range */}
        <div style={{ fontFamily: M, fontSize: 8, color: COLORS.textDim, textAlign: 'right', flexShrink: 0 }}>
          lo ${Math.max(0, minP).toFixed(3)}{'\n'}hi ${maxP.toFixed(3)}
        </div>
      </div>
    </div>
  );
});

// ─── MARKET EVENT FLASH ─────────────────────────────────────────────────────
const EventFlash = React.memo(({ msg }) => {
  if (!msg) return null;
  return (
    <div style={{
      background: 'rgba(255,140,0,0.10)',
      border: '1px solid rgba(255,153,0,0.30)',
      borderLeft: `3px solid ${COLORS.amber}`,
      borderRadius: '0 8px 8px 0',
      padding: '8px 12px',
      marginBottom: 9,
      animation: 'fs-eventPop 3.5s ease forwards',
      fontFamily: F,
      fontSize: 11,
      color: COLORS.white,
      lineHeight: 1.45,
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{ fontFamily: M, fontSize: 9, color: COLORS.amber, marginBottom: 3, letterSpacing: '0.5px' }}>
        📡 MARKET EVENT
      </div>
      {msg}
    </div>
  );
});

// ─── MARCUS TIP ────────────────────────────────────────────────────────────
const MarcosTip = React.memo(({ tip }) => {
  const typed = useTypewriter(tip, !!tip, 28);
  if (!tip) return null;
  return (
    <div style={{
      background: '#0d1624',
      borderLeft: `3px solid ${COLORS.amber}`,
      borderRadius: '0 7px 7px 0',
      padding: '8px 12px',
      marginBottom: 9,
      animation: 'fs-tipSlide 0.3s ease-out',
    }}>
      <div style={{
        fontFamily: F, fontSize: 11, color: COLORS.textMid, lineHeight: 1.5,
      }}>
        <span style={{ color: COLORS.amber, fontWeight: 700, marginRight: 4 }}>Marcus:</span>
        {typed}
      </div>
    </div>
  );
});

// ─── DISCOUNT STRIP ─────────────────────────────────────────────────────────
const DiscountStrip = React.memo(({ level }) => {
  const { label, pct } = getDiscountBreakdown(level);
  if (pct === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 7,
        padding: '6px 11px',
        marginBottom: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: F, fontSize: 10, color: COLORS.textDim }}>
          {label}
        </div>
        <div style={{ fontFamily: M, fontSize: 11, color: COLORS.textDim, fontWeight: 700 }}>
          0%
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.greenDim,
      border: '1px solid rgba(0,212,122,0.18)',
      borderRadius: 7,
      padding: '6px 11px',
      marginBottom: 9,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontFamily: F, fontSize: 10, color: '#3d7050' }}>
          Your discount — already applied to "your rate" above
        </div>
        <div style={{ fontFamily: F, fontSize: 9, color: '#2a5040', marginTop: 1 }}>
          {label}
        </div>
      </div>
      <div style={{ fontFamily: M, fontSize: 13, color: COLORS.green, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
        −{pct}%
      </div>
    </div>
  );
});

// ─── STOP CARD ─────────────────────────────────────────────────────────────
const StopCard = React.memo(({
  stop,
  pumpPrice,
  effPrice,
  priceHist,
  priceKey,
  locked,
  lockedPrice,
  lockedEffPrice,
  tankGal,
  canSkip,
  isLocking,
  dipHint,
  onLock,
  onFill,
  onSkip,
  marcosTip,
  eventMsg,
  level,
  formatCurrency,
}) => {
  const pct     = Math.round((tankGal / TANK_CAP) * 100);
  const fullGal = +(TANK_CAP - tankGal).toFixed(1);
  const partGal = Math.min(PARTIAL_GAL, fullGal);
  const costFull  = lockedPrice ? +(fullGal * lockedEffPrice).toFixed(2)  : 0;
  const costPart  = lockedPrice ? +(partGal * lockedEffPrice).toFixed(2)  : 0;

  // Track whether the player locked while a dip hint was active — triggers particle burst
  const [lockedAtDip, setLockedAtDip] = React.useState(false);
  const [showParticles, setShowParticles] = React.useState(false);
  const prevLockedRef = React.useRef(false);
  React.useEffect(() => {
    if (locked && !prevLockedRef.current && dipHint) {
      setLockedAtDip(true);
      setShowParticles(true);
      const id = setTimeout(() => setShowParticles(false), 500);
      return () => clearTimeout(id);
    }
    prevLockedRef.current = locked;
  }, [locked, dipHint]);

  // Eight particle configs: random angles spread around the button
  const PARTICLES = React.useMemo(() => {
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    return angles.map((a, i) => {
      const rad = (a * Math.PI) / 180;
      const dist = 22 + (i % 3) * 8;
      return {
        tx: `${+(Math.cos(rad) * dist).toFixed(1)}px`,
        ty: `${+(Math.sin(rad) * dist * -1).toFixed(1)}px`,
        size: 4 + (i % 3) * 2,
        delay: i * 18,
      };
    });
  }, []);

  return (
    <div style={{
      background: COLORS.card,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid rgba(255,255,255,0.07)`,
      marginBottom: 10,
      animation: 'fs-stopEnter 0.38s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      {/* Stop header (Option B app-style) — brand chip + pump nozzle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 13px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* Brand chip */}
        <div style={{
          width: 40, height: 40,
          borderRadius: 8,
          background: stop.col,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: M,
          fontSize: 10,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
          letterSpacing: '0.3px',
        }}>
          {stop.code}
        </div>

        {/* Pump nozzle SVG — rotates 15° on rate lock to signal "inserted" */}
        <svg
          width="18" height="22" viewBox="0 0 20 24" fill="none"
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: locked ? 'rotate(15deg)' : 'rotate(0deg)',
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            opacity: locked ? 0.9 : 0.45,
          }}
        >
          <rect x="6" y="12" width="8" height="10" rx="2" fill={stop.col} opacity="0.9"/>
          <path d="M10 12 Q10 6 16 6 Q18 6 18 8 L18 12" stroke={stop.col} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8"/>
          <rect x="14" y="10" width="6" height="3" rx="1.5" fill={stop.col}/>
          <circle cx="10" cy="3" r="2" fill={stop.col} opacity={locked ? 1 : 0}
            style={{ transition: 'opacity 0.3s 0.1s' }}/>
        </svg>

        {/* Name + region */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: COLORS.white, lineHeight: 1.2 }}>
            {stop.label}
          </div>
          <div style={{ fontFamily: F, fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>
            Mile {stop.mile} · {
              stop.priceMult < 0.91 ? (
                <span style={{ color: COLORS.green }}>low-cost region ↓</span>
              ) : stop.priceMult > 1.06 ? (
                <span style={{ color: COLORS.red }}>high-cost region ↑</span>
              ) : (
                <span>mid-corridor pricing</span>
              )
            }
          </div>
        </div>

        {/* Pump price display (Option A LED-style) */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: M,
            fontSize: 26,
            fontWeight: 700,
            color: locked ? COLORS.green : COLORS.amber,
            lineHeight: 1,
            letterSpacing: '2px',
            transition: 'color 0.3s',
          }}>
            {pumpPrice.toFixed(2)}
          </div>
          <div style={{ fontFamily: F, fontSize: 9, color: COLORS.textDim, marginTop: 1 }}>
            {locked ? 'locked / gal' : 'pump / gal'}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '11px 13px' }}>

        {/* Event flash */}
        <EventFlash msg={eventMsg} />

        {/* Marcus tip */}
        <MarcosTip tip={marcosTip} />

        {/* Price board */}
        <PriceBoard
          pumpPrice={pumpPrice}
          effPrice={locked ? lockedEffPrice : effPrice}
          priceHist={priceHist}
          locked={locked}
          priceKey={priceKey}
          dipHint={dipHint}
        />

        {/* Discount strip */}
        <DiscountStrip level={level} />

        {/* ── ACTION AREA ────────────────────────────────────────────── */}
        {!locked ? (
          /* Lock rate button */
          <div style={{ position: 'relative' }}>
            {dipHint && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, marginBottom: 8,
                animation: 'fs-dipBadge 0.35s ease-out',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.green }} />
                <div style={{ fontFamily: F, fontSize: 11, color: COLORS.green }}>
                  near session low — good moment to lock
                </div>
              </div>
            )}
            <button
              onClick={onLock}
              style={{
                ...BTN_BASE,
                width: '100%',
                padding: '14px 20px',
                fontSize: 14,
                fontWeight: 700,
                background: COLORS.amber,
                color: '#000',
                animation: isLocking
                  ? 'fs-lockBurst 0.4s ease'
                  : dipHint
                  ? 'fs-dipHint 1.6s ease-in-out infinite'
                  : 'none',
                boxShadow: dipHint ? '0 0 0 0 rgba(255,153,0,0.4)' : 'none',
                position: 'relative',
                overflow: 'visible',
              }}
            >
              Lock rate — {formatCurrency(+(effPrice * fullGal).toFixed(2))} to fill
              {/* Dip particle burst — 8 amber dots explode outward on dip-lock */}
              {showParticles && PARTICLES.map((p, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: p.size, height: p.size,
                    borderRadius: '50%',
                    background: COLORS.amber,
                    pointerEvents: 'none',
                    '--pTx': p.tx,
                    '--pTy': p.ty,
                    animation: `fs-particle 0.42s ease-out ${p.delay}ms both`,
                    zIndex: 10,
                  }}
                />
              ))}
            </button>
          </div>
        ) : (
          /* Fill decision buttons (appear after locking) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'fs-fadeIn 0.25s ease' }}>
            {/* Total cost preview */}
            <div style={{
              background: '#060c16',
              border: '1px solid rgba(0,212,122,0.14)',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}>
              <div>
                <div style={{ fontFamily: F, fontSize: 10, color: COLORS.textDim }}>
                  Your effective rate (locked)
                </div>
                <div style={{ fontFamily: F, fontSize: 9, color: '#2a5040', marginTop: 1 }}>
                  Tank has room for {fullGal} gal
                </div>
              </div>
              <div style={{ fontFamily: M, fontSize: 18, fontWeight: 700, color: COLORS.green }}>
                ${lockedEffPrice.toFixed(3)}
              </div>
            </div>

            {/* Fill full */}
            <button
              onClick={() => onFill('full')}
              disabled={fullGal <= 0}
              style={{
                ...BTN_BASE,
                width: '100%',
                padding: '13px',
                fontSize: 13,
                background: fullGal > 0 ? COLORS.amber : 'rgba(255,255,255,0.05)',
                color: fullGal > 0 ? '#000' : COLORS.textDim,
                opacity: fullGal <= 0 ? 0.4 : 1,
              }}
            >
              Fill full — {fullGal} gal · {formatCurrency(costFull)}
            </button>

            {/* Add up to PARTIAL_GAL gal (top-off) */}
            {partGal > 0 && partGal < fullGal && (
              <button
                onClick={() => onFill('partial')}
                style={{
                  ...BTN_BASE,
                  width: '100%',
                  padding: '13px',
                  fontSize: 13,
                  background: COLORS.amberDim,
                  color: COLORS.amber,
                  border: `1px solid rgba(255,153,0,0.32)`,
                }}
              >
                Add {partGal} gal — {formatCurrency(costPart)}
              </button>
            )}

            {/* Skip */}
            <button
              onClick={canSkip ? onSkip : undefined}
              disabled={!canSkip}
              style={{
                ...BTN_BASE,
                width: '100%',
                padding: '13px',
                fontSize: 13,
                background: 'rgba(255,255,255,0.04)',
                color: canSkip ? COLORS.textMid : COLORS.red,
                border: `1px solid ${canSkip ? 'rgba(255,255,255,0.10)' : 'rgba(255,72,88,0.25)'}`,
                opacity: !canSkip ? 0.7 : 1,
                cursor: canSkip ? 'pointer' : 'not-allowed',
              }}
            >
              {canSkip ? 'Skip ahead →' : 'Must fill — low fuel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── PRICE OVERVIEW STRIP ───────────────────────────────────────────────────
// Shows all stops' effective prices so players can strategize ahead
const PriceOverviewStrip = React.memo(({ stops, currentIdx, discount }) => {
  const allEff = stops.map(s => +(s.basePrice * (1 - discount)).toFixed(3));
  const minEff = Math.min(...allEff);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '7px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.01)',
    }}>
      {stops.map((stop, i) => {
        const ep     = allEff[i];
        const isBest = Math.abs(ep - minEff) < 0.001;
        const isCur  = i === currentIdx;
        const isDone = i < currentIdx;

        return (
          <div key={stop.idx} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              fontFamily: M, fontSize: 8,
              color: isDone ? COLORS.textDim : isCur ? COLORS.amber : COLORS.textDim,
              marginBottom: 2,
            }}>
              {stop.code}
            </div>
            <div style={{
              fontFamily: M,
              fontSize: 10,
              fontWeight: isBest ? 700 : 400,
              color: isDone ? COLORS.textDim
                : isBest    ? COLORS.green
                : isCur     ? COLORS.amber
                :              COLORS.textMid,
            }}>
              {isDone ? '—' : `$${ep.toFixed(3)}`}
            </div>
            {isBest && !isDone && (
              <div style={{ fontFamily: F, fontSize: 7, color: COLORS.green, marginTop: 1 }}>
                best
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── RECEIPT ────────────────────────────────────────────────────────────────
const Receipt = React.memo(({
  fills,
  stops,
  totalPaid,
  totalGal,
  avgEffPrice,
  baselineCost,
  worstCost,
  cashSaved,
  vsWorst,
  outcome,
  tokensEarned,
  routeTotal,
  marcosTip,
  formatCurrency,
  onComplete,
}) => {
  const outcomeLabel = {
    optimal: 'Optimal',
    good:    'Good',
    average: 'Average',
    poor:    'Poor',
  }[outcome] || 'Average';

  const outcomeStars = {
    optimal: '★ ★ ★',
    good:    '★ ★',
    average: '★',
    poor:    '—',
  }[outcome] || '—';

  const outcomeBg = {
    optimal: 'rgba(0,212,122,0.08)',
    good:    'rgba(255,193,7,0.08)',
    average: 'rgba(255,153,0,0.06)',
    poor:    'rgba(255,72,88,0.07)',
  }[outcome];

  const outcomeBorder = {
    optimal: 'rgba(0,212,122,0.22)',
    good:    'rgba(255,193,7,0.22)',
    average: 'rgba(255,153,0,0.20)',
    poor:    'rgba(255,72,88,0.22)',
  }[outcome];

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '14px',
      paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))',
      WebkitOverflowScrolling: 'touch',
      overscrollBehavior: 'contain',
      animation: 'fs-receiptReveal 0.5s cubic-bezier(0.22,1,0.36,1)',
    }}>
      {/* Thermal receipt card */}
      <div style={{
        background: '#f7f3ec',
        borderRadius: 12,
        overflow: 'hidden',
        borderTop: `5px solid ${COLORS.amber}`,
        marginBottom: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Receipt header — prints first */}
        <div style={{
          background: '#efead8',
          padding: '10px 16px',
          textAlign: 'center',
          borderBottom: '1px dashed #c8c0a8',
          animation: 'fs-receiptLine 0.28s ease-out 40ms both',
        }}>
          <div style={{
            fontFamily: M, fontSize: 12, fontWeight: 700,
            color: '#1a1208', letterSpacing: '1px',
          }}>
            DIESEL DESK — FUEL RECEIPT
          </div>
          <div style={{ fontFamily: M, fontSize: 9, color: '#7a6848', marginTop: 2 }}>
            {routeTotal} mi corridor · {MPG} MPG · {totalGal.toFixed(1)} gal purchased
          </div>
        </div>

        {/* Fill rows — staggered print-in animation */}
        {fills.length === 0 ? (
          <div style={{
            padding: '10px 16px', fontFamily: M, fontSize: 10, color: '#8a7050',
            animation: 'fs-receiptLine 0.3s ease-out 0.1s both',
          }}>
            No fills this run — ran on starting fuel only
          </div>
        ) : fills.map((f, i) => (
          <div key={i} style={{
            padding: '7px 16px', borderBottom: '1px dashed #c8c0a8',
            animation: `fs-receiptLine 0.28s ease-out ${80 + i * 90}ms both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 10, fontWeight: 700, color: '#1a1208', lineHeight: 1.8 }}>
              <span>FILL {i + 1} — {f.stopLabel} (Mile {f.stopMile})</span>
            </div>
            <div style={{ fontFamily: M, fontSize: 10, color: '#5a4830', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pump price</span><span>${f.pumpPrice.toFixed(3)}/gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Your rate</span><span>${f.effPrice.toFixed(3)}/gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Volume</span><span>{f.gallons.toFixed(1)} gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1a1208' }}>
                <span>Subtotal</span><span>${(f.effPrice * f.gallons).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Totals — prints after fill rows (delay based on actual fills count) */}
        <div style={{
          padding: '7px 16px', borderBottom: '1px dashed #c8c0a8',
          animation: `fs-receiptLine 0.28s ease-out ${80 + fills.length * 90}ms both`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 11, fontWeight: 700, color: '#1a1208', lineHeight: 1.8 }}>
            <span>TOTAL PAID</span><span>{formatCurrency(totalPaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 9, color: '#7a6848', lineHeight: 1.8 }}>
            <span>Avg effective rate</span><span>${avgEffPrice}/gal</span>
          </div>
        </div>

        {/* Savings breakdown */}
        <div style={{
          padding: '7px 16px', borderBottom: '1px dashed #c8c0a8',
          animation: `fs-receiptLine 0.28s ease-out ${80 + (fills.length + 1) * 90}ms both`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 10, color: '#8a7050', lineHeight: 1.8 }}>
            <span>Auto-dispatch baseline</span><span>{formatCurrency(baselineCost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 10, color: cashSaved > 0 ? '#0a7838' : '#aa2020', fontWeight: 700, lineHeight: 1.8 }}>
            <span>{cashSaved > 0 ? 'Diesel Desk saved' : 'vs baseline'}</span>
            <span>{cashSaved > 0 ? `−${formatCurrency(cashSaved)}` : `+${formatCurrency(Math.abs(cashSaved))}`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 9, color: '#c07810', lineHeight: 1.8 }}>
            <span>Worst case (no strategy)</span><span>{formatCurrency(worstCost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 10, color: '#0a7838', fontWeight: 700, lineHeight: 1.8 }}>
            <span>vs worst case</span><span>−{formatCurrency(vsWorst)}</span>
          </div>
        </div>

        {/* Cost per mile — most important trucking metric */}
        {totalPaid > 0 && routeTotal > 0 && (
          <div style={{
            padding: '5px 16px 7px',
            borderBottom: '1px dashed #c8c0a8',
            animation: `fs-receiptLine 0.28s ease-out ${80 + (fills.length + 2) * 90}ms both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 10, color: '#0a5830', fontWeight: 700, lineHeight: 1.8 }}>
              <span>Cost / mile (fuel)</span>
              <span>${(totalPaid / routeTotal).toFixed(3)}/mi</span>
            </div>
            <div style={{ fontFamily: M, fontSize: 8, color: '#8a7050', lineHeight: 1.5 }}>
              Target: ≤$0.350/mi at base rates
            </div>
          </div>
        )}

        {/* What-if fuel card line — organic IAP education */}
        {totalPaid > 0 && (
          <div style={{
            padding: '5px 16px 7px',
            borderBottom: '1px dashed #c8c0a8',
            animation: `fs-receiptLine 0.28s ease-out ${80 + (fills.length + 3) * 90}ms both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: M, fontSize: 9, color: '#8a5808', lineHeight: 1.8 }}>
              <span>With TCS Fuel Card (est. −8¢/gal)</span>
              <span style={{ color: '#0a6020', fontWeight: 700 }}>
                −${(totalGal * 0.08).toFixed(2)} more
              </span>
            </div>
          </div>
        )}

        {/* Outcome — prints last, slightly larger delay for dramatic pause */}
        <div style={{
          padding: '10px 16px', textAlign: 'center',
          animation: `fs-receiptLine 0.32s ease-out ${80 + (fills.length + 4) * 90}ms both`,
        }}>
          <div style={{ fontFamily: M, fontSize: 12, fontWeight: 700, color: '#1a1208', letterSpacing: '0.5px', marginBottom: 3 }}>
            {outcomeLabel} — {outcomeStars}
          </div>
          <div style={{ fontFamily: M, fontSize: 10, color: '#b06808' }}>
            TOKENS EARNED: {tokensEarned}
          </div>
        </div>
      </div>

      {/* Outcome card with Marcus — delayed until receipt fully printed */}
      <div style={{
        background: outcomeBg,
        border: `1px solid ${outcomeBorder}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 14,
        animation: `fs-successPop 0.42s cubic-bezier(0.22,1,0.36,1) ${80 + (fills.length + 5) * 90}ms both`,
      }}>
        <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: COLORS.white, marginBottom: 5 }}>
          {outcome === 'optimal' ? 'Textbook corridor run' :
           outcome === 'good'    ? 'Solid fuel discipline' :
           outcome === 'average' ? 'Room to improve' :
                                   'Fuel cost above baseline'}
        </div>
        {marcosTip && <MarcosTip tip={marcosTip} />}
      </div>

      {/* Confirm button */}
      <button
        onClick={onComplete}
        style={{
          ...BTN_BASE,
          width: '100%',
          padding: '16px',
          fontSize: 15,
          fontWeight: 700,
          background: `linear-gradient(105deg, ${COLORS.amber} 0%, #ffb733 40%, ${COLORS.amber} 60%, #e68800 100%)`,
          backgroundSize: '200% auto',
          color: '#000',
          borderRadius: 12,
          boxShadow: '0 4px 28px rgba(255,153,0,0.28)',
          animation: 'fs-shimmer 3.5s linear infinite',
          marginBottom: `max(0px, env(safe-area-inset-bottom, 0px))`,
        }}
      >
        Confirm & continue →
      </button>
    </div>
  );
});

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
const FuelStop = React.memo(({
  onComplete,
  onClose,
  routeDistance,
  currentFuelPrice,
  cash,
  currentDay,
  level,
  prestigeLevel,
  addNotification,
  formatCurrency,
}) => {
  // ─── CSS KEYFRAME INJECTION ─────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById(STYLE_TAG_ID)) return;
    const el        = document.createElement('style');
    el.id           = STYLE_TAG_ID;
    el.textContent  = KEYFRAMES;
    document.head.appendChild(el);
    return () => {
      const tag = document.getElementById(STYLE_TAG_ID);
      if (tag) tag.parentNode.removeChild(tag);
    };
  }, []);

  // ─── PROP NORMALIZATION — guard against NaN/undefined from App.jsx ──
  // All downstream logic reads these safe values, never the raw props.
  const safeDistance   = Math.max(50,  isFinite(routeDistance)    ? routeDistance    : 200);
  const safeFuelPrice  = Math.max(0.5, isFinite(currentFuelPrice) ? currentFuelPrice : 3.15);
  const safeLevel      = Math.max(1,   isFinite(level)            ? Math.floor(level): 1);
  const safeDay        = isFinite(currentDay) ? currentDay : 1;

  // ─── STABLE ROUTE DATA (generated once) ────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const route = useMemo(
    () => generateRoute(safeDistance, safeFuelPrice),
    [] // intentional — generate once on mount, stable for session
  );

  const discount      = useMemo(() => getLevelDiscount(safeLevel), [safeLevel]);
  const effOf         = useCallback((p) => +(p * (1 - discount)).toFixed(3), [discount]);

  // ─── GAME STATE ─────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('intro');     // 'intro'|'corridor'|'receipt'
  const [stopIdx,      setStopIdx]      = useState(0);
  const [tankGal,      setTankGal]      = useState(route.startGal);
  const [cashSpent,    setCashSpent]    = useState(0);
  const [fills,        setFills]        = useState([]);

  // Live price ticker state
  const [pumpPrice,    setPumpPrice]    = useState(0);
  const [priceHist,    setPriceHist]    = useState([]);
  const [priceKey,     setPriceKey]     = useState(0);
  const [tickCount,    setTickCount]    = useState(0);    // eslint-disable-line no-unused-vars
  const [locked,       setLocked]       = useState(false);
  const [lockedPrice,  setLockedPrice]  = useState(null);
  const [isLocking,    setIsLocking]    = useState(false);
  const [dipHint,      setDipHint]      = useState(false);
  const [eventMsg,     setEventMsg]     = useState(null);
  const [marcosTip,    setMarcosTip]    = useState(null);

  // Completion guard
  const completedRef  = useRef(false);
  const tickRef       = useRef(null);
  const eventTimerRef = useRef(null);
  const lockAnimRef   = useRef(null);   // cleanup for lock animation setTimeout

  // ─── PERSONAL BEST (localStorage) ───────────────────────────────────
  // Tracks lowest avg $/gal across all FuelStop runs. Read on mount,
  // written after the run if the player beats their record.
  const [personalBest, setPersonalBest] = useState(() => {
    try { const v = localStorage.getItem('fs_bestAvgPrice'); return v ? parseFloat(v) : null; }
    catch (_) { return null; }
  });

  // ─── SESSION STREAK ────────────────────────────────────────────────
  // Counts consecutive optimal-quality stops this run.
  // Does NOT persist — resets every game, no save schema change needed.
  const [streak, setStreak]   = useState(0);
  const streakRef             = useRef(0); // readable inside callbacks

  // ─── SOUND ENGINE ────────────────────────────────────────────────────
  const [soundMuted, setSoundMuted] = useState(false);
  const { play, initCtx }           = useSoundEngine(soundMuted);
  // prevTickPriceRef — new price written by state-updater during each tick.
  // tickSnapRef      — snapshot of price AT THE START of each tick interval
  //                    callback, used to compare prev vs new outside updater.
  const prevTickPriceRef = useRef(0);
  const tickSnapRef      = useRef(0);
  // soundTimerRef — cleans up the receipt sound delay on unmount
  const soundTimerRef    = useRef(null);

  // ─── DERIVED VALUES ─────────────────────────────────────────────────
  const currentStop    = route.stops[stopIdx];
  // displayPrice guards the one-frame flash before initStop fires (pumpPrice starts at 0)
  const displayPrice   = pumpPrice > 0 ? pumpPrice : (currentStop?.basePrice ?? 0);
  const effPrice       = displayPrice ? effOf(displayPrice) : 0;
  const lockedEffPrice = lockedPrice ? effOf(lockedPrice) : 0;
  const milesLeft      = currentStop
    ? route.totalMiles - currentStop.mile
    : 0;

  // ─── CAN SKIP? ──────────────────────────────────────────────────────
  const canSkip = useMemo(() => {
    if (!currentStop) return false;
    const nextIdx  = stopIdx + 1;
    const nextMile = nextIdx < route.stops.length
      ? route.stops[nextIdx].mile
      : route.totalMiles;
    const milesDriving = nextMile - currentStop.mile;
    const galNeeded    = (milesDriving / MPG) * SAFETY_MULT;
    return tankGal >= galNeeded;
  }, [stopIdx, tankGal, route.stops, route.totalMiles, currentStop]);

  // ─── INIT STOP ──────────────────────────────────────────────────────
  const initStop = useCallback((idx) => {
    const stop = route.stops[idx];
    if (!stop) return;

    // Starting price: slight random offset for immediate live feel
    const startOff = (Math.random() - 0.5) * 0.05;
    const startP   = Math.max(
      safeFuelPrice * 0.75,
      +(stop.basePrice + startOff).toFixed(3)
    );

    setPumpPrice(startP);
    setPriceHist([startP]);
    setTickCount(0);
    setPriceKey(k => k + 1);
    setLocked(false);
    setLockedPrice(null);
    setIsLocking(false);
    setDipHint(false);
    setEventMsg(null);

    // Marcus tip based on stop economics
    if (stop.priceMult < 0.91)     setMarcosTip(MARCUS.cheapStop);
    else if (stop.priceMult > 1.06) setMarcosTip(MARCUS.priceyStop);
    else                            setMarcosTip(null);
  }, [route.stops, safeFuelPrice]);

  // ─── PRICE TICK INTERVAL ────────────────────────────────────────────
  useEffect(() => {
    // Clean up on any condition change
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    if (phase !== 'corridor' || locked || !currentStop) return;

    const baseP = currentStop.basePrice;
    const floor = safeFuelPrice * 0.73;
    const ceil  = safeFuelPrice * 1.33;

    const tickMs = safeLevel >= 20 ? 750 : TICK_MS; // Level 20+: faster ticks
    tickRef.current = setInterval(() => {
      // Track whether a market event fired this tick — set inside the
      // state-updater closure, read outside to dispatch the right sound.
      let marketFired = false;

      setPumpPrice(prev => {
        const drift    = (baseP - prev) * MEAN_REVERT + (Math.random() - 0.5) * NOISE_AMP;
        let eventDelta = 0;

        // Rare market event flash
        for (const evt of MARKET_EVENTS) {
          if (Math.random() < evt.prob * 0.28) {
            eventDelta = evt.delta;
            marketFired = true;
            setEventMsg(evt.msg);
            if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
            eventTimerRef.current = setTimeout(() => setEventMsg(null), 3600);
            break;
          }
        }

        const next = Math.max(floor, Math.min(ceil, prev + drift + eventDelta));
        const rounded = +(next.toFixed(3));

        // Store new price in ref BEFORE returning — lets us read it outside
        // the state-updater to determine tick direction for sound dispatch.
        prevTickPriceRef.current = rounded;

        setPriceHist(h => {
          const updated = [...h, rounded];
          const trimmed = updated.length > 12 ? updated.slice(-12) : updated;

          // Dip hint: price is within 3¢ of session low with 5+ ticks of data
          if (trimmed.length >= 5) {
            const sessionLow = Math.min(...trimmed);
            const prev2      = trimmed[trimmed.length - 2] ?? rounded;
            setDipHint(rounded <= sessionLow + 0.03 && rounded <= prev2);
          }

          return trimmed;
        });
        setTickCount(c => c + 1);
        setPriceKey(k => k + 1);

        // Low tank → override Marcus tip
        if (tankGal / TANK_CAP < 0.25) {
          setMarcosTip(MARCUS.lowTank);
        }

        return rounded;
      });

      // ── Sound dispatch (outside state updater — safe from StrictMode double-invoke) ──
      if (marketFired) {
        play('market_event');
      } else {
        // tickSnapRef was saved at the START of this interval callback (below),
        // so it holds the price from the PREVIOUS tick.
        // prevTickPriceRef was written INSIDE the state updater with the NEW price.
        const prevP = tickSnapRef.current;
        const newP  = prevTickPriceRef.current;
        if (Math.abs(newP - prevP) > 0.002) {
          play(newP > prevP ? 'tick_up' : 'tick_down');
        } else {
          play('tick_flat');
        }
      }
      // Advance snapshot for next tick AFTER sound decision
      tickSnapRef.current = prevTickPriceRef.current;
    }, tickMs);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    // Note: tankGal included so low-fuel tip fires correctly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, locked, stopIdx, safeFuelPrice, tankGal]);

  // ─── INIT STOP WHEN stopIdx OR phase changes ─────────────────────────
  useEffect(() => {
    if (phase === 'corridor') {
      initStop(stopIdx);
    }
  }, [phase, stopIdx, initStop]);

  // ─── BODY SCROLL LOCK ────────────────────────────────────────────────
  // Prevents the game content from drifting when an aggressive touch on
  // Android triggers scroll on the parent document behind the portal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ─── CLEANUP ON UNMOUNT ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (tickRef.current)       clearInterval(tickRef.current);
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
      if (lockAnimRef.current)   clearTimeout(lockAnimRef.current);
      if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
    };
  }, []);

  // ─── DIP-HINT SOUND: play once on false → true transition ────────────
  const prevDipHintRef = useRef(false);
  useEffect(() => {
    if (dipHint && !prevDipHintRef.current) play('dip_hint');
    prevDipHintRef.current = dipHint;
  }, [dipHint, play]);

  // ─── RECEIPT SOUND: thermal printer fires 120ms after receipt opens ───
  // soundTimerRef is cleaned up on unmount so early close won't orphan it.
  useEffect(() => {
    if (phase === 'receipt') {
      if (soundTimerRef.current) clearTimeout(soundTimerRef.current);
      soundTimerRef.current = setTimeout(() => play('receipt_print'), 120);
    }
    return () => {
      if (phase === 'receipt' && soundTimerRef.current) {
        clearTimeout(soundTimerRef.current);
        soundTimerRef.current = null;
      }
    };
  }, [phase, play]);

  // ─── HANDLE LOCK ────────────────────────────────────────────────────
  const handleLock = useCallback(() => {
    if (locked || phase !== 'corridor') return;

    play('lock'); // mechanical lock sound on rate commit

    // Animate button — use ref for safe cleanup on unmount
    if (lockAnimRef.current) clearTimeout(lockAnimRef.current);
    setIsLocking(true);
    lockAnimRef.current = setTimeout(() => setIsLocking(false), 420);

    setLocked(true);
    setLockedPrice(pumpPrice);

    // Stop tick
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    // Evaluate lock quality for Marcus feedback
    const hi  = Math.max(...priceHist);
    const lo  = Math.min(...priceHist);
    const rng = hi - lo;
    const q   = rng > 0.01 ? (hi - pumpPrice) / rng : 0.5;

    if (q > 0.55)      setMarcosTip(MARCUS.goodLock);
    else if (q < 0.25) setMarcosTip(MARCUS.badLock);
    else               setMarcosTip(MARCUS.borderLock);
  }, [locked, phase, pumpPrice, priceHist, play]);

  // ─── ADVANCE TO NEXT STOP (internal) ────────────────────────────────
  const advanceToNext = useCallback((currentTank) => {
    const stop    = route.stops[stopIdx];
    const nextIdx = stopIdx + 1;

    if (nextIdx >= route.stops.length) {
      // Last stop passed — burn remaining miles to destination and show receipt
      const remainMiles = route.totalMiles - stop.mile;
      const burnedGal   = +(remainMiles / MPG).toFixed(1);
      setTankGal(Math.max(0, +(currentTank - burnedGal).toFixed(1)));
      setPhase('receipt');
      return;
    }

    // Burn fuel to the next stop
    const nextStop    = route.stops[nextIdx];
    const driveGal    = +((nextStop.mile - stop.mile) / MPG).toFixed(1);
    const tankArrival = Math.max(0, +(currentTank - driveGal).toFixed(1));

    setTankGal(tankArrival);
    setStopIdx(nextIdx);
    setMarcosTip(null);
    setEventMsg(null);
    // phase stays 'corridor'; useEffect picks up new stopIdx → initStop
  }, [stopIdx, route.stops, route.totalMiles]);

  // ─── HANDLE FILL ────────────────────────────────────────────────────
  const handleFill = useCallback((type) => {
    if (!locked || phase !== 'corridor') return;

    const stop    = route.stops[stopIdx];
    const space   = +(TANK_CAP - tankGal).toFixed(1);
    const gallons = type === 'full'
      ? space
      : Math.min(PARTIAL_GAL, space);

    if (gallons > 0) {
      play(type === 'full' ? 'fill_full' : 'fill_partial'); // liquid + cash-register sound
      // Streak: locked within 5% above session low = "good" timing
      const sessionLow = Math.min(...priceHist.length ? priceHist : [lockedPrice]);
      const isGoodTiming = lockedPrice <= sessionLow * 1.05;
      if (isGoodTiming) {
        streakRef.current = streakRef.current + 1;
        setStreak(streakRef.current);
      } else {
        streakRef.current = 0;
        setStreak(0);
      }
      const fillCost    = +(gallons * lockedEffPrice).toFixed(2);
      const newTank     = Math.min(TANK_CAP, +(tankGal + gallons).toFixed(1));
      const newSpent    = +(cashSpent + fillCost).toFixed(2);

      setTankGal(newTank);
      setCashSpent(newSpent);
      setFills(prev => [
        ...prev,
        {
          stopIdx,
          stopLabel: stop.label,
          stopMile:  stop.mile,
          gallons,
          pumpPrice: lockedPrice,
          effPrice:  lockedEffPrice,
          cost:      fillCost,
        },
      ]);

      advanceToNext(newTank);
    }
  }, [
    locked, phase, stopIdx, tankGal, cashSpent,
    lockedPrice, lockedEffPrice, route.stops, advanceToNext, play, priceHist,
  ]);

  // ─── HANDLE SKIP ────────────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    if (!canSkip || phase !== 'corridor') return;
    play('skip'); // whoosh — passing the stop without fueling
    advanceToNext(tankGal);
  }, [canSkip, phase, tankGal, advanceToNext, play]);

  // ─── RECEIPT CALCULATIONS ───────────────────────────────────────────
  const receiptData = useMemo(() => {
    if (phase !== 'receipt') return null;

    const totalPaid = isFinite(cashSpent) ? cashSpent : 0;
    const totalGal  = fills.reduce((s, f) => s + (isFinite(f.gallons) ? f.gallons : 0), 0);
    const avgEffP   = totalGal > 0 ? +(totalPaid / totalGal).toFixed(3) : 0;

    // Auto-dispatch baseline: what App.jsx would charge without the game
    const baseEff  = effOf(safeFuelPrice);
    const baseline = +(route.galNeeded * baseEff).toFixed(2);

    // Worst case: all fuel purchased at highest stop pump price
    const maxPump   = Math.max(...route.stops.map(s => s.basePrice));
    const worstCost = +(route.galNeeded * effOf(maxPump)).toFixed(2);

    // Edge case: player skipped all stops (zero fills)
    // They had enough starting tank — valid but no pricing skill demonstrated
    if (totalGal === 0) {
      return {
        totalPaid: 0, totalGal: 0, avgEffP: 0,
        baseline, worstCost,
        cashSaved: 0, vsWorst: 0,
        outcome: 'average', tokensEarned: 1,
        receiptTip: 'You ran on starting fuel — no purchase needed this run. Rare, but strategically valid.',
      };
    }

    // cashSaved: only meaningful if player UNDERPAID vs baseline.
    // Negative (overpaid) clamps to 0 — no penalty, just no bonus.
    const cashSaved = Math.max(0, +(parseFloat(baseline) - totalPaid).toFixed(2));
    const vsWorst   = Math.max(0, +(parseFloat(worstCost) - totalPaid).toFixed(2));

    // Outcome tier — position within the possible savings spread
    const minPump   = Math.min(...route.stops.map(s => s.basePrice));
    const bestPoss  = +(route.galNeeded * effOf(minPump)).toFixed(2);
    const spread    = parseFloat(worstCost) - parseFloat(bestPoss);
    const playerPos = spread > 0.01
      ? (parseFloat(worstCost) - totalPaid) / spread
      : 0.5;

    let outcome, tokensEarned;
    if      (playerPos >= 0.75) { outcome = 'optimal'; tokensEarned = 3; }
    else if (playerPos >= 0.50) { outcome = 'good';    tokensEarned = 2; }
    else if (playerPos >= 0.25) { outcome = 'average'; tokensEarned = 1; }
    else                        { outcome = 'poor';    tokensEarned = 0; }

    const receiptTip = MARCUS[`${outcome}Run`] || null;

    return {
      totalPaid, totalGal, avgEffP, baseline, worstCost,
      cashSaved, vsWorst, outcome, tokensEarned, receiptTip,
    };
  }, [phase, cashSpent, fills, safeFuelPrice, route, effOf]);

  // ─── HANDLE COMPLETE ────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    if (completedRef.current || !receiptData) return;
    completedRef.current = true;

    // Outcome chord — fires before onComplete so it plays as the parent takes over
    play(`outcome_${receiptData.outcome}`);

    // Personal best: update if player averaged a new lowest $/gal this run
    if (receiptData.avgEffP > 0) {
      try {
        const current = parseFloat(localStorage.getItem('fs_bestAvgPrice') || '9999');
        if (receiptData.avgEffP < current) {
          localStorage.setItem('fs_bestAvgPrice', receiptData.avgEffP.toString());
          setPersonalBest(receiptData.avgEffP);
        }
      } catch (_) { /* localStorage blocked — non-critical */ }
    }

    addNotification(
      `⛽ Diesel Desk — saved ${formatCurrency(receiptData.cashSaved)} vs baseline · avg $${receiptData.avgEffP}/gal`,
      'success'
    );

    onComplete({
      cashSaved:    receiptData.cashSaved,
      tokensEarned: receiptData.tokensEarned,
      outcome:      receiptData.outcome,
    });
  }, [receiptData, onComplete, addNotification, formatCurrency, play]);

  // ─── CLOSE WITH GUARD ────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (completedRef.current) return;
    if (tickRef.current)       clearInterval(tickRef.current);
    if (eventTimerRef.current) clearTimeout(eventTimerRef.current);
    if (lockAnimRef.current)   clearTimeout(lockAnimRef.current);
    onClose();
  }, [onClose]);

  // ─── ANDROID BACK BUTTON (Capacitor) ────────────────────────────────
  // Placed AFTER handleClose so the reference is initialized (no TDZ).
  // Without this, the hardware back button dismisses the overlay without
  // calling onClose(), leaving the truck in a dispatched-but-stuck state.
  useEffect(() => {
    let listener = null;
    try {
      const { App: CapApp } = window.Capacitor?.Plugins || {};
      if (CapApp?.addListener) {
        CapApp.addListener('backButton', handleClose).then(l => { listener = l; });
      }
    } catch (_) { /* non-Capacitor environment — safe to ignore */ }
    return () => { listener?.remove?.(); };
  }, [handleClose]);

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  // ─── INTRO SCREEN ───────────────────────────────────────────────────
  if (phase === 'intro') {
    const galNeeded = route.galNeeded;
    const stops     = route.stops;
    const { pct }   = getDiscountBreakdown(safeLevel);

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        maxWidth: 480,
        margin: '0 auto',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}>
        <Header
          currentDay={safeDay}
          onClose={handleClose}
          phase="intro"
          stopIdx={0}
          stopCount={stops.length}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(m => !m)}
        />

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 18px 16px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          display: 'flex',
          flexDirection: 'column',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          animation: 'fs-slideUp 0.4s ease-out',
        }}>
          {/* Logo / title area */}
          <div style={{ textAlign: 'center', marginBottom: 24, animation: 'fs-slideUp 0.4s ease-out both' }}>
            <div style={{
              fontFamily: M,
              fontSize: 10,
              color: COLORS.amber,
              letterSpacing: '4px',
              marginBottom: 8,
              opacity: 0.8,
            }}>
              ⛽ DIESEL DESK
            </div>
            <div style={{
              fontFamily: F,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
              lineHeight: 1.1,
              marginBottom: 8,
            }}>
              Route Fuel Strategy
            </div>
            {/* Amber accent underline */}
            <div style={{
              width: 56, height: 3, borderRadius: 2,
              background: COLORS.amber,
              margin: '0 auto 10px',
              animation: 'fs-introPulse 3s ease-in-out infinite',
            }} />
            <div style={{
              fontFamily: F,
              fontSize: 13,
              color: COLORS.textMid,
              lineHeight: 1.55,
            }}>
              Find the best price window along your corridor.<br />
              Your existing discount is already applied.
            </div>
          </div>

          {/* Route brief */}
          <div style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 14,
            animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) both',
            animationDelay: '0.06s',
          }}>
            <div style={{ fontFamily: M, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.5px', marginBottom: 8 }}>
              ACTIVE RUN
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontFamily: F, fontSize: 12, color: COLORS.textDim, marginBottom: 2 }}>Distance</div>
                <div style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color: COLORS.white }}>
                  {route.totalMiles.toLocaleString()} mi
                </div>
              </div>
              <div>
                <div style={{ fontFamily: F, fontSize: 12, color: COLORS.textDim, marginBottom: 2 }}>Gal needed</div>
                <div style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color: COLORS.amber }}>
                  {galNeeded} gal
                </div>
              </div>
              <div>
                <div style={{ fontFamily: F, fontSize: 12, color: COLORS.textDim, marginBottom: 2 }}>Stops</div>
                <div style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color: COLORS.white }}>
                  {stops.length}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: F, fontSize: 12, color: COLORS.textDim, marginBottom: 2 }}>Start tank</div>
                <div style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color: tank_color(Math.round(route.startGal / TANK_CAP * 100)) }}>
                  {Math.round(route.startGal / TANK_CAP * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Stop price preview */}
          <div style={{
            background: COLORS.card,
            border: `1px solid rgba(255,255,255,0.06)`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 14,
            animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) both',
            animationDelay: '0.14s',
          }}>
            <div style={{ fontFamily: M, fontSize: 9, color: COLORS.textDim, letterSpacing: '0.5px', marginBottom: 10 }}>
              CORRIDOR PRICING — EFFECTIVE RATES
            </div>
            {stops.map((s, i) => {
              const ep = effOf(s.basePrice);
              const allEff = stops.map(x => effOf(x.basePrice));
              const minEff = Math.min(...allEff);
              const isBest = Math.abs(ep - minEff) < 0.001;

              return (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 0',
                  borderBottom: i < stops.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: s.col,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: M,
                    }}>
                      {s.code}
                    </div>
                    <div>
                      <div style={{ fontFamily: F, fontSize: 12, color: COLORS.text, fontWeight: 500 }}>
                        {s.label}
                      </div>
                      <div style={{ fontFamily: F, fontSize: 9, color: COLORS.textDim }}>
                        Mile {s.mile} · {
                          s.priceMult < 0.82 ? 'Budget corridor · Murphy-tier' :
                          s.priceMult < 0.91 ? `−${Math.round((1-s.priceMult)*100)}% vs national avg` :
                          s.priceMult > 1.08 ? `+${Math.round((s.priceMult-1)*100)}% vs national avg` :
                          s.priceMult > 1.02 ? 'Premium corridor pricing' :
                          'Market rate · within 5% avg'
                        }
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: M, fontSize: 15, fontWeight: 700,
                      color: isBest ? COLORS.green : COLORS.amber,
                    }}>
                      ${ep.toFixed(3)}
                    </div>
                    {isBest && (
                      <div style={{ fontFamily: F, fontSize: 9, color: COLORS.green }}>
                        best deal
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Discount notice */}
          {pct > 0 && (
            <div style={{
              background: COLORS.greenDim,
              border: '1px solid rgba(0,212,122,0.18)',
              borderRadius: 9,
              padding: '10px 14px',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) both',
              animationDelay: '0.22s',
            }}>
              <div style={{ fontFamily: F, fontSize: 11, color: '#3d7050', lineHeight: 1.4 }}>
                Your Lv.{Math.min(safeLevel, 20)} fuel network discount<br />
                <span style={{ fontSize: 10, color: '#2a5040' }}>
                  Already applied to every price above
                </span>
              </div>
              <div style={{ fontFamily: M, fontSize: 15, fontWeight: 700, color: COLORS.green }}>
                −{pct}%
              </div>
            </div>
          )}

          {/* Personal best strip */}
          {personalBest !== null && (
            <div style={{
              background: 'rgba(255,153,0,0.06)',
              border: '1px solid rgba(255,153,0,0.16)',
              borderRadius: 9,
              padding: '9px 14px',
              marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) 0.26s both',
            }}>
              <div style={{ fontFamily: F, fontSize: 10, color: COLORS.textDim }}>
                Your best avg rate
              </div>
              <div style={{ fontFamily: M, fontSize: 13, fontWeight: 700, color: COLORS.amber }}>
                ${personalBest.toFixed(3)}/gal
              </div>
            </div>
          )}

          {/* DEF notice for routes over 300 mi */}
          {route.totalMiles >= 300 && (
            <div style={{
              background: 'rgba(59,130,246,0.05)',
              border: '1px solid rgba(59,130,246,0.14)',
              borderRadius: 9,
              padding: '7px 14px',
              marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) 0.28s both',
            }}>
              <span style={{ fontSize: 12 }}>🔵</span>
              <div style={{ fontFamily: F, fontSize: 9.5, color: 'rgba(147,197,253,0.75)', lineHeight: 1.4 }}>
                DEF pre-checked ✓ — 2010+ engine uses ~1 gal DEF per 300 mi
              </div>
            </div>
          )}

          {/* How to play */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 9,
            padding: '10px 14px',
            marginBottom: 20,
            animation: 'fs-intCard 0.42s cubic-bezier(0.22,1,0.36,1) both',
            animationDelay: '0.30s',
          }}>
            <div style={{ fontFamily: F, fontSize: 10, color: COLORS.textDim, lineHeight: 1.7 }}>
              At each stop the pump price ticks live.<br />
              <span style={{ color: COLORS.amber }}>Lock the rate</span> when you see a dip, then choose how much to fill.<br />
              You can skip if your tank has enough to reach the next stop.
            </div>
          </div>

          {/* Start button — shimmer on idle */}
          <button
            onClick={() => { initCtx(); setPhase('corridor'); }}
            style={{
              ...BTN_BASE,
              width: '100%',
              padding: '16px',
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              background: `linear-gradient(105deg, ${COLORS.amber} 0%, #ffb733 40%, ${COLORS.amber} 60%, #e68800 100%)`,
              backgroundSize: '200% auto',
              color: '#000',
              animation: 'fs-shimmer 3s linear infinite',
              boxShadow: '0 4px 28px rgba(255,153,0,0.28)',
              marginBottom: `max(0px, env(safe-area-inset-bottom, 0px))`,
            }}
          >
            Start fuel run →
          </button>
        </div>
      </div>
    );
  }

  // ─── RECEIPT SCREEN ──────────────────────────────────────────────────
  if (phase === 'receipt' && receiptData) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        maxWidth: 480,
        margin: '0 auto',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}>
        <Header
          currentDay={safeDay}
          onClose={handleClose}
          phase="receipt"
          stopIdx={route.stops.length}
          stopCount={route.stops.length}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(m => !m)}
        />
        <Receipt
          fills={fills}
          stops={route.stops}
          totalPaid={receiptData.totalPaid}
          totalGal={receiptData.totalGal}
          avgEffPrice={receiptData.avgEffP}
          baselineCost={receiptData.baseline}
          worstCost={receiptData.worstCost}
          cashSaved={receiptData.cashSaved}
          vsWorst={receiptData.vsWorst}
          outcome={receiptData.outcome}
          tokensEarned={receiptData.tokensEarned}
          routeTotal={route.totalMiles}
          marcosTip={receiptData.receiptTip}
          formatCurrency={formatCurrency}
          onComplete={handleComplete}
        />
      </div>
    );
  }

  // ─── CORRIDOR SCREEN ─────────────────────────────────────────────────
  if (phase !== 'corridor' || !currentStop) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: F,
      maxWidth: 480,
      margin: '0 auto',
      overflow: 'hidden',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
      userSelect: 'none',
    }}>
      {/* Header (with progress bar) */}
      <div style={{ position: 'relative' }}>
        <Header
          currentDay={safeDay}
          onClose={handleClose}
          phase="corridor"
          stopIdx={stopIdx}
          stopCount={route.stops.length}
          soundMuted={soundMuted}
          onToggleSound={() => setSoundMuted(m => !m)}
        />
      </div>

      {/* Low-fuel red vignette — pulses at screen edges below 25% */}
      {tankGal / TANK_CAP < 0.25 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 45%, rgba(220,30,50,0.18) 100%)',
            animation: 'fs-vignette 1.3s ease-in-out infinite',
          }}
        />
      )}

      {/* HUD */}
      <HUD
        tankGal={tankGal}
        cashSpent={cashSpent}
        milesLeft={milesLeft}
        formatCurrency={formatCurrency}
      
        streak={streak}
      />

      {/* Route bar */}
      <RouteBar stops={route.stops} stopIdx={stopIdx} fills={fills} totalMiles={route.totalMiles} />

      {/* Price overview strip */}
      <PriceOverviewStrip
        stops={route.stops}
        currentIdx={stopIdx}
        discount={discount}
      />

      {/* Scrollable body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 12px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}>
        <StopCard
          key={`stop-${stopIdx}`}
          stop={currentStop}
          pumpPrice={displayPrice}
          effPrice={effPrice}
          priceHist={priceHist.length ? priceHist : [displayPrice]}
          priceKey={priceKey}
          locked={locked}
          lockedPrice={lockedPrice}
          lockedEffPrice={lockedEffPrice}
          tankGal={tankGal}
          canSkip={canSkip}
          isLocking={isLocking}
          dipHint={dipHint && !locked}
          onLock={handleLock}
          onFill={handleFill}
          onSkip={handleSkip}
          marcosTip={marcosTip}
          eventMsg={eventMsg}
          level={safeLevel}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
});

export default FuelStop;
