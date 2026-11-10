// Shader of the rain: streaks that stretch along the relative velocity
export const RAIN_VS = /* glsl */`
attribute vec4 aSeed;
uniform vec3 uRainVel; uniform float uRainT, uRainScale;
varying vec2 vUv; varying float vA;
void main(){
  float far = step(0.5, aSeed.w);
  vec3 B = mix(vec3(44.0, 40.0, 44.0), vec3(150.0, 90.0, 150.0), far);
  float sp = mix(0.85, 1.25, fract(aSeed.w * 7.31));
  vec3 p = aSeed.xyz * B + uRainVel * sp * uRainT;
  p = mod(p - cameraPosition + B * 0.5, B) - B * 0.5 + cameraPosition;      // endless: wrap a box around the camera
  if (indoors(p)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }       // no rain indoors
  vec3 vel = uRainVel * sp * uRainScale - uCamVel * mix(0.45, 1.0, uBoost);  // what the camera sees (full stretch only under boost)
  vec3 tail = -vel * mix(0.034, 0.06, uBoost);
  float len = length(tail), minLen = mix(0.05, 0.11, uSlow);
  if (len < minLen) { tail = (len > 1e-5 ? tail / len : vec3(0.0, 1.0, 0.0)) * minLen; len = minLen; }
  vec3 a = (viewMatrix * vec4(p, 1.0)).xyz, b = (viewMatrix * vec4(p + tail, 1.0)).xyz;
  vec3 side = cross(b - a, a); side /= max(length(side), 1e-5);
  float d = -a.z;
  float w0 = mix(0.02, 0.036, far) * (1.0 + uSlow * 1.3), w = max(w0, d * 0.0016);
  gl_Position = projectionMatrix * vec4(mix(a, b, position.y) + side * position.x * w, 1.0);
  vUv = vec2(position.x * 2.0, position.y);
  float cd = length(p - cameraPosition);
  vA = smoothstep(1.2, 5.0, d) * (1.0 - smoothstep(B.x * 0.34, B.x * 0.5, cd))
     * (0.13 + 0.06 * far) * (1.0 + 3.5 / (1.0 + d * d * 0.02))            // drops near the camera catch the light
     * sqrt(w0 / w) * mix(clamp(1.5 / len, 0.14, 2.5), 2.2, uSlow) * (1.0 + uFlash * 1.5) * uRainK;
}`;
export const RAIN_FS = /* glsl */`
varying vec2 vUv; varying float vA;
void main(){
  float streak = (1.0 - vUv.x * vUv.x) * smoothstep(0.0, 0.12, vUv.y) * mix(1.0, 0.25, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
  float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
  float bead = (1.0 - smoothstep(0.5, 0.95, r)) * (0.22 + 1.6 * exp(-dot(vUv - vec2(0.3, 0.68), vUv - vec2(0.3, 0.68)) * 30.0));   // frozen droplet with a glint
  if (hidden()) discard;
  gl_FragColor = vec4(vec3(0.62, 0.72, 0.86) * mix(streak, bead, uSlow) * vA, 1.0);
}`;
