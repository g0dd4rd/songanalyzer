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

7. **Multi-Notation Movable Chord Studio (Bass & Guitar)**:
   - Full support for 4, 5, and 6-string bass alongside 6, 7, and 8-string guitar.
   - 24 tuning presets including Standard, Drop D/A/E/C/G, DADGAD, Open D/G/C, Tenor, and Half-Step Down.
   - Movable shapes across CAGED, Drop 2 & Drop 3 jazz voicings, Jazz Shells ($R-7-3$, $R-b7-3$, $R-b7-b3$), Bass Tenths (decimas), and Heavy Power Chords with dynamic drop-tuning 1-finger barre compensation.
   - **Triple-Notation Display**:
     - *Vector SVG Chord Box*: Clean scalable vector graphics with barre capsules, interval or fingering badge toggling, and `.svg` export.
     - *Formatted Tablature (TAB)*: Dynamic string count tablature with one-click clipboard copy.
     - *Music Staff Notation*: Procedural 5-line canvas staff renderer with Treble Clef ($\text{G}_8$) for guitar and Bass Clef ($\text{F}_8$) for bass, complete with chord note stacking and accidentals.
   - Interactive root transposition slider (Frets 0–19) and zero-allocation humanized strumming (downstroke / upstroke).

8. **Persistent Session State & Backup Studio**:
   - **Seamless Debounced Auto-Save**: Preserves your entire studio state in local storage (chord progressions, movable chord instrument/tuning/shape/fret, metronome BPM/time signature/subdivision, drum machine patterns, practice session timers, tuner calibration, and mobile views).
   - **Zero Friction Mobile Resumption**: Reopening the app or returning after backgrounding immediately resumes exactly where you left off.
   - **Session Backup & Portability (.json)**: One-click export and import of complete session backups (including custom grooves, practice logs, and studio snapshots) to move sessions across phones, tablets, and desktop workstations.
   - **3 Quick Snapshot Slots**: Store and quickly switch between studio presets (e.g. Jazz Voicings, Djent 8-String, Metronome Speed Practice).
   - **Factory Reset**: One-click reset to clean defaults whenever desired.

## Quick Start & Installation

### 1. Running Locally (Desktop & LAN)

Open `index.html` directly in any modern web browser, or serve locally with any static HTTP server:
```bash
# Direct browser launch
xdg-open index.html

# Or serve locally (recommended for mobile access & PWA Service Worker):
python3 -m http.server 8000
```

To access from a mobile phone or tablet on your local Wi-Fi:
1. Find your machine's local IP address (`ip addr show` or `hostname -I`).
2. Open `http://<YOUR-LOCAL-IP>:8000` in your mobile browser.
*(Tip: You can also use Android USB debugging with `adb reverse tcp:8000 tcp:8000` to browse `http://localhost:8000` directly on your phone).*

---

### 2. Installing as a Standalone App (PWA)

Installing Song Analyzer as a Progressive Web App (PWA) gives you:
- **Full-screen standalone display**: Reclaims vertical screen space by hiding browser URL bars and navigation chrome.
- **Screen Wake Lock**: Keeps your screen awake automatically during instrument practice.
- **100% Offline Capability**: Assets and audio engines run with zero network reliance.

#### Android (Firefox)
1. Open the app in Firefox for Android.
2. Tap the three-dot menu (**⋮**) $\to$ tap **Add to Home screen** (or **Install**).

> [!IMPORTANT]
> **Xiaomi / Redmi / POCO devices (MIUI & HyperOS):**
> MIUI / HyperOS silently blocks third-party browsers from placing launcher shortcuts by default. If the icon does not appear on your home screen after confirming:
> 1. Long-press the **Firefox** app icon on your home screen or app drawer $\to$ tap **App info** (*O aplikaci* / ⓘ icon) *(or go to phone **Settings** $\to$ **Apps** $\to$ **Manage apps** $\to$ **Firefox**)*.
> 2. Tap **Other permissions** (*Ostatní oprávnění*).
> 3. Set **Home screen shortcuts** (*Zástupci na domovské obrazovce*) to **"Always allow"** (*Vždy povolit*).
> 4. *(Recommended)* Set **Display pop-up windows while running in the background** (*Zobrazovat vyskakovací okna při běhu na pozadí*) to **"Always allow"**.
> 5. Return to Firefox, tap the menu $\to$ **Add to Home screen** again. The icon will appear immediately.

#### Android (Chrome / Chromium-based browsers)
1. Open the app in Chrome.
2. Tap the three-dot menu (**⋮**) $\to$ tap **Install app** (or **Add to Home screen**).

#### iOS / iPadOS (Safari)
1. Open the app in Safari.
2. Tap the **Share** button (box with an arrow pointing upward).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.

#### Desktop (Chrome / Brave / Edge)
1. Open the app in your browser.
2. Click the **Install** icon in the right side of the address bar (or Menu $\to$ **Install Song Analyzer**).

## License

See [LICENSE](LICENSE) for details.

Author: Jiri Prajzner, dr3dwerkz@gmail.com, @dredwerkz



