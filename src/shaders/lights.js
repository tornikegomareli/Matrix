// Shader of the light sprites: lamps, beacons, traffic signals
export const LIGHT_VS = /* glsl */`
attribute vec3 iPos; attribute vec4 iL; attribute vec3 iB;        // iL = type, size, phase, axis   iB = building centre + wave flag
varying vec2 vUv; varying vec3 vCol;
void main(){
  vec3 c; float it; vec3 lp = iPos;
  if (built(iB.x > 1e6 ? iPos.xz : iB.xy) < 220.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (uWave.w > 0.5 && iB.z != 0.0) {
    float dF = dot(iB.xy, uWave.xy) - uWave.z;
    if (dF * iB.z > 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    lp.y *= smoothstep(0.0, 46.0, abs(dF));
  }
  if (iL.x < 0.5) { c = C_LAMP; it = 1.9; }                                                            // sodium lamp
  else if (iL.x < 1.5) { c = vec3(0.90, 0.95, 1.0); it = 0.2 + 7.0 * step(0.84, fract(uTime * 0.55 + iL.z)); }  // strobe
  else if (iL.x < 2.5) { float b = 0.5 + 0.5 * sin(uTime * 1.6 + iL.z * 6.2832); c = vec3(1.0, 0.16, 0.1); it = 5.0 * b * b; } // red beacon
  else {                                                                                               // signal, same cycle as the traffic sim
    float ph = fract(iL.z + uTime / 18.0);
    float go = iL.w < 0.5 ? step(ph, 0.45) : step(0.5, ph) * step(ph, 0.95);
    c = mix(vec3(1.0, 0.12, 0.08), vec3(0.10, 1.0, 0.55), go); it = mix(2.0, 3.0, go);
  }
  it *= lightsOn(lp.xz, fract(iL.z * 3.7));
  float th; lp = foldP(lp, iB.x > 1e6 ? iPos.z : iB.y, th);
  vec4 mv = viewMatrix * vec4(lp, 1.0);
  float d = length(mv.xyz);
  mv.xy += position.xy * max(iL.y, d * 0.0024);
  gl_Position = projectionMatrix * mv;
  float od = uFogDen * d + uFogH * exp(-abs(cameraPosition.y) * 0.018) * d * 0.45;
  vCol = c * it * exp(-od * 0.75) * (1.0 - smoothstep(uFogFar * 0.6, uFogFar * 0.95, d)) * cloudVis(lp);
  if (iL.x < 0.5) vCol *= 1.0 - smoothstep(800.0, 1400.0, d);    // far street lamps hand over to the glow the ground draws
  vUv = position.xy;
}`;
export const LIGHT_FS = /* glsl */`
varying vec2 vUv; varying vec3 vCol;
void main(){
  float r = length(vUv);
  if (hidden()) discard;
  float a = exp(-r * r * 60.0) + 0.07 * exp(-r * 4.5) * (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vCol * a, 1.0);
}`;
