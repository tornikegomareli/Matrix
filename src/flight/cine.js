// Cinematic flight: a spline that stays over the road grid
import * as THREE from 'three';
import { CELL, CLOUD_Y, DECK_TOP, TAU, clamp, damp, lerp, mulberry32, smooth } from '../core.js';
import { SEED } from '../settings.js';
import { P, cine } from '../state.js';
import { _t, camera } from '../scene.js';
import { getCell, railY } from '../world/city.js';
import { startWave } from '../world/chunks.js';

// The air above every road is always free, so a path made of road-line waypoints cannot hit a building.
const pl = { axis: 0, dir: 1, line: 0, s: 0, y: 100, wv: 1 };     // planner cursor: which road and where along it
const cPush = (x, y, z, v, b, w) => cine.pts.push({ x, y, z, v, b: b || 0, w: w || 0 });
const plPush = (lat, v, b, w) => pl.axis === 0 ? cPush(pl.s, pl.y, pl.line * CELL + lat, v, b, w) : cPush(pl.line * CELL + lat, pl.y, pl.s, v, b, w);
function flankMin(s) {                                            // the lower of the two roofs beside the road
  const i = Math.floor(s / CELL);
  const a = pl.axis === 0 ? getCell(i, pl.line) : getCell(pl.line, i), b = pl.axis === 0 ? getCell(i, pl.line - 1) : getCell(pl.line - 1, i);
  return Math.min(a.maxH, b.maxH);
}
// true if a path along the current road stays clear of the rail decks of the roads it crosses. way = [[s, y], ...]
function railClear(way) {
  for (let i = 0; i < way.length - 1; i++) {
    const [s0, y0] = way[i], [s1, y1] = way[i + 1];
    for (let k = Math.ceil((Math.min(s0, s1) - 8) / CELL); k * CELL <= Math.max(s0, s1) + 8; k++) {
      const ry = railY(1 - pl.axis, k); if (!ry) continue;
      const y = lerp(y0, y1, clamp((k * CELL - s0) / ((s1 - s0) || 1), 0, 1));
      if (y > ry - 6 && y < ry + 9) return false;
    }
  }
  return true;
}
const MOVES = {
  skim(n) {                                                       // roof level, weaving, towers rising on both sides
    for (let k = 0; k < n; k++) {
      pl.s += pl.dir * 100; pl.y = clamp(clamp(flankMin(pl.s) + 9, 44, 180), pl.y - 70, pl.y + 70); pl.wv = -pl.wv; plPush(pl.wv * 3.5, 135);
    }
  },
  dive() {
    for (let g = 0; g < 5; g++) {                                 // do not dive through a rail deck: fly on a little first
      const run = Math.max(140, pl.y * 0.95), s0 = pl.s, d = pl.dir;
      if (railClear([[s0, pl.y], [s0 + d * run * 0.32, lerp(12, pl.y, 0.62)], [s0 + d * run * 0.68, lerp(12, pl.y, 0.2)], [s0 + d * run, 12]])) break;
      pl.s += pl.dir * 50; plPush(0, 120);
    }
    const y0 = pl.y, run = Math.max(140, y0 * 0.95);
    for (const [ds, t] of [[0.32, 0.62], [0.36, 0.2], [0.32, 0]]) { pl.s += pl.dir * run * ds; pl.y = lerp(12, y0, t); plPush(0, 118); }
  },
  canyon(n) {
    for (let k = 0; k < n; k++) { pl.s += pl.dir * 100; pl.y = clamp(pl.y + (cine.rnd() - 0.5) * 8, 8, 16); pl.wv = -pl.wv; plPush(pl.wv * 4, 100); }
  },
  turn() {                                                        // banked 90 degree arc through the next intersection that has no rail
    let k = pl.dir > 0 ? Math.ceil((pl.s + 45) / CELL) : Math.floor((pl.s - 45) / CELL);
    for (let g = 0; g < 6 && railY(1 - pl.axis, k); g++) k += pl.dir;
    const c = k * CELL, nd = cine.rnd() < 0.5 ? 1 : -1;
    if (Math.abs(c - pl.dir * 42 - pl.s) > 15) { pl.s = c - pl.dir * 42; plPush(0, 52); }
    pl.s = c - pl.dir * 18; plPush(0, 36);
    pl.s = c - pl.dir * 5.27; plPush(nd * 5.27, 31);
    const old = pl.line; pl.axis = 1 - pl.axis; pl.line = k; pl.dir = nd; pl.s = old * CELL + nd * 18; plPush(0, 36);
    pl.s += nd * 24; plPush(0, 56);
  },
  climb() {                                                       // pull up and go supersonic into the cloud deck
    for (let g = 0; g < 5; g++) {
      const s0 = pl.s, d = pl.dir, y = pl.y;
      if (railClear([[s0, y], [s0 + d * 36, y + 6], [s0 + d * 66, y + 48], [s0 + d * 78, y + 150]])) break;
      pl.s += pl.dir * 50; plPush(0, 70);
    }
    const y0 = pl.y;
    pl.s += pl.dir * 36; pl.y = y0 + 6; plPush(0, 85);
    pl.s += pl.dir * 30; pl.y = y0 + 48; plPush(0, 130, 1);
    pl.s += pl.dir * 12; pl.y = y0 + 150; plPush(0, 250, 1);
    pl.s += pl.dir * 2; pl.y = Math.max(360, y0 + 260); plPush(0, 350, 1);
    pl.y = CLOUD_Y + 130; plPush(0, 380, 1);
    pl.s += pl.dir * 130; pl.y = DECK_TOP + 170; plPush(0, 300, 1);          // out of the deck: level off among the cloud towers,
    for (let k = 0; k < 5; k++) { pl.s += pl.dir * 330; pl.y = DECK_TOP + 230 + 60 * Math.sin(k * 1.7); pl.wv = -pl.wv; plPush(pl.wv * 60, 230); }   // weave between them and through them
    pl.s += pl.dir * 260; pl.y = DECK_TOP + 900; plPush(0, 330, 1);
    pl.s += pl.dir * 200; pl.y = DECK_TOP + 1400; plPush(0, 200);
    pl.s += pl.dir * 280; pl.y = DECK_TOP + 1560; plPush(0, 120, 0, 1);      // over the top, far above the clouds: the city recompiles below
    pl.s += pl.dir * 300; pl.y = DECK_TOP + 1590; plPush(16, 85);
  },
  descend() {                                                     // nose over and dive at the grid of lights, as fast as it goes, then level out
    pl.s += pl.dir * 240; pl.y = DECK_TOP + 1400; plPush(0, 170);
    pl.s += pl.dir * 130; pl.y = DECK_TOP + 700; plPush(0, 520, 1);
    pl.s += pl.dir * 110; pl.y = CLOUD_Y + 20; plPush(0, 640, 1);
    pl.s += pl.dir * 120; pl.y = 330; plPush(0, 420, 1);
    pl.s += pl.dir * 220; pl.y = clamp(flankMin(pl.s) + 30, 60, 240); plPush(0, 170);
  },
};
const CINE_SEQ = [['skim', 1], ['dive'], ['turn'], ['climb'], ['descend'], ['skim', 3], ['dive'],
  ['canyon', 2], ['turn'], ['canyon', 1], ['turn'], ['canyon', 1], ['climb'], ['descend']];

