import * as THREE from 'three';

/**
 * Head-locked reticle + dwell-to-click against interactive meshes.
 * Optional per-mesh userData: dwell (s), repeat (bool), region(uv)->id|null (sub-targets, e.g. keyboard keys),
 * onHover(id|null), onClick(id), onMove(uv, worldPoint) every frame while hovered, noDwell (app does its own click).
 */
export class Gaze {
  constructor(head, settings) {
    this.s = settings;
    this.head = head;
    this.ray = new THREE.Raycaster();
    this.dir = new THREE.Vector3();
    this.q = new THREE.Quaternion();
    this.hover = null; this.hoverId = null; this.t = 0; this.armed = true;
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
  }

  static tint(m, on) { if (m) (m.userData.mats || [m.material]).forEach((x) => x.color.setHex(on ? 0xffffff : 0xa8b4d4)); }

  update(dt, targets) {
    this.head.getWorldQuaternion(this.q);
    this.dir.set(0, 0, -1).applyQuaternion(this.q);
    this.ray.set(this.head.position, this.dir);
    const list = targets.filter((m) => m.visible && m.userData.interactive);
    const hit = this.ray.intersectObjects(list, false)[0];
    const m = hit ? hit.object : null;
    const u = m ? m.userData : null;
    const id = u && u.region && hit.uv ? u.region(hit.uv) : null;
    if (m !== this.hover || id !== this.hoverId) {
      if (this.hover) { Gaze.tint(this.hover, false); if (this.hover.userData.onHover) this.hover.userData.onHover(null); }
      this.hover = m; this.hoverId = id;
      if (m) { Gaze.tint(m, true); if (u.onHover) u.onHover(id); }
      this.t = 0; this.armed = true;
    }
    if (m && u.onMove && hit.uv) u.onMove(hit.uv, hit.point);
    const need = (u && u.dwell) || this.s.dwell;
    if (m && this.armed && !u.noDwell && (!u.region || id !== null)) {
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
}
