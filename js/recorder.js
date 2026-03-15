// ─── Recording & Pitch Detection ─────────────────────────────────────────────

function initRecorder() {
  document.getElementById('recordBtn').addEventListener('click', startRecording);
  document.getElementById('stopBtn').addEventListener('click', stopRecording);
}

// ─── Pitch Coach UI ───────────────────────────────────────────────────────────
function updatePitchCoach(dev) {
  const statusEl = document.getElementById('pitchCoachStatus');
  const targetEl = document.getElementById('pitchTargetNote');
  const needleEl = document.getElementById('pitchCentsNeedle');
  const centsEl  = document.getElementById('pitchCentsValue');
  const inKeyEl  = document.getElementById('pitchInKey');
  if (!targetEl) return;

  targetEl.textContent = dev.target;
  centsEl.textContent  = (dev.centsOff > 0 ? '+' : '') + dev.centsOff + '¢';

  // Position needle (clamp ±50 cents → 0–100%)
  const pct = (Math.max(-50, Math.min(50, dev.centsOff)) + 50);
  needleEl.style.left = pct + '%';

  const abs = Math.abs(dev.centsOff);
  if (abs < 20) {
    needleEl.style.background = '#00e5a0';
    inKeyEl.className  = 'pitch-inkey in-key';
    inKeyEl.textContent = '✓ IN KEY';
    statusEl.textContent = 'Great pitch!';
  } else if (abs < 40) {
    needleEl.style.background = '#ffd700';
    inKeyEl.className  = 'pitch-inkey near-key';
    inKeyEl.textContent = dev.centsOff < 0 ? '▼ FLAT' : '▲ SHARP';
    statusEl.textContent = dev.centsOff < 0 ? 'Slightly flat — raise your pitch' : 'Slightly sharp — lower your pitch';
  } else {
    needleEl.style.background = '#ff2d78';
    inKeyEl.className  = 'pitch-inkey off-key';
    inKeyEl.textContent = dev.centsOff < 0 ? '▼▼ TOO FLAT' : '▲▲ TOO SHARP';
    statusEl.textContent = dev.centsOff < 0 ? 'Too flat — raise your pitch' : 'Too sharp — lower your pitch';
  }
}

function showPitchSummary() {
  const summaryEl = document.getElementById('pitchSummary');
  const contentEl = document.getElementById('pitchSummaryContent');
  if (!summaryEl || !contentEl || pitchSamples.length < 5) return;

  const inKeyCount = pitchSamples.filter(s => s.inKey).length;
  const pct        = Math.round(inKeyCount / pitchSamples.length * 100);

  const noteCounts = {};
  pitchSamples.forEach(s => { noteCounts[s.target] = (noteCounts[s.target] || 0) + 1; });
  const topNotes = Object.entries(noteCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n)
    .join(', ');

  // Recommendations keyed by accuracy tier — both IDs must exist in TEMPLATES
  let tip, recs;
  if (pct >= 80) {
    tip  = 'Your pitch is solid! Light correction will keep it sounding natural.';
    recs = [{ id: 'natural', label: '🎤 Natural Fix' }, { id: 'popsmooth', label: '✨ Pop Smooth' }];
  } else if (pct >= 60) {
    tip  = 'Good effort — a medium correction template will polish up the rough spots.';
    recs = [{ id: 'popsmooth', label: '✨ Pop Smooth' }, { id: 'heavypop', label: '💫 Heavy Pop' }];
  } else if (pct >= 40) {
    tip  = 'Hard correction will snap your pitch in place. Hum the melody once before re-recording for better results.';
    recs = [{ id: 'cher', label: '🌟 Cher Effect' }, { id: 'tpain', label: '🎵 T-Pain' }];
  } else {
    tip  = 'No worries — max correction is exactly what autotune is for. These templates thrive on rough pitch.';
    recs = [{ id: 'cher', label: '🌟 Cher Effect' }, { id: 'robot', label: '🤖 Robot Voice' }];
  }

  const recButtons = recs.map(r =>
    `<button class="pitch-rec-btn" onclick="applyTemplate('${r.id}')">${r.label}</button>`
  ).join('');

  contentEl.innerHTML = `
    <div class="pitch-summary-stat"><span class="pitch-summary-accent">${pct}%</span> of pitches landed in ${selectedKey} major</div>
    <div class="pitch-summary-stat">Most-targeted notes: <span class="pitch-summary-accent">${topNotes}</span></div>
    <div class="pitch-summary-tip">💡 ${tip}</div>
    <div class="pitch-rec-row">${recButtons}</div>
  `;
  summaryEl.style.display = 'block';
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

    pitchSamples = [];
    const summaryEl = document.getElementById('pitchSummary');
    if (summaryEl) summaryEl.style.display = 'none';
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

  // Reset pitch coach display and show summary
  const statusEl = document.getElementById('pitchCoachStatus');
  if (statusEl) statusEl.textContent = '— awaiting signal —';
  const targetEl = document.getElementById('pitchTargetNote');
  if (targetEl) targetEl.textContent = '—';
  const centsEl = document.getElementById('pitchCentsValue');
  if (centsEl) centsEl.textContent = '0¢';
  const needleEl = document.getElementById('pitchCentsNeedle');
  if (needleEl) { needleEl.style.left = '50%'; needleEl.style.background = 'var(--accent)'; }
  const inKeyEl = document.getElementById('pitchInKey');
  if (inKeyEl) { inKeyEl.className = 'pitch-inkey'; inKeyEl.textContent = '—'; }

  showPitchSummary();
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
      const dev = getPitchDeviation(freq, selectedKey);
      if (dev) {
        updatePitchCoach(dev);
        pitchSamples.push(dev);
        if (pitchSamples.length > 600) pitchSamples.shift(); // ~48s max
      }
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
