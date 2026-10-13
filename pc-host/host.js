/* VR OS PC host: streams the screen to the headset phone (WebRTC, PeerJS cloud only for pairing)
   and forwards the headset's mouse/keyboard messages to the local helper (host.py). */
const $ = (id) => document.getElementById(id);
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
const say = (s) => { $('status').textContent = s; };
let stream = null, peer = null, call = null, approved = null, helper = false;
const joyConns = new Set(); // headsets that only want Joy-Con data (role: 'joy')

// Relay Joy-Con state from host.py to every joy connection (~60 Hz)
setInterval(() => {
  if (!joyConns.size) return;
  fetch('/joy').then((r) => r.json()).then((j) => {
    for (const s of ['L', 'R']) if (j[s]) joyConns.forEach((c) => { if (c.open) c.send({ t: 'joy', s, ...j[s] }); });
  }).catch(() => {});
}, 16);

fetch('/ping').then((r) => r.text()).then((t) => { helper = t === 'ok'; }).catch(() => {}).finally(() => {
  $('ctrl').textContent = helper
    ? 'Remote control: ready (the headset can move the mouse and type once you click Allow).'
    : 'Remote control: OFF. Run "python host.py" and open http://localhost:8765 to enable it (viewing still works).';
});

const postInput = (m) => fetch('/input', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-VROS': '1' }, body: JSON.stringify(m),
}).catch(() => {});

// Prefer H.264 (hardware-decoded on iPhone) and cap the bitrate.
function preferH264(sdp) {
  const lines = sdp.split('\r\n');
  const mi = lines.findIndex((l) => l.startsWith('m=video'));
  if (mi < 0) return sdp;
  const h264 = [];
  lines.forEach((l) => { const m = l.match(/^a=rtpmap:(\d+) H264\//); if (m) h264.push(m[1]); });
  if (h264.length) {
    const parts = lines[mi].split(' ');
    const pts = parts.slice(3);
    lines[mi] = parts.slice(0, 3).concat(h264.filter((p) => pts.includes(p)), pts.filter((p) => !h264.includes(p))).join(' ');
  }
  const ci = lines.findIndex((l, i) => i > mi && l.startsWith('c='));
  if (ci > 0) lines.splice(ci + 1, 0, 'b=AS:' + $('kbps').value);
  return lines.join('\r\n');
}

function register() {
  if (peer) peer.destroy();
  const code = randCode();
  peer = new Peer('vros-' + code);
  peer.on('open', () => { $('code').textContent = code; say('Waiting for the headset. Type this code on the phone start screen, then open PC Stream.'); });
  peer.on('disconnected', () => peer.reconnect());
  peer.on('error', (e) => { if (e.type === 'unavailable-id') register(); else say('Signaling error: ' + e.type); });
  peer.on('connection', (conn) => {
    if (conn.metadata && conn.metadata.role === 'joy') { // controller data only: no screen, no control, so no approval needed
      conn.on('open', () => { joyConns.add(conn); say('Controller link connected.'); });
      conn.on('close', () => joyConns.delete(conn));
      return;
    }
    conn.on('open', () => {
      // Anyone who learns the code could otherwise watch/control the PC, so every headset must be approved here.
      $('who').textContent = conn.peer.slice(-6);
      $('approve').hidden = false;
      $('allow').onclick = () => {
        $('approve').hidden = true;
        approved = conn;
        if (call) call.close();
        call = peer.call(conn.peer, stream, { sdpTransform: preferH264 });
        call.on('close', () => say('Headset disconnected. Open PC Stream again to reconnect.'));
        say('Headset connected. Streaming.');
      };
      $('deny').onclick = () => { $('approve').hidden = true; conn.close(); };
    });
    conn.on('data', (d) => { if (approved === conn && helper) postInput(d); });
  });
}

$('share').addEventListener('click', async () => {
  try {
    const [w, h] = $('res').value.split('x').map(Number);
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) { say('Screen capture failed: ' + e.message); return; }
  const track = stream.getVideoTracks()[0];
  track.contentHint = 'detail';
  track.onended = () => say('Screen sharing stopped.');
  $('pv').srcObject = stream;
  say(stream.getAudioTracks().length ? 'Sharing screen + audio.' : 'Sharing screen (no audio: tick "Share system audio" in the picker, choose Entire Screen).');
  register();
});
