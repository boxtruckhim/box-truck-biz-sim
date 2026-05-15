// =============================================================================
//  CargoTetris.jsx  —  Box Truck Boss  |  Cargo Loading Minigame  (Tetris Mode)
//  Integration: <CargoTetris onComplete={({ passed, xpEarned }) => ...} />
// =============================================================================

import { useState, useEffect, useReducer, useCallback, useRef, useMemo, memo } from 'react';

const DEV = false;

// =============================================================================
//  SECTION 1 — CONSTANTS
// =============================================================================

export const COLS           = 4;
export const ROWS           = 13;
export const TOTAL_CELLS    = COLS * ROWS;   // 52 cells — full open grid

export const WEIGHT_CAP_LBS      = 9500;
export const WEIGHT_GEN_CAP_LBS  = 9200;
export const FRONT_ROWS          = 8;        // bottom 8 rows = cab/front zone for weight split
// PHYSICAL MODEL: 26-ft box truck, 4×13 grid, each cell = 24"×24".
// Rear door at TOP (row 0), cab wall at BOTTOM (row 12).
// All 52 cells are placeable — open grid, no reserved rows.
export const MAX_PALLETS    = 12;
export const MAX_LOADS      = 3;

export const HARD_TIMEOUT_MS    = 120_000;  // 2 minutes (more generous with falling mechanic)
export const BONUS_WINDOW_SEC   = 75;
export const MAX_TIME_BONUS_XP  = 60;
export const BASE_PASS_XP       = 100;
export const BALANCE_BONUS_XP   = 20;
export const BALANCE_PEN_SOFT   = -15;
export const BALANCE_PEN_HARD   = -30;
export const FILL_BONUS_XP      = 20;       // ≥90% fill → tight pack bonus
export const FILL_PEN_LOOSE     = -10;      // 50–69% → loose pack penalty
export const FILL_PEN_SPARSE    = -20;      // <50% → sparse load penalty
// Max XP = 100 + 60 + 20 + 20 = 200

export const GRAVITY_BASE_MS    = 850;      // starting fall speed
export const GRAVITY_STEP_MS    = 70;       // speed-up per 3 pieces locked
export const GRAVITY_MIN_MS     = 180;      // fastest gravity

// Blueprint color palette
export const BP = {
  bg:       '#03040C',
  line:     '#44B2E4',
  mid:      '#64B8E8',
  dim:      '#3A7AB0',
  dimmer:   '#0A1828',
  offWhite: '#E8F4FC',
  floor:    '#06080F',
  loadA:    '#2EA86A',
  loadB:    '#E0A020',
  loadC:    '#C0392B',
  warn:     '#E05020',
  good:     '#2EA86A',
};

export const STOP_COLORS = [BP.loadA, BP.loadB, BP.loadC];
export const STOP_LABELS = ['STOP 1', 'STOP 2', 'STOP 3'];

// =============================================================================
//  SECTION 2 — SHAPE DEFINITIONS
// =============================================================================

const SHAPE_DEFS = {
  S1:  { cells: [[0,0]],                         name: 'Small Crate',       canRotate: false },
  S2:  { cells: [[0,0],[0,1]],                   name: 'Half Pallet',       canRotate: true  },
  S4:  { cells: [[0,0],[1,0],[0,1],[1,1]],        name: 'Standard Pallet',   canRotate: false },
  SL:  { cells: [[0,0],[0,1],[1,1]],              name: 'Irregular Freight', canRotate: true  },
  SLm: { cells: [[1,0],[0,1],[1,1]],              name: 'Irregular Freight', canRotate: true  },
};

export function rotateCells90CW(cells) {
  const rotated  = cells.map(([c, r]) => [r, -c]);
  const minC     = Math.min(...rotated.map(([c]) => c));
  const minR     = Math.min(...rotated.map(([, r]) => r));
  const normalised = rotated.map(([c, r]) => [c - minC, r - minR]);
  return normalised.sort(([c1, r1], [c2, r2]) => r1 - r2 || c1 - c2);
}

export function getCells(shapeId, rotation = 0) {
  const base  = SHAPE_DEFS[shapeId].cells;
  let   cells = base;
  const steps = (rotation / 90) % 4;
  for (let i = 0; i < steps; i++) cells = rotateCells90CW(cells);
  return cells;
}

export function getBoundingBox(cells) {
  const maxC = Math.max(...cells.map(([c]) => c));
  const maxR = Math.max(...cells.map(([, r]) => r));
  return { cols: maxC + 1, rows: maxR + 1 };
}

export function canRotateShape(shapeId) {
  return SHAPE_DEFS[shapeId]?.canRotate ?? false;
}

// =============================================================================
//  SECTION 3 — MANIFEST GENERATION
// =============================================================================

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ITEM_TYPE_TO_SHAPE = {
  'standard_pallet': 'S4', 'standard': 'S4', 'pallet': 'S4', 's4': 'S4',
  'half_pallet': 'S2', 'half': 'S2', 'long_pallet': 'S2', 'long': 'S2', 's2': 'S2',
  'irregular': 'SL', 'l_pallet': 'SL', 'l-pallet': 'SL', 'l': 'SL', 'sl': 'SL',
  'l_pallet_mirror': 'SLm', 'l-pallet_mirror': 'SLm', 'l_mirror': 'SLm', 'slm': 'SLm',
  'small_crate': 'S1', 'crate': 'S1', 's1': 'S1',
};

function itemTypeToShapeId(itemType) {
  return ITEM_TYPE_TO_SHAPE[(itemType ?? '').toLowerCase()] ?? 'S4';
}

const DEV_WEIGHT_RANGES = {
  S1: [50, 300], S2: [150, 700], S4: [300, 1800], SL: [200, 900], SLm: [200, 900],
};

function devRandLoads() {
  const SHAPES   = ['S4','S4','S4','S2','S2','SL','SLm','S1'];
  const numStops = randInt(1, MAX_LOADS);
  const loads    = [];
  let   grandTotal = 0;
  for (let s = 1; s <= numStops; s++) {
    const numItems = randInt(1, 3);
    const items    = [];
    let   stopW    = 0;
    for (let i = 0; i < numItems; i++) {
      const shapeId    = SHAPES[randInt(0, SHAPES.length - 1)];
      const [wMin, wMax] = DEV_WEIGHT_RANGES[shapeId];
      const weightEach = Math.round(randInt(wMin, wMax) / 50) * 50;
      const count      = randInt(1, 2);
      if (grandTotal + stopW + weightEach * count > WEIGHT_GEN_CAP_LBS) break;
      items.push({ itemType: shapeId.toLowerCase(), count, weightEachLbs: weightEach, label: '' });
      stopW += weightEach * count;
    }
    if (items.length === 0) continue;
    grandTotal += stopW;
    loads.push({ stopNumber: s, customerName: `DEV STOP ${s}`, items, totalWeightLbs: stopW });
  }
  return loads.length > 0 ? loads : [{
    stopNumber: 1, customerName: 'DEV STOP 1',
    items: [{ itemType: 's4', count: 4, weightEachLbs: 800, label: '' }],
    totalWeightLbs: 3200,
  }];
}

export function generateManifest(loads) {
  if (!loads || !Array.isArray(loads) || loads.length === 0) {
    loads = devRandLoads();
  }
  const orderedStops = [...loads].sort((a, b) => b.stopNumber - a.stopNumber);
  const pallets  = [];
  let   globalIdx = 0;
  orderedStops.forEach((stop, zoneIdx) => {
    const stopNum = stop.stopNumber;
    const color   = STOP_COLORS[(stopNum - 1) % STOP_COLORS.length];
    const label   = STOP_LABELS[(stopNum - 1) % STOP_LABELS.length] ?? `STOP ${stopNum}`;
    stop.items.forEach(item => {
      const shapeId    = itemTypeToShapeId(item.itemType);
      const count      = Math.max(1, item.count ?? 1);
      const weightEach = item.weightEachLbs ?? 400;
      const tileLabel  = item.label ?? label;
      for (let i = 0; i < count; i++) {
        pallets.push({
          id: `p${globalIdx}`, shapeId,
          cells:        getCells(shapeId, 0),
          weightLbs:    weightEach,
          loadIndex:    zoneIdx,
          stopNumber:   stopNum,
          color, label: tileLabel, stopLabel: label,
          customerName: stop.customerName ?? '',
          placed:       false, anchorCol: null, anchorRow: null, rotation: 0,
        });
        globalIdx++;
      }
    });
  });
  return pallets;
}

export function validateLoads(loads) {
  const errors = [];
  if (!Array.isArray(loads) || loads.length === 0) {
    errors.push('loads must be a non-empty array');
    return { valid: false, errors };
  }
  if (loads.length > MAX_LOADS) errors.push(`loads has ${loads.length} stops; max is ${MAX_LOADS}`);
  loads.forEach((stop, i) => {
    if (typeof stop.stopNumber !== 'number') errors.push(`stop[${i}].stopNumber must be a number`);
    if (!Array.isArray(stop.items) || stop.items.length === 0) errors.push(`stop[${i}].items must be a non-empty array`);
  });
  return { valid: errors.length === 0, errors };
}

// =============================================================================
//  SECTION 4 — PLACEMENT UTILITIES
// =============================================================================

export function cellIndex(col, row) { return row * COLS + col; }
export function indexToCell(idx)    { return { col: idx % COLS, row: Math.floor(idx / COLS) }; }

export function getAbsoluteCells(cells, anchorCol, anchorRow) {
  const abs = cells.map(([dc, dr]) => [anchorCol + dc, anchorRow + dr]);
  for (const [c, r] of abs) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  }
  return abs;
}

// Open-grid checkPlacement — no zone restriction, just bounds + collision.
export function checkPlacement(cells, anchorCol, anchorRow, grid) {
  const abs = getAbsoluteCells(cells, anchorCol, anchorRow);
  if (!abs) return { valid: false, reason: 'OUT_OF_BOUNDS' };
  for (const [c, r] of abs) {
    if (grid[cellIndex(c, r)] !== null) return { valid: false, reason: 'COLLISION' };
  }
  return { valid: true, reason: null };
}

// Compute the lowest row a piece can reach via gravity from its current position.
export function calcDropRow(cells, anchorCol, startRow, grid) {
  let row = startRow;
  while (true) {
    const nextAbs = getAbsoluteCells(cells, anchorCol, row + 1);
    if (!nextAbs) return row; // hits bottom wall
    let blocked = false;
    for (const [c, r] of nextAbs) {
      if (grid[cellIndex(c, r)] !== null) { blocked = true; break; }
    }
    if (blocked) return row;
    row++;
  }
}

export function placePallet(pallet, anchorCol, anchorRow, grid) {
  const newGrid = [...grid];
  const cells   = getCells(pallet.shapeId, pallet.rotation);
  const abs     = getAbsoluteCells(cells, anchorCol, anchorRow);
  if (!abs) return newGrid;
  for (const [c, r] of abs) newGrid[cellIndex(c, r)] = pallet.id;
  return newGrid;
}

export function removePallet(palletId, grid) {
  return grid.map(cell => (cell === palletId ? null : cell));
}

// =============================================================================
//  SECTION 5 — WEIGHT & BALANCE UTILITIES
// =============================================================================

export function calcWeights(placedPallets) {
  let total = 0, front = 0, rear = 0;
  for (const pallet of placedPallets) {
    total += pallet.weightLbs;
    const row = pallet.anchorRow ?? ROWS - 1;
    if (row >= ROWS - FRONT_ROWS) { front += pallet.weightLbs; }
    else                          { rear  += pallet.weightLbs; }
  }
  return { total, front, rear };
}

export function calcBalance(front, total) {
  if (total === 0) return { rating: 'N/A', xpMod: 0, penaltyFlag: null };
  const pct = front / total;
  if (pct >= 0.60) return { rating: 'OPTIMAL',    xpMod: BALANCE_BONUS_XP,  penaltyFlag: null   };
  if (pct >= 0.50) return { rating: 'ACCEPTABLE', xpMod: 0,                  penaltyFlag: null   };
  if (pct >= 0.40) return { rating: 'REAR HEAVY', xpMod: BALANCE_PEN_SOFT,   penaltyFlag: 'SOFT' };
  return               { rating: 'DANGEROUS',  xpMod: BALANCE_PEN_HARD,   penaltyFlag: 'HARD' };
}

// calcPackScore: scores how completely the player packed every row
// BELOW their topmost piece. Empty rows above the load are ignored —
// the player only had so many pieces. But every row inside the loaded
// zone must be wall-to-wall to avoid cargo shift.
export function calcPackScore(grid) {
  let topRow = ROWS; // sentinel — no freight yet
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] !== null) { topRow = r; break; }
    }
    if (topRow < ROWS) break;
  }
  if (topRow === ROWS) {
    return { packScore: 1, completeRows: 0, totalRows: 0, gapRows: 0, gapCells: [] };
  }
  const totalRows = ROWS - topRow;
  let completeRows = 0;
  const gapCells = [];
  for (let r = topRow; r < ROWS; r++) {
    let rowFull = true;
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] === null) { rowFull = false; gapCells.push({ row: r, col: c }); }
    }
    if (rowFull) completeRows++;
  }
  const gapRows   = totalRows - completeRows;
  const packScore = totalRows > 0 ? completeRows / totalRows : 1;
  return { packScore, completeRows, totalRows, gapRows, gapCells };
}

// calcFillBonus: reward/penalty based on row packing completeness,
// not raw cell count. A player with 4 pieces who fills 4 perfect rows
// earns the full bonus even if 9 rows above are empty.
export function calcFillBonus(packScore) {
  if (packScore >= 1.00) return FILL_BONUS_XP;
  if (packScore >= 0.85) return 0;
  if (packScore >= 0.60) return FILL_PEN_LOOSE;
  return FILL_PEN_SPARSE;
}

// =============================================================================
//  SECTION 6 — XP CALCULATION
// =============================================================================

export function calcXP(passed, elapsedMs, frontWeight, totalWeight, packScore = 0) {
  if (!passed) return 0;
  const elapsedSec = elapsedMs / 1000;
  const timeBonus  = elapsedSec >= BONUS_WINDOW_SEC
    ? 0
    : Math.round(MAX_TIME_BONUS_XP * (1 - elapsedSec / BONUS_WINDOW_SEC));
  const { xpMod  } = calcBalance(frontWeight, totalWeight);
  const fillMod    = calcFillBonus(packScore);
  return Math.max(0, Math.min(200, BASE_PASS_XP + timeBonus + xpMod + fillMod));
}

// =============================================================================
//  SECTION 7 — SELF-TEST
// =============================================================================

