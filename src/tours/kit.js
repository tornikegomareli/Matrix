// What the scenes of the tours share: overlays, events, and the clock of the tour
import * as THREE from 'three';
import { CLOUD_Y, clamp, lerp, smooth } from '../core.js';
import { P, build } from '../state.js';
import { U } from '../renderer.js';
import { camera } from '../scene.js';
import { wave } from '../world/city.js';
import { thunder } from '../audio.js';
import { chunks, startWave } from '../world/chunks.js';
import { fx, makeBolt } from '../fx.js';

export const V = THREE.Vector3;
export const M = [0.4082, 0.4082, -0.8165];                              // moon direction (from the sky shader)
export const W0 = { film: 55, city: 0, train: 100, wave: 200, sky: 1090, loop: 300, poster: 300 };   // the world clock at the start of each scene

// ── overlays ──
export const els = [], GREEN = '#39ff7a', MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
export const mk = css => { const e = document.createElement('div'); e.style.cssText = css; document.body.append(e); els.push(e); return e; };
export const TEXT_CSS = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 7.5vh ${MONO};color:${GREEN};text-shadow:0 0 2.2vh rgba(57,255,122,.8);white-space:pre;letter-spacing:.06em`;
// text typed on black, one letter at a time, in silence
export const typeText = (el, text, t, t0, dt) => {
  const n = clamp(Math.floor((t - t0) / dt) + 1, 0, text.length);
  const cur = (n > 0 && n < text.length) || Math.floor(t / 0.45) % 2 === 0;
  el.innerHTML = text.slice(0, n) + `<span style="display:inline-block;width:.6em;height:1.05em;margin-left:.1em;vertical-align:-.16em;background:${GREEN};box-shadow:0 0 2.2vh ${GREEN};opacity:${cur ? 1 : 0}"></span>`;
};

// ── events ──
const flashAt = (lx, lz, y, amp, strike, hy) => {
  U.uFlashPos.value.set(lx, hy === undefined ? CLOUD_Y + 90 : hy, lz); U.uFlashDir.value.set(lx - P.pos.x, 420, lz - P.pos.z).normalize();
  fx.flashT = 0; fx.flashAmp = amp; fx.nextFlash = 9 + Math.random() * 6;
  thunder(Math.hypot(lx - P.pos.x, y - P.pos.y, lz - P.pos.z), amp, (lx - P.pos.x) * Math.cos(P.yaw) - (lz - P.pos.z) * Math.sin(P.yaw), strike);
};
export const farFlash = (dist, amp) => () => {
  const f = camera.getWorldDirection(new V()), l = Math.hypot(f.x, f.z) || 1;
  fx.bolt = null; flashAt(P.pos.x + f.x / l * dist - f.z / l * dist * 0.3, P.pos.z + f.z / l * dist + f.x / l * dist * 0.3, CLOUD_Y, amp, false);
};
export const strike = (dMin, dMax) => () => {                            // a bolt on the mast that is most in front of the camera
  const f = camera.getWorldDirection(new V()); let best = null, bs = -1;
  for (const ch of chunks.values()) for (const c of ch.cells) for (const b of c.beacons) {
    const dx = b[0] - P.pos.x, dy = b[1] - P.pos.y, dz = b[2] - P.pos.z, d = Math.hypot(dx, dz);
    if (d < dMin || d > dMax || b[1] > CLOUD_Y - 60) continue;
    const dot = (dx * f.x + dy * f.y + dz * f.z) / Math.hypot(dx, dy, dz);
    if (dot > bs) { bs = dot; best = b; }
  }
  if (!best) return;
  fx.bolt = makeBolt(best[0], best[1], best[2]);
  flashAt(fx.bolt.top[0], fx.bolt.top[2], best[1], 2.3, true);
};
export const cloudFlash = (x, y, z, amp) => () => { fx.bolt = null; flashAt(x, z, y, amp, false, y); };   // lightning inside a cloud: it glows, with no bolt
export const waveDir = (dx, dz) => () => {
  startWave();
  if (dx !== undefined) { wave.dx = dx; wave.dz = dz; U.uWave.value.x = dx; U.uWave.value.y = dz; }
};
export const standing = () => { build.auto = false; build.on = false; U.uBuild.value.w = 0; };      // the scene starts in a city that already stands
export const unbuilt = (x, z) => { build.auto = false; build.on = true; build.speed = 0; build.r = 0; U.uBuild.value.set(x, z, 0, 1); };   // nothing stands yet
export const st = window.__tour = { t: 0, n: 0, go: false, f: new V(0, 0, 1), right: new V(1, 0, 0), roll: 0, head: 0, evi: 0 };
export const lin = (keys, t) => {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) if (t < keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], smooth(keys[i][0], keys[i + 1][0], t));
  return keys[keys.length - 1][1];
};
