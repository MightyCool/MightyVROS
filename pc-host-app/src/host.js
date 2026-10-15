import { EventEmitter } from 'node:events';
import { SafePC, RTCSessionDescription, RTCIceCandidate } from './webrtc-shim.js';
import WebSocket from 'ws';
import { startCapture } from './capture.js';
import { VideoSender } from './stream.js';
import { createInput } from './input.js';
import { startJoycons } from './joycon.js';

// PeerJS (the same library the headset uses) runs unchanged on Node once WebRTC + WebSocket exist as globals.
Object.assign(globalThis, { RTCPeerConnection: SafePC, RTCSessionDescription, RTCIceCandidate, WebSocket });
const pm = await import('peerjs');
const Peer = pm.Peer || pm.default.Peer || pm.default;

const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randCode = () => Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
const peerOpts = process.env.VROS_PEER_HOST ? { host: process.env.VROS_PEER_HOST, port: +process.env.VROS_PEER_PORT, path: '/', secure: false } : {};
if (process.env.VROS_NO_STUN) peerOpts.config = { iceServers: [] }; // offline tests only

export class Host extends EventEmitter {
  constructor() {
    super();
    this.code = ''; this.state = 'starting'; this.log = [];
    this.settings = { width: 1280, kbps: 4000, fps: 30 };
    this.joyConns = new Set(); this.pending = null; this.session = null; this.joy = null; this.input = null;
  }

  note(s) { this.log.push(s); if (this.log.length > 6) this.log.shift(); if (process.env.VROS_DEBUG) console.log(s); }

  async start() {
    this.input = await createInput();
    if (!this.input.ok) this.note(this.input.why);
    this.joy = await startJoycons((s) => this.note(s));
    setInterval(() => this.relayJoy(), 16).unref();
    this.register();
  }

  register() {
    if (this.peer) this.peer.destroy();
    this.code = process.env.VROS_CODE || randCode();
    const peer = (this.peer = new Peer('vros-' + this.code, peerOpts));
    peer.on('open', () => { this.state = 'waiting'; this.note('Ready. Enter the code on the headset.'); });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch { /* peer already destroyed */ } });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') { this.register(); return; }
      this.state = 'error'; this.note('Pairing service: ' + e.type);
      setTimeout(() => { if (this.state === 'error') this.register(); }, 5000).unref();
    });
    peer.on('connection', (conn) => this.onConnection(conn));
  }

  onConnection(conn) {
    if (conn.metadata && conn.metadata.role === 'joy') { // controller data only: no screen, no control
      conn.on('open', () => { this.joyConns.add(conn); this.note('Controller link connected.'); });
      conn.on('close', () => this.joyConns.delete(conn));
      return;
    }
    conn.on('open', () => {
      // Anyone who learns the code could otherwise watch/control the PC, so every headset must be approved.
      if (this.pending) this.pending.close();
      this.pending = conn;
      this.note('Headset ' + conn.peer.slice(-6) + ' wants to connect.');
      if (process.env.VROS_AUTOAPPROVE === '1') this.approve();
    });
    conn.on('close', () => { if (this.pending === conn) this.pending = null; });
  }

  deny() { if (this.pending) this.pending.close(); this.pending = null; }

  async approve() {
    const conn = this.pending;
    this.pending = null;
    if (!conn || !conn.open) return;
    this.endSession();
    const sess = (this.session = { conn, sender: null, cap: null });
    sess.sender = new VideoSender((m) => { if (conn.open) conn.send(m); }, (s) => this.note(s));
    conn.on('data', (d) => {
      if (!d) return;
      if (d.t === 'answer') sess.sender.answer(d.sdp);
      else if (d.t === 'ice') sess.sender.ice(d.c, d.mid);
      else this.input.handle(d);
    });
    conn.on('close', () => { if (this.session === sess) this.endSession(); });
    sess.sender.onOpen = () => this.startCapture(sess); // encode only once the link is up: keeps the CPU free for the handshake and the first frame is a keyframe
  }

  async startCapture(sess) {
    if (sess.cap) sess.cap.stop();
    try {
      sess.cap = await startCapture({ ...this.settings, screen: this.input.screen }, (f) => sess.sender.frame(f), () => { if (this.session === sess) this.note('Capture stopped.'); });
      this.state = 'streaming'; this.note(`Streaming (${sess.cap.encoder}).`);
    } catch (e) { this.note('Capture failed: ' + e.message); if (sess.conn.open) sess.conn.send({ t: 'error', msg: e.message }); }
  }

  endSession() {
    const s = this.session;
    if (!s) return;
    this.session = null;
    if (s.cap) s.cap.stop();
    s.sender.close();
    if (s.conn.open) s.conn.close();
    this.state = 'waiting'; this.note('Headset disconnected.');
  }

  set(settings) {
    Object.assign(this.settings, {
      width: [1280, 1600, 1920].includes(+settings.width) ? +settings.width : this.settings.width,
      kbps: Math.max(1000, Math.min(20000, +settings.kbps || this.settings.kbps)),
    });
    if (this.session) this.startCapture(this.session); // apply now
  }

  relayJoy() {
    if (!this.joyConns.size || !this.joy) return;
    for (const s of ['L', 'R']) {
      const st = this.joy.states[s];
      if (st && Date.now() - st.ts < 500) for (const c of this.joyConns) if (c.open) c.send({ t: 'joy', s, ...st });
    }
  }

  status() {
    const s = this.session;
    return {
      code: this.code, state: this.state, pending: this.pending ? this.pending.peer.slice(-6) : null, log: this.log,
      streaming: s ? { encoder: s.cap && s.cap.encoder, frames: s.sender.frames, mb: +(s.sender.bytes / 1048576).toFixed(1) } : null,
      joy: { L: !!(this.joy && this.joy.states.L), R: !!(this.joy && this.joy.states.R), links: this.joyConns.size },
      control: this.input ? this.input.ok : false, settings: this.settings,
    };
  }

  quit() { this.endSession(); if (this.joy) this.joy.stop(); if (this.peer) this.peer.destroy(); }
}
