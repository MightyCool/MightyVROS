import * as THREE from 'three';

const DARK = 0x2b2b30;

/** Procedural Joy-Con (long axis = -Z forward, buttons face up). setColor(hex), setInput(buttonNames, [stickX, stickY]). */
export function buildJoycon(side) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.0125, 0.075, 4, 10), mat(side === 'L' ? 0x44aaff : 0xff5555));
  body.rotation.x = Math.PI / 2; body.scale.set(1.4, 1, 0.56); // 35 x 14 x 100 mm
  g.add(body);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.011, 0.09), mat(0x55565c));
  rail.position.x = side === 'R' ? -0.0185 : 0.0185;
  g.add(rail);
  const parts = {};
  const top = 0.0078;
  const button = (name, x, z, r = 0.0036) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.003, 10), mat(DARK));
    m.position.set(x, top, z); g.add(m); parts[name] = m; return m;
  };
  const stick = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 12), mat(DARK));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0058, 0.004, 12), mat(DARK));
  cap.position.y = 0.0035; stick.add(base, cap);
  stick.position.set(0, top, side === 'R' ? 0.016 : -0.02);
  g.add(stick); parts.stick = stick;
  const o = 0.0085;
  if (side === 'R') {
    button('a', o, -0.022); button('b', 0, -0.022 + o); button('x', 0, -0.022 - o); button('y', -o, -0.022);
  } else {
    button('right', o, 0.015); button('down', 0, 0.015 + o); button('up', 0, 0.015 - o); button('left', -o, 0.015);
  }
  const sh = side === 'R' ? ['r', 'zr'] : ['l', 'zl'];
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.012), mat(DARK)); shoulder.position.set(0, 0.0075, -0.054); g.add(shoulder); parts[sh[0]] = shoulder;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.012), mat(DARK)); trigger.position.set(0, -0.0045, -0.056); g.add(trigger); parts[sh[1]] = trigger;
  return {
    group: g,
    setColor(hex) { body.material.color.set(hex); },
    setInput(buttons, st) {
      for (const k of Object.keys(parts)) {
        if (k === 'stick') continue;
        const on = buttons.includes(k);
        parts[k].material.color.setHex(on ? 0xffffff : DARK);
        parts[k].position.y += ((on ? top - 0.0025 : top) - parts[k].position.y) * (k === 'zr' || k === 'zl' ? 0 : 1);
      }
      parts.stick.rotation.set((st[1] || 0) * 0.35, 0, -(st[0] || 0) * 0.35);
    },
  };
}
