import { card, text } from '../ui/kit.js';
import { openWebWindow, toEmbed } from '../ui/webwindow.js';

const ROWS = [
  '1234567890'.split(''), 'qwertyuiop'.split(''), 'asdfghjkl'.split(''),
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'], [':', '/', '.', '-', '_', '?', 'space', 'Go'],
];
const WT = { space: 4, Go: 2 };
function layout(row) {
  const tot = row.reduce((a, k) => a + (WT[k] || 1), 0);
  let x = 0;
  return row.map((k) => { const w = (WT[k] || 1) / tot; const r = { k, x, w }; x += w; return r; });
}
const BAR = [['back', 0, 0.07], ['fwd', 0.07, 0.14], ['reload', 0.14, 0.21], ['url', 0.21, 0.66], ['kbd', 0.66, 0.76], ['go', 0.76, 0.87], ['web', 0.87, 1]];
const LABEL = { back: '◀', fwd: '▶', reload: '⟳', kbd: '⌨', go: 'Go', web: 'Web' };
const WELCOME = 'VR Browser\n\nType a web address or a search term with the keyboard, then look at Go for a text reader view, or Web for a real web window (iframe, touch-scroll only; YouTube links become embeds).\n\nMost websites forbid being embedded in other pages, so this browser shows a text-only "reader" version of each page, fetched through a reader proxy (default r.jina.ai). No images, scripts or logins. For full websites use the PC Stream app.';

