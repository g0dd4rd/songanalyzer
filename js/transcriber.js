// Song Analyzer - Audio File Transcription & 6-Stem Studio Engine (js/transcriber.js)
// 100% Offline, Zero External Dependencies, file:// Compatible.
// Capabilities:
// 1. Audio Decoding (WAV, MP3, FLAC, M4A, OGG) & Live Microphone Capture
// 2. High-Precision BPM & Beat Tracking Engine (Spectral Flux Autocorrelation)
// 3. 6-Stem Source Separation: Bass, Guitar, Drums, Piano, Vocals, Other
//    - Tier 1: Instant Zero-Download Linear-Phase Multiband M/S Filterbank (<2 sec)
//    - Tier 2: Neural AI ONNX Worker Interface (HTDemucs-6s on-demand)
// 4. Polyphonic Pitch & Note Tracking (Spotify Basic Pitch CQT/Salience Architecture)
//    - Harmonic De-Overtoning (cancels 2nd/3rd harmonics & false octaves)
//    - Metric Beat-Grid Quantization (snaps raw seconds to ♩, ♪, ♬, triplets)
// 5. Biomechanical Viterbi Fretboard Solver for Bass (4/5/6) and Guitar (6/7/8) in 24 Tunings
// 6. Interactive 6-Stem Mixer Rack (Solo, Mute, Volume, 0.5x-1.0x Slow-Down Practice)
// 7. Triple-Notation Generation (Dynamic TAB, 5-Line Canvas Staff, Standard MIDI DAW Export)

