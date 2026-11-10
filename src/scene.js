// The scene, the cameras and the geometry that is shared
import * as THREE from 'three';
import { mulberry32 } from './core.js';
import { IS_TOUCH } from './renderer.js';
import { matCar, matCarL, matGround, matRain, matSky, matStar, matSteam } from './materials.js';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 60000);
export const reflCam = new THREE.PerspectiveCamera();
reflCam.matrixAutoUpdate = false; reflCam.matrixWorldAutoUpdate = false; reflCam.layers.enable(1);

export const geoBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
export const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false).translate(0, 0.5, 0);
export const geoQuad = new THREE.PlaneGeometry(2, 2);            // corners at -1..1
export const geoStreak = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);   // x -0.5..0.5, y 0..1

export function instGeo(base, cap, layout) {
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  if (base.attributes.normal) g.setAttribute('normal', base.attributes.normal);
  if (base.attributes.aPart) g.setAttribute('aPart', base.attributes.aPart);
  for (const [name, n] of layout) {
    const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n);
    a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(name, a);
  }
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);
  return g;
}
export function addMesh(geo, mat, order) {
  const m = new THREE.Mesh(geo, mat);
  m.matrixAutoUpdate = false; m.frustumCulled = false;
  if (order !== undefined) m.renderOrder = order;
  if (mat.transparent) m.layers.set(1);                 // glows are drawn after the clouds
  scene.add(m); return m;
}
function fillRandom(attr, rnd) { const a = attr.array; for (let i = 0; i < a.length; i++) a[i] = rnd(); attr.needsUpdate = true; }

export const geoGroundFlat = new THREE.PlaneGeometry(1, 1);
// the same plane cut into strips across z, fine within 4 km: the fold bends it, and one quad cannot bend
export const geoGroundFold = (() => {
  const xs = [-30000, -6000, -1500, -400, 0, 400, 1500, 6000, 30000], zs = [-30000, -16000, -8000], pos = [], idx = [];
  for (let z = -4000; z <= 4000; z += 12.5) zs.push(z);
  zs.push(8000, 16000, 30000);
  for (const z of zs) for (const x of xs) pos.push(x / 60000, z / 60000, 0);
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) { const a = j * xs.length + i, b = a + xs.length; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
})();
export const ground = addMesh(geoGroundFlat, matGround);
const sky = addMesh(new THREE.IcosahedronGeometry(1, 2), matSky, 5);
// 5,000 stars of the Yale Bright Star Catalogue, already turned into the frame of this world. 8 bytes each: direction, magnitude, colour index
const starGeo = new THREE.BufferGeometry();
{
  const bin = new Uint8Array(await (await fetch('sky/stars.bin')).arrayBuffer()), n = bin.length / 8, dir = new Float32Array(n * 3), st = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * 8, i16 = k => { const v = bin[o + k] | (bin[o + k + 1] << 8); return (v > 32767 ? v - 65536 : v) / 32767; };
    dir[i * 3] = i16(0); dir[i * 3 + 1] = i16(2); dir[i * 3 + 2] = i16(4);
    st[i * 2] = bin[o + 6] / 28 - 1.5; st[i * 2 + 1] = bin[o + 7] / 110 - 0.4;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(dir, 3)); starGeo.setAttribute('aStar', new THREE.BufferAttribute(st, 2));
}
export const stars = new THREE.Points(starGeo, matStar);
stars.frustumCulled = false; stars.matrixAutoUpdate = false; stars.renderOrder = 6; scene.add(stars);   // after the sky, before the clouds

const N_RAIN = IS_TOUCH ? 7000 : 15000;
const rainGeo = instGeo(geoStreak, N_RAIN, [['aSeed', 4]]); rainGeo.instanceCount = N_RAIN;
fillRandom(rainGeo.attributes.aSeed, mulberry32(11));
export const rain = addMesh(rainGeo, matRain, 20);

export const MAX_STEAM = 2048, STEAM_PER_VENT = 8;
export const steamGeo = instGeo(geoQuad, MAX_STEAM, [['aBase', 4], ['aRnd', 4]]);
export const steam = addMesh(steamGeo, matSteam, 15);

// car body = two boxes, nose toward +z
const geoCar = (() => {
  const a = new THREE.BoxGeometry(1.9, 0.7, 4.4).translate(0, 0.65, 0).toNonIndexed();
  const b = new THREE.BoxGeometry(1.7, 0.55, 2.3).translate(0, 1.27, -0.25).toNonIndexed();
  const g = new THREE.BufferGeometry();
  for (const n of ['position', 'normal']) {
    const arr = new Float32Array(a.attributes[n].array.length + b.attributes[n].array.length);
    arr.set(a.attributes[n].array); arr.set(b.attributes[n].array, a.attributes[n].array.length);
    g.setAttribute(n, new THREE.BufferAttribute(arr, 3));
  }
  return g;
})();
// six quads per car: 2 headlights, 2 taillights, beam and tail glow on the road
const geoCarL = (() => {
  const pos = [], part = [], idx = [];
  for (let p = 0; p < 6; p++) {
    const o = p * 4;
    pos.push(-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0); part.push(p, p, p, p);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  return g;
})();
export const N_CARS = IS_TOUCH ? 140 : 280, CAR_EXTRA = 8;
export const carGeo = instGeo(geoCar, N_CARS + CAR_EXTRA, [['iCar', 4], ['iCarS', 1]]);
export const carLGeo = instGeo(geoCarL, N_CARS, []);
carLGeo.setAttribute('iCar', carGeo.attributes.iCar); carLGeo.setAttribute('iCarS', carGeo.attributes.iCarS);
export const carMesh = addMesh(carGeo, matCar), carLMesh = addMesh(carLGeo, matCarL, 12);
export const _t = new THREE.Vector3();                   // a vector to work in
