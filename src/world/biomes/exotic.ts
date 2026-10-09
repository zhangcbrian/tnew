import * as THREE from 'three';
import { octaveNoise, ridgedNoise } from '../../utils/noise';
import { smoothstep, lerp } from '../../utils/math-helpers';
import type { Biome } from './types';
import * as P from './plants';

const C = (hex: number) => new THREE.Color(hex);
const shade = (out: THREE.Color, x: number, z: number, amt = 0.04) =>
  out.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * amt);

// ---------------- Sahara Desert ----------------

const SAND = C(0xd9b56a);
const SAND_DARK = C(0xc89a52);
const DESERT_ROCK = C(0x9c6b3e);
const OASIS_GREEN = C(0x6b8f3a);

/** 0..1: how much this point is an oasis hollow */
function oasis(x: number, z: number): number {
  return smoothstep(0.72, 0.8, octaveNoise(x - 30000, z + 20000, 2, 0.5, 2, 0.002));
}

export const sahara: Biome = {
  id: 'sahara',
  name: 'Sahara Desert',
  height(x, z) {
    // Long dune ridges (stretched along x, wobbling), big gentle swells, rocky outcrops
    const wobble = octaveNoise(x, z, 2, 0.5, 2, 0.002) * 300;
    const dune = Math.pow(ridgedNoise((x + wobble) * 0.6, z * 1.6, 0.006), 3) * 18;
    let h = 6 + octaveNoise(x + 2000, z, 2, 0.5, 2, 0.0008) * 8 + dune;
    const rock = smoothstep(0.6, 0.8, octaveNoise(x + 9000, z, 2, 0.5, 2, 0.003));
    h += rock * (10 + ridgedNoise(x, z, 0.02) * 15);
    h = Math.max(h, 1.5); // dry everywhere...
    return lerp(h, -1.5, oasis(x, z)); // ...except the rare oasis
  },
  color(x, z, h, slope, out) {
    out.lerpColors(SAND, SAND_DARK, smoothstep(-0.3, 0.5, octaveNoise(x, z, 2, 0.5, 2, 0.01)));
    const rock = smoothstep(0.6, 0.75, octaveNoise(x + 9000, z, 2, 0.5, 2, 0.003));
    out.lerp(DESERT_ROCK, Math.max(rock, smoothstep(0.45, 0.6, slope)));
    if (h < 3) out.lerp(OASIS_GREEN, oasis(x, z) * (1 - smoothstep(0, 3, h)) * 1.5);
    shade(out, x, z, 0.03);
  },
  plants: [
    { name: 'palm', geo: P.palm(), perChunk: 14, shadow: true, scale: [0.8, 1.3],
      fits: (h, _s, x, z) => h > -0.3 && h < 3 && oasis(x, z) > 0.2 },
    { name: 'dry-shrub', geo: P.dryShrub(), perChunk: 6, shadow: false, scale: [0.6, 1.2],
      fits: (h, s, _x, _z, r) => h > 1.5 && s < 0.3 && r < 0.4 },
    { name: 'desert-rock', geo: P.boulder(0xa0703f), perChunk: 6, shadow: false, scale: [0.5, 2.5],
      fits: (h, s, x, z) => h > 1.5 && s < 0.8 && octaveNoise(x + 9000, z, 2, 0.5, 2, 0.003) > 0.5 },
  ],
  climate: { skyTop: 0x6fa3d8, skyBottom: 0xf0dcb0, fog: 0xe8d3a8, fogNear: 150, fogFar: 520, water: 0x3f8a8a, waterOpacity: 0.8, rain: 0, snow: false },
};

// ---------------- Amazon Rainforest ----------------

const JUNGLE_FLOOR = C(0x2e5e22);
const JUNGLE_LIGHT = C(0x3f7a2a);
const MUD = C(0x6b5434);

