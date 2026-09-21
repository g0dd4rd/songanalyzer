/**
 * Song Analyzer - Multi-Notation Movable Chord Studio (js/chords.js)
 * 100% Offline Vanilla JS Engine for 4/5/6-String Bass & 6/7/8-String Guitar
 * 
 * Features:
 * - Comprehensive tuning presets (Standard, Drop D/A/E/C/G, Open, Half-step down)
 * - Dynamic drop-tuning fret compensation & 1-finger power barres
 * - Movable shape database (CAGED, Drop 2, Drop 3, Shells, 10ths, Power, Djent)
 * - Vector SVG Chord Box generator (Default: Harmonic Intervals, Toggle: Fingering)
 * - Formatted TAB notation generator with one-click ASCII clipboard copy
 * - Procedural Musical Staff Canvas renderer (Treble G8 & Bass F8 clefs)
 * - Zero-allocation integration with Web Audio engine
 */

(function (window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. Instrument Tunings Dictionary (Pitch Classes, MIDI, Labels)
  // -------------------------------------------------------------
  const CHORD_TUNINGS = {
    // 4-String Bass (Index 0 = lowest string / lowest pitch)
    'bass_4str_std': {
      id: 'bass_4str_std',
      instrument: 'bass_4str',
      name: '4-String Bass (Standard EADG)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' }
      ]
    },
    'bass_4str_drop_d': {
      id: 'bass_4str_drop_d',
      instrument: 'bass_4str',
      name: '4-String Bass (Drop D: DADG)',
      isDrop: true,
      dropOffset: -2,
      clef: 'bass',
      strings: [
        { note: 'D1', midi: 26, pc: 2, label: 'D' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' }
      ]
    },
    'bass_4str_drop_c': {
      id: 'bass_4str_drop_c',
      instrument: 'bass_4str',
      name: '4-String Bass (Drop C: CGCF)',
      isDrop: true,
      dropOffset: -2,
      clef: 'bass',
      strings: [
        { note: 'C1', midi: 24, pc: 0, label: 'C' },
        { note: 'G1', midi: 31, pc: 7, label: 'G' },
        { note: 'C2', midi: 36, pc: 0, label: 'C' },
        { note: 'F2', midi: 41, pc: 5, label: 'F' }
      ]
    },
    'bass_4str_d_std': {
      id: 'bass_4str_d_std',
      instrument: 'bass_4str',
      name: '4-String Bass (D Standard: DGCF)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'D1', midi: 26, pc: 2, label: 'D' },
        { note: 'G1', midi: 31, pc: 7, label: 'G' },
        { note: 'C2', midi: 36, pc: 0, label: 'C' },
        { note: 'F2', midi: 41, pc: 5, label: 'F' }
      ]
    },
    'bass_4str_half_step': {
      id: 'bass_4str_half_step',
      instrument: 'bass_4str',
      name: '4-String Bass (Half-Step Down Eb)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'Eb1', midi: 27, pc: 3, label: 'Eb' },
        { note: 'Ab1', midi: 32, pc: 8, label: 'Ab' },
        { note: 'Db2', midi: 37, pc: 1, label: 'Db' },
        { note: 'Gb2', midi: 42, pc: 6, label: 'Gb' }
      ]
    },

    // 5-String Bass
    'bass_5str_std': {
      id: 'bass_5str_std',
      instrument: 'bass_5str',
      name: '5-String Bass (Standard BEADG)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'B0', midi: 23, pc: 11, label: 'B' },
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' }
      ]
    },
    'bass_5str_drop_a': {
      id: 'bass_5str_drop_a',
      instrument: 'bass_5str',
      name: '5-String Bass (Drop A: AEADG)',
      isDrop: true,
      dropOffset: -2,
      clef: 'bass',
      strings: [
        { note: 'A0', midi: 21, pc: 9, label: 'A' },
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' }
      ]
    },
    'bass_5str_tenor': {
      id: 'bass_5str_tenor',
      instrument: 'bass_5str',
      name: '5-String Bass (Tenor: EADGC)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'C3', midi: 48, pc: 0, label: 'C' }
      ]
    },
    'bass_5str_half_step': {
      id: 'bass_5str_half_step',
      instrument: 'bass_5str',
      name: '5-String Bass (Half-Step Down Bb)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'Bb0', midi: 22, pc: 10, label: 'Bb' },
        { note: 'Eb1', midi: 27, pc: 3, label: 'Eb' },
        { note: 'Ab1', midi: 32, pc: 8, label: 'Ab' },
        { note: 'Db2', midi: 37, pc: 1, label: 'Db' },
        { note: 'Gb2', midi: 42, pc: 6, label: 'Gb' }
      ]
    },

    // 6-String Bass
    'bass_6str_std': {
      id: 'bass_6str_std',
      instrument: 'bass_6str',
      name: '6-String Bass (Standard BEADGC)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'B0', midi: 23, pc: 11, label: 'B' },
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'C3', midi: 48, pc: 0, label: 'C' }
      ]
    },
    'bass_6str_drop_a': {
      id: 'bass_6str_drop_a',
      instrument: 'bass_6str',
      name: '6-String Bass (Drop A: AEADGC)',
      isDrop: true,
      dropOffset: -2,
      clef: 'bass',
      strings: [
        { note: 'A0', midi: 21, pc: 9, label: 'A' },
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'C3', midi: 48, pc: 0, label: 'C' }
      ]
    },
    'bass_6str_fsharp': {
      id: 'bass_6str_fsharp',
      instrument: 'bass_6str',
      name: '6-String Bass (Low F#: F#BEADG)',
      isDrop: false,
      dropOffset: 0,
      clef: 'bass',
      strings: [
        { note: 'F#0', midi: 18, pc: 6, label: 'F#' },
        { note: 'B0', midi: 23, pc: 11, label: 'B' },
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' }
      ]
    },

    // 6-String Guitar
    'guitar_6str_std': {
      id: 'guitar_6str_std',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Standard EADGBE)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'E2', midi: 40, pc: 4, label: 'E' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    },
    'guitar_6str_drop_d': {
      id: 'guitar_6str_drop_d',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Drop D: DADGBE)',
      isDrop: true,
      dropOffset: -2,
      clef: 'treble',
      strings: [
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    },
    'guitar_6str_drop_c': {
      id: 'guitar_6str_drop_c',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Drop C: CGCFAD)',
      isDrop: true,
      dropOffset: -2,
      clef: 'treble',
      strings: [
        { note: 'C2', midi: 36, pc: 0, label: 'C' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'C3', midi: 48, pc: 0, label: 'C' },
        { note: 'F3', midi: 53, pc: 5, label: 'F' },
        { note: 'A3', midi: 57, pc: 9, label: 'A' },
        { note: 'D4', midi: 62, pc: 2, label: 'd' }
      ]
    },
    'guitar_6str_dadgad': {
      id: 'guitar_6str_dadgad',
      instrument: 'guitar_6str',
      name: '6-String Guitar (DADGAD)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'A3', midi: 57, pc: 9, label: 'A' },
        { note: 'D4', midi: 62, pc: 2, label: 'd' }
      ]
    },
    'guitar_6str_open_d': {
      id: 'guitar_6str_open_d',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Open D: DADF#AD)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'F#3', midi: 54, pc: 6, label: 'F#' },
        { note: 'A3', midi: 57, pc: 9, label: 'A' },
        { note: 'D4', midi: 62, pc: 2, label: 'd' }
      ]
    },
    'guitar_6str_open_g': {
      id: 'guitar_6str_open_g',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Open G: DGDGBD)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'D4', midi: 62, pc: 2, label: 'd' }
      ]
    },
    'guitar_6str_half_step': {
      id: 'guitar_6str_half_step',
      instrument: 'guitar_6str',
      name: '6-String Guitar (Half-Step Down Eb)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'Eb2', midi: 39, pc: 3, label: 'Eb' },
        { note: 'Ab2', midi: 44, pc: 8, label: 'Ab' },
        { note: 'Db3', midi: 49, pc: 1, label: 'Db' },
        { note: 'Gb3', midi: 54, pc: 6, label: 'Gb' },
        { note: 'Bb3', midi: 58, pc: 10, label: 'Bb' },
        { note: 'Eb4', midi: 63, pc: 3, label: 'eb' }
      ]
    },

    // 7-String Guitar
    'guitar_7str_std': {
      id: 'guitar_7str_std',
      instrument: 'guitar_7str',
      name: '7-String Guitar (Standard BEADGBE)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'B1', midi: 35, pc: 11, label: 'B' },
        { note: 'E2', midi: 40, pc: 4, label: 'E' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    },
    'guitar_7str_drop_a': {
      id: 'guitar_7str_drop_a',
      instrument: 'guitar_7str',
      name: '7-String Guitar (Drop A: AEADGBE)',
      isDrop: true,
      dropOffset: -2,
      clef: 'treble',
      strings: [
        { note: 'A1', midi: 33, pc: 9, label: 'A' },
        { note: 'E2', midi: 40, pc: 4, label: 'E' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    },
    'guitar_7str_drop_g': {
      id: 'guitar_7str_drop_g',
      instrument: 'guitar_7str',
      name: '7-String Guitar (Drop G: GDGCFAD)',
      isDrop: true,
      dropOffset: -2,
      clef: 'treble',
      strings: [
        { note: 'G1', midi: 31, pc: 7, label: 'G' },
        { note: 'D2', midi: 38, pc: 2, label: 'D' },
        { note: 'G2', midi: 43, pc: 7, label: 'G' },
        { note: 'C3', midi: 48, pc: 0, label: 'C' },
        { note: 'F3', midi: 53, pc: 5, label: 'F' },
        { note: 'A3', midi: 57, pc: 9, label: 'A' },
        { note: 'D4', midi: 62, pc: 2, label: 'd' }
      ]
    },

    // 8-String Guitar
    'guitar_8str_std': {
      id: 'guitar_8str_std',
      instrument: 'guitar_8str',
      name: '8-String Guitar (Standard F#BEADGBE)',
      isDrop: false,
      dropOffset: 0,
      clef: 'treble',
      strings: [
        { note: 'F#1', midi: 30, pc: 6, label: 'F#' },
        { note: 'B1', midi: 35, pc: 11, label: 'B' },
        { note: 'E2', midi: 40, pc: 4, label: 'E' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    },
    'guitar_8str_drop_e': {
      id: 'guitar_8str_drop_e',
      instrument: 'guitar_8str',
      name: '8-String Guitar (Drop E: EBEADGBE)',
      isDrop: true,
      dropOffset: -2,
      clef: 'treble',
      strings: [
        { note: 'E1', midi: 28, pc: 4, label: 'E' },
        { note: 'B1', midi: 35, pc: 11, label: 'B' },
        { note: 'E2', midi: 40, pc: 4, label: 'E' },
        { note: 'A2', midi: 45, pc: 9, label: 'A' },
        { note: 'D3', midi: 50, pc: 2, label: 'D' },
        { note: 'G3', midi: 55, pc: 7, label: 'G' },
        { note: 'B3', midi: 59, pc: 11, label: 'B' },
        { note: 'E4', midi: 64, pc: 4, label: 'e' }
      ]
    }
  };

  // -------------------------------------------------------------
  // 2. Harmonic Interval Colors & Roles
  // -------------------------------------------------------------
  const INTERVAL_COLORS = {
    'R': { fill: '#ef4444', text: '#ffffff', name: 'Root' },
    'b2': { fill: '#f97316', text: '#ffffff', name: 'Minor 2nd' },
    '2': { fill: '#f59e0b', text: '#0f172a', name: 'Major 2nd / 9th' },
    'b3': { fill: '#3b82f6', text: '#ffffff', name: 'Minor 3rd' },
    '3': { fill: '#06b6d4', text: '#0f172a', name: 'Major 3rd' },
    '4': { fill: '#14b8a6', text: '#0f172a', name: 'Perfect 4th / 11th' },
    'b5': { fill: '#a855f7', text: '#ffffff', name: 'Dim 5th / Tritone' },
    '5': { fill: '#10b981', text: '#ffffff', name: 'Perfect 5th' },
    '#5': { fill: '#ec4899', text: '#ffffff', name: 'Aug 5th' },
    '6': { fill: '#8b5cf6', text: '#ffffff', name: 'Major 6th / 13th' },
    'b7': { fill: '#9333ea', text: '#ffffff', name: 'Minor 7th' },
    '7': { fill: '#c026d3', text: '#ffffff', name: 'Major 7th' },
    'b9': { fill: '#f97316', text: '#ffffff', name: 'Flat 9th' },
    '9': { fill: '#f59e0b', text: '#0f172a', name: '9th' },
    '#9': { fill: '#fb923c', text: '#0f172a', name: 'Sharp 9th' },
    '10': { fill: '#06b6d4', text: '#0f172a', name: 'Tenth (Decima)' },
    'b10': { fill: '#3b82f6', text: '#ffffff', name: 'Minor Tenth' },
    '11': { fill: '#14b8a6', text: '#0f172a', name: '11th' },
    '#11': { fill: '#2dd4bf', text: '#0f172a', name: 'Sharp 11th' },
    '13': { fill: '#8b5cf6', text: '#ffffff', name: '13th' }
  };

  // -------------------------------------------------------------
  // 3. Movable Shapes Master Database
  // -------------------------------------------------------------
  // Each shape defines:
  // - rootString: 0-indexed string on which the root note is anchored (0 = lowest string)
  // - strings: array of relative fret offsets from the root's fret (or null if string is muted)
  // - intervals: array of interval names
  // - fingers: array of recommended fingers ('1', '2', '3', '4', 'T')
  // - barre: optional { fretOffset, fromString, toString, finger }
  const MOVABLE_SHAPES_DB = [
    // =========================================================
    // GUITAR: 6-STRING MOVABLE SHAPES
    // =========================================================

    // --- Major & Add9 ---
    {
      id: 'g6_maj_e_shape',
      instFamily: 'guitar_6str',
      quality: 'maj',
      name: 'E-Shape Barre (Root 6)',
      style: 'CAGED',
      rootString: 0,
      strings: [0, 2, 2, 1, 0, 0],
      intervals: ['R', '5', 'R', '3', '5', 'R'],
      fingers: ['1', '3', '4', '2', '1', '1'],
      barre: { fretOffset: 0, fromString: 0, toString: 5, finger: '1' }
    },
    {
      id: 'g6_maj_a_shape',
      instFamily: 'guitar_6str',
      quality: 'maj',
      name: 'A-Shape Barre (Root 5)',
      style: 'CAGED',
      rootString: 1,
      strings: [null, 0, 2, 2, 2, 0],
      intervals: [null, 'R', '5', 'R', '3', '5'],
      fingers: [null, '1', '3', '3', '3', '1'],
      barre: { fretOffset: 0, fromString: 1, toString: 5, finger: '1' }
    },
    {
      id: 'g6_maj_c_shape',
      instFamily: 'guitar_6str',
      quality: 'maj',
      name: 'C-Shape Movable (Root 5)',
      style: 'CAGED',
      rootString: 1,
      strings: [null, 3, 2, 0, 1, null],
      intervals: [null, 'R', '3', '5', 'R', null],
      fingers: [null, '4', '3', '1', '2', null]
    },
    {
      id: 'g6_maj_drop2_top',
      instFamily: 'guitar_6str',
      quality: 'maj',
      name: 'Drop 2 Major (Top 4 Strings, Root Pos)',
      style: 'Drop 2',
      rootString: 2,
      strings: [null, null, 0, 2, 2, 2],
      intervals: [null, null, 'R', '5', '7', '3'],
      fingers: [null, null, '1', '2', '3', '4']
    },

    // --- Minor ---
    {
      id: 'g6_min_em_shape',
      instFamily: 'guitar_6str',
      quality: 'min',
      name: 'Em-Shape Barre (Root 6)',
      style: 'CAGED',
      rootString: 0,
      strings: [0, 2, 2, 0, 0, 0],
      intervals: ['R', '5', 'R', 'b3', '5', 'R'],
      fingers: ['1', '3', '4', '1', '1', '1'],
      barre: { fretOffset: 0, fromString: 0, toString: 5, finger: '1' }
    },
    {
      id: 'g6_min_am_shape',
      instFamily: 'guitar_6str',
      quality: 'min',
      name: 'Am-Shape Barre (Root 5)',
      style: 'CAGED',
      rootString: 1,
      strings: [null, 0, 2, 2, 1, 0],
      intervals: [null, 'R', '5', 'R', 'b3', '5'],
      fingers: [null, '1', '3', '4', '2', '1'],
      barre: { fretOffset: 0, fromString: 1, toString: 5, finger: '1' }
    },
    {
      id: 'g6_min_dm_shape',
      instFamily: 'guitar_6str',
      quality: 'min',
      name: 'Dm-Shape Movable (Root 4)',
      style: 'CAGED',
      rootString: 2,
      strings: [null, null, 0, 2, 3, 1],
      intervals: [null, null, 'R', '5', 'R', 'b3'],
      fingers: [null, null, '1', '2', '4', '1']
    },

    // --- Dominant 7th & Altered ---
    {
      id: 'g6_dom7_e7_shape',
      instFamily: 'guitar_6str',
      quality: '7',
      name: 'E7-Shape Barre (Root 6)',
      style: 'CAGED',
      rootString: 0,
      strings: [0, 2, 0, 1, 0, 0],
      intervals: ['R', '5', 'b7', '3', '5', 'R'],
      fingers: ['1', '3', '1', '2', '1', '1'],
      barre: { fretOffset: 0, fromString: 0, toString: 5, finger: '1' }
    },
    {
      id: 'g6_dom7_a7_shape',
      instFamily: 'guitar_6str',
      quality: '7',
      name: 'A7-Shape Barre (Root 5)',
      style: 'CAGED',
      rootString: 1,
      strings: [null, 0, 2, 0, 2, 0],
      intervals: [null, 'R', '5', 'b7', '3', '5'],
      fingers: [null, '1', '3', '1', '4', '1'],
      barre: { fretOffset: 0, fromString: 1, toString: 5, finger: '1' }
    },
    {
      id: 'g6_dom7_freddie_green_r6',
      instFamily: 'guitar_6str',
      quality: '7',
      name: 'Freddie Green 3-Note Shell (Root 6)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 0, 1, null, null],
      intervals: ['R', null, 'b7', '3', null, null],
      fingers: ['2', null, '3', '1', null, null]
    },
    {
      id: 'g6_dom7_freddie_green_r5',
      instFamily: 'guitar_6str',
      quality: '7',
      name: 'Freddie Green 3-Note Shell (Root 5)',
      style: 'Shells',
      rootString: 1,
      strings: [null, 0, -1, 0, null, null],
      intervals: [null, 'R', '3', 'b7', null, null],
      fingers: [null, '2', '1', '3', null, null]
    },
    {
      id: 'g6_hendrix_7sharp9',
      instFamily: 'guitar_6str',
      quality: '7#9',
      name: 'Hendrix Purple Haze Chord (Root 5)',
      style: 'Altered',
      rootString: 1,
      strings: [null, 0, -1, 0, 1, null],
      intervals: [null, 'R', '3', 'b7', '#9', null],
      fingers: [null, '2', '1', '3', '4', null]
    },
    {
      id: 'g6_dom9_root5',
      instFamily: 'guitar_6str',
      quality: '9',
      name: 'Dominant 9th (Root 5 Funk Grip)',
      style: 'Extended',
      rootString: 1,
      strings: [null, 0, -1, 0, 0, null],
      intervals: [null, 'R', '3', 'b7', '9', null],
      fingers: [null, '2', '1', '3', '3', null],
      barre: { fretOffset: 0, fromString: 3, toString: 4, finger: '3' }
    },

    // --- Major 7th & Maj9 ---
    {
      id: 'g6_maj7_drop3_r6',
      instFamily: 'guitar_6str',
      quality: 'maj7',
      name: 'Drop 3 Major 7th (Root 6)',
      style: 'Drop 3',
      rootString: 0,
      strings: [0, null, 1, 1, 0, null],
      intervals: ['R', null, '7', '3', '5', null],
      fingers: ['1', null, '3', '4', '2', null]
    },
    {
      id: 'g6_maj7_drop2_r5',
      instFamily: 'guitar_6str',
      quality: 'maj7',
      name: 'Drop 2 Major 7th (Root 5)',
      style: 'Drop 2',
      rootString: 1,
      strings: [null, 0, 2, 1, 2, null],
      intervals: [null, 'R', '5', '7', '3', null],
      fingers: [null, '1', '3', '2', '4', null]
    },
    {
      id: 'g6_maj9_root5',
      instFamily: 'guitar_6str',
      quality: 'maj9',
      name: 'Major 9th (Root 5 Neo-Soul)',
      style: 'Extended',
      rootString: 1,
      strings: [null, 0, -1, 1, 0, null],
      intervals: [null, 'R', '3', '7', '9', null],
      fingers: [null, '2', '1', '4', '3', null]
    },

    // --- Minor 7th & Minor 9th ---
    {
      id: 'g6_min7_drop3_r6',
      instFamily: 'guitar_6str',
      quality: 'min7',
      name: 'Drop 3 Minor 7th (Root 6)',
      style: 'Drop 3',
      rootString: 0,
      strings: [0, null, 0, 0, 0, null],
      intervals: ['R', null, 'b7', 'b3', '5', null],
      fingers: ['1', null, '2', '3', '4', null]
    },
    {
      id: 'g6_min7_drop2_r5',
      instFamily: 'guitar_6str',
      quality: 'min7',
      name: 'Drop 2 Minor 7th (Root 5)',
      style: 'Drop 2',
      rootString: 1,
      strings: [null, 0, 2, 0, 1, null],
      intervals: [null, 'R', '5', 'b7', 'b3', null],
      fingers: [null, '1', '3', '1', '2', null]
    },
    {
      id: 'g6_min9_root5',
      instFamily: 'guitar_6str',
      quality: 'min9',
      name: 'Minor 9th (Root 5 Lush Voicing)',
      style: 'Extended',
      rootString: 1,
      strings: [null, 0, -2, 0, 0, null],
      intervals: [null, 'R', 'b3', 'b7', '9', null],
      fingers: [null, '2', '1', '3', '4', null]
    },

    // --- Minor 7b5 (Half-Diminished) & Diminished 7 ---
    {
      id: 'g6_m7b5_r6',
      instFamily: 'guitar_6str',
      quality: 'm7b5',
      name: 'Minor 7b5 (Root 6)',
      style: 'Jazz',
      rootString: 0,
      strings: [0, null, 0, 0, -1, null],
      intervals: ['R', null, 'b7', 'b3', 'b5', null],
      fingers: ['2', null, '3', '4', '1', null]
    },
    {
      id: 'g6_m7b5_r5',
      instFamily: 'guitar_6str',
      quality: 'm7b5',
      name: 'Minor 7b5 (Root 5)',
      style: 'Jazz',
      rootString: 1,
      strings: [null, 0, 1, 0, 1, null],
      intervals: [null, 'R', 'b5', 'b7', 'b3', null],
      fingers: [null, '1', '3', '2', '4', null]
    },
    {
      id: 'g6_dim7_r5',
      instFamily: 'guitar_6str',
      quality: 'dim7',
      name: 'Symmetric Diminished 7th (Root 5)',
      style: 'Jazz',
      rootString: 1,
      strings: [null, 0, 1, -1, 1, null],
      intervals: [null, 'R', 'b5', '6', 'b3', null],
      fingers: [null, '2', '3', '1', '4', null]
    },

    // --- Suspended & Power Chords ---
    {
      id: 'g6_sus4_r6',
      instFamily: 'guitar_6str',
      quality: 'sus4',
      name: 'Sus4 Barre (Root 6)',
      style: 'CAGED',
      rootString: 0,
      strings: [0, 2, 2, 2, 0, 0],
      intervals: ['R', '5', 'R', '4', '5', 'R'],
      fingers: ['1', '2', '3', '4', '1', '1'],
      barre: { fretOffset: 0, fromString: 0, toString: 5, finger: '1' }
    },
    {
      id: 'g6_power_r6',
      instFamily: 'guitar_6str',
      quality: '5',
      name: 'Power Chord R-5-8 (Root 6)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null, null, null],
      intervals: ['R', '5', 'R', null, null, null],
      fingers: ['1', '3', '4', null, null, null]
    },
    {
      id: 'g6_power_r5',
      instFamily: 'guitar_6str',
      quality: '5',
      name: 'Power Chord R-5-8 (Root 5)',
      style: 'Power',
      rootString: 1,
      strings: [null, 0, 2, 2, null, null],
      intervals: [null, 'R', '5', 'R', null, null],
      fingers: [null, '1', '3', '4', null, null]
    },

    // =========================================================
    // GUITAR: 7-STRING MOVABLE SHAPES (BEADGBE / Drop A)
    // =========================================================
    {
      id: 'g7_power_r7',
      instFamily: 'guitar_7str',
      quality: '5',
      name: '7-String Low-B Power Chord (Root 7)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null, null, null, null],
      intervals: ['R', '5', 'R', null, null, null, null],
      fingers: ['1', '3', '4', null, null, null, null]
    },
    {
      id: 'g7_djent_stacked5th',
      instFamily: 'guitar_7str',
      quality: '5',
      name: 'Stacked 5ths Prog Metal Grip (R-5-9-13)',
      style: 'Djent',
      rootString: 0,
      strings: [0, 2, 4, 4, null, null, null],
      intervals: ['R', '5', '9', '13', null, null, null],
      fingers: ['1', '2', '4', '4', null, null, null]
    },
    {
      id: 'g7_min7_low_b',
      instFamily: 'guitar_7str',
      quality: 'min7',
      name: '7-String Low-B Minor 7th',
      style: 'Drop 3',
      rootString: 0,
      strings: [0, null, 0, 0, 0, null, null],
      intervals: ['R', null, 'b7', 'b3', '5', null, null],
      fingers: ['1', null, '2', '3', '4', null, null]
    },
    {
      id: 'g7_dom7_low_b',
      instFamily: 'guitar_7str',
      quality: '7',
      name: '7-String Low-B Dominant 7th',
      style: 'Drop 3',
      rootString: 0,
      strings: [0, null, 0, 1, 0, null, null],
      intervals: ['R', null, 'b7', '3', '5', null, null],
      fingers: ['1', null, '2', '3', '4', null, null]
    },
    {
      id: 'g7_maj7_low_b',
      instFamily: 'guitar_7str',
      quality: 'maj7',
      name: '7-String Low-B Major 7th',
      style: 'Drop 3',
      rootString: 0,
      strings: [0, null, 1, 1, 0, null, null],
      intervals: ['R', null, '7', '3', '5', null, null],
      fingers: ['1', null, '3', '4', '2', null, null]
    },

    // =========================================================
    // GUITAR: 8-STRING MOVABLE SHAPES (F#BEADGBE / Drop E)
    // =========================================================
    {
      id: 'g8_power_r8',
      instFamily: 'guitar_8str',
      quality: '5',
      name: '8-String Sub-Bass Power Chord (Root 8)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null, null, null, null, null],
      intervals: ['R', '5', 'R', null, null, null, null, null],
      fingers: ['1', '3', '4', null, null, null, null, null]
    },
    {
      id: 'g8_animals_thump',
      instFamily: 'guitar_8str',
      quality: '5',
      name: 'Animals As Leaders Thumping Spread',
      style: 'Djent',
      rootString: 0,
      strings: [0, 2, 4, null, null, null, null, null],
      intervals: ['R', '5', '9', null, null, null, null, null],
      fingers: ['1', '2', '4', null, null, null, null, null]
    },
    {
      id: 'g8_ambient_spread_maj',
      instFamily: 'guitar_8str',
      quality: 'maj',
      name: '8-String Piano Spread Major',
      style: 'Extended',
      rootString: 0,
      strings: [0, null, null, 2, 1, 0, null, null],
      intervals: ['R', null, null, '5', '3', '5', null, null],
      fingers: ['1', null, null, '3', '2', '1', null, null]
    },
    {
      id: 'g8_ambient_spread_min',
      instFamily: 'guitar_8str',
      quality: 'min',
      name: '8-String Piano Spread Minor',
      style: 'Extended',
      rootString: 0,
      strings: [0, null, null, 2, 0, 0, null, null],
      intervals: ['R', null, null, '5', 'b3', '5', null, null],
      fingers: ['1', null, null, '3', '1', '1', null, null]
    },

    // =========================================================
    // BASS: 4-STRING MOVABLE SHAPES (Low Interval Limit Safe)
    // =========================================================
    {
      id: 'b4_tenth_maj_r4',
      instFamily: 'bass_4str',
      quality: '10th_maj',
      name: 'Movable Major 10th (Jaco Decima, Root 4)',
      style: 'Tenths',
      rootString: 0,
      strings: [0, null, null, 1],
      intervals: ['R', null, null, '10'],
      fingers: ['1', null, null, '2']
    },
    {
      id: 'b4_tenth_min_r4',
      instFamily: 'bass_4str',
      quality: '10th_min',
      name: 'Movable Minor 10th (Jaco Decima, Root 4)',
      style: 'Tenths',
      rootString: 0,
      strings: [0, null, null, 0],
      intervals: ['R', null, null, 'b10'],
      fingers: ['1', null, null, '1']
    },
    {
      id: 'b4_tenth_dom_r4',
      instFamily: 'bass_4str',
      quality: '7',
      name: 'Dominant 10th with Guide Tone b7',
      style: 'Tenths',
      rootString: 0,
      strings: [0, null, 0, 1],
      intervals: ['R', null, 'b7', '10'],
      fingers: ['1', null, '2', '3']
    },
    {
      id: 'b4_tenth_maj_r3',
      instFamily: 'bass_4str',
      quality: '10th_maj',
      name: 'Movable Major 10th (Root 3 on A String)',
      style: 'Tenths',
      rootString: 1,
      strings: [null, 0, null, 6],
      intervals: [null, 'R', null, '10'],
      fingers: [null, '1', null, '4']
    },
    {
      id: 'b4_tenth_min_r3',
      instFamily: 'bass_4str',
      quality: '10th_min',
      name: 'Movable Minor 10th (Root 3 on A String)',
      style: 'Tenths',
      rootString: 1,
      strings: [null, 0, null, 5],
      intervals: [null, 'R', null, 'b10'],
      fingers: [null, '1', null, '3']
    },
    {
      id: 'b4_shell_maj7',
      instFamily: 'bass_4str',
      quality: 'maj7',
      name: 'Jazz Shell Major 7th (Root + 7 + 3)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 1, 1],
      intervals: ['R', null, '7', '3'],
      fingers: ['1', null, '3', '4']
    },
    {
      id: 'b4_shell_min7',
      instFamily: 'bass_4str',
      quality: 'min7',
      name: 'Jazz Shell Minor 7th (Root + b7 + b3)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 0, 0],
      intervals: ['R', null, 'b7', 'b3'],
      fingers: ['1', null, '2', '3']
    },
    {
      id: 'b4_shell_dom7',
      instFamily: 'bass_4str',
      quality: '7',
      name: 'Jazz Shell Dominant 7th (Root + b7 + 3)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 0, 1],
      intervals: ['R', null, 'b7', '3'],
      fingers: ['1', null, '2', '3']
    },
    {
      id: 'b4_triad_maj_high',
      instFamily: 'bass_4str',
      quality: 'maj',
      name: 'High Register Spread Triad (D & G Strings)',
      style: 'Triads',
      rootString: 2,
      strings: [null, null, 0, -1],
      intervals: [null, null, '3', '5'],
      fingers: [null, null, '2', '1']
    },
    {
      id: 'b4_power_r4',
      instFamily: 'bass_4str',
      quality: '5',
      name: 'Bass Heavy Power Chord (R-5-8)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null],
      intervals: ['R', '5', 'R', null],
      fingers: ['1', '3', '4', null]
    },

    // =========================================================
    // BASS: 5-STRING MOVABLE SHAPES (Low B / Drop A)
    // =========================================================
    {
      id: 'b5_power_low_b',
      instFamily: 'bass_5str',
      quality: '5',
      name: '5-String Low-B Power Chord (R-5-8)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null, null],
      intervals: ['R', '5', 'R', null, null],
      fingers: ['1', '3', '4', null, null]
    },
    {
      id: 'b5_tenth_maj_low_b',
      instFamily: 'bass_5str',
      quality: '10th_maj',
      name: 'Low-B Anchor Major 10th (Root on B, 10th on D)',
      style: 'Tenths',
      rootString: 0,
      strings: [0, null, null, 1, null],
      intervals: ['R', null, null, '10', null],
      fingers: ['1', null, null, '2', null]
    },
    {
      id: 'b5_tenth_min_low_b',
      instFamily: 'bass_5str',
      quality: '10th_min',
      name: 'Low-B Anchor Minor 10th (Root on B, 10th on D)',
      style: 'Tenths',
      rootString: 0,
      strings: [0, null, null, 0, null],
      intervals: ['R', null, null, 'b10', null],
      fingers: ['1', null, null, '1', null]
    },
    {
      id: 'b5_shell_maj7',
      instFamily: 'bass_5str',
      quality: 'maj7',
      name: '5-String Low-B Shell Maj7 (R + 7 + 3)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 1, 1, null],
      intervals: ['R', null, '7', '3', null],
      fingers: ['1', null, '3', '4', null]
    },
    {
      id: 'b5_shell_min7',
      instFamily: 'bass_5str',
      quality: 'min7',
      name: '5-String Low-B Shell Min7 (R + b7 + b3)',
      style: 'Shells',
      rootString: 0,
      strings: [0, null, 0, 0, null],
      intervals: ['R', null, 'b7', 'b3', null],
      fingers: ['1', null, '2', '3', null]
    },

    // =========================================================
    // BASS: 6-STRING MOVABLE SHAPES (BEADGC / High C)
    // =========================================================
    {
      id: 'b6_power_low_b',
      instFamily: 'bass_6str',
      quality: '5',
      name: '6-String Low-B Power Chord (R-5-8)',
      style: 'Power',
      rootString: 0,
      strings: [0, 2, 2, null, null, null],
      intervals: ['R', '5', 'R', null, null, null],
      fingers: ['1', '3', '4', null, null, null]
    },
    {
      id: 'b6_high_c_maj7',
      instFamily: 'bass_6str',
      quality: 'maj7',
      name: '6-String High-C Jazz Maj7 (4-Part)',
      style: 'Jazz',
      rootString: 1,
      strings: [null, 0, 2, 1, 2, null],
      intervals: [null, 'R', '5', '7', '3', null],
      fingers: [null, '1', '3', '2', '4', null]
    },
    {
      id: 'b6_high_c_min7',
      instFamily: 'bass_6str',
      quality: 'min7',
      name: '6-String High-C Jazz Min7 (4-Part)',
      style: 'Jazz',
      rootString: 1,
      strings: [null, 0, 2, 0, 1, null],
      intervals: [null, 'R', '5', 'b7', 'b3', null],
      fingers: [null, '1', '3', '1', '2', null]
    }
  ];

  // -------------------------------------------------------------
  // 4. Movable Chord Geometry & Transposition Engine
  // -------------------------------------------------------------
  class MovableChordEngine {
    constructor() {
      this.currentTuningKey = 'guitar_6str_std';
      this.currentRootPC = 0; // 0 = C
      this.currentQuality = 'maj';
      this.badgeMode = 'interval'; // 'interval' (default) or 'finger'
    }

    getTuning(tuningKey = this.currentTuningKey) {
      return CHORD_TUNINGS[tuningKey] || CHORD_TUNINGS['guitar_6str_std'];
    }

    /**
     * Find matching shapes for the selected instrument family & chord quality
     */
    findShapes(instrumentKey, quality, styleFilter = 'all') {
      const tuning = this.getTuning(instrumentKey);
      const instFamily = tuning ? tuning.instrument : 'guitar_6str';

      return MOVABLE_SHAPES_DB.filter(shape => {
        if (shape.instFamily !== instFamily) return false;
        if (quality !== 'all') {
          // Normalize quality matches
          if (shape.quality !== quality) {
            // Also allow matching 10ths when searching for maj/min on bass
            if (quality === 'maj' && shape.quality === '10th_maj') return true;
            if (quality === 'min' && shape.quality === '10th_min') return true;
            return false;
          }
        }
        if (styleFilter !== 'all' && shape.style !== styleFilter) return false;
        return true;
      });
    }

    /**
     * Calculates the exact fret positions, note names, MIDI pitches, and intervals
     * for a given movable shape Transposed to a target root note and tuning.
     */
    computeVoicing(shape, rootPC, tuningKey = this.currentTuningKey, targetFretOverride = null) {
      const tuning = this.getTuning(tuningKey);
      if (!shape || !tuning) return null;

      const numStrings = tuning.strings.length;
      const rootStringIdx = shape.rootString;
      const openRootString = tuning.strings[rootStringIdx];

      if (!openRootString) return null;

      // 1. Calculate the base fret for the root note on rootString
      // openRootString.pc is the pitch class of the open string.
      // (rootPC - openRootString.pc) % 12 gives the fret offset (0 to 11).
      let rootFret = (rootPC - openRootString.pc + 12) % 12;

      // If shape has negative offsets, ensure we don't start below fret 1
      const minOffset = Math.min(...shape.strings.filter(s => s !== null));
      if (rootFret + minOffset < 1) {
        rootFret += 12; // Transpose up one octave so frets stay positive
      }

      // Allow manual fret override (e.g. user sliding transposition slider)
      if (targetFretOverride !== null && Number.isInteger(targetFretOverride)) {
        rootFret = targetFretOverride;
      }

      // 2. Drop Tuning Dynamic Fret Compensation
      // If tuning is a Drop tuning (e.g. Drop D, Drop A, Drop E) and rootString is 0 (the dropped string):
      // In Drop tuning, the lowest string is dropped by 2 semitones relative to standard 4ths.
      const isDropTuning = tuning.isDrop === true;

      const computedStrings = [];
      let minFret = Infinity;
      let maxFret = -Infinity;

      for (let s = 0; s < numStrings; s++) {
        const shapeOffset = (s < shape.strings.length) ? shape.strings[s] : null;
        const intervalName = (s < shape.intervals.length) ? shape.intervals[s] : null;
        const finger = (s < shape.fingers.length) ? shape.fingers[s] : null;
        const stringDef = tuning.strings[s];

        if (shapeOffset === null) {
          computedStrings.push({
            stringIndex: s,
            stringLabel: stringDef.label,
            openNote: stringDef.note,
            fret: null, // Muted
            midi: null,
            noteName: null,
            pc: null,
            interval: null,
            finger: null,
            isMuted: true,
            isOpen: false,
            isRoot: false
          });
        } else {
          let calculatedFret = rootFret + shapeOffset;

          // Drop tuning dynamic compensation: when string 0 is dropped by 2 semitones
          if (isDropTuning && shape.rootString === 0 && s > 0) {
            if (shape.style === 'Power' && shapeOffset === 2) {
              // Flattens 0-2-2 power chord into 0-0-0 1-finger barre
              calculatedFret = rootFret;
            } else {
              // Offsets remaining strings so intervals align with the dropped low root
              calculatedFret = rootFret + shapeOffset - 2;
            }
          }

          // Bound checking
          if (calculatedFret < 0) calculatedFret += 12;

          const openMidi = stringDef.midi;
          const noteMidi = openMidi + calculatedFret;
          const notePC = (stringDef.pc + calculatedFret) % 12;
          const isRoot = (s === rootStringIdx && (shapeOffset === 0 || shapeOffset === 2));

          const Theory = window.SongTheory;
          const noteName = Theory ? Theory.pitchClassToNote(notePC) : 'C';

          if (calculatedFret > 0) {
            if (calculatedFret < minFret) minFret = calculatedFret;
            if (calculatedFret > maxFret) maxFret = calculatedFret;
          }

          computedStrings.push({
            stringIndex: s,
            stringLabel: stringDef.label,
            openNote: stringDef.note,
            fret: calculatedFret,
            midi: noteMidi,
            noteName: noteName,
            pc: notePC,
            interval: intervalName || (isRoot ? 'R' : ''),
            finger: finger || '1',
            isMuted: false,
            isOpen: calculatedFret === 0,
            isRoot: isRoot
          });
        }
      }

      if (minFret === Infinity) minFret = 1;
      if (maxFret === -Infinity) maxFret = 4;

      return {
        shapeId: shape.id,
        shapeName: shape.name,
        style: shape.style,
        instrument: tuning.instrument,
        tuningName: tuning.name,
        clef: tuning.clef,
        rootPC: rootPC,
        rootFret: rootFret,
        minFret: minFret,
        maxFret: maxFret,
        strings: computedStrings,
        barre: shape.barre ? {
          ...shape.barre,
          actualFret: rootFret + shape.barre.fretOffset
        } : null
      };
    }
  }

  // -------------------------------------------------------------
  // 5. Renderer 1: Vector SVG Chord Box
  // -------------------------------------------------------------
  class SvgChordRenderer {
    static render(voicing, options = {}) {
      if (!voicing || !voicing.strings) return '<svg></svg>';

      const badgeMode = options.badgeMode || 'interval'; // 'interval' or 'finger'
      const numStrings = voicing.strings.length;

      // Layout geometry
      const stringSpacing = 28;
      const fretSpacing = 34;
      const marginX = 42;
      const marginTop = 50;
      const marginBottom = 28;

      const gridWidth = (numStrings - 1) * stringSpacing;
      const numFretsToShow = Math.max(4, (voicing.maxFret - voicing.minFret + 1));
      const gridHeight = numFretsToShow * fretSpacing;

      const totalWidth = gridWidth + marginX * 2 + 10;
      const totalHeight = gridHeight + marginTop + marginBottom;

      const baseFret = Math.max(1, voicing.minFret);
      const isNut = baseFret === 1;

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" height="auto" class="svg-chord-diagram">`;

      // Background card
      svg += `<rect width="${totalWidth}" height="${totalHeight}" rx="10" fill="#0f172a" />`;

      // Starting fret label (e.g. "fr. 5")
      if (!isNut) {
        svg += `<text x="${marginX - 14}" y="${marginTop + fretSpacing * 0.65}" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="end" font-family="system-ui, sans-serif">fr.${baseFret}</text>`;
      }

      // Top Nut line or normal fret line
      const nutThickness = isNut ? 5 : 1.5;
      const nutColor = isNut ? '#e2e8f0' : '#475569';
      svg += `<line x1="${marginX}" y1="${marginTop}" x2="${marginX + gridWidth}" y2="${marginTop}" stroke="${nutColor}" stroke-width="${nutThickness}" stroke-linecap="round" />`;

      // Horizontal Fret Wires
      for (let f = 1; f <= numFretsToShow; f++) {
        const y = marginTop + f * fretSpacing;
        svg += `<line x1="${marginX}" y1="${y}" x2="${marginX + gridWidth}" y2="${y}" stroke="#475569}" stroke-width="1.5" />`;
      }

      // Vertical String Lines
      for (let s = 0; s < numStrings; s++) {
        const x = marginX + s * stringSpacing;
        svg += `<line x1="${x}" y1="${marginTop}" x2="${x}" y2="${marginTop + gridHeight}" stroke="#64748b" stroke-width="${1.2 + (numStrings - s) * 0.2}" />`;
      }

      // Barre Line / Capsule
      if (voicing.barre) {
        const barreFret = voicing.barre.actualFret;
        const relativeFret = barreFret - baseFret;
        if (relativeFret >= 0 && relativeFret < numFretsToShow) {
          const fromX = marginX + voicing.barre.fromString * stringSpacing;
          const toX = marginX + voicing.barre.toString * stringSpacing;
          const y = marginTop + relativeFret * fretSpacing + fretSpacing / 2;
          const width = Math.abs(toX - fromX) + 20;
          const startX = Math.min(fromX, toX) - 10;
          svg += `<rect x="${startX}" y="${y - 9}" width="${width}" height="18" rx="9" fill="#2563eb" opacity="0.85" />`;
          svg += `<text x="${startX + width / 2}" y="${y + 4}" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Barre ${voicing.barre.finger || '1'}</text>`;
        }
      }

      // String Markers (Mute ✕, Open ○) & Notehead Dots
      voicing.strings.forEach((strObj, s) => {
        const x = marginX + s * stringSpacing;

        // Top Nut Markers (Muted / Open)
        if (strObj.isMuted) {
          svg += `<text x="${x}" y="${marginTop - 14}" fill="#ef4444" font-size="14" font-weight="900" text-anchor="middle" font-family="system-ui, sans-serif">✕</text>`;
        } else if (strObj.isOpen) {
          svg += `<circle cx="${x}" cy="${marginTop - 18}" r="5.5" stroke="#38bdf8" stroke-width="2" fill="none" />`;
        } else if (strObj.fret !== null) {
          // Fret Dot
          const relFret = strObj.fret - baseFret;
          if (relFret >= 0 && relFret < numFretsToShow) {
            const y = marginTop + relFret * fretSpacing + fretSpacing / 2;
            const ivColor = INTERVAL_COLORS[strObj.interval] || { fill: '#3b82f6', text: '#ffffff' };
            const dotFill = strObj.isRoot ? '#ef4444' : ivColor.fill;
            const textFill = strObj.isRoot ? '#ffffff' : ivColor.text;

            // Dot shadow & circle
            svg += `<circle cx="${x}" cy="${y}" r="11" fill="${dotFill}" stroke="#0f172a" stroke-width="2" />`;

            // Badge text (Interval or Finger)
            const badgeText = (badgeMode === 'finger') ? (strObj.finger || '1') : (strObj.interval || 'R');
            const fontSize = badgeText.length > 2 ? 8 : 10;
            svg += `<text x="${x}" y="${y + 3.5}" fill="${textFill}" font-size="${fontSize}" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">${badgeText}</text>`;
          }
        }

        // Bottom String Label (e.g. E, A, D, G)
        svg += `<text x="${x}" y="${marginTop + gridHeight + 18}" fill="#94a3b8" font-size="11" font-weight="bold" text-anchor="middle" font-family="monospace">${strObj.stringLabel}</text>`;
      });

      svg += `</svg>`;
      return svg;
    }
  }

  // -------------------------------------------------------------
  // 6. Renderer 2: Formatted TAB Notation
  // -------------------------------------------------------------
  class TabNotationRenderer {
    /**
     * Generates plain-text ASCII tablature for clean copy-to-clipboard
     */
    static generateAscii(voicing) {
      if (!voicing || !voicing.strings) return '';
      // Reverse strings so highest string is at the top (standard guitar/bass tab convention)
      const reversed = [...voicing.strings].reverse();
      const lines = reversed.map(s => {
        const fretVal = s.isMuted ? 'x' : (s.fret !== null ? String(s.fret) : '-');
        const paddedFret = fretVal.length === 1 ? `-${fretVal}-` : `-${fretVal}`;
        const tag = s.isMuted ? '[Muted]' : `[${s.interval || 'R'} • ${s.noteName}]`;
        const strLabel = (s.stringLabel || '').padEnd(2, ' ');
        return `${strLabel} |---${paddedFret}--- ${tag}`;
      });

      return lines.join('\n');
    }

    /**
     * Generates formatted HTML tablature with syntax highlighting
     */
    static generateHtml(voicing) {
      if (!voicing || !voicing.strings) return '';
      const reversed = [...voicing.strings].reverse();
      let html = '<div class="tab-notation-box">';
      reversed.forEach(s => {
        const isMuted = s.isMuted;
        const fretVal = isMuted ? 'x' : (s.fret !== null ? s.fret : '-');
        const ivColor = INTERVAL_COLORS[s.interval] || { fill: '#3b82f6', text: '#ffffff' };
        const badgeColor = s.isRoot ? '#ef4444' : ivColor.fill;

        html += `
          <div class="tab-string-row">
            <span class="tab-string-name">${s.stringLabel}</span>
            <span class="tab-string-wire"></span>
            <span class="tab-fret-pill ${isMuted ? 'pill-muted' : (s.isRoot ? 'pill-root' : 'pill-active')}" style="${!isMuted ? `background: ${badgeColor};` : ''}">
              ${fretVal}
            </span>
            <span class="tab-string-wire"></span>
            <span class="tab-interval-tag ${isMuted ? 'tag-muted' : ''}">
              ${isMuted ? 'Muted' : `${s.interval || 'R'} (${s.noteName})`}
            </span>
          </div>
        `;
      });
      html += '</div>';
      return html;
    }
  }

  // -------------------------------------------------------------
  // 7. Renderer 3: Procedural Musical Staff (Canvas Sheet Music)
  // -------------------------------------------------------------
  class StaffNotationRenderer {
    static renderToCanvas(canvas, voicing) {
      if (!canvas || !voicing || !voicing.strings) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 360;
      const height = canvas.clientHeight || 200;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      // Background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Staff dimensions
      const staffTop = Math.floor(height * 0.42);
      const lineSpacing = 11;
      const staffLeft = 24;
      const staffRight = width - 24;

      // Draw 5 Staff Lines
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const y = staffTop + i * lineSpacing;
        ctx.beginPath();
        ctx.moveTo(staffLeft, y);
        ctx.lineTo(staffRight, y);
        ctx.stroke();
      }

      // Clef Drawing (Treble G8 for Guitar, Bass F8 for Bass)
      const isBass = voicing.clef === 'bass';
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 36px serif';
      ctx.textBaseline = 'middle';
      if (isBass) {
        ctx.fillText('𝄢', staffLeft + 8, staffTop + lineSpacing * 1.5);
      } else {
        ctx.fillText('𝄞', staffLeft + 8, staffTop + lineSpacing * 2.6);
      }

      // Collect unmuted sounding notes with MIDI pitch
      const soundingNotes = voicing.strings
        .filter(s => !s.isMuted && s.midi !== null)
        .sort((a, b) => a.midi - b.midi);

      if (soundingNotes.length === 0) return;

      // Notehead positioning math
      // Treble Clef: Bottom line (line 4) is E4 (MIDI 64). In standard guitar notation,
      // guitar sounds 1 octave lower than written, so written pitch = sounding + 12.
      // Bass Clef: Bottom line (line 4) is G2 (MIDI 43). Written pitch = sounding + 12.
      const chordX = staffLeft + 120;

      // Diatonic step reference
      // In Treble: Line 4 = E4 (step 0).
      // Pitch steps in diatonic: C=0, D=1, E=2, F=3, G=4, A=5, B=6
      const DIATONIC_STEP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

      soundingNotes.forEach((n, idx) => {
        // Written MIDI pitch (transposed up 1 octave for notation convention)
        const writtenMidi = n.midi + 12;
        const semitonesFromBase = isBass ? (writtenMidi - 43) : (writtenMidi - 64);
        const octDiff = Math.floor((writtenMidi - (isBass ? 43 : 64)) / 12);
        const pcDiff = (n.pc - (isBass ? 7 : 4) + 12) % 12;
        const diatonicOffset = octDiff * 7 + DIATONIC_STEP[pcDiff];

        // Each diatonic step is half of lineSpacing
        const noteY = (staffTop + 4 * lineSpacing) - (diatonicOffset * (lineSpacing / 2));

        // Ledger Lines
        if (noteY > staffTop + 4 * lineSpacing) {
          // Below staff ledger lines
          for (let ly = staffTop + 5 * lineSpacing; ly <= noteY + 2; ly += lineSpacing) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(chordX - 14, ly);
            ctx.lineTo(chordX + 14, ly);
            ctx.stroke();
          }
        } else if (noteY < staffTop) {
          // Above staff ledger lines
          for (let ly = staffTop - lineSpacing; ly >= noteY - 2; ly -= lineSpacing) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(chordX - 14, ly);
            ctx.lineTo(chordX + 14, ly);
            ctx.stroke();
          }
        }

        // Color by interval
        const ivColor = INTERVAL_COLORS[n.interval] || { fill: '#38bdf8' };
        const dotFill = n.isRoot ? '#ef4444' : ivColor.fill;

        // Draw Notehead (slightly slanted oval)
        ctx.save();
        ctx.translate(chordX, noteY);
        ctx.rotate(-0.25);
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.5, 5.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = dotFill;
        ctx.fill();
        ctx.restore();

        // Accidental symbol if note name contains # or b
        if (n.noteName && (n.noteName.includes('#') || n.noteName.includes('b'))) {
          const acc = n.noteName.includes('#') ? '♯' : '♭';
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(acc, chordX - 12, noteY);
        }
      });

      // Stem connecting the chord notes
      if (soundingNotes.length > 0) {
        const lowestY = (staffTop + 4 * lineSpacing) - (DIATONIC_STEP[(soundingNotes[0].pc - (isBass ? 7 : 4) + 12) % 12] + Math.floor((soundingNotes[0].midi + 12 - (isBass ? 43 : 64)) / 12) * 7) * (lineSpacing / 2);
        const highestY = (staffTop + 4 * lineSpacing) - (DIATONIC_STEP[(soundingNotes[soundingNotes.length - 1].pc - (isBass ? 7 : 4) + 12) % 12] + Math.floor((soundingNotes[soundingNotes.length - 1].midi + 12 - (isBass ? 43 : 64)) / 12) * 7) * (lineSpacing / 2);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(chordX + 7, lowestY);
        ctx.lineTo(chordX + 7, highestY - 26);
        ctx.stroke();
      }
    }
  }

  // -------------------------------------------------------------
  // 8. Global Exports
  // -------------------------------------------------------------
  window.SongChords = {
    TUNINGS: CHORD_TUNINGS,
    MOVABLE_SHAPES: MOVABLE_SHAPES_DB,
    INTERVAL_COLORS: INTERVAL_COLORS,
    Engine: new MovableChordEngine(),
    SvgRenderer: SvgChordRenderer,
    TabRenderer: TabNotationRenderer,
    StaffRenderer: StaffNotationRenderer
  };

})(window);
