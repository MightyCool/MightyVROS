import { card, text } from '../ui/kit.js';
import { settings, saveSettings } from '../core/settings.js';

const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(3)); return o; };
const onoff = (v) => (v ? 'On' : 'Off');
const TABS = ['Display', 'Input', 'More'];
const DEFS = [
  { page: 0, key: 'pr', label: 'Resolution (pixel ratio)', opts: [1, 1.25, 1.5, 2], fmt: (v) => v + '×' },
  { page: 0, key: 'scaleMode', label: 'Render scale', opts: ['auto', 1, 0.85, 0.7, 0.5], fmt: (v) => (v === 'auto' ? 'Auto' : Math.round(v * 100) + '%') },
  { page: 0, key: 'aa', label: 'Anti-aliasing', opts: [0, 2, 4], fmt: (v) => (v ? v + '×' : 'Off') },
  { page: 0, key: 'sharpen', label: 'Sharpen', opts: [0, 0.25, 0.5, 0.75], fmt: (v) => (v ? Math.round(v * 100) + '%' : 'Off') },
  { page: 0, key: 'fov', label: 'Field of view', opts: range(70, 110, 5), fmt: (v) => v + '°' },
  { page: 0, key: 'ipd', label: 'IPD', opts: range(0.056, 0.072, 0.002), fmt: (v) => Math.round(v * 1000) + ' mm' },
  { page: 0, key: 'mirror', label: 'Mirror image (test)', opts: [false, true], fmt: onoff },
  { page: 0, key: 'swap', label: 'Swap eyes (test)', opts: [false, true], fmt: onoff },
  { page: 1, key: 'input', label: 'Pointing', opts: ['auto', 'gaze'], fmt: (v) => (v === 'auto' ? 'Hand / controller / gaze' : 'Gaze only') },
  { page: 1, key: 'hands', label: 'Hand tracking', opts: [false, true], fmt: onoff },
  { page: 1, key: 'controllers', label: 'Joy-Con controllers', opts: [false, true], fmt: onoff },
  { page: 1, key: 'camFov', label: 'Camera field of view', opts: range(50, 80, 4), fmt: (v) => v + '°' },
  { page: 1, key: 'dwell', label: 'Gaze click time', opts: [0.6, 0.8, 1, 1.2, 1.5, 2], fmt: (v) => v + ' s' },
  { page: 2, key: 'clock', label: 'Clock', opts: ['12', '24'], fmt: (v) => v + ' hour' },
  { page: 2, key: 'passthrough', label: 'Passthrough camera', opts: [false, true], fmt: onoff },
  { page: 2, key: 'ptSize', label: 'Passthrough size', opts: ['fill', 1, 0.8, 0.6], fmt: (v) => (v === 'fill' ? 'Fill' : Math.round(v * 100) + '%') },
];

const idx = (d) => {
  const v = settings[d.key];
  const i = d.opts.indexOf(v);
  if (i >= 0) return i;
  if (typeof v !== 'number') return 0;
  return d.opts.reduce((b, o, j) => (typeof o === 'number' && Math.abs(o - v) < Math.abs(d.opts[b] - v) ? j : b), 1);
};

/** Settings app: three tabs, one row per setting, gaze the − / + boxes. Saved on this phone. */
export const settingsApp = {
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',

  init(ctx) {
    this.page = 0; this.hot = -1;
    this.tabs = TABS.map((label, i) => {
      const m = ctx.button({ w: 0.9, h: 0.3, r: 2.8, angle: (i - 1) * 19, y: 1.15, px: 256, hl: false, draw: () => {} });
      m.material.color.setHex(0xffffff);
      Object.assign(m.userData, {
        mats: [],
        setHover: (on) => { this.hot = on ? i : -1; this.drawTabs(); },
        onClick: () => { this.page = i; this.showPage(); },
      });
      return m;
    });
    const slot = [0, 0, 0];
    this.rows = DEFS.map((d) => {
      const m = ctx.button({ w: 3.2, h: 0.19, r: 2.8, y: 0.85 - slot[d.page]++ * 0.21, px: 1024, hl: false, draw: () => {} });
      m.material.color.setHex(0xffffff);
      Object.assign(m.userData, {
        mats: [], dwell: 0.6, repeat: true, hl: null, page: d.page,
        region: (uv) => (uv.x > 0.88 ? 'inc' : uv.x > 0.76 ? 'dec' : null),
        onHover: (id) => { m.userData.hl = id; this.draw(m, d); },
        onClick: (id) => {
          const j = Math.max(0, Math.min(d.opts.length - 1, idx(d) + (id === 'inc' ? 1 : -1)));
          settings[d.key] = d.opts[j];
          saveSettings();
          ctx.actions.applySettings(d.key);
          this.draw(m, d);
        },
      });
      this.draw(m, d);
      return m;
    });
    this.showPage();
  },

  showPage() {
    this.rows.forEach((m) => { m.visible = m.userData.page === this.page; });
    this.drawTabs();
  },

  drawTabs() {
    this.tabs.forEach((m, i) => {
      const c = m.userData.tex.image, g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      card(g, c.width, c.height, i === this.page ? 'rgba(79,124,255,.9)' : this.hot === i ? 'rgba(111,160,255,.6)' : 'rgba(255,255,255,.12)', 36);
      text(g, TABS[i], c.width / 2, c.height / 2, 40, { weight: '700' });
      m.userData.tex.needsUpdate = true;
    });
  },

  draw(m, d) {
    const c = m.userData.tex.image, g = c.getContext('2d'), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    card(g, w, h, 'rgba(255,255,255,.08)', 18);
    text(g, d.label, 20, h / 2, 30, { align: 'left' });
    text(g, d.fmt(d.opts[idx(d)]), w * 0.62, h / 2, 30, { weight: '700', color: '#9fc0ff' });
    [['dec', 0.76, '−'], ['inc', 0.88, '+']].forEach(([id, x, ch]) => {
      g.fillStyle = m.userData.hl === id ? 'rgba(111,160,255,.9)' : 'rgba(79,124,255,.45)';
      g.fillRect(x * w + 3, 4, 0.12 * w - 6, h - 8);
      text(g, ch, (x + 0.06) * w, h / 2, 36, { weight: '700' });
    });
    m.userData.tex.needsUpdate = true;
  },

  update() {},
  dispose() {},
};
