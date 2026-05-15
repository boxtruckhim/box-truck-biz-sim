/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6 — v5 with complete image wiring
 * WelcomeModal.jsx  (file lives in: src/WelcomeModal.jsx)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * v5 changes (over v4):
 *   • Complete image wiring for ALL photo-dependent acts (1, 4, 6, 7).
 *   • Single ASSETS object — easy to edit if you want different filenames.
 *
 * Acts that previously failed silently because they got null/{} for their
 * image props/globals:
 *   - Act 1  → needs imageUrl  (single photo)
 *   - Act 4  → needs imageUrls.cbRadio, imageUrls.paperwork, imageUrls.wide
 *   - Act 6  → needs imageUrls.flash1Engine ... flash5Liftgate (5 photos)
 *   - Act 7  → needs imageUrls.flash2Driver, flash3Truck, flash4Dispatch
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Asset file expectations:
 *
 * The 16 files below must exist at public/welcome_modal_assets/. The names
 * I picked are descriptive — if your existing files have different names,
 * you can either:
 *   (a) rename your files to match this list, OR
 *   (b) edit the URLs in the ASSETS object below to match your filenames.
 * ════════════════════════════════════════════════════════════════════════════
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { AudioMixerProvider, AudioMixerContext } from '../audio/AudioMixerContext.jsx';
// TapToBeginOverlay removed — audio auto-unlocks on mount
import { MuteButton }           from '../audio/MuteButton.jsx';

import Act1_ColdOpen              from '../welcome_modal/act1/Act1_ColdOpen.jsx';
import Act2_TitleDrop             from '../welcome_modal/act2/Act2_TitleDrop.jsx';
import Act3_MissedCall            from '../welcome_modal/act3/Act3_MissedCall.jsx';
import Act4_TheMentor             from '../welcome_modal/act4/Act4_TheMentor.jsx';
import Act5_TheScore              from '../welcome_modal/act5/Act5_TheScore.jsx';
import Act6_GameplayMontage       from '../welcome_modal/act6/Act6_GameplayMontage.jsx';
import Act7_Decisions             from '../welcome_modal/act7/Act7_Decisions.jsx';
import Act8_TheJob                from '../welcome_modal/act8/Act8_TheJob.jsx';
import Act8_5_TheChoice           from '../welcome_modal/act8_5/Act8_5_TheChoice.jsx';
import Act9_TheLongGame           from '../welcome_modal/act9/Act9_TheLongGame.jsx';
import Act10_ThePromise           from '../welcome_modal/act10/Act10_ThePromise.jsx';
import Act11_TheCompliancePromise from '../welcome_modal/act11/Act11_TheCompliancePromise.jsx';
import Act12_Launch               from '../welcome_modal/act12/Act12_Launch.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE ASSET URLs — all files in public/welcome_modal_assets/
// ─────────────────────────────────────────────────────────────────────────────
// Edit any of these URLs if you want to use different filenames.
const BASE = '/welcome_modal_assets';

