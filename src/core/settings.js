export const settings = {
  ipd: 0.064,   // metres between eye cameras
  fov: 90,      // vertical FOV, degrees
  k1: 0.22,     // barrel distortion coefficients
  k2: 0.24,
  scale: 1,     // dynamic render scale (managed by main loop)
  dwell: 1.2,   // seconds of gaze to click
  smooth: 25,   // head low-pass rate (higher = snappier)
  orient: null, // sensor axis fix override (null = auto)
  debug: false,
};
