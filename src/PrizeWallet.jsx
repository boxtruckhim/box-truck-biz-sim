// ═══════════════════════════════════════════════════════════════════════════
// PrizeWallet.jsx — Box Truck Boss · IAP Prize Wallet · Phase 7
//
// Self-contained React 18 panel rendered inside HQOverlay's "Prizes" zone.
// Shows fleet-gated prizes, active IAP benefits, card face unlocks,
// Fleet Expansion Tokens, and the Restore Purchases button.
//
// RENDERS INSIDE: HQOverlay DetailContent as <PrizeWallet ... />
// NOT portalled — lives in the HQ overlay panel system.
//
// PROPS CONTRACT:
//   prizeWallet         array    Fleet-gated prizes (trucks, etc.) — never expire
//   setPrizeWallet      fn       Setter
//   fleetExpansionTokens number  Consumable tokens that raise truck cap
//   setFleetExpansionTokens fn   Setter
//   truckVouchers       number   50%-off Garage vouchers
//   fuelCardExpiry      number|null  Timestamp (ms) when fuel card expires
//   brokerNetworkExpiry number|null  Timestamp (ms) when broker network expires
//   selectedEdition     'demo'|'basic'|'enterprise'
//   truckStatus         array    Current fleet (for cap calculation)
//   currentDay          number
//   onApplyTruckAward   fn(truckId) — calls App.jsx applyTruckAward
//   onApplyToken        fn()     — calls App.jsx applyFleetExpansionToken
//   onRestorePurchases  fn(onSuccess, onError) — IAP restore hook
//   addNotification     fn(msg, type)
//   // Style props (from HQOverlay C palette)
//   C                   object   HQOverlay colour tokens
//   DetailHeader        component HQOverlay shared header component
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, memo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 · CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const FONT = "'Outfit','SF Pro Display',-apple-system,sans-serif";
const MONO = "'Courier New',Courier,monospace";

// Edition truck cap table — mirrors EDITIONS constant in App.jsx
const EDITION_HARD_CAPS = { demo: 1, basic: 3, enterprise: Infinity };
const EDITION_SOFT_CAPS = { demo: 3, basic: 6, enterprise: Infinity };

// Prize type → icon + label
const PRIZE_META = {
  truck_award:           { icon: '🚛', label: 'Kenworth T680', sub: 'Fleet vehicle — claim when slot available' },
  fleet_expansion_token: { icon: '🔑', label: 'Fleet Expansion Token', sub: 'Raises truck cap by 1' },
  default:               { icon: '🎁', label: 'Prize', sub: 'Claim when eligible' },
};

