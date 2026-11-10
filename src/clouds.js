// Cloud noise: a tileable volume and a coverage map, made once
import * as THREE from 'three';
import { CLOUD_TOP, CLOUD_Y, clamp, lerp, mulberry32, smooth } from './core.js';
import { clock } from './state.js';
import { U } from './renderer.js';
import { matSky } from './materials.js';

const COVER_N = 256, coverData = new Uint8Array(COVER_N * COVER_N * 2);
{
  const rnd = mulberry32(0xC10D5), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10), wrap = (i, P) => ((i % P) + P) % P;
  const perlin = (x, y, z, P) => {                                // Perlin noise that repeats every P cells
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const x0 = wrap(xi, P), x1 = (x0 + 1) % P, y0 = wrap(yi, P), y1 = (y0 + 1) % P, z0 = wrap(zi, P), z1 = (z0 + 1) % P;
    const u = fade(xf), v = fade(yf), w = fade(zf), h = (X, Y, Z) => perm[perm[perm[X] + Y] + Z];
    return lerp(lerp(lerp(grad(h(x0, y0, z0), xf, yf, zf), grad(h(x1, y0, z0), xf - 1, yf, zf), u), lerp(grad(h(x0, y1, z0), xf, yf - 1, zf), grad(h(x1, y1, z0), xf - 1, yf - 1, zf), u), v),
      lerp(lerp(grad(h(x0, y0, z1), xf, yf, zf - 1), grad(h(x1, y0, z1), xf - 1, yf, zf - 1), u), lerp(grad(h(x0, y1, z1), xf, yf - 1, zf - 1), grad(h(x1, y1, z1), xf - 1, yf - 1, zf - 1), u), v), w);
  };
  const worley = P => {                                           // cells that repeat every P: 1 at a feature point, 0 a cell away
    const pts = new Float32Array(P * P * P * 3); for (let i = 0; i < pts.length; i++) pts[i] = rnd();
    return (x, y, z) => {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let m = 9;
      for (let c = -1; c <= 1; c++) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const cx = xi + a, cy = yi + b, cz = zi + c, k = ((wrap(cz, P) * P + wrap(cy, P)) * P + wrap(cx, P)) * 3;
        const dx = cx + pts[k] - x, dy = cy + pts[k + 1] - y, dz = cz + pts[k + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (d < m) m = d;
      }
      return 1 - Math.min(1, Math.sqrt(m));
    };
  };
  const pack = (f, out) => {                                      // stretch both channels to the full byte range
    for (let c = 0; c < 2; c++) {
      let lo = 1e9, hi = -1e9;
      for (let i = c; i < f.length; i += 2) { lo = Math.min(lo, f[i]); hi = Math.max(hi, f[i]); }
      for (let i = c; i < f.length; i += 2) out[i] = Math.round((f[i] - lo) / (hi - lo) * 255);
    }
    return out;
  };
  // volume: r = billows (Perlin pushed up by cells), g = fine cells that eat the edges
  const N = 64, f = new Float32Array(N * N * N * 2);
  const w4 = worley(4), w8 = worley(8), w16 = worley(16), d6 = worley(6), d12 = worley(12), d24 = worley(24);
  for (let z = 0, i = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++, i += 2) {
    const u = x / N, v = y / N, w = z / N;
    const pf = 0.5 + (perlin(u * 4, v * 4, w * 4, 4) + 0.5 * perlin(u * 8, v * 8, w * 8, 8) + 0.25 * perlin(u * 16, v * 16, w * 16, 16)) * 0.55;
    const wf = 0.625 * w4(u * 4, v * 4, w * 4) + 0.25 * w8(u * 8, v * 8, w * 8) + 0.125 * w16(u * 16, v * 16, w * 16);
    f[i] = wf + pf * (1 - wf);
    f[i + 1] = 0.625 * d6(u * 6, v * 6, w * 6) + 0.25 * d12(u * 12, v * 12, w * 12) + 0.125 * d24(u * 24, v * 24, w * 24);
  }
  const vol = new THREE.Data3DTexture(pack(f, new Uint8Array(f.length)), N, N, N);
  vol.format = THREE.RGFormat; vol.type = THREE.UnsignedByteType; vol.minFilter = vol.magFilter = THREE.LinearFilter;
  vol.wrapS = vol.wrapT = vol.wrapR = THREE.RepeatWrapping; vol.unpackAlignment = 1; vol.needsUpdate = true;
  U.uNoise3.value = vol;
  // coverage map: r = how much cloud, g = how high it builds
  const c = new Float32Array(COVER_N * COVER_N * 2);
  for (let y = 0, i = 0; y < COVER_N; y++) for (let x = 0; x < COVER_N; x++, i += 2) {
    const u = x / COVER_N, v = y / COVER_N;
    for (let o = 0, fq = 6, a = 1; o < 4; o++, fq *= 2, a *= 0.5) { c[i] += a * perlin(u * fq, v * fq, 0.37, fq); c[i + 1] += a * perlin(u * fq + 0.5, v * fq + 0.5, 3.61, fq); }
  }
  const cov = new THREE.DataTexture(pack(c, coverData), COVER_N, COVER_N, THREE.RGFormat, THREE.UnsignedByteType);
  cov.minFilter = cov.magFilter = THREE.LinearFilter; cov.wrapS = cov.wrapT = THREE.RepeatWrapping; cov.needsUpdate = true;
  U.uCover.value = cov;
  // the moon's near side
  const img = new Image(), moonTex = new THREE.Texture(img);
  moonTex.colorSpace = THREE.SRGBColorSpace; moonTex.minFilter = THREE.LinearMipmapLinearFilter; moonTex.anisotropy = 4;
  img.onload = () => { moonTex.needsUpdate = true; };
  img.src = 'sky/moon.jpg';
  matSky.uniforms.uMoonTex.value = moonTex;
  // the Milky Way, turned into the frame of this world
  const gimg = new Image(), galTex = new THREE.Texture(gimg);
  galTex.colorSpace = THREE.SRGBColorSpace; galTex.minFilter = galTex.magFilter = THREE.LinearFilter; galTex.generateMipmaps = false; galTex.wrapS = THREE.RepeatWrapping;
  gimg.onload = () => { galTex.needsUpdate = true; };
  gimg.src = 'sky/galaxy.jpg';
  matSky.uniforms.uGalaxy.value = galTex;
}
// the same cloud field in the script, without the 3D noise: how much cloud there is around a point, 0..1
export function cloudAt(x, y, z) {
  const yy = y - CLOUD_Y; if (yy <= 0 || y >= CLOUD_TOP) return 0;
  const map = (u, v, c) => {                                    // the coverage map, repeated, with linear filtering
    u = u * COVER_N - 0.5; v = v * COVER_N - 0.5; const ui = Math.floor(u), vi = Math.floor(v), fu = u - ui, fv = v - vi;
    const at = (a, b) => coverData[((((vi + b) % COVER_N) + COVER_N) % COVER_N * COVER_N + (((ui + a) % COVER_N) + COVER_N) % COVER_N) * 2 + c] / 255;
    return lerp(lerp(at(0, 0), at(1, 0), fu), lerp(at(0, 1), at(1, 1), fu), fv);
  };
  const wx = x + clock.world * 9, wz = z + clock.world * 3.5, cov = smooth(0.22, 0.70, map(wx / 16000, wz / 16000, 0)), deck = lerp(150, 310, map(wx / 16000, wz / 16000, 1));
  const tw = smooth(0.55, 0.80, map(wx / 5300 + 0.37, wz / 5300 + 0.37, 1)) * cov, top = deck + 950 * tw, inT = tw * smooth(deck * 0.7, deck * 1.5, yy);
  const prof = smooth(0, 18, yy) * (1 - smooth(top * lerp(0.35, 0.5, tw), top, yy)), need = lerp((1 - cov) * 0.9 + 0.08, 0.5, inT);
  return clamp((0.72 * prof - need) * 4, 0, 1);                 // the 3D noise is taken as a middle value
}
