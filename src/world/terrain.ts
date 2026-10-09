import * as THREE from 'three';
import { octaveNoise, ridgedNoise } from '../utils/noise';
import { smoothstep, lerp } from '../utils/math-helpers';

export const CHUNK_SIZE = 64;
const HEIGHT_SEGMENTS = 32;
export const WATER_LEVEL = 0;
const SNOW_LINE = 72;

// Scottish Highlands palette
const COLOR_PEAT = new THREE.Color(0x3b3226);
const COLOR_SHINGLE = new THREE.Color(0x8a8272);
const COLOR_MOOR = new THREE.Color(0x7a8450);
const COLOR_BRACKEN = new THREE.Color(0x9a6a34);
const COLOR_HEATHER = new THREE.Color(0x6e4b5c);
const COLOR_ROCK = new THREE.Color(0x7d7d80);
const COLOR_SNOW = new THREE.Color(0xeef0f4);

// Heightfield cache populated as terrain chunks are generated. This lets runtime
// systems (player/AI/camera) query terrain heights without recomputing noise.
const chunkHeights = new Map<string, Float32Array>();

/**
 * Highland terrain: broad U-shaped glens (whose low floors fill with lochs)
 * between rounded hills, with rocky ridges on the highest ground.
 */
export function getTerrainHeight(x: number, z: number): number {
  // 0 = glen floor, 1 = upland. Raised to a power so floors are wide and sides steep.
  const glen = smoothstep(-0.35, 0.45, octaveNoise(x, z, 3, 0.5, 2, 0.0016));
  const glenShape = Math.pow(glen, 1.5);

  // Glen floors hover around the water line; where they dip below it, there's a loch.
  const floor = 1.5 + octaveNoise(x + 3000, z - 1700, 2, 0.5, 2, 0.0025) * 7;

  const hills = octaveNoise(x - 900, z + 400, 4, 0.5, 2, 0.006);
  const ridge = Math.pow(ridgedNoise(x + 5000, z + 5000, 0.004), 2);
  const upland = 18 + hills * 20 + ridge * 50 * smoothstep(0.5, 1, glen);

  let h = lerp(floor, upland, glenShape);
  h += octaveNoise(x + 1000, z + 1000, 2, 0.4, 2.5, 0.03) * 1.5;

  // Gentle, dry glen floor at spawn
  const d = Math.sqrt(x * x + z * z);
  return lerp(3, h, smoothstep(40, 140, d));
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

function getTerrainColor(x: number, z: number, height: number, normal: THREE.Vector3): THREE.Color {
  const slope = 1 - normal.y;
  const c = tmpColor;
  const patch = octaveNoise(x * 2, z * 2, 2, 0.5, 2, 0.02); // -1..1 patchiness

  if (height < WATER_LEVEL - 0.5) {
    c.copy(COLOR_PEAT);
  } else if (height < 1.2) {
    c.lerpColors(COLOR_SHINGLE, COLOR_MOOR, smoothstep(0.2, 1.2, height));
  } else {
    // Low ground: moor grass with rusty bracken patches; higher: heather takes over.
    c.lerpColors(COLOR_MOOR, COLOR_BRACKEN, smoothstep(0.35, 0.7, patch) * (1 - smoothstep(25, 40, height)));
    const heather = smoothstep(8, 30, height) * smoothstep(-0.4, 0.3, patch) * (1 - smoothstep(55, 75, height));
    c.lerp(COLOR_HEATHER, heather * 0.85);

    // Steep slopes and high ridges are bare rock / scree
    const rock = Math.max(smoothstep(0.3, 0.5, slope), smoothstep(50, 70, height) * 0.8);
    c.lerp(COLOR_ROCK, rock);

    // Patchy snow on the tops
    const snow = smoothstep(SNOW_LINE, SNOW_LINE + 10, height + patch * 6) * (1 - smoothstep(0.45, 0.6, slope));
    c.lerp(COLOR_SNOW, snow);
  }

  c.offsetHSL(0, 0, octaveNoise(x * 3, z * 3, 1, 1, 1, 0.05) * 0.04);
  return c;
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

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.position.set(offsetX, 0, offsetZ);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
