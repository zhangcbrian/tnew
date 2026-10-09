import * as THREE from 'three';
import { octaveNoise, ridgedNoise } from '../../utils/noise';
import { smoothstep, lerp } from '../../utils/math-helpers';
import type { Biome } from './types';
import * as P from './plants';

const C = (hex: number) => new THREE.Color(hex);
const ROCK = C(0x7d7d80);
const SNOW = C(0xeef0f4);
const SHINGLE = C(0x8a8272);
const PEAT = C(0x3b3226);

/** Shared finishing touches: rock on steep ground, a little brightness noise. */
function finish(out: THREE.Color, x: number, z: number, slope: number, rockFrom = 0.3) {
  out.lerp(ROCK, smoothstep(rockFrom, rockFrom + 0.2, slope));
  out.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.04);
}

// ---------------- Scottish Highlands ----------------

const MOOR = C(0x7a8450);
const BRACKEN = C(0x9a6a34);
const HEATHER = C(0x6e4b5c);

export const highlands: Biome = {
  id: 'highlands',
  name: 'Scottish Highlands',
  height(x, z) {
    // Broad U-shaped glens (whose low floors fill with lochs) between rounded hills, rocky ridges up high
    const glen = smoothstep(-0.35, 0.45, octaveNoise(x, z, 3, 0.5, 2, 0.0016));
    const floor = 1.5 + octaveNoise(x + 3000, z - 1700, 2, 0.5, 2, 0.0025) * 7;
    const hills = octaveNoise(x - 900, z + 400, 4, 0.5, 2, 0.006);
    const ridge = Math.pow(ridgedNoise(x + 5000, z + 5000, 0.004), 2);
    const upland = 18 + hills * 20 + ridge * 50 * smoothstep(0.5, 1, glen);
    return lerp(floor, upland, Math.pow(glen, 1.5)) + octaveNoise(x + 1000, z + 1000, 2, 0.4, 2.5, 0.03) * 1.5;
  },
  color(x, z, h, slope, out) {
    const patch = octaveNoise(x * 2, z * 2, 2, 0.5, 2, 0.02);
    if (h < -0.5) { out.copy(PEAT); return; }
    if (h < 1.2) { out.lerpColors(SHINGLE, MOOR, smoothstep(0.2, 1.2, h)); return; }
    out.lerpColors(MOOR, BRACKEN, smoothstep(0.35, 0.7, patch) * (1 - smoothstep(25, 40, h)));
    out.lerp(HEATHER, smoothstep(8, 30, h) * smoothstep(-0.4, 0.3, patch) * (1 - smoothstep(55, 75, h)) * 0.85);
    out.lerp(ROCK, Math.max(smoothstep(0.3, 0.5, slope), smoothstep(50, 70, h) * 0.8));
    out.lerp(SNOW, smoothstep(72, 82, h + patch * 6) * (1 - smoothstep(0.45, 0.6, slope)));
    out.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.04);
  },
  plants: [
    { name: 'scots-pine', geo: P.scotsPine(), perChunk: 28, shadow: true, scale: [0.8, 1.5],
      fits: (h, s, x, z) => h > 1.5 && h < 45 && s < 0.35 && octaveNoise(x, z, 2, 0.5, 2, 0.01) > 0.25 },
    { name: 'birch', geo: P.birch(), perChunk: 8, shadow: false, scale: [0.8, 1.2],
      fits: (h, s, _x, _z, r) => h > 1.5 && h < 30 && s < 0.3 && r < 0.35 },
    { name: 'heather', geo: P.heather(), perChunk: 30, shadow: false, scale: [0.7, 1.6],
      fits: (h, s) => h > 8 && h < 70 && s < 0.45 },
    { name: 'gorse', geo: P.gorse(), perChunk: 10, shadow: false, scale: [0.7, 1.3],
      fits: (h, s, _x, _z, r) => h > 2 && h < 35 && s < 0.35 && r < 0.5 },
    { name: 'bracken', geo: P.bracken(), perChunk: 24, shadow: false, scale: [0.8, 1.5],
      fits: (h, s) => h > 1 && h < 30 && s < 0.3 },
    { name: 'highland-boulder', geo: P.boulder(), perChunk: 12, shadow: false, scale: [0.4, 2.0],
      fits: (h, s, _x, _z, r) => h > 0.3 && s < 0.7 && r < (s > 0.3 || h > 50 ? 0.9 : 0.2) },
    { name: 'moor-grass', geo: P.grassTuft(), perChunk: 40, shadow: false, scale: [0.8, 1.6],
      fits: (h, s) => h > 0.6 && h < 40 && s < 0.4 },
  ],
  climate: { skyTop: 0x5f8fc2, skyBottom: 0xc9d6e0, fog: 0xb9c7d2, fogNear: 140, fogFar: 520, water: 0x2f4a5a, waterOpacity: 0.82, rain: 0.5, snow: false },
};

