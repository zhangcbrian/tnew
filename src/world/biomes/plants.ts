import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A plant (or rock) that can grow in a landscape. */
export interface PlantType {
  name: string;
  geo: THREE.BufferGeometry;
  /** Max instances per terrain chunk */
  perChunk: number;
  shadow: boolean;
  scale: [number, number];
  /** Can it grow here? `rand` is a fresh random 0..1 for density thinning. */
  fits(h: number, slope: number, x: number, z: number, rand: number): boolean;
}

/** Paint a part one color (as a vertex color) so parts can be merged into one geometry. */
function painted(geo: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!;
const sphere = (r: number, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h);
const cyl = (t: number, b: number, len: number, seg = 6) => new THREE.CylinderGeometry(t, b, len, seg);
const cone = (r: number, len: number, seg = 6) => new THREE.ConeGeometry(r, len, seg);

/** Small flowers/berries dotted over a shape */
function dots(points: [number, number, number][], r: number, color: number): THREE.BufferGeometry[] {
  return points.map(([x, y, z]) => painted(new THREE.DodecahedronGeometry(r, 0).translate(x, y, z), color));
}

// ---- Scottish Highlands ----

export function scotsPine() {
  const parts = [painted(cyl(0.16, 0.3, 6).translate(0, 3, 0), 0x7a4a2e)];
  for (const [x, y, z, r] of [[0, 6.4, 0, 1.6], [0.9, 5.6, 0.3, 1.1], [-0.8, 5.9, -0.4, 1.2], [0.2, 7.0, -0.6, 1.0]]) {
    parts.push(painted(sphere(r).scale(1, 0.5, 1).translate(x, y, z), 0x2f4a2c));
  }
  return merge(parts);
}

export function birch() {
  return merge([
    painted(cyl(0.08, 0.13, 4.5).translate(0, 2.25, 0), 0xe8e4dc),
    painted(sphere(1.1, 6, 5).scale(1, 1.4, 1).translate(0, 4.6, 0), 0x7d9a48),
  ]);
}

export function heather() {
  return merge([
    painted(sphere(0.55).scale(1.2, 0.45, 1).translate(0, 0.15, 0), 0x7b4f73),
    painted(sphere(0.35, 5, 3).scale(1, 0.5, 1).translate(0.45, 0.12, 0.2), 0x8d5c86),
  ]);
}

export function gorse() {
  return merge([
    painted(sphere(0.8, 6, 5).scale(1.1, 0.75, 1).translate(0, 0.5, 0), 0x3f5a2a),
    ...dots([[0.4, 0.95, 0.3], [-0.5, 0.85, 0.2], [0.1, 1.05, -0.4], [-0.2, 0.9, 0.5], [0.6, 0.7, -0.3]], 0.16, 0xf2c62a),
  ]);
}

export function bracken(color = 0x9a6a34) {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const frond = cone(0.28, 0.9, 4).scale(1, 1, 0.2).rotateZ(0.6).rotateY(a).translate(Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2);
    parts.push(painted(frond, color));
  }
  return merge(parts);
}

export function boulder(color = 0x7f7f84) {
  return painted(new THREE.DodecahedronGeometry(0.8, 0).scale(1.2, 0.7, 1).translate(0, 0.25, 0), color);
}

export function grassTuft(color = 0x8a9353, height = 0.55) {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, r] of [[0, 0, 0], [0.12, 0.05, 0.3], [-0.1, 0.08, -0.25], [0.02, -0.12, 0.15]]) {
    parts.push(painted(cone(0.06, height, 3).rotateZ(r).translate(x, height / 2, z), color));
  }
  return merge(parts);
}

// ---- Norway / Alps / Arctic conifers ----

export function spruce(height = 9, color = 0x1f3d2a) {
  const parts = [painted(cyl(0.12, 0.22, height * 0.3).translate(0, height * 0.15, 0), 0x5a3d26)];
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = (1 - t) * height * 0.22 + 0.2;
    parts.push(painted(cone(r, height * 0.32, 7).translate(0, height * (0.25 + t * 0.6), 0), color));
  }
  return merge(parts);
}

// ---- Ireland ----

