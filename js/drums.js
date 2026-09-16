/**
 * Song Analyzer - Adaptive Grid Drum Machine & Beat Builder (js/drums.js)
 * 100% Offline Procedural Web Audio Synthesis & Adaptive Step Sequencer
 * 
 * 9 Hybrid Drum & Percussion Voices:
 * 1. Kick (Analog sub-frequency sweep 145Hz -> 38Hz + transient click)
 * 2. Snare (Resonant body 185Hz + high-pass white noise crack)
 * 3. Closed Hi-Hat (6-oscillator metallic cluster + 35ms decay, triggers choke)
 * 4. Open Hi-Hat (Metallic cluster + 280ms wash with closed-hat choke group)
 * 5. Ride Cymbal (Dual-mode bell ping at 520Hz & 840Hz + 1.1s shimmer)
 * 6. Crash Cymbal (Explosive swept bandpass noise + 1.6s exponential wash)
 * 7. Cowbell (Authentic 808 dual square wave 540Hz & 800Hz + bandpass filter)
 * 8. Handclap (Triple-burst micro-transients at 11ms intervals + reverb tail)
 * 9. Clave / Woodblock (Dual resonant sine modes at 880Hz & 540Hz)
 */

(function (window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. Procedural Web Audio Drum Synthesizer
  // -------------------------------------------------------------
  class DrumSynth {
    constructor() {
      this.ctx = null;
      this.masterNode = null;
      this.activeOpenHats = []; // For choke group

      this.trackDefs = [
        { id: 'kick', name: 'Kick', short: 'KIK', category: 'core', defaultGain: 1.0, color: 'cyan' },
        { id: 'snare', name: 'Snare', short: 'SNR', category: 'core', defaultGain: 0.95, color: 'cyan' },
        { id: 'closedHat', name: 'Closed Hat', short: 'CH', category: 'cymbals', defaultGain: 0.85, color: 'amber' },
        { id: 'openHat', name: 'Open Hat', short: 'OH', category: 'cymbals', defaultGain: 0.80, color: 'amber' },
        { id: 'ride', name: 'Ride Cymbal', short: 'RD', category: 'cymbals', defaultGain: 0.82, color: 'amber' },
        { id: 'crash', name: 'Crash Cymbal', short: 'CR', category: 'cymbals', defaultGain: 0.88, color: 'amber' },
        { id: 'cowbell', name: 'Cowbell', short: 'CB', category: 'perc', defaultGain: 0.85, color: 'purple' },
        { id: 'clap', name: 'Handclap', short: 'CLP', category: 'perc', defaultGain: 0.85, color: 'emerald' },
        { id: 'clave', name: 'Clave', short: 'CLV', category: 'perc', defaultGain: 0.85, color: 'emerald' }
      ];

      // Track channel states (volume, mute, solo)
      this.channelStates = {};
      this.trackDefs.forEach(t => {
        this.channelStates[t.id] = {
          mute: false,
          solo: false,
          gain: t.defaultGain
        };
      });

      // Pre-rendered white noise buffer for crisp snares, claps, and cymbals
      this.noiseBuffer = null;
    }

    init(audioContext, masterDestinationNode) {
      if (this.ctx && this.masterNode && this.noiseBuffer) return;
      this.ctx = audioContext;
      if (!this.ctx) return;

      // Master drum bus: use Tone.Gain when available to bridge cleanly to Tone audio graph
      if (typeof Tone !== 'undefined' && Tone.Gain) {
        this.masterToneGain = new Tone.Gain(0.92);
        const dest = masterDestinationNode || (window.audio && window.audio.masterVolume) || Tone.getDestination();
        this.masterToneGain.connect(dest);
        this.masterNode = this.masterToneGain.input || this.masterToneGain;
      } else {
        this.masterNode = this.ctx.createGain();
        this.masterNode.gain.value = 0.92;
        const dest = masterDestinationNode || this.ctx.destination;
        if (typeof Tone !== 'undefined' && typeof Tone.connect === 'function') {
          Tone.connect(this.masterNode, dest);
        } else {
          this.masterNode.connect(dest);
        }
      }

      // Generate 2.5s looping noise buffer
      this.initNoiseBuffer();
    }

    initNoiseBuffer() {
      if (!this.ctx || this.noiseBuffer) return;
      const sr = this.ctx.sampleRate || 44100;
      const length = sr * 2.5;
      const buffer = this.ctx.createBuffer(1, length, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }

    isAudible(trackId) {
      const state = this.channelStates[trackId];
      if (!state) return true;
      if (state.mute) return false;

      // Check if any track has solo active
      const hasAnySolo = Object.values(this.channelStates).some(s => s.solo);
      if (hasAnySolo && !state.solo) return false;

      return true;
    }

    getEffectiveGain(trackId, baseVelocity = 1.0) {
      if (!this.isAudible(trackId)) return 0;
      const trackState = this.channelStates[trackId];
      const trackVol = trackState ? trackState.gain : 1.0;
      return Math.max(0, Math.min(1.5, baseVelocity * trackVol));
    }

    // 1. Kick Drum (Punchy pitch drop 145Hz -> 38Hz + transient click)
    playKick(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('kick', velocity);
      if (gainVal <= 0 || !this.ctx) return;

      const t = Math.max(this.ctx.currentTime, time);

      // Sub-bass pitch sweep oscillator
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.065);

      oscGain.gain.setValueAtTime(gainVal * 1.1, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(oscGain);
      oscGain.connect(this.masterNode);

      // Transient attack click for punch through speakers
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();

      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(260, t);
      clickOsc.frequency.exponentialRampToValueAtTime(60, t + 0.015);

      clickGain.gain.setValueAtTime(gainVal * 0.7, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      clickOsc.connect(clickGain);
      clickGain.connect(this.masterNode);

      osc.start(t);
      osc.stop(t + 0.3);
      clickOsc.start(t);
      clickOsc.stop(t + 0.025);
    }

    // 2. Snare Drum (185Hz body tone + high-passed noise burst)
    playSnare(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('snare', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      // Body tone oscillator
      const toneOsc = this.ctx.createOscillator();
      const toneGain = this.ctx.createGain();

      toneOsc.type = 'triangle';
      toneOsc.frequency.setValueAtTime(185, t);
      toneOsc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

      toneGain.gain.setValueAtTime(gainVal * 0.7, t);
      toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      toneOsc.connect(toneGain);
      toneGain.connect(this.masterNode);

      // Snappy noise component
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1100, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(gainVal * 0.85, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterNode);

      toneOsc.start(t);
      toneOsc.stop(t + 0.13);
      noiseSource.start(t);
      noiseSource.stop(t + 0.19);
    }

    // 3. Closed Hi-Hat (Metallic cluster + choke group trigger)
    playClosedHat(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('closedHat', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      // Choke currently ringing open hats
      this.chokeOpenHats(t);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(8500, t);
      filter.Q.value = 4.0;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal * 0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterNode);

      noise.start(t);
      noise.stop(t + 0.05);
    }

    // 4. Open Hi-Hat (280ms wash with choke registration)
    playOpenHat(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('openHat', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(7500, t);
      filter.Q.value = 3.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal * 0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterNode);

      // Register for choking
      this.activeOpenHats.push({ gainNode: gain, stopTime: t + 0.33 });

      noise.start(t);
      noise.stop(t + 0.33);
    }

    chokeOpenHats(time) {
      const now = time || (this.ctx ? this.ctx.currentTime : 0);
      this.activeOpenHats = this.activeOpenHats.filter(item => {
        if (item.stopTime > now) {
          try {
            item.gainNode.gain.cancelScheduledValues(now);
            item.gainNode.gain.setValueAtTime(item.gainNode.gain.value, now);
            item.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
          } catch (e) {}
          return false;
        }
        return false;
      });
    }

    // 5. Ride Cymbal (Dual-mode metallic bell ping at 520Hz & 840Hz + 1.1s shimmer)
    playRide(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('ride', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      // 1. Resonant bell ping modes
      const bellFreqs = [520, 840];
      bellFreqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const bellVol = gainVal * (idx === 0 ? 0.35 : 0.28);
        g.gain.setValueAtTime(bellVol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

        osc.connect(g);
        g.connect(this.masterNode);
        osc.start(t);
        osc.stop(t + 0.5);
      });

      // 2. High metallic sizzle wash
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(9200, t);
      filter.Q.value = 2.5;

      const washGain = this.ctx.createGain();
      washGain.gain.setValueAtTime(gainVal * 0.45, t);
      washGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

      noise.connect(filter);
      filter.connect(washGain);
      washGain.connect(this.masterNode);

      noise.start(t);
      noise.stop(t + 1.15);
    }

    // 6. Crash Cymbal (Explosive swept bandpass noise + 1.6s exponential wash)
    playCrash(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('crash', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      // Swept resonant bandpass for initial explosion
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(4500, t);
      filter.frequency.exponentialRampToValueAtTime(7800, t + 0.15);
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal * 0.85, t);
      gain.gain.exponentialRampToValueAtTime(gainVal * 0.25, t + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.65);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterNode);

      noise.start(t);
      noise.stop(t + 1.7);
    }

    // 7. Cowbell (Authentic 808 dual square wave 540Hz & 800Hz + bandpass filter)
    playCowbell(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('cowbell', velocity);
      if (gainVal <= 0 || !this.ctx) return;

      const t = Math.max(this.ctx.currentTime, time);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(540, t);
      osc2.frequency.setValueAtTime(800, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(820, t);
      filter.Q.value = 3.6;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal * 0.75, t);
      gain.gain.exponentialRampToValueAtTime(gainVal * 0.35, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterNode);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.34);
      osc2.stop(t + 0.34);
    }

    // 8. Handclap (Triple-burst micro-transients at 11ms intervals + reverb tail)
    playClap(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('clap', velocity);
      if (gainVal <= 0 || !this.ctx || !this.noiseBuffer) return;

      const t = Math.max(this.ctx.currentTime, time);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300, t);
      filter.Q.value = 2.0;

      const gain = this.ctx.createGain();
      const masterClapVol = gainVal * 0.8;

      // 3 micro-pulses
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(masterClapVol * 0.8, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.010);
      gain.gain.setValueAtTime(masterClapVol * 0.9, t + 0.011);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.021);
      gain.gain.setValueAtTime(masterClapVol, t + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterNode);

      noise.start(t);
      noise.stop(t + 0.24);
    }

    // 9. Afro-Cuban Clave / High Woodblock (Dual resonant sine modes at 880Hz & 540Hz)
    playClave(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('clave', velocity);
      if (gainVal <= 0 || !this.ctx) return;

      const t = Math.max(this.ctx.currentTime, time);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.025);

      gain.gain.setValueAtTime(gainVal * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.masterNode);

      osc.start(t);
      osc.stop(t + 0.07);
    }

    playVoice(voiceId, time, velocity = 1.0) {
      switch (voiceId) {
        case 'kick': this.playKick(time, velocity); break;
        case 'snare': this.playSnare(time, velocity); break;
        case 'closedHat': this.playClosedHat(time, velocity); break;
        case 'openHat': this.playOpenHat(time, velocity); break;
        case 'ride': this.playRide(time, velocity); break;
        case 'crash': this.playCrash(time, velocity); break;
        case 'cowbell': this.playCowbell(time, velocity); break;
        case 'clap': this.playClap(time, velocity); break;
        case 'clave': this.playClave(time, velocity); break;
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Adaptive Step Sequencer Grid Engine
  // -------------------------------------------------------------
  class BeatSequencer {
    constructor(drumSynth) {
      this.synth = drumSynth;
      this.isPlaying = false;
      this.bpm = 113;
      this.timeSignature = { num: 4, den: 4 };
      this.subdivision = 4; // 16th notes by default
      this.swing = 0.0;     // 0.0 to 0.65

      this.currentStep = 0;
      this.nextStepAudioTime = 0;
      this.timerId = null;
      this.visualQueue = [];
      this.animFrameId = null;

      // 9 tracks x dynamic step count matrix
      // Step values: 0 = Off, 1 = Normal (1.0 vel), 2 = Accent (1.35 vel), 3 = Ghost (0.35 vel)
      this.pattern = {};
      this.initPattern();
    }

    getStepCount() {
      const num = Math.max(1, parseInt(this.timeSignature.num, 10) || 4);
      const sub = Math.max(1, parseInt(this.subdivision, 10) || 4);
      return Math.max(1, num * sub);
    }

    initPattern() {
      const stepCount = this.getStepCount();
      this.synth.trackDefs.forEach(track => {
        if (!this.pattern[track.id] || this.pattern[track.id].length !== stepCount) {
          const old = this.pattern[track.id] || [];
          const arr = new Array(stepCount).fill(0);
          for (let i = 0; i < Math.min(old.length, stepCount); i++) {
            arr[i] = old[i];
          }
          this.pattern[track.id] = arr;
        }
      });
    }

    clearPattern() {
      const stepCount = this.getStepCount();
      this.synth.trackDefs.forEach(track => {
        this.pattern[track.id] = new Array(stepCount).fill(0);
      });
    }

    cycleStep(trackId, stepIndex) {
      if (!this.pattern[trackId] || stepIndex < 0 || stepIndex >= this.pattern[trackId].length) return 0;
      // Cycle: 0 (Off) -> 1 (Normal) -> 2 (Accent) -> 3 (Ghost) -> 0 (Off)
      const current = this.pattern[trackId][stepIndex];
      const next = (current + 1) % 4;
      this.pattern[trackId][stepIndex] = next;
      return next;
    }

    setBpm(bpm) {
      this.bpm = Math.max(15, Math.min(240, parseInt(bpm, 10) || 113));
    }

    setTimeSignature(sig, subdivision) {
      const num = Math.max(1, parseInt(sig.num, 10) || 4);
      const den = Math.max(1, parseInt(sig.den, 10) || 4);
      this.timeSignature = { num, den };
      if (subdivision) {
        this.subdivision = Math.max(1, parseInt(subdivision, 10) || 4);
      }
      this.currentStep = 0;
      this.initPattern();
    }

    // Curated Groove Presets (The Rhythm Code)
    // Presets self-determine their meter, subdivision, swing, and pattern
    loadPreset(presetName) {
      let meter = { num: 4, den: 4 };
      let subdiv = 4;
      let swingVal = 0.0;

      switch (presetName) {
        case 'balkan78': // 7/8 Balkan Râčenica (3 + 2 + 2)
          meter = { num: 7, den: 8 };
          subdiv = 2; // 14 steps of 16th notes (2 per 8th)
          swingVal = 0.0;
          break;

        case 'takeFive54': // 5/4 Dave Brubeck (3 + 2)
          meter = { num: 5, den: 4 };
          subdiv = 4; // 20 steps of 16th notes (4 per quarter)
          swingVal = 0.45;
          break;

        case 'afro68': // 6/8 Afro-Cuban Bembé
          meter = { num: 6, den: 8 };
          subdiv = 2; // 12 steps of 16th notes (2 per 8th)
          swingVal = 0.0;
          break;

        case 'waltz34': // 3/4 Viennese Waltz
          meter = { num: 3, den: 4 };
          subdiv = 4; // 12 steps of 16th notes (4 per quarter)
          swingVal = 0.0;
          break;

        case 'funk': // 4/4 Syncopated Funk & Ghost Snare
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.22;
          break;

        case 'latinCowbell': // Latin Mambo & 808 Cowbell
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.05;
          break;

        case 'jazzSwing': // Jazz Ride Swing with Hat Chick on 2 & 4
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.58;
          break;

        case 'bossaNova': // Bossa Nova
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.08;
          break;

        case 'fourOnFloor': // 4-on-the-Floor Disco / House
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.0;
          break;

        case 'rock': // Classic 4/4 Power Rock Drive
        default:
          meter = { num: 4, den: 4 };
          subdiv = 4;
          swingVal = 0.0;
          break;
      }

      // Automatically configure meter and step count for this preset
      this.setTimeSignature(meter, subdiv);
      this.swing = swingVal;
      this.clearPattern();

      switch (presetName) {
        case 'rock':
          this.setSteps('crash', [0], 2);
          this.setSteps('kick', [0, 8, 10], 2);
          this.setSteps('snare', [4, 12], 2);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          break;

        case 'funk':
          this.setSteps('kick', [0, 6, 10], 2);
          this.setSteps('snare', [4, 12], 2);
          this.setSteps('snare', [7, 11, 15], 3); // ghost notes
          this.setSteps('closedHat', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 1);
          this.setSteps('openHat', [14], 1);
          this.setSteps('clap', [4, 12], 1);
          break;

        case 'latinCowbell':
          this.setSteps('cowbell', [0, 3, 6, 8, 11, 14], 2);
          this.setSteps('clave', [0, 3, 6, 10, 12], 2); // Son Clave 3:2
          this.setSteps('kick', [0, 6, 8, 14], 1);
          this.setSteps('snare', [4, 12], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          break;

        case 'jazzSwing':
          this.setSteps('ride', [0, 4, 6, 8, 12, 14], 2);
          this.setSteps('closedHat', [4, 12], 1); // chick on 2 & 4
          this.setSteps('kick', [0, 4, 8, 12], 3); // soft feathering
          this.setSteps('snare', [11], 3);         // ghost brush
          break;

        case 'balkan78':
          // 7/8 Balkan Râčenica (3 + 2 + 2): pulses at steps 0, 6, 10
          this.setSteps('kick', [0, 6, 10], 2);
          this.setSteps('snare', [6, 10], 2);
          this.setSteps('ride', [0, 6, 10], 2);
          this.setSteps('cowbell', [0, 3, 6, 10], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12], 1);
          break;

        case 'takeFive54':
          // 5/4 Dave Brubeck (3 + 2): 12 steps + 8 steps = 20 steps
          this.setSteps('ride', [0, 4, 6, 8, 12, 14, 16, 18], 2);
          this.setSteps('kick', [0, 12], 2);
          this.setSteps('snare', [8, 16], 2);
          this.setSteps('closedHat', [4, 12], 1);
          break;

        case 'afro68':
          // 6/8 Afro-Cuban Bembé: 12 steps (12/8 bell pattern: 0, 2, 4, 5, 7, 9, 11)
          this.setSteps('cowbell', [0, 2, 4, 5, 7, 9, 11], 2);
          this.setSteps('clave', [0, 5, 7], 1);
          this.setSteps('kick', [0, 6], 2);
          this.setSteps('snare', [6], 2);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10], 1);
          break;

        case 'waltz34':
          // 3/4 Waltz: 12 steps (3 beats x 4 16ths)
          this.setSteps('kick', [0], 2);
          this.setSteps('snare', [4, 8], 2);
          this.setSteps('ride', [0, 4, 8], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10], 1);
          break;

        case 'bossaNova':
          this.setSteps('clave', [0, 3, 6, 10, 12], 1);
          this.setSteps('kick', [0, 6, 8, 14], 2);
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          this.setSteps('snare', [4, 12], 3);
          break;

        case 'fourOnFloor':
          this.setSteps('kick', [0, 4, 8, 12], 2);
          this.setSteps('snare', [4, 12], 2);
          this.setSteps('clap', [4, 12], 1);
          this.setSteps('openHat', [2, 6, 10, 14], 2);
          this.setSteps('closedHat', [0, 4, 8, 12], 1);
          this.setSteps('cowbell', [0, 6, 8, 12, 14], 1);
          break;
      }

      return {
        preset: presetName,
        timeSignature: meter,
        subdivision: subdiv,
        swing: this.swing
      };
    }

    setSteps(trackId, indices, value = 1) {
      if (!this.pattern[trackId]) return;
      indices.forEach(idx => {
        if (idx >= 0 && idx < this.pattern[trackId].length) {
          this.pattern[trackId][idx] = value;
        }
      });
    }

    // Playback loop with Web Audio lookahead scheduling
    start(onVisualStep = null) {
      if (this.isPlaying) return;
      if (!this.synth.ctx) return;

      this.isPlaying = true;
      this.currentStep = 0;
      this.visualQueue = [];
      const now = this.synth.ctx.currentTime;
      this.nextStepAudioTime = now + 0.04;

      const scheduleAheadSec = 0.25; // 250ms lookahead buffer

      const scheduler = () => {
        if (!this.isPlaying || !this.synth.ctx) return;
        const currentTime = this.synth.ctx.currentTime;
        const stepCount = this.getStepCount();

        // Exact duration of one beat of (1 / den): (60 / BPM) * (4 / den)
        // Each beat contains `subdivision` steps, so each step lasts: beatSec / subdivision
        const beatSec = (60 / this.bpm) * (4 / (this.timeSignature.den || 4));
        const stepInterval = beatSec / (this.subdivision || 4);
        const safeInterval = Math.max(0.015, stepInterval || 0.125);

        // Catch up if deeply suspended
        if (this.nextStepAudioTime < currentTime - 0.5) {
          this.nextStepAudioTime = currentTime + 0.02;
        }

        while (this.nextStepAudioTime < currentTime + scheduleAheadSec) {
          const stepIdx = this.currentStep % stepCount;

          // Compute swing offset: shift every odd step
          let stepScheduledTime = this.nextStepAudioTime;
          const isOddStep = (stepIdx % 2 === 1);
          if (isOddStep && this.swing > 0.01) {
            stepScheduledTime += safeInterval * this.swing * 0.65;
          }
          stepScheduledTime = Math.max(currentTime, stepScheduledTime);

          // Trigger active drum voices on this step
          this.synth.trackDefs.forEach(track => {
            const state = this.pattern[track.id] ? this.pattern[track.id][stepIdx] : 0;
            if (state > 0) {
              let vel = 1.0;
              if (state === 2) vel = 1.35; // Accent
              else if (state === 3) vel = 0.35; // Ghost
              this.synth.playVoice(track.id, stepScheduledTime, vel);
            }
          });

          // Queue visual cursor
          if (onVisualStep) {
            while (this.visualQueue.length > 40) this.visualQueue.shift();
            this.visualQueue.push({ time: stepScheduledTime, step: stepIdx });
          }

          this.nextStepAudioTime += safeInterval;
          this.currentStep++;
        }
      };

      // Run initial schedule burst
      scheduler();
      this.timerId = setInterval(scheduler, 25);

      // Visual playhead flasher loop
      if (onVisualStep) {
        const visualLoop = () => {
          if (!this.isPlaying || !this.synth.ctx) return;
          const currentAudioTime = this.synth.ctx.currentTime;

          while (this.visualQueue.length > 1 && this.visualQueue[0].time < currentAudioTime - 0.2) {
            this.visualQueue.shift();
          }

          while (this.visualQueue.length > 0 && this.visualQueue[0].time <= currentAudioTime + 0.02) {
            const item = this.visualQueue.shift();
            onVisualStep(item.step);
          }

          this.animFrameId = requestAnimationFrame(visualLoop);
        };
        this.animFrameId = requestAnimationFrame(visualLoop);
      }
    }

    stop() {
      this.isPlaying = false;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      this.visualQueue = [];
    }
  }

  // Export to global window namespace
  window.SongDrums = {
    DrumSynth,
    BeatSequencer
  };

})(typeof window !== 'undefined' ? window : globalThis);
