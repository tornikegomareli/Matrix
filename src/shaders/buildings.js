// Shader of the buildings: instanced boxes
import { FOLD_F, FOLD_V } from './common.js';

export const BOX_VS = FOLD_V + /* glsl */`
attribute vec3 iPos; attribute vec3 iSize; attribute vec4 iPar; attribute vec3 iBld;   // iBld = building centre x, z + wave flag
uniform vec4 uGlitchA, uGlitchB, uNear;
varying vec3 vWP; varying vec3 vL; varying vec3 vN; varying vec3 vSize; varying vec4 vPar; varying float vG; varying float vWv; varying float vBd;
void main(){
  vec3 lp = position * iSize;
  vec3 wp = lp + iPos;
  float g = 0.0, wv = 0.0;
#ifdef FAR
  if (iPos.x > uNear.x && iPos.x < uNear.z && iPos.z > uNear.y && iPos.z < uNear.w) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
#else
  vec2 da = iBld.xy - uGlitchA.xy, db = iBld.xy - uGlitchB.xy;
  if (dot(da, da) < 1.0) g = uGlitchA.z;
  if (dot(db, db) < 1.0) g = max(g, uGlitchB.z);
#endif
  if (uWave.w > 0.5 && iBld.z != 0.0) {                                      // recompile wave: the old shape sinks, the new one rises
    float dF = dot(iBld.xy, uWave.xy) - uWave.z;                             // > 0: the front has not arrived yet
    if (dF * iBld.z > 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float a = abs(dF), sc = smoothstep(0.0, 46.0, a);
    wp.y *= sc; lp.y *= sc;
    wv = 1.0 - smoothstep(0.0, 150.0, a);
    g = max(g, (1.0 - smoothstep(10.0, 75.0, a)) * 0.8);
  }
  float bd = built(iBld.x > 1e6 ? iPos.xz : iBld.xy);                         // the world is being built: nothing stands beyond the front,
  if (bd < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }           // and behind it every building grows out of the ground
  if (bd < 1e5) { float r = smoothstep(0.0, 90.0, bd); wp.y *= r; lp.y *= r; }
  vWv = wv; vBd = bd;
  if (g > 0.0) {
    float band = floor(wp.y * 0.12 + uRTime * 14.0);
    wp.x += (h11(band + iPar.x * 31.0) - 0.5) * 3.0 * g * step(0.6, h11(band * 1.7));
    wp.z += (h11(band + 7.7) - 0.5) * 3.0 * g * step(0.7, h11(band * 2.3));
  }
  vWP = wp; vL = lp; vN = normal; vSize = iSize; vPar = iPar; vG = g;
  float th; vec3 fp = foldP(wp, iBld.x > 1e6 ? iPos.z : iBld.y, th); vFold = vec4(fp, th);   // a building folds as one rigid thing
  gl_Position = projectionMatrix * viewMatrix * vec4(fp, 1.0);
}`;