export function runLogicTests() {
  const results = [];

  // Test 1: Manifest
  const manifest = generateManifest(devRandLoads());
  results.push({ test: 'Manifest: has at least 1 pallet',         pass: manifest.length >= 1,                                       detail: `${manifest.length} pallets` });
  results.push({ test: 'Manifest: all shapeIds valid',             pass: manifest.every(p => Object.keys(SHAPE_DEFS).includes(p.shapeId)), detail: `ok` });

  // Test 2: Rotation
  const s2rot90 = getCells('S2', 90);
  results.push({ test: 'Rotation: S2@90 is horizontal',           pass: JSON.stringify(s2rot90) === JSON.stringify([[0,0],[1,0]]),   detail: JSON.stringify(s2rot90) });

  // Test 3: Open-grid placement (no zone param)
  const emptyGrid  = Array(TOTAL_CELLS).fill(null);
  const s1Cells    = getCells('S1', 0);
  const validPlace = checkPlacement(s1Cells, 0, 0, emptyGrid);
  const oobPlace   = checkPlacement(s1Cells, 5, 0, emptyGrid);
  const partialGrid = placePallet({ id: 'p0', shapeId: 'S1', rotation: 0 }, 0, 0, emptyGrid);
  const collision   = checkPlacement(s1Cells, 0, 0, partialGrid);
  results.push({ test: 'Placement: valid cell accepted',           pass: validPlace.valid,   detail: String(validPlace.reason) });
  results.push({ test: 'Placement: OOB col rejected',             pass: !oobPlace.valid,    detail: oobPlace.reason });
  results.push({ test: 'Placement: collision rejected',           pass: !collision.valid,   detail: collision.reason });

  // Test 4: calcDropRow
  const filledGrid = Array(TOTAL_CELLS).fill(null);
  // Fill bottom row
  for (let c = 0; c < COLS; c++) filledGrid[cellIndex(c, ROWS-1)] = 'x';
  const dropRow = calcDropRow(getCells('S1', 0), 0, 0, filledGrid);
  results.push({ test: 'calcDropRow: stops above filled bottom row', pass: dropRow === ROWS - 2, detail: `dropRow=${dropRow}` });

  // Test 5: Weight & balance
  const fakePlaced = [
    { id: 'a', weightLbs: 1200, anchorRow: 9 },
    { id: 'b', weightLbs:  600, anchorRow: 8 },
    { id: 'c', weightLbs:  400, anchorRow: 2 },
  ];
  const { total, front, rear } = calcWeights(fakePlaced);
  results.push({ test: 'Weight calc: total',            pass: total === 2200, detail: `total=${total}` });
  results.push({ test: 'Weight calc: front (cab half)', pass: front === 1800, detail: `front=${front}` });
  results.push({ test: 'Weight calc: rear (door half)', pass: rear  === 400,  detail: `rear=${rear}` });

  // Test 6: XP with packScore
  const xpFast = calcXP(true, 10_000, 1400, 2000, 1.00);  // perfect rows
  const xpSlow = calcXP(true, 80_000, 1400, 2000, 0.65);  // moderate gaps
  results.push({ test: 'XP: fast+optimal+perfect pack ≥ 180', pass: xpFast >= 180, detail: `xp=${xpFast}` });
  results.push({ test: 'XP: slow+moderate gaps < 120',        pass: xpSlow < 120,  detail: `xp=${xpSlow}` });
  results.push({ test: 'XP: fail = 0',                        pass: calcXP(false, 0, 0, 0, 0) === 0, detail: 'ok' });

  // Test 7: Pack score bonus
  results.push({ test: 'packBonus: 1.00 → +20',  pass: calcFillBonus(1.00) === FILL_BONUS_XP,   detail: `ok` });
  results.push({ test: 'packBonus: 0.90 → 0',    pass: calcFillBonus(0.90) === 0,               detail: `ok` });
  results.push({ test: 'packBonus: 0.65 → -10',  pass: calcFillBonus(0.65) === FILL_PEN_LOOSE,  detail: `ok` });
  results.push({ test: 'packBonus: 0.40 → -20',  pass: calcFillBonus(0.40) === FILL_PEN_SPARSE, detail: `ok` });

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass);
  console.group('%c[CargoTetris Tetris Mode] Logic Tests', 'color:#44B2E4;font-weight:bold');
  results.forEach(r => console.log(`%c ${r.pass ? 'PASS' : 'FAIL'}  ${r.test}`, `color:${r.pass ? '#2EA86A' : '#C0392B'}`, `|  ${r.detail}`));
  console.log(`%c\n  Result: ${passed}/${results.length} passed`, `color:${failed.length === 0 ? '#2EA86A' : '#C0392B'};font-weight:bold`);
  if (failed.length > 0) console.warn('FAILED:', failed.map(r => r.test));
  console.groupEnd();
  return { passed, total: results.length, failed };
}

// =============================================================================
//  SECTION 8 — REDUCER & STATE MACHINE
// =============================================================================

// Helper: lock the active falling piece into the grid and spawn/advance.
function lockFallingPiece(state, fp, pallet) {
  const cells     = getCells(pallet.shapeId, fp.rotation);
  const newGrid   = placePallet({ ...pallet, rotation: fp.rotation }, fp.col, fp.row, state.grid);
  const newPallets = state.pallets.map(p =>
    p.id === fp.palletId
      ? { ...p, placed: true, anchorCol: fp.col, anchorRow: fp.row,
          rotation: fp.rotation, cells: getCells(p.shapeId, fp.rotation) }
      : p
  );
  const placed = newPallets.filter(p => p.placed);
  const { total, front, rear } = calcWeights(placed);
  const lockSeq = (state.lockSeq || 0) + 1;

  // No more pieces to spawn?
  if (state.queue.length === 0) {
    return {
      ...state, grid: newGrid, pallets: newPallets,
      fallingPiece: null, queue: [],
      phase: 'ALL_PLACED',
      totalWeight: total, frontWeight: front, rearWeight: rear,
      lastLockedId: fp.palletId, lockSeq,
    };
  }

  // Try to spawn next piece
  const nextPalletId = state.queue[0];
  const nextQueue    = state.queue.slice(1);
  const nextPallet   = newPallets.find(p => p.id === nextPalletId);
  const nextCells    = getCells(nextPallet.shapeId, 0);
  const nextBB       = getBoundingBox(nextCells);
  const spawnCol     = Math.max(0, Math.floor((COLS - nextBB.cols) / 2));

  if (!checkPlacement(nextCells, spawnCol, 0, newGrid).valid) {
    // Grid full — can't spawn, end game early
    return {
      ...state, grid: newGrid, pallets: newPallets,
      fallingPiece: null, queue: nextQueue,
      phase: 'ALL_PLACED',
      totalWeight: total, frontWeight: front, rearWeight: rear,
      lastLockedId: fp.palletId, lockSeq,
    };
  }

  return {
    ...state, grid: newGrid, pallets: newPallets,
    fallingPiece: { palletId: nextPalletId, col: spawnCol, row: 0, rotation: 0 },
    queue: nextQueue,
    phase: 'FALLING',
    totalWeight: total, frontWeight: front, rearWeight: rear,
    lastLockedId: fp.palletId, lockSeq,
  };
}

function buildInitialState(loads) {
  let resolvedLoads = loads;
  if (!resolvedLoads || !Array.isArray(resolvedLoads) || resolvedLoads.length === 0) {
    if (DEV) console.warn('[CargoTetris] No loads prop — using dev-generated loads.');
    resolvedLoads = devRandLoads();
  }

  const manifest  = generateManifest(resolvedLoads);
  const pallets   = manifest.map(p => ({ ...p }));
  const queue     = manifest.map(p => p.id);
  const grid      = Array(TOTAL_CELLS).fill(null);

  // Spawn first piece
  const firstId   = queue[0];
  const firstPal  = pallets.find(p => p.id === firstId);
  const firstCells = getCells(firstPal.shapeId, 0);
  const firstBB   = getBoundingBox(firstCells);
  const spawnCol  = Math.max(0, Math.floor((COLS - firstBB.cols) / 2));

  return {
    pallets,
    queue:        queue.slice(1),
    fallingPiece: { palletId: firstId, col: spawnCol, row: 0, rotation: 0 },
    grid,
    phase:        'FALLING',
    totalWeight:  0,
    frontWeight:  0,
    rearWeight:   0,
    startTime:    Date.now(),
    elapsedMs:    0,
    timedOut:     false,
    lastLockedId: null,
    lockSeq:      0,
  };
}

function cargoReducer(state, action) {
  switch (action.type) {

    case 'GRAVITY_TICK': {
      if (state.phase !== 'FALLING' || !state.fallingPiece) return state;
      const fp     = state.fallingPiece;
      const pallet = state.pallets.find(p => p.id === fp.palletId);
      if (!pallet) return state;
      const cells  = getCells(pallet.shapeId, fp.rotation);

      if (checkPlacement(cells, fp.col, fp.row + 1, state.grid).valid) {
        return { ...state, fallingPiece: { ...fp, row: fp.row + 1 } };
      }
      // Can't fall — lock piece
      return lockFallingPiece(state, fp, pallet);
    }

    case 'MOVE_LEFT':
    case 'MOVE_RIGHT': {
      if (state.phase !== 'FALLING' || !state.fallingPiece) return state;
      const fp     = state.fallingPiece;
      const pallet = state.pallets.find(p => p.id === fp.palletId);
      if (!pallet) return state;
      const cells  = getCells(pallet.shapeId, fp.rotation);
      const dir    = action.type === 'MOVE_LEFT' ? -1 : 1;
      if (!checkPlacement(cells, fp.col + dir, fp.row, state.grid).valid) return state;
      return { ...state, fallingPiece: { ...fp, col: fp.col + dir } };
    }

    case 'ROTATE': {
      if (state.phase !== 'FALLING' || !state.fallingPiece) return state;
      const fp     = state.fallingPiece;
      const pallet = state.pallets.find(p => p.id === fp.palletId);
      if (!pallet || !canRotateShape(pallet.shapeId)) return state;
      const newRot   = (fp.rotation + 90) % 360;
      const newCells = getCells(pallet.shapeId, newRot);
      // Try current col, then wall-kick offsets
      const kicks = [0, -1, 1, -2, 2];
      for (const offset of kicks) {
        if (checkPlacement(newCells, fp.col + offset, fp.row, state.grid).valid) {
          return { ...state, fallingPiece: { ...fp, col: fp.col + offset, rotation: newRot } };
        }
      }
      return state; // rotation blocked entirely
    }

    case 'HARD_DROP': {
      if (state.phase !== 'FALLING' || !state.fallingPiece) return state;
      const fp     = state.fallingPiece;
      const pallet = state.pallets.find(p => p.id === fp.palletId);
      if (!pallet) return state;
      const cells   = getCells(pallet.shapeId, fp.rotation);
      const dropRow = calcDropRow(cells, fp.col, fp.row, state.grid);
      return lockFallingPiece(state, { ...fp, row: dropRow }, pallet);
    }

    case 'SECURE_LOAD': {
      if (state.phase !== 'ALL_PLACED') return state;
      return { ...state, phase: 'COMPLETE' };
    }

    case 'TICK': {
      if (state.phase === 'COMPLETE') return state;
      return { ...state, elapsedMs: action.elapsedMs };
    }

    case 'TIMEOUT': {
      if (state.phase === 'COMPLETE') return state;
      return { ...state, timedOut: true, phase: 'COMPLETE' };
    }

    case 'CLEAR_LAST_LOCKED': {
      return { ...state, lastLockedId: null };
    }

    default:
      return state;
  }
}

// Derived helpers
export function selectFallingCells(state) {
  if (!state.fallingPiece) return null;
  const { palletId, col, row, rotation } = state.fallingPiece;
  const pallet = state.pallets.find(p => p.id === palletId);
  if (!pallet) return null;
  const cells = getCells(pallet.shapeId, rotation);
  return { cells, absCells: getAbsoluteCells(cells, col, row), pallet, rotation };
}

function selectBonusFraction(elapsedMs) {
  return Math.max(0, 1 - (elapsedMs / 1000) / BONUS_WINDOW_SEC);
}

function computeGravityMs(placedCount) {
  return Math.max(GRAVITY_MIN_MS, GRAVITY_BASE_MS - Math.floor(placedCount / 3) * GRAVITY_STEP_MS);
}

// =============================================================================
//  SECTION 9 — CSS ANIMATIONS
// =============================================================================

