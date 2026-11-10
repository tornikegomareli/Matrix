// State that more than one module reads and writes
import * as THREE from 'three';

export const clock = { world: 0, rain: 0, real: 0, rate: 1 };            // seconds. rate is the pace of the world: 1 runs, 0 holds still, below 0 runs backwards
// started: the picture is on. fade: how far it has faded in. quality: the share of the pixels that are drawn.
// fovAdd: degrees a tour adds to the lens angle, below 0 is a longer lens. fogAlt: a height to take the fog from, in place of the height of the camera
export const view = { started: false, fade: 0, quality: 1, fovAdd: 0, fogAlt: null };
export const P = {
  pos: new THREE.Vector3(0, 120, 50), vel: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0,
  boost: 0, slow: 0, yawRate: 0, pitchRate: 0, speed: 0, boomArmed: true, shake: 0,
};
export const keys = {};
export const touch = { fx: 0, fy: 0, boost: false, slow: false };
export const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight'];
export const cine = { pts: [], i: 1, u: 0, v: 60, rnd: null, step: 0, f: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(1, 0, 0), roll: 0, head: 0, pan: 0, yaw0: 0, y0: 0, on: false, move: null };   // on: cinematic flight. move: the function that moves the camera in it
export const build = { on: false, r: 0, speed: 0, auto: false };   // the city while it builds itself outward from a point
export const nearest = { train: 1e9, pan: 0 };                           // the train that is nearest to the camera: metres, and the side it is on
