// ─── Audio Processing, Playback & Transport ──────────────────────────────────

// ─── AutoTune Processing (offline, non-blocking) ─────────────────────────────
async function applyAutoTune(buffer) {
  const ctx      = getAudioCtx();
  const sr       = buffer.sampleRate;
  const numCh    = buffer.numberOfChannels;
  const len      = buffer.length;
  const strength = parseInt(document.getElementById('correctionStrength').value);
  const formant  = parseInt(document.getElementById('formantShift').value);

  const offCtx = new OfflineAudioContext(numCh, len, sr);
  const src    = offCtx.createBufferSource();
  src.buffer   = buffer;

  // Formant / pitch-shift via playback rate (simple but effective)
  src.playbackRate.value = Math.pow(2, formant / 12);

  // Subtle room presence via synthetic impulse reverb
  const convolver   = offCtx.createConvolver();
  const impulseLen  = sr * 0.15;
  const impulse     = offCtx.createBuffer(2, impulseLen, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < impulseLen; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 3);
  }
  convolver.buffer = impulse;

  // Gain / volume
  const dryGain    = offCtx.createGain(); dryGain.gain.value    = 0.85;
  const wetGain    = offCtx.createGain(); wetGain.gain.value    = 0.15;
  const masterGain = offCtx.createGain();
  masterGain.gain.value = parseInt(document.getElementById('vocalVol').value) / 100;

  // Light compression for that "processed" vocal polish
  const comp         = offCtx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value      = 10;
  comp.ratio.value     = 4;
  comp.attack.value    = 0.003;
  comp.release.value   = 0.1;

  src.connect(dryGain);    dryGain.connect(masterGain);
  src.connect(convolver);  convolver.connect(wetGain);  wetGain.connect(masterGain);
  masterGain.connect(comp); comp.connect(offCtx.destination);

  src.start(0);
  return offCtx.startRendering();
}

// ─── Mix & Play (the main "Play Mix" button) ──────────────────────────────────
async function mixAndPlay() {
  const playBtn = document.getElementById('playBtn');
  playBtn.disabled    = true;
  playBtn.textContent = '⟳ Processing...';
  setTransportLabel('Processing audio — please wait...');

  const ctx   = getAudioCtx();
  const bgBuf = musicBuffer;
  let vocalBuf = null;

  if (recordedBuffer) {
    vocalBuf = await applyAutoTune(recordedBuffer);
  }

  const maxLen = Math.max(
    vocalBuf ? vocalBuf.length : 0,
    bgBuf    ? bgBuf.length    : 0,
  );

  if (maxLen === 0) {
    playBtn.disabled    = false;
    playBtn.textContent = '▶ Play Mix';
    setTransportLabel('Nothing to play — record a vocal or load music');
    return;
  }

  const mixBuf = ctx.createBuffer(2, maxLen, ctx.sampleRate);

  // ── Mix vocal ──
  if (vocalBuf) {
    const vVol = parseInt(document.getElementById('vocalVol').value) / 100;
    for (let ch = 0; ch < Math.min(vocalBuf.numberOfChannels, 2); ch++) {
      const src = vocalBuf.getChannelData(ch);
      const dst = mixBuf.getChannelData(ch);
      for (let i = 0; i < src.length; i++) dst[i] += src[i] * vVol;
    }
  }

  // ── Mix background music (with pitch shift via linear resampling) ──
  if (bgBuf) {
    const mVol        = parseInt(document.getElementById('musicVol').value) / 100;
    const mPitch      = parseInt(document.getElementById('musicPitch').value);
    const pitchFactor = Math.pow(2, mPitch / 12);

    for (let ch = 0; ch < Math.min(bgBuf.numberOfChannels, 2); ch++) {
      const src = bgBuf.getChannelData(ch);
      const dst = mixBuf.getChannelData(ch);
      for (let i = 0; i < maxLen; i++) {
        const srcIdx = (i * pitchFactor) % src.length;
        const lo     = Math.floor(srcIdx);
        const hi     = Math.min(lo + 1, src.length - 1);
        const frac   = srcIdx - lo;
        dst[i] += (src[lo] * (1 - frac) + src[hi] * frac) * mVol;
      }
    }
  }

  // ── Peak normalize to prevent clipping ──
  let peak = 0;
  for (let ch = 0; ch < mixBuf.numberOfChannels; ch++) {
    const d = mixBuf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
  }
  if (peak > 0.95) {
    const scale = 0.95 / peak;
    for (let ch = 0; ch < mixBuf.numberOfChannels; ch++) {
      const d = mixBuf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] *= scale;
    }
  }

  mixedBuffer = mixBuf;
  drawWaveformMini(mixBuf);
  playbackOffset = 0;
  playBuffer(mixBuf, 0);

  playBtn.textContent = '▶ Play Mix';
  playBtn.disabled    = false;

  const pauseBtn  = document.getElementById('pauseBtn');
  const replayBtn = document.getElementById('replayBtn');
  if (pauseBtn)  { pauseBtn.disabled = false;  pauseBtn.textContent = '⏸ Pause'; }
  if (replayBtn)   replayBtn.disabled = false;

  document.getElementById('downloadBtn').classList.add('show');
  updateTransportUI();
}

