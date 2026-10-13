import * as THREE from 'three';
import { curvedGeometry, makePanel, card, text } from '../ui/kit.js';

const wrap = (s, n) => { const out = []; let line = ''; s.split(' ').forEach((w) => { if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }); out.push(line); return out; };

/** Controllers app: link to the PC (Joy-Con IMU relay), calibrate each Joy-Con's colour (camera) and pose (gravity). */
export const controllersApp = {
  id: 'controllers',
  name: 'Controllers',
  icon: '🎮',

  init(ctx) {
    const C = (this.C = ctx.actions.controllers);
    Object.assign(this, { job: null, msg: 'Pair the Joy-Cons to your PC, run host.py, then PC link.', t: 0, closed: false });
    ctx.frame.visible = false;
    C.camera.use('controllers-app').catch((e) => { this.msg = 'Camera: ' + e.message; });
    C.start();
    this.vtex = new THREE.VideoTexture(C.camera.video);
    this.vtex.minFilter = this.vtex.magFilter = THREE.LinearFilter; this.vtex.generateMipmaps = false;
    this.preview = new THREE.Mesh(curvedGeometry(2.3, 1.3, 2.85), new THREE.MeshBasicMaterial({ map: this.vtex, color: 0xffffff }));
    this.preview.rotation.y = (18 * Math.PI) / 180; this.preview.position.y = 0.55;
    ctx.parent.add(this.preview);
    this.overlay = makePanel({ w: 2.3, h: 1.3, r: 2.82, angle: -18, y: 0.55, px: 512, draw: () => {} });
    this.info = makePanel({ w: 1.5, h: 1.3, r: 2.82, angle: 24, y: 0.55, px: 512, draw: () => {} });
    ctx.parent.add(this.overlay, this.info);
    const btn = (label, angle, y, onClick) => ctx.button({
      w: 0.85, h: 0.34, r: 2.8, angle, y, px: 256, onClick,
      draw: (g, w, h) => { card(g, w, h, 'rgba(79,124,255,.55)', 40); text(g, label, w / 2, h / 2, 38, { weight: '600' }); },
    });
    btn('PC link', -27, -0.45, () => C.connect());
    btn('L color', -9, -0.45, () => this.startColor('L'));
    btn('R color', 9, -0.45, () => this.startColor('R'));
    btn('Zero', 27, -0.45, () => { C.zero('L'); C.zero('R'); this.msg = 'Zeroed: current pointing direction = forward.'; });
    btn('L pose', -27, -0.9, () => this.startPose('L'));
    btn('R pose', -9, -0.9, () => this.startPose('R'));
    btn('Reset', 9, -0.9, () => { C.reset(); this.msg = 'Calibration cleared.'; });
    this.draw();
  },

  startColor(side) { this.job = { kind: 'color', side, t: 4, text: `Hold the ${side} Joy-Con inside the green box, about 40 cm away` }; },

  startPose(side) {
    if (!this.C.imu(side)) { this.msg = `No motion data for ${side}. Link to the PC first.`; return; }
    this.job = { kind: 'pose', side, step: 0, t: 5, text: `${side}: hold it level, tip forward, buttons up` };
  },

  finish() {
    const j = this.job, C = this.C;
    if (j.kind === 'color') { this.msg = C.sampleColor(j.side) ? `${j.side} colour saved.` : 'Camera not ready.'; this.job = null; return; }
    const q = C.imu(j.side);
    if (!q) { this.msg = `Lost motion data for ${j.side}.`; this.job = null; return; }
    if (j.step === 0) { j.q0 = q; j.step = 1; j.t = 5; j.text = `${j.side}: now point the tip straight UP`; return; }
    C.setBasis(j.side, j.q0, q);
    this.msg = `${j.side} pose saved. Point forward and press Zero.`; this.job = null;
  },

  draw() {
    const C = this.C;
    let c = this.info.userData.tex.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); card(g, c.width, c.height, 'rgba(14,20,40,.94)', 28);
    const st = (s) => `${s}: IMU ${C.imu(s) ? '✓' : '–'}  colour ${C.cfg[s].color ? '✓' : '–'}  pose ${C.c[s].B ? '✓' : '–'}  seen ${C.c[s].blob ? '✓' : '–'}`;
    text(g, 'Controllers', c.width / 2, 36, 34, { weight: '700' });
    [`PC link: ${C.link.status}`, st('L'), st('R')].forEach((l, i) => text(g, l, c.width / 2, 86 + i * 34, 22, { color: '#9fb0d8' }));
    const msg = this.job ? `${this.job.text}  (${Math.ceil(this.job.t)})` : this.msg;
    wrap(msg, 34).slice(0, 5).forEach((l, i) => text(g, l, c.width / 2, 210 + i * 30, 24, { color: this.job ? '#7CFC9A' : '#fff' }));
    this.info.userData.tex.needsUpdate = true;

    c = this.overlay.userData.tex.image; g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.lineWidth = 3; g.strokeStyle = '#7CFC9A';
    const sx = c.width / 160, sy = c.height / 90;
    g.strokeRect(70 * sx, 34 * sy, 20 * sx, 22 * sy);
    ['L', 'R'].forEach((s) => {
      const b = C.c[s].blob; if (!b) return;
      g.strokeStyle = s === 'L' ? '#44aaff' : '#ff5555'; g.beginPath(); g.arc(b.cx * c.width, b.cy * c.height, 16, 0, 7); g.stroke();
      text(g, s, b.cx * c.width, b.cy * c.height - 26, 24, { weight: '700' });
    });
    this.overlay.userData.tex.needsUpdate = true;
  },

  update(dt) {
    this.vtex.update(); // iOS 15 has no requestVideoFrameCallback
    if (this.job) { this.job.t -= dt; if (this.job.t <= 0) this.finish(); }
    this.t += dt;
    if (this.t > 0.15) { this.t = 0; this.draw(); }
  },

  dispose() {
    this.C.camera.release('controllers-app');
    this.vtex.dispose();
  },
};
