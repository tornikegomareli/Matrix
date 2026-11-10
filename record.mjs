// Frame-exact recorder: steps the page on a virtual 60 Hz clock in headless Chrome, screenshots every frame,
// renders the page's Web Audio through an OfflineAudioContext in lockstep, and encodes both with ffmpeg.
// usage: node record.mjs <url> <out.mp4> <seconds> [W] [H] ['<keys json: [{t,type,code}]>'] [crf] [maxrate in Mbit/s] [first picture.png]
// The first picture is a PNG of the size of the video. It is put in front of the recording for a quarter of a second, so it is the first frame.
// A tour is recorded from its first picture: the frames before it (the wait for a key, a scene that is made ready behind black) are left out.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const [url, out, secs, W = '1920', H = '1080', keysJson = '[]', crf = '15', rate = '24', first = ''] = process.argv.slice(2);
const FPS = 60, N = Math.round(+secs * FPS), keys = JSON.parse(keysJson), PREVIEW = +W < 1000;
const dir = path.dirname(out), base = out.replace(/\.mp4$/, '');
const FADE = 0.6;
const HOLD = first ? 15 : 0, LEN = +secs + HOLD / FPS;             // frames the first picture is held, and the length of the video with it
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHIM = `(() => {
  const FPS = 60, N = ${N}, SR = 48000;
  let frame = 0, vt = 0, tid = 0, rafQ = [], lead = 0;          // lead: frames that ran before the recording began
  const realRAF = window.requestAnimationFrame.bind(window), timers = new Map();
  window.requestAnimationFrame = fn => { rafQ.push(fn); return rafQ.length; };
  window.setTimeout = (fn, ms = 0, ...a) => { timers.set(++tid, { t: vt + ms, fn, a }); return tid; };
  window.clearTimeout = id => { timers.delete(id); };
  performance.now = () => vt;
  let s = 0x9E3779B9;
  Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const off = new OfflineAudioContext(2, Math.round((N / FPS + 45) * SR), SR);   // room for the frames before the recording
  window.AudioContext = function () { return off; };
  const resume = off.resume.bind(off); off.resume = () => Promise.resolve();   // only the recorder runs this clock: a page that resumes its audio would let it run ahead
  let aStarted = false, aDone = null;
  const anims = new Map();
  const syncAnims = () => {
    for (const a of document.getAnimations()) {
      if (!anims.has(a)) { const c = a.currentTime || 0; a.pause(); anims.set(a, vt - c); }
      a.currentTime = vt - anims.get(a);
    }
  };
  window.__ready = () => rafQ.length > 0;
  window.__live = () => !/[?&]tour=/.test(location.search) || !!(window.__tour && __tour.go && __tour.t >= 0 && __tour.n >= 4);   // a tour shows its first picture
  window.__lead = n => { lead = n; };
  window.__step = async events => {
    await new Promise(r => realRAF(r));
    if (frame === 0) document.getElementById('gl').click();
    for (const e of events) window.dispatchEvent(new KeyboardEvent(e.type, { code: e.code, bubbles: true }));
    vt = frame * 1000 / FPS;
    for (let guard = 0; guard < 50; guard++) {
      const due = [...timers].filter(([, v]) => v.t <= vt).sort((x, y) => x[1].t - y[1].t);
      if (!due.length) break;
      for (const [id, v] of due) { timers.delete(id); v.fn(...v.a); }
      await null; await null; await null;
    }
    const q = rafQ; rafQ = []; for (const fn of q) fn(vt);
    syncAnims();
    await new Promise(r => realRAF(() => realRAF(r)));
    frame++;
    return document.getElementById('stats').textContent.replace(/\\n/g, ' | ');
  };
  window.__audio = async () => {                                  // render audio up to the start of the next frame
    if (frame >= N + lead) {
      if (!aStarted) aDone = off.startRendering(); else resume();
      const buf = await aDone, a0 = Math.round(lead / FPS * SR), n = Math.round(N / FPS * SR), L = buf.getChannelData(0).subarray(a0, a0 + n), R = buf.getChannelData(1).subarray(a0, a0 + n);
      const pcm = new Int16Array(n * 2); let peak = 0;
      for (let i = 0; i < n; i++) {
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        pcm[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767;
      }
      const u8 = new Uint8Array(pcm.buffer); let bin = '';
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      window.__pcm = btoa(bin);
      return [window.__pcm.length, peak];
    }
    const p = off.suspend(frame / FPS);
    if (!aStarted) { aStarted = true; aDone = off.startRendering(); } else resume();
    await p; return off.currentTime;
  };
})()`;

const prof = path.join(dir, 'chrome-profile-' + process.pid);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, `--window-size=${W},${H}`, '--force-device-scale-factor=1',
  '--mute-audio', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--enable-gpu', '--ignore-gpu-blocklist',
  '--use-angle=metal', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank',
], { stdio: 'ignore' });
const cleanup = async () => { try { chrome.kill(); } catch (e) { /* gone */ } await sleep(500); try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch (e) { /* leftover profile */ } };

