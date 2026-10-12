import * as THREE from 'three';
import { settings, loadSettings } from './core/settings.js';
import { StereoRenderer } from './core/stereo.js';
import { HeadTracker } from './core/tracking.js';
import { Gaze } from './input/gaze.js';
import { Launcher } from './ui/launcher.js';
import { buildRoom } from './world/room.js';
import { Passthrough } from './core/passthrough.js';

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

loadSettings();
const tracker = new HeadTracker(settings);

function unlockMedia() {
  try { // play a silent clip inside the tap so the element may later play stream audio unmuted
    const n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
    const w = (o, t) => [...t].forEach((c, i) => { b[o + i] = c.charCodeAt(0); });
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true); b.fill(128, 44);
    const v = $('pcv');
    v.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    v.muted = false;
    v.play().catch(() => {});
  } catch { /* best effort */ }
}

const codeEl = $('code');
try { codeEl.value = localStorage.getItem('vros.pccode') || ''; } catch { /* storage unavailable */ }

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  unlockMedia();
  try { localStorage.setItem('vros.pccode', codeEl.value.trim().toUpperCase()); } catch { /* storage unavailable */ }
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

  const room = buildRoom(scene);
  const pt = new Passthrough(stereo.head, settings);
  const setPT = async (on) => {
    try { await pt.set(on); } catch (e) { launcher.toast('Camera unavailable: ' + (e.message || e.name)); }
    settings.passthrough = pt.on;
    room.visible = !pt.on; // passthrough replaces the virtual room
  };

  const launcher = new Launcher(scene, {
    settings,
    togglePassthrough: () => { settings.passthrough = !settings.passthrough; setPT(settings.passthrough); },
    recenter: () => tracker.recenter(),
    flipAxis: () => tracker.cycleOrient(),
    applySettings: (key) => {
      if (key === 'passthrough') setPT(settings.passthrough);
      if (key === 'scaleMode') settings.scale = settings.scaleMode === 'auto' ? 1 : settings.scaleMode;
      if (key === 'aa') stereo.applyQuality(); else if (key === 'pr' || key === 'scaleMode') stereo.resize();
    },
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
    if (document.body.classList.contains('web')) return; // web window open: skip rendering
    tracker.update(dt);
    stereo.head.quaternion.copy(tracker.quaternion);
    stereo.head.updateMatrixWorld(true);
    gaze.update(dt, launcher.targets());
    launcher.update(dt, gaze.hover);
    pt.update(stereo.rt.width / 2 / stereo.rt.height);
    stereo.render(scene);

    acc += dt; frames++;
    if (acc >= 1) {
      const fps = frames / acc;
      // dynamic resolution: step down fast, creep back up slowly
      if (settings.scaleMode === 'auto') {
        if (fps < 45 && settings.scale > settings.minScale) { settings.scale = Math.max(settings.minScale, settings.scale - 0.1); stereo.resizeTarget(); }
        else if (fps > 58 && settings.scale < 1) { settings.scale = Math.min(1, settings.scale + 0.05); stereo.resizeTarget(); }
      }
      if (settings.debug) {
        const s = `${fps.toFixed(0)} fps · ${(settings.scale * 100).toFixed(0)}% · ${stereo.calls} calls · ori ${tracker.angle}`;
        hud.textContent = s; launcher.setExtra(s);
      }
      acc = 0; frames = 0;
    }
  }
  requestAnimationFrame(loop);
}
