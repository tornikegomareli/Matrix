// A still picture: the first frame of a video (?tour=poster)
import { S } from '../settings.js';
import { fx } from '../fx.js';
import { refreshUI } from '../ui.js';
import { standing, strike } from './kit.js';

// ───────────────────────── a still picture: the first frame of a video ─────────────────────────
// The camera stands still over the roofs and looks west. One second in, lightning strikes the mast that is most in front of it.
// The picture is this scene a moment after the strike, at 3840×2160 (add &pixels=8.3 to the address).
export default {
  poster() {
    S.glitch = 0; refreshUI(); standing(); fx.nextFlash = 99;
    return { pos: [[0, 500, 100, -850, 1], [60, 500, 100, -850, 1]], look: [{ t: 0, p: [213, 115, -763], w: 1 }], t0: 0, now: true, boost: [], bank: [[0, 0]],
      ev: [[1.0, () => { strike(140, 480)(); fx.flashAmp = 1.2; }]] };
  },
};
