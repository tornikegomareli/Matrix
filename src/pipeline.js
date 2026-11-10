// The render pipeline: the targets, the post-processing passes, and the function that draws one frame
import * as THREE from 'three';
import { CLOUD_Y, clamp, lerp } from './core.js';
import { S } from './settings.js';
import { P, view } from './state.js';
import { GL_COMMON } from './shaders/common.js';
import { HDR, IS_TOUCH, U, renderer } from './renderer.js';
import { matGround } from './materials.js';
import { camera, ground, rain, reflCam, scene, stars, steam } from './scene.js';
import { chunkLOD, farGeo, farMesh } from './world/chunks.js';

const postScene = new THREE.Scene(), postCam = new THREE.Camera();
const postMesh = new THREE.Mesh(new THREE.BufferGeometry(), null);
postMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
postMesh.frustumCulled = false; postScene.add(postMesh);
const POST_VS = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const POST_H = 'varying vec2 vUv; float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }\n';
const postMat = (fs, uniforms, opts) => new THREE.ShaderMaterial(Object.assign(
  { uniforms, vertexShader: POST_VS, fragmentShader: POST_H + fs, depthTest: false, depthWrite: false }, opts || {}));
function runPass(mat, target) { postMesh.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }

const matDown = postMat(/* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPre;
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb
     + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.125;
  if (uPre > 0.5) { c = clamp(c, 0.0, 24.0); c *= smoothstep(0.45, 1.8, max(c.r, max(c.g, c.b))); }   // only light blooms
  gl_FragColor = vec4(c, 1.0);
}`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPre: { value: 0 } });

const matUp = postMat(/* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uGain;
void main(){
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  gl_FragColor = vec4(c * 0.25 * uGain, 1.0);
}`, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uGain: { value: 0.9 } },
  { blending: THREE.AdditiveBlending, transparent: true });

// composite: motion blur, depth of field, bloom, ACES, green grade, trails
export const matComp = postMat(/* glsl */`
uniform sampler2D tScene, tBloom, tPrev, tDepth;
uniform vec2 uRes, uRot, uNF;
uniform float uAspect, uTime, uSpeedN, uTrail, uExposure, uBloom, uFocus, uAper;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
// the look of the film's scenes inside the Matrix: the picture is real, but everything leans to a sick green.
// Mid tones and highlights go green, reds and blues lose their richness, shadows go deep and green-black.
vec3 grade(vec3 c){
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 0.42);
  c *= mix(vec3(0.46, 1.0, 0.78), vec3(0.64, 1.07, 0.64), smoothstep(0.0, 0.4, l));   // teal-green in the shadows, yellow-green in the mid tones
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.45);
  c += vec3(0.0, 0.010, 0.005) * (1.0 - smoothstep(0.0, 0.25, l));
  c = mix(c, vec3(0.80, 1.0, 0.82) * max(max(c.r, c.g), c.b), smoothstep(0.55, 1.0, l) * 0.75);   // highlights burn to a pale green
  c *= 0.55 + 0.45 * smoothstep(0.0, 0.09, l);                            // the darkest shadows go deeper
  return max(c, 0.0);
}
void main(){
  vec2 uv = vUv, c = uv - 0.5;
  float r = length(vec2(c.x * uAspect, c.y));
  float zs = texture2D(tDepth, uv).r, sd = uNF.x * uNF.y / (uNF.y - zs * (uNF.y - uNF.x));
  vec2 mv = c * (0.11 * uSpeedN * (0.25 + r)) * clamp(110.0 / sd, 0.0, 1.0) + uRot;   // zoom blur from speed: near things streak, far things and the sky hold still. Plus pan blur from turning
  vec3 col;
  if (length(mv * uRes) > 1.5) {
    float j = h21(gl_FragCoord.xy + fract(uTime) * 37.0);
    col = vec3(0.0);
    for (int i = 0; i < 8; i++) col += texture2D(tScene, uv - mv * ((float(i) + j) / 8.0)).rgb;
    col *= 0.125;
  } else col = texture2D(tScene, uv).rgb;
  if (uAper > 0.0) {                                                      // depth of field: what is off the focus distance spreads into a disc
    float px = uRes.y / 1080.0, cc = min(uAper * abs(1.0 - uFocus / sd), uAper * 1.6) * px;   // the radius of the disc of this pixel
    if (cc > 0.6) {
      vec3 acc = clamp(col, 0.0, 64.0); float ws = 1.0, a0 = h21(gl_FragCoord.xy) * 6.2832;
      for (int i = 0; i < 24; i++) {
        float fi = float(i) + 0.5, rr = sqrt(fi / 24.0) * cc, an = fi * 2.39996 + a0;
        vec2 tuv = uv + vec2(cos(an), sin(an)) * rr / uRes;
        float zt = texture2D(tDepth, tuv).r, dt = uNF.x * uNF.y / (uNF.y - zt * (uNF.y - uNF.x));
        float ct = min(uAper * abs(1.0 - uFocus / dt), uAper * 1.6) * px;
        vec3 tc = clamp(texture2D(tScene, tuv).rgb, 0.0, 64.0);
        float w = (dt >= sd ? 1.0 : smoothstep(rr - 1.0, rr + 1.0, ct)) * (1.0 + 1.5 * max(tc.g - 1.0, 0.0));   // a sharp thing in front does not smear; lights weigh more
        acc += tc * w; ws += w;
      }
      col = acc / ws;
    }
  }
  col = clamp(col, 0.0, 64.0);
  col += texture2D(tBloom, uv).rgb * uBloom;
  col = grade(aces(col * uExposure));
  col = max(col, texture2D(tPrev, vUv).rgb * uTrail);                     // bullet-time trails
  gl_FragColor = vec4(col, 1.0);
}`, {
  tScene: { value: null }, tBloom: { value: null }, tPrev: { value: null }, tDepth: U.tDepth, uNF: U.uNF, uRes: { value: new THREE.Vector2() }, uRot: { value: new THREE.Vector2() },
  uAspect: { value: 1 }, uTime: { value: 0 }, uSpeedN: { value: 0 }, uTrail: { value: 0 },
  uExposure: { value: 1.3 }, uBloom: { value: 0.34 }, uFocus: { value: 10 }, uAper: { value: 0 },   // uAper: the blur radius of the far distance in pixels at 1080p; 0 = all sharp
});

