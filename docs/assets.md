# External material

The world is generated, but three kinds of material come from outside: the library, the sounds, and the sky data.
Everything below is public domain or CC0, except Three.js, which is MIT.

## Library

| Item | Source | Licence |
|---|---|---|
| Three.js r160 | Loaded at run time from `cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js` | MIT |

## Sounds

All sounds are recordings, embedded in `code-city.html` as MP3 in base64 (`<script type="text/plain" id="snd-…">`).
They were cut, turned into loops where needed, and encoded as mono MP3 at 32 kHz (the city bed at 16 kHz).

| Id | Recording | Author, source | Licence |
|---|---|---|---|
| `rain` | "Thunderstorm after hot Summer Day, 17 minutes, 01 of 04" | stephan, pdsounds.org, via Wikimedia Commons | Public domain |
| `rainClose` | "Rain" | ジダネ, Wikimedia Commons | Public domain |
| `wind` | "Killiney Hill Storm Floris 20250804 1537" | Karlunun, Wikimedia Commons | CC0 |
| `city` | "Highway from Bridge, Center" | stephan, pdsounds.org, via Wikimedia Commons | Public domain |
| `train` | "cta-redline-pass" (a Chicago elevated train) | DrewHulva, freesound.org 251756, via Wikimedia Commons | CC0 |
| `boom` | "Explosion-LS100155" | Fg2, Wikimedia Commons | Public domain |
| `thud` | "Dull Thud" | gregoryweir, pdsounds.org, via Wikimedia Commons | Public domain |
| `heart` | "Athletic bradycardia" (a resting heart at 42 beats a minute) | Athletearrhythmia, Wikimedia Commons | CC0 |
| `static` | "Static B" | Oreocooke, Wikimedia Commons | CC0 |
| `thunderA`, `thunderB`, `thunderC` | "Storm, Thunderbolts" (three strikes cut from it) | stephan, pdsounds.org record 301, via Wikimedia Commons | Public domain |
| `tour-snd/drone.mp3` | "MainsBrum50Hz" (mains hum, played slowed in the film) | Wikimedia Commons | Public domain |

## Sky

| Data | Source | Licence | Form in the file |
|---|---|---|---|
| Stars | Yale Bright Star Catalogue, 5th revised edition (Hoffleit and Warren, 1991) | Public domain | `dataStars`: 5,021 stars, 8 bytes each, base64 |
| Milky Way | NASA Goddard Scientific Visualization Studio, Deep Star Maps 2020 | Public domain (NASA) | `imgGalaxy`: JPEG, 1,024×272, resampled to the frame of the world |
| Moon | NASA Scientific Visualization Studio, CGI Moon Kit (LRO colour map) | Public domain (NASA) | `imgMoon`: JPEG of the near side |

## Generated in the page

These are made at start by code, not loaded:

- the glyph atlas (katakana and digits drawn with a system font on a canvas),
- the 3D cloud noise and the cloud coverage map,
- the impulse response of the reverb.

## Fonts

The glyphs use the first Japanese font the system has (Hiragino, Yu Gothic, MS Gothic or Noto). The interface uses the system monospace font. No font is shipped.