export function oak() {
  const parts = [painted(cyl(0.3, 0.5, 4).translate(0, 2, 0), 0x5b4330)];
  for (const [x, y, z, r] of [[0, 5, 0, 2.4], [1.5, 4.4, 0.6, 1.6], [-1.4, 4.6, -0.5, 1.7], [0.3, 4.3, -1.5, 1.5], [-0.4, 6, 0.8, 1.4]]) {
    parts.push(painted(sphere(r, 7, 5).translate(x, y, z), 0x3d6e2c));
  }
  return merge(parts);
}

export function hawthorn() {
  return merge([
    painted(sphere(0.9, 6, 5).scale(1.2, 0.8, 1).translate(0, 0.7, 0), 0x355f2a),
    ...dots([[0.5, 1.1, 0.4], [-0.6, 1.0, 0.1], [0.1, 1.3, -0.5], [-0.3, 0.9, 0.7], [0.8, 0.8, -0.3], [-0.7, 0.7, -0.5]], 0.12, 0xf5f2ea),
  ]);
}

// ---- Alps ----

export function wildflowers() {
  return merge([
    painted(sphere(0.4, 5, 3).scale(1.3, 0.35, 1.3).translate(0, 0.1, 0), 0x5a8f3a),
    ...dots([[0.25, 0.3, 0.1]], 0.1, 0xe94b6a),
    ...dots([[-0.2, 0.28, 0.25]], 0.1, 0xf5d93a),
    ...dots([[0.05, 0.32, -0.3]], 0.1, 0x8e6ad8),
    ...dots([[-0.3, 0.26, -0.15]], 0.09, 0xffffff),
  ]);
}

// ---- New Zealand ----

export function treeFern() {
  const parts = [painted(cyl(0.12, 0.18, 3.5).translate(0, 1.75, 0), 0x4a3524)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const frond = cone(0.35, 2.4, 4).scale(1, 1, 0.15).rotateZ(Math.PI / 2 - 0.35).rotateY(a)
      .translate(Math.cos(a) * 1.0, 3.6, -Math.sin(a) * 1.0);
    parts.push(painted(frond, 0x3f7f2e));
  }
  return merge(parts);
}

export function roundTree(trunk = 0x4f3a28, leaves = 0x2f6b30) {
  return merge([
    painted(cyl(0.2, 0.32, 3).translate(0, 1.5, 0), trunk),
    painted(sphere(1.9, 7, 5).scale(1, 0.85, 1).translate(0, 4, 0), leaves),
    painted(sphere(1.2, 6, 4).translate(1.1, 3.6, 0.4), leaves),
  ]);
}

export function tussock() {
  return grassTuft(0xc8a65a, 0.8);
}

// ---- Sahara ----

export function palm() {
  const parts: THREE.BufferGeometry[] = [];
  // Gently curved trunk from stacked segments
  for (let i = 0; i < 6; i++) {
    parts.push(painted(cyl(0.18, 0.22, 1.2).translate(i * 0.12, 0.6 + i * 1.15, 0), i % 2 ? 0x8a6a45 : 0x7a5c3b));
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = cone(0.45, 3, 4).scale(1, 1, 0.12).rotateZ(Math.PI / 2 + 0.5).rotateY(a)
      .translate(0.7 + Math.cos(a) * 1.3, 6.9, -Math.sin(a) * 1.3);
    parts.push(painted(leaf, 0x4f7f2a));
  }
  return merge(parts);
}

export function dryShrub() {
  const parts = [painted(sphere(0.5, 5, 3).scale(1.2, 0.6, 1).translate(0, 0.3, 0), 0x8a7a4a)];
  for (const [rz, rx] of [[0.5, 0], [-0.5, 0.2], [0.1, 0.6], [0, -0.5]]) {
    parts.push(painted(cyl(0.02, 0.03, 0.9, 3).rotateZ(rz).rotateX(rx).translate(0, 0.45, 0), 0x6b5a3a));
  }
  return merge(parts);
}

// ---- Amazon ----

export function kapok() {
  const parts = [painted(cyl(0.5, 0.9, 22, 7).translate(0, 11, 0), 0x8a7a66)];
  // Buttress roots
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push(painted(new THREE.BoxGeometry(2.2, 2.4, 0.2).translate(1.1, 1.2, 0).rotateY(a), 0x7d6d5a));
  }
  for (const [x, y, z, r] of [[0, 23, 0, 6], [4, 22, 2, 4], [-4, 22.5, -1.5, 4.5], [1, 22, -4, 4]]) {
    parts.push(painted(sphere(r, 7, 5).scale(1, 0.4, 1).translate(x, y, z), 0x2e6b26));
  }
  return merge(parts);
}

