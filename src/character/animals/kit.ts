import * as THREE from 'three';

/** Materials shared by every animal builder. `body` and `belly` are the player-colorable ones. */
export interface AnimalMats {
  body: THREE.MeshStandardMaterial;
  belly: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

export function createAnimalMats(body: string, belly: string): AnimalMats {
  return {
    body: new THREE.MeshStandardMaterial({ color: body, roughness: 0.75, metalness: 0.08, flatShading: true }),
    belly: new THREE.MeshStandardMaterial({ color: belly, roughness: 0.8, metalness: 0.05, flatShading: true }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xf2a0a0, roughness: 0.6, flatShading: true }),
  };
}

type V3 = [number, number, number];

/** Add a mesh to `parent` at `pos`, optionally scaled/rotated/named. */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: V3,
  scale?: V3,
  rot?: V3,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  if (scale) mesh.scale.set(...scale);
  if (rot) mesh.rotation.set(...rot);
  if (name) mesh.name = name;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export const sphere = (r: number, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const cyl = (top: number, bottom: number, len: number, seg = 6) =>
  new THREE.CylinderGeometry(top, bottom, len, seg);
export const cone = (r: number, len: number, seg = 5) => new THREE.ConeGeometry(r, len, seg);
export const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

/** Pair of eyes (white + pupil + shine) facing +Z. */
export function eyes(parent: THREE.Object3D, m: AnimalMats, x: number, y: number, z: number, r = 0.09) {
  for (const side of [-1, 1]) {
    part(parent, sphere(r, 6, 4), m.white, [side * x, y, z]);
    part(parent, sphere(r * 0.66, 6, 4), m.dark, [side * x, y, z + r * 0.55]);
    part(parent, sphere(r * 0.28, 4, 3), m.white, [side * (x - r * 0.25), y + r * 0.22, z + r * 0.8]);
  }
}

/** Four named legs (legFL/FR/BL/BR) of the given length, hanging from y=len. */
export function legs(
  parent: THREE.Object3D,
  mat: THREE.Material,
  x: number,
  zFront: number,
  zBack: number,
  len: number,
  r = 0.09,
) {
  const names: [string, number, number][] = [
    ['legFL', -1, zFront], ['legFR', 1, zFront], ['legBL', -1, zBack], ['legBR', 1, zBack],
  ];
  for (const [name, side, z] of names) {
    part(parent, cyl(r * 0.85, r, len, 5), mat, [side * x, len / 2, z], undefined, undefined, name);
  }
}
