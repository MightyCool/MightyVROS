import * as THREE from 'three';

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);
const Q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const D2R = Math.PI / 180;
const ORIENTS = [90, -90, 0, 180];
const norm = (a) => { const n = ((((a + 180) % 360) + 360) % 360) - 180; return n === -180 ? 180 : n; };

/** DeviceOrientation head tracking + low-pass smoothing + recenter. Drag-to-look fallback. */
export class HeadTracker {
  constructor(settings) {
    this.s = settings;
    this.quaternion = new THREE.Quaternion();
    this.target = new THREE.Quaternion();
    this.raw = new THREE.Quaternion();
    this.yawFix = new THREE.Quaternion();
    this.euler = new THREE.Euler();
    this.tmp = new THREE.Quaternion();
    this.dev = [0, 0, 0];
    this.has = false;
    this.yaw = 0; this.pitch = 0;
    try {
      const v = parseInt(localStorage.getItem('vros.orient'), 10);
      if (ORIENTS.includes(v)) settings.orient = v;
    } catch { /* storage unavailable */ }
    this.onOri = (e) => {
      if (e.alpha == null) return;
      this.dev[0] = e.alpha; this.dev[1] = e.beta; this.dev[2] = e.gamma;
      this.compute();
      if (!this.has) { this.has = true; this.recenter(); this.quaternion.copy(this.yawFix).multiply(this.raw); }
    };
  }

  /** Screen rotation (deg) used to compensate the sensor. Manual override wins. */
  get angle() {
    if (this.s.orient != null) return this.s.orient;
    let a = norm(screen.orientation ? screen.orientation.angle : window.orientation || 0);
    if (window.innerWidth > window.innerHeight && (a === 0 || a === 180)) a = 90; // landscape layout but API says portrait
    return a;
  }

  compute() {
    const [al, be, ga] = this.dev;
    this.euler.set(be * D2R, al * D2R, -ga * D2R, 'YXZ');
    this.raw.setFromEuler(this.euler).multiply(Q1).multiply(this.tmp.setFromAxisAngle(Z, -this.angle * D2R));
  }

  /** Cycle the sensor axis fix (90, -90, 0, 180) if the view moves along the wrong axis. */
  cycleOrient() {
    const i = ORIENTS.indexOf(this.angle);
    this.s.orient = ORIENTS[(i + 1) % ORIENTS.length];
    try { localStorage.setItem('vros.orient', String(this.s.orient)); } catch { /* storage unavailable */ }
    if (this.has) this.compute();
    this.recenter();
  }

  /** Must be called from a tap handler (iOS permission prompt). */
  async enable() {
    const DOE = window.DeviceOrientationEvent;
    if (!DOE) throw new Error('No motion sensors in this browser. Drag to look instead.');
    if (typeof DOE.requestPermission === 'function') {
      const res = await DOE.requestPermission();
      if (res !== 'granted') throw new Error('Motion access denied. Drag to look, or reload and allow it.');
    }
    window.addEventListener('deviceorientation', this.onOri);
  }

  enableDrag(el) {
    let down = false, px = 0, py = 0;
    el.addEventListener('pointerdown', (e) => { down = true; px = e.clientX; py = e.clientY; });
    window.addEventListener('pointerup', () => { down = false; });
    window.addEventListener('pointermove', (e) => {
      if (!down || this.has) return;
      this.yaw += (e.clientX - px) * -0.005;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + (e.clientY - py) * -0.005));
      px = e.clientX; py = e.clientY;
    });
  }

  recenter() {
    if (!this.has) { this.yaw = 0; this.pitch = 0; return; }
    const yaw = this.euler.setFromQuaternion(this.raw, 'YXZ').y;
    this.yawFix.setFromAxisAngle(Y, -yaw);
  }

  update(dt) {
    if (this.has) this.target.copy(this.yawFix).multiply(this.raw);
    else this.target.setFromEuler(this.euler.set(this.pitch, this.yaw, 0, 'YXZ'));
    this.quaternion.slerp(this.target, 1 - Math.exp(-dt * this.s.smooth));
  }
}
