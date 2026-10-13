export const settings = {
  ipd: 0.064,        // metres between eye cameras
  fov: 90,           // vertical FOV, degrees
  pr: 2,             // max pixel ratio (1 / 1.25 / 1.5 / 2)
  scaleMode: 'auto', // 'auto' (dynamic resolution) or a fixed render scale
  scale: 1,          // current render scale
  minScale: 0.7,     // floor for dynamic resolution
  aa: 0,             // MSAA samples (0 / 2 / 4)
  sharpen: 0.25,     // 0..1 sharpening
  dwell: 1.2,        // seconds of gaze to click
  smooth: 25,        // head low-pass rate (higher = snappier)
  orient: null,      // sensor axis fix override (null = auto)
  input: 'auto',     // 'auto' (hand / controller if tracked, else gaze) or 'gaze'
  hands: false,
  controllers: false,
  camFov: 62,        // rear camera horizontal FOV, degrees (maps camera pixels to view directions)
  mirror: false,     // test: mirror each eye horizontally
  swap: false,       // test: swap left/right eye images
  clock: '12',       // status bar clock: '12' or '24' hour
  passthrough: false,
  ptSize: 'fill',    // passthrough size: 'fill' or a fraction of the view height
  debug: false,
};

const KEYS = ['pr', 'scaleMode', 'minScale', 'aa', 'sharpen', 'fov', 'ipd', 'dwell', 'clock', 'ptSize', 'input', 'camFov', 'mirror', 'swap'];

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
