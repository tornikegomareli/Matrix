// Audio: recordings only, silent until the first click
import { MACH, clamp, lerp, smooth } from './core.js';
import { S } from './settings.js';
import { P, build, clock, nearest } from './state.js';
import { U } from './renderer.js';

// Every sound is a recording (the files are in sounds/, and docs/assets.md lists their sources; the music is the file music.mp3). Nothing is synthesised:
// the script only loops, filters, pans and mixes.
export let AC = null, master = null, lpMaster = null, verbIn = null, thBus = null;
export const AU = { nodes: {}, buf: {} };
const MUSIC = 0.3;                                               // the level of the music: it stays under the weather
const LOOPS = { rain: 16, rainClose: 7, wind: 11, city: 18, train: 7, heart: 2.89 };   // loop lengths in seconds. Each file wraps 0.25 s past both ends
export const aGain = v => { const g = AC.createGain(); g.gain.value = v; return g; };
export const aFilt = (type, f, q) => { const n = AC.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; };
export const aChain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
export const aPan = v => { const p = AC.createStereoPanner(); p.pan.value = clamp(v, -1, 1); return p; };
export const aSet = (param, v, tc) => param.setTargetAtTime(v, AC.currentTime, tc || 0.2);
// the echo of a city of towers: a decaying wash with a few hard reflections (a filter for the recordings, not a sound)
function mkImpulse(sec) {
  const sr = AC.sampleRate, len = Math.floor(sr * sec), b = AC.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * Math.exp(-i / (sr * 0.9)) * 0.5;
    for (let k = 0; k < 7; k++) {
      const at = Math.floor(sr * (0.05 + Math.random() * 0.42));
      for (let i = 0; i < 300; i++) d[at + i] += (Math.random() * 2 - 1) * 0.6 * Math.exp(-i / 60) * (1 - k / 9);
    }
  }
  return b;
}
// fetch and decode one recording
function loadSound(name) {
  return fetch('sounds/' + name + '.mp3').then(r => r.arrayBuffer()).then(b => AC.decodeAudioData(b)).then(b => { AU.buf[name] = b; });
}
// run a recording as an endless loop into dest. Any window of the loop length inside the file repeats without a seam
function aLoop(name, dest, offset) {
  const s = AC.createBufferSource(); s.buffer = AU.buf[name]; s.loop = true; s.loopStart = 0.1; s.loopEnd = 0.1 + LOOPS[name];
  s.connect(dest); s.start(0, 0.1 + (offset || 0)); return s;
}
// play a recording once. Returns its gain node, or null while the recording is not decoded yet
export function aPlay(name, dest, when, gain, rate, offset, dur) {
  const b = AU.buf[name]; if (!b) return null;
  const s = AC.createBufferSource(), g = aGain(gain); s.buffer = b; s.playbackRate.value = rate || 1;
  aChain(s, g, dest); s.start(when, offset || 0, dur === undefined ? b.duration : dur); return g;
}
export function startAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
  AC = new Ctx();
  const N = AU.nodes;
  master = aGain(0); lpMaster = aFilt('lowpass', 18000);
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3.5; comp.release.value = 0.3;
  const clip = AC.createWaveShaper(), curve = new Float32Array(1025);                             // soft ceiling: nothing leaves above full scale
  for (let i = 0; i < 1025; i++) curve[i] = Math.tanh((i / 512 - 1) * 1.6) / Math.tanh(1.6) * 0.94;
  clip.curve = curve;
  N.duck = aGain(1); N.out = aGain(S.sound ? 1 : 0); aChain(master, N.duck, lpMaster, comp, clip, N.out, AC.destination);   // out: the switch for all sound
  master.gain.linearRampToValueAtTime(0.42, AC.currentTime + 2.5);
  const conv = AC.createConvolver(); conv.buffer = mkImpulse(3.2);
  verbIn = aGain(1); aChain(verbIn, conv, aGain(0.55), master);
  thBus = aFilt('lowpass', 16000); aChain(thBus, aGain(0.85), clip); aChain(thBus, aGain(0.6), verbIn);   // thunder goes around the compressor, so a close strike is far louder than the rain
  // rain: one recording twice, out of step, left and right; and a closer, crisper rain near the street
  N.rainLP = aFilt('lowpass', 11000); N.rain = aChain(N.rainLP, aGain(0)); N.rain.connect(master);
  N.close = aGain(0); N.close.connect(master);
  // wind: level and pitch follow the flight speed. The same recording, thinned, is the wind above the clouds
  N.windIn = aGain(1); N.wind = aChain(N.windIn, aGain(0)); N.wind.connect(master);
  N.hi = aChain(N.windIn, aFilt('bandpass', 900, 1.2), aGain(0)); N.hi.connect(master);
  // the city: the low end of far traffic under everything
  N.cityIn = aFilt('lowpass', 320); N.city = aChain(N.cityIn, aGain(0)); N.city.connect(master);
  // one voice for the nearest train
  N.train = aGain(0); N.trainPan = aPan(0); aChain(N.train, N.trainPan, master); aChain(N.trainPan, aGain(0.4), verbIn);
  loadSound('rain').then(() => { const l = aPan(-0.55), r = aPan(0.55); l.connect(N.rainLP); r.connect(N.rainLP); aLoop('rain', l, 0); aLoop('rain', r, 7.3); });
  loadSound('rainClose').then(() => aLoop('rainClose', N.close));
  loadSound('wind').then(() => { N.windSrc = aLoop('wind', N.windIn); });
  loadSound('city').then(() => aLoop('city', N.cityIn));
  loadSound('train').then(() => aLoop('train', N.train));
  N.heart = aGain(0); N.heart.connect(clip);                     // a slow heartbeat, heard in bullet-time
  loadSound('heart').then(() => aLoop('heart', N.heart));
  for (const n of ['thunderA', 'thunderB', 'thunderC', 'boom', 'thud', 'static']) loadSound(n);
  // the music: a file beside the page, so it plays only when the page is served over http. It starts when it is decoded
  N.music = aGain(0); N.music.connect(master);
  AU.musicReady = fetch('music.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => AC.decodeAudioData(b)).then(b => { AU.buf.music = b; playMusic(true); }).catch(() => {});
}
// play the music from its beginning. restart: cut what plays now. Otherwise the new pass fades in over the end of the old one
export function playMusic(restart) {
  const b = AU.buf.music, old = AU.mus; if (!b) return;
  if (old) { if (restart) old.s.stop(); else { old.g.gain.setTargetAtTime(0, AC.currentTime, 1.2); old.s.stop(AC.currentTime + 6); } }
  const s = AC.createBufferSource(), g = aGain(old && !restart ? 0 : 1); s.buffer = b; aChain(s, g, AU.nodes.music); s.start();
  if (old && !restart) g.gain.setTargetAtTime(1, AC.currentTime, 1.2);
  AU.mus = { s, g, end: AC.currentTime + b.duration };
}
export function updateAudio(rdt) {
  if (!AC) return;
  const N = AU.nodes, alt = P.pos.y, sn = clamp(P.speed / MACH, 0, 1.6), below = 1 - U.uAbove.value, inC = U.uCloud.value, rainOn = S.rain ? 1 : 0, rainK = U.uRainK.value;
  const street = 1 - smooth(5, 70, alt), world = build.on ? smooth(300, 1500, build.r) : 1;     // no city yet, no city sound
  const gust = 0.85 + 0.15 * Math.sin(clock.real * 0.31) * Math.sin(clock.real * 0.173 + 1);
  aSet(N.rain.gain, rainOn * rainK * 1.5 * (1 - 0.5 * inC) * gust);
  aSet(N.rainLP.frequency, lerp(11000, 4500, smooth(60, 600, alt)), 0.3);                       // high above the street the rain is a duller wash
  aSet(N.close.gain, rainOn * rainK * lerp(0.1, 1.1, street) * (1 - inC) * gust);
  aSet(N.wind.gain, 0.05 * world + 2.2 * Math.pow(Math.min(sn, 1.2), 1.5) + 1.0 * inC * Math.min(1, sn * 3), 0.15);
  if (N.windSrc) aSet(N.windSrc.playbackRate, 0.75 + 0.85 * sn, 0.15);
  aSet(N.hi.gain, U.uAbove.value * (0.6 + 1.2 * Math.min(sn, 1.2)), 0.4);
  aSet(N.city.gain, (S.traffic ? 1 : 0.4) * below * 1.3 * (1 - smooth(30, 520, alt)) * world);
  aSet(lpMaster.frequency, lerp(18000, 420, P.slow), 0.08);                                     // bullet-time: the world goes underwater and far away,
  aSet(N.duck.gain, 1 - 0.8 * P.slow, 0.1); aSet(N.heart.gain, P.slow, 0.12);             // and the heart is what is left
  aSet(thBus.frequency, Math.min(lerp(16000, 320, U.uAbove.value), lerp(16000, 420, P.slow)), 0.3);   // thunder from above the clouds is a dull thud
  aSet(N.music.gain, S.music ? MUSIC * (0.6 + 0.4 * rainOn * rainK) : 0, 0.4);                    // lower where the weather is quiet
  if (AU.mus && AC.currentTime > AU.mus.end - 6) playMusic();
  const tk = clamp(1 - nearest.train / 260, 0, 1);
  aSet(N.train.gain, tk * tk * 4.5 * below, 0.1); aSet(N.trainPan.pan, clamp(nearest.pan / 60, -1, 1), 0.1);
}
// thunder: recorded strikes. Sound takes time to arrive, and distance takes the crack away and leaves the roll.
export function thunder(dist, amp, panX, strike) {
  if (!AC) return;
  const near = clamp(1 - dist / 1500, 0, 1), names = ['thunderA', 'thunderB', 'thunderC'], pick = dist > 1500 ? 2 : (Math.random() * (strike ? 2 : 3)) | 0;
  const buf = AU.buf[names[pick]] || AU.buf.thunderA; if (!buf) return;
  const t = AC.currentTime + Math.min(dist / 343, 9), src = AC.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = lerp(0.8, 1, near) * (0.94 + Math.random() * 0.12);                 // far thunder is slower and deeper
  const lp = aFilt('lowpass', lerp(420, 15000, near * near)), g = aGain(clamp(amp / 2.2, 0.55, 1.1) * (0.25 + 1.9 / (1 + dist / 380)));
  const pan = aPan(clamp(panX / 600, -0.8, 0.8));
  aChain(src, lp, g, pan, thBus); src.start(t);
}
export function chirp(n) {                                               // a glitch: short cuts of television static
  if (!AC) return;
  let t = AC.currentTime;
  for (let i = 0; i < n; i++) {
    const g = aPlay('static', master, t, 0.08 + Math.random() * 0.07, 0.7 + Math.random() * 1.2, Math.random() * 1.4, 0.03 + Math.random() * 0.05);
    if (g) g.connect(verbIn);
    t += 0.04 + Math.random() * 0.05;
  }
}
export function sonicBoom() {                                            // the double bang of a shock wave: a recorded explosion, twice
  if (!AC) return;
  for (const [dt, gn, rate] of [[0, 1.0, 0.8], [0.13, 0.75, 0.7]]) { const g = aPlay('boom', master, AC.currentTime + dt, gn, rate); if (g) g.connect(verbIn); }
}
export function impactSound(hit) {
  if (!AC) return;
  const g = aPlay('thud', master, AC.currentTime, clamp(hit / 160, 0.08, 0.9) * 1.3, 0.7 + Math.random() * 0.3); if (g) g.connect(verbIn);
}
// the recompile front: storm wind that rises as the front comes, then a deep bang when it arrives
export function waveSound(dur) {
  if (!AC || !AU.buf.wind) return;
  const t = AC.currentTime, s = AC.createBufferSource(), f = aFilt('bandpass', 180, 3), g = aGain(0.0001);
  s.buffer = AU.buf.wind; s.loop = true; s.loopStart = 0.1; s.loopEnd = 0.1 + LOOPS.wind;
  s.playbackRate.setValueAtTime(0.8, t); s.playbackRate.linearRampToValueAtTime(2.4, t + dur);
  f.frequency.setValueAtTime(180, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(3.0, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
  aChain(s, f, g, master); g.connect(verbIn); s.start(t, 0.1); s.stop(t + dur + 1.6);
  const b = aPlay('boom', master, t + dur, 1.0, 0.5); if (b) b.connect(verbIn);
}
