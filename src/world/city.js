// The procedural city: one cell is one block
import { CELL, EPOCH, ROAD, SPIRE_GRID, hash01, hashInt, lerp, mulberry32 } from '../core.js';
import { SEED, vnoise } from '../settings.js';

// Every value comes from mulberry32(hash(SEED, ix, iz)), so a seed always rebuilds the same city.
export let cellCache = new Map(), lotCache = new Map();
export const cellKey = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
export const signalPhase = (ix, iz) => hash01(SEED ^ 0x5151, ix, iz);

// The recompile wave is a straight front that crosses the plane. Cells behind it belong to the next epoch.
export const wave = { on: false, phase: '', dx: 1, dz: 0, front: -1e12, speed: 430, stop: 0, t: 0 };
const cellEpoch = (ix, iz) => EPOCH + (wave.on && ((ix + 0.5) * wave.dx + (iz + 0.5) * wave.dz) * CELL < wave.front ? 1 : 0);
export function getCell(ix, iz, e) {
  if (e === undefined) e = cellEpoch(ix, iz);
  const k = cellKey(ix, iz) * 4 + (e & 3); let c = cellCache.get(k);
  if (!c) { if (cellCache.size > 9000) cellCache.clear(); c = genCell(ix, iz, e); cellCache.set(k, c); }
  return c;
}

// elevated rail over some roads. axis 0 = the road along x at z = line * CELL. Returns the deck height, or 0.
export function railY(axis, line) {
  const on = l => hash01(SEED ^ 0x7A11, axis, l) < 0.17;
  return on(line) && !on(line - 1) ? (axis ? 31 : 22) : 0;
}
// the landmark spire of a region, or null
function spireOf(rx, rz) {
  const h = hashInt(SEED ^ 0x5B1E, rx, rz);
  if ((h & 255) > 150) return null;
  const ix = rx * SPIRE_GRID + 2 + ((h >>> 8) & 1023) % (SPIRE_GRID - 4), iz = rz * SPIRE_GRID + 2 + ((h >>> 18) & 1023) % (SPIRE_GRID - 4);
  return { ix, iz };
}
const isSpire = (ix, iz) => { const sp = spireOf(Math.floor(ix / SPIRE_GRID), Math.floor(iz / SPIRE_GRID)); return !!sp && sp.ix === ix && sp.iz === iz; };
// spire tiers as [height share, width share]; the needle takes the last 70 m
const SPIRE_TIERS = [[0.14, 0.86], [0.2, 0.68], [0.22, 0.5], [0.26, 0.34], [0.18, 0.2]];

