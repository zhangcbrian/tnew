import * as THREE from 'three';
import { getTerrainHeightCached } from './terrain';
import type { BlockQuery } from './block-query';
import { NO_BLOCKS } from './block-query';
import { dominantBiome, type BiomeId } from './biomes';

/** Anything farther than this from the player is moved to a fresh spot near them. */
const RECYCLE_DIST = 420;
const SPAWN_MIN = 120;
const SPAWN_MAX = 380;
/** Chance per check that a far-away herd of cows/sheep reappears near the player. */
const HERD_CHANCE = 0.15;
const HERD_CHECK_INTERVAL = 2;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

type Kind = 'land' | 'bird' | 'fish' | 'herd';

interface Animal {
  x: number;
  y: number;
  z: number;
  scale: number;
  heading: number;
  speed: number;
  wanderTimer: number;
  wanderInterval: number;
  baseY: number;
  accum: number;
  active: boolean;
}

interface Species {
  name: string;
  kind: Kind;
  count: number;
  /** Each part is drawn as its own InstancedMesh sharing the same per-animal matrices. */
  parts: { geo: THREE.BufferGeometry; color: number }[];
  scale: [number, number];
  speed: [number, number];
  /** Herd size for kind 'herd' */
  herdSize?: number;
  /** Landscapes this species lives in */
  biomes: BiomeId[];
}

function createDeerGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 6);
  body.rotateZ(Math.PI / 2);
  body.translate(0, 0.8, 0);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.22, 5, 4);
  head.translate(0.7, 1.05, 0);
  geos.push(head);

  // Snout
  const snout = new THREE.CylinderGeometry(0.08, 0.1, 0.2, 4);
  snout.rotateZ(Math.PI / 2);
  snout.translate(0.9, 0.98, 0);
  geos.push(snout);

  // Legs
  for (const xOff of [-0.3, 0.3]) {
    for (const zOff of [-0.15, 0.15]) {
      const leg = new THREE.CylinderGeometry(0.06, 0.05, 0.7, 4);
      leg.translate(xOff, 0.35, zOff);
      geos.push(leg);
    }
  }

  // Antlers
  for (const side of [-1, 1]) {
    const antler = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 3);
    antler.translate(0.65, 1.35, side * 0.12);
    antler.rotateX(side * 0.3);
    geos.push(antler);
    const branch = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 3);
    branch.rotateZ(side * 0.6);
    branch.translate(0.6, 1.5, side * 0.15);
    geos.push(branch);
  }

  // Tail
  const tail = new THREE.SphereGeometry(0.08, 4, 3);
  tail.translate(-0.65, 0.9, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createRabbitGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.2, 5, 4);
  body.scale(1, 0.8, 1.2);
  body.translate(0, 0.25, 0);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.14, 5, 4);
  head.translate(0.2, 0.38, 0);
  geos.push(head);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 4);
    ear.translate(0.18, 0.55, side * 0.06);
    geos.push(ear);
  }

  // Tail puff
  const tail = new THREE.SphereGeometry(0.06, 4, 3);
  tail.translate(-0.22, 0.28, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createBirdGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.12, 5, 4);
  body.scale(1, 0.8, 1.4);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.08, 4, 3);
  head.translate(0.15, 0.06, 0);
  geos.push(head);

  // Beak
  const beak = new THREE.ConeGeometry(0.03, 0.1, 3);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.25, 0.04, 0);
  geos.push(beak);

  // Wings
  for (const side of [-1, 1]) {
    const wing = new THREE.BoxGeometry(0.02, 0.06, 0.25);
    wing.translate(0, 0.02, side * 0.18);
    geos.push(wing);
  }

  // Tail
  const tail = new THREE.BoxGeometry(0.02, 0.04, 0.1);
  tail.translate(-0.16, 0, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createFishGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.15, 5, 4);
  body.scale(1.8, 0.7, 0.8);
  geos.push(body);

  // Tail fin
  const tail = new THREE.BoxGeometry(0.02, 0.15, 0.12);
  tail.translate(-0.28, 0, 0);
  geos.push(tail);

  // Dorsal fin
  const dorsal = new THREE.BoxGeometry(0.12, 0.08, 0.02);
  dorsal.translate(0, 0.12, 0);
  geos.push(dorsal);

  return mergeGeos(geos);
}

