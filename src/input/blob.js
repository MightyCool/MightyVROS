/** Colour-blob finding on a small RGBA frame (no DOM needed, unit-testable). */
export const W = 160, H = 90;

export function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}

export const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

/**
 * Largest connected region whose pixels match the colour {h,s,v}. Returns {cx,cy (0..1), n, mean:[h,s,v]} or null.
 * Connected-component selection ignores scattered false matches (a red cup elsewhere only wins if it is bigger).
 */
export function findBlob(d, col, hTol = 16) {
  const sMin = Math.max(0.2, col.s - 0.3), vMin = Math.max(0.15, col.v - 0.35);
  const mask = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const [h, s, v] = rgb2hsv(d[p], d[p + 1], d[p + 2]);
    if (s > sMin && v > vMin && hueDist(h, col.h) < hTol) mask[i] = 1;
  }
  let best = null;
  const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue;
    let n = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0;
    stack.push(start); mask[start] = 2;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      n++; sx += x; sy += y; sr += d[i * 4]; sg += d[i * 4 + 1]; sb += d[i * 4 + 2];
      if (x > 0 && mask[i - 1] === 1) { mask[i - 1] = 2; stack.push(i - 1); }
      if (x < W - 1 && mask[i + 1] === 1) { mask[i + 1] = 2; stack.push(i + 1); }
      if (y > 0 && mask[i - W] === 1) { mask[i - W] = 2; stack.push(i - W); }
      if (y < H - 1 && mask[i + W] === 1) { mask[i + W] = 2; stack.push(i + W); }
    }
    if (n >= 8 && (!best || n > best.n)) best = { n, sx, sy, sr, sg, sb };
  }
  if (!best) return null;
  return { cx: best.sx / best.n / W, cy: best.sy / best.n / H, n: best.n, mean: rgb2hsv(best.sr / best.n, best.sg / best.n, best.sb / best.n) };
}

/** Adaptive low-pass: heavy smoothing when slow (steady aim), light when fast (no lag). */
export class Smooth {
  constructor(min = 1.5, beta = 8) { this.min = min; this.beta = beta; this.v = null; }
  reset() { this.v = null; }
  /** x: number[] ; dt seconds ; returns smoothed array */
  update(x, dt) {
    if (!this.v) { this.v = x.slice(); return this.v; }
    const speed = Math.hypot(...x.map((a, i) => a - this.v[i])) / Math.max(dt, 1e-3);
    const a = 1 - Math.exp(-dt * (this.min + this.beta * speed));
    this.v = this.v.map((p, i) => p + (x[i] - p) * a);
    return this.v;
  }
}
