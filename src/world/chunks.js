// Chunks: pooled instance buffers, streamed around the camera
import * as THREE from 'three';
import { CELL, CHUNK, CHUNK_CELLS, EPOCH, FAR_R, FAR_SNAP, RC, TAU, clamp, hash01, setEpoch } from '../core.js';
import { P, build, view } from '../state.js';
import { U } from '../renderer.js';
import { matBox, matCyl, matFar, matLight } from '../materials.js';
import {
  MAX_STEAM, STEAM_PER_VENT, _t, addMesh, camera, geoBox, geoCyl, geoGroundFlat, geoGroundFold, geoQuad, ground, instGeo, steamGeo,
} from '../scene.js';
import { cellCache, cellKey, farRows, getCell, lotCache, wave } from './city.js';
import { chirp, waveSound } from '../audio.js';

const BOX_CAP = 448, CYL_CAP = 200, LIGHT_CAP = 176, FAR_CAP = 46000;
export const BOX_LAYOUT = [['iPos', 3], ['iSize', 3], ['iPar', 4], ['iBld', 3]];
export const chunks = new Map(), chunkPool = [], buildQueue = [], rebuildQ = [];
const chunkKey = cellKey;
let lastCx = 1e9, lastCz = 1e9, steamDirty = true;
export const steamChanged = () => { steamDirty = true; };   // a module that adds or removes a vent calls this
const nearStable = [1, 1, 0, 0];

// The city fold (see foldP in the shaders): the world beyond the line z = hinge bends up and over. angle runs from 0 to PI
let foldOn = false;
export function setFold(hinge, radius, angle) {
  const on = angle > 0.0005;
  U.uFold.value.set(hinge, radius, angle, on ? 1 : 0);
  if (on === foldOn) return;
  foldOn = on; ground.geometry = on ? geoGroundFold : geoGroundFlat;
  for (const ch of [...chunks.values(), ...chunkPool]) for (const m of ch.meshes) m.frustumCulled = !on;   // a folded chunk is not where its bounds say
}
function newChunk() {
  const ch = { cx: 0, cz: 0, cells: [], dual: false, nBody: 0, nProp: 0, nBox: 0, nCyl: 0, nBeacon: 0, nLamp: 0, nLight: 0, c: new THREE.Vector3(), rad: 0, dist: 0 };
  ch.box = addMesh(instGeo(geoBox, BOX_CAP, BOX_LAYOUT), matBox);
  ch.cyl = addMesh(instGeo(geoCyl, CYL_CAP, BOX_LAYOUT), matCyl);
  ch.lights = addMesh(instGeo(geoQuad, LIGHT_CAP, [['iPos', 3], ['iL', 4], ['iB', 3]]), matLight, 11);
  ch.meshes = [ch.box, ch.cyl, ch.lights];
  for (const m of ch.meshes) m.frustumCulled = !foldOn;
  return ch;
}
// flag: 0 = always drawn, -1 = old epoch (drawn ahead of the wave front), 1 = new epoch (drawn behind it).
// Rows that belong to no building (rails, poles) are the same in both epochs, so the second copy is skipped.
export function writeRows(geo, rows, i, cap, flag) {
  const P = geo.attributes.iPos.array, Sz = geo.attributes.iSize.array, A = geo.attributes.iPar.array, B = geo.attributes.iBld.array;
  for (const r of rows) {
    if (i >= cap) break;
    const free = r[10] > 9e6;
    if (free && flag > 0) continue;
    P[i * 3] = r[0]; P[i * 3 + 1] = r[1]; P[i * 3 + 2] = r[2];
    Sz[i * 3] = r[3]; Sz[i * 3 + 1] = r[4]; Sz[i * 3 + 2] = r[5];
    A[i * 4] = r[6]; A[i * 4 + 1] = r[7]; A[i * 4 + 2] = r[8]; A[i * 4 + 3] = r[9];
    B[i * 3] = r[10]; B[i * 3 + 1] = r[11]; B[i * 3 + 2] = free ? 0 : flag; i++;
  }
  return i;
}
function writeLights(geo, rows, i, flag) {
  const P = geo.attributes.iPos.array, L = geo.attributes.iL.array, B = geo.attributes.iB.array;
  for (const r of rows) {
    if (i >= LIGHT_CAP) break;
    const free = r[7] > 9e6;
    if (free && flag > 0) continue;
    P[i * 3] = r[0]; P[i * 3 + 1] = r[1]; P[i * 3 + 2] = r[2];
    L[i * 4] = r[3]; L[i * 4 + 1] = r[4]; L[i * 4 + 2] = r[5]; L[i * 4 + 3] = r[6];
    B[i * 3] = r[7]; B[i * 3 + 1] = r[8]; B[i * 3 + 2] = free ? 0 : flag; i++;
  }
  return i;
}
function buildChunk(cx, cz, ch) {
  ch = ch || chunkPool.pop() || newChunk();
  ch.cx = cx; ch.cz = cz; ch.cells.length = 0; ch.dual = wave.on;
  const sets = [];                                               // [cell, flag]; during a wave every chunk holds both epochs
  let top = 0;
  for (let j = 0; j < CHUNK_CELLS; j++) for (let i = 0; i < CHUNK_CELLS; i++) {
    const ix = cx * CHUNK_CELLS + i, iz = cz * CHUNK_CELLS + j;
    if (wave.on) sets.push([getCell(ix, iz, EPOCH), -1], [getCell(ix, iz, EPOCH + 1), 1]); else sets.push([getCell(ix, iz, EPOCH), 0]);
    ch.cells.push(getCell(ix, iz));
  }
  for (const [c] of sets) top = Math.max(top, c.top);
  // instance order = LOD order: bodies, then roof props, then street poles
  let n = 0; const bg = ch.box.geometry, cg = ch.cyl.geometry, lg = ch.lights.geometry;
  for (const [c, f] of sets) n = writeRows(bg, c.boxes, n, BOX_CAP, f); ch.nBody = n;
  for (const [c, f] of sets) n = writeRows(bg, c.props, n, BOX_CAP, f); ch.nProp = n;
  for (const [c, f] of sets) n = writeRows(bg, c.poles, n, BOX_CAP, f); ch.nBox = n;
  n = 0; for (const [c, f] of sets) n = writeRows(cg, c.cyls, n, CYL_CAP, f); ch.nCyl = n;
  n = 0; for (const [c, f] of sets) n = writeLights(lg, c.beacons, n, f); ch.nBeacon = n;
  for (const [c, f] of sets) n = writeLights(lg, c.lamps, n, f); ch.nLamp = n;
  for (const [c, f] of sets) n = writeLights(lg, c.signals, n, f); ch.nLight = n;
  ch.c.set((cx + 0.5) * CHUNK, top / 2, (cz + 0.5) * CHUNK);
  ch.rad = Math.hypot(CHUNK * 0.5 + 14, CHUNK * 0.5 + 14, top / 2 + 4);
  for (const m of ch.meshes) {
    for (const k in m.geometry.attributes) if (m.geometry.attributes[k].isInstancedBufferAttribute) m.geometry.attributes[k].needsUpdate = true;
    m.geometry.boundingSphere.center.copy(ch.c); m.geometry.boundingSphere.radius = ch.rad; m.visible = true;
  }
  chunks.set(chunkKey(cx, cz), ch);
}
function releaseChunk(ch) { for (const m of ch.meshes) m.visible = false; chunkPool.push(ch); }

