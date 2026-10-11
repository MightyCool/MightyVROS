import * as THREE from 'three';
import { settings } from './core/settings.js';
import { StereoRenderer } from './core/stereo.js';
import { HeadTracker } from './core/tracking.js';
import { Gaze } from './input/gaze.js';
import { Launcher } from './ui/launcher.js';
import { buildRoom } from './world/room.js';

const $ = (id) => document.getElementById(id);
const startBtn = $('start'), msg = $('msg'), hud = $('hud');

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (!hasWebGL2()) { msg.textContent = 'WebGL2 is not available (needs iOS 15+ Safari).'; startBtn.disabled = true; }
if (new URLSearchParams(location.search).has('debug')) settings.debug = true;

const tracker = new HeadTracker(settings);

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  try { await tracker.enable(); } catch (e) { msg.textContent = e.message; }
  try { boot(); } catch (e) { msg.textContent = 'Could not start: ' + e.message; startBtn.disabled = false; return; }
  $('intro').hidden = true;
  document.body.classList.add('running');
});

function boot() {
  const stereo = new StereoRenderer($('gl'), settings);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1a);
  scene.add(stereo.head);

  buildRoom(scene);

  const launcher = new Launcher(scene, {
    recenter: () => tracker.recenter(),
    flipAxis: () => tracker.cycleOrient(),
    toggleDebug: () => { settings.debug = !settings.debug; hud.hidden = !settings.debug; launcher.setExtra(''); },
  });
  const gaze = new Gaze(stereo.head, settings);
  tracker.enableDrag($('gl'));
  hud.hidden = !settings.debug;

  // Two-finger tap toggles debug overlay
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 3) tracker.cycleOrient();
    if (e.touches.length === 2) { settings.debug = !settings.debug; hud.hidden = !settings.debug; launcher.setExtra(''); }
  });

  let last = performance.now(), acc = 0, frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    tracker.update(dt);
    stereo.head.quaternion.copy(tracker.quaternion);
    stereo.head.updateMatrixWorld(true);
    gaze.update(dt, launcher.targets());
    launcher.update(dt, gaze.hover);
    stereo.render(scene);

    acc += dt; frames++;
    if (acc >= 1) {
      const fps = frames / acc;
      // dynamic resolution: step down fast, creep back up slowly
      if (fps < 45 && settings.scale > 0.5) { settings.scale = Math.max(0.5, settings.scale - 0.1); stereo.resizeTarget(); }
      else if (fps > 58 && settings.scale < 1) { settings.scale = Math.min(1, settings.scale + 0.05); stereo.resizeTarget(); }
      if (settings.debug) {
        const s = `${fps.toFixed(0)} fps · ${(settings.scale * 100).toFixed(0)}% · ${stereo.calls} calls · ori ${tracker.angle}`;
        hud.textContent = s; launcher.setExtra(s);
      }
      acc = 0; frames = 0;
    }
  }
  requestAnimationFrame(loop);
}
