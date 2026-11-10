# Audio

## The rule

Every sound is a recording. The script synthesises nothing: no oscillators and no generated noise.
It only loops, filters, pans, changes the playback rate and mixes.

The one generated buffer is the impulse response of the reverb. It is a filter for the recordings, not a sound.

The recordings are embedded in `code-city.html` as MP3 in base64. They are listed in [assets.md](assets.md).
The music is the one sound that is not a field recording. It is a track in its own file, `music.mp3`.

## Start

A browser allows sound only after a user action. `startAudio()` runs on the first click.
It builds the graph and decodes the recordings with `decodeAudioData`. Each sound starts when its decoding is done.

## The graph

```
loops, one-shots, music ─┬─> master ─> duck ─> lowpass ─> compressor ─> soft ceiling ─> out ─> output
                         └─> reverb ─────┘                                  ^
thunder ──> thunder lowpass ────────────────────────────────────────────────┘
```

- **Compressor:** threshold −12 dB, ratio 3.5. It holds the bed of rain, wind and city together.
- **Soft ceiling:** a `tanh` curve in a wave shaper. Nothing leaves above full scale.
- **Thunder goes around the compressor.** A close strike is therefore much louder than the rain. Measured in a recording, a strike at 460 m is 7 dB above the rain.
- **Reverb:** a convolver with a 3.2 second impulse: a decaying wash with a few hard echoes, for a city of towers.
- **Out:** one gain at the end. The `SOUND` switch (key `5`) sets it to 0 or 1.

## Music

`startAudio()` fetches `music.mp3`, decodes it and plays it from its beginning. The file is beside the page, so there is music only over http.
Six seconds before the track ends, the next pass starts and fades in over the end of the old one.
A tour calls `playMusic(true)`, which cuts the track and starts it again from its beginning.

The music goes into `master`, so bullet time ducks it with the rest.
Its level is the constant `MUSIC`. It drops to 60 % where there is no rain, so it stays under the weather.
Measured in a recording at the start of the page, the music is 6.4 dB below the rain, wind and city together. Only below 80 Hz is it the louder part.
The `MUSIC` switch (key `6`) sets its level to 0.

## Loops without a seam

A loop file is longer than its loop: it wraps 0.25 s past both ends. The script loops the range from 0.1 s to 0.1 s plus the loop length.
MP3 decoding adds a small delay and padding. Because the file wraps, any window of the loop length still repeats without a click.

| Loop | Length | Use |
|---|---|---|
| `rain` | 16 s | Played twice, 7.3 s apart, left and right. The main rain. |
| `rainClose` | 7 s | A closer, crisper rain near the street. |
| `wind` | 11 s | Flight wind, and the thin wind above the clouds. |
| `city` | 18 s | The low end of far traffic. |
| `train` | 7 s | An elevated train passing. |
| `heart` | 2.89 s | Two beats of a resting heart. |

## What drives the mix

`updateAudio()` runs every frame and sets gains and filters from the state of the world.

| Sound | Follows |
|---|---|
| Rain | Loud below the clouds, off above the cloud base. Duller with altitude. A slow gust moves it. |
| Close rain | The altitude: full near the street, almost off above 70 m. |
| Wind | The speed: both level and playback rate. Louder inside cloud. |
| High wind | Only above the cloud deck. |
| City | Fades out between 30 m and 520 m of altitude. Quieter with traffic off. |
| Train | The distance to the nearest train, within 260 m, and its side for the pan. |
| Heart, duck, lowpass | Bullet time. |

While the world is still being built at the start, the city and the idle wind are silent.

## One-shots

| Event | Sound |
|---|---|
| Lightning | One of three recorded strikes. It starts after distance / 343 seconds, at most 9 s. Distance lowers a lowpass filter, the level and the playback rate: a far strike only rolls. Above the clouds, thunder is a dull thud. |
| Sonic boom | A recorded explosion, played twice 0.13 s apart at a low rate: the double bang of a shock wave. |
| Impact | A recorded thud, scaled by the speed of the hit. |
| Glitch | Short cuts of television static. |
| Recompile wave | The wind loop, rising in pitch and level as the front comes, then a deep bang when it arrives. |
