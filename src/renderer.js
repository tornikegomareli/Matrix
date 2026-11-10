// The renderer, the uniforms that all materials share, and the function that makes a material
import * as THREE from 'three';
import { $, FOG_FAR } from './core.js';
import { makeGlyphAtlas } from './glyphs.js';
import { GL_COMMON } from './shaders/common.js';

export const canvas = $('gl');
export let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
} catch (e) { /* handled below */ }
if (!renderer || !renderer.capabilities.isWebGL2) { $('err').style.display = 'flex'; throw new Error('WebGL2 required'); }
renderer.autoClear = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // the final pass encodes
renderer.toneMapping = THREE.NoToneMapping;               // ACES runs in the composite pass
export const HDR = (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))
  ? THREE.HalfFloatType : THREE.UnsignedByteType;
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
if (IS_TOUCH) {
  document.body.classList.add('touch');
  $('hint').textContent = 'STICK move \u00b7 DRAG look \u00b7 BOOST \u00b7 TIME bullet-time \u00b7 CINE cinematic';
}

export const U = {
  uTime: { value: 0 }, uRTime: { value: 0 }, uMirror: { value: 1 },
  uFogCol: { value: new THREE.Vector3(0.017, 0.027, 0.038) },
  uFogDen: { value: 0.0009 }, uFogH: { value: 0.0022 }, uFogFar: { value: FOG_FAR },
  uCloud: { value: 0 }, uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0.5, 0.6, 0.3).normalize() },
  uGlyph: { value: makeGlyphAtlas(renderer.capabilities.getMaxAnisotropy()) },
  uCode: { value: 1 },
  uGlitchA: { value: new THREE.Vector4(1e9, 1e9, 0, 0) }, uGlitchB: { value: new THREE.Vector4(1e9, 1e9, 0, 0) },
  uRes: { value: new THREE.Vector2(1, 1) }, uRefl: { value: null },
  uCamVel: { value: new THREE.Vector3() }, uBoost: { value: 0 }, uSlow: { value: 0 },
  uAbove: { value: 0 }, uFlashPos: { value: new THREE.Vector3() },
  uNear: { value: new THREE.Vector4() }, uWave: { value: new THREE.Vector4(1, 0, 0, 0) },
  uDark: { value: new THREE.Vector4(0, 1, 0, 0) },
  uFold: { value: new THREE.Vector4(0, 300, 0, 0) },
  uPL: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4()) }, uPLc: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4()) }, uPLn: { value: 0 },
  uInA: { value: new THREE.Vector3(1e9, 1e9, 1e9) }, uInB: { value: new THREE.Vector3(-1e9, -1e9, -1e9) },
  uHoleA: { value: [new THREE.Vector3(1e9, 1e9, 1e9), new THREE.Vector3(1e9, 1e9, 1e9)] }, uHoleB: { value: [new THREE.Vector3(-1e9, -1e9, -1e9), new THREE.Vector3(-1e9, -1e9, -1e9)] },
  uBuild: { value: new THREE.Vector4() }, uRainK: { value: 1 }, uNF: { value: new THREE.Vector2(0.5, 60000) }, tDepth: { value: null }, uCover: { value: null }, uNoise3: { value: null },
};
export const mkMat = (vs, fs, extra, opts) => new THREE.ShaderMaterial(Object.assign({
  uniforms: Object.assign({}, U, extra || {}), vertexShader: '#define VS\n' + GL_COMMON + vs, fragmentShader: GL_COMMON + fs,
}, opts || {}));
