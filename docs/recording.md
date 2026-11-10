# Recording a video

`record.mjs` records the page to an MP4 with sound. It does not capture the screen.
It steps the page one frame at a time, so the video has exactly 60 frames per second however slow the capture is.

## Requirements

- Node.js 22 or newer (it uses the built-in `WebSocket` and `fetch`)
- Google Chrome at `/Applications/Google Chrome.app` (macOS path, set in the script)
- `ffmpeg` on the path
- the page served over http

## Use

```sh
python3 -m http.server 8931 &
node record.mjs "http://127.0.0.1:8931/code-city.html#seed=C0DEC17E" out.mp4 26
```

```
node record.mjs <url> <out.mp4> <seconds> [width] [height] [keys] [crf]
```

| Argument | Default | Meaning |
|---|---|---|
| `width`, `height` | 1920, 1080 | Size of the video. Below 1,000 wide it records a fast preview (JPEG frames, lower quality). |
| `keys` | `[]` | Key events as JSON: `[{"t": 4, "type": "keydown", "code": "KeyG"}]`. `t` is seconds. |
| `crf` | 15 | x264 quality. Lower is better and larger. |

It writes `<out>.video.mp4` and `<out>.pcm` next to the output, then joins them.

## How it works

The script starts headless Chrome with the real GPU and drives it over the Chrome DevTools Protocol.
Before the page loads, it injects a shim that takes control of time:

| Replaced | With |
|---|---|
| `requestAnimationFrame` | A queue. The recorder runs it once per video frame. |
| `performance.now` | A virtual clock that advances 1/60 s per frame. |
| `setTimeout` | Timers on the virtual clock. The intro text uses them. |
| `Math.random` | A seeded generator, so two recordings are equal. |
| `AudioContext` | One `OfflineAudioContext` for the whole length of the video. |
| CSS animations | Paused, and set to the virtual time each frame. |

For each frame the recorder:

1. advances the virtual clock and runs the page's frame function,
2. takes a screenshot and pipes it to `ffmpeg`,
3. renders the audio up to the start of the next frame, with `suspend(t)` and `resume()` on the offline context.

The audio is therefore rendered in step with the picture, sample-exact, and not in real time.
At the end the script reads the rendered audio back, writes it as PCM, and `ffmpeg` joins picture and sound.

The script also counts frames that are identical to the one before. A count above zero after the intro means the page did not draw a frame.

## Limits

- It records the page's own cinematic flight, with optional key events. It does not start the scripted tours: a tour waits for a click on its start screen.
- `code-city-1080p60.mp4` in this repository was recorded from the first version of the page.
