/**
 * Song Analyzer - Standard MIDI File (SMF Type 0 & Type 1) Engine (js/midi.js)
 * 100% Offline Pure JavaScript Binary MIDI Writer, Parser & DAW Exporter
 * 
 * Capabilities:
 * 1. Binary SMF Type 0 (Single Track) & Type 1 (Multi-Track) generation and parsing
 * 2. General MIDI (GM) Drum Specification mapping on Channel 10 (0x9):
 *    - Kick (36 / C1), Snare (38 / D1), Closed Hat (42 / F#1), Open Hat (46 / A#1),
 *      Ride Cymbal (51 / D#2), Crash Cymbal (49 / C#2), Cowbell (56 / G#2),
 *      Handclap (39 / D#1), Claves (75 / D#4)
 * 3. Polyphonic Chord Progression MIDI export (General MIDI Acoustic Grand Piano, Channel 1)
 * 4. Multi-Track Jam Session MIDI export:
 *    - Track 0: Conductor (Tempo & Time Signature Meta-Events)
 *    - Track 1: Chords (Polyphonic Grand Piano)
 *    - Track 2: Drums (GM Percussion Channel 10)
 *    - Track 3: Clave / Rhythm (GM Claves Channel 10)
 * 5. MIDI File Import: Parses external or exported .mid files and quantizes notes back into the Beat Builder grid
 * 6. Native client-side file downloads via Blob and URL.createObjectURL()
 */

