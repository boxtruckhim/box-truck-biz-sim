/**
 * ════════════════════════════════════════════════════════════════════════════
 * Box Truck Boss · Welcome Modal · Phase 4.6
 * synthRoutines.js — Web Audio API procedural SFX synthesis
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Generates the 6 SFX cues that aren't sourced as audio files:
 *   • decision_strike (4 variants — Act 7 NEGOTIATE/HIRE/BUY/RUN)
 *   • xray_pulse                  (Act 10 truck silhouette reveal)
 *   • paper_rustle                (Act 11 cork-board paper)
 *
 * Each routine is parameterized and self-contained. Called by audioMixer
 * when a cue's `synth` field is set (instead of `file`). The destination
 * node is provided by the mixer so master mute/volume routing works.
 *
 * All synthesis uses only standard Web Audio API primitives: OscillatorNode,
 * BufferSource (for noise), BiquadFilter, GainNode. No external libraries.
 *
 * Each routine returns { duration: seconds } so the mixer knows when the
 * sound is finished and can clean up.
 * ════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a buffer of white noise of the given duration.
 * Returns an AudioBuffer ready to feed into a BufferSource.
 */
function createWhiteNoiseBuffer(ctx, durationSec) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Create a buffer of pink noise (1/f spectrum) of the given duration.
 * Pink noise sounds more natural for "paper" or "fabric" textures than
 * white noise (which sounds hissy).
 *
 * Uses Paul Kellet's economy method — fast, sounds great.
 */
function createPinkNoiseBuffer(ctx, durationSec) {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

// ─────────────────────────────────────────────────────────────────────────────
// DECISION STRIKE — Act 7 (NEGOTIATE / HIRE / BUY / RUN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sharp percussive cue: a click (high-frequency noise burst) followed by
 * a low thump (sine pulse with pitch envelope). Marcus's "decision locked
 * in" punctuation.
 *
 * Variants 1-4 progressively heavier — V1 light decision, V4 most decisive.
 *
 * @param {AudioContext} ctx
 * @param {AudioNode} destination - where to route the output (usually master gain)
 * @param {object} params
 * @param {number} params.variant - 1 to 4
 * @param {number} params.volume  - 0 to 1
 * @returns {{ duration: number }}
 */
export function synthDecisionStrike(ctx, destination, params = {}) {
  const { variant = 1, volume = 1 } = params;
  const now = ctx.currentTime;

  // Intensity ramps with variant: 0.6 → 0.8 → 1.0 → 1.2
  const intensity = 0.4 + variant * 0.2;

  // ═══ CLICK (sharp transient) ═══════════════════════════════════════════
  const clickBuf = createWhiteNoiseBuffer(ctx, 0.015);
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuf;

  const clickHP = ctx.createBiquadFilter();
  clickHP.type = 'highpass';
  clickHP.frequency.value = 2000;
  clickHP.Q.value = 0.7;

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.45 * intensity * volume, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

  clickSrc.connect(clickHP).connect(clickGain).connect(destination);
  clickSrc.start(now);
  clickSrc.stop(now + 0.020);

  // ═══ THUMP (low body) ══════════════════════════════════════════════════
  const thumpOsc = ctx.createOscillator();
  thumpOsc.type = 'sine';
  // Lower base frequency for heavier variants
  const baseFreq = 240 - (variant - 1) * 15;  // 240, 225, 210, 195
  thumpOsc.frequency.setValueAtTime(baseFreq * 1.5, now);
  thumpOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.05);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0, now);
  thumpGain.gain.linearRampToValueAtTime(0.7 * intensity * volume, now + 0.005);
  const thumpDecay = 0.07 + (variant - 1) * 0.015;  // longer for heavier
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + thumpDecay);

  thumpOsc.connect(thumpGain).connect(destination);
  thumpOsc.start(now);
  thumpOsc.stop(now + thumpDecay + 0.05);

  return { duration: thumpDecay + 0.05 };
}

// ─────────────────────────────────────────────────────────────────────────────
// XRAY PULSE — Act 10 (truck silhouette reveal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Long-decay bell-like chime. FM synthesis (carrier modulated by another
 * sine) gives the rich harmonic content of a bell. Lowpass filter sweep
 * makes it "dissolve into the music pad" rather than ring out sharply.
 *
 * Sci-fi-adjacent but tasteful — emerges, blooms, dissolves.
 *
 * @returns {{ duration: number }}
 */