function mergeGeos(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIdx += (g.index ? g.index.count : g.attributes.position.count);
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vOff = 0;
  for (const g of geometries) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (nor) {
        normals[(vOff + i) * 3] = nor.getX(i);
        normals[(vOff + i) * 3 + 1] = nor.getY(i);
        normals[(vOff + i) * 3 + 2] = nor.getZ(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices.push(g.index.getX(i) + vOff);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + vOff);
    }
    vOff += pos.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}


function createHighlandCowGeometry(): { body: THREE.BufferGeometry; horns: THREE.BufferGeometry } {
  const geos: THREE.BufferGeometry[] = [];
  // Boxy, shaggy body
  const body = new THREE.BoxGeometry(1.5, 0.8, 0.8);
  body.translate(0, 0.95, 0);
  geos.push(body);
  // Shaggy coat fringes hanging under the body
  for (const z of [-0.38, 0.38]) {
    const fringe = new THREE.BoxGeometry(1.4, 0.25, 0.1);
    fringe.translate(0, 0.5, z);
    geos.push(fringe);
  }
  // Head with long fringe over the eyes
  const head = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  head.translate(0.9, 1.05, 0);
  geos.push(head);
  const fringe = new THREE.BoxGeometry(0.2, 0.25, 0.5);
  fringe.translate(1.1, 1.2, 0);
  geos.push(fringe);
  for (const xOff of [-0.5, 0.5]) {
    for (const zOff of [-0.25, 0.25]) {
      const leg = new THREE.CylinderGeometry(0.1, 0.09, 0.6, 5);
      leg.translate(xOff, 0.3, zOff);
      geos.push(leg);
    }
  }
  const tail = new THREE.CylinderGeometry(0.03, 0.05, 0.6, 4);
  tail.translate(-0.8, 0.8, 0);
  geos.push(tail);

  // Wide, upswept horns
  const horns: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const horn = new THREE.ConeGeometry(0.06, 0.6, 5);
    horn.rotateX(side * -1.2);
    horn.translate(0.95, 1.35, side * 0.42);
    horns.push(horn);
  }
  return { body: mergeGeos(geos), horns: mergeGeos(horns) };
}

function createSheepGeometry(): { wool: THREE.BufferGeometry; face: THREE.BufferGeometry } {
  const wool = new THREE.SphereGeometry(0.45, 7, 5);
  wool.scale(1.4, 0.95, 1);
  wool.translate(0, 0.7, 0);
  const geos: THREE.BufferGeometry[] = [];
  const head = new THREE.SphereGeometry(0.18, 5, 4);
  head.scale(1.3, 1, 0.9);
  head.translate(0.65, 0.85, 0);
  geos.push(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.BoxGeometry(0.06, 0.04, 0.16);
    ear.translate(0.6, 0.92, side * 0.18);
    geos.push(ear);
  }
  for (const xOff of [-0.3, 0.3]) {
    for (const zOff of [-0.15, 0.15]) {
      const leg = new THREE.CylinderGeometry(0.05, 0.045, 0.45, 4);
      leg.translate(xOff, 0.22, zOff);
      geos.push(leg);
    }
  }
  return { wool: mergeGeos([wool]), face: mergeGeos(geos) };
}

/** The shape builders above face +X; the game moves things along +Z. */
function facePlusZ(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  return geo.rotateY(-Math.PI / 2);
}

