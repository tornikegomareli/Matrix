// Trains on the elevated rail, and every ribbon of light
import { CELL, CLOUD_Y, TAU, hash01 } from '../core.js';
import { SEED } from '../settings.js';
import { P, nearest } from '../state.js';
import { U } from '../renderer.js';
import { matBox, matRib } from '../materials.js';
import { addMesh, geoBox, geoStreak, instGeo } from '../scene.js';
import { railY } from './city.js';
import { BOX_LAYOUT, chunks, far, writeRows } from './chunks.js';

const RIB_CAP = 640, TRAIN_CAP = 640;
export const ribGeo = instGeo(geoStreak, RIB_CAP, [['iA', 3], ['iB', 3], ['iW', 4]]), ribMesh = addMesh(ribGeo, matRib, 13);
export const trainGeo = instGeo(geoBox, TRAIN_CAP, BOX_LAYOUT), trainMesh = addMesh(trainGeo, matBox);
export let ribN = 0;
export const resetRibs = () => { ribN = 0; };                       // every frame draws its ribbons anew
export function rib(ax, ay, az, bx, by, bz, w0, w1, it, type) {
  if (ribN >= RIB_CAP) return;
  const A = ribGeo.attributes.iA.array, B = ribGeo.attributes.iB.array, W = ribGeo.attributes.iW.array, i = ribN++;
  A[i * 3] = ax; A[i * 3 + 1] = ay; A[i * 3 + 2] = az; B[i * 3] = bx; B[i * 3 + 1] = by; B[i * 3 + 2] = bz;
  W[i * 4] = w0; W[i * 4 + 1] = w1; W[i * 4 + 2] = it; W[i * 4 + 3] = type;
}
const TRAIN_GAP = 760, TRAIN_V = 36, TRAIN_CARS = 4;
export function updateTrains(time, px, py, pz) {
  const reach = Math.min(U.uFogFar.value, 2400), rows = far.rows; rows.length = 0; nearest.train = 1e9;
  for (let axis = 0; axis < 2; axis++) {
    const camL = axis ? px : pz, camU = axis ? pz : px;
    for (let line = Math.ceil((camL - reach) / CELL); line * CELL <= camL + reach; line++) {
      const ry = railY(axis, line); if (!ry) continue;
      const dir = hash01(SEED ^ 0x77A1, axis, line) < 0.5 ? 1 : -1, off = hash01(SEED ^ 0x77A2, axis, line) * TRAIN_GAP + dir * TRAIN_V * time;
      for (let k = Math.ceil((camU - reach - off) / TRAIN_GAP); k * TRAIN_GAP + off <= camU + reach; k++) {
        const head = k * TRAIN_GAP + off, lat = line * CELL, y = ry + 1.2;
        for (let j = 0; j < TRAIN_CARS; j++) {
          const sc = head - dir * (10 + j * 21);
          rows.push(axis ? [lat, y, sc, 3.1, 3.4, 20, k * 0.37 + j * 0.11, 0, 0, 4, 1e7, 1e7] : [sc, y, lat, 20, 3.4, 3.1, k * 0.37 + j * 0.11, 0, 0, 4, 1e7, 1e7]);
        }
        const tail = head - dir * TRAIN_CARS * 21, end = tail - dir * 130;      // the streak of light it leaves behind
        if (axis) rib(lat, y + 1.9, tail, lat, y + 1.9, end, 2.4, 0.5, 0.9, 2); else rib(tail, y + 1.9, lat, end, y + 1.9, lat, 2.4, 0.5, 0.9, 2);
        const mid = head - dir * 42, dx = (axis ? lat : mid) - px, dz = (axis ? mid : lat) - pz, d = Math.hypot(dx, y - py, dz);
        if (d < nearest.train) { nearest.train = d; nearest.pan = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw); }
      }
    }
  }
  trainGeo.instanceCount = writeRows(trainGeo, rows, 0, TRAIN_CAP, 0);
  for (const k in trainGeo.attributes) if (trainGeo.attributes[k].isInstancedBufferAttribute) trainGeo.attributes[k].needsUpdate = true;
}
// searchlights on tall roofs sweep the cloud base
export function updateBeams(time) {
  for (const ch of chunks.values()) {
    if (ch.dist > 1300) continue;
    for (const c of ch.cells) for (const sp of c.spots) {
      const yaw = sp[3] * TAU + time * (sp[3] < 0.5 ? 0.21 : -0.17), tilt = 0.42 + 0.26 * Math.sin(time * 0.13 + sp[3] * 40);
      const len = (CLOUD_Y - sp[1]) / Math.cos(tilt) + 40, st = Math.sin(tilt) * len;
      rib(sp[0], sp[1], sp[2], sp[0] + Math.cos(yaw) * st, sp[1] + Math.cos(tilt) * len, sp[2] + Math.sin(yaw) * st, 1.2, 22, 0.3, 0);
    }
  }
}
