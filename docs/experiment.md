# The experiment

This project exists to test and measure one AI model: Claude Fable 5.2 from Anthropic, running in Claude Code.
The question was how far the model can take a real-time 3D world when a person only directs it.

The person wrote requests in plain language: what the world must look like, what was wrong with the last version, and the scripts of two short films.
The model wrote the code, the shaders, the films, the video recorder and the documents.
It also found the sound recordings and checked their licences. The person supplied the music track.

The repository is the result of that test:

| What | Amount |
|---|---|
| JavaScript and GLSL | 3,900 lines in 38 modules |
| Scripted films | Three (41 s, 70 s and 45 s) and one still scene |
| Video recorder | 160 lines. It is frame-exact and records sound. |
| Documents | Ten, in `docs/` |
| Recordings | 20 sound effects, each with its source and licence |
| History | More than 70 commits, one logical change in each |
| Time | The conversation ran for about 22 hours, pauses included |

## How it was written

**Directions in, code out.** The person described a result. The model planned the change, wrote it, ran it and reported what it had checked.
The person looked at the result and answered with the next request.

**The model checked its own pictures.** It did not watch a screen. It started Chrome without a window on the real GPU, stepped the page on a virtual clock, took frames at exact times and looked at them.
The video recorder in `tools/` uses the same method. See [recording.md](recording.md).

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
