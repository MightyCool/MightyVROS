# VR OS PC host

Streams your PC screen (and audio) to the VR OS **PC Stream** app and lets the headset move the mouse, click, scroll and type.
This is how you get a full browser (YouTube etc.) in VR: run Chrome on the PC, control it from the headset.

## Setup (once)
1. Install Python 3 and run `pip install pyautogui`.
   (macOS: allow Terminal/Python under System Settings > Privacy > Accessibility and Screen Recording.)

## Every time
1. In this folder run `python host.py`, then open **http://localhost:8765** in Chrome or Edge.
2. Pick resolution/bitrate (720p / 4 Mbps suits the iPhone 7), click **Share my screen**, choose **Entire Screen** (your main monitor)
   and tick **Share system audio**. Note the 6-character code.
3. On the phone start screen type the code, tap **Enter VR**, gaze at **PC Stream**.
4. Click **Allow** on the PC page when the headset asks. Open Chrome on the PC and go to YouTube.

## Using it in VR
- Move your head: the PC mouse follows your gaze. Hold still ~1 s: the ring shrinks and clicks.
- Look at the far right edge: top half scrolls up, bottom half scrolls down.
- **⌨ Keys** shows a gaze keyboard (0.7 s per key) for search boxes.

## Notes
- Without `host.py` (e.g. opening index.html directly) you still get view-only streaming.
- Only the approved headset can send input, and `host.py` listens on 127.0.0.1 only.
- Mouse mapping assumes you share your main monitor.
- Needs internet for PeerJS pairing; strict NATs without TURN may fail.

## Joy-Con controllers (optional)
iPhones cannot read Joy-Con motion sensors directly (no WebHID, and iOS 15 cannot even pair them), so the PC relays them.
1. `pip install joycon-python hidapi` and pair the Joy-Cons to the **PC** by Bluetooth (hold the small sync button).
2. Run `python host.py` as usual; it prints `Joy-Con L/R: connected`. Keep the host page open (sharing the screen is not required for controllers).
3. In VR open **Controllers**: link to the PC, calibrate each Joy-Con's colour and pose. See the app for the steps.
Orientation comes from the gyro + accelerometer (yaw slowly drifts: use **Zero** while pointing forward); position comes from the phone camera following the Joy-Con's colour.
