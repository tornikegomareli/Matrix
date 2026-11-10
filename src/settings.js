// The seed of the city and the switches of the page
import { hash01, lerp } from './core.js';

export let SEED = (() => {
  const m = /seed=([0-9a-f]{1,8})/i.exec(location.hash);
  return m ? parseInt(m[1], 16) >>> 0 : (Math.random() * 4294967296) >>> 0;
})();
export const seedHex = () => SEED.toString(16).toUpperCase().padStart(8, '0');

export const GLITCH_NAMES = ['OFF', 'LOW', 'MED', 'HIGH'], GLITCH_GAP = [1e9, 13, 6.5, 2.6];
export const CODE_NAMES = ['LOW', 'MED', 'HIGH'], CODE_MUL = [0.15, 0.45, 1.0];
export const S = { rain: true, traffic: true, glitch: 0, code: 1, sound: true, music: true };

// smooth value noise over cell coordinates, used for district height and style
export function vnoise(x, z, salt) {
  const xi = Math.floor(x), zi = Math.floor(z);
  let fx = x - xi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const s = SEED ^ salt;
  const a = hash01(s, xi, zi), b = hash01(s, xi + 1, zi), c = hash01(s, xi, zi + 1), d = hash01(s, xi + 1, zi + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
export const setSeed = v => { SEED = v; };