// Chrome takes a free port and writes its number into its profile folder. A port chosen here could be the port of another Chrome,
// and this script would then drive that one, or that one's script would drive this page
let target = null;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(150);
  try { const port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0]; target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* not up yet */ }
}
if (!target) { console.log('CHROME_DID_NOT_START'); await cleanup(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0, navs = 0; const pending = new Map(), logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(`[${m.params.type}] ` + m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
  if (m.method === 'Page.frameNavigated' && !m.params.frame.parentId) navs++;
  if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error('page: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result?.result?.value;
};

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await send('Page.addScriptToEvaluateOnNewDocument', { source: SHIM });
await send('Page.navigate', { url });
let ready = false;
for (let i = 0; i < 200 && !ready; i++) { await sleep(150); try { ready = await evalJs('!!(window.__ready && __ready())'); } catch (e) { /* navigating */ } }
if (!ready) { console.log('PAGE_NOT_READY', logs.join('\n')); await cleanup(); process.exit(1); }
await evalJs('document.fonts.ready.then(() => 1)');

const fmt = PREVIEW ? 'jpeg' : 'png';
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', PREVIEW ? 'mjpeg' : 'png', '-i', '-',
  '-vf', `scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p,fade=t=out:st=${LEN - FADE}:d=${FADE}`,
  '-c:v', 'libx264', '-preset', PREVIEW ? 'veryfast' : 'slow', '-crf', PREVIEW ? '23' : crf, ...(PREVIEW ? [] : ['-maxrate', rate + 'M', '-bufsize', 2 * rate + 'M']),
  '-profile:v', 'high', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-an', base + '.video.mp4'],
  { stdio: ['pipe', 'inherit', 'inherit'] });

const evAt = k => JSON.stringify(keys.filter(e => Math.round(e.t * FPS) === k));
let lead = 0;                                                     // run a tour to its first picture; these frames are not recorded
for (; lead < 2400 && !(await evalJs('__live()')); lead++) { await evalJs(`__step(${evAt(lead)})`); await evalJs('__audio()'); }
await evalJs(`__lead(${lead})`);
if (HOLD) { const pic = fs.readFileSync(first); for (let i = 0; i < HOLD; i++) if (!ff.stdin.write(pic)) await once(ff.stdin, 'drain'); }
const t0 = Date.now(), navs0 = navs; let prevHash = '', dups = 0, lastStats = ''; const dupAt = [];
for (let k = 0; k < N; k++) {
  const stats = await evalJs(`__step(${evAt(k + lead)})`);
  const r = await send('Page.captureScreenshot', PREVIEW ? { format: fmt, quality: 82 } : { format: fmt, optimizeForSpeed: true });
  if (!r.result?.data) { console.log('SCREENSHOT_FAILED at frame', k, JSON.stringify(r.error || {})); break; }
  if (navs !== navs0) { console.log('PAGE_RELOADED at frame', k, '- the recording is not complete'); ff.stdin.end(); await cleanup(); process.exit(1); }
  const buf = Buffer.from(r.result.data, 'base64'), h = crypto.createHash('md5').update(buf).digest('hex');
  if (h === prevHash) { dups++; dupAt.push(k); } prevHash = h;
  if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
  if (k < N - 1) await evalJs('__audio()');
  if (stats !== lastStats || k % 300 === 0) { console.log(`t=${(k / FPS).toFixed(2)} ${stats}`); lastStats = stats; }
}
ff.stdin.end(); await once(ff, 'close');
const [b64len, peak] = await evalJs('__audio()');
let b64 = ''; for (let a = 0; a < b64len; a += 1 << 20) b64 += await evalJs(`__pcm.slice(${a}, ${a + (1 << 20)})`);
fs.writeFileSync(base + '.pcm', Buffer.concat([Buffer.alloc(Math.round(HOLD / FPS * 48000) * 4), Buffer.from(b64, 'base64')]));   // silence under the first picture
console.log('duplicates after 5 s:', dupAt.filter(k => k > 300).length, 'last duplicate frame:', dupAt.at(-1));
console.log(`frames=${N} framesBefore=${lead} duplicateFrames=${dups} audioPeak=${peak.toFixed(3)} captureSeconds=${((Date.now() - t0) / 1000).toFixed(0)}`);
console.log('LOGS (' + logs.length + '):'); for (const l of logs.slice(0, 30)) console.log('  ' + l.slice(0, 600));
ws.close(); await cleanup();

const mux = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', base + '.video.mp4', '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', base + '.pcm',
  '-c:v', 'copy', '-af', `afade=t=out:st=${LEN - FADE}:d=${FADE}`, '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
await once(mux, 'close');
console.log('WROTE', out, fs.statSync(out).size);
process.exit(0);
