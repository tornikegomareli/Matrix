// Scripted camera tours for Code City. The page loads this file when its address has ?tour=film, ?tour=reel or ?tour=loop (over http, not file://)
// and runs it inside its own module, so a tour can drive the camera and the world directly.
//   film   41 seconds: text on black, digital rain, the city builds itself, a rooftop, the jump, bullet time, a run, the clouds
//   reel   70 seconds: a look around, the street, a train, the recompile wave, a spire, the sky, the dive from the top
//   loop   45 seconds: a fall, time rewinds, one long take through an alley, a corridor and a stairwell to a roof, a blackout,
//          the city folds over, time runs backwards, and the fall again
// A click starts a tour, because a browser plays no sound before one. Esc ends it. After a tour the page flies by itself again.
// The paths are written for the seed C0DEC17E, and each scene sets the world clock, so the clouds stand where its path expects them.
// A tour starts the music of the page from its beginning.
(() => {
  const D = window.__tourDef, V = THREE.Vector3;
  const LISTS = { film: [['film', 41.3]], reel: [['city', 26], ['train', 6.8], ['wave', 6.6], ['sky', 30.6]], loop: [['loop', 45.2]] };
  const list = LISTS[D.scene];
  if (!list) { console.warn('tour: there is no tour named ' + D.scene); return; }
  if (seedHex() !== 'C0DEC17E') { location.hash = 'seed=C0DEC17E'; location.reload(); return; }
  const M = [0.4082, 0.4082, -0.8165];                              // moon direction (from the sky shader)
  const pageStep = stepCine, keep = { glitch: S.glitch };
  const W0 = { film: 55, city: 0, train: 100, wave: 200, sky: 1090, loop: 300 };   // the world clock at the start of each scene

  // ── overlays ──
  const els = [], GREEN = '#39ff7a', MONO = 'ui-monospace,"SF Mono",Menlo,Consolas,monospace';
  const mk = css => { const e = document.createElement('div'); e.style.cssText = css; document.body.append(e); els.push(e); return e; };
  const fader = mk('position:fixed;inset:0;z-index:19;background:#000;opacity:0;pointer-events:none');
  const TEXT_CSS = `position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 7.5vh ${MONO};color:${GREEN};text-shadow:0 0 2.2vh rgba(57,255,122,.8);white-space:pre;letter-spacing:.06em`;
  // text typed on black, one letter at a time, in silence
  const typeText = (el, text, t, t0, dt) => {
    const n = clamp(Math.floor((t - t0) / dt) + 1, 0, text.length);
    const cur = (n > 0 && n < text.length) || Math.floor(t / 0.45) % 2 === 0;
    el.innerHTML = text.slice(0, n) + `<span style="display:inline-block;width:.6em;height:1.05em;margin-left:.1em;vertical-align:-.16em;background:${GREEN};box-shadow:0 0 2.2vh ${GREEN};opacity:${cur ? 1 : 0}"></span>`;
  };

  // ── events ──
  const flashAt = (lx, lz, y, amp, strike, hy) => {
    U.uFlashPos.value.set(lx, hy === undefined ? CLOUD_Y + 90 : hy, lz); U.uFlashDir.value.set(lx - P.pos.x, 420, lz - P.pos.z).normalize();
    fx.flashT = 0; fx.flashAmp = amp; fx.nextFlash = 9 + Math.random() * 6;
    thunder(Math.hypot(lx - P.pos.x, y - P.pos.y, lz - P.pos.z), amp, (lx - P.pos.x) * Math.cos(P.yaw) - (lz - P.pos.z) * Math.sin(P.yaw), strike);
  };
  const farFlash = (dist, amp) => () => {
    const f = camera.getWorldDirection(new V()), l = Math.hypot(f.x, f.z) || 1;
    fx.bolt = null; flashAt(P.pos.x + f.x / l * dist - f.z / l * dist * 0.3, P.pos.z + f.z / l * dist + f.x / l * dist * 0.3, CLOUD_Y, amp, false);
  };
  const strike = (dMin, dMax) => () => {                            // a bolt on the mast that is most in front of the camera
    const f = camera.getWorldDirection(new V()); let best = null, bs = -1;
    for (const ch of chunks.values()) for (const c of ch.cells) for (const b of c.beacons) {
      const dx = b[0] - P.pos.x, dy = b[1] - P.pos.y, dz = b[2] - P.pos.z, d = Math.hypot(dx, dz);
      if (d < dMin || d > dMax || b[1] > CLOUD_Y - 60) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / Math.hypot(dx, dy, dz);
      if (dot > bs) { bs = dot; best = b; }
    }
    if (!best) return;
    fx.bolt = makeBolt(best[0], best[1], best[2]);
    flashAt(fx.bolt.top[0], fx.bolt.top[2], best[1], 2.3, true);
  };
  const cloudFlash = (x, y, z, amp) => () => { fx.bolt = null; flashAt(x, z, y, amp, false, y); };   // lightning inside a cloud: it glows, with no bolt
  const waveDir = (dx, dz) => () => {
    startWave();
    if (dx !== undefined) { wave.dx = dx; wave.dz = dz; U.uWave.value.x = dx; U.uWave.value.y = dz; }
  };
  const standing = () => { build.auto = false; build.on = false; U.uBuild.value.w = 0; };      // the scene starts in a city that already stands
  const unbuilt = (x, z) => { build.auto = false; build.on = true; build.speed = 0; build.r = 0; U.uBuild.value.set(x, z, 0, 1); };   // nothing stands yet

  // ── scenes ──
  const scenes = {
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
      const off = hash01(SEED ^ 0x77A2, 1, line) * 760, head = t => off + dir * 36 * (worldT + t + 0.9);   // head of train k = 0 at tour time t (the scene starts at -0.9)
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

  // ── the current scene and its path ──
  let sc = null, SEGS = null, K = null, segI = 0, li = 0, done = false;
  const tmp2 = new V();
  const st = window.__tour = { t: 0, n: 0, go: false, f: new V(0, 0, 1), right: new V(1, 0, 0), roll: 0, head: 0, evi: 0 };
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
  const lin = (keys, t) => {
    if (!keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) if (t < keys[i + 1][0]) return lerp(keys[i][1], keys[i + 1][1], smooth(keys[i][0], keys[i + 1][0], t));
    return keys[keys.length - 1][1];
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
    li = i; worldT = W0[list[i][0]]; sc = scenes[list[i][0]]();
    SEGS = Array.isArray(sc.pos[0][0]) ? sc.pos : [sc.pos]; K = SEGS[0]; segI = 0;
    sc.ev.sort((a, b) => a[0] - b[0]);
    st.t = sc.t0 !== undefined ? sc.t0 : -0.9; st.n = 0; st.evi = 0;
    evalPos(st.t, P.pos); camera.position.copy(P.pos); P.vel.set(0, 0, 0); resetTraffic(P.pos.x, P.pos.z);
    if (i > 0) started = false;                                    // load the whole neighbourhood at once, behind the black
  };
  const onKey = e => {                                              // the page's keys rest while a tour runs
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    if (!asked) go(); else if (e.code === 'Escape' && st.go) finish();
  };
  const finish = () => {                                            // hand the camera back to the page's own cinematic flight
    if (done) return; done = true;
    if (sc.end) sc.end();
    stepCine = pageStep; removeEventListener('keydown', onKey, true); keys.KeyF = false; cine.pan = 0;
    S.glitch = keep.glitch; refreshUI(); fx.nextFlash = 5; started = true;
    canvas.style.cursor = ''; $('ui').style.display = ''; $('hint').style.display = ''; $('hint').classList.remove('fade');
    setTimeout(() => $('hint').classList.add('fade'), 6000);
    master.gain.setTargetAtTime(0.42, AC.currentTime, 1.2);
    for (const e of els) e.remove();
    startCine();
  };

  const p = new V(), q = new V(), f2 = new V(), tg = new V(), up = new V(), ut = new V(), back = new V(), m4 = new THREE.Matrix4(), qr = new THREE.Quaternion();
  stepCine = function (dt, rdt) {
    if (!st.go) { camera.position.copy(P.pos); return; }             // waiting for the click
    st.t += rdt; st.n++;
    if (st.n === (li > 0 || sc.now ? 3 : 20)) { started = true; if (li > 0 || sc.now) fade = 1; }   // now: the scene opens on a full picture
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

  // ───────────────────────── the third film: you have been here before ─────────────────────────
  scenes.loop = () => {
    S.glitch = 0; refreshUI(); standing();
    const RAD = 900 / Math.PI, HINGE = 650;                           // the fold: half a turn is 900 m of street, so the streets of the two layers meet
    const L = [514.2, 187.7, -370], F = [0.574, 0, 0.819];           // where the film lands on the roof, and where it faces there
    const yawF = Math.atan2(-F[0], -F[2]);
    const WHITE = 'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:300;color:#fff;letter-spacing:.04em;text-align:center';
    const card = mk(`position:fixed;inset:0;z-index:21;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:5vh;${WHITE};opacity:0`);
    const sub = mk(`position:fixed;left:0;right:0;bottom:9vh;z-index:21;pointer-events:none;font-size:3.1vh;${WHITE};text-shadow:0 0 1.2vh #000,0 0 .4vh #000;opacity:0`);
    const black = mk('position:fixed;inset:0;z-index:20;background:#000;pointer-events:none;display:none');
    const show = (el, text, a) => { if (el._t !== text) { el._t = text; el.textContent = text; } el.style.opacity = a; };

    // ── the set: a doorway in the alley wall, a neon corridor, a stairwell to the roof, and things in the alley ──
    // The city has no rooms. These are boxes with a material of their own, inside the tower at x 513.5..551, z -386.5..-348.9.
    const SET_GL = /* glsl */`
vec3 pal(float i){ return i < 0.5 ? vec3(1.0, 0.62, 0.30) : i < 1.5 ? vec3(0.25, 0.85, 1.0) : i < 2.5 ? vec3(1.0, 0.20, 0.55) : i < 3.5 ? vec3(0.30, 1.0, 0.45) : vec3(0.85, 0.95, 0.90); }
// the light of the set at p: the tubes of the corridor, the lamps of the stairwell, and the local lamps
vec3 setLight(vec3 p, vec3 n){
  vec3 s = localLight(p, n);
  if (p.x > 528.0 && p.x < 532.0 && p.z > -367.6 && p.z < -348.8 && p.y < 3.1) {              // corridor: a tube every 3.1 m
    float k = floor((-350.6 - p.z) / 3.1 + 0.5);
    for (float j = -1.0; j < 1.5; j += 1.0) {
      float kk = k + j; if (kk < 0.0 || kk > 5.0) continue;
      vec3 d = vec3(529.9, 2.7, -350.6 - 3.1 * kk) - p; float r = length(d), a = max(1.0 - r / 6.5, 0.0);
      s += pal(mod(kk, 2.0) + 1.0) * 2.0 * a * a * max(dot(n, d / r) * 0.7 + 0.3, 0.0);
    }
  } else if (p.x > 525.3 && p.x < 534.5 && p.z > -376.6 && p.z < -367.4 && p.y < 186.4) {     // stairwell: four tubes of light stand in its well, from the floor to the roof
    for (int j = 0; j < 4; j++) {
      vec2 d = vec2(j < 2 ? 526.85 : 532.95, (j == 0 || j == 3) ? -375.05 : -368.95) - p.xz; float r = length(d), a = max(1.0 - r / 9.0, 0.0);
      s += pal(j == 0 || j == 2 ? 1.0 : 2.0) * 0.9 * a * a * max(dot(n.xz, d / r) * 0.7 + 0.3, 0.0);
    }
  } else if (abs(p.x - 500.0) < 14.0 && p.z > -153.0 && p.z < -147.0 && p.y > 8.9 && p.y < 14.0) {     // the footbridge: one long lamp under its roof
    vec2 d = vec2(13.5 - p.y, -150.0 - p.z); float r = length(d), a = max(1.0 - r / 6.0, 0.0);
    s += pal(4.0) * 1.1 * a * a * max(dot(n.yz, d / r) * 0.7 + 0.3, 0.0);
  }
  return s;
}
`;
    const SET_VS = /* glsl */`
attribute vec3 iPos; attribute vec3 iSize; attribute vec4 iPar; attribute vec3 iBld;
varying vec3 vWP; varying vec3 vN; varying vec4 vPar;
void main(){
  vWP = position * iSize + iPos; vN = normal; vPar = iPar;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWP, 1.0);
}`;
    const SET_FS = SET_GL + /* glsl */`
varying vec3 vWP; varying vec3 vN; varying vec4 vPar;
void main(){
  bool front = gl_FrontFacing; if (uMirror < 0.0) front = !front;
  if (!front) discard;
  vec3 n = normalize(vN), V = normalize(cameraPosition - vWP);
  float seed = vPar.x, mat = vPar.y, gloss = 0.12;
  bool top = abs(n.y) > 0.5;
  vec2 uv = top ? vWP.xz : vec2(abs(n.x) > 0.5 ? vWP.z : vWP.x, vWP.y);                         // metres on the face
  vec3 col = vec3(0.0), emis = vec3(0.0);
  if (mat < 0.5) {                                                                             // concrete: panels with seams, stains that run down, a painted band
    col = vec3(0.15, 0.155, 0.16) * (0.62 + 0.45 * vn(uv * 1.7 + seed * 9.0) + 0.1 * vn(uv * 9.0));
    vec2 pq = abs(fract(uv / vec2(2.4, 3.6)) - 0.5);
    col *= 0.8 + 0.2 * smoothstep(0.0, 0.012, 0.5 - max(pq.x, pq.y));
    if (!top) { col *= 1.0 - 0.45 * smoothstep(0.45, 0.9, vn(vec2(uv.x * 3.0, uv.y * 0.22) + seed)); col = mix(col, col * vec3(0.45, 0.62, 0.55), step(fract(uv.y / 3.6), 0.3)); }
  } else if (mat < 1.5) {                                                                      // floor tiles, wet
    vec2 tq = abs(fract(uv / 0.6) - 0.5);
    col = mix(vec3(0.045), vec3(0.12, 0.125, 0.13), mod(floor(uv.x / 0.6) + floor(uv.y / 0.6), 2.0)) * (0.7 + 0.5 * vn(uv * 3.0));
    col *= 0.7 + 0.3 * smoothstep(0.0, 0.03, 0.5 - max(tq.x, tq.y)); gloss = 0.8;
  } else if (mat < 2.5) { col = vec3(0.075, 0.08, 0.085) * (0.85 + 0.25 * vn(uv * 5.0 + seed * 30.0)); gloss = 0.5; }   // dark metal
  else if (mat < 3.5) emis = pal(vPar.z) * vPar.w;                                             // a tube or a lamp
  else if (mat < 4.5) { col = vec3(0.045, 0.075, 0.07) * (0.7 + 0.4 * vn(uv * 4.0 + seed)); gloss = 0.35; }          // a painted door
  else {                                                                                       // a sign: rows of glyphs
    float cs = 0.4; vec2 gp = vec2(uv.x, -uv.y), c = gp / cs, id = floor(c), f2 = fract(c);
    float chg = floor(uTime * (0.3 + 0.8 * h21(id + seed)) + h21(id * 1.7 + seed) * 9.0);
    float gl = glyph(vec2(f2.x, 1.0 - f2.y), floor(h21(id + vec2(chg * 3.1, seed * 19.0)) * 64.0), dFdx(gp) / cs * vec2(1.0, -1.0), dFdy(gp) / cs * vec2(1.0, -1.0));
    col = vec3(0.012); emis = pal(vPar.z) * vPar.w * (gl * 1.7 + 0.05);
  }
  vec3 light = uFogCol * 1.5 + setLight(vWP, n);
  if (!indoors(vWP)) light += C_FLASH * uFlash * (0.2 + 0.8 * max(dot(n, uFlashDir), 0.0)) + C_LAMP * exp(-max(vWP.y, 0.0) / 14.0) * 0.1 + C_GLOW * 0.03 * max(n.y, 0.0);
  vec3 R = reflect(-V, n); float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
  vec3 spec = setLight(vWP + R * 1.6, R) * gloss * (0.2 + 0.8 * fres);                           // a wet or polished face throws the lamps back
  gl_FragColor = vec4(applyFog(col * light + spec * 0.4 + emis, vWP), 1.0);
}`;
    const matSet = mkMat(SET_VS, SET_FS, null, { side: THREE.DoubleSide });
    const rows = [], rnd = mulberry32(0x5E7);
    const box = (x0, x1, y0, y1, z0, z1, mat, a, b) => rows.push([(x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, rnd(), mat, a || 0, b || 0, 1e7, 1e7]);
    const XA = 525.4, XB = 534.4, ZA = -376.5, ZB = -367.5, TOP = 186;     // the stairwell
    // corridor, from the doorway (z -348.9) north to the stairwell
    box(528.4, 531.4, -0.02, 0.04, -367.3, -349.0, 1); box(528.2, 531.6, 2.8, 3.0, -367.3, -349.0, 0);
    box(528.2, 528.4, 0, 2.8, -367.3, -349.0, 0); box(531.4, 531.6, 0, 2.8, -367.3, -349.0, 0);
    box(528.4, 529.0, 0, 2.8, -349.2, -349.0, 0); box(530.8, 531.4, 0, 2.8, -349.2, -349.0, 0); box(529.0, 530.8, 2.3, 2.8, -349.2, -349.0, 0);   // the wall around the doorway
    box(528.92, 529.0, 0, 2.38, -349.02, -348.78, 2); box(530.8, 530.88, 0, 2.38, -349.02, -348.78, 2); box(528.92, 530.88, 2.3, 2.38, -349.02, -348.78, 2);   // door frame
    box(530.84, 530.9, 0, 2.3, -348.8, -347.05, 4);                                                                      // the door stands open into the alley
    box(529.6, 530.2, 2.52, 2.66, -348.78, -348.6, 3, 0, 7);                                                              // lamp over the door
    for (let k = 0; k < 6; k++) box(529.2, 530.6, 2.72, 2.78, -350.64 - 3.1 * k, -350.56 - 3.1 * k, 3, k % 2 + 1, 3.4);      // tubes
    box(528.4, 528.46, 1.45, 2.3, -353.7, -351.5, 5, 2, 3); box(531.34, 531.4, 1.5, 2.3, -359.3, -357.2, 5, 1, 3); box(528.4, 528.46, 1.5, 2.25, -364.9, -363.0, 5, 3, 3);   // signs
    box(528.4, 528.45, 0, 2.1, -357.3, -356.3, 4); box(531.35, 531.4, 0, 2.1, -354.4, -353.4, 4); box(531.35, 531.4, 0, 2.1, -363.6, -362.6, 4);    // side doors
    box(531.12, 531.3, 2.55, 2.7, -367.3, -349.2, 2); box(528.5, 528.62, 2.6, 2.7, -367.3, -349.2, 2);                      // pipes under the ceiling
    box(531.0, 531.4, 0, 0.5, -351.9, -351.3, 2); box(528.4, 528.8, 0, 0.7, -360.6, -359.9, 2); box(528.4, 528.75, 0, 0.4, -366.2, -365.5, 2);   // crates
    // stairwell: four walls (the south one has the opening), a floor, a stair that winds up the walls, four tubes of light in the well
    box(XA - 0.2, XB + 0.2, 0, TOP, ZA - 0.2, ZA, 0); box(XB, XB + 0.2, 0, TOP, ZA, ZB, 0); box(XA - 0.2, XA, 0, TOP, ZA, ZB, 0);
    box(XA, 528.4, 0, TOP, ZB, ZB + 0.2, 0); box(531.4, XB, 0, TOP, ZB, ZB + 0.2, 0); box(528.4, 531.4, 2.8, TOP, ZB, ZB + 0.2, 0);
    box(XA, XB, -0.02, 0.05, ZA, ZB, 1);
    const SL = (XB - XA) / 7, SD = 1.3, RISE = 3.6 / 28;
    for (let i = 7; i < 28 * 51 + 20; i++) {
      const side = Math.floor(i / 7) % 4, c = (i % 7 + 0.5) * SL, h = (i + 1) * RISE; if (h > TOP - 0.4) break;
      if (side === 0) { box(XA + c - SL / 2, XA + c + SL / 2, h - 0.16, h, ZB - SD, ZB, 2); box(XA + c - SL / 2, XA + c + SL / 2, h, h + 0.95, ZB - SD - 0.06, ZB - SD, 2); }
      else if (side === 1) { box(XB - SD, XB, h - 0.16, h, ZB - c - SL / 2, ZB - c + SL / 2, 2); box(XB - SD - 0.06, XB - SD, h, h + 0.95, ZB - c - SL / 2, ZB - c + SL / 2, 2); }
      else if (side === 2) { box(XB - c - SL / 2, XB - c + SL / 2, h - 0.16, h, ZA, ZA + SD, 2); box(XB - c - SL / 2, XB - c + SL / 2, h, h + 0.95, ZA + SD, ZA + SD + 0.06, 2); }
      else { box(XA, XA + SD, h - 0.16, h, ZA + c - SL / 2, ZA + c + SL / 2, 2); box(XA + SD, XA + SD + 0.06, h, h + 0.95, ZA + c - SL / 2, ZA + c + SL / 2, 2); }
    }
    for (const [tx, tz, c] of [[526.85, -375.05, 1], [526.85, -368.95, 2], [532.95, -368.95, 1], [532.95, -375.05, 2]]) box(tx - 0.035, tx + 0.035, 0.3, TOP - 0.6, tz - 0.035, tz + 0.035, 3, c, 3.2);
    // the hatch in the roof: a curb, posts and rails, and a lamp
    const HX0 = 527.0, HX1 = 532.8, HZ0 = -374.9, HZ1 = -369.1;
    box(HX0 - 0.25, HX1 + 0.25, TOP, TOP + 0.35, HZ0 - 0.25, HZ0, 0); box(HX0 - 0.25, HX1 + 0.25, TOP, TOP + 0.35, HZ1, HZ1 + 0.25, 0);
    box(HX0 - 0.25, HX0, TOP, TOP + 0.35, HZ0, HZ1, 0); box(HX1, HX1 + 0.25, TOP, TOP + 0.35, HZ0, HZ1, 0);
    for (const [px, pz] of [[HX0 - 0.15, HZ0 - 0.15], [HX1 + 0.1, HZ0 - 0.15], [HX0 - 0.15, HZ1 + 0.1], [HX1 + 0.1, HZ1 + 0.1]]) box(px, px + 0.06, TOP + 0.35, TOP + 1.25, pz, pz + 0.06, 2);
    box(HX0 - 0.15, HX1 + 0.16, TOP + 1.2, TOP + 1.25, HZ0 - 0.15, HZ0 - 0.09, 2); box(HX0 - 0.15, HX1 + 0.16, TOP + 1.2, TOP + 1.25, HZ1 + 0.1, HZ1 + 0.16, 2);
    box(HX1 + 0.1, HX1 + 0.16, TOP + 1.2, TOP + 1.25, HZ0 - 0.15, HZ1 + 0.16, 2);
    box(526.37, 526.43, TOP, TOP + 2.0, -368.63, -368.57, 2); box(526.3, 526.5, TOP + 2.0, TOP + 2.25, -368.7, -368.5, 3, 4, 8);
    box(518.57, 518.63, TOP, TOP + 2.0, -360.13, -360.07, 2); box(518.5, 518.7, TOP + 2.0, TOP + 2.25, -360.2, -360.0, 3, 4, 8);   // a lamp by the stack
    box(521.57, 521.63, TOP, TOP + 2.0, -371.33, -371.27, 2); box(521.5, 521.7, TOP + 2.0, TOP + 2.25, -371.4, -371.2, 3, 4, 8);
    // the alley: bins, pipes, boxes on the walls, two signs
    box(516.6, 518.6, 0, 1.25, -344.3, -343.2, 2); box(516.55, 518.65, 1.25, 1.33, -344.35, -343.15, 2); box(538.2, 540.2, 0, 1.25, -348.8, -347.7, 2); box(538.15, 540.25, 1.25, 1.33, -348.85, -347.65, 2);
    box(520.5, 523.0, 2.6, 3.5, -343.22, -343.12, 5, 2, 4); box(520.4, 523.1, 3.5, 3.56, -343.3, -343.1, 3, 2, 4); box(520.4, 523.1, 2.54, 2.6, -343.3, -343.1, 3, 2, 4);
    box(541.0, 543.2, 2.4, 3.2, -348.88, -348.78, 5, 3, 3.5);
    box(521.0, 522.0, 3.2, 3.9, -348.85, -348.25, 2); box(534.5, 535.5, 3.4, 4.1, -348.85, -348.25, 2); box(526.0, 527.0, 3.0, 3.7, -343.75, -343.15, 2);
    box(513.6, 550.9, 4.4, 4.52, -348.84, -348.72, 2); box(513.6, 550.9, 5.0, 5.1, -343.26, -343.16, 2); box(525.0, 525.14, 0, 14, -348.86, -348.72, 2); box(532.6, 532.74, 0, 14, -343.28, -343.14, 2);
    box(531.6, 532.4, 0, 0.6, -348.75, -348.05, 2); box(531.7, 532.3, 0.6, 1.1, -348.7, -348.1, 2);
    box(519.3, 519.7, 3.3, 3.42, -348.86, -348.5, 3, 0, 6); box(519.46, 519.54, 3.42, 3.5, -348.88, -348.5, 2);   // a lamp on the wall, where the cat crosses
    // a footbridge over the avenue at z -150, with glass on its north side. The film flies through it while time runs backwards
    box(486.5, 513.5, 9.2, 9.6, -152.2, -147.8, 0); box(486.3, 513.7, 13.6, 13.8, -152.5, -147.5, 2);
    for (const px of [487.0, 512.0]) { box(px, px + 1.0, 0, 9.2, -150.6, -149.4, 0); box(px + 0.35, px + 0.65, 9.6, 13.6, -150.15, -149.85, 2); }
    for (let i = 0; i <= 10; i++) { const mx = 487.5 + 2.5 * i; box(mx - 0.04, mx + 0.04, 9.6, 13.6, -148.07, -147.93, 2); box(mx - 0.025, mx + 0.025, 9.6, 10.7, -152.03, -151.97, 2); }
    box(487.5, 512.5, 10.66, 10.72, -152.04, -151.96, 2); box(487.5, 512.5, 9.6, 9.68, -148.07, -147.93, 2); box(487.5, 512.5, 13.52, 13.6, -148.07, -147.93, 2);
    box(488.5, 511.5, 13.5, 13.56, -150.1, -149.9, 3, 4, 2.6);
    const setGeo = instGeo(geoBox, rows.length, BOX_LAYOUT);
    setGeo.instanceCount = writeRows(setGeo, rows, 0, rows.length, 0);
    for (const k in setGeo.attributes) if (setGeo.attributes[k].isInstancedBufferAttribute) setGeo.attributes[k].needsUpdate = true;
    const setMesh = addMesh(setGeo, matSet);
    // what the set needs from the world: two cuts in the tower, its inside counted as indoors, lamps, steam, and a car at the kerb
    U.uHoleA.value[0].set(528.95, -0.5, -349.25); U.uHoleB.value[0].set(530.85, 2.33, -348.55);
    U.uHoleA.value[1].set(HX0, TOP - 0.5, HZ0); U.uHoleB.value[1].set(HX1, TOP + 0.5, HZ1);
    U.uInA.value.set(513.55, -1, -386.45); U.uInB.value.set(550.95, TOP - 0.05, -348.95);
    const lamp = (i, x, y, z, reach, r, g, b, zone) => { U.uPL.value[i].set(x, y, z, reach); U.uPLc.value[i].set(r, g, b, zone); };
    let lampsOf = null;
    const lamps = roof => {                                          // six lamps at most burn at one time: those of the alley, or those of the roof. Number 2 is the flame of the lighter
      if (lampsOf === roof) return;
      lampsOf = roof;
      if (roof) { lamp(0, 518.6, 188.2, -360.1, 10, 1.3, 1.7, 1.5, 0); lamp(1, 526.4, 188.0, -368.6, 9, 1.1, 1.5, 1.3, 0); lamp(3, 521.6, 188.2, -371.3, 9, 1.0, 1.3, 1.15, 0); lamp(4, 0, -99, 0, 1, 0, 0, 0, 0); }
      else { lamp(0, 529.9, 2.5, -348.1, 9, 2.6, 1.5, 0.6, 0); lamp(1, 521.75, 3.0, -344.0, 11, 2.6, 0.6, 1.6, 0); lamp(3, 542.1, 2.8, -348.0, 7, 0.5, 1.6, 0.7, 0); lamp(4, 519.5, 3.3, -348.5, 10, 1.7, 1.5, 1.0, 0); }
    };
    lamp(2, 0, -99, 0, 3.2, 0, 0, 0, 2); lamp(4, 0, -99, 0, 1, 0, 0, 0, 0); lamp(5, 0, -99, 0, 1, 0, 0, 0, 0); lamps(true);
    U.uPLn.value = 6;
    const cell = getCell(5, -4), vents0 = cell.vents.length;
    cell.vents.push([522.5, 0.1, -346.8, 1], [535, 0.1, -345.2, 1], [528.2, 2.3, -348.6, 0.5]); steamDirty = true;
    extraCars.push({ x: 509.3, z: -331, a: -Math.PI / 2, seed: 0.5, brake: 1 });                 // the car that sounds its horn, at the kerb
    const endSet = () => {
      scene.remove(setMesh); setGeo.dispose(); matSet.dispose();
      for (let i = 0; i < 2; i++) { U.uHoleA.value[i].set(1e9, 1e9, 1e9); U.uHoleB.value[i].set(-1e9, -1e9, -1e9); }
      U.uInA.value.set(1e9, 1e9, 1e9); U.uInB.value.set(-1e9, -1e9, -1e9); U.uPLn.value = 0;
      cell.vents.length = vents0; steamDirty = true; extraCars.length = 0;
    };

    // ── people and a cat. Each is a box; its fragment shader marches a ray through a figure made of rounded shapes ──
    const FIG_VS = /* glsl */`
attribute vec4 iFig; attribute vec4 iFig2;          // feet x, y, z + heading; kind (0 passer-by, 1 cook, 2 cat), start of its loop on the world clock, seed, scale
varying vec3 vWP; varying vec4 vFig; varying vec4 vFig2;
void main(){
  if (uMirror < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }                     // figures are not in the mirror picture of the street
  vec3 lp = position * (iFig2.x > 1.5 ? vec3(0.5, 0.62, 1.0) : vec3(1.0, 2.2, 1.1)) * iFig2.w;
  float c = cos(iFig.w), s = sin(iFig.w);
  vWP = vec3(lp.x * c + lp.z * s, lp.y, lp.z * c - lp.x * s) + iFig.xyz;
  vFig = iFig; vFig2 = iFig2;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWP, 1.0);
}`;
    const FL = [0.012, 1.572, 0.186];                                   // the flame of the lighter, in the cook's own space
    const FIG_FS = SET_GL + /* glsl */`
varying vec3 vWP; varying vec4 vFig; varying vec4 vFig2;
float gT, gSeed, gKind, gArm, gArmL, gTel, gHat;
vec2 gLean, gYaw, gNod;                                                                        // cosine and sine of the lean of the body, and of the turn and the nod of the head
const vec3 FLP = vec3(${FL[0]}, ${FL[1]}, ${FL[2]});
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
float sdEll(vec3 p, vec3 c, vec3 r){ p -= c; float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-4); }
float sdBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
// a standing person, 1.8 m, facing +z. Returns the distance and the material:
// 0 dark cloth, 1 skin, 2 white cloth, 3 hat or hair, 5 paper, 6 metal, 7 a lit screen
vec2 person(vec3 p){
  float cook = step(0.5, gKind), m = cook * 2.0;
  p.yz = vec2(p.y * gLean.x - p.z * gLean.y, p.z * gLean.x + p.y * gLean.y);                  // some lean back against the wall
  p.x -= sin(uTime * 0.9 + gSeed * 40.0) * 0.006 * p.y;                                       // a slow sway
  vec3 ps = vec3(abs(p.x), p.yz);
  float d = sdCap(p, vec3(-0.158, 1.435, -0.012), vec3(0.158, 1.435, -0.012), 0.062);          // shoulders
  d = smin(d, sdEll(p, vec3(0.0, 1.27, 0.0), vec3(0.168, 0.2, 0.105)), 0.05);                 // chest
  d = smin(d, sdEll(p, vec3(0.0, 1.03, 0.004), vec3(0.152, 0.2, 0.1)), 0.05);                 // belly and hips
  if (cook > 0.5) d = smin(d, sdBox(p - vec3(0.0, 0.82, 0.07), vec3(0.14, 0.3, 0.018), 0.025), 0.03);   // the apron, from the waist to the knee
  else {
    float yy = clamp((1.25 - p.y) / 0.85, 0.0, 1.0);                                          // a long coat
    float coat = (length(p.xz / vec2(mix(0.168, 0.215, yy), mix(0.105, 0.15, yy))) - 1.0) * 0.105;
    d = smin(d, max(coat, max(0.4 - p.y, p.y - 1.25)), 0.04);
    float col = length(vec2(length((p.xz - vec2(0.0, -0.012)) * vec2(1.0, 1.12)) - 0.08, p.y - 1.5)) - 0.021;   // its collar, turned up
    d = smin(d, max(col, p.z - 0.05), 0.02);
  }
  float legs = min(sdCap(ps, vec3(0.088, 0.95, 0.0), vec3(0.092, 0.1, 0.0), 0.068), sdEll(ps, vec3(0.092, 0.042, 0.045), vec3(0.05, 0.044, 0.125)));
  if (legs < d) m = 0.0;
  d = smin(d, legs, 0.02);
  // arms: down with the hands in the pockets, or up to a telephone, or up to the cigarette
  vec3 eR = mix(vec3(0.255, 1.16, -0.03), cook > 0.5 ? vec3(0.25, 1.25, 0.1) : vec3(0.255, 1.13, 0.05), gArm);
  vec3 wR = mix(vec3(0.2, 0.95, 0.07), cook > 0.5 ? vec3(0.05, 1.468, 0.172) : vec3(0.11, 1.22, 0.25), gArm);
  vec3 eL = mix(vec3(-0.255, 1.16, -0.03), vec3(-0.27, 1.26, 0.09), gArmL), wL = mix(vec3(-0.2, 0.95, 0.07), vec3(-0.06, 1.5, 0.19), gArmL);
  float arms = min(min(sdCap(p, vec3(0.205, 1.43, -0.012), eR, 0.052), sdCap(p, eR, wR, 0.043)), min(sdCap(p, vec3(-0.205, 1.43, -0.012), eL, 0.052), sdCap(p, eL, wL, 0.043)));
  if (arms < d) m = cook * 2.0;
  d = smin(d, arms, 0.025);
  if (cook > 0.5) {                                                                           // his hands: one holds the lighter, the other shields the flame
    float hands = sdEll(p, wR + mix(vec3(0.0, -0.06, 0.012), vec3(-0.03, 0.035, 0.018), gArm), vec3(0.034, 0.036, 0.03));
    float left = sdEll(p, wL + vec3(0.0, -0.06, 0.012), vec3(0.03, 0.05, 0.035));
    vec3 v = p - FLP;
    if (gArm > 0.9) {                                                                         // a fist round the lighter: four fingers, and the thumb on its wheel
      float yi = clamp(floor((v.y + 0.09) / 0.016 + 0.5), 0.0, 3.0); vec3 w = v - vec3(0.0, -0.09 + 0.016 * yi, 0.0);
      hands = smin(sdEll(v, vec3(0.008, -0.068, 0.004), vec3(0.03, 0.034, 0.026)), min(sdCap(w, vec3(0.034, 0.0, 0.012), vec3(0.012, 0.0, 0.034), 0.0085), sdCap(w, vec3(0.012, 0.0, 0.034), vec3(-0.011, 0.0, 0.021), 0.0082)), 0.012);
      hands = smin(hands, sdCap(v, vec3(0.03, -0.05, 0.012), vec3(0.012, -0.021, 0.008), 0.0095), 0.008);
    }
    if (gArmL > 0.9) {                                                                        // the other hand stands beside the flame, its fingers bent round the front
      float yi = clamp(floor((v.y + 0.04) / 0.0185 + 0.5), 0.0, 3.0); vec3 w = v - vec3(0.0, -0.04 + 0.0185 * yi, 0.0);
      left = smin(sdEll(v, vec3(-0.05, -0.018, 0.0), vec3(0.012, 0.04, 0.034)), min(sdCap(w, vec3(-0.05, 0.0, 0.03), vec3(-0.036, 0.004, 0.062), 0.0088), sdCap(w, vec3(-0.036, 0.004, 0.062), vec3(-0.006, 0.007, 0.073), 0.0082)), 0.006);
      left = smin(left, sdCap(v, vec3(-0.048, 0.02, -0.02), vec3(-0.03, 0.045, 0.002), 0.0105), 0.008);
    }
    hands = min(hands, left);
    if (hands < d) m = 1.0;
    d = smin(d, hands, 0.012);
    if (gArm > 0.9) { float lt = sdBox(p - vec3(0.012, 1.53, 0.186), vec3(0.0105, 0.022, 0.006), 0.001); if (lt < d) m = 6.0; d = min(d, lt); }
  } else if (gTel > 0.5) {
    float hand = sdEll(p, wR + vec3(-0.005, 0.05, 0.015), vec3(0.03, 0.045, 0.028));
    if (hand < d) m = 1.0;
    d = smin(d, hand, 0.01);
    vec3 q = p - vec3(0.1, 1.31, 0.285); q.yz = vec2(q.y * 0.88 + q.z * 0.48, q.z * 0.88 - q.y * 0.48);
    float ph = sdBox(q, vec3(0.034, 0.07, 0.0035), 0.002);
    if (ph < d) m = q.z < 0.0 ? 7.0 : 0.0;
    d = min(d, ph);
  }
  if (length(p - vec3(0.0, 1.72, 0.01)) - 0.37 < d) {                                         // the head, only where the ray is near it
    vec3 q = p - vec3(0.0, 1.52, 0.0);
    q.xz = vec2(q.x * gYaw.x - q.z * gYaw.y, q.z * gYaw.x + q.x * gYaw.y);
    q.yz = vec2(q.y * gNod.x + q.z * gNod.y, q.z * gNod.x - q.y * gNod.y);
    vec3 qs = vec3(abs(q.x), q.yz);
    float head = sdEll(q, vec3(0.0, 0.155, -0.005), vec3(0.077, 0.1, 0.094));                  // skull
    head = smin(head, sdEll(q, vec3(0.0, 0.09, 0.03), vec3(0.058, 0.076, 0.066)), 0.035);     // face and jaw
    head = smin(head, sdCap(q, vec3(0.0, 0.15, 0.086), vec3(0.0, 0.116, 0.112), 0.0105), 0.012);    // nose
    head = smin(head, sdEll(qs, vec3(0.03, 0.173, 0.081), vec3(0.03, 0.008, 0.012)), 0.014);    // brows
    head = smin(head, sdEll(q, vec3(0.0, 0.068, 0.083), vec3(0.021, 0.008, 0.011)), 0.01);       // lips
    head = -smin(-head, length(qs - vec3(0.031, 0.148, 0.09)) - 0.017, 0.012);                // the hollows of the eyes
    head = min(head, sdEll(qs, vec3(0.078, 0.13, 0.0), vec3(0.011, 0.028, 0.018)));           // ears
    head = smin(head, sdCap(p, vec3(0.0, 1.44, -0.012), vec3(0.0, 1.575, 0.0), 0.046), 0.02); // neck
    if (head < d) m = q.y > 0.172 + 0.6 * q.z ? 3.0 : 1.0;                                    // hair above the line of the brow and the ears
    d = smin(d, head, 0.015);
    if (cook > 0.5) {                                                                         // the cook: a tall cap, and a cigarette
      float cap = smin(max(length(q.xz - vec2(0.0, -0.005)) - 0.092, abs(q.y - 0.24) - 0.04), sdEll(q, vec3(0.0, 0.335, -0.008), vec3(0.118, 0.075, 0.118)), 0.03);
      if (cap < d) m = 2.0;
      d = min(d, cap);
      float cig = sdCap(q, vec3(0.0, 0.065, 0.085), vec3(0.0, 0.058, 0.178), 0.0042);
      if (cig < d) m = 5.0;
      d = min(d, cig);
    } else if (gHat > 0.5) {                                                                  // a hat with a brim
      float hat = min(max(length(q.xz - vec2(0.0, 0.012)) - 0.168, abs(q.y - 0.214) - 0.005),
        max(length((q.xz - vec2(0.0, 0.004)) * vec2(1.0, 0.92)) - mix(0.096, 0.084, clamp((q.y - 0.214) / 0.1, 0.0, 1.0)), abs(q.y - 0.265) - 0.05)) - 0.007;
      if (hat < d) m = 3.0;
      d = min(d, hat);
    }
  }
  return vec2(d, m);
}
// a cat at a trot, half a metre long, facing +z. Material 4: black fur
vec2 cat(vec3 p){
  float ph = gT * 17.0;
  p.y -= 0.005 * sin(ph * 2.0);
  float d = sdEll(p, vec3(0.0, 0.215, 0.0), vec3(0.068, 0.076, 0.19));
  d = smin(d, length(p - vec3(0.0, 0.235, 0.15)) - 0.062, 0.04);
  vec3 hp = p - vec3(0.0, 0.3, 0.235);
  hp.xz = vec2(hp.x * gYaw.x - hp.z * gYaw.y, hp.z * gYaw.x + hp.x * gYaw.y);               // it turns its head to you
  vec3 hs = vec3(abs(hp.x), hp.yz);
  float head = smin(sdEll(hp, vec3(0.0), vec3(0.057, 0.052, 0.057)), length(hp - vec3(0.0, -0.016, 0.047)) - 0.027, 0.02);
  head = smin(head, sdCap(hs, vec3(0.033, 0.036, -0.004), vec3(0.047, 0.086, -0.012), 0.0105), 0.018);
  d = smin(d, head, 0.03);
  for (int i = 0; i < 4; i++) {                                                               // four legs: the diagonal pairs move together
    float sx = i < 2 ? 0.043 : -0.043, fz = (i == 0 || i == 2) ? 0.13 : -0.13, a = ph + ((i == 0 || i == 3) ? 0.0 : 3.1416);
    d = smin(d, sdCap(p, vec3(sx, 0.16, fz), vec3(sx, 0.02 + 0.04 * max(cos(a), 0.0), fz + 0.07 * sin(a)), 0.019), 0.02);
  }
  float sw = 0.03 * sin(gT * 5.0);
  d = smin(d, min(sdCap(p, vec3(0.0, 0.23, -0.18), vec3(sw, 0.34, -0.29), 0.017), sdCap(p, vec3(sw, 0.34, -0.29), vec3(sw * 2.0, 0.47, -0.3), 0.014)), 0.02);
  return vec2(d, 4.0);
}
vec2 fig(vec3 p){ return gKind > 1.5 ? cat(p) : person(p); }
void main(){
  gKind = vFig2.x; gT = uTime - vFig2.y; gSeed = vFig2.z;
  float u = fract(gT / 3.2), sc = vFig2.w, isCat = step(1.5, gKind), isCook = step(0.5, gKind) * (1.0 - isCat);
  float c = cos(vFig.w), s = sin(vFig.w);
  vec3 rd = normalize(vWP - cameraPosition), lo = cameraPosition - vFig.xyz;
  lo = vec3(lo.x * c - lo.z * s, lo.y, lo.x * s + lo.z * c) / sc;
  vec3 ld = vec3(rd.x * c - rd.z * s, rd.y, rd.x * s + rd.z * c);
  gTel = gKind < 0.5 ? step(0.62, fract(gSeed * 7.3)) : 0.0;                                   // some hold a telephone
  gHat = step(0.4, fract(gSeed * 5.1));
  gArm = isCook > 0.5 ? smoothstep(0.0, 0.14, u) * (1.0 - smoothstep(0.62, 0.78, u)) : gTel;   // the cook lifts the lighter to his mouth
  gArmL = isCook > 0.5 ? smoothstep(0.02, 0.16, u) * (1.0 - smoothstep(0.5, 0.62, u)) : 0.0;   // and shields the flame with his other hand
  float lean = gKind < 0.5 ? 0.11 * step(0.35, fract(gSeed * 3.3)) : 0.0;
  gLean = vec2(cos(lean), sin(lean));
  float watch = gKind < 0.5 ? step(fract(gSeed * 9.7), 0.55) * (1.0 - gTel) : isCat;           // the cat and some of the people turn their heads to the camera
  float yaw = clamp(atan(lo.x, lo.z), -1.15, 1.15) * watch * (1.0 - smoothstep(5.0, 9.0, length(lo.xz)));
  gYaw = vec2(cos(yaw), sin(yaw));
  gNod = vec2(cos(gTel * 0.42), sin(gTel * 0.42));
  vec3 hb = mix(vec3(0.5, 1.1, 0.55), vec3(0.25, 0.31, 0.5), isCat), bc = vec3(0.0, hb.y, 0.0);
  vec3 inv = 1.0 / ld, t0 = (bc - hb - lo) * inv, t1 = (bc + hb - lo) * inv, tn = min(t0, t1), tf = max(t0, t1);
  float t = max(max(tn.x, max(tn.y, tn.z)), 0.0), tEnd = min(tf.x, min(tf.y, tf.z)), m = -1.0;
  for (int i = 0; i < 80; i++) {
    if (t > tEnd) break;
    vec2 h = fig(lo + ld * t);
    if (h.x < 0.0004 * t + 0.0002) { m = h.y; break; }
    t += h.x * 0.9;
  }
  if (m < 0.0) discard;
  vec3 lp = lo + ld * t; vec2 e = vec2(0.0015, -0.0015);
  vec3 ln = normalize(e.xyy * fig(lp + e.xyy).x + e.yyx * fig(lp + e.yyx).x + e.yxy * fig(lp + e.yxy).x + e.xxx * fig(lp + e.xxx).x);
  float occ = 0.0, wgt = 1.0;
  for (int i = 0; i < 3; i++) { float hh = 0.012 + 0.045 * float(i); occ += (hh - fig(lp + ln * hh).x) * wgt; wgt *= 0.6; }
  float ao = clamp(1.0 - 2.6 * occ, 0.45, 1.0);                                                // creases and the space under the chin stay dark
  vec3 n = vec3(ln.x * c + ln.z * s, ln.y, ln.z * c - ln.x * s), wp = cameraPosition + rd * t * sc, V = -rd;
  vec3 alb = m < 0.5 ? vec3(0.03, 0.033, 0.036) * (0.6 + 1.2 * fract(gSeed * 3.7)) : m < 1.5 ? vec3(0.26, 0.17, 0.125) : m < 2.5 ? vec3(0.42, 0.42, 0.39) * (0.86 + 0.14 * vn(lp.xy * 38.0))
    : m < 3.5 ? vec3(0.016) : m < 4.5 ? vec3(0.012) : m < 5.5 ? vec3(0.55) : m < 6.5 ? vec3(0.13, 0.12, 0.09) : vec3(0.0);
  vec3 light = uFogCol * 1.2 + setLight(wp, n);
  if (!indoors(wp)) light += C_FLASH * uFlash * (0.2 + 0.8 * max(dot(n, uFlashDir), 0.0)) + C_LAMP * exp(-max(wp.y, 0.0) / 14.0) * 0.1 + C_GLOW * 0.03 * max(n.y, 0.0);
  vec3 dW = uPL[2].xyz - wp; float r = length(dW);
  if (isCook > 0.5 && r < 0.9) {                                                              // his own flame: it falls off fast, and his hands throw shadows on his face
    vec3 l = FLP - lp; float mx = length(l) - 0.012, tt = 0.005 + 0.006 * h21(gl_FragCoord.xy + fract(uTime) * 61.0), sh = 1.0; l = normalize(l);
    for (int i = 0; i < 26; i++) {
      if (tt > mx) break;
      float hh = fig(lp + l * tt).x;
      if (hh < 0.0004) { sh = 0.0; break; }
      sh = min(sh, 9.0 * hh / tt); tt += clamp(hh, 0.003, 0.02);
    }
    float nl = dot(n, dW / max(r, 1e-3));
    light += uPLc[2].rgb * (1.9 / (1.0 + r * r / 0.012) * clamp(sh, 0.0, 1.0) * max(nl * 0.75 + 0.25, 0.0) - pow(max(1.0 - r / uPL[2].w, 0.0), 2.0) * max(nl * 0.8 + 0.2, 0.0));
  }
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 col = (alb * light + (m > 3.5 && m < 4.5 ? light * (0.035 + 0.32 * fres) : vec3(0.0))      // wet fur shines where a lamp reaches it
    + setLight(wp + n * 0.6, -V) * fres * 0.18 + uFogCol * fres * 1.5) * ao;
  if (m > 6.5) col = vec3(0.5, 0.8, 1.0) * 1.6;
  float zv = -(viewMatrix * vec4(wp, 1.0)).z;
  gl_FragDepth = ((uNF.y + uNF.x) - 2.0 * uNF.y * uNF.x / zv) / (uNF.y - uNF.x) * 0.5 + 0.5;
  gl_FragColor = vec4(applyFog(col, wp), 1.0);
}`;
    const matFig = mkMat(FIG_VS, FIG_FS, null, { side: THREE.BackSide });
    // small lights that belong to the figures: a flame, the end of a cigarette, a telephone, the eyes of the cat
    const GLO_VS = /* glsl */`
attribute vec4 iG; attribute vec4 iGc;              // place + size, colour + shape (0 a point, 1 a flame)
varying vec2 vUv; varying vec4 vC;
void main(){
  vec4 mv = viewMatrix * vec4(iG.xyz, 1.0);
  mv.xy += position.xy * iG.w * (iGc.w > 0.5 ? vec2(0.5, 1.0) : vec2(1.0));
  gl_Position = uMirror < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * mv;
  vUv = position.xy; vC = iGc;
}`;
    const GLO_FS = /* glsl */`
varying vec2 vUv; varying vec4 vC;
void main(){
  if (hidden()) discard;
  vec3 col;
  if (vC.w > 0.5) {                                                                           // a small flame: blue at its foot, a bright body that ends in a point
    float y = clamp(vUv.y * 0.5 + 0.5, 0.0, 1.0), x = abs(vUv.x) * 0.5;
    float wd = 0.62 * pow(y, 0.45) * (1.0 - y) + 0.004;
    float body = 1.0 - smoothstep(wd * 0.25, wd, x), foot = (1.0 - smoothstep(0.0, 0.22, y)) * (1.0 - smoothstep(0.02, 0.12, x));
    col = (vec3(4.2, 2.1, 0.55) * body * smoothstep(0.02, 0.2, y) + vec3(0.3, 0.7, 2.4) * foot + vec3(1.2, 0.5, 0.12) * exp(-dot(vUv, vUv) * 3.0) * 0.25) * vC.r;
  } else col = vC.rgb * (exp(-dot(vUv, vUv) * 9.0) + 0.12 * exp(-dot(vUv, vUv) * 1.6));
  gl_FragColor = vec4(col, 1.0);
}`;
    const matGlo = mkMat(GLO_VS, GLO_FS, null, ADD);
    const T_CAT = 2.4, V_CAT = 2.2, T_COOK = 3.2;
    const frac = x => x - Math.floor(x);
    // heading: the figure faces (sin h, cos h). [x, y, z, heading, kind, start of the loop on the world clock, seed, scale]. The world clock is at W0 - 5.7 + t while the long take runs
    const WC = W0.loop - 5.7;
    const figs = [
      [527.75, 0, -348.35, -0.52, 1, WC + 6.05, 0.3, 1],             // the cook by the kitchen door
      [515.0, TOP, -362.3, 2.396, 1, WC + 15.65, 0.3, 1],            // and again on the roof
      [518.2, 0, -348.3, 0.5236, 2, WC + 4.70, 0.5, 1.15],           // the cat crosses the alley
      [521.95, TOP, -366.99, -2.618, 2, WC + 12.93, 0.5, 1.15],      // and crosses the roof the same way
    ];
    for (const f of figs) if (f[4] === 2) f.push(f[0], f[2]);        // where the cat's stretch begins
    for (const [x, z, h, seed] of [[528.8, -351.0, 1.4, 0.12], [528.85, -352.6, 0.6, 0.83], [528.8, -354.9, 1.9, 0.52], [531.0, -350.3, -1.2, 0.38], [531.0, -356.1, -1.6, 0.91],
      [530.95, -357.3, -2.4, 0.22], [528.8, -359.4, 1.3, 0.66], [531.0, -360.6, -1.5, 0.74], [528.85, -361.3, 2.5, 0.47], [528.8, -364.3, 1.2, 0.95], [531.0, -365.3, -1.9, 0.07]])
      figs.push([x, 0.04, z, h, 0, 0, seed, 0.94 + 0.12 * ((seed * 13) % 1)]);
    const figGeo = instGeo(geoBox, figs.length, [['iFig', 4], ['iFig2', 4]]), gloGeo = instGeo(geoQuad, 48, [['iG', 4], ['iGc', 4]]);
    const fA = figGeo.attributes.iFig.array, fB = figGeo.attributes.iFig2.array, gA = gloGeo.attributes.iG.array, gB = gloGeo.attributes.iGc.array;
    figs.forEach((f, i) => { fA.set(f.slice(0, 4), i * 4); fB.set(f.slice(4, 8), i * 4); });
    figGeo.instanceCount = figs.length;
    const figMesh = addMesh(figGeo, matFig), gloMesh = addMesh(gloGeo, matGlo, 12);
    const at = (f, lx, ly, lz) => [f[0] + (lx * Math.cos(f[3]) + lz * Math.sin(f[3])) * f[7], f[1] + ly * f[7], f[2] + (lz * Math.cos(f[3]) - lx * Math.sin(f[3])) * f[7]];   // a point of a figure, in the world
    const flameOf = i => at(figs[i], FL[0], FL[1], FL[2]);
    const cookU = i => frac((worldT - figs[i][5]) / T_COOK);          // where cook i is in his loop, 0..1
    const updateFigs = () => {
      let n = 0;
      const glow = (p, size, r, g, b, shape) => { gA.set([p[0], p[1], p[2], size], n * 4); gB.set([r, g, b, shape], n * 4); n++; };
      let flame = null, fd = 1e9;
      figs.forEach((f, i) => {
        const tl = worldT - f[5];
        if (f[4] === 2) {                                           // the cat trots its stretch, and then trots it again
          const s = V_CAT * T_CAT * frac(tl / T_CAT), sn = Math.sin(f[3]), cs = Math.cos(f[3]);
          f[0] = f[8] + sn * s; f[2] = f[9] + cs * s; fA[i * 4] = f[0]; fA[i * 4 + 2] = f[2];
          const dx = P.pos.x - f[0], dz = P.pos.z - f[2], lx = (dx * cs - dz * sn) / f[7], lz = (dx * sn + dz * cs) / f[7];
          const yaw = clamp(Math.atan2(lx, lz), -1.15, 1.15) * (1 - smooth(5, 9, Math.hypot(lx, lz))), cy = Math.cos(yaw), sy = Math.sin(yaw);
          if (lx * sy + (lz - 0.235) * cy > 0.3 * Math.hypot(lx, lz - 0.235))                 // its eyes, when it looks your way
            for (const ex of [-0.024, 0.024]) glow(at(f, ex * cy + 0.05 * sy, 0.312, 0.235 + 0.05 * cy - ex * sy), 0.032, 0.6, 1.8, 0.5, 0);
        } else if (f[4] === 1) {
          const u = frac(tl / T_COOK), lit = smooth(0.17, 0.2, u) * (1 - smooth(0.47, 0.5, u)), fl = 0.9 + 0.1 * Math.sin(worldT * 33 + i) * Math.sin(worldT * 17);
          const fp = flameOf(i), d = Math.hypot(fp[0] - P.pos.x, fp[1] - P.pos.y, fp[2] - P.pos.z);
          if (lit > 0.02) { glow([fp[0], fp[1] + 0.004, fp[2]], 0.024, lit * fl, 0, 0, 1); glow(fp, 0.075, 0.5 * lit * fl, 0.25 * lit * fl, 0.06 * lit * fl, 0); if (d < fd) { fd = d; flame = [fp, lit * fl]; } }
          const ember = u > 0.2 && u < 0.78 ? 0.5 + 1.5 * smooth(0.5, 0.56, u) * (1 - smooth(0.6, 0.66, u)) : 0.3;   // it glows as he draws on it
          glow(at(f, 0, 1.578, 0.18), 0.014, 5 * ember, 1.2 * ember, 0.25 * ember, 0);
        } else if (frac(f[6] * 7.3) > 0.62) glow(at(f, 0.1, 1.33, 0.255), 0.1, 0.4, 0.64, 0.8, 0);   // the light of a telephone on its owner
      });
      const tc = worldT - T_CRASH;                                    // sparks, at the moment the two cars meet
      if (Math.abs(tc) < 0.3) { const k = Math.exp(-tc * tc / 0.006); glow([494.6, 0.9, -199.3], 0.4 + 2.2 * k, 7 * k, 4.5 * k, 2 * k, 0); }
      if (tc > 0 && frac(worldT * 1.3) < 0.5) for (const sd of [-0.62, 0.62]) {   // the warning lights of one car, at its back corners
        const fx = Math.cos(carB.a), fz = Math.sin(carB.a);
        glow([carB.x - fx * 2.2 - fz * sd, 0.75, carB.z - fz * 2.2 + fx * sd], 0.22, 5, 2.2, 0.3, 0);
      }
      if (flame) { U.uPL.value[2].set(flame[0][0], flame[0][1], flame[0][2], 3.4); U.uPLc.value[2].set(3.4 * flame[1], 1.8 * flame[1], 0.55 * flame[1], 2); } else U.uPL.value[2].y = -99;
      gloGeo.instanceCount = n;
      figGeo.attributes.iFig.needsUpdate = gloGeo.attributes.iG.needsUpdate = gloGeo.attributes.iGc.needsUpdate = true;
    };
    const endFigs = () => { scene.remove(figMesh, gloMesh); figGeo.dispose(); gloGeo.dispose(); matFig.dispose(); matGlo.dispose(); };

    // ── glass. A wall of panes on the footbridge, and what two cars lost when they met. Each piece is a triangle on a path
    //    that is written for a clock that runs forward. The film sees it while the clock runs backwards ──
    const WREV = W0.loop + 53.6;                                      // the world clock is at WREV - t while it runs backwards (30.5 s to 38.2 s of the film)
    const T_GLASS = WREV - 32.66, T_CRASH = WREV - 34.45;             // when the glass broke, and when the cars met, on the world clock
    const SH_VS = /* glsl */`
attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iV;   // rest centre + the time it broke; corners 0 and 1; corner 2, seed, kind (0 pane, 1 debris); velocity + spin
varying vec3 vWP; varying vec3 vN; varying vec3 vBary; varying vec2 vRest; varying float vTau; varying float vKind;
vec3 rotAx(vec3 v, vec3 a, float t){ float c = cos(t), s = sin(t); return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
void main(){
  float i = position.x, tau = uTime - iA.w, seed = iC.z;
  vec2 c2 = i < 0.5 ? iB.xy : i < 1.5 ? iB.zw : iC.xy;
  vBary = vec3(i < 0.5 ? 1.0 : 0.0, (i > 0.5 && i < 1.5) ? 1.0 : 0.0, i > 1.5 ? 1.0 : 0.0);
  vec3 loc = vec3(c2, 0.0), n = vec3(0.0, 0.0, 1.0), c = iA.xyz;
  vRest = c.xy + c2;
  if (tau > 0.0) {
    const float G = 11.0;
    float tl = (iV.y + sqrt(iV.y * iV.y + 2.0 * G * max(c.y - 0.04, 0.0))) / G, te = min(tau, tl);   // when it lands
    vec3 ax = normalize(vec3(h11(seed * 7.1) - 0.5, h11(seed * 3.3) - 0.5, h11(seed * 5.7) - 0.5) + 1e-3);
    vec3 fly = c + iV.xyz * te - vec3(0.0, 0.5 * G * te * te, 0.0);
    vec3 lf = rotAx(loc, ax, iV.w * te), nf = rotAx(n, ax, iV.w * te);
    float yaw = seed * 40.0, cy = cos(yaw), sy = sin(yaw), land = smoothstep(tl - 0.05, tl, tau);   // on the street it lies flat, and slides a little
    vec3 lg = vec3(c2.x * cy - c2.y * sy, 0.0, c2.x * sy + c2.y * cy);
    vec3 ground = vec3(fly.x, 0.04 + 0.03 * h11(seed * 9.9), fly.z) + vec3(iV.x, 0.0, iV.z) * 0.1 * (1.0 - exp(-5.0 * max(tau - tl, 0.0)));
    c = mix(fly, ground, land); loc = mix(lf, lg, land); n = normalize(mix(nf, vec3(0.0, 1.0, 0.0), land));
  }
  if (iC.w > 0.5) loc *= smoothstep(0.0, 0.1, tau);                    // debris comes out of the cars
  vWP = c + loc; vN = n; vTau = tau; vKind = iC.w;
  gl_Position = uMirror < 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(vWP, 1.0);
}`;
    const SH_FS = /* glsl */`
varying vec3 vWP; varying vec3 vN; varying vec3 vBary; varying vec2 vRest; varying float vTau; varying float vKind;
void main(){
  if (hidden()) discard;
  vec3 n = normalize(vN), V = normalize(cameraPosition - vWP);
  if (dot(n, V) < 0.0) n = -n;
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0), F = 0.06 + 0.94 * fres;
  vec3 R = reflect(-V, n);
  vec3 col = envCol(R) * F * 2.0 + vec3(0.012, 0.03, 0.024);            // what it mirrors, and the green of thick glass
  float sp = pow(max(dot(R, vec3(0.169, 0.902, 0.338)), 0.0), 50.0) + pow(max(dot(R, vec3(-0.346, 0.634, -0.692)), 0.0), 50.0) + pow(max(dot(R, vec3(0.0, 0.2, 0.98)), 0.0), 30.0);
  col += (C_LAMP + vec3(0.5, 0.9, 0.75)) * sp * 1.6;                   // a piece that tumbles flashes when it mirrors a lamp
  col += C_FLASH * uFlash * (0.1 + 2.0 * pow(max(dot(R, uFlashDir), 0.0), 16.0));
  if (vKind < 0.5) {                                                   // signs are etched into the panes: they come back together with the glass
    float cs = 0.62; vec2 gp = vec2(vRest.x, -vRest.y), c = gp / cs, id = floor(c), f2 = fract(c);
    float on = step(0.45, h21(id * 1.3 + 7.0)) * step(mod(id.x, 3.0), 1.5);
    float gl = glyph(vec2(f2.x, 1.0 - f2.y), floor(h21(id + 3.7) * 64.0), dFdx(gp) / cs * vec2(1.0, -1.0), dFdy(gp) / cs * vec2(1.0, -1.0));
    col += vec3(0.25, 0.75, 0.5) * gl * on * 0.5;
  }
  float edge = 1.0 - smoothstep(0.0, 0.06, min(vBary.x, min(vBary.y, vBary.z)));
  if (vTau > 0.0) col += vec3(0.3, 0.6, 0.48) * edge * 0.55;         // a broken edge catches the light
  gl_FragColor = vec4(applyFog(col, vWP) - applyFog(vec3(0.0), vWP), 1.0);
}`;
    const matSh = mkMat(SH_VS, SH_FS, null, ADD);
    const shards = [];                                                 // rows: centre x, y, z, the time it broke | corner 0, corner 1 | corner 2, seed, kind | velocity, spin
    {
      const r = mulberry32(0x61A55), GX0 = 487.5, GY0 = 9.68, GZ = -148, PW = 2.5, PH = 3.84, NX = 6, NY = 8, CX = 500.3, CY = 11.6;
      for (let pane = 0; pane < 10; pane++) {                         // each pane: a grid of points, pushed about, and two triangles per square. Together they fill the pane
        const pts = [];
        for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
          const inner = i > 0 && i < NX && j > 0 && j < NY;
          pts.push([GX0 + pane * PW + (i + (inner ? (r() - 0.5) * 0.7 : 0)) * PW / NX, GY0 + (j + (inner ? (r() - 0.5) * 0.7 : 0)) * PH / NY]);
        }
        const tri = (a, b, c) => {
          const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, dx = cx - CX, dy = cy - CY;
          if (Math.hypot(dx, dy) < 1.4) return;                       // where the film goes through, the glass stays out
          const core = Math.exp(-(dx * dx) / 25);                     // the middle broke first and flew furthest; the crack ran to the ends
          shards.push([cx, cy, GZ, T_GLASS + Math.abs(dx) / 6.5 + r() * 0.06, a[0] - cx, a[1] - cy, b[0] - cx, b[1] - cy, c[0] - cx, c[1] - cy, r(), 0,
            dx * 0.5 * r() + (r() - 0.5) * 5, (r() - 0.3) * 7, 2.5 + 4 * r() + 16 * core * (0.4 + 0.6 * r()), 3 + 9 * r()]);
        };
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
          const p00 = pts[j * (NX + 1) + i], p10 = pts[j * (NX + 1) + i + 1], p01 = pts[(j + 1) * (NX + 1) + i], p11 = pts[(j + 1) * (NX + 1) + i + 1];
          if (r() < 0.5) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
        }
      }
      for (let i = 0; i < 380; i++) {                                  // what the two cars lost
        const a = r() * TAU, sp = 3 + 9 * r(), sz = 0.05 + 0.11 * r(), b = r() * TAU;
        shards.push([494.4 + (r() - 0.5) * 1.6, 0.6 + 0.7 * r(), -199.4 + (r() - 0.5) * 1.6, T_CRASH, sz * Math.cos(b), sz * Math.sin(b), sz * Math.cos(b + 2.1), sz * Math.sin(b + 2.1), sz * Math.cos(b + 4.2), sz * Math.sin(b + 4.2), r(), 1,
          Math.cos(a) * sp, 1 + 5 * r(), Math.sin(a) * sp, 4 + 14 * r()]);
      }
    }
    const geoTri = new THREE.BufferGeometry(); geoTri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));   // x is the number of the corner
    const shGeo = instGeo(geoTri, shards.length, [['iA', 4], ['iB', 4], ['iC', 4], ['iV', 4]]);
    shards.forEach((s, i) => { for (let k = 0; k < 4; k++) shGeo.attributes[['iA', 'iB', 'iC', 'iV'][k]].array.set(s.slice(k * 4, k * 4 + 4), i * 4); });
    for (const k of ['iA', 'iB', 'iC', 'iV']) shGeo.attributes[k].needsUpdate = true;
    shGeo.instanceCount = shards.length;
    const shMesh = addMesh(shGeo, matSh, 11);
    // two cars met at the crossing of the avenue and the street at z -200. Before: each on its lane. After: they slide and turn, and come to rest
    const carA = { x: 0, z: 0, a: Math.PI / 2, seed: 0.31, brake: 0 }, carB = { x: 0, z: 0, a: 0, seed: 0.7, brake: 0 };
    extraCars.push(carA, carB);
    const cellW = getCell(4, -2), VENT = [497.2, 0.9, -196.3, 1]; let wrecked = false;
    const crash = t => {
      const tau = worldT - T_CRASH, e = tau > 0 ? 1 - Math.exp(-1.8 * tau) : 0, s = e / 1.8;
      if (tau <= 0) { carA.x = 494; carA.z = -201.1 + 15 * tau; carA.a = Math.PI / 2; carB.x = 493.8 + 13 * tau; carB.z = -198; carB.a = 0; }
      else { carA.x = 494 + 3.5 * s; carA.z = -201.1 + 7 * s; carA.a = Math.PI / 2 - 0.6 * e; carB.x = 493.8 + 9 * s; carB.z = -198 + 5.5 * s; carB.a = 1.5 * e; }
      carA.brake = carB.brake = tau > 0 ? 2 : 0;                     // a wreck has no lights
      if (t > 30 && t < 36.6) {                                      // a lamp over the crossing, and the orange of a warning light that still works
        const bl = wrecked && frac(worldT * 1.3) < 0.5 ? 1 : 0;
        lamp(4, 497, 7.5, -197.5, 17, 0.5, 0.65, 0.55, 0); lamp(5, carB.x - 2.4 * Math.cos(carB.a), 1.0, carB.z - 2.4 * Math.sin(carB.a), 7, 2.4 * bl, 1.1 * bl, 0.15 * bl, 0);
      } else if (t >= 36.6 && t < 36.8) { lamp(4, 0, -99, 0, 1, 0, 0, 0, 0); lamp(5, 0, -99, 0, 1, 0, 0, 0, 0); }
      const wreck = tau > 0;
      if (wreck !== wrecked) { wrecked = wreck; if (wreck) cellW.vents.push(VENT); else cellW.vents.splice(cellW.vents.indexOf(VENT), 1); steamDirty = true; }
      if (t > 26.5 && t < 36) for (const c of cars) if (Math.abs(c.x - 497) < 45 && Math.abs(c.z + 200) < 45) c.s = 1e7;   // the crossing is theirs alone: other cars start again elsewhere
    };
    const endGlass = () => { if (wrecked) { cellW.vents.splice(cellW.vents.indexOf(VENT), 1); steamDirty = true; } scene.remove(shMesh); shGeo.dispose(); geoTri.dispose(); matSh.dispose(); };

    // ── sound. Recordings beside the page, in tour-snd/. They are fetched when the audio runs. A missing file is a silent one ──
    const SND = ['tick', 'horn', 'cat', 'lighter', 'glass', 'crash', 'crowd', 'powerdown', 'rewind', 'vo1', 'vo2'];
    let sndOn = false, bus = null, amb = null, musG = null, lim = null, crowdG = null, crowdS = null, lastLvl = -1, nextTick = 18, tickN = 0;
    const tmpV = new V(), prevU = [1, 1]; let cut = false;
    const reversed = b => {                                           // the same recording, played from its end
      const o = AC.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
      for (let c = 0; c < b.numberOfChannels; c++) o.getChannelData(c).set(Float32Array.from(b.getChannelData(c)).reverse());
      return o;
    };
    const sndStart = () => {
      sndOn = true;
      bus = aGain(1); bus.connect(AU.nodes.out);                      // the film's own sounds go round the compressor. The SOUND switch still rules them
      amb = aFilt('lowpass', 18000); master.disconnect(AU.nodes.duck); aChain(master, amb, AU.nodes.duck);   // a filter on the weather: dull behind a wall
      musG = aGain(0.84); AU.nodes.music.disconnect(); aChain(AU.nodes.music, musG, bus);                    // the music does not hold its breath when the world does. Measured: it stays 6 dB or more under the weather
      lim = AC.createWaveShaper(); const cv = new Float32Array(2049);                                       // a ceiling for the sum: straight up to 0.8, then it bends, and nothing leaves above full scale
      for (let i = 0; i < 2049; i++) { const y = (i / 1024 - 1) * 2, m = Math.abs(y); cv[i] = Math.sign(y) * (m <= 0.8 ? m : 0.8 + 0.19 * Math.tanh((m - 0.8) / 0.19)); }
      lim.curve = cv; AU.nodes.out.disconnect(); aChain(AU.nodes.out, aGain(0.5), lim, AC.destination);
      for (const n of SND) fetch('tour-snd/' + n + '.mp3', { cache: 'no-store' }).then(r => r.ok ? r.arrayBuffer() : Promise.reject()).then(b => AC.decodeAudioData(b)).then(b => {
        AU.buf['t_' + n] = b;
        if (n === 'glass' || n === 'crash') AU.buf['t_' + n + 'R'] = reversed(b);
      }).catch(() => {});
    };
    // play one recording. opt: rate, at (seconds from now), pos [x, y, z] (it is panned, and distance lowers it), ref (the distance that halves it), verb (how much echo)
    const play = (name, gain, opt = {}) => {
      const b = AU.buf['t_' + name] || AU.buf[name]; if (!sndOn || !b) return;
      let g = gain, pan = 0;
      if (opt.pos) {
        const dx = opt.pos[0] - P.pos.x, dy = opt.pos[1] - P.pos.y, dz = opt.pos[2] - P.pos.z, d = Math.hypot(dx, dy, dz);
        camera.getWorldDirection(tmpV); g /= 1 + d / (opt.ref || 8); pan = clamp((dz * tmpV.x - dx * tmpV.z) / Math.max(d, 1), -1, 1) * 0.7;
      }
      const s = AC.createBufferSource(), gn = aGain(g), pn = aPan(pan); s.buffer = b; s.playbackRate.value = opt.rate || 1;
      aChain(s, gn, pn, bus); if (opt.verb) aChain(pn, aGain(opt.verb), verbIn);
      s.start(AC.currentTime + Math.max(0, opt.at || 0));
    };
    const honk = (g, verb) => () => { for (const at of [0, 0.85]) play('horn', g, { pos: [509.3, 1, -331], ref: 30, verb, at }); };   // two blasts of a horn. They are the same every time
    const meow = i => () => play('cat', 0.55, { pos: figs[i], ref: 6, verb: 0.2 });
    const tickGap = t => lerp(1.0, 0.15, Math.pow(clamp((t - 18) / 24, 0, 1), 1.25));   // the clock runs faster and faster
    const sound = t => {
      if (!AC) return;
      if (!sndOn) sndStart();
      // the weather: all but silent in a frozen frame, lower and dull behind the walls of the tower
      const ind = smooth(8.0, 8.4, t) * (1 - smooth(13.1, 13.5, t)), frz = (t >= 2.2 && t < 3.95) || (t >= 16.7 && t < 17.9);
      const lvl = t >= 42 ? 0 : 0.42 * (frz ? 0.04 : 1) * (1 - 0.55 * ind) * (1 - 0.3 * smooth(17.9, 18.3, t) * (1 - smooth(20.2, 20.6, t)));   // and it draws back when the clock comes in
      if (lvl !== lastLvl) { lastLvl = lvl; master.gain.cancelScheduledValues(AC.currentTime); master.gain.setTargetAtTime(lvl, AC.currentTime, frz || t >= 42 ? 0.02 : 0.12); }
      aSet(amb.frequency, lerp(18000, 700, ind), 0.1);
      if (!crowdS && t >= 7.6 && t < 11 && AU.buf.t_crowd) { crowdS = AC.createBufferSource(); crowdS.buffer = AU.buf.t_crowd; crowdG = aGain(0); aChain(crowdS, crowdG, bus); crowdS.start(); }   // the people in the corridor
      if (crowdG) aSet(crowdG.gain, 0.5 * smooth(7.8, 8.5, t) * (1 - smooth(10.6, 11.3, t)), 0.15);
      // the clock: every tick is set a little ahead, so the beat is even
      while (nextTick < Math.min(t + 0.12, 42)) {
        if (nextTick >= t) play('tick', lerp(0.6, 0.95, smooth(18, 40, nextTick)), { at: nextTick - t, rate: tickN % 2 ? 0.86 : 1 });
        tickN++; nextTick += tickGap(nextTick);
      }
      // the cook's lighter, each time round
      for (let i = 0; i < 2; i++) {
        const u = cookU(i), inside = P.pos.x > 513.5 && P.pos.x < 551 && P.pos.z > -386.5 && P.pos.z < -348.9 && P.pos.y < TOP - 0.5;
        if (prevU[i] < 0.17 && u >= 0.17 && timeRate > 0 && !inside) play('lighter', 1.0, { pos: flameOf(i), ref: 5 });
        prevU[i] = u;
      }
      if (t >= 42 && !cut) { cut = true; AU.nodes.out.gain.cancelScheduledValues(AC.currentTime); AU.nodes.out.gain.setValueAtTime(0, AC.currentTime); }   // the cut: silence, thunder and all
    };
    const whoosh = (dur, r0, r1, g) => () => {                        // the rush of a tape that runs back: the wind recording, fast and rising
      if (!sndOn || !AU.buf.wind) return;
      const t = AC.currentTime, s = AC.createBufferSource(), f = aFilt('bandpass', 1400, 1.2), gn = aGain(0.0001);
      s.buffer = AU.buf.wind; s.playbackRate.setValueAtTime(r0, t); s.playbackRate.linearRampToValueAtTime(r1, t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + dur * 0.3); gn.gain.setValueAtTime(g, t + dur * 0.85); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      aChain(s, f, gn, bus); s.start(t, 1); s.stop(t + dur + 0.05);
      play('rewind', 0.7);
    };
    const low = (name, g, rate) => () => { const n = aPlay(name, master, AC ? AC.currentTime : 0, g, rate); if (n) n.connect(verbIn); };   // one of the page's own recordings, slowed down
    const backwards = (name, g, end) => () => { const b = AU.buf['t_' + name + 'R']; if (b) play(name + 'R', g, { at: end - st.t - b.duration, verb: 0.25 }); };   // a recording from its end, so that it stops at `end`
    const endSound = () => {
      if (!sndOn) return;
      sndOn = false;
      master.disconnect(amb); amb.disconnect(); master.connect(AU.nodes.duck);
      AU.nodes.music.disconnect(); AU.nodes.music.connect(master); musG.disconnect(); bus.disconnect();
      AU.nodes.out.disconnect(); AU.nodes.out.connect(AC.destination); lim.disconnect();
      AU.nodes.out.gain.cancelScheduledValues(AC.currentTime); AU.nodes.out.gain.setValueAtTime(S.sound ? 1 : 0, AC.currentTime);
      if (crowdS) { try { crowdS.stop(); } catch (e) { /* it has ended */ } }
    };

    // the fall off the roof, backwards. tau = seconds since it began. The film ends in this fall and begins in it
    const eu = new THREE.Euler(0, 0, 0, 'YXZ'), fp = new V(), prev = new V();
    const fallAt = (tau, o) => {
      const b = 2.9 * (1 - Math.exp(-tau / 0.9)) + 1.4 * tau, td = Math.max(0, tau - 0.12), drop = 55 * (td - 1.2 * (1 - Math.exp(-td / 1.2)));
      return o.set(L[0] - F[0] * b, L[1] - drop, L[2] - F[2] * b);
    };
    let wasFall = false;
    const custom = (t, rdt) => {
      let tau = -1;
      if (t < 2.2) tau = 1.7 + t; else if (t < 3.2) tau = 3.9; else if (t < 3.95) tau = 3.9 * (1 - (t - 3.2) / 0.75); else if (t < 4) tau = 0;
      else if (t >= 40.3) tau = Math.min(t, 42) - 40.3;
      if (tau < 0) { wasFall = false; return false; }
      fallAt(tau, fp);
      if (wasFall) P.vel.copy(fp).sub(prev).divideScalar(Math.max(rdt, 1e-4)); else P.vel.set(0, 0, 0);
      prev.copy(fp); wasFall = true;
      P.pos.copy(fp); camera.position.copy(fp);
      eu.set(Math.PI * (1 - Math.exp(-tau / 0.5)) + 0.22 * tau, yawF, 0.3 * tau); camera.quaternion.setFromEuler(eu);
      P.yaw = yawF; P.pitch = 0; P.roll = 0; P.yawRate = P.pitchRate = 0; P.boost = 0;
      return true;
    };

    // focus distance and blur over time
    const DOF = [[0, 50, 0], [4.0, 16, 9], [5.0, 12, 9], [6.0, 6, 10], [7.0, 2.6, 12], [7.8, 3, 10], [8.4, 4, 9], [10.4, 5, 8], [10.9, 8, 0], [13.6, 8, 0], [14.2, 5, 9], [15.4, 3, 14],
      [16.3, 1, 26], [17.9, 1, 26], [18.5, 300, 6], [19.8, 300, 0], [38.8, 300, 0], [39.2, 300, 14], [39.5, 300, 14], [40.1, 8, 14], [40.5, 8, 14], [41.0, 30, 0]];
    const ZOOM = [[15.3, 0], [16.4, -44], [17.9, -44], [18.5, 0], [33.4, 0], [34.0, -22], [34.9, -22], [35.4, 0]];    // degrees on the lens angle: the close shot uses a long lens
    const dof = t => {
      let i = 0; while (i < DOF.length - 2 && DOF[i + 1][0] <= t) i++;
      const a = DOF[i], b = DOF[i + 1], s = smooth(a[0], b[0], t);
      matComp.uniforms.uFocus.value = Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), s)); matComp.uniforms.uAper.value = lerp(a[2], b[2], s);
      const k = smooth(14.9, 15.6, t) * (1 - smooth(17.9, 18.2, t));   // the close shot keeps the flame sharp
      if (k > 0) matComp.uniforms.uFocus.value = lerp(matComp.uniforms.uFocus.value, Math.hypot(FLR[0] - P.pos.x, FLR[1] - P.pos.y, FLR[2] - P.pos.z), k);
    };

    const frame = (t, rdt) => {
      fx.nextFlash = 99;                                            // the lightning of the film is in its script
      // the pace of the world: it holds for the two freeze frames, runs back in the rewind, and runs backwards while the film runs on
      timeRate = t < 2.2 ? 1 : t < 3.2 ? 0 : t < 3.95 ? -5.2 : t < 4 ? 0 : t < 16.7 ? 1 : t < 17.9 ? 0 : t < 30 ? 1 : t < 30.5 ? 1 - 4 * (t - 30) : t < 38.2 ? -1 : t < 38.6 ? -1 + 5 * (t - 38.2) : t < 42 ? 1 : 0;
      // the fold goes up, and comes down again when time runs backwards
      const a = t < 30.3 ? smooth(20.5, 24.9, t) : 1 - smooth(30.3, 36.5, t), far = smooth(20.2, 21, t) * (1 - smooth(36.2, 37, t));
      setFold(HINGE, RAD, Math.PI * a);
      fogAlt = far > 0 ? lerp(P.pos.y, 900, far) : null;
      // the blackout: a band of dark 700 m deep comes from the north, and reaches the roof at 20.2 s. Behind it the lights come back
      if (t > 18.2 && t < 23) U.uDark.value.set(0, -1, 360 + 550 * (t - 20.2), 700); else U.uDark.value.w = 0;
      dof(t); updateFigs(); lamps(t < 4 || t >= 11.5); crash(t); sound(t);
      fovAdd = lin(ZOOM, t);
      // words
      show(card, t >= 42.3 ? 'WAKE UP' : '4 minutes earlier.', t >= 42.3 ? smooth(42.3, 42.5, t) : smooth(2.3, 2.5, t) * (1 - smooth(3.05, 3.2, t)));
      card.style.letterSpacing = t >= 42 ? '.35em' : '.04em';
      show(sub, t < 12 ? 'Funny thing about this city. Every night, it’s exactly the same.' : 'I counted. This is night four hundred and twelve.',
        AU.buf.t_vo1 ? 0 : t < 12 ? smooth(5.2, 5.5, t) * (1 - smooth(9.3, 9.6, t)) : smooth(16.75, 16.95, t) * (1 - smooth(18.0, 18.3, t)));   // with tour-snd/vo1.mp3 and vo2.mp3 the voice speaks them
      if (t >= 42 && !black._on) { black._on = true; black.style.display = 'block'; }   // the cut: black
    };

    // the path from the alley to the landing (t in seconds of the film)
    const HOLD = at(figs[1], 0.42, 1.63, 0.95), FLR = flameOf(1), LOOK = [FLR[0], FLR[1] + 0.03, FLR[2]];   // the close shot of the flame on the roof: where the camera rests, and what it looks at
    const K0 = [[4.0, 510.2, 1.66, -354.0], [4.7, 510.3, 1.66, -350.4], [5.2, 511.6, 1.66, -347.0], [5.7, 514.5, 1.66, -346.1], [6.4, 519.0, 1.65, -346.2], [7.1, 524.0, 1.65, -346.0],
      [7.6, 527.6, 1.65, -346.3], [8.0, 529.6, 1.65, -347.6], [8.35, 529.9, 1.65, -349.6], [8.9, 530.1, 1.65, -353.5], [9.5, 529.65, 1.65, -358.0], [10.1, 530.1, 1.65, -362.5],
      [10.6, 529.9, 1.7, -366.5], [11.0, 529.9, 2.2, -370.3], [11.3, 529.9, 6, -372.0], [11.7, 529.9, 30, -372.0], [12.3, 529.9, 100, -372.0], [12.9, 529.9, 165, -372.0],
      [13.25, 529.9, 184, -372.0], [13.6, 529.3, 187.9, -371.7], [14.2, 524.5, 187.75, -370.6], [14.9, 519.5, 187.7, -369.0], [15.6, 517.0, 187.65, -366.0], [16.2, 516.0, 187.63, -364.3],
      [16.7, ...HOLD, 1], [17.9, ...HOLD, 1], [18.25, 516.35, 187.65, -362.3], [18.6, 516.1, 187.68, -360.0], [19.2, 515.2, 187.7, -355.0], [19.8, 514.8, 187.7, -351.8],
      [20.3, 514.0, 188.4, -347.0], [20.9, 509.0, 186.5, -330.0], [21.5, 502.5, 186.0, -290.0], [22.3, 500, 195, -190], [23.2, 500, 222, -70], [24.1, 500, 258, 60], [25.0, 500, 286, 200]];
    for (let i = 1; i <= 6; i++) { const a = i * Math.PI / 6; K0.push([25.0 + 2.3 * i / 6, 500, 286 + 95 * (1 - Math.cos(a)), 200 + 95 * Math.sin(a)]); }   // half a loop: up and over, to fly back under the ceiling
    K0.push([27.9, 500, 474, 125], [28.4, 500, 462, 70], [28.9, 500, 380, 30], [29.4, 500, 200, 0], [29.8, 500, 70, -18], [30.2, 500, 22, -40], [30.7, 500, 13, -70],
      [32.0, 500.6, 11.9, -125], [32.6, 500.2, 11.6, -150.5], [33.15, 501.5, 7.0, -170], [33.7, 503.6, 3.6, -182], [34.3, 504.6, 2.5, -189.5], [34.9, 504.3, 2.4, -196.5], [35.4, 501.5, 3.0, -208],
      [35.9, 497.5, 4.5, -232], [36.4, 498.5, 9, -275], [36.9, 503, 12, -330], [37.3, 506.5, 30, -350], [37.7, 509.5, 100, -362],
      [38.1, 510.6, 170, -368], [38.45, 511.5, 189.5, -370], [38.85, 513.6, 188.3, -370], [39.2, L[0], L[1], L[2], 1], [40.3, L[0], L[1], L[2], 1]);
    return {
      pos: K0, frame, custom, t0: 0, now: true,
      look: [{ t: 4.0, p: [509.3, 1.0, -331], w: 1 }, { t: 4.6, p: [509.3, 1.0, -331], w: 1 }, { t: 5.25, p: [519.0, 0.5, -346.9], w: 0.6 }, { t: 5.9, p: [519.6, 0.4, -345.9], w: 0.6 },
        { t: 6.5, p: [527.7, 1.55, -348.2], w: 0.15 }, { t: 7.1, p: [527.7, 1.55, -348.2], w: 0.55 }, { t: 7.7, p: [529.9, 1.6, -352], w: 0.3 }, { t: 8.3, p: [529.9, 1.6, -356], w: 0 },
        { t: 10.7, d: [0, 0.2, -1], w: 0 }, { t: 11.2, d: [0.05, 1, -0.15], w: 1 }, { t: 13.0, d: [0.05, 1, -0.15], w: 1 }, { t: 13.6, d: [-1, 0, 0.15], w: 0.9 },
        { t: 14.0, p: [520.8, 186.3, -369.0], w: 0.75 }, { t: 14.45, p: [520.3, 186.3, -369.9], w: 0.75 }, { t: 15.0, p: LOOK, w: 0.8 }, { t: 15.6, p: LOOK, w: 1 }, { t: 17.9, p: LOOK, w: 1 },
        { t: 18.6, p: [500, 60, 200], w: 1 }, { t: 19.9, p: [500, 40, 300], w: 1 }, { t: 20.5, p: [500, 120, 400], w: 0.8 }, { t: 21.5, p: [500, 250, 700], w: 0.8 }, { t: 23.5, p: [500, 420, 800], w: 0.7 },
        { t: 24.8, p: [500, 500, 500], w: 0.4 }, { t: 25.2, p: [500, 500, 500], w: 0 }, { t: 27.3, d: [0, 0.35, -1], w: 0 }, { t: 27.6, d: [0, 0.35, -1], w: 0.5 }, { t: 28.3, d: [0, 0.2, -1], w: 0.3 },
        { t: 28.8, d: [0, 0, -1], w: 0 }, { t: 32.75, d: [0, 0, -1], w: 0 }, { t: 33.3, p: [497.5, 0.8, -196.5], w: 0.8 }, { t: 34.9, p: [495.5, 0.8, -199], w: 0.9 }, { t: 35.3, p: [494, 1, -214], w: 0.7 },
        { t: 35.8, p: [494.5, 1, -226], w: 0.4 }, { t: 36.3, d: [0, 0.1, -1], w: 0 }, { t: 38.3, d: F, w: 0 }, { t: 38.9, d: F, w: 1 }, { t: 40.3, d: F, w: 1 }],
      upv: [{ t: 25.0, u: [0, 1, 0] }, { t: 26.15, u: [0, 0, -1] }, { t: 27.3, u: [0, -1, 0] }, { t: 27.9, u: [0, -1, 0] }, { t: 28.9, u: [0.9, -0.44, 0] }, { t: 29.6, u: [1, 0, 0] },
        { t: 30.6, u: [1, 0, 0] }, { t: 32.0, u: [0, 1, 0] }],
      bank: [[20.0, 0], [20.6, 1], [32.8, 1], [33.3, 0], [35.2, 0], [35.6, 1]],
      boost: [[20.6, 0], [21.2, 1], [24.9, 1], [25.3, 0.7], [27.3, 0.5], [28.3, 0.7], [30.0, 1], [30.6, 0.35], [36.5, 0.35], [37.2, 0.9], [38.2, 0.9], [38.6, 0]],
      ev: [[0.7, farFlash(400, 1.6)], [6.2, farFlash(500, 1.4)], [14.4, strike(180, 600)], [19.6, farFlash(800, 2.0)], [22.6, farFlash(600, 1.8)], [27.6, farFlash(500, 1.6)], [31.6, farFlash(420, 1.9)], [39.6, farFlash(700, 1.8)],
        [3.2, whoosh(0.75, 2.5, 6, 0.5)], [4.2, honk(0.9, 0.15)], [5.45, meow(2)], [5.2, () => play('vo1', 1)], [13.55, honk(1.6, 0.8)], [14.0, meow(3)], [16.75, () => play('vo2', 1)],
        [18.3, () => play('powerdown', 0.4)], [18.5, low('thud', 0.22, 0.6)], [18.95, low('thud', 0.3, 0.58)], [19.4, low('thud', 0.4, 0.56)], [19.85, low('thud', 0.55, 0.54)], [20.3, low('thud', 0.7, 0.5)],
        [20.7, low('boom', 0.5, 0.3)], [23.0, low('boom', 0.4, 0.24)], [30.0, whoosh(0.9, 1.2, 4, 0.45)], [30.9, backwards('glass', 0.9, 32.66)], [32.3, backwards('crash', 0.9, 34.45)],
        [38.95, honk(1.6, 0.8)], [39.3, meow(3)]],
      end() { timeRate = 1; fogAlt = null; fovAdd = 0; setFold(0, 300, 0); U.uDark.value.w = 0; matComp.uniforms.uAper.value = 0; endSound(); endGlass(); endFigs(); endSet(); },
    };
  };

  cineOn = true; cine.pan = 0;
  canvas.style.cursor = 'none'; $('ui').style.display = 'none'; $('hint').style.display = 'none'; $('intro').style.display = 'none';
  enter(0);
  // a browser plays no sound before a click, so the tour waits for one
  const gate = mk(`position:fixed;inset:0;z-index:30;background:#000;display:flex;flex-direction:column;gap:2vh;align-items:center;justify-content:center;cursor:pointer;font:700 2.6vh ${MONO};color:${GREEN};letter-spacing:.3em;text-shadow:0 0 1.2vh rgba(57,255,122,.7)`);
  gate.innerHTML = `<div>CLICK TO START</div><div style="font-size:1.5vh;opacity:.5">${D.scene.toUpperCase()} &middot; ESC ENDS IT</div>`;
  let asked = false;
  const go = () => {
    if (asked) return; asked = true;
    startAudio(); gate.firstChild.textContent = '';
    const begin = () => { if (st.go) return; playMusic(true); gate.remove(); st.go = true; worldT = W0[list[0][0]]; };   // the wait at the gate does not count
    AU.musicReady.then(begin); setTimeout(begin, 4000);              // the music starts with the tour; do not wait for it for long
  };
  gate.addEventListener('click', go);
  addEventListener('keydown', onKey, true);
})()
