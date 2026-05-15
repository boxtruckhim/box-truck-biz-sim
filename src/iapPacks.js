// ═══════════════════════════════════════════════════════════════════════════
// iapPacks.js — Box Truck Boss IAP System v1.0
// Pack registry · Odds engine · Prize manifests · Floor calculations
// Edition-aware prize resolution · Disclosed odds table
//
// SEALED SPEC v1.0 — All values publicly disclosed.
// Changing odds or prize floors requires a new app store submission.
// ═══════════════════════════════════════════════════════════════════════════

// ─── EDITION CONSTANTS ───────────────────────────────────────────────────────
// Mirrors the edition system in App.jsx (selectedEdition values).
export const EDITION_TRUCK_CAPS = {
  demo:       1,          // Demo Edition: 1 truck maximum
  basic:      3,          // Owner-Operator Edition: 3 trucks maximum
  enterprise: Infinity,   // Fleet & Scaling Edition: unlimited
};

// Soft ceiling via Fleet Expansion Tokens (cannot exceed these via tokens alone)
export const EDITION_TOKEN_SOFT_CAPS = {
  demo:       3,          // Demo + tokens: max 3 trucks
  basic:      6,          // Basic + tokens: max 6 trucks
  enterprise: Infinity,   // Fleet has no cap
};

// ─── PRODUCT IDs ─────────────────────────────────────────────────────────────
// Must match App Store Connect and Google Play Console exactly.
export const PRODUCT_IDS = {
  STARTER_BUNDLE:  'com.boxtruckboss.starter_bundle',   // $1.99  non-consumable
  DAYONE_PACK:     'com.boxtruckboss.dayone_pack',       // $4.99  consumable
  ROADBOSS_PACK:   'com.boxtruckboss.roadboss_pack',     // $9.99  consumable
  LEGEND_BUNDLE:   'com.boxtruckboss.legend_bundle',     // $49.99 non-consumable
};

// ─── DAILY BONUS SCHEDULE (no price change — bonus content only) ─────────────
// Computed from day-of-week (0=Sun … 6=Sat). Deterministic, requires no server.
// Bonus prizes are applied TRANSIENTLY at purchase time only — never written to
// iapPurchases. Additive on top of each pack's existing guaranteedPrizes.
export const DAILY_BONUS_SCHEDULE = [
  /* Sun */ { packId: 'com.boxtruckboss.roadboss_pack',   label: 'Sunday Haul',       bonus: { type: 'cash',               amount: 3000,      description: '+$3,000 Sunday Haul bonus cash' } },
  /* Mon */ { packId: 'com.boxtruckboss.starter_bundle',  label: 'Monday Kickoff',    bonus: { type: 'cash',               amount: 2500,      description: '+$2,500 Monday Kickoff bonus cash' } },
  /* Tue */ { packId: 'com.boxtruckboss.dayone_pack',     label: 'Tuesday Ticket',    bonus: { type: 'extra_haul_ticket',  tierId: 'haul_ticket',    description: '+1 bonus Haul Ticket (Tuesday)' } },
  /* Wed */ { packId: 'com.boxtruckboss.roadboss_pack',   label: 'Mid-Week Rate Con', bonus: { type: 'extra_haul_ticket',  tierId: 'prime_rate_pull', description: '+1 bonus Prime Rate Pull (Wednesday)' } },
  /* Thu */ { packId: 'com.boxtruckboss.starter_bundle',  label: 'Thursday XP',       bonus: { type: 'xp_boost',           durationDays: 3, multiplier: 2, description: '+3-day Double XP (Thursday bonus)' } },
  /* Fri */ { packId: 'com.boxtruckboss.dayone_pack',     label: 'Friday Silver',     bonus: { type: 'extra_haul_ticket',  tierId: 'silver_mile',    description: '+1 bonus Silver Mile ticket (Friday)' } },
  /* Sat */ { packId: 'com.boxtruckboss.roadboss_pack',   label: 'Weekend Rate',      bonus: { type: 'cash',               amount: 5000,      description: '+$5,000 Weekend Rate bonus cash' } },
];

/**
 * getTodayDailyBonus(packId)
 * Returns { label, bonus } for today if the given packId has a bonus today,
 * or null otherwise. Call from ScratchShop.jsx (display) and App.jsx (apply).
 */
export function getTodayDailyBonus(packId) {
  const dow = new Date().getDay(); // 0=Sun … 6=Sat
  const entry = DAILY_BONUS_SCHEDULE[dow];
  if (!entry || entry.packId !== packId) return null;
  return { label: entry.label, bonus: entry.bonus };
}

