import type { Rig, AvatarMats } from '../rig';
import {
  otterAvatar, dolphinAvatar, dogAvatar, bunnyAvatar, foxAvatar, bearAvatar,
  penguinAvatar, pigAvatar, frogAvatar, turtleAvatar, horseAvatar, dragonAvatar,
} from './avatars';

export type AnimalId =
  | 'otter' | 'dolphin' | 'dog' | 'bunny' | 'fox' | 'bear'
  | 'penguin' | 'pig' | 'frog' | 'turtle' | 'horse' | 'dragon';

export interface AnimalDef {
  id: AnimalId;
  name: string;
  /** Default body / belly colors. */
  body: string;
  belly: string;
  /** Builds the smooth, jointed avatar (see rig.ts) */
  build(m: AvatarMats): Rig;
}

export const ANIMALS: AnimalDef[] = [
  { id: 'otter', name: 'Sea Otter', body: '#2b4f72', belly: '#7a9cb8', build: otterAvatar },
  { id: 'dolphin', name: 'Dolphin', body: '#5b7f9e', belly: '#d8e4ee', build: dolphinAvatar },
  { id: 'dog', name: 'Dog', body: '#b07a43', belly: '#f0dcc0', build: dogAvatar },
  { id: 'bunny', name: 'Bunny', body: '#d9d2c8', belly: '#ffffff', build: bunnyAvatar },
  { id: 'fox', name: 'Fox', body: '#e0732c', belly: '#fff3e6', build: foxAvatar },
  { id: 'bear', name: 'Bear', body: '#6b4528', belly: '#a77b55', build: bearAvatar },
  { id: 'penguin', name: 'Penguin', body: '#23272f', belly: '#f4f4f4', build: penguinAvatar },
  { id: 'pig', name: 'Pig', body: '#f2a6b4', belly: '#f8c7d0', build: pigAvatar },
  { id: 'frog', name: 'Frog', body: '#4caf50', belly: '#d4ec9c', build: frogAvatar },
  { id: 'turtle', name: 'Turtle', body: '#3d7a3a', belly: '#c9b37a', build: turtleAvatar },
  { id: 'horse', name: 'Horse', body: '#8a5a36', belly: '#c49a74', build: horseAvatar },
  { id: 'dragon', name: 'Dragon', body: '#7b3fa0', belly: '#f2c14e', build: dragonAvatar },
];

export function getAnimal(id: AnimalId): AnimalDef {
  return ANIMALS.find((a) => a.id === id) ?? ANIMALS[0];
}
