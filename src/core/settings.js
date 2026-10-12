export const settings = {
  ipd: 0.064,        // metres between eye cameras
  fov: 90,           // vertical FOV, degrees
  k1: 0.22,          // barrel distortion coefficients
  k2: 0.24,
  lens: 0,           // multiplier on k1/k2 (0 = no warping; raise only if your lenses need it)
  pr: 2,             // max pixel ratio (1 / 1.25 / 1.5 / 2)
  scaleMode: 'auto', // 'auto' (dynamic resolution) or a fixed render scale
  scale: 1,          // current render scale
  minScale: 0.7,     // floor for dynamic resolution
  aa: 0,             // MSAA samples (0 / 2 / 4)
  sharpen: 0.25,     // 0..1 sharpening in the distortion pass
  dwell: 1.2,        // seconds of gaze to click
  smooth: 25,        // head low-pass rate (higher = snappier)
  orient: null,      // sensor axis fix override (null = auto)
  debug: false,
};

const KEYS = ['pr', 'scaleMode', 'minScale', 'aa', 'sharpen', 'fov', 'ipd', 'lens', 'dwell'];

export function loadSettings() {
  try {
    const j = JSON.parse(localStorage.getItem('vros.settings') || '{}');
    if (j.v !== 2) { delete j.lens; delete j.pr; delete j.sharpen; } // older saves: drop the old warp/low-res defaults
    KEYS.forEach((k) => { if (j[k] !== undefined) settings[k] = j[k]; });
  } catch { /* storage unavailable or corrupt */ }
  settings.scale = settings.scaleMode === 'auto' ? 1 : settings.scaleMode;
}

export function saveSettings() {
  try { localStorage.setItem('vros.settings', JSON.stringify({ v: 2, ...Object.fromEntries(KEYS.map((k) => [k, settings[k]])) })); } catch { /* storage unavailable */ }
}