(function (window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. MIDI Binary Encoding & Decoding Primitives
  // -------------------------------------------------------------
  function encodeVLQ(num) {
    num = Math.max(0, Math.floor(num));
    const buffer = [num & 0x7F];
    while ((num >>= 7) > 0) {
      buffer.unshift((num & 0x7F) | 0x80);
    }
    return buffer;
  }

  function decodeVLQ(bytes, offset) {
    let value = 0;
    let byte;
    do {
      if (offset >= bytes.length) break;
      byte = bytes[offset++];
      value = (value << 7) | (byte & 0x7F);
    } while (byte & 0x80);
    return { value, newOffset: offset };
  }

  function writeUInt16BE(val) {
    return [(val >> 8) & 0xFF, val & 0xFF];
  }

  function writeUInt32BE(val) {
    return [
      (val >> 24) & 0xFF,
      (val >> 16) & 0xFF,
      (val >> 8) & 0xFF,
      val & 0xFF
    ];
  }

  function readUInt16BE(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readUInt32BE(bytes, offset) {
    return ((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  }

  function stringToBytes(str) {
    const utf8 = unescape(encodeURIComponent(str || ''));
    const arr = [];
    for (let i = 0; i < utf8.length; i++) {
      arr.push(utf8.charCodeAt(i));
    }
    return arr;
  }

  function bytesToString(bytes, start, length) {
    let raw = '';
    const end = Math.min(bytes.length, start + length);
    for (let i = start; i < end; i++) {
      raw += String.fromCharCode(bytes[i]);
    }
    try {
      return decodeURIComponent(escape(raw));
    } catch (e) {
      return raw;
    }
  }

  // Convert note string like "C4", "F#3", "Bb4" to MIDI pitch number (C4 = 60)
  function noteToMidi(noteStr) {
    if (typeof noteStr === 'number') return Math.max(0, Math.min(127, Math.floor(noteStr)));
    if (!noteStr || typeof noteStr !== 'string') return 60;

    const match = noteStr.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return 60;

    const step = match[1].toUpperCase();
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    const semitones = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    let pitch = (octave + 1) * 12 + (semitones[step] || 0);
    if (accidental === '#') pitch += 1;
    else if (accidental === 'b') pitch -= 1;

    return Math.max(0, Math.min(127, pitch));
  }

  function midiToNote(midiPitch) {
    const pitch = Math.max(0, Math.min(127, Math.floor(midiPitch)));
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(pitch / 12) - 1;
    const noteName = noteNames[pitch % 12];
    return `${noteName}${octave}`;
  }

  // -------------------------------------------------------------
  // 2. General MIDI Drum & Percussion Mapping (Channel 10)
  // -------------------------------------------------------------
  const GM_DRUM_MAP = {
    kick: 36,      // Bass Drum 1
    snare: 38,     // Acoustic Snare
    closedHat: 42, // Closed Hi-Hat
    openHat: 46,   // Open Hi-Hat
    ride: 51,      // Ride Cymbal 1
    crash: 49,     // Crash Cymbal 1
    cowbell: 56,   // Cowbell
    clap: 39,      // Hand Clap
    clave: 75      // Claves
  };

  const MIDI_TO_DRUM_MAP = {
    35: 'kick', 36: 'kick',
    38: 'snare', 40: 'snare', 37: 'snare',
    42: 'closedHat', 44: 'closedHat',
    46: 'openHat',
    51: 'ride', 59: 'ride', 53: 'ride',
    49: 'crash', 57: 'crash', 55: 'crash', 52: 'crash',
    56: 'cowbell',
    39: 'clap',
    75: 'clave', 76: 'clave', 77: 'clave'
  };

  // -------------------------------------------------------------
  // 3. SMF Binary Generator & Parser
  // -------------------------------------------------------------
  function createMidiFile({ tracks, ppq = 480 }) {
    const bytes = [];

    // MThd Header: 14 bytes
    bytes.push(0x4D, 0x54, 0x68, 0x64); // 'MThd'
    bytes.push(...writeUInt32BE(6));    // Header length = 6
    bytes.push(...writeUInt16BE(tracks.length > 1 ? 1 : 0)); // Type 0 or 1
    bytes.push(...writeUInt16BE(tracks.length));            // Track count
    bytes.push(...writeUInt16BE(ppq));                      // Division (PPQ)

    tracks.forEach(trackEvents => {
      const sorted = [...trackEvents].sort((a, b) => a.tick - b.tick);
      const trackBytes = [];
      let lastTime = 0;

      sorted.forEach(evt => {
        const delta = Math.max(0, evt.tick - lastTime);
        lastTime = evt.tick;
        trackBytes.push(...encodeVLQ(delta));

        if (evt.type === 'tempo') {
          const mpq = Math.round(60000000 / (evt.bpm || 120));
          trackBytes.push(0xFF, 0x51, 0x03, (mpq >> 16) & 0xFF, (mpq >> 8) & 0xFF, mpq & 0xFF);
        } else if (evt.type === 'timeSignature') {
          const num = evt.num || 4;
          const denExp = Math.round(Math.log2(evt.den || 4));
          trackBytes.push(0xFF, 0x58, 0x04, num, denExp, 24, 8);
        } else if (evt.type === 'trackName') {
          const textBytes = stringToBytes(evt.name || '');
          trackBytes.push(0xFF, 0x03, ...encodeVLQ(textBytes.length), ...textBytes);
        } else if (evt.type === 'programChange') {
          trackBytes.push(0xC0 | (evt.channel & 0x0F), evt.program & 0x7F);
        } else if (evt.type === 'noteOn') {
          trackBytes.push(0x90 | (evt.channel & 0x0F), evt.note & 0x7F, evt.velocity & 0x7F);
        } else if (evt.type === 'noteOff') {
          trackBytes.push(0x80 | (evt.channel & 0x0F), evt.note & 0x7F, 0x00);
        }
      });

      // End of Track meta event
      trackBytes.push(...encodeVLQ(0));
      trackBytes.push(0xFF, 0x2F, 0x00);

      // MTrk Chunk
      bytes.push(0x4D, 0x54, 0x72, 0x6B); // 'MTrk'
      bytes.push(...writeUInt32BE(trackBytes.length));
      bytes.push(...trackBytes);
    });

    return new Uint8Array(bytes);
  }

  function parseMidiFile(buffer) {
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    const magic = String.fromCharCode(...bytes.slice(0, 4));
    if (magic !== 'MThd') throw new Error('Not a valid MIDI file (missing MThd header chunk)');
    offset += 4;

    const headerLen = readUInt32BE(bytes, offset);
    offset += 4;
    const formatType = readUInt16BE(bytes, offset);
    offset += 2;
    const numTracks = readUInt16BE(bytes, offset);
    offset += 2;
    const division = readUInt16BE(bytes, offset);
    offset += 2;

    const ppq = (division & 0x8000) === 0 ? division : 480;
    const tracks = [];
    let detectedBpm = 120;
    let detectedTimeSig = { num: 4, den: 4 };

    for (let t = 0; t < numTracks; t++) {
      if (offset >= bytes.length) break;
      const trackMagic = String.fromCharCode(...bytes.slice(offset, offset + 4));
      if (trackMagic !== 'MTrk') break;
      offset += 4;

      const trackLen = readUInt32BE(bytes, offset);
      offset += 4;
      const trackEnd = offset + trackLen;

      const trackEvents = [];
      let currentTick = 0;
      let runningStatus = 0;

      while (offset < trackEnd && offset < bytes.length) {
        const deltaRes = decodeVLQ(bytes, offset);
        currentTick += deltaRes.value;
        offset = deltaRes.newOffset;

        let status = bytes[offset];
        if (status & 0x80) {
          runningStatus = status;
          offset++;
        } else {
          status = runningStatus;
        }

        if (status === 0xFF) {
          const metaType = bytes[offset++];
          const lenRes = decodeVLQ(bytes, offset);
          const metaLen = lenRes.value;
          offset = lenRes.newOffset;

          if (metaType === 0x51 && metaLen === 3) {
            const mpq = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
            detectedBpm = Math.round(60000000 / mpq);
            trackEvents.push({ tick: currentTick, type: 'tempo', bpm: detectedBpm });
          } else if (metaType === 0x58 && metaLen >= 2) {
            const num = bytes[offset];
            const den = Math.pow(2, bytes[offset + 1]);
            detectedTimeSig = { num, den };
            trackEvents.push({ tick: currentTick, type: 'timeSignature', num, den });
          } else if (metaType === 0x03) {
            const name = bytesToString(bytes, offset, metaLen);
            trackEvents.push({ tick: currentTick, type: 'trackName', name });
          } else if (metaType === 0x2F) {
            break;
          }
          offset += metaLen;
        } else if (status === 0xF0 || status === 0xF7) {
          const lenRes = decodeVLQ(bytes, offset);
          offset = lenRes.newOffset + lenRes.value;
        } else {
          const eventType = status & 0xF0;
          const channel = status & 0x0F;

          if (eventType === 0x90) {
            const note = bytes[offset++];
            const velocity = bytes[offset++];
            if (velocity === 0) {
              trackEvents.push({ tick: currentTick, type: 'noteOff', channel, note, velocity: 0 });
            } else {
              trackEvents.push({ tick: currentTick, type: 'noteOn', channel, note, velocity });
            }
          } else if (eventType === 0x80) {
            const note = bytes[offset++];
            const velocity = bytes[offset++];
            trackEvents.push({ tick: currentTick, type: 'noteOff', channel, note, velocity });
          } else if (eventType === 0xC0) {
            const program = bytes[offset++];
            trackEvents.push({ tick: currentTick, type: 'programChange', channel, program });
          } else if (eventType === 0xB0 || eventType === 0xE0 || eventType === 0xA0) {
            offset += 2;
          } else if (eventType === 0xD0) {
            offset += 1;
          }
        }
      }

      offset = trackEnd;
      tracks.push(trackEvents);
    }

    return {
      formatType,
      numTracks: tracks.length,
      ppq,
      bpm: detectedBpm,
      timeSignature: detectedTimeSig,
      tracks
    };
  }

  // -------------------------------------------------------------
  // 4. Exporters for Drums, Chords, and Full Jam Sessions
  // -------------------------------------------------------------

  /**
   * Export BeatSequencer pattern to General MIDI (GM) Drum Track (.mid)
   */
  function exportBeatToMidi(sequencer, options = {}) {
    if (!sequencer) throw new Error('BeatSequencer instance is required');
    const ppq = options.ppq || 480;
    const loops = Math.max(1, parseInt(options.loops, 10) || 2);
    const pattern = sequencer.pattern || {};
    const sig = sequencer.timeSignature || { num: 4, den: 4 };
    const num = Math.max(1, parseInt(sig.num, 10) || 4);
    const den = Math.max(1, parseInt(sig.den, 10) || 4);
    const sub = Math.max(1, parseInt(sequencer.subdivision, 10) || 4);
    const stepCount = sequencer.getStepCount();
    const bpm = sequencer.bpm || 113;
    const swing = sequencer.swing || 0.0;

    const ticksPerBeat = ppq * (4 / den);
    const ticksPerStep = Math.round(ticksPerBeat / sub);
    const noteDurationTicks = Math.max(10, Math.round(ticksPerStep * 0.7));

    const events = [];
    events.push({ tick: 0, type: 'tempo', bpm });
    events.push({ tick: 0, type: 'timeSignature', num, den });
    events.push({ tick: 0, type: 'trackName', name: options.title || 'Drums (Song Analyzer)' });

    for (let l = 0; l < loops; l++) {
      const loopBaseTick = l * stepCount * ticksPerStep;

      for (let s = 0; s < stepCount; s++) {
        let stepTick = loopBaseTick + (s * ticksPerStep);
        if (s % 2 === 1 && swing > 0.01) {
          stepTick += Math.round(ticksPerStep * swing * 0.65);
        }

        for (const trackId in pattern) {
          const stepState = pattern[trackId] ? pattern[trackId][s] : 0;
          if (stepState > 0) {
            const pitch = GM_DRUM_MAP[trackId];
            if (!pitch) continue;

            let vel = 90;
            if (stepState === 2) vel = 115; // Accent
            else if (stepState === 3) vel = 45;  // Ghost

            events.push({ tick: stepTick, type: 'noteOn', channel: 9, note: pitch, velocity: vel });
            events.push({ tick: stepTick + noteDurationTicks, type: 'noteOff', channel: 9, note: pitch, velocity: 0 });
          }
        }
      }
    }

    return createMidiFile({ tracks: [events], ppq });
  }

  /**
   * Export Polyphonic Chord Progression to General MIDI Grand Piano (.mid)
   */
  function exportChordsToMidi(parsedChords, audioEngine, options = {}) {
    if (!parsedChords || parsedChords.length === 0) throw new Error('Chord progression is empty');
    const ppq = options.ppq || 480;
    const loops = Math.max(1, parseInt(options.loops, 10) || 2);
    const bpm = options.bpm || 113;
    const sig = options.timeSignature || { num: 4, den: 4 };
    const num = Math.max(1, parseInt(sig.num, 10) || 4);
    const den = Math.max(1, parseInt(sig.den, 10) || 4);

    const ticksPerBeat = ppq * (4 / den);
    const beatsPerChord = options.beatsPerChord || 2;
    const ticksPerChord = Math.round(ticksPerBeat * beatsPerChord);
    const chordDuration = Math.round(ticksPerChord * 0.92);

    const events = [];
    events.push({ tick: 0, type: 'tempo', bpm });
    events.push({ tick: 0, type: 'timeSignature', num, den });
    events.push({ tick: 0, type: 'trackName', name: options.title || 'Chords (Piano)' });
    events.push({ tick: 0, type: 'programChange', channel: 0, program: 0 }); // Acoustic Grand Piano

    for (let l = 0; l < loops; l++) {
      const loopBaseTick = l * parsedChords.length * ticksPerChord;

      parsedChords.forEach((chord, cIdx) => {
        const chordTick = loopBaseTick + (cIdx * ticksPerChord);
        let voicing = [];
        if (audioEngine && typeof audioEngine.generateVoicing === 'function') {
          voicing = audioEngine.generateVoicing(chord);
        } else if (chord.notes && Array.isArray(chord.notes)) {
          voicing = chord.notes.map(n => `${n}4`);
        } else {
          voicing = ['C4', 'E4', 'G4'];
        }

        voicing.forEach(noteStr => {
          const pitch = noteToMidi(noteStr);
          events.push({ tick: chordTick, type: 'noteOn', channel: 0, note: pitch, velocity: 88 });
          events.push({ tick: chordTick + chordDuration, type: 'noteOff', channel: 0, note: pitch, velocity: 0 });
        });
      });
    }

    return createMidiFile({ tracks: [events], ppq });
  }

  /**
   * Export Multi-Track Jam Session (Conductor + Chords + Drums + Clave)
   */
  function exportJamSessionToMidi({ sequencer, parsedChords, rhythmItems, audioEngine, bpm, timeSignature, loops = 2, ppq = 480 }) {
    const sig = timeSignature || (sequencer ? sequencer.timeSignature : { num: 4, den: 4 });
    const num = Math.max(1, parseInt(sig.num, 10) || 4);
    const den = Math.max(1, parseInt(sig.den, 10) || 4);
    const sub = sequencer ? Math.max(1, parseInt(sequencer.subdivision, 10) || 4) : 4;
    const tempo = bpm || (sequencer ? sequencer.bpm : 113);
    const stepCount = sequencer ? sequencer.getStepCount() : (num * sub);

    const ticksPerBeat = ppq * (4 / den);
    const ticksPerStep = Math.round(ticksPerBeat / sub);
    const barTicks = stepCount * ticksPerStep;

    // Track 0: Conductor Track
    const conductorTrack = [
      { tick: 0, type: 'tempo', bpm: tempo },
      { tick: 0, type: 'timeSignature', num, den },
      { tick: 0, type: 'trackName', name: 'Song Analyzer Jam Session' }
    ];

    // Track 1: Chords
    const chordTrack = [
      { tick: 0, type: 'trackName', name: 'Chords (Piano)' },
      { tick: 0, type: 'programChange', channel: 0, program: 0 }
    ];

    if (parsedChords && parsedChords.length > 0) {
      const beatsPerChord = 2;
      const ticksPerChord = Math.round(ticksPerBeat * beatsPerChord);
      const chordDuration = Math.round(ticksPerChord * 0.92);

      for (let l = 0; l < loops; l++) {
        const loopBase = l * parsedChords.length * ticksPerChord;
        parsedChords.forEach((chord, cIdx) => {
          const chordTick = loopBase + (cIdx * ticksPerChord);
          let voicing = [];
          if (audioEngine && typeof audioEngine.generateVoicing === 'function') {
            voicing = audioEngine.generateVoicing(chord);
          } else if (chord.notes && Array.isArray(chord.notes)) {
            voicing = chord.notes.map(n => `${n}4`);
          } else {
            voicing = ['C4', 'E4', 'G4'];
          }

          voicing.forEach(noteStr => {
            const pitch = noteToMidi(noteStr);
            chordTrack.push({ tick: chordTick, type: 'noteOn', channel: 0, note: pitch, velocity: 88 });
            chordTrack.push({ tick: chordTick + chordDuration, type: 'noteOff', channel: 0, note: pitch, velocity: 0 });
          });
        });
      }
    }

    // Track 2: Drums
    const drumTrack = [
      { tick: 0, type: 'trackName', name: 'Drums' }
    ];

    if (sequencer && sequencer.pattern) {
      const drumDur = Math.max(10, Math.round(ticksPerStep * 0.7));
      const swing = sequencer.swing || 0.0;

      for (let l = 0; l < loops; l++) {
        const loopBaseTick = l * barTicks;
        for (let s = 0; s < stepCount; s++) {
          let stepTick = loopBaseTick + (s * ticksPerStep);
          if (s % 2 === 1 && swing > 0.01) {
            stepTick += Math.round(ticksPerStep * swing * 0.65);
          }

          for (const trackId in sequencer.pattern) {
            const state = sequencer.pattern[trackId] ? sequencer.pattern[trackId][s] : 0;
            if (state > 0) {
              const pitch = GM_DRUM_MAP[trackId];
              if (!pitch) continue;
              let vel = (state === 2) ? 115 : (state === 3 ? 45 : 90);
              drumTrack.push({ tick: stepTick, type: 'noteOn', channel: 9, note: pitch, velocity: vel });
              drumTrack.push({ tick: stepTick + drumDur, type: 'noteOff', channel: 9, note: pitch, velocity: 0 });
            }
          }
        }
      }
    }

    // Track 3: Clave / Rhythm
    const claveTrack = [
      { tick: 0, type: 'trackName', name: 'Clave Rhythm' }
    ];

    if (rhythmItems && rhythmItems.length > 0) {
      for (let l = 0; l < loops; l++) {
        let currTick = l * barTicks;
        rhythmItems.forEach(item => {
          const itemTicks = Math.round((item.value / 32) * ticksPerBeat);
          if (!item.isRest) {
            claveTrack.push({ tick: currTick, type: 'noteOn', channel: 9, note: GM_DRUM_MAP.clave, velocity: 100 });
            claveTrack.push({ tick: currTick + 70, type: 'noteOff', channel: 9, note: GM_DRUM_MAP.clave, velocity: 0 });
          }
          currTick += itemTicks;
        });
      }
    }

    const allTracks = [conductorTrack];
    if (chordTrack.length > 2) allTracks.push(chordTrack);
    if (drumTrack.length > 1) allTracks.push(drumTrack);
    if (claveTrack.length > 1) allTracks.push(claveTrack);

    return createMidiFile({ tracks: allTracks, ppq });
  }

  // -------------------------------------------------------------
  // 5. MIDI Importer for BeatSequencer
  // -------------------------------------------------------------
  function importMidiToBeat(arrayBuffer, sequencer) {
    if (!arrayBuffer || !sequencer) throw new Error('ArrayBuffer and BeatSequencer are required');
    const parsed = parseMidiFile(arrayBuffer);
    const ppq = parsed.ppq || 480;

    const num = parsed.timeSignature ? parsed.timeSignature.num : (sequencer.timeSignature.num || 4);
    const den = parsed.timeSignature ? parsed.timeSignature.den || 4 : 4;
    const sub = sequencer.subdivision || 4;

    sequencer.setTimeSignature({ num, den }, sub);
    if (parsed.bpm && parsed.bpm >= 15 && parsed.bpm <= 240) {
      sequencer.setBpm(parsed.bpm);
    }
    sequencer.clearPattern();

    const stepCount = sequencer.getStepCount();
    const ticksPerBeat = ppq * (4 / den);
    const ticksPerStep = Math.max(1, Math.round(ticksPerBeat / sub));
    const barTicks = stepCount * ticksPerStep;

    let notesFound = 0;

    parsed.tracks.forEach(track => {
      track.forEach(evt => {
        if (evt.type === 'noteOn' && evt.velocity > 0) {
          const trackId = MIDI_TO_DRUM_MAP[evt.note];
          if (trackId && sequencer.pattern[trackId]) {
            const tickInBar = evt.tick % barTicks;
            const step = Math.round(tickInBar / ticksPerStep) % stepCount;
            let state = 1;
            if (evt.velocity >= 105) state = 2;
            else if (evt.velocity < 60) state = 3;

            if (state > sequencer.pattern[trackId][step] || sequencer.pattern[trackId][step] === 0) {
              sequencer.pattern[trackId][step] = state;
              notesFound++;
            }
          }
        }
      });
    });

    return {
      bpm: parsed.bpm,
      timeSignature: parsed.timeSignature,
      stepCount,
      notesFound
    };
  }

  // -------------------------------------------------------------
  // 6. Client-Side Download Helper
  // -------------------------------------------------------------
  function downloadMidiBlob(uint8Array, filename = 'song_groove.mid') {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([uint8Array], { type: 'audio/midi' });
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
  }

  // Export to global window namespace
  window.SongMidi = {
    createMidiFile,
    parseMidiFile,
    noteToMidi,
    midiToNote,
    GM_DRUM_MAP,
    MIDI_TO_DRUM_MAP,
    exportBeatToMidi,
    exportChordsToMidi,
    exportJamSessionToMidi,
    importMidiToBeat,
    downloadMidiBlob
  };

})(typeof window !== 'undefined' ? window : globalThis);