// ---------------- Norwegian Fjords ----------------

const FJORD_GREEN = C(0x3f6b35);
const FJORD_ROCK = C(0x6b6e70);
const FJORD_BED = C(0x2a3438);

export const fjords: Biome = {
  id: 'fjords',
  name: 'Norwegian Fjords',
  height(x, z) {
    const mount = 35 + octaveNoise(x, z, 4, 0.5, 2, 0.004) * 30 + Math.pow(ridgedNoise(x + 7000, z, 0.003), 2) * 70;
    // Long winding inlets with steep walls, far below sea level
    const n = Math.abs(octaveNoise(x + 20000, z - 10000, 3, 0.5, 2, 0.0009));
    const inlet = 1 - smoothstep(0.03, 0.14, n);
    return lerp(mount, -30, inlet);
  },
  color(x, z, h, slope, out) {
    if (h < -0.5) { out.copy(FJORD_BED); return; }
    // Green, forested lower slopes; bare rock only on the high tops and real cliffs
    out.lerpColors(FJORD_GREEN, FJORD_ROCK, smoothstep(75, 105, h));
    out.lerp(FJORD_ROCK, smoothstep(0.55, 0.75, slope));
    out.lerp(SNOW, smoothstep(100, 115, h + octaveNoise(x, z, 2, 0.5, 2, 0.02) * 8) * (1 - smoothstep(0.5, 0.65, slope)));
    out.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.04);
  },
  plants: [
    { name: 'fjord-spruce', geo: P.spruce(), perChunk: 36, shadow: true, scale: [0.7, 1.3],
      fits: (h, s, x, z) => h > 1 && h < 85 && s < 0.6 && octaveNoise(x, z, 2, 0.5, 2, 0.012) > -0.25 },
    { name: 'fjord-birch', geo: P.birch(), perChunk: 8, shadow: false, scale: [0.8, 1.2],
      fits: (h, s, _x, _z, r) => h > 1 && h < 40 && s < 0.35 && r < 0.4 },
    { name: 'fjord-boulder', geo: P.boulder(0x75787a), perChunk: 10, shadow: false, scale: [0.5, 2.2],
      fits: (h, s) => h > 0.3 && s < 0.75 },
    { name: 'fjord-grass', geo: P.grassTuft(0x5f8a3f), perChunk: 30, shadow: false, scale: [0.8, 1.5],
      fits: (h, s) => h > 0.6 && h < 80 && s < 0.55 },
  ],
  climate: { skyTop: 0x4f7fb8, skyBottom: 0xc4d4e2, fog: 0xaebfcf, fogNear: 160, fogFar: 560, water: 0x24485c, waterOpacity: 0.85, rain: 0.45, snow: false },
};

// ---------------- Irish Countryside ----------------

const IRISH_GREEN = C(0x4f9a3a);
const IRISH_DARK = C(0x3e7d2e);

export const ireland: Biome = {
  id: 'ireland',
  name: 'Irish Countryside',
  height(x, z) {
    return 6 + octaveNoise(x - 4000, z + 8000, 3, 0.5, 2, 0.003) * 12 + octaveNoise(x, z, 2, 0.5, 2, 0.012) * 3;
  },
  color(x, z, h, slope, out) {
    if (h < -0.5) { out.copy(PEAT); return; }
    if (h < 1) { out.lerpColors(SHINGLE, IRISH_GREEN, smoothstep(0, 1, h)); return; }
    out.lerpColors(IRISH_GREEN, IRISH_DARK, smoothstep(-0.2, 0.4, octaveNoise(x, z, 2, 0.5, 2, 0.015)));
    finish(out, x, z, slope, 0.4);
  },
  plants: [
    { name: 'oak', geo: P.oak(), perChunk: 6, shadow: true, scale: [0.8, 1.3],
      fits: (h, s, _x, _z, r) => h > 1.5 && s < 0.3 && r < 0.6 },
    { name: 'hawthorn', geo: P.hawthorn(), perChunk: 14, shadow: false, scale: [0.8, 1.4],
      // Hedgerow lines along field boundaries
      fits: (h, s, x, z) => h > 1 && s < 0.35 && Math.abs(octaveNoise(x, z, 1, 1, 1, 0.02)) < 0.06 },
    { name: 'irish-grass', geo: P.grassTuft(0x5aa040), perChunk: 40, shadow: false, scale: [0.8, 1.5],
      fits: (h, s) => h > 0.6 && s < 0.45 },
    { name: 'irish-stone', geo: P.boulder(0x8a8a86), perChunk: 4, shadow: false, scale: [0.3, 1.0],
      fits: (h) => h > 0.5 },
  ],
  climate: { skyTop: 0x6b93c0, skyBottom: 0xd0dbe4, fog: 0xc4cfd8, fogNear: 130, fogFar: 500, water: 0x3a5560, waterOpacity: 0.82, rain: 0.6, snow: false },
};