function createCamelGeometry(): THREE.BufferGeometry {
  const g: THREE.BufferGeometry[] = [];
  g.push(new THREE.SphereGeometry(0.5, 7, 5).scale(1.6, 0.9, 0.9).translate(0, 1.6, 0)); // body
  g.push(new THREE.SphereGeometry(0.35, 6, 4).translate(0, 2.1, 0)); // hump
  g.push(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 5).rotateZ(-0.7).translate(0.95, 2.1, 0)); // neck
  g.push(new THREE.BoxGeometry(0.45, 0.22, 0.22).translate(1.4, 2.5, 0)); // head
  for (const x of [-0.5, 0.5]) for (const z of [-0.22, 0.22]) {
    g.push(new THREE.CylinderGeometry(0.07, 0.06, 1.3, 4).translate(x, 0.65, z));
  }
  return mergeGeos(g);
}

function createZebraGeometry(): { body: THREE.BufferGeometry; stripes: THREE.BufferGeometry } {
  const g: THREE.BufferGeometry[] = [];
  g.push(new THREE.CylinderGeometry(0.35, 0.38, 1.3, 7).rotateZ(Math.PI / 2).translate(0, 1.0, 0));
  g.push(new THREE.CylinderGeometry(0.13, 0.2, 0.7, 5).rotateZ(-0.6).translate(0.75, 1.35, 0));
  g.push(new THREE.BoxGeometry(0.5, 0.22, 0.2).translate(1.1, 1.55, 0));
  for (const x of [-0.45, 0.45]) for (const z of [-0.18, 0.18]) {
    g.push(new THREE.CylinderGeometry(0.07, 0.06, 0.85, 4).translate(x, 0.42, z));
  }
  const stripes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    stripes.push(new THREE.TorusGeometry(0.385, 0.035, 3, 10).rotateY(Math.PI / 2).translate(-0.55 + i * 0.18, 1.0, 0));
  }
  stripes.push(new THREE.BoxGeometry(0.6, 0.12, 0.06).translate(0.75, 1.62, 0)); // mane
  return { body: mergeGeos(g), stripes: mergeGeos(stripes) };
}

function createGiraffeGeometry(): { body: THREE.BufferGeometry; spots: THREE.BufferGeometry } {
  const g: THREE.BufferGeometry[] = [];
  g.push(new THREE.SphereGeometry(0.5, 7, 5).scale(1.4, 0.8, 0.8).rotateZ(0.25).translate(0, 2.2, 0));
  g.push(new THREE.CylinderGeometry(0.1, 0.18, 2.2, 5).rotateZ(-0.35).translate(0.75, 3.4, 0));
  g.push(new THREE.BoxGeometry(0.5, 0.22, 0.2).translate(1.2, 4.45, 0));
  for (const x of [-0.45, 0.45]) for (const z of [-0.2, 0.2]) {
    g.push(new THREE.CylinderGeometry(0.06, 0.05, 2.0, 4).translate(x, 1.0, z));
  }
  const spots: THREE.BufferGeometry[] = [];
  const spotPos: [number, number, number][] = [[-0.3, 2.45, 0.38], [0.2, 2.5, 0.37], [-0.1, 2.15, 0.4], [0.35, 2.2, 0.36],
    [-0.3, 2.45, -0.38], [0.2, 2.5, -0.37], [-0.1, 2.15, -0.4], [0.35, 2.2, -0.36], [0.6, 3.0, 0.12], [0.85, 3.6, -0.1]];
  for (const [x, y, z] of spotPos) spots.push(new THREE.BoxGeometry(0.2, 0.18, 0.05).translate(x, y, z));
  return { body: mergeGeos(g), spots: mergeGeos(spots) };
}

function createElephantGeometry(): { body: THREE.BufferGeometry; tusks: THREE.BufferGeometry } {
  const g: THREE.BufferGeometry[] = [];
  g.push(new THREE.SphereGeometry(1, 8, 6).scale(1.4, 1, 1).translate(0, 2.1, 0));
  g.push(new THREE.SphereGeometry(0.6, 7, 5).translate(1.4, 2.5, 0));
  g.push(new THREE.CylinderGeometry(0.1, 0.22, 1.6, 6).rotateZ(0.15).translate(1.85, 1.6, 0)); // trunk
  for (const z of [-0.55, 0.55]) g.push(new THREE.BoxGeometry(0.1, 0.9, 0.7).translate(1.2, 2.5, z)); // ears
  for (const x of [-0.7, 0.7]) for (const z of [-0.45, 0.45]) {
    g.push(new THREE.CylinderGeometry(0.28, 0.3, 1.4, 6).translate(x, 0.7, z));
  }
  const tusks: THREE.BufferGeometry[] = [];
  for (const z of [-0.25, 0.25]) tusks.push(new THREE.ConeGeometry(0.07, 0.8, 5).rotateZ(-1.9).translate(1.95, 2.0, z));
  return { body: mergeGeos(g), tusks: mergeGeos(tusks) };
}

