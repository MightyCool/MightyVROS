import { Fusion } from '../src/fusion.js';
const mul = (a, b) => [a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3], a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2], a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1], a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
const up = (q) => { const [w, x, y, z] = q; return [2*(x*y+w*z), 1-2*(x*x+z*z), 2*(y*z-w*x)]; };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
let bad = 0;
for (const flip of [[1,1,1], [-1,-1,-1], [1,-1,1]]) {
  let q = [1, 0, 0, 0], f = new Fusion(), worst = 0; const dt = 1 / 180;
  for (let k = 0; k < 180 * 40; k++) {
    const t = k * dt, w = [1.5*Math.sin(t*1.3), 1.2*Math.sin(t*0.9+1), Math.sin(t*1.7+2)];
    const dq = mul(q, [0, ...w]); q = q.map((v, i) => v + 0.5 * dq[i] * dt); const n = Math.hypot(...q); q = q.map((v) => v / n);
    f.update(w.map((v, i) => v * flip[i] + rnd() * 0.02 + 0.01), up(q).map((v) => v + rnd() * 0.02), dt);
    if (t > 15) { const a = up(f.q), b = up(q); worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))) * 57.3); }
  }
  console.log('gyro axes', flip, 'max gravity error', worst.toFixed(2), 'deg; signs', f.sign.join(','));
  if (worst > 3) bad++;
}
process.exit(bad ? 1 : 0);
