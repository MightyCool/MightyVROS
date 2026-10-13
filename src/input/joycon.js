import * as THREE from 'three';
import { calibrateBasis, yawToForward, wandQuat } from './joymath.js';

const KEY = 'vros.joy';
const W = 160, H = 90;           // colour-tracking frame size
const REF_DIST = 0.4;            // metres: distance at which the colour is calibrated
const PRESS = { L: ['zl', 'l'], R: ['zr', 'r'] };
const DEFAULT = { L: 0x44aaff, R: 0xff5555 };

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}

/**
 * Joy-Con controllers: orientation + buttons from the PC relay (IMU), position from the phone camera
 * following each Joy-Con's colour. Either half works alone (IMU only: fixed arm position; camera only: point through the blob).
 */
export class Controllers {
  constructor(scene, head, camera, settings) {
    this.head = head; this.camera = camera; this.s = settings;
    this.cfg = { L: {}, R: {} };
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable or corrupt */ }
    this.link = { status: 'off' };
    this.running = false; this.scanT = 0;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g2 = this.canvas.getContext('2d', { willReadFrequently: true });
    this.c = {}; this.pointers = [];
    for (const side of ['L', 'R']) {
      const model = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), new THREE.MeshBasicMaterial({ color: DEFAULT[side] }));
      const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.08), new THREE.Vector3(0, 0, -3)]),
        new THREE.LineBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.55 }));
      model.add(body, beam); model.visible = false; scene.add(model);
      const B = this.cfg[side].B;
      this.c[side] = {
        model, body, q: new THREE.Quaternion(), hasImu: false, imuT: 0, buttons: [], stick: [0, 0],
        B: B ? new THREE.Quaternion(B[0], B[1], B[2], B[3]) : null, yaw: new THREE.Quaternion(),
        pos: new THREE.Vector3(), posT: 0, blob: null, Q: new THREE.Quaternion(),
        pointer: { active: false, origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), pressed: false, scroll: 0 },
      };
      this.paintBody(side);
      this.pointers.push(this.c[side].pointer);
    }
  }

  save() {
    const o = {};
    for (const s of ['L', 'R']) o[s] = { color: this.cfg[s].color, B: this.c[s].B ? this.c[s].B.toArray().slice(0, 4) : undefined };
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage unavailable */ }
  }

  paintBody(side) {
    const col = this.cfg[side].color;
    this.c[side].body.material.color.set(col ? new THREE.Color().setHSL(col.h / 360, 0.9, 0.55) : DEFAULT[side]);
  }

  hasColor() { return !!(this.cfg.L.color || this.cfg.R.color); }

  async start() {
    if (this.running) return;
    this.running = true;
    if (this.hasColor()) { try { await this.camera.use('controllers'); } catch { /* no camera: IMU-only still works */ } }
    this.connect();
  }

  stop() {
    this.running = false;
    this.camera.release('controllers');
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.link = { status: 'off' };
    for (const s of ['L', 'R']) { this.c[s].pointer.active = false; this.c[s].model.visible = false; }
  }

  async connect() {
    let code = '';
    try { code = (localStorage.getItem('vros.pccode') || '').trim().toUpperCase(); } catch { /* storage unavailable */ }
    if (!code) { this.link = { status: 'no PC code (start screen)' }; return; }
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.link = { status: 'connecting…' };
    try {
      const { Peer } = await import('peerjs');
      const peer = (this.peer = new Peer());
      peer.on('open', () => {
        const conn = peer.connect('vros-' + code, { metadata: { role: 'joy' } });
        conn.on('open', () => { this.link = { status: 'linked' }; });
        conn.on('data', (d) => this.onData(d));
        conn.on('close', () => { this.link = { status: 'closed' }; });
      });
      peer.on('error', (e) => { this.link = { status: e.type === 'peer-unavailable' ? 'PC not found (host page open?)' : 'error: ' + e.type }; });
    } catch (e) { this.link = { status: 'error: ' + e.message }; }
  }

  onData(d) {
    if (!d || d.t !== 'joy' || !this.c[d.s]) return;
    const c = this.c[d.s];
    c.q.set(d.q[0], d.q[1], d.q[2], d.q[3]); c.hasImu = true; c.imuT = performance.now();
    c.buttons = d.b || []; c.stick = d.st || [0, 0];
  }

  /** Latest IMU orientation if fresh, else null. */
  imu(side) { const c = this.c[side]; return c.hasImu && performance.now() - c.imuT < 1000 ? c.q.clone() : null; }

  setBasis(side, q0, q1) {
    const c = this.c[side];
    c.B = calibrateBasis(q0, q1);
    c.yaw = yawToForward(q0, c.B);
    this.save();
  }

  zero(side) { const c = this.c[side]; if (c.B && this.imu(side)) c.yaw = yawToForward(c.q, c.B); }

  reset() {
    for (const s of ['L', 'R']) { this.cfg[s] = {}; this.c[s].B = null; this.paintBody(s); }
    this.save();
  }

  frame() {
    this.g2.drawImage(this.camera.video, 0, 0, W, H);
    return this.g2.getImageData(0, 0, W, H).data;
  }

  /** Centre ROI colour (average) -> HSV, plus the blob area at reference distance. */
  sampleColor(side) {
    if (!this.camera.ready) return false;
    const d = this.frame();
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 34; y < 56; y++) for (let x = 70; x < 90; x++) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const [h, s, v] = rgb2hsv(r / n, g / n, b / n);
    const color = { h, s, v, a0: 0 };
    const blob = this.findBlob(d, color);
    color.a0 = blob ? Math.max(blob.n / (W * H), 0.0005) : 0.01;
    this.cfg[side].color = color;
    this.paintBody(side);
    this.save();
    if (!this.camera.users.has('controllers')) this.camera.use('controllers').catch(() => {});
    return true;
  }

  findBlob(d, col) {
    const hT = 16, sMin = Math.max(0.2, col.s - 0.3), vMin = Math.max(0.15, col.v - 0.35);
    let sx = 0, sy = 0, n = 0;
    const hit = (i) => {
      const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
      const dh = Math.abs(h - col.h); return Math.min(dh, 360 - dh) < hT && s > sMin && v > vMin;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hit((y * W + x) * 4)) { sx += x; sy += y; n++; }
    if (n < 10) return null;
    let cx = sx / n, cy = sy / n;
    for (let it = 0; it < 2; it++) {                       // refine: only pixels near the centre (ignore stray matches)
      const R = Math.max(8, 2.2 * Math.sqrt(n / Math.PI));
      sx = 0; sy = 0; let m = 0;
      for (let y = Math.max(0, cy - R | 0); y < Math.min(H, cy + R); y++) for (let x = Math.max(0, cx - R | 0); x < Math.min(W, cx + R); x++) {
        if (Math.hypot(x - cx, y - cy) < R && hit((y * W + x) * 4)) { sx += x; sy += y; m++; }
      }
      if (m < 6) return null;
      cx = sx / m; cy = sy / m; n = m;
    }
    return { cx: cx / W, cy: cy / H, n };
  }

  local(x, y, out) {
    const hf = (this.s.camFov * Math.PI) / 180, t = Math.tan(hf / 2);
    return out.set((x - 0.5) * 2 * t, (0.5 - y) * 2 * (t / this.camera.aspect), -1);
  }

  scan(now) {
    if (now - this.scanT < 50 || !this.camera.ready || !this.camera.users.has('controllers')) return;
    this.scanT = now;
    const d = this.frame();
    for (const s of ['L', 'R']) {
      const col = this.cfg[s].color, c = this.c[s];
      if (!col) { c.blob = null; continue; }
      const b = this.findBlob(d, col);
      c.blob = b;
      if (!b) continue;
      const dist = Math.min(1.2, Math.max(0.2, REF_DIST * Math.sqrt(col.a0 / (b.n / (W * H)))));
      const local = this.local(b.cx, b.cy, new THREE.Vector3()).normalize().multiplyScalar(dist).applyQuaternion(this.head.quaternion);
      if (performance.now() - c.posT > 500) c.pos.copy(local); else c.pos.lerp(local, 0.5);
      c.posT = performance.now();
    }
  }

  update(dt, headQuat, now) {
    if (!this.running) return;
    this.scan(now);
    const yaw = new THREE.Euler().setFromQuaternion(headQuat, 'YXZ').y;
    for (const side of ['L', 'R']) {
      const c = this.c[side], p = c.pointer;
      const tracked = now - c.posT < 500 && !!c.blob;
      const imu = c.B && this.imu(side);
      p.active = !!(imu || tracked);
      c.model.visible = p.active;
      if (!p.active) { p.pressed = false; continue; }
      let origin;
      if (tracked) origin = c.pos;
      else origin = new THREE.Vector3(side === 'L' ? -0.22 : 0.22, -0.3, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      if (imu) { wandQuat(c.q, c.B, c.yaw, c.Q); p.dir.set(0, 0, -1).applyQuaternion(c.Q); p.origin.copy(origin); }
      else { p.origin.set(0, 0, 0); p.dir.copy(c.pos).normalize(); c.Q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.dir); }
      c.model.position.copy(origin); c.model.quaternion.copy(c.Q);
      p.pressed = PRESS[side].some((b) => c.buttons.includes(b));
      p.scroll = -c.stick[1] * 6; // lines per second
    }
  }
}
