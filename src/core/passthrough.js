import * as THREE from 'three';

const DIST = 6; // metres: head-locked camera plane sits behind all UI

/** Camera passthrough: rear camera video on a head-locked plane behind the UI (same image in both eyes). */
export class Passthrough {
  constructor(head, settings, camera) {
    this.s = settings;
    this.on = false;
    this.camera = camera;
    this.video = camera.video;
    this.tex = new THREE.VideoTexture(this.video);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex, depthTest: false, depthWrite: false }));
    this.mesh.position.z = -DIST;
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    head.add(this.mesh);
  }

  async set(on) {
    if (on === this.on) return;
    if (!on) { this.camera.release('passthrough'); this.mesh.visible = false; this.on = false; return; }
    await this.camera.use('passthrough');
    this.mesh.visible = true; this.on = true;
  }

  /** eyeAspect = width/height of one eye's view. */
  update(eyeAspect) {
    if (!this.on) return;
    this.tex.update(); // iOS 15 has no requestVideoFrameCallback
    const v = this.video.videoWidth / this.video.videoHeight || 16 / 9;
    const viewH = 2 * DIST * Math.tan((this.s.fov * Math.PI) / 360);
    const size = this.s.ptSize;
    let h = size === 'fill' ? Math.max(viewH, (viewH * eyeAspect) / v) : viewH * size;
    this.mesh.scale.set(h * v, h, 1);
  }
}
