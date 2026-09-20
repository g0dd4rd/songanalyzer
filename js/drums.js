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
        { id: 'clap', name: 'Handclap', short: 'CLP', category: 'perc', defaultGain: 0.85, color: 'emerald' }
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
      this.nodesInitialized = false;
    }

    init(audioContext, masterDestinationNode) {
      if (this.ctx && audioContext && this.ctx !== audioContext) {
        this.destroyNodes();
      }
      this.ctx = audioContext || this.ctx;
      if (!this.ctx) return;

      // Master drum bus: use Tone.Gain when available to bridge cleanly to Tone audio graph
      if (!this.masterNode) {
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
      }

      // Generate 2.5s looping noise buffer
      this.initNoiseBuffer();
      this.initPersistentNodes();
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

    initPersistentNodes() {
      if (!this.ctx || !this.masterNode || !this.noiseBuffer) return;
      if (this.nodesInitialized) return;

      try {
        // 1. Single looping white noise source (eliminates disposable BufferSourceNode allocations)
        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = this.noiseBuffer;
        this.noiseSource.loop = true;
        this.noiseSource.start(0);

        // 2. Kick Drum persistent oscillators & gains
        this.kickOsc = this.ctx.createOscillator();
        this.kickOsc.type = 'sine';
        this.kickOsc.frequency.setValueAtTime(38, 0);
        this.kickGain = this.ctx.createGain();
        this.kickGain.gain.setValueAtTime(0, 0);
        this.kickOsc.connect(this.kickGain);
        this.kickGain.connect(this.masterNode);
        this.kickOsc.start(0);

        this.kickClickOsc = this.ctx.createOscillator();
        this.kickClickOsc.type = 'triangle';
        this.kickClickOsc.frequency.setValueAtTime(60, 0);
        this.kickClickGain = this.ctx.createGain();
        this.kickClickGain.gain.setValueAtTime(0, 0);
        this.kickClickOsc.connect(this.kickClickGain);
        this.kickClickGain.connect(this.masterNode);
        this.kickClickOsc.start(0);

        // 3. Snare Drum persistent body tone & filtered noise
        this.snareToneOsc = this.ctx.createOscillator();
        this.snareToneOsc.type = 'triangle';
        this.snareToneOsc.frequency.setValueAtTime(80, 0);
        this.snareToneGain = this.ctx.createGain();
        this.snareToneGain.gain.setValueAtTime(0, 0);
        this.snareToneOsc.connect(this.snareToneGain);
        this.snareToneGain.connect(this.masterNode);
        this.snareToneOsc.start(0);

        this.snareNoiseFilter = this.ctx.createBiquadFilter();
        this.snareNoiseFilter.type = 'highpass';
        this.snareNoiseFilter.frequency.setValueAtTime(1100, 0);
        this.snareNoiseGain = this.ctx.createGain();
        this.snareNoiseGain.gain.setValueAtTime(0, 0);
        this.noiseSource.connect(this.snareNoiseFilter);
        this.snareNoiseFilter.connect(this.snareNoiseGain);
        this.snareNoiseGain.connect(this.masterNode);

        // 4. Closed Hi-Hat persistent bandpass filter & gain
        this.closedHatFilter = this.ctx.createBiquadFilter();
        this.closedHatFilter.type = 'bandpass';
        this.closedHatFilter.frequency.setValueAtTime(8500, 0);
        this.closedHatFilter.Q.value = 4.0;
        this.closedHatGain = this.ctx.createGain();
        this.closedHatGain.gain.setValueAtTime(0, 0);
        this.noiseSource.connect(this.closedHatFilter);
        this.closedHatFilter.connect(this.closedHatGain);
        this.closedHatGain.connect(this.masterNode);

        // 5. Open Hi-Hat persistent bandpass filter & gain
        this.openHatFilter = this.ctx.createBiquadFilter();
        this.openHatFilter.type = 'bandpass';
        this.openHatFilter.frequency.setValueAtTime(7500, 0);
        this.openHatFilter.Q.value = 3.2;
        this.openHatGain = this.ctx.createGain();
        this.openHatGain.gain.setValueAtTime(0, 0);
        this.noiseSource.connect(this.openHatFilter);
        this.openHatFilter.connect(this.openHatGain);
        this.openHatGain.connect(this.masterNode);

        // 6. Ride Cymbal (2-voice pool for natural shimmering decays without node churn)
        this.rideVoiceIndex = 0;
        this.rideVoices = [];
        for (let i = 0; i < 2; i++) {
          const osc1 = this.ctx.createOscillator();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(520, 0);
          const g1 = this.ctx.createGain();
          g1.gain.setValueAtTime(0, 0);
          osc1.connect(g1);
          g1.connect(this.masterNode);
          osc1.start(0);

          const osc2 = this.ctx.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(840, 0);
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(0, 0);
          osc2.connect(g2);
          g2.connect(this.masterNode);
          osc2.start(0);

          const filt = this.ctx.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.setValueAtTime(9200, 0);
          filt.Q.value = 2.5;
          const ng = this.ctx.createGain();
          ng.gain.setValueAtTime(0, 0);
          this.noiseSource.connect(filt);
          filt.connect(ng);
          ng.connect(this.masterNode);

          this.rideVoices.push({ osc1, g1, osc2, g2, filt, ng });
        }

        // 7. Crash Cymbal (2-voice pool for explosive overlapping washes)
        this.crashVoiceIndex = 0;
        this.crashVoices = [];
        for (let i = 0; i < 2; i++) {
          const filt = this.ctx.createBiquadFilter();
          filt.type = 'bandpass';
          filt.frequency.setValueAtTime(4500, 0);
          filt.Q.value = 1.8;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0, 0);
          this.noiseSource.connect(filt);
          filt.connect(g);
          g.connect(this.masterNode);

          this.crashVoices.push({ filt, g });
        }

        // 8. Cowbell persistent dual square waves & bandpass filter
        this.cowbellFilter = this.ctx.createBiquadFilter();
        this.cowbellFilter.type = 'bandpass';
        this.cowbellFilter.frequency.setValueAtTime(820, 0);
        this.cowbellFilter.Q.value = 3.6;
        this.cowbellGain = this.ctx.createGain();
        this.cowbellGain.gain.setValueAtTime(0, 0);
        this.cowbellFilter.connect(this.cowbellGain);
        this.cowbellGain.connect(this.masterNode);

        this.cowbellOsc1 = this.ctx.createOscillator();
        this.cowbellOsc1.type = 'square';
        this.cowbellOsc1.frequency.setValueAtTime(540, 0);
        this.cowbellOsc1.connect(this.cowbellFilter);
        this.cowbellOsc1.start(0);

        this.cowbellOsc2 = this.ctx.createOscillator();
        this.cowbellOsc2.type = 'square';
        this.cowbellOsc2.frequency.setValueAtTime(800, 0);
        this.cowbellOsc2.connect(this.cowbellFilter);
        this.cowbellOsc2.start(0);

        // 9. Handclap persistent bandpass filter & gain
        this.clapFilter = this.ctx.createBiquadFilter();
        this.clapFilter.type = 'bandpass';
        this.clapFilter.frequency.setValueAtTime(1300, 0);
        this.clapFilter.Q.value = 2.0;
        this.clapGain = this.ctx.createGain();
        this.clapGain.gain.setValueAtTime(0, 0);
        this.noiseSource.connect(this.clapFilter);
        this.clapFilter.connect(this.clapGain);
        this.clapGain.connect(this.masterNode);

        // 10. Clave / Woodblock persistent sine oscillator & gain
        this.claveOsc = this.ctx.createOscillator();
        this.claveOsc.type = 'sine';
        this.claveOsc.frequency.setValueAtTime(620, 0);
        this.claveGain = this.ctx.createGain();
        this.claveGain.gain.setValueAtTime(0, 0);
        this.claveOsc.connect(this.claveGain);
        this.claveGain.connect(this.masterNode);
        this.claveOsc.start(0);

        this.nodesInitialized = true;
      } catch (err) {
        console.warn('initPersistentNodes error:', err);
      }
    }

    ensureNodes() {
      if (this.nodesInitialized) return true;
      if (!this.ctx) {
        if (window.audio && window.audio.rawAudioContext) {
          this.init(window.audio.rawAudioContext);
        } else if (typeof Tone !== 'undefined' && Tone.context) {
          this.init(Tone.context.rawContext || Tone.context);
        }
      }
      if (this.ctx && !this.nodesInitialized) {
        if (!this.noiseBuffer) this.initNoiseBuffer();
        this.initPersistentNodes();
      }
      return this.nodesInitialized;
    }

    silenceAll() {
      if (!this.nodesInitialized || !this.ctx) return;
      const now = this.ctx.currentTime;
      const gains = [
        this.kickGain, this.kickClickGain,
        this.snareToneGain, this.snareNoiseGain,
        this.closedHatGain, this.openHatGain,
        this.cowbellGain, this.clapGain, this.claveGain
      ];
      if (this.rideVoices) {
        this.rideVoices.forEach(v => gains.push(v.g1, v.g2, v.ng));
      }
      if (this.crashVoices) {
        this.crashVoices.forEach(v => gains.push(v.g));
      }

      gains.forEach(g => {
        if (g && g.gain) {
          try {
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(0, now);
          } catch (e) {}
        }
      });
    }

    destroyNodes() {
      if (!this.nodesInitialized) return;
      try {
        if (this.noiseSource) {
          try { this.noiseSource.stop(); this.noiseSource.disconnect(); } catch (e) {}
          this.noiseSource = null;
        }
        const oscs = [
          this.kickOsc, this.kickClickOsc,
          this.snareToneOsc,
          this.cowbellOsc1, this.cowbellOsc2,
          this.claveOsc
        ];
        if (this.rideVoices) {
          this.rideVoices.forEach(v => {
            if (v.osc1) { try { v.osc1.stop(); v.osc1.disconnect(); } catch (e) {} }
            if (v.osc2) { try { v.osc2.stop(); v.osc2.disconnect(); } catch (e) {} }
          });
        }
        oscs.forEach(osc => {
          if (osc) {
            try { osc.stop(); osc.disconnect(); } catch (e) {}
          }
        });
      } catch (e) {}
      this.nodesInitialized = false;
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
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      // Sub-bass pitch sweep oscillator
      this.kickOsc.frequency.cancelScheduledValues(t);
      this.kickOsc.frequency.setValueAtTime(145, t);
      this.kickOsc.frequency.exponentialRampToValueAtTime(38, t + 0.065);

      this.kickGain.gain.cancelScheduledValues(t);
      this.kickGain.gain.setValueAtTime(gainVal * 1.1, t);
      this.kickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      this.kickGain.gain.setValueAtTime(0, t + 0.285);

      // Transient attack click for punch through speakers
      this.kickClickOsc.frequency.cancelScheduledValues(t);
      this.kickClickOsc.frequency.setValueAtTime(260, t);
      this.kickClickOsc.frequency.exponentialRampToValueAtTime(60, t + 0.015);

      this.kickClickGain.gain.cancelScheduledValues(t);
      this.kickClickGain.gain.setValueAtTime(gainVal * 0.7, t);
      this.kickClickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      this.kickClickGain.gain.setValueAtTime(0, t + 0.022);
    }

    // 2. Snare Drum (185Hz body tone + high-passed noise burst)
    playSnare(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('snare', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      // Body tone oscillator
      this.snareToneOsc.frequency.cancelScheduledValues(t);
      this.snareToneOsc.frequency.setValueAtTime(185, t);
      this.snareToneOsc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

      this.snareToneGain.gain.cancelScheduledValues(t);
      this.snareToneGain.gain.setValueAtTime(gainVal * 0.7, t);
      this.snareToneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      this.snareToneGain.gain.setValueAtTime(0, t + 0.125);

      // Snappy noise component
      this.snareNoiseGain.gain.cancelScheduledValues(t);
      this.snareNoiseGain.gain.setValueAtTime(gainVal * 0.85, t);
      this.snareNoiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      this.snareNoiseGain.gain.setValueAtTime(0, t + 0.185);
    }

    // 3. Closed Hi-Hat (Metallic cluster + choke group trigger)
    playClosedHat(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('closedHat', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      // Choke currently ringing open hats
      this.chokeOpenHats(t);

      this.closedHatGain.gain.cancelScheduledValues(t);
      this.closedHatGain.gain.setValueAtTime(gainVal * 0.75, t);
      this.closedHatGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      this.closedHatGain.gain.setValueAtTime(0, t + 0.05);
    }

    // 4. Open Hi-Hat (280ms wash with choke registration)
    playOpenHat(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('openHat', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      this.openHatGain.gain.cancelScheduledValues(t);
      this.openHatGain.gain.setValueAtTime(gainVal * 0.7, t);
      this.openHatGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      this.openHatGain.gain.setValueAtTime(0, t + 0.325);
    }

    chokeOpenHats(time) {
      if (!this.openHatGain || !this.ctx) return;
      const t = Math.max(this.ctx.currentTime, time || 0);
      try {
        this.openHatGain.gain.cancelScheduledValues(t);
        this.openHatGain.gain.setValueAtTime(Math.max(0.0001, this.openHatGain.gain.value), t);
        this.openHatGain.gain.linearRampToValueAtTime(0, t + 0.015);
      } catch (e) {
        try {
          this.openHatGain.gain.setValueAtTime(0, t);
        } catch (e2) {}
      }
    }

    // 5. Ride Cymbal (Dual-mode metallic bell ping at 520Hz & 840Hz + 1.1s shimmer)
    playRide(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('ride', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      const v = this.rideVoices[this.rideVoiceIndex % 2];
      this.rideVoiceIndex++;

      v.g1.gain.cancelScheduledValues(t);
      v.g1.gain.setValueAtTime(gainVal * 0.35, t);
      v.g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      v.g1.gain.setValueAtTime(0, t + 0.455);

      v.g2.gain.cancelScheduledValues(t);
      v.g2.gain.setValueAtTime(gainVal * 0.28, t);
      v.g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      v.g2.gain.setValueAtTime(0, t + 0.455);

      v.ng.gain.cancelScheduledValues(t);
      v.ng.gain.setValueAtTime(gainVal * 0.45, t);
      v.ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      v.ng.gain.setValueAtTime(0, t + 1.105);
    }

    // 6. Crash Cymbal (Explosive swept bandpass noise + 1.6s exponential wash)
    playCrash(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('crash', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      const v = this.crashVoices[this.crashVoiceIndex % 2];
      this.crashVoiceIndex++;

      v.filt.frequency.cancelScheduledValues(t);
      v.filt.frequency.setValueAtTime(4500, t);
      v.filt.frequency.exponentialRampToValueAtTime(7800, t + 0.15);

      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(gainVal * 0.85, t);
      v.g.gain.exponentialRampToValueAtTime(gainVal * 0.25, t + 0.2);
      v.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.65);
      v.g.gain.setValueAtTime(0, t + 1.655);
    }

    // 7. Cowbell (Authentic 808 dual square wave 540Hz & 800Hz + bandpass filter)
    playCowbell(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('cowbell', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      this.cowbellGain.gain.cancelScheduledValues(t);
      this.cowbellGain.gain.setValueAtTime(gainVal * 0.75, t);
      this.cowbellGain.gain.exponentialRampToValueAtTime(gainVal * 0.35, t + 0.04);
      this.cowbellGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      this.cowbellGain.gain.setValueAtTime(0, t + 0.325);
    }

    // 8. Handclap (Triple-burst micro-transients at 11ms intervals + reverb tail)
    playClap(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('clap', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      const masterClapVol = gainVal * 0.8;
      this.clapGain.gain.cancelScheduledValues(t);
      this.clapGain.gain.setValueAtTime(0, t);
      this.clapGain.gain.setValueAtTime(masterClapVol * 0.8, t + 0.002);
      this.clapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.010);
      this.clapGain.gain.setValueAtTime(masterClapVol * 0.9, t + 0.011);
      this.clapGain.gain.exponentialRampToValueAtTime(0.01, t + 0.021);
      this.clapGain.gain.setValueAtTime(masterClapVol, t + 0.022);
      this.clapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      this.clapGain.gain.setValueAtTime(0, t + 0.225);
    }

    // 9. Afro-Cuban Clave / High Woodblock (Dual resonant sine modes at 880Hz & 540Hz)
    playClave(time, velocity = 1.0) {
      const gainVal = this.getEffectiveGain('clave', velocity);
      if (gainVal <= 0 || !this.ctx) return;
      if (!this.ensureNodes()) return;

      const t = Math.max(this.ctx.currentTime, time || 0);

      this.claveOsc.frequency.cancelScheduledValues(t);
      this.claveOsc.frequency.setValueAtTime(880, t);
      this.claveOsc.frequency.exponentialRampToValueAtTime(620, t + 0.025);

      this.claveGain.gain.cancelScheduledValues(t);
      this.claveGain.gain.setValueAtTime(gainVal * 0.9, t);
      this.claveGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      this.claveGain.gain.setValueAtTime(0, t + 0.065);
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
      if (presetName && presetName.startsWith('user_')) return null;

      let meter = { num: 4, den: 4 };
      let subdiv = 4;
      let swingVal = 0.0;

      switch (presetName) {
        // Metal & Heavy
        case 'metalDoubleBass': // 4/4 Double Bass Thrash
          meter = { num: 4, den: 4 };
          subdiv = 4; // 16 steps of 16th notes
          swingVal = 0.0;
          break;

        case 'metalBreakdown': // 4/4 Groove Metal Breakdown
          meter = { num: 4, den: 4 };
          subdiv = 4; // 16 steps of 16th notes
          swingVal = 0.0;
          break;

        // Prog Rock
        case 'progRock78': // 7/8 Prog Rock Anthem (2 + 2 + 3)
          meter = { num: 7, den: 8 };
          subdiv = 2; // 14 steps of 16th notes (2 per 8th)
          swingVal = 0.0;
          break;

        case 'progRock98': // 9/8 Prog Rock Odyssey (3 + 3 + 3)
          meter = { num: 9, den: 8 };
          subdiv = 2; // 18 steps of 16th notes (2 per 8th)
          swingVal = 0.0;
          break;

        // Prog Metal & Djent
        case 'progMetalDjent': // 4/4 Djent 3:4 Polymeter
          meter = { num: 4, den: 4 };
          subdiv = 4; // 16 steps of 16th notes
          swingVal = 0.0;
          break;

        case 'progMetal54': // 5/4 Prog Metal Chug (3 + 2)
          meter = { num: 5, den: 4 };
          subdiv = 4; // 20 steps of 16th notes (4 per quarter)
          swingVal = 0.0;
          break;

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
        case 'metalDoubleBass':
          // Thrash / Speed Metal double bass drive
          this.setSteps('kick', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 1);
          this.setSteps('kick', [0, 4, 8, 12], 2); // heavy downbeat power accents
          this.setSteps('snare', [4, 12], 2);      // backbeats
          this.setSteps('snare', [15], 3);         // ghost pickup
          this.setSteps('crash', [0, 8], 2);       // crashes
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          this.setSteps('openHat', [14], 1);
          break;

        case 'metalBreakdown':
          // Half-time groove metal breakdown (Pantera, Lamb of God, Gojira)
          this.setSteps('crash', [0, 8], 2);
          this.setSteps('ride', [0, 4, 8, 12], 1);
          this.setSteps('snare', [8], 2);          // Half-time backbeat on Beat 3
          this.setSteps('snare', [6, 7, 15], 3);   // Ghost rolls
          this.setSteps('clap', [8], 1);           // Doubled snare slap
          this.setSteps('kick', [0, 2, 3, 5, 8, 10, 11, 13, 14], 1);
          this.setSteps('kick', [0, 3, 8, 10, 13], 2); // Heavy staccato chugs
          this.setSteps('closedHat', [0, 2, 4, 8, 10, 12], 1);
          this.setSteps('openHat', [7, 15], 2);    // Sizzle pickups into the slams
          break;

        case 'progRock78':
          // 7/8 Prog Rock Anthem (Rush, Pink Floyd, Tool - 2+2+3 grouping: 14 steps)
          this.setSteps('crash', [0], 2);
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12], 1);
          this.setSteps('ride', [0, 4, 8], 2);     // Group heads bell accents
          this.setSteps('kick', [0, 2, 6, 8, 12], 1);
          this.setSteps('kick', [0, 8], 2);
          this.setSteps('snare', [4, 10], 2);      // Asymmetric backbeats
          this.setSteps('snare', [8, 13], 3);      // Ghost notes
          this.setSteps('cowbell', [0, 4, 8, 11], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12], 1);
          break;

        case 'progRock98':
          // 9/8 Prog Rock Odyssey (Genesis 'Apocalypse in 9/8', King Crimson - 3+3+3 grouping: 18 steps)
          this.setSteps('crash', [0, 12], 2);
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12, 14, 16], 1);
          this.setSteps('ride', [0, 6, 12], 2);    // Triple compound beat bells
          this.setSteps('kick', [0, 4, 6, 10, 12, 14], 1);
          this.setSteps('kick', [0, 6, 12], 2);
          this.setSteps('snare', [6, 16], 2);      // Dynamic backbeats
          this.setSteps('snare', [2, 10], 3);      // Ghost taps
          this.setSteps('cowbell', [0, 6, 12, 15], 1);
          this.setSteps('openHat', [16], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12, 14], 1);
          break;

        case 'progMetalDjent':
          // Djent 3:4 Polymeter over 4/4 (Meshuggah, Animals As Leaders)
          this.setSteps('crash', [0], 2);
          this.setSteps('ride', [0, 4, 8, 12], 2); // 4/4 Quarter pulse anchor
          this.setSteps('snare', [4, 12], 2);      // 4/4 Backbeat anchor
          this.setSteps('snare', [7, 15], 3);      // Ghost polyrhythms
          this.setSteps('clap', [12], 1);
          // Kick plays repeating 3-sixteenth djent bursts across 16 steps:
          this.setSteps('kick', [0, 1, 3, 4, 6, 7, 9, 10, 12, 14, 15], 1);
          this.setSteps('kick', [0, 3, 6, 9, 12, 14], 2);
          this.setSteps('closedHat', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 1);
          this.setSteps('openHat', [11], 1);
          break;

        case 'progMetal54':
          // 5/4 Prog Metal Chug (Tool 'The Grudge', Dream Theater - 3+2 grouping: 20 steps)
          this.setSteps('crash', [0, 12], 2);
          this.setSteps('ride', [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], 1);
          this.setSteps('ride', [0, 6, 12, 16], 2);
          this.setSteps('kick', [0, 1, 4, 6, 7, 10, 12, 13, 16, 17], 1);
          this.setSteps('kick', [0, 6, 12, 16], 2);
          this.setSteps('snare', [4, 10, 16], 2);  // Staggered odd-meter backbeats
          this.setSteps('snare', [9, 15, 19], 3);  // Ghost pickups
          this.setSteps('cowbell', [0, 6, 12], 1);
          this.setSteps('openHat', [18], 1);
          this.setSteps('closedHat', [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], 1);
          break;

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
    start(onVisualStep = null, startTime = null) {
      if (this.isPlaying) return;
      if (!this.synth.ctx) return;

      this.isPlaying = true;
      this.currentStep = 0;
      this.visualQueue = [];
      const now = this.synth.ctx.currentTime;
      this.nextStepAudioTime = (typeof startTime === 'number' && startTime >= now) ? startTime : (now + 0.04);

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
      if (this.synth && typeof this.synth.silenceAll === 'function') {
        this.synth.silenceAll();
      }
    }

    // Calculate exact audio timestamp of the next measure downbeat (step 0)
    // Used for quantized transport synchronization across chords, clave, and drums
    getNextDownbeatAudioTime() {
      if (!this.isPlaying || !this.synth || !this.synth.ctx) return null;
      const currentTime = this.synth.ctx.currentTime;
      const stepCount = this.getStepCount();
      const beatSec = (60 / this.bpm) * (4 / (this.timeSignature.den || 4));
      const stepInterval = beatSec / (this.subdivision || 4);

      const nextStepIdx = this.currentStep % stepCount;
      const stepsUntilDownbeat = (stepCount - nextStepIdx) % stepCount;
      let targetDownbeatTime = this.nextStepAudioTime + (stepsUntilDownbeat * stepInterval);

      if (targetDownbeatTime < currentTime + 0.02) {
        targetDownbeatTime += stepCount * stepInterval;
      }
      return targetDownbeatTime;
    }

    // -------------------------------------------------------------
    // User Groove Storage & Management (localStorage + JSON)
    // -------------------------------------------------------------
    saveUserGroove(name) {
      const cleanName = (name || '').trim() || `Groove ${new Date().toLocaleDateString()}`;
      const id = 'groove_' + Date.now();
      const groove = {
        id,
        name: cleanName,
        bpm: this.bpm,
        timeSignature: { ...this.timeSignature },
        subdivision: this.subdivision,
        swing: this.swing,
        pattern: JSON.parse(JSON.stringify(this.pattern)),
        createdAt: Date.now()
      };

      const grooves = this.getUserGrooves();
      grooves.push(groove);
      try {
        localStorage.setItem('song_analyzer_user_grooves', JSON.stringify(grooves));
      } catch (e) {
        console.warn('Unable to save to localStorage:', e);
      }
      return groove;
    }

    getUserGrooves() {
      try {
        const raw = localStorage.getItem('song_analyzer_user_grooves');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    loadUserGroove(id) {
      const grooves = this.getUserGrooves();
      const groove = grooves.find(g => g.id === id);
      if (!groove) return null;

      this.setTimeSignature(groove.timeSignature || { num: 4, den: 4 }, groove.subdivision || 4);
      if (groove.bpm) this.setBpm(groove.bpm);
      if (typeof groove.swing === 'number') this.swing = groove.swing;
      if (groove.pattern) {
        this.synth.trackDefs.forEach(track => {
          if (groove.pattern[track.id]) {
            this.pattern[track.id] = [...groove.pattern[track.id]];
          }
        });
      }
      return groove;
    }

    deleteUserGroove(id) {
      const grooves = this.getUserGrooves().filter(g => g.id !== id);
      try {
        localStorage.setItem('song_analyzer_user_grooves', JSON.stringify(grooves));
      } catch (e) {}
      return grooves;
    }

    exportUserGroovesJson() {
      const grooves = this.getUserGrooves();
      return JSON.stringify(grooves, null, 2);
    }

    importUserGroovesJson(jsonString) {
      try {
        const incoming = JSON.parse(jsonString);
        if (!Array.isArray(incoming)) return false;
        const current = this.getUserGrooves();
        const existingIds = new Set(current.map(g => g.id));
        let added = 0;
        incoming.forEach(g => {
          if (g && g.name && g.pattern) {
            if (!g.id || existingIds.has(g.id)) {
              g.id = 'groove_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            }
            current.push(g);
            existingIds.add(g.id);
            added++;
          }
        });
        localStorage.setItem('song_analyzer_user_grooves', JSON.stringify(current));
        return added;
      } catch (e) {
        console.error('Failed to parse grooves JSON:', e);
        return false;
      }
    }
  }

  // Export to global window namespace
  window.SongDrums = {
    DrumSynth,
    BeatSequencer
  };

})(typeof window !== 'undefined' ? window : globalThis);
