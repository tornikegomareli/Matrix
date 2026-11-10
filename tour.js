// Scripted camera tours for Code City. The page loads this file when its address has ?tour=film or ?tour=reel (over http, not file://)
// and runs it inside its own module, so a tour can drive the camera and the world directly.
//   film   41 seconds: text on black, digital rain, the city builds itself, a rooftop, the jump, bullet time, a run, the clouds
//   reel   70 seconds: a look around, the street, a train, the recompile wave, a spire, the sky, the dive from the top
// A click starts a tour, because a browser plays no sound before one. Esc ends it. After a tour the page flies by itself again.
// The paths are written for the seed C0DEC17E, and each scene sets the world clock, so the clouds stand where its path expects them.
// tour-snd/drone.mp3 is a recording from Wikimedia Commons: "MainsBrum50Hz" (public domain).
(() => {
  const D = window.__tourDef, V = THREE.Vector3;
  const LISTS = { film: [['film', 41.3]], reel: [['city', 26], ['train', 6.8], ['wave', 6.6], ['sky', 30.6]] };
  const list = LISTS[D.scene];
  if (!list) { console.warn('tour: there is no tour named ' + D.scene); return; }
  if (seedHex() !== 'C0DEC17E') { location.hash = 'seed=C0DEC17E'; location.reload(); return; }
  const M = [0.4082, 0.4082, -0.8165];                              // moon direction (from the sky shader)
  const pageStep = stepCine, keep = { glitch: S.glitch };
  const W0 = { film: 55, city: 0, train: 100, wave: 200, sky: 1090 };   // the world clock at the start of each scene

  // ── sounds that only the tours use ──
  const raw = {}, tbuf = {};
  const fetched = Promise.all(['drone'].map(k => fetch('tour-snd/' + k + '.mp3').then(r => r.arrayBuffer()).then(b => { raw[k] = b; })));
  const play = (name, dest, gain, rate, offset, dur, loop) => {
    const b = tbuf[name]; if (!b) return null;
    const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = gain;
    s.connect(g); g.connect(dest);
    if (loop) { s.loop = true; s.loopStart = 0.1; s.loopEnd = 0.1 + loop; s.start(AC.currentTime, offset); } else s.start(AC.currentTime, offset, dur);
    return g;
  };

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
          const drone = play('drone', master, 0.0001, 0.8, 0.1, 0, 4);        // a low drone fades in: a recording of mains hum, slowed
          if (drone) { drone.gain.setTargetAtTime(1.6, AC.currentTime, 1.1); drone.gain.setTargetAtTime(0.0001, AC.currentTime + 6.6, 0.9); }
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
      for (let t = 2.5; t <= 13.01; t += 0.5) { const a = smooth(3.2, 12.8, t) * TAU; look.push({ t, d: [Math.sin(a), 0.03 + 0.07 * Math.sin(a * 0.5), Math.cos(a)], w: 1 }); }
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
  const enter = i => {                                              // start scene i of the list
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
    if (!st.go) go(); else if (e.code === 'Escape') finish();
  };
  const finish = () => {                                            // hand the camera back to the page's own cinematic flight
    if (done) return; done = true;
    stepCine = pageStep; removeEventListener('keydown', onKey, true); keys.KeyF = false; cine.pan = 0;
    S.glitch = keep.glitch; refreshUI(); fx.nextFlash = 5; started = true;
    canvas.style.cursor = ''; $('ui').style.display = ''; $('hint').style.display = ''; $('hint').classList.remove('fade');
    setTimeout(() => $('hint').classList.add('fade'), 6000);
    master.gain.setTargetAtTime(0.42, AC.currentTime, 1.2);
    for (const e of els) e.remove();
    startCine();
  };

  const p = new V(), q = new V(), f2 = new V(), tg = new V(), up = new V(), back = new V(), m4 = new THREE.Matrix4(), qr = new THREE.Quaternion();
  stepCine = function (dt, rdt) {
    if (!st.go) { camera.position.copy(P.pos); return; }             // waiting for the click
    st.t += rdt; st.n++;
    if (st.n === (li > 0 ? 3 : 20)) { started = true; if (li > 0) fade = 1; }
    const t = st.t, dur = list[li][1], more = li + 1 < list.length;
    if (t >= dur) { if (more) { enter(li + 1); fader.style.opacity = 1; } else finish(); return; }
    fader.style.opacity = Math.max(more ? clamp((t - (dur - 0.35)) / 0.35, 0, 1) : 0, li > 0 ? clamp(-t / 0.4, 0, 1) : 0);   // black between scenes
    if (more && t > dur - 0.4 && !sc.duck) { sc.duck = true; master.gain.setTargetAtTime(0.03, AC.currentTime, 0.1); }
    if (li > 0 && t > -0.45 && !sc.up) { sc.up = true; master.gain.setTargetAtTime(0.42, AC.currentTime, 0.15); }
    const first = st.n === 1 || segAt(t) !== segI; segI = segAt(t);  // the first frame of a scene, or a cut inside it
    if (sc.frame) sc.frame(t);
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
    const lvl = 1 - smooth(0.8, 0.97, Math.abs(f.y));
    if (lvl > 0) {
      up.crossVectors(f, WORLD_UP).normalize();
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
    st.roll = damp(st.roll, clamp(Math.atan(P.yawRate * v * Math.hypot(f.x, f.z) / 45), -0.5, 0.5), 3, rdt); P.roll = st.roll;   // a gentle bank
    back.copy(f).negate();
    camera.quaternion.setFromRotationMatrix(m4.makeBasis(st.right, up, back)).multiply(qr.setFromAxisAngle(Z_AXIS, st.roll));
    camera.position.copy(p);
    while (st.evi < sc.ev.length && sc.ev[st.evi][0] <= t) sc.ev[st.evi++][1]();
  };

  cineOn = true; cine.pan = 0;
  canvas.style.cursor = 'none'; $('ui').style.display = 'none'; $('hint').style.display = 'none'; $('intro').style.display = 'none';
  enter(0);
  // a browser plays no sound before a click, so the tour waits for one
  const gate = mk(`position:fixed;inset:0;z-index:30;background:#000;display:flex;flex-direction:column;gap:2vh;align-items:center;justify-content:center;cursor:pointer;font:700 2.6vh ${MONO};color:${GREEN};letter-spacing:.3em;text-shadow:0 0 1.2vh rgba(57,255,122,.7)`);
  gate.innerHTML = `<div>CLICK TO START</div><div style="font-size:1.5vh;opacity:.5">${D.scene.toUpperCase()} &middot; ESC ENDS IT</div>`;
  const go = () => {
    if (st.go) return;
    startAudio(); fetched.then(() => { for (const k in raw) AC.decodeAudioData(raw[k]).then(b => { tbuf[k] = b; }); });
    gate.remove(); st.go = true; worldT = W0[list[0][0]];          // the wait at the gate does not count
  };
  gate.addEventListener('click', go);
  addEventListener('keydown', onKey, true);
})()
