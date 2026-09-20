/**
 * Song Analyzer - Chromatic Strobe & Needle Tuner (js/tuner.js)
 * 100% Offline Client-Side Pitch Detection Engine
 * 
 * Features:
 * - Real-time microphone/instrument input via Web Audio API (getUserMedia)
 * - Time-domain autocorrelation with parabolic interpolation for sub-cent accuracy
 * - Calibrated reference pitch (A4 = 440 Hz, adjustable 432 Hz - 446 Hz)
 * - Virtual Peterson-style strobe ring visualizer (freezes when in tune)
 * - Smooth cents needle (-50 to +50 cents) with in-tune emerald lock (+/- 3 cents)
 * - Comprehensive instrument tuning presets (6/7/8 guitar, 4/5/6 bass, ukulele, Drop D, DADGAD, Open G/D, Eb)
 * - Tone generator for audible reference pitch
 * - Direct sync with Song Analyzer's Canvas Fretboard
 */

(function (window) {
  'use strict';

  const NOTE_STRINGS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Built-in Instrument & Alternate Tuning Presets
  const TUNING_PRESETS = {
    // 6-String Guitar
    'guitar_std': {
      name: '6-String Guitar (Standard EADGBE)',
      instrument: 'guitar',
      strings: [
        { note: 'E2', freq: 82.41, pc: 4 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'B3', freq: 246.94, pc: 11 },
        { note: 'E4', freq: 329.63, pc: 4 }
      ]
    },
    'guitar_drop_d': {
      name: '6-String Guitar (Drop D)',
      instrument: 'guitar',
      strings: [
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'B3', freq: 246.94, pc: 11 },
        { note: 'E4', freq: 329.63, pc: 4 }
      ]
    },
    'guitar_dadgad': {
      name: '6-String Guitar (DADGAD)',
      instrument: 'guitar',
      strings: [
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'A3', freq: 220.00, pc: 9 },
        { note: 'D4', freq: 293.66, pc: 2 }
      ]
    },
    'guitar_open_d': {
      name: '6-String Guitar (Open D: DADF#AD)',
      instrument: 'guitar',
      strings: [
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'F#3', freq: 185.00, pc: 6 },
        { note: 'A3', freq: 220.00, pc: 9 },
        { note: 'D4', freq: 293.66, pc: 2 }
      ]
    },
    'guitar_open_g': {
      name: '6-String Guitar (Open G: DGDGBD)',
      instrument: 'guitar',
      strings: [
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'G2', freq: 98.00, pc: 7 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'B3', freq: 246.94, pc: 11 },
        { note: 'D4', freq: 293.66, pc: 2 }
      ]
    },
    'guitar_half_step': {
      name: '6-String Guitar (Half-Step Down Eb)',
      instrument: 'guitar',
      strings: [
        { note: 'Eb2', freq: 77.78, pc: 3 },
        { note: 'Ab2', freq: 103.83, pc: 8 },
        { note: 'Db3', freq: 138.59, pc: 1 },
        { note: 'Gb3', freq: 185.00, pc: 6 },
        { note: 'Bb3', freq: 233.08, pc: 10 },
        { note: 'Eb4', freq: 311.13, pc: 3 }
      ]
    },
    // 7 & 8-String Guitars
    'guitar_7str': {
      name: '7-String Guitar (Low B: BEADGBE)',
      instrument: 'guitar',
      strings: [
        { note: 'B1', freq: 61.74, pc: 11 },
        { note: 'E2', freq: 82.41, pc: 4 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'B3', freq: 246.94, pc: 11 },
        { note: 'E4', freq: 329.63, pc: 4 }
      ]
    },
    'guitar_8str': {
      name: '8-String Guitar (Low F#: F#BEADGBE)',
      instrument: 'guitar',
      strings: [
        { note: 'F#1', freq: 46.25, pc: 6 },
        { note: 'B1', freq: 61.74, pc: 11 },
        { note: 'E2', freq: 82.41, pc: 4 },
        { note: 'A2', freq: 110.00, pc: 9 },
        { note: 'D3', freq: 146.83, pc: 2 },
        { note: 'G3', freq: 196.00, pc: 7 },
        { note: 'B3', freq: 246.94, pc: 11 },
        { note: 'E4', freq: 329.63, pc: 4 }
      ]
    },
    // Basses
    'bass_4str': {
      name: '4-String Bass (Standard EADG)',
      instrument: 'bass',
      strings: [
        { note: 'E1', freq: 41.20, pc: 4 },
        { note: 'A1', freq: 55.00, pc: 9 },
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'G2', freq: 98.00, pc: 7 }
      ]
    },
    'bass_5str': {
      name: '5-String Bass (Low B: BEADG)',
      instrument: 'bass',
      strings: [
        { note: 'B0', freq: 30.87, pc: 11 },
        { note: 'E1', freq: 41.20, pc: 4 },
        { note: 'A1', freq: 55.00, pc: 9 },
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'G2', freq: 98.00, pc: 7 }
      ]
    },
    'bass_6str': {
      name: '6-String Bass (BEADGC)',
      instrument: 'bass',
      strings: [
        { note: 'B0', freq: 30.87, pc: 11 },
        { note: 'E1', freq: 41.20, pc: 4 },
        { note: 'A1', freq: 55.00, pc: 9 },
        { note: 'D2', freq: 73.42, pc: 2 },
        { note: 'G2', freq: 98.00, pc: 7 },
        { note: 'C3', freq: 130.81, pc: 0 }
      ]
    },
    // Ukulele
    'ukulele_std': {
      name: 'Ukulele (Standard GCEA)',
      instrument: 'guitar',
      strings: [
        { note: 'G4', freq: 392.00, pc: 7 },
        { note: 'C4', freq: 261.63, pc: 0 },
        { note: 'E4', freq: 329.63, pc: 4 },
        { note: 'A4', freq: 440.00, pc: 9 }
      ]
    }
  };

  class ChromaticTuner {
    constructor() {
      this.audioContext = null;
      this.analyser = null;
      this.mediaStream = null;
      this.sourceNode = null;
      this.gainNode = null;

      this.isRunning = false;
      this.a4Calibration = 440;
      this.noiseGateThreshold = 0.015;
      this.clarityThreshold = 0.68;
      this.inputGain = 0.3;
      this.silenceCounter = 0;

      this.currentTuningKey = 'guitar_std';
      this.selectedStringIndex = null; // null = chromatic mode, integer = target string lock
      this.audioToneOsc = null;

      this.bufferSize = 4096;
      this.buffer = new Float32Array(this.bufferSize);

      // Pitch tracking state
      this.detectedFrequency = 0;
      this.detectedNote = '--';
      this.detectedOctave = '';
      this.targetFrequency = 0;
      this.cents = 0;
      this.smoothedCents = 0;
      this.isInTune = false;
      this.rmsLevel = 0;

      // Strobe animation state
      this.strobeAngle = 0;
      this.animFrameId = null;

      // Callbacks for UI updates
      this.onPitchUpdate = null;
    }

    async start() {
      if (this.isRunning) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } catch (err) {
        console.error("Tuner getUserMedia error:", err);
        throw err;
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.inputGain;

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize;

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);

      this.isRunning = true;
      this.loop = this.loop.bind(this);
      this.animFrameId = requestAnimationFrame(this.loop);
    }

    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (e) {}
        this.sourceNode = null;
      }

      if (this.gainNode) {
        try { this.gainNode.disconnect(); } catch (e) {}
        this.gainNode = null;
      }

      this.stopReferenceTone();

      this.detectedFrequency = 0;
      this.detectedNote = '--';
      this.detectedOctave = '';
      this.cents = 0;
      this.smoothedCents = 0;
      this.isInTune = false;
      this.rmsLevel = 0;

      if (typeof this.onPitchUpdate === 'function') {
        this.onPitchUpdate(this.getState());
      }
    }

    toggle() {
      if (this.isRunning) {
        this.stop();
        return Promise.resolve(false);
      } else {
        return this.start().then(() => true);
      }
    }

    setA4(freq) {
      const val = Math.max(420, Math.min(460, parseInt(freq, 10) || 440));
      this.a4Calibration = val;
    }

    setInputGain(gainVal) {
      this.inputGain = Math.max(0.05, Math.min(3.0, parseFloat(gainVal) || 0.3));
      if (this.gainNode) {
        this.gainNode.gain.value = this.inputGain;
      }
      this.noiseGateThreshold = 0.015 * Math.max(0.4, this.inputGain);
    }

    setTuning(tuningKey) {
      if (TUNING_PRESETS[tuningKey]) {
        this.currentTuningKey = tuningKey;
        this.selectedStringIndex = null;
      }
    }

    getCurrentTuning() {
      return TUNING_PRESETS[this.currentTuningKey] || TUNING_PRESETS.guitar_std;
    }

    selectString(index) {
      if (index === null || index === undefined || index < 0) {
        this.selectedStringIndex = null;
      } else {
        const tuning = this.getCurrentTuning();
        if (tuning && index < tuning.strings.length) {
          this.selectedStringIndex = index;
        }
      }
    }

    // Audible reference pitch generator
    playReferenceTone(frequency) {
      this.stopReferenceTone();
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      gain.gain.setValueAtTime(0.0001, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, this.audioContext.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      this.audioToneOsc = { osc, gain };
    }

    stopReferenceTone() {
      if (this.audioToneOsc) {
        try {
          const { osc, gain } = this.audioToneOsc;
          gain.gain.setValueAtTime(gain.gain.value, this.audioContext.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.06);
          setTimeout(() => {
            try { osc.stop(); osc.disconnect(); } catch (e) {}
          }, 70);
        } catch (e) {}
        this.audioToneOsc = null;
      }
    }

    // High-precision Autocorrelation with Parabolic Peak Interpolation
    detectPitch(buffer, sampleRate) {
      let sumSquares = 0;
      const len = buffer.length;
      for (let i = 0; i < len; i++) {
        const val = buffer[i];
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / len);
      this.rmsLevel = rms;

      if (rms < this.noiseGateThreshold) {
        return null; // Silent / hiss
      }

      // Range bounds: 25 Hz (Low B0 bass is 30.9 Hz) to 1200 Hz (High D6)
      const minLag = Math.floor(sampleRate / 1200);
      const maxLag = Math.floor(sampleRate / 25);

      // Compute Normalized Square Difference Function (NSDF)
      let foundValley = false;
      let bestTau = -1;
      let maxVal = -1;
      let prevVal = 1;

      // Temporary arrays or running computation
      const nsdf = new Float32Array(maxLag + 2);

      for (let tau = 0; tau <= maxLag; tau++) {
        let num = 0;
        let den1 = 0;
        let den2 = 0;
        for (let i = 0; i < len - tau; i++) {
          const a = buffer[i];
          const b = buffer[i + tau];
          num += a * b;
          den1 += a * a;
          den2 += b * b;
        }
        const den = den1 + den2;
        const val = den > 1e-6 ? (2 * num) / den : 0;
        nsdf[tau] = val;

        if (tau >= minLag) {
          if (!foundValley) {
            if (val < 0.1 || (val > prevVal && prevVal < 0.6)) {
              foundValley = true;
            }
          } else {
            if (val > maxVal) {
              maxVal = val;
              bestTau = tau;
            } else if (val < maxVal && maxVal > 0.55) {
              // Reached local harmonic peak
              break;
            }
          }
        }
        prevVal = val;
      }

      if (bestTau <= 0 || maxVal < this.clarityThreshold) {
        return null; // Reject noisy / non-musical audio
      }

      // Parabolic 3-point interpolation around peak
      const cPrev = nsdf[bestTau - 1];
      const cCur = nsdf[bestTau];
      const cNext = nsdf[bestTau + 1];
      const denom = 2 * (2 * cCur - cPrev - cNext);
      let delta = 0;
      if (Math.abs(denom) > 1e-6) {
        delta = (cNext - cPrev) / denom;
      }

      return sampleRate / (bestTau + delta);
    }

    loop() {
      if (!this.isRunning) return;

      this.analyser.getFloatTimeDomainData(this.buffer);
      const sampleRate = this.audioContext.sampleRate;
      const rawFreq = this.detectPitch(this.buffer, sampleRate);

      if (rawFreq && rawFreq > 24 && rawFreq < 1400) {
        this.silenceCounter = 0;

        // Octave jump filter / slight lowpass smoothing
        if (this.detectedFrequency > 0 && Math.abs(rawFreq - this.detectedFrequency) > 15) {
          this.detectedFrequency = rawFreq * 0.7 + this.detectedFrequency * 0.3;
        } else {
          this.detectedFrequency = rawFreq;
        }

        const a4 = this.a4Calibration;
        const midiNum = 12 * (Math.log2(this.detectedFrequency / a4)) + 69;
        let targetMidi = Math.round(midiNum);

        // String lock override if a specific string is selected
        if (this.selectedStringIndex !== null) {
          const tuning = this.getCurrentTuning();
          const targetString = tuning.strings[this.selectedStringIndex];
          if (targetString) {
            // Find MIDI note corresponding to target string frequency
            const stringMidi = Math.round(12 * Math.log2(targetString.freq / a4) + 69);
            targetMidi = stringMidi;
          }
        }

        const rawCents = (midiNum - targetMidi) * 100;
        const clampedCents = Math.max(-50, Math.min(50, rawCents));

        this.smoothedCents = this.smoothedCents * 0.65 + clampedCents * 0.35;
        this.cents = Math.round(this.smoothedCents);

        const targetFreq = a4 * Math.pow(2, (targetMidi - 69) / 12);
        this.targetFrequency = targetFreq;

        const noteIndex = ((targetMidi % 12) + 12) % 12;
        this.detectedNote = NOTE_STRINGS[noteIndex];
        this.detectedOctave = Math.floor(targetMidi / 12) - 1;

        this.isInTune = Math.abs(this.smoothedCents) <= 3.0;

        // Advance virtual strobe ring
        // Flat (negative cents) rotates counter-clockwise; sharp (positive cents) rotates clockwise
        const strobeVelocity = (this.smoothedCents / 50) * 0.08;
        this.strobeAngle += strobeVelocity;
      } else {
        this.silenceCounter = (this.silenceCounter || 0) + 1;

        // Decay smoothly to center
        this.smoothedCents *= 0.88;
        this.cents = Math.round(this.smoothedCents);

        // Debounce: hold last valid note for 18 frames (~300ms) before clearing to '--'
        if (this.silenceCounter > 18) {
          this.detectedFrequency = 0;
          this.detectedNote = '--';
          this.detectedOctave = '';
          this.targetFrequency = 0;
          this.isInTune = false;
        }
      }

      if (typeof this.onPitchUpdate === 'function') {
        this.onPitchUpdate(this.getState());
      }

      this.animFrameId = requestAnimationFrame(this.loop);
    }

    getState() {
      return {
        isRunning: this.isRunning,
        detectedFrequency: this.detectedFrequency,
        detectedNote: this.detectedNote,
        detectedOctave: this.detectedOctave,
        targetFrequency: this.targetFrequency,
        cents: this.cents,
        smoothedCents: this.smoothedCents,
        isInTune: this.isInTune,
        rmsLevel: this.rmsLevel,
        strobeAngle: this.strobeAngle,
        a4: this.a4Calibration,
        tuning: this.getCurrentTuning(),
        tuningKey: this.currentTuningKey,
        selectedStringIndex: this.selectedStringIndex
      };
    }
  }

  class TunerRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = window.devicePixelRatio || 1;
      this.width = canvas.width;
      this.height = canvas.height;
      this.setupCanvas();
    }

    setupCanvas(force = false) {
      if (!this.canvas) return;
      if (!force && this.canvas.offsetParent === null) {
        this._needsResize = true;
        return;
      }
      this._needsResize = false;
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width || 340;
      const h = rect.height || 220;
      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
      this.width = w;
      this.height = h;
    }

    render(state) {
      if (!this.ctx || !this.canvas) return;
      if (this.canvas.offsetParent === null) return;
      if (this._needsResize || !this.width || !this.height) {
        this.setupCanvas(true);
      }
      if (!this.width || !this.height) return;

      const { cents, smoothedCents, isInTune, isRunning, strobeAngle } = state;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.88;
      const radius = Math.min(w * 0.44, h * 0.72);

      // 1. Virtual Peterson-Style Strobe Arc (Outer ring)
      const strobeRadius = radius + 10;
      const numSpokes = 36;
      ctx.save();
      for (let i = 0; i < numSpokes; i++) {
        const spokeAngle = (i / numSpokes) * Math.PI * 2 + (strobeAngle || 0);
        // Only draw spokes in the upper arc between 195 deg and 345 deg
        const deg = (spokeAngle * 180 / Math.PI) % 360;
        const normDeg = (deg + 360) % 360;
        if (normDeg >= 195 && normDeg <= 345) {
          const spokeRad = spokeAngle;
          const x1 = cx + Math.cos(spokeRad) * (strobeRadius - 6);
          const y1 = cy + Math.sin(spokeRad) * (strobeRadius - 6);
          const x2 = cx + Math.cos(spokeRad) * (strobeRadius + 6);
          const y2 = cy + Math.sin(spokeRad) * (strobeRadius + 6);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = isInTune ? 'rgba(16, 185, 129, 0.7)' : (isRunning ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.2)');
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 2. Main Cents Scale Background Track
      const startAngle = Math.PI * (1 - 1 / 6); // 150 deg -> 210 deg
      const arcSpan = Math.PI * (2 / 3);        // 120 deg total (-60 deg to +60 deg from center 270)
      const minAngle = (3 * Math.PI / 2) - (arcSpan / 2);
      const maxAngle = (3 * Math.PI / 2) + (arcSpan / 2);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, minAngle, maxAngle, false);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. In-Tune Sweet Zone (Centered around 0 cents, +/- 3 cents)
      const zeroAngle = 3 * Math.PI / 2;
      const sweetDelta = (3 / 50) * (arcSpan / 2);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, zeroAngle - sweetDelta, zeroAngle + sweetDelta, false);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 14;
      ctx.stroke();

      // 4. Tick Marks and Labels
      const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
      ticks.forEach(c => {
        const frac = c / 50; // -1 to +1
        const angle = zeroAngle + frac * (arcSpan / 2);
        const isMajor = (c % 10 === 0);
        const isZero = (c === 0);

        const innerR = radius - (isZero ? 14 : (isMajor ? 10 : 6));
        const outerR = radius + (isZero ? 14 : (isMajor ? 10 : 6));

        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * outerR;
        const y2 = cy + Math.sin(angle) * outerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isZero ? '#10b981' : (Math.abs(c) <= 10 ? '#38bdf8' : '#94a3b8');
        ctx.lineWidth = isZero ? 3 : 1.5;
        ctx.stroke();

        if (c === -50 || c === -20 || c === 0 || c === 20 || c === 50) {
          const textR = radius - 24;
          const tx = cx + Math.cos(angle) * textR;
          const ty = cy + Math.sin(angle) * textR;
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isZero ? '#10b981' : '#64748b';
          ctx.fillText(c === 0 ? '0' : (c > 0 ? `+${c}` : `${c}`), tx, ty);
        }
      });

      // 5. Cents Needle Indicator
      if (isRunning) {
        const needleFrac = Math.max(-1, Math.min(1, (smoothedCents || 0) / 50));
        const needleAngle = zeroAngle + needleFrac * (arcSpan / 2);

        const needleColor = isInTune ? '#10b981' : (Math.abs(needleFrac) < 0.25 ? '#38bdf8' : (needleFrac < 0 ? '#f59e0b' : '#ef4444'));

        ctx.save();
        ctx.shadowColor = needleColor;
        ctx.shadowBlur = isInTune ? 16 : 8;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        const nx = cx + Math.cos(needleAngle) * (radius + 4);
        const ny = cy + Math.sin(needleAngle) * (radius + 4);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = needleColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Needle center hub
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = needleColor;
        ctx.fill();
        ctx.restore();
      } else {
        // Needle rest position at center
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy - radius);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
      }
    }
  }

  window.SongTuner = {
    TUNING_PRESETS,
    ChromaticTuner,
    TunerRenderer,
    tuner: new ChromaticTuner()
  };

})(typeof window !== 'undefined' ? window : globalThis);

