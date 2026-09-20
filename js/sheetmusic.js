/**
 * Song Analyzer - Rhythm Sheet Music & Notation Engine (js/sheetmusic.js)
 * 100% Offline Procedural Musical Staff Renderer for Drum & Percussion Rhythms
 *
 * Features:
 * - High-DPI Canvas 5-line musical staff with neutral percussion clef & time signature
 * - Procedural noteheads (Quarter, 8th, 16th, Half), up-stems, flags, and horizontal beam bars
 * - Classical musical rest symbols (Quarter, 8th, 16th, Half rests)
 * - Measure bar lines and beat boundary indicators
 * - Real-time sweeping playhead needle & active note glow synced with audio playback
 * - Interactive note click hit-testing for auditioning
 */

(function (window) {
  'use strict';

  class SheetMusicRenderer {
    constructor(canvasElement) {
      this.canvas = canvasElement;
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.items = [];
      this.activeStep = -1;
      this.totalSteps = 16;
      this.timeSignature = { num: 4, den: 4 };
      this.onNoteClick = null;
      this.hitZones = [];

      this.width = 800;
      this.height = 145;

      this.handleResize = this.handleResize.bind(this);
      window.addEventListener('resize', this.handleResize);
      this.setupInteractivity();
      this.handleResize();
    }

    handleResize() {
      if (!this.canvas) return;

      // Measure Beat Builder Grid Pad positions if present in DOM
      const pad0 = document.querySelector('#beatGridContainer .beat-pad[data-step="0"]');
      const pad1 = document.querySelector('#beatGridContainer .beat-pad[data-step="1"]');
      const gridTable = document.getElementById('beatGridContainer');

      let pad0Left = 109;
      let padStepW = 33;
      let padW = 30;

      if (pad0 && gridTable) {
        const gridRect = gridTable.getBoundingClientRect();
        const p0Rect = pad0.getBoundingClientRect();
        pad0Left = Math.round(p0Rect.left - gridRect.left);
        padW = Math.round(p0Rect.width);
        if (pad1) {
          const p1Rect = pad1.getBoundingClientRect();
          padStepW = Math.round(p1Rect.left - p0Rect.left);
        }
      }

      this.pad0Left = pad0Left;
      this.padStepW = padStepW;
      this.padW = padW;

      const totalSteps = Math.max(1, this.totalSteps || 16);
      const gridTotalW = Math.round(pad0Left + totalSteps * padStepW + 8);
      const parentW = this.canvas.parentElement?.clientWidth || 0;
      this.width = Math.max(gridTotalW, parentW > 50 ? parentW : 650);
      this.height = 145;

      this.canvas.style.width = `${this.width}px`;

      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);

      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.render();
    }

    setRhythm(items, timeSig = { num: 4, den: 4 }, totalSteps = 16) {
      this.items = items || [];
      this.timeSignature = timeSig || { num: 4, den: 4 };
      this.totalSteps = totalSteps || 16;
      this.handleResize();
    }

    requestRender() {
      if (!this.canvas || this.canvas.offsetParent === null) return;
      if (this._renderRafId) return;
      this._renderRafId = requestAnimationFrame(() => {
        this._renderRafId = null;
        this.render();
      });
    }

    setActiveStep(stepIdx) {
      if (this.activeStep === stepIdx) return;
      this.activeStep = stepIdx;
      this.requestRender();
    }

    setActiveNoteIndex(noteIdx) {
      if (noteIdx < 0 || !this.items || noteIdx >= this.items.length) {
        this.activeStep = -1;
      } else {
        let cur = 0;
        for (let i = 0; i < noteIdx; i++) {
          const item = this.items[i];
          cur += (item.stepCount || Math.max(1, Math.round((item.value || 32) / 8)));
        }
        this.activeStep = cur;
      }
      this.requestRender();
    }

    setupInteractivity() {
      if (!this.canvas) return;
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = this.hitZones.find(z => x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2);
        if (hit && this.onNoteClick) {
          this.onNoteClick(hit.item, hit.index);
        }
      });
    }

    render() {
      if (!this.ctx || !this.canvas) return;
      if (this.canvas.offsetParent === null) return; // Skip rendering when hidden on inactive tab
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Card Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      const pad0Left = (this.pad0Left !== undefined) ? this.pad0Left : 109;
      const padStepW = (this.padStepW !== undefined) ? this.padStepW : 33;
      const padW = (this.padW !== undefined) ? this.padW : 30;
      const totalSteps = Math.max(1, this.totalSteps || 16);

      const startX = 14;
      const staffEndX = Math.round(pad0Left + totalSteps * padStepW + 8);
      const staffY = 62;
      const lineSpacing = 9;

      // 2. Five Staff Lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      for (let i = -2; i <= 2; i++) {
        const y = staffY + i * lineSpacing;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(staffEndX, y);
        ctx.stroke();
      }

      // 3. Neutral Percussion Clef (two parallel thick vertical bars on middle 3 lines)
      const clefX = 35;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(clefX, staffY - lineSpacing, 3.5, lineSpacing * 2);
      ctx.fillRect(clefX + 7, staffY - lineSpacing, 3.5, lineSpacing * 2);

      // 4. Time Signature
      const tsX = 75;
      const numStr = `${this.timeSignature.num || 4}`;
      const denStr = `${this.timeSignature.den || 4}`;
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px "Century Schoolbook", "Times New Roman", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(numStr, tsX, staffY - lineSpacing * 0.9);
      ctx.fillText(denStr, tsX, staffY + lineSpacing * 0.9);

      // 5. Initial Measure Barline (sits right before Pad 0)
      const measureStartX = pad0Left - 2;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(measureStartX, staffY - 2 * lineSpacing);
      ctx.lineTo(measureStartX, staffY + 2 * lineSpacing);
      ctx.stroke();

      // 6. Measure Barlines & Beat Division Ticks
      const subdiv = (this.timeSignature.den === 8) ? (this.timeSignature.sub || 2) : 4;
      const stepsPerBar = (this.timeSignature.num || 4) * subdiv;

      for (let s = 1; s < totalSteps; s++) {
        const bx = pad0Left + s * padStepW;
        if (s % stepsPerBar === 0) {
          // Internal Measure Barline (e.g. multi-bar sequences)
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx - 2, staffY - 2 * lineSpacing);
          ctx.lineTo(bx - 2, staffY + 2 * lineSpacing);
          ctx.stroke();
        } else if (s % subdiv === 0) {
          // Beat Division Tick along bottom line
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, staffY + 2 * lineSpacing);
          ctx.lineTo(bx, staffY + 2 * lineSpacing + 6);
          ctx.stroke();
        }
      }

      // 7. Ending Double Barline (at right edge of the last step pad)
      const measureEndX = pad0Left + totalSteps * padStepW;
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(measureEndX - 5, staffY - 2 * lineSpacing);
      ctx.lineTo(measureEndX - 5, staffY + 2 * lineSpacing);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(measureEndX, staffY - 2 * lineSpacing);
      ctx.lineTo(measureEndX, staffY + 2 * lineSpacing);
      ctx.stroke();

      this.hitZones = [];
      const renderedNotes = [];
      let curStep = 0;

      this.items.forEach((item, idx) => {
        const stepCount = item.stepCount || Math.max(1, Math.round((item.value || 32) / 8));
        const itemStartStep = curStep;
        const itemEndStep = curStep + stepCount;
        curStep += stepCount;

        // Position notehead at the sound onset step; rests centered in their span
        const xCenter = item.isRest
          ? pad0Left + itemStartStep * padStepW + (stepCount * padStepW) * 0.5
          : pad0Left + itemStartStep * padStepW + padW * 0.5;

        const isActive = (this.activeStep >= itemStartStep && this.activeStep < itemEndStep);

        const stemX = xCenter + 5.5;
        const stemTopY = staffY - 27;

        renderedNotes.push({
          item,
          index: idx,
          startStep: itemStartStep,
          endStep: itemEndStep,
          stepCount,
          x: xCenter,
          stemX,
          stemTopY,
          isActive,
          isRest: !!item.isRest,
          isBeamed: false
        });

        // Register hit zone for clicking
        const zoneX1 = pad0Left + itemStartStep * padStepW;
        const zoneX2 = zoneX1 + stepCount * padStepW;
        this.hitZones.push({
          x1: zoneX1,
          x2: zoneX2,
          y1: staffY - 32,
          y2: staffY + 48,
          item,
          index: idx
        });
      });

      // Calculate Beaming for consecutive 8th and 16th notes within each beat
      const beatSize = subdiv;
      const beamGroups = [];
      let curBeamGroup = [];

      renderedNotes.forEach((n) => {
        const isBeamable = !n.isRest && (n.stepCount <= 2);
        const beatIdx = Math.floor(n.startStep / beatSize);

        if (isBeamable) {
          if (curBeamGroup.length === 0) {
            curBeamGroup.push(n);
          } else {
            const prev = curBeamGroup[curBeamGroup.length - 1];
            const prevBeatIdx = Math.floor(prev.startStep / beatSize);
            if (prevBeatIdx === beatIdx) {
              curBeamGroup.push(n);
            } else {
              if (curBeamGroup.length >= 2) beamGroups.push([...curBeamGroup]);
              curBeamGroup = [n];
            }
          }
        } else {
          if (curBeamGroup.length >= 2) beamGroups.push([...curBeamGroup]);
          curBeamGroup = [];
        }
      });
      if (curBeamGroup.length >= 2) beamGroups.push([...curBeamGroup]);

      beamGroups.forEach(grp => {
        grp.forEach(n => { n.isBeamed = true; });
      });

      // 9. Render Notes & Rests
      renderedNotes.forEach((n) => {
        const { item, x, isActive, isRest, stepCount, stemX, stemTopY, isBeamed } = n;
        const mainColor = isActive ? '#38bdf8' : '#e2e8f0';

        if (isActive) {
          // Glow highlight halo behind active note
          ctx.save();
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 18;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.beginPath();
          ctx.arc(x, staffY, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (isRest) {
          // --- REST DRAWING ---
          ctx.save();
          ctx.fillStyle = isActive ? '#38bdf8' : '#94a3b8';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          if (stepCount >= 8) {
            // Half Rest (filled block on top of line 3)
            ctx.fillStyle = isActive ? '#38bdf8' : '#cbd5e1';
            ctx.fillRect(x - 6, staffY - 5, 12, 5);
          } else if (stepCount >= 4) {
            // Quarter Rest (Unicode 𝄽 or drawn symbol)
            ctx.font = '24px sans-serif';
            ctx.fillText('𝄽', x, staffY);
          } else if (stepCount === 2) {
            // Eighth Rest (Unicode 𝄾)
            ctx.font = '22px sans-serif';
            ctx.fillText('𝄾', x, staffY);
          } else {
            // 16th Rest (Unicode 𝄿)
            ctx.font = '22px sans-serif';
            ctx.fillText('𝄿', x, staffY);
          }
          ctx.restore();
        } else {
          // --- NOTE DRAWING ---
          const isHalf = stepCount >= 8;
          const isQuarter = stepCount >= 4 && stepCount < 8;
          const isEighth = stepCount === 2 || stepCount === 3;
          const is16th = stepCount <= 1;

          ctx.save();

          // 1. Notehead (tilted oval centered on middle line staffY)
          ctx.save();
          ctx.translate(x, staffY);
          ctx.rotate(-0.35); // -20 degrees slant

          ctx.beginPath();
          ctx.ellipse(0, 0, 6.2, 4.5, 0, 0, Math.PI * 2);

          if (isHalf) {
            ctx.strokeStyle = isActive ? '#38bdf8' : '#f8fafc';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          } else {
            ctx.fillStyle = isActive ? '#38bdf8' : '#f8fafc';
            ctx.shadowColor = isActive ? '#38bdf8' : 'transparent';
            ctx.shadowBlur = isActive ? 12 : 0;
            ctx.fill();
          }
          ctx.restore();

          // 2. Up-Stem
          ctx.strokeStyle = isActive ? '#38bdf8' : '#cbd5e1';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(stemX, staffY);
          ctx.lineTo(stemX, stemTopY);
          ctx.stroke();

          // 3. Flags (only for isolated, unbeamed notes)
          if (!isBeamed) {
            if (isEighth) {
              // Curved single flag
              ctx.fillStyle = isActive ? '#38bdf8' : '#cbd5e1';
              ctx.beginPath();
              ctx.moveTo(stemX, stemTopY);
              ctx.bezierCurveTo(stemX + 8, stemTopY + 3, stemX + 9, stemTopY + 11, stemX + 1, stemTopY + 16);
              ctx.lineTo(stemX + 1, stemTopY + 13);
              ctx.bezierCurveTo(stemX + 6, stemTopY + 9, stemX + 5, stemTopY + 3, stemX, stemTopY);
              ctx.fill();
            } else if (is16th) {
              // Double curved flag
              ctx.fillStyle = isActive ? '#38bdf8' : '#cbd5e1';
              // Flag 1
              ctx.beginPath();
              ctx.moveTo(stemX, stemTopY);
              ctx.bezierCurveTo(stemX + 8, stemTopY + 2, stemX + 8, stemTopY + 8, stemX + 1, stemTopY + 12);
              ctx.lineTo(stemX + 1, stemTopY + 10);
              ctx.bezierCurveTo(stemX + 5, stemTopY + 6, stemX + 4, stemTopY + 2, stemX, stemTopY);
              ctx.fill();
              // Flag 2
              ctx.beginPath();
              ctx.moveTo(stemX, stemTopY + 7);
              ctx.bezierCurveTo(stemX + 8, stemTopY + 9, stemX + 8, stemTopY + 15, stemX + 1, stemTopY + 19);
              ctx.lineTo(stemX + 1, stemTopY + 17);
              ctx.bezierCurveTo(stemX + 5, stemTopY + 13, stemX + 4, stemTopY + 9, stemX, stemTopY + 7);
              ctx.fill();
            }
          }

          // Accent mark (>) if accented
          if (item.isAccent || item.value === 'accent') {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(x - 5, staffY - 33);
            ctx.lineTo(x + 5, staffY - 30);
            ctx.lineTo(x - 5, staffY - 27);
            ctx.stroke();
          }

          ctx.restore();
        }

        // 4. Compact Duration Pill Below Note
        ctx.save();
        const pillY = staffY + 34;
        const durLabel = item.isRest
          ? 'Rest'
          : (stepCount >= 8 ? '1/2' : stepCount >= 4 ? '1/4' : stepCount === 2 ? '1/8' : '1/16');

        ctx.fillStyle = isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.7)';
        ctx.strokeStyle = isActive ? '#38bdf8' : '#334155';
        ctx.lineWidth = 1;

        const tagText = durLabel;
        ctx.font = '9px monospace';
        const txtWidth = ctx.measureText(tagText).width;
        const pillW = Math.max(20, txtWidth + 6);

        ctx.beginPath();
        ctx.roundRect(x - pillW / 2, pillY - 7, pillW, 14, 3);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isActive ? '#38bdf8' : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, x, pillY);
        ctx.restore();
      });

      // 10. Render Horizontal Beams for Beamed Groups
      beamGroups.forEach(grp => {
        const first = grp[0];
        const last = grp[grp.length - 1];
        const hasActive = grp.some(n => n.isActive);
        const beamColor = hasActive ? '#38bdf8' : '#cbd5e1';

        ctx.save();
        ctx.fillStyle = beamColor;

        // Primary Beam (8th-level beam) connecting stem tops across whole group
        ctx.fillRect(first.stemX - 0.8, first.stemTopY - 1.5, (last.stemX - first.stemX) + 1.6, 3.5);

        // Secondary Beams (16th-level beam) for 16th notes
        for (let i = 0; i < grp.length; i++) {
          const cur = grp[i];
          if (cur.stepCount <= 1) {
            const next = (i < grp.length - 1) ? grp[i + 1] : null;
            const prev = (i > 0) ? grp[i - 1] : null;

            if (next && next.stepCount <= 1) {
              // Full secondary beam to adjacent 16th note
              ctx.fillRect(cur.stemX - 0.8, cur.stemTopY + 3.8, (next.stemX - cur.stemX) + 1.6, 3.2);
            } else if (!prev || prev.stepCount > 1) {
              // Fractional stub beam pointing inward toward group
              const stubDir = next ? 1 : -1;
              const stubLen = 7 * stubDir;
              const sx = (stubDir > 0) ? cur.stemX - 0.8 : cur.stemX + 0.8 + stubLen;
              ctx.fillRect(sx, cur.stemTopY + 3.8, Math.abs(stubLen), 3.2);
            }
          }
        }
        ctx.restore();
      });

      // 10. Real-Time Sweeping Playhead Needle
      if (this.activeStep >= 0 && this.activeStep < totalSteps) {
        const playheadX = pad0Left + this.activeStep * padStepW + padW * 0.5;

        ctx.save();
        // Needle line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(playheadX, staffY - 28);
        ctx.lineTo(playheadX, staffY + 44);
        ctx.stroke();

        // Top cap indicator
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(playheadX, staffY - 28, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  window.SheetMusicRenderer = SheetMusicRenderer;

})(window);
