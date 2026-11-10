// Runs a scripted tour: it takes the camera from the page, plays the scenes of the tour, and gives the camera back.
// A click starts a tour, because a browser plays no sound before one. Esc ends it. After a tour the page flies by itself again.
// The paths are written for the seed C0DEC17E, and each scene sets the world clock, so the clouds stand where its path expects them.
import * as THREE from 'three';
import { $, TAU, clamp, damp, lerp, smooth } from '../core.js';
import { S, seedHex } from '../settings.js';
import { P, cine, clock, keys, view } from '../state.js';
import { canvas } from '../renderer.js';
import { camera } from '../scene.js';
import { AC, AU, master, playMusic, startAudio } from '../audio.js';
import { resetTraffic } from '../world/traffic.js';
import { Z_AXIS, startCine } from '../flight/cine.js';
import { fx } from '../fx.js';
import { refreshUI } from '../ui.js';
import { GREEN, MONO, V, W0, els, lin, mk, st } from './kit.js';
import film from './film.js';
import reel from './reel.js';
import loop from './loop.js';
import poster from './poster.js';

export function start(name) {
  const scenes = { ...film, ...reel, ...loop, ...poster };
  const LISTS = { film: [['film', 41.3]], reel: [['city', 26], ['train', 6.8], ['wave', 6.6], ['sky', 30.6]], loop: [['loop', 45.2]], poster: [['poster', 60]] };
  const list = LISTS[name];
  if (!list) { console.warn('tour: there is no tour named ' + name); return; }
  if (seedHex() !== 'C0DEC17E') { location.hash = 'seed=C0DEC17E'; location.reload(); return; }
  const pageStep = cine.move, keep = { glitch: S.glitch };
  const fader = mk('position:fixed;inset:0;z-index:19;background:#000;opacity:0;pointer-events:none');

  // ── the current scene and its path ──
  let sc = null, SEGS = null, K = null, segI = 0, li = 0, done = false;
  const tmp2 = new V();
  const segAt = t => { let i = 0; while (i < SEGS.length - 1 && t >= SEGS[i + 1][0][0]) i++; return i; };
  const tan = (i, c) => {
    if (K[i][4]) return 0;                                          // a key with a fifth value is a stop: the camera rests there
    const a = K[Math.max(0, i - 1)], b = K[Math.min(K.length - 1, i + 1)];
    return (b[c] - a[c]) / Math.max(1e-6, b[0] - a[0]);
  };
  const evalPos = (t, o) => {                                       // Hermite spline through the keys [time, x, y, z] of the segment that holds t
    K = SEGS[segAt(t)];
    t = clamp(t, K[0][0], K[K.length - 1][0] - 1e-4);
    let i = 0; while (i < K.length - 2 && K[i + 1][0] <= t) i++;
    const a = K[i], b = K[i + 1], h = b[0] - a[0], s = (t - a[0]) / h, s2 = s * s, s3 = s2 * s, c = [0, 0, 0];
    for (let k = 1; k <= 3; k++) c[k - 1] = (2 * s3 - 3 * s2 + 1) * a[k] + (s3 - 2 * s2 + s) * h * tan(i, k) + (-2 * s3 + 3 * s2) * b[k] + (s3 - s2) * h * tan(i + 1, k);
    return o.set(c[0], c[1], c[2]);
  };
  const lookPt = (k, p, o) => k.d ? o.set(p.x + k.d[0] * 5000, p.y + k.d[1] * 5000, p.z + k.d[2] * 5000) : o.set(k.p[0], k.p[1], k.p[2]);
  const evalLook = (t, p, o) => {                                   // returns the weight, writes the target point
    const L = sc.look; if (!L.length) return 0;
    if (t <= L[0].t) { lookPt(L[0], p, o); return L[0].w; }
    for (let i = 0; i < L.length - 1; i++) if (t < L[i + 1].t) {
      const s = smooth(L[i].t, L[i + 1].t, t); lookPt(L[i], p, o); lookPt(L[i + 1], p, tmp2); o.lerp(tmp2, s);
      return lerp(L[i].w, L[i + 1].w, s);
    }
    lookPt(L[L.length - 1], p, o); return L[L.length - 1].w;
  };
  const upAt = (t, o) => {                                          // where the top of the camera points: straight up, unless the scene has `upv` keys { t, u }
    const L = sc.upv; if (!L) return o.set(0, 1, 0);
    if (t <= L[0].t) return o.fromArray(L[0].u).normalize();
    for (let i = 0; i < L.length - 1; i++) if (t < L[i + 1].t) return o.fromArray(L[i].u).lerp(tmp2.fromArray(L[i + 1].u), smooth(L[i].t, L[i + 1].t, t)).normalize();
    return o.fromArray(L[L.length - 1].u).normalize();
  };
  const enter = i => {                                              // start scene i of the list
    if (sc && sc.end) sc.end();
    li = i; clock.world = W0[list[i][0]]; sc = scenes[list[i][0]]();
    SEGS = Array.isArray(sc.pos[0][0]) ? sc.pos : [sc.pos]; K = SEGS[0]; segI = 0;
    sc.ev.sort((a, b) => a[0] - b[0]);
    st.t = sc.t0 !== undefined ? sc.t0 : -0.9; st.n = 0; st.evi = 0;
    evalPos(st.t, P.pos); camera.position.copy(P.pos); P.vel.set(0, 0, 0); resetTraffic(P.pos.x, P.pos.z);
    if (i > 0) view.started = false;                                    // load the whole neighbourhood at once, behind the black
  };
  const onKey = e => {                                              // the page's keys rest while a tour runs
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    if (!asked) go(); else if (e.code === 'Escape' && st.go) finish();
  };
  const finish = () => {                                            // hand the camera back to the page's own cinematic flight
    if (done) return; done = true;
    if (sc.end) sc.end();
    cine.move = pageStep; removeEventListener('keydown', onKey, true); keys.KeyF = false; cine.pan = 0;
    S.glitch = keep.glitch; refreshUI(); fx.nextFlash = 5; view.started = true;
    canvas.style.cursor = ''; $('ui').style.display = ''; $('hint').style.display = ''; $('hint').classList.remove('fade');
    setTimeout(() => $('hint').classList.add('fade'), 6000);
    master.gain.setTargetAtTime(0.42, AC.currentTime, 1.2);
    for (const e of els) e.remove();
    startCine();
  };

  const p = new V(), q = new V(), f2 = new V(), tg = new V(), up = new V(), ut = new V(), back = new V(), m4 = new THREE.Matrix4(), qr = new THREE.Quaternion();
  cine.move = function (dt, rdt) {
    if (!st.go) { camera.position.copy(P.pos); return; }             // waiting for the click
    st.t += rdt; st.n++;
    if (st.n === (li > 0 || sc.now ? 3 : 20)) { view.started = true; if (li > 0 || sc.now) view.fade = 1; }   // now: the scene opens on a full picture
    const t = st.t, dur = list[li][1], more = li + 1 < list.length;
    if (t >= dur) { if (more) { enter(li + 1); fader.style.opacity = 1; } else finish(); return; }
    fader.style.opacity = Math.max(more ? clamp((t - (dur - 0.35)) / 0.35, 0, 1) : 0, li > 0 ? clamp(-t / 0.4, 0, 1) : 0);   // black between scenes
    if (more && t > dur - 0.4 && !sc.duck) { sc.duck = true; master.gain.setTargetAtTime(0.03, AC.currentTime, 0.1); }
    if (li > 0 && t > -0.45 && !sc.rose) { sc.rose = true; master.gain.setTargetAtTime(0.42, AC.currentTime, 0.15); }
    if (sc.frame) sc.frame(t, rdt);
    if (sc.custom && sc.custom(t, rdt)) {                           // the scene moves the camera itself for now
      st.cust = true;
      while (st.evi < sc.ev.length && sc.ev[st.evi][0] <= t) sc.ev[st.evi++][1]();
      return;
    }
    const first = st.n === 1 || segAt(t) !== segI || st.cust; segI = segAt(t); st.cust = false;   // the first frame of a scene, or a cut inside it
    evalPos(t, p); evalPos(Math.min(t + 0.3, SEGS[segI][SEGS[segI].length - 1][0] - 1e-3), q);
    if (first) { evalPos(t, P.pos); st.roll = 0; }
    P.vel.copy(p).sub(P.pos).divideScalar(Math.max(rdt, 1e-4)).clampLength(0, 950);
    P.pos.copy(p);
    const v = P.vel.length();
    P.boost = damp(P.boost, lin(sc.boost, t), 2.5, rdt);
    f2.copy(q).sub(p); if (f2.lengthSq() < 1e-6) f2.copy(st.f); else f2.normalize();
    const w = evalLook(t, p, tg);
    if (w > 0) { tg.sub(p).normalize(); f2.lerp(tg, w).normalize(); }
    if (first) st.f.copy(f2); else st.f.lerp(f2, 1 - Math.exp(-6 * rdt)).normalize();
    const f = st.f;
    st.right.addScaledVector(f, -st.right.dot(f));
    if (st.right.lengthSq() < 1e-6) st.right.set(1, 0, 0);
    st.right.normalize();
    upAt(t, ut);
    const lvl = 1 - smooth(0.8, 0.97, Math.abs(f.dot(ut)));
    if (lvl > 0) {
      up.crossVectors(f, ut).normalize();
      if (first) st.right.copy(up); else st.right.lerp(up, (1 - Math.exp(-lerp(30, 3, smooth(6, 45, v)) * rdt)) * lvl);   // a slow camera keeps the horizon level
      if (st.right.lengthSq() < 1e-4) st.right.copy(up);
      st.right.addScaledVector(f, -st.right.dot(f)).normalize();
    }
    up.crossVectors(st.right, f);
    let yr = 0;
    if (lvl > 0.05) {
      const h = Math.atan2(-f.x, -f.z); let dh = first ? 0 : h - st.head; dh -= Math.round(dh / TAU) * TAU;
      yr = dh / Math.max(rdt, 1e-4) * lvl; st.head = h; P.yaw = h;
    }
    P.yawRate = damp(P.yawRate, yr, 8, rdt);
    const pitch = Math.asin(clamp(f.y, -1, 1));
    P.pitchRate = first ? 0 : damp(P.pitchRate, (pitch - P.pitch) / Math.max(rdt, 1e-4), 8, rdt); P.pitch = pitch;
    st.roll = damp(st.roll, clamp(Math.atan(P.yawRate * v * Math.hypot(f.x, f.z) / 45), -0.5, 0.5) * smooth(0.9, 1, ut.y) * (sc.bank ? lin(sc.bank, t) : 1), 3, rdt); P.roll = st.roll;   // a gentle bank
    back.copy(f).negate();
    camera.quaternion.setFromRotationMatrix(m4.makeBasis(st.right, up, back)).multiply(qr.setFromAxisAngle(Z_AXIS, st.roll));
    camera.position.copy(p);
    while (st.evi < sc.ev.length && sc.ev[st.evi][0] <= t) sc.ev[st.evi++][1]();
  };

  cine.on = true; cine.pan = 0;
  canvas.style.cursor = 'none'; $('ui').style.display = 'none'; $('hint').style.display = 'none'; $('intro').style.display = 'none';
  enter(0);
  // a browser plays no sound before a click, so the tour waits for one
  const gate = mk(`position:fixed;inset:0;z-index:30;background:#000;display:flex;flex-direction:column;gap:2vh;align-items:center;justify-content:center;cursor:pointer;font:700 2.6vh ${MONO};color:${GREEN};letter-spacing:.3em;text-shadow:0 0 1.2vh rgba(57,255,122,.7)`);
  gate.innerHTML = `<div>CLICK TO START</div><div style="font-size:1.5vh;opacity:.5">${name.toUpperCase()} &middot; ESC ENDS IT</div>`;
  let asked = false;
  const go = () => {
    if (asked) return; asked = true;
    startAudio(); gate.firstChild.textContent = '';
    const begin = () => { if (st.go) return; playMusic(true); gate.remove(); st.go = true; clock.world = W0[list[0][0]]; };   // the wait at the gate does not count
    AU.musicReady.then(begin); setTimeout(begin, 4000);              // the music starts with the tour; do not wait for it for long
  };
  gate.addEventListener('click', go);
  addEventListener('keydown', onKey, true);
}