const ANIM_CSS = `
@keyframes ct-lock-flash {
  0%,100% { opacity: 1; }
  30%     { opacity: 0.45; }
}
@keyframes ct-confirm-pulse {
  0%,100% { box-shadow: 0 0 0px #44B2E4; }
  50%     { box-shadow: 0 0 18px #44B2E4; }
}
@keyframes ct-danger-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.45; }
}
@keyframes ct-balance-flash {
  0%   { background: transparent; }
  30%  { background: rgba(224,80,32,0.18); }
  100% { background: transparent; }
}
@keyframes ct-complete-in {
  0%   { opacity: 0; transform: scale(0.93) translateY(12px); }
  60%  { opacity: 1; transform: scale(1.02) translateY(-2px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes ct-xp-glow {
  0%,100% { text-shadow: 0 0 0px #44B2E4; }
  50%     { text-shadow: 0 0 16px #44B2E4, 0 0 32px #44B2E450; }
}
@keyframes ct-row-in {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ct-slide-up {
  from { opacity: 0; transform: translateY(100%); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ct-securing-pulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1.0;  }
}
@keyframes ct-scanline {
  0%   { top: -12px; }
  100% { top: 100%; }
}
@keyframes ct-rotate-hint {
  0%   { transform: rotate(0deg);   }
  30%  { transform: rotate(-90deg); }
  70%  { transform: rotate(-90deg); }
  100% { transform: rotate(0deg);   }
}
@keyframes ct-fall-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ct-lock-flash     { animation: ct-lock-flash 0.18s ease; }
.ct-complete-in    { animation: ct-complete-in 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.ct-xp-glow        { animation: ct-xp-glow 1.8s ease-in-out infinite; }
.ct-row-in         { animation: ct-row-in 0.25s ease forwards; }
.ct-slide-up       { animation: ct-slide-up 0.22s cubic-bezier(0.22,1,0.36,1) forwards; }
.ct-securing-pulse { animation: ct-securing-pulse 0.85s ease-in-out infinite; }
.ct-danger         { animation: ct-danger-pulse 0.7s ease-in-out infinite; }
.ct-balance-flash  { animation: ct-balance-flash 0.6s ease forwards; }
.ct-scanline       { animation: ct-scanline 6s linear infinite; pointer-events: none; }
.ct-rotate-icon    { animation: ct-rotate-hint 2.4s ease-in-out infinite; display: inline-block; }
.ct-fall-in        { animation: ct-fall-in 0.12s ease; }
@keyframes ct-strap-extend {
  from { transform: scaleX(0); opacity: 0.4; }
  to   { transform: scaleX(1); opacity: 1;   }
}
@keyframes ct-strap-tension {
  0%,100% { transform: scaleY(1);   }
  50%     { transform: scaleY(1.6); }
}
@keyframes ct-buckle-appear {
  from { opacity: 0; transform: scale(0.4); }
  to   { opacity: 1; transform: scale(1);   }
}
@keyframes ct-gap-pulse {
  0%,100% { opacity: 0.40; }
  50%     { opacity: 1.00; }
}
@keyframes ct-incident-slide {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes ct-cargo-shift {
  0%   { transform: translate(0px, 0px)   rotate(0deg);   opacity: 1;    }
  15%  { transform: translate(-4px, -2px) rotate(-3deg);  opacity: 0.95; }
  38%  { transform: translate(-11px, 4px) rotate(-7deg);  opacity: 0.88; }
  60%  { transform: translate(-16px, 1px) rotate(-10deg); opacity: 0.78; }
  82%  { transform: translate(-18px, 3px) rotate(-12deg); opacity: 0.65; }
  100% { transform: translate(-20px, 2px) rotate(-13deg); opacity: 0.50; }
}
@keyframes ct-cargo-hold {
  0%,100% { box-shadow: inset 0 0 0 1px var(--pc); }
  50%     { box-shadow: inset 0 0 0 1px var(--pc), 0 0 6px #2EA86A88; }
}
@keyframes ct-shift-overlay-out {
  0%   { opacity: 1; }
  75%  { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
@keyframes ct-shift-label-in {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

function useCSSInjection() {
  useEffect(() => {
    const fontId = 'cargo-tetris-font';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap';
      document.head.appendChild(link);
    }
    const id = 'cargo-tetris-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id; el.textContent = ANIM_CSS;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch(_) {} };
  }, []);
}

// =============================================================================
//  SECTION 10 — HOOKS & UTILITY SUB-COMPONENTS
// =============================================================================

function useHaptics(enabled = true) {
  const vibe = (pattern) => {
    if (!enabled) return;
    try { navigator.vibrate?.(pattern); } catch (_) {}
  };
  return {
    place:   () => vibe(15),
    lock:    () => vibe([10, 20, 10]),
    invalid: () => vibe([20, 40, 20]),
    advance: () => vibe(80),
    drop:    () => vibe(30),
  };
}

function useOrientation() {
  const isTouchDevice = () =>
    navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  const isLandscape = () => isTouchDevice() && window.innerWidth > window.innerHeight;
  const [landscape, setLandscape] = useState(isLandscape);
  useEffect(() => {
    const update = () => setLandscape(isLandscape());
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return landscape;
}

function LandscapeOverlay() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#03040C',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 24,
      fontFamily: '"Share Tech Mono", "Courier New", monospace',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
        <defs>
          <pattern id="ct-ls-dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1" fill="#64B8E8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ct-ls-dot)" />
      </svg>
      <div className="ct-rotate-icon" style={{ fontSize: 52, lineHeight: 1 }}>📱</div>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#3A7AB0', marginBottom: 10 }}>BOX TRUCK BOSS</div>
        <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: '0.15em', color: '#64B8E8', marginBottom: 8 }}>ROTATE TO PORTRAIT</div>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', color: '#3A7AB0' }}>LOAD PLAN REQUIRES PORTRAIT MODE</div>
      </div>
    </div>
  );
}

// Dynamic cell-size hook — computes best cell px to fit viewport.
const CAB_ASPECT     = 354 / 471;
const FRAME_H_PAD_C  = 12;
const FIXED_UI_H     = 295; // header + weightbar + status + queue preview + d-pad
const FRAME_BOT_C    = 48;

function useDynamicCell() {
  const compute = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const availH = vh - FIXED_UI_H - FRAME_BOT_C;
    const coeff  = ROWS + 4 * CAB_ASPECT;
    const offset = FRAME_H_PAD_C * 2 * CAB_ASPECT;
    const fromH  = Math.floor((availH - offset) / coeff);
    const fromW  = Math.floor((vw - FRAME_H_PAD_C * 2 - 16) / COLS);
    return Math.max(22, Math.min(fromH, fromW, 48));
  };
  const [cell, setCell] = useState(compute);
  useEffect(() => {
    const handler = () => setCell(compute());
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return cell;
}

const FRAME_H_PAD = FRAME_H_PAD_C;

function useCountUp(target, durationMs = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t     = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

// =============================================================================
//  SECTION 11 — WEIGHT BAR
// =============================================================================

function WeightBar({ totalWeight, frontWeight, rearWeight }) {
  const pct        = Math.min(totalWeight / WEIGHT_CAP_LBS, 1);
  const frontPct   = totalWeight > 0 ? frontWeight / totalWeight : 0;
  const { rating } = calcBalance(frontWeight, totalWeight);
  const overweight = totalWeight > WEIGHT_CAP_LBS;
  const nearLimit  = pct > 0.85 && !overweight;

  const prevRatingRef = useRef(rating);
  const barRootRef    = useRef(null);
  useEffect(() => {
    const ORDER = ['N/A', 'OPTIMAL', 'ACCEPTABLE', 'REAR HEAVY', 'DANGEROUS'];
    const prev  = ORDER.indexOf(prevRatingRef.current);
    const curr  = ORDER.indexOf(rating);
    if (curr > prev && curr >= 2 && barRootRef.current) {
      const el = barRootRef.current;
      el.classList.remove('ct-balance-flash');
      void el.offsetWidth;
      el.classList.add('ct-balance-flash');
    }
    prevRatingRef.current = rating;
  }, [rating]);

  const barColor = overweight ? BP.warn : nearLimit ? '#E0A020' : BP.line;
  const balColor = rating === 'OPTIMAL' ? BP.good : rating === 'ACCEPTABLE' ? BP.line
    : rating === 'REAR HEAVY' ? '#E0A020' : rating === 'DANGEROUS' ? BP.warn : BP.dim;

  return (
    <div ref={barRootRef} style={{ padding: '0 12px 5px', fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: BP.mid }}>GROSS WEIGHT</span>
        <span className={overweight ? 'ct-danger' : undefined}
          style={{ fontSize: 11, color: overweight ? BP.warn : nearLimit ? '#E0A020' : BP.offWhite, fontWeight: 'bold' }}>
          {totalWeight.toLocaleString()} <span style={{ fontSize: 10, color: BP.mid }}>/ 9,500 LBS</span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, background: BP.dimmer, border: `1px solid ${BP.dim}`, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: barColor, transition: 'width 0.3s ease, background 0.3s ease' }} />
        {[10,20,30,40,50,60,70,80,90].map(p => (
          <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1, background: BP.bg, opacity: 0.55 }} />
        ))}
        <div style={{ position: 'absolute', left: '85%', top: 0, bottom: 0, width: 1, background: BP.warn, opacity: 0.9 }} />
      </div>
      {totalWeight > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ position: 'relative', height: 6, background: BP.dimmer, border: `1px solid ${BP.dim}`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frontPct * 100}%`, background: BP.good, transition: 'width 0.35s ease' }} />
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${(1 - frontPct) * 100}%`, background: balColor === BP.good ? `${BP.good}55` : balColor, opacity: 0.7, transition: 'width 0.35s ease, background 0.35s ease' }} />
            <div style={{ position: 'absolute', left: '60%', top: 0, bottom: 0, width: 1, background: BP.offWhite, opacity: 0.35 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: BP.mid }}>FWD <span style={{ color: BP.offWhite }}>{Math.round(frontPct * 100)}%</span></span>
            <span style={{ fontSize: 10, color: balColor, letterSpacing: '0.1em' }}>{rating}</span>
            <span style={{ fontSize: 9, color: BP.mid }}><span style={{ color: BP.offWhite }}>{Math.round((1-frontPct)*100)}%</span> AFT</span>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
//  SECTION 12 — NEXT PIECE PREVIEW (replaces StagingTray)
// =============================================================================

const PREVIEW_CANVAS = 32;
const PREVIEW_TILE   = 10;

function PiecePreviewMini({ pallet, dimmed }) {
  const cells = getCells(pallet.shapeId, pallet.rotation);
  const bb    = getBoundingBox(cells);
  const offX  = Math.floor((PREVIEW_CANVAS - bb.cols * PREVIEW_TILE) / 2);
  const offY  = Math.floor((PREVIEW_CANVAS - bb.rows * PREVIEW_TILE) / 2);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '5px 7px 6px',
      border: `1px solid ${dimmed ? BP.dimmer : BP.dim}`,
      background: dimmed ? 'transparent' : BP.dimmer,
      opacity: dimmed ? 0.45 : 1,
      flexShrink: 0,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ position: 'relative', width: PREVIEW_CANVAS, height: PREVIEW_CANVAS }}>
        {cells.map(([c, r], i) => (
          <div key={i} style={{
            position: 'absolute',
            left: offX + c * PREVIEW_TILE, top: offY + r * PREVIEW_TILE,
            width: PREVIEW_TILE - 1, height: PREVIEW_TILE - 1,
            background: pallet.color,
            opacity: dimmed ? 0.6 : 0.85,
          }} />
        ))}
      </div>
      <div style={{ fontSize: 9, color: dimmed ? BP.dim : BP.mid, fontFamily: '"Share Tech Mono", "Courier New", monospace', lineHeight: 1 }}>
        {pallet.weightLbs}<span style={{ fontSize: 8, opacity: 0.7 }}>lb</span>
      </div>
    </div>
  );
}

function NextPiecePreview({ queue, pallets, fallingPiece, totalWeight }) {
  const activePal  = fallingPiece ? pallets.find(p => p.id === fallingPiece.palletId) : null;
  const nextIds    = queue.slice(0, 3);
  const remaining  = queue.length + (fallingPiece ? 1 : 0);
  const totalMfW   = pallets.reduce((s, p) => s + p.weightLbs, 0);
  const pct        = Math.min(totalWeight / WEIGHT_CAP_LBS, 1);
  const nearLimit  = pct > 0.85 && totalWeight <= WEIGHT_CAP_LBS;
  const overweight = totalWeight > WEIGHT_CAP_LBS;
  const barColor   = overweight ? BP.warn : nearLimit ? '#E0A020' : BP.line;

  return (
    <div style={{ padding: '2px 12px 4px', flexShrink: 0 }}>
      {/* Capacity micro-bar */}
      <div style={{ position: 'relative', height: 3, background: BP.dimmer, border: `1px solid ${BP.dimmer}`, borderRadius: 1, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: barColor, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* NEXT label */}
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: BP.mid, flexShrink: 0, width: 32 }}>NEXT</div>
        {/* Active piece (now falling) */}
        {activePal && (
          <div style={{ flexShrink: 0, padding: '4px 6px', border: `1px solid ${activePal.color}`, background: `${activePal.color}18`, display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ fontSize: 9, color: activePal.color, fontFamily: '"Share Tech Mono", "Courier New", monospace', letterSpacing: '0.1em' }}>
              {activePal.stopLabel}
            </div>
            <div style={{ fontSize: 9, color: BP.offWhite, fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>
              {activePal.weightLbs}lb
            </div>
          </div>
        )}
        {/* Separator */}
        {activePal && nextIds.length > 0 && <div style={{ width: 1, height: 28, background: BP.dim, flexShrink: 0 }} />}
        {/* Queue preview */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {nextIds.map((id, i) => {
            const p = pallets.find(x => x.id === id);
            return p ? <PiecePreviewMini key={id} pallet={p} dimmed={i > 0} /> : null;
          })}
        </div>
        {/* Remaining count */}
        <div style={{ marginLeft: 'auto', flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: remaining > 0 ? BP.offWhite : BP.good, fontFamily: '"Share Tech Mono", "Courier New", monospace', lineHeight: 1 }}>
            {remaining > 0 ? remaining : '✓'}
          </div>
          <div style={{ fontSize: 8, color: BP.dim, letterSpacing: '0.1em', marginTop: 1 }}>
            {remaining > 0 ? 'LEFT' : 'DONE'}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
//  SECTION 13 — CONTROLS BAR (D-PAD)
// =============================================================================

function ctrlBtnStyle(color, active, extra = {}) {
  return {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    justifyContent:'center',
    padding:       '8px 4px',
    background:    active ? `${color}22` : 'transparent',
    border:        `1px solid ${color}`,
    color,
    fontFamily:    '"Share Tech Mono", "Courier New", monospace',
    cursor:        'pointer',
    transition:    'border-color 0.1s, color 0.1s, background 0.1s, opacity 0.06s',
    minHeight:     44,
    WebkitTapHighlightColor: 'transparent',
    userSelect:    'none',
    touchAction:   'manipulation',
    ...extra,
  };
}

// Auto-repeat hook for held buttons (left/right movement).
function useAutoRepeat(dispatch, actionType) {
  const intervalRef = useRef(null);
  const timeoutRef  = useRef(null);

  const start = useCallback(() => {
    dispatch({ type: actionType });
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => dispatch({ type: actionType }), 80);
    }, 260);
  }, [dispatch, actionType]);

  const stop = useCallback(() => {
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => () => { clearTimeout(timeoutRef.current); clearInterval(intervalRef.current); }, []);

  return { start, stop };
}

function ControlsBar({ phase, dispatch, pallets, fallingPiece, hapticsEnabled }) {
  const haptics = useHaptics(hapticsEnabled);

  const left  = useAutoRepeat(dispatch, 'MOVE_LEFT');
  const right = useAutoRepeat(dispatch, 'MOVE_RIGHT');

  const fallingPal   = fallingPiece ? pallets.find(p => p.id === fallingPiece.palletId) : null;
  const canRotate    = fallingPal ? canRotateShape(fallingPal.shapeId) : false;
  const complete     = phase === 'COMPLETE';
  const allPlaced    = phase === 'ALL_PLACED';
  const falling      = phase === 'FALLING';

  if (complete) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px 10px', gap: 8, color: BP.mid, fontSize: 11, letterSpacing: '0.18em', fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>
        TRUCK LOADED — CLOSE MINIGAME TO CONTINUE
      </div>
    );
  }

  if (allPlaced) {
    return (
      <div style={{ padding: '6px 12px 10px' }}>
        <button
          onClick={() => { haptics.advance(); dispatch({ type: 'SECURE_LOAD' }); }}
          className="ct-securing-pulse"
          onTouchStart={(e) => e.currentTarget.style.opacity = '0.62'}
          onTouchEnd={(e)   => e.currentTarget.style.opacity = '1'}
          onTouchCancel={(e)=> e.currentTarget.style.opacity = '1'}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, padding: '10px 12px',
            background: '#E0A02018', border: `1px solid #E0A020`,
            color: '#E0A020', fontFamily: '"Share Tech Mono", "Courier New", monospace',
            cursor: 'pointer', minHeight: 56,
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>⊠</span>
          <span style={{ fontSize: 11, letterSpacing: '0.18em', fontWeight: 'bold', marginTop: 3 }}>SECURE THE LOAD</span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', opacity: 0.7, marginTop: 2 }}>STRAP &amp; CONFIRM LOAD</span>
        </button>
      </div>
    );
  }

  // FALLING — D-pad
  return (
    <div style={{ padding: '5px 12px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {/* Top row: ← ROTATE → */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); left.start(); }}
          onPointerUp={left.stop}
          onPointerLeave={left.stop}
          onPointerCancel={left.stop}
          style={ctrlBtnStyle(falling ? BP.line : BP.dim, false, { minHeight: 40 })}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>←</span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', marginTop: 2 }}>LEFT</span>
        </button>

        <button
          onClick={() => { if (canRotate) { haptics.place(); dispatch({ type: 'ROTATE' }); } }}
          disabled={!canRotate}
          onTouchStart={(e) => { if (canRotate) e.currentTarget.style.opacity='0.62'; }}
          onTouchEnd={(e)   => e.currentTarget.style.opacity='1'}
          onTouchCancel={(e)=> e.currentTarget.style.opacity='1'}
          style={ctrlBtnStyle(canRotate ? BP.mid : BP.dim, false, { flex: 1.4, minHeight: 40 })}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>↻</span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', marginTop: 2 }}>ROTATE</span>
          {canRotate && fallingPiece && (
            <span style={{ fontSize: 8, color: `${BP.mid}88`, marginTop: 1 }}>{fallingPiece.rotation}°</span>
          )}
        </button>

        <button
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); right.start(); }}
          onPointerUp={right.stop}
          onPointerLeave={right.stop}
          onPointerCancel={right.stop}
          style={ctrlBtnStyle(falling ? BP.line : BP.dim, false, { minHeight: 40 })}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
          <span style={{ fontSize: 8, letterSpacing: '0.1em', marginTop: 2 }}>RIGHT</span>
        </button>
      </div>

      {/* Bottom row: HARD DROP */}
      <button
        onClick={() => { haptics.drop(); dispatch({ type: 'HARD_DROP' }); }}
        onTouchStart={(e) => e.currentTarget.style.opacity='0.72'}
        onTouchEnd={(e)   => e.currentTarget.style.opacity='1'}
        onTouchCancel={(e)=> e.currentTarget.style.opacity='1'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '8px 12px', background: `${BP.good}18`, border: `1px solid ${BP.good}`,
          color: BP.good, fontFamily: '"Share Tech Mono", "Courier New", monospace',
          cursor: 'pointer', minHeight: 42,
          WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          letterSpacing: '0.18em', fontSize: 11, fontWeight: 'bold',
        }}
      >
        <span style={{ fontSize: 16 }}>▼▼</span> HARD DROP
      </button>
    </div>
  );
}