/** Browser app: 3D address bar, gaze keyboard, text reader view through a CORS-friendly reader proxy. */
export const browser = {
  id: 'browser',
  name: 'Browser',
  icon: '🌐',

  init(ctx) {
    ctx.frame.visible = false;
    Object.assign(this, { closed: false, tok: 0, hist: [], pos: -1, input: '', scroll: 0, lines: [], hk: null, hb: null });
    this.measure = document.createElement('canvas').getContext('2d');
    const mk = (opts, extra) => { const m = ctx.button(opts); m.material.color.setHex(0xffffff); Object.assign(m.userData, { mats: [] }, extra); return m; };

    this.bar = mk({ w: 2.8, h: 0.3, r: 2.85, angle: -4, y: 1.2, px: 1024, draw: () => {} }, {
      region: (uv) => { const b = BAR.find(([, a, z]) => uv.x >= a && uv.x < z); return b ? b[0] : null; },
      onHover: (id) => { this.hb = id; this.drawBar(); },
      onClick: (id) => this.barClick(id),
    });
    this.content = mk({ w: 3.8, h: 1.5, r: 2.85, y: 0.2, px: 1536, draw: () => {} }, {
      region: (uv) => (uv.x > 0.93 ? (uv.y > 0.5 ? 'up' : 'down') : null),
      dwell: 0.5, repeat: true,
      onClick: (id) => { this.scroll = Math.max(0, Math.min(Math.max(0, this.lines.length - 16), this.scroll + (id === 'up' ? -6 : 6))); this.drawContent(); },
    });
    this.kb = mk({ w: 3.4, h: 0.95, r: 2.8, y: -0.7, px: 1024, draw: () => {} }, {
      region: (uv) => { const ri = Math.min(4, Math.floor((1 - uv.y) * 5)); const c = layout(ROWS[ri]).find((q) => uv.x >= q.x && uv.x < q.x + q.w); return c ? c.k : null; },
      dwell: 0.7,
      onHover: (id) => { this.hk = id; this.drawKb(); },
      onClick: (id) => this.key(id),
    });
    this.drawBar(); this.drawKb();
    this.setBody(WELCOME);
  },

  ctx2d(m) { const c = m.userData.tex.image; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); return [g, c.width, c.height]; },

  drawBar() {
    const [g, w, h] = this.ctx2d(this.bar);
    card(g, w, h, 'rgba(20,28,52,.92)', 36);
    BAR.forEach(([id, a, z]) => {
      const x = a * w + 4, bw = (z - a) * w - 8;
      g.fillStyle = this.hb === id ? 'rgba(111,160,255,.75)' : id === 'url' ? 'rgba(255,255,255,.12)' : 'rgba(79,124,255,.4)';
      g.fillRect(x, 8, bw, h - 16);
      if (id === 'url') {
        const shown = this.input || 'type address or search…';
        g.save(); g.beginPath(); g.rect(x, 8, bw, h - 16); g.clip();
        text(g, this.input ? shown + '▏' : shown, x + 12, h / 2, 40, { align: 'left', color: this.input ? '#fff' : '#7f8fb8' });
        g.restore();
      } else text(g, LABEL[id], x + bw / 2, h / 2, 44, { weight: '700' });
    });
    this.bar.userData.tex.needsUpdate = true;
  },

  drawKb() {
    const [g, w, h] = this.ctx2d(this.kb);
    card(g, w, h, 'rgba(20,28,52,.94)', 30);
    const rh = h / 5;
    ROWS.forEach((row, ri) => layout(row).forEach((c) => {
      g.fillStyle = this.hk === c.k ? 'rgba(111,160,255,.9)' : c.k === 'Go' ? 'rgba(79,124,255,.6)' : 'rgba(255,255,255,.14)';
      g.fillRect(c.x * w + 4, ri * rh + 4, c.w * w - 8, rh - 8);
      text(g, c.k === 'space' ? '␣' : c.k, (c.x + c.w / 2) * w, ri * rh + rh / 2, 34, { weight: '600' });
    }));
    this.kb.userData.tex.needsUpdate = true;
  },

  drawContent() {
    const [g, w, h] = this.ctx2d(this.content);
    card(g, w, h, 'rgba(14,20,40,.95)', 30);
    this.lines.slice(this.scroll, this.scroll + 16).forEach((l, i) => text(g, l, 28, 32 + i * 36, 30, { align: 'left', weight: '400' }));
    g.fillStyle = 'rgba(79,124,255,.35)';
    g.fillRect(w * 0.93, 8, w * 0.07 - 8, h / 2 - 12); g.fillRect(w * 0.93, h / 2 + 4, w * 0.07 - 8, h / 2 - 12);
    text(g, '▲', w * 0.965, h * 0.25, 40); text(g, '▼', w * 0.965, h * 0.75, 40);
    this.content.userData.tex.needsUpdate = true;
  },

  setBody(str) {
    this.measure.font = '400 30px -apple-system, system-ui, sans-serif';
    const maxW = 1536 * 0.93 - 56, out = [];
    str.split('\n').forEach((para) => {
      let line = '';
      para.split(' ').forEach((word) => {
        const t = line ? line + ' ' + word : word;
        if (this.measure.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
      });
      out.push(line);
    });
    this.lines = out; this.scroll = 0; this.drawContent();
  },

  key(k) {
    if (k === '⌫') this.input = this.input.slice(0, -1);
    else if (k === 'Go') { this.go(this.input); return; }
    else if (this.input.length < 120) this.input += k === 'space' ? ' ' : k;
    this.drawBar();
  },

  barClick(id) {
    if (id === 'kbd') this.kb.visible = !this.kb.visible;
    else if (id === 'go') this.go(this.input);
    else if (id === 'web') {
      const q = this.input.trim();
      if (!q) { this.setBody('Type an address first, then look at Web.'); return; }
      openWebWindow(toEmbed(/^https?:\/\//i.test(q) ? q : 'https://' + q));
    }
    else if (id === 'url') { this.input = ''; this.drawBar(); }
    else if (id === 'reload' && this.pos >= 0) this.load(this.hist[this.pos], false);
    else if (id === 'back' && this.pos > 0) { this.pos--; this.load(this.hist[this.pos], false); }
    else if (id === 'fwd' && this.pos < this.hist.length - 1) { this.pos++; this.load(this.hist[this.pos], false); }
  },

  go(raw) {
    const q = raw.trim();
    if (!q) return;
    const hasScheme = /^https?:\/\//i.test(q);
    const looksUrl = hasScheme || /^[^\s]+\.[a-z]{2,}(\/\S*)?$/i.test(q);
    this.load(looksUrl ? (hasScheme ? q : 'https://' + q) : 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q), true);
  },

  async load(target, push) {
    if (push) { this.hist = this.hist.slice(0, this.pos + 1); this.hist.push(target); this.pos = this.hist.length - 1; }
    this.input = target.replace(/^https?:\/\//, ''); this.drawBar();
    this.setBody('Loading…');
    const tok = ++this.tok;
    let proxy = 'https://r.jina.ai/{url}';
    try { proxy = localStorage.getItem('vros.proxy') || proxy; } catch { /* storage unavailable */ }
    try {
      const res = await fetch(proxy.replace('{url}', target));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let t = await res.text();
      if (this.closed || tok !== this.tok) return;
      t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[#*_`>]+/g, '').replace(/\n{3,}/g, '\n\n');
      this.setBody(t.slice(0, 40000));
    } catch (e) {
      if (!this.closed && tok === this.tok) this.setBody('Could not load this page.\n\n' + e.message + '\n\nThe reader proxy may be down or blocked on your network. Try another page, or use the PC Stream app.');
    }
  },

  update() {},
  dispose() { this.closed = true; },
};
