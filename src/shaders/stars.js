// Shader of the stars: one point for each star of the real sky
export const STAR_VS = /* glsl */`
attribute vec2 aStar;                               // visual magnitude, colour index B-V (position = the direction of the star)
varying vec3 vCol; varying float vW;
void main(){
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
  float toMoon = dot(position, MOON_DIR);
  if (toMoon > 0.9982) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }    // behind the moon
  float f = pow(10.0, -0.4 * aStar.x);                                        // light, relative to a star of magnitude 0
  float air = exp(-0.11 / max(position.y + 0.02, 0.02)) / 0.9;                // thick air near the horizon dims a star
  float tw = 1.0 + 0.2 * sin(uRTime * (5.0 + 9.0 * fract(aStar.x * 7.31)) + aStar.y * 90.0) * (1.0 - smoothstep(0.08, 0.6, position.y));   // low stars twinkle
  vec3 c = aStar.y < 0.3 ? mix(vec3(0.68, 0.78, 1.0), vec3(1.0), smoothstep(-0.3, 0.3, aStar.y)) : mix(vec3(1.0), vec3(1.0, 0.72, 0.45), smoothstep(0.3, 1.7, aStar.y));
  vCol = c * 3.2 * pow(f, 0.72) * air * tw * mix(0.25, 1.0, uAbove) * (1.0 - 0.7 * smoothstep(0.90, 0.995, toMoon));   // faint under the city haze and beside the moon
  vW = (1.0 + 0.55 * min(pow(f, 0.3), 1.6)) * max(uRes.y / 1080.0, 1.0);      // width in pixels: half a pixel of blur, a little more for a bright star
  gl_PointSize = 4.0 * vW + 1.0;
}`;
export const STAR_FS = /* glsl */`
varying vec3 vCol; varying float vW;
void main(){
  vec2 q = (gl_PointCoord - 0.5) * (4.0 * vW + 1.0);                          // pixels from the centre
  gl_FragColor = vec4(vCol * exp(-2.0 * dot(q, q) / (vW * vW)), 1.0);
}`;
