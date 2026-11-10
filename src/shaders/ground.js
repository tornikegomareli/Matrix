// Shader of the wet ground: roads, puddles, ripples, planar reflection
import { FOLD_F, FOLD_V } from './common.js';

export const GROUND_VS = FOLD_V + /* glsl */`
uniform vec2 uCenter;
varying vec3 vWP;
void main(){
  vWP = vec3(position.x * 60000.0 + uCenter.x, 0.0, position.y * 60000.0 + uCenter.y);
  float th; vec3 fp = foldP(vWP, vWP.z, th); vFold = vec4(fp, th);
  gl_Position = projectionMatrix * viewMatrix * vec4(fp, 1.0);
}`;
export const GROUND_FS = FOLD_F + /* glsl */`
uniform sampler2D uRefl; uniform float uReflOn, uRainOn, uTraffic;
varying vec3 vWP;
const float CELL = 100.0;
// one expanding ring per grid cell
vec2 rip(vec2 p, float t, float sc, float off){
  p = p * sc + off; vec2 id = floor(p), f = fract(p) - 0.5;
  vec2 rnd = h22(id + off);
  float tt = t * (0.7 + rnd.x * 0.7) + rnd.y, ph = fract(tt);
  vec2 cc = (h22(id + floor(tt) * 0.37 + 3.1) - 0.5) * 0.4;
  vec2 dv = f - cc; float d = length(dv), r = ph * 0.42;
  return dv / max(d, 1e-3) * sin((d - r) * 42.0) * (1.0 - smoothstep(0.0, 0.07, abs(d - r))) * (1.0 - ph);
}
// paint for one road. a = distance from its centreline, s = along it, o = distance from the crossing road's centreline
float marks(float a, float s, float o){
  if (o < 12.5 || a > 7.9) return 0.0;
  float m = step(abs(a - 0.22), 0.07) + step(abs(a - 4.0), 0.07) * step(fract(s / 9.0), 0.42);
  m += step(abs(o - 14.6), 1.5) * step(fract(a / 1.3), 0.5);     // zebra crossing
  m += step(abs(o - 17.3), 0.22);                                // stop line
  return min(m, 1.0);
}
float lampPool(vec2 lat_along, float side, float first){
  float zl = first + 50.0 * floor((lat_along.y - first) / 50.0 + 0.5);
  vec2 d = vec2(lat_along.x - side * 6.5, lat_along.y - zl);
  float k = 1.0 + dot(d, d) * 0.016;
  return 1.0 / (k * k);
}
void main(){
  vec2 p = vWP.xz;
  vec3 toCam = cameraPosition - vFold.xyz; float dist = length(toCam); vec3 V = unfold(toCam / dist);
  vec2 q = mod(p + CELL * 0.5, CELL) - CELL * 0.5;
  float ax = abs(q.x), az = abs(q.y), dRoad = min(ax, az);
  float asph = step(dRoad, 8.0), walk = step(dRoad, 12.0) * (1.0 - asph);
  float fwp = max(fwidth(p.x), fwidth(p.y)), lodG = smoothstep(5.0, 22.0, fwp);     // far away the street pattern becomes its average
  float n1 = vn(p * 2.3), n2 = vn(p * 0.21 + 11.0);
  vec3 col = vec3(0.017) * (0.6 + 0.7 * n1) * (0.7 + 0.5 * n2);
  vec3 extra = vec3(0.0);
  if (asph > 0.5) {
    float m = max(marks(ax, p.y, az) * step(ax, 8.0), marks(az, p.x, ax) * step(az, 8.0));
    col += vec3(0.19, 0.18, 0.15) * m * (0.35 + 0.65 * n1) * (1.0 - smoothstep(50.0, 260.0, dist));
    float farT = smoothstep(380.0, 650.0, dist) * (1.0 - lodG) * uTraffic;
    if (farT > 0.0) {                                             // traffic seen from far above: dashes of light in every lane
      bool alongZ = ax < az;
      float a = alongZ ? q.x : q.y, sAl = alongZ ? p.y : p.x, lineId = floor((alongZ ? p.x : p.y) / CELL + 0.5);
      float lane = floor(abs(a) / 4.0), dirn = a < 0.0 ? -1.0 : 1.0;
      float c = sAl / 30.0 - dirn * uTime * (10.0 + 4.0 * lane) / 30.0 + h11(lineId * 3.7 + lane) * 9.0;
      float on = step(0.66, h21(vec2(floor(c), lineId * 7.0 + lane + dirn * 3.0)));
      float dsh = on * (1.0 - smoothstep(0.08, 0.2, abs(fract(c) - 0.5))) * (1.0 - smoothstep(0.6, 1.6, abs(abs(a) - (2.0 + lane * 4.0))));
      extra += (dirn * (alongZ ? V.z : V.x) > 0.0 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.10, 0.05) * 0.6) * dsh * farT * 0.5;   // headlights come, tail lights go
    }
  } else if (walk > 0.5) {
    vec2 sl = abs(fract(p / 2.0) - 0.5);
    col = vec3(0.04) * (0.7 + 0.4 * n1) * (0.8 + 0.2 * smoothstep(0.0, 0.04, min(sl.x, sl.y)));
    col += vec3(0.03) * (1.0 - smoothstep(8.0, 8.5, dRoad));            // kerb
  } else {
    col = vec3(0.022) * (0.7 + 0.5 * n1);
  }
  // street lamps (two per side per block, staggered)
  float pool = 0.0;
  if (ax < 20.0) pool += lampPool(vec2(q.x, p.y), 1.0, 12.5) + lampPool(vec2(q.x, p.y), -1.0, 37.5);
  if (az < 20.0) pool += lampPool(vec2(q.y, p.x), 1.0, 12.5) + lampPool(vec2(q.y, p.x), -1.0, 37.5);
  float bl = smoothstep(0.0, 200.0, built(p));                  // 0 where the world is not built yet
  pool = mix(pool, 0.06, lodG) * bl * lightsOn(p, 0.5);
  vec3 lamp = C_LAMP;
  vec3 light = uFogCol * 3.2 + C_GLOW * 0.03 + lamp * pool * 0.62 + C_FLASH * uFlash * (0.2 + 0.8 * uFlashDir.y) + localLight(vWP, vec3(0.0, 1.0, 0.0));

  // water: puddle mask, ripples, roughness
  float pud = smoothstep(0.44, 0.6, vn(p * 0.085 + 3.0) * 0.65 + vn(p * 0.33 + 9.0) * 0.35);
  float gloss = mix(mix(0.3, 0.5, asph), 1.0, pud);
  vec2 nrm = (vec2(vn(p * 1.9 + 7.0), vn(p * 1.9 + 91.0)) - 0.5) * (1.0 - gloss) * 0.5;
  float near = 1.0 - smoothstep(30.0, 120.0, dist);
  if (near > 0.0 && uRainOn > 0.5) nrm += (rip(p, uTime, 1.3, 0.0) + rip(p, uTime * 1.13, 0.9, 31.7)) * near * (0.2 + 0.4 * pud);
  float NdV = clamp(V.y, 0.0, 1.0);
  float F = mix(0.16, 1.0, pow(1.0 - NdV, 3.0)) * gloss;
  vec3 refl = vec3(0.0);
  if (uReflOn > 0.5 && vFold.w < 0.3) {                          // the mirror picture is right only for flat ground
    vec2 suv = gl_FragCoord.xy / uRes + nrm * 0.11 / (1.0 + dist * 0.035);
    float stretch = mix(0.16, 0.012, gloss * gloss);             // rough asphalt smears lights toward the viewer
    float j = h21(gl_FragCoord.xy + fract(uRTime) * 61.0), ws = 0.0;
    for (int i = 0; i < 7; i++) {
      float t = (float(i) + j) / 7.0, w = 1.0 - t * 0.8;
      refl += texture2D(uRefl, clamp(suv + vec2(0.0, (t - 0.12) * stretch), 0.002, 0.998)).rgb * w; ws += w;
    }
    refl /= ws;
    refl = mix(refl, envCol(reflect(-V, vec3(0.0, 1.0, 0.0))), smoothstep(0.0, 0.3, vFold.w));
  } else {
    refl = envCol(reflect(-V, vec3(0.0, 1.0, 0.0)));
  }
  vec3 outc = col * light * (1.0 - 0.5 * pud) + refl * F;
  outc += lamp * pool * 0.25 * gloss * dot(nrm, nrm) * 10.0;     // ripple glints under the lamps
  outc += extra * bl + lamp * (exp(-dRoad * 0.1) * (1.0 - lodG) + 0.3 * lodG) * mix(0.06, 0.32, smoothstep(700.0, 1900.0, dist)) * smoothstep(250.0, 1100.0, dist) * bl * lightsOn(p, 0.5);   // from far above the wet streets read as ribbons of light
  if (bl < 1.0) {                                                // the world is being built: bare ground carries a measuring grid, and the front is a line of light
    vec2 g10 = abs(fract(p / 10.0) - 0.5);
    float l10 = (1.0 - smoothstep(0.0, 0.07 + fwp * 1.2, (0.5 - max(g10.x, g10.y)) * 10.0)) * (1.0 - smoothstep(1.5, 6.0, fwp));
    outc = mix(C_CODE * (l10 * 0.45 + 0.008), outc, bl) + C_CODE * exp(-abs(built(p)) * 0.15) * 1.6;
  }
  if (uWave.w > 0.5) {                                           // the recompile front runs over the ground as a line of light
    float dF = dot(p, uWave.xy) - uWave.z;
    outc += vec3(0.35, 1.0, 0.55) * (exp(-abs(dF) * 0.22) * 2.2 + (dF < 0.0 ? exp(dF / 80.0) * 0.25 * step(0.5, fract(p.x * 0.5) + fract(p.y * 0.5)) : 0.0));
  }
  gl_FragColor = vec4(applyFog(outc, vFold.xyz), 1.0);
}`;