// the clouds: a ray march through the layer at half size, stopped by the scene depth. rgb = light gathered, a = what still shows through
const matCloud = new THREE.ShaderMaterial({
  uniforms: Object.assign({}, U, { uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uJit: { value: 0 } }),
  vertexShader: POST_VS, depthTest: false, depthWrite: false, fragmentShader: GL_COMMON + /* glsl */`
varying vec2 vUv;
uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos; uniform float uJit;
const float SIGMA = 0.032;                                                 // extinction per metre of full cloud
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
void main(){
  vec4 f4 = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize(mat3(uCamWorld) * (f4.xyz / f4.w)), ro = uCamPos;
  float z = texture2D(tDepth, vUv).r, tScene = 1e9;
  if (z < 0.999999) { vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); tScene = length(v.xyz / v.w); }
  float iy = 1.0 / (abs(rd.y) < 1e-4 ? (rd.y < 0.0 ? -1e-4 : 1e-4) : rd.y);
  float ta = (CLOUD_Y - ro.y) * iy, tb = (CLOUD_TOP - ro.y) * iy;
  float t = max(min(ta, tb), 0.0), t1 = min(min(max(ta, tb), tScene), 30000.0);
  vec3 col = vec3(0.0); float T = 1.0;
  if (t1 > t) {
    float mu = dot(rd, MOON_DIR), phase = min(mix(hg(mu, -0.25), hg(mu, 0.62), 0.5), 2.4);
    float dt = max(24.0, t * 0.03); int fine = 0;                         // long steps through clear air; fine counts down the short steps after cloud
    t += dt * h21(gl_FragCoord.xy + uJit * 7.31);
    for (int i = 0; i < 160; i++) {
      if (t >= t1 || T < 0.02) break;
      vec3 p = ro + rd * t;
      float lod = smoothstep(3000.0, 10000.0, t), dens = cloudBase(p, lod);
      if (dens > 0.0 && fine == 0) { fine = 6; t -= dt; dt = max(11.0, t * 0.012); t += dt; continue; }  // a long step found cloud: go back and walk in
      if (dens > 0.0 && t < 7000.0) {                                      // near clouds are eroded by fine noise, towers more than the deck
        float up = smoothstep(CLOUD_Y + 200.0, CLOUD_Y + 420.0, p.y), e = mix(0.42, 0.5, up) * (1.0 - smoothstep(4500.0, 7000.0, t));
        vec3 q = p + uTime * vec3(11.0, 0.0, 4.0);
        float er = texture(uNoise3, q / 310.0).g * 0.7 + texture(uNoise3, q / 97.0 + 0.5).g * 0.3 * (1.0 - smoothstep(600.0, 2500.0, t));
        dens = clamp((dens - er * e) / (1.0 - e), 0.0, 1.0);
      }
      if (dens > 0.002) {
        float h = clamp((p.y - CLOUD_Y) / 310.0, 0.0, 1.0);
        float od = cloudBase(p + MOON_DIR * 30.0, lod) * 45.0 + cloudBase(p + MOON_DIR * 90.0, lod) * 85.0 + cloudBase(p + MOON_DIR * 210.0, lod) * 160.0 + cloudBase(p + MOON_DIR * 430.0, lod) * 280.0;
        float pw = mix(1.0, 1.0 - exp(-dens * 4.0), 0.5 * (1.0 - max(mu, 0.0)));                  // thin edges are darker, except against the moon: this draws the folds
        vec3 S = C_MOON * 0.27 * phase * pw * max(exp(-od * SIGMA), 0.6 * exp(-od * SIGMA * 0.16)) // moonlight, with a little light that scatters deep
               + C_MOON * 0.020 * (0.3 + 0.7 * h)                                                // the sky above
               + C_GLOW * 0.042 * (1.0 - h) * (1.0 - h);                                         // the city below
        vec3 fp = p - uFlashPos; float fd = dot(fp, fp);
        S += C_FLASH * uFlash * (1.7 * exp(-fd / 2.5e5) + 0.22 * exp(-fd / 6.0e6));              // lightning lights the cloud from inside
        S = mix(skyGrad(rd.y), S, exp(-t * uFogDen));                                            // far cloud takes the colour of the air
        float a = 1.0 - exp(-dens * SIGMA * min(dt, t1 - t + dt * 0.5));
        col += T * a * S; T *= 1.0 - a;
        fine = 6;
      } else if (fine > 0) fine--;
      dt = fine > 0 ? max(11.0, t * 0.012) : max(24.0, t * 0.03); t += dt;
    }
  }
  gl_FragColor = vec4(col, T);
}` });
// smooth the clouds over time. The march is noisy, so each frame is blended into the one before it, found again in the last frame's picture
const matCloudAcc = postMat(/* glsl */`
uniform sampler2D tCur, tPrev; uniform mat4 uInvProj, uCamWorld, uPrevVP; uniform vec3 uCamPos; uniform float uKeep;
void main(){
  vec4 cur = texture2D(tCur, vUv);
  vec4 f4 = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize(mat3(uCamWorld) * (f4.xyz / f4.w));
  vec4 pc = uPrevVP * vec4(uCamPos + rd * 2500.0, 1.0);                      // where this direction was in the last frame (clouds are far: about 2.5 km)
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  float ok = pc.w > 0.0 && puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0 ? uKeep : 0.0;
  gl_FragColor = mix(cur, texture2D(tPrev, puv), ok);
}`, { tCur: { value: null }, tPrev: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() },
  uCamPos: { value: new THREE.Vector3() }, uKeep: { value: 0 } });
