# VR OS (stage 1: stereo + head tracking + gaze launcher)

Browser VR OS for iPhone 7 + Cardboard-style headset. No WebXR: manual side-by-side stereo with barrel distortion.

## Deploy to GitHub Pages
1. Create a new GitHub repo (e.g. `vr-os`) and push this folder to its `main` branch.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or Actions tab → "Deploy to GitHub Pages" → Run workflow). Wait for green.
4. On the iPhone open `https://<user>.github.io/<repo>/` in Safari (HTTPS is required for motion sensors).
5. Share → **Add to Home Screen**, launch from the icon (standalone = no Safari bars), rotate to landscape, tap **Enter VR**, allow motion access.

Pull requests run lint + build (`.github/workflows/ci.yml`).

## Local dev
`npm ci && npm run dev` (plain HTTP: motion sensors won't work off-localhost on iOS; use drag-to-look, or test on Pages).

## Controls
- Gaze at an icon ~1.2 s to click. **Recenter** / **Debug** buttons on the home panel. Two-finger tap = FPS overlay (or `?debug`).
- Dynamic resolution drops render scale (min 50%) if FPS < 45. Pixel ratio capped at 1.5.

## Not yet (later stages)
PC stream (2), hand tracking (3), Settings/Browser/AR apps, audio, NoSleep (4).

## Settings / camera notes
- Settings app: resolution, render scale, anti-aliasing, sharpen, FOV, IPD, gaze click time, 12/24-hour clock, passthrough camera + size.
- No software lens warping: your headset lenses do the distortion.
- Passthrough ("Camera" button on the home panel or Settings): rear camera behind the UI, same image in both eyes (no depth). Needs camera permission.

## Hand tracking and controllers
- **Hand tracking** (Settings > Input > Hand tracking): MediaPipe Hands (lite model), self-hosted and cached on first use (~19 MB, copied from `node_modules` at build time).
  Hold a hand in front of the phone's rear camera: pinch (thumb + index) to click, pinch and drag to scroll the browser page.
  The cursor sits at the pinch point. Gaze still works whenever no hand is seen. Set "Camera field of view" so the hand lines up with the passthrough image.
- **Joy-Cons**: see pc-host/README.md. Open the **Controllers** app to link, calibrate colour (camera) and pose (gravity), then use ZR/R (right) or ZL/L (left) to click and the stick to scroll.

## PC host
- **Windows installer (recommended, low RAM):** `pc-host-app/` builds `VR-OS-Host-Setup.exe` through GitHub Actions (tag `host-v1.0.0`). See `pc-host-app/README.md`.
- Older Chrome-based host with audio: `pc-host/`.
