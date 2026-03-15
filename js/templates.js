// ─── AutoTune Templates / Presets ────────────────────────────────────────────
// Each template maps to a named set of pitch-correction settings.
// `color` controls the card accent style: 'cyan' | 'pink' | 'purple' | 'teal'

const TEMPLATES = [
  {
    id: 'natural',
    name: 'Natural Fix',
    emoji: '🎤',
    desc: 'Subtle correction — sounds human, fixes pitch without being obvious',
    tags: ['Folk', 'Acoustic', 'Pop'],
    color: 'teal',
    tip: 'Great starting point for beginners. Your voice still sounds like you.',
    settings: { correctionStrength: 25, correctionSpeed: 4, formantShift: 0, vocalVol: 100 },
  },
  {
    id: 'popsmooth',
    name: 'Pop Smooth',
    emoji: '✨',
    desc: 'Clean, polished pop sound — solid pitch correction without robotics',
    tags: ['Pop', 'R&B'],
    color: 'cyan',
    tip: 'The most popular style in modern pop music.',
    settings: { correctionStrength: 75, correctionSpeed: 7, formantShift: 0, vocalVol: 100 },
  },
  {
    id: 'cher',
    name: 'Cher Effect',
    emoji: '🌟',
    desc: 'The iconic hard pitch-snap from "Believe" (1998) — bold robotic jumps',
    tags: ['Pop', 'Electronic'],
    color: 'pink',
    tip: 'Turn the correction all the way up and let it snap hard — that\'s the Cher effect!',
    settings: { correctionStrength: 100, correctionSpeed: 10, formantShift: 0, vocalVol: 100 },
  },
  {
    id: 'tpain',
    name: 'T-Pain',
    emoji: '🎵',
    desc: 'Heavy melodic hip-hop autotune with a warm tonal shift',
    tags: ['Hip-Hop', 'R&B'],
    color: 'pink',
    tip: 'Made famous by "Buy U a Drank". Sing in tune and let the effect do the work.',
    settings: { correctionStrength: 100, correctionSpeed: 9, formantShift: 1, vocalVol: 105 },
  },
  {
    id: 'robot',
    name: 'Robot Voice',
    emoji: '🤖',
    desc: 'Extreme robotic pitch effect — futuristic, heavily processed sound',
    tags: ['Electronic', 'Experimental'],
    color: 'purple',
    tip: 'Sing monotone for best results — the effect adds all the "melody".',
    settings: { correctionStrength: 100, correctionSpeed: 10, formantShift: 3, vocalVol: 100 },
  },
  {
    id: 'softglide',
    name: 'Gentle Glide',
    emoji: '🌊',
    desc: 'Slow, smooth correction that glides between notes — dreamy & natural',
    tags: ['Ballad', 'Soul', 'Indie'],
    color: 'teal',
    tip: 'Best for slow songs. Sounds like a very talented singer with perfect intonation.',
    settings: { correctionStrength: 50, correctionSpeed: 2, formantShift: 0, vocalVol: 100 },
  },
  {
    id: 'heavypop',
    name: 'Heavy Pop',
    emoji: '💫',
    desc: 'Prominent autotune heard in modern chart pop and EDM drops',
    tags: ['Pop', 'EDM', 'Dance'],
    color: 'cyan',
    tip: 'Sing with energy — this style is meant to sound processed and polished.',
    settings: { correctionStrength: 90, correctionSpeed: 9, formantShift: 0, vocalVol: 100 },
  },
  {
    id: 'country',
    name: 'Country Twang',
    emoji: '🤠',
    desc: 'Warm, subtle correction with a slight vocal colour shift for country style',
    tags: ['Country', 'Bluegrass'],
    color: 'teal',
    tip: 'The -1 formant shift adds warmth — pairs well with acoustic guitar.',
    settings: { correctionStrength: 55, correctionSpeed: 5, formantShift: -1, vocalVol: 100 },
  },
  {
    id: 'screamo',
    name: 'Screamo',
    emoji: '🔥',
    desc: 'Extreme pitch aggression — wide formant push and max correction for intense, distorted vocal energy',
    tags: ['Metal', 'Screamo', 'Hardcore'],
    color: 'purple',
    tip: 'Scream or sing at full intensity — the high formant adds that sharp, cutting edge. Crank the vocal volume for presence.',
    settings: { correctionStrength: 100, correctionSpeed: 10, formantShift: 6, vocalVol: 130 },
  },
];

// ─── Render Template Cards ────────────────────────────────────────────────────
function renderTemplates() {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;

  grid.innerHTML = TEMPLATES.map(t => `
    <div class="template-card template-${t.color}" id="tmpl-${t.id}">
      <div class="tmpl-emoji">${t.emoji}</div>
      <div class="tmpl-name">${t.name}</div>
      <div class="tmpl-desc">${t.desc}</div>
      <div class="tmpl-tags">${t.tags.map(tag => `<span class="tmpl-tag">${tag}</span>`).join('')}</div>
      <button class="tmpl-apply-btn" onclick="applyTemplate('${t.id}')">Apply</button>
    </div>
  `).join('');
}

// ─── Apply a Template ─────────────────────────────────────────────────────────
function applyTemplate(id) {
  const t = TEMPLATES.find(t => t.id === id);
  if (!t) return;

  const { correctionStrength, correctionSpeed, formantShift, vocalVol } = t.settings;

  function setSlider(elId, valId, val, fmt) {
    const el  = document.getElementById(elId);
    const out = document.getElementById(valId);
    if (el)  el.value = val;
    if (out) out.textContent = fmt(String(val));
  }

  setSlider('correctionStrength', 'correctionVal',   correctionStrength, v => v + '%');
  setSlider('correctionSpeed',    'speedVal',         correctionSpeed,    v => Number(v) >= 8 ? 'Fast' : Number(v) >= 4 ? 'Med' : 'Slow');
  setSlider('formantShift',       'formantVal',       formantShift,       v => (Number(v) > 0 ? '+' : '') + v);
  setSlider('vocalVol',           'vocalVolVal',      vocalVol,           v => v + '%');

  // Highlight active card
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('tmpl-' + id);
  if (card) card.classList.add('active');

  activeTemplate = id;
  showToast(`${t.emoji} ${t.name} applied — ${t.tip}`);

  // Invalidate cached mix so the next play reprocesses with new settings
  if (mixedBuffer) {
    mixedBuffer = null;
    setTransportLabel('Template changed — click ▶ to reprocess');
    updateTransportUI();
  }
}

// ─── Toast Notification ───────────────────────────────────────────────────────
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 3500);
}
