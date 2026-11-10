// The switches and the read-out on the page
import { $, CELL, clamp } from './core.js';
import { CODE_MUL, CODE_NAMES, GLITCH_GAP, GLITCH_NAMES, S, seedHex, setSeed, vnoise } from './settings.js';
import { P, cine } from './state.js';
import { U } from './renderer.js';
import { matGround } from './materials.js';
import { camera } from './scene.js';
import { getCell } from './world/city.js';
import { AC, AU, aSet, chirp } from './audio.js';
import { resetCity, startBuild } from './world/chunks.js';
import { resetTraffic } from './world/traffic.js';
import { startCine } from './flight/cine.js';
import { fx } from './fx.js';

export function refreshUI() {
  $('tRain').textContent = '[1] RAIN ' + (S.rain ? 'ON' : 'OFF');
  $('tTraffic').textContent = '[2] TRAFFIC ' + (S.traffic ? 'ON' : 'OFF');
  $('tGlitch').textContent = '[3] GLITCH ' + GLITCH_NAMES[S.glitch];
  $('tCode').textContent = '[4] CODE ' + CODE_NAMES[S.code];
  $('tSound').textContent = '[5] SOUND ' + (S.sound ? 'ON' : 'OFF');
  $('tMusic').textContent = '[6] MUSIC ' + (S.music ? 'ON' : 'OFF');
  U.uCode.value = CODE_MUL[S.code]; matGround.uniforms.uRainOn.value = S.rain ? 1 : 0; matGround.uniforms.uTraffic.value = S.traffic ? 1 : 0;
}
export function toggle(k) {
  if (k === 'rain') S.rain = !S.rain;
  else if (k === 'traffic') S.traffic = !S.traffic;
  else if (k === 'glitch') { S.glitch = (S.glitch + 1) % 4; fx.nextGlitch = Math.min(fx.nextGlitch, GLITCH_GAP[S.glitch] * 0.5); }
  else if (k === 'sound') { S.sound = !S.sound; if (AC) aSet(AU.nodes.out.gain, S.sound ? 1 : 0, 0.05); }
  else if (k === 'music') S.music = !S.music;                     // updateAudio() sets its level
  else S.code = (S.code + 1) % 3;
  refreshUI();
}
for (const [id, k] of [['tRain', 'rain'], ['tTraffic', 'traffic'], ['tGlitch', 'glitch'], ['tCode', 'code'], ['tSound', 'sound'], ['tMusic', 'music']])
  $(id).addEventListener('click', e => { toggle(k); e.currentTarget.blur(); });

// start a few blocks before the tallest district nearby, on a road, flying toward it
export function placeStart() {
  let best = -1, bx = 0, bz = 0;
  for (let iz = -10; iz <= 10; iz++) for (let ix = -10; ix <= 10; ix++) {
    const v = vnoise(ix / 5, iz / 5, 0x51); if (v > best) { best = v; bx = ix; bz = iz; }
  }
  const iz = bz - 4, y = clamp(Math.min(getCell(bx, iz).maxH, getCell(bx - 1, iz).maxH) + 14, 40, 300);
  P.pos.set(bx * CELL, y, iz * CELL + 50); P.vel.set(0, 0, 0);
  P.yaw = P._yaw0 = Math.PI; P.pitch = P._pitch0 = 0; P.roll = 0; P.boost = 0;
  camera.position.copy(P.pos); camera.rotation.set(0, P.yaw, 0, 'YXZ');
}
export function newSeed() {
  setSeed((Math.random() * 4294967296) >>> 0);
  try { history.replaceState(null, '', '#seed=' + seedHex()); } catch (e) { /* file:// in some browsers */ }
  resetCity(); placeStart(); resetTraffic(P.pos.x, P.pos.z); startBuild(P.pos.x, P.pos.z, 420);
  fx.slots[0] = fx.slots[1] = null; fx.scan = 1; fx.tear = 1; fx.ca = 0.008; chirp(6);
  if (cine.on) { cine.pan = 0; startCine(); }
}