function rebuildSteam(ccx, ccz) {
  const B = steamGeo.attributes.aBase.array, Rn = steamGeo.attributes.aRnd.array; let n = 0;
  for (const ch of chunks.values()) {
    if (Math.abs(ch.cx - ccx) > 2 || Math.abs(ch.cz - ccz) > 2) continue;
    for (const c of ch.cells) for (const v of c.vents) for (let k = 0; k < STEAM_PER_VENT && n < MAX_STEAM; k++, n++) {
      const hx = Math.round(v[0] * 8), hz = Math.round(v[2] * 8);
      B[n * 4] = v[0]; B[n * 4 + 1] = v[1]; B[n * 4 + 2] = v[2]; B[n * 4 + 3] = v[3];
      Rn[n * 4] = k / STEAM_PER_VENT + hash01(hx, hz, k) * 0.1; Rn[n * 4 + 1] = hash01(hx, hz, k + 50);
      Rn[n * 4 + 2] = hash01(hx, hz, k + 100); Rn[n * 4 + 3] = hash01(hx, hz, k + 150);
    }
  }
  steamGeo.instanceCount = n;
  steamGeo.attributes.aBase.needsUpdate = true; steamGeo.attributes.aRnd.needsUpdate = true;
}
export function updateChunks(px, pz, budget) {
  const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
  if (ccx !== lastCx || ccz !== lastCz) {
    lastCx = ccx; lastCz = ccz;
    for (const [k, ch] of chunks) if (Math.abs(ch.cx - ccx) > RC || Math.abs(ch.cz - ccz) > RC) { releaseChunk(ch); chunks.delete(k); }
    buildQueue.length = 0;
    for (let dz = -RC; dz <= RC; dz++) for (let dx = -RC; dx <= RC; dx++)
      if (!chunks.has(chunkKey(ccx + dx, ccz + dz))) buildQueue.push([ccx + dx, ccz + dz, dx * dx + dz * dz]);
    buildQueue.sort((a, b) => b[2] - a[2]);                      // nearest last, so pop() takes it first
    steamDirty = true;
  }
  while (budget-- > 0 && buildQueue.length) { const q = buildQueue.pop(); buildChunk(q[0], q[1]); if (q[2] <= 8) steamDirty = true; }
  while (budget-- > 0 && rebuildQ.length) {                      // chunks that must change between one epoch and two
    const ch = rebuildQ.pop();
    if (chunks.get(chunkKey(ch.cx, ch.cz)) === ch) { buildChunk(ch.cx, ch.cz, ch); steamDirty = true; }
  }
  if (steamDirty) { rebuildSteam(ccx, ccz); steamDirty = false; }
  // the far field leaves out the square that chunks cover; while chunks are still loading, only the part both squares share
  const x0 = (ccx - RC) * CHUNK, z0 = (ccz - RC) * CHUNK, x1 = (ccx + RC + 1) * CHUNK, z1 = (ccz + RC + 1) * CHUNK;
  if (!buildQueue.length) { nearStable[0] = x0; nearStable[1] = z0; nearStable[2] = x1; nearStable[3] = z1; }
  U.uNear.value.set(Math.max(x0, nearStable[0]) - 1, Math.max(z0, nearStable[1]) - 1, Math.min(x1, nearStable[2]) - 1, Math.min(z1, nearStable[3]) - 1);
}
// LOD by instance count: far chunks draw bodies only, then props, then street furniture
export function chunkLOD(px, pz, mirror) {
  for (const ch of chunks.values()) {
    const d = ch.dist = Math.hypot(ch.c.x - px, ch.c.z - pz);
    ch.box.geometry.instanceCount = mirror ? ch.nBody : d < 420 ? ch.nBox : d < 800 ? ch.nProp : ch.nBody;
    ch.cyl.visible = !mirror && d < 800 && ch.nCyl > 0; ch.cyl.geometry.instanceCount = ch.nCyl;
    ch.lights.geometry.instanceCount = d < 380 ? ch.nLight : d < 950 ? ch.nLamp : ch.nBeacon;
  }
}

