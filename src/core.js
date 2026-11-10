// Constants and small helpers
export const CELL = 100, ROAD = 24, ASPH = 16;          // road pitch, right-of-way, asphalt width
export const CHUNK_CELLS = 2, CHUNK = CELL * CHUNK_CELLS;
export const RC = 6;                                     // chunk radius around the camera
export const FOG_FAR = 1150;                             // everything is fully fogged before the load edge
export const CLOUD_Y = 620, DECK_TOP = 930, CLOUD_TOP = 1750;   // the clouds: the base, the top of the flat deck, the top of the highest tower
export const MACH = 340;                                 // boost top speed, units (metres) per second
export const CEIL = 3200;                                // flight ceiling
export const FAR_R = 44, FAR_SNAP = 8;                   // far-field radius and re-centre step, in cells
export const SPIRE_GRID = 18;                            // one landmark spire at most per 18 x 18 cells
export let EPOCH = 0;                                    // generation of the city; a recompile wave moves it forward
export const setEpoch = v => { EPOCH = v; };
export const TAU = Math.PI * 2;

export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const $ = id => document.getElementById(id);

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function hashInt(a, b, c) {
  let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul(b | 0, 0x85EBCA77) ^ Math.imul(c | 0, 0xC2B2AE3D);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return h >>> 0;
}
export const hash01 = (a, b, c) => hashInt(a, b, c) / 4294967296;
