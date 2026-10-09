import * as THREE from 'three';
import { hash2 } from '../../utils/noise';
import { smoothstep } from '../../utils/math-helpers';
import type { Biome, BiomeId, ClimateDef } from './types';
import { highlands, fjords, ireland, alps, newzealand } from './temperate';
import { sahara, amazon, southwest, savanna, arctic } from './exotic';

export type { Biome, BiomeId, ClimateDef } from './types';
export type { PlantType } from './plants';

/** 50 miles, in game units (1 unit ≈ 1 m). */
export const REGION_SIZE = 80467;
/** Regions blend over this distance on each side of their shared edge (≈ half a mile in total). */
const BLEND = 400;
const BLEND_FRAC = BLEND / REGION_SIZE;

const TEMPERATE: Biome[] = [highlands, fjords, ireland, alps, newzealand];
const EXOTIC: Biome[] = [sahara, amazon, southwest, savanna, arctic];
export const BIOMES: Biome[] = [...TEMPERATE, ...EXOTIC];

export interface BiomeWeight {
  biome: Biome;
  w: number;
}

/** The region grid cell containing (x, z). Region (0, 0) is centered on spawn. */
export function regionOf(x: number, z: number): [number, number] {
  return [Math.round(x / REGION_SIZE), Math.round(z / REGION_SIZE)];
}

/** Which landscape a region is: Highlands at spawn; elsewhere about 1 in 3 is exotic. */
export function biomeOfRegion(rx: number, rz: number): Biome {
  if (rx === 0 && rz === 0) return highlands;
  const h = hash2(rx * 7 + 3, rz * 13 + 5);
  if (h % 3 === 0) return EXOTIC[(h >>> 4) % EXOTIC.length];
  return TEMPERATE[(h >>> 8) % TEMPERATE.length];
}

// Region interiors (the vast majority of samples) reuse one array per region instead of allocating.
const single = new Map<string, BiomeWeight[]>();

/**
 * The landscapes at (x, z) and how much each counts (weights sum to 1).
 * Inside a region it's just that region; near an edge the neighbor mixes in, 50/50 on the line.
 */
export function biomeWeights(x: number, z: number): BiomeWeight[] {
  const rx = Math.round(x / REGION_SIZE);
  const rz = Math.round(z / REGION_SIZE);
  const u = x / REGION_SIZE - rx; // -0.5 .. 0.5 across the region
  const v = z / REGION_SIZE - rz;
  const du = 0.5 - Math.abs(u);
  const dv = 0.5 - Math.abs(v);

  if (du >= BLEND_FRAC && dv >= BLEND_FRAC) {
    const key = `${rx},${rz}`;
    let w = single.get(key);
    if (!w) {
      w = [{ biome: biomeOfRegion(rx, rz), w: 1 }];
      if (single.size > 64) single.clear();
      single.set(key, w);
    }
    return w;
  }

  // Own share along each axis: 1 deep inside, 0.5 exactly on the edge.
  const wx = 0.5 + 0.5 * smoothstep(0, BLEND_FRAC, du);
  const wz = 0.5 + 0.5 * smoothstep(0, BLEND_FRAC, dv);
  const nx = rx + Math.sign(u);
  const nz = rz + Math.sign(v);
  const out: BiomeWeight[] = [];
  const add = (bx: number, bz: number, w: number) => {
    if (w <= 0) return;
    const biome = biomeOfRegion(bx, bz);
    const same = out.find((o) => o.biome === biome);
    if (same) same.w += w;
    else out.push({ biome, w });
  };
  add(rx, rz, wx * wz);
  add(nx, rz, (1 - wx) * wz);
  add(rx, nz, wx * (1 - wz));
  add(nx, nz, (1 - wx) * (1 - wz));
  return out;
}

/** The landscape that counts most at (x, z). */
export function dominantBiome(x: number, z: number): Biome {
  let best: BiomeWeight | null = null;
  for (const bw of biomeWeights(x, z)) if (!best || bw.w > best.w) best = bw;
  return best!.biome;
}

/** Climate at (x, z), blended across nearby landscapes. Colors as THREE.Color. */
export interface Climate {
  skyTop: THREE.Color;
  skyBottom: THREE.Color;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  water: THREE.Color;
  waterOpacity: number;
  rain: number;
  snow: number; // 0..1 share of the weather that falls as snow
}

export function createClimate(): Climate {
  return {
    skyTop: new THREE.Color(), skyBottom: new THREE.Color(), fog: new THREE.Color(), fogNear: 0, fogFar: 0,
    water: new THREE.Color(), waterOpacity: 0, rain: 0, snow: 0,
  };
}

const tmp = new THREE.Color();

export function blendClimate(x: number, z: number, out: Climate): Climate {
  out.skyTop.setRGB(0, 0, 0);
  out.skyBottom.setRGB(0, 0, 0);
  out.fog.setRGB(0, 0, 0);
  out.water.setRGB(0, 0, 0);
  out.fogNear = out.fogFar = out.waterOpacity = out.rain = out.snow = 0;
  for (const { biome, w } of biomeWeights(x, z)) {
    const c: ClimateDef = biome.climate;
    out.skyTop.add(tmp.set(c.skyTop).multiplyScalar(w));
    out.skyBottom.add(tmp.set(c.skyBottom).multiplyScalar(w));
    out.fog.add(tmp.set(c.fog).multiplyScalar(w));
    out.water.add(tmp.set(c.water).multiplyScalar(w));
    out.fogNear += c.fogNear * w;
    out.fogFar += c.fogFar * w;
    out.waterOpacity += c.waterOpacity * w;
    out.rain += c.rain * w;
    out.snow += (c.snow ? 1 : 0) * w;
  }
  return out;
}

export function getBiome(id: BiomeId): Biome {
  return BIOMES.find((b) => b.id === id)!;
}
