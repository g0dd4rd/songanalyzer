// Song Analyzer - Base-12 Music Theory & Harmony Engine
// Classic JS Module (works offline over file:// with zero server requirements)

(function(window) {
  'use strict';

  const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const INTERVAL_NAMES = [
    'Root (1)', 'Minor 2nd (b2)', 'Major 2nd (2)', 'Minor 3rd (b3)',
    'Major 3rd (3)', 'Perfect 4th (4)', 'Tritone (b5/#4)', 'Perfect 5th (5)',
    'Minor 6th (b6)', 'Major 6th (6)', 'Minor 7th (b7)', 'Major 7th (7)'
  ];

  const INTERVAL_SHORT = [
    '1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'
  ];

  // Note name to pitch class (0-11)
  function noteToPitchClass(noteStr) {
    if (!noteStr || typeof noteStr !== 'string') return null;
    const cleaned = noteStr.trim();
    const match = cleaned.match(/^([A-Ga-g])([#b♯♭x]*)/);
    if (!match) return null;

    const letter = match[1].toUpperCase();
    const acc = match[2];

    const baseValues = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    let pc = baseValues[letter];
    if (pc === undefined) return null;

    for (let i = 0; i < acc.length; i++) {
      const char = acc[i];
      if (char === '#' || char === '♯') pc += 1;
      else if (char === 'b' || char === '♭') pc -= 1;
      else if (char === 'x') pc += 2;
    }

    return (pc % 12 + 12) % 12;
  }

  // Convert pitch class to preferred note name based on key context or accidentals
  function pitchClassToNote(pc, preferFlats = false) {
    const normPC = (pc % 12 + 12) % 12;
    return preferFlats ? NOTE_NAMES_FLAT[normPC] : NOTE_NAMES_SHARP[normPC];
  }

  const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_NATURAL_PC = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

  // Spells a note enharmonically based on its root letter and scale degree step
  function spellIntervalNote(root, degree, pc) {
    if (!root || typeof root !== 'string') return pitchClassToNote(pc);
    const rootLetter = root.charAt(0).toUpperCase();
    const rootIdx = NOTE_LETTERS.indexOf(rootLetter);
    if (rootIdx === -1) return pitchClassToNote(pc);

    const targetLetter = NOTE_LETTERS[(rootIdx + (degree - 1)) % 7];
    const naturalPC = LETTER_NATURAL_PC[targetLetter];
    let diff = (pc - naturalPC + 12) % 12;
    if (diff > 6) diff -= 12; // -1 = b, -2 = bb, +1 = #, +2 = ##

    if (diff === 0) return targetLetter;
    if (diff === 1) return targetLetter + '#';
    if (diff === 2) return targetLetter + '##';
    if (diff === -1) return targetLetter + 'b';
    if (diff === -2) return targetLetter + 'bb';
    return targetLetter;
  }

  // Full Chord Definitions & Formulas
  // Full Chord Definitions & Formulas
  const CHORD_QUALITIES = [
    // Triads
    { id: 'maj', name: 'Major', formula: '1 - 3 - 5', intervals: [0, 4, 7], degrees: [1, 3, 5], aliases: ['', 'maj', 'M'] },
    { id: 'min', name: 'Minor', formula: '1 - b3 - 5', intervals: [0, 3, 7], degrees: [1, 3, 5], aliases: ['m', 'min', '-'] },
    { id: 'dim', name: 'Diminished', formula: '1 - b3 - b5', intervals: [0, 3, 6], degrees: [1, 3, 5], aliases: ['dim', '°', 'o'] },
    { id: 'aug', name: 'Augmented', formula: '1 - 3 - #5', intervals: [0, 4, 8], degrees: [1, 3, 5], aliases: ['aug', '+'] },
    { id: 'sus2', name: 'Suspended 2nd', formula: '1 - 2 - 5', intervals: [0, 2, 7], degrees: [1, 2, 5], aliases: ['sus2'] },
    { id: 'sus4', name: 'Suspended 4th', formula: '1 - 4 - 5', intervals: [0, 5, 7], degrees: [1, 4, 5], aliases: ['sus4', 'sus'] },
    { id: '5', name: 'Power Chord', formula: '1 - 5', intervals: [0, 7], degrees: [1, 5], aliases: ['5'] },

    // 7th Chords
    { id: '7', name: 'Dominant 7th', formula: '1 - 3 - 5 - b7', intervals: [0, 4, 7, 10], degrees: [1, 3, 5, 7], aliases: ['7', 'dom7'] },
    { id: 'maj7', name: 'Major 7th', formula: '1 - 3 - 5 - 7', intervals: [0, 4, 7, 11], degrees: [1, 3, 5, 7], aliases: ['maj7', 'M7', 'Δ7', 'Δ'] },
    { id: 'm7', name: 'Minor 7th', formula: '1 - b3 - 5 - b7', intervals: [0, 3, 7, 10], degrees: [1, 3, 5, 7], aliases: ['m7', 'min7', '-7'] },
    { id: 'mMaj7', name: 'Minor-Major 7th', formula: '1 - b3 - 5 - 7', intervals: [0, 3, 7, 11], degrees: [1, 3, 5, 7], aliases: ['mMaj7', 'mM7', 'minmaj7', '-Δ7', 'm(maj7)'] },
    { id: 'm7b5', name: 'Half-Diminished 7th', formula: '1 - b3 - b5 - b7', intervals: [0, 3, 6, 10], degrees: [1, 3, 5, 7], aliases: ['m7b5', 'ø7', 'ø', 'hdim7', 'hdim'] },
    { id: 'dim7', name: 'Diminished 7th', formula: '1 - b3 - b5 - bb7', intervals: [0, 3, 6, 9], degrees: [1, 3, 5, 7], aliases: ['dim7', '°7', 'o7'] },
    { id: 'aug7', name: 'Augmented 7th', formula: '1 - 3 - #5 - b7', intervals: [0, 4, 8, 10], degrees: [1, 3, 5, 7], aliases: ['aug7', '7#5', '7+'] },
    { id: '7sus4', name: 'Dominant 7th Sus4', formula: '1 - 4 - 5 - b7', intervals: [0, 5, 7, 10], degrees: [1, 4, 5, 7], aliases: ['7sus4', '7sus'] },
    { id: '7b5', name: 'Dominant 7th b5', formula: '1 - 3 - b5 - b7', intervals: [0, 4, 6, 10], degrees: [1, 3, 5, 7], aliases: ['7b5', '7(b5)', '7-5'] },

    // 6th Chords
    { id: '6', name: 'Major 6th', formula: '1 - 3 - 5 - 6', intervals: [0, 4, 7, 9], degrees: [1, 3, 5, 6], aliases: ['6', 'maj6', 'M6'] },
    { id: 'm6', name: 'Minor 6th', formula: '1 - b3 - 5 - 6', intervals: [0, 3, 7, 9], degrees: [1, 3, 5, 6], aliases: ['m6', 'min6', '-6'] },
    { id: '69', name: 'Major 6/9', formula: '1 - 3 - 5 - 6 - 9', intervals: [0, 4, 7, 9, 14], degrees: [1, 3, 5, 6, 2], aliases: ['6/9', '69', 'maj6/9', '6add9'] },
    { id: 'm69', name: 'Minor 6/9', formula: '1 - b3 - 5 - 6 - 9', intervals: [0, 3, 7, 9, 14], degrees: [1, 3, 5, 6, 2], aliases: ['m6/9', 'm69', 'min6/9', 'm6add9'] },

    // 9th Chords & Added 9ths
    { id: '9', name: 'Dominant 9th', formula: '1 - 3 - 5 - b7 - 9', intervals: [0, 4, 7, 10, 14], degrees: [1, 3, 5, 7, 2], aliases: ['9', 'dom9'] },
    { id: 'maj9', name: 'Major 9th', formula: '1 - 3 - 5 - 7 - 9', intervals: [0, 4, 7, 11, 14], degrees: [1, 3, 5, 7, 2], aliases: ['maj9', 'M9', 'Δ9'] },
    { id: 'm9', name: 'Minor 9th', formula: '1 - b3 - 5 - b7 - 9', intervals: [0, 3, 7, 10, 14], degrees: [1, 3, 5, 7, 2], aliases: ['m9', 'min9', '-9'] },
    { id: 'add9', name: 'Add 9', formula: '1 - 3 - 5 - 9', intervals: [0, 4, 7, 14], degrees: [1, 3, 5, 2], aliases: ['add9', '2', 'add2'] },
    { id: 'madd9', name: 'Minor Add 9', formula: '1 - b3 - 5 - 9', intervals: [0, 3, 7, 14], degrees: [1, 3, 5, 2], aliases: ['madd9', 'm(add9)', 'minadd9', '-add9'] },
    { id: '7b9', name: '7 flat 9', formula: '1 - 3 - 5 - b7 - b9', intervals: [0, 4, 7, 10, 13], degrees: [1, 3, 5, 7, 2], aliases: ['7b9', '7(b9)', 'dom7b9'] },
    { id: '7#9', name: '7 sharp 9 (Hendrix)', formula: '1 - 3 - 5 - b7 - #9', intervals: [0, 4, 7, 10, 15], degrees: [1, 3, 5, 7, 2], aliases: ['7#9', '7(#9)', 'dom7#9'] },

    // 11th & Altered 11th Chords
    { id: 'maj7#11', name: 'Major 7th #11 (Lydian)', formula: '1 - 3 - 5 - 7 - #11', intervals: [0, 4, 7, 11, 18], degrees: [1, 3, 5, 7, 4], aliases: ['maj7#11', 'maj7(#11)', 'M7#11', 'M7(#11)', 'Δ7#11', 'Δ7(#11)', 'Δ#11', 'maj7b5', 'maj7(b5)', 'maj9#11', 'maj9(#11)'] },
    { id: '7#11', name: 'Dominant 7th #11 (Lydian Dominant)', formula: '1 - 3 - 5 - b7 - #11', intervals: [0, 4, 7, 10, 18], degrees: [1, 3, 5, 7, 4], aliases: ['7#11', '7(#11)', '9#11', '9(#11)'] },
    { id: '11', name: 'Dominant 11th', formula: '1 - 3 - 5 - b7 - 9 - 11', intervals: [0, 4, 7, 10, 14, 17], degrees: [1, 3, 5, 7, 2, 4], aliases: ['11', 'dom11'] },
    { id: 'maj11', name: 'Major 11th', formula: '1 - 3 - 5 - 7 - 9 - 11', intervals: [0, 4, 7, 11, 14, 17], degrees: [1, 3, 5, 7, 2, 4], aliases: ['maj11', 'M11', 'Δ11'] },
    { id: 'm11', name: 'Minor 11th', formula: '1 - b3 - 5 - b7 - 9 - 11', intervals: [0, 3, 7, 10, 14, 17], degrees: [1, 3, 5, 7, 2, 4], aliases: ['m11', 'min11', '-11'] },
    { id: 'add11', name: 'Add 11', formula: '1 - 3 - 5 - 11', intervals: [0, 4, 7, 17], degrees: [1, 3, 5, 4], aliases: ['add11', '4', 'add4'] },
    { id: 'madd11', name: 'Minor Add 11', formula: '1 - b3 - 5 - 11', intervals: [0, 3, 7, 17], degrees: [1, 3, 5, 4], aliases: ['madd11', 'm(add11)', 'minadd11', '-add11'] },

    // 13th & Altered 13th Chords
    { id: '13', name: 'Dominant 13th', formula: '1 - 3 - 5 - b7 - 9 - 13', intervals: [0, 4, 7, 10, 14, 21], degrees: [1, 3, 5, 7, 2, 6], aliases: ['13', 'dom13'] },
    { id: 'maj13', name: 'Major 13th', formula: '1 - 3 - 5 - 7 - 9 - 13', intervals: [0, 4, 7, 11, 14, 21], degrees: [1, 3, 5, 7, 2, 6], aliases: ['maj13', 'M13', 'Δ13'] },
    { id: 'm13', name: 'Minor 13th', formula: '1 - b3 - 5 - b7 - 9 - 13', intervals: [0, 3, 7, 10, 14, 21], degrees: [1, 3, 5, 7, 2, 6], aliases: ['m13', 'min13', '-13'] },
    { id: '7b13', name: 'Dominant 7th b13', formula: '1 - 3 - 5 - b7 - b13', intervals: [0, 4, 7, 10, 20], degrees: [1, 3, 5, 7, 6], aliases: ['7b13', '7(b13)'] },
    { id: 'add13', name: 'Add 13', formula: '1 - 3 - 5 - 13', intervals: [0, 4, 7, 21], degrees: [1, 3, 5, 6], aliases: ['add13'] },
    { id: 'madd13', name: 'Minor Add 13', formula: '1 - b3 - 5 - 13', intervals: [0, 3, 7, 21], degrees: [1, 3, 5, 6], aliases: ['madd13', 'm(add13)'] },

    // Other Altered & Augmented Chords
    { id: 'maj7#5', name: 'Augmented Major 7th', formula: '1 - 3 - #5 - 7', intervals: [0, 4, 8, 11], degrees: [1, 3, 5, 7], aliases: ['maj7#5', 'maj7(#5)', 'M7#5', 'Δ#5', 'augMaj7', '+maj7'] },
    { id: 'alt', name: 'Altered Dominant', formula: '1 - 3 - b5 - b7 - b9', intervals: [0, 4, 6, 10, 13], degrees: [1, 3, 5, 7, 2], aliases: ['7alt', 'alt'] }
  ];

  // Universal Chord Symbol Parser (Modular Base + Alterations & Additions Engine)
  function parseChord(symbol) {
    if (!symbol || typeof symbol !== 'string') return null;
    let s = symbol.trim();
    if (!s) return null;

    let bassNote = null;
    let bassPC = null;
    const slashIdx = s.lastIndexOf('/');
    if (slashIdx !== -1) {
      const potentialBass = s.slice(slashIdx + 1).trim();
      if (/^[A-Ga-g][#b♯♭]?$/.test(potentialBass)) {
        bassNote = potentialBass.charAt(0).toUpperCase() + potentialBass.slice(1).replace('♯', '#').replace('♭', 'b');
        bassPC = noteToPitchClass(bassNote);
        s = s.slice(0, slashIdx).trim();
      }
    }

    const match = s.match(/^([A-Ga-g][#b♯♭]?)(.*)$/);
    if (!match) return null;

    const rawRoot = match[1];
    const root = rawRoot.charAt(0).toUpperCase() + rawRoot.slice(1).replace('♯', '#').replace('♭', 'b');
    const rootPC = noteToPitchClass(root);
    if (rootPC === null) return null;

    let suffix = match[2].trim();

    // Sort qualities by longest alias length descending
    const sortedQualities = [...CHORD_QUALITIES].sort((a, b) => {
      const maxA = Math.max(...a.aliases.map(x => x.length));
      const maxB = Math.max(...b.aliases.map(x => x.length));
      return maxB - maxA;
    });

    let baseQuality = null;
    let modStr = '';

    // Pass 1: Exact case matching (preserves M vs m: e.g. M7 vs m7, M11 vs m11)
    for (const q of sortedQualities) {
      for (const alias of q.aliases) {
        if (alias && suffix.startsWith(alias)) {
          baseQuality = q;
          modStr = suffix.slice(alias.length);
          break;
        }
      }
      if (baseQuality) break;
    }

    // Pass 2: Case-insensitive fallback (guarding against M vs m collisions)
    if (!baseQuality) {
      const suffixLower = suffix.toLowerCase();
      for (const q of sortedQualities) {
        for (const alias of q.aliases) {
          if (alias && suffixLower.startsWith(alias.toLowerCase())) {
            if ((alias.startsWith('M') && suffix.startsWith('m')) || (alias.startsWith('m') && suffix.startsWith('M'))) {
              continue;
            }
            baseQuality = q;
            modStr = suffix.slice(alias.length);
            break;
          }
        }
        if (baseQuality) break;
      }
    }

    // Default to Major triad if no prefix matched
    if (!baseQuality) {
      baseQuality = CHORD_QUALITIES.find(q => q.id === 'maj');
      modStr = suffix;
    }

    let intervals = [...baseQuality.intervals];
    let degrees = [...baseQuality.degrees];
    let formulaTokens = baseQuality.formula ? baseQuality.formula.split(/\s*-\s*/) : ['1', '3', '5'];
    const appliedModifierLabels = [];

    function applyDegree(deg, semitones, label) {
      const existingIdx = degrees.indexOf(deg);
      if (existingIdx !== -1) {
        intervals[existingIdx] = semitones;
        formulaTokens[existingIdx] = label;
      } else {
        degrees.push(deg);
        intervals.push(semitones);
        formulaTokens.push(label);
      }
      appliedModifierLabels.push(label);
    }

    function removeDegree(deg, label) {
      const idx = degrees.indexOf(deg);
      if (idx !== -1) {
        degrees.splice(idx, 1);
        intervals.splice(idx, 1);
        formulaTokens.splice(idx, 1);
      }
      appliedModifierLabels.push(label);
    }

    // Tokenize modifier string (clean out brackets, parentheses, commas, slashes)
    const cleanMods = modStr.replace(/[()[\],]/g, ' ').trim();
    if (cleanMods) {
      const modTokens = [...cleanMods.matchAll(/([#b♯♭+-]?)(add|no)?(\d+|alt)/gi)].map(m => m[0]);

      modTokens.forEach(tok => {
        const t = tok.toLowerCase().replace('♯', '#').replace('♭', 'b');

        // Degree 2 / 9
        if (t === 'b9' || t === '-9') {
          applyDegree(2, 13, 'b9');
        } else if (t === '#9' || t === '+9') {
          applyDegree(2, 15, '#9');
        } else if (t === '9' || t === 'add9' || t === '2' || t === 'add2') {
          applyDegree(2, 14, t.includes('add') || t === '2' ? 'add9' : '9');
        }
        // Degree 4 / 11
        else if (t === 'b11' || t === '-11') {
          applyDegree(4, 16, 'b11');
        } else if (t === '#11' || t === '+11') {
          applyDegree(4, 18, '#11');
        } else if (t === '11' || t === 'add11' || t === '4' || t === 'add4') {
          applyDegree(4, 17, t.includes('add') || t === '4' ? 'add11' : '11');
        }
        // Degree 5
        else if (t === 'b5' || t === '-5') {
          applyDegree(5, 6, 'b5');
        } else if (t === '#5' || t === '+5') {
          applyDegree(5, 8, '#5');
        } else if (t === 'no5') {
          removeDegree(5, 'no5');
        }
        // Degree 3
        else if (t === 'no3') {
          removeDegree(3, 'no3');
        } else if (t === 'sus4' || t === 'sus') {
          applyDegree(4, 5, '4');
          removeDegree(3, 'sus4');
        } else if (t === 'sus2') {
          applyDegree(2, 2, '2');
          removeDegree(3, 'sus2');
        }
        // Degree 6 / 13
        else if (t === 'b13' || t === '-13' || t === 'b6' || t === 'addb6') {
          applyDegree(6, 20, 'b13');
        } else if (t === '#13' || t === '+13') {
          applyDegree(6, 22, '#13');
        } else if (t === '13' || t === 'add13' || t === '6' || t === 'add6') {
          applyDegree(6, 21, t.includes('add') || t === '6' ? 'add13' : '13');
        }
        // Altered
        else if (t === 'alt') {
          applyDegree(5, 6, 'b5');
          applyDegree(7, 10, 'b7');
          applyDegree(2, 13, 'b9');
        }
      });
    }

    // Sort chord tones harmonically: root (1), 3, 5, 7, 9 (2), 11 (4), 13 (6)
    const degOrder = { 1: 1, 3: 2, 5: 3, 7: 4, 2: 5, 4: 6, 6: 7 };
    const combined = degrees.map((d, i) => ({
      deg: d,
      interval: intervals[i],
      token: formulaTokens[i] || `${d}`
    })).sort((a, b) => (degOrder[a.deg] || 99) - (degOrder[b.deg] || 99));

    const finalDegrees = combined.map(c => c.deg);
    const finalIntervals = combined.map(c => c.interval);
    const finalFormula = combined.map(c => c.token).join(' - ');

    const pitchClasses = finalIntervals.map(i => (rootPC + i) % 12);
    const notes = finalIntervals.map((i, idx) => spellIntervalNote(root, finalDegrees[idx], (rootPC + i) % 12));

    const qualityName = appliedModifierLabels.length > 0
      ? `${baseQuality.name} (${appliedModifierLabels.join(', ')})`
      : baseQuality.name;

    return {
      rawSymbol: symbol,
      root,
      rootPC,
      bassNote,
      bassPC: bassPC !== null ? bassPC : rootPC,
      quality: baseQuality,
      qualityId: baseQuality.id,
      qualityName,
      formula: finalFormula,
      intervals: finalIntervals,
      degrees: finalDegrees,
      pitchClasses,
      notes,
      modifierLabels: appliedModifierLabels,
      displayName: `${root}${suffix}${bassNote ? '/' + bassNote : ''}`
    };
  }

  // Diatonic Modes & Scales Definitions
  const SCALE_DEFINITIONS = {
    'ionian': { name: 'Ionian (Major)', intervals: [0, 2, 4, 5, 7, 9, 11], mood: 'Calm Stability / Bright' },
    'dorian': { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], mood: 'Soulful / Jazzy Minor' },
    'phrygian': { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], mood: 'Suspensive Desolation / Spanish' },
    'lydian': { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], mood: 'Euphoric Transcendence / Dreamy' },
    'mixolydian': { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], mood: 'Grounded Warmth / Bluesy' },
    'aeolian': { name: 'Aeolian (Natural Minor)', intervals: [0, 2, 3, 5, 7, 8, 10], mood: 'Bittersweet Nostalgia / Melancholy' },
    'locrian': { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], mood: 'Dread & Grief / Tense' },
    'harmonic_minor': { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], mood: 'Exotic / Dramatic' },
    'melodic_minor': { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], mood: 'Sophisticated / Jazz Minor' },
    'pentatonic_major': { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], mood: 'Open / Pure / Folk' },
    'pentatonic_minor': { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], mood: 'Blues / Rock Soul' },
    'blues': { name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10], mood: 'Gritty / Blues' }
  };

  // Key Detection Algorithm
  function detectKeys(parsedChords) {
    if (!parsedChords || parsedChords.length === 0) return [];

    const pcSet = new Set();
    const rootOccurrences = {};

    parsedChords.forEach((c, index) => {
      c.pitchClasses.forEach(pc => pcSet.add(pc));
      const weight = (index === 0 || index === parsedChords.length - 1) ? 2 : 1;
      rootOccurrences[c.rootPC] = (rootOccurrences[c.rootPC] || 0) + weight;
    });

    const totalNotes = pcSet.size;
    if (totalNotes === 0) return [];

    const candidates = [];

    // Test Major keys (all 12 roots)
    for (let rootPC = 0; rootPC < 12; rootPC++) {
      const majorScalePCs = SCALE_DEFINITIONS.ionian.intervals.map(i => (rootPC + i) % 12);
      let matchedPCs = 0;
      pcSet.forEach(pc => {
        if (majorScalePCs.includes(pc)) matchedPCs++;
      });

      let score = (matchedPCs / totalNotes) * 80;
      if (rootOccurrences[rootPC]) {
        score += Math.min(rootOccurrences[rootPC] * 5, 20);
      }

      const preferFlats = [5, 10, 3, 8, 1].includes(rootPC);
      const keyName = `${pitchClassToNote(rootPC, preferFlats)} Major`;

      candidates.push({
        type: 'major',
        rootPC,
        scaleType: 'ionian',
        keyName,
        matchedPCs,
        totalNotes,
        score: Math.min(Math.round(score), 100),
        scalePCs: majorScalePCs
      });
    }

    // Test Minor keys (Aeolian & Harmonic Minor - all 12 roots)
    for (let rootPC = 0; rootPC < 12; rootPC++) {
      const naturalMinorPCs = SCALE_DEFINITIONS.aeolian.intervals.map(i => (rootPC + i) % 12);
      const leadingTone = (rootPC + 11) % 12;
      const raised6 = (rootPC + 9) % 12;

      let matchedPCs = 0;
      pcSet.forEach(pc => {
        if (naturalMinorPCs.includes(pc) || pc === leadingTone || pc === raised6) matchedPCs++;
      });

      let score = (matchedPCs / totalNotes) * 80;
      if (rootOccurrences[rootPC]) {
        score += Math.min(rootOccurrences[rootPC] * 6, 20);
      }

      const preferFlats = [5, 10, 3, 8, 1, 0, 2].includes(rootPC);
      const keyName = `${pitchClassToNote(rootPC, preferFlats)} Minor`;

      candidates.push({
        type: 'minor',
        rootPC,
        scaleType: 'aeolian',
        keyName,
        matchedPCs,
        totalNotes,
        score: Math.min(Math.round(score), 100),
        scalePCs: [...naturalMinorPCs, leadingTone]
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  // Roman Numeral & Scale Degree Analysis
  function analyzeChordInKey(chord, keyCandidate) {
    const rootOffset = (chord.rootPC - keyCandidate.rootPC + 12) % 12;
    const isMajorKey = keyCandidate.type === 'major';

    let romanNumeral = '';
    let degreeName = '';
    let harmonicFunction = 'Non-Diatonic';
    let isDiatonic = false;

    const majorKeyDegrees = {
      0: { roman: 'I', name: '1st (Tonic)', diatonicQuality: ['maj', 'maj7', 'maj9', 'maj11', 'maj13', 'maj7#11', 'add9', '6', '69'] },
      1: { roman: 'bII', name: 'b2nd (Neapolitan)', diatonicQuality: [] },
      2: { roman: 'ii', name: '2nd (Supertonic)', diatonicQuality: ['min', 'm7', 'm9', 'm11', 'm13', 'sus4'] },
      3: { roman: 'bIII', name: 'b3rd (Borrowed Mediant)', diatonicQuality: [] },
      4: { roman: 'iii', name: '3rd (Mediant)', diatonicQuality: ['min', 'm7', 'm11'] },
      5: { roman: 'IV', name: '4th (Subdominant)', diatonicQuality: ['maj', 'maj7', 'maj9', 'maj11', 'maj13', 'maj7#11', 'add9', '6', '69'] },
      6: { roman: '#IV/bV', name: '#4/b5 (Tritone Sub / Altered)', diatonicQuality: [] },
      7: { roman: 'V', name: '5th (Dominant)', diatonicQuality: ['maj', '7', '9', '11', '13', 'sus4', '7b9', '7#9', '7#11', '7b13', 'alt'] },
      8: { roman: 'bVI', name: 'b6th (Submediant Borrowed)', diatonicQuality: [] },
      9: { roman: 'vi', name: '6th (Submediant)', diatonicQuality: ['min', 'm7', 'm9', 'm11'] },
      10: { roman: 'bVII', name: 'b7th (Subtonic Borrowed)', diatonicQuality: [] },
      11: { roman: 'vii°', name: '7th (Leading Tone)', diatonicQuality: ['dim', 'm7b5', 'dim7'] }
    };

    const minorKeyDegrees = {
      0: { roman: 'i', name: '1st (Tonic)', diatonicQuality: ['min', 'm7', 'm9', 'm11', 'mMaj7', 'm6', 'm69'] },
      1: { roman: 'bII', name: 'b2nd (Neapolitan)', diatonicQuality: ['maj', 'maj7'] },
      2: { roman: 'ii°', name: '2nd (Supertonic)', diatonicQuality: ['dim', 'm7b5', 'm11'] },
      3: { roman: 'bIII', name: 'b3rd (Relative Major)', diatonicQuality: ['maj', 'maj7', 'maj9', 'maj7#11'] },
      4: { roman: 'III', name: '3rd (Major Mediant)', diatonicQuality: ['maj', '7'] },
      5: { roman: 'iv', name: '4th (Subdominant)', diatonicQuality: ['min', 'm7', 'm9', 'm11'] },
      6: { roman: '#iv/bV', name: '#4th/b5 (Tritone Sub)', diatonicQuality: ['dim', '7', 'm7b5'] },
      7: { roman: 'V', name: '5th (Dominant)', diatonicQuality: ['maj', '7', '9', '11', '13', '7b9', '7#9', '7#11', '7b13', 'alt', 'min', 'm7'] },
      8: { roman: 'bVI', name: 'b6th (Submediant)', diatonicQuality: ['maj', 'maj7', 'maj9', 'maj7#11'] },
      9: { roman: 'vi°', name: '6th (Dorian Raised 6th)', diatonicQuality: ['dim', 'm7b5', 'maj', '7'] },
      10: { roman: 'bVII', name: 'b7th (Subtonic)', diatonicQuality: ['maj', '7', '9', '13'] },
      11: { roman: 'vii°', name: '7th (Leading Tone Harmonic)', diatonicQuality: ['dim', 'dim7', 'm7b5'] }
    };

    const degreeInfo = isMajorKey ? majorKeyDegrees[rootOffset] : (minorKeyDegrees[rootOffset] || majorKeyDegrees[rootOffset]);

    if (degreeInfo) {
      romanNumeral = degreeInfo.roman;
      degreeName = degreeInfo.name;

      // If the chord has a natural 5th, strip degree dim mark (e.g. Dm7 in minor key is ii7, not ii°7)
      if (chord.intervals && chord.intervals.includes(7) && !['dim', 'm7b5', 'dim7'].includes(chord.qualityId)) {
        romanNumeral = romanNumeral.replace('°', '');
      }

      const candidateScalePCs = keyCandidate.scalePCs || (isMajorKey 
        ? SCALE_DEFINITIONS.ionian.intervals.map(i => (keyCandidate.rootPC + i) % 12)
        : SCALE_DEFINITIONS.aeolian.intervals.map(i => (keyCandidate.rootPC + i) % 12));

      const isQualityDiatonic = degreeInfo.diatonicQuality.includes(chord.qualityId);
      const allNotesInKey = chord.pitchClasses.every(pc => candidateScalePCs.includes(pc));

      if (allNotesInKey || isQualityDiatonic) {
        isDiatonic = true;
        if (rootOffset === 0) harmonicFunction = 'Tonic (Home)';
        else if (rootOffset === 7) harmonicFunction = 'Dominant (Tension)';
        else if (rootOffset === 5) harmonicFunction = 'Subdominant (Preparation)';
        else if (rootOffset === 2) harmonicFunction = 'Pre-Dominant (ii)';
        else if (rootOffset === 8) harmonicFunction = 'Submediant (bVI)';
        else if (rootOffset === 9 || rootOffset === 4) harmonicFunction = 'Tonic Parallel';
        else harmonicFunction = 'Diatonic Step';
      } else {
        const domQualityIds = ['7', '9', '11', '13', '7b9', '7#9', '7#11', '7b13', 'alt'];
        if (domQualityIds.includes(chord.qualityId)) {
          const targetPC = (chord.rootPC + 5) % 12;
          const targetOffset = (targetPC - keyCandidate.rootPC + 12) % 12;
          const targetDegree = isMajorKey ? majorKeyDegrees[targetOffset]?.roman : minorKeyDegrees[targetOffset]?.roman;
          if (targetDegree && targetDegree !== 'I' && targetDegree !== 'i') {
            harmonicFunction = `Secondary Dominant (V7/${targetDegree})`;
            romanNumeral = `V7/${targetDegree}`;
          } else if (rootOffset === 6 || rootOffset === 1) {
            harmonicFunction = 'Tritone Substitution (subV7)';
            romanNumeral = 'subV7';
          } else {
            harmonicFunction = 'Secondary Dominant / Blues 7th';
          }
        } else if (chord.qualityId === 'maj7#11' && rootOffset === 5) {
          harmonicFunction = 'Lydian Subdominant (IVΔ7#11)';
        } else if (chord.qualityId === 'maj7#11' && rootOffset === 0) {
          harmonicFunction = 'Lydian Tonic (IΔ7#11)';
        } else if (chord.qualityId === 'maj7#11') {
          harmonicFunction = 'Lydian Chord (maj7#11)';
        } else if (isMajorKey && (rootOffset === 5 && chord.qualityId === 'min')) {
          harmonicFunction = 'Modal Interchange (Minor iv from Aeolian)';
          romanNumeral = 'iv';
        } else if (isMajorKey && (rootOffset === 8 && chord.qualityId === 'maj')) {
          harmonicFunction = 'Modal Interchange (bVI from Aeolian)';
          romanNumeral = 'bVI';
        } else if (isMajorKey && (rootOffset === 10 && (chord.qualityId === 'maj' || chord.qualityId === '7'))) {
          harmonicFunction = 'Modal Interchange / Backdoor (bVII from Mixolydian)';
          romanNumeral = 'bVII';
        } else if (rootOffset === 1 && chord.qualityId === 'maj') {
          harmonicFunction = 'Neapolitan Chord (bII)';
          romanNumeral = 'bII';
        }
      }
    }

    // Accurate 7th and alteration suffixes
    if (chord.qualityId === 'm7b5') {
      if (romanNumeral.includes('°')) romanNumeral = romanNumeral.replace('°', 'ø7');
      else if (!romanNumeral.includes('ø')) romanNumeral += 'ø7';
    } else if (chord.qualityId === 'dim7') {
      if (romanNumeral.includes('°')) romanNumeral = romanNumeral.replace('°', '°7');
      else if (!romanNumeral.includes('°')) romanNumeral += '°7';
    } else if (chord.qualityId === '7b9') {
      if (!romanNumeral.includes('7')) romanNumeral += '7(b9)';
      else if (!romanNumeral.includes('b9')) romanNumeral += '(b9)';
    } else if (chord.qualityId === '7#9') {
      if (!romanNumeral.includes('7')) romanNumeral += '7(#9)';
      else if (!romanNumeral.includes('#9')) romanNumeral += '(#9)';
    } else if (chord.qualityId === 'maj7#11') {
      if (!romanNumeral.includes('Δ7') && !romanNumeral.includes('7')) romanNumeral += 'Δ7(#11)';
      else romanNumeral += '(#11)';
    } else if (chord.qualityId === '7#11') {
      if (!romanNumeral.includes('7')) romanNumeral += '7(#11)';
      else romanNumeral += '(#11)';
    } else if (chord.qualityId === '7b13') {
      if (!romanNumeral.includes('7')) romanNumeral += '7(b13)';
      else romanNumeral += '(b13)';
    } else if (chord.qualityId === 'maj7') {
      if (!romanNumeral.includes('7')) romanNumeral += 'Δ7';
    } else if (chord.qualityId === 'maj9') {
      if (!romanNumeral.includes('9')) romanNumeral += 'Δ9';
    } else if (chord.qualityId === 'maj11') {
      if (!romanNumeral.includes('11')) romanNumeral += 'Δ11';
    } else if (chord.qualityId === 'maj13') {
      if (!romanNumeral.includes('13')) romanNumeral += 'Δ13';
    } else if (chord.qualityId === 'm7') {
      if (!romanNumeral.includes('7')) romanNumeral += '7';
    } else if (chord.qualityId === 'm9') {
      if (!romanNumeral.includes('9')) romanNumeral += '9';
    } else if (chord.qualityId === 'm11') {
      if (!romanNumeral.includes('11')) romanNumeral += '11';
    } else if (chord.qualityId === 'm13') {
      if (!romanNumeral.includes('13')) romanNumeral += '13';
    } else if (chord.qualityId === '7') {
      if (!romanNumeral.includes('7')) romanNumeral += '7';
    } else if (chord.qualityId === '9') {
      if (!romanNumeral.includes('9')) romanNumeral += '9';
    } else if (chord.qualityId === '11') {
      if (!romanNumeral.includes('11')) romanNumeral += '11';
    } else if (chord.qualityId === '13') {
      if (!romanNumeral.includes('13')) romanNumeral += '13';
    } else if (chord.qualityId === '69') {
      romanNumeral += '6/9';
    } else if (chord.qualityId === 'm69') {
      romanNumeral += '6/9';
    }

    // Ensure minor quality chords use lowercase Roman numerals in major keys (e.g. Cm9 -> i9, Fm7 -> iv7)
    const isMinorQuality = ['min', 'm7', 'm9', 'm11', 'm13', 'mMaj7', 'm6', 'm69', 'dim', 'm7b5', 'dim7'].includes(chord.qualityId) || (chord.intervals && chord.intervals.includes(3));
    if (isMinorQuality && !romanNumeral.startsWith('V7/')) {
      romanNumeral = romanNumeral.replace(/([IVXLCDM]+)/g, (match) => match.toLowerCase());
    }

    // Append modifier indicators
    if (chord.modifierLabels && chord.modifierLabels.length > 0) {
      const extraMods = chord.modifierLabels.filter(m => !romanNumeral.toLowerCase().includes(m.toLowerCase()));
      if (extraMods.length > 0) {
        romanNumeral += `(${extraMods.join(',')})`;
      }
    }

    // Inversions / slash bass
    if (chord.bassNote && chord.bassPC !== chord.rootPC) {
      romanNumeral += `/${chord.bassNote}`;
    }

    return {
      chord,
      rootOffset,
      romanNumeral,
      degreeName,
      harmonicFunction,
      isDiatonic
    };
  }

  // Modal Transformation Engine across all 7 Diatonic Modes
  const MODAL_TIERS = [
    {
      name: '1. Locrian',
      label: 'Locrian (Dread & Grief)',
      formula: [0, 1, 3, 5, 6, 8, 10],
      qualities: { 1: 'm7b5', 2: 'maj7', 3: 'm7', 4: 'm7', 5: 'maj7', 6: '7', 7: 'm7' }
    },
    {
      name: '2. Phrygian',
      label: 'Phrygian (Suspensive Desolation)',
      formula: [0, 1, 3, 5, 7, 8, 10],
      qualities: { 1: 'm7', 2: 'maj7', 3: '7', 4: 'm7', 5: 'm7b5', 6: 'maj7', 7: 'm7' }
    },
    {
      name: '3. Aeolian',
      label: 'Aeolian / Natural Minor (Bittersweet Melancholy)',
      formula: [0, 2, 3, 5, 7, 8, 10],
      qualities: { 1: 'm7', 2: 'm7b5', 3: 'maj7', 4: 'm7', 5: 'm7', 6: 'maj7', 7: '7' }
    },
    {
      name: '4. Dorian',
      label: 'Dorian (Soulful & Jazzy Minor)',
      formula: [0, 2, 3, 5, 7, 9, 10],
      qualities: { 1: 'm7', 2: 'm7', 3: 'maj7', 4: '7', 5: 'm7', 6: 'm7b5', 7: 'maj7' }
    },
    {
      name: '5. Mixolydian',
      label: 'Mixolydian (Grounded Warmth / Bluesy)',
      formula: [0, 2, 4, 5, 7, 9, 10],
      qualities: { 1: '7', 2: 'm7', 3: 'm7b5', 4: 'maj7', 5: 'm7', 6: 'm7', 7: 'maj7' }
    },
    {
      name: '6. Ionian',
      label: 'Ionian / Major (Calm Stability)',
      formula: [0, 2, 4, 5, 7, 9, 11],
      qualities: { 1: 'maj7', 2: 'm7', 3: 'm7', 4: 'maj7', 5: '7', 6: 'm7', 7: 'm7b5' }
    },
    {
      name: '7. Lydian',
      label: 'Lydian (Euphoric Transcendence / Dreamy)',
      formula: [0, 2, 4, 6, 7, 9, 11],
      qualities: { 1: 'maj7#11', 2: '7', 3: 'm7', 4: 'm7b5', 5: 'maj7', 6: 'm7', 7: 'm7' }
    }
  ];

  function transformProgressionModal(tonicStr, degreesList) {
    const tonicPC = noteToPitchClass(tonicStr);
    if (tonicPC === null) return [];

    const preferFlats = tonicStr.includes('b') || tonicStr === 'F';

    return MODAL_TIERS.map(tier => {
      const renderedChords = degreesList.map(deg => {
        const degIndex = ((deg - 1) % 7 + 7) % 7;
        const semitoneOffset = tier.formula[degIndex];
        const chordRootPC = (tonicPC + semitoneOffset) % 12;
        const chordRoot = pitchClassToNote(chordRootPC, preferFlats);
        const quality = tier.qualities[degIndex + 1] || 'maj7';
        return `${chordRoot}${quality}`;
      });

      return {
        tierName: tier.name,
        tierLabel: tier.label,
        chords: renderedChords,
        progressionString: renderedChords.join(' -> ')
      };
    });
  }

  // Export to global window object
  window.SongTheory = {
    NOTE_NAMES_SHARP,
    NOTE_NAMES_FLAT,
    INTERVAL_NAMES,
    INTERVAL_SHORT,
    CHORD_QUALITIES,
    SCALE_DEFINITIONS,
    MODAL_TIERS,
    noteToPitchClass,
    pitchClassToNote,
    parseChord,
    detectKeys,
    analyzeChordInKey,
    transformProgressionModal
  };

})(typeof window !== 'undefined' ? window : globalThis);