const TEMPERATE_SKIES: BiomeId[] = ['highlands', 'fjords', 'ireland', 'alps', 'newzealand'];

/** Every species, and the landscapes it lives in. Shapes are built per species (they're rotated in place). */
function speciesList(): Species[] {
  const one = (geo: THREE.BufferGeometry, color: number) => [{ geo, color }];
  const cow = (color: number) => {
    const c = createHighlandCowGeometry();
    return [{ geo: c.body, color }, { geo: c.horns, color: 0xe8dcc0 }];
  };
  const sheep = (wool: number, face: number) => {
    const s = createSheepGeometry();
    return [{ geo: s.wool, color: wool }, { geo: s.face, color: face }];
  };
  const zebra = createZebraGeometry();
  const giraffe = createGiraffeGeometry();
  const elephant = createElephantGeometry();
  return [
    // Temperate
    { name: 'red-deer', kind: 'land', count: 30, biomes: ['highlands', 'fjords'], parts: one(createDeerGeometry(), 0x8a4b2a), scale: [0.9, 1.3], speed: [1.5, 3] },
    { name: 'rabbit', kind: 'land', count: 40, biomes: ['highlands', 'ireland', 'newzealand'], parts: one(createRabbitGeometry(), 0x8f7a62), scale: [0.4, 0.55], speed: [1.5, 3] },
    { name: 'bird', kind: 'bird', count: 30, biomes: TEMPERATE_SKIES, parts: one(createBirdGeometry(), 0x6b5d50), scale: [0.8, 1.3], speed: [3.5, 5.5] },
    { name: 'fish', kind: 'fish', count: 40, biomes: [...TEMPERATE_SKIES, 'amazon'], parts: one(createFishGeometry(), 0x7f8f7a), scale: [0.6, 1.2], speed: [1.5, 2.5] },
    { name: 'highland-cow', kind: 'herd', count: 8, herdSize: 4, biomes: ['highlands'], parts: cow(0xb5651d), scale: [0.9, 1.1], speed: [0.4, 0.8] },
    { name: 'sheep', kind: 'herd', count: 16, herdSize: 4, biomes: ['highlands', 'ireland', 'newzealand', 'fjords'], parts: sheep(0xeeeae0, 0x2a2624), scale: [0.8, 1.0], speed: [0.5, 1.0] },
    { name: 'dairy-cow', kind: 'herd', count: 8, herdSize: 4, biomes: ['ireland'], parts: cow(0x2a2a2a), scale: [0.9, 1.1], speed: [0.4, 0.8] },
    { name: 'brown-cow', kind: 'herd', count: 8, herdSize: 4, biomes: ['alps'], parts: cow(0x8a5a3a), scale: [0.9, 1.1], speed: [0.4, 0.8] },
    { name: 'goat', kind: 'herd', count: 8, herdSize: 4, biomes: ['alps'], parts: sheep(0xd8d4cc, 0x6a5a4a), scale: [0.7, 0.9], speed: [0.6, 1.2] },
    // Desert and canyon
    { name: 'camel', kind: 'land', count: 10, biomes: ['sahara'], parts: one(createCamelGeometry(), 0xc49a5a), scale: [0.9, 1.1], speed: [0.8, 1.5] },
    { name: 'vulture', kind: 'bird', count: 12, biomes: ['sahara', 'savanna', 'southwest'], parts: one(createBirdGeometry(), 0x3a3028), scale: [1.2, 1.6], speed: [3, 4.5] },
    { name: 'pronghorn', kind: 'land', count: 16, biomes: ['southwest'], parts: one(createDeerGeometry(), 0xc79a5a), scale: [0.8, 1.0], speed: [2, 3.5] },
    { name: 'jackrabbit', kind: 'land', count: 20, biomes: ['southwest', 'sahara'], parts: one(createRabbitGeometry(), 0xa08a6a), scale: [0.45, 0.6], speed: [2, 3.5] },
    // Rainforest
    { name: 'macaw', kind: 'bird', count: 30, biomes: ['amazon'], parts: one(createBirdGeometry(), 0xd63a2a), scale: [0.7, 1.0], speed: [3.5, 5] },
    { name: 'capybara', kind: 'land', count: 20, biomes: ['amazon'], parts: one(createRabbitGeometry(), 0x7a5a3a), scale: [1.1, 1.4], speed: [0.8, 1.5] },
    // Savanna
    { name: 'zebra', kind: 'herd', count: 16, herdSize: 4, biomes: ['savanna'], parts: [{ geo: zebra.body, color: 0xf2f0ea }, { geo: zebra.stripes, color: 0x1e1e1e }], scale: [0.9, 1.1], speed: [1, 2] },
    { name: 'giraffe', kind: 'land', count: 10, biomes: ['savanna'], parts: [{ geo: giraffe.body, color: 0xe0b45a }, { geo: giraffe.spots, color: 0x8a5a2a }], scale: [0.9, 1.1], speed: [0.8, 1.4] },
    { name: 'elephant', kind: 'herd', count: 8, herdSize: 4, biomes: ['savanna'], parts: [{ geo: elephant.body, color: 0x8a8580 }, { geo: elephant.tusks, color: 0xf0ead8 }], scale: [0.9, 1.2], speed: [0.5, 1] },
    // Arctic
    { name: 'reindeer', kind: 'land', count: 24, biomes: ['arctic'], parts: one(createDeerGeometry(), 0x9a8a78), scale: [0.9, 1.2], speed: [1, 2.5] },
    { name: 'arctic-fox', kind: 'land', count: 14, biomes: ['arctic'], parts: one(createRabbitGeometry(), 0xf2f2f2), scale: [0.5, 0.65], speed: [2, 3.5] },
    { name: 'snow-bird', kind: 'bird', count: 16, biomes: ['arctic'], parts: one(createBirdGeometry(), 0xeeeeee), scale: [0.7, 1.0], speed: [3.5, 5] },
  ];
}

