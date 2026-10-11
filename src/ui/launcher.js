import * as THREE from 'three';
import { R, makePanel, card, text, disposeTree } from './kit.js';
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
    this.statusPanel = makePanel({ w: 1.9, h: 0.24, r: R, y: 1.7, px: 512, draw: () => {} });
    this.home.add(this.statusPanel);

    // Main curved panel
    this.home.add(makePanel({
      w: 4.2, h: 2.0, y: 0.4, px: 1024,
      draw: (g, w, h) => {
        card(g, w, h);
        text(g, 'VR OS', w / 2, h * 0.3, 120, { weight: '700' });
        text(g, 'Look at an app and hold your gaze to open it', w / 2, h * 0.5, 42, { color: '#9fb0d8' });
        text(g, 'Stage 1 · vertical slice', w / 2, h * 0.62, 32, { color: '#6c7fb0' });
      },
    }));
    this.addHomeButton('Recenter', -12, () => actions.recenter());
    this.addHomeButton('Debug', 12, () => actions.toggleDebug());

    // Dock
    this.home.add(makePanel({ w: 3.0, h: 0.95, y: -1.3, px: 768, draw: (g, w, h) => card(g, w, h, 'rgba(255,255,255,.10)', 60) }));
    apps.forEach((app, i) => {
      const b = makePanel({
        w: 0.62, h: 0.78, r: R - 0.03, angle: -22.5 + i * 15, y: -1.3, px: 192, interactive: true,
        draw: (g, w, h) => {
          card(g, w, h, 'rgba(255,255,255,.14)', 36);
          text(g, app.icon, w / 2, h * 0.42, 84);
          text(g, app.name, w / 2, h * 0.84, 24);
        },
        onClick: () => this.openApp(app),
      });
      this.home.add(b); this.homeBtns.push(b);
    });
  }

  addHomeButton(label, angle, onClick) {
    const b = makePanel({
      w: 0.9, h: 0.34, r: R - 0.03, angle, y: -0.2, px: 256, interactive: true,
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

  update(dt) {
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