// =============================================================================
//  SECTION 13.5 — EDUCATIONAL CONTENT (Tips, Badges, Helpers)
// =============================================================================

// ── 30 Pro Driver Tips (non-CDL 26-ft box truck · pallet jack · liftgate) ────
const DRIVER_TIPS = [
  // ── LOADING ORDER (12) ───────────────────────────────────────────────────
  { cat: 'LOADING ORDER',  tip: 'LIFO is the law of the truck. Your first delivery stop rides at the rear door; last stop hugs the cab wall. Load wrong and you\'re unpacking freight at every stop.' },
  { cat: 'LOADING ORDER',  tip: 'Heavy freight on the floor, lighter on top. Stacking dense items high raises the center of gravity and makes the truck twitchy in mountain crosswinds on the interstate.' },
  { cat: 'LOADING ORDER',  tip: 'Pack wall-to-wall and floor-to-ceiling whenever possible. Floating pallets — not touching side walls — have two shift vectors: forward AND lateral. Wall contact eliminates one for free.' },
  { cat: 'LOADING ORDER',  tip: 'A single empty row directly behind a heavy pallet group is a launch ramp. Fill it with a lightweight pallet, a load bar, or corrugated dunnage. Never leave it open.' },
  { cat: 'LOADING ORDER',  tip: 'After every stop, re-inspect remaining freight. A load secured for a full truck becomes dangerously loose once you remove 30% of the freight — re-strap before closing the door.' },
  { cat: 'LOADING ORDER',  tip: 'Mark each pallet with its stop number in chalk before loading. At delivery, consignees can verify their freight without touching other loads — avoiding costly short-shipment disputes.' },
  { cat: 'LOADING ORDER',  tip: 'Fragile freight always rides as far from the cab wall as possible. The cab end absorbs the most energy during hard braking — the door end is the safest zone for breakables.' },
  { cat: 'LOADING ORDER',  tip: 'Never place freight directly against the rear doors as your only securement. At delivery, the door opens and anything leaning on it becomes a 2,000-lb projectile toward whoever opens it.' },
  { cat: 'LOADING ORDER',  tip: 'When mixing freight types, load the most rectangular pallets first. Irregular shapes fill gaps; rectangular shapes build stable walls. Start with your foundation, finish with your fillers.' },
  { cat: 'LOADING ORDER',  tip: 'A rear-door row that\'s only half full is worse than no freight there at all. That loose pallet can shift laterally against the door mechanism and jam it shut at the delivery site.' },
  { cat: 'LOADING ORDER',  tip: 'Load sequence determines your tip exposure. Pallets loaded first ride the entire cross-country distance. Give your best securement to the freight that\'s been on the truck longest.' },
  { cat: 'LOADING ORDER',  tip: 'Plan your reload before you unload a stop. Know which remaining pieces go where before the dock door opens, or you\'ll be moving freight twice in a parking lot in the rain.' },

  // ── PALLET JACK (8) ──────────────────────────────────────────────────────
  { cat: 'PALLET JACK',    tip: 'Insert forks fully until tips are visible on the far side before pumping. Partial entry tilts the pallet and can trap your feet under a moving load.' },
  { cat: 'PALLET JACK',    tip: 'Keep the handle vertical when moving heavy loads. An angled handle reduces mechanical advantage and can let the load roll free on any grade inside or outside the truck.' },
  { cat: 'PALLET JACK',    tip: 'A standard pallet jack needs at least 28 inches of aisle width to turn 90 degrees. Plan your loading sequence before the first pallet touches the gate — once it\'s in, you\'re committed.' },
  { cat: 'PALLET JACK',    tip: '3–5 pumps clears a standard 4-way pallet off the floor. Over-pumping on uneven concrete can tilt the pallet past its tipping point. Watch the load angle, not the pump count.' },
  { cat: 'PALLET JACK',    tip: 'Always push a loaded pallet jack, never pull. Pulling lets the load swing wide on corners and puts the freight behind your center of balance — a fall risk on any ramp.' },
  { cat: 'PALLET JACK',    tip: 'Pallet jack wheels can pick up debris that causes sudden stops. On cross-country runs, inspect and clear wheels before each unload — especially at construction sites and gravel lots.' },
  { cat: 'PALLET JACK',    tip: 'Pallet jacks are rated at specific capacities — typically 5,500 lbs. Overloading bends the forks and damages bearings. A bent fork on a cross-country run costs days of downtime.' },
  { cat: 'PALLET JACK',    tip: 'Lower the forks completely before moving between positions inside the truck. Raised forks catch on load bars, straps, and pallet edges — causing sudden load drops and injuries.' },

  // ── LIFTGATE (9) ─────────────────────────────────────────────────────────
  { cat: 'LIFTGATE',       tip: 'Never load more than your liftgate\'s rated capacity — typically 1,500–2,500 lbs. Overloading the gate causes hydraulic cylinder failure that can strand you mid-route.' },
  { cat: 'LIFTGATE',       tip: 'Lower the gate completely flat before rolling any pallet on. Loading on a tilted gate shifts weight to one side and can topple 2,000 lbs on whoever is standing near it.' },
  { cat: 'LIFTGATE',       tip: 'Cold weather thickens hydraulic fluid and drains liftgate batteries fast. On winter cross-country runs, test the gate before departure — a frozen gate at a rural stop costs hours.' },
  { cat: 'LIFTGATE',       tip: 'Raise the liftgate only to truck-floor level when rolling freight in — not higher. The gate is an access ramp, not an elevator. Raising loaded freight above floor level bends the platform.' },
  { cat: 'LIFTGATE',       tip: 'On sloped delivery sites, chock rear wheels AND set the parking brake before operating the gate. A loaded liftgate creates enough rearward thrust to push the truck backward off the chocks.' },
  { cat: 'LIFTGATE',       tip: 'Liftgate hydraulic seals dry out when the truck sits unused for weeks. On extended cross-country assignments, cycle the gate at least once a week to maintain seal lubrication.' },
  { cat: 'LIFTGATE',       tip: 'Always center freight on the liftgate platform. Off-center loads create unequal hydraulic pressure, accelerating cylinder wear and causing the gate to drift sideways under load.' },
  { cat: 'LIFTGATE',       tip: 'Gate lip-to-floor gaps over 1 inch can catch pallet jack wheels. Carry a rubber ramp block in your tool kit for uneven dock heights — a stuck jack at a rural consignee costs hours.' },
  { cat: 'LIFTGATE',       tip: 'Document your liftgate pre-check at every stop. A damaged gate you didn\'t report at origin becomes your liability at destination — even if someone else caused the damage.' },

  // ── CARGO SHIFT (9) ──────────────────────────────────────────────────────
  { cat: 'CARGO SHIFT',    tip: 'Gaps between pallets are the #1 cause of cargo claims. A 1,500-lb pallet with 6 inches of free space accelerates to 4 mph before hitting the next piece of freight during emergency braking.' },
  { cat: 'CARGO SHIFT',    tip: 'Cross-country routes cross 6%+ grades repeatedly. A 2,000-lb pallet on a 6% downgrade experiences 120 lbs of constant forward force — exactly why strap working-load limits exist.' },
  { cat: 'CARGO SHIFT',    tip: 'Aluminum box walls are typically 1/4-inch thick. An unsecured metal pallet edge at 65 mph has enough inertia to punch through the sidewall under hard braking. Repairs run $800–$3,000.' },
  { cat: 'CARGO SHIFT',    tip: 'Straps loosen in temperature swings. On multi-day cross-country runs, re-check securement every morning and after any stop over 2 hours. A loose strap is an expensive strap.' },
  { cat: 'CARGO SHIFT',    tip: 'Lateral freight shift is the most underestimated risk in box trucks. A pallet sliding 3 inches sideways at highway speed transfers enough energy to crack a composite sidewall panel.' },
  { cat: 'CARGO SHIFT',    tip: 'Cargo damage claims average $3,800 per incident in the last-mile industry. A $30 load bar or two extra ratchet straps is not a cost — it\'s a $3,770 insurance policy per trip.' },
  { cat: 'CARGO SHIFT',    tip: 'Interstate on-ramps and cloverleaf interchanges generate the highest lateral G-forces in normal highway driving. If your load isn\'t packed tight, this is where the claims start.' },
  { cat: 'CARGO SHIFT',    tip: 'Floor anchor rings in 26-ft box trucks are rated at 1,000–2,500 lbs working load. A single ring cannot secure a 2,000-lb pallet — always use two anchor points per heavy pallet.' },
  { cat: 'CARGO SHIFT',    tip: 'Moisture from temperature cycling causes cardboard-packaged freight to soften overnight. A box that was stable at load-in can collapse by morning — re-check high stacks at every stop.' },

  // ── DOT / FMCSA (8) ──────────────────────────────────────────────────────
  { cat: 'DOT / FMCSA',   tip: '49 CFR 393.100: all cargo must resist 0.8g forward decel, 0.5g lateral, and 0.5g rearward force. Minimum one ratchet strap per 1,000 lbs — two is professional standard.' },
  { cat: 'DOT / FMCSA',   tip: 'Visibly shifting cargo is a Federal out-of-service violation. A roadside inspector can ground your truck mid-route. The fine starts at $1,000 and the schedule loss is your problem.' },
  { cat: 'DOT / FMCSA',   tip: 'Non-CDL 26k GVW box truck cargo limit is roughly 10,000 lbs after tare weight. On long hauls, stop at a certified truck scale if you\'re unsure — overweight fines start at $150/lb over.' },
  { cat: 'DOT / FMCSA',   tip: 'DOT roadside inspections are conducted without warning at weigh stations, rest stops, and on the shoulder. An inspector who sees unsecured or visibly shifted freight will write a citation on the spot.' },
  { cat: 'DOT / FMCSA',   tip: 'Cargo securement violations stay on your safety record for 3 years and increase your insurance premiums. One bad inspection can cost more than a year of careful loading ever saved.' },
  { cat: 'DOT / FMCSA',   tip: '49 CFR 393.110 requires cargo to be contained within the cargo area. Freight overhanging the sides or rear of an open truck is an immediate out-of-service violation and a liability exposure.' },
  { cat: 'DOT / FMCSA',   tip: 'Working load limit (WLL) and breaking strength are different numbers. Straps are rated by WLL — typically 1/3 of break strength. Never use break-strength numbers to calculate tie-down capacity.' },
  { cat: 'DOT / FMCSA',   tip: 'A Bill of Lading discrepancy discovered at delivery puts the carrier in a disputed liability position. Verify piece count and condition at origin before the dock door closes. Sign nothing you haven\'t counted.' },

  // ── WEIGHT BALANCE (7) ───────────────────────────────────────────────────
  { cat: 'WEIGHT BALANCE', tip: 'The 60/40 rule: 60% of total load weight in the cab half. It keeps the steer axle loaded for control and prevents dangerous rear-end lift under hard braking at 65 mph.' },
  { cat: 'WEIGHT BALANCE', tip: 'Steer axle limit on a 26k GVW box truck is 12,000 lbs. Too much weight forward blows out steer tires. Too little makes the truck wander at highway speed in crosswinds.' },
  { cat: 'WEIGHT BALANCE', tip: 'Mountain passes stress brakes hard. A rear-heavy load shifts brake bias rearward, reducing front stopping force at the exact moment you need it most descending a steep grade.' },
  { cat: 'WEIGHT BALANCE', tip: 'Cross-winds above 30 mph require extra front axle loading for stability. A balanced-to-heavy-front load keeps the steer tires planted when a highway overpass funnels a sudden gust.' },
  { cat: 'WEIGHT BALANCE', tip: 'Weight shifts forward during hard braking and rearward during acceleration. If you\'re already rear-heavy at cruise speed, a hard stop can create a momentary condition of near-zero steer traction.' },
  { cat: 'WEIGHT BALANCE', tip: 'Weigh station bypass apps are not a substitute for knowing your actual axle weights. Apps use estimates. The scale uses physics. The fine uses the scale number, not the app number.' },
  { cat: 'WEIGHT BALANCE', tip: 'Fuel consumption is 4–7% higher on a rear-heavy truck because the front tires generate more rolling resistance when underloaded. A properly balanced load literally pays for itself in fuel savings.' },

  // ── FREIGHT CLASS (4) ────────────────────────────────────────────────────
  { cat: 'FREIGHT CLASS',  tip: 'NMFC freight classes run from 50 (dense machinery) to 500 (ping-pong balls). High-class freight carries higher cargo liability. Know your Bill of Lading before you sign it.' },
  { cat: 'FREIGHT CLASS',  tip: 'Class 50 freight (steel, machinery) can be loaded dense and low. Class 300+ freight (assembled furniture, live plants) is fragile and expensive — it rides on top and near the door.' },
  { cat: 'FREIGHT CLASS',  tip: 'Hazmat placards on any piece of freight change your entire compliance picture, even on a non-CDL truck. Check every BOL at pickup — refusing undisclosed hazmat is your legal right.' },
  { cat: 'FREIGHT CLASS',  tip: 'High-value electronics are typically Class 100–200. They should never ride directly on the floor (condensation risk) or be stacked beneath heavier freight. Use a dry, elevated position near the door end.' },

  // ── EQUIPMENT & GEAR (5) ─────────────────────────────────────────────────
  { cat: 'EQUIPMENT',      tip: 'Load bars (adjustable tension poles) cost under $30 and eliminate lateral pallet shift without adding truck weight. They are the most cost-effective cargo control tool in the box-truck business.' },
  { cat: 'EQUIPMENT',      tip: 'Ratchet straps degrade with UV exposure and abrasion. Inspect webbing before every load — a single frayed stripe is a failure point. Replace straps that show any webbing wear.' },
  { cat: 'EQUIPMENT',      tip: 'Corrugated cardboard dunnage between pallets costs cents and prevents two freight pieces from abrading each other over 1,500 miles. It\'s the cheapest cargo claim prevention in your toolkit.' },
  { cat: 'EQUIPMENT',      tip: 'Keep a torque wrench or wheel-check lug nuts in your cab kit. Box trucks are notorious for wheel fastener issues on long hauls — a loose wheel at 65 mph is catastrophic.' },
  { cat: 'EQUIPMENT',      tip: 'Anti-slip matting under pallets reduces the tie-down force required by up to 50%. Rubber grip mats cost $20 and turn a marginal securement into a compliant one under Federal standards.' },

  // ── SAFETY (5) ───────────────────────────────────────────────────────────
  { cat: 'SAFETY',         tip: 'Never pack freight so tightly against the rear doors that the doors hold it in place. At delivery, the door opens and 2,000 lbs fall on whoever is standing there. That is a fatality.' },
  { cat: 'SAFETY',         tip: 'Steel-toed boots are non-negotiable when operating a pallet jack. A pallet jack wheel over a foot in a non-safety shoe causes fractures. No delivery schedule is worth that injury.' },
  { cat: 'SAFETY',         tip: 'Never stand in front of a load on the liftgate while raising or lowering. Hydraulic seals can fail without warning, dropping the gate instantly. Stay to the side — always.' },
  { cat: 'SAFETY',         tip: 'Backing a 26-ft box truck without a spotter in tight urban delivery areas causes more damage incidents than any other single maneuver in last-mile operations. Find a spotter or walk it first.' },
  { cat: 'SAFETY',         tip: 'Loading dock edges are the most dangerous 3 feet in any warehouse. A pallet jack rolling off a dock at speed transfers enough force to break legs. Dock plates and wheel chocks exist for this reason.' },

  // ── EFFICIENCY & BUSINESS (6) ────────────────────────────────────────────
  { cat: 'EFFICIENCY',     tip: 'A 26-ft box averages 8–12 mpg loaded. Every 100 lbs over optimal load weight costs ~0.3% fuel efficiency. Tight packing pays you back at every fuel stop over a cross-country run.' },
  { cat: 'EFFICIENCY',     tip: 'Shippers charge detention after 2 hours at the dock — often $50–$100/hr. Fast, efficient loading is a direct profit center and keeps your cross-country delivery schedule intact.' },
  { cat: 'EFFICIENCY',     tip: 'Dead miles — empty driving between pickups — cost the same in fuel and wear as loaded miles. Cube-efficient loading lets you carry more per trip and reduces total deadhead distance.' },
  { cat: 'EFFICIENCY',     tip: 'A tight pack load reduces internal vibration during transit. Loose freight amplifies road vibration, accelerating damage to delicate items and increasing breakage claims over long hauls.' },
  { cat: 'EFFICIENCY',     tip: 'Route pre-planning with load order is as important as the physical loading. A perfectly packed truck with stops in the wrong order costs you 45 extra minutes per reversal at every delivery site.' },
  { cat: 'EFFICIENCY',     tip: 'Fuel costs represent 35–40% of total operating cost for a box truck operation. Aerodynamic loading (heavier freight low and forward) reduces drag profile and measurably improves highway MPG.' },

  // ── CROSS-COUNTRY SPECIFIC (7) ───────────────────────────────────────────
  { cat: 'CROSS-COUNTRY',  tip: 'Interstate highways traverse 6 distinct climate zones on a single cross-country run. Temperature swings of 60°F between origin and destination cause steel freight to expand and contract — re-check straps at climate transitions.' },
  { cat: 'CROSS-COUNTRY',  tip: 'ELD (Electronic Logging Device) compliance means you cannot rush a reload stop. Plan your load sequence to minimize time at every stop — your clock runs whether the pallet jack does or not.' },
  { cat: 'CROSS-COUNTRY',  tip: 'High-altitude routes above 5,000 feet reduce tire pressure by roughly 1 PSI per 1,000 feet of elevation gain. Check and adjust all 6 tires at every fuel stop during mountain crossings.' },
  { cat: 'CROSS-COUNTRY',  tip: 'Rest area scales are free, open 24 hours, and save you from surprise weigh-station citations. Use them whenever you add or remove freight mid-route — especially when accepting additions from shippers.' },
  { cat: 'CROSS-COUNTRY',  tip: 'Every state has different permit requirements for oversize or overweight loads. Even a non-CDL box truck can trigger state-specific regulations at certain weight thresholds. Check PERMIT requirements by state before dispatch.' },
  { cat: 'CROSS-COUNTRY',  tip: 'City deliveries after a cross-country run mean navigating urban loading docks with a truck that\'s been vibrating for 1,000 miles. Re-inspect every strap and load bar before entering the metro delivery zone.' },
  { cat: 'CROSS-COUNTRY',  tip: 'Pre-plan your off-hours parking for every overnight stop before departure. A loaded box truck parked in an unsecured lot overnight is a cargo theft target. Truck-stop parking with lighting and cameras is the standard.' },
];

