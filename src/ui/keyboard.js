import { card, text } from './kit.js';

const ROWS = [
  '1234567890'.split(''), 'qwertyuiop'.split(''), 'asdfghjkl'.split(''),
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'], [':', '/', '.', '-', '_', '?', 'space', 'Enter'],
];
const WT = { space: 4, Enter: 2 };
const LABEL = { space: '␣', Enter: '⏎' };
const layout = (row) => {
  const tot = row.reduce((a, k) => a + (WT[k] || 1), 0);
  let x = 0;
  return row.map((k) => { const w = (WT[k] || 1) / tot; const c = { k, x, w }; x += w; return c; });
};

/** Gaze keyboard panel (hidden by default). onKey(keyName) fires after a 0.7 s dwell on a key. */
export function createKeyboard(ctx, { w = 3.4, h = 0.95, r = 2.78, y = -0.55, onKey }) {
  const m = ctx.button({ w, h, r, y, px: 1024, draw: () => {} });
  m.material.color.setHex(0xffffff);
  m.visible = false;
  let hk = null;
  const draw = () => {
    const c = m.userData.tex.image, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    card(g, c.width, c.height, 'rgba(20,28,52,.94)', 30);
    const rh = c.height / 5;
    ROWS.forEach((row, ri) => layout(row).forEach((k) => {
      g.fillStyle = hk === k.k ? 'rgba(111,160,255,.9)' : k.k === 'Enter' ? 'rgba(79,124,255,.6)' : 'rgba(255,255,255,.14)';
      g.fillRect(k.x * c.width + 4, ri * rh + 4, k.w * c.width - 8, rh - 8);
      text(g, LABEL[k.k] || k.k, (k.x + k.w / 2) * c.width, ri * rh + rh / 2, 34, { weight: '600' });
    }));
    m.userData.tex.needsUpdate = true;
  };
  Object.assign(m.userData, {
    mats: [], dwell: 0.7,
    region: (uv) => { const ri = Math.min(4, Math.floor((1 - uv.y) * 5)); const k = layout(ROWS[ri]).find((q) => uv.x >= q.x && uv.x < q.x + q.w); return k ? k.k : null; },
    onHover: (id) => { hk = id; draw(); },
    onClick: (id) => onKey(id),
  });
  draw();
  return m;
}
