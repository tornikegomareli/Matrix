# Architecture

## One file

`code-city.html` holds everything the world needs:

1. Markup and CSS for the interface: statistics, four toggles, a hint line, touch controls and the intro text.
2. One `<script type="module">`. It imports Three.js r160 from cdnjs. It has about 2,600 lines.
3. Data blocks after the script, as `<script type="text/plain">` elements with base64 text: the star catalogue, two images and twelve sound files.

The module runs top to bottom. Its sections are marked with comment rules, in this order:

| Section | Content |
|---|---|
| constants + helpers | Sizes of the world, hash functions, a seeded random generator. |
| seed + settings | The seed from the address, and the four settings. |
| glyph atlas | An 8×8 texture of mirrored katakana and digits, drawn on a canvas. |
| renderer + shared uniforms | The WebGL renderer and one uniform object, `U`, that every scene shader shares. |
| GLSL | The shaders. See [rendering.md](rendering.md). |
| cloud noise | Two noise textures and the textures for the moon and the Milky Way. |
| scene | Cameras and the meshes that exist once: ground, sky, stars, rain, steam, cars. |
| procedural city | The generator. See [world.md](world.md). |
| chunks | Streaming, level of detail, the far field, the recompile wave. |
| traffic, trains | Cars, trains and every ribbon of light. |
| post-processing | Render targets and the passes. |
| player, flight | Input, manual flight, cinematic flight. See [flight.md](flight.md). |
| audio | See [audio.md](audio.md). |
| glitches + lightning | Timed effects. |
| UI, intro, main loop | The frame function. |
| scripted tours | A loader for `tour.js`. See [tours.md](tours.md). |

## Shared uniforms

All scene materials are `ShaderMaterial`s built by one helper, `mkMat`. Each one receives the same object `U`.
The frame function writes a value once and every shader reads it.

The main entries:

| Uniform | Meaning |
|---|---|
| `uTime`, `uRTime` | World time (slows in bullet time) and real time. |
| `uMirror` | `-1` during the mirrored reflection pass, else `1`. |
| `uFogCol`, `uFogDen`, `uFogH`, `uFogFar` | Fog colour, density, ground mist, and the distance of the far fade. |
| `uAbove`, `uCloud`, `uRainK` | How far the camera is above the cloud deck, how deep it is in cloud, and how much rain falls here. |
| `uFlash`, `uFlashDir`, `uFlashPos` | The current lightning flash. |
| `uWave` | The recompile front: direction, position, active. |
| `uBuild` | The front that builds the world at the start: centre, radius, active. |
| `uNear` | The rectangle that loaded chunks cover. The far field leaves it out. |
| `tDepth`, `uNF` | The depth texture of the scene and the near and far planes. |
| `uCover`, `uNoise3` | The cloud coverage map and the 3D cloud noise. |

## The frame

`frame(now)` runs once per display refresh. In order:

1. Measure the frame time. Every half second, update the statistics and check the frame rate.
2. Update bullet time. World time advances at 10% of real time while it is active.
3. Move the camera: `stepCine` or `stepManual`.
4. Stream the city: load up to four chunks, continue the far-field rebuild.
5. Simulate traffic, the recompile wave, the world build, trains, searchlights, lightning.
6. Write the shared uniforms.
7. Render. See the next section.
8. Update the audio parameters.

## Render passes

`renderScene()` draws one frame in seven steps.

```
1. reflection   the scene from a mirrored camera            -> rtRefl   (half size)
2. main         sky, stars, ground, buildings, cars          -> rtScene  (full size, 4x MSAA, depth texture)
3. clouds       ray march against the scene depth            -> rtCloud  (half size)
                blend with the last frame                    -> rtCloudAcc
                lay over the scene                           -> rtMain
                draw everything that glows on top            -> rtMain
4. bloom        five levels down, then up                    -> rtBloom[0..4]
5. composite    motion blur, bloom, tone map, grade, trails  -> rtAcc
6. remember     store the frame for the deja-vu glitch       -> rtRing (12 frames)
7. present      lens effects, vignette, gamma, grain         -> screen
```

Two details shape this order.

Clouds are drawn after the solid scene, because the march needs the scene depth to know where to stop.
Lamps, headlights, rain, steam and lightning bolts are transparent and additive. If they were drawn in the main pass, the clouds would cover them.
They are on a second Three.js layer and drawn after the clouds, into a target with no depth buffer.
Each of those fragment shaders reads the scene depth texture and discards itself when something solid is in front (`hidden()` in the shared GLSL).

## Resolution and frame rate

`resize()` sets the size of the render targets.
It caps the picture at 2.3 million pixels (1.0 million on touch devices) and at a device pixel ratio of 2.
The address parameter `pixels` sets another cap, in millions. `?pixels=8.3` lets a recording render 3840×2160 in full.
If the frame rate stays below 48 for 1.5 seconds, the page multiplies the size by 0.85. The floor is 55%.
