// The four scenes of the reel (?tour=reel)
import { CELL, clamp, hash01, lerp, smooth } from '../core.js';
import { SEED } from '../settings.js';
import { clock } from '../state.js';
import { railY } from '../world/city.js';
import { startBuild } from '../world/chunks.js';
import { fx } from '../fx.js';
import { M, TEXT_CSS, cloudFlash, farFlash, mk, standing, strike, typeText, unbuilt, waveDir } from './kit.js';

export default {
  // the text, the city builds itself, a slow look around while rising over the street with a strike, a dive into the street, then a fast run
  city() {
    fx.nextFlash = 99; unbuilt(500, -850);
    const ov = mk('position:fixed;inset:0;z-index:20;background:#000;pointer-events:none'), tx = document.createElement('div');
    tx.style.cssText = TEXT_CSS; ov.append(tx);
    const frame = t => {
      if (t >= 4.6) { ov.style.display = 'none'; return; }
      typeText(tx, 'Wake up now...', t, 0.5, 0.17);
      ov.style.opacity = clamp(1 - (t - 3.4) / 1.1, 0, 1);
    };
    const pos = [[0, 500, 55, -850], [3.5, 500, 57, -850], [8, 500, 100, -850], [12.5, 500, 136, -850], [13.2, 500, 137, -842], [14.3, 500, 124, -790], [15.2, 500, 72, -705],
      [16.0, 500, 24, -630], [16.8, 500, 10, -560], [18.0, 503, 9, -495], [19.4, 497, 9, -410], [20.4, 500, 9.5, -300], [21.4, 500, 10, -130], [22.4, 500, 10, 100],
      [23.4, 500, 11, 340], [24.1, 500, 12, 510], [24.7, 500, 50, 640], [25.4, 500, 150, 760], [26.4, 500, 260, 900], [28, 500, 330, 1100]];
    const look = [];
    for (let t = 2.5; t <= 13.01; t += 0.5) { const a = (smooth(3.2, 12.8, t) - 1) * 2.27; look.push({ t, d: [Math.sin(a), 0.03 + 0.07 * Math.sin(a * 0.5), Math.cos(a)], w: 1 }); }
    look.push({ t: 14.2, d: [0, -0.1, 1], w: 0 });
    return { pos, look, frame, t0: 0, boost: [[20.0, 0], [21.0, 1], [24.0, 1], [25.6, 0.4]], ev: [[3.5, () => startBuild(500, -850, 420)], [7.6, strike(140, 480)], [18.6, farFlash(430, 1.8)]] };
  },
  // tracking shot beside a train on the elevated rail over the road x = 200
  train() {
    standing();
    const line = 2, x0 = line * CELL, ry = railY(1, line), dir = hash01(SEED ^ 0x77A1, 1, line) < 0.5 ? 1 : -1;
    const off = hash01(SEED ^ 0x77A2, 1, line) * 760, head = t => off + dir * 36 * (clock.world + t + 0.9);   // head of train k = 0 at tour time t (the scene starts at -0.9)
    const k = Math.round((-380 - head(3.5)) / 760), hz = t => k * 760 + head(t);
    const pos = [], look = [];
    for (let t = -3; t <= 9.01; t += 1) {
      const zc = hz(0) - dir * (84 + 34) + dir * 52 * t;             // starts behind the tail, overtakes at 16 m/s
      pos.push([t, x0 + 7.6, ry + lerp(8.5, 4.6, smooth(-1, 5, t)), zc]);
      look.push({ t, p: [x0, ry + 3, hz(t) - dir * 30], w: lerp(0.55, 0.3, smooth(4, 7.5, t)) });
    }
    return { pos, look, boost: [], ev: [] };
  },
  // the recompile wave seen from roof level: it comes from ahead and passes the camera
  wave() {
    standing();
    const pos = [];
    for (const [t, y] of [[-3, 245], [0, 240], [3, 232], [7, 222]]) pos.push([t, 500, y, -690 + 22 * t]);
    return { pos, look: [{ t: 0, p: [500, 170, 200], w: 0.3 }, { t: 7, p: [500, 170, 400], w: 0.3 }], boost: [], ev: [[-0.7, waveDir()]] };
  },
  // up the side of a spire through the cloud deck, into a cloud tower and out of it toward the moon, the whole city from 3000 m
  // with a wave crossing it, then straight down at Mach 2 and out along the roofs
  sky() {
    standing();
    const SP = [-250, -750];
    return {
      pos: [[-3, 730, 170, -800], [0, 250, 170, -800], [1.6, -5, 172, -800], [2.3, -110, 190, -800], [2.9, -180, 260, -800], [3.4, -204, 400, -800],
        [4.0, -208, 600, -800], [4.8, -208, 870, -799], [5.5, -204, 1090, -796], [6.2, -190, 1210, -830], [7.0, -200, 1230, -960],
        [8.0, -260, 1180, -1190], [9.0, -300, 1150, -1430], [10.0, -250, 1160, -1660], [11.0, -120, 1210, -1880], [12.0, 80, 1290, -2080],
        [13, 330, 1500, -2230], [14, 600, 1900, -2200], [15, 800, 2450, -1930], [16, 820, 2870, -1520], [17.2, 720, 3050, -1050], [18.5, 620, 3080, -750],
        [20, 580, 3060, -560], [21, 560, 2700, -500], [22, 530, 2050, -440], [23, 510, 1350, -400], [24, 500, 680, -360], [24.7, 500, 330, -300],
        [25.4, 500, 205, -150], [26.4, 500, 185, 130], [27.6, 500, 190, 480], [28.8, 500, 200, 830], [30, 500, 215, 1180], [31.5, 500, 235, 1600]],
      look: [{ t: 2.4, p: [SP[0], 300, SP[1]], w: 0 }, { t: 3.2, p: [SP[0], 520, SP[1]], w: 0.3 }, { t: 4.6, p: [SP[0], 1000, SP[1]], w: 0.35 },
        { t: 5.6, p: [SP[0], 1150, SP[1]], w: 0.5 }, { t: 6.4, p: [SP[0], 1010, SP[1]], w: 0.7 }, { t: 7.0, p: [SP[0], 1010, SP[1]], w: 0.3 },
        { t: 7.8, d: M, w: 0.3 }, { t: 10.6, d: M, w: 0.45 }, { t: 12.2, d: M, w: 0.6 }, { t: 13.4, d: M, w: 0 }, { t: 16.5, p: [500, 0, -400], w: 0.5 }, { t: 17.6, p: [500, 0, -400], w: 1 },
        { t: 20.4, p: [500, 0, -380], w: 1 }, { t: 21.5, p: [500, 0, -380], w: 0.3 }, { t: 22.5, p: [500, 0, -380], w: 0 }],
      boost: [[2.2, 0], [2.9, 0.9], [5.3, 0.9], [6.2, 0.2], [7.2, 0.6], [10.6, 0.6], [11.6, 0.2], [12.2, 0.2], [12.8, 1], [16.5, 1], [17.5, 0], [20.2, 0], [20.8, 1], [24.6, 1], [25.6, 0.5], [30, 0.5]],
      ev: [[8.2, cloudFlash(-520, 1100, -1500, 1.4)], [9.0, waveDir(0, -1)], [9.9, cloudFlash(-420, 1250, -2050, 1.3)], [18.3, cloudFlash(-380, 900, -1250, 2.3)], [19.6, cloudFlash(-950, 1000, -2400, 2.0)]],
    };
  },
};