function slopeAt(x: number, z: number): number {
  const dx = getTerrainHeightCached(x + 1, z) - getTerrainHeightCached(x - 1, z);
  const dz = getTerrainHeightCached(x, z + 1) - getTerrainHeightCached(x, z - 1);
  return 1 - 2 / Math.sqrt(dx * dx + dz * dz + 4);
}

/** Is (x, z) a place this kind of animal can be? Returns the y to put it at, or null. */
function habitat(kind: Kind, x: number, z: number): number | null {
  const h = getTerrainHeightCached(x, z);
  switch (kind) {
    case 'land':
      return h >= 0.8 && slopeAt(x, z) < 0.4 ? h : null;
    case 'herd':
      return h >= 1 && h <= 30 && slopeAt(x, z) < 0.25 ? h : null;
    case 'fish':
      return h <= -1.5 ? Math.max(h + 0.4, -0.8 - Math.random() * Math.min(4, -h - 1)) : null;
    case 'bird':
      return Math.max(h, 0) + 10 + Math.random() * 25;
  }
}

class SpeciesGroup {
  meshes: THREE.InstancedMesh[];
  data: Animal[] = [];
  private herdTimer = Math.random() * HERD_CHECK_INTERVAL;
  private blocks: BlockQuery = NO_BLOCKS;

