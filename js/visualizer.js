// ─── Visualizer & Waveform ────────────────────────────────────────────────────
// Frequency-spectrum bar chart during recording/playback; idle sine wave otherwise.

let vizCanvas = null;
let vizCtx    = null;

function initVisualizer() {
  vizCanvas = document.getElementById('visualizer');
  vizCtx    = vizCanvas.getContext('2d');
  resizeViz();
  window.addEventListener('resize', resizeViz);
  drawViz();
}

function resizeViz() {
  vizCanvas.width  = vizCanvas.offsetWidth  * devicePixelRatio;
  vizCanvas.height = vizCanvas.offsetHeight * devicePixelRatio;
  vizCtx.scale(devicePixelRatio, devicePixelRatio);
}

function drawViz() {
  const w = vizCanvas.offsetWidth;
  const h = vizCanvas.offsetHeight;

  vizCtx.clearRect(0, 0, w, h);
  vizCtx.fillStyle = '#0d1425';
  vizCtx.fillRect(0, 0, w, h);

  if (analyserNode) {
    // ── Frequency bars ──────────────────────────────
    const freqData = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(freqData);

    const bars = 80;
    const step = Math.floor(freqData.length / bars);
    const bw   = w / bars;

    for (let i = 0; i < bars; i++) {
      const v    = freqData[i * step] / 255;
      const barH = v * h * 0.9;
      const hue  = 180 + i * 1.5;
      vizCtx.fillStyle = `hsla(${hue},100%,${50 + v * 30}%,${0.6 + v * 0.4})`;
      vizCtx.fillRect(i * bw + 1, h - barH, bw - 2, barH);
    }
  } else {
    // ── Idle animated sine wave ──────────────────────
    vizCtx.strokeStyle = 'rgba(0,245,255,0.2)';
    vizCtx.lineWidth   = 1.5;
    vizCtx.beginPath();
    const t = Date.now() / 1000;
    for (let x = 0; x < w; x++) {
      const y = h / 2
        + Math.sin(x * 0.03 + t * 2) * 8
        + Math.sin(x * 0.07 + t)     * 4;
      x === 0 ? vizCtx.moveTo(x, y) : vizCtx.lineTo(x, y);
    }
    vizCtx.stroke();
  }

  requestAnimationFrame(drawViz);
}

// ─── Mini Waveform (static, drawn once after mix is ready) ───────────────────
function drawWaveformMini(buf) {
  const canvas = document.getElementById('waveformMini');
  canvas.width  = canvas.offsetWidth  * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;

  const ctx  = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w    = canvas.offsetWidth;
  const h    = canvas.offsetHeight;
  const data = buf.getChannelData(0);
  const step = Math.floor(data.length / w);

  ctx.fillStyle = '#0d1425';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,245,255,0.7)';
  ctx.lineWidth   = 1;
  ctx.beginPath();

  for (let x = 0; x < w; x++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = data[x * step + j] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(x, (1 + min) * h / 2);
    ctx.lineTo(x, (1 + max) * h / 2);
  }

  ctx.stroke();
}
