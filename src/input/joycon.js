import * as THREE from 'three';
import { calibrateBasis, yawToForward, wandQuat } from './joymath.js';
import { W, H, rgb2hsv, hueDist, findBlob, Smooth } from './blob.js';
import { buildJoycon } from './joymodel.js';

const KEY = 'vros.joy';
const REF_DIST = 0.4;            // metres at which a manual colour calibration measures the blob size
const AUTO_AREA = 0.02;          // blob area (fraction of frame) at REF_DIST when the colour came from the Joy-Con itself
const SELECT = { L: ['zl', 'l', 'down'], R: ['zr', 'r', 'a'] };   // any of these buttons selects
const DEFAULT = { L: 0x44aaff, R: 0xff5555 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Joy-Con controllers: orientation + buttons from the PC relay (IMU), position from the phone camera following each
 * Joy-Con's colour. The colour is read from the Joy-Con itself (via the PC) and keeps adapting to the room's lighting.
 */
export class Controllers {
  constructor(scene, head, camera, settings) {
    this.head = head; this.camera = camera; this.s = settings;
    this.cfg = { L: {}, R: {} };
    try { Object.assign(this.cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable or corrupt */ }
    this.link = { status: 'off' };
    this.running = false; this.scanT = 0; this.saveT = 0;
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.g2 = this.canvas.getContext('2d', { willReadFrequently: true });
    this.c = {}; this.pointers = [];
    for (const side of ['L', 'R']) {
      const model = buildJoycon(side);
      const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.06), new THREE.Vector3(0, 0, -3)]),
        new THREE.LineBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.55 }));
      model.group.add(beam); model.group.visible = false; scene.add(model.group);
      const B = this.cfg[side].B;
      this.c[side] = {
        model, beam, q: new THREE.Quaternion(), hasImu: false, imuT: 0, buttons: [], stick: [0, 0], hw: null,
        B: B ? new THREE.Quaternion(B[0], B[1], B[2], B[3]) : null, yaw: new THREE.Quaternion(),
        pos: new THREE.Vector3(), posT: 0, blob: null, Q: new THREE.Quaternion(), Qs: new THREE.Quaternion(), origin: new THREE.Vector3(), haveOrigin: false,
        smooth: new Smooth(2, 6), depths: [],
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
    const c = this.c[side], col = this.cfg[side].color;
    c.model.setColor(c.hw ? new THREE.Color(c.hw[0] / 255, c.hw[1] / 255, c.hw[2] / 255) : col ? new THREE.Color().setHSL(col.h / 360, 0.9, 0.55) : DEFAULT[side]);
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
    for (const s of ['L', 'R']) { this.c[s].pointer.active = false; this.c[s].model.group.visible = false; }
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
      peer.on('error', (e) => { this.link = { status: e.type === 'peer-unavailable' ? 'PC not found (host open?)' : 'error: ' + e.type }; });
    } catch (e) { this.link = { status: 'error: ' + e.message }; }
  }

  onData(d) {
    if (!d || d.t !== 'joy' || !this.c[d.s]) return;
    const c = this.c[d.s];
    c.q.set(d.q[0], d.q[1], d.q[2], d.q[3]); c.hasImu = true; c.imuT = performance.now();
    c.buttons = d.b || []; c.stick = d.st || [0, 0];
    if (d.col && (!c.hw || c.hw[0] !== d.col[0] || c.hw[1] !== d.col[1] || c.hw[2] !== d.col[2])) this.useHardwareColor(d.s, d.col);
  }

  /** The Joy-Con reports its own plastic colour: use it for camera tracking without any calibration. */
  useHardwareColor(side, rgb) {
    const c = this.c[side];
    c.hw = rgb;
    const [h, s, v] = rgb2hsv(rgb[0], rgb[1], rgb[2]);
    const cur = this.cfg[side].color;
    if ((!cur || cur.auto) && s > 0.3) { // grey/white Joy-Cons have no usable hue: those need manual calibration
      this.cfg[side].color = { h, s, v, a0: cur ? cur.a0 : AUTO_AREA, h0: h, s0: s, v0: v, auto: true };
      this.save();
      if (this.running && !this.camera.users.has('controllers')) this.camera.use('controllers').catch(() => {});
    }
    this.paintBody(side);
  }

  imu(side) { const c = this.c[side]; return c.hasImu && performance.now() - c.imuT < 1000 ? c.q.clone() : null; }

  setBasis(side, q0, q1) {
    const c = this.c[side];
    c.B = calibrateBasis(q0, q1);
    c.yaw = yawToForward(q0, c.B);
    this.save();
  }

  zero(side) { const c = this.c[side]; if (c.B && this.imu(side)) c.yaw = yawToForward(c.q, c.B); }

  reset() {
    for (const s of ['L', 'R']) { this.cfg[s] = {}; this.c[s].B = null; if (this.c[s].hw) this.useHardwareColor(s, this.c[s].hw); else this.paintBody(s); }
    this.save();
  }

  frame() {
    this.g2.drawImage(this.camera.video, 0, 0, W, H);
    return this.g2.getImageData(0, 0, W, H).data;
  }

  /** Manual calibration: average colour in the centre box + blob size at REF_DIST. */
  sampleColor(side) {
    if (!this.camera.ready) return false;
    const d = this.frame();
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 34; y < 56; y++) for (let x = 70; x < 90; x++) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    const [h, s, v] = rgb2hsv(r / n, g / n, b / n);
    const color = { h, s, v, a0: 0, h0: h, s0: s, v0: v };
    const blob = findBlob(d, color);
    color.a0 = blob ? Math.max(blob.n / (W * H), 0.0005) : AUTO_AREA;
    this.cfg[side].color = color;
    this.paintBody(side); this.save();
    if (!this.camera.users.has('controllers')) this.camera.use('controllers').catch(() => {});
    return true;
  }

  local(x, y, out) {
    const t = Math.tan((this.s.camFov * Math.PI) / 360);
    return out.set((x - 0.5) * 2 * t, (0.5 - y) * 2 * (t / this.camera.aspect), -1);
  }

  scan(now) {
    if (now - this.scanT < 50 || !this.camera.ready || !this.camera.users.has('controllers')) return;
    const dt = Math.min(0.2, (now - this.scanT) / 1000 || 0.05);
    this.scanT = now;
    const d = this.frame();
    for (const s of ['L', 'R']) {
      const col = this.cfg[s].color, c = this.c[s];
      if (!col) { c.blob = null; continue; }
      const b = findBlob(d, col);
      c.blob = b;
      if (!b) continue;
      // distance from apparent size (median of the last 5 readings: size is noisy)
      c.depths.push(clamp(REF_DIST * Math.sqrt(col.a0 / (b.n / (W * H))), 0.2, 1.2));
      if (c.depths.length > 5) c.depths.shift();
      const dist = [...c.depths].sort((x, y) => x - y)[c.depths.length >> 1];
      const local = this.local(b.cx, b.cy, new THREE.Vector3());
      local.set(local.x * dist, local.y * dist, -dist).applyQuaternion(this.head.quaternion);
      const sm = c.smooth.update(local.toArray(), dt);
      c.pos.fromArray(sm); c.posT = performance.now();
      // keep the colour model current as the lighting changes (bounded drift from the original)
      const a = 0.03, [mh, ms, mv] = b.mean;
      const nh = col.h + (((mh - col.h + 540) % 360) - 180) * a;
      if (hueDist(nh, col.h0 ?? col.h) < 25) col.h = (nh + 360) % 360;
      col.s = clamp(col.s + (ms - col.s) * a, (col.s0 ?? col.s) - 0.3, (col.s0 ?? col.s) + 0.3);
      col.v = clamp(col.v + (mv - col.v) * a, (col.v0 ?? col.v) - 0.3, (col.v0 ?? col.v) + 0.3);
    }
    if (now - this.saveT > 8000) { this.saveT = now; this.save(); }
  }

  update(dt, headQuat, now) {
    if (!this.running) return;
    this.scan(now);
    const yaw = new THREE.Euler().setFromQuaternion(headQuat, 'YXZ').y;
    for (const side of ['L', 'R']) {
      const c = this.c[side], p = c.pointer;
      const tracked = now - c.posT < 1000 && !!this.cfg[side].color;   // hold the last position for 1 s if the blob flickers
      const imu = c.B && this.imu(side);
      p.active = !!(imu || tracked);
      c.model.group.visible = p.active;
      if (!p.active) { p.pressed = false; c.haveOrigin = false; continue; }
      const target = tracked ? c.pos : new THREE.Vector3(side === 'L' ? -0.22 : 0.22, -0.3, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      if (!c.haveOrigin) { c.origin.copy(target); c.haveOrigin = true; } else c.origin.lerp(target, 1 - Math.exp(-dt * 8)); // no jumps when tracking comes and goes
      if (imu) { wandQuat(c.q, c.B, c.yaw, c.Q); c.Qs.slerp(c.Q, 1 - Math.exp(-dt * 30)); p.dir.set(0, 0, -1).applyQuaternion(c.Qs); p.origin.copy(c.origin); }
      else { p.origin.set(0, 0, 0); p.dir.copy(c.pos).normalize(); c.Q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.dir); c.Qs.slerp(c.Q, 1 - Math.exp(-dt * 20)); }
      c.model.group.position.copy(c.origin); c.model.group.quaternion.copy(c.Qs);
      p.pressed = SELECT[side].some((b) => c.buttons.includes(b));
      p.scroll = -c.stick[1] * 6;
      c.model.setInput(c.buttons, c.stick);
      c.beam.material.color.setHex(p.pressed ? 0xffffff : 0x9fc0ff);
      c.beam.material.opacity = p.pressed ? 0.95 : 0.55;
    }
  }
}
