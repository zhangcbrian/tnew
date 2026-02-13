import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

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
