import * as THREE from 'three';
import { octaveNoise } from '../utils/noise';
import { smoothstep, clamp } from '../utils/math-helpers';

export const WORLD_SIZE = 2048;
export const CHUNK_SIZE = 64;
export const HALF_WORLD = WORLD_SIZE / 2;
const HEIGHT_SEGMENTS = 32;
const MAX_HEIGHT = 30;
const WATER_LEVEL = 0;

const COLOR_GRASS = new THREE.Color(0x4a8c3f);
const COLOR_DIRT = new THREE.Color(0x8b6914);
const COLOR_ROCK = new THREE.Color(0x777788);
const COLOR_SAND = new THREE.Color(0xc2b280);
const COLOR_SNOW = new THREE.Color(0xe8e8f0);

const COLOR_SURREAL_1 = new THREE.Color(0x9b59b6);
const COLOR_SURREAL_2 = new THREE.Color(0x00bcd4);
const COLOR_SURREAL_3 = new THREE.Color(0xff6f61);
const COLOR_SURREAL_4 = new THREE.Color(0xf39c12);

// Heightfield cache populated as terrain chunks are generated. This lets runtime
// systems (player/AI/camera) query terrain heights without recomputing noise.
const chunkHeights = new Map<string, Float32Array>();

export function getTerrainHeight(x: number, z: number): number {
  const r = getSurrealFactor(x, z);
  const base = octaveNoise(x, z, 4, 0.5, 2.0, 0.006);
  const detail = octaveNoise(x + 1000, z + 1000, 2, 0.4, 2.5, 0.02);

  let h = (base * 0.8 + detail * 0.2) * MAX_HEIGHT;

  // Flatten near center for nice spawn area
  const distFromCenter = Math.sqrt(x * x + z * z);
  const flatZone = smoothstep(20, 60, distFromCenter);
  h *= flatZone;

  // More dramatic terrain at edges
  const edgeFactor = 1 + r * 1.5;
  h *= edgeFactor;

  return h;
}

export function getSurrealFactor(x: number, z: number): number {
  const dx = x / HALF_WORLD;
  const dz = z / HALF_WORLD;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return smoothstep(0.4, 0.9, dist);
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

function getTerrainColor(x: number, z: number, height: number, normal: THREE.Vector3): THREE.Color {
  const surreal = getSurrealFactor(x, z);
  const slope = 1 - normal.y;

  // Realistic color based on height and slope
  let realistic = new THREE.Color();
  if (height < WATER_LEVEL + 1) {
    realistic.copy(COLOR_SAND);
  } else if (slope > 0.5) {
    realistic.copy(COLOR_ROCK);
  } else if (height > MAX_HEIGHT * 0.7) {
    realistic.lerpColors(COLOR_ROCK, COLOR_SNOW, smoothstep(MAX_HEIGHT * 0.7, MAX_HEIGHT * 0.9, height));
  } else if (height > MAX_HEIGHT * 0.3) {
    realistic.lerpColors(COLOR_GRASS, COLOR_DIRT, smoothstep(MAX_HEIGHT * 0.3, MAX_HEIGHT * 0.6, height));
  } else {
    realistic.copy(COLOR_GRASS);
  }

  // Add noise variation
  const variation = octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.1;
  realistic.offsetHSL(0, 0, variation);

  // Surreal color
  const surIdx = Math.abs(octaveNoise(x, z, 1, 1, 1, 0.01));
  const surreal1 = new THREE.Color().lerpColors(COLOR_SURREAL_1, COLOR_SURREAL_2, surIdx);
  const surreal2 = new THREE.Color().lerpColors(COLOR_SURREAL_3, COLOR_SURREAL_4, surIdx);
  const surrealColor = new THREE.Color().lerpColors(
    surreal1,
    surreal2,
    Math.abs(octaveNoise(x + 500, z + 500, 1, 1, 1, 0.008)),
  );

  // Blend
  const result = new THREE.Color();
  result.lerpColors(realistic, surrealColor, surreal);
  return result;
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
  const normals = geometry.attributes.normal;

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

  geometry.computeVertexNormals();
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

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(offsetX, 0, offsetZ);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
