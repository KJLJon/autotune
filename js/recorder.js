// ─── Recording & Pitch Detection ─────────────────────────────────────────────

function initRecorder() {
  document.getElementById('recordBtn').addEventListener('click', startRecording);
  document.getElementById('stopBtn').addEventListener('click', stopRecording);
}

// ─── Start Recording ──────────────────────────────────────────────────────────
async function startRecording() {
  const recordBtn   = document.getElementById('recordBtn');
  const stopBtn     = document.getElementById('stopBtn');
  const recInd      = document.getElementById('recIndicator');
  const micStatus   = document.getElementById('micStatus');
  const timerEl     = document.getElementById('timer');

  try {
    const ctx = getAudioCtx();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Analyser for visualizer + pitch detection
    const source = ctx.createMediaStreamSource(mediaStream);
    analyserNode  = ctx.createAnalyser();
    analyserNode.fftSize = 2048;
    source.connect(analyserNode);

    startPitchDetection(analyserNode, ctx.sampleRate);

    // MediaRecorder
    mediaRecorder       = new MediaRecorder(mediaStream, { mimeType: getSupportedMimeType() });
    recordedChunks      = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = onRecordingStop;
    mediaRecorder.start(100);

    isRecording = true;
    recordBtn.disabled  = true;
    stopBtn.disabled    = false;
    recInd.classList.add('active');
    micStatus.textContent = 'Recording in progress — sing or speak clearly into your mic';
    micStatus.className   = 'status-text ok';

    recordingStartTime = Date.now();
    timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - recordingStartTime) / 1000);
      timerEl.textContent = formatTime(s);
    }, 500);

  } catch (err) {
    const micStatus = document.getElementById('micStatus');
    micStatus.textContent = 'Microphone access denied — click the lock icon in your browser address bar to allow';
    micStatus.className   = 'status-text err';
  }
}

// ─── Stop Recording ───────────────────────────────────────────────────────────
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  stopRecordingUI();
}

function stopRecordingUI() {
  isRecording = false;
  clearInterval(timerInterval);
  clearInterval(pitchWorkerInterval);

  document.getElementById('recordBtn').disabled   = false;
  document.getElementById('stopBtn').disabled     = true;
  document.getElementById('recIndicator').classList.remove('active');

  const levelFill = document.getElementById('levelFill');
  if (levelFill) levelFill.style.width = '0%';

  analyserNode = null;
}

// Called by MediaRecorder when all chunks are available
async function onRecordingStop() {
  const mimeType  = getSupportedMimeType();
  recordedBlob    = new Blob(recordedChunks, { type: mimeType });
  const arrBuf    = await recordedBlob.arrayBuffer();
  const ctx       = getAudioCtx();
  recordedBuffer  = await ctx.decodeAudioData(arrBuf);

  const micStatus = document.getElementById('micStatus');
  const kb        = (recordedBlob.size / 1024).toFixed(0);
  const dur       = recordedBuffer.duration.toFixed(1);
  micStatus.textContent = `Recording ready · ${kb} KB · ${dur}s · Click Play Mix to process`;
  micStatus.className   = 'status-text ok';

  enablePlayback();
}

// ─── Real-Time Pitch Detection ────────────────────────────────────────────────
function startPitchDetection(analyser, sampleRate) {
  const bufLen = analyser.fftSize;
  const buf    = new Float32Array(bufLen);

  pitchWorkerInterval = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);

    // ── Input level meter ──
    let rms = 0;
    for (const v of buf) rms += v * v;
    rms = Math.sqrt(rms / buf.length);
    const levelFill = document.getElementById('levelFill');
    if (levelFill) {
      const pct = Math.min(100, rms * 400);
      levelFill.style.width = pct + '%';
      // Orange/red warning when clipping
      levelFill.style.background = pct > 85
        ? 'linear-gradient(90deg, #00f5ff, #ff2d78)'
        : 'linear-gradient(90deg, #00f5ff, #7b2fff)';
    }

    // ── Pitch detection ──
    const freq = autoCorrelate(buf, sampleRate);
    if (freq > 0) {
      detectedFreq = freq;
      const note = freqToNote(freq);
      if (note) updateNoteDisplay(note);
    }
  }, 80);
}

// Adds a note to the scrolling ticker at the bottom of the record panel
function updateNoteDisplay(note) {
  noteHistory.push(note.name);
  if (noteHistory.length > 20) noteHistory.shift();

  const ticker = document.getElementById('noteTicker');
  if (ticker) {
    ticker.innerHTML = noteHistory
      .map((n, i) => `<span class="note-pill ${i === noteHistory.length - 1 ? 'active' : ''}">${n}</span>`)
      .join('');
  }
}