export const amazon: Biome = {
  id: 'amazon',
  name: 'Amazon Rainforest',
  height(x, z) {
    const h = 4 + octaveNoise(x - 8000, z, 3, 0.5, 2, 0.002) * 4 + octaveNoise(x, z, 2, 0.5, 2, 0.01) * 1.5;
    // Winding rivers
    const r = Math.abs(octaveNoise(x + 10000, z + 10000, 2, 0.5, 2, 0.0007));
    return lerp(h, -4, 1 - smoothstep(0.015, 0.05, r));
  },
  color(x, z, h, _slope, out) {
    if (h < 1.5) { out.copy(MUD); return; }
    out.lerpColors(JUNGLE_FLOOR, JUNGLE_LIGHT, smoothstep(-0.3, 0.5, octaveNoise(x, z, 2, 0.5, 2, 0.02)));
    shade(out, x, z);
  },
  plants: [
    { name: 'kapok', geo: P.kapok(), perChunk: 4, shadow: true, scale: [0.8, 1.2],
      fits: (h, s, _x, _z, r) => h > 2 && s < 0.3 && r < 0.6 },
    { name: 'jungle-tree', geo: P.jungleTree(), perChunk: 40, shadow: true, scale: [0.7, 1.4],
      fits: (h, s) => h > 1.8 && s < 0.45 },
    { name: 'big-leaf', geo: P.bigLeaf(), perChunk: 40, shadow: false, scale: [0.8, 1.8],
      fits: (h, s) => h > 1.5 && s < 0.5 },
  ],
  climate: { skyTop: 0x7aa3b8, skyBottom: 0xd6e3d8, fog: 0xb8c9b8, fogNear: 80, fogFar: 380, water: 0x5a4a30, waterOpacity: 0.9, rain: 0.8, snow: false },
};

// ---------------- American Southwest ----------------

const RED_ROCK = C(0xb5562b);
const ORANGE_ROCK = C(0xd0823f);
const DESERT_FLOOR = C(0xd9a066);

export const southwest: Biome = {
  id: 'southwest',
  name: 'American Southwest',
  height(x, z) {
    // Stepped mesas: flat tops with steep sides
    const n = octaveNoise(x + 40000, z, 3, 0.5, 2, 0.0015) * 0.5 + 0.5;
    const steps = 3;
    const s = Math.max(n, 0) * steps;
    const f = Math.floor(s);
    const terrace = (f + smoothstep(0.85, 0.95, s - f)) / steps;
    let h = 4 + terrace * 70;
    // Canyons cut through, with a river at the bottom
    const c = Math.abs(octaveNoise(x - 5000, z + 5000, 2, 0.5, 2, 0.001));
    h = lerp(h, 3, 1 - smoothstep(0.02, 0.07, c));
    return lerp(h, -2, 1 - smoothstep(0.004, 0.012, c));
  },
  color(x, z, h, slope, out) {
    if (h < 1) { out.copy(DESERT_FLOOR).offsetHSL(0, 0, -0.15); return; }
    // Horizontal rock bands on cliffs, sandy floor on flats
    out.lerpColors(RED_ROCK, ORANGE_ROCK, Math.sin(h * 0.6) * 0.5 + 0.5);
    out.lerp(DESERT_FLOOR, (1 - smoothstep(0.15, 0.35, slope)) * 0.7);
    shade(out, x, z, 0.03);
  },
  plants: [
    { name: 'saguaro', geo: P.saguaro(), perChunk: 6, shadow: true, scale: [0.7, 1.3],
      fits: (h, s, _x, _z, r) => h > 2 && s < 0.2 && r < 0.5 },
    { name: 'sagebrush', geo: P.sagebrush(), perChunk: 22, shadow: false, scale: [0.6, 1.3],
      fits: (h, s) => h > 1 && s < 0.25 },
    { name: 'juniper', geo: P.juniper(), perChunk: 6, shadow: false, scale: [0.7, 1.3],
      fits: (h, s, _x, _z, r) => h > 20 && s < 0.25 && r < 0.6 },
    { name: 'red-boulder', geo: P.boulder(0xa4552d), perChunk: 8, shadow: false, scale: [0.5, 2.5],
      fits: (h, s) => h > 1 && s < 0.8 },
  ],
  climate: { skyTop: 0x4a8bd6, skyBottom: 0xf2d2b0, fog: 0xe6c7a2, fogNear: 200, fogFar: 620, water: 0x4a6f6a, waterOpacity: 0.8, rain: 0.05, snow: false },
};

// ---------------- African Savanna ----------------

const GOLD_GRASS = C(0xc9a94e);
const DRY_GRASS = C(0xa88a3c);
const RED_EARTH = C(0x9a5a32);
const KOPJE = C(0x8a7a66);

function kopje(x: number, z: number): number {
  return smoothstep(0.75, 0.9, octaveNoise(x + 20000, z, 2, 0.5, 2, 0.004));
}