// ---------------- Swiss Alps ----------------

const MEADOW = C(0x6aa84f);
const ALPINE_FOREST = C(0x2f5a2a);

export const alps: Biome = {
  id: 'alps',
  name: 'Swiss Alps',
  height(x, z) {
    const valley = 8 + octaveNoise(x + 6000, z, 2, 0.5, 2, 0.003) * 6;
    const peaks = smoothstep(-0.1, 0.5, octaveNoise(x - 12000, z + 3000, 2, 0.5, 2, 0.0012));
    const peak = Math.pow(ridgedNoise(x, z - 9000, 0.0025), 1.5) * 220 + octaveNoise(x, z, 3, 0.5, 2, 0.006) * 30;
    return valley + peaks * Math.max(peak, 0);
  },
  color(x, z, h, slope, out) {
    if (h < -0.5) { out.copy(PEAT); return; }
    out.lerpColors(MEADOW, ALPINE_FOREST, smoothstep(25, 45, h) * (1 - smoothstep(80, 100, h)));
    out.lerp(ROCK, Math.max(smoothstep(0.4, 0.6, slope), smoothstep(95, 115, h)));
    out.lerp(SNOW, smoothstep(135, 150, h + octaveNoise(x, z, 2, 0.5, 2, 0.02) * 10) * (1 - smoothstep(0.55, 0.7, slope)));
    out.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.04);
  },
  plants: [
    { name: 'alpine-spruce', geo: P.spruce(11, 0x23422c), perChunk: 26, shadow: true, scale: [0.7, 1.2],
      fits: (h, s) => h > 20 && h < 95 && s < 0.5 },
    { name: 'wildflowers', geo: P.wildflowers(), perChunk: 30, shadow: false, scale: [0.8, 1.6],
      fits: (h, s) => h > 1 && h < 40 && s < 0.25 },
    { name: 'alpine-grass', geo: P.grassTuft(0x7ab855), perChunk: 30, shadow: false, scale: [0.8, 1.4],
      fits: (h, s) => h > 0.6 && h < 100 && s < 0.4 },
    { name: 'alpine-boulder', geo: P.boulder(0x8a8a8f), perChunk: 10, shadow: false, scale: [0.5, 2.5],
      fits: (h, s, _x, _z, r) => h > 0.5 && s < 0.8 && r < (h > 90 ? 0.9 : 0.25) },
  ],
  climate: { skyTop: 0x3f7fd0, skyBottom: 0xbcd8f0, fog: 0xc6dcef, fogNear: 220, fogFar: 650, water: 0x3d7a8f, waterOpacity: 0.8, rain: 0.3, snow: false },
};

// ---------------- New Zealand Hills ----------------

const NZ_GREEN = C(0x5cb83a);
const TUSSOCK = C(0xc8a65a);

export const newzealand: Biome = {
  id: 'newzealand',
  name: 'New Zealand Hills',
  height(x, z) {
    return 3 + (octaveNoise(x + 15000, z - 15000, 4, 0.5, 2, 0.004) + 0.2) * 40;
  },
  color(x, z, h, slope, out) {
    if (h < -0.5) { out.copy(PEAT); return; }
    if (h < 1) { out.lerpColors(SHINGLE, NZ_GREEN, smoothstep(0, 1, h)); return; }
    out.lerpColors(NZ_GREEN, TUSSOCK, smoothstep(30, 45, h + octaveNoise(x, z, 2, 0.5, 2, 0.01) * 8));
    finish(out, x, z, slope, 0.4);
  },
  plants: [
    { name: 'tree-fern', geo: P.treeFern(), perChunk: 14, shadow: true, scale: [0.8, 1.3],
      fits: (h, s, x, z) => h > 1 && h < 30 && s < 0.4 && octaveNoise(x, z, 2, 0.5, 2, 0.01) > 0.1 },
    { name: 'nz-tree', geo: P.roundTree(0x4f3a28, 0x2a5f2c), perChunk: 10, shadow: true, scale: [0.8, 1.4],
      fits: (h, s, x, z) => h > 1 && h < 35 && s < 0.35 && octaveNoise(x, z, 2, 0.5, 2, 0.01) > 0.2 },
    { name: 'tussock', geo: P.tussock(), perChunk: 30, shadow: false, scale: [0.8, 1.5],
      fits: (h, s) => h > 25 && s < 0.45 },
    { name: 'nz-grass', geo: P.grassTuft(0x6ac24a), perChunk: 34, shadow: false, scale: [0.8, 1.4],
      fits: (h, s) => h > 0.6 && h < 35 && s < 0.4 },
  ],
  climate: { skyTop: 0x3f86d6, skyBottom: 0xbfe0f5, fog: 0xc8e2f2, fogNear: 200, fogFar: 620, water: 0x2f6f86, waterOpacity: 0.8, rain: 0.35, snow: false },
};
