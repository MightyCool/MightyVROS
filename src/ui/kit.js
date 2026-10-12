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

/** Brighter copy of a drawn texture (white overlay on opaque pixels + outline) used as the hover state. */
export function hoverTex(px, ph, draw) {
  return canvasTex(px, ph, (g, W, H) => {
    draw(g, W, H);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,.32)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = Math.max(3, W * 0.012); g.strokeStyle = 'rgba(255,255,255,.95)';
    roundRect(g, 3, 3, W - 6, H - 6, Math.min(W, H) * 0.2); g.stroke();
  });
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
export function makePanel({ w, h, r = R, angle = 0, y = 0, px = 256, draw, interactive = false, onClick, hl = true }) {
  const ph = Math.round((px * h) / w);
  const tex = canvasTex(px, ph, draw);
  const m = new THREE.Mesh(curvedGeometry(w, h, r), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, color: 0xffffff,
  }));
  m.rotation.y = (-angle * Math.PI) / 180;
  m.position.y = y;
  m.userData = { interactive, onClick, tex };
  if (interactive && hl) {
    const texH = hoverTex(px, ph, draw);
    m.userData.texH = texH;
    m.userData.setHover = (on) => { m.material.map = on ? texH : tex; };
  }
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
    if (n.userData) ['tex', 'texH'].forEach((k) => { if (n.userData[k] && n.userData[k].dispose) n.userData[k].dispose(); });
  });
}
