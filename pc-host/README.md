# VR OS PC host (simple version)

Streams your PC screen to the VR OS **PC Stream** app. Needs Chrome or Edge on the PC and internet access on both devices
(PeerJS cloud is used only to pair; video then goes directly between devices, ideally over your Wi-Fi).

1. Open `index.html` in Chrome/Edge. If screen capture is blocked, run `python -m http.server 8080` in this folder and open http://localhost:8080 instead.
2. Choose resolution/bitrate (720p / 4 Mbps is best for iPhone 7), click **Share my screen**, pick the screen, and note the 6-character code.
3. On the phone start screen, type the code, tap **Enter VR**, then gaze at **PC Stream**. Gaze at **Reconnect** to retry.

Limits: no mouse/keyboard control yet (a browser page cannot move the OS mouse; that needs a native helper). No audio. Strict NATs without TURN may fail to connect.