const ASSETS = {
  // Act 1 — cold open scene (single photo)
  act1: {
    terminalYard: `${BASE}/act1_terminal_yard.png`,
  },
  // Act 3 — phone vibrating scene (single texture)
  act3: {
    woodTexture: `${BASE}/wood_grain.jpg`,
  },
  // Act 4 — Marcus voicemail (3 portrait photos)
  act4: {
    cbRadio:   `${BASE}/act4_cbradio.png`,
    paperwork: `${BASE}/act4_paperwork.png`,
    wide:      `${BASE}/act4_wide.png`,
  },
  // Act 6 — gameplay montage
  // Note: flash4Dock (dock scene) does NOT use a photo background — it uses
  // a synthetic CSS dock yard + the truck PNG via window.A6_TRUCK_TOP.
  // The truckTop image is the FLIPPED top-down view of the box truck for
  // the dock-backing animation.
  act6: {
    flash1Engine:     `${BASE}/act6_engine.png`,
    flash2POV:        `${BASE}/act6_pov.png`,
    flash3Inspection: `${BASE}/act6_inspection.png`,
    flash5Liftgate:   `${BASE}/act6_liftgate.png`,
    truckTop:         `${BASE}/act6_dock.png`,   // window.A6_TRUCK_TOP — truck PNG (flipped, top-down)
  },
  // Act 7 — decision flashes
  // Note: flash4Dispatch does NOT use a cover-style background photo. The
  // dispatch scene renders a USA map at FIXED SVG dimensions (480x534)
  // because the city positions (CHI, ATL, DET, MEM, CLE, PIT) and the
  // route lines connecting them are drawn at calibrated coordinates that
  // only line up correctly if the map is at the exact intended size.
  // The map is wired via window.A7_MAP_BG, and the SVG uses
  // preserveAspectRatio="none" to stretch the map to fit those 480x534
  // SVG units. NEGOTIATE flash has no photo (fully synthetic UI).
  act7: {
    flash2Driver:   `${BASE}/act7_driver.png`,
    flash3Truck:    `${BASE}/act7_truck.png`,
    mapBg:          `${BASE}/act7_dispatch.jpeg`,  // window.A7_MAP_BG — USA map (fixed-size SVG image)
  },
  // Act 8 — the job (rain, breakdown, DOT inspector — window global A8_IMAGES)
  act8: {
    midnightRun:  `${BASE}/act8_midnight_run.jpeg`,
    stormyNight:  `${BASE}/act8_stormy_night.png`,
    dotInspector: `${BASE}/act8_dot_inspector.png`,
  },
  // Act 10 — the promise (X-ray box truck reveal)
  act10: {
    xrayTruck: `${BASE}/act10_xray_truck.png`,
  },
  // Act 11 — compliance cork board (window global)
  act11: {
    cork: `${BASE}/cork_optimized.jpg`,
  },
  // Act 12 — launch (window globals)
  act12: {
    handoff: `${BASE}/handoff_optimized.jpg`,
    hero:    `${BASE}/coastal_optimized.jpg`,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// ASSET PRELOAD — collect every image URL the cinematic uses, then preload
// and decode them all upfront. This eliminates mid-cinematic stutter when
// Acts 8.5 and 9 (or any other Act) load their first image — the browser
// already has the pixels decoded and ready to render.
// ────────────────────────────────────────────────────────────────────────────
const ALL_IMAGE_URLS = (() => {
  const urls = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(v)) urls.add(v);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(ASSETS);
  return Array.from(urls);
})();

/**
 * Preload + decode a single image. Decode() ensures pixels are in memory
 * (not just downloaded), eliminating render-time decode jank on mobile.
 * Falls back to onload event for browsers without HTMLImageElement.decode().
 */
function preloadAndDecodeImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    if (typeof img.decode === 'function') {
      img.decode().then(() => resolve(true)).catch(() => resolve(false));
    } else {
      img.onload  = () => resolve(true);
      img.onerror = () => resolve(false);
    }
  });
}

/**
 * Preload all images in parallel. Reports progress via onProgress callback.
 * Returns Promise that resolves when ALL images have either loaded or failed.
 */
function preloadAllImages(urls, onProgress) {
  let done = 0;
  return Promise.all(
    urls.map((url) =>
      preloadAndDecodeImage(url).then((ok) => {
        done += 1;
        if (onProgress) onProgress(done, urls.length);
        return ok;
      })
    )
  );
}

/**
 * Wait for all web fonts to load (Outfit, SF Pro Display etc.).
 * Fonts API is supported in all modern browsers; older ones get a 0ms resolve.
 */
function waitForFonts() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.ready) {
    return Promise.resolve();
  }
  return document.fonts.ready.then(() => true).catch(() => true);
}