// lay the clouds over the scene. Each pixel takes the cloud samples whose depth is like its own, so clouds do not bleed over roof edges
const matCloudMix = postMat(/* glsl */`
uniform sampler2D tScene, tCloud, tDepth; uniform vec2 uCloudRes;
float lin(float z){ return 1.0 / (1.000001 - z); }
void main(){
  vec2 px = vUv * uCloudRes - 0.5, b = floor(px), fr = px - b;
  float dc = lin(texture2D(tDepth, vUv).r), ws = 0.0; vec4 acc = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i & 1), float(i >> 1)), uv = (b + o + 0.5) / uCloudRes;
    float ds = lin(texture2D(tDepth, uv).r);
    float w = ((o.x > 0.5 ? fr.x : 1.0 - fr.x) * (o.y > 0.5 ? fr.y : 1.0 - fr.y) + 0.002) / (0.02 + abs(dc - ds) / max(dc, ds));
    acc += texture2D(tCloud, uv) * w; ws += w;
  }
  acc /= ws;
  gl_FragColor = vec4(texture2D(tScene, vUv).rgb * acc.a + acc.rgb, 1.0);
}`, { tScene: { value: null }, tCloud: { value: null }, tDepth: U.tDepth, uCloudRes: { value: new THREE.Vector2() } });

