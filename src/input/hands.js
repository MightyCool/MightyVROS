import * as THREE from 'three';

const BASE = import.meta.env.BASE_URL + 'mediapipe/';
const loadScript = (src) => new Promise((res, rej) => {
  if (window.Hands) { res(); return; }
  const s = document.createElement('script');
  s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the hand model'));
  document.head.appendChild(s);
});

/**
 * Hand tracking (MediaPipe Hands, lite model, self-hosted) from the rear camera.
 * The pinch point (thumb tip + index tip midpoint) becomes a pointing ray; pinching = click/drag.
 * Runs on a throttled loop (MediaPipe's own WASM/GL work does not block rendering for long).
 */
export class HandInput {
  constructor(camera, settings, head) {
    this.camera = camera; this.s = settings; this.head = head;
    this.running = false; this.ready = false; this.busy = false; this.last = 0; this.lastSeen = 0;
    this.lm = null; this.pos = [0.5, 0.5]; this.pinch = false; this.fps = 0; this.frames = 0; this.t0 = performance.now();
    this.pointer = { active: false, origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), pressed: false, scroll: 0 };
    // 21 landmark dots, one draw call, shows your tracked hand
    this.dots = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(63), 3)),
      new THREE.PointsMaterial({ color: 0x7cf4ff, size: 0.035, depthTest: false, transparent: true, opacity: 0.9 }));
    this.dots.renderOrder = 900; this.dots.frustumCulled = false; this.dots.visible = false;
    head.add(this.dots);
  }

  async start() {
    if (this.running) return;
    this.running = true;
    try {
      this.video = await this.camera.use('hands');
      await loadScript(BASE + 'hands.js');
      this.hands = new window.Hands({ locateFile: (f) => BASE + f });
      this.hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      this.hands.onResults((r) => this.onResults(r));
      await this.hands.initialize();
      this.ready = true;
    } catch (e) { this.stop(); throw e; }
  }

  stop() {
    this.running = false; this.ready = false;
    this.camera.release('hands');
    if (this.hands) { try { this.hands.close(); } catch { /* already closed */ } this.hands = null; }
    this.pointer.active = false; this.pointer.pressed = false; this.dots.visible = false;
  }

  /** Call every frame: feeds a camera frame to MediaPipe at most ~15 times a second. */
  tick(now) {
    if (!this.ready || this.busy || now - this.last < 66 || !this.camera.ready) return;
    this.last = now; this.busy = true;
    this.hands.send({ image: this.video }).catch(() => {}).finally(() => { this.busy = false; });
  }

  onResults(r) {
    this.frames++;
    const now = performance.now();
    if (now - this.t0 > 1000) { this.fps = this.frames; this.frames = 0; this.t0 = now; }
    const L = r.multiHandLandmarks && r.multiHandLandmarks[0];
    const score = r.multiHandedness && r.multiHandedness[0] ? r.multiHandedness[0].score : 1;
    if (!L || score < 0.6) return;
    const mx = (L[4].x + L[8].x) / 2, my = (L[4].y + L[8].y) / 2;
    if (now - this.lastSeen > 400) this.pos = [mx, my]; // fresh acquisition: no smoothing lag
    else { this.pos[0] += (mx - this.pos[0]) * 0.55; this.pos[1] += (my - this.pos[1]) * 0.55; }
    const size = Math.hypot(L[0].x - L[9].x, L[0].y - L[9].y) || 1;
    const d = Math.hypot(L[4].x - L[8].x, L[4].y - L[8].y) / size;
    if (!this.pinch && d < 0.32) this.pinch = true; else if (this.pinch && d > 0.5) this.pinch = false;
    this.lm = L; this.lastSeen = now;
  }

  /** Map a camera-image point to a head-local direction (camera FOV is a setting). */
  local(x, y, out) {
    const hf = (this.s.camFov * Math.PI) / 180, a = this.camera.aspect;
    const vt = Math.tan(hf / 2) / a;
    return out.set((x - 0.5) * 2 * Math.tan(hf / 2), (0.5 - y) * 2 * vt, -1);
  }

  update(headQuat) {
    const p = this.pointer, seen = performance.now() - this.lastSeen < 400;
    p.active = this.running && this.ready && seen && !!this.lm;
    p.pressed = p.active && this.pinch;
    this.dots.visible = p.active;
    if (!p.active) return;
    this.local(this.pos[0], this.pos[1], p.dir).normalize().applyQuaternion(headQuat);
    const a = this.dots.geometry.attributes.position, v = new THREE.Vector3();
    this.lm.forEach((q, i) => { this.local(q.x, q.y, v).normalize().multiplyScalar(2.2); a.setXYZ(i, v.x, v.y, v.z); });
    a.needsUpdate = true;
  }
}
