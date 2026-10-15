import { spawn } from 'node:child_process';
import { Host } from './host.js';
import { startUi } from './ui.js';

const port = +process.env.VROS_UI_PORT || 8765;
const url = `http://127.0.0.1:${port}/`;
const open = () => {
  if (process.argv.includes('--no-open')) return;
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true, windowsHide: true }).unref(); } catch { /* no browser available */ }
};

const host = new Host();
let srv;
try {
  srv = await startUi(host, () => { host.quit(); setTimeout(() => process.exit(0), 200); });
} catch (e) {
  if (e.code === 'EADDRINUSE') { open(); process.exit(0); } // already running: just show its page
  throw e;
}
await host.start();
open();
if (process.env.VROS_DEBUG) console.log(`VR OS Host running at ${url}  code ${host.code}`);
process.on('SIGINT', () => { host.quit(); srv.close(); process.exit(0); });
process.on('SIGTERM', () => { host.quit(); srv.close(); process.exit(0); });
