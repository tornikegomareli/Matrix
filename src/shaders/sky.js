// Shader of the sky: the cloud deck lit from below, and lightning
export const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}`;
export const SKY_FS = /* glsl */`
varying vec3 vDir;
uniform sampler2D uMoonTex, uGalaxy;
// the moon: a lit sphere with the real surface (NASA LRO colour map), a little larger than life
vec3 moon(vec3 d, out float disc){
  const float R = 0.058;
  vec3 mu = normalize(cross(MOON_DIR, vec3(0.0, 1.0, 0.0))), mv = cross(mu, MOON_DIR);
  float md = dot(d, MOON_DIR);
  vec2 mp = vec2(dot(d, mu), dot(d, mv)) / R; float r2 = dot(mp, mp);
  disc = 0.0;
  vec3 col = C_MOON * (0.05 * pow(max(md, 0.0), 180.0) + 0.012 * pow(max(md, 0.0), 14.0));   // glow in the air around it
  if (md > 0.0 && r2 < 1.0) {
    vec3 n = vec3(mp, sqrt(1.0 - r2));
    vec2 uv = vec2(atan(n.x, n.z), asin(clamp(n.y, -1.0, 1.0))) / 3.14159265 + 0.5;
    vec3 alb = texture2D(uMoonTex, uv).rgb;
    float ndl = dot(n, normalize(vec3(0.50, 0.24, 0.83)));                   // a waxing gibbous moon
    float lit = smoothstep(-0.03, 0.12, ndl) * mix(1.0, sqrt(max(ndl, 0.0)), 0.55);   // the lunar surface barely darkens toward the limb
    disc = smoothstep(1.0, 0.97, r2);
    col = mix(col, alb * vec3(1.0, 0.97, 0.90) * (lit * 2.6 + 0.012), disc);
  }
  return col;
}
void main(){
  vec3 d = normalize(vDir);
  float hz = (1.0 - uAbove) * exp(-max(d.y, 0.0) * 4.5) + uAbove * exp(-max(d.y + 0.03, 0.0) * 26.0) * 0.6;
  float disc; vec3 m = moon(d, disc);
  vec3 gal = texture2D(uGalaxy, vec2(atan(d.z, d.x) / 6.2831853 + 0.5, (asin(clamp(d.y, -1.0, 1.0)) * 57.29578 + 6.0) / 96.0)).rgb;   // the Milky Way: azimuth across, elevation -6..90 up
  vec3 col = nightSky(d.y) + (gal * 0.16 * (1.0 - disc) * mix(0.3, 1.0, uAbove) + m) * (1.0 - hz) * step(-0.02, d.y);
  col = mix(col, skyGrad(d.y), hz * (1.0 - uAbove));
  if (uMirror < 0.0 && d.y > 0.03) {                                          // the wet street mirrors a flat picture of the clouds
    float t = (CLOUD_Y - abs(cameraPosition.y)) / d.y;
    float cv = texture2D(uCover, (cameraPosition.xz + d.xz * t + uTime * vec2(9.0, 3.5)) / 16000.0).r;
    col = mix(col, skyGrad(0.7), smoothstep(0.35, 0.6, cv) * exp(-t * uFogDen));
  }
  gl_FragColor = vec4(col, 1.0);
}`;
