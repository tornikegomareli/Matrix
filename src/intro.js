// The intro: text typed on black, then the picture
import { $ } from './core.js';
import { MOVE_KEYS, build, keys, view } from './state.js';
import { setCine } from './flight/cine.js';
import { fx } from './fx.js';

(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms)), el = $('typed');
  await wait(900);
  for (const ch of 'Wake up now...') { el.textContent += ch; await wait(90 + Math.random() * 110); }
  await wait(1300);
  $('intro').classList.add('gone');
  view.started = true; fx.nextGlitch = 2.8; fx.force = 'dissolve';
  setTimeout(() => { if (build.auto) { build.auto = false; build.speed = 420; } }, 700);   // the city builds itself as the picture fades in
  if (!MOVE_KEYS.some(k => keys[k])) setCine(true, true);        // already flying by hand: leave the controls alone
  setTimeout(() => $('hint').classList.add('fade'), 5000);
})();