// Step 1 of a cell: the lots. Footprint, height and style of every building. The far field draws only this.
function cellLots(ix, iz, e) {
  const key = cellKey(ix, iz) * 4 + (e & 3); let L = lotCache.get(key);
  if (L) return L;
  if (lotCache.size > 40000) lotCache.clear();
  const es = e * 0x9E5, X = ix * CELL, Z = iz * CELL, lo = ROAD / 2 + 1.5, hi = CELL - ROAD / 2 - 1.5, span = hi - lo;
  const rnd = mulberry32(hashInt(SEED ^ 0x10F5 ^ Math.imul(e, 0x51ED2705), ix, iz)), R = (a, b) => a + (b - a) * rnd();
  const dn = vnoise(ix / 5, iz / 5, 0x51 + es), dn2 = vnoise(ix / 2.3 + 40, iz / 2.3, 0x77 + es), goth = vnoise(ix / 4 + 9, iz / 4 - 7, 0x99 + es);
  const hBase = lerp(26, 250, Math.pow(dn, 1.7)) * lerp(0.7, 1.25, dn2);
  L = { lots: [], kind: 0, railX: railY(0, iz), railZ: railY(1, ix) };
  const lot = (x0, z0, x1, z1, h, podium) => {
    const sr = rnd(), pG = lerp(0.6, 0.25, goth), pT = lerp(0.2, 0.55, goth), seed = rnd();
    const code = rnd() < 0.3 ? R(0.55, 0.95) : R(0.08, 0.4);
    rnd();                                                       // one draw kept, so a seed still builds the city it built before
    const o = { x0, z0, x1, z1, h: Math.max(14, h), podium, seed, code, style: sr < pG ? 0 : sr < pG + pT ? 1 : 2 };
    L.lots.push(o); return o;
  };
  if (isSpire(ix, iz)) {                                         // landmark: one tower through the cloud deck
    L.kind = 1; const o = lot(X + lo + 3, Z + lo + 3, X + hi - 3, Z + hi - 3, R(900, 1080), true); o.style = 1; o.code = 0.9;
  } else {
    const pat = rnd();
    if (pat < 0.28) {                                            // one tower on a podium
      const w = R(46, 66), d = R(46, 66), ox = R(lo, hi - w), oz = R(lo, hi - d);
      lot(X + ox, Z + oz, X + ox + w, Z + oz + d, hBase * R(0.9, 1.5), true);
    } else if (pat < 0.62) {                                     // two slabs with an alley
      const s = R(0.4, 0.6) * span, g = R(2, 3.5);
      if (rnd() < 0.5) { lot(X + lo, Z + lo, X + lo + s - g, Z + hi, hBase * R(0.6, 1.3), false); lot(X + lo + s + g, Z + lo, X + hi, Z + hi, hBase * R(0.6, 1.3), false); }
      else { lot(X + lo, Z + lo, X + hi, Z + lo + s - g, hBase * R(0.6, 1.3), false); lot(X + lo, Z + lo + s + g, X + hi, Z + hi, hBase * R(0.6, 1.3), false); }
    } else if (pat < 0.93) {                                     // four buildings
      const sx = R(0.42, 0.58) * span, sz = R(0.42, 0.58) * span, g = R(2, 3);
      lot(X + lo, Z + lo, X + lo + sx - g, Z + lo + sz - g, hBase * R(0.5, 1.2), false);
      lot(X + lo + sx + g, Z + lo, X + hi, Z + lo + sz - g, hBase * R(0.5, 1.2), false);
      lot(X + lo, Z + lo + sz + g, X + lo + sx - g, Z + hi, hBase * R(0.5, 1.2), false);
      lot(X + lo + sx + g, Z + lo + sz + g, X + hi, Z + hi, hBase * R(0.5, 1.2), false);
    } else {                                                     // slim megatower on a plaza
      const w = R(30, 40), ox = R(lo + 6, hi - w - 6), oz = R(lo + 6, hi - w - 6);
      lot(X + ox, Z + oz, X + ox + w, Z + oz + w, Math.min(430, hBase * R(1.7, 2.3) + 60), true);
    }
  }
  lotCache.set(key, L); return L;
}
// far-field rows of a cell: one plain box per lot (rows use the same layout as chunk boxes)
export function farRows(ix, iz, e, out) {
  const L = cellLots(ix, iz, e), X = ix * CELL, Z = iz * CELL;
  for (const o of L.lots) {
    const bx = (o.x0 + o.x1) / 2, bz = (o.z0 + o.z1) / 2, w = o.x1 - o.x0 - 0.8, d = o.z1 - o.z0 - 0.8;
    if (L.kind === 1) {
      let y = 0; const Hb = o.h - 70;
      for (const [fr, ws] of SPIRE_TIERS) { out.push([bx, y, bz, w * ws, Hb * fr, w * ws, o.seed, 1, 0.9, 0, bx, bz]); y += Hb * fr; }
    } else out.push([bx, 0, bz, w, o.h, d, o.seed, o.style, o.code, 0, bx, bz]);
  }
  if (e === EPOCH) {                                             // rails do not change with the epoch: write them once
    if (L.railX) out.push([X + 50, L.railX, Z, CELL, 1.2, 7, 0.3, 0, 0, 5, 1e7, 1e7]);
    if (L.railZ) out.push([X, L.railZ, Z + 50, 7, 1.2, CELL, 0.3, 0, 0, 5, 1e7, 1e7]);
  }
}

