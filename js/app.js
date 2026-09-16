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
      this.analyzeProgression(); // Run default analysis on load
      this.dealJamCards();       // Deal initial jam cards
      this.generateRhythm();     // Generate initial rhythm
      this.initPracticeTimer();  // Initialize practice timer
      this.initBeatBuilder();    // Initialize adaptive grid drum machine
      this.initMasterJamTransport(); // Initialize master transport (Spacebar, Jam sync)
      this.initGrooveManagement();   // Initialize custom groove saving & library
      this.initMidiExportImport();   // Initialize MIDI export & import studio
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
        if (audio && audio.initialized && typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
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
        } else {
          document.body.classList.add('mobile-tab-view');
          allCards.forEach(card => {
            if (card.id === targetId) {
              card.classList.add('mobile-active-card');
            } else {
              card.classList.remove('mobile-active-card');
            }
          });

          if (targetId === 'visualizerSection' && this.visualizer) {
            setTimeout(() => this.visualizer.handleResize(), 50);
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
              },
              syncStartTime
            );
          } catch (err) {
            console.error('Error starting rhythm playback:', err);
            this.updateRhythmPlayButtonState(false);
            this.highlightRhythmGlyph(-1);
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

        tbody.appendChild(row);
      });
    }

    highlightTableRow(idx) {
      document.querySelectorAll('#harmonicTable tbody tr').forEach(tr => {
        if (parseInt(tr.dataset.index, 10) === idx) {
          tr.classList.add('table-row-active');
        } else {
          tr.classList.remove('table-row-active');
        }
      });
    }

    // 2. Modal Interchange Transformation
    transformModal() {
      const Theory = window.SongTheory;
      const audio = window.audio;
      if (!Theory) return;

      const tonic = document.getElementById('modalTonicInput').value.trim() || 'C';
      const rawDegrees = document.getElementById('modalDegreesInput').value.trim() || '1, 6, 4, 5';
      const degreesList = rawDegrees.split(/[\s,]+/).map(d => parseInt(d, 10)).filter(n => !isNaN(n));

      if (degreesList.length === 0) return;

      const results = Theory.transformProgressionModal(tonic, degreesList);
      const container = document.getElementById('modalResultsContainer');
      if (!container) return;
      container.innerHTML = '';

      results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'modal-tier-card';

        card.innerHTML = `
          <div class="modal-tier-header">
            <strong>${item.tierLabel}</strong>
            <button class="btn-sm btn-play-tier">▶ Audition</button>
          </div>
          <div class="modal-tier-chords">${item.progressionString}</div>
        `;

        card.querySelector('.btn-play-tier').addEventListener('click', async () => {
          if (!audio) return;
          await audio.init();
          const bpm = this.getBpm();
          const parsed = item.chords.map(c => Theory.parseChord(c)).filter(Boolean);
          audio.playProgression(parsed, bpm, false, null, null);
        });

        container.appendChild(card);
      });
    }

    // 3. Musician's Jam Deck (Card Game)
    dealJamCards() {
      const Theory = window.SongTheory;
      if (!Theory) return;

      const countEl = document.getElementById('jamCardCount');
      const numCards = countEl ? (parseInt(countEl.value, 10) || 4) : 4;
      const roots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
      const qualities = Theory.CHORD_QUALITIES;

      const newCards = [];
      for (let i = 0; i < numCards; i++) {
        if (this.lockedCards.has(i) && this.jamCards[i]) {
          newCards.push(this.jamCards[i]);
        } else {
          const root = roots[Math.floor(Math.random() * roots.length)];
          const quality = qualities[Math.floor(Math.random() * qualities.length)];
          const symbol = `${root}${quality.aliases[0] || ''}`;
          newCards.push({
            index: i,
            symbol,
            root,
            qualityName: quality.name,
            formula: quality.formula
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
            const temp = this.jamCards[idx];
            this.jamCards[idx] = this.jamCards[idx - 1];
            this.jamCards[idx - 1] = temp;
            this.renderJamCards();
          }
        });

        cardEl.querySelector('.btn-card-move-right').addEventListener('click', () => {
          if (idx < this.jamCards.length - 1) {
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
        'Smooth Cadence: Arrange the 4 cards so the final chord resolves seamlessly back into the first card in a loop.',
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
          const now = Tone.now();
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

    // 5. Rhythm Studio
    generateRhythm() {
      if (window.audio && window.audio.isRhythmPlaying) {
        window.audio.stopRhythm();
        this.updateRhythmPlayButtonState(false);
      }
      this.highlightRhythmGlyph(-1);

      const restsEl = document.getElementById('rhythmIncludeRests');
      const includeRests = restsEl ? restsEl.checked : true;
      const beats = 4;
      const targetTicks = beats * 32;

      const notePool = [
        { glyph: '𝅘𝅥', name: 'Quarter Note', value: 32, isRest: false },
        { glyph: '𝅘𝅥𝅮', name: 'Eighth Note', value: 16, isRest: false },
        { glyph: '𝅘𝅥𝅯', name: '16th Note', value: 8, isRest: false },
        { glyph: '𝅗𝅥', name: 'Half Note', value: 64, isRest: false }
      ];

      const restPool = [
        { glyph: '𝄽', name: 'Quarter Rest', value: 32, isRest: true },
        { glyph: '𝄾', name: 'Eighth Rest', value: 16, isRest: true },
        { glyph: '𝄿', name: '16th Rest', value: 8, isRest: true }
      ];

      const pool = includeRests ? [...notePool, ...restPool] : notePool;
      const items = [];
      let currentTicks = 0;

      while (currentTicks < targetTicks) {
        const remaining = targetTicks - currentTicks;
        const validOptions = pool.filter(p => p.value <= remaining);
        if (validOptions.length === 0) break;

        const pick = validOptions[Math.floor(Math.random() * validOptions.length)];
        items.push(pick);
        currentTicks += pick.value;
      }

      this.currentRhythmItems = items;
      const container = document.getElementById('rhythmGlyphDisplay');
      if (!container) return;
      container.innerHTML = '';

      items.forEach((item, idx) => {
        const span = document.createElement('span');
        span.className = 'rhythm-glyph';
        span.dataset.index = idx;
        span.textContent = item.glyph;
        span.title = item.name;
        container.appendChild(span);
      });
    }

    updateRhythmPlayButtonState(isPlaying) {
      const btn = document.getElementById('btnPlayRhythm');
      const statusBadge = document.getElementById('rhythmLoopStatus');
      if (btn) {
        if (isPlaying) {
          btn.textContent = '⏹ Stop';
          btn.classList.remove('btn-success');
          btn.classList.add('btn-danger');
        } else {
          btn.textContent = '▶ Play Clave';
          btn.classList.remove('btn-danger');
          btn.classList.add('btn-success');
        }
      }
      if (!isPlaying && statusBadge) {
        statusBadge.style.display = 'none';
      }
    }

    highlightRhythmGlyph(idx) {
      document.querySelectorAll('.rhythm-glyph').forEach((el, i) => {
        if (i === idx) el.classList.add('active');
        else el.classList.remove('active');
      });
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

      const now = Tone.now();
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
      this.beatSequencer.setBpm(this.getBpm());

      // Load initial default groove (self-configures 4/4 16 steps)
      this.beatSequencer.loadPreset('rock');

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
      if (typeof Tone !== 'undefined') {
        if (typeof Tone.start === 'function') await Tone.start();
        if (Tone.context && typeof Tone.context.resume === 'function' && Tone.context.state !== 'running') {
          await Tone.context.resume();
        }
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
      } else if (typeof Tone !== 'undefined' && Tone.context) {
        ctx = Tone.context.rawContext || Tone.context;
      } else if (typeof AudioContext !== 'undefined') {
        ctx = new AudioContext();
      }

      if (ctx) {
        const dest = (window.audio && window.audio.masterVolume)
          ? window.audio.masterVolume
          : (typeof Tone !== 'undefined' && Tone.getDestination ? Tone.getDestination() : ctx.destination);
        this.drumSynth.init(ctx, dest);
      }
    }

    renderBeatGrid() {
      const container = document.getElementById('beatGridContainer');
      if (!container || !this.beatSequencer) return;

      const stepCount = this.beatSequencer.getStepCount();
      const sig = this.beatSequencer.timeSignature || { num: 4, den: 4 };
      const subdiv = this.beatSequencer.subdivision || 4;

      // Update Grouping Badge (e.g. "7/8 • 14 Steps")
      const badge = document.getElementById('beatGroupingBadge');
      if (badge) {
        badge.textContent = `${sig.num}/${sig.den} • ${stepCount} Steps`;
      }

      container.innerHTML = '';

      // 1. Header row with step numbers and downbeats
      const headerRow = document.createElement('div');
      headerRow.className = 'beat-step-header-row';

      const headerSpacer = document.createElement('div');
      headerSpacer.className = 'beat-step-header-spacer';
      headerRow.appendChild(headerSpacer);

      for (let s = 0; s < stepCount; s++) {
        const numEl = document.createElement('span');
        numEl.className = 'beat-step-num';
        const isDownbeat = (s % subdiv === 0);
        if (isDownbeat) {
          numEl.classList.add('is-downbeat');
          numEl.textContent = `${Math.floor(s / subdiv) + 1}`;
        } else {
          numEl.textContent = `${s + 1}`;
        }
        headerRow.appendChild(numEl);
      }
      container.appendChild(headerRow);

      // 2. Tracks rows (Kick, Snare, Closed Hat, Open Hat, Ride, Crash, Cowbell, Clap, Clave)
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

          const state = this.beatSequencer.pattern[track.id] ? this.beatSequencer.pattern[track.id][s] : 0;
          this.applyPadStateClass(pad, state);

          pad.addEventListener('click', async () => {
            const nextState = this.beatSequencer.cycleStep(track.id, s);
            this.applyPadStateClass(pad, nextState);
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
    }

    applyPadStateClass(pad, state) {
      pad.classList.remove('state-normal', 'state-accent', 'state-ghost');
      if (state === 1) pad.classList.add('state-normal');
      else if (state === 2) pad.classList.add('state-accent');
      else if (state === 3) pad.classList.add('state-ghost');
    }

    highlightBeatStep(stepIdx) {
      const pads = document.querySelectorAll('.beat-pad.active-cursor');
      pads.forEach(p => p.classList.remove('active-cursor'));

      if (stepIdx >= 0) {
        const currentPads = document.querySelectorAll(`.beat-pad[data-step="${stepIdx}"]`);
        currentPads.forEach(p => p.classList.add('active-cursor'));
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

      // Start all tracks locked to exact same audio timestamp
      const startTime = Tone.now() + 0.08;

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

      if (window.audio) {
        window.audio.stopProgression();
        window.audio.stopRhythm();
        window.audio.stopMetronome();
      }

      if (this.beatSequencer) {
        this.beatSequencer.stop();
        this.highlightBeatStep(-1);
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
        : (Tone.now() + 0.05);

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
      } else if (trackDrums && !trackDrums.checked && this.beatSequencer && this.beatSequencer.isPlaying) {
        this.beatSequencer.stop();
        this.highlightBeatStep(-1);
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
