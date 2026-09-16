// Song Analyzer - Web Audio & Tone.js Audio Engine
// Classic JS Module (works offline over file:// with zero server requirements)

(function(window) {
  'use strict';

  class AudioEngine {
    constructor() {
      this.initialized = false;
      this.isPlayingProgression = false;
      this.isMetronomeRunning = false;
      this.progressionLoop = null;
      this.metronomeLoop = null;
      this.currentChordIndex = 0;
      this.activeProgression = [];
      this.onChordHighlight = null;

      // Speech synthesis for vocal counting
      this.speechSynth = window.speechSynthesis || null;
      // Metronome and rhythm properties
      this.spokenCountingEnabled = false;
      this.subdivision = 'quarter'; // quarter, eighth, sixteenth, triplet
      this.metronomeSoundMode = 'woodblock'; // woodblock, synth, spoken
      this.isRhythmPlaying = false;
      this.rhythmLoopTimeout = null;
      this.rhythmTimeouts = [];

      // High-precision Web Audio lookahead scheduler properties (zero memory leak / zero drift)
      this.rawAudioContext = null;
      this.metroWorker = null;
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
    }

    async resumeIfNeeded() {
      if (typeof Tone === 'undefined' || !Tone.context) return false;
      try {
        if (Tone.context.state !== 'running') {
          if (Tone.context.rawContext && typeof Tone.context.rawContext.resume === 'function') {
            await Tone.context.rawContext.resume();
          }
          await Tone.context.resume();
          await Tone.start();
        }
        return Tone.context.state === 'running';
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
        return false;
      }
    }

    isAudioRunning() {
      if (!this.initialized) return false;
      if (typeof Tone !== 'undefined' && Tone.context) {
        return Tone.context.state === 'running';
      }
      return false;
    }

    async suspend() {
      if (this.isMetronomeRunning) this.stopMetronome();
      if (this.isRhythmPlaying) this.stopRhythm();
      if (this.isPlayingProgression) this.stopProgression();
      if (typeof Tone !== 'undefined' && Tone.context && typeof Tone.context.suspend === 'function') {
        try {
          await Tone.context.suspend();
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
      if (typeof Tone === 'undefined') {
        console.error('Tone.js is not loaded.');
        return false;
      }

      try {
        await Tone.start();
        if (Tone.context && Tone.context.rawContext && typeof Tone.context.rawContext.resume === 'function') {
          await Tone.context.rawContext.resume();
        }
        console.log('Tone.js AudioContext started.');

        // Master audio output chain
        this.masterLimiter = new Tone.Limiter(-1).toDestination();
        this.masterVolume = new Tone.Volume(-6).connect(this.masterLimiter);

        // Warm FM Electric Piano Synthesizer
        this.chordSynth = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2.0,
          modulationIndex: 1.8,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.005,
            decay: 1.8,
            sustain: 0.25,
            release: 1.4
          },
          modulation: { type: 'triangle' },
          modulationEnvelope: {
            attack: 0.002,
            decay: 0.5,
            sustain: 0.05,
            release: 0.9
          }
        }).connect(this.masterVolume);
        this.chordSynth.maxPolyphony = 16;

        // Single note / Arpeggio Synth (Brighter Rhodes bell)
        this.leadSynth = new Tone.FMSynth({
          harmonicity: 3.0,
          modulationIndex: 1.2,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.004,
            decay: 0.8,
            sustain: 0.1,
            release: 0.8
          },
          modulation: { type: 'sine' },
          modulationEnvelope: {
            attack: 0.002,
            decay: 0.3,
            sustain: 0,
            release: 0.4
          }
        }).connect(this.masterVolume);

        // Metronome Click Synth (Woodblock / Membrane)
        this.woodblockSynth = new Tone.MembraneSynth({
          pitchDecay: 0.008,
          octaves: 2.5,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.06,
            sustain: 0,
            release: 0.05
          }
        }).connect(this.masterVolume);

        // Digital Click Synth
        this.clickSynth = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.001,
            decay: 0.03,
            sustain: 0,
            release: 0.02
          }
        }).connect(this.masterVolume);

        // Rhythm Clave Synth
        this.percussionSynth = new Tone.MembraneSynth({
          pitchDecay: 0.01,
          octaves: 3,
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.06 }
        }).connect(this.masterVolume);

        this.initialized = true;

        // Forward AudioContext state changes to window for UI updates
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.rawContext) {
          const raw = Tone.context.rawContext;
          const notifyState = () => {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('songaudio-statechange', {
                detail: { state: Tone.context.state }
              }));
            }
          };
          if (typeof raw.addEventListener === 'function') {
            raw.addEventListener('statechange', notifyState);
          } else {
            raw.onstatechange = notifyState;
          }
        }

        try {
          this.rawAudioContext = (typeof Tone !== 'undefined' && Tone.context)
              ? (Tone.context.rawContext || Tone.context._context || Tone.context)
              : null;
        } catch (ctxErr) {
          this.rawAudioContext = null;
        }

        try {
          this.initBuffers();
        } catch (bufErr) {
          console.warn('Metronome pre-rendered buffer init skipped, falling back to synths:', bufErr);
        }

        try {
          this.initMetroWorker();
        } catch (wrkErr) {
          console.warn('Metronome worker init skipped, falling back to timer:', wrkErr);
        }

        return true;
      } catch (e) {
        console.error('Failed to initialize audio:', e);
        return false;
      }
    }

    getAudioCurrentTime() {
      if (typeof Tone !== 'undefined' && Tone.context && typeof Tone.now === 'function') {
        return Tone.now();
      }
      if (this.rawAudioContext && typeof this.rawAudioContext.currentTime === 'number') {
        return this.rawAudioContext.currentTime;
      }
      return 0;
    }

    initMetroWorker() {
      if (this.metroWorker) return;
      try {
        const workerBlob = new Blob([
          `let timerId = null;
self.onmessage = function(e) {
  if (e.data === 'start') {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function() { self.postMessage('tick'); }, 25);
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
      let ctx = null;
      if (this.rawAudioContext && typeof this.rawAudioContext.createBuffer === 'function') {
        ctx = this.rawAudioContext;
      } else if (typeof Tone !== 'undefined' && Tone.context && typeof Tone.context.createBuffer === 'function') {
        ctx = Tone.context;
      }
      if (!ctx) return;

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
        // 1. Woodblock Downbeat (A5 sweep ~880Hz to ~600Hz, resonant knock)
        this.preRenderedBuffers.woodblockDownbeat = createSyntheticBuffer(0.045, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 600 + 280 * Math.exp(-t * 120);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 65);
            d[i] = Math.sin(phase) * env * 0.95;
          }
        });

        // 2. Woodblock Beat (E5 sweep ~659Hz to ~450Hz)
        this.preRenderedBuffers.woodblockBeat = createSyntheticBuffer(0.035, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 450 + 210 * Math.exp(-t * 130);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 75);
            d[i] = Math.sin(phase) * env * 0.75;
          }
        });

        // 3. Woodblock Sub (C5 sweep ~523Hz to ~360Hz)
        this.preRenderedBuffers.woodblockSub = createSyntheticBuffer(0.025, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const freq = 360 + 160 * Math.exp(-t * 150);
            const phase = 2 * Math.PI * freq * t;
            const env = Math.exp(-t * 90);
            d[i] = Math.sin(phase) * env * 0.45;
          }
        });

        // 4. Digital Click Downbeat (high-pass transient 2400Hz + noise burst)
        this.preRenderedBuffers.clickDownbeat = createSyntheticBuffer(0.012, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 320);
            const sine = Math.sin(2 * Math.PI * 2400 * t);
            const noise = (Math.random() * 2 - 1) * 0.25;
            d[i] = (sine + noise) * env * 0.95;
          }
        });

        // 5. Digital Click Beat (1700Hz + small noise)
        this.preRenderedBuffers.clickBeat = createSyntheticBuffer(0.010, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 360);
            const sine = Math.sin(2 * Math.PI * 1700 * t);
            const noise = (Math.random() * 2 - 1) * 0.15;
            d[i] = (sine + noise) * env * 0.70;
          }
        });

        // 6. Digital Click Sub (1200Hz soft transient)
        this.preRenderedBuffers.clickSub = createSyntheticBuffer(0.008, (d, n, sr) => {
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            const env = Math.exp(-t * 420);
            d[i] = Math.sin(2 * Math.PI * 1200 * t) * env * 0.40;
          }
        });
      } catch (e) {
        console.warn('initBuffers caught error:', e);
      }
    }

    playMetronomeBuffer(buffer, scheduledTime) {
      if (!buffer || !this.rawAudioContext || typeof this.rawAudioContext.createBufferSource !== 'function') return false;
      try {
        const source = this.rawAudioContext.createBufferSource();
        source.buffer = buffer;
        const dest = (this.masterVolume && this.masterVolume.input) ? this.masterVolume.input : this.rawAudioContext.destination;
        source.connect(dest);
        source.start(scheduledTime);
      } catch (e) {
        console.warn('Error scheduling metronome buffer:', e);
      }
    }

    playTestTone() {
      if (!this.initialized || !this.leadSynth) return;
      try {
        const now = Tone.now();
        this.leadSynth.triggerAttackRelease('C5', '16n', now);
      } catch (e) {
        console.warn('Test tone error:', e);
      }
    }

    setMasterVolume(valDb) {
      if (this.masterVolume) {
        this.masterVolume.volume.value = Math.max(-40, Math.min(6, valDb));
      }
    }

    setBpm(bpm) {
      const val = Math.max(15, Math.min(240, parseInt(bpm, 10) || 113));
      this.currentBpm = val;
      if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.bpm.value = val;
      }
    }

    // Convert chord pitch classes into voiced scientific pitch notes (e.g. C3, E4, G4, B4)
    generateVoicing(chord, baseOctave = 4) {
      if (!chord || !chord.pitchClasses) return [];

      const notes = [];
      const rootPC = chord.rootPC;
      const bassPC = (chord.bassPC !== undefined && chord.bassPC !== null) ? chord.bassPC : rootPC;

      const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const bassNote = `${sharpNames[bassPC]}3`;
      notes.push(bassNote);

      chord.intervals.forEach((interval) => {
        const pc = (rootPC + interval) % 12;
        const octave = baseOctave + Math.floor((rootPC + interval) / 12);
        const noteName = `${sharpNames[pc]}${octave}`;
        if (!notes.includes(noteName)) {
          notes.push(noteName);
        }
      });

      return notes;
    }

    async playChord(chord, duration = '1.2s') {
      if (!this.initialized) return;
      await this.resumeIfNeeded();
      const voicing = this.generateVoicing(chord);
      if (voicing.length > 0) {
        this.chordSynth.triggerAttackRelease(voicing, duration);
      }
    }

    async playArpeggio(chord, noteDurationSeconds = 0.2) {
      if (!this.initialized) return;
      await this.resumeIfNeeded();
      const voicing = this.generateVoicing(chord);
      const now = Tone.now();
      voicing.forEach((note, idx) => {
        this.leadSynth.triggerAttackRelease(note, '8n', now + (idx * noteDurationSeconds));
      });
    }

    async playProgression(parsedChords, bpm = 113, loop = false, onChordHighlight = null, onFinished = null) {
      if (!this.initialized || !parsedChords || parsedChords.length === 0) return;
      await this.resumeIfNeeded();

      this.stopProgression();
      this.activeProgression = parsedChords;
      this.isPlayingProgression = true;
      this.onChordHighlight = onChordHighlight;

      Tone.Transport.bpm.value = bpm;
      const secondsPerChord = (60 / bpm) * 2;
      let currentIdx = 0;

      const scheduleNext = () => {
        if (!this.isPlayingProgression) return;

        if (currentIdx >= this.activeProgression.length) {
          if (loop) {
            currentIdx = 0;
          } else {
            this.stopProgression();
            if (onFinished) onFinished();
            return;
          }
        }

        const chord = this.activeProgression[currentIdx];
        const voicing = this.generateVoicing(chord);

        if (this.onChordHighlight) {
          this.onChordHighlight(currentIdx, chord);
        }

        this.chordSynth.triggerAttackRelease(voicing, secondsPerChord * 0.9);

        currentIdx++;
        this.progressionTimeout = setTimeout(scheduleNext, secondsPerChord * 1000);
      };

      scheduleNext();
    }

    stopProgression() {
      this.isPlayingProgression = false;
      if (this.progressionTimeout) {
        clearTimeout(this.progressionTimeout);
        this.progressionTimeout = null;
      }
      if (this.onChordHighlight) {
        this.onChordHighlight(-1, null);
      }
    }

    // Arbitrary Time Signature Metronome (X / Y e.g. 7/8, 16/15, 4/4, 9/8, 5/4)
    // High-precision Web Audio lookahead scheduler (W3C/Chris Wilson architecture)
    // Runs directly on hardware audio time with 0ms drift and zero memory leak
    async startMetronome(bpm, timeSignature = { num: 4, den: 4 }, subdivision = 1, soundMode = 'woodblock', onTick = null) {
      if (!this.initialized) {
        await this.init();
      }
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

      if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.bpm.value = safeBpm;
      }

      this.metroVisualQueue = [];
      this.metroTickCount = 0;
      const now = this.getAudioCurrentTime();
      this.nextMetroTickAudioTime = now + 0.04;

      const scheduleAheadSec = 0.25; // 250ms resilient lookahead buffer

      this.scheduleMetroLoop = () => {
        if (!this.isMetronomeRunning) return;
        const currentTime = this.getAudioCurrentTime();

        // Calculate tick interval dynamically based on current dynamic BPM:
        const activeBpm = this.currentBpm || safeBpm;
        const tickInterval = 240 / (this.timeSignature.den * activeBpm * this.subdivision);

        // If thread was deeply suspended (e.g. phone lock screen for > 500ms), advance cleanly in full bar increments
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

          if (this.metronomeSoundMode === 'woodblock') {
            const buf = isDownbeat
              ? this.preRenderedBuffers.woodblockDownbeat
              : (isBeatHead ? this.preRenderedBuffers.woodblockBeat : this.preRenderedBuffers.woodblockSub);
            const played = buf ? this.playMetronomeBuffer(buf, scheduledTime) : false;
            if (!played) {
              const pitch = isDownbeat ? 'A5' : (isBeatHead ? 'E5' : 'C5');
              const velocity = isDownbeat ? 1.0 : (isBeatHead ? 0.75 : 0.4);
              this.woodblockSynth.triggerAttackRelease(pitch, '32n', scheduledTime, velocity);
            }
          } else if (this.metronomeSoundMode === 'synth') {
            const buf = isDownbeat
              ? this.preRenderedBuffers.clickDownbeat
              : (isBeatHead ? this.preRenderedBuffers.clickBeat : this.preRenderedBuffers.clickSub);
            const played = buf ? this.playMetronomeBuffer(buf, scheduledTime) : false;
            if (!played) {
              const pitch = isDownbeat ? 'C6' : (isBeatHead ? 'G5' : 'D5');
              const velocity = isDownbeat ? 0.95 : (isBeatHead ? 0.65 : 0.35);
              this.clickSynth.triggerAttackRelease(pitch, '64n', scheduledTime, velocity);
            }
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

      // Run immediate initial schedule burst
      this.scheduleMetroLoop();

      // Start Web Worker background clock or fallback to setInterval
      if (this.metroWorker) {
        this.metroWorker.postMessage('start');
      } else {
        this.metroTimerId = setInterval(this.scheduleMetroLoop, 25);
      }

      // Visual flasher loop
      if (onTick) {
        const visualLoop = () => {
          if (!this.isMetronomeRunning) return;
          const currentAudioTime = this.getAudioCurrentTime();

          // Drop stale frames if frame rate dropped (> 200ms behind)
          while (this.metroVisualQueue.length > 1 && this.metroVisualQueue[0].time < currentAudioTime - 0.2) {
            this.metroVisualQueue.shift();
          }

          // Fire frames that are due (within 20ms anticipation window)
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

      if (this.metronomeLoop) {
        try {
          this.metronomeLoop.stop();
          this.metronomeLoop.dispose();
        } catch (e) {}
        this.metronomeLoop = null;
      }
      if (typeof Tone !== 'undefined' && Tone.Transport) {
        try {
          Tone.Transport.stop();
          Tone.Transport.cancel();
        } catch (e) {}
      }
      if (typeof Tone !== 'undefined' && Tone.Draw && typeof Tone.Draw.cancel === 'function') {
        try {
          Tone.Draw.cancel();
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
      } catch (e) {
        // speech synthesis error protection
      }
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
      } catch (e) {
        // speech synthesis error protection
      }
    }

    async playRhythmSequence(rhythmItems, bpmOrFn = 100, loopCount = 1, onStep = null, onIteration = null, onFinished = null) {
      if (!this.initialized) {
        await this.init();
      }
      if (!rhythmItems || rhythmItems.length === 0) return;
      await this.resumeIfNeeded();

      this.stopRhythm();
      this.isRhythmPlaying = true;
      this.rhythmTimeouts = [];

      const totalTicks = rhythmItems.reduce((acc, it) => acc + (it.value || 32), 0);
      let currentLoop = 0;
      const isInfinite = (loopCount === Infinity || loopCount === 'infinite');
      const maxLoops = isInfinite ? Infinity : Math.max(1, parseInt(loopCount, 10) || 1);

      let nextIterationAudioTime = Tone.now() + 0.05;

      const scheduleIteration = () => {
        if (!this.isRhythmPlaying) return;

        if (currentLoop >= maxLoops) {
          const remainingSec = Math.max(0, nextIterationAudioTime - Tone.now());
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

        const iterAudioStart = Math.max(Tone.now() + 0.01, nextIterationAudioTime);
        let timeOffsetSec = 0;

        rhythmItems.forEach((item, index) => {
          const itemDuration = (item.value / 32) * baseDuration;
          const triggerTime = iterAudioStart + timeOffsetSec;

          if (!item.isRest && this.percussionSynth) {
            this.percussionSynth.triggerAttackRelease('C4', '16n', triggerTime);
          }

          if (onStep) {
            const visualDelay = Math.max(0, (triggerTime - Tone.now()) * 1000);
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
        // Schedule next iteration ~80ms before it plays for seamless Web Audio queueing
        const scheduleDelay = Math.max(20, (nextIterationAudioTime - Tone.now() - 0.08) * 1000);
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
