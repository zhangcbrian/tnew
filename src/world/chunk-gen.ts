import * as THREE from 'three';
import { mulberry32, hash2 } from '../utils/noise';
import { getTerrainHeight, getTerrainColor, CHUNK_SIZE, HEIGHT_SEGMENTS } from './terrain';
import { BIOMES, biomeWeights, type Biome, type PlantType } from './biomes';

/** Every plant type in a fixed order; the index is how plant data refers to a type. */
export const PLANT_TYPES: { type: PlantType; biome: Biome }[] = BIOMES.flatMap((biome) =>
  biome.plants.map((type) => ({ type, biome })),
);

export interface PlantData {
  /** Index into PLANT_TYPES */
  type: number;
  /** 16 floats per instance (column-major Matrix4) */
  matrices: Float32Array;
  /** 3 floats per instance */
  tints: Float32Array;
}

/** Everything needed to show a terrain chunk and its plants. Plain typed arrays, so it can cross threads. */
export interface ChunkData {
  cx: number;
  cz: number;
  /** (SEG+1)² heights, row-major in z then x, at full resolution */
  heights: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  plants: PlantData[];
}

const SEG = HEIGHT_SEGMENTS;
const ROW = SEG + 1;
const STEP = CHUNK_SIZE / SEG;
/** Grid with one extra ring all round, so normals at the edges use real neighbors. */
const PROW = ROW + 2;

/**
 * Build a chunk's heights, normals, colors and plants. Pure and deterministic — runs in workers.
 * Normals come from the padded height grid (one height sample per vertex, not five).
 */
export function generateChunk(cx: number, cz: number): ChunkData {
  const x0 = cx * CHUNK_SIZE - CHUNK_SIZE / 2;
  const z0 = cz * CHUNK_SIZE - CHUNK_SIZE / 2;

  const padded = new Float32Array(PROW * PROW);
  for (let j = 0; j < PROW; j++) {
    for (let i = 0; i < PROW; i++) {
      padded[i + j * PROW] = getTerrainHeight(x0 + (i - 1) * STEP, z0 + (j - 1) * STEP);
    }
  }

  const n = ROW * ROW;
  const heights = new Float32Array(n);
  const normals = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const normal = new THREE.Vector3();

  for (let j = 0; j < ROW; j++) {
    for (let i = 0; i < ROW; i++) {
      const p = i + 1 + (j + 1) * PROW;
      const h = padded[p];
      const k = i + j * ROW;
      heights[k] = h;
      // Central differences over 2 steps
      const dx = padded[p + 1] - padded[p - 1];
      const dz = padded[p + PROW] - padded[p - PROW];
      normal.set(-dx, 4 * STEP / 2, -dz).normalize();
      normals[k * 3] = normal.x;
      normals[k * 3 + 1] = normal.y;
      normals[k * 3 + 2] = normal.z;
      const c = getTerrainColor(x0 + i * STEP, z0 + j * STEP, h, normal);
      colors[k * 3] = c.r;
      colors[k * 3 + 1] = c.g;
      colors[k * 3 + 2] = c.b;
    }
  }

  return { cx, cz, heights, normals, colors, plants: placePlants(cx, cz, heights, normals) };
}

/** Bilinear height inside the chunk from its own grid (same as the main thread's cached lookup). */
function sampleGrid(arr: Float32Array, stride: number, offset: number, lx: number, lz: number): number {
  const fx = Math.min(Math.max(lx / STEP, 0), SEG - 1e-6);
  const fz = Math.min(Math.max(lz / STEP, 0), SEG - 1e-6);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const at = (a: number, b: number) => arr[(a + b * ROW) * stride + offset];
  const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
  const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
  return top + (bottom - top) * tz;
}

const dummy = new THREE.Object3D();

function placePlants(cx: number, cz: number, heights: Float32Array, normals: Float32Array): PlantData[] {
  const xc = cx * CHUNK_SIZE;
  const zc = cz * CHUNK_SIZE;

  // Landscapes present anywhere in this chunk (center + corners)
  const present = new Set<Biome>();
  for (const [dx, dz] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    for (const { biome } of biomeWeights(xc + dx * CHUNK_SIZE, zc + dz * CHUNK_SIZE)) present.add(biome);
  }

  const out: PlantData[] = [];
  PLANT_TYPES.forEach(({ type, biome }, t) => {
    if (!present.has(biome)) return;
    const rng = mulberry32(hash2(cx, cz) + t * 7919);
    const matrices: number[] = [];
    const tints: number[] = [];
    let placed = 0;
    for (let attempt = 0; attempt < type.perChunk * 2 && placed < type.perChunk; attempt++) {
      const x = xc + (rng() - 0.5) * CHUNK_SIZE;
      const z = zc + (rng() - 0.5) * CHUNK_SIZE;
      const r = rng();
      const pick = rng();
      if (present.size > 1 && biomeAt(x, z, pick) !== biome) continue;
      const lx = x - (xc - CHUNK_SIZE / 2);
      const lz = z - (zc - CHUNK_SIZE / 2);
      const h = sampleGrid(heights, 1, 0, lx, lz);
      const slope = 1 - sampleGrid(normals, 3, 1, lx, lz);
      if (!type.fits(h, slope, x, z, r)) continue;

      const s = type.scale[0] + rng() * (type.scale[1] - type.scale[0]);
      dummy.position.set(x, h - 0.05, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.85 + rng() * 0.3), s);
      dummy.updateMatrix();
      matrices.push(...dummy.matrix.elements);
      const v = 0.85 + rng() * 0.25;
      tints.push(v, v * (0.95 + rng() * 0.1), v);
      placed++;
    }
    if (placed > 0) out.push({ type: t, matrices: new Float32Array(matrices), tints: new Float32Array(tints) });
  });
  return out;
}

/** Pick one landscape at (x, z) in proportion to the blend weights. */
function biomeAt(x: number, z: number, pick: number): Biome {
  const weights = biomeWeights(x, z);
  let acc = 0;
  for (const { biome, w } of weights) {
    acc += w;
    if (pick < acc) return biome;
  }
  return weights[weights.length - 1].biome;
}
