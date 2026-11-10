# The world

The city has no stored map. Every block is computed from the seed when the camera comes near, and dropped when it leaves.

## Seed and determinism

The seed is a 32 bit number. It comes from `#seed=` in the address, or it is random.
Two functions turn it into everything else:

- `hashInt(a, b, c)` mixes three integers into one. `hash01` scales it to 0..1.
- `mulberry32(n)` is a small random generator. A cell seeds its own generator with `hashInt(SEED, ix, iz)`.

`vnoise(x, z, salt)` is smooth value noise built on the hash. It decides slow changes: how tall a district is, and which style it has.
The same seed always builds the same city, in any order of travel.

## The grid

| Constant | Value | Meaning |
|---|---|---|
| `CELL` | 100 m | One city block, road centre to road centre. |
| `ROAD` | 24 m | Width of the right of way. The asphalt is 16 m. |
| `CHUNK` | 200 m | 2×2 cells. The unit of streaming. |
| `RC` | 6 | Chunks are loaded in a 13×13 square around the camera. |
| `FAR_R` | 44 cells | The far field reaches 4.4 km. |

Roads run on every cell border. The air above a road is always free, which the cinematic flight uses.

## Generating a cell

Generation has two steps, so that far cells are cheap.

**`cellLots(ix, iz, e)`** decides the buildings of a block: footprint, height, style and amount of code. `e` is the epoch (see the recompile wave).
District noise gives a base height from 26 m to 250 m. A random pattern then fills the block:

| Pattern | Chance |
|---|---|
| One tower on a podium | 28% |
| Two slabs with an alley | 34% |
| Four buildings | 31% |
| A slim megatower on a plaza, up to 430 m | 7% |

Each building gets one of three styles: glass curtain wall, stone with pointed windows, or concrete with small windows.

**`genCell(ix, iz, e)`** turns the lots into things to draw: setbacks, podiums, roof tanks and stacks, masts with beacons, blade signs, roof screens, searchlights, street lamps, traffic signals and steam vents.
It also writes `bodies`, the boxes that flight collides with.

A cell produces rows of numbers. A box row has twelve values: position, size, a random seed, style, amount of code, kind, and the centre of the building it belongs to.

## Landmarks

**Spires.** The plane is divided into regions of 18×18 cells. About 59% of the regions hold one spire.
A spire is 900 m to 1,080 m tall, in five tiers with a 70 m needle. It goes through the cloud deck.

**Elevated rail.** A road carries a rail deck if its hash is below 0.17 and the road before it has none.
Decks are at 22 m over roads along x and 31 m over roads along z, so crossings do not collide.
A train of four cars runs every 760 m at 36 m/s. Trains are not simulated: their positions are a function of world time.

## Streaming and level of detail

Chunks come from a pool. Each chunk owns three instanced meshes: boxes, cylinders and light sprites.
`buildChunk` writes the rows of its four cells into the instance buffers.

The rows are written in order of importance: building bodies first, then roof props, then poles.
Level of detail is then only a number: `instanceCount`.

| Distance to the chunk | Boxes drawn | Lights drawn |
|---|---|---|
| under 380 m | all | all |
| under 420 m | all | lamps and beacons |
| under 800 m | bodies and props | lamps and beacons |
| under 950 m | bodies | lamps and beacons |
| beyond | bodies | beacons |

The page loads at most four chunks per frame, nearest first. At the start it loads all of them at once behind the black screen.

**The far field** shows the city beyond the chunks. It is one instanced mesh with one plain box per building, up to 46,000 boxes.
It is rebuilt 900 cells per frame when the camera has moved 8 cells.
Its vertex shader throws away every box inside the rectangle that chunks cover (`uNear`), so nothing is drawn twice.
The far field is drawn only above about 250 m. Between 140 m and 900 m of altitude the far fade moves out from 1,150 m to 3,900 m.

## Traffic

280 cars (140 on touch devices) live within 440 m of the camera. A car that leaves the range is placed again at the edge, mostly ahead.

Each car has a road, a direction, a lane and a wanted speed between 9 and 16 m/s.
Cars are sorted by lane and position, so each car knows the car ahead.
Every intersection has a signal with an 18 second cycle. Its phase comes from the hash.
A car brakes as hard as the room ahead demands, so it always stops short of the stop line or the next bumper.

The traffic signal sprites read the same phase, so the lights and the cars agree.
From high up the cars are not drawn. The ground shader draws moving dashes of light in each lane.

## The recompile wave

`G` starts a wave. A straight front crosses the city at 430 m/s toward the viewer. Behind it the city belongs to the next epoch: other buildings stand on the same streets.

How it works:

1. **Prepare.** Every chunk and the far field are rebuilt with both epochs. Each instance carries a flag: `-1` old, `+1` new, `0` unchanged (rails, street furniture).
2. **Run.** The vertex shader computes the distance of each building to the front. It hides the old city behind the front and the new city ahead of it. Within 46 m of the front, a building is squashed to the ground. The fragment shader fills buildings near the front with code and wire-frame slices.
3. **Finish.** When the front has passed, `EPOCH` increases and everything is rebuilt with one epoch.

The cinematic flight starts a wave when it is high above the clouds.

## The world build

At the start, and after a new seed, nothing stands. The ground is a measuring grid.
A circular front runs outward from the camera at 420 m/s (`uBuild`). Behind it:

- a building grows out of the ground over 90 m of travel,
- it is a wire frame until the front is 110 m to 190 m past it, then it becomes solid,
- its windows come on one by one between 240 m and 410 m,
- lamps, cars, trains, rain and the sound of the city follow.
