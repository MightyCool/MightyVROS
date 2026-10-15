/** Mouse/keyboard injection from the headset (Windows, via user32 through koffi: no native build step). */
const VK = { Enter: 0x0d, Backspace: 0x08, Esc: 0x1b, ' ': 0x20, Tab: 0x09, ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28 };

export async function createInput() {
  const none = { ok: false, screen: null, handle() {}, why: 'Remote control is only built for Windows (streaming still works)' };
  if (process.platform !== 'win32') return none;
  try {
    const koffi = (await import('koffi')).default;
    const u = koffi.load('user32.dll');
    const api = {
      dpi: u.func('bool SetProcessDPIAware()'),
      metric: u.func('int GetSystemMetrics(int)'),
      pos: u.func('bool SetCursorPos(int, int)'),
      mouse: u.func('void mouse_event(uint32_t, uint32_t, uint32_t, int32_t, uintptr_t)'),
      key: u.func('void keybd_event(uint8_t, uint8_t, uint32_t, uintptr_t)'),
      scan: u.func('int16_t VkKeyScanW(uint16_t)'),
    };
    api.dpi();
    const screen = { w: api.metric(0), h: api.metric(1) };
    const tap = (vk) => { api.key(vk, 0, 0, 0); api.key(vk, 0, 2, 0); };
    return {
      ok: true, screen,
      handle(m) {
        if (m.t === 'move' || m.t === 'click') {
          api.pos(Math.round(Math.max(0, Math.min(1, +m.x)) * (screen.w - 1)), Math.round(Math.max(0, Math.min(1, +m.y)) * (screen.h - 1)));
          if (m.t === 'click') { const r = m.b === 'right'; api.mouse(r ? 0x8 : 0x2, 0, 0, 0, 0); api.mouse(r ? 0x10 : 0x4, 0, 0, 0, 0); }
        } else if (m.t === 'wheel') api.mouse(0x800, 0, 0, -Math.round(+m.dy * 40), 0);
        else if (m.t === 'key') {
          const k = String(m.k);
          if (VK[k]) tap(VK[k]);
          else if (k.length === 1) {
            const s = api.scan(k.charCodeAt(0));
            if (s === -1) return;
            const shift = (s >> 8) & 1;
            if (shift) api.key(0x10, 0, 0, 0);
            tap(s & 0xff);
            if (shift) api.key(0x10, 0, 2, 0);
          }
        }
      },
    };
  } catch (e) { return { ...none, why: 'Input injection unavailable: ' + e.message }; }
}
