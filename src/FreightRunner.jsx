import React, { useEffect, useRef, useState } from 'react';

// ================================================================
//  FreightRunner — canvas Pac-Man minigame
//  Drop this component anywhere in your React app.
//
//  Props:
//    onClose  — optional () => void, called when player presses Escape
//    style    — optional extra CSS object merged onto the outer wrapper
// ================================================================

// ── Google Font injected once into <head> (idempotent) ─────────
function ensureFont() {
  if (document.getElementById('freight-runner-font')) return;
  const pre1 = Object.assign(document.createElement('link'),
    { rel: 'preconnect', href: 'https://fonts.googleapis.com',
      id: 'freight-runner-font' });
  const pre2 = Object.assign(document.createElement('link'),
    { rel: 'preconnect', href: 'https://fonts.gstatic.com',
      crossOrigin: 'anonymous' });
  const font = Object.assign(document.createElement('link'),
    { rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap' });
  document.head.append(pre1, pre2, font);
}

// ── Inject base styles once (height cascade dvh→vh fallback) ──
function ensureStyles() {
  if (document.getElementById('freight-runner-styles')) return;
  const s = document.createElement('style');
  s.id = 'freight-runner-styles';
  // Two height declarations in one rule = CSS cascade:
  // browsers that understand dvh use it; others fall back to vh.
  // Inline styles can't do this — must be a real stylesheet.
  s.textContent = `.fr-shell { height: 100vh; height: 100dvh; box-sizing: border-box; }`;
  document.head.appendChild(s);
}

function FreightRunner({ onClose, style, embedded = false, onGameComplete, onBackButton, onAchievement, appName = 'FreightRunner', dpadOffset = 0, dailyMode = false }) {
  const canvasRef   = useRef(null);
  const wrapperRef  = useRef(null);
  const gameAreaRef = useRef(null);
  // Audio is always on; mutedRef stays false so getAC() always returns a context
  const mutedRef          = useRef(false);
  const embeddedRef       = useRef(embedded);
  const onGameCompleteRef = useRef(onGameComplete);
  const onBackButtonRef   = useRef(onBackButton);
  const onAchievementRef  = useRef(onAchievement);
  const appNameRef        = useRef(appName);
  const dailyModeRef      = useRef(dailyMode);
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
  // AudioContext lives in a ref so Fast Refresh / effect re-runs can't orphan it.
  // The effect reads/writes audioCtxRef.current; cleanup closes and nulls it.
  const audioCtxRef = useRef(null);
  // Imperative bridge: game effect populates this so JSX overlays (D-pad,
  // quit button) can dispatch input without being inside the closure.
  const gameInputRef = useRef(null);

  const [showRotate, setShowRotate] = useState(false);   // landscape hint on narrow screens
  // D-pad: off by default, toggled by player, persisted to fr_dpad localStorage
  const [showDpad, setShowDpad] = useState(() => {
    try { return localStorage.getItem('fr_dpad') === '1'; } catch(e) { return false; }
  });
  // showShare: true when game is over — drives share button visibility in JSX
  const [showShare, setShowShare] = useState(false);
  const setShowShareRef = useRef(setShowShare);
  // showExitConfirm: true when player taps EXIT, shows YES/NO confirmation overlay
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // showNewspaper: true during GS.NEWSPAPER — mounts the JSX share/download overlay (Ph3)
  const [showNewspaper, setShowNewspaper] = useState(false);
  const setShowNewsRef = useRef(setShowNewspaper);
  // newsDataUrl: base-64 PNG snapshot of the newspaper canvas frame (Ph3)
  const [newsDataUrl, setNewsDataUrl] = useState('');
  const setNewsDataUrlRef = useRef(setNewsDataUrl);

  useEffect(() => {
    ensureFont();
    ensureStyles();

    // Canvas and ctx are local to this effect — no DOM query needed
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');

    // ── DEVICE PIXEL RATIO ────────────────────────────────────────────
    // Scale the canvas buffer to physical pixels so text is rasterized
    // at full resolution on retina / HiDPI screens instead of at logical
    // pixel size (which gets blurry when CSS-upscaled).
    // ctx.scale(dpr, dpr) maps all draw calls back to logical coordinates
    // so nothing else in the game needs to change.
    // Cap at 2 — indistinguishable from 3× at game canvas sizes but avoids
    // enormous 1512×1806px buffers on high-DPR phones. Halves GPU cost when
    // embedded inside App.jsx on 3× devices.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ─────────────────────────────────────────────────────────────
    //  ALL GAME LOGIC (transformed from freight-runner.html)
    // ─────────────────────────────────────────────────────────────
    // ================================================================
    //  FREIGHT RUNNER — Batches 1, 2 & 3
    //  B1: Core architecture, canvas, maze rendering
    //  B2: Player truck, movement system, input handling
    //  B3: Ghost AI (all 4), ghost house, frightened system
    // ================================================================
    
    
    // ── GRID CONSTANTS ────────────────────────────────────────────────
    const COLS  = 28;
    const ROWS  = 31;
    const TILE  = 18;
    
    // ── CANVAS LAYOUT ─────────────────────────────────────────────────
    const HUD_H  = 44;
    const MAZE_W = COLS * TILE;    // 504
    const MAZE_H = ROWS * TILE;    // 558
    const CW     = MAZE_W;
    const CH     = HUD_H + MAZE_H; // 614

    // ── HUD Row-1 button hit rects (logical canvas px) ────────────────
    // Left gap: between score value (~x62) and title (~x196)
    // Right gap: between title (~x308) and hi-score (~x434)
    const HUD_BTN_PAUSE = { x: 76,  y: 3, w: 72, h: 16 };
    const HUD_BTN_QUIT  = { x: 356, y: 3, w: 72, h: 16 };
    
    // ── TILE TYPES ────────────────────────────────────────────────────
    const T_WALL  = 0;
    const T_DOT   = 1;
    const T_EMPTY = 2;
    const T_POWER = 3;
    const T_DOOR  = 4;
    const T_HOUSE = 5;
    
    // ── COLOUR PALETTE ────────────────────────────────────────────────
    const C = {
      bg:          '#0a0a1a',
      road:        '#08081a',
      wallFill:    '#04040e',
      wallBorder:  '#FFD700',
      wallGlow:    '#FFAA00',
      dot:         '#FFC840',
      dotGlow:     '#FF6600',
      power:       '#00FF88',
      powerGlow:   '#00CC55',
      door:        '#FFB0D0',
      doorGlow:    '#FF44AA',
      house:       '#06071e',
      houseAccent: '#0a1540',
      hud:         '#040412',
      hudBorder:   '#FFD700',
      textGold:    '#FFD700',
      textDim:     '#886600',
      textBlue:    '#44AAFF',
      truckGlow:   '#FF8800',
      // Ghost colours
      gDot:       '#FF0000',   // DOT    – Blinky red
      gBroker:    '#FFB8FF',   // BROKER – Pinky pink
      gIrs:       '#00FFFF',   // IRS    – Inky cyan
      gRepo:      '#FFAA44',   // REPO   – Clyde orange
      gFright:    '#2233CC',   // frightened body
      gFlash:     '#FFFFFF',   // frightened flash
    };
    
    // Color-blind mode removed — always use standard palette
    function getCB() { return C; }
    // ── B10: LEADERBOARD (top 5, persisted to localStorage) ──────────
    const LB_KEY = 'fr_lb';
    const LB_MAX = 5;
    function loadLeaderboard() {
      try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); }
      catch(e) { return []; }
    }
    function saveLeaderboard(lb) {
      try { localStorage.setItem(LB_KEY, JSON.stringify(lb)); } catch(e) {}
    }
    function submitScore(sc, lv) {
      const lb = loadLeaderboard();
      lb.push({ score: sc, level: lv, initials: '' });
      lb.sort((a, b) => b.score - a.score);
      const trimmed = lb.slice(0, LB_MAX);
      saveLeaderboard(trimmed);
      return trimmed;
    }

    // ── B10: LEVEL COLOUR THEMES ──────────────────────────────────────
    // P6: each theme now carries dot/power tints so pellets shift hue with the walls.
    const LEVEL_THEMES = [
      { border: '#FFD700', glow: '#FFAA00', dot: '#FFC840', dotGlow: '#FF6600', power: '#00FF88', powerGlow: '#00CC55' }, // L1: gold (original)
      { border: '#00DDFF', glow: '#0099CC', dot: '#55EEFF', dotGlow: '#0099CC', power: '#00DDFF', powerGlow: '#0066AA' }, // L2: cyan
      { border: '#BB66FF', glow: '#8833CC', dot: '#CC88FF', dotGlow: '#8833CC', power: '#BB44FF', powerGlow: '#7722BB' }, // L3: purple
      { border: '#FF4444', glow: '#CC0000', dot: '#FF7755', dotGlow: '#CC2200', power: '#FF2222', powerGlow: '#AA0000' }, // L4: red
      { border: '#44FF88', glow: '#00CC44', dot: '#66FFAA', dotGlow: '#00AA44', power: '#44FF88', powerGlow: '#00CC44' }, // L5: green
      { border: '#FFFFFF', glow: '#AACCFF', dot: '#EEEEFF', dotGlow: '#8899CC', power: '#AADDFF', powerGlow: '#6688CC' }, // L6: white
    ];
    // Ph4: Night Shift variants — same hue family but deeper, moodier tones
    const LEVEL_THEMES_NIGHT = [
      { border: '#CC8800', glow: '#995500', dot: '#AA6600', dotGlow: '#664400', power: '#00AA55', powerGlow: '#006633' }, // N1: dark gold
      { border: '#0077AA', glow: '#004477', dot: '#2299BB', dotGlow: '#005577', power: '#0099BB', powerGlow: '#004466' }, // N2: deep cyan
      { border: '#7722AA', glow: '#441177', dot: '#8844BB', dotGlow: '#551188', power: '#7711AA', powerGlow: '#440088' }, // N3: deep purple
      { border: '#AA1111', glow: '#770000', dot: '#CC3322', dotGlow: '#881100', power: '#991100', powerGlow: '#660000' }, // N4: deep red
      { border: '#228844', glow: '#115522', dot: '#33AA66', dotGlow: '#116633', power: '#228844', powerGlow: '#115522' }, // N5: deep green
      { border: '#8899AA', glow: '#445566', dot: '#99AACC', dotGlow: '#445577', power: '#7799AA', powerGlow: '#334455' }, // N6: steel blue
    ];
    function getLevelTheme() {
      const themes = nightShiftActive ? LEVEL_THEMES_NIGHT : LEVEL_THEMES;
      return themes[(level - 1) % themes.length];
    }

    // ── B10: GHOST INTRO BADGES ───────────────────────────────────────
    // P4: Badge now shows name on top row + AI tagline on second row.
    const ghostIntros = [];   // { name, tag, color, px, py, timer, maxTimer }
    const GHOST_TAGS = {
      DOT:    'ALWAYS ON YOU',
      BROKER: '4 TILES AHEAD',
      IRS:    'UNPREDICTABLE',
      REPO:   'LURKS CLOSE',
    };
    function triggerGhostIntro(g) {
      if (g._introDone) return;
      g._introDone = true;
      const pos = getGhostPixelPos(g);
      ghostIntros.push({
        name: g.name,
        tag:  GHOST_TAGS[g.name] || '',
        color: g.color,
        px: pos.px, py: pos.py,
        timer: 90, maxTimer: 90,   // P4: slightly longer so tagline is readable
      });
      // Mark this ghost as encountered for the arcade cabinet info card system in App.jsx
      try { localStorage.setItem('fr_ghost_seen_' + g.name.toLowerCase(), '1'); } catch(e) {}
    }

    const MAZE_TEMPLATE = [
    /*r00*/[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    /*r01*/[0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    /*r02*/[0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    /*r03*/[0,3,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,3,0],
    /*r04*/[0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    /*r05*/[0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    /*r06*/[0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
    /*r07*/[0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
    /*r08*/[0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
    /*r09*/[0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0],
    /*r10*/[0,0,0,0,0,0,1,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1,0,0,0,0,0,0],
    /*r11*/[0,0,0,0,0,0,1,0,0,2,2,2,2,2,2,2,2,2,2,0,0,1,0,0,0,0,0,0],
    /*r12*/[0,0,0,0,0,0,1,0,0,2,0,0,0,4,4,0,0,0,2,0,0,1,0,0,0,0,0,0],
    /*r13*/[2,2,2,2,2,2,2,2,2,2,0,5,5,5,5,5,5,0,2,2,2,2,2,2,2,2,2,2],
    /*r14*/[2,2,2,2,2,2,2,2,2,2,0,5,5,5,5,5,5,0,2,2,2,2,2,2,2,2,2,2],
    /*r15*/[0,0,0,0,0,0,1,0,0,2,0,5,5,5,5,5,5,0,2,0,0,1,0,0,0,0,0,0],
    /*r16*/[0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
    /*r17*/[0,0,0,0,0,0,1,0,0,2,2,2,2,2,2,2,2,2,2,0,0,1,0,0,0,0,0,0],
    /*r18*/[0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
    /*r19*/[0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0],
    /*r20*/[0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    /*r21*/[0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    /*r22*/[0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
    /*r23*/[0,3,1,1,0,0,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,0,0,1,1,3,0],
    /*r24*/[0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
    /*r25*/[0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
    /*r26*/[0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
    /*r27*/[0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
    /*r28*/[0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
    /*r29*/[0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    /*r30*/[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ];
    
    let maze = MAZE_TEMPLATE.map(r => [...r]);

    // ── Pre-computed tile position lists (built once, never change) ───
    // Eliminates per-frame 868-tile loops for door drawing and level-flash.
    const DOOR_TILES = [];   // { r, c, x, y } for ghost-house door tiles
    const WALL_TILES = [];   // { x, y } for level-complete flash rendering
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = MAZE_TEMPLATE[r][c];
        if (t === T_DOOR) DOOR_TILES.push({ r, c, x: c * TILE, y: r * TILE });
        if (t === T_WALL) WALL_TILES.push({ x: c * TILE, y: r * TILE });
      }
    }

    // ── OFFSCREEN CANVAS CACHE ────────────────────────────────────────
    // Static maze geometry (walls, silhouettes, house, tunnels, depots)
    // is expensive to redraw every frame due to shadowBlur glow on ~800
    // wall edges.  We render it once into an offscreen canvas and blit
    // it each frame; rebuilt only when the level changes or theme changes.
    let staticCanvas = null;   // OffscreenCanvas | HTMLCanvasElement
    let staticCtx    = null;
    let staticDirty  = true;   // set true to trigger a rebuild next draw
    function ensureStaticCanvas() {
      if (staticCanvas) return;
      try {
        staticCanvas = new OffscreenCanvas(CW * dpr, MAZE_H * dpr);
      } catch(e) {
        staticCanvas = document.createElement('canvas');
        staticCanvas.width  = CW * dpr;
        staticCanvas.height = MAZE_H * dpr;
      }
      staticCtx = staticCanvas.getContext('2d');
      staticCtx.scale(dpr, dpr);
      staticCtx.imageSmoothingEnabled = false;
    }

    // ── DOT CANVAS CACHE ─────────────────────────────────────────────
    // Fuel dots and power permits are static until eaten — rendering them
    // as 240 individual arc+glow calls per frame costs ~476 shadowBlur
    // state changes/frame.  We cache them into a second offscreen canvas
    // and blit it in one drawImage call.  Only rebuilt when a dot is
    // eaten (dotsDirty = true) or on level/theme change.
    let dotCanvas = null;
    let dotCtx    = null;
    let dotsDirty = true;
    function ensureDotCanvas() {
      if (dotCanvas) return;
      try {
        dotCanvas = new OffscreenCanvas(CW * dpr, MAZE_H * dpr);
      } catch(e) {
        dotCanvas = document.createElement('canvas');
        dotCanvas.width  = CW * dpr;
        dotCanvas.height = MAZE_H * dpr;
      }
      dotCtx = dotCanvas.getContext('2d');
      dotCtx.scale(dpr, dpr);
      dotCtx.imageSmoothingEnabled = false;
    }

    function buildDotCache() {
      ensureDotCanvas();
      dotCtx.clearRect(0, 0, CW, MAZE_H);
      const th      = getLevelTheme();
      const dotCol  = th.dot      || '#FFC840';
      const glowCol = th.dotGlow  || '#FF6600';
      const pwrHex  = th.power    || '#00FF88';
      const glowHex = th.powerGlow || '#00CC55';
      // Parse power pellet color once per rebuild (not per pellet per frame)
      const pr = parseInt(pwrHex.slice(1, 3), 16);
      const pg = parseInt(pwrHex.slice(3, 5), 16);
      const pb = parseInt(pwrHex.slice(5, 7), 16);

      // Draw all remaining dots with glow — single shadowBlur setup per type
      dotCtx.shadowColor = glowCol;
      dotCtx.shadowBlur  = 5;
      dotCtx.fillStyle   = dotCol;
      dotCtx.beginPath();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (maze[r][c] === T_DOT) {
            const cx = c * TILE + TILE / 2;
            const cy = r * TILE + TILE / 2;
            dotCtx.moveTo(cx + 2.2, cy);
            dotCtx.arc(cx, cy, 2.2, 0, Math.PI * 2);
          }
        }
      }
      dotCtx.fill();
      dotCtx.shadowBlur = 0;

      // Draw power pellets (static appearance — animation baked at p=1.0 midpoint)
      const p = 1.0, o = 7.5 * p;
      dotCtx.shadowColor = glowHex;
      dotCtx.shadowBlur  = 18;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (maze[r][c] === T_POWER) {
            const cx = c * TILE + TILE / 2;
            const cy = r * TILE + TILE / 2;
            dotCtx.strokeStyle = `rgba(${pr},${pg},${pb},0.35)`;
            dotCtx.lineWidth   = 2;
            dotCtx.beginPath(); dotCtx.arc(cx, cy, o + 2.5, 0, Math.PI * 2); dotCtx.stroke();
            dotCtx.fillStyle = `rgba(${pr},${pg},${pb},1.0)`;
            dotCtx.beginPath(); dotCtx.arc(cx, cy, o, 0, Math.PI * 2); dotCtx.fill();
            dotCtx.fillStyle = `rgba(${Math.min(255,pr+80)},${Math.min(255,pg+80)},${Math.min(255,pb+80)},0.6)`;
            dotCtx.beginPath(); dotCtx.arc(cx, cy, o * 0.38, 0, Math.PI * 2); dotCtx.fill();
          }
        }
      }
      dotCtx.shadowBlur = 0;
      dotsDirty = false;
    }

    // ================================================================
    //  BATCH 5 — WEB AUDIO SYSTEM
    // ================================================================
    // AudioContext is lazy-created on first sound call (browser autoplay policy).
    // Stored in audioCtxRef (component-level ref) so Fast Refresh / effect re-runs
    // cannot orphan a running context.  onstatechange auto-resumes after phone
    // calls, notifications, or any OS-level audio interruption (critical on iOS).
    let dotPhase = 0;   // alternates pitch for the waka-waka dot sound

    function getAC() {
      if (mutedRef.current) return null;
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          audioCtxRef.current.onstatechange = () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended')
              audioCtxRef.current.resume().catch(() => {});
          };
          // Pre-warm GainNode pool so first sound events don't allocate
          _prewarmGainPool(audioCtxRef.current);
        } catch(e) { return null; }
      }
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
      return audioCtxRef.current;
    }

    // ── AUDIO GAIN NODE POOL ──────────────────────────────────────────
    // GainNode objects are reusable (no started/stopped lifecycle).
    // OscillatorNode must be created fresh each time (one-shot by spec).
    // Pooling GainNodes halves AudioNode allocation per burst() call and
    // eliminates GainNode GC spikes — the main cause of audio-event lag.
    // Pool is keyed per AudioContext; rebuilt if context is recreated.
    let _gainPool     = [];
    let _gainPoolAC   = null;   // context the pool was built for
    const GAIN_POOL_SIZE = 24;  // covers worst case: sfxDeath (24 nodes)

    function _acquireGain(ac) {
      // Rebuild pool if AudioContext changed (e.g. after context recreation)
      if (_gainPoolAC !== ac) {
        _gainPool   = [];
        _gainPoolAC = ac;
      }
      if (_gainPool.length > 0) return _gainPool.pop();
      const g = ac.createGain();
      g.connect(ac.destination);
      return g;
    }

    function _releaseGain(g) {
      // Reset gain to silent and return to pool (cap at GAIN_POOL_SIZE)
      try { g.gain.cancelScheduledValues(0); g.gain.value = 0; } catch(e) {}
      if (_gainPool.length < GAIN_POOL_SIZE) _gainPool.push(g);
    }

    // Pre-warm the pool after AudioContext is created so first-play sounds
    // don't allocate. Called lazily on first getAC() success.
    function _prewarmGainPool(ac) {
      while (_gainPool.length < GAIN_POOL_SIZE) {
        const g = ac.createGain();
        g.gain.value = 0;
        g.connect(ac.destination);
        _gainPool.push(g);
      }
      _gainPoolAC = ac;
    }

    // One-shot oscillator burst — now uses pooled GainNode
    function burst(ac, type, freq, gain, dur, startOffset = 0) {
      const g = _acquireGain(ac);
      const o = ac.createOscillator();
      const t = ac.currentTime + startOffset;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.01);
      // Return GainNode to pool when oscillator finishes
      o.onended = () => { try { o.disconnect(g); } catch(e) {} _releaseGain(g); };
    }

    function sfxDot() {
      const ac = getAC(); if (!ac) return;
      const freq = dotPhase ? 180 : 220;
      dotPhase = 1 - dotPhase;
      burst(ac, 'square', freq, 0.10, 0.055);
    }

    function sfxPower() {
      const ac = getAC(); if (!ac) return;
      // UX: 'sawtooth' was harsh at volume — 'triangle' is same pattern, softer timbre
      [280, 380, 500, 680].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.11, 0.09, i * 0.055));
    }

    function sfxFrightened() {
      // Short warble on power-up — does not loop
      const ac = getAC(); if (!ac) return;
      [160, 140, 160, 140].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.09, 0.07, i * 0.07));
    }

    function sfxGhostEaten(chain) {
      const ac = getAC(); if (!ac) return;
      // UX: frequencies dropped into the comfortable 120–260 Hz range (bass-mid).
      // Ramp only rises 1.2× (was 1.4×) and uses a short fade-in to kill click transient.
      // Gain reduced to 0.07 — satisfying thud at volume, not harsh at high volume.
      const base = [120, 155, 195, 245][Math.min(chain - 1, 3)];
      const o = ac.createOscillator();
      const g = _acquireGain(ac);
      o.type = 'sine';
      o.frequency.setValueAtTime(base, ac.currentTime);
      o.frequency.linearRampToValueAtTime(base * 1.2, ac.currentTime + 0.16);
      g.gain.cancelScheduledValues(ac.currentTime);
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.linearRampToValueAtTime(0.07, ac.currentTime + 0.02);  // 20ms fade-in kills click
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
      o.connect(g);
      o.start(ac.currentTime);
      o.stop(ac.currentTime + 0.25);
      o.onended = () => { try { o.disconnect(g); } catch(e) {} _releaseGain(g); };
    }

    function sfxDeath() {
      const ac = getAC(); if (!ac) return;
      // Descending chromatic spiral
      [523,494,466,440,415,392,370,349,330,311,294,262].forEach((f, i) =>
        burst(ac, 'sawtooth', f, 0.13, 0.09, i * 0.065));
    }

    function sfxLevelComplete() {
      const ac = getAC(); if (!ac) return;
      // Ascending fanfare + final chord
      [392, 494, 587, 659, 784].forEach((f, i) =>
        burst(ac, 'square', f, 0.13, 0.14, i * 0.09));
      // Triumph chord at end
      [784, 988, 1176].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.10, 0.35, 0.5 + i * 0.02));
    }

    function sfxExtraLife() {
      const ac = getAC(); if (!ac) return;
      [523, 659, 784, 1047].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.16, 0.18, i * 0.08));
    }

    function sfxContract() {
      const ac = getAC(); if (!ac) return;
      // Shiny fanfare: two quick notes then shimmer
      [659, 784, 988, 1319].forEach((f, i) =>
        burst(ac, i < 2 ? 'square' : 'triangle', f, 0.15, 0.15, i * 0.07));
    }

    // ── STARTUP FANFARE ───────────────────────────────────────────────
    // Plays the moment gameplay begins (READY → PLAYING) so it fires
    // after the first user gesture — audio is guaranteed unlocked.
    // Works identically in embedded and standalone modes, and plays
    // each level since startPlaying() is called every time READY ends.
    function sfxStartup() {
      const ac = getAC(); if (!ac) return;
      // Rising 5-note "ready to haul" motif — game start only
      [330, 392, 494, 587, 784].forEach((f, i) =>
        burst(ac, 'square',   f, 0.12, 0.13, i * 0.08));
      // Sustain chord for weight
      [392, 494].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.08, 0.28, 0.44 + i * 0.01));
    }

    // Short 2-note "go" cue for respawns and level advances
    function sfxReady() {
      const ac = getAC(); if (!ac) return;
      burst(ac, 'square',   494, 0.11, 0.10, 0.00);
      burst(ac, 'triangle', 784, 0.10, 0.14, 0.10);
    }

    // ── INTERLUDE SFX ─────────────────────────────────────────────────
    // All procedural; use burst() + getAC() exactly like the rest of the audio system.

    // Scene 1: DOT siren wail (police approach)
    function sfxILSiren() {
      const ac = getAC(); if (!ac) return;
      for (let i = 0; i < 8; i++)
        burst(ac, 'sawtooth', 880 + (i % 2) * 260, 0.12, 0.10, i * 0.11);
    }

    // Scene 1 & 2 & 3: sad trombone (citation / lowball / audit)
    function sfxILSadTrombone() {
      const ac = getAC(); if (!ac) return;
      [494, 466, 440, 392].forEach((f, i) =>
        burst(ac, 'sawtooth', f, 0.22, 0.20, i * 0.18));
    }

    // Scene 2: phone ringing (broker call)
    function sfxILPhoneRing() {
      const ac = getAC(); if (!ac) return;
      for (let i = 0; i < 4; i++) {
        burst(ac, 'square', 900,  0.18, 0.08, i * 0.38);
        burst(ac, 'square', 1100, 0.18, 0.08, i * 0.38 + 0.12);
      }
    }

    // Scene 3: thunder crack (IRS materialises)
    function sfxILThunder() {
      const ac = getAC(); if (!ac) return;
      burst(ac, 'sawtooth', 44,  0.50, 0.55, 0.00);
      burst(ac, 'sawtooth', 60,  0.35, 0.35, 0.05);
      burst(ac, 'triangle', 120, 0.15, 0.20, 0.12);
    }

    // Scene 4: air-horn honk (truck wakes up)
    function sfxILHonk() {
      const ac = getAC(); if (!ac) return;
      burst(ac, 'sawtooth', 220, 0.38, 0.22, 0.00);
      burst(ac, 'sawtooth', 277, 0.28, 0.22, 0.02);
      burst(ac, 'sawtooth', 220, 0.32, 0.14, 0.26);
    }

    // Scene 4: engine rev (truck accelerates away)
    function sfxILEngineRev() {
      const ac = getAC(); if (!ac) return;
      [60,80,110,160,220].forEach((f, i) =>
        burst(ac, 'sawtooth', f, 0.32, 0.18, i * 0.14));
    }

    // ================================================================
    //  BATCH 9 — HAPTIC FEEDBACK (navigator.vibrate, no-op if unsupported)
    // ================================================================
    function haptic(pattern) {
      try { navigator.vibrate?.(pattern); } catch(e) {}
    }
    // Haptic profiles
    const HAP_DOT      = 8;           // tiny tick per pellet
    const HAP_POWER    = [30, 20, 30]; // double-pulse on power pellet
    const HAP_GHOST    = [60, 20, 40]; // firm double on ghost eaten
    const HAP_DEATH    = [0, 30, 80, 30, 80, 30, 120]; // rumble pattern on death
    const HAP_LEVEL    = [40, 20, 40, 20, 80];          // fanfare pattern
    const HAP_EXTRA    = [30, 15, 30, 15, 60];          // reward pulse
    const HAP_CONTRACT = [20, 10, 60];                  // sharp + long for contract


    // ================================================================

    // ── B7-2: ATTRACT SCREEN JINGLE ──────────────────────────────────
    // A short 8-note melody that loops every ~3 seconds on the attract screen.
    // Fully procedural — no assets. Built from burst() like all other sfx.
    const JINGLE_NOTES   = [262, 294, 330, 349, 392, 349, 330, 294];
    const JINGLE_PERIOD  = 180; // frames between repeats (~3 s at 60fps)
    let   jingleLastFrame = -JINGLE_PERIOD; // so it fires on first attract frame

    function updateJingle() {
      if (gameState !== GS.ATTRACT) { jingleLastFrame = -JINGLE_PERIOD; return; }
      if (!audioUnlocked) return; // don't attempt before user gesture — would silently fail
      const ac = getAC(); if (!ac) return;
      if (frame - jingleLastFrame >= JINGLE_PERIOD) {
        jingleLastFrame = frame;
        JINGLE_NOTES.forEach((f, i) =>
          burst(ac, 'triangle', f, 0.09, 0.14, i * 0.18));
      }
    }

    // ── B7-3: FRIGHTENED SIREN ───────────────────────────────────────
    // A two-tone warble that repeats every ~28 frames while fright is active.
    // Uses burst() pairs so no persistent node to clean up.
    const SIREN_PERIOD = 28;   // frames between siren pulses
    let   sirenLastFrame = 0;

    function updateSiren() {
      if (frightenedTimer <= 0) { sirenLastFrame = 0; return; }
      const ac = getAC(); if (!ac) return;
      if (frame - sirenLastFrame >= SIREN_PERIOD) {
        sirenLastFrame = frame;
        // Two alternating tones: lower when near expiry (tension)
        const pitch = frightenedTimer < 120 ? 0.7 : 1.0;
        burst(ac, 'triangle', 155 * pitch, 0.06, 0.10, 0);
        burst(ac, 'triangle', 185 * pitch, 0.06, 0.10, 0.13);
      }
    }

    // ── B7-4: EATEN GHOST RETURN WHINE ───────────────────────────────
    // Each ghost gets its own oscillator node stored on the ghost object.
    // Started when state becomes EATEN, stopped when state changes away.

    function startGhostWhine(g) {
      const ac = getAC(); if (!ac) return;
      if (g.whineOsc) return; // already whining
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      // Each ghost gets slightly different pitch so 2+ eaten at once sounds richer
      osc.frequency.value = 1400 + ghosts.indexOf(g) * 80;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.04, ac.currentTime + 0.05);
      osc.connect(gain); gain.connect(ac.destination);
      osc.start();
      g.whineOsc  = osc;
      g.whineGain = gain;
    }

    function stopGhostWhine(g) {
      if (!g.whineOsc || !audioCtxRef.current) return;
      const ac = audioCtxRef.current;
      const gain = g.whineGain;
      gain.gain.setValueAtTime(gain.gain.value, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.08);
      const osc = g.whineOsc;
      g.whineOsc = null; g.whineGain = null;
      setTimeout(() => { try { osc.stop(); } catch(e) {} }, 120);
    }

    function stopAllWhines() {
      for (const g of ghosts) stopGhostWhine(g);
    }

    function updateWhines() {
      for (const g of ghosts) {
        if (g.state === GHOST_ST.EATEN) {
          startGhostWhine(g);
        } else {
          if (g.whineOsc) stopGhostWhine(g);
        }
      }
    }

    // ── B7-5: GAME OVER STING ────────────────────────────────────────
    // Replaces sfxDeath() on the final life — longer, more dramatic.
    function sfxGameOverSting() {
      const ac = getAC(); if (!ac) return;
      // Descending cascade — wider intervals, longer decay
      [494, 440, 392, 330, 277, 220, 185, 147].forEach((f, i) =>
        burst(ac, 'sawtooth', f, 0.14, 0.18, i * 0.09));
      // Low final thud
      burst(ac, 'square', 80, 0.18, 0.40, 0.82);
    }

    // ── Ph2: BOSS SFX ────────────────────────────────────────────────
    // sfxBossEntry: dark dramatic descend + ominous low chord.
    function sfxBossEntry() {
      const ac = getAC(); if (!ac) return;
      [988, 880, 784, 698, 659].forEach((f, i) =>
        burst(ac, 'sawtooth', f, 0.14, 0.15, i * 0.08));
      burst(ac, 'square',   330, 0.22, 0.60, 0.52);
      burst(ac, 'square',   415, 0.16, 0.55, 0.54);
      burst(ac, 'triangle', 165, 0.18, 0.70, 0.56);
    }

    // sfxBossVictory: triumphant six-note ascent + sustain chord.
    function sfxBossVictory() {
      const ac = getAC(); if (!ac) return;
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
        burst(ac, 'square', f, 0.14, 0.18, i * 0.07));
      [784, 988, 1175, 1568].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.12, 0.55, 0.52 + i * 0.02));
    }

    // sfxCeremonyFanfare: full hall-of-fame fanfare — longer and grander than boss victory.
    function sfxCeremonyFanfare() {
      const ac = getAC(); if (!ac) return;
      // Ascending run
      [392, 494, 587, 740, 880, 1047, 1319].forEach((f, i) =>
        burst(ac, 'square',   f, 0.13, 0.14, i * 0.06));
      // Sustain chord
      [784, 988, 1175, 1568].forEach((f, i) =>
        burst(ac, 'triangle', f, 0.11, 0.70, 0.50 + i * 0.02));
      // Final punctuation
      [1568, 1976].forEach((f, i) =>
        burst(ac, 'square',   f, 0.09, 0.12, 1.10 + i * 0.08));
    }

    // ================================================================
    //  BATCH 5 — LOAD KING CONTRACT (bonus item)
    // ================================================================
    const CONTRACT_ROW     = 23;   // center passable tile below ghost house
    const CONTRACT_COL     = 13;
    const CONTRACT_DUR      = 540;  // ~9 s at 60 fps
    // B8: base thresholds; at level 3+ a third spawn is added dynamically
    const CONTRACT_BASE_AT  = [70, 170];
    let   CONTRACT_SPAWN_AT = [...CONTRACT_BASE_AT];
    let contractItem      = null;  // { timer, type } or null when absent
    let contractSpawnIdx  = 0;     // next index into CONTRACT_SPAWN_AT

    // P6: Bonus item type catalogue — type drives visual + point value
    const BONUS_ITEMS = {
      contract:  { pts: 1000, glyph: '$',  glowColor: '#00FF88', bodyColor: '#FFD700', label: 'CONTRACT'  },
      surcharge: { pts: 1500, glyph: '⚡', glowColor: '#FF8800', bodyColor: '#FF6600', label: 'SURCHARGE' },
      manifest:  { pts: 2500, glyph: '★',  glowColor: '#AA88FF', bodyColor: '#CC99FF', label: 'MANIFEST'  },
      // Ph5: warp fruit — appears ONCE on level 13 first spawn only.
      // Collect it to jump to level 25. Miss it and play organically — both paths earn the bonus.
      warp:      { pts: 5000, glyph: '◈',  glowColor: '#FF00FF', bodyColor: '#8800FF', label: 'WARP ZONE' },
    };

    // Select bonus item type based on current level
    function pickBonusType() {
      // Ph5: warp fruit appears ONCE — first contract spawn on level 13 only.
      // If the player misses it (expires), game continues to level 14 normally.
      // Organic play through levels 14→25 also earns the Legend Haul Bonus.
      if (level === 13 && contractSpawnIdx === 0) return 'warp';
      if (level >= 5) {
        // At level 5+ rotate: manifest on spawn 1 & 3, surcharge on spawn 2
        return contractSpawnIdx % 3 === 1 ? 'surcharge' : 'manifest';
      }
      if (level >= 3) {
        // At level 3-4 alternate: contract / surcharge
        return contractSpawnIdx % 2 === 0 ? 'contract' : 'surcharge';
      }
      return 'contract';
    }

    function rebuildContractSpawns() {
      CONTRACT_SPAWN_AT = level >= 3
        ? [...CONTRACT_BASE_AT, 240]  // third spawn threshold at level 3+
        : [...CONTRACT_BASE_AT];
    }

    // ================================================================
    //  BATCH 5 — FLOATING SCORE TEXT
    // ================================================================
    const floatTexts = []; // { text, px, py, life, maxLife, color }

    function addFloat(text, px, py, color = '#FFD700', size = 7) {
      floatTexts.push({ text, px, py, life: 60, maxLife: 60, color, size });
    }

    function updateFloatTexts() {
      for (let i = floatTexts.length - 1; i >= 0; i--) {
        floatTexts[i].py -= 0.6;
        floatTexts[i].life--;
        if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
      }
    }

    function drawFloatTexts() {
      if (floatTexts.length === 0) return;
      // Perf: group by color so shadowColor is set once per group not once per text
      const byColor = new Map();
      for (const f of floatTexts) {
        if (!byColor.has(f.color)) byColor.set(f.color, []);
        byColor.get(f.color).push(f);
      }
      for (const [color, texts] of byColor) {
        glow(color, 10);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const f of texts) {
          const alpha = f.life / f.maxLife;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `${f.size || 7}px "Press Start 2P", monospace`;
          ctx.fillText(f.text, f.px, f.py);
          ctx.restore();
        }
        noGlow();
      }
    }
    
    // ── RESPONSIVE SCALING ────────────────────────────────────────────
    canvas.width  = CW * dpr;
    canvas.height = CH * dpr;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;   // keep pixel art / text crisp on drawImage calls
    function applyScale() {
      const el = gameAreaRef.current;
      if (!el) return;
      const availW = el.clientWidth;
      const availH = el.clientHeight;
      if (!availW || !availH) return;
      const s  = Math.min((availW * 0.99) / CW, (availH * 0.99) / CH);
      const pw = Math.floor(CW * s), ph = Math.floor(CH * s);
      canvasRef.current.style.width   = pw + 'px';
      canvasRef.current.style.height  = ph + 'px';
      if (wrapperRef.current) {
        wrapperRef.current.style.width  = pw + 'px';
        wrapperRef.current.style.height = ph + 'px';
      }
    }

    // ResizeObserver fires on every layout reflow during the bar CSS
    // height transition — this is what drives the smooth canvas resize.
    // Debounced at 16ms to prevent reflow → style write → reflow loops.
    let resizeDebounceId = null;
    function applyScaleDebounced() {
      if (resizeDebounceId) clearTimeout(resizeDebounceId);
      resizeDebounceId = setTimeout(applyScale, 16);
    }
    const resizeObs = new ResizeObserver(applyScaleDebounced);
    resizeObs.observe(gameAreaRef.current);
    window.addEventListener('resize', applyScaleDebounced);
    // [JSX] resize listener added in useEffect
    
    // ── CANVAS HELPERS ────────────────────────────────────────────────
    function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    function noGlow()          { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
    
    // ── BUILDING SILHOUETTE SEEDS ─────────────────────────────────────
    const BLDG = [];
    (function() {
      for (let r = 0; r < ROWS; r++) {
        BLDG[r] = [];
        for (let c = 0; c < COLS; c++) {
          let s = ((r * 2341 + c * 173) ^ 0xDEAD) >>> 0;
          s = (s ^ (s >>> 13)) * 0x5bd1e995 >>> 0;
          s = s ^ (s >>> 15);
          BLDG[r][c] = {
            bx1:1+(s&3), bw1:3+((s>>>4)&3), bh1:Math.min(4+((s>>>8)&7),TILE-2),
            bx2:9+((s>>>12)&3), bw2:3+((s>>>16)&3), bh2:Math.min(3+((s>>>20)&5),TILE-2),
            wx:2+((s>>>2)&5), wy:2+((s>>>6)&3),
          };
        }
      }
    })();
    
    let frame = 0;
    
    // ================================================================
    //  DIRECTION SYSTEM
    // ================================================================
    const DIR = { RIGHT:0, UP:1, LEFT:2, DOWN:3 };
    const DIR_VEC = [[0,1],[-1,0],[0,-1],[1,0]];  // [drow, dcol]
    const DIR_ROT = [0, -Math.PI/2, Math.PI, Math.PI/2];
    
    // ── PLAYER PASSABILITY ────────────────────────────────────────────
    function tilePassable(row, col) {
      if (row < 0 || row >= ROWS) return false;
      if (col < 0 || col >= COLS) return (row === 13 || row === 14);
      const t = maze[row][col];
      return t !== T_WALL && t !== T_DOOR && t !== T_HOUSE;
    }
    
    // ================================================================
    //  GAME STATE
    // ================================================================
    const GS = {
      ATTRACT:        'ATTRACT',         // title / demo screen
      LEVEL_BANNER:   'LEVEL_BANNER',    // brief "LEVEL X: NAME" before each life
      READY:          'READY',           // "READY TO HAUL" – waiting for keypress
      PLAYING:        'PLAYING',         // active gameplay
      GHOST_EATEN:    'GHOST_EATEN',     // P3: 28-frame freeze when ghost is eaten
      PAUSED:         'PAUSED',          // B9: game paused
      DYING:          'DYING',           // truck death spin/shrink animation
      LEVEL_COMPLETE: 'LEVEL_COMPLETE',  // maze flash animation
      INTERMISSION:   'INTERMISSION',    // P6: brief cutscene between levels 2→3
      INITIALS:       'INITIALS',        // P6: 3-char initials entry before game over
      GAME_OVER:      'GAME_OVER',       // game-over screen
      // ── Phase 2–4 additions ──────────────────────────────────────────
      BOSS:           'BOSS',            // Ph2: boss level — no dots, survive 90 s timer
      CEREMONY:       'CEREMONY',        // Ph3: victory ceremony animation after boss win
      NEWSPAPER:      'NEWSPAPER',       // Ph3: FREIGHT NEWS shareable PNG screen
    };
    let gameState = GS.ATTRACT;

    // ── P6: SEEDED RNG (Mulberry32) ───────────────────────────────────
    // Used by daily challenge mode so every player gets identical ghost
    // behavior on a given calendar day.  Falls back to Math.random() in
    // normal play so nothing else changes.
    function mulberry32(seed) {
      return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    // Today's date string YYYY-MM-DD used as the seed source
    function todayStr() {
      const d = new Date();
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }
    function strToSeed(s) {
      let h = 0;
      for (let i = 0; i < s.length; i++) { h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
      return h >>> 0;
    }
    // dailyRng is the day's generator; normal play uses Math.random
    const dailyRng = dailyModeRef.current
      ? mulberry32(strToSeed(todayStr()))
      : null;
    // Wrapper: use seeded rng in daily mode, Math.random otherwise
    function gameRng() { return dailyRng ? dailyRng() : Math.random(); }
    
    let score     = 0;
    let hiScore   = 0; try { hiScore = parseInt(localStorage.getItem('fr_hi') || '0') || 0; } catch(e) {}
    let lives     = 3;
    let level     = 1;
    let extraLifeAwarded  = false;    // extra life at 10 000 pts
    let extraLife2Awarded = false;    // B8: second extra life at 30 000 pts
    
    // Pellet tracking
    let pelletsEaten    = 0;              // total pellets+power eaten this level
    const TOTAL_PELLETS = 240;            // 236 dots + 4 power pellets (depot corners now filled)
    
    // Ghost-mode state (B3)
    let dotsEaten        = 0;
    let frightenedTimer  = 0;
    let ghostsEatenChain = 0;
    let isFirstPlayOfGame = false; // set true in beginNewGame; cleared after first startPlaying call

    // ── B10: Per-game stats ───────────────────────────────────────────
    let statGhostsEaten  = 0;   // total ghosts eaten this game
    let statMaxChain     = 0;   // highest ghost-chain this game
    let statPelletsEaten = 0;   // total pellets eaten this game
    let statLevelsCleared= 0;   // levels fully cleared this game

    // ── Phase 2–4: Second-loop and boss state ─────────────────────────
    // ghostEatenEver: set true first time any ghost is eaten; drives pacifist branch (Ph4).
    // nightShiftActive: true from level 13+ — changes palette, boosts ghost speeds (Ph4).
    // nightShiftMultiplier: starts at 1.0, grows +0.1 each second-loop level cleared (Ph4).
    // bossTimer: counts up each frame during GS.BOSS; victory at BOSS_SURVIVE_FRAMES (Ph2).
    let ghostEatenEver       = false;
    let nightShiftActive     = false;
    let nightShiftMultiplier = 1.0;

    // ── Perf: cached ghost glow values (recomputed only on level change) ─
    // drawGhost() was computing rampT, glowR, and building a template-literal
    // rgba string for every ghost every frame. Level only changes between rounds.
    let _ghostGlowStr  = 'rgba(0,30,20,0.30)';   // initial level 1 values
    let _ghostGlowR    = 11;
    // Power ring RGB — parsed once per level, used in drawPowerFlash every frame
    let _ringR = 0, _ringG = 255, _ringB = 136, _ringGlow = '#00CC55';

    // ── Perf: memoized string caches ─────────────────────────────────────
    // These strings are built from values that only change on specific events
    // (score change, level change) — not every frame. Caching eliminates
    // per-frame string allocations and number formatting operations.
    let _scoreStr       = '0';        // updated in awardScore()
    let _hiScoreStr     = '0';        // updated in awardScore() when new hi set
    let _levelNameStr   = 'LVL1  LOCAL RUN';   // updated in _updateGhostGlowCache()
    let _nightShiftStr  = '×1.0 NIGHT SHIFT';  // updated in _updateGhostGlowCache()
    // Init hi-score string from persisted value (declared above, safe to assign now)
    _hiScoreStr = formatScore(hiScore);

    // ── Perf: per-frame single-computation caches ─────────────────────────
    // Values that are used in multiple places each frame but are identical
    // across all those calls. Computed once at top of gameLoop, read everywhere.
    let _truckPx = 0, _truckPy = 0;    // getTruckPixelPos() result
    let _flashPhase = 0;               // Math.floor(frame/7)%2 for fright flash

    function _updateGhostGlowCache() {
      const rampT       = Math.min((level - 1) / 4, 1.0);
      _ghostGlowR       = 11 + rampT * 9;
      const redExtra    = Math.floor(rampT * 180);
      _ghostGlowStr     = `rgba(${redExtra},${Math.floor(30*(1-rampT))},${Math.floor(20*(1-rampT))},${0.30 + rampT*0.35})`;
      // Power ring color — parse hex once per level, not per frame
      const th      = getLevelTheme();
      const ringHex = th.power    || '#00FF88';
      _ringGlow     = th.powerGlow || '#00CC55';
      _ringR = parseInt(ringHex.slice(1,3), 16);
      _ringG = parseInt(ringHex.slice(3,5), 16);
      _ringB = parseInt(ringHex.slice(5,7), 16);
      // Level name string — rebuilt once per level
      _levelNameStr  = `LVL${level}  ${getLevelName(level)}`;
      _nightShiftStr = `×${nightShiftMultiplier.toFixed(1)} NIGHT SHIFT`;
    }
    let bossTimer            = 0;
    const BOSS_SURVIVE_FRAMES = 90 * 60;   // 5 400 frames = 90 seconds at 60 fps

    // ── Phase 3: Ceremony + Newspaper state ───────────────────────────
    // ceremonyTimer: counts up each frame during GS.CEREMONY; auto-advances at 360 frames.
    // ceremonyConfetti: particle array for ceremony celebration burst.
    // newsSnapshotTaken: guards canvas.toDataURL so snapshot fires only once per newspaper.
    let ceremonyTimer       = 0;
    const ceremonyConfetti  = [];   // { x, y, vx, vy, color, life, spin, vspin, size }
    let newsSnapshotTaken   = false;

    // ── Phase 5: IRS game-over gag ────────────────────────────────────
    // irsGagTimer: when > 0, draws the IRS overlay on top of the initials screen.
    // Set to 210 frames (3.5 s) when the IRS gag condition fires in afterDeath().
    let irsGagTimer = 0;

    // ── Legend Haul Bonus ─────────────────────────────────────────────
    // Set to true when the player clears level 25 (Night Shift warp destination).
    // Passed through onGameComplete stats so App.jsx can credit $2,500 cash.
    const LEGEND_HAUL_BONUS = 2500;
    let legendHaulBonusEarned = false;

    // ── P5: ACHIEVEMENT SYSTEM ────────────────────────────────────────
    // Tracks which achievements have fired THIS GAME so each only triggers once.
    // The local standalone set writes to fr_ach_* in localStorage.
    // When embedded, onAchievementRef.current(id, data) is also called so
    // App.jsx can award XP, show its own notification, etc.
    const achedThisGame = new Set();

    // Per-level "no-death" tracking: set true when life is lost this level
    let diedThisLevel = false;

    // Contract item collection counter for contract king achievement
    let contractsCollectedThisGame = 0;

    // Level 1 speed-run: frame counter started when READY→PLAYING fires
    let level1StartFrame  = -1;
    const SPEED_RUN_FRAMES = 90 * 60; // 90 seconds at 60fps

    // Hi-score celebration: track whether we've crossed the old record this game
    let prevHiScore           = hiScore;  // snapshot before this game began
    let hiScoreCelebTriggered = false;
    let hiScoreCelebTimer     = 0;
    const HI_SCORE_CELEB_DUR  = 120;      // 2 s at 60fps

    // In-game achievement toast queue: { id, text, timer, maxTimer }
    const achieveToasts = [];
    const TOAST_DUR     = 180;  // 3 s at 60fps

    // ── P6: INITIALS ENTRY ────────────────────────────────────────────
    // 3-char arcade-style initial entry using arrow keys or D-pad.
    // UP/DOWN cycles letter; LEFT/RIGHT moves cursor; ENTER/SPACE confirms.
    const INITIALS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    let initialsChars = [0, 0, 0];   // indices into INITIALS_CHARS
    let initialsCursor = 0;           // 0, 1, or 2
    // Returns the 3-char initials string. If the player selects all spaces
    // the result trims to empty — we default to 'AAA' which is the initial
    // cursor position anyway, so this only fires on deliberate all-space entry.
    // We keep the fallback because an empty initials string breaks leaderboard rendering.
    let initialsStr = () => {
      const raw = initialsChars.map(i => INITIALS_CHARS[i]).join('');
      return raw.trim() || 'AAA';
    };

    function fireAchievement(id, data = {}) {
      if (achedThisGame.has(id)) return;        // once per game
      achedThisGame.add(id);
      // ── Standalone: persist to localStorage ──
      try { localStorage.setItem('fr_ach_' + id, '1'); } catch(e) {}
      // ── Embedded: notify parent ──
      if (onAchievementRef.current) {
        try { onAchievementRef.current(id, data); } catch(e) {}
      }
      // ── In-game toast ──
      const TOAST_LABELS = {
        fr_ghost_chain_2:   '×2 CHAIN!',
        fr_ghost_chain_4:   'ALL 4 GHOSTS!',
        fr_full_load:       'CLEAN RUN!',
        fr_contract_king:   'CONTRACT KING!',
        fr_speed_run_l1:    'SPEED RUNNER!',
        fr_overdrive:       'OVERDRIVE!',
        fr_hi_score:        'NEW RECORD!',
        fr_daily_complete:  'DAILY COMPLETE!',
      };
      const label = TOAST_LABELS[id] || id.replace('fr_', '').replace(/_/g, ' ').toUpperCase();
      achieveToasts.push({ id, text: label, timer: TOAST_DUR, maxTimer: TOAST_DUR });
    }
    
    // Death animation
    let deathTimer = 0;                   // counts up from 0 to DEATH_ANIM_DUR
    const DEATH_ANIM_DUR = 90;
    let deathPos   = { px: 0, py: 0 };   // pixel position where truck died

    // ── B6: Screen shake ─────────────────────────────────────────────
    let shakeTimer     = 0;              // counts down from SHAKE_DUR to 0
    const SHAKE_DUR    = 28;             // frames of shake on death
    const SHAKE_MAG    = 4;              // max pixel offset

    // ── B6: Ghost-house door flash ───────────────────────────────────
    let doorFlashTimer = 0;              // counts down when EATEN ghost enters house
    const DOOR_FLASH_DUR = 18;

    // ── P3: Ghost eaten freeze frame ──────────────────────────────────
    let ghostEatenTimer = 0;
    const GHOST_EATEN_DUR = 28;          // 28 logical frames ≈ 0.47 s at 60fps

    // ── P6: Intermission cutscene ─────────────────────────────────────
    // Extended: cinematic interludes fire after levels 2, 4, 6, 8.
    // currentInterlude holds the active scene object { update, render, skip, done }.
    let intermissionTimer = 0;
    const INTERMISSION_DUR = 240;        // 4 s fallback (legacy simple scene)
    let currentInterlude  = null;        // active cinematic interlude object or null

    // ── P3: Power pellet flash + ring ─────────────────────────────────
    let powerFlashTimer = 0;             // counts down from POWER_FLASH_DUR
    const POWER_FLASH_DUR = 8;
    let powerFlashPos = { px: 0, py: 0 }; // canvas coords of eaten power pellet

    // ── P3: Exhaust trail ─────────────────────────────────────────────
    // Array of { px, py, life, maxLife } — updated each PLAYING tick
    const exhaustTrail = [];
    const EXHAUST_MAX  = 6;              // max simultaneous particles
    const EXHAUST_LIFE = 10;             // frames each particle lives

    // ── P4: Ghost eaten burst particles ──────────────────────────────
    // 8-ray spark explosion in the ghost's own colour on eat.
    // { px, py, vx, vy, life, maxLife, color }
    const ghostBursts = [];
    const BURST_RAYS   = 8;
    const BURST_LIFE   = 22;             // frames each spark lives
    const BURST_SPEED  = 2.8;           // px/frame initial velocity
    
    // Level-complete flash
    let lvlCompleteTimer = 0;
    const LVL_FLASH_DUR  = 80;           // 80 frames → 4×20-frame half-cycles
    
    // Level-banner
    let bannerTimer = 0;
    const BANNER_DUR = 150;              // 2.5 s
    
    // Attract screen ghost parade state
    const attractGhosts = [
      { x: -20,  y: HUD_H + 460, dir: DIR.RIGHT, color: '#FF0000', emoji: '👮' },
      { x: -65,  y: HUD_H + 460, dir: DIR.RIGHT, color: '#FFB8FF', emoji: '📞' },
      { x: -110, y: HUD_H + 460, dir: DIR.RIGHT, color: '#00FFFF', emoji: '💼' },
      { x: -155, y: HUD_H + 460, dir: DIR.RIGHT, color: '#FFAA44', emoji: '🔑' },
    ];
    
    // ── PLAYER STATE ──────────────────────────────────────────────────
    const truck = {
      tileCol:13, tileRow:23, progress:0,
      dir:DIR.LEFT, nextDir:-1,
      speed:2.25, moving:false, alive:true, mouthPhase:0,  // speed was 1.8, now 1.25×
    };
    
    function eatPelletAt(row, col) {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      const t = maze[row][col];
      if (t === T_DOT) {
        maze[row][col] = T_EMPTY;
        awardScore(10);        // Ph4: multiplier-aware (replaces score+=10 + hi/extra checks)
        dotsEaten++;
        pelletsEaten++;
        dotsDirty = true;      // Perf: invalidate dot cache — one dot removed
        sfxDot();
        haptic(HAP_DOT);   // B9: tiny tick
        statPelletsEaten++;  // B10
      } else if (t === T_POWER) {
        maze[row][col] = T_EMPTY;
        awardScore(50);        // Ph4: multiplier-aware
        pelletsEaten++;
        dotsDirty = true;      // Perf: invalidate dot cache — power pellet removed
        sfxPower();
        sfxFrightened();
        haptic(HAP_POWER); // B9: double-pulse on power pellet
        statPelletsEaten++;  // B10
        // P3: record position for expanding ring + white flash
        powerFlashTimer = POWER_FLASH_DUR;
        powerFlashPos   = {
          px: col * TILE + TILE / 2,
          py: HUD_H + row * TILE + TILE / 2,
        };
        activateFrightened();
      }
      // Contract item — check if truck just stepped on it
      if (contractItem && row === CONTRACT_ROW && col === CONTRACT_COL) {
        // P6: use type-specific point value and label from BONUS_ITEMS catalogue
        const bdef = BONUS_ITEMS[contractItem.type] || BONUS_ITEMS.contract;
        const actualPts = awardScore(bdef.pts);  // Ph4: multiplier-aware
        const cpx = CONTRACT_COL * TILE + TILE/2;
        const cpy = HUD_H + CONTRACT_ROW * TILE + TILE/2;
        addFloat(bdef.label + ' +' + actualPts, cpx, cpy, bdef.glowColor);
        sfxContract();
        haptic(HAP_CONTRACT); // B9: sharp + long for contract
        contractItem = null;

        // Ph5: warp fruit — teleport to level 25
        if (bdef === BONUS_ITEMS.warp) {
          // Set up Night Shift at level-25 calibration, then jump
          nightShiftActive     = true;
          nightShiftMultiplier = Math.round((1.0 + (25 - 12) * 0.1) * 10) / 10; // ×2.3
          level = 24;  // advanceLevel() will increment to 25
          staticDirty = true; dotsDirty = true;
          addFloat('WARP!', cpx, cpy - 16, '#FF00FF', 11);
          advanceLevel();
          return;  // skip remaining eatPelletAt logic — level has changed
        }

        // P5: contract king achievement
        contractsCollectedThisGame++;
        const contractsAvailable = CONTRACT_SPAWN_AT.length;
        if (contractsCollectedThisGame >= contractsAvailable) {
          fireAchievement('fr_contract_king', { count: contractsCollectedThisGame });
        }
      }
      // Spawn contract item at threshold dot counts
      if (contractSpawnIdx < CONTRACT_SPAWN_AT.length &&
          pelletsEaten >= CONTRACT_SPAWN_AT[contractSpawnIdx] &&
          !contractItem) {
        contractItem = { timer: CONTRACT_DUR, type: pickBonusType() };
        contractSpawnIdx++;
      }
      // Level complete: all pellets eaten
      // Must also check GS.GHOST_EATEN — the final pellet could be the power
      // pellet that triggered the freeze, so we fire level complete through it.
      if (pelletsEaten >= TOTAL_PELLETS &&
          (gameState === GS.PLAYING || gameState === GS.GHOST_EATEN)) {
        startLevelComplete();
      }
    }
    
    // ── PLAYER UPDATE ─────────────────────────────────────────────────
    function updatePlayer() {
      if (!truck.alive || !truck.moving) return;
      const step = truck.speed / TILE;
      // B8: wider input buffer — accept queued turn in first 45% of tile crossing
      //     (was step+0.01 ≈ 6%, now 45%) — matches classic arcade feel
      if (truck.progress < 0.45) {
        if (truck.nextDir >= 0 && truck.nextDir !== truck.dir) {
          const [qdr, qdc] = DIR_VEC[truck.nextDir];
          if (tilePassable(truck.tileRow + qdr, truck.tileCol + qdc)) {
            truck.dir = truck.nextDir; truck.nextDir = -1;
          }
        }
        const [cdr, cdc] = DIR_VEC[truck.dir];
        if (!tilePassable(truck.tileRow + cdr, truck.tileCol + cdc)) {
          truck.progress = 0; return;
        }
      }
      truck.progress += step;
      truck.mouthPhase = (truck.mouthPhase + truck.speed) % (TILE * 2);
      if (truck.progress >= 1.0) {
        truck.progress -= 1.0;
        const [dr, dc] = DIR_VEC[truck.dir];
        let newCol = truck.tileCol + dc, newRow = truck.tileRow + dr;
        if (newCol < 0) newCol = COLS - 1;
        if (newCol >= COLS) newCol = 0;
        if (newRow < 0 || newRow >= ROWS) { truck.progress = 0; return; }
        truck.tileCol = newCol; truck.tileRow = newRow;
        eatPelletAt(truck.tileRow, truck.tileCol);
        if (truck.nextDir >= 0 && truck.nextDir !== truck.dir) {
          const [qdr, qdc] = DIR_VEC[truck.nextDir];
          if (tilePassable(truck.tileRow + qdr, truck.tileCol + qdc)) {
            truck.dir = truck.nextDir; truck.nextDir = -1;
          }
        }
      }
    }
    
    function getTruckPixelPos() {
      const [dr, dc] = DIR_VEC[truck.dir];
      return {
        px: truck.tileCol * TILE + TILE / 2 + dc * TILE * truck.progress,
        py: HUD_H + truck.tileRow * TILE + TILE / 2 + dr * TILE * truck.progress,
      };
    }
    
    // ── STATE MANAGEMENT ─────────────────────────────────────────────
    // Declared as function (not const) so it hoists above handleKeyDown below.
    function startPlaying() {
      gameState    = GS.PLAYING;
      truck.moving = true;
      truck.alive  = true;
      // Play full fanfare only on the very first tap of each new game;
      // use the short 2-note cue for respawns and level advances.
      if (isFirstPlayOfGame) { sfxStartup(); isFirstPlayOfGame = false; }
      else                   { sfxReady(); }
      // P5: start speed-run clock only on level 1, and only once
      if (level === 1 && level1StartFrame < 0) level1StartFrame = frame;
    }

    // ================================================================
    //  INPUT HANDLING
    // ================================================================
    const handleKeyDown = (e) => {
      tryUnlockAudio();   // unlock audio on first keypress (desktop browsers)
      let q = -1;
      switch (e.key) {
        case 'ArrowRight': case 'd': case 'D': q = DIR.RIGHT; break;
        case 'ArrowLeft':  case 'a': case 'A': q = DIR.LEFT;  break;
        case 'ArrowUp':    case 'w': case 'W': q = DIR.UP;    break;
        case 'ArrowDown':  case 's': case 'S': q = DIR.DOWN;  break;
      }
      if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();

      // ── P6: INITIALS ENTRY ──────────────────────────────────────────
      if (gameState === GS.INITIALS) {
        switch (e.key) {
          case 'ArrowLeft':  case 'a': case 'A':
            initialsCursor = Math.max(0, initialsCursor - 1); break;
          case 'ArrowRight': case 'd': case 'D':
            initialsCursor = Math.min(2, initialsCursor + 1); break;
          case 'ArrowUp':    case 'w': case 'W':
            initialsChars[initialsCursor] =
              (initialsChars[initialsCursor] + 1) % INITIALS_CHARS.length; break;
          case 'ArrowDown':  case 's': case 'S':
            initialsChars[initialsCursor] =
              (initialsChars[initialsCursor] - 1 + INITIALS_CHARS.length) % INITIALS_CHARS.length; break;
          case ' ': case 'Enter': confirmInitials(); break;
        }
        return;
      }
    
      // SPACE / ENTER: start or advance game
      if (e.key === ' ' || e.key === 'Enter') {
        if      (gameState === GS.ATTRACT)       beginNewGame();
        else if (gameState === GS.GAME_OVER)     beginNewGame();
        else if (gameState === GS.READY)         startPlaying();   // Bug E fix: ready screen
        else if (gameState === GS.INTERMISSION)  { if (currentInterlude) currentInterlude.skip(); else intermissionTimer = 0; } // skip
        else if (gameState === GS.BOSS)          { truck.moving = true; truck.alive = true; }  // Ph2: resume after respawn
        else if (gameState === GS.CEREMONY)      { level++; advanceLevel(); }                  // Ph2: advance past ceremony to level 13
        else if (gameState === GS.NEWSPAPER)     { setShowNewsRef.current(false); newsSnapshotTaken = false; level++; advanceLevel(); } // Ph3: advance from newspaper
        // Ph3: CEREMONY auto-advances; NEWSPAPER advance wired in Phase 3
        return;
      }
      // P key: toggle pause during gameplay
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if      (gameState === GS.PLAYING)     { gameState = GS.PAUSED; }
        else if (gameState === GS.GHOST_EATEN) { gameState = GS.PAUSED; }
        else if (gameState === GS.PAUSED)      { gameState = GS.PLAYING; }
        if (e.key !== 'Escape') return; // Escape still falls through to onClose
      }
      // Q key: quit to menu from pause
      // Embedded → call onClose to return to arcade cabinet
      // Standalone → return to attract screen
      if ((e.key === 'q' || e.key === 'Q') && gameState === GS.PAUSED) {
        if (embeddedRef.current && onClose) { onClose(); }
        else { stopAllWhines(); frightenedTimer = 0; exhaustTrail.length = 0; ghostBursts.length = 0; gameState = GS.ATTRACT; }
        return;
      }
    
      if (q !== -1) {
        // Queue direction first — valid in any state, picked up when PLAYING resumes
        truck.nextDir = q;
        // State transitions: same logic as handlePlayerInput
        if      (gameState === GS.ATTRACT)        beginNewGame();
        else if (gameState === GS.GAME_OVER)      beginNewGame();
        else if (gameState === GS.READY)          startPlaying();
        // DYING / LEVEL_BANNER / LEVEL_COMPLETE: direction queued, no state jump
      }
    };
    // Touch input handled by touchStart/touchEnd registered at bottom of useEffect.
    
    function resetTruck() {
      Object.assign(truck, {
        tileCol:13, tileRow:23, progress:0,
        dir:DIR.LEFT, nextDir:-1, speed:2.25,  // speed was 1.8, now 1.25×
        moving:false, alive:true, mouthPhase:0,
      });
    }
    
    // Begin a fully fresh game from ATTRACT / GAME_OVER
    function beginNewGame() {
      score = 0;
      _scoreStr = '0';               // Perf: reset cached score string
      lives = 3;
      _livesCached = -1;             // Perf: invalidate lives icon cache
      level = 1;
      _updateGhostGlowCache();     // Perf: prime ghost glow cache + level/nightshift strings
      extraLifeAwarded  = false;
      extraLife2Awarded = false;    // B8: reset second extra life flag
      maze = MAZE_TEMPLATE.map(r => [...r]);
      pelletsEaten = 0;
      contractItem     = null;
      contractSpawnIdx = 0;
      rebuildContractSpawns();  // B8: level 1 = 2 spawns
      sirenLastFrame = 0;   // B7: reset siren scheduler
      jingleLastFrame = -JINGLE_PERIOD; // B7: reset jingle scheduler
      staticDirty = true; dotsDirty = true;  // rebuild offscreen maze cache for level 1 theme
      setShowShareRef.current(false);  // P5: hide share button on new game
      // P3/P4: reset visual effect state
      ghostEatenTimer  = 0;
      powerFlashTimer  = 0;
      intermissionTimer = 0;          // defensive: clear any stale cutscene timer
      currentInterlude  = null;        // defensive: clear any active cinematic
      exhaustTrail.length = 0;
      ghostBursts.length  = 0;
      floatTexts.length   = 0;        // clear lingering score pops from previous game
      // B10: reset per-game stats
      statGhostsEaten   = 0;
      statMaxChain      = 0;
      statPelletsEaten  = 0;
      statLevelsCleared = 0;
      ghostIntros.length = 0;
      // P5: reset achievement state
      achedThisGame.clear();
      diedThisLevel             = false;
      contractsCollectedThisGame = 0;
      level1StartFrame          = -1;
      prevHiScore               = hiScore;
      hiScoreCelebTriggered     = false;
      isFirstPlayOfGame         = true;  // sfxStartup fires once; respawns use sfxReady
      hiScoreCelebTimer         = 0;
      achieveToasts.length      = 0;
      // Phase 2–4: reset second-loop and boss state
      ghostEatenEver       = false;
      nightShiftActive     = false;
      nightShiftMultiplier = 1.0;
      bossTimer            = 0;
      // Phase 3: reset ceremony + newspaper state
      ceremonyTimer       = 0;
      ceremonyConfetti.length = 0;
      newsSnapshotTaken   = false;
      // Phase 5: reset IRS gag
      irsGagTimer         = 0;
      // Legend Haul Bonus: reset each new game
      legendHaulBonusEarned = false;
      setShowNewsRef.current(false);
      setNewsDataUrlRef.current('');
      resetTruck();
      resetGhosts();
      gameState   = GS.LEVEL_BANNER;
      bannerTimer = BANNER_DUR;
    }
    
    // Extra-life check (10 000 pts once, 30 000 pts once — B8)
    function checkExtraLife() {
      if (!extraLifeAwarded && score >= 10000) {
        lives++;
        _livesCached = -1;    // Perf: invalidate lives icon cache
        extraLifeAwarded = true;
        sfxExtraLife();
        haptic(HAP_EXTRA); // B9
      }
      if (!extraLife2Awarded && score >= 30000) {
        lives++;
        _livesCached = -1;    // Perf: invalidate lives icon cache
        extraLife2Awarded = true;
        sfxExtraLife();
        haptic(HAP_EXTRA); // B9
      }
    }

    // P5: Hi-score achievement + celebration banner
    // Called whenever score may have crossed the previous session hi-score.
    // prevHiScore is snapshotted at beginNewGame so mid-game hi updates
    // don't raise the bar before the achievement fires.
    function checkHiScore() {
      if (!hiScoreCelebTriggered && prevHiScore > 0 && score > prevHiScore) {
        hiScoreCelebTriggered = true;
        fireAchievement('fr_hi_score', { score });
        hiScoreCelebTimer = HI_SCORE_CELEB_DUR;
      }
    }
    
    // Level complete – called when all pellets eaten
    function startLevelComplete() {
      gameState        = GS.LEVEL_COMPLETE;
      lvlCompleteTimer = LVL_FLASH_DUR;
      truck.moving     = false;
      stopAllWhines(); // B7: silence return whines on level end
      sfxLevelComplete();
      haptic(HAP_LEVEL); // B9
      statLevelsCleared++;  // B10
      // P5: level-clear achievements
      if (!diedThisLevel) fireAchievement('fr_full_load', { level });
      if (level === 1 && level1StartFrame >= 0 && (frame - level1StartFrame) <= SPEED_RUN_FRAMES) {
        fireAchievement('fr_speed_run_l1', { frames: frame - level1StartFrame });
      }
      if (level >= 5) fireAchievement('fr_overdrive', {});
      // Legend Haul Bonus: clearing level 25 earns $2,500 cash back in Box Truck Boss
      if (level === 25 && !legendHaulBonusEarned) {
        legendHaulBonusEarned = true;
        addFloat('LEGEND HAUL BONUS!', _truckPx, _truckPy - 16, '#FFD700', 10);
        addFloat('+$2,500', _truckPx, _truckPy + 4, '#00FF88', 9);
      }
    }
    
    // Advance to next level
    function advanceLevel() {
      level++;
      _updateGhostGlowCache();     // Perf: refresh ghost glow cache for new level
      maze = MAZE_TEMPLATE.map(r => [...r]);
      pelletsEaten = 0;
      contractItem     = null;
      contractSpawnIdx = 0;
      rebuildContractSpawns();  // B8: adds 3rd spawn at level 3+
      ghostIntros.length = 0;   // B10: clear intro badges for new level
      staticDirty = true; dotsDirty = true;       // rebuild offscreen maze cache for new level theme
      diedThisLevel = false;    // P5: reset per-level death flag for full_load achievement
      // P5: reset contract collection counter so fr_contract_king tracks per-level
      // (a player who collected 2/2 contracts on level 1 shouldn't get the achievement
      // for collecting 1/3 on level 3 just because the running total hit contractsAvailable)
      contractsCollectedThisGame = 0;
      // P3/P4: reset visual effect state
      ghostEatenTimer = 0;
      powerFlashTimer = 0;
      exhaustTrail.length = 0;
      ghostBursts.length  = 0;
      floatTexts.length   = 0;        // clear lingering score pops from end of level
      // P6: intermission plays between levels 2→3, 4→5, 6→7, 8→9 (full cinematics)
      // Ph1: odometer milestone fires between levels 10→11
      // Ph4: level 13 entry fires Kill Screen (normal) or Pacifist (never ate a ghost)
      if (level === 3 || level === 5 || level === 7 || level === 9 || level === 11) {
        // sceneIdx: level 3=0, 5=1, 7=2, 9=3, 11=4
        const sceneIdx = (level - 3) / 2;
        currentInterlude = [
          makeInterlude1, makeInterlude2,
          makeInterlude3, makeInterlude4,
          makeInterlude5,                    // Ph1: odometer milestone
        ][sceneIdx]();
        intermissionTimer = INTERMISSION_DUR; // safety fallback timer
        gameState = GS.INTERMISSION;
        return;   // skip resetTruck/resetGhosts/banner — interlude handles transition
      }
      if (level === 13) {
        // Ph4: branch on pacifist flag — never ate a ghost → special FMCSA ending
        currentInterlude = ghostEatenEver
          ? makeInterludeKillScreen()
          : makeInterludePacifist();
        intermissionTimer = INTERMISSION_DUR;
        gameState = GS.INTERMISSION;
        return;
      }
      // Ph5: level 15 — HOS violation interlude
      if (level === 15) {
        currentInterlude = makeInterludeHOS();
        intermissionTimer = INTERMISSION_DUR;
        gameState = GS.INTERMISSION;
        return;
      }
      // Ph2: level 12 is the boss level — no dots, survive 90 seconds
      if (level === 12) {
        enterBossLevel();
        return;   // enterBossLevel handles truck/ghost reset and state change
      }
      // Ph4: levels 13+ are Night Shift — activate on entry, bump multiplier each level
      if (level >= 13) {
        if (!nightShiftActive) {
          nightShiftActive     = true;
          nightShiftMultiplier = 1.1;   // first night-shift level starts at ×1.1
          staticDirty = true; dotsDirty = true;           // force maze cache rebuild with night theme
        } else {
          nightShiftMultiplier = Math.round((nightShiftMultiplier + 0.1) * 10) / 10;
          staticDirty = true; dotsDirty = true;
        }
      }
      resetTruck();
      resetGhosts();
      gameState   = GS.LEVEL_BANNER;
      bannerTimer = BANNER_DUR;
    }
    
    // ── Ph2: BOSS LEVEL SETUP ─────────────────────────────────────────
    // enterBossLevel(): called from advanceLevel() when level becomes 12.
    // Builds the boss maze (all dots cleared, 4 power pellets remain),
    // sets ghosts to permanent max-speed chase, resets truck, starts GS.BOSS.
    // advanceLevel() has already done the common resets (floatTexts, bursts, etc.)
    // before this is called, so we only handle boss-specific setup here.
    function enterBossLevel() {
      // Boss maze: all T_DOT cleared → T_EMPTY; T_POWER, walls, house intact
      maze = MAZE_TEMPLATE.map(r => r.map(t => t === T_DOT ? T_EMPTY : t));
      pelletsEaten    = 0;
      contractItem    = null;
      contractSpawnIdx = 0;

      // Ghost speeds: locked to max (level-12 cap is 0.625 on the spd factor)
      GHOST_SPD.SCATTER    = 1.65 + 0.625;  // 2.275 — max scatter speed
      GHOST_SPD.CHASE      = 1.80 + 0.625;  // 2.425 — max chase speed
      GHOST_SPD.FRIGHTENED = 0.6875;         // minimum (power pellets still work as lifelines)
      const BOSS_FRIGHT_DUR = 96;            // 1.6 s — short window, not a free pass
      initGhosts(BOSS_FRIGHT_DUR, false);

      // Force all ghosts to release immediately (override dot-count thresholds)
      for (const g of ghosts) {
        if (g.state === GHOST_ST.HOUSE) g.releaseAt = 0;
      }
      // Lock global mode to permanent CHASE (index 7 = dur:999999)
      modeIdx    = MODE_SEQ.length - 1;
      modeTimer  = MODE_SEQ[MODE_SEQ.length - 1].dur;
      globalMode = GHOST_ST.CHASE;

      dotsEaten        = 0;
      frightenedTimer  = 0;
      ghostsEatenChain = 0;

      bossTimer = 0;
      resetTruck();   // place truck at spawn; truck.moving = false (wait for input)
      sfxBossEntry();
      gameState = GS.BOSS;
    }

    // bossVictory(): called when bossTimer reaches BOSS_SURVIVE_FRAMES.
    // Awards a score bonus, fires the victory fanfare, transitions to GS.CEREMONY.
    function bossVictory() {
      truck.moving = false;
      stopAllWhines();
      sfxBossVictory();
      statLevelsCleared++;                      // boss counts as a cleared level
      haptic(HAP_LEVEL);
      const BOSS_BONUS = 5000;
      score += BOSS_BONUS;
      if (score > hiScore) {
        hiScore = score;
        try { localStorage.setItem('fr_hi', hiScore); } catch(e) {}
        checkHiScore();
      }
      addFloat('BOSS CLEAR!', CW/2, HUD_H + MAZE_H/2 - 20, '#FFD700', 11);
      addFloat('+' + BOSS_BONUS, CW/2, HUD_H + MAZE_H/2 + 4, '#00FF88', 9);
      bossTimer = 0;        // reused as ceremony hold-timer in Ph2 stub
      gameState = GS.CEREMONY;
    }

    // Called when truck is caught by ghost
    function loseLife() {
      // Guard: only trigger during active gameplay states.
      // Must include GS.GHOST_EATEN — otherwise a non-frightened ghost that
      // collides on the same tick a frightened ghost is eaten is silently ignored,
      // granting the player unintended invincibility for 28 frames.
      // Ph2: also allow during GS.BOSS — same collision rules apply.
      if (gameState !== GS.PLAYING && gameState !== GS.GHOST_EATEN && gameState !== GS.BOSS) return;
      diedThisLevel  = true;   // P5: used by fr_full_load achievement check
      ghostEatenTimer = 0;     // cancel any active freeze frame so death takes over cleanly
      deathPos  = getTruckPixelPos();
      deathTimer = 0;
      shakeTimer = SHAKE_DUR;           // B6: start screen shake
      truck.alive  = false;
      truck.moving = false;
      gameState    = GS.DYING;
      stopAllWhines();  // B7: silence eaten-ghost whines
      // Play sting on final life, regular death sound otherwise
      if (lives <= 1) sfxGameOverSting(); else sfxDeath();
      haptic(HAP_DEATH); // B9: rumble on death
    }
    
    // After death animation completes
    function afterDeath() {
      lives = Math.max(0, lives - 1);
      _livesCached = -1;    // Perf: invalidate lives icon cache
      if (lives <= 0) {
        floatTexts.length = 0;   // clear score pops before initials screen
        ghostBursts.length = 0;  // clear any lingering burst particles
        submitScore(score, level);  // B10: save to leaderboard
        // P5: fire any pending hi-score achievement before game ends
        checkHiScore();
        // Ph5: IRS gag — Night Shift player with big score gets audited
        if (nightShiftActive && score > 50000) irsGagTimer = 210;
        // P6: go to initials entry first; initials confirm triggers GAME_OVER
        initialsChars = [0, 0, 0];
        initialsCursor = 0;
        gameState = GS.INITIALS;
      } else if (level === 12) {
        // Ph2: died during boss — soft respawn.
        // bossTimer keeps running (no penalty reset), truck repositions,
        // ghosts re-stagger. Player presses any key to resume.
        resetTruck();
        GHOST_SPD.SCATTER    = 1.65 + 0.625;
        GHOST_SPD.CHASE      = 1.80 + 0.625;
        GHOST_SPD.FRIGHTENED = 0.6875;
        initGhosts(96, true);   // stagger release after death
        for (const g of ghosts) { if (g.state === GHOST_ST.HOUSE) g.releaseAt = 0; }
        modeIdx    = MODE_SEQ.length - 1;
        modeTimer  = MODE_SEQ[MODE_SEQ.length - 1].dur;
        globalMode = GHOST_ST.CHASE;
        frightenedTimer  = 0;
        ghostsEatenChain = 0;
        gameState = GS.BOSS;   // truck.moving stays false — wait for input
      } else {
        resetTruck();
        resetGhosts(true);   // P3: stagger ghost release on new life
        gameState   = GS.LEVEL_BANNER;
        bannerTimer = BANNER_DUR;
      }
    }
    
    // P6: called when player presses Enter/Space on the initials screen
    function confirmInitials() {
      const initials = initialsStr();
      // Update the leaderboard entry we just submitted with the initials
      try {
        const lb = loadLeaderboard();
        if (lb.length > 0 && lb[0].score === score) {
          lb[0].initials = initials;
          saveLeaderboard(lb);
        }
      } catch(e) {}
      // Fire full onGameComplete now that we have initials
      if (embeddedRef.current && onGameCompleteRef.current) {
        const stats = {
          ghosts:   statGhostsEaten,
          maxChain: statMaxChain,
          pellets:  statPelletsEaten,
          levels:   statLevelsCleared,
          hiScore:  hiScore,
          daily:    dailyModeRef.current,
          date:     dailyModeRef.current ? todayStr() : null,
          // Legend Haul Bonus: $2,500 cash reward if player cleared level 25
          legendHaulBonus: legendHaulBonusEarned ? LEGEND_HAUL_BONUS : 0,
        };
        onGameCompleteRef.current(score, level, initials, stats);
      }
      setShowShareRef.current(true);
      if (dailyModeRef.current) fireAchievement('fr_daily_complete', { date: todayStr(), score });
      gameState = GS.GAME_OVER;
    }

    
    
    // ── GHOST STATE CONSTANTS ─────────────────────────────────────────
    const GHOST_ST = {
      HOUSE:     'HOUSE',
      LEAVING:   'LEAVING',
      SCATTER:   'SCATTER',
      CHASE:     'CHASE',
      FRIGHTENED:'FRIGHTENED',
      EATEN:     'EATEN',
    };
    
    // ── GHOST SPEEDS (px/frame) ───────────────────────────────────────
    // All base speeds are 1.25× the original values for a faster overall pace.
    const GHOST_SPD = {
      HOUSE:      0.90,   // was 0.72
      LEAVING:    1.35,   // was 1.08
      SCATTER:    1.65,   // was 1.32
      CHASE:      1.80,   // was 1.44
      FRIGHTENED: 1.05,   // was 0.84
      EATEN:      3.90,   // was 3.12
    };

    // ── B8: TUNNEL SLOWDOWN ───────────────────────────────────────────
    // Classic rule: ghosts halve speed while inside the wrap tunnels.
    // Tunnel rows are 13–14; cols 0–5 and 22–27 are the tunnel sections.
    const TUNNEL_ROWS   = new Set([13, 14]);
    const TUNNEL_COL_LO = 6;   // cols < this are tunnel
    const TUNNEL_COL_HI = 21;  // cols > this are tunnel
    function ghostTunnelSpeed(g, baseSpeed) {
      if (!TUNNEL_ROWS.has(g.tileRow)) return baseSpeed;
      if (g.tileCol < TUNNEL_COL_LO || g.tileCol > TUNNEL_COL_HI) return baseSpeed * 0.50;
      return baseSpeed;
    }
    
    // ── FRIGHTENED TIMING ─────────────────────────────────────────────
    const FRIGHT_FLASH = 96;   // flash in last 1.6s — was 120, scaled ÷1.25
    
    // ── GLOBAL SCATTER / CHASE MODE SEQUENCE ─────────────────────────
    // {mode, dur} where dur is frames. Last entry stays forever.
    const MODE_SEQ = [
      {mode:GHOST_ST.SCATTER, dur:420},
      {mode:GHOST_ST.CHASE,   dur:1200},
      {mode:GHOST_ST.SCATTER, dur:420},
      {mode:GHOST_ST.CHASE,   dur:1200},
      {mode:GHOST_ST.SCATTER, dur:300},
      {mode:GHOST_ST.CHASE,   dur:1200},
      {mode:GHOST_ST.SCATTER, dur:300},
      {mode:GHOST_ST.CHASE,   dur:999999},
    ];
    let modeIdx    = 0;
    let modeTimer  = MODE_SEQ[0].dur;
    let globalMode = GHOST_ST.SCATTER;
    
    let _currentFrightDur = 360;
    
    // ── GHOST OBJECT FACTORY ──────────────────────────────────────────
    // Each ghost: { name, emoji, color, tileRow, tileCol, progress,
    //   dir, state, releaseAt, respawnTimer, scatterTarget }
    let ghosts = [];
    
    function makeGhost(name, emoji, color, colorKey, startRow, startCol, startState, releaseAt, scatR, scatC, startDir) {
      return {
        name, emoji, color, colorKey,  // B9: colorKey for CB palette lookup
        tileRow: startRow, tileCol: startCol,
        progress: 0,
        dir: startDir,
        state: startState,
        releaseAt,      // dotsEaten threshold to exit house (first time)
        respawnTimer: 0,// frames to wait after being eaten before leaving again
        scatterTarget: { row: scatR, col: scatC },
      };
    }
    
    function initGhosts(frightDur, postDeath = false) {
      const fd = frightDur !== undefined ? frightDur : 360;
      // Store on a module-level so activateFrightened can read it
      _currentFrightDur = fd;
      ghosts = [
        // DOT  (Blinky) – starts OUTSIDE, top-right scatter
        makeGhost('DOT',    '👮', C.gDot,    'gDot',    11, 13, GHOST_ST.SCATTER, 0,  0, 25, DIR.LEFT),
        // BROKER (Pinky) – center of house, top-left scatter
        makeGhost('BROKER', '📞', C.gBroker, 'gBroker', 14, 13, GHOST_ST.HOUSE,   0,  0,  2, DIR.UP),
        // IRS  (Inky)  – left of house, bottom-right scatter
        makeGhost('IRS',    '💼', C.gIrs,    'gIrs',    14, 11, GHOST_ST.HOUSE,  30, 30, 27, DIR.UP),
        // REPO (Clyde) – right of house, bottom-left scatter
        makeGhost('REPO',   '🔑', C.gRepo,   'gRepo',   14, 15, GHOST_ST.HOUSE,  60, 30,  0, DIR.UP),
      ];
      // P3: Post-death respawn stagger — BROKER/IRS/REPO trickle out over ~4s
      // instead of flooding immediately. DOT starts outside and is unaffected.
      // Frames at 60fps: BROKER≈1s, IRS≈2.5s, REPO≈4s.
      if (postDeath) {
        ghosts[1].respawnTimer = 60;
        ghosts[2].respawnTimer = 150;
        ghosts[3].respawnTimer = 240;
      }
      modeIdx   = 0;
      modeTimer = MODE_SEQ[0].dur;
      globalMode = GHOST_ST.SCATTER;
    }
    
    // ── GHOST PASSABILITY ─────────────────────────────────────────────
    function ghostPassable(row, col, g) {
      if (row < 0 || row >= ROWS) return false;
      if (col < 0 || col >= COLS) return (row === 13 || row === 14); // tunnel
      // Use the original template for structure (dots eaten don't change walls/doors)
      const t = MAZE_TEMPLATE[row][col];
      if (t === T_WALL) return false;
      // Ghost door: only passable when leaving or returning after being eaten
      if (t === T_DOOR) return g.state === GHOST_ST.LEAVING || g.state === GHOST_ST.EATEN;
      // House interior: passable only for ghosts inside house, leaving, or returning eaten
      if (t === T_HOUSE) return (
        g.state === GHOST_ST.HOUSE ||
        g.state === GHOST_ST.LEAVING ||
        g.state === GHOST_ST.EATEN
      );
      return true; // T_DOT / T_EMPTY / T_POWER – always open
    }
    
    // ── GHOST AI TARGETING ────────────────────────────────────────────
    function getChaseTarget(g) {
      switch (g.name) {
    
        case 'DOT': {
          // Shadow (Blinky): always aims at truck's exact tile
          return { row: truck.tileRow, col: truck.tileCol };
        }
    
        case 'BROKER': {
          // Speedy (Pinky): 4 tiles ahead at levels 1-3, 6 tiles at level 4+
          // P6: wider lookahead makes BROKER significantly more dangerous at high levels
          const lookahead = level >= 4 ? 6 : 4;
          const [dr, dc] = DIR_VEC[truck.dir];
          return {
            row: Math.max(0, Math.min(ROWS-1, truck.tileRow + dr * lookahead)),
            col: Math.max(0, Math.min(COLS-1, truck.tileCol + dc * lookahead)),
          };
        }

        case 'IRS': {
          // Bashful (Inky): vector from DOT doubled through 2-ahead pivot
          const dot = ghosts[0]; // DOT is always index 0
          const [dr, dc] = DIR_VEC[truck.dir];
          const pivRow = truck.tileRow + dr * 2;
          const pivCol = truck.tileCol + dc * 2;
          return {
            row: Math.max(0, Math.min(ROWS-1, pivRow + (pivRow - dot.tileRow))),
            col: Math.max(0, Math.min(COLS-1, pivCol + (pivCol - dot.tileCol))),
          };
        }

        case 'REPO': {
          // Pokey (Clyde): retreats when close, chases when far
          // P6: proximity threshold tightens at level 4+ (6 tiles instead of 8)
          //     so REPO retreats later and pressures the player more
          const threshold = level >= 4 ? 6 : 8;
          const dist = Math.hypot(g.tileRow - truck.tileRow, g.tileCol - truck.tileCol);
          if (dist > threshold) return { row: truck.tileRow, col: truck.tileCol };
          return g.scatterTarget;
        }
    
        default:
          return { row: truck.tileRow, col: truck.tileCol };
      }
    }
    
    // ── DIRECTION SELECTION ───────────────────────────────────────────
    // Classic priority: UP > LEFT > DOWN > RIGHT (tiebreak)
    const DIR_PRIO = [DIR.UP, DIR.LEFT, DIR.DOWN, DIR.RIGHT];
    
    function chooseGhostDir(g, targetRow, targetCol) {
      const reverse = (g.dir + 2) % 4;
      let bestDir = -1, bestDist = Infinity;
      for (const d of DIR_PRIO) {
        if (d === reverse) continue;
        const [dr, dc] = DIR_VEC[d];
        const nr = g.tileRow + dr, nc = g.tileCol + dc;
        if (!ghostPassable(nr, nc, g)) continue;
        const dist = (nr - targetRow) ** 2 + (nc - targetCol) ** 2;
        if (dist < bestDist) { bestDist = dist; bestDir = d; }
      }
      // If completely boxed in (edge case): allow reversing
      if (bestDir < 0) {
        const [rdr, rdc] = DIR_VEC[reverse];
        if (ghostPassable(g.tileRow + rdr, g.tileCol + rdc, g)) return reverse;
      }
      return bestDir >= 0 ? bestDir : g.dir;
    }
    
    function chooseFrightenedDir(g) {
      const reverse = (g.dir + 2) % 4;
      const valid = [];
      for (let d = 0; d < 4; d++) {
        if (d === reverse) continue;
        const [dr, dc] = DIR_VEC[d];
        if (ghostPassable(g.tileRow + dr, g.tileCol + dc, g)) valid.push(d);
      }
      if (valid.length === 0) return reverse;
      return valid[Math.floor(gameRng() * valid.length)];
    }
    
    // ── FRIGHTENED ACTIVATION ─────────────────────────────────────────
    function activateFrightened() {
      frightenedTimer  = _currentFrightDur;
      ghostsEatenChain = 0;
      for (const g of ghosts) {
        if (g.state === GHOST_ST.SCATTER || g.state === GHOST_ST.CHASE) {
          g.state = GHOST_ST.FRIGHTENED;
          g.dir   = (g.dir + 2) % 4; // reverse direction on fright
        }
      }
    }
    
    // ── GHOST PIXEL POSITION ─────────────────────────────────────────
    function getGhostPixelPos(g) {
      const [dr, dc] = DIR_VEC[g.dir];
      return {
        px: g.tileCol * TILE + TILE / 2 + dc * TILE * g.progress,
        py: HUD_H + g.tileRow * TILE + TILE / 2 + dr * TILE * g.progress,
      };
    }
    
    // ── GHOST MOVEMENT — individual state handlers ────────────────────
    
    function advanceGhost(g, speed) {
      // Advance progress; returns true when crossing into a new tile
      g.progress += speed / TILE;
      if (g.progress >= 1.0) {
        g.progress -= 1.0;
        const [dr, dc] = DIR_VEC[g.dir];
        let nr = g.tileRow + dr, nc = g.tileCol + dc;
        // Tunnel wrap
        if (nc < 0)     nc = COLS - 1;
        if (nc >= COLS) nc = 0;
        g.tileRow = nr;
        g.tileCol = nc;
        return true; // just entered a new tile
      }
      return false;
    }
    
    function updateGhostHouse(g) {
      // Respawn timer counts down every frame (not per tile) so 90 frames = 1.5s
      if (g.respawnTimer > 0) {
        g.respawnTimer--;
        if (g.respawnTimer === 0) {
          g.state = GHOST_ST.LEAVING;
          return;
        }
      } else if (g.releaseAt === 0 || dotsEaten >= g.releaseAt) {
        // Original ghosts with releaseAt=0 leave immediately;
        // re-eaten ghosts wait for respawnTimer (handled above)
        g.state = GHOST_ST.LEAVING;
        return;
      }
    
      // Cosmetic bounce while waiting inside house
      const crossed = advanceGhost(g, GHOST_SPD.HOUSE);
      if (!crossed) return;
      // Flip direction at walls / non-house tiles
      const [dr, dc] = DIR_VEC[g.dir];
      if (!ghostPassable(g.tileRow + dr, g.tileCol + dc, g)) {
        g.dir = (g.dir + 2) % 4;
      }
    }
    
    function updateGhostLeaving(g) {
      const crossed = advanceGhost(g, GHOST_SPD.LEAVING);
      if (!crossed) return;
      // Exited the house?
      if (g.tileRow <= 11) {
        g.state = globalMode; // join scatter or chase
        g.dir   = DIR.LEFT;   // classic exit direction
        triggerGhostIntro(g); // B10: show name badge on first exit
        return;
      }
      // Choose leaving direction: center at col 13, then go UP
      if      (g.tileCol < 13) g.dir = DIR.RIGHT;
      else if (g.tileCol > 13) g.dir = DIR.LEFT;
      else                      g.dir = DIR.UP;
    }
    
    function updateGhostMoving(g) {
      // B8: tunnel slowdown — ghosts slow to 50% in the wrap corridors
      const spd = ghostTunnelSpeed(g, GHOST_SPD[g.state]);
      const crossed = advanceGhost(g, spd);
      if (!crossed) return;
    
      // EATEN arrives at ghost house interior
      if (g.state === GHOST_ST.EATEN && g.tileRow === 14 && g.tileCol === 13) {
        g.state        = GHOST_ST.HOUSE;
        g.dir          = DIR.UP;
        g.respawnTimer = 90; // 1.5 s before re-releasing
        doorFlashTimer = DOOR_FLASH_DUR;  // B6: flash the door
        return;
      }
    
      // Choose next direction based on state
      let nextDir;
      if (g.state === GHOST_ST.FRIGHTENED) {
        nextDir = chooseFrightenedDir(g);
      } else if (g.state === GHOST_ST.EATEN) {
        // Navigate straight to house centre (14,13) — matches the arrival check below.
        // EATEN ghosts can pass through the door (ghostPassable allows it),
        // so targeting the interior directly works cleanly.
        nextDir = chooseGhostDir(g, 14, 13);
      } else {
        // SCATTER or CHASE
        let tRow, tCol;
        if (g.state === GHOST_ST.SCATTER) {
          tRow = g.scatterTarget.row; tCol = g.scatterTarget.col;
        } else {
          const t = getChaseTarget(g); tRow = t.row; tCol = t.col;
        }
        nextDir = chooseGhostDir(g, tRow, tCol);
      }
      g.dir = nextDir;
    }
    
    function updateSingleGhost(g) {
      switch (g.state) {
        case GHOST_ST.HOUSE:     updateGhostHouse(g);   break;
        case GHOST_ST.LEAVING:   updateGhostLeaving(g); break;
        default:                 updateGhostMoving(g);  break;
      }
    }
    
    // ── GLOBAL MODE TIMER ─────────────────────────────────────────────
    function updateGlobalMode() {
      if (frightenedTimer > 0) {
        frightenedTimer--;
        if (frightenedTimer === 0) {
          // Frightened ends: resume global mode for all frightened ghosts
          for (const g of ghosts) {
            if (g.state === GHOST_ST.FRIGHTENED) {
              g.state = globalMode;
              // Don't reverse; just continue in current direction
            }
          }
        }
        return; // don't advance scatter/chase timer while frightened
      }
      modeTimer--;
      if (modeTimer <= 0) {
        modeIdx = Math.min(modeIdx + 1, MODE_SEQ.length - 1);
        const newMode = MODE_SEQ[modeIdx].mode;
        modeTimer = MODE_SEQ[modeIdx].dur;
        if (newMode !== globalMode) {
          globalMode = newMode;
          // Reverse all active ghosts on mode switch
          for (const g of ghosts) {
            if (g.state === GHOST_ST.SCATTER || g.state === GHOST_ST.CHASE) {
              g.state = globalMode;
              g.dir   = (g.dir + 2) % 4;
            }
          }
        }
      }
    }
    
    // ── MAIN GHOST UPDATE ─────────────────────────────────────────────
    function updateGhosts() {
      updateGlobalMode();
      for (const g of ghosts) {
        updateSingleGhost(g);
        // Perf: cache pixel position on ghost object immediately after movement.
        // getGhostPixelPos(g) is called up to 3x per ghost per frame across
        // checkGhostCollisions, drawGhost, drawGhosts batch — this eliminates
        // 8+ redundant multiply+add operations per frame.
        const [dr, dc] = DIR_VEC[g.dir];
        g._px = g.tileCol * TILE + TILE / 2 + dc * TILE * g.progress;
        g._py = HUD_H + g.tileRow * TILE + TILE / 2 + dr * TILE * g.progress;
      }
    }

    // B10: tick ghost intro badge timers
    function updateGhostIntros() {
      for (let i = ghostIntros.length - 1; i >= 0; i--) {
        ghostIntros[i].py -= 0.35;  // drift upward
        ghostIntros[i].timer--;
        if (ghostIntros[i].timer <= 0) ghostIntros.splice(i, 1);
      }
    }
    
    // ── GHOST COLLISION DETECTION ─────────────────────────────────────
    function checkGhostCollisions() {
      if (!truck.alive) return;
      // Perf: use pre-cached pixel positions computed in updateGhosts/_truckPx
      const tpx = _truckPx, tpy = _truckPy;
      for (const g of ghosts) {
        if (g.state === GHOST_ST.HOUSE || g.state === GHOST_ST.LEAVING) continue;
        const dx = g._px - tpx, dy = g._py - tpy;
        if (dx * dx + dy * dy < (TILE * 0.72) * (TILE * 0.72)) {
          if (g.state === GHOST_ST.FRIGHTENED) {
            // Eat the ghost
            g.state = GHOST_ST.EATEN;
            ghostsEatenChain++;
            const basePts = [200, 400, 800, 1600][Math.min(ghostsEatenChain - 1, 3)];
            const pts = awardScore(basePts);  // Ph4: multiplier-aware; returns actual awarded
            sfxGhostEaten(ghostsEatenChain);
            haptic(HAP_GHOST); // B9: firm double on ghost eat
            statGhostsEaten++;                                        // B10
            statMaxChain = Math.max(statMaxChain, ghostsEatenChain);  // B10
            ghostEatenEver = true;   // Ph4: pacifist-ending check — cleared in beginNewGame
            // P5: chain achievements
            if (ghostsEatenChain >= 2) fireAchievement('fr_ghost_chain_2', { chain: ghostsEatenChain });
            if (ghostsEatenChain >= 4) fireAchievement('fr_ghost_chain_4', { chain: 4 });
            // B8: float text size scales with chain value (200=7px → 1600=13px)
            const floatSize = [7, 9, 11, 13][Math.min(ghostsEatenChain - 1, 3)];
            addFloat('+' + pts, g._px, g._py, '#00FFFF', floatSize);
            // B8: combo multiplier flash for chain >= 2
            if (ghostsEatenChain >= 2) {
              const mult = Math.pow(2, ghostsEatenChain - 1);
              addFloat('×' + mult, g._px + 10, g._py - 10, '#FFD700', floatSize - 1);
            }
            // P3: enter freeze frame — everything pauses for GHOST_EATEN_DUR ticks
            ghostEatenTimer = GHOST_EATEN_DUR;
            gameState = GS.GHOST_EATEN;
            // P4: spawn colour-matched spark burst at ghost position
            spawnGhostBurst(g._px, g._py, g.color);
          } else if (g.state !== GHOST_ST.EATEN) {
            // Truck caught by ghost
            loseLife();
            return; // stop checking after a hit
          }
        }
      }
    }
    
    // ── RESET GHOSTS ──────────────────────────────────────────────────
    function resetGhosts(postDeath = false) {
      stopAllWhines();  // B7: silence any EATEN return whines before reinit
      // Ghost speeds scale with level — all coefficients 1.25× for faster pace
      const spd = Math.min(0.10 * (level - 1), 0.625);  // was 0.08/level cap 0.5
      // Ph4: Night Shift adds a flat +25% on top of the level-scaled speed
      const nightBoost = nightShiftActive ? 0.25 : 0;
      GHOST_SPD.SCATTER    = 1.65 + spd + nightBoost;
      GHOST_SPD.CHASE      = 1.80 + spd + nightBoost;
      GHOST_SPD.FRIGHTENED = Math.max(0.6875, 1.05 - 0.05 * (level - 1));
      // Fright duration scaled down by 1.25× (faster game = shorter window, min 48 frames = 0.8s)
      // Ph4: Night Shift halves the fright window for extra pressure
      const FRIGHT_DUR_LEVEL = nightShiftActive
        ? Math.max(24, Math.floor((Math.max(48, 288 - 48 * (level - 1))) / 2))
        : Math.max(48, 288 - 48 * (level - 1));
      initGhosts(FRIGHT_DUR_LEVEL, postDeath);
      dotsEaten        = 0;
      frightenedTimer  = 0;
      ghostsEatenChain = 0;
    }
    
    // ================================================================
    //  DRAWING — TRUCK  (Batch 2, preserved)
    // ================================================================
    function drawTruck(cx, cy, dir, mouthT) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(DIR_ROT[dir]);
      const hL=8, hW=5.5, sep=1;
    
      // Outer glow
      glow(C.truckGlow, 8);
      ctx.strokeStyle='rgba(255,136,0,0.45)'; ctx.lineWidth=1.5;
      ctx.strokeRect(-hL,-hW,hL*2,hW*2);
      noGlow();
    
      // Cargo box
      ctx.fillStyle='#7A2800'; ctx.fillRect(-hL,-hW,hL+sep,hW*2);
      ctx.fillStyle='#CC5500';
      ctx.fillRect(-hL+0.5,-hW+0.5,hL+sep-1,2);
      ctx.fillRect(-hL+0.5,hW-2.5,hL+sep-1,2);
      ctx.fillStyle='#4A1800';
      ctx.fillRect(-hL+3.5,-hW+1,1,hW*2-2);
      ctx.fillRect(-hL+6.5,-hW+1,1,hW*2-2);
      ctx.fillStyle='#FF7700'; ctx.fillRect(-hL+1,-1,hL+sep-2,2);
      ctx.fillStyle='#5A1800'; ctx.fillRect(-hL+1.5,-0.3,hL+sep-3,0.6);
    
      // Cab
      const cabHW=hW-1;
      ctx.fillStyle='#996600'; ctx.fillRect(sep,-cabHW,hL-sep,cabHW*2);
      ctx.fillStyle='#FFBB22';
      ctx.fillRect(sep,-cabHW,hL-sep-1,1.5);
      ctx.fillRect(sep,cabHW-1.5,hL-sep-1,1.5);
      ctx.fillStyle='#336699'; ctx.fillRect(sep+1,-cabHW+1.5,hL-sep-3,cabHW*2-3);
      ctx.fillStyle='rgba(160,210,255,0.30)'; ctx.fillRect(sep+1.5,-cabHW+2,1.5,cabHW-2);
    
      // Cargo/cab divider
      ctx.strokeStyle='#3A1000'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(sep,-hW+0.5); ctx.lineTo(sep,hW-0.5); ctx.stroke();
    
      // Front grille / mouth
      const grillX=hL-1, frontX=hL;
      const mouthHY=mouthT*cabHW*0.58, mouthDX=mouthT*3.6;
      ctx.fillStyle='#333'; ctx.fillRect(grillX,-cabHW,1.5,cabHW*2);
      ctx.fillStyle='#222';
      ctx.fillRect(grillX-1,-cabHW,2,1.5);
      ctx.fillRect(grillX-1,cabHW-1.5,2,1.5);
      glow('#FFEE88',7); ctx.fillStyle='#FFFF99';
      ctx.beginPath(); ctx.arc(grillX,-cabHW+0.75,1.0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(grillX, cabHW-0.75,1.0,0,Math.PI*2); ctx.fill();
      noGlow();
      if (mouthHY > 0.15) {
        ctx.fillStyle=C.bg;
        ctx.beginPath();
        ctx.moveTo(frontX,-mouthHY); ctx.lineTo(frontX-mouthDX,0); ctx.lineTo(frontX,mouthHY);
        ctx.closePath(); ctx.fill();
        if (mouthHY > 0.5) {
          glow('#FF4400',9*mouthT);
          ctx.fillStyle=`rgba(255,88,0,${0.9*mouthT})`;
          ctx.beginPath();
          ctx.moveTo(frontX-0.5,-mouthHY*0.52);
          ctx.lineTo(frontX-mouthDX+1.2,0);
          ctx.lineTo(frontX-0.5,mouthHY*0.52);
          ctx.closePath(); ctx.fill(); noGlow();
        }
      }
      ctx.restore();
    }
    
    // ── Perf: truck icon offscreen cache ─────────────────────────────────
    // The HUD draws up to 3 truck icons per frame (lives). Each icon is
    // 8+ fillRect/arc calls. Lives only change on death or extra life.
    // Pre-render the full lives strip to a tiny offscreen canvas and blit
    // it in one drawImage call instead. Rebuilt only when lives changes.
    let _livesCanvas = null, _livesCtx = null, _livesCached = -1;
    const ICON_W = 16, ICON_H = 12;   // px per icon slot

    function _rebuildLivesCache() {
      const maxLives = 5;
      if (!_livesCanvas) {
        try {
          _livesCanvas = new OffscreenCanvas(ICON_W * maxLives, ICON_H);
        } catch(e) {
          _livesCanvas = document.createElement('canvas');
          _livesCanvas.width  = ICON_W * maxLives;
          _livesCanvas.height = ICON_H;
        }
        _livesCtx = _livesCanvas.getContext('2d');
      }
      _livesCtx.clearRect(0, 0, ICON_W * maxLives, ICON_H);
      for (let i = 0; i < lives; i++) {
        const cx = i * ICON_W + 5, cy = ICON_H / 2;
        _livesCtx.save(); _livesCtx.translate(cx, cy);
        _livesCtx.fillStyle='#7A2800'; _livesCtx.fillRect(-5,-3.5,6.5,7);
        _livesCtx.fillStyle='#CC5500'; _livesCtx.fillRect(-4.5,-3,5,1.5);
        _livesCtx.fillStyle='#996600'; _livesCtx.fillRect(1.5,-2.5,4,5.5);
        _livesCtx.fillStyle='#336699'; _livesCtx.fillRect(2,-2,2.5,3.5);
        _livesCtx.fillStyle='#FFEE88';
        _livesCtx.beginPath(); _livesCtx.arc(5,-1.5,0.7,0,Math.PI*2); _livesCtx.fill();
        _livesCtx.beginPath(); _livesCtx.arc(5, 1.5,0.7,0,Math.PI*2); _livesCtx.fill();
        _livesCtx.restore();
      }
      _livesCached = lives;
    }

    function drawTruckIcon(cx, cy) {
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle='#7A2800'; ctx.fillRect(-5,-3.5,6.5,7);
      ctx.fillStyle='#CC5500'; ctx.fillRect(-4.5,-3,5,1.5);
      ctx.fillStyle='#996600'; ctx.fillRect(1.5,-2.5,4,5.5);
      ctx.fillStyle='#336699'; ctx.fillRect(2,-2,2.5,3.5);
      ctx.fillStyle='#FFEE88';
      ctx.beginPath(); ctx.arc(5,-1.5,0.7,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, 1.5,0.7,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    
    // ================================================================
    //  DRAWING — GHOSTS  (Batch 3)
    // ================================================================
    
    // Two directional eyes for a ghost body centered at (cx, cy)
    function drawGhostEyes(cx, cy, dir, pupilColor) {
      // Eye positions: offset left/right from centre
      const eyes = [{ex:-2.2,ey:-0.8},{ex:2.2,ey:-0.8}];
      const pdMap = {
        [DIR.RIGHT]:{px:0.8,py:0},
        [DIR.LEFT]: {px:-0.8,py:0},
        [DIR.UP]:   {px:0,py:-0.8},
        [DIR.DOWN]: {px:0,py:0.8},
      };
      const pd = pdMap[dir] || {px:0,py:0};
      for (const {ex,ey} of eyes) {
        // White sclera
        ctx.fillStyle='#FFFFFF';
        ctx.beginPath(); ctx.arc(cx+ex, cy+ey, 2.0, 0, Math.PI*2); ctx.fill();
        // Coloured pupil (direction-facing)
        ctx.fillStyle = pupilColor;
        ctx.beginPath(); ctx.arc(cx+ex+pd.px, cy+ey+pd.py, 1.0, 0, Math.PI*2); ctx.fill();
      }
    }
    
    function drawGhost(g) {
      // Perf: use cached pixel position from updateGhosts()
      const px = g._px, py = g._py;
      const R = 6.5;
      const cc = getCB();
    
      ctx.save();
    
      // ── EATEN: only draw eye-pair, no body ──
      if (g.state === GHOST_ST.EATEN) {
        drawGhostEyes(px, py, g.dir, '#4499FF');
        ctx.restore(); return;
      }
    
      // ── Determine body colour (normal vs frightened vs flashing) ──
      const flashing  = g.state === GHOST_ST.FRIGHTENED &&
                        frightenedTimer < FRIGHT_FLASH &&
                        _flashPhase === 0;   // Perf: pre-computed in gameLoop
      // B9: use CB-safe fright/flash colors from getCB()
      const bodyColor = g.state === GHOST_ST.FRIGHTENED
        ? (flashing ? cc.gFlash : cc.gFright)
        : (cc[g.colorKey] || g.color);  // colorKey maps ghost → palette entry
      const glowColor = g.state === GHOST_ST.FRIGHTENED
        ? 'rgba(30,30,200,0.55)'
        : (cc[g.colorKey] || g.color);
    
      // ── Glow ring — B6: normal ghosts get redder glow at higher levels ──
      // Perf: _ghostGlowStr/_ghostGlowR are pre-computed by _updateGhostGlowCache()
      // on level change — no per-frame rampT math or template-literal allocation.
      if (g.state === GHOST_ST.FRIGHTENED) {
        glow(glowColor, 11);
      } else {
        glow(_ghostGlowStr, _ghostGlowR);
      }
      ctx.fillStyle = bodyColor;
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
      noGlow();
    
      // ── Slightly darker ring outline for definition ──
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 0.8;
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke();
    
      // ── Wavy bottom skirt (3 small arcs on underside) ──
      if (g.state !== GHOST_ST.FRIGHTENED) {
        ctx.fillStyle = bodyColor;
        const skirtY = py + R - 1;
        const wave   = Math.sin(frame * 0.18 + g.tileCol) * 0.8; // subtle wobble
        for (let i = 0; i < 3; i++) {
          const sx = px - R + 1.5 + i * (R * 2 - 3) / 2;
          ctx.beginPath();
          ctx.arc(sx, skirtY + wave, 2.2, 0, Math.PI);
          ctx.fill();
        }
      }
    
      // ── Face ──
      if (g.state === GHOST_ST.FRIGHTENED) {
        // Scared eyes
        const esc = flashing ? '#0022FF' : '#FFFFFF';
        ctx.fillStyle = esc;
        ctx.beginPath(); ctx.arc(px-2.2,py-0.5,1.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(px+2.2,py-0.5,1.6,0,Math.PI*2); ctx.fill();
        // Wavy frown
        ctx.strokeStyle = esc; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px-3.0, py+2.2);
        ctx.lineTo(px-1.5, py+1.0);
        ctx.lineTo(px,     py+2.5);
        ctx.lineTo(px+1.5, py+1.0);
        ctx.lineTo(px+3.0, py+2.2);
        ctx.stroke();
        // Perf: SCARED INSPECTOR text removed from per-ghost drawGhost path.
        // Frightened ghosts are now batch-rendered in drawGhosts() without text labels.
      } else {
        // Normal: directional eyes
        drawGhostEyes(px, py - 0.5, g.dir, '#000088');
        // Ghost emoji label underneath body
        ctx.font        = '7px sans-serif';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'top';
        ctx.fillText(g.emoji, px, py + R + 0.5);
      }
    
      ctx.restore();
    }
    
    function drawGhosts() {
      // ── Perf: batch frightened ghosts — they're all identical color/glow ──
      // During FRIGHTENED all 4 share the same body color and glow string.
      // Draw them in one batched pass (1 shadowBlur write) instead of 4 separate calls.
      const cc = getCB();
      const frightenedActive = ghosts.some(g => g.state === GHOST_ST.FRIGHTENED);
      if (frightenedActive) {
        // Perf: _flashPhase computed once per frame in gameLoop
        const flashing = frightenedTimer < FRIGHT_FLASH && _flashPhase === 0;
        const fColor   = flashing ? cc.gFlash : cc.gFright;
        const R        = 6.5;

        // Batch all frightened ghost bodies in one path
        ctx.save();
        glow('rgba(30,30,200,0.55)', 11);
        ctx.fillStyle = fColor;
        ctx.beginPath();
        for (const g of ghosts) {
          if (g.state !== GHOST_ST.FRIGHTENED) continue;
          // Perf: use cached pixel position from updateGhosts()
          const px = g._px, py = g._py;
          ctx.moveTo(px + R, py);
          ctx.arc(px, py, R, 0, Math.PI * 2);
        }
        ctx.fill();
        noGlow();

        // Scared face on each (geometry only — no expensive text labels)
        const esc = flashing ? '#0022FF' : '#FFFFFF';
        ctx.strokeStyle = esc; ctx.lineWidth = 1.2;
        ctx.fillStyle   = esc;
        for (const g of ghosts) {
          if (g.state !== GHOST_ST.FRIGHTENED) continue;
          const px = g._px, py = g._py;
          // Outline stroke
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.stroke();
          // Eyes
          ctx.fillStyle = esc;
          ctx.beginPath();
          ctx.arc(px-2.2, py-0.5, 1.6, 0, Math.PI * 2);
          ctx.arc(px+2.2, py-0.5, 1.6, 0, Math.PI * 2);
          ctx.fill();
          // Frown
          ctx.strokeStyle = esc; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px-3.0, py+2.2);
          ctx.lineTo(px-1.5, py+1.0);
          ctx.lineTo(px,     py+2.5);
          ctx.lineTo(px+1.5, py+1.0);
          ctx.lineTo(px+3.0, py+2.2);
          ctx.stroke();
        }
        ctx.restore();

        // Draw non-frightened ghosts individually (eaten eyes only, normal bodies)
        for (const g of ghosts) {
          if (g.state !== GHOST_ST.FRIGHTENED) drawGhost(g);
        }
      } else {
        // Normal: draw all ghosts individually
        for (const g of ghosts) drawGhost(g);
      }
    }

    // B10: draw ghost intro name badges
    function drawGhostIntros() {
      for (const b of ghostIntros) {
        const alpha = Math.min(1, b.timer / 20) * (b.timer / b.maxTimer);
        ctx.save();
        ctx.globalAlpha = alpha;
        // P4: taller box — name row + tagline row
        const bw = 68, bh = 22, bx = b.px - bw / 2, by = b.py - 30;
        // Dark background
        ctx.fillStyle = 'rgba(0,0,10,0.88)';
        ctx.fillRect(bx, by, bw, bh);
        // Border in ghost's own colour
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        // Name row
        ctx.font      = '5px "Press Start 2P", monospace';
        ctx.fillStyle = b.color;
        ctx.fillText(b.name, b.px, by + bh * 0.32);
        // Tagline row
        ctx.font      = '6px "Press Start 2P", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.fillText(b.tag, b.px, by + bh * 0.72);
        ctx.restore();
      }
    }
    
    // ── P5: ACHIEVEMENT TOAST SYSTEM ─────────────────────────────────
    function updateAchieveToasts() {
      for (let i = achieveToasts.length - 1; i >= 0; i--) {
        achieveToasts[i].timer--;
        if (achieveToasts[i].timer <= 0) achieveToasts.splice(i, 1);
      }
      // Tick hi-score celebration timer
      if (hiScoreCelebTimer > 0) hiScoreCelebTimer--;
    }

    // Slide-in toast — stacks vertically from top-centre of maze area
    function drawAchieveToasts() {
      if (achieveToasts.length === 0) return;
      achieveToasts.forEach((t, idx) => {
        const progress = t.timer / t.maxTimer;              // 1→0
        // Slide in from top for first 10 frames, hold, slide out last 10
        const slideIn  = Math.min(1, (t.maxTimer - t.timer) / 10);
        const slideOut = Math.min(1, t.timer / 10);
        const alpha    = Math.min(slideIn, slideOut);
        const yOffset  = (1 - Math.min(slideIn, 1)) * -20; // slides down from above

        const tw = 200, th = 18;
        const tx = (CW - tw) / 2;
        const ty = HUD_H + 10 + idx * 22 + yOffset;

        ctx.save();
        ctx.globalAlpha = alpha;
        // Background pill
        ctx.fillStyle = 'rgba(0,0,8,0.90)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tx, ty, tw, th, 4) : ctx.fillRect(tx, ty, tw, th);
        ctx.fill();
        // Gold border
        glow('#FFD700', 8 * alpha);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tx + 0.5, ty + 0.5, tw - 1, th - 1, 4)
                      : ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
        ctx.stroke();
        noGlow();
        // Trophy icon + text
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = '8px sans-serif';
        ctx.fillText('🏆', tx + 13, ty + th / 2 + 1);
        ctx.font      = '5px "Press Start 2P", monospace';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(t.text, tx + tw / 2 + 4, ty + th / 2);
        ctx.restore();
      });
    }

    // ── P5: HI-SCORE CELEBRATION BANNER ──────────────────────────────
    // Full-width flash banner at the HUD/maze boundary when player first
    // beats the all-time hi-score.  Fades out over HI_SCORE_CELEB_DUR frames.
    function drawHiScoreCelebration() {
      if (hiScoreCelebTimer <= 0) return;
      const t = hiScoreCelebTimer / HI_SCORE_CELEB_DUR;  // 1→0
      // Pulsing gold bar across full width
      const barH  = 14;
      const barY  = HUD_H - barH / 2;
      const pulse = 0.6 + 0.4 * Math.sin(frame * 0.25);
      ctx.save();
      ctx.globalAlpha = t * pulse;
      glow('#FFD700', 20 * pulse * t);
      ctx.fillStyle = `rgba(255,215,0,${0.25 * pulse})`;
      ctx.fillRect(0, barY, CW, barH);
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.font         = '7px "Press Start 2P", monospace';
      ctx.fillStyle    = '#FFFFFF';
      ctx.fillText('✦ NEW RECORD ✦', CW / 2, barY + barH / 2);
      noGlow();
      ctx.restore();
    }

    // ── SCORE DISPLAY FORMATTER ───────────────────────────────────────
    // "Press Start 2P" at 8px fits ~7 chars in the HUD side columns.
    // Abbreviate large numbers so they never overflow: 99900 → "99.9K"
    function formatScore(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 10000)   return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      return n.toString();
    }

    // ── Ph4: MULTIPLIER-AWARE SCORE AWARD ─────────────────────────────
    // All gameplay score events route through awardScore() so the Night Shift
    // multiplier is applied in one place. nightShiftMultiplier starts at 1.0
    // (no change in loops 1–12) and grows +0.1 each level cleared after 12.
    // Returns the final points actually added, so float texts can show the real value.
    function awardScore(pts) {
      const actual = nightShiftActive
        ? Math.round(pts * nightShiftMultiplier)
        : pts;
      score += actual;
      _scoreStr = formatScore(score);        // memo: update cached string
      if (score > hiScore) {
        hiScore = score;
        _hiScoreStr = formatScore(hiScore);  // memo: update cached hi string
        try { localStorage.setItem('fr_hi', hiScore); } catch(e) {}
        checkHiScore();
      }
      checkExtraLife();
      return actual;
    }

    // ── Perf: hoisted outside drawHUD so it's allocated once, not 60×/sec ─
    function drawHUDBtn(btn, label, isQuit) {
      ctx.save();
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(btn.x + r, btn.y);
      ctx.lineTo(btn.x + btn.w - r, btn.y);
      ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + r);
      ctx.lineTo(btn.x + btn.w, btn.y + btn.h - r);
      ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - r, btn.y + btn.h);
      ctx.lineTo(btn.x + r, btn.y + btn.h);
      ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - r);
      ctx.lineTo(btn.x, btn.y + r);
      ctx.quadraticCurveTo(btn.x, btn.y, btn.x + r, btn.y);
      ctx.closePath();
      ctx.fillStyle = isQuit ? 'rgba(255,60,60,0.10)' : 'rgba(255,215,0,0.08)';
      ctx.fill();
      ctx.strokeStyle = isQuit ? 'rgba(255,80,80,0.40)' : 'rgba(255,215,0,0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isQuit ? 'rgba(255,110,110,0.90)' : 'rgba(255,215,0,0.90)';
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      ctx.restore();
    }

    function drawHUD() {
      // ── Background fill ────────────────────────────────────────────
      ctx.fillStyle = C.hud;
      ctx.fillRect(0, 0, CW, HUD_H);

      // ── ROW 1 (y 0–22): SCORE left · FREIGHT RUNNER center · HI-SCORE right ──
      ctx.font='6px "Press Start 2P", monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillStyle=C.textDim; ctx.fillText('SCORE', 10, 2);
      ctx.fillStyle=C.textGold; ctx.font='8px "Press Start 2P", monospace';
      ctx.fillText(_scoreStr, 10, 11);

      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='8px "Press Start 2P", monospace';
      glow(C.textGold, 10); ctx.fillStyle=C.textGold;
      ctx.fillText('FREIGHT RUNNER', CW/2, 11); noGlow();

      ctx.font='6px "Press Start 2P", monospace'; ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillStyle=C.textDim; ctx.fillText('HI-SCORE', CW-10, 2);
      ctx.fillStyle=C.textGold; ctx.font='8px "Press Start 2P", monospace';
      ctx.fillText(_hiScoreStr, CW-10, 11);

      // ── Row 1 HUD buttons: ⏸ PAUSE (left gap) · ✕ QUIT (right gap) ──
      drawHUDBtn(HUD_BTN_PAUSE, '\u23F8 PAUSE', false);
      drawHUDBtn(HUD_BTN_QUIT,  '\u2715 QUIT',  true);

      // B6: "NEW!" badge
      if (score > 0 && score >= hiScore && (gameState === GS.PLAYING || gameState === GS.DYING)) {
        if (frame % 40 < 26) {
          ctx.save();
          glow('#FFFF00', 8);
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillStyle = '#FFFF44';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('NEW!', CW/2, 2);
          noGlow();
          ctx.restore();
        }
      }

      // ── Row 1 / Row 2 divider ──────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,215,0,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(CW, 22); ctx.stroke();

      // ── ROW 2 (y 22–44): LIVES left · LVL name center · LEVEL pips right ──
      const R2_LBL = 24;
      const R2_PIP = 37;

      ctx.font='5px "Press Start 2P", monospace'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillStyle=C.textDim; ctx.fillText('LIVES', 8, R2_LBL);
      // Perf: blit pre-rendered lives strip instead of 3×8 fillRect/arc calls per frame
      if (_livesCached !== lives) _rebuildLivesCache();
      if (_livesCanvas && lives > 0) ctx.drawImage(_livesCanvas, 6, R2_PIP - 6);

      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle=C.textDim;
      // Ph4: Night Shift — show multiplier badge instead of level name
      // Perf: _levelNameStr/_nightShiftStr are cached strings, updated on level change
      if (nightShiftActive) {
        const mp = 0.7 + 0.3 * Math.sin(frame * 0.10);
        glow(`rgba(255,80,80,${mp})`, 8 * mp);
        ctx.fillStyle = `rgba(255,${Math.floor(100 * mp)},${Math.floor(100 * mp)},1)`;
        ctx.fillText(_nightShiftStr, CW/2, 33);
        noGlow();
      } else {
        ctx.fillText(_levelNameStr, CW/2, 33);
      }

      ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillStyle=C.textDim; ctx.fillText('LEVEL', CW-8, R2_LBL);

      if (level <= 8) {
        // Levels 1–8: individual truck pips
        for (let i = 0; i < level; i++) {
          ctx.save();
          ctx.globalAlpha = 0.75;
          drawTruckIcon(CW - 10 - (level - i - 1) * 14, R2_PIP);
          ctx.restore();
        }
      } else {
        // Level 9+: one truck icon + ×N count — clear at any level
        ctx.save();
        ctx.globalAlpha = 0.75;
        drawTruckIcon(CW - 38, R2_PIP);
        ctx.restore();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = C.textGold;
        ctx.fillText('×' + level, CW - 10, R2_PIP);
      }

      // ── Bottom separator (level theme colour) ─────────────────────
      // Perf: call getLevelTheme once and reuse — it was being called twice here
      const th = getLevelTheme();
      glow(th.glow, 8); ctx.strokeStyle=th.border; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(0, HUD_H-1); ctx.lineTo(CW, HUD_H-1); ctx.stroke(); noGlow();

      // ── B10: Pellet progress bar — 3px strip at very bottom of HUD
      const prog = TOTAL_PELLETS > 0 ? pelletsEaten / TOTAL_PELLETS : 0;
      const pbY = HUD_H - 3;
      ctx.fillStyle = 'rgba(255,215,0,0.10)';
      ctx.fillRect(0, pbY, CW, 3);
      glow(th.glow, 4);
      ctx.fillStyle = th.border;
      ctx.fillRect(0, pbY, Math.round(CW * prog), 3);
      noGlow();
    }

    // ── Ph2: BOSS HUD ─────────────────────────────────────────────────
    // Replaces the normal HUD during GS.BOSS.
    // Shows: SCORE left · ⚠ LEGEND HAUL center · HI-SCORE right (row 1)
    //        LIVES left · survive countdown bar center · "BOSS" badge right (row 2)
    function drawBossHUD() {
      // Background — deep red tint to signal danger
      ctx.fillStyle = '#120008';
      ctx.fillRect(0, 0, CW, HUD_H);
      // Red glow border at bottom
      glow('#FF0000', 12);
      ctx.strokeStyle = '#CC0000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, HUD_H - 1); ctx.lineTo(CW, HUD_H - 1); ctx.stroke();
      noGlow();

      // Row 1 — score / title / hi-score  (same layout as normal HUD)
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = C.textDim; ctx.fillText('SCORE', 10, 2);
      ctx.fillStyle = C.textGold; ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(_scoreStr, 10, 11);

      // Pulsing boss title
      const titlePulse = 0.75 + 0.25 * Math.sin(frame * 0.12);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '8px "Press Start 2P", monospace';
      glow(`rgba(255,0,0,${titlePulse})`, 12 * titlePulse);
      ctx.fillStyle = `rgb(255,${Math.floor(60 * titlePulse)},${Math.floor(60 * titlePulse)})`;
      ctx.fillText('⚠ LEGEND HAUL ⚠', CW / 2, 11);
      noGlow();

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillStyle = C.textDim; ctx.fillText('HI-SCORE', CW - 10, 2);
      ctx.fillStyle = C.textGold; ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(formatScore(hiScore), CW - 10, 11);

      // Row 1/2 divider
      ctx.strokeStyle = 'rgba(200,0,0,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(CW, 22); ctx.stroke();

      // Row 2 left — lives (Perf: use pre-rendered cache strip)
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = C.textDim; ctx.fillText('LIVES', 8, 24);
      if (_livesCached !== lives) _rebuildLivesCache();
      if (_livesCanvas && lives > 0) ctx.drawImage(_livesCanvas, 6, 37 - 6);

      // Row 2 center — survival countdown bar
      const survived  = Math.min(bossTimer, BOSS_SURVIVE_FRAMES);
      const barProg   = survived / BOSS_SURVIVE_FRAMES;          // 0 → 1
      const secsLeft  = Math.ceil((BOSS_SURVIVE_FRAMES - survived) / 60);
      const barW = 180, barH = 8;
      const barX = (CW - barW) / 2;
      const barY = 28;
      // Bar background
      ctx.fillStyle = 'rgba(80,0,0,0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      // Bar fill — transitions red → amber → green as progress builds
      const r = Math.floor(255 * (1 - barProg));
      const g2 = Math.floor(220 * barProg);
      const barColor = `rgb(${r},${g2},0)`;
      glow(barColor, 6);
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, Math.round(barW * barProg), barH);
      noGlow();
      // Countdown text below bar
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = barProg > 0.8 ? '#88FF88' : barProg > 0.5 ? '#FFDD44' : '#FF6666';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(
        truck.moving ? `${secsLeft}s REMAINING` : 'PRESS ANY KEY',
        CW / 2, barY + barH + 2
      );

      // Row 2 right — BOSS badge
      const badgePulse = 0.6 + 0.4 * Math.sin(frame * 0.16);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.font = '9px "Press Start 2P", monospace';
      glow(`rgba(255,80,80,${badgePulse})`, 10 * badgePulse);
      ctx.fillStyle = `rgba(255,${Math.floor(80 * badgePulse)},${Math.floor(80 * badgePulse)},1)`;
      ctx.fillText('BOSS', CW - 8, 33);
      noGlow();
    }
    // Renders walls, silhouettes, road tiles, ghost house, tunnel
    // entrances and depot zones into staticCanvas once per level.
    // Call whenever the level theme changes or maze resets.
    function buildStaticMaze() {
      ensureStaticCanvas();
      const sc = staticCtx;
      const th = getLevelTheme();
      sc.clearRect(0, 0, CW, MAZE_H);

      // Road / house tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = MAZE_TEMPLATE[r][c];
          if (t !== T_WALL) {
            sc.fillStyle = (t === T_HOUSE) ? C.house : C.road;
            sc.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }

      // Wall fills + building silhouettes
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (MAZE_TEMPLATE[r][c] !== T_WALL) continue;
          const x = c * TILE, y = r * TILE, b = BLDG[r][c];
          sc.fillStyle = C.wallFill; sc.fillRect(x, y, TILE, TILE);
          const bw1 = Math.min(b.bw1, TILE - b.bx1 - 1);
          if (bw1 > 0) { sc.fillStyle = 'rgba(18,35,80,0.38)'; sc.fillRect(x + b.bx1, y + TILE - b.bh1, bw1, b.bh1); }
          const bw2 = Math.min(b.bw2, TILE - b.bx2 - 1);
          if (bw2 > 0 && b.bx2 + b.bw2 < TILE) { sc.fillStyle = 'rgba(18,35,80,0.30)'; sc.fillRect(x + b.bx2, y + TILE - b.bh2, bw2, b.bh2); }
          sc.fillStyle = 'rgba(160,210,255,0.06)'; sc.fillRect(x + b.wx, y + b.wy, 2, 2);
        }
      }

      // Neon wall edges (the expensive shadowBlur pass — done once here)
      sc.save();
      sc.strokeStyle = th.border; sc.lineWidth = 2.0; sc.lineCap = 'square';
      sc.shadowColor = th.glow;   sc.shadowBlur  = 9;
      sc.beginPath();
      for (let r = 1; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if ((MAZE_TEMPLATE[r-1][c] === T_WALL) !== (MAZE_TEMPLATE[r][c] === T_WALL)) {
            sc.moveTo(c * TILE, r * TILE); sc.lineTo(c * TILE + TILE, r * TILE);
          }
        }
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 1; c < COLS; c++) {
          if ((MAZE_TEMPLATE[r][c-1] === T_WALL) !== (MAZE_TEMPLATE[r][c] === T_WALL)) {
            sc.moveTo(c * TILE, r * TILE); sc.lineTo(c * TILE, r * TILE + TILE);
          }
        }
      }
      sc.stroke();
      sc.shadowColor = 'transparent'; sc.shadowBlur = 0;
      sc.restore();

      // Ghost house interior
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (MAZE_TEMPLATE[r][c] === T_HOUSE) { sc.fillStyle = C.houseAccent; sc.fillRect(c * TILE, r * TILE, TILE, TILE); }
        }
      }
      sc.save();
      sc.shadowColor = '#0066FF'; sc.shadowBlur = 6;
      sc.strokeStyle = '#224488'; sc.lineWidth = 1;
      sc.strokeRect(10*TILE+0.5, 12*TILE+0.5, 8*TILE-1, 5*TILE-1);
      sc.shadowColor = 'transparent'; sc.shadowBlur = 0;
      sc.restore();

      // DISPATCH OFFICE label
      const sx = 11*TILE+1, sy = 13*TILE+2, sw = 6*TILE-2, sh = 3*TILE-4;
      sc.fillStyle = 'rgba(0,8,30,0.75)'; sc.fillRect(sx, sy, sw, sh);
      sc.strokeStyle = '#1a3a7a'; sc.lineWidth = 1; sc.strokeRect(sx+0.5, sy+0.5, sw-1, sh-1);
      const mx = sx + sw/2;
      sc.save();
      sc.shadowColor = '#0077DD'; sc.shadowBlur = 8;
      sc.fillStyle = C.textBlue; sc.textAlign = 'center'; sc.textBaseline = 'middle';
      sc.font = '7px "Press Start 2P", monospace'; sc.fillText('DISPATCH', mx, sy + sh*0.35);
      sc.fillStyle = '#2255AA'; sc.font = '5px "Press Start 2P", monospace';
      sc.fillText('OFFICE', mx, sy + sh*0.68);
      sc.shadowColor = 'transparent'; sc.shadowBlur = 0;
      sc.restore();

      // Tunnel entrances
      sc.save(); sc.globalAlpha = 0.4; sc.fillStyle = '#334466';
      sc.font = '9px "Press Start 2P", monospace';
      sc.textAlign = 'center'; sc.textBaseline = 'middle';
      const y13 = 13*TILE+TILE/2, y14 = 14*TILE+TILE/2;
      sc.fillText('«', 2*TILE+TILE/2, y13); sc.fillText('«', 2*TILE+TILE/2, y14);
      sc.fillText('»', 25*TILE+TILE/2, y13); sc.fillText('»', 25*TILE+TILE/2, y14);
      sc.restore();


      staticDirty = false;
    }

    function drawMaze() {
      ctx.fillStyle = C.bg; ctx.fillRect(0, HUD_H, CW, MAZE_H);

      // ── Flash override during LEVEL_COMPLETE ─────────────────────
      const flashCol = getLevelFlashColor();
      if (flashCol) {
        // Perf: use pre-computed WALL_TILES instead of scanning all 868 tiles
        ctx.fillStyle = C.bg; ctx.fillRect(0, HUD_H, CW, MAZE_H);
        ctx.fillStyle = flashCol;
        for (const wt of WALL_TILES) ctx.fillRect(wt.x, HUD_H + wt.y, TILE, TILE);
        drawPellets(); return;
      }

      // ── Rebuild static cache if dirty (level change / theme change) ─
      if (staticDirty) buildStaticMaze();

      // ── Blit static maze (single drawImage — no per-tile loops) ───
      ctx.drawImage(staticCanvas, 0, HUD_H, CW, MAZE_H);

      // ── Ghost house door (dynamic: flashes when eaten ghost enters) ─
      // Perf: DOOR_TILES is pre-computed — no 868-tile scan every frame.
      for (const dt of DOOR_TILES) {
        const {r, c, x, y} = dt;
        const absY = HUD_H + y;
        if (maze[r][c] !== T_DOOR && MAZE_TEMPLATE[r][c] !== T_DOOR) continue;
        ctx.fillStyle = 'rgba(255,150,190,0.18)'; ctx.fillRect(x, absY, TILE, TILE);
        const doorPulse = doorFlashTimer > 0 ? 0.5 + 0.5 * (doorFlashTimer / DOOR_FLASH_DUR) : 0;
        const doorGlowR = doorFlashTimer > 0 ? 12 + 18 * doorPulse : 8;
        glow(C.doorGlow, doorGlowR);
        ctx.fillStyle = doorFlashTimer > 0
          ? `rgba(255,${Math.floor(180 + 75*doorPulse)},${Math.floor(220 + 35*doorPulse)},1)`
          : C.door;
        ctx.fillRect(x, absY + Math.round(TILE*0.39), TILE, Math.round(TILE*0.22));
        noGlow();
      }

      // ── Frightened blue aura ──────────────────────────────────────
      if (frightenedTimer > 0) {
        const auraA = Math.min(0.13, 0.13 * (frightenedTimer / 60));
        ctx.save(); ctx.globalAlpha = auraA;
        ctx.fillStyle = '#2244CC'; ctx.fillRect(0, HUD_H, CW, MAZE_H);
        ctx.restore();
      }

      // ── Contract expiry warning border ────────────────────────────
      if (contractItem && contractItem.timer / CONTRACT_DUR < 0.25) {
        const wt = contractItem.timer / (CONTRACT_DUR * 0.25);
        const pulse = 0.5 + 0.5 * Math.sin(frame * 0.35);
        const alpha = (0.35 + 0.45 * pulse) * (1 - wt * 0.3);
        ctx.save();
        ctx.strokeStyle = `rgba(255,160,0,${alpha})`; ctx.lineWidth = 4;
        glow('#FF9900', 18 * pulse);
        ctx.strokeRect(2, HUD_H + 2, CW - 4, MAZE_H - 4);
        noGlow(); ctx.restore();
      }

      drawPellets();
      drawTunnelTelegraph();   // P3: pulsing exit arrows when anyone is in the tunnel
    }
    
    // ── BONUS ITEM (contract / surcharge / manifest / warp) ──────────────
    function drawContractItem() {
      if (!contractItem) return;
      const cx  = CONTRACT_COL * TILE + TILE / 2;
      const cy  = HUD_H + CONTRACT_ROW * TILE + TILE / 2;
      const t   = contractItem.timer / CONTRACT_DUR;   // 1→0 as it expires
      // P6: use type-specific colours
      const bdef = BONUS_ITEMS[contractItem.type] || BONUS_ITEMS.contract;
      const pulseRate = t < 0.25 ? 0.28 : 0.10;
      const pulse  = 0.7 + 0.3 * Math.sin(frame * pulseRate * Math.PI * 2);
      const radius = 8 * pulse;
      const alpha  = Math.min(1, t * 4);

      // Ph5: warp fruit gets a special portal swirl instead of the standard body
      if (contractItem.type === 'warp') {
        ctx.save();
        ctx.globalAlpha = alpha;
        const wAngle = frame * 0.08;
        // Outer ring layers spinning in opposite directions
        for (let ring = 0; ring < 3; ring++) {
          const rr = 10 + ring * 4;
          const ra = 0.55 - ring * 0.12;
          glow('#FF00FF', 18 * pulse * (1 - ring * 0.25));
          ctx.strokeStyle = `rgba(${ring === 0 ? '255,0,255' : ring === 1 ? '180,0,255' : '100,0,255'},${ra * pulse})`;
          ctx.lineWidth = 2.5 - ring * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, wAngle + ring * Math.PI * 0.4, wAngle + ring * Math.PI * 0.4 + Math.PI * 1.4);
          ctx.stroke();
        }
        noGlow();
        // Center glyph
        ctx.fillStyle = `rgba(255,100,255,${pulse * alpha})`;
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('◈', cx, cy + 1);
        // Blinking label
        if (frame % 40 < 26) {
          ctx.fillStyle = '#FF88FF';
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillText('ONE-TIME ◈ WARP', cx, cy + 20);
        }
        // Timer bar
        const barW = TILE * 1.6, barX = cx - barW / 2, barY = cy + radius + 10;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX, barY, barW, 3);
        ctx.fillStyle = t > 0.25 ? '#FF00FF' : '#FF4444';
        ctx.fillRect(barX, barY, barW * t, 3);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outer glow ring
      // Perf: avoid .toString(16).padStart per frame — compute alpha as css directly
      const strokeAlpha = (0.5 * pulse).toFixed(2);
      glow(bdef.glowColor, 16 * pulse);
      ctx.strokeStyle = bdef.glowColor;
      ctx.globalAlpha = alpha * parseFloat(strokeAlpha);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = alpha;

      // Body
      ctx.fillStyle = bdef.bodyColor;
      ctx.globalAlpha = alpha * (0.9 * pulse);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();

      // Glyph — font size rounds to nearest integer to reduce unique string allocations
      noGlow();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#001810';
      const glyphSize = Math.round(radius * 1.3);
      ctx.font = `${glyphSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bdef.glyph, cx, cy + 1);

      // Timer bar
      const barW = TILE * 1.6;
      const barX = cx - barW / 2;
      const barY = cy + radius + 6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, 3);
      ctx.fillStyle = t > 0.25 ? bdef.glowColor : '#FF4444';
      ctx.fillRect(barX, barY, barW * t, 3);

      ctx.restore();
    }

    // Perf fix: instead of 240 individual arc+glow calls, blit the pre-built
    // dot cache in one drawImage call. dotsDirty rebuilds the cache whenever
    // a dot is eaten or the theme/level changes.
    function drawPellets() {
      if (dotsDirty) buildDotCache();
      ctx.drawImage(dotCanvas, 0, HUD_H, CW, MAZE_H);
    }
    
    // ── READY OVERLAY ─────────────────────────────────────────────────
    function drawReadyOverlay() {
      ctx.fillStyle='rgba(0,0,10,0.42)'; ctx.fillRect(0,HUD_H,CW,MAZE_H);
      const bw=228,bh=62,bx=(CW-bw)/2,by=HUD_H+MAZE_H/2-bh/2;
      ctx.fillStyle='rgba(4,4,22,0.90)'; ctx.fillRect(bx,by,bw,bh);
      glow(C.textGold,12); ctx.strokeStyle=C.textGold; ctx.lineWidth=1.5;
      ctx.strokeRect(bx+0.5,by+0.5,bw-1,bh-1); noGlow();
      ctx.textAlign='center'; ctx.textBaseline='middle';
      glow(C.textGold,8); ctx.fillStyle=C.textGold;
      ctx.font='10px "Press Start 2P", monospace';
      ctx.fillText('READY TO HAUL',CW/2,by+bh*0.36); noGlow();
      if (frame%50<30) {
        ctx.fillStyle='#FFFFFF'; ctx.font='6px "Press Start 2P", monospace';
        ctx.fillText('PRESS ANY KEY TO DRIVE',CW/2,by+bh*0.72);
      }
    }

    // B9: PAUSE OVERLAY
    function drawPauseOverlay() {
      ctx.fillStyle = 'rgba(0,0,10,0.60)';
      ctx.fillRect(0, HUD_H, CW, MAZE_H);
      const bw=240, bh=90, bx=(CW-bw)/2, by=HUD_H+MAZE_H/2-bh/2;
      ctx.fillStyle = 'rgba(2,4,22,0.96)';
      ctx.fillRect(bx, by, bw, bh);
      glow('#AACCFF', 14);
      ctx.strokeStyle = '#4477BB'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx+0.5, by+0.5, bw-1, bh-1);
      noGlow();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      glow('#AACCFF', 10);
      ctx.fillStyle = '#AADDFF';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText('PAUSED', CW/2, by + bh*0.28);
      noGlow();
      // Separator
      ctx.strokeStyle = 'rgba(100,140,220,0.3)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx+12, by+bh*0.52); ctx.lineTo(bx+bw-12, by+bh*0.52); ctx.stroke();
      if (frame % 50 < 30) {
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillText('P — RESUME', CW/2, by + bh*0.65);
        ctx.fillStyle = 'rgba(255,120,120,0.70)';
        ctx.fillText('Q — QUIT TO MENU', CW/2, by + bh*0.82);
      }
    }
    
    // ================================================================
    //  BATCH 4 — SCREEN DRAW FUNCTIONS
    // ================================================================
    
    // ── ATTRACT SCREEN ────────────────────────────────────────────────
    function drawAttractScreen() {
      // Background — dark with subtle grid
      ctx.fillStyle = '#030310';
      ctx.fillRect(0, 0, CW, CH);

      // B6: faint live maze rendered as atmosphere behind the title
      ctx.save();
      ctx.globalAlpha = 0.09;
      // Wall tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = MAZE_TEMPLATE[r][c];
          if (t === T_WALL) {
            ctx.fillStyle = C.wallBorder;
            ctx.fillRect(c * TILE, HUD_H + r * TILE, TILE, TILE);
          } else if (t === T_DOT) {
            ctx.fillStyle = C.dot;
            ctx.beginPath();
            ctx.arc(c*TILE+TILE/2, HUD_H+r*TILE+TILE/2, 1.5, 0, Math.PI*2);
            ctx.fill();
          } else if (t === T_POWER) {
            // Pulsing power pellet on attract
            const pa = 0.5 + 0.5 * Math.sin(frame * 0.08 + r + c);
            ctx.globalAlpha = 0.09 * pa;
            ctx.fillStyle = C.power;
            ctx.beginPath();
            ctx.arc(c*TILE+TILE/2, HUD_H+r*TILE+TILE/2, 4, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 0.09;
          }
        }
      }
      ctx.restore();
    
      // (B6: old grid replaced by faint maze background above)
    
      // ── FREIGHT RUNNER title (large, glowing, color-cycled) ──
      const titleY = HUD_H + 80;
      const hue    = (frame * 0.6) % 360;
      const titleColor = `hsl(${hue}, 100%, 55%)`;
      ctx.save();
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
    
      // Big shadow lettering for depth
      ctx.font = '22px "Press Start 2P", monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText('FREIGHT', CW/2 + 2, titleY + 2);
      ctx.fillText('RUNNER',  CW/2 + 2, titleY + 30);
    
      // Gold glow layer
      glow(C.textGold, 22);
      ctx.fillStyle = titleColor;
      ctx.fillText('FREIGHT', CW/2, titleY);
      ctx.fillText('RUNNER',  CW/2, titleY + 30);
      noGlow();
    
      // ── SUBTITLE ──
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#4488CC';
      glow('#0044AA', 8);
      ctx.fillText('HAUL EVERY LOAD  DODGE EVERY INSPECTOR', CW/2, titleY + 60);
      noGlow();
    
      // ── GHOST PARADE (4 ghosts marching right) ──
      const paradeSpeed = 1.2;
      for (const ag of attractGhosts) {
        ag.x += paradeSpeed;
        if (ag.x > CW + 20) ag.x = -20;
        drawAttractGhost(ag.x, ag.y, ag.color, ag.emoji);
      }
    
      // ── TRUCK demo (drives left across middle row) ──
      const truckX = CW - ((frame * 1.0) % (CW + 40));
      const truckDemoY = HUD_H + 220;
      drawTruck(truckX + 20, truckDemoY, DIR.LEFT,
        Math.abs(Math.sin(frame * 0.12)));
    
      // ── B10: LEADERBOARD ─────────────────────────────────────────────
      const lb   = loadLeaderboard();
      const lbY  = HUD_H + 258;
      const lbW  = 240, lbH = 12 + Math.max(lb.length, 1) * 16 + 8;
      const lbX  = (CW - lbW) / 2;

      // Box
      ctx.fillStyle = 'rgba(2,4,20,0.82)';
      ctx.fillRect(lbX, lbY, lbW, lbH);
      glow(C.textGold, 8);
      ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(lbX + 0.5, lbY + 0.5, lbW - 1, lbH - 1);
      noGlow();

      // Header
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.textGold;
      ctx.fillText('── TOP SCORES ──', CW/2, lbY + 8);

      if (lb.length === 0) {
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillText('NO SCORES YET', CW/2, lbY + 22);
      } else {
        const rankColors = ['#FFD700', '#CCCCCC', '#CD7F32', '#AAAAAA', '#888888'];
        lb.forEach((entry, idx) => {
          const ey = lbY + 20 + idx * 16;
          // Highlight if this is the most recent hi score
          if (idx === 0) {
            ctx.fillStyle = 'rgba(255,215,0,0.07)';
            ctx.fillRect(lbX + 2, ey - 5, lbW - 4, 14);
          }
          // Rank
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textAlign = 'left';
          ctx.fillStyle = rankColors[idx] || '#666666';
          ctx.fillText(`#${idx+1}`, lbX + 10, ey + 2);
          // Initials (P6) — shown between rank and score when available
          if (entry.initials) {
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(entry.initials, lbX + 30, ey + 2);
          }
          // Score
          ctx.fillStyle = idx === 0 ? C.textGold : 'rgba(255,215,0,0.65)';
          ctx.textAlign = 'center';
          ctx.fillText(formatScore(entry.score), CW/2, ey + 2);
          // Level badge
          ctx.textAlign = 'right';
          ctx.fillStyle = 'rgba(100,180,255,0.7)';
          ctx.fillText(`LV${entry.level}`, lbX + lbW - 10, ey + 2);
        });
      }

      // ── CHARACTER ROSTER ──
      const roster = [
        { emoji:'👮', name:'DOT',    desc:'ALWAYS ON YOU' },
        { emoji:'📞', name:'BROKER', desc:'4 AHEAD' },
        { emoji:'💼', name:'IRS',    desc:'UNPREDICTABLE' },
        { emoji:'🔑', name:'REPO',   desc:'LURKS CLOSE' },
      ];
      const rosterY   = lbY + lbH + 16;
      const rGap      = 116;
      const rStartX   = CW / 2 - (rGap * 1.5); // centers 4 items across canvas
      roster.forEach((r, i) => {
        const rx = rStartX + i * rGap;           // rx is the center of each item
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(r.emoji, rx, rosterY + 8);
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillStyle = C.textGold;
        ctx.fillText(r.name, rx, rosterY + 22);
        ctx.fillStyle = C.textDim;
        ctx.fillText(r.desc, rx, rosterY + 33);
      });

      // ── LEGEND HAUL BONUS TIP ─────────────────────────────────────
      // Pulsing animated tip that cycles between two messages, drawing
      // players toward the $2,500 real-cash bonus at level 25.
      {
        const tipCycle  = Math.floor(frame / 210) % 2;   // swap every 3.5 s
        const tipFade   = Math.sin(frame * 0.06) * 0.25 + 0.75;
        const tipY      = rosterY + 50;

        // Outer glow panel
        ctx.save();
        ctx.globalAlpha = tipFade * 0.92;
        const panelW = 310, panelH = 28;
        const panelX = (CW - panelW) / 2;
        ctx.fillStyle = 'rgba(255,215,0,0.08)';
        ctx.fillRect(panelX, tipY - 5, panelW, panelH);
        glow('#FFD700', 10 * tipFade);
        ctx.strokeStyle = `rgba(255,215,0,${tipFade * 0.45})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 0.5, tipY - 4.5, panelW - 1, panelH - 1);
        noGlow();

        if (tipCycle === 0) {
          // Message A — the goal
          ctx.fillStyle = '#FFD700';
          ctx.font = '6px "Press Start 2P", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('★ REACH LEVEL 25 IN NIGHT SHIFT ★', CW / 2, tipY + 4);
          ctx.fillStyle = '#00FF88';
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillText('EARN $2,500 LEGEND HAUL BONUS  →  REAL GAME CASH', CW / 2, tipY + 17);
        } else {
          // Message B — the two routes
          ctx.fillStyle = '#FF88AA';
          ctx.font = '6px "Press Start 2P", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('💰 $2,500 BONUS — TWO WAYS TO WIN', CW / 2, tipY + 4);
          ctx.fillStyle = 'rgba(255,220,100,0.85)';
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillText('WARP FRUIT AT LV 13  OR  GRIND TO LV 25  →  COLLECT', CW / 2, tipY + 17);
        }
        ctx.restore();
      }

      // ── INSERT COIN / PRESS SPACE (blinking) ──
      if (frame % 60 < 38) {
        const coinY = rosterY + 87;
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        glow('#FFFF00', 12);
        ctx.fillStyle = '#FFFF44';
        ctx.fillText('INSERT COIN', CW/2, coinY);
        noGlow();
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillText('PRESS SPACE OR ANY KEY', CW/2, coinY + 16);
      }

      ctx.restore();
    }
    
    // Lightweight ghost shape for attract screen (no tile-based state)
    function drawAttractGhost(ax, ay, color, emoji) {
      ctx.save();
      const R = 7;
      glow(color, 10);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(ax, ay, R, 0, Math.PI*2); ctx.fill();
      noGlow();
    
      // Skirt
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) {
        const sx = ax - R + 2 + i * (R * 2 - 4) / 2;
        ctx.beginPath(); ctx.arc(sx, ay + R - 1, 2.0, 0, Math.PI); ctx.fill();
      }
    
      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(ax - 2.3, ay - 1, 2.0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ax + 2.3, ay - 1, 2.0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000088';
      ctx.beginPath(); ctx.arc(ax - 1.5, ay - 1, 1.0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ax + 3.1, ay - 1, 1.0, 0, Math.PI*2); ctx.fill();
    
      // Emoji badge
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(emoji, ax, ay + 2.5);
      ctx.restore();
    }
    
    // ── DEATH ANIMATION OVERLAY ───────────────────────────────────────
    // deathTimer: 0 → DEATH_ANIM_DUR
    // Truck spins and shrinks at deathPos
    function drawDeathAnimation() {
      const t = deathTimer / DEATH_ANIM_DUR;    // 0.0 → 1.0
      const rotation = t * Math.PI * 2.5;      // 2.5 full spins
      const scale    = Math.max(0, 1.0 - t);    // 1 → 0
    
      if (scale < 0.02) return;
    
      ctx.save();
      ctx.translate(deathPos.px, deathPos.py);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.translate(-deathPos.px, -deathPos.py);
    
      // Bright flash on first few frames
      if (t < 0.15) {
        const flashA = (1.0 - t / 0.15) * 0.7;
        ctx.fillStyle = `rgba(255,200,0,${flashA})`;
        ctx.fillRect(0, HUD_H, CW, MAZE_H);
      }
    
      // Draw truck at death position (mouth fully open, direction frozen)
      drawTruck(deathPos.px, deathPos.py, truck.dir, 1.0);
    
      // Add spinning debris sparks
      const sparks = 8;
      for (let i = 0; i < sparks; i++) {
        const angle  = (i / sparks) * Math.PI * 2 + rotation * 2;
        const radius = 14 * t;
        const sx = deathPos.px + Math.cos(angle) * radius;
        const sy = deathPos.py + Math.sin(angle) * radius;
        const sparkA = (1 - t) * 0.9;
        glow('#FF6600', 8 * (1-t));
        ctx.fillStyle = `rgba(255,${Math.floor(100 + 100*t)},0,${sparkA})`;
        ctx.beginPath(); ctx.arc(sx, sy, 2.5 * (1-t), 0, Math.PI*2); ctx.fill();
        noGlow();
      }
      ctx.restore();
    }
    
    // ── LEVEL COMPLETE FLASH ──────────────────────────────────────────
    // Returns override wall color during flash, or null for normal
    function getLevelFlashColor() {
      if (gameState !== GS.LEVEL_COMPLETE) return null;
      // 4 half-cycles of 20 frames each
      const phase = Math.floor((LVL_FLASH_DUR - lvlCompleteTimer) / 20) % 2;
      return phase === 0 ? '#4488FF' : '#FFFFFF';
    }
    
    // ================================================================
    //  CINEMATIC INTERLUDE SYSTEM
    //  4 animated scenes play between levels 2→3, 4→5, 6→7, 8→9.
    //  Each scene is a self-contained state machine returned by a
    //  factory function.  The main loop calls scene.update() and
    //  scene.render() each frame; scene.done signals completion.
    //  scene.skip() jumps immediately to the done state.
    //
    //  Shared canvas space: CW × CH.  Road midline at CH * 0.68.
    //  All audio uses getAC() + burst() (no external assets).
    // ================================================================

    // ── IL: SHARED TEXT WRAP ────────────────────────────────────────────
    function ilWrapText(text, maxW, fs) {
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      const words = text.split(' ');
      const lines = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines;
    }

    // ── IL: SPEECH BUBBLE ───────────────────────────────────────────────
    // tailSide: 'bl' (bottom-left) | 'br' (bottom-right)
    function ilBubble(bx, by, text, tailSide, maxW, opts) {
      opts = opts || {};
      const fs  = opts.fs  || 7;
      const lh  = fs * 1.9;
      const pad = 9;
      const lines = typeof text === 'string' ? ilWrapText(text, maxW - pad*2, fs) : text;
      const bw = maxW;
      const bh = lines.length * lh + pad * 2;
      const r  = 6;
      ctx.save();
      ctx.fillStyle   = opts.bg     || '#ffffff';
      ctx.strokeStyle = opts.border || '#333';
      ctx.lineWidth   = 2;
      if (opts.glow) { ctx.shadowColor = opts.glowC || '#FFD700'; ctx.shadowBlur = 12; }
      // Rounded rect + tail
      ctx.beginPath();
      ctx.moveTo(bx+r, by);
      ctx.lineTo(bx+bw-r, by);      ctx.arcTo(bx+bw, by,      bx+bw, by+r,      r);
      ctx.lineTo(bx+bw, by+bh-r);   ctx.arcTo(bx+bw, by+bh,   bx+bw-r, by+bh,   r);
      if (tailSide === 'bl') {
        ctx.lineTo(bx+28, by+bh);
        ctx.lineTo(bx+14, by+bh+13);
        ctx.lineTo(bx+14, by+bh);
      } else if (tailSide === 'br') {
        ctx.lineTo(bx+bw-14, by+bh);
        ctx.lineTo(bx+bw-14, by+bh+13);
        ctx.lineTo(bx+bw-28, by+bh);
      }
      ctx.lineTo(bx+r, by+bh);      ctx.arcTo(bx, by+bh, bx, by+bh-r, r);
      ctx.lineTo(bx, by+r);         ctx.arcTo(bx, by,    bx+r, by,     r);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      // Text
      ctx.fillStyle = opts.color || '#111';
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, bx + pad, by + pad + i * lh));
      ctx.restore();
    }

    // ── IL: SKY + ROAD BACKGROUND ──────────────────────────────────────
    function ilDrawBackground(scrollX, night) {
      // Sky
      const sg = ctx.createLinearGradient(0, 0, 0, CH * 0.58);
      if (night) {
        sg.addColorStop(0, '#020b18'); sg.addColorStop(1, '#080818');
      } else {
        sg.addColorStop(0, '#1a3a6e'); sg.addColorStop(1, '#2e5a9a');
      }
      ctx.fillStyle = sg; ctx.fillRect(0, 0, CW, CH * 0.58);

      if (night) {
        // Stars
        for (let i = 0; i < 55; i++) {
          const sx = (i * 173.7) % CW;
          const sy = (i * 97.3)  % (CH * 0.54);
          const br = Math.sin(frame * 0.018 + i) * 0.35 + 0.65;
          ctx.fillStyle = `rgba(255,255,200,${br * 0.8})`;
          ctx.fillRect(sx, sy, 1.5, 1.5);
        }
        // Moon
        ctx.fillStyle = '#fffde8';
        ctx.beginPath(); ctx.arc(CW * 0.82, 40, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#060810';
        ctx.beginPath(); ctx.arc(CW * 0.82 + 7, 35, 13, 0, Math.PI * 2); ctx.fill();
      } else {
        // Clouds
        [[CW*0.14,36,55,20],[CW*0.52,26,72,26],[CW*0.78,46,48,18]].forEach(([cx2,cy2,cw2,ch2]) => {
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.beginPath(); ctx.ellipse(cx2, cy2, cw2, ch2, 0, 0, Math.PI*2); ctx.fill();
        });
        // Sun glow
        ctx.fillStyle = 'rgba(255,220,50,0.22)';
        ctx.beginPath(); ctx.arc(CW * 0.88, 44, 36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFE050';
        ctx.beginPath(); ctx.arc(CW * 0.88, 44, 22, 0, Math.PI * 2); ctx.fill();
      }

      // Grass strip
      ctx.fillStyle = night ? '#0e1a0c' : '#2d5a1b';
      ctx.fillRect(0, CH * 0.58, CW, CH * 0.42);

      // Asphalt
      const rg = ctx.createLinearGradient(0, CH * 0.60, 0, CH);
      rg.addColorStop(0, night ? '#1a1a1a' : '#2a2a2a');
      rg.addColorStop(1, night ? '#111'    : '#1c1c1c');
      ctx.fillStyle = rg;
      ctx.fillRect(0, CH * 0.60, CW, CH * 0.40);

      // Centre dashes
      const dw = 40, dg = 26, dt = dw + dg;
      const off = (((scrollX || 0) % dt) + dt) % dt;
      ctx.fillStyle = 'rgba(255,215,0,0.55)';
      for (let x = -dt + off; x < CW + dt; x += dt)
        ctx.fillRect(x, CH * 0.715, dw, 3.5);

      // Edge lines
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2;
      [CH * 0.615, CH * 0.935].forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
      });
    }

    // ── IL: BOX TRUCK ACTOR ────────────────────────────────────────────
    // Larger cinematic version. scale≈1 → ~110px long.
    // state: 'normal'|'scared'|'angry'|'sleeping'
    // dir: 1=right, -1=left
    function ilDrawTruck(cx, cy, dir, state, wheelT) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(dir, 1);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(0, 24, 54, 7, 0, 0, Math.PI*2); ctx.fill();

      // Cargo box
      const boxC = state === 'sleeping' ? '#8a9bac' : '#d0dff0';
      ctx.fillStyle = boxC;
      ctx.fillRect(-58, -22, 72, 44);
      ctx.strokeStyle = '#99aabb'; ctx.lineWidth = 0.8;
      ctx.strokeRect(-58, -22, 72, 44);

      // Logo panel
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(-52, -17, 60, 34);
      ctx.fillStyle = '#FFD700';
      ctx.font = "bold 8px 'Press Start 2P', monospace";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BOX', -22, -9);
      ctx.fillText('TRUCK', -22, 1);
      ctx.fillText('BOSS', -22, 11);

      // Cab
      const cabC = state === 'sleeping' ? '#5a6b7c' : state === 'angry' ? '#8b2020' : '#2563eb';
      ctx.fillStyle = cabC;
      ctx.fillRect(14, -22, 36, 44);

      // Roof fairing
      ctx.fillStyle = state === 'angry' ? '#6b1010' : '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(14,-22); ctx.lineTo(50,-22); ctx.lineTo(46,-30); ctx.lineTo(16,-30);
      ctx.closePath(); ctx.fill();

      // Windshield
      const windC = state === 'scared' ? '#aaffaa' : state === 'sleeping' ? '#3a4a5a' : '#b8d8f0';
      ctx.fillStyle = windC;
      ctx.fillRect(17, -17, 28, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(18, -16, 10, 9);

      // Driver face
      ctx.fillStyle = '#ffcc88';
      ctx.beginPath(); ctx.arc(30, -8, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#333';
      if (state === 'sleeping') {
        ctx.fillRect(27,-10,3,1.5); ctx.fillRect(31,-10,3,1.5);
      } else if (state === 'scared') {
        ctx.beginPath(); ctx.arc(30,-7,3,0,Math.PI); ctx.stroke();
        ctx.fillRect(27,-13,2,2); ctx.fillRect(31,-13,2,2);
      } else if (state === 'angry') {
        ctx.fillRect(26,-11,5,2); ctx.fillRect(31,-12,4,2);
        ctx.beginPath(); ctx.arc(30,-6,3,0,Math.PI); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(30,-7,3,Math.PI,0); ctx.fill();
        ctx.fillRect(27,-12,2,2); ctx.fillRect(31,-12,2,2);
      }

      // Grille
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(48, -12, 6, 28);

      // Headlights
      const hOn = state !== 'sleeping';
      ctx.fillStyle = hOn ? '#fffaaa' : '#333';
      ctx.fillRect(51, -9, 3, 8);
      ctx.fillRect(51, 8,  3, 8);

      // Wheels
      const wa = (wheelT || 0) * 0.14;
      [[-30, 21], [28, 21]].forEach(([wx, wy]) => {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(wx, wy, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI*2); ctx.fill();
        for (let s = 0; s < 5; s++) {
          const a = wa + s * (Math.PI * 2 / 5);
          ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(a)*5, wy + Math.sin(a)*5);
          ctx.stroke();
        }
        ctx.fillStyle = '#aaa';
        ctx.beginPath(); ctx.arc(wx, wy, 2.5, 0, Math.PI*2); ctx.fill();
      });

      ctx.restore();
    }

    // ── IL: GHOST ACTOR ────────────────────────────────────────────────
    // Cinematic ghost — larger, with role-specific accessories.
    // name: 'DOT'|'BROKER'|'IRS'|'REPO', state: 'normal'|'scared'
    function ilDrawGhostActor(gx, gy, name, state, scl, bobT, flipX) {
      const GCOLS = { DOT:'#e74c3c', BROKER:'#e0a0d0', IRS:'#1abc9c', REPO:'#e67e22' };
      const col = state === 'scared' ? '#2233cc' : (GCOLS[name] || '#999');
      const bob = Math.sin((bobT || frame) * 0.09) * 4;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.scale(flipX ? -(scl||1) : (scl||1), scl||1);

      // Body glow
      ctx.shadowColor = col; ctx.shadowBlur = 18;

      // Main body
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, -14 + bob, 19, Math.PI, 0, false);
      const bt = 17 + bob;
      ctx.lineTo(19, bt);
      const w1 = Math.sin(frame * 0.12) * 2.5;
      const w2 = Math.sin(frame * 0.12 + 2.0) * 2.5;
      ctx.bezierCurveTo(15, bt+9+w1, 8, bt+2, 0, bt+9+w2);
      ctx.bezierCurveTo(-8, bt+2, -15, bt+9+w1, -19, bt);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;

      // Eyes
      if (state === 'scared') {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) ctx.lineTo(-7 + i, (-5+bob) + (i%4 < 2 ? -3 : 3));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(-6,-11+bob,3.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( 6,-11+bob,3.5,0,Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(-6,-11+bob,6.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( 6,-11+bob,6.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a1aff';
        ctx.beginPath(); ctx.arc(-4.5,-11+bob,3.8,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( 7.5,-11+bob,3.8,0,Math.PI*2); ctx.fill();
      }

      // Role accessories
      if (name === 'DOT' && state !== 'scared') {
        // Police cap
        ctx.fillStyle = '#111';
        ctx.fillRect(-16,-34+bob,32,9);
        ctx.fillRect(-11,-42+bob,22,11);
        ctx.fillStyle = '#FFD700'; ctx.fillRect(-7,-40+bob,14,7);
        // Badge
        ctx.beginPath(); ctx.arc(0,1+bob,5.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.font = '5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('DOT', 0, 1+bob);
        // Whistle
        ctx.fillStyle = '#777';
        ctx.fillRect(15,-4+bob,14,5);
        ctx.beginPath(); ctx.arc(29,-1.5+bob,5,0,Math.PI*2); ctx.fill();
      }
      if (name === 'BROKER' && state !== 'scared') {
        // Headset
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,-21+bob,17,Math.PI*1.1,Math.PI*1.9,false); ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-18,-21+bob,5.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc( 18,-21+bob,5.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(19,-6+bob,11,4);
        ctx.beginPath(); ctx.arc(30,-4+bob,5,0,Math.PI*2); ctx.fill();
        // $ sign
        ctx.fillStyle = '#2ecc71';
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 2+bob);
      }
      if (name === 'IRS' && state !== 'scared') {
        // Thick glasses
        ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        ctx.strokeRect(-14,-16+bob,11,9);
        ctx.strokeRect( 3,-16+bob,11,9);
        ctx.beginPath(); ctx.moveTo(-3,-11+bob); ctx.lineTo(3,-11+bob); ctx.stroke();
        // Briefcase
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(-12,9+bob,24,16);
        ctx.fillStyle = '#6b4f10';
        ctx.fillRect(-7,7+bob,14,6);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-4,14+bob,8,6);
      }
      if (name === 'REPO' && state !== 'scared') {
        // Tow hook arm
        ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(17,4+bob); ctx.lineTo(32,-2+bob); ctx.lineTo(40,2+bob);
        ctx.arc(36,8+bob,6.5,-Math.PI*0.7,Math.PI*0.7);
        ctx.stroke();
        // Sneaky brows
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-10,-23+bob,8,3);
        ctx.fillRect( 2,-23+bob,8,3);
      }

      ctx.restore();
    }

    // ── IL: POLICE LIGHT BAR ───────────────────────────────────────────
    function ilPoliceBar(px, py) {
      const pair = Math.floor(frame / 5) % 2;
      const cols = pair === 0 ? ['#ff2200','#000088'] : ['#000088','#ff2200'];
      ctx.save(); ctx.translate(px, py);
      [-13,13].forEach((ox,i) => {
        ctx.fillStyle = cols[i];
        if (cols[i] !== '#000088') { ctx.shadowColor = cols[i]; ctx.shadowBlur = 18; }
        ctx.beginPath(); ctx.arc(ox,-8,7.5,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    }

    // ── IL: FADE OVERLAY ───────────────────────────────────────────────
    function ilFade(alpha) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,CW,CH);
      ctx.restore();
    }

    // ── IL: TITLE CARD ─────────────────────────────────────────────────
    function ilTitleCard(topLine, bigLine, alpha) {
      if (alpha <= 0) return;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(0, CH/2-40, CW, 80);
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
      ctx.strokeRect(4, CH/2-40, CW-8, 80);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(topLine, CW/2, CH/2-16);
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillStyle = '#fff';
      glow('#FFD700', 8); ctx.fillText(bigLine, CW/2, CH/2+14); noGlow();
      ctx.restore();
    }

    // ── IL: SKIP PROMPT ────────────────────────────────────────────────
    function ilSkipPrompt() {
      if (frame % 60 >= 38) return;
      ctx.save(); ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#aaa';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TAP TO SKIP', CW/2, CH - 18);
      ctx.restore();
    }

    // ── IL: INTERMISSION BAR ───────────────────────────────────────────
    function ilTopBar() {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, CW, 20);
      ctx.fillStyle = '#FFD700';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('— INTERMISSION —', CW/2, 11);
    }

    // ── IL: TYPEWRITER DIALOG HELPER ───────────────────────────────────
    // Given current frame and charTimer, returns how many chars to show.
    function ilCharsToShow(charTimer, speed) {
      return Math.floor((charTimer || 0) / (speed || 2));
    }

    // ================================================================
    //  SCENE 1 — "THE SHAKEDOWN"  (after level 2 → 3)
    //  DOT ghost pulls the truck over and issues a massive ticket.
    // ================================================================
    function makeInterlude1() {
      // phase: 'fadein' → 'title' → 'drive' → 'approach' → 'stop' → 'dialog' → 'papers' → 'fine' → 'done'
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1;
      let phaseT = 0;       // frames in current phase
      let truckX = -130, dotX = CW + 110;
      const truckY = CH * 0.72, dotY = CH * 0.68;
      let truckState = 'normal';
      let dialogIdx = 0, charTimer = 0, waitTimer = 0;
      let paperParts = [], fineAlpha = 0;
      let wheelT = 0;
      let _done = false;
      const sfxFired = {};

      const DIALOGS = [
        { who:'DOT', text:'FREEZE! RANDOM ROADSIDE INSPECTION!' },
        { who:'DOT', text:'CDL... wait, non-CDL? I need: medical cert, ELD logs, IFTA sticker, Form 2290, pre-trip report, AND Bill of Lading.' },
        { who:'TRUCK', text:'I had an inspection 20 miles ago...' },
        { who:'DOT', text:'NOT. MY. PROBLEM. Also your load looks shifted. Separate violation.' },
        { who:'DOT', text:'CITATION ISSUED. FINE: $2,847.00', special:'fine' },
      ];

      function spawnPapers() {
        for (let i = 0; i < 12; i++) {
          paperParts.push({
            x: truckX + (Math.random()-0.5)*30,
            y: truckY - 20,
            vx: (Math.random()-0.5)*6,
            vy: -(Math.random()*8+2),
            rot: Math.random()*Math.PI*2,
            vrot: (Math.random()-0.5)*0.15,
            label: ['VIOLATION','FORM 2290','LOG BOOK','CITATION','IFTA Q3','FINE'][i%6],
          });
        }
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.045);
            if (phaseT > 65) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 85) titleAlpha = Math.max(0, titleAlpha - 0.06);
            if (titleAlpha <= 0) { phase = 'drive'; phaseT = 0; }
          } else if (phase === 'drive') {
            truckX = Math.min(CW * 0.32, truckX + 4.5); wheelT += 4;
            if (truckX >= CW * 0.32) { phase = 'approach'; phaseT = 0; }
          } else if (phase === 'approach') {
            dotX = Math.max(CW * 0.60, dotX - 5); wheelT += 3;
            if (!sfxFired.siren && dotX < CW * 0.80) { sfxILSiren(); sfxFired.siren = true; }
            if (dotX <= CW * 0.60) { phase = 'stop'; phaseT = 0; }
          } else if (phase === 'stop') {
            wheelT++; truckX = Math.max(CW * 0.28, truckX - 0.4);
            if (phaseT > 38) { phase = 'dialog'; phaseT = 0; truckState = 'scared'; dialogIdx = 0; charTimer = 0; waitTimer = 0; }
          } else if (phase === 'dialog') {
            charTimer++;
            const d = DIALOGS[dialogIdx];
            const maxC = d.text.length * 2;
            if (charTimer < maxC) return;
            waitTimer++;
            const hold = dialogIdx === 1 ? 140 : 90;
            if (waitTimer > hold) {
              if (dialogIdx < DIALOGS.length - 1) {
                dialogIdx++; charTimer = 0; waitTimer = 0;
              } else {
                spawnPapers(); phase = 'papers'; phaseT = 0;
              }
            }
          } else if (phase === 'papers') {
            for (const p of paperParts) {
              p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.rot += p.vrot;
            }
            fineAlpha = Math.min(1, fineAlpha + 0.03);
            if (!sfxFired.trombone && fineAlpha > 0.5) { sfxILSadTrombone(); sfxFired.trombone = true; }
            if (fineAlpha >= 1) { waitTimer++; if (waitTimer > 150) { phase = 'done'; _done = true; } }
          }
        },
        render() {
          ilDrawBackground(-wheelT * 3, false);
          // DOT police car lights
          if (phase !== 'fadein' && phase !== 'title' && phase !== 'drive') {
            ilPoliceBar(dotX, dotY - 54);
            ilDrawGhostActor(dotX, dotY, 'DOT', 'normal', 1.1, frame);
          }
          ilDrawTruck(truckX, truckY, 1, truckState, phase === 'drive' || phase === 'approach' || phase === 'stop' ? wheelT : 0);

          // Dialog bubbles — only during dialog phase (not during papers/fine card)
          if (phase === 'dialog') {
            const d = DIALOGS[dialogIdx];
            if (d) {
              const shown = d.text.substring(0, ilCharsToShow(charTimer, 2));
              if (shown.length > 0) {
                const isFine = d.special === 'fine';
                if (d.who === 'DOT') {
                  // Bubble to the LEFT of DOT; 'br' tail tip points right toward DOT's head
                  const bw = 238;
                  const bx = Math.max(8, Math.min(CW - bw - 8, dotX - bw + 20));
                  const by = Math.max(25, dotY - 118);
                  ilBubble(bx, by, shown, 'br', bw,
                    isFine ? { bg:'#cc0000', color:'#fff', border:'#880000', fs:8, glow:true, glowC:'#ff0000' }
                           : { bg:'#fff8e8', fs:7 });
                } else {
                  // Bubble centered above truck; 'bl' tail tip points left toward truck
                  const bw = 210;
                  const bx = Math.max(8, Math.min(CW - bw - 8, truckX - 80));
                  const by = Math.max(25, truckY - 95);
                  ilBubble(bx, by, shown, 'bl', bw, { bg:'#e8f4ff', fs:7 });
                }
              }
            }
          }

          // Falling papers
          if (phase === 'papers') {
            for (const p of paperParts) {
              if (p.y > CH + 20) continue;
              ctx.save();
              ctx.translate(p.x, p.y); ctx.rotate(p.rot);
              ctx.fillStyle = '#f5f5dc'; ctx.fillRect(-12,-8,24,16);
              ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.7; ctx.strokeRect(-12,-8,24,16);
              ctx.fillStyle = '#bbb';
              for (let j = 0; j < 3; j++) ctx.fillRect(-9,-5+j*4,18,1);
              ctx.fillStyle = 'rgba(200,0,0,0.55)';
              ctx.font = '4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText(p.label, 0, 1);
              ctx.restore();
            }
            // Fine overlay
            if (fineAlpha > 0) {
              ctx.save(); ctx.globalAlpha = fineAlpha;
              ctx.fillStyle = 'rgba(0,0,0,0.78)';
              ctx.fillRect(CW/2-148, CH/2-52, 296, 104);
              ctx.strokeStyle = '#FF3333'; ctx.lineWidth = 3;
              glow('#ff0000', 18); ctx.strokeRect(CW/2-148, CH/2-52, 296, 104); noGlow();
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillStyle = '#FF9999'; ctx.font = '7px "Press Start 2P", monospace';
              ctx.fillText('⚠ CITATION ISSUED ⚠', CW/2, CH/2-28);
              ctx.fillStyle = '#FFD700'; ctx.font = '17px "Press Start 2P", monospace';
              glow('#FFD700', 10); ctx.fillText('FINE: $2,847', CW/2, CH/2+8); noGlow();
              ctx.fillStyle = '#ff9999'; ctx.font = '5px "Press Start 2P", monospace';
              ctx.fillText('+ shame, detention, missed window', CW/2, CH/2+34);
              ctx.restore();
            }
          }

          ilTitleCard('LEVEL 2 COMPLETE', '"THE SHAKEDOWN"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 2 — "THE LOWBALL"  (after level 4 → 5)
    //  BROKER ghost calls with a laughably bad rate.
    // ================================================================
    function makeInterlude2() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1;
      let phaseT = 0;
      let truckX = CW * 0.26, brokerX = CW + 100;
      const truckY = CH * 0.72, brokerY = CH * 0.68;
      let truckState = 'normal';
      let dialogIdx = 0, charTimer = 0, waitTimer = 0;
      let rateRed = false, jawAlpha = 0;
      const sfxFired = {};
      let _done = false;

      const DIALOGS = [
        { who:'BROKER', text:'Hey buddy! GREAT load — Chicago to Miami! 1,380 miles!' },
        { who:'TRUCK',  text:'Finally! What pays?' },
        { who:'BROKER', text:'$0.47/mile. All-in. No fuel surcharge, no lumper, 2hr detention on you.' },
        { who:'TRUCK',  text:'...That is below my FUEL COST alone.' },
        { who:'BROKER', text:'12 carriers waiting! Best rate in the market! \uD83D\uDE0A' },
        { who:'TRUCK',  text:'I CANNOT AFFORD TO TAKE THAT LOAD.', special:'shout' },
      ];

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.05);
            if (phaseT > 60) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 80) titleAlpha = Math.max(0, titleAlpha - 0.06);
            if (titleAlpha <= 0) { phase = 'drive'; phaseT = 0; }
          } else if (phase === 'drive') {
            if (!sfxFired.phone && phaseT > 10) { sfxILPhoneRing(); sfxFired.phone = true; }
            if (phaseT > 40) { phase = 'brokerIn'; phaseT = 0; }
          } else if (phase === 'brokerIn') {
            brokerX = Math.max(CW * 0.62, brokerX - 5);
            if (brokerX <= CW * 0.62) { phase = 'dialog'; phaseT = 0; dialogIdx = 0; charTimer = 0; waitTimer = 0; }
          } else if (phase === 'dialog') {
            charTimer++;
            const d = DIALOGS[dialogIdx];
            const maxC = d.text.length * 2;
            if (charTimer < maxC) return;
            waitTimer++;
            const hold = dialogIdx === 2 ? 150 : 90;
            if (waitTimer > hold) {
              if (dialogIdx === 2) rateRed = true;
              if (dialogIdx < DIALOGS.length - 1) {
                dialogIdx++; charTimer = 0; waitTimer = 0;
                if (dialogIdx === 3) truckState = 'scared';
              } else {
                phase = 'jaw'; phaseT = 0;
              }
            }
          } else if (phase === 'jaw') {
            jawAlpha = Math.min(1, jawAlpha + 0.04);
            if (!sfxFired.trombone && jawAlpha > 0.5) { sfxILSadTrombone(); sfxFired.trombone = true; }
            waitTimer++; if (waitTimer > 160) { phase = 'done'; _done = true; }
          }
        },
        render() {
          ilDrawBackground(0, false);

          // Load board in sky area
          const bx = CW*0.06, bby = CH*0.04, bw = CW*0.88, bh = CH*0.38;
          const bg = Math.sin(frame*0.09)*0.18+0.82;
          ctx.fillStyle = `rgba(8,18,52,${bg*0.94})`; ctx.fillRect(bx,bby,bw,bh);
          ctx.strokeStyle = `rgba(255,215,0,${bg})`; ctx.lineWidth=2; ctx.strokeRect(bx,bby,bw,bh);
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillStyle='#FFD700'; ctx.font="6px 'Press Start 2P', monospace";
          ctx.fillText('◉ DIGITAL LOAD BOARD — LIVE RATES ◉', CW/2, bby+14);
          ctx.fillStyle='#88ffcc'; ctx.font="8px 'Press Start 2P', monospace";
          ctx.fillText('CHICAGO, IL  →  MIAMI, FL', CW/2, bby+30);
          ctx.fillStyle='#aaa'; ctx.font="5px 'Press Start 2P', monospace";
          ctx.fillText('1,380 MILES  •  24HR PICKUP  •  FULL PALLET LOAD', CW/2, bby+44);
          const rC = rateRed ? '#ff3333' : '#44ff44';
          ctx.fillStyle = rC; ctx.font="16px 'Press Start 2P', monospace";
          glow(rC, rateRed ? 14 : 0);
          ctx.fillText('$0.47 / MILE', CW/2, bby+72); noGlow();
          if (rateRed) {
            ctx.fillStyle='#ff8888'; ctx.font="5px 'Press Start 2P', monospace";
            ctx.fillText('● NO FUEL SURCHARGE  ● NO LUMPER  ● NO DETENTION PAY', CW/2, bby+90);
            ctx.fillStyle='#ff4444';
            ctx.fillText('⚠ RATE IS BELOW YOUR OPERATING COST ⚠', CW/2, bby+104);
          }

          // Phone icon bobbing
          if (phase === 'drive' || phase === 'brokerIn') {
            const pr = Math.sin(frame*0.28)*0.18;
            ctx.save(); ctx.translate(truckX+65, truckY-52); ctx.rotate(pr);
            ctx.font='26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('📞',0,0); ctx.restore();
          }

          ilDrawTruck(truckX, truckY, 1, truckState, 0);
          if (phase !== 'fadein' && phase !== 'title' && phase !== 'drive') {
            ilDrawGhostActor(brokerX, brokerY, 'BROKER', 'normal', 1.1, frame);
          }

          // Dialogs — only during dialog phase; jaw card stands alone
          if (phase === 'dialog') {
            const d = DIALOGS[dialogIdx];
            if (d) {
              const shown = d.text.substring(0, ilCharsToShow(charTimer, 2));
              if (shown.length > 0) {
                if (d.who === 'BROKER') {
                  // Bubble to the LEFT of BROKER; 'br' tail points right toward BROKER's head
                  const bw = 240;
                  const bx = Math.max(8, Math.min(CW - bw - 8, brokerX - bw + 20));
                  const by = Math.max(25, brokerY - 118);
                  ilBubble(bx, by, shown, 'br', bw, { bg:'#ffe8f4', border:'#d080a0', fs:7 });
                } else {
                  // Bubble centered-left above truck; 'bl' tail points down toward truck
                  const shout = d.special === 'shout';
                  const bw = shout ? 220 : 200;
                  const bx = Math.max(8, Math.min(CW - bw - 8, truckX - 80));
                  const by = Math.max(25, truckY - 95);
                  ilBubble(bx, by, shown, 'bl', bw,
                    shout ? { bg:'#ff3333', color:'#fff', border:'#990000', fs:8, glow:true, glowC:'#ff0000' }
                          : { bg:'#e8f4ff', fs:7 });
                }
              }
            }
          }

          // Jaw drop card
          if (jawAlpha > 0) {
            ctx.save(); ctx.globalAlpha = jawAlpha;
            ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(CW/2-128,CH/2-32,256,70);
            ctx.strokeStyle='#FFD700'; ctx.lineWidth=2;
            glow('#FFD700',12); ctx.strokeRect(CW/2-128,CH/2-32,256,70); noGlow();
            ctx.fillStyle='#FFD700'; ctx.font="9px 'Press Start 2P', monospace";
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText('JAW HAS LEFT THE BUILDING', CW/2, CH/2+2);
            ctx.fillStyle='#888'; ctx.font="6px 'Press Start 2P', monospace";
            ctx.fillText('(truck.exe has stopped working)', CW/2, CH/2+22);
            ctx.restore();
          }

          ilTitleCard('LEVEL 4 COMPLETE', '"THE LOWBALL"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 3 — "THE GREAT AUDIT"  (after level 6 → 7)
    //  IRS materialises through a lightning flash. Papers tornado.
    // ================================================================
    function makeInterlude3() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1;
      let phaseT = 0;
      let truckX = CW * 0.24, irsX = CW + 110;
      const truckY = CH * 0.72, irsY = CH * 0.66;
      let truckState = 'normal';
      let dialogIdx = 0, charTimer = 0, waitTimer = 0;
      let flashAlpha = 0, flashDir = 1;
      let papers = [], billAlpha = 0;
      const sfxFired = {};
      let _done = false;

      const DIALOGS = [
        { who:'IRS',   text:'Good afternoon. IRS Compliance. We need to discuss some... discrepancies.' },
        { who:'TRUCK', text:'I filed everything on time! My accountant—' },
        { who:'IRS',   text:'IFTA Q3: off by $847. Section 179 depreciation: flagged. Per-diem: EXTREMELY suspicious.' },
        { who:'IRS',   text:'Also, your fuel expense Sept 14 includes a Cinnabon and a souvenir hat. Not deductible.' },
        { who:'IRS',   text:'TOTAL OWED: $34,891.47 + interest + penalties.', special:'bill' },
      ];

      function spawnPaper(n) {
        for (let i=0;i<(n||2);i++) {
          papers.push({
            x: irsX + (Math.random()-0.5)*24,
            y: irsY - 12,
            vx:(Math.random()-0.5)*9,
            vy:-(Math.random()*10+3),
            rot:Math.random()*Math.PI*2,
            vrot:(Math.random()-0.5)*0.18,
            life:1,
            label:['IFTA Q3','FORM 2290','AUDIT','VIOLATION','PER DIEM?','WHY?'][Math.floor(Math.random()*6)],
          });
        }
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.05);
            if (phaseT > 60) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 80) titleAlpha = Math.max(0, titleAlpha - 0.06);
            if (titleAlpha <= 0) { phase = 'flash'; phaseT = 0; }
          } else if (phase === 'flash') {
            if (!sfxFired.thunder) { sfxILThunder(); sfxFired.thunder = true; }
            flashAlpha += flashDir * 0.14;
            if (flashAlpha > 1) { flashAlpha = 1; flashDir = -1; }
            if (flashAlpha < 0) { flashAlpha = 0; phase = 'irsIn'; phaseT = 0; }
          } else if (phase === 'irsIn') {
            irsX = Math.max(CW * 0.62, irsX - 5);
            spawnPaper(2);
            if (irsX <= CW * 0.62) {
              spawnPaper(22); truckState = 'scared';
              phase = 'dialog'; phaseT = 0; dialogIdx = 0; charTimer = 0; waitTimer = 0;
            }
          } else if (phase === 'dialog') {
            charTimer++;
            if (frame % 4 === 0) spawnPaper(1);
            const d = DIALOGS[dialogIdx];
            const maxC = d.text.length * 2;
            if (charTimer < maxC) {
              for (const p of papers) { p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.rot+=p.vrot; p.life-=0.006; }
              papers = papers.filter(p => p.life > 0 && p.y < CH + 20);
              return;
            }
            waitTimer++;
            const hold = 95;
            if (waitTimer > hold) {
              if (dialogIdx < DIALOGS.length - 1) {
                dialogIdx++; charTimer = 0; waitTimer = 0;
              } else {
                phase = 'bill'; phaseT = 0; waitTimer = 0;
              }
            }
            for (const p of papers) { p.x+=p.vx; p.y+=p.vy; p.vy+=0.25; p.rot+=p.vrot; p.life-=0.006; }
            papers = papers.filter(p => p.life > 0 && p.y < CH + 20);
          } else if (phase === 'bill') {
            billAlpha = Math.min(1, billAlpha + 0.03);
            if (!sfxFired.trombone && billAlpha > 0.5) { sfxILSadTrombone(); sfxFired.trombone = true; }
            waitTimer++; if (waitTimer > 170) { phase = 'done'; _done = true; }
          }
        },
        render() {
          ilDrawBackground(0, false);
          // Lightning flash layer
          if (flashAlpha > 0) {
            ctx.fillStyle = `rgba(160,220,255,${flashAlpha * 0.65})`;
            ctx.fillRect(0, 0, CW, CH);
          }
          ilDrawTruck(truckX, truckY, 1, truckState, 0);
          if (phase !== 'fadein' && phase !== 'title' && phase !== 'flash') {
            ilDrawGhostActor(irsX, irsY, 'IRS', 'normal', 1.2, frame);
          }
          // Paper tornado
          for (const p of papers) {
            ctx.save();
            ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.fillStyle = '#f5f5dc'; ctx.fillRect(-12,-8,24,16);
            ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.6; ctx.strokeRect(-12,-8,24,16);
            ctx.fillStyle = '#bbb';
            for (let j=0;j<3;j++) ctx.fillRect(-9,-5+j*4,18,1);
            ctx.fillStyle='rgba(190,0,0,0.6)'; ctx.font='4px sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(p.label,0,1);
            ctx.restore();
          }
          // Dialogs — only during dialog phase; bill card stands alone
          if (phase === 'dialog') {
            const d = DIALOGS[dialogIdx];
            if (d) {
              const shown = d.text.substring(0, ilCharsToShow(charTimer, 2));
              if (shown.length > 0) {
                if (d.who === 'IRS') {
                  // IRS scale=1.2 → taller body, needs extra Y clearance (128)
                  // Bubble to the LEFT; 'br' tail points right toward IRS head
                  const bw = 242;
                  const bx = Math.max(8, Math.min(CW - bw - 8, irsX - bw + 20));
                  const by = Math.max(25, irsY - 128);
                  ilBubble(bx, by, shown, 'br', bw, { bg:'#dff5f0', border:'#1abc9c', fs:7 });
                } else {
                  // Bubble centered-left above truck; 'bl' tail points down toward truck
                  const bw = 200;
                  const bx = Math.max(8, Math.min(CW - bw - 8, truckX - 70));
                  const by = Math.max(25, truckY - 95);
                  ilBubble(bx, by, shown, 'bl', bw, { bg:'#e8f4ff', fs:7 });
                }
              }
            }
          }
          // Final bill
          if (billAlpha > 0) {
            ctx.save(); ctx.globalAlpha = billAlpha;
            ctx.fillStyle='rgba(0,0,0,0.84)'; ctx.fillRect(CW/2-152,CH/2-56,304,112);
            ctx.strokeStyle='#1abc9c'; ctx.lineWidth=3;
            glow('#1abc9c',16); ctx.strokeRect(CW/2-152,CH/2-56,304,112); noGlow();
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillStyle='#1abc9c'; ctx.font="6px 'Press Start 2P', monospace";
            ctx.fillText('NOTICE OF DEFICIENCY', CW/2, CH/2-36);
            ctx.fillStyle='#FFD700'; ctx.font="16px 'Press Start 2P', monospace";
            glow('#FFD700',8); ctx.fillText('$34,891.47', CW/2, CH/2+2); noGlow();
            ctx.fillStyle='#ff9999'; ctx.font="6px 'Press Start 2P', monospace";
            ctx.fillText('(plus that Cinnabon)', CW/2, CH/2+24);
            ctx.fillStyle='#aaa'; ctx.fillText('PAYMENT DUE: YESTERDAY', CW/2, CH/2+40);
            ctx.restore();
          }
          ilTitleCard('LEVEL 6 COMPLETE', '"THE GREAT AUDIT"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 4 — "MIDNIGHT REPO"  (after level 8 → 9)
    //  REPO ghost tiptoes toward a sleeping truck at night.
    //  Headlights snap on. Slapstick high-speed chase ensues.
    // ================================================================
    function makeInterlude4() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1;
      let phaseT = 0;
      let truckX = CW * 0.42, repoX = -100;
      const truckY = CH * 0.72, repoY = CH * 0.68;
      let truckState = 'sleeping';
      let zzz = [], dustParts = [];
      let headlightAlpha = 0, truckAwake = false;
      let dialogIdx = 0, charTimer = 0, waitTimer = 0;
      let chaseOff = 0, escAlpha = 0;
      const sfxFired = {};
      let _done = false;

      const DIALOGS = [
        { who:'REPO', text:"Heh heh... nobody home... just gonna hook this baby up real quiet..." },
        { who:'TRUCK', text:'👀' },
        { who:'REPO',  text:'OH. Oh no. Oh PLEASE—' },
        { who:'TRUCK', text:'BWAAAAAAMP 🚛💨', special:'honk' },
      ];

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.045);
            if (phaseT > 65) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 85) titleAlpha = Math.max(0, titleAlpha - 0.06);
            if (titleAlpha <= 0) { phase = 'sleep'; phaseT = 0; }
          } else if (phase === 'sleep') {
            if (frame % 30 === 0)
              zzz.push({ x:truckX+50, y:truckY-32, vy:-0.65, vx:0.35, alpha:1, sz:7+Math.random()*5, c:['Z','Zz','Zzz'][zzz.length%3] });
            if (phaseT > 75) { phase = 'repoIn'; phaseT = 0; }
          } else if (phase === 'repoIn') {
            repoX = Math.min(truckX - 62, repoX + 0.9);
            if (frame % 30 === 0) zzz.push({ x:truckX+50, y:truckY-32, vy:-0.65, vx:0.35, alpha:1, sz:7+Math.random()*5, c:['Z','Zz','Zzz'][frame%3] });
            if (repoX >= truckX - 62) { phase = 'dialog'; phaseT = 0; dialogIdx = 0; charTimer = 0; waitTimer = 0; }
          } else if (phase === 'dialog') {
            charTimer++;
            if (frame % 30 === 0 && !truckAwake) zzz.push({ x:truckX+50, y:truckY-32, vy:-0.65, vx:0.35, alpha:1, sz:7+Math.random()*5, c:'Z' });
            const d = DIALOGS[dialogIdx];
            const maxC = d.text.length * 2;
            if (charTimer < maxC) {
              zzz = zzz.filter(z => { z.y+=z.vy; z.x+=z.vx; z.alpha-=0.007; return z.alpha>0; });
              return;
            }
            waitTimer++;
            const hold = dialogIdx===0?120 : dialogIdx===1?40 : 70;
            if (waitTimer > hold) {
              if (dialogIdx < DIALOGS.length - 1) {
                dialogIdx++; charTimer = 0; waitTimer = 0;
                if (dialogIdx === 1) { truckAwake = true; truckState = 'angry'; }
                if (dialogIdx === 3) {
                  if (!sfxFired.honk) { sfxILHonk(); sfxFired.honk = true; }
                }
              } else {
                phase = 'chase'; phaseT = 0; waitTimer = 0;
                if (!sfxFired.rev) { sfxILEngineRev(); sfxFired.rev = true; }
              }
            }
            zzz = zzz.filter(z => { z.y+=z.vy; z.x+=z.vx; z.alpha-=0.007; return z.alpha>0; });
          } else if (phase === 'chase') {
            chaseOff += 7; truckX = CW * 0.42 + chaseOff;
            repoX = CW * 0.42 - chaseOff * 0.52 - 62;
            for (let i=0;i<3;i++) {
              dustParts.push({ x:truckX-60+(Math.random()-0.5)*20, y:truckY+18,
                vx:-(4+Math.random()*4), vy:(Math.random()-0.5)*2, alpha:0.7, sz:5+Math.random()*8 });
            }
            dustParts = dustParts.filter(p => { p.x+=p.vx; p.y+=p.vy; p.alpha-=0.036; return p.alpha>0; });
            waitTimer++;
            if (waitTimer > 75) {
              escAlpha = Math.min(1, escAlpha + 0.04);
              if (escAlpha >= 1) { waitTimer++; if (waitTimer > 210) { phase = 'done'; _done = true; } }
            }
          }
          if (truckAwake) headlightAlpha = Math.min(1, headlightAlpha + 0.09);
        },
        render() {
          ilDrawBackground(phase === 'chase' ? -chaseOff*6 : 0, true);

          // Parking lot markings (non-chase)
          if (phase !== 'chase') {
            ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=2;
            for (let lx=80;lx<CW;lx+=100) { ctx.beginPath(); ctx.moveTo(lx,CH*0.62); ctx.lineTo(lx,CH); ctx.stroke(); }
            // Lamp post
            ctx.fillStyle='#444'; ctx.fillRect(CW*0.82,CH*0.30,6,CH*0.33);
            ctx.fillStyle='rgba(255,240,150,0.10)';
            ctx.beginPath(); ctx.arc(CW*0.82+3,CH*0.30,65,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#FFE888';
            ctx.beginPath(); ctx.arc(CW*0.82+3,CH*0.30,8,0,Math.PI*2); ctx.fill();
          }

          // Speed lines (chase)
          if (phase === 'chase') {
            ctx.save();
            for (let i=0;i<18;i++) {
              const ly = CH*0.46+(i/18)*CH*0.44;
              const len = 28+Math.random()*80;
              ctx.fillStyle=`rgba(255,255,255,${0.03+Math.random()*0.07})`;
              ctx.fillRect(0,ly,len,1.5);
            }
            ctx.restore();
          }

          // Dust particles
          for (const p of dustParts) {
            ctx.save(); ctx.globalAlpha=p.alpha;
            ctx.fillStyle='#9a7850';
            ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,Math.PI*2); ctx.fill();
            ctx.restore();
          }

          // Headlight beam
          if (headlightAlpha > 0) {
            ctx.save(); ctx.globalAlpha=headlightAlpha*0.20;
            ctx.fillStyle='#ffffaa';
            ctx.beginPath();
            ctx.moveTo(truckX+55, truckY-5);
            ctx.lineTo(truckX+220, truckY-55);
            ctx.lineTo(truckX+220, truckY+44);
            ctx.fill();
            ctx.restore();
          }

          ilDrawTruck(truckX, truckY, 1, truckState, phase==='chase'?chaseOff:0);

          // REPO ghost (hidden during fadein/title/sleep)
          if (phase!=='fadein'&&phase!=='title'&&phase!=='sleep') {
            const rscl = (!truckAwake) ? 0.82 : 1.0;
            ilDrawGhostActor(repoX, truckAwake?repoY:repoY+8, 'REPO', truckAwake?'scared':'normal', rscl, frame, phase==='chase');
          }

          // Zzz particles
          for (const z of zzz) {
            ctx.save(); ctx.globalAlpha=z.alpha;
            ctx.fillStyle='#aaccff';
            ctx.font=`${z.sz}px 'Press Start 2P', monospace`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(z.c, z.x, z.y);
            ctx.restore();
          }

          // Dialogs — speaker-anchored bubbles above each character
          if (phase==='dialog') {
            const d = DIALOGS[dialogIdx];
            if (d) {
              const shown = d.text.substring(0, ilCharsToShow(charTimer,2));
              if (shown.length>0) {
                if (d.who==='REPO') {
                  // REPO is left-of-center; bubble centered above REPO, 'bl' tail down-left
                  const bw = 240;
                  const bx = Math.max(8, Math.min(CW - bw - 8, repoX - bw / 2 + 10));
                  const by = Math.max(25, repoY - 108);
                  ilBubble(bx, by, shown, 'bl', bw,
                    { bg:'#fff0e0', border:'#e67e22', fs:7 });
                } else {
                  // TRUCK — bubble centered above truck, 'bl' tail down-left
                  const isBig = d.special==='honk';
                  const bw = isBig ? 200 : 80;
                  const bx = Math.max(8, Math.min(CW - bw - 8, truckX - bw / 2));
                  const by = Math.max(25, truckY - 95);
                  ilBubble(bx, by, shown, 'bl', bw,
                    isBig ? { bg:'#ff4400', color:'#fff', border:'#aa2200', fs:11, glow:true, glowC:'#ff6600' }
                          : { bg:'#e8f4ff', fs:22 });
                }
              }
            }
          }

          // Escape card
          if (escAlpha > 0) {
            ctx.save(); ctx.globalAlpha=escAlpha;
            ctx.fillStyle='rgba(0,0,0,0.82)'; ctx.fillRect(CW/2-132,CH/2-44,264,88);
            ctx.strokeStyle='#FFD700'; ctx.lineWidth=3;
            glow('#FFD700',14); ctx.strokeRect(CW/2-132,CH/2-44,264,88); noGlow();
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillStyle='#FFD700'; ctx.font="9px 'Press Start 2P', monospace";
            ctx.fillText('REPO MAN DEFEATED', CW/2, CH/2-18);
            ctx.fillStyle='#88ff88'; ctx.font="7px 'Press Start 2P', monospace";
            ctx.fillText('+500 XP  +$200 SURVIVAL BONUS', CW/2, CH/2+8);
            ctx.fillStyle='#888'; ctx.font="5px 'Press Start 2P', monospace";
            ctx.fillText('"You still owe 7 more payments tho"', CW/2, CH/2+28);
            ctx.restore();
          }

          ilTitleCard('LEVEL 8 COMPLETE', '"MIDNIGHT REPO"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 5 — "10,000 MILES"  (after level 10 → 11)
    //  Ph1: Truck pulls into a neon-lit truck stop at night.
    //  The odometer rolls to 10,000 one digit at a time, then the
    //  roof sign lights up and confetti rains gold.
    //  No antagonist — pure milestone celebration.
    // ================================================================
    function makeInterlude5() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1, phaseT = 0;
      // Truck starts off-canvas left, parks at ~35% from left
      let truckX = -160;
      const PARK_X   = CW * 0.34;
      const truckY   = CH * 0.69;
      let wheelT     = 0;
      // Odometer: counts from START_ODO to 10000
      const TARGET_ODO = 10000;
      const START_ODO  = 9981;
      let odoValue     = START_ODO;
      let odoAlpha     = 0;       // fade-in for the odometer panel
      let odoFlash     = 0;       // bright flash when target is reached
      // Celebration particles  { x, y, vx, vy, color, life, maxLife, size }
      let confetti = [];
      // Sign on roof of canopy: letter-by-letter reveal
      let signChars = 0;
      const SIGN_TEXT = '10,000 MILES!';
      let signAlpha = 0;
      // Sound flags
      const sfxFired = {};
      let _done = false;

      // SFX helpers ───────────────────────────────────────────────────
      function sfxOdoClick() {
        const ac = getAC(); if (!ac) return;
        burst(ac, 'square', 880, 0.08, 0.04);
      }
      function sfxOdoFanfare() {
        const ac = getAC(); if (!ac) return;
        // Rising arpeggio then triumphant chord
        [392,494,587,740,988].forEach((f,i) =>
          burst(ac, 'square',   f, 0.13, 0.13, i * 0.07));
        [784,988,1175].forEach((f,i) =>
          burst(ac, 'triangle', f, 0.11, 0.38, 0.40 + i * 0.02));
      }
      function sfxEngineOff() {
        const ac = getAC(); if (!ac) return;
        [180,140,100,70,45].forEach((f,i) =>
          burst(ac, 'sawtooth', f, 0.28 - i*0.04, 0.14, i*0.10));
      }

      // Confetti burst ────────────────────────────────────────────────
      function burstConfetti(n) {
        const cols = ['#FFD700','#FF6600','#00FF88','#FF44AA','#44DDFF','#FFFF44'];
        for (let i = 0; i < n; i++) {
          confetti.push({
            x:   CW * 0.28 + (Math.random()-0.5) * 260,
            y:   CH * 0.40 + Math.random() * 60,
            vx:  (Math.random()-0.5) * 7,
            vy:  -(Math.random() * 9 + 3),
            color: cols[Math.floor(Math.random()*cols.length)],
            life: 1, maxLife: 1,
            size: 3 + Math.random() * 5,
            spin: Math.random() * Math.PI * 2,
            vspin: (Math.random()-0.5) * 0.22,
          });
        }
      }

      // Draw gas station environment ──────────────────────────────────
      function drawGasStation() {
        // Ground pad (concrete apron under canopy)
        ctx.fillStyle = '#1c1c2a';
        ctx.fillRect(CW*0.05, CH*0.73, CW*0.62, CH*0.22);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        // concrete grid lines
        for (let gx = CW*0.05; gx < CW*0.67; gx += 40) {
          ctx.beginPath(); ctx.moveTo(gx, CH*0.73); ctx.lineTo(gx, CH*0.95); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(CW*0.05, CH*0.84); ctx.lineTo(CW*0.67, CH*0.84); ctx.stroke();

        // Canopy structure
        const capY = CH * 0.28;
        const capH = 18;
        const capX = CW * 0.07;
        const capW = CW * 0.58;
        // Canopy fascia (front beam with glow)
        ctx.fillStyle = '#0a0a18';
        ctx.fillRect(capX, capY, capW, capH);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
        glow('#FFAA00', 8);
        ctx.strokeRect(capX, capY, capW, capH);
        noGlow();
        // Canopy roof
        ctx.fillStyle = '#0d0d22';
        ctx.fillRect(capX - 6, capY - 12, capW + 12, 14);

        // Support columns (4)
        [0.12, 0.26, 0.44, 0.57].forEach(frac => {
          const cx2 = CW * frac;
          ctx.fillStyle = '#181828';
          ctx.fillRect(cx2 - 5, capY + capH, 10, CH * 0.73 - capY - capH);
          ctx.strokeStyle = 'rgba(255,215,0,0.25)'; ctx.lineWidth = 0.5;
          ctx.strokeRect(cx2 - 5, capY + capH, 10, CH * 0.73 - capY - capH);
        });

        // Gas pumps (two)
        [[CW*0.14, CH*0.57], [CW*0.50, CH*0.57]].forEach(([px, py]) => {
          // Body
          ctx.fillStyle = '#141426';
          ctx.fillRect(px-14, py, 28, 52);
          ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 0.8;
          glow('#FFAA00', 4);
          ctx.strokeRect(px-14, py, 28, 52);
          noGlow();
          // Screen
          ctx.fillStyle = '#001a00';
          ctx.fillRect(px-10, py+6, 20, 14);
          const priceFlash = 0.6 + 0.4 * Math.sin(frame * 0.12);
          ctx.fillStyle = `rgba(0,255,80,${priceFlash})`;
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('$4.89', px, py+13);
          // Nozzle
          ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px+14, py+28);
          ctx.lineTo(px+24, py+28);
          ctx.lineTo(px+24, py+38);
          ctx.stroke();
          // LED strip at base
          const ledA = 0.4 + 0.4 * Math.sin(frame * 0.09 + px);
          ctx.fillStyle = `rgba(255,215,0,${ledA})`;
          ctx.fillRect(px-12, py+48, 24, 2);
        });

        // Canopy neon sign (letter-by-letter reveal in 'fanfare' phase)
        if (signChars > 0) {
          const shown = SIGN_TEXT.substring(0, signChars);
          ctx.save();
          ctx.globalAlpha = signAlpha;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '10px "Press Start 2P", monospace';
          glow('#FFD700', 14 * signAlpha);
          ctx.fillStyle = '#FFD700';
          ctx.fillText(shown, CW * 0.36, capY + capH/2 + 1);
          noGlow();
          ctx.restore();
        }

        // Ambient under-canopy glow on concrete
        const ambA = 0.07 + 0.03 * Math.sin(frame * 0.06);
        ctx.fillStyle = `rgba(255,215,0,${ambA})`;
        ctx.fillRect(capX, CH*0.73, capW, CH*0.15);
      }

      // Draw odometer panel ───────────────────────────────────────────
      function drawOdometer() {
        if (odoAlpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = odoAlpha;

        const pw = 280, ph = 76;
        const px = (CW - pw) / 2;
        const py = CH * 0.78;

        // Panel shadow
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px+4, py+4, pw, ph);

        // Panel body
        ctx.fillStyle = '#060610';
        ctx.fillRect(px, py, pw, ph);
        // Border
        const borderC = odoValue >= TARGET_ODO ? '#FFD700' : '#555577';
        ctx.strokeStyle = borderC; ctx.lineWidth = 2;
        if (odoValue >= TARGET_ODO) { glow('#FFD700', 12 + odoFlash * 8); }
        ctx.strokeRect(px+1, py+1, pw-2, ph-2);
        noGlow();

        // Label
        ctx.fillStyle = 'rgba(255,215,0,0.5)';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('TOTAL MILES HAULED', CW/2, py + 8);

        // Individual digit boxes  ─────────────────────────────────────
        const digits = String(odoValue).padStart(6, '0').split('');
        const dw = 34, dh = 40, dgap = 4;
        const totalW = digits.length * dw + (digits.length - 1) * dgap;
        const startX = (CW - totalW) / 2;

        digits.forEach((d, i) => {
          const dx = startX + i * (dw + dgap);
          const dy = py + 22;
          // Digit box
          const isChanging = odoValue < TARGET_ODO && i >= 2;
          ctx.fillStyle = isChanging ? '#0a0a00' : '#000008';
          ctx.fillRect(dx, dy, dw, dh);
          ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 0.8;
          ctx.strokeRect(dx, dy, dw, dh);
          // Top highlight line (LCD bevel)
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.moveTo(dx+1, dy+1); ctx.lineTo(dx+dw-1, dy+1); ctx.stroke();
          // Digit character
          const bright = odoValue >= TARGET_ODO
            ? `rgba(255,215,0,${0.9 + odoFlash * 0.1})`
            : (isChanging ? '#FFDD44' : 'rgba(200,200,255,0.85)');
          glow(bright, odoValue >= TARGET_ODO ? 8 + odoFlash * 4 : 0);
          ctx.fillStyle = bright;
          ctx.font = 'bold 22px "Press Start 2P", monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(d, dx + dw/2, dy + dh/2 + 1);
          noGlow();
        });

        ctx.restore();
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },

        update() {
          phaseT++;

          // ── fadein ────────────────────────────────────────────────
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.045);
            if (phaseT > 65) { phase = 'title'; phaseT = 0; }

          // ── title card visible ───────────────────────────────────
          } else if (phase === 'title') {
            if (phaseT > 90) titleAlpha = Math.max(0, titleAlpha - 0.055);
            if (titleAlpha <= 0) { phase = 'drive'; phaseT = 0; }

          // ── truck drives in from left ────────────────────────────
          } else if (phase === 'drive') {
            const speed = truckX < PARK_X - 80 ? 5.5 : Math.max(0.6, 5.5 * (PARK_X - truckX) / 80);
            truckX = Math.min(PARK_X, truckX + speed);
            wheelT += speed * 0.9;
            if (truckX >= PARK_X) {
              phase = 'park'; phaseT = 0;
              if (!sfxFired.engine) { sfxEngineOff(); sfxFired.engine = true; }
            }

          // ── truck settles, odometer drops in ────────────────────
          } else if (phase === 'park') {
            odoAlpha = Math.min(1, odoAlpha + 0.055);
            if (phaseT > 55) { phase = 'count'; phaseT = 0; }

          // ── odometer counts up to 10,000 ────────────────────────
          } else if (phase === 'count') {
            // One digit per ~8 frames, with a click SFX each flip
            if (phaseT % 8 === 0 && odoValue < TARGET_ODO) {
              odoValue++;
              sfxOdoClick();
            }
            if (odoValue >= TARGET_ODO && !sfxFired.fanfare) {
              sfxOdoFanfare();
              sfxFired.fanfare = true;
              burstConfetti(80);
              phase = 'fanfare'; phaseT = 0;
            }

          // ── celebration ──────────────────────────────────────────
          } else if (phase === 'fanfare') {
            // Odometer flash pulses
            odoFlash = Math.sin(phaseT * 0.20) * 0.5 + 0.5;
            // Sign lights up letter by letter
            if (phaseT % 6 === 0 && signChars < SIGN_TEXT.length) signChars++;
            signAlpha = Math.min(1, signAlpha + 0.06);
            // Hold, then done
            if (phaseT > 220) { phase = 'done'; _done = true; }
          }

          // Update confetti every active frame
          for (let i = confetti.length - 1; i >= 0; i--) {
            const p = confetti[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.28;   // gravity
            p.vx *= 0.98;   // drag
            p.spin += p.vspin;
            p.life -= 0.008;
            if (p.life <= 0 || p.y > CH + 20) confetti.splice(i, 1);
          }
        },

        render() {
          // Night-sky background (re-use ilDrawBackground with night=true)
          ilDrawBackground(-wheelT * 2, true);

          // Gas station environment
          drawGasStation();

          // Confetti above truck and sign
          for (const p of confetti) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life * 1.8);
            ctx.translate(p.x, p.y); ctx.rotate(p.spin);
            ctx.fillStyle = p.color;
            // alternate rectangles and diamonds for variety
            if (confetti.indexOf(p) % 2 === 0) {
              ctx.fillRect(-p.size/2, -p.size/3, p.size, p.size*0.6);
            } else {
              ctx.beginPath();
              ctx.moveTo(0, -p.size/2); ctx.lineTo(p.size/2, 0);
              ctx.lineTo(0, p.size/2);  ctx.lineTo(-p.size/2, 0);
              ctx.closePath(); ctx.fill();
            }
            ctx.restore();
          }

          // Truck (parked, facing right, no wheel rotation once stopped)
          const rolling = phase === 'drive';
          ilDrawTruck(truckX, truckY, 1, phase === 'fanfare' ? 'happy' : 'normal', rolling ? wheelT : 0);

          // Odometer panel
          drawOdometer();

          // Title card (fades out after 'title' phase)
          ilTitleCard('LEVEL 10 COMPLETE', '"10,000 MILES"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  PHASE 3 — CEREMONY + NEWSPAPER CANVAS FUNCTIONS
    // ================================================================

    // ── Confetti spawner ──────────────────────────────────────────────
    function spawnCeremonyConfetti(n) {
      const cols = ['#FFD700','#FF6600','#00FF88','#FF44AA','#44DDFF','#FFFF44','#FF8844','#AAFFAA'];
      for (let i = 0; i < n; i++) {
        ceremonyConfetti.push({
          x:     CW * 0.1 + Math.random() * CW * 0.8,
          y:     HUD_H + Math.random() * 80,
          vx:    (Math.random() - 0.5) * 9,
          vy:    -(Math.random() * 11 + 4),
          color: cols[Math.floor(Math.random() * cols.length)],
          life:  1, maxLife: 1,
          size:  3 + Math.random() * 5,
          spin:  Math.random() * Math.PI * 2,
          vspin: (Math.random() - 0.5) * 0.22,
          rect:  Math.random() > 0.5,   // true = rectangle, false = diamond
        });
      }
    }

    // ── drawCeremony() ────────────────────────────────────────────────
    // Reads ceremonyTimer (0→360) to drive a four-beat animation:
    //   0-40:   fade in from black
    //  40-130:  truck drives onto spotlight, title writes in
    // 130-260:  stats panel rises, confetti falls
    // 260-360:  hold — "TAP FOR NEWSPAPER" blinks
    function drawCeremony() {
      const t = ceremonyTimer;

      // ── Background ──────────────────────────────────────────────────
      ctx.fillStyle = '#030310';
      ctx.fillRect(0, 0, CW, CH);

      // Stars (same seeded pattern as attract screen atmosphere)
      for (let i = 0; i < 60; i++) {
        const sx = (i * 181.7 + 22) % CW;
        const sy = (i * 97.3  + 11) % (CH * 0.85);
        const br = Math.sin(frame * 0.012 + i) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255,255,220,${br * 0.5})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Fade in
      const fadeAlpha = Math.min(1, t / 40);

      // ── Spotlight on truck ──────────────────────────────────────────
      if (t > 30) {
        const spotA = Math.min(0.55, (t - 30) / 40 * 0.55);
        const grad = ctx.createRadialGradient(CW * 0.5, CH * 0.65, 10, CW * 0.5, CH * 0.65, 200);
        grad.addColorStop(0,   `rgba(255,240,180,${spotA})`);
        grad.addColorStop(0.5, `rgba(255,210,80,${spotA * 0.35})`);
        grad.addColorStop(1,   'rgba(255,180,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CW, CH);
      }

      // ── Truck on pedestal ───────────────────────────────────────────
      if (t > 35) {
        const truckReveal = Math.min(1, (t - 35) / 30);
        // Pedestal
        ctx.save();
        ctx.globalAlpha = truckReveal;
        ctx.fillStyle = '#1a1428';
        ctx.fillRect(CW * 0.28, CH * 0.63, CW * 0.44, 16);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
        glow('#FFD700', 8);
        ctx.strokeRect(CW * 0.28, CH * 0.63, CW * 0.44, 16);
        noGlow();

        // Tiny trophy cups either side
        [[CW * 0.24, CH * 0.595], [CW * 0.76, CH * 0.595]].forEach(([tx, ty]) => {
          ctx.fillStyle = '#FFD700';
          ctx.fillRect(tx - 8, ty, 16, 18);
          ctx.fillRect(tx - 12, ty - 5, 24, 7);
          ctx.fillRect(tx - 4, ty + 18, 8, 6);
        });

        ctx.restore();

        // Truck centered on pedestal
        ctx.save();
        ctx.globalAlpha = truckReveal;
        const truckScale = 0.92;
        ctx.translate(CW * 0.5, CH * 0.62);
        ctx.scale(truckScale, truckScale);
        ctx.translate(-CW * 0.5, -CH * 0.62);
        ilDrawTruck(CW * 0.5, CH * 0.62, 1, 'happy', 0);
        ctx.restore();
      }

      // ── LEGEND HAUL COMPLETE title ──────────────────────────────────
      if (t > 60) {
        const titleT  = Math.min(1, (t - 60) / 50);
        const line1   = 'LEGEND HAUL';
        const line2   = 'COMPLETE!';
        const shown1  = line1.substring(0, Math.floor(titleT * (line1.length + line2.length + 3)));
        const shown2  = shown1.length > line1.length
          ? line2.substring(0, shown1.length - line1.length - 1)
          : '';
        const pulse   = 0.75 + 0.25 * Math.sin(frame * 0.12);

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        // Shadow layers
        ctx.save();
        ctx.globalAlpha = 0.4 * titleT;
        ctx.fillStyle = '#000';
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText(shown1.substring(0, line1.length), CW / 2 + 3, CH * 0.24 + 3);
        if (shown2) ctx.fillText(shown2, CW / 2 + 3, CH * 0.24 + 24);
        ctx.restore();

        glow('#FFD700', 16 * pulse * titleT);
        ctx.fillStyle = `rgba(255,215,0,${titleT})`;
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillText(shown1.substring(0, line1.length), CW / 2, CH * 0.24);
        if (shown2) ctx.fillText(shown2, CW / 2, CH * 0.24 + 24);
        noGlow();
      }

      // ── Stats panel ─────────────────────────────────────────────────
      if (t > 130) {
        const panelT = Math.min(1, (t - 130) / 50);
        const slideY = (1 - panelT) * 60;   // slides up from below

        const pw = 288, ph = 90;
        const px = (CW - pw) / 2;
        const py = CH * 0.70 + slideY;

        ctx.save();
        ctx.globalAlpha = panelT;

        ctx.fillStyle = 'rgba(0,0,12,0.88)';
        ctx.fillRect(px, py, pw, ph);
        glow('#FFD700', 8 * panelT);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        noGlow();

        const cols4 = [
          { label: 'SCORE',    val: formatScore(score)     },
          { label: 'GHOSTS',   val: statGhostsEaten.toString() },
          { label: 'PELLETS',  val: statPelletsEaten.toString() },
          { label: 'LEVELS',   val: statLevelsCleared.toString() },
        ];
        const cw4 = pw / 4;
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        cols4.forEach(({ label, val }, i) => {
          const cx4 = px + i * cw4 + cw4 / 2;
          ctx.fillStyle = 'rgba(255,215,0,0.50)';
          ctx.fillText(label, cx4, py + 24);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '7px "Press Start 2P", monospace';
          ctx.fillText(val, cx4, py + 44);
          ctx.font = '5px "Press Start 2P", monospace';
        });

        // "NEW RECORD" badge if hi-score was beaten this game
        if (hiScoreCelebTriggered) {
          ctx.fillStyle = '#00FF88';
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.fillText('✦ NEW RECORD ✦', CW / 2, py + 72);
        }

        ctx.restore();
      }

      // ── Confetti particles ──────────────────────────────────────────
      for (const p of ceremonyConfetti) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.translate(p.x, p.y); ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        if (p.rect) {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2); ctx.lineTo(p.size / 2, 0);
          ctx.lineTo(0,  p.size / 2); ctx.lineTo(-p.size / 2, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      // ── "TAP FOR NEWSPAPER" blink ───────────────────────────────────
      if (t > 260 && frame % 50 < 30) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (t - 260) / 30);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        glow('#FFD700', 8);
        ctx.fillStyle = '#FFD700';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText('TAP FOR YOUR NEWSPAPER', CW / 2, CH * 0.92);
        noGlow();
        ctx.restore();
      }

      // ── Gold border ─────────────────────────────────────────────────
      const bp = 0.6 + 0.4 * Math.sin(frame * 0.08);
      glow('#FFD700', 14 * bp * fadeAlpha);
      ctx.strokeStyle = `rgba(255,215,0,${bp * fadeAlpha * 0.8})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, CW - 6, CH - 6);
      noGlow();

      // ── Top bar ─────────────────────────────────────────────────────
      ctx.fillStyle = 'rgba(0,0,0,0.70)'; ctx.fillRect(0, 0, CW, 20);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFD700'; ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('— LEGEND HAUL COMPLETE —', CW / 2, 11);

      // Global fade-in
      ilFade(1 - fadeAlpha);
    }

    // ── drawNewspaper() ───────────────────────────────────────────────
    // Renders the FREIGHT NEWS newspaper layout, then on the first call
    // takes a canvas snapshot and pushes it to the JSX overlay via bridge.
    function drawNewspaper() {
      // Aged newsprint background
      ctx.fillStyle = '#f2ead8';
      ctx.fillRect(0, 0, CW, CH);

      // Subtle grain overlay (crosshatch pattern)
      ctx.strokeStyle = 'rgba(160,120,60,0.04)'; ctx.lineWidth = 0.5;
      for (let gy = 0; gy < CH; gy += 4) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
      }

      // ── Masthead ────────────────────────────────────────────────────
      const mhH = 72;
      ctx.fillStyle = '#1a0800';
      ctx.fillRect(0, 0, CW, mhH);

      // Decorative rule lines in masthead
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(CW - 8, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, mhH - 8); ctx.lineTo(CW - 8, mhH - 8); ctx.stroke();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      glow('#FFD700', 12);
      ctx.fillStyle = '#FFD700';
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText('FREIGHT NEWS', CW / 2, 36);
      noGlow();

      // Taglines flanking masthead
      ctx.fillStyle = 'rgba(255,215,0,0.55)';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'left';  ctx.fillText('EST. LOCAL RUN', 12, 54);
      ctx.textAlign = 'right'; ctx.fillText('PRICE: PRICELESS', CW - 12, 54);

      // ── Dateline ────────────────────────────────────────────────────
      const now   = new Date();
      const dateStr = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase();
      ctx.fillStyle = '#3a2000';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(dateStr, CW / 2, mhH + 10);

      // Full-width rule
      ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, mhH + 18); ctx.lineTo(CW - 8, mhH + 18); ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(8, mhH + 21); ctx.lineTo(CW - 8, mhH + 21); ctx.stroke();

      // ── Headline ────────────────────────────────────────────────────
      const hl1Y = mhH + 38;
      const hlLines = getNewsHeadline();
      ctx.fillStyle = '#1a0800';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      hlLines.forEach((ln, i) => ctx.fillText(ln, CW / 2, hl1Y + i * 16));

      // Sub-headline
      const subY = hl1Y + hlLines.length * 16 + 4;
      ctx.fillStyle = '#4a2800';
      ctx.font = '6px "Press Start 2P", monospace';
      const subLine = ghostEatenEver
        ? `OPERATOR EVADED ${statGhostsEaten} INSPECTORS IN ${statLevelsCleared} RUNS`
        : 'OPERATOR COMPLETED LEGEND HAUL WITHOUT EATING A SINGLE GHOST';
      // Wrap sub-headline
      const subLines = ilWrapText(subLine, CW - 40, 6);
      subLines.forEach((ln, i) => ctx.fillText(ln, CW / 2, subY + i * 12));

      const bodyStartY = subY + subLines.length * 12 + 8;

      // Full-width rule above body
      ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(8, bodyStartY); ctx.lineTo(CW - 8, bodyStartY); ctx.stroke();

      // ── Two-column body ──────────────────────────────────────────────
      const col1X = 12, col2X = CW / 2 + 6;
      const colW  = CW / 2 - 18;
      const bodyY = bodyStartY + 10;

      // Column divider
      ctx.strokeStyle = 'rgba(58,32,0,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(CW / 2, bodyStartY + 4);
      ctx.lineTo(CW / 2, CH - 50);
      ctx.stroke();

      // ── Left column: "DRIVER PROFILE" ───────────────────────────────
      ctx.fillStyle = '#1a0800';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('DRIVER PROFILE', col1X, bodyY);

      ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(col1X, bodyY + 8); ctx.lineTo(col1X + colW, bodyY + 8); ctx.stroke();

      const leftStats = [
        ['FINAL SCORE',   formatScore(score)],
        ['HI-SCORE',      formatScore(hiScore)],
        ['LEVELS CLEARED', statLevelsCleared.toString()],
        ['PELLETS EATEN', statPelletsEaten.toString()],
        ['GHOSTS CAUGHT', statGhostsEaten.toString()],
        ['BEST CHAIN',    statMaxChain > 0 ? '×' + Math.pow(2, statMaxChain - 1) : 'NONE'],
      ];
      ctx.font = '5px "Press Start 2P", monospace';
      leftStats.forEach(([label, val], i) => {
        const rowY = bodyY + 20 + i * 22;
        ctx.fillStyle = 'rgba(58,32,0,0.55)';
        ctx.fillText(label, col1X, rowY);
        ctx.fillStyle = '#1a0800';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText(val, col1X, rowY + 10);
        ctx.font = '5px "Press Start 2P", monospace';
        // Thin rule between rows
        ctx.strokeStyle = 'rgba(58,32,0,0.12)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(col1X, rowY + 18); ctx.lineTo(col1X + colW, rowY + 18); ctx.stroke();
      });

      // ── Right column: "GHOSTS WANTED" roster ────────────────────────
      ctx.fillStyle = '#1a0800';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('GHOSTS WANTED', col2X, bodyY);

      ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(col2X, bodyY + 8); ctx.lineTo(col2X + colW, bodyY + 8); ctx.stroke();

      const suspects = [
        { name:'DOT',    crime:'ROADSIDE HARASSMENT', status:'AT LARGE' },
        { name:'BROKER', crime:'LOWBALL RATE FRAUD',  status:'AT LARGE' },
        { name:'IRS',    crime:'AUDIT TERRORISM',     status:'AT LARGE' },
        { name:'REPO',   crime:'UNAUTHORIZED HOOKUP', status:'DEFEATED' },
      ];
      ctx.font = '5px "Press Start 2P", monospace';
      suspects.forEach((s, i) => {
        const rowY = bodyY + 20 + i * 32;
        // Name + box
        ctx.fillStyle = '#1a0800';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText(s.name, col2X, rowY + 4);
        // Crime
        ctx.fillStyle = 'rgba(58,32,0,0.6)';
        ctx.font = '4px "Press Start 2P", monospace';
        const crimeLines = ilWrapText(s.crime, colW - 4, 4);
        crimeLines.forEach((cl, ci) => ctx.fillText(cl, col2X, rowY + 13 + ci * 8));
        // Status badge
        const badgeColor = s.status === 'DEFEATED' ? '#006600' : '#880000';
        ctx.fillStyle = badgeColor;
        ctx.fillRect(col2X + colW - 50, rowY, 50, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = '4px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.status, col2X + colW - 25, rowY + 5);
        ctx.textAlign = 'left';
        // Row rule
        ctx.strokeStyle = 'rgba(58,32,0,0.12)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(col2X, rowY + 28); ctx.lineTo(col2X + colW, rowY + 28); ctx.stroke();
      });

      // ── Ph5: HALL OF FAME sidebar (below two-column body) ────────────
      const newsLb = loadLeaderboard();
      if (newsLb.length > 0) {
        const hofY = bodyStartY + 10 + 4 * 32 + 10;  // below ghosts-wanted rows

        // Section rule + header
        ctx.strokeStyle = '#3a2000'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(8, hofY); ctx.lineTo(CW - 8, hofY); ctx.stroke();

        ctx.fillStyle = '#1a0800';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('HALL OF FAME', CW / 2, hofY + 6);

        ctx.strokeStyle = 'rgba(58,32,0,0.3)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(8, hofY + 18); ctx.lineTo(CW - 8, hofY + 18); ctx.stroke();

        // Five columns: rank · initials · score · level · night badge
        const hofRowH = 14;
        newsLb.slice(0, 5).forEach((entry, i) => {
          const ry = hofY + 22 + i * hofRowH;
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textBaseline = 'top';

          // Rank
          const medals = ['①','②','③','④','⑤'];
          ctx.fillStyle = i < 3 ? '#6a3000' : 'rgba(58,32,0,0.5)';
          ctx.textAlign = 'left';
          ctx.fillText(medals[i], 14, ry);

          // Initials
          ctx.fillStyle = '#1a0800';
          ctx.fillText((entry.initials || '???').padEnd(3,' ').substring(0,3), 34, ry);

          // Score
          ctx.textAlign = 'right';
          ctx.fillStyle = '#3a1000';
          ctx.fillText(formatScore(entry.score), CW / 2 + 50, ry);

          // Level badge
          const lv = entry.level || 1;
          const badgeInk = lv >= 13 ? '#880044' : lv >= 12 ? '#884400' : '#003366';
          ctx.fillStyle = badgeInk;
          ctx.fillText(`L${lv}`, CW - 30, ry);

          // Night shift star
          if (lv >= 13) {
            ctx.fillStyle = '#cc0044';
            ctx.textAlign = 'center';
            ctx.fillText('★', CW - 14, ry);
          }

          // Row rule
          if (i < newsLb.length - 1) {
            ctx.strokeStyle = 'rgba(58,32,0,0.08)'; ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(10, ry + hofRowH - 1);
            ctx.lineTo(CW - 10, ry + hofRowH - 1);
            ctx.stroke();
          }
        });
      }

      // ── Footer ───────────────────────────────────────────────────────
      ctx.fillStyle = '#1a0800';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(8, CH - 44); ctx.lineTo(CW - 8, CH - 44); ctx.stroke();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('BOX TRUCK BOSS OFFICIAL EDITION', CW / 2, CH - 32);
      ctx.fillStyle = 'rgba(58,32,0,0.6)';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText('SHARE THIS EDITION — THE ROAD NEVER ENDS', CW / 2, CH - 18);

      // ── Snapshot (fires once, guarded by newsSnapshotTaken) ──────────
      if (!newsSnapshotTaken) {
        newsSnapshotTaken = true;
        // canvas.toDataURL reads the current buffer synchronously.
        // We defer one microtask so the current draw call fully flushes.
        Promise.resolve().then(() => {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            if (gameInputRef.current) {
              gameInputRef.current.setNewsDataUrl(dataUrl);
              gameInputRef.current.setShowNews(true);
            }
          } catch (e) { /* CORS or security — overlay simply won't show */ }
        });
      }
    }

    // ── getNewsHeadline() ─────────────────────────────────────────────
    // Returns an array of 1-2 short strings for the newspaper headline,
    // chosen based on score tier and ghostEatenEver flag.
    function getNewsHeadline() {
      if (score >= 50000) return ['FREIGHT LEGEND', 'DESTROYS ALL RECORDS'];
      if (score >= 30000) return ['FREIGHT BOSS CRUSHES', 'LEGEND HAUL'];
      if (score >= 15000) return ['LOCAL OPERATOR', 'ACHIEVES LEGEND STATUS'];
      if (!ghostEatenEver) return ['PACIFIST DRIVER', 'COMPLETES LEGEND HAUL'];
      return ['ROOKIE COMPLETES', 'THE LEGEND HAUL'];
    }

    // ================================================================
    //  SCENE 6 — "THE COMPLIANCE ERROR"  (Kill Screen, after level 12→13)
    //  DOT's ancient computer overflows on violation #256.
    //  The maze corrupts, text glitches, ghosts lose their names.
    //  A loving tribute to Pac-Man's level 256 kill screen — but funny.
    // ================================================================
    // Perf: canvas pattern for kill screen scanlines — created once, reused
    let _killScreenPattern = null;

    function makeInterludeKillScreen() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1, phaseT = 0;
      let glitchLines = [];        // { y, width, offset, color }
      let corruptChars = [];       // { x, y, char, color, life }
      let systemMsgs = [];         // typewriter-style lines
      let msgIdx = 0, charTimer = 0, waitTimer = 0;
      let rebootAlpha = 0;
      let _done = false;
      const sfxFired = {};

      const MSGS = [
        '> INITIALIZING VIOLATION LOG...',
        '> VIOLATIONS PROCESSED: 255',
        '> PROCESSING VIOLATION #256...',
        '> ERROR: COUNTER OVERFLOW',
        '> BUFFER CORRUPT: 0xFF → 0x00',
        '> DOT.EXE HAS STOPPED WORKING',
        '> SYSTEM: TOO MANY VIOLATIONS',
        '> CONGRATULATIONS, YOU BROKE THE DOT.',
        '> NIGHT SHIFT PROTOCOL ENGAGED.',
      ];

      function sfxGlitch() {
        const ac = getAC(); if (!ac) return;
        [880,440,220,110,55].forEach((f,i) =>
          burst(ac,'sawtooth',f,0.18,0.06,i*0.04));
      }
      function sfxReboot() {
        const ac = getAC(); if (!ac) return;
        [220,330,440,587,740,880].forEach((f,i) =>
          burst(ac,'square',f,0.12,0.12,i*0.07));
        [880,1047,1319].forEach((f,i) =>
          burst(ac,'triangle',f,0.10,0.40,0.52+i*0.03));
      }
      function spawnGlitchLine() {
        const cols = ['#FF0000','#00FF00','#0000FF','#FF00FF','#00FFFF','#FFFF00'];
        glitchLines.push({
          y:      Math.random() * CH,
          width:  20 + Math.random() * (CW * 0.7),
          x:      Math.random() * CW * 0.3,
          color:  cols[Math.floor(Math.random()*cols.length)],
          alpha:  0.4 + Math.random() * 0.5,
          h:      1 + Math.floor(Math.random()*4),
        });
        if (glitchLines.length > 40) glitchLines.shift();
      }
      function spawnCorruptChar() {
        const chars = 'X#@!%&?0xFF∅ERROR404NULL□■▓░'.split('');
        const gcols = ['#FF4444','#44FF44','#4444FF','#FFFF44','#FF44FF','#44FFFF'];
        corruptChars.push({
          x:     Math.random() * CW,
          y:     Math.random() * CH,
          char:  chars[Math.floor(Math.random()*chars.length)],
          color: gcols[Math.floor(Math.random()*gcols.length)],
          life:  0.8 + Math.random() * 0.2,
          size:  6 + Math.floor(Math.random()*10),
        });
        if (corruptChars.length > 60) corruptChars.shift();
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.05);
            if (phaseT > 55) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 80) titleAlpha = Math.max(0, titleAlpha - 0.055);
            if (titleAlpha <= 0) { phase = 'terminal'; phaseT = 0; charTimer = 0; waitTimer = 0; }
          } else if (phase === 'terminal') {
            charTimer++;
            if (phaseT % 3 === 0) spawnGlitchLine();
            if (phaseT % 5 === 0) spawnCorruptChar();
            const msg = MSGS[msgIdx] || '';
            const maxC = msg.length * 2;
            if (charTimer >= maxC) {
              waitTimer++;
              const hold = msgIdx >= 3 ? 35 : 25;
              if (waitTimer > hold) {
                if (msgIdx < MSGS.length - 1) {
                  msgIdx++;
                  // After "DOT.EXE" line: glitch SFX
                  if (msgIdx === 6 && !sfxFired.glitch) { sfxGlitch(); sfxFired.glitch = true; }
                  systemMsgs.push(MSGS[msgIdx - 1]);
                  charTimer = 0; waitTimer = 0;
                } else {
                  systemMsgs.push(MSGS[MSGS.length - 1]);
                  phase = 'reboot'; phaseT = 0;
                  if (!sfxFired.reboot) { sfxReboot(); sfxFired.reboot = true; }
                }
              }
            }
            for (const c of corruptChars) c.life -= 0.012;
            corruptChars.filter(c => c.life > 0);
          } else if (phase === 'reboot') {
            rebootAlpha = Math.min(1, rebootAlpha + 0.03);
            if (phaseT % 2 === 0) spawnGlitchLine();
            if (rebootAlpha >= 1) { waitTimer++; if (waitTimer > 160) { phase = 'done'; _done = true; } }
          }
        },
        render() {
          // Dark terminal background
          ctx.fillStyle = '#000508';
          ctx.fillRect(0, 0, CW, CH);

          // Subtle scanlines — single pattern fill instead of 200 fillRect calls
          if (!_killScreenPattern) {
            const pat = document.createElement('canvas');
            pat.width = 1; pat.height = 3;
            const pc = pat.getContext('2d');
            pc.fillStyle = 'rgba(0,255,0,0.03)';
            pc.fillRect(0, 0, 1, 1);
            _killScreenPattern = ctx.createPattern(pat, 'repeat');
          }
          ctx.fillStyle = _killScreenPattern;
          ctx.fillRect(0, 0, CW, CH);

          // Glitch lines (random color bars)
          for (const gl of glitchLines) {
            ctx.save(); ctx.globalAlpha = gl.alpha * 0.6;
            ctx.fillStyle = gl.color;
            ctx.fillRect(gl.x, gl.y, gl.width, gl.h);
            ctx.restore();
          }

          // Corrupt characters scattered
          for (const cc of corruptChars) {
            if (cc.life <= 0) continue;
            ctx.save(); ctx.globalAlpha = cc.life;
            ctx.fillStyle = cc.color;
            ctx.font = `${cc.size}px "Press Start 2P", monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(cc.char, cc.x, cc.y);
            ctx.restore();
          }

          // Terminal text output
          if (phase === 'terminal' || phase === 'reboot') {
            const lineH = 14;
            const startY = 60;
            const maxVisible = Math.floor((CH * 0.72 - startY) / lineH);
            const visible = systemMsgs.slice(-maxVisible);

            visible.forEach((line, i) => {
              const isErr = line.includes('ERROR') || line.includes('CORRUPT') ||
                            line.includes('STOPPED') || line.includes('TOO MANY');
              ctx.fillStyle = isErr ? '#FF4444' : '#00FF44';
              ctx.font = '6px "Press Start 2P", monospace';
              ctx.textAlign = 'left'; ctx.textBaseline = 'top';
              ctx.fillText(line, 16, startY + i * lineH);
            });

            // Current line typewriter effect
            if (msgIdx < MSGS.length) {
              const cur = MSGS[msgIdx];
              const shown = cur.substring(0, Math.floor(charTimer / 2));
              const isErr = cur.includes('ERROR') || cur.includes('CORRUPT') ||
                            cur.includes('STOPPED') || cur.includes('TOO MANY');
              ctx.fillStyle = isErr ? '#FF8888' : '#88FF88';
              ctx.font = '6px "Press Start 2P", monospace';
              ctx.textAlign = 'left'; ctx.textBaseline = 'top';
              ctx.fillText(shown + (frame % 30 < 18 ? '█' : ''), 16,
                startY + Math.min(visible.length, maxVisible - 1) * lineH);
            }
          }

          // Reboot overlay
          if (rebootAlpha > 0 && phase === 'reboot') {
            ctx.save(); ctx.globalAlpha = rebootAlpha * 0.92;
            ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, CW, CH);
            ctx.globalAlpha = rebootAlpha;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            glow('#00FF44', 14 * rebootAlpha);
            ctx.fillStyle = '#00FF88';
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillText('NIGHT SHIFT PROTOCOL', CW/2, CH*0.40);
            ctx.fillText('ACTIVATED', CW/2, CH*0.40 + 20);
            noGlow();
            ctx.fillStyle = 'rgba(0,255,80,0.55)';
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.fillText('ghosts faster  ·  fright halved  ·  score x' +
              nightShiftMultiplier.toFixed(1), CW/2, CH*0.55);
            if (frame % 50 < 32) {
              ctx.fillStyle = 'rgba(0,255,80,0.45)';
              ctx.font = '5px "Press Start 2P", monospace';
              ctx.fillText('TAP TO CONTINUE', CW/2, CH*0.72);
            }
            ctx.restore();
          }

          ilTitleCard('LEGEND HAUL CLEARED', '"THE COMPLIANCE ERROR"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          if (phase !== 'reboot') ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 7 — "FMCSA NOTICE"  (Pacifist ending, after level 12→13)
    //  Played only if ghostEatenEver === false.
    //  The FMCSA finds you despite having zero confrontations.
    // ================================================================
    function makeInterludePacifist() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1, phaseT = 0;
      let docAlpha = 0, stampScale = 0, waitTimer = 0;
      let _done = false;
      const sfxFired = {};

      function sfxStamp() {
        const ac = getAC(); if (!ac) return;
        burst(ac, 'sawtooth', 180, 0.45, 0.08);
        burst(ac, 'square',    90, 0.30, 0.12, 0.06);
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.05);
            if (phaseT > 55) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 85) titleAlpha = Math.max(0, titleAlpha - 0.055);
            if (titleAlpha <= 0) { phase = 'doc'; phaseT = 0; }
          } else if (phase === 'doc') {
            docAlpha = Math.min(1, docAlpha + 0.04);
            if (phaseT === 80 && !sfxFired.stamp) {
              sfxStamp(); sfxFired.stamp = true;
              sfxILSadTrombone();
            }
            if (phaseT > 80) stampScale = Math.min(1, stampScale + 0.06);
            if (phaseT > 200) { phase = 'night'; phaseT = 0; }
          } else if (phase === 'night') {
            waitTimer++; if (waitTimer > 180) { phase = 'done'; _done = true; }
          }
        },
        render() {
          // Pale document background
          ctx.fillStyle = '#f5f0e8';
          ctx.fillRect(0, 0, CW, CH);

          // Subtle paper grain
          ctx.strokeStyle = 'rgba(160,130,80,0.04)'; ctx.lineWidth = 0.5;
          for (let gy = 0; gy < CH; gy += 5) {
            ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(CW,gy); ctx.stroke();
          }

          if (docAlpha > 0) {
            ctx.save(); ctx.globalAlpha = docAlpha;

            // Document card
            const dw = 340, dh = 340;
            const dx = (CW - dw) / 2, dy = (CH - dh) / 2 - 20;
            ctx.fillStyle = '#fffdf6';
            ctx.fillRect(dx, dy, dw, dh);
            ctx.strokeStyle = '#c8b89a'; ctx.lineWidth = 1.5;
            ctx.strokeRect(dx, dy, dw, dh);

            // Document header
            ctx.fillStyle = '#1a0000';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.fillText('FMCSA NOTICE OF ACTION', CW/2, dy + 16);

            // Horizontal rule
            ctx.strokeStyle = '#1a0000'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(dx+12, dy+32); ctx.lineTo(dx+dw-12, dy+32); ctx.stroke();

            // Body text lines
            const bodyLines = [
              'OPERATOR: BOX TRUCK BOSS',
              'RE: OPERATING AUTHORITY REVIEW',
              '',
              'Our records indicate you completed',
              'the LEGEND HAUL without a single',
              'ghost interaction.',
              '',
              'This is statistically impossible.',
              '',
              'We have therefore concluded that',
              'you must be hiding something.',
              '',
              'Your authority has been flagged',
              'for review. Effective immediately.',
            ];
            ctx.font = '5px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            bodyLines.forEach((line, i) => {
              ctx.fillStyle = line === '' ? 'transparent' : '#3a1a00';
              ctx.fillText(line, dx + 16, dy + 44 + i * 16);
            });

            // Stamp
            if (stampScale > 0) {
              ctx.save();
              ctx.translate(dx + dw - 72, dy + dh - 72);
              ctx.rotate(-0.32);
              ctx.scale(stampScale, stampScale);
              ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 3;
              glow('#cc0000', 4);
              ctx.strokeRect(-44, -22, 88, 44);
              noGlow();
              ctx.fillStyle = '#cc0000';
              ctx.font = '9px "Press Start 2P", monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText('FLAGGED', 0, -5);
              ctx.font = '5px "Press Start 2P", monospace';
              ctx.fillText('CASE #0000000', 0, 10);
              ctx.restore();
            }

            ctx.restore();
          }

          // Night Shift entry card
          if (phase === 'night') {
            const na = Math.min(1, waitTimer / 30);
            ctx.save(); ctx.globalAlpha = na;
            ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0,0,CW,CH);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            glow('#00FF44', 12 * na);
            ctx.fillStyle = '#00FF88';
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillText('NIGHT SHIFT ACTIVATED', CW/2, CH*0.40);
            noGlow();
            ctx.fillStyle = 'rgba(0,255,80,0.55)';
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.fillText('ghosts faster  ·  fright halved  ·  score x' +
              nightShiftMultiplier.toFixed(1), CW/2, CH*0.54);
            ctx.fillStyle = 'rgba(200,200,200,0.55)';
            ctx.font = '5px "Press Start 2P", monospace';
            ctx.fillText('"They found you anyway."', CW/2, CH*0.65);
            if (frame % 50 < 32) {
              ctx.fillStyle = 'rgba(0,255,80,0.45)';
              ctx.fillText('TAP TO CONTINUE', CW/2, CH*0.78);
            }
            ctx.restore();
          }

          ilTitleCard('LEGEND HAUL CLEARED', '"FMCSA NOTICE"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          if (phase !== 'night') ilSkipPrompt();
        },
      };
    }

    // ================================================================
    //  SCENE 8 — "HOS VIOLATION"  (after level 14→15)
    //  DOT pulls the truck over for a Hours of Service check.
    //  Log book is suspiciously blank. FMCSA issues a violation.
    //  Brief — punchy comedy beat before Night Shift continues.
    // ================================================================
    function makeInterludeHOS() {
      let phase = 'fadein';
      let fadeIn = 0, titleAlpha = 1, phaseT = 0;
      let truckX = CW * 0.55, truckY = CH * 0.68;
      let dotX = CW + 40;   // DOT approaches from the right
      let logAlpha = 0, stampScale = 0, waitTimer = 0;
      let _done = false;
      const sfxFired = {};

      function sfxTicket() {
        const ac = getAC(); if (!ac) return;
        burst(ac, 'sawtooth', 220, 0.35, 0.07);
        burst(ac, 'square',   110, 0.22, 0.10, 0.06);
      }

      return {
        skip() { phase = 'done'; _done = true; },
        get done() { return _done; },
        update() {
          phaseT++;
          if (phase === 'fadein') {
            fadeIn = Math.min(1, fadeIn + 0.05);
            if (phaseT > 55) { phase = 'title'; phaseT = 0; }
          } else if (phase === 'title') {
            if (phaseT > 80) titleAlpha = Math.max(0, titleAlpha - 0.055);
            if (titleAlpha <= 0) { phase = 'approach'; phaseT = 0; }
          } else if (phase === 'approach') {
            dotX = Math.max(truckX + 55, dotX - 3.5);
            if (dotX <= truckX + 55) { phase = 'log'; phaseT = 0; }
          } else if (phase === 'log') {
            logAlpha = Math.min(1, logAlpha + 0.05);
            if (phaseT === 70 && !sfxFired.ticket) { sfxTicket(); sfxFired.ticket = true; }
            if (phaseT > 70) stampScale = Math.min(1, stampScale + 0.07);
            if (phaseT > 200) { phase = 'done'; _done = true; }
          }
        },
        render() {
          ilDrawBackground(0, nightShiftActive);

          // Truck parked
          ilDrawTruck(truckX, truckY, 1, 'scared', 0);

          // DOT ghost approaching
          if (phase === 'approach' || phase === 'log') {
            ilDrawGhostActor(dotX, truckY + 4, 'DOT', 'normal', 1.0, phaseT, true);
          }

          // Log book panel
          if (logAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = logAlpha;
            const lw = 220, lh = 130;
            const lx = (CW - lw) / 2, ly = CH * 0.22;
            // Book background
            ctx.fillStyle = '#f5f0e0';
            ctx.fillRect(lx, ly, lw, lh);
            ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 1.5;
            ctx.strokeRect(lx, ly, lw, lh);
            // Title
            ctx.fillStyle = '#1a0800';
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText('ELD LOGBOOK', CW/2, ly + 10);
            // Ruled lines
            ctx.strokeStyle = 'rgba(100,60,0,0.2)'; ctx.lineWidth = 0.5;
            for (let gy = ly + 28; gy < ly + lh - 10; gy += 14) {
              ctx.beginPath(); ctx.moveTo(lx+10, gy); ctx.lineTo(lx+lw-10, gy); ctx.stroke();
            }
            // Blank entries
            ctx.fillStyle = 'rgba(100,60,0,0.25)';
            ctx.font = '5px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ['DRIVER HRS:', 'REST PERIOD:', 'LAST STOP:', 'DUTY STATUS:']
              .forEach((lbl, i) => ctx.fillText(lbl, lx + 14, ly + 32 + i * 14));
            // Stamp
            if (stampScale > 0) {
              ctx.save();
              ctx.translate(lx + lw - 55, ly + lh - 42);
              ctx.rotate(-0.28);
              ctx.scale(stampScale, stampScale);
              ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 3;
              glow('#cc0000', 5);
              ctx.strokeRect(-38, -18, 76, 36);
              noGlow();
              ctx.fillStyle = '#cc0000';
              ctx.font = '8px "Press Start 2P", monospace';
              ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.fillText('VIOLATION', 0, -4);
              ctx.font = '5px "Press Start 2P", monospace';
              ctx.fillText('HOS §395.8', 0, 9);
              ctx.restore();
            }
            ctx.restore();
          }

          // Speech bubble from DOT
          if (phase === 'log' && phaseT > 30) {
            const shown = phaseT < 60
              ? '"LOGBOOK PLEASE."'
              : stampScale > 0.5
              ? '"COMPLETELY BLANK."'
              : '"LOGBOOK PLEASE."';
            ilBubble(dotX - 200, truckY - 90, shown, 'br', 190,
              { bg: '#fff8e8', border: '#ff8800', fs: 6 });
          }

          ilTitleCard('LEVEL 14 COMPLETE', '"HOS VIOLATION"', titleAlpha);
          ilFade(1 - fadeIn);
          ilTopBar();
          ilSkipPrompt();
        },
      };
    }

    // ── DISPATCH: drawIntermission() ──────────────────────────────────
    // Called each frame while gameState === GS.INTERMISSION.
    // Routes to currentInterlude.render() if a cinematic is active,
    // otherwise falls back to the original simple road-chase scene.
    function drawIntermission() {
      if (currentInterlude) {
        currentInterlude.render();
        return;
      }
      // ── Fallback: original Level 2→3 simple cutscene ─────────────
      const t = 1 - intermissionTimer / INTERMISSION_DUR;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CW, CH);
      const roadY = CH / 2;
      ctx.fillStyle = '#111120'; ctx.fillRect(0, roadY - 28, CW, 56);
      ctx.setLineDash([18, 14]);
      ctx.strokeStyle = 'rgba(255,215,0,0.2)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, roadY); ctx.lineTo(CW, roadY); ctx.stroke();
      ctx.setLineDash([]);
      const tx2 = -20 + t * (CW + 60), ty2 = roadY - 10;
      drawTruck(tx2, ty2, DIR.RIGHT, Math.abs(Math.sin(frame * 0.12)));
      const gx = tx2 - 80;
      const tripped = t > 0.55;
      if (!tripped) {
        ctx.save(); glow(C.gDot,10); ctx.fillStyle=C.gDot;
        ctx.beginPath(); ctx.arc(gx,ty2,7,0,Math.PI*2); ctx.fill(); noGlow();
        drawGhostEyes(gx,ty2-0.5,DIR.RIGHT,'#000088');
        ctx.font='9px sans-serif'; ctx.textAlign='center'; ctx.fillText('👮',gx,ty2+9);
        ctx.restore();
      } else {
        const sp = Math.min(1,(t-0.55)/0.25);
        ctx.save(); ctx.translate(gx,ty2); ctx.rotate(sp*Math.PI*4); ctx.scale(Math.max(0.2,1-sp*0.7),Math.max(0.2,1-sp*0.7));
        glow(C.gDot,14*(1-sp)); ctx.fillStyle=C.gDot;
        ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill(); noGlow(); ctx.restore();
      }
      const cA = t<0.1?t*10:(t>0.85?(1-t)*6.67:1);
      ctx.save(); ctx.globalAlpha=cA; ctx.textAlign='center'; ctx.textBaseline='middle';
      glow('#FFD700',10); ctx.fillStyle='#FFD700'; ctx.font='7px "Press Start 2P", monospace';
      ctx.fillText(tripped?'NICE TRY, DOT!':'LONG HAUL AHEAD...', CW/2, roadY+38); noGlow(); ctx.restore();
      if (frame%60<38) {
        ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#AAAAAA';
        ctx.font='5px "Press Start 2P", monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('TAP TO SKIP', CW/2, CH - 20); ctx.restore();
      }
    }

    // ── LEVEL BANNER ──────────────────────────────────────────────────
    // 12 unique names; getLevelName wraps with modulo so levels above 12
    // cycle back through the list rather than repeating "OVERDRIVE" forever.
    const LEVEL_NAMES = [
      'LOCAL RUN',      // 1
      'REGIONAL HAUL',  // 2
      'LONG HAUL',      // 3
      'CROSS COUNTRY',  // 4
      'OVERDRIVE',      // 5
      'FULL THROTTLE',  // 6
      'WHITE LINE',     // 7
      'IRON MILES',     // 8
      'GHOST ROUTE',    // 9
      'MIDNIGHT RUN',   // 10
      'NO SLEEP TIL',   // 11
      'LEGEND HAUL',    // 12
    ];
    function getLevelName(lv) {
      return LEVEL_NAMES[(lv - 1) % LEVEL_NAMES.length];
    }
    
    function drawLevelBanner() {
      ctx.fillStyle = 'rgba(0,0,8,0.72)';
      ctx.fillRect(0, HUD_H, CW, MAZE_H);
    
      const bw = 290, bh = 80;
      const bx = (CW - bw) / 2, by = HUD_H + MAZE_H/2 - bh/2;
    
      // Box
      ctx.fillStyle = 'rgba(2,4,20,0.95)';
      ctx.fillRect(bx, by, bw, bh);
      glow(C.textGold, 14);
      ctx.strokeStyle = C.textGold; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx+0.5, by+0.5, bw-1, bh-1);
      noGlow();
    
      // Level number
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lv = level;
      glow('#FFAA00', 16);
      ctx.fillStyle = C.textGold;
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText(`LEVEL ${lv}`, CW/2, by + bh * 0.35);
      noGlow();
    
      // Level name
      ctx.fillStyle = '#AACCFF';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(getLevelName(lv), CW/2, by + bh * 0.68);
    
      // Countdown bar (shrinks from full to empty)
      const barW = bw - 20;
      const barH = 4;
      const barX = bx + 10;
      const barY = by + bh - 10;
      const fill = (bannerTimer / BANNER_DUR) * barW;
      ctx.fillStyle = 'rgba(255,215,0,0.2)';
      ctx.fillRect(barX, barY, barW, barH);
      glow(C.textGold, 6);
      ctx.fillStyle = C.textGold;
      ctx.fillRect(barX, barY, fill, barH);
      noGlow();
    }
    
    // ── P6: INITIALS ENTRY SCREEN ─────────────────────────────────────
    function drawInitialsScreen() {
      ctx.fillStyle = 'rgba(0,0,5,0.92)';
      ctx.fillRect(0, HUD_H, CW, MAZE_H);

      const bw = 280, bh = 140;
      const bx = (CW - bw) / 2, by = HUD_H + MAZE_H / 2 - bh / 2 - 10;

      ctx.fillStyle = 'rgba(4,4,22,0.97)';
      ctx.fillRect(bx, by, bw, bh);
      glow(C.textGold, 14);
      ctx.strokeStyle = C.textGold; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      noGlow();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      // Header
      glow(C.textGold, 10);
      ctx.fillStyle = C.textGold;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('ENTER INITIALS', CW / 2, by + 18);
      noGlow();

      // Score reminder
      ctx.fillStyle = C.textDim;
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText('SCORE: ' + formatScore(score), CW / 2, by + 34);

      // Three letter slots
      const slotW = 36, slotH = 44, gap = 14;
      const totalW = 3 * slotW + 2 * gap;
      const startX = (CW - totalW) / 2;
      const slotY = by + 52;

      for (let i = 0; i < 3; i++) {
        const sx = startX + i * (slotW + gap);
        const isActive = i === initialsCursor;
        const pulseBright = isActive ? (0.7 + 0.3 * Math.sin(frame * 0.15)) : 0.3;

        // Slot background
        ctx.fillStyle = isActive
          ? `rgba(255,215,0,${0.12 * pulseBright})`
          : 'rgba(255,215,0,0.04)';
        ctx.fillRect(sx, slotY, slotW, slotH);

        // Slot border
        glow(isActive ? C.textGold : 'transparent', isActive ? 8 * pulseBright : 0);
        ctx.strokeStyle = isActive
          ? `rgba(255,215,0,${pulseBright})`
          : 'rgba(255,215,0,0.25)';
        ctx.lineWidth = isActive ? 1.5 : 0.8;
        ctx.strokeRect(sx + 0.5, slotY + 0.5, slotW - 1, slotH - 1);
        noGlow();

        // Character
        ctx.fillStyle = isActive ? '#FFFFFF' : 'rgba(255,215,0,0.7)';
        ctx.font = '18px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(INITIALS_CHARS[initialsChars[i]], sx + slotW / 2, slotY + slotH / 2 + 2);

        // Arrow hints on active slot
        if (isActive) {
          ctx.fillStyle = `rgba(255,215,0,${0.5 * pulseBright})`;
          ctx.font = '7px "Press Start 2P", monospace';
          ctx.fillText('▲', sx + slotW / 2, slotY - 6);
          ctx.fillText('▼', sx + slotW / 2, slotY + slotH + 8);
        }
      }

      // Instructions
      if (frame % 55 < 35) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('◀ ▶ MOVE    ▲ ▼ CHANGE', CW / 2, by + bh - 22);
        ctx.fillText('ENTER TO CONFIRM', CW / 2, by + bh - 10);
      }
    }

    // ── Ph5: IRS AUDIT GAG ────────────────────────────────────────────
    // Overlays on the initials screen for 3.5 s when nightShiftActive && score > 50000.
    // Fades in fast, holds, fades out. Player can still enter initials underneath.
    function drawIrsGag() {
      const t    = irsGagTimer / 210;          // 1→0 over 3.5 s
      const fade = t > 0.9 ? (1-t)*10 : t < 0.1 ? t*10 : 1;
      ctx.save();
      ctx.globalAlpha = fade * 0.93;

      // Dark scrim
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(0, HUD_H, CW, MAZE_H);

      // Audit notice card
      const cw = 300, ch = 150;
      const cx2 = (CW - cw) / 2, cy2 = HUD_H + (MAZE_H - ch) / 2 - 14;
      ctx.fillStyle = '#f5f0e0';
      ctx.fillRect(cx2, cy2, cw, ch);
      ctx.strokeStyle = '#cc0000'; ctx.lineWidth = 2;
      glow('#cc0000', 8 * fade);
      ctx.strokeRect(cx2 + 0.5, cy2 + 0.5, cw - 1, ch - 1);
      noGlow();

      // Header band
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(cx2, cy2, cw, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('IRS NOTICE OF AUDIT', CW / 2, cy2 + 11);

      // Body
      ctx.fillStyle = '#1a0800';
      ctx.font = '5px "Press Start 2P", monospace';
      const bodyLines = [
        `UNREPORTED INCOME: ${Math.round(score * 0.43).toLocaleString()} pts`,
        'NIGHT SHIFT EARNINGS NOT DECLARED.',
        'MULTIPLIER INCOME IS TAXABLE.',
        '',
        '"WE NOTICED THE SCORE."',
        '      — IRS Ghost Division',
      ];
      bodyLines.forEach((line, i) => {
        ctx.fillStyle = i === 3 ? 'transparent' : i >= 4 ? '#990000' : '#1a0800';
        ctx.fillText(line, CW / 2, cy2 + 36 + i * 14);
      });

      // Pulsing "AUDITED" stamp
      const sp = 0.7 + 0.3 * Math.sin(irsGagTimer * 0.18);
      ctx.save();
      ctx.translate(cx2 + cw - 52, cy2 + ch - 36);
      ctx.rotate(-0.26);
      ctx.strokeStyle = `rgba(180,0,0,${sp})`; ctx.lineWidth = 3;
      glow(`rgba(180,0,0,${sp})`, 6);
      ctx.strokeRect(-36, -16, 72, 32);
      noGlow();
      ctx.fillStyle = `rgba(180,0,0,${sp})`;
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('AUDITED', 0, 0);
      ctx.restore();

      ctx.restore();
    }

    // ── GAME OVER SCREEN ──────────────────────────────────────────────
    function drawGameOverScreen() {
      // Dark overlay over maze
      ctx.fillStyle = 'rgba(0,0,5,0.88)';
      ctx.fillRect(0, HUD_H, CW, MAZE_H);

      // Ph5: load leaderboard so we can size the box to fit it
      const lb = loadLeaderboard();
      const hasLb = lb.length > 0;
      const bw = 290, bh = hasLb ? 286 : 196;   // extra 90px for hall of fame
      const bx = (CW - bw) / 2, by = HUD_H + MAZE_H/2 - bh/2 - 6;

      // Box
      ctx.fillStyle = 'rgba(10,2,4,0.96)';
      ctx.fillRect(bx, by, bw, bh);
      glow('#FF0000', 16);
      ctx.strokeStyle = '#CC0000'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx+0.5, by+0.5, bw-1, bh-1);
      noGlow();

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      // "GAME OVER" pulsing red
      const pulse = 0.75 + 0.25 * Math.sin(frame * 0.08);
      glow('#FF0000', 20 * pulse);
      ctx.fillStyle = `rgb(255,${Math.floor(30 * pulse)},${Math.floor(30 * pulse)})`;
      ctx.font = '18px "Press Start 2P", monospace';
      ctx.fillText('GAME OVER', CW/2, by + 26);
      noGlow();

      // Final score + hi
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = C.textDim;
      ctx.fillText('SCORE', CW/2 - 60, by + 50);
      ctx.fillStyle = C.textGold;
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(formatScore(score), CW/2 - 60, by + 63);

      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = C.textDim;
      ctx.fillText('HI-SCORE', CW/2 + 60, by + 50);
      ctx.fillStyle = '#44FF88';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(formatScore(hiScore), CW/2 + 60, by + 63);

      // B10: Run stats row
      ctx.fillStyle = 'rgba(255,215,0,0.08)';
      ctx.fillRect(bx + 8, by + 78, bw - 16, 62);
      ctx.strokeStyle = 'rgba(255,215,0,0.15)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(bx + 8, by + 78, bw - 16, 62);

      const stats = [
        { label: 'GHOSTS',  val: statGhostsEaten.toString() },
        { label: 'MAX CHAIN', val: statMaxChain > 0 ? '×' + Math.pow(2, statMaxChain - 1) : '—' },
        { label: 'PELLETS', val: statPelletsEaten.toString() },
        { label: 'LEVELS',  val: statLevelsCleared.toString() },
      ];
      ctx.font = '6px "Press Start 2P", monospace';
      const colW = (bw - 16) / 4;
      stats.forEach(({ label, val }, i) => {
        const sx = bx + 8 + i * colW + colW / 2;
        ctx.fillStyle = 'rgba(255,215,0,0.45)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, sx, by + 91);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText(val, sx, by + 108);
        ctx.font = '6px "Press Start 2P", monospace';
      });

      // ── Ph5: HALL OF FAME leaderboard ────────────────────────────────
      if (hasLb) {
        const lbY = by + 148;
        // Section header
        ctx.fillStyle = 'rgba(255,215,0,0.12)';
        ctx.fillRect(bx + 8, lbY, bw - 16, 14);
        ctx.fillStyle = '#FFD700';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('HALL OF FAME', CW/2, lbY + 7);

        // Rows
        lb.slice(0, 5).forEach((entry, i) => {
          const rowY = lbY + 20 + i * 16;
          const isMe = entry.score === score && i === 0;
          // Highlight the player's own entry
          if (isMe) {
            ctx.fillStyle = 'rgba(255,215,0,0.10)';
            ctx.fillRect(bx + 8, rowY - 5, bw - 16, 14);
          }
          // Rank badge: gold/silver/bronze for top 3
          const rankColors = ['#FFD700','#AAAAAA','#CC8844','#888','#888'];
          ctx.fillStyle = rankColors[i];
          ctx.font = '5px "Press Start 2P", monospace';
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(`${i+1}.`, bx + 14, rowY + 2);

          // Initials
          const initStr = (entry.initials || '???').padEnd(3,' ').substring(0,3);
          ctx.fillStyle = isMe ? '#FFD700' : '#CCCCCC';
          ctx.fillText(initStr, bx + 30, rowY + 2);

          // Score
          ctx.textAlign = 'right';
          ctx.fillStyle = isMe ? '#FFD700' : '#AAAAAA';
          ctx.fillText(formatScore(entry.score), bx + bw - 50, rowY + 2);

          // Level badge
          const lv = entry.level || 1;
          const badgeC = lv >= 13 ? '#FF4488' : lv >= 12 ? '#FF8800' : '#4488FF';
          ctx.fillStyle = badgeC;
          ctx.textAlign = 'center';
          ctx.fillText(`L${lv}`, bx + bw - 24, rowY + 2);
        });
      }

      // Press space
      if (frame % 55 < 34) {
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS SPACE TO CONTINUE', CW/2, by + bh - 12);
      }
    }
    
    // ── P4: GHOST EATEN BURST ─────────────────────────────────────────
    // Fires 8 spark rays outward from the ghost's position in the ghost's colour.
    function spawnGhostBurst(px, py, color) {
      for (let i = 0; i < BURST_RAYS; i++) {
        const angle = (i / BURST_RAYS) * Math.PI * 2;
        ghostBursts.push({
          px, py,
          vx: Math.cos(angle) * BURST_SPEED,
          vy: Math.sin(angle) * BURST_SPEED,
          life: BURST_LIFE,
          maxLife: BURST_LIFE,
          color,
        });
      }
    }

    function updateGhostBursts() {
      for (let i = ghostBursts.length - 1; i >= 0; i--) {
        const p = ghostBursts[i];
        p.px   += p.vx;
        p.py   += p.vy;
        p.vx   *= 0.88;   // decelerate
        p.vy   *= 0.88;
        p.life--;
        if (p.life <= 0) ghostBursts.splice(i, 1);
      }
    }

    function drawGhostBursts() {
      if (ghostBursts.length === 0) return;
      ctx.save();
      // Perf: group particles by color so we set shadowColor once per group
      // instead of once per particle. Most bursts are a single color (one ghost).
      const byColor = new Map();
      for (const p of ghostBursts) {
        if (!byColor.has(p.color)) byColor.set(p.color, []);
        byColor.get(p.color).push(p);
      }
      for (const [color, particles] of byColor) {
        glow(color, 8);                  // one shadowBlur write per color group
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const p of particles) {
          const t = p.life / p.maxLife;
          ctx.globalAlpha = t * 0.9;
          const r = 3.5 * t;
          ctx.moveTo(p.px + r, p.py);
          ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        }
        ctx.fill();
        noGlow();
      }
      ctx.restore();
    }

    // ── P3: POWER PELLET FLASH + EXPANDING RING ───────────────────────
    // 2-frame full-canvas white flash + an expanding ring that fades out,
    // both centered on where the power pellet was eaten.
    function drawPowerFlash() {
      if (powerFlashTimer <= 0) return;
      const t = powerFlashTimer / POWER_FLASH_DUR;  // 1→0

      // Full-canvas white flash — only on the first 2 frames
      if (powerFlashTimer > POWER_FLASH_DUR - 2) {
        ctx.save();
        ctx.globalAlpha = 0.35 * t;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, HUD_H, CW, MAZE_H);
        ctx.restore();
      }

      // Expanding ring: starts tight, expands outward as timer falls.
      // Color matches the level theme's power pellet color (P6 dot color system).
      // Perf: _ringR/G/B/_ringGlow are pre-parsed by _updateGhostGlowCache() on
      // level change — no parseInt/slice on every frame here.
      const pr = _ringR, pg = _ringG, pb = _ringB;
      const ringGlow = _ringGlow;

      const progress  = 1 - t;                          // 0→1 as ring expands
      const radius    = 6 + progress * 48;              // 6px → 54px
      const alpha     = t * 0.85;                        // fades as it expands
      const lineWidth = 3 * t + 0.5;

      ctx.save();
      glow(ringGlow, 18 * t);
      ctx.strokeStyle = `rgba(${pr},${pg},${pb},${alpha})`;
      ctx.lineWidth   = lineWidth;
      ctx.beginPath();
      ctx.arc(powerFlashPos.px, powerFlashPos.py, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Second inner ring slightly behind for depth
      if (radius > 14) {
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.arc(powerFlashPos.px, powerFlashPos.py, radius - 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      noGlow();
      ctx.restore();
    }

    // ── P3: EXHAUST TRAIL ──────────────────────────────────────────────
    // 3–6 small fading smoke puffs emitted behind the truck each frame.
    // Particles shrink and fade as they age.
    function drawExhaustTrail() {
      if (exhaustTrail.length === 0) return;
      ctx.save();
      for (const p of exhaustTrail) {
        const t     = p.life / p.maxLife;    // 1→0
        const r     = 2.5 * t;
        const alpha = 0.45 * t;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = `rgba(180,130,60,1)`;
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── P3: TUNNEL TELEGRAPH ──────────────────────────────────────────
    // When the truck or any non-eaten ghost is inside the tunnel
    // (rows 13-14, cols < TUNNEL_COL_LO or > TUNNEL_COL_HI), flash a
    // pulsing arrow at the exit side to show where they'll emerge.
    // Drawn directly into the maze layer so it sits under the entities.
    function drawTunnelTelegraph() {
      // Check truck
      const truckInTunnel = TUNNEL_ROWS.has(truck.tileRow) &&
        (truck.tileCol < TUNNEL_COL_LO || truck.tileCol > TUNNEL_COL_HI);

      // Check any active ghost
      let ghostInTunnel = false;
      for (const g of ghosts) {
        if (g.state === GHOST_ST.EATEN || g.state === GHOST_ST.HOUSE) continue;
        if (TUNNEL_ROWS.has(g.tileRow) &&
            (g.tileCol < TUNNEL_COL_LO || g.tileCol > TUNNEL_COL_HI)) {
          ghostInTunnel = true;
          break;
        }
      }

      if (!truckInTunnel && !ghostInTunnel) return;

      const pulse = 0.55 + 0.45 * Math.sin(frame * 0.22);
      const alpha = 0.65 * pulse;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = '11px "Press Start 2P", monospace';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';

      // Left tunnel: entity going left → show » on right exit side
      // Right tunnel: entity going right → show « on left exit side
      // We show both exit arrows any time anything is in either tunnel —
      // simple and readable on a small mobile screen.
      const arrowColor = truckInTunnel ? '#FFD700' : '#FF8888';
      glow(arrowColor, 10 * pulse);
      ctx.fillStyle = arrowColor;

      for (const tunnelRow of [13, 14]) {
        const y = HUD_H + tunnelRow * TILE + TILE / 2;
        // Right exit (entity enters left tunnel → emerges right)
        ctx.fillText('»', (TUNNEL_COL_HI + 1) * TILE + TILE / 2, y);
        // Left exit (entity enters right tunnel → emerges left)
        ctx.fillText('«', (TUNNEL_COL_LO - 2) * TILE + TILE / 2, y);
      }
      noGlow();
      ctx.restore();
    }

    // ── DRAW PLAYER ───────────────────────────────────────────────────
    function drawPlayer() {
      if (!truck.alive) return;
      // Perf: use cached truck pixel position computed once per frame in gameLoop
      const px = _truckPx, py = _truckPy;

      // B6: safe zone tile indicator — faint outline on current tile
      ctx.save();
      const tileX = truck.tileCol * TILE;
      const tileY = HUD_H + truck.tileRow * TILE;
      ctx.strokeStyle = 'rgba(255,215,0,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tileX + 1, tileY + 1, TILE - 2, TILE - 2);
      ctx.restore();

      // B6: truck headlights — soft cone in direction of travel
      // Perf: was createRadialGradient() per frame (gradient object allocation).
      // Replaced with two cheap overlapping alpha fills — indistinguishable at game scale.
      if (truck.moving) {
        ctx.save();
        const [dr, dc] = DIR_VEC[truck.dir];
        const coneX = px + dc * 12;
        const coneY = py + dr * 12;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = 'rgba(255,235,160,1)';
        ctx.beginPath(); ctx.arc(coneX, coneY, 20, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = 'rgba(255,210,100,1)';
        ctx.beginPath(); ctx.arc(coneX + dc * 6, coneY + dr * 6, 28, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // Ground shadow
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.32)';
      ctx.beginPath(); ctx.ellipse(px+1,py+2,9,6,DIR_ROT[truck.dir],0,Math.PI*2);
      ctx.fill(); ctx.restore();

      const mouthT = truck.moving ? Math.abs(Math.sin(truck.mouthPhase*Math.PI/TILE)) : 0;

      // P3: Idle vibration — subtle 1px engine rumble when stationary
      // Skipped if user prefers reduced motion.
      let idleOffX = 0, idleOffY = 0;
      if (!truck.moving && !reducedMotionRef.current) {
        // Two overlapping sine waves at different frequencies = irregular rumble
        idleOffX = Math.round(Math.sin(frame * 1.7) * 0.6);
        idleOffY = Math.round(Math.sin(frame * 2.3 + 1.1) * 0.6);
      }
      drawTruck(px + idleOffX, py + idleOffY, truck.dir, mouthT);
    }
    
    // ================================================================
    //  MAIN RENDER  (B4: full state dispatch)
    // ================================================================
    function render() {
      ctx.clearRect(0, 0, CW, CH);
      ctx.imageSmoothingEnabled = false;   // re-assert each frame — some browsers reset on restore

      // B6: screen shake — translate canvas randomly while shakeTimer > 0
      // B9: skip shake entirely if user prefers reduced motion
      const shaking = shakeTimer > 0 && !reducedMotionRef.current;
      if (shaking) {
        const t = shakeTimer / SHAKE_DUR;            // 1→0 as shake fades
        const mag = SHAKE_MAG * t;
        const sx  = (Math.random() * 2 - 1) * mag;
        const sy  = (Math.random() * 2 - 1) * mag;
        ctx.save();
        ctx.translate(Math.round(sx), Math.round(sy));
      }
    
      switch (gameState) {
        // ── ATTRACT ─────────────────────────────────────────────────
        case GS.ATTRACT:
          drawAttractScreen();
          break;

        // ── LEVEL BANNER ─────────────────────────────────────────────
        case GS.LEVEL_BANNER:
          drawHUD();
          drawMaze();
          drawLevelBanner();
          break;

        // ── READY ────────────────────────────────────────────────────
        case GS.READY:
          drawHUD();
          drawMaze();
          drawContractItem();
          drawPlayer();
          drawGhosts();
          drawGhostIntros(); // B10
          drawReadyOverlay();
          break;

        // ── PLAYING ──────────────────────────────────────────────────
        case GS.PLAYING:
          drawHUD();
          drawMaze();
          drawContractItem();
          drawGhosts();
          drawGhostIntros(); // B10
          drawPlayer();
          drawExhaustTrail();   // P3
          drawPowerFlash();     // P3
          drawGhostBursts();    // P4
          drawFloatTexts();
          drawAchieveToasts();      // P5
          drawHiScoreCelebration(); // P5
          break;

        // ── GHOST EATEN FREEZE ───────────────────────────────────────
        case GS.GHOST_EATEN:
          drawHUD();
          drawMaze();
          drawContractItem();
          drawGhosts();
          drawGhostIntros();
          drawPlayer();
          drawExhaustTrail();   // P3 — trail lingers during freeze
          drawPowerFlash();     // P3
          drawGhostBursts();    // P4 — bursts animate during freeze
          drawFloatTexts();
          drawAchieveToasts();      // P5
          drawHiScoreCelebration(); // P5
          break;

        // ── DYING ────────────────────────────────────────────────────
        case GS.DYING:
          drawHUD();
          drawMaze();
          drawGhosts();
          drawGhostIntros(); // B10
          drawDeathAnimation();
          drawFloatTexts();
          break;

        // ── LEVEL COMPLETE ───────────────────────────────────────────
        case GS.LEVEL_COMPLETE:
          drawHUD();
          drawMaze();          // flash colours injected via getLevelFlashColor()
          drawPlayer();        // truck frozen on screen during flash
          break;

        // ── INTERMISSION ─────────────────────────────────────────────
        case GS.INTERMISSION:
          drawIntermission();  // P6: full-screen cutscene, no HUD
          break;

        // ── INITIALS ENTRY ───────────────────────────────────────────
        case GS.INITIALS:
          drawHUD();
          drawMaze();
          drawInitialsScreen();  // P6
          if (irsGagTimer > 0) drawIrsGag();  // Ph5: IRS audit overlay
          break;

        // ── GAME OVER ────────────────────────────────────────────────
        case GS.GAME_OVER:
          drawHUD();
          drawMaze();
          drawGameOverScreen();
          break;

        // ── PAUSED ───────────────────────────────────────────────────
        case GS.PAUSED:
          drawHUD();
          drawMaze();
          drawContractItem();
          drawGhosts();
          drawGhostIntros(); // B10
          drawPlayer();
          drawPauseOverlay();
          drawAchieveToasts();       // P5: toasts persist through pause
          drawHiScoreCelebration();  // P5: celebration persists through pause
          break;

        // ── BOSS LEVEL (Ph2) ─────────────────────────────────────────
        case GS.BOSS:
          drawBossHUD();           // red-tinted HUD with countdown bar
          drawMaze();              // standard maze (dots already cleared by enterBossLevel)
          drawContractItem();      // power pellets still collectible
          drawGhosts();
          drawGhostIntros();
          drawPlayer();
          drawExhaustTrail();
          drawPowerFlash();
          drawGhostBursts();
          drawFloatTexts();
          drawAchieveToasts();
          drawHiScoreCelebration();
          break;

        // ── VICTORY CEREMONY (Ph3 full cinematic) ────────────────────
        case GS.CEREMONY:
          drawCeremony();
          break;

        // ── FREIGHT NEWS NEWSPAPER (Ph3) ─────────────────────────────
        case GS.NEWSPAPER:
          drawNewspaper();
          break;
      }

      // B6: restore canvas after screen shake
      if (shaking) ctx.restore();
    }
    
    // ================================================================
    //  INPUT BRIDGE + JOYSTICK  (wired below)

    // Touch listeners need refs so we can remove them on unmount.
    // ── CANVAS SWIPE ────────────────────────────────────────────────
    // Keyboard (handleKeyDown) + swipe are the only input methods.
    let touchSX = 0, touchSY = 0;
    const MIN_SWIPE = 20;

    // ── iOS AUDIO UNLOCK ──────────────────────────────────────────────
    // iOS Safari / WKWebView requires AudioContext.resume() to be called
    // synchronously within a user gesture handler.  Lazy creation inside
    // getAC() (called from rAF) is too late.  We proactively unlock on the
    // very first touch/click so all subsequent sfx calls find a running context.
    // Safe to call multiple times — early-exits after first successful unlock.
    let audioUnlocked = false;
    function tryUnlockAudio() {
      if (audioUnlocked || mutedRef.current) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
          audioCtxRef.current.onstatechange = () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended')
              audioCtxRef.current.resume().catch(() => {});
          };
        }
        // This synchronous resume() call is what iOS recognises as gesture-gated
        if (audioCtxRef.current.state !== 'running') {
          audioCtxRef.current.resume().catch(() => {});
        }
        audioUnlocked = true;
      } catch(e) {}
    }

    // ── HUD button tap detection ──────────────────────────────────────
    // Converts a clientX/Y (from touch or mouse event) to logical canvas
    // coordinates, then checks if the point is inside a HUD button rect.
    // Returns true and fires the action if a button was hit.
    function getCanvasLogicalPoint(clientX, clientY) {
      const rect  = canvas.getBoundingClientRect();
      const scaleX = CW / rect.width;
      const scaleY = CH / rect.height;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }
    function checkHUDButtons(clientX, clientY) {
      const p = getCanvasLogicalPoint(clientX, clientY);
      if (p.x >= HUD_BTN_PAUSE.x && p.x <= HUD_BTN_PAUSE.x + HUD_BTN_PAUSE.w &&
          p.y >= HUD_BTN_PAUSE.y && p.y <= HUD_BTN_PAUSE.y + HUD_BTN_PAUSE.h) {
        tryUnlockAudio();
        if (gameState === GS.PLAYING) { gameState = GS.PAUSED; }
        else if (gameState === GS.PAUSED) { gameState = GS.PLAYING; }
        return true;
      }
      if (p.x >= HUD_BTN_QUIT.x && p.x <= HUD_BTN_QUIT.x + HUD_BTN_QUIT.w &&
          p.y >= HUD_BTN_QUIT.y && p.y <= HUD_BTN_QUIT.y + HUD_BTN_QUIT.h) {
        tryUnlockAudio();
        if (gameState === GS.PLAYING || gameState === GS.PAUSED) {
          gameState = GS.PAUSED;
          setShowExitConfirm(true);
        }
        return true;
      }
      return false;
    }

    function touchStart(e) {
      e.preventDefault();
      tryUnlockAudio();   // synchronous — must be first call in the handler
      touchSX = e.touches[0].clientX;
      touchSY = e.touches[0].clientY;
    }
    function touchMove(e) { e.preventDefault(); }
    // Centralised "player pressed something" handler used by both touch and click.
    // Keeps state transitions in one place so nothing is accidentally missed.
    function handlePlayerInput(swipeDir) {
      // P6: initials screen gets its own swipe logic
      if (gameState === GS.INITIALS) {
        if (swipeDir === DIR.LEFT)  initialsCursor = Math.max(0, initialsCursor - 1);
        if (swipeDir === DIR.RIGHT) initialsCursor = Math.min(2, initialsCursor + 1);
        if (swipeDir === DIR.UP)    initialsChars[initialsCursor] = (initialsChars[initialsCursor] + 1) % INITIALS_CHARS.length;
        if (swipeDir === DIR.DOWN)  initialsChars[initialsCursor] = (initialsChars[initialsCursor] - 1 + INITIALS_CHARS.length) % INITIALS_CHARS.length;
        if (swipeDir < 0) confirmInitials(); // tap = confirm
        return;
      }

      // Queue swipe direction for whenever gameplay resumes
      if (swipeDir >= 0) truck.nextDir = swipeDir;

      switch (gameState) {
        case GS.ATTRACT:
        case GS.GAME_OVER:
          beginNewGame();
          break;
        case GS.READY:
          startPlaying();
          break;
        case GS.PAUSED:
          // Mobile tap resumes the same way the P key does.
          // D-pad centre button also goes through this path.
          gameState = GS.PLAYING;
          break;
        // Tapping during a transition / animation is silently accepted as a
        // direction queue (already set above) — the state machine will pick it
        // up the moment it returns to PLAYING / READY.  No hard state jump so
        // animations always complete cleanly.
        case GS.DYING:
        case GS.LEVEL_BANNER:
        case GS.LEVEL_COMPLETE:
        case GS.INTERMISSION:
          // direction queued above; tap also skips active interlude
          if (gameState === GS.INTERMISSION) {
            if (currentInterlude) currentInterlude.skip(); else intermissionTimer = 0;
          }
          break;
        // Ph2: BOSS — tap/direction starts the truck moving after a respawn
        case GS.BOSS:
          truck.moving = true; truck.alive = true;
          break;
        // Ph3: CEREMONY auto-advances; NEWSPAPER advance wired in Phase 3
        case GS.CEREMONY:
          level++; advanceLevel();   // Ph2: tap advances past ceremony hold screen
          break;
        case GS.NEWSPAPER:
          setShowNewsRef.current(false); newsSnapshotTaken = false; level++; advanceLevel(); // Ph3
          break;
        default:
          break;
      }
    }

    function touchEnd(e) {
      e.preventDefault();
      const dx = e.changedTouches[0].clientX - touchSX;
      const dy = e.changedTouches[0].clientY - touchSY;
      if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) {
        // Tap — check HUD buttons first
        if (checkHUDButtons(e.changedTouches[0].clientX, e.changedTouches[0].clientY)) return;
        handlePlayerInput(-1);
        return;
      }
      const q = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
        : (dy > 0 ? DIR.DOWN  : DIR.UP);
      handlePlayerInput(q);
    }

    // Mouse click — same tap-to-start logic for desktop + audio unlock for desktop browsers
    function handleCanvasClick(e) {
      tryUnlockAudio();   // gesture-gated unlock for desktop browsers too
      if (checkHUDButtons(e.clientX, e.clientY)) return;
      handlePlayerInput(-1);
    }

    // Escape key → propagate to parent via onClose prop
    function handleEscape(e) {
      if (e.key === 'Escape' && onClose) onClose();
    }

    let rafId;
    // ── FRAME RATE CAP ────────────────────────────────────────────────
    // On 120Hz / 144Hz displays rAF fires every ~8ms instead of ~16ms,
    // which doubles movement speed and halves timer durations.
    // We cap to TARGET_FPS logical ticks regardless of display refresh rate.
    //
    // BATTERY SAVER: idle states (ATTRACT, GAME_OVER) drop to 30 fps.
    // Active gameplay stays at 60 fps.  The switch is instantaneous because
    // targetMs is evaluated fresh on every rAF callback.
    const TARGET_FPS      = 60;
    const FRAME_MS        = 1000 / TARGET_FPS;        // 16.667 ms  — gameplay
    const FRAME_MS_IDLE   = 1000 / 30;                // 33.333 ms  — attract/game-over
    let   lastFrameTime   = 0;

    function gameLoop(timestamp) {
      // Choose target interval based on current state
      const targetMs = (gameState === GS.ATTRACT || gameState === GS.GAME_OVER || gameState === GS.INITIALS)
        ? FRAME_MS_IDLE
        : FRAME_MS;
      // Skip this rAF callback if not enough time has elapsed.
      // Subtract 1 ms tolerance to absorb floating-point drift.
      if (timestamp - lastFrameTime < targetMs - 1) {
        rafId = requestAnimationFrame(gameLoop);
        return;
      }
      lastFrameTime = timestamp;
      frame++;
      // Perf: compute per-frame memoized values once here, read everywhere
      // _truckPx/_truckPy: getTruckPixelPos() is called 3-5x per frame — compute once
      // _flashPhase: Math.floor(frame/7)%2 used in drawGhost + drawGhosts — compute once
      {
        const [dr, dc] = DIR_VEC[truck.dir];
        _truckPx = truck.tileCol * TILE + TILE / 2 + dc * TILE * truck.progress;
        _truckPy = HUD_H + truck.tileRow * TILE + TILE / 2 + dr * TILE * truck.progress;
      }
      _flashPhase = Math.floor(frame / 7) % 2;
      // B6: tick timers every frame regardless of game state
      if (shakeTimer > 0)     shakeTimer--;
      if (doorFlashTimer > 0) doorFlashTimer--;

      switch (gameState) {
        case GS.PLAYING:
          updatePlayer(); updateGhosts(); checkGhostCollisions();
          // Tick contract item timer
          if (contractItem) {
            contractItem.timer--;
            if (contractItem.timer <= 0) contractItem = null; // expired
          }
          updateFloatTexts();
          updateSiren();    // B7: frightened siren
          updateWhines();   // B7: eaten-ghost return whines
          updateGhostIntros(); // B10: intro badge timers
          updateGhostBursts(); // P4: ghost eaten spark particles
          updateAchieveToasts(); // P5: achievement toasts + hi-score celeb timer
          // P3: power pellet flash countdown
          if (powerFlashTimer > 0) powerFlashTimer--;
          // P3: exhaust trail — emit one particle per frame when moving
          if (truck.moving && truck.alive) {
            const [dr, dc] = DIR_VEC[truck.dir];
            const tp = getTruckPixelPos();
            exhaustTrail.push({
              px: tp.px - dc * 9,   // behind the truck
              py: tp.py - dr * 9,
              life: EXHAUST_LIFE,
              maxLife: EXHAUST_LIFE,
            });
            // Cap trail length to avoid unbounded growth
            if (exhaustTrail.length > EXHAUST_MAX) exhaustTrail.shift();
          }
          // Tick existing exhaust particles
          for (let i = exhaustTrail.length - 1; i >= 0; i--) {
            exhaustTrail[i].life--;
            if (exhaustTrail[i].life <= 0) exhaustTrail.splice(i, 1);
          }
          break;

        // P3: Ghost eaten freeze frame — everything paused for GHOST_EATEN_DUR ticks
        case GS.GHOST_EATEN:
          ghostEatenTimer--;
          // Float texts still animate so the score pop feels alive during freeze
          updateFloatTexts();
          updateGhostBursts(); // P4: bursts continue through freeze
          updateAchieveToasts(); // P5
          // Power flash ring continues expanding through the freeze
          if (powerFlashTimer > 0) powerFlashTimer--;
          if (ghostEatenTimer <= 0) gameState = GS.PLAYING;
          break;
        case GS.DYING:
          updateFloatTexts();
          deathTimer++;
          if (deathTimer >= DEATH_ANIM_DUR) afterDeath();
          break;
        case GS.LEVEL_COMPLETE:
          lvlCompleteTimer--;
          if (lvlCompleteTimer <= 0) advanceLevel();
          break;
        case GS.INTERMISSION:
          // Drive cinematic interlude if one is active; otherwise use legacy timer
          if (currentInterlude) {
            currentInterlude.update();
            if (currentInterlude.done) {
              currentInterlude = null;
              resetTruck();
              resetGhosts();
              gameState   = GS.LEVEL_BANNER;
              bannerTimer = BANNER_DUR;
            }
          } else {
            intermissionTimer--;
            if (intermissionTimer <= 0) {
              resetTruck();
              resetGhosts();
              gameState   = GS.LEVEL_BANNER;
              bannerTimer = BANNER_DUR;
            }
          }
          break;
        case GS.LEVEL_BANNER:
          bannerTimer--;
          if (bannerTimer <= 0) gameState = GS.READY;
          break;
        case GS.ATTRACT:
          updateJingle();   // B7: attract screen melody
          break;
        case GS.PAUSED:
        case GS.INITIALS:
          // Ph5: tick IRS gag timer while on initials screen
          if (irsGagTimer > 0) irsGagTimer--;
          break;            // frozen — rAF keeps running for cursor blink / overlay animations

        // ── BOSS LEVEL (Ph2) ─────────────────────────────────────────
        case GS.BOSS:
          // Only tick game logic while truck is moving (player has pressed a key).
          // While truck.moving is false the scene is frozen on the "PRESS ANY KEY" state.
          if (truck.moving) {
            bossTimer++;
            updatePlayer();
            updateGhosts();
            checkGhostCollisions();   // uses same loseLife() path — guard includes GS.BOSS
            updateFloatTexts();
            updateSiren();
            updateWhines();
            updateGhostIntros();
            updateGhostBursts();
            updateAchieveToasts();
            if (powerFlashTimer > 0) powerFlashTimer--;
            // Exhaust trail
            if (truck.alive) {
              const [dr, dc] = DIR_VEC[truck.dir];
              const tp = getTruckPixelPos();
              exhaustTrail.push({
                px: tp.px - dc * 9, py: tp.py - dr * 9,
                life: EXHAUST_LIFE, maxLife: EXHAUST_LIFE,
              });
              if (exhaustTrail.length > EXHAUST_MAX) exhaustTrail.shift();
            }
            for (let i = exhaustTrail.length - 1; i >= 0; i--) {
              exhaustTrail[i].life--;
              if (exhaustTrail[i].life <= 0) exhaustTrail.splice(i, 1);
            }
            // Victory condition: survived the full duration
            if (bossTimer >= BOSS_SURVIVE_FRAMES) bossVictory();
          }
          break;

        // ── VICTORY CEREMONY (Ph3) ───────────────────────────────────
        case GS.CEREMONY:
          ceremonyTimer++;
          // On first frame: fire fanfare SFX + spawn confetti burst
          if (ceremonyTimer === 1) {
            sfxCeremonyFanfare();
            spawnCeremonyConfetti(120);
          }
          // Periodic top-ups so confetti keeps falling throughout hold phase
          if (ceremonyTimer === 80 || ceremonyTimer === 160) {
            spawnCeremonyConfetti(60);
          }
          // Update confetti physics
          for (let i = ceremonyConfetti.length - 1; i >= 0; i--) {
            const p = ceremonyConfetti[i];
            p.x  += p.vx; p.y  += p.vy;
            p.vy += 0.28; p.vx *= 0.98;
            p.spin += p.vspin;
            p.life -= 0.006;
            if (p.life <= 0 || p.y > CH + 20) ceremonyConfetti.splice(i, 1);
          }
          // Auto-advance to newspaper after 360 frames (6 s)
          if (ceremonyTimer >= 360) {
            newsSnapshotTaken = false;   // ensure fresh snapshot
            gameState = GS.NEWSPAPER;
          }
          break;

        // ── FREIGHT NEWS NEWSPAPER (Ph3) ─────────────────────────────
        // drawNewspaper() takes a snapshot on first render and pushes it
        // to the JSX overlay. Player taps "Continue" in JSX to advance.
        // The canvas keeps re-rendering so the page stays live.
        case GS.NEWSPAPER:
          break;

        default: break;
      }
      render();
      rafId = requestAnimationFrame(gameLoop);
    }

    // Expose joystick handlers to the JSX overlay via jstkRef
    // Register all listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleEscape);
    canvas.addEventListener('touchstart', touchStart, { passive: false });
    canvas.addEventListener('touchmove',  touchMove,  { passive: false });
    canvas.addEventListener('touchend',   touchEnd,   { passive: false });
    canvas.addEventListener('click',      handleCanvasClick);

    // ── VISIBILITY API ────────────────────────────────────────────────
    // Pause when the user switches apps, locks screen, or gets a call.
    // On return: reset lastFrameTime so the delta-time cap doesn't see a
    // multi-second gap and schedule a burst of skipped frames.
    // Embedded-safe: behaves identically inside App.jsx arcade cabinet.
    let visibilityPausedState = null; // gameState snapshot before auto-pause
    function handleVisibilityChange() {
      if (document.hidden) {
        // Auto-pause during active gameplay states; don't interrupt death/banner animations
        if (gameState === GS.PLAYING || gameState === GS.GHOST_EATEN) {
          visibilityPausedState = gameState;  // remember which state we came from
          gameState = GS.PAUSED;
          stopAllWhines();
        }
      } else {
        // Returning to foreground
        // Reset frame timestamp so cap doesn't fire a burst of catch-up ticks
        lastFrameTime = 0;
        // Resume audio context in case OS suspended it during the interruption
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        // Restore state only if we were the ones who paused it.
        // GHOST_EATEN resumes as PLAYING — the freeze moment has passed.
        if (gameState === GS.PAUSED && visibilityPausedState !== null) {
          gameState = visibilityPausedState === GS.GHOST_EATEN
            ? GS.PLAYING
            : visibilityPausedState;
        }
        visibilityPausedState = null;
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── GAME INPUT BRIDGE ─────────────────────────────────────────────
    // JSX overlays (D-pad, quit button) live outside the effect closure
    // and cannot call handlePlayerInput or gameState directly.
    // We expose a stable object via gameInputRef so they can dispatch
    // without re-renders or stale closure captures.
    gameInputRef.current = {
      dir:  (d) => handlePlayerInput(d),
      quit: () => {
        if (embeddedRef.current && onClose) { onClose(); }
        else { stopAllWhines(); frightenedTimer = 0; exhaustTrail.length = 0; ghostBursts.length = 0; gameState = GS.ATTRACT; }
      },
      pause: () => {
        if (gameState === GS.PLAYING || gameState === GS.GHOST_EATEN) gameState = GS.PAUSED;
        else if (gameState === GS.PAUSED) gameState = GS.PLAYING;
      },
      getState: () => gameState,
      // P5: expose score data so the JSX share button can read it
      getScoreData: () => ({
        score,
        hiScore,
        level,
        stats: {
          ghosts:   statGhostsEaten,
          maxChain: statMaxChain,
          pellets:  statPelletsEaten,
          levels:   statLevelsCleared,
        },
      }),
      // Ph3: expose newspaper setters so canvas effect can trigger JSX overlay
      setShowNews:    (v)  => setShowNewsRef.current(v),
      setNewsDataUrl: (url) => setNewsDataUrlRef.current(url),
      // Ph3: called by JSX "Continue" button to advance past GS.NEWSPAPER
      advanceFromNewspaper: () => {
        if (gameState !== GS.NEWSPAPER) return;
        setShowNewsRef.current(false);
        newsSnapshotTaken = false;
        level++;
        advanceLevel();
      },
    };

    // Init: wait for font then start
    document.fonts.ready.then(() => {
      resetGhosts();
      applyScale();
      if (embeddedRef.current) beginNewGame();
      rafId = requestAnimationFrame(gameLoop);
    });

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(rafId);
      if (resizeDebounceId) clearTimeout(resizeDebounceId);
      resizeObs.disconnect();
      window.removeEventListener('resize',  applyScaleDebounced);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleEscape);
      canvas.removeEventListener('touchstart', touchStart);
      canvas.removeEventListener('touchmove',  touchMove);
      canvas.removeEventListener('touchend',   touchEnd);
      canvas.removeEventListener('click',      handleCanvasClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAllWhines();
      gameInputRef.current = null;
      // Clear gain pool so we don't hold stale AudioNode refs after context closes
      _gainPool.length = 0;
      _gainPoolAC = null;
      if (audioCtxRef.current) {
        audioCtxRef.current.onstatechange = null;
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  //       ^^ deps intentionally empty: game state lives inside the
  //          effect closure; re-running on every render would reset

  // B9: portrait/rotate hint — show when device is landscape AND short (phone rotated)
  useEffect(() => {
    function checkOrientation() {
      setShowRotate(window.innerHeight < 450 && window.innerWidth > window.innerHeight);
    }
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // ── ANDROID BACK BUTTON / CAPACITOR HOOK ─────────────────────────
  // Handles the Android hardware back button in three ways (priority order):
  //   1. Capacitor App plugin  (native wrapper — Capacitor 3/4/5)
  //   2. popstate event        (TWA / PWA installed to home screen)
  //   3. No-op                 (plain browser — back navigates normally)
  //
  // Behaviour:
  //   PLAYING  → pause the game (same as P key)
  //   PAUSED   → if embedded call onClose (return to arcade cabinet),
  //              else go to ATTRACT
  //   ATTRACT / GAME_OVER → call onBackButton prop if provided, else onClose
  //   Everything else  → call onBackButton prop if provided, else onClose
  //
  // onBackButton prop lets App.jsx intercept and navigate to its own screen.
  // All refs are stable so this effect never needs to re-run.
  useEffect(() => {
    // gameStateRef lets the back-button handler read live gameState without
    // being inside the main game-loop effect closure.
    // We maintain it by patching the setter — but gameState is a plain let
    // inside the other closure, so we use a shared mutable object instead.
    // The simplest safe approach: a module-level ref updated each rAF tick
    // is complex; instead we do a direct Capacitor/popstate handler that
    // calls the prop callbacks (which are stable refs) and doesn't need to
    // read internal game state.  For game-state-aware back behaviour we rely
    // on handleKeyDown's Escape path and the P-key pause — the back button
    // mirrors Escape for simplicity.
    const handleBack = () => {
      // Mirror Escape: if a specific back-button callback exists use it,
      // otherwise fall through to onClose.
      if (onBackButtonRef.current) {
        onBackButtonRef.current();
      } else if (onClose) {
        onClose();
      }
    };

    // 1. Capacitor App plugin (Capacitor 3+)
    let capacitorHandle = null;
    try {
      const CapApp = window?.Capacitor?.Plugins?.App;
      if (CapApp?.addListener) {
        // addListener returns a Promise<PluginListenerHandle> in Cap 3+
        CapApp.addListener('backButton', handleBack)
          .then(handle => { capacitorHandle = handle; })
          .catch(() => {});
      }
    } catch(e) {}

    // 2. popstate fallback for TWA / PWA  (push a history entry so back fires)
    let poppedEntry = false;
    if (!window?.Capacitor && window.history?.pushState) {
      try {
        window.history.pushState({ frBack: true }, '');
        poppedEntry = true;
      } catch(e) {}
    }
    const handlePopState = (e) => {
      if (e.state?.frBack) {
        handleBack();
        // Re-push so the entry stays available for subsequent back presses
        try { window.history.pushState({ frBack: true }, ''); } catch(ex) {}
      }
    };
    if (poppedEntry) window.addEventListener('popstate', handlePopState);

    return () => {
      // Clean up Capacitor listener
      if (capacitorHandle) {
        try { capacitorHandle.remove?.(); } catch(e) {}
      }
      // Clean up popstate
      if (poppedEntry) window.removeEventListener('popstate', handlePopState);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // ── RENDER BLOCK ──────────────────────────────────────────────────
  // Redesigned: neon-noir arcade cabinet aesthetic.
  // Game logic is 100% untouched — only JSX/CSS upgraded.

  // ── Inject enhanced CSS once ──────────────────────────────────────
  if (typeof document !== 'undefined' && !document.getElementById('fr-enhanced-styles')) {
    const s = document.createElement('style');
    s.id = 'fr-enhanced-styles';
    s.textContent = `
      .fr-shell { height: 100vh; height: 100dvh; }

      @keyframes fr-cabinet-pulse {
        0%, 100% { filter: drop-shadow(0 0 8px rgba(255,180,0,0.22)) drop-shadow(0 0 24px rgba(255,150,0,0.10)); }
        50%       { filter: drop-shadow(0 0 14px rgba(255,200,0,0.38)) drop-shadow(0 0 40px rgba(255,150,0,0.16)); }
      }
      @keyframes fr-scan-beam {
        0%   { transform: translateY(-100%); opacity: 0; }
        8%   { opacity: 1; }
        92%  { opacity: 1; }
        100% { transform: translateY(100vh); opacity: 0; }
      }
      @keyframes fr-corner-glow {
        0%,100% { opacity: 0.45; }
        50%      { opacity: 1; }
      }
      @keyframes fr-jstk-idle-pulse {}
      @keyframes fr-jstk-active-pulse {}
      @keyframes fr-settings-slide-up {}
      @keyframes fr-settings-fade-in {}
      @keyframes fr-dot-breathe {
        0%,100% { transform: scale(1); opacity: 0.65; }
        50%     { transform: scale(1.6); opacity: 1; }
      }
      @keyframes fr-rgb-shift {
        0%  { text-shadow: -2px 0 rgba(255,0,100,0.4), 2px 0 rgba(0,200,255,0.4); }
        33% { text-shadow: 2px 0 rgba(255,0,100,0.4), -2px 0 rgba(0,200,255,0.4); }
        66% { text-shadow: 0 -1px rgba(255,0,100,0.3), 0 1px rgba(0,200,255,0.3); }
        100%{ text-shadow: -2px 0 rgba(255,0,100,0.4), 2px 0 rgba(0,200,255,0.4); }
      }
      .fr-dpad-btn {
        background: rgba(10,10,30,0.72);
        border: 1.5px solid rgba(255,215,0,0.35);
        border-radius: 6px;
        color: rgba(255,215,0,0.85);
        font-size: 18px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        transition: background 0.08s, border-color 0.08s;
        -webkit-tap-highlight-color: transparent;
        user-select: none; -webkit-user-select: none;
      }
      .fr-dpad-btn:active {
        background: rgba(255,215,0,0.18);
        border-color: rgba(255,215,0,0.75);
      }
      .fr-hud-btn {
        background: rgba(4,4,18,0.82);
        border: 0px;
        color: rgba(255,215,0,0.75);
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        min-width: 56px;
        height: 44px;
        padding: 0 12px;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none; -webkit-user-select: none;
        letter-spacing: 1px;
        position: absolute;
        top: 0;
        z-index: 20;
      }
      .fr-hud-btn:active { background: rgba(255,215,0,0.12); color: rgba(255,215,0,1); }
      .fr-hud-btn-left  { left: 0;  border-bottom-right-radius: 6px; border-right: 1px solid rgba(255,215,0,0.15); border-bottom: 1px solid rgba(255,215,0,0.15); }
      .fr-hud-btn-right { right: 0; border-bottom-left-radius: 6px;  border-left:  1px solid rgba(255,215,0,0.15); border-bottom: 1px solid rgba(255,215,0,0.15); }
      .fr-toggle-btn {
        background: rgba(10,10,30,0.35);
        border: 1px solid rgba(255,215,0,0.12);
        border-radius: 4px;
        color: rgba(255,215,0,0.28);
        font-family: 'Press Start 2P', monospace;
        font-size: 5px;
        padding: 4px 6px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none; -webkit-user-select: none;
      }
      .fr-toggle-btn:active { background: rgba(255,215,0,0.08); color: rgba(255,215,0,0.55); }
    `;
    document.head.appendChild(s);
  }

  const JSTK_BASE_PX = 120;  // kept for reference; overlays removed
  const JSTK_KNOB_PX = 48;

  const shellStyle = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'radial-gradient(ellipse at 50% 30%, #0d0b1e 0%, #050410 45%, #020208 100%)',
    overflow: 'hidden',
    touchAction: 'none',
    position: 'relative',
    // Safe area insets: only in standalone mode. When embedded, App.jsx controls
    // layout and is responsible for its own safe-area handling — applying twice
    // would double-pad on notch/Dynamic Island devices.
    // env() resolves to 0 on devices without safe areas, so this is always safe.
    ...(!embedded ? {
      paddingTop:    'env(safe-area-inset-top)',
      paddingRight:  'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft:   'env(safe-area-inset-left)',
    } : {}),
    ...(embedded ? { height: '100%' } : {}),
    ...style,
  };

  const gameAreaStyle = {
    flex: 1, minHeight: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  };

  // Ambient background dots (static, decorative)
  const ambientDots = [
    { top:'12%', left:'8%', size:2, delay:0 }, { top:'28%', left:'92%', size:1.5, delay:0.8 },
    { top:'65%', left:'5%', size:1, delay:1.4 }, { top:'78%', left:'88%', size:2, delay:0.3 },
    { top:'45%', left:'3%', size:1.5, delay:1.1 }, { top:'90%', left:'45%', size:1, delay:0.6 },
    { top:'18%', left:'50%', size:1, delay:1.7 }, { top:'55%', left:'96%', size:2, delay:0.2 },
  ];

  const wrapperStyle = {
    position: 'relative',
    display: 'inline-block',
    lineHeight: 0,
    borderRadius: '8px',
    animation: 'fr-cabinet-pulse 3.5s ease-in-out infinite',
    // will-change:filter promotes wrapper to its own GPU compositor layer,
    // isolating the canvas from all overlay repaints.
    // contain:layout prevents layout changes from propagating up to App.jsx.
    willChange: 'filter',
    contain: 'layout',
    outline: '1px solid rgba(255,215,0,0.08)',
  };

  const canvasStyle = {
    display: 'block',
    imageRendering: 'pixelated',
    borderRadius: '8px',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    // Promote canvas to its own GPU layer so rAF repaints don't
    // trigger re-compositing of the CRT overlay divs above it.
    willChange: 'transform',
  };

  const overlayBase = {
    position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '8px',
  };

  // ── Corner bracket accents ─────────────────────────────────────────
  const cornerSize = 18;
  const cornerThick = 2;
  const cornerStyle = (top, right, bottom, left) => ({
    position: 'absolute',
    width: cornerSize, height: cornerSize,
    top: top !== undefined ? top : undefined,
    right: right !== undefined ? right : undefined,
    bottom: bottom !== undefined ? bottom : undefined,
    left: left !== undefined ? left : undefined,
    pointerEvents: 'none',
    zIndex: 10,
    animation: 'fr-corner-glow 2.5s ease-in-out infinite',
    willChange: 'opacity',
  });

  return (
    <div className={embedded ? undefined : 'fr-shell'} style={shellStyle}>

      {/* ── Ambient floating dots (decorative, outside game area) ── */}
      {ambientDots.map((d, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: d.top, left: d.left,
          width: d.size + 'px', height: d.size + 'px',
          borderRadius: '50%',
          background: 'rgba(255,215,0,0.35)',
          pointerEvents: 'none',
          animation: `fr-dot-breathe ${2.5 + d.delay}s ease-in-out infinite`,
          animationDelay: d.delay + 's',
          zIndex: 0,
          willChange: 'transform, opacity',
        }} />
      ))}

      {/* ── Nav toolbar — title only ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#040412',
        borderBottom: '1px solid rgba(255,215,0,0.18)',
        flexShrink: 0,
        height: '32px',
        boxSizing: 'border-box',
      }}>
        <span style={{ fontFamily:"'Press Start 2P', monospace", fontSize:'7px', color:'rgba(255,215,0,0.35)', letterSpacing:'2px', pointerEvents:'none', userSelect:'none' }}>
          FREIGHT RUNNER
        </span>
      </div>

      <div ref={gameAreaRef} style={gameAreaStyle}>
        <div ref={wrapperRef} style={wrapperStyle}>

          {/* Canvas */}
          <canvas ref={canvasRef} style={canvasStyle} />

          {/* ── Exit confirmation overlay ── */}
          {showExitConfirm && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 40,
              background: 'rgba(0,0,12,0.88)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '20px', borderRadius: '8px',
            }}>
              <div style={{ fontFamily:"'Press Start 2P', monospace", fontSize:'9px', color:'#FFD700', letterSpacing:'2px', textAlign:'center', lineHeight:2 }}>
                QUIT GAME?
              </div>
              <div style={{ display:'flex', gap:'16px' }}>
                <button
                  style={{
                    fontFamily:"'Press Start 2P', monospace", fontSize:'8px',
                    background:'rgba(220,50,50,0.18)', border:'1px solid rgba(220,80,80,0.6)',
                    color:'rgba(255,120,120,0.95)', borderRadius:'6px',
                    padding:'10px 20px', cursor:'pointer', letterSpacing:'1px',
                    WebkitTapHighlightColor:'transparent', minWidth:'80px', minHeight:'44px',
                  }}
                  onPointerDown={e => {
                    e.stopPropagation();
                    setShowExitConfirm(false);
                    // 1. Try onBackButton prop (Box Truck Boss integration)
                    if (onBackButtonRef.current) { onBackButtonRef.current(); return; }
                    // 2. Try onClose prop
                    if (onClose) { onClose(); return; }
                    // 3. Fire a CustomEvent so the host app can catch it even without props
                    try {
                      const el = wrapperRef.current?.closest('[data-freight-runner]') || wrapperRef.current;
                      el?.dispatchEvent(new CustomEvent('freightrunner:exit', { bubbles: true }));
                    } catch(ex) {}
                    // 4. Last resort: browser back
                    try { window.history.back(); } catch(ex) {}
                  }}
                >
                  YES, QUIT
                </button>
                <button
                  style={{
                    fontFamily:"'Press Start 2P', monospace", fontSize:'8px',
                    background:'rgba(0,200,80,0.12)', border:'1px solid rgba(0,200,80,0.45)',
                    color:'rgba(80,220,120,0.95)', borderRadius:'6px',
                    padding:'10px 20px', cursor:'pointer', letterSpacing:'1px',
                    WebkitTapHighlightColor:'transparent', minWidth:'80px', minHeight:'44px',
                  }}
                  onPointerDown={e => {
                    e.stopPropagation();
                    setShowExitConfirm(false);
                    gameInputRef.current?.pause(); // unpause to resume
                  }}
                >
                  KEEP PLAYING
                </button>
              </div>
            </div>
          )}

          {/* ── CRT: enhanced scanlines (fine + coarse) ── */}
          {/* Perf: mixBlendMode:multiply removed — it collapsed canvas + all overlay
              divs into a single unpromoted layer, forcing CPU compositing on every
              canvas repaint. The visual effect is near-identical without it at this
              opacity level (0.07 dark stripe). */}
          <div style={{ ...overlayBase, zIndex: 2,
            background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)',
          }} />
          {/* CRT: RGB subpixel shimmer stripe */}
          <div style={{ ...overlayBase, zIndex: 3,
            background: 'repeating-linear-gradient(90deg, rgba(255,0,60,0.012) 0px, transparent 1px, rgba(0,255,200,0.012) 2px, transparent 3px)',
          }} />
          {/* CRT: vignette — heavier corners */}
          <div style={{ ...overlayBase, zIndex: 4,
            background: 'radial-gradient(ellipse at 50% 50%, transparent 48%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.75) 100%)',
          }} />
          {/* CRT: top screen reflection */}
          <div style={{ ...overlayBase, zIndex: 5,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.028) 0%, transparent 18%)',
            borderRadius: '8px 8px 0 0',
          }} />
          {/* CRT: slow scan beam — will-change:transform gives it its own GPU layer
              so its animation doesn't invalidate the canvas or other overlays. */}
          <div style={{
            ...overlayBase, zIndex: 6,
            overflow: 'hidden',
            borderRadius: '8px',
            pointerEvents: 'none',
            willChange: 'transform',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, height: '3px',
              background: 'linear-gradient(to bottom, transparent, rgba(255,220,100,0.06), transparent)',
              animation: 'fr-scan-beam 8s linear infinite',
              pointerEvents: 'none',
              willChange: 'transform',
            }} />
          </div>

          {/* ── Corner bracket accents ── */}
          {/* Top-left */}
          <svg style={{ ...cornerStyle(0, undefined, undefined, 0), zIndex: 10 }}
            width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`}>
            <path d={`M${cornerSize},${cornerThick} L${cornerThick},${cornerThick} L${cornerThick},${cornerSize}`}
              stroke="rgba(255,215,0,0.7)" strokeWidth={cornerThick} fill="none"
              strokeLinecap="square" />
          </svg>
          {/* Top-right */}
          <svg style={{ ...cornerStyle(0, 0, undefined, undefined), zIndex: 10 }}
            width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`}>
            <path d={`M0,${cornerThick} L${cornerSize-cornerThick},${cornerThick} L${cornerSize-cornerThick},${cornerSize}`}
              stroke="rgba(255,215,0,0.7)" strokeWidth={cornerThick} fill="none"
              strokeLinecap="square" />
          </svg>
          {/* Bottom-left */}
          <svg style={{ ...cornerStyle(undefined, undefined, 0, 0), zIndex: 10 }}
            width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`}>
            <path d={`M${cornerSize},${cornerSize-cornerThick} L${cornerThick},${cornerSize-cornerThick} L${cornerThick},0`}
              stroke="rgba(255,215,0,0.7)" strokeWidth={cornerThick} fill="none"
              strokeLinecap="square" />
          </svg>
          {/* Bottom-right */}
          <svg style={{ ...cornerStyle(undefined, 0, 0, undefined), zIndex: 10 }}
            width={cornerSize} height={cornerSize} viewBox={`0 0 ${cornerSize} ${cornerSize}`}>
            <path d={`M0,${cornerSize-cornerThick} L${cornerSize-cornerThick},${cornerSize-cornerThick} L${cornerSize-cornerThick},0`}
              stroke="rgba(255,215,0,0.7)" strokeWidth={cornerThick} fill="none"
              strokeLinecap="square" />
          </svg>

          {/* ── Rotate hint overlay */}
          {showRotate && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 30,
              background: 'rgba(0,0,12,0.92)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', gap: '14px',
            }}>
              <div style={{
                fontSize: '52px', lineHeight: 1,
                filter: 'drop-shadow(0 0 16px rgba(255,215,0,0.5))',
              }}>📱</div>
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '7px',
                color: '#FFD700',
                textAlign: 'center',
                letterSpacing: '2px',
                lineHeight: '2.2',
                animation: 'fr-rgb-shift 3s linear infinite',
              }}>
                ROTATE DEVICE<br />FOR BEST PLAY
              </div>
            </div>
          )}

          {/* ── D-pad toggle button (always visible, bottom-left corner) ── */}
          <button
            className="fr-toggle-btn"
            style={{
              position: 'absolute',
              bottom: 6 + dpadOffset,
              left: 6,
              zIndex: 20,
            }}
            onPointerDown={e => {
              e.stopPropagation();
              setShowDpad(v => {
                const next = !v;
                try { localStorage.setItem('fr_dpad', next ? '1' : '0'); } catch(ex) {}
                return next;
              });
            }}
          >
            {showDpad ? 'HIDE PAD' : 'SHOW PAD'}
          </button>

          {/* ── Ph3: FREIGHT NEWS newspaper overlay ── */}
          {/* Mounts over the canvas when GS.NEWSPAPER is active.           */}
          {/* Shows Download, Share, and Continue buttons beneath the image. */}
          {showNewspaper && newsDataUrl && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 30,
                background: 'rgba(0,0,0,0.88)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: 12,
                borderRadius: '8px',
              }}
              onPointerDown={e => e.stopPropagation()}
            >
              {/* Newspaper image preview */}
              <img
                src={newsDataUrl}
                alt="FREIGHT NEWS"
                style={{
                  maxWidth: '100%',
                  maxHeight: '68%',
                  imageRendering: 'pixelated',
                  border: '2px solid rgba(255,215,0,0.7)',
                  borderRadius: '4px',
                  boxShadow: '0 0 20px rgba(255,215,0,0.25)',
                }}
              />

              {/* Action buttons row */}
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {/* Download button */}
                <a
                  href={newsDataUrl}
                  download="freight-news.png"
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    padding: '8px 14px',
                    background: 'rgba(255,215,0,0.12)',
                    color: '#FFD700',
                    border: '1.5px solid rgba(255,215,0,0.55)',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '36px',
                    display: 'flex', alignItems: 'center',
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  ↓ DOWNLOAD
                </a>

                {/* Share button */}
                <button
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    padding: '8px 14px',
                    background: 'rgba(0,255,136,0.10)',
                    color: 'rgba(0,255,136,0.90)',
                    border: '1.5px solid rgba(0,255,136,0.45)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    letterSpacing: '1px',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '36px',
                  }}
                  onPointerDown={e => {
                    e.stopPropagation();
                    // Try Web Share API with image blob first (mobile)
                    if (navigator.share && navigator.canShare) {
                      fetch(newsDataUrl)
                        .then(r => r.blob())
                        .then(blob => {
                          const file = new File([blob], 'freight-news.png', { type: 'image/png' });
                          if (navigator.canShare({ files: [file] })) {
                            navigator.share({
                              title: 'FREIGHT NEWS',
                              text: `I completed the LEGEND HAUL in Freight Runner! Score: ${gameInputRef.current?.getScoreData?.()?.score ?? 0} 🚛`,
                              files: [file],
                            }).catch(() => {});
                          } else {
                            // Can't share files — share text only
                            navigator.share({
                              title: 'FREIGHT NEWS',
                              text: `I completed the LEGEND HAUL in Freight Runner! Score: ${gameInputRef.current?.getScoreData?.()?.score ?? 0} 🚛`,
                            }).catch(() => {});
                          }
                        }).catch(() => {});
                    } else {
                      // Desktop fallback: copy text to clipboard
                      try {
                        navigator.clipboard.writeText(
                          `I completed the LEGEND HAUL in Freight Runner! Score: ${gameInputRef.current?.getScoreData?.()?.score ?? 0} 🚛 #BoxTruckBoss #FreightRunner`
                        );
                        e.currentTarget.textContent = 'COPIED!';
                        setTimeout(() => { if (e.currentTarget) e.currentTarget.textContent = '↑ SHARE'; }, 1600);
                      } catch(ex) {}
                    }
                  }}
                >
                  ↑ SHARE
                </button>

                {/* Continue button */}
                <button
                  style={{
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '7px',
                    padding: '8px 14px',
                    background: 'rgba(80,80,200,0.14)',
                    color: 'rgba(160,160,255,0.95)',
                    border: '1.5px solid rgba(120,120,255,0.45)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    letterSpacing: '1px',
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: '36px',
                  }}
                  onPointerDown={e => {
                    e.stopPropagation();
                    gameInputRef.current?.advanceFromNewspaper?.();
                  }}
                >
                  CONTINUE ▶
                </button>
              </div>
            </div>
          )}

          {/* ── Share score button — visible during GAME_OVER ── */}
          {showShare && (
            <button
              className="fr-toggle-btn"
              style={{
                position: 'absolute',
                bottom: 28 + dpadOffset,
                left: 6,
                zIndex: 20,
                borderColor: 'rgba(0,255,136,0.4)',
                color: 'rgba(0,255,136,0.85)',
              }}
              onPointerDown={e => {
                e.stopPropagation();
                const d = gameInputRef.current?.getScoreData?.() || {};
                const name = appNameRef.current || 'FreightRunner';
                const text = `I scored ${d.score ?? 0} pts reaching level ${d.level ?? 1} in ${name}! 🚛`;
                if (navigator.share) {
                  navigator.share({ title: name, text }).catch(() => {});
                } else {
                  // Clipboard fallback for desktop
                  try {
                    navigator.clipboard.writeText(text);
                    // Brief visual feedback — reuse existing toast system if available
                    if (gameInputRef.current) {
                      // Patch a one-off canvas toast via the bridge isn't clean;
                      // instead flip button text momentarily via DOM (self-contained)
                      e.currentTarget.textContent = 'COPIED!';
                      setTimeout(() => {
                        if (e.currentTarget) e.currentTarget.textContent = 'SHARE SCORE';
                      }, 1500);
                    }
                  } catch(ex) {}
                }
              }}
            >
              SHARE SCORE
            </button>
          )}

          {/* ── On-screen D-pad ── */}
          {showDpad && (
            <div style={{
              position: 'absolute',
              bottom: 28 + dpadOffset,
              right: 10,
              zIndex: 20,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 44px)',
              gridTemplateRows: 'repeat(3, 44px)',
              gap: 3,
              touchAction: 'none',
            }}>
              {/* Row 1: top-centre = UP */}
              <div />
              <button className="fr-dpad-btn"
                onPointerDown={e => { e.preventDefault(); gameInputRef.current?.dir(1); }}>▲</button>
              <div />
              {/* Row 2: LEFT / centre(pause) / RIGHT */}
              <button className="fr-dpad-btn"
                onPointerDown={e => { e.preventDefault(); gameInputRef.current?.dir(2); }}>◀</button>
              <button className="fr-dpad-btn" style={{ fontSize: 11 }}
                onPointerDown={e => { e.preventDefault(); gameInputRef.current?.pause(); }}>II</button>
              <button className="fr-dpad-btn"
                onPointerDown={e => { e.preventDefault(); gameInputRef.current?.dir(0); }}>▶</button>
              {/* Row 3: bottom-centre = DOWN */}
              <div />
              <button className="fr-dpad-btn"
                onPointerDown={e => { e.preventDefault(); gameInputRef.current?.dir(3); }}>▼</button>
              <div />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}


// ── Artifact wrapper ──────────────────────────────────────────────────────
// Demo wrapper (not exported)
function FreightRunnerDemo() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#030310' }}>
      <FreightRunner
        onGameComplete={(score, level, initials, stats) => {
          console.log('Game complete', { score, level, initials, stats });
        }}
        onAchievement={(id, data) => {
          console.log('Achievement unlocked:', id, data);
        }}
        appName="FreightRunner"
      />
    </div>
  );
}

export default FreightRunner;
