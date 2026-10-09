import * as THREE from 'three';
import { type AnimalId, getAnimal } from './animals';
import { createAvatarMats, type AvatarMats, type Rig } from './rig';
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
  mats: AvatarMats;
  rig: Rig;
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
  const mats = createAvatarMats(colors.body, colors.belly);
  const rig = def.build(mats);
  const a = rig.wingAnchor;
  // Wings ride on the torso, so they bob and breathe with it
  const w = wings ? new Wings(rig.body, wings, a.x, a.y, colors.wingLeft, colors.wingRight, a.z) : null;
  return { group: rig.root, wings: w, mats, rig };
}

export function applyColors(c: BuiltCharacter, colors: CharacterColors) {
  c.mats.body.color.set(colors.body);
  c.mats.belly.color.set(colors.belly);
  c.wings?.setColors(colors.wingLeft, colors.wingRight);
}
