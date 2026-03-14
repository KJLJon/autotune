# AutoTune Studio — Claude Project Context

## What this project is
A browser-native autotune / pitch-correction web app built entirely with vanilla HTML, CSS, and JavaScript (no frameworks, no build step). Open `index.html` in any modern browser to run it locally.

## File structure
```
autotune/
├── index.html          # Main entry point — HTML skeleton + script tags
├── css/
│   └── styles.css      # All styles: layout, transport bar, panels, templates, tooltips
└── js/
    ├── state.js        # Global shared state variables (audioCtx, buffers, flags, etc.)
    ├── utils.js        # Pure utility functions: music theory, pitch detection, WAV encoder
    ├── templates.js    # Preset definitions (Cher, T-Pain, Screamo, etc.) + render/apply logic
    ├── visualizer.js   # Canvas frequency-spectrum visualizer + static waveform mini
    ├── recorder.js     # Microphone recording, MediaRecorder, real-time pitch detection loop
    ├── audio-engine.js # applyAutoTune, mixAndPlay, playBuffer, transport controls, progress bar
    └── ui.js           # DOMContentLoaded bootstrap — wires all event listeners
```

## Script load order matters
The scripts are loaded at the bottom of `index.html` in dependency order:
`state.js` → `utils.js` → `templates.js` → `visualizer.js` → `recorder.js` → `audio-engine.js` → `ui.js`

All files share globals; no ES modules are used (avoids CORS issues with `file://`).

## Key technical details
- **Audio engine**: Web Audio API (`AudioContext`, `OfflineAudioContext`, `MediaRecorder`)
- **Pitch detection**: Autocorrelation algorithm in `utils.js → autoCorrelate()`
- **Pitch correction**: `OfflineAudioContext` + playback-rate formant shift + dynamics compressor
- **WAV export**: Custom RIFF/PCM encoder in `utils.js → bufferToWav()`
- **No backend**: Everything runs client-side; no server required

## Templates / Presets
Defined in `js/templates.js` as the `TEMPLATES` array. Each entry has:
- `id`, `name`, `emoji`, `desc`, `tags`, `color`, `tip` (shown in toast)
- `settings`: `{ correctionStrength, correctionSpeed, formantShift, vocalVol }`

To add a new template, append an entry to `TEMPLATES`. Available `color` values: `cyan`, `pink`, `purple`, `teal`.

## Current templates
| Template       | Style                        | Strength | Speed | Formant |
|----------------|------------------------------|----------|-------|---------|
| Natural Fix    | Subtle, human-sounding       | 25%      | 4     | 0       |
| Pop Smooth     | Clean modern pop             | 75%      | 7     | 0       |
| Cher Effect    | Iconic hard pitch-snap       | 100%     | 10    | 0       |
| T-Pain         | Melodic hip-hop autotune     | 100%     | 9     | +1      |
| Robot Voice    | Extreme robotic              | 100%     | 10    | +3      |
| Gentle Glide   | Slow dreamy correction       | 50%      | 2     | 0       |
| Heavy Pop      | Modern chart pop / EDM       | 90%      | 9     | 0       |
| Country Twang  | Warm country style           | 55%      | 5     | -1      |
| Screamo        | Metal / hardcore intensity   | 100%     | 10    | +6      |

## Common dev tasks
- **Add a template**: Edit `TEMPLATES` array in `js/templates.js`
- **Change styles**: Edit `css/styles.css` (CSS custom properties at top for color palette)
- **Modify audio processing**: Edit `js/audio-engine.js → applyAutoTune()`
- **Change UI layout**: Edit `index.html` + `css/styles.css`
- **Add a slider/control**: Add HTML in `index.html`, register in `sliderDefs` in `js/ui.js`, read the value in `audio-engine.js`
