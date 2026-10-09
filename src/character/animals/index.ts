import * as THREE from 'three';
import { createOtter } from '../otter';
import type { AnimalMats } from './kit';
import { createDog, createBunny, createFox, createBear, createPig, createHorse } from './land';
import { createDolphin, createPenguin, createFrog, createTurtle } from './water';
import { createDragon } from './fantasy';

export { createAnimalMats, type AnimalMats } from './kit';

export type AnimalId =
  | 'otter' | 'dolphin' | 'dog' | 'bunny' | 'fox' | 'bear'
  | 'penguin' | 'pig' | 'frog' | 'turtle' | 'horse' | 'dragon';

export interface AnimalDef {
  id: AnimalId;
  name: string;
  /** Default body / belly colors. */
  body: string;
  belly: string;
  /** Where the wings attach: x is the distance from center, y the height. */
  wingX: number;
  wingY: number;
  build(m: AnimalMats): THREE.Group;
}

export const ANIMALS: AnimalDef[] = [
  { id: 'otter', name: 'Sea Otter', body: '#2b4f72', belly: '#7a9cb8', wingX: 0.45, wingY: 0.65, build: createOtter },
  { id: 'dolphin', name: 'Dolphin', body: '#5b7f9e', belly: '#d8e4ee', wingX: 0.32, wingY: 0.72, build: createDolphin },
  { id: 'dog', name: 'Dog', body: '#b07a43', belly: '#f0dcc0', wingX: 0.38, wingY: 0.8, build: createDog },
  { id: 'bunny', name: 'Bunny', body: '#d9d2c8', belly: '#ffffff', wingX: 0.38, wingY: 0.7, build: createBunny },
  { id: 'fox', name: 'Fox', body: '#e0732c', belly: '#fff3e6', wingX: 0.34, wingY: 0.75, build: createFox },
  { id: 'bear', name: 'Bear', body: '#6b4528', belly: '#a77b55', wingX: 0.5, wingY: 0.95, build: createBear },
  { id: 'penguin', name: 'Penguin', body: '#23272f', belly: '#f4f4f4', wingX: 0.3, wingY: 0.95, build: createPenguin },
  { id: 'pig', name: 'Pig', body: '#f2a6b4', belly: '#f8c7d0', wingX: 0.45, wingY: 0.75, build: createPig },
  { id: 'frog', name: 'Frog', body: '#4caf50', belly: '#d4ec9c', wingX: 0.45, wingY: 0.6, build: createFrog },
  { id: 'turtle', name: 'Turtle', body: '#3d7a3a', belly: '#c9b37a', wingX: 0.45, wingY: 0.6, build: createTurtle },
  { id: 'horse', name: 'Horse', body: '#8a5a36', belly: '#c49a74', wingX: 0.36, wingY: 1.2, build: createHorse },
  { id: 'dragon', name: 'Dragon', body: '#7b3fa0', belly: '#f2c14e', wingX: 0.4, wingY: 1.0, build: createDragon },
];

export function getAnimal(id: AnimalId): AnimalDef {
  return ANIMALS.find((a) => a.id === id) ?? ANIMALS[0];
}