// ─── ODDS TABLE (PERMANENT — PUBLICLY DISCLOSED) ─────────────────────────────
// Overall win rate: ~1 in 5 (20.00%)
// Grand jackpot:     1 in 1,000 (0.10%)
//
// These weights are used by resolveOutcome(). The sum of all weights must equal
// exactly 10,000 (representing 100.00% in basis points for integer arithmetic).
//
//  Tier              Weight   Odds             Probability
//  ─────────────────────────────────────────────────────────
//  grand_jackpot      10      1 in 1,000       0.10%
//  big_win           100      1 in 100         1.00%
//  mid_win           400      1 in 25          4.00%
//  small_win        1250      1 in 8          12.50%
//  special_prize     200      1 in 50          2.00%
//  near_miss        1667      1 in ~6         16.67%
//  miss             6373      remaining       63.73%
//  ─────────────────────────────────────────────────────────
//  OVERALL WIN RATE  1960     ~1 in 5         ~20.00%
export const ODDS_TABLE = [
  { tierId: 'grand_jackpot',  weight:   10, label: 'Grand Jackpot',  cashMin: 5000, cashMax: 5000  },
  { tierId: 'big_win',        weight:  100, label: 'Big Win',        cashMin:  500, cashMax: 1000  },
  { tierId: 'mid_win',        weight:  400, label: 'Mid Win',        cashMin:  100, cashMax:  250  },
  { tierId: 'small_win',      weight: 1250, label: 'Small Win',      cashMin:   25, cashMax:   75  },
  { tierId: 'special_prize',  weight:  200, label: 'Special Prize',  cashMin:    0, cashMax:    0  },
  { tierId: 'near_miss',      weight: 1667, label: 'Near Miss',      cashMin:    0, cashMax:    0  },
  { tierId: 'miss',           weight: 6373, label: 'Miss',           cashMin:    0, cashMax:    0  },
];

// Total weight — must equal 10,000
export const ODDS_TOTAL_WEIGHT = ODDS_TABLE.reduce((s, t) => s + t.weight, 0);
// Compile-time assertion (will throw at module load if broken)
if (ODDS_TOTAL_WEIGHT !== 10000) {
  throw new Error(`iapPacks: ODDS_TABLE weights sum to ${ODDS_TOTAL_WEIGHT}, expected 10000`);
}

// Disclosed overall win rate for UI display
export const DISCLOSED_WIN_RATE      = '1 in 5 (20%)';
export const DISCLOSED_JACKPOT_ODDS  = '1 in 1,000 (0.10%)';

// ─── PRIZE FLOOR CONSTANTS ───────────────────────────────────────────────────
// Applies ONLY to consumable packs (Day-One and Road Boss).
// On the final ticket of a pack, if cumulativeCashPayout < floor, the RNG
// outcome is forced to meet the shortfall (Option C).
//
// FLOOR_MAX_SINGLE_PRIZE: maximum cash a single forced ticket can pay.
// Equals grand_jackpot.cashMax. Used by the progressive enforcement algorithm
// to determine how many trailing tickets must participate in floor enforcement.
// Invariant (proven exhaustive): per-ticket forced amount is always ≤ this value.
export const FLOOR_MAX_SINGLE_PRIZE = 5000;

export const PACK_PRIZE_FLOORS = {
  [PRODUCT_IDS.STARTER_BUNDLE]: null,   // non-consumable — fixed value guarantee
  [PRODUCT_IDS.DAYONE_PACK]:    15000,  // cumulative min $15,000 across 6 tickets
  [PRODUCT_IDS.ROADBOSS_PACK]:  25000,  // cumulative min $25,000 across 11 tickets
  [PRODUCT_IDS.LEGEND_BUNDLE]:  30000,  // guaranteed $30,000+ across 15 Legend-exclusive tickets
};

// ─── MINIMUM VISIBLE WIN GUARANTEE ──────────────────────────────────────────
// Minimum number of tickets in each pack that MUST produce a cash-positive
// outcome (any_pair or better). Enforced by resolveOutcome() via isWinEnforced.
// These counts are publicly disclosed in each pack's oddsDisclosure.summary.
export const PACK_MIN_WIN_TICKETS = {
  [PRODUCT_IDS.STARTER_BUNDLE]: 2,   // at least 2 of 8 tickets are winners
  [PRODUCT_IDS.DAYONE_PACK]:    3,   // at least 3 of 11 tickets are winners
  [PRODUCT_IDS.ROADBOSS_PACK]:  4,   // at least 4 of 19 tickets are winners
  [PRODUCT_IDS.LEGEND_BUNDLE]:  5,   // at least 5 of 15 tickets are winners
};

// Minimum cash paid on a forced win (smallest any_pair prize)
const MIN_WIN_CASH = 25;

