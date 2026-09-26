/**
 * A generative film score for the story, synthesised live with the Web Audio API (no audio files, nothing to license).
 *
 * The story tells the score which section it is in; a small look-ahead sequencer then plays that section's
 * chord progression, arpeggios, melody, bass and drums on a 16th-note grid, through a generated reverb.
 * Instruments: detuned-saw string pad, plucked piano, Himalayan singing bowl, taiko, hi-hat, sub bass,
 * plus mountain wind, a flood rumble, risers and emergency-alert tones.
 */

type Section = "open" | "thame" | "title" | "threat" | "rolpa" | "whatif" | "flood" | "aftermath" | "people" | "montage" | "end";

type Spec = {
  bpm: number;
  prog: string[];
  barsPerChord: number;
  pad: number; // pad level 0..1
  cutoff: number; // pad brightness (Hz)
  arp?: "8th" | "16th";
  arpLevel?: number;
  melody?: number; // chance of a melody note on each half bar
  drums?: "pulse" | "taiko";
  bass?: "beat" | "8th";
  hats?: boolean;
  bowlEvery?: number; // bars
};

const CHORDS: Record<string, number[]> = {
  Am: [45, 57, 60, 64],
  F: [41, 57, 60, 65],
  Fmaj7: [41, 57, 60, 64],
  C: [48, 55, 60, 64],
  G: [43, 55, 59, 62],
  Em: [40, 55, 59, 64],
  Dm: [38, 57, 62, 65],
  E: [40, 56, 59, 64],
  Esus: [40, 57, 59, 64],
};

const SPECS: Record<Section, Spec> = {
  open: { bpm: 60, prog: ["Am"], barsPerChord: 8, pad: 0.35, cutoff: 480, bowlEvery: 8 },
  thame: { bpm: 70, prog: ["Am", "F", "C", "Em"], barsPerChord: 2, pad: 0.6, cutoff: 950, melody: 0.55, bowlEvery: 8 },
  title: { bpm: 70, prog: ["F", "C"], barsPerChord: 2, pad: 1, cutoff: 2600, melody: 0.25 },
  threat: { bpm: 72, prog: ["Am", "F", "C", "E"], barsPerChord: 2, pad: 0.55, cutoff: 1100, arp: "8th", arpLevel: 0.55, drums: "pulse" },
  rolpa: { bpm: 72, prog: ["Am", "F", "Dm", "E"], barsPerChord: 2, pad: 0.65, cutoff: 1500, arp: "8th", arpLevel: 0.75, bass: "beat", drums: "pulse" },
  whatif: { bpm: 72, prog: ["Esus"], barsPerChord: 4, pad: 0.35, cutoff: 600 },
  flood: { bpm: 100, prog: ["Am", "F", "G", "Em"], barsPerChord: 1, pad: 0.7, cutoff: 1900, arp: "16th", arpLevel: 0.6, bass: "8th", drums: "taiko", hats: true },
  aftermath: { bpm: 66, prog: ["Am", "F"], barsPerChord: 2, pad: 0.55, cutoff: 900, melody: 0.35 },
  people: { bpm: 66, prog: ["F", "C", "G", "Am"], barsPerChord: 2, pad: 0.6, cutoff: 1300, melody: 0.7, bowlEvery: 8 },
  montage: { bpm: 84, prog: ["F", "G", "Am", "C"], barsPerChord: 1, pad: 0.7, cutoff: 2200, arp: "8th", arpLevel: 0.6, drums: "pulse", bass: "beat" },
  end: { bpm: 66, prog: ["Fmaj7", "C"], barsPerChord: 2, pad: 0.9, cutoff: 2400, melody: 0.45 },
};

