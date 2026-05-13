/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * audioMixer.js — central audio engine
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Implements the architecture described in AUDIO_MIXER_DESIGN.md v2:
 *
 *   • File-based playback (HTMLAudioElement) for Marcus VO, music beds,
 *     and most SFX
 *   • Procedural synthesis (Web Audio API) for the 6 missing SFX cues
 *   • Modal-level music timeline with bed transitions and per-act volume
 *     modulation (Bed E: Acts 8 → 8.5 → 9 → 10 with 5% → 25% → 60% → 60%)
 *   • Cross-fades at bed boundaries
 *   • Global mute (toggle-able mid-playback)
 *   • Preload manifest with timeout-based degradation
 *   • Graceful fallback when files are missing or autoplay rejected
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Usage:
 *
 *   const mixer = new AudioMixer({ basePaths, muted: false });
 *   await mixer.preload(MANIFEST);
 *   mixer.setMusicTimeline(WELCOME_MODAL_MUSIC_TIMELINE);
 *
 *   // On user tap that begins the cinematic:
 *   mixer.unlockAudio();
 *
 *   // When each Act begins:
 *   mixer.enterAct('act4', ACT4_AUDIO_CUES);
 *
 *   // Every elapsedMs tick within the Act:
 *   mixer.update(elapsedMs);
 *
 *   // When the Act unmounts:
 *   mixer.exitAct();
 *
 *   // When the modal is dismissed:
 *   mixer.shutdown();
 * ════════════════════════════════════════════════════════════════════════════
 */

import { invokeSynthRoutine } from './synthRoutines.js';

const DEFAULT_BASE_PATHS = {
  marcus: 'audio/marcus/welcome/',
  music:  'audio/music/welcome/',
  sfx:    'audio/sfx/welcome/',
};

const PRELOAD_TIMEOUT_MS = 5000;

// ─────────────────────────────────────────────────────────────────────────────
// AudioMixer
// ─────────────────────────────────────────────────────────────────────────────

export class AudioMixer {
  constructor({
    basePaths = DEFAULT_BASE_PATHS,
    muted = false,
    onWarn = (msg) => console.warn(`[AudioMixer] ${msg}`),
  } = {}) {
    this.basePaths = basePaths;
    this.muted = muted;
    this.onWarn = onWarn;

    // File-playback state
    this._audioElements = new Map();   // file string → HTMLAudioElement
    this._failedFiles = new Set();      // files that 404'd or couldn't decode

    // Cue tracking
    this._firedCueKeys = new Set();    // act-scoped: cue-key strings that have fired
    this._currentActKey = null;
    this._currentActCues = null;
    this._currentActStartedAt = 0;     // performance.now() when act began (for synth scheduling)

    // Music timeline state
    this._musicTimeline = [];
    this._activeBed = null;             // current bed config
    this._activeBedElement = null;      // HTMLAudioElement playing the bed

    // Web Audio context (for synthesis only — files use native HTMLAudioElement)
    this._audioContext = null;
    this._synthDestination = null;      // master gain for synthesized SFX

    // Whether the audio is "unlocked" by user gesture (autoplay policy)
    this._unlocked = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Preload audio files from the manifest. Each item: { category, file }.
   * Returns Promise<{ loaded, failed }>.
   *
   * Files that fail to load within PRELOAD_TIMEOUT_MS are flagged but
   * don't block the others. The mixer skips failed cues silently at
   * playback time.
   */
  async preload(manifest) {
    const results = await Promise.all(
      manifest.map((item) => this._preloadOne(item))
    );
    const loaded = results.filter(Boolean).length;
    const failed = manifest
      .filter((_, i) => !results[i])
      .map((it) => it.file);
    return { loaded, failed };
  }

  /**
   * Set the modal-level music timeline. Called once at modal init.
   */
  setMusicTimeline(timeline) {
    this._musicTimeline = timeline || [];
  }

  /**
   * Mark that the user has tapped — audio can play. Creates the AudioContext
   * (must be done after user gesture per browser autoplay policy) and primes
   * audio elements with a silent play+pause to satisfy stricter WebViews.
   */
  unlockAudio() {
    if (this._unlocked) return;
    this._unlocked = true;

    // Create AudioContext (for synth)
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        this._audioContext = new Ctx();
        // Master gain node for synthesized SFX
        this._synthDestination = this._audioContext.createGain();
        this._synthDestination.gain.value = this.muted ? 0 : 1;
        this._synthDestination.connect(this._audioContext.destination);
        // Resume context (some browsers create it suspended)
        if (this._audioContext.state === 'suspended') {
          this._audioContext.resume();
        }
      }
    } catch (err) {
      this.onWarn(`AudioContext creation failed: ${err.message}`);
    }

