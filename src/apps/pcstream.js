import * as THREE from 'three';
import { curvedGeometry, makePanel, card, text } from '../ui/kit.js';

/** PC Stream app: PeerJS pairing (code typed on the start screen) -> WebRTC video on a big curved screen. */
export const pcStream = {
  id: 'pc',
  name: 'PC Stream',
  icon: '🖥️',

  init(ctx) {
    this.closed = false; this.t = 0;
    ctx.frame.visible = false;
    this.video = document.getElementById('pcv');
    this.tex = new THREE.VideoTexture(this.video);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.screen = new THREE.Mesh(curvedGeometry(4.0, 2.25, 2.9), new THREE.MeshBasicMaterial({
      map: this.tex, color: 0x000000, transparent: true, depthWrite: false,
    }));
    this.screen.position.y = 0.15;
    ctx.parent.add(this.screen);
    this.statusPanel = makePanel({ w: 2.2, h: 0.3, r: 2.8, angle: 6, y: -1.15, px: 1024, draw: () => {} });
    ctx.parent.add(this.statusPanel);
    ctx.button({
      w: 0.8, h: 0.3, r: 2.75, angle: -25, y: -1.15, px: 256,
      draw: (g, w, h) => { card(g, w, h, 'rgba(79,124,255,.6)', 30); text(g, 'Reconnect', w / 2, h / 2, 40, { weight: '600' }); },
      onClick: () => this.start(),
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
        conn.on('open', () => this.say('Paired', 'Waiting for video…'));
        conn.on('close', () => this.say('PC disconnected', 'Press Reconnect'));
      });
      peer.on('call', (call) => {
        this.call = call;
        call.answer();
        call.on('stream', (s) => {
          this.video.srcObject = s;
          this.video.play().catch(() => {});
          this.screen.material.color.setHex(0xffffff);
          this.say('Streaming', 'getting stats…');
        });
        call.on('close', () => this.say('Stream ended', 'Press Reconnect'));
      });
      peer.on('error', (e) => this.say(e.type === 'peer-unavailable' ? 'PC not found' : 'Connection error', e.type === 'peer-unavailable' ? 'Is the host page open? Code correct?' : String(e.type || e)));
    } catch (e) { this.say('Could not start', e.message); }
  },

  stop() {
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
  },

  dispose() {
    this.closed = true;
    this.stop();
    this.tex.dispose();
  },
};
