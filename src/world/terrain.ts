import * as THREE from 'three';
import { biomeWeights } from './biomes';
import { smoothstep, lerp } from '../utils/math-helpers';

export const CHUNK_SIZE = 64;
export const HEIGHT_SEGMENTS = 32;
export const WATER_LEVEL = 0;

// Heightfield cache populated as terrain chunks are generated. This lets runtime
// systems (player/AI/camera) query terrain heights without recomputing noise.
const chunkHeights = new Map<string, Float32Array>();

/**
 * Ground height: the landscape (biome) of this region, blended with its neighbors
 * near region edges. The spawn point sits on a gentle, dry patch.
 */
export function getTerrainHeight(x: number, z: number): number {
  let h = 0;
  for (const { biome, w } of biomeWeights(x, z)) h += biome.height(x, z) * w;
  const d = Math.sqrt(x * x + z * z);
  return d < 140 ? lerp(3, h, smoothstep(40, 140, d)) : h;
}

/** Steepness at (x, z): 0 = flat, 1 = vertical. */
export function getTerrainSlope(x: number, z: number): number {
  const dx = getTerrainHeight(x + 1, z) - getTerrainHeight(x - 1, z);
  const dz = getTerrainHeight(x, z + 1) - getTerrainHeight(x, z - 1);
  const ny = 2 / Math.sqrt(dx * dx + dz * dz + 4);
  return 1 - ny;
}

/** Drop the cached heightfield of a chunk that has been unloaded. */
export function forgetChunkHeights(chunkX: number, chunkZ: number) {
  chunkHeights.delete(`${chunkX},${chunkZ}`);
}

/**
 * Fast terrain height lookup using the cached heightfield generated for terrain
 * chunks. Falls back to noise-based height if the cache isn't available.
 */
export function getTerrainHeightCached(x: number, z: number): number {
  const cx = Math.floor((x + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
  const cz = Math.floor((z + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
  const heights = chunkHeights.get(`${cx},${cz}`);
  if (!heights) return getTerrainHeight(x, z);

  const offsetX = cx * CHUNK_SIZE;
  const offsetZ = cz * CHUNK_SIZE;

  // Local coordinates inside the chunk in [-CHUNK_SIZE/2, CHUNK_SIZE/2).
  const lx = x - offsetX;
  const lz = z - offsetZ;

  const fx = (lx / CHUNK_SIZE + 0.5) * HEIGHT_SEGMENTS;
  const fz = (lz / CHUNK_SIZE + 0.5) * HEIGHT_SEGMENTS;

  const x0 = Math.max(0, Math.min(HEIGHT_SEGMENTS - 1, Math.floor(fx)));
  const z0 = Math.max(0, Math.min(HEIGHT_SEGMENTS - 1, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - x0));
  const tz = Math.max(0, Math.min(1, fz - z0));

  const row = HEIGHT_SEGMENTS + 1;
  const i00 = x0 + z0 * row;
  const i10 = (x0 + 1) + z0 * row;
  const i01 = x0 + (z0 + 1) * row;
  const i11 = (x0 + 1) + (z0 + 1) * row;

  const h00 = heights[i00];
  const h10 = heights[i10];
  const h01 = heights[i01];
  const h11 = heights[i11];

  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return hx0 + (hx1 - hx0) * tz;
}

const tmpColor = new THREE.Color();

/** Shared by every chunk; never disposed. */
export const terrainMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.02,
});

const blendTmp = new THREE.Color();

export function getTerrainColor(x: number, z: number, height: number, normal: THREE.Vector3): THREE.Color {
  const slope = 1 - normal.y;
  const weights = biomeWeights(x, z);
  if (weights.length === 1) {
    weights[0].biome.color(x, z, height, slope, tmpColor);
    return tmpColor;
  }
  tmpColor.setRGB(0, 0, 0);
  for (const { biome, w } of weights) {
    biome.color(x, z, height, slope, blendTmp);
    tmpColor.r += blendTmp.r * w;
    tmpColor.g += blendTmp.g * w;
    tmpColor.b += blendTmp.b * w;
  }
  return tmpColor;
}

/** Store a chunk's full-resolution heights for gameplay lookups. */
export function storeChunkHeights(chunkX: number, chunkZ: number, heights: Float32Array) {
  chunkHeights.set(`${chunkX},${chunkZ}`, heights);
}

/** How far the edge skirt hangs down; hides cracks between chunks drawn at different detail. */
const SKIRT_DROP = 4;

/**
 * Terrain geometry for a chunk, using every `step`-th vertex of its full-resolution data
 * (1 = full detail, 2 = half, 4 = quarter), plus a skirt around the edge.
 */
export function buildChunkGeometry(data: { heights: Float32Array; normals: Float32Array; colors: Float32Array }, step: number): THREE.BufferGeometry {
  const row = HEIGHT_SEGMENTS + 1;
  const n = HEIGHT_SEGMENTS / step; // cells per side
  const side = n + 1;
  const cell = CHUNK_SIZE / n;
  const half = CHUNK_SIZE / 2;

  // Edge vertices, walked around the perimeter, each get a dropped copy for the skirt.
  const edge: [number, number][] = [];
  for (let i = 0; i < n; i++) edge.push([i, 0]);
  for (let j = 0; j < n; j++) edge.push([n, j]);
  for (let i = n; i > 0; i--) edge.push([i, n]);
  for (let j = n; j > 0; j--) edge.push([0, j]);

  const count = side * side + edge.length;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  const put = (v: number, i: number, j: number, drop: number) => {
    const src = i * step + j * step * row;
    pos[v * 3] = -half + i * cell;
    pos[v * 3 + 1] = data.heights[src] - drop;
    pos[v * 3 + 2] = -half + j * cell;
    for (let c = 0; c < 3; c++) {
      nor[v * 3 + c] = data.normals[src * 3 + c];
      col[v * 3 + c] = data.colors[src * 3 + c];
    }
  };
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) put(i + j * side, i, j, 0);
  edge.forEach(([i, j], e) => put(side * side + e, i, j, SKIRT_DROP));

  const index: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = i + j * side;
      const b = i + (j + 1) * side;
      const c = i + 1 + (j + 1) * side;
      const d = i + 1 + j * side;
      index.push(a, b, d, b, c, d);
    }
  }
  // Skirt: a strip from each edge vertex down to its dropped copy, drawn from both sides.
  for (let e = 0; e < edge.length; e++) {
    const [i0, j0] = edge[e];
    const [i1, j1] = edge[(e + 1) % edge.length];
    const top0 = i0 + j0 * side;
    const top1 = i1 + j1 * side;
    const low0 = side * side + e;
    const low1 = side * side + ((e + 1) % edge.length);
    index.push(top0, low0, top1, top1, low0, low1);
    index.push(top0, top1, low0, top1, low1, low0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}
