// The film (?tour=film)
import { clamp, mulberry32 } from '../core.js';
import { S } from '../settings.js';
import { keys } from '../state.js';
import { AC, master } from '../audio.js';
import { startBuild } from '../world/chunks.js';
import { fx } from '../fx.js';
import { refreshUI } from '../ui.js';
import { TEXT_CSS, cloudFlash, farFlash, mk, strike, typeText, unbuilt } from './kit.js';

export default {
  // the film: text on black, the text shatters into digital rain, the camera pushes through it and the city builds itself,
  // a rooftop, the jump, bullet time above the skyline, a fast run through the city, and up through the clouds into silence
  film() {
    S.glitch = 0; refreshUI(); unbuilt(500, -900);
    const RX = 513.5, RY = 186, RZ = -368;                          // the roof edge over the street x = 500
    const rnd = mulberry32(0xF11A), TEXT = 'wake up...', GL = 'ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾜ0123456789:.=*+-<>|';
    const ov = mk('position:fixed;inset:0;z-index:20;background:#000;overflow:hidden;pointer-events:none'), tx = document.createElement('div');
    tx.style.cssText = TEXT_CSS; ov.append(tx);
    const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
    // the wall of digital rain. Every glyph is drawn once with its glow, green for the trail and pale for the head; a frame only copies them
    const mkRain = () => {
      const k = clamp(Math.sqrt(4e6 / (innerWidth * innerHeight)), 1, Math.min(devicePixelRatio || 1, 2));   // canvas pixels per CSS pixel
      const W = Math.round(innerWidth * k), H = Math.round(innerHeight * k), CW = Math.round(H / 34), RH = Math.round(CW * 1.12);
      const NC = Math.ceil(W / CW), NR = Math.ceil(H / RH) + 2, SW = CW * 2, SH = RH * 2;
      const cv = document.createElement('canvas'), atlas = document.createElement('canvas'), ag = atlas.getContext('2d');
      cv.width = W; cv.height = H; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 50%'; ov.append(cv);
      atlas.width = SW * GL.length; atlas.height = SH * 2;
      ag.font = `700 ${Math.round(RH * 0.86)}px "Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","MS Gothic","Noto Sans Mono CJK JP",monospace`;
      ag.textAlign = 'center'; ag.textBaseline = 'middle'; ag.shadowColor = 'rgba(57,255,122,0.9)'; ag.shadowBlur = CW * 0.45;
      for (let i = 0; i < GL.length; i++) for (let h = 0; h < 2; h++) { ag.fillStyle = h ? 'rgb(220,255,230)' : 'rgb(57,255,122)'; ag.fillText(GL[i], (i + 0.5) * SW, (h + 0.5) * SH); }
      const cols = [];
      for (let c = 0; c < NC; c++) cols.push({ head: -1 - rnd() * 6, v: 16 + rnd() * 22, len: 9 + rnd() * 20, t0: 3.15 + rnd() * 1.7, seed: rnd() * 1000 });
      const r = tx.getBoundingClientRect(), cw = r.width / (TEXT.length + 0.7);                // the letters become the heads of the first streams
      for (let i = 0; i < TEXT.length; i++) {
        const c = cols[clamp(Math.floor((W - (r.left + cw * (i + 0.5)) * k) / CW), 0, NC - 1)];     // the canvas is mirrored
        c.head = (r.top + r.height / 2) * k / RH; c.t0 = 3.0 + i * 0.012; c.v = 20 + rnd() * 16; c.len = 14 + rnd() * 10;
      }
      return { cv, g: cv.getContext('2d'), atlas, cols, W, H, CW, RH, NC, NR, SW, SH };
    };
    let rain = null;
    const frame = t => {
      fx.nextFlash = 99;                                          // the lightning of the film is in its script
      keys.KeyF = t >= 23.95 && t < 30;                           // bullet time
      if (t >= 7.4) { ov.style.display = 'none'; return; }
      if (t < 3.0) { typeText(tx, TEXT, t, 0.9, 0.15); return; }
      if (!rain) {
        rain = mkRain(); tx.style.display = 'none';
      }
      const { g, atlas, cols, W, H, CW, RH, NC, NR, SW, SH } = rain;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.setTransform(-1, 0, 0, 1, W, 0);                           // mirrored, like the film
      for (let c = 0; c < NC; c++) {
        const s = cols[c]; if (t < s.t0) continue;
        let head = s.head + (t - s.t0) * s.v;
        if (head > NR + s.len) head = ((head + 6) % (NR + s.len + 4)) - 6;   // streams keep coming
        const h0 = Math.floor(head);
        for (let j = 0; j < s.len; j++) {
          const row = h0 - j; if (row < -1 || row > NR) continue;
          const gi = Math.floor(hash(c * 7.3 + row * 1.7, s.seed + Math.floor(t * (2 + 5 * hash(c, row)))) * GL.length);
          g.globalAlpha = j === 0 ? 1 : Math.pow(1 - j / s.len, 1.5) * 0.85;
          g.drawImage(atlas, gi * SW, j === 0 ? SH : 0, SW, SH, (c + 0.5) * CW - SW / 2, (row + 0.5) * RH - SH / 2, SW, SH);
        }
      }
      if (t > 6.0) {                                              // push through the wall
        const u = t - 6.0;
        ov.style.background = `rgba(0,0,0,${clamp(1 - u / 0.45, 0, 1)})`;
        rain.cv.style.transform = `scale(${Math.exp(u * 2.3)})`; rain.cv.style.opacity = clamp(1 - (u - 0.25) / 0.95, 0, 1);
      }
    };
    const A = [[0, 500, 235, -1330], [6, 500, 235, -1330], [8, 500, 244, -1200], [10.1, 500, 255, -1040]];
    const B = [[10.0, RX + 1.1, RY + 1.75, RZ], [12.0, RX + 1.0, RY + 1.74, RZ + 0.2], [14.6, RX + 0.45, RY + 1.62, RZ + 0.6], [16.0, RX + 0.4, RY + 1.58, RZ + 0.8],
      [16.5, RX - 1.7, RY + 0.4, RZ + 1.4], [17.0, RX - 2.8, RY - 15, RZ + 1.8], [17.6, RX - 2.9, RY - 56, RZ + 2], [18.2, RX - 2.9, RY - 110, RZ + 2], [18.75, RX - 3.0, RY - 158, RZ + 3],
      [19.15, 509.0, 14, -360], [19.5, 505.5, 5.2, -338], [19.95, 501.5, 3.5, -305], [20.5, 500, 3.3, -258], [21.0, 500, 3.3, -212], [21.5, 500, 3.4, -164],
      [22.0, 500, 3.6, -88], [22.3, 500, 4.2, -8], [22.52, 500, 9, 62], [22.72, 500, 42, 104], [22.95, 500, 112, 116], [23.3, 500, 232, 118], [23.65, 500, 345, 118],
      [24.0, 500, 420, 117], [24.5, 500, 451, 116], [25.0, 500.6, 455, 116]];
    for (let t = 25.5; t <= 30.01; t += 0.5) { const a = (t - 25) / 5 * 1.2; B.push([t, 500 + 10 * Math.sin(a), 455 + 3 * (t - 25) / 5, 116 + 10 * (1 - Math.cos(a))]); }
    B.push([30.5, 507, 446, 86], [31.0, 502, 380, -5], [31.5, 500, 258, -128], [32.0, 500, 126, -258], [32.4, 503, 32, -350], [32.8, 497, 11, -440], [33.3, 505, 9, -540],
      [33.8, 496, 9, -640], [34.15, 500, 9, -705], [34.6, 503, 12, -800], [35.1, 499, 30, -900], [35.6, 500, 100, -990], [36.1, 500, 240, -1050], [36.7, 500, 480, -1085],
      [37.3, 500, 760, -1095], [37.9, 500, 1010, -1085], [38.6, 500, 1200, -1040], [39.4, 500, 1300, -960], [40.4, 500, 1350, -860], [41.5, 500, 1370, -760]);
    const CITY = [480, 150, -380];
    return {
      pos: [A, B], frame, t0: 0,
      look: [{ t: 0, p: [500, 150, -350], w: 1 }, { t: 9.99, p: [500, 150, -350], w: 1 },
        { t: 10.0, d: [-0.30, -0.05, 0.95], w: 1 }, { t: 11.2, d: [-0.32, -0.08, 0.94], w: 1 }, { t: 14.4, d: [-0.42, -0.86, 0.30], w: 1 }, { t: 16.0, d: [-0.40, -0.88, 0.26], w: 1 },
        { t: 16.6, d: [-0.05, -0.99, 0.12], w: 1 }, { t: 18.6, d: [0, -0.99, 0.14], w: 1 }, { t: 19.3, d: [0, -0.5, 0.86], w: 0.3 }, { t: 19.8, d: [0, 0, 1], w: 0 },
        { t: 23.5, p: CITY, w: 0 }, { t: 24.4, p: CITY, w: 1 }, { t: 30.0, p: CITY, w: 1 }, { t: 30.8, p: CITY, w: 0 },
        { t: 37.7, p: [500, 0, -520], w: 0 }, { t: 38.9, p: [500, 0, -520], w: 1 }, { t: 41.5, p: [500, 0, -480], w: 1 }],
      boost: [[21.4, 0], [21.9, 1], [23.7, 1], [24.1, 0], [30.2, 0], [30.9, 1], [34.6, 1], [35.2, 0.6], [35.8, 1], [38.0, 1], [38.8, 0]],
      ev: [[6.25, () => startBuild(500, -900, 520)], [9.3, strike(120, 320)], [12.6, farFlash(1100, 1.5)], [26.3, strike(300, 900)], [33.3, farFlash(500, 1.8)],
        [37.7, () => master.gain.setTargetAtTime(0.0001, AC.currentTime, 0.42)], [39.0, cloudFlash(250, 760, -900, 1.1)]],
    };
  },
};