// Tip selection uses total pallets × elapsed seconds as a pseudo-random seed
// so replays with similar times but different loads still get different tips.
function selectTip(elapsedMs, palletCount) {
  const seed = Math.abs(Math.round(elapsedMs / 971) + palletCount * 13);
  return DRIVER_TIPS[seed % DRIVER_TIPS.length];
}

// ── Badge Definitions ─────────────────────────────────────────────────────────
const BADGE_DEFS = [
  {
    id: 'TETRIS_PACK',
    icon: '🟩', label: 'TETRIS PACK',
    edu: 'Zero gaps = zero shift risk. A completely packed load is the only one the FMCSA considers truly secured without supplemental load bars or additional strapping.',
    test: ({ packScore }) => packScore >= 1.0,
  },
  {
    id: 'OPTIMAL_BALANCE',
    icon: '⚖️', label: 'BALANCED LOAD',
    edu: 'Optimal 60/40 front-to-rear split keeps the steer axle loaded for control. Rear-heavy trucks understeer on grades, oversteer in corners, and lose front braking power when you need it most.',
    test: ({ balance }) => balance.rating === 'OPTIMAL',
  },
  {
    id: 'SPEED_FREIGHT',
    icon: '⚡', label: 'SPEED FREIGHT',
    edu: 'Shippers charge detention after 2 hours at the dock — often $50–$100/hr. Fast, efficient loading is a direct profit center and keeps your cross-country delivery schedule intact.',
    test: ({ elapsedSec, passed }) => passed && elapsedSec < 60,
  },
  {
    id: 'TIGHT_STACK',
    icon: '📦', label: 'TIGHT STACK',
    edu: '90%+ complete rows. Every pallet braced by its neighbor distributes deceleration forces across the full load face — reducing individual strap load by up to 40% vs. a gapped load.',
    test: ({ packScore, passed }) => passed && packScore >= 0.9,
  },
  {
    id: 'DOOR_READY',
    icon: '🚪', label: 'DOOR READY',
    edu: 'Freight loaded to the rear door means full cube utilization. Using the full depth of a 26-ft box instead of 70% can increase revenue per trip by 15–25% on multi-stop cross-country runs.',
    test: ({ grid }) => { for (let c = 0; c < COLS; c++) { if (grid[c] !== null) return true; } return false; },
  },
  {
    id: 'HEAVY_FLOOR',
    icon: '🧱', label: 'HEAVY FLOOR',
    edu: 'Dense freight low keeps the center of gravity near the frame rail. High COG causes severe body roll in emergency lane changes and on mountain passes that are unavoidable on cross-country routes.',
    test: ({ pallets }) => {
      const placed = pallets.filter(p => p.placed && p.weightLbs != null);
      if (placed.length < 2) return false;
      const avg = placed.reduce((s, p) => s + p.weightLbs, 0) / placed.length;
      const heavy = placed.filter(p => p.weightLbs > avg);
      return heavy.length > 0 && heavy.every(p => (p.anchorRow ?? 0) >= Math.floor(ROWS / 2));
    },
  },
];

function calcBadges({ packScore, gapRows, balance, elapsedSec, passed, pallets, grid }) {
  return BADGE_DEFS.map(def => ({
    ...def,
    earned: def.test({ packScore, gapRows, balance, elapsedSec, passed, pallets, grid }),
  }));
}

// ── Pack Row Indicator (mini bar chart of row completeness) ──────────────────
function PackRowIndicator({ grid, gapRows, totalRows }) {
  if (totalRows === 0) return null;
  let topRow = ROWS;
  for (let r = 0; r < ROWS; r++) {
    let found = false;
    for (let c = 0; c < COLS; c++) { if (grid[r * COLS + c] !== null) { found = true; break; } }
    if (found) { topRow = r; break; }
  }
  if (topRow === ROWS) return null;

  const shiftLabel = gapRows === 0    ? 'ZERO SHIFT RISK'
    : gapRows <= 1                    ? 'LOW SHIFT RISK'
    : gapRows <= 3                    ? 'MODERATE SHIFT RISK'
    :                                   'HIGH SHIFT RISK';
  const shiftColor = gapRows === 0    ? BP.good
    : gapRows <= 1                    ? '#A8D060'
    : gapRows <= 3                    ? '#E0A020'
    :                                   BP.warn;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 7, letterSpacing: '0.15em', color: BP.dim, marginBottom: 4, fontFamily: '"Share Tech Mono","Courier New",monospace', textAlign: 'center' }}>
        ROW PACK ANALYSIS
      </div>
      <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginBottom: 3 }}>
        {Array.from({ length: ROWS }, (_, r) => {
          if (r < topRow) {
            return <div key={r} style={{ width: 7, height: 10, background: BP.dimmer, borderRadius: 1, opacity: 0.4 }} />;
          }
          const rowFull = Array.from({ length: COLS }, (__, c) => grid[r * COLS + c]).every(v => v !== null);
          return (
            <div key={r} style={{
              width: 7, height: 10, borderRadius: 1,
              background: rowFull ? BP.good : BP.warn,
              boxShadow: rowFull ? `0 0 4px ${BP.good}66` : `0 0 4px ${BP.warn}66`,
              animation: !rowFull ? 'ct-gap-pulse 1.4s ease-in-out infinite' : 'none',
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 2 }}>
        {[{ color: BP.good, label: '■ COMPLETE' }, { color: BP.warn, label: '■ GAPS' }].map(({ color, label }) => (
          <span key={label} style={{ fontSize: 7, color, fontFamily: '"Share Tech Mono","Courier New",monospace', letterSpacing: '0.06em' }}>{label}</span>
        ))}
      </div>
      <div style={{ fontSize: 8, color: shiftColor, letterSpacing: '0.12em', textAlign: 'center', fontFamily: '"Share Tech Mono","Courier New",monospace' }}>
        {shiftLabel}
      </div>
    </div>
  );
}

// ── Badge Row ─────────────────────────────────────────────────────────────────
function BadgeRow({ badges }) {
  const earned = badges.filter(b => b.earned);
  if (earned.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 7, letterSpacing: '0.15em', color: BP.dim, marginBottom: 5, fontFamily: '"Share Tech Mono","Courier New",monospace', textAlign: 'center' }}>
        BADGES EARNED
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {earned.map((b, i) => (
          <div key={b.id} className="ct-row-in" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: `${BP.dim}22`, border: `1px solid ${BP.dim}66`,
            borderRadius: 3, padding: '4px 8px', minWidth: 52,
            animationDelay: `${i * 80 + 200}ms`, animationFillMode: 'both',
          }}>
            <span style={{ fontSize: 15 }}>{b.icon}</span>
            <span style={{ fontSize: 7, color: BP.line, letterSpacing: '0.08em', textAlign: 'center', fontFamily: '"Share Tech Mono","Courier New",monospace', lineHeight: 1.2 }}>
              {b.label}
            </span>
          </div>
        ))}
      </div>
      {/* Show edu text for first badge earned */}
      <div style={{ marginTop: 5, padding: '4px 8px', background: `${BP.dimmer}`, borderRadius: 2 }}>
        <div style={{ fontSize: 7, color: BP.mid, lineHeight: 1.6, fontFamily: '"Share Tech Mono","Courier New",monospace', letterSpacing: '0.04em' }}>
          {earned[0].edu}
        </div>
      </div>
    </div>
  );
}

