import type * as THREE from 'three';
import type { PlantType } from './plants';

export type BiomeId =
  | 'highlands' | 'fjords' | 'ireland' | 'alps' | 'newzealand'
  | 'sahara' | 'amazon' | 'southwest' | 'savanna' | 'arctic';

/** Sky, air, water and weather of a landscape. Colors are hex numbers. */
export interface ClimateDef {
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  water: number;
  waterOpacity: number;
  /** How rainy (0 = never, 1 = very often) */
  rain: number;
  /** Falls as snow instead of rain */
  snow: boolean;
}

export interface Biome {
  id: BiomeId;
  name: string;
  /** Ground height; water is below 0. */
  height(x: number, z: number): number;
  /** Ground color at a point, written into `out`. */
  color(x: number, z: number, h: number, slope: number, out: THREE.Color): void;
  plants: PlantType[];
  climate: ClimateDef;
}
