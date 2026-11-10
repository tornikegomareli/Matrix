// Traffic: cars follow lanes, keep gaps, stop at red signals
import { CELL, damp, mulberry32 } from '../core.js';
import { S, SEED } from '../settings.js';
import { N_CARS, carGeo, carLGeo, carLMesh, carMesh } from '../scene.js';
import { signalPhase } from './city.js';

const CAR_RANGE = 440, STOP_AT = 20.3;       // stop line + half a car, measured from the intersection centre
export const cars = [], extraCars = [];                  // extraCars: up to CAR_EXTRA scripted cars { x, z, a: heading angle, seed, brake (2: no lights) }, drawn with the traffic
let trafficRnd = mulberry32(SEED ^ 0xCA75);
function spawnCar(c, px, pz, vx, vz, initial) {
  const r = trafficRnd;
  c.axis = r() < 0.5 ? 0 : 1; c.dir = r() < 0.5 ? 1 : -1; c.lane = r() < 0.5 ? 0 : 1;
  const camU = c.axis === 0 ? px : pz, camL = c.axis === 0 ? pz : px, velU = c.axis === 0 ? vx : vz;
  let u = (r() * 2 - 1) * CAR_RANGE, l = (r() * 2 - 1) * CAR_RANGE;
  if (!initial) {                                                // enter at the edge, mostly ahead of the camera
    const edge = CAR_RANGE * (0.93 + r() * 0.06);
    if (r() < 0.6) u = (Math.abs(velU) > 5 && r() < 0.85 ? Math.sign(velU) : (r() < 0.5 ? -1 : 1)) * edge;
    else l = (r() < 0.5 ? -1 : 1) * edge;
  }
  c.line = Math.round((camL + l) / CELL); c.s = camU + u;
  c.v0 = 9 + r() * 7; c.v = c.v0 * (0.5 + r() * 0.5); c.seed = r(); c.brake = 0; c.x = c.z = 1e9;
  c.key = (c.line + 5000) * 8 + c.axis * 4 + (c.dir > 0 ? 2 : 0) + c.lane;
}
export function resetTraffic(px, pz) {
  trafficRnd = mulberry32(SEED ^ 0xCA75);
  cars.length = 0;
  for (let i = 0; i < N_CARS; i++) { const c = {}; spawnCar(c, px, pz, 0, 0, true); cars.push(c); }
}
export function updateTraffic(dt, time, px, pz, vx, vz) {
  const on = S.traffic;
  carMesh.visible = carLMesh.visible = on;
  if (!on) return;
  for (const c of cars) {
    const camU = c.axis === 0 ? px : pz, camL = c.axis === 0 ? pz : px;
    if (Math.abs(c.s - camU) > CAR_RANGE || Math.abs(c.line * CELL - camL) > CAR_RANGE) spawnCar(c, px, pz, vx, vz, false);
  }
  cars.sort((a, b) => a.key - b.key || a.s - b.s);
  const A = carGeo.attributes.iCar.array, Bk = carGeo.attributes.iCarS.array;
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i], lead = cars[i + c.dir];
    let gap = 1e9;
    if (lead && lead.key === c.key) gap = Math.abs(lead.s - c.s) - 5.6 + lead.v * lead.v / 12;   // the leader needs room to stop too
    // next stop line ahead, and the signal that owns it
    const k = c.dir > 0 ? Math.ceil((c.s + STOP_AT) / CELL) : Math.floor((c.s - STOP_AT) / CELL);
    const stopGap = c.dir > 0 ? k * CELL - STOP_AT - c.s : c.s - (k * CELL + STOP_AT);
    const ph = (signalPhase(c.axis === 0 ? k : c.line, c.axis === 0 ? c.line : k) + time / 18) % 1;
    const green = c.axis === 0 ? ph < 0.45 : (ph >= 0.5 && ph < 0.95);
    if (!green && stopGap < 70 && stopGap > c.v * c.v / 18 - 1) gap = Math.min(gap, stopGap);
    // brake as hard as the remaining room demands, so the car always stops short of the line or bumper
    const room = gap - 1.2;
    let acc = -14;
    if (room > 0.3) {
      const need = c.v * c.v / (2 * room);
      acc = need > 2.2 ? -Math.min(need * 1.15, 14) : Math.min(2.5, (c.v0 - c.v) * 1.5, (Math.sqrt(4.4 * room) - c.v) * 3);
    }
    if (dt >= 0) { c.v = Math.max(0, c.v + acc * dt); c.brake = damp(c.brake, acc < -0.5 || c.v < 0.3 ? 1 : 0, 10, dt); }   // when time runs backwards a car keeps its speed
    c.s += c.dir * c.v * dt;
    const off = c.dir * (2 + c.lane * 4);
    if (c.axis === 0) { c.x = c.s; c.z = c.line * CELL + off; A[i * 4 + 2] = c.dir > 0 ? 0 : 1; }
    else { c.x = c.line * CELL - off; c.z = c.s; A[i * 4 + 2] = c.dir > 0 ? 2 : 3; }
    A[i * 4] = c.x; A[i * 4 + 1] = c.z;
    A[i * 4 + 3] = c.seed; Bk[i] = c.brake;
  }
  let n = cars.length;
  for (const c of extraCars) { A[n * 4] = c.x; A[n * 4 + 1] = c.z; A[n * 4 + 2] = 8 + c.a; A[n * 4 + 3] = c.seed; Bk[n++] = c.brake || 0; }
  carGeo.attributes.iCar.needsUpdate = true; carGeo.attributes.iCarS.needsUpdate = true;
  carGeo.instanceCount = carLGeo.instanceCount = n;
}