// ── Pro Driver Tip Card ───────────────────────────────────────────────────────
function DriverTipCard({ tip }) {
  if (!tip) return null;
  return (
    <div className="ct-row-in" style={{
      marginTop: 8, padding: '7px 10px',
      border: `1px solid ${BP.dim}55`,
      background: `${BP.dimmer}`,
      borderRadius: 2,
      animationDelay: '600ms', animationFillMode: 'both',
    }}>
      <div style={{ fontSize: 7, letterSpacing: '0.16em', color: BP.dim, marginBottom: 3, fontFamily: '"Share Tech Mono","Courier New",monospace' }}>
        💡 PRO TIP · {tip.cat}
      </div>
      <div style={{ fontSize: 8, color: BP.mid, lineHeight: 1.65, fontFamily: '"Share Tech Mono","Courier New",monospace', letterSpacing: '0.03em' }}>
        {tip.tip}
      </div>
    </div>
  );
}

// ── Incident Report (shown for timeouts or dangerous loads) ───────────────────
function IncidentReport({ timedOut, packScore, balance, elapsedSec }) {
  const isBadLoad = packScore < 0.5 || balance.rating === 'DANGEROUS';
  if (!timedOut && !isBadLoad) return null;

  const reason = timedOut           ? 'DOCK TIME LIMIT EXCEEDED'
    : balance.rating === 'DANGEROUS' ? 'DANGEROUS WEIGHT DISTRIBUTION'
    :                                  'SEVERE LOAD GAPS — HIGH SHIFT RISK';

  const detentionFee = timedOut ? Math.max(0, Math.round((elapsedSec - 120) / 3600 * 85 * 100) / 100) : 0;
  const claimRisk    = packScore < 0.5 ? '$4,200 – $28,000'
    : packScore < 0.7                  ? '$800 – $4,200'
    : balance.rating === 'DANGEROUS'   ? '$2,000 – $15,000'
    : null;

  return (
    <div style={{
      marginTop: 8, padding: '8px 10px',
      border: `1px solid ${BP.warn}88`,
      background: `${BP.warn}0E`,
      borderRadius: 2,
      animation: 'ct-incident-slide 0.4s ease-out 700ms both',
    }}>
      <div style={{ fontSize: 8, color: BP.warn, letterSpacing: '0.18em', marginBottom: 4, fontFamily: '"Share Tech Mono","Courier New",monospace' }}>
        ⚠ INCIDENT REPORT
      </div>
      <div style={{ fontSize: 7, color: `${BP.warn}CC`, letterSpacing: '0.06em', lineHeight: 1.75, fontFamily: '"Share Tech Mono","Courier New",monospace' }}>
        CAUSE: {reason}<br />
        {detentionFee > 0 && <>DETENTION FEE EST.: ${detentionFee.toFixed(2)}/HR<br /></>}
        {claimRisk     && <>CARGO CLAIM EXPOSURE: {claimRisk}<br /></>}
        STATUS: LOAD REVIEW REQUIRED BEFORE DEPARTURE
      </div>
    </div>
  );
}

// =============================================================================
//  SECTION 14 — COMPLETE OVERLAY
// =============================================================================

function CompleteOverlay({ passed, xpFinal, balance, balColor, fwdPct, elapsedSec,
                           timeBonus, balMod, fillMod, packScore, gapRows, totalRows,
                           grid, pallets, badges, tip,
                           totalWeight, frameW, gridH, FRAME_TOP, onDismiss, showClose }) {
  const xpDisplayed = useCountUp(xpFinal, 1100);
  const mins   = Math.floor(elapsedSec / 60);
  const secs   = elapsedSec % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  const rows = [
    { label: 'BASE',    value: passed ? `+${BASE_PASS_XP}` : '0',               color: BP.offWhite,                                                                    delay: 100 },
    { label: 'TIME',    value: timeBonus > 0 ? `+${timeBonus}` : '+0',           color: timeBonus > 0 ? BP.line : BP.dim,                                               delay: 220 },
    { label: 'BALANCE', value: balMod >= 0 ? `+${balMod}` : `${balMod}`,         color: balMod > 0 ? BP.good : balMod < 0 ? BP.warn : BP.dim,                           delay: 340 },
    { label: 'PACKING', value: fillMod >= 0 ? `+${fillMod}` : `${fillMod}`,      color: fillMod > 0 ? BP.good : fillMod < 0 ? BP.warn : BP.dim,                         delay: 460 },
  ];

  const packPct    = Math.round(packScore * 100);
  const shiftCoach = !passed ? null
    : packScore >= 1.00 ? { text: 'TETRIS PACK · ZERO SHIFT RISK — DOT COMPLIANT',          color: BP.good   }
    : packScore >= 0.85 ? { text: 'MINOR GAPS · STRAP TOP ROW · CHECK LATERAL MOVEMENT',    color: '#A8D060' }
    : packScore >= 0.60 ? { text: 'MODERATE GAPS · CARGO SHIFT RISK UNDER HARD BRAKING',    color: '#E0A020' }
    :                     { text: 'SEVERE GAPS · HIGH SHIFT RISK · USE LOAD BARS TO FILL',  color: BP.warn   };

  return (
    <div className="ct-complete-in" style={{
      position: 'absolute', top: FRAME_TOP, left: 0, width: frameW, height: gridH,
      background: 'rgba(3,4,12,0.94)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      overflowY: 'auto', scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      zIndex: 10, paddingTop: 12, paddingBottom: 14,
      fontFamily: '"Share Tech Mono", "Courier New", monospace',
    }}>
      {/* ── Result header ── */}
      <div style={{ fontSize: passed ? 18 : 14, fontWeight: 'bold', letterSpacing: '0.22em', color: passed ? BP.good : BP.warn, marginBottom: 8 }}>
        {passed ? '✓ TRUCK LOADED' : '✗ TIMED OUT'}
      </div>

      {/* ── XP total ── */}
      <div className={passed ? 'ct-xp-glow' : undefined}
        style={{ fontSize: 40, fontWeight: 'bold', color: passed ? BP.line : BP.dim, letterSpacing: '0.05em', lineHeight: 1, marginBottom: 4 }}>
        {xpDisplayed}<span style={{ fontSize: 13, color: BP.mid, marginLeft: 6 }}>XP</span>
      </div>

      <div style={{ width: frameW * 0.6, height: 1, background: BP.dim, margin: '6px 0 6px' }} />

      {/* ── XP breakdown rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', width: frameW * 0.62 }}>
        {rows.map(({ label, value, color, delay }) => (
          <div key={label} className="ct-row-in" style={{ display: 'flex', justifyContent: 'space-between', animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
            <span style={{ fontSize: 9, letterSpacing: '0.18em', color: BP.mid }}>{label}</span>
            <span style={{ fontSize: 9, color, fontWeight: 'bold' }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ width: frameW * 0.6, height: 1, background: BP.dim, margin: '6px 0 5px' }} />

      {/* ── Stats footer ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
        <div style={{ fontSize: 9, color: balColor, letterSpacing: '0.14em', fontWeight: 'bold' }}>
          {balance.rating} · {fwdPct}% FWD
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 9, color: BP.dim, letterSpacing: '0.08em' }}>{totalWeight.toLocaleString()} LBS</span>
          <span style={{ fontSize: 9, color: BP.dim, letterSpacing: '0.08em' }}>PACK {packPct}%</span>
          <span style={{ fontSize: 9, color: BP.dim, letterSpacing: '0.08em' }}>{timeStr}</span>
        </div>
      </div>

      {/* ── Shift coach line ── */}
      {shiftCoach && (
        <div className="ct-row-in" style={{ marginTop: 5, padding: '4px 10px', border: `1px solid ${shiftCoach.color}44`, background: `${shiftCoach.color}0D`, animationDelay: '540ms', animationFillMode: 'both' }}>
          <span style={{ fontSize: 7, letterSpacing: '0.1em', color: shiftCoach.color }}>{shiftCoach.text}</span>
        </div>
      )}

      {/* ── Pack row indicator (gap map) ── */}
      {passed && (
        <PackRowIndicator grid={grid} gapRows={gapRows} totalRows={totalRows} />
      )}

      <div style={{ width: frameW * 0.6, height: 1, background: `${BP.dim}55`, margin: '7px 0 0' }} />

      {/* ── Badges ── */}
      {passed && (
        <div style={{ width: frameW * 0.88 }}>
          <BadgeRow badges={badges} />
        </div>
      )}

      {/* ── Pro driver tip ── */}
      <div style={{ width: frameW * 0.88 }}>
        <DriverTipCard tip={tip} />
      </div>

      {/* ── Incident report (timedOut or dangerous load) ── */}
      <div style={{ width: frameW * 0.88 }}>
        <IncidentReport timedOut={!passed} packScore={packScore} balance={balance} elapsedSec={elapsedSec} />
      </div>

      {/* ── Close button ── */}
      <div style={{ marginTop: 14, height: 32, opacity: showClose ? 1 : 0, transition: 'opacity 0.4s ease', pointerEvents: showClose ? 'auto' : 'none' }}>
        <button
          onClick={() => onDismiss?.()}
          onTouchStart={(e) => e.currentTarget.style.opacity = '0.65'}
          onTouchEnd={(e)   => e.currentTarget.style.opacity = '1'}
          onTouchCancel={(e)=> e.currentTarget.style.opacity = '1'}
          style={{ background: 'transparent', border: `1px solid ${BP.dim}`, color: BP.mid, fontFamily: '"Share Tech Mono", "Courier New", monospace', fontSize: 11, letterSpacing: '0.2em', padding: '6px 24px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}

// =============================================================================
//  SECTION 15 — GRID CELL
// =============================================================================

const GridCell = memo(function GridCell({
  col, row, palletId, pallets,
  isFalling, isGhost, fallingColor, ghostColor,
  lastLockedId, cellPx,
}) {
  const pallet      = palletId ? pallets.find(p => p.id === palletId) : null;
  const isFlashing  = pallet && pallet.id === lastLockedId;

  const cellBg = pallet    ? pallet.color
    : isFalling            ? fallingColor
    : isGhost              ? `${ghostColor}35`
    : BP.floor;

  const cellBorder = isFalling  ? `1px solid ${fallingColor}`
    : isGhost                   ? `1px dashed ${ghostColor}55`
    : pallet                    ? `1px solid ${pallet.color}55`
    : `1px solid ${BP.dimmer}`;

  const showLabel   = cellPx >= 32;
  const labelSize   = Math.max(6, Math.round(cellPx * 0.15));
  const weightSize  = Math.max(7, Math.round(cellPx * 0.18));

  return (
    <div
      className={isFlashing ? 'ct-lock-flash' : ''}
      data-col={col}
      data-row={row}
      style={{
        width:      cellPx,
        height:     cellPx,
        background: cellBg,
        border:     cellBorder,
        boxSizing:  'border-box',
        position:   'relative',
        transition: isFalling ? 'none' : 'background 0.1s, border-color 0.1s',
        ...(pallet ? {
          boxShadow: `inset 1px 1px 0 ${pallet.color}BB, inset -1px -1px 0 rgba(0,0,0,0.45)`,
        } : isFalling ? {
          boxShadow: `inset 0 0 0 1px ${fallingColor}88`,
        } : {}),
      }}
    >
      {/* Label on anchor cell of placed pallet */}
      {pallet && pallet.anchorCol === col && pallet.anchorRow === row && showLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 1 }}>
          <div style={{ fontSize: labelSize, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em', fontFamily: '"Share Tech Mono", "Courier New", monospace', lineHeight: 1 }}>
            {pallet.stopLabel ?? pallet.label}
          </div>
          <div style={{ fontSize: weightSize, fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', fontFamily: '"Share Tech Mono", "Courier New", monospace', lineHeight: 1 }}>
            {pallet.weightLbs}
          </div>
        </div>
      )}
      {/* Label on falling piece anchor */}
      {isFalling && showLabel && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: labelSize, color: 'rgba(255,255,255,0.7)', fontFamily: '"Share Tech Mono", "Courier New", monospace', lineHeight: 1 }}>
            ▼
          </div>
        </div>
      )}
    </div>
  );
});

// =============================================================================
//  SECTION 16 — TRUCK SVG DECORATIVE ELEMENTS
// =============================================================================

function TieDownAnchor({ x, y }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-4} y={-8} width={2} height={16} fill={BP.mid} opacity={0.7} />
      <rect x={2}  y={-8} width={2} height={16} fill={BP.mid} opacity={0.7} />
      <rect x={-4} y={-2} width={8} height={3}  fill={BP.line} opacity={0.8} />
      <rect x={-4} y={-8} width={2} height={2}  fill={BP.line} opacity={0.9} />
      <rect x={2}  y={-8} width={2} height={2}  fill={BP.line} opacity={0.9} />
    </g>
  );
}

const CAB_IMG_ASPECT = 354 / 471;
const CAB_IMG_SRC = 'data:image/jpeg;base64,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';

function TruckCabSVG({ frameW, startY }) {
  const imgH = Math.round(frameW * CAB_IMG_ASPECT);
  return (
    <image href={CAB_IMG_SRC} x={0} y={startY} width={frameW} height={imgH}
      preserveAspectRatio="xMidYMin meet" />
  );
}

