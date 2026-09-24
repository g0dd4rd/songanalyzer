// Song Analyzer - Main Application Controller
// Classic JS Module (works offline over file:// with zero server requirements)

(function(window) {
  'use strict';

  class App {
    constructor() {
      this.parsedChords = [];
      this.detectedKeys = [];
      this.selectedKey = null;
      this.visualizer = null;
      this.ribbonEngine = null;
      this.ribbonRenderer = null;
      this.sheetMusicRenderer = null;
      this.tunerRenderer = null;
      this.accuracyRenderer = null;
      this.jamCards = [];
      this.lockedCards = new Set();
      this.currentRhythmItems = [];
      this.earTrainingAnswer = null;

      // Practice Session Timer
      this.practiceTimer = {
        isRunning: false,
        timerInterval: null,
        totalTimeMs: 0,
        currentDeltaMs: 0,
        lastTickTimestamp: 0,
        wasStopped: false,
        currentExerciseNumber: 1,
        exerciseHistory: [],
        targetChimePlayed: false
      };
    }

    getBpm() {
      return this.currentBpm || 113;
    }

    async init() {
      // Setup Visualizer Canvas
      const canvas = document.getElementById('visualizerCanvas');
      if (canvas && window.Visualizer) {
        this.visualizer = new window.Visualizer(canvas);

        this.visualizer.onNoteClick = (pc, midi) => {
          if (window.audio && window.audio.initialized) {
            const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = `${sharpNames[pc]}${Math.floor(midi / 12) - 1}`;
            window.audio.leadSynth.triggerAttackRelease(noteName, '8n');
          }
        };
      }

      this.currentTimeSignature = { num: 4, den: 4 };
      this.currentBpm = 113;
      this.bindEvents();
      if (this.setAppBpm) {
        const metroInput = document.getElementById('metroBpmInput');
        const initBpm = metroInput ? (parseInt(metroInput.value, 10) || 113) : 113;
        this.setAppBpm(initBpm);
      }
      this.updateTimeSignature(); // Initialize time signature and dots
      this.initRibbonModule();   // Initialize Voice Leading Ribbon & 6-School Melodic Pathway Studio
      this.initModalScaleStudio(); // Initialize Base-12 Modal & Scale Studio (4-to-12 Tones)
      this.analyzeProgression(); // Run default analysis on load
      this.dealJamCards();       // Deal initial jam cards
      this.initPracticeTimer();  // Initialize practice timer
      this.initBeatBuilder();    // Initialize adaptive grid drum machine
      this.initMasterJamTransport(); // Initialize master transport (Spacebar, Jam sync)
      this.initGrooveManagement();   // Initialize custom groove saving & library
      this.initMidiExportImport();   // Initialize MIDI export & import studio
      this.initObliquePrompts();     // Initialize Oblique Strategies non-repeating creative deck
      this.initTunerModule();        // Initialize Chromatic Strobe & Needle Tuner
      this.initAccuracyModule();     // Initialize Rhythmic Accuracy Analyzer & Pocket Meter
      this.initMovableChordsModule(); // Initialize Multi-Notation Movable Chord Studio
      this.initTranscriberModule();  // Initialize AI Audio Transcriber & 6-Stem Studio
      if (window.SongState) {
        window.SongState.init(this); // Initialize Session Auto-Save, Portability & Snapshots
      }
      this.initPWA();                // Initialize PWA Service Worker
      this.initWakeLock();           // Initialize Screen Wake Lock API
    }

    bindEvents() {
      const audio = window.audio;
      const Theory = window.SongTheory;

      // Audio Keep-Alive & Auto-Resume for Safari & Inactive Background Tabs
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && audio && audio.initialized) {
          await audio.resumeIfNeeded();
        }
      });

      window.addEventListener('songaudio-statechange', (e) => {
        const btnMetro = document.getElementById('btnToggleMetronome');
        if (btnMetro && (!audio || !audio.isMetronomeRunning)) {
          btnMetro.textContent = '▶ Start Metronome';
          btnMetro.classList.remove('btn-danger');
        }
        const btnPlayRhythm = document.getElementById('btnPlayRhythm');
        if (btnPlayRhythm && (!audio || !audio.isRhythmPlaying)) {
          this.updateRhythmPlayButtonState(false);
        }
      });

      // Seamless user gesture wakeup (resumes audio context if suspended when clicking/tapping anywhere)
      const resumeOnGesture = async () => {
        if (audio && audio.initialized && audio.ctx && audio.ctx.state !== 'running') {
          await audio.resumeIfNeeded();
        }
      };
      document.addEventListener('click', resumeOnGesture, { passive: true });
      document.addEventListener('touchstart', resumeOnGesture, { passive: true });

      // Master Volume
      const masterVol = document.getElementById('masterVolume');
      if (masterVol && audio) {
        masterVol.addEventListener('input', (e) => {
          audio.setMasterVolume(parseFloat(e.target.value));
        });
      }

      // Unified Metronome BPM (15 to 240 BPM, default 113)
      const setAppBpm = (rawVal) => {
        let val = parseInt(rawVal, 10);
        if (isNaN(val)) return;
        val = Math.max(15, Math.min(240, val));
        this.currentBpm = val;

        const metroSlider = document.getElementById('metroBpmSlider');
        const metroInput = document.getElementById('metroBpmInput');

        if (metroSlider && parseInt(metroSlider.value, 10) !== val) metroSlider.value = val;
        if (metroInput && parseInt(metroInput.value, 10) !== val) metroInput.value = val;

        if (audio) audio.setBpm(val);
        if (this.beatSequencer) this.beatSequencer.setBpm(val);
        this.updateTempoMarking(val);
      };
      this.setAppBpm = setAppBpm;

      const metroBpmSlider = document.getElementById('metroBpmSlider');
      if (metroBpmSlider) metroBpmSlider.addEventListener('input', (e) => setAppBpm(e.target.value));

      const metroBpmInput = document.getElementById('metroBpmInput');
      if (metroBpmInput) {
        metroBpmInput.addEventListener('input', (e) => setAppBpm(e.target.value));
        metroBpmInput.addEventListener('change', (e) => setAppBpm(e.target.value));
      }

      const btnMinus5 = document.getElementById('btnBpmMinus5');
      if (btnMinus5) btnMinus5.addEventListener('click', () => {
        setAppBpm(this.currentBpm - 5);
      });

      const btnMinus1 = document.getElementById('btnBpmMinus1');
      if (btnMinus1) btnMinus1.addEventListener('click', () => {
        setAppBpm(this.currentBpm - 1);
      });

      const btnPlus1 = document.getElementById('btnBpmPlus1');
      if (btnPlus1) btnPlus1.addEventListener('click', () => {
        setAppBpm(this.currentBpm + 1);
      });

      const btnPlus5 = document.getElementById('btnBpmPlus5');
      if (btnPlus5) btnPlus5.addEventListener('click', () => {
        setAppBpm(this.currentBpm + 5);
      });

      // Progression Analyzer controls
      const btnAnalyze = document.getElementById('btnAnalyze');
      if (btnAnalyze) {
        btnAnalyze.addEventListener('click', () => {
          this.analyzeProgression();
        });
      }

      const inputField = document.getElementById('progressionInput');
      if (inputField) {
        inputField.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.analyzeProgression();
        });
      }

      // Presets dropdown
      const presets = document.getElementById('progressionPresets');
      if (presets) {
        presets.addEventListener('change', (e) => {
          if (e.target.value) {
            inputField.value = e.target.value;
            this.analyzeProgression();
          }
        });
      }

      // Chord Notation Guide Drawer & Interactive Chips
      const btnToggleChordGuide = document.getElementById('btnToggleChordGuide');
      const chordGuideDrawer = document.getElementById('chordGuideDrawer');
      const btnCloseChordGuide = document.getElementById('btnCloseChordGuide');

      if (btnToggleChordGuide && chordGuideDrawer) {
        btnToggleChordGuide.addEventListener('click', () => {
          chordGuideDrawer.classList.toggle('open');
        });
      }

      if (btnCloseChordGuide && chordGuideDrawer) {
        btnCloseChordGuide.addEventListener('click', () => {
          chordGuideDrawer.classList.remove('open');
        });
      }

      document.querySelectorAll('.chord-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          const chord = chip.getAttribute('data-chord') || chip.textContent.trim();
          if (inputField) {
            if (e.shiftKey) {
              inputField.value = chord;
            } else {
              const currentVal = inputField.value.trim();
              inputField.value = currentVal ? `${currentVal} ${chord}` : chord;
            }
            this.analyzeProgression();
          }
        });
      });

      // Play Progression button
      const btnPlayProg = document.getElementById('btnPlayProgression');
      if (btnPlayProg) {
        btnPlayProg.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          if (audio.isPlayingProgression) {
            audio.stopProgression();
            btnPlayProg.textContent = '▶ Play Progression';
            btnPlayProg.classList.remove('btn-warning');
            if (this.visualizer && (!this.beatSequencer || !this.beatSequencer.isPlaying)) {
              this.visualizer.stopAnimation();
            }
          } else {
            const bpm = this.getBpm();
            const loop = document.getElementById('loopProgression').checked;

            let syncStartTime = null;
            if (this.beatSequencer && this.beatSequencer.isPlaying) {
              syncStartTime = this.beatSequencer.getNextDownbeatAudioTime();
              btnPlayProg.textContent = '⏳ Syncing...';
              btnPlayProg.classList.add('btn-warning');
            } else {
              btnPlayProg.textContent = '⏹ Stop Progression';
            }

            if (this.visualizer) this.visualizer.startAnimation();
            audio.playProgression(this.parsedChords, bpm, loop, (idx, chord) => {
              btnPlayProg.textContent = '⏹ Stop Progression';
              btnPlayProg.classList.remove('btn-warning');
              this.highlightTableRow(idx);
              if (chord && this.visualizer) {
                this.visualizer.setActiveChord(chord);
              }
            }, () => {
              btnPlayProg.textContent = '▶ Play Progression';
              btnPlayProg.classList.remove('btn-warning');
              this.highlightTableRow(-1);
              if (this.visualizer && (!this.beatSequencer || !this.beatSequencer.isPlaying)) {
                this.visualizer.stopAnimation();
              }
            }, syncStartTime);
          }
        });
      }

      // Key Selection Dropdown
      const keyDropdown = document.getElementById('keySelectDropdown');
      if (keyDropdown) {
        keyDropdown.addEventListener('change', (e) => {
          const idx = parseInt(e.target.value, 10);
          if (this.detectedKeys[idx]) {
            this.selectedKey = this.detectedKeys[idx];
            this.updateKeyBanner();
            this.renderHarmonicTable();
            if (this.ribbonEngine) {
              this.ribbonEngine.setProgression(this.parsedChords, this.selectedKey);
              this.updateRibbonUI();
            }
          }
        });
      }
      // Mobile Quick-Nav Tab View Switching
      const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
      const allCards = document.querySelectorAll('.main-layout .card');
      const navScroll = document.querySelector('.mobile-nav-scroll');

      this.setMobileTab = (targetId) => {
        mobileNavBtns.forEach(btn => {
          if (btn.dataset.target === targetId) {
            btn.classList.add('active');
            if (navScroll) {
              const btnLeft = btn.offsetLeft - navScroll.offsetLeft;
              const btnWidth = btn.offsetWidth;
              const scrollWidth = navScroll.clientWidth;
              navScroll.scrollTo({
                left: btnLeft - (scrollWidth / 2) + (btnWidth / 2),
                behavior: 'smooth'
              });
            }
          } else {
            btn.classList.remove('active');
          }
        });

        if (targetId === 'all') {
          document.body.classList.remove('mobile-tab-view');
          allCards.forEach(card => card.classList.remove('mobile-active-card'));
          if (this.visualizer) this.visualizer.handleResize(true);
          if (this.ribbonRenderer) this.ribbonRenderer.handleResize(true);
          if (this.sheetMusicRenderer) this.sheetMusicRenderer.handleResize(true);
          if (this.tunerRenderer) this.tunerRenderer.setupCanvas(true);
          if (this.accuracyRenderer) this.accuracyRenderer.setupCanvases(true);
        } else {
          document.body.classList.add('mobile-tab-view');
          allCards.forEach(card => {
            if (card.id === targetId) {
              card.classList.add('mobile-active-card');
              if (card.id === 'tunerSection' || card.id === 'accuracySection' || card.id === 'movableChordSection' || card.id === 'transcriberSection') card.style.display = 'block';
            } else {
              card.classList.remove('mobile-active-card');
            }
          });

          if (targetId === 'visualizerSection' && this.visualizer) {
            setTimeout(() => this.visualizer.handleResize(true), 50);
          } else if (targetId === 'analyzerSection' && this.ribbonRenderer) {
            setTimeout(() => this.ribbonRenderer.handleResize(true), 50);
          } else if (targetId === 'metroSection' && this.sheetMusicRenderer) {
            setTimeout(() => this.sheetMusicRenderer.handleResize(true), 50);
          } else if (targetId === 'tunerSection' && this.tunerRenderer) {
            setTimeout(() => this.tunerRenderer.setupCanvas(true), 50);
          } else if (targetId === 'accuracySection' && this.accuracyRenderer) {
            setTimeout(() => this.accuracyRenderer.setupCanvases(true), 50);
          } else if (targetId === 'movableChordSection' && this.chordStudioRenderer) {
            setTimeout(() => this.chordStudioRenderer(), 50);
          } else if (targetId === 'transcriberSection' && this.transcriberStaffCanvasRenderer) {
            setTimeout(() => this.transcriberStaffCanvasRenderer(), 50);
          }
        }

        window.scrollTo({ top: 0, behavior: 'instant' });
      };

      mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.setMobileTab(btn.dataset.target);
        });
      });

      // Visualizer Mode Switchers
      document.querySelectorAll('.viz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          const mode = e.target.dataset.mode;
          if (this.visualizer) this.visualizer.setMode(mode);

          const fretboardControls = document.getElementById('fretboardControls');
          if (fretboardControls) {
            fretboardControls.style.display = (mode === 'fretboard') ? 'flex' : 'none';
          }
          const clockLayerControls = document.getElementById('clockLayerControls');
          if (clockLayerControls) {
            clockLayerControls.style.display = (mode === 'clock') ? 'flex' : 'none';
          }
        });
      });

      // Clock Concentric Layer Switchers (Option 2: Enhanced Clock)
      document.querySelectorAll('.clock-layer-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const layer = btn.dataset.layer;
          if (this.visualizer) {
            const isNowActive = this.visualizer.toggleLayer(layer);
            btn.classList.toggle('active', isNowActive);
          }
        });
      });

      // Fretboard Guitar / Bass toggle
      const instSelect = document.getElementById('fretboardInstrumentSelect');
      if (instSelect) {
        instSelect.addEventListener('change', (e) => {
          if (this.visualizer) this.visualizer.setFretboardInstrument(e.target.value);
        });
      }

      // Modal Shifter Controls
      const btnModal = document.getElementById('btnTransformModal');
      if (btnModal) {
        btnModal.addEventListener('click', () => {
          this.transformModal();
        });
      }

      // Jam Cards Controls
      const countEl = document.getElementById('jamCardCount');
      if (countEl) {
        countEl.addEventListener('change', () => {
          this.dealJamCards();
        });
        countEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.dealJamCards();
          }
        });
      }

      const poolEl = document.getElementById('jamCardPool');
      if (poolEl) {
        poolEl.addEventListener('change', () => {
          this.dealJamCards();
        });
      }

      const btnDeal = document.getElementById('btnDealCards');
      if (btnDeal) {
        btnDeal.addEventListener('click', () => {
          this.dealJamCards();
        });
      }

      const btnChallenge = document.getElementById('btnNewChallenge');
      if (btnChallenge) {
        btnChallenge.addEventListener('click', () => {
          this.generateJamChallenge();
        });
      }

      const btnPlayCards = document.getElementById('btnPlayCards');
      if (btnPlayCards) {
        btnPlayCards.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          const bpm = this.getBpm();
          const parsedCards = this.jamCards.map(c => Theory.parseChord(c.symbol)).filter(Boolean);
          audio.playProgression(parsedCards, bpm, false, (idx, chord) => {
            this.highlightCard(idx);
            if (chord && this.visualizer) this.visualizer.setActiveChord(chord);
          }, () => {
            this.highlightCard(-1);
          });
        });
      }

      // Export Jam Deck progression as TXT file
      const btnExportJam = document.getElementById('btnExportJamTxt');
      if (btnExportJam) {
        btnExportJam.addEventListener('click', () => {
          this.exportJamProgressionTxt();
        });
      }

      // Export Jam Deck progression as MIDI file
      const btnExportJamDeckMidi = document.getElementById('btnExportJamDeckMidi');
      if (btnExportJamDeckMidi) {
        btnExportJamDeckMidi.addEventListener('click', () => {
          this.exportJamProgressionMidi();
        });
      }

      // Send Jam Deck progression directly to Harmonic Analyzer
      const btnSendJam = document.getElementById('btnSendJamToAnalyzer');
      if (btnSendJam) {
        btnSendJam.addEventListener('click', () => {
          this.sendJamToAnalyzer();
        });
      }

      // Metronome Controls & Time Signature
      const timeSigInput = document.getElementById('metroTimeSigInput');
      if (timeSigInput) {
        timeSigInput.addEventListener('input', () => {
          this.updateTimeSignature();
        });
      }

      const metroSubdiv = document.getElementById('metroSubdivision');
      if (metroSubdiv) {
        metroSubdiv.addEventListener('change', () => {
          if (audio && audio.isMetronomeRunning) {
            this.restartRunningMetronome();
          }
        });
      }

      const metroSound = document.getElementById('metroSound');
      if (metroSound) {
        metroSound.addEventListener('change', () => {
          if (audio && audio.isMetronomeRunning) {
            this.restartRunningMetronome();
          }
        });
      }

      const btnMetro = document.getElementById('btnToggleMetronome');
      if (btnMetro) {
        btnMetro.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          if (audio.isMetronomeRunning) {
            audio.stopMetronome();
            btnMetro.textContent = '▶ Start Metronome';
            btnMetro.classList.remove('btn-danger');
            this.stopPracticeTimer();
          } else {
            btnMetro.textContent = '⏹ Stop Metronome';
            btnMetro.classList.add('btn-danger');
            this.startPracticeTimer();
            this.restartRunningMetronome();
          }
        });
      }

      // Practice Session Timer Controls
      const btnNextEx = document.getElementById('btnNextExercise');
      if (btnNextEx) {
        btnNextEx.addEventListener('click', () => {
          this.nextPracticeExercise();
        });
      }

      const btnResetTimer = document.getElementById('btnResetTimer');
      if (btnResetTimer) {
        btnResetTimer.addEventListener('click', () => {
          this.resetPracticeTimer();
        });
      }

      const btnToggleLog = document.getElementById('btnToggleTimerLog');
      const timerLogDrawer = document.getElementById('timerLogDrawer');
      if (btnToggleLog && timerLogDrawer) {
        btnToggleLog.addEventListener('click', () => {
          const isHidden = timerLogDrawer.style.display === 'none';
          timerLogDrawer.style.display = isHidden ? 'block' : 'none';
        });
      }

      const btnClearLog = document.getElementById('btnClearTimerLog');
      if (btnClearLog) {
        btnClearLog.addEventListener('click', () => {
          this.practiceTimer.exerciseHistory = [];
          this.renderTimerLog();
        });
      }

      const targetSelect = document.getElementById('timerTargetDuration');
      if (targetSelect) {
        targetSelect.addEventListener('change', () => {
          this.practiceTimer.targetChimePlayed = false;
          this.removeTargetGoalHighlight();
        });
      }

      // Rhythm Generator
      const btnRhythm = document.getElementById('btnGenerateRhythm');
      if (btnRhythm) {
        btnRhythm.addEventListener('click', () => {
          this.generateRhythm();
        });
      }

      const rhythmIncludeRests = document.getElementById('rhythmIncludeRests');
      if (rhythmIncludeRests) {
        rhythmIncludeRests.addEventListener('change', () => {
          this.generateRhythm();
        });
      }

      const rhythmTargetTrack = document.getElementById('rhythmTargetTrack');
      if (rhythmTargetTrack) {
        rhythmTargetTrack.addEventListener('change', () => {
          if (this.currentRhythmItems && this.currentRhythmItems.length > 0) {
            this.applyRhythmToGrid(this.currentRhythmItems, rhythmTargetTrack.value);
            this.renderBeatGrid();
          } else {
            this.generateRhythm();
          }
        });
      }

      const rhythmStyleSelect = document.getElementById('rhythmStyleSelect');
      if (rhythmStyleSelect) {
        rhythmStyleSelect.addEventListener('change', () => {
          this.generateRhythm();
        });
      }

      const btnCopyUnicode = document.getElementById('btnCopyUnicodeRhythm');
      if (btnCopyUnicode) {
        btnCopyUnicode.addEventListener('click', async () => {
          if (!this.currentRhythmItems || this.currentRhythmItems.length === 0) return;
          const text = this.currentRhythmItems.map(i => i.glyph).join(' ');
          try {
            await navigator.clipboard.writeText(text);
            const orig = btnCopyUnicode.textContent;
            btnCopyUnicode.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyUnicode.textContent = orig; }, 1800);
          } catch {
            prompt('Copy Unicode Rhythm:', text);
          }
        });
      }

      const btnMetroGo = document.getElementById('btnMetroGoToRhythm');
      if (btnMetroGo) {
        btnMetroGo.addEventListener('click', () => {
          const btnBeats = document.getElementById('btnMetroModeBeats');
          if (btnBeats) btnBeats.click();
          this.generateRhythm();
          const target = document.getElementById('beatSheetMusicContainer');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }

      const rhythmLoopMode = document.getElementById('rhythmLoopMode');
      const rhythmCustomCount = document.getElementById('rhythmCustomCount');
      if (rhythmLoopMode && rhythmCustomCount) {
        rhythmLoopMode.addEventListener('change', () => {
          if (rhythmLoopMode.value === 'custom') {
            rhythmCustomCount.style.display = 'inline-block';
            rhythmCustomCount.focus();
          } else {
            rhythmCustomCount.style.display = 'none';
          }
        });
      }

      const btnPlayRhythm = document.getElementById('btnPlayRhythm');
      if (btnPlayRhythm) {
        btnPlayRhythm.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();

          // If already playing, clicking stops playback immediately
          if (audio.isRhythmPlaying) {
            audio.stopRhythm();
            this.updateRhythmPlayButtonState(false);
            this.highlightRhythmGlyph(-1);
            if (this.sheetMusicRenderer) this.sheetMusicRenderer.setActiveStep(-1);
            return;
          }

          if (!this.currentRhythmItems || this.currentRhythmItems.length === 0) {
            this.generateRhythm();
          }

          // Parse loop count: 1, integer, or Infinity
          const mode = rhythmLoopMode ? rhythmLoopMode.value : '4';
          let loopCount = 1;
          if (mode === 'infinite') {
            loopCount = Infinity;
          } else if (mode === 'custom') {
            const val = parseInt(rhythmCustomCount ? rhythmCustomCount.value : '4', 10);
            loopCount = Math.max(1, Math.min(999, isNaN(val) ? 4 : val));
          } else {
            loopCount = Math.max(1, parseInt(mode, 10) || 1);
          }

          let syncStartTime = null;
          if (this.beatSequencer && this.beatSequencer.isPlaying) {
            syncStartTime = this.beatSequencer.getNextDownbeatAudioTime();
            btnPlayRhythm.textContent = '⏳ Syncing...';
          } else {
            this.updateRhythmPlayButtonState(true);
          }

          const statusBadge = document.getElementById('rhythmLoopStatus');
          if (statusBadge) {
            statusBadge.style.display = 'inline-block';
            statusBadge.textContent = (loopCount === Infinity) ? 'Loop 1 (∞)' : `Loop 1 of ${loopCount}`;
          }

          try {
            audio.playRhythmSequence(
              this.currentRhythmItems,
              () => this.getBpm(),
              loopCount,
              (idx) => {
                this.updateRhythmPlayButtonState(true);
                this.highlightRhythmGlyph(idx);
                if (this.sheetMusicRenderer) this.sheetMusicRenderer.setActiveNoteIndex(idx);
              },
              (currentLoop, maxLoops) => {
                if (statusBadge) {
                  statusBadge.textContent = (maxLoops === Infinity)
                    ? `Loop ${currentLoop} (∞)`
                    : `Loop ${currentLoop} of ${maxLoops}`;
                }
              },
              () => {
                this.updateRhythmPlayButtonState(false);
                this.highlightRhythmGlyph(-1);
                if (this.sheetMusicRenderer) this.sheetMusicRenderer.setActiveStep(-1);
              },
              syncStartTime
            );
          } catch (err) {
            console.error('Error starting rhythm playback:', err);
            this.updateRhythmPlayButtonState(false);
            this.highlightRhythmGlyph(-1);
            if (this.sheetMusicRenderer) this.sheetMusicRenderer.setActiveStep(-1);
          }
        });
      }

      // Ear Training Drills
      const btnInterval = document.getElementById('btnPlayIntervalDrill');
      if (btnInterval) {
        btnInterval.addEventListener('click', async () => {
          if (audio) await audio.init();
          this.startIntervalDrill();
        });
      }

      document.querySelectorAll('.quiz-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.checkIntervalAnswer(parseInt(e.target.dataset.interval, 10));
        });
      });

      // Web Exercise selector & Category Filter
      const btnExercise = document.getElementById('btnRandomWebExercise');
      if (btnExercise) {
        btnExercise.addEventListener('click', () => {
          this.pickRandomExercise();
        });
      }

      const selectCategory = document.getElementById('exerciseCategorySelect');
      if (selectCategory) {
        selectCategory.addEventListener('change', () => {
          this.pickRandomExercise();
        });
      }

      // Panel Student Guide Drawer Toggles
      this.bindPanelGuides();
    }

    bindPanelGuides() {
      // Toggle panel guide drawer when clicking top-left ℹ button
      document.querySelectorAll('.panel-help-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = btn.dataset.panelGuide;
          if (!targetId) return;
          const drawer = document.getElementById(targetId);
          if (!drawer) return;

          const isCurrentlyOpen = drawer.style.display !== 'none';
          if (isCurrentlyOpen) {
            drawer.style.display = 'none';
            btn.classList.remove('active');
            btn.setAttribute('aria-expanded', 'false');
          } else {
            drawer.style.display = 'block';
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
          }
        });
      });

      // Close button inside guide drawer
      document.querySelectorAll('.guide-box-close').forEach((closeBtn) => {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetId = closeBtn.dataset.closeGuide;
          if (!targetId) return;
          const drawer = document.getElementById(targetId);
          if (drawer) {
            drawer.style.display = 'none';
          }
          const triggerBtn = document.querySelector(`.panel-help-btn[data-panel-guide="${targetId}"]`);
          if (triggerBtn) {
            triggerBtn.classList.remove('active');
            triggerBtn.setAttribute('aria-expanded', 'false');
          }
        });
      });
    }

    // 1. Analyze Chord Progression
    analyzeProgression() {
      const Theory = window.SongTheory;
      if (!Theory) return;

      const input = document.getElementById('progressionInput');
      if (!input) return;
      const raw = input.value.trim();
      // Split chords by arrow "->", spaced dash " - ", comma, pipe, semicolon, or whitespace
      const tokens = raw.split(/\s*->\s*|\s+-\s+|\s*[,;|]\s*|\s+/).filter(Boolean);
      this.parsedChords = tokens.map(t => Theory.parseChord(t)).filter(Boolean);

      const banner = document.getElementById('keyAnalysisBanner');
      if (this.parsedChords.length === 0) {
        if (banner) banner.textContent = 'Could not recognize chord symbols. Try: C, Dm7, G7, F#m7b5';
        return;
      }

      // Detect Keys
      this.detectedKeys = Theory.detectKeys(this.parsedChords);
      this.selectedKey = this.detectedKeys[0] || null;

      this.renderKeyDropdown();
      this.renderHarmonicTable();

      // Send first chord to visualizer
      if (this.parsedChords[0] && this.visualizer) {
        this.visualizer.setActiveChord(this.parsedChords[0]);
      }

      // Update Voice Leading Ribbon Engine
      if (this.ribbonEngine) {
        this.ribbonEngine.setProgression(this.parsedChords, this.selectedKey);
        this.updateRibbonUI();
      }
    }

    updateKeyBanner() {
      const banner = document.getElementById('keyAnalysisBanner');
      if (!this.selectedKey || !banner) return;

      const fit = this.selectedKey.diatonicFit;
      const conf = this.selectedKey.confidence;
      const fitBadgeClass = fit === 100 ? 'badge-success' : (fit >= 80 ? 'badge-info' : 'badge-warning');
      const confBadgeClass = conf >= 85 ? 'badge-success' : (conf >= 60 ? 'badge-info' : 'badge-warning');

      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
          <span><strong>Key Center:</strong> <span style="font-size: 1.02rem; font-weight: 700; color: #fff;">${this.selectedKey.keyName}</span></span>
          <span class="badge ${fitBadgeClass}" title="Diatonic Note Fit: ${this.selectedKey.matchedPCs} of ${this.selectedKey.totalNotes} progression notes belong to the ${this.selectedKey.keyName} scale">
            ${fit}% Diatonic Fit
          </span>
          <span class="badge ${confBadgeClass}" title="Key Confidence: Likelihood this key is the primary tonal center based on root emphasis, cadences, and harmonic roles">
            ${conf}% Confidence
          </span>
          <span class="text-muted" style="margin-left: auto; font-size: 0.82rem;">
            ${this.selectedKey.matchedPCs} of ${this.selectedKey.totalNotes} notes &amp; ${this.selectedKey.diatonicChords} of ${this.selectedKey.totalChords} chords in key
          </span>
        </div>
      `;
    }

    renderKeyDropdown() {
      const dropdown = document.getElementById('keySelectDropdown');
      if (!dropdown) return;
      dropdown.innerHTML = '';

      this.detectedKeys.slice(0, 6).forEach((cand, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        const tag = idx === 0 ? 'Primary' : (cand.diatonicFit === 100 ? 'Alternative' : '');
        const tagStr = tag ? ` · ${tag}` : '';
        opt.textContent = `${cand.keyName} (${cand.diatonicFit}% fit · ${cand.confidence}% conf${tagStr})`;
        dropdown.appendChild(opt);
      });

      this.updateKeyBanner();
    }

    renderHarmonicTable() {
      const Theory = window.SongTheory;
      const audio = window.audio;
      const tbody = document.querySelector('#harmonicTable tbody');
      if (!tbody || !this.selectedKey || !Theory) return;
      tbody.innerHTML = '';

      this.parsedChords.forEach((chord, idx) => {
        const analysis = Theory.analyzeChordInKey(chord, this.selectedKey);
        const row = document.createElement('tr');
        row.dataset.index = idx;

        row.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td>
            <span class="chord-pill">${chord.displayName}</span>
          </td>
          <td class="col-root">${chord.root}</td>
          <td class="col-quality">${chord.qualityName}</td>
          <td class="col-formula"><code>${chord.formula}</code></td>
          <td class="chord-tones">${chord.notes.join(' - ')}</td>
          <td class="col-degree"><strong>${analysis.degreeName}</strong></td>
          <td><span class="roman-badge ${analysis.isDiatonic ? 'diatonic' : 'non-diatonic'}">${analysis.romanNumeral}</span></td>
          <td><small class="${analysis.isDiatonic ? 'text-diatonic' : 'text-altered'}">${analysis.harmonicFunction}</small></td>
          <td class="col-actions">
            <button class="btn-sm btn-play-chord" title="Play Chord">▶</button>
            <button class="btn-sm btn-arp-chord" title="Play Arpeggio">〰</button>
            <button class="btn-sm btn-show-chord" title="View on Canvas">👁</button>
            <button class="btn-sm btn-scale-palette" title="Find Compatible 4-to-12 Tone Scales for this chord" style="padding: 2px 7px; font-size: 0.74rem;">🎼 Scales</button>
          </td>
        `;

        row.querySelector('.btn-play-chord').addEventListener('click', async () => {
          if (audio) {
            await audio.init();
            audio.playChord(chord);
          }
          if (this.visualizer) this.visualizer.setActiveChord(chord);
          this.highlightTableRow(idx);
        });

        row.querySelector('.btn-arp-chord').addEventListener('click', async () => {
          if (audio) {
            await audio.init();
            audio.playArpeggio(chord);
          }
          if (this.visualizer) this.visualizer.setActiveChord(chord);
          this.highlightTableRow(idx);
        });

        row.querySelector('.btn-show-chord').addEventListener('click', () => {
          if (this.visualizer) this.visualizer.setActiveChord(chord);
          this.highlightTableRow(idx);
          if (window.innerWidth < 960 && typeof this.setMobileTab === 'function') {
            this.setMobileTab('visualizerSection');
          }
        });

        row.querySelector('.btn-scale-palette').addEventListener('click', () => {
          this.openChordScalePalette(chord);
          this.highlightTableRow(idx);
        });

        tbody.appendChild(row);
      });
    }

    highlightTableRow(idx) {
      if (this._activeTableRowIdx === idx) return;
      this._activeTableRowIdx = idx;
      const table = document.getElementById('harmonicTable');
      if (!table || table.offsetParent === null) return;
      table.querySelectorAll('tbody tr').forEach(tr => {
        if (parseInt(tr.dataset.index, 10) === idx) {
          tr.classList.add('table-row-active');
        } else {
          tr.classList.remove('table-row-active');
        }
      });
    }

    // -------------------------------------------------------------
    // 2. Base-12 Modal & Scale Studio (4-to-12 Tone Harmony & Mood Engine)
    // -------------------------------------------------------------
    initModalScaleStudio() {
      const scaleEngine = window.SongScales ? window.SongScales.scaleEngine : null;
      if (!scaleEngine) return;

      this.selectedScaleCardinality = 'all';
      this.selectedScaleCategory = 'all';
      this.selectedScaleId = 'diatonic';
      this.currentPaletteMatches = [];
      this.currentPaletteChord = null;

      // 1. Cardinality Filter Pills (4 to 12 Tones)
      const pillContainer = document.getElementById('scaleCardinalityFilters');
      if (pillContainer) {
        pillContainer.querySelectorAll('.scale-cardinality-pill').forEach(btn => {
          btn.addEventListener('click', () => {
            pillContainer.querySelectorAll('.scale-cardinality-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedScaleCardinality = btn.dataset.cardinality || 'all';
            this.populateScaleFamilyDropdown();
            this.renderModalStudio();
          });
        });
      }

      // 2. Category Filter Dropdown
      const catSelect = document.getElementById('scaleCategoryFilter');
      if (catSelect) {
        catSelect.addEventListener('change', (e) => {
          this.selectedScaleCategory = e.target.value;
          this.populateScaleFamilyDropdown();
          this.renderModalStudio();
        });
      }

      // 3. Parent Scale Family Dropdown
      const scaleSelect = document.getElementById('scaleFamilySelect');
      if (scaleSelect) {
        scaleSelect.addEventListener('change', (e) => {
          if (e.target.value) {
            this.selectedScaleId = e.target.value;
            this.renderModalStudio();
          }
        });
      }

      // 4. Tonic & Degrees Inputs
      const tonicInput = document.getElementById('modalTonicInput');
      const degreesInput = document.getElementById('modalDegreesInput');
      if (tonicInput) {
        tonicInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.renderModalStudio();
        });
        tonicInput.addEventListener('change', () => this.renderModalStudio());
      }
      if (degreesInput) {
        degreesInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.renderModalStudio();
        });
        degreesInput.addEventListener('change', () => this.renderModalStudio());
      }

      // 5. Transform Button
      const btnTransform = document.getElementById('btnTransformModal');
      if (btnTransform) {
        btnTransform.addEventListener('click', () => {
          this.renderModalStudio();
        });
      }

      // 6. Chord-Scale Palette Drawer Close & Tabs
      const btnClosePalette = document.getElementById('btnCloseScalePalette');
      if (btnClosePalette) {
        btnClosePalette.addEventListener('click', () => {
          const drawer = document.getElementById('chordScalePaletteDrawer');
          if (drawer) drawer.style.display = 'none';
        });
      }

      const paletteTabs = document.getElementById('paletteCategoryTabs');
      if (paletteTabs) {
        paletteTabs.querySelectorAll('.palette-tab-btn').forEach(tab => {
          tab.addEventListener('click', () => {
            paletteTabs.querySelectorAll('.palette-tab-btn').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            this.renderPaletteCards(tab.dataset.fitCategory || 'all');
          });
        });
      }

      this.populateScaleFamilyDropdown();
      this.renderModalStudio();
    }

    populateScaleFamilyDropdown() {
      const scaleEngine = window.SongScales ? window.SongScales.scaleEngine : null;
      const select = document.getElementById('scaleFamilySelect');
      if (!scaleEngine || !select) return;

      select.innerHTML = '';
      let scales = scaleEngine.getAllScales();

      if (this.selectedScaleCardinality && this.selectedScaleCardinality !== 'all') {
        const n = parseInt(this.selectedScaleCardinality, 10);
        scales = scales.filter(s => s.cardinality === n);
      }

      if (this.selectedScaleCategory && this.selectedScaleCategory !== 'all') {
        scales = scales.filter(s => s.category === this.selectedScaleCategory);
      }

      if (scales.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No scales match this filter';
        select.appendChild(opt);
        return;
      }

      // Group by Cardinality & Family
      const groups = {};
      scales.forEach(s => {
        const groupName = `${s.cardinality}-Tone (${s.family || 'Scale'})`;
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(s);
      });

      let foundCurrent = false;
      Object.keys(groups).forEach(gName => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = gName;
        groups[gName].forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.name} [${s.formula}]`;
          if (s.id === this.selectedScaleId) {
            opt.selected = true;
            foundCurrent = true;
          }
          optgroup.appendChild(opt);
        });
        select.appendChild(optgroup);
      });

      if (!foundCurrent && scales[0]) {
        this.selectedScaleId = scales[0].id;
        select.value = scales[0].id;
      }
    }

    transformModal() {
      // Wrapper for backwards compatibility
      this.renderModalStudio();
    }

    renderModalStudio() {
      const scaleEngine = window.SongScales ? window.SongScales.scaleEngine : null;
      const Theory = window.SongTheory;
      const audio = window.audio;
      if (!scaleEngine || !Theory) return;

      const tonic = document.getElementById('modalTonicInput')?.value.trim() || 'C';
      const rawDegrees = document.getElementById('modalDegreesInput')?.value.trim() || '1, 4, 5';
      const degreesList = rawDegrees.split(/[\s,]+/).map(d => parseInt(d, 10)).filter(n => !isNaN(n));

      const scale = scaleEngine.getScaleById(this.selectedScaleId) || scaleEngine.getScaleById('diatonic');
      if (!scale) return;

      // Update info banner
      const banner = document.getElementById('modalScaleInfoBanner');
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div>
            <strong>${scale.name}</strong> • <span style="color: #38bdf8; font-weight: 700;">${scale.cardinality} Tones</span> • <code>${scale.formula}</code>
            <div style="color: var(--text-muted); font-size: 0.74rem; margin-top: 2px;">${scale.description} (${scale.origin})</div>
          </div>
          <div>
            <span class="badge badge-info">${scale.family}</span>
          </div>
        `;
      }

      const container = document.getElementById('modalResultsContainer');
      if (!container) return;
      container.innerHTML = '';

      // Compute rotational modes sorted by acoustic brightness
      const modes = scaleEngine.getRotationalModes(scale);

      modes.forEach((mode) => {
        const card = document.createElement('div');
        card.className = 'modal-mode-card';

        // Harmonize degrees for this mode in chosen tonic
        const harmonizedChords = scaleEngine.harmonizeMode(mode.intervals, tonic);
        const k = mode.intervals.length;

        // Note spelling
        const rootPC = Theory.noteToPitchClass(tonic) || 0;
        const preferFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm'].includes(tonic);
        const spelledNotes = (k === 7 && Theory.spellIntervalNote)
          ? mode.intervals.map((iv, degIdx) => Theory.spellIntervalNote(tonic, degIdx + 1, (rootPC + iv) % 12))
          : mode.intervals.map(iv => Theory.pitchClassToNote((rootPC + iv) % 12, preferFlats));

        // Brightness badge class & icon
        let bClass = 'moderate';
        let bIcon = '🌤';
        if (mode.brightness >= 5) { bClass = 'bright'; bIcon = '☀️'; }
        else if (mode.brightness >= 1) { bClass = 'moderate'; bIcon = '🌕'; }
        else if (mode.brightness >= -3) { bClass = 'dark'; bIcon = '🌑'; }
        else { bClass = 'deep-dark'; bIcon = '⚡'; }

        // Project progression degrees through this mode
        let progChords = [];
        if (degreesList.length > 0) {
          progChords = degreesList.map(deg => {
            const degIdx = ((deg - 1) % k + k) % k;
            return harmonizedChords[degIdx]?.seventh || harmonizedChords[degIdx]?.triad || `${tonic}`;
          });
        }

        const progString = progChords.length > 0 ? progChords.join(' → ') : '';

        card.innerHTML = `
          <div class="modal-mode-header">
            <div class="modal-mode-title-box">
              <span class="modal-mode-name">${mode.name}</span>
              <span class="modal-brightness-badge ${bClass}" title="Acoustic Brightness Score: ${mode.brightness > 0 ? '+' : ''}${mode.brightness}">
                ${bIcon} ${mode.brightness > 0 ? '+' : ''}${mode.brightness}
              </span>
              <span class="modal-mood-tag">${mode.mood}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">
              Mode ${mode.index} of ${k}
            </div>
          </div>

          <div class="modal-mode-details">
            <div class="modal-formula-line">
              <span style="font-weight: 700; color: #cbd5e1;">Notes (${tonic}):</span>
              <span style="color: #38bdf8; font-family: var(--font-mono); font-weight: 600;">${spelledNotes.join(' - ')}</span>
              <span style="color: var(--text-muted); margin-left: 8px;">• Formula: <code>${mode.formula}</code></span>
            </div>

            <div class="modal-chords-line">
              <span style="font-weight: 700; color: #cbd5e1;">Harmonized Chords:</span>
              <div style="display: inline-flex; gap: 4px; flex-wrap: wrap;">
                ${harmonizedChords.map(hc => `<button type="button" class="modal-chord-pill" data-chord="${hc.seventh}" title="Audition ${hc.seventh} (Degree ${hc.degree})">${hc.degree}: ${hc.seventh}</button>`).join('')}
              </div>
            </div>

            ${progString ? `
              <div class="modal-progression-preview" title="Progression degrees [${degreesList.join(', ')}] projected through ${mode.name}">
                <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Modal Progression:</span>
                <span>${progString}</span>
              </div>
            ` : ''}
          </div>

          <div class="modal-mode-actions">
            <button type="button" class="btn-sm btn-play-scale" title="Play individual scale notes ascending">▶ Play Scale</button>
            ${progChords.length > 0 ? `<button type="button" class="btn-sm btn-play-mode-prog" title="Audition projected progression chords in time">▶ Play Chords</button>` : ''}
            <button type="button" class="btn-sm btn-view-scale" title="View scale polygon on 12-tone clock, fretboard, and piano">👁 Show on Canvas</button>
            ${progChords.length > 0 ? `<button type="button" class="btn-sm btn-send-prog" title="Send this progression into Module 1 for harmonic analysis">📋 Send to Analyzer</button>` : ''}
          </div>
        `;

        // Clickable harmonized chord pills audition individual chords
        card.querySelectorAll('.modal-chord-pill').forEach(pill => {
          pill.addEventListener('click', async () => {
            const sym = pill.dataset.chord;
            if (sym && audio) {
              await audio.init();
              const parsed = Theory.parseChord(sym);
              if (parsed) {
                audio.playChord(parsed);
                if (this.visualizer) this.visualizer.setActiveChord(parsed);
              }
            }
          });
        });

        // Play Scale button
        card.querySelector('.btn-play-scale')?.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          audio.playScale(mode.intervals, tonic);
          if (this.visualizer) {
            this.visualizer.setActiveScale({ name: mode.name, intervals: mode.intervals, mood: mode.mood }, tonic);
          }
        });

        // Play Chords button
        card.querySelector('.btn-play-mode-prog')?.addEventListener('click', async () => {
          if (!audio || progChords.length === 0) return;
          await audio.init();
          const parsed = progChords.map(c => Theory.parseChord(c)).filter(Boolean);
          audio.playProgression(parsed, this.getBpm(), false, (idx, c) => {
            if (c && this.visualizer) this.visualizer.setActiveChord(c);
          }, null);
        });

        // View on Canvas button
        card.querySelector('.btn-view-scale')?.addEventListener('click', () => {
          if (this.visualizer) {
            this.visualizer.setActiveScale({ name: mode.name, intervals: mode.intervals, mood: mode.mood }, tonic);
          }
          if (window.innerWidth < 960 && typeof this.setMobileTab === 'function') {
            this.setMobileTab('visualizerSection');
          }
        });

        // Send to Analyzer button
        card.querySelector('.btn-send-prog')?.addEventListener('click', () => {
          const input = document.getElementById('progressionInput');
          if (input && progChords.length > 0) {
            input.value = progChords.join(' ');
            this.analyzeProgression();
            document.getElementById('analyzerSection')?.scrollIntoView({ behavior: 'smooth' });
          }
        });

        container.appendChild(card);
      });
    }

    // -------------------------------------------------------------
    // Chord-Scale Compatibility Palette Drawer
    // -------------------------------------------------------------
    openChordScalePalette(chord) {
      const scaleEngine = window.SongScales ? window.SongScales.scaleEngine : null;
      if (!scaleEngine || !chord) return;

      const drawer = document.getElementById('chordScalePaletteDrawer');
      const title = document.getElementById('paletteChordTitle');
      const countBadge = document.getElementById('paletteMatchCount');
      const grid = document.getElementById('paletteScalesGrid');
      if (!drawer || !grid) return;

      const chordSymbol = chord.displayName || chord.symbol || 'C';
      const matches = scaleEngine.findCompatibleScalesForChord(chordSymbol);

      this.currentPaletteMatches = matches;
      this.currentPaletteChord = chord;

      if (title) title.textContent = `Compatible Scales for ${chordSymbol} (${chord.qualityName || 'Chord'})`;
      if (countBadge) countBadge.textContent = `${matches.length} Scales Found`;

      drawer.style.display = 'block';
      this.renderPaletteCards('all');

      drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    renderPaletteCards(filterCategory = 'all') {
      const audio = window.audio;
      const grid = document.getElementById('paletteScalesGrid');
      if (!grid || !this.currentPaletteMatches) return;
      grid.innerHTML = '';

      let list = this.currentPaletteMatches;
      if (filterCategory === 'diatonic') {
        list = list.filter(m => m.fitType.includes('Diatonic'));
      } else if (filterCategory === 'jazz') {
        list = list.filter(m => m.fitType.includes('Jazz'));
      } else if (filterCategory === 'symmetrical') {
        list = list.filter(m => m.fitType.includes('Symmetrical'));
      } else if (filterCategory === 'world') {
        list = list.filter(m => m.fitType.includes('World'));
      }

      if (list.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.85rem; padding: 12px; text-align: center;">No scales match this category for this chord.</div>`;
        return;
      }

      list.slice(0, 36).forEach(item => {
        const card = document.createElement('div');
        card.className = 'palette-scale-card';

        card.innerHTML = `
          <div class="palette-scale-top">
            <div>
              <span class="palette-scale-name">${item.modeName}</span>
              <div style="font-size: 0.72rem; color: #94a3b8;">${item.scaleName}</div>
            </div>
            <span class="palette-scale-tag">${item.cardinality} Tones</span>
          </div>

          <div class="palette-scale-formula">
            <code>${item.formula}</code>
          </div>

          <div class="palette-scale-mood">
            ${item.mood}
          </div>

          <div class="palette-scale-actions">
            <button type="button" class="btn-sm btn-play-pal-scale" title="Audition this scale ascending">▶ Play</button>
            <button type="button" class="btn-sm btn-show-pal-scale" title="View on Clock, Fretboard, and Piano">👁 Show</button>
            <button type="button" class="btn-sm btn-open-modal-studio" title="Open and explore this scale's full modes in Module 2">🪐 Modal Studio</button>
          </div>
        `;

        card.querySelector('.btn-play-pal-scale')?.addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          const scaleObj = window.SongScales.scaleEngine.getScaleById(item.scaleId);
          if (scaleObj) {
            audio.playScale(scaleObj.intervals, item.rootNote);
          }
        });

        card.querySelector('.btn-show-pal-scale')?.addEventListener('click', () => {
          const scaleObj = window.SongScales.scaleEngine.getScaleById(item.scaleId);
          if (this.visualizer && scaleObj) {
            this.visualizer.setActiveScale({ name: item.modeName, intervals: scaleObj.intervals, mood: item.mood }, item.rootNote);
          }
          if (window.innerWidth < 960 && typeof this.setMobileTab === 'function') {
            this.setMobileTab('visualizerSection');
          }
        });

        card.querySelector('.btn-open-modal-studio')?.addEventListener('click', () => {
          this.selectedScaleId = item.scaleId;
          this.populateScaleFamilyDropdown();
          const familySelect = document.getElementById('scaleFamilySelect');
          const tonicInput = document.getElementById('modalTonicInput');
          if (familySelect) familySelect.value = item.scaleId;
          if (tonicInput) tonicInput.value = item.rootNote;
          this.renderModalStudio();
          document.getElementById('modalSection')?.scrollIntoView({ behavior: 'smooth' });
        });

        grid.appendChild(card);
      });
    }

    // 3. Musician's Jam Deck (Card Game)
    dealJamCards() {
      const Theory = window.SongTheory;
      if (!Theory) return;

      const countEl = document.getElementById('jamCardCount');
      let numCards = countEl ? parseInt(countEl.value, 10) : 4;
      if (isNaN(numCards) || numCards < 1) numCards = 4;
      if (numCards > 64) numCards = 64;
      if (countEl) countEl.value = numCards;

      if (!this.lockedCards) {
        this.lockedCards = new Set();
      } else {
        for (const idx of this.lockedCards) {
          if (idx >= numCards) this.lockedCards.delete(idx);
        }
      }

      const poolEl = document.getElementById('jamCardPool');
      const pool = poolEl ? poolEl.value : 'wildcard';

      const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      const qualities = Theory.CHORD_QUALITIES;

      // Diatonic key center and degree maps
      const diatonicTonic = roots[Math.floor(Math.random() * roots.length)];
      const diatonicIntervals = [0, 2, 4, 5, 7, 9, 11]; // Major scale degrees
      const diatonicQualities = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
      const spiceQualities = ['7', 'dim7', '7b9', '9', 'sus4', 'm9', 'maj9'];

      const newCards = [];
      for (let i = 0; i < numCards; i++) {
        if (this.lockedCards.has(i) && this.jamCards && this.jamCards[i]) {
          newCards.push(this.jamCards[i]);
        } else {
          let root, qualitySymbol, qualityObj;

          if (pool === 'diatonic_spice') {
            const isSpice = Math.random() < 0.25; // 25% chance of spice chord
            if (!isSpice) {
              const degIdx = Math.floor(Math.random() * diatonicIntervals.length);
              const tonicPC = roots.indexOf(diatonicTonic);
              const chordPC = (tonicPC + diatonicIntervals[degIdx]) % 12;
              root = roots[chordPC];
              qualitySymbol = diatonicQualities[degIdx];
            } else {
              root = roots[Math.floor(Math.random() * roots.length)];
              qualitySymbol = spiceQualities[Math.floor(Math.random() * spiceQualities.length)];
            }
            qualityObj = qualities.find(q => q.aliases && q.aliases.includes(qualitySymbol)) || qualities[0];
          } else {
            root = roots[Math.floor(Math.random() * roots.length)];
            qualityObj = qualities[Math.floor(Math.random() * qualities.length)];
            qualitySymbol = (qualityObj.aliases && qualityObj.aliases[0]) || '';
          }

          const symbol = `${root}${qualitySymbol}`;
          newCards.push({
            index: i,
            symbol,
            root,
            qualityName: qualityObj.name,
            formula: qualityObj.formula
          });
        }
      }

      this.jamCards = newCards;
      this.renderJamCards();
    }

    renderJamCards() {
      const Theory = window.SongTheory;
      const audio = window.audio;
      const container = document.getElementById('jamCardsContainer');
      if (!container || !Theory) return;
      container.innerHTML = '';

      this.jamCards.forEach((card, idx) => {
        const cardEl = document.createElement('div');
        cardEl.className = `jam-card ${this.lockedCards.has(idx) ? 'locked' : ''}`;
        cardEl.dataset.index = idx;

        cardEl.innerHTML = `
          <div class="jam-card-header">
            <span class="card-num">#${idx + 1}</span>
            <button class="btn-lock" title="Lock/Unlock Card">${this.lockedCards.has(idx) ? '🔒' : '🔓'}</button>
          </div>
          <div class="jam-card-symbol">${card.symbol}</div>
          <div class="jam-card-quality">${card.qualityName}</div>
          <div class="jam-card-formula">${card.formula}</div>
          <div class="jam-card-actions">
            <button class="btn-card-move-left" ${idx === 0 ? 'disabled' : ''}>←</button>
            <button class="btn-card-play">▶</button>
            <button class="btn-card-move-right" ${idx === this.jamCards.length - 1 ? 'disabled' : ''}>→</button>
          </div>
        `;

        cardEl.querySelector('.btn-lock').addEventListener('click', () => {
          if (this.lockedCards.has(idx)) this.lockedCards.delete(idx);
          else this.lockedCards.add(idx);
          this.renderJamCards();
        });

        cardEl.querySelector('.btn-card-move-left').addEventListener('click', () => {
          if (idx > 0) {
            const isCurrLocked = this.lockedCards.has(idx);
            const isPrevLocked = this.lockedCards.has(idx - 1);
            if (isCurrLocked) this.lockedCards.add(idx - 1); else this.lockedCards.delete(idx - 1);
            if (isPrevLocked) this.lockedCards.add(idx); else this.lockedCards.delete(idx);

            const temp = this.jamCards[idx];
            this.jamCards[idx] = this.jamCards[idx - 1];
            this.jamCards[idx - 1] = temp;
            this.renderJamCards();
          }
        });

        cardEl.querySelector('.btn-card-move-right').addEventListener('click', () => {
          if (idx < this.jamCards.length - 1) {
            const isCurrLocked = this.lockedCards.has(idx);
            const isNextLocked = this.lockedCards.has(idx + 1);
            if (isCurrLocked) this.lockedCards.add(idx + 1); else this.lockedCards.delete(idx + 1);
            if (isNextLocked) this.lockedCards.add(idx); else this.lockedCards.delete(idx);

            const temp = this.jamCards[idx];
            this.jamCards[idx] = this.jamCards[idx + 1];
            this.jamCards[idx + 1] = temp;
            this.renderJamCards();
          }
        });

        cardEl.querySelector('.btn-card-play').addEventListener('click', async () => {
          if (audio) {
            await audio.init();
            const parsed = Theory.parseChord(card.symbol);
            if (parsed) {
              audio.playChord(parsed);
              if (this.visualizer) this.visualizer.setActiveChord(parsed);
            }
          }
        });

        container.appendChild(cardEl);
      });
    }

    highlightCard(idx) {
      document.querySelectorAll('.jam-card').forEach((card, i) => {
        if (i === idx) card.classList.add('playing');
        else card.classList.remove('playing');
      });
    }

    generateJamChallenge() {
      const challenges = [
        'Voice Leading: Reorder cards so at least one guide tone (3rd or 7th) moves by a single semitone.',
        'Pedal Point Challenge: Keep a constant low E or A bass pedal ringing while playing these voicings on top.',
        'Smooth Cadence: Arrange the cards so the final chord resolves seamlessly back into the first card in a loop.',
        'Tritone Substitution: Identify any dominant 7th chord in your cards and swap it with its tritone substitution.',
        'Shell Voicings: Play only Root, 3rd, and 7th (leave out the 5th) on the middle 4 guitar strings.',
        'Arpeggio Run: Play each chord as an ascending arpeggio and resolve the top note into the next chord’s 3rd.'
      ];

      const pick = challenges[Math.floor(Math.random() * challenges.length)];
      const promptEl = document.getElementById('jamChallengePrompt');
      if (promptEl) promptEl.textContent = `🎯 Practice Prompt: ${pick}`;
    }

    exportJamProgressionTxt() {
      const Theory = window.SongTheory;
      if (!this.jamCards || this.jamCards.length === 0) return;

      const now = new Date();
      const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
      const chordSymbols = this.jamCards.map(c => c.symbol).join('  ->  ');
      const challengeEl = document.getElementById('jamChallengePrompt');
      const challengeText = challengeEl ? challengeEl.textContent.trim() : '';

      let text = `=======================================================\n`;
      text += `SONG ANALYZER - JAM DECK CHORD PROGRESSION\n`;
      text += `Exported: ${dateStr}\n`;
      text += `=======================================================\n\n`;
      text += `CHORD SEQUENCE:\n`;
      text += `${chordSymbols}\n\n`;
      text += `CHORD DETAILS & VOICINGS:\n`;

      this.jamCards.forEach((c, i) => {
        const parsed = Theory ? Theory.parseChord(c.symbol) : null;
        const notesStr = parsed && parsed.notes ? parsed.notes.join(' - ') : 'N/A';
        text += `  #${i + 1}. ${c.symbol.padEnd(10)} | ${c.qualityName}\n`;
        text += `      Formula: ${c.formula}\n`;
        text += `      Notes:   ${notesStr}\n\n`;
      });

      if (challengeText) {
        text += `PRACTICE PROMPT:\n`;
        text += `${challengeText}\n\n`;
      }

      text += `=======================================================\n`;
      text += `Created with Song Analyzer (https://songanalyzer.dredwerkz.cz)\n`;

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileDate = now.toISOString().slice(0, 10);
      a.download = `jam-progression-${fileDate}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    exportJamProgressionMidi() {
      const Theory = window.SongTheory;
      if (!Theory || !window.SongMidi || !this.jamCards || this.jamCards.length === 0) return;

      const bpm = this.getBpm();
      const parsedCards = this.jamCards.map(c => Theory.parseChord(c.symbol)).filter(Boolean);
      if (parsedCards.length === 0) return;

      const bytes = window.SongMidi.exportChordsToMidi(parsedCards, window.audio, {
        bpm,
        loops: 2,
        title: `Jam Deck (${parsedCards.length} Chords)`
      });
      const fileDate = new Date().toISOString().slice(0, 10);
      window.SongMidi.downloadMidiBlob(bytes, `jam-progression-${parsedCards.length}chords-${fileDate}.mid`);
    }

    sendJamToAnalyzer() {
      if (!this.jamCards || this.jamCards.length === 0) return;
      const progInput = document.getElementById('progressionInput');
      if (progInput) {
        progInput.value = this.jamCards.map(c => c.symbol).join(' ');
        this.analyzeProgression();
        if (window.innerWidth < 960 && typeof this.setMobileTab === 'function') {
          this.setMobileTab('analyzerSection');
        } else {
          const analyzerSec = document.getElementById('analyzerSection');
          if (analyzerSec) analyzerSec.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }

    // Oblique Strategies Non-Repeating Creative Deck Engine
    initObliquePrompts() {
      const btnDraw = document.getElementById('btnDrawOblique');
      const btnNext = document.getElementById('btnNextObliqueCard');
      const btnReshuffle = document.getElementById('btnReshuffleOblique');
      const btnClose = document.getElementById('btnCloseOblique');
      const cardDisplay = document.getElementById('obliqueCardDisplay');
      const cardText = document.getElementById('obliqueCardText');
      const cardNum = document.getElementById('obliqueCardNum');
      const cycleInfo = document.getElementById('obliqueCycleInfo');
      const badge = document.getElementById('obliqueDeckBadge');

      const deck = window.SongOblique ? window.SongOblique.deck : null;
      if (!deck) return;

      const updateBadge = () => {
        if (!badge) return;
        const stats = deck.getStats();
        badge.textContent = `Deck: ${stats.drawnCount} / ${stats.total} Drawn`;
        badge.title = `Cycle ${stats.cycle} • ${stats.remainingCount} cards remaining before auto-reshuffle`;
      };

      const showCard = (card) => {
        if (!card || !cardDisplay || !cardText) return;
        cardText.textContent = `“${card.text}”`;
        if (cardNum) cardNum.textContent = `#${card.drawnNumber} of ${card.totalCards}`;
        if (cycleInfo) cycleInfo.textContent = `Cycle ${card.cycle}`;
        cardDisplay.style.display = 'block';
        updateBadge();
      };

      if (btnDraw) {
        btnDraw.addEventListener('click', () => {
          const card = deck.drawCard();
          showCard(card);
        });
      }

      if (btnNext) {
        btnNext.addEventListener('click', () => {
          const card = deck.drawCard();
          showCard(card);
        });
      }

      if (btnReshuffle) {
        btnReshuffle.addEventListener('click', () => {
          deck.resetDeck();
          updateBadge();
          if (cardDisplay && cardDisplay.style.display !== 'none') {
            const card = deck.drawCard();
            showCard(card);
          }
        });
      }

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          if (cardDisplay) cardDisplay.style.display = 'none';
        });
      }

      updateBadge();
      const current = deck.getCurrentCard();
      if (current && cardDisplay && cardDisplay.style.display !== 'none') {
        showCard(current);
      }
    }

    // Chromatic Strobe & Needle Tuner Module
    initTunerModule() {
      const Tuner = window.SongTuner;
      if (!Tuner) return;

      const tuner = Tuner.tuner;
      const tunerCanvas = document.getElementById('tunerCanvas');
      const tunerSection = document.getElementById('tunerSection');
      const btnToggleTop = document.getElementById('btnToggleTunerTop');
      const btnPower = document.getElementById('btnToggleTunerPower');
      const btnClose = document.getElementById('btnCloseTuner');
      const presetSelect = document.getElementById('tunerPresetSelect');
      const stringsContainer = document.getElementById('tunerStringsContainer');
      const btnChromatic = document.getElementById('btnTunerChromaticMode');
      const noteText = document.getElementById('tunerNoteText');
      const statusText = document.getElementById('tunerStatusText');
      const freqText = document.getElementById('tunerFreqText');
      const liveBadge = document.getElementById('tunerLiveBadge');
      const vuFill = document.getElementById('tunerVuFill');
      const a4Input = document.getElementById('tunerA4Input');
      const btnResetA4 = document.getElementById('btnResetA4');
      const gainInput = document.getElementById('tunerGainInput');
      const gainVal = document.getElementById('tunerGainVal');
      const btnSyncFretboard = document.getElementById('btnSyncFretboardTuning');

      let renderer = null;
      let tunerResizeRafId = null;
      if (tunerCanvas && Tuner.TunerRenderer) {
        renderer = new Tuner.TunerRenderer(tunerCanvas);
        this.tunerRenderer = renderer;
        window.addEventListener('resize', () => {
          if (!renderer) return;
          if (tunerCanvas.offsetParent === null) {
            renderer._needsResize = true;
            return;
          }
          if (tunerResizeRafId) cancelAnimationFrame(tunerResizeRafId);
          tunerResizeRafId = requestAnimationFrame(() => {
            tunerResizeRafId = null;
            renderer.setupCanvas();
          });
        });
      }

      const updateStringButtons = () => {
        if (!stringsContainer) return;
        stringsContainer.innerHTML = '';
        const tuning = tuner.getCurrentTuning();
        if (!tuning || !Array.isArray(tuning.strings)) return;

        tuning.strings.forEach((strObj, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `btn-tuner-string ${tuner.selectedStringIndex === idx ? 'active' : ''}`;
          btn.textContent = strObj.note;
          btn.title = `String #${idx + 1}: ${strObj.note} (${strObj.freq.toFixed(1)} Hz). Click for reference pitch.`;

          btn.addEventListener('click', () => {
            tuner.playReferenceTone(strObj.freq);
            tuner.selectString(idx);
            updateStringButtons();
            if (btnChromatic) btnChromatic.classList.remove('active');
            setTimeout(() => {
              tuner.stopReferenceTone();
            }, 1400);
          });

          stringsContainer.appendChild(btn);
        });
      };

      // Handle live pitch & strobe updates
      tuner.onPitchUpdate = (state) => {
        if (renderer) {
          renderer.render(state);
        }

        const isRunning = state.isRunning;
        const hasPitch = state.detectedFrequency > 0;

        if (noteText) {
          if (hasPitch) {
            noteText.textContent = `${state.detectedNote}${state.detectedOctave}`;
            if (state.isInTune) {
              noteText.classList.add('in-tune');
            } else {
              noteText.classList.remove('in-tune');
            }
          } else {
            noteText.textContent = isRunning ? '...' : '--';
            noteText.classList.remove('in-tune');
          }
        }

        if (statusText) {
          if (!isRunning) {
            statusText.textContent = 'STANDBY';
            statusText.className = 'tuner-status-badge';
          } else if (!hasPitch) {
            statusText.textContent = 'LISTENING...';
            statusText.className = 'tuner-status-badge';
          } else if (state.isInTune) {
            statusText.textContent = 'IN TUNE';
            statusText.className = 'tuner-status-badge in-tune';
          } else if (state.cents < 0) {
            statusText.textContent = `FLAT (${state.cents}¢)`;
            statusText.className = 'tuner-status-badge flat';
          } else {
            statusText.textContent = `SHARP (+${state.cents}¢)`;
            statusText.className = 'tuner-status-badge sharp';
          }
        }

        if (freqText) {
          if (hasPitch) {
            freqText.textContent = `${state.detectedFrequency.toFixed(2)} Hz (Target: ${state.targetFrequency.toFixed(2)} Hz)`;
          } else {
            freqText.textContent = isRunning ? 'Pluck string... (Target: --)' : '0.00 Hz (Target: --)';
          }
        }

        if (vuFill) {
          const percent = Math.min(100, Math.round(state.rmsLevel * 700));
          vuFill.style.width = `${percent}%`;
        }

        if (liveBadge) {
          if (isRunning) {
            liveBadge.textContent = hasPitch ? `Pitch: ${state.detectedNote}${state.detectedOctave} (${state.cents > 0 ? '+' : ''}${state.cents}¢)` : 'Microphone: Active';
            liveBadge.style.borderColor = state.isInTune ? '#10b981' : (hasPitch ? '#38bdf8' : '#64748b');
          } else {
            liveBadge.textContent = 'Microphone: Off';
            liveBadge.style.borderColor = '';
          }
        }

        if (btnToggleTop) {
          if (isRunning) {
            if (state.isInTune) {
              btnToggleTop.textContent = `🎸 Tuner: ${state.detectedNote}${state.detectedOctave} (In Tune)`;
              btnToggleTop.classList.add('btn-success');
              btnToggleTop.classList.remove('btn-outline-cyan');
            } else if (hasPitch) {
              btnToggleTop.textContent = `🎸 Tuner: ${state.detectedNote}${state.detectedOctave} (${state.cents > 0 ? '+' : ''}${state.cents}¢)`;
              btnToggleTop.classList.remove('btn-success');
              btnToggleTop.classList.add('btn-outline-cyan');
            } else {
              btnToggleTop.textContent = '🎸 Tuner: On';
              btnToggleTop.classList.remove('btn-success');
              btnToggleTop.classList.add('btn-outline-cyan');
            }
          } else {
            btnToggleTop.textContent = '🎸 Tuner: Off';
            btnToggleTop.classList.remove('btn-success');
            btnToggleTop.classList.add('btn-outline-cyan');
          }
        }

        if (btnPower) {
          if (isRunning) {
            btnPower.textContent = '⏹ Stop Tuner';
            btnPower.className = 'btn btn-sm btn-danger';
          } else {
            btnPower.textContent = '⚡ Turn Tuner On';
            btnPower.className = 'btn btn-sm btn-success';
          }
        }

        if (tunerSection) {
          if (state.isInTune) {
            tunerSection.classList.add('in-tune-glow');
          } else {
            tunerSection.classList.remove('in-tune-glow');
          }
        }
      };

      const toggleTunerState = async () => {
        try {
          if (tuner.isRunning) {
            tuner.stop();
          } else {
            if (tunerSection) tunerSection.style.display = 'block';
            await tuner.start();
          }
        } catch (err) {
          alert('Microphone access is required for the instrument tuner. Please allow microphone permissions in your browser.');
        }
      };

      if (btnPower) {
        btnPower.addEventListener('click', () => {
          toggleTunerState();
        });
      }

      if (btnToggleTop) {
        btnToggleTop.addEventListener('click', () => {
          if (tunerSection) {
            const isHidden = tunerSection.style.display === 'none' || !tunerSection.style.display;
            if (isHidden) {
              tunerSection.style.display = 'block';
              tunerSection.scrollIntoView({ behavior: 'smooth' });
              if (!tuner.isRunning) {
                tuner.start().catch(() => {});
              }
            } else {
              if (tuner.isRunning) {
                tuner.stop();
              }
              tunerSection.style.display = 'none';
            }
          }
        });
      }

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          if (tuner.isRunning) tuner.stop();
          if (tunerSection) tunerSection.style.display = 'none';
        });
      }

      // Keyboard Shortcut: 'T' toggles tuner
      window.addEventListener('keydown', (e) => {
        if (e.key === 't' || e.key === 'T') {
          const target = e.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
          }
          e.preventDefault();
          if (btnToggleTop) btnToggleTop.click();
        }
      });

      if (presetSelect) {
        presetSelect.addEventListener('change', () => {
          const val = presetSelect.value;
          tuner.setTuning(val);
          updateStringButtons();
          if (btnChromatic) btnChromatic.classList.add('active');
          // Automatically sync with Canvas Fretboard
          const tuning = tuner.getCurrentTuning();
          if (this.visualizer && tuning) {
            this.visualizer.setCustomTuning(tuning);
          }
        });
      }

      if (btnChromatic) {
        btnChromatic.addEventListener('click', () => {
          tuner.selectString(null);
          btnChromatic.classList.add('active');
          document.querySelectorAll('.btn-tuner-string').forEach(b => b.classList.remove('active'));
        });
      }

      if (a4Input) {
        a4Input.addEventListener('change', () => {
          tuner.setA4(a4Input.value);
        });
      }

      if (btnResetA4) {
        btnResetA4.addEventListener('click', () => {
          if (a4Input) a4Input.value = '440';
          tuner.setA4(440);
        });
      }

      if (gainInput) {
        gainInput.addEventListener('input', () => {
          const val = gainInput.value;
          tuner.setInputGain(val);
          if (gainVal) gainVal.textContent = parseFloat(val).toFixed(2) + 'x';
        });
        tuner.setInputGain(gainInput.value);
        if (gainVal) gainVal.textContent = parseFloat(gainInput.value).toFixed(2) + 'x';
      }

      if (btnSyncFretboard) {
        btnSyncFretboard.addEventListener('click', () => {
          const tuning = tuner.getCurrentTuning();
          if (this.visualizer && tuning) {
            this.visualizer.setMode('fretboard');
            this.visualizer.setCustomTuning(tuning);
            const visSec = document.getElementById('visualizerSection');
            if (visSec) visSec.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }

      // Initialize initial string buttons and initial render
      updateStringButtons();
      if (renderer) {
        renderer.render(tuner.getState());
      }
    }

    // 0B. Rhythmic Accuracy Analyzer & "Pocket Meter"
    initAccuracyModule() {
      const Accuracy = window.SongAccuracy;
      if (!Accuracy) return;

      const engine = Accuracy.engine;
      const gaugeCanvas = document.getElementById('pocketMeterCanvas');
      const heatmapCanvas = document.getElementById('beatHeatmapCanvas');
      const accuracySection = document.getElementById('accuracySection');
      const btnToggleTop = document.getElementById('btnToggleAccuracyTop');
      const btnPower = document.getElementById('btnToggleAccuracyPower');
      const btnClose = document.getElementById('btnCloseAccuracy');
      const subdivSelect = document.getElementById('accuracySubdivSelect');
      const sensitivityInput = document.getElementById('accuracySensitivityInput');
      const sensitivityVal = document.getElementById('accuracySensitivityVal');
      const latencyInput = document.getElementById('accuracyLatencyInput');
      const latencyVal = document.getElementById('accuracyLatencyVal');
      const autoMetronomeCheckbox = document.getElementById('accuracyAutoMetronome');
      const deltaText = document.getElementById('pocketDeltaText');
      const statusBadge = document.getElementById('pocketStatusBadge');
      const beatText = document.getElementById('pocketBeatText');
      const liveBadge = document.getElementById('accuracyLiveBadge');
      const scorecardGroove = document.getElementById('scorecardGrooveVal');
      const scorecardConsistency = document.getElementById('scorecardConsistencyVal');
      const scorecardMeanDelta = document.getElementById('scorecardMeanDeltaVal');
      const scorecardHits = document.getElementById('scorecardHitsVal');
      const barPocket = document.getElementById('scorecardBarPocket');
      const barEarly = document.getElementById('scorecardBarEarly');
      const barLate = document.getElementById('scorecardBarLate');
      const btnReset = document.getElementById('btnResetAccuracyStats');
      const btnExport = document.getElementById('btnExportAccuracyReport');
      const btnMetroOpen = document.getElementById('btnMetroOpenPocket');

      let renderer = null;
      let pocketResizeRafId = null;
      if (gaugeCanvas && heatmapCanvas && Accuracy.PocketMeterRenderer) {
        renderer = new Accuracy.PocketMeterRenderer(gaugeCanvas, heatmapCanvas);
        this.accuracyRenderer = renderer;
        window.addEventListener('resize', () => {
          if (!renderer) return;
          const isGaugeVisible = gaugeCanvas && gaugeCanvas.offsetParent !== null;
          const isHeatmapVisible = heatmapCanvas && heatmapCanvas.offsetParent !== null;
          if (!isGaugeVisible && !isHeatmapVisible) {
            renderer._needsResize = true;
            return;
          }
          if (pocketResizeRafId) cancelAnimationFrame(pocketResizeRafId);
          pocketResizeRafId = requestAnimationFrame(() => {
            pocketResizeRafId = null;
            renderer.setupCanvases();
          });
        });
      }

      // On-demand animation loop for smooth needle motion when microphone is actively listening
      let animLoopId = null;
      let lastMeterRender = 0;
      const targetMeterInterval = 1000 / 30; // 30 FPS cap to preserve CPU & battery

      const startAnimLoop = () => {
        if (animLoopId) return;
        const runAnimLoop = (ts) => {
          if (!engine.isRunning) {
            animLoopId = null;
            if (renderer && accuracySection && accuracySection.style.display !== 'none') {
              renderer.render(engine);
            }
            return;
          }
          if (renderer && accuracySection && accuracySection.style.display !== 'none') {
            if (!ts || ts - lastMeterRender >= targetMeterInterval) {
              lastMeterRender = ts || performance.now();
              renderer.render(engine);
            }
          }
          animLoopId = requestAnimationFrame(runAnimLoop);
        };
        animLoopId = requestAnimationFrame(runAnimLoop);
      };

      const stopAnimLoop = () => {
        if (animLoopId) {
          cancelAnimationFrame(animLoopId);
          animLoopId = null;
        }
        if (renderer && accuracySection && accuracySection.style.display !== 'none') {
          renderer.render(engine);
        }
      };

      // Single initial static render
      if (renderer && accuracySection && accuracySection.style.display !== 'none') {
        renderer.render(engine);
      }

      // Engine state change callback
      engine.onStateChange = (running) => {
        if (running) {
          startAnimLoop();
          if (liveBadge) {
            liveBadge.textContent = 'Microphone: Active (Listening)';
            liveBadge.className = 'tempo-marking-badge in-pocket';
            liveBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            liveBadge.style.color = '#10b981';
            liveBadge.style.borderColor = '#10b981';
          }
          if (btnPower) {
            btnPower.textContent = '⏹ Stop Pocket Meter';
            btnPower.className = 'btn btn-sm btn-danger';
          }
          if (btnToggleTop) {
            btnToggleTop.textContent = '🎯 Pocket: On';
            btnToggleTop.classList.add('active');
            btnToggleTop.style.borderColor = 'var(--accent-emerald)';
            btnToggleTop.style.color = 'var(--accent-emerald)';
          }
          if (statusBadge && statusBadge.textContent === 'READY') {
            statusBadge.textContent = 'LISTENING...';
          }
        } else {
          stopAnimLoop();
          if (liveBadge) {
            liveBadge.textContent = 'Microphone: Off';
            liveBadge.className = 'tempo-marking-badge';
            liveBadge.style.background = '';
            liveBadge.style.color = '';
            liveBadge.style.borderColor = '';
          }
          if (btnPower) {
            btnPower.textContent = '⚡ Turn Pocket Meter On';
            btnPower.className = 'btn btn-sm btn-success';
          }
          if (btnToggleTop) {
            btnToggleTop.textContent = '🎯 Pocket: Off';
            btnToggleTop.classList.remove('active');
            btnToggleTop.style.borderColor = '';
            btnToggleTop.style.color = '';
          }
          if (accuracySection) {
            accuracySection.classList.remove('in-pocket-glow');
          }
        }
      };

      // Engine transient hit callback
      engine.onHit = (hit, stats) => {
        if (deltaText) {
          const sign = hit.deltaMs > 0 ? '+' : '';
          deltaText.textContent = `${sign}${hit.deltaMs.toFixed(1)} ms`;
          deltaText.className = `pocket-delta-primary ${hit.rating}`;
        }

        if (statusBadge) {
          if (hit.rating === 'pocket') {
            statusBadge.textContent = 'IN THE POCKET 🟢';
            statusBadge.className = 'pocket-status-badge pocket';
            if (accuracySection) accuracySection.classList.add('in-pocket-glow');
          } else if (hit.rating === 'early') {
            statusBadge.textContent = 'RUSHING (EARLY) 🔴';
            statusBadge.className = 'pocket-status-badge early';
            if (accuracySection) accuracySection.classList.remove('in-pocket-glow');
          } else {
            statusBadge.textContent = 'DRAGGING (LATE) 🔵';
            statusBadge.className = 'pocket-status-badge late';
            if (accuracySection) accuracySection.classList.remove('in-pocket-glow');
          }
        }

        if (beatText) {
          const ratingLabel = hit.rating === 'pocket' ? 'Locked In' : (hit.rating === 'early' ? 'Rush' : 'Drag');
          beatText.textContent = `Bar ${hit.bar}, Beat ${hit.beat} • ${ratingLabel}`;
        }

        // Update Scorecard
        if (scorecardGroove) {
          scorecardGroove.textContent = `${stats.grooveAccuracy}%`;
          scorecardGroove.className = `scorecard-metric-val ${stats.grooveAccuracy >= 80 ? 'score-high' : ''}`;
        }
        if (scorecardConsistency) {
          scorecardConsistency.textContent = `${stats.consistencyScore}%`;
        }
        if (scorecardMeanDelta) {
          const meanSign = stats.meanDeltaMs > 0 ? '+' : '';
          scorecardMeanDelta.textContent = `${meanSign}${stats.meanDeltaMs} ms`;
          scorecardMeanDelta.className = `scorecard-metric-val ${Math.abs(stats.meanDeltaMs) <= 6 ? 'score-pocket' : ''}`;
        }
        if (scorecardHits) {
          scorecardHits.textContent = stats.totalHits;
        }

        if (barPocket && barEarly && barLate && stats.totalHits > 0) {
          const pFrac = (stats.pocketCount / stats.totalHits) * 100;
          const eFrac = (stats.earlyCount / stats.totalHits) * 100;
          const lFrac = (stats.lateCount / stats.totalHits) * 100;
          barPocket.style.width = `${pFrac}%`;
          barEarly.style.width = `${eFrac}%`;
          barLate.style.width = `${lFrac}%`;
        }
      };

      // Toggle accuracy state helper
      const toggleAccuracyState = async () => {
        try {
          if (engine.isRunning) {
            engine.stop();
            if (this.metronomeAutoStartedByPocket) {
              const audio = window.audio;
              if (audio && audio.isMetronomeRunning) {
                const btnMetro = document.getElementById('btnToggleMetronome');
                if (btnMetro) btnMetro.click();
              }
              this.metronomeAutoStartedByPocket = false;
            }
          } else {
            if (accuracySection) {
              accuracySection.style.display = 'block';
              if (renderer) renderer.setupCanvases();
            }

            // Auto-start Metronome if enabled and no rhythm is currently active
            if (autoMetronomeCheckbox && autoMetronomeCheckbox.checked) {
              const audio = window.audio;
              const drums = window.drumMachine || (window.app && window.app.beatSequencer);
              const isMetroRunning = audio && audio.isMetronomeRunning;
              const isDrumsRunning = drums && drums.isPlaying;

              if (!isMetroRunning && !isDrumsRunning) {
                const btnMetro = document.getElementById('btnToggleMetronome');
                if (btnMetro) {
                  btnMetro.click();
                  this.metronomeAutoStartedByPocket = true;
                } else if (audio) {
                  await audio.init();
                  this.restartRunningMetronome();
                  this.metronomeAutoStartedByPocket = true;
                }
              }
            }

            await engine.start();
          }
        } catch (err) {
          console.error('Accuracy Engine start error:', err);
          alert('Microphone access is required for the Rhythmic Accuracy Analyzer. Please allow microphone permissions in your browser.');
        }
      };

      if (btnPower) {
        btnPower.addEventListener('click', () => {
          toggleAccuracyState();
        });
      }

      if (btnToggleTop) {
        btnToggleTop.addEventListener('click', () => {
          if (accuracySection) {
            const isHidden = accuracySection.style.display === 'none' || !accuracySection.style.display;
            if (isHidden) {
              accuracySection.style.display = 'block';
              accuracySection.scrollIntoView({ behavior: 'smooth' });
              if (renderer) renderer.setupCanvases();
              if (!engine.isRunning) {
                toggleAccuracyState();
              }
            } else {
              if (engine.isRunning) {
                engine.stop();
                if (this.metronomeAutoStartedByPocket) {
                  const audio = window.audio;
                  if (audio && audio.isMetronomeRunning) {
                    const btnMetro = document.getElementById('btnToggleMetronome');
                    if (btnMetro) btnMetro.click();
                  }
                  this.metronomeAutoStartedByPocket = false;
                }
              }
              accuracySection.style.display = 'none';
            }
          }
        });
      }

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          if (engine.isRunning) {
            engine.stop();
            if (this.metronomeAutoStartedByPocket) {
              const audio = window.audio;
              if (audio && audio.isMetronomeRunning) {
                const btnMetro = document.getElementById('btnToggleMetronome');
                if (btnMetro) btnMetro.click();
              }
              this.metronomeAutoStartedByPocket = false;
            }
          }
          if (accuracySection) accuracySection.style.display = 'none';
        });
      }

      // Shortcut button from Metronome / Rhythm Studio
      if (btnMetroOpen) {
        btnMetroOpen.addEventListener('click', () => {
          if (accuracySection) {
            accuracySection.style.display = 'block';
            accuracySection.scrollIntoView({ behavior: 'smooth' });
            if (renderer) renderer.setupCanvases();
            if (!engine.isRunning) {
              toggleAccuracyState();
            }
          }
        });
      }

      // Keyboard Shortcut: 'R' toggles Pocket Meter
      window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
          const target = e.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
          }
          e.preventDefault();
          if (btnToggleTop) btnToggleTop.click();
        }
      });

      // Controls
      if (subdivSelect) {
        subdivSelect.addEventListener('change', () => {
          engine.setSubdivision(subdivSelect.value);
        });
      }

      if (sensitivityInput) {
        sensitivityInput.addEventListener('input', () => {
          const val = sensitivityInput.value;
          engine.setSensitivity(val);
          if (sensitivityVal) sensitivityVal.textContent = parseFloat(val).toFixed(2);
        });
      }

      if (latencyInput) {
        latencyInput.addEventListener('input', () => {
          const val = latencyInput.value;
          engine.setLatencyOffset(val);
          if (latencyVal) {
            const num = parseInt(val, 10);
            latencyVal.textContent = `${num > 0 ? '+' : ''}${num} ms`;
          }
        });
      }

      if (btnReset) {
        btnReset.addEventListener('click', () => {
          engine.reset();
          if (deltaText) deltaText.textContent = '-- ms';
          if (statusBadge) {
            statusBadge.textContent = engine.isRunning ? 'LISTENING...' : 'READY';
            statusBadge.className = 'pocket-status-badge';
          }
          if (beatText) beatText.textContent = 'Waiting for transients...';
          if (scorecardGroove) scorecardGroove.textContent = '100%';
          if (scorecardConsistency) scorecardConsistency.textContent = '100%';
          if (scorecardMeanDelta) scorecardMeanDelta.textContent = '0.0 ms';
          if (scorecardHits) scorecardHits.textContent = '0';
          if (barPocket) barPocket.style.width = '100%';
          if (barEarly) barEarly.style.width = '0%';
          if (barLate) barLate.style.width = '0%';
          if (accuracySection) accuracySection.classList.remove('in-pocket-glow');
        });
      }

      if (btnExport) {
        btnExport.addEventListener('click', () => {
          engine.exportAccuracyReportTxt();
        });
      }

      // Initial canvas setup
      if (renderer) {
        renderer.render(engine);
      }
    }

    // 0B. Multi-Notation Movable Chord Studio (Bass 4/5/6 & Guitar 6/7/8)
    initMovableChordsModule() {
      const Chords = window.SongChords;
      if (!Chords) return;

      const engine = Chords.Engine;
      const section = document.getElementById('movableChordSection');
      const btnToggleTop = document.getElementById('btnToggleChordsTop');
      const btnClose = document.getElementById('btnCloseChords');
      const liveBadge = document.getElementById('chordLiveBadge');

      const instSelect = document.getElementById('chordInstrumentSelect');
      const tuningSelect = document.getElementById('chordTuningSelect');
      const rootSelect = document.getElementById('chordRootSelect');
      const qualitySelect = document.getElementById('chordQualitySelect');
      const styleSelect = document.getElementById('chordStyleSelect');

      const shapesList = document.getElementById('chordShapesList');
      const svgContainer = document.getElementById('chordSvgContainer');
      const tabContainer = document.getElementById('chordTabContainer');
      const staffCanvas = document.getElementById('chordStaffCanvas');
      const staffClefLabel = document.getElementById('staffClefLabel');

      const btnBadgeInterval = document.getElementById('btnBadgeInterval');
      const btnBadgeFinger = document.getElementById('btnBadgeFinger');

      const fretSlider = document.getElementById('chordFretSlider');
      const fretBadge = document.getElementById('chordFretValueBadge');

      const btnStrumDown = document.getElementById('btnStrumDown');
      const btnStrumUp = document.getElementById('btnStrumUp');
      const btnSendToFretboard = document.getElementById('btnSendToFretboard');
      const btnDownloadSvg = document.getElementById('btnDownloadSvg');
      const btnCopyTabAscii = document.getElementById('btnCopyTabAscii');

      let currentInst = 'guitar_6str';
      let currentTuningKey = 'guitar_6str_std';
      let currentRootPC = 2; // D
      let currentQuality = 'min9';
      let currentStyle = 'all';
      let badgeMode = 'interval'; // 'interval' (default) or 'finger'
      let matchingShapes = [];
      let selectedShapeIndex = 0;
      let targetFretOverride = null;
      let currentVoicing = null;

      // Populate Tuning Dropdown according to selected Instrument
      const populateTunings = (instKey) => {
        if (!tuningSelect) return;
        tuningSelect.innerHTML = '';
        const allTunings = Object.values(Chords.TUNINGS).filter(t => t.instrument === instKey);
        allTunings.forEach((t, idx) => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          if (idx === 0) opt.selected = true;
          tuningSelect.appendChild(opt);
        });
        currentTuningKey = tuningSelect.value || 'guitar_6str_std';
      };

      // Recompute and Render
      const renderCurrentChord = () => {
        matchingShapes = engine.findShapes(currentTuningKey, currentQuality, currentStyle);
        if (matchingShapes.length === 0) {
          // Fallback: try finding any shape for this quality in this instrument
          matchingShapes = engine.findShapes(currentTuningKey, 'all', 'all');
        }

        // Render Shape Pills
        if (shapesList) {
          shapesList.innerHTML = '';
          if (matchingShapes.length === 0) {
            shapesList.innerHTML = '<span style="color: #94a3b8; font-size: 0.78rem; font-style: italic;">No movable shapes found for this filter.</span>';
          } else {
            matchingShapes.forEach((shape, idx) => {
              const pill = document.createElement('button');
              pill.type = 'button';
              pill.className = `shape-pill ${idx === selectedShapeIndex ? 'active' : ''}`;
              pill.textContent = shape.name;
              pill.addEventListener('click', () => {
                selectedShapeIndex = idx;
                targetFretOverride = null;
                renderCurrentChord();
                if (window.SongState) window.SongState.requestSave();
              });
              shapesList.appendChild(pill);
            });
          }
        }

        const activeShape = matchingShapes[selectedShapeIndex] || matchingShapes[0];
        if (!activeShape) return;

        currentVoicing = engine.computeVoicing(activeShape, currentRootPC, currentTuningKey, targetFretOverride);
        if (!currentVoicing) return;

        // 1. Render Vector SVG
        if (svgContainer) {
          svgContainer.innerHTML = Chords.SvgRenderer.render(currentVoicing, { badgeMode });
        }

        // 2. Render Formatted TAB
        if (tabContainer) {
          tabContainer.innerHTML = Chords.TabRenderer.generateHtml(currentVoicing);
        }

        // 3. Render Musical Staff Canvas
        if (staffCanvas) {
          Chords.StaffRenderer.renderToCanvas(staffCanvas, currentVoicing);
        }

        // 4. Update Labels & Slider
        if (staffClefLabel) {
          staffClefLabel.textContent = currentVoicing.clef === 'bass' ? 'Bass F8' : 'Treble G8';
        }

        const Theory = window.SongTheory;
        const rootNoteName = Theory ? Theory.pitchClassToNote(currentRootPC) : 'D';
        if (fretBadge) {
          fretBadge.textContent = `Root: Fret ${currentVoicing.rootFret} (${rootNoteName})`;
        }

        if (fretSlider && targetFretOverride === null) {
          fretSlider.value = currentVoicing.rootFret;
        }

        if (liveBadge) {
          const tuning = Chords.TUNINGS[currentTuningKey];
          liveBadge.textContent = `${tuning ? tuning.name.split(' (')[0] : 'Guitar'} • ${rootNoteName} ${currentQuality}`;
        }
      };

      this.chordStudioRenderer = renderCurrentChord;

      this.chordStudio = {
        getState: () => ({
          instrument: currentInst,
          tuning: currentTuningKey,
          rootPC: currentRootPC,
          quality: currentQuality,
          style: currentStyle,
          badgeMode: badgeMode,
          selectedShapeIndex: selectedShapeIndex,
          fretOverride: targetFretOverride
        }),
        setState: (st) => {
          if (!st) return;
          if (st.instrument && instSelect) {
            instSelect.value = st.instrument;
            currentInst = st.instrument;
            populateTunings(currentInst);
          }
          if (st.tuning && tuningSelect) {
            tuningSelect.value = st.tuning;
            currentTuningKey = st.tuning;
          }
          if (st.rootPC !== undefined && rootSelect) {
            rootSelect.value = String(st.rootPC);
            currentRootPC = parseInt(st.rootPC, 10);
          }
          if (st.quality && qualitySelect) {
            qualitySelect.value = st.quality;
            currentQuality = st.quality;
          }
          if (st.style && styleSelect) {
            styleSelect.value = st.style;
            currentStyle = st.style;
          }
          if (st.badgeMode) {
            badgeMode = st.badgeMode;
            if (btnBadgeInterval && btnBadgeFinger) {
              btnBadgeInterval.classList.toggle('active', badgeMode === 'interval');
              btnBadgeFinger.classList.toggle('active', badgeMode === 'finger');
            }
          }
          if (typeof st.selectedShapeIndex === 'number') {
            selectedShapeIndex = st.selectedShapeIndex;
          }
          if (typeof st.fretOverride === 'number') {
            targetFretOverride = st.fretOverride;
            if (fretSlider) fretSlider.value = targetFretOverride;
          } else {
            targetFretOverride = null;
          }
          renderCurrentChord();
        }
      };

      // Event Listeners
      if (instSelect) {
        instSelect.addEventListener('change', () => {
          currentInst = instSelect.value;
          populateTunings(currentInst);
          selectedShapeIndex = 0;
          targetFretOverride = null;
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (tuningSelect) {
        tuningSelect.addEventListener('change', () => {
          currentTuningKey = tuningSelect.value;
          targetFretOverride = null;
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (rootSelect) {
        rootSelect.addEventListener('change', () => {
          currentRootPC = parseInt(rootSelect.value, 10);
          targetFretOverride = null;
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (qualitySelect) {
        qualitySelect.addEventListener('change', () => {
          currentQuality = qualitySelect.value;
          selectedShapeIndex = 0;
          targetFretOverride = null;
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (styleSelect) {
        styleSelect.addEventListener('change', () => {
          currentStyle = styleSelect.value;
          selectedShapeIndex = 0;
          targetFretOverride = null;
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (btnBadgeInterval && btnBadgeFinger) {
        btnBadgeInterval.addEventListener('click', () => {
          badgeMode = 'interval';
          btnBadgeInterval.classList.add('active');
          btnBadgeFinger.classList.remove('active');
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
        btnBadgeFinger.addEventListener('click', () => {
          badgeMode = 'finger';
          btnBadgeFinger.classList.add('active');
          btnBadgeInterval.classList.remove('active');
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      if (fretSlider) {
        fretSlider.addEventListener('input', () => {
          targetFretOverride = parseInt(fretSlider.value, 10);
          renderCurrentChord();
          if (window.SongState) window.SongState.requestSave();
        });
      }

      // Audio Strum Actions
      if (btnStrumDown) {
        btnStrumDown.addEventListener('click', async () => {
          if (!currentVoicing) return;
          const midiNotes = currentVoicing.strings
            .filter(s => !s.isMuted && s.midi !== null)
            .map(s => s.midi);
          if (window.audio) {
            await window.audio.strumMovableVoicing(midiNotes, 'down');
          }
        });
      }

      if (btnStrumUp) {
        btnStrumUp.addEventListener('click', async () => {
          if (!currentVoicing) return;
          const midiNotes = currentVoicing.strings
            .filter(s => !s.isMuted && s.midi !== null)
            .map(s => s.midi);
          if (window.audio) {
            await window.audio.strumMovableVoicing(midiNotes, 'up');
          }
        });
      }

      // Sync with Canvas Fretboard in Visualizer
      if (btnSendToFretboard) {
        btnSendToFretboard.addEventListener('click', () => {
          if (!currentVoicing || !this.visualizer) return;
          const tuning = Chords.TUNINGS[currentTuningKey];
          if (tuning) {
            this.visualizer.setCustomTuning(tuning);
          }
          // Highlight chord notes
          const pcs = currentVoicing.strings
            .filter(s => !s.isMuted && s.pc !== null)
            .map(s => s.pc);
          if (this.visualizer.setActiveChordPCs) {
            this.visualizer.setActiveChordPCs(pcs);
          }
          // Switch to visualizer view
          this.setMobileTab('visualizerSection');
        });
      }

      // Download Vector SVG
      if (btnDownloadSvg) {
        btnDownloadSvg.addEventListener('click', () => {
          if (!currentVoicing) return;
          const svgMarkup = Chords.SvgRenderer.render(currentVoicing, { badgeMode });
          const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const Theory = window.SongTheory;
          const rootName = Theory ? Theory.pitchClassToNote(currentRootPC) : 'Chord';
          a.href = url;
          a.download = `${rootName}_${currentQuality}_movable_fret${currentVoicing.rootFret}.svg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }

      // Copy Plain-Text TAB to Clipboard
      if (btnCopyTabAscii) {
        btnCopyTabAscii.addEventListener('click', async () => {
          if (!currentVoicing) return;
          const ascii = Chords.TabRenderer.generateAscii(currentVoicing);
          try {
            await navigator.clipboard.writeText(ascii);
            const orig = btnCopyTabAscii.textContent;
            btnCopyTabAscii.textContent = '✓ Copied!';
            setTimeout(() => { btnCopyTabAscii.textContent = orig; }, 1800);
          } catch (e) {}
        });
      }

      // Panel Toggle & Close
      const togglePanel = () => {
        if (!section) return;
        const isHidden = (section.style.display === 'none' || getComputedStyle(section).display === 'none');
        section.style.display = isHidden ? 'block' : 'none';
        if (btnToggleTop) {
          btnToggleTop.textContent = isHidden ? '🎸 Chords: On' : '🎸 Chords: Off';
          if (isHidden) {
            btnToggleTop.classList.add('btn-success');
            btnToggleTop.classList.remove('btn-outline-cyan');
          } else {
            btnToggleTop.classList.remove('btn-success');
            btnToggleTop.classList.add('btn-outline-cyan');
          }
        }
        if (isHidden) {
          renderCurrentChord();
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      if (btnToggleTop) {
        btnToggleTop.addEventListener('click', togglePanel);
      }

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          if (section) section.style.display = 'none';
          if (btnToggleTop) {
            btnToggleTop.textContent = '🎸 Chords: Off';
            btnToggleTop.classList.remove('btn-success');
            btnToggleTop.classList.add('btn-outline-cyan');
          }
        });
      }

      // Keyboard Shortcut 'C' toggles Chord Studio
      window.addEventListener('keydown', (e) => {
        if (e.key === 'c' || e.key === 'C') {
          const target = e.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
          }
          e.preventDefault();
          if (btnToggleTop) btnToggleTop.click();
        }
      });

      // Initial population and render
      populateTunings(currentInst);
      renderCurrentChord();
    }

    // 0D. AI Neural Stem Separator (HTDemucs)
    initTranscriberModule() {
      const Transcriber = window.SongTranscriber;
      if (!Transcriber) return;

      const engine = Transcriber.engine || new Transcriber.AudioTranscriberEngine();
      this.transcriberEngine = engine;
      this.populateTranscriberTunings = () => {};
      this.transcriberStaffCanvasRenderer = () => {};

      const section = document.getElementById('transcriberSection');
      const btnToggleTop = document.getElementById('btnToggleTranscriberTop');
      const btnClose = document.getElementById('btnCloseTranscriber');
      const liveBadge = document.getElementById('transcriberLiveBadge');
      const engineBadge = document.getElementById('transcriberEngineBadge');

      if (engineBadge && engine.getCapabilities) {
        engine.getCapabilities().then(caps => {
          engineBadge.textContent = caps.badgeText;
          engineBadge.className = `engine-mode-badge ${caps.badgeClass}`;
          engineBadge.title = caps.badgeTooltip;
        }).catch(err => {
          console.warn('Device capability check failed:', err);
        });
      }

      const dropZone = document.getElementById('transcriberDropZone');
      const btnBrowse = document.getElementById('btnBrowseAudioFile');
      const fileInput = document.getElementById('transcriberAudioFileInput');
      const btnRecordMic = document.getElementById('btnRecordMicLive');
      const btnLoadDemo = document.getElementById('btnLoadSampleDemo');

      const trackInfoBar = document.getElementById('transcriberTrackInfoBar');
      const filenameEl = document.getElementById('transcriberFilename');
      const durationEl = document.getElementById('transcriberDuration');
      const bpmBadgeEl = document.getElementById('transcriberBpmBadge');
      const btnReanalyze = document.getElementById('btnReanalyzeStems');
      const btnQuickSeparateDrums = document.getElementById('btnQuickSeparateDrums');
      const btnRunAllSequential = document.getElementById('btnRunAllSequential');


      const progressCard = document.getElementById('transcriberProgressCard');
      const progressText = document.getElementById('transcriberProgressText');
      const progressPercent = document.getElementById('transcriberProgressPercent');
      const progressFill = document.getElementById('transcriberProgressBarFill');

      // Stems Deck & Audio Player DOM Elements
      const stemsDeck = document.getElementById('transcriberStemsDeck');
      const btnDownloadAllStemsMaster = document.getElementById('btnDownloadAllStemsMaster');
      const audioPreviewElements = {
        drums: document.getElementById('audioPreview_drums'),
        bass: document.getElementById('audioPreview_bass'),
        other: document.getElementById('audioPreview_other'),
        vocals: document.getElementById('audioPreview_vocals')
      };
      const stemDownloadBtns = document.querySelectorAll('.btn-download-stem');

      // Neural AI Model Manager DOM Elements
      const btnOpenModelManager = document.getElementById('btnOpenModelManager');
      const modalNeuralModels = document.getElementById('modalNeuralModels');
      const btnCloseNeuralModal = document.getElementById('btnCloseNeuralModal');

      const badgeBasicPitchStatus = document.getElementById('badgeBasicPitchStatus');
      const btnInstallBasicPitch = document.getElementById('btnInstallBasicPitch');

      const badgeDemucsStatus = document.getElementById('badgeDemucsStatus');
      const badgeDemucsTier = document.getElementById('badgeDemucsTier');
      const descDemucs = document.getElementById('descDemucs');
      const btnInstallDemucs = document.getElementById('btnInstallDemucs');

      const badgeUmxStatus = document.getElementById('badgeUmxStatus');
      const badgeUmxTier = document.getElementById('badgeUmxTier');
      const descUmx = document.getElementById('descUmx');
      const btnInstallUmxDrums = document.getElementById('btnInstallUmxDrums');
      const btnInstallUmxBass = document.getElementById('btnInstallUmxBass');
      const btnInstallUmxOther = document.getElementById('btnInstallUmxOther');
      const btnInstallUmxVocals = document.getElementById('btnInstallUmxVocals');

      const btnBrowseLocalModel = document.getElementById('btnBrowseLocalModel');
      const inputLocalModelFile = document.getElementById('inputLocalModelFile');

      const neuralDownloadProgressBox = document.getElementById('neuralDownloadProgressBox');
      const neuralDownloadStatusText = document.getElementById('neuralDownloadStatusText');
      const neuralDownloadPercentText = document.getElementById('neuralDownloadPercentText');
      const neuralDownloadProgressFill = document.getElementById('neuralDownloadProgressFill');

      const neuralCacheSummaryText = document.getElementById('neuralCacheSummaryText');
      const btnClearNeuralCache = document.getElementById('btnClearNeuralCache');

      let currentAudioBuffer = null;
      let currentBpm = 113;
      let currentStems = null;
      let stemObjectUrls = {};
      let isRecording = false;
      let mediaRecorder = null;
      let recordInterval = null;
      let recordStartTime = 0;

      const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 KB';
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      const revokeStemUrls = () => {
        Object.values(stemObjectUrls).forEach(url => {
          try { URL.revokeObjectURL(url); } catch (e) {}
        });
        stemObjectUrls = {};
      };

      const updateModelManagerUI = async () => {
        const summary = await engine.storage.getSummary();

        if (badgeBasicPitchStatus && btnInstallBasicPitch) {
          if (summary.basicPitch) {
            badgeBasicPitchStatus.textContent = 'Cached (226 KB)';
            badgeBasicPitchStatus.className = 'model-status-pill pill-success';
            btnInstallBasicPitch.textContent = '✓ Installed';
            btnInstallBasicPitch.disabled = true;
            btnInstallBasicPitch.className = 'btn btn-sm btn-outline-secondary';
          } else {
            badgeBasicPitchStatus.textContent = 'Not Cached';
            badgeBasicPitchStatus.className = 'model-status-pill pill-warning';
            btnInstallBasicPitch.textContent = '⬇ Download & Cache (226 KB)';
            btnInstallBasicPitch.disabled = false;
            btnInstallBasicPitch.className = 'btn btn-sm btn-primary';
          }
        }

        const caps = engine.getCapabilities ? await engine.getCapabilities() : null;
        const isMobile = Boolean(caps && caps.engineMode === 'mobile_optimized');

        if (badgeDemucsTier) {
          if (isMobile) {
            badgeDemucsTier.textContent = '💻 Desktop Only';
            badgeDemucsTier.className = 'model-status-pill pill-secondary';
          } else {
            badgeDemucsTier.textContent = '💻 Desktop Tier';
            badgeDemucsTier.className = 'model-status-pill pill-tier-desktop';
          }
        }

        if (badgeDemucsStatus && btnInstallDemucs) {
          if (summary.demucs) {
            badgeDemucsStatus.textContent = 'Cached (158 MB)';
            badgeDemucsStatus.className = 'model-status-pill pill-success';
            btnInstallDemucs.textContent = '✓ Installed';
            btnInstallDemucs.disabled = true;
            btnInstallDemucs.className = 'btn btn-sm btn-outline-secondary';
          } else if (isMobile) {
            badgeDemucsStatus.textContent = 'Desktop Only';
            badgeDemucsStatus.className = 'model-status-pill pill-secondary';
            btnInstallDemucs.textContent = '💻 Desktop Only (158 MB)';
            btnInstallDemucs.disabled = true;
            btnInstallDemucs.className = 'btn btn-sm btn-outline-secondary';
            btnInstallDemucs.title = 'The 158 MB Demucs model requires desktop RAM and is disabled on mobile to prevent browser tab crashes.';
            if (descDemucs) {
              descDemucs.innerHTML = '<strong>Desktop Studio Engine:</strong> Requires desktop RAM. On mobile devices, use the lightweight <strong>OpenUnmix</strong> models below to prevent memory exhaustion.';
            }
          } else {
            badgeDemucsStatus.textContent = 'Not Cached';
            badgeDemucsStatus.className = 'model-status-pill pill-warning';
            btnInstallDemucs.textContent = '⬇ Download (158 MB)';
            btnInstallDemucs.disabled = false;
            btnInstallDemucs.className = 'btn btn-sm btn-outline-cyan';
            if (descDemucs) {
              descDemucs.textContent = 'Meta AI convolutional transformer model for multi-stem audio isolation (Drums, Bass, Other, Vocals). Hosted on songanalyzer.dredwerkz.cz.';
            }
          }
        }

        if (badgeUmxTier) {
          if (isMobile) {
            badgeUmxTier.textContent = '📱 Mobile Recommended';
            badgeUmxTier.className = 'model-status-pill pill-tier-mobile';
          } else {
            badgeUmxTier.textContent = '📱 Mobile Tier';
            badgeUmxTier.className = 'model-status-pill pill-tier-mobile';
          }
        }

        if (badgeUmxStatus) {
          const cachedCount = [summary.umxDrums, summary.umxBass, summary.umxOther, summary.umxVocals].filter(Boolean).length;
          if (cachedCount === 4) {
            badgeUmxStatus.textContent = 'All 4 Stems Cached';
            badgeUmxStatus.className = 'model-status-pill pill-success';
          } else if (cachedCount > 0) {
            badgeUmxStatus.textContent = `Cached (${cachedCount}/4 stems)`;
            badgeUmxStatus.className = 'model-status-pill pill-success';
          } else {
            badgeUmxStatus.textContent = 'Not Cached';
            badgeUmxStatus.className = 'model-status-pill pill-warning';
          }
        }

        const umxStemsConfig = [
          { key: 'drums', btn: btnInstallUmxDrums, cached: summary.umxDrums, label: '🥁 Drums' },
          { key: 'bass', btn: btnInstallUmxBass, cached: summary.umxBass, label: '🎸 Bass' },
          { key: 'other', btn: btnInstallUmxOther, cached: summary.umxOther, label: '🎹 Other' },
          { key: 'vocals', btn: btnInstallUmxVocals, cached: summary.umxVocals, label: '🎤 Vocals' }
        ];

        umxStemsConfig.forEach(item => {
          if (item.btn) {
            if (item.cached) {
              item.btn.textContent = `✓ ${item.label.split(' ')[1]} Cached`;
              item.btn.disabled = true;
              item.btn.className = 'btn btn-sm btn-outline-secondary';
            } else {
              item.btn.textContent = `⬇ ${item.label} (34 MB)`;
              item.btn.disabled = false;
              item.btn.className = 'btn btn-sm btn-outline-cyan';
            }
          }
        });

        if (neuralCacheSummaryText) {
          neuralCacheSummaryText.textContent = `Storage: ${formatBytes(summary.totalBytes)} cached (${summary.count} model${summary.count === 1 ? '' : 's'})`;
        }
      };

      // Progress reporting helper
      const setProgress = (fraction, statusMsg) => {
        if (!progressCard) return;
        const pct = Math.min(100, Math.max(0, Math.round(fraction * 100)));
        if (progressFill) progressFill.style.width = `${pct}%`;
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressText) progressText.textContent = statusMsg;
        progressCard.style.display = (pct >= 100) ? 'none' : 'block';
      };

      // Convert AudioBuffer to 16-bit PCM stereo WAV ArrayBuffer
      const audioBufferToWav = (audioBuf) => {
        const numChannels = audioBuf.numberOfChannels;
        const sampleRate = audioBuf.sampleRate;
        const numSamples = audioBuf.length;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeString = (offset, str) => {
          for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
          }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // 16 bits per sample
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        const channels = [];
        for (let c = 0; c < numChannels; c++) {
          channels.push(audioBuf.getChannelData(c));
        }

        let offset = 44;
        for (let i = 0; i < numSamples; i++) {
          for (let ch = 0; ch < numChannels; ch++) {
            const s = Math.max(-1, Math.min(1, channels[ch][i]));
            const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
            view.setInt16(offset, val, true);
            offset += 2;
          }
        }
        return buffer;
      };

      const downloadAudioBufferAsWav = (audioBuf, filename = 'stem.wav') => {
        if (!audioBuf) return;
        const wavData = audioBufferToWav(audioBuf);
        const blob = new Blob([wavData], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      };

      // Isolate a Single Target Stem (Ultra Low-RAM Footprint for Mobile)
      const isolateSingleStem = async (stemName) => {
        if (!currentAudioBuffer) {
          alert('Please load an audio file first.');
          return;
        }

        const caps = engine.getCapabilities ? await engine.getCapabilities() : null;
        const isMobile = Boolean(caps && caps.engineMode === 'mobile_optimized');

        if (!isMobile) {
          setProgress(0.04, 'Checking Studio HTDemucs engine readiness...');
          const isDemucsReady = await engine.demucsRunner.isReady();
          if (!isDemucsReady) {
            setProgress(1.0, 'HTDemucs model required');
            if (confirm("Neural stem separation on Desktop requires the Meta AI HTDemucs model (158 MB).\n\nWould you like to select your local 'models/htdemucs.onnx' file now to cache it for offline stem separation?")) {
              if (inputLocalModelFile) {
                inputLocalModelFile.value = '';
                inputLocalModelFile.click();
              }
            } else if (modalNeuralModels) {
              modalNeuralModels.style.display = 'flex';
            }
            return;
          }
        }

        const stemBtn = document.getElementById(`btnIsolate_${stemName}`);
        const statusPill = document.getElementById(`stemStatus_${stemName}`);
        const playerWrap = document.getElementById(`playerWrap_${stemName}`);
        const downloadBtn = document.getElementById(`btnDownload_${stemName}`);
        const audioEl = audioPreviewElements[stemName];

        const allActionBtns = document.querySelectorAll('.btn-isolate-stem, #btnQuickSeparateDrums, #btnRunAllSequential, #btnReanalyzeStems');
        allActionBtns.forEach(b => { if (b) b.disabled = true; });

        if (statusPill) {
          statusPill.textContent = 'Isolating...';
          statusPill.className = 'stem-status-pill pill-processing';
        }

        try {
          if (!currentStems) currentStems = {};

          const res = await engine.separateSingleStem(currentAudioBuffer, stemName, (p, msg) => {
            setProgress(p, msg);
            if (stemBtn) {
              stemBtn.textContent = `⏳ Isolating ${stemName} (${Math.round(p * 100)}%)...`;
            }
          });

          currentStems[stemName] = res.buffer;

          // Free previous object URL for this stem if any
          if (stemObjectUrls[stemName]) {
            try { URL.revokeObjectURL(stemObjectUrls[stemName]); } catch (e) {}
            delete stemObjectUrls[stemName];
          }

          // Generate WAV blob ONLY for this isolated stem
          setProgress(0.97, `Encoding ${stemName} audio player preview...`);
          await new Promise(r => setTimeout(r, 20));
          const wavData = audioBufferToWav(res.buffer);
          const blob = new Blob([wavData], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          stemObjectUrls[stemName] = url;

          if (audioEl) {
            audioEl.src = url;
            audioEl.load();
          }
          if (playerWrap) playerWrap.style.display = 'block';
          if (downloadBtn) downloadBtn.style.display = 'inline-block';

          if (statusPill) {
            statusPill.textContent = '✅ Ready';
            statusPill.className = 'stem-status-pill pill-success';
          }
          if (stemBtn) {
            stemBtn.textContent = `🔄 Re-separate ${stemName}`;
            stemBtn.className = 'btn btn-sm btn-outline-secondary btn-isolate-stem';
          }

          const readyCount = Object.keys(currentStems).length;
          if (liveBadge) {
            liveBadge.textContent = `🧠 ${readyCount}/4 Stems Ready`;
            liveBadge.className = 'badge badge-gold';
          }

          setProgress(1.0, `✅ ${res.displayName || stemName} isolated successfully!`);
          return res;
        } catch (err) {
          console.error(`Neural isolation failed for ${stemName}:`, err);
          const errDetail = (err && (err.message || err.toString())) || 'Unknown error';
          if (statusPill) {
            statusPill.textContent = 'Failed';
            statusPill.className = 'stem-status-pill pill-error';
          }
          if (stemBtn) {
            stemBtn.textContent = `⚡ Retry ${stemName}`;
            stemBtn.className = 'btn btn-sm btn-outline-danger btn-isolate-stem';
          }
          setProgress(1.0, `Separation failed: ${errDetail}`);
          alert(`Neural stem isolation failed for ${stemName}: ${errDetail}`);
        } finally {
          allActionBtns.forEach(b => { if (b) b.disabled = false; });
        }
      };

      // Run all stems sequentially with memory cooldowns
      const runAllSequentially = async () => {
        if (!currentAudioBuffer) {
          alert('Please load an audio file first.');
          return;
        }
        const stems = ['drums', 'bass', 'other', 'vocals'];
        for (let i = 0; i < stems.length; i++) {
          const s = stems[i];
          await isolateSingleStem(s);
          // 150ms cooldown pause for browser GC
          await new Promise(r => setTimeout(r, 150));
        }
      };

      // Process Decoded AudioBuffer (Prepares track for single-target separation)
      const processBuffer = async (audioBuffer, filename = 'audio_track.mp3') => {
        if (!audioBuffer) return;
        currentAudioBuffer = audioBuffer;
        currentStems = {};
        revokeStemUrls();

        if (filenameEl) filenameEl.textContent = filename;

        const durSec = Math.round(audioBuffer.duration);
        const mins = Math.floor(durSec / 60);
        const secs = String(durSec % 60).padStart(2, '0');
        if (durationEl) durationEl.textContent = `${mins}:${secs}`;

        setProgress(0.05, 'Detecting song tempo (BPM)...');
        await new Promise(r => setTimeout(r, 20));

        const tempoResult = engine.detectBpmAndBeats(audioBuffer);
        currentBpm = tempoResult.bpm || 113;
        if (bpmBadgeEl) bpmBadgeEl.textContent = `${currentBpm} BPM`;

        // Reset stem cards UI state
        ['drums', 'bass', 'other', 'vocals'].forEach(stemName => {
          const statusPill = document.getElementById(`stemStatus_${stemName}`);
          const stemBtn = document.getElementById(`btnIsolate_${stemName}`);
          const playerWrap = document.getElementById(`playerWrap_${stemName}`);
          const downloadBtn = document.getElementById(`btnDownload_${stemName}`);
          const audioEl = audioPreviewElements[stemName];

          if (statusPill) {
            if (stemName === 'drums') {
              statusPill.textContent = 'Ready (Step 1)';
              statusPill.className = 'stem-status-pill pill-warning';
            } else {
              statusPill.textContent = 'Pending';
              statusPill.className = 'stem-status-pill';
            }
          }
          if (stemBtn) {
            stemBtn.disabled = false;
            if (stemName === 'drums') {
              stemBtn.textContent = '🥁 Separate Drums Stem';
              stemBtn.className = 'btn btn-sm btn-primary btn-isolate-stem';
            } else if (stemName === 'bass') {
              stemBtn.textContent = '🎸 Separate Bass Stem';
              stemBtn.className = 'btn btn-sm btn-outline-cyan btn-isolate-stem';
            } else if (stemName === 'other') {
              stemBtn.textContent = '🎹 Separate Other / Guitar Stem';
              stemBtn.className = 'btn btn-sm btn-outline-cyan btn-isolate-stem';
            } else if (stemName === 'vocals') {
              stemBtn.textContent = '🎤 Separate Vocals Stem';
              stemBtn.className = 'btn btn-sm btn-outline-cyan btn-isolate-stem';
            }
          }
          if (playerWrap) playerWrap.style.display = 'none';
          if (downloadBtn) downloadBtn.style.display = 'none';
          if (audioEl) audioEl.src = '';
        });

        if (trackInfoBar) trackInfoBar.style.display = 'flex';
        if (stemsDeck) stemsDeck.style.display = 'block';

        if (liveBadge) {
          liveBadge.textContent = '🎵 Audio Loaded';
          liveBadge.className = 'badge badge-primary';
        }

        setProgress(1.0, `Audio ready (${mins}:${secs} • ${currentBpm} BPM). Click "🥁 Separate Drums" to isolate Drums first.`);
      };

      // Load & Decode Audio File
      const processAudioFile = async (file) => {
        if (!file) return;
        if (window.audio && !window.audio.initialized) {
          await window.audio.init();
        }
        setProgress(0.05, 'Reading file into memory...');
        try {
          const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : engine.getAudioContext();
          if (ctx && ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
          setProgress(0.1, 'Decoding audio file...');
          const audioBuf = await engine.decodeAudioFile(file, ctx);
          await processBuffer(audioBuf, file.name);
        } catch (err) {
          console.error('Failed to load audio file:', err);
          alert(`Could not decode audio file: ${err && err.message ? err.message : 'format unsupported'}. Please try another MP3, WAV, FLAC, or M4A file.`);
          setProgress(1.0, 'Error decoding');
        }
      };

      // Ingestion 1: File Browse & Drag & Drop
      if (btnBrowse && fileInput) {
        btnBrowse.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            processAudioFile(e.target.files[0]);
          }
        });
      }

      if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('drag-active');
        });
        ['dragleave', 'dragend'].forEach(ev => {
          dropZone.addEventListener(ev, () => {
            dropZone.classList.remove('drag-active');
          });
        });
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('drag-active');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            processAudioFile(e.dataTransfer.files[0]);
          }
        });
      }

      if (btnQuickSeparateDrums) {
        btnQuickSeparateDrums.addEventListener('click', () => {
          isolateSingleStem('drums');
        });
      }

      if (btnRunAllSequential) {
        btnRunAllSequential.addEventListener('click', () => {
          runAllSequentially();
        });
      }

      if (btnReanalyze) {
        btnReanalyze.addEventListener('click', () => {
          isolateSingleStem('drums');
        });
      }

      // Individual stem isolate buttons
      const isolateBtns = document.querySelectorAll('.btn-isolate-stem');
      isolateBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stem = btn.dataset.stem;
          if (stem) isolateSingleStem(stem);
        });
      });

      // Download Individual Stem
      stemDownloadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stem = btn.dataset.stem;
          if (!currentStems || !currentStems[stem]) {
            alert(`No audio data available for ${stem} stem. Please separate the ${stem} stem first.`);
            return;
          }
          const rawName = (filenameEl && filenameEl.textContent ? filenameEl.textContent : 'audio_track');
          const baseName = rawName.replace(/\.[^/.]+$/, '');
          downloadAudioBufferAsWav(currentStems[stem], `${baseName}_${stem}.wav`);
        });
      });

      // Download All Ready Stems
      if (btnDownloadAllStemsMaster) {
        btnDownloadAllStemsMaster.addEventListener('click', async () => {
          if (!currentStems || Object.keys(currentStems).length === 0) {
            alert('No separated stems available yet. Please isolate drums or another stem first.');
            return;
          }
          const rawName = (filenameEl && filenameEl.textContent ? filenameEl.textContent : 'audio_track');
          const baseName = rawName.replace(/\.[^/.]+$/, '');
          const stemNames = ['drums', 'bass', 'other', 'vocals'];
          let count = 0;
          for (const s of stemNames) {
            if (currentStems[s]) {
              downloadAudioBufferAsWav(currentStems[s], `${baseName}_${s}.wav`);
              count++;
              await new Promise(r => setTimeout(r, 250));
            }
          }
          if (count === 0) {
            alert('No stems ready for download yet.');
          }
        });
      }

      // Ingestion 2: Load Synthetic Funk Demo Track
      if (btnLoadDemo) {
        btnLoadDemo.addEventListener('click', async () => {
          if (window.audio && !window.audio.initialized) {
            await window.audio.init();
          }
          setProgress(0.05, 'Synthesizing funk groove demo track...');
          try {
            const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : engine.getAudioContext();
            const sampleRate = ctx.sampleRate || 44100;
            const duration = 8.5; // 4 bars at 113 BPM
            const numFrames = Math.floor(sampleRate * duration);
            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, numFrames, sampleRate);

            const bpm = 113;
            const beatSec = 60 / bpm;
            const barSec = beatSec * 4;

            // 1. Drums
            for (let bar = 0; bar < 4; bar++) {
              const barStart = bar * barSec;
              [0, 1.5, 2.5].forEach(beatOffset => {
                const t = barStart + beatOffset * beatSec;
                if (t >= duration) return;
                const osc = offlineCtx.createOscillator();
                const gain = offlineCtx.createGain();
                osc.frequency.setValueAtTime(135, t);
                osc.frequency.exponentialRampToValueAtTime(38, t + 0.12);
                gain.gain.setValueAtTime(0.9, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(t);
                osc.stop(t + 0.23);
              });

              [1, 3].forEach(beatOffset => {
                const t = barStart + beatOffset * beatSec;
                if (t >= duration) return;
                const bufSize = Math.floor(sampleRate * 0.16);
                const noiseBuf = offlineCtx.createBuffer(1, bufSize, sampleRate);
                const data = noiseBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

                const noiseSrc = offlineCtx.createBufferSource();
                noiseSrc.buffer = noiseBuf;
                const filter = offlineCtx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(1200, t);
                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0.65, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
                noiseSrc.connect(filter);
                filter.connect(gain);
                gain.connect(offlineCtx.destination);
                noiseSrc.start(t);
                noiseSrc.stop(t + 0.17);
              });

              for (let step = 0; step < 16; step++) {
                const t = barStart + step * (beatSec / 4);
                if (t >= duration) break;
                const bufSize = Math.floor(sampleRate * 0.045);
                const hatBuf = offlineCtx.createBuffer(1, bufSize, sampleRate);
                const hdata = hatBuf.getChannelData(0);
                for (let i = 0; i < bufSize; i++) hdata[i] = (Math.random() * 2 - 1);

                const hatSrc = offlineCtx.createBufferSource();
                hatSrc.buffer = hatBuf;
                const hfilter = offlineCtx.createBiquadFilter();
                hfilter.type = 'bandpass';
                hfilter.frequency.setValueAtTime(9500, t);
                hfilter.Q.value = 3.0;
                const hgain = offlineCtx.createGain();
                const vol = (step % 4 === 0) ? 0.35 : 0.18;
                hgain.gain.setValueAtTime(vol, t);
                hgain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
                hatSrc.connect(hfilter);
                hfilter.connect(hgain);
                hgain.connect(offlineCtx.destination);
                hatSrc.start(t);
                hatSrc.stop(t + 0.045);
              }
            }

            // 2. Bass
            const bassGroove = [
              { beat: 0.0, midi: 38, dur: 0.35 },
              { beat: 0.75, midi: 41, dur: 0.2 },
              { beat: 1.0, midi: 43, dur: 0.35 },
              { beat: 1.5, midi: 44, dur: 0.2 },
              { beat: 2.0, midi: 45, dur: 0.4 },
              { beat: 3.0, midi: 48, dur: 0.25 },
              { beat: 3.5, midi: 50, dur: 0.35 }
            ];

            for (let bar = 0; bar < 4; bar++) {
              const barStart = bar * barSec;
              bassGroove.forEach(n => {
                const t = barStart + n.beat * beatSec;
                if (t >= duration) return;
                const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
                const osc = offlineCtx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, t);

                const filter = offlineCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(650, t);
                filter.frequency.exponentialRampToValueAtTime(140, t + n.dur * beatSec);

                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0.6, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur * beatSec);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(t);
                osc.stop(t + n.dur * beatSec + 0.02);
              });
            }

            // 3. Other Instruments / Keyboards
            for (let bar = 0; bar < 4; bar++) {
              const barStart = bar * barSec;
              const pNotes = (bar % 2 === 0) ? [50, 57, 62, 65] : [55, 59, 64, 67];
              pNotes.forEach(midi => {
                const freq = 440 * Math.pow(2, (midi - 69) / 12);
                const osc = offlineCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, barStart);

                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0.14, barStart);
                gain.gain.linearRampToValueAtTime(0.06, barStart + 1.2);
                gain.gain.exponentialRampToValueAtTime(0.001, barStart + barSec * 0.95);

                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(barStart);
                osc.stop(barStart + barSec);
              });
            }

            // 4. Vocal Whistle Lead
            const vocalMelody = [
              { beat: 0.5, midi: 69, dur: 0.4 },
              { beat: 1.5, midi: 72, dur: 0.3 },
              { beat: 2.0, midi: 74, dur: 0.8 },
              { beat: 3.25, midi: 72, dur: 0.5 }
            ];
            for (let bar = 0; bar < 4; bar++) {
              const barStart = bar * barSec;
              vocalMelody.forEach(vm => {
                const t = barStart + vm.beat * beatSec;
                if (t >= duration) return;
                const freq = 440 * Math.pow(2, (vm.midi - 69) / 12);
                const osc = offlineCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, t);
                const gain = offlineCtx.createGain();
                gain.gain.setValueAtTime(0.12, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + vm.dur * beatSec);
                osc.connect(gain);
                gain.connect(offlineCtx.destination);
                osc.start(t);
                osc.stop(t + vm.dur * beatSec + 0.02);
              });
            }

            const demoBuffer = await offlineCtx.startRendering();
            await processBuffer(demoBuffer, 'funk_groove_demo.wav');
          } catch (err) {
            console.error('Demo synthesis failed:', err);
            setProgress(1.0, 'Synthesis error');
          }
        });
      }

      // Ingestion 3: Live Microphone / Instrument Recording
      if (btnRecordMic) {
        btnRecordMic.addEventListener('click', async () => {
          if (!isRecording) {
            try {
              if (window.audio && !window.audio.initialized) {
                await window.audio.init();
              }
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
              });

              let chunks = [];
              mediaRecorder = new MediaRecorder(stream);
              mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
              };

              mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                clearInterval(recordInterval);
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setProgress(0.1, 'Processing recorded audio...');
                const ab = await blob.arrayBuffer();
                const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : engine.getAudioContext();
                const audioBuf = await engine.decodeAudioFile(ab, ctx);
                await processBuffer(audioBuf, 'live_recording.wav');
                btnRecordMic.innerHTML = '🎙️ Record Instrument';
                btnRecordMic.classList.remove('btn-danger');
                btnRecordMic.classList.add('btn-outline-cyan');
                isRecording = false;
              };

              mediaRecorder.start();
              isRecording = true;
              recordStartTime = Date.now();
              btnRecordMic.innerHTML = '⏹️ Stop Recording (00:00)';
              btnRecordMic.classList.remove('btn-outline-cyan');
              btnRecordMic.classList.add('btn-danger');

              recordInterval = setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - recordStartTime) / 1000);
                const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
                const s = String(elapsedSec % 60).padStart(2, '0');
                btnRecordMic.innerHTML = `⏹️ Stop Recording (${m}:${s})`;
              }, 1000);

            } catch (err) {
              console.error('Microphone access denied:', err);
              alert('Microphone access was denied or is unavailable.');
            }
          } else {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }
        });
      }

      // Open/Close Neural Modal
      if (btnOpenModelManager && modalNeuralModels) {
        btnOpenModelManager.addEventListener('click', async () => {
          modalNeuralModels.style.display = 'flex';
          await updateModelManagerUI();
        });
      }

      if (btnCloseNeuralModal && modalNeuralModels) {
        btnCloseNeuralModal.addEventListener('click', () => {
          modalNeuralModels.style.display = 'none';
        });
      }

      if (modalNeuralModels) {
        modalNeuralModels.addEventListener('click', (e) => {
          if (e.target === modalNeuralModels) {
            modalNeuralModels.style.display = 'none';
          }
        });
      }

      // Download Spotify Basic Pitch
      if (btnInstallBasicPitch) {
        btnInstallBasicPitch.addEventListener('click', async () => {
          btnInstallBasicPitch.disabled = true;
          if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'flex';
          if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = 'Connecting to Spotify Basic Pitch repository...';
          if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '0%';
          if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '0%';

          const isFileProto = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
          const basicPitchUrls = isFileProto ? [
            'https://cdn.jsdelivr.net/gh/spotify/basic-pitch@main/basic_pitch/saved_models/icassp_2022/nmp.onnx',
            'https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/saved_models/icassp_2022/nmp.onnx'
          ] : [
            'models/basic_pitch.onnx',
            'https://cdn.jsdelivr.net/gh/spotify/basic-pitch@main/basic_pitch/saved_models/icassp_2022/nmp.onnx',
            'https://raw.githubusercontent.com/spotify/basic-pitch/main/basic_pitch/saved_models/icassp_2022/nmp.onnx'
          ];

          let success = false;
          let lastErr = null;

          for (let i = 0; i < basicPitchUrls.length; i++) {
            const url = basicPitchUrls[i];
            try {
              if (neuralDownloadStatusText) {
                neuralDownloadStatusText.textContent = url.startsWith('models/')
                  ? 'Checking local models folder (models/basic_pitch.onnx)...'
                  : `Connecting to Spotify Basic Pitch mirror ${i + 1}...`;
              }

              await engine.storage.downloadModel('basic_pitch', url, (frac, loaded, total) => {
                const pct = Math.round(frac * 100);
                if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = `${pct}%`;
                if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = `${pct}%`;
                if (neuralDownloadStatusText) {
                  neuralDownloadStatusText.textContent = `Downloading Basic Pitch: ${formatBytes(loaded)} ${total ? '/ ' + formatBytes(total) : ''}`;
                }
              });

              success = true;
              break;
            } catch (mirrorErr) {
              console.warn(`Basic Pitch source ${url} failed:`, mirrorErr);
              lastErr = mirrorErr;
            }
          }

          if (success) {
            try {
              const hasWasm = await engine.storage.hasModel('ort_wasm_simd');
              if (!hasWasm) {
                const wasmResp = await fetch('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm');
                if (wasmResp.ok) {
                  const wasmAb = await wasmResp.arrayBuffer();
                  await engine.storage.saveModel('ort_wasm_simd', wasmAb, { name: 'ONNX WASM SIMD Runtime' });
                }
              }
            } catch (e) {}

            if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = 'Spotify Basic Pitch installed & cached!';
            if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '100%';
            if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '100%';

            setTimeout(() => {
              if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'none';
            }, 1500);

            await updateModelManagerUI();
          } else {
            console.error('All Basic Pitch download sources failed:', lastErr);
            if (neuralDownloadStatusText) {
              neuralDownloadStatusText.textContent = `Download failed: ${lastErr ? lastErr.message : 'network error'}. You can load a local basic_pitch.onnx file below.`;
            }
            btnInstallBasicPitch.disabled = false;
          }
        });
      }

      // Download Demucs
      if (btnInstallDemucs) {
        btnInstallDemucs.addEventListener('click', async () => {
          const isFileProto = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
          if (isFileProto) {
            const useLocal = confirm("You are running SongAnalyzer via file://.\n\nClick OK to select your local 'models/htdemucs.onnx' file (recommended, instant).\nOr click Cancel to download from a public web mirror.");
            if (useLocal) {
              if (inputLocalModelFile) {
                inputLocalModelFile.value = '';
                inputLocalModelFile.click();
              }
              return;
            }
          }

          btnInstallDemucs.disabled = true;
          if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'flex';
          if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = 'Connecting to Demucs model repository...';
          if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '0%';
          if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '0%';

          const demucsUrls = [
            'models/htdemucs.onnx'
          ];

          let success = false;
          let lastErr = null;

          for (let i = 0; i < demucsUrls.length; i++) {
            const url = demucsUrls[i];
            try {
              if (neuralDownloadStatusText) {
                neuralDownloadStatusText.textContent = url.startsWith('models/')
                  ? 'Checking local models folder (models/htdemucs.onnx)...'
                  : `Connecting to public mirror ${i}...`;
              }

              await engine.storage.downloadModel('demucs', url, (frac, loaded, total) => {
                const pct = Math.round(frac * 100);
                if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = `${pct}%`;
                if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = `${pct}%`;
                if (neuralDownloadStatusText) {
                  neuralDownloadStatusText.textContent = `Downloading Demucs: ${formatBytes(loaded)} ${total ? '/ ' + formatBytes(total) : ''}`;
                }
              });

              success = true;
              break;
            } catch (mirrorErr) {
              console.warn(`Demucs source ${url} failed:`, mirrorErr);
              lastErr = mirrorErr;
            }
          }

          if (success) {
            try {
              const hasWasm = await engine.storage.hasModel('ort_wasm_simd');
              if (!hasWasm) {
                const wasmResp = await fetch('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm');
                if (wasmResp.ok) {
                  const wasmAb = await wasmResp.arrayBuffer();
                  if (wasmAb.byteLength >= 10 * 1024 * 1024) {
                    await engine.storage.saveModel('ort_wasm_simd', wasmAb, { name: 'ONNX WASM SIMD Runtime' });
                  }
                }
              }
            } catch (e) {}

            if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = 'HTDemucs installed & cached!';
            if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '100%';
            if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '100%';

            setTimeout(() => {
              if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'none';
            }, 1500);

            await updateModelManagerUI();
          } else {
            console.error('All Demucs download sources failed:', lastErr);
            if (neuralDownloadStatusText) {
              neuralDownloadStatusText.textContent = `Download failed: ${lastErr ? lastErr.message : 'network error'}. You can load a local htdemucs.onnx file below.`;
            }
            btnInstallDemucs.disabled = false;
          }
        });
      }

      // Cache OpenUnmix Drums & Bass models locally from server
      const cacheLocalUmx = async (stemKey, displayName, btnEl) => {
        if (btnEl) btnEl.disabled = true;
        if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'flex';
        if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = `Loading ${displayName} from server (models/umx_${stemKey}.onnx)...`;
        if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '0%';
        if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '0%';

        try {
          await engine.storage.downloadModel(`umx_${stemKey}`, `models/umx_${stemKey}.onnx`, (frac, loaded, total) => {
            const pct = Math.round(frac * 100);
            if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = `${pct}%`;
            if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = `${pct}%`;
            if (neuralDownloadStatusText) {
              neuralDownloadStatusText.textContent = `Caching ${displayName}: ${formatBytes(loaded)} ${total ? '/ ' + formatBytes(total) : ''}`;
            }
          });

          if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = `${displayName} cached into local browser storage!`;
          if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '100%';
          if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '100%';

          setTimeout(() => {
            if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'none';
          }, 1500);

          await updateModelManagerUI();
        } catch (err) {
          console.error(`Failed to cache ${displayName}:`, err);
          if (neuralDownloadStatusText) {
            neuralDownloadStatusText.textContent = `Caching failed: ${err.message}. Ensure models/umx_${stemKey}.onnx is on server.`;
          }
          if (btnEl) btnEl.disabled = false;
        }
      };

      if (btnInstallUmxDrums) {
        btnInstallUmxDrums.addEventListener('click', () => {
          cacheLocalUmx('drums', 'OpenUnmix Drums', btnInstallUmxDrums);
        });
      }

      if (btnInstallUmxBass) {
        btnInstallUmxBass.addEventListener('click', () => {
          cacheLocalUmx('bass', 'OpenUnmix Bass', btnInstallUmxBass);
        });
      }

      if (btnInstallUmxOther) {
        btnInstallUmxOther.addEventListener('click', () => {
          cacheLocalUmx('other', 'OpenUnmix Other / Guitar', btnInstallUmxOther);
        });
      }

      if (btnInstallUmxVocals) {
        btnInstallUmxVocals.addEventListener('click', () => {
          cacheLocalUmx('vocals', 'OpenUnmix Vocals', btnInstallUmxVocals);
        });
      }

      // Local Model File Selector (Supports .onnx and .wasm)
      if (btnBrowseLocalModel && inputLocalModelFile) {
        btnBrowseLocalModel.addEventListener('click', () => {
          inputLocalModelFile.value = '';
          inputLocalModelFile.click();
        });

        inputLocalModelFile.addEventListener('change', async (e) => {
          const files = Array.from(e.target.files || []);
          if (files.length === 0) return;

          if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'flex';

          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = `Reading ${file.name} (${i + 1}/${files.length})...`;
            if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '30%';

            try {
              const buffer = await file.arrayBuffer();
              if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '70%';

              const lower = file.name.toLowerCase();
              let modelKey = 'demucs';
              let modelLabel = 'HTDemucs';
              if (lower.includes('basic_pitch') || lower.includes('nmp')) {
                modelKey = 'basic_pitch';
                modelLabel = 'Spotify Basic Pitch';
              } else if (lower.includes('umx_drums') || lower === 'drums.onnx') {
                modelKey = 'umx_drums';
                modelLabel = 'OpenUnmix Drums';
              } else if (lower.includes('umx_bass') || lower === 'bass.onnx') {
                modelKey = 'umx_bass';
                modelLabel = 'OpenUnmix Bass';
              } else if (lower.includes('umx_other') || lower === 'other.onnx') {
                modelKey = 'umx_other';
                modelLabel = 'OpenUnmix Other';
              } else if (lower.includes('umx_vocals') || lower === 'vocals.onnx') {
                modelKey = 'umx_vocals';
                modelLabel = 'OpenUnmix Vocals';
              } else if (lower.endsWith('.wasm')) {
                modelKey = 'ort_wasm_simd';
                modelLabel = 'ONNX WASM SIMD Runtime';
              }

              if (neuralDownloadStatusText) neuralDownloadStatusText.textContent = `Caching ${file.name} in IndexedDB as ${modelLabel}...`;

              await engine.storage.saveModel(modelKey, buffer, { name: file.name, size: buffer.byteLength });

              if (modelKey === 'demucs' && engine.demucsRunner) {
                engine.demucsRunner.session = null;
              }

              if (neuralDownloadProgressFill) neuralDownloadProgressFill.style.width = '100%';
              if (neuralDownloadPercentText) neuralDownloadPercentText.textContent = '100%';
              if (neuralDownloadStatusText) {
                neuralDownloadStatusText.textContent = `Successfully cached ${file.name} (${formatBytes(buffer.byteLength)}) as ${modelLabel}!`;
              }
            } catch (err) {
              console.error(`Error importing ${file.name}:`, err);
              if (neuralDownloadStatusText) {
                neuralDownloadStatusText.textContent = `Error importing ${file.name}: ${err.message}`;
              }
            }
          }

          setTimeout(() => {
            if (neuralDownloadProgressBox) neuralDownloadProgressBox.style.display = 'none';
          }, 1500);

          await updateModelManagerUI();

          // Auto-resume separation if an audio track is waiting
          if (currentAudioBuffer && (!currentStems || !currentStems.drums)) {
            const isReady = await engine.demucsRunner.isReady();
            if (isReady) {
              processBuffer(currentAudioBuffer, filenameEl ? filenameEl.textContent : 'audio_track.mp3');
            }
          }
        });
      }

      // Clear Model Cache
      if (btnClearNeuralCache) {
        btnClearNeuralCache.addEventListener('click', async () => {
          if (confirm('Clear all cached neural AI models from browser storage (IndexedDB)?')) {
            await engine.storage.clearAll();
            if (engine.demucsRunner) engine.demucsRunner.session = null;
            await updateModelManagerUI();
          }
        });
      }

      // Silently sync local model into IndexedDB if available and not yet cached (skip on file:// to prevent browser CORS block)
      engine.storage.getSummary().then(async (summary) => {
        const isLive = typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:';
        if (isLive) {
          const caps = engine.getCapabilities ? await engine.getCapabilities() : null;
          const isMobile = Boolean(caps && caps.engineMode === 'mobile_optimized');

          if (!isMobile && !summary.demucs) {
            try {
              const resp = await fetch('models/htdemucs.onnx');
              if (resp.ok) {
                const ab = await resp.arrayBuffer();
                await engine.storage.saveModel('demucs', ab, { name: 'HTDemucs' });
              }
            } catch (e) {}
          } else if (isMobile && !summary.umxDrums) {
            try {
              const resp = await fetch('models/umx_drums.onnx');
              if (resp.ok) {
                const ab = await resp.arrayBuffer();
                await engine.storage.saveModel('umx_drums', ab, { name: 'OpenUnmix Drums' });
              }
            } catch (e) {}
          }
        }
        updateModelManagerUI();
      }).catch(() => {});

      // Toggle Rack Open/Closed
      const togglePanel = () => {
        if (!section) return;
        const isHidden = section.style.display === 'none' || !section.style.display;
        section.style.display = isHidden ? 'block' : 'none';
        if (btnToggleTop) {
          btnToggleTop.textContent = isHidden ? '🎧 Stems: On' : '🎧 Stems: Off';
          if (isHidden) {
            btnToggleTop.classList.add('btn-success');
            btnToggleTop.classList.remove('btn-outline-cyan');
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            btnToggleTop.classList.remove('btn-success');
            btnToggleTop.classList.add('btn-outline-cyan');
          }
        }
        if (window.SongState) window.SongState.requestSave();
      };

      if (btnToggleTop) btnToggleTop.addEventListener('click', togglePanel);
      if (btnClose) {
        btnClose.addEventListener('click', () => {
          if (section) section.style.display = 'none';
          if (btnToggleTop) {
            btnToggleTop.textContent = '🎧 Stems: Off';
            btnToggleTop.classList.remove('btn-success');
            btnToggleTop.classList.add('btn-outline-cyan');
          }
          if (window.SongState) window.SongState.requestSave();
        });
      }

      // Keyboard Shortcut 'A' toggles Stem Separator
      window.addEventListener('keydown', (e) => {
        if (e.key === 'a' || e.key === 'A') {
          const target = e.target;
          if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
            return;
          }
          e.preventDefault();
          if (btnToggleTop) btnToggleTop.click();
        }
      });
    }

    // 0C. Voice Leading Ribbon & 6-School Melodic Pathway Studio
    initRibbonModule() {
      if (!window.VoiceLeadingEngine || !window.RibbonCanvasRenderer) return;

      const canvas = document.getElementById('voiceLeadingCanvas');
      if (!canvas) return;

      this.ribbonEngine = new window.VoiceLeadingEngine();
      this.ribbonRenderer = new window.RibbonCanvasRenderer(canvas, this.ribbonEngine);

      // UI elements
      const schoolTabs = document.querySelectorAll('.ribbon-school-tab');
      const pathwaySelect = document.getElementById('ribbonPathwaySelect');
      const leadVoiceSelect = document.getElementById('ribbonLeadVoiceSelect');
      const btnPlay = document.getElementById('btnPlayRibbonMelody');
      const loopToggle = document.getElementById('ribbonLoopToggle');
      const melodyVol = document.getElementById('ribbonMelodyVol');
      const chordsVol = document.getElementById('ribbonChordsVol');
      const btnReset = document.getElementById('btnResetRibbonNodes');
      const btnCopy = document.getElementById('btnCopyRibbonMelody');
      const btnToggleHeight = document.getElementById('btnToggleRibbonHeight');

      // Hook custom node click override on canvas
      this.ribbonRenderer.onCustomNodeChanged = (chordIndex, candidate) => {
        this.updateRibbonUI();
        if (window.audio && window.audio.isPlayingMelodyProgression) {
          window.audio.onNodeCustomizedDuringPlayback(chordIndex, candidate);
        }
      };

      // Populate pathways for currently selected school
      const populatePathways = () => {
        if (!pathwaySelect) return;
        pathwaySelect.innerHTML = '';
        const school = window.VOICE_LEADING_SCHOOLS[this.ribbonEngine.activeSchoolId];
        if (!school) return;

        school.pathways.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.name} — ${p.tagline}`;
          if (p.id === this.ribbonEngine.activePathwayId) {
            opt.selected = true;
          }
          pathwaySelect.appendChild(opt);
        });
      };

      // School tab clicks
      schoolTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const schoolId = tab.getAttribute('data-school');
          schoolTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          this.ribbonEngine.setSchool(schoolId);
          populatePathways();
          this.updateRibbonUI();
        });
      });

      // Pathway dropdown change
      if (pathwaySelect) {
        pathwaySelect.addEventListener('change', (e) => {
          this.ribbonEngine.setPathway(e.target.value);
          this.updateRibbonUI();
        });
      }

      // Lead voice timbre change
      if (leadVoiceSelect) {
        leadVoiceSelect.addEventListener('change', (e) => {
          if (window.audio && window.audio.setMelodyLeadVoice) {
            window.audio.setMelodyLeadVoice(e.target.value);
            if (window.audio.isPlayingMelodyProgression) {
              window.audio.updateActiveMelodyNodes(this.ribbonEngine.activeMelodyNodes, true);
            }
          }
        });
      }

      // Volume sliders
      if (melodyVol) {
        melodyVol.addEventListener('input', (e) => {
          if (window.audio && window.audio.setMelodyVolume) {
            window.audio.setMelodyVolume(parseFloat(e.target.value) / 100);
          }
        });
      }

      if (chordsVol) {
        chordsVol.addEventListener('input', (e) => {
          if (window.audio && window.audio.setChordVolume) {
            window.audio.setChordVolume(parseFloat(e.target.value) / 100);
          }
        });
      }

      // Canvas height stretch toggle button
      if (btnToggleHeight) {
        btnToggleHeight.addEventListener('click', () => {
          if (this.ribbonRenderer && this.ribbonRenderer.toggleHeight) {
            const isExtra = this.ribbonRenderer.toggleHeight();
            btnToggleHeight.textContent = isExtra ? '↕ Standard View' : '↕ Extra Tall';
            btnToggleHeight.classList.toggle('btn-primary', isExtra);
            btnToggleHeight.classList.toggle('btn-secondary', !isExtra);
          }
        });
      }

      // Reset Custom Nodes button
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          this.ribbonEngine.clearCustomOverrides();
          this.updateRibbonUI();
        });
      }

      // Copy Melody button
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          const nodes = this.ribbonEngine.activeMelodyNodes;
          if (!nodes || nodes.length === 0) return;
          const text = nodes.map(n => {
            const chordName = n.chord ? (n.chord.displayName || n.chord.rawSymbol) : '';
            return `${chordName}: ${n.scientific} (${n.roleLabel || n.deg})`;
          }).join(' ➔ ');

          try {
            await navigator.clipboard.writeText(text);
            const orig = btnCopy.textContent;
            btnCopy.textContent = '✓ Copied!';
            setTimeout(() => { btnCopy.textContent = orig; }, 1800);
          } catch (err) {
            prompt('Copy melody progression notes:', text);
          }
        });
      }

      // Play / Stop Melody Playback
      if (btnPlay) {
        btnPlay.addEventListener('click', async () => {
          const audio = window.audio;
          if (!audio) return;

          if (audio.isPlayingMelodyProgression) {
            audio.stopProgressionWithMelody();
            btnPlay.innerHTML = '<span>▶ Audition Melody + Chords</span>';
            btnPlay.classList.remove('btn-danger');
            this.ribbonRenderer.setActiveStep(-1);
            this.highlightTableRow(-1);
            if (this.visualizer) {
              this.visualizer.clearMelodyNote();
              if (!this.beatSequencer || !this.beatSequencer.isPlaying) {
                this.visualizer.stopAnimation();
              }
            }
          } else {
            if (audio.isPlayingProgression) {
              audio.stopProgression();
              const btnProg = document.getElementById('btnPlayProgression');
              if (btnProg) btnProg.textContent = '▶ Play Progression';
            }

            const bpmInput = document.getElementById('metroBpmInput');
            const bpm = bpmInput ? (parseInt(bpmInput.value, 10) || 113) : 113;
            const loop = loopToggle ? loopToggle.checked : true;

            btnPlay.innerHTML = '<span>⏹ Stop Audition</span>';
            btnPlay.classList.add('btn-danger');

            if (this.visualizer) this.visualizer.startAnimation();
            await audio.playProgressionWithMelody(
              this.parsedChords,
              () => (this.ribbonEngine ? this.ribbonEngine.activeMelodyNodes : []),
              bpm,
              loop,
              (idx, chord, melodyNode) => {
                this.ribbonRenderer.setActiveStep(idx);
                this.highlightTableRow(idx);
                if (chord && this.visualizer) {
                  this.visualizer.setActiveChord(chord);
                }
                if (melodyNode && this.visualizer) {
                  this.visualizer.setMelodyNote(melodyNode);
                }
              },
              () => {
                btnPlay.innerHTML = '<span>▶ Audition Melody + Chords</span>';
                btnPlay.classList.remove('btn-danger');
                this.ribbonRenderer.setActiveStep(-1);
                this.highlightTableRow(-1);
                if (this.visualizer) {
                  this.visualizer.clearMelodyNote();
                  if (!this.beatSequencer || !this.beatSequencer.isPlaying) {
                    this.visualizer.stopAnimation();
                  }
                }
              }
            );
          }
        });
      }

      // Populate with existing analysis if available
      if (this.parsedChords && this.parsedChords.length > 0) {
        this.ribbonEngine.setProgression(this.parsedChords, this.selectedKey);
      }

      // Initial setup
      populatePathways();
      this.ribbonRenderer.handleResize();
      this.updateRibbonUI();
    }

    updateRibbonUI() {
      if (!this.ribbonEngine || !this.ribbonRenderer) return;

      // Real-time audio synchronization: if auditioning, push updated melody nodes to audio engine immediately!
      if (window.audio && window.audio.isPlayingMelodyProgression) {
        window.audio.updateActiveMelodyNodes(this.ribbonEngine.activeMelodyNodes, true);
      }

      // Update Quick Stats
      const stats = this.ribbonEngine.getStatistics();
      const statTotal = document.getElementById('statTotalMotion');
      const statAvg = document.getElementById('statAvgMotion');
      const statCommon = document.getElementById('statCommonPct');

      if (statTotal) statTotal.textContent = stats.totalMotion;
      if (statAvg) statAvg.textContent = stats.avgMotion;
      if (statCommon) statCommon.textContent = `${stats.commonPct}%`;

      // Update Reset Button visibility
      const btnReset = document.getElementById('btnResetRibbonNodes');
      if (btnReset) {
        btnReset.style.display = this.ribbonEngine.hasCustomOverrides() ? 'inline-block' : 'none';
      }

      // Update Educational Insight Card
      const school = window.VOICE_LEADING_SCHOOLS[this.ribbonEngine.activeSchoolId];
      if (school) {
        const pathway = school.pathways.find(p => p.id === this.ribbonEngine.activePathwayId) || school.pathways[0];
        const badge = document.getElementById('insightSchoolBadge');
        const title = document.getElementById('insightPathwayTitle');
        const pedagogy = document.getElementById('insightPathwayPedagogy');
        const artists = document.getElementById('insightPathwayArtists');

        if (badge) badge.textContent = `${school.icon} ${school.name}`;
        if (title) title.textContent = pathway ? pathway.name : '';
        if (pedagogy) pedagogy.textContent = pathway ? pathway.pedagogy : '';
        if (artists) artists.textContent = pathway ? pathway.artists : '';
      }

      this.ribbonRenderer.render();
    }

    // 4. Metronome & Time Signature Engine
    parseTimeSignature(str) {
      if (!str) return { num: 4, den: 4 };
      const m = str.trim().match(/^(\d+)\s*[\/:]\s*(\d+)(?::(\d+))?$/);
      if (!m) return { num: 4, den: 4 };
      const num = Math.max(1, Math.min(64, parseInt(m[1], 10)));
      const den = Math.max(1, Math.min(64, parseInt(m[2], 10)));
      const sub = m[3] ? Math.max(1, Math.min(16, parseInt(m[3], 10))) : null;
      return { num, den, sub };
    }

    updateTimeSignature() {
      const input = document.getElementById('metroTimeSigInput');
      const val = input ? input.value : '4/4';
      this.currentTimeSignature = this.parseTimeSignature(val);

      this.renderMetronomeDots(this.currentTimeSignature.num);

      const bpm = this.getBpm();
      this.updateTempoMarking(bpm);

      if (window.audio && window.audio.isMetronomeRunning) {
        this.restartRunningMetronome();
      }
    }

    renderMetronomeDots(numBeats) {
      const container = document.getElementById('metroDotsContainer');
      if (!container) return;
      container.innerHTML = '';
      this.metroDotElements = [];

      for (let i = 1; i <= numBeats; i++) {
        const dot = document.createElement('span');
        dot.className = 'metro-dot';
        dot.dataset.beat = i;
        dot.textContent = `${i}`;
        container.appendChild(dot);
        this.metroDotElements.push(dot);
      }
    }

    restartRunningMetronome() {
      const audio = window.audio;
      if (!audio) return;

      const bpm = this.getBpm();
      const subEl = document.getElementById('metroSubdivision');
      const sub = subEl ? (parseInt(subEl.value, 10) || 1) : 1;
      const soundEl = document.getElementById('metroSound');
      const sound = soundEl ? soundEl.value : 'woodblock';

      audio.startMetronome(bpm, this.currentTimeSignature, sub, sound, (beat, subIdx, isDownbeat, totalBeats) => {
        this.flashBeatIndicator(beat, isDownbeat);
      });
    }

    updateTempoMarking(bpm) {
      const display = document.getElementById('tempoMarkingText');
      if (!display) return;
      const sig = this.currentTimeSignature || { num: 4, den: 4 };
      let label = 'Moderato';
      if (bpm < 25) label = 'Larghissimo (Extremely slow)';
      else if (bpm < 45) label = 'Grave (Solemn, very slow)';
      else if (bpm < 60) label = 'Largo (Broadly)';
      else if (bpm < 66) label = 'Larghetto (Rather broadly)';
      else if (bpm < 76) label = 'Adagio (Slow & stately)';
      else if (bpm < 108) label = 'Andante (Walking pace)';
      else if (bpm < 120) label = 'Moderato (Moderate)';
      else if (bpm < 168) label = 'Allegro (Fast, bright)';
      else if (bpm < 200) label = 'Presto (Very fast)';
      else label = 'Prestissimo (Extremely fast)';

      display.textContent = `${sig.num}/${sig.den} Meter • ${bpm} BPM • ${label}`;
    }

    flashBeatIndicator(beat, isDownbeat) {
      if (!this.metroDotElements || this.metroDotElements.length === 0) {
        this.metroDotElements = Array.from(document.querySelectorAll('#metroDotsContainer .metro-dot'));
      }
      const dots = this.metroDotElements;
      const len = dots.length;
      for (let i = 0; i < len; i++) {
        const dot = dots[i];
        const isActive = (i + 1 === beat);
        const targetClass = isActive ? `metro-dot ${isDownbeat ? 'downbeat' : 'active'}` : 'metro-dot';
        if (dot.className !== targetClass) {
          dot.className = targetClass;
        }
      }
    }

    // 4b. Practice Session Timer Engine
    initPracticeTimer() {
      this.updatePracticeTimerUI();
      this.renderTimerLog();
    }

    startPracticeTimer() {
      if (this.practiceTimer.isRunning) return;

      const autoSplitEl = document.getElementById('timerAutoSplitOnRestart');
      const autoSplit = autoSplitEl ? autoSplitEl.checked : true;

      // If metronome was previously stopped and restarted, and delta has accumulated time (>= 1 sec):
      // automatically complete the previous exercise and start a new delta
      if (this.practiceTimer.wasStopped && autoSplit && this.practiceTimer.currentDeltaMs >= 1000) {
        this.archiveCurrentExercise();
      }

      this.practiceTimer.isRunning = true;
      this.practiceTimer.wasStopped = false;
      this.practiceTimer.lastTickTimestamp = Date.now();
      this.practiceTimer.targetChimePlayed = false;

      this.updateTimerStatusBadge('Practicing', 'running');

      if (this.practiceTimer.timerInterval) {
        clearInterval(this.practiceTimer.timerInterval);
      }

      this.practiceTimer.timerInterval = setInterval(() => {
        this.tickPracticeTimer();
      }, 100);

      this.updatePracticeTimerUI();
    }

    stopPracticeTimer() {
      if (!this.practiceTimer.isRunning) return;

      const now = Date.now();
      const dt = now - this.practiceTimer.lastTickTimestamp;
      this.practiceTimer.totalTimeMs += dt;
      this.practiceTimer.currentDeltaMs += dt;

      if (this.practiceTimer.timerInterval) {
        clearInterval(this.practiceTimer.timerInterval);
        this.practiceTimer.timerInterval = null;
      }

      this.practiceTimer.isRunning = false;
      this.practiceTimer.wasStopped = true;

      this.updateTimerStatusBadge('Paused', 'paused');
      this.updatePracticeTimerUI();
    }

    tickPracticeTimer() {
      if (!this.practiceTimer.isRunning) return;
      const now = Date.now();
      const dt = now - this.practiceTimer.lastTickTimestamp;
      this.practiceTimer.lastTickTimestamp = now;

      this.practiceTimer.totalTimeMs += dt;
      this.practiceTimer.currentDeltaMs += dt;

      // Check optional target duration
      const targetEl = document.getElementById('timerTargetDuration');
      const targetSeconds = targetEl ? (parseInt(targetEl.value, 10) || 0) : 0;
      if (targetSeconds > 0 && Math.floor(this.practiceTimer.currentDeltaMs / 1000) >= targetSeconds) {
        if (!this.practiceTimer.targetChimePlayed) {
          this.practiceTimer.targetChimePlayed = true;
          this.playTargetGoalChime();
          this.flashTargetGoalReached();
        }
      }

      this.updatePracticeTimerUI();
    }

    nextPracticeExercise() {
      // Archive current exercise if there is time recorded
      if (this.practiceTimer.currentDeltaMs >= 1000) {
        this.archiveCurrentExercise();
      } else {
        this.practiceTimer.currentDeltaMs = 0;
      }

      if (this.practiceTimer.isRunning) {
        this.practiceTimer.lastTickTimestamp = Date.now();
        this.practiceTimer.targetChimePlayed = false;
      }
      this.removeTargetGoalHighlight();
      this.updatePracticeTimerUI();
    }

    archiveCurrentExercise() {
      const deltaMs = this.practiceTimer.currentDeltaMs;
      const totalMs = this.practiceTimer.totalTimeMs;
      const exNum = this.practiceTimer.currentExerciseNumber;
      const exName = this.currentActiveExerciseTitle || `Exercise #${exNum}`;

      this.practiceTimer.exerciseHistory.push({
        number: exNum,
        name: exName,
        deltaMs: deltaMs,
        totalMs: totalMs,
        formattedDelta: this.formatTimerMs(deltaMs),
        formattedTotal: this.formatTimerMs(totalMs),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });

      this.practiceTimer.currentDeltaMs = 0;
      this.practiceTimer.targetChimePlayed = false;
      this.practiceTimer.currentExerciseNumber++;

      this.removeTargetGoalHighlight();
      this.renderTimerLog();
    }

    resetPracticeTimer() {
      this.practiceTimer.totalTimeMs = 0;
      this.practiceTimer.currentDeltaMs = 0;
      this.practiceTimer.currentExerciseNumber = 1;
      this.practiceTimer.exerciseHistory = [];
      this.practiceTimer.wasStopped = false;
      this.practiceTimer.targetChimePlayed = false;

      if (this.practiceTimer.isRunning) {
        this.practiceTimer.lastTickTimestamp = Date.now();
      } else {
        this.updateTimerStatusBadge('Stopped', 'idle');
      }

      this.removeTargetGoalHighlight();
      this.updatePracticeTimerUI();
      this.renderTimerLog();
    }

    formatTimerMs(ms) {
      const totalSec = Math.floor(Math.max(0, ms) / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n) => String(n).padStart(2, '0');
      if (hrs > 0) {
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      }
      return `${pad(mins)}:${pad(secs)}`;
    }

    updatePracticeTimerUI() {
      const totalEl = document.getElementById('timerTotalDisplay');
      const deltaEl = document.getElementById('timerDeltaDisplay');
      const totalSub = document.getElementById('timerTotalSubtext');
      const deltaSub = document.getElementById('timerDeltaSubtext');

      if (totalEl) totalEl.textContent = this.formatTimerMs(this.practiceTimer.totalTimeMs);
      if (deltaEl) deltaEl.textContent = this.formatTimerMs(this.practiceTimer.currentDeltaMs);

      const completedCount = this.practiceTimer.exerciseHistory.length;
      if (totalSub) {
        totalSub.textContent = `${completedCount} exercise${completedCount === 1 ? '' : 's'} completed`;
      }
      if (deltaSub) {
        deltaSub.textContent = `Exercise #${this.practiceTimer.currentExerciseNumber}`;
      }
    }

    updateTimerStatusBadge(text, className) {
      const badge = document.getElementById('timerStatusBadge');
      if (badge) {
        badge.textContent = text;
        badge.className = `timer-badge ${className}`;
      }
    }

    playTargetGoalChime() {
      const audio = window.audio;
      if (audio && audio.initialized && audio.leadSynth) {
        try {
          const now = (audio && audio.getAudioCurrentTime) ? audio.getAudioCurrentTime() : (audio && audio.ctx ? audio.ctx.currentTime : 0);
          audio.leadSynth.triggerAttackRelease('E5', '8n', now, 0.4);
          audio.leadSynth.triggerAttackRelease('A5', '4n', now + 0.18, 0.5);
        } catch (e) {
          // ignore chime error
        }
      }
    }

    flashTargetGoalReached() {
      const card = document.getElementById('timerDeltaCard');
      if (card) card.classList.add('goal-reached');
    }

    removeTargetGoalHighlight() {
      const card = document.getElementById('timerDeltaCard');
      if (card) card.classList.remove('goal-reached');
    }

    renderTimerLog() {
      const logCount = document.getElementById('timerLogCount');
      if (logCount) logCount.textContent = this.practiceTimer.exerciseHistory.length;

      const container = document.getElementById('timerLogEntries');
      if (!container) return;

      if (this.practiceTimer.exerciseHistory.length === 0) {
        container.innerHTML = '<div class="timer-log-empty">No exercises logged yet. Start metronome to practice!</div>';
        return;
      }

      container.innerHTML = '';
      this.practiceTimer.exerciseHistory.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'timer-log-item';
        const nameSubtitle = item.name && !item.name.startsWith('Exercise #') ? `<span class="text-muted" style="display:block; font-size:0.75rem; margin-top:2px;">${item.name}</span>` : '';
        row.innerHTML = `
          <span class="timer-log-item-num">Ex #${item.number}${nameSubtitle}</span>
          <span class="timer-log-item-delta">Delta: ${item.formattedDelta}</span>
          <span class="timer-log-item-total">Total: ${item.formattedTotal} <small>(${item.time})</small></span>
        `;
        container.appendChild(row);
      });
    }

    // 5. Rhythm Studio & Beat Builder Notation Engine
    generateRhythm() {
      if (window.audio && window.audio.isRhythmPlaying) {
        window.audio.stopRhythm();
        this.updateRhythmPlayButtonState(false);
      }
      this.highlightRhythmGlyph(-1);

      const restsEl = document.getElementById('rhythmIncludeRests');
      const includeRests = restsEl ? restsEl.checked : true;
      const targetTrackSelect = document.getElementById('rhythmTargetTrack');
      const targetTrack = targetTrackSelect ? targetTrackSelect.value : 'snare';
      const styleSelect = document.getElementById('rhythmStyleSelect');
      const rhythmStyle = styleSelect ? styleSelect.value : 'balanced';

      // Step count & time signature from beat sequencer
      const stepCount = this.beatSequencer ? this.beatSequencer.getStepCount() : 16;
      const timeSig = (this.beatSequencer && this.beatSequencer.timeSignature) || { num: 4, den: 4 };
      const targetTicks = stepCount * 8; // 1 step = 1 sixteenth note = 8 ticks

      // Define note & rest pools
      let notePool = [
        { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, stepCount: 4, isRest: false },
        { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, stepCount: 2, isRest: false },
        { glyph: '𝅘𝅥𝅯', name: '16th Note', value: 8, stepCount: 1, isRest: false },
        { glyph: '𝅗𝅥', name: 'Half Note', value: 64, stepCount: 8, isRest: false }
      ];

      let restPool = [
        { glyph: '𝄽', name: 'Quarter Rest', value: 32, stepCount: 4, isRest: true },
        { glyph: '𝄾', name: 'Eighth Rest', value: 16, stepCount: 2, isRest: true },
        { glyph: '𝄿', name: '16th Rest', value: 8, stepCount: 1, isRest: true }
      ];

      if (rhythmStyle === 'straight') {
        notePool = [
          { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, stepCount: 4, isRest: false },
          { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, stepCount: 4, isRest: false },
          { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, stepCount: 2, isRest: false },
          { glyph: '𝅗𝅥', name: 'Half Note', value: 64, stepCount: 8, isRest: false }
        ];
        restPool = [
          { glyph: '𝄽', name: 'Quarter Rest', value: 32, stepCount: 4, isRest: true },
          { glyph: '𝄾', name: 'Eighth Rest', value: 16, stepCount: 2, isRest: true }
        ];
      } else if (rhythmStyle === 'dense') {
        notePool = [
          { glyph: '𝅘𝅥𝅯', name: '16th Note', value: 8, stepCount: 1, isRest: false },
          { glyph: '𝅘𝅥𝅯', name: '16th Note', value: 8, stepCount: 1, isRest: false },
          { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, stepCount: 2, isRest: false },
          { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, stepCount: 4, isRest: false }
        ];
        restPool = [
          { glyph: '𝄿', name: '16th Rest', value: 8, stepCount: 1, isRest: true },
          { glyph: '𝄾', name: 'Eighth Rest', value: 16, stepCount: 2, isRest: true }
        ];
      } else if (rhythmStyle === 'syncopated') {
        notePool = [
          { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, stepCount: 2, isRest: false, isAccent: true },
          { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, stepCount: 4, isRest: false },
          { glyph: '𝅘𝅥𝅯', name: '16th Note', value: 8, stepCount: 1, isRest: false },
          { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, stepCount: 2, isRest: false }
        ];
        restPool = [
          { glyph: '𝄾', name: 'Eighth Rest', value: 16, stepCount: 2, isRest: true },
          { glyph: '𝄿', name: '16th Rest', value: 8, stepCount: 1, isRest: true },
          { glyph: '𝄽', name: 'Quarter Rest', value: 32, stepCount: 4, isRest: true }
        ];
      }

      const pool = includeRests ? [...notePool, ...restPool] : notePool;
      const items = [];
      let currentTicks = 0;

      while (currentTicks < targetTicks) {
        const remaining = targetTicks - currentTicks;
        const validOptions = pool.filter(p => p.value <= remaining);
        if (validOptions.length === 0) break;

        const pick = { ...validOptions[Math.floor(Math.random() * validOptions.length)] };
        items.push(pick);
        currentTicks += pick.value;
      }

      this.currentRhythmItems = items;

      // 1. Map generated rhythm alone onto Beat Builder grid (replacing any existing rhythm)
      this.applyRhythmToGrid(items, targetTrack);

      // Sync Sheet Music track selector with target track
      const sheetTrackSelect = document.getElementById('beatSheetTrackSelect');
      if (sheetTrackSelect) {
        sheetTrackSelect.value = targetTrack;
      }

      // 3. Render Unicode Glyph Strip (if present)
      this.renderRhythmGlyphs(items);

      // 4. Update Summary Badge
      const summaryBadge = document.getElementById('rhythmSummaryBadge');
      if (summaryBadge) {
        const notesCount = items.filter(i => !i.isRest).length;
        const restsCount = items.filter(i => i.isRest).length;
        const trackDef = this.drumSynth?.trackDefs?.find(t => t.id === targetTrack);
        const trackName = trackDef ? trackDef.name : targetTrack;
        summaryBadge.textContent = `${notesCount} Notes, ${restsCount} Rests (${trackName})`;
      }

      // 5. Update Grid DOM & Visualizer Concentric Groove Wheel
      this.renderBeatGrid();
      if (this.visualizer && this.visualizer.mode === 'clock') {
        this.visualizer.render();
      }
    }

    applyRhythmToGrid(items, targetTrack = 'snare') {
      if (!this.beatSequencer) return;

      // The rhythm appears alone, replacing any existing rhythm on the grid
      this.beatSequencer.clearPattern();

      // Ensure target track exists in pattern, default to 'snare'
      const trackId = (this.beatSequencer.pattern && this.beatSequencer.pattern[targetTrack])
        ? targetTrack
        : (this.beatSequencer.pattern && this.beatSequencer.pattern['snare'] ? 'snare' : Object.keys(this.beatSequencer.pattern)[0]);

      this.mapItemsToTrack(items, trackId);
    }

    mapItemsToTrack(items, trackId) {
      if (!this.beatSequencer || !this.beatSequencer.pattern[trackId]) return;
      const stepCount = this.beatSequencer.getStepCount();
      const arr = new Array(stepCount).fill(0);

      let curStep = 0;
      items.forEach((item) => {
        const stepLen = item.stepCount || Math.max(1, Math.round((item.value || 32) / 8));
        if (curStep < stepCount) {
          if (!item.isRest) {
            const isDownbeat = (curStep % 4 === 0);
            arr[curStep] = (item.isAccent || isDownbeat) ? 2 : 1;
          }
        }
        curStep += stepLen;
      });

      this.beatSequencer.pattern[trackId] = arr;
    }

    renderRhythmGlyphs(items) {
      const container = document.getElementById('rhythmGlyphDisplay');
      if (!container) return;
      container.innerHTML = '';

      items.forEach((item, idx) => {
        const span = document.createElement('span');
        span.className = 'rhythm-glyph';
        span.dataset.index = idx;
        span.textContent = item.glyph;
        span.title = `${item.name} (${item.isRest ? 'Rest' : (item.stepCount === 4 ? '1/4' : item.stepCount === 2 ? '1/8' : item.stepCount === 1 ? '1/16' : '1/2')})`;
        span.style.cursor = 'pointer';

        span.addEventListener('click', async () => {
          if (!item.isRest) {
            await this.ensureDrumAudioContext();
            if (this.drumSynth && this.drumSynth.ctx) {
              const trackSelect = document.getElementById('rhythmTargetTrack');
              const trackId = (trackSelect && trackSelect.value !== 'fullGroove') ? trackSelect.value : 'clave';
              this.drumSynth.playVoice(trackId, this.drumSynth.ctx.currentTime, 1.1);
            }
          }
          this.highlightRhythmGlyph(idx);
          if (this.sheetMusicRenderer) {
            this.sheetMusicRenderer.setActiveNoteIndex(idx);
          }
        });

        container.appendChild(span);
      });
    }

    updateRhythmPlayButtonState(isPlaying) {
      const btn = document.getElementById('btnPlayRhythm');
      const statusBadge = document.getElementById('rhythmLoopStatus');
      if (btn) {
        if (isPlaying) {
          btn.textContent = '⏹ Stop';
          btn.classList.remove('btn-outline-cyan');
          btn.classList.add('btn-danger');
        } else {
          btn.textContent = '▶ Play Clave';
          btn.classList.remove('btn-danger');
          btn.classList.add('btn-outline-cyan');
        }
      }
      if (!isPlaying && statusBadge) {
        statusBadge.style.display = 'none';
      }
    }

    highlightRhythmGlyph(idx) {
      if (this._activeRhythmIdx === idx) return;
      this._activeRhythmIdx = idx;
      const glyphs = document.querySelectorAll('.rhythm-glyph');
      if (glyphs.length === 0) return;
      if (glyphs[0].offsetParent === null) return; // Skip DOM styling when rhythm generator tab is hidden
      glyphs.forEach((el, i) => {
        if (i === idx) el.classList.add('active');
        else el.classList.remove('active');
      });
    }

    highlightRhythmGlyphByStep(stepIdx) {
      if (stepIdx < 0 || !this.currentRhythmItems || this.currentRhythmItems.length === 0) {
        this.highlightRhythmGlyph(-1);
        return;
      }
      let cur = 0;
      for (let i = 0; i < this.currentRhythmItems.length; i++) {
        const it = this.currentRhythmItems[i];
        const len = it.stepCount || Math.max(1, Math.round((it.value || 32) / 8));
        if (stepIdx >= cur && stepIdx < cur + len) {
          this.highlightRhythmGlyph(i);
          return;
        }
        cur += len;
      }
      this.highlightRhythmGlyph(-1);
    }

    // 6. Ear Training Quiz Drill
    startIntervalDrill() {
      const audio = window.audio;
      if (!audio || !audio.leadSynth) return;

      const baseMidi = 60;
      const intervalSemitones = Math.floor(Math.random() * 12);
      this.earTrainingAnswer = intervalSemitones;

      const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const note1 = `${sharpNames[baseMidi % 12]}4`;
      const note2 = `${sharpNames[(baseMidi + intervalSemitones) % 12]}${Math.floor((baseMidi + intervalSemitones) / 12) - 1}`;

      const now = (audio && audio.getAudioCurrentTime) ? audio.getAudioCurrentTime() : (audio && audio.ctx ? audio.ctx.currentTime : 0);
      audio.leadSynth.triggerAttackRelease(note1, '4n', now);
      audio.leadSynth.triggerAttackRelease(note2, '4n', now + 0.6);

      const feedback = document.getElementById('intervalFeedback');
      if (feedback) {
        feedback.textContent = 'Notes played! Choose your interval:';
        feedback.className = 'drill-feedback';
      }
    }

    checkIntervalAnswer(guessedSemitone) {
      if (this.earTrainingAnswer === null) return;
      const feedback = document.getElementById('intervalFeedback');
      if (!feedback) return;

      const intervalNames = [
        'Unison (1)', 'Minor 2nd (b2)', 'Major 2nd (2)', 'Minor 3rd (b3)',
        'Major 3rd (3)', 'Perfect 4th (4)', 'Tritone (b5)', 'Perfect 5th (5)',
        'Minor 6th (b6)', 'Major 6th (6)', 'Minor 7th (b7)', 'Major 7th (7)'
      ];

      if (guessedSemitone === this.earTrainingAnswer) {
        feedback.textContent = `Correct! 🎉 The interval was ${intervalNames[this.earTrainingAnswer]}.`;
        feedback.className = 'drill-feedback success';
      } else {
        feedback.textContent = `Not quite! It was ${intervalNames[this.earTrainingAnswer]}. Try again!`;
        feedback.className = 'drill-feedback error';
      }
    }

    // 7. Practice Library / Exercises (Curated from dredwerkz.cz/obsah.html)
    initPracticeExercises() {
      return [
        // Preserved Original 5 Core Drills
        { category: 'Scales & Modes', title: 'Natural Major Scale in 3rds', desc: 'Practice alternating diatonic thirds: C-E, D-F, E-G, F-A, G-B, A-C... across all octaves with steady alternate picking.' },
        { category: 'Arpeggios & Triads', title: 'Harmonic Minor Arpeggios (1-3-5-7)', desc: 'Run arpeggios of the 7 chords of D harmonic minor: Dm(maj7), Edim7, F+maj7, Gm7, A7, Bbmaj7, C#dim7. Focus on clean string transitions.' },
        { category: 'Arpeggios & Triads', title: 'F# Natural Minor Triad Inversions', desc: 'Play root position, 1st inversion, and 2nd inversion of F#m across strings 2, 3, 4. Listen for voice-leading continuity.' },
        { category: 'Concepts & Harmony', title: 'Circle of Fourths Voice-Leading Drill', desc: 'Follow the circle: C -> F -> Bb -> Eb -> Ab -> Db -> Gb -> B -> E -> A -> D -> G -> C. Resolve 7ths down by half-step to 3rds.' },
        { category: 'Genres & Blues', title: '2-5-1 Voicings in 3 Keys', desc: 'Play Dm7 -> G7 -> Cmaj7, then modulate to F (Gm7 -> C7 -> Fmaj7), then Bb (Cm7 -> F7 -> Bbmaj7) using shell voicings (Root-3-7).' },

        // Bassguitar Drills
        { category: 'Bassguitar', title: 'Bass Gym 101: Finger Permutations', desc: 'Fretboard dexterity workout: cycle 4-2-3-1, 2-1-3-2 on G, D, A, E strings. Maintain one finger per fret and eliminate extraneous fret hand tension.' },
        { category: 'Bassguitar', title: 'Killer Pentatonics 101 (Bass)', desc: 'Wide interval leaps and position shifts in C major / A minor pentatonic across all strings. Practice accenting beat 1 and shifting smoothly with the 1st finger.' },
        { category: 'Bassguitar', title: 'Natural Major Scale in Fifths (Bass)', desc: 'Run the Ionian scale in diatonic 5ths: C-G, D-A, E-B, F-C, G-D, A-E, B-F#. Great for fretboard visualization and string skipping.' },
        { category: 'Bassguitar', title: '4-String Bass Diatonic Triads', desc: 'Cycle closed diatonic triads (Emin, F, G, Amin, Bdim, C, Dmin) across E-A, A-D, and D-G string sets. Master root-3rd-5th shapes on the low end.' },
        { category: 'Bassguitar', title: '5-String Bass Extended Low-B Arpeggios', desc: 'Explore the low B string for deep extended range. Run major and minor arpeggios spanning from low B0/C1 up into octave 3.' },
        { category: 'Bassguitar', title: 'A Minor Pentatonic Box Across Bass Strings', desc: 'Map A minor pentatonic (A-C-D-E-G) on 4-string and 5-string bass in standard tuning, shifting between the 5th and 12th fret root positions.' },

        // Concepts & Harmony
        { category: 'Concepts & Harmony', title: 'Diatonic Target Note Enclosure', desc: 'Enclose target chord tones diatonically (1 note below, 1 note above) through modal lines: C Ionian, F Dorian, Bb Phrygian, and Eb Lydian.' },
        { category: 'Concepts & Harmony', title: 'Chromatic Approach to Arpeggios', desc: 'Approach every chord tone (1, 3, 5, 7) chromatically from a half-step below or above before landing on the target arpeggio note.' },
        { category: 'Concepts & Harmony', title: 'Creative Arpeggio Design (Tim Miller)', desc: 'Modern fluid arpeggio design: blend intervals of 2nds, 4ths, and 5ths across adjacent string pairs rather than standard stacked 3rds.' },
        { category: 'Concepts & Harmony', title: 'Deriving Chords from Scale Degrees', desc: 'Construct 7th chords degree by degree from the major and natural minor scales. Analyze why degree II is minor 7th and degree V is dominant 7th.' },

        // Chords
        { category: 'Chords', title: 'Movable 7th Chord Shapes', desc: 'Shift movable 7th chord shapes (maj7, min7, dom7, m7b5, dim7) with roots on strings 6 and 5 chromatically up and down the neck.' },

        // Technique
        { category: 'Technique', title: 'Downpicking Endurance & Precision', desc: 'Heavy downstrokes with strict palm muting. Cycle between quarter notes, eighth notes, eighth-note triplets, and sixteenth notes at steady tempos.' },
        { category: 'Technique', title: 'Finger Independence (Spider Drill)', desc: 'Independent finger permutations (i-m-a-c) across adjacent string pairs without sympathetic tension or lifting fretting fingers prematurely.' },
        { category: 'Technique', title: 'Left & Right Hand Synchronization', desc: 'Strict alternate picking synchronization: execute 1-2-3, 1-3-2, 2-1-3, and 3-2-1 note groupings across strings with crisp metronome precision.' },
        { category: 'Technique', title: 'Speed & Economy Picking (Frank Gambale)', desc: 'Economy picking: sweep through consecutive strings in one continuous stroke on Dm7 and Am arpeggios (down-down-down, pull-off, up-up).' },
        { category: 'Technique', title: 'Hybrid Picking Lines & Licks (Pick + Fingers)', desc: 'Hold pick for lower notes while plucking high string skips with middle (m) and ring (a) fingers for banjo-style rolls and pedal-tone motifs.' },
        { category: 'Technique', title: 'Legato 101: Hammer-on & Pull-off Chains', desc: 'Produce pure legato flow: hammer on and pull off continuous notes from the open string (0-5-6-7-8) using only fretting-hand finger power.' },
        { category: 'Technique', title: 'Chromatic 4-Finger Warmup (MAB Session)', desc: 'Michael Angelo Batio chromatic warmup: play 1-2-3-4-4-3-2-1 across all 6 strings at frets 1, 5, and 9 to stretch finger tendons.' },
        { category: 'Technique', title: 'Palm Muting 101 & Rhythmic Accents', desc: 'Lock in heavy palm-muted chugs while emphasizing specific beats: accent beat 1, then beat 2, beat 3, and beat 4 on alternating bars.' },
        { category: 'Technique', title: 'Selective Picking & Hammer Accents', desc: 'Palm-mute all strings and hammer-on notes cleanly, selectively picking isolated notes in E major and E minor arpeggio contours.' },
        { category: 'Technique', title: 'Slap Bass 101: Thumb Slap & Pop', desc: 'Slap thumb through the low string bouncing onto the fretboard, followed by index finger popping octaves on the higher strings.' },
        { category: 'Technique', title: 'Slap A Major Scale Workout', desc: 'Apply thumb slaps and finger pops to run the complete A major scale up the neck: A(5) -> B(7) -> C#(4) -> D(5) -> E(7) -> F#(4) -> G#(6) -> A(7).' },
        { category: 'Technique', title: 'Two-Handed Tapping & Switch Protocols', desc: 'Fretting hand hammer-ons combined with index/middle right-hand tapping. Execute multi-finger tapping arpeggios in Gm across strings 2, 3, and 4.' },
        { category: 'Technique', title: 'Thump Technique (Tosin Abasi THUMP!)', desc: 'Modern double-thumb thumping: strike down with the side of the thumb and pop upward on the return stroke in 16th-note syncopated bursts.' },
        { category: 'Technique', title: 'Acoustic Fingerpicking Etude (Javier Reyes)', desc: 'Classical/progressive fingerstyle: rolling p-i-m-a-m-i arpeggio pattern on extended chords with dynamic balance between bass and melody.' },

        // Genres & Blues
        { category: 'Genres & Blues', title: 'Blues 101: 12-Bar 1-4-5 in E Major', desc: 'Comp through a 12-bar blues in E using E7 (I), A7 (IV), and B7 (V). Add a quick-change to IV on bar 2 and an authentic turnaround on bars 11-12.' },
        { category: 'Genres & Blues', title: 'Minor 2-5-1 in 7ths (Jazz 101)', desc: 'Play Bm7b5 -> E7b9 -> Am7. Practice voice leading the guide tones: flat-5 of Bm7b5 (F) resolves to flat-9 of E7b9 (F), resolving to 5th of Am (E).' },

        // Rhythm
        { category: 'Rhythm', title: 'Sikhyi-Ashanti Polyrhythm Study', desc: 'West African polyrhythmic study: play syncopated dotted accents and off-beat chord stabs against a steady 4/4 pulse with metronome.' },

        // Scales & Modes
        { category: 'Scales & Modes', title: 'A Minor Pentatonic: 5 Connected Shapes', desc: 'Connect all 5 pentatonic box shapes from fret 0 to fret 15. Slide between positions on strings 3 and 2 to break horizontal rut.' },
        { category: 'Scales & Modes', title: 'Bm Phrygian #4 Riff in Fifths', desc: 'Eastern modal riff based on the 4th mode of F# harmonic minor: B-C-D-E#-F#-G-A. Emphasize the augmented 4th (E#) against open power chords.' },
        { category: 'Arpeggios & Triads', title: 'Root Triads Across Strings 1-2-3', desc: 'Cycle diatonic triads in root position: Am, Bdim, C, Dm, Em, F, G on the top 3 strings. Learn the major, minor, and diminished shapes.' },
        { category: 'Arpeggios & Triads', title: '1st Inversion Triads (3rd in Bass)', desc: 'Practice 1st inversion diatonic triads (C/E, Dm/F, Em/G...) on strings 1-2-3 and 2-3-4. Master voice-leading triads along the neck.' },
        { category: 'Arpeggios & Triads', title: '2nd Inversion Triads (5th in Bass)', desc: 'Practice 2nd inversion diatonic triads (C/G, Dm/A, Em/B...) across strings 1-2-3. Notice how the 5th in bass provides stability.' },
        { category: 'Scales & Modes', title: '3-Notes-Per-String Modal Workout (7 Modes)', desc: 'Run 3-notes-per-string fingerings for all 7 diatonic modes (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian) across 6 or 8 strings.' },
        { category: 'Scales & Modes', title: 'F# Natural Minor Across 3 Octaves', desc: 'Scale run spanning 3 octaves from fret 2 on low E (F#) to fret 14 on high E. Shift positions seamlessly at strings D and B.' },
        { category: 'Scales & Modes', title: 'F# Natural Minor Scale in Thirds', desc: 'Run F# natural minor in diatonic thirds: F#-A, G#-B, A-C#, B-D, C#-E, D-F#, E-G#, F#-A. Alternate picking throughout.' },
        { category: 'Scales & Modes', title: 'D Harmonic Minor Single-String Groups of 3', desc: 'Single-string shifting along the neck in groups of 3 notes (D-E-F, E-F-G, F-G-A...). Emphasize the wide step between Bb and C#.' },
        { category: 'Scales & Modes', title: 'Natural Major: Melody & Chord Integration', desc: 'Combine chord comping with simultaneous scale melody notes in C Major. Keep bass notes ringing on beats 1 & 3 while melody flows on 2 & 4.' },

        // Theory on Fretboard
        { category: 'Fretboard Theory', title: 'C Natural Major Notes on the Fretboard', desc: 'Locate and sound every natural note (C, D, E, F, G, A, B) across all strings up to fret 24 without looking at accidentals. Name each note out loud.' }
      ];
    }

    pickRandomExercise() {
      if (!this.practiceExercises) {
        this.practiceExercises = this.initPracticeExercises();
      }

      const categorySelect = document.getElementById('exerciseCategorySelect');
      const cat = categorySelect ? categorySelect.value : 'all';
      const pool = (cat && cat !== 'all')
        ? this.practiceExercises.filter(e => e.category === cat)
        : this.practiceExercises;

      if (pool.length === 0) return;

      // Avoid immediate repetition if pool has more than 1 item
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && pick.title === this.currentActiveExerciseTitle) {
        const otherPool = pool.filter(e => e.title !== this.currentActiveExerciseTitle);
        pick = otherPool[Math.floor(Math.random() * otherPool.length)];
      }

      this.currentActiveExerciseTitle = pick.title;

      const container = document.getElementById('exerciseCardDisplay');
      if (container) {
        container.innerHTML = `
          <div class="exercise-prompt-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span class="badge badge-info" style="font-size: 0.72rem; padding: 2px 7px;">${pick.category}</span>
              <small class="text-muted" style="font-size: 0.72rem;">Curated Drill</small>
            </div>
            <h4>${pick.title}</h4>
            <p>${pick.desc}</p>
          </div>
        `;
      }
    }

    // -------------------------------------------------------------
    // Adaptive Grid Beat Builder (9-Voice Drum Sequencer)
    // -------------------------------------------------------------
    initBeatBuilder() {
      if (!window.SongDrums) return;

      this.drumSynth = new window.SongDrums.DrumSynth();
      this.beatSequencer = new window.SongDrums.BeatSequencer(this.drumSynth);
      window.drumMachine = this.beatSequencer; // Make accessible globally to visualizer
      this.beatSequencer.setBpm(this.getBpm());

      // Load initial default groove (self-configures 4/4 16 steps)
      this.beatSequencer.loadPreset('rock');

      // Initialize Sheet Music Notation Renderer
      const sheetCanvas = document.getElementById('beatSheetMusicCanvas');
      if (sheetCanvas && window.SheetMusicRenderer) {
        this.sheetMusicRenderer = new window.SheetMusicRenderer(sheetCanvas);
        this.sheetMusicRenderer.onNoteClick = async (item, index) => {
          if (!item.isRest) {
            await this.ensureDrumAudioContext();
            if (this.drumSynth && this.drumSynth.ctx) {
              const trackSelect = document.getElementById('beatSheetTrackSelect');
              let trackId = trackSelect ? trackSelect.value : 'snare';
              if (trackId === 'fullGroove') {
                trackId = item.trackId || 'snare';
              }
              const vel = item.isAccent ? 1.35 : (item.isGhost ? 0.35 : 1.0);
              this.drumSynth.playVoice(trackId, this.drumSynth.ctx.currentTime, vel);
            }
          }
        };

        const sheetTrackSelect = document.getElementById('beatSheetTrackSelect');
        if (sheetTrackSelect) {
          sheetTrackSelect.addEventListener('change', () => {
            this.updateSheetMusicFromGrid();
          });
        }

        // Synchronize horizontal scrolling between Beat Grid and Sheet Music
        const gridWrapper = document.getElementById('beatGridWrapper');
        const sheetScroll = document.getElementById('beatSheetScroll');
        if (gridWrapper && sheetScroll) {
          let isSyncingGrid = false;
          let isSyncingSheet = false;

          gridWrapper.addEventListener('scroll', () => {
            if (isSyncingSheet) return;
            isSyncingGrid = true;
            sheetScroll.scrollLeft = gridWrapper.scrollLeft;
            isSyncingGrid = false;
          }, { passive: true });

          sheetScroll.addEventListener('scroll', () => {
            if (isSyncingGrid) return;
            isSyncingSheet = true;
            gridWrapper.scrollLeft = sheetScroll.scrollLeft;
            isSyncingSheet = false;
          }, { passive: true });
        }
      }

      // Bind mode tabs
      const btnModeClick = document.getElementById('btnMetroModeClick');
      const btnModeBeats = document.getElementById('btnMetroModeBeats');
      const clickContainer = document.getElementById('metroClickContainer');
      const beatContainer = document.getElementById('beatBuilderContainer');

      if (btnModeClick && btnModeBeats) {
        btnModeClick.addEventListener('click', () => {
          btnModeClick.classList.add('btn-primary', 'active');
          btnModeBeats.classList.remove('btn-primary', 'active');
          if (clickContainer) clickContainer.style.display = 'block';
          if (beatContainer) beatContainer.style.display = 'none';
        });

        btnModeBeats.addEventListener('click', async () => {
          btnModeBeats.classList.add('btn-primary', 'active');
          btnModeClick.classList.remove('btn-primary', 'active');
          if (clickContainer) clickContainer.style.display = 'none';
          if (beatContainer) beatContainer.style.display = 'block';
          this.ensureDrumAudioContext();
          this.renderBeatGrid();
          if (this.sheetMusicRenderer) {
            setTimeout(() => {
              this.sheetMusicRenderer.handleResize();
              this.updateSheetMusicFromGrid();
            }, 50);
          }
        });
      }

      // Play / Stop Beat Button
      const btnToggleBeat = document.getElementById('btnToggleBeat');
      const statusIndicator = document.getElementById('beatStatusIndicator');
      if (btnToggleBeat) {
        btnToggleBeat.addEventListener('click', async () => {
          await this.ensureDrumAudioContext();

          if (this.beatSequencer.isPlaying) {
            this.beatSequencer.stop();
            btnToggleBeat.textContent = '▶ Play Beat';
            btnToggleBeat.classList.remove('btn-danger');
            btnToggleBeat.classList.add('btn-success');
            if (statusIndicator) statusIndicator.textContent = 'Stopped';
            this.highlightBeatStep(-1);
            if (this.visualizer) this.visualizer.stopAnimation();
          } else {
            // If simple metronome is running, stop it to avoid cacophony
            if (window.audio && window.audio.isMetronomeRunning) {
              window.audio.stopMetronome();
              const btnMetro = document.getElementById('btnToggleMetronome');
              if (btnMetro) {
                btnMetro.textContent = '▶ Start Metronome';
                btnMetro.classList.remove('btn-danger');
              }
            }

            btnToggleBeat.textContent = '⏹ Stop Beat';
            btnToggleBeat.classList.remove('btn-success');
            btnToggleBeat.classList.add('btn-danger');
            if (statusIndicator) statusIndicator.textContent = 'Playing';

            let syncStartTime = null;
            if (window.audio && window.audio.isPlayingProgression) {
              syncStartTime = window.audio.getNextChordDownbeatTime();
            }

            if (this.visualizer) this.visualizer.startAnimation();
            this.beatSequencer.start((stepIdx) => {
              this.highlightBeatStep(stepIdx);
            }, syncStartTime);
          }
        });
      }

      // Independent Arbitrary Beat Meter Input (e.g. 7/8, 5/4, 4/4, 11/8, 3/4)
      const beatTimeSigInput = document.getElementById('beatTimeSigInput');
      const handleBeatTimeSigChange = () => {
        if (!beatTimeSigInput) return;
        const val = beatTimeSigInput.value.trim();
        const parsed = this.parseTimeSignature(val);
        if (parsed) {
          // Determine natural 16th-note subdivision based on denominator
          let subdiv = 4;
          if (parsed.sub) {
            subdiv = parsed.sub;
          } else if (parsed.den === 8) {
            subdiv = 2; // e.g. 7/8 -> 14 steps, 6/8 -> 12 steps, 9/8 -> 18 steps
          } else if (parsed.den === 16) {
            subdiv = 1; // e.g. 11/16 -> 11 steps
          } else if (parsed.den === 2) {
            subdiv = 8; // e.g. 2/2 -> 16 steps
          } else {
            subdiv = Math.max(1, Math.round(16 / parsed.den));
          }

          this.beatSequencer.setTimeSignature(parsed, subdiv);
          if (presetSelect) presetSelect.value = '';
          this.renderBeatGrid();
        }
      };

      if (beatTimeSigInput) {
        beatTimeSigInput.addEventListener('change', handleBeatTimeSigChange);
        beatTimeSigInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            handleBeatTimeSigChange();
            beatTimeSigInput.blur();
          }
        });
      }

      // Groove Preset Selector (presets define their own meter and swing)
      const presetSelect = document.getElementById('beatPresetSelect');
      if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val) {
            const meta = this.beatSequencer.loadPreset(val);
            if (meta) {
              if (beatTimeSigInput) {
                beatTimeSigInput.value = `${meta.timeSignature.num}/${meta.timeSignature.den}`;
              }
              const swingSlider = document.getElementById('beatSwingSlider');
              const swingVal = document.getElementById('beatSwingValue');
              if (swingSlider && swingVal) {
                const pct = Math.round(meta.swing * 100);
                swingSlider.value = pct;
                swingVal.textContent = `${pct}%`;
              }
            }
            this.renderBeatGrid();
          }
        });
      }

      // Swing Slider
      const swingSlider = document.getElementById('beatSwingSlider');
      const swingVal = document.getElementById('beatSwingValue');
      if (swingSlider) {
        swingSlider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10) || 0;
          this.beatSequencer.swing = val / 100;
          if (swingVal) swingVal.textContent = `${val}%`;
        });
      }

      // Clear Grid Button
      const btnClear = document.getElementById('btnClearBeatGrid');
      if (btnClear) {
        btnClear.addEventListener('click', () => {
          this.beatSequencer.clearPattern();
          if (presetSelect) presetSelect.value = '';
          this.renderBeatGrid();
        });
      }

      // Initial render
      this.renderBeatGrid();
    }

    async ensureDrumAudioContext() {
      if (!this.drumSynth) return;
      if (window.audio) {
        await window.audio.init();
        await window.audio.resumeIfNeeded();
      }
      if (this.drumSynth.ctx && this.drumSynth.masterNode && this.drumSynth.noiseBuffer) {
        if (this.drumSynth.ctx.state !== 'running' && typeof this.drumSynth.ctx.resume === 'function') {
          await this.drumSynth.ctx.resume();
        }
        return;
      }
      let ctx = null;
      if (window.audio && window.audio.rawAudioContext && typeof window.audio.rawAudioContext.createGain === 'function') {
        ctx = window.audio.rawAudioContext;
      } else if (typeof AudioContext !== 'undefined') {
        ctx = new AudioContext();
      }

      if (ctx) {
        const dest = (window.audio && window.audio.masterVolume)
          ? window.audio.masterVolume
          : ctx.destination;
        this.drumSynth.init(ctx, dest);
      }
    }

    renderBeatGrid() {
      const container = document.getElementById('beatGridContainer');
      if (!container || !this.beatSequencer) return;

      const stepCount = this.beatSequencer.getStepCount();
      const sig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
      const subdiv = this.beatSequencer.subdivision || 4;

      // Update Grouping Badge (e.g. "3/4 • 1 Bar • 3 Beats • 12 Steps")
      const badge = document.getElementById('beatGroupingBadge');
      if (badge) {
        badge.textContent = `${sig.num}/${sig.den} • 1 Bar • ${sig.num} Beats • ${stepCount} Steps`;
      }

      container.innerHTML = '';

      // 1. Header row with step numbers, musical subdivision ticks, and downbeats
      const headerRow = document.createElement('div');
      headerRow.className = 'beat-step-header-row';

      const headerSpacer = document.createElement('div');
      headerSpacer.className = 'beat-step-header-spacer';
      headerRow.appendChild(headerSpacer);

      const subLabels4 = ['1', 'e', '&', 'a'];
      const subLabels2 = ['1', '&'];
      const subLabels3 = ['1', '&', 'a'];

      for (let s = 0; s < stepCount; s++) {
        const numEl = document.createElement('span');
        numEl.className = 'beat-step-num';
        const isDownbeat = (s % subdiv === 0);
        const beatIndex = Math.floor(s / subdiv) + 1;
        const subIndex = s % subdiv;

        if (isDownbeat && s > 0) {
          numEl.classList.add('bar-boundary');
        }

        if (isDownbeat) {
          numEl.classList.add('is-downbeat');
          numEl.textContent = `${beatIndex}`;
          numEl.title = `Beat ${beatIndex} (Step ${s + 1} of ${stepCount})`;
        } else {
          if (subdiv === 4) {
            numEl.textContent = subLabels4[subIndex];
          } else if (subdiv === 2) {
            numEl.textContent = subLabels2[subIndex];
          } else if (subdiv === 3) {
            numEl.textContent = subLabels3[subIndex];
          } else {
            numEl.textContent = `${subIndex + 1}`;
          }
          numEl.title = `Beat ${beatIndex}, Sub ${numEl.textContent} (Step ${s + 1} of ${stepCount})`;
        }
        headerRow.appendChild(numEl);
      }
      container.appendChild(headerRow);

      // 2. Tracks rows (Kick, Snare, Closed Hat, Open Hat, Ride, Crash, Cowbell, Clap)
      this.drumSynth.trackDefs.forEach(track => {
        const row = document.createElement('div');
        row.className = 'beat-track-row';
        row.dataset.track = track.id;

        // Track header with Label, Mute, Solo
        const info = document.createElement('div');
        info.className = 'beat-track-info';

        const nameLabel = document.createElement('span');
        nameLabel.className = 'beat-track-name';
        nameLabel.textContent = track.name;
        nameLabel.title = `Click to audition ${track.name}`;
        nameLabel.style.cursor = 'pointer';
        nameLabel.addEventListener('click', async () => {
          await this.ensureDrumAudioContext();
          if (this.drumSynth && this.drumSynth.ctx) {
            this.drumSynth.playVoice(track.id, this.drumSynth.ctx.currentTime, 1.1);
          }
          const sheetTrackSelect = document.getElementById('beatSheetTrackSelect');
          if (sheetTrackSelect) {
            sheetTrackSelect.value = track.id;
            this.updateSheetMusicFromGrid();
          }
        });

        const btnsGroup = document.createElement('div');
        btnsGroup.className = 'beat-track-btns';

        const btnMute = document.createElement('button');
        btnMute.className = 'beat-btn-pill' + (this.drumSynth.channelStates[track.id].mute ? ' active-mute' : '');
        btnMute.textContent = 'M';
        btnMute.title = `Mute ${track.name}`;
        btnMute.addEventListener('click', (e) => {
          e.stopPropagation();
          this.drumSynth.channelStates[track.id].mute = !this.drumSynth.channelStates[track.id].mute;
          btnMute.classList.toggle('active-mute', this.drumSynth.channelStates[track.id].mute);
        });

        const btnSolo = document.createElement('button');
        btnSolo.className = 'beat-btn-pill' + (this.drumSynth.channelStates[track.id].solo ? ' active-solo' : '');
        btnSolo.textContent = 'S';
        btnSolo.title = `Solo ${track.name}`;
        btnSolo.addEventListener('click', (e) => {
          e.stopPropagation();
          this.drumSynth.channelStates[track.id].solo = !this.drumSynth.channelStates[track.id].solo;
          btnSolo.classList.toggle('active-solo', this.drumSynth.channelStates[track.id].solo);
        });

        btnsGroup.appendChild(btnMute);
        btnsGroup.appendChild(btnSolo);
        info.appendChild(nameLabel);
        info.appendChild(btnsGroup);
        row.appendChild(info);

        // Step Pads
        for (let s = 0; s < stepCount; s++) {
          const pad = document.createElement('button');
          pad.className = `beat-pad color-${track.color}`;
          pad.dataset.track = track.id;
          pad.dataset.step = s;

          if (s % subdiv === 0 && s > 0) {
            pad.classList.add('bar-boundary');
          }

          const beatIdx = Math.floor(s / subdiv) + 1;
          const subIdx = s % subdiv;
          const subText = (subdiv === 4) ? subLabels4[subIdx] : ((subdiv === 2) ? subLabels2[subIdx] : `${subIdx + 1}`);
          pad.title = `${track.name}: Beat ${beatIdx}${subIdx === 0 ? '' : ' (' + subText + ')'}, Step ${s + 1}`;

          const state = this.beatSequencer.pattern[track.id] ? this.beatSequencer.pattern[track.id][s] : 0;
          this.applyPadStateClass(pad, state);

          pad.addEventListener('click', async () => {
            const nextState = this.beatSequencer.cycleStep(track.id, s);
            this.applyPadStateClass(pad, nextState);
            this.updateSheetMusicFromGrid();
            if (this.visualizer && this.visualizer.mode === 'clock') {
              this.visualizer.render();
            }
            // Audition drum hit on tap
            if (nextState > 0) {
              await this.ensureDrumAudioContext();
              if (this.drumSynth.ctx) {
                const vel = nextState === 2 ? 1.35 : (nextState === 3 ? 0.35 : 1.0);
                this.drumSynth.playVoice(track.id, this.drumSynth.ctx.currentTime, vel);
              }
            }
          });

          row.appendChild(pad);
        }

        container.appendChild(row);
      });

      if (this.visualizer && this.visualizer.mode === 'clock') {
        this.visualizer.render();
      }

      this.updateSheetMusicFromGrid();
    }

    applyPadStateClass(pad, state) {
      pad.classList.remove('state-normal', 'state-accent', 'state-ghost');
      if (state === 1) pad.classList.add('state-normal');
      else if (state === 2) pad.classList.add('state-accent');
      else if (state === 3) pad.classList.add('state-ghost');
    }

    highlightBeatStep(stepIdx) {
      if (this._lastBeatStep === stepIdx) return;
      this._lastBeatStep = stepIdx;

      const grid = document.getElementById('beatGridContainer');
      if (grid && grid.offsetParent !== null) {
        if (this._activeBeatPads && this._activeBeatPads.length > 0) {
          for (let i = 0; i < this._activeBeatPads.length; i++) {
            this._activeBeatPads[i].classList.remove('active-cursor');
          }
          this._activeBeatPads = [];
        } else {
          const pads = grid.querySelectorAll('.beat-pad.active-cursor');
          pads.forEach(p => p.classList.remove('active-cursor'));
        }

        if (stepIdx >= 0) {
          const currentPads = grid.querySelectorAll(`.beat-pad[data-step="${stepIdx}"]`);
          currentPads.forEach(p => p.classList.add('active-cursor'));
          this._activeBeatPads = Array.from(currentPads);
        }
      }

      if (this.visualizer && this.visualizer.setStep) {
        this.visualizer.setStep(stepIdx);
      }

      if (this.sheetMusicRenderer) {
        this.sheetMusicRenderer.setActiveStep(stepIdx);
      }

      this.highlightRhythmGlyphByStep(stepIdx);
    }

    convertGridPatternToRhythmItems(targetTrackId = 'snare') {
      if (!this.beatSequencer) return [];
      const stepCount = this.beatSequencer.getStepCount();
      const sig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
      const subdiv = this.beatSequencer.subdivision || 4;
      const pattern = this.beatSequencer.pattern || {};

      // 1. Build an array of states for the selected track (or composite across all tracks)
      const states = new Array(stepCount).fill(0);
      const trackSource = new Array(stepCount).fill(null);

      if (targetTrackId === 'fullGroove') {
        for (let s = 0; s < stepCount; s++) {
          for (const track of this.drumSynth.trackDefs) {
            const val = pattern[track.id] ? pattern[track.id][s] : 0;
            if (val > 0) {
              if (val === 2 || states[s] === 0) {
                states[s] = val;
                trackSource[s] = track.id;
              } else if (val === 1 && states[s] === 3) {
                states[s] = 1;
                trackSource[s] = track.id;
              }
            }
          }
        }
      } else {
        const trackArr = pattern[targetTrackId] || [];
        for (let s = 0; s < stepCount; s++) {
          states[s] = trackArr[s] || 0;
          if (states[s] > 0) trackSource[s] = targetTrackId;
        }
      }

      const makeNote = (count, state, sourceTrack) => {
        let name = '16th Note';
        let glyph = '𝅘𝅥𝅯';
        let value = 8;
        if (count >= 8) {
          name = 'Half Note';
          glyph = '𝅗𝅥';
          value = 64;
        } else if (count >= 4) {
          name = 'Quarter Note';
          glyph = '𝅘𝅥';
          value = 32;
        } else if (count >= 2) {
          name = 'Eighth Note';
          glyph = '𝅘𝅥𝅮';
          value = 16;
        }
        return {
          glyph,
          name,
          value,
          stepCount: count,
          isRest: false,
          isAccent: state === 2,
          isGhost: state === 3,
          trackId: sourceTrack
        };
      };

      const makeRests = (count) => {
        const rests = [];
        let remaining = count;
        while (remaining > 0) {
          if (remaining >= 8) {
            rests.push({ glyph: '𝄼', name: 'Half Rest', value: 64, stepCount: 8, isRest: true });
            remaining -= 8;
          } else if (remaining >= 4) {
            rests.push({ glyph: '𝄽', name: 'Quarter Rest', value: 32, stepCount: 4, isRest: true });
            remaining -= 4;
          } else if (remaining >= 2) {
            rests.push({ glyph: '𝄾', name: 'Eighth Rest', value: 16, stepCount: 2, isRest: true });
            remaining -= 2;
          } else {
            rests.push({ glyph: '𝄿', name: '16th Rest', value: 8, stepCount: 1, isRest: true });
            remaining -= 1;
          }
        }
        return rests;
      };

      const items = [];
      const numBeats = sig.num;

      for (let b = 0; b < numBeats; b++) {
        const beatStart = b * subdiv;
        const beatEnd = Math.min(stepCount, beatStart + subdiv);
        const beatLen = beatEnd - beatStart;
        if (beatLen <= 0) break;

        const subStates = states.slice(beatStart, beatEnd);
        const subSources = trackSource.slice(beatStart, beatEnd);

        const hitIndices = [];
        subStates.forEach((v, idx) => {
          if (v > 0) hitIndices.push(idx);
        });

        // 1. All rests in this beat
        if (hitIndices.length === 0) {
          items.push(...makeRests(beatLen));
          continue;
        }

        // 2. Rest before the first hit
        if (hitIndices[0] > 0) {
          items.push(...makeRests(hitIndices[0]));
        }

        // 3. Notes within the beat
        for (let i = 0; i < hitIndices.length; i++) {
          const curIdx = hitIndices[i];
          const state = subStates[curIdx];
          const source = subSources[curIdx];

          if (i < hitIndices.length - 1) {
            const nextIdx = hitIndices[i + 1];
            const dur = nextIdx - curIdx;
            items.push(makeNote(dur, state, source));
          } else {
            // Last hit in beat
            const remaining = beatLen - curIdx;
            if (curIdx === 0) {
              items.push(makeNote(beatLen, state, source));
            } else if (remaining === 2) {
              items.push(makeNote(2, state, source));
            } else if (remaining === 1) {
              items.push(makeNote(1, state, source));
            } else {
              items.push(makeNote(1, state, source));
              items.push(...makeRests(remaining - 1));
            }
          }
        }
      }

      return items;
    }

    updateSheetMusicFromGrid() {
      if (!this.sheetMusicRenderer || !this.beatSequencer) return;

      const trackSelect = document.getElementById('beatSheetTrackSelect');
      const targetTrackId = trackSelect ? trackSelect.value : 'snare';
      const items = this.convertGridPatternToRhythmItems(targetTrackId);
      const timeSig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
      const stepCount = this.beatSequencer.getStepCount();

      this.sheetMusicRenderer.setRhythm(items, timeSig, stepCount);

      // Update badge
      const badge = document.getElementById('beatSheetNoteBadge');
      if (badge) {
        const noteCount = items.filter(it => !it.isRest).length;
        const restCount = items.filter(it => it.isRest).length;
        const trackName = (targetTrackId === 'fullGroove')
          ? 'Full Groove'
          : (this.drumSynth?.trackDefs?.find(t => t.id === targetTrackId)?.name || targetTrackId);
        const noteStr = `${noteCount} Note${noteCount === 1 ? '' : 's'}`;
        const restStr = restCount > 0 ? `, ${restCount} Rest${restCount === 1 ? '' : 's'}` : '';
        badge.textContent = `${trackName} • ${timeSig.num}/${timeSig.den} • ${noteStr}${restStr}`;
      }
    }

    // -------------------------------------------------------------
    // Master Jam Transport Bar & Synchronized Playback Engine
    // -------------------------------------------------------------
    initMasterJamTransport() {
      const btnToggle = document.getElementById('btnMasterJamToggle');
      this.isMasterJamPlaying = false;

      if (btnToggle) {
        btnToggle.addEventListener('click', async () => {
          await this.toggleMasterJam();
        });
      }

      // Spacebar global keyboard listener (ignoring inputs/textareas/selects)
      window.addEventListener('keydown', async (e) => {
        if (e.code === 'Space') {
          const target = e.target;
          const isInput = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
          );
          if (!isInput) {
            e.preventDefault();
            await this.toggleMasterJam();
          }
        }
      });

      // Track checkboxes: live arming/muting during jam
      const trackChords = document.getElementById('jamTrackChords');
      const trackDrums = document.getElementById('jamTrackDrums');
      const trackClave = document.getElementById('jamTrackClave');
      const trackClick = document.getElementById('jamTrackClick');

      [trackChords, trackDrums, trackClave, trackClick].forEach(box => {
        if (!box) return;
        box.addEventListener('change', async () => {
          if (!this.isMasterJamPlaying) return;
          await this.syncActiveJamTracks();
        });
      });

      // Export Jam MIDI button in header
      const btnExportJam = document.getElementById('btnExportJamMidi');
      if (btnExportJam) {
        btnExportJam.addEventListener('click', () => {
          this.exportJamSessionMidi();
        });
      }
    }

    async toggleMasterJam() {
      if (this.isMasterJamPlaying) {
        this.stopMasterJam();
      } else {
        await this.startMasterJam();
      }
    }

    async startMasterJam() {
      if (!window.audio) return;
      await window.audio.init();
      await window.audio.resumeIfNeeded();
      await this.ensureDrumAudioContext();

      this.isMasterJamPlaying = true;
      if (this.requestWakeLock) this.requestWakeLock();
      const bpm = this.getBpm();

      const btnToggle = document.getElementById('btnMasterJamToggle');
      const btnIcon = document.getElementById('masterJamBtnIcon');
      const btnLabel = document.getElementById('masterJamBtnLabel');
      const syncDot = document.getElementById('jamSyncDot');
      const syncText = document.getElementById('jamSyncStatusText');

      if (btnToggle) btnToggle.classList.add('is-playing');
      if (btnIcon) btnIcon.textContent = '⏹';
      if (btnLabel) btnLabel.textContent = 'STOP JAM';
      if (syncDot) syncDot.classList.add('is-active');
      if (syncText) syncText.textContent = 'Locked 🔒';

      if (this.visualizer) {
        this.visualizer.startAnimation();
      }

      // Start all tracks locked to exact same audio timestamp
      const startTime = ((window.audio && window.audio.getAudioCurrentTime) ? window.audio.getAudioCurrentTime() : (window.audio && window.audio.ctx ? window.audio.ctx.currentTime : 0)) + 0.08;

      const trackChords = document.getElementById('jamTrackChords');
      const trackDrums = document.getElementById('jamTrackDrums');
      const trackClave = document.getElementById('jamTrackClave');
      const trackClick = document.getElementById('jamTrackClick');

      // 1. Drums
      if (trackDrums && trackDrums.checked && this.beatSequencer) {
        this.beatSequencer.setBpm(bpm);
        this.beatSequencer.stop();
        this.beatSequencer.start((stepIdx) => this.highlightBeatStep(stepIdx), startTime);
        const btnToggleBeat = document.getElementById('btnToggleBeat');
        if (btnToggleBeat) {
          btnToggleBeat.textContent = '⏹ Stop Beat';
          btnToggleBeat.classList.remove('btn-success');
          btnToggleBeat.classList.add('btn-danger');
        }
        const beatStatus = document.getElementById('beatStatusIndicator');
        if (beatStatus) beatStatus.textContent = 'Playing';
      }

      // 2. Chords
      if (trackChords && trackChords.checked && this.parsedChords && this.parsedChords.length > 0) {
        const btnPlayProg = document.getElementById('btnPlayProgression');
        if (btnPlayProg) btnPlayProg.textContent = '⏹ Stop Progression';
        window.audio.playProgression(
          this.parsedChords,
          bpm,
          true,
          (idx, chord) => {
            this.highlightTableRow(idx);
            if (chord && this.visualizer) this.visualizer.setActiveChord(chord);
          },
          () => {
            if (btnPlayProg) btnPlayProg.textContent = '▶ Play Progression';
            this.highlightTableRow(-1);
          },
          startTime
        );
      }

      // 3. Clave / Rhythm
      if (trackClave && trackClave.checked && this.currentRhythmItems && this.currentRhythmItems.length > 0) {
        this.updateRhythmPlayButtonState(true);
        const statusBadge = document.getElementById('rhythmLoopStatus');
        if (statusBadge) {
          statusBadge.style.display = 'inline-block';
          statusBadge.textContent = 'Jam Loop (∞)';
        }
        window.audio.playRhythmSequence(
          this.currentRhythmItems,
          () => this.getBpm(),
          Infinity,
          (idx) => this.highlightRhythmGlyph(idx),
          null,
          () => {
            this.updateRhythmPlayButtonState(false);
            this.highlightRhythmGlyph(-1);
          },
          startTime
        );
      }

      // 4. Metronome Click
      if (trackClick && trackClick.checked) {
        const sig = this.getMetronomeTimeSignature ? this.getMetronomeTimeSignature() : { num: 4, den: 4 };
        window.audio.startMetronome(bpm, sig, 1, 'woodblock', (beat) => this.updateMetronomeBeat(beat));
        const btnMetro = document.getElementById('btnToggleMetronome');
        if (btnMetro) {
          btnMetro.textContent = '⏹ Stop Metronome';
          btnMetro.classList.add('btn-danger');
        }
      }
    }

    stopMasterJam() {
      this.isMasterJamPlaying = false;
      if (this.releaseWakeLock) this.releaseWakeLock();

      const btnToggle = document.getElementById('btnMasterJamToggle');
      const btnIcon = document.getElementById('masterJamBtnIcon');
      const btnLabel = document.getElementById('masterJamBtnLabel');
      const syncDot = document.getElementById('jamSyncDot');
      const syncText = document.getElementById('jamSyncStatusText');

      if (btnToggle) btnToggle.classList.remove('is-playing');
      if (btnIcon) btnIcon.textContent = '▶';
      if (btnLabel) btnLabel.textContent = 'MASTER JAM';
      if (syncDot) syncDot.classList.remove('is-active');
      if (syncText) syncText.textContent = 'Jam Ready';

      if (this.visualizer) {
        this.visualizer.stopAnimation();
      }

      if (window.audio) {
        window.audio.stopProgression();
        window.audio.stopRhythm();
        window.audio.stopMetronome();
      }

      if (this.beatSequencer) {
        this.beatSequencer.stop();
        this.highlightBeatStep(-1);
      }

      if (this.ribbonRenderer) {
        this.ribbonRenderer.setActiveStep(-1);
      }
      if (this.sheetMusicRenderer) {
        this.sheetMusicRenderer.setActiveStep(-1);
      }

      // Reset individual buttons
      const btnPlayProg = document.getElementById('btnPlayProgression');
      if (btnPlayProg) {
        btnPlayProg.textContent = '▶ Play Progression';
        btnPlayProg.classList.remove('btn-warning');
      }
      this.highlightTableRow(-1);

      const btnToggleBeat = document.getElementById('btnToggleBeat');
      if (btnToggleBeat) {
        btnToggleBeat.textContent = '▶ Play Beat';
        btnToggleBeat.classList.remove('btn-danger');
        btnToggleBeat.classList.add('btn-success');
      }
      const beatStatus = document.getElementById('beatStatusIndicator');
      if (beatStatus) beatStatus.textContent = 'Stopped';

      const btnPlayRhythm = document.getElementById('btnPlayRhythm');
      if (btnPlayRhythm) {
        this.updateRhythmPlayButtonState(false);
        this.highlightRhythmGlyph(-1);
      }
      const rhythmLoopStatus = document.getElementById('rhythmLoopStatus');
      if (rhythmLoopStatus) rhythmLoopStatus.style.display = 'none';

      const btnMetro = document.getElementById('btnToggleMetronome');
      if (btnMetro) {
        btnMetro.textContent = '▶ Start Metronome';
        btnMetro.classList.remove('btn-danger');
      }
    }

    async syncActiveJamTracks() {
      if (!this.isMasterJamPlaying) return;
      const bpm = this.getBpm();
      const trackChords = document.getElementById('jamTrackChords');
      const trackDrums = document.getElementById('jamTrackDrums');
      const trackClave = document.getElementById('jamTrackClave');
      const trackClick = document.getElementById('jamTrackClick');

      // Quantize to next downbeat
      const syncTime = (this.beatSequencer && this.beatSequencer.isPlaying)
        ? this.beatSequencer.getNextDownbeatAudioTime()
        : (((window.audio && window.audio.getAudioCurrentTime) ? window.audio.getAudioCurrentTime() : (window.audio && window.audio.ctx ? window.audio.ctx.currentTime : 0)) + 0.05);

      // Chords
      if (trackChords && trackChords.checked && !window.audio.isPlayingProgression) {
        window.audio.playProgression(this.parsedChords, bpm, true, (idx, c) => {
          this.highlightTableRow(idx);
          if (c && this.visualizer) this.visualizer.setActiveChord(c);
        }, null, syncTime);
      } else if (trackChords && !trackChords.checked && window.audio.isPlayingProgression) {
        window.audio.stopProgression();
        this.highlightTableRow(-1);
      }

      // Drums
      if (trackDrums && trackDrums.checked && this.beatSequencer && !this.beatSequencer.isPlaying) {
        this.beatSequencer.start((step) => this.highlightBeatStep(step), syncTime);
        if (this.visualizer) this.visualizer.startAnimation();
      } else if (trackDrums && !trackDrums.checked && this.beatSequencer && this.beatSequencer.isPlaying) {
        this.beatSequencer.stop();
        this.highlightBeatStep(-1);
        if (this.visualizer && (!window.audio || (!window.audio.isPlayingProgression && !window.audio.isPlayingMelodyProgression))) {
          this.visualizer.stopAnimation();
        }
      }

      // Clave
      if (trackClave && trackClave.checked && !window.audio.isRhythmPlaying) {
        window.audio.playRhythmSequence(this.currentRhythmItems, () => this.getBpm(), Infinity, (s) => this.highlightRhythmGlyph(s), null, null, syncTime);
      } else if (trackClave && !trackClave.checked && window.audio.isRhythmPlaying) {
        window.audio.stopRhythm();
        this.highlightRhythmGlyph(-1);
      }

      // Click
      if (trackClick && trackClick.checked && !window.audio.isMetronomeRunning) {
        const sig = this.getMetronomeTimeSignature ? this.getMetronomeTimeSignature() : { num: 4, den: 4 };
        window.audio.startMetronome(bpm, sig, 1, 'woodblock', (b) => this.updateMetronomeBeat(b));
      } else if (trackClick && !trackClick.checked && window.audio.isMetronomeRunning) {
        window.audio.stopMetronome();
      }
    }

    // -------------------------------------------------------------
    // Custom Groove Library & Persistence (localStorage + JSON)
    // -------------------------------------------------------------
    initGrooveManagement() {
      this.refreshSavedGroovesDropdown();

      const btnSave = document.getElementById('btnSaveUserGroove');
      const btnDelete = document.getElementById('btnDeleteUserGroove');
      const selectPreset = document.getElementById('beatPresetSelect');

      if (btnSave) {
        btnSave.addEventListener('click', () => {
          const sig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
          const defName = `Groove ${sig.num}/${sig.den} (${this.getBpm()} BPM)`;
          const name = prompt('Enter a name for this custom groove:', defName);
          if (name && name.trim()) {
            const saved = this.beatSequencer.saveUserGroove(name.trim());
            this.refreshSavedGroovesDropdown(saved.id);
          }
        });
      }

      if (btnDelete) {
        btnDelete.addEventListener('click', () => {
          if (!selectPreset || !selectPreset.value.startsWith('user_')) return;
          const id = selectPreset.value.replace('user_', '');
          if (confirm('Are you sure you want to delete this saved groove?')) {
            this.beatSequencer.deleteUserGroove(id);
            this.refreshSavedGroovesDropdown();
          }
        });
      }

      if (selectPreset) {
        selectPreset.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val && val.startsWith('user_')) {
            const id = val.replace('user_', '');
            const groove = this.beatSequencer.loadUserGroove(id);
            if (groove) {
              const beatTimeSigInput = document.getElementById('beatTimeSigInput');
              if (beatTimeSigInput) {
                beatTimeSigInput.value = `${groove.timeSignature.num}/${groove.timeSignature.den}`;
              }
              const swingSlider = document.getElementById('beatSwingSlider');
              const swingVal = document.getElementById('beatSwingValue');
              if (swingSlider && swingVal) {
                const pct = Math.round((groove.swing || 0) * 100);
                swingSlider.value = pct;
                swingVal.textContent = `${pct}%`;
              }
              if (btnDelete) btnDelete.style.display = 'inline-block';
              this.renderBeatGrid();
            }
          } else {
            if (btnDelete) btnDelete.style.display = 'none';
          }
        });
      }

      // Backup JSON
      const btnBackup = document.getElementById('btnBackupGroovesJson');
      if (btnBackup) {
        btnBackup.addEventListener('click', () => {
          const jsonStr = this.beatSequencer.exportUserGroovesJson();
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'my_saved_grooves.json';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 150);
        });
      }

      // Restore JSON
      const btnRestore = document.getElementById('btnRestoreGroovesJson');
      const fileInput = document.getElementById('groovesJsonFileInput');
      if (btnRestore && fileInput) {
        btnRestore.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            const text = re.target.result;
            const count = this.beatSequencer.importUserGroovesJson(text);
            if (count !== false) {
              alert(`Successfully imported ${count} grooves!`);
              this.refreshSavedGroovesDropdown();
            } else {
              alert('Could not parse grooves file. Please check the JSON format.');
            }
          };
          reader.readAsText(file);
          fileInput.value = '';
        });
      }
    }

    refreshSavedGroovesDropdown(selectedId = null) {
      const optgroup = document.getElementById('optgroupSavedGrooves');
      const btnDelete = document.getElementById('btnDeleteUserGroove');
      if (!optgroup || !this.beatSequencer) return;

      optgroup.innerHTML = '';
      const grooves = this.beatSequencer.getUserGrooves();

      if (grooves.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '(No saved grooves yet)';
        optgroup.appendChild(opt);
        if (btnDelete) btnDelete.style.display = 'none';
        return;
      }

      grooves.forEach(g => {
        const opt = document.createElement('option');
        opt.value = `user_${g.id}`;
        opt.textContent = `⭐ ${g.name} (${g.timeSignature.num}/${g.timeSignature.den})`;
        if (selectedId && g.id === selectedId) {
          opt.selected = true;
        }
        optgroup.appendChild(opt);
      });

      if (selectedId && btnDelete) {
        btnDelete.style.display = 'inline-block';
      }
    }

    // -------------------------------------------------------------
    // Standard MIDI File Studio (Export / Import for DAWs)
    // -------------------------------------------------------------
    initMidiExportImport() {
      // 1. Export Beat MIDI
      const btnExportBeat = document.getElementById('btnExportBeatMidi');
      if (btnExportBeat) {
        btnExportBeat.addEventListener('click', () => {
          if (!window.SongMidi || !this.beatSequencer) return;
          const sig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
          const bytes = window.SongMidi.exportBeatToMidi(this.beatSequencer, {
            loops: 2,
            title: `Drum Beat ${sig.num}_${sig.den}`
          });
          window.SongMidi.downloadMidiBlob(bytes, `beat_${sig.num}_${sig.den}_${this.getBpm()}bpm.mid`);
        });
      }

      // 2. Export Chords MIDI
      const btnExportChords = document.getElementById('btnExportChordsMidi');
      if (btnExportChords) {
        btnExportChords.addEventListener('click', () => {
          if (!window.SongMidi || !this.parsedChords || this.parsedChords.length === 0) {
            alert('Please analyze a chord progression first.');
            return;
          }
          const bpm = this.getBpm();
          const bytes = window.SongMidi.exportChordsToMidi(this.parsedChords, window.audio, {
            bpm,
            loops: 2,
            title: 'Chords (Song Analyzer)'
          });
          window.SongMidi.downloadMidiBlob(bytes, `chords_${bpm}bpm.mid`);
        });
      }

      // 3. Import Beat MIDI
      const btnImportBeat = document.getElementById('btnImportBeatMidi');
      const beatFileInput = document.getElementById('beatMidiFileInput');
      if (btnImportBeat && beatFileInput) {
        btnImportBeat.addEventListener('click', () => beatFileInput.click());
        beatFileInput.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            try {
              const buffer = re.target.result;
              const res = window.SongMidi.importMidiToBeat(buffer, this.beatSequencer);
              if (res) {
                if (res.bpm && this.setAppBpm) this.setAppBpm(res.bpm);
                const beatTimeSigInput = document.getElementById('beatTimeSigInput');
                if (beatTimeSigInput && res.timeSignature) {
                  beatTimeSigInput.value = `${res.timeSignature.num}/${res.timeSignature.den}`;
                }
                const presetSelect = document.getElementById('beatPresetSelect');
                if (presetSelect) presetSelect.value = '';
                this.renderBeatGrid();
                alert(`Imported MIDI drum beat! (${res.notesFound} notes mapped to ${res.stepCount} steps)`);
              }
            } catch (err) {
              console.error('Failed to import MIDI:', err);
              alert('Could not parse MIDI file. Make sure it is a valid Standard MIDI file (.mid).');
            }
          };
          reader.readAsArrayBuffer(file);
          beatFileInput.value = '';
        });
      }
    }

    initPWA() {
      // Register Service Worker for PWA standalone offline execution
      if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js')
            .then(reg => {
              console.log('SongAnalyzer PWA registered, scope:', reg.scope);
              reg.update().catch(() => {});
            })
            .catch(err => console.warn('PWA registration skipped:', err));
        });
      }
    }

    initWakeLock() {
      this.wakeLock = null;
      this.requestWakeLock = async () => {
        if ('wakeLock' in navigator && !this.wakeLock) {
          try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.wakeLock.addEventListener('release', () => {
              this.wakeLock = null;
            });
          } catch (e) {}
        }
      };

      this.releaseWakeLock = () => {
        if (this.wakeLock) {
          try {
            this.wakeLock.release().catch(() => {});
          } catch (e) {}
          this.wakeLock = null;
        }
      };

      // Re-acquire lock if tab was minimized and returned to foreground while playing
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const isPlaying = (window.audio && (window.audio.isPlayingProgression || window.audio.isMetronomeRunning)) ||
                            (this.beatSequencer && this.beatSequencer.isPlaying) ||
                            (window.tuner && window.tuner.isRunning) ||
                            (window.accuracyEngine && window.accuracyEngine.isRunning);
          if (isPlaying && this.requestWakeLock) {
            this.requestWakeLock();
          }
        }
      });
    }

    exportJamSessionMidi() {
      if (!window.SongMidi) return;
      const bpm = this.getBpm();
      const bytes = window.SongMidi.exportJamSessionToMidi({
        sequencer: this.beatSequencer,
        parsedChords: this.parsedChords,
        rhythmItems: this.currentRhythmItems,
        audioEngine: window.audio,
        bpm,
        loops: 2
      });
      window.SongMidi.downloadMidiBlob(bytes, `jam_session_${bpm}bpm.mid`);
    }
  }

  window.App = App;
  window.app = new App();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.app.init();
    });
  } else {
    window.app.init();
  }

})(typeof window !== 'undefined' ? window : globalThis);