// far field: one box per lot out to FAR_R cells, built a few hundred cells per frame, shown when the air is clear enough
export const farGeo = instGeo(geoBox, FAR_CAP, BOX_LAYOUT), farMesh = addMesh(farGeo, matFar);
export const far = { cx: 1e9, cz: 1e9, dirty: false, job: null, rows: [] };
export function updateFar(px, pz) {
  const cx = Math.round(px / CELL / FAR_SNAP) * FAR_SNAP, cz = Math.round(pz / CELL / FAR_SNAP) * FAR_SNAP;
  if (!far.job && (cx !== far.cx || cz !== far.cz || far.dirty)) { far.job = { cx, cz, i: 0, n: 0, dual: wave.on }; far.dirty = false; }
  const job = far.job; if (!job) return;
  const W = FAR_R * 2 + 1, end = Math.min(W * W, job.i + 900), rows = far.rows;
  for (; job.i < end; job.i++) {
    const dx = job.i % W - FAR_R, dz = Math.floor(job.i / W) - FAR_R;
    if (dx * dx + dz * dz > FAR_R * FAR_R) continue;
    rows.length = 0;
    if (job.dual) {
      farRows(job.cx + dx, job.cz + dz, EPOCH, rows); job.n = writeRows(farGeo, rows, job.n, FAR_CAP, -1);
      rows.length = 0; farRows(job.cx + dx, job.cz + dz, EPOCH + 1, rows); job.n = writeRows(farGeo, rows, job.n, FAR_CAP, 1);
    } else { farRows(job.cx + dx, job.cz + dz, EPOCH, rows); job.n = writeRows(farGeo, rows, job.n, FAR_CAP, 0); }
  }
  if (job.i >= W * W) {
    for (const k in farGeo.attributes) if (farGeo.attributes[k].isInstancedBufferAttribute) farGeo.attributes[k].needsUpdate = true;
    farGeo.instanceCount = job.n; far.cx = job.cx; far.cz = job.cz; far.dual = job.dual; far.job = null;
  }
}
export function resetCity() {
  for (const ch of chunks.values()) releaseChunk(ch);
  chunks.clear(); cellCache.clear(); lotCache.clear(); lastCx = lastCz = 1e9; buildQueue.length = rebuildQ.length = 0;
  setEpoch(0); wave.on = false; wave.phase = ''; U.uWave.value.w = 0;
  far.cx = far.cz = 1e9; far.job = null; farGeo.instanceCount = 0;
}

