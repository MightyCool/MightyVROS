import { parseReport, parseColor } from '../src/joycon.js';
import { Fusion } from '../src/fusion.js';
import koffi from 'koffi';
let bad = 0; const check = (name, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) bad++; };
// Right Joy-Con: A + ZR pressed, stick pushed right/up, flat on a table (accel +1 g up, no rotation)
const mk = (side) => { const b = Buffer.alloc(49); b[0] = 0x30; for (let s = 0; s < 3; s++) { const o = 13 + s * 12; b.writeInt16LE(Math.round(1 / (4 / 16384)), o + 2); } return b; };
let b = mk('R'); b[3] = 0x08 | 0x80; b[9] = 0xff; b[10] = 0x0f | 0x00; b[10] = (0x0f) | ((0x0 & 0xf) << 4); b[11] = 0xff;
b[9] = 0xff; b[10] = 0x0f | (0xf << 4); // h=0xfff, v low nibble f
const fus = new Fusion();
for (let i = 0; i < 400; i++) parseReport('R', b, fus);
const r = parseReport('R', b, fus);
check('right buttons decode (a, zr)', r.b.includes('a') && r.b.includes('zr') && !r.b.includes('b'));
check('stick decodes to ~+1 on both axes', r.st[0] > 0.9 && r.st[1] > 0.9);
check('flat orientation: gravity maps to world up', Math.abs(Math.hypot(r.q[0], r.q[1], r.q[2], r.q[3]) - 1) < 1e-6);
let L = mk('L'); L[5] = 0x80 | 0x40; L[4] = 0x01;
const rl = parseReport('L', L, new Fusion());
check('left buttons decode (zl, l, minus)', rl.b.includes('zl') && rl.b.includes('l') && rl.b.includes('minus'));
const spi = Buffer.alloc(49); spi[0] = 0x21; spi[13] = 0x90; spi[14] = 0x10; spi[15] = 0x50; spi[16] = 0x60; spi[19] = 0x0d; spi[20] = 230; spi[21] = 40; spi[22] = 50;
check('body colour parsed from an SPI reply', JSON.stringify(parseColor(spi)) === '[230,40,50]' && parseColor(b) === null);
check('short report ignored', parseReport('R', Buffer.alloc(10), fus) === null);
// Windows API prototypes must at least parse (the DLL itself only exists on Windows)
for (const p of ['bool SetProcessDPIAware()', 'int GetSystemMetrics(int)', 'bool SetCursorPos(int, int)', 'void mouse_event(uint32_t, uint32_t, uint32_t, int32_t, uintptr_t)', 'void keybd_event(uint8_t, uint8_t, uint32_t, uintptr_t)', 'int16_t VkKeyScanW(uint16_t)']) {
  let ok = true; try { koffi.proto(p.replace(/(\w+)\(/, 'P_' + Math.random().toString(36).slice(2, 7) + '(')); } catch (e) { ok = false; console.log(e.message); }
  check('koffi prototype parses: ' + p, ok);
}
process.exit(bad ? 1 : 0);
