import * as THREE from 'three';

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16],
  [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17], [0, 17]];
const PALM = [0, 1, 5, 0, 5, 9, 0, 9, 13, 0, 13, 17, 5, 9, 13, 5, 13, 17];
const UP = new THREE.Vector3(0, 1, 0);

/** Glove-style hand: 21 joint spheres + 21 bones (2 instanced draws) + a palm patch. Points are head-local metres. */
export class HandModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    const glove = new THREE.MeshLambertMaterial({ color: 0xdfe9ff, side: THREE.DoubleSide });
    this.joints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), glove, 21);
    this.bones = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), glove, BONES.length);
    this.joints.frustumCulled = this.bones.frustumCulled = false;
    const palmGeo = new THREE.BufferGeometry();
    palmGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(63), 3));
    palmGeo.setIndex(PALM);
    this.palm = new THREE.Mesh(palmGeo, glove);
    this.palm.frustumCulled = false;
    this.tips = [4, 8].map(() => new THREE.Mesh(new THREE.SphereGeometry(0.0095, 8, 6), new THREE.MeshBasicMaterial({ color: 0x6fe0ff })));
    this.tips.forEach((t) => { t.visible = false; });
    this.group.add(this.joints, this.bones, this.palm, ...this.tips);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.d = new THREE.Vector3();
  }

  /** pts: flat [x,y,z]*21 in head-local metres. pinch: bool. */
  update(pts, pinch) {
    const at = (i, out) => out.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = 0; i < 21; i++) {
      at(i, this.p);
      const r = i === 0 ? 0.011 : i % 4 === 0 ? 0.0085 : 0.0072;
      this.joints.setMatrixAt(i, this.m.compose(this.p, this.q.identity(), this.s.set(r, r, r)));
    }
    BONES.forEach(([i, j], k) => {
      at(i, a); at(j, b);
      this.d.subVectors(b, a);
      const len = this.d.length() || 1e-4;
      this.q.setFromUnitVectors(UP, this.d.divideScalar(len));
      const r = k >= 17 ? 0.0058 : 0.0066;
      this.bones.setMatrixAt(k, this.m.compose(this.p.addVectors(a, b).multiplyScalar(0.5), this.q, this.s.set(r, len, r)));
    });
    this.joints.instanceMatrix.needsUpdate = true; this.bones.instanceMatrix.needsUpdate = true;
    this.palm.geometry.attributes.position.array.set(pts); this.palm.geometry.attributes.position.needsUpdate = true;
    this.palm.geometry.computeVertexNormals();
    [4, 8].forEach((idx, n) => { at(idx, this.tips[n].position); this.tips[n].visible = pinch; });
  }
}
