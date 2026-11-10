# Scripted tours

A tour is a fixed camera path with timed events. It runs live in the page: the same world, the same shaders, the same sound.

| Address | Tour | Length |
|---|---|---|
| `code-city.html?tour=film` | Text on black, digital rain, the city builds itself, a rooftop, the jump, bullet time, a run through the streets, and up through the clouds. | 41 s |
| `code-city.html?tour=reel` | Four scenes: the city, a train, the recompile wave, and the sky. | 70 s |

A tour waits for a click, because the browser allows sound only after one. `Esc` ends it.
After a tour the page flies by itself again and the normal controls work.

Tours need the page to be served over http, because the page fetches `tour.js`.

## How a tour gets into the page

At the end of its module, `code-city.html` checks the address for `?tour=`.
If it is there, the page fetches `tour.js` as text and runs it with `eval` inside the module.

This is deliberate. Code that runs inside the module can read and replace the module's own variables.
The tour replaces `stepCine`, the function that moves the camera in cinematic flight. From then on the tour drives the camera each frame.
It also calls the page's own functions: `startBuild`, `startWave`, `makeBolt`, `thunder` and others.
When the tour ends it puts the page's `stepCine` back.

## A scene

A scene is a function in `scenes` that returns an object:

| Field | Meaning |
|---|---|
| `pos` | Keys `[time, x, y, z]`. The camera position is a Hermite spline through them. A list of several key lists makes a cut between them. |
| `look` | Keys `{ t, p: [x, y, z], w }` or `{ t, d: [x, y, z], w }`. The camera looks along its path. `w` blends that toward a point `p` or a direction `d`. |
| `boost` | Keys `[time, amount]`. Boost widens the lens and stretches the rain. |
| `ev` | Events `[time, function]`, run once. |
| `frame` | An optional function that runs every frame, for overlays. |
| `t0` | The time the scene starts at. The default is −0.9 s, which hides the first frames behind black. |

Times are seconds from the start of the scene. Positions are metres. `y` is up.

## Events the tours use

| Helper | Effect |
|---|---|
| `strike(dMin, dMax)` | A lightning bolt on the mast that is most in front of the camera. |
| `farFlash(dist, amp)` | A flash in the cloud base ahead. |
| `cloudFlash(x, y, z, amp)` | A flash inside a cloud at a fixed place. |
| `waveDir(dx, dz)` | A recompile wave in a set direction. |
| `startBuild(x, z, speed)` | The page's world build, from a set centre. |

The film also draws two overlays itself: the typed text, and a wall of falling glyphs on a 2D canvas.
The glyphs are drawn once into a sprite sheet with their glow. Each frame only copies sprites, so the wall costs little.

## Why the paths are fixed to one seed

The paths are written by hand for the seed `C0DEC17E`: they thread streets, a rooftop, a rail line and a spire of that city.
If the address has another seed, the tour sets this one and reloads.

The clouds do not depend on the seed. They drift with world time.
Each scene therefore sets the world clock when it starts (`W0`), so the cloud towers stand where its path expects them.
The sky scene, for example, leaves the cloud deck beside a spire and flies into a tower that stands there at that time.

## Writing a new scene

1. Plan the positions from the grid: road centre lines are at multiples of 100 m in x and z. Building heights differ per block, so check the path in the browser.
2. Add a function to `scenes` that returns `pos`, `look`, `boost` and `ev`.
3. Add its name and length to a list in `LISTS`, and a world clock value to `W0`.
4. Keep the camera over road centre lines when it is below roof level. Nothing stops a tour path from going through a building.
