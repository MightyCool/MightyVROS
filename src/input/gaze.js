import * as THREE from 'three';

/**
 * Pointer + click logic for every input method.
 * - Head gaze: head-locked reticle, dwell-to-click.
 * - Pointers (hand pinch, Joy-Con): {active, origin, dir, pressed, scroll}; click on press.
 * Per-mesh userData: interactive, dwell, repeat, region(uv)->id|null, onHover(id), onClick(id),
 * onDrag(du,dv), onScroll(amount), setHover(on).
 */
export class Gaze {
  constructor(head, settings) {
    this.s = settings;
    this.head = head;
    this.ray = new THREE.Raycaster();
    this.dir = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.org = new THREE.Vector3();
    this.hover = null; this.hoverId = null; this.t = 0; this.armed = true;
    this.wasPressed = false; this.repT = 0; this.lastUv = null; this.usingPointer = false;
    const mk = (color, opacity, side) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side });
    this.arcs = [];
    for (let i = 0; i <= 24; i++) this.arcs.push(new THREE.RingGeometry(0.045, 0.06, 24, 1, Math.PI / 2, -Math.PI * 2 * Math.max(i, 0.001) / 24));
    this.group = new THREE.Group();
    this.group.position.z = -2.8;
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 12), mk(0xffffff, 0.95));
    this.base = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.06, 24), mk(0xffffff, 0.35));
    this.prog = new THREE.Mesh(this.arcs[0], mk(0x6fa0ff, 1, THREE.DoubleSide)); // negative arc flips winding -> needs DoubleSide
    this.prog.visible = false;
    [this.base, this.prog, this.dot].forEach((m, i) => { m.renderOrder = 999 + i; this.group.add(m); });
    head.add(this.group);
    // cursor shown at the hit point when a hand / controller pointer is used
    this.cursor = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.045, 20), mk(0xffffff, 0.95));
    this.cursor.renderOrder = 1000; this.cursor.visible = false;
    head.add(this.cursor);
  }

  static tint(m, on) {
    if (!m) return;
    const u = m.userData;
    if (u.setHover) u.setHover(on); // texture swap (bright + outline)
    else (u.mats || [m.material]).forEach((x) => x.color.setHex(on ? 0xffffff : 0xa8b4d4));
  }

  update(dt, targets, pointers = []) {
    const p = this.s.input === 'gaze' ? null : pointers.find((x) => x.active);
    if (p) this.ray.set(p.origin, p.dir);
    else {
      this.head.getWorldQuaternion(this.q);
      this.dir.set(0, 0, -1).applyQuaternion(this.q);
      this.ray.set(this.org.set(0, 0, 0), this.dir);
    }
    if (!!p !== this.usingPointer) { this.usingPointer = !!p; this.group.visible = !p; this.t = 0; }
    const list = targets.filter((m) => m.visible && m.userData.interactive);
    const hit = this.ray.intersectObjects(list, false)[0];
    const m = hit ? hit.object : null;
    const u = m ? m.userData : null;
    const id = u && u.region && hit.uv ? u.region(hit.uv) : null;
    if (m !== this.hover || id !== this.hoverId) {
      if (this.hover) { Gaze.tint(this.hover, false); if (this.hover.userData.onHover) this.hover.userData.onHover(null); }
      this.hover = m; this.hoverId = id; this.lastUv = null;
      if (m) { Gaze.tint(m, true); if (u.onHover) u.onHover(id); }
      this.t = 0; this.armed = true;
    }
    if (p) { this.pointerClick(dt, p, hit, m, u, id); return; }
    this.cursor.visible = false;
    const need = (u && u.dwell) || this.s.dwell;
    if (m && this.armed && (!u.region || id !== null)) {
      this.t += dt;
      if (this.t >= need) {
        this.t = 0; this.armed = !!u.repeat;
        if (u.onClick) u.onClick(id);
      }
    } else this.t = 0;
    const step = Math.round((this.t / need) * 24);
    this.prog.visible = step > 0;
    if (step > 0) this.prog.geometry = this.arcs[step];
  }

  pointerClick(dt, p, hit, m, u, id) {
    this.prog.visible = false; this.t = 0;
    const pt = hit ? hit.point : this.org.copy(p.origin).addScaledVector(p.dir, 2.6);
    this.cursor.position.copy(pt);
    this.cursor.scale.setScalar(p.pressed ? 0.6 : 1);
    this.cursor.visible = true;
    const rising = p.pressed && !this.wasPressed;
    this.wasPressed = p.pressed;
    if (!m) return;
    const ok = !u.region || id !== null;
    if (ok && rising) { this.repT = 0; if (u.onClick) u.onClick(id); } else if (ok && p.pressed && u.repeat) {
      this.repT += dt;
      if (this.repT > 0.3) { this.repT = 0; if (u.onClick) u.onClick(id); }
    }
    if (p.pressed && u.onDrag && hit.uv) { if (this.lastUv) u.onDrag(hit.uv.x - this.lastUv.x, hit.uv.y - this.lastUv.y); this.lastUv = hit.uv.clone(); } else this.lastUv = null;
    if (p.scroll && u.onScroll) u.onScroll(p.scroll * dt);
  }
}
