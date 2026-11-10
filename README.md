<h1 align="center">Follow the white Rabbit</h1>

<h3 align="center">An endless night in the Matrix</h3>

<p align="center">
  <img src=".github/assets/skyline.jpg" width="100%" alt="Lightning strikes a spire over a night city of lit windows, in heavy rain" />
</p>

Matrix Vibe is a 3D world that runs in the browser. It generates the city, the clouds, the weather, and the traffic as you fly through a nightscape inspired by the 90s film <a href="https://en.wikipedia.org/wiki/The_Matrix">The Matrix</a>. Everything shares that same distinctive vibe and color palette.

<strong><a href="https://matrix-vibe.whoopscope.workers.dev">Fly it now</a></strong>

## Experiment

This project is an experiment to test and evaluate Claude’s Fable 5.2 model. You can read more here: <a href="https://www.anthropic.com/claude-fable-and-mythos-5-2">Claude Fable 5.2</a>.

[How it was written](docs/experiment.md)

<p align="center">
  <img src=".github/assets/clouds.jpg" width="100%" alt="The grid of the city seen from far above, through a gap in the clouds, with lightning inside one cloud" />
</p>

## Three films inside

Each “film” is a scripted camera path with timed events, all playing live in the same world: [the film](https://matrix-vibe.whoopscope.workers.dev/?tour=film), [the reel](https://matrix-vibe.whoopscope.workers.dev/?tour=reel), and [one night that repeats](https://matrix-vibe.whoopscope.workers.dev/?tour=loop). Click to start any of them.

<p align="center">
  <img src=".github/assets/glass.jpg" width="100%" alt="A glass footbridge over an avenue. Its broken panes fly back into place while time runs backwards" />
</p>

## Fly

- `W` `A` `S` `D` and the mouse to fly. `Shift` boosts, and `Space` launches upward.
- `F` slows time. `G` recompiles the city. `R` generates a new city.
- `C` returns control to the cinematic flight.

All keys are listed in [docs/flight.md](docs/flight.md).

## Run it

```sh
npm install
npm run dev
```

`npm run build` writes a static site to `dist/`, and `npm run deploy` publishes it on Cloudflare.  
The code is plain JavaScript modules with Vite and Three.js. It has no server code, and it needs a browser with WebGL2.

## Documents

[The experiment](docs/experiment.md) · [Architecture](docs/architecture.md) · [World](docs/world.md) · [Rendering](docs/rendering.md) · [Sky and clouds](docs/sky-and-clouds.md) · [Flight](docs/flight.md) · [Audio](docs/audio.md) · [Tours](docs/tours.md) · [Recording](docs/recording.md) · [Assets and licences](docs/assets.md)
