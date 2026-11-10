// Shader of the steam from street vents and stacks
export const STEAM_VS = /* glsl */`
attribute vec4 aBase; attribute vec4 aRnd;        // aBase = vent xyz + scale, aRnd = phase + three randoms
varying vec2 vUv; varying float vA; varying float vR; varying float vY;
void main(){
  float rate = mix(0.16, 0.26, aRnd.y), tt = uTime * rate + aRnd.x, age = fract(tt), sc = aBase.w;
  vec3 p = aBase.xyz;
  p.y += age * mix(9.0, 16.0, aRnd.z) * sc;
  p.x += (age * age * 5.0 + sin(age * 5.0 + aRnd.w * 6.28) * 0.7) * sc;
  p.z += (age * age * 2.0 + cos(age * 4.0 + aRnd.y * 6.28) * 0.7) * sc;
  float th; p = foldP(p, aBase.z, th);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * mix(0.8, 5.5, sqrt(age)) * sc;
  gl_Position = projectionMatrix * mv;
  float d = length(mv.xyz);
  vUv = position.xy; vR = aRnd.w * 50.0 + floor(tt); vY = p.y;
  vA = smoothstep(0.0, 0.12, age) * pow(1.0 - age, 1.5) * 0.32 * smoothstep(1.0, 6.0, d) * (1.0 - smoothstep(360.0, 520.0, d));
}`;
export const STEAM_FS = /* glsl */`
varying vec2 vUv; varying float vA; varying float vR; varying float vY;
void main(){
  float r = length(vUv); if (r > 1.0 || hidden()) discard;
  float n = vn(vUv * 1.7 + vR) * 0.6 + vn(vUv * 3.9 + vR * 1.7) * 0.4;
  float a = (1.0 - r * r) * smoothstep(0.2, 0.75, n + 0.3 * (1.0 - r)) * vA;
  vec3 c = uFogCol * 4.0 + C_GLOW * 0.03 + C_LAMP * 0.16 * exp(-vY / 12.0) + C_FLASH * uFlash * 0.6;
  gl_FragColor = vec4(c * a, a);
}`;