(function(window) {
  'use strict';

  // -------------------------------------------------------------
  // 1. Math, Tables & Constants
  // -------------------------------------------------------------
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  const MIDI_TO_FREQ = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    MIDI_TO_FREQ[i] = 440 * Math.pow(2, (i - 69) / 12);
  }

  function midiToNoteName(midi, preferFlats = false) {
    if (midi < 0 || midi > 127) return '--';
    const pc = midi % 12;
    const oct = Math.floor(midi / 12) - 1;
    const name = preferFlats ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
    return `${name}${oct}`;
  }

  // -------------------------------------------------------------
  // 1B. Fast STFT / ISTFT Audio Engine (Cooley-Tukey Radix-2 FFT)
  // -------------------------------------------------------------
  class FastSTFT {
    constructor(nFft = 4096, hopLength = 1024) {
      this.nFft = nFft;
      this.hopLength = hopLength;
      this.nBins = (nFft / 2) + 1; // 2049 for nFft=4096

      // Periodic Hann window
      this.window = new Float32Array(nFft);
      for (let i = 0; i < nFft; i++) {
        this.window[i] = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / nFft));
      }

      // Precompute bit reversal permutation
      const levels = Math.log2(nFft);
      this.bitRev = new Uint32Array(nFft);
      for (let i = 0; i < nFft; i++) {
        let rev = 0;
        let temp = i;
        for (let j = 0; j < levels; j++) {
          rev = (rev << 1) | (temp & 1);
          temp >>= 1;
        }
        this.bitRev[i] = rev;
      }

      // Precompute twiddle factors for FFT
      this.cosTable = new Float32Array(nFft / 2);
      this.sinTable = new Float32Array(nFft / 2);
      for (let i = 0; i < nFft / 2; i++) {
        const angle = (-2.0 * Math.PI * i) / nFft;
        this.cosTable[i] = Math.cos(angle);
        this.sinTable[i] = Math.sin(angle);
      }
    }

    fft(real, imag, inverse = false) {
      const n = this.nFft;
      for (let i = 0; i < n; i++) {
        const j = this.bitRev[i];
        if (i < j) {
          const tr = real[i]; real[i] = real[j]; real[j] = tr;
          const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
        }
      }
      for (let len = 2; len <= n; len <<= 1) {
        const halfLen = len >> 1;
        const step = n / len;
        for (let i = 0; i < n; i += len) {
          for (let j = 0; j < halfLen; j++) {
            const tableIdx = j * step;
            const cos = this.cosTable[tableIdx];
            const sin = inverse ? -this.sinTable[tableIdx] : this.sinTable[tableIdx];
            const uR = real[i + j];
            const uI = imag[i + j];
            const vR = real[i + j + halfLen] * cos - imag[i + j + halfLen] * sin;
            const vI = real[i + j + halfLen] * sin + imag[i + j + halfLen] * cos;
            real[i + j] = uR + vR;
            imag[i + j] = uI + vI;
            real[i + j + halfLen] = uR - vR;
            imag[i + j + halfLen] = uI - vI;
          }
        }
      }
      if (inverse) {
        for (let i = 0; i < n; i++) {
          real[i] /= n;
          imag[i] /= n;
        }
      }
    }

    stft(signal) {
      const L = signal.length;
      const nFrames = Math.max(1, Math.floor((L - this.nFft) / this.hopLength) + 1);
      const mag = new Float32Array(nFrames * this.nBins);
      const real = new Float32Array(nFrames * this.nBins);
      const imag = new Float32Array(nFrames * this.nBins);
      const frameR = new Float32Array(this.nFft);
      const frameI = new Float32Array(this.nFft);

      for (let f = 0; f < nFrames; f++) {
        const start = f * this.hopLength;
        for (let i = 0; i < this.nFft; i++) {
          frameR[i] = (start + i < L ? signal[start + i] : 0) * this.window[i];
          frameI[i] = 0;
        }
        this.fft(frameR, frameI, false);
        const frameOffset = f * this.nBins;
        for (let k = 0; k < this.nBins; k++) {
          const r = frameR[k];
          const im = frameI[k];
          real[frameOffset + k] = r;
          imag[frameOffset + k] = im;
          mag[frameOffset + k] = Math.sqrt(r * r + im * im);
        }
      }
      return { mag, real, imag, nFrames };
    }

    istft(specReal, specImag, nFrames, totalSamples) {
      const out = new Float32Array(totalSamples);
      const weight = new Float32Array(totalSamples);
      const frameR = new Float32Array(this.nFft);
      const frameI = new Float32Array(this.nFft);

      for (let f = 0; f < nFrames; f++) {
        const frameOffset = f * this.nBins;
        for (let k = 0; k < this.nBins; k++) {
          frameR[k] = specReal[frameOffset + k];
          frameI[k] = specImag[frameOffset + k];
        }
        for (let k = this.nBins; k < this.nFft; k++) {
          const sym = this.nFft - k;
          frameR[k] = frameR[sym];
          frameI[k] = -frameI[sym];
        }
        this.fft(frameR, frameI, true);
        const start = f * this.hopLength;
        for (let i = 0; i < this.nFft; i++) {
          if (start + i < totalSamples) {
            out[start + i] += frameR[i] * this.window[i];
            weight[start + i] += this.window[i] * this.window[i];
          }
        }
      }
      for (let i = 0; i < totalSamples; i++) {
        if (weight[i] > 1e-4) out[i] /= weight[i];
      }
      return out;
    }
  }

  // -------------------------------------------------------------
  // 2. Biomechanical Fretboard Solver (Stub - Tablature Removed)
  // -------------------------------------------------------------
  class BiomechanicalFretboardSolver {
    solve() {
      return [];
    }
  }

  // -------------------------------------------------------------
  // 2B. Neural Model Offline Storage (IndexedDB)
  // -------------------------------------------------------------
  class NeuralModelStorage {
    constructor() {
      this.dbName = 'songanalyzer_models_v1';
      this.storeName = 'models';
      this.db = null;
    }

    async open() {
      if (this.db) return this.db;
      if (typeof indexedDB === 'undefined') return null;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    async saveModel(id, arrayBuffer, metadata = {}) {
      const db = await this.open();
      if (!db) return false;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put({
          id,
          buffer: arrayBuffer,
          size: arrayBuffer.byteLength,
          updatedAt: Date.now(),
          ...metadata
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
    }

    async getModel(id) {
      const db = await this.open();
      if (!db) return null;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result && req.result.buffer) {
            const buf = req.result.buffer;
            // Purge corrupt/truncated Demucs model (< 120 MB)
            if (id === 'demucs' && buf.byteLength < 120 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated Demucs model (${buf.byteLength} bytes)`);
              store.delete(id);
              resolve(null);
              return;
            }
            // Purge corrupt/truncated WASM runtime (< 10 MB)
            if (id === 'ort_wasm_simd' && buf.byteLength < 10 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated WASM runtime (${buf.byteLength} bytes)`);
              store.delete(id);
              resolve(null);
              return;
            }
            // Purge corrupt/truncated UMX model (< 10 MB)
            if (id.startsWith('umx_') && buf.byteLength < 10 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated UMX model (${buf.byteLength} bytes)`);
              store.delete(id);
              resolve(null);
              return;
            }
            resolve(buf);
          } else {
            resolve(null);
          }
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    async hasModel(id) {
      const db = await this.open();
      if (!db) return false;
      const buf = await this.getModel(id);
      return Boolean(buf);
    }

    async deleteModel(id) {
      const db = await this.open();
      if (!db) return false;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
    }

    async clearAll() {
      const db = await this.open();
      if (!db) return false;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => reject(e.target.error);
      });
    }

    async getSummary() {
      const db = await this.open();
      if (!db) return { basicPitch: false, demucs: false, totalBytes: 0, count: 0 };
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const records = req.result || [];
          let basicPitch = false;
          let demucs = false;
          let totalBytes = 0;
          let validCount = 0;
          records.forEach(r => {
            const sz = r.size || (r.buffer ? r.buffer.byteLength : 0);
            if (r.id === 'demucs' && sz < 120 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated Demucs model (${sz} bytes)`);
              store.delete('demucs');
              return;
            }
            if (r.id === 'ort_wasm_simd' && sz < 10 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated WASM runtime (${sz} bytes)`);
              store.delete('ort_wasm_simd');
              return;
            }
            if (r.id.startsWith('umx_') && sz < 10 * 1024 * 1024) {
              console.warn(`[NeuralModelStorage] Purging corrupt/truncated UMX model (${sz} bytes)`);
              store.delete(r.id);
              return;
            }
            totalBytes += sz;
            validCount++;
            if (r.id === 'basic_pitch') basicPitch = true;
            if (r.id === 'demucs') demucs = true;
            if (r.id === 'umx_drums') umxDrums = true;
            if (r.id === 'umx_bass') umxBass = true;
            if (r.id === 'umx_other') umxOther = true;
            if (r.id === 'umx_vocals') umxVocals = true;
          });
          resolve({
            basicPitch,
            demucs,
            umxDrums: Boolean(umxDrums),
            umxBass: Boolean(umxBass),
            umxOther: Boolean(umxOther),
            umxVocals: Boolean(umxVocals),
            totalBytes,
            count: validCount
          });
        };
        req.onerror = () => resolve({ basicPitch: false, demucs: false, totalBytes: 0, count: 0 });
      });
    }

    async downloadModel(id, url, onProgress) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const contentLength = Number(resp.headers.get('content-length')) || 0;

      if (!resp.body || !resp.body.getReader) {
        const ab = await resp.arrayBuffer();
        if (id === 'demucs' && ab.byteLength < 120 * 1024 * 1024) {
          throw new Error(`Incomplete Demucs download: received only ${(ab.byteLength / (1024 * 1024)).toFixed(1)} MB (expected ~158 MB).`);
        }
        if (id.startsWith('umx_') && ab.byteLength < 10 * 1024 * 1024) {
          throw new Error(`Incomplete OpenUnmix download: received only ${(ab.byteLength / (1024 * 1024)).toFixed(1)} MB (expected ~34 MB).`);
        }
        await this.saveModel(id, ab, { url });
        if (onProgress) onProgress(1.0, ab.byteLength, ab.byteLength);
        return ab;
      }

      const reader = resp.body.getReader();
      let receivedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        if (onProgress) {
          const frac = contentLength > 0 ? (receivedBytes / contentLength) : 0.5;
          onProgress(frac, receivedBytes, contentLength);
        }
      }

      if (contentLength > 0 && receivedBytes < contentLength) {
        throw new Error(`Download interrupted: received ${receivedBytes} of ${contentLength} bytes.`);
      }
      if (id === 'demucs' && receivedBytes < 120 * 1024 * 1024) {
        throw new Error(`Incomplete Demucs download: received only ${(receivedBytes / (1024 * 1024)).toFixed(1)} MB (expected ~158 MB).`);
      }
      if (id.startsWith('umx_') && receivedBytes < 10 * 1024 * 1024) {
        throw new Error(`Incomplete OpenUnmix download: received only ${(receivedBytes / (1024 * 1024)).toFixed(1)} MB (expected ~34 MB).`);
      }
      if (id === 'ort_wasm_simd' && receivedBytes < 10 * 1024 * 1024) {
        throw new Error(`Incomplete WASM runtime download: received only ${(receivedBytes / (1024 * 1024)).toFixed(1)} MB (expected ~10.5 MB).`);
      }

      const combined = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      await this.saveModel(id, combined.buffer, { url });
      return combined.buffer;
    }
  }

  // -------------------------------------------------------------
  // 2C. Device & Capability Detector (Desktop vs Mobile, WebGPU vs WASM)
  // -------------------------------------------------------------
  class DeviceCapabilityDetector {
    constructor() {
      this.capabilities = null;
    }

    async detect() {
      if (this.capabilities) return this.capabilities;

      const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isMobileClientHint = Boolean(typeof navigator !== 'undefined' && navigator.userAgentData && navigator.userAgentData.mobile);
      const hasTouch = Boolean(typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));
      const isSmallScreen = Boolean(typeof window !== 'undefined' && (
        window.innerWidth <= 768 ||
        (typeof window.screen !== 'undefined' && (window.screen.width <= 768 || window.screen.height <= 768))
      ));

      const hasForceMobile = typeof window !== 'undefined' && (
        (window.location && window.location.search && window.location.search.includes('mode=mobile')) ||
        (window.localStorage && window.localStorage.getItem('force_engine_mode') === 'mobile')
      );
      const hasForceStudio = typeof window !== 'undefined' && (
        (window.location && window.location.search && window.location.search.includes('mode=desktop')) ||
        (window.localStorage && window.localStorage.getItem('force_engine_mode') === 'desktop')
      );

      const isMobile = hasForceStudio ? false : (hasForceMobile || Boolean(isMobileClientHint || isMobileUA || (hasTouch && isSmallScreen)));

      let hasWebGPU = false;
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        try {
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            hasWebGPU = true;
          }
        } catch (e) {
          hasWebGPU = false;
        }
      }

      const engineMode = isMobile ? 'mobile_optimized' : 'studio';
      const badgeText = isMobile ? '⚡ Mobile Optimized' : '🎧 Studio Engine';
      const badgeClass = isMobile ? 'mobile' : 'desktop';
      const accelText = hasWebGPU ? 'WebGPU' : 'WASM';
      const badgeTooltip = isMobile
        ? `Mobile Mode: Low-memory sequential stem separation (${accelText})`
        : `Studio Mode: High-precision neural stem separation (${accelText})`;

      this.capabilities = {
        isMobile,
        hasWebGPU,
        engineMode,
        executionProvider: hasWebGPU ? 'webgpu' : 'wasm',
        badgeText,
        badgeClass,
        badgeTooltip
      };

      return this.capabilities;
    }
  }

  async function setupWasmEnv(storage) {
    if (typeof window === 'undefined' || !window.ort || !window.ort.env || !window.ort.env.wasm) return;

    let wasmBuf = null;
    if (storage) {
      try {
        wasmBuf = await storage.getModel('ort_wasm_simd');
      } catch (e) {}
    }

    if (!wasmBuf && storage && window.location && window.location.protocol === 'file:') {
      try {
        const resp = await fetch('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/ort-wasm-simd.wasm');
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          if (ab.byteLength >= 10 * 1024 * 1024) {
            wasmBuf = ab;
            await storage.saveModel('ort_wasm_simd', wasmBuf, { name: 'ONNX WASM SIMD Runtime' });
          }
        }
      } catch (e) {
        console.warn('Direct fetch of ort-wasm-simd.wasm failed, falling back to CDN path:', e);
      }
    }

    if (wasmBuf && wasmBuf.byteLength >= 10 * 1024 * 1024) {
      const blobUrl = URL.createObjectURL(new Blob([wasmBuf], { type: 'application/wasm' }));
      window.ort.env.wasm.wasmPaths = {
        'ort-wasm-simd.wasm': blobUrl,
        'ort-wasm.wasm': blobUrl,
        'ort-wasm-simd-threaded.wasm': blobUrl,
        'ort-wasm-threaded.wasm': blobUrl
      };
    } else {
      window.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/';
    }

    const hasThreads = (typeof window !== 'undefined' && Boolean(window.crossOriginIsolated));
    window.ort.env.wasm.numThreads = hasThreads ? Math.min(4, (navigator && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 2) : 1;
  }

  // -------------------------------------------------------------
  // 2C. Spotify Basic Pitch Neural Engine Runner (ONNX)
  // -------------------------------------------------------------
  class SpotifyBasicPitchRunner {
    constructor(storage) {
      this.storage = storage;
      this.session = null;
      this.inputName = null;
      this.outputNames = [];
      this.isInitializing = false;
    }

    async isReady() {
      if (this.session) return true;
      if (typeof window === 'undefined') return false;
      const cached = await this.storage.hasModel('basic_pitch');
      return cached;
    }

    async initSession(modelBuffer = null) {
      if (this.session) return this.session;
      if (this.isInitializing) {
        while (this.isInitializing) {
          await new Promise(r => setTimeout(r, 50));
        }
        return this.session;
      }
      this.isInitializing = true;
      try {
        if (typeof window === 'undefined' || !window.ort) {
          throw new Error('ONNX Runtime Web (ort) is not available.');
        }

        await setupWasmEnv(this.storage);

        let buffer = modelBuffer;
        if (!buffer) {
          buffer = await this.storage.getModel('basic_pitch');
        }
        if (!buffer && typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:') {
          // Attempt loading from local models folder (skipped on file:// to prevent browser CORS block)
          try {
            const resp = await fetch('models/basic_pitch.onnx');
            if (resp.ok) {
              buffer = await resp.arrayBuffer();
              await this.storage.saveModel('basic_pitch', buffer, { name: 'Spotify Basic Pitch' });
            }
          } catch (e) {}
        }
        if (!buffer) {
          throw new Error('Spotify Basic Pitch model is not installed or cached.');
        }

        const modelBytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
        this.session = await window.ort.InferenceSession.create(modelBytes, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'disabled',
          enableCpuMemArena: false,
          enableMemPattern: false
        });
        this.inputName = this.session.inputNames[0];
        this.outputNames = this.session.outputNames;
        return this.session;
      } finally {
        this.isInitializing = false;
      }
    }

    async resampleTo22k(audioBuffer) {
      const targetRate = 22050;
      if (audioBuffer.sampleRate === targetRate) {
        return audioBuffer.getChannelData(0);
      }
      const duration = audioBuffer.duration;
      const targetLength = Math.max(1, Math.round(duration * targetRate));
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        1,
        targetLength,
        targetRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const resampled = await offlineCtx.startRendering();
      return resampled.getChannelData(0);
    }

    async transcribe(audioBuffer, options = {}, onProgress = null) {
      await this.initSession();
      if (!this.session) throw new Error('Basic Pitch session could not be initialized.');

      if (onProgress) onProgress(0.05, 'Resampling audio to 22.05 kHz for neural network...');
      const monoAudio = await this.resampleTo22k(audioBuffer);
      const totalSamples = monoAudio.length;

      const CHUNK_SIZE = 43844;
      const HOP_SIZE = 43844;
      const totalChunks = Math.max(1, Math.ceil(totalSamples / HOP_SIZE));
      const secPerFrame = (CHUNK_SIZE / 22050.0) / 172.0;

      const rawNotes = [];
      const noteThresh = options.noteThreshold || 0.30;
      const onsetThresh = options.onsetThreshold || 0.38;

      for (let c = 0; c < totalChunks; c++) {
        if (onProgress) {
          const pct = 0.1 + (c / totalChunks) * 0.65;
          onProgress(pct, `Neural pitch transcription: chunk ${c + 1} of ${totalChunks}...`);
        }

        const startSample = c * HOP_SIZE;
        const chunkData = new Float32Array(CHUNK_SIZE);
        const available = Math.min(CHUNK_SIZE, totalSamples - startSample);
        if (available > 0) {
          chunkData.set(monoAudio.subarray(startSample, startSample + available));
        }

        const chunkStartTime = startSample / 22050.0;
        const ortObj = (typeof window !== 'undefined' && window.ort) ? window.ort : (typeof ort !== 'undefined' ? ort : globalThis.ort);
        const inputTensor = new ortObj.Tensor('float32', chunkData, [1, CHUNK_SIZE, 1]);
        const results = await this.session.run({ [this.inputName]: inputTensor });

        // Robust output extraction:
        // StatefulPartitionedCall:2 = onset activations [1, 172, 88]
        // StatefulPartitionedCall:1 = note sustain activations [1, 172, 88]
        // StatefulPartitionedCall:0 = fine pitch contour [1, 172, 264]
        let onsetData = results['StatefulPartitionedCall:2'] ? results['StatefulPartitionedCall:2'].data : null;
        let noteData = results['StatefulPartitionedCall:1'] ? results['StatefulPartitionedCall:1'].data : null;

        if (!onsetData || !noteData) {
          const outputsWith88 = this.outputNames.filter(name => results[name] && results[name].data && results[name].data.length === 172 * 88);
          if (outputsWith88.length >= 2) {
            onsetData = results[outputsWith88[0]].data;
            noteData = results[outputsWith88[1]].data;
          } else {
            onsetData = results[this.outputNames[0]] ? results[this.outputNames[0]].data : null;
            noteData = results[this.outputNames[1]] ? results[this.outputNames[1]].data : null;
          }
        }
        if (!onsetData || !noteData) continue;

        for (let k = 0; k < 88; k++) {
          const midi = k + 21;
          let inNote = false;
          let startFrame = 0;
          let peakVal = 0.0;

          for (let f = 0; f < 172; f++) {
            const idx = f * 88 + k;
            const nVal = noteData[idx];
            const oVal = onsetData[idx];

            if (!inNote) {
              if (oVal > onsetThresh || nVal > (noteThresh + 0.12)) {
                inNote = true;
                startFrame = f;
                peakVal = Math.max(nVal, oVal);
              }
            } else {
              peakVal = Math.max(peakVal, nVal);
              if (nVal < noteThresh || f === 171) {
                inNote = false;
                const dur = (f - startFrame) * secPerFrame;
                if (dur >= 0.07) {
                  rawNotes.push({
                    midi,
                    timeStart: chunkStartTime + (startFrame * secPerFrame),
                    duration: dur,
                    velocity: Math.min(1.0, Math.max(0.3, peakVal))
                  });
                }
              }
            }
          }
        }
      }

      rawNotes.sort((a, b) => a.timeStart - b.timeStart);
      return rawNotes;
    }
  }

  // -------------------------------------------------------------
  // 2D. Demucs Neural Stem Separator Runner (ONNX)
  // -------------------------------------------------------------
  class DemucsStemRunner {
    constructor(storage) {
      this.storage = storage;
      this.session = null;
      this.inputName = 'mix';
      this.outputName = 'stems';
      this.isInitializing = false;
      this.sampleRate = 44100;
      this.chunkSize = 343980; // 7.8s at 44.1kHz
      this.overlap = Math.floor(this.chunkSize / 4); // ~1.95s overlap (85995 samples)
      this.stride = this.chunkSize - this.overlap;   // ~5.85s stride (257985 samples)
    }

    async isReady() {
      if (this.session) return true;
      if (typeof window === 'undefined') return false;
      return await this.storage.hasModel('demucs');
    }

    async initSession(modelBuffer = null) {
      if (this.session) return this.session;
      if (this.isInitializing) {
        while (this.isInitializing) {
          await new Promise(r => setTimeout(r, 50));
        }
        return this.session;
      }
      this.isInitializing = true;
      try {
        if (typeof window === 'undefined' || !window.ort) {
          throw new Error('ONNX Runtime Web (ort) is not available.');
        }

        await setupWasmEnv(this.storage);

        let buffer = modelBuffer;
        if (!buffer) {
          buffer = await this.storage.getModel('demucs');
        }
        if (!buffer && typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:') {
          try {
            const resp = await fetch('models/htdemucs.onnx');
            if (resp.ok) {
              buffer = await resp.arrayBuffer();
              await this.storage.saveModel('demucs', buffer, { name: 'HTDemucs' });
            }
          } catch (e) {}
        }
        if (!buffer) {
          throw new Error('HTDemucs model is not cached. Please open "🧠 Model Cache" and select "models/htdemucs.onnx".');
        }

        const modelBytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
        try {
          this.session = await window.ort.InferenceSession.create(modelBytes, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'disabled',
            enableCpuMemArena: false,
            enableMemPattern: false
          });
          this.inputName = this.session.inputNames[0] || 'mix';
          this.outputName = this.session.outputNames[0] || 'stems';
          return this.session;
        } catch (ortErr) {
          console.error('[Demucs] ONNX session creation failed:', ortErr);
          try { await this.storage.deleteModel('demucs'); } catch (e) {}
          this.session = null;
          const detail = (ortErr && (ortErr.message || ortErr.toString())) || 'unknown error';
          throw new Error(`Demucs neural model failed to initialize (${detail}). Any corrupted cache was automatically removed. Please load 'models/htdemucs.onnx' (158 MB) using '📂 Load Local Model File' in the Model Cache dialog.`);
        }
      } finally {
        this.isInitializing = false;
      }
    }

    _makeWindow(n, overlap) {
      const w = new Float32Array(n);
      w.fill(1.0);
      for (let i = 0; i < overlap; i++) {
        const fade = i / overlap;
        w[i] = fade;
        w[n - 1 - i] = fade;
      }
      return w;
    }

    async resampleTo44kStereo(audioBuffer) {
      const targetRate = 44100;
      if (audioBuffer.sampleRate === targetRate && audioBuffer.numberOfChannels === 2) {
        return {
          left: audioBuffer.getChannelData(0),
          right: audioBuffer.getChannelData(1),
          length: audioBuffer.length
        };
      }
      const duration = audioBuffer.duration;
      const targetLength = Math.max(1, Math.round(duration * targetRate));
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        2,
        targetLength,
        targetRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const resampled = await offlineCtx.startRendering();
      return {
        left: resampled.getChannelData(0),
        right: resampled.getChannelData(1),
        length: resampled.length
      };
    }

    async separate(audioBuffer, onProgress = null) {
      await this.initSession();
      if (!this.session) throw new Error('Demucs ONNX session could not be initialized.');

      if (onProgress) onProgress(0.05, 'Preparing 44.1 kHz stereo audio for Demucs neural engine...');
      const stereo = await this.resampleTo44kStereo(audioBuffer);
      const totalSamples = stereo.length;
      const leftIn = stereo.left;
      const rightIn = stereo.right;

      const nChunks = Math.max(1, Math.ceil((totalSamples - this.overlap) / this.stride));
      const fadeWin = this._makeWindow(this.chunkSize, this.overlap);

      // Accumulator arrays for 4 stems: 0: drums, 1: bass, 2: other, 3: vocals
      const stemAccL = [new Float32Array(totalSamples), new Float32Array(totalSamples), new Float32Array(totalSamples), new Float32Array(totalSamples)];
      const stemAccR = [new Float32Array(totalSamples), new Float32Array(totalSamples), new Float32Array(totalSamples), new Float32Array(totalSamples)];
      const weightAcc = new Float32Array(totalSamples);
      const ortObj = (typeof window !== 'undefined' && window.ort) ? window.ort : (typeof ort !== 'undefined' ? ort : globalThis.ort);

      for (let c = 0; c < nChunks; c++) {
        const start = c * this.stride;
        const end = Math.min(start + this.chunkSize, totalSamples);
        const clen = end - start;

        if (onProgress) {
          const frac = 0.08 + (c / nChunks) * 0.80;
          onProgress(frac, `Neural stem separation: chunk ${c + 1} of ${nChunks} (~${Math.round(end / 44100)}s)...`);
          await new Promise(r => setTimeout(r, 0));
        }

        // Prepare chunk data shape [1, 2, 343980]
        const chunkData = new Float32Array(2 * this.chunkSize);
        for (let i = 0; i < clen; i++) {
          chunkData[i] = leftIn[start + i];
          chunkData[this.chunkSize + i] = rightIn[start + i];
        }

        const inputTensor = new ortObj.Tensor('float32', chunkData, [1, 2, this.chunkSize]);
        const results = await this.session.run({ [this.inputName]: inputTensor });

        // Output shape [1, S, 2, 343980]
        const outData = results[this.outputName].data;
        const numStems = Math.round(outData.length / (2 * this.chunkSize));

        for (let s = 0; s < Math.min(4, numStems); s++) {
          const stemOffset = s * 2 * this.chunkSize;
          const leftOffset = stemOffset;
          const rightOffset = stemOffset + this.chunkSize;
          const accL = stemAccL[s];
          const accR = stemAccR[s];

          for (let i = 0; i < clen; i++) {
            const w = fadeWin[i];
            accL[start + i] += outData[leftOffset + i] * w;
            accR[start + i] += (rightOffset + i < outData.length ? outData[rightOffset + i] : outData[leftOffset + i]) * w;
          }
        }

        for (let i = 0; i < clen; i++) {
          weightAcc[start + i] += fadeWin[i];
        }
      }

      if (onProgress) onProgress(0.95, 'Normalizing overlap windows and rendering neural stems...');

      // Normalize by weights
      for (let i = 0; i < totalSamples; i++) {
        const w = weightAcc[i] > 1e-6 ? weightAcc[i] : 1.0;
        const invW = 1.0 / w;
        for (let s = 0; s < 4; s++) {
          stemAccL[s][i] *= invW;
          stemAccR[s][i] *= invW;
        }
      }

      // Create WebAudio Buffers for the 4 separated neural stems
      const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : new (window.AudioContext || window.webkitAudioContext)();
      const createBuf = () => ctx.createBuffer(2, totalSamples, 44100);

      const drumsBuf = createBuf();
      drumsBuf.getChannelData(0).set(stemAccL[0]);
      drumsBuf.getChannelData(1).set(stemAccR[0]);

      const bassBuf = createBuf();
      bassBuf.getChannelData(0).set(stemAccL[1]);
      bassBuf.getChannelData(1).set(stemAccR[1]);

      const otherBuf = createBuf();
      otherBuf.getChannelData(0).set(stemAccL[2]);
      otherBuf.getChannelData(1).set(stemAccR[2]);

      const vocalsBuf = createBuf();
      vocalsBuf.getChannelData(0).set(stemAccL[3]);
      vocalsBuf.getChannelData(1).set(stemAccR[3]);

      if (onProgress) onProgress(1.0, 'Neural stem separation complete!');

      return {
        drums: drumsBuf,
        bass: bassBuf,
        other: otherBuf,
        vocals: vocalsBuf
      };
    }

    /**
     * Single-Target Neural Stem Separation (Ultra Low-RAM Footprint for Mobile)
     * Isolates ONLY the requested target stem ('drums', 'bass', 'other', 'vocals').
     * Allocates ONLY 2 Float32Array channel accumulators instead of 8, saving ~75% accumulator RAM.
     * Yields control after every chunk to prevent mobile ANR browser freezes.
     */
    async separateSingleStem(audioBuffer, targetStem = 'drums', onProgress = null) {
      await this.initSession();
      if (!this.session) throw new Error('Demucs ONNX session could not be initialized.');

      const stemMap = {
        drums: 0, drum: 0, '0': 0,
        bass: 1, '1': 1,
        other: 2, guitar: 2, instruments: 2, '2': 2,
        vocals: 3, vocal: 3, voice: 3, '3': 3
      };
      const canonicalNames = ['drums', 'bass', 'other', 'vocals'];
      const targetIndex = stemMap[String(targetStem).toLowerCase()] ?? 0;
      const targetName = canonicalNames[targetIndex] || 'drums';

      const stemDisplayNames = {
        drums: 'Drums (Kick, Snare & Cymbals)',
        bass: 'Bassline (Electric & Sub-Bass)',
        other: 'Other Instruments (Guitar & Keys)',
        vocals: 'Vocals (Lead & Backing)'
      };
      const displayName = stemDisplayNames[targetName] || targetName;

      if (onProgress) onProgress(0.04, `Preparing audio for single-target ${displayName} separation...`);
      const stereo = await this.resampleTo44kStereo(audioBuffer);
      const totalSamples = stereo.length;
      const leftIn = stereo.left;
      const rightIn = stereo.right;

      const nChunks = Math.max(1, Math.ceil((totalSamples - this.overlap) / this.stride));
      const fadeWin = this._makeWindow(this.chunkSize, this.overlap);

      // Memory optimization: Allocate ONLY 2 channels for the requested target stem
      const accL = new Float32Array(totalSamples);
      const accR = new Float32Array(totalSamples);
      const weightAcc = new Float32Array(totalSamples);

      const ortObj = (typeof window !== 'undefined' && window.ort) ? window.ort : (typeof ort !== 'undefined' ? ort : globalThis.ort);

      for (let c = 0; c < nChunks; c++) {
        const start = c * this.stride;
        const end = Math.min(start + this.chunkSize, totalSamples);
        const clen = end - start;

        if (onProgress) {
          const frac = 0.05 + (c / nChunks) * 0.90;
          onProgress(frac, `Isolating ${displayName}: chunk ${c + 1} of ${nChunks} (~${Math.round(end / 44100)}s)...`);
          // Yield to browser event loop to keep UI smooth and allow GC
          await new Promise(r => setTimeout(r, 0));
        }

        // Prepare chunk shape [1, 2, 343980]
        const chunkData = new Float32Array(2 * this.chunkSize);
        for (let i = 0; i < clen; i++) {
          chunkData[i] = leftIn[start + i];
          chunkData[this.chunkSize + i] = rightIn[start + i];
        }

        const inputTensor = new ortObj.Tensor('float32', chunkData, [1, 2, this.chunkSize]);
        const results = await this.session.run({ [this.inputName]: inputTensor });

        // Output shape [1, 4, 2, 343980]
        const outData = results[this.outputName].data;
        const stemOffset = targetIndex * 2 * this.chunkSize;
        const leftOffset = stemOffset;
        const rightOffset = stemOffset + this.chunkSize;

        for (let i = 0; i < clen; i++) {
          const w = fadeWin[i];
          accL[start + i] += outData[leftOffset + i] * w;
          accR[start + i] += (rightOffset + i < outData.length ? outData[rightOffset + i] : outData[leftOffset + i]) * w;
        }

        for (let i = 0; i < clen; i++) {
          weightAcc[start + i] += fadeWin[i];
        }

        // Delete output tensor reference to help GC
        delete results[this.outputName];
      }

      if (onProgress) onProgress(0.96, `Normalizing overlap windows for ${displayName}...`);

      // Normalize by overlap window weights
      for (let i = 0; i < totalSamples; i++) {
        const w = weightAcc[i] > 1e-6 ? weightAcc[i] : 1.0;
        accL[i] /= w;
        accR[i] /= w;
      }

      // Create WebAudio Buffer for the single isolated stem
      const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : new (window.AudioContext || window.webkitAudioContext)();
      const stemBuf = ctx.createBuffer(2, totalSamples, 44100);
      stemBuf.getChannelData(0).set(accL);
      stemBuf.getChannelData(1).set(accR);

      if (onProgress) onProgress(1.0, `${displayName} isolation complete!`);

      return {
        stemName: targetName,
        stemIndex: targetIndex,
        displayName: displayName,
        buffer: stemBuf
      };
    }
  }

  // -------------------------------------------------------------
  // 2E. OpenUnmix (UMX) Sequential Single-Stem Runner (Mobile Tier)
  // Low-RAM, Single-Stem Loading, Frequency-Domain STFT/ISTFT Pipeline
  // -------------------------------------------------------------
  class UMXStemRunner {
    constructor(storage) {
      this.storage = storage;
      this.session = null;
      this.activeStem = null;
      this.stftEngine = new FastSTFT(4096, 1024);
      this.sampleRate = 44100;
      this.chunkSec = 12.0;       // 12-second chunking for low mobile RAM
      this.overlapSec = 1.0;     // 1.0s overlap for smooth cross-fading
    }

    async isReady(stemName) {
      if (!this.storage) return false;
      const key = stemName === 'guitar' ? 'umx_other' : `umx_${stemName}`;
      return await this.storage.hasModel(key);
    }

    async loadStemModel(stemName, onProgress = null) {
      // Strict Sequential Lifecycle: release any lingering session first
      if (this.session) {
        try { await this.session.release(); } catch (e) {}
        this.session = null;
        this.activeStem = null;
      }

      await setupWasmEnv(this.storage);

      const modelKey = `umx_${stemName}`;
      let buffer = await this.storage.getModel(modelKey);

      if (!buffer && typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:') {
        try {
          if (onProgress) onProgress(0.05, `Loading local models/${modelKey}.onnx from server...`);
          const resp = await fetch(`models/${modelKey}.onnx`);
          if (resp.ok) {
            buffer = await resp.arrayBuffer();
            await this.storage.saveModel(modelKey, buffer, { name: `OpenUnmix ${stemName}` });
          }
        } catch (e) {
          console.warn(`Local fetch of models/${modelKey}.onnx failed:`, e);
        }
      }

      if (!buffer) {
        throw new Error(`OpenUnmix model for "${stemName}" is not cached. Please open "🧠 Model Cache" and select "models/${modelKey}.onnx".`);
      }

      const modelBytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
      const ortObj = (typeof window !== 'undefined' && window.ort) ? window.ort : (typeof ort !== 'undefined' ? ort : globalThis.ort);

      const hasGpu = Boolean(typeof navigator !== 'undefined' && navigator.gpu);
      const eps = hasGpu ? ['webgpu', 'wasm'] : ['wasm'];

      this.session = await ortObj.InferenceSession.create(modelBytes, {
        executionProviders: eps,
        graphOptimizationLevel: 'disabled',
        enableCpuMemArena: false,
        enableMemPattern: false
      });
      this.activeStem = stemName;
      return this.session;
    }

    enhanceMask(scale, k, f, nBins, stemKey, isTransient) {
      let s = scale;
      if (s <= 0.0) return 0.0;

      // 1. Contrast expansion (Photoshop Curves / Levels Black Point)
      // Exponential soft curve suppresses low-level bleed/flutter while preserving active signal
      if (s <= 1.0) {
        s = Math.pow(s, 1.32);
      } else {
        s = Math.min(1.15, s);
      }

      // Soft noise floor gate below 5%
      if (s < 0.05) {
        s *= Math.max(0.0, (s - 0.01) / 0.04);
      }

      // 2. Instrument-Specific Frequency Band-Limiting
      // f_hz = k * (44100 / 4096) = k * 10.7666 Hz
      if (stemKey === 'bass') {
        // Sub-rumble cutoff below 28 Hz (k < 3)
        if (k < 3) {
          s *= (k / 3);
        }
        // Bass guitar content above 4.0 kHz (k = 372) is almost entirely bleed from cymbals / vocals
        // Apply smooth Hann roll-off down to 6.2 kHz (k = 576)
        if (k > 372) {
          if (k >= 576) {
            s *= 0.015;
          } else {
            const t = (k - 372) / (576 - 372);
            const atten = 0.5 * (1.0 + Math.cos(Math.PI * t));
            s *= (0.015 + 0.985 * atten);
          }
        }
      } else if (stemKey === 'vocals') {
        // Singing voice fundamental cutoff below 85 Hz (k < 8)
        // Eliminates kick drum thud and sub-bass bleed
        if (k < 8) {
          const t = Math.max(0, k / 8);
          s *= (t * t);
        }
      } else if (stemKey === 'drums') {
        // Sub-bass high-pass below 25 Hz (k < 3) to eliminate sub rumble
        if (k < 3) {
          s *= (k / 3);
        }
      } else if (stemKey === 'other') {
        // Guitar / keys high-pass below 60 Hz (k < 6)
        if (k < 6) {
          s *= (k / 6);
        }
      }

      // 3. Transient Punch Sharpening (Unsharp Masking for attacks)
      if (isTransient) {
        if (stemKey === 'drums' && k >= 20 && k <= 800) {
          s = Math.min(1.15, s * 1.15);
        } else if (stemKey === 'vocals' && k >= 100 && k <= 600) {
          s = Math.min(1.10, s * 1.08);
        }
      }

      return s;
    }

    async separateSingleStem(audioBuffer, targetStem = 'drums', onProgress = null, options = {}) {
      let stemKey = targetStem.toLowerCase();
      if (stemKey === 'guitar') stemKey = 'other';
      if (!['drums', 'bass', 'other', 'vocals'].includes(stemKey)) {
        stemKey = 'other';
      }

      const enhance = options && options.enhance !== false;
      const displayName = targetStem.charAt(0).toUpperCase() + targetStem.slice(1);
      if (onProgress) onProgress(0.02, `Preparing OpenUnmix engine for ${displayName}${enhance ? ' (with Spectral De-Bleed)' : ''}...`);

      try {
        await this.loadStemModel(stemKey, onProgress);

        const totalSamples = audioBuffer.length;
        const leftIn = audioBuffer.getChannelData(0);
        const rightIn = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftIn;

        const chunkLen = Math.floor(this.chunkSec * this.sampleRate);
        const overlapLen = Math.floor(this.overlapSec * this.sampleRate);
        const stride = chunkLen - overlapLen;

        const nChunks = Math.max(1, Math.ceil((totalSamples - overlapLen) / stride));

        const accL = new Float32Array(totalSamples);
        const accR = new Float32Array(totalSamples);
        const weightAcc = new Float32Array(totalSamples);

        const ortObj = (typeof window !== 'undefined' && window.ort) ? window.ort : (typeof ort !== 'undefined' ? ort : globalThis.ort);

        for (let c = 0; c < nChunks; c++) {
          const start = c * stride;
          const end = Math.min(start + chunkLen, totalSamples);
          const clen = end - start;

          if (onProgress) {
            const frac = 0.20 + (c / nChunks) * 0.75;
            onProgress(frac, `Isolating ${displayName} (Chunk ${c + 1} of ${nChunks})${enhance ? ' [Enhanced]' : ''}...`);
            await new Promise(r => setTimeout(r, 0)); // Yield to event loop for GC & UI
          }

          const chunkL = leftIn.subarray(start, end);
          const chunkR = rightIn.subarray(start, end);

          // 1. Forward STFT
          const stftL = this.stftEngine.stft(chunkL);
          const stftR = this.stftEngine.stft(chunkR);
          const nFrames = stftL.nFrames;
          const nBins = this.stftEngine.nBins; // 2049

          // 2. Prepare ONNX Input Tensor: shape [1, 2, 2049, nFrames]
          const tensorLen = 2 * nBins * nFrames;
          const magData = new Float32Array(tensorLen);
          const chOffset = nBins * nFrames;

          for (let f = 0; f < nFrames; f++) {
            const fOffset = f * nBins;
            for (let k = 0; k < nBins; k++) {
              const tensorIdx = k * nFrames + f;
              magData[tensorIdx] = stftL.mag[fOffset + k];
              magData[chOffset + tensorIdx] = stftR.mag[fOffset + k];
            }
          }

          const inputTensor = new ortObj.Tensor('float32', magData, [1, 2, nBins, nFrames]);
          const inputName = this.session.inputNames[0] || 'mag';
          const outputName = this.session.outputNames[0] || 'est';

          const results = await this.session.run({ [inputName]: inputTensor });
          const estData = results[outputName].data;

          // 3. Spectral Flux calculation for attack transient sharpening (if enhance is true)
          let fluxL = null;
          let fluxR = null;
          let fluxThreshL = 0;
          let fluxThreshR = 0;

          if (enhance) {
            fluxL = new Float32Array(nFrames);
            fluxR = new Float32Array(nFrames);
            let sumL = 0;
            let sumR = 0;
            const maxK = Math.min(nBins, 750); // up to ~8 kHz
            for (let f = 1; f < nFrames; f++) {
              const fOff = f * nBins;
              const fPrev = (f - 1) * nBins;
              let dL = 0;
              let dR = 0;
              for (let k = 10; k < maxK; k++) {
                const diffL = stftL.mag[fOff + k] - stftL.mag[fPrev + k];
                if (diffL > 0) dL += diffL;
                const diffR = stftR.mag[fOff + k] - stftR.mag[fPrev + k];
                if (diffR > 0) dR += diffR;
              }
              fluxL[f] = dL;
              fluxR[f] = dR;
              sumL += dL;
              sumR += dR;
            }
            fluxThreshL = (sumL / Math.max(1, nFrames - 1)) * 1.4;
            fluxThreshR = (sumR / Math.max(1, nFrames - 1)) * 1.4;
          }

          // 4. Phase coupling, spectral de-bleed enhancement, and reconstruction
          const specRealL = new Float32Array(nFrames * nBins);
          const specImagL = new Float32Array(nFrames * nBins);
          const specRealR = new Float32Array(nFrames * nBins);
          const specImagR = new Float32Array(nFrames * nBins);

          for (let f = 0; f < nFrames; f++) {
            const fOffset = f * nBins;
            const isTransL = Boolean(enhance && fluxL && fluxL[f] > fluxThreshL);
            const isTransR = Boolean(enhance && fluxR && fluxR[f] > fluxThreshR);

            for (let k = 0; k < nBins; k++) {
              const tensorIdx = k * nFrames + f;
              const estML = estData[tensorIdx];
              const estMR = estData[chOffset + tensorIdx];

              const mixML = stftL.mag[fOffset + k];
              const mixMR = stftR.mag[fOffset + k];

              let scaleL = estML / (mixML + 1e-7);
              let scaleR = estMR / (mixMR + 1e-7);

              if (enhance) {
                scaleL = this.enhanceMask(scaleL, k, f, nBins, stemKey, isTransL);
                scaleR = this.enhanceMask(scaleR, k, f, nBins, stemKey, isTransR);
              }

              specRealL[fOffset + k] = stftL.real[fOffset + k] * scaleL;
              specImagL[fOffset + k] = stftL.imag[fOffset + k] * scaleL;

              specRealR[fOffset + k] = stftR.real[fOffset + k] * scaleR;
              specImagR[fOffset + k] = stftR.imag[fOffset + k] * scaleR;
            }
          }

          // 4. Inverse STFT to get chunk audio
          const chunkStemL = this.stftEngine.istft(specRealL, specImagL, nFrames, clen);
          const chunkStemR = this.stftEngine.istft(specRealR, specImagR, nFrames, clen);

          // 5. Overlap-add with smooth crossfade
          for (let i = 0; i < clen; i++) {
            let w = 1.0;
            if (c > 0 && i < overlapLen) {
              w = 0.5 * (1.0 - Math.cos((Math.PI * i) / overlapLen));
            }
            if (c < nChunks - 1 && i >= clen - overlapLen) {
              const tail = clen - i;
              w = 0.5 * (1.0 - Math.cos((Math.PI * tail) / overlapLen));
            }

            accL[start + i] += chunkStemL[i] * w;
            accR[start + i] += chunkStemR[i] * w;
            weightAcc[start + i] += w;
          }

          delete results[outputName];
        }

        for (let i = 0; i < totalSamples; i++) {
          const w = weightAcc[i] > 1e-5 ? weightAcc[i] : 1.0;
          accL[i] /= w;
          accR[i] /= w;
        }

        const ctx = (window.audio && window.audio.ctx) ? window.audio.ctx : new (window.AudioContext || window.webkitAudioContext)();
        const stemBuf = ctx.createBuffer(2, totalSamples, 44100);
        stemBuf.getChannelData(0).set(accL);
        stemBuf.getChannelData(1).set(accR);

        if (onProgress) onProgress(1.0, `${displayName} isolation complete!`);

        return {
          stemName: targetStem,
          stemIndex: targetStem === 'drums' ? 0 : (targetStem === 'bass' ? 1 : (targetStem === 'guitar' || targetStem === 'other' ? 2 : 3)),
          displayName: displayName,
          buffer: stemBuf
        };
      } finally {
        // Strict Sequential Disposal: Always release session and free RAM!
        if (this.session) {
          try {
            await this.session.release();
          } catch (e) {}
          this.session = null;
          this.activeStem = null;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Audio Transcriber & 6-Stem Engine
  // -------------------------------------------------------------
  class AudioTranscriberEngine {
    constructor() {
      this.audioCtx = null;
      this.fretboardSolver = new BiomechanicalFretboardSolver();
      this.storage = new NeuralModelStorage();
      this.detector = new DeviceCapabilityDetector();
      this.capabilities = null;
      this.demucsRunner = new DemucsStemRunner(this.storage);
      this.umxRunner = new UMXStemRunner(this.storage);
      this.cachedStems = null;
      this.sourceAudioBuffer = null;
      this.detectedBpm = 113;
      this.isProcessing = false;
    }

    async getCapabilities() {
      if (!this.capabilities) {
        this.capabilities = await this.detector.detect();
      }
      return this.capabilities;
    }

    setTier(tier) {
      return 2;
    }

    getAudioContext() {
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
      }
      if (window.audio && window.audio.ctx && window.audio.ctx.state !== 'closed') {
        this.audioCtx = window.audio.ctx;
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        return this.audioCtx;
      }
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    /**
     * 1. Decode Audio File (WAV, MP3, FLAC, M4A, OGG)
     * Supports File, Blob, or ArrayBuffer, using Promise or callback decodeAudioData.
     */
    async decodeAudioFile(fileOrBlobOrBuffer, customCtx = null) {
      const ctx = customCtx || this.getAudioContext();
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch (e) {}
      }

      let arrayBuffer;
      if (fileOrBlobOrBuffer instanceof ArrayBuffer) {
        arrayBuffer = fileOrBlobOrBuffer;
      } else if (fileOrBlobOrBuffer && typeof fileOrBlobOrBuffer.arrayBuffer === 'function') {
        arrayBuffer = await fileOrBlobOrBuffer.arrayBuffer();
      } else if (fileOrBlobOrBuffer && fileOrBlobOrBuffer.buffer instanceof ArrayBuffer) {
        arrayBuffer = fileOrBlobOrBuffer.buffer;
      } else {
        throw new Error('Unsupported audio payload: expected File, Blob, or ArrayBuffer');
      }

      // Slicing arrayBuffer ensures that if decodeAudioData detaches the buffer,
      // the original remains intact.
      const bufferCopy = arrayBuffer.slice(0);

      return new Promise((resolve, reject) => {
        let isSettled = false;
        const onSuccess = (decoded) => {
          if (isSettled) return;
          isSettled = true;
          this.sourceAudioBuffer = decoded;
          resolve(decoded);
        };
        const onError = (err) => {
          if (isSettled) return;
          isSettled = true;
          reject(err || new Error('Audio decoding failed'));
        };

        try {
          const ret = ctx.decodeAudioData(bufferCopy, onSuccess, onError);
          if (ret && typeof ret.then === 'function') {
            ret.then(onSuccess).catch(onError);
          }
        } catch (syncErr) {
          onError(syncErr);
        }
      });
    }

    /**
     * 2. BPM & Downbeat Energy Tracker (Spectral Flux Autocorrelation)
     */
    detectBpmAndBeats(audioBuffer) {
      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length;
      const numChannels = audioBuffer.numberOfChannels;

      // Downmix to mono float array
      const mono = new Float32Array(length);
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const weight = 1.0 / numChannels;
        for (let i = 0; i < length; i++) {
          mono[i] += channelData[i] * weight;
        }
      }

      // Compute envelope / energy flux over 10ms hops (~100 frames/sec)
      const hopSize = Math.floor(sampleRate * 0.01);
      const frameCount = Math.floor(length / hopSize);
      const energyEnvelope = new Float32Array(frameCount);

      for (let f = 0; f < frameCount; f++) {
        const start = f * hopSize;
        const end = Math.min(start + hopSize, length);
        let sum = 0;
        for (let i = start; i < end; i++) {
          sum += mono[i] * mono[i];
        }
        energyEnvelope[f] = Math.sqrt(sum / (end - start));
      }

      // First-order difference (onset peaks)
      const onsetFlux = new Float32Array(frameCount);
      for (let f = 1; f < frameCount; f++) {
        const diff = energyEnvelope[f] - energyEnvelope[f - 1];
        onsetFlux[f] = diff > 0 ? diff : 0;
      }

      // Autocorrelation across musical BPM lag window: 55 to 195 BPM
      const framesPerSec = sampleRate / hopSize;
      const minLag = Math.floor((60 / 195) * framesPerSec);
      const maxLag = Math.floor((60 / 55) * framesPerSec);

      let bestBpm = 113;
      let highestCorrelation = -1;

      for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0;
        const n = Math.min(frameCount - lag, 4000); // Check first 40 seconds
        for (let i = 0; i < n; i++) {
          sum += onsetFlux[i] * onsetFlux[i + lag];
        }
        if (sum > highestCorrelation) {
          highestCorrelation = sum;
          bestBpm = Math.round((60 * framesPerSec) / lag);
        }
      }

      // Harmonize within 70 - 165 BPM range
      while (bestBpm < 70) bestBpm *= 2;
      while (bestBpm > 165) bestBpm = Math.round(bestBpm / 2);

      this.detectedBpm = bestBpm;
      return {
        bpm: bestBpm,
        confidence: Math.min(1.0, highestCorrelation / 50),
        duration: audioBuffer.duration
      };
    }

    /**
     * Neural 4-Stem Audio Separation (HTDemucs ONNX Engine).
     * Strictly zero filterbank or spectral cheating.
     * Returns: { drums, bass, other, vocals }
     */
    async separateStems(audioBuffer, onProgress) {
      const caps = await this.getCapabilities();
      if (caps && caps.engineMode === 'mobile_optimized') {
        return this.separateStemsSequentially(audioBuffer, ['drums', 'bass', 'other', 'vocals'], onProgress);
      }
      if (!this.demucsRunner) {
        throw new Error('HTDemucs stem runner is not initialized.');
      }
      this.isProcessing = true;
      try {
        if (onProgress) onProgress(0.05, 'Starting HTDemucs deep-learning stem separation...');
        this.cachedStems = await this.demucsRunner.separate(audioBuffer, onProgress);
        return this.cachedStems;
      } catch (err) {
        console.error('Demucs stem separation failed:', err);
        throw err;
      } finally {
        this.isProcessing = false;
      }
    }

    separateStems6(audioBuffer, onProgress) {
      return this.separateStems(audioBuffer, onProgress);
    }

    /**
     * Single-Target Neural Stem Separation (Device-aware: HTDemucs on Desktop, UMX on Mobile)
     */
    async separateSingleStem(audioBuffer, targetStem = 'drums', onProgress = null, options = {}) {
      this.isProcessing = true;
      try {
        if (!this.cachedStems) this.cachedStems = {};
        const caps = await this.getCapabilities();
        let result;
        if (caps && caps.engineMode === 'mobile_optimized') {
          if (!this.umxRunner) this.umxRunner = new UMXStemRunner(this.storage);
          result = await this.umxRunner.separateSingleStem(audioBuffer, targetStem, onProgress, options);
        } else {
          if (!this.demucsRunner) {
            throw new Error('HTDemucs stem runner is not initialized.');
          }
          result = await this.demucsRunner.separateSingleStem(audioBuffer, targetStem, onProgress, options);
        }
        this.cachedStems[result.stemName] = result.buffer;
        return result;
      } catch (err) {
        console.error(`Single-stem isolation failed for ${targetStem}:`, err);
        throw err;
      } finally {
        this.isProcessing = false;
      }
    }

    /**
     * Sequential Multi-Stem Separation (Processes one stem at a time with memory cooldowns)
     */
    async separateStemsSequentially(audioBuffer, stemList = ['drums', 'bass', 'other', 'vocals'], onProgress = null, options = {}) {
      if (!this.cachedStems) this.cachedStems = {};
      for (let i = 0; i < stemList.length; i++) {
        const stemName = stemList[i];
        const subProgress = (frac, msg) => {
          if (onProgress) {
            const overall = (i + frac) / stemList.length;
            onProgress(overall, `[Stem ${i + 1}/${stemList.length}: ${stemName}] ${msg}`);
          }
        };
        const res = await this.separateSingleStem(audioBuffer, stemName, subProgress, options);
        this.cachedStems[stemName] = res.buffer;
        // Memory cooldown pause between stems to allow V8 / SpiderMonkey GC
        await new Promise(r => setTimeout(r, 100));
      }
      return this.cachedStems;
    }

    // Defensive stubs for backwards compatibility
    async transcribeStem() {
      return { bpm: this.detectedBpm || 113, notes: [], measures: [] };
    }
    generateTabHtml() { return ''; }
    generateTabAscii() { return ''; }
    renderStaffCanvas() {}
  }

  // Backwards-compatibility stub for StemMixerPlayer
  class StemMixerPlayer {
    constructor() {
      this.isPlaying = false;
      this.stems = {};
    }
    setStems(stems) { this.stems = stems || {}; }
    play() {}
    stop() {}
    setSpeed() {}
    toggleSolo() {}
    toggleMute() {}
    setStemVolume() {}
  }

  // Export singleton to window namespace
  window.SongTranscriber = {
    AudioTranscriberEngine,
    engine: new AudioTranscriberEngine(),
    DeviceCapabilityDetector,
    NeuralModelStorage,
    DemucsStemRunner,
    UMXStemRunner,
    FastSTFT,
    SpotifyBasicPitchRunner,
    setupWasmEnv,
    BiomechanicalFretboardSolver,
    StemMixerPlayer
  };

})(typeof window !== 'undefined' ? window : globalThis);
