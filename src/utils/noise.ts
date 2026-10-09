import { createNoise2D } from 'simplex-noise';

const SEED = 20261008;

/** Small fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of a 2D grid coordinate, for per-chunk random seeds. */
export function hash2(x: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Seeded so the world looks the same on every load.
const noise2D = createNoise2D(mulberry32(SEED));

export function octaveNoise(
  x: number,
  z: number,
  octaves: number = 4,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
  scale: number = 0.005,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxValue;
}

export function ridgedNoise(x: number, z: number, scale: number = 0.003): number {
  return 1 - Math.abs(octaveNoise(x, z, 3, 0.5, 2.0, scale));
}
