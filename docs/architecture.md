# Architecture

## Technology

- **Vite** for the development server and the build. The code is plain JavaScript modules, with no framework.
- **Three.js r160** from npm, on **WebGL2**. Three.js supplies the renderer, the math and the buffers. Every material is a hand-written GLSL shader.
- **Instanced rendering.** The city is boxes, cylinders and quads drawn in a few hundred draw calls.
- **Ray-marched volumetric clouds** at half resolution, smoothed over time.
- **An HDR pipeline:** planar reflection, bloom, motion blur, ACES tone mapping and a film grade.
- **Web Audio** for sound. The script loops, filters, pans and mixes recordings. It generates no sound.
- **Deterministic generation.** A 32 bit seed decides every building.
- **No server code.** The built site is static files: 5 MB, of which the music is 3.8 MB.

## Layout

`index.html` has the markup of the interface: statistics, the switches, a hint line, touch controls and the intro text.
It loads `src/style.css` and `src/main.js`. Every other file in `src/` is a module that `main.js` imports, directly or through another module.

| Module | Content |
|---|---|
| `core.js` | Sizes of the world, hash functions, a seeded random generator. |
| `settings.js` | The seed from the address, and the switches. |
| `state.js` | State that several modules read and write: the clocks, the flyer `P`, the keys, and the state of cinematic flight and of the world build. |
| `glyphs.js` | An 8×8 texture of mirrored katakana and digits, drawn on a canvas. |
| `renderer.js` | The WebGL renderer, one uniform object `U` that every scene shader shares, and `mkMat`. |
| `shaders/` | The GLSL of each material, as strings. `shaders/common.js` is the part that all of them share. See [rendering.md](rendering.md). |
| `materials.js` | One `ShaderMaterial` for each kind of thing that is drawn. |
| `clouds.js` | Two noise textures, and the textures of the moon and the Milky Way. |
| `scene.js` | Cameras and the meshes that exist once: ground, sky, stars, rain, steam, cars. |
| `world/city.js` | The generator. See [world.md](world.md). |
| `world/chunks.js` | Streaming, level of detail, the far field, the recompile wave, the world build. |
| `world/traffic.js`, `world/trains.js` | Cars, trains and every ribbon of light. |
| `pipeline.js` | Render targets, the post-processing passes, and `renderScene()`. |
| `flight/manual.js`, `flight/cine.js` | Manual flight and cinematic flight. See [flight.md](flight.md). |
| `audio.js` | See [audio.md](audio.md). |
| `fx.js` | Glitches and lightning. |
| `ui.js`, `intro.js`, `input.js` | The switches, the intro text, and keys, mouse and touch. |
| `main.js` | The frame function. It also loads a scripted tour when the address asks for one. |
| `tours/` | The scripted tours. See [tours.md](tours.md). |

Files in `public/` are not modules. The page fetches them: the sounds, the music, the star catalogue and the images of the moon and the Milky Way.

## Rules of the module graph

- A module imports what it uses. No module reads a global of another one.
- A module may read a value that another module exports, but only the owner assigns to it. Where another module must change it, the owner exports a function for that: `setSeed`, `setEpoch`, `resetRibs`, `steamChanged`.
- State that several modules write is a property of an object in `state.js`: `clock.world`, `view.started`, `cine.on`. An imported name cannot be assigned to. A property of an imported object can.
- `main.js` imports the modules in the order in which they must run. Some modules do work when they load: `intro.js` starts the intro, `input.js` adds the listeners.
- `scene.js` waits for the star catalogue with a top-level `await`. The modules that use the scene wait with it.

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
3. Move the camera: `cine.move` in cinematic flight (the page's `stepCine`, or the function of a tour), else `stepManual`.
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

The page was developed and measured on an Apple M4 Max, where it holds 60 FPS at 1920×1080. Only Chrome on that machine was tested.