  constructor(readonly sp: Species, group: THREE.Group) {
    this.meshes = sp.parts.map((part) => {
      const mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.85, metalness: 0.02, flatShading: true });
      const mesh = new THREE.InstancedMesh(facePlusZ(part.geo), mat, sp.count);
      mesh.castShadow = true;
      mesh.frustumCulled = false; // animals roam the whole view
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
      return mesh;
    });
    const tint = new THREE.Color();
    for (let i = 0; i < sp.count; i++) {
      this.data.push({
        x: 0, y: 0, z: 0, scale: 1, heading: 0, speed: 1, wanderTimer: 0, wanderInterval: 4,
        baseY: 0, accum: Math.random() * 0.1, active: false,
      });
      const v = 0.85 + Math.random() * 0.25;
      for (const m of this.meshes) {
        m.setMatrixAt(i, HIDDEN);
        m.setColorAt(i, tint.setRGB(v, v, v));
      }
    }
  }

  /** Put animal i at a valid spot in a ring around (cx, cz). Returns false if no spot was found. */
  spawn(i: number, cx: number, cz: number, minR: number, maxR: number): boolean {
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!this.sp.biomes.includes(dominantBiome(x, z).id)) continue;
      const y = habitat(this.sp.kind, x, z);
      if (y === null || this.blocks.isSolid(x, y + 0.5, z)) continue;
      this.place(i, x, y, z);
      return true;
    }
    return false;
  }

  private place(i: number, x: number, y: number, z: number) {
    const a = this.data[i];
    const [s0, s1] = this.sp.scale;
    const [v0, v1] = this.sp.speed;
    Object.assign(a, {
      x, y, z, baseY: y, active: true,
      scale: s0 + Math.random() * (s1 - s0),
      speed: v0 + Math.random() * (v1 - v0),
      heading: Math.random() * Math.PI * 2,
      wanderTimer: Math.random() * 3,
      wanderInterval: 3 + Math.random() * 5,
    });
  }

  private hide(i: number) {
    this.data[i].active = false;
    for (const m of this.meshes) m.setMatrixAt(i, HIDDEN);
  }

  /** Cows and sheep: whole herds disappear when left behind and only sometimes reappear nearby. */
  private updateHerds(dt: number, px: number, pz: number) {
    this.herdTimer += dt;
    if (this.herdTimer < HERD_CHECK_INTERVAL) return;
    this.herdTimer = 0;
    const size = this.sp.herdSize!;
    for (let start = 0; start < this.sp.count; start += size) {
      const members = this.data.slice(start, start + size);
      const leader = members.find((m) => m.active);
      if (leader) {
        const dx = leader.x - px;
        const dz = leader.z - pz;
        if (dx * dx + dz * dz < RECYCLE_DIST * RECYCLE_DIST) continue;
        for (let k = 0; k < size; k++) this.hide(start + k);
      }
      if (Math.random() > HERD_CHANCE) continue;
      if (!this.spawn(start, px, pz, SPAWN_MIN, SPAWN_MAX)) continue;
      const lead = this.data[start];
      const n = 2 + Math.floor(Math.random() * (size - 1)); // 2..size
      for (let k = 1; k < n; k++) {
        if (!this.spawn(start + k, lead.x, lead.z, 1, 6)) this.hide(start + k);
      }
    }
  }

  update(dt: number, time: number, px: number, pz: number, blocks: BlockQuery) {
    const kind = this.sp.kind;
    this.blocks = blocks;
    if (kind === 'herd') this.updateHerds(dt, px, pz);

    const nearSq = 70 * 70;
    const midSq = 160 * 160;
    const farSq = 320 * 320;
    const recycleSq = RECYCLE_DIST * RECYCLE_DIST;
    let dirty = false;

    for (let i = 0; i < this.data.length; i++) {
      const a = this.data[i];
      if (!a.active) {
        // Retry now and then (e.g. fish waiting for a loch to come into range)
        if (kind !== 'herd' && Math.random() < 0.02 && this.spawn(i, px, pz, SPAWN_MIN, SPAWN_MAX)) dirty = true;
        continue;
      }
      const dxp = px - a.x;
      const dzp = pz - a.z;
      const distSq = dxp * dxp + dzp * dzp;

      if (distSq > recycleSq && kind !== 'herd') {
        if (!this.spawn(i, px, pz, SPAWN_MIN, SPAWN_MAX)) this.hide(i);
        dirty = true;
        continue;
      }

      // Far-away updates run at a lower tick rate; accumulated dt keeps speed consistent.
      let interval = 0;
      if (distSq > farSq) interval = 0.25;
      else if (distSq > midSq) interval = 1 / 12;
      else if (distSq > nearSq) interval = 1 / 30;
      let stepDt = dt;
      if (interval > 0) {
        a.accum += dt;
        if (a.accum < interval) continue;
        stepDt = Math.min(a.accum, 0.25);
        a.accum = 0;
      }

      a.wanderTimer += stepDt;
      if (a.wanderTimer >= a.wanderInterval) {
        a.wanderTimer = 0;
        a.heading += (Math.random() - 0.5) * Math.PI * 1.2;
        a.wanderInterval = 2 + Math.random() * 6;
      }

      const nx = a.x + Math.sin(a.heading) * a.speed * stepDt;
      const nz = a.z + Math.cos(a.heading) * a.speed * stepDt;
      const th = getTerrainHeightCached(nx, nz);

      // Can it step there? Land animals stay out of water, fish stay in it, nobody walks into blocks.
      let ok = true;
      if (kind === 'land' || kind === 'herd') ok = th >= 0.5;
      else if (kind === 'fish') ok = th <= -1.2;
      if (ok && kind !== 'fish' && blocks.isSolid(nx, (kind === 'bird' ? a.y : th) + 0.5, nz)) ok = false;

      if (!ok) {
        a.heading += Math.PI * (0.5 + Math.random() * 0.5);
      } else {
        a.x = nx;
        a.z = nz;
        if (kind === 'land' || kind === 'herd') {
          a.y = Math.max(th, blocks.supportHeight(nx, nz, a.y + 0.6));
        } else if (kind === 'bird') {
          // Glide over hills: never closer than 8 above the ground
          a.baseY = Math.max(a.baseY, Math.max(th, 0) + 8);
          a.y = a.baseY + Math.sin(time * 1.5 + i * 2) * 1.5;
        } else {
          a.y = Math.min(Math.max(a.baseY + Math.sin(time * 0.8 + i * 1.3) * 0.4, th + 0.3), -0.7);
        }
      }

      this.dummy.position.set(a.x, a.y, a.z);
      this.dummy.scale.setScalar(a.scale);
      this.dummy.rotation.set(0, a.heading, kind === 'bird' ? Math.sin(time * 2 + i) * 0.15 : 0);
      this.dummy.updateMatrix();
      for (const m of this.meshes) m.setMatrixAt(i, this.dummy.matrix);
      dirty = true;
    }

    if (dirty) for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  /** Is any active animal of this species within r of the point? */
  isNear(x: number, y: number, z: number, r: number): boolean {
    for (const a of this.data) {
      if (!a.active) continue;
      const dx = a.x - x, dy = a.y - y, dz = a.z - z;
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    }
    return false;
  }

  private dummy = new THREE.Object3D();
}

/** Highland wildlife that lives around the player wherever they go. */
export class Animals {
  group = new THREE.Group();
  private species: SpeciesGroup[];

  constructor() {
    this.species = speciesList().map((sp) => new SpeciesGroup(sp, this.group));
    // Start everything near spawn; herds appear over time.
    for (const s of this.species) {
      if (s.sp.kind === 'herd') continue;
      for (let i = 0; i < s.sp.count; i++) s.spawn(i, 0, 0, 20, SPAWN_MAX);
    }
  }

  update(dt: number, time: number, playerPos: THREE.Vector3, blocks: BlockQuery = NO_BLOCKS) {
    for (const s of this.species) s.update(dt, time, playerPos.x, playerPos.z, blocks);
  }

  isNear(x: number, y: number, z: number, r = 1): boolean {
    return this.species.some((s) => s.isNear(x, y, z, r));
  }
}