export function synthXrayPulse(ctx, destination, params = {}) {
  const { volume = 1 } = params;
  const now = ctx.currentTime;
  const duration = 2.5;

  // ═══ FM MODULATOR ═══════════════════════════════════════════════════════
  const modOsc = ctx.createOscillator();
  modOsc.type = 'sine';
  modOsc.frequency.value = 660;  // modulator pitch

  const modDepth = ctx.createGain();
  modDepth.gain.setValueAtTime(200, now);
  // Modulation depth decays — bell brightness fades faster than amplitude
  modDepth.gain.exponentialRampToValueAtTime(8, now + duration * 0.8);

  modOsc.connect(modDepth);

  // ═══ FM CARRIER ═════════════════════════════════════════════════════════
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = 440;  // bell fundamental
  modDepth.connect(carrier.frequency);  // FM: modulator → carrier frequency

  // ═══ LOWPASS FILTER SWEEP ══════════════════════════════════════════════
  // Starts bright, fades into mids — feels like the chime resolves into
  // the warm pad music underneath.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1;
  filter.frequency.setValueAtTime(8000, now);
  filter.frequency.exponentialRampToValueAtTime(1000, now + 2);

  // ═══ AMPLITUDE ENVELOPE ════════════════════════════════════════════════
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.55 * volume, now + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Connect the chain
  carrier.connect(filter).connect(env).connect(destination);

  // Start sources
  modOsc.start(now);
  carrier.start(now);
  modOsc.stop(now + duration);
  carrier.stop(now + duration);

  return { duration };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAPER RUSTLE — Act 11 (cork-board paper before each stamp)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtered pink-noise burst with multiple amplitude peaks — the "crinkle"
 * texture of paper being placed or shifted. Brief (~400ms), highpass-
 * filtered for the characteristic crispness.
 *
 * @returns {{ duration: number }}
 */
export function synthPaperRustle(ctx, destination, params = {}) {
  const { volume = 1 } = params;
  const now = ctx.currentTime;
  const duration = 0.4;

  // ═══ PINK NOISE SOURCE ══════════════════════════════════════════════════
  const noiseBuf = createPinkNoiseBuffer(ctx, duration);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;

  // ═══ FILTER CHAIN ═══════════════════════════════════════════════════════
  // Highpass removes low-frequency noise (which would sound like wind)
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 2000;
  highpass.Q.value = 0.7;

  // Bandpass adds the resonant peak that gives paper its character
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3500;
  bandpass.Q.value = 0.9;

  // ═══ MULTI-PEAK ENVELOPE ═══════════════════════════════════════════════
  // Paper rustling has irregular amplitude — multiple "crinkle" peaks.
  // 5 peaks over 400ms simulates the natural shuffling sound.
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.50 * volume, now + 0.020);
  env.gain.linearRampToValueAtTime(0.22 * volume, now + 0.085);
  env.gain.linearRampToValueAtTime(0.42 * volume, now + 0.145);
  env.gain.linearRampToValueAtTime(0.18 * volume, now + 0.225);
  env.gain.linearRampToValueAtTime(0.32 * volume, now + 0.285);
  env.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noiseSrc.connect(highpass).connect(bandpass).connect(env).connect(destination);
  noiseSrc.start(now);

  return { duration };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map of synth routine name → function. The audioMixer looks up by
 * cue.synth string and invokes the routine with (ctx, destination, params).
 */
export const SYNTH_ROUTINES = {
  decision_strike: synthDecisionStrike,
  xray_pulse:      synthXrayPulse,
  paper_rustle:    synthPaperRustle,
};

/**
 * Invoke a synth routine by name. Returns { duration } or null if the
 * name doesn't match a known routine.
 */
export function invokeSynthRoutine(name, ctx, destination, params) {
  const routine = SYNTH_ROUTINES[name];
  if (!routine) {
    console.warn(`[synthRoutines] Unknown synth routine: ${name}`);
    return null;
  }
  return routine(ctx, destination, params);
}
