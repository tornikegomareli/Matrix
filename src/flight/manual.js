// Manual flight
import { CEIL, MACH, clamp, damp, lerp, smooth } from '../core.js';
import { P, clock, keys, touch } from '../state.js';
import { camera } from '../scene.js';
import { impactSound } from '../audio.js';
import { collide } from '../world/chunks.js';

// Thrust along the nose, quadratic drag, and lift that carves the velocity toward the nose. Speed has to be earned and spent.
export function stepManual(dt, rdt) {
  let f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + touch.fy, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.fx;
  const up = (keys.Space ? 1 : 0) + (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  const shift = keys.ShiftLeft || keys.ShiftRight || touch.boost;
  if (shift && f === 0 && s === 0 && up === 0) f = 1;            // boost alone = fly where you look
  P.boost = damp(P.boost, shift && f > 0 ? 1 : 0, shift ? 1.6 : 2.4, rdt);
  const cp = Math.cos(P.pitch), fx = -Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = -Math.cos(P.yaw) * cp;
  const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), v = P.vel, sp = v.length(), mach = sp / MACH;
  const thr = lerp(52, 152, P.boost) * (1 - smooth(CEIL - 500, CEIL, P.pos.y) * 0.3);   // the air gets thin near the ceiling
  let ax = (fx * f + rx * s * 0.8) * thr, ay = (fy * f + up * 0.9) * thr, az = (fz * f + rz * s * 0.8) * thr;
  if (f > 0) { const g = -fy * 11 * f; ax += fx * g; ay += fy * g; az += fz * g; }      // a dive gains speed, a climb costs speed
  // drag: grows with the square of speed, less when streamlined under boost, with a wall just below Mach 1.
  // The air thins with height: about Mach 1.1 at street level, Mach 2 near the ceiling
  const rho = lerp(1, Math.exp(-P.pos.y / 2000), P.boost);
  const cd = lerp(0.0145, 0.0008, P.boost) * (1 + 0.2 * P.boost * Math.exp(-Math.pow((mach - 0.93) / 0.06, 2))) * rho;
  const lin = (f === 0 && s === 0 && up === 0) ? 1.3 : f < 0 ? 1.7 : 0.12 * rho;         // no input: settle into a hover. S: air brake
  const dk = Math.min(lin + cd * sp, ((f > 0 ? thr : 0) + 95) / Math.max(sp, 1));       // never brake harder than about 10 g
  const ox = v.x, oz = v.z;
  v.x += (ax - v.x * dk) * dt; v.y += (ay - v.y * dk) * dt; v.z += (az - v.z * dk) * dt;
  const sp2 = v.length();
  if (f > 0 && sp2 > 6) {                                          // lift: the velocity follows the nose, slower at high speed
    const k = (1 - Math.exp(-lerp(3.2, 1.25, smooth(60, 340, sp2)) * lerp(1, 0.6, smooth(340, 700, sp2)) * dt)) / sp2;
    let dx = v.x + (fx * sp2 - v.x) * k * sp2, dy = v.y + (fy * sp2 - v.y) * k * sp2, dz = v.z + (fz * sp2 - v.z) * k * sp2;
    const l = Math.hypot(dx, dy, dz) || 1, keep = sp2 * lerp(1, l / sp2, 0.35) / l;     // a hard turn bleeds a little speed
    v.set(dx * keep, dy * keep, dz * keep);
  }
  const latAcc = ((v.x - ox) * rx + (v.z - oz) * rz) / Math.max(dt, 1e-4);              // sideways g: what banks the body
  const steps = Math.max(1, Math.ceil(v.length() * dt / 2));     // sub-steps so nothing tunnels at Mach 1
  let hit = 0;
  for (let i = 0; i < steps; i++) { P.pos.addScaledVector(v, dt / steps); hit = Math.max(hit, collide(P.pos, v, 2.6)); }
  if (hit > 14) { P.shake = Math.min(1, P.shake + hit / 110); impactSound(hit); }
  if (P.pos.y > CEIL) { P.pos.y = CEIL; v.y = Math.min(v.y, 0); }
  const yr = (P.yaw - P._yaw0) / Math.max(rdt, 1e-4), pr = (P.pitch - P._pitch0) / Math.max(rdt, 1e-4);
  P._yaw0 = P.yaw; P._pitch0 = P.pitch;
  P.yawRate = damp(P.yawRate, yr, 10, rdt); P.pitchRate = damp(P.pitchRate, pr, 10, rdt);
  P.roll = damp(P.roll, clamp(Math.atan(-latAcc / 42) + P.yawRate * 0.05, -0.85, 0.85), 5, rdt);
  camera.position.copy(P.pos);
  camera.position.y += Math.sin(clock.real * 1.25) * 0.14 * (1 - Math.min(1, sp2 / 14));     // idle hover: a slow bob
  camera.rotation.set(P.pitch, P.yaw, P.roll, 'YXZ');
}
P._yaw0 = 0; P._pitch0 = 0;
