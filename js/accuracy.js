/**
 * Song Analyzer - Rhythmic Accuracy Analyzer & "Pocket Meter" (js/accuracy.js)
 * 100% Offline Client-Side Rhythm Timing Analysis Engine
 * 
 * Features:
 * - Real-time microphone/instrument transient & onset detection via Web Audio API
 * - Sub-millisecond transient timestamping using energy flux differential
 * - Quantized comparison against sample-accurate Metronome & Drum Machine lookahead clock
 * - Visual "Pocket Meter" needle gauge (-50ms Drag to +50ms Rush with +/- 6ms Pocket sweet zone)
 * - Scrolling 4-Bar Beat Accuracy Heatmap timeline canvas with color-coded tightness dots
 * - Real-time Session Scorecard: Groove Accuracy %, Mean Delta (ms), Consistency, Beat Breakdown
 * - Hardware Latency Calibration & Transient Noise Gate
 * - Exportable timing practice report (.txt)
 */

(function (window) {
  'use strict';

  class RhythmicAccuracyEngine {
    constructor() {
      this.audioContext = null;
      this.mediaStream = null;
      this.sourceNode = null;
      this.processorNode = null;
      this.gainNode = null;

      this.isRunning = false;
      this.subdivision = 'quarter'; // 'quarter', 'eighth', 'sixteenth', 'triplet'
      this.sensitivity = 0.5; // 0.1 (low) to 1.0 (high)
      this.noiseGate = 0.012; // Minimum RMS to consider
      this.latencyOffsetMs = 12; // Audio hardware input latency compensation (ms)
      this.refractoryFrames = 0;

      // Current live hit state
      this.lastHit = null; // { time, deltaMs, rating, bar, beat, subIdx }
      this.hitHistory = []; // Array of recorded hits in current session
      this.maxHistory = 200;

      // Stats cache
      this.stats = {
        totalHits: 0,
        pocketCount: 0,
        earlyCount: 0,
        lateCount: 0,
        grooveAccuracy: 100,
        meanDeltaMs: 0,
        consistencyScore: 100,
        beatBreakdown: {} // { 1: { count, avgDelta }, 2: ... }
      };

      // Callbacks for live UI updates
      this.onHit = null;
      this.onStateChange = null;
    }

    async start() {
      if (this.isRunning) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = (window.audio && window.audio.ctx) ? window.audio.ctx : new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
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
        console.error("Accuracy Engine getUserMedia error:", err);
        throw err;
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Use 512-sample buffer for low-latency transient processing (11.6ms chunks at 44.1kHz)
      const bufferSize = 512;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      let prevEnergy = 0;
      const sampleRate = this.audioContext.sampleRate;
      const winSize = 32;

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isRunning) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const N = inputData.length;
        const bufferEndTime = this.audioContext.currentTime;
        const bufferStartTime = bufferEndTime - (N / sampleRate);

        // Compute threshold based on sensitivity slider (0.1 to 1.0)
        // High sensitivity = lower threshold
        const onsetThreshold = 0.003 * Math.pow(1.1 - this.sensitivity, 2);

        for (let i = 0; i < N; i += winSize) {
          let energy = 0;
          for (let j = 0; j < winSize && (i + j) < N; j++) {
            const v = inputData[i + j];
            energy += v * v;
          }
          energy /= winSize;

          const deltaEnergy = energy - prevEnergy;
          prevEnergy = energy;

          if (this.refractoryFrames > 0) {
            this.refractoryFrames--;
            continue;
          }

          if (deltaEnergy > onsetThreshold && energy > this.noiseGate) {
            // Transient onset detected!
            const hitSample = i;
            const rawHitTime = bufferStartTime + (hitSample / sampleRate);

            // Refractory lockout for 65ms to prevent note sustain / decay jitter
            this.refractoryFrames = Math.floor(0.065 * (sampleRate / winSize));

            this.evaluateHit(rawHitTime);
          }
        }
      };

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isRunning = true;
      if (typeof this.onStateChange === 'function') {
        this.onStateChange(true);
      }
    }

    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      if (this.sourceNode) {
        try { this.sourceNode.disconnect(); } catch (e) {}
        this.sourceNode = null;
      }

      if (this.processorNode) {
        try { this.processorNode.disconnect(); } catch (e) {}
        this.processorNode = null;
      }

      if (this.gainNode) {
        try { this.gainNode.disconnect(); } catch (e) {}
        this.gainNode = null;
      }

      if (typeof this.onStateChange === 'function') {
        this.onStateChange(false);
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

    reset() {
      this.lastHit = null;
      this.hitHistory = [];
      this.stats = {
        totalHits: 0,
        pocketCount: 0,
        earlyCount: 0,
        lateCount: 0,
        grooveAccuracy: 100,
        meanDeltaMs: 0,
        consistencyScore: 100,
        beatBreakdown: {}
      };
    }

    setSubdivision(sub) {
      if (['quarter', 'eighth', 'sixteenth', 'triplet'].includes(sub)) {
        this.subdivision = sub;
      }
    }

    setSensitivity(val) {
      this.sensitivity = Math.max(0.1, Math.min(1.0, parseFloat(val) || 0.5));
    }

    setLatencyOffset(ms) {
      this.latencyOffsetMs = Math.max(-50, Math.min(100, parseInt(ms, 10) || 0));
    }

    // Get current beat grid from Metronome, Drum Machine, or Master Jam
    getBeatClock() {
      const audio = window.audio;
      const drums = window.drumMachine || (window.app && window.app.beatSequencer);
      const app = window.app;

      const bpm = (app && typeof app.getBpm === 'function') ? app.getBpm() : (audio ? audio.currentBpm : 113);
      const timeSig = (audio && audio.timeSignature) ? audio.timeSignature : ((app && app.currentTimeSignature) ? app.currentTimeSignature : { num: 4, den: 4 });
      const den = timeSig.den || 4;
      const num = timeSig.num || 4;
      const beatSec = (60 / bpm) * (4 / den);

      let isClockActive = false;
      let downbeatAudioTime = 0;

      if (drums && drums.isPlaying && typeof drums.nextStepAudioTime === 'number') {
        isClockActive = true;
        const stepSec = beatSec / 4; // 16th note step
        downbeatAudioTime = drums.nextStepAudioTime - ((drums.currentStep || 0) * stepSec);
      } else if (audio && audio.isMetronomeRunning && typeof audio.nextMetroTickAudioTime === 'number') {
        isClockActive = true;
        const metroSub = audio.subdivision || 1;
        const tickSec = beatSec / metroSub;
        downbeatAudioTime = audio.nextMetroTickAudioTime - ((audio.metroTickCount || 0) * tickSec);
      }

      const currentTime = (audio && audio.ctx) ? audio.ctx.currentTime : (this.audioContext ? this.audioContext.currentTime : 0);

      return {
        isClockActive,
        bpm,
        timeSig: { num, den },
        downbeatAudioTime,
        beatSec,
        currentTime
      };
    }

    // Compare transient hit time against quantized beat grid
    evaluateHit(rawHitTime) {
      const clock = this.getBeatClock();
      if (!clock.isClockActive) {
        // Clock is not running yet
        return;
      }

      // Compensate for hardware input latency
      const compensatedHitTime = rawHitTime - (this.latencyOffsetMs / 1000);
      const beatSec = clock.beatSec;
      const num = clock.timeSig.num;

      // Determine subdivision factor
      let subDivFactor = 1;
      if (this.subdivision === 'eighth') subDivFactor = 2;
      else if (this.subdivision === 'sixteenth') subDivFactor = 4;
      else if (this.subdivision === 'triplet') subDivFactor = 3;

      const subSec = beatSec / subDivFactor;

      // Time elapsed since phase-locked downbeat anchor
      const elapsed = compensatedHitTime - clock.downbeatAudioTime;
      const nearestStepIndex = Math.round(elapsed / subSec);
      const gridTime = clock.downbeatAudioTime + (nearestStepIndex * subSec);

      // Delta in milliseconds: negative = EARLY (rush), positive = LATE (drag)
      const deltaMs = (compensatedHitTime - gridTime) * 1000;

      // Clamp delta to range [-100ms, +100ms] for analysis
      if (Math.abs(deltaMs) > (subSec * 480)) {
        // Hit is farther than ~half a subdivision away; ignore outlier noise
        return;
      }

      // Rating classification:
      // +/- 6ms: In The Pocket (Studio Pro level)
      // < -6ms: Rush (Early)
      // > +6ms: Drag (Late)
      let rating = 'pocket';
      if (deltaMs < -6.0) rating = 'early';
      else if (deltaMs > 6.0) rating = 'late';

      // Estimate Bar and Beat position
      const barDurationSec = beatSec * num;
      const cycleSec = barDurationSec * 4; // 4-bar heatmap cycle
      const cycleTime = ((compensatedHitTime - clock.downbeatAudioTime) % cycleSec + cycleSec) % cycleSec;
      const barEstimate = Math.floor(cycleTime / barDurationSec) + 1;
      const currentBeat = Math.floor((cycleTime % barDurationSec) / beatSec) + 1;
      const currentSub = Math.floor(((cycleTime % barDurationSec) % beatSec) / subSec) + 1;

      const hitObj = {
        time: compensatedHitTime,
        rawTime: rawHitTime,
        deltaMs: Math.round(deltaMs * 10) / 10,
        rating,
        bar: barEstimate,
        beat: Math.min(num, Math.max(1, currentBeat)),
        subIdx: currentSub,
        timestamp: Date.now()
      };

      this.lastHit = hitObj;
      this.hitHistory.push(hitObj);
      if (this.hitHistory.length > this.maxHistory) {
        this.hitHistory.shift();
      }

      this.updateStats();

      if (typeof this.onHit === 'function') {
        this.onHit(hitObj, this.stats);
      }
    }

    updateStats() {
      const hits = this.hitHistory;
      if (hits.length === 0) return;

      let sumDelta = 0;
      let sumAbsDelta = 0;
      let pocketCount = 0;
      let earlyCount = 0;
      let lateCount = 0;
      const beatBuckets = {};

      hits.forEach(h => {
        sumDelta += h.deltaMs;
        sumAbsDelta += Math.abs(h.deltaMs);

        if (h.rating === 'pocket') pocketCount++;
        else if (h.rating === 'early') earlyCount++;
        else if (h.rating === 'late') lateCount++;

        if (!beatBuckets[h.beat]) {
          beatBuckets[h.beat] = { count: 0, sumDelta: 0, pocket: 0 };
        }
        beatBuckets[h.beat].count++;
        beatBuckets[h.beat].sumDelta += h.deltaMs;
        if (h.rating === 'pocket') beatBuckets[h.beat].pocket++;
      });

      const total = hits.length;
      const meanDelta = sumDelta / total;
      const meanAbsDelta = sumAbsDelta / total;

      // Variance & Standard Deviation
      let sumVariance = 0;
      hits.forEach(h => {
        const diff = h.deltaMs - meanDelta;
        sumVariance += diff * diff;
      });
      const stdDev = Math.sqrt(sumVariance / total);

      // Scores (0 - 100%)
      const grooveAccuracy = Math.max(0, Math.min(100, Math.round(100 - (meanAbsDelta * 2.2))));
      const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev * 3.0))));

      const beatBreakdown = {};
      for (const b in beatBuckets) {
        const item = beatBuckets[b];
        beatBreakdown[b] = {
          count: item.count,
          avgDelta: Math.round((item.sumDelta / item.count) * 10) / 10,
          pocketRate: Math.round((item.pocket / item.count) * 100)
        };
      }

      this.stats = {
        totalHits: total,
        pocketCount,
        earlyCount,
        lateCount,
        grooveAccuracy,
        meanDeltaMs: Math.round(meanDelta * 10) / 10,
        consistencyScore,
        beatBreakdown
      };
    }

    exportAccuracyReportTxt() {
      const now = new Date();
      const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
      const clock = this.getBeatClock();

      let text = `=======================================================\n`;
      text += `SONG ANALYZER - RHYTHMIC ACCURACY & TIMING REPORT\n`;
      text += `Exported: ${dateStr}\n`;
      text += `Tempo:    ${clock.bpm} BPM | Time Signature: ${clock.timeSig.num}/${clock.timeSig.den}\n`;
      text += `Target:   Subdivision: ${this.subdivision.toUpperCase()}\n`;
      text += `=======================================================\n\n`;

      text += `SESSION SCORECARD:\n`;
      text += `  • Groove Accuracy Score: ${this.stats.grooveAccuracy}%\n`;
      text += `  • Timing Consistency:    ${this.stats.consistencyScore}%\n`;
      text += `  • Mean Delta:            ${this.stats.meanDeltaMs > 0 ? '+' : ''}${this.stats.meanDeltaMs} ms\n`;
      text += `  • Total Hits Analyzed:   ${this.stats.totalHits}\n`;
      text += `  • Locked In Pocket:      ${this.stats.pocketCount} hits (${Math.round((this.stats.pocketCount / (this.stats.totalHits || 1)) * 100)}%)\n`;
      text += `  • Rushing (Early):       ${this.stats.earlyCount} hits\n`;
      text += `  • Dragging (Late):       ${this.stats.lateCount} hits\n\n`;

      text += `BEAT-BY-BEAT TIMING BREAKDOWN:\n`;
      for (const beat in this.stats.beatBreakdown) {
        const item = this.stats.beatBreakdown[beat];
        const status = Math.abs(item.avgDelta) <= 5 ? 'IN POCKET' : (item.avgDelta < 0 ? 'RUSHING' : 'DRAGGING');
        text += `  • Beat ${beat}: Avg ${item.avgDelta > 0 ? '+' : ''}${item.avgDelta} ms (${status}, ${item.pocketRate}% pocket rate)\n`;
      }

      text += `\nHIT LOG (Last 25 Hits):\n`;
      const recent = this.hitHistory.slice(-25);
      recent.forEach((h, idx) => {
        const sign = h.deltaMs > 0 ? '+' : '';
        text += `  #${String(idx + 1).padStart(2)}: Bar ${h.bar}, Beat ${h.beat} -> ${sign}${h.deltaMs.toFixed(1).padStart(5)} ms [${h.rating.toUpperCase()}]\n`;
      });

      text += `\n=======================================================\n`;
      text += `Generated with Song Analyzer (https://songanalyzer.dredwerkz.cz)\n`;

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileDate = now.toISOString().slice(0, 10);
      a.download = `rhythm-accuracy-${clock.bpm}bpm-${fileDate}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Visual Canvas Renderers: Pocket Meter Arc + Beat Heatmap Timeline
  class PocketMeterRenderer {
    constructor(gaugeCanvas, heatmapCanvas) {
      this.gaugeCanvas = gaugeCanvas;
      this.gaugeCtx = gaugeCanvas ? gaugeCanvas.getContext('2d') : null;
      this.heatmapCanvas = heatmapCanvas;
      this.heatmapCtx = heatmapCanvas ? heatmapCanvas.getContext('2d') : null;
      this.dpr = window.devicePixelRatio || 1;

      this.currentNeedleDelta = 0; // Smoothed needle position in ms
      this.animFrameId = null;

      this.setupCanvases();
    }

    setupCanvases(force = false) {
      if (!this.gaugeCanvas && !this.heatmapCanvas) return;
      const isGaugeVisible = this.gaugeCanvas && this.gaugeCanvas.offsetParent !== null;
      const isHeatmapVisible = this.heatmapCanvas && this.heatmapCanvas.offsetParent !== null;
      if (!force && !isGaugeVisible && !isHeatmapVisible) {
        this._needsResize = true;
        return;
      }
      this._needsResize = false;
      this.dpr = window.devicePixelRatio || 1;

      if (this.gaugeCanvas && (force || isGaugeVisible)) {
        const rect = this.gaugeCanvas.getBoundingClientRect();
        const w = rect.width || 340;
        const h = rect.height || 210;
        this.gaugeCanvas.width = w * this.dpr;
        this.gaugeCanvas.height = h * this.dpr;
        this.gaugeCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.gaugeCtx.scale(this.dpr, this.dpr);
        this.gaugeW = w;
        this.gaugeH = h;
      }

      if (this.heatmapCanvas && (force || isHeatmapVisible)) {
        const rect = this.heatmapCanvas.getBoundingClientRect();
        const w = rect.width || 600;
        const h = rect.height || 100;
        this.heatmapCanvas.width = w * this.dpr;
        this.heatmapCanvas.height = h * this.dpr;
        this.heatmapCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.heatmapCtx.scale(this.dpr, this.dpr);
        this.heatW = w;
        this.heatH = h;
      }
    }

    // Render both Gauge and Heatmap
    render(engine) {
      if (this._needsResize) {
        this.setupCanvases(true);
      }
      const lastHit = engine.lastHit;
      const targetDelta = lastHit ? lastHit.deltaMs : 0;

      // Smooth needle spring motion
      this.currentNeedleDelta = this.currentNeedleDelta * 0.72 + targetDelta * 0.28;

      this.renderGauge(engine, this.currentNeedleDelta);
      this.renderHeatmap(engine);
    }

    renderGauge(engine, needleDelta) {
      if (!this.gaugeCtx) return;
      const ctx = this.gaugeCtx;
      const w = this.gaugeW;
      const h = this.gaugeH;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.88;
      const radius = Math.min(w * 0.44, h * 0.72);

      const startAngle = (3 * Math.PI / 2) - (Math.PI / 3); // 210 deg
      const arcSpan = 2 * Math.PI / 3;                     // 120 deg
      const zeroAngle = 3 * Math.PI / 2;                   // 270 deg (Top Center)

      // 1. Background Arc Track
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + arcSpan, false);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 2. Rush Side (Left: -50ms to -6ms) -> Amber/Orange
      const rushEndAngle = zeroAngle - ((6 / 50) * (arcSpan / 2));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, rushEndAngle, false);
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 14;
      ctx.stroke();

      // 3. Drag Side (Right: +6ms to +50ms) -> Cyan/Sky Blue
      const dragStartAngle = zeroAngle + ((6 / 50) * (arcSpan / 2));
      ctx.beginPath();
      ctx.arc(cx, cy, radius, dragStartAngle, startAngle + arcSpan, false);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 14;
      ctx.stroke();

      // 4. In-The-Pocket Center Wedge (Center +/- 6ms) -> Neon Emerald Green
      ctx.beginPath();
      ctx.arc(cx, cy, radius, rushEndAngle, dragStartAngle, false);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 16;
      ctx.stroke();

      // 5. Dial Ticks and Labels (-50ms, -25ms, 0, +25ms, +50ms)
      const ticks = [-50, -35, -20, -10, 0, 10, 20, 35, 50];
      ticks.forEach(ms => {
        const frac = ms / 50; // -1 to +1
        const angle = zeroAngle + frac * (arcSpan / 2);
        const isZero = (ms === 0);
        const isMajor = (ms === -50 || ms === -25 || ms === 0 || ms === 25 || ms === 50);

        const innerR = radius - (isZero ? 14 : (isMajor ? 10 : 6));
        const outerR = radius + (isZero ? 14 : (isMajor ? 10 : 6));

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = isZero ? '#10b981' : (isMajor ? '#94a3b8' : '#475569');
        ctx.lineWidth = isZero ? 3 : 1.5;
        ctx.stroke();

        if (isMajor) {
          const textR = radius - 24;
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isZero ? '#10b981' : (ms < 0 ? '#fb923c' : '#38bdf8');
          ctx.fillText(ms === 0 ? '0' : (ms > 0 ? `+${ms}` : `${ms}`), cx + Math.cos(angle) * textR, cy + Math.sin(angle) * textR);
        }
      });

      // Section labels: RUSH vs DRAG
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f97316';
      ctx.fillText('◀ RUSH (Early)', cx - radius + 10, cy - radius * 0.6);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('DRAG (Late) ▶', cx + radius - 10, cy - radius * 0.6);

      // 6. Needle
      const isRunning = engine.isRunning;
      const lastHit = engine.lastHit;
      const isInPocket = lastHit && Math.abs(needleDelta) <= 6.0;

      const frac = Math.max(-1, Math.min(1, needleDelta / 50));
      const needleAngle = zeroAngle + frac * (arcSpan / 2);

      let needleColor = '#64748b';
      if (isRunning && lastHit) {
        needleColor = isInPocket ? '#10b981' : (needleDelta < 0 ? '#f97316' : '#38bdf8');
      }

      ctx.save();
      if (isInPocket) {
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 18;
      }

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const nx = cx + Math.cos(needleAngle) * (radius + 6);
      const ny = cy + Math.sin(needleAngle) * (radius + 6);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = needleColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Center Hub
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = needleColor;
      ctx.fill();
      ctx.restore();
    }

    renderHeatmap(engine) {
      if (!this.heatmapCtx) return;
      const ctx = this.heatmapCtx;
      const w = this.heatW;
      const h = this.heatH;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      const numBars = 4;
      const clock = engine.getBeatClock();
      const numBeats = clock.timeSig.num || 4;

      const barWidth = w / numBars;
      const beatWidth = barWidth / numBeats;

      const midY = h / 2;

      // 1. Center In-The-Pocket Target Ribbon (+/- 6ms corridor)
      const pocketH = h * 0.28;
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
      ctx.fillRect(0, midY - pocketH / 2, w, pocketH);

      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Bar and Beat Grid Lines
      for (let b = 0; b <= numBars; b++) {
        const bx = b * barWidth;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, h);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (b < numBars) {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`BAR ${b + 1}`, bx + 6, 14);

          for (let beat = 1; beat < numBeats; beat++) {
            const beatX = bx + (beat * beatWidth);
            ctx.beginPath();
            ctx.moveTo(beatX, 0);
            ctx.lineTo(beatX, h);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#475569';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${beat + 1}`, beatX, h - 6);
          }
        }
      }

      // 3. Render Recorded Hit Dots
      const hits = engine.hitHistory;
      hits.forEach(hItem => {
        const barIdx = (hItem.bar - 1) % numBars;
        const beatIdx = (hItem.beat - 1) % numBeats;

        // Position along X axis
        const x = (barIdx * barWidth) + (beatIdx * beatWidth) + (beatWidth / 2);

        // Position along Y axis based on delta: -50ms (bottom) to +50ms (top)
        // Note: early / rush (-ms) is above center, late / drag (+ms) is below center
        const normalizedY = - (hItem.deltaMs / 50); // -1 to +1
        const y = midY - (normalizedY * (h * 0.38));
        const clampedY = Math.max(8, Math.min(h - 8, y));

        let dotColor = '#10b981';
        if (hItem.rating === 'early') dotColor = '#f97316';
        else if (hItem.rating === 'late') dotColor = '#38bdf8';

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, clampedY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      });

      // 4. Live Metronome / Clock Playhead Cursor
      if (clock.isClockActive) {
        const barSec = clock.beatSec * numBeats;
        const fullCycleSec = barSec * numBars;

        const cyclePos = ((clock.currentTime - clock.downbeatAudioTime) % fullCycleSec + fullCycleSec) % fullCycleSec;
        const playheadX = (cyclePos / fullCycleSec) * w;

        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }

  window.SongAccuracy = {
    RhythmicAccuracyEngine,
    PocketMeterRenderer,
    engine: new RhythmicAccuracyEngine()
  };

})(typeof window !== 'undefined' ? window : globalThis);
