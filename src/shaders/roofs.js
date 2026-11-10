// Shader of the cylinders on the roofs: tanks, stacks, spires
import { FOLD_F, FOLD_V } from './common.js';

export const CYL_VS = FOLD_V + /* glsl */`
attribute vec3 iPos; attribute vec3 iSize; attribute vec4 iPar; attribute vec3 iBld;
uniform vec4 uGlitchA, uGlitchB;
varying vec3 vWP; varying vec3 vN; varying vec4 vPar; varying float vG; varying float vT;
void main(){
  float t = position.y, r = mix(1.0, iPar.y, t);
  vec3 wp = vec3(position.x * iSize.x * r, t * iSize.y, position.z * iSize.z * r) + iPos;
  if (built(iBld.xy) < 200.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 da = iBld.xy - uGlitchA.xy, db = iBld.xy - uGlitchB.xy;
  float g = 0.0;
  if (dot(da, da) < 1.0) g = uGlitchA.z;
  if (dot(db, db) < 1.0) g = max(g, uGlitchB.z);
  if (uWave.w > 0.5 && iBld.z != 0.0) {
    float dF = dot(iBld.xy, uWave.xy) - uWave.z;
    if (dF * iBld.z > 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    wp.y *= smoothstep(0.0, 46.0, abs(dF));
    g = max(g, (1.0 - smoothstep(10.0, 75.0, abs(dF))) * 0.8);
  }
  vWP = wp; vPar = iPar; vG = g; vT = t;
  vN = normalize(vec3(normal.x, normal.y + (1.0 - iPar.y) * iSize.x / iSize.y, normal.z));
  float th; vec3 fp = foldP(wp, iBld.x > 1e6 ? iPos.z : iBld.y, th); vFold = vec4(fp, th);
  gl_Position = projectionMatrix * viewMatrix * vec4(fp, 1.0);
}`;
export const CYL_FS = FOLD_F + /* glsl */`
varying vec3 vWP; varying vec3 vN; varying vec4 vPar; varying float vG; varying float vT;
void main(){
  bool front = gl_FrontFacing; if (uMirror < 0.0) front = !front;
  if (!front) discard;
  if (vG > 0.004 && h21(vec2(floor(vWP.y * 0.45 + uRTime * 9.0), floor(uRTime * 20.0))) < vG * 1.3) discard;
  vec3 n = normalize(vN), V = unfold(normalize(cameraPosition - vFold.xyz));
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 col = vec3(0.072, 0.074, 0.080);
  if (vPar.z < 0.5) col *= 0.65 + 0.5 * step(0.5, fract(vT * 5.0));                       // banded water tank
  else if (vPar.z < 1.5) col = vec3(0.09) * (0.6 + 0.6 * step(0.5, fract(vT * 12.0)) * step(0.78, vT)); // striped stack
  gl_FragColor = vec4(applyFog(col * (sceneLight(n, vWP.y) + localLight(vWP, n)) + skyGrad(0.3) * (0.4 + fres * 2.6), vFold.xyz), 1.0);
}`;
