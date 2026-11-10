# Flight

The camera is the flyer. There is no body in the picture.
Two functions can move it each frame: `stepManual` (you fly) and `stepCine` (the page flies).

## Manual flight

Manual flight is a small physical model. Speed has to be built and is lost again.

| Part | Rule |
|---|---|
| Thrust | Along the nose. 52 m/s² normally, 152 m/s² with boost. |
| Gravity trade | A dive adds acceleration, a climb takes it away. |
| Drag | Grows with the square of the speed. Boost makes the flyer streamlined. There is a bump just below Mach 1. |
| Thin air | With boost, drag falls with altitude. Top speed is about Mach 1.16 at 250 m and Mach 2.09 at 3,000 m (measured). |
| Lift | The velocity turns toward the nose. It turns slower at high speed, so fast turns are wide. A hard turn costs a little speed. |
| Bank | The roll follows the sideways acceleration. |
| Hover | With no input the flyer slows down and bobs gently. `S` is an air brake. |
| Ceiling | 3,200 m. |

Mach 1 is 340 m/s. Crossing Mach 0.92 plays a sonic boom.

**Collision.** The flyer is a sphere with a radius of 2.6 m. `collide()` tests it against the boxes of the cells it touches and pushes it out.
A move is split into steps of 2 m, so the flyer cannot pass through a wall at Mach 1.
A hard hit shakes the camera and plays an impact. Flight itself has no shake.

**Lens.** The field of view opens from 72° to 114° with boost and speed.

## Cinematic flight

The page flies by itself after the intro, and again when you press `C`. Any movement key gives the controls back to you.

**The path cannot hit a building**, because it is made of waypoints over road centre lines, where the air is free.
A planner keeps a cursor: which road, which direction, how far along, how high. Moves append waypoints:

| Move | What it adds |
|---|---|
| `skim` | Roof level, weaving, 135 m/s. |
| `dive` | Down into the street. |
| `canyon` | Along the street at 8 m to 16 m, 100 m/s. |
| `turn` | A banked 90° arc through the next intersection. |
| `climb` | Pull up, go supersonic, out of the cloud deck, weave among the cloud towers, then up to about 2,500 m. Starts a recompile wave at the top. |
| `descend` | Nose over and dive through the clouds at up to 640 m/s, then level out over the roofs. |

The moves repeat in a fixed sequence (`CINE_SEQ`). Before a dive or a climb the planner checks the rail decks of the roads it will cross, and flies on a little if one is in the way. It never flies along a road that carries a rail deck at low altitude.

The waypoints are joined with a centripetal Catmull-Rom spline, which does not overshoot when waypoints are unevenly spaced.
The camera looks at a point a little further along the path, like a chase camera, and banks from its turn rate.

**The first look.** After the intro the camera first turns once around itself in 10 seconds while it rises 70 m. Then the route starts.

## Bullet time

Hold `F`. Time splits into three rates:

| What | Rate |
|---|---|
| The world (cars, trains, clouds, code) | 10% |
| The flyer | 40% (22% in cinematic flight) |
| Rain | 1.2% |

Rain drops are drawn as hanging beads. The picture keeps trails of the frame before it.
The sound of the world is filtered and turned down, and a slow heartbeat is what is left.
