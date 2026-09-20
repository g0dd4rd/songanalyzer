/**
 * Song Analyzer - Base-12 Scales, Modes & Mood Engine (js/scales.js)
 * Classic JS Module (works 100% offline over file:// with zero dependencies)
 *
 * Provides a comprehensive catalog of scales ranging from 4-tone to 12-tone systems:
 * - 4-tone: Tetratonics (Ancient Greek tetrachords, Diminished 7th, Slendro chant)
 * - 5-tone: Pentatonics (Major/Minor, Japanese Hirajoshi/Insen/Iwato, Indian Ragas, Jazz)
 * - 6-tone: Hexatonics (Blues, Whole-Tone, Symmetrical Augmented, Prometheus, Istrian)
 * - 7-tone: Heptatonics (Diatonic, Melodic Minor, Harmonic Minor, Harmonic Major, Double Harmonic/Byzantine, Neapolitan)
 * - 8-tone: Octatonics (Diminished Half-Whole/Whole-Half, Bebop systems, Barry Harris 6th-diminished)
 * - 9-tone: Nonatonics (Messiaen Mode 3, Composite Blues 9-tone, Tcherepnin)
 * - 10-tone: Decatonics (Messiaen Mode 4/6, Composite Bebop Decatonics)
 * - 11-tone: Hendecatonics (Incomplete Chromatics, Russell Lydian Chromatic clusters)
 * - 12-tone: Dodecatonics (Total Chromatic, All-Interval serial rows)
 *
 * Core Features:
 * 1. Modal Rotation Engine: Dynamically computes all rotational modes for any parent scale
 * 2. Acoustic Brightness & Mood Calculation: Ranks modes from Brightest to Darkest
 * 3. Scale -> Chords Harmonizer: Diatonically stacks 3rds/7ths to discover chords
 * 4. Chord -> Scale Compatibility Matcher: Recommends scales for any given chord
 */

