import * as THREE from 'three';
import { type AnimalId, type AnimalMats, createAnimalMats, getAnimal } from './animals';
import { Wings, WING_TYPES, type WingId } from './wings';

export interface CharacterColors {
  body: string;
  belly: string;
  wingLeft: string;
  wingRight: string;
}

export interface CharacterChoice {
  animal: AnimalId;
  wings: WingId;
  colors: CharacterColors;
}

export interface BuiltCharacter {
  group: THREE.Group;
  wings: Wings | null;
  mats: AnimalMats;
}

export const DEFAULT_CHOICE: CharacterChoice = {
  animal: 'otter',
  wings: 'feathered',
  colors: defaultColors('otter', 'feathered'),
};

export function defaultColors(animal: AnimalId, wings: WingId): CharacterColors {
  const a = getAnimal(animal);
  const w = WING_TYPES.find((t) => t.id === wings) ?? WING_TYPES[0];
  return { body: a.body, belly: a.belly, wingLeft: w.color, wingRight: w.color };
}

/** Build an animal (optionally with wings) using the given colors. */
export function buildCharacter(animal: AnimalId, wings: WingId | null, colors: CharacterColors): BuiltCharacter {
  const def = getAnimal(animal);
  const mats = createAnimalMats(colors.body, colors.belly);
  const group = def.build(mats);
  const w = wings ? new Wings(group, wings, def.wingX, def.wingY, colors.wingLeft, colors.wingRight) : null;
  return { group, wings: w, mats };
}

export function applyColors(c: BuiltCharacter, colors: CharacterColors) {
  c.mats.body.color.set(colors.body);
  c.mats.belly.color.set(colors.belly);
  c.wings?.setColors(colors.wingLeft, colors.wingRight);
}
