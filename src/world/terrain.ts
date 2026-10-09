import * as THREE from 'three';
import { biomeWeights } from './biomes';
import { smoothstep, lerp } from '../utils/math-helpers';

export const CHUNK_SIZE = 64;
const HEIGHT_SEGMENTS = 32;
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

function getTerrainColor(x: number, z: number, height: number, normal: THREE.Vector3): THREE.Color {
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

export function createTerrainChunk(
  chunkX: number,
  chunkZ: number,
): THREE.Mesh {
  const segments = HEIGHT_SEGMENTS;
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const heights = new Float32Array(positions.count);
  const colors = new Float32Array(positions.count * 3);

  const offsetX = chunkX * CHUNK_SIZE;
  const offsetZ = chunkZ * CHUNK_SIZE;

  // Displace heights
  for (let i = 0; i < positions.count; i++) {
    const wx = positions.getX(i) + offsetX;
    const wz = positions.getZ(i) + offsetZ;
    const h = getTerrainHeight(wx, wz);
    positions.setY(i, h);
    heights[i] = h;
  }

  // Normals from the height function itself (not per-chunk geometry), so neighboring
  // chunks light identically along their shared edges — no visible seams.
  const normals = geometry.attributes.normal;
  for (let i = 0; i < positions.count; i++) {
    const wx = positions.getX(i) + offsetX;
    const wz = positions.getZ(i) + offsetZ;
    const dx = getTerrainHeight(wx + 1, wz) - getTerrainHeight(wx - 1, wz);
    const dz = getTerrainHeight(wx, wz + 1) - getTerrainHeight(wx, wz - 1);
    const len = Math.sqrt(dx * dx + dz * dz + 4);
    normals.setXYZ(i, -dx / len, 2 / len, -dz / len);
  }
  normals.needsUpdate = true;
  chunkHeights.set(`${chunkX},${chunkZ}`, heights);

  // Vertex colors
  const tmpNormal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    const wx = positions.getX(i) + offsetX;
    const wz = positions.getZ(i) + offsetZ;
    const wy = positions.getY(i);
    tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
    const color = getTerrainColor(wx, wz, wy, tmpNormal);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.position.set(offsetX, 0, offsetZ);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
