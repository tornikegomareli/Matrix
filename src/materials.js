// The materials: one for each kind of thing that is drawn
import * as THREE from 'three';
import { mkMat } from './renderer.js';
import { BOX_FS, BOX_VS } from './shaders/buildings.js';
import { CYL_FS, CYL_VS } from './shaders/roofs.js';
import { GROUND_FS, GROUND_VS } from './shaders/ground.js';
import { SKY_FS, SKY_VS } from './shaders/sky.js';
import { LIGHT_FS, LIGHT_VS } from './shaders/lights.js';
import { STAR_FS, STAR_VS } from './shaders/stars.js';
import { RAIN_FS, RAIN_VS } from './shaders/rain.js';
import { STEAM_FS, STEAM_VS } from './shaders/steam.js';
import { CARL_FS, CARL_VS, CAR_FS, CAR_VS } from './shaders/cars.js';
import { RIB_FS, RIB_VS } from './shaders/ribbons.js';

// double-sided: streak quads face either way, and the mirrored pass flips the winding of every sprite
export const ADD = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide };
export const matBox = mkMat(BOX_VS, BOX_FS, null, { side: THREE.DoubleSide });
export const matFar = mkMat(BOX_VS, BOX_FS, null, { side: THREE.DoubleSide, defines: { FAR: 1 } });
export const matCyl = mkMat(CYL_VS, CYL_FS, null, { side: THREE.DoubleSide });
export const matGround = mkMat(GROUND_VS, GROUND_FS, { uCenter: { value: new THREE.Vector2() }, uReflOn: { value: 1 }, uRainOn: { value: 1 }, uTraffic: { value: 1 } }, { side: THREE.DoubleSide });
export const matSky = mkMat(SKY_VS, SKY_FS, { uMoonTex: { value: null }, uGalaxy: { value: null } }, { side: THREE.DoubleSide, depthWrite: false });
export const matStar = mkMat(STAR_VS, STAR_FS, null, { blending: THREE.AdditiveBlending, depthWrite: false });
export const matLight = mkMat(LIGHT_VS, LIGHT_FS, null, ADD);
export const matRib = mkMat(RIB_VS, RIB_FS, null, ADD);
export const matRain = mkMat(RAIN_VS, RAIN_FS, { uRainVel: { value: new THREE.Vector3(5, -44, 2.5) }, uRainT: { value: 0 }, uRainScale: { value: 1 } }, ADD);
export const matSteam = mkMat(STEAM_VS, STEAM_FS, null, { transparent: true, depthWrite: false, premultipliedAlpha: true });
export const matCar = mkMat(CAR_VS, CAR_FS, null, { side: THREE.DoubleSide });
export const matCarL = mkMat(CARL_VS, CARL_FS, null, Object.assign({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, ADD));
