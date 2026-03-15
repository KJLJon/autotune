// ─── Shared Application State ────────────────────────────────────────────────
// All global state lives here so every module can read/write it freely.

let audioCtx        = null;   // Web Audio context (singleton)
let mediaStream     = null;   // Active microphone stream
let mediaRecorder   = null;   // MediaRecorder instance during recording
let recordedChunks  = [];     // Raw audio chunks collected while recording
let recordedBlob    = null;   // Final blob after recording stops
let recordedBuffer  = null;   // Decoded AudioBuffer from recording
let musicBuffer     = null;   // Decoded AudioBuffer from uploaded music file
let mixedBuffer     = null;   // Final mixed AudioBuffer (vocal + music)
let pendingBuffer   = null;   // Background-processed buffer waiting to replace mixedBuffer

let analyserNode        = null;   // AnalyserNode (shared: recording & playback)
let playbackSource      = null;   // Current BufferSourceNode during playback
let playbackStart       = 0;      // audioCtx.currentTime when playback started
let playbackOffset      = 0;      // Seconds into the buffer where playback resumes
let progressInterval    = null;   // setInterval ID for transport progress bar
let timerInterval       = null;   // setInterval ID for recording timer display
let pitchWorkerInterval = null;   // setInterval ID for pitch detection loop

let isRecording   = false;
let isPlaying     = false;

let selectedKey   = 'C';     // Currently selected musical key
let noteHistory   = [];      // Last 20 detected note names for the ticker
let detectedFreq  = 0;       // Most recently detected frequency (Hz)
let activeTemplate = null;   // ID of the last applied template preset
let pitchSamples  = [];      // Pitch deviation samples collected during recording