export function startCine() {
  cine.rnd = mulberry32(SEED ^ 0xC1E); cine.pts.length = 0; cine.i = 1; cine.u = 0; cine.step = 0; cine.v = Math.max(40, P.vel.length());
  const p = P.pos, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  pl.axis = Math.abs(fx) > Math.abs(fz) ? 0 : 1; pl.dir = (pl.axis === 0 ? fx : fz) >= 0 ? 1 : -1; pl.wv = 1;
  const lat = pl.axis === 0 ? p.z : p.x;
  pl.line = Math.round(lat / CELL); pl.s = pl.axis === 0 ? p.x : p.z;
  let safe = p.y;
  if (Math.abs(lat - pl.line * CELL) > 8) {                       // not over a road: clear the roofs first
    const ix = Math.floor(p.x / CELL), iz = Math.floor(p.z / CELL); let t = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) t = Math.max(t, getCell(ix + a, iz + b).top);
    safe = Math.max(p.y, t + 15);
  }
  cPush(p.x - fx * 20, p.y, p.z - fz * 20, cine.v); cPush(p.x, p.y, p.z, cine.v);
  if (safe > p.y + 2) cPush(p.x + fx * 4, safe, p.z + fz * 4, 70);
  pl.y = safe; pl.s += pl.dir * 70; plPush(0, 88);
  if (pl.y < 32) cine.step = 2;                                    // already low: start with the canyon run
  else pl.y = Math.min(pl.y, Math.max(180, pl.y - 70));
  const cp = Math.cos(P.pitch);
  cine.f.set(fx * cp, Math.sin(P.pitch), fz * cp).normalize();
  cine.right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw)); cine.roll = P.roll; cine.head = P.yaw;
}
function cineFill() {
  while (cine.pts.length - cine.i < 8) {
    const m = CINE_SEQ[cine.step % CINE_SEQ.length];
    if (railY(pl.axis, pl.line) && m[0] !== 'turn' && pl.y < 300) MOVES.turn();   // never fly along a road that carries a rail deck
    MOVES[m[0]](m[1]); cine.step++;
  }
  if (cine.i > 40) { cine.pts.splice(0, cine.i - 2); cine.i = 2; }
}
// centripetal Catmull-Rom (no overshoot where waypoints are unevenly spaced)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
function crEval(i, u, out) {
  const n = cine.pts.length;
  while (u >= 1 && i < n - 3) { u -= 1; i++; }
  const p0 = cine.pts[i - 1], p1 = cine.pts[i], p2 = cine.pts[i + 1], p3 = cine.pts[i + 2];
  const dd = (a, b) => Math.sqrt(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)) + 1e-3;
  const t1 = dd(p0, p1), t2 = t1 + dd(p1, p2), t3 = t2 + dd(p2, p3), t = lerp(t1, t2, u);
  const L = (pa, pb, ta, tb, o) => { const w = (t - ta) / (tb - ta); o.x = lerp(pa.x, pb.x, w); o.y = lerp(pa.y, pb.y, w); o.z = lerp(pa.z, pb.z, w); return o; };
  const A1 = L(p0, p1, 0, t1, _a), A2 = L(p1, p2, t1, t2, _b), A3 = L(p2, p3, t2, t3, _c);
  const B1 = L(A1, A2, 0, t2, _a), B2 = L(A2, A3, t1, t3, _d);
  return L(B1, B2, t1, t2, out);
}
function cineAhead(dist, out) {                                   // a point `dist` metres further along the path
  let i = cine.i, u = cine.u;
  for (let g = 0; g < 12; g++) {
    const p1 = cine.pts[i], p2 = cine.pts[i + 1], len = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z) + 1e-3, left = (1 - u) * len;
    if (dist <= left || i >= cine.pts.length - 3) { u += dist / len; break; }
    dist -= left; i++; u = 0;
  }
  return crEval(i, Math.min(u, 0.999), out);
}
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _up = new THREE.Vector3();
export const _m = new THREE.Matrix4(), _qr = new THREE.Quaternion(), Z_AXIS = new THREE.Vector3(0, 0, 1), WORLD_UP = new THREE.Vector3(0, 1, 0);
cine.move = stepCine;                             // what moves the camera in cinematic flight. A tour puts its own function here
function stepCine(dt, rdt) {
  if (cine.pan > 0) {                                             // first look around: a slow sweep while rising above the street. It ends on the heading of the route
    cine.pan = Math.max(0, cine.pan - rdt / 13);
    const k = 1 - cine.pan, e = k * k * (3 - 2 * k);
    P.pos.y = cine.y0 + 70 * e; P.vel.set(0, 0, 0); P.yaw = cine.yaw0 - (1 - e) * 2.6; P.pitch = 0.1 * Math.sin(e * Math.PI) - 0.04; P.roll = 0; P.boost = 0;
    P.yawRate = damp(P.yawRate, 2.6 * 6 * k * (1 - k) / 13, 8, rdt); P.pitchRate = 0;
    camera.position.copy(P.pos); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (cine.pan === 0) { P.yaw = cine.yaw0; P.pitch = -0.04; startCine(); }
    return;
  }
  cineFill();
  const a = cine.pts[cine.i], b = cine.pts[cine.i + 1];
  crEval(cine.i, cine.u, _p); crEval(cine.i, cine.u + 0.02, _q);
  const dPdu = Math.max(1e-3, _q.distanceTo(_p) / 0.02), vT = lerp(a.v, b.v, cine.u);
  cine.v = damp(cine.v, vT, vT > cine.v ? 1.6 : 2.4, rdt);
  cine.u += cine.v * dt / dPdu;
  while (cine.u >= 1) { cine.u -= 1; cine.i++; if (cine.pts[cine.i].w) startWave(); cineFill(); }
  crEval(cine.i, cine.u, _p);
  P.vel.copy(_p).sub(P.pos).divideScalar(Math.max(rdt, 1e-4)).clampLength(0, 900);
  P.pos.copy(_p);
  P.boost = damp(P.boost, b.b ? 1 : 0, b.b ? 2.2 : 3, rdt);
  // look a little ahead of the camera, like a chase drone
  cineAhead(14 + cine.v * 0.16, _q); _t.copy(_q).sub(_p);
  if (_t.lengthSq() > 1e-6) cine.f.lerp(_t.normalize(), 1 - Math.exp(-6 * rdt)).normalize();
  const f = cine.f;
  // carry the right vector along the path, then ease it level unless the flight is near vertical
  cine.right.addScaledVector(f, -cine.right.dot(f));
  if (cine.right.lengthSq() < 1e-6) cine.right.set(1, 0, 0);
  cine.right.normalize();
  const lvl = 1 - smooth(0.8, 0.97, Math.abs(f.y));
  if (lvl > 0) {
    _up.crossVectors(f, WORLD_UP).normalize();
    cine.right.lerp(_up, (1 - Math.exp(-3 * rdt)) * lvl);
    if (cine.right.lengthSq() < 1e-4) cine.right.copy(_up);
    cine.right.addScaledVector(f, -cine.right.dot(f)).normalize();
  }
  _up.crossVectors(cine.right, f);
  // bank from the turn rate
  let yr = 0;
  if (lvl > 0.05) {
    const h = Math.atan2(-f.x, -f.z); let dh = h - cine.head; dh -= Math.round(dh / TAU) * TAU;
    yr = dh / Math.max(rdt, 1e-4) * lvl; cine.head = h; P.yaw = h;
  }
  P.yawRate = damp(P.yawRate, yr, 8, rdt);
  const pitch = Math.asin(clamp(f.y, -1, 1));
  P.pitchRate = damp(P.pitchRate, (pitch - P.pitch) / Math.max(rdt, 1e-4), 8, rdt); P.pitch = pitch;
  cine.roll = damp(cine.roll, clamp(Math.atan(P.yawRate * cine.v * Math.hypot(f.x, f.z) / 45), -0.9, 0.9), 3.5, rdt); P.roll = cine.roll;
  _t.copy(f).negate();
  camera.quaternion.setFromRotationMatrix(_m.makeBasis(cine.right, _up, _t)).multiply(_qr.setFromAxisAngle(Z_AXIS, cine.roll));
  camera.position.copy(_p);
}
export function setCine(on, look) {
  if (on === cine.on) return;
  cine.on = on; cine.pan = 0;
  if (on && look) { cine.pan = 1; cine.yaw0 = P.yaw; cine.y0 = P.pos.y; }
  else if (on) startCine(); else { P._yaw0 = P.yaw; P._pitch0 = P.pitch; }
}