const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79]; // A minor / C major pentatonic
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class StoryAudio {
  private ctx: AudioContext;
  private master: GainNode;
  /** final output (after the compressor), handy for metering */
  readonly out: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private padBus: GainNode;
  private padFilter: BiquadFilterNode;
  private rumble: GainNode;
  private wind: GainNode;
  private noise: AudioBuffer;
  private muted = false;
  private level = 1;

  private section: Section | null = null;
  private spec: Spec = SPECS.open;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval>;
  private padVoices: { stop: (t: number) => void }[] = [];
  private melodyNote = 64;
  private arpIdx = 0;

  constructor() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.noise = this.noiseBuffer(4);

    this.master = c.createGain();
    this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    const makeup = c.createGain();
    makeup.gain.value = 1.3;
    // brick-wall limiter so the flood's drums never clip
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.out = c.createGain();
    this.out.gain.value = 0.9;
    this.master.connect(comp).connect(makeup).connect(limiter).connect(this.out).connect(c.destination);

    // one shared hall: every instrument sends to it
    const verb = c.createConvolver();
    verb.buffer = this.impulse(3.6);
    this.wet = c.createGain();
    this.wet.gain.value = 0.5;
    this.wet.connect(verb).connect(this.master);
    this.dry = c.createGain();
    this.dry.connect(this.master);

    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 600;
    this.padFilter.Q.value = 0.6;
    this.padBus = c.createGain();
    this.padBus.gain.value = 0;
    this.padFilter.connect(this.padBus);
    this.padBus.connect(this.dry);
    this.padBus.connect(this.wet);

    // wind: brown noise through a wandering band-pass
    const w = c.createBufferSource();
    w.buffer = this.noise;
    w.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.8;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = c.createGain();
    lg.gain.value = 240;
    lfo.connect(lg).connect(bp.frequency);
    this.wind = c.createGain();
    this.wind.gain.value = 0.07;
    w.connect(bp).connect(this.wind).connect(this.dry);
    w.start();
    lfo.start();

    // flood rumble
    const rs = c.createBufferSource();
    rs.buffer = this.noise;
    rs.loop = true;
    const rlp = c.createBiquadFilter();
    rlp.type = "lowpass";
    rlp.frequency.value = 130;
    this.rumble = c.createGain();
    this.rumble.gain.value = 0;
    rs.connect(rlp).connect(this.rumble).connect(this.dry);
    rs.start();

    this.timer = setInterval(() => this.schedule(), 40);
  }

  /* ---------- buffers ---------- */

  private noiseBuffer(seconds: number) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return b;
  }

  private impulse(seconds: number) {
    const c = this.ctx;
    const len = c.sampleRate * seconds;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  private ramp(p: AudioParam, v: number, s: number, at = this.ctx.currentTime) {
    p.cancelScheduledValues(at);
    p.setValueAtTime(p.value, at);
    p.linearRampToValueAtTime(v, at + s);
  }

  /* ---------- instruments ---------- */

  private padChord(notes: number[], t: number, dur: number) {
    const c = this.ctx;
    for (const v of this.padVoices) v.stop(t);
    this.padVoices = notes.map((m, i) => {
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.16 : 0.1, t + 1.4);
      g.connect(this.padFilter);
      const oscs = [-7, 7].map((det) => {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(m);
        o.detune.value = det;
        o.connect(g);
        o.start(t);
        return o;
      });
      const end = t + dur + 2.5;
      oscs.forEach((o) => o.stop(end + 3));
      g.gain.setValueAtTime(i === 0 ? 0.16 : 0.1, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, end);
      return {
        stop: (at: number) => {
          g.gain.cancelScheduledValues(at);
          g.gain.setValueAtTime(g.gain.value || 0.1, at);
          g.gain.linearRampToValueAtTime(0.0001, at + 1.8);
          oscs.forEach((o) => {
            try {
              o.stop(at + 2);
            } catch {
              /* already scheduled */
            }
          });
        },
      };
    });
  }

  /** plucked piano-ish note */
  private pluck(m: number, t: number, level: number, decay = 1.6, wet = 0.6) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(9000, hz(m) * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, hz(m) * 1.5), t + decay);
    for (const [mult, type, lv] of [
      [1, "triangle", 1],
      [2, "sine", 0.35],
      [3, "sine", 0.12],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz(m) * mult;
      const og = c.createGain();
      og.gain.value = lv;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
    lp.connect(g);
    g.connect(this.dry);
    const s = c.createGain();
    s.gain.value = wet;
    g.connect(s).connect(this.wet);
  }

  /** Tibetan singing bowl: inharmonic partials with slow beating */
  bowl(t = this.ctx.currentTime, f = 220, level = 0.09) {
    const c = this.ctx;
    for (const [ratio, amp, dec] of [
      [1, 1, 7],
      [2.71, 0.55, 5],
      [5.2, 0.28, 3.5],
      [8.4, 0.12, 2.2],
    ]) {
      for (const det of [-1.2, 1.2]) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f * ratio + det;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(level * amp * 0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g);
        g.connect(this.dry);
        g.connect(this.wet);
        o.start(t);
        o.stop(t + dec + 0.1);
      }
    }
  }

  private taiko(t: number, level = 0.55) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g);
    g.connect(this.dry);
    const s = c.createGain();
    s.gain.value = 0.35;
    g.connect(s).connect(this.wet);
    o.start(t);
    o.stop(t + 0.8);
    // skin slap
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const ng = c.createGain();
    ng.gain.setValueAtTime(level * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(lp).connect(ng).connect(this.dry);
    n.start(t, Math.random() * 2);
    n.stop(t + 0.15);
  }

  private hat(t: number, level = 0.035) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    // brown noise is dark; boost it hard so the high-pass has something to keep
    const boost = c.createGain();
    boost.gain.value = 6;
    n.connect(boost).connect(hp).connect(g).connect(this.dry);
    n.start(t, Math.random() * 3);
    n.stop(t + 0.06);
  }

  private bassNote(m: number, t: number, len: number, level = 0.16) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz(m);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.value = hz(m);
    o.connect(lp).connect(g);
    sub.connect(g);
    g.connect(this.dry);
    o.start(t);
    sub.start(t);
    o.stop(t + len + 0.05);
    sub.stop(t + len + 0.05);
  }

  private riser(t: number, dur = 6.5) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(5000, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    const boost = c.createGain();
    boost.gain.value = 3;
    n.connect(boost).connect(bp).connect(g);
    g.connect(this.dry);
    g.connect(this.wet);
    n.start(t);
    n.stop(t + dur + 0.2);
    // rising tone underneath
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(hz(40), t);
    o.frequency.exponentialRampToValueAtTime(hz(64), t + dur);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.05, t + dur);
    og.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    o.connect(lp).connect(og);
    og.connect(this.wet);
    og.connect(this.dry);
    o.start(t);
    o.stop(t + dur + 0.2);
  }

  /** deep cinematic hit */
  boom(t = this.ctx.currentTime) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 2.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g);
    g.connect(this.dry);
    g.connect(this.wet);
    o.start(t);
    o.stop(t + 3.5);
    this.taiko(t, 0.5);
  }

  /** emergency-alert two-tone, repeated */
  alert(times = 3) {
    const c = this.ctx;
    for (let i = 0; i < times; i++) {
      for (const [k, f] of [
        [0, 853],
        [1, 960],
      ]) {
        const t = c.currentTime + i * 0.9 + k * 0.22;
        const o = c.createOscillator();
        o.type = "square";
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2400;
        o.connect(lp).connect(g).connect(this.dry);
        o.start(t);
        o.stop(t + 0.22);
      }
    }
  }

  /* ---------- sequencer ---------- */

  setSection(s: Section) {
    if (s === this.section) return;
    const prev = this.section;
    this.section = s;
    this.spec = SPECS[s];
    const c = this.ctx;
    const t = c.currentTime + 0.05;
    this.step = 0;
    this.nextTime = t;
    this.ramp(this.padBus.gain, this.spec.pad * 1.1, s === "whatif" ? 1 : 2.2);
    this.padFilter.frequency.cancelScheduledValues(t);
    this.padFilter.frequency.setValueAtTime(this.padFilter.frequency.value, t);
    this.padFilter.frequency.exponentialRampToValueAtTime(this.spec.cutoff, t + 2.5);
    this.ramp(this.wind.gain, s === "open" || s === "thame" || s === "whatif" ? 0.09 : s === "flood" ? 0.02 : 0.045, 2);
    // restore the master if a previous ending faded it out (e.g. "watch again")
    if (!this.muted) this.ramp(this.master.gain, this.level, prev === "end" ? 1.5 : 0.3);

    // entry cues
    if (s === "open") this.bowl(t + 0.4, 196, 0.11);
    if (s === "title") {
      this.boom(t);
      this.bowl(t + 0.1, 220, 0.1);
    }
    if (s === "whatif") this.riser(t, 6.6);
    if (s === "flood") {
      this.boom(t);
      this.taiko(t + 0.12, 0.45);
    }
    if (s === "people") this.bowl(t + 0.3, 262, 0.07);
    if (s === "end") {
      this.bowl(t + 0.2, 220, 0.1);
      // let the final chord ring, then fade the whole mix away with the end card
      const g = this.master.gain;
      g.setValueAtTime(this.muted ? 0 : this.level, t + 9);
      g.linearRampToValueAtTime(0, t + 13.5);
    }
  }

  private schedule() {
    const c = this.ctx;
    if (!this.section || c.state !== "running") return;
    const sp = this.spec;
    const stepDur = 60 / sp.bpm / 4;
    while (this.nextTime < c.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, sp, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(s: number, t: number, sp: Spec, stepDur: number) {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const chordName = sp.prog[Math.floor(bar / sp.barsPerChord) % sp.prog.length];
    const chord = CHORDS[chordName];

    if (inBar === 0 && bar % sp.barsPerChord === 0) this.padChord(chord, t, sp.barsPerChord * 16 * stepDur);
    if (inBar === 0 && sp.bowlEvery && bar > 0 && bar % sp.bowlEvery === 0) this.bowl(t, 220, 0.09);

    // arpeggio from the chord's upper voices, up and down across two octaves
    if (sp.arp && (sp.arp === "16th" || inBar % 2 === 0)) {
      const up = [...chord.slice(1), ...chord.slice(1).map((m) => m + 12)];
      const seq = [...up, ...up.slice(1, -1).reverse()];
      const m = seq[this.arpIdx++ % seq.length] + (sp.arp === "16th" ? 0 : 12);
      const accent = inBar % 4 === 0 ? 1 : 0.65;
      this.pluck(m, t, 0.13 * (sp.arpLevel ?? 0.6) * accent, sp.arp === "16th" ? 0.35 : 0.9, 0.45);
    }

    // melody: a slow pentatonic line, landing on chord tones
    if (sp.melody && (inBar === 0 || inBar === 8 || (inBar === 12 && Math.random() < 0.3)) && Math.random() < sp.melody) {
      const tones = PENTA.filter((m) => chord.some((c) => (c - m) % 12 === 0));
      const pool = inBar === 0 && tones.length ? tones : PENTA;
      const near = pool.filter((m) => Math.abs(m - this.melodyNote) <= 5);
      const pick = (near.length ? near : pool)[Math.floor(Math.random() * (near.length || pool.length))];
      this.melodyNote = pick;
      this.pluck(pick + 12, t, 0.16, 3.2, 0.9);
    }

    // bass
    if (sp.bass === "beat" && inBar % 4 === 0) this.bassNote(chord[0], t, stepDur * 3.5, 0.12);
    if (sp.bass === "8th" && inBar % 2 === 0) this.bassNote(chord[0], t, stepDur * 1.8, inBar % 4 === 0 ? 0.14 : 0.09);

    // drums
    if (sp.drums === "pulse" && (inBar === 0 || inBar === 8)) this.taiko(t, inBar === 0 ? 0.22 : 0.12);
    if (sp.drums === "taiko") {
      if (inBar === 0 || inBar === 8) this.taiko(t, 0.4);
      if (inBar === 6 || inBar === 14) this.taiko(t, 0.22);
      if (inBar === 11 || inBar === 15) this.taiko(t, 0.15);
    }
    if (sp.hats) this.hat(t, inBar % 4 === 2 ? 0.05 : 0.025);
  }

  /* ---------- transport ---------- */

  async start() {
    await this.ctx.resume();
    this.ramp(this.master.gain, this.muted ? 0 : this.level, 2);
  }

  pause() {
    this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.ctx.resume().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.ramp(this.master.gain, m ? 0 : this.level, 0.4);
  }

  /** 0 → calm, 1 → full flood */
  setRumble(x: number) {
    this.ramp(this.rumble.gain, x * 0.32, 0.8);
  }

  close() {
    clearInterval(this.timer);
    this.ctx.close().catch(() => {});
  }
}

export type { Section as StorySection };