function formatExpiry(ts) {
  if (!ts || ts <= Date.now()) return null;
  const ms   = ts - Date.now();
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000)  / 60000);
  if (days > 0) return `${days}d ${hrs}h remaining`;
  if (hrs  > 0) return `${hrs}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 · SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// Active benefit row (fuel card, broker network)
function BenefitRow({ icon, label, sub, expiryTs, accent }) {
  const timeLeft = formatExpiry(expiryTs);
  const active   = timeLeft !== null;
  if (!active) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px',
      background: accent + '0e',
      border: '1px solid ' + accent + '2a',
      borderRadius: 8, marginBottom: 8,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e8ecf4', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 9, color: accent + 'aa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{sub}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: accent, fontFamily: MONO }}>{timeLeft}</div>
      </div>
      <div style={{ fontSize: 8, fontWeight: 800, padding: '3px 7px', borderRadius: 3, background: accent + '1a', color: accent, border: '1px solid ' + accent + '44', fontFamily: MONO, flexShrink: 0, alignSelf: 'flex-start' }}>
        ACTIVE
      </div>
    </div>
  );
}

// Individual wallet item card
function WalletItem({ item, canClaim, onClaim, isClaiming }) {
  const meta   = PRIZE_META[item.prizeType] || PRIZE_META.default;
  const earned = new Date(item.earnedAt).toLocaleDateString();

  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '12px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: canClaim ? 10 : 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e8ecf4', marginBottom: 2 }}>
            {item.description || meta.label}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
            {meta.sub}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontFamily: MONO }}>
            Earned {earned} · Never expires
          </div>
        </div>
        {!canClaim && (
          <div style={{ fontSize: 8, padding: '3px 7px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: MONO, flexShrink: 0 }}>
            HELD
          </div>
        )}
      </div>

      {canClaim && (
        <button
          onClick={onClaim}
          disabled={isClaiming}
          style={{
            width: '100%', minHeight: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: 'none', borderRadius: 7, cursor: isClaiming ? 'not-allowed' : 'pointer',
            fontFamily: FONT, fontSize: 11, fontWeight: 800,
            background: isClaiming ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.9)',
            color: '#050810', opacity: isClaiming ? 0.6 : 1,
            transition: 'opacity 0.15s, transform 0.1s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {isClaiming ? '⏳ Claiming…' : '🚛 Claim to Fleet'}
        </button>
      )}
    </div>
  );
}

// Token row (apply to raise cap)
function TokenRow({ count, onApply, isApplying, selectedEdition, fleetSize, hardCap, softCap, tokenBoost }) {
  if (count <= 0) return null;

  const isEnterprise   = selectedEdition === 'enterprise';
  const effectiveCap   = isEnterprise ? Infinity : Math.min(hardCap + tokenBoost, softCap);
  const atSoftCap      = !isEnterprise && (hardCap + tokenBoost) >= softCap;

  return (
    <div style={{
      background: 'rgba(100,80,200,0.08)',
      border: '1px solid rgba(100,80,200,0.22)',
      borderRadius: 10, padding: '12px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: atSoftCap ? 4 : 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: 'rgba(100,80,200,0.14)', border: '1px solid rgba(100,80,200,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>🔑</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e8ecf4', marginBottom: 2 }}>
            Fleet Expansion Token ×{count}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(100,80,200,0.8)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {isEnterprise
              ? 'Converts to $10,000 cash — Fleet Edition'
              : atSoftCap
              ? `Soft cap reached (${softCap} trucks max including tokens)`
              : `Raises truck cap · Current cap: ${effectiveCap === Infinity ? '∞' : effectiveCap} trucks`}
          </div>
        </div>
      </div>

      {atSoftCap && !isEnterprise && (
        <div style={{ fontSize: 9, color: 'rgba(255,200,80,0.7)', padding: '5px 8px', background: 'rgba(255,200,80,0.06)', borderRadius: 5, marginBottom: 8, lineHeight: 1.5 }}>
          ⚠️ Maximum token slots reached. Upgrade to Enterprise for unlimited trucks.
        </div>
      )}

      {!atSoftCap && (
        <button
          onClick={onApply}
          disabled={isApplying}
          style={{
            width: '100%', minHeight: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '1px solid rgba(100,80,200,0.4)', borderRadius: 7,
            cursor: isApplying ? 'not-allowed' : 'pointer',
            fontFamily: FONT, fontSize: 11, fontWeight: 700,
            background: 'rgba(100,80,200,0.18)', color: '#c0aaff',
            opacity: isApplying ? 0.6 : 1,
            transition: 'opacity 0.15s', WebkitTapHighlightColor: 'transparent',
          }}
        >
          {isApplying
            ? '⏳ Applying…'
            : isEnterprise
            ? '💰 Convert to $10,000 Cash'
            : '🔑 Apply Token (+1 truck slot)'}
        </button>
      )}
    </div>
  );
}

// Voucher strip
function VoucherStrip({ count }) {
  if (count <= 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: 'rgba(34,197,94,0.07)',
      border: '1px solid rgba(34,197,94,0.2)',
      borderRadius: 8, marginBottom: 8,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🏷️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#e8ecf4', marginBottom: 1 }}>
          Truck Voucher ×{count}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(34,197,94,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          50% off next truck purchase in Garage
        </div>
      </div>
      <div style={{ fontSize: 8, fontWeight: 800, padding: '3px 7px', borderRadius: 3, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', fontFamily: MONO, flexShrink: 0 }}>
        ×{count}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 · MAIN PRIZEWALLET COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PrizeWallet = memo(function PrizeWallet({
  prizeWallet          = [],
  setPrizeWallet,
  fleetExpansionTokens = 0,
  setFleetExpansionTokens,
  truckVouchers        = 0,
  fuelCardExpiry       = null,
  brokerNetworkExpiry  = null,
  selectedEdition      = 'demo',
  truckStatus          = [],
  currentDay           = 1,
  onApplyTruckAward,
  onApplyToken,
  onRestorePurchases,
  addNotification,
  // v4 IAP upgrade perks
  permanentFuelDiscountPct  = 0,
  xpBoostExpiresAt          = null,
  brokerNetworkPermanent    = false,
  brokerTrainingUnlocked    = false,
  highestIAPTier            = null,
  // HQOverlay shared UI tokens
  C,
  DetailHeader,
}) {
  const [claimingId,   setClaimingId]   = useState(null);
  const [applyingToken,setApplyingToken]= useState(false);
  const [isRestoring,  setIsRestoring]  = useState(false);
  const [restoreMsg,   setRestoreMsg]   = useState('');

  // ── Fleet cap calculations ─────────────────────────────────────────────────
  const activeTrucks  = useMemo(() => truckStatus.filter(t => !t.decommissioned), [truckStatus]);
  const fleetSize     = activeTrucks.length;
  const hardCap       = EDITION_HARD_CAPS[selectedEdition] ?? 1;
  const softCap       = EDITION_SOFT_CAPS[selectedEdition] ?? 3;
  const tokenBoost    = fleetExpansionTokens;
  const effectiveCap  = selectedEdition === 'enterprise'
    ? Infinity
    : Math.min(hardCap + tokenBoost, softCap);
  const hasFleetSlot  = selectedEdition === 'enterprise' || fleetSize < effectiveCap;

  // ── Separate wallet items by claimable status ──────────────────────────────
  const { claimable, held } = useMemo(() => {
    const claimable = [];
    const held      = [];
    (prizeWallet || []).forEach(item => {
      if (item.prizeType === 'truck_award') {
        hasFleetSlot ? claimable.push(item) : held.push(item);
      } else {
        held.push(item); // unknown types stay held until handler exists
      }
    });
    return { claimable, held };
  }, [prizeWallet, hasFleetSlot]);

  // ── Active benefits ────────────────────────────────────────────────────────
  const fuelActive    = fuelCardExpiry   && fuelCardExpiry   > Date.now();
  const brokerActive  = brokerNetworkExpiry && brokerNetworkExpiry > Date.now();
  const xpBoostActive = xpBoostExpiresAt && xpBoostExpiresAt > Date.now();
  // v4: permanent perks
  const hasPermanentPerks = brokerNetworkPermanent || (permanentFuelDiscountPct > 0) || brokerTrainingUnlocked;

  // Empty state check
  const hasAnything =
    prizeWallet.length > 0 ||
    fleetExpansionTokens > 0 ||
    truckVouchers > 0 ||
    fuelActive ||
    brokerActive ||
    xpBoostActive ||
    hasPermanentPerks ||
    highestIAPTier !== null;

  // ── Claim a truck from the wallet ──────────────────────────────────────────
  const handleClaim = useCallback((item) => {
    if (claimingId) return;
    setClaimingId(item.earnedAt);
    // Call App.jsx handler
    if (onApplyTruckAward) {
      onApplyTruckAward(item.prizeData?.truckId || 'kenworth_t680');
    }
    // Remove from prize wallet
    setTimeout(() => {
      setPrizeWallet?.(prev => prev.filter(p => p.earnedAt !== item.earnedAt));
      setClaimingId(null);
    }, 600);
  }, [claimingId, onApplyTruckAward, setPrizeWallet]);

  // ── Apply a Fleet Expansion Token ─────────────────────────────────────────
  const handleApplyToken = useCallback(() => {
    if (applyingToken || fleetExpansionTokens < 1) return;
    setApplyingToken(true);
    if (onApplyToken) {
      onApplyToken(1);
    } else {
      // Fallback: apply locally
      setFleetExpansionTokens?.(prev => Math.max(0, prev - 1));
    }
    setTimeout(() => setApplyingToken(false), 800);
  }, [applyingToken, fleetExpansionTokens, onApplyToken, setFleetExpansionTokens]);

  // ── Restore Purchases ──────────────────────────────────────────────────────
  const handleRestore = useCallback(() => {
    if (isRestoring) return;
    setIsRestoring(true);
    setRestoreMsg('');
    const restore = onRestorePurchases || ((s) => setTimeout(() => s([]), 800));
    restore(
      (restoredIds) => {
        setIsRestoring(false);
        if (!restoredIds || restoredIds.length === 0) {
          setRestoreMsg('No purchases found to restore.');
        } else {
          setRestoreMsg(`${restoredIds.length} purchase${restoredIds.length !== 1 ? 's' : ''} restored.`);
        }
      },
      (err) => {
        setIsRestoring(false);
        setRestoreMsg(`Restore failed: ${err || 'Unknown error'}`);
      }
    );
  }, [isRestoring, onRestorePurchases]);

  // ── Colour shortcuts (fall back gracefully if C not provided) ──────────────
  const bg2    = C?.bg2    ?? '#060e16';
  const bg3    = C?.bg3    ?? '#020608';
  const chalk  = C?.chalk  ?? '#e8f4ff';
  const chalk2 = C?.chalk2 ?? '#a8c4d4';
  const amber  = C?.amber  ?? '#e8930a';
  const green  = C?.green  ?? '#4ade80';
  const cyan   = C?.cyan   ?? '#00c8ff';
  const purple = C?.purple ?? '#a78bfa';
  const dim    = C?.dim    ?? '#1e3040';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Shared HQOverlay header */}
      {DetailHeader && <DetailHeader title="Prize Wallet" accent={amber} />}

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        padding: '12px',
      }}>

        {/* ── EMPTY STATE ── */}
        {!hasAnything && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎁</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: chalk, marginBottom: 6 }}>
              No prizes yet
            </div>
            <div style={{ fontSize: 11, color: chalk2 + '88', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
              Purchase a pack from the Scratch Shop to earn fleet prizes, tokens, vouchers, and more.
            </div>
          </div>
        )}

        {/* ── CLAIMABLE PRIZES ── */}
        {claimable.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: amber, letterSpacing: 1.5,
              textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: amber, animation: 'hqStatPulse 2s ease-in-out infinite' }} />
              Ready to Claim ({claimable.length})
            </div>
            {claimable.map((item) => (
              <WalletItem
                key={item.earnedAt}
                item={item}
                canClaim={true}
                isClaiming={claimingId === item.earnedAt}
                onClaim={() => handleClaim(item)}
              />
            ))}
          </div>
        )}

        {/* ── FLEET EXPANSION TOKENS ── */}
        {fleetExpansionTokens > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: purple + 'cc', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
              Fleet Tokens
            </div>
            <TokenRow
              count={fleetExpansionTokens}
              onApply={handleApplyToken}
              isApplying={applyingToken}
              selectedEdition={selectedEdition}
              fleetSize={fleetSize}
              hardCap={hardCap}
              softCap={softCap}
              tokenBoost={tokenBoost}
            />
            {/* Fleet cap status */}
            {selectedEdition !== 'enterprise' && (
              <div style={{
                fontSize: 9, color: chalk2 + '55', fontFamily: MONO, padding: '6px 10px',
                background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginTop: -4, marginBottom: 8,
              }}>
                Fleet: {fleetSize}/{effectiveCap === Infinity ? '∞' : effectiveCap} trucks
                · Hard cap: {hardCap} · Tokens applied: {tokenBoost}
              </div>
            )}
          </div>
        )}

        {/* ── TRUCK VOUCHERS ── */}
        {truckVouchers > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: green + 'cc', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
              Vouchers
            </div>
            <VoucherStrip count={truckVouchers} />
          </div>
        )}

        {/* ── ACTIVE BENEFITS ── */}
        {/* ── ACTIVE TIMED BENEFITS ── */}
        {(fuelActive || brokerActive || xpBoostActive) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: cyan + 'cc', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
              Active Benefits
            </div>
            {fuelActive && (
              <BenefitRow
                icon="⛽"
                label="Fuel Card"
                sub="15% fuel cost reduction"
                expiryTs={fuelCardExpiry}
                accent={amber}
              />
            )}
            {brokerActive && !brokerNetworkPermanent && (
              <BenefitRow
                icon="📋"
                label="Broker Network"
                sub="Premium hidden loads unlocked"
                expiryTs={brokerNetworkExpiry}
                accent={cyan}
              />
            )}
            {xpBoostActive && (
              <BenefitRow
                icon="⭐"
                label="2× XP Boost"
                sub="Double XP from all activities"
                expiryTs={xpBoostExpiresAt}
                accent="#a78bfa"
              />
            )}
          </div>
        )}

        {/* ── PERMANENT PERKS (v4 IAP upgrades) ── */}
        {hasPermanentPerks && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#f472b6cc', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
              Permanent Perks
            </div>
            {permanentFuelDiscountPct > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 6, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>⛽</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: amber }}>{permanentFuelDiscountPct}% Fuel Discount</div>
                  <div style={{ fontSize: 9, color: amber + '88', marginTop: 1 }}>Permanent · stacks with Fuel Card · all loads</div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: amber + 'aa', letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 7px', border: '1px solid ' + amber + '33', borderRadius: 4 }}>FOREVER</div>
              </div>
            )}
            {brokerNetworkPermanent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 6, background: 'rgba(0,200,255,0.06)', border: '1px solid rgba(0,200,255,0.18)', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: cyan }}>Broker Network</div>
                  <div style={{ fontSize: 9, color: cyan + '88', marginTop: 1 }}>Permanent · premium hidden loads always visible</div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: cyan + 'aa', letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 7px', border: '1px solid ' + cyan + '33', borderRadius: 4 }}>FOREVER</div>
              </div>
            )}
            {brokerTrainingUnlocked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 6, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>🃏</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: purple }}>Broker Training Mode</div>
                  <div style={{ fontSize: 9, color: purple + '88', marginTop: 1 }}>Counter hints + broker tells visible during Poker</div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: purple + 'aa', letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 7px', border: '1px solid ' + purple + '33', borderRadius: 4 }}>FOREVER</div>
              </div>
            )}
          </div>
        )}

        {/* ── IDENTITY TAG ── */}
        {highestIAPTier && (() => {
          const tiers = {
            starter:   { label: 'BTB Supporter',  color: '#fbbf24', icon: '🌟', pack: 'Starter Bundle' },
            day_one:   { label: 'Day-One Driver',  color: '#a78bfa', icon: '🚀', pack: 'Day-One Pack'   },
            road_boss: { label: 'Road Boss',        color: '#60a5fa', icon: '💼', pack: 'Road Boss Pack' },
            legend:    { label: 'Legend Driver',    color: '#f472b6', icon: '👑', pack: 'Legend Bundle'  },
          };
          const t = tiers[highestIAPTier];
          if (!t) return null;
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: t.color + 'cc', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
                Dispatcher Identity
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: 'rgba(0,0,0,0.25)', border: '1px solid ' + t.color + '33', borderRadius: 10 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.color }}>◆ {t.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Shown in dispatcher comms · Career Wall · {t.pack}</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── HELD PRIZES (at cap) ── */}
        {held.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: chalk2 + '66', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
              Held Prizes — Expand Fleet to Claim ({held.length})
            </div>
            <div style={{
              fontSize: 10, color: chalk2 + '77', padding: '8px 10px',
              background: 'rgba(255,200,80,0.05)', border: '1px solid rgba(255,200,80,0.12)',
              borderRadius: 7, marginBottom: 8, lineHeight: 1.5,
            }}>
              ⚠️ You're at your truck cap ({effectiveCap === Infinity ? '∞' : effectiveCap} trucks). Apply a Fleet Expansion Token or upgrade to Enterprise to claim these prizes.
            </div>
            {held.map((item) => (
              <WalletItem
                key={item.earnedAt}
                item={item}
                canClaim={false}
                isClaiming={false}
                onClaim={() => {}}
              />
            ))}
          </div>
        )}

        {/* ── DIVIDER ── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0 16px' }} />

        {/* ── RESTORE PURCHASES ── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: chalk2 + '55', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, fontFamily: MONO }}>
            Account
          </div>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            style={{
              width: '100%', minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9,
              cursor: isRestoring ? 'not-allowed' : 'pointer',
              fontFamily: FONT, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.03)', color: chalk2,
              opacity: isRestoring ? 0.6 : 1,
              transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
              marginBottom: 6,
            }}
            onMouseEnter={e => { if (!isRestoring) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            {isRestoring ? '⏳ Restoring…' : '🔄 Restore Purchases'}
          </button>

          {restoreMsg && (
            <div style={{
              fontSize: 10, color: restoreMsg.includes('failed') || restoreMsg.includes('No ') ? chalk2 + '88' : green,
              textAlign: 'center', padding: '4px 8px', lineHeight: 1.5,
            }}>
              {restoreMsg}
            </div>
          )}

          <div style={{ fontSize: 9, color: chalk2 + '44', textAlign: 'center', lineHeight: 1.6, marginTop: 6 }}>
            Restores non-consumable purchases from the App Store or Google Play.
            Managed by Apple or Google — we never see your payment details.
          </div>
        </div>

      </div>
    </div>
  );
});

export default PrizeWallet;
