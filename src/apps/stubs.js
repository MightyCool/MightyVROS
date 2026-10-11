/** App API: { id, name, icon, init(ctx), update(dt), dispose() }. ctx = { text(lines), button(opts), parent }. */
const stub = (id, name, icon, stage, desc) => ({
  id, name, icon,
  init(ctx) { ctx.text([name, '', desc, '', `Arrives in stage ${stage}.`]); },
  update() {},
  dispose() {},
});

export const apps = [
  stub('settings', 'Settings', '⚙️', 4, 'Input mode, IPD, FOV, render scale, volume.'),
  stub('browser', 'Browser', '🌐', 4, 'Floating web panel with keyboard.'),
  stub('pc', 'PC Stream', '🖥️', 2, 'WebRTC desktop streaming + remote input.'),
  stub('ar', 'AR Game', '🎯', 4, 'Camera passthrough, pop the targets.'),
];