const matRingW = postMat('uniform sampler2D tSrc; void main(){ gl_FragColor = vec4(sqrt(clamp(texture2D(tSrc, vUv).rgb, 0.0, 1.0)), 1.0); }', { tSrc: { value: null } });

// final: tearing, chromatic aberration, scanlines, vignette, grain, encode
export const matFinal = postMat(/* glsl */`
uniform sampler2D tSrc;
uniform float uTime, uCA, uScan, uTear, uFade, uSq;
void main(){
  vec2 uv = vUv;
  if (uTear > 0.0) {
    float band = floor(uv.y * mix(12.0, 50.0, h21(vec2(floor(uTime * 14.0), 2.0))));
    float n = h21(vec2(band, floor(uTime * 24.0)));
    uv.x += (n - 0.5) * 0.14 * uTear * step(0.62, h21(vec2(band + 5.0, floor(uTime * 24.0))));
  }
  vec2 c = uv - 0.5; float r2 = dot(c, c);
  vec2 off = c * (0.0006 + uCA) * (0.3 + r2 * 3.2);
  vec3 col = vec3(texture2D(tSrc, uv + off).r, texture2D(tSrc, uv).g, texture2D(tSrc, uv - off).b);
  col = mix(col, col * col, uSq);                                          // replayed frames are stored as sqrt
  col *= 1.0 - (0.05 + 0.4 * uScan) * (0.5 + 0.5 * sin(gl_FragCoord.y * 2.0944));
  col += vec3(0.05, 0.35, 0.12) * uScan * (1.0 - smoothstep(0.0, 0.04, abs(fract(uv.y * 1.3 - uTime * 0.9) - 0.5)));
  col *= 1.0 + uScan * (h21(vec2(floor(uTime * 60.0), 7.0)) - 0.5) * 0.5;
  col *= (1.0 - smoothstep(0.22, 0.92, sqrt(r2))) * 0.66 + 0.34;                   // vignette
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float g = h21(floor(gl_FragCoord.xy / 1.5) + fract(uTime) * 91.7) - 0.5;
  col += g * 0.04 * (1.2 - col.g);                                        // film grain, stronger in the shadows
  gl_FragColor = vec4(col * uFade, 1.0);
}`, { tSrc: { value: null }, uTime: { value: 0 }, uCA: { value: 0 }, uScan: { value: 0 }, uTear: { value: 0 }, uFade: { value: 0 }, uSq: { value: 0 } });

