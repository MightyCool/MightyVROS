import * as THREE from 'three';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const bas = (c) => new THREE.MeshBasicMaterial({ color: c });

function woodTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const v = 150 + ((i * 37) % 30);
    g.fillStyle = `rgb(${v},${v - 45},${v - 90})`; g.fillRect(0, i * 32, 256, 32);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 32, 256, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  return t;
}

/** Cozy low-poly room: 8x8 m, floor at y=-1.6, ceiling at y=2.0 (eye at y=0). */
export function buildRoom(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  const plane = (w, h, mat, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); g.add(m); return m; };

  // Shell: faces order +x, -x, +y (ceiling), -y (floor), +z, -z
  const wall = lam(0xe6dcc6, { side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(8, 3.6, 8), [
    wall, wall, lam(0xf4f1ea, { side: THREE.BackSide }), lam(0xffffff, { map: woodTex(), side: THREE.BackSide }), wall, wall,
  ]);
  shell.position.y = 0.2; g.add(shell);

  // Rug, ceiling light
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), lam(0x3b5b8c));
  rug.rotation.x = -Math.PI / 2; rug.position.y = -1.59; g.add(rug);
  plane(1.2, 1.2, bas(0xfffbe8), 0, 1.99, 0, Math.PI / 2, 0);

  // Bookshelf (left wall)
  const wood = lam(0x6b4a2f);
  box(0.4, 2.4, 2.0, wood, -3.78, -0.4, -1.2);
  [0xc0504d, 0x4f81bd, 0x9bbb59, 0xf2b84b, 0x8064a2, 0x4bacc6].forEach((c, i) => {
    box(0.25, 0.4, 0.18, lam(c), -3.55, -0.9 + (i % 3) * 0.7, -1.7 + Math.floor(i / 3) * 0.9);
  });

  // Couch (right side)
  const fab = lam(0x8a4f3d);
  box(0.9, 0.45, 2.0, fab, 3.1, -1.375, -0.8);
  box(0.25, 0.6, 2.0, fab, 3.6, -1.0, -0.8);
  box(0.9, 0.3, 0.2, fab, 3.1, -1.2, 0.3); box(0.9, 0.3, 0.2, fab, 3.1, -1.2, -1.9);

  // Lamp + light
  box(0.05, 1.4, 0.05, lam(0x333333), 3.5, -0.9, -3.4);
  box(0.35, 0.3, 0.35, bas(0xffe2a8), 3.5, -0.1, -3.4);
  const lamp = new THREE.PointLight(0xffd9a0, 1.1, 9); lamp.position.set(3.3, 0.2, -3.2); g.add(lamp);

  // Plant
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 12), lam(0xb5651d)); pot.position.set(-3.3, -1.4, 2.5); g.add(pot);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lam(0x3f8f4a)); leaf.position.set(-3.3, -0.85, 2.5); g.add(leaf);

  // Window with cross bars (right wall) + door (back)
  plane(1.6, 1.2, bas(0x9fd3ff), 3.98, 0.4, 2.0, 0, -Math.PI / 2);
  box(0.05, 1.3, 0.06, wood, 3.96, 0.4, 2.0); box(0.05, 0.06, 1.7, wood, 3.96, 0.4, 2.0);
  box(0.1, 2.2, 1.0, lam(0x5a3d26), 0, -0.5, 3.95);
  box(0.9, 0.5, 0.05, lam(0xd9b36a), -2.2, 0.7, 3.97);

  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x7a6a58, 1.0));
  return g;
}