export const savanna: Biome = {
  id: 'savanna',
  name: 'African Savanna',
  height(x, z) {
    let h = 5 + octaveNoise(x, z - 7000, 2, 0.5, 2, 0.0015) * 4 + octaveNoise(x, z, 2, 0.5, 2, 0.008);
    h += kopje(x, z) * 12 * (0.6 + ridgedNoise(x, z, 0.03) * 0.4); // granite outcrops
    h = Math.max(h, 1.5);
    const hole = smoothstep(0.75, 0.82, octaveNoise(x, z - 40000, 2, 0.5, 2, 0.003));
    return lerp(h, -1.5, hole); // rare waterholes
  },
  color(x, z, h, slope, out) {
    if (h < 1.2) { out.copy(RED_EARTH); return; }
    out.lerpColors(GOLD_GRASS, DRY_GRASS, smoothstep(-0.3, 0.5, octaveNoise(x, z, 2, 0.5, 2, 0.01)));
    out.lerp(RED_EARTH, smoothstep(0.4, 0.7, octaveNoise(x + 500, z, 2, 0.5, 2, 0.02)) * 0.6);
    out.lerp(KOPJE, Math.max(kopje(x, z), smoothstep(0.35, 0.5, slope)));
    shade(out, x, z, 0.03);
  },
  plants: [
    { name: 'acacia', geo: P.acacia(), perChunk: 5, shadow: true, scale: [0.8, 1.3],
      fits: (h, s, _x, _z, r) => h > 1.5 && s < 0.25 && r < 0.6 },
    { name: 'tall-grass', geo: P.tallGrass(), perChunk: 45, shadow: false, scale: [0.8, 1.5],
      fits: (h, s) => h > 1.5 && s < 0.35 },
    { name: 'termite-mound', geo: P.termiteMound(), perChunk: 2, shadow: false, scale: [0.6, 1.2],
      fits: (h, s, _x, _z, r) => h > 1.5 && s < 0.2 && r < 0.5 },
    { name: 'kopje-rock', geo: P.boulder(0x8f8070), perChunk: 8, shadow: false, scale: [0.8, 3],
      fits: (h, _s, x, z) => h > 2 && kopje(x, z) > 0.3 },
  ],
  climate: { skyTop: 0x5f9ad6, skyBottom: 0xf1e0b8, fog: 0xe6d6ae, fogNear: 200, fogFar: 620, water: 0x6a6040, waterOpacity: 0.88, rain: 0.15, snow: false },
};

// ---------------- Arctic Tundra ----------------

const SNOWFIELD = C(0xf0f3f6);
const WINDSWEPT = C(0xb9c0c4);
const ARCTIC_ROCK = C(0x6f7478);

export const arctic: Biome = {
  id: 'arctic',
  name: 'Arctic Tundra',
  height(x, z) {
    return 3 + octaveNoise(x, z + 25000, 3, 0.5, 2, 0.002) * 5 + Math.pow(ridgedNoise(x, z, 0.004), 4) * 12;
  },
  color(x, z, h, slope, out) {
    out.lerpColors(SNOWFIELD, WINDSWEPT, smoothstep(0.2, 0.6, octaveNoise(x, z, 2, 0.5, 2, 0.015)) * 0.7);
    out.lerp(ARCTIC_ROCK, smoothstep(0.3, 0.5, slope));
    if (h < 0) out.copy(WINDSWEPT);
    shade(out, x, z, 0.02);
  },
  plants: [
    { name: 'arctic-shrub', geo: P.arcticShrub(), perChunk: 16, shadow: false, scale: [0.6, 1.3],
      fits: (h, s) => h > 0.5 && s < 0.35 },
    { name: 'snow-rock', geo: P.snowRock(), perChunk: 8, shadow: false, scale: [0.5, 2],
      fits: (h, s) => h > 0.5 && s < 0.7 },
    { name: 'dwarf-spruce', geo: P.spruce(4, 0x2c4a33), perChunk: 4, shadow: false, scale: [0.6, 1.1],
      fits: (h, s, _x, _z, r) => h > 1 && s < 0.3 && r < 0.4 },
  ],
  climate: { skyTop: 0x8fb3d6, skyBottom: 0xe8f0f6, fog: 0xdfe8ef, fogNear: 120, fogFar: 480, water: 0xbcd6e0, waterOpacity: 0.97, rain: 0.4, snow: true },
};
