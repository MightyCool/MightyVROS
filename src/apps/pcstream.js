import * as THREE from 'three';
import { curvedGeometry, makePanel, card, text } from '../ui/kit.js';
import { createKeyboard } from '../ui/keyboard.js';

const DWELL = 0.9; // seconds of holding the gaze still to click on the PC screen

/** PC Stream: PeerJS pairing (code from start screen) -> WebRTC video on a curved screen + remote mouse/keyboard. */
export const pcStream = {
  id: 'pc',
  name: 'PC Stream',
  icon: '🖥️',

  init(ctx) {
    Object.assign(this, { closed: false, t: 0, look: 9, ax: -1, ay: -1, dwell: 0, clicked: false, scrolling: 0, sc: 0, lastMove: 0, ctx });
    ctx.frame.visible = false;
    this.video = document.getElementById('pcv');
    this.tex = new THREE.VideoTexture(this.video);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.screen = new THREE.Mesh(curvedGeometry(4.0, 2.25, 2.9), new THREE.MeshBasicMaterial({
      map: this.tex, color: 0x000000, transparent: true, depthWrite: false,
    }));
    this.screen.position.y = 0.15;
    this.screen.userData = { interactive: true, mats: [], noDwell: true, onMove: (uv, p) => this.onMove(uv, p) };
    ctx.parent.add(this.screen);
    ctx.target(this.screen);
    this.cursor = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.032, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }));
    this.cursor.renderOrder = 50; this.cursor.visible = false;
    ctx.parent.add(this.cursor);

    this.statusPanel = makePanel({ w: 2.2, h: 0.3, r: 2.8, angle: 6, y: -1.15, px: 1024, draw: () => {} });
    ctx.parent.add(this.statusPanel);
    ctx.button({
      w: 0.8, h: 0.3, r: 2.75, angle: -25, y: -1.15, px: 256,
      draw: (g, w, h) => { card(g, w, h, 'rgba(79,124,255,.6)', 30); text(g, 'Reconnect', w / 2, h / 2, 40, { weight: '600' }); },
      onClick: () => this.start(),
    });
    this.kb = createKeyboard(ctx, {
      onKey: (k) => this.send({ t: 'key', k: { '⌫': 'Backspace', space: ' ' }[k] || k }),
    });
    ctx.button({
      w: 0.8, h: 0.3, r: 2.75, angle: 38, y: -1.15, px: 256,
      draw: (g, w, h) => { card(g, w, h, 'rgba(79,124,255,.6)', 30); text(g, '⌨ Keys', w / 2, h / 2, 40, { weight: '600' }); },
      onClick: () => { this.kb.visible = !this.kb.visible; },
    });
    this.start();
  },

  say(a, b = '') {
    const t = this.statusPanel.userData.tex, c = t.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    card(g, c.width, c.height, 'rgba(20,28,52,.85)', 30);
    text(g, a, c.width / 2, c.height * 0.33, 40, { weight: '700' });
    text(g, b, c.width / 2, c.height * 0.74, 30, { color: '#9fb0d8' });
    t.needsUpdate = true;
  },

  send(m, throttle) {
    const c = this.conn;
    if (!c || !c.open) return;
    if (throttle) { const now = performance.now(); if (now - this.lastMove < 45) return; this.lastMove = now; }
    c.send(m);
  },

  /** Called every frame the gaze is on the PC screen. uv: 0..1 across the screen; p: world hit point. */
  onMove(uv, p) {
    const x = uv.x, y = 1 - uv.y;
    this.look = 0;
    if (x > 0.95) { this.scrolling = y < 0.5 ? -1 : 1; this.cursor.visible = false; return; } // right edge strip scrolls
    this.scrolling = 0;
    this.cursor.position.copy(this.cursor.parent.worldToLocal(p.clone()));
    this.cursor.lookAt(0, 0, 0);
    this.cursor.visible = true;
    if (Math.hypot(x - this.ax, (y - this.ay) * 0.5625) > 0.015) {
      this.ax = x; this.ay = y; this.dwell = 0; this.clicked = false;
      this.send({ t: 'move', x, y }, true);
    }
  },

  async start() {
    this.stop();
    let code = '';
    try { code = (localStorage.getItem('vros.pccode') || '').trim().toUpperCase(); } catch { /* storage unavailable */ }
    if (!code) { this.say('No PC code', 'Type it on the start screen, then reload'); return; }
    this.say('Connecting…', `code ${code}`);
    try {
      const { Peer } = await import('peerjs');
      if (this.closed) return;
      const peer = (this.peer = new Peer());
      peer.on('open', () => {
        const conn = (this.conn = peer.connect('vros-' + code, { reliable: true }));
        conn.on('open', () => this.say('Paired', 'Click Allow on the PC…'));
        conn.on('close', () => this.say('PC disconnected', 'Press Reconnect'));
        conn.on('data', (d) => this.onHost(d)); // native host app: negotiates the video over this data link
      });
      peer.on('call', (call) => { // browser host page (host.js): PeerJS media call
        this.call = call;
        call.answer();
        call.on('stream', (s) => this.show(s));
        call.on('close', () => this.say('Stream ended', 'Press Reconnect'));
      });
      peer.on('error', (e) => this.say(e.type === 'peer-unavailable' ? 'PC not found' : 'Connection error', e.type === 'peer-unavailable' ? 'Is the host page open? Code correct?' : String(e.type || e)));
    } catch (e) { this.say('Could not start', e.message); }
  },

  show(s) {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.srcObject = s;
    this.video.muted = false;
    this.video.play().catch(() => { this.video.muted = true; this.video.play().catch(() => {}); }); // no sound if blocked
    this.screen.material.color.setHex(0xffffff);
    this.say('Streaming', 'getting stats…');
  },

  /** Messages from the native PC host app: WebRTC offer / ICE candidates / errors. */
  async onHost(d) {
    if (!d || this.closed) return;
    if (d.t === 'error') { this.say('PC host error', String(d.msg).slice(0, 60)); return; }
    if (d.t === 'offer') {
      if (this.rtc) this.rtc.close();
      const pc = (this.rtc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }));
      this.call = { peerConnection: pc, close: () => pc.close() }; // stats() reads call.peerConnection
      pc.onicecandidate = (e) => { if (e.candidate && this.conn && this.conn.open) this.conn.send({ t: 'ice', c: e.candidate.candidate, mid: e.candidate.sdpMid }); };
      pc.ontrack = (e) => this.show(e.streams[0] || new MediaStream([e.track]));
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed') this.say('Stream failed', 'Press Reconnect'); };
      await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
      await pc.setLocalDescription(await pc.createAnswer());
      this.conn.send({ t: 'answer', sdp: pc.localDescription.sdp });
    } else if (d.t === 'ice' && this.rtc) {
      this.rtc.addIceCandidate({ candidate: d.c, sdpMid: d.mid }).catch(() => {});
    }
  },

  stop() {
    if (this.rtc) { this.rtc.close(); this.rtc = null; }
    if (this.call) this.call.close();
    if (this.conn) this.conn.close();
    if (this.peer) this.peer.destroy();
    this.call = this.conn = this.peer = null;
    this.video.srcObject = null;
    if (this.screen) this.screen.material.color.setHex(0x000000);
  },

  async stats() {
    const pc = this.call && this.call.peerConnection;
    if (!pc) return;
    let fps = 0, w = 0, h = 0, rtt = 0, jb = 0;
    (await pc.getStats()).forEach((r) => {
      if (r.type === 'inbound-rtp' && r.kind === 'video') {
        fps = r.framesPerSecond || 0; w = r.frameWidth || 0; h = r.frameHeight || 0;
        if (r.jitterBufferEmittedCount) jb = (1000 * r.jitterBufferDelay) / r.jitterBufferEmittedCount;
      }
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) rtt = (r.currentRoundTripTime || 0) * 1000;
    });
    if (!this.closed) this.say('Streaming', `${w}x${h} · ${fps.toFixed(0)} fps · ${rtt.toFixed(0)} ms RTT · buffer ${jb.toFixed(0)} ms`);
  },

  update(dt) {
    this.tex.update(); // iOS 15 has no requestVideoFrameCallback
    this.t += dt;
    if (this.t >= 1) { this.t = 0; this.stats().catch(() => {}); }
    this.look += dt;
    if (this.look > 0.25) { this.scrolling = 0; this.cursor.visible = false; this.dwell = 0; } else if (this.cursor.visible) {
      if (!this.clicked) {
        this.dwell += dt;
        const p = Math.min(1, this.dwell / DWELL);
        this.cursor.material.color.setHex(0xffffff);
        this.cursor.scale.setScalar(1.8 - 0.8 * p); // ring shrinks onto the point, then clicks
        if (p >= 1) { this.send({ t: 'click', x: this.ax, y: this.ay }); this.clicked = true; this.cursor.material.color.setHex(0x6fff9a); this.cursor.scale.setScalar(1); }
      }
    }
    if (this.scrolling) { this.sc += dt; if (this.sc > 0.2) { this.sc = 0; this.send({ t: 'wheel', dy: 3 * this.scrolling }); } }
  },

  dispose() {
    this.closed = true;
    this.stop();
    this.tex.dispose();
  },
};
