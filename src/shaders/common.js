// GLSL that every scene shader shares
export const GL_COMMON = /* glsl */`
precision highp sampler3D;
uniform float uTime, uRTime, uMirror, uFogDen, uFogH, uFogFar, uCloud, uFlash, uCode, uBoost, uSlow, uAbove, uRainK;
uniform vec3 uFogCol, uFlashDir, uCamVel, uFlashPos;
uniform vec2 uRes, uNF;
uniform vec4 uWave;                                 // recompile front: direction x, z, position along it, active
uniform vec4 uBuild;                                // the world being built: centre x, z, radius of the built part, active
uniform vec4 uDark;                                 // the blackout wave: direction x, z, the place of its front along it, the width of the dark band (0 = no wave)
uniform vec4 uFold;                                 // the city fold: hinge z, radius, angle now (0 to PI), on
uniform vec4 uPL[6], uPLc[6]; uniform int uPLn;     // local lights: place + reach, colour + zone (0 outdoors, 1 indoors, 2 both)
uniform vec3 uInA, uInB;                            // the box that counts as indoors: no rain falls in it, and lights of one zone do not reach the other
uniform vec3 uHoleA[2], uHoleB[2];                  // boxes where the walls of buildings are cut away: a doorway, a hatch
uniform sampler2D uGlyph, uCover, tDepth;
uniform sampler3D uNoise3;
const float CLOUD_Y = 620.0, CLOUD_TOP = 1750.0;    // the clouds: the base, and the top of the highest tower
const vec3 MOON_DIR = vec3(0.4082, 0.4082, -0.8165);
const vec3 C_LAMP = vec3(1.0, 0.55, 0.20);          // sodium street light
const vec3 C_MOON = vec3(0.62, 0.74, 1.0);          // moonlight
const vec3 C_FLASH = vec3(0.70, 0.80, 1.0);         // lightning
const vec3 C_GLOW = vec3(1.0, 0.60, 0.34);          // the city's light on the cloud base
const vec3 C_CODE = vec3(0.16, 1.0, 0.36), C_CODE_HI = vec3(0.75, 1.0, 0.85);   // the code stays green
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }

// clear night air: haze at the horizon, dark at the zenith
vec3 nightSky(float y){ return mix(vec3(0.013, 0.021, 0.040), vec3(0.0014, 0.0026, 0.0068), smoothstep(-0.05, 0.5, y)); }
// colour of the air in a direction: what distant things fade into. The horizon equals the fog colour, so the far fade has no seam.
vec3 skyGrad(float y){
  vec3 g = mix(uFogCol, uFogCol * 0.45 + C_GLOW * 0.011, smoothstep(0.0, 0.6, y));   // under the clouds: haze, then the lit cloud base
  g = mix(g, nightSky(y), uAbove);
  return g * (1.0 + uFlash * 1.3 * (1.0 - uAbove));
}
// while the world is built outward from a point: how far the front has passed p, in metres. A large number when nothing is being built
float built(vec2 p){ return uBuild.w > 0.5 ? uBuild.z - distance(p, uBuild.xy) : 1e6; }
// the share of its light that the blackout wave leaves a lamp at p. j (0..1) shifts single lamps against each other, so they go one by one
float lightsOn(vec2 p, float j){
  if (uDark.w <= 0.0) return 1.0;
  float d = uDark.z - dot(p, uDark.xy) + (j - 0.5) * 90.0;                    // > 0: the front has passed this place
  if (d < -40.0 || d > uDark.w + 70.0) return 1.0;
  float fl = step(0.45, fract(uRTime * 21.0 + j * 13.0));                     // a tube that stutters
  if (d < 0.0) return mix(1.0, fl, (d + 40.0) / 40.0 * 0.85);                 // it stutters before it goes out,
  if (d > uDark.w) return mix(fl * 0.7, 1.0, (d - uDark.w) / 70.0);           // and again when it comes back
  return 0.0;
}
// the city fold. Beyond the line z = uFold.x the world bends up and over: a pipe of radius uFold.y, then straight on along its tangent.
// p is the point. sa is the z that decides the angle: p.z itself, or the middle of a thing that must stay rigid. th returns the angle there
vec3 foldP(vec3 p, float sa, out float th){
  th = 0.0;
  float d = sa - uFold.x;
  if (uFold.w < 0.5 || d <= 0.0) return p;
  float R = uFold.y; th = min(d / R, uFold.z);
  float run = d - th * R + (p.z - sa), sn = sin(th), cs = cos(th);            // run: the way along the ground from the point of the curve at th
  return vec3(p.x, R - R * cs + sn * run + cs * p.y, uFold.x + R * sn + cs * run - sn * p.y);
}
bool indoors(vec3 p){ return all(greaterThan(p, uInA)) && all(lessThan(p, uInB)); }
// the light of the local lamps on a surface at p with the normal n
vec3 localLight(vec3 p, vec3 n){
  vec3 sum = vec3(0.0); float ins = uPLn > 0 && indoors(p) ? 1.0 : 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uPLn) break;
    if (uPLc[i].w < 1.5 && abs(uPLc[i].w - ins) > 0.5) continue;
    vec3 d = uPL[i].xyz - p; float r = length(d), a = max(1.0 - r / uPL[i].w, 0.0);
    sum += uPLc[i].rgb * a * a * max(dot(n, d / max(r, 1e-3)) * 0.8 + 0.2, 0.0);
  }
  return sum;
}
// the cloud layer, 0..1 without the fine erosion. The ray march, the lights and the script all read this one field.
float cloudBase(vec3 p, float lod){
  float y = p.y - CLOUD_Y;
  if (y <= 0.0 || p.y >= CLOUD_TOP) return 0.0;
  vec2 w = p.xz + uTime * vec2(9.0, 3.5);                                    // wind
  vec2 cv = texture2D(uCover, w / 16000.0).rg;                               // r = how much cloud, g = how thick the deck is
  float cov = smoothstep(0.22, 0.70, cv.r), deck = mix(150.0, 310.0, cv.g);
  float tw = smoothstep(0.55, 0.80, texture2D(uCover, w / 5300.0 + 0.37).g) * cov;   // cloud type: 0 = flat deck, 1 = a storm tower (the same map, read smaller)
  float top = deck + 950.0 * tw;                                             // the top of the cloud here, in metres above the base
  float prof = smoothstep(0.0, 18.0, y) * (1.0 - smoothstep(top * mix(0.35, 0.5, tw), top, y));   // density over height
  float inT = tw * smoothstep(deck * 0.7, deck * 1.5, y);                    // how much this point is tower, not deck
  float need = mix((1.0 - cov) * 0.9 + 0.08, 0.5, inT);                      // what the noise must pass: little in the closed deck, much in a tower, so the noise cuts it into heads
  if (prof <= need) return 0.0;                                              // no noise can lift this point into cloud
  float n = texture(uNoise3, vec3(w.x, p.y * 1.3, w.y) / 1500.0).r;
  return clamp((mix(n, 0.6, lod) * prof - need) * mix(3.0, 2.2, inT), 0.0, 1.0);
}
// how much of a light at p reaches the camera through the clouds (a few samples along the way)
float cloudVis(vec3 p){
  vec3 ro = cameraPosition, d = p - ro;
  if (max(ro.y, p.y) < CLOUD_Y || min(ro.y, p.y) > CLOUD_TOP) return 1.0;
  float iy = 1.0 / (abs(d.y) < 1e-3 ? 1e-3 : d.y);
  float sa = clamp((CLOUD_Y - ro.y) * iy, 0.0, 1.0), sb = clamp((CLOUD_TOP - ro.y) * iy, 0.0, 1.0);
  float s0 = min(sa, sb), s1 = max(sa, sb), od = 0.0;
  if (abs(d.y) < 1e-3) { s0 = 0.0; s1 = 1.0; }
  for (int i = 0; i < 5; i++) od += cloudBase(ro + d * mix(s0, s1, (float(i) + 0.5) / 5.0), 0.0);
  return exp(-od * 0.2 * length(d) * (s1 - s0) * 0.04);
}
#ifndef VS
// glows are drawn after the clouds, without a depth buffer, so they test the scene depth themselves
bool hidden(){
  if (uMirror < 0.0) return false;
  float zs = texture2D(tDepth, gl_FragCoord.xy / uRes).r, k = uNF.y - uNF.x;
  float ds = uNF.x * uNF.y / (uNF.y - zs * k), df = uNF.x * uNF.y / (uNF.y - gl_FragCoord.z * k);
  return df > ds * 1.003 + 0.04;
}
#endif
vec3 sceneLight(vec3 n, float y){
  float up = n.y * 0.5 + 0.5;
  return mix(uFogCol * 1.5, uFogCol * 1.9 + C_GLOW * 0.05 * (1.0 - uAbove) + C_MOON * 0.05 * uAbove, up)   // the street below, the lit clouds or the moon above
       + C_LAMP * exp(-max(y, 0.0) / 14.0) * 0.10
       + C_FLASH * uFlash * (0.2 + 0.8 * max(dot(n, uFlashDir), 0.0));
}
// what a wet or glassy surface mirrors in direction r
vec3 envCol(vec3 r){ return skyGrad(r.y) + C_MOON * 0.6 * uAbove * pow(max(dot(r, MOON_DIR), 0.0), 60.0); }
// distance fog + ground mist (exponential height fog) + hard fade before the edge of the loaded city
vec3 applyFog(vec3 col, vec3 wp){
  vec3 rd = wp - cameraPosition; float d = length(rd); rd /= max(d, 1e-4);
  const float b = 0.018;
  float k = rd.y * uMirror * b;
  float f = abs(k) < 1e-5 ? d : (1.0 - exp(-d * k)) / k;
  float od = uFogDen * d + uFogH * exp(-abs(cameraPosition.y) * b) * f;
  float fog = 1.0 - exp(-od);
  fog = max(fog, smoothstep(uFogFar * 0.6, uFogFar, length(wp.xz - cameraPosition.xz)));   // by ground distance: from high up the whole loaded city shows
  return mix(col, skyGrad(rd.y), fog);
}
// one glyph from the 8x8 atlas. cuv is 0..1 inside the cell, gradients are passed in so cell edges do not break mip selection.
float glyph(vec2 cuv, float idx, vec2 ddx, vec2 ddy){
  idx = floor(mod(idx, 64.0));
  vec2 g = vec2(mod(idx, 8.0), floor(idx / 8.0));
  return textureGrad(uGlyph, (g + clamp(cuv, 0.03, 0.97)) / 8.0, ddx / 8.0, ddy / 8.0).r;
}
// falling code on a surface. p = metres (across, down). Returns (brightness, head glyph).
vec2 codeRain(vec2 p, float seed, float density, vec2 dpx, vec2 dpy){
  const vec2 gs = vec2(1.3, 1.65);
  vec2 c = p / gs, id = floor(c), f = fract(c);
  float h1 = h21(vec2(id.x, seed * 91.7));
  if (h1 > density) return vec2(0.0);
  float h2 = h21(vec2(id.x + 3.1, seed * 37.3)), h3 = h21(vec2(id.x * 1.7 + 9.2, seed * 53.9));
  float len = mix(16.0, 48.0, h2);
  float t = uTime * mix(5.0, 17.0, h3) + h2 * 97.0;
  float d = mod(t - id.y, len);                       // rows behind the leading glyph
  float br = max(0.0, 1.0 - d / mix(8.0, 28.0, h3)); br *= br;
  float head = step(d, 1.0);
  float chg = floor(uTime * mix(1.2, 4.5, h21(id + seed)) + h21(id * 1.3 + seed) * 10.0);
  float gi = floor(h21(id + vec2(chg * 7.13, seed * 13.7)) * 64.0);
  float g = glyph(vec2(f.x, 1.0 - f.y), gi, vec2(dpx.x, -dpx.y) / gs, vec2(dpy.x, -dpy.y) / gs);
  return vec2(g * (br * 0.9 + head * 1.5), g * head);
}
`;

// The fold needs two more things in a pair of shaders: the folded position with its angle (vFold),
// and in the fragment shader the way back for a direction, so that the material keeps working in the frame before the fold.
export const FOLD_V = 'varying vec4 vFold;\n';
export const FOLD_F = FOLD_V + 'vec3 unfold(vec3 v){ float c = cos(vFold.w), s = sin(vFold.w); return vec3(v.x, v.y * c - v.z * s, v.z * c + v.y * s); }\n';