export const BLOOM_LEVELS = 5, RING = 12;
let rtScene = null, rtCloud = null, rtCloudAcc = [], cloudIdx = 0, rtMain = null, rtRefl = null, rtAcc = [], rtBloom = [], rtRing = [], accIdx = 0, RW = 2, RH = 2;
function buildTargets(w, h) {
  for (const t of [rtScene, rtCloud, ...rtCloudAcc, rtMain, rtRefl, ...rtAcc, ...rtBloom, ...rtRing]) if (t) t.dispose();
  const o = { type: HDR, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
  const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
  rtScene = new THREE.WebGLRenderTarget(w, h, Object.assign({}, o, { depthBuffer: true, samples: IS_TOUCH ? 0 : 4, depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) }));
  rtCloud = new THREE.WebGLRenderTarget(hw, hh, o); rtMain = new THREE.WebGLRenderTarget(w, h, o);
  rtCloudAcc = [new THREE.WebGLRenderTarget(hw, hh, o), new THREE.WebGLRenderTarget(hw, hh, o)]; matCloudAcc.uniforms.uKeep.value = 0;
  U.tDepth.value = rtScene.depthTexture; matCloudMix.uniforms.uCloudRes.value.set(hw, hh);
  rtRefl = new THREE.WebGLRenderTarget(hw, hh, Object.assign({}, o, { depthBuffer: true }));
  rtAcc = [new THREE.WebGLRenderTarget(w, h, o), new THREE.WebGLRenderTarget(w, h, o)];
  rtBloom = [];
  for (let i = 0, bw = hw, bh = hh; i < BLOOM_LEVELS; i++, bw >>= 1, bh >>= 1) rtBloom.push(new THREE.WebGLRenderTarget(Math.max(2, bw), Math.max(2, bh), o));
  rtRing = [];
  for (let i = 0; i < RING; i++) rtRing.push(new THREE.WebGLRenderTarget(hw, hh, Object.assign({}, o, { type: THREE.UnsignedByteType })));
  RW = w; RH = h;
  U.uRes.value.set(w, h); U.uRefl.value = rtRefl.texture;
  matComp.uniforms.uRes.value.set(w, h); matComp.uniforms.uAspect.value = w / h;
  for (const t of rtAcc) { renderer.setRenderTarget(t); renderer.clear(); }
}
const PIXELS = (+new URLSearchParams(location.search).get('pixels') || (IS_TOUCH ? 1.0 : 2.3)) * 1e6;   // the most pixels the page renders. ?pixels=8.3 lets a recording render 3840×2160 in full
export function resize() {
  const cw = Math.max(1, innerWidth), ch = Math.max(1, innerHeight), dpr = Math.min(devicePixelRatio || 1, 2);
  const cap = Math.min(1, Math.sqrt(PIXELS / (cw * dpr * ch * dpr)));   // pixel budget
  const w = Math.max(64, Math.round(cw * dpr * cap * view.quality)), h = Math.max(64, Math.round(ch * dpr * cap * view.quality));
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  buildTargets(w, h);
}

