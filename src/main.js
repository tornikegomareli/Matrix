// The entry of the page, and the loop that runs once for each frame
// The imports stand in the order in which the modules must run. A module that is imported without a name is imported to run it.
import { $, CELL, CLOUD_Y, DECK_TOP, FOG_FAR, MACH, clamp, damp, lerp, smooth } from './core.js';
import { seedHex } from './settings.js';
import { P, build, cine, clock, keys, nearest, touch, view } from './state.js';
import { U } from './renderer.js';
import { matGround, matRain } from './materials.js';
import { cloudAt } from './clouds.js';
import { camera } from './scene.js';
import './world/city.js';
import { sonicBoom, updateAudio } from './audio.js';
import { resetCity, startBuild, updateBuild, updateChunks, updateFar, updateWave } from './world/chunks.js';
import { resetTraffic, updateTraffic } from './world/traffic.js';
import { resetRibs, ribGeo, ribN, trainGeo, updateBeams, updateTrains } from './world/trains.js';
import { matComp, matFinal, renderScene, replay, resize } from './pipeline.js';
import { stepManual } from './flight/manual.js';
import './flight/cine.js';
import { fx, updateFx } from './fx.js';
import { placeStart, refreshUI } from './ui.js';
import './intro.js';
import './input.js';

let last = performance.now(), fpsT = last, fpsN = 0, fps = 60, lowN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = clamp((now - last) / 1000, 0.001, 0.05); last = now;
  clock.real += rdt; fpsN++;
  if (now - fpsT >= 500) {
    fps = fpsN * 1000 / (now - fpsT); fpsT = now; fpsN = 0;
    $('stats').textContent = `FPS ${fps.toFixed(0)}\nSEED ${seedHex()}\nMACH ${(P.speed / MACH).toFixed(2)}`
      + (cine.on ? '\nCINEMATIC' : '') + (P.slow > 0.5 ? '\nBULLET TIME' : '');
    // hold 60 FPS: if the frame rate stays low, render fewer pixels
    if (view.started && clock.real > 8 && !document.hidden && fps < 48) { if (++lowN >= 3 && view.quality > 0.56) { view.quality = Math.max(0.55, view.quality * 0.85); lowN = 0; resize(); } }
    else lowN = 0;
  }
  const fu = matFinal.uniforms;
  fu.uTime.value = clock.real;
  if (replay.left > 0) {                                          // deja vu: the world holds still while stored frames run again
    fu.uScan.value = 0.55; fu.uCA.value = 0.006; fu.uTear.value = 0;
    renderScene();
    if (replay.left === 0) { fx.scan = 0.6; fx.tear = 0.5; }
    return;
  }
  P.slow = damp(P.slow, (keys.KeyF || touch.slow) ? 1 : 0, 7, rdt);
  const dt = rdt * lerp(1, 0.1, P.slow) * clock.rate, cdt = rdt * lerp(1, cine.on ? 0.22 : 0.4, P.slow);   // world at 10%, the flyer keeps some pace
  clock.world += dt; clock.rain += rdt * lerp(1, 0.012, P.slow) * clock.rate;            // rain all but freezes
  if (cine.on) cine.move(cdt, rdt); else stepManual(cdt, rdt);
  const vs = cine.on ? 1 : cdt / rdt;
  P.speed = P.vel.length();
  if (P.boomArmed && P.speed > MACH * 0.92) { P.boomArmed = false; sonicBoom(); }
  if (P.speed < MACH * 0.6) P.boomArmed = true;
  const fovT = 72 + 42 * P.boost * smooth(0.12, 0.9, P.speed / MACH) - 7 * P.slow + view.fovAdd;
  if (Math.abs(fovT - camera.fov) > 0.02) { camera.fov = damp(camera.fov, fovT, 5, rdt); camera.updateProjectionMatrix(); }
  P.shake = Math.max(0, P.shake - rdt * 1.8);
  const shk = 0.03 * P.shake * P.shake;                           // a hit shakes the camera; flight itself is smooth
  if (shk > 1e-5) {
    camera.rotateX(shk * (Math.sin(clock.real * 47.1) + Math.sin(clock.real * 83.3 + 1.3)));
    camera.rotateY(shk * (Math.sin(clock.real * 53.7 + 2.1) + Math.sin(clock.real * 71.9)));
    camera.rotateZ(shk * 0.6 * Math.sin(clock.real * 39.3 + 0.7));
  }
  camera.updateMatrixWorld();

  const px = P.pos.x, pz = P.pos.z;
  updateChunks(px, pz, view.started ? 4 : 400);
  updateFar(px, pz);
  updateTraffic(dt, clock.world, px, pz, P.vel.x, P.vel.z);
  updateWave(dt); updateBuild(dt);
  resetRibs();
  if (build.on && build.r < 2500) { trainGeo.instanceCount = 0; nearest.train = 1e9; }           // trains and beams wait until the city stands
  else { updateTrains(clock.world, px, P.pos.y, pz); updateBeams(clock.world); }
  updateFx(rdt);
  ribGeo.instanceCount = ribN;
  for (const k in ribGeo.attributes) if (ribGeo.attributes[k].isInstancedBufferAttribute) ribGeo.attributes[k].needsUpdate = true;

  U.uTime.value = clock.world; U.uRTime.value = clock.real; U.uBoost.value = P.boost; U.uSlow.value = Math.max(P.slow, 1 - Math.min(1, Math.abs(clock.rate)));   // a world that holds still hangs its drops like bullet time
  U.uCamVel.value.copy(P.vel).multiplyScalar(vs);
  const alt = P.pos.y;
  U.uCloud.value = damp(U.uCloud.value, cloudAt(P.pos.x, alt, P.pos.z), 5, rdt);          // how deep in cloud the camera is
  U.uAbove.value = smooth(CLOUD_Y + 60, DECK_TOP - 40, alt);
  U.uRainK.value = (1 - smooth(CLOUD_Y - 70, CLOUD_Y + 20, alt)) * (build.on ? smooth(500, 1500, build.r) : 1);   // rain falls from the cloud base, once there is a city to fall on
  const fa = view.fogAlt === null ? alt : view.fogAlt;
  U.uFogFar.value = lerp(FOG_FAR, 3900, smooth(140, 900, fa)); U.uFogDen.value = lerp(0.0009, 0.00013, smooth(100, 1100, fa));
  const near = lerp(0.5, 10, smooth(800, 1600, alt));
  if (Math.abs(near - camera.near) > 0.01) { camera.near = near; camera.updateProjectionMatrix(); }
  U.uNF.value.set(camera.near, camera.far);
  matRain.uniforms.uRainT.value = clock.rain; matRain.uniforms.uRainScale.value = lerp(1, 0.012, P.slow) * clock.rate;
  matGround.uniforms.uCenter.value.set(Math.round(px / CELL) * CELL, Math.round(pz / CELL) * CELL);
  const cu = matComp.uniforms, sn = Math.min(1.7, P.speed * vs / MACH), hf = camera.fov * Math.PI / 180;
  cu.uTime.value = clock.real; cu.uSpeedN.value = sn * smooth(0.05, 0.35, sn);
  cu.uTrail.value = 0.55 * P.slow;
  cu.uRot.value.set(clamp(P.yawRate * rdt * 0.25 / (hf * camera.aspect), -0.05, 0.05), clamp(-P.pitchRate * rdt * 0.25 / hf, -0.05, 0.05));
  fu.uScan.value = fx.scan; fu.uTear.value = fx.tear; fu.uCA.value = fx.ca + 0.0012 * P.boost + 0.0015 * P.slow;
  view.fade = view.started ? Math.min(1, view.fade + rdt / 2.4) : 0; fu.uFade.value = view.fade * view.fade * (3 - 2 * view.fade);
  renderScene();
  updateAudio(rdt);
}

addEventListener('resize', resize);
resize(); resetCity(); placeStart(); resetTraffic(P.pos.x, P.pos.z); refreshUI();
startBuild(P.pos.x, P.pos.z, 0); build.auto = true;               // nothing stands until the intro ends
requestAnimationFrame(frame);

// A scripted tour: ?tour=film, reel, loop or poster. Its code is loaded only then.
{
  const m = /[?&]tour=([a-z]+)/.exec(location.search);
  if (m) import('./tours/index.js').then(t => t.start(m[1]));
}