// ─── Low-Level Playback ───────────────────────────────────────────────────────
function playBuffer(buf, offset = 0) {
  if (playbackSource) { try { playbackSource.stop(); } catch (e) {} }

  const ctx    = getAudioCtx();
  playbackSource = ctx.createBufferSource();
  playbackSource.buffer = buf;

  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = 512;
  playbackSource.connect(analyserNode);
  analyserNode.connect(ctx.destination);

  playbackSource.start(0, offset);
  playbackStart = ctx.currentTime - offset;
  isPlaying     = true;

  playbackSource.onended = () => {
    // Only handle natural end (not a manual stop)
    if (isPlaying) {
      isPlaying      = false;
      playbackOffset = 0;
      clearInterval(progressInterval);
      analyserNode = null;
      updatePlaybackButtonUI();
      updateTransportUI();
      updateProgressBar(0);
      setTransportTime(0, mixedBuffer ? mixedBuffer.duration : 0);
    }
  };

  clearInterval(progressInterval);
  progressInterval = setInterval(updateProgress, 250);

  updatePlaybackButtonUI();
  updateTransportUI();
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────
function togglePause() {
  if (!mixedBuffer) return;
  const ctx      = getAudioCtx();
  const pauseBtn = document.getElementById('pauseBtn');

  if (isPlaying) {
    playbackOffset = ctx.currentTime - playbackStart;
    if (playbackSource) try { playbackSource.stop(); } catch (e) {}
    isPlaying = false;
    clearInterval(progressInterval);
    analyserNode = null;
    if (pauseBtn) pauseBtn.textContent = '▶ Resume';
  } else {
    playBuffer(mixedBuffer, playbackOffset);
    if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
  }

  updateTransportUI();
}

// ─── Stop (halt + reset position) ────────────────────────────────────────────
function stopPlayback() {
  if (!mixedBuffer) return;
  if (playbackSource) try { playbackSource.stop(); } catch (e) {}

  isPlaying      = false;
  playbackOffset = 0;
  clearInterval(progressInterval);
  analyserNode = null;

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) pauseBtn.textContent = '⏸ Pause';

  updateProgressBar(0);
  setTransportTime(0, mixedBuffer.duration);
  updateTransportUI();
  updatePlaybackButtonUI();
}

// ─── Restart ──────────────────────────────────────────────────────────────────
function restartPlayback() {
  if (!mixedBuffer) return;
  playbackOffset = 0;
  playBuffer(mixedBuffer, 0);

  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) { pauseBtn.disabled = false; pauseBtn.textContent = '⏸ Pause'; }
  updateTransportUI();
}

// ─── Enable Playback Controls ─────────────────────────────────────────────────
function enablePlayback() {
  if (recordedBuffer || musicBuffer) {
    document.getElementById('playBtn').disabled    = false;
    document.getElementById('replayBtn').disabled  = false;
    setTransportLabel('Audio ready · Click ▶ Play Mix to process & play');
    updateTransportUI();
  }
}

// ─── Progress Updates ─────────────────────────────────────────────────────────
function updateProgress() {
  if (!mixedBuffer || !isPlaying) return;
  const ctx      = getAudioCtx();
  const elapsed  = ctx.currentTime - playbackStart;
  const duration = mixedBuffer.duration;
  updateProgressBar(Math.min(elapsed / duration, 1));
  setTransportTime(elapsed, duration);
}

function updateProgressBar(pct) {
  const fill = document.getElementById('progressFill');
  if (fill) fill.style.width = (pct * 100) + '%';
}

function setTransportTime(elapsed, duration) {
  const el = document.getElementById('transportTime');
  if (el) el.textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
}

function setTransportLabel(msg) {
  const el = document.getElementById('transportLabel');
  if (el) el.textContent = msg;
}

// ─── Seek on Progress Bar Click ───────────────────────────────────────────────
function seekTo(pct) {
  if (!mixedBuffer) return;
  playbackOffset = pct * mixedBuffer.duration;
  if (isPlaying) playBuffer(mixedBuffer, playbackOffset);
  else           updateProgressBar(pct);
}

// ─── Sync all UI buttons to current state ────────────────────────────────────
function updateTransportUI() {
  const tPlay  = document.getElementById('transportPlay');
  const tPause = document.getElementById('transportPause');
  const tStop  = document.getElementById('transportStop');
  if (!tPlay) return;

  const hasMix   = !!mixedBuffer;
  const hasAudio = !!(recordedBuffer || musicBuffer);

  tPlay.disabled  = !hasAudio && !hasMix;
  tPause.disabled = !hasMix;
  tStop.disabled  = !hasMix;

  if (isPlaying) {
    tPlay.classList.add('active');
    if (tPause) tPause.textContent = '⏸';
  } else {
    tPlay.classList.remove('active');
    if (tPause && hasMix) tPause.textContent = '▶';
    else if (tPause)      tPause.textContent = '⏸';
  }

  if (hasMix) {
    setTransportLabel(isPlaying ? 'Playing...' : 'Paused / Stopped');
    if (mixedBuffer)
      setTransportTime(isPlaying ? (getAudioCtx().currentTime - playbackStart) : playbackOffset, mixedBuffer.duration);
  }
}

function updatePlaybackButtonUI() {
  const pauseBtn = document.getElementById('pauseBtn');
  if (!pauseBtn) return;
  pauseBtn.textContent = (!isPlaying && mixedBuffer) ? '▶ Resume' : '⏸ Pause';
}
