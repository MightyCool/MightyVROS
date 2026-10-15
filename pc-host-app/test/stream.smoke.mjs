// capture (ffmpeg testsrc) -> H.264 frames -> node-datachannel video track -> second peer counts RTP; offline, no signalling server
process.env.VROS_SOURCE = 'test'; process.env.VROS_ENCODER = 'libx264';
import nd from 'node-datachannel';
import { startCapture } from '../src/capture.js';
import { VideoSender } from '../src/stream.js';
const rx = new nd.PeerConnection('rx', { iceServers: [] });
let rtp = 0, marks = 0, idr = 0, first = Date.now();
const keep = []; rx.onTrack((t) => { keep.push(t); t.setMediaHandler(new nd.RtcpReceivingSession()); t.onOpen(() => {}); t.onMessage((b) => { rtp++; if (b[1] & 0x80) marks++; const nal = b[12] & 0x1f; if (nal === 5 || nal === 7 || (nal === 28 && (b[13] & 0x1f) === 5 && (b[13] & 0x80))) idr++; }); });
const tx = new VideoSender((m) => { if (m.t === 'offer') rx.setRemoteDescription(m.sdp, 'offer'); else if (m.t === 'ice') rx.addRemoteCandidate(m.c, m.mid); });
rx.onLocalDescription((sdp, type) => { if (type === 'answer') tx.answer(sdp); });
rx.onLocalCandidate((c, mid) => tx.ice(c, mid));
const cap = await startCapture({ width: 1280, kbps: 3000, fps: 30 }, (f) => tx.frame(f));
console.log('encoder', cap.encoder);
await new Promise((r) => setTimeout(r, 6000));
console.log(`sent frames=${tx.frames} (${(tx.bytes / 1024).toFixed(0)} KB) | received rtp=${rtp} frames(marker)=${marks} idr-ish=${idr}`);
cap.stop();
process.exit(marks > 60 && idr > 0 ? 0 : 1);
