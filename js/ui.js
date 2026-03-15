// ─── UI Initialization & Event Handlers ──────────────────────────────────────
// This file wires up all DOM event listeners after the page loads.

document.addEventListener('DOMContentLoaded', () => {

  // ── Initialize subsystems ───────────────────────────────────────────────────
  initVisualizer();
  initRecorder();
  renderTemplates();
  updateScaleDisplay('C');

  // ── Slider labels ───────────────────────────────────────────────────────────
  const sliderDefs = [
    { el: 'correctionStrength', out: 'correctionVal', fmt: v => v + '%' },
    { el: 'correctionSpeed',    out: 'speedVal',       fmt: v => Number(v) >= 8 ? 'Fast' : Number(v) >= 4 ? 'Med' : 'Slow' },
    { el: 'formantShift',       out: 'formantVal',     fmt: v => (Number(v) > 0 ? '+' : '') + v },
    { el: 'vocalVol',           out: 'vocalVolVal',    fmt: v => v + '%' },
    { el: 'musicVol',           out: 'musicVolVal',    fmt: v => v + '%' },
    { el: 'musicPitch',         out: 'musicPitchVal',  fmt: v => (Number(v) > 0 ? '+' : '') + v + ' st' },
  ];
  sliderDefs.forEach(({ el, out, fmt }) => {
    const input  = document.getElementById(el);
    const output = document.getElementById(out);
    if (input && output) {
      input.addEventListener('input', () => {
        output.textContent = fmt(input.value);
        scheduleBackgroundProcess();
      });
    }
  });

  // ── Musical key selector ────────────────────────────────────────────────────
  document.getElementById('keySelector').addEventListener('click', e => {
    if (!e.target.matches('.key-btn')) return;
    document.querySelectorAll('.key-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    selectedKey = e.target.dataset.key;
    updateScaleDisplay(selectedKey);
  });

  // ── Panel 04: Playback buttons ──────────────────────────────────────────────
  document.getElementById('playBtn').addEventListener('click',   mixAndPlay);
  document.getElementById('pauseBtn').addEventListener('click',  togglePause);
  document.getElementById('replayBtn').addEventListener('click', restartPlayback);

  // ── Transport Bar (sticky top) ──────────────────────────────────────────────
  document.getElementById('transportPlay').addEventListener('click', () => {
    if (pendingBuffer || !mixedBuffer) {
      // New settings pending or no mix yet — process and play
      mixAndPlay();
    } else if (!isPlaying) {
      // Mix is current, just resume
      playBuffer(mixedBuffer, playbackOffset);
    }
  });

  document.getElementById('transportPause').addEventListener('click', togglePause);
  document.getElementById('transportStop').addEventListener('click',  stopPlayback);

  // ── Progress bar: click to seek ─────────────────────────────────────────────
  document.getElementById('progressTrack').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);
  });

  // ── Music file upload ───────────────────────────────────────────────────────
  const musicFile  = document.getElementById('musicFile');
  const musicName  = document.getElementById('musicName');
  const uploadZone = document.getElementById('uploadZone');

  async function loadMusicFile(file) {
    if (!file) return;
    musicName.textContent = '⟳ Loading: ' + file.name;
    const arr = await file.arrayBuffer();
    const ctx = getAudioCtx();
    try {
      musicBuffer           = await ctx.decodeAudioData(arr);
      musicName.textContent = '✓ ' + file.name;
      enablePlayback();
    } catch (err) {
      musicName.textContent = '✗ Could not decode — try MP3 or WAV';
    }
  }

  musicFile.addEventListener('change', e => loadMusicFile(e.target.files[0]));

  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    loadMusicFile(e.dataTransfer.files[0]);
  });

  // ── Download button ─────────────────────────────────────────────────────────
  document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!mixedBuffer) return;
    const btn       = document.getElementById('downloadBtn');
    btn.textContent = '⟳ Encoding...';
    btn.disabled    = true;

    const wav  = bufferToWav(mixedBuffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'autotune-mix.wav';
    a.click();
    URL.revokeObjectURL(url);

    btn.textContent = '⬇ Download Mixed Audio';
    btn.disabled    = false;
  });

  // ── Quick Start guide dismiss ───────────────────────────────────────────────
  document.getElementById('guideClose').addEventListener('click', () => {
    const panel = document.getElementById('guidePanel');
    panel.style.transition = 'opacity 0.3s';
    panel.style.opacity    = '0';
    setTimeout(() => { panel.style.display = 'none'; }, 300);
  });

});

// ─── Scale Display ────────────────────────────────────────────────────────────
function updateScaleDisplay(key) {
  const notes = getScaleNotes(key);
  const el    = document.getElementById('scaleNotes');
  if (el) el.innerHTML = `<strong>${key} Major:</strong> ${notes.join(' · ')}`;
}
