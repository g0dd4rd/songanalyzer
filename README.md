# Song Analyzer

An all-in-one, responsive, single-page music theory companion and practice studio for musicians, composers, and students. Built with vanilla HTML5, CSS3, and JavaScript, powered by a custom zero-allocation native Web Audio synthesis engine for warm FM and subtractive audio synthesis, running **100% locally and offline** with zero external network dependencies.

## Key Features

1. **Harmonic Progression & Key Center Analyzer**:
   - Parses arbitrary chord symbols (triads, 7ths, 9ths, altered dominants, slash chords).
   - Detects tonal centers & candidate keys (Major, Minor, Modes) with percentage fit scores.
   - Computes Roman numeral analysis ($\text{ii}^7 - \text{V}^7 - \text{I}^{\Delta7}$), identifies secondary dominants ($\text{V}^7/\text{ii}$), modal interchange (minor $\text{iv}$, $\flat\text{VI}$), and tritone substitutions.
   - Generates interactive tables with chord tones, scale degrees, and inline chord/arpeggio playback.

2. **Switchable HTML5 Canvas Visualizers**:
   - **Pitch Constellation Clock**: Base-12 ($\mathbb{Z}_{12}$) modular clock diagram rendering chords as geometric polygons (triangles, squares, pentagons) with color-coded interval roles.
   - **Interactive Piano Keyboard**: Multi-octave keyboard highlighting chord tones and interval badges, clickable to trigger notes.
   - **Guitar & Bass Fretboard**: 6-string guitar (EADGBE) or 4-string bass (EADG) displaying fret markers and chord tone fingerings across the neck.

3. **Base-12 Modal Interchange & Mood-Shifting Engine**:
   - Re-harmonizes any scale-degree progression across all 7 parallel diatonic modes (Locrian, Phrygian, Aeolian, Dorian, Mixolydian, Ionian, Lydian).
   - One-click auditioning with warm FM electric piano tone.

4. **Musician's Jam Deck (The Chord Card Game)**:
   - Emulates pulling chord cards out of a hat for songwriting and improvisation challenges.
   - Draggable / reorderable chord cards with card-locking and individual playback.
   - Built-in practice prompts (voice leading, pedal points, tritone subs, shell voicings).

5. **Metronome & Rhythm Studio**:
   - High-precision native Web Audio lookahead timing with subdivisions (quarter, 8ths, 16ths, triplets).
   - Woodblock, digital click, and spoken counting modes.
   - Dynamic Italian tempo marking display (Larghissimo to Prestissimo, 15 to 240 BPM).
   - **Practice Session Timer**: Tracks both Total Practice Time and current Exercise Delta Time; automatically synchronizes starting/stopping with the metronome, with exercise lap history breakdown and target exercise duration chime.
   - Unicode rhythm generator with clave audio playback, rest toggles, and loop modes (once, arbitrary N times, or indefinitely).

6. **Musician's Practice Hub & Ear Training**:
   - Interactive interval ear trainer with instant feedback.
   - Daily study challenges and drill prompts.

## Quick Start (Offline)

Simply open `index.html` in any modern web browser:
```bash
# Direct browser launch (e.g. Chrome / Firefox / Edge)
xdg-open index.html
# Or serve locally with any static HTTP server if desired:
python3 -m http.server 8000
```

## License

GPL v3

Author: Jiri Prajzner, dr3dwerkz@gmail.com, @dredwerkz