// ── Shift Risk Overlay — plays on the actual game grid at COMPLETE start ──────
// Cells in incomplete rows animate shifting forward (cab direction) to
// simulate what happens to unsecured freight under emergency braking.
// Full rows glow green — they're braced. Gap rows shift and fade.
// Auto-fades after ~2.2s so the CompleteOverlay beneath is revealed.
function ShiftRiskOverlay({ grid, cellPx, PAD, FRAME_TOP, gapRows }) {
  // Only show if there are actual gaps — nothing to demonstrate on a perfect pack
  if (gapRows === 0) return null;

  const gridW  = COLS * cellPx;
  const gridH  = ROWS * cellPx;
  const CELL   = cellPx;

  // Determine top of loaded zone
  let topRow = ROWS;
  for (let r = 0; r < ROWS; r++) {
    let found = false;
    for (let c = 0; c < COLS; c++) { if (grid[r * COLS + c] !== null) { found = true; break; } }
    if (found) { topRow = r; break; }
  }

  return (
    <div style={{
      position: 'absolute', left: 0, top: 0,
      width: PAD * 2 + gridW, height: FRAME_TOP + gridH,
      zIndex: 12, pointerEvents: 'none',
      animation: 'ct-shift-overlay-out 2.2s ease-out forwards',
    }}>
      {/* Dark tint behind animation so cells are readable */}
      <div style={{
        position: 'absolute', left: PAD, top: FRAME_TOP, width: gridW, height: gridH,
        background: 'rgba(3,4,12,0.72)',
      }} />

      {/* Brake event label */}
      <div style={{
        position: 'absolute', left: PAD, top: FRAME_TOP + 6,
        width: gridW, textAlign: 'center',
        fontSize: 8, letterSpacing: '0.22em', color: BP.warn,
        fontFamily: '"Share Tech Mono","Courier New",monospace',
        animation: 'ct-shift-label-in 0.3s ease-out 0.1s both',
        textShadow: `0 0 10px ${BP.warn}`,
        zIndex: 1,
      }}>
        ◀ SIMULATING BRAKE EVENT
      </div>

      {/* Render each cell with shift or hold animation */}
      {Array.from({ length: ROWS }, (_, r) => {
        if (r < topRow) return null;

        const rowCells = Array.from({ length: COLS }, (__, c) => grid[r * COLS + c]);
        const rowFull  = rowCells.every(v => v !== null);

        return rowCells.map((palletId, c) => {
          if (palletId === null) {
            // Gap cell — pulse red to highlight the void
            return (
              <div key={`gap-${r}-${c}`} style={{
                position: 'absolute',
                left: PAD + c * CELL,
                top:  FRAME_TOP + r * CELL,
                width: CELL - 1, height: CELL - 1,
                background: `${BP.warn}22`,
                border: `1px dashed ${BP.warn}88`,
                animation: 'ct-gap-pulse 0.6s ease-in-out 0.15s infinite',
              }} />
            );
          }

          // Find pallet color from grid palletId
          // palletId is a string like 'p0', color encoded in STOP_COLORS by stop index
          // We use a stable color derived from the palletId string
          const colorIdx  = parseInt(palletId.replace(/\D/g,''), 10) % STOP_COLORS.length;
          const cellColor = STOP_COLORS[colorIdx] || BP.line;

          if (rowFull) {
            // Full row — hold animation, green tint glow
            return (
              <div key={`hold-${r}-${c}`} style={{
                position: 'absolute',
                left: PAD + c * CELL,
                top:  FRAME_TOP + r * CELL,
                width: CELL - 1, height: CELL - 1,
                background: `${cellColor}CC`,
                border: `1px solid ${cellColor}88`,
                '--pc': cellColor,
                animation: 'ct-cargo-hold 1.2s ease-in-out 0.2s infinite',
                boxShadow: `0 0 4px ${BP.good}44`,
              }} />
            );
          }

          // Gap row — cells shift forward (toward cab = downward in overhead view)
          // Stagger by column so the shift looks chaotic, not synchronized
          const delay = 0.18 + c * 0.07;
          return (
            <div key={`shift-${r}-${c}`} style={{
              position: 'absolute',
              left: PAD + c * CELL,
              top:  FRAME_TOP + r * CELL,
              width: CELL - 1, height: CELL - 1,
              background: `${cellColor}BB`,
              border: `1px solid ${cellColor}66`,
              animation: `ct-cargo-shift 1.6s cubic-bezier(0.4,0,1,1) ${delay}s forwards`,
            }} />
          );
        });
      })}

      {/* Result label at bottom of loaded zone */}
      <div style={{
        position: 'absolute',
        left: PAD, top: FRAME_TOP + gridH - 22, width: gridW,
        textAlign: 'center',
        fontSize: 7, letterSpacing: '0.16em',
        color: BP.warn, fontFamily: '"Share Tech Mono","Courier New",monospace',
        animation: 'ct-shift-label-in 0.3s ease-out 1.0s both',
        textShadow: `0 0 8px ${BP.warn}`,
      }}>
        {gapRows} UNSECURED ROW{gapRows > 1 ? 'S' : ''} · CARGO SHIFT DETECTED
      </div>
    </div>
  );
}