(function (window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. Comprehensive 4-to-12 Tone Scales Database
  // -------------------------------------------------------------
  const SCALE_CATALOG = [
    // =========================================================
    // 4-TONE SCALES (TETRATONIC)
    // =========================================================
    {
      id: 'diminished7_tetra',
      name: 'Diminished 7th Tetratonic',
      cardinality: 4,
      category: 'symmetrical',
      family: 'Tetratonic',
      intervals: [0, 3, 6, 9],
      formula: '1 - b3 - b5 - bb7',
      description: 'Symmetrical minor-third divisions of the octave. Maximum suspense and chromatic transition.',
      origin: 'Classical & Jazz Harmony',
      defaultMood: 'Tense Suspense / Film Noir',
      modes: [
        { name: 'Diminished 7th (Symmetrical)', mood: 'Tense Suspense / Film Noir', brightness: -2 }
      ]
    },
    {
      id: 'major7_tetra',
      name: 'Major 7th Tetratonic',
      cardinality: 4,
      category: 'arpeggiated',
      family: 'Tetratonic',
      intervals: [0, 4, 7, 11],
      formula: '1 - 3 - 5 - 7',
      description: 'Pure harmonic major seventh skeleton. Elegant, spacious, and open.',
      origin: 'Modern Jazz & Impressionism',
      defaultMood: 'Luminous Serenity',
      modes: [
        { name: 'Major 7th Arpeggio', mood: 'Luminous Serenity', brightness: 6 },
        { name: 'Augmented Triad with b9', mood: 'Enigmatic Mystery', brightness: -1 },
        { name: 'Minor 6th Shell', mood: 'Dusk Melancholy', brightness: 1 },
        { name: 'Major 7th Inversion', mood: 'Fragile Longing', brightness: -2 }
      ]
    },
    {
      id: 'minor7_tetra',
      name: 'Minor 7th Tetratonic',
      cardinality: 4,
      category: 'arpeggiated',
      family: 'Tetratonic',
      intervals: [0, 3, 7, 10],
      formula: '1 - b3 - 5 - b7',
      description: 'Root minor seventh pitch skeleton. Foundational to soul, neo-soul, and modal jazz.',
      origin: 'Blues, Soul & Jazz',
      defaultMood: 'Soulful Intimacy',
      modes: [
        { name: 'Minor 7th Shell', mood: 'Soulful Intimacy', brightness: 0 },
        { name: 'Major 6th Inversion', mood: 'Warm Daylight', brightness: 4 },
        { name: 'Dominant Sus Shell', mood: 'Floating Modernism', brightness: 2 },
        { name: 'Quartal Shell', mood: 'Nocturnal Drift', brightness: -1 }
      ]
    },
    {
      id: 'dominant7_tetra',
      name: 'Dominant 7th Tetratonic',
      cardinality: 4,
      category: 'arpeggiated',
      family: 'Tetratonic',
      intervals: [0, 4, 7, 10],
      formula: '1 - 3 - 5 - b7',
      description: 'Essential functional dominant chord-scale skeleton. Drives blues and functional resolution.',
      origin: 'Blues & Functional Harmony',
      defaultMood: 'Earthy Drive / Restless Pull',
      modes: [
        { name: 'Dominant 7th Shell', mood: 'Earthy Drive', brightness: 3 },
        { name: 'Minor 6th Diminished Shell', mood: 'Tense Shadow', brightness: -1 },
        { name: 'Half-Diminished Inversion', mood: 'Haunted Drama', brightness: -3 },
        { name: 'Major b5 Inversion', mood: 'Unresolved Spark', brightness: 1 }
      ]
    },
    {
      id: 'greek_dorian_tetra',
      name: 'Ancient Greek Dorian Tetrachord',
      cardinality: 4,
      category: 'historical',
      family: 'Tetrachord',
      intervals: [0, 2, 3, 5],
      formula: '1 - 2 - b3 - 4',
      description: 'The ancient Hellenic tone-semitone-tone foundational building block of Western modal theory.',
      origin: 'Ancient Greece (Aristoxenus)',
      defaultMood: 'Archaic Solemnity',
      modes: [
        { name: 'Dorian Tetrachord', mood: 'Archaic Solemnity', brightness: 0 },
        { name: 'Phrygian Inversion', mood: 'Desert Shadow', brightness: -3 },
        { name: 'Lydian Inversion', mood: 'Sunlit Stone', brightness: 4 },
        { name: 'Hypodorian Fragment', mood: 'Ancient Lament', brightness: -1 }
      ]
    },
    {
      id: 'greek_phrygian_tetra',
      name: 'Ancient Greek Phrygian Tetrachord',
      cardinality: 4,
      category: 'historical',
      family: 'Tetrachord',
      intervals: [0, 1, 3, 5],
      formula: '1 - b2 - b3 - 4',
      description: 'Semitone-tone-tone building block. Imparts immediate Mediterranean, Flamenco, and Middle Eastern flavor.',
      origin: 'Ancient Greece & Mediterranean',
      defaultMood: 'Spanish Fire / Deep Lament',
      modes: [
        { name: 'Phrygian Tetrachord', mood: 'Spanish Fire', brightness: -4 },
        { name: 'Major Inversion', mood: 'Grounded Horizon', brightness: 2 },
        { name: 'Subdominant Fragment', mood: 'Open Ritual', brightness: 1 },
        { name: 'Locrian Seed', mood: 'Dread Abyss', brightness: -5 }
      ]
    },
    {
      id: 'slendro_tetra',
      name: 'Slendro 4-Tone Gamelan',
      cardinality: 4,
      category: 'world',
      family: 'Tetratonic',
      intervals: [0, 2, 5, 7],
      formula: '1 - 2 - 4 - 5',
      description: 'Ancient Indonesian ceremonial gamelan subset. Pure open 4ths and 5ths with zero tritones.',
      origin: 'Java & Bali (Gamelan)',
      defaultMood: 'Timeless Ritual / Bronze Bells',
      modes: [
        { name: 'Slendro Pathet Nem', mood: 'Timeless Ritual', brightness: 3 },
        { name: 'Slendro Pathet Sanga', mood: 'Floating Reverie', brightness: 2 },
        { name: 'Slendro Pathet Manyura', mood: 'Sacred Court', brightness: 1 },
        { name: 'Slendro Inversion', mood: 'Night Forest', brightness: -1 }
      ]
    },
    {
      id: 'bi_yu_tetra',
      name: 'Bi Yu Tetratonic',
      cardinality: 4,
      category: 'world',
      family: 'Tetratonic',
      intervals: [0, 2, 5, 9],
      formula: '1 - 2 - 4 - 6',
      description: 'Traditional Chinese 4-tone court scale. Highly melodic and pastoral.',
      origin: 'Ancient China',
      defaultMood: 'Pastoral Grace / Wind Over Water',
      modes: [
        { name: 'Bi Yu Prime', mood: 'Pastoral Grace', brightness: 4 },
        { name: 'Bi Yu Mode 2', mood: 'Distant Mountain', brightness: 2 },
        { name: 'Bi Yu Mode 3', mood: 'Moonlit Lake', brightness: 0 },
        { name: 'Bi Yu Mode 4', mood: 'Bamboo Grove', brightness: -2 }
      ]
    },

    // =========================================================
    // 5-TONE SCALES (PENTATONIC)
    // =========================================================
    {
      id: 'major_pentatonic',
      name: 'Major Pentatonic',
      cardinality: 5,
      category: 'folk_and_diatonic',
      family: 'Pentatonic',
      intervals: [0, 2, 4, 7, 9],
      formula: '1 - 2 - 3 - 5 - 6',
      description: 'The universal pentatonic scale found in folk music across every continent. Crisp, consonant, and joyous.',
      origin: 'Global Folk, Country, Rock, Pop',
      defaultMood: 'Pure Joy / Wide Open Sky',
      modes: [
        { name: 'Major Pentatonic (Mode 1)', mood: 'Pure Joy / Wide Open Sky', brightness: 6 },
        { name: 'Suspended / Egyptian (Mode 2)', mood: 'Floating Mystery / Ancient Sands', brightness: 3 },
        { name: 'Man Gong / Blues Minor (Mode 3)', mood: 'Soulful Blues / Deep Longing', brightness: -1 },
        { name: 'Ritusen / Scottish (Mode 4)', mood: 'Highland Breeze / Noble Hope', brightness: 4 },
        { name: 'Minor Pentatonic (Mode 5)', mood: 'Raw Rock & Blues Grit', brightness: 0 }
      ]
    },
    {
      id: 'hirajoshi',
      name: 'Japanese Hirajoshi',
      cardinality: 5,
      category: 'world',
      family: 'Pentatonic',
      intervals: [0, 2, 3, 7, 8],
      formula: '1 - 2 - b3 - 5 - b6',
      description: 'Traditional Japanese koto and shamisen tuning. Evokes cherry blossoms, melancholic elegance, and samurai cinema.',
      origin: 'Japan (Edo Period Koto)',
      defaultMood: 'Cherry Blossoms / Noble Melancholy',
      modes: [
        { name: 'Hirajoshi (Mode 1)', mood: 'Cherry Blossoms / Noble Melancholy', brightness: -1 },
        { name: 'Iwato (Mode 2)', mood: 'Shadowed Shrine / Deep Dread', brightness: -6 },
        { name: 'Kumoi (Mode 3)', mood: 'Mist Over Mount Fuji', brightness: 5 },
        { name: 'Hon-Kumoi (Mode 4)', mood: 'Haunted Flute in Wind', brightness: -3 },
        { name: 'Yo Mode (Mode 5)', mood: 'Zen Garden Stillness', brightness: 2 }
      ]
    },
    {
      id: 'insen',
      name: 'Japanese Insen',
      cardinality: 5,
      category: 'world',
      family: 'Pentatonic',
      intervals: [0, 1, 5, 7, 10],
      formula: '1 - b2 - 4 - 5 - b7',
      description: 'Traditional Japanese koto scale featuring the dramatic minor second and suspended fourth.',
      origin: 'Japan (Gagaku & Koto)',
      defaultMood: 'Mystical Zen / Somber Honor',
      modes: [
        { name: 'Insen', mood: 'Mystical Zen', brightness: -3 },
        { name: 'Mode 2 of Insen', mood: 'Rising Sun', brightness: 4 },
        { name: 'Mode 3 of Insen', mood: 'Temple Night', brightness: -1 },
        { name: 'Mode 4 of Insen', mood: 'Floating Lanterns', brightness: 2 },
        { name: 'Mode 5 of Insen', mood: 'Dark Forest Rain', brightness: -4 }
      ]
    },
    {
      id: 'ryukyu',
      name: 'Okinawan (Ryukyu)',
      cardinality: 5,
      category: 'world',
      family: 'Pentatonic',
      intervals: [0, 4, 5, 7, 11],
      formula: '1 - 3 - 4 - 5 - 7',
      description: 'Lush tropical pentatonic scale of Okinawa and the Ryukyu Islands. Celebratory, bright, and island-flavored.',
      origin: 'Okinawa, Japan (Sanshin tradition)',
      defaultMood: 'Tropical Warmth / Island Sunrise',
      modes: [
        { name: 'Ryukyu (Mode 1)', mood: 'Tropical Warmth', brightness: 5 },
        { name: 'Mode 2 of Ryukyu', mood: 'Dusk Over Coral', brightness: -2 },
        { name: 'Mode 3 of Ryukyu', mood: 'Ocean Breeze', brightness: 1 },
        { name: 'Mode 4 of Ryukyu', mood: 'Starry Beach', brightness: -3 },
        { name: 'Mode 5 of Ryukyu', mood: 'Morning Waves', brightness: 3 }
      ]
    },
    {
      id: 'raga_shivaranjani',
      name: 'Raga Shivaranjani',
      cardinality: 5,
      category: 'world',
      family: 'Indian Raga',
      intervals: [0, 2, 3, 7, 9],
      formula: '1 - 2 - b3 - 5 - 6',
      description: 'Deeply emotional Indian pentatonic raga. Combines the melancholy of a minor 3rd with the warmth of a major 6th.',
      origin: 'North & South Indian Classical',
      defaultMood: 'Soul-Stirring Pathos / Bittersweet Love',
      modes: [
        { name: 'Shivaranjani', mood: 'Bittersweet Pathos', brightness: 2 },
        { name: 'Mode 2 of Shivaranjani', mood: 'Sacred River Dawn', brightness: 4 },
        { name: 'Mode 3 of Shivaranjani', mood: 'Desert Solitude', brightness: -2 },
        { name: 'Mode 4 of Shivaranjani', mood: 'Devotional Flame', brightness: 0 },
        { name: 'Mode 5 of Shivaranjani', mood: 'Midnight Contemplation', brightness: -4 }
      ]
    },
    {
      id: 'raga_malkauns',
      name: 'Raga Malkauns',
      cardinality: 5,
      category: 'world',
      family: 'Indian Raga',
      intervals: [0, 3, 5, 8, 10],
      formula: '1 - b3 - 4 - b6 - b7',
      description: 'One of the oldest and most revered ragas in Indian music. Performed at deep midnight to evoke inner meditation.',
      origin: 'Ancient India (Lord Shiva tradition)',
      defaultMood: 'Deep Midnight / Mystical Transcendence',
      modes: [
        { name: 'Malkauns', mood: 'Deep Midnight Meditation', brightness: -4 },
        { name: 'Mode 2 (Bhairavi Pentatonic)', mood: 'Sacred Chanting', brightness: -1 },
        { name: 'Mode 3 (Bilawal Pentatonic)', mood: 'Sunrise Gold', brightness: 5 },
        { name: 'Mode 4 (Kafi Pentatonic)', mood: 'Monsoon Clouds', brightness: 1 },
        { name: 'Mode 5 (Kalyan Pentatonic)', mood: 'Royal Court', brightness: 3 }
      ]
    },
    {
      id: 'dominant_pentatonic',
      name: 'Dominant Pentatonic (Mixolydian Pentatonic)',
      cardinality: 5,
      category: 'jazz',
      family: 'Pentatonic',
      intervals: [0, 2, 4, 7, 10],
      formula: '1 - 2 - 3 - 5 - b7',
      description: 'Essential modern jazz pentatonic for playing over dominant 7th and 9th chords without clashing 4th intervals.',
      origin: 'Modern Jazz & Fusion',
      defaultMood: 'Funky Swagger / Smooth Sophistication',
      modes: [
        { name: 'Dominant Pentatonic', mood: 'Funky Swagger', brightness: 4 },
        { name: 'Mode 2', mood: 'Cool Minor Blue', brightness: 0 },
        { name: 'Mode 3', mood: 'Suspended Drift', brightness: 2 },
        { name: 'Mode 4', mood: 'Twilight Glow', brightness: -2 },
        { name: 'Mode 5', mood: 'Open Prairie', brightness: 5 }
      ]
    },
    {
      id: 'altered_pentatonic',
      name: 'Altered Pentatonic (Super Locrian Pentatonic)',
      cardinality: 5,
      category: 'jazz',
      family: 'Pentatonic',
      intervals: [0, 1, 3, 6, 8],
      formula: '1 - b2 - b3 - b5 - b6',
      description: 'Pioneered by John Coltrane and McCoy Tyner. Perfect for aggressive outside soloing over 7alt chords.',
      origin: 'Post-Bop & Modal Jazz',
      defaultMood: 'Electric Tension / Coltrane Matrix',
      modes: [
        { name: 'Altered Pentatonic', mood: 'Electric Tension', brightness: -8 },
        { name: 'Lydian Dominant Pentatonic', mood: 'Futuristic Glow', brightness: 4 },
        { name: 'Dorian b2 Pentatonic', mood: 'Smoky Basement', brightness: -1 },
        { name: 'Locrian #2 Pentatonic', mood: 'Cosmic Drift', brightness: -3 },
        { name: 'Lydian Augmented Pentatonic', mood: 'Sci-Fi Transcendence', brightness: 5 }
      ]
    },

    // =========================================================
    // 6-TONE SCALES (HEXATONIC)
    // =========================================================
    {
      id: 'blues_hexatonic',
      name: 'Traditional Blues Scale',
      cardinality: 6,
      category: 'blues',
      family: 'Hexatonic',
      intervals: [0, 3, 5, 6, 7, 10],
      formula: '1 - b3 - 4 - b5 - 5 - b7',
      description: 'The definitive sound of the American blues, soul, and hard rock. Features the crying "blue note" (diminished 5th).',
      origin: 'African-American Blues Tradition',
      defaultMood: 'Raw Emotional Truth / Gritty Soul',
      modes: [
        { name: 'Minor Blues Scale', mood: 'Raw Emotional Truth', brightness: 0 },
        { name: 'Major Blues Inversion', mood: 'Southern Sunshine', brightness: 3 },
        { name: 'Sus Blues Inversion', mood: 'Urban Neon Glow', brightness: 1 },
        { name: 'Tritone Blues Mode', mood: 'Bayou Shadow', brightness: -3 },
        { name: 'Heptatonic Minor Blue', mood: 'Late Night Lament', brightness: -1 },
        { name: 'Dorian Blue Mode', mood: 'Hard Bop Swagger', brightness: 2 }
      ]
    },
    {
      id: 'major_blues_hexatonic',
      name: 'Major Blues Scale (Country Blues)',
      cardinality: 6,
      category: 'blues',
      family: 'Hexatonic',
      intervals: [0, 2, 3, 4, 7, 9],
      formula: '1 - 2 - b3 - 3 - 5 - 6',
      description: 'The sweet, soulful Major Blues scale loved by B.B. King, Dickey Betts, and gospel organists.',
      origin: 'Delta Blues, Country & Gospel',
      defaultMood: 'Gospel Warmth / Sweet Swagger',
      modes: [
        { name: 'Major Blues', mood: 'Sweet Gospel Warmth', brightness: 5 },
        { name: 'Dorian Minor Blues', mood: 'Jazzy Groove', brightness: 1 },
        { name: 'Phrygian Blue Mode', mood: 'Smoldering Embers', brightness: -3 },
        { name: 'Lydian Blue Mode', mood: 'Bright Skylight', brightness: 6 },
        { name: 'Mixolydian Blue Mode', mood: 'Roadhouse Shave', brightness: 3 },
        { name: 'Aeolian Blue Mode', mood: 'Rainy Sidewalk', brightness: -1 }
      ]
    },
    {
      id: 'whole_tone',
      name: 'Whole-Tone Scale (Messiaen Mode 1)',
      cardinality: 6,
      category: 'symmetrical',
      family: 'Symmetrical Hexatonic',
      intervals: [0, 2, 4, 6, 8, 10],
      formula: '1 - 2 - 3 - #4 - #5 - b7',
      description: 'Composed entirely of major seconds. Completely rootless, dreamlike, and weightless. Foundational to Debussy.',
      origin: 'French Impressionism & Messiaen',
      defaultMood: 'Dreamlike Weightlessness / Water Droplets',
      modes: [
        { name: 'Whole-Tone (Symmetrical)', mood: 'Dreamlike Weightlessness', brightness: 2 }
      ]
    },
    {
      id: 'augmented_hexatonic',
      name: 'Symmetrical Augmented Scale',
      cardinality: 6,
      category: 'symmetrical',
      family: 'Symmetrical Hexatonic',
      intervals: [0, 3, 4, 7, 8, 11],
      formula: '1 - b3 - 3 - 5 - b6 - 7',
      description: 'Alternating minor thirds and semitones. Generates extraordinary major-augmented and minor-major 7th tensions.',
      origin: 'Late Romanticism & Modern Jazz (Coltrane/Liebman)',
      defaultMood: 'Haunting Tension / Film Suspense',
      modes: [
        { name: 'Augmented Scale (Mode 1)', mood: 'Haunting Tension', brightness: 2 },
        { name: 'Inverted Augmented (Mode 2)', mood: 'Hypnotic Spiral', brightness: -2 }
      ]
    },
    {
      id: 'prometheus',
      name: 'Prometheus Scale (Scriabin Mystic)',
      cardinality: 6,
      category: 'modern_classical',
      family: 'Hexatonic',
      intervals: [0, 2, 4, 6, 9, 10],
      formula: '1 - 2 - 3 - #4 - 6 - b7',
      description: 'Alexander Scriabin’s famous "Mystic Chord" scale. A Lydian-Dominant hexachord radiating cosmic luminosity.',
      origin: 'Russian Mysticism & Scriabin',
      defaultMood: 'Cosmic Fire / Mystical Ecstasy',
      modes: [
        { name: 'Promethean Prime', mood: 'Cosmic Fire / Ecstasy', brightness: 5 },
        { name: 'Mode 2 of Prometheus', mood: 'Nebula Drift', brightness: 2 },
        { name: 'Mode 3 of Prometheus', mood: 'Golden Aurora', brightness: 4 },
        { name: 'Mode 4 of Prometheus', mood: 'Deep Stellar Void', brightness: -3 },
        { name: 'Mode 5 of Prometheus', mood: 'Solar Flare', brightness: 3 },
        { name: 'Mode 6 of Prometheus', mood: 'Dark Matter', brightness: -2 }
      ]
    },
    {
      id: 'tritone_hexatonic',
      name: 'Tritone Hexatonic',
      cardinality: 6,
      category: 'symmetrical',
      family: 'Hexatonic',
      intervals: [0, 1, 4, 6, 7, 10],
      formula: '1 - b2 - 3 - #4 - 5 - b7',
      description: 'Built by combining two major triads a tritone apart (e.g. C major + F# major). Used heavily in Stravinsky and fusion.',
      origin: 'Stravinsky & Modern Jazz Fusion',
      defaultMood: 'Petrushka Spark / Bipolar Voltage',
      modes: [
        { name: 'Tritone Hexatonic Prime', mood: 'Petrushka Spark / Voltage', brightness: 0 },
        { name: 'Mode 2', mood: 'Electric Jolt', brightness: 3 },
        { name: 'Mode 3', mood: 'Shadow Puppet', brightness: -3 },
        { name: 'Mode 4', mood: 'Carnival Panic', brightness: -1 }
      ]
    },
    {
      id: 'istrian_hexatonic',
      name: 'Istrian Folk Scale',
      cardinality: 6,
      category: 'world',
      family: 'Hexatonic',
      intervals: [0, 1, 3, 4, 6, 7],
      formula: '1 - b2 - b3 - 3 - #4 - 5',
      description: 'Traditional folk scale of Istria and Kvarner (Croatia). UNESCO Intangible Cultural Heritage two-part singing.',
      origin: 'Istria & Croatia Folk Tradition',
      defaultMood: 'Ancient Mountain Echo / Rustic Drone',
      modes: [
        { name: 'Istrian Prime', mood: 'Ancient Mountain Echo', brightness: -2 },
        { name: 'Mode 2 of Istrian', mood: 'Sea Cliff Wind', brightness: 1 },
        { name: 'Mode 3 of Istrian', mood: 'Folk Festival', brightness: 3 },
        { name: 'Mode 4 of Istrian', mood: 'Twilight Village', brightness: -1 }
      ]
    },

    // =========================================================
    // 7-TONE SCALES (HEPTATONIC)
    // =========================================================
    {
      id: 'diatonic',
      name: 'Diatonic System (Major & Modes)',
      cardinality: 7,
      category: 'diatonic',
      family: 'Diatonic',
      intervals: [0, 2, 4, 5, 7, 9, 11],
      formula: '1 - 2 - 3 - 4 - 5 - 6 - 7',
      description: 'The mother scale of Western civilization. Generates all 7 classical church and contemporary diatonic modes.',
      origin: 'Gregorian Chant, Classical, Pop & Jazz',
      defaultMood: 'Calm Stability / Noble Brightness',
      modes: [
        { modeNumber: 1, name: 'Ionian / Major (Mode 1)', mood: 'Calm Stability / Triumph', formula: '1 - 2 - 3 - 4 - 5 - 6 - 7', brightness: 6, qualities: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'] },
        { modeNumber: 2, name: 'Dorian (Mode 2)', mood: 'Soulful & Jazzy Minor', formula: '1 - 2 - b3 - 4 - 5 - 6 - b7', brightness: 2, qualities: ['m7', 'm7', 'maj7', '7', 'm7', 'm7b5', 'maj7'] },
        { modeNumber: 3, name: 'Phrygian (Mode 3)', mood: 'Suspensive Desolation / Spanish Fire', formula: '1 - b2 - b3 - 4 - 5 - b6 - b7', brightness: -4, qualities: ['m7', 'maj7', '7', 'm7', 'm7b5', 'maj7', 'm7'] },
        { modeNumber: 4, name: 'Lydian (Mode 4)', mood: 'Euphoric Transcendence / Dreamy', formula: '1 - 2 - 3 - #4 - 5 - 6 - 7', brightness: 8, qualities: ['maj7#11', '7', 'm7', 'm7b5', 'maj7', 'm7', 'm7'] },
        { modeNumber: 5, name: 'Mixolydian (Mode 5)', mood: 'Grounded Warmth / Bluesy Joy', formula: '1 - 2 - 3 - 4 - 5 - 6 - b7', brightness: 4, qualities: ['7', 'm7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7'] },
        { modeNumber: 6, name: 'Aeolian / Natural Minor (Mode 6)', mood: 'Bittersweet Melancholy / Epic Drama', formula: '1 - 2 - b3 - 4 - 5 - b6 - b7', brightness: -1, qualities: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'] },
        { modeNumber: 7, name: 'Locrian (Mode 7)', mood: 'Dread & Grief / Dark Tension', formula: '1 - b2 - b3 - 4 - b5 - b6 - b7', brightness: -7, qualities: ['m7b5', 'maj7', 'm7', 'm7', 'maj7', '7', 'm7'] }
      ]
    },
    {
      id: 'melodic_minor',
      name: 'Melodic Minor (Jazz Minor)',
      cardinality: 7,
      category: 'jazz_and_classical',
      family: 'Melodic Minor',
      intervals: [0, 2, 3, 5, 7, 9, 11],
      formula: '1 - 2 - b3 - 4 - 5 - 6 - 7',
      description: 'The foundation of modern jazz harmony. Minor triad with major 6th and major 7th. Generates Altered, Lydian Dominant, etc.',
      origin: 'Bach, Classical & Modern Jazz',
      defaultMood: 'Sophisticated Nobility / Serious Jazz',
      modes: [
        { modeNumber: 1, name: 'Melodic Minor (Mode 1)', mood: 'Sophisticated Nobility / Film Noir', formula: '1 - 2 - b3 - 4 - 5 - 6 - 7', brightness: 4, qualities: ['m(maj7)', 'm7', 'maj7#5', '7#11', '7', 'm7b5', 'm7b5'] },
        { modeNumber: 2, name: 'Dorian b2 / Javanese (Mode 2)', mood: 'Darkly Soulful / Exotic Velvet', formula: '1 - b2 - b3 - 4 - 5 - 6 - b7', brightness: 0, qualities: ['m7', 'maj7#5', '7#11', '7', 'm7b5', 'm7b5', 'm(maj7)'] },
        { modeNumber: 3, name: 'Lydian Augmented (Mode 3)', mood: 'Futuristic Wonder / Ethereal Dream', formula: '1 - 2 - 3 - #4 - #5 - 6 - 7', brightness: 9, qualities: ['maj7#5', '7', '7', 'm7b5', 'm7b5', 'm(maj7)', 'm7'] },
        { modeNumber: 4, name: 'Lydian Dominant (Mode 4)', mood: 'Playful Brilliance / Simpsons Theme', formula: '1 - 2 - 3 - #4 - 5 - 6 - b7', brightness: 7, qualities: ['7#11', '7', 'm7b5', 'm7b5', 'm(maj7)', 'm7', 'maj7#5'] },
        { modeNumber: 5, name: 'Mixolydian b6 / Hindu (Mode 5)', mood: 'Bittersweet Warmth / Bollywood Romance', formula: '1 - 2 - 3 - 4 - 5 - b6 - b7', brightness: 2, qualities: ['7b13', 'm7b5', 'm7b5', 'm(maj7)', 'm7', 'maj7#5', '7#11'] },
        { modeNumber: 6, name: 'Locrian #2 / Half-Dim (Mode 6)', mood: 'Haunted Elegance / Gentle Grief', formula: '1 - 2 - b3 - 4 - b5 - b6 - b7', brightness: -4, qualities: ['m7b5', 'm7b5', 'm(maj7)', 'm7', 'maj7#5', '7#11', '7'] },
        { modeNumber: 7, name: 'Altered / Super Locrian (Mode 7)', mood: 'Maximum Outside Tension / Jazz Climax', formula: '1 - b2 - b3 - b4 - b5 - b6 - b7', brightness: -8, qualities: ['7alt', 'm(maj7)', 'm7', 'maj7#5', '7#11', '7', 'm7b5'] }
      ]
    },
    {
      id: 'harmonic_minor',
      name: 'Harmonic Minor',
      cardinality: 7,
      category: 'classical_and_world',
      family: 'Harmonic Minor',
      intervals: [0, 2, 3, 5, 7, 8, 11],
      formula: '1 - 2 - b3 - 4 - 5 - b6 - 7',
      description: 'Dramatic classical minor with a sharp 7th and augmented 2nd interval. Generates Spanish Phrygian Dominant and Ukrainian Dorian.',
      origin: 'Baroque, Romanticism, Flamenco & Klezmer',
      defaultMood: 'Baroque Tragedy / Dramatic Splendor',
      modes: [
        { modeNumber: 1, name: 'Harmonic Minor (Mode 1)', mood: 'Baroque Tragedy / Dramatic Splendor', formula: '1 - 2 - b3 - 4 - 5 - b6 - 7', brightness: 0, qualities: ['m(maj7)', 'm7b5', 'maj7#5', 'm7', '7b9', 'maj7#11', 'dim7'] },
        { modeNumber: 2, name: 'Locrian ♮6 (Mode 2)', mood: 'Chamber Dread / Dark Romance', formula: '1 - b2 - b3 - 4 - b5 - 6 - b7', brightness: -4, qualities: ['m7b5', 'maj7#5', 'm7', '7b9', 'maj7#11', 'dim7', 'm(maj7)'] },
        { modeNumber: 3, name: 'Ionian #5 (Mode 3)', mood: 'Augmented Splendor / Sci-Fi Majesty', formula: '1 - 2 - 3 - 4 - #5 - 6 - 7', brightness: 6, qualities: ['maj7#5', 'm7', '7', 'maj7#11', 'dim7', 'm(maj7)', 'm7b5'] },
        { modeNumber: 4, name: 'Ukrainian Dorian (Mode 4)', mood: 'Klezmer Soul / Romani Pathos', formula: '1 - 2 - b3 - #4 - 5 - 6 - b7', brightness: 1, qualities: ['m7#11', '7b9', 'maj7#11', 'dim7', 'm(maj7)', 'm7b5', 'maj7#5'] },
        { modeNumber: 5, name: 'Phrygian Dominant (Mode 5)', mood: 'Flamenco Passion / Middle Eastern Majesty', formula: '1 - b2 - 3 - 4 - 5 - b6 - b7', brightness: 2, qualities: ['7b9', 'maj7#11', 'dim7', 'm(maj7)', 'm7b5', 'maj7#5', 'm7'] },
        { modeNumber: 6, name: 'Lydian #2 (Mode 6)', mood: 'Exotic Euphoria / Sparkling Mystery', formula: '1 - #2 - 3 - #4 - 5 - 6 - 7', brightness: 8, qualities: ['maj7#11', 'dim7', 'm(maj7)', 'm7b5', 'maj7#5', 'm7', '7'] },
        { modeNumber: 7, name: 'Ultralocrian (Mode 7)', mood: 'Abyssal Despair / Super Dark Tension', formula: '1 - b2 - b3 - b4 - b5 - b6 - bb7', brightness: -9, qualities: ['dim7', 'm(maj7)', 'm7b5', 'maj7#5', 'm7', '7b9', 'maj7#11'] }
      ]
    },
    {
      id: 'harmonic_major',
      name: 'Harmonic Major',
      cardinality: 7,
      category: 'jazz_and_classical',
      family: 'Harmonic Major',
      intervals: [0, 2, 4, 5, 7, 8, 11],
      formula: '1 - 2 - 3 - 4 - 5 - b6 - 7',
      description: 'Major scale with a flatted 6th degree. Rich cinematic blend of major stability with minor nostalgia.',
      origin: 'Rimsky-Korsakov & Modern Film Scoring',
      defaultMood: 'Cinematic Wonder / Bittersweet Hope',
      modes: [
        { modeNumber: 1, name: 'Harmonic Major (Mode 1)', mood: 'Cinematic Wonder / Bittersweet Hope', formula: '1 - 2 - 3 - 4 - 5 - b6 - 7', brightness: 5 },
        { modeNumber: 2, name: 'Dorian b5 (Mode 2)', mood: 'Gothic Romance / Mysterious Velvet', formula: '1 - 2 - b3 - 4 - b5 - 6 - b7', brightness: -2 },
        { modeNumber: 3, name: 'Phrygian b4 (Mode 3)', mood: 'Desert Solitude / Mystic Night', formula: '1 - b2 - b3 - b4 - 5 - b6 - b7', brightness: -5 },
        { modeNumber: 4, name: 'Lydian b3 (Mode 4)', mood: 'Dreamy Minor Reflection / Impressionism', formula: '1 - 2 - b3 - #4 - 5 - 6 - 7', brightness: 4 },
        { modeNumber: 5, name: 'Mixolydian b2 (Mode 5)', mood: 'Spanish Sun / Arabic Twilight', formula: '1 - b2 - 3 - 4 - 5 - 6 - b7', brightness: 1 },
        { modeNumber: 6, name: 'Lydian Augmented #9 (Mode 6)', mood: 'Celestial Triumph / Cosmic Bloom', formula: '1 - #2 - 3 - #4 - #5 - 6 - 7', brightness: 8 },
        { modeNumber: 7, name: 'Locrian bb7 (Mode 7)', mood: 'Diminished Shadow / Dark Eclipse', formula: '1 - b2 - b3 - 4 - b5 - b6 - bb7', brightness: -8 }
      ]
    },
    {
      id: 'double_harmonic',
      name: 'Double Harmonic Major (Byzantine / Arabic)',
      cardinality: 7,
      category: 'world',
      family: 'Double Harmonic',
      intervals: [0, 1, 4, 5, 7, 8, 11],
      formula: '1 - b2 - 3 - 4 - 5 - b6 - 7',
      description: 'Features two augmented seconds. Found across Byzantine hymns, Arabic Maqam Hijaz Kar, and Flamenco.',
      origin: 'Byzantine Empire, Middle East & Greece',
      defaultMood: 'Exotic Majesty / Desert Splendor',
      modes: [
        { name: 'Double Harmonic Major (Byzantine)', mood: 'Exotic Majesty / Desert Sun', brightness: 3 },
        { name: 'Lydian #2 #6 (Mode 2)', mood: 'Psychedelic Trance', brightness: 7 },
        { name: 'Ultraphrygian (Mode 3)', mood: 'Ancient Prophecy', brightness: -4 },
        { name: 'Hungarian Minor / Gypsy (Mode 4)', mood: 'Virtuoso Fire / Romani Passion', brightness: 0 },
        { name: 'Oriental (Mode 5)', mood: 'Caravan Oasis', brightness: -2 },
        { name: 'Ionian Augmented #2 (Mode 6)', mood: 'Blazing Star', brightness: 5 },
        { name: 'Locrian bb3 bb7 (Mode 7)', mood: 'Abyssal Ritual', brightness: -9 }
      ]
    },
    {
      id: 'neapolitan_major',
      name: 'Neapolitan Major',
      cardinality: 7,
      category: 'classical_and_world',
      family: 'Heptatonic',
      intervals: [0, 1, 3, 5, 7, 9, 11],
      formula: '1 - b2 - b3 - 4 - 5 - 6 - 7',
      description: 'Major scale with flat second and flat third, leading up to natural 6 and 7. Operatic and dramatic.',
      origin: 'Neapolitan Opera School (18th Century)',
      defaultMood: 'Operatic Drama / Passionate Nobility',
      modes: [
        { name: 'Neapolitan Major', mood: 'Operatic Drama', brightness: 2 },
        { name: 'Leading Whole-Tone Inversion', mood: 'Hypnotic Horizon', brightness: 6 },
        { name: 'Lydian Minor Inversion', mood: 'Starlight Melancholy', brightness: 3 },
        { name: 'Locrian Dominant Inversion', mood: 'Tense Shadow', brightness: -4 }
      ]
    },
    {
      id: 'persian_scale',
      name: 'Persian Scale',
      cardinality: 7,
      category: 'world',
      family: 'Heptatonic',
      intervals: [0, 1, 4, 5, 6, 8, 11],
      formula: '1 - b2 - 3 - 4 - b5 - b6 - 7',
      description: 'Highly exotic scale featuring both a diminished 5th and major 3rd/major 7th. Ancient and captivating.',
      origin: 'Persian Dastgah Tradition',
      defaultMood: 'Ancient Silk Road / Enigmatic Palace',
      modes: [
        { name: 'Persian Scale', mood: 'Ancient Silk Road', brightness: -1 },
        { name: 'Mode 2 of Persian', mood: 'Mirage in Desert', brightness: 4 },
        { name: 'Mode 3 of Persian', mood: 'Mystic Bazaar', brightness: -3 },
        { name: 'Mode 4 of Persian', mood: 'Oasis Night', brightness: 1 }
      ]
    },

    // =========================================================
    // 8-TONE SCALES (OCTATONIC)
    // =========================================================
    {
      id: 'diminished_hw',
      name: 'Half-Whole Diminished (Messiaen Mode 2 / Dominant)',
      cardinality: 8,
      category: 'symmetrical',
      family: 'Octatonic',
      intervals: [0, 1, 3, 4, 6, 7, 9, 10],
      formula: '1 - b2 - #9 - 3 - #4 - 5 - 6 - b7',
      description: 'Alternating semitones and whole tones. The definitive modern jazz scale over dominant 7b9 chords.',
      origin: 'Stravinsky, Bartók, Messiaen & Bebop',
      defaultMood: 'Electrified Tension / High Jazz Drama',
      modes: [
        { name: 'Half-Whole Diminished (Dominant)', mood: 'Electrified Tension', brightness: 1 },
        { name: 'Whole-Half Diminished (Tonic)', mood: 'Bartók Nocturne / Haunted Beauty', brightness: 0 }
      ]
    },
    {
      id: 'bebop_dominant',
      name: 'Bebop Dominant Scale',
      cardinality: 8,
      category: 'jazz',
      family: 'Bebop',
      intervals: [0, 2, 4, 5, 7, 9, 10, 11],
      formula: '1 - 2 - 3 - 4 - 5 - 6 - b7 - 7',
      description: 'Mixolydian with added major 7th passing tone. Ensures chord tones fall on the downbeats in continuous 8th notes.',
      origin: 'Bebop Era (Charlie Parker, Dizzy Gillespie)',
      defaultMood: 'Fluid Swing / Harlem Nightclub',
      modes: [
        { name: 'Bebop Dominant', mood: 'Fluid Swing', brightness: 5 },
        { name: 'Bebop Dorian Minor', mood: 'Smoky Groove', brightness: 1 },
        { name: 'Bebop Major', mood: 'Bright Broadway', brightness: 6 }
      ]
    },
    {
      id: 'bebop_major',
      name: 'Bebop Major Scale',
      cardinality: 8,
      category: 'jazz',
      family: 'Bebop',
      intervals: [0, 2, 4, 5, 7, 8, 9, 11],
      formula: '1 - 2 - 3 - 4 - 5 - b6 - 6 - 7',
      description: 'Major scale with added chromatic passing note between the 5th and 6th degrees. Essential Barry Harris tool.',
      origin: 'Barry Harris & Bebop Jazz',
      defaultMood: 'Classic Elegance / Timeless Swing',
      modes: [
        { name: 'Bebop Major', mood: 'Classic Elegance', brightness: 6 },
        { name: 'Bebop Minor 6th', mood: 'Nocturne Swing', brightness: 2 }
      ]
    },
    {
      id: 'bebop_minor',
      name: 'Bebop Minor (Dorian Bebop)',
      cardinality: 8,
      category: 'jazz',
      family: 'Bebop',
      intervals: [0, 2, 3, 4, 5, 7, 9, 10],
      formula: '1 - 2 - b3 - 3 - 4 - 5 - 6 - b7',
      description: 'Dorian mode with chromatic passing tone between minor 3rd and perfect 4th. Seamless swing phrasing.',
      origin: 'David Baker & Modern Jazz',
      defaultMood: 'Late Night Bop / Confident Cool',
      modes: [
        { name: 'Bebop Dorian Minor', mood: 'Late Night Bop', brightness: 3 }
      ]
    },
    {
      id: 'spanish_8tone',
      name: 'Spanish 8-Tone Scale',
      cardinality: 8,
      category: 'world',
      family: 'Octatonic',
      intervals: [0, 1, 3, 4, 5, 6, 8, 10],
      formula: '1 - b2 - b3 - 3 - 4 - b5 - b6 - b7',
      description: 'Flamenco scale containing both minor and major 3rd nuances, creating fiery authentic Spanish harmonies.',
      origin: 'Andalusia, Spain (Flamenco)',
      defaultMood: 'Flamenco Fire / Gitano Passion',
      modes: [
        { name: 'Spanish 8-Tone Prime', mood: 'Flamenco Fire', brightness: -2 }
      ]
    },

    // =========================================================
    // 9-TONE SCALES (NONATONIC)
    // =========================================================
    {
      id: 'messiaen_mode3',
      name: 'Messiaen Mode 3 (Symmetrical 9-Tone)',
      cardinality: 9,
      category: 'modern_classical',
      family: 'Nonatonic',
      intervals: [0, 2, 3, 4, 6, 7, 8, 10, 11],
      formula: '1 - 2 - b3 - 3 - #4 - 5 - b6 - b7 - 7',
      description: 'Olivier Messiaen’s third mode of limited transposition: 3 groups of (whole-step, half-step, half-step). Stained-glass harmony.',
      origin: 'Olivier Messiaen (20th Century)',
      defaultMood: 'Stained-Glass Radiance / Mystical Cathedral',
      modes: [
        { name: 'Messiaen Mode 3 (Prime)', mood: 'Stained-Glass Radiance', brightness: 4 },
        { name: 'Messiaen Mode 3 (Rotation 2)', mood: 'Organ Drone / Ethereal Light', brightness: 3 },
        { name: 'Messiaen Mode 3 (Rotation 3)', mood: 'Chamber Twilight', brightness: 2 }
      ]
    },
    {
      id: 'composite_blues_9',
      name: '9-Tone Composite Blues Scale',
      cardinality: 9,
      category: 'blues',
      family: 'Nonatonic',
      intervals: [0, 2, 3, 4, 5, 6, 7, 9, 10],
      formula: '1 - 2 - b3 - 3 - 4 - b5 - 5 - 6 - b7',
      description: 'Synthesizes Major Pentatonic, Minor Pentatonic, and both blue notes. The complete vocabulary of blues and soul soloing.',
      origin: 'American Blues, Rock & Soul',
      defaultMood: 'Total Blues Mastery / Deep Rooted Soul',
      modes: [
        { name: '9-Tone Composite Blues', mood: 'Total Blues Mastery', brightness: 3 }
      ]
    },
    {
      id: 'tcherepnin_nonatonic',
      name: 'Tcherepnin 9-Tone Scale',
      cardinality: 9,
      category: 'modern_classical',
      family: 'Nonatonic',
      intervals: [0, 1, 4, 5, 6, 8, 9, 10, 11],
      formula: '1 - b2 - 3 - 4 - b5 - b6 - 6 - b7 - 7',
      description: 'Alexander Tcherepnin’s 9-tone scale formed by interlocking hexachords. Foundational to modern Russian neoclassicism.',
      origin: 'Alexander Tcherepnin (Neoclassical)',
      defaultMood: 'Mechanical Ballet / Geometric Wonder',
      modes: [
        { name: 'Tcherepnin Nonatonic', mood: 'Mechanical Ballet', brightness: 1 }
      ]
    },

    // =========================================================
    // 10-TONE SCALES (DECATONIC)
    // =========================================================
    {
      id: 'messiaen_mode4',
      name: 'Messiaen Mode 4 (Decatonic)',
      cardinality: 10,
      category: 'modern_classical',
      family: 'Decatonic',
      intervals: [0, 1, 2, 3, 5, 6, 7, 8, 9, 11],
      formula: '1 - b2 - 2 - b3 - 4 - #4 - 5 - b6 - 6 - 7',
      description: 'Symmetrical 10-tone collection with two centers of limited transposition. Dense, shimmering modern color.',
      origin: 'Olivier Messiaen (Modes of Limited Transposition)',
      defaultMood: 'Crystalline Shimmer / Modernist Light',
      modes: [
        { name: 'Messiaen Mode 4', mood: 'Crystalline Shimmer', brightness: 2 }
      ]
    },
    {
      id: 'bebop_composite_10',
      name: '10-Tone Bebop Composite Scale',
      cardinality: 10,
      category: 'jazz',
      family: 'Decatonic',
      intervals: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10],
      formula: '1 - b2 - 2 - b3 - 3 - 4 - 5 - b6 - 6 - b7',
      description: 'Complete chromatic approach system over minor and dominant chords used in modern bebop lines.',
      origin: 'Post-Bop & Barry Harris Harmony',
      defaultMood: 'Relentless Momentum / Bebop Mastery',
      modes: [
        { name: '10-Tone Bebop Composite', mood: 'Relentless Momentum', brightness: 2 }
      ]
    },

    // =========================================================
    // 11-TONE SCALES (HENDECATONIC)
    // =========================================================
    {
      id: 'hendecatonic_avoid_tonic',
      name: '11-Tone Incomplete Chromatic (Russell LCC)',
      cardinality: 11,
      category: 'avant_garde',
      family: 'Hendecatonic',
      intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11],
      formula: '1 - b2 - 2 - b3 - 3 - 4 - b5 - 5 - b6 - 6 - 7',
      description: '11-tone chromatic collection omitting a single note (minor 7th). Central to George Russell’s Lydian Chromatic Concept.',
      origin: 'George Russell (Lydian Chromatic Concept)',
      defaultMood: 'Hyper-Chromatic Luminosity',
      modes: [
        { name: '11-Tone Russell Chromatic', mood: 'Hyper-Chromatic Luminosity', brightness: 3 }
      ]
    },
    {
      id: 'hendecatonic_outside',
      name: '11-Tone Outside Jazz Cluster',
      cardinality: 11,
      category: 'jazz',
      family: 'Hendecatonic',
      intervals: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
      formula: '1 - b2 - 2 - b3 - 3 - 4 - 5 - b6 - 6 - b7 - 7',
      description: 'Total chromatic space omitting only the tritone/b5, giving maximum chromatic saturation with a stable fifth anchor.',
      origin: 'Modern Free Jazz & Cecil Taylor',
      defaultMood: 'Controlled Chaos / Avant-Garde Energy',
      modes: [
        { name: '11-Tone Outside Jazz Cluster', mood: 'Controlled Chaos', brightness: 2 }
      ]
    },

    // =========================================================
    // 12-TONE SCALES (DODECATONIC / CHROMATIC)
    // =========================================================
    {
      id: 'chromatic_total',
      name: 'Full 12-Tone Chromatic Scale',
      cardinality: 12,
      category: 'universal',
      family: 'Chromatic',
      intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      formula: '1 - b2 - 2 - b3 - 3 - 4 - b5 - 5 - b6 - 6 - b7 - 7',
      description: 'The complete 12-tone equal-tempered universe. Contains all intervals, chords, and harmonic permutations in Western music.',
      origin: 'Universal Base-12 System',
      defaultMood: 'Total Universe / Infinite Possibility',
      modes: [
        { name: '12-Tone Chromatic Universe', mood: 'Total Universe', brightness: 0 }
      ]
    },
    {
      id: 'webern_all_interval',
      name: 'Webern All-Interval 12-Tone Series',
      cardinality: 12,
      category: 'avant_garde',
      family: 'Serial / 12-Tone',
      intervals: [0, 1, 3, 2, 4, 5, 7, 6, 8, 9, 11, 10],
      formula: '1 - b2 - b3 - 2 - 3 - 4 - 5 - b5 - b6 - 6 - 7 - b7',
      description: 'Anton Webern’s symmetrical all-interval row containing every musical interval from minor 2nd to major 7th exactly once.',
      origin: 'Second Viennese School (Anton Webern)',
      defaultMood: 'Crystalline Geometric Rigor / Serial Beauty',
      modes: [
        { name: 'All-Interval 12-Tone Series', mood: 'Crystalline Rigor', brightness: 0 }
      ]
    }
  ];

  // -------------------------------------------------------------
  // 2. Modal Rotation & Brightness Computation Engine
  // -------------------------------------------------------------

  // Interval brightness weights: acoustic stability vs dark friction
  const INTERVAL_BRIGHTNESS_WEIGHTS = {
    0: 0,    // Root
    1: -4,   // Minor 2nd (dark half-step clash)
    2: 1,    // Major 2nd
    3: -2,   // Minor 3rd (sadness / darkness)
    4: 2,    // Major 3rd (brightness / stability)
    5: 0,    // Perfect 4th
    6: -1,   // Tritone / b5 (unstable tension)
    7: 1,    // Perfect 5th
    8: -2,   // Minor 6th
    9: 2,    // Major 6th (Dorian warmth)
    10: -1,  // Minor 7th
    11: 3    // Major 7th (bright leading tone)
  };

  const INTERVAL_LABELS = {
    0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
    6: 'b5', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7'
  };

  class ScaleEngine {
    constructor() {
      this.catalog = SCALE_CATALOG;
    }

    getAllScales() {
      return this.catalog;
    }

    getScaleById(id) {
      return this.catalog.find(s => s.id === id) || null;
    }

    filterByCardinality(numTones) {
      if (!numTones || numTones === 'all') return this.catalog;
      const n = parseInt(numTones, 10);
      return this.catalog.filter(s => s.cardinality === n);
    }

    filterByCategory(category) {
      if (!category || category === 'all') return this.catalog;
      return this.catalog.filter(s => s.category === category);
    }

    // Calculates acoustic Brightness Score (-12 to +12 range)
    calculateBrightnessScore(intervals) {
      if (!intervals || intervals.length === 0) return 0;
      let score = 0;
      const hasFifth = intervals.includes(7);
      intervals.forEach(iv => {
        const norm = (iv % 12 + 12) % 12;
        if (norm === 6) {
          // #4 with perfect 5th is luminous brilliance (+2); b5 without 5th is dark dread (-3)
          score += hasFifth ? 2 : -3;
        } else {
          score += INTERVAL_BRIGHTNESS_WEIGHTS[norm] || 0;
        }
      });
      return score;
    }

    // Generates interval formula string (e.g. "1 - b3 - 4 - 5 - b7")
    formatIntervalFormula(intervals) {
      const hasFifth = intervals.includes(7);
      const hasMajor3 = intervals.includes(4);
      return intervals.map(iv => {
        const norm = (iv % 12 + 12) % 12;
        if (norm === 6) return hasFifth ? '#4' : 'b5';
        if (norm === 3 && hasMajor3) return '#9';
        return INTERVAL_LABELS[norm] || `${norm}`;
      }).join(' - ');
    }

    // Dynamically derives all rotational modes for any parent scale
    getRotationalModes(scale) {
      if (!scale || !scale.intervals) return [];
      const k = scale.intervals.length;

      // If pre-defined modes are provided and count matches, merge with derived data
      const predefinedModes = scale.modes || [];

      const resultModes = [];

      for (let m = 0; m < k; m++) {
        const rootOffset = scale.intervals[m];
        const modeIntervals = scale.intervals.map(iv => (iv - rootOffset + 12) % 12).sort((a, b) => a - b);
        const brightness = this.calculateBrightnessScore(modeIntervals);

        // Find matching pre-defined mode metadata if available
        let meta = null;
        if (predefinedModes.length > 0) {
          // 1. Match by explicit modeNumber or (Mode ${m+1}) in name
          meta = predefinedModes.find(pm => {
            if (pm.modeNumber === (m + 1)) return true;
            const match = pm.name && pm.name.match(/\(Mode\s+(\d+)\)/i);
            return match && parseInt(match[1], 10) === (m + 1);
          });

          // 2. Match by interval formula
          if (!meta) {
            const derivedFormula = this.formatIntervalFormula(modeIntervals);
            meta = predefinedModes.find(pm => pm.formula && pm.formula === derivedFormula);
          }

          // 3. Fallback to positional index
          if (!meta && predefinedModes[m]) {
            meta = predefinedModes[m];
          }
        }

        const formulaStr = (meta && meta.formula) ? meta.formula : this.formatIntervalFormula(modeIntervals);
        let modeName = meta ? meta.name : `Mode ${m + 1} of ${scale.name}`;
        let mood = meta ? meta.mood : this.deriveMoodFromBrightness(brightness, modeIntervals);

        resultModes.push({
          index: m + 1,
          name: modeName,
          intervals: modeIntervals,
          formula: formulaStr,
          brightness,
          mood,
          qualities: meta ? meta.qualities : null
        });
      }

      // Sort modes by brightness (Brightest / Euphoric first, Darkest / Tense last)
      resultModes.sort((a, b) => b.brightness - a.brightness);

      return resultModes;
    }

    // Assigns an intuitive emotional mood descriptor based on intervals & score
    deriveMoodFromBrightness(brightness, intervals) {
      const hasB2 = intervals.includes(1);
      const hasMajor3 = intervals.includes(4);
      const hasTritone = intervals.includes(6);
      const hasMajor7 = intervals.includes(11);
      const hasMinor3 = intervals.includes(3);

      if (brightness >= 7) return 'Euphoric Transcendence / Luminous Radiance';
      if (brightness >= 4) return 'Calm Stability / Noble Brightness';
      if (brightness >= 1) return 'Warm Soulfulness / Grounded Optimism';
      if (brightness === 0) return 'Poised Equilibrium / Atmospheric Balance';
      if (brightness >= -3) {
        if (hasB2) return 'Spanish Passion / Desert Twilight';
        return 'Bittersweet Melancholy / Nostalgic Shadow';
      }
      if (brightness >= -6) {
        if (hasTritone) return 'Haunted Suspense / Ghostly Drift';
        return 'Deep Lament / Somber Elegance';
      }
      return 'Abyssal Dread / Maximum Tension';
    }

    // -------------------------------------------------------------
    // 3. Scale -> Chords Harmonizer (Diatonic Stacking in 3rds)
    // -------------------------------------------------------------
    harmonizeMode(modeIntervals, rootTonic = 'C') {
      const Theory = window.SongTheory;
      if (!Theory || !modeIntervals) return [];

      const rootPC = Theory.noteToPitchClass(rootTonic) || 0;
      const k = modeIntervals.length;
      const chords = [];
      const preferFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm'].includes(rootTonic);

      for (let i = 0; i < k; i++) {
        const stepDegree = i + 1;
        const chordRootOffset = modeIntervals[i];
        const chordRootPC = (rootPC + chordRootOffset) % 12;
        const chordRootName = (k === 7 && Theory.spellIntervalNote)
          ? Theory.spellIntervalNote(rootTonic, stepDegree, chordRootPC)
          : Theory.pitchClassToNote(chordRootPC, preferFlats);

        // Diatonically stack 3rds: degree i (root), i+2 (3rd), i+4 (5th), i+6 (7th)
        const thirdOffset = modeIntervals[(i + 2) % k];
        const fifthOffset = modeIntervals[(i + 4) % k];
        const seventhOffset = (k >= 4) ? modeIntervals[(i + 6) % k] : null;

        const thirdInt = (thirdOffset - chordRootOffset + 12) % 12;
        const fifthInt = (fifthOffset - chordRootOffset + 12) % 12;

        let triadQuality = 'maj';
        if (thirdInt === 3 && fifthInt === 7) triadQuality = 'min';
        else if (thirdInt === 3 && fifthInt === 6) triadQuality = 'dim';
        else if (thirdInt === 4 && fifthInt === 8) triadQuality = 'aug';
        else if (thirdInt === 2 && fifthInt === 7) triadQuality = 'sus2';
        else if (thirdInt === 5 && fifthInt === 7) triadQuality = 'sus4';
        else if (thirdInt === 4 && fifthInt === 7) triadQuality = 'maj';
        else if (fifthInt === 7) triadQuality = '5';

        // 7th chord identification
        let seventhQuality = triadQuality;
        if (seventhOffset !== null) {
          const seventhInt = (seventhOffset - chordRootOffset + 12) % 12;
          if (triadQuality === 'maj' && seventhInt === 11) seventhQuality = 'maj7';
          else if (triadQuality === 'maj' && seventhInt === 10) seventhQuality = '7';
          else if (triadQuality === 'min' && seventhInt === 10) seventhQuality = 'm7';
          else if (triadQuality === 'min' && seventhInt === 11) seventhQuality = 'mMaj7';
          else if (triadQuality === 'dim' && seventhInt === 10) seventhQuality = 'm7b5';
          else if (triadQuality === 'dim' && seventhInt === 9) seventhQuality = 'dim7';
          else if (triadQuality === 'aug' && seventhInt === 10) seventhQuality = 'aug7';
          else if (seventhInt === 10) seventhQuality = `${triadQuality}7`;
        }

        chords.push({
          degree: stepDegree,
          root: chordRootName,
          triad: `${chordRootName}${triadQuality === 'maj' ? '' : triadQuality}`,
          seventh: `${chordRootName}${seventhQuality === 'maj' ? '' : seventhQuality}`,
          intervalsFromTonic: chordRootOffset
        });
      }

      return chords;
    }

    // -------------------------------------------------------------
    // 4. Chord -> Scale Compatibility Matcher (Soloist Palette)
    // -------------------------------------------------------------
    findCompatibleScalesForChord(chordSymbol) {
      const Theory = window.SongTheory;
      if (!Theory) return [];

      const parsed = Theory.parseChord(chordSymbol);
      if (!parsed || !parsed.pitchClasses || parsed.pitchClasses.length === 0) return [];

      const chordPCs = parsed.pitchClasses;
      const rootPC = parsed.rootPC;
      const matches = [];

      this.catalog.forEach(scale => {
        // Check scale at the chord's root
        const modes = this.getRotationalModes(scale);

        modes.forEach(mode => {
          const modePCs = mode.intervals.map(iv => (rootPC + iv) % 12);
          const isFullSubset = chordPCs.every(cpc => modePCs.includes(cpc));

          if (isFullSubset) {
            matches.push({
              scaleId: scale.id,
              scaleName: scale.name,
              modeName: mode.name,
              formula: mode.formula,
              brightness: mode.brightness,
              mood: mode.mood,
              category: scale.category,
              cardinality: scale.cardinality,
              rootNote: Theory.pitchClassToNote(rootPC),
              pitchClasses: modePCs,
              fitType: (scale.cardinality === 7 && scale.category === 'diatonic')
                ? 'Standard / Diatonic'
                : (scale.category === 'jazz' || scale.category === 'jazz_and_classical')
                  ? 'Jazz & Melodic Spice'
                  : (scale.category === 'world')
                    ? 'Exotic World Color'
                    : 'Symmetrical / Modern'
            });
          }
        });
      });

      // Deduplicate and rank by brightness and category relevance
      const unique = [];
      const seen = new Set();
      matches.forEach(m => {
        const key = `${m.rootNote}_${m.modeName}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(m);
        }
      });

      return unique;
    }
  }

  // Export to global window namespace
  window.SongScales = {
    SCALE_CATALOG,
    ScaleEngine,
    scaleEngine: new ScaleEngine()
  };

})(typeof window !== 'undefined' ? window : globalThis);
