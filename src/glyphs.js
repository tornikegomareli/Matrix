// The glyph atlas: 8 by 8 signs, mirrored like the film
import * as THREE from 'three';
import { clamp } from './core.js';

export function makeGlyphAtlas(maxAniso) {
  const N = 8, C = 64, cv = document.createElement('canvas');
  cv.width = cv.height = N * C;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  const kata = 'ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾜ';
  const chars = (kata + '0123456789:.=*+-<>|"').slice(0, N * N).padEnd(N * N, '7');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 46px "Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","MS Gothic","Noto Sans Mono CJK JP","Noto Sans JP",monospace';
  for (let i = 0; i < N * N; i++) {
    const ch = chars[i], cx = (i % N + 0.5) * C, cy = (Math.floor(i / N) + 0.5) * C;
    const w = Math.max(8, g.measureText(ch).width), sx = clamp(40 / w, 0.7, 1.7);
    g.save(); g.translate(cx, cy + 2); g.scale(-sx, 1); g.fillText(ch, 0, 0); g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = Math.min(8, maxAniso);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
