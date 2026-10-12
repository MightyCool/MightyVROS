import * as THREE from 'three';

export const R = 3; // launcher cylinder radius (metres)

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Flat plane bent around the Y axis so it hugs a cylinder of radius r around the viewer. */
export function curvedGeometry(w, h, r) {
  const geo = new THREE.PlaneGeometry(w, h, Math.max(2, Math.ceil(w / 0.1)), 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = p.getX(i) / r; p.setXYZ(i, r * Math.sin(a), p.getY(i), -r * Math.cos(a)); }
  p.needsUpdate = true; geo.computeBoundingSphere();
  return geo;
}

/** Curved textured panel. interactive:true makes it a gaze/pointer target. */
export function makePanel({ w, h, r = R, angle = 0, y = 0, px = 256, draw, interactive = false, onClick }) {
  const tex = canvasTex(px, Math.round((px * h) / w), draw);
  const m = new THREE.Mesh(curvedGeometry(w, h, r), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, color: interactive ? 0xa8b4d4 : 0xffffff,
  }));
  m.rotation.y = (-angle * Math.PI) / 180;
  m.position.y = y;
  m.userData = { interactive, onClick, tex };
  return m;
}

export const card = (g, w, h, fill = 'rgba(20,28,52,.82)', radius = 28) => { roundRect(g, 2, 2, w - 4, h - 4, radius); g.fillStyle = fill; g.fill(); };

export function text(g, str, x, y, size, { color = '#e8edff', weight = '500', align = 'center' } = {}) {
  g.font = `${weight} ${size}px -apple-system, system-ui, sans-serif`;
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  g.fillText(str, x, y);
}

export function disposeTree(o) {
  o.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) { if (n.material.map) n.material.map.dispose(); n.material.dispose(); }
  });
}
