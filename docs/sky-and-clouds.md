# Sky and clouds

## Stars

The stars are real. The page embeds the Yale Bright Star Catalogue (5th edition): every star down to magnitude 6.5, which is what the eye sees on a dark night.

An offline step turned the catalogue into the frame of this world:

- The sky is the sky of a place at latitude 40° north.
- It is rotated so that the moon stands at right ascension 72°, declination 21° (in Taurus, beside Aldebaran). Orion is to its left and Sirius is low on the far left.
- Stars below the horizon are dropped. 5,021 remain.

Each star is stored in 8 bytes: a direction as three 16 bit integers, the visual magnitude, and the colour index B−V.

At run time the stars are one `THREE.Points` mesh at infinite distance.

- Brightness follows the magnitude: light = 10^(−0.4·m), then compressed with a power of 0.72 so faint stars stay visible on a screen.
- Colour follows B−V: blue-white for hot stars, orange for cool ones.
- A point is about one pixel wide, a little wider for bright stars.
- Stars near the horizon are dimmed by the air and twinkle. Stars beside the moon are dimmed by its glare.
- Under the clouds, in the city haze, stars are at 25%.

## Milky Way

The Milky Way is NASA's Deep Star Maps 2020. The offline step resampled it into the same frame: azimuth across, elevation from −6° to 90° up, 1,024×272 pixels.
The sky shader adds it faintly behind the stars.

## Moon

The moon is a sphere drawn in the sky shader. For each pixel inside the disc, the shader computes the surface normal, looks up NASA's colour map of the near side, and lights it from one side for a gibbous phase.
The lunar surface is lit almost evenly to the edge, as the real moon is.
The disc is drawn about 13 times its real angular size.

The moon is also the light source for the clouds. Its direction is the constant `MOON_DIR`.

## Clouds

The clouds are a volume between 620 m and 1,750 m. A flat deck fills the lower 150 m to 310 m. Storm towers stand on it.

### Noise, made once at start

- A **3D texture**, 64³, that repeats in all directions. Channel R is Perlin noise pushed up by Worley cells: round billows. Channel G is fine Worley noise for eroding edges.
- A **coverage map**, 256², that repeats. Channel R says how much cloud there is. Channel G says how thick the deck is. Read at a smaller scale, G also says where towers stand.

### The density field

`cloudBase(p)` returns the density at a point. The method follows Schneider's Nubis work for Horizon Zero Dawn:

1. Read coverage and cloud type from the 2D map, moved by the wind (9 m/s and 3.5 m/s).
2. Compute a height profile: density rises fast from the base, stays full, and falls to zero at the top. The cloud type sets where the top is.
3. Read the 3D noise and compare it with a threshold. In the closed deck the threshold is low. In a tower it is high, so the noise cuts the tower into rounded heads.

The same function exists in JavaScript (`cloudAt`) with a middle value for the 3D noise. The script uses it to know when the camera is inside cloud.

### The ray march

A full-screen pass at half resolution marches one ray per pixel through the layer (`matCloud`).

- The ray stops at the scene depth, so buildings and spires cut the clouds correctly.
- **Step size:** long steps through clear air (24 m, growing with distance). When a step finds cloud, the ray goes back one step and continues with short steps (11 m). After six empty short steps it takes long steps again. The limit is 160 steps.
- Near clouds are eroded with the fine noise, so edges break into wisps. Far clouds lose detail on purpose, so wide steps do not alias.
- **Light:** at each sample, four more samples toward the moon measure how much cloud is in the way. Moonlight is scattered with a Henyey-Greenstein phase function, so thin cloud in front of the moon glows. Thin edges are darkened a little when not facing the moon, which draws the folds. The city lights the cloud base in orange. Lightning lights the cloud from inside, around the flash position.
- The start of each ray is shifted by a random amount that changes every frame.

### Smoothing over time

One frame of the march is noisy. `matCloudAcc` blends each frame with the one before it.
It finds the last frame's pixel by projecting the ray direction with the last frame's camera, as if the cloud were 2.5 km away.
At rest 86% of the old frame is kept. At speed it is 60%, so nothing smears. After a camera cut the history is dropped.

### Laying it over the scene

`matCloudMix` scales the half-size cloud picture up. Each pixel takes the four nearest cloud samples, weighted by how close their depth is to its own. Clouds therefore do not bleed over roof edges.

### What else reads the cloud field

- Light sprites and ribbons call `cloudVis()`: five samples between the light and the camera. A lamp under the clouds fades when seen from above.
- The wet street mirrors a flat picture of the coverage map, which is cheaper than a second march.
- Rain is scaled by `uRainK`: it falls only below the cloud base.

## Lightning

A timer starts a flash every 3.5 s to 9.5 s. Among the clouds the interval is 3 s to 8 s and the flash is inside the clouds.

Below the clouds, 60% of the flashes strike a mast: `pickStrike()` chooses a beacon ahead of the camera, and `makeBolt()` builds a jagged channel of 26 segments with forks from the cloud to the mast.
The bolt is drawn as ribbons for 0.75 s.

A flash has three pulses of light that decay fast. It lights surfaces from its direction, lights the clouds around its position, and starts the thunder (see [audio.md](audio.md)).
