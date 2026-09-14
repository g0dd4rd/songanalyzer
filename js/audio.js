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

        return true;
      } catch (e) {
        console.error('Failed to initialize audio:', e);
        return false;
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
      if (typeof Tone !== 'undefined' && Tone.Transport) {
        const val = Math.max(15, Math.min(240, parseInt(bpm, 10) || 110));
        Tone.Transport.bpm.value = val;
        this.currentBpm = val;
        if (this.isMetronomeRunning && this.timeSignature && this.metronomeLoop) {
          const tickIntervalSeconds = 240 / (this.timeSignature.den * val * this.subdivision);
          this.metronomeLoop.interval = tickIntervalSeconds;
        }
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

    async playProgression(parsedChords, bpm = 110, loop = false, onChordHighlight = null, onFinished = null) {
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
    async startMetronome(bpm, timeSignature = { num: 4, den: 4 }, subdivision = 1, soundMode = 'woodblock', onTick = null) {
      if (!this.initialized) return;
      await this.resumeIfNeeded();
      this.stopMetronome();

      const safeBpm = Math.max(15, Math.min(240, parseInt(bpm, 10) || 110));
      this.isMetronomeRunning = true;
      this.timeSignature = {
        num: Math.max(1, parseInt(timeSignature.num, 10) || 4),
        den: Math.max(1, parseInt(timeSignature.den, 10) || 4)
      };
      this.subdivision = Math.max(1, parseInt(subdivision, 10) || 1);
      this.metronomeSoundMode = soundMode;
      this.onTickCallback = onTick;
      this.currentBpm = safeBpm;

      Tone.Transport.bpm.value = safeBpm;

      // Mathematical proportional beat interval for any X/Y meter:
      // A whole note takes 240 / safeBpm seconds.
      // Unit beat of denominator Y takes 240 / (Y * safeBpm) seconds.
      // With S subdivisions per beat: tick interval = 240 / (Y * safeBpm * S) seconds.
      const tickIntervalSeconds = 240 / (this.timeSignature.den * safeBpm * this.subdivision);

      let tickCount = 0;

      this.metronomeLoop = new Tone.Loop((time) => {
        const totalBeats = this.timeSignature.num;
        const subIdx = tickCount % this.subdivision;
        const beatIndex = (Math.floor(tickCount / this.subdivision) % totalBeats) + 1;
        const isDownbeat = (beatIndex === 1 && subIdx === 0);
        const isBeatHead = (subIdx === 0);

        if (this.metronomeSoundMode === 'woodblock') {
          const pitch = isDownbeat ? 'A5' : (isBeatHead ? 'E5' : 'C5');
          const velocity = isDownbeat ? 1.0 : (isBeatHead ? 0.75 : 0.4);
          this.woodblockSynth.triggerAttackRelease(pitch, '32n', time, velocity);
        } else if (this.metronomeSoundMode === 'synth') {
          const pitch = isDownbeat ? 'C6' : (isBeatHead ? 'G5' : 'D5');
          const velocity = isDownbeat ? 0.95 : (isBeatHead ? 0.65 : 0.35);
          this.clickSynth.triggerAttackRelease(pitch, '64n', time, velocity);
        } else if (this.metronomeSoundMode === 'spoken' && this.speechSynth) {
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
        }

        if (onTick) {
          Tone.Draw.schedule(() => {
            onTick(beatIndex, subIdx, isDownbeat, totalBeats);
          }, time);
        }

        tickCount++;
      }, tickIntervalSeconds);

      this.metronomeLoop.start(0);
      Tone.Transport.start();
    }

    stopMetronome() {
      this.isMetronomeRunning = false;
      if (this.metronomeLoop) {
        this.metronomeLoop.stop();
        this.metronomeLoop.dispose();
        this.metronomeLoop = null;
      }
    }

    speakNumber(num) {
      if (!this.speechSynth) return;
      this.speechSynth.cancel();
      const utterance = new SpeechSynthesisUtterance(String(num));
      const bpm = this.currentBpm || 110;
      utterance.rate = Math.min(3.0, Math.max(1.1, 1.0 + (bpm / 120)));
      utterance.pitch = 1.2;
      utterance.volume = 0.8;
      this.speechSynth.speak(utterance);
    }

    speakWord(word) {
      if (!this.speechSynth) return;
      this.speechSynth.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      const bpm = this.currentBpm || 110;
      utterance.rate = Math.min(3.0, Math.max(1.1, 1.0 + (bpm / 120)));
      utterance.pitch = 1.0;
      utterance.volume = 0.7;
      this.speechSynth.speak(utterance);
    }

    async playRhythmSequence(rhythmItems, bpmOrFn = 100, loopCount = 1, onStep = null, onIteration = null, onFinished = null) {
      if (!this.initialized || !rhythmItems || rhythmItems.length === 0) return;
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
        const baseDuration = (60 / currentBpm);
        const patternDurationSeconds = (totalTicks / 32) * baseDuration;

        const iterAudioStart = Math.max(Tone.now() + 0.01, nextIterationAudioTime);
        let timeOffsetSec = 0;

        rhythmItems.forEach((item, index) => {
          const itemDuration = (item.value / 32) * baseDuration;
          const triggerTime = iterAudioStart + timeOffsetSec;

          if (!item.isRest) {
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
