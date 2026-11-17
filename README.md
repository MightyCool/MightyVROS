# MightyVR (stage 1: stereo + head tracking + gaze launcher)

Browser MightyVR for iPhone 7 + Cardboard-style headset. No WebXR: manual side-by-side stereo with barrel distortion.

## Deploy to GitHub Pages
1. Create a new GitHub repo (e.g. `mightyvr`) and push this folder to its `main` branch.
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

## Settings / camera notes
- Settings app: resolution, render scale, anti-aliasing, sharpen, FOV, IPD, gaze click time, 12/24-hour clock, passthrough camera + size.
- No software lens warping: your headset lenses do the distortion.
- Passthrough ("Camera" button on the home panel or Settings): rear camera behind the UI, same image in both eyes (no depth). Needs camera permission.

## Hand tracking
- Settings > Input > Hand tracking (uses the rear camera; MediaPipe Hands lite model, self-hosted, cached on first use, about 19 MB).
- Pinch thumb + index to select; pinch and drag to scroll the browser page. While your fingers close, the pointer holds still and only follows your knuckles, so clicks land where you aimed.
- Light on the phone: 30 inferences a second while a hand is tracked, 10 a second while searching, automatically fewer if rendering dips under 50 fps or inference is slow; the camera runs at 540p.
- The glove hand can be hidden (Settings > Input > Show hand model). "Camera field of view" lines the glove up with passthrough.

## AR Game
Opens with the camera on (passthrough) and hand tracking started. Look slowly around you: dots turn green as directions are scanned (this maps directions only; iPhone Safari has no depth or surface sensing, so targets float rather than sit on real surfaces).
Then pinch, pull your hand back toward your face to draw, and release to shoot. Without hand tracking, look at a target for about half a second and an arrow flies at it.

## Pixel scale
Home menu and Settings > Display. 2x is the iPhone 7's native resolution; higher values supersample (sharper, heavier). Auto render scale still lowers the load if the frame rate drops.

## PC host
- **Windows installer (recommended, low RAM):** `pc-host-app/` builds `MightyVR-Host-Setup.exe` through GitHub Actions (tag `host-v1.0.0`). See `pc-host-app/README.md`.
- Older Chrome-based host with audio: `pc-host/`.

## Selecting with your hand
- Hand: pinch thumb + index (the glove shows a cyan fingertip when it registers).
- The pointer dot has a small aim-assist cone (about 1.7 degrees), because hand aim is shaky.
