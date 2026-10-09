import * as THREE from 'three';
import { type AnimalMats, part, sphere, cyl, cone, box, eyes, legs } from './kit';

export function createDog(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.42), m.body, [0, 0.6, 0], [1, 0.85, 1.5], undefined, 'body');
  part(g, sphere(0.3, 7, 5), m.belly, [0, 0.48, 0.05], [0.9, 0.7, 1.3]);
  part(g, sphere(0.32), m.body, [0, 0.95, 0.6]);
  part(g, sphere(0.16, 6, 5), m.belly, [0, 0.86, 0.88], [1, 0.8, 1.2]);
  part(g, sphere(0.06, 5, 4), m.dark, [0, 0.9, 1.04]);
  eyes(g, m, 0.13, 1.03, 0.85, 0.07);
  for (const side of [-1, 1]) {
    part(g, sphere(0.13, 5, 4), m.body, [side * 0.3, 0.92, 0.55], [0.5, 1.4, 0.8], [0, 0, side * 0.3]);
  }
  part(g, sphere(0.05, 4, 3), m.accent, [0, 0.8, 0.96], [1, 0.5, 1]);
  legs(g, m.body, 0.24, 0.38, -0.38, 0.45);
  part(g, cyl(0.04, 0.08, 0.5, 5), m.body, [0, 0.85, -0.75], undefined, [-0.9, 0, 0], 'tail');
  return g;
}

export function createBunny(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.42), m.body, [0, 0.5, -0.05], [1, 0.95, 1.2], undefined, 'body');
  part(g, sphere(0.3, 7, 5), m.belly, [0, 0.42, 0.15], [0.9, 0.9, 1]);
  part(g, sphere(0.3), m.body, [0, 0.9, 0.38]);
  for (const side of [-1, 1]) {
    part(g, sphere(0.12, 6, 4), m.body, [side * 0.1, 1.35, 0.3], [0.6, 2.4, 0.4], [0, 0, side * 0.15]);
    part(g, sphere(0.08, 6, 4), m.accent, [side * 0.1, 1.35, 0.34], [0.5, 2.2, 0.3], [0, 0, side * 0.15]);
  }
  eyes(g, m, 0.14, 0.97, 0.6, 0.07);
  part(g, sphere(0.05, 5, 4), m.accent, [0, 0.86, 0.68]);
  legs(g, m.body, 0.2, 0.25, -0.3, 0.22, 0.08);
  part(g, sphere(0.14, 6, 5), m.white, [0, 0.55, -0.55], undefined, undefined, 'tail');
  return g;
}

export function createFox(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.38), m.body, [0, 0.58, 0], [1, 0.85, 1.6], undefined, 'body');
  part(g, sphere(0.27, 7, 5), m.belly, [0, 0.45, 0.1], [0.9, 0.7, 1.3]);
  part(g, sphere(0.28), m.body, [0, 0.9, 0.6]);
  part(g, cone(0.14, 0.35, 6), m.belly, [0, 0.83, 0.88], undefined, [Math.PI / 2, 0, 0]);
  part(g, sphere(0.05, 5, 4), m.dark, [0, 0.83, 1.06]);
  eyes(g, m, 0.12, 0.98, 0.8, 0.06);
  for (const side of [-1, 1]) {
    part(g, cone(0.1, 0.28, 4), m.body, [side * 0.15, 1.2, 0.55], undefined, [0, 0, side * -0.2]);
  }
  legs(g, m.dark, 0.2, 0.38, -0.38, 0.42, 0.07);
  const tail = part(g, sphere(0.2, 7, 5), m.body, [0, 0.65, -0.9], [0.8, 0.8, 2.2], [0.5, 0, 0], 'tail');
  part(tail, sphere(0.12, 6, 4), m.white, [0, 0, -0.17], [1, 1, 0.6]);
  return g;
}

export function createBear(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.55), m.body, [0, 0.68, 0], [1, 0.9, 1.35], undefined, 'body');
  part(g, sphere(0.4, 7, 5), m.belly, [0, 0.55, 0.15], [0.9, 0.8, 1.1]);
  part(g, sphere(0.36), m.body, [0, 1.05, 0.65]);
  part(g, sphere(0.16, 6, 5), m.belly, [0, 0.98, 0.95], [1, 0.8, 1]);
  part(g, sphere(0.06, 5, 4), m.dark, [0, 1.03, 1.1]);
  eyes(g, m, 0.14, 1.15, 0.92, 0.06);
  for (const side of [-1, 1]) {
    part(g, sphere(0.11, 6, 4), m.body, [side * 0.26, 1.35, 0.6], [1, 1, 0.6]);
  }
  legs(g, m.body, 0.3, 0.4, -0.4, 0.4, 0.14);
  part(g, sphere(0.1, 5, 4), m.body, [0, 0.8, -0.72], undefined, undefined, 'tail');
  return g;
}

export function createPig(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.48), m.body, [0, 0.55, 0], [1, 0.9, 1.4], undefined, 'body');
  part(g, sphere(0.34, 7, 5), m.belly, [0, 0.42, 0.05], [0.95, 0.75, 1.3]);
  part(g, sphere(0.32), m.body, [0, 0.75, 0.62]);
  part(g, cyl(0.12, 0.12, 0.12, 8), m.belly, [0, 0.7, 0.93], undefined, [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) {
    part(g, sphere(0.025, 4, 3), m.dark, [side * 0.05, 0.7, 1.0]);
    part(g, cone(0.1, 0.18, 4), m.body, [side * 0.2, 1.03, 0.55], undefined, [0.4, 0, side * -0.4]);
  }
  eyes(g, m, 0.14, 0.85, 0.86, 0.06);
  legs(g, m.body, 0.25, 0.35, -0.35, 0.3, 0.09);
  part(g, new THREE.TorusGeometry(0.06, 0.02, 4, 8), m.body, [0, 0.7, -0.72], undefined, [0, Math.PI / 2, 0], 'tail');
  return g;
}

export function createHorse(m: AnimalMats): THREE.Group {
  const g = new THREE.Group();
  part(g, sphere(0.45), m.body, [0, 0.95, 0], [0.85, 0.85, 1.7], undefined, 'body');
  part(g, sphere(0.3, 7, 5), m.belly, [0, 0.8, 0.05], [0.85, 0.7, 1.5]);
  part(g, cyl(0.16, 0.22, 0.6, 6), m.body, [0, 1.3, 0.62], undefined, [0.6, 0, 0]);
  part(g, box(0.26, 0.26, 0.55), m.body, [0, 1.58, 0.92], undefined, [0.3, 0, 0]);
  part(g, box(0.24, 0.2, 0.18), m.belly, [0, 1.48, 1.17], undefined, [0.3, 0, 0]);
  eyes(g, m, 0.14, 1.68, 0.88, 0.05);
  for (const side of [-1, 1]) {
    part(g, cone(0.06, 0.18, 4), m.body, [side * 0.1, 1.82, 0.75]);
  }
  part(g, box(0.06, 0.18, 0.6), m.dark, [0, 1.55, 0.5], undefined, [0.6, 0, 0]);
  legs(g, m.body, 0.22, 0.5, -0.5, 0.7, 0.08);
  part(g, cyl(0.03, 0.1, 0.7, 5), m.dark, [0, 0.8, -0.88], undefined, [-0.4, 0, 0], 'tail');
  return g;
}
