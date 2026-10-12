import * as THREE from 'three';
import { R, makePanel, canvasTex, card, text, disposeTree } from './kit.js';
import { apps } from '../apps/stubs.js';

const pad = (n) => String(n).padStart(2, '0');

export class Launcher {
  constructor(scene, actions) {
    this.actions = actions;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.home = new THREE.Group();
    this.group.add(this.home);
    this.homeBtns = [];
    this.win = null;
    this.battery = null; this.extra = ''; this.statusKey = '';
    if (navigator.getBattery) navigator.getBattery().then((b) => { this.battery = b; }).catch(() => {});

    // Status bar (redrawn when its text changes)
    this.statusPanel = makePanel({ w: 1.9, h: 0.24, r: R, y: 1.3, px: 512, draw: () => {} });
    this.home.add(this.statusPanel);

    // Main curved panel
    this.home.add(makePanel({
      w: 4.2, h: 1.8, y: 0.25, px: 1024,
      draw: (g, w, h) => {
        card(g, w, h);
        text(g, 'VR OS', w / 2, h * 0.3, 120, { weight: '700' });
        text(g, 'Look at an app and hold your gaze to open it', w / 2, h * 0.5, 42, { color: '#9fb0d8' });
        text(g, 'Stage 1 · vertical slice', w / 2, h * 0.62, 32, { color: '#6c7fb0' });
      },
    }));
    this.addHomeButton('Recenter', -19, () => actions.recenter());
    this.addHomeButton('Flip axis', 0, () => actions.flipAxis());
    this.addHomeButton('Debug', 19, () => actions.toggleDebug());

    // 3D dock: a wooden console table with app cubes that lift toward you when gazed at
    const wood = new THREE.MeshLambertMaterial({ color: 0x8b6b4a });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.8), wood);
    top.position.set(0, -1.1, -2.55); this.home.add(top);
    [[-1.15, -2.25], [1.15, -2.25], [-1.15, -2.85], [1.15, -2.85]].forEach(([x, z]) => {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.08), wood);
      l.position.set(x, -1.37, z); this.home.add(l);
    });
    this.cubes = [];
    const glowTex = canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(140,180,255,1)'); gr.addColorStop(0.5, 'rgba(100,140,255,.45)'); gr.addColorStop(1, 'rgba(100,140,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    apps.forEach((app, i) => {
      const tex = canvasTex(192, 192, (g, w, h) => {
        card(g, w, h, 'rgba(30,40,80,1)', 36);
        text(g, app.icon, w / 2, h * 0.42, 84);
        text(g, app.name, w / 2, h * 0.84, 24);
      });
      const front = new THREE.MeshBasicMaterial({ map: tex, color: 0xa8b4d4 });
      const side = new THREE.MeshLambertMaterial({ color: 0x3a4a86 });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.2), [side, side, side, side, front, side]);
      cube.userData = { ang: ((-22.5 + i * 15) * Math.PI) / 180, h: 0 };
      cube.rotation.y = -cube.userData.ang;
      // additive glow behind the cube: it can only ever brighten
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      glow.position.z = -0.11; cube.add(glow); cube.userData.glow = glow;
      // invisible, larger hit box (child, so it grows with the hover lift = built-in hysteresis)
      const hit = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
      hit.userData = { interactive: true, mats: [front], owner: cube, onClick: () => this.openApp(app) };
      cube.add(hit);
      this.placeCube(cube);
      this.home.add(cube); this.homeBtns.push(hit); this.cubes.push(cube);
    });
  }

  placeCube(m) {
    const { ang, h } = m.userData;
    const r = 2.55 - 0.18 * h;
    m.position.set(Math.sin(ang) * r, -0.8 + 0.04 * h, -Math.cos(ang) * r);
    m.scale.setScalar(1 + 0.12 * h);
  }

  addHomeButton(label, angle, onClick) {
    const b = makePanel({
      w: 0.9, h: 0.34, r: R - 0.03, angle, y: -0.15, px: 256, interactive: true,
      draw: (g, w, h) => { card(g, w, h, 'rgba(79,124,255,.55)', 40); text(g, label, w / 2, h / 2, 40, { weight: '600' }); },
      onClick,
    });
    this.home.add(b); this.homeBtns.push(b);
  }

  openApp(app) {
    if (this.win) return;
    const group = new THREE.Group();
    this.group.add(group);
    const btns = [];
    const frame = makePanel({
      w: 3.6, h: 2.2, r: R - 0.15, y: 0.4, px: 1024,
      draw: (g, w, h) => { card(g, w, h, 'rgba(14,20,40,.94)'); text(g, `${app.icon}  ${app.name}`, 60, 60, 44, { align: 'left', weight: '700' }); },
    });
    const close = makePanel({
      w: 0.4, h: 0.4, r: R - 0.2, angle: 29, y: 1.25, px: 128, interactive: true,
      draw: (g, w, h) => { card(g, w, h, 'rgba(255,90,90,.7)', 40); text(g, '✕', w / 2, h / 2, 56); },
      onClick: () => this.closeApp(),
    });
    group.add(frame, close); btns.push(close);
    const ctx = {
      parent: group,
      frame,
      actions: this.actions,
      target: (m) => { btns.push(m); return m; },
      text: (lines) => group.add(makePanel({
        w: 3.3, h: 1.5, r: R - 0.2, y: 0.3, px: 1024,
        draw: (g, w, h) => lines.forEach((l, i) => text(g, l, w / 2, h * (0.2 + i * 0.15), i === 0 ? 76 : 40, { color: i === 0 ? '#fff' : '#9fb0d8', weight: i === 0 ? '700' : '500' })),
      })),
      button: (opts) => { const b = makePanel({ ...opts, interactive: true }); group.add(b); btns.push(b); return b; },
    };
    app.init(ctx);
    this.win = { app, group, btns, t: 0, closing: false };
    this.home.visible = false;
    this.actions.sound && this.actions.sound('open');
  }

  closeApp() {
    if (!this.win || this.win.closing) return;
    this.win.closing = true;
    this.home.visible = true;
  }

  targets() {
    if (!this.win) return this.homeBtns;
    return this.win.closing ? [] : this.win.btns;
  }

  setExtra(s) { this.extra = s; }

  update(dt, hover) {
    this.cubes.forEach((m) => {
      m.userData.h += ((hover && hover.userData.owner === m ? 1 : 0) - m.userData.h) * Math.min(1, dt * 12);
      m.userData.glow.material.opacity = m.userData.h * 0.9;
      this.placeCube(m);
    });
    const w = this.win;
    if (w) {
      w.t = Math.max(0, Math.min(1, w.t + (w.closing ? -dt : dt) / 0.25));
      const e = w.t * w.t * (3 - 2 * w.t);
      w.group.scale.setScalar(0.85 + 0.15 * e);
      w.group.traverse((n) => { if (n.material) n.material.opacity = e; });
      w.app.update(dt);
      if (w.closing && w.t === 0) { w.app.dispose(); this.group.remove(w.group); disposeTree(w.group); this.win = null; }
    }
    this.drawStatus();
  }

  drawStatus() {
    const d = new Date();
    const lvl = this.battery ? Math.round(this.battery.level * 100) + '%' : '--';
    const key = `${pad(d.getHours())}:${pad(d.getMinutes())}|${navigator.onLine}|${lvl}|${this.extra}`;
    if (key === this.statusKey) return;
    this.statusKey = key;
    const t = this.statusPanel.userData.tex, c = t.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    card(g, c.width, c.height, 'rgba(20,28,52,.75)', 40);
    text(g, `${pad(d.getHours())}:${pad(d.getMinutes())}`, c.width * 0.2, c.height / 2, 52, { weight: '700' });
    text(g, navigator.onLine ? 'Wi-Fi ●' : 'Offline', c.width * 0.5, c.height / 2, 38, { color: '#9fb0d8' });
    text(g, `🔋 ${lvl}`, c.width * 0.78, c.height / 2, 38, { color: '#9fb0d8' });
    if (this.extra) text(g, this.extra, c.width * 0.5, c.height * 0.88, 22, { color: '#7CFC9A' });
    t.needsUpdate = true;
  }
}