// ── Strap Animation — single strap across the top row of loaded freight ───────
function StrapAnimation({ grid, cellPx, PAD, FRAME_TOP }) {
  let topRow = null;
  for (let r = 0; r < ROWS; r++) {
    let found = false;
    for (let c = 0; c < COLS; c++) { if (grid[r * COLS + c] !== null) { found = true; break; } }
    if (found) { topRow = r; break; }
  }
  if (topRow === null) return null;

  const gridW     = COLS * cellPx;
  const strapH    = Math.max(5, Math.round(cellPx * 0.14));
  const strapY    = FRAME_TOP + topRow * cellPx + Math.round(cellPx * 0.4);
  const buckleW   = Math.max(6, Math.round(cellPx * 0.24));
  const buckleH   = Math.max(9, Math.round(cellPx * 0.4));
  const buckleTop = strapY - Math.round((buckleH - strapH) / 2);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: PAD * 2 + gridW, pointerEvents: 'none', zIndex: 4 }}>
      {/* Strap body */}
      <div style={{
        position: 'absolute', left: PAD, top: strapY, width: gridW, height: strapH,
        background: `linear-gradient(90deg, ${BP.good}BB, ${BP.good}FF 40%, ${BP.good}FF 60%, ${BP.good}BB)`,
        boxShadow: `0 0 10px ${BP.good}88, 0 0 3px ${BP.good}`,
        borderRadius: 1, transformOrigin: 'left center',
        animation: 'ct-strap-extend 0.65s cubic-bezier(0.4,0,0.2,1) forwards',
      }} />
      {/* Strap tension shimmer (after extend) */}
      <div style={{
        position: 'absolute', left: PAD + gridW * 0.3, top: strapY, width: gridW * 0.4, height: strapH,
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)`,
        animation: 'ct-strap-tension 1.2s ease-in-out 0.7s infinite',
        borderRadius: 1, pointerEvents: 'none',
      }} />
      {/* Left buckle */}
      <div style={{
        position: 'absolute', left: PAD - Math.round(buckleW * 0.4), top: buckleTop,
        width: buckleW, height: buckleH,
        background: BP.line, borderRadius: 1,
        boxShadow: `0 0 6px ${BP.line}88`,
        animation: 'ct-buckle-appear 0.25s ease-out 0.62s both',
      }} />
      {/* Right buckle */}
      <div style={{
        position: 'absolute', right: PAD - Math.round(buckleW * 0.4), top: buckleTop,
        width: buckleW, height: buckleH,
        background: BP.line, borderRadius: 1,
        boxShadow: `0 0 6px ${BP.line}88`,
        animation: 'ct-buckle-appear 0.25s ease-out 0.62s both',
      }} />
      {/* Label */}
      <div style={{
        position: 'absolute', left: PAD + gridW / 2, top: strapY - 13,
        transform: 'translateX(-50%)',
        fontSize: 7, color: BP.good, letterSpacing: '0.14em',
        fontFamily: '"Share Tech Mono","Courier New",monospace',
        animation: 'ct-buckle-appear 0.25s ease-out 0.75s both',
        whiteSpace: 'nowrap',
        textShadow: `0 0 8px ${BP.good}`,
      }}>
        ⊠ STRAP TENSIONED
      </div>
    </div>
  );
}

// =============================================================================
//  SECTION 17 — TRUCK GRID
// =============================================================================

function TruckGrid({ state, dispatch, cellPx, onDismiss, showOverlayClose, hapticsEnabled }) {
  const haptics = useHaptics(hapticsEnabled);

  // Precompute falling piece cells
  const { fallingAbsCells, ghostAbsCells, activeColor } = useMemo(() => {
    const { fallingPiece, pallets, grid } = state;
    if (!fallingPiece) return { fallingAbsCells: new Set(), ghostAbsCells: new Set(), activeColor: BP.line };

    const pallet = pallets.find(p => p.id === fallingPiece.palletId);
    if (!pallet) return { fallingAbsCells: new Set(), ghostAbsCells: new Set(), activeColor: BP.line };

    const cells   = getCells(pallet.shapeId, fallingPiece.rotation);
    const abs     = getAbsoluteCells(cells, fallingPiece.col, fallingPiece.row) || [];
    const dropRow = calcDropRow(cells, fallingPiece.col, fallingPiece.row, grid);

    const fallingSet = new Set(abs.map(([c, r]) => `${c},${r}`));
    const ghostSet   = dropRow === fallingPiece.row
      ? new Set()
      : new Set((getAbsoluteCells(cells, fallingPiece.col, dropRow) || []).map(([c, r]) => `${c},${r}`));

    return { fallingAbsCells: fallingSet, ghostAbsCells: ghostSet, activeColor: pallet.color };
  }, [state.fallingPiece, state.pallets, state.grid]);

  // Lock flash + haptic
  const lastLockedId    = state.lastLockedId;
  const prevLockSeqRef  = useRef(state.lockSeq);
  useEffect(() => {
    if (state.lockSeq === prevLockSeqRef.current) return;
    prevLockSeqRef.current = state.lockSeq;
    haptics.lock();
    const id = setTimeout(() => dispatch({ type: 'CLEAR_LAST_LOCKED' }), 200);
    return () => clearTimeout(id);
  }, [state.lockSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout constants
  const CELL       = cellPx;
  const PAD        = FRAME_H_PAD;
  const gridW      = COLS * CELL;
  const gridH      = ROWS * CELL;
  const frameW     = gridW + PAD * 2;
  const FRAME_CAB  = Math.round(frameW * CAB_IMG_ASPECT);
  const FRAME_TOP  = Math.max(20, Math.round(CELL * 0.55));
  const FRAME_BOT  = Math.max(20, Math.round(CELL * 0.55));
  const frameH     = FRAME_TOP + gridH + FRAME_CAB + FRAME_BOT;

  const anchorRows = [1, 3, 6, 9, 11].map(r => FRAME_TOP + r * CELL + CELL * 0.5);
  const leftX      = PAD / 2;
  const rightX     = frameW - PAD / 2;

  // Swipe-to-move on the grid
  const touchStartRef = useRef(null);
  const onGridTouchStart = useCallback((e) => {
    if (state.phase !== 'FALLING') return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [state.phase]);

  const onGridTouchEnd = useCallback((e) => {
    if (state.phase !== 'FALLING' || !touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx < 12 && absDy < 12) {
      // Short tap = rotate
      dispatch({ type: 'ROTATE' });
    } else if (absDy > absDx * 1.5 && dy > 0) {
      // Downward swipe = hard drop
      haptics.drop();
      dispatch({ type: 'HARD_DROP' });
    } else if (absDx > absDy && absDx > 20) {
      // Horizontal swipe = move
      dispatch({ type: dx < 0 ? 'MOVE_LEFT' : 'MOVE_RIGHT' });
    }
    touchStartRef.current = null;
  }, [state.phase, dispatch, haptics]);

  return (
    <div
      onTouchStart={onGridTouchStart}
      onTouchEnd={onGridTouchEnd}
      style={{ position: 'relative', width: frameW, margin: '0 auto', flexShrink: 0 }}
    >
      {/* Scanline */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: frameH, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
        <div className="ct-scanline" style={{ position: 'absolute', left: 0, width: '100%', height: 10, background: 'linear-gradient(to bottom, transparent, rgba(68,178,228,0.06) 50%, transparent)' }} />
      </div>

      {/* SVG truck frame */}
      <svg width={frameW} height={frameH} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}>
        <defs>
          <pattern id="ct-floor-grid" x={PAD} y={FRAME_TOP} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path d={`M ${CELL} 0 L 0 0 L 0 ${CELL}`} fill="none" stroke={BP.dim} strokeWidth="0.5" opacity="0.35" />
          </pattern>
        </defs>

        {/* Cab image */}
        <TruckCabSVG frameW={frameW} startY={FRAME_TOP + gridH} />

        {/* Floor grid */}
        <rect x={PAD} y={FRAME_TOP} width={gridW} height={gridH} fill="url(#ct-floor-grid)" />

        {/* FRONT OF TRUCK label */}
        <text x={frameW / 2} y={FRAME_TOP + gridH + FRAME_CAB + FRAME_BOT - 6}
          textAnchor="middle" fill={BP.mid} fontSize={8}
          fontFamily='"Share Tech Mono", "Courier New", monospace' letterSpacing={2} opacity={0.75}>
          FRONT OF TRUCK ▲
        </text>

        {/* Outer walls */}
        <rect x={0}          y={FRAME_TOP}           width={frameW}  height={3}    fill={BP.line} />
        <rect x={0}          y={FRAME_TOP}           width={3}       height={gridH} fill={BP.line} />
        <rect x={frameW - 3} y={FRAME_TOP}           width={3}       height={gridH} fill={BP.line} />
        <rect x={0}          y={FRAME_TOP + gridH - 2} width={frameW} height={2}   fill={BP.line} />
        {/* Corner chamfers */}
        <rect x={0}          y={FRAME_TOP + 2} width={6} height={3}  fill={BP.dim} />
        <rect x={frameW - 6} y={FRAME_TOP + 2} width={6} height={3}  fill={BP.dim} />
        {/* Inner wall depth lines */}
        <rect x={3}          y={FRAME_TOP + 3} width={1} height={gridH - 6} fill={BP.mid} opacity={0.4} />
        <rect x={frameW - 4} y={FRAME_TOP + 3} width={1} height={gridH - 6} fill={BP.mid} opacity={0.4} />
        {/* Rear door threshold sill */}
        <rect x={3} y={FRAME_TOP + 10} width={frameW - 6} height={2} fill={BP.mid} opacity={0.7} />

        {/* Tie-down rail channels */}
        {anchorRows.map((ay, i) => <TieDownAnchor key={i}      x={leftX}  y={ay} />)}
        {anchorRows.map((ay, i) => <TieDownAnchor key={i + 10} x={rightX} y={ay} />)}

        {/* REAR DOOR label */}
        <text x={frameW / 2} y={FRAME_TOP - 6} textAnchor="middle" fill={BP.dim}
          fontSize={10} fontFamily='"Share Tech Mono", "Courier New", monospace' letterSpacing={3}>
          ▼ Rear Door
        </text>
      </svg>

      {/* Cargo floor grid cells */}
      <div style={{
        position: 'absolute', left: PAD, top: FRAME_TOP,
        width: gridW, height: gridH,
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
        gridTemplateRows:    `repeat(${ROWS}, ${CELL}px)`,
        zIndex: 1,
      }}>
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const idx      = row * COLS + col;
            const key      = `${col},${row}`;
            const isFalling = fallingAbsCells.has(key);
            const isGhost   = !isFalling && ghostAbsCells.has(key);
            return (
              <GridCell
                key={`${col}-${row}`}
                col={col} row={row}
                palletId={isFalling ? null : state.grid[idx]}
                pallets={state.pallets}
                isFalling={isFalling}
                isGhost={isGhost}
                fallingColor={activeColor}
                ghostColor={activeColor}
                lastLockedId={lastLockedId}
                cellPx={CELL}
              />
            );
          })
        )}
      </div>

      {/* COMPLETE — shift risk animation plays first, then CompleteOverlay beneath */}
      {state.phase === 'COMPLETE' && (() => {
        const { gapRows } = calcPackScore(state.grid);
        return (
          <ShiftRiskOverlay
            grid={state.grid} cellPx={CELL} PAD={PAD}
            FRAME_TOP={FRAME_TOP} gapRows={gapRows}
          />
        );
      })()}

      {/* COMPLETE overlay */}
      {state.phase === 'COMPLETE' && (() => {
        const passed     = !state.timedOut;
        const { packScore, completeRows, totalRows, gapRows, gapCells } = calcPackScore(state.grid);
        const xpFinal    = calcXP(passed, state.elapsedMs, state.frontWeight, state.totalWeight, packScore);
        const balance    = calcBalance(state.frontWeight, state.totalWeight);
        const fwdPct     = state.totalWeight > 0 ? Math.round(state.frontWeight / state.totalWeight * 100) : 0;
        const elapsedSec = Math.round(state.elapsedMs / 1000);
        const timeBonus  = passed ? Math.round(MAX_TIME_BONUS_XP * Math.max(0, 1 - elapsedSec / BONUS_WINDOW_SEC)) : 0;
        const balMod     = passed ? balance.xpMod : 0;
        const fillMod    = passed ? calcFillBonus(packScore) : 0;
        const balColor   = balance.rating === 'OPTIMAL' ? BP.good : balance.rating === 'ACCEPTABLE' ? BP.line
          : balance.rating === 'REAR HEAVY' ? '#E0A020' : balance.rating === 'DANGEROUS' ? BP.warn : BP.dim;
        const badges     = calcBadges({ packScore, gapRows, balance, elapsedSec, passed, pallets: state.pallets, grid: state.grid });
        const tip        = selectTip(state.elapsedMs, state.pallets.length);

        return (
          <CompleteOverlay
            passed={passed} xpFinal={xpFinal} balance={balance} balColor={balColor}
            fwdPct={fwdPct} elapsedSec={elapsedSec} timeBonus={timeBonus}
            balMod={balMod} fillMod={fillMod} packScore={packScore}
            gapRows={gapRows} totalRows={totalRows} grid={state.grid}
            pallets={state.pallets} badges={badges} tip={tip}
            totalWeight={state.totalWeight} frameW={frameW} gridH={gridH}
            FRAME_TOP={FRAME_TOP} onDismiss={onDismiss} showClose={showOverlayClose}
          />
        );
      })()}

      {/* ALL_PLACED — strap animation + green tint */}
      {state.phase === 'ALL_PLACED' && (
        <>
          <StrapAnimation grid={state.grid} cellPx={CELL} PAD={PAD} FRAME_TOP={FRAME_TOP} />
          <div className="ct-slide-up" style={{
            position: 'absolute', left: PAD, top: FRAME_TOP, width: gridW, height: gridH,
            background: `${BP.good}08`, zIndex: 3, pointerEvents: 'none',
          }} />
        </>
      )}

      {/* Spacer */}
      <div style={{ width: frameW, height: frameH, visibility: 'hidden' }} />
    </div>
  );
}

// =============================================================================
//  SECTION 18 — MAIN COMPONENT
// =============================================================================

export default function CargoTetris({ onComplete, onDismiss, loads }) {
  const [state, dispatch]   = useReducer(cargoReducer, loads, buildInitialState);
  const startTimeRef        = useRef(state.startTime);
  const pausedMsRef         = useRef(0);
  const pauseStartRef       = useRef(null);

  const [closeConfirm,     setCloseConfirm]     = useState(false);
  const [showOverlayClose, setShowOverlayClose] = useState(false);
  const [showSecureBanner, setShowSecureBanner] = useState(false);
  const [hapticsEnabled,   setHapticsEnabled]   = useState(() => {
    try { return localStorage.getItem('ct-haptics') !== 'off'; } catch (_) { return true; }
  });
  const toggleHaptics = () => {
    setHapticsEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('ct-haptics', next ? 'on' : 'off'); } catch (_) {}
      return next;
    });
  };

  useCSSInjection();

  useEffect(() => { if (DEV) runLogicTests(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Gravity interval ────────────────────────────────────────────────────────
  const placedCount = state.pallets.filter(p => p.placed).length;
  const gravityMs   = computeGravityMs(placedCount);

  useEffect(() => {
    if (state.phase !== 'FALLING') return;
    const id = setInterval(() => dispatch({ type: 'GRAVITY_TICK' }), gravityMs);
    return () => clearInterval(id);
  }, [state.phase, gravityMs]);

  // ── Wall-clock timer (paused when hidden) ───────────────────────────────────
  useEffect(() => {
    if (state.phase === 'COMPLETE') return;
    const id = setInterval(() => {
      const hiddenNow = pauseStartRef.current !== null ? Date.now() - pauseStartRef.current : 0;
      const elapsed   = Date.now() - startTimeRef.current - pausedMsRef.current - hiddenNow;
      elapsed >= HARD_TIMEOUT_MS
        ? dispatch({ type: 'TIMEOUT' })
        : dispatch({ type: 'TICK', elapsedMs: elapsed });
    }, 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'COMPLETE') return;
    const onVisChange = () => {
      if (document.hidden) { pauseStartRef.current = Date.now(); }
      else {
        if (pauseStartRef.current !== null) {
          pausedMsRef.current += Date.now() - pauseStartRef.current;
          pauseStartRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, [state.phase]);

  // ── Haptics for phase transitions ───────────────────────────────────────────
  const mainHaptics = useHaptics(hapticsEnabled);
  useEffect(() => {
    if (state.phase !== 'ALL_PLACED') return;
    mainHaptics.advance();
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show "SECURE LOAD" banner on ALL_PLACED ─────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'ALL_PLACED') { setShowSecureBanner(false); return; }
    setShowSecureBanner(true);
    const id = setTimeout(() => setShowSecureBanner(false), 3000);
    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard controls (desktop) ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (state.phase === 'FALLING') {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); dispatch({ type: 'MOVE_LEFT'  }); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'MOVE_RIGHT' }); return; }
        if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'HARD_DROP' }); return; }
        if (e.key === 'ArrowUp'   || e.key === 'z' || e.key === 'Z') { e.preventDefault(); dispatch({ type: 'ROTATE' }); return; }
      }
      if (state.phase === 'ALL_PLACED') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dispatch({ type: 'SECURE_LOAD' }); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.phase]);

  // ── Close-confirm auto-reset ─────────────────────────────────────────────────
  useEffect(() => {
    if (!closeConfirm) return;
    const id = setTimeout(() => setCloseConfirm(false), 2500);
    return () => clearTimeout(id);
  }, [closeConfirm]);

  // ── Fire onComplete ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'COMPLETE') return;
    const passed    = !state.timedOut;
    const { packScore } = calcPackScore(state.grid);
    const xpEarned  = calcXP(passed, state.elapsedMs, state.frontWeight, state.totalWeight, packScore);
    const { rating: balanceRating, xpMod: balanceMod } = calcBalance(state.frontWeight, state.totalWeight);
    const fillMod   = calcFillBonus(packScore);
    const payload   = {
      passed, xpEarned, balanceRating, balanceMod,
      packScore, fillMod,
      totalWeightLbs: state.totalWeight,
      frontWeightLbs: state.frontWeight,
      rearWeightLbs:  state.rearWeight,
      elapsedSec:     Math.round(state.elapsedMs / 1000),
      timedOut:       state.timedOut,
    };
    const id = setTimeout(() => {
      onComplete?.(payload);
      setShowOverlayClose(true);
    }, 2500);
    return () => clearTimeout(id);
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const cellPx        = useDynamicCell();
  const isLandscape   = useOrientation();
  const bonusFrac     = selectBonusFraction(state.elapsedMs);
  const fallingPallet = state.fallingPiece
    ? state.pallets.find(p => p.id === state.fallingPiece.palletId)
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      paddingTop:    'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft:   'env(safe-area-inset-left, 0px)',
      paddingRight:  'env(safe-area-inset-right, 0px)',
      display: 'flex', flexDirection: 'column',
      background: BP.bg,
      fontFamily: '"Share Tech Mono", "Courier New", monospace',
      color: BP.line,
      overflowX: 'hidden', overflowY: 'hidden',
      userSelect: 'none', WebkitUserSelect: 'none',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent',
    }}>

      {isLandscape && <LandscapeOverlay />}

      {/* ── HEADER BAR ───────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '5px 10px 3px', borderBottom: `1px solid ${BP.dim}`, gap: 8 }}>
        {/* Close button */}
        <button
          onClick={() => { if (closeConfirm) { onDismiss?.(); } else { setCloseConfirm(true); } }}
          onTouchStart={(e) => e.currentTarget.style.opacity = '0.65'}
          onTouchEnd={(e)   => e.currentTarget.style.opacity = '1'}
          onTouchCancel={(e)=> e.currentTarget.style.opacity = '1'}
          style={{
            flexShrink: 0, background: closeConfirm ? `${BP.warn}1A` : 'transparent',
            border: `1px solid ${closeConfirm ? BP.warn : BP.dim}`,
            color: closeConfirm ? BP.warn : BP.dim,
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            fontSize: closeConfirm ? 8 : 14, letterSpacing: closeConfirm ? '0.1em' : 0,
            padding: '4px 7px', cursor: 'pointer',
            minWidth: 34, minHeight: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}
        >
          {closeConfirm ? 'EXIT?' : '×'}
        </button>

        {/* Title */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', color: BP.mid }}>BOX TRUCK BOSS</div>
          <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: '0.12em', marginTop: 1 }}>LOAD PLAN</div>
        </div>

        {/* Haptics toggle */}
        <button
          onClick={toggleHaptics}
          onTouchStart={(e) => e.currentTarget.style.opacity = '0.6'}
          onTouchEnd={(e)   => e.currentTarget.style.opacity = '1'}
          onTouchCancel={(e)=> e.currentTarget.style.opacity = '1'}
          title={hapticsEnabled ? 'Haptics on' : 'Haptics off'}
          style={{
            flexShrink: 0, background: hapticsEnabled ? `${BP.dim}22` : 'transparent',
            border: `1px solid ${hapticsEnabled ? BP.dim : BP.dimmer}`,
            color: hapticsEnabled ? BP.mid : BP.dim,
            fontFamily: '"Share Tech Mono", "Courier New", monospace',
            fontSize: 13, lineHeight: 1, padding: '4px 7px', cursor: 'pointer',
            minWidth: 34, minHeight: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
          }}
        >
          {hapticsEnabled ? '≋' : '·'}
        </button>

        {/* XP bonus timer */}
        {state.phase !== 'COMPLETE' && (() => {
          const secsLeft  = Math.max(0, Math.ceil(BONUS_WINDOW_SEC - state.elapsedMs / 1000));
          const litPips   = Math.ceil(bonusFrac * 10);
          const pipColor  = bonusFrac > 0.5 ? BP.line : bonusFrac > 0.2 ? '#E0A020' : BP.warn;
          const bonusXP   = Math.round(MAX_TIME_BONUS_XP * bonusFrac);
          return (
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end', marginBottom: 3 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.18em', color: BP.mid }}>XP BONUS</span>
                <span style={{ fontSize: 9, fontWeight: 'bold', color: bonusFrac > 0 ? pipColor : BP.dim, fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>
                  {bonusFrac > 0 ? `+${bonusXP}` : '+0'}
                </span>
                {secsLeft > 0 && secsLeft <= BONUS_WINDOW_SEC && (
                  <span style={{ fontSize: 9, color: BP.dim, fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>{secsLeft}s</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{ width: 5, height: 11, background: i < litPips ? pipColor : BP.dimmer, border: `1px solid ${i < litPips ? `${pipColor}66` : BP.dim}`, transition: 'background 0.6s ease' }} />
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── WEIGHT BAR ───────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 5 }}>
        <WeightBar totalWeight={state.totalWeight} frontWeight={state.frontWeight} rearWeight={state.rearWeight} />
      </div>

      {/* ── STATUS STRIP ─────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1px 12px 3px', fontSize: 11, letterSpacing: '0.1em', minHeight: 18,
      }}>
        <span style={{ color: BP.mid }}>
          {state.phase === 'FALLING' && fallingPallet && (
            <span>
              <span style={{ color: fallingPallet.color }}>{fallingPallet.stopLabel}</span>
              {' · SWIPE OR USE CONTROLS'}
            </span>
          )}
          {state.phase === 'ALL_PLACED' && (
            <span style={{ color: BP.good }}>✓ ALL PALLETS PLACED</span>
          )}
          {state.phase === 'COMPLETE' && (
            <span style={{ color: state.timedOut ? BP.warn : BP.good }}>
              {state.timedOut ? '✗ TIMED OUT' : '✓ LOAD COMPLETE'}
            </span>
          )}
        </span>
        {/* Gravity speed indicator */}
        {state.phase === 'FALLING' && (
          <span style={{ color: BP.dim, fontSize: 9 }}>
            {gravityMs <= 300 ? '⚡ FAST' : gravityMs <= 500 ? '▸▸ MED' : '▸ STD'}
          </span>
        )}
        {state.phase === 'ALL_PLACED' && (
          <span style={{ color: '#E0A020', fontSize: 10 }}>⊠ SECURE BELOW</span>
        )}
      </div>

      {/* ── TRUCK GRID (scrollable) ───────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: 4, paddingBottom: 8,
        scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        <TruckGrid
          state={state} dispatch={dispatch} cellPx={cellPx}
          onDismiss={onDismiss} showOverlayClose={showOverlayClose}
          hapticsEnabled={hapticsEnabled}
        />
      </div>

      {/* ── NEXT PIECE PREVIEW ───────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${BP.dim}`, paddingTop: 4 }}>
        <NextPiecePreview
          queue={state.queue}
          pallets={state.pallets}
          fallingPiece={state.fallingPiece}
          totalWeight={state.totalWeight}
        />
      </div>

      {/* ── SECURE LOAD slide-up banner ───────────────────────────────────── */}
      {showSecureBanner && (
        <div className="ct-slide-up" style={{
          flexShrink: 0, background: `${BP.good}22`,
          borderTop: `1px solid ${BP.good}66`, borderBottom: `1px solid ${BP.good}33`,
          padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.18em', color: BP.good, fontFamily: '"Share Tech Mono", "Courier New", monospace' }}>
            ✓ ALL LOADED — TAP SECURE THE LOAD
          </span>
        </div>
      )}

      {/* ── CONTROLS BAR ─────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${BP.dim}` }}>
        <ControlsBar
          phase={state.phase}
          dispatch={dispatch}
          pallets={state.pallets}
          fallingPiece={state.fallingPiece}
          hapticsEnabled={hapticsEnabled}
        />
      </div>

    </div>
  );
}
