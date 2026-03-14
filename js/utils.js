// ─── Music Theory Constants ───────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MAJOR_SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // W W H W W W H

// Returns the 7 note names in the major scale of `key`
function getScaleNotes(key) {
  const root = NOTE_NAMES.indexOf(key);
  return MAJOR_SCALE_OFFSETS.map(o => NOTE_NAMES[(root + o) % 12]);
}

// Converts a frequency in Hz to { name, midi, cents }
function freqToNote(freq) {
  if (!freq || freq < 50) return null;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const noteIndex = Math.round(midi) % 12;
  const noteName = NOTE_NAMES[((noteIndex % 12) + 12) % 12];
  const cents = (midi - Math.round(midi)) * 100;
  return { name: noteName, midi: Math.round(midi), cents };
}

// Returns a frequency snapped toward the nearest scale note
// strength 0–100: 0 = unchanged, 100 = hard snap
function snapToScale(freq, key, strength) {
  if (!freq || freq < 50) return freq;
  const midi = 69 + 12 * Math.log2(freq / 440);
  const noteInOctave = ((Math.round(midi) % 12) + 12) % 12;
  const scaleNotes = getScaleNotes(key).map(n => NOTE_NAMES.indexOf(n));

  let closest = scaleNotes[0], minDist = 12;
  for (const n of scaleNotes) {
    let d = Math.abs(noteInOctave - n);
    if (d > 6) d = 12 - d;
    if (d < minDist) { minDist = d; closest = n; }
  }

  const targetMidi = Math.round(midi) - noteInOctave + closest;
  const snappedMidi = midi + (targetMidi - midi) * (strength / 100);
  return 440 * Math.pow(2, (snappedMidi - 69) / 12);
}

// ─── Audio Context ────────────────────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Returns the best supported MIME type for MediaRecorder
function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t; }
  return '';
}

// ─── Pitch Detection (Autocorrelation) ───────────────────────────────────────
// Returns detected frequency in Hz, or -1 if signal is too quiet / unclear.
function autoCorrelate(buf, sampleRate) {
  let rms = 0;
  for (const v of buf) rms += v * v;
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return -1; // silence

  // Trim leading/trailing near-silence for accuracy
  let r1 = 0, r2 = buf.length - 1;
  for (let i = 0; i < buf.length / 2; i++) { if (Math.abs(buf[i]) < 0.2) { r1 = i; break; } }
  for (let i = 1; i < buf.length / 2; i++) { if (Math.abs(buf[buf.length - i]) < 0.2) { r2 = buf.length - i; break; } }
  const trimBuf = buf.slice(r1, r2 + 1);

  const SIZE = trimBuf.length;
  const c = new Float32Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] += trimBuf[j] * trimBuf[j + i];

  let d = 0;
  while (d < SIZE && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < SIZE; i++) { if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; } }
  if (maxPos < 0) return -1;

  // Refine with quadratic interpolation
  let T0 = maxPos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  if (a) T0 -= b / (2 * a);
  return sampleRate / T0;
}

// ─── WAV Encoder ─────────────────────────────────────────────────────────────
// Encodes an AudioBuffer to a raw ArrayBuffer in RIFF WAV / 16-bit PCM format.
function bufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr    = buffer.sampleRate;
  const len   = buffer.length;
  const ab    = new ArrayBuffer(44 + len * numCh * 2);
  const v     = new DataView(ab);

  const ws  = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  const w16 = (o, n) => v.setUint16(o, n, true);
  const w32 = (o, n) => v.setUint32(o, n, true);

  ws(0, 'RIFF'); w32(4, 36 + len * numCh * 2); ws(8, 'WAVE');
  ws(12, 'fmt '); w32(16, 16); w16(20, 1); w16(22, numCh);
  w32(24, sr); w32(28, sr * numCh * 2); w16(32, numCh * 2); w16(34, 16);
  ws(36, 'data'); w32(40, len * numCh * 2);

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }
  return ab;
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
