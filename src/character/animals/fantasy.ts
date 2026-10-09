import * as THREE from 'three';
import { type AnimalMats, part, sphere, cyl, cone, eyes, legs } from './kit';

export function createDragon(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.45, 9, 6), m.body, [0, 0.7, 0], [0.95, 0.9, 1.6], undefined, 'body');
  part(g, sphere(0.32, 8, 6), m.belly, [0, 0.58, 0.1], [0.9, 0.75, 1.5]);
  part(g, cyl(0.15, 0.22, 0.5, 6), m.body, [0, 1.0, 0.6], undefined, [0.7, 0, 0]);
  part(g, sphere(0.25, 8, 6), m.body, [0, 1.2, 0.85], [1, 0.85, 1.3]);
  for (const side of [-1, 1]) {
    part(g, sphere(0.025, 4, 3), m.dark, [side * 0.06, 1.17, 1.16]);
    part(g, cone(0.05, 0.3, 5), m.accent, [side * 0.12, 1.45, 0.72], undefined, [-0.5, 0, side * -0.2]);
  }
  eyes(g, m, 0.14, 1.3, 0.98, 0.06);
  for (let i = 0; i < 5; i++) {
    part(g, cone(0.06, 0.18, 4), m.accent, [0, 1.06 - i * 0.03, 0.3 - i * 0.25]);
  }
  legs(g, m.body, 0.27, 0.4, -0.4, 0.4, 0.11);
  const tail = part(g, cone(0.17, 1.0, 6), m.body, [0, 0.62, -1.05], undefined, [-1.75, 0, 0], 'tail');
  part(tail, cone(0.1, 0.2, 4), m.accent, [0, -0.55, 0], [1, 1, 0.3], [Math.PI, 0, 0]);
  return g;
}