// Recompile wave. prep: every chunk and the far field are rebuilt with both epochs. run: the front crosses the city.
// post: the epoch moves forward and everything is rebuilt with the new one only.
// the world builds itself outward from a point: frames rise, snap to solid, then their lights come on
export function startBuild(x, z, speed) { build.on = true; build.r = 0; build.speed = speed; U.uBuild.value.set(x, z, 0, 1); }
export function updateBuild(dt) {
  if (!build.on) return;
  build.r += build.speed * dt; U.uBuild.value.z = build.r;
  if (build.r > 7000) { build.on = false; U.uBuild.value.w = 0; }
}
export function startWave() {
  if (wave.phase || !view.started) return;
  const fwd = camera.getWorldDirection(_t); let dx = -fwd.x, dz = -fwd.z; const l = Math.hypot(dx, dz);
  if (l < 0.25) { const a = Math.random() * TAU; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= l; dz /= l; }   // it comes toward the viewer
  wave.on = true; wave.phase = 'prep'; wave.dx = dx; wave.dz = dz; wave.front = -1e12;
  U.uWave.value.set(dx, dz, -1e12, 1);
  for (const ch of chunks.values()) rebuildQ.push(ch);
  far.dirty = true;
}
export function updateWave(dt) {
  if (!wave.phase) return;
  const camU = P.pos.x * wave.dx + P.pos.z * wave.dz, reach = Math.max(1500, U.uFogFar.value + 300), idle = !rebuildQ.length && !far.job && !far.dirty;
  if (wave.phase === 'prep') {
    if (idle && far.dual) { wave.phase = 'run'; wave.front = camU - reach; wave.passed = false; waveSound(reach / wave.speed); }
  } else if (wave.phase === 'run') {
    wave.front += wave.speed * dt;
    if (!wave.passed && wave.front > camU) { wave.passed = true; chirp(8); }
    if (wave.front > camU + reach + 500) {
      wave.phase = 'post'; wave.front = 1e12; wave.on = false; setEpoch(EPOCH + 1);
      for (const ch of chunks.values()) rebuildQ.push(ch);
      far.dirty = true;
    }
  } else if (idle && !far.dual) {
    let dual = false; for (const ch of chunks.values()) dual = dual || ch.dual;
    if (!dual) { wave.phase = ''; U.uWave.value.w = 0; }
  }
  U.uWave.value.z = wave.front;
}

// sphere vs building boxes; pushes the position out and removes the inward velocity
export function collide(pos, vel, r) {
  let hit = 0;
  const ix0 = Math.floor((pos.x - r) / CELL), ix1 = Math.floor((pos.x + r) / CELL);
  const iz0 = Math.floor((pos.z - r) / CELL), iz1 = Math.floor((pos.z + r) / CELL);
  for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) for (const b of getCell(ix, iz).bodies) {
    const qx = clamp(pos.x, b.x0, b.x1), qy = clamp(pos.y, b.y0, b.y1), qz = clamp(pos.z, b.z0, b.z1);
    let nx = pos.x - qx, ny = pos.y - qy, nz = pos.z - qz;
    const d2 = nx * nx + ny * ny + nz * nz;
    if (d2 >= r * r) continue;
    let pen;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nx /= d; ny /= d; nz /= d; pen = r - d; }
    else {                                                       // centre is inside: leave through the nearest face
      const e = [pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z, b.y1 - pos.y];
      let m = 0; for (let i = 1; i < 5; i++) if (e[i] < e[m]) m = i;
      nx = m === 0 ? -1 : m === 1 ? 1 : 0; nz = m === 2 ? -1 : m === 3 ? 1 : 0; ny = m === 4 ? 1 : 0; pen = e[m] + r;
    }
    pos.x += nx * pen; pos.y += ny * pen; pos.z += nz * pen;
    const vn = vel.x * nx + vel.y * ny + vel.z * nz;
    if (vn < 0) { vel.x -= nx * vn * 1.12; vel.y -= ny * vn * 1.12; vel.z -= nz * vn * 1.12; hit = Math.max(hit, -vn); }   // slide, with a little bounce
  }
  if (pos.y < 1.7) { pos.y = 1.7; if (vel.y < 0) { hit = Math.max(hit, -vel.y); vel.y = 0; } }
  return hit;
}