// Step 2 of a cell: full detail. Every value comes from the seed, the cell and the epoch.
// boxes/props/poles rows: x, y0, z, w, h, d, seed, style, code, kind, buildingX, buildingZ
// kinds: 0 body, 1 podium, 2 roof prop, 3 pole, 4 train car, 5 viaduct, 6 blade sign, 7 roof screen
function genCell(ix, iz, e) {
  const L = cellLots(ix, iz, e);
  const rnd = mulberry32(hashInt(SEED ^ Math.imul(e, 0x2545F491), ix, iz)), R = (a, b) => a + (b - a) * rnd();
  const cell = { bodies: [], boxes: [], props: [], poles: [], cyls: [], beacons: [], lamps: [], signals: [], vents: [], spots: [], maxH: 0, top: 0, spire: null };
  const X = ix * CELL, Z = iz * CELL;

  const building = lot => {
    const bx = (lot.x0 + lot.x1) / 2, bz = (lot.z0 + lot.z1) / 2, { seed, style, code, h } = lot;
    const w0 = lot.x1 - lot.x0, d0 = lot.z1 - lot.z0;
    let w = w0, d = d0, y = 0;
    const body = (kind, hh, sd) => {
      cell.bodies.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2, y0: y, y1: y + hh });
      cell.boxes.push([bx, y, bz, w, hh, d, sd, style, code, kind, bx, bz]); y += hh;
    };
    if (style === 3) { body(0, h, seed); cell.maxH = Math.max(cell.maxH, y); cell.top = Math.max(cell.top, y); return; }
    if (lot.podium) { body(1, R(6, 12), seed + 0.5); const s = R(3, 7); w -= s * 2; d -= s * 2; }
    const nt = style === 0 ? (rnd() < 0.55 ? 1 : 2) : style === 1 ? (rnd() < 0.5 ? 2 : 3) : (rnd() < 0.6 ? 1 : 2);
    let tw = w, td = d;
    for (let t = 0; t < nt; t++) {
      const hh = t === nt - 1 ? h - y : (h - y) * R(0.45, 0.7);
      tw = w; td = d;
      body(0, Math.max(4, hh), seed + t * 0.013);
      const s = style === 1 ? R(3, 6) : R(2, 5);
      w = Math.max(8, w - s * 2); d = Math.max(8, d - s * 2);
    }
    // rooftop
    const prop = (px, py, pz, pw, ph, pd, kind) => cell.props.push([px, py, pz, pw, ph, pd, rnd(), style, 0, kind, bx, bz]);
    const cyl = (px, py, pz, r, hh, taper, st) => cell.cyls.push([px, py, pz, r, hh, r, rnd(), taper, st, 0, bx, bz]);
    const beacon = (px, py, pz, type, size) => cell.beacons.push([px, py, pz, type, size, rnd(), 0, bx, bz]);
    const mx = Math.max(0.5, tw / 2 - 2.5), mz = Math.max(0.5, td / 2 - 2.5);
    let top = y;
    if (style === 1) {                                           // gothic: corner pinnacles + spire
      const ph = R(7, 13);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(bx + sx * (tw / 2 - 1.2), y, bz + sz * (td / 2 - 1.2), 1.1, ph, 0.04, 2);
      top = y + ph;
      if (rnd() < 0.7) {
        const sh = R(14, 42);
        cyl(bx, y, bz, Math.min(tw, td) * R(0.22, 0.34), sh, 0.03, 2);
        beacon(bx, y + sh + 0.6, bz, 2, 2.6); top = y + sh;
      }
    } else if (style === 0) {                                    // glass: plant room, mast, AC units
      prop(bx + R(-mx, mx) * 0.3, y, bz + R(-mz, mz) * 0.3, tw * R(0.3, 0.55), R(2.5, 5), td * R(0.3, 0.5), 2);
      if (rnd() < 0.65) {
        const ah = R(10, 38), px = bx + R(-mx, mx) * 0.6, pz = bz + R(-mz, mz) * 0.6;
        prop(px, y, pz, 0.45, ah, 0.45, 3);
        beacon(px, y + ah + 0.4, pz, 1, 2.4); top = y + ah;
      }
      for (let i = 0, n = 1 + (rnd() * 3 | 0); i < n; i++) prop(bx + R(-mx, mx), y, bz + R(-mz, mz), R(1.5, 3), R(1, 1.8), R(1.5, 3), 2);
      if (h > 105 && rnd() < 0.2) cell.spots.push([bx + R(-mx, mx) * 0.5, y + 1, bz + R(-mz, mz) * 0.5, rnd(), bx, bz]);   // searchlight
    } else {                                                     // industrial: water tank, stacks, ducts
      const tx = bx + R(-mx, mx) * 0.7, tz = bz + R(-mz, mz) * 0.7;
      prop(tx, y, tz, 3.4, 2.4, 3.4, 2); cyl(tx, y + 2.4, tz, 2.5, 4.2, 1, 0); cyl(tx, y + 6.6, tz, 2.7, 1.6, 0.05, 0);
      top = y + 8.2;
      for (let i = 0, n = 1 + (rnd() * 2 | 0); i < n; i++) {
        const sx = bx + R(-mx, mx), sz = bz + R(-mz, mz), sh = R(12, 28);
        cyl(sx, y, sz, R(1.3, 2.1), sh, 0.72, 1);
        beacon(sx, y + sh + 0.5, sz, 2, 2.2);
        cell.vents.push([sx, y + sh, sz, 2.3]); top = Math.max(top, y + sh);
      }
      prop(bx + R(-mx, mx) * 0.5, y, bz + R(-mz, mz) * 0.5, R(4, 9), R(1.5, 2.5), R(2, 4), 2);
    }
    if (style !== 1 && tw > 20 && rnd() < 0.16) {                 // a glyph screen on the roof edge
      const sw = tw * R(0.6, 0.85), sh = R(5, 9), sgn = rnd() < 0.5 ? -1 : 1;
      if (rnd() < 0.5) prop(bx, y, bz + sgn * (td / 2 - 0.5), sw, sh, 0.5, 7); else prop(bx + sgn * (tw / 2 - 0.5), y, bz, 0.5, sh, Math.min(sw, td * 0.85), 7);
      top = Math.max(top, y + sh);
    }
    for (let i = 0, n = rnd() < 0.55 ? 1 + (rnd() * 2 | 0) : 0; i < n; i++) {   // blade signs: columns of glyphs that stand out from the facade
      const len = R(7, Math.min(24, h * 0.35)), sy = R(6, Math.max(7, Math.min(h * 0.5, 44) - len)), side = (rnd() * 4) | 0, sgn = side & 1 ? 1 : -1;
      if (side < 2) prop(bx + sgn * (w0 / 2 + 0.95), sy, bz + R(-0.4, 0.4) * d0, 1.9, len, 0.34, 6);
      else prop(bx + R(-0.4, 0.4) * w0, sy, bz + sgn * (d0 / 2 + 0.95), 0.34, len, 1.9, 6);
    }
    cell.maxH = Math.max(cell.maxH, y); cell.top = Math.max(cell.top, top);
  };

  const spire = lot => {
    const bx = (lot.x0 + lot.x1) / 2, bz = (lot.z0 + lot.z1) / 2, w = lot.x1 - lot.x0, Hb = lot.h - 70; let y = 0;
    SPIRE_TIERS.forEach(([fr, ws], t) => {
      const ww = w * ws, hh = Hb * fr;
      cell.bodies.push({ x0: bx - ww / 2, x1: bx + ww / 2, z0: bz - ww / 2, z1: bz + ww / 2, y0: y, y1: y + hh });
      if (t === 0) { cell.boxes.push([bx, 0, bz, ww, 14, ww, lot.seed + 0.5, 1, 0.9, 1, bx, bz]); cell.boxes.push([bx, 14, bz, ww - 6, hh - 14, ww - 6, lot.seed, 1, 0.9, 0, bx, bz]); }
      else cell.boxes.push([bx, y, bz, ww, hh, ww, lot.seed + t * 0.013, 1, 0.9, 0, bx, bz]);
      y += hh;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cell.beacons.push([bx + sx * ww / 2, y + 1, bz + sz * ww / 2, 2, 3.4, rnd(), 0, bx, bz]);
    });
    cell.cyls.push([bx, y, bz, w * 0.045, 70, w * 0.045, rnd(), 0.04, 2, 0, bx, bz]);
    cell.beacons.push([bx, y + 71, bz, 1, 6, rnd(), 0, bx, bz]);
    cell.maxH = y; cell.top = y + 70; cell.spire = { x: bx, y: y + 70, z: bz };
  };

  if (L.kind === 1) spire(L.lots[0]); else for (const lot of L.lots) building(lot);
  // elevated rail: a deck over the road on portal frames
  const rail = (axis, ry) => {
    const cx = axis ? X : X + 50, cz = axis ? Z + 50 : Z, sx = axis ? 7 : CELL, sz = axis ? CELL : 7;
    cell.boxes.push([cx, ry, cz, sx, 1.2, sz, 0.3, 0, 0, 5, 1e7, 1e7]);
    cell.bodies.push({ x0: cx - sx / 2, x1: cx + sx / 2, z0: cz - sz / 2, z1: cz + sz / 2, y0: ry, y1: ry + 1.2 });
    for (const a of [25, 75]) {
      for (const sgn of [-1, 1]) cell.poles.push(axis ? [X + sgn * 9.7, 0, Z + a, 0.9, ry, 0.9, 0.4, 0, 0, 3, 1e7, 1e7] : [X + a, 0, Z + sgn * 9.7, 0.9, ry, 0.9, 0.4, 0, 0, 3, 1e7, 1e7]);
      cell.poles.push(axis ? [X, ry - 0.9, Z + a, 20.3, 0.9, 0.9, 0.4, 0, 0, 3, 1e7, 1e7] : [X + a, ry - 0.9, Z, 0.9, 0.9, 20.3, 0.4, 0, 0, 3, 1e7, 1e7]);
    }
  };
  if (L.railX) rail(0, L.railX);
  if (L.railZ) rail(1, L.railZ);

  // street lamps: positions must match lampPool() in the ground shader
  const lampAt = (lx, lz, px, pz) => {
    cell.lamps.push([lx, 8.4, lz, 0, 3.6, 0, 0, 1e7, 1e7]);
    cell.poles.push([px, 0, pz, 0.3, 8.7, 0.3, 0.5, 0, 0, 3, 1e7, 1e7]);
    cell.poles.push([(lx + px) / 2, 8.55, (lz + pz) / 2, Math.abs(lx - px) + 0.22, 0.2, Math.abs(lz - pz) + 0.22, 0.5, 0, 0, 3, 1e7, 1e7]);
  };
  for (const a of [12.5, 62.5]) { lampAt(X + 6.5, Z + a, X + 10.6, Z + a); lampAt(X + a, Z + 6.5, X + a, Z + 10.6); }
  for (const a of [37.5, 87.5]) { lampAt(X - 6.5, Z + a, X - 10.6, Z + a); lampAt(X + a, Z - 6.5, X + a, Z - 10.6); }
  // traffic signals at the intersection this cell owns
  const ph = signalPhase(ix, iz);
  for (const [sx, sz, axis] of [[-9, 9, 0], [9, -9, 0], [9, 9, 1], [-9, -9, 1]]) {
    cell.signals.push([X + sx, 6.2, Z + sz, 3, 1.5, ph, axis, 1e7, 1e7]);
    cell.poles.push([X + sx, 0, Z + sz, 0.26, 6.5, 0.26, 0.3, 0, 0, 3, 1e7, 1e7]);
  }
  // steam vents in the road
  for (let i = 0, n = (rnd() * 2.4) | 0; i < n; i++) {
    if (rnd() < 0.5) cell.vents.push([X + R(-6, 6), 0.1, Z + R(20, 80), 1]);
    else cell.vents.push([X + R(20, 80), 0.1, Z + R(-6, 6), 1]);
  }
  return cell;
}
