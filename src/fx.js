// Glitches and lightning
import { CLOUD_Y, TAU, clamp, lerp, smooth } from './core.js';
import { GLITCH_GAP, S } from './settings.js';
import { P, cine, view } from './state.js';
import { U } from './renderer.js';
import { _t, camera } from './scene.js';
import { chirp, thunder } from './audio.js';
import { chunks, startWave } from './world/chunks.js';
import { rib } from './world/trains.js';
import { RING, replay } from './pipeline.js';

export const fx = { scan: 0, tear: 0, ca: 0, nextGlitch: 5, force: null, flashT: 9, flashAmp: 0, nextFlash: 6, slots: [null, null], bolt: null, nextWave: 50 };
// a bolt from the cloud base to a point: a jagged main channel and a few forks
export function makeBolt(tx, ty, tz) {
  const segs = [], top = [tx + (Math.random() - 0.5) * 160, CLOUD_Y + 50, tz + (Math.random() - 0.5) * 160];
  const run = (a, b, n, w, jag) => {
    let p = a;
    for (let i = 1; i <= n; i++) {
      const t = i / n, j = i === n ? 0 : jag * (1 - t * 0.5);
      const q = [lerp(a[0], b[0], t) + (Math.random() - 0.5) * j, lerp(a[1], b[1], t), lerp(a[2], b[2], t) + (Math.random() - 0.5) * j];
      segs.push([p[0], p[1], p[2], q[0], q[1], q[2], w]);
      if (w > 0.7 && Math.random() < 0.16) run(q, [q[0] + (Math.random() - 0.5) * 150, q[1] - 40 - Math.random() * 110, q[2] + (Math.random() - 0.5) * 150], 6, 0.45, jag * 0.6);
      p = q;
    }
  };
  run(top, [tx, ty, tz], 26, 1.0, 26);
  return { segs, x: tx, y: ty, z: tz, top };
}
function pickStrike() {                                           // the top of a mast or spire ahead of the camera
  const fwd = camera.getWorldDirection(_t); let best = null, n = 0;
  for (const ch of chunks.values()) {
    if (ch.dist > 800) continue;
    for (const c of ch.cells) for (const b of c.beacons) {
      const dx = b[0] - P.pos.x, dz = b[2] - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 90 || d > 700 || b[1] > CLOUD_Y - 60 || (dx * fwd.x + dz * fwd.z) / d < 0.35) continue;
      if (Math.random() * ++n < 1) best = b;
    }
  }
  return best;
}
function pickBuilding() {                                         // a tall building in front of the camera
  const fwd = camera.getWorldDirection(_t); let best = null, n = 0;
  for (const ch of chunks.values()) {
    if (ch.dist > 520) continue;
    for (const c of ch.cells) for (const b of c.boxes) {
      if (b[9] !== 0 || b[4] < 30) continue;
      const dx = b[0] - P.pos.x, dz = b[2] - P.pos.z, dy = b[1] + b[4] * 0.5 - P.pos.y, d = Math.hypot(dx, dy, dz);
      if (d < 50 || d > 420 || (dx * fwd.x + dy * fwd.y + dz * fwd.z) / d < 0.72) continue;
      if (Math.random() * ++n < 1) best = b;
    }
  }
  return best;
}
function triggerGlitch(kind) {
  const r = Math.random();
  kind = kind || (r < 0.55 ? 'dissolve' : r < 0.8 ? 'scan' : 'dejavu');
  if (kind === 'dissolve') {                                      // a building turns into wireframe and code, then comes back
    const b = pickBuilding();
    if (b) { fx.slots[fx.slots[0] ? 1 : 0] = { x: b[10], z: b[11], t: 0, dur: 1.5 + Math.random() * 0.9 }; fx.scan = Math.max(fx.scan, 0.25); chirp(5); return; }
  }
  if (kind === 'dejavu' && replay.n === RING) { replay.i = 0; replay.left = RING * 2; chirp(3); return; }   // the last frames run twice more
  fx.scan = 1; fx.tear = 1; fx.ca = 0.007; chirp(4);              // scanline flicker + tearing
}
export function updateFx(rdt) {
  for (let i = 0; i < 2; i++) {
    const g = fx.slots[i], u = i === 0 ? U.uGlitchA.value : U.uGlitchB.value;
    if (g) { g.t += rdt; if (g.t >= g.dur) fx.slots[i] = null; }
    if (!fx.slots[i]) { u.set(1e9, 1e9, 0, 0); continue; }
    const k = g.t / g.dur;
    u.set(g.x, g.z, smooth(0, 0.3, k) * (1 - smooth(0.68, 1, k)), 0);
  }
  fx.scan = Math.max(0, fx.scan - rdt * 2.2); fx.tear = Math.max(0, fx.tear - rdt * 2.6); fx.ca = Math.max(0, fx.ca - rdt * 0.05);
  if (S.glitch > 0 && view.started) {
    fx.nextGlitch -= rdt;
    if (fx.nextGlitch <= 0) { triggerGlitch(fx.force); fx.force = null; fx.nextGlitch = GLITCH_GAP[S.glitch] * (0.6 + Math.random() * 0.8); }
  }
  fx.flashT += rdt; fx.nextFlash -= rdt * lerp(1, 0.15, P.slow);
  if (fx.nextFlash <= 0 && view.started) {
    const sky = P.pos.y > CLOUD_Y + 100;                          // among the clouds: the flashes are near, inside the towers, and come more often
    fx.nextFlash = (sky ? 3 : 3.5) + Math.random() * (sky ? 5 : 6); fx.flashT = 0; fx.flashAmp = 1.0 + Math.random() * 1.2;
    const hitAt = P.pos.y < CLOUD_Y - 80 && Math.random() < 0.6 ? pickStrike() : null;
    const a = Math.random() * TAU, fd = sky ? 500 + Math.random() * 1500 : 500 + Math.random() * 2600;
    let lx = P.pos.x + Math.cos(a) * fd, ly = sky ? clamp(P.pos.y + (Math.random() - 0.5) * 400, CLOUD_Y + 90, 1400) : CLOUD_Y + 90, lz = P.pos.z + Math.sin(a) * fd;
    fx.bolt = null;
    if (hitAt) { fx.bolt = makeBolt(hitAt[0], hitAt[1], hitAt[2]); lx = fx.bolt.top[0]; lz = fx.bolt.top[2]; fx.flashAmp = 1.7 + Math.random() * 0.8; }
    U.uFlashPos.value.set(lx, ly, lz);
    U.uFlashDir.value.set(lx - P.pos.x, 420, lz - P.pos.z).normalize();
    const dist = Math.hypot(lx - P.pos.x, (hitAt ? hitAt[1] : ly) - P.pos.y, lz - P.pos.z);
    thunder(dist, fx.flashAmp, (lx - P.pos.x) * Math.cos(P.yaw) - (lz - P.pos.z) * Math.sin(P.yaw), !!hitAt);
  }
  const ft = fx.flashT;
  const env = Math.max(Math.exp(-ft * 9), ft > 0.16 ? 0.75 * Math.exp(-(ft - 0.16) * 11) : 0, ft > 0.42 ? 0.4 * Math.exp(-(ft - 0.42) * 7) : 0);
  U.uFlash.value = fx.flashAmp * env;
  if (fx.bolt) {
    if (ft > 0.75) fx.bolt = null;
    else {
      const b = fx.bolt, it = env * 5;
      for (const g of b.segs) rib(g[0], g[1], g[2], g[3], g[4], g[5], g[6] * 1.5, g[6] * 1.5, it * (0.35 + 0.65 * g[6]), 1);
      rib(b.x, b.y - 1.5, b.z, b.x, b.y + 3.5, b.z, 7, 7, it * 0.8, 1);                 // the mast flares where it is hit
    }
  }
  if (S.glitch > 0 && view.started && !cine.on) {                       // now and then the city recompiles by itself
    fx.nextWave -= rdt;
    if (fx.nextWave <= 0) { fx.nextWave = GLITCH_GAP[S.glitch] * (7 + Math.random() * 6); startWave(); }
  }
}