const SCENES = [
  { actKey: '1',   Component: Act1_ColdOpen },
  { actKey: '2',   Component: Act2_TitleDrop },
  { actKey: '3',   Component: Act3_MissedCall },
  { actKey: '4',   Component: Act4_TheMentor },
  { actKey: '5',   Component: Act5_TheScore },
  { actKey: '6',   Component: Act6_GameplayMontage },
  { actKey: '7',   Component: Act7_Decisions },
  { actKey: '8',   Component: Act8_TheJob },
  { actKey: '8_5', Component: Act8_5_TheChoice },
  { actKey: '9',   Component: Act9_TheLongGame },
  { actKey: '10',  Component: Act10_ThePromise },
  { actKey: '11',  Component: Act11_TheCompliancePromise },
  { actKey: '12',  Component: Act12_Launch },
];

const MIN_ADVANCE_INTERVAL_MS = 250;

const WelcomeModal = React.memo(function WelcomeModal({
  playerName = 'kid',
  onComplete = () => {},
  onSkip     = () => {},
}) {
  // begun state removed — cinematic auto-starts on mount
  const [sceneIndex, setSceneIndex] = useState(0);

  const onCompleteRef    = useRef(onComplete);
  const onSkipRef        = useRef(onSkip);
  const lastAdvanceTime  = useRef(0);

  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => { onSkipRef.current     = onSkip;     });

  // ─── Fullscreen API ─────────────────────────────────────────────────────
  // Request fullscreen on mount, exit on unmount. Works in modern browsers
  // and Android WebView (Capacitor). Gracefully degrades if denied or
  // unsupported — the z-index above keeps the cinematic on top regardless.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen;
    if (req) {
      try { req.call(root); } catch (e) { /* silent fail — z-index covers us */ }
    }
    return () => {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)) {
        try { exit.call(document); } catch (e) { /* silent fail */ }
      }
    };
  }, []);

  // Set window globals for Acts 11 & 12 (they read photos this way).
  // Acts 1, 3, 4, 6, 7 receive photos via props (see actProps below).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ACT11_CORK     = ASSETS.act11.cork;
    window.__ACT12_HANDOFF  = ASSETS.act12.handoff;
    window.__ACT12_HERO     = ASSETS.act12.hero;
    // Act 6 dock-backing truck PNG (flipped top-down view, rendered on SVG layer)
    window.A6_TRUCK_TOP     = ASSETS.act6.truckTop;
    // Act 7 dispatch USA map (fixed 480x534 SVG, route lines calibrated to this image)
    window.A7_MAP_BG        = ASSETS.act7.mapBg;
    // Act 8 uses an object-keyed global (different convention from other acts)
    window.A8_IMAGES = {
      MIDNIGHT_RUN:  ASSETS.act8.midnightRun,
      STORMY_NIGHT:  ASSETS.act8.stormyNight,
      DOT_INSPECTOR: ASSETS.act8.dotInspector,
    };
  }, []);

  const handleSceneComplete = useCallback(() => {
    const now = performance.now();
    const sinceLast = now - lastAdvanceTime.current;
    if (lastAdvanceTime.current > 0 && sinceLast < MIN_ADVANCE_INTERVAL_MS) {
      console.log(`[WelcomeModal] Ignored rapid onComplete (only ${sinceLast.toFixed(0)}ms since last)`);
      return;
    }
    lastAdvanceTime.current = now;
    setSceneIndex((i) => i + 1);
  }, []);

  const handleSkip = useCallback(() => {
    console.log('[WelcomeModal] Skip pressed — closing entire cinematic');
    if (typeof onSkipRef.current === 'function') onSkipRef.current();
  }, []);

  useEffect(() => {
    if (sceneIndex >= SCENES.length) {
      console.log(`[WelcomeModal] Cinematic complete (all ${SCENES.length} acts played) — closing modal`);
      if (typeof onCompleteRef.current === 'function') {
        onCompleteRef.current();
      }
    } else if (sceneIndex > 0) {
      const prev = SCENES[sceneIndex - 1];
      const next = SCENES[sceneIndex];
      console.log(`[WelcomeModal] Act ${prev.actKey} complete → mounting Act ${next.actKey}`);
    }
  }, [sceneIndex]);

  if (sceneIndex >= SCENES.length) {
    return null;
  }
  const current      = SCENES[sceneIndex];
  const ActComponent = current.Component;

  // ─── Per-Act prop wiring ────────────────────────────────────────────────
  const actProps = {};
  switch (current.actKey) {
    case '1':
      actProps.imageUrl = ASSETS.act1.terminalYard;
      break;
    case '3':
      actProps.woodTextureUri = ASSETS.act3.woodTexture;
      break;
    case '4':
      actProps.imageUrls = ASSETS.act4;
      break;
    case '6':
      actProps.imageUrls = ASSETS.act6;
      break;
    case '7':
      actProps.imageUrls = ASSETS.act7;
      break;
    case '10':
      actProps.xrayImageUrl = ASSETS.act10.xrayTruck;
      break;
    default:
      // Other acts are self-contained — no extra props needed
      break;
  }

  return (
    <AudioMixerProvider>
      <div className="welcome-modal-root" style={WELCOME_MODAL_ROOT_STYLE}>
        {/* PORTRAIT FRAME — fixed 9:16 aspect, centered in viewport.
            All Acts render inside this frame at consistent dimensions
            regardless of device orientation. Landscape viewports get
            letterboxed (black bars on sides). */}
        <div className="welcome-modal-frame" style={WELCOME_MODAL_FRAME_STYLE}>
          <WelcomeModalStage
            ActComponent={ActComponent}
            actKey={current.actKey}
            playerName={playerName}
            handleSceneComplete={handleSceneComplete}
            handleSkip={handleSkip}
            actProps={actProps}
          />
          <MuteButton />
        </div>
      </div>
    </AudioMixerProvider>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// WelcomeModalStage — inside the AudioMixerProvider so it can read ctx.ready
// and gate Act mount on audio being preloaded. This prevents the "Act 1 has
// no music" problem: the music file hasn't finished loading when Act 1 mounts
// otherwise, so the music bed silently fails to start.
//
// While preload is in progress, shows a clean cinema-style loading state.
// As soon as audio is ready, fades into Act 1 with music ready to play.
// ────────────────────────────────────────────────────────────────────────────
function WelcomeModalStage({ ActComponent, actKey, playerName, handleSceneComplete, handleSkip, actProps }) {
  const ctx = React.useContext(AudioMixerContext);
  const audioReady = !!ctx?.ready;
  const [imagesLoaded, setImagesLoaded] = React.useState(0);
  const [imagesReady, setImagesReady]   = React.useState(false);
  const [fontsReady, setFontsReady]     = React.useState(false);
  const [hasStarted, setHasStarted]     = React.useState(false);

  // Preload + decode every image used by every Act on mount.
  React.useEffect(() => {
    let cancelled = false;
    preloadAllImages(ALL_IMAGE_URLS, (done) => {
      if (!cancelled) setImagesLoaded(done);
    }).then(() => {
      if (!cancelled) setImagesReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Wait for fonts to finish loading (so text doesn't pop in mid-cinematic).
  React.useEffect(() => {
    let cancelled = false;
    waitForFonts().then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Start the cinematic only when ALL assets are ready: audio + images + fonts.
  // hasStarted is one-way (false → true) so the cinematic never unmounts
  // unexpectedly mid-playback.
  const allReady = audioReady && imagesReady && fontsReady;
  React.useEffect(() => {
    if (allReady && !hasStarted) setHasStarted(true);
  }, [allReady, hasStarted]);

  // Safety net: even if some asset hangs forever (404, broken file, etc.),
  // start the cinematic after 20 seconds. Better to play with a glitch than
  // freeze on the loader.
  React.useEffect(() => {
    if (hasStarted) return;
    const timeoutId = setTimeout(() => setHasStarted(true), 20000);
    return () => clearTimeout(timeoutId);
  }, [hasStarted]);

  if (!hasStarted) {
    return (
      <PreparingLoader
        audioReady={audioReady}
        fontsReady={fontsReady}
        imagesLoaded={imagesLoaded}
        totalImages={ALL_IMAGE_URLS.length}
      />
    );
  }

  return (
    <ActComponent
      key={actKey}
      name={playerName}
      onComplete={handleSceneComplete}
      onSkip={handleSkip}
      {...actProps}
    />
  );
}

// Cinema-style loading state. Black background, subtle pulsing dot, and a
// thin progress bar that fills based on overall asset readiness. Typically
// visible for 1-3 seconds on cached loads, 3-8 seconds on first visit.
function PreparingLoader({ audioReady, fontsReady, imagesLoaded, totalImages }) {
  // Weight the progress so audio (~40%), images (~50%), fonts (~10%).
  const audioWeight  = audioReady ? 0.40 : 0;
  const imagesWeight = totalImages > 0 ? (imagesLoaded / totalImages) * 0.50 : 0.50;
  const fontsWeight  = fontsReady ? 0.10 : 0;
  const progress     = Math.min(1, audioWeight + imagesWeight + fontsWeight);

  return (
    <div style={PREPARING_STYLE}>
      <style>{PREPARING_STYLES_CSS}</style>
      <div className="wm-prep-pulse" />
      <div className="wm-prep-label">PREPARING</div>
      <div className="wm-prep-bar">
        <div className="wm-prep-bar-fill" style={{ width: `${(progress * 100).toFixed(0)}%` }} />
      </div>
    </div>
  );
}

const PREPARING_STYLE = {
  position: 'absolute',
  inset: 0,
  background: '#000',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '20px',
};

const PREPARING_STYLES_CSS = `
.wm-prep-pulse {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(253, 246, 227, 0.85);
  box-shadow: 0 0 16px rgba(255, 180, 90, 0.35);
  animation: wm-prep-pulse 1.6s ease-in-out infinite;
}
.wm-prep-label {
  font-family: 'Outfit', 'SF Pro Display', -apple-system, sans-serif;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.32em;
  color: rgba(253, 246, 227, 0.55);
  animation: wm-prep-label-fade 1.6s ease-in-out infinite;
}
@keyframes wm-prep-pulse {
  0%, 100% { transform: scale(1);    opacity: 0.7; }
  50%      { transform: scale(1.25); opacity: 1; }
}
@keyframes wm-prep-label-fade {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.7; }
}
.wm-prep-bar {
  width: 180px;
  height: 2px;
  background: rgba(253, 246, 227, 0.08);
  border-radius: 1px;
  overflow: hidden;
  margin-top: 6px;
}
.wm-prep-bar-fill {
  height: 100%;
  background: linear-gradient(90deg,
    rgba(253, 246, 227, 0.4) 0%,
    rgba(255, 180, 90, 0.6) 100%);
  border-radius: 1px;
  transition: width 220ms ease-out;
  box-shadow: 0 0 8px rgba(255, 180, 90, 0.25);
}
`;

// Outer container — covers entire viewport in black, centers the frame.
const WELCOME_MODAL_ROOT_STYLE = {
  position: 'fixed',
  inset: 0,
  // z-index 1,000,000 ensures the cinematic renders above ALL in-game UI.
  // The game's .v2-top-bar is at 100,005 and various overlays go up to
  // 200,000 — this number is high enough to beat any reasonable layer.
  zIndex: 1000000,
  background: '#000',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Outfit', 'SF Pro Display', -apple-system, sans-serif",
};

// Inner frame — locked to 9:16 portrait aspect.
// • In portrait viewports (mobile): fills viewport, no letterboxing
// • In landscape viewports (desktop): scales to viewport height, letterboxed
// • Max dimensions cap on big screens so the cinematic doesn't render huge
//
// CSS math: width  = min(100vw, 100vh * 9/16) — limited by whichever is smaller
//           height = min(100vh, 100vw * 16/9) — same calc on the other axis
//
// 9/16 = 0.5625 (standard mobile portrait aspect)
const WELCOME_MODAL_FRAME_STYLE = {
  position: 'relative',
  width: 'min(100vw, calc(100vh * 9 / 16))',
  height: 'min(100vh, calc(100vw * 16 / 9))',
  maxWidth: '480px',
  maxHeight: '853px',
  background: '#000',
  overflow: 'hidden',
};

export default WelcomeModal;
