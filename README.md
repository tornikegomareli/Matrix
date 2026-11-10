# matrix-vibe

An endless night city in the rain, graded like the simulated world of the Matrix films. You fly through it.
The page is a small Vite project: plain JavaScript modules and Three.js. It has no server code.

Everything you see is generated in the browser: the city, the clouds, the weather and the traffic.
Every sound effect is a recording, and a music track plays under them. The stars, the moon and the Milky Way come from real data.

## Run it

You need Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Vite prints the address of the page, by default `http://localhost:5173/`. Add one of these to it:

| Address | What it plays |
|---|---|
| `/` | The world. It flies by itself until you take the controls. |
| `/?tour=film` | A 41 second scripted film. |
| `/?tour=reel` | A 70 second scripted tour of the world. |
| `/?tour=loop` | A 45 second scripted film: one night that repeats. |
| `/?tour=poster` | A still scene: lightning over the skyline. The first frame of the reel video is a picture of it. |

Add `#seed=C0DEC17E` (any eight hex digits) to get the same city again.
Sound starts with the first click, because browsers block it before that.

## Build

```sh
npm run build      # writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4173/
```

`dist/` is a static site. A static host can serve it from any folder.

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
| `5` `6` | All sound, music |

On a touch screen there is a stick, a boost button, a time button and a cinematic button.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The markup of the page. |
| `src/` | The JavaScript modules and the styles. `src/main.js` is the entry. |
| `src/shaders/` | The GLSL of every material, as strings in modules. |
| `src/world/` | The city generator, chunk streaming, traffic and trains. |
| `src/flight/` | Manual flight and cinematic flight. |
| `src/tours/` | The scripted tours. The page loads them only when the address has `?tour=`. |
| `public/` | Files that the page fetches: the sounds, the music, the star catalogue and two sky images. |
| `tools/record.mjs` | A frame-exact video recorder for the page (Node.js, Chrome, ffmpeg). |
| `code-city-1080p60.mp4` | A recording of the first version. It does not show the current look. |
| `docs/` | How it works. |

## Technology

- **Vite** for the development server and the build. The code is plain JavaScript modules, with no framework.
- **Three.js r160** from npm, on **WebGL2**. Three.js supplies the renderer, the math and the buffers. Every material is a hand-written GLSL shader.
- **Instanced rendering.** The city is boxes, cylinders and quads drawn in a few hundred draw calls.
- **Ray-marched volumetric clouds** at half resolution, smoothed over time.
- **An HDR pipeline:** planar reflection, bloom, motion blur, ACES tone mapping and a film grade.
- **Web Audio** for sound. The script loops, filters, pans and mixes recordings. It generates no sound.
- **Deterministic generation.** A 32 bit seed decides every building.

## Documents

| Document | Subject |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The modules, the frame loop and the render passes. |
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
