/* VR OS PC host: captures the screen and streams it to the headset phone over WebRTC (PeerJS cloud for pairing only). */
const $ = (id) => document.getElementById(id);
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
const say = (s) => { $('status').textContent = s; };
let stream = null, peer = null, call = null;

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
    conn.on('open', () => {
      if (call) call.close();
      call = peer.call(conn.peer, stream, { sdpTransform: preferH264 });
      call.on('close', () => say('Headset disconnected. Open PC Stream again to reconnect.'));
      say('Headset connected. Streaming.');
    });
  });
}

$('share').addEventListener('click', async () => {
  try {
    const [w, h] = $('res').value.split('x').map(Number);
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } }, audio: false,
    });
  } catch (e) { say('Screen capture failed: ' + e.message + ' (if opened as a file, use: python -m http.server 8080 and open http://localhost:8080)'); return; }
  const track = stream.getVideoTracks()[0];
  track.contentHint = 'detail';
  track.onended = () => say('Screen sharing stopped.');
  $('pv').srcObject = stream;
  register();
});
