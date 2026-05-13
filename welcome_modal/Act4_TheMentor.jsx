/**
 * Act 4 — The Mentor (10s) — Box Truck Boss Welcome Modal
 *
 * Calibration target for the Welcome Modal cinematic. Approval of this act
 * locks the visual language for the remaining 11 acts.
 *
 * VISUAL ARCHITECTURE:
 * Three-photo Ken Burns sequence with cross-fade transitions over 10 seconds.
 * iOS voicemail UI overlay anchored at the lower third with progress bar
 * synchronized to Marcus dialogue cadence. Atmospheric particle layer (dust
 * motes drifting through lamp shaft) plus persistent vignette/grain/scanlines.
 * Empire Legacy lighting idiom inherited — sun-anchored radial glow adapted
 * to lamp position, multi-layer text-shadow gold glow on captions, cinema
 * bars on cubic-bezier(0.22, 1, 0.36, 1).
 *
 * TIMING (relative to act start, 14-second total runtime):
 *   0:00 - 0:00.8  Cross-dissolve in from prior act + cinema bars slide
 *   0:00.8         iOS voicemail UI animates in from below
 *   0:00.8 - 13.8  Marcus dialogue captions cycle (6 segments, retuned cadence)
 *   0:00 - 4.4     Layer 1: marcus_dispatch_room_wide (establishing, 3.8-4.4s crossfade)
 *   3.8 - 9.6      Layer 2: marcus_focused_paperwork (push-in, 9.0-9.6s crossfade)
 *   9.0 - 14.0     Layer 3: marcus_cb_radio_call (pull-back, 13.5-14s tail fade)
 *
 * MARCUS DIALOGUE (locked v3.1):
 *   "Hey {{companyName || 'kid'}} — it's Marcus."
 *   "Listen. I've been dispatching for twenty-three years."
 *   "I've seen people get rich. I've seen people go dead broke."
 *   "The difference is what they did in their first ninety days."
 *   "So when you log in tomorrow morning?"
 *   "I'll be here. Pick up the phone."
 *
 * PROPS:
 *   imageUrls:   { wide, paperwork, cbRadio }  — image source URLs
 *   companyName: string                         — sanitized company name (or 'kid')
 *   onComplete:  () => void                     — called when act finishes (10.0s)
 *   onSkip:      () => void                     — optional skip handler
 *
 * INTEGRATION:
 *   For Stage 3 production this component mounts inside WelcomeModal.jsx as
 *   the 4th of 12 acts. Image URLs come from _GH_BASE constants. For the
 *   calibration REVIEW.html harness, image URLs are base64 data URIs.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useActAudio } from '../../audio/useActAudio.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// MARCUS DIALOGUE — locked from storyboard v3.1 Act 4
// Timing locked at 18-second total runtime (storyboard v3.1 specified 10s but
// natural mentor delivery requires ~190 wpm rate; user-approved revision).
// Per-segment durations proportional to word count with breath gaps for delivery.
// Total: 800ms intro + 16.5s of dialogue with gaps + bridge line + transition tail = 22000ms.
//
// BRIDGE LINE (added v3.2): The seventh segment is a bridge that connects this
// act's warm voicemail register to Act 5's cold federal-dashboard register.
// It plays AFTER the photo and voicemail card have faded (17.8s onward) over
// near-black frames with just particle remnants. This is the documentary
// technique of carrying a narrator's voice across a visual register change.
// At ~21.4s the cross-dissolve to Act 5 begins, with Marcus's last few words
// ("on your record.") playing over the federal dashboard appearing — making
// the dashboard's appearance feel earned by the narration rather than abrupt.
//
// CROSS-DISSOLVE FADE-IN (added v3.3): Storyboard transition matrix specifies
// "Act 3 → Act 4: Cross-dissolve through warm light, 600ms." The 0-600ms
// fade-in (ease-out cubic) is multiplied onto each photo layer's opacity, and
// a warm-amber radial overlay sits above the photos at z-index 4, fading from
// 0.7 → 0 over the same 600ms, screen-blended. Together these bridge Act 3's
// dimmed cold-blue phone into Act 4's warm lamp-lit dispatch room. Verified
// via DOM inspection: at +100ms photo=0.14 + warm=0.67; at +700ms photo=1.0
// + warm=0.02. (Visual frame capture of the transient is unreliable due to
// puppeteer-screenshot/rAF race; math + DOM state confirm correctness.)
// ─────────────────────────────────────────────────────────────────────────────

const VOICEMAIL_SEGMENTS = [
  { startMs:   800, endMs:  2400, text: (name) => `Hey ${name} — it's Marcus.` },
  { startMs:  2900, endMs:  5500, text: () => `Listen. I've been dispatching for twenty-three years.` },
  { startMs:  6000, endMs:  9700, text: () => `I've seen people get rich. I've seen people go dead broke.` },
  { startMs: 10200, endMs: 13800, text: () => `The difference is what they did in their first ninety days.` },
  { startMs: 14200, endMs: 15800, text: () => `So when you log in tomorrow morning?` },
  { startMs: 16100, endMs: 17900, text: () => `I'll be here. Pick up the phone.` },
  // BRIDGE — plays during the tail/transition into Act 5
  { startMs: 19500, endMs: 22500, text: () => `Prepare yourself — out on the road, every inspection goes on your record.` },
];

const ACT_DURATION_MS = 22500;

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE SYSTEMS — three-tier depth-of-field
// ─────────────────────────────────────────────────────────────────────────────

// Tier 1: Fine dust motes drifting upward in lamp shaft (depth-of-field background)
// Deterministic positions seeded so motes are consistent across renders
const FINE_DUST_MOTES = Array.from({ length: 24 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const x = (seed / 233280) * 100;
  const seedY = ((i * 7919) % 65536) / 65536;
  const y = 15 + seedY * 75;
  const seedDelay = ((i * 12347) % 16000) / 1000;
  const seedDuration = 8 + ((i * 4621) % 7000) / 1000;
  const seedSize = 1.2 + ((i * 8179) % 1200) / 1000;
  const seedOpacity = 0.18 + ((i * 5743) % 4500) / 10000;
  return { x, y, delay: seedDelay, duration: seedDuration, size: seedSize, opacity: seedOpacity };
});

// Tier 2: Larger slow-drifting particles (mid-depth, less common)
const LARGE_PARTICLES = Array.from({ length: 6 }, (_, i) => {
  const seed = (i * 17389 + 81247) % 419430;
  const x = (seed / 419430) * 100;
  const seedY = ((i * 4231) % 65536) / 65536;
  const y = 25 + seedY * 50;
  const seedDelay = ((i * 23371) % 22000) / 1000;
  const seedDuration = 14 + ((i * 9851) % 8000) / 1000;
  const seedSize = 2.8 + ((i * 13877) % 2500) / 1000;
  const seedOpacity = 0.15 + ((i * 7589) % 2500) / 10000;
  return { x, y, delay: seedDelay, duration: seedDuration, size: seedSize, opacity: seedOpacity };
});

// Tier 3: Bright bokeh sparkles catching lamp light (foreground occasional)
const BOKEH_SPARKLES = Array.from({ length: 4 }, (_, i) => {
  const seed = (i * 31397 + 102931) % 999983;
  const x = 12 + (seed / 999983) * 70;  // bias away from edges
  const seedY = ((i * 23851) % 65536) / 65536;
  const y = 30 + seedY * 45;
  const seedDelay = 2 + ((i * 41753) % 14000) / 1000;
  const seedDuration = 4 + ((i * 17389) % 5000) / 1000;
  const seedSize = 4.5 + ((i * 28391) % 3500) / 1000;
  return { x, y, delay: seedDelay, duration: seedDuration, size: seedSize };
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const Act4TheMentor = React.memo(function Act4TheMentor({
  imageUrls = {},
  companyName = 'kid',
  onComplete = () => {},
  onSkip = () => {},
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  // ─── AUDIO INTEGRATION (Phase 4.6) ──────────────────────────
  // Wires this act to the welcome-modal AudioMixer. The hook handles
  // music bed transitions, VO playback, SFX (file + procedural synth).
  // No-op if the AudioMixerContext isn't mounted.
  useActAudio('4', elapsedMs);

  // Master timer — single rAF loop with cleanup
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

  // Compute current dialogue segment based on elapsed time
  const currentSegment = useMemo(() => {
    return VOICEMAIL_SEGMENTS.find(
      (seg) => elapsedMs >= seg.startMs && elapsedMs < seg.endMs
    );
  }, [elapsedMs]);

  // Voicemail progress (0-100) based on first segment start to LAST VOICEMAIL
  // segment end — explicitly excluding the bridge (segment 7) because the bridge
  // plays after the voicemail card has faded out, and counting it would advance
  // the progress bar past 100% during the tail.
  const voicemailProgress = useMemo(() => {
    const first = VOICEMAIL_SEGMENTS[0].startMs;
    const last = VOICEMAIL_SEGMENTS[5].endMs;  // index 5 = "Pick up the phone." (last voicemail line)
    const span = last - first;
    const adjusted = Math.max(0, elapsedMs - first);
    return Math.min(100, (adjusted / span) * 100);
  }, [elapsedMs]);

  // Layer opacities — three photos cross-fade with 700ms overlap windows.
  // Tuned for 18000ms total runtime:
  //   Layer 1 (wide):      visible 0-5800ms,  fades out 5100-5800ms
  //   Layer 2 (paperwork): fades in 5100-5800ms, visible 5800-12100ms, fades out 11400-12100ms
  //   Layer 3 (CB radio):  fades in 11400-12100ms, visible 12100-17500ms, fades out 17500-18000ms
  const layer1Opacity =
    elapsedMs < 5100 ? 1 :
    elapsedMs < 5800 ? 1 - (elapsedMs - 5100) / 700 :
    0;

  const layer2Opacity =
    elapsedMs < 5100 ? 0 :
    elapsedMs < 5800 ? (elapsedMs - 5100) / 700 :
    elapsedMs < 11400 ? 1 :
    elapsedMs < 12100 ? 1 - (elapsedMs - 11400) / 700 :
    0;

  const layer3Opacity =
    elapsedMs < 11400 ? 0 :
    elapsedMs < 12100 ? (elapsedMs - 11400) / 700 :
    elapsedMs < 17500 ? 1 :
    1 - Math.min(1, (elapsedMs - 17500) / 500);

  // ─── CROSS-DISSOLVE FADE-IN (storyboard line 1204: "3 → 4 | Cross-dissolve through warm light | 600ms") ───
  // The photo layers fade in over the first 600ms, multiplying their base opacity.
  // Combined with a warm-light overlay that fades OUT over the same period, this
  // creates a "cross-dissolve through warm light" effect that bridges Act 3's
  // dimmed phone (cold blue) into Act 4's lamp-lit Marcus (warm amber).
  // Ease-out cubic for natural softness.
  const crossDissolveProgress = Math.min(1, elapsedMs / 600);
  const crossDissolveOpacity = 1 - Math.pow(1 - crossDissolveProgress, 3);
  // Warm-light overlay: bright at t=0, fades to invisible by t=600ms
  // Uses a warm-amber radial that ENVELOPS the frame at the moment of transition
  const warmLightOverlayOpacity = (1 - crossDissolveProgress) * 0.7;

  // Ken Burns transforms — pushed slightly more aggressive for 18s holds (1.0->1.08 instead of 1.0->1.05)
  // Layer 1 (wide portrait crop, 0-5800ms): subtle push toward Marcus on the right
  const layer1Scale = 1 + (Math.min(elapsedMs, 5800) / 5800) * 0.08;   // 1.0 -> 1.08
  const layer1ShiftX = (Math.min(elapsedMs, 5800) / 5800) * 1.5;
  const layer1ShiftY = (Math.min(elapsedMs, 5800) / 5800) * -0.5;

  // Layer 2 (paperwork close-up, 5100-12100ms, ~7000ms visible): slow push-in
  const t2 = Math.max(0, Math.min(7000, elapsedMs - 5100));
  const layer2Scale = 1.02 + (t2 / 7000) * 0.08;      // 1.02 -> 1.10
  const layer2ShiftY = (t2 / 7000) * 0.8;

  // Layer 3 (CB radio, 11400-18000ms, ~6600ms duration): pull back
  const t3 = Math.max(0, Math.min(6600, elapsedMs - 11400));
  const layer3Scale = 1.08 - (t3 / 6600) * 0.06;      // 1.08 -> 1.02
  const layer3ShiftY = -0.4 + (t3 / 6600) * 0.7;

  // Cinema bar state
  const cinemaInProgress = elapsedMs < 900;

  // Voicemail card opacity choreography — addresses two audit findings:
  //
  // FIX 2: Card and on-screen captions both deliver Marcus's words simultaneously,
  //   creating split attention in the lower third. Solution: card establishes
  //   itself prominently in the first ~1.6s ("this is a voicemail from Marcus
  //   Rodriguez at 5:47 AM at J.A.P. Logistics"), then fades to 35% opacity during
  //   active dialogue segments 2-5 so the Netflix-prestige caption can carry the
  //   words alone. Card returns to full opacity for the final CTA beat ("I'll be
  //   here. Pick up the phone.") where its voicemail framing reinforces the action.
  //
  // FIX 3: Card was previously 100% opacity through the tail fade, leaving it
  //   suspended over pure black + particles after the photos finished. Solution:
  //   card fades to 0 during the tail (16800-17800ms) synchronized with the photo
  //   fade-out, ending the act on a clean black-with-fading-haze frame.
  //
  // Five opacity states across the 18-second timeline:
  //   0      - 800ms:    not yet rendered (entrance gated below)
  //   800    - 1300ms:   fade-in entrance (0 → 1.0) — replaces former CSS keyframe
  //   1300   - 2200ms:   full prominence hold (1.0)
  //   2200   - 2700ms:   transition down to dimmed state
  //   2700   - 15800ms:  dimmed during competing dialogue (0.35)
  //   15800  - 16100ms:  transition back up to full prominence
  //   16100  - 16800ms:  full prominence for final CTA beat (1.0)
  //   16800  - 17800ms:  tail fade synchronized with photo fade-out
  //   17800+ - 18000ms:  fully faded
  const voicemailVisible = elapsedMs >= 800;
  const voicemailCardOpacity =
    elapsedMs < 1300  ? Math.max(0, (elapsedMs - 800) / 500) :
    elapsedMs < 2200  ? 1.0 :
    elapsedMs < 2700  ? 1.0 - ((elapsedMs - 2200) / 500) * 0.65 :
    elapsedMs < 15800 ? 0.35 :
    elapsedMs < 16100 ? 0.35 + ((elapsedMs - 15800) / 300) * 0.65 :
    elapsedMs < 16800 ? 1.0 :
    elapsedMs < 17800 ? 1.0 - ((elapsedMs - 16800) / 1000) :
    0;

  // Format progress timer (M:SS / 0:17)
  // Voicemail spans from the first segment start (800ms) to last segment end (~17900ms)
  const totalSec = 17;
  const elapsedSec = Math.max(0, Math.min(totalSec, Math.floor((elapsedMs - 800) / 1000)));
  const formatTime = (s) => `0:${String(s).padStart(2, '0')}`;
  const progressLabel = `${formatTime(elapsedSec)} / ${formatTime(totalSec)}`;

  const wideSrc = imageUrls.wide || '';
  const paperworkSrc = imageUrls.paperwork || '';
  const cbRadioSrc = imageUrls.cbRadio || '';

  return (
    <div className="a4-stage">
      <style>{ACT4_STYLES}</style>

      {/* ─── PHOTO LAYERS ─── */}
      <div className="a4-photo-layer" style={{
        opacity: layer1Opacity * crossDissolveOpacity,
        backgroundImage: `url("${wideSrc}")`,
        transform: `scale(${layer1Scale}) translate(${layer1ShiftX}%, ${layer1ShiftY}%)`,
      }} />
      <div className="a4-photo-layer layer-2" style={{
        opacity: layer2Opacity * crossDissolveOpacity,
        backgroundImage: `url("${paperworkSrc}")`,
        transform: `scale(${layer2Scale}) translate(0%, ${layer2ShiftY}%)`,
      }} />
      <div className="a4-photo-layer layer-3" style={{
        opacity: layer3Opacity * crossDissolveOpacity,
        backgroundImage: `url("${cbRadioSrc}")`,
        transform: `scale(${layer3Scale}) translate(0%, ${layer3ShiftY}%)`,
      }} />

      {/* ─── WARM-LIGHT TRANSITION OVERLAY (cross-dissolve through warm light) ─── */}
      {/* Storyboard line 1204: "3 → 4 | Cross-dissolve through warm light | 600ms"
          Warm radial gradient that envelops the frame during the transition,
          fading to invisible by 600ms. Bridges Act 3's cold blue phone screen
          into Act 4's warm lamp-lit Marcus. Sits above photos so it tints
          them warm during the fade-in. */}
      {warmLightOverlayOpacity > 0.001 && (
        <div
          className="a4-warm-transition"
          style={{ opacity: warmLightOverlayOpacity }}
        />
      )}

      {/* ─── LAMP-LIGHT SHAFT (subtle global warm enhancement; photos carry the actual lamp) ─── */}
      <div className="a4-light-shaft" />

      {/* ─── VOLUMETRIC HAZE (Hurlbut diffusion — softens HD edge into 35mm film texture) ─── */}
      {/* SVG turbulence noise layer that drifts horizontally and breathes vertically.
          Three sub-layers at different opacities and drift speeds create depth-of-field haze. */}
      <div className="a4-haze-layer a4-haze-near" />
      <div className="a4-haze-layer a4-haze-mid" />
      <div className="a4-haze-layer a4-haze-far" />

      {/* ─── PARTICLE SYSTEMS — three-tier depth-of-field ─── */}
      <div className="a4-particle-container">
        {/* Tier 1: Fine dust motes drifting upward in lamp shaft */}
        {FINE_DUST_MOTES.map((mote, i) => (
          <div
            key={`fine-${i}`}
            className="a4-mote a4-mote-fine"
            style={{
              left: `${mote.x}%`,
              top: `${mote.y}%`,
              width: `${mote.size}px`,
              height: `${mote.size}px`,
              opacity: mote.opacity,
              animationDelay: `${mote.delay}s`,
              animationDuration: `${mote.duration}s`,
            }}
          />
        ))}
        {/* Tier 2: Larger slow-drifting room particles */}
        {LARGE_PARTICLES.map((p, i) => (
          <div
            key={`large-${i}`}
            className="a4-mote a4-mote-large"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
        {/* Tier 3: Bokeh sparkles catching lamp light (rare bright spots) */}
        {BOKEH_SPARKLES.map((b, i) => (
          <div
            key={`bokeh-${i}`}
            className="a4-mote a4-mote-bokeh"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        ))}
      </div>

      {/* ─── ATMOSPHERIC LAYERS (always present) ─── */}
      <div className="a4-vignette" />
      <div className="a4-scanlines" />
      <div className="a4-grain" />
      <div
        className="a4-warm-tint"
        style={{
          // Warm tint fades out 21400-22000ms during the cross-dissolve into Act 5.
          // At act start (Act 5), the cold blue register takes over. This produces
          // the literal warm-to-cold visual transition under Marcus's bridge line.
          opacity: elapsedMs < 21400 ? 1 : Math.max(0, 1 - (elapsedMs - 21400) / 600),
        }}
      />

      {/* ─── CINEMA BARS ─── */}
      <div className={`a4-cine-top ${cinemaInProgress ? 'entering' : ''}`} />
      <div className={`a4-cine-bottom ${cinemaInProgress ? 'entering' : ''}`} />

      {/* ─── iOS VOICEMAIL UI OVERLAY ─── */}
      {voicemailVisible && (
        <div className="a4-voicemail-card" style={{ opacity: voicemailCardOpacity }}>
          <div className="a4-vm-header">
            <span className="a4-vm-label">Voicemail</span>
            <span className="a4-vm-time">5:47 AM</span>
          </div>

          <div className="a4-vm-divider" />

          <div className="a4-vm-contact">
            <div className="a4-vm-avatar">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="8" r="3.5" stroke="rgba(255,200,140,0.85)" strokeWidth="1.4" />
                <path d="M3.5 19c0-3.5 3.5-6 7.5-6s7.5 2.5 7.5 6" stroke="rgba(255,200,140,0.85)" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="a4-vm-contact-info">
              <div className="a4-vm-name">Marcus Rodriguez</div>
              <div className="a4-vm-role">Dispatch · J.A.P. Logistics</div>
            </div>
          </div>

          <div className="a4-vm-divider" />

          <div className="a4-vm-player">
            <div className="a4-vm-play-btn">
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M3 2 L11 7 L3 12 Z" fill="rgba(255,210,150,0.95)" />
              </svg>
            </div>

            <div className="a4-vm-progress">
              <div className="a4-vm-progress-track">
                <div
                  className="a4-vm-progress-fill"
                  style={{ width: `${voicemailProgress}%` }}
                />
                <div
                  className="a4-vm-progress-handle"
                  style={{ left: `${voicemailProgress}%` }}
                />
              </div>
              <div className="a4-vm-progress-labels">
                <span>{progressLabel.split(' / ')[0]}</span>
                <span>{progressLabel.split(' / ')[1]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIALOGUE CAPTION (lower-third, above voicemail card) ─── */}
      {currentSegment && (
        <div className="a4-caption" key={currentSegment.startMs}>
          <div className="a4-caption-text">{currentSegment.text(companyName)}</div>
        </div>
      )}

      {/* ─── 5:47 AM CLOCK MARKER (subtle, top-left corner) ─── */}
      <div className="a4-clock-marker">
        <span className="a4-clock-dot" />
        <span className="a4-clock-time">05:47 AM · WEDNESDAY</span>
      </div>

      {/* ─── SKIP BUTTON (subtle, lower-right) ─── */}
      <button className="a4-skip-btn" onClick={onSkip} aria-label="Skip act">
        Skip
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STYLES — Empire Legacy idiom inheritance
// ─────────────────────────────────────────────────────────────────────────────

const ACT4_STYLES = `
.a4-stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: #050402;
  overflow: hidden;
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  color: #f0e6c8;
  -webkit-tap-highlight-color: transparent;
  /* Sub-pixel handheld camera jitter — simulates a real camera operator's micro-movements
     rather than animation-perfect stillness. The 11.7s irrational period prevents the
     pattern from feeling looped. ±0.4px translation barely visible per-frame but compounds
     into the "lived-in" feel that distinguishes cinematic from animated. */
  animation: a4HandheldJitter 11.7s ease-in-out infinite;
}

@keyframes a4HandheldJitter {
  0%   { transform: translate(0px, 0px); }
  17%  { transform: translate(-0.3px, 0.4px); }
  29%  { transform: translate(0.4px, -0.2px); }
  43%  { transform: translate(-0.4px, -0.3px); }
  61%  { transform: translate(0.2px, 0.4px); }
  79%  { transform: translate(-0.2px, -0.4px); }
  100% { transform: translate(0px, 0px); }
}

/* ─── PHOTO LAYERS ─── */
/* Each layer sits on opaque #050402 base. Layers are stacked with z-index 1, 2, 3
   so layer 3 is always on top. During crossfade between layer N and layer N+1,
   the upper layer's opacity rises 0→1 while the lower layer's opacity falls 1→0,
   but the upper layer paints over the lower so during transition we see a clean
   blend rather than competing imagery from a third layer below.

   Focus-drift animation: each photo subtly breathes blur 0px → 0.6px → 0px over
   8-10s. This simulates camera autofocus micro-hunt and is the single most
   powerful "feels alive" trick in modern cinematic photo motion. The blur
   amounts are below conscious perception threshold but compound the "this is
   a real camera, not a slideshow" feeling. */
.a4-photo-layer {
  position: absolute;
  inset: 0;
  background-color: #050402;
  background-size: cover;
  background-position: center 40%;
  background-repeat: no-repeat;
  transform-origin: center center;
  will-change: transform, opacity, filter;
  z-index: 1;
  animation: a4FocusDrift 9s ease-in-out infinite;
}
.a4-photo-layer.layer-2 {
  z-index: 2;
  animation-duration: 11s;
  animation-delay: -3s;
}
.a4-photo-layer.layer-3 {
  z-index: 3;
  animation-duration: 8s;
  animation-delay: -1.5s;
}

/* ─── WARM-LIGHT TRANSITION OVERLAY ───
   Active during the first 600ms only (driven by inline opacity from JS).
   Provides the "through warm light" component of the storyboard's
   "cross-dissolve through warm light, 600ms" specification for Act 3 → Act 4.
   
   Visual: a warm-amber radial gradient that envelops the frame, brightest
   at the moment of transition (Act 3's exit) and fading to invisible by
   600ms. The mix-blend-mode: screen ensures it tints the underlying photo
   (which is also fading IN simultaneously) rather than washing it out. */
.a4-warm-transition {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 50%,
      rgba(255, 200, 130, 0.55) 0%,
      rgba(255, 175, 95, 0.35) 35%,
      rgba(255, 150, 70, 0.15) 65%,
      rgba(20, 12, 6, 0.85) 100%);
  mix-blend-mode: screen;
  will-change: opacity;
}

@keyframes a4FocusDrift {
  0%, 100% { filter: blur(0px); }
  50%      { filter: blur(0.6px); }
}

/* ─── LAMP-LIGHT SHAFT (frame-wide warm enhancement; complements not competes with photo lamps) ─── */
/* Each photo has its own lamp at different positions. A static overlay would clash. Instead we
   add a subtle frame-wide warm gradient enhancement that simulates volumetric light scatter,
   plus a breathing modulation that suggests the lamp's flickering presence without anchoring
   to a specific position. */
.a4-light-shaft {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  background:
    radial-gradient(ellipse 70% 50% at 50% 35%,
      rgba(255, 200, 130, 0.10) 0%,
      rgba(255, 170, 80, 0.05) 35%,
      transparent 65%),
    radial-gradient(ellipse 30% 70% at 30% 50%,
      rgba(255, 180, 100, 0.06) 0%,
      transparent 70%);
  mix-blend-mode: screen;
  animation: a4ShaftBreath 5.5s ease-in-out infinite;
}

@keyframes a4ShaftBreath {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1.05; }
}

/* ─── VOLUMETRIC HAZE — Hurlbut diffusion technique ─── */
/* Three layers of SVG turbulence noise create depth-of-field atmospheric haze that softens
   the HD photo edge into 35mm film texture. Each layer drifts at a different speed creating
   depth — far layer slow, near layer slightly faster. The combination suggests volumetric
   air with dust and atmosphere, not just a flat photographic surface.
   
   Reference: Shane Hurlbut ASC on Act of Valor — "the texture of smoke helped us cross-cut
   seamlessly from 35mm motion picture film and the 5D...added a natural texture that was
   not noise but a type of diffusion." */

.a4-haze-layer {
  position: absolute;
  inset: -20%;
  z-index: 8;
  pointer-events: none;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}

.a4-haze-far {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.015 0.025' numOctaves='3' seed='2'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.85  0 0 0 0 0.65  0 0 0 0.18 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 200% 150%;
  opacity: 0.25;
  animation: a4HazeFar 38s linear infinite;
  filter: blur(12px);
}

.a4-haze-mid {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.025 0.04' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.92  0 0 0 0 0.75  0 0 0 0.22 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 180% 130%;
  opacity: 0.28;
  animation: a4HazeMid 26s linear infinite;
  filter: blur(8px);
}

.a4-haze-near {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><filter id='haze'><feTurbulence type='fractalNoise' baseFrequency='0.04 0.06' numOctaves='2' seed='13'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.82  0 0 0 0.16 0'/></filter><rect width='800' height='600' filter='url(%23haze)'/></svg>");
  background-size: 160% 120%;
  opacity: 0.20;
  animation: a4HazeNear 18s linear infinite;
  filter: blur(5px);
}

@keyframes a4HazeFar {
  0%   { transform: translateX(-2%) translateY(0%) scale(1.02); }
  50%  { transform: translateX(2%) translateY(-1%) scale(1.05); }
  100% { transform: translateX(-2%) translateY(0%) scale(1.02); }
}

@keyframes a4HazeMid {
  0%   { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
  50%  { transform: translateX(-3%) translateY(0.5%) scale(1.06); }
  100% { transform: translateX(3%) translateY(-0.5%) scale(1.03); }
}

@keyframes a4HazeNear {
  0%   { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
  50%  { transform: translateX(2%) translateY(-0.5%) scale(1.07); }
  100% { transform: translateX(-1.5%) translateY(0.3%) scale(1.04); }
}

/* ─── PARTICLE SYSTEMS — three-tier depth-of-field ─── */
.a4-particle-container {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  overflow: hidden;
}

.a4-mote {
  position: absolute;
  border-radius: 50%;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
  will-change: transform, opacity;
  pointer-events: none;
}

/* Tier 1: Fine dust drifting upward through lamp shaft (background depth) */
.a4-mote-fine {
  background: radial-gradient(circle, rgba(255, 220, 160, 0.95) 0%, rgba(255, 200, 120, 0.4) 50%, transparent 100%);
  filter: blur(0.4px);
  animation-name: a4MoteFineDrift;
}

@keyframes a4MoteFineDrift {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  50%  { transform: translate(8px, -22px); }
  90%  { opacity: 1; }
  100% { transform: translate(-4px, -48px); opacity: 0; }
}

/* Tier 2: Larger room dust drifting more slowly with horizontal travel (mid-depth) */
.a4-mote-large {
  background: radial-gradient(circle, rgba(255, 215, 150, 0.7) 0%, rgba(255, 195, 110, 0.25) 60%, transparent 100%);
  filter: blur(1px);
  animation-name: a4MoteLargeDrift;
}

@keyframes a4MoteLargeDrift {
  0%   { transform: translate(0, 0) scale(1); opacity: 0; }
  15%  { opacity: 0.85; }
  50%  { transform: translate(18px, -14px) scale(1.1); opacity: 1; }
  85%  { opacity: 0.7; }
  100% { transform: translate(36px, -32px) scale(0.9); opacity: 0; }
}

/* Tier 3: Bright bokeh sparkles catching lamp light (foreground occasional) */
.a4-mote-bokeh {
  background: radial-gradient(circle,
    rgba(255, 240, 200, 1) 0%,
    rgba(255, 220, 150, 0.85) 25%,
    rgba(255, 180, 90, 0.4) 55%,
    transparent 100%);
  filter: blur(1.5px);
  box-shadow: 0 0 8px rgba(255, 220, 150, 0.4);
  animation-name: a4MoteBokehFlash;
}

@keyframes a4MoteBokehFlash {
  0%, 100% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  20%      { transform: translate(2px, -3px) scale(1); opacity: 0.85; }
  50%      { transform: translate(4px, -8px) scale(1.15); opacity: 1; }
  80%      { transform: translate(6px, -14px) scale(0.95); opacity: 0.5; }
}

/* ─── ATMOSPHERIC LAYERS ─── */
.a4-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 45%,
    transparent 35%,
    rgba(0, 0, 0, 0.35) 78%,
    rgba(0, 0, 0, 0.65) 100%);
  z-index: 10;
  pointer-events: none;
}

.a4-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.0) 0px,
    rgba(0, 0, 0, 0.0) 2px,
    rgba(0, 0, 0, 0.10) 3px,
    rgba(0, 0, 0, 0.0) 4px
  );
  z-index: 11;
  pointer-events: none;
  opacity: 0.4;
  mix-blend-mode: multiply;
}

.a4-grain {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' /></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.4'/></svg>");
  z-index: 12;
  pointer-events: none;
  opacity: 0.18;
  mix-blend-mode: overlay;
  animation: a4GrainShift 0.5s steps(4) infinite;
}

@keyframes a4GrainShift {
  0%   { transform: translate(0, 0); }
  25%  { transform: translate(-1%, 1%); }
  50%  { transform: translate(1%, -1%); }
  75%  { transform: translate(-1%, -1%); }
  100% { transform: translate(0, 0); }
}

.a4-warm-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg,
    rgba(80, 40, 10, 0.10) 0%,
    rgba(40, 20, 5, 0.05) 50%,
    rgba(10, 5, 2, 0.18) 100%);
  z-index: 13;
  pointer-events: none;
  mix-blend-mode: multiply;
}

/* ─── CINEMA BARS (Empire Legacy idiom) ─── */
.a4-cine-top, .a4-cine-bottom {
  position: absolute;
  left: 0; right: 0;
  background: #000;
  height: 32px;
  z-index: 80;
  will-change: transform;
}
.a4-cine-top    { top: 0;    transform: translateY(-100%); }
.a4-cine-bottom { bottom: 0; transform: translateY(100%); }

.a4-cine-top.entering {
  animation: a4CineDown 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
}
.a4-cine-bottom.entering {
  animation: a4CineUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
}

@keyframes a4CineDown { to { transform: translateY(0); } }
@keyframes a4CineUp   { to { transform: translateY(0); } }

/* Stay locked in place after entering animation completes */
.a4-cine-top:not(.entering)    { transform: translateY(0); }
.a4-cine-bottom:not(.entering) { transform: translateY(0); }

/* ─── 5:47 AM CLOCK MARKER ─── */
.a4-clock-marker {
  position: absolute;
  top: 44px;
  left: 16px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 200, 130, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
  opacity: 0;
  animation: a4FadeIn 0.8s ease-out 0.6s forwards;
}

.a4-clock-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ff5544;
  box-shadow: 0 0 8px #ff5544, 0 0 14px rgba(255, 85, 68, 0.6);
  animation: a4ClockPulse 1.6s ease-in-out infinite;
}

@keyframes a4ClockPulse {
  0%, 100% { opacity: 0.6; box-shadow: 0 0 6px #ff5544; }
  50%      { opacity: 1; box-shadow: 0 0 14px #ff5544, 0 0 24px rgba(255,85,68,0.7); }
}

@keyframes a4FadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ─── SKIP BUTTON ─── */
.a4-skip-btn {
  position: absolute;
  bottom: 44px;
  right: 14px;
  z-index: 90;
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 220, 180, 0.55);
  border: 0.5px solid rgba(255, 220, 180, 0.25);
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
  animation: a4FadeIn 0.6s ease-out 1.5s forwards;
  min-width: 44px;
  min-height: 28px;
}
.a4-skip-btn:hover, .a4-skip-btn:active {
  color: rgba(255, 220, 180, 0.95);
  transform: scale(1.05);
}

/* ─── DIALOGUE CAPTION ─── */
/* Cinematic-prestige aesthetic. No borders, no background container. The text
   carries itself through layered shadow that creates legibility against any
   photo backdrop. Inspired by Netflix prestige docs and Apple TV+ originals.
   Position: above voicemail card with breathing room. The text-shadow stack
   gives black-stroke-like legibility plus warm bloom that ties into Act 4's
   lamp-light atmosphere without resorting to gold-glow gimmickry. */
.a4-caption {
  position: absolute;
  left: 24px; right: 24px;
  bottom: 232px;
  z-index: 60;
  text-align: center;
  pointer-events: none;
  animation: a4CaptionEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes a4CaptionEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.a4-caption-text {
  display: inline-block;
  font-family: 'Outfit', sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.42;
  color: #fdf6e3;
  letter-spacing: 0.005em;
  /* Layered shadow stack: tight black for stroke-like legibility, then warm bloom */
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 1),
    0 0 8px rgba(0, 0, 0, 0.95),
    0 2px 16px rgba(0, 0, 0, 0.85),
    0 0 28px rgba(255, 180, 90, 0.18);
  max-width: 100%;
  padding: 0;
}

/* ─── iOS VOICEMAIL CARD ─── */
.a4-voicemail-card {
  position: absolute;
  left: 14px; right: 14px;
  bottom: 56px;
  z-index: 70;
  background: rgba(20, 16, 10, 0.78);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 0.5px solid rgba(255, 200, 130, 0.20);
  border-radius: 14px;
  padding: 12px 14px 14px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.65),
    0 0 1px rgba(255, 200, 130, 0.30) inset;
  /* Transform-only entrance animation. Opacity is controlled by React-driven inline
     style (voicemailCardOpacity) so the dialogue-period dimming choreography works
     after the entrance completes. Mixing keyframe opacity with inline opacity causes
     the keyframe's animation-fill-mode: both to lock the value, breaking the
     dimming. Solution: keep keyframe handling only the slide-in transform. */
  animation: a4VoicemailEnter 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
  /* will-change hints GPU compositor to keep this layer separate during the
     dialogue-period dimming transitions at 15800ms and 16800ms tail. */
  will-change: opacity, transform;
}

@keyframes a4VoicemailEnter {
  from { transform: translateY(28px) scale(0.96); }
  to   { transform: translateY(0) scale(1); }
}

.a4-vm-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.a4-vm-label {
  font-family: 'Outfit', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: rgba(255, 220, 180, 0.95);
  text-transform: uppercase;
}
.a4-vm-time {
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 200, 130, 0.75);
  letter-spacing: 0.10em;
}

.a4-vm-divider {
  height: 0.5px;
  background: rgba(255, 200, 130, 0.18);
  margin: 0;
}

.a4-vm-contact {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}
.a4-vm-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(40, 28, 14, 0.85);
  border: 0.5px solid rgba(255, 200, 130, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.a4-vm-contact-info {
  flex: 1;
  min-width: 0;
}
.a4-vm-name {
  font-family: 'Outfit', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #fff8dc;
  letter-spacing: 0.01em;
}
.a4-vm-role {
  font-family: 'Outfit', sans-serif;
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 200, 130, 0.65);
  letter-spacing: 0.04em;
  margin-top: 2px;
}

.a4-vm-player {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
}
.a4-vm-play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(40, 28, 14, 0.85);
  border: 0.5px solid rgba(255, 200, 130, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  animation: a4PlayPulse 2.2s ease-in-out infinite;
}

@keyframes a4PlayPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 200, 130, 0.0); }
  50%      { box-shadow: 0 0 0 6px rgba(255, 200, 130, 0.12); }
}

.a4-vm-progress {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.a4-vm-progress-track {
  position: relative;
  height: 3px;
  background: rgba(255, 200, 130, 0.15);
  border-radius: 1.5px;
  overflow: visible;
}
.a4-vm-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(90deg, rgba(255, 200, 130, 0.85) 0%, rgba(255, 220, 160, 1) 100%);
  border-radius: 1.5px;
}
.a4-vm-progress-handle {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #fff8dc;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 6px rgba(255, 220, 160, 0.8), 0 1px 3px rgba(0, 0, 0, 0.6);
}
.a4-vm-progress-labels {
  display: flex;
  justify-content: space-between;
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  color: rgba(255, 200, 130, 0.65);
  letter-spacing: 0.08em;
}

/* ─── REDUCE-MOTION ACCESSIBILITY (dual activation) ─── */
/* Two activation paths into the same rules:
   1. App.jsx applies .perf-reduce-motion to its root container when the user has either
      OS-level prefers-reduced-motion enabled OR the in-app Settings toggle on. The
      cinematic inherits the class because it lives inside App.jsx's root.
   2. Standalone @media query as fallback for the calibration REVIEW.html harness which
      runs outside App.jsx and has no parent class to inherit from.
   What's disabled: handheld jitter, focus drift, particle motion, atmospheric haze drift,
   lamp flicker, scanline shift, grain animation, dust drift. What's preserved: photo
   crossfades (the narrative beat), caption fade-in (legibility), voicemail card animation
   (functional UI affordance), Ken Burns transforms (still and gentle, not pulsing).
   Pattern matches Empire Legacy's reduce-motion handling at EmpireLegacyApex.jsx:927-935. */
.perf-reduce-motion .a4-stage,
.perf-reduce-motion .a4-haze-layer,
.perf-reduce-motion .a4-light-shaft,
.perf-reduce-motion .a4-mote,
.perf-reduce-motion .a4-grain,
.perf-reduce-motion .a4-photo-layer,
.perf-reduce-motion .a4-clock-dot,
.perf-reduce-motion .a4-vm-play-btn {
  animation: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .a4-stage,
  .a4-haze-layer,
  .a4-light-shaft,
  .a4-mote,
  .a4-grain,
  .a4-photo-layer,
  .a4-clock-dot,
  .a4-vm-play-btn {
    animation: none !important;
  }
}
`;

export default Act4TheMentor;
