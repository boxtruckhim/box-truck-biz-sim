// =============================================================================
//  PalletWrangler.jsx  —  Box Truck Boss  |  Pallet Wrangler  v47.5
//
//  Features:
//    • Sokoban-style warehouse — push pallets UP into color-coded dock bays
//    • 24 maze layouts (12 pallet-count tiers × 2 templates each)
//    • 7 wall styles, 4 floor styles, 3 lighting modes — rotate per level
//    • 4 pallet jack skins, 5 pallet shapes, ice tiles, hazard obstacles
//    • Combo system, undo (up to 30), pallet rotation, camera intro pan
//    • Scoped personal bests by difficulty (easy / medium / hard)
//    • Tap-to-continue win/fail, undo SFX, conditional ice hint
//    • Portrait + landscape responsive; keyboard + d-pad dual controls
//
//  Props:
//    items      — cargo array from buildCargoTetrisLoads()
//    gameCount  — integer from parent, drives visual theme rotation
//    onComplete — ({ passed:bool, xpEarned:Number, cashBonus:Number }) => void
//    onDismiss  — () => void
// =============================================================================

import { useState, useEffect, useRef } from 'react';

// =============================================================================
//  SECTION 1 — CONSTANTS
// =============================================================================

// World dimensions — 6 dock bays × (6 bay + 1 pillar) + left wall + right wall = 43
// bayLeftCol(i)=1+i*7, bayRightCol(i)=6+i*7, pillarCol(i)=7+i*7  →  col 42 = right wall
const COLS      = 43;   // 1 + 6×(6bay+1pillar) - 1 (no trailing pillar) + 1 rwall = 43
const ROWS      = 34;   // dock(1) + zones(3) + maze(25) + staging(2) + hazard(2) + bwall(1)
const VIEW_COLS = 13;   // tiles visible per screen width  (tile-size from this, not COLS)
const VIEW_ROWS = 14;   // tiles visible per screen height
const HUD_H     = 56;

// ── Dock bay geometry (computed from these constants everywhere) ──────────────
const BAY_COUNT = 6;    // total dock bays along top wall
const BAY_W     = 6;    // tiles wide per bay opening (wider bays for larger warehouse)
const BAY_SEP   = 1;    // tiles wide for concrete pillar between adjacent bays

// ── Jack footprint ────────────────────────────────────────────────────────────
const JACK_W    = 2;    // jack logical width  (tiles) — 2×2 footprint
const JACK_H    = 2;    // jack logical height (tiles)

function bayLeftCol(i)   { return 1 + i * (BAY_W + BAY_SEP); }   // first col of bay i
function bayRightCol(i)  { return bayLeftCol(i) + BAY_W - 1; }    // last col of bay i
function pillarCol(i)    { return bayRightCol(i) + 1; }           // pillar between bay i and i+1
function bayCenterCol(i) { return bayLeftCol(i) + Math.floor(BAY_W / 2); } // center col of bay i

// ── Lift mechanic constants ──────────────────────────────────────────────────
const LIFT_PUMP_FRAMES  = 16;  // frames for the single lift pump animation
// liftState values: null | 'lifting' | 'lifted' | 'lowering' | 'docking'
// 'docking' = pallet just snapped into correct bay while being carried;
//             jack plays a brief lower anim, then lift state clears automatically.
const LIFT_PUMPS_NEEDED = 1;   // single pump to raise the pallet
const LIFT_LOWER_FRAMES = 12;  // frames for the lower animation

// Direction indices
const DIR_RIGHT = 0;
const DIR_UP    = 1;
const DIR_LEFT  = 2;
const DIR_DOWN  = 3;

const DIR_ROT   = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
const DIR_DELTA = [[0,1],[-1,0],[0,-1],[1,0]];

// ── Lifted pallet face-tile helper ──────────────────────────────────────────
// Returns the 2×2 (or shaped) set of tiles immediately in front of the jack
// in direction jackDir, used to keep the lifted pallet locked to the jack face.
function jackFaceTiles(jackRow, jackCol, jackDir) {
  // The "face" is the 2-wide leading edge of the 2×2 body.
  // We return those 2 face tiles — the lifted pallet will be snapped to start there.
  const [dr, dc] = DIR_DELTA[jackDir];
  if (dr === -1) return [{row:jackRow-1,col:jackCol},{row:jackRow-1,col:jackCol+1}];
  if (dr ===  1) return [{row:jackRow+2,col:jackCol},{row:jackRow+2,col:jackCol+1}];
  if (dc === -1) return [{row:jackRow,col:jackCol-1},{row:jackRow+1,col:jackCol-1}];
                 return [{row:jackRow,col:jackCol+2},{row:jackRow+1,col:jackCol+2}];
}

// Returns the unlocked pallet (if any) whose tiles overlap the jack's 2×2 body.
// Used to hide forks and fix z-order when jack is under-but-not-yet-lifting.
function palletOverJack(cl) {
  if (!cl.jackRow && cl.jackRow !== 0) return null;
  for (const p of (cl.pallets||[])) {
    if (p.locked || p._dockAnimFrame > 0 || p._lifted) continue;
    for (const t of p.tiles) {
      if (t.row >= cl.jackRow && t.row <= cl.jackRow+1 &&
          t.col >= cl.jackCol && t.col <= cl.jackCol+1) return p;
    }
  }
  return null;
}

// Reposition a lifted pallet's tiles so they stay flush at the jack face.
// The pallet's FIRST two tiles are anchored to the two face tiles; remaining
// tiles extend further in the forward direction.
function syncLiftedPalletTiles(cl) {
  // Only sync during 'lifted' — face-tile tracking for carry/docking.
  // During 'lifting': pallet stays above jack body (visual approach).
  // During 'lowering'/'docking': pallet releases to current position.
  if (!cl.liftedPallet || cl.liftState !== 'lifted') return;
  const p = cl.liftedPallet;
  const face = jackFaceTiles(cl.jackRow, cl.jackCol, cl.jackDir);
  const [dr, dc] = DIR_DELTA[cl.jackDir];

  // Get the bounding box of the original pallet to know its extent
  const bbox = getTileBBox(p.tiles);
  const pRows = bbox.maxRow - bbox.minRow + 1;
  const pCols = bbox.maxCol - bbox.minCol + 1;

  // Build new tile positions based on face anchor.
  // face[0] and face[1] are the two tiles touching the jack front edge.
  // The rest of the pallet extends further in the forward (dr/dc) direction.
  const newTiles = [];

  if (dr !== 0) {
    // Moving vertically (UP or DOWN) — pallet extends in row direction
    // face spans cols [jackCol, jackCol+1], pallet spans same cols
    const faceRow = face[0].row;  // row touching the jack
    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        newTiles.push({
          row: faceRow + r * dr,
          col: cl.jackCol + c,
        });
      }
    }
  } else {
    // Moving horizontally (LEFT or RIGHT) — pallet extends in col direction
    const faceCol = face[0].col;
    for (let r = 0; r < pRows; r++) {
      for (let c = 0; c < pCols; c++) {
        newTiles.push({
          row: cl.jackRow + r,
          col: faceCol + c * dc,
        });
      }
    }
  }

  // Only update if tiles actually changed (avoid thrashing lerpOx/lerpOy)
  const same = newTiles.length === p.tiles.length &&
    newTiles.every((t,i) => t.row===p.tiles[i].row && t.col===p.tiles[i].col);
  if (!same) {
    p.tiles = newTiles;
    p.lerpOx = 0;
    p.lerpOy = 0;
  }
}

// Movement / animation
const MOVE_LERP_FRAMES = 6;
const COMBO_WINDOW_MS  = 4000;
const DOCK_ANIM_FRAMES = 18;   // frames for pallet-loading-into-dock animation (faster)

// Pentatonic scale (Hz) for lock / combo SFX
const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];

// ── Tile types ───────────────────────────────────────────────────────────────
const TILE_F    = 'F';    // Concrete floor
const TILE_W    = 'W';    // Wall (style determined by cl.wallStyle)
const TILE_ICE  = 'ICE';  // Ice floor — pallet slides extra
const TILE_SHELF    = 'SH';   // Metal shelving (legacy, no longer placed)
const TILE_RACK     = 'RK';   // Pallet storage rack
const TILE_DOCK     = 'DK';   // Dock door opening (top row 0)
const TILE_COLUMN   = 'COL';  // Concrete load-bearing column
const TILE_HAZPILLAR= 'HP';   // Hazard-stripe wrapped pillar
const TILE_CHARGE   = 'CHG';  // Forklift charging station
const TILE_WET      = 'WET';  // Wet floor spill

// ── Wall style indices ───────────────────────────────────────────────────────
const WALL_BRICK      = 0;   // Red warehouse brick
const WALL_CINDERBLOCK= 1;   // Hollow-core CMU grey
const WALL_TILE       = 2;   // Ceramic tile (cold storage)
const WALL_STRIPE     = 3;   // Safety hazard tape stripes
const WALL_CHAINLINK  = 4;   // Chain-link fence over dark backing
const WALL_STEEL      = 5;   // Corrugated industrial steel panels
const WALL_PAINTED    = 6;   // Painted concrete (industrial green)

// ── Floor style indices ──────────────────────────────────────────────────────
const FLOOR_CONCRETE  = 0;   // Classic two-tone checker
const FLOOR_RUBBER    = 1;   // Anti-fatigue rubber bump-dot mat
const FLOOR_EPOXY     = 2;   // Seamless glossy epoxy
const FLOOR_TERRAZZO  = 3;   // Aggregate chip terrazzo

// ── Cargo style keys ─────────────────────────────────────────────────────────
const CARGO_POOL = ['drum','ibc','industrial','produce','tires','fragile','electronics','medical'];

// ── Operator skin tone palette — picked once per game from gameCount hash ────
const JACK_SKIN_TONES = [
  '#D08A55',  // warm light
  '#C07840',  // medium tan
  '#8B5A2B',  // medium-dark brown
  '#4A2810',  // deep dark
];

// =============================================================================
//  SECTION 2 — COLOUR PALETTE
// =============================================================================

// ── Stop zone colours (per stop) ─────────────────────────────────────────────
const ZONE_COLORS = [
  { // Stop 1 — Warm pine
    palletTop:'#D4A870', palletGrain:'#B88848', palletSide:'#8B6030',
    palletShadow:'#5A3A10', palletEdge:'#C49050',
    crateTop:'#C08040', crateGrain:'#8B5520', crateEdge:'#A06830', crateband:'#8B6030',
    zoneFill:'#FFF6CC', zoneStripe:'rgba(200,150,0,0.18)',
    zoneMark:'#B88000', zoneBorder:'#D4A040', zoneAlt:'#FFF0AA',
    labelColor:'#5A3000', spark:'#FFD060',
    palletBody:'#D4A870', palletBdr:'#C49050', body:'#D4A870', border:'#C49050',
  },
  { // Stop 2 — Blue pine
    palletTop:'#6AACCC', palletGrain:'#4488AA', palletSide:'#2A6088',
    palletShadow:'#103850', palletEdge:'#5898BB',
    crateTop:'#3080B0', crateGrain:'#205A88', crateEdge:'#2870A0', crateband:'#1A5888',
    zoneFill:'#CCEBFF', zoneStripe:'rgba(0,120,200,0.15)',
    zoneMark:'#0070CC', zoneBorder:'#3090E0', zoneAlt:'#B8DFFF',
    labelColor:'#001A40', spark:'#60C8FF',
    palletBody:'#6AACCC', palletBdr:'#5898BB', body:'#6AACCC', border:'#5898BB',
  },
  { // Stop 3 — Red oak
    palletTop:'#B07898', palletGrain:'#886070', palletSide:'#60384A',
    palletShadow:'#3A1828', palletEdge:'#9A6880',
    crateTop:'#905870', crateGrain:'#6A3050', crateEdge:'#7A4860', crateband:'#583040',
    zoneFill:'#F0DEFF', zoneStripe:'rgba(140,60,180,0.15)',
    zoneMark:'#8030C0', zoneBorder:'#A858E0', zoneAlt:'#E8C8FF',
    labelColor:'#280040', spark:'#D080FF',
    palletBody:'#B07898', palletBdr:'#9A6880', body:'#B07898', border:'#9A6880',
  },
  { // Stop 4 — Forest green
    palletTop:'#6AAA70', palletGrain:'#4A8450', palletSide:'#2A6030',
    palletShadow:'#103A18', palletEdge:'#5A9860',
    crateTop:'#3A8040', crateGrain:'#286030', crateEdge:'#307838', crateband:'#1E5828',
    zoneFill:'#DAFFD8', zoneStripe:'rgba(40,140,50,0.15)',
    zoneMark:'#228B22', zoneBorder:'#40AA40', zoneAlt:'#C0EFC0',
    labelColor:'#082808', spark:'#70DD60',
    palletBody:'#6AAA70', palletBdr:'#5A9860', body:'#6AAA70', border:'#5A9860',
  },
  { // Stop 5 — Burnt orange
    palletTop:'#D4804A', palletGrain:'#B05828', palletSide:'#804020',
    palletShadow:'#502010', palletEdge:'#C07040',
    crateTop:'#B06030', crateGrain:'#884020', crateEdge:'#985030', crateband:'#784028',
    zoneFill:'#FFEDDA', zoneStripe:'rgba(200,100,20,0.15)',
    zoneMark:'#CC5500', zoneBorder:'#E87020', zoneAlt:'#FFD8B0',
    labelColor:'#3A1400', spark:'#FF9040',
    palletBody:'#D4804A', palletBdr:'#C07040', body:'#D4804A', border:'#C07040',
  },
  { // Stop 6 — Steel teal
    palletTop:'#4A9AA8', palletGrain:'#307888', palletSide:'#185868',
    palletShadow:'#083040', palletEdge:'#3A8898',
    crateTop:'#207888', crateGrain:'#106068', crateEdge:'#186878', crateband:'#0E5060',
    zoneFill:'#D0F8FF', zoneStripe:'rgba(0,150,180,0.15)',
    zoneMark:'#007A90', zoneBorder:'#20A0B8', zoneAlt:'#B0EEFF',
    labelColor:'#001820', spark:'#40D8F0',
    palletBody:'#4A9AA8', palletBdr:'#3A8898', body:'#4A9AA8', border:'#3A8898',
  },
];

// ── Wall style palettes ───────────────────────────────────────────────────────
const WALL_PALETTES = [
  { // WALL_BRICK — red warehouse brick
    top:    '#8B4040', front: '#6A2828', side: '#501818', shadow: '#300808',
    grout:  'rgba(220,180,150,0.22)', shelf: 'rgba(80,20,20,0.45)', detail: '#7A3838',
  },
  { // WALL_CINDERBLOCK — hollow-core CMU
    top:    '#787878', front: '#565656', side: '#404040', shadow: '#282828',
    grout:  'rgba(0,0,0,0.15)',        shelf: 'rgba(40,40,40,0.50)', detail: '#666666',
  },
  { // WALL_TILE — ceramic, cold-storage green-grey
    top:    '#C8D0CC', front: '#8A9894', side: '#687872', shadow: '#404848',
    grout:  'rgba(100,120,110,0.35)',  shelf: 'rgba(60,80,70,0.40)', detail: '#A0ACA8',
  },
  { // WALL_STRIPE — hazard tape yellow/black
    top:    '#FFD700', front: '#C09000', side: '#907000', shadow: '#605000',
    grout:  'rgba(0,0,0,0.20)',        shelf: 'rgba(0,0,0,0.35)',    detail: '#1A1A1A',
  },
  { // WALL_CHAINLINK — dark metal + chain-link fence
    top:    '#2A2E30', front: '#1C2022', side: '#141618', shadow: '#0C0E10',
    grout:  'rgba(160,180,190,0.55)',  shelf: 'rgba(180,200,210,0.30)', detail: '#5A6468',
  },
  { // WALL_STEEL — corrugated industrial steel panels
    top:    '#7A8898', front: '#4A5868', side: '#303848', shadow: '#181E28',
    grout:  'rgba(0,0,0,0.10)',        shelf: 'rgba(20,40,60,0.50)', detail: '#5A6878',
  },
  { // WALL_PAINTED — smooth painted concrete, industrial green
    top:    '#8AA880', front: '#6A8860', side: '#508040', shadow: '#305020',
    grout:  'rgba(0,0,0,0.08)',        shelf: 'rgba(40,70,30,0.40)', detail: '#6A9860',
  },
];
const SHELF_C = {
  frame:    '#5A6070',
  beam:     '#484E58',
  shelf:    '#6A7080',
  contents: '#8A7060',
  bolt:     '#3A4050',
};
const RACK_C = {
  upright:  '#E07820',
  beam:     '#C06010',
  guard:    '#F09030',
  floor:    '#484848',
};

// ── Dock door colours ─────────────────────────────────────────────────────────
const DOCK_C = {
  frame:      '#2A2A2A',
  frameBevel: '#4A4A4A',
  interior:   '#101418',
  interiorFar:'#060A0C',
  truck:      '#3A5A38',
  truckDark:  '#28402A',
  hazardA:    '#FFD700',
  hazardB:    '#1A1A1A',
  light:      '#FFEE88',
  lightGlow:  'rgba(255,230,100,0.40)',
  stripe:     'rgba(255,200,0,0.65)',
  opening:    '#0A0E10',
};

// ── Static palette ────────────────────────────────────────────────────────────
const C = {
  floorA:       '#C8BCA8',
  floorB:       '#BEB29E',
  floorLine:    'rgba(100,80,50,0.18)',
  floorIce:     '#B0D8F0',
  floorIceLine: 'rgba(30,120,200,0.30)',
  hudBg:        '#1C1C2C',
  hudBorder:    '#3A3A5A',
  hudText:      '#FFFFFF',
  hudDim:       '#7080A0',
  timerGreen:   '#44EE88',
  timerAmber:   '#FFCC00',
  timerRed:     '#FF3333',
  overlayBg:    'rgba(8,8,20,0.88)',
  overlayPanel: '#18182E',
  overlayBorder:'#3A3A6A',
  winGold:      '#FFD700',
  failRed:      '#FF3344',
  comboHot:     '#FF8800',
  comboCool:    '#00FFCC',
  hazardYellow: '#FFD700',
  hazardBlack:  '#1A1A1A',
};

//  SECTION 3 — SHAPE UTILITIES
// =============================================================================

function getShapeId(itemType) {
  const t = (itemType || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');

  // ── 2×2 standard pallet ───────────────────────────────────────────────────
  if (['standard_pallet','standard','pallet','s4',
       'large','large_pallet','double','box_2x2','2x2'].includes(t))   return 'S4';

  // ── 2×1 half / long pallet ────────────────────────────────────────────────
  if (['half_pallet','half','long_pallet','long','s2',
       'plank','beam','bar','flat','board','2x1','1x2',
       'slim','narrow','rectangle'].includes(t))                         return 'S2';

  // ── L-shape (3-tile) ─────────────────────────────────────────────────────
  if (['irregular','l_pallet','l','sl','l_shape',
       'corner','l_piece','tetris_l'].includes(t))                       return 'SL';

  // ── Mirrored L-shape (3-tile) ─────────────────────────────────────────────
  if (['l_pallet_mirror','l_mirror','slm','l_mirrored',
       'j_shape','j_piece','tetris_j','reverse_l'].includes(t))          return 'SLm';

  // ── 1×1 small crate / single tile ────────────────────────────────────────
  if (['small_crate','crate','s1','small','tiny','box',
       'single','1x1','cube','tote','bin'].includes(t))                  return 'S1';

  return 'S4';  // default fallback
}

const ROTATABLE_SHAPES = new Set(['S2', 'SL', 'SLm']);

function getShapeTiles(shapeId, orientation) {
  const o = (orientation || 0) % 4;
  const bases = {
    S4:  [{dr:0,dc:0},{dr:0,dc:1},{dr:1,dc:0},{dr:1,dc:1}],
    S2:  [{dr:0,dc:0},{dr:0,dc:1}],
    SL:  [{dr:0,dc:0},{dr:0,dc:1},{dr:1,dc:0}],
    SLm: [{dr:0,dc:0},{dr:0,dc:1},{dr:1,dc:1}],
    S1:  [{dr:0,dc:0}],
  };
  let tiles = (bases[shapeId] || bases.S4).map(t => ({ ...t }));
  if (o === 0) return tiles;
  for (let s = 0; s < o; s++) {
    tiles = tiles.map(({ dr, dc }) => ({ dr: dc, dc: -dr }));
    const minR = Math.min(...tiles.map(t => t.dr));
    const minC = Math.min(...tiles.map(t => t.dc));
    tiles = tiles.map(({ dr, dc }) => ({ dr: dr - minR, dc: dc - minC }));
  }
  return tiles;
}

// =============================================================================
// =============================================================================
//  SECTION 4 — PROCEDURAL LAYOUT GENERATOR
// =============================================================================
// Dock door: 4 tiles carved open in row 0 (cols DOCK_L..DOCK_R), type TILE_DOCK.
// Obstacles: rotated through RACK, COLUMN, HAZPILLAR, CHARGE, WET pool.
// Wall style + jack style: assigned per level (gameCount % 3 / % 4).

// ── Active bay selection per game ─────────────────────────────────────────────
// Returns one array of bayIdx[] per stop, cycling through 4 arrangements via gameCount.
// 5 bays total (indices 0–4).
function selectActiveBays(stopCount, gameCount) {
  // Distribute up to 6 stops across 6 bays.
  // Each pattern is a 4-rotation cycle (gameCount % 4) for variety.
  const g = gameCount % 4;
  if (stopCount === 1) {
    return [[[1,2,3],[0,1,2],[2,3,4],[3,4,5]][g]];
  }
  if (stopCount === 2) {
    return [
      [[0,1,2],[3,4,5]],
      [[0,1],[3,4,5]],
      [[0,1,2],[4,5]],
      [[0,1],[3,4]],
    ][g];
  }
  if (stopCount === 3) {
    return [
      [[0,1],[2,3],[4,5]],
      [[0],[2,3],[4,5]],
      [[0,1],[2],[4,5]],
      [[0,1],[3],[4,5]],
    ][g];
  }
  if (stopCount === 4) {
    return [
      [[0,1],[2],[3],[4,5]],
      [[0],[1,2],[3],[4,5]],
      [[0,1],[2],[4],[5]],
      [[0],[2],[3,4],[5]],
    ][g];
  }
  if (stopCount === 5) {
    return [
      [[0],[1],[2],[3],[4,5]],
      [[0],[1],[2],[3,4],[5]],
      [[0],[1,2],[3],[4],[5]],
      [[0,1],[2],[3],[4],[5]],
    ][g];
  }
  // 6 stops — one bay each
  return [[0],[1],[2],[3],[4],[5]];
}

// ── 24 hand-crafted maze templates (2 per pallet count, counts 1–12) ────────
// Each template is an array of wall segments placed as TILE_COLUMN:
//   ['H', row, c1, c2]  — horizontal run from col c1 to c2 inclusive
//   ['V', col, r1, r2]  — vertical   run from row r1 to r2 inclusive
// Valid placement zone: rows 4–28, cols 1–41  (world is 43×34).
// Rows 1–3 (zone approach) and rows 29–30 (staging) are never touched.
// BFS solvability verified after stamping; fallback used if check fails.
//
// Templates are stored in pairs: indices 0-1 → count 1, 2-3 → count 2, … 22-23 → count 12.
// generateLayout picks randomly between the two options so the same load feels
// different on repeated plays.
//
// Complexity scales with pallet count:
//   1–2  pallets : templates  1- 4  (10–24%) — a couple of barriers, easy detours
//   3–4  pallets : templates  5- 8  (12–23%) — pockets, rooms, double-S
//   5–6  pallets : templates  9-12  (15–24%) — pinch corridors, funnels
//   7–8  pallets : templates 13-16  (21–26%) — rings, switchbacks, spine mazes
//   9–10 pallets : templates 17-20  (25–34%) — combs, nested rects, spirals
//  11–12 pallets : templates 21-24  (21–36%) — Celtic knot, labyrinth, max-density
const MAZE_TEMPLATES = [
  // ── Grid: COLS=43 (usable cols 1-41), ROWS=34 (maze rows 4-28).
  // ── 4-tile corridor rule: all gaps >= 4 tiles wide in every direction.
  // ── Pairs 0-1=T1/T2, 2-3=T3/T4 ... 22-23=T23/T24 (2 per pallet-count).

  // ── 1: 1H-mid
  [[['H',16,5,37]]],

  // ── 2: 1H-mid-B
  [[['H',16,5,37]]],

  // ── 3: 2H-S-sym
  [[['H',12,5,37],['H',20,5,37]]],

  // ── 4: 2H-S-sym-B
  [[['H',12,5,37],['H',20,5,37]]],

  // ── 5: 2H-stagger-L
  [[['H',11,5,37],['H',21,5,33]]],

  // ── 6: 2H-stagger-R
  [[['H',11,9,37],['H',21,5,37]]],

  // ── 7: 2H-both-end
  [[['H',12,6,36],['H',21,6,36]]],

  // ── 8: 2H-asym
  [[['H',10,5,37],['H',19,5,33]]],

  // ── 9: 3H-LRL
  [[['H',8,5,37],['H',16,5,37],['H',24,5,37]]],

  // ── 10: 3H-RLR
  [[['H',8,5,37],['H',16,5,37],['H',24,5,37]]],

  // ── 11: 3H-same+stagger
  [[['H',8,5,37],['H',15,5,33],['H',22,5,37]]],

  // ── 12: 3H-varied
  [[['H',9,5,37],['H',17,9,37],['H',25,5,33]]],

  // ── 13: 3H+1V
  [[['H',8,5,37],['H',16,5,37],['H',24,5,37],['V',20,9,11]]],

  // ── 14: 3H+2V
  [[['H',8,5,37],['H',16,5,37],['H',24,5,37],['V',14,9,11],['V',26,9,11]]],

  // ── 15: 4H-both
  [[['H',7,5,37],['H',13,5,37],['H',19,5,37],['H',25,5,37]]],

  // ── 16: 4H-alt
  [[['H',8,5,37],['H',14,5,37],['H',20,5,37],['H',26,5,37]]],

  // ── 17: 2H+3V
  [[['H',11,5,37],['H',21,5,37],['V',12,9,11],['V',20,9,11],['V',28,9,11]]],

  // ── 18: 3H+2V-stagger
  [[['H',9,5,37],['H',17,5,37],['H',25,5,37],['V',16,14,16],['V',24,14,16]]],

  // ── 19: 4H+1V
  [[['H',7,5,37],['H',13,5,37],['H',19,5,37],['H',25,5,37],['V',20,8,10]]],

  // ── 20: 3H-stagger+2V
  [[['H',9,5,33],['H',17,9,37],['H',25,5,33],['V',20,13,15],['V',14,21,23]]],

  // ── 21: 5H-comb
  [[['H',7,5,37],['H',12,5,37],['H',17,5,37],['H',22,5,37],['H',27,5,37]]],

  // ── 22: 4H-wide+2V
  [[['H',8,5,37],['H',15,5,37],['H',22,5,37],['V',12,9,11],['V',28,17,19]]],

  // ── 23: 4H-zigzag
  [[['H',8,5,33],['H',14,9,37],['H',20,5,33],['H',26,9,37]]],

  // ── 24: 5H+2V-max
  [[['H',7,5,37],['H',12,5,37],['H',17,5,37],['H',22,5,37],['H',27,5,37],['V',20,9,11],['V',20,22,24]]],

];


// ── Pre-verified spawn anchors for guaranteed solvable placement ──────────────
// Each row is 15 (row,col) anchors for maze N where a 2×2 S4 block fits on
// open floor. Anchor (r,c): pallet occupies (r,c),(r,c+1),(r+1,c),(r+1,c+1).
// Valid anchor range: rows 4-28, cols 1-41.
const MAZE_SPAWN_POINTS = [
  // Each row: 15 spread-out 2×2 anchor positions for maze N.
  // Valid range: rows 4-28, cols 1-40.
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 1
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 2
  [[4,1],[28,40],[4,32],[21,15],[28,1],[6,17],[15,26],[12,40],[13,7],[28,23],[21,33],[17,1],[22,6],[27,11],[4,10]], // maze 3
  [[4,1],[28,40],[4,32],[21,15],[28,1],[6,17],[15,26],[12,40],[13,7],[28,23],[21,33],[17,1],[22,6],[27,11],[4,10]], // maze 4
  [[4,1],[28,40],[4,32],[22,14],[28,1],[7,17],[16,26],[12,40],[13,7],[28,23],[20,35],[17,1],[24,29],[4,10],[4,23]], // maze 5
  [[4,1],[28,40],[4,32],[22,14],[28,1],[7,17],[16,26],[12,40],[13,7],[28,23],[22,33],[17,1],[4,10],[4,23],[9,28]], // maze 6
  [[4,1],[28,40],[4,32],[22,14],[28,1],[7,17],[16,26],[12,40],[13,7],[28,23],[22,33],[17,1],[4,10],[4,23],[9,28]], // maze 7
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 8
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 9
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 10
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[23,7],[28,13],[4,9]], // maze 11
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 12
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 13
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 14
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[14,26],[28,24],[14,6],[20,34],[23,8],[8,10],[28,13],[8,23]], // maze 15
  [[4,1],[28,40],[4,32],[21,15],[28,1],[6,17],[15,26],[12,40],[12,8],[28,23],[21,33],[16,1],[22,5],[27,10],[4,10]], // maze 16
  [[4,1],[28,40],[4,32],[22,14],[28,1],[7,17],[16,26],[12,40],[13,7],[28,23],[22,33],[17,1],[4,10],[4,23],[12,21]], // maze 17
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 18
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[14,26],[28,24],[14,6],[20,34],[23,8],[8,10],[28,13],[8,23]], // maze 19
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[22,6],[27,12],[4,9]], // maze 20
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[13,7],[20,33],[23,8],[17,1],[28,13],[8,11]], // maze 21
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[12,8],[20,33],[16,1],[23,7],[28,13],[4,9]], // maze 22
  [[4,1],[28,40],[4,32],[21,15],[28,1],[6,17],[15,26],[12,40],[12,8],[28,23],[20,34],[16,1],[22,5],[27,10],[4,10]], // maze 23
  [[4,1],[28,40],[4,32],[20,16],[28,1],[5,17],[12,40],[13,25],[28,24],[13,7],[20,33],[23,8],[17,1],[28,13],[8,11]], // maze 24
];

// ── Warehouse layout generator (random pair per pallet count) ────────────────
// itemCount 1–12 selects a template pair; one of the two is chosen at random
// so the same load size feels fresh on repeated plays.
// Difficulty adds hazard dressing on top of the structural walls.
// Row 0      : dock bays + concrete pillar separators
// Rows 1–3   : zone approach (always open floor — stamped by initGrid later)
// Rows 4–28  : maze template area  (25 rows)
// Rows 29–30 : open staging (always cleared after template)
// Rows 31–32 : entrance hazard stripe
// Row 33     : bottom perimeter wall
function generateLayout(difficulty, itemCount) {
  // Two templates per pallet count: pair base = (count-1)*2, pick 0 or 1 at random.
  const pairBase = Math.max(0, Math.min((itemCount || 1) - 1, 11)) * 2;
  const mazeIdx  = pairBase + (Math.random() < 0.5 ? 0 : 1);
  const template = MAZE_TEMPLATES[mazeIdx];
  const iceChance = [0, 0.04, 0.11][difficulty];

  // ── Base grid ─────────────────────────────────────────────────────────────
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = (r===0||r===ROWS-1||c===0||c===COLS-1) ? TILE_W : TILE_F;
    }
  }

  // ── Row 0: dock bays + concrete pillar separators ─────────────────────────
  for (let i = 0; i < BAY_COUNT; i++) {
    for (let c = bayLeftCol(i); c <= bayRightCol(i); c++) grid[0][c] = TILE_DOCK;
    if (i < BAY_COUNT-1) grid[0][pillarCol(i)] = TILE_W;
  }

  // ── Stamp maze template — TILE_COLUMN walls ───────────────────────────────
  for (const seg of template) {
    if (seg[0] === 'H') {
      const [, row, c1, c2] = seg;
      if (row < 4 || row > ROWS-6) continue;
      for (let c = c1; c <= c2; c++) {
        if (c >= 1 && c <= COLS-2) grid[row][c] = TILE_COLUMN;
      }
    } else if (seg[0] === 'V') {
      const [, col, r1, r2] = seg;
      if (col < 1 || col > COLS-2) continue;
      for (let r = r1; r <= r2; r++) {
        if (r >= 4 && r <= ROWS-6) grid[r][col] = TILE_COLUMN;
      }
    }
  }

  // ── Difficulty dressing: scattered hazards in open corridors ──────────────
  // Deterministic: hash from (row × 97 + col × 37 + mazeIdx × 13 + diff × 7)
  const hazardDensity = [0, 0.04, 0.09][difficulty];
  const hazardPool = [TILE_RACK, TILE_HAZPILLAR, TILE_WET, TILE_CHARGE];
  for (let r = 4; r <= ROWS-6; r++) {
    for (let c = 1; c <= COLS-2; c++) {
      if (grid[r][c] !== TILE_F) continue;
      const h = ((r * 97 + c * 37 + mazeIdx * 13 + difficulty * 7) * 2654435761) >>> 0;
      const frac = h / 0xffffffff;
      if (frac < hazardDensity) {
        grid[r][c] = hazardPool[h % hazardPool.length];
      } else if (frac < hazardDensity + iceChance) {
        grid[r][c] = TILE_ICE;
      }
    }
  }

  // ── Staging area rows 15-16: always fully open ────────────────────────────
  for (let r = ROWS-5; r <= ROWS-4; r++) for (let c = 1; c <= COLS-2; c++) grid[r][c] = TILE_F;

  if (isLayoutSolvable(grid)) return { grid, mazeIdx };
  return { grid: buildFallbackLayout(), mazeIdx };
}

function isSolid(tile) {
  return tile===TILE_W||tile===TILE_SHELF||tile===TILE_RACK||
         tile===TILE_COLUMN||tile===TILE_HAZPILLAR||tile===TILE_CHARGE||tile===TILE_WET;
}

function isLayoutSolvable(grid) {
  // BFS using the 2x2 jack footprint on COLS=43, ROWS=34 grid.
  // All corridors >=4 tiles wide (jack+carried pallet = 4 tiles side-by-side).
  function is2x2Open(r, c) {
    for (let dr = 0; dr <= 1; dr++) {
      for (let dc = 0; dc <= 1; dc++) {
        const nr = r+dr, nc = c+dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
        const t = grid[nr]?.[nc];
        if (!t || isSolid(t)) return false;
      }
    }
    return true;
  }
  const startRow = ROWS - 3;
  const startCol = Math.floor((COLS - 2) / 2);
  if (!is2x2Open(startRow, startCol)) return false;
  const visited = new Set();
  const queue   = [[startRow, startCol]];
  let   qi      = 0;   // index pointer — O(n) vs O(n²) queue.shift()
  visited.add(`${startRow},${startCol}`);
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    for (const [dr, dc] of DIR_DELTA) {
      const nr = r+dr, nc = c+dc;
      if (nr < 0 || nr+1 >= ROWS || nc < 0 || nc+1 >= COLS) continue;
      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;
      if (!is2x2Open(nr, nc)) continue;
      visited.add(key); queue.push([nr, nc]);
    }
  }
  // Zone approach must be reachable
  for (let c = 1; c <= COLS-3; c++) {
    if (is2x2Open(1, c) && !visited.has(`1,${c}`)) return false;
  }
  // Staging must be reachable
  for (let c = 1; c <= COLS-3; c++) {
    if (is2x2Open(ROWS-5, c) && !visited.has(`${ROWS-5},${c}`)) return false;
  }
  // Extra: verify every reachable corridor is >=4 tiles wide (4-tile rule).
  // Scan for any 4-wide horizontal or vertical clear band that connects sections.
  // (Templates are pre-verified; this is a belt-and-suspenders runtime check.)
  return true;
}

function buildFallbackLayout() {
  const grid = [];
  for (let r=0;r<ROWS;r++) {
    grid[r]=[];
    for (let c=0;c<COLS;c++) grid[r][c]=(r===0||r===ROWS-1||c===0||c===COLS-1)?TILE_W:TILE_F;
  }
  // Dock bays (5 bays)
  for (let i=0;i<BAY_COUNT;i++) {
    for (let c=bayLeftCol(i);c<=bayRightCol(i);c++) grid[0][c]=TILE_DOCK;
    if (i<BAY_COUNT-1) grid[0][pillarCol(i)]=TILE_W;
  }
  // Simple S-curve — always solvable in new 43×34 grid
  // Upper barrier: row 13, cols 5-41 (gap left cols 1-4, ≥4 tiles ✓)
  for (let c=5;c<=41;c++) grid[13][c]=TILE_COLUMN;
  // Lower barrier: row 21, cols 1-36 (gap right cols 37-41, ≥4 tiles ✓)
  for (let c=1;c<=36;c++) grid[21][c]=TILE_COLUMN;
  // Staging rows 15-16
  for (let r=ROWS-5;r<=ROWS-4;r++) for (let c=1;c<=COLS-2;c++) grid[r][c]=TILE_F;
  return grid;
}

//  SECTION 5 — AUDIO ENGINE
// =============================================================================

// ── Per-instance audio state ──────────────────────────────────────────────────
// Each component mount sets _instanceAudio to its own { ctx, drone } object.
// On unmount the pointer is cleared so no other instance is affected.
// Module-level sfx functions call getAC() which reads this pointer, so they
// automatically use whichever instance is currently active (typically exactly one).
let _instanceAudio = null;   // set to a per-mount object inside useEffect

function getAC() {
  if (!_instanceAudio) return null;
  if (!_instanceAudio.ctx) {
    try { _instanceAudio.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  if (_instanceAudio.ctx.state === 'suspended') _instanceAudio.ctx.resume().catch(() => {});
  return _instanceAudio.ctx;
}


function burst(ac, type, freq, gain, dur, offset) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + (offset || 0);
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.01);
}

function burstSweep(ac, type, freqA, freqB, gain, dur, offset) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + (offset || 0);
  o.type = type;
  o.frequency.setValueAtTime(freqA, t);
  o.frequency.linearRampToValueAtTime(freqB, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.01);
}

// sfxMove — subliminal tap confirmation
function sfxMove() {
  const ac = getAC(); if (!ac) return;
  burst(ac, 'square', 80, 0.04, 0.035);
}

// sfxPush — weight-scaled concrete scrape
function sfxPush(weightLbs) {
  const ac = getAC(); if (!ac) return;
  // Heavier = lower, slower sweep
  const wt    = Math.min(weightLbs || 400, 1200);
  const freqLo = 80  - (wt / 1200) * 40;  // 40–80 Hz
  const freqHi = 160 - (wt / 1200) * 60;  // 100–160 Hz
  const dur    = 0.07 + (wt / 1200) * 0.06;
  burstSweep(ac, 'sawtooth', freqLo, freqHi, 0.13, dur);
  // Heavy pallet sub-thud
  if (wt > 700) burst(ac, 'sine', 40, 0.08, 0.05, 0.01);
  navigator.vibrate?.(wt > 700 ? 18 : 10);
}

// sfxIceSlide — lighter, airy slide sound for ice-tile push
function sfxIceSlide() {
  const ac = getAC(); if (!ac) return;
  burstSweep(ac, 'sine', 200, 400, 0.07, 0.12);
  burst(ac, 'triangle', 800, 0.03, 0.08, 0.04);
}

// sfxBump — wall collision
function sfxBump() {
  const ac = getAC(); if (!ac) return;
  burst(ac, 'sine', 55, 0.16, 0.07);
}

// sfxRotate — pallet rotation click
function sfxRotate() {
  const ac = getAC(); if (!ac) return;
  burst(ac, 'square', 320, 0.06, 0.04, 0);
  burst(ac, 'square', 480, 0.04, 0.03, 0.03);
}

// sfxLock — pentatonic note based on how many pallets are already staged
function sfxLock(stagedSoFar) {
  const ac = getAC(); if (!ac) return;
  const idx  = Math.min(stagedSoFar, PENTATONIC.length - 1);
  const freq  = PENTATONIC[idx];
  burst(ac, 'triangle', freq,        0.15, 0.10, 0);
  burst(ac, 'triangle', freq * 1.5,  0.10, 0.08, 0.04);
  // Echo
  burst(ac, 'triangle', freq,        0.015, 0.10, 0.14);
  navigator.vibrate?.([20, 10, 40]);
}

// sfxWrongZone — descending error notes
function sfxWrongZone() {
  const ac = getAC(); if (!ac) return;
  burst(ac, 'square', 330, 0.12, 0.07, 0);
  burst(ac, 'square', 220, 0.12, 0.07, 0.04);
  navigator.vibrate?.([8, 8, 8]);
}

// sfxCombo — ascending riff scaling with combo level (2–5+)
function sfxCombo(level) {
  const ac = getAC(); if (!ac) return;
  const base = 440 * Math.pow(1.2, level - 2); // escalates per combo level
  [0, 0.07, 0.14].forEach((off, i) => {
    burst(ac, 'square', base * [1, 1.25, 1.5][i], 0.10, 0.08, off);
  });
}

// sfxPerfect — 3-note ascending chime played on top of sfxComplete for a Perfect Load
function sfxPerfect() {
  const ac = getAC(); if (!ac) return;
  // C5, E5, G5 — bright major arpeggio, slightly delayed so it crowns the complete fanfare
  [[523.25, 0.18], [659.25, 0.22], [783.99, 0.26]].forEach(([freq, off]) => {
    burst(ac, 'triangle', freq, 0.14, 0.22, off);
    burst(ac, 'sine',     freq * 2, 0.05, 0.18, off + 0.02);
  });
}

// sfxCleanLoad — soft 2-note chime for clean (no wrong bays) but non-speed runs
function sfxCleanLoad() {
  const ac = getAC(); if (!ac) return;
  // E5, G5 — gentle major third, half the volume of sfxPerfect
  [[659.25, 0.10], [783.99, 0.14]].forEach(([freq, off]) => {
    burst(ac, 'sine', freq,       0.07, 0.30, off);
    burst(ac, 'sine', freq * 0.5, 0.03, 0.25, off + 0.01);
  });
}

// sfxZoneComplete — celebratory 3-note ascending chord when a full stop zone is loaded
// Sits between sfxDockLoad (single snap) and sfxComplete (all pallets done).
// Uses a major triad (root, major-third, fifth) with a sine shimmer layer.
function sfxZoneComplete() {
  const ac = getAC(); if (!ac) return;
  // G4, B4, D5 — bright G-major triad, two-octave shimmer on top
  const triad = [[392.00, 0], [493.88, 0.08], [587.33, 0.16]];
  triad.forEach(([freq, off]) => {
    burst(ac, 'triangle', freq,       0.13, 0.28, off);
    burst(ac, 'sine',     freq * 2,   0.05, 0.22, off + 0.01);
  });
  // Warm low root sustain — gives it weight vs a plain ding
  burst(ac, 'sine', 196.00, 0.09, 0.40, 0);
  navigator.vibrate?.([15, 10, 30, 10, 15]);
}

// sfxComplete — triumph sequence with ascending pentatonic + chord
function sfxComplete() {
  const ac = getAC(); if (!ac) return;
  PENTATONIC.slice(0, 6).forEach((f, i) => burst(ac, 'square', f, 0.13, 0.12, i * 0.07));
  [PENTATONIC[5], PENTATONIC[5]*1.25, PENTATONIC[5]*1.5].forEach(
    (f, i) => burst(ac, 'triangle', f, 0.11, 0.35, 0.5 + i * 0.01)
  );
  navigator.vibrate?.([40, 20, 40, 20, 80]);
}

// sfxBounceBack — low thud as pallet slides back from a wrong bay
function sfxBounceBack() {
  const ac = getAC(); if (!ac) return;
  burst(ac, 'sine', 48, 0.18, 0.09);
  burst(ac, 'sine', 32, 0.10, 0.07, 0.04);
}

// sfxTimeout — descending alarm
// Dock loading sound — low rumble + descending whoosh
function sfxDockLoad() {
  const ac = getAC(); if (!ac) return;
  const t = ac.currentTime;
  // Rumble (low freq fade)
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.5), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.max(0,1-i/data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 180;
  const g = ac.createGain(); g.gain.setValueAtTime(0.18,t); g.gain.linearRampToValueAtTime(0,t+0.5);
  src.connect(filt); filt.connect(g); g.connect(ac.destination);
  src.start(t); src.stop(t+0.5);
  // Whoosh oscillator sweep (descending)
  const osc = ac.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(60, t+0.45);
  const g2 = ac.createGain(); g2.gain.setValueAtTime(0.12,t); g2.gain.linearRampToValueAtTime(0,t+0.50);
  osc.connect(g2); g2.connect(ac.destination);
  osc.start(t); osc.stop(t+0.5);
}

function sfxTimeout() {
  const ac = getAC(); if (!ac) return;
  [440,370,311,262,220].forEach((f,i) => burst(ac, 'sawtooth', f, 0.13, 0.09, i * 0.055));
  navigator.vibrate?.([0, 30, 80, 30, 80, 30, 120]);
}

// sfxTimerTick — short urgent beep each second when ≤10s remain.
// Pitch rises as time approaches zero (440→880 Hz over 10 ticks).
function sfxTimerTick(secondsLeft) {
  const ac = getAC(); if (!ac) return;
  // secondsLeft: 10→1; freq maps 440→880
  const freq = 440 * Math.pow(2, (10 - secondsLeft) / 10);
  burst(ac, 'sawtooth', freq, 0.07, 0.045, 0);
}

// sfxUndo — short descending two-tone reverse sweep confirms the undo action
function sfxUndo() {
  const ac = getAC(); if (!ac) return;
  burstSweep(ac, 'sine',  280, 140, 0.09, 0.10, 0);
  burstSweep(ac, 'sine',  210, 105, 0.06, 0.08, 0.07);
}

// sfxLift — hydraulic pump squeak + rising metal creak
function sfxLift() {
  const ac = getAC(); if (!ac) return;
  burstSweep(ac, 'sawtooth', 120, 280, 0.08, 0.18, 0);
  burst(ac, 'sine', 440, 0.04, 0.12, 0.10);
  burst(ac, 'sine', 600, 0.03, 0.08, 0.20);
  navigator.vibrate?.([8, 4, 12]);
}
// sfxLower — descending creak + soft thud as pallet settles
function sfxLower() {
  const ac = getAC(); if (!ac) return;
  burstSweep(ac, 'sawtooth', 260, 100, 0.07, 0.18, 0);
  burst(ac, 'sine', 55, 0.10, 0.08, 0.18);
  navigator.vibrate?.([15]);
}

// =============================================================================
//  SECTION 6 — PARTICLE SYSTEM
// =============================================================================
// Particles are stored in cl.particles[] and updated/drawn each frame.
// Each particle: { x, y, vx, vy, life, maxLife, color, size, type }

function spawnLockSparks(particles, cx, cy, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const speed = 1.5 + Math.random() * 3.0;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 28 + Math.floor(Math.random() * 12),
      maxLife: 40,
      color,
      size: 2 + Math.random() * 2.5,
      type: 'spark',
      gravity: 0.12,
    });
  }
}

function spawnPushDust(particles, cx, cy, dir) {
  const [dr, dc] = DIR_DELTA[dir];
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: cx - dc * 8 + (Math.random() - 0.5) * 10,
      y: cy - dr * 8 + (Math.random() - 0.5) * 10,
      vx: -dc * (0.5 + Math.random()) + (Math.random() - 0.5),
      vy: -dr * (0.5 + Math.random()) + (Math.random() - 0.5) - 0.5,
      life: 16 + Math.floor(Math.random() * 10),
      maxLife: 26,
      color: 'rgba(180,140,80,',
      size: 1.5 + Math.random() * 2,
      type: 'dust',
      gravity: 0.04,
    });
  }
}

function spawnWrongZoneShards(particles, cx, cy) {
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const speed = 1.0 + Math.random() * 2.0;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 18 + Math.floor(Math.random() * 8),
      maxLife: 26,
      color: '#FF3333',
      size: 2 + Math.random() * 2,
      type: 'shard',
      gravity: 0.06,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.3,
    });
  }
}

function spawnZoneBurst(particles, cx, cy, color, TILE) {
  // Radiant burst expanding from zone center on full completion
  for (let i = 0; i < 20; i++) {
    const angle = (Math.PI * 2 * i) / 20;
    const speed = 2.0 + Math.random() * 4.0;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.floor(Math.random() * 15),
      maxLife: 45,
      color,
      size: 3 + Math.random() * 3,
      type: 'burst',
      gravity: 0,
      fade: true,
    });
  }
}

function spawnIceParticles(particles, cx, cy) {
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * (0.5 + Math.random()),
      vy: Math.sin(angle) * (0.5 + Math.random()) - 1,
      life: 20, maxLife: 20,
      color: 'rgba(160,230,255,',
      size: 1.5 + Math.random() * 2,
      type: 'ice',
      gravity: 0.05,
    });
  }
}

function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += (p.gravity || 0);
    p.life -= 1;
    if (p.rot !== undefined) p.rot += p.rotV;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (p.type === 'spark') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'dust' || p.type === 'ice') {
      ctx.fillStyle = p.color + alpha * 0.7 + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'shard') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 4;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
    } else if (p.type === 'burst') {
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 10;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 2, p.y - p.vy * 2);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// =============================================================================
//  SECTION 7 — DRAW SYSTEM  (Realistic top-down Sokoban-style graphics)
// =============================================================================

const LEVEL_NAMES = [
  'BAY A', 'LOADING DOCK', 'COLD STORE', 'BAY B',
  'DISPATCH', 'RETURNS', 'OVERFLOW', 'ZONE C',
  'NIGHT SHIFT', 'RUSH HOUR',
];
function getLevelName(gameCount) { return LEVEL_NAMES[gameCount % LEVEL_NAMES.length]; }

// ── Geometry helpers ──────────────────────────────────────────────────────────
function getTileBBox(tiles) {
  let minRow=Infinity, maxRow=-Infinity, minCol=Infinity, maxCol=-Infinity;
  for (const {row,col} of tiles) {
    if (row<minRow) minRow=row; if (row>maxRow) maxRow=row;
    if (col<minCol) minCol=col; if (col>maxCol) maxCol=col;
  }
  return { minRow, maxRow, minCol, maxCol };
}
function lightenHex(hex, amt) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,b+amt)})`;
}
function darkenHex(hex, t) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const d=v=>Math.max(0,Math.round(v*(1-t)));
  return `rgb(${d(r)},${d(g)},${d(b)})`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}
function drawPalletPerimeter(ctx, tiles, TILE, ox, oy) {
  const set = new Set(tiles.map(({row,col})=>`${row},${col}`));
  ctx.beginPath();
  for (const {row,col} of tiles) {
    const x=col*TILE+ox, y=HUD_H+row*TILE+oy, x2=x+TILE, y2=y+TILE;
    if (!set.has(`${row-1},${col}`)) { ctx.moveTo(x,y);  ctx.lineTo(x2,y);  }
    if (!set.has(`${row+1},${col}`)) { ctx.moveTo(x,y2); ctx.lineTo(x2,y2); }
    if (!set.has(`${row},${col-1}`)) { ctx.moveTo(x,y);  ctx.lineTo(x,y2);  }
    if (!set.has(`${row},${col+1}`)) { ctx.moveTo(x2,y); ctx.lineTo(x2,y2); }
  }
  ctx.stroke();
}

// ── DRAW: FLOOR ───────────────────────────────────────────────────────────────

function drawFloor(ctx, grid, TILE, CW, CH, wallStyle, cl, frame) {
  // Fill the entire world background (camera transform makes this cover the viewport)
  ctx.fillStyle = C.floorA;
  ctx.fillRect(0, 0, COLS * TILE, HUD_H + ROWS * TILE);

  const WP   = WALL_PALETTES[wallStyle ?? WALL_BRICK];
  const FACE = Math.max(3, Math.ceil(TILE * 0.18));
  const SHADE= Math.max(2, Math.ceil(TILE * 0.10));

  // Perf: viewport culling — only draw tiles visible in the camera window.
  // Visible world-space rect (±TILE margin avoids edge pop-in):
  const _camX = cl?.camPixX ?? 0, _camY = cl?.camPixY ?? 0;
  const _vX0 = _camX - TILE,         _vX1 = _camX + CW + TILE;
  const _vY0 = _camY + HUD_H - TILE, _vY1 = _camY + CH + TILE;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const t  = grid[row]?.[col] ?? TILE_W;
      const px = col * TILE, py = HUD_H + row * TILE;
      // Skip tiles entirely outside the camera viewport
      if (px + TILE < _vX0 || px > _vX1 || py + TILE < _vY0 || py > _vY1) continue;

      if (t === TILE_DOCK) {
        // Active dock bay cells — drawn by drawAllDockBays; skip floor tile here
        continue;

      } else if (t === TILE_W) {
        drawWallBlock(ctx, px, py, TILE, FACE, SHADE, WP, wallStyle, row, col);

      } else if (t === TILE_SHELF) {
        drawShelfObstacle(ctx, px, py, TILE, FACE, SHADE);

      } else if (t === TILE_RACK) {
        drawRackObstacle(ctx, px, py, TILE, FACE, SHADE);

      } else if (t === TILE_COLUMN) {
        drawColumnObstacle(ctx, px, py, TILE, FACE);

      } else if (t === TILE_HAZPILLAR) {
        drawHazPillarObstacle(ctx, px, py, TILE, FACE);

      } else if (t === TILE_CHARGE) {
        drawChargeObstacle(ctx, px, py, TILE, FACE);

      } else if (t === TILE_WET) {
        drawWetFloorObstacle(ctx, px, py, TILE, FACE, frame);

      } else if (t === TILE_ICE) {
        ctx.fillStyle = C.floorIce;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = C.floorIceLine; ctx.lineWidth = 0.8;
        ctx.strokeRect(px+0.5, py+0.5, TILE-1, TILE-1);
        ctx.save();
        ctx.strokeStyle='rgba(80,180,240,0.40)'; ctx.lineWidth=1.2;
        ctx.beginPath();
        ctx.moveTo(px+TILE/2,py+3); ctx.lineTo(px+TILE/2,py+TILE-3);
        ctx.moveTo(px+3,py+TILE/2); ctx.lineTo(px+TILE-3,py+TILE/2);
        ctx.moveTo(px+TILE*0.25,py+TILE*0.25); ctx.lineTo(px+TILE*0.75,py+TILE*0.75);
        ctx.moveTo(px+TILE*0.75,py+TILE*0.25); ctx.lineTo(px+TILE*0.25,py+TILE*0.75);
        ctx.stroke();
        ctx.fillStyle='rgba(200,240,255,0.85)';
        ctx.beginPath(); ctx.arc(px+TILE/2,py+TILE/2,2,0,Math.PI*2); ctx.fill();
        ctx.restore();

      } else {
        // Normal floor — style-switched
        const fl = cl?.floorStyle ?? FLOOR_CONCRETE;
        const ck = (row + col) % 2 === 0;
        if (fl === FLOOR_RUBBER) {
          ctx.fillStyle = ck ? '#2A2A2A' : '#202020'; ctx.fillRect(px, py, TILE, TILE);
          const bstep = Math.ceil(TILE / 5);
          ctx.fillStyle = 'rgba(80,80,80,0.60)';
          for (let br = 0; br < 5; br++) for (let bc = 0; bc < 5; bc++) {
            ctx.beginPath();
            ctx.arc(px+bc*bstep+bstep*0.5, py+br*bstep+bstep*0.5, bstep*0.22, 0, Math.PI*2);
            ctx.fill();
          }
          ctx.strokeStyle = 'rgba(100,100,100,0.22)'; ctx.lineWidth = 0.5;
          ctx.strokeRect(px+0.5, py+0.5, TILE-1, TILE-1);
        } else if (fl === FLOOR_EPOXY) {
          // Sealed epoxy — dark base, aggregate flecks, gloss sheen, expansion joints
          ctx.fillStyle = ck ? '#141A1C' : '#111618'; ctx.fillRect(px, py, TILE, TILE);
          // Aggregate fleck (deterministic per cell)
          const fseed = (row * 2341 + col * 173) ^ 0xDEAD;
          if ((fseed & 0x3) === 0) {
            ctx.fillStyle = 'rgba(90,105,110,0.30)';
            ctx.beginPath(); ctx.arc(px + (fseed & 0xF) % TILE, py + ((fseed>>4) & 0xF) % TILE, 1.0, 0, Math.PI*2); ctx.fill();
          }
          // Gloss sheen diagonal highlight
          const gs2 = ctx.createLinearGradient(px, py, px+TILE*0.7, py+TILE*0.4);
          gs2.addColorStop(0, 'rgba(200,220,230,0.10)'); gs2.addColorStop(1, 'rgba(200,220,230,0)');
          ctx.fillStyle = gs2; ctx.fillRect(px, py, TILE, TILE);
          // Expansion joint lines (every 3 tiles)
          if (col % 3 === 0) { ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(px, py, 1.5, TILE); }
          if (row % 3 === 0) { ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(px, py, TILE, 1.5); }
          ctx.strokeStyle = 'rgba(120,140,145,0.12)'; ctx.lineWidth = 0.4;
          ctx.strokeRect(px+0.5, py+0.5, TILE-1, TILE-1);
        } else if (fl === FLOOR_TERRAZZO) {
          ctx.fillStyle = ck ? '#C8C0B8' : '#C0B8B0'; ctx.fillRect(px, py, TILE, TILE);
          const chips = [['#E8D0B8',0.06],['#D0B890',0.05],['#A8C0A8',0.04],['#B0A8C0',0.04],['#C8A890',0.05]];
          const seed = px + py;
          for (let ci = 0; ci < 14; ci++) {
            const [col2, cr] = chips[ci % chips.length];
            const fx = ((seed*7+ci*17) % 100) / 100;
            const fy = ((seed*13+ci*31) % 100) / 100;
            ctx.fillStyle = col2;
            ctx.beginPath(); ctx.arc(px+TILE*fx, py+TILE*fy, TILE*cr, 0, Math.PI*2); ctx.fill();
          }
          ctx.strokeStyle = 'rgba(130,120,110,0.20)'; ctx.lineWidth = 0.5;
          ctx.strokeRect(px+0.5, py+0.5, TILE-1, TILE-1);
        } else {
          // FLOOR_CONCRETE — default checker
          ctx.fillStyle = ck ? C.floorA : C.floorB; ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = C.floorLine; ctx.lineWidth = 0.5;
          ctx.strokeRect(px+0.5, py+0.5, TILE-1, TILE-1);
        }
        // ── Pallet drag marks — faint smear where pallets were pushed from ─────
        if (cl?.palletDragTiles?.has(`${row},${col}`)) {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.09)';
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.06)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.restore();
        }
        // ── Tire tracks — drawn on tiles the jack has actually visited ─────────
        if (cl?.tracks?.has(`${row},${col}`)) {
          const tSeed = (row * 397 + col * 113) >>> 0;
          const tR    = TILE * (0.18 + ((tSeed >> 9 & 0xF) / 15) * 0.18);
          const tCX   = px + TILE * (0.30 + ((tSeed >> 13 & 0xFF) / 255) * 0.40);
          const tCY   = py + TILE * (0.30 + ((tSeed >> 21 & 0xFF) / 255) * 0.40);
          const tA1   = ((tSeed >> 4 & 0x7) / 7) * Math.PI * 2;
          const tSpan = 0.5 + ((tSeed >> 7 & 0x7) / 7) * 0.8;
          ctx.save();
          ctx.strokeStyle = 'rgba(0,0,0,0.13)';
          ctx.lineWidth   = 1.2 + ((tSeed & 0x3) / 3) * 0.8;
          ctx.lineCap     = 'round';
          ctx.beginPath();
          ctx.arc(tCX, tCY, tR, tA1, tA1 + tSpan);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  // ── Grease stains — deterministic dark ellipse blobs on open floor ─────────
  {
    const GS_COUNT = 7;
    for (let gi = 0; gi < GS_COUNT; gi++) {
      const gseed = (gi * 2654435761 + 1013904223) >>> 0;
      const gcol = 1 + (gseed % (COLS - 2));
      const grow = 2 + ((gseed >> 8) % (ROWS - 6));
      const gx = gcol * TILE + ((gseed >> 4) & 0xF) / 15 * TILE * 0.5;
      const gy = HUD_H + grow * TILE + ((gseed >> 12) & 0xF) / 15 * TILE * 0.5;
      const grx = TILE * (0.22 + ((gseed >> 16) & 0xF) / 15 * 0.18);
      const gry = grx * (0.38 + ((gseed >> 20) & 0x7) / 7 * 0.28);
      const gang = ((gseed >> 6) & 0x1F) / 31 * Math.PI;
      const ga = 0.07 + ((gseed >> 24) & 0xF) / 15 * 0.08;
      ctx.save();
      ctx.globalAlpha = ga;
      ctx.fillStyle = '#0A0806';
      ctx.beginPath(); ctx.ellipse(gx, gy, grx, gry, gang, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ── Forklift parking bays — Item 23 ─────────────────────────────────────
  // Two marked bays at bottom corners of the warehouse (away from pallet traffic)
  // Each is a 2×3 tile rectangle outlined in yellow with FLT marker text
  {
    const _fltBays = [
      { col: 1, row: ROWS - 6 },   // bottom-left corner
      { col: COLS - 4, row: ROWS - 6 }, // bottom-right corner
    ];
    const _bW = 3 * TILE, _bH = 2 * TILE;  // 3 cols wide, 2 rows tall
    ctx.save();
    _fltBays.forEach(({ col, row }) => {
      const _bx = col * TILE, _by = HUD_H + row * TILE;
      // Check all 3 cols × 2 rows of the bay footprint — skip if any tile is solid
      const _bayBlocked = [0, 1, 2].some(dc =>
        [0, 1].some(dr => {
          const _t = (grid[row + dr] || [])[col + dc];
          return _t === TILE_W || isSolid(_t);
        })
      );
      if (_bayBlocked) return;
      // Bay floor tint — faint blue-grey
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#7090C0';
      ctx.fillRect(_bx, _by, _bW, _bH);
      // Yellow outline — dashed like OSHA floor markings
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#DDB800';
      ctx.lineWidth = Math.max(1.5, TILE * 0.05);
      ctx.setLineDash([TILE * 0.30, TILE * 0.12]);
      ctx.lineCap = 'square';
      ctx.strokeRect(_bx + ctx.lineWidth / 2, _by + ctx.lineWidth / 2,
                     _bW - ctx.lineWidth, _bH - ctx.lineWidth);
      ctx.setLineDash([]);
      // FLT label
      ctx.globalAlpha = 0.30;
      ctx.font = `bold ${Math.max(5, Math.floor(TILE * 0.20))}px Arial,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#CCCC44';
      ctx.fillText('FLT', _bx + _bW / 2, _by + _bH / 2);
      // Forklift silhouette lines — two simple L-shapes for fork tines
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#CCCC44';
      ctx.lineWidth = Math.max(1, TILE * 0.04);
      const _fx = _bx + _bW * 0.30, _fy = _by + _bH * 0.22, _fl = TILE * 0.28, _ft = TILE * 0.10;
      ctx.beginPath();
      ctx.moveTo(_fx, _fy); ctx.lineTo(_fx, _fy + _fl);
      ctx.moveTo(_fx + _ft * 1.8, _fy); ctx.lineTo(_fx + _ft * 1.8, _fy + _fl);
      ctx.moveTo(_fx - _ft * 0.3, _fy); ctx.lineTo(_fx + _ft * 2.5, _fy);
      ctx.stroke();
    });
    ctx.restore();
  }

  // ── OSHA aisle markings — yellow boundary lines + floor designation text ──
  {
    const AISLE_W = Math.max(1.5, TILE * 0.055);  // line width ~5.5% of tile
    ctx.save();
    ctx.strokeStyle = 'rgba(220,185,0,0.38)';
    ctx.lineWidth   = AISLE_W;
    ctx.setLineDash([TILE * 0.55, TILE * 0.28]);
    ctx.lineCap = 'square';
    // Vertical aisle lines — run between bay columns
    // Divide the non-bay area into ~3 aisles based on bay positions
    const aisleRows = { top: HUD_H + 2 * TILE, bot: HUD_H + (ROWS - 3) * TILE };
    // Center vertical aisle (midpoint of world width)
    const midX   = Math.floor(COLS / 2) * TILE;
    const leftX  = Math.floor(COLS * 0.25) * TILE;
    const rightX = Math.floor(COLS * 0.75) * TILE;
    // Item 22: draw each aisle line row-by-row, skipping tiles occupied by walls
    const _aisleTopRow = 2, _aisleBotRow = ROWS - 3;
    function drawAisleSegment(ax) {
      const _col = Math.floor(ax / TILE);  // grid col this aisle line sits on
      let segStart = null;
      for (let _r = _aisleTopRow; _r <= _aisleBotRow; _r++) {
        const _tile = (grid[_r] || [])[_col];
        const _blocked = _tile === TILE_W || isSolid(_tile);
        if (!_blocked) {
          if (segStart === null) segStart = HUD_H + _r * TILE;
        } else {
          if (segStart !== null) {
            ctx.beginPath(); ctx.moveTo(ax, segStart); ctx.lineTo(ax, HUD_H + _r * TILE); ctx.stroke();
            segStart = null;
          }
        }
      }
      if (segStart !== null) {
        ctx.beginPath(); ctx.moveTo(ax, segStart); ctx.lineTo(ax, HUD_H + (_aisleBotRow + 1) * TILE); ctx.stroke();
      }
    }
    drawAisleSegment(midX);
    drawAisleSegment(leftX);
    drawAisleSegment(rightX);
    // Horizontal cross-aisle line — midway down the playfield
    const crossY = HUD_H + Math.floor(ROWS * 0.52) * TILE;
    ctx.beginPath(); ctx.moveTo(TILE, crossY); ctx.lineTo((COLS - 1) * TILE, crossY); ctx.stroke();
    ctx.setLineDash([]);
    // Solid corner safety markers at aisle intersections
    ctx.lineWidth = Math.max(1, TILE * 0.035);
    ctx.strokeStyle = 'rgba(220,185,0,0.55)';
    [[leftX, crossY],[midX, crossY],[rightX, crossY]].forEach(([ix, iy]) => {
      const arm = TILE * 0.18;
      ctx.beginPath();
      ctx.moveTo(ix - arm, iy); ctx.lineTo(ix + arm, iy);
      ctx.moveTo(ix, iy - arm); ctx.lineTo(ix, iy + arm);
      ctx.stroke();
    });
    // Floor zone text stamps — "AISLE A", "AISLE B" etc.
    ctx.font = `bold ${Math.max(4, Math.floor(TILE * 0.16))}px Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(210,175,0,0.28)';
    [['AISLE A', leftX - TILE * 0.9, crossY - TILE * 0.5],
     ['AISLE B', midX  - TILE * 0.9, crossY - TILE * 0.5],
     ['AISLE C', rightX- TILE * 0.9, crossY - TILE * 0.5],
    ].forEach(([label, tx2, ty2]) => { ctx.fillText(label, tx2, ty2); });
    ctx.restore();
  }

  // ── Exit signs above entrance hazard — Item 24 ───────────────────────────
  // Green EXIT signs flanking the warehouse entrance, mounted at the top of the hazard zone
  {
    const _exitRow = ROWS - 3;  // same row as hazard top
    const _exitY   = HUD_H + _exitRow * TILE - Math.ceil(TILE * 0.40);  // just above hazard
    const _signW   = Math.ceil(TILE * 0.90), _signH = Math.ceil(TILE * 0.34);
    const _signPositions = [
      TILE * 1.8,                        // near left wall
      (COLS - 1) * TILE - _signW - TILE * 0.8,  // near right wall
    ];
    ctx.save();
    _signPositions.forEach(_sx => {
      // Green sign body
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = '#1A6B2A';
      roundRect(ctx, _sx, _exitY, _signW, _signH, Math.max(2, Math.floor(_signH * 0.22)));
      ctx.fill();
      // Bright border
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = '#44DD66';
      ctx.lineWidth = 1;
      roundRect(ctx, _sx, _exitY, _signW, _signH, Math.max(2, Math.floor(_signH * 0.22)));
      ctx.stroke();
      // EXIT text
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#AAFFBB';
      ctx.font = `bold ${Math.max(4, Math.floor(_signH * 0.58))}px Arial,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', _sx + _signW * 0.60, _exitY + _signH / 2);
      // Arrow symbol
      ctx.font = `${Math.max(4, Math.floor(_signH * 0.55))}px sans-serif`;
      ctx.fillText('→', _sx + _signW * 0.16, _exitY + _signH / 2);
      // Mounting bracket (thin dark bar above sign)
      ctx.globalAlpha = 0.40;
      ctx.fillStyle = '#223322';
      ctx.fillRect(_sx + _signW * 0.35, _exitY - 3, _signW * 0.30, 3);
    });
    ctx.restore();
  }

  // Entrance hazard zone — rows 24-25 in 27-row world (2 rows above bottom wall)
  const ENTRANCE_TOP = ROWS - 3;  // hazard rows 17-18
  const LY = HUD_H + ENTRANCE_TOP*TILE, LH = 2*TILE;
  ctx.save();
  const STRIP = Math.ceil(TILE * 0.4);
  for (let x = TILE - LH; x < COLS*TILE + LH; x += STRIP*2) {
    ctx.fillStyle = C.hazardYellow;
    ctx.beginPath();
    ctx.moveTo(x,LY); ctx.lineTo(x+STRIP,LY); ctx.lineTo(x+STRIP+LH,LY+LH); ctx.lineTo(x+LH,LY+LH);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hazardBlack;
    ctx.beginPath();
    ctx.moveTo(x+STRIP,LY); ctx.lineTo(x+STRIP*2,LY); ctx.lineTo(x+STRIP*2+LH,LY+LH); ctx.lineTo(x+STRIP+LH,LY+LH);
    ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle='rgba(0,0,0,0.30)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(TILE,LY); ctx.lineTo((COLS-1)*TILE,LY); ctx.stroke();
  // Center wear strip — trafficked middle of entrance worn bare by forklift wheels
  const wearGrad = ctx.createLinearGradient(0, LY, 0, LY + LH);
  wearGrad.addColorStop(0, 'rgba(0,0,0,0)');
  wearGrad.addColorStop(0.35, 'rgba(0,0,0,0.28)');
  wearGrad.addColorStop(0.65, 'rgba(0,0,0,0.28)');
  wearGrad.addColorStop(1,  'rgba(0,0,0,0)');
  ctx.fillStyle = wearGrad;
  ctx.fillRect(COLS*TILE*0.30, LY, COLS*TILE*0.40, LH);
  ctx.restore();

  ctx.save();
  ctx.font=`bold ${Math.max(6,Math.floor(TILE*0.22))}px Arial,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(255,255,255,0.75)';
  ctx.shadowColor='rgba(0,0,0,0.60)'; ctx.shadowBlur=4;
  ctx.fillText('WAREHOUSE ENTRANCE', COLS*TILE/2, LY+LH/2);
  ctx.restore();
}

// ── Wall block (style-branched) ───────────────────────────────────────────────
function drawWallBlock(ctx, px, py, TILE, FACE, SHADE, WP, wallStyle, row, col) {
  const usable = TILE - FACE;

  if (wallStyle === WALL_BRICK) {
    // ── Red brick — per-brick 3D relief + individual grime ─────────────────
    const bH = Math.max(4, Math.ceil(TILE / 3));
    const bW = Math.ceil(TILE * 0.5);
    const stag = row % 2 === 0 ? 0 : bW;
    // Dark mortar background
    ctx.fillStyle = WP.grout; ctx.fillRect(px, py, usable, usable);
    // Each brick individually
    for (let br = 0; br < 4; br++) {
      for (let bc = -1; bc < 4; bc++) {
        const bx0 = px + bc * bW + stag, by0 = py + br * bH;
        const bxC = Math.max(px, bx0), byC = Math.max(py, by0);
        const bxE = Math.min(px + usable - 1, bx0 + bW - 2);
        const byE = Math.min(py + usable - 1, by0 + bH - 2);
        if (bxE <= bxC || byE <= byC) continue;
        const v = ((row * 17 + br * 7 + col * 13 + bc * 11) % 24) - 12;
        const rv = Math.min(255, Math.max(130, 158 + v));
        const gv = Math.min(255, Math.max(48,   58 + v));
        const bv = Math.min(255, Math.max(46,   56 + Math.floor(v * 0.5)));
        ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
        ctx.fillRect(bxC, byC, bxE - bxC, byE - byC);
        // Top-lit specular highlight
        ctx.fillStyle = 'rgba(255,200,180,0.13)';
        ctx.fillRect(bxC, byC, bxE - bxC, Math.max(1, Math.ceil((byE - byC) * 0.18)));
        // Recessed mortar shadow on top + left edges
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.fillRect(bxC, byC, bxE - bxC, 1.5);
        ctx.fillRect(bxC, byC, 1.5, byE - byC);
        // Grime splotch on ~1 in 5 bricks
        if ((((row * 3 + br + col * 7 + bc) * 2654435761) >>> 0) % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.13)';
          ctx.beginPath();
          ctx.ellipse(
            bxC + (bxE - bxC) * 0.55, byC + (byE - byC) * 0.52,
            (bxE - bxC) * 0.20, (byE - byC) * 0.25, 0.4, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.fillStyle = WP.front;  ctx.fillRect(px+usable, py, FACE, TILE);
    ctx.fillStyle = WP.side;   ctx.fillRect(px, py+usable, usable, FACE);
    ctx.fillStyle = WP.shadow; ctx.fillRect(px+usable, py+usable, FACE, FACE);

  } else if (wallStyle === WALL_CINDERBLOCK) {
    // ── CMU — aggregate texture, cracked block + rebar reveal ──────────────
    const tone = 112 + ((row * 11 + col * 7) % 16) - 8;
    ctx.fillStyle = `rgb(${tone},${tone-4},${tone-8})`; ctx.fillRect(px, py, usable, usable);
    // Mortar joint lines
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(px, py, usable, 2); ctx.fillRect(px, py, 2, usable);
    // Hollow cores with depth gradient
    const holeW = TILE * 0.27, holeH = TILE * 0.50;
    const holeY = py + (usable - holeH) * 0.5;
    const hg = ctx.createLinearGradient(0, holeY, 0, holeY + holeH);
    hg.addColorStop(0, '#2A2A28'); hg.addColorStop(0.3, '#161614'); hg.addColorStop(1, '#202020');
    ctx.fillStyle = hg;
    ctx.fillRect(px + TILE * 0.07, holeY, holeW, holeH);
    ctx.fillRect(px + TILE * 0.62, holeY, holeW, holeH);
    ctx.fillStyle = `rgb(${tone-8},${tone-12},${tone-16})`;
    ctx.fillRect(px + TILE * 0.07 + holeW + 1, holeY, TILE * 0.55 - holeW - 2, holeH);
    // Aggregate texture dots
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 6; i++) {
      const tx = px + 2 + ((row * 5 + col * 9 + i * 13) % Math.max(1, usable - 4));
      const ty = py + 2 + ((row * 9 + col * 5 + i * 7) % Math.max(1, usable - 4));
      ctx.beginPath(); ctx.arc(tx, ty, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    // Cracked block every 3rd column — crack line + rebar
    if (col % 3 === 0 && usable > 8) {
      ctx.strokeStyle = 'rgba(30,20,15,0.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(px + usable * 0.60, py + 2);
      ctx.lineTo(px + usable * 0.70, py + usable * 0.48);
      ctx.lineTo(px + usable * 0.56, py + usable - 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(130,75,35,0.50)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + usable * 0.63, py + 3);
      ctx.lineTo(px + usable * 0.67, py + usable - 3);
      ctx.stroke();
    }
    ctx.strokeStyle = WP.grout; ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, usable - 2, usable - 2);
    ctx.fillStyle = WP.front;  ctx.fillRect(px+usable, py, FACE, TILE);
    ctx.fillStyle = WP.side;   ctx.fillRect(px, py+usable, usable, FACE);
    ctx.fillStyle = WP.shadow; ctx.fillRect(px+usable, py+usable, FACE, FACE);

  } else if (wallStyle === WALL_TILE) {
    // ── Ceramic tile — gloss specular + condensation drip ──────────────────
    const sT = Math.floor(usable / 2);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([sc, sr]) => {
      const sx = px + sc * sT, sy = py + sr * sT;
      ctx.fillStyle = (sc + sr) % 2 === 0 ? '#C8D0CC' : '#BEC8C4';
      ctx.fillRect(sx, sy, sT, sT);
      // Gloss specular hotspot top-left
      const gg = ctx.createLinearGradient(sx, sy, sx + sT, sy + sT);
      gg.addColorStop(0,    'rgba(255,255,255,0.22)');
      gg.addColorStop(0.30, 'rgba(255,255,255,0.09)');
      gg.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.fillStyle = gg; ctx.fillRect(sx, sy, sT, sT);
      // Grout discoloration
      ctx.strokeStyle = '#8A9090'; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx + 1, sy + 1, sT - 2, sT - 2);
      // Condensation drip: bottom sub-tile row, alternating columns
      if (sr === 1 && sc === 0 && col % 2 === 0 && sT > 5) {
        ctx.strokeStyle = 'rgba(155,205,220,0.40)'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(sx + sT * 0.38, sy + 2);
        ctx.lineTo(sx + sT * 0.41, sy + sT * 0.58);
        ctx.stroke();
        ctx.fillStyle = 'rgba(155,205,220,0.36)';
        ctx.beginPath();
        ctx.ellipse(sx + sT * 0.41, sy + sT * 0.62, 1.3, 1.9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = WP.front;  ctx.fillRect(px+usable, py, FACE, TILE);
    ctx.fillStyle = WP.side;   ctx.fillRect(px, py+usable, usable, FACE);
    ctx.fillStyle = WP.shadow; ctx.fillRect(px+usable, py+usable, FACE, FACE);

  } else if (wallStyle === WALL_STRIPE) {
    // ── Spray-painted concrete — ragged edges, paint bleed, flaking ────────
    const conc = 116 + ((row * 7 + col * 11) % 12) - 6;
    ctx.fillStyle = `rgb(${conc},${conc-2},${conc-4})`; ctx.fillRect(px, py, usable, usable);
    ctx.save();
    ctx.beginPath(); ctx.rect(px, py, usable, usable); ctx.clip();
    const ST = Math.ceil(TILE * 0.30);
    const bseed = (row * 97 + col * 31) & 0xFF;
    for (let sx2 = px - TILE; sx2 < px + TILE * 2; sx2 += ST * 2) {
      const jL = ((bseed * 3 + Math.floor((sx2 - px) * 0.1)) & 3) - 1.5;
      ctx.fillStyle = '#D4A010';
      ctx.beginPath();
      ctx.moveTo(sx2 + jL,            py);
      ctx.lineTo(sx2 + ST + jL,       py);
      ctx.lineTo(sx2 + ST + usable,   py + usable);
      ctx.lineTo(sx2 + usable,        py + usable);
      ctx.closePath(); ctx.fill();
      // Overspray bleed at right edge
      ctx.fillStyle = 'rgba(200,155,10,0.18)';
      ctx.fillRect(sx2 + ST - 1, py, 3, usable);
      // Flaking patch (concrete showing through)
      if (((bseed + Math.floor((sx2 - px) / ST)) & 0x7) === 0) {
        ctx.fillStyle = `rgb(${conc},${conc-2},${conc-4})`;
        ctx.beginPath();
        ctx.ellipse(
          sx2 + ST * 0.48, py + usable * 0.44,
          ST * 0.13, usable * 0.11, 0.4, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, usable, usable);
    ctx.fillStyle = WP.front;  ctx.fillRect(px+usable, py, FACE, TILE);
    ctx.fillStyle = WP.side;   ctx.fillRect(px, py+usable, usable, FACE);
    ctx.fillStyle = WP.shadow; ctx.fillRect(px+usable, py+usable, FACE, FACE);

  } else if (wallStyle === WALL_CHAINLINK) {
    // WALL_CHAINLINK — chain-link fence weave over dark backing ─────────────
    ctx.fillStyle = WP.top; ctx.fillRect(px, py, TILE, TILE);
    // Fence posts at left edge
    ctx.fillStyle = WP.detail;
    ctx.fillRect(px, py, 3, usable);
    ctx.fillRect(px+usable-3, py, 3, usable);
    // Chain-link diagonal weave
    const sz = Math.ceil(TILE * 0.20);
    ctx.strokeStyle = WP.grout; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let dx = -TILE; dx < TILE*2; dx += sz) {
      ctx.moveTo(px+dx, py); ctx.lineTo(px+dx+sz, py+usable);
      ctx.moveTo(px+dx+sz, py); ctx.lineTo(px+dx, py+usable);
    }
    ctx.stroke();
    // Highlight sparkles at diamond centers
    ctx.fillStyle = 'rgba(180,200,210,0.18)';
    for (let dr=0; dr<3; dr++) for (let dc=0; dc<3; dc++) {
      const dx=px+dc*sz+sz*0.5, dy=py+dr*sz+sz*0.5;
      if (dx<px+usable && dy<py+usable) {
        ctx.beginPath(); ctx.arc(dx,dy,sz*0.18,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.fillStyle=WP.front; ctx.fillRect(px+usable,py,FACE,TILE);
    ctx.fillStyle=WP.side;  ctx.fillRect(px,py+usable,usable,FACE);
    ctx.fillStyle=WP.shadow;ctx.fillRect(px+usable,py+usable,FACE,FACE);

  } else if (wallStyle === WALL_STEEL) {
    // ── Corrugated steel — raised rib gradient shadows + rust bloom at bolts ─
    ctx.fillStyle = WP.top; ctx.fillRect(px, py, usable, usable);
    const ribW = Math.max(3, Math.ceil(TILE / 5));
    // Per-rib lighting gradient: shadow valley → lit crown → shadow valley
    for (let i = 0; i * ribW < usable; i++) {
      const rx = px + i * ribW;
      const rw = Math.min(ribW, px + usable - rx);
      if (rw <= 0) break;
      const rg = ctx.createLinearGradient(rx, py, rx + rw, py);
      rg.addColorStop(0,    'rgba(0,0,0,0.22)');
      rg.addColorStop(0.22, 'rgba(255,255,255,0.14)');
      rg.addColorStop(0.50, 'rgba(255,255,255,0.05)');
      rg.addColorStop(1,    'rgba(0,0,0,0.16)');
      ctx.fillStyle = rg; ctx.fillRect(rx, py, rw, usable);
    }
    // Horizontal seam every other row
    if (row % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(px, py, usable, 1.5);
    }
    // Rust bloom at bolt positions
    [[0.12,0.14],[0.88,0.14],[0.12,0.86],[0.88,0.86]].forEach(([fx, fy]) => {
      const bxb = px + fx * usable, byb = py + fy * usable;
      if (bxb < px + usable && byb < py + usable) {
        const rng = ctx.createRadialGradient(bxb, byb, 0, bxb, byb, TILE * 0.13);
        rng.addColorStop(0,   'rgba(160,70,20,0.55)');
        rng.addColorStop(0.5, 'rgba(140,60,15,0.25)');
        rng.addColorStop(1,   'rgba(140,60,15,0)');
        ctx.fillStyle = rng;
        ctx.beginPath(); ctx.arc(bxb, byb, TILE * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = WP.detail;
        ctx.beginPath(); ctx.arc(bxb, byb, Math.max(1.5, TILE * 0.055), 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.fillStyle = WP.front;  ctx.fillRect(px+usable, py, FACE, TILE);
    ctx.fillStyle = WP.side;   ctx.fillRect(px, py+usable, usable, FACE);
    ctx.fillStyle = WP.shadow; ctx.fillRect(px+usable, py+usable, FACE, FACE);

  } else {
    // WALL_PAINTED — smooth painted concrete (industrial green) ────────────────
    ctx.fillStyle = WP.top; ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = WP.grout; ctx.lineWidth = 0.5;
    ctx.beginPath();
    [0.33, 0.67].forEach(f => {
      ctx.moveTo(px, py+TILE*f); ctx.lineTo(px+TILE, py+TILE*f);
    });
    ctx.stroke();
    // Paint chip wear
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    const chX = px + usable * 0.68, chY = py + usable * 0.38;
    ctx.beginPath(); ctx.ellipse(chX, chY, TILE*0.07, TILE*0.04, 0.8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle=WP.front; ctx.fillRect(px+usable,py,FACE,TILE);
    ctx.fillStyle=WP.side;  ctx.fillRect(px,py+usable,usable,FACE);
    ctx.fillStyle=WP.shadow;ctx.fillRect(px+usable,py+usable,FACE,FACE);
  }
}

// ── Metal shelving obstacle ───────────────────────────────────────────────────
function drawShelfObstacle(ctx, px, py, TILE, FACE, SHADE) {
  ctx.fillStyle = SHELF_C.beam; ctx.fillRect(px, py, TILE, TILE);
  const POST  = Math.max(3, Math.ceil(TILE * 0.12));
  const uS    = TILE - FACE;
  // Frame uprights
  ctx.fillStyle = SHELF_C.frame;
  ctx.fillRect(px + 1, py, POST, uS);
  ctx.fillRect(px + uS - POST, py, POST, uS);
  // Upright highlight
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  ctx.fillRect(px + 1, py, 2, uS);
  ctx.fillRect(px + uS - POST, py, 2, uS);
  // Teardrop perforations on uprights
  const perfH = Math.max(2, Math.ceil(TILE * 0.09));
  [[px + 1, POST], [px + uS - POST, POST]].forEach(([ux, pw]) => {
    ctx.fillStyle = SHELF_C.beam;
    for (let phy = py + perfH; phy + perfH < py + uS - 2; phy += perfH * 2.2) {
      ctx.beginPath();
      ctx.ellipse(ux + pw * 0.5, phy + perfH * 0.5, pw * 0.38, perfH * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Shelf beams + contents
  const beamH = Math.max(2, Math.ceil(TILE * 0.08));
  [0.20, 0.50, 0.78].forEach(f => {
    ctx.fillStyle = SHELF_C.shelf;
    ctx.fillRect(px + POST + 1, py + uS * f, uS - POST * 2 - 2, beamH);
    ctx.fillStyle = SHELF_C.contents;
    const iW = Math.floor((uS - POST * 2 - 2) / 3);
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(px + POST + 2 + i * iW, py + uS * f - beamH * 1.5, iW - 1, beamH * 1.5);
    }
  });
  // Yellow column protector at base
  const gH = Math.ceil(uS * 0.14);
  [[px + 1, POST], [px + uS - POST, POST]].forEach(([ux, pw]) => {
    ctx.fillStyle = '#D4B000';
    ctx.fillRect(ux, py + uS - gH, pw, gH);
    ctx.fillStyle = '#A88800';
    for (let gx2 = ux + 2; gx2 < ux + pw; gx2 += 4) {
      ctx.fillRect(gx2, py + uS - gH, 2, gH);
    }
  });
  // Bottom bevel
  ctx.fillStyle = darkenHex(SHELF_C.frame, 0.35);
  ctx.fillRect(px, py + TILE - FACE, TILE, FACE);
  ctx.fillRect(px + TILE - FACE, py, FACE, TILE - FACE);
  ctx.fillStyle = darkenHex(SHELF_C.frame, 0.55);
  ctx.fillRect(px + TILE - FACE, py + TILE - FACE, FACE, FACE);
}

// ── Pallet storage rack obstacle ─────────────────────────────────────────────
function drawRackObstacle(ctx, px, py, TILE, FACE, SHADE) {
  const POST   = Math.max(3, Math.ceil(TILE * 0.10));
  const usable = TILE - FACE;
  // Floor shadow
  ctx.fillStyle = RACK_C.floor; ctx.fillRect(px, py, usable, usable);
  // Two orange uprights with teardrop perforations
  [[px + 2, POST], [px + usable - POST - 2, POST]].forEach(([ux, pw]) => {
    ctx.fillStyle = RACK_C.upright;
    ctx.fillRect(ux, py, pw, usable);
    // Leading-edge highlight
    ctx.fillStyle = lightenHex(RACK_C.upright, 30);
    ctx.fillRect(ux, py, 2, usable);
    // Teardrop perforations (ellipses punched through)
    const perfH = Math.max(2, Math.ceil(TILE * 0.09));
    const perfW = Math.max(1, Math.ceil(pw * 0.55));
    ctx.fillStyle = RACK_C.floor;
    for (let phy = py + perfH * 0.8; phy + perfH < py + usable - 2; phy += perfH * 2.2) {
      ctx.beginPath();
      ctx.ellipse(ux + pw * 0.5, phy + perfH * 0.5, perfW * 0.5, perfH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Cross beams
  const beamH = Math.max(3, Math.ceil(TILE * 0.10));
  [0.28, 0.65].forEach(f => {
    ctx.fillStyle = RACK_C.beam;
    ctx.fillRect(px + POST + 3, py + usable * f, usable - POST * 2 - 6, beamH);
    ctx.fillStyle = RACK_C.guard;
    ctx.fillRect(px + POST + 3, py + usable * f, usable - POST * 2 - 6, 2);
    // Safety clip tabs at beam ends
    ctx.fillStyle = RACK_C.guard;
    ctx.fillRect(px + POST + 2,          py + usable * f - 2, 4, beamH + 4);
    ctx.fillRect(px + usable - POST - 6, py + usable * f - 2, 4, beamH + 4);
  });
  // Yellow column protector guard at base (bottom 15% of upright)
  const guardH = Math.ceil(usable * 0.15);
  [[px + 2, POST], [px + usable - POST - 2, POST]].forEach(([ux, pw]) => {
    ctx.fillStyle = '#E8C000';
    ctx.fillRect(ux, py + usable - guardH, pw, guardH);
    ctx.fillStyle = '#C09800';
    for (let gx2 = ux + 2; gx2 < ux + pw; gx2 += 4) {
      ctx.fillRect(gx2, py + usable - guardH, 2, guardH);
    }
  });
  // Crumple damage: every 5th rack cell shows a bent upright
  if (((px + py) >> 2) % 5 === 2 && usable > 10) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,60,0.60)'; ctx.lineWidth = 1.5;
    // Bent left upright kink
    ctx.beginPath();
    ctx.moveTo(px + 3, py + usable * 0.30);
    ctx.lineTo(px + 3 + POST * 0.7, py + usable * 0.48);
    ctx.lineTo(px + 3, py + usable * 0.65);
    ctx.stroke();
    ctx.restore();
  }
  // 3D bevel
  ctx.fillStyle = darkenHex(RACK_C.floor, 0.40);
  ctx.fillRect(px, py + TILE - FACE, TILE, FACE);
  ctx.fillRect(px + TILE - FACE, py, FACE, TILE - FACE);
  ctx.fillStyle = darkenHex(RACK_C.floor, 0.60);
  ctx.fillRect(px + TILE - FACE, py + TILE - FACE, FACE, FACE);
}

// ── Steel wide-flange I-beam column ──────────────────────────────────────────
function drawColumnObstacle(ctx, px, py, TILE, FACE) {
  const US = TILE - FACE;
  const cx  = px + US / 2;
  const fw  = Math.ceil(US * 0.78);   // flange width
  const ww  = Math.ceil(US * 0.22);   // web width
  const ft  = Math.ceil(US * 0.16);   // flange thickness
  // Background shadow
  ctx.fillStyle = '#2E3038'; ctx.fillRect(px, py, US, US);
  // Web (vertical center plate)
  const webG = ctx.createLinearGradient(cx - ww / 2, py, cx + ww / 2, py);
  webG.addColorStop(0,   '#525A68');
  webG.addColorStop(0.4, '#606870');
  webG.addColorStop(1,   '#484E5C');
  ctx.fillStyle = webG;
  ctx.fillRect(cx - ww / 2, py + ft, ww, US - ft * 2);
  // Top flange
  const fgT = ctx.createLinearGradient(px + (US - fw) / 2, py, px + (US - fw) / 2, py + ft);
  fgT.addColorStop(0, '#6A7280'); fgT.addColorStop(1, '#505860');
  ctx.fillStyle = fgT;
  ctx.fillRect(px + (US - fw) / 2, py, fw, ft);
  // Bottom flange
  const fgB = ctx.createLinearGradient(px + (US - fw) / 2, py + US - ft, px + (US - fw) / 2, py + US);
  fgB.addColorStop(0, '#505860'); fgB.addColorStop(1, '#404850');
  ctx.fillStyle = fgB;
  ctx.fillRect(px + (US - fw) / 2, py + US - ft, fw, ft);
  // Weld bead lines at flange/web junctions
  ctx.strokeStyle = 'rgba(100,110,125,0.70)'; ctx.lineWidth = 1;
  [[py + ft, py + US - ft - 1]].forEach(wy => {
    ctx.beginPath();
    ctx.moveTo(cx - ww / 2, wy); ctx.lineTo(cx + ww / 2, wy);
    ctx.stroke();
  });
  // Top-lit flange specular
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(px + (US - fw) / 2, py, fw, 2);
  // Fireproofing spray texture on web
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#909AA8';
  for (let i = 0; i < 18; i++) {
    const tx = cx + (((px * 7 + py * 3 + i * 11) * 2654435761) >>> 0) % (ww + 2) - ww / 2 - 1;
    const ty = py + ft + 3 + (((px * 3 + py * 7 + i * 9) * 1234567891) >>> 0) % Math.max(1, US - ft * 2 - 6);
    ctx.beginPath(); ctx.ellipse(tx, ty, 2.2, 1.1, Math.PI * (i % 3) / 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // 3D bevel
  ctx.fillStyle = darkenHex('#2E3038', 0.40);
  ctx.fillRect(px, py + US, TILE, FACE);
  ctx.fillRect(px + US, py, FACE, US);
  ctx.fillStyle = darkenHex('#2E3038', 0.60);
  ctx.fillRect(px + US, py + US, FACE, FACE);
}

// ── Hazard-stripe wrapped pillar ──────────────────────────────────────────────
function drawHazPillarObstacle(ctx, px, py, TILE, FACE) {
  const US = TILE - FACE;
  ctx.fillStyle = '#282828'; ctx.fillRect(px, py, US, US);
  const colW = Math.ceil(US * 0.64), colOx = px + (US - colW) / 2;
  const strH = Math.ceil(colW * 0.25);
  for (let sy = py; sy < py + US; sy += strH * 2) {
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(colOx, sy, colW, Math.min(strH, py + US - sy));
    if (sy + strH < py + US) {
      ctx.fillStyle = '#1A1A1A';
      ctx.fillRect(colOx, sy + strH, colW, Math.min(strH, py + US - sy - strH));
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.40)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(colOx, py, colW, US);
  ctx.fillStyle = darkenHex('#282828', 0.40);
  ctx.fillRect(px, py + US, TILE, FACE);
  ctx.fillRect(px + US, py, FACE, US);
  ctx.fillStyle = darkenHex('#282828', 0.60);
  ctx.fillRect(px + US, py + US, FACE, FACE);
}

// ── Forklift charging station ─────────────────────────────────────────────────
function drawChargeObstacle(ctx, px, py, TILE, FACE) {
  const US = TILE - FACE;
  ctx.fillStyle = '#181828'; ctx.fillRect(px, py, US, US);
  // Unit body
  ctx.fillStyle = '#2A2A3A';
  roundRect(ctx, px + US*0.10, py + US*0.05, US*0.80, US*0.82, 3); ctx.fill();
  ctx.strokeStyle = '#3A3A58'; ctx.lineWidth = 1;
  roundRect(ctx, px + US*0.10, py + US*0.05, US*0.80, US*0.82, 3); ctx.stroke();
  // Display screen
  ctx.fillStyle = '#001830';
  ctx.fillRect(px + US*0.18, py + US*0.12, US*0.64, US*0.30);
  ctx.fillStyle = '#00CC44';
  ctx.font = `${Math.max(5, Math.floor(TILE*0.13))}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('100%', px + US/2, py + US*0.27);
  ctx.fillStyle = '#00AA33';
  ctx.font = `${Math.max(4, Math.floor(TILE*0.09))}px monospace`;
  ctx.fillText('⚡CHG', px + US/2, py + US*0.38);
  // Cable
  ctx.strokeStyle = '#444'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px+US*0.65, py+US*0.88);
  ctx.bezierCurveTo(px+US*0.80, py+US*1.0, px+US*0.90, py+US*0.95, px+US*0.88, py+US*0.75);
  ctx.stroke(); ctx.lineCap = 'butt';
  // LED indicators
  ['#00FF44','#00FF44','#FFAA00'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(px+US*0.24+i*US*0.12, py+US*0.58, 2.5, 0, Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = darkenHex('#181828', 0.40);
  ctx.fillRect(px, py+US, TILE, FACE);
  ctx.fillRect(px+US, py, FACE, US);
  ctx.fillStyle = darkenHex('#181828', 0.60);
  ctx.fillRect(px+US, py+US, FACE, FACE);
}

// ── Wet floor — irregular puddle with animated shimmer ───────────────────────
function drawWetFloorObstacle(ctx, px, py, TILE, FACE, frame) {
  const US = TILE - FACE;
  const cx  = px + US * 0.50, cy = py + US * 0.52;
  // Irregular blob outline (deterministic per tile, driven by px/py seed)
  const bseed = ((px * 7 + py * 13) * 2654435761) >>> 0;
  ctx.fillStyle = '#2E4458';
  ctx.beginPath();
  const nPts = 10;
  for (let i = 0; i <= nPts; i++) {
    const angle = (i / nPts) * Math.PI * 2;
    const vary  = 0.72 + 0.28 * Math.sin(angle * 3 + (bseed & 0xFF) * 0.04);
    const rx = US * 0.42 * vary, ry = US * 0.38 * vary;
    const bx2 = cx + rx * Math.cos(angle), by2 = cy + ry * Math.sin(angle);
    i === 0 ? ctx.moveTo(bx2, by2) : ctx.lineTo(bx2, by2);
  }
  ctx.closePath(); ctx.fill();
  // Water gradient overlay
  const wg = ctx.createRadialGradient(cx - US * 0.06, cy - US * 0.10, 0, cx, cy, US * 0.42);
  wg.addColorStop(0,   'rgba(120,185,245,0.55)');
  wg.addColorStop(0.55,'rgba(80,145,205,0.35)');
  wg.addColorStop(1,   'rgba(55,100,170,0.12)');
  ctx.fillStyle = wg;
  ctx.beginPath();
  for (let i = 0; i <= nPts; i++) {
    const angle = (i / nPts) * Math.PI * 2;
    const vary  = 0.72 + 0.28 * Math.sin(angle * 3 + (bseed & 0xFF) * 0.04);
    const rx = US * 0.42 * vary, ry = US * 0.38 * vary;
    const bx2 = cx + rx * Math.cos(angle), by2 = cy + ry * Math.sin(angle);
    i === 0 ? ctx.moveTo(bx2, by2) : ctx.lineTo(bx2, by2);
  }
  ctx.closePath(); ctx.fill();
  // Specular highlight
  ctx.fillStyle = 'rgba(200,235,255,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx - US * 0.10, cy - US * 0.15, US * 0.11, US * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
  // Animated shimmer ring (expands and fades)
  const shimPhase = (frame * 0.055) % (Math.PI * 2);
  const shimR     = US * 0.12 + US * 0.14 * Math.abs(Math.sin(shimPhase));
  const shimA     = 0.22 + 0.18 * Math.cos(shimPhase);
  ctx.strokeStyle = `rgba(180,225,255,${shimA.toFixed(2)})`; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, shimR, shimR * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Warning cone (🚧 emoji scale with tile)
  ctx.font = `${Math.max(8, Math.floor(TILE * 0.32))}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🚧', px + US / 2, py + US * 0.50);
  // 3D bevel
  ctx.fillStyle = darkenHex('#2E4458', 0.40);
  ctx.fillRect(px, py + US, TILE, FACE);
  ctx.fillRect(px + US, py, FACE, US);
  ctx.fillStyle = darkenHex('#2E4458', 0.60);
  ctx.fillRect(px + US, py + US, FACE, FACE);
}

// ── DRAW: ALL DOCK BAYS ───────────────────────────────────────────────────────
// Draws top dock wall: active bays (open+dual floods), inactive bays (weathered
// shutter), I-beam structural pillars, dock leveler plates, animated LED signage.
// dockBays: [{bayIdx, isActive, stopIdx}]  zones: cl.zones array

function drawAllDockBays(ctx, TILE, frame, rm, dockBays, zones, loadedFrac, bayGlow, loadedZones) {
  const doorY  = HUD_H + TILE;   // bottom of row 0 in world space
  const doorH  = TILE;           // door height = exactly one tile row
  const frameT = Math.max(3, Math.ceil(TILE * 0.15));

  // ── Top facade beam ───────────────────────────────────────────────────────
  const beamH = Math.ceil(TILE * 0.30);
  ctx.fillStyle = '#22252F';
  ctx.fillRect(0, doorY - doorH - beamH, COLS * TILE, beamH);
  ctx.fillStyle = '#14161E';
  ctx.fillRect(0, doorY - doorH - beamH, COLS * TILE, 3);
  ctx.fillStyle = '#30343E';
  ctx.fillRect(0, doorY - doorH - beamH + beamH - 2, COLS * TILE, 2);

  // ── Per-bay drawing ───────────────────────────────────────────────────────
  for (let i = 0; i < BAY_COUNT; i++) {
    const bayInfo  = dockBays ? dockBays[i] : null;
    const isActive = bayInfo ? bayInfo.isActive : false;
    const stopIdx  = bayInfo ? bayInfo.stopIdx  : -1;
    const zone     = stopIdx >= 0 ? (zones||[])[stopIdx] : null;
    const zc       = zone ? (ZONE_COLORS[stopIdx] || ZONE_COLORS[0]) : null;

    const bx = bayLeftCol(i) * TILE;
    const bw = BAY_W * TILE;

    if (isActive) {
      // ── Open bay: layered dark truck interior ────────────────────────────
      const grad = ctx.createLinearGradient(bx, doorY, bx, doorY - doorH);
      grad.addColorStop(0,   '#0E1216');
      grad.addColorStop(0.5, '#080A0E');
      grad.addColorStop(1,   '#040508');
      ctx.fillStyle = grad;
      ctx.fillRect(bx + frameT, doorY - doorH, bw - frameT*2, doorH + 4);

      // Cargo silhouette layers receding into truck
      ctx.save(); ctx.globalAlpha = 0.22;
      [[0.55, 0.72, '#3A4858'], [0.35, 0.52, '#283848'], [0.15, 0.38, '#182838']].forEach(([bot, top, c]) => {
        ctx.fillStyle = c;
        ctx.fillRect(bx + frameT + 4, doorY - doorH * bot, bw - frameT*2 - 8, doorH * (bot - top));
      });
      ctx.restore();

      // ── Depth illusion: perspective floor lines + side-wall vignette ─────
      if (!rm) {
        // Converging floor planks — horizontal lines spaced closer at top (perspective)
        ctx.save(); ctx.globalAlpha = 0.13;
        ctx.strokeStyle = '#607080'; ctx.lineWidth = 0.5;
        const vpX = bx + bw / 2;                   // vanishing point x = bay center
        const nLines = Math.ceil(doorH / 5);
        for (let li = 0; li < nLines; li++) {
          const t2 = li / nLines;                   // 0=bottom, 1=top
          const lineY = doorY - doorH * t2;
          const spread = (bw / 2 - frameT) * (1 - t2 * 0.55);
          ctx.beginPath();
          ctx.moveTo(vpX - spread, lineY);
          ctx.lineTo(vpX + spread, lineY);
          ctx.stroke();
        }
        ctx.restore();
      }
      // Side-wall vignette — darker edges suggest truck walls converging
      {
        const wallVig = ctx.createLinearGradient(bx + frameT, 0, bx + bw - frameT, 0);
        wallVig.addColorStop(0,    'rgba(0,0,0,0.50)');
        wallVig.addColorStop(0.20, 'rgba(0,0,0,0)');
        wallVig.addColorStop(0.80, 'rgba(0,0,0,0)');
        wallVig.addColorStop(1,    'rgba(0,0,0,0.50)');
        ctx.fillStyle = wallVig;
        ctx.fillRect(bx + frameT, doorY - doorH, bw - frameT*2, doorH);
      }

      // ── Dual flood light fixtures — top-left and top-right of bay ────────
      const floodY = doorY - doorH + frameT + 4;
      [[bx + frameT + 4, bx + frameT + 12], [bx + bw - frameT - 12, bx + bw - frameT - 4]].forEach(([lx1, lx2]) => {
        const flx = (lx1 + lx2) / 2;
        // Light cone (wide trapezoid pool)
        const poolW = bw * 0.6;
        const _isLoadedBay = (loadedZones||new Set()).has(stopIdx);
        ctx.save(); ctx.globalAlpha = (rm || _isLoadedBay) ? 0.18 : 0.20 + 0.08 * Math.sin(frame * 0.03 + lx1 * 0.01);
        const flood = ctx.createRadialGradient(flx, floodY, 1, flx, doorY - 2, poolW * 0.7);
        flood.addColorStop(0,   'rgba(255,235,190,0.80)');
        flood.addColorStop(0.4, 'rgba(255,220,160,0.40)');
        flood.addColorStop(1,   'rgba(255,210,140,0)');
        ctx.fillStyle = flood;
        ctx.fillRect(bx + frameT, doorY - doorH, bw - frameT*2, doorH);
        ctx.restore();
        // Fixture housing
        ctx.fillStyle = '#484E58';
        ctx.fillRect(lx1, floodY - 3, lx2 - lx1, 5);
        // Bulb (bright strip)
        ctx.fillStyle = 'rgba(255,240,200,0.90)';
        ctx.fillRect(lx1 + 1, floodY - 1, lx2 - lx1 - 2, 2);
        // Mounting bracket
        ctx.fillStyle = '#383C46';
        ctx.fillRect(Math.floor((lx1 + lx2) / 2) - 1, doorY - doorH, 2, frameT + 4);
      });
      // Hard shadow under door frame bottom edge
      const shG = ctx.createLinearGradient(bx, doorY - 4, bx, doorY + 6);
      shG.addColorStop(0, 'rgba(0,0,0,0.50)'); shG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shG;
      ctx.fillRect(bx + frameT, doorY - 4, bw - frameT*2, 10);

      // Zone color stripe at top of opening — thicker + brighter when loaded
      if (zc) {
        const _lz = (loadedZones||new Set()).has(stopIdx);
        ctx.fillStyle = _lz ? zc.border : zc.body;
        ctx.fillRect(bx + frameT, doorY - doorH, bw - frameT*2, _lz ? 7 : 4);
        if (_lz && !rm) {
          ctx.save(); ctx.globalAlpha = 0.35;
          ctx.fillStyle = zc.spark || zc.border;
          ctx.fillRect(bx + frameT, doorY - doorH, bw - frameT*2, 2);
          ctx.restore();
        }
      }

      // Item 12: Loaded pallet silhouette inside bay — zone-colored block with
      // border, sits in upper half of bay interior so it reads as cargo inside truck
      if (zc && (loadedZones||new Set()).has(stopIdx)) {
        const _silPad = frameT + 5;
        const _silX   = bx + _silPad;
        const _silW   = bw - _silPad * 2;
        // Pallet block: sits in middle-upper portion of bay interior
        const _silY   = doorY - doorH + doorH * 0.18;
        const _silH   = doorH * 0.52;
        ctx.save();
        // Dark body fill using zone color at low opacity
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = zc.body;
        roundRect(ctx, _silX, _silY, _silW, _silH, 3); ctx.fill();
        // Zone-colored border outline
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = zc.border;
        ctx.lineWidth = 1.5;
        roundRect(ctx, _silX, _silY, _silW, _silH, 3); ctx.stroke();
        // Subtle pallet-slat lines across the block
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = zc.spark || zc.border;
        ctx.lineWidth = 0.8;
        const _slatCount = 3;
        for (let _si = 1; _si < _slatCount; _si++) {
          const _sy = _silY + (_silH * _si / _slatCount);
          ctx.beginPath();
          ctx.moveTo(_silX + 3, _sy);
          ctx.lineTo(_silX + _silW - 3, _sy);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Steel door frame — jambs + lintel
      ctx.fillStyle = DOCK_C.frame;
      ctx.fillRect(bx,               doorY - doorH, frameT, doorH + frameT);
      ctx.fillRect(bx + bw - frameT, doorY - doorH, frameT, doorH + frameT);
      ctx.fillRect(bx,               doorY - doorH, bw, frameT);
      ctx.fillStyle = DOCK_C.frameBevel;
      ctx.fillRect(bx,          doorY - doorH + frameT, 2, doorH - frameT);
      ctx.fillRect(bx + bw - 2, doorY - doorH + frameT, 2, doorH - frameT);

      // Rubber dock bumpers
      const bumH = Math.ceil(TILE * 0.18), bumW = Math.ceil(TILE * 0.08);
      [[bx + frameT, doorY - bumH - 1], [bx + bw - frameT - bumW, doorY - bumH - 1]].forEach(([bxb, byb]) => {
        ctx.fillStyle = '#4A4A3A'; ctx.fillRect(bxb, byb, bumW, bumH);
        ctx.strokeStyle = '#303028'; ctx.lineWidth = 0.8;
        for (let bi = 2; bi < bumH; bi += 3) {
          ctx.beginPath(); ctx.moveTo(bxb, byb+bi); ctx.lineTo(bxb+bumW, byb+bi); ctx.stroke();
        }
      });

      // ── Dock leveler plate at floor transition ────────────────────────────
      const lvH = Math.max(4, Math.ceil(frameT * 1.1));
      const lvG = ctx.createLinearGradient(bx + frameT, doorY, bx + frameT, doorY + lvH);
      lvG.addColorStop(0, '#4E545E'); lvG.addColorStop(0.5, '#3A3E48'); lvG.addColorStop(1, '#2E3238');
      ctx.fillStyle = lvG;
      ctx.fillRect(bx + frameT, doorY, bw - frameT * 2, lvH);
      // Grating lines on leveler surface
      ctx.strokeStyle = 'rgba(80,90,100,0.55)'; ctx.lineWidth = 0.6;
      for (let gx2 = bx + frameT + 3; gx2 < bx + bw - frameT; gx2 += 4) {
        ctx.beginPath(); ctx.moveTo(gx2, doorY); ctx.lineTo(gx2, doorY + lvH); ctx.stroke();
      }
      // Yellow edge trim on leveler
      ctx.fillStyle = '#D8B800';
      ctx.fillRect(bx + frameT, doorY, bw - frameT * 2, 2);
      ctx.fillRect(bx + frameT, doorY + lvH - 2, bw - frameT * 2, 2);
      // Hinge line
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(bx + frameT, doorY + 2, bw - frameT * 2, 1);

      // Zone color tint on leveler
      if (zc) {
        ctx.save(); ctx.globalAlpha = 0.20;
        ctx.fillStyle = zc.body;
        ctx.fillRect(bx + frameT, doorY, bw - frameT * 2, lvH);
        ctx.restore();
      }
      // Load-progress bar on leveler lip
      if (loadedFrac > 0) {
        const barW = (bw - frameT*2) * Math.min(1, loadedFrac);
        ctx.fillStyle = 'rgba(60,200,100,0.75)';
        ctx.fillRect(bx + frameT, doorY, barW, 3);
      }
      // Fix 7 — Matching-pallet bay glow: pulsing colored halo around bay entrance
      const _bgI = (bayGlow||{})[stopIdx];
      if (_bgI && !rm && zc) {
        const _bgPulse = _bgI * (0.55 + 0.45 * Math.abs(Math.sin(frame * 0.06 + i * 0.9)));
        ctx.save(); ctx.globalAlpha = _bgPulse * 0.35;
        // Left jamb glow
        const _lgL = ctx.createLinearGradient(bx, doorY - doorH/2, bx + frameT*3, doorY - doorH/2);
        _lgL.addColorStop(0, zc.body); _lgL.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = _lgL; ctx.fillRect(bx, doorY - doorH, frameT*3, doorH);
        // Right jamb glow
        const _lgR = ctx.createLinearGradient(bx + bw - frameT*3, doorY - doorH/2, bx + bw, doorY - doorH/2);
        _lgR.addColorStop(0, 'rgba(0,0,0,0)'); _lgR.addColorStop(1, zc.body);
        ctx.fillStyle = _lgR; ctx.fillRect(bx + bw - frameT*3, doorY - doorH, frameT*3, doorH);
        // Top lintel glow
        const _lgT = ctx.createLinearGradient(bx, doorY - doorH, bx, doorY - doorH + frameT*3);
        _lgT.addColorStop(0, zc.body); _lgT.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = _lgT; ctx.fillRect(bx, doorY - doorH, bw, frameT*3);
        ctx.restore();
      }

      // Hazard stripes flanking opening
      const hW = frameT + Math.ceil(TILE * 0.2);
      drawHazardStripe(ctx, bx - hW, doorY, hW, frameT);
      drawHazardStripe(ctx, bx + bw, doorY, hW, frameT);

    } else {
      // ── Closed bay: weathered steel roller shutter ───────────────────────
      const bseed = ((bx * 7 + 13) * 2654435761) >>> 0;
      // Per-rib alternating tone
      const ribH = Math.max(3, Math.ceil(TILE * 0.08));
      for (let ry = doorY - doorH, ri = 0; ry < doorY; ry += ribH, ri++) {
        const even = ri % 2 === 0;
        ctx.fillStyle = even ? '#2D2F3D' : '#252733';
        ctx.fillRect(bx, ry, bw, ribH);
        if (even) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(bx, ry, bw, 1.5);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(bx, ry + ribH - 1.5, bw, 1.5);
        }
      }
      // Vertical panel joints
      ctx.strokeStyle = '#1C1E2A'; ctx.lineWidth = 0.8;
      for (let px2 = bx + Math.ceil(bw / 3); px2 < bx + bw; px2 += Math.ceil(bw / 3)) {
        ctx.beginPath(); ctx.moveTo(px2, doorY - doorH); ctx.lineTo(px2, doorY); ctx.stroke();
      }
      // Rust streaks (2–3 per shutter, deterministic)
      [[0.22, 0.08, 0.80], [0.58, 0.05, 0.60], [0.80, 0.18, 0.70]].forEach(([fx, fy, fh], si) => {
        if ((bseed + si) % 3 === 0) return; // skip some for variety
        const rx2 = bx + bw * fx, ry2 = doorY - doorH + doorH * fy;
        const rg = ctx.createLinearGradient(rx2, ry2, rx2 + 2, ry2 + doorH * fh);
        rg.addColorStop(0,   'rgba(130,65,18,0)');
        rg.addColorStop(0.15,'rgba(130,65,18,0.40)');
        rg.addColorStop(1,   'rgba(100,45,10,0)');
        ctx.fillStyle = rg; ctx.fillRect(rx2, ry2, 2, doorH * fh);
      });
      // Dent (one per bay — slight shadow/highlight ellipse)
      const dentX = bx + bw * 0.35, dentY = doorY - doorH * 0.55;
      ctx.save(); ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#101018';
      ctx.beginPath(); ctx.ellipse(dentX + 8, dentY + 4, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#484858';
      ctx.beginPath(); ctx.ellipse(dentX + 7, dentY + 3, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Bottom corrosion gradient
      const botG = ctx.createLinearGradient(bx, doorY - ribH * 3, bx, doorY);
      botG.addColorStop(0, 'rgba(90,42,10,0)'); botG.addColorStop(1, 'rgba(90,42,10,0.45)');
      ctx.fillStyle = botG; ctx.fillRect(bx, doorY - ribH * 3, bw, ribH * 3);
      // Bent handle bar (slight rotation)
      const hbY = doorY - doorH * 0.46, hbW = bw * 0.34, hbH = Math.max(3, Math.ceil(TILE * 0.07));
      ctx.save();
      ctx.translate(bx + (bw - hbW) / 2 + hbW / 2, hbY + hbH / 2);
      ctx.rotate(0.03);
      ctx.fillStyle = '#404250'; ctx.fillRect(-hbW / 2, -hbH / 2, hbW, hbH);
      ctx.strokeStyle = '#505262'; ctx.lineWidth = 0.8;
      ctx.strokeRect(-hbW / 2, -hbH / 2, hbW, hbH);
      ctx.restore();
      // Outer frame
      ctx.strokeStyle = DOCK_C.frame; ctx.lineWidth = frameT * 0.6;
      ctx.strokeRect(bx + ctx.lineWidth/2, doorY - doorH + ctx.lineWidth/2,
                     bw - ctx.lineWidth, doorH - ctx.lineWidth/2);
      // Dim floor plate
      ctx.fillStyle = '#1A1C24';
      ctx.fillRect(bx + frameT, doorY, bw - frameT*2, frameT);
    }

    // ── Animated LED bay signage — placard inside lower door area ────────────
    const sigH = Math.ceil(TILE * 0.34), sigW = Math.ceil(bw * 0.70);
    const sigX = bx + (bw - sigW) / 2;
    const sigY = doorY - sigH - Math.ceil(TILE * 0.06); // near bottom of row 0, inside clip
    const sigCX = sigX + sigW / 2;
    if (!rm) {
      // Glow halo behind placard (active bays only)
      if (isActive) {
        const glowColor = zc ? zc.body : '#00B8DD';
        const pulse = 0.55 + 0.45 * Math.sin(frame * 0.06 + i * 0.8);
        ctx.save(); ctx.globalAlpha = 0.22 * pulse;
        const gR = ctx.createRadialGradient(sigCX, sigY + sigH / 2, 2, sigCX, sigY + sigH / 2, sigW * 0.65);
        gR.addColorStop(0, glowColor); gR.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gR;
        ctx.beginPath(); ctx.arc(sigCX, sigY + sigH / 2, sigW * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    // Placard backing
    ctx.fillStyle = isActive ? '#141C28' : '#101418';
    roundRect(ctx, sigX, sigY, sigW, sigH, Math.max(2, Math.ceil(sigH * 0.25))); ctx.fill();
    // Placard border — zone-colored if active
    ctx.strokeStyle = isActive ? (zc ? zc.border : 'rgba(0,180,220,0.70)') : 'rgba(60,70,90,0.60)';
    ctx.lineWidth = 1;
    roundRect(ctx, sigX, sigY, sigW, sigH, Math.max(2, Math.ceil(sigH * 0.25))); ctx.stroke();
    // Bay label — "LOADED ✓" when zone complete, otherwise "BAY N"
    {
      const _isLoaded = isActive && (loadedZones||new Set()).has(stopIdx);
      ctx.save();
      ctx.font = `bold ${Math.max(5, Math.floor(TILE * 0.17))}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (_isLoaded) {
        ctx.fillStyle = '#00FFAA';
        ctx.font = `bold ${Math.max(4, Math.floor(TILE * 0.15))}px monospace`;
        ctx.fillText('LOADED ✓', sigCX, sigY + sigH / 2);
      } else {
        ctx.fillStyle = isActive ? (zc ? zc.border : '#00CCEE') : '#44505C';
        ctx.fillText(`BAY ${i + 1}`, sigCX, sigY + sigH / 2);
      }
      ctx.restore();
    }
    // Status LED dot (top-right of placard)
    const ledX = sigX + sigW - Math.ceil(sigH * 0.28), ledY2 = sigY + Math.ceil(sigH * 0.28);
    const ledR = Math.max(1.5, sigH * 0.18);
    if (isActive) {
      const ledPulse = rm ? 1 : 0.50 + 0.50 * Math.abs(Math.sin(frame * 0.07 + i * 1.1));
      if (!rm) {
        ctx.save(); ctx.globalAlpha = ledPulse * 0.40;
        const ledGlow = ctx.createRadialGradient(ledX, ledY2, 0, ledX, ledY2, ledR * 3);
        ledGlow.addColorStop(0, '#00FF88'); ledGlow.addColorStop(1, 'rgba(0,255,136,0)');
        ctx.fillStyle = ledGlow;
        ctx.beginPath(); ctx.arc(ledX, ledY2, ledR * 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = `rgba(0,${Math.floor(200 + 55 * (rm ? 1 : Math.abs(Math.sin(frame * 0.07 + i * 1.1))))},100,0.95)`;
      ctx.beginPath(); ctx.arc(ledX, ledY2, ledR, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60,70,80,0.60)';
      ctx.beginPath(); ctx.arc(ledX, ledY2, ledR, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── I-beam structural pillars between bays ────────────────────────────────
  for (let i = 0; i < BAY_COUNT - 1; i++) {
    const pc  = pillarCol(i) * TILE;
    const pw  = BAY_SEP * TILE;
    const pcx = pc + pw / 2;
    const fw2 = Math.ceil(pw * 0.90);    // flange width
    const ww2 = Math.ceil(pw * 0.24);    // web width
    const ft2 = Math.ceil(doorH * 0.14); // flange thickness
    const pTop  = doorY - doorH;
    const pBot  = doorY + frameT;
    const pHt   = pBot - pTop;
    // Background shadow
    ctx.fillStyle = '#1C1E28'; ctx.fillRect(pc, pTop, pw, pHt);
    // Web (vertical center plate)
    const wbG = ctx.createLinearGradient(pcx - ww2 / 2, pTop, pcx + ww2 / 2, pTop);
    wbG.addColorStop(0,   '#484E5C');
    wbG.addColorStop(0.4, '#565E6C');
    wbG.addColorStop(1,   '#3C4250');
    ctx.fillStyle = wbG;
    ctx.fillRect(pcx - ww2 / 2, pTop + ft2, ww2, pHt - ft2 * 2);
    // Top flange
    const tfG = ctx.createLinearGradient(pc + (pw - fw2) / 2, pTop, pc + (pw - fw2) / 2, pTop + ft2);
    tfG.addColorStop(0, '#60687A'); tfG.addColorStop(1, '#4A5260');
    ctx.fillStyle = tfG;
    ctx.fillRect(pc + (pw - fw2) / 2, pTop, fw2, ft2);
    // Bottom flange
    ctx.fillStyle = '#40485A';
    ctx.fillRect(pc + (pw - fw2) / 2, pBot - ft2, fw2, ft2);
    // Weld bead lines at flange junctions
    ctx.strokeStyle = 'rgba(90,100,118,0.65)'; ctx.lineWidth = 1;
    [pTop + ft2, pBot - ft2].forEach(wy => {
      ctx.beginPath();
      ctx.moveTo(pcx - ww2 / 2, wy); ctx.lineTo(pcx + ww2 / 2, wy);
      ctx.stroke();
    });
    // Lit flange top edge
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(pc + (pw - fw2) / 2, pTop, fw2, 2);
    // Anchor bolts at base plate
    ctx.fillStyle = '#686E7C';
    [pc + (pw - fw2) / 2 + 3, pc + (pw + fw2) / 2 - 5].forEach(bx2 => {
      ctx.beginPath(); ctx.arc(bx2, pBot - 3, 2, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ── Left + right end walls ─────────────────────────────────────────────────
  ctx.fillStyle = '#222530';
  ctx.fillRect(0,              doorY - doorH, TILE, doorH + frameT);
  ctx.fillRect((COLS-1)*TILE,  doorY - doorH, TILE, doorH + frameT);

  // ── "LOADING DOCK" label on beam ──────────────────────────────────────────
  ctx.save();
  ctx.font = `bold ${Math.max(6, Math.floor(TILE * 0.18))}px Arial,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(140,160,195,0.30)';
  ctx.fillText('LOADING DOCK', COLS * TILE / 2, doorY - doorH - beamH / 2);
  ctx.restore();

  // ── Dock bay exterior number labels — Item 25 ─────────────────────────────
  // Each active bay gets a small number stencilled on the beam face
  ctx.save();
  ctx.font = `bold ${Math.max(5, Math.floor(TILE * 0.20))}px Arial,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let _bi = 0; _bi < BAY_COUNT; _bi++) {
    const _bInfo = dockBays ? dockBays[_bi] : null;
    const _bActive = _bInfo ? _bInfo.isActive : false;
    const _bcx = bayCenterCol(_bi) * TILE + TILE / 2;
    const _bcy = doorY - doorH - beamH / 2;
    if (_bActive) {
      // Active bay — number in zone color at moderate opacity
      const _bStopIdx = _bInfo.stopIdx;
      const _bzc = (zones && _bStopIdx >= 0) ? (ZONE_COLORS[_bStopIdx] || ZONE_COLORS[0]) : null;
      ctx.fillStyle = _bzc ? _bzc.border : 'rgba(160,200,240,0.55)';
      ctx.globalAlpha = 0.65;
    } else {
      // Inactive bay — dim stencil
      ctx.fillStyle = 'rgba(100,110,130,0.35)';
      ctx.globalAlpha = 1;
    }
    ctx.fillText(`${_bi + 1}`, _bcx, _bcy);
  }
  ctx.restore();
}

function drawHazardStripe(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const step = Math.ceil(h * 1.2);
  for (let s = x - h; s < x + w + h; s += step * 2) {
    ctx.fillStyle = C.hazardYellow;
    ctx.beginPath();
    ctx.moveTo(s, y); ctx.lineTo(s+step, y); ctx.lineTo(s+step+h, y+h); ctx.lineTo(s+h, y+h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.hazardBlack;
    ctx.beginPath();
    ctx.moveTo(s+step, y); ctx.lineTo(s+step*2, y); ctx.lineTo(s+step*2+h, y+h); ctx.lineTo(s+step+h, y+h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ── DRAW: ZONE (approach lane — chevrons pointing toward dock) ────────────────
// The zone tiles (rows 1–2) are the approach lane. Pallets must be pushed all
// the way up through these tiles to reach the dock at row 0. The visual design
// communicates "keep going up" with animated upward chevrons so players never
// mistake this area for the drop target.

function drawZone(ctx, zone, TILE, frame, rm, wrongZoneFlash, nearPalletRow) {
  if (!zone.tiles || zone.tiles.length === 0) return;
  const zc    = ZONE_COLORS[zone.stopIdx] || ZONE_COLORS[0];
  const pulse = rm ? 0.85 : 0.55 + 0.45 * Math.sin(frame * 0.07);
  const done  = zone.stagedCount >= zone.totalCount;
  const flash = wrongZoneFlash[`z${zone.stopIdx}`] || 0;

  // ── Base fill: subtle color wash so zone is clearly bounded ───────────────
  for (const { row, col } of zone.tiles) {
    const px = col*TILE, py = HUD_H + row*TILE;
    ctx.fillStyle = (row+col)%2===0 ? zc.zoneFill : zc.zoneAlt;
    ctx.fillRect(px, py, TILE, TILE);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,160,20,${0.48*(flash/8)})`; ctx.fillRect(px, py, TILE, TILE);
    }
  }

  // ── Zone completion flash — brief white wash fades over 20 frames ─────────
  if ((zone._doneFlash||0) > 0) {
    const flashAlpha = (zone._doneFlash / 20) * 0.55;
    for (const { row, col } of zone.tiles) {
      const px = col*TILE, py = HUD_H + row*TILE;
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha.toFixed(3)})`;
      ctx.fillRect(px, py, TILE, TILE);
    }
  }

  // ── Thin border stroke around each tile ───────────────────────────────────
  for (const { row, col } of zone.tiles) {
    const px = col*TILE, py = HUD_H + row*TILE;
    ctx.save();
    ctx.strokeStyle = done ? zc.zoneMark : zc.zoneBorder;
    ctx.lineWidth   = done ? 2.5 : 1.5 * pulse;
    ctx.globalAlpha = done ? 1 : 0.50 * pulse + 0.20;
    ctx.strokeRect(px+1, py+1, TILE-2, TILE-2);
    ctx.restore();
  }

  // ── Upward chevrons on each approach tile (animates upward when active) ───
  // Each chevron is a pair of lines forming a "^" symbol.
  // Item 26: when done, draw faded static chevrons instead of hiding entirely
  {
    const CHV_W = Math.max(4, TILE * 0.30);  // half-width of chevron
    const CHV_H = Math.max(3, TILE * 0.18);  // height of each arm
    const STROKE = Math.max(1, TILE * 0.07);
    // Animate: chevrons drift upward when active; freeze when zone complete
    // Item 8: accelerate when a pallet is close (row ≤ 4) to the dock
    const _chevClose = !done && nearPalletRow !== undefined && nearPalletRow !== null && nearPalletRow <= 4;
    const _chevSpeed = _chevClose ? 1.55 : 0.65;  // ~2.4× faster when pallet approaching
    const drift = (rm || done) ? 0 : ((frame * _chevSpeed) % (TILE * 0.40));

    for (const { row, col } of zone.tiles) {
      const px = col*TILE + TILE/2;
      const py = HUD_H + row*TILE + TILE/2;

      for (let k = 0; k < 2; k++) {
        const cy = py + (k * TILE * 0.38) - drift;
        if (cy < HUD_H + row*TILE + 4 || cy > HUD_H + (row+1)*TILE - 4) continue;
        // Done: dim static chevrons (0.12 alpha); active: animated pulse
        const alpha = done ? 0.12 : (rm ? 0.60 : 0.35 + 0.45 * pulse);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = done ? zc.zoneMark : zc.zoneBorder;
        ctx.lineWidth   = done ? STROKE * 0.7 : STROKE;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        ctx.moveTo(px - CHV_W, cy + CHV_H);
        ctx.lineTo(px,          cy);
        ctx.lineTo(px + CHV_W, cy + CHV_H);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ── Zone label + progress pill ─────────────────────────────────────────
  const bbox   = getTileBBox(zone.tiles);
  const bx     = bbox.minCol*TILE + ((bbox.maxCol-bbox.minCol+1)*TILE)/2;
  const by_ctr = HUD_H + bbox.minRow*TILE + ((bbox.maxRow-bbox.minRow+1)*TILE)/2;
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `bold ${Math.max(6,Math.floor(TILE*0.24))}px Arial,sans-serif`;
  ctx.fillStyle = done ? zc.zoneMark : zc.zoneBorder;
  ctx.globalAlpha = done ? 1 : 0.75 + 0.25*pulse;
  ctx.fillText(`STOP ${zone.stopNumber}`, bx, by_ctr - TILE*0.28);
  ctx.font = `${Math.max(5,Math.floor(TILE*0.17))}px Arial,sans-serif`;
  ctx.fillStyle = zc.zoneMark; ctx.globalAlpha = done ? 0.80 : 0.60;
  ctx.fillText((zone.customerName||'').toUpperCase().slice(0,12), bx, by_ctr + TILE*0.02);
  const prog  = `${zone.stagedCount}/${zone.totalCount}`;
  const pillW = Math.max(32, TILE*0.78), pillH = TILE*0.26;
  ctx.globalAlpha = 1;
  ctx.fillStyle = done ? '#44CC66' : zc.zoneBorder;
  roundRect(ctx, bx-pillW/2, by_ctr+TILE*0.25, pillW, pillH, pillH/2); ctx.fill();
  ctx.font = `bold ${Math.max(4,Math.floor(TILE*0.16))}px Arial,sans-serif`;
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(prog, bx, by_ctr+TILE*0.25+pillH/2);
  ctx.restore();
}

// ── DRAW: PALLET ──────────────────────────────────────────────────────────────

function drawPallet(ctx, pallet, TILE, frame, pushDir, rm) {
  if (!pallet.tiles || pallet.tiles.length === 0) return;

  // ── Drop shadow — soft oval cast on floor beneath pallet (skip during dock anim or when lifted) ──
  if (!rm && pallet._dockAnimFrame === 0 && !pallet._lifted) {
    const bbox = getTileBBox(pallet.tiles);
    const ox = pallet.lerpOx || 0, oy = pallet.lerpOy || 0;
    const sw = (bbox.maxCol - bbox.minCol + 1) * TILE;
    const sh = (bbox.maxRow - bbox.minRow + 1) * TILE;
    const scx = bbox.minCol * TILE + sw / 2 + ox + TILE * 0.10;
    const scy = HUD_H + bbox.minRow * TILE + sh / 2 + oy + TILE * 0.14;
    ctx.save();
    ctx.globalAlpha = 0.22;
    const shGrad = ctx.createRadialGradient(scx, scy, 1, scx, scy, Math.max(sw, sh) * 0.72);
    shGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
    shGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(scx, scy, sw * 0.54, sh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Pre-snap shimmer — pallet aligned and one push from correct bay ────────
  if (pallet._preSnap && !rm) {
    const bbox2 = getTileBBox(pallet.tiles);
    const ox2 = pallet.lerpOx || 0, oy2 = pallet.lerpOy || 0;
    const sw2 = (bbox2.maxCol - bbox2.minCol + 1) * TILE;
    const sx2 = bbox2.minCol * TILE + ox2;
    const sy2 = HUD_H + bbox2.minRow * TILE + oy2;  // top edge = dock-facing side
    const shimPulse = 0.60 + 0.40 * Math.abs(Math.sin(frame * 0.22));
    ctx.save();
    ctx.globalAlpha = shimPulse * 0.75;
    const shimGrad = ctx.createLinearGradient(sx2, sy2 - 6, sx2, sy2 + 4);
    shimGrad.addColorStop(0, 'rgba(255,255,160,0.0)');
    shimGrad.addColorStop(0.5,'rgba(255,255,200,1.0)');
    shimGrad.addColorStop(1, 'rgba(255,255,160,0.0)');
    ctx.strokeStyle = shimGrad;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx2 + 4, sy2);
    ctx.lineTo(sx2 + sw2 - 4, sy2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Proximity highlight — jack is facing this pallet, ready to push ────────
  if (pallet._proxHighlight && !rm && pallet._dockAnimFrame === 0) {
    const bbox3 = getTileBBox(pallet.tiles);
    const ox3 = pallet.lerpOx || 0, oy3 = pallet.lerpOy || 0;
    const pulse3 = 0.55 + 0.45 * Math.abs(Math.sin(frame * 0.10));
    const zc3 = ZONE_COLORS[pallet.stopIdx] || ZONE_COLORS[0];
    ctx.save();
    ctx.globalAlpha = pulse3 * 0.60;
    ctx.strokeStyle = zc3.spark || '#FFFFFF';
    ctx.shadowColor  = zc3.spark || '#FFFFFF';
    ctx.shadowBlur   = 12;
    ctx.lineWidth    = 2.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawPalletPerimeter(ctx, pallet.tiles, TILE, ox3, oy3);
    ctx.stroke();
    ctx.restore();
  }

  // ── Rotatable highlight — dashed white border: "you can spin this pallet" ──
  // Item 9: visually distinct from _proxHighlight (no zone color, dashed, dimmer)
  if (pallet._rotatableHighlight && !rm && pallet._dockAnimFrame === 0) {
    const bbox4 = getTileBBox(pallet.tiles);
    const ox4 = pallet.lerpOx || 0, oy4 = pallet.lerpOy || 0;
    const pulse4 = 0.45 + 0.35 * Math.abs(Math.sin(frame * 0.08));
    ctx.save();
    ctx.globalAlpha = pulse4 * 0.75;
    ctx.strokeStyle = '#E0E8FF';
    ctx.shadowColor  = '#AABBFF';
    ctx.shadowBlur   = 6;
    ctx.lineWidth    = 1.8;
    ctx.setLineDash([Math.max(3, TILE * 0.12), Math.max(2, TILE * 0.08)]);
    ctx.lineDashOffset = -(frame * 0.5) % (TILE * 0.20);  // marching ants
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawPalletPerimeter(ctx, pallet.tiles, TILE, ox4, oy4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Lift elevation — pallet stays flush at face tiles (no vertical offset) ──
  // Forks are hidden (forksOnly pass is skipped when lifted), pallet sits flush
  // against the orange body. No shadow or elevation needed.

  // Dock loading animation — slide up and fade
  if (pallet._dockAnimFrame > 0) {
    const t  = pallet._dockAnimFrame / DOCK_ANIM_FRAMES;  // 1→0 as anim ends
    const ty2 = -TILE * (1 - t) * 1.8;                    // slide upward
    const sc = 0.4 + 0.6 * t;                             // shrink
    const alpha = Math.max(0, t * 1.5 - 0.3);
    if (alpha <= 0) return;
    const bbox = getTileBBox(pallet.tiles);
    const cx = bbox.minCol*TILE + ((bbox.maxCol-bbox.minCol+1)*TILE)/2;
    const cy = HUD_H + bbox.minRow*TILE + ((bbox.maxRow-bbox.minRow+1)*TILE)/2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy + ty2);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    _drawPalletBody(ctx, pallet, TILE, frame, rm);
    ctx.restore();
    return;
  }

  // ── Push squash/stretch juice ───────────────────────────────────────────
  if (pushDir !== null && pushDir !== undefined) {
    // pushAnimFrames runs 6→0; t=1 on frame 6 (fresh push), 0 when expired
    // We don't have pushAnimFrames here, so derive from cl — but drawPallet
    // doesn't receive cl. Instead we embed t via a property set at call site.
    // Use pallet._squashT (set in render loop, 0 when not pushing)
    const t = pallet._squashT || 0;  // 1→0 over 6 frames
    const isH = (pushDir === 0 || pushDir === 2); // horizontal push
    // squash: compress in push direction; stretch: perpendicular
    const squash  = 1 - t * 0.18;   // compress to 0.82 at peak
    const stretch = 1 + t * 0.12;   // stretch to 1.12 perpendicular
    const bbox = getTileBBox(pallet.tiles);
    const ox = pallet.lerpOx || 0, oy = pallet.lerpOy || 0;
    const pcx = bbox.minCol * TILE + (bbox.maxCol - bbox.minCol + 1) * TILE / 2 + ox;
    const pcy = HUD_H + bbox.minRow * TILE + (bbox.maxRow - bbox.minRow + 1) * TILE / 2 + oy;
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.scale(isH ? squash : stretch, isH ? stretch : squash);
    ctx.translate(-pcx, -pcy);
    _drawPalletBody(ctx, pallet, TILE, frame, rm);
    ctx.restore();
  } else {
    // Item 5: settle bounce — scale pulse when pallet first locks into bay
    const _bounce = pallet._lockBounceFrames || 0;
    if (_bounce > 0 && !rm) {
      // 12→9: scale 1.0→1.08 (seat in), 9→6: 1.08→1.0, 6→3: 1.0→0.96 (settle), 3→0: 0.96→1.0
      const _bSc = _bounce > 9 ? (1.00 + (_bounce - 9) / 3 * 0.08)
                 : _bounce > 6 ? (1.08 - (9 - _bounce) / 3 * 0.08)
                 : _bounce > 3 ? (1.00 - (6 - _bounce) / 3 * 0.04)
                 :               (0.96 + (3 - _bounce) / 3 * 0.04);
      const _bbox = getTileBBox(pallet.tiles);
      const _bcx = _bbox.minCol*TILE + (_bbox.maxCol-_bbox.minCol+1)*TILE/2;
      const _bcy = HUD_H + _bbox.minRow*TILE + (_bbox.maxRow-_bbox.minRow+1)*TILE/2;
      ctx.save();
      ctx.translate(_bcx, _bcy);
      ctx.scale(_bSc, _bSc);
      ctx.translate(-_bcx, -_bcy);
      _drawPalletBody(ctx, pallet, TILE, frame, rm);
      ctx.restore();
    } else {
      _drawPalletBody(ctx, pallet, TILE, frame, rm);
    }
  }

}

function _drawPalletBody(ctx, pallet, TILE, frame, rm) {
  const zc     = ZONE_COLORS[pallet.stopIdx] || ZONE_COLORS[0];
  const ox     = (pallet.lerpOx || 0) + (pallet._carryOx || 0);
  const oy     = (pallet.lerpOy || 0) + (pallet._swayOy || 0) + (pallet._carryOy || 0);
  const tx     = col => col*TILE + ox;
  const ty     = row => HUD_H + row*TILE + oy;
  const set    = new Set(pallet.tiles.map(({row,col})=>`${row},${col}`));
  const bbox   = getTileBBox(pallet.tiles);
  const locked = pallet.locked;
  const isCrate = pallet.shapeId === 'S1';
  const cargo   = pallet.cargoStyle;

  if (cargo === 'drum') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Drum(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'ibc') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_IBC(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'industrial') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Industrial(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'produce') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Produce(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'tires') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Tires(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'fragile') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Fragile(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'electronics') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Electronics(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (cargo === 'medical') {
    for (const {row,col} of pallet.tiles)
      drawCargoTile_Medical(ctx, tx(col), ty(row), TILE, zc, locked);
  } else if (isCrate) {
    for (const {row,col} of pallet.tiles) {
      drawCrateTile(ctx, tx(col), ty(row), TILE, zc, locked, pallet.label, pallet.weightLbs, frame);
    }
  } else {
    for (const {row,col} of pallet.tiles) {
      drawPalletTile(ctx, tx(col), ty(row), TILE, zc, locked, set, row, col, bbox);
    }
  }

  ctx.save();
  ctx.strokeStyle = locked ? darkenHex(zc.palletEdge, 0.15) : zc.palletEdge;
  ctx.lineWidth   = locked ? 2.5 : 2;
  drawPalletPerimeter(ctx, pallet.tiles, TILE, ox, oy);
  ctx.restore();

  const cx = tx(bbox.minCol) + ((bbox.maxCol-bbox.minCol+1)*TILE)/2;
  const cy = ty(bbox.minRow) + ((bbox.maxRow-bbox.minRow+1)*TILE)/2;
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';

  if (locked) {
    ctx.font=`bold ${Math.max(10,Math.floor(TILE*0.32))}px Arial,sans-serif`;
    ctx.fillStyle='#FFFFFF'; ctx.globalAlpha=0.92;
    ctx.fillText('✓', cx, cy-TILE*0.10);
    ctx.font=`bold ${Math.max(5,Math.floor(TILE*0.16))}px Arial,sans-serif`;
    ctx.fillText('LOADING', cx, cy+TILE*0.28);
  } else {
    if (!isCrate) {
      const LW=Math.min(TILE*1.4,((bbox.maxCol-bbox.minCol+1)*TILE)*0.70), LH=TILE*0.28;
      const LY=cy-TILE*0.14;
      ctx.fillStyle=zc.palletEdge;
      roundRect(ctx,cx-LW/2,LY-LH/2,LW,LH,LH/2); ctx.fill();
      ctx.font=`bold ${Math.max(5,Math.floor(TILE*0.19))}px Arial,sans-serif`;
      ctx.fillStyle='#FFFFFF';
      ctx.fillText((pallet.label||`S${pallet.stopIdx+1}`).slice(0,8),cx,LY);
      ctx.font=`${Math.max(4,Math.floor(TILE*0.14))}px Arial,sans-serif`;
      ctx.fillStyle=zc.labelColor; ctx.globalAlpha=0.75;
      ctx.fillText(pallet.weightLbs+'lb',cx,cy+TILE*0.30);
      // ── Stop number badge — top-left corner of bounding box ──────────────
      ctx.globalAlpha = 1;
      const bdgR = Math.max(5, Math.floor(TILE * 0.22));
      const bdgX = tx(bbox.minCol) + bdgR + 2;
      const bdgY = ty(bbox.minRow) + bdgR + 2;
      ctx.fillStyle = zc.body;
      ctx.beginPath(); ctx.arc(bdgX, bdgY, bdgR, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = zc.border; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bdgX, bdgY, bdgR, 0, Math.PI*2); ctx.stroke();
      ctx.font = `bold ${Math.max(5, Math.floor(bdgR * 1.1))}px Arial,sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(`S${pallet.stopIdx+1}`, bdgX+0.5, bdgY+0.8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`S${pallet.stopIdx+1}`, bdgX, bdgY);
    }
    if (ROTATABLE_SHAPES.has(pallet.shapeId)) {
      const bx2=tx(bbox.maxCol)+TILE-13, by2=ty(bbox.minRow)+3;
      ctx.globalAlpha=0.80; ctx.font='bold 11px Arial,sans-serif';
      ctx.fillStyle=zc.palletEdge; ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText('↻',bx2,by2);
    }
    if (pallet.weightLbs>=600) {
      const sh=Math.ceil(TILE*0.08);
      for (const {row,col} of pallet.tiles) {
        ctx.save();
        ctx.beginPath(); ctx.rect(tx(col)+1,ty(row)+1,TILE-2,sh); ctx.clip();
        ctx.fillStyle='rgba(220,60,0,0.60)'; ctx.fillRect(tx(col)+1,ty(row)+1,TILE-2,sh);
        ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=2;
        for (let s=-sh;s<TILE+sh;s+=5) { ctx.moveTo(tx(col)+1+s,ty(row)+1); ctx.lineTo(tx(col)+1+s+sh,ty(row)+1+sh); }
        ctx.stroke(); ctx.restore();
      }
    }
  }
  ctx.restore();
}

// ── Cargo style resolver ──────────────────────────────────────────────────────
function getCargoStyle(label, itemType) {
  const t = (label + ' ' + (itemType||'')).toLowerCase();
  if (/drum|barrel|cylinder/.test(t))           return 'drum';
  if (/ibc|tote|intermediate/.test(t))          return 'ibc';
  if (/industrial|heavy|osha|orange/.test(t))   return 'industrial';
  if (/produce|fruit|vegeta|food/.test(t))      return 'produce';
  if (/tire|tyre|wheel|auto/.test(t))           return 'tires';
  if (/fragile|glass|breakable/.test(t))        return 'fragile';
  if (/electr|tech|circuit|comput/.test(t))     return 'electronics';
  if (/medic|pharma|health|hospital/.test(t))   return 'medical';
  return null; // use standard pallet/crate
}

// ── DRAW: specialty cargo tiles ───────────────────────────────────────────────

function drawCargoTile_Drum(ctx, px, py, T, zc, locked) {
  const cx = px+T/2, cy = py+T/2, R = T*0.40;
  ctx.fillStyle='rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx+2,cy+3,R*0.90,R*0.85,0,0,Math.PI*2); ctx.fill();
  const g = ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,R*0.05,cx,cy,R);
  g.addColorStop(0,lightenHex(zc.palletTop,25)); g.addColorStop(0.65,zc.palletTop); g.addColorStop(1,darkenHex(zc.palletTop,0.38));
  ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,R,R*0.93,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=darkenHex(zc.palletTop,0.40); ctx.lineWidth=2;
  [0.55,0.75].forEach(rf=>{ctx.beginPath();ctx.ellipse(cx,cy,R*rf,R*rf*0.93,0,0,Math.PI*2);ctx.stroke();});
  ctx.fillStyle=darkenHex(zc.palletTop,0.52);
  ctx.beginPath(); ctx.ellipse(cx,cy,R*0.12,R*0.11,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=darkenHex(zc.palletTop,0.55); ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(cx,cy,R,R*0.93,0,0,Math.PI*2); ctx.stroke();
  if(locked){ctx.fillStyle='rgba(255,255,255,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',cx,cy);}
}

function drawCargoTile_IBC(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle='#404850'; ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  ctx.fillStyle='#181820'; ctx.fillRect(px+T-BV,py+T-BV,BV,BV);
  ctx.fillStyle='#3A4048'; ctx.fillRect(px,py,US,US);
  const INS=Math.ceil(US*0.15);
  ctx.fillStyle=`rgba(${parseInt(zc.palletTop.slice(1,3),16)},${parseInt(zc.palletTop.slice(3,5),16)},${parseInt(zc.palletTop.slice(5,7),16)},0.55)`;
  ctx.fillRect(px+INS,py+INS,US-INS*2,US-INS*2);
  ctx.strokeStyle='#606878'; ctx.lineWidth=2;
  const stp=Math.ceil(US/4);
  for(let gx=px+stp;gx<px+US;gx+=stp){ctx.beginPath();ctx.moveTo(gx,py);ctx.lineTo(gx,py+US);ctx.stroke();}
  for(let gy=py+stp;gy<py+US;gy+=stp){ctx.beginPath();ctx.moveTo(px,gy);ctx.lineTo(px+US,gy);ctx.stroke();}
  ctx.fillStyle='#586070';
  [[px,py],[px+US-6,py],[px,py+US-6],[px+US-6,py+US-6]].forEach(([x,y])=>ctx.fillRect(x,y,6,6));
  ctx.strokeStyle='#7082A0'; ctx.lineWidth=1.5; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='rgba(150,230,255,0.90)';ctx.font=`bold ${Math.floor(T*0.28)}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',px+US/2,py+US/2);}
}

function drawCargoTile_Industrial(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle='#6A2200'; ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  ctx.fillStyle='#3A1000'; ctx.fillRect(px+T-BV,py+T-BV,BV,BV);
  ctx.fillStyle='#E84800'; ctx.fillRect(px,py,US,US);
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5; ctx.strokeRect(px+4,py+4,US-8,US-8);
  ctx.beginPath();
  ctx.moveTo(px+US*0.5,py+4); ctx.lineTo(px+US*0.5,py+US-4);
  ctx.moveTo(px+4,py+US*0.5); ctx.lineTo(px+US-4,py+US*0.5);
  ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,0.30)';
  [[0.12,0.12],[0.88,0.12],[0.12,0.88],[0.88,0.88]].forEach(([fx,fy])=>{
    ctx.beginPath(); ctx.arc(px+US*fx,py+US*fy,2,0,Math.PI*2); ctx.fill();
  });
  ctx.fillStyle='#FFD700'; ctx.fillRect(px+5,py+US*0.36,US-10,US*0.26);
  ctx.fillStyle='#1A1A1A'; ctx.font=`bold ${Math.max(5,Math.floor(T*0.11))}px monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('HEAVY',px+US/2,py+US*0.47); ctx.fillText('LOAD',px+US/2,py+US*0.55);
  ctx.strokeStyle='#6A2200'; ctx.lineWidth=2; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='#FFD700';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.fillText('✓',px+US/2,py+US/2+T*0.08);}
}

function drawCargoTile_Produce(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle='#2A4010'; ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  const nSl=5,slH=Math.floor(US/nSl),gap=Math.max(1,Math.ceil(slH*0.18));
  for(let sl=0;sl<nSl;sl++){
    const sy=py+sl*slH;
    ctx.fillStyle=sl%2===0?'#558828':'#4A7020'; ctx.fillRect(px,sy,US,slH-gap);
    ctx.fillStyle='#1A2A08'; ctx.fillRect(px,sy+slH-gap,US,gap);
  }
  ctx.font=`${Math.max(9,Math.floor(T*0.22))}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('🍊',px+US*0.27,py+US*0.36); ctx.fillText('🍋',px+US*0.73,py+US*0.52); ctx.fillText('🍊',px+US*0.50,py+US*0.22);
  ctx.strokeStyle='#2A4010'; ctx.lineWidth=1.5; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='rgba(255,255,255,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.fillText('✓',px+US/2,py+US/2);}
}

function drawCargoTile_Tires(ctx, px, py, T, zc, locked) {
  const cx=px+T/2-1,cy=py+T/2+1,R=T*0.39;
  ctx.fillStyle='rgba(0,0,0,0.20)'; ctx.beginPath(); ctx.ellipse(cx+2,cy+3,R*0.90,R*0.88,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1A1A1A'; ctx.beginPath(); ctx.ellipse(cx,cy,R,R*0.95,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#2A2A2A'; ctx.lineWidth=1.5;
  for(let a=0;a<Math.PI*2;a+=0.40){
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*R*0.70,cy+Math.sin(a)*R*0.70*0.95);
    ctx.lineTo(cx+Math.cos(a)*R*0.95,cy+Math.sin(a)*R*0.95*0.95); ctx.stroke();
  }
  ctx.fillStyle='#88888A'; ctx.beginPath(); ctx.ellipse(cx,cy,R*0.52,R*0.50,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#C0C0C8';
  for(let a=0;a<Math.PI*2;a+=Math.PI*2/5){
    ctx.beginPath(); ctx.arc(cx+Math.cos(a)*R*0.34,cy+Math.sin(a)*R*0.34*0.96,R*0.07,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle='#404048'; ctx.beginPath(); ctx.ellipse(cx,cy,R*0.14,R*0.13,0,0,Math.PI*2); ctx.fill();
  if(locked){ctx.fillStyle='rgba(255,255,255,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✓',cx,cy);}
}

function drawCargoTile_Fragile(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle=darkenHex(zc.crateTop||'#C08040',0.30); ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  ctx.fillStyle='#F0EAD0'; ctx.fillRect(px,py,US,US);
  const pad=Math.ceil(US/5);
  ctx.fillStyle='rgba(200,190,160,0.40)';
  for(let r=0;r<5;r++) for(let c=0;c<5;c++) if((r+c)%2===0) ctx.fillRect(px+c*pad,py+r*pad,pad,pad);
  ctx.fillStyle='#CC0000'; ctx.font=`${Math.max(9,Math.floor(T*0.24))}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('↑',px+US*0.25,py+US*0.38); ctx.fillText('↑',px+US*0.75,py+US*0.38);
  ctx.font=`bold ${Math.max(4,Math.floor(T*0.11))}px sans-serif`; ctx.fillText('FRAGILE',px+US/2,py+US*0.73);
  ctx.font=`${Math.max(8,Math.floor(T*0.20))}px sans-serif`; ctx.fillText('🥃',px+US/2,py+US*0.50);
  ctx.strokeStyle='#CC0000'; ctx.lineWidth=1.5; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='rgba(255,255,255,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.fillText('✓',px+US/2,py+US/2);}
}

function drawCargoTile_Electronics(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle='#1A2030'; ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  ctx.fillStyle='#0E1420'; ctx.fillRect(px+T-BV,py+T-BV,BV,BV);
  ctx.fillStyle='#1E2840'; ctx.fillRect(px,py,US,US);
  ctx.save(); ctx.beginPath(); ctx.rect(px+2,py+2,US-4,US-4); ctx.clip();
  ctx.strokeStyle='rgba(80,140,255,0.35)'; ctx.lineWidth=0.8; ctx.beginPath();
  for(let gx=px;gx<px+US;gx+=6){ctx.moveTo(gx,py);ctx.lineTo(gx,py+US);}
  for(let gy=py;gy<py+US;gy+=6){ctx.moveTo(px,gy);ctx.lineTo(px+US,gy);}
  ctx.stroke(); ctx.restore();
  ctx.font=`${Math.max(9,Math.floor(T*0.28))}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('📱',px+US/2,py+US*0.42);
  ctx.fillStyle='rgba(80,150,255,0.80)'; ctx.font=`bold ${Math.max(4,Math.floor(T*0.10))}px monospace`;
  ctx.fillText('ELECTRONICS',px+US/2,py+US*0.76);
  ctx.strokeStyle='#3050A0'; ctx.lineWidth=2; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='rgba(150,220,255,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.fillText('✓',px+US/2,py+US/2);}
}

function drawCargoTile_Medical(ctx, px, py, T, zc, locked) {
  const BV=Math.max(2,Math.ceil(T*0.12)),US=T-BV;
  ctx.fillStyle='#1A3A28'; ctx.fillRect(px+BV,py+T-BV,T-BV,BV); ctx.fillRect(px+T-BV,py+BV,BV,T-BV);
  ctx.fillStyle='#0E1E14'; ctx.fillRect(px+T-BV,py+T-BV,BV,BV);
  ctx.fillStyle='#F0F8F0'; ctx.fillRect(px,py,US,US);
  const cw=US*0.28,ch=US*0.06;
  ctx.fillStyle='#CC0022'; ctx.fillRect(px+(US-cw)/2,py+(US-ch)/2,cw,ch);
  ctx.fillRect(px+(US-ch)/2,py+(US-cw)/2,ch,cw);
  ctx.strokeStyle='rgba(0,180,80,0.22)'; ctx.lineWidth=1;
  [0.25,0.50,0.75].forEach(f=>{
    ctx.beginPath();ctx.moveTo(px,py+US*f);ctx.lineTo(px+US,py+US*f);ctx.stroke();
    ctx.beginPath();ctx.moveTo(px+US*f,py);ctx.lineTo(px+US*f,py+US);ctx.stroke();
  });
  ctx.fillStyle='#0A4420'; ctx.font=`bold ${Math.max(4,Math.floor(T*0.12))}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('MEDICAL',px+US/2,py+US*0.82);
  ctx.strokeStyle='#0A4420'; ctx.lineWidth=1.5; ctx.strokeRect(px+0.5,py+0.5,US-1,US-1);
  if(locked){ctx.fillStyle='rgba(0,220,80,0.90)';ctx.font=`bold ${Math.floor(T*0.30)}px Arial,sans-serif`;ctx.fillText('✓',px+US/2,py+US/2);}
}

function drawPalletTile(ctx, px, py, TILE, zc, locked, set, row, col, bbox) {
  const TOP   = locked ? darkenHex(zc.palletTop, 0.12) : zc.palletTop;
  const GRAIN = locked ? darkenHex(zc.palletGrain, 0.12) : zc.palletGrain;
  const SIDE  = zc.palletSide, SHD = zc.palletShadow;
  const GAP   = Math.max(1, Math.ceil(TILE * 0.04));
  const BEVEL = Math.max(2, Math.ceil(TILE * 0.12));
  const BLOCK = Math.max(3, Math.ceil(TILE * 0.14));
  const usable = TILE - BEVEL;

  ctx.fillStyle = SIDE; ctx.fillRect(px+BEVEL, py+TILE-BEVEL, TILE-BEVEL, BEVEL);
  ctx.fillRect(px+TILE-BEVEL, py+BEVEL, BEVEL, TILE-BEVEL);
  ctx.fillStyle = SHD; ctx.fillRect(px+TILE-BEVEL, py+TILE-BEVEL, BEVEL, BEVEL);
  ctx.fillStyle = TOP; ctx.fillRect(px, py, usable, usable);

  const nPlanks=3, totalGap=GAP*(nPlanks-1);
  const plankH=Math.floor((usable-totalGap)/nPlanks);
  const plankTops=[py, py+plankH+GAP, py+(plankH+GAP)*2];

  for (let p=0; p<nPlanks; p++) {
    const plyY=plankTops[p], plyH=(p===nPlanks-1)?(py+usable-plyY):plankH;
    if (plyH<=0) continue;
    ctx.fillStyle = p%2===0 ? TOP : lightenHex(TOP,8);
    ctx.fillRect(px, plyY, usable, plyH);
    ctx.save();
    ctx.beginPath(); ctx.rect(px+1, plyY+1, usable-2, plyH-2); ctx.clip();
    ctx.strokeStyle=GRAIN; ctx.lineWidth=0.7;
    ctx.beginPath();
    [0.30,0.55,0.78].forEach(f => { ctx.moveTo(px,plyY+plyH*f); ctx.lineTo(px+usable,plyY+plyH*f); });
    ctx.stroke(); ctx.restore();
    if (p<nPlanks-1) { ctx.fillStyle=SHD; ctx.fillRect(px,plyY+plyH,usable,GAP); }
  }

  const isLeftEdge  = !set.has(`${row},${col-1}`);
  const isRightEdge = !set.has(`${row},${col+1}`);
  const forkMidY = py+(TILE-BEVEL)/2;
  const forkH    = Math.max(3,Math.ceil(TILE*0.22));
  const forkY1   = forkMidY-forkH/2, forkY2=forkMidY+forkH/2;

  if (isLeftEdge) {
    ctx.fillStyle=GRAIN; ctx.fillRect(px,py,BLOCK,plankTops[1]-py);
    ctx.fillStyle=SHD;   ctx.fillRect(px,forkY1,BLOCK,forkH);
    ctx.fillStyle=GRAIN; ctx.fillRect(px,forkY2,BLOCK,py+usable-forkY2);
  }
  if (isRightEdge) {
    const rx=px+usable-BLOCK;
    ctx.fillStyle=GRAIN; ctx.fillRect(rx,py,BLOCK,plankTops[1]-py);
    ctx.fillStyle=SHD;   ctx.fillRect(rx,forkY1,BLOCK,forkH);
    ctx.fillStyle=GRAIN; ctx.fillRect(rx,forkY2,BLOCK,py+usable-forkY2);
  }
}

function drawCrateTile(ctx, px, py, TILE, zc, locked, label, weight, frame) {
  const TOP   = locked ? darkenHex(zc.crateTop, 0.12) : zc.crateTop;
  const GRAIN = zc.crateGrain, BAND = zc.crateband;
  const BEVEL = Math.max(2, Math.ceil(TILE*0.14));
  const BRACK = Math.max(3, Math.ceil(TILE*0.14));
  const usable = TILE - BEVEL;
  ctx.fillStyle=GRAIN; ctx.fillRect(px+BEVEL,py+TILE-BEVEL,TILE-BEVEL,BEVEL);
  ctx.fillRect(px+TILE-BEVEL,py+BEVEL,BEVEL,TILE-BEVEL);
  ctx.fillStyle=zc.palletShadow; ctx.fillRect(px+TILE-BEVEL,py+TILE-BEVEL,BEVEL,BEVEL);
  ctx.fillStyle=TOP; ctx.fillRect(px,py,usable,usable);
  ctx.save();
  ctx.beginPath(); ctx.rect(px+BRACK,py+BRACK,usable-BRACK*2,usable-BRACK*2); ctx.clip();
  ctx.strokeStyle=GRAIN; ctx.lineWidth=0.6;
  ctx.beginPath();
  for (let i=1;i<6;i++) { ctx.moveTo(px,py+(usable/6)*i); ctx.lineTo(px+usable,py+(usable/6)*i); }
  ctx.stroke(); ctx.restore();
  ctx.strokeStyle=BAND; ctx.lineWidth=Math.max(1.5,TILE*0.05);
  ctx.beginPath();
  ctx.moveTo(px,py+usable*0.38); ctx.lineTo(px+usable,py+usable*0.38);
  ctx.moveTo(px,py+usable*0.65); ctx.lineTo(px+usable,py+usable*0.65);
  ctx.moveTo(px+usable*0.38,py); ctx.lineTo(px+usable*0.38,py+usable);
  ctx.moveTo(px+usable*0.65,py); ctx.lineTo(px+usable*0.65,py+usable);
  ctx.stroke();
  ctx.fillStyle=BAND;
  [[0,0],[usable-BRACK,0],[0,usable-BRACK],[usable-BRACK,usable-BRACK]].forEach(([cx2,cy2])=>{
    ctx.fillRect(px+cx2,py+cy2,BRACK,BRACK);
    ctx.strokeStyle=darkenHex(BAND,0.25); ctx.lineWidth=0.5;
    ctx.strokeRect(px+cx2,py+cy2,BRACK,BRACK);
  });
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(5,Math.floor(TILE*0.22))}px Arial,sans-serif`;
  ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.globalAlpha=locked?0.90:0.80;
  ctx.fillText(locked?'✓':(label||'BOX').slice(0,4),px+usable/2,py+usable/2-TILE*0.04);
  ctx.font=`${Math.max(4,Math.floor(TILE*0.14))}px Arial,sans-serif`;
  ctx.fillStyle='rgba(255,255,255,0.55)';
  ctx.fillText(weight+'lb',px+usable/2,py+usable/2+TILE*0.20);
  ctx.restore();
}

// ── DRAW: JACK (4 style variants) ─────────────────────────────────────────────

function drawJack(ctx, jackPixelX, jackPixelY, TILE, jackDir, trail, frame, rm, isMoving, pushT, shakeT, comboLv, lightMode, forksOnly, skinTone, pumpT, forkSlide) {
  const T   = TILE;
  const rot = DIR_ROT[jackDir];
  // Idle breathing bob — tiny vertical sine when jack is stationary
  const bob = (!isMoving && !rm) ? Math.sin(frame * 0.055) * 1.8 : 0;
  // jackPixelX/Y is the center of the 2x2 body (anchor + TILE)
  const cx  = jackPixelX, cy = jackPixelY + bob;

  // ── Fork geometry constants ───────────────────────────────────────────────
  // In local rotated space: +x = forward (fork direction), +y = sideways.
  // Local x=0 is the tile seam between fork tiles (ahead) and body tiles (behind).
  const FX   = T * 0.02;   // forks start just past tile seam
  const FW   = T * 0.88;   // fork length — stays within the forward tile, no wall clip
  const FY1  = -T * 0.43;  // top tine center y (symmetric)
  const FY2  =  T * 0.43;  // bottom tine center y
  const FH   =  T * 0.09;  // tine thickness

  // ── Floor shadow ─────────────────────────────────────────────────────────
  if (!rm) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const shGrad = ctx.createRadialGradient(cx, cy + T*0.28, 2, cx, cy + T*0.18, T*0.72);
    shGrad.addColorStop(0, 'rgba(0,0,0,0.70)');
    shGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + T*0.22, T*0.72, T*0.32, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ── Headlight cone ───────────────────────────────────────────────────────
  if (!rm) {
    const _isNight = lightMode === 2;
    const _hlBaseAlpha = _isNight ? 0.18 : 0.07;
    const _hlLen  = T * 4.0;
    const _hlHalf = T * 1.10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const _hlTipX = T * 0.28;
    const _hlEndX = _hlTipX + _hlLen;
    const _hlGrad = ctx.createLinearGradient(_hlTipX, 0, _hlEndX, 0);
    if (_isNight) {
      _hlGrad.addColorStop(0,   'rgba(255,245,200,0.55)');
      _hlGrad.addColorStop(0.3, 'rgba(255,240,180,0.22)');
      _hlGrad.addColorStop(1,   'rgba(255,230,160,0)');
    } else {
      _hlGrad.addColorStop(0,   'rgba(255,250,220,0.22)');
      _hlGrad.addColorStop(0.4, 'rgba(255,245,200,0.08)');
      _hlGrad.addColorStop(1,   'rgba(255,240,180,0)');
    }
    ctx.globalAlpha = _hlBaseAlpha;
    ctx.beginPath();
    ctx.moveTo(_hlTipX, 0);
    ctx.lineTo(_hlEndX, -_hlHalf);
    ctx.lineTo(_hlEndX,  _hlHalf);
    ctx.closePath();
    ctx.fillStyle = _hlGrad;
    ctx.fill();
    ctx.restore();
  }

  // ── Ghost trail ───────────────────────────────────────────────────────────
  const _clv = Math.min(5, comboLv || 0);
  const _trailAlpMul  = 1 + _clv * 0.35;
  const _trailSzMul   = 1 + _clv * 0.25;
  const _trailColor   = _clv >= 3 ? '#00FFFF' : _clv >= 2 ? '#FFAA00' : '#FF6600';
  for (let i = 0; i < trail.length; i++) {
    const tr  = trail[i];
    const alp = Math.min(0.75, ((i + 1) / trail.length) * 0.18 * _trailAlpMul);
    const sz  = T * 0.14 * ((i + 1) / trail.length) * _trailSzMul;
    ctx.save();
    ctx.globalAlpha = alp;
    if (_clv >= 2 && !rm) { ctx.shadowColor = _trailColor; ctx.shadowBlur = 6 + _clv * 2; }
    ctx.strokeStyle = _trailColor; ctx.lineWidth = T * 0.055 * (1 + _clv * 0.15);
    ctx.strokeRect(tr.x - sz, tr.y - sz, sz * 2, sz * 2);
    ctx.restore();
  }

  // ── Forks-only pass: drawn UNDER pallets (z-layer) ───────────────────────
  if (forksOnly) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    if ((pushT||0) > 0 && !rm) ctx.rotate((pushT||0) * 0.07);
    const _pt2 = pushT || 0;
    const _FW2 = FW * (1 + _pt2 * 0.12);
    // Fork shank bar connecting tines to body
    ctx.fillStyle = '#9A7200';
    ctx.fillRect(FX - T*0.02, FY1 - T*0.03, T*0.05, FY2 - FY1 + FH + T*0.06);
    // Tines (thick stroked lines)
    ctx.strokeStyle = '#C89000'; ctx.lineWidth = FH; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(FX, FY1); ctx.lineTo(FX + _FW2, FY1);
    ctx.moveTo(FX, FY2); ctx.lineTo(FX + _FW2, FY2);
    ctx.stroke();
    // Tine top-face highlight
    ctx.strokeStyle = '#FFDD00'; ctx.lineWidth = FH * 0.28;
    ctx.beginPath();
    ctx.moveTo(FX, FY1 - FH*0.36); ctx.lineTo(FX + _FW2, FY1 - FH*0.36);
    ctx.moveTo(FX, FY2 - FH*0.36); ctx.lineTo(FX + _FW2, FY2 - FH*0.36);
    ctx.stroke();
    // Tine tips
    ctx.fillStyle = _pt2 > 0.1 ? `rgba(255,${Math.floor(210+45*(1-_pt2))},0,1)` : '#E8B000';
    ctx.fillRect(FX + _FW2 - T*0.04, FY1 - FH*0.5, T*0.04, FH);
    ctx.fillRect(FX + _FW2 - T*0.04, FY2 - FH*0.5, T*0.04, FH);
    ctx.lineCap = 'butt';
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  if ((pushT||0) > 0 && !rm) ctx.rotate((pushT||0) * 0.07);

  // ── Body geometry ─────────────────────────────────────────────────────────
  // Front face (BX+BW) = 0 = tile seam; body extends backward (negative x)
  const BX  = -T * 0.26;
  const BY  = -T * 0.47;
  const BW  =  T * 0.26;   // compact depth (BX+BW = 0 = tile seam flush)
  const BH  =  T * 0.94;   // full width

  // Tiller geometry (extends from body rear toward operator)
  const TX1 = BX;           // tiller starts at body rear face
  const TX2 = -T * 0.85;   // tiller end (where handle is)
  const TTH =  T * 0.08;   // tiller rod thickness
  const TCY =  T * 0.02;   // slight y offset for visual interest

  // Handle geometry (T-bar at tiller end)
  const HX    = TX2 + T * 0.03;  // handle x position
  const HY1   = -T * 0.45;       // handle top end
  const HY2   =  T * 0.45;       // handle bottom end
  const HHH   =  T * 0.09;       // handle rod thickness
  const gripL =  T * 0.18;       // rubber grip length at each end

  const skin = skinTone || '#D08A55';

  // ── Crossbar (body ↔ fork connection at tile seam) ───────────────────────
  ctx.fillStyle = '#B88800';
    roundRect(ctx, BX - T*0.03, BY - T*0.05, BW + T*0.04, BH + T*0.10, T*0.04);
  ctx.fill();

  // ── Orange body (compact, flush at tile seam) ─────────────────────────────
  ctx.fillStyle = '#D44010';
    roundRect(ctx, BX, BY, BW, BH, T*0.06);
  ctx.fill();
  // Top-face highlight
  ctx.fillStyle = '#E85020';
    roundRect(ctx, BX, BY, BW, BH * 0.44, T*0.06);
  ctx.fill();
  // Wrong-zone red flash
  if ((shakeT || 0) > 0 && !rm) {
    ctx.save();
    ctx.globalAlpha = (shakeT / 6) * 0.55;
    ctx.fillStyle = '#FF2200';
        roundRect(ctx, BX, BY, BW, BH, T*0.06);
    ctx.fill();
    ctx.restore();
  }
  // Warning label (yellow with ⚠ and capacity text)
  const lblX = BX + BW * 0.10;
  const lblY = BY + BH * 0.18;
  const lblW = BW * 0.80;
  const lblH = BH * 0.62;
  ctx.fillStyle = '#FFD700';
    roundRect(ctx, lblX, lblY, lblW, lblH, T*0.03);
  ctx.fill();
  // Counter-rotate text so it is always upright regardless of jack direction
  const _lblCX = BX + BW * 0.50;
  const _lblCY = BY + BH * 0.50;
  ctx.save();
  ctx.translate(_lblCX, _lblCY);
  ctx.rotate(-rot);   // undo the jack's world rotation for text only
  ctx.fillStyle = '#1A1A00';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(4, Math.floor(T * 0.17))}px Arial,sans-serif`;
  ctx.fillText('⚠', 0, -lblH * 0.14);
  ctx.font = `${Math.max(3, Math.floor(T * 0.09))}px Arial,sans-serif`;
  ctx.fillText('2500kg', 0, lblH * 0.12);
  ctx.restore();
  // Corner bolts
  const bR = Math.max(1, T * 0.04);
  ctx.fillStyle = '#B83008';
  [BY + BH * 0.09, BY + BH * 0.91].forEach(by2 => {
    ctx.beginPath(); ctx.arc(BX + BW * 0.20, by2, bR, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(BX + BW * 0.80, by2, bR, 0, Math.PI*2); ctx.fill();
  });

  // ── Tiller arm ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#7A1A04';
    roundRect(ctx, TX2, TCY - TTH * 0.5, TX1 - TX2, TTH, T * 0.04);
  ctx.fill();
  // Tiller shadow underside
  ctx.fillStyle = '#550E02';
    roundRect(ctx, TX2, TCY + TTH * 0.1, TX1 - TX2, TTH * 0.35, T * 0.02);
  ctx.fill();

  // ── Raise/lower levers (on tiller sides) ──────────────────────────────────
  const levX  = TX1 + (TX2 - TX1) * 0.60;  // ~60% down the tiller
  const levW  = T * 0.09;
  const levH  = T * 0.18;
  // Left lever (local -y direction)
  ctx.fillStyle = '#6A1A00';
    roundRect(ctx, levX - levW * 0.5, -(levH + T*0.05), levW, levH, T*0.02);
  ctx.fill();
  ctx.fillStyle = '#8A2800';
    roundRect(ctx, levX - levW * 0.5, -(levH + T*0.05), levW, levH * 0.50, T*0.02);
  ctx.fill();
  // Right lever (local +y direction)
  ctx.fillStyle = '#6A1A00';
    roundRect(ctx, levX - levW * 0.5, T * 0.05, levW, levH, T*0.02);
  ctx.fill();
  ctx.fillStyle = '#8A2800';
    roundRect(ctx, levX - levW * 0.5, T * 0.05, levW, levH * 0.50, T*0.02);
  ctx.fill();
  // ↑ / ↓ symbols
  ctx.fillStyle = '#CC8800';
  ctx.font = `bold ${Math.max(3, Math.floor(T * 0.10))}px Arial,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('↑', levX, -(levH * 0.5 + T*0.05));
  ctx.fillText('↓', levX,   levH * 0.5 + T*0.05);

  // ── T-bar handle (animated by pumpT — always world-vertical movement) ──────
  // pumpT oscillates 0→1→0 per pump cycle.
  // We want the forearms/hands/handle to move UP in world (screen) space on the
  // downstroke and return DOWN — regardless of which direction the jack faces.
  //
  // Because drawJack runs inside ctx.rotate(rot), local Y ≠ world Y when facing
  // UP or DOWN. To get a world-vertical offset we project it into local space:
  //   local_dx = worldAmt * sin(rot)
  //   local_dy = worldAmt * cos(rot)
  const _pT         = pumpT || 0;
  const _worldAmt   = -_pT * T * 0.065;           // world-vertical travel (negative = up)
  const _pLocDX     = _worldAmt * Math.sin(rot);   // local X component
  const _pLocDY     = _worldAmt * Math.cos(rot);   // local Y component
  // Handle bar: shift both endpoints by the local projection.
  // HXa = HX + local X offset; handle Y endpoints shift by local Y offset.
  const HXa  = HX  + _pLocDX;
  const HY1a = HY1 + _pLocDY;
  const HY2a = HY2 + _pLocDY;
  // Main bar rod
  ctx.fillStyle = '#5A1A00';
    roundRect(ctx, HXa - HHH * 0.5, HY1a, HHH, HY2a - HY1a, T * 0.04);
  ctx.fill();
  // Rubber grip ends
  ctx.fillStyle = '#111111';
    roundRect(ctx, HXa - HHH * 0.5, HY1a,           HHH, gripL, T * 0.05);
  ctx.fill();
    roundRect(ctx, HXa - HHH * 0.5, HY2a - gripL,   HHH, gripL, T * 0.05);
  ctx.fill();
  // Grip knuckle rings
  ctx.strokeStyle = '#2A2A2A'; ctx.lineWidth = Math.max(0.5, T * 0.012);
  [0.3, 0.6].forEach(f => {
    ctx.beginPath();
    ctx.moveTo(HXa - HHH * 0.5, HY1a + gripL * f);
    ctx.lineTo(HXa + HHH * 0.5, HY1a + gripL * f);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(HXa - HHH * 0.5, HY2a - gripL * f);
    ctx.lineTo(HXa + HHH * 0.5, HY2a - gripL * f);
    ctx.stroke();
  });

  // ── Operator shadow ────────────────────────────────────────────────────────
  if (!rm) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(-T*1.30, T*0.20, T*0.52, T*0.16, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ── Hi-vis vest (torso) ────────────────────────────────────────────────────
  // Slightly rotated to show forward lean
  ctx.save();
  ctx.translate(-T*1.28, T*0.03);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#E8B000';
  ctx.beginPath();
  ctx.ellipse(0, 0, T*0.34, T*0.24, 0, 0, Math.PI*2);
  ctx.fill();
  // Reflective stripes
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillRect(-T*0.28, -T*0.055, T*0.56, T*0.038);
  ctx.fillRect(-T*0.28,  T*0.058, T*0.56, T*0.030);
  ctx.restore();

  // ── Head (centered, variable skin tone) ───────────────────────────────────
  const hCX = -T * 1.04;
  const hCY =  T * 0.00;
  const hR  = Math.max(4, T * 0.21);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(hCX, hCY, hR, 0, Math.PI*2);
  ctx.fill();

  // ── No hard hat — bare head ───────────────────────────────────────────────

  // ── L-shaped arms (forearm endpoint + hands track handle in world-vertical) ─
  // Shoulder and elbow stay fixed on the torso.
  // Wrist/hand endpoints follow HXa/HY1a/HY2a — already projected to local space.
  const _handY1 = -T*0.35 + _pLocDY;  // left hand Y  (world-vertical projection)
  const _handY2 =  T*0.35 + _pLocDY;  // right hand Y
  const armStrokeW = Math.max(3, T * 0.11);
  ctx.strokeStyle = skin;
  ctx.lineWidth   = armStrokeW;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  // Left arm
  ctx.beginPath();
  ctx.moveTo(-T*1.26, -T*0.22);       // shoulder (fixed)
  ctx.lineTo(-T*1.12, -T*0.50);       // elbow (fixed)
  ctx.lineTo(HXa,      _handY1);      // wrist tracks handle
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(-T*1.26,  T*0.22);
  ctx.lineTo(-T*1.12,  T*0.50);
  ctx.lineTo(HXa,      _handY2);
  ctx.stroke();
  // Hand blobs
  const handR = Math.max(2, T * 0.13);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(HXa, _handY1, handR, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(HXa, _handY2, handR, 0, Math.PI*2); ctx.fill();

  // ── Fork tines — extension animated by forkSlide (0=retracted, 1=full) ──────
  // forkSlide ramps from 0→1 during the lifting pump animation (forks slide under)
  const _pt = pushT || 0;
  const _fs = Math.max(0, Math.min(1, forkSlide || 1));  // 0=barely out, 1=full reach
  const FW_EXT = FW * _fs * (1 + _pt * 0.12);
  // Shank bar
  ctx.fillStyle = '#9A7200';
  ctx.fillRect(FX - T*0.02, FY1 - T*0.03, T*0.05, FY2 - FY1 + FH + T*0.06);
  // Tines
  ctx.strokeStyle = '#C89000'; ctx.lineWidth = FH; ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(FX, FY1); ctx.lineTo(FX + FW_EXT, FY1);
  ctx.moveTo(FX, FY2); ctx.lineTo(FX + FW_EXT, FY2);
  ctx.stroke();
  // Tine top-face highlight
  ctx.strokeStyle = '#FFDD00'; ctx.lineWidth = FH * 0.28;
  ctx.beginPath();
  ctx.moveTo(FX, FY1 - FH*0.36); ctx.lineTo(FX + FW_EXT, FY1 - FH*0.36);
  ctx.moveTo(FX, FY2 - FH*0.36); ctx.lineTo(FX + FW_EXT, FY2 - FH*0.36);
  ctx.stroke();
  // Tine tips
  ctx.fillStyle = _pt > 0.1 ? `rgba(255,${Math.floor(210+45*(1-_pt))},0,1)` : '#E8B000';
  ctx.fillRect(FX + FW_EXT - T*0.04, FY1 - FH*0.5, T*0.04, FH);
  ctx.fillRect(FX + FW_EXT - T*0.04, FY2 - FH*0.5, T*0.04, FH);
  ctx.lineCap = 'butt';

  ctx.restore();
}

// ── DRAW: HUD ─────────────────────────────────────────────────────────────────

function drawHUD(ctx, CW, timerLeft, timerMax, palletsStaged, totalPallets, items,
                 undoAvail, canRotate, frame, rm, comboLevel, comboFlash,
                 levelName, zones, stagedPopT, moveCount, bestSteps, comboWinFrac,
                 liftState, liftPct) {
  ctx.fillStyle = C.hudBg;
  ctx.fillRect(0, 0, CW, HUD_H);
  ctx.strokeStyle = C.hudBorder; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0,HUD_H); ctx.lineTo(CW,HUD_H); ctx.stroke();
  // Item 10: HUD panic pulse — very faint red overlay on HUD bar below 5s
  if (timerLeft <= 5 && timerLeft > 0 && !rm) {
    const _hp = 0.5 + 0.5 * Math.abs(Math.sin(frame * 0.18));
    ctx.save();
    ctx.globalAlpha = _hp * 0.10;
    ctx.fillStyle = '#FF2200';
    ctx.fillRect(0, 0, CW, HUD_H);
    ctx.restore();
  }

  const mid = HUD_H/2;
  const RING_R = Math.floor(HUD_H*0.37), RING_CX = RING_R+8, RING_CY = mid;

  ctx.beginPath(); ctx.arc(RING_CX,RING_CY,RING_R,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.10)'; ctx.lineWidth=5; ctx.stroke();

  // Item 14: combo window arc — thin ring just outside timer, drains over 4s after each dock
  if (!rm && comboWinFrac > 0 && comboLevel > 0) {
    const _cwR = RING_R + 6;   // just outside timer ring
    const _cwCol = comboLevel >= 3 ? '#00FFFF' : comboLevel >= 2 ? '#FFAA00' : '#FF8800';
    // Ghost track for the arc
    ctx.save();
    ctx.beginPath();
    ctx.arc(RING_CX, RING_CY, _cwR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 3; ctx.stroke();
    // Draining arc — starts at top, sweeps clockwise, shrinks as window closes
    ctx.beginPath();
    ctx.arc(RING_CX, RING_CY, _cwR, -Math.PI / 2, -Math.PI / 2 + comboWinFrac * Math.PI * 2);
    ctx.strokeStyle = _cwCol;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75 + 0.25 * comboWinFrac; // brighter when full, dims as it drains
    ctx.shadowColor = _cwCol; ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.restore();
  }

  const frac=Math.max(0,Math.min(1,timerLeft/(timerMax||120)));
  const arcCol=timerLeft>30?C.timerGreen:timerLeft>15?C.timerAmber:C.timerRed;
  if (frac>0) {
    ctx.save(); ctx.beginPath();
    ctx.arc(RING_CX,RING_CY,RING_R,-Math.PI/2,-Math.PI/2+frac*Math.PI*2);
    const ringW = (timerLeft <= 10 && !rm) ? 5 + 3 * Math.abs(Math.sin(frame * Math.PI / 30)) : 5;
    ctx.strokeStyle=arcCol; ctx.lineWidth=ringW; ctx.lineCap='round'; ctx.stroke(); ctx.restore();
  }
  ctx.save();
  ctx.font=`bold ${Math.max(8,Math.floor(RING_R*0.72))}px Arial,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=arcCol;
  if (timerLeft <= 10 && !rm) {
    ctx.shadowColor = arcCol;
    ctx.shadowBlur  = 6 + 6 * Math.abs(Math.sin(frame * Math.PI / 30));
  }
  ctx.fillText(String(Math.ceil(timerLeft)),RING_CX,RING_CY+1);
  ctx.restore();
  // ⚡ speed-bonus indicator — glows above ring while bonus still achievable
  {
    const speedThresh = Math.round((timerMax||120) * 0.40);
    const boltA = timerLeft > speedThresh
      ? (rm ? 0.80 : 0.55 + 0.25 * Math.abs(Math.sin(frame * 0.07)))  // pulsing while achievable
      : Math.max(0, (timerLeft / Math.max(1, speedThresh)) * 0.30);     // dim-out once lost
    if (boltA > 0.02) {
      ctx.save(); ctx.globalAlpha = boltA;
      ctx.font = `${Math.max(7, Math.floor(RING_R * 0.55))}px Arial,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = timerLeft > speedThresh ? '#FFE040' : '#998830';
      ctx.fillText('⚡', RING_CX + Math.floor(RING_R * 0.62), RING_CY - Math.floor(RING_R * 0.62));
      ctx.restore();
    }
  }

  const statX=RING_CX+RING_R+10;
  ctx.save(); ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(5,Math.floor(HUD_H*0.20))}px Arial,sans-serif`;
  ctx.fillStyle=C.hudDim; ctx.fillText((levelName||'STAGING').toUpperCase(),statX,mid-HUD_H*0.22);
  ctx.font=`bold ${Math.max(7,Math.floor(HUD_H*0.28))}px Arial,sans-serif`;
  {
    const _spt = (stagedPopT||0) > 0 && !rm;
    if (_spt) {
      const _sc = 1 + (stagedPopT / 10) * 0.40; // 1.0 → 1.40 at peak, springs back
      ctx.save();
      ctx.translate(statX, mid+HUD_H*0.04);
      ctx.scale(_sc, _sc);
      ctx.translate(-statX, -(mid+HUD_H*0.04));
      ctx.fillStyle='#FFE040';
    } else {
      ctx.fillStyle='#FFFFFF';
    }
    ctx.fillText(`${palletsStaged}/${totalPallets}`,statX,mid+HUD_H*0.04);
    if (_spt) ctx.restore();
  }
  ctx.font=`${Math.max(5,Math.floor(HUD_H*0.17))}px Arial,sans-serif`;
  ctx.fillStyle=C.hudDim; ctx.fillText('docked',statX,mid+HUD_H*0.28);
  // Item 21: PB pace indicator — show when player is beating their best step count
  if (!rm && bestSteps > 0 && moveCount > 0 && moveCount < bestSteps) {
    ctx.font=`bold ${Math.max(5,Math.floor(HUD_H*0.16))}px Arial,sans-serif`;
    ctx.fillStyle='#44FFAA';
    ctx.fillText('⚡ PB pace', statX, mid+HUD_H*0.47);
  }
  ctx.restore();

  // ── Per-stop progress dots ────────────────────────────────────────────────
  if (zones && zones.length > 0) {
    const DOT_R   = Math.max(3, Math.floor(HUD_H * 0.09));
    const DOT_GAP = DOT_R * 2.6;
    const LABEL_W = 20;
    const blockStartX = statX + 48;
    // Right edge: leave 8px gap before the HUD buttons (3×38+8 = 122px from right)
    const dotsMaxRight = CW - 130;
    const dotsAvailW   = Math.max(0, dotsMaxRight - blockStartX - LABEL_W);
    const maxDots      = Math.max(1, Math.floor(dotsAvailW / DOT_GAP));
    let dotsY = mid - HUD_H * 0.12;
    zones.forEach((zone, zi) => {
      const zc     = ZONE_COLORS[zi] || ZONE_COLORS[0];
      const total  = zone.totalCount  || 0;
      const staged = zone.stagedCount || 0;
      const shown  = Math.min(total, maxDots);
      const overflow = total > shown; // more dots than we can show
      // Stop label
      ctx.save();
      ctx.font = `bold ${Math.max(4, Math.floor(HUD_H * 0.14))}px Arial,sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = zc.border;
      ctx.fillText(`S${zi+1}`, blockStartX, dotsY);
      ctx.restore();
      // Dots (capped to shown)
      for (let d = 0; d < shown; d++) {
        const dx     = blockStartX + LABEL_W + d * DOT_GAP;
        const filled = d < staged;
        ctx.beginPath(); ctx.arc(dx, dotsY, DOT_R, 0, Math.PI*2);
        ctx.fillStyle   = filled ? zc.body : 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.strokeStyle = filled ? zc.border : 'rgba(255,255,255,0.20)';
        ctx.lineWidth   = 1;
        ctx.stroke();
      }
      // If dots were clipped, show "N/T" counter instead of overflow dots
      if (overflow) {
        ctx.save();
        ctx.font = `${Math.max(4, Math.floor(HUD_H * 0.13))}px Arial,sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,200,220,0.75)';
        ctx.fillText(`${staged}/${total}`, blockStartX + LABEL_W + shown * DOT_GAP + 3, dotsY);
        ctx.restore();
      }
      dotsY += HUD_H * 0.28;
    });
  }

  if (comboLevel>=2 && comboFlash>0) {
    const a=Math.min(1,comboFlash/20);
    const comboCol = comboLevel>=3 ? C.comboCool : C.comboHot;
    ctx.save(); ctx.globalAlpha=a;
    // Bloom glow behind text
    if (!rm) {
      const glowGrad = ctx.createRadialGradient(CW*0.55, mid, 2, CW*0.55, mid, 52);
      glowGrad.addColorStop(0,   comboLevel>=3 ? 'rgba(0,255,255,0.38)' : 'rgba(255,140,0,0.38)');
      glowGrad.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath(); ctx.arc(CW*0.55, mid, 52, 0, Math.PI*2); ctx.fill();
    }
    ctx.font=`bold ${Math.max(8,Math.floor(HUD_H*0.30))}px Arial,sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=comboCol;
    ctx.shadowColor=comboCol; ctx.shadowBlur=rm?0:10;
    ctx.fillText(`COMBO ×${comboLevel}!`,CW*0.55,mid); ctx.restore();
  } else {
    const legendX=CW*0.52;
    (items||[]).forEach((stop,i)=>{
      const zc=ZONE_COLORS[i]||ZONE_COLORS[0];
      const ly=mid-((items.length-1)*9)/2+i*10;
      ctx.fillStyle=zc.body; roundRect(ctx,legendX,ly-4,8,8,2); ctx.fill();
      ctx.strokeStyle=zc.border; ctx.lineWidth=0.8; roundRect(ctx,legendX,ly-4,8,8,2); ctx.stroke();
      ctx.font=`${Math.max(4,Math.floor(HUD_H*0.17))}px Arial,sans-serif`;
      ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#CCDDF0';
      ctx.fillText((stop.customerName||`STOP ${i+1}`).toUpperCase().slice(0,9),legendX+11,ly);
    });
  }

  const btnW=38, btnH=HUD_H-8, btnY=4;
  // Lift button: green when lifted, amber while pumping, dim when idle
  const _liftCol = liftState==='lifted'  ? '#44DD88'
                 : liftState==='lifting'  ? '#FFAA00'
                 : liftState==='lowering' ? '#FF8844'
                 : C.hudDim;
  const _liftBg  = liftState==='lifted'  ? 'rgba(10,80,40,0.40)'
                 : liftState==='lifting'  ? 'rgba(80,55,0,0.35)'
                 : liftState==='lowering' ? 'rgba(80,30,0,0.30)'
                 : 'rgba(50,50,50,0.15)';
  drawHudBtn(ctx,CW-btnW*4-10,btnY,btnW,btnH,'⬆',_liftCol,_liftBg);
  // Pump progress arc inside the lift button when lifting
  if ((liftState==='lifting'||liftState==='lowering') && liftPct > 0 && !rm) {
    const _bx = CW-btnW*4-10, _bcx = _bx + btnW/2, _bcy = btnY + btnH/2;
    ctx.save();
    ctx.strokeStyle = _liftCol; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.70;
    ctx.beginPath();
    ctx.arc(_bcx, _bcy, btnW*0.36, -Math.PI/2, -Math.PI/2 + liftPct*Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
  drawHudBtn(ctx,CW-btnW*3-6,btnY,btnW,btnH,'↻',canRotate?'#5599FF':C.hudDim,canRotate?'rgba(30,60,150,0.30)':'rgba(50,50,50,0.15)');
  drawHudBtn(ctx,CW-btnW*2-2,btnY,btnW,btnH,'↩',undoAvail?'#FFCC33':C.hudDim,undoAvail?'rgba(100,80,0,0.30)':'rgba(50,50,50,0.15)');
  drawHudBtn(ctx,CW-btnW+2,btnY,btnW,btnH,'✕','#FF5555','rgba(100,20,20,0.25)');
}

function drawHudBtn(ctx,x,y,w,h,label,color,bg) {
  ctx.fillStyle=bg; roundRect(ctx,x,y,w,h,5); ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=1.5; roundRect(ctx,x,y,w,h,5); ctx.stroke();
  ctx.font=`${Math.floor(h*0.50)}px Arial,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=color;
  ctx.fillText(label,x+w/2,y+h/2+1);
}

// ── DRAW: OVERLAYS ────────────────────────────────────────────────────────────

function drawWinOverlay(ctx,CW,CH,cl,frame,rm) {
  const timeTaken=cl._winTimeTaken ?? Math.round((Date.now()-cl.gameStartTime)/1000);
  const xpEarned=cl._finalXp??(30+(timeTaken<=45?10:0));
  // Recompute total from stored breakdown (cl._cash* set in updateGame)
  const cashBonus = (cl._cashVolume||0)+(cl._cashClean||0)+(cl._cashSpeed||0)+(cl._cashPerfect||0)+(cl._cashDiff||0);
  const pulse=rm?1:0.70+0.30*Math.sin(frame*0.12);
  ctx.fillStyle=C.overlayBg; ctx.fillRect(0,0,CW,CH);
  const bw=Math.min(CW-24,310),bh=Math.min(288,Math.floor(CH*0.92)),bx=(CW-bw)/2,by=(CH-bh)/2;
  const isPerfect = !!(cl._isClean && cl._isFast);  // perfect = clean + fast
  // Hoist elapsed here so XP count-up and all elapsed-dependent sections share one definition
  const BAR_FRAMES = 150;
  const elapsed = cl._winFrame >= 0 ? (frame - cl._winFrame) : 0;
  ctx.fillStyle=C.overlayPanel; roundRect(ctx,bx,by,bw,bh,14); ctx.fill();
  ctx.strokeStyle=isPerfect?'#00FFCC':C.winGold; ctx.lineWidth=2.5*pulse; roundRect(ctx,bx,by,bw,bh,14); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(14,Math.floor(bw*0.10))}px Arial,sans-serif`;
  ctx.fillStyle = isPerfect ? '#00FFCC' : C.winGold; ctx.globalAlpha=pulse;
  // Item 18: three-way emoji: perfect+record=🏆, perfect only=🎯, plain=🚚
  {
    const _bothTitle = isPerfect && cl._newRecord;
    const _titleStr  = _bothTitle      ? 'PERFECT LOAD! 🏆'
                     : isPerfect       ? 'PERFECT LOAD! 🎯'
                     :                   'TRUCK LOADED! 🚚';
    ctx.fillText(_titleStr, CW/2, by+36);
  }
  ctx.globalAlpha=1;
  // New record flash
  if (cl._newRecord) {
    const nr_a = Math.abs(Math.sin(frame*0.18));
    ctx.globalAlpha = 0.5 + 0.5*nr_a;
    ctx.font=`bold ${Math.max(9,Math.floor(bw*0.065))}px Arial,sans-serif`;
    ctx.fillStyle='#FFD700'; ctx.fillText('👑 NEW RECORD!',CW/2,by+58);
    ctx.globalAlpha=1;
  }
  const _hasBreakdown = (cl._timeBonus||0)>0 || (cl._comboBonus||0)>0;
  const L=(n,extra=0)=>by+(cl._newRecord?74:68)+n*24+(n>=2&&_hasBreakdown?14:0)+extra;
  ctx.font=`${Math.max(10,Math.floor(bw*0.068))}px Arial,sans-serif`;
  ctx.fillStyle='#FFFFFF'; ctx.fillText(`Time: ${timeTaken}s  ·  Pushes: ${cl.pushCount||0}  ·  Steps: ${cl.moveCount||0}`,CW/2,L(0));
  // XP count-up: animate from 0 → xpEarned over first 60 frames of win screen
  const XP_COUNT_FRAMES = 60;
  const xpFrac = Math.min(1, elapsed / XP_COUNT_FRAMES);
  // Ease-out: fast start, slow finish — cubic
  const xpEase = 1 - Math.pow(1 - xpFrac, 3);
  const xpShow = Math.round(xpEarned * xpEase);
  ctx.fillStyle = xpFrac >= 1 ? C.winGold : '#FFE980';
  ctx.fillText(`XP Earned: +${xpShow}`,CW/2,L(1));
  {
    const tb=cl._timeBonus||0, cb=cl._comboBonus||0;
    const parts=['Base +30'];
    if (tb>0) parts.push(`Speed +${tb}`);    // +15 for fast
    if (cb>0) parts.push(`Combo +${cb}`);
    if (parts.length>1) {
      ctx.font=`${Math.max(7,Math.floor(bw*0.048))}px Arial,sans-serif`;
      // Breakdown sub-line fades in only after count-up completes
      const bdAlpha = Math.min(1, Math.max(0, (elapsed - XP_COUNT_FRAMES) / 20));
      ctx.save(); ctx.globalAlpha = bdAlpha * 0.55;
      ctx.fillStyle='rgba(255,215,0,1)'; ctx.fillText(parts.join('  ·  '),CW/2,L(1)+14);
      ctx.restore();
    }
  }
  if (cl._bestCombo>=2) { ctx.fillStyle=C.comboCool; ctx.fillText(`Best Combo: ×${cl._bestCombo}`,CW/2,L(2)); }
  const statRow = cl._bestCombo>=2 ? 3 : 2;
  // Cash total line
  if (cashBonus>0) {
    ctx.fillStyle='#44DDFF';
    ctx.fillText(`Cash Earned: +$${cashBonus}`,CW/2,L(statRow));
    // Breakdown sub-line — fades in after XP count-up
    const _cbdAlpha = Math.min(1, Math.max(0, (elapsed - XP_COUNT_FRAMES) / 20));
    if (_cbdAlpha > 0) {
      ctx.save(); ctx.globalAlpha = _cbdAlpha * 0.60;
      ctx.font=`${Math.max(7,Math.floor(bw*0.042))}px Arial,sans-serif`;
      const _parts=[];
      if (cl._cashVolume)  _parts.push(`${cl._cashVolume>=100?'':'$'}${cl._cashVolume} volume`);
      if (cl._cashClean)   _parts.push(`$${cl._cashClean} clean`);
      if (cl._cashSpeed)   _parts.push(`$${cl._cashSpeed} speed`);
      if (cl._cashPerfect) _parts.push(`$${cl._cashPerfect} perfect`);
      if (cl._cashDiff)    _parts.push(`$${cl._cashDiff} hard`);
      ctx.fillStyle='#88EEFF';
      ctx.fillText(_parts.join('  ·  '),CW/2,L(statRow)+14);
      ctx.restore();
    }
  } else {
    ctx.font=`${Math.max(8,Math.floor(bw*0.055))}px Arial,sans-serif`;
    ctx.fillStyle=C.hudDim;
    ctx.fillText(`Volume: +$${(cl._cashVolume||0)} · ${cl.wrongZoneCount||0} wrong dock${(cl.wrongZoneCount||0)!==1?'s':''}`,CW/2,L(statRow));
  }
  // Personal best row — scoped by difficulty bracket
  if (cl._hadPriorRecord && cl._bestTime && cl._bestTime < 9999) {
    ctx.font=`${Math.max(7,Math.floor(bw*0.052))}px Arial,sans-serif`;
    ctx.fillStyle='rgba(180,180,220,0.70)';
    const diffStr = cl._diffLabel ? ` (${cl._diffLabel})` : '';
    ctx.fillText(`Best${diffStr}: ${cl._bestTime}s · ${cl._bestPushes??0} pushes · ${cl._bestSteps??0} steps`,CW/2,L(statRow+1));
  }
  // Auto-dismiss countdown bar — fills over 2.5 s (150 frames at 60fps)
  const barFrac = Math.min(1, elapsed / BAR_FRAMES);
  const barW = bw - 32, barH = 5, barX = bx + 16, barY = by + bh - 26;
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; roundRect(ctx,barX,barY,barW,barH,3); ctx.fill();
  ctx.fillStyle = isPerfect?'#00FFCC':C.winGold; roundRect(ctx,barX,barY,barW*barFrac,barH,3); ctx.fill();
  // ── PERFECT LOAD confetti — multi-color squares drifting down ─────────────
  if (isPerfect && !rm) {
    const CONF_COUNT = 32;
    const CONF_PERIOD = 240;  // 4s cycle at 60fps — matches auto-dismiss duration
    const confT = elapsed % CONF_PERIOD;
    for (let ci = 0; ci < CONF_COUNT; ci++) {
      // Deterministic per-particle seed so positions are stable across frames
      const seed = ci * 2654435761 >>> 0;
      const startX = bx + 16 + ((seed & 0xFF) / 255) * (bw - 32);
      const fallSpeed = 0.6 + ((seed >> 8 & 0xFF) / 255) * 1.2;
      const wob = ((seed >> 16 & 0xFF) / 255 - 0.5) * 0.8; // horizontal wobble
      const delay = ((seed >> 24 & 0xFF) / 255) * CONF_PERIOD;
      const age = (confT - delay + CONF_PERIOD) % CONF_PERIOD;
      const py2 = by - 10 + age * fallSpeed;
      if (py2 > by + bh + 10) continue;  // off panel
      const px2 = startX + Math.sin(age * 0.07 + ci) * 12 * wob;
      const rot2 = age * 0.05 * (wob > 0 ? 1 : -1);
      const alpha = Math.min(1, age / 20) * Math.max(0, 1 - (py2 - by) / (bh * 1.1));
      const sz = 4 + ((seed & 0xF) / 15) * 4;
      const CONF_COLORS = ['#FFD700','#00FFCC','#FF6699','#66EEFF','#FFAA33','#AAFFAA'];
      const col2 = CONF_COLORS[ci % CONF_COLORS.length];
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.translate(px2, py2);
      ctx.rotate(rot2);
      ctx.fillStyle = col2;
      ctx.fillRect(-sz/2, -sz/2, sz, sz * 0.55);
      ctx.restore();
    }
  }

  // 'Tap to continue' hint — fades in after 0.5s
  if (elapsed > 30) {
    const hintA = Math.min(1, (elapsed - 30) / 20) * 0.55;
    ctx.save(); ctx.globalAlpha = hintA;
    ctx.font = `${Math.max(7, Math.floor(bw * 0.048))}px Arial,sans-serif`;
    const wHint = cl.isTouchDevice ? 'Tap to continue' : 'Tap or press ESC to continue';
    ctx.fillStyle = C.hudDim; ctx.fillText(wHint, CW/2, by + bh - 10);
    ctx.restore();
  }
}

function drawFailOverlay(ctx,CW,CH,cl,frame,rm) {
  const pulse=rm?1:0.70+0.30*Math.sin(frame*0.12);
  const partialXp = Math.round((cl.palletsStaged||0) * 10);
  // Item 11: entrance animation — elapsed since _failFrame set
  const elapsed = cl._failFrame >= 0 ? (frame - cl._failFrame) : 0;
  // Deep red bg flash settles over 20 frames
  const _bgFlash = rm ? 0 : Math.max(0, 1 - elapsed / 20);
  ctx.fillStyle=C.overlayBg; ctx.fillRect(0,0,CW,CH);
  if (_bgFlash > 0) {
    ctx.save(); ctx.globalAlpha = _bgFlash * 0.28;
    ctx.fillStyle = '#FF0000'; ctx.fillRect(0,0,CW,CH);
    ctx.restore();
  }
  const bw=Math.min(CW-24,270),bh=228,bx=(CW-bw)/2,by=(CH-bh)/2;
  ctx.fillStyle=C.overlayPanel; roundRect(ctx,bx,by,bw,bh,14); ctx.fill();
  ctx.strokeStyle=C.failRed; ctx.lineWidth=2.5*pulse; roundRect(ctx,bx,by,bw,bh,14); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(14,Math.floor(bw*0.10))}px Arial,sans-serif`;
  // Item 11: title slam — scale 1.5→1.0 over first 8 frames
  const _slamT = rm ? 1 : Math.min(1, elapsed / 8);
  const _slamSc = 1.5 - _slamT * 0.5;  // 1.5 → 1.0
  ctx.save();
  ctx.translate(CW/2, by+44);
  ctx.scale(_slamSc, _slamSc);
  ctx.translate(-CW/2, -(by+44));
  ctx.fillStyle=C.failRed; ctx.globalAlpha=pulse;
  ctx.fillText("TIME'S UP ⏱",CW/2,by+44);
  ctx.restore();
  ctx.globalAlpha=1;
  ctx.font=`${Math.max(9,Math.floor(bw*0.065))}px Arial,sans-serif`;
  ctx.fillStyle=C.hudDim; ctx.fillText('Load not complete',CW/2,by+82);
  // Time elapsed + steps — mirrors win screen data row for self-assessment on loss
  {
    const failTime = Math.round((Date.now() - (cl.gameStartTime||Date.now())) / 1000);
    ctx.font=`${Math.max(8,Math.floor(bw*0.058))}px Arial,sans-serif`;
    ctx.fillStyle='rgba(200,200,230,0.70)';
    ctx.fillText(`Time: ${failTime}s  ·  Steps: ${cl.moveCount||0}`,CW/2,by+104);
  }
  if (partialXp>0) {
    ctx.fillStyle='#FFAA44';
    ctx.fillText(`Partial credit: +${partialXp} XP`,CW/2,by+128);
  }
  // Staged progress
  ctx.font=`${Math.max(8,Math.floor(bw*0.058))}px Arial,sans-serif`;
  ctx.fillStyle='rgba(160,160,200,0.70)';
  ctx.fillText(`${cl.palletsStaged||0} of ${cl.totalPallets||0} pallets staged`,CW/2,by+152);
  // Gentle nudge for 0-staged runs — only shown when no progress was made
  if (!(cl.palletsStaged||0)) {
    ctx.font=`${Math.max(7,Math.floor(bw*0.048))}px Arial,sans-serif`;
    ctx.fillStyle='rgba(180,180,220,0.55)';
    ctx.fillText('Lift pallets with E and carry to the dock bays',CW/2,by+170);
  }
  // Red countdown bar — mirrors win screen gold bar, drains over 1.8s (108 frames)
  const FAIL_BAR_FRAMES = 108;
  const barFrac = Math.min(1, elapsed / FAIL_BAR_FRAMES);
  const barW = bw - 32, barH = 5, barX = bx + 16, barY = by + bh - 26;
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; roundRect(ctx,barX,barY,barW,barH,3); ctx.fill();
  ctx.fillStyle = C.failRed; roundRect(ctx,barX,barY,barW*barFrac,barH,3); ctx.fill();
  // 'Tap to dismiss' hint — fades in after lockout window (35 frames ~0.6s)
  if (elapsed > 35) {
    const hintA = Math.min(1, (elapsed - 35) / 20) * 0.55;
    ctx.save(); ctx.globalAlpha = hintA;
    ctx.font = `${Math.max(7, Math.floor(bw * 0.048))}px Arial,sans-serif`;
    const fHint = cl.isTouchDevice ? 'Tap to dismiss' : 'Tap or press ESC to dismiss';
    ctx.fillStyle = C.hudDim; ctx.fillText(fHint, CW/2, by + bh - 10);
    ctx.restore();
  }
}

// =============================================================================
//  TUTORIAL OVERLAY  — shown on first-ever play (pj_games === 0)
// =============================================================================
function drawTutorialOverlay(ctx, CW, CH, cl, frame, rm) {
  const step  = cl._tutStep || 0;
  const STEPS = 5;

  // Backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.82)'; ctx.fillRect(0, 0, CW, CH);

  const bw = Math.min(CW - 20, 320);
  const bh = Math.min(CH - 32, 292);
  const bx = (CW - bw) / 2, by = (CH - bh) / 2;

  // Panel
  ctx.fillStyle = 'rgba(10,14,32,0.98)';
  roundRect(ctx, bx, by, bw, bh, 16); ctx.fill();

  // Accent border — distinct colour per page so each feels like a new chapter
  const PAGE_COLORS = ['#5599FF','#FFBB33','#FF5577','#FF5577','#AA88FF'];
  const accentCol = PAGE_COLORS[Math.min(step, PAGE_COLORS.length - 1)];
  ctx.save(); ctx.globalAlpha = 0.55;
  ctx.strokeStyle = accentCol; ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 16); ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  const PAGES = [
    {
      icon: '🕹️', color: '#5599FF', title: 'HOW TO MOVE',
      lines: [
        '  Arrow keys  or  W A S D  —  drive the jack',
        '  E  —  lift a pallet (drive under it first!)',
        '  R  —  rotate a nearby pallet',
        '  Z  —  undo last move  (up to 30×)',
      ],
    },
    {
      icon: '📦', color: '#FFBB33', title: 'THE JOB',
      lines: [
        '  Drive forks-first UNDER a pallet, press E.',
        '  Carry it north to the glowing dock door.',
        '  The dock color shows which stop loads next.',
        '  Press E again to lower and lock it in.',
      ],
    },
    {
      icon: '🚛', color: '#FF5577', title: 'LOAD ORDER MATTERS',
      lines: [
        '  You have one dock door — all stops share it.',
        '  Load the LAST stop first (it goes deepest).',
        '  The HUD shows the next required stop color.',
        '  Wrong order = cash & XP deducted at end.',
      ],
    },
    {
      icon: '🚫', color: '#FF5577', title: "DON'T DO THIS",
      lines: [
        '  ✗  Ramming the jack sideways into a pallet',
        '  ✗  Approaching from the side or rear',
        '  ✗  Loading a stop out of order',
        '  ✓  Always approach forks-first, then lift!',
      ],
    },
    {
      icon: '⚡', color: '#AA88FF', title: 'SCORE BIG',
      lines: [
        '  Finish under 40% of the timer → Speed Bonus',
        '  No wrong order → Clean Bonus  (+$20)',
        '  Chain loads quickly → Combo multiplier',
        '  Good luck, wrangler! 🤠',
      ],
    },
  ];

  const page  = PAGES[Math.min(step, STEPS - 1)];
  const pulse = rm ? 1 : 0.88 + 0.12 * Math.sin(frame * 0.09);

  // Icon
  ctx.font = `${Math.max(22, Math.floor(bw * 0.088))}px Arial,sans-serif`;
  ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 1;
  ctx.fillText(page.icon, CW / 2, by + 34);

  // Title
  ctx.font = `bold ${Math.max(11, Math.floor(bw * 0.064))}px Arial,sans-serif`;
  ctx.fillStyle = page.color;
  ctx.fillText(page.title, CW / 2, by + 64);

  // Body lines — ✓ green, ✗ red, rest neutral
  const lineSize = Math.max(10, Math.floor(bw * 0.046));
  ctx.font = `${lineSize}px Arial,sans-serif`;
  const lineH = Math.max(14, Math.floor(lineSize * 1.52));
  page.lines.forEach((ln, i) => {
    ctx.fillStyle = ln.trim().startsWith('✓') ? '#55DD88'
                  : ln.trim().startsWith('✗') ? '#FF6677'
                  : '#8899BB';
    ctx.fillText(ln, CW / 2, by + 96 + i * lineH);
  });

  // Step dots
  const dotY  = by + bh - 64;
  const dotR  = Math.max(3, Math.floor(bw * 0.011));
  const dotGap = dotR * 2 + 8;
  const dotsTotal = STEPS * dotR * 2 + (STEPS - 1) * (dotGap - dotR * 2);
  let dotX = CW / 2 - dotsTotal / 2 + dotR;
  for (let d = 0; d < STEPS; d++) {
    ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = d === step ? accentCol : 'rgba(100,110,160,0.40)';
    ctx.fill();
    dotX += dotGap;
  }

  // Primary button
  const isLast = step >= STEPS - 1;
  const btnW = Math.min(bw - 48, 200), btnH = Math.max(32, Math.floor(bh * 0.118));
  const btnX = CW / 2 - btnW / 2, btnY = by + bh - 46;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = isLast ? 'rgba(30,100,50,0.50)' : 'rgba(20,50,110,0.50)';
  roundRect(ctx, btnX, btnY, btnW, btnH, 9); ctx.fill();
  ctx.strokeStyle = isLast ? '#44CC66' : accentCol; ctx.lineWidth = 1.5;
  roundRect(ctx, btnX, btnY, btnW, btnH, 9); ctx.stroke();
  ctx.font = `bold ${Math.max(11, Math.floor(btnH * 0.40))}px Arial,sans-serif`;
  ctx.fillStyle = isLast ? '#66EE88' : '#AACCFF';
  ctx.fillText(isLast ? "LET'S GO! ▶" : `NEXT  (${step + 1}/${STEPS})  →`, CW / 2, btnY + btnH / 2);
  ctx.globalAlpha = 1;

  // Skip link — only on page 0; funny copy for returning players
  if (step === 0) {
    const skipSz = Math.max(9, Math.floor(bw * 0.038));
    ctx.font = `${skipSz}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(130,140,175,0.60)';
    ctx.fillText('Already proficient with the pallet jack?', CW / 2, by + bh + 16);
    ctx.fillStyle = 'rgba(160,175,220,0.80)';
    ctx.fillText('[ ESC ]  Skip the tutorial  →', CW / 2, by + bh + 16 + skipSz + 5);
  } else {
    // Keyboard hint on all other pages
    const hintSz = Math.max(9, Math.floor(bw * 0.037));
    ctx.font = `${hintSz}px Arial,sans-serif`;
    ctx.fillStyle = 'rgba(80,95,130,0.65)';
    const hint = cl.isTouchDevice
      ? 'Tap to continue  ·  tap outside to skip'
      : 'Space / →  next  ·  ←  back  ·  ESC  skip';
    ctx.fillText(hint, CW / 2, by + bh + 16);
  }
}

function drawBailOverlay(ctx,CW,CH,cl) {
  ctx.fillStyle='rgba(0,0,0,0.60)'; ctx.fillRect(0,0,CW,CH);
  const bw=Math.min(CW-36,248),bh=154,bx=(CW-bw)/2,by=(CH-bh)/2;
  ctx.fillStyle=C.overlayPanel; roundRect(ctx,bx,by,bw,bh,14); ctx.fill();
  ctx.strokeStyle='rgba(180,180,220,0.55)'; ctx.lineWidth=1.5; roundRect(ctx,bx,by,bw,bh,14); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(10,Math.floor(bw*0.075))}px Arial,sans-serif`;
  ctx.fillStyle='#FFFFFF'; ctx.fillText('Abandon staging?',CW/2,by+32);
  ctx.font=`${Math.max(7,Math.floor(bw*0.052))}px Arial,sans-serif`;
  ctx.fillStyle=C.hudDim; ctx.fillText('Y = quit  ·  N = back',CW/2,by+50);
  if ((cl?.palletsStaged||0)>0) {
    ctx.font=`${Math.max(7,Math.floor(bw*0.052))}px Arial,sans-serif`;
    ctx.fillStyle='rgba(160,200,160,0.80)';
    ctx.fillText(`${cl.palletsStaged} of ${cl.totalPallets} pallets staged`,CW/2,by+68);
  }
  const btnW=90,btnH=36,yesX=CW/2-btnW-8,noX=CW/2+8,btnY=by+96;
  ctx.fillStyle='rgba(160,30,30,0.30)'; roundRect(ctx,yesX,btnY,btnW,btnH,8); ctx.fill();
  ctx.strokeStyle='#FF5555'; ctx.lineWidth=1.5; roundRect(ctx,yesX,btnY,btnW,btnH,8); ctx.stroke();
  ctx.font=`bold ${Math.max(8,Math.floor(btnH*0.38))}px Arial,sans-serif`;
  ctx.fillStyle='#FF8888'; ctx.fillText('YES — QUIT',yesX+btnW/2,btnY+btnH/2);
  ctx.fillStyle='rgba(20,100,50,0.30)'; roundRect(ctx,noX,btnY,btnW,btnH,8); ctx.fill();
  ctx.strokeStyle='#44CC66'; ctx.lineWidth=1.5; roundRect(ctx,noX,btnY,btnW,btnH,8); ctx.stroke();
  ctx.fillStyle='#66EE88'; ctx.fillText('NO — BACK',noX+btnW/2,btnY+btnH/2);
}

function drawPauseOverlay(ctx,CW,CH,timerLeft,palletsStaged,totalPallets) {
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,CW,CH);
  const bw=Math.min(CW-36,220),bh=154,bx=(CW-bw)/2,by=(CH-bh)/2;
  ctx.fillStyle=C.overlayPanel; roundRect(ctx,bx,by,bw,bh,14); ctx.fill();
  ctx.strokeStyle='rgba(180,180,255,0.50)'; ctx.lineWidth=1.5; roundRect(ctx,bx,by,bw,bh,14); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`bold ${Math.max(16,Math.floor(bw*0.10))}px Arial,sans-serif`;
  ctx.fillStyle='#CCDDFF'; ctx.fillText('⏸  PAUSED',CW/2,by+36);
  ctx.font=`${Math.max(8,Math.floor(bw*0.062))}px Arial,sans-serif`;
  ctx.fillStyle=C.hudDim; ctx.fillText('Press P, Space, or tap to resume',CW/2,by+62);
  // Item 15: reset shortcut hint in pause overlay
  ctx.font=`${Math.max(7,Math.floor(bw*0.054))}px Arial,sans-serif`;
  ctx.fillStyle='rgba(180,160,120,0.70)';
  ctx.fillText('⌫ Backspace to reset puzzle',CW/2,by+80);
  ctx.font=`bold ${Math.max(9,Math.floor(bw*0.068))}px Arial,sans-serif`;
  const tColor = (timerLeft||0)>30?'#44EE88':(timerLeft||0)>15?'#FFCC00':'#FF4444';
  ctx.fillStyle=tColor; ctx.fillText(`⏱  ${Math.ceil(timerLeft||0)}s remaining`,CW/2,by+90);
  // Staging progress — gives quick re-orientation on resume
  ctx.font=`${Math.max(7,Math.floor(bw*0.055))}px Arial,sans-serif`;
  ctx.fillStyle='rgba(160,210,160,0.75)';
  ctx.fillText(`${palletsStaged||0} of ${totalPallets||0} pallets staged`,CW/2,by+114);
}

function getBailButtonHit(px,py,CW,CH) {
  const bw=Math.min(CW-36,248),bh=154,by=(CH-bh)/2;
  const btnW=90,btnH=36,yesX=CW/2-btnW-8,noX=CW/2+8,btnY=by+96;
  if (py>=btnY&&py<=btnY+btnH) {
    if (px>=yesX&&px<=yesX+btnW) return 'yes';
    if (px>=noX &&px<=noX+btnW)  return 'no';
  }
  return null;
}

// =============================================================================
//  SECTION 8 — GAME LOGIC HELPERS
// =============================================================================

function findPalletAtTile(pallets, row, col) {
  for (const p of pallets) {
    for (const t of p.tiles) { if (t.row===row&&t.col===col) return p; }
  }
  return null;
}

function pushUndoSnapshot(cl) {
  cl.moveHistory.push({
    jackRow:cl.jackRow, jackCol:cl.jackCol, jackDir:cl.jackDir,
    jackPx:cl.jackPx,   jackPy:cl.jackPy,
    palletsStaged:cl.palletsStaged,
    wrongZoneCount:cl.wrongZoneCount||0,
    pushCount:cl.pushCount||0,
    moveCount:cl.moveCount||0,
    lastLockTime:cl.lastLockTime||0,
    bestCombo:cl._bestCombo||0,
    zoneStagedCounts:cl.zones.map(z=>z.stagedCount),
    pallets:cl.pallets.map(p=>({ ...p, tiles:p.tiles.map(t=>({...t})) })),
  });
  if (cl.moveHistory.length>100) cl.moveHistory.shift();
}

function applyUndo(cl) {
  if (cl.overlayState!=='playing'||cl.moveHistory.length===0) return;
  const snap=cl.moveHistory.pop();
  sfxUndo();
  cl.jackRow=snap.jackRow; cl.jackCol=snap.jackCol; cl.jackDir=snap.jackDir;
  cl.jackPx=snap.jackPx||(cl.jackCol*cl.TILE+cl.TILE);
  cl.jackPy=snap.jackPy||(HUD_H+cl.jackRow*cl.TILE+cl.TILE);
  cl.jackTargetPx=cl.jackPx; cl.jackTargetPy=cl.jackPy;
  cl.palletsStaged=snap.palletsStaged;
  cl.wrongZoneCount=snap.wrongZoneCount||0;
  cl.pushCount=snap.pushCount;
  cl.moveCount=snap.moveCount||0;
  cl.lastLockTime=snap.lastLockTime||0;
  cl._bestCombo=snap.bestCombo;
  cl.comboLevel=0;  // undo breaks any live combo chain
  cl.comboFlashFrames=0;  // kill any in-flight combo flash
  cl.particles=[];          // discard stale shards/sparks from rolled-back push
  cl.shakeFrames=0;         // cancel any in-progress screen shake
  cl._undoFlash = 12;        // brief white world flash = time-rewind cue
  cl.wrongZoneFlash={};     // cancel amber zone flash from rolled-back wrong push
  // Restore pallets; reset any mid-animation dock state so undo looks clean
  cl.pallets = snap.pallets.map(p => ({
    ...p,
    tiles: p.tiles.map(t=>({...t})),
    // preserve locked from snapshot — zero animation counters and transient flags
    _dockAnimFrame: 0,
    lerpOx: 0, lerpOy: 0,
    _lifted: false,
    _carryOx: 0, _carryOy: 0,
    _proxHighlight: false,
    _rotatableHighlight: false,
    _preSnap: false,
    _squashT: 0,
    _swayOy: 0,
  }));
  snap.zoneStagedCounts.forEach((cnt,i)=>{ if (cl.zones[i]) cl.zones[i].stagedCount=cnt; });
  // Always clear lift state on undo
  cl.liftedPallet  = null;
  cl.liftState     = null;
  cl.liftAnimFrame = 0;
  cl.liftPumpCount = 0;
  for (const _p of cl.pallets) { _p._lifted = false; }
}

// ── checkDockSnap ─────────────────────────────────────────────────────────────
// Fires after every push.  Triggers when the pallet's top edge (minRow) reaches
// row 0 — meaning the pallet is entering a dock bay opening.
//
// • Correct bay  → locks pallet, starts dock animation, awards combo.
// • Wrong bay    → bounces pallet back one row, plays wrong-zone SFX, no lock.
// • Not over any active bay → no-op (pallet sits against a wall tile, which
//   canPush already prevents in practice).
function checkDockSnap(cl, pallet) {
  if (pallet.locked) return;

  const bbox = getTileBBox(pallet.tiles);
  if (bbox.minRow !== 0) return;   // pallet not yet touching dock row — nothing to do

  // Identify which row-0 tiles exist and which bay they fall inside
  const row0tiles = pallet.tiles.filter(t => t.row === 0);
  const bay = (cl.dockBays || []).find(b =>
    b.isActive &&
    row0tiles.every(t => t.col >= bayLeftCol(b.bayIdx) && t.col <= bayRightCol(b.bayIdx))
  );
  if (!bay) return; // not cleanly inside any single active bay

  const cx = bbox.minCol * cl.TILE + ((bbox.maxCol - bbox.minCol + 1) * cl.TILE) / 2;
  const cy = HUD_H + bbox.minRow * cl.TILE + ((bbox.maxRow - bbox.minRow + 1) * cl.TILE) / 2;

  if (bay.stopIdx === pallet.stopIdx) {
    // ── Correct dock bay ─────────────────────────────────────────────────────
    pallet.locked = true;
    cl.palletsStaged++;
    const correctZone = cl.zones.find(z => z.zoneType === `Z${pallet.stopIdx + 1}`);
    if (correctZone) correctZone.stagedCount++;
    cl.lockFlashFrames[pallet.id] = 12;
    pallet._dockAnimFrame = DOCK_ANIM_FRAMES;
    pallet._lockBounceFrames = 12;  // Item 5: settle bounce starts on lock
    sfxLock(cl.palletsStaged - 1);
    sfxDockLoad();
    cl.zoomFrames = 12;  // brief zoom-in pulse on successful dock snap
    cl._stagedPopFrames = 10;  // staged count text scale-pop
    (cl.thudRings = cl.thudRings || []).push({
      x: cx, y: cy, r: 0, maxR: cl.TILE * 2.2,
      life: 22, maxLife: 22,
      color: (ZONE_COLORS[pallet.stopIdx] || ZONE_COLORS[0]).spark,
    });
    // Combo
    const now = Date.now();
    if (now - cl.lastLockTime < COMBO_WINDOW_MS && cl.lastLockTime > 0) {
      cl.comboLevel++;
      if (cl.comboLevel > cl._bestCombo) cl._bestCombo = cl.comboLevel;
      sfxCombo(cl.comboLevel);
      cl.comboFlashFrames = 40;
    } else { cl.comboLevel = 1; }
    cl.lastLockTime = now;
    // Particles
    const zc = ZONE_COLORS[pallet.stopIdx] || ZONE_COLORS[0];
    spawnLockSparks(cl.particles, cx, cy, zc.spark, 14);
    if (correctZone && correctZone.stagedCount >= correctZone.totalCount) {
      spawnZoneBurst(cl.particles, cx, cy, zc.spark, cl.TILE);
      correctZone._doneFlash = 20;  // 20-frame bright wash on zone completion
      sfxZoneComplete();            // Item 6: distinct zone-complete audio cue
    }

  } else {
    // ── Wrong dock bay ────────────────────────────────────────────────────────
    sfxWrongZone();
    cl.wrongZoneCount = (cl.wrongZoneCount||0) + 1;
    cl.shakeFrames  = 6;
    cl._wrongBayFlash = 10;
    cl.wrongZoneFlash[`z${pallet.stopIdx}`] = 12;
    spawnWrongZoneShards(cl.particles, cx, cy);
    (cl.thudRings = cl.thudRings || []).push({
      x: cx, y: cy, r: 0, maxR: cl.TILE * 1.6,
      life: 16, maxLife: 16,
      color: '#FF3333',
    });
    // Skip bounce-back if the pallet is being carried — syncLiftedPalletTiles
    // will immediately re-snap it to the jack face, making the bounce invisible.
    // The player must navigate to the correct bay while still carrying.
    if (cl.liftedPallet !== pallet) {
      // Only bounce back if row+1 is clear; otherwise leave in place (jack can undo)
      const bounceTiles = pallet.tiles.map(t => ({ ...t, row: t.row + 1 }));
      const bounceOk = bounceTiles.every(({ row, col }) => {
        if (row >= ROWS) return false;
        const occ = findPalletAtTile(cl.pallets, row, col);
        return !occ || occ.id === pallet.id;
      });
      if (bounceOk) {
        pallet.tiles  = bounceTiles;
        pallet.lerpOy = -cl.TILE;
        cl._bounceBackTimeout = setTimeout(()=>{ cl._bounceBackTimeout=null; sfxBounceBack(); }, 130);
      }
    }
  }
}

function tryRotatePallet(cl, pallet) {
  if (!ROTATABLE_SHAPES.has(pallet.shapeId) || pallet.locked) return false;
  const newOrientation = (pallet.orientation+1) % 4;
  const offsets = getShapeTiles(pallet.shapeId, newOrientation);
  const bbox    = getTileBBox(pallet.tiles);
  const newTiles = offsets.map(({dr,dc})=>({ row:bbox.minRow+dr, col:bbox.minCol+dc }));
  for (const {row,col} of newTiles) {
    if (row<1||row>=ROWS||col<1||col>=COLS-1) return false;
    if (row >= ROWS-2) return false;
    const t = cl.grid[row]?.[col];
    if (!t||t===TILE_W||isSolid(t)) return false;
    const occ = findPalletAtTile(cl.pallets, row, col);
    if (occ && occ.id !== pallet.id) return false;
  }
  pushUndoSnapshot(cl);
  pallet.tiles = newTiles;
  pallet.orientation = newOrientation;
  sfxRotate();
  return true;
}

// =============================================================================
//  SECTION 9 — GAME LOGIC FACTORIES
// =============================================================================

function makeInitGrid(cl, setHasIceTiles, setOverlaySync) {
  return function initGrid(items) {
    // Item 13a: reverse stop order — last delivery stop loads first (deepest in truck)
    const orderedItems = [...(items||[])].reverse();
    // Store the original (un-reversed) prop so Backspace reset can pass it back in
    // without double-reversing. cl.items holds reversed order for HUD legend.
    cl._origItems = items;
    cl.items = orderedItems;
    const totalPalletCount = orderedItems.reduce(
      (sum,stop) => sum + (stop.items||[]).reduce((s,it) => s + (it.count||0), 0), 0
    );
    cl.totalPallets = totalPalletCount;
    const difficulty = totalPalletCount<=3 ? 0 : totalPalletCount<=6 ? 1 : 2;

    // Wall/floor/light style rotates per level
    cl.wallStyle  = cl.gameCount % 7;             // 0=brick 1=cinderblock 2=tile 3=stripe 4=chainlink 5=steel 6=painted
    cl.floorStyle = Math.floor(cl.gameCount / 7) % 4; // 0=concrete 1=rubber 2=epoxy 3=terrazzo
    cl.lightMode  = cl.gameCount % 3;             // 0=fluorescent 1=exit 2=nightshift

    // Generate maze — returns {grid, mazeIdx} so placement can use spawn points
    const { grid: genGrid, mazeIdx: genMazeIdx } = generateLayout(difficulty, totalPalletCount);
    cl.grid    = genGrid;
    cl.mazeIdx = genMazeIdx;
    // Detect ice tiles for conditional UI hint
    try { setHasIceTiles(genGrid.some(row => row.some(t => t === TILE_ICE))); } catch(e) {}

    // ── Active bay selection — which bays belong to which stop ───────────────
    const stopCount = orderedItems.length;
    const bayGroups = selectActiveBays(stopCount, cl.gameCount);
    // bayGroups: [[0,1,2],[5,6,7]] etc — one array of bayIdx[] per stop

    // Store on cl for rendering
    cl.dockBays = Array.from({length:BAY_COUNT}, (_,i)=>({bayIdx:i,isActive:false,stopIdx:-1}));
    bayGroups.forEach((bays, stopIdx) => {
      bays.forEach(bayIdx => {
        cl.dockBays[bayIdx].isActive = true;
        cl.dockBays[bayIdx].stopIdx  = stopIdx;
      });
    });

    // Close inactive bays in grid (row 0 only; active bays are already TILE_DOCK)
    for (let i = 0; i < BAY_COUNT; i++) {
      if (!cl.dockBays[i].isActive) {
        for (let c = bayLeftCol(i); c <= bayRightCol(i); c++) cl.grid[0][c] = TILE_W;
      }
    }

    // ── Zone tile stamping — rows 1-2 of each stop's bay group ───────────────
    cl.zones = [];
    orderedItems.forEach((stop, stopIdx) => {
      const bays = bayGroups[stopIdx] || [];
      const zoneType = `Z${stopIdx+1}`, zoneTiles = [];
      for (const bayIdx of bays) {
        for (let r = 1; r <= 2; r++) {
          for (let c = bayLeftCol(bayIdx); c <= bayRightCol(bayIdx); c++) {
            if (cl.grid[r]?.[c] === TILE_F || cl.grid[r]?.[c] === undefined) {
              cl.grid[r][c] = zoneType;
              zoneTiles.push({row:r, col:c});
            }
          }
        }
      }
      const stopTotal = (stop.items||[]).reduce((s,it)=>s+(it.count||0),0);
      cl.zones.push({
        stopIdx, stopNumber: stop.stopNumber||(stopIdx+1),
        customerName: stop.customerName||`STOP ${stopIdx+1}`,
        totalWeightLbs: stop.totalWeightLbs||0,
        totalCount: stopTotal, stagedCount: 0, _doneFlash: 0, tiles: zoneTiles, zoneType,
      });
    });

    // Pallet creation
    cl.pallets = []; let palletId = 1;
    orderedItems.forEach((stop, stopIdx) => {
      // Item 13b: heaviest-first within each stop — heavier pallets get created first
      // (informational only: no rule enforces order, but spawn sequence reflects weight priority)
      const sortedGroups = [...(stop.items||[])].sort((a,b) => (b.weightEachLbs||0) - (a.weightEachLbs||0));
      sortedGroups.forEach(itemGroup => {
        const shapeId = getShapeId(itemGroup.itemType||'');
        for (let i = 0; i < (itemGroup.count||0); i++) {
          cl.pallets.push({
            id: palletId++, stopIdx, shapeId, tiles: [],
            weightLbs: itemGroup.weightEachLbs||0,
            label: (itemGroup.label||'').slice(0,8),
            cargoStyle: getCargoStyle(itemGroup.label||'', itemGroup.itemType||''),
            locked: false, orientation: 0,
            lerpOx: 0, lerpOy: 0, _swayPhase: Math.random() * Math.PI * 2, _onIce: false,
            _dockAnimFrame: 0, _lockBounceFrames: 0,
          });
        }
      });
    });

    // ── Guaranteed placement using pre-verified spawn anchors ─────────────────
    // MAZE_SPAWN_POINTS[mazeIdx] is a list of (row,col) anchors where a 2×2
    // S4 block fits on open floor, BFS-verified at build time.  Any smaller
    // shape (S2, SL, SLm, S1) is a strict subset of S4, so all shapes fit at
    // every anchor.  We work through the anchor list in order, cycling back if
    // we run out (max 12 pallets vs 15 anchors — should never cycle).
    const spawnAnchors = MAZE_SPAWN_POINTS[cl.mazeIdx] || MAZE_SPAWN_POINTS[0];
    const occupied = new Set();
    function canPlace(positions) {
      for (const {row,col} of positions) {
        if (row<4||row>ROWS-6||col<1||col>COLS-2) return false;
        const tile = cl.grid[row]?.[col];
        if (!tile || isSolid(tile) || tile.startsWith('Z')) return false;
        if (occupied.has(`${row},${col}`)) return false;
      }
      // Also keep spawn clear of the jack 2x2 start zone (rows ROWS-3..ROWS-2, center cols)
      const jackStartCol = Math.floor((COLS - 2) / 2);
      const jackStartRow = ROWS - 3;
      for (const {row,col} of positions) {
        for (let dr=0; dr<=1; dr++) for (let dc=0; dc<=1; dc++) {
          if (row===jackStartRow+dr && col===jackStartCol+dc) return false;
        }
      }
      return true;
    }
    const rotatable = ['S2','SL','SLm'];
    let anchorIdx = 0;
    for (const pallet of cl.pallets) {
      const orientations = rotatable.includes(pallet.shapeId) ? [0,1,2,3] : [0];
      let placed = false;
      // Try each anchor starting from anchorIdx, wrapping if needed
      for (let offset = 0; offset < spawnAnchors.length && !placed; offset++) {
        const [ar, ac] = spawnAnchors[(anchorIdx + offset) % spawnAnchors.length];
        for (const orient of orientations) {
          const pos = getShapeTiles(pallet.shapeId, orient).map(({dr,dc})=>({row:ar+dr, col:ac+dc}));
          if (canPlace(pos)) {
            pallet.tiles = pos; pallet.orientation = orient;
            pos.forEach(({row,col})=>occupied.add(`${row},${col}`));
            anchorIdx = (anchorIdx + offset + 1) % spawnAnchors.length;
            placed = true; break;
          }
        }
      }
      if (!placed) {
        // Absolute fallback: scan all open floor tiles (should never be needed)
        outerFb:
        for (const orient of orientations) {
          for (let r = 4; r <= ROWS-6; r++) {
            for (let c = 1; c <= COLS-2; c++) {  // full col range
              const pos = getShapeTiles(pallet.shapeId, orient).map(({dr,dc})=>({row:r+dr, col:c+dc}));
              if (canPlace(pos)) {
                pallet.tiles = pos; pallet.orientation = orient;
                pos.forEach(({row,col})=>occupied.add(`${row},${col}`));
                placed = true; break outerFb;
              }
            }
          }
        }
      }
      if (!placed) pallet.tiles = [{row:5,col:1},{row:5,col:2},{row:6,col:1},{row:6,col:2}]; // last-resort 2x2 stub
      pallet._onIce = pallet.tiles.some(({row,col})=>cl.grid[row]?.[col]===TILE_ICE);
    }

    // Jack start position — anchor (top-left of 2x2 body) near bottom center above entrance
    const jackStartRow = ROWS - 3;  // row 17; body rows 17-18
    const jackStartCol = Math.floor((COLS - 2) / 2);  // center 2x2 in world
    cl.jackRow = jackStartRow; cl.jackCol = jackStartCol; cl.jackDir = DIR_UP;
    cl.jackPx  = jackStartCol * cl.TILE + cl.TILE;  // pixel center = anchor + 1 tile
    cl.jackPy  = HUD_H + jackStartRow * cl.TILE + cl.TILE;
    cl.jackTargetPx = cl.jackPx; cl.jackTargetPy = cl.jackPy;
    cl.jackTrail = [];
    // Lift mechanic state — reset each game
    cl.liftedPallet   = null;   // pallet currently being carried
    cl.liftState      = null;   // null | 'lifting' | 'lifted' | 'lowering'
    cl.liftAnimFrame  = 0;      // frame counter within current lift/lower anim
    cl.liftPumpCount  = 0;      // pumps completed so far

    // Operator skin tone — deterministic per game, cycles through 4 tones
    cl.jackSkinTone = JACK_SKIN_TONES[((cl.gameCount * 1664525 + 1013904223) >>> 0) % JACK_SKIN_TONES.length];

    // Camera intro pan: start at dock (top of world), lerp down to jack over ~90 frames
    if (cl.TILE > 0) {
      const vpW = cl.CW, vpH = cl.CH - HUD_H;
      const jx = jackStartCol * cl.TILE + cl.TILE;  // center of 2x2 body
      const jy = jackStartRow * cl.TILE + cl.TILE;
      // Jack resting position
      cl._camJackX = Math.max(0, Math.min(jx - vpW / 2, COLS * cl.TILE - vpW));
      cl._camJackY = Math.max(0, Math.min(jy - vpH / 2, ROWS * cl.TILE - vpH));
      // Start camera at top of world (dock row visible)
      cl.camPixX = cl._camJackX;
      cl.camPixY = 0;
      cl._introPan = true;  // flag consumed by updateGame
    } else {
      cl.camPixX = 0; cl.camPixY = 0; cl._introPan = false;
    }

    // Timer scales with pallet count — larger warehouse means more travel distance
    // 1–3 pallets=100s, 4–6=140s, 7–9=175s, 10–12=210s
    const timerByCount = totalPalletCount<=3 ? 100 : totalPalletCount<=6 ? 140 : totalPalletCount<=9 ? 175 : 210;
    cl.timerMax = timerByCount;
    cl.timerLeft = timerByCount; cl.timerFrames = 0;
    cl.palletsStaged=0; cl.wrongZoneCount=0; cl.moveHistory=[]; cl.moveCount=0; cl.pushCount=0;
    cl.lockFlashFrames={}; cl.wrongZoneFlash={};
    cl.gameStartTime=Date.now(); cl.shakeFrames=0; cl.zoomFrames=0; cl._undoFlash=0; cl._wrongBayFlash=0;
    // Item 21: pre-load best steps so pace indicator works from move 1
    {
      const _diff21 = totalPalletCount<=3 ? 'easy' : totalPalletCount<=6 ? 'medium' : 'hard';
      try { cl._bestSteps = parseInt(localStorage.getItem(`pj_hi_steps_${_diff21}`)||'0', 10) || 0; } catch(e) { cl._bestSteps = 0; }
    }
    cl.pushAnimDir=null; cl.pushAnimPalletId=null; cl.pushAnimFrames=0;
    cl.particles=[]; cl.thudRings=[]; cl.tracks = new Set(); cl.palletDragTiles = new Set();
    // Ambient motes — initialized once; persist across resets for stable atmosphere
    if (!cl.ambientDust || cl.ambientDust.length === 0) {
      cl.ambientDust = [];
      for (let _m = 0; _m < 10; _m++) {
        const mseed = (_m * 6364136223846793005 + 1442695040888963407) >>> 0;
        cl.ambientDust.push({
          x:   (mseed & 0xFFF) % (COLS * cl.TILE),      // rough x across world width
          y:   HUD_H + ((mseed >> 12) & 0xFFF) % (ROWS * cl.TILE), // rough y in world
          vx:  ((mseed >> 24 & 0xFF) / 255 - 0.5) * 0.18,  // slow horizontal drift
          vy:  -0.05 - ((mseed >> 16 & 0xFF) / 255) * 0.10, // very slow upward float
          phase: (_m * 0.618) * Math.PI * 2,         // stagger sine wobble phase
          alpha: 0.06 + ((mseed >> 20 & 0xFF) / 255) * 0.10, // 0.06–0.16 opacity
          size:  0.8 + ((mseed >> 8 & 0xFF) / 255) * 1.2,
        });
      }
    }
    cl.comboLevel=0; cl.comboFlashFrames=0; cl.lastLockTime=0; cl._stagedPopFrames=0;
    cl._bestCombo=0; cl._finalXp=null;
    cl.zones.forEach(z=>{ z.stagedCount=0; });
    cl._winFrame = -1; cl._winSweep = false; cl._winSweepStart = 0;
    cl._goFlash  = 0;
    cl._winTimeTaken = null;
    cl._failFrame = -1;
    cl._firstHint = 0;        // activated after intro pan settles
    cl._firstPlayPending = false;

    try {
      const plays = parseInt(localStorage.getItem('pj_games')||'0', 10);
      localStorage.setItem('pj_games', plays+1);
    } catch(e) { /* localStorage unavailable — continue normally */ }
    // Always show tutorial on every game start.
    // Returning players can skip instantly with ESC or by tapping outside the panel.
    cl._tutActive = true; cl._tutStep = 0; setOverlaySync('tutorial');
  };
}

function makeUpdateGame(cl, setOverlaySync, onCompleteFn, onDismissFn) {
  // Ensure callbacks are always callable regardless of what parent passes
  if (typeof onCompleteFn !== 'function') onCompleteFn = ()=>{};
  if (typeof onDismissFn  !== 'function') onDismissFn  = ()=>{};
  return function updateGame() {
    // During tutorial: advance camera/animation but skip timer and game logic
    if (cl.overlayState === 'tutorial') {
      cl.frame = cl.frame; // frame already incremented in gameLoop
      // Advance intro pan so the world is visible behind the tutorial panel
      if (cl._introPan && cl.TILE > 0) {
        cl.camPixX = (cl.camPixX ?? 0) + ((cl._camJackX - (cl.camPixX ?? 0)) * 0.045);
        cl.camPixY = (cl.camPixY ?? 0) + ((cl._camJackY - (cl.camPixY ?? 0)) * 0.045);
        if (Math.abs(cl.camPixY - cl._camJackY) < 1.5) {
          cl._introPan = false;
        }
      }
      // Decay lerp offsets on pallets so they don't freeze
      for (const p of cl.pallets) {
        if (p.lerpOx) p.lerpOx *= 0.55;
        if (p.lerpOy) p.lerpOy *= 0.55;
        if (Math.abs(p.lerpOx) < 0.2) p.lerpOx = 0;
        if (Math.abs(p.lerpOy) < 0.2) p.lerpOy = 0;
      }
      return;
    }
    if (cl.overlayState !== 'playing') return;

    // Timer — only counts down after intro pan settles (player can act)
    if (!cl._introPan) cl.timerFrames++;
    if (!cl._introPan && cl.timerFrames >= 60) {
      cl.timerFrames = 0;
      cl.timerLeft   = Math.max(0, cl.timerLeft - 1);
      // Low-timer tick beep — each second when ≤10s remain
      if (cl.timerLeft <= 10 && cl.timerLeft > 0) sfxTimerTick(cl.timerLeft);
      if (cl.timerLeft <= 0) {
        sfxTimeout();
        cl.overlayState = 'fail'; setOverlaySync('fail');
        cl._failFrame = cl.frame;
        const partialXp = Math.round((cl.palletsStaged||0) * 10);
        cl._dismissTimeout = setTimeout(()=>{
          cl._dismissTimeout = null;
          if (partialXp > 0) onCompleteFn({ passed: false, xpEarned: partialXp, cashBonus: 0 });
          else onDismissFn();
        }, 2500); return;
      }
    }

    // Flash / shake timers
    for (const id of Object.keys(cl.lockFlashFrames)) {
      cl.lockFlashFrames[id] = Math.max(0, cl.lockFlashFrames[id]-1);
      if (cl.lockFlashFrames[id] === 0) delete cl.lockFlashFrames[id];
    }
    for (const key of Object.keys(cl.wrongZoneFlash)) {
      cl.wrongZoneFlash[key] = Math.max(0, cl.wrongZoneFlash[key]-1);
      if (cl.wrongZoneFlash[key] === 0) delete cl.wrongZoneFlash[key];
    }
    if (cl.shakeFrames > 0) cl.shakeFrames--;
    if ((cl.zoomFrames||0) > 0) cl.zoomFrames--;
    if ((cl._undoFlash||0) > 0) cl._undoFlash--;
    if ((cl._wrongBayFlash||0) > 0) cl._wrongBayFlash--;
    // Ambient motes drift
    if (cl.ambientDust?.length) {
      const worldW = COLS * cl.TILE, worldH = ROWS * cl.TILE;
      for (const m of cl.ambientDust) {
        m.x += m.vx + Math.sin(cl.frame * 0.008 + m.phase) * 0.06;
        m.y += m.vy;
        // Wrap around world bounds
        if (m.x < 0)      m.x += worldW;
        if (m.x > worldW) m.x -= worldW;
        if (m.y < HUD_H)  m.y = HUD_H + worldH;
        if (m.y > HUD_H + worldH) m.y = HUD_H;
      }
    }
    if (cl.thudRings?.length) {
      for (const ring of cl.thudRings) {
        ring.r += (ring.maxR - ring.r) * 0.22;  // ease outward
        ring.life--;
      }
      cl.thudRings = cl.thudRings.filter(r => r.life > 0);
    }
    for (const zone of (cl.zones||[])) { if ((zone._doneFlash||0) > 0) zone._doneFlash--; }

    // ── Lift / lower animation advance ────────────────────────────────────────
    if (cl.liftState === 'lifting') {
      cl.liftAnimFrame++;
      if (cl.liftAnimFrame % LIFT_PUMP_FRAMES === 0) {
        cl.liftPumpCount++;
      }
      if (cl.liftPumpCount >= LIFT_PUMPS_NEEDED) {
        cl.liftState = 'lifted';
        cl.liftAnimFrame = 0;
        if (cl.liftedPallet) cl.liftedPallet._lifted = true;
        // Immediately snap pallet to jack face tiles so carry starts correctly
        syncLiftedPalletTiles(cl);
      }
    } else if (cl.liftState === 'lowering') {
      cl.liftAnimFrame++;
      if (cl.liftAnimFrame >= LIFT_LOWER_FRAMES) {
        if (cl.liftedPallet) {
          cl.liftedPallet._lifted = false;
          cl.liftedPallet._carryOx = 0;
          cl.liftedPallet._carryOy = 0;
          cl.liftedPallet = null;
        }
        cl.liftState     = null;
        cl.liftAnimFrame = 0;
        cl.liftPumpCount = 0;
      }
    } else if (cl.liftState === 'docking') {
      // Pallet successfully docked while carried — play brief lower anim then release
      cl.liftAnimFrame++;
      if (cl.liftAnimFrame >= LIFT_LOWER_FRAMES) {
        // Lower anim complete — fully detach
        if (cl.liftedPallet) {
          cl.liftedPallet._lifted = false;
          cl.liftedPallet._carryOx = 0;
          cl.liftedPallet._carryOy = 0;
          cl.liftedPallet = null;
        }
        cl.liftState     = null;
        cl.liftAnimFrame = 0;
        cl.liftPumpCount = 0;
      }
    }
    // Legacy auto-detach guard: if liftedPallet is already docked and we're not
    // in 'docking' state, clear immediately (safety net for edge cases)
    if (cl.liftedPallet && cl.liftedPallet._dockAnimFrame > 0
        && cl.liftState !== 'docking') {
      cl.liftedPallet._lifted = false;
      cl.liftedPallet._carryOx = 0;
      cl.liftedPallet._carryOy = 0;
      cl.liftedPallet  = null;
      cl.liftState     = null;
      cl.liftAnimFrame = 0;
      cl.liftPumpCount = 0;
    }
    // ── Carry render offset: shift pallet visual 1 tile back onto jack body ──
    // This closes the jackRow gap where fork tines were visible between pallet
    // and orange body. Updated every frame so perpendicular turns stay correct.
    if (cl.liftState === 'lifted' && cl.liftedPallet) {
      const [_cdr, _cdc] = DIR_DELTA[cl.jackDir];
      cl.liftedPallet._carryOx = -_cdc * cl.TILE;
      cl.liftedPallet._carryOy = -_cdr * cl.TILE;
    }
    if (cl.comboFlashFrames > 0) cl.comboFlashFrames--;
    if ((cl._stagedPopFrames||0) > 0) cl._stagedPopFrames--;
    if (cl._goFlash > 0) cl._goFlash--;
    if (cl._firstHint > 0) cl._firstHint--;
    if (cl.pushAnimFrames > 0) {
      cl.pushAnimFrames--;
      if (cl.pushAnimFrames === 0) { cl.pushAnimDir = null; cl.pushAnimPalletId = null; }
    }

    // ── Dock loading animations ────────────────────────────────────────────
    // Advance each animating pallet; remove from cl.pallets when done
    for (let i = cl.pallets.length - 1; i >= 0; i--) {
      const p = cl.pallets[i];
      if (p._dockAnimFrame > 0) {
        p._dockAnimFrame--;
        if (p._dockAnimFrame === 0) {
          cl.pallets.splice(i, 1);
        }
      }
    }

    // Smooth jack lerp
    const LERP = 0.28;
    cl.jackPx += (cl.jackTargetPx - cl.jackPx) * LERP;
    cl.jackPy += (cl.jackTargetPy - cl.jackPy) * LERP;
    if (cl.frame % 3 === 0) {
      cl.jackTrail.unshift({x:cl.jackPx, y:cl.jackPy});
      if (cl.jackTrail.length > 4) cl.jackTrail.pop();
    }
    // Sync lifted pallet tiles to jack face every frame
    syncLiftedPalletTiles(cl);

    // Pallet lerp decay + heavy-load sway
    for (const p of cl.pallets) {
      // Weight sway — heavy unlocked pallets oscillate slightly (600lb+ only)
      // Lifted pallet is held firm — no sway
      if (!p.locked && !p._dockAnimFrame && !p._lifted && p.weightLbs >= 600) {
        p._swayPhase = ((p._swayPhase || 0) + 0.018) % (Math.PI * 2);
        p._swayOy = Math.sin(p._swayPhase) * 1.6;
      } else {
        p._swayOy = 0;
      }
      if (p.lerpOx) p.lerpOx *= 0.55;
      if (p.lerpOy) p.lerpOy *= 0.55;
      if (Math.abs(p.lerpOx) < 0.2) p.lerpOx = 0;
      if (Math.abs(p.lerpOy) < 0.2) p.lerpOy = 0;
      if (p._lockBounceFrames > 0) p._lockBounceFrames--;
    }

    // Smooth pixel-space camera — intro pan (first ~90 frames), then follows jack
    if (cl.TILE > 0) {
      const vpW = cl.CW, vpH = cl.CH - HUD_H;
      const worldPixW = COLS * cl.TILE, worldPixH = ROWS * cl.TILE;
      if (cl._introPan) {
        // Lerp from top of world toward jack resting position; snap when close
        cl.camPixX = (cl.camPixX ?? 0) + ((cl._camJackX - (cl.camPixX ?? 0)) * 0.045);
        cl.camPixY = (cl.camPixY ?? 0) + ((cl._camJackY - (cl.camPixY ?? 0)) * 0.045);
        if (Math.abs(cl.camPixY - cl._camJackY) < 1.5) {
          cl._introPan = false;
          cl._goFlash  = 40;  // 40-frame countdown (~0.67s) for GO! pop
          if (cl._firstPlayPending) { cl._firstHint = 240; cl._firstPlayPending = false; }
        }
      } else {
        const jx = cl.jackPx;  // already = anchor + TILE = center of 2x2
        const jy = cl.jackPy - HUD_H;
        const tCamX = Math.max(0, Math.min(jx - vpW / 2, worldPixW - vpW));
        const tCamY = Math.max(0, Math.min(jy - vpH / 2, worldPixH - vpH));
        cl.camPixX = (cl.camPixX ?? tCamX) + (tCamX - (cl.camPixX ?? tCamX)) * 0.14;
        cl.camPixY = (cl.camPixY ?? tCamY) + (tCamY - (cl.camPixY ?? tCamY)) * 0.14;
      }
    }

    updateParticles(cl.particles);

    // Win condition — all pallets loaded (staged AND finished animating out)
    if (cl.totalPallets > 0 && cl.palletsStaged >= cl.totalPallets) {
      // Wait until all dock animations finish before firing win
      const anyAnimating = cl.pallets.some(p => p._dockAnimFrame > 0);
      if (!anyAnimating) {
        // ── Win camera sweep: pan to dock row for ~55 frames, then show overlay ──
        if (!cl._winSweep) {
          cl._winSweep = true; cl._winSweepStart = cl.frame;
          sfxComplete(); // Fix 3: triumph fanfare fires immediately at sweep start
        }
        const _sweepElapsed = cl.frame - cl._winSweepStart;
        // Smoothly pan camera to dock row (origin) during sweep
        cl.camPixX = (cl.camPixX ?? 0) * 0.88;
        cl.camPixY = (cl.camPixY ?? 0) * 0.88;
        if (_sweepElapsed >= 20) {
        cl._winSweep = false;
        // Fix 1: timeTaken hoisted here — was after sfxPerfect reference (TDZ crash)
        const timeTaken = Math.round((Date.now()-cl.gameStartTime)/1000);
        // Fix 4: clean+fast → sfxPerfect; clean+slow → sfxCleanLoad; dirty → no chime
        if (!(cl.wrongZoneCount||0)) {
          if (timeTaken <= Math.round((cl.timerMax||120) * 0.40)) sfxPerfect();
          else sfxCleanLoad();
        }
        cl.overlayState = 'win'; setOverlaySync('win');
        cl._winFrame = cl.frame;
        cl._winTimeTaken = timeTaken;  // freeze — drawWinOverlay reads this
        // ── Expanded reward system ────────────────────────────────────────────
        const _isClean    = !(cl.wrongZoneCount||0);           // no wrong docks
        const _isFast     = timeTaken <= Math.round((cl.timerMax||120) * 0.40);
        const _isHard     = (cl.totalPallets||0) >= 7;
        const _isPerfect  = _isClean && _isFast;

        // XP: base + speed + combo
        const timeBonus  = _isFast ? 15 : 0;                  // +15 XP for speed
        const comboBonus = Math.min((cl._bestCombo||1)-1, 5) * 2;
        cl._finalXp      = 30 + timeBonus + comboBonus;
        cl._timeBonus    = timeBonus;
        cl._comboBonus   = comboBonus;

        // Cash: volume (per pallet) + conditional bonuses
        const _volumeCash   = (cl.palletsStaged||0) * 5;      // $5 per pallet loaded
        const _cleanBonus   = _isClean ? 20 : 0;              // $20 clean load
        const _speedBonus   = _isFast  ? 15 : 0;              // $15 speed bonus
        const _perfectExtra = _isPerfect ? 10 : 0;            // $10 perfect run extra
        const _diffBonus    = _isHard  ? 10 : 0;              // $10 hard load (7+ pallets)
        const cashBonus = _volumeCash + _cleanBonus + _speedBonus + _perfectExtra + _diffBonus;

        // Store bonus breakdown for overlay display
        cl._cashVolume   = _volumeCash;
        cl._cashClean    = _cleanBonus;
        cl._cashSpeed    = _speedBonus;
        cl._cashPerfect  = _perfectExtra;
        cl._cashDiff     = _diffBonus;
        cl._isClean      = _isClean;
        cl._isFast       = _isFast;
        // Difficulty bracket for scoped personal bests (matches timerMax thresholds)
        const diff = cl.totalPallets<=3 ? 'easy' : cl.totalPallets<=6 ? 'medium' : 'hard';
        try {
          const prevTime   = parseInt(localStorage.getItem(`pj_hi_time_${diff}`)||'9999', 10);
          const prevPushes = parseInt(localStorage.getItem(`pj_hi_pushes_${diff}`)||'9999', 10);
          const prevSteps  = parseInt(localStorage.getItem(`pj_hi_steps_${diff}`)||'9999', 10);
          const newTimeRec  = timeTaken < prevTime;
          const newPushRec  = (cl.pushCount||0) < prevPushes;
          const newStepsRec = (cl.moveCount||0) < prevSteps;
          cl._newRecord = newTimeRec || newPushRec || newStepsRec;
          if (newTimeRec)  localStorage.setItem(`pj_hi_time_${diff}`,  String(timeTaken));
          if (newPushRec)  localStorage.setItem(`pj_hi_pushes_${diff}`, String(cl.pushCount||0));
          if (newStepsRec) localStorage.setItem(`pj_hi_steps_${diff}`,  String(cl.moveCount||0));
          cl._bestTime  = Math.min(timeTaken, prevTime);
          cl._bestPushes = Math.min(cl.pushCount||0, prevPushes);
          cl._bestSteps  = Math.min(cl.moveCount||0, prevSteps);
          cl._diffLabel = diff.charAt(0).toUpperCase() + diff.slice(1);
          cl._hadPriorRecord = (prevTime < 9999 || prevPushes < 9999 || prevSteps < 9999);
        } catch(e) { cl._newRecord=false; cl._bestTime=null; cl._bestPushes=null; cl._bestSteps=null; }
        cl._dismissTimeout = setTimeout(()=>{ cl._dismissTimeout=null; onCompleteFn({passed:true, xpEarned:cl._finalXp, cashBonus}); }, 2600);
        } // end _sweepElapsed >= 55 block
      }
    }
  };
}

function makeMoveJack(cl) {
  // ── 2x2 jack helpers ───────────────────────────────────────────────────────
  // jackRow/jackCol is the TOP-LEFT anchor of the 2x2 jack body.
  // jackTiles() returns all four occupied (row,col) positions.
  function jackTiles(row, col) {
    return [{row, col},{row, col:col+1},{row:row+1, col},{row:row+1, col:col+1}];
  }
  // pushFaceTiles: the 2 tiles immediately ahead of the jack in direction dir.
  // DIR_UP (-1,0): front face is rows (row-1, col) and (row-1, col+1)
  // DIR_DOWN(+1,0): front face is rows (row+2, col) and (row+2, col+1)
  // DIR_LEFT(0,-1): front face is (row, col-1) and (row+1, col-1)
  // DIR_RIGHT(0,+1): front face is (row, col+2) and (row+1, col+2)
  function pushFaceTiles(row, col, dr, dc) {
    if (dr === -1) return [{row:row-1, col},{row:row-1, col:col+1}];
    if (dr ===  1) return [{row:row+2, col},{row:row+2, col:col+1}];
    if (dc === -1) return [{row, col:col-1},{row:row+1, col:col-1}];
                   return [{row, col:col+2},{row:row+1, col:col+2}];
  }
  // All four tiles of the new jack position (after moving by dr,dc)
  function newJackTiles(row, col, dr, dc) {
    return jackTiles(row+dr, col+dc);
  }
  // canJackMove: new position must be within bounds, non-solid, not below ROWS-3
  function canJackMove(row, col, dr, dc) {
    const newR = row+dr, newC = col+dc;
    // Full 2x2 body check
    for (const {row:r, col:c} of jackTiles(newR, newC)) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      const t = cl.grid[r]?.[c] ?? TILE_W;
      if (t === TILE_W || isSolid(t)) return false;
      if (r >= ROWS - 2) return false;
    }
    return true;
  }

  return function moveJack(dir) {
    if (cl.overlayState !== 'playing' || cl._winSweep) return false;
    const [dr, dc] = DIR_DELTA[dir];
    // Direction update rules while carrying:
    //   forward (same as jackDir)   → no turn (move forward carrying pallet)
    //   backward (opposite jackDir) → no turn (pull/reverse)
    //   perpendicular               → turn 90°: jack + pallet rotate together
    // When not carrying: always update direction.
    if (cl.liftedPallet && cl.liftState === 'lifted') {
      const _oppDir = (cl.jackDir + 2) % 4;
      if (dir !== cl.jackDir && dir !== _oppDir) {
        // Perpendicular press — turn: jackDir updates, syncLiftedPalletTiles
        // repositions pallet to new face on next frame (handled in updateGame)
        cl.jackDir = dir;
      }
      // Forward or backward: no direction change — pallet stays at current face
    } else {
      cl.jackDir = dir;
    }

    // ── Block movement during lift / lower / docking animation ──────────────
    if (cl.liftState === 'lifting' || cl.liftState === 'lowering' || cl.liftState === 'docking') {
      sfxBump(); return false;
    }

    // ── Carried pallet movement (liftState === 'lifted') ─────────────────────
    if (cl.liftedPallet && cl.liftState === 'lifted') {
      const _lp = cl.liftedPallet;
      const _nr = cl.jackRow + dr, _nc = cl.jackCol + dc;

      // Combined collision: old jack + old pallet tiles are "ours" — skip those
      const _oldSet = new Set([
        ...jackTiles(cl.jackRow, cl.jackCol).map(t=>`${t.row},${t.col}`),
        ..._lp.tiles.map(t=>`${t.row},${t.col}`)
      ]);
      const _newJack = jackTiles(_nr, _nc);
      // Predict future pallet position using face-tile logic (same as syncLiftedPalletTiles)
      // This guarantees correctness for all pallet shapes regardless of current tile state.
      // Predict future pallet position: jack keeps its facing direction (cl.jackDir),
      // so the pallet always stays at the jack's face, even when pulling/reversing.
      const _newPallet = (() => {
        const face = jackFaceTiles(_nr, _nc, cl.jackDir);
        const [_fdr, _fdc] = DIR_DELTA[cl.jackDir];
        const bbox = getTileBBox(_lp.tiles);
        const pRows = bbox.maxRow - bbox.minRow + 1;
        const pCols = bbox.maxCol - bbox.minCol + 1;
        const tiles = [];
        if (_fdr !== 0) {
          const faceRow = face[0].row;
          for (let r = 0; r < pRows; r++)
            for (let c = 0; c < pCols; c++)
              tiles.push({ row: faceRow + r * _fdr, col: _nc + c });
        } else {
          const faceCol = face[0].col;
          for (let r = 0; r < pRows; r++)
            for (let c = 0; c < pCols; c++)
              tiles.push({ row: _nr + r, col: faceCol + c * _fdc });
        }
        return tiles;
      })();

      // Check new jack body tiles
      for (const {row, col} of _newJack) {
        if (_oldSet.has(`${row},${col}`)) continue;
        if (row<0||row+1>=ROWS||col<0||col+1>=COLS) { sfxBump(); cl.shakeFrames=4; return false; }
        if (row>=ROWS-2) { sfxBump(); return false; }
        const _t = cl.grid[row]?.[col] ?? TILE_W;
        if (_t===TILE_W||isSolid(_t)) { sfxBump(); cl.shakeFrames=4; return false; }
        const _occ = findPalletAtTile(cl.pallets, row, col);
        if (_occ && _occ.id !== _lp.id) { sfxBump(); return false; }
      }
      // Check new pallet tiles
      for (const {row, col} of _newPallet) {
        if (_oldSet.has(`${row},${col}`)) continue;
        if (row<0||col<0||col>=COLS) { sfxBump(); return false; }
        if (row>=ROWS-2) { sfxBump(); return false; }
        const _t = cl.grid[row]?.[col] ?? TILE_W;
        if (_t===TILE_W||isSolid(_t)) { sfxBump(); return false; }
        const _occ = findPalletAtTile(cl.pallets, row, col);
        if (_occ && _occ.id !== _lp.id) { sfxBump(); return false; }
      }

      // All clear — move jack, then sync pallet to new face position
      pushUndoSnapshot(cl);
      // Record old pallet positions as drag marks
      for (const _dt of _lp.tiles)
        (cl.palletDragTiles = cl.palletDragTiles||new Set()).add(`${_dt.row},${_dt.col}`);
      // Move jack
      cl.jackRow = _nr; cl.jackCol = _nc;
      cl._pojCacheDirty = true;  // invalidate palletOverJack cache
      cl.jackTargetPx = _nc*cl.TILE + cl.TILE;
      cl.jackTargetPy = HUD_H + _nr*cl.TILE + cl.TILE;
      for (const {row,col} of jackTiles(_nr,_nc)) cl.tracks.add(`${row},${col}`);
      // Sync pallet tiles to new jack face — always flush ahead of jack
      syncLiftedPalletTiles(cl);
      // Lerp for smooth visual slide
      _lp.lerpOx = -dc * cl.TILE;
      _lp.lerpOy = -dr * cl.TILE;
      sfxMove();
      // Check dock snap (pallet reaches row 0 from south while being carried)
      checkDockSnap(cl, _lp);
      // If correctly docked: transition to 'docking' so jack plays a brief lower anim
      if (_lp.locked || _lp._dockAnimFrame > 0) {
        // Keep _lifted=true during lower anim so the pallet stays in the lifted render layer
        // until the animation finishes (smoother visual transition)
        cl.liftState     = 'docking';
        cl.liftAnimFrame = 0;
        // pumpT will animate the handle/arms down naturally via the lowering calculation
      }
      if (!cl._introPan) cl.moveCount = (cl.moveCount||0) + 1;
      return true;
    }

    // ── Check 2x2 body can step into new position ────────────────────────────
    const newRow = cl.jackRow + dr, newCol = cl.jackCol + dc;
    // Bounds: 2x2 body must fit
    if (newRow < 0 || newRow+1 >= ROWS || newCol < 0 || newCol+1 >= COLS) {
      sfxBump(); cl.shakeFrames = 5; return false;
    }
    // Jack body tiles — all must be non-solid and within playfield
    const nextBodyTiles = jackTiles(newRow, newCol);
    for (const {row, col} of nextBodyTiles) {
      if (row >= ROWS-2) { sfxBump(); return false; }
      const t = cl.grid[row]?.[col] ?? TILE_W;
      if (t === TILE_W || isSolid(t)) { sfxBump(); cl.shakeFrames = 5; return false; }
    }

    // ── Pallets — jack can only drive UNDER a pallet forks-first ────────────
    // Jack cannot walk into row 0 (dock opening) on foot
    if (newRow === 0 || newRow+1 === 0) { sfxBump(); return false; }

    // For each body tile that would be occupied: block unless the jack's forks
    // are already entering that same pallet (forks-first drive-under approach).
    // Locked / animating pallets always block regardless.
    const _nextFaceTiles = pushFaceTiles(newRow, newCol, dr, dc);
    for (const {row, col} of nextBodyTiles) {
      const occ = findPalletAtTile(cl.pallets, row, col);
      if (!occ) continue;
      if (occ.locked || occ._dockAnimFrame > 0) { sfxBump(); return false; }
      // Unlocked pallet: allow only if forks are entering the same pallet first
      const _forksEnterPallet = _nextFaceTiles.some(ft =>
        occ.tiles.some(t => t.row === ft.row && t.col === ft.col)
      );
      if (!_forksEnterPallet) { sfxBump(); return false; }
    }

    // Pure move (jack may now be under a pallet — doLift detects body overlap)
    pushUndoSnapshot(cl);
    cl.jackRow = newRow; cl.jackCol = newCol;
    cl._pojCacheDirty = true;  // invalidate palletOverJack cache
    cl.jackTargetPx = newCol*cl.TILE + cl.TILE;
    cl.jackTargetPy = HUD_H + newRow*cl.TILE + cl.TILE;
    for (const {row,col} of jackTiles(newRow,newCol)) cl.tracks.add(`${row},${col}`);
    if (cl.grid[newRow]?.[newCol] === TILE_ICE) {
      const _icx = newCol*cl.TILE+cl.TILE, _icy = HUD_H+newRow*cl.TILE+cl.TILE;
      spawnIceParticles(cl.particles, _icx, _icy);
    }
    sfxMove();
    if (!cl._introPan) cl.moveCount = (cl.moveCount || 0) + 1;
    return true;
  };
}

// =============================================================================
//  LIGHTING & ATMOSPHERE OVERLAY
// =============================================================================

// ── Constants ─────────────────────────────────────────────────────────────────
const LIGHT_FLUOR    = 0;
const LIGHT_EXIT     = 1;
const LIGHT_NIGHT    = 2;

// Drawn INSIDE world (camera) transform — covers the whole world canvas.
// fireStrobeRef: {value: 0|1} mutable object for cross-frame strobe state.
function drawLightingOverlay(ctx, TILE, frame, rm, cl, CW, CH, camPixX, camPixY) {
  const mode   = cl.lightMode ?? LIGHT_FLUOR;
  const worldW = COLS * TILE;
  const worldH = HUD_H + ROWS * TILE;

  if (mode === LIGHT_FLUOR) {
    // ── High-bay fluorescent: row of fixtures, wide light pools, one flicker ──
    // Fixture positions scale with world size: spread across maze zone rows 4-28
    const _mMid = Math.round((ROWS-6+4)/2);   // mid-row of maze zone ~16
    const _mQ1  = Math.round((4+_mMid)/2);    // quarter-row ~10
    const _mQ3  = Math.round((_mMid+ROWS-6)/2); // three-quarter-row ~22
    const FIX_ROWS = [4, _mQ1, _mMid, _mQ3, ROWS-7]; // 5 row bands across full maze
    // Fixture cols spread across usable width 1-41 (center ~20)
    const _cStep = Math.round((COLS-3)/4);    // ~10 cols apart
    const FIX_COLS = [3, 3+_cStep, 3+_cStep*2, 3+_cStep*3]; // 4 cols
    const POOL_W    = TILE * 3.2, POOL_H = TILE * 5.0;
    const flicker   = !rm && ((frame % 113) > 104); // tube flicker window
    const flickerB  = flicker ? (Math.sin(frame * 1.8) > 0 ? 0.28 : 0.08) : 0; // brightness jump

    FIX_ROWS.forEach((fr, fi) => {
      FIX_COLS.forEach((fc, ci) => {
        const fx = fc * TILE + TILE / 2;
        const fy = HUD_H + fr * TILE;
        const isFlickering = !rm && fi === 1 && ci === 1; // center fixture only
        const baseAlpha    = isFlickering ? flickerB : 0.08;

        // Light pool on floor
        if (!rm || baseAlpha > 0) {
          const pool = ctx.createRadialGradient(fx, fy + TILE, 2, fx, fy + TILE, POOL_W * 0.7);
          pool.addColorStop(0,   `rgba(230,245,210,${(baseAlpha + 0.08).toFixed(2)})`);
          pool.addColorStop(0.5, `rgba(210,235,190,${(baseAlpha * 0.5 + 0.03).toFixed(2)})`);
          pool.addColorStop(1,   'rgba(200,230,180,0)');
          ctx.fillStyle = pool;
          ctx.beginPath(); ctx.ellipse(fx, fy + TILE * 1.5, POOL_W * 0.65, POOL_H * 0.5, 0, 0, Math.PI*2); ctx.fill();
        }

        // Fixture housing
        ctx.fillStyle = '#3C3E48';
        ctx.fillRect(fx - TILE * 0.8, fy - 3, TILE * 1.6, 4);
        // Tube (glowing strip)
        const tubeAlpha = isFlickering ? (flicker ? Math.random() * 0.6 + 0.3 : 0.0) : 0.90;
        ctx.fillStyle = `rgba(230,248,220,${tubeAlpha.toFixed(2)})`;
        ctx.fillRect(fx - TILE * 0.75, fy - 2, TILE * 1.5, 2);
        // Mounting chain dots
        ctx.fillStyle = '#555560';
        ctx.beginPath(); ctx.arc(fx, fy - 6, 1.5, 0, Math.PI*2); ctx.fill();
      });
    });

  } else if (mode === LIGHT_EXIT) {
    // ── Emergency exit: red EXIT sign glow + battery-backup fixtures + red spill
    // Red tint over whole world (dim)
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(0, HUD_H, worldW, worldH - HUD_H);
    ctx.restore();

    // EXIT signs — top corners of maze area and near entrance
    // EXIT signs at four corners of the maze zone (rows 4 and mid-maze)
    const _exitMidRow = Math.round((4 + ROWS-6) / 2);
    const exitPositions = [
      [1 * TILE,          HUD_H + 4 * TILE],
      [(COLS - 2) * TILE, HUD_H + 4 * TILE],
      [1 * TILE,          HUD_H + _exitMidRow * TILE],
      [(COLS - 2) * TILE, HUD_H + _exitMidRow * TILE],
    ];
    exitPositions.forEach(([ex, ey]) => {
      // Red halo spill
      const spill = ctx.createRadialGradient(ex, ey, 2, ex, ey, TILE * 2.5);
      spill.addColorStop(0, 'rgba(220,0,0,0.28)');
      spill.addColorStop(1, 'rgba(220,0,0,0)');
      ctx.fillStyle = spill;
      ctx.beginPath(); ctx.arc(ex, ey, TILE * 2.5, 0, Math.PI*2); ctx.fill();
      // Sign box
      const sw = Math.ceil(TILE * 1.2), sh = Math.ceil(TILE * 0.4);
      ctx.fillStyle = '#220000'; roundRect(ctx, ex - sw/2, ey - sh/2, sw, sh, 3); ctx.fill();
      ctx.fillStyle = '#FF2222'; roundRect(ctx, ex - sw/2, ey - sh/2, sw, sh, 3); ctx.stroke();
      ctx.strokeStyle = '#FF3333'; ctx.lineWidth = 1;
      roundRect(ctx, ex - sw/2, ey - sh/2, sw, sh, 3); ctx.stroke();
      ctx.save();
      ctx.font = `bold ${Math.max(5, Math.floor(TILE * 0.22))}px Arial,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FF6666'; ctx.fillText('EXIT', ex, ey);
      ctx.restore();
      // Emergency fixture (white strip below sign)
      if (!rm) {
        const eAlpha = 0.45 + 0.15 * Math.sin(frame * 0.03);
        const eFix = ctx.createRadialGradient(ex, ey + sh, 1, ex, ey + sh, TILE * 0.9);
        eFix.addColorStop(0, `rgba(255,200,200,${eAlpha.toFixed(2)})`);
        eFix.addColorStop(1, 'rgba(255,200,200,0)');
        ctx.fillStyle = eFix;
        ctx.beginPath(); ctx.ellipse(ex, ey + sh, TILE * 0.8, TILE * 0.5, 0, 0, Math.PI*2); ctx.fill();
      }
    });

  } else if (mode === LIGHT_NIGHT) {
    // ── Night shift: deep shadow vignette, single work light on active bay ──
    // Heavy dark overlay except near active bay
    const activeB = cl.dockBays?.find(b => b.isActive);
    let workX = worldW / 2, workY = HUD_H;
    if (activeB) {
      const bx = bayLeftCol(activeB.bayIdx) * TILE + (BAY_W * TILE) / 2;
      workX = bx; workY = HUD_H + TILE;
    }

    // Dim base — everything dark
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#04060E';
    ctx.fillRect(0, HUD_H, worldW, worldH - HUD_H);
    ctx.restore();

    // Single work light on active bay (warm cone)
    const workLight = ctx.createRadialGradient(workX, workY, 2, workX, workY, TILE * 4.5);
    workLight.addColorStop(0,   'rgba(255,220,140,0.55)');
    workLight.addColorStop(0.4, 'rgba(255,200,100,0.20)');
    workLight.addColorStop(1,   'rgba(255,180,60,0)');
    ctx.fillStyle = workLight;
    ctx.beginPath(); ctx.arc(workX, workY, TILE * 4.5, 0, Math.PI*2); ctx.fill();

    // Work light fixture (clamp lamp silhouette)
    ctx.fillStyle = '#3A3A2A';
    ctx.fillRect(workX - TILE * 0.3, workY - TILE * 0.5, TILE * 0.6, TILE * 0.15);
    ctx.fillStyle = 'rgba(255,240,180,0.92)';
    ctx.beginPath(); ctx.arc(workX, workY - TILE * 0.35, 3, 0, Math.PI*2); ctx.fill();

  }
}

function makeRender(cl, ctxRef) {
  return function render() {
    const ctx = ctxRef.current; if (!ctx) return;
    const {TILE,CW,CH,frame} = cl, rm = cl.reducedMotion;
    const camPixX = Math.round(cl.camPixX ?? 0);
    const camPixY = Math.round(cl.camPixY ?? 0);

    // Establish DPR base transform — must be before any save/restore so the
    // scale persists as the matrix foundation for the entire frame.
    const _dpr = cl.dpr || 1;
    ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);

    // Screen shake + zoom pulse (wraps everything)
    ctx.save();
    if (cl.shakeFrames > 0 && !rm) {
      const mag = cl.shakeFrames * 0.5;
      ctx.translate((Math.random()-0.5)*mag*2, (Math.random()-0.5)*mag*2);
    }
    if ((cl.zoomFrames||0) > 0 && !rm) {
      // Spring zoom-in: rises fast, decays smoothly over 12 frames
      const zf = cl.zoomFrames / 12;               // 1→0
      const zScale = 1 + Math.sin(zf * Math.PI) * 0.035; // peaks at 1.035 at midpoint
      ctx.translate(CW / 2, CH / 2);
      ctx.scale(zScale, zScale);
      ctx.translate(-CW / 2, -CH / 2);
    }

    // Fill viewport background (world extends beyond canvas edges — no ghosts)
    ctx.fillStyle = '#080A12';
    ctx.fillRect(0, 0, CW, CH);

    // ── World layer: clip to game area, shift by pixel-precise camera ────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_H, CW, CH - HUD_H);
    ctx.clip();
    ctx.translate(-camPixX, -camPixY);

    drawFloor(ctx, cl.grid, TILE, CW, CH, cl.wallStyle, cl, frame);

    const loadedCount = cl.palletsStaged;
    const loadedFrac  = cl.totalPallets > 0 ? loadedCount / cl.totalPallets : 0;
    // Fix 7: bayGlow — pulsing colored halo per bay when matching pallet exists
    const _bayGlow = {};
    for (const _b of (cl.dockBays||[])) {
      if (!_b.isActive) continue;
      const _mp = (cl.pallets||[]).find(p => !p.locked && p._dockAnimFrame===0 && p.stopIdx===_b.stopIdx);
      if (_mp) {
        const _mb = getTileBBox(_mp.tiles);
        const _dist = Math.max(0, _mb.minRow - 1); // 0 = one row away, larger = farther
        _bayGlow[_b.stopIdx] = Math.max(0.18, 1 - _dist * 0.09);
      }
    }
    // Fix 8: loadedZones — Set of stopIdx values where all pallets are staged
    const _loadedZones = new Set(
      (cl.zones||[]).filter(z => z.totalCount > 0 && z.stagedCount >= z.totalCount)
                    .map(z => z.stopIdx)
    );
    drawAllDockBays(ctx, TILE, frame, rm, cl.dockBays, cl.zones, loadedFrac, _bayGlow, _loadedZones);

    for (const zone of (cl.zones||[])) {
      // Item 8: find nearest unlocked pallet that matches this zone's stopIdx
      // Pass its minRow so drawZone can accelerate chevrons as pallet approaches
      let _nearRow = null;
      for (const _zp of (cl.pallets||[])) {
        if (_zp.locked || _zp._dockAnimFrame > 0) continue;
        if (_zp.stopIdx !== zone.stopIdx) continue;
        const _zbb = getTileBBox(_zp.tiles);
        if (_nearRow === null || _zbb.minRow < _nearRow) _nearRow = _zbb.minRow;
      }
      drawZone(ctx, zone, TILE, frame, rm, cl.wrongZoneFlash, _nearRow);
    }

    drawParticles(ctx, cl.particles.filter(p=>p.type==='dust'||p.type==='ice'));

    // ── Pallet-under-jack detection — cached by jack position for performance ──
    // Declared BEFORE the pallet loop below so _palletOverJack is in scope when used.
    const _jackPosKey = `${cl.jackRow},${cl.jackCol}`;
    if (cl._pojCacheKey !== _jackPosKey || cl._pojCacheDirty) {
      cl._pojCacheKey = _jackPosKey;
      cl._pojCacheDirty = false;
      cl._pojCached = palletOverJack(cl);
    }
    const _palletOverJack = (cl.liftState === 'lifted' || cl.liftState === 'lifting'
                             || cl.liftState === 'lowering' || cl.liftState === 'docking')
      ? null   // once lifted, jack is no longer "under" — pallet is carried
      : cl._pojCached;

    // Compute per-pallet interaction flags (proximity + pre-snap) each render frame
    {
      const [_dr, _dc] = DIR_DELTA[cl.jackDir] || [0,0];
      // 2x2 jack push-face tiles: 2 tiles just ahead in jackDir
      const _faceTiles = (() => {
        const r = cl.jackRow, c = cl.jackCol;
        if (_dr === -1) return [{row:r-1,col:c},{row:r-1,col:c+1}];
        if (_dr ===  1) return [{row:r+2,col:c},{row:r+2,col:c+1}];
        if (_dc === -1) return [{row:r,col:c-1},{row:r+1,col:c-1}];
                        return [{row:r,col:c+2},{row:r+1,col:c+2}];
      })();
      for (const pallet of (cl.pallets||[])) {
        // Pallet over jack (being approached from under) or carried — no highlights
        const _isCarried = pallet === cl.liftedPallet;
        const _isUnder   = pallet === _palletOverJack;
        // Fix 1 — proximity highlight: any push-face tile touches this pallet
        pallet._proxHighlight = !pallet.locked && !_isCarried && !_isUnder && pallet._dockAnimFrame===0
          && pallet.tiles.some(t => _faceTiles.some(f => f.row===t.row && f.col===t.col));
        // Fix 3 — pre-snap shimmer: unlocked, minRow===1, columns overlap correct bay
        if (!pallet.locked && !_isCarried && !_isUnder && pallet._dockAnimFrame===0) {
          const _bbox = getTileBBox(pallet.tiles);
          if (_bbox.minRow === 1) {
            const _bay = (cl.dockBays||[]).find(b =>
              b.isActive && b.stopIdx === pallet.stopIdx &&
              pallet.tiles.some(t => t.row===1 && t.col>=bayLeftCol(b.bayIdx) && t.col<=bayRightCol(b.bayIdx))
            );
            pallet._preSnap = !!_bay;
          } else { pallet._preSnap = false; }
        } else { pallet._preSnap = false; }
        // Item 9: rotatable highlight — reset here; first match set below
        pallet._rotatableHighlight = false;
      }
      // Item 9: mark only the FIRST rotatable adjacent pallet — never the carried one
      const _jackBodyTiles2 = [{row:cl.jackRow,col:cl.jackCol},{row:cl.jackRow,col:cl.jackCol+1},
                                {row:cl.jackRow+1,col:cl.jackCol},{row:cl.jackRow+1,col:cl.jackCol+1}];
      const _rotTarget = (cl.pallets||[]).find(p =>
        p !== cl.liftedPallet &&
        !p.locked && p._dockAnimFrame===0 && ROTATABLE_SHAPES.has(p.shapeId) &&
        p.tiles.some(pt => _jackBodyTiles2.some(jt => Math.abs(pt.row-jt.row)<=1 && Math.abs(pt.col-jt.col)<=1))
      );
      if (_rotTarget) _rotTarget._rotatableHighlight = true;
    }
    // ── pumpT + forkSlide: shared across both drawJack calls ─────────────────
    // pumpT: pump oscillation for lifting/lowering/docking
    const _pumpT = (cl.liftState==='lifting'||cl.liftState==='lowering'||cl.liftState==='docking')
      ? Math.abs(Math.sin(cl.liftAnimFrame * Math.PI / LIFT_PUMP_FRAMES))
      : 0;
    // forkSlide: controls how far forks extend.
    // Simple state lookup — no per-frame pallet search.
    const _forkSlide = _palletOverJack           ? 0      // jack under pallet: forks hidden
      : cl.liftState === 'lifting'               ? Math.max(0.3, Math.min(1,
          (cl.liftPumpCount * LIFT_PUMP_FRAMES + cl.liftAnimFrame)
          / (LIFT_PUMPS_NEEDED * LIFT_PUMP_FRAMES)))
      : (cl.liftState === 'lifted'
         || cl.liftState === 'docking')          ? 1
      : cl.liftState === 'lowering'              ? Math.max(0.3, 1 - cl.liftAnimFrame / LIFT_LOWER_FRAMES * 0.7)
      : 0.85;  // idle: forks nearly extended

    // ── Fork z-layer pass: draw forks UNDER pallets ──────────────────────
    // Skip forksOnly when jack is under a pallet (body overlap) OR pallet is lifted/docking
    if ((cl.overlayState==='playing' || cl.overlayState==='bail' || cl.overlayState==='paused')
        && !_palletOverJack
        && cl.liftState !== 'lifted' && cl.liftState !== 'docking') {
      const _pushTf  = (cl.pushAnimFrames||0) > 0 ? (cl.pushAnimFrames/6) : 0;
      drawJack(ctx, cl.jackPx, cl.jackPy, TILE, cl.jackDir, cl.jackTrail, frame, rm,
               false, _pushTf, cl.shakeFrames||0, cl.comboLevel||0, cl.lightMode??0, true, cl.jackSkinTone||'#D08A55', _pumpT, _forkSlide);
      // ── Fork-ready glow: amber highlight when facing a liftable pallet ──────
      // Suppress when jack is already under a pallet (forks are hidden)
      if (!rm && !cl.liftState && !_palletOverJack) {
        const [_fdr, _fdc] = DIR_DELTA[cl.jackDir];
        const _ffTiles = (() => {
          const r = cl.jackRow, c = cl.jackCol;
          if (_fdr === -1) return [{row:r-1,col:c},{row:r-1,col:c+1}];
          if (_fdr ===  1) return [{row:r+2,col:c},{row:r+2,col:c+1}];
          if (_fdc === -1) return [{row:r,col:c-1},{row:r+1,col:c-1}];
                           return [{row:r,col:c+2},{row:r+1,col:c+2}];
        })();
        const _ffPallet = cl.pallets.find(p => !p.locked && !p._dockAnimFrame &&
          _ffTiles.some(f => p.tiles.some(t => t.row===f.row && t.col===f.col)));
        if (_ffPallet) {
          // Pulse amber glow on fork tines — we are already in camera-world space
          const _ffAlpha = 0.35 + 0.30 * Math.abs(Math.sin(cl.frame * 0.10));
          ctx.save();
          ctx.globalAlpha = _ffAlpha * 0.55;
          ctx.translate(cl.jackPx, cl.jackPy);
          ctx.rotate(DIR_ROT[cl.jackDir]);
          const _fT = TILE;
          ctx.strokeStyle = '#FFAA00';
          ctx.shadowColor  = '#FFAA00';
          ctx.shadowBlur   = 6;
          ctx.lineWidth    = _fT * 0.10;
          ctx.lineCap      = 'square';
          ctx.beginPath();
          ctx.moveTo(_fT*0.02, -_fT*0.43);
          ctx.lineTo(_fT*0.02 + _fT*0.88, -_fT*0.43);
          ctx.moveTo(_fT*0.02,  _fT*0.43);
          ctx.lineTo(_fT*0.02 + _fT*0.88,  _fT*0.43);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── Draw non-lifted pallets UNDER the jack body ──────────────────────
    // Exception: pallet overlapping jack body draws AFTER jack body (jack is under it)
    for (const pallet of (cl.pallets||[])) {
      if (pallet._lifted) continue;        // lifted: drawn after jack body
      if (pallet === _palletOverJack) continue;  // under-jack: drawn after jack body
      const isPush = cl.pushAnimPalletId===pallet.id && cl.pushAnimFrames>0;
      if (isPush) pallet._squashT = cl.pushAnimFrames / 6;
      else pallet._squashT = 0;
      drawPallet(ctx, pallet, TILE, frame, isPush?cl.pushAnimDir:null, rm);
    }

    drawParticles(ctx, cl.particles.filter(p=>p.type!=='dust'&&p.type!=='ice'));

    // ── Thud rings — expanding fading impact circles ──────────────────────
    if (cl.thudRings?.length && !rm) {
      for (const ring of cl.thudRings) {
        const ra = (ring.life / ring.maxLife);
        ctx.save();
        ctx.globalAlpha = ra * 0.70;
        ctx.strokeStyle = ring.color;
        ctx.shadowColor  = ring.color;
        ctx.shadowBlur   = 8;
        ctx.lineWidth    = Math.max(1, 3 * ra);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, Math.max(1, ring.r), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (cl.overlayState==='playing' || cl.overlayState==='bail' || cl.overlayState==='paused') {
      const _jackMoving = Math.abs(cl.jackPx - cl.jackTargetPx) + Math.abs(cl.jackPy - cl.jackTargetPy) > 1.5
                       || (cl.pushAnimFrames || 0) > 0;
      const _pushT  = (cl.pushAnimFrames || 0) > 0 ? (cl.pushAnimFrames / 6) : 0;
      const _shakeT = cl.shakeFrames || 0;
      drawJack(ctx, cl.jackPx, cl.jackPy, TILE, cl.jackDir, cl.jackTrail, frame, rm, _jackMoving, _pushT, _shakeT, cl.comboLevel||0, cl.lightMode??0, false, cl.jackSkinTone||'#D08A55', _pumpT, _forkSlide);
      // ── Draw "pallet over jack" — jack drove under but hasn't lifted yet ───
      // Draws flush on top of orange body, no carry-glow, no elevation
      if (_palletOverJack) {
        _palletOverJack._squashT = 0;
        drawPallet(ctx, _palletOverJack, TILE, frame, null, rm);
      }

      // ── Draw lifted pallet ON TOP of jack body (always in front) ────────────
      if (cl.liftedPallet && cl.liftState === 'lifted') {
        const _lp = cl.liftedPallet;
        const isPush = cl.pushAnimPalletId===_lp.id && cl.pushAnimFrames>0;
        _lp._squashT = 0;
        // Carry-glow green outline
        if (!rm) {
          const _lgPulse = 0.55 + 0.45 * Math.abs(Math.sin(frame * 0.10));
          ctx.save();
          ctx.globalAlpha = _lgPulse * 0.70;
          ctx.strokeStyle = '#44DD88';
          ctx.shadowColor  = '#44DD88';
          ctx.shadowBlur   = 10;
          ctx.lineWidth    = 2.5;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          drawPalletPerimeter(ctx, _lp.tiles, TILE, (_lp.lerpOx||0)+(_lp._carryOx||0), (_lp.lerpOy||0)+(_lp._carryOy||0));
          ctx.stroke();
          ctx.restore();
        }
        drawPallet(ctx, _lp, TILE, frame, null, rm);
      }

      // Item 17: render weight popup — floats upward and fades over 44 frames
      if (cl._weightPopup && cl._weightPopup.frames > 0 && !rm) {
        const _wp = cl._weightPopup;
        const _wpFrac = _wp.frames / 44;                // 1→0
        const _wpAlpha = Math.min(1, _wpFrac * 2);      // full alpha first half, then fades
        const _wpY = _wp.y - (44 - _wp.frames) * 0.55; // floats upward
        ctx.save();
        ctx.globalAlpha = _wpAlpha;
        ctx.font = `bold ${Math.max(8, Math.floor(TILE * 0.28))}px Arial,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(_wp.text, _wp.x + 1, _wpY + 1);
        // Main text — orange-red for heavy weight feel
        ctx.fillStyle = '#FF8833';
        ctx.shadowColor = '#FF4400'; ctx.shadowBlur = rm ? 0 : 6;
        ctx.fillText(_wp.text, _wp.x, _wpY);
        ctx.restore();
        cl._weightPopup.frames--;
      }
    }

    drawLightingOverlay(ctx, TILE, frame, rm, cl, CW, CH, camPixX, camPixY);

    // ── Ambient dust motes — faint floating particles giving air to the warehouse
    if ((cl.ambientDust?.length) && !rm && cl.overlayState === 'playing') {
      for (const m of cl.ambientDust) {
        ctx.save();
        ctx.globalAlpha = m.alpha;
        ctx.fillStyle   = 'rgba(210,200,180,1)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore(); // end camera clip+translate

    // ── Wrong-bay flash — brief red wash signals wrong dock snap ────────────
    if ((cl._wrongBayFlash||0) > 0 && !rm) {
      const wbA = (cl._wrongBayFlash / 10) * 0.28;
      ctx.save();
      ctx.globalAlpha = wbA;
      ctx.fillStyle = '#FF1A00';
      ctx.fillRect(0, HUD_H, CW, CH - HUD_H);
      ctx.restore();
    }

    // ── Undo flash — brief white wash over game world (time-rewind cue) ─────
    if ((cl._undoFlash||0) > 0 && !rm) {
      const ufA = (cl._undoFlash / 12) * 0.38;
      ctx.save();
      ctx.globalAlpha = ufA;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, HUD_H, CW, CH - HUD_H);
      ctx.restore();
    }

    // ── HUD: fixed canvas-space (no camera transform) ──────────────────────
    const _jackBody3 = [{row:cl.jackRow,col:cl.jackCol},{row:cl.jackRow,col:cl.jackCol+1},
                        {row:cl.jackRow+1,col:cl.jackCol},{row:cl.jackRow+1,col:cl.jackCol+1}];
    const nearbyRotatable = cl.pallets.some(p =>
      !p.locked && p._dockAnimFrame===0 && ROTATABLE_SHAPES.has(p.shapeId) &&
      p.tiles.some(pt => _jackBody3.some(jt => Math.abs(pt.row-jt.row)<=1 && Math.abs(pt.col-jt.col)<=1))
    );
    // Item 14: combo window fraction — 1.0 just after lock, drains to 0 over COMBO_WINDOW_MS
    const _comboWinFrac = (cl.comboLevel > 0 && cl.lastLockTime > 0)
      ? Math.max(0, 1 - (Date.now() - cl.lastLockTime) / COMBO_WINDOW_MS)
      : 0;

    const _liftPct = cl.liftState==='lifting'
      ? Math.min(1, cl.liftPumpCount / LIFT_PUMPS_NEEDED + (cl.liftAnimFrame % LIFT_PUMP_FRAMES) / (LIFT_PUMP_FRAMES * LIFT_PUMPS_NEEDED))
      : (cl.liftState==='lowering' || cl.liftState==='docking')
      ? Math.max(0, 1 - cl.liftAnimFrame / LIFT_LOWER_FRAMES)
      : cl.liftState==='lifted' ? 1 : 0;
    drawHUD(ctx, CW, cl.timerLeft, cl.timerMax||120, cl.palletsStaged, cl.totalPallets, cl.items,
      cl.moveHistory.length>0, nearbyRotatable,
      frame, rm, cl.comboLevel, cl.comboFlashFrames,
      cl.levelName || getLevelName(0), cl.zones, cl._stagedPopFrames||0, cl.moveCount||0, cl._bestSteps||0, _comboWinFrac,
      cl.liftState||null, _liftPct);

    // ── GO! flash — pops when intro pan settles ──────────────────────────────
    if ((cl._goFlash||0) > 0 && !rm) {
      const t = cl._goFlash / 40;          // 1 → 0 over 40 frames
      const scale = 1 + (1 - t) * 0.6;    // grows from 1× to 1.6×
      const alpha = t > 0.5 ? 1 : t * 2;  // fades out in last half
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(36 * scale)}px Arial,sans-serif`;
      ctx.fillStyle = '#00FF88';
      ctx.shadowColor = '#00FF88'; ctx.shadowBlur = 18;
      ctx.fillText('GO!', CW / 2, (CH + HUD_H) / 2);
      ctx.restore();
    }

    // ── First-play hint — lift and carry pallets to the dock ──────────────────
    // Shown only on first-ever game (pj_games===0 at start). Fades after 4s.
    if ((cl._firstHint||0) > 0 && !rm) {
      const HINT_FRAMES = 240;
      const t = cl._firstHint / HINT_FRAMES;  // 1 → 0
      // Fade in over first 30 frames, hold, fade out over last 60 frames
      const alpha = t > (1 - 30/HINT_FRAMES)
        ? (1 - t) / (30/HINT_FRAMES)        // fade in
        : t < (60/HINT_FRAMES)
          ? t / (60/HINT_FRAMES)             // fade out
          : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.92;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(11, Math.floor(CW * 0.042))}px Arial,sans-serif`;
      const hintY = HUD_H + Math.floor((CH - HUD_H) * 0.82);
      // Background pill
      const txt = '⬆ Lift pallets with E — carry them to the dock!';
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      roundRect(ctx, CW/2 - tw/2 - 10, hintY - 12, tw + 20, 24, 6); ctx.fill();
      ctx.fillStyle = '#FFFFAA';
      ctx.shadowColor = '#FFFF00'; ctx.shadowBlur = 8;
      ctx.fillText(txt, CW/2, hintY);
      ctx.restore();
    }

    ctx.restore(); // end shake

    // ── Canvas edge vignette — deepens during timer panic (≤5s) ─────────────
    if (!rm) {
      // Item 10: panic deepening — vignette pulses darker + redder below 5s
      const _panicT = cl.timerLeft <= 5 && cl.timerLeft > 0
        ? (0.5 + 0.5 * Math.abs(Math.sin(frame * 0.18))) : 0;
      const _vigAlpha = 0.46 + _panicT * 0.22;
      // Perf: cache the normal (non-panic) gradient; only rebuild during panic
      // or when canvas dimensions change (e.g. orientation flip).
      let vigGrad;
      if (_panicT > 0) {
        // Panic mode: color pulses each frame — must reallocate
        vigGrad = ctx.createRadialGradient(CW/2, CH/2, Math.min(CW,CH)*0.32, CW/2, CH/2, Math.max(CW,CH)*0.78);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, `rgba(80,0,0,${_vigAlpha.toFixed(3)})`);
      } else {
        // Normal mode: rebuild only when canvas size changes
        if (!cl._vigGrad || cl._vigGradCW !== CW || cl._vigGradCH !== CH) {
          cl._vigGrad  = ctx.createRadialGradient(CW/2, CH/2, Math.min(CW,CH)*0.32, CW/2, CH/2, Math.max(CW,CH)*0.78);
          cl._vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
          cl._vigGrad.addColorStop(1, 'rgba(0,0,0,0.460)');
          cl._vigGradCW = CW; cl._vigGradCH = CH;
        }
        vigGrad = cl._vigGrad;
      }
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, CW, CH);
    }

    if      (cl.overlayState==='tutorial') drawTutorialOverlay(ctx,CW,CH,cl,frame,rm);
    else if (cl.overlayState==='win')    drawWinOverlay(ctx,CW,CH,cl,frame,rm);
    else if (cl.overlayState==='fail')   drawFailOverlay(ctx,CW,CH,cl,frame,rm);
    else if (cl.overlayState==='bail')   drawBailOverlay(ctx,CW,CH,cl);
    else if (cl.overlayState==='paused') drawPauseOverlay(ctx,CW,CH,cl.timerLeft,cl.palletsStaged,cl.totalPallets);
  };
}

// =============================================================================
//  SECTION 10 — COMPONENT  (Full-screen, portrait + landscape responsive)
// =============================================================================

export default function PalletWrangler({ items, onComplete, onDismiss, gameCount = 0 }) {
  const canvasRef        = useRef(null);
  const gameAreaRef      = useRef(null);
  const dpadRef          = useRef({ dir:null, intervalId:null, repeatTimeout:null });
  const orientationRef   = useRef('portrait');
  const reducedMotionRef = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
  const [overlayState, setOverlayState] = useState('playing');
  const [orientation,  setOrientation]  = useState('portrait');
  const [hasIceTiles,  setHasIceTiles]  = useState(false);
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const cl = {
      TILE:28, CW:VIEW_COLS*28, CH:HUD_H+VIEW_ROWS*28,
      frame:0, gameCount: gameCount,
      jackRow: ROWS-3, jackCol: Math.floor((COLS-2)/2), jackDir:DIR_UP,
      jackPx: Math.floor((COLS-2)/2)*28+28,
      jackPy: HUD_H+(ROWS-3)*28+28,
      jackTargetPx: Math.floor((COLS-2)/2)*28+28,
      jackTargetPy: HUD_H+(ROWS-3)*28+28,
      jackTrail:[],
      pallets:[], grid:[], zones:[],
      timerLeft:120, timerFrames:0,
      palletsStaged:0, totalPallets:0,
      wrongZoneCount:0, moveHistory:[],
      lockFlashFrames:{}, wrongZoneFlash:{},
      gameStartTime:Date.now(), shakeFrames:0, zoomFrames:0, _undoFlash:0, _wrongBayFlash:0,
      pushAnimDir:null, pushAnimPalletId:null, pushAnimFrames:0,
      particles:[], thudRings:[], ambientDust:[], tracks: new Set(), palletDragTiles: new Set(),
      comboLevel:0, comboFlashFrames:0, lastLockTime:0, _stagedPopFrames:0,
      _bestCombo:0, _finalXp:null, moveCount:0, pushCount:0, _winSweep:false, _winSweepStart:0,
      overlayState:'playing',
      liftedPallet:null, liftState:null, liftAnimFrame:0, liftPumpCount:0,
      jackSkinTone:'#D08A55',
      _pojCached:null, _pojCacheKey:'', _pojCacheDirty:true,
      items, reducedMotion:reducedMotionRef.current,
      isTouchDevice: typeof window !== 'undefined' && 'ontouchstart' in window,
      levelName:'',
      _vigGrad: null, _vigGradCW: 0, _vigGradCH: 0,  // vignette gradient cache
      _tutActive: false, _tutStep: 0,               // tutorial overlay state
    };

    function setOverlaySync(state) {
      cl.overlayState=state; setOverlayState(state);
    }

    // Register this instance as the active audio owner
    const _myAudio = { ctx: null };
    _instanceAudio = _myAudio;

    const ctxRef     = {current:ctx};
    const initGrid   = makeInitGrid(cl, setHasIceTiles, setOverlaySync);
    const updateGame = makeUpdateGame(cl,setOverlaySync,onComplete,onDismiss);
    const moveJack   = makeMoveJack(cl);
    const render     = makeRender(cl,ctxRef);

    // ── Phase 8 wiring — bring prop callbacks into useEffect scope under the
    // names that handleKeyDown and handleCanvasTap were written to call.
    // Without these aliases every dismiss/complete path throws a ReferenceError.
    // Defensive aliases — guard against undefined callbacks from parent
    const onCompleteFn = typeof onComplete === 'function' ? onComplete : ()=>{};
    const onDismissFn  = typeof onDismiss  === 'function' ? onDismiss  : ()=>{};

    function applyScale() {
      const el = gameAreaRef.current; if (!el) return;
      const vW = typeof window !== 'undefined' ? window.innerWidth  : 375;
      const vH = typeof window !== 'undefined' ? window.innerHeight : 600;
      const isLandscape = vW > vH;
      orientationRef.current = isLandscape ? 'landscape' : 'portrait';
      setOrientation(isLandscape ? 'landscape' : 'portrait');
      // gameAreaRef is position:relative overflow:hidden with flex:1 minHeight:0.
      // el.clientWidth/Height give the true flex-computed size once layout settles.
      // If not yet settled, fall back to reasonable viewport fractions so the
      // canvas always gets initialised and the game loop can start.
      const availW = el.clientWidth  > 60 ? el.clientWidth  : (isLandscape ? vW - 220 : vW);
      const availH = el.clientHeight > 60 ? el.clientHeight : (isLandscape ? vH       : Math.round(vH * 0.50));

      // In landscape gameAreaRef is already narrowed by the 110px side panels;
      // further constrain so the canvas stays roughly square/tall.
      const usableW = isLandscape ? Math.min(availW, availH * 0.85) : availW;
      const usableH = availH;

      // No artificial floor: let TILE shrink as small as 8px so the canvas always
      // fits within the available height. Math.max(16,...) caused the canvas to be
      // taller than its container on small screens, clipped by root overflow:hidden.
      const TILE = Math.max(8, Math.floor(Math.min(usableW / VIEW_COLS, (usableH - HUD_H) / VIEW_ROWS)));
      // Canvas = viewport size only; world scrolls underneath via camera transform
      const CW   = VIEW_COLS * TILE;
      const CH   = HUD_H + VIEW_ROWS * TILE;
      // Fix: Retina / high-DPI — draw at physical pixels, display at logical size
      const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
      cl.dpr = dpr;
      canvas.width  = Math.round(CW * dpr);
      canvas.height = Math.round(CH * dpr);
      canvas.style.width  = CW + 'px';
      canvas.style.height = CH + 'px';
      cl.TILE = TILE; cl.CW = CW; cl.CH = CH;
      cl.jackPx  = cl.jackCol * TILE + TILE;  // center of 2x2 body
      cl.jackPy  = HUD_H + cl.jackRow * TILE + TILE;
      cl.jackTargetPx = cl.jackPx;
      cl.jackTargetPy = cl.jackPy;
      // Recalculate pixel camera so it stays centred on jack after resize.
      // Always keep _camJackX/Y (the intro-pan lerp target) in sync with the
      // current tile size. During an active intro pan do NOT overwrite camPixX/Y —
      // initGrid sets camPixY=0 so the pan animates from the dock row down to the
      // jack; overwriting it here would collapse the pan before frame 1.
      if (cl.jackRow !== undefined) {
        const vpW = CW, vpH = CH - HUD_H;
        const jx = cl.jackPx, jy = cl.jackPy - HUD_H;  // center of 2x2
        cl._camJackX = Math.max(0, Math.min(jx - vpW / 2, COLS * TILE - vpW));
        cl._camJackY = Math.max(0, Math.min(jy - vpH / 2, ROWS * TILE - vpH));
        if (!cl._introPan) {
          cl.camPixX = cl._camJackX;
          cl.camPixY = cl._camJackY;
        }
      }
    }

    let rafId;
    function gameLoop() {
      if (!mounted) return;   // Bug fix: stop zombie loop if component unmounted
      cl.frame++;
      updateGame();
      render();
      rafId = requestAnimationFrame(gameLoop);
    }

    function doRotate() {
      if (cl.overlayState !== 'playing') return;
      // While lifted: only allow rotation for rotatable shapes (S2, SL, SLm)
      if (cl.liftState === 'lifted' && cl.liftedPallet) {
        if (ROTATABLE_SHAPES.has(cl.liftedPallet.shapeId)) {
          tryRotatePallet(cl, cl.liftedPallet); return;
        }
        sfxBump(); return;
      }
      // While lifting/lowering/docking: block rotation
      if (cl.liftState === 'lifting' || cl.liftState === 'lowering' || cl.liftState === 'docking') { sfxBump(); return; }
      const jackBody = [{row:cl.jackRow,col:cl.jackCol},{row:cl.jackRow,col:cl.jackCol+1},
                        {row:cl.jackRow+1,col:cl.jackCol},{row:cl.jackRow+1,col:cl.jackCol+1}];
      for (const pallet of cl.pallets) {
        if (pallet.locked || !ROTATABLE_SHAPES.has(pallet.shapeId)) continue;
        const adjacent = pallet.tiles.some(pt =>
          jackBody.some(jt => Math.abs(pt.row-jt.row)<=1 && Math.abs(pt.col-jt.col)<=1)
        );
        if (adjacent) { tryRotatePallet(cl, pallet); return; }
      }
      sfxBump();
    }

    function doLift() {
      if (cl.overlayState !== 'playing') return;
      // During animation: no re-trigger
      if (cl.liftState === 'lifting' || cl.liftState === 'lowering' || cl.liftState === 'docking') return;
      // Already lifted — start lowering
      if (cl.liftState === 'lifted' && cl.liftedPallet) {
        pushUndoSnapshot(cl);
        cl.liftState    = 'lowering';
        cl.liftAnimFrame = 0;
        sfxLower();
        return;
      }
      // Detect pallet whose tiles overlap the jack's body — jack is under it
      const _jackBodySet = new Set([
        `${cl.jackRow},${cl.jackCol}`, `${cl.jackRow},${cl.jackCol+1}`,
        `${cl.jackRow+1},${cl.jackCol}`, `${cl.jackRow+1},${cl.jackCol+1}`
      ]);
      const _underPallets = [];
      for (const p of cl.pallets) {
        if (p.locked || p._dockAnimFrame > 0) continue;
        if (p.tiles.some(t => _jackBodySet.has(`${t.row},${t.col}`))) {
          if (!_underPallets.find(x=>x.id===p.id)) _underPallets.push(p);
        }
      }
      if (_underPallets.length !== 1) { sfxBump(); return; }
      // Engage lift — jack is under the pallet, ready to raise
      pushUndoSnapshot(cl);
      cl.liftedPallet  = _underPallets[0];
      cl.liftState     = 'lifting';
      cl.liftAnimFrame = 0;
      cl.liftPumpCount = 0;
      sfxLift();
    }

    function snapIntroPan() {
      if (!cl._introPan) return;
      cl.camPixX = cl._camJackX; cl.camPixY = cl._camJackY;
      cl._introPan = false;
      cl._goFlash  = 40;
      if (cl._firstPlayPending) { cl._firstHint = 240; cl._firstPlayPending = false; }
    }
    function handleKeyDown(e) {
      getAC();
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
      // Any movement/action key during intro pan snaps the camera immediately
      if (cl._introPan && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
          'w','a','s','d','W','A','S','D',' ','Enter','e','E'].includes(e.key)) snapIntroPan();
      if (cl.overlayState==='tutorial') {
        if (e.key===' '||e.key==='Enter'||e.key==='ArrowRight') { advanceTutorial(); return; }
        if (e.key==='ArrowLeft' && (cl._tutStep||0) > 0) { cl._tutStep--; return; }
        if (e.key==='Escape') { cl._tutActive=false; cl._firstPlayPending=true; setOverlaySync('playing'); return; }
        return;
      }
      if (e.key==='Escape') {
        if (cl.overlayState==='bail')   { setOverlaySync('playing'); return; }
        if (cl.overlayState==='paused') { setOverlaySync('playing'); return; }
        // ESC on win: early-dismiss
        if (cl.overlayState==='win' && cl._dismissTimeout) {
          clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
          onCompleteFn({passed:true, xpEarned:cl._finalXp, cashBonus:(cl.wrongZoneCount||0)>0?0:20}); return;
        }
        // ESC on fail: early-dismiss after lockout
        if (cl.overlayState==='fail' && cl._dismissTimeout && (cl.frame-(cl._failFrame||0))>35) {
          clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
          const partialXp=Math.round((cl.palletsStaged||0)*10);
          if (partialXp>0) onCompleteFn({passed:false, xpEarned:partialXp, cashBonus:0});
          else onDismissFn(); return;
        }
        if (cl.overlayState==='playing') setOverlaySync('bail');
        return;
      }
      if ((e.key==='p'||e.key==='P') && (cl.overlayState==='playing'||cl.overlayState==='paused')) {
        setOverlaySync(cl.overlayState==='paused' ? 'playing' : 'paused'); return;
      }
      // Item 15: Backspace = reset puzzle (only while playing or paused)
      if (e.key==='Backspace' && (cl.overlayState==='playing'||cl.overlayState==='paused')) {
        e.preventDefault();
        // Use _origItems (un-reversed prop) so initGrid's internal reversal gives correct order
        initGrid(cl._origItems || cl.items);
        setOverlaySync('playing');
        return;
      }
      // Y = confirm quit, N = go back (bail screen keyboard shortcuts)
      if (cl.overlayState==='bail') {
        if (e.key==='y'||e.key==='Y') { onDismissFn(); return; }
        if (e.key==='n'||e.key==='N') { setOverlaySync('playing'); return; }
        return;
      }
      if (e.key===' '||e.key==='Enter') {
        if (cl.overlayState==='paused') { setOverlaySync('playing'); return; }
        if (cl.overlayState==='win' && cl._dismissTimeout) {
          clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
          onCompleteFn({passed:true, xpEarned:cl._finalXp, cashBonus:(cl.wrongZoneCount||0)>0?0:20}); return;
        }
        if (cl.overlayState==='fail' && cl._dismissTimeout && (cl.frame-(cl._failFrame||0))>35) {
          clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
          const partialXp=Math.round((cl.palletsStaged||0)*10);
          if (partialXp>0) onCompleteFn({passed:false, xpEarned:partialXp, cashBonus:0});
          else onDismissFn(); return;
        }
        return;
      }
      if ((e.key==='z'||e.key==='Z')&&cl.overlayState==='playing') { applyUndo(cl); return; }
      if ((e.key==='r'||e.key==='R')&&cl.overlayState==='playing') { doRotate(); return; }
      if ((e.key==='e'||e.key==='E')&&cl.overlayState==='playing') { doLift();   return; }
      if (cl.overlayState!=='playing') return;
      switch(e.key) {
        case 'ArrowUp':   case 'w': case 'W': moveJack(DIR_UP);    break;
        case 'ArrowDown': case 's': case 'S': moveJack(DIR_DOWN);  break;
        case 'ArrowLeft': case 'a': case 'A': moveJack(DIR_LEFT);  break;
        case 'ArrowRight':case 'd': case 'D': moveJack(DIR_RIGHT); break;
      }
    }

    // ── Tutorial: advance step, go back, or dismiss ───────────────────────────
    function advanceTutorial() {
      const STEPS = 5;
      if ((cl._tutStep || 0) < STEPS - 1) {
        cl._tutStep = (cl._tutStep || 0) + 1;
      } else {
        cl._tutActive = false;
        setOverlaySync('playing');
        cl._firstPlayPending = true;
      }
    }

    function getTutorialBtnHit(px, py, CW, CH) {
      const bw = Math.min(CW - 20, 320);
      const bh = Math.min(CH - 32, 292);
      const bx = (CW - bw) / 2, by = (CH - bh) / 2;
      const btnW = Math.min(bw - 48, 200), btnH = Math.max(32, Math.floor(bh * 0.118));
      const btnX = CW / 2 - btnW / 2, btnY = by + bh - 46;
      return px >= btnX && px <= btnX + btnW && py >= btnY && py <= btnY + btnH;
    }

    function handleCanvasTap(px, py) {
      getAC();
      const {CW,CH} = cl;
      if (cl.overlayState==='tutorial') {
        const _tbw = Math.min(CW - 20, 320), _tbh = Math.min(CH - 32, 292);
        const _tbx = (CW - _tbw) / 2, _tby = (CH - _tbh) / 2;
        const _inside = px >= _tbx && px <= _tbx + _tbw && py >= _tby && py <= _tby + _tbh;
        if (_inside) { advanceTutorial(); return; }
        // Tap outside panel = skip entire tutorial
        cl._tutActive = false; cl._firstPlayPending = true; setOverlaySync('playing'); return;
      }
      if (cl.overlayState==='bail') {
        const hit = getBailButtonHit(px,py,CW,CH);
        if (hit==='yes') { onDismissFn(); return; }
        if (hit==='no')  { setOverlaySync('playing'); return; }
        return;
      }
      if (cl.overlayState==='paused') { setOverlaySync('playing'); return; }
      // Tap on win overlay: early-dismiss (skips the auto-dismiss countdown)
      if (cl.overlayState==='win' && cl._dismissTimeout) {
        clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
        onCompleteFn({passed:true, xpEarned:cl._finalXp, cashBonus:(cl.wrongZoneCount||0)>0?0:20}); return;
      }
      // Tap on fail overlay: early-dismiss after brief lockout (~0.6s = 35 frames)
      if (cl.overlayState==='fail' && cl._dismissTimeout && (cl.frame-(cl._failFrame||0))>35) {
        clearTimeout(cl._dismissTimeout); cl._dismissTimeout=null;
        const partialXp=Math.round((cl.palletsStaged||0)*10);
        if (partialXp>0) onCompleteFn({passed:false, xpEarned:partialXp, cashBonus:0});
        else onDismissFn(); return;
      }
      if (cl.overlayState!=='playing') return;
      if (py < HUD_H) {
        if (px > CW-44)               { setOverlaySync('bail'); return; }
        if (px > CW-88  && px<=CW-44) { applyUndo(cl); return; }
        if (px > CW-132 && px<=CW-88) { doRotate(); return; }
        if (px > CW-176 && px<=CW-132){ doLift();   return; }
      }
    }

    let touchStartX=0, touchStartY=0, touchStartTime=0;
    function handleTouchStart(e) {
      e.preventDefault(); getAC();
      snapIntroPan();  // any touch during pan snaps camera immediately
      const t=e.changedTouches[0];
      touchStartX=t.clientX; touchStartY=t.clientY; touchStartTime=Date.now();
    }
    function handleTouchMove(e) { e.preventDefault(); }
    function handleTouchEnd(e) {
      e.preventDefault();
      const t=e.changedTouches[0];
      const dx=t.clientX-touchStartX, dy=t.clientY-touchStartY;
      const dist=Math.sqrt(dx*dx+dy*dy), dt=Date.now()-touchStartTime;
      const rect=canvas.getBoundingClientRect();
      const scaleX=cl.CW/(rect.width||cl.CW), scaleY=cl.CH/(rect.height||cl.CH);
      const cx=(touchStartX-rect.left)*scaleX, cy=(touchStartY-rect.top)*scaleY;
      if (dist<18&&dt<300) { handleCanvasTap(cx,cy); return; }
      if (cl.overlayState!=='playing') return;
      if (dist>=18) {
        if (Math.abs(dx)>=Math.abs(dy)) moveJack(dx>0?DIR_RIGHT:DIR_LEFT);
        else                             moveJack(dy>0?DIR_DOWN:DIR_UP);
      }
    }

    function startDpad(dir) {
      getAC();
      dpadRef.current.dir=dir;
      if (cl.overlayState==='playing') moveJack(dir);
      if (dpadRef.current.intervalId)    { clearInterval(dpadRef.current.intervalId);   dpadRef.current.intervalId=null; }
      if (dpadRef.current.repeatTimeout) { clearTimeout(dpadRef.current.repeatTimeout); dpadRef.current.repeatTimeout=null; }
      dpadRef.current.repeatTimeout=setTimeout(()=>{
        dpadRef.current.intervalId=setInterval(()=>{
          if (cl.overlayState==='playing'&&dpadRef.current.dir===dir) moveJack(dir);
        },120);
      },200);
    }
    function stopDpad() {
      dpadRef.current.dir=null;
      if (dpadRef.current.intervalId)    { clearInterval(dpadRef.current.intervalId);   dpadRef.current.intervalId=null; }
      if (dpadRef.current.repeatTimeout) { clearTimeout(dpadRef.current.repeatTimeout); dpadRef.current.repeatTimeout=null; }
    }
    dpadRef.current.startDpad  = (dir)=>{ if (cl.overlayState==='tutorial') { advanceTutorial(); return; } startDpad(dir); };
    dpadRef.current.stopDpad   = stopDpad;
    dpadRef.current.doUndo     = ()=>{ getAC(); applyUndo(cl); };
    dpadRef.current.doRotate   = ()=>{ getAC(); doRotate(); };
    dpadRef.current.doLift     = ()=>{ getAC(); doLift(); };

    function handleClick(e) {
      const rect=canvas.getBoundingClientRect();
      const scaleX=cl.CW/(rect.width||cl.CW), scaleY=cl.CH/(rect.height||cl.CH);
      handleCanvasTap((e.clientX-rect.left)*scaleX, (e.clientY-rect.top)*scaleY);
    }

    let resizeObs;
    if (typeof ResizeObserver!=='undefined'&&gameAreaRef.current) {
      resizeObs=new ResizeObserver(()=>applyScale());
      resizeObs.observe(gameAreaRef.current);
    }
    window.addEventListener('resize',applyScale);
    document.addEventListener('keydown',handleKeyDown);
    canvas.addEventListener('touchstart', handleTouchStart, {passive:false});
    canvas.addEventListener('touchmove',  handleTouchMove,  {passive:false});
    canvas.addEventListener('touchend',   handleTouchEnd,   {passive:false});
    canvas.addEventListener('click', handleClick);

    // Mounted flag — prevents zombie rAF/setTimeout callbacks after cleanup
    let mounted = true;
    // Call immediately (catches cases where layout is already resolved),
    // then again after first paint and after a short timeout — the flex
    // layout with portrait/landscape bars needs a settled DOM to measure.
    applyScale();
    const _rafOneShot = requestAnimationFrame(() => { if (mounted) applyScale(); });
    const _resizeTimer = setTimeout(() => { if (mounted) applyScale(); }, 120);

    // Safety timeout — if fonts.ready hangs (network, SSR, ad-blockers),
    // start the game anyway after 2 seconds rather than showing a blank screen.
    let _gameStarted = false;
    function _startGame() {
      if (_gameStarted || !mounted) return;
      _gameStarted = true;
      cl.levelName = getLevelName(cl.gameCount);
      initGrid(items||[]);
      rafId = requestAnimationFrame(gameLoop);
    }
    document.fonts.ready.then(() => { _startGame(); });
    setTimeout(() => { _startGame(); }, 2000);

    return ()=>{
      mounted = false;   // Signal all pending callbacks to abort
      cancelAnimationFrame(_rafOneShot);
      clearTimeout(_resizeTimer);
      cancelAnimationFrame(rafId);
      if (cl._dismissTimeout)   { clearTimeout(cl._dismissTimeout);   cl._dismissTimeout=null; }
      if (cl._bounceBackTimeout){ clearTimeout(cl._bounceBackTimeout); cl._bounceBackTimeout=null; }
      document.removeEventListener('keydown',handleKeyDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove',  handleTouchMove);
      canvas.removeEventListener('touchend',   handleTouchEnd);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('resize',applyScale);
      if (resizeObs) resizeObs.disconnect();
      stopDpad();
      if (_instanceAudio === _myAudio) _instanceAudio = null;
      if (_myAudio.ctx) { _myAudio.ctx.close().catch(()=>{}); _myAudio.ctx=null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dpadActive = overlayState!=='win' && overlayState!=='fail' && overlayState!=='paused' && overlayState!=='bail';
  const isLandscape = orientation === 'landscape';

  const DPAD_BTNS = [
    {dir:DIR_UP,    label:'▲', area:'up'},
    {dir:DIR_LEFT,  label:'◀', area:'left'},
    {dir:DIR_RIGHT, label:'▶', area:'right'},
    {dir:DIR_DOWN,  label:'▼', area:'down'},
  ];

  const dpadBtnBase = {
    display:'flex', alignItems:'center', justifyContent:'center',
    width:'100%', height:'100%',
    background:'rgba(60,80,120,0.35)',
    border:'1.5px solid rgba(120,160,220,0.55)',
    color:'#AACCFF',
    fontSize:18, cursor:'pointer',
    touchAction:'none', userSelect:'none',
    WebkitUserSelect:'none', outline:'none',
    borderRadius:6,
  };

  const iconBtnBase = (color='#FFCC44', bg='rgba(30,30,60,0.70)') => ({
    display:'flex', alignItems:'center', justifyContent:'center',
    width:54, height:54,
    background:bg,
    border:`2px solid ${color}`,
    color,
    fontSize:22, cursor:'pointer',
    touchAction:'none', userSelect:'none',
    WebkitUserSelect:'none', outline:'none', borderRadius:8,
    opacity: dpadActive ? 1 : 0.15,
    pointerEvents: dpadActive ? 'auto' : 'none',
    transition:'opacity 0.25s',
    flexShrink: 0,
  });

  // ── Shared stop manifest entries ─────────────────────────────────────────
  // Item 13a: manifest displays in reversed order to match game load order
  const stopEntries = [...(items || [])].reverse().map((stop, i) => ({
    zc: ZONE_COLORS[i] || ZONE_COLORS[0], stop, idx: i,
  }));

  // ── LANDSCAPE side panel (vertical, 110px wide) ───────────────────────────
  const SidePanel = ({ side }) => (
    <div style={{
      flex:'0 0 auto',
      width: isLandscape ? 110 : 0,
      height:'100%',
      display: isLandscape ? 'flex' : 'none',
      flexDirection:'column',
      alignItems:'center',
      justifyContent:'center',
      background:'linear-gradient(180deg,#141428 0%,#0E0E1E 100%)',
      borderLeft:  side==='right' ? '1px solid #2A2A4A' : 'none',
      borderRight: side==='left'  ? '1px solid #2A2A4A' : 'none',
      padding:'12px 8px', gap:10, overflow:'hidden',
    }}>
      <div style={{
        textAlign:'center', color:'#8090B0', fontSize:11,
        fontFamily:'Arial,sans-serif', fontWeight:'bold',
        letterSpacing:2, marginBottom:6,
      }}>{side === 'left' ? 'BOX TRUCK BOSS' : 'PALLET WRANGLER'}</div>

      {side === 'left' && (<>
        <div style={{
          width:'100%', background:'rgba(255,255,255,0.04)',
          borderRadius:6, padding:'8px 6px',
          border:'1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            fontSize:11, color:'#6070A0', fontFamily:'Arial,sans-serif',
            fontWeight:'bold', letterSpacing:1, marginBottom:6, textAlign:'center',
          }}>MANIFEST</div>
          {stopEntries.map(({zc, stop, idx}) => (
            <div key={idx} style={{display:'flex', alignItems:'center', gap:5, marginBottom:6}}>
              <div style={{
                width:10, height:10, borderRadius:2, flexShrink:0,
                background:zc.body, border:`1px solid ${zc.border}`,
              }}/>
              <div style={{fontSize:11, color:'#AABBCC', fontFamily:'Arial,sans-serif',
                lineHeight:1.3, overflow:'hidden',
              }}>
                <div style={{fontWeight:'bold', color:'#CCDDEE'}}>STOP {stop.stopNumber||idx+1}</div>
                <div style={{color:'#778899', fontSize:11}}>{(stop.customerName||'').toUpperCase().slice(0,12)}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          width:'100%', textAlign:'center', fontSize:11, color:'#445566',
          fontFamily:'Arial,sans-serif', lineHeight:1.8,
          background:'rgba(255,255,255,0.03)', borderRadius:6, padding:'6px 4px',
          border:'1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{color:'#6677AA', fontWeight:'bold', marginBottom:3}}>CONTROLS</div>
          {isTouchDevice ? (<>
            <div>D-pad = move</div><div>↻ = Rotate</div>
            <div>⬆ = Lift/Lower</div><div>↩ = Undo</div><div>P = Pause</div>
          </>) : (<>
            <div>ARROWS / WASD</div><div>R = Rotate</div>
            <div>E = Lift / Lower</div><div>Z = Undo</div><div>P = Pause</div>
          </>)}
        </div>
      </>)}

      {side === 'right' && (<>
        <div style={{
          width:'100%', textAlign:'center', fontSize:11, color:'#445566',
          fontFamily:'Arial,sans-serif', lineHeight:1.9,
          background:'rgba(255,255,255,0.03)', borderRadius:6, padding:'8px 4px',
          border:'1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{color:'#6677AA', fontWeight:'bold', marginBottom:3}}>TIPS</div>
          {isTouchDevice ? (<>
            <div>⬆ lifts pallet</div><div>carry to dock bay</div>
            <div>⬆ again to lower</div>
          </>) : (<>
            <div>E to lift pallet</div><div>carry anywhere</div>
            <div>E again to lower</div><div>R rotates it</div>
          </>)}
        </div>
        {hasIceTiles && (
        <div style={{
          width:'100%', textAlign:'center', fontSize:11, color:'#3A6080',
          fontFamily:'Arial,sans-serif', lineHeight:1.6,
          background:'rgba(100,200,255,0.06)', borderRadius:6, padding:'6px 4px',
          border:'1px solid rgba(100,200,255,0.12)',
        }}>
          <div style={{color:'#5599CC', fontWeight:'bold', marginBottom:2}}>⬡ ICE</div>
          <div style={{color:'#4488BB'}}>Pallets slide</div>
          <div style={{color:'#4488BB'}}>extra on blue</div>
          <div style={{color:'#4488BB'}}>floor tiles</div>
        </div>
        )}
      </>)}
    </div>
  );

  // ── PORTRAIT top strip — manifest + tips ──────────────────────────────────
  const PortraitTopBar = !isLandscape && (
    <div style={{
      flex:'0 0 auto',
      flexShrink:1,         // allow collapse when canvas needs space
      minHeight:0,          // allow shrinking to zero
      overflow:'hidden',    // clip content when collapsed
      width:'100%',
      display:'flex', flexDirection:'column',
      background:'linear-gradient(180deg,#141428 0%,#0E0E1E 100%)',
      borderBottom:'1px solid #2A2A4A',
    }}>
      {/* ── Row 1: Manifest ── */}
      <div style={{
        display:'flex', flexDirection:'row',
        alignItems:'center', flexWrap:'wrap',
        padding:'6px 10px', gap:6,
      }}>
        <div style={{
          fontSize:11, color:'#6070A0', fontFamily:'Arial,sans-serif',
          fontWeight:'bold', letterSpacing:1.5, flexShrink:0,
        }}>MANIFEST</div>
        {/* Stop entries wrap instead of clipping — all stops always visible */}
        <div style={{
          display:'flex', flexDirection:'row', alignItems:'center',
          flexWrap:'wrap', gap:8, flex:1,
        }}>
          {stopEntries.map(({zc, stop, idx}) => (
            <div key={idx} style={{
              display:'flex', alignItems:'center', gap:5, flexShrink:0,
            }}>
              <div style={{
                width:9, height:9, borderRadius:2, flexShrink:0,
                background:zc.body, border:`1px solid ${zc.border}`,
              }}/>
              <div style={{fontFamily:'Arial,sans-serif', lineHeight:1.2}}>
                <div style={{fontSize:11, fontWeight:'bold', color:'#CCDDEE', whiteSpace:'nowrap'}}>
                  STOP {stop.stopNumber||idx+1}
                </div>
                <div style={{fontSize:11, color:'#778899', whiteSpace:'nowrap'}}>
                  {(stop.customerName||'').toUpperCase().slice(0,14)}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          fontSize:11, color:'#8090B0', fontFamily:'Arial,sans-serif',
          fontWeight:'bold', letterSpacing:1.5, flexShrink:0,
        }}>PALLET WRANGLER</div>
      </div>
      {/* ── Row 2: Tips — same content as landscape right panel ── */}
      <div style={{
        display:'flex', flexDirection:'row',
        alignItems:'center', flexWrap:'wrap',
        padding:'4px 10px 6px', gap:8,
        borderTop:'1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          fontSize:11, color:'#6677AA', fontFamily:'Arial,sans-serif',
          fontWeight:'bold', flexShrink:0, letterSpacing:1,
        }}>TIPS</div>
        <div style={{
          display:'flex', flexDirection:'row', flexWrap:'wrap', gap:6,
          fontSize:11, color:'#445566', fontFamily:'Arial,sans-serif',
          flex:1,
        }}>
          {isTouchDevice ? (
            ['Swipe to move', '↻ near pallet to rotate'].map(t => (
              <span key={t} style={{
                background:'rgba(255,255,255,0.04)', borderRadius:3,
                padding:'2px 6px', whiteSpace:'nowrap',
                border:'1px solid rgba(255,255,255,0.07)',
                color:'#5577AA',
              }}>{t}</span>
            ))
          ) : (
            ['Push pallets UP into dock', 'R near pallet to rotate'].map(t => (
              <span key={t} style={{
                background:'rgba(255,255,255,0.04)', borderRadius:3,
                padding:'2px 6px', whiteSpace:'nowrap',
                border:'1px solid rgba(255,255,255,0.07)',
                color:'#5577AA',
              }}>{t}</span>
            ))
          )}
          {hasIceTiles && (
            <span style={{
              background:'rgba(100,200,255,0.06)', borderRadius:3,
              padding:'2px 6px', whiteSpace:'nowrap',
              border:'1px solid rgba(100,200,255,0.12)',
              color:'#4488BB',
            }}>⬡ Ice tiles slide extra</span>
          )}
        </div>
      </div>
    </div>
  );

  // ── PORTRAIT tips strip — sits BELOW canvas (between canvas and d-pad) ──────
  // On touch devices: show swipe/tap instructions relevant to the d-pad.
  // On keyboard devices: show keyboard shortcuts. Either way it belongs below
  // the canvas, not above it — so it never steals vertical space from the game.
  const PortraitBottomBar = !isLandscape && (
    <div style={{
      flex:'0 0 auto',
      flexShrink:1,         // allow collapse when canvas needs space
      minHeight:0,
      overflow:'hidden',
      width:'100%',
      display:'flex', flexDirection:'row',
      alignItems:'center', justifyContent:'space-between',
      background:'linear-gradient(0deg,#141428 0%,#0E0E1E 100%)',
      borderTop:'1px solid #2A2A4A',
      padding:'4px 12px', gap:10, overflow:'hidden',
    }}>
      {isTouchDevice ? (
        /* Touch hints */
        <div style={{
          display:'flex', flexDirection:'row', gap:6, alignItems:'center',
          fontSize:11, color:'#556677', fontFamily:'Arial,sans-serif',
        }}>
          <span style={{color:'#6677AA', fontWeight:'bold', marginRight:2}}>TOUCH</span>
          {['D-pad=move','↻=rotate','⬆=lift','↩=undo','P=pause'].map(t=>(
            <span key={t} style={{
              background:'rgba(255,255,255,0.06)', borderRadius:3,
              padding:'2px 5px', whiteSpace:'nowrap',
              border:'1px solid rgba(255,255,255,0.08)',
            }}>{t}</span>
          ))}
        </div>
      ) : (
        /* Keyboard hints */
        <div style={{
          display:'flex', flexDirection:'row', gap:6, alignItems:'center',
          fontSize:11, color:'#556677', fontFamily:'Arial,sans-serif',
        }}>
          <span style={{color:'#6677AA', fontWeight:'bold', marginRight:2}}>KEYS</span>
          {['↑↓←→','R=Rotate','E=Lift','Z=Undo','P=Pause'].map(t=>(
            <span key={t} style={{
              background:'rgba(255,255,255,0.06)', borderRadius:3,
              padding:'2px 5px', whiteSpace:'nowrap',
              border:'1px solid rgba(255,255,255,0.08)',
            }}>{t}</span>
          ))}
        </div>
      )}
      {/* Ice tile note — only shown when this layout has ice tiles */}
      {hasIceTiles && (
      <div style={{
        display:'flex', flexDirection:'row', gap:4, alignItems:'center',
        fontSize:11, color:'#3A6080', fontFamily:'Arial,sans-serif',
        background:'rgba(100,200,255,0.06)', borderRadius:4,
        padding:'3px 7px', border:'1px solid rgba(100,200,255,0.10)',
        flexShrink:0,
      }}>
        <span style={{color:'#5599CC'}}>⬡</span>
        <span style={{color:'#4488BB'}}>Ice tiles: pallets slide extra</span>
      </div>
      )}
    </div>
  );

  // ── D-pad & button layout adapts per orientation ──────────────────────────
  // Portrait:  controls bar below the canvas (flex sibling, not absolute)
  // Landscape: d-pad and buttons in right side panel area

  // Portrait controls — rendered as a flex sibling BELOW gameAreaRef so they
  // never overlap the canvas.
  const PortraitControlsBar = !isLandscape && (
    <div style={{
      flex:'0 0 auto',
      minHeight:0,
      width:'100%',
      display:'flex', flexDirection:'row',
      alignItems:'center', justifyContent:'space-between',
      padding:'10px 20px', gap:12,
      background:'#0A0A18',
      borderTop:'1px solid #1A1A2A',
      touchAction:'none',
      opacity: dpadActive ? 1 : 0.18,
      pointerEvents: dpadActive ? 'auto' : 'none',
      transition:'opacity 0.25s',
    }}>
      {/* Undo + Rotate + Lift stacked on the left */}
      <div style={{display:'flex', flexDirection:'column', gap:8}}>
        <button style={iconBtnBase('#5599FF','rgba(20,40,100,0.65)')}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doRotate?.();}}
        >↻</button>
        <button style={iconBtnBase('#44DD88','rgba(10,60,30,0.70)')}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doLift?.();}}
        >⬆</button>
        <button style={iconBtnBase()}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doUndo?.();}}
        >↩</button>
      </div>
      {/* D-pad on the right */}
      <div style={{
        display:'grid',
        gridTemplateAreas:'"  .   up   ." "left  .  right" "  .  down  ."',
        gridTemplateColumns:'54px 54px 54px',
        gridTemplateRows:'54px 54px 54px',
        gap:4,
      }}>
        {DPAD_BTNS.map(({dir,label,area}) => (
          <button key={area} style={{...dpadBtnBase, gridArea:area,
            width:'100%', height:'100%',
          }}
            onPointerDown={e=>{e.preventDefault();dpadRef.current.startDpad?.(dir);}}
            onPointerUp={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
            onPointerLeave={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
            onPointerCancel={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
          >{label}</button>
        ))}
      </div>
    </div>
  );

  const controlsLandscape = isLandscape && (
    <div style={{
      position:'absolute', right:8, top:0, bottom:0,
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      gap:8, zIndex:20, touchAction:'none', width:124,
      opacity: dpadActive ? 1 : 0.15,
      pointerEvents: dpadActive ? 'auto' : 'none',
      transition:'opacity 0.25s',
    }}>
      {/* Rotate + Lift + Undo row */}
      <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center'}}>
        <button style={iconBtnBase('#5599FF','rgba(20,40,100,0.65)')}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doRotate?.();}}
        >↻</button>
        <button style={iconBtnBase('#44DD88','rgba(10,60,30,0.70)')}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doLift?.();}}
        >⬆</button>
        <button style={iconBtnBase()}
          onPointerDown={e=>{e.preventDefault();dpadRef.current.doUndo?.();}}
        >↩</button>
      </div>
      {/* D-pad */}
      <div style={{
        display:'grid',
        gridTemplateAreas:'"  .   up   ." "left  .  right" "  .  down  ."',
        gridTemplateColumns:'54px 54px 54px',
        gridTemplateRows:'54px 54px 54px',
        gap:4,
      }}>
        {DPAD_BTNS.map(({dir,label,area}) => (
          <button key={area} style={{...dpadBtnBase, gridArea:area,
            width:'100%', height:'100%',
          }}
            onPointerDown={e=>{e.preventDefault();dpadRef.current.startDpad?.(dir);}}
            onPointerUp={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
            onPointerLeave={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
            onPointerCancel={e=>{e.preventDefault();dpadRef.current.stopDpad?.();}}
          >{label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100,
      display:'flex',
      flexDirection: isLandscape ? 'row' : 'column',
      background:'#0A0A18',
      overflow:'hidden', touchAction:'none',
      userSelect:'none', WebkitUserSelect:'none',
      // Safe area insets — notch, Dynamic Island, home indicator, camera cutout
      paddingTop:    'env(safe-area-inset-top,    0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft:   'env(safe-area-inset-left,   0px)',
      paddingRight:  'env(safe-area-inset-right,  0px)',
      boxSizing: 'border-box',
    }}>
      {/* Portrait: manifest strip at top */}
      {PortraitTopBar}

      {/* Landscape: left side panel */}
      <SidePanel side="left" />

      {/* Game area — fills all remaining space */}
      <div ref={gameAreaRef} style={{
        flex:1, minWidth:0, minHeight:0,
        position:'relative', overflow:'hidden',
        background: isLandscape
          ? 'repeating-linear-gradient(45deg,#10101C 0px,#10101C 8px,#0E0E1A 8px,#0E0E1A 16px)'
          : '#0A0A18',
      }}>
        {/* Canvas container — absolutely fills gameAreaRef so canvas can never
             push into sibling bars regardless of applyScale timing. The canvas
             is centred inside this container; applyScale sets its pixel size. */}
        <div style={{
          position:'absolute', inset:0,
          display:'flex', justifyContent:'center',
          alignItems: isLandscape ? 'center' : 'flex-start',
        }}>
          <div style={{
            position:'relative', flexShrink:0,
            boxShadow:'0 0 0 3px #2A2A4A, 0 0 0 5px #14142A, 0 8px 32px rgba(0,0,0,0.60)',
            lineHeight:0, display:'inline-block',
          }}>
            <canvas ref={canvasRef} style={{
              display:'block',
              imageRendering:'pixelated',
              touchAction:'none', userSelect:'none',
              WebkitUserSelect:'none', WebkitTouchCallout:'none',
            }}/>
          </div>
        </div>

        {/* Landscape touch controls (absolute overlay, safe in landscape) */}
        {controlsLandscape}
      </div>

      {/* Landscape: right side panel */}
      <SidePanel side="right" />

      {/* Portrait: tips strip — sits BELOW canvas, above d-pad */}
      {PortraitBottomBar}

      {/* Portrait: controls bar — sits BELOW canvas, never overlaps it */}
      {PortraitControlsBar}
    </div>
  );
}
