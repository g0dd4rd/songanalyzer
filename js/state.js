// Song Analyzer - Session State & Persistence Module
// Provides transparent debounced auto-save to localStorage,
// full session JSON export & import, 3 quick snapshot slots, and factory reset.
// 100% Offline, zero external dependencies.

(function(window) {
  'use strict';

  const STORAGE_KEY = 'song_analyzer_state_v1';
  const SNAPSHOTS_KEY = 'song_analyzer_snapshots_v1';
  const SCHEMA_VERSION = 1;

  class SongStateManager {
    constructor() {
      this.app = null;
      this.saveTimeout = null;
      this.lastSavedTimestamp = null;
      this.isRestoring = false;
      this.debounceMs = 250;
      this.saveStatus = 'Saved';
    }

    init(app) {
      this.app = app;
      this.setupModalUI();
      this.setupAutoSaveTriggers();

      // Attempt restoring existing session state
      const restored = this.restore();
      if (!restored) {
        // Initial clean save on first run
        this.save();
      }

      this.renderSnapshots();
    }

    // -------------------------------------------------------------
    // State Collection
    // -------------------------------------------------------------
    collectState() {
      const app = this.app;
      if (!app) return null;

      const state = {
        schemaVersion: SCHEMA_VERSION,
        timestamp: Date.now(),

        // Master Header & Global Audio
        master: {
          volume: this.getInputValue('masterVolume', -6, 'number'),
          jamTracks: {
            chords: this.getCheckboxValue('jamTrackChords', true),
            drums: this.getCheckboxValue('jamTrackDrums', true),
            clave: this.getCheckboxValue('jamTrackClave', true),
            click: this.getCheckboxValue('jamTrackClick', false)
          }
        },

        // Navigation, Panels & Visualizers
        navigation: {
          mobileTab: this.getActiveMobileTab(),
          tunerOpen: this.isSectionOpen('tunerSection'),
          accuracyOpen: this.isSectionOpen('accuracySection'),
          chordsOpen: this.isSectionOpen('movableChordSection'),
          transcriberOpen: this.isSectionOpen('transcriberSection'),
          activeVisualizerTab: this.getActiveVisualizerTab(),
          fretboardInstrument: this.getSelectValue('fretboardInstrumentSelect', 'guitar_std'),
          clockLayers: this.getClockLayers()
        },

        // Harmonic Progression & Key Analysis
        progression: {
          input: this.getInputValue('progressionInput', 'Dm7 - G7 - Cmaj7'),
          selectedKey: app.selectedKey || null
        },

        // Movable Chord Studio
        movableChords: app.chordStudio ? app.chordStudio.getState() : null,

        // Metronome & Rhythm Studio
        metronome: {
          bpm: app.getBpm ? app.getBpm() : 113,
          timeSignature: this.getInputValue('metroTimeSigInput', '4/4'),
          subdivision: this.getSelectValue('metroSubdivision', 'quarter'),
          sound: this.getSelectValue('metroSound', 'woodblock'),
          rhythmInput: this.getInputValue('rhythmInput', ''),
          rhythmPreset: this.getSelectValue('rhythmPresetSelect', ''),
          rhythmLoops: this.getSelectValue('rhythmLoopSelect', 'indefinite'),
          sheetTrack: this.getSelectValue('beatSheetTrackSelect', 'snare')
        },

        // Practice Session Timer
        practiceTimer: {
          totalTimeMs: app.practiceTimer ? app.practiceTimer.totalTimeMs : 0,
          currentExerciseNumber: app.practiceTimer ? app.practiceTimer.currentExerciseNumber : 1,
          exerciseHistory: app.practiceTimer ? [...app.practiceTimer.exerciseHistory] : [],
          targetDuration: this.getSelectValue('timerTargetDuration', '0'),
          autoSplit: this.getCheckboxValue('timerAutoSplitOnRestart', true)
        },

        // Jam Deck
        jamDeck: {
          cardCount: this.getInputValue('jamCardCount', 4, 'number'),
          pool: this.getSelectValue('jamCardPool', 'wildcard'),
          cards: app.jamCards ? JSON.parse(JSON.stringify(app.jamCards)) : [],
          lockedIndices: app.lockedCards ? Array.from(app.lockedCards) : []
        },

        // Beat Builder (Drum Sequencer)
        beatBuilder: {
          timeSignature: this.getInputValue('beatTimeSigInput', '4/4'),
          swing: this.getInputValue('beatSwingSlider', 0, 'number'),
          preset: this.getSelectValue('beatPresetSelect', ''),
          pattern: app.beatSequencer && app.beatSequencer.pattern ? JSON.parse(JSON.stringify(app.beatSequencer.pattern)) : null
        },

        // Chromatic Tuner Settings
        tuner: {
          preset: this.getSelectValue('tunerPresetSelect', 'guitar_std'),
          a4: this.getInputValue('tunerA4Input', 440, 'number'),
          gain: this.getInputValue('tunerGainInput', 0.3, 'number')
        },

        // Rhythmic Accuracy / Pocket Meter Settings
        accuracy: {
          subdivision: this.getSelectValue('accuracySubdivSelect', 'quarter'),
          sensitivity: this.getInputValue('accuracySensitivityInput', 1.0, 'number'),
          latency: this.getInputValue('accuracyLatencyInput', 0, 'number'),
          autoMetronome: this.getCheckboxValue('accuracyAutoMetronome', true)
        },

        // Melodic Ribbon & Pathways
        ribbon: {
          schoolId: app.ribbonEngine ? app.ribbonEngine.activeSchoolId : 'classical',
          pathwayId: this.getSelectValue('ribbonPathwaySelect', ''),
          leadVoice: this.getSelectValue('ribbonLeadVoiceSelect', 'soprano'),
          loop: this.getCheckboxValue('ribbonLoopToggle', true),
          melodyVol: this.getInputValue('ribbonMelodyVol', 1.0, 'number'),
          chordsVol: this.getInputValue('ribbonChordsVol', 0.7, 'number')
        },

        // Modal & Scale Studio
        modalStudio: {
          cardinality: app.selectedScaleCardinality || 'all',
          category: app.selectedScaleCategory || 'all',
          scaleId: app.selectedScaleId || 'diatonic'
        },

        // Neural Stem Separator
        transcriber: {}
      };

      return state;
    }

    // -------------------------------------------------------------
    // State Persistence (localStorage)
    // -------------------------------------------------------------
    save() {
      if (this.isRestoring) return;
      try {
        const state = this.collectState();
        if (!state) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        this.lastSavedTimestamp = state.timestamp;
        this.updateSaveIndicator('Saved');
      } catch (err) {
        console.warn('SongState: Unable to save state to localStorage:', err);
        this.updateSaveIndicator('Save Error');
      }
    }

    requestSave() {
      if (this.isRestoring) return;
      this.updateSaveIndicator('Saving...');
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        this.saveTimeout = null;
        this.save();
      }, this.debounceMs);
    }

    // -------------------------------------------------------------
    // State Restoration
    // -------------------------------------------------------------
    restore(stateData = null) {
      let state = stateData;
      if (!state) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return false;
          state = JSON.parse(raw);
        } catch (e) {
          console.warn('SongState: Could not parse saved state from localStorage:', e);
          return false;
        }
      }

      if (!state || typeof state !== 'object') return false;

      this.isRestoring = true;
      const app = this.app;

      try {
        // 1. Master Volume & Jam tracks
        if (state.master) {
          if (typeof state.master.volume === 'number') {
            const volEl = document.getElementById('masterVolume');
            if (volEl) volEl.value = state.master.volume;
            if (window.audio && window.audio.setMasterVolume) {
              window.audio.setMasterVolume(state.master.volume);
            }
          }
          if (state.master.jamTracks) {
            this.setCheckboxValue('jamTrackChords', state.master.jamTracks.chords);
            this.setCheckboxValue('jamTrackDrums', state.master.jamTracks.drums);
            this.setCheckboxValue('jamTrackClave', state.master.jamTracks.clave);
            this.setCheckboxValue('jamTrackClick', state.master.jamTracks.click);
          }
        }

        // 2. Metronome & Rhythm (restore BPM and meter before progression or drums)
        if (state.metronome) {
          if (typeof state.metronome.bpm === 'number' && app.setAppBpm) {
            app.setAppBpm(state.metronome.bpm);
          }
          if (state.metronome.timeSignature) {
            const tsInput = document.getElementById('metroTimeSigInput');
            if (tsInput) {
              tsInput.value = state.metronome.timeSignature;
              if (app.updateTimeSignature) app.updateTimeSignature();
            }
          }
          if (state.metronome.subdivision) {
            this.setSelectValue('metroSubdivision', state.metronome.subdivision);
          }
          if (state.metronome.sound) {
            this.setSelectValue('metroSound', state.metronome.sound);
          }
          if (state.metronome.rhythmInput !== undefined) {
            this.setInputValue('rhythmInput', state.metronome.rhythmInput);
          }
          if (state.metronome.rhythmPreset) {
            this.setSelectValue('rhythmPresetSelect', state.metronome.rhythmPreset);
          }
          if (state.metronome.rhythmLoops) {
            this.setSelectValue('rhythmLoopSelect', state.metronome.rhythmLoops);
          }
          if (state.metronome.sheetTrack) {
            this.setSelectValue('beatSheetTrackSelect', state.metronome.sheetTrack);
          }
        }

        // 3. Progression Analyzer
        if (state.progression) {
          if (state.progression.input) {
            this.setInputValue('progressionInput', state.progression.input);
          }
          if (state.progression.selectedKey !== undefined) {
            app.selectedKey = state.progression.selectedKey;
            this.setSelectValue('keyOverrideSelect', state.progression.selectedKey || 'auto');
          }
          if (app.analyzeProgression) {
            app.analyzeProgression();
          }
        }

        // 4. Movable Chords Studio
        if (state.movableChords && app.chordStudio) {
          app.chordStudio.setState(state.movableChords);
        }

        // 5. Visualizer Mode & Fretboard
        if (state.navigation) {
          if (state.navigation.activeVisualizerTab) {
            const btn = document.querySelector(`.viz-btn[data-mode="${state.navigation.activeVisualizerTab}"]`);
            if (btn) btn.click();
          }
          if (state.navigation.fretboardInstrument) {
            this.setSelectValue('fretboardInstrumentSelect', state.navigation.fretboardInstrument);
            if (app.visualizer) app.visualizer.setFretboardInstrument(state.navigation.fretboardInstrument);
          }
          if (state.navigation.clockLayers && app.visualizer) {
            Object.entries(state.navigation.clockLayers).forEach(([layer, active]) => {
              const layerBtn = document.querySelector(`.clock-layer-btn[data-layer="${layer}"]`);
              if (layerBtn) {
                const isCurrentlyActive = layerBtn.classList.contains('active');
                if (isCurrentlyActive !== active) {
                  app.visualizer.toggleLayer(layer);
                  layerBtn.classList.toggle('active', active);
                }
              }
            });
          }
        }

        // 6. Practice Session Timer
        if (state.practiceTimer && app.practiceTimer) {
          app.practiceTimer.totalTimeMs = state.practiceTimer.totalTimeMs || 0;
          app.practiceTimer.currentExerciseNumber = state.practiceTimer.currentExerciseNumber || 1;
          app.practiceTimer.exerciseHistory = Array.isArray(state.practiceTimer.exerciseHistory) ? state.practiceTimer.exerciseHistory : [];
          if (state.practiceTimer.targetDuration !== undefined) {
            this.setSelectValue('timerTargetDuration', state.practiceTimer.targetDuration);
          }
          if (state.practiceTimer.autoSplit !== undefined) {
            this.setCheckboxValue('timerAutoSplitOnRestart', state.practiceTimer.autoSplit);
          }
          if (app.updatePracticeTimerUI) app.updatePracticeTimerUI();
          if (app.renderTimerLog) app.renderTimerLog();
        }

        // 7. Jam Deck
        if (state.jamDeck) {
          if (state.jamDeck.cardCount) this.setInputValue('jamCardCount', state.jamDeck.cardCount);
          if (state.jamDeck.pool) this.setSelectValue('jamCardPool', state.jamDeck.pool);
          if (Array.isArray(state.jamDeck.cards) && state.jamDeck.cards.length > 0) {
            app.jamCards = state.jamDeck.cards;
          }
          if (Array.isArray(state.jamDeck.lockedIndices)) {
            app.lockedCards = new Set(state.jamDeck.lockedIndices);
          }
          if (app.renderJamCards) app.renderJamCards();
        }

        // 8. Beat Builder (Drums)
        if (state.beatBuilder && app.beatSequencer) {
          if (state.beatBuilder.timeSignature) {
            this.setInputValue('beatTimeSigInput', state.beatBuilder.timeSignature);
            const [num, den] = state.beatBuilder.timeSignature.split('/').map(Number);
            if (num && den) app.beatSequencer.setTimeSignature({ num, den }, app.beatSequencer.subdivision || 4);
          }
          if (typeof state.beatBuilder.swing === 'number') {
            this.setInputValue('beatSwingSlider', state.beatBuilder.swing);
            const valEl = document.getElementById('beatSwingValue');
            if (valEl) valEl.textContent = `${state.beatBuilder.swing}%`;
            app.beatSequencer.swing = state.beatBuilder.swing / 100;
          }
          if (state.beatBuilder.preset) {
            this.setSelectValue('beatPresetSelect', state.beatBuilder.preset);
          }
          if (state.beatBuilder.pattern) {
            Object.keys(state.beatBuilder.pattern).forEach(trackId => {
              if (app.beatSequencer.pattern[trackId]) {
                app.beatSequencer.pattern[trackId] = [...state.beatBuilder.pattern[trackId]];
              }
            });
          }
          if (app.renderBeatGrid) app.renderBeatGrid();
          if (app.updateBeatSheetMusic) app.updateBeatSheetMusic();
        }

        // 9. Tuner Settings
        if (state.tuner) {
          if (state.tuner.preset) {
            this.setSelectValue('tunerPresetSelect', state.tuner.preset);
            if (window.SongTuner && window.SongTuner.tuner) window.SongTuner.tuner.setTuning(state.tuner.preset);
          }
          if (typeof state.tuner.a4 === 'number') {
            this.setInputValue('tunerA4Input', state.tuner.a4);
            if (window.SongTuner && window.SongTuner.tuner) window.SongTuner.tuner.setA4(state.tuner.a4);
          }
          if (typeof state.tuner.gain === 'number') {
            this.setInputValue('tunerGainInput', state.tuner.gain);
            const gVal = document.getElementById('tunerGainVal');
            if (gVal) gVal.textContent = `${state.tuner.gain}x`;
            if (window.SongTuner && window.SongTuner.tuner) window.SongTuner.tuner.setGain(state.tuner.gain);
          }
        }

        // 10. Accuracy / Pocket Meter Settings
        if (state.accuracy) {
          if (state.accuracy.subdivision) this.setSelectValue('accuracySubdivSelect', state.accuracy.subdivision);
          if (typeof state.accuracy.sensitivity === 'number') {
            this.setInputValue('accuracySensitivityInput', state.accuracy.sensitivity);
            const sVal = document.getElementById('accuracySensitivityVal');
            if (sVal) sVal.textContent = `${state.accuracy.sensitivity}x`;
          }
          if (typeof state.accuracy.latency === 'number') {
            this.setInputValue('accuracyLatencyInput', state.accuracy.latency);
            const lVal = document.getElementById('accuracyLatencyVal');
            if (lVal) lVal.textContent = `${state.accuracy.latency} ms`;
          }
          if (state.accuracy.autoMetronome !== undefined) {
            this.setCheckboxValue('accuracyAutoMetronome', state.accuracy.autoMetronome);
          }
        }

        // 11. Melodic Ribbon
        if (state.ribbon && app.ribbonEngine) {
          if (state.ribbon.schoolId) app.ribbonEngine.setSchool(state.ribbon.schoolId);
          if (state.ribbon.pathwayId) {
            this.setSelectValue('ribbonPathwaySelect', state.ribbon.pathwayId);
            app.ribbonEngine.setPathway(state.ribbon.pathwayId);
          }
          if (state.ribbon.leadVoice) this.setSelectValue('ribbonLeadVoiceSelect', state.ribbon.leadVoice);
          if (state.ribbon.loop !== undefined) this.setCheckboxValue('ribbonLoopToggle', state.ribbon.loop);
          if (state.ribbon.melodyVol !== undefined) this.setInputValue('ribbonMelodyVol', state.ribbon.melodyVol);
          if (state.ribbon.chordsVol !== undefined) this.setInputValue('ribbonChordsVol', state.ribbon.chordsVol);
          if (app.updateRibbonUI) app.updateRibbonUI();
        }

        // 12. Modal & Scale Studio
        if (state.modalStudio && app.populateScaleFamilyDropdown) {
          if (state.modalStudio.cardinality) {
            app.selectedScaleCardinality = state.modalStudio.cardinality;
            const cardPills = document.querySelectorAll('.scale-cardinality-pill');
            cardPills.forEach(p => p.classList.toggle('active', p.dataset.cardinality === state.modalStudio.cardinality));
          }
          if (state.modalStudio.category) {
            app.selectedScaleCategory = state.modalStudio.category;
            this.setSelectValue('scaleCategoryFilter', state.modalStudio.category);
          }
          app.populateScaleFamilyDropdown();
          if (state.modalStudio.scaleId) {
            app.selectedScaleId = state.modalStudio.scaleId;
            this.setSelectValue('scaleFamilySelect', state.modalStudio.scaleId);
          }
          if (app.renderModalStudio) app.renderModalStudio();
        }

        // 13. Top Panels & Mobile Navigation View
        if (state.navigation) {
          if (state.navigation.tunerOpen) {
            const tunerSec = document.getElementById('tunerSection');
            const btnTuner = document.getElementById('btnToggleTunerTop');
            if (tunerSec) tunerSec.style.display = 'block';
            if (btnTuner) {
              btnTuner.textContent = '🎸 Tuner: On';
              btnTuner.classList.add('active');
            }
          }
          if (state.navigation.accuracyOpen) {
            const accSec = document.getElementById('accuracySection');
            const btnAcc = document.getElementById('btnToggleAccuracyTop');
            if (accSec) accSec.style.display = 'block';
            if (btnAcc) {
              btnAcc.textContent = '🎯 Pocket: On';
              btnAcc.classList.add('active');
            }
          }
          if (state.navigation.chordsOpen) {
            const chordSec = document.getElementById('movableChordSection');
            const btnChord = document.getElementById('btnToggleChordsTop');
            if (chordSec) chordSec.style.display = 'block';
            if (btnChord) {
              btnChord.textContent = '🎸 Chords: On';
              btnChord.classList.add('active');
            }
          }
          if (state.navigation.transcriberOpen) {
            const transSec = document.getElementById('transcriberSection');
            const btnTrans = document.getElementById('btnToggleTranscriberTop');
            if (transSec) transSec.style.display = 'block';
            if (btnTrans) {
              btnTrans.textContent = '🎧 Stems: On';
              btnTrans.classList.remove('btn-outline-cyan');
              btnTrans.classList.add('btn-success');
            }
          }

          if (state.navigation.mobileTab && app.setMobileTab) {
            app.setMobileTab(state.navigation.mobileTab);
          }
        }

        this.lastSavedTimestamp = state.timestamp || Date.now();
        this.updateSaveIndicator('Saved');
        return true;
      } catch (err) {
        console.error('SongState: Error applying restored state:', err);
        return false;
      } finally {
        this.isRestoring = false;
      }
    }

    // -------------------------------------------------------------
    // Backup Export & Import (JSON)
    // -------------------------------------------------------------
    exportBackup() {
      const state = this.collectState();
      let userGrooves = [];
      try {
        const rawGrooves = localStorage.getItem('song_analyzer_user_grooves');
        if (rawGrooves) userGrooves = JSON.parse(rawGrooves);
      } catch (e) {}

      let obliqueState = null;
      try {
        const rawOblique = localStorage.getItem('song_analyzer_oblique_v1');
        if (rawOblique) obliqueState = JSON.parse(rawOblique);
      } catch (e) {}

      const snapshots = this.getSnapshots();

      const backupData = {
        appName: 'Song Analyzer',
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        appState: state,
        userGrooves: userGrooves,
        obliqueState: obliqueState,
        snapshots: snapshots
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const filename = `songanalyzer_session_${dateStr}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);

      this.showToast('Session backup exported successfully!');
    }

    importBackup(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid JSON format.');
          }

          const targetState = data.appState || data.state;
          if (!targetState) {
            throw new Error('No compatible Song Analyzer state found in this file.');
          }

          // Restore app state
          this.restore(targetState);
          this.save();

          // Restore user grooves if present
          if (Array.isArray(data.userGrooves)) {
            try {
              localStorage.setItem('song_analyzer_user_grooves', JSON.stringify(data.userGrooves));
              if (this.app && this.app.refreshSavedGroovesDropdown) {
                this.app.refreshSavedGroovesDropdown();
              }
            } catch (err) {}
          }

          // Restore oblique state if present
          if (data.obliqueState) {
            try {
              localStorage.setItem('song_analyzer_oblique_v1', JSON.stringify(data.obliqueState));
            } catch (err) {}
          }

          // Restore snapshots if present
          if (Array.isArray(data.snapshots)) {
            try {
              localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(data.snapshots));
              this.renderSnapshots();
            } catch (err) {}
          }

          this.showToast('Session restored successfully!');
          this.closeModal();
        } catch (err) {
          alert(`Import Failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }

    // -------------------------------------------------------------
    // Snapshots (3 Slots)
    // -------------------------------------------------------------
    getSnapshots() {
      try {
        const raw = localStorage.getItem(SNAPSHOTS_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length === 3) return list;
        }
      } catch (e) {}

      return [
        { id: 1, name: 'Snapshot 1', timestamp: null, state: null },
        { id: 2, name: 'Snapshot 2', timestamp: null, state: null },
        { id: 3, name: 'Snapshot 3', timestamp: null, state: null }
      ];
    }

    saveSnapshot(slotId) {
      const snapshots = this.getSnapshots();
      const slot = snapshots.find(s => s.id === slotId);
      if (!slot) return;

      const defaultName = slot.name && slot.name !== `Snapshot ${slotId}` ? slot.name : `Snapshot ${slotId}`;
      let userTitle = defaultName;
      if (typeof prompt === 'function') {
        const res = prompt(`Enter a title for Snapshot #${slotId}:`, defaultName);
        if (res === null) return; // User cancelled
        userTitle = res;
      }

      slot.name = userTitle.trim() || `Snapshot ${slotId}`;
      slot.timestamp = Date.now();
      slot.state = this.collectState();

      try {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
        this.renderSnapshots();
        this.showToast(`Saved Snapshot #${slotId}: "${slot.name}"`);
      } catch (err) {
        if (typeof alert === 'function') alert('Could not save snapshot to storage.');
      }
    }

    loadSnapshot(slotId) {
      const snapshots = this.getSnapshots();
      const slot = snapshots.find(s => s.id === slotId);
      if (!slot || !slot.state) {
        if (typeof alert === 'function') alert('This snapshot slot is empty.');
        return;
      }

      this.restore(slot.state);
      this.save();
      this.showToast(`Loaded Snapshot: "${slot.name}"`);
      this.closeModal();
    }

    clearSnapshot(slotId) {
      const snapshots = this.getSnapshots();
      const slot = snapshots.find(s => s.id === slotId);
      if (!slot) return;

      if (typeof confirm === 'function' && !confirm(`Clear Snapshot #${slotId} ("${slot.name}")?`)) return;

      slot.name = `Snapshot ${slotId}`;
      slot.timestamp = null;
      slot.state = null;

      try {
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
        this.renderSnapshots();
        this.showToast(`Cleared Snapshot #${slotId}`);
      } catch (err) {}
    }

    renderSnapshots() {
      const container = document.getElementById('snapshotSlotsList');
      if (!container) return;

      const snapshots = this.getSnapshots();
      container.innerHTML = '';

      snapshots.forEach(slot => {
        const item = document.createElement('div');
        item.className = `snapshot-slot-card ${slot.state ? 'occupied' : 'empty'}`;

        const timeStr = slot.timestamp ? new Date(slot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Empty slot';

        item.innerHTML = `
          <div class="snapshot-slot-info">
            <span class="snapshot-slot-badge">Slot ${slot.id}</span>
            <div class="snapshot-slot-title">${this.escapeHtml(slot.name)}</div>
            <div class="snapshot-slot-time">${timeStr}</div>
          </div>
          <div class="snapshot-slot-actions">
            ${slot.state ? `<button type="button" class="btn btn-sm btn-primary btn-load-snapshot" data-slot="${slot.id}" title="Load this snapshot">📂 Load</button>` : ''}
            <button type="button" class="btn btn-sm btn-outline-cyan btn-save-snapshot" data-slot="${slot.id}" title="Save current studio state to this slot">💾 Save</button>
            ${slot.state ? `<button type="button" class="btn btn-sm btn-danger btn-clear-snapshot" data-slot="${slot.id}" title="Clear slot">🗑</button>` : ''}
          </div>
        `;

        const btnLoad = item.querySelector('.btn-load-snapshot');
        if (btnLoad) btnLoad.addEventListener('click', () => this.loadSnapshot(slot.id));

        const btnSave = item.querySelector('.btn-save-snapshot');
        if (btnSave) btnSave.addEventListener('click', () => this.saveSnapshot(slot.id));

        const btnClear = item.querySelector('.btn-clear-snapshot');
        if (btnClear) btnClear.addEventListener('click', () => this.clearSnapshot(slot.id));

        container.appendChild(item);
      });
    }

    // -------------------------------------------------------------
    // Factory Reset
    // -------------------------------------------------------------
    resetDefaults() {
      if (typeof confirm === 'function') {
        const confirmed = confirm(
          'Are you sure you want to reset Song Analyzer to clean factory defaults?\n\n' +
          'This will reset your chord progression, movable chord selection, BPM, and timers.'
        );
        if (!confirmed) return;
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}

      this.showToast('Settings reset. Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }

    // -------------------------------------------------------------
    // UI Helpers & Modal Integration
    // -------------------------------------------------------------
    setupModalUI() {
      const btnOpen = document.getElementById('btnSessionModal');
      const modal = document.getElementById('sessionModal');
      const btnClose = document.getElementById('btnCloseSessionModal');

      if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => this.openModal());
      }

      if (btnClose && modal) {
        btnClose.addEventListener('click', () => this.closeModal());
      }

      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) this.closeModal();
        });
      }

      // Escape key closes modal
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
          this.closeModal();
        }
      });

      // Export Button
      const btnExport = document.getElementById('btnExportSessionJson');
      if (btnExport) {
        btnExport.addEventListener('click', () => this.exportBackup());
      }

      // Import Button & Hidden File Input
      const btnImport = document.getElementById('btnImportSessionJson');
      const fileInput = document.getElementById('sessionJsonFileInput');
      if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) {
            this.importBackup(file);
            fileInput.value = '';
          }
        });
      }

      // Factory Reset Button
      const btnReset = document.getElementById('btnResetSessionDefaults');
      if (btnReset) {
        btnReset.addEventListener('click', () => this.resetDefaults());
      }
    }

    openModal() {
      const modal = document.getElementById('sessionModal');
      if (!modal) return;

      this.renderSnapshots();

      // Update timestamp readout
      const timeEl = document.getElementById('sessionModalLastSaved');
      if (timeEl) {
        if (this.lastSavedTimestamp) {
          const d = new Date(this.lastSavedTimestamp);
          timeEl.textContent = `Saved ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        } else {
          timeEl.textContent = 'Saved just now';
        }
      }

      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    closeModal() {
      const modal = document.getElementById('sessionModal');
      if (!modal) return;
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    updateSaveIndicator(statusText) {
      this.saveStatus = statusText;

      const headerLabel = document.getElementById('headerSessionLabel');
      const headerDot = document.getElementById('headerSessionDot');
      const modalStatus = document.getElementById('sessionModalStatus');
      const modalDot = document.getElementById('sessionModalDot');
      const modalLastSaved = document.getElementById('sessionModalLastSaved');

      if (headerLabel) headerLabel.textContent = statusText;

      if (headerDot) {
        headerDot.className = 'session-dot ' + (statusText === 'Saving...' ? 'saving' : (statusText === 'Save Error' ? 'error' : 'saved'));
      }

      if (modalStatus) {
        modalStatus.textContent = statusText === 'Saving...' ? 'Saving changes to local storage...' : 'Auto-Save Active (Local Storage)';
      }

      if (modalDot) {
        modalDot.className = 'session-status-dot ' + (statusText === 'Saving...' ? 'saving' : (statusText === 'Save Error' ? 'error' : 'pulsing'));
      }

      if (statusText === 'Saved' && modalLastSaved) {
        const d = new Date();
        modalLastSaved.textContent = `Saved ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }
    }

    showToast(message) {
      let container = document.getElementById('sessionToastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'sessionToastContainer';
        container.className = 'session-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'session-toast';
      toast.innerHTML = `<span class="toast-icon">💾</span> <span>${this.escapeHtml(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 2500);
    }

    setupAutoSaveTriggers() {
      const autoSaveHandler = () => this.requestSave();

      // Form inputs and controls
      const inputIds = [
        'progressionInput', 'keyOverrideSelect',
        'masterVolume', 'jamTrackChords', 'jamTrackDrums', 'jamTrackClave', 'jamTrackClick',
        'metroBpmInput', 'metroBpmSlider', 'metroTimeSigInput', 'metroSubdivision', 'metroSound',
        'rhythmInput', 'rhythmPresetSelect', 'rhythmLoopSelect', 'beatSheetTrackSelect',
        'timerTargetDuration', 'timerAutoSplitOnRestart',
        'jamCardCount', 'jamCardPool',
        'beatTimeSigInput', 'beatSwingSlider', 'beatPresetSelect',
        'tunerPresetSelect', 'tunerA4Input', 'tunerGainInput',
        'accuracySubdivSelect', 'accuracySensitivityInput', 'accuracyLatencyInput', 'accuracyAutoMetronome',
        'ribbonPathwaySelect', 'ribbonLeadVoiceSelect', 'ribbonLoopToggle', 'ribbonMelodyVol', 'ribbonChordsVol',
        'scaleCategoryFilter', 'scaleFamilySelect'
      ];

      inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', autoSaveHandler);
          el.addEventListener('change', autoSaveHandler);
        }
      });

      // Visualizer buttons
      document.querySelectorAll('.viz-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimeout(autoSaveHandler, 50));
      });

      // Concentric clock layer buttons
      document.querySelectorAll('.clock-layer-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimeout(autoSaveHandler, 50));
      });

      // Mobile nav buttons
      document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimeout(autoSaveHandler, 50));
      });

      // Panel toggle buttons
      const toggleBtnIds = [
        'btnToggleTunerTop', 'btnCloseTuner',
        'btnToggleAccuracyTop', 'btnCloseAccuracy',
        'btnToggleChordsTop', 'btnCloseChords'
      ];
      toggleBtnIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => setTimeout(autoSaveHandler, 50));
      });

      // Drum pad taps
      const beatGrid = document.getElementById('beatSequencerGrid');
      if (beatGrid) {
        beatGrid.addEventListener('click', () => setTimeout(autoSaveHandler, 50));
      }

      // Jam deck button deals
      const btnDeal = document.getElementById('btnDealJamCards');
      if (btnDeal) btnDeal.addEventListener('click', () => setTimeout(autoSaveHandler, 50));

      const btnShuffle = document.getElementById('btnShuffleJamCards');
      if (btnShuffle) btnShuffle.addEventListener('click', () => setTimeout(autoSaveHandler, 50));

      // Page unload & mobile backgrounding flushes immediate save
      window.addEventListener('beforeunload', () => this.save());
      window.addEventListener('pagehide', () => this.save());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.save();
        }
      });
    }

    // -------------------------------------------------------------
    // DOM Value Getters & Setters
    // -------------------------------------------------------------
    getInputValue(id, fallback = '', type = 'string') {
      const el = document.getElementById(id);
      if (!el) return fallback;
      if (type === 'number') {
        const val = parseFloat(el.value);
        return isNaN(val) ? fallback : val;
      }
      return el.value;
    }

    setInputValue(id, val) {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) {
        el.value = val;
      }
    }

    getSelectValue(id, fallback = '') {
      const el = document.getElementById(id);
      return (el && el.value) ? el.value : fallback;
    }

    setSelectValue(id, val) {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) {
        el.value = val;
      }
    }

    getCheckboxValue(id, fallback = false) {
      const el = document.getElementById(id);
      return el ? Boolean(el.checked) : fallback;
    }

    setCheckboxValue(id, val) {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) {
        el.checked = Boolean(val);
      }
    }

    getActiveMobileTab() {
      const activeBtn = document.querySelector('.mobile-nav-btn.active');
      return activeBtn ? activeBtn.dataset.target : 'all';
    }

    getActiveVisualizerTab() {
      const activeBtn = document.querySelector('.viz-btn.active');
      return activeBtn ? activeBtn.dataset.mode : 'clock';
    }

    getClockLayers() {
      const layers = {};
      document.querySelectorAll('.clock-layer-btn').forEach(btn => {
        const layer = btn.dataset.layer;
        if (layer) {
          layers[layer] = btn.classList.contains('active');
        }
      });
      return layers;
    }

    isSectionOpen(id) {
      const sec = document.getElementById(id);
      return sec ? (sec.style.display !== 'none' && sec.offsetParent !== null) : false;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Export singleton to window namespace
  window.SongState = new SongStateManager();

})(typeof window !== 'undefined' ? window : globalThis);
