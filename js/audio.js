// Song Analyzer - Pure Zero-Allocation Native Web Audio Engine
// 100% Offline Vanilla JS (Zero runtime external dependencies, file:// protocol compatible)

(function(window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. Static Pre-Computed Lookup Tables (Zero Allocation / O(1))
  // -------------------------------------------------------------
  const MIDI_TO_FREQ = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    MIDI_TO_FREQ[i] = 440 * Math.pow(2, (i - 69) / 12);
  }

  const NOTE_NAME_TO_MIDI = {};
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  for (let oct = -1; oct <= 9; oct++) {
    for (let s = 0; s < 12; s++) {
      const midi = (oct + 1) * 12 + s;
      if (midi >= 0 && midi < 128) {
        NOTE_NAME_TO_MIDI[`${SHARP_NAMES[s]}${oct}`] = midi;
        NOTE_NAME_TO_MIDI[`${FLAT_NAMES[s]}${oct}`] = midi;
      }
    }
  }

  function noteToFreq(noteStr) {
    if (typeof noteStr === 'number') return noteStr;
    if (!noteStr) return 440;
    const m = NOTE_NAME_TO_MIDI[noteStr];
    if (m !== undefined) return MIDI_TO_FREQ[m];
    // Fallback: match scientific pitch regex
    const match = String(noteStr).trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (match) {
      const step = match[1].toUpperCase();
      const accidental = match[2];
      const oct = parseInt(match[3], 10);
      let semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] || 0;
      if (accidental === '#') semi++;
      else if (accidental === 'b') semi--;
      const midi = (oct + 1) * 12 + semi;
      if (midi >= 0 && midi < 128) return MIDI_TO_FREQ[midi];
    }
    return 440;
  }

  function parseDuration(dur, bpm = 113) {
    if (typeof dur === 'number') return Math.max(0.01, dur);
    if (!dur) return 0.5;
    if (typeof dur === 'string') {
      const sTrim = dur.trim();
      if (sTrim.endsWith('s')) {
        const val = parseFloat(sTrim);
        return isNaN(val) ? 0.5 : Math.max(0.01, val);
      }
      const beatSec = 60 / (bpm || 113);
      if (sTrim === '1n' || sTrim === '1m') return beatSec * 4;
      if (sTrim === '2n') return beatSec * 2;
      if (sTrim === '4n') return beatSec;
      if (sTrim === '8n') return beatSec * 0.5;
      if (sTrim === '16n') return beatSec * 0.25;
      if (sTrim === '32n') return beatSec * 0.125;
      if (sTrim === '64n') return beatSec * 0.0625;
      const num = parseFloat(sTrim);
      if (!isNaN(num)) return Math.max(0.01, num);
    }
    return 0.5;
  }

  // -------------------------------------------------------------
  // 2. Persistent Zero-Allocation Polyphonic FM Synthesizer
  // -------------------------------------------------------------
  class NativePolySynth {
    constructor(ctx, destination, polyphony = 16) {
      this.ctx = ctx;
      this.destination = destination;
      this.polyphony = polyphony;
      this.voices = [];
      this.voiceIndex = 0;

      // Master output filter for warm FM electric piano body
      this.outputFilter = ctx.createBiquadFilter();
      this.outputFilter.type = 'lowpass';
      this.outputFilter.frequency.setValueAtTime(5200, 0);
      this.outputFilter.Q.setValueAtTime(0.85, 0);
      this.outputFilter.connect(destination);

      for (let i = 0; i < polyphony; i++) {
        const carrier = ctx.createOscillator();
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        const voiceGain = ctx.createGain();

        carrier.type = 'sine';
        modulator.type = 'sine';

        carrier.frequency.setValueAtTime(440, 0);
        modulator.frequency.setValueAtTime(880, 0);
        modGain.gain.setValueAtTime(0, 0);
        voiceGain.gain.setValueAtTime(0, 0);

        // FM Modulation routing: Modulator -> modGain -> carrier.frequency
        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        // Voice audio routing: carrier -> voiceGain -> outputFilter
        carrier.connect(voiceGain);
        voiceGain.connect(this.outputFilter);

        carrier.start(0);
        modulator.start(0);

        this.voices.push({
          carrier,
          modulator,
          modGain,
          voiceGain,
          busyUntil: 0,
          currentNote: null
        });
      }
    }

    triggerAttackRelease(notes, durationSec, scheduledTime, velocity = 1.0) {
      const arr = Array.isArray(notes) ? notes : [notes];
      if (arr.length === 0) return;

      const t = Math.max(this.ctx.currentTime, scheduledTime || 0);
      const holdSec = Math.max(0.12, durationSec || 0.8);
      const attack = 0.007;
      const decay = 0.85;
      const sustainLevel = 0.32;
      const release = 0.20;

      for (let n = 0; n < arr.length; n++) {
        const note = arr[n];
        const freq = noteToFreq(note);
        if (!freq || freq <= 0) continue;

        // Find available voice or steal oldest in release phase
        let voice = null;
        for (let i = 0; i < this.polyphony; i++) {
          const idx = (this.voiceIndex + i) % this.polyphony;
          if (this.voices[idx].busyUntil <= t) {
            voice = this.voices[idx];
            this.voiceIndex = (idx + 1) % this.polyphony;
            break;
          }
        }
        if (!voice) {
          let earliest = this.voices[0];
          let earliestIdx = 0;
          for (let i = 1; i < this.polyphony; i++) {
            if (this.voices[i].busyUntil < earliest.busyUntil) {
              earliest = this.voices[i];
              earliestIdx = i;
            }
          }
          voice = earliest;
          this.voiceIndex = (earliestIdx + 1) % this.polyphony;
        }

        voice.busyUntil = t + holdSec + release;
        voice.currentNote = note;

        // Schedule frequencies
        voice.carrier.frequency.setValueAtTime(freq, t);
        voice.modulator.frequency.setValueAtTime(freq * 2.0, t); // 2:1 harmonicity for Rhodes bell

        // Modulator FM envelope (harmonic bell transient)
        const modDepth = freq * 1.5 * velocity;
        voice.modGain.gain.cancelScheduledValues(t);
        voice.modGain.gain.setValueAtTime(0, t);
        voice.modGain.gain.linearRampToValueAtTime(modDepth, t + attack);
        voice.modGain.gain.exponentialRampToValueAtTime(Math.max(0.1, freq * 0.06), t + attack + 0.35);
        voice.modGain.gain.exponentialRampToValueAtTime(0.0001, t + holdSec);
        voice.modGain.gain.setValueAtTime(0, t + holdSec + release);

        // Carrier amplitude envelope
        const peakVol = 0.22 * Math.min(1.5, velocity);
        const sustainVol = peakVol * sustainLevel;
        voice.voiceGain.gain.cancelScheduledValues(t);
        voice.voiceGain.gain.setValueAtTime(0, t);
        voice.voiceGain.gain.linearRampToValueAtTime(peakVol, t + attack);
        voice.voiceGain.gain.exponentialRampToValueAtTime(sustainVol, t + attack + decay);
        voice.voiceGain.gain.setValueAtTime(sustainVol, t + holdSec);
        voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + holdSec + release);
        voice.voiceGain.gain.setValueAtTime(0, t + holdSec + release + 0.02);
      }
    }

    releaseAll(time = 0) {
      const t = Math.max(this.ctx.currentTime, time);
      for (let i = 0; i < this.polyphony; i++) {
        const v = this.voices[i];
        v.voiceGain.gain.cancelScheduledValues(t);
        v.voiceGain.gain.setValueAtTime(v.voiceGain.gain.value, t);
        v.voiceGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
        v.voiceGain.gain.setValueAtTime(0, t + 0.05);
        v.modGain.gain.cancelScheduledValues(t);
        v.modGain.gain.setValueAtTime(0, t + 0.05);
        v.busyUntil = t + 0.05;
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Persistent Zero-Allocation Monophonic Lead Synthesizer
  // -------------------------------------------------------------
  class NativeLeadSynth {
    constructor(ctx, destination, voiceType = 'analog') {
      this.ctx = ctx;
      this.destination = destination;
      this.activeVoiceType = voiceType;

      this.osc = ctx.createOscillator();
      this.osc.type = 'sawtooth';
      this.osc.frequency.setValueAtTime(440, 0);

      // FM modulator for Rhodes voice mode
      this.modOsc = ctx.createOscillator();
      this.modOsc.type = 'sine';
      this.modOsc.frequency.setValueAtTime(1320, 0);
      this.modGain = ctx.createGain();
      this.modGain.gain.setValueAtTime(0, 0);
      this.modOsc.connect(this.modGain);
      this.modGain.connect(this.osc.frequency);

      // Resonant 24dB low-pass filter
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(2400, 0);
      this.filter.Q.setValueAtTime(3.2, 0);

      this.gain = ctx.createGain();
      this.gain.gain.setValueAtTime(0, 0);

      this.osc.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(destination);

      this.osc.start(0);
      this.modOsc.start(0);
      this.setVoiceType(voiceType);
    }

    setVoiceType(type) {
      this.activeVoiceType = type || 'analog';
      if (this.activeVoiceType === 'analog') {
        this.osc.type = 'sawtooth';
        this.filter.type = 'lowpass';
        this.filter.Q.setValueAtTime(3.2, 0);
      } else if (this.activeVoiceType === 'rhodes') {
        this.osc.type = 'sine';
        this.filter.type = 'lowpass';
        this.filter.Q.setValueAtTime(1.2, 0);
      } else if (this.activeVoiceType === 'overdrive') {
        this.osc.type = 'square';
        this.filter.type = 'lowpass';
        this.filter.Q.setValueAtTime(4.2, 0);
      } else if (this.activeVoiceType === 'flute') {
        this.osc.type = 'triangle';
        this.filter.type = 'lowpass';
        this.filter.Q.setValueAtTime(0.8, 0);
      }
    }

    triggerAttackRelease(note, durationSec, scheduledTime, velocity = 1.0) {
      const freq = noteToFreq(note);
      if (!freq || freq <= 0) return;

      const t = Math.max(this.ctx.currentTime, scheduledTime || 0);
      const dur = Math.max(0.1, durationSec || 0.45);

      this.osc.frequency.setValueAtTime(freq, t);

      if (this.activeVoiceType === 'rhodes') {
        this.modOsc.frequency.setValueAtTime(freq * 3.0, t);
        this.modGain.gain.cancelScheduledValues(t);
        this.modGain.gain.setValueAtTime(freq * 1.4, t);
        this.modGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        this.modGain.gain.setValueAtTime(0, t + 0.38);
      } else {
        this.modGain.gain.cancelScheduledValues(t);
        this.modGain.gain.setValueAtTime(0, t);
      }

      // Filter cutoff envelope
      const baseCutoff = (this.activeVoiceType === 'flute') ? 1600 : (this.activeVoiceType === 'overdrive' ? 3400 : 2200);
      this.filter.frequency.cancelScheduledValues(t);
      this.filter.frequency.setValueAtTime(baseCutoff, t);
      this.filter.frequency.exponentialRampToValueAtTime(Math.min(11000, baseCutoff * 2.8), t + 0.04);
      this.filter.frequency.exponentialRampToValueAtTime(baseCutoff, t + dur);

      // Amplitude envelope
      const peak = 0.26 * Math.min(1.5, velocity);
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      this.gain.gain.exponentialRampToValueAtTime(peak * 0.65, t + 0.012 + 0.25);
      this.gain.gain.setValueAtTime(peak * 0.65, t + dur);
      this.gain.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
      this.gain.gain.setValueAtTime(0, t + dur + 0.15);
    }
  }

  // -------------------------------------------------------------
  // 4. Persistent Zero-Allocation Clave Percussion Synthesizer
  // -------------------------------------------------------------
  class NativeClaveSynth {
    constructor(ctx, destination) {
      this.ctx = ctx;
      this.osc = ctx.createOscillator();
      this.gain = ctx.createGain();

      this.osc.type = 'triangle';
      this.osc.frequency.setValueAtTime(600, 0);
      this.gain.gain.setValueAtTime(0, 0);

      this.osc.connect(this.gain);
      this.gain.connect(destination);

      this.osc.start(0);
    }

    triggerAttackRelease(note = 'C4', durationSec = 0.08, scheduledTime = 0, velocity = 1.0) {
      const t = Math.max(this.ctx.currentTime, scheduledTime || 0);

      this.osc.frequency.cancelScheduledValues(t);
      this.osc.frequency.setValueAtTime(650, t);
      this.osc.frequency.exponentialRampToValueAtTime(75, t + 0.022);

      const peak = 0.35 * velocity;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(peak, t + 0.002);
      this.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      this.gain.gain.setValueAtTime(0, t + 0.075);
    }
  }

  // -------------------------------------------------------------
  // 5. Main AudioEngine (Clean Native Web Audio Replacement)
  // -------------------------------------------------------------
  class AudioEngine {
    constructor() {
      this.initialized = false;
      this.ctx = null;
      this.rawAudioContext = null;
      this.isPlayingProgression = false;
      this.isMetronomeRunning = false;
      this.currentChordIndex = 0;
      this.activeProgression = [];
      this.onChordHighlight = null;
      this.currentBpm = 113;

      // Speech synthesis
      this.speechSynth = (typeof window !== 'undefined') ? (window.speechSynthesis || null) : null;
      this.spokenCountingEnabled = false;
      this.subdivision = 1;
      this.metronomeSoundMode = 'woodblock';
      this.isRhythmPlaying = false;
      this.rhythmLoopTimeout = null;
      this.rhythmTimeouts = [];

      // Metronome worker and persistent nodes
      this.metroWorker = null;
      this.metroNodesInitialized = false;
      this.metroOsc = null;
      this.metroGain = null;
      this.metroTimerId = null;
      this.metroAnimFrameId = null;
      this.metroVisualQueue = [];
      this.nextMetroTickAudioTime = 0;
      this.metroTickCount = 0;
      this.scheduleMetroLoop = null;
      this.preRenderedBuffers = {
        woodblockDownbeat: null,
        woodblockBeat: null,
        woodblockSub: null,
        clickDownbeat: null,
        clickBeat: null,
        clickSub: null
      };

      // Channels and synths
      this.masterLimiter = null;
      this.masterVolumeGain = null;
      this.masterVolume = null;
      this.chordVolumeGain = null;
      this.chordVolumeChannel = null;
      this.melodyVolumeGain = null;
      this.melodyVolumeChannel = null;
      this.chordSynth = null;
      this.melodySynths = null;
      this.leadSynth = null;
      this.percussionSynth = null;
      this.activeMelodyVoice = 'analog';

      // Melody progression
      this.isPlayingMelodyProgression = false;
      this.activeMelodyProgression = null;
      this.activeMelodyNodes = null;
      this.melodyProgressionVisualTimeouts = [];
      this.melodyProgressionInterval = null;
      this.onMelodyStepHighlight = null;
      this.currentPlayingChordIdx = -1;
      this.currentChordStartTime = 0;
      this.currentChordDuration = 0;
      this.nextScheduledChordIdx = -1;
      this.nextScheduledTime = 0;
    }

    async resumeIfNeeded() {
      if (!this.ctx) return false;
      try {
        if (this.ctx.state !== 'running') {
          await this.ctx.resume();
        }
        return this.ctx.state === 'running';
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
        return false;
      }
    }

    isAudioRunning() {
      return this.initialized && this.ctx && this.ctx.state === 'running';
    }

    async suspend() {
      if (this.isMetronomeRunning) this.stopMetronome();
      if (this.isRhythmPlaying) this.stopRhythm();
      if (this.isPlayingProgression) this.stopProgression();
      if (this.isPlayingMelodyProgression) this.stopProgressionWithMelody();
      if (this.ctx && typeof this.ctx.suspend === 'function') {
        try {
          await this.ctx.suspend();
        } catch (e) {
          console.warn('AudioContext suspend failed:', e);
        }
      }
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('songaudio-statechange', {
          detail: { state: 'suspended' }
        }));
      }
    }

    async init() {
      if (this.initialized) {
        await this.resumeIfNeeded();
        return true;
      }

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          console.error('Web Audio API is not supported in this browser.');
          return false;
        }

        this.rawAudioContext = new AudioCtx({ latencyHint: 'playback' });
        this.ctx = this.rawAudioContext;

        if (this.ctx.state === 'suspended') {
          try {
            await this.ctx.resume();
          } catch (e) {}
        }

        // 1. Master Output Chain with Brickwall Limiter
        this.masterLimiter = this.ctx.createDynamicsCompressor();
        this.masterLimiter.threshold.setValueAtTime(-1.0, 0);
        this.masterLimiter.knee.setValueAtTime(0, 0);
        this.masterLimiter.ratio.setValueAtTime(20, 0);
        this.masterLimiter.attack.setValueAtTime(0.001, 0);
        this.masterLimiter.release.setValueAtTime(0.05, 0);
        this.masterLimiter.connect(this.ctx.destination);

        this.masterVolumeGain = this.ctx.createGain();
        this.masterVolumeGain.gain.setValueAtTime(0.65, 0);
        this.masterVolumeGain.connect(this.masterLimiter);

        // Native GainNode with legacy Tone.Volume property shim
        const self = this;
        this.masterVolume = this.masterVolumeGain;
        Object.defineProperty(this.masterVolume, 'volume', {
          configurable: true,
          get: () => ({
            set value(db) {
              const g = Math.pow(10, Math.max(-40, Math.min(6, db)) / 20);
              self.masterVolumeGain.gain.setValueAtTime(g, self.ctx ? self.ctx.currentTime : 0);
            },
            get value() {
              return 20 * Math.log10(self.masterVolumeGain.gain.value || 0.0001);
            }
          })
        });

        // 2. Progression & Melody Volume Channels (genuine GainNodes)
        this.chordVolumeGain = this.ctx.createGain();
        this.chordVolumeGain.gain.setValueAtTime(0.85, 0);
        this.chordVolumeGain.connect(this.masterVolumeGain);
        this.chordVolumeChannel = this.chordVolumeGain;
        Object.defineProperty(this.chordVolumeChannel, 'volume', {
          configurable: true,
          get: () => ({
            set value(db) {
              const g = Math.pow(10, db / 20);
              self.chordVolumeGain.gain.setValueAtTime(g, self.ctx ? self.ctx.currentTime : 0);
            }
          })
        });

        this.melodyVolumeGain = this.ctx.createGain();
        this.melodyVolumeGain.gain.setValueAtTime(1.0, 0);
        this.melodyVolumeGain.connect(this.masterVolumeGain);
        this.melodyVolumeChannel = this.melodyVolumeGain;
        Object.defineProperty(this.melodyVolumeChannel, 'volume', {
          configurable: true,
          get: () => ({
            set value(db) {
              const g = Math.pow(10, db / 20);
              self.melodyVolumeGain.gain.setValueAtTime(g, self.ctx ? self.ctx.currentTime : 0);
            }
          })
        });

        // 3. Persistent 16-Voice FM Polyphonic Synthesizer
        this.chordSynth = new NativePolySynth(this.ctx, this.chordVolumeGain, 16);

        // 4. Dedicated Solo Lead Synths for Melodic Ribbon
        this.melodySynths = {
          analog: new NativeLeadSynth(this.ctx, this.melodyVolumeGain, 'analog'),
          rhodes: new NativeLeadSynth(this.ctx, this.melodyVolumeGain, 'rhodes'),
          overdrive: new NativeLeadSynth(this.ctx, this.melodyVolumeGain, 'overdrive'),
          flute: new NativeLeadSynth(this.ctx, this.melodyVolumeGain, 'flute')
        };
        this.leadSynth = new NativeLeadSynth(this.ctx, this.masterVolumeGain, 'rhodes');
        this.activeMelodyVoice = 'analog';

        // 5. Rhythm Clave Synth
        this.percussionSynth = new NativeClaveSynth(this.ctx, this.masterVolumeGain);

        this.initialized = true;

        // Forward AudioContext state changes to window
        const notifyState = () => {
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('songaudio-statechange', {
              detail: { state: this.ctx ? this.ctx.state : 'closed' }
            }));
          }
        };
        if (this.ctx.addEventListener) {
          this.ctx.addEventListener('statechange', notifyState);
        } else {
          this.ctx.onstatechange = notifyState;
        }

        // Initialize metronome pre-rendered buffers and nodes
        this.initBuffers();
        this.initMetroAudioNodes();

        return true;
      } catch (e) {
        console.error('Native AudioEngine init error:', e);
        return false;
      }
    }

    getAudioCurrentTime() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    initMetroWorker() {
      if (this.metroWorker) return;
      try {
        const workerBlob = new Blob([
          `let timerId = null;
self.onmessage = function(e) {
  if (e.data === 'start') {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function() { self.postMessage('tick'); }, 50);
  } else if (e.data === 'stop') {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }
};`
        ], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);
        this.metroWorker = new Worker(workerUrl);
        this.metroWorker.onmessage = (e) => {
          if (e.data === 'tick' && this.isMetronomeRunning && typeof this.scheduleMetroLoop === 'function') {
            this.scheduleMetroLoop();
          }
        };
      } catch (err) {
        console.warn('Web Worker creation failed in this environment (using setInterval fallback):', err);
        this.metroWorker = null;
      }
    }

    initBuffers() {
      const ctx = this.ctx;
      if (!ctx || typeof ctx.createBuffer !== 'function') return;
      const sr = ctx.sampleRate || 44100;

      const createSyntheticBuffer = (durationSec, synthFn) => {
        try {
          const numSamples = Math.max(1, Math.floor(durationSec * sr));
          const buffer = ctx.createBuffer(1, numSamples, sr);
          const data = buffer.getChannelData(0);
          synthFn(data, numSamples, sr);
          return buffer;
        } catch (e) {
          return null;
        }
      };

      try {
        this.preRenderedBuffers.woodblockDownbeat = createSyntheticBuffer(0.045, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 600 + 280 * Math.exp(-t * 120);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 65);
            d[i] = Math.sin(phase) * env * 0.95;
          }
        });

        this.preRenderedBuffers.woodblockBeat = createSyntheticBuffer(0.035, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 450 + 210 * Math.exp(-t * 130);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 75);
            d[i] = Math.sin(phase) * env * 0.75;
          }
        });

        this.preRenderedBuffers.woodblockSub = createSyntheticBuffer(0.025, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 360 + 160 * Math.exp(-t * 150);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 90);
            d[i] = Math.sin(phase) * env * 0.45;
          }
        });

        this.preRenderedBuffers.clickDownbeat = createSyntheticBuffer(0.012, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 320);
            const sine = Math.sin(2 * Math.PI * 2400 * t);
            const noise = (Math.random() * 2 - 1) * 0.25;
            d[i] = (sine + noise) * env * 0.95;
          }
        });

        this.preRenderedBuffers.clickBeat = createSyntheticBuffer(0.010, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 360);
            const sine = Math.sin(2 * Math.PI * 1700 * t);
            const noise = (Math.random() * 2 - 1) * 0.15;
            d[i] = (sine + noise) * env * 0.70;
          }
        });

        this.preRenderedBuffers.clickSub = createSyntheticBuffer(0.008, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 420);
            d[i] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.40;
          }
        });
      } catch (e) {
        console.warn('initBuffers error:', e);
      }
    }

    initMetroAudioNodes() {
      if (this.metroNodesInitialized || !this.ctx) return;
      try {
        this.metroOsc = this.ctx.createOscillator();
        this.metroOsc.type = 'sine';
        this.metroOsc.frequency.setValueAtTime(880, 0);

        this.metroGain = this.ctx.createGain();
        this.metroGain.gain.setValueAtTime(0, 0);

        this.metroOsc.connect(this.metroGain);
        this.metroGain.connect(this.masterVolumeGain || this.ctx.destination);
        this.metroOsc.start(0);
        this.metroNodesInitialized = true;
      } catch (e) {
        console.warn('initMetroAudioNodes error:', e);
      }
    }

    playMetronomeTick(isDownbeat, isBeatHead, scheduledTime) {
      if (!this.metroNodesInitialized) this.initMetroAudioNodes();
      if (!this.metroOsc || !this.metroGain || !this.ctx) return false;

      const t = Math.max(this.ctx.currentTime, scheduledTime || 0);

      let startFreq, endFreq, vol, decaySec;
      if (this.metronomeSoundMode === 'woodblock') {
        if (isDownbeat) {
          startFreq = 880; endFreq = 580; vol = 0.95; decaySec = 0.045;
        } else if (isBeatHead) {
          startFreq = 660; endFreq = 440; vol = 0.72; decaySec = 0.035;
        } else {
          startFreq = 520; endFreq = 360; vol = 0.42; decaySec = 0.025;
        }
      } else {
        if (isDownbeat) {
          startFreq = 2400; endFreq = 1800; vol = 0.90; decaySec = 0.020;
        } else if (isBeatHead) {
          startFreq = 1700; endFreq = 1200; vol = 0.65; decaySec = 0.015;
        } else {
          startFreq = 1200; endFreq = 900; vol = 0.35; decaySec = 0.010;
        }
      }

      this.metroOsc.frequency.cancelScheduledValues(t);
      this.metroOsc.frequency.setValueAtTime(startFreq, t);
      this.metroOsc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + decaySec);

      this.metroGain.gain.cancelScheduledValues(t);
      this.metroGain.gain.setValueAtTime(0, t);
      this.metroGain.gain.linearRampToValueAtTime(vol * 0.45, t + 0.001);
      this.metroGain.gain.exponentialRampToValueAtTime(0.0001, t + decaySec);
      this.metroGain.gain.setValueAtTime(0, t + decaySec + 0.005);

      return true;
    }

    playTestTone() {
      if (!this.initialized) {
        this.init().then(() => this.playTestTone());
        return;
      }
      this.resumeIfNeeded();
      if (this.leadSynth) {
        this.leadSynth.triggerAttackRelease('C5', 0.25, this.ctx.currentTime);
      }
    }

    setMasterVolume(valDb) {
      if (this.masterVolumeGain && this.ctx) {
        const g = Math.pow(10, Math.max(-40, Math.min(6, valDb)) / 20);
        this.masterVolumeGain.gain.setValueAtTime(g, this.ctx.currentTime);
      }
    }

    setBpm(bpm) {
      const val = Math.max(15, Math.min(240, parseInt(bpm, 10) || 113));
      this.currentBpm = val;
    }

    generateVoicing(chord, baseOctave = 4) {
      if (!chord || !chord.pitchClasses) return [];

      const notes = [];
      const rootPC = chord.rootPC;
      const bassPC = (chord.bassPC !== undefined && chord.bassPC !== null) ? chord.bassPC : rootPC;

      const bassNote = `${SHARP_NAMES[bassPC]}3`;
      notes.push(bassNote);

      chord.intervals.forEach((interval) => {
        const pc = (rootPC + interval) % 12;
        const octave = baseOctave + Math.floor((rootPC + interval) / 12);
        const noteName = `${SHARP_NAMES[pc]}${octave}`;
        if (!notes.includes(noteName)) {
          notes.push(noteName);
        }
      });

      return notes;
    }

    async playChord(chord, duration = 1.2) {
      if (!this.initialized) await this.init();
      await this.resumeIfNeeded();
      const voicing = this.generateVoicing(chord);
      if (voicing.length > 0 && this.chordSynth) {
        const durSec = parseDuration(duration, this.currentBpm || 113);
        this.chordSynth.triggerAttackRelease(voicing, durSec, this.ctx.currentTime);
      }
    }

    async playArpeggio(chord, noteDurationSeconds = 0.2) {
      if (!this.initialized) await this.init();
      await this.resumeIfNeeded();
      const voicing = this.generateVoicing(chord);
      const now = this.ctx.currentTime;
      voicing.forEach((note, idx) => {
        this.leadSynth.triggerAttackRelease(note, noteDurationSeconds, now + (idx * noteDurationSeconds));
      });
    }

    async playScale(intervals, rootTonic = 'C', noteDurationSeconds = 0.22) {
      if (!this.initialized) await this.init();
      await this.resumeIfNeeded();
      const Theory = window.SongTheory;
      const rootPC = Theory ? (Theory.noteToPitchClass(rootTonic) || 0) : 0;
      const sortedIntervals = [...intervals].sort((a, b) => a - b);
      const notes = sortedIntervals.map(iv => {
        const pc = (rootPC + iv) % 12;
        const noteName = Theory ? Theory.pitchClassToNote(pc) : 'C';
        const octave = (rootPC + iv >= 12) ? 5 : 4;
        return `${noteName}${octave}`;
      });
      const topRootName = Theory ? Theory.pitchClassToNote(rootPC) : 'C';
      notes.push(`${topRootName}5`);

      const now = this.ctx.currentTime;
      notes.forEach((note, idx) => {
        this.leadSynth.triggerAttackRelease(note, noteDurationSeconds, now + (idx * noteDurationSeconds));
      });
    }

    async playProgression(parsedChords, bpm = 113, loop = false, onChordHighlight = null, onFinished = null, startTime = null) {
      if (!this.initialized) await this.init();
      if (!this.initialized || !parsedChords || parsedChords.length === 0) return;
      await this.resumeIfNeeded();

      this.stopProgression();
      this.activeProgression = parsedChords;
      this.isPlayingProgression = true;
      this.onChordHighlight = onChordHighlight;

      this.currentBpm = bpm;
      const secondsPerChord = (60 / bpm) * 2;
      let currentIdx = 0;
      const now = this.ctx.currentTime;
      let nextChordAudioTime = (typeof startTime === 'number' && startTime >= now) ? startTime : (now + 0.04);
      this.nextChordAudioTime = nextChordAudioTime;

      // Resilient 400ms lookahead scheduling buffer (immune to orientation change & DOM reflow stalls)
      const scheduleAhead = 0.40;
      const scheduleChords = () => {
        if (!this.isPlayingProgression) return;
        const currentAudioTime = this.ctx.currentTime;

        while (nextChordAudioTime < currentAudioTime + scheduleAhead) {
          if (currentIdx >= this.activeProgression.length) {
            if (loop) {
              currentIdx = 0;
            } else {
              this.stopProgression();
              if (onFinished) onFinished();
              return;
            }
          }

          const chordIdx = currentIdx;
          const chord = this.activeProgression[chordIdx];
          const voicing = this.generateVoicing(chord);
          const targetTime = Math.max(currentAudioTime, nextChordAudioTime);
          const chordHoldDuration = Math.max(0.18, secondsPerChord - 0.10);

          if (this.chordSynth) {
            this.chordSynth.triggerAttackRelease(voicing, chordHoldDuration, targetTime);
          }

          if (this.onChordHighlight) {
            const visualDelay = Math.max(0, (targetTime - this.ctx.currentTime) * 1000);
            const tId = setTimeout(() => {
              if (this.isPlayingProgression && this.onChordHighlight) {
                this.onChordHighlight(chordIdx, chord);
              }
            }, visualDelay);
            this.progressionVisualTimeouts.push(tId);
          }

          nextChordAudioTime += secondsPerChord;
          this.nextChordAudioTime = nextChordAudioTime;
          currentIdx++;
        }
      };

      this.progressionVisualTimeouts = [];
      scheduleChords();
      this.progressionInterval = setInterval(scheduleChords, 35);
    }

    stopProgression() {
      this.isPlayingProgression = false;
      if (this.progressionInterval) {
        clearInterval(this.progressionInterval);
        this.progressionInterval = null;
      }
      if (this.progressionVisualTimeouts) {
        this.progressionVisualTimeouts.forEach(t => clearTimeout(t));
        this.progressionVisualTimeouts = [];
      }
      if (this.chordSynth && typeof this.chordSynth.releaseAll === 'function') {
        try {
          this.chordSynth.releaseAll();
        } catch (e) {}
      }
      this.nextChordAudioTime = 0;
    }

    getNextChordDownbeatTime() {
      if (!this.isPlayingProgression && !this.isPlayingMelodyProgression) return null;
      const now = this.getAudioCurrentTime();
      return Math.max(now + 0.03, this.nextChordAudioTime || now);
    }

    setMelodyLeadVoice(voiceType) {
      if (this.melodySynths && this.melodySynths[voiceType]) {
        this.activeMelodyVoice = voiceType;
      }
    }

    setMelodyVolume(val) {
      if (this.melodyVolumeGain && this.ctx) {
        this.melodyVolumeGain.gain.setValueAtTime(Math.max(0, val * 1.3), this.ctx.currentTime);
      }
    }

    setChordVolume(val) {
      if (this.chordVolumeGain && this.ctx) {
        this.chordVolumeGain.gain.setValueAtTime(Math.max(0, val), this.ctx.currentTime);
      }
    }

    playMelodyPreviewNote(noteScientific, duration = 0.5) {
      if (!this.initialized) {
        this.init().then(() => this.playMelodyPreviewNote(noteScientific, duration));
        return;
      }
      this.resumeIfNeeded();
      const leadSynth = (this.melodySynths && this.melodySynths[this.activeMelodyVoice]) ? this.melodySynths[this.activeMelodyVoice] : this.leadSynth;
      if (leadSynth && noteScientific) {
        const durSec = parseDuration(duration, this.currentBpm || 113);
        leadSynth.triggerAttackRelease(noteScientific, durSec, this.ctx.currentTime);
      }
    }

    getMelodyNodes() {
      if (typeof this.activeMelodyNodes === 'function') {
        return this.activeMelodyNodes();
      }
      return this.activeMelodyNodes;
    }

    updateActiveMelodyNodes(newNodes, playCurrentImmediately = true) {
      this.activeMelodyNodes = newNodes;

      if (!this.isPlayingMelodyProgression || !playCurrentImmediately) return;

      const now = this.getAudioCurrentTime();
      const nodes = (typeof newNodes === 'function') ? newNodes() : newNodes;
      if (!nodes || nodes.length === 0) return;

      const currentIdx = this.currentPlayingChordIdx;
      if (currentIdx >= 0 && currentIdx < nodes.length) {
        const melodyNode = nodes[currentIdx];
        if (melodyNode && melodyNode.scientific) {
          const leadSynth = (this.melodySynths && this.melodySynths[this.activeMelodyVoice]) ? this.melodySynths[this.activeMelodyVoice] : this.leadSynth;
          const elapsed = Math.max(0, now - this.currentChordStartTime);
          const remaining = Math.max(0.2, this.currentChordDuration - elapsed);

          try {
            leadSynth.triggerAttackRelease(melodyNode.scientific, remaining * 0.85, now);
          } catch (e) {
            console.warn('Lead synth note trigger error:', e);
          }

          if (this.onMelodyStepHighlight && this.activeMelodyProgression) {
            const chord = this.activeMelodyProgression[currentIdx];
            this.onMelodyStepHighlight(currentIdx, chord, melodyNode);
          }
        }
      }

      if (this.nextScheduledChordIdx >= 0 && this.nextScheduledChordIdx !== currentIdx && this.nextScheduledTime > now) {
        const nextIdx = this.nextScheduledChordIdx;
        if (nodes[nextIdx] && nodes[nextIdx].scientific) {
          const leadSynth = (this.melodySynths && this.melodySynths[this.activeMelodyVoice]) ? this.melodySynths[this.activeMelodyVoice] : this.leadSynth;
          const remaining = Math.max(0.2, this.currentChordDuration);
          try {
            leadSynth.triggerAttackRelease(nodes[nextIdx].scientific, remaining * 0.82, this.nextScheduledTime);
          } catch (e) {
            console.warn('Lead synth lookahead reschedule error:', e);
          }
        }
      }
    }

    onNodeCustomizedDuringPlayback(chordIndex, candidate) {
      if (!this.isPlayingMelodyProgression) return;
      const now = this.getAudioCurrentTime();
      const leadSynth = (this.melodySynths && this.melodySynths[this.activeMelodyVoice]) ? this.melodySynths[this.activeMelodyVoice] : this.leadSynth;

      if (chordIndex === this.currentPlayingChordIdx) {
        const elapsed = Math.max(0, now - this.currentChordStartTime);
        const remaining = Math.max(0.2, this.currentChordDuration - elapsed);
        if (leadSynth && candidate && candidate.scientific) {
          leadSynth.triggerAttackRelease(candidate.scientific, remaining * 0.85, now);
        }
        if (this.onMelodyStepHighlight && this.activeMelodyProgression) {
          const chord = this.activeMelodyProgression[chordIndex];
          this.onMelodyStepHighlight(chordIndex, chord, candidate);
        }
      } else if (chordIndex === this.nextScheduledChordIdx && this.nextScheduledTime > now) {
        if (leadSynth && candidate && candidate.scientific) {
          leadSynth.triggerAttackRelease(candidate.scientific, this.currentChordDuration * 0.82, this.nextScheduledTime);
        }
      }
    }

    async playProgressionWithMelody(parsedChords, melodyNodes, bpm = 113, loop = false, onStepHighlight = null, onFinished = null, startTime = null) {
      if (!this.initialized) await this.init();
      if (!this.initialized || !parsedChords || parsedChords.length === 0) return;
      await this.resumeIfNeeded();

      this.stopProgression();
      this.stopProgressionWithMelody();

      this.activeMelodyProgression = parsedChords;
      this.activeMelodyNodes = melodyNodes;
      this.isPlayingMelodyProgression = true;
      this.onMelodyStepHighlight = onStepHighlight;
      this.currentPlayingChordIdx = -1;
      this.nextScheduledChordIdx = -1;
      this.nextScheduledTime = 0;

      this.currentBpm = bpm;
      const secondsPerChord = (60 / bpm) * 2;
      let currentIdx = 0;
      const now = this.ctx.currentTime;
      let nextChordAudioTime = (typeof startTime === 'number' && startTime >= now) ? startTime : (now + 0.04);
      this.nextChordAudioTime = nextChordAudioTime;

      // Resilient 400ms lookahead scheduling buffer (immune to orientation change & DOM reflow stalls)
      const scheduleAhead = 0.40;
      const scheduleChordsAndMelody = () => {
        if (!this.isPlayingMelodyProgression) return;
        const currentAudioTime = this.ctx.currentTime;

        while (nextChordAudioTime < currentAudioTime + scheduleAhead) {
          if (currentIdx >= this.activeMelodyProgression.length) {
            if (loop) {
              currentIdx = 0;
            } else {
              this.stopProgressionWithMelody();
              if (onFinished) onFinished();
              return;
            }
          }

          const chordIdx = currentIdx;
          const chord = this.activeMelodyProgression[chordIdx];
          const voicing = this.generateVoicing(chord);
          const targetTime = Math.max(currentAudioTime, nextChordAudioTime);
          const chordHoldDuration = Math.max(0.18, secondsPerChord - 0.10);

          if (voicing.length > 0 && this.chordSynth) {
            this.chordSynth.triggerAttackRelease(voicing, chordHoldDuration, targetTime);
          }

          this.nextScheduledChordIdx = chordIdx;
          this.nextScheduledTime = targetTime;
          const currentMelodyNodes = this.getMelodyNodes();
          const melodyNode = (currentMelodyNodes && currentMelodyNodes[chordIdx]) ? currentMelodyNodes[chordIdx] : null;
          if (melodyNode && melodyNode.scientific) {
            const leadSynth = (this.melodySynths && this.melodySynths[this.activeMelodyVoice]) ? this.melodySynths[this.activeMelodyVoice] : this.leadSynth;
            leadSynth.triggerAttackRelease(melodyNode.scientific, secondsPerChord * 0.82, targetTime);
          }

          if (this.onMelodyStepHighlight) {
            const visualDelay = Math.max(0, (targetTime - this.ctx.currentTime) * 1000);
            const tId = setTimeout(() => {
              if (this.isPlayingMelodyProgression && this.onMelodyStepHighlight) {
                this.currentPlayingChordIdx = chordIdx;
                this.currentChordStartTime = targetTime;
                this.currentChordDuration = secondsPerChord;
                const liveMelodyNodes = this.getMelodyNodes();
                const activeNode = (liveMelodyNodes && liveMelodyNodes[chordIdx]) ? liveMelodyNodes[chordIdx] : melodyNode;
                this.onMelodyStepHighlight(chordIdx, chord, activeNode);
              }
            }, visualDelay);
            this.melodyProgressionVisualTimeouts.push(tId);
          }

          nextChordAudioTime += secondsPerChord;
          this.nextChordAudioTime = nextChordAudioTime;
          currentIdx++;
        }
      };

      this.melodyProgressionVisualTimeouts = [];
      scheduleChordsAndMelody();
      this.melodyProgressionInterval = setInterval(scheduleChordsAndMelody, 35);
    }

    stopProgressionWithMelody() {
      this.isPlayingMelodyProgression = false;
      this.currentPlayingChordIdx = -1;
      this.nextScheduledChordIdx = -1;
      this.nextScheduledTime = 0;
      if (this.melodyProgressionInterval) {
        clearInterval(this.melodyProgressionInterval);
        this.melodyProgressionInterval = null;
      }
      if (this.melodyProgressionVisualTimeouts) {
        this.melodyProgressionVisualTimeouts.forEach(t => clearTimeout(t));
        this.melodyProgressionVisualTimeouts = [];
      }
      if (this.chordSynth && typeof this.chordSynth.releaseAll === 'function') {
        try {
          this.chordSynth.releaseAll();
        } catch (e) {}
      }
      if (this.onMelodyStepHighlight) {
        this.onMelodyStepHighlight(-1, null, null);
      }
    }

    async startMetronome(bpm, timeSignature = { num: 4, den: 4 }, subdivision = 1, soundMode = 'woodblock', onTick = null) {
      if (!this.initialized) await this.init();
      await this.resumeIfNeeded();
      this.stopMetronome();

      const safeBpm = Math.max(15, Math.min(240, parseInt(bpm, 10) || 113));
      this.isMetronomeRunning = true;
      this.timeSignature = {
        num: Math.max(1, parseInt(timeSignature.num, 10) || 4),
        den: Math.max(1, parseInt(timeSignature.den, 10) || 4)
      };
      this.subdivision = Math.max(1, parseInt(subdivision, 10) || 1);
      this.metronomeSoundMode = soundMode;
      this.onTickCallback = onTick;
      this.currentBpm = safeBpm;

      this.metroVisualQueue = [];
      this.metroTickCount = 0;
      const now = this.getAudioCurrentTime();
      this.nextMetroTickAudioTime = now + 0.04;

      const scheduleAheadSec = 0.25;

      this.scheduleMetroLoop = () => {
        if (!this.isMetronomeRunning) return;
        const currentTime = this.getAudioCurrentTime();

        const activeBpm = this.currentBpm || safeBpm;
        const tickInterval = 240 / (this.timeSignature.den * activeBpm * this.subdivision);

        if (this.nextMetroTickAudioTime < currentTime - 0.5) {
          const elapsed = currentTime - this.nextMetroTickAudioTime;
          const ticksMissed = Math.ceil(elapsed / tickInterval);
          this.metroTickCount += ticksMissed;
          this.nextMetroTickAudioTime += ticksMissed * tickInterval;
          if (this.nextMetroTickAudioTime < currentTime) {
            this.nextMetroTickAudioTime = currentTime + 0.02;
          }
        }

        while (this.nextMetroTickAudioTime < currentTime + scheduleAheadSec) {
          const totalBeats = this.timeSignature.num;
          const subIdx = this.metroTickCount % this.subdivision;
          const beatIndex = (Math.floor(this.metroTickCount / this.subdivision) % totalBeats) + 1;
          const isDownbeat = (beatIndex === 1 && subIdx === 0);
          const isBeatHead = (subIdx === 0);
          const scheduledTime = Math.max(currentTime, this.nextMetroTickAudioTime);

          if (this.metronomeSoundMode === 'woodblock' || this.metronomeSoundMode === 'synth') {
            this.playMetronomeTick(isDownbeat, isBeatHead, scheduledTime);
          } else if (this.metronomeSoundMode === 'spoken' && this.speechSynth) {
            const delayMs = Math.max(0, (scheduledTime - this.getAudioCurrentTime()) * 1000);
            setTimeout(() => {
              if (!this.isMetronomeRunning) return;
              if (isBeatHead) {
                this.speakNumber(beatIndex);
              } else {
                if (this.subdivision === 2 && subIdx === 1) this.speakWord('&');
                else if (this.subdivision === 3) {
                  if (subIdx === 1) this.speakWord('trip');
                  else if (subIdx === 2) this.speakWord('let');
                } else if (this.subdivision === 4) {
                  if (subIdx === 1) this.speakWord('e');
                  else if (subIdx === 2) this.speakWord('&');
                  else if (subIdx === 3) this.speakWord('a');
                }
              }
            }, delayMs);
          }

          if (onTick) {
            while (this.metroVisualQueue.length >= 30) {
              this.metroVisualQueue.shift();
            }
            this.metroVisualQueue.push({
              time: scheduledTime,
              beat: beatIndex,
              subIdx: subIdx,
              isDownbeat: isDownbeat,
              totalBeats: totalBeats
            });
          }

          this.nextMetroTickAudioTime += tickInterval;
          this.metroTickCount++;
        }
      };

      this.scheduleMetroLoop();

      if (this.metroWorker) {
        this.metroWorker.postMessage('start');
      } else {
        this.metroTimerId = setInterval(this.scheduleMetroLoop, 25);
      }

      if (onTick) {
        const visualLoop = () => {
          if (!this.isMetronomeRunning) return;
          const currentAudioTime = this.getAudioCurrentTime();

          while (this.metroVisualQueue.length > 1 && this.metroVisualQueue[0].time < currentAudioTime - 0.2) {
            this.metroVisualQueue.shift();
          }

          while (this.metroVisualQueue.length > 0 && this.metroVisualQueue[0].time <= currentAudioTime + 0.02) {
            const item = this.metroVisualQueue.shift();
            onTick(item.beat, item.subIdx, item.isDownbeat, item.totalBeats);
          }

          this.metroAnimFrameId = requestAnimationFrame(visualLoop);
        };
        this.metroAnimFrameId = requestAnimationFrame(visualLoop);
      }
    }

    stopMetronome() {
      this.isMetronomeRunning = false;
      if (this.metroWorker) {
        this.metroWorker.postMessage('stop');
      }
      if (this.metroTimerId) {
        clearInterval(this.metroTimerId);
        this.metroTimerId = null;
      }
      if (this.metroAnimFrameId) {
        cancelAnimationFrame(this.metroAnimFrameId);
        this.metroAnimFrameId = null;
      }
      this.metroVisualQueue = [];

      if (this.metroGain && this.ctx) {
        try {
          const now = this.ctx.currentTime;
          this.metroGain.gain.cancelScheduledValues(now);
          this.metroGain.gain.setValueAtTime(0, now);
        } catch (e) {}
      }
    }

    speakNumber(num) {
      if (!this.speechSynth) return;
      try {
        this.speechSynth.cancel();
        const utterance = new SpeechSynthesisUtterance(String(num));
        const bpm = this.currentBpm || 113;
        utterance.rate = Math.min(3.0, Math.max(1.1, 1.0 + (bpm / 120)));
        utterance.pitch = 1.2;
        utterance.volume = 0.8;
        this.speechSynth.speak(utterance);
      } catch (e) {}
    }

    speakWord(word) {
      if (!this.speechSynth) return;
      try {
        this.speechSynth.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        const bpm = this.currentBpm || 113;
        utterance.rate = Math.min(3.0, Math.max(1.1, 1.0 + (bpm / 120)));
        utterance.pitch = 1.0;
        utterance.volume = 0.7;
        this.speechSynth.speak(utterance);
      } catch (e) {}
    }

    async playRhythmSequence(rhythmItems, bpmOrFn = 100, loopCount = 1, onStep = null, onIteration = null, onFinished = null, startTime = null) {
      if (!this.initialized) await this.init();
      if (!rhythmItems || rhythmItems.length === 0) return;
      await this.resumeIfNeeded();

      this.stopRhythm();
      this.isRhythmPlaying = true;
      this.rhythmTimeouts = [];

      const totalTicks = rhythmItems.reduce((acc, it) => acc + (it.value || 32), 0);
      let currentLoop = 0;
      const isInfinite = (loopCount === Infinity || loopCount === 'infinite');
      const maxLoops = isInfinite ? Infinity : Math.max(1, parseInt(loopCount, 10) || 1);

      let nextIterationAudioTime = (typeof startTime === 'number' && startTime >= this.ctx.currentTime) ? startTime : (this.ctx.currentTime + 0.05);

      const scheduleIteration = () => {
        if (!this.isRhythmPlaying) return;

        if (currentLoop >= maxLoops) {
          const remainingSec = Math.max(0, nextIterationAudioTime - this.ctx.currentTime);
          this.rhythmLoopTimeout = setTimeout(() => {
            this.stopRhythm();
            if (onFinished) onFinished();
          }, remainingSec * 1000);
          return;
        }

        currentLoop++;
        if (onIteration) {
          onIteration(currentLoop, maxLoops);
        }

        const currentBpm = typeof bpmOrFn === 'function' ? bpmOrFn() : (bpmOrFn || 100);
        const safeBpm = Math.max(15, Math.min(240, parseInt(currentBpm, 10) || 113));
        const baseDuration = (60 / safeBpm);
        const patternDurationSeconds = (totalTicks / 32) * baseDuration;

        const iterAudioStart = Math.max(this.ctx.currentTime + 0.01, nextIterationAudioTime);
        let timeOffsetSec = 0;

        rhythmItems.forEach((item, index) => {
          const itemDuration = (item.value / 32) * baseDuration;
          const triggerTime = iterAudioStart + timeOffsetSec;

          if (!item.isRest && this.percussionSynth) {
            this.percussionSynth.triggerAttackRelease('C4', 0.08, triggerTime);
          }

          if (onStep) {
            const visualDelay = Math.max(0, (triggerTime - this.ctx.currentTime) * 1000);
            const timeoutId = setTimeout(() => {
              if (this.isRhythmPlaying) {
                onStep(index, currentLoop, item);
              }
            }, visualDelay);
            this.rhythmTimeouts.push(timeoutId);
          }

          timeOffsetSec += itemDuration;
        });

        nextIterationAudioTime = iterAudioStart + patternDurationSeconds;
        const scheduleDelay = Math.max(20, (nextIterationAudioTime - this.ctx.currentTime - 0.20) * 1000);
        this.rhythmLoopTimeout = setTimeout(scheduleIteration, scheduleDelay);
      };

      scheduleIteration();
    }

    stopRhythm() {
      this.isRhythmPlaying = false;
      if (this.rhythmLoopTimeout) {
        clearTimeout(this.rhythmLoopTimeout);
        this.rhythmLoopTimeout = null;
      }
      if (this.rhythmTimeouts && this.rhythmTimeouts.length > 0) {
        this.rhythmTimeouts.forEach(t => clearTimeout(t));
        this.rhythmTimeouts = [];
      }
    }
  }

  const audio = new AudioEngine();
  window.SongAudio = AudioEngine;
  window.audio = audio;

})(typeof window !== 'undefined' ? window : globalThis);
