import * as THREE from 'three';
import { Smooth } from './blob.js';
import { HandModel } from './handmodel.js';

const BASE = import.meta.env.BASE_URL + 'mediapipe/';
const loadScript = (src) => new Promise((res, rej) => {
  if (window.Hands) { res(); return; }
  const s = document.createElement('script');
  s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load the hand model'));
  document.head.appendChild(s);
});

/**
 * Hand tracking (MediaPipe Hands, lite model, self-hosted) from the rear camera.
 * The pinch point (thumb tip + index tip midpoint) is a pointing ray from your eyes through your fingers; pinching = select / drag.
 * A glove-style 3D hand (real-size world landmarks, placed by hand size) is drawn so you can see what is tracked.
 */
export class HandInput {
  constructor(camera, settings, head) {
    this.camera = camera; this.s = settings; this.head = head;
    this.running = false; this.ready = false; this.busy = false; this.last = 0; this.lastSeen = 0;
    this.lm = null; this.wl = null; this.pinch = false; this.fps = 0; this.frames = 0; this.t0 = performance.now();
    this.aim = new Smooth(2.5, 10);      // pinch point on the image (steady when slow, no lag when fast)
    this.shape = new Smooth(5, 25);      // 21 joints in metres
    this.pointer = { active: false, origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), pressed: false, scroll: 0 };
    this.model = new HandModel();
    head.add(this.model.group);
    this.tmp = new THREE.Vector3();
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
    this.pointer.active = false; this.pointer.pressed = false; this.model.group.visible = false;
    this.aim.reset(); this.shape.reset();
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
    if (now - this.lastSeen > 400) { this.aim.reset(); this.shape.reset(); }
    const asp = this.camera.aspect, dist = (a, b) => Math.hypot((a.x - b.x) * asp, a.y - b.y); // aspect-correct image distances
    const d = dist(L[4], L[8]) / (dist(L[0], L[9]) || 1);
    if (!this.pinch && d < 0.33) this.pinch = true; else if (this.pinch && d > 0.5) this.pinch = false;
    this.lm = L; this.wl = r.multiHandWorldLandmarks && r.multiHandWorldLandmarks[0]; this.lastSeen = now;
    this.fresh = true;
  }

  /** Map a camera-image point to a tangent-space direction (x, y, -1); camera FOV is a setting. */
  local(x, y, out) {
    const t = Math.tan((this.s.camFov * Math.PI) / 360);
    return out.set((x - 0.5) * 2 * t, (0.5 - y) * 2 * (t / this.camera.aspect), -1);
  }

  update(headQuat, dt) {
    const p = this.pointer;
    p.active = this.running && this.ready && performance.now() - this.lastSeen < 400 && !!this.lm;
    p.pressed = p.active && this.pinch;
    this.model.group.visible = p.active;
    if (!p.active) { this.shape.reset(); return; }
    const L = this.lm;
    const aim = this.aim.update([(L[4].x + L[8].x) / 2, (L[4].y + L[8].y) / 2], Math.min(dt, 0.1));
    this.local(aim[0], aim[1], p.dir).normalize().applyQuaternion(headQuat);
    // glove: place the wrist by apparent palm size, then use real-size joint offsets
    const wl = this.wl, a = this.local(L[0].x, L[0].y, this.tmp.clone()), b = this.local(L[9].x, L[9].y, this.tmp.clone());
    const palm = wl ? Math.hypot(wl[0].x - wl[9].x, wl[0].y - wl[9].y, wl[0].z - wl[9].z) : 0.09;
    const depth = Math.min(0.9, Math.max(0.15, palm / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 0.02)));
    const w0 = [a.x * depth, a.y * depth, -depth], pts = new Array(63);
    for (let i = 0; i < 21; i++) {
      const q = this.local(L[i].x, L[i].y, this.tmp);
      pts[i * 3] = wl ? w0[0] + (wl[i].x - wl[0].x) : q.x * depth;
      pts[i * 3 + 1] = wl ? w0[1] - (wl[i].y - wl[0].y) : q.y * depth;
      pts[i * 3 + 2] = wl ? w0[2] - (wl[i].z - wl[0].z) : -depth;
    }
    this.model.update(this.shape.update(pts, Math.min(dt, 0.1)), this.pinch);
  }
}
