import { Fusion } from './fusion.js';

const ACC = 4 / 16384;                    // g per LSB (+-8 g range)
const GYR = (0.06103 * Math.PI) / 180;    // rad/s per LSB (+-2000 dps range)
const RUMBLE = [0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40];
const BTN = {
  R: [[3, 0x01, 'y'], [3, 0x02, 'x'], [3, 0x04, 'b'], [3, 0x08, 'a'], [3, 0x40, 'r'], [3, 0x80, 'zr'], [4, 0x02, 'plus'], [4, 0x04, 'rstick'], [4, 0x10, 'home']],
  L: [[5, 0x01, 'down'], [5, 0x02, 'up'], [5, 0x04, 'right'], [5, 0x08, 'left'], [5, 0x40, 'l'], [5, 0x80, 'zl'], [4, 0x01, 'minus'], [4, 0x08, 'lstick'], [4, 0x20, 'capture']],
};
const i16 = (b, o) => b.readInt16LE(o);

/** Reply to an SPI read of address 0x6050 (report 0x21): the Joy-Con's own body colour [r,g,b], else null. */
export function parseColor(b) {
  if (b.length < 23 || b[0] !== 0x21 || b[14] !== 0x10 || b[15] !== 0x50 || b[16] !== 0x60) return null;
  return [b[20], b[21], b[22]];
}

/** One 0x30 input report -> {q,b,st,ts} (feeds the fusion filter with the 3 IMU samples inside). null if not a full report. */
export function parseReport(side, b, fus) {
  if (b.length < 49 || b[0] !== 0x30) return null;
  for (let s = 0; s < 3; s++) {
    const o = 13 + s * 12;
    let a = [i16(b, o) * ACC, i16(b, o + 2) * ACC, i16(b, o + 4) * ACC];
    let g = [i16(b, o + 6) * GYR, i16(b, o + 8) * GYR, i16(b, o + 10) * GYR];
    if (side === 'L') { a = [a[0], -a[1], -a[2]]; g = [g[0], -g[1], -g[2]]; } // left Joy-Con mirrors y/z
    fus.update(g, a, 1 / 180);
  }
  const bt = BTN[side].filter(([i, m]) => b[i] & m).map((x) => x[2]);
  const o = side === 'L' ? 6 : 9;
  const sx = b[o] | ((b[o + 1] & 0x0f) << 8), sy = (b[o + 1] >> 4) | (b[o + 2] << 4);
  return { q: fus.xyzw(), b: bt, st: [Math.max(-1, Math.min(1, (sx - 2048) / 1500)), Math.max(-1, Math.min(1, (sy - 2048) / 1500))], ts: Date.now() };
}

/** Reads paired Joy-Cons over Bluetooth HID (node-hid), fuses IMU to an orientation, reports buttons/stick. Returns {states, stop}. */
export async function startJoycons(log = () => {}) {
  const states = { L: null, R: null };
  let HID;
  try { HID = (await import('node-hid')).default; } catch (e) { log('Joy-Con support off: ' + e.message); return { states, stop() {} }; }
  const devs = [];
  for (const d of HID.devices()) {
    if (d.vendorId !== 0x057e || (d.productId !== 0x2006 && d.productId !== 0x2007)) continue;
    const side = d.productId === 0x2006 ? 'L' : 'R';
    if (devs.some((x) => x.side === side)) continue;
    try {
      const dev = new HID.HID(d.path);
      let pn = 0;
      const out = (sub, arg) => { const p = Buffer.alloc(49); p[0] = 0x01; p[1] = pn++ & 0xf; RUMBLE.forEach((v, i) => { p[2 + i] = v; }); p[10] = sub; [].concat(arg).forEach((v, i) => { p[11 + i] = v; }); dev.write([...p]); };
      let col = null;
      const fus = new Fusion();
      dev.on('data', (b) => {
        const c = parseColor(b);
        if (c) { col = c; log(`Joy-Con ${side} colour ${c.join(',')}`); return; }
        const r = parseReport(side, b, fus);
        if (r) { if (col) r.col = col; states[side] = r; }
      });
      dev.on('error', () => { states[side] = null; });
      setTimeout(() => out(0x40, 0x01), 100);   // enable IMU
      setTimeout(() => out(0x03, 0x30), 250);   // full-rate standard input reports (60 Hz, 3 IMU samples each)
      for (const t of [500, 1500, 3500]) setTimeout(() => { if (!col) out(0x10, [0x50, 0x60, 0x00, 0x00, 0x0d]); }, t); // read the body colour from the Joy-Con's flash memory
      devs.push({ side, dev });
      log(`Joy-Con ${side}: connected`);
    } catch (e) { log(`Joy-Con ${side}: could not open (${e.message})`); }
  }
  if (!devs.length) log('No Joy-Cons found (pair them to this PC by Bluetooth first).');
  return { states, stop() { devs.forEach((d) => { try { d.dev.close(); } catch { /* already closed */ } }); } };
}
