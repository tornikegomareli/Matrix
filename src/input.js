// Input: keys, mouse and touch
import { $, clamp } from './core.js';
import { MOVE_KEYS, P, cine, keys, touch } from './state.js';
import { IS_TOUCH, canvas } from './renderer.js';
import { startAudio } from './audio.js';
import { startWave } from './world/chunks.js';
import { setCine } from './flight/cine.js';
import { newSeed, toggle } from './ui.js';

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (MOVE_KEYS.includes(e.code) || e.code === 'KeyF') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (cine.on && MOVE_KEYS.includes(e.code)) setCine(false);
  if (e.code === 'Space' && !cine.on) P.vel.y += 26;             // launch kick
  if (e.code === 'KeyC') setCine(!cine.on);
  else if (e.code === 'KeyH') $('ui').classList.toggle('hidden');
  else if (e.code === 'KeyR') newSeed();
  else if (e.code === 'KeyG') startWave();
  else if (e.code === 'Digit1') toggle('rain');
  else if (e.code === 'Digit2') toggle('traffic');
  else if (e.code === 'Digit3') toggle('glitch');
  else if (e.code === 'Digit4') toggle('code');
  else if (e.code === 'Digit5') toggle('sound');
  else if (e.code === 'Digit6') toggle('music');
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

canvas.addEventListener('click', () => {
  startAudio();
  if (IS_TOUCH || document.pointerLockElement === canvas) return;
  const lock = canvas.requestPointerLock();
  if (lock && lock.catch) lock.catch(() => {});                  // rejects if Esc was pressed a moment ago
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || cine.on) return;
  P.yaw -= e.movementX * 0.0021; P.pitch = clamp(P.pitch - e.movementY * 0.0021, -1.54, 1.54);
});
// touch: left stick moves, dragging anywhere else looks around
{
  const stick = $('stick'), knob = $('knob'); let sid = -1, lid = -1, lx = 0, ly = 0;
  const setStick = (e) => {
    const r = stick.getBoundingClientRect(); let dx = (e.clientX - r.left) / r.width * 2 - 1, dy = (e.clientY - r.top) / r.height * 2 - 1;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    touch.fx = dx; touch.fy = -dy; knob.style.transform = `translate(${dx * 37}px,${dy * 37}px)`;
  };
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); startAudio(); if (cine.on) setCine(false); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
  const endStick = e => { if (e.pointerId === sid) { sid = -1; touch.fx = touch.fy = 0; knob.style.transform = ''; } };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && lid < 0) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; } });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== lid || cine.on) return;
    P.yaw -= (e.clientX - lx) * 0.005; P.pitch = clamp(P.pitch - (e.clientY - ly) * 0.005, -1.54, 1.54); lx = e.clientX; ly = e.clientY;
  });
  const endLook = e => { if (e.pointerId === lid) lid = -1; };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  const hold = (id, key) => {
    const b = $(id);
    b.addEventListener('pointerdown', e => { e.preventDefault(); touch[key] = true; startAudio(); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { touch[key] = false; });
  };
  hold('bBoost', 'boost'); hold('bTime', 'slow');
  $('bCine').addEventListener('click', () => { startAudio(); setCine(!cine.on); });
}
