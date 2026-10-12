import { card, text } from '../ui/kit.js';
import { settings, saveSettings } from '../core/settings.js';

const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(3)); return o; };
const DEFS = [
  { key: 'pr', label: 'Resolution (pixel ratio)', opts: [1, 1.25, 1.5, 2], fmt: (v) => v + '×' },
  { key: 'scaleMode', label: 'Render scale', opts: ['auto', 1, 0.85, 0.7, 0.5], fmt: (v) => (v === 'auto' ? 'Auto' : Math.round(v * 100) + '%') },
  { key: 'aa', label: 'Anti-aliasing', opts: [0, 2, 4], fmt: (v) => (v ? v + '×' : 'Off') },
  { key: 'sharpen', label: 'Sharpen', opts: [0, 0.25, 0.5, 0.75], fmt: (v) => (v ? Math.round(v * 100) + '%' : 'Off') },
  { key: 'fov', label: 'Field of view', opts: range(70, 110, 5), fmt: (v) => v + '°' },
  { key: 'ipd', label: 'IPD', opts: range(0.056, 0.072, 0.002), fmt: (v) => Math.round(v * 1000) + ' mm' },
  { key: 'lens', label: 'Lens correction', opts: [0, 0.5, 0.75, 1, 1.25, 1.5], fmt: (v) => Math.round(v * 100) + '%' },
  { key: 'dwell', label: 'Gaze click time', opts: [0.6, 0.8, 1, 1.2, 1.5, 2], fmt: (v) => v + ' s' },
];

const idx = (d) => {
  const v = settings[d.key];
  const i = d.opts.indexOf(v);
  if (i >= 0) return i;
  if (typeof v !== 'number') return 0;
  return d.opts.reduce((b, o, j) => (typeof o === 'number' && Math.abs(o - v) < Math.abs(d.opts[b] - v) ? j : b), 1);
};

/** Settings app: one row per setting, gaze the − / + boxes. Saved on this phone. */
export const settingsApp = {
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',

  init(ctx) {
    this.rows = DEFS.map((d, i) => {
      const m = ctx.button({ w: 3.2, h: 0.19, r: 2.8, y: 1.1 - i * 0.21, px: 1024, draw: () => {} });
      m.material.color.setHex(0xffffff);
      Object.assign(m.userData, {
        mats: [], dwell: 0.6, repeat: true, hl: null,
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
