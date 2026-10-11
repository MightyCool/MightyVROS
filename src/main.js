import * as THREE from 'three';
import { settings } from './core/settings.js';
import { StereoRenderer } from './core/stereo.js';
import { HeadTracker } from './core/tracking.js';
import { Gaze } from './input/gaze.js';
import { Launcher } from './ui/launcher.js';

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

  // Starfield: one draw call
  const n = 400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(20 + Math.random() * 10);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x8fa8ff, size: 0.06 })));

  const launcher = new Launcher(scene, {
    recenter: () => tracker.recenter(),
    toggleDebug: () => { settings.debug = !settings.debug; hud.hidden = !settings.debug; launcher.setExtra(''); },
  });
  const gaze = new Gaze(stereo.head, settings);
  tracker.enableDrag($('gl'));
  hud.hidden = !settings.debug;

  // Two-finger tap toggles debug overlay
  window.addEventListener('touchstart', (e) => {
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
    launcher.update(dt);
    stereo.render(scene);

    acc += dt; frames++;
    if (acc >= 1) {
      const fps = frames / acc;
      // dynamic resolution: step down fast, creep back up slowly
      if (fps < 45 && settings.scale > 0.5) { settings.scale = Math.max(0.5, settings.scale - 0.1); stereo.resizeTarget(); }
      else if (fps > 58 && settings.scale < 1) { settings.scale = Math.min(1, settings.scale + 0.05); stereo.resizeTarget(); }
      if (settings.debug) {
        const s = `${fps.toFixed(0)} fps · ${(settings.scale * 100).toFixed(0)}% · ${stereo.calls} calls`;
        hud.textContent = s; launcher.setExtra(s);
      }
      acc = 0; frames = 0;
    }
  }
  requestAnimationFrame(loop);
}
