# Universal Modal Interchange & Mood-Shifting Engine
# Operates purely on scale degrees and parallel modal harmony.

# Define the diatonic chord qualities for each scale degree (1 to 7) across modes
# Root C is assumed for baseline; chords adjust automatically based on modal formulas.
MODAL_CHORD_QUALITIES = {
    '1. Locrian (Dread & Grief)': {
        1: 'm7b5',
        2: 'm7',
        3: 'maj7',
        4: 'm7',
        5: '7',
        6: 'maj7',
        7: '7',
    },
    '2. Phrygian (Suspensive Desolation)': {
        1: 'm7',
        2: 'maj7',
        3: '7',
        4: 'm7',
        5: 'm7b5',
        6: 'maj7',
        7: '7',
    },
    '3. Aeolian / Minor (Bittersweet Nostalgia)': {
        1: 'm7',
        2: 'm7b5',
        3: 'maj7',
        4: 'm7',
        5: 'm7',  # or 7 (harmonic minor)
        6: 'maj7',
        7: '7',
    },
    '4. Mixolydian / Backdoor (Grounded Warmth)': {
        1: '7',
        2: 'm7',
        3: 'm7b5',
        4: 'maj7',
        5: 'm7',
        6: 'm7',
        7: 'maj7',
    },
    '5. Ionian / Major (Calm Stability - Baseline)': {
        1: 'maj7',
        2: 'm7',
        3: 'm7',
        4: 'maj7',
        5: '7',
        6: 'm7',
        7: 'm7b5',
    },
    '6. Lydian (Euphoric Transcendence)': {
        1: 'maj7#11',
        2: '7',
        3: 'm7',
        4: 'm7b5',
        5: 'maj7',
        6: 'm7',
        7: 'm7',
    },
}

# Chromatic scale mapping for root calculation
NOTE_NAMES = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
]

# Scale degree interval offsets from root (Major scale intervals as baseline)
DEGREE_SEMITONES = {1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11}


def get_root_note(tonic: str, degree: int, mode_name: str) -> str:
  """Calculates the exact root note name for a given degree and mode."""
  base_idx = NOTE_NAMES.index(tonic.upper())

  # Adjust semitone offset slightly based on mode flavor if needed,
  # but standard parallel modal roots anchor to the same tonic or flattened roots.
  offset = DEGREE_SEMITONES[degree]

  # Special modal root adjustments (e.g., Phrygian flat-2, Lydian sharp-4)
  if 'Phrygian' in mode_name and degree == 2:
    offset = 1  # b2 root
  elif 'Lydian' in mode_name and degree == 4:
    offset = 6  # #4 root

  root_idx = (base_idx + offset) % 12
  return NOTE_NAMES[root_idx]


def transform_progression(tonic: str, progression_degrees: list):
  """Takes any progression (list of scale degrees) and maps it

  across all 6 emotional/modal tiers, outputting clean chord names.
  """
  print(
      f'=== Modal Interchange Engine: Key of {tonic}'
      f' | Input Degrees: {progression_degrees} ===\n'
  )

  for tier, chord_map in MODAL_CHORD_QUALITIES.items():
    rendered_chords = []
    for deg in progression_degrees:
      root = get_root_note(tonic, deg, tier)
      quality = chord_map.get(deg, 'maj7')
      rendered_chords.append(f'{root}{quality}')

    print(f'[{tier}]')
    print(f'  Resulting Progression: {" -> ".join(rendered_chords)}\n')


if __name__ == '__main__':
  input_progression = input("Enter your chord progression as scale degrees separated by commas: ")
  print(type(input_progression))
  progression_list = []
  degree_split = input_progression.split(",")
  for degree in degree_split:
    progression_list.append(int(degree))

  # Example 1: Standard Pop/Jazz Progression (1 - 6 - 4 - 5) in C Major
  #transform_progression(tonic='C', progression_degrees=[1, 6, 4, 5])

  # Example 2: You can plug in ANY arbitrary progression degrees here, e.g., (1 - 4 - 7 - 3)
  transform_progression(tonic="G", progression_degrees=progression_list)

