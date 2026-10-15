// Whole pipeline on one machine: local PeerJS server <- host (child process, ffmpeg test pattern) <- simulated headset (real PeerJS client + native WebRTC receiver)
import { spawn, execSync } from 'node:child_process';
import { PeerServer } from 'peer';
import { SafePC, RTCSessionDescription, RTCIceCandidate } from '../src/webrtc-shim.js';
import nd from 'node-datachannel';
import WebSocket from 'ws';
Object.assign(globalThis, { RTCPeerConnection: SafePC, RTCSessionDescription, RTCIceCandidate, WebSocket });
const { Peer } = (await import('peerjs')).default ? { Peer: (await import('peerjs')).default.Peer || (await import('peerjs')).default } : await import('peerjs');

PeerServer({ port: 9101, path: '/', host: '0.0.0.0' });
const env = { ...process.env, VROS_PEER_HOST: '127.0.0.1', VROS_PEER_PORT: '9101', VROS_SOURCE: 'test', VROS_ENCODER: 'libx264', VROS_AUTOAPPROVE: '1', VROS_UI_PORT: '8766', VROS_CODE: 'TEST42', VROS_DEBUG: '1', VROS_NO_STUN: '1' };
const host = spawn(process.execPath, [...(process.env.VROS_NODEFLAGS || '').split(' ').filter(Boolean), 'src/main.js', '--no-open'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (m) => { console.log('FAIL:', m); host.kill(); process.exit(1); };
setTimeout(() => fail('timeout'), 45000).unref();

let ok = false;
for (let i = 0; i < 40 && !ok; i++) { try { ok = (await (await fetch('http://127.0.0.1:8766/state')).json()).state === 'waiting'; } catch { /* not up yet */ } await sleep(250); }
if (!ok) fail('host did not become ready');

const opts = { host: '127.0.0.1', port: 9101, path: '/', secure: false, debug: +(process.env.PJDEBUG || 0), config: { iceServers: [] } };
const phone = new Peer(undefined, opts);
await new Promise((r) => phone.on('open', r));
let conn, attempts = 0, opened = false;
let rtp = 0, frames = 0, idr = 0, input = 0;
const keep = [];
const rx = new nd.PeerConnection('rx', { iceServers: [] });
rx.onTrack((t) => { keep.push(t); t.setMediaHandler(new nd.RtcpReceivingSession()); t.onOpen(() => {}); t.onMessage((b) => { rtp++; if (b[1] & 0x80) frames++; const n = b[12] & 0x1f; if (n === 5 || n === 7 || (n === 28 && (b[13] & 0x1f) === 5 && (b[13] & 0x80))) idr++; }); });
rx.onLocalDescription((sdp, type) => { if (type === 'answer') conn.send({ t: 'answer', sdp }); });
rx.onLocalCandidate((c, mid) => conn.send({ t: 'ice', c, mid }));
let rxSet = false; const rxLate = [];
// The simulated headset is a libdatachannel peer, which (unlike a browser) sometimes loses the first PeerJS data link in this 1-CPU sandbox: retry like a user would.
function connectHeadset() {
  attempts++;
  const c = (conn = phone.connect('vros-TEST42', { reliable: true }));
  c.on('data', (d) => {
    if (d.t === 'offer') { rx.setRemoteDescription(d.sdp, 'offer'); rxSet = true; rxLate.forEach((x) => rx.addRemoteCandidate(x.c, x.mid)); }
    else if (d.t === 'ice') { if (rxSet) rx.addRemoteCandidate(d.c, d.mid); else rxLate.push(d); }
  });
  c.on('open', () => { opened = true; setInterval(() => { if (c.open) { c.send({ t: 'move', x: 0.5, y: 0.5 }); input++; } }, 100).unref(); });
  c.on('error', () => {});
}
phone.on('error', (e) => { if (e.type === 'webrtc' && !opened && attempts < 6) setTimeout(connectHeadset, 300); });
connectHeadset();

// controller link (role joy) must be accepted without approval
let joyOpen = !!process.env.NOJOY;
if (!joyOpen) {
  const joyPeer = new Peer(undefined, opts); await new Promise((r) => joyPeer.on('open', r));
  let ja = 0;
  const joyConnect = () => { ja++; joyPeer.connect('vros-TEST42', { metadata: { role: 'joy' } }).on('open', () => { joyOpen = true; }); };
  joyPeer.on('error', (e) => { if (e.type === 'webrtc' && !joyOpen && ja < 6) setTimeout(joyConnect, 300); });
  joyConnect();
}

await sleep(7000);
const st = await (await fetch('http://127.0.0.1:8766/state')).json();
const rss = (pid) => +execSync(`ps -o rss= -p ${pid}`).toString().trim() / 1024;
let kids = []; try { kids = execSync(`pgrep -P ${host.pid}`).toString().trim().split('\n'); } catch { /* none */ }
const hostMB = rss(host.pid), ffMB = kids.reduce((a, p) => a + rss(p), 0);
const noHeader = await fetch('http://127.0.0.1:8766/quit', { method: 'POST' });
console.log(`attempts=${attempts} state=${st.state} encoder=${st.streaming && st.streaming.encoder} | received rtp=${rtp} frames=${frames} idr=${idr} | joyLink=${joyOpen}/${st.joy.links} | inputMsgs=${input}`);
console.log(`RAM: host(node)=${hostMB.toFixed(0)} MB + ffmpeg=${ffMB.toFixed(0)} MB (test-pattern, libx264 software encoder)`);
console.log('POST without X-VROS header ->', noHeader.status);
await fetch('http://127.0.0.1:8766/quit', { method: 'POST', headers: { 'X-VROS': '1' } });
await sleep(800);
let alive = true; try { process.kill(host.pid, 0); } catch { alive = false; }
const good = frames > 60 && idr > 0 && joyOpen && st.state === 'streaming' && noHeader.status === 404 && !alive;
console.log(good ? 'PASS' : 'FAIL', '| host exited after /quit:', !alive);
process.exit(good ? 0 : 1);
