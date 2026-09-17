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

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener('resize', this.handleResize);
      this.setupInteractivity();
      this.handleResize();
    }

    setMode(newMode) {
      this.mode = newMode;
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

    handleResize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      let height;
      if (this.mode === 'clock') {
        height = Math.min(Math.max(width * 0.85, 260), 440);
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
      const cx = this.width / 2;
      const cy = this.height / 2;
      const radius = Math.min(cx, cy) - 45;

      const NOTE_NAMES = window.SongTheory ? window.SongTheory.NOTE_NAMES_SHARP : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

      // Outer circle ring
      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = '#1e293b';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, radius * 0.65, 0, Math.PI * 2);
      this.ctx.stroke();

      const activePCs = this.activeChord ? this.activeChord.pitchClasses : [];

      if (activePCs.length >= 2) {
        const sortedPCs = [...new Set(activePCs)].sort((a, b) => a - b);

        this.ctx.beginPath();
        sortedPCs.forEach((pc, idx) => {
          const angle = -Math.PI / 2 + (pc * (Math.PI * 2) / 12);
          const x = cx + radius * Math.cos(angle);
          const y = cy + radius * Math.sin(angle);
          if (idx === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        });
        this.ctx.closePath();

        this.ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        this.ctx.fill();

        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
      }

      for (let pc = 0; pc < 12; pc++) {
        const angle = -Math.PI / 2 + (pc * (Math.PI * 2) / 12);
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        const isActive = activePCs.includes(pc);
        const role = isActive ? this.getIntervalRole(pc) : null;
        const nodeRadius = isActive ? 19 : 14;

        if (isActive) {
          this.ctx.save();
          this.ctx.shadowColor = role.color;
          this.ctx.shadowBlur = 12;
          this.ctx.fillStyle = role.color;
          this.ctx.beginPath();
          this.ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.restore();
        } else {
          this.ctx.fillStyle = this.colors.cardBg;
          this.ctx.strokeStyle = this.colors.inactive;
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();
        }

        this.ctx.fillStyle = isActive ? '#0f172a' : this.colors.inactiveText;
        this.ctx.font = isActive ? 'bold 12px sans-serif' : '11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const noteName = NOTE_NAMES[pc];
        this.ctx.fillText(noteName, x, y + (isActive ? -3 : 0));

        if (isActive && role) {
          this.ctx.fillStyle = '#0f172a';
          this.ctx.font = 'bold 9px sans-serif';
          this.ctx.fillText(role.name, x, y + 8);
        }

        const labelRadius = radius + 24;
        const lx = cx + labelRadius * Math.cos(angle);
        const ly = cy + labelRadius * Math.sin(angle);
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '10px monospace';
        this.ctx.fillText(`${pc}`, lx, ly);
      }

      if (this.activeChord) {
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(this.activeChord.displayName, cx, cy - 8);

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText(this.activeChord.qualityName, cx, cy + 12);
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
          }
        }
      }
    }

    setupInteractivity() {
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

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
