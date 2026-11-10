# Code City

An endless night city in the rain, graded like the simulated world of the Matrix films. You fly through it.
The whole world is one HTML file. It has no build step and no server code.

Everything you see is generated in the browser: the city, the clouds, the weather and the traffic.
Everything you hear is a recording. The stars, the moon and the Milky Way come from real data.

## Run it

The page loads Three.js from a CDN, so it needs an internet connection.

```sh
python3 -m http.server 8931
```

Then open one of these addresses:

| Address | What it plays |
|---|---|
| `http://127.0.0.1:8931/code-city.html` | The world. It flies by itself until you take the controls. |
| `http://127.0.0.1:8931/code-city.html?tour=film` | A 41 second scripted film. |
| `http://127.0.0.1:8931/code-city.html?tour=reel` | A 70 second scripted tour of the world. |

Add `#seed=C0DEC17E` (any eight hex digits) to get the same city again.
You can also open `code-city.html` from disk. The tours need the local server.

Sound starts with the first click, because browsers block it before that.

## Controls

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| Mouse (click first) | Look |
| `Space` | Launch upward |
| `Shift` | Boost |
| `Q` / `E` | Down / up |
| `F` | Bullet time |
| `G` | Recompile the city |
| `C` | Cinematic flight on or off |
| `R` | New seed |
| `H` | Hide the interface |
| `1` `2` `3` `4` | Rain, traffic, glitches, amount of code |

On a touch screen there is a stick, a boost button, a time button and a cinematic button.

## Files

| File | Purpose |
|---|---|
| `code-city.html` | The world: markup, styles, one JavaScript module, all shaders, and the embedded data. |
| `tour.js` | The two scripted tours. The page loads it only when the address has `?tour=`. |
| `tour-snd/drone.mp3` | One sound that only the film uses. |
| `record.mjs` | A frame-exact video recorder for the page (Node.js, Chrome, ffmpeg). |
| `code-city-1080p60.mp4` | A recording of the first version. It does not show the current look. |
| `docs/` | How it works. |

## Technology

- **Three.js r160** as an ES module, on **WebGL2**. Three.js supplies the renderer, the math and the buffers. Every material is a hand-written GLSL shader.
- **Instanced rendering.** The city is boxes, cylinders and quads drawn in a few hundred draw calls.
- **Ray-marched volumetric clouds** at half resolution, smoothed over time.
- **An HDR pipeline:** planar reflection, bloom, motion blur, ACES tone mapping and a film grade.
- **Web Audio** for sound. The script loops, filters, pans and mixes recordings. It generates no sound.
- **Deterministic generation.** A 32 bit seed decides every building.

## Documents

| Document | Subject |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The file, the frame loop and the render passes. |
| [docs/world.md](docs/world.md) | How the city is generated, streamed and changed. |
| [docs/rendering.md](docs/rendering.md) | The shaders and the post-processing. |
| [docs/sky-and-clouds.md](docs/sky-and-clouds.md) | Stars, moon, Milky Way, clouds and lightning. |
| [docs/flight.md](docs/flight.md) | Manual flight, cinematic flight and bullet time. |
| [docs/audio.md](docs/audio.md) | The sound graph and what drives it. |
| [docs/tours.md](docs/tours.md) | The scripted tours and how to write one. |
| [docs/recording.md](docs/recording.md) | The video recorder. |
| [docs/assets.md](docs/assets.md) | Every external recording, image and data set, with its licence. |

## Requirements

A current Chrome, Edge, Firefox or Safari with WebGL2.
The page was developed and measured on an Apple M4 Max, where it holds 60 FPS at 1920×1080.
If the frame rate stays below 48, the page renders fewer pixels.
