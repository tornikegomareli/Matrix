# matrix-vibe

An endless night city in the rain, graded like the simulated world of the Matrix films. You fly through it in the browser.

**Live:** https://matrix-vibe.whoopscope.workers.dev

Everything you see is generated in the browser: the city, the clouds, the weather and the traffic.
Every sound effect is a recording, and a music track plays under them. The stars, the moon and the Milky Way come from real data.

## An experiment

This project exists to test and measure one AI model: Claude Fable 5.2 from Anthropic, running in Claude Code.
The question was how far the model can take a real-time 3D world when a person only directs it.

The person wrote requests in plain language: what the world must look like, what was wrong with the last version, and the scripts of two short films.
The model wrote the code, the shaders, the films, the video recorder and these documents.
It also found the sound recordings and checked their licences. The person supplied the music track.

The repository is the result of that test:

| What | Amount |
|---|---|
| JavaScript and GLSL | 3,900 lines in 38 modules |
| Scripted films | Three (41 s, 70 s and 45 s) and one still scene |
| Video recorder | 160 lines. It is frame-exact and records sound. |
| Documents | Nine, in `docs/` |
| Recordings | 20 sound effects, each with its source and licence |
| History | More than 70 commits, one logical change in each |
| Time | The conversation ran for about 22 hours, pauses included |

## How it was written

**Directions in, code out.** The person described a result. The model planned the change, wrote it, ran it and reported what it had checked.
The person looked at the result and answered with the next request.

**The model checked its own pictures.** It did not watch a screen. It started Chrome without a window on the real GPU, stepped the page on a virtual clock, took frames at exact times and looked at them.
The video recorder in `tools/` uses the same method. See [docs/recording.md](docs/recording.md).

**The model measured the sound.** It cannot hear. It rendered the sound of a film offline and measured levels. One result: the music stays at least 6 dB below everything else.

**The person set rules.**

- Every sound is a recording. Nothing is synthesised.
- One logical change per commit.
- The documents are in plain technical English.

**The refactor was proven, not trusted.** The first version was one HTML file and one script, 3,800 lines together.
The model split it into modules in four steps. After each step, 26 frames from the four tours and frames of free flight had to be bit-identical to the frames of the page before. They were.

## What went wrong

These are the main failures.

- **The clouds took four attempts.** Three designs of the model's own looked like slabs. The fourth follows a published method (Schneider's "Nubis") and works.
- **A 40 minute 4K recording was lost.** A test that the model ran at the same time took over the recorder's browser. The recorder now lets Chrome choose a port of its own.
- **Motion was judged from still frames.** The person found what frames do not show: a camera turn that was too fast, and flight that was not smooth.
- **Taste needed the person.** The person rejected several pictures for the first frame of a video before one was accepted.
- **Not tested:** phones, weak GPUs, Safari and Firefox.

## How it is built

- **Vite** for the development server and the build. The code is plain JavaScript modules, with no framework.
- **Three.js r160** from npm, on **WebGL2**. Three.js supplies the renderer, the math and the buffers. Every material is a hand-written GLSL shader.
- **Instanced rendering.** The city is boxes, cylinders and quads drawn in a few hundred draw calls.
- **Ray-marched volumetric clouds** at half resolution, smoothed over time.
- **An HDR pipeline:** planar reflection, bloom, motion blur, ACES tone mapping and a film grade.
- **Web Audio** for sound. The script loops, filters, pans and mixes recordings. It generates no sound.
- **Deterministic generation.** A 32 bit seed decides every building.
- **No server code.** The built site is static files: 5 MB, of which the music is 3.8 MB.

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

The same addresses work on the live site.
Add `#seed=C0DEC17E` (any eight hex digits) to get the same city again.
Sound starts with the first click, because browsers block it before that.

## Build and deploy

```sh
npm run build      # writes the site to dist/
npm run preview    # serves dist/ at http://localhost:4173/
npm run deploy     # builds, then uploads dist/ to Cloudflare
```

`dist/` is a static site. A static host can serve it from any folder.
The live site is on Cloudflare Workers, as static files. `wrangler.jsonc` names the project and the folder to upload.
`npm run deploy` needs a Cloudflare login: `npx wrangler login`.

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
| `wrangler.jsonc` | The deployment to Cloudflare. |
| `code-city-1080p60.mp4` | A recording of the first version. It does not show the current look. |
| `docs/` | How it works. |

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
The page was developed and measured on an Apple M4 Max, where it holds 60 FPS at 1920×1080. Only Chrome on that machine was tested.
If the frame rate stays below 48, the page renders fewer pixels.
