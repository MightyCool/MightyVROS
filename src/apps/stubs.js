import { pcStream } from './pcstream.js';
import { browser } from './browser.js';
import { controllersApp } from './controllers.js';
import { settingsApp } from './settings.js';

/** App API: { id, name, icon, init(ctx), update(dt), dispose() }. ctx = { text(lines), button(opts), parent }. */
const stub = (id, name, icon, stage, desc) => ({
  id, name, icon,
  init(ctx) { ctx.text([name, '', desc, '', `Arrives in stage ${stage}.`]); },
  update() {},
  dispose() {},
});

export const apps = [
  settingsApp,
  browser,
  pcStream,
  controllersApp,
  stub('ar', 'AR Game', '🎯', 4, 'Camera passthrough, pop the targets.'),
];
