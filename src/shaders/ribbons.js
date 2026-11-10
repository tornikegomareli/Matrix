// Shader of the ribbons: searchlights, spire beams, lightning bolts, light streaks of the trains
export const RIB_VS = /* glsl */`
attribute vec3 iA; attribute vec3 iB; attribute vec4 iW;       // ends, then: width at a, width at b, intensity, type (0 beam, 1 bolt, 2 streak)
varying vec2 vUv; varying float vI; varying float vType;
void main(){
  float th; vec3 wa = foldP(iA, iA.z, th), wb = foldP(iB, iW.w < 0.5 ? iA.z : iB.z, th);                // a beam folds with its foot
  vec3 a = (viewMatrix * vec4(wa, 1.0)).xyz, b = (viewMatrix * vec4(wb, 1.0)).xyz, mid = mix(a, b, position.y);
  vec3 side = cross(b - a, mid); side /= max(length(side), 1e-5);
  float d = length(mid), w0 = mix(iW.x, iW.y, position.y), w = max(w0, d * 0.0013 * step(0.5, iW.w));
  gl_Position = projectionMatrix * vec4(mid + side * position.x * w, 1.0);
  vUv = vec2(position.x * 2.0, position.y); vType = iW.w;
  vec3 wp = mix(wa, wb, position.y);
  float att = exp(-uFogDen * d * 0.6) * (1.0 - smoothstep(uFogFar * 0.7, uFogFar * 1.25, d)) * cloudVis(wp);
  vI = iW.z * att * w0 / w;
}`;
export const RIB_FS = /* glsl */`
varying vec2 vUv; varying float vI; varying float vType;
void main(){
  if (hidden()) discard;
  float e = clamp(1.0 - vUv.x * vUv.x, 0.0, 1.0), a; vec3 c = vec3(0.72, 0.84, 1.0);
  if (vType < 0.5) a = e * e * (1.0 - 0.8 * vUv.y) * smoothstep(0.0, 0.03, vUv.y) * (0.75 + 0.25 * vn(vec2(vUv.y * 30.0 - uTime * 2.0, vUv.x * 2.0)));
  else if (vType < 1.5) { a = e * e * e * 3.0 + e * 0.5; c = vec3(0.80, 0.85, 1.0); }
  else { a = e * pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.7); c = vec3(1.0, 0.84, 0.58); }
  gl_FragColor = vec4(c * a * vI, 1.0);
}`;