const prevCamPos = new THREE.Vector3(); let replayJustEnded = false;
export const replay = { left: 0, i: 0, w: 0, n: 0 };     // deja vu: stored frames play again while the world holds still
const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1);
export function renderScene() {
  const px = camera.position.x, pz = camera.position.z;
  if (replay.left > 0) {
    matFinal.uniforms.tSrc.value = rtRing[(replay.w + replay.i) % RING].texture; matFinal.uniforms.uSq.value = 1;
    replay.i = (replay.i + 1) % Math.max(1, replay.n); replay.left--; replayJustEnded = true;
    runPass(matFinal, null); return;
  }
  // 1. mirrored pass for the wet ground
  const doRefl = camera.position.y < CLOUD_Y - 40;
  matGround.uniforms.uReflOn.value = doRefl ? 1 : 0;
  if (doRefl) {
    U.uMirror.value = -1;
    ground.visible = rain.visible = steam.visible = farMesh.visible = stars.visible = false;
    chunkLOD(px, pz, true);
    reflCam.projectionMatrix.copy(camera.projectionMatrix); reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflCam.matrixWorld.multiplyMatrices(MIRROR, camera.matrixWorld); reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
    renderer.setRenderTarget(rtRefl); renderer.clear(); renderer.render(scene, reflCam);
    U.uMirror.value = 1;
  }
  // 2. main pass: the sky and everything solid
  ground.visible = steam.visible = stars.visible = true; rain.visible = S.rain && U.uRainK.value > 0.01;
  farMesh.visible = U.uFogFar.value > 1300 && farGeo.instanceCount > 0;
  chunkLOD(px, pz, false);
  camera.layers.set(0);
  renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
  // 3. clouds, marched against the scene depth and laid over the scene; then everything that glows goes on top
  const cl = matCloud.uniforms;
  cl.uInvProj.value.copy(camera.projectionMatrixInverse); cl.uCamWorld.value.copy(camera.matrixWorld); cl.uCamPos.value.copy(camera.position); cl.uJit.value = (cl.uJit.value + 1) % 64;
  runPass(matCloud, rtCloud);
  const ca = matCloudAcc.uniforms, accNow = rtCloudAcc[cloudIdx], accOld = rtCloudAcc[1 - cloudIdx]; cloudIdx = 1 - cloudIdx;
  ca.tCur.value = rtCloud.texture; ca.tPrev.value = accOld.texture;
  ca.uInvProj.value.copy(camera.projectionMatrixInverse); ca.uCamWorld.value.copy(camera.matrixWorld); ca.uCamPos.value.copy(camera.position);
  if (camera.position.distanceToSquared(prevCamPos) > 250000 || replayJustEnded) ca.uKeep.value = 0;   // a cut: start again
  runPass(matCloudAcc, accNow);
  ca.uKeep.value = lerp(0.86, 0.6, clamp(P.speed / 500, 0, 1));              // at speed the history is short, so nothing smears
  ca.uPrevVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); prevCamPos.copy(camera.position); replayJustEnded = false;
  matCloudMix.uniforms.tScene.value = rtScene.texture; matCloudMix.uniforms.tCloud.value = accNow.texture;
  runPass(matCloudMix, rtMain);
  camera.layers.set(1);
  renderer.setRenderTarget(rtMain); renderer.render(scene, camera);
  // 4. bloom pyramid
  let src = rtMain;
  for (let i = 0; i < BLOOM_LEVELS; i++) {
    matDown.uniforms.tSrc.value = src.texture; matDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height); matDown.uniforms.uPre.value = i === 0 ? 1 : 0;
    runPass(matDown, rtBloom[i]); src = rtBloom[i];
  }
  for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
    matUp.uniforms.tSrc.value = rtBloom[i].texture; matUp.uniforms.uTexel.value.set(1 / rtBloom[i].width, 1 / rtBloom[i].height);
    runPass(matUp, rtBloom[i - 1]);
  }
  // 5. composite into the accumulation buffer, 6. remember the frame, 7. present
  const cur = rtAcc[accIdx], prev = rtAcc[1 - accIdx]; accIdx = 1 - accIdx;
  const cu = matComp.uniforms;
  cu.tScene.value = rtMain.texture; cu.tBloom.value = rtBloom[0].texture; cu.tPrev.value = prev.texture;
  runPass(matComp, cur);
  matRingW.uniforms.tSrc.value = cur.texture;
  runPass(matRingW, rtRing[replay.w]); replay.w = (replay.w + 1) % RING; replay.n = Math.min(RING, replay.n + 1);
  matFinal.uniforms.tSrc.value = cur.texture; matFinal.uniforms.uSq.value = 0;
  runPass(matFinal, null);
}