    // Prime HTMLAudioElements (silent play+pause unlocks them in stricter WebViews)
    this._audioElements.forEach((el) => {
      const prevMuted = el.muted;
      el.muted = true;
      const playPromise = el.play();
      if (playPromise && playPromise.then) {
        playPromise.then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = prevMuted;
        }).catch(() => {
          // Priming failed — element may still work when actually played later
          el.muted = prevMuted;
        });
      }
    });
  }

  /**
   * Called when an Act begins. Handles music bed transition + sets up the
   * cue scheduler for the new act.
   *
   * actKey is the string used in the music timeline's spansActs: e.g., '1',
   * '2', '8_5', '12'.
   */
  enterAct(actKey, actCues) {
    this._currentActKey = actKey;
    this._currentActCues = actCues || { vo: [], sfx: [] };
    this._currentActStartedAt = performance.now();
    this._firedCueKeys = new Set();

    // Determine which music bed (if any) covers this act
    const newBed = this._findBedForAct(actKey);
    this._handleBedTransition(newBed, actKey);
  }

  /**
   * Called by the host Act on every elapsedMs tick (typically RAF-driven).
   * Fires VO + SFX cues whose windows have opened.
   */
  update(elapsedMs) {
    if (!this._currentActCues) return;
    if (!this._unlocked) return;  // no audio until user gesture

    const cues = [
      ...(this._currentActCues.vo  || []),
      ...(this._currentActCues.sfx || []),
    ];

    for (const cue of cues) {
      const cueKey = this._keyFor(cue);
      // Cue start
      if (
        elapsedMs >= cue.startMs
        && (cue.endMs === undefined || elapsedMs < cue.endMs)
        && !this._firedCueKeys.has(cueKey)
      ) {
        this._firedCueKeys.add(cueKey);
        this._playCue(cue);
      }
      // Cue stop (file cues only — synth cues finish on their own)
      if (cue.file && cue.endMs !== undefined && elapsedMs >= cue.endMs) {
        this._stopFileCue(cue);
      }
    }
  }

  /**
   * Called when the Act unmounts. Stops any in-flight VO/SFX from this Act.
   * The music decision is deferred to the next enterAct() — music keeps
   * playing if the next bed includes this file.
   */
  exitAct() {
    // Stop currently-playing VO and SFX (anything except music)
    if (this._currentActCues) {
      for (const cue of [
        ...(this._currentActCues.vo  || []),
        ...(this._currentActCues.sfx || []),
      ]) {
        if (cue.file) this._stopFileCue(cue);
      }
    }
    this._currentActCues = null;
    this._firedCueKeys = new Set();
  }

  /**
   * Toggle global mute. Applies immediately to currently-playing audio.
   */
  setMuted(muted) {
    this.muted = !!muted;
    this._audioElements.forEach((el) => {
      el.muted = this.muted;
    });
    if (this._synthDestination) {
      // Ramp instead of jump to avoid clicks
      const target = this.muted ? 0 : 1;
      try {
        this._synthDestination.gain.cancelScheduledValues(this._audioContext.currentTime);
        this._synthDestination.gain.linearRampToValueAtTime(
          target,
          this._audioContext.currentTime + 0.05
        );
      } catch (err) { /* swallow */ }
    }
  }

  /**
   * Full cleanup when the modal closes. Stops everything, releases resources.
   */
  shutdown() {
    // Stop and release all audio elements
    this._audioElements.forEach((el) => {
      try {
        el.pause();
        el.src = '';
        el.load();  // hint browser to release resources
      } catch (err) { /* swallow */ }
    });
    this._audioElements.clear();
    this._activeBedElement = null;
    this._activeBed = null;

    // Close AudioContext (releases hardware)
    if (this._audioContext) {
      try { this._audioContext.close(); } catch (err) { /* swallow */ }
      this._audioContext = null;
      this._synthDestination = null;
    }

    this._currentActCues = null;
    this._firedCueKeys = new Set();
    this._unlocked = false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS — file preload
  // ═══════════════════════════════════════════════════════════════════════

  async _preloadOne({ category, file }) {
    if (!file || !category) return false;
    const url = `${this.basePaths[category] || ''}${file}`;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.muted = this.muted;

    return new Promise((resolve) => {
      let resolved = false;
      const done = (success) => {
        if (resolved) return;
        resolved = true;
        if (success) {
          this._audioElements.set(file, audio);
        } else {
          this._failedFiles.add(file);
          this.onWarn(`Failed to load: ${url}`);
        }
        resolve(success);
      };

      audio.addEventListener('canplaythrough', () => done(true), { once: true });
      audio.addEventListener('error', () => done(false), { once: true });
      setTimeout(() => done(false), PRELOAD_TIMEOUT_MS);

      // Some browsers don't fire canplaythrough without an explicit load() call
      try { audio.load(); } catch (err) { /* swallow */ }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS — cue playback
  // ═══════════════════════════════════════════════════════════════════════

  _keyFor(cue) {
    // Stable key for tracking which cues have fired
    return cue.file
      ? `file:${cue.file}@${cue.startMs}`
      : `synth:${cue.synth}@${cue.startMs}`;
  }

  _playCue(cue) {
    if (this.muted) {
      // We still mark as "fired" so we don't replay if user unmutes mid-cue
      return;
    }
    if (cue.file) {
      this._playFileCue(cue);
    } else if (cue.synth) {
      this._playSynthCue(cue);
    }
  }

  _playFileCue(cue) {
    const el = this._audioElements.get(cue.file);
    if (!el) {
      // File didn't load — silent skip per design
      return;
    }
    el.volume = Math.min(1, Math.max(0, cue.volume ?? 1));
    el.currentTime = 0;
    const p = el.play();
    if (p && p.then) {
      p.catch((err) => {
        this.onWarn(`Playback rejected for ${cue.file}: ${err.message}`);
      });
    }
  }

  _stopFileCue(cue) {
    const el = this._audioElements.get(cue.file);
    if (!el || el.paused) return;
    el.pause();
    el.currentTime = 0;
  }

  _playSynthCue(cue) {
    if (!this._audioContext || !this._synthDestination) {
      this.onWarn(`Synth cue '${cue.synth}' fired but AudioContext not ready`);
      return;
    }
    invokeSynthRoutine(
      cue.synth,
      this._audioContext,
      this._synthDestination,
      { ...cue.params, volume: cue.volume ?? 1 }
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNALS — music timeline
  // ═══════════════════════════════════════════════════════════════════════

  _findBedForAct(actKey) {
    return this._musicTimeline.find((bed) =>
      (bed.spansActs || []).some((a) => String(a) === String(actKey))
    ) || null;
  }

  _handleBedTransition(newBed, actKey) {
    // No music in either act → nothing to do
    if (!this._activeBed && !newBed) return;

    // Same bed continues — just ramp volume to this act's target
    if (this._activeBed && newBed && this._activeBed === newBed) {
      const target = (newBed.actVolumes || {})[actKey] ?? 0.4;
      this._rampBedVolume(target, 300);
      return;
    }

    // Bed change (or end). Fade out current bed.
    if (this._activeBed && this._activeBedElement) {
      this._fadeOutBed(this._activeBedElement, this._activeBed.fadeOutMs || 600);
    }

    // Start new bed if any
    if (newBed) {
      this._startBed(newBed, actKey);
    } else {
      this._activeBed = null;
      this._activeBedElement = null;
    }
  }

  _startBed(bed, actKey) {
    const el = this._audioElements.get(bed.file);
    if (!el) {
      // Music file not loaded — silent fallback, cinematic visuals continue
      this.onWarn(`Bed file not available: ${bed.file}`);
      this._activeBed = null;
      this._activeBedElement = null;
      return;
    }
    const targetVolume = (bed.actVolumes || {})[actKey] ?? 0.4;
    el.loop = !!bed.loop;
    el.currentTime = 0;
    el.volume = this.muted ? 0 : 0;  // start at 0, fade in
    const p = el.play();
    if (p && p.then) {
      p.catch((err) => {
        this.onWarn(`Bed playback rejected (${bed.file}): ${err.message}`);
      });
    }
    this._activeBed = bed;
    this._activeBedElement = el;

    // Fade in to target volume
    this._rampElementVolume(el, targetVolume, bed.fadeInMs || 600);
  }

  _fadeOutBed(el, fadeOutMs) {
    if (!el) return;
    this._rampElementVolume(el, 0, fadeOutMs, () => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch (err) { /* swallow */ }
    });
  }

  _rampBedVolume(targetVolume, durationMs) {
    if (!this._activeBedElement) return;
    this._rampElementVolume(this._activeBedElement, targetVolume, durationMs);
  }

  _rampElementVolume(el, target, durationMs, onComplete) {
    if (!el) return;
    const start = el.volume;
    const startTime = performance.now();
    const finalTarget = this.muted ? 0 : Math.min(1, Math.max(0, target));
    const tick = () => {
      const t = (performance.now() - startTime) / durationMs;
      if (t >= 1) {
        el.volume = finalTarget;
        if (onComplete) onComplete();
        return;
      }
      el.volume = start + (finalTarget - start) * t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