export const BOX_FS = FOLD_F + /* glsl */`
varying vec3 vWP; varying vec3 vL; varying vec3 vN; varying vec3 vSize; varying vec4 vPar; varying float vG; varying float vWv; varying float vBd;
void main(){
  bool front = gl_FrontFacing; if (uMirror < 0.0) front = !front;
  bool frame = vBd < 110.0 + 80.0 * h11(vPar.x * 3.3);            // the world is being built and this building is still a bare frame
  if (!front && vG < 0.004 && !frame) discard;
  for (int i = 0; i < 2; i++) if (all(greaterThan(vWP, uHoleA[i])) && all(lessThan(vWP, uHoleB[i]))) discard;   // a doorway or a hatch is cut here
  vec3 n = normalize(vN);
  vec3 toCam = cameraPosition - vFold.xyz; float dist = length(toCam); vec3 V = unfold(toCam / dist);
  if (frame) {                                                   // edges and floor lines only; it snaps to solid a moment later
    vec2 e2 = vSize.xz * 0.5 - abs(vL.xz);
    float ed = abs(n.y) > 0.5 ? min(e2.x, e2.y) : (abs(n.x) > 0.5 ? e2.y : e2.x);
    float wire = 1.0 - smoothstep(0.0, 0.14 + min(dist, 900.0) * 0.0024, ed);
    float fl = (1.0 - smoothstep(0.0, 0.05 + dist * 0.0014, abs(fract(vWP.y / 9.0) - 0.5) * 9.0)) * (1.0 - smoothstep(250.0, 900.0, dist)) * step(abs(n.y), 0.5);
    float a = max(wire, fl * 0.45);
    if (a < 0.05) discard;
    gl_FragColor = vec4(applyFog(C_CODE * a * 1.7, vFold.xyz), 1.0); return;
  }
  float seed = vPar.x, style = vPar.y, codeAmt = vPar.z, kind = vPar.w;
  float H = vSize.y;
  bool roof = n.y > 0.5, xface = abs(n.x) > 0.5;
  float faceW = xface ? vSize.z : vSize.x;
  float u = (xface ? vL.z : vL.x) + faceW * 0.5, v = vL.y;
  float fseed = seed + (xface ? 0.37 : 0.0) + (n.x + n.z > 0.0 ? 0.11 : 0.0);
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
  vec3 light = sceneLight(n, vWP.y) + localLight(vWP, n);
  vec3 col = vec3(0.05), emis = vec3(0.0);
  float bw = 4.0, fh = 4.0; vec2 f = vec2(0.5);

  if (kind > 3.5 && kind < 4.5) {                     // train car: dark shell, one band of lit windows, lamps at both ends
    col = vec3(0.03, 0.034, 0.03);
    if (faceW > 6.0 && !roof) {
      vec2 wq = vec2(fract(u / 1.9), (v - 1.3) / 1.15);
      float w = step(0.12, wq.x) * step(wq.x, 0.88) * step(0.0, wq.y) * step(wq.y, 1.0);
      emis += vec3(1.0, 0.84, 0.58) * 1.7 * w * (0.6 + 0.4 * h21(vec2(floor(u / 1.9), seed * 31.0)));
      emis += vec3(0.75, 0.86, 1.0) * 0.5 * step(abs(v - 0.55), 0.06);
    } else if (!roof) {
      emis += vec3(1.0, 0.95, 0.85) * 3.0 * exp(-dot(vec2(abs(u - faceW * 0.5) - 0.9, v - 1.0), vec2(abs(u - faceW * 0.5) - 0.9, v - 1.0)) * 9.0);
    }
    emis += skyGrad(0.3) * (0.4 + fres * 2.0);
  } else if (kind > 4.5 && kind < 5.5) {              // viaduct: concrete deck, a light strip underneath, glowing rails
    col = vec3(0.055) * (0.6 + 0.6 * vn(vWP.xz * 0.7));
    float across = xface ? 0.0 : abs(vL.x), along = vL.z;
    if (vSize.x > vSize.z) { across = abs(vL.z); along = vL.x; }
    if (n.y < -0.5) emis += vec3(0.80, 0.90, 1.0) * 1.3 * step(across, 0.14) * step(0.25, fract(along / 6.0));
    else if (roof) emis += vec3(0.55, 0.62, 0.75) * 0.3 * step(abs(across - 1.5), 0.08);
    else emis += C_LAMP * 0.5 * step(abs(v - vSize.y * 0.5), 0.07);
    emis += skyGrad(0.3) * (0.3 + fres * 1.5);
  } else if (kind > 5.5 && kind < 7.5) {              // glyph signs: a blade on a facade (6) or a screen on a roof (7)
    col = vec3(0.02);
    if (!roof && n.y > -0.5 && faceW > 1.0) {
      float cs = kind < 6.5 ? faceW : 1.7;
      vec2 gp = vec2(u, H - v), c = gp / cs, id = floor(c), f2 = fract(c);
      if (kind > 6.5) { float sp = (h11(id.y * 7.3 + seed * 5.0) - 0.5) * 3.0; c.x += uTime * sp; id = floor(c); f2 = fract(c); }
      float chg = floor(uTime * (0.25 + 0.7 * h21(id + seed)) + h21(id * 1.7 + seed) * 9.0);
      float gl = glyph(vec2(f2.x, 1.0 - f2.y), floor(h21(id + vec2(chg * 3.1, seed * 19.0)) * 64.0), dFdx(gp) / cs * vec2(1.0, -1.0), dFdy(gp) / cs * vec2(1.0, -1.0));
      float on = kind < 6.5 ? 1.0 : step(0.35, h21(id + floor(uTime * 0.6 + seed * 7.0)));
      float flick = (1.0 - 0.7 * step(0.93, h11(seed * 77.0)) * step(0.5, fract(uTime * 7.0 + seed))) * lightsOn(vWP.xz, h11(seed * 3.1));
      float hs = h11(seed * 13.0);                                 // neon: green code, cyan, magenta, amber, white
      vec3 sc = hs < 0.30 ? vec3(0.2, 1.0, 0.42) : hs < 0.50 ? vec3(0.12, 0.80, 1.0) : hs < 0.68 ? vec3(1.0, 0.14, 0.50) : hs < 0.85 ? vec3(1.0, 0.52, 0.10) : vec3(0.95, 0.96, 1.0);
      float farK = 1.0 - smoothstep(0.3, 1.2, max(fwidth(c.x), fwidth(c.y)));
      emis += sc * flick * (mix(0.3, gl * 2.6, farK) * on + 0.12);
      float bx = min(min(u, faceW - u), min(v, H - v));
      emis += sc * 0.9 * (1.0 - smoothstep(0.0, 0.12, bx)) * flick;
    }
  } else if (kind > 1.5 && kind < 3.5) {              // roof props, poles, antennas
    col = vec3(0.064, 0.066, 0.072) * (0.6 + 0.8 * vn(vec2(u, v) * 1.3 + seed * 40.0));
    emis += skyGrad(0.3) * (0.5 + fres * 2.5);
  } else if (roof) {
    vec2 hs = vSize.xz * 0.5;
    float edge = min(hs.x - abs(vL.x), hs.y - abs(vL.z));
    float par = 1.0 - smoothstep(0.45, 0.6, edge);
    col = mix(vec3(0.045), vec3(0.11), par) * (0.65 + 0.6 * vn(vWP.xz * 0.9));
    float pud = smoothstep(0.52, 0.66, vn(vWP.xz * 0.11 + seed * 37.0)) * (1.0 - par);
    col = mix(col, vec3(0.012), pud);
    emis += envCol(reflect(-V, n)) * pud * (0.9 + 5.0 * fres);
    vec2 q = abs(fract(vL.xz / 6.0) - 0.5);
    col *= 0.75 + 0.25 * smoothstep(0.0, 0.03, min(q.x, q.y));
    f = fract(vL.xz / 4.0);
  } else {
    float pod = step(0.5, kind);
    bool gothic = style > 0.5 && style < 1.5, indus = style > 1.5;
    fh = mix(mix(3.3, 4.3, h11(seed * 17.3)), 5.2, pod);
    bw = mix(mix(2.3, 3.9, h11(seed * 29.1)), 5.5, pod);
    if (gothic && pod < 0.5) { fh *= 1.75; bw *= 1.2; }
    bw = faceW / max(1.0, floor(faceW / bw + 0.5));
    fh = H / max(1.0, floor(H / fh + 0.5));
    vec2 c = vec2(u / bw, v / fh), id = floor(c); f = fract(c);
    vec2 fw = fwidth(c);
    float lod = smoothstep(0.22, 0.75, max(fw.x, fw.y));
    vec2 aa = fw * 1.2 + 0.002;
    vec2 p = vec2(u, H - v), dpx = dFdx(p), dpy = dFdy(p);
    float win, pLit; vec3 wall;
    if (pod > 0.5) {                                  // street-level shopfronts
      win = smoothstep(0.04, 0.04 + aa.x, f.x) * smoothstep(0.04, 0.04 + aa.x, 1.0 - f.x)
          * smoothstep(0.08, 0.08 + aa.y, f.y) * smoothstep(0.14, 0.14 + aa.y, 1.0 - f.y);
      pLit = 0.36; wall = vec3(0.05);
    } else if (gothic) {                              // stone piers, tall pointed windows, cornices
      float x = abs(f.x - 0.5), top = 0.9 - x * x * 5.5;
      win = (1.0 - smoothstep(0.17, 0.17 + aa.x, x)) * smoothstep(0.1, 0.1 + aa.y, f.y) * (1.0 - smoothstep(top, top + aa.y, f.y));
      pLit = 0.13;
      wall = mix(vec3(0.04), vec3(0.085), smoothstep(0.36, 0.40, x));
      wall = mix(wall, vec3(0.12), step(mod(id.y, 5.0), 0.5) * smoothstep(0.84, 0.87, f.y));
    } else if (indus) {                               // concrete panels, small sparse windows
      vec2 w2 = abs(f - vec2(0.5, 0.55));
      win = (1.0 - smoothstep(0.2, 0.2 + aa.x, w2.x)) * (1.0 - smoothstep(0.2, 0.2 + aa.y, w2.y)) * step(0.5, h21(id * 0.7 + fseed * 3.0));
      pLit = 0.09;
      float seam = smoothstep(0.0, aa.x + 0.012, min(f.x, 1.0 - f.x)) * smoothstep(0.0, aa.y + 0.012, min(f.y, 1.0 - f.y));
      wall = vec3(0.06) * (0.6 + 0.4 * seam);
    } else {                                          // glass curtain wall
      win = smoothstep(0.05, 0.05 + aa.x, f.x) * smoothstep(0.05, 0.05 + aa.x, 1.0 - f.x)
          * smoothstep(0.2, 0.2 + aa.y, f.y) * smoothstep(0.05, 0.05 + aa.y, 1.0 - f.y);
      pLit = 0.2; wall = vec3(0.027, 0.031, 0.038);
    }
    wall *= (0.55 + 0.6 * vn(vec2(u * 0.13, v * 0.045) + seed * 50.0)) * (0.8 + 0.25 * vn(vec2(u * 1.7 + seed * 9.0, v * 0.05)))
          * mix(vec3(1.10, 1.0, 0.88), vec3(0.90, 0.97, 1.10), h11(seed * 7.9));                    // warm stone to cold concrete
    float r1 = h21(id + fseed * 71.3), r2 = h21(vec2(floor(id.x / 3.0), id.y) + fseed * 13.1), r3 = h21(id * 1.7 + fseed * 3.3);
    float lit = min(1.0, step(r1, pLit * 0.55) + step(r2, pLit * 0.6) * step(r1, 0.75)) * step(240.0 + 170.0 * r3, vBd);   // in a new building the windows come on one by one
    float wb = mix(0.35, 1.5, r3); wb *= wb;
    wb *= mix(1.0, 0.5, pod) * (0.72 + 0.28 * step(0.5, fract(f.y * 5.0 + r3 * 9.0) + 0.5 * step(r1, 0.5)))
        * mix(1.0, 0.75 + 0.25 * step(0.1, fract(f.x * 3.0)), pod);
    wb *= 1.0 - 0.6 * step(0.94, r3) * step(0.5, fract(uTime * (2.0 + r1 * 7.0)));      // a few faulty tubes
    float wr = h21(id + fseed * 5.1);                                // every building has its own mix of lamps
    vec3 wc = wr < mix(0.25, 0.9, h11(seed * 5.3)) ? mix(vec3(1.0, 0.58, 0.24), vec3(1.0, 0.80, 0.50), fract(wr * 7.0))   // warm rooms
            : wr < 0.95 ? mix(vec3(0.70, 0.85, 1.0), vec3(0.90, 0.97, 1.0), fract(wr * 13.0))                           // cold office tubes
            : vec3(0.30, 0.55, 1.0) * (0.55 + 0.45 * sin(uTime * 9.0 + wr * 40.0));                                    // a television
    vec3 R = reflect(-V, n);
    vec3 glass = vec3(0.004, 0.005, 0.007) + envCol(R) * (0.5 + 3.5 * fres);
    if (lod < 0.9 && R.y < 0.75) {                                   // the glass mirrors the lit windows of the towers across the street
      float rl = max(length(R.xz), 0.2);
      vec2 g = vec2(atan(R.x, R.z) * 22.0 + (vWP.x + vWP.z) * 0.07, (vWP.y + R.y / rl * 42.0) / 3.7), gi = floor(g), gf = fract(g);
      float hr = h21(gi + 3.0), on = step(0.80, hr) * step(0.0, gi.y) * step(gi.y, 20.0 + 60.0 * h11(gi.x * 0.37 + 5.0));
      float sp = smoothstep(0.14, 0.24, gf.x) * smoothstep(0.14, 0.24, 1.0 - gf.x) * smoothstep(0.2, 0.32, gf.y) * smoothstep(0.1, 0.2, 1.0 - gf.y);
      glass += mix(vec3(1.0, 0.66, 0.34), vec3(0.75, 0.88, 1.0), step(0.93, hr)) * on * sp * (0.10 + 0.9 * fres) * (1.0 - lod / 0.9) * 0.9;
    }
    float near = 1.0 - smoothstep(0.12, 0.5, lod);                    // fine detail only where it can be resolved
    wall *= 1.0 - 0.45 * near * smoothstep(0.35, 0.8, vn(vec2(u * 2.6 + seed * 31.0, v * 0.16))) * smoothstep(0.0, 0.25, 1.0 - f.y);   // rain stains run down from the sills
    wall *= 0.55 + 0.45 * smoothstep(0.0, 3.5, vWP.y);                 // the foot of the wall is darker
    wall += vec3(0.022, 0.024, 0.028) * (1.0 - smoothstep(0.0, 0.3 + dist * 0.002, min(u, faceW - u))) * (1.0 - pod);   // corners catch a little light
    float bar = gothic ? 0.0 : near * max(1.0 - smoothstep(0.012, 0.012 + aa.x, abs(f.x - 0.5)), (1.0 - smoothstep(0.014, 0.014 + aa.y, abs(f.y - 0.62))) * (1.0 - pod));   // glazing bars
    col = mix(wall, vec3(0.012), win * (1.0 - 0.8 * bar));
    emis += glass * win * (1.0 - bar);
    float blind = step(r3, 0.45) * step(1.0 - fract(r1 * 13.7) * 0.75, f.y) * (1.0 - pod);   // some rooms have the blind half down
    float glow = win * lit * wb * (0.55 + 0.45 * smoothstep(0.15, 0.95, f.y)) * (1.0 - 0.75 * bar)
               * (1.0 - blind * (0.55 + 0.2 * near * step(0.5, fract(v * 9.0)))) * (1.0 - 0.35 * near * smoothstep(0.86, 1.0, f.y));
    if (lod < 0.55 && lit > 0.5 && win > 0.01 && blind < 0.5 && dist < 240.0) {     // near windows open onto a room: floor, ceiling, walls, sometimes a person
      vec3 tu = xface ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
      vec3 rd = vec3(-dot(V, tu) / bw, -V.y / fh, max(dot(V, n), 0.02) / (bw * 1.25));
      vec3 tp = (step(0.0, rd) - vec3(f, 0.0)) / (rd + vec3(1e-5));
      float tx = tp.x, ty = tp.y, tz = 1.0 / rd.z, t = min(tx, min(ty, tz));
      vec3 hp = vec3(f, 0.0) + rd * t;
      float sh;
      if (tz <= t) {                                             // back wall, with a door or a shelf, and now and then somebody at the window
        sh = 0.5 + 0.4 * hp.y;
        float dx = abs(hp.x - (0.25 + 0.5 * r3));
        sh *= 1.0 - 0.45 * step(dx, 0.13) * step(hp.y, 0.72);
        float px = 0.2 + 0.6 * h21(id + fseed * 9.7);
        if (r1 * 7.0 < 0.9) sh *= 1.0 - 0.9 * max(step(abs(hp.x - px), 0.055) * step(hp.y, 0.5), step(length(vec2((hp.x - px) * bw / fh, hp.y - 0.57)), 0.075));
      } else if (ty <= t) sh = rd.y > 0.0 ? 0.55 + 1.5 * step(abs(hp.z - 0.45), 0.12) * step(abs(hp.x - 0.5), 0.3) : 0.2;   // ceiling with its lamp, or the floor
      else sh = 0.42;                                            // side walls
      sh *= 1.0 - 0.5 * hp.z;
      glow = mix(win * lit * wb * sh * 1.35 * (1.0 - 0.75 * bar), glow, clamp(smoothstep(0.3, 0.55, lod) + smoothstep(170.0, 240.0, dist), 0.0, 1.0));
    }
    emis += wc * 0.62 * mix(glow, pLit * 0.55 * smoothstep(240.0, 410.0, vBd), lod) * lightsOn(vWP.xz, mix(r1, 0.5, lod));
    float crown = max(0.9, dist * 0.0022);
    if (pod < 0.5 && v > H - crown && h11(seed * 3.7) > 0.5 && vBd > 230.0) {                                                    // crown line
      float hc = h11(seed * 11.3);
      emis += (hc < 0.40 ? vec3(0.92, 0.95, 1.0) : hc < 0.60 ? vec3(0.15, 0.72, 1.0) : hc < 0.75 ? vec3(1.0, 0.20, 0.28) : hc < 0.88 ? vec3(1.0, 0.58, 0.14) : C_CODE * 1.6) * 1.6 * (0.9 / crown) * lightsOn(vWP.xz, hc);
    }
    if (dist < 1000.0 && vBd > 200.0) {
      vec2 cr = codeRain(p, fseed, max(codeAmt * uCode, vWv * 0.95), dpx, dpy);
      emis += (vec3(0.16, 1.0, 0.36) * cr.x * 1.2 + vec3(0.75, 1.0, 0.85) * cr.y * 1.1)
            * (1.0 - smoothstep(700.0, 1000.0, dist)) * (1.0 - 0.65 * win * lit) * (1.0 + 2.0 * vWv);
    }
  }
  emis += vec3(0.3, 1.0, 0.5) * vWv * vWv * 0.5;

  if (vG > 0.004) {                                   // glitch: slices of the building become wireframe + code
    float band = floor(vWP.y * 0.45 + uRTime * 9.0);
    bool cut = h21(vec2(band, floor(uRTime * 20.0) + seed * 10.0)) < vG * 1.3;
    float lx = min(f.x, 1.0 - f.x) * bw, ly = min(f.y, 1.0 - f.y) * fh;
    float wire = 1.0 - smoothstep(0.0, 0.1 + dist * 0.0018, min(lx, ly));
    vec2 gp = roof ? vL.xz : vec2(u, H - v);
    vec2 cg = codeRain(gp, fseed + 0.5, 0.9, dFdx(gp), dFdy(gp));
    if (cut) {
      if (wire + cg.x < 0.06) discard;
      col = vec3(0.0);
      emis = vec3(0.2, 1.0, 0.4) * (wire * 1.6 + cg.x * 2.2) + vec3(0.8, 1.0, 0.85) * cg.y * 2.0;
    } else {
      if (!front) discard;
      emis += vec3(0.15, 1.0, 0.35) * 0.25 * vG * (0.5 + 0.5 * sin(uRTime * 40.0));
    }
  }
  gl_FragColor = vec4(applyFog(col * light + emis, vFold.xyz), 1.0);
}`;
