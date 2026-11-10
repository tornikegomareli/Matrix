// Shaders of the traffic: car bodies, headlights, taillights, beams on the road
import { FOLD_F, FOLD_V } from './common.js';

const CAR_COMMON = /* glsl */`
attribute vec4 iCar;            // x, z, heading index (0 +x, 1 -x, 2 +z, 3 -z; or 8 + an angle), seed
attribute float iCarS;          // brake amount, 0..1. 2: a wreck, with no light at all
vec2 carFwd(float d){ return d > 7.5 ? vec2(cos(d - 8.0), sin(d - 8.0)) : d < 0.5 ? vec2(1.0, 0.0) : d < 1.5 ? vec2(-1.0, 0.0) : d < 2.5 ? vec2(0.0, 1.0) : vec2(0.0, -1.0); }   // 8 + an angle: any heading
`;
export const CAR_VS = FOLD_V + CAR_COMMON + /* glsl */`
varying vec3 vWP; varying vec3 vN; varying float vSeed; varying float vLY;
void main(){
  if (built(iCar.xy) < 260.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 fw = carFwd(iCar.z), rt = vec2(-fw.y, fw.x);
  vec3 wp = vec3(iCar.x + fw.x * position.z + rt.x * position.x, position.y, iCar.y + fw.y * position.z + rt.y * position.x);
  vN = vec3(fw.x * normal.z + rt.x * normal.x, normal.y, fw.y * normal.z + rt.y * normal.x);
  vWP = wp; vSeed = iCar.w; vLY = position.y;
  float th; vec3 fp = foldP(wp, iCar.y, th); vFold = vec4(fp, th);
  gl_Position = projectionMatrix * viewMatrix * vec4(fp, 1.0);
}`;
export const CAR_FS = FOLD_F + /* glsl */`
varying vec3 vWP; varying vec3 vN; varying float vSeed; varying float vLY;
void main(){
  bool front = gl_FrontFacing; if (uMirror < 0.0) front = !front;
  if (!front) discard;
  vec3 n = normalize(vN), V = unfold(normalize(cameraPosition - vFold.xyz));
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 col = mix(vec3(0.012), mix(vec3(0.050, 0.052, 0.060), vec3(0.075, 0.018, 0.014), step(0.86, fract(vSeed * 7.3))), vSeed) * (vLY > 1.02 ? 0.3 : 1.0);
  vec3 c = col * (sceneLight(n, vWP.y) + localLight(vWP, n)) + envCol(reflect(-V, n)) * (0.3 + 3.0 * fres);
  gl_FragColor = vec4(applyFog(c, vFold.xyz), 1.0);
}`;
export const CARL_VS = CAR_COMMON + /* glsl */`
vec3 unfoldV(vec3 v, float th){ float c = cos(th), s = sin(th); return vec3(v.x, v.y * c - v.z * s, v.z * c + v.y * s); }
attribute float aPart;          // 0,1 headlights  2,3 taillights  4 beam on the road  5 tail glow on the road
varying vec2 vUv; varying vec3 vCol; varying float vKind;
void main(){
  if (built(iCar.xy) < 260.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 fw = carFwd(iCar.z), rt = vec2(-fw.y, fw.x);
  vec3 F = vec3(fw.x, 0.0, fw.y), R = vec3(rt.x, 0.0, rt.y), base = vec3(iCar.x, 0.0, iCar.y);
  float head = (aPart < 1.5 || (aPart > 3.5 && aPart < 4.5)) ? 1.0 : 0.0, th;
  float dc = distance(cameraPosition, foldP(base, iCar.y, th));
  float od = uFogDen * dc + uFogH * exp(-abs(cameraPosition.y) * 0.018) * dc * 0.45;
  float att = exp(-od * 0.75) * (1.0 - smoothstep(330.0, 400.0, dc));
  if (aPart < 3.5) {
    float sgn = mod(aPart, 2.0) < 0.5 ? -1.0 : 1.0;
    vec3 lp = foldP(base + F * (head > 0.5 ? 2.15 : -2.2) + R * 0.62 * sgn + vec3(0.0, 0.68, 0.0), iCar.y, th);
    vec3 tc = unfoldV(normalize(cameraPosition - lp), th);
    float vis = smoothstep(-0.15, 0.5, dot(tc.xz, fw) * (head > 0.5 ? 1.0 : -1.0));
    vec4 mv = viewMatrix * vec4(lp, 1.0);
    float size = max(head > 0.5 ? 0.7 + 1.2 * vis : 0.7, length(mv.xyz) * 0.002);
    mv.xy += position.xy * size * vec2(head > 0.5 ? 1.7 : 1.0, 1.0);
    gl_Position = projectionMatrix * mv;
    vCol = (head > 0.5 ? vec3(1.0, 0.96, 0.88) * (0.4 + 3.4 * vis) : vec3(1.0, 0.12, 0.06) * (0.5 + 1.8 * iCarS) * (0.25 + 0.75 * vis)) * att * step(iCarS, 1.5);
    vKind = 0.0;
  } else {
    float t = position.y * 0.5 + 0.5;
    vec3 wp = base + F * (head > 0.5 ? mix(1.8, 32.0, t) : mix(-2.2, -9.0, t)) + R * position.x * (head > 0.5 ? 2.2 + 2.6 * t : 1.5);
    wp.y = 0.05; wp = foldP(wp, iCar.y, th);
    gl_Position = uMirror < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
    vCol = (head > 0.5 ? vec3(1.0, 0.94, 0.82) * 0.5 : vec3(1.0, 0.12, 0.06) * 0.14 * (0.5 + 1.5 * iCarS)) * att * step(iCarS, 1.5);
    vKind = 1.0;
  }
  vUv = position.xy;
}`;
export const CARL_FS = /* glsl */`
varying vec2 vUv; varying vec3 vCol; varying float vKind;
void main(){
  if (hidden()) discard;
  float a;
  if (vKind < 0.5) { float r = length(vUv); a = exp(-r * r * 30.0) + 0.14 * exp(-r * 5.0) * (1.0 - smoothstep(0.7, 1.0, r)); }
  else { float t = vUv.y * 0.5 + 0.5; a = (1.0 - smoothstep(0.15, 1.0, abs(vUv.x))) * smoothstep(0.0, 0.08, t) * pow(clamp(1.0 - t, 0.0, 1.0), 1.6); }
  gl_FragColor = vec4(vCol * a, 1.0);
}`;
