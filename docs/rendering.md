# Rendering

Three.js supplies the renderer, cameras, buffers and render targets. It does not supply the look.
Every material is a `ShaderMaterial` with GLSL written in the page. There are no Three.js lights, no textures of surfaces and no models.

All scene shaders start with one shared block of GLSL, `GL_COMMON`. It holds the palette, hash and noise functions, the fog, the cloud field and the glyph functions.

## Geometry

The city is drawn from four shapes: a unit box, a unit cylinder, a quad, and a streak quad.
Each is drawn many times with instanced attributes (position, size, parameters).

| Mesh | Instances | Shader |
|---|---|---|
| Buildings, props, poles, signs, rail decks | up to 448 boxes per chunk, 169 chunks | `BOX_VS` / `BOX_FS` |
| Far field | up to 46,000 boxes | the same shader with `#define FAR` |
| Tanks, stacks, needles | up to 200 cylinders per chunk | `CYL_*` |
| Lamps, beacons, signals | up to 176 sprites per chunk | `LIGHT_*` |
| Ground | one quad of 60 km | `GROUND_*` |
| Rain | 15,000 streaks | `RAIN_*` |
| Steam | up to 2,048 sprites, 8 per vent | `STEAM_*` |
| Cars | 280 bodies, 6 light quads each | `CAR_*`, `CARL_*` |
| Trains | boxes, rebuilt each frame | `BOX_*` |
| Ribbons | searchlights, lightning bolts, train streaks | `RIB_*` |
| Stars | 5,021 points | `STAR_*` |
| Sky | one sphere | `SKY_*` |

## Buildings

One fragment shader draws every surface of the city. A box carries a `kind` and a `style`, and the shader branches on them.

**Facades are computed, not textured.** The shader divides a wall into bays and floors that fit the size of the box exactly.
For each window cell it derives from hashes whether the room is lit, how bright, and in which colour.
The three styles differ in the window shape: a glass grid, pointed stone arches, or small concrete openings.

Details that appear only when the camera is close enough to resolve them:

- glazing bars and blinds,
- rain stains under the sills, darker wall bases, lighter corners,
- **rooms**: for a lit window within 240 m the shader intersects the view ray with a box behind the glass. It draws a floor, a ceiling lamp, a back wall with a door, and sometimes a person. This is interior mapping. No geometry is added.
- the lit city mirrored in dark glass.

**Code** falls on walls as columns of glyphs. `codeRain()` picks a glyph per cell from the 8×8 atlas and moves a bright head down each column. The `[4]` setting scales how many columns carry code.

Roofs have a parapet, puddles that mirror the sky, and a lit crown line on some towers.
Signs and roof screens draw glyphs in neon colours.

## Ground

The ground is one plane. Its shader computes the street pattern from the position: asphalt, lane marks, stop lines, zebra crossings, kerbs and pavements.

- **Wet surface.** A noise mask decides where puddles are. Rain ripples disturb the normal near the camera.
- **Reflection.** The scene is first rendered from a camera mirrored at ground level, at half size. The ground samples that picture seven times along the view direction. Rough asphalt smears the lights toward the viewer. Puddles mirror them sharply.
- **Lamp pools.** The positions of street lamps are known from the grid, so the ground computes their light without any light objects.
- **From far above** the pattern is replaced by its average, with moving dashes for traffic and a glow along the streets.

## Light

There is no lighting pass. Surfaces add up a few terms:

- ambient light from the fog colour, the lit clouds above, or the moon,
- sodium lamp light that fades with height above the street,
- the lightning flash, with a direction,
- emission: windows, signs, code.

Lamps, beacons, signals and headlights are additive sprites. Bloom turns them into glows.

## Fog

`applyFog()` runs at the end of every surface shader. It mixes the colour toward the colour of the air in that direction.
It has three parts: distance fog, exponential ground mist, and a hard fade before the edge of the loaded city.
The fade uses the distance on the ground, not in space. From high up the whole loaded city is therefore visible.

## Rain

15,000 streaks live in a box that wraps around the camera, so the rain never ends.
Each streak is stretched along the velocity of the drop relative to the camera. At speed the rain turns into lines that come at you.
In bullet time the drops almost stop and are drawn as beads with a glint.
Rain stops at the cloud base.

## Post-processing

All targets are half-float HDR. The scene target has 4× MSAA.

| Pass | What it does |
|---|---|
| Bloom | Five levels down from half size. Only light above a threshold enters. Then five levels up, added together. |
| Composite | Motion blur: 8 samples along a vector made of the speed zoom and the camera turn. The zoom part is scaled by depth, so near things streak and the sky holds still. Then bloom is added, exposure applied, and ACES tone mapping. |
| Grade | See below. |
| Trails | In bullet time the picture keeps part of the frame before it. |
| Final | Chromatic aberration, faint scanlines, vignette, gamma, film grain, fade-in. Tearing and heavy scanlines run only during a glitch. |

### The grade

The scene is lit in natural colours: orange sodium lamps, warm and cold windows, white headlights, blue-white lightning.
The grade then leans the whole picture toward green, as the films do for scenes inside the Matrix:

1. reduce saturation to 42%,
2. tint: teal-green in the shadows, yellow-green in the mid tones,
3. add contrast,
4. burn highlights toward a pale green,
5. push the darkest shadows deeper.

The green of the code itself is not graded in. The code is emitted green.

## Effects for the tours

Four effects are off in normal flight. A tour turns them on. [tours.md](tours.md) lists the names.

- **The fold.** The vertex shaders of the buildings, the ground and the cars bend every point beyond a line across z around a circle. Light and fog are computed for the place a point had before the bend.
- **The blackout.** A band of dark crosses the city. Windows, street lamps and the glow of the street go out in it, one by one. The code on the walls and the lights of the cars stay.
- **Depth of field.** The composite pass spreads each pixel into a disc. Its radius comes from the distance of the pixel and the focus distance. A sharp thing in front does not smear over what is behind it.
- **Local lamps, wall cuts and the indoor box.** Six point lamps light the buildings, the ground and the cars. Two boxes cut openings in walls. One box is indoors: it has no rain and no light from the street.
