# VR OS Host (Windows installer, low RAM)

A small background program that streams your PC screen to the VR OS headset app, lets the headset move the mouse and type,
and relays Joy-Con controllers. It replaces the Chrome tab of the older `pc-host` folder (still there if you need audio or macOS/Linux).

## Install
1. Open this repo's **Releases** page and download `VR-OS-Host-Setup.exe` (see "Building the installer" if there is none yet).
2. Run it (no admin rights needed). Tick "Start with Windows" if you want it always available.
3. Windows Firewall may ask about `node.exe` the first time: allow **Private networks** (video travels directly to the phone over your Wi-Fi).

## Use
1. Start Menu > **VR OS Host**. A small page opens with a 6-character code (you can close the tab; the host keeps running).
2. On the headset start screen type the code, tap Enter VR, open **PC Stream**.
3. Click **Allow** on the PC page when the headset asks. Resolution/bitrate are on that page (720p, 4 Mbps suits an iPhone 7).
4. Start Menu > **Stop VR OS Host** (or the Quit button) when done.

## What it uses
- Memory: about 100 MB for the program + 40 to 90 MB for the video encoder process (ffmpeg). Measured on a Linux test machine with the software encoder; on Windows it tries a hardware encoder first (NVENC, Quick Sync, AMF) which uses less.
- Capture and encoding: bundled ffmpeg, primary monitor, H.264 baseline (hardware decoded on iPhone), no audio.
- Remote control: mouse and keyboard through Windows `user32`. Windows only.
- Joy-Cons: pair them to this PC by Bluetooth. Read over HID, fused to an orientation, sent to the headset's Controllers app. The host also reads each Joy-Con's own body colour (so the camera can find it with no calibration; grey or white Joy-Cons still need the manual colour step). Only this installer app reads the colour, not the older Python host.
- Pairing: PeerJS cloud is used only to introduce the two devices; video and control then go directly over your network. Every headset must be approved on the PC.

## Not included
Audio (use the old Chrome host for sound), multiple monitors (primary only), macOS/Linux installer (the program runs there with `npm start`, streaming only).

## Building the installer
Push a tag such as `host-v1.0.0` (or run the **Build PC host installer** workflow by hand): GitHub Actions builds `VR-OS-Host-Setup.exe` on a Windows runner and attaches it to the release.
Locally on Windows: install Node 22 and Inno Setup 6, then run `installer\build.ps1`.

## Tests (any OS)
`npm install && npm test` runs the filter maths, the Joy-Con report parser, a capture-to-RTP smoke test and a full loopback
(local PeerJS server, host process, simulated headset). The simulated headset is a Node WebRTC peer, which occasionally fails its first
data link on a 1-CPU machine; the test retries it. Not covered: real Windows screen capture, input injection, Joy-Con hardware, the installer itself.
