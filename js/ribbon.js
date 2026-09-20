/**
 * Song Analyzer - Voice Leading Ribbon & 6-School Melodic Pathway Engine
 * Pure Native JS, HTML5 High-DPI Canvas, 100% Offline Compatible
 */

(function (window) {
  'use strict';

  // Definition of the 6 Compositional Schools and their 18+ Melodic Pathways
  const VOICE_LEADING_SCHOOLS = {
    classical: {
      id: 'classical',
      name: 'Classical & Viennese',
      icon: '🏛️',
      masters: 'Fux, J.S. Bach, Haydn, Mozart, Kofroň',
      description: 'Strict voice-leading counterpoint, stepwise linear gravity, and resolution of tension through harmonic equilibrium.',
      pathways: [
        {
          id: 'classical-min-motion',
          name: 'Law of Minimal Motion (Gesetz des nächsten Weges)',
          tagline: 'Effortless stately vocal line with zero jarring leaps',
          pedagogy: 'Bruckner & Kofroň’s fundamental harmonic law: each voice moves to the closest available chord tone. Common tones remain stationary (0 semitones), prioritizing half-step and whole-step connection to create seamless choral smoothness.',
          artists: 'J.S. Bach (Chorales), W.A. Mozart (Ave Verum Corpus), F. Chopin (Prelude in E Minor Op. 28 No. 4)',
          algo: 'minMotion'
        },
        {
          id: 'classical-urlinie',
          name: 'Schenkerian Urlinie (Linear Descent ^5-^1 / ^3-^1)',
          tagline: 'Fundamental tonal gravity resolving to the root tonic',
          pedagogy: 'Heinrich Schenker’s structural framework: masterworks are governed by a fundamental melodic descent (Urlinie) from the 5th or 3rd degree down to the tonic (^1), establishing inexorable narrative closure and satisfying resolution.',
          artists: 'L.v. Beethoven (Ode to Joy), J. Brahms (Lullaby), J. Haydn (Surprise Symphony No. 94)',
          algo: 'urlinie'
        },
        {
          id: 'classical-counterpoint',
          name: 'Leap & Contrary Recovery (Species Counterpoint)',
          tagline: 'Expressive leap balanced by stepwise contrary motion',
          pedagogy: 'Johann Joseph Fux’s Gradus ad Parnassum: when a melody makes an intervallic leap of a 4th or 5th, harmonic balance must be immediately restored by stepping in the opposite direction, preventing vocal strain and preserving melodic contour.',
          artists: 'G.P. da Palestrina (Missa Papae Marcelli), J.S. Bach (Inventions), G.F. Handel (Messiah)',
          algo: 'counterpointLeap'
        }
      ]
    },
    jazz: {
      id: 'jazz',
      name: 'Jazz & Bebop',
      icon: '🎷',
      masters: 'Charlie Parker, Bill Evans, Barry Harris, Bert Ligon',
      description: 'Sophisticated linear guide-tone harmony, chromatic targeting, and upper-structure tension colors.',
      pathways: [
        {
          id: 'jazz-guide-tones',
          name: '3-to-7 Guide Tone Thread (The Bebop Engine)',
          tagline: 'Alternating 3rds and 7ths outlining chord qualities',
          pedagogy: 'The holy grail of jazz voice leading: 3rds and 7ths define the essential character of every chord. In cycle-of-fifths (ii-V-I) motions, the 7th of each chord resolves down by a single half-step to become the 3rd of the next, producing crystal-clear harmonic outlines without bass support.',
          artists: 'Charlie Parker (Autumn Leaves), Bill Evans (Blue in Green), Miles Davis (Tune Up)',
          algo: 'guideToneThread'
        },
        {
          id: 'jazz-ligon-line1',
          name: 'Bert Ligon "Line 1" (3-2-1-7 Outline)',
          tagline: 'The most transcribed melodic line in jazz solo history',
          pedagogy: 'Bert Ligon’s research across thousands of jazz solos revealed that legends instinctively trace this contour: landing on the 3rd of the chord, stepping down through 2 and 1, then connecting into the 7th or 3rd of the resolving chord.',
          artists: 'Clifford Brown, Sonny Rollins, Dexter Gordon (Cherokee), Bud Powell',
          algo: 'ligonLine1'
        },
        {
          id: 'jazz-upper-structure',
          name: 'Upper Structure Color (7ths, 9ths, 11ths, 13ths)',
          tagline: 'Floating high above roots and fifths with airy extensions',
          pedagogy: 'Modern post-bop modal aesthetic: the rhythm section supplies roots and fifths, liberating the soloist to target 7ths, 9ths, #11ths, and 13ths. Creates shimmering, impressionistic colors without muddying the low-end.',
          artists: 'Wayne Shorter (Infant Eyes), Herbie Hancock (Maiden Voyage), Chick Corea (Spain)',
          algo: 'upperStructure'
        }
      ]
    },
    blues: {
      id: 'blues',
      name: 'Blues, Soul & Roots',
      icon: '🎸',
      masters: 'B.B. King, Muddy Waters, Stevie Ray Vaughan, Robert Johnson',
      description: 'Crying microtonal inflections, sweet box major/minor shifts, and legendary chromatic turnaround voice leading.',
      pathways: [
        {
          id: 'blues-curl',
          name: 'Blue Note Curl (b3 ↔ ♮3 & b5 Bridge)',
          tagline: 'Minor 3rd on I becomes Dominant 7th on IV',
          pedagogy: 'The greatest voice-leading secret of the blues: the minor 3rd (b3 / #9) of the tonic I chord is the exact same pitch as the flat 7th of the IV chord! The melody curls between b3 and natural 3, cutting through with the biting b5 blue note to deliver raw, vocal expression.',
          artists: 'Muddy Waters (Hoochie Coochie Man), Stevie Ray Vaughan (Pride and Joy), Jimi Hendrix (Red House)',
          algo: 'blueNoteCurl'
        },
        {
          id: 'blues-bb-box',
          name: 'B.B. King "Sweet Box" (Major 6th & 9th)',
          tagline: 'Uplifting, singing vibrato targeting the 6th and 9th',
          pedagogy: 'B.B. King’s signature 2-fret sweet box: emphasizing the major 6th and 9th over dominant chords produces an uplifting, soulful gospel warmth rather than dark minor grit, sliding joyously into the major 3rd.',
          artists: 'B.B. King (The Thrill Is Gone, Sweet Little Angel), Albert King (Born Under a Bad Sign), Eric Clapton',
          algo: 'bbKingBox'
        },
        {
          id: 'blues-turnaround',
          name: 'Delta Chromatic Turnaround (1 → b7 → 6 → b6 → 5)',
          tagline: 'The iconic downward chromatic line pulling to V7',
          pedagogy: 'The timeless acoustic delta blues turnaround: a descending chromatic voice from the tonic down through b7, 6, and b6 lands decisively on the 5th of the cadential V7 chord, launching the next chorus.',
          artists: 'Robert Johnson (Sweet Home Chicago), Elmore James (Dust My Broom), Eric Clapton (Key to the Highway)',
          algo: 'deltaTurnaround'
        }
      ]
    },
    romantic: {
      id: 'romantic',
      name: 'Romantic & Cinema',
      icon: '🎻',
      masters: 'Chopin, Rachmaninoff, Morricone, John Williams',
      description: 'Heart-wrenching emotional thirds, noble heroic ascents, and expressive half-step sighs.',
      pathways: [
        {
          id: 'romantic-thirds',
          name: 'Emotional Thirds (The Passion Line)',
          tagline: 'Riding the 3rd of every chord to magnify emotional shifts',
          pedagogy: 'In cinematic scoring, the 3rd dictates 80% of a chord’s affective impact (major joy vs. minor sorrow). Tracking the 3rd through chord substitutions creates dramatic emotional resonance.',
          artists: 'Frédéric Chopin (Nocturne Op. 9 No. 2), Ennio Morricone (Cinema Paradiso), John Williams (Schindler’s List)',
          algo: 'emotionalThirds'
        },
        {
          id: 'romantic-heroic',
          name: 'Heroic Ascent (5ths & Octaves)',
          tagline: 'Noble upward leaps inspiring courage and epic triumph',
          pedagogy: 'The brass and horn tradition of epic cinematic themes: wide upward leaps to the 5th and root octave symbolize nobility, courage, and vast physical or spiritual journeys.',
          artists: 'John Williams (Star Wars Main Theme), Howard Shore (Lord of the Rings), Gustav Holst (Jupiter)',
          algo: 'heroicAscent'
        },
        {
          id: 'romantic-sigh',
          name: 'Sighing Appoggiatura (Expressive Half-Step Falls)',
          tagline: 'Classical Seufzer: leaning on tension before weeping downward',
          pedagogy: 'The classical sigh motif (Seufzermotiv): leaning on an accented non-chord tension (9th, 4th, #11) before resolving down a half-step generates palpable emotional vulnerability and release.',
          artists: 'P.I. Tchaikovsky (Romeo & Juliet Fantasy), S. Rachmaninoff (Piano Concerto No. 2), G. Puccini (Nessun Dorma)',
          algo: 'sighingFalls'
        }
      ]
    },
    pop: {
      id: 'pop',
      name: 'Modern Pop & Songwriting',
      icon: '🎤',
      masters: 'Coldplay, U2, Max Martin, Taylor Swift, Adele',
      description: 'Anthemic stadium anchor drones, universally singable pentatonics, and verse-to-chorus arch contours.',
      pathways: [
        {
          id: 'pop-anchor',
          name: 'Stadium Anchor (Common-Tone Drone)',
          tagline: 'A static vocal drone as chords morph beneath it',
          pedagogy: 'The modern songwriting superpower: a static vocal drone note creates an irresistible sing-along anchor while shifting chords underneath supply emotional progression without losing the listener.',
          artists: 'Coldplay (Fix You / Viva La Vida), U2 (With or Without You), The Chainsmokers (Closer), Dua Lipa',
          algo: 'stadiumAnchor'
        },
        {
          id: 'pop-pentatonic',
          name: 'Pentatonic Highway (Universal Sing-Along)',
          tagline: 'Zero abrasive half-steps for effortless singability',
          pedagogy: '90% of global pop hits restrict vocal hooks strictly to the key pentatonic scale (1, 2, 3, 5, 6), eliminating awkward intervals and ensuring instant memorability across all demographics.',
          artists: 'Taylor Swift (Shake It Off), Ed Sheeran (Shape of You), Maroon 5 (Memories), Avicii (Wake Me Up)',
          algo: 'pentatonicHighway'
        },
        {
          id: 'pop-arch',
          name: 'Pop Arch Contour (Verse-Chorus Hook Lift)',
          tagline: 'Low verse grounding cresting into a triumphant chorus peak',
          pedagogy: 'Contour dynamics: starting comfortably in lower register, climbing steadily to a peak at the emotional center of the progression, then resolving smoothly.',
          artists: 'Adele (Rolling in the Deep), Katy Perry (Roar), The Beatles (Hey Jude)',
          algo: 'popArch'
        }
      ]
    },
    prog: {
      id: 'prog',
      name: 'Progressive Metal & Art-Rock',
      icon: '⚡',
      masters: 'Dream Theater, Tool, Opeth, King Crimson, Plini',
      description: 'Soaring Lydian #11 space vectors, crushing Phrygian b2 tension, and dizzying tritone leaps.',
      pathways: [
        {
          id: 'prog-lydian-space',
          name: 'Lydian #11 Space Vector (Petrucci / Satriani)',
          tagline: 'Ethereal cosmic tension avoiding the pedestrian natural 4th',
          pedagogy: 'The quintessential prog guitar aesthetic: raising the 4th to #11 opens up a wide, majestic, sci-fi acoustic space with zero tonal mud, soaring over major and power chords.',
          artists: 'Dream Theater (The Dance of Eternity), Steve Vai (For the Love of God), Plini (Electric Sunrise)',
          algo: 'lydianSpace'
        },
        {
          id: 'prog-phrygian-crush',
          name: 'Phrygian b2 Dark Crush (Opeth / Tool)',
          tagline: 'Razor-sharp minor 2nd rub for gothic, ancient majesty',
          pedagogy: 'The dark core of progressive metal: leaning heavily on the minor 2nd (b2) creates an ancient, menacing tension that hits with catastrophic rhythmic weight.',
          artists: 'Opeth (Ghost of Perdition, Deliverance), Tool (Schism, Lateralus), Symphony X (Sea of Lies)',
          algo: 'phrygianCrush'
        },
        {
          id: 'prog-angular-tritones',
          name: 'Angular Tritone & M7 Leaps (Fripp / Meshuggah)',
          tagline: 'Dizzying symmetrical math-metal interval geometry',
          pedagogy: 'Robert Fripp and modern tech-metal counterpoint: discarding smooth scalar motion in favor of jagged tritones (±6st) and major 7ths (±11st) to produce unsettling harmonic vertigo.',
          artists: 'King Crimson (Fracture, Red), Meshuggah (Bleed), Animals as Leaders (Physical Education)',
          algo: 'angularTritones'
        },
        {
          id: 'prog-chromatic-slide',
          name: 'Chromatic Mediant Slide (Neo-Riemannian)',
          tagline: 'Half-step voice leading across third-related chords',
          pedagogy: 'Neo-Riemannian transformational theory: mediant relationships (e.g. Am to C#m or C to Ab) allow voices to slide by single chromatic half-steps, creating mind-bending harmonic shifts.',
          artists: 'Tool (Forty Six & 2), Dream Theater (A Change of Seasons), Porcupine Tree (Arriving Somewhere)',
          algo: 'chromaticSlide'
        },
        {
          id: 'prog-ringing-anchor',
          name: 'Ringing Open String Anchor (Tosin Abasi / Porcupine Tree)',
          tagline: 'A sustained high drone recontextualized as harmony mutates',
          pedagogy: 'Modern extended-range guitar philosophy: holding a high open drone pitch while low crushing chords shift alters the tension from 5th to maj7, 9th, and #11 beneath a single unchanging note.',
          artists: 'Porcupine Tree (Trains, Anesthetize), Animals as Leaders (CAFO), Periphery (Marigold)',
          algo: 'ringingAnchor'
        }
      ]
    }
  };

  /**
   * Note & Pitch Utilities
   */
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function midiToNoteName(midi) {
    const pc = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    return `${NOTE_NAMES[pc]}${oct}`;
  }

  function noteNameToMidi(noteName) {
    const match = noteName.match(/^([A-Ga-g][#b♯♭]?)(-?\d+)$/);
    if (!match) return 60;
    let n = match[1].replace('♯', '#').replace('♭', 'b');
    let oct = parseInt(match[2], 10);
    // standard sharp map
    const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    if (flatMap[n]) n = flatMap[n];
    let pc = NOTE_NAMES.indexOf(n);
    if (pc === -1) pc = 0;
    return (oct + 1) * 12 + pc;
  }

  /**
   * VoiceLeadingEngine
   * Analyzes chord progression, computes SATB comping voices, and generates melodic pathways.
   */
  class VoiceLeadingEngine {
    constructor() {
      this.chords = [];
      this.keyInfo = null;
      this.activeSchoolId = 'classical';
      this.activePathwayId = 'classical-min-motion';
      this.customOverrides = {}; // chordIdx -> node
      this.satbVoices = []; // 4-part background comping lines
      this.activeMelodyNodes = []; // Selected melodic notes for each chord
    }

    setProgression(parsedChords, keyInfo) {
      this.chords = parsedChords || [];
      this.keyInfo = keyInfo || null;
      this.computeSATBVoices();
      this.computeMelodyPathway();
    }

    setSchool(schoolId) {
      if (VOICE_LEADING_SCHOOLS[schoolId]) {
        this.activeSchoolId = schoolId;
        const firstPathway = VOICE_LEADING_SCHOOLS[schoolId].pathways[0];
        this.activePathwayId = firstPathway.id;
        this.computeMelodyPathway();
      }
    }

    setPathway(pathwayId) {
      // Find school of pathway
      for (const sId in VOICE_LEADING_SCHOOLS) {
        const found = VOICE_LEADING_SCHOOLS[sId].pathways.find(p => p.id === pathwayId);
        if (found) {
          this.activeSchoolId = sId;
          this.activePathwayId = pathwayId;
          break;
        }
      }
      this.computeMelodyPathway();
    }

    setCustomNode(chordIdx, candidateNode) {
      this.customOverrides[chordIdx] = candidateNode;
      this.computeMelodyPathway();
    }

    clearCustomOverrides() {
      this.customOverrides = {};
      this.computeMelodyPathway();
    }

    hasCustomOverrides() {
      return Object.keys(this.customOverrides).length > 0;
    }

    /**
     * Compute all candidate notes for a given chord across octaves 3, 4, and 5.
     */
    getCandidatesForChord(chord) {
      if (!chord || !chord.intervals) return [];
      const rootPC = chord.rootPC;
      const candidates = [];

      chord.intervals.forEach((interval, idx) => {
        const pc = (rootPC + interval) % 12;
        const noteName = chord.notes && chord.notes[idx] ? chord.notes[idx] : NOTE_NAMES[pc];
        const deg = chord.degrees && chord.degrees[idx] ? chord.degrees[idx] : (idx === 0 ? 1 : idx + 1);

        let role = 'extension';
        let roleLabel = `${deg}`;
        if (interval === 0) { role = 'root'; roleLabel = 'Root'; }
        else if (interval === 3 || interval === 4) { role = 'third'; roleLabel = interval === 3 ? 'b3rd' : '3rd'; }
        else if (interval === 7 || interval === 6 || interval === 8) {
          role = 'fifth';
          roleLabel = interval === 6 ? 'b5th' : (interval === 8 ? '#5th' : '5th');
        }
        else if (interval === 10 || interval === 11 || interval === 9) {
          role = 'seventh';
          roleLabel = interval === 10 ? 'b7th' : (interval === 11 ? 'Maj7' : '6th');
        }

        // Generate octaves 3, 4, 5
        [3, 4, 5].forEach(octave => {
          const midi = (octave + 1) * 12 + pc;
          candidates.push({
            chord,
            pc,
            noteName,
            scientific: `${noteName}${octave}`,
            octave,
            midi,
            interval,
            deg,
            role,
            roleLabel
          });
        });
      });

      // Special blues/prog extensions if not present
      const addExtraIfMissing = (intervalOffset, nameOffset, roleLabel) => {
        const pc = (rootPC + intervalOffset) % 12;
        if (!candidates.some(c => c.pc === pc)) {
          [3, 4, 5].forEach(octave => {
            const midi = (octave + 1) * 12 + pc;
            candidates.push({
              chord,
              pc,
              noteName: nameOffset,
              scientific: `${nameOffset}${octave}`,
              octave,
              midi,
              interval: intervalOffset,
              deg: roleLabel,
              role: 'extension',
              roleLabel: roleLabel,
              isExtension: true
            });
          });
        }
      };

      // Add #11 for Lydian / Prog
      addExtraIfMissing(6, NOTE_NAMES[(rootPC + 6) % 12], '#11');
      // Add b2 for Phrygian
      addExtraIfMissing(1, NOTE_NAMES[(rootPC + 1) % 12], 'b2');
      // Add 9th
      addExtraIfMissing(14 % 12, NOTE_NAMES[(rootPC + 2) % 12], '9th');

      return candidates.sort((a, b) => a.midi - b.midi);
    }

    /**
     * Compute 4-part SATB background comping lines using minimal motion voice leading.
     */
    computeSATBVoices() {
      if (!this.chords || this.chords.length === 0) {
        this.satbVoices = [];
        return;
      }

      const numChords = this.chords.length;
      // Voices: 0: Bass (MIDI 36-52), 1: Tenor (MIDI 48-60), 2: Alto (MIDI 53-65), 3: Soprano (MIDI 60-76)
      const voices = [[], [], [], []];

      for (let i = 0; i < numChords; i++) {
        const chord = this.chords[i];
        const bassPC = (chord.bassPC !== undefined && chord.bassPC !== null) ? chord.bassPC : chord.rootPC;
        // Bass: pitch in octave 2 or 3
        const bassMidi = 36 + bassPC + (bassPC < 4 ? 12 : 0);
        voices[0].push({
          voice: 'Bass',
          midi: bassMidi,
          noteName: NOTE_NAMES[bassPC],
          scientific: midiToNoteName(bassMidi),
          pc: bassPC
        });

        // Upper 3 voices (Tenor, Alto, Soprano)
        const chordPCs = chord.pitchClasses && chord.pitchClasses.length ? chord.pitchClasses : [chord.rootPC];
        if (i === 0) {
          // Initialize first chord in balanced close/open position
          const tPC = chordPCs[1 % chordPCs.length];
          const aPC = chordPCs[2 % chordPCs.length];
          const sPC = chordPCs[chordPCs.length > 3 ? 3 : 0];

          const tMidi = 48 + tPC;
          const aMidi = 55 + aPC;
          const sMidi = 64 + sPC;

          voices[1].push({ voice: 'Tenor', midi: tMidi, noteName: NOTE_NAMES[tPC], scientific: midiToNoteName(tMidi), pc: tPC });
          voices[2].push({ voice: 'Alto', midi: aMidi, noteName: NOTE_NAMES[aPC], scientific: midiToNoteName(aMidi), pc: aPC });
          voices[3].push({ voice: 'Soprano', midi: sMidi, noteName: NOTE_NAMES[sPC], scientific: midiToNoteName(sMidi), pc: sPC });
        } else {
          // Minimal motion voice leading from previous chord
          ['Tenor', 'Alto', 'Soprano'].forEach((vName, vIdx) => {
            const voiceNum = vIdx + 1;
            const prevNote = voices[voiceNum][i - 1];
            // Find chord PC closest to prevNote.midi
            let bestMidi = null;
            let minDiff = 999;
            let bestPC = chordPCs[0];

            chordPCs.forEach(pc => {
              // Check octaves near prevNote.midi
              [-12, 0, 12].forEach(offset => {
                const targetMidi = Math.floor(prevNote.midi / 12) * 12 + pc + offset;
                const diff = Math.abs(targetMidi - prevNote.midi);
                if (diff < minDiff) {
                  minDiff = diff;
                  bestMidi = targetMidi;
                  bestPC = pc;
                }
              });
            });

            voices[voiceNum].push({
              voice: vName,
              midi: bestMidi,
              noteName: NOTE_NAMES[bestPC],
              scientific: midiToNoteName(bestMidi),
              pc: bestPC
            });
          });
        }
      }

      this.satbVoices = voices;
    }

    /**
     * Compute Melodic Pathway through chord progression.
     */
    computeMelodyPathway() {
      if (!this.chords || this.chords.length === 0) {
        this.activeMelodyNodes = [];
        return;
      }

      const activeSchool = VOICE_LEADING_SCHOOLS[this.activeSchoolId] || VOICE_LEADING_SCHOOLS.classical;
      const activePathway = activeSchool.pathways.find(p => p.id === this.activePathwayId) || activeSchool.pathways[0];
      const algo = activePathway.algo;
      const numChords = this.chords.length;

      // Generate candidates for all chords
      const candidatesByChord = this.chords.map(c => this.getCandidatesForChord(c));

      let pathwayNodes = [];

      // Algorithms
      switch (algo) {
        case 'minMotion': {
          // Dynamic programming / Dijkstra to find path minimizing sum of (delta semitones)^2
          pathwayNodes = this.algoMinMotion(candidatesByChord);
          break;
        }
        case 'urlinie': {
          // Schenkerian Urlinie: Linear descent starting on ^5 or ^3 in key, descending to ^1 on final chord
          pathwayNodes = this.algoUrlinie(candidatesByChord);
          break;
        }
        case 'counterpointLeap': {
          // Alternating leap (>= 4st) and stepwise contrary recovery
          pathwayNodes = this.algoCounterpointLeap(candidatesByChord);
          break;
        }
        case 'guideToneThread': {
          // Jazz: alternate 3rd and 7th (or nearest guide tone)
          pathwayNodes = this.algoGuideToneThread(candidatesByChord);
          break;
        }
        case 'ligonLine1': {
          // Bert Ligon Line 1: 3-2-1-7 contour
          pathwayNodes = this.algoLigonLine1(candidatesByChord);
          break;
        }
        case 'upperStructure': {
          // Target highest extensions (9, 11, 13, 7)
          pathwayNodes = this.algoUpperStructure(candidatesByChord);
          break;
        }
        case 'blueNoteCurl': {
          // Emphasize b3, b5, b7
          pathwayNodes = this.algoBlueNoteCurl(candidatesByChord);
          break;
        }
        case 'bbKingBox': {
          // B.B. King Sweet Box: major 6th and 9th
          pathwayNodes = this.algoBBKingBox(candidatesByChord);
          break;
        }
        case 'deltaTurnaround': {
          // Chromatic descent 1 -> b7 -> 6 -> b6 -> 5
          pathwayNodes = this.algoDeltaTurnaround(candidatesByChord);
          break;
        }
        case 'emotionalThirds': {
          // Always target the 3rd
          pathwayNodes = this.algoEmotionalThirds(candidatesByChord);
          break;
        }
        case 'heroicAscent': {
          // Leaping upward targeting 5ths and octaves
          pathwayNodes = this.algoHeroicAscent(candidatesByChord);
          break;
        }
        case 'sighingFalls': {
          // Appoggiatura sighing down a half step
          pathwayNodes = this.algoSighingFalls(candidatesByChord);
          break;
        }
        case 'stadiumAnchor': {
          // Common-tone drone held across chords
          pathwayNodes = this.algoStadiumAnchor(candidatesByChord);
          break;
        }
        case 'pentatonicHighway': {
          // Pentatonic scale constraint
          pathwayNodes = this.algoPentatonicHighway(candidatesByChord);
          break;
        }
        case 'popArch': {
          // Rise from low to high peak at center, then resolve
          pathwayNodes = this.algoPopArch(candidatesByChord);
          break;
        }
        case 'lydianSpace': {
          // Target #11 and maj7
          pathwayNodes = this.algoLydianSpace(candidatesByChord);
          break;
        }
        case 'phrygianCrush': {
          // Target b2 and b6
          pathwayNodes = this.algoPhrygianCrush(candidatesByChord);
          break;
        }
        case 'angularTritones': {
          // Connect via tritones (6st) or M7 (11st)
          pathwayNodes = this.algoAngularTritones(candidatesByChord);
          break;
        }
        case 'chromaticSlide': {
          // Prioritize half-step movements (|delta| = 1)
          pathwayNodes = this.algoChromaticSlide(candidatesByChord);
          break;
        }
        case 'ringingAnchor': {
          // High static ringing open string drone
          pathwayNodes = this.algoRingingAnchor(candidatesByChord);
          break;
        }
        default: {
          pathwayNodes = this.algoMinMotion(candidatesByChord);
        }
      }

      // Apply user custom node overrides if set
      for (let i = 0; i < numChords; i++) {
        if (this.customOverrides[i]) {
          pathwayNodes[i] = this.customOverrides[i];
        }
      }

      // Compute delta semitones and format details
      for (let i = 0; i < pathwayNodes.length; i++) {
        const node = pathwayNodes[i];
        node.chordIndex = i;
        if (i === 0) {
          node.deltaSemitones = 0;
          node.deltaBadge = '0st';
          node.badgeClass = 'badge-blue';
        } else {
          const prev = pathwayNodes[i - 1];
          const delta = node.midi - prev.midi;
          node.deltaSemitones = delta;
          node.deltaBadge = (delta > 0 ? `+${delta}` : `${delta}`) + 'st';
          const abs = Math.abs(delta);
          if (abs === 0) node.badgeClass = 'badge-blue';
          else if (abs === 1) node.badgeClass = 'badge-green';
          else if (abs === 2) node.badgeClass = 'badge-emerald';
          else if (abs <= 5) node.badgeClass = 'badge-amber';
          else if (abs === 6) node.badgeClass = 'badge-purple';
          else node.badgeClass = 'badge-pink';
        }
      }

      this.activeMelodyNodes = pathwayNodes;
    }

    // --- Specific Pathway Algorithms ---

    algoMinMotion(candidatesByChord) {
      // Viterbi / DP algorithm to find the path minimizing sum of (delta MIDI)^2
      const n = candidatesByChord.length;
      if (n === 0) return [];
      // Filter candidates to octave 4 or 5 for pleasing melodic range
      const validCandidates = candidatesByChord.map(cands => {
        const filtered = cands.filter(c => c.midi >= 57 && c.midi <= 79);
        return filtered.length > 0 ? filtered : cands;
      });

      const dp = [];
      const parent = [];

      for (let i = 0; i < n; i++) {
        dp[i] = [];
        parent[i] = [];
        const currCands = validCandidates[i];

        if (i === 0) {
          currCands.forEach((cand, cIdx) => {
            // Prefer 3rd or 5th in middle octave 4 (MIDI 64)
            const distFromMid = Math.abs(cand.midi - 65);
            const roleBonus = (cand.role === 'third' || cand.role === 'fifth') ? -5 : 0;
            dp[0][cIdx] = distFromMid + roleBonus;
            parent[0][cIdx] = -1;
          });
        } else {
          const prevCands = validCandidates[i - 1];
          currCands.forEach((cand, cIdx) => {
            let minCost = Infinity;
            let bestPrev = 0;
            prevCands.forEach((prevCand, pIdx) => {
              const diff = Math.abs(cand.midi - prevCand.midi);
              // Small penalty for leaps, large penalty for huge jumps
              const stepCost = diff * diff;
              const cost = dp[i - 1][pIdx] + stepCost;
              if (cost < minCost) {
                minCost = cost;
                bestPrev = pIdx;
              }
            });
            dp[i][cIdx] = minCost;
            parent[i][cIdx] = bestPrev;
          });
        }
      }

      // Backtrack
      let bestEndIdx = 0;
      let minEndCost = Infinity;
      validCandidates[n - 1].forEach((cand, idx) => {
        if (dp[n - 1][idx] < minEndCost) {
          minEndCost = dp[n - 1][idx];
          bestEndIdx = idx;
        }
      });

      const path = new Array(n);
      let currIdx = bestEndIdx;
      for (let i = n - 1; i >= 0; i--) {
        path[i] = { ...validCandidates[i][currIdx] };
        currIdx = parent[i][currIdx];
      }
      return path;
    }

    algoUrlinie(candidatesByChord) {
      const n = candidatesByChord.length;
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      const deg5PC = (tonicPC + 7) % 12;
      const deg3PC = (tonicPC + 4) % 12;

      const path = [];
      let currentTargetMidi = 72 + tonicPC; // Tonic octave 5

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 58 && c.midi <= 82);
        if (i === 0) {
          // Start on 5th or 3rd in upper octave
          const startCand = cands.find(c => c.pc === deg5PC && c.midi >= 67) ||
                            cands.find(c => c.pc === deg3PC && c.midi >= 64) ||
                            cands.find(c => c.midi >= 67) || cands[0];
          path.push({ ...startCand });
          currentTargetMidi = startCand.midi;
        } else if (i === n - 1) {
          // End on tonic root ^1
          const endCand = cands.find(c => c.pc === tonicPC && c.midi <= currentTargetMidi) ||
                          cands.find(c => c.pc === tonicPC) ||
                          cands.find(c => Math.abs(c.midi - (60 + tonicPC)) < 5) || cands[0];
          path.push({ ...endCand });
        } else {
          // Step downward towards tonic
          const progress = i / (n - 1);
          const idealMidi = currentTargetMidi - progress * 7;
          let best = cands[0];
          let bestDiff = 999;
          cands.forEach(c => {
            // Must not leap higher than previous note
            const leapPenalty = c.midi > path[i - 1].midi ? 10 : 0;
            const diff = Math.abs(c.midi - idealMidi) + leapPenalty;
            if (diff < bestDiff) {
              bestDiff = diff;
              best = c;
            }
          });
          path.push({ ...best });
        }
      }
      return path;
    }

    algoCounterpointLeap(candidatesByChord) {
      const n = candidatesByChord.length;
      const path = [];
      let shouldLeapUp = true;

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 55 && c.midi <= 79);
        if (i === 0) {
          const start = cands.find(c => c.role === 'root' && c.midi <= 65) || cands[0];
          path.push({ ...start });
        } else {
          const prev = path[i - 1];
          if (shouldLeapUp) {
            // Find a chord tone 4 to 8 semitones higher
            const leapUp = cands.filter(c => c.midi - prev.midi >= 4 && c.midi - prev.midi <= 9);
            if (leapUp.length > 0) {
              path.push({ ...leapUp[0] });
              shouldLeapUp = false; // Next is recovery
            } else {
              // Fallback closest
              const best = cands.reduce((prevC, currC) => Math.abs(currC.midi - prev.midi) < Math.abs(prevC.midi - prev.midi) ? currC : prevC);
              path.push({ ...best });
            }
          } else {
            // Stepwise recovery downwards (1 to 3 semitones lower)
            const stepDown = cands.filter(c => prev.midi - c.midi >= 1 && prev.midi - c.midi <= 4);
            if (stepDown.length > 0) {
              path.push({ ...stepDown[0] });
              shouldLeapUp = true;
            } else {
              const best = cands.reduce((prevC, currC) => Math.abs(currC.midi - prev.midi) < Math.abs(prevC.midi - prev.midi) ? currC : prevC);
              path.push({ ...best });
              shouldLeapUp = true;
            }
          }
        }
      }
      return path;
    }

    algoGuideToneThread(candidatesByChord) {
      const n = candidatesByChord.length;
      const path = [];
      let targetRole = 'third'; // Alternate 3rd and 7th

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 58 && c.midi <= 76);
        // Find 3rd or 7th
        let match = cands.find(c => c.role === targetRole);
        if (!match) {
          // If 7th not in triad, fall back to 3rd or closest extension
          match = cands.find(c => c.role === (targetRole === 'third' ? 'seventh' : 'third')) ||
                  cands.find(c => c.role === 'extension') ||
                  cands.find(c => c.role === 'third') || cands[0];
        }

        // Keep close to previous note if possible
        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const samePCs = candidatesByChord[i].filter(c => c.pc === match.pc);
          let closest = match;
          let minDiff = 999;
          samePCs.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          match = closest;
        }

        path.push({ ...match });
        targetRole = targetRole === 'third' ? 'seventh' : 'third';
      }
      return path;
    }

    algoLigonLine1(candidatesByChord) {
      // 3-2-1-7 outline: Starts on 3rd, steps down to 2nd, root, and 7th
      const n = candidatesByChord.length;
      const path = [];

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 57 && c.midi <= 77);
        const stepInPattern = i % 4;
        let chosen = null;

        if (stepInPattern === 0) {
          // 3rd
          chosen = cands.find(c => c.role === 'third');
        } else if (stepInPattern === 1) {
          // 2nd / 9th or stepwise down from prev
          chosen = cands.find(c => c.deg === 2 || c.roleLabel === '9th');
        } else if (stepInPattern === 2) {
          // 1 / Root
          chosen = cands.find(c => c.role === 'root');
        } else {
          // 7th
          chosen = cands.find(c => c.role === 'seventh');
        }

        if (!chosen && i > 0) {
          // Fall back to closest chord tone stepping downward
          const prevMidi = path[i - 1].midi;
          chosen = cands.find(c => prevMidi - c.midi >= 1 && prevMidi - c.midi <= 3) ||
                   cands.reduce((prevC, currC) => Math.abs(currC.midi - prevMidi) < Math.abs(prevC.midi - prevMidi) ? currC : prevC);
        } else if (!chosen) {
          chosen = cands[0];
        }

        path.push({ ...chosen });
      }
      return path;
    }

    algoUpperStructure(candidatesByChord) {
      const path = [];
      candidatesByChord.forEach((cands, i) => {
        // Find highest degree or extension (13th, 11th, 9th, 7th)
        const upper = cands.filter(c => c.role === 'extension' || c.role === 'seventh');
        let chosen = null;
        if (upper.length > 0) {
          // Choose upper in high register (octave 4 or 5)
          chosen = upper.find(c => c.midi >= 67 && c.midi <= 81) || upper[upper.length - 1];
        } else {
          // Highest chord tone (5th or 3rd in octave 5)
          const high = cands.filter(c => c.midi >= 65 && c.midi <= 81);
          chosen = high.length > 0 ? high[high.length - 1] : cands[cands.length - 1];
        }

        // Minimize giant leaps from previous note
        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const candidatesSameRole = cands.filter(c => c.pc === chosen.pc);
          let closest = chosen;
          let minDiff = 999;
          candidatesSameRole.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          chosen = closest;
        }

        path.push({ ...chosen });
      });
      return path;
    }

    algoBlueNoteCurl(candidatesByChord) {
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      const b3PC = (tonicPC + 3) % 12;
      const b5PC = (tonicPC + 6) % 12;
      const b7PC = (tonicPC + 10) % 12;

      const path = [];
      candidatesByChord.forEach((cands, i) => {
        const chord = this.chords[i];
        // Check if chord has b3, b5, or b7
        let match = cands.find(c => c.pc === b3PC && c.midi >= 60 && c.midi <= 75) ||
                    cands.find(c => c.pc === b5PC && c.midi >= 60 && c.midi <= 75) ||
                    cands.find(c => c.pc === b7PC && c.midi >= 60 && c.midi <= 75) ||
                    cands.find(c => c.role === 'third' && c.midi >= 60 && c.midi <= 75) ||
                    cands.find(c => c.role === 'seventh') ||
                    cands[0];

        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const variants = cands.filter(c => c.pc === match.pc);
          let closest = match;
          let minDiff = 999;
          variants.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          match = closest;
        }

        path.push({ ...match });
      });
      return path;
    }

    algoBBKingBox(candidatesByChord) {
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      const maj6PC = (tonicPC + 9) % 12;
      const maj9PC = (tonicPC + 2) % 12;
      const rootPC = tonicPC;

      const path = [];
      candidatesByChord.forEach((cands, i) => {
        // Seek major 6th, 9th, or 3rd in upper octave (MIDI 68-80)
        let match = cands.find(c => c.pc === maj6PC && c.midi >= 67 && c.midi <= 81) ||
                    cands.find(c => c.pc === maj9PC && c.midi >= 67 && c.midi <= 81) ||
                    cands.find(c => c.role === 'third' && c.midi >= 64 && c.midi <= 78) ||
                    cands.find(c => c.pc === rootPC && c.midi >= 70) ||
                    cands.find(c => c.midi >= 67 && c.midi <= 79) || cands[0];

        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const variants = cands.filter(c => c.pc === match.pc);
          let closest = match;
          let minDiff = 999;
          variants.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          match = closest;
        }

        path.push({ ...match });
      });
      return path;
    }

    algoDeltaTurnaround(candidatesByChord) {
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      const deltaLinePCs = [
        tonicPC,
        (tonicPC + 10) % 12, // b7
        (tonicPC + 9) % 12,  // 6
        (tonicPC + 8) % 12,  // b6
        (tonicPC + 7) % 12   // 5
      ];

      const n = candidatesByChord.length;
      const path = [];
      let baseMidi = 60 + tonicPC; // Octave 4

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i];
        const linePC = deltaLinePCs[i % deltaLinePCs.length];
        let match = cands.find(c => c.pc === linePC) ||
                    cands.find(c => c.role === 'seventh' || c.role === 'fifth') ||
                    cands[0];

        if (i > 0) {
          // Must step downwards smoothly
          const prevMidi = path[i - 1].midi;
          const variants = cands.filter(c => c.pc === match.pc);
          let best = match;
          let minDiff = 999;
          variants.forEach(c => {
            const step = prevMidi - c.midi;
            const diff = Math.abs(step - 1); // ideal step is 1 semitone down
            if (diff < minDiff) {
              minDiff = diff;
              best = c;
            }
          });
          match = best;
        }

        path.push({ ...match });
      }
      return path;
    }

    algoEmotionalThirds(candidatesByChord) {
      const path = [];
      candidatesByChord.forEach((cands, i) => {
        let third = cands.find(c => c.role === 'third' && c.midi >= 58 && c.midi <= 76);
        if (!third) {
          third = cands.find(c => c.role === 'third') || cands[0];
        }

        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const samePC = cands.filter(c => c.pc === third.pc);
          let closest = third;
          let minDiff = 999;
          samePC.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          third = closest;
        }

        path.push({ ...third });
      });
      return path;
    }

    algoHeroicAscent(candidatesByChord) {
      const n = candidatesByChord.length;
      const path = [];

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i];
        // Target 5ths and Roots in climbing registers
        const targetOctaveMin = 55 + Math.floor((i / n) * 14); // Climbs from ~55 to ~69+
        const heroicCands = cands.filter(c => (c.role === 'fifth' || c.role === 'root') && c.midi >= targetOctaveMin);
        let chosen = heroicCands.length > 0 ? heroicCands[0] : cands.find(c => c.midi >= targetOctaveMin) || cands[cands.length - 1];

        if (i > 0 && chosen.midi < path[i - 1].midi) {
          // Ensure ascending or sustaining contour
          const higherCands = cands.filter(c => c.midi >= path[i - 1].midi);
          if (higherCands.length > 0) chosen = higherCands[0];
        }

        path.push({ ...chosen });
      }
      return path;
    }

    algoSighingFalls(candidatesByChord) {
      const path = [];
      candidatesByChord.forEach((cands, i) => {
        if (i % 2 === 0) {
          // Tension note (9th, 4th, #11, or high 5th)
          const tension = cands.find(c => (c.role === 'extension' || c.deg === 2 || c.deg === 4) && c.midi >= 64) ||
                          cands.find(c => c.midi >= 67) || cands[0];
          path.push({ ...tension });
        } else {
          // Sigh downward by 1 or 2 semitones into 3rd or root
          const prevMidi = path[i - 1].midi;
          const fallCands = cands.filter(c => prevMidi - c.midi >= 1 && prevMidi - c.midi <= 3);
          const resolution = fallCands.length > 0 ? fallCands[0] :
                             cands.find(c => c.role === 'third' || c.role === 'root') || cands[0];
          path.push({ ...resolution });
        }
      });
      return path;
    }

    algoStadiumAnchor(candidatesByChord) {
      // Find single pitch class present across the most chords
      const pcCounts = new Array(12).fill(0);
      this.chords.forEach(chord => {
        const pcs = chord.pitchClasses || [chord.rootPC];
        pcs.forEach(pc => pcCounts[pc]++);
      });

      // Prefer key tonic or dominant if tie
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      pcCounts[tonicPC] += 0.5;
      pcCounts[(tonicPC + 7) % 12] += 0.4;

      let bestPC = 0;
      let maxCount = -1;
      pcCounts.forEach((cnt, pc) => {
        if (cnt > maxCount) {
          maxCount = cnt;
          bestPC = pc;
        }
      });

      const anchorMidi = 60 + bestPC + (bestPC < 4 ? 12 : 0); // Octave 4-5
      const path = [];

      candidatesByChord.forEach(cands => {
        // Find exact match or closest note
        const exact = cands.find(c => c.pc === bestPC && Math.abs(c.midi - anchorMidi) <= 6);
        if (exact) {
          path.push({ ...exact });
        } else {
          // Closest chord tone to anchor drone
          const closest = cands.reduce((prevC, currC) => Math.abs(currC.midi - anchorMidi) < Math.abs(prevC.midi - anchorMidi) ? currC : prevC);
          path.push({ ...closest });
        }
      });
      return path;
    }

    algoPentatonicHighway(candidatesByChord) {
      const tonicPC = this.keyInfo ? this.keyInfo.tonicPC : (this.chords[0] ? this.chords[0].rootPC : 0);
      const isMinor = this.keyInfo && this.keyInfo.scaleType && this.keyInfo.scaleType.includes('minor');
      const pentatonicIntervals = isMinor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
      const pentatonicPCs = pentatonicIntervals.map(i => (tonicPC + i) % 12);

      const path = [];
      candidatesByChord.forEach((cands, i) => {
        const pentaCands = cands.filter(c => pentatonicPCs.includes(c.pc) && c.midi >= 58 && c.midi <= 77);
        let chosen = pentaCands.length > 0 ? pentaCands[0] : cands[0];

        if (i > 0 && pentaCands.length > 0) {
          const prevMidi = path[i - 1].midi;
          chosen = pentaCands.reduce((prevC, currC) => Math.abs(currC.midi - prevMidi) < Math.abs(prevC.midi - prevMidi) ? currC : prevC);
        }

        path.push({ ...chosen });
      });
      return path;
    }

    algoPopArch(candidatesByChord) {
      const n = candidatesByChord.length;
      const mid = Math.floor(n / 2);
      const path = [];

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i];
        // Target register rises to peak at mid then falls
        const progress = 1 - Math.abs(i - mid) / (mid || 1); // 0 at ends, 1 at center
        const targetMidi = 60 + Math.round(progress * 12); // From ~C4 to ~C5

        const chosen = cands.reduce((prevC, currC) => Math.abs(currC.midi - targetMidi) < Math.abs(prevC.midi - targetMidi) ? currC : prevC);
        path.push({ ...chosen });
      }
      return path;
    }

    algoLydianSpace(candidatesByChord) {
      const path = [];
      candidatesByChord.forEach((cands, i) => {
        // Seek #11 (interval 6) or Maj7 (interval 11) or 9th (interval 2)
        const spaceCands = cands.filter(c => (c.interval === 6 || c.interval === 11 || c.interval === 2 || c.roleLabel === '#11') && c.midi >= 64);
        let chosen = spaceCands.length > 0 ? spaceCands[0] : cands.find(c => c.role === 'third' && c.midi >= 64) || cands[0];

        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const variants = cands.filter(c => c.pc === chosen.pc);
          let closest = chosen;
          let minDiff = 999;
          variants.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          chosen = closest;
        }

        path.push({ ...chosen });
      });
      return path;
    }

    algoPhrygianCrush(candidatesByChord) {
      const path = [];
      candidatesByChord.forEach((cands, i) => {
        // Seek b2 (interval 1) or b6 (interval 8) or minor 3rd
        const crushCands = cands.filter(c => (c.interval === 1 || c.interval === 8 || c.roleLabel === 'b2') && c.midi >= 57 && c.midi <= 76);
        let chosen = crushCands.length > 0 ? crushCands[0] : cands.find(c => c.role === 'root' || c.role === 'third') || cands[0];

        if (i > 0) {
          const prevMidi = path[i - 1].midi;
          const variants = cands.filter(c => c.pc === chosen.pc);
          let closest = chosen;
          let minDiff = 999;
          variants.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          });
          chosen = closest;
        }

        path.push({ ...chosen });
      });
      return path;
    }

    algoAngularTritones(candidatesByChord) {
      const n = candidatesByChord.length;
      const path = [];

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 58 && c.midi <= 80);
        if (i === 0) {
          path.push({ ...cands[0] });
        } else {
          const prevMidi = path[i - 1].midi;
          // Prefer tritone (+-6st) or M7 (+-11st) or widest leap
          let best = cands[0];
          let bestScore = -999;

          cands.forEach(c => {
            const diff = Math.abs(c.midi - prevMidi);
            let score = 0;
            if (diff === 6) score = 100; // Perfect tritone
            else if (diff === 11 || diff === 13) score = 85; // M7 / m9
            else if (diff >= 5 && diff <= 8) score = 50;
            else score = -diff; // Penalize small steps for angularity

            if (score > bestScore) {
              bestScore = score;
              best = c;
            }
          });
          path.push({ ...best });
        }
      }
      return path;
    }

    algoChromaticSlide(candidatesByChord) {
      const n = candidatesByChord.length;
      const path = [];

      for (let i = 0; i < n; i++) {
        const cands = candidatesByChord[i].filter(c => c.midi >= 58 && c.midi <= 78);
        if (i === 0) {
          const start = cands.find(c => c.role === 'third') || cands[0];
          path.push({ ...start });
        } else {
          const prevMidi = path[i - 1].midi;
          // Prefer half step (|diff| === 1)
          const halfStep = cands.find(c => Math.abs(c.midi - prevMidi) === 1);
          if (halfStep) {
            path.push({ ...halfStep });
          } else {
            // Common tone (0st) or whole step (2st)
            const closest = cands.reduce((prevC, currC) => Math.abs(currC.midi - prevMidi) < Math.abs(prevC.midi - prevMidi) ? currC : prevC);
            path.push({ ...closest });
          }
        }
      }
      return path;
    }

    algoRingingAnchor(candidatesByChord) {
      // Pick high ringing pitch: E5 (76), B4 (71), or D5 (74)
      const droneOptions = [71, 74, 76, 72, 69];
      let bestDrone = 76;
      let minDeviation = 999;

      droneOptions.forEach(targetMidi => {
        let dev = 0;
        candidatesByChord.forEach(cands => {
          const closest = cands.reduce((prevC, currC) => Math.abs(currC.midi - targetMidi) < Math.abs(prevC.midi - targetMidi) ? currC : prevC);
          dev += Math.abs(closest.midi - targetMidi);
        });
        if (dev < minDeviation) {
          minDeviation = dev;
          bestDrone = targetMidi;
        }
      });

      const path = [];
      candidatesByChord.forEach(cands => {
        const closest = cands.reduce((prevC, currC) => Math.abs(currC.midi - bestDrone) < Math.abs(prevC.midi - bestDrone) ? currC : prevC);
        path.push({ ...closest });
      });
      return path;
    }

    /**
     * Get motion statistics for current pathway
     */
    getStatistics() {
      if (!this.activeMelodyNodes || this.activeMelodyNodes.length === 0) {
        return { totalMotion: 0, avgMotion: 0, commonTones: 0, steps: 0, leaps: 0, tritoneLeaps: 0 };
      }

      let totalMotion = 0;
      let commonTones = 0;
      let steps = 0;
      let leaps = 0;
      let tritoneLeaps = 0;
      const numTransitions = this.activeMelodyNodes.length - 1;

      for (let i = 1; i < this.activeMelodyNodes.length; i++) {
        const delta = Math.abs(this.activeMelodyNodes[i].deltaSemitones);
        totalMotion += delta;
        if (delta === 0) commonTones++;
        else if (delta <= 2) steps++;
        else if (delta === 6) { leaps++; tritoneLeaps++; }
        else leaps++;
      }

      const avgMotion = numTransitions > 0 ? (totalMotion / numTransitions).toFixed(1) : '0.0';
      const commonPct = numTransitions > 0 ? Math.round((commonTones / numTransitions) * 100) : 0;

      return {
        totalMotion,
        avgMotion,
        commonTones,
        commonPct,
        steps,
        leaps,
        tritoneLeaps
      };
    }
  }

  /**
   * RibbonCanvasRenderer
   * High-DPI interactive HTML5 Canvas visualizer.
   */
  class RibbonCanvasRenderer {
    constructor(canvas, engine) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.engine = engine;
      this.activeChordIdx = -1; // Active playback step
      this.hoveredNode = null;
      this.interactiveNodes = []; // Cached hitboxes for clicks
      this.pulseAnimation = null;
      this.pulsePhase = 0;
      this.isExtraTall = false;

      this.initEvents();
    }

    initEvents() {
      this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
      this.canvas.addEventListener('click', (e) => this.handleClick(e));
      this._resizeRafId = null;
      this._needsResize = false;
      this.onWindowResize = () => {
        if (this._resizeRafId) cancelAnimationFrame(this._resizeRafId);
        this._resizeRafId = requestAnimationFrame(() => {
          this._resizeRafId = null;
          this.handleResize();
        });
      };
      window.addEventListener('resize', this.onWindowResize);
    }

    handleResize(force = false) {
      if (!this.canvas || !this.canvas.parentElement) return;
      if (!force && this.canvas.offsetParent === null) {
        this._needsResize = true;
        return;
      }
      this._needsResize = false;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      // Stretched height so all notes under chord names have generous vertical breathing room
      const baseHeight = this.isExtraTall ? 680 : 540;
      const height = Math.min(Math.max(width * (this.isExtraTall ? 1.05 : 0.88), baseHeight), this.isExtraTall ? 780 : 640);

      const dpr = window.devicePixelRatio || 1;
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

    toggleHeight() {
      this.isExtraTall = !this.isExtraTall;
      this.handleResize();
      return this.isExtraTall;
    }

    findNodeAt(clientX, clientY) {
      if (!this.canvas || !this.interactiveNodes || this.interactiveNodes.length === 0) return null;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / (rect.width || 1);
      const scaleY = this.height / (rect.height || 1);
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      let bestNode = null;
      let minDistance = Infinity;

      for (const node of this.interactiveNodes) {
        const dist = Math.hypot(node.x - x, node.y - y);
        if (dist <= Math.max(20, node.radius + 8) && dist < minDistance) {
          minDistance = dist;
          bestNode = node;
        }
      }

      return bestNode;
    }

    handleMouseMove(e) {
      const found = this.findNodeAt(e.clientX, e.clientY);
      if (this.hoveredNode !== found) {
        this.hoveredNode = found;
        this.canvas.style.cursor = found ? 'pointer' : 'default';
        this.render();
      }
    }

    handleMouseLeave() {
      if (this.hoveredNode) {
        this.hoveredNode = null;
        this.canvas.style.cursor = 'default';
        this.render();
      }
    }

    handleClick(e) {
      const found = this.findNodeAt(e.clientX, e.clientY) || this.hoveredNode;
      if (found) {
        const n = found;
        this.engine.setCustomNode(n.chordIndex, n.candidate);

        // Immediate audible pitch preview when clicking any node
        if (window.audio && window.audio.playMelodyPreviewNote) {
          window.audio.playMelodyPreviewNote(n.candidate.scientific, '4n');
        }

        if (this.onCustomNodeChanged) {
          this.onCustomNodeChanged(n.chordIndex, n.candidate);
        }
        this.render();
      }
    }

    setActiveStep(chordIdx) {
      this.activeChordIdx = chordIdx;
      if (chordIdx >= 0 && (!this.canvas || this.canvas.offsetParent !== null) && !this.pulseAnimation) {
        this.startPulseAnimation();
      } else if ((chordIdx < 0 || (this.canvas && this.canvas.offsetParent === null)) && this.pulseAnimation) {
        cancelAnimationFrame(this.pulseAnimation);
        this.pulseAnimation = null;
      }
      this.render();
    }

    startPulseAnimation() {
      let lastRender = 0;
      const targetInterval = 1000 / 30; // Cap pulse animation at ~30 FPS

      const step = (ts) => {
        if (this.activeChordIdx >= 0 && (!this.canvas || this.canvas.offsetParent !== null)) {
          if (!ts || ts - lastRender >= targetInterval) {
            lastRender = ts || performance.now();
            this.pulsePhase = (this.pulsePhase + 0.08) % (Math.PI * 2);
            this.render();
          }
          this.pulseAnimation = requestAnimationFrame(step);
        } else {
          this.pulseAnimation = null;
        }
      };
      this.pulseAnimation = requestAnimationFrame(step);
    }

    render() {
      if (!this.ctx) return;
      if (this.canvas && this.canvas.offsetParent === null) return; // Skip rendering when hidden on inactive tab
      if (this._needsResize || !this.width || !this.height) {
        this.handleResize(true);
      }
      if (!this.width || !this.height) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Grid & subtle background lanes
      const chords = this.engine.chords;
      if (!chords || chords.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px var(--font-stack, sans-serif)';
        ctx.textAlign = 'center';
        ctx.fillText('Enter or load a chord progression above to see the Voice Leading Ribbon.', w / 2, h / 2);
        return;
      }

      const numChords = chords.length;
      const padX = Math.max(w * 0.08, 60);
      const padTop = 75;
      const padBottom = 50;
      const availableW = w - padX * 2;
      const availableH = h - padTop - padBottom;
      const colStep = numChords > 1 ? availableW / (numChords - 1) : availableW;

      // Determine pitch range across all candidates for vertical scaling
      let minMidi = 48; // C3
      let maxMidi = 84; // C6
      const allCandidates = chords.map(c => this.engine.getCandidatesForChord(c));
      allCandidates.forEach(cands => {
        cands.forEach(c => {
          if (c.midi < minMidi) minMidi = c.midi;
          if (c.midi > maxMidi) maxMidi = c.midi;
        });
      });
      minMidi = Math.max(36, minMidi - 2);
      maxMidi = Math.min(88, maxMidi + 2);
      const midiSpan = Math.max(maxMidi - minMidi, 12);

      const midiToY = (midi) => {
        // High pitch at top, low pitch at bottom
        const ratio = (midi - minMidi) / midiSpan;
        return (padTop + availableH) - (ratio * availableH);
      };

      const colToX = (idx) => {
        return numChords > 1 ? padX + idx * colStep : w / 2;
      };

      // 1. Draw Column Dividers and Chord Labels
      ctx.textAlign = 'center';
      for (let i = 0; i < numChords; i++) {
        const x = colToX(i);
        const chord = chords[i];
        const isActiveCol = (i === this.activeChordIdx);

        // Column background highlight if active playback
        if (isActiveCol) {
          ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
          const colW = numChords > 1 ? colStep : w;
          ctx.fillRect(x - colW / 2, 8, colW, h - 16);
        }

        // Vertical dashed grid line
        ctx.strokeStyle = isActiveCol ? 'rgba(245, 158, 11, 0.4)' : 'rgba(51, 65, 85, 0.35)';
        ctx.lineWidth = isActiveCol ? 2 : 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 48);
        ctx.lineTo(x, h - padBottom + 12);
        ctx.stroke();
        ctx.setLineDash([]);

        // Chord Header Pill at top (elevated, styled badge with clear breathing room)
        const chordName = chord.displayName || chord.rawSymbol || 'Chord';
        ctx.font = isActiveCol ? 'bold 15px monospace' : '600 13px monospace';
        const chordMetrics = ctx.measureText(chordName);
        const pillW = Math.max(chordMetrics.width + 20, 52);
        const pillH = 26;
        const pillY = 14;

        ctx.fillStyle = isActiveCol ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.88)';
        ctx.strokeStyle = isActiveCol ? '#f59e0b' : '#334155';
        ctx.lineWidth = isActiveCol ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x - pillW / 2, pillY, pillW, pillH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isActiveCol ? '#fbbf24' : '#e2e8f0';
        ctx.textBaseline = 'middle';
        ctx.fillText(chordName, x, pillY + pillH / 2);

        // Chord Roman Numeral at bottom if available
        if (chord.romanNumeral) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.fillText(chord.romanNumeral, x, h - 22);
        }
      }

      // 2. Draw Translucent SATB Comping Strands (Harmony Voices)
      const satb = this.engine.satbVoices;
      if (satb && satb.length === 4) {
        const satbColors = [
          'rgba(56, 189, 248, 0.22)',  // Bass (Cyan)
          'rgba(148, 163, 184, 0.22)', // Tenor (Slate)
          'rgba(129, 140, 248, 0.22)', // Alto (Indigo)
          'rgba(244, 114, 182, 0.22)'  // Soprano (Rose)
        ];

        satb.forEach((line, vIdx) => {
          if (line.length < 2) return;
          ctx.strokeStyle = satbColors[vIdx];
          ctx.lineWidth = 2.5;
          ctx.beginPath();

          for (let i = 0; i < line.length; i++) {
            const x = colToX(i);
            const y = midiToY(line[i].midi);
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              const prevX = colToX(i - 1);
              const prevY = midiToY(line[i - 1].midi);
              const cpX = (prevX + x) / 2;
              ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
            }
          }
          ctx.stroke();
        });
      }

      // 3. Clear and Rebuild Interactive Candidate Nodes
      this.interactiveNodes = [];
      allCandidates.forEach((cands, chordIdx) => {
        const x = colToX(chordIdx);
        cands.forEach(cand => {
          const y = midiToY(cand.midi);
          this.interactiveNodes.push({
            chordIndex: chordIdx,
            candidate: cand,
            x,
            y,
            radius: 8
          });
        });
      });

      // 4. Draw Background Candidate Chord Tone Nodes
      this.interactiveNodes.forEach(node => {
        const cand = node.candidate;
        const isHovered = (this.hoveredNode && this.hoveredNode.candidate.scientific === cand.scientific && this.hoveredNode.chordIndex === node.chordIndex);

        ctx.fillStyle = isHovered ? '#38bdf8' : '#1e293b';
        ctx.strokeStyle = isHovered ? '#ffffff' : '#475569';
        ctx.lineWidth = isHovered ? 2 : 1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? 11 : 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Note spelling text on node
        ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cand.noteName, node.x, node.y);
      });

      // 5. Draw Glowing Foreground Solo Melodic Strand
      const melodyNodes = this.engine.activeMelodyNodes;
      if (melodyNodes && melodyNodes.length > 1) {
        // Outer Bloom / Glow
        ctx.save();
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4.5;
        ctx.beginPath();

        for (let i = 0; i < melodyNodes.length; i++) {
          const x = colToX(i);
          const y = midiToY(melodyNodes[i].midi);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = colToX(i - 1);
            const prevY = midiToY(melodyNodes[i - 1].midi);
            const cpX = (prevX + x) / 2;
            ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
          }
        }
        ctx.stroke();

        // Inner Core Strand (Bright Gold Core)
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        ctx.restore();
      }

      // 6. Draw Semitone Motion Badges between melody steps
      if (melodyNodes && melodyNodes.length > 1) {
        for (let i = 1; i < melodyNodes.length; i++) {
          const prevX = colToX(i - 1);
          const prevY = midiToY(melodyNodes[i - 1].midi);
          const currX = colToX(i);
          const currY = midiToY(melodyNodes[i].midi);

          const midX = (prevX + currX) / 2;
          const midY = (prevY + currY) / 2;
          const badgeText = melodyNodes[i].deltaBadge;
          const delta = melodyNodes[i].deltaSemitones;

          // Color palette for badges
          let bgBadge = '#0284c7'; // 0st (Blue)
          let borderBadge = '#38bdf8';
          const abs = Math.abs(delta);
          if (abs === 1) { bgBadge = '#15803d'; borderBadge = '#4ade80'; } // Green
          else if (abs === 2) { bgBadge = '#047857'; borderBadge = '#34d399'; } // Emerald
          else if (abs <= 5) { bgBadge = '#b45309'; borderBadge = '#fbbf24'; } // Amber
          else if (abs === 6) { bgBadge = '#7e22ce'; borderBadge = '#c084fc'; } // Tritone Purple
          else { bgBadge = '#be185d'; borderBadge = '#f472b6'; } // Wide Leap Pink

          ctx.font = 'bold 10px monospace';
          const textMetrics = ctx.measureText(badgeText);
          const bw = textMetrics.width + 12;
          const bh = 18;
          const rx = midX - bw / 2;
          const ry = midY - bh / 2;

          // Rounded rectangle pill
          ctx.fillStyle = bgBadge;
          ctx.strokeStyle = borderBadge;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(rx, ry, bw, bh, 9);
          ctx.fill();
          ctx.stroke();

          // Badge text
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, midX, midY + 0.5);
        }
      }

      // 7. Draw Foreground Melody Nodes (Large Glowing Circles)
      if (melodyNodes) {
        melodyNodes.forEach((mNode, chordIdx) => {
          const x = colToX(chordIdx);
          const y = midiToY(mNode.midi);
          const isActive = (chordIdx === this.activeChordIdx);
          const isOverridden = !!this.engine.customOverrides[chordIdx];

          // Animated pulse ring if active playback note
          if (isActive) {
            const pulseRadius = 14 + Math.sin(this.pulsePhase) * 6;
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Node shadow glow
          ctx.save();
          ctx.shadowColor = isOverridden ? '#06b6d4' : '#fbbf24';
          ctx.shadowBlur = 10;
          ctx.fillStyle = isOverridden ? '#0891b2' : '#d97706';
          ctx.strokeStyle = isOverridden ? '#67e8f9' : '#fef08a';
          ctx.lineWidth = 2.5;

          ctx.beginPath();
          ctx.arc(x, y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Pitch text inside node
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(mNode.noteName, x, y);

          // Interval Role Tag directly above melody node (e.g. "3rd", "Root", "#11")
          const tagText = mNode.roleLabel || `${mNode.deg}`;
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = isOverridden ? '#67e8f9' : '#fef08a';
          ctx.fillText(tagText, x, y - 18);
        });
      }

      // 8. Draw Tooltip on Hover
      if (this.hoveredNode) {
        const n = this.hoveredNode;
        const cand = n.candidate;
        const tipTitle = `${cand.scientific} (${cand.roleLabel})`;
        const tipSub = `Click to set as Melody Note`;

        ctx.font = 'bold 11px sans-serif';
        const titleW = ctx.measureText(tipTitle).width;
        ctx.font = '10px sans-serif';
        const subW = ctx.measureText(tipSub).width;
        const boxW = Math.max(titleW, subW) + 20;
        const boxH = 42;

        let boxX = n.x + 14;
        if (boxX + boxW > w - 10) boxX = n.x - boxW - 14;
        let boxY = n.y - boxH / 2;
        if (boxY < 10) boxY = 10;
        if (boxY + boxH > h - 10) boxY = h - boxH - 10;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(tipTitle, boxX + 10, boxY + 8);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px sans-serif';
        ctx.fillText(tipSub, boxX + 10, boxY + 24);
      }
    }
  }

  // Export globally
  window.VOICE_LEADING_SCHOOLS = VOICE_LEADING_SCHOOLS;
  window.VoiceLeadingEngine = VoiceLeadingEngine;
  window.RibbonCanvasRenderer = RibbonCanvasRenderer;

})(window);