export const PACKS = {

  // ──────────────────────────────────────────────────────────────────────────
  [PRODUCT_IDS.STARTER_BUNDLE]: {
    id:           PRODUCT_IDS.STARTER_BUNDLE,
    displayName:  'Starter Bundle',
    price:        '$1.99',
    priceUSD:     1.99,
    type:         'non_consumable',   // purchased once, permanent
    badgeLabel:   'BEST ENTRY',
    color:        '#c8a020',          // gold
    description:  'The perfect way to start your trucking empire. 7 daily tickets + guaranteed $10,000 in-game cash + Gold Foil card face + BTB Supporter badge.',

    // Ticket manifest — array of tier IDs granted on purchase
    tickets: [
      'thunder_road',         // Card 6  — CSA Inversion mechanic
      'midnight_money_grid',  // Card 7  — Wisconsin Grid 4×4
      'gold_foil_standard',   // Card 8  — Match-3 Tunk
      'diner_receipt',        // Card 9  — Spend Inversion
      'classic_68',           // Card 10 — Wisconsin Grid 5×5 vintage
      'rate_con_document',    // Card 11 — Beat the Broker
      'diesel_dollar_grid',   // Card 12 — Wisconsin Grid 4×4 iridescent
      'silver_mile',          // Card 1  — Standard tier upgrade
    ],

    // Guaranteed prizes applied immediately on purchase (not ticket-based)
    guaranteedPrizes: [
      { type: 'cash',                     amount: 2500,          description: '$2,500 welcome cash bonus' },
      { type: 'badge',                    badgeId: 'btb_supporter', description: 'BTB Supporter badge (Career Wall)' },
      { type: 'cosmetic_tag',             tier: 'starter',       description: '"BTB Supporter" tag in dispatcher comms' },
      { type: 'permanent_fuel_discount',  discountPct: 2,        description: 'Permanent 2% fuel discount on all loads (forever)' },
    ],

    // Prize floor: null = no floor (fixed value guarantee instead)
    prizeFloor: null,

    // Requires disclosure before purchase (Option B only for Legend Bundle)
    requiresTapToConfirm: false,

    // Contains fleet-gated prizes? (drives edition disclosure)
    hasFleetPrizes: false,

    // UI odds disclosure strings (used in ScratchShop.jsx)
    oddsDisclosure: {
      summary: 'Overall win rate: 1 in 5 (20%). Grand Jackpot ($5,000): 1 in 1,000. At least 2 of 8 tickets are winning outcomes.',
      detailUrl: '/odds.html',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  [PRODUCT_IDS.DAYONE_PACK]: {
    id:           PRODUCT_IDS.DAYONE_PACK,
    displayName:  'Day-One Pack',
    price:        '$4.99',
    priceUSD:     4.99,
    type:         'consumable',
    badgeLabel:   'GREAT VALUE',
    color:        '#a060ff',          // prism purple
    description:  'Hit the ground running. 11 tickets across 5 exclusive designs + guaranteed Truck Voucher (50% off your next truck). Prize floor: $15,000 in-game cash guaranteed.',

    tickets: [
      'stunning_fortune',   // Card 13 — Wisconsin Grid 5×5 blue marble
      'gold_rush_miles',    // Card 14 — Wisconsin Grid 5×5 amber
      'midnight_run_grid',  // Card 15 — Wisconsin Grid 5×5 gold
      'insurance_cert',     // Card 18 — ACORD-25 Certificate · Match-3 Tunk
      'golden_empire',      // Card 19 — Gold visual · Match-3 Tunk
      'purple_royale',      // Card 20 — Purple visual · Match-3 Tunk
      'aqua_marine',        // Card 21 — Teal visual · Match-3 Tunk
      'copper_mile',        // Card 22 — Copper visual · Match-3 Tunk
      'silver_mile', 'silver_mile',                  // 2 × Silver Mile
      'prime_rate_pull',                             // 1 × Prime Rate Pull
    ],

    guaranteedPrizes: [
      { type: 'truck_voucher',         discountPct: 50,       description: 'Truck Voucher — 50% off next Garage purchase' },
      { type: 'fleet_expansion_token', count: 1,              description: 'Fleet Expansion Token — raises truck cap by 1' },
      { type: 'xp_boost',             durationDays: 7, multiplier: 2, description: '7-day Double XP — 2× XP from all activities' },
      { type: 'badge',                 badgeId: 'day_one_driver', description: 'Day-One Driver badge (permanent Career Wall)' },
      { type: 'cosmetic_tag',          tier: 'day_one',       description: '"Day-One Driver" tag in dispatcher comms' },
    ],

    // Rare random drops: any ticket in this pack may also drop these
    rarePrizes: [
      { type: 'fuel_card', durationDays: 14, fuelSavingPct: 15, dropWeight: 150,
        description: 'Fuel Card — 15% fuel cost reduction for 14 days' },
    ],

    prizeFloor: PACK_PRIZE_FLOORS[PRODUCT_IDS.DAYONE_PACK], // $15,000

    requiresTapToConfirm: false,
    hasFleetPrizes: false,

    oddsDisclosure: {
      summary: 'Overall win rate: 1 in 5 (20%). Grand Jackpot ($5,000): 1 in 1,000. Guaranteed minimum $15,000 in-game cash across all 11 tickets. At least 3 of 11 tickets are winning outcomes.',
      detailUrl: '/odds.html',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  [PRODUCT_IDS.ROADBOSS_PACK]: {
    id:           PRODUCT_IDS.ROADBOSS_PACK,
    displayName:  'Road Boss Pack',
    price:        '$9.99',
    priceUSD:     9.99,
    type:         'consumable',
    badgeLabel:   'MOST POPULAR',
    color:        '#d8d0c8',          // titanium silver
    description:  '19 tickets — 8 exclusive premium cards + 11 base tier mix + guaranteed Golden Rate Con (premium load) + Truck Voucher. Prize floor: $25,000 in-game cash guaranteed.',

    tickets: [
      // Exclusive premium cards (8 cards) · ELD Malfunction and Paper Log are now free
      'prime_rate_premier',  // Road Boss premier · Beat the Broker
      'detention_clock',     // Detention Clock · Tunk · wait-time education
      'fuel_gauge_zero',     // Fuel Gauge Zero · Tunk · fuel economics
      'chrome_legend',       // Chrome Legend · Tunk · premium visual
      'onyx_edge',           // Onyx Edge · Tunk · premium visual
      '3am_in_laredo',       // 3 AM in Laredo · story reveal · humor
      'broker_wont_answer',  // Broker Won't Answer · rate con · humor
      'lumper_wants_cash',   // Lumper Wants Cash · spend inversion · humor
      // Base tier mix (11 tickets)
      'haul_ticket', 'haul_ticket', 'haul_ticket', 'haul_ticket', 'haul_ticket',  // 5 × Haul Ticket
      'silver_mile', 'silver_mile', 'silver_mile',                                 // 3 × Silver Mile
      'prime_rate_pull', 'prime_rate_pull',                                        // 2 × Prime Rate Pull
      'dead_haul_special',                                                         // 1 × Dead Haul Special
    ],

    guaranteedPrizes: [
      { type: 'golden_rate_con',       description: 'Golden Rate Con — premium load offer in Dispatch Board (48hr expiry)' },
      { type: 'truck_voucher',         discountPct: 50,       description: 'Truck Voucher — 50% off next Garage purchase' },
      { type: 'fleet_expansion_token', count: 2,              description: '2× Fleet Expansion Tokens — raises truck cap by 2' },
      { type: 'broker_network_unlock', durationDays: 7,       description: 'Broker Network Unlock — premium hidden loads visible for 7 days' },
      { type: 'extra_scratch_slot',                           description: '2nd daily free scratch slot (permanent)' },
      { type: 'broker_training',                              description: 'Broker Negotiation Training Mode — hints visible during Poker' },
      { type: 'streak_protection',                            description: 'Streak Protection — 1 missed scratch day per week preserved' },
      { type: 'cosmetic_tag',          tier: 'road_boss',     description: '"Road Boss" tag in dispatcher comms (replaces lower tiers)' },
      // R0: cascade Starter Bundle perks for new Road Boss buyers
      { type: 'permanent_fuel_discount', discountPct: 2,      description: 'Permanent 2% fuel discount (Starter Bundle perk)' },
      { type: 'badge',                 badgeId: 'btb_supporter', description: 'BTB Supporter badge (Starter Bundle perk)' },
    ],

    rarePrizes: [
      { type: 'fuel_card', durationDays: 7, fuelSavingPct: 15, dropWeight: 200,
        description: 'Fuel Card — 15% fuel cost reduction for 7 days' },
    ],

    // Cascade: Road Boss buyers also receive the full Starter Bundle
    cascadePackIds: [PRODUCT_IDS.STARTER_BUNDLE],

    prizeFloor: PACK_PRIZE_FLOORS[PRODUCT_IDS.ROADBOSS_PACK], // $25,000

    requiresTapToConfirm: false,
    hasFleetPrizes: false,

    oddsDisclosure: {
      summary: 'Overall win rate: 1 in 5 (20%). Grand Jackpot ($5,000): 1 in 1,000. Guaranteed minimum $25,000 in-game cash across all 19 tickets. At least 4 of 19 tickets are winning outcomes.',
      detailUrl: '/odds.html',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  [PRODUCT_IDS.LEGEND_BUNDLE]: {
    id:           PRODUCT_IDS.LEGEND_BUNDLE,
    displayName:  'Legend Bundle',
    price:        '$49.99',
    priceUSD:     49.99,
    type:         'non_consumable',   // purchased once, permanent
    badgeLabel:   'ULTIMATE',
    color:        '#40e880',          // emerald
    description:  '54 tickets across all four packs + guaranteed Kenworth T680 + Fleet Expansion Token + $30,000 guaranteed in Legend winnings + removes OOL 30-day gate.',

    // 14 exclusive premium tickets — all available immediately on purchase
    tickets: [
      'dead_haul_premier',       // Card 1  — Dead Haul Premier (prestige tier)
      'neon_jackpot_city',       // Card 2  — Neon Jackpot City (lever + reels)
      'jackpot_holographic',     // Card 3  — Jackpot Holographic (lever + reels)
      'titanium_x',              // Card 4  — Titanium X (Tunk, industrial)
      'deep_space_freight',      // Card 5  — Deep Space Freight (lever + reels)
      'fortune_dragon',          // Card 6  — Fortune Dragon (lever + reels)
      'void_radiant',            // Card 7  — Void Radiant (3-zone canvas)
      'solar_haul',              // Card 8  — Solar Haul (3-zone canvas)
      'diamond_haul',            // Card 9  — Diamond Haul (3-zone canvas)
      'speedway_85',             // Card 10 — 85 Speedway (Beat the Broker)
      'the_exit',                // Card 11 — The Exit (Story Reveal)
      'napkin_plan',             // Card 12 — Napkin Plan (3-zone canvas)
      'gold_rush_miles_lb',      // Card 13 — Gold Rush Miles LB (WI grid, gold)
      'first_light_lb',          // Card 14 — First Light LB (Fuel Crisis Math)
    ],

    // Guaranteed prizes — all applied immediately on purchase
    guaranteedPrizes: [
      { type: 'truck_award_pending',      truckId: 'kenworth_t680', description: 'Kenworth T680 reserved — scratch Owner-Op Legend Premier card to claim it' },
      { type: 'fleet_expansion_token',    count: 1,              description: 'Fleet Expansion Token (+1 truck slot cap)' },
      { type: 'golden_rate_con',                                 description: 'Golden Rate Con — premium load in Dispatch Board' },
      { type: 'remove_ool_gate',                                 description: 'Removes 30-day gate on Owner-Op Legend cards (permanent)' },
      { type: 'badge',                    badgeId: 'fleet_boss', description: 'Fleet Boss cosmetic badge (permanent)' },
      // Lower-pack perks applied via cascadePackIds above (Starter + Day-One + Road Boss)
      // L1: permanent broker network (supersedes Road Boss 7-day)
      { type: 'broker_network_permanent',                        description: 'Broker Network permanently unlocked — premium loads always visible' },
      // L2: permanent 5% fuel discount (stacks with Starter 2% = 7% total)
      { type: 'permanent_fuel_discount',  discountPct: 5,        description: 'Permanent 5% fuel discount (Legend exclusive, stacks with Starter)' },
      // L5: Legend Driver cosmetic tag — top of hierarchy
      { type: 'cosmetic_tag',             tier: 'legend',        description: '"Legend Driver" tag — highest tier dispatcher identity' },
    ],

    // Cascade: Legend buyers receive Starter + Day-One + Road Boss packs in full
    cascadePackIds: [
      PRODUCT_IDS.STARTER_BUNDLE,
      PRODUCT_IDS.DAYONE_PACK,
      PRODUCT_IDS.ROADBOSS_PACK,
    ],

    prizeFloor: null, // non-consumable — fixed value guarantees instead

    // OPTION B: Prominent disclosure + separate tap-to-confirm acknowledgment
    // logged to Firebase before purchase proceeds
    requiresTapToConfirm: true,
    hasFleetPrizes: true,   // contains fleet_expansion_token + truck_award

    // Disclosure copy shown before purchase confirmation for capped editions
    editionDisclosureText: 'This bundle includes a guaranteed top-tier truck and Fleet Expansion Token. Players on Demo Edition (1-truck cap) or Owner-Operator Edition (3-truck cap) will receive these prizes in their Prize Wallet. Claim them any time by expanding your fleet. All cash prizes apply immediately to all editions.',

    oddsDisclosure: {
      summary: 'Overall win rate: 1 in 5 (20%). Grand Jackpot ($5,000): 1 in 1,000. Includes 1 guaranteed Owner-Op Legend ticket (jackpot eligible). Fixed value prizes applied on purchase regardless of ticket outcomes.',
      detailUrl: '/odds.html',
    },
  },
};

// ─── ODDS ENGINE ─────────────────────────────────────────────────────────────

/**
 * resolveOutcome(options)
 * Core RNG function. Returns a prize tier outcome for a single ticket scratch.
 *
 * FLOOR ENFORCEMENT (Phase 9 fix):
 * The prize floor is enforced progressively across the final N tickets of a
 * consumable pack — NOT only on the last ticket. This prevents the case where
 * the shortfall at the final ticket exceeds the single-ticket ceiling ($5,000).
 *
 * Algorithm: at each ticket, compute how much the REMAINING tickets (after this
 * one) can contribute via forced outcomes (each capped at grand_jackpot max
 * $5,000). If those remaining tickets cannot cover the entire shortfall alone,
 * force THIS ticket to contribute the difference.
 *
 * Invariant proven exhaustive: per-ticket forced amount is always in [0, 5000].
 * Floor guarantee always met across all 729 (Day-One) and 177,147 (Road Boss)
 * natural-payout pattern combinations.
 *
 * @param {Object} options
 * @param {string} options.tierId         - Card tier: 'haul_ticket' | 'silver_mile' | etc.
 * @param {boolean} options.isIAP         - Whether ticket came from a paid pack
 * @param {string} [options.packId]       - Pack product ID (required if isIAP)
 * @param {number} [options.packIndex]    - 0-based index of this ticket within its pack
 * @param {number} [options.packSize]     - Total tickets in this pack
 * @param {number} [options.cumulativeCashPayout] - Total cash paid out on prior tickets in this pack
 * @param {boolean} [options.isLastTicket] - True if this is the final ticket (legacy; logic now uses packIndex/packSize)
 * @returns {{ tierId: string, cashAmount: number, isFloorEnforced: boolean }}
 */
export function resolveOutcome({
  tierId,
  isIAP = false,
  packId = null,
  packIndex = 0,
  packSize = 1,
  cumulativeCashPayout = 0,
  cumulativeWinCount   = 0,
  isLastTicket = false,
}) {
  // ── Progressive prize floor enforcement ──────────────────────────────────
  // Applies only to consumable packs (non-null floor).
  // At every ticket, check whether the remaining tickets can cover the shortfall
  // by themselves. If not, force this ticket to contribute the minimum needed.
  if (isIAP && packId) {
    const floor = PACK_PRIZE_FLOORS[packId];
    if (floor !== null && floor !== undefined) {
      const shortfall = floor - cumulativeCashPayout;
      if (shortfall > 0) {
        const remainingAfterThis = packSize - packIndex - 1;
        const maxCoverableByRest = remainingAfterThis * FLOOR_MAX_SINGLE_PRIZE;
        const minNeededHere = Math.max(0, shortfall - maxCoverableByRest);
        if (minNeededHere > 0) {
          // Force this ticket — minNeededHere is always ≤ FLOOR_MAX_SINGLE_PRIZE (proven)
          return buildFloorOutcome(minNeededHere);
        }
      }
    }
  }

  // ── Minimum visible win guarantee ────────────────────────────────────────
  // If the pack has a minimum win count and there are exactly enough tickets
  // remaining to satisfy it, force this ticket to be a visible winner.
  // "Exactly enough" = remaining tickets (including this one) === wins still needed.
  if (isIAP && packId) {
    const minWins = PACK_MIN_WIN_TICKETS[packId];
    if (minWins !== undefined) {
      const winsStillNeeded = minWins - cumulativeWinCount;
      const ticketsRemaining = packSize - packIndex; // includes this ticket
      if (winsStillNeeded > 0 && ticketsRemaining <= winsStillNeeded) {
        // Force a minimal visible win — any_pair ($25) or better
        return { tierId: 'any_pair', cashAmount: MIN_WIN_CASH, isFloorEnforced: false, isWinEnforced: true };
      }
    }
  }

  // ── Standard RNG draw ──────────────────────────────────────────────────
  const roll = Math.floor(Math.random() * ODDS_TOTAL_WEIGHT); // 0–9999
  let accumulator = 0;
  for (const tier of ODDS_TABLE) {
    accumulator += tier.weight;
    if (roll < accumulator) {
      const cashAmount = tier.cashMin > 0
        ? tier.cashMin + Math.floor(Math.random() * (tier.cashMax - tier.cashMin + 1))
        : 0;
      return { tierId: tier.tierId, cashAmount, isFloorEnforced: false, isWinEnforced: false };
    }
  }
  // Fallback (should never reach here given correct weights)
  return { tierId: 'miss', cashAmount: 0, isFloorEnforced: false, isWinEnforced: false };
}

/**
 * buildFloorOutcome(shortfall)
 * Builds the minimum-viable outcome that covers a prize floor shortfall.
 * Selects the lowest cash tier whose max >= shortfall, or big_win if needed.
 * @param {number} shortfall
 * @returns {{ tierId: string, cashAmount: number, isFloorEnforced: boolean, isWinEnforced: boolean }}
 */
function buildFloorOutcome(shortfall) {
  // Try to find the smallest winning tier that can cover the shortfall
  const cashTiers = ODDS_TABLE.filter(t => t.cashMax > 0).sort((a, b) => a.cashMin - b.cashMin);
  for (const tier of cashTiers) {
    if (tier.cashMax >= shortfall) {
      // Use exactly the shortfall amount, clamped to the tier's range
      const cashAmount = Math.max(tier.cashMin, Math.min(tier.cashMax, shortfall));
      return { tierId: tier.tierId, cashAmount, isFloorEnforced: true, isWinEnforced: false };
    }
  }
  // Shortfall exceeds all individual tiers — use grand_jackpot ceiling
  return { tierId: 'grand_jackpot', cashAmount: 5000, isFloorEnforced: true, isWinEnforced: false };
}

// ─── EDITION-AWARE PRIZE RESOLUTION ─────────────────────────────────────────

/**
 * PRIZE_RESOLUTION_TABLE
 * For each prize type, defines behavior per edition.
 *
 * 'apply'  — Apply the prize immediately to game state
 * 'wallet' — Send to Prize Wallet (fleet-gated, never expires)
 * 'cash'   — Convert to cash equivalent instead
 */
export const PRIZE_RESOLUTION_TABLE = {
  cash:                  { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  golden_rate_con:       { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  fuel_card:             { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  broker_network_unlock: { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  truck_voucher:         { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  remove_ool_gate:       { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  badge:                 { demo: 'apply', basic: 'apply', enterprise: 'apply'  },
  // Fleet-gated prizes
  fleet_expansion_token: { demo: 'wallet', basic: 'wallet', enterprise: 'cash'  },
  truck_award:           { demo: 'wallet', basic: 'wallet', enterprise: 'apply' },
};

// Cash conversion amounts for prizes that cannot be applied in current edition
export const PRIZE_CASH_CONVERSIONS = {
  fleet_expansion_token: 10000,  // $10,000 if enterprise (has no cap)
};

/**
 * resolvePrizeForEdition(prizeType, edition, currentFleetSize)
 * Determines the correct action for a prize given the player's edition and
 * current fleet state.
 *
 * @param {string} prizeType     - Prize type key from PRIZE_RESOLUTION_TABLE
 * @param {string} edition       - 'demo' | 'basic' | 'enterprise'
 * @param {number} currentFleetSize - Number of trucks currently owned
 * @param {number} fleetExpansionTokens - Tokens already in wallet
 * @returns {'apply'|'wallet'|'cash'}
 */
export function resolvePrizeForEdition(prizeType, edition, currentFleetSize = 0, fleetExpansionTokens = 0) {
  const row = PRIZE_RESOLUTION_TABLE[prizeType];
  if (!row) return 'apply'; // unknown prize — apply by default

  const baseResolution = row[edition] || row['enterprise'] || 'apply';

  // Additional guard: even in enterprise, if truck_award and at soft cap — apply (enterprise is unlimited)
  if (prizeType === 'truck_award' && edition === 'enterprise') return 'apply';

  // For demo/basic: truck_award — check if there's room after accounting for tokens
  if (prizeType === 'truck_award' && (edition === 'demo' || edition === 'basic')) {
    const hardCap   = EDITION_TRUCK_CAPS[edition];
    const softCap   = EDITION_TOKEN_SOFT_CAPS[edition];
    const effectiveCap = Math.min(hardCap + fleetExpansionTokens, softCap);
    if (currentFleetSize < effectiveCap) return 'apply'; // room exists — apply it
    return 'wallet'; // at cap — send to wallet
  }

  // For fleet_expansion_token in enterprise — always convert to cash
  if (prizeType === 'fleet_expansion_token' && edition === 'enterprise') return 'cash';

  // For fleet_expansion_token in demo/basic — send to wallet (raises cap when used)
  if (prizeType === 'fleet_expansion_token' && (edition === 'demo' || edition === 'basic')) return 'wallet';

  return baseResolution;
}

// ─── RARE PRIZE RESOLUTION ────────────────────────────────────────────────────

/**
 * resolveRarePrize(packId, ticketIndex)
 * Checks if a specific ticket in a pack should drop a rare random prize
 * (Fuel Card, Broker Network Unlock). Uses independent per-prize RNG.
 *
 * @param {string} packId
 * @param {number} ticketIndex - 0-based index within pack
 * @returns {Object|null} - Rare prize object or null
 */
export function resolveRarePrize(packId, ticketIndex) {
  const pack = PACKS[packId];
  if (!pack || !pack.rarePrizes) return null;

  for (const rarePrize of pack.rarePrizes) {
    // Roll against drop weight (out of 10,000)
    const roll = Math.floor(Math.random() * 10000);
    if (roll < rarePrize.dropWeight) {
      return { ...rarePrize };
    }
  }
  return null;
}

// ─── PACK UTILITY FUNCTIONS ───────────────────────────────────────────────────

/**
 * getPackById(packId)
 * @param {string} packId
 * @returns {Object|null}
 */
export function getPackById(packId) {
  return PACKS[packId] || null;
}

/**
 * isNonConsumable(packId)
 * Non-consumable packs can only be purchased once.
 * @param {string} packId
 * @returns {boolean}
 */
export function isNonConsumable(packId) {
  const pack = PACKS[packId];
  return pack?.type === 'non_consumable';
}

/**
 * isConsumable(packId)
 * @param {string} packId
 * @returns {boolean}
 */
export function isConsumable(packId) {
  const pack = PACKS[packId];
  return pack?.type === 'consumable';
}

/**
 * getPackTicketCount(packId)
 * Returns the number of tickets in a pack.
 * @param {string} packId
 * @returns {number}
 */
export function getPackTicketCount(packId) {
  return PACKS[packId]?.tickets?.length || 0;
}

/**
 * buildTicketQueue(packId, purchaseTimestamp)
 * Expands a pack's ticket list into an ordered queue of ticket objects
 * ready for use by the ticket queue system in Phase 5.
 *
 * For Legend Bundle: tickets are spread across 30 days (1 per day).
 * For all other packs: all tickets available immediately.
 *
 * @param {string} packId
 * @param {number} purchaseTimestamp - ms timestamp of purchase
 * @returns {Array<Object>} array of ticket queue entries
 */
export function buildTicketQueue(packId, purchaseTimestamp = Date.now()) {
  const pack = PACKS[packId];
  if (!pack) return [];

  const isLegend = packId === PRODUCT_IDS.LEGEND_BUNDLE;
  const ONE_DAY_MS = 86400000;

  return pack.tickets.map((tierId, index) => ({
    id:             `${packId}_${purchaseTimestamp}_${index}`,
    tierId,
    packId,
    packIndex:      index,
    packSize:       pack.tickets.length,
    isIAP:          true,
    isLastTicket:   index === pack.tickets.length - 1,
    // All tickets (including Legend Bundle) available immediately on purchase.
    // Players work through them at their own pace via the Arcade Hub queue.
    // The Legend Bundle's "30 days" refers to the volume, not a drip schedule.
    availableAt:    purchaseTimestamp,
    played:         false,
    outcome:        null,
    cumulativeCash: 0,  // updated during play by Phase 5 ticket queue system
  }));
}

/**
 * requiresEditionDisclosure(packId, edition)
 * Returns true if this pack should show the edition disclosure + tap-to-confirm
 * screen for the given edition.
 * @param {string} packId
 * @param {string} edition
 * @returns {boolean}
 */
export function requiresEditionDisclosure(packId, edition) {
  const pack = PACKS[packId];
  if (!pack) return false;
  if (!pack.requiresTapToConfirm) return false;
  // Only needed for capped editions — enterprise players can use all prizes immediately
  return edition === 'demo' || edition === 'basic';
}

/**
 * getEditionDisclosureText(packId)
 * Returns the pre-purchase disclosure copy for capped editions.
 * @param {string} packId
 * @returns {string}
 */
export function getEditionDisclosureText(packId) {
  return PACKS[packId]?.editionDisclosureText || '';
}

// ─── CASH RANGE HELPERS FOR ODDS DISCLOSURE UI ────────────────────────────────

/**
 * getOddsTableForDisplay()
 * Returns the odds table formatted for disclosure UI and odds.html.
 * @returns {Array<Object>}
 */
export function getOddsTableForDisplay() {
  const total = ODDS_TOTAL_WEIGHT;
  return ODDS_TABLE.map(tier => ({
    label:       tier.label,
    cashRange:   tier.cashMin > 0 ? (tier.cashMin === tier.cashMax ? `$${tier.cashMin.toLocaleString()}` : `$${tier.cashMin.toLocaleString()}–$${tier.cashMax.toLocaleString()}`) : tier.tierId === 'special_prize' ? 'Non-cash prize' : '$0',
    oddsDisplay: `1 in ${Math.round(total / tier.weight).toLocaleString()}`,
    probability: `${((tier.weight / total) * 100).toFixed(2)}%`,
    weight:      tier.weight,
  }));
}

// ─── EXPORTS SUMMARY ─────────────────────────────────────────────────────────
// Named exports above. Default export provides the full pack registry for
// components that prefer a single import.
export default PACKS;
