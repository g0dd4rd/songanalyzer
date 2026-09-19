// Song Analyzer - HTML5 Canvas Visualizer
// Classic JS Module (works offline over file:// with zero server requirements)

(function(window) {
  'use strict';

  class Visualizer {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      this.ctx = canvasElement.getContext('2d');
      this.mode = 'clock'; // 'clock', 'piano', 'fretboard'
      this.fretboardInstrument = 'guitar'; // 'guitar', 'bass'
      this.activeChord = null;
      this.activeScale = null;
      this.activeMelodyNote = null;
      this.activeMelodyPC = null;
      this.onNoteClick = null;

      // Guitar & Bass String Tunings (pitch classes)
      this.guitarStrings = [4, 11, 7, 2, 9, 4]; // E4, B3, G3, D3, A2, E2
      this.guitarStringNotes = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];
      this.bassStrings = [7, 2, 9, 4]; // G2, D2, A1, E1
      this.bassStringNotes = ['G2', 'D2', 'A1', 'E1'];

      this.numFrets = 15;

      // Color Palette
      this.colors = {
        root: '#f59e0b',        // Amber/Gold
        third: '#06b6d4',       // Cyan/Teal
        fifth: '#3b82f6',       // Blue
        seventh: '#a855f7',     // Purple
        extension: '#ec4899',   // Pink
        inactive: '#334155',    // Slate dark
        inactiveText: '#94a3b8',
        bg: '#0f172a',
        cardBg: '#1e293b',
        fretWire: '#64748b',
        wood: '#1e293b'
      };

      // Concentric Groove Layers (Option 2: Enhanced Clock)
      this.layers = {
        drums: true,
        bass: true,
        guitar: true,
        harmony: true
      };
      this.animId = null;
      this.activeStep = -1;
      this.lastStepTime = null;
      this.wheelMetrics = null;
      this.harmonicNodeHits = [];

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener('resize', this.handleResize);
      this.setupInteractivity();
      this.handleResize();
    }

    setMode(newMode) {
      this.mode = newMode;
      this.handleResize();
      this.render();
    }

    setLayer(layerName, isEnabled) {
      if (this.layers.hasOwnProperty(layerName)) {
        this.layers[layerName] = !!isEnabled;
        this.handleResize();
        this.render();
      }
    }

    toggleLayer(layerName) {
      if (this.layers.hasOwnProperty(layerName)) {
        this.layers[layerName] = !this.layers[layerName];
        this.handleResize();
        this.render();
        return this.layers[layerName];
      }
      return false;
    }

    setStep(stepIndex) {
      this.activeStep = stepIndex;
      this.lastStepTime = (stepIndex >= 0) ? performance.now() : null;
      if (this.mode === 'clock') {
        this.render();
      }
    }

    startAnimation() {
      if (this.animId) return;
      const loop = () => {
        const isAudioPlaying = (window.audio && (window.audio.isPlayingProgression || window.audio.isPlayingMelodyProgression));
        const seq = (window.app && window.app.beatSequencer) || window.drumMachine;
        const isDrumsPlaying = seq && seq.isPlaying;

        if (isAudioPlaying || isDrumsPlaying) {
          this.render();
          this.animId = requestAnimationFrame(loop);
        } else {
          this.animId = null;
          this.render();
        }
      };
      this.animId = requestAnimationFrame(loop);
    }

    stopAnimation() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this.activeStep = -1;
      this.lastStepTime = null;
      this.render();
    }

    setFretboardInstrument(inst) {
      this.fretboardInstrument = inst;
      if (this.mode === 'fretboard') {
        this.render();
      }
    }

    setCustomTuning(tuning) {
      if (!tuning || !Array.isArray(tuning.strings)) return;
      this.fretboardInstrument = tuning.instrument || 'guitar';
      const reversed = [...tuning.strings].reverse();
      if (this.fretboardInstrument === 'bass') {
        this.bassStrings = reversed.map(s => s.pc);
        this.bassStringNotes = reversed.map(s => s.note);
      } else {
        this.guitarStrings = reversed.map(s => s.pc);
        this.guitarStringNotes = reversed.map(s => s.note);
      }
      if (this.mode === 'fretboard') {
        this.render();
      }
    }

    setActiveChord(chord) {
      this.activeChord = chord;
      this.render();
    }

    setMelodyNote(noteObjOrName) {
      if (!noteObjOrName) {
        this.activeMelodyNote = null;
        this.activeMelodyPC = null;
      } else if (typeof noteObjOrName === 'object' && noteObjOrName.pc !== undefined) {
        this.activeMelodyNote = noteObjOrName;
        this.activeMelodyPC = noteObjOrName.pc;
      } else if (typeof noteObjOrName === 'string') {
        const pc = window.SongTheory ? window.SongTheory.parseNotePC(noteObjOrName) : null;
        this.activeMelodyNote = { scientific: noteObjOrName, pc };
        this.activeMelodyPC = pc;
      }
      this.render();
    }

    clearMelodyNote() {
      this.activeMelodyNote = null;
      this.activeMelodyPC = null;
      this.render();
    }

    handleResize() {
      if (!this.canvas || !this.canvas.parentElement) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(rect.width, 300);
      let height;
      if (this.mode === 'clock') {
        const hasOuterLayers = this.layers.drums || this.layers.bass || this.layers.guitar;
        height = hasOuterLayers
          ? Math.min(Math.max(width * 0.95, 380), 540)
          : Math.min(Math.max(width * 0.85, 260), 440);
      } else if (this.mode === 'piano') {
        height = Math.min(Math.max(width * 0.45, 175), 320);
      } else {
        height = Math.min(Math.max(width * 0.45, 185), 340);
      }

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;

      this.ctx.resetTransform?.() || this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.width = width;
      this.height = height;

      this.render();
    }

    getIntervalRole(pc) {
      if (!this.activeChord) return null;
      const rootPC = this.activeChord.rootPC;
      const semitone = (pc - rootPC + 12) % 12;

      const INTERVAL_SHORT = window.SongTheory ? window.SongTheory.INTERVAL_SHORT : ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

      if (semitone === 0) return { name: '1', color: this.colors.root, label: 'Root' };
      if (semitone === 3 || semitone === 4) return { name: semitone === 3 ? 'b3' : '3', color: this.colors.third, label: '3rd' };
      if (semitone === 6) {
        if (this.activeChord.intervals && this.activeChord.intervals.includes(7)) {
          return { name: '#11', color: this.colors.extension, label: '#11' };
        }
        return { name: 'b5', color: this.colors.fifth, label: '5th (b5)' };
      }
      if (semitone === 7 || semitone === 8) return { name: semitone === 7 ? '5' : '#5', color: this.colors.fifth, label: '5th' };
      if (semitone === 9 || semitone === 10 || semitone === 11) {
        const label = semitone === 9 ? '6/bb7' : (semitone === 10 ? 'b7' : '7');
        return { name: label, color: this.colors.seventh, label: '7th' };
      }
      return { name: INTERVAL_SHORT[semitone], color: this.colors.extension, label: 'Ext' };
    }

    render() {
      if (!this.ctx || !this.width || !this.height) return;

      this.ctx.fillStyle = this.colors.bg;
      this.ctx.fillRect(0, 0, this.width, this.height);

      if (this.mode === 'clock') {
        this.renderPitchConstellation();
      } else if (this.mode === 'piano') {
        this.renderPianoKeyboard();
      } else if (this.mode === 'fretboard') {
        this.renderFretboard();
      }
    }

    renderPitchConstellation() {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxRadius = Math.min(cx, cy) - 22;

      const showDrums = !!this.layers.drums;
      const showBass = !!this.layers.bass;
      const showGuitar = !!this.layers.guitar;
      const showHarmony = !!this.layers.harmony;

      // Dynamic concentric radius distribution based on active layers
      let rDrumOuter = 0, rDrumInner = 0;
      let rBassOuter = 0, rBassInner = 0;
      let rGuitarOuter = 0, rGuitarInner = 0;
      let rHarmony = 0;

      let currentR = maxRadius;

      if (showDrums) {
        rDrumOuter = currentR;
        rDrumInner = currentR - 44;
        currentR = rDrumInner - 7;
      }
      if (showBass) {
        rBassOuter = currentR;
        rBassInner = currentR - 26;
        currentR = rBassInner - 7;
      }
      if (showGuitar) {
        rGuitarOuter = currentR;
        rGuitarInner = currentR - 26;
        currentR = rGuitarInner - 7;
      }

      rHarmony = Math.max(currentR - 18, 55);

      this.wheelMetrics = {
        cx,
        cy,
        rDrumOuter,
        rDrumInner,
        rBassOuter,
        rBassInner,
        rGuitarOuter,
        rGuitarInner,
        rHarmony
      };

      this.harmonicNodeHits = [];

      const seq = (window.app && window.app.beatSequencer) || window.drumMachine;
      const isDrumsPlaying = seq && seq.isPlaying;
      const isAudioPlaying = window.audio && (window.audio.isPlayingProgression || window.audio.isPlayingMelodyProgression);
      const isAnyPlaying = isDrumsPlaying || isAudioPlaying;

      const stepCount = (seq && typeof seq.getStepCount === 'function')
        ? seq.getStepCount()
        : 16;
      const sig = (seq && seq.timeSignature) || { num: 4, den: 4 };
      const subdiv = (seq && seq.subdivision) || ((sig.den === 8) ? (sig.sub || 2) : 4);

      let currentStep = -1;
      let currentProgress = 0;

      if (isDrumsPlaying && seq) {
        // Real-time audio-synchronized step from scheduler
        currentStep = (this.activeStep >= 0) ? (this.activeStep % stepCount) : 0;

        // Smooth sub-step interpolation using high-resolution timer
        let fraction = 0;
        if (this.lastStepTime && typeof this.lastStepTime === 'number') {
          const bpm = seq.bpm || 120;
          const beatSec = (60 / bpm) * (4 / (sig.den || 4));
          const stepDurationMs = (beatSec / subdiv) * 1000;
          const now = performance.now();
          const elapsed = now - this.lastStepTime;
          fraction = Math.min(0.999, Math.max(0, elapsed / stepDurationMs));
        }
        currentProgress = (currentStep + fraction) / stepCount;
      } else if (this.activeStep >= 0) {
        currentStep = this.activeStep % stepCount;
        currentProgress = currentStep / stepCount;
      } else if (isAudioPlaying) {
        if (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.state === 'started' && typeof Tone.Transport.progress === 'number') {
          const numBars = (window.app && window.app.parsedChords && window.app.parsedChords.length) || 1;
          currentProgress = (Tone.Transport.progress * numBars) % 1;
          currentStep = Math.floor(currentProgress * stepCount) % stepCount;
        }
      }

      // =========================================================================
      // LAYER 1: Drum Machine Wheel (Outer Orbit: Dynamic Steps from Beat Builder)
      // =========================================================================
      if (showDrums) {
        // Outer track background corridor
        ctx.fillStyle = '#0b1329';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rDrumOuter, 0, Math.PI * 2);
        ctx.arc(cx, cy, rDrumInner, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.stroke();

        // 4 Sub-track guideline arcs:
        // 1. Kick (inner)
        // 2. Snare / Clap (mid-low)
        // 3. Hi-Hats (mid-high)
        // 4. Cymbals / Perc (outer)
        const rKick = rDrumInner + 8;
        const rSnare = rDrumInner + 18;
        const rHat = rDrumInner + 28;
        const rPerc = rDrumInner + 37;

        [rKick, rSnare, rHat, rPerc].forEach(rGuide => {
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(cx, cy, rGuide, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // Step Spokes & Beat Division Accents
        for (let s = 0; s < stepCount; s++) {
          const theta = -Math.PI / 2 + (s / stepCount) * Math.PI * 2;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const isDownbeat = (s % subdiv === 0);

          ctx.strokeStyle = isDownbeat ? 'rgba(100, 116, 139, 0.65)' : 'rgba(51, 65, 85, 0.3)';
          ctx.lineWidth = isDownbeat ? 1.5 : 0.75;
          ctx.beginPath();
          ctx.moveTo(cx + rDrumInner * cosT, cy + rDrumInner * sinT);
          ctx.lineTo(cx + rDrumOuter * cosT, cy + rDrumOuter * sinT);
          ctx.stroke();

          // Beat Numbers outside perimeter
          if (isDownbeat) {
            const beatNum = Math.floor(s / subdiv) + 1;
            const bDist = rDrumOuter + 11;
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${beatNum}`, cx + bDist * cosT, cy + bDist * sinT);
          }
        }

        // Sweeping Radar Playhead Sector & Needle
        if (isAnyPlaying || this.activeStep >= 0) {
          const needleAngle = -Math.PI / 2 + (currentProgress * Math.PI * 2);
          const trailAngle = needleAngle - (Math.PI * 2 / stepCount) * 1.5;

          ctx.save();
          // Trailing sweep sector
          ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
          ctx.beginPath();
          ctx.arc(cx, cy, rDrumOuter, trailAngle, needleAngle);
          ctx.arc(cx, cy, rDrumInner, needleAngle, trailAngle, true);
          ctx.closePath();
          ctx.fill();

          // Radar needle line
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(cx + (showHarmony ? rHarmony : 20) * Math.cos(needleAngle), cy + (showHarmony ? rHarmony : 20) * Math.sin(needleAngle));
          ctx.lineTo(cx + (rDrumOuter + 2) * Math.cos(needleAngle), cy + (rDrumOuter + 2) * Math.sin(needleAngle));
          ctx.stroke();
          ctx.restore();
        }

        // Drum Pips from Pattern (All 8 Drum & Percussion Tracks)
        if (seq && seq.pattern) {
          for (let s = 0; s < stepCount; s++) {
            const theta = -Math.PI / 2 + (s / stepCount) * Math.PI * 2;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const isStepActive = (currentStep === s);

            // 1. Kick Drum (rKick)
            const kVal = (seq.pattern['kick'] && seq.pattern['kick'][s]) ? seq.pattern['kick'][s] : 0;
            const kx = cx + rKick * cosT;
            const ky = cy + rKick * sinT;
            if (kVal > 0) {
              ctx.save();
              if (isStepActive) {
                ctx.shadowColor = '#f43f5e';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#f43f5e';
              } else {
                ctx.fillStyle = (kVal === 2) ? '#fb7185' : '#f59e0b';
              }
              ctx.beginPath();
              ctx.arc(kx, ky, isStepActive ? 5.5 : (kVal === 2 ? 4.5 : 3.5), 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else {
              ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
              ctx.beginPath();
              ctx.arc(kx, ky, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }

            // 2. Snare & Clap Pips (rSnare)
            const sVal = (seq.pattern['snare'] && seq.pattern['snare'][s]) ? seq.pattern['snare'][s] : 0;
            const clpVal = (seq.pattern['clap'] && seq.pattern['clap'][s]) ? seq.pattern['clap'][s] : 0;
            const sx = cx + rSnare * cosT;
            const sy = cy + rSnare * sinT;
            if (sVal > 0 || clpVal > 0) {
              const val = Math.max(sVal, clpVal);
              const isAccent = (val === 2);
              const isClapOnly = (clpVal > 0 && sVal === 0);
              const color = isClapOnly ? '#10b981' : '#ec4899';
              const activeColor = isClapOnly ? '#34d399' : '#f472b6';
              ctx.save();
              if (isStepActive) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 14;
                ctx.fillStyle = activeColor;
              } else {
                ctx.fillStyle = isAccent ? '#f472b6' : color;
              }
              ctx.beginPath();
              ctx.arc(sx, sy, isStepActive ? 5.2 : (isAccent ? 4.2 : 3.2), 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } else {
              ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
              ctx.beginPath();
              ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }

            // 3. Hi-Hats: Closed & Open (rHat)
            const chVal = (seq.pattern['closedHat'] && seq.pattern['closedHat'][s]) ? seq.pattern['closedHat'][s] : 0;
            const ohVal = (seq.pattern['openHat'] && seq.pattern['openHat'][s]) ? seq.pattern['openHat'][s] : 0;
            const hx = cx + rHat * cosT;
            const hy = cy + rHat * sinT;
            if (chVal > 0 || ohVal > 0) {
              const isOpen = (ohVal > 0);
              const isAccent = (chVal === 2 || ohVal === 2);
              const baseColor = isOpen ? '#06b6d4' : '#38bdf8';
              ctx.save();
              if (isStepActive) {
                ctx.shadowColor = '#38bdf8';
                ctx.shadowBlur = 14;
                ctx.fillStyle = '#38bdf8';
                ctx.strokeStyle = '#38bdf8';
              } else {
                ctx.fillStyle = isAccent ? '#38bdf8' : baseColor;
                ctx.strokeStyle = baseColor;
              }
              ctx.beginPath();
              ctx.arc(hx, hy, isStepActive ? 4.8 : (isAccent ? 3.8 : 2.8), 0, Math.PI * 2);
              if (isOpen) {
                ctx.lineWidth = 1.8;
                ctx.stroke();
              } else {
                ctx.fill();
              }
              ctx.restore();
            } else {
              ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
              ctx.beginPath();
              ctx.arc(hx, hy, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }

            // 4. Cymbals & Percussion: Crash, Ride, Cowbell (rPerc)
            const crVal = (seq.pattern['crash'] && seq.pattern['crash'][s]) ? seq.pattern['crash'][s] : 0;
            const rdVal = (seq.pattern['ride'] && seq.pattern['ride'][s]) ? seq.pattern['ride'][s] : 0;
            const cbVal = (seq.pattern['cowbell'] && seq.pattern['cowbell'][s]) ? seq.pattern['cowbell'][s] : 0;
            const px = cx + rPerc * cosT;
            const py = cy + rPerc * sinT;
            if (crVal > 0 || rdVal > 0 || cbVal > 0) {
              const isCrash = (crVal > 0);
              const isCowbell = (cbVal > 0 && !isCrash);
              const color = isCrash ? '#eab308' : (isCowbell ? '#a855f7' : '#60a5fa');
              const activeColor = isCrash ? '#fef08a' : (isCowbell ? '#c084fc' : '#93c5fd');
              ctx.save();
              if (isStepActive) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 14;
                ctx.fillStyle = activeColor;
                ctx.strokeStyle = activeColor;
              } else {
                ctx.fillStyle = color;
                ctx.strokeStyle = color;
              }
              ctx.beginPath();
              if (isCrash) {
                // Crash Cymbal: bright accent circle with white stroke
                ctx.arc(px, py, isStepActive ? 5.5 : 4.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
              } else if (isCowbell) {
                // Cowbell: purple accent pip
                ctx.arc(px, py, isStepActive ? 5.2 : 3.8, 0, Math.PI * 2);
                ctx.fill();
              } else {
                // Ride Cymbal: sky blue dot
                ctx.arc(px, py, isStepActive ? 4.5 : 3.2, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            } else {
              ctx.fillStyle = 'rgba(71, 85, 105, 0.3)';
              ctx.beginPath();
              ctx.arc(px, py, 1.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // =========================================================================
      // LAYER 2: Bassline Groove Ring (Middle Orbit)
      // =========================================================================
      if (showBass) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rBassOuter, 0, Math.PI * 2);
        ctx.arc(cx, cy, rBassInner, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.stroke();

        const bassPC = (this.activeChord && (this.activeChord.bassPC !== undefined ? this.activeChord.bassPC : this.activeChord.rootPC)) ?? 0;
        const NOTE_NAMES = window.SongTheory ? window.SongTheory.NOTE_NAMES_SHARP : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const bassName = NOTE_NAMES[bassPC];
        const rMidBass = (rBassInner + rBassOuter) / 2;

        for (let s = 0; s < stepCount; s++) {
          const kHit = seq && seq.pattern && seq.pattern['kick'] && seq.pattern['kick'][s] > 0;
          const isDownbeat = (s % subdiv === 0);
          if (kHit || isDownbeat) {
            const theta = -Math.PI / 2 + (s / stepCount) * Math.PI * 2;
            const bx = cx + rMidBass * Math.cos(theta);
            const by = cy + rMidBass * Math.sin(theta);
            const isStepActive = (currentStep === s);

            ctx.save();
            if (isStepActive) {
              ctx.shadowColor = '#10b981';
              ctx.shadowBlur = 14;
              ctx.fillStyle = '#10b981';
              ctx.strokeStyle = '#34d399';
            } else {
              ctx.fillStyle = '#064e3b';
              ctx.strokeStyle = '#059669';
            }
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, by, isStepActive ? 9 : 7.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(bassName, bx, by);
            ctx.restore();
          }
        }
      }

      // =========================================================================
      // LAYER 3: Guitar / Comping Chords Ring (Inner Orbit)
      // =========================================================================
      if (showGuitar) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.04)';
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rGuitarOuter, 0, Math.PI * 2);
        ctx.arc(cx, cy, rGuitarInner, 0, Math.PI * 2, true);
        ctx.fill();
        ctx.stroke();

        const rMidGuitar = (rGuitarInner + rGuitarOuter) / 2;

        // Comping backbeat strums on each beat of the meter
        for (let b = 0; b < sig.num; b++) {
          const s = b * subdiv;
          const theta = -Math.PI / 2 + (s / stepCount) * Math.PI * 2;
          const gx = cx + rMidGuitar * Math.cos(theta);
          const gy = cy + rMidGuitar * Math.sin(theta);
          const isStepActive = (currentStep === s);

          ctx.save();
          if (isStepActive) {
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#a855f7';
            ctx.strokeStyle = '#c084fc';
          } else {
            ctx.fillStyle = '#3b0764';
            ctx.strokeStyle = '#7e22ce';
          }
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(gx, gy, isStepActive ? 8.5 : 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(isStepActive ? '🎸' : ((b === 1 || b === 3) ? 'St' : '•'), gx, gy);
          ctx.restore();
        }
      }

      // =========================================================================
      // LAYER 4: 12-Tone Chromatic Harmonograph Core (Center Core)
      // =========================================================================
      if (showHarmony) {
        const NOTE_NAMES = window.SongTheory ? window.SongTheory.NOTE_NAMES_SHARP : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Boundary circles of harmony wheel
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rHarmony, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rHarmony * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        const activePCs = this.activeChord ? this.activeChord.pitchClasses : [];

        // Geometric Polygon Line connecting active chord tones
        if (activePCs.length >= 2) {
          const sortedPCs = [...new Set(activePCs)].sort((a, b) => a - b);
          ctx.beginPath();
          sortedPCs.forEach((pc, idx) => {
            const angle = -Math.PI / 2 + (pc * (Math.PI * 2) / 12);
            const x = cx + rHarmony * Math.cos(angle);
            const y = cy + rHarmony * Math.sin(angle);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();

          ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
          ctx.fill();

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }

        // 12 Pitch Class Nodes
        const isCompactCore = (showDrums || showBass || showGuitar);
        const activeNodeRadius = isCompactCore ? 14 : 19;
        const inactiveNodeRadius = isCompactCore ? 10 : 14;

        for (let pc = 0; pc < 12; pc++) {
          const angle = -Math.PI / 2 + (pc * (Math.PI * 2) / 12);
          const x = cx + rHarmony * Math.cos(angle);
          const y = cy + rHarmony * Math.sin(angle);

          const isActive = activePCs.includes(pc);
          const role = isActive ? this.getIntervalRole(pc) : null;
          const nodeRadius = isActive ? activeNodeRadius : inactiveNodeRadius;

          this.harmonicNodeHits.push({ pc, x, y, radius: nodeRadius + 4 });

          if (isActive) {
            ctx.save();
            ctx.shadowColor = role.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = role.color;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (this.activeMelodyPC === pc) {
              ctx.save();
              ctx.shadowColor = '#fef08a';
              ctx.shadowBlur = 14;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(x, y, nodeRadius + 4, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          } else {
            ctx.fillStyle = this.colors.cardBg;
            ctx.strokeStyle = this.colors.inactive;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          ctx.fillStyle = isActive ? '#0f172a' : this.colors.inactiveText;
          ctx.font = isActive ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const noteName = NOTE_NAMES[pc];
          ctx.fillText(noteName, x, y + (isActive && !isCompactCore ? -3 : 0));

          if (isActive && role && !isCompactCore) {
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText(role.name, x, y + 8);
          }
        }

        // Center Chord Name & Quality
        if (this.activeChord) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = isCompactCore ? 'bold 13px sans-serif' : 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.activeChord.displayName, cx, cy - 7);

          ctx.fillStyle = '#94a3b8';
          ctx.font = isCompactCore ? '10px sans-serif' : '12px sans-serif';
          ctx.fillText(this.activeChord.qualityName, cx, cy + 10);
        }
      } else {
        // If harmony core is hidden, show center groove hub
        ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GROOVE', cx, cy - 6);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        const bpm = (window.app && window.app.getBpm) ? window.app.getBpm() : 113;
        ctx.fillText(`${bpm} BPM`, cx, cy + 8);
      }
    }

    renderPianoKeyboard() {
      const startMidi = 48; // C3
      const numWhiteKeys = 17; // C3 to E5
      const whiteKeyWidth = Math.floor(this.width / numWhiteKeys);
      const whiteKeyHeight = Math.min(this.height * 0.75, 260);
      const blackKeyWidth = whiteKeyWidth * 0.6;
      const blackKeyHeight = whiteKeyHeight * 0.62;

      const startX = (this.width - (numWhiteKeys * whiteKeyWidth)) / 2;
      const startY = (this.height - whiteKeyHeight) / 2;

      const NOTE_NAMES = window.SongTheory ? window.SongTheory.NOTE_NAMES_SHARP : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const activePCs = this.activeChord ? this.activeChord.pitchClasses : [];
      this.pianoKeyHits = [];

      let whiteIdx = 0;
      const whiteNotesPattern = [0, 2, 4, 5, 7, 9, 11];

      for (let midi = startMidi; whiteIdx < numWhiteKeys; midi++) {
        const pc = midi % 12;
        const isWhite = whiteNotesPattern.includes(pc);

        if (isWhite) {
          const kx = startX + (whiteIdx * whiteKeyWidth);
          const ky = startY;
          const isActive = activePCs.includes(pc);
          const role = isActive ? this.getIntervalRole(pc) : null;

          this.ctx.fillStyle = isActive ? role.color : '#f8fafc';
          this.ctx.strokeStyle = '#334155';
          this.ctx.lineWidth = 1;

          this.ctx.fillRect(kx, ky, whiteKeyWidth - 1, whiteKeyHeight);
          this.ctx.strokeRect(kx, ky, whiteKeyWidth - 1, whiteKeyHeight);

          this.ctx.fillStyle = isActive ? '#0f172a' : '#64748b';
          this.ctx.font = isActive ? 'bold 12px sans-serif' : '11px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(NOTE_NAMES[pc], kx + whiteKeyWidth / 2, ky + whiteKeyHeight - 20);

          if (isActive && role) {
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.fillText(role.name, kx + whiteKeyWidth / 2, ky + whiteKeyHeight - 36);
          }

          if (isActive && this.activeMelodyPC === pc) {
            this.ctx.save();
            this.ctx.shadowColor = '#f59e0b';
            this.ctx.shadowBlur = 12;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(kx + 1, ky + 1, whiteKeyWidth - 3, whiteKeyHeight - 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(kx + whiteKeyWidth / 2, ky + 16, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
          }

          this.pianoKeyHits.push({
            midi, pc, isBlack: false,
            x: kx, y: ky, w: whiteKeyWidth, h: whiteKeyHeight
          });

          whiteIdx++;
        }
      }

      whiteIdx = 0;
      for (let midi = startMidi; whiteIdx < numWhiteKeys - 1; midi++) {
        const pc = midi % 12;
        const isWhite = whiteNotesPattern.includes(pc);

        if (isWhite) {
          const nextPC = (pc + 1) % 12;
          if (!whiteNotesPattern.includes(nextPC)) {
            const bkx = startX + ((whiteIdx + 1) * whiteKeyWidth) - (blackKeyWidth / 2);
            const bky = startY;
            const isActive = activePCs.includes(nextPC);
            const role = isActive ? this.getIntervalRole(nextPC) : null;

            this.ctx.fillStyle = isActive ? role.color : '#0f172a';
            this.ctx.strokeStyle = '#475569';
            this.ctx.lineWidth = 1;

            this.ctx.fillRect(bkx, bky, blackKeyWidth, blackKeyHeight);
            this.ctx.strokeRect(bkx, bky, blackKeyWidth, blackKeyHeight);

            if (isActive && role) {
              this.ctx.fillStyle = '#0f172a';
              this.ctx.font = 'bold 9px sans-serif';
              this.ctx.textAlign = 'center';
              this.ctx.fillText(NOTE_NAMES[nextPC], bkx + blackKeyWidth / 2, bky + blackKeyHeight - 20);
              this.ctx.fillText(role.name, bkx + blackKeyWidth / 2, bky + blackKeyHeight - 8);
            }

            if (isActive && this.activeMelodyPC === nextPC) {
              this.ctx.save();
              this.ctx.shadowColor = '#f59e0b';
              this.ctx.shadowBlur = 12;
              this.ctx.strokeStyle = '#ffffff';
              this.ctx.lineWidth = 2.5;
              this.ctx.strokeRect(bkx + 1, bky + 1, blackKeyWidth - 2, blackKeyHeight - 2);
              this.ctx.fillStyle = '#ffffff';
              this.ctx.beginPath();
              this.ctx.arc(bkx + blackKeyWidth / 2, bky + 12, 4, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.restore();
            }

            this.pianoKeyHits.push({
              midi: midi + 1, pc: nextPC, isBlack: true,
              x: bkx, y: bky, w: blackKeyWidth, h: blackKeyHeight
            });
          }
          whiteIdx++;
        }
      }
    }

    renderFretboard() {
      const isBass = this.fretboardInstrument === 'bass';
      const stringTuning = isBass ? this.bassStrings : this.guitarStrings;
      const stringLabels = isBass ? this.bassStringNotes : this.guitarStringNotes;
      const numStrings = stringTuning.length;

      const marginX = 40;
      const marginY = 40;
      const fretboardW = this.width - marginX * 2;
      const fretboardH = this.height - marginY * 2;

      const fretWidth = fretboardW / (this.numFrets + 1);
      const stringSpacing = fretboardH / (numStrings - 1);

      this.ctx.fillStyle = this.colors.wood;
      this.ctx.fillRect(marginX + fretWidth, marginY, fretboardW - fretWidth, fretboardH);

      const singleDots = [3, 5, 7, 9, 15];
      const doubleDots = [12];

      this.ctx.fillStyle = '#475569';
      singleDots.forEach(fret => {
        if (fret <= this.numFrets) {
          const fx = marginX + (fret * fretWidth) + (fretWidth / 2);
          const fy = marginY + (fretboardH / 2);
          this.ctx.beginPath();
          this.ctx.arc(fx, fy, 5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });

      doubleDots.forEach(fret => {
        if (fret <= this.numFrets) {
          const fx = marginX + (fret * fretWidth) + (fretWidth / 2);
          const offset = fretboardH * 0.25;
          this.ctx.beginPath();
          this.ctx.arc(fx, marginY + offset, 4.5, 0, Math.PI * 2);
          this.ctx.arc(fx, marginY + fretboardH - offset, 4.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });

      for (let f = 1; f <= this.numFrets + 1; f++) {
        const fx = marginX + (f * fretWidth);
        this.ctx.strokeStyle = (f === 1) ? '#cbd5e1' : this.colors.fretWire;
        this.ctx.lineWidth = (f === 1) ? 4 : 2;
        this.ctx.beginPath();
        this.ctx.moveTo(fx, marginY);
        this.ctx.lineTo(fx, marginY + fretboardH);
        this.ctx.stroke();

        if (f <= this.numFrets) {
          this.ctx.fillStyle = '#64748b';
          this.ctx.font = '10px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(`${f}`, fx + fretWidth / 2, marginY + fretboardH + 16);
        }
      }

      for (let s = 0; s < numStrings; s++) {
        const sy = marginY + (s * stringSpacing);
        const stringThickness = 1 + (s * 0.6);

        this.ctx.strokeStyle = '#94a3b8';
        this.ctx.lineWidth = stringThickness;
        this.ctx.beginPath();
        this.ctx.moveTo(marginX, sy);
        this.ctx.lineTo(marginX + fretboardW, sy);
        this.ctx.stroke();

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(stringLabels[s].substring(0, 2), marginX - 8, sy + 4);
      }

      const activePCs = this.activeChord ? this.activeChord.pitchClasses : [];
      if (activePCs.length === 0) return;

      const NOTE_NAMES = window.SongTheory ? window.SongTheory.NOTE_NAMES_SHARP : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      for (let s = 0; s < numStrings; s++) {
        const openPC = stringTuning[s];
        const sy = marginY + (s * stringSpacing);

        for (let f = 0; f <= this.numFrets; f++) {
          const notePC = (openPC + f) % 12;
          if (activePCs.includes(notePC)) {
            const role = this.getIntervalRole(notePC);
            const nx = (f === 0) ? (marginX + (fretWidth / 2)) : (marginX + (f * fretWidth) + (fretWidth / 2));
            const nodeRadius = 11;

            this.ctx.save();
            this.ctx.shadowColor = role.color;
            this.ctx.shadowBlur = 8;
            this.ctx.fillStyle = role.color;
            this.ctx.beginPath();
            this.ctx.arc(nx, sy, nodeRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            this.ctx.fillStyle = '#0f172a';
            this.ctx.font = 'bold 10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(NOTE_NAMES[notePC], nx, sy);

            if (this.activeMelodyPC === notePC) {
              this.ctx.save();
              this.ctx.shadowColor = '#f59e0b';
              this.ctx.shadowBlur = 14;
              this.ctx.strokeStyle = '#ffffff';
              this.ctx.lineWidth = 3;
              this.ctx.beginPath();
              this.ctx.arc(nx, sy, nodeRadius + 4, 0, Math.PI * 2);
              this.ctx.stroke();
              this.ctx.restore();
            }
          }
        }
      }
    }

    setupInteractivity() {
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / (rect.width || 1);
        const scaleY = this.height / (rect.height || 1);
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.mode === 'clock') {
          // 1. Check drum wheel click
          if (this.layers.drums && this.wheelMetrics) {
            const { cx, cy, rDrumInner, rDrumOuter } = this.wheelMetrics;
            const dist = Math.hypot(x - cx, y - cy);

            if (dist >= rDrumInner && dist <= rDrumOuter) {
              let angle = Math.atan2(y - cy, x - cx) + Math.PI / 2;
              if (angle < 0) angle += Math.PI * 2;
              const step = Math.floor((angle / (Math.PI * 2)) * 16) % 16;

              const seq = (window.app && window.app.beatSequencer) || window.drumMachine;
              if (seq) {
                let trackId = 'kick';
                const rel = (dist - rDrumInner) / (rDrumOuter - rDrumInner);
                if (rel > 0.62) trackId = 'closedHat';
                else if (rel > 0.32) trackId = 'snare';
                else trackId = 'kick';

                const nextVal = seq.cycleStep(trackId, step);
                if (seq.synth && nextVal > 0) {
                  const toneNow = (typeof Tone !== 'undefined') ? Tone.now() : 0;
                  seq.synth.playVoice(trackId, toneNow, nextVal === 2 ? 1.35 : 1.0);
                }
                this.render();
                if (window.app && window.app.renderBeatGrid) {
                  window.app.renderBeatGrid();
                }
              }
              return;
            }
          }

          // 2. Check pitch class core click
          if (this.layers.harmony && this.harmonicNodeHits && this.harmonicNodeHits.length > 0) {
            const hit = this.harmonicNodeHits.find(n => Math.hypot(x - n.x, y - n.y) <= n.radius);
            if (hit && this.onNoteClick) {
              this.onNoteClick(hit.pc, 60 + hit.pc);
              return;
            }
          }
        }

        if (this.mode === 'piano' && this.pianoKeyHits) {
          const hitBlack = this.pianoKeyHits.filter(k => k.isBlack).find(k => (
            x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h
          ));
          const hit = hitBlack || this.pianoKeyHits.filter(k => !k.isBlack).find(k => (
            x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h
          ));

          if (hit && this.onNoteClick) {
            this.onNoteClick(hit.pc, hit.midi);
          }
        }
      });
    }
  }

  window.Visualizer = Visualizer;

})(typeof window !== 'undefined' ? window : globalThis);
