import * as THREE from 'three';
import { type AnimalMats, part, sphere, cyl, cone, box, eyes, legs } from './kit';

export function createDolphin(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.42, 10, 7), m.body, [0, 0.5, 0], [0.85, 0.8, 2], undefined, 'body');
  part(g, sphere(0.3, 8, 6), m.belly, [0, 0.38, 0.1], [0.85, 0.6, 1.9]);
  part(g, cone(0.12, 0.4, 7), m.body, [0, 0.47, 1.0], undefined, [Math.PI / 2, 0, 0]);
  eyes(g, m, 0.25, 0.58, 0.6, 0.06);
  part(g, sphere(0.04, 4, 3), m.dark, [0, 0.82, 0.25]); // blowhole
  part(g, cone(0.15, 0.35, 4), m.body, [0, 0.9, -0.1], [0.3, 1, 1], [-0.4, 0, 0]); // dorsal fin
  for (const side of [-1, 1]) {
    part(g, box(0.4, 0.04, 0.16), m.body, [side * 0.38, 0.32, 0.3], undefined, [0, side * 0.4, side * -0.4]);
  }
  const tail = part(g, cyl(0.05, 0.16, 0.5, 6), m.body, [0, 0.52, -0.95], undefined, [-Math.PI / 2, 0, 0], 'tail');
  part(tail, box(0.6, 0.12, 0.05), m.body, [0, -0.25, 0]);
  return g;
}

export function createPenguin(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.42, 10, 7), m.body, [0, 0.62, 0], [1, 1.45, 0.9], undefined, 'body');
  part(g, sphere(0.34, 8, 6), m.belly, [0, 0.58, 0.12], [0.9, 1.3, 0.8]);
  part(g, sphere(0.28), m.body, [0, 1.2, 0.05]);
  part(g, sphere(0.2, 7, 5), m.belly, [0, 1.17, 0.13], [1, 0.9, 0.9]);
  part(g, cone(0.07, 0.2, 5), m.accent, [0, 1.14, 0.38], undefined, [Math.PI / 2, 0, 0]);
  eyes(g, m, 0.1, 1.25, 0.27, 0.05);
  for (const side of [-1, 1]) {
    part(g, box(0.06, 0.5, 0.2), m.body, [side * 0.43, 0.68, 0], undefined, [0, 0, side * 0.2]);
  }
  for (const [name, side] of [['legFL', -1], ['legFR', 1]] as const) {
    part(g, box(0.14, 0.06, 0.22), m.accent, [side * 0.14, 0.03, 0.1], undefined, undefined, name);
  }
  part(g, cone(0.12, 0.2, 4), m.body, [0, 0.18, -0.35], undefined, [-2.2, 0, 0], 'tail');
  return g;
}

export function createFrog(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.45, 9, 6), m.body, [0, 0.42, 0], [1.1, 0.75, 1.2], undefined, 'body');
  part(g, sphere(0.35, 8, 6), m.belly, [0, 0.33, 0.15], [1.05, 0.6, 1]);
  part(g, sphere(0.36, 9, 6), m.body, [0, 0.58, 0.38], [1.1, 0.7, 0.9]);
  for (const side of [-1, 1]) {
    part(g, sphere(0.13, 7, 5), m.body, [side * 0.2, 0.82, 0.45]);
  }
  eyes(g, m, 0.2, 0.86, 0.53, 0.09);
  part(g, box(0.4, 0.02, 0.05), m.dark, [0, 0.5, 0.71]);
  legs(g, m.body, 0.3, 0.35, -0.25, 0.22, 0.08);
  for (const side of [-1, 1]) {
    part(g, sphere(0.16, 6, 4), m.body, [side * 0.42, 0.25, -0.2], [0.7, 0.7, 1.4]);
  }
  return g;
}

export function createTurtle(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.SphereGeometry(0.55, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  part(g, shell, m.body, [0, 0.3, 0], [1, 0.8, 1.2], undefined, 'body');
  part(g, cyl(0.56, 0.56, 0.08, 8), m.belly, [0, 0.28, 0], [1, 1, 1.2]);
  for (const [x, z] of [[0, 0], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25], [-0.25, -0.25]]) {
    part(g, cyl(0.14, 0.16, 0.05, 6), m.belly, [x, 0.66 - Math.hypot(x, z) * 0.35, z * 1.2], undefined,
      [z * -0.9, 0, x * 0.9]);
  }
  part(g, sphere(0.2, 7, 5), m.accent, [0, 0.4, 0.75], [1, 0.9, 1.2]);
  eyes(g, m, 0.1, 0.48, 0.87, 0.05);
  legs(g, m.accent, 0.38, 0.35, -0.35, 0.3, 0.09);
  part(g, cone(0.07, 0.2, 4), m.accent, [0, 0.3, -0.72], undefined, [-Math.PI / 2, 0, 0], 'tail');
  return g;
}
