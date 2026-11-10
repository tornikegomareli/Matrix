# Scripted tours

A tour is a fixed camera path with timed events. It runs live in the page: the same world, the same shaders, the same sound.

| Address | Tour | Length |
|---|---|---|
| `code-city.html?tour=film` | Text on black, digital rain, the city builds itself, a rooftop, the jump, bullet time, a run through the streets, and up through the clouds. | 41 s |
| `code-city.html?tour=reel` | Four scenes: the city, a train, the recompile wave, and the sky. | 70 s |
| `code-city.html?tour=loop` | A fall, time rewinds, one long take from an alley through a corridor and a stairwell to a roof, a blackout, the city folds over, time runs backwards, and the fall again. | 45 s |

A tour waits for a click, because the browser allows sound only after one. `Esc` ends it.
The click starts the music from its beginning, and the tour begins when the music is decoded (it waits 4 seconds at most).
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
| `pos` | Keys `[time, x, y, z]`. The camera position is a Hermite spline through them. A list of several key lists makes a cut between them. A key with a fifth value is a stop: the camera rests there. |
| `look` | Keys `{ t, p: [x, y, z], w }` or `{ t, d: [x, y, z], w }`. The camera looks along its path. `w` blends that toward a point `p` or a direction `d`. |
| `boost` | Keys `[time, amount]`. Boost widens the lens and stretches the rain. |
| `ev` | Events `[time, function]`, run once. |
| `frame` | An optional function `(t, rdt)` that runs every frame, for overlays and for changes to the world. |
| `upv` | Keys `{ t, u: [x, y, z] }`: where the top of the camera points. Without it the camera stays upright. |
| `bank` | Keys `[time, amount]`: how much the camera banks in a turn. 0 keeps it level. |
| `custom` | A function `(t, rdt)`. While it returns true, the scene has moved the camera itself and the path rests. |
| `now` | True: the scene opens on a full picture, not behind black. |
| `end` | A function that runs when the scene ends. It undoes what the scene changed in the page. |
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

## An opening shot for a video

Add `&hook=1` to the address of a tour. The tour then opens with a shot of 1.8 seconds.
The recompile wave comes at the camera, and the towers in front of it are code. A bolt of lightning strikes after 0.3 seconds.
The first frame of the shot is made to be the first frame of a video, because a video is judged by that picture.

The shot is made ready behind black for 2 seconds, because the wave needs that time to start. The recorder leaves those 2 seconds out.
The scene holds the front of the wave itself: 150 m ahead of the camera at the first frame, 45 m ahead at the cut.
When the shot ends the wave is called off, so the city stays the one the paths are written for.

## What a tour can change in the page

The page has a few variables and uniforms that only a tour sets. A scene that sets one must set it back in `end`.

| Name | Effect |
|---|---|
| `timeRate` | The pace of the world clock. 0 holds it: the rain hangs. Below 0 it runs backwards: rain rises, cars reverse, steam sinks. |
| `fovAdd` | Degrees added to the lens angle. Below 0 is a longer lens. |
| `matComp.uniforms.uFocus`, `uAper` | Depth of field: the focus distance in metres, and the blur radius of the far distance in pixels at 1080p. 0 is all sharp. |
| `U.uDark` | The blackout: a band of dark that crosses the city. Direction x and z, the place of its front, and its depth. Behind the band the lights come back. |
| `setFold(hinge, radius, angle)` | Bends the city up and over, beyond a line across z. Half a turn puts a second city over the first. |
| `fogAlt` | An altitude that the fog uses in place of the camera's own. A high value clears the air, so the folded city shows. |
| `U.uPL`, `U.uPLc`, `U.uPLn` | Up to six lamps: place and reach, colour and zone (0 outdoors, 1 indoors, 2 both). |
| `U.uHoleA`, `U.uHoleB` | Two boxes that cut openings in the walls of buildings. |
| `U.uInA`, `U.uInB` | One box that counts as indoors. Rain and the light of the street stay out of it. |
| `extraCars` | Up to eight scripted cars `{ x, z, a, seed, brake }`. `brake: 2` is a wreck without lights. |

## The third film

`?tour=loop` is one scene. It adds things to the world that the city does not have, and removes them when it ends.

- **A set.** A doorway cut into a tower, a corridor, a stairwell to the roof, a hatch, lamps, and a footbridge over the avenue. It is about 3,000 boxes with a material of their own. Most of them are the steps of the stairwell.
- **Figures.** A cook, people in a corridor and a cat. Each is a box whose fragment shader marches a ray through a figure made of rounded shapes, and writes its own depth.
- **Loops.** The cook lights a cigarette every 3.2 seconds. The cat trots the same 5 metres every 2.4 seconds. Both exist twice: in the alley and on the roof. A car sounds its horn twice, the same way each time.
- **Glass.** The glass wall of the footbridge is about 900 triangles. Each has a path that is a function of the world clock: in place before it broke, then a throw, a fall, and rest on the street.
- **A crash.** Two cars meet at a crossing. Their places are functions of the world clock too.

The film runs the world clock forward, holds it twice (the two frozen frames), runs it back fast (the rewind), and runs it backwards for 8 seconds.
Nothing is animated backwards by hand. The glass broke and the cars met while the clock ran forward and the camera was elsewhere. When the clock runs back, the same functions return the pieces to the panes and the cars to their lanes.

The film ends in a fall from the roof, and it begins 1.7 seconds into the same fall.

The two lines of the voice are shown as text. To use a recorded voice, put `vo1.mp3` and `vo2.mp3` into `tour-snd/`. The tour then plays them at 5.2 s and 16.75 s and shows no text.

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