export function jungleTree() {
  const parts = [painted(cyl(0.25, 0.4, 9).translate(0, 4.5, 0), 0x5a4a36)];
  for (const [x, y, z, r] of [[0, 10, 0, 2.6], [1.6, 9, 1, 1.8], [-1.5, 9.4, -0.8, 2], [0.4, 11.4, -1, 1.6]]) {
    parts.push(painted(sphere(r, 6, 5).translate(x, y, z), 0x1f5a22));
  }
  return merge(parts);
}

export function bigLeaf() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leaf = sphere(0.6, 5, 3).scale(0.5, 0.06, 1.3).rotateX(-0.5).rotateY(a).translate(Math.sin(a) * 0.7, 0.9, Math.cos(a) * 0.7);
    parts.push(painted(leaf, 0x2f7a2a));
  }
  parts.push(painted(cyl(0.04, 0.06, 0.9, 4).translate(0, 0.45, 0), 0x3f6a2a));
  return merge(parts);
}

// ---- American Southwest ----

export function saguaro() {
  const g = 0x4f7a3a;
  return merge([
    painted(cyl(0.35, 0.4, 6, 8).translate(0, 3, 0), g),
    painted(sphere(0.35, 8, 4).translate(0, 6, 0), g),
    painted(cyl(0.22, 0.22, 1.2, 6).rotateZ(Math.PI / 2).translate(0.7, 2.8, 0), g),
    painted(cyl(0.22, 0.22, 1.8, 6).translate(1.25, 3.6, 0), g),
    painted(cyl(0.2, 0.2, 1, 6).rotateZ(Math.PI / 2).translate(-0.6, 3.6, 0), g),
    painted(cyl(0.2, 0.2, 1.4, 6).translate(-1.05, 4.2, 0), g),
  ]);
}

export function sagebrush() {
  return merge([
    painted(sphere(0.5, 5, 4).scale(1.2, 0.7, 1).translate(0, 0.35, 0), 0x8f9a7a),
    painted(sphere(0.35, 5, 3).translate(0.45, 0.3, 0.2), 0x9aa58a),
  ]);
}

export function juniper() {
  return merge([
    painted(cyl(0.12, 0.25, 1.6).rotateZ(0.2).translate(0, 0.8, 0), 0x6b4a32),
    painted(sphere(1.2, 6, 4).scale(1, 0.8, 1).translate(0.2, 2.2, 0), 0x4a5f3a),
    painted(sphere(0.8, 5, 4).translate(-0.6, 1.8, 0.4), 0x55693f),
  ]);
}

// ---- African savanna ----

export function acacia() {
  return merge([
    painted(cyl(0.15, 0.25, 4).rotateZ(0.15).translate(0.2, 2, 0), 0x5a4330),
    painted(cyl(0.08, 0.12, 2).rotateZ(-0.6).translate(-0.4, 4, 0), 0x5a4330),
    painted(cyl(3.2, 3.2, 0.5, 9).translate(0, 4.8, 0), 0x5f7a2e),
    painted(sphere(2.6, 8, 3).scale(1.2, 0.2, 1.2).translate(0, 5.1, 0), 0x6a8536),
  ]);
}

export function tallGrass() {
  return grassTuft(0xd2b45a, 1.2);
}

export function termiteMound() {
  return merge([
    painted(cone(0.9, 3, 7).translate(0, 1.5, 0), 0xa0583a),
    painted(cone(0.4, 1.5, 5).translate(0.5, 0.75, 0.2), 0x94502f),
  ]);
}

// ---- Arctic ----

export function arcticShrub() {
  return merge([
    painted(sphere(0.4, 5, 3).scale(1.4, 0.4, 1.2).translate(0, 0.1, 0), 0x6a5a3a),
    painted(sphere(0.25, 5, 3).scale(1, 0.5, 1).translate(0.3, 0.15, 0.2), 0x7a6a3f),
  ]);
}

export function snowRock() {
  return merge([
    painted(new THREE.DodecahedronGeometry(0.8, 0).scale(1.2, 0.7, 1).translate(0, 0.25, 0), 0x6f7478),
    painted(sphere(0.75, 6, 3, ).scale(1.1, 0.3, 0.9).translate(0, 0.7, 0), 0xf2f5f8),
  ]);
}
