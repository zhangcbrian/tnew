import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { octaveNoise, mulberry32, hash2 } from '../utils/noise';
import { getTerrainHeightCached, CHUNK_SIZE } from './terrain';
import { UNLOAD_RADIUS } from './chunk-manager';

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

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(parts)!;
}

function scotsPine(): THREE.BufferGeometry {
  // Tall bare red-brown trunk with an irregular, flat-topped crown
  const parts = [painted(new THREE.CylinderGeometry(0.16, 0.3, 6, 6).translate(0, 3, 0), 0x7a4a2e)];
  const crowns: [number, number, number, number][] = [
    [0, 6.4, 0, 1.6], [0.9, 5.6, 0.3, 1.1], [-0.8, 5.9, -0.4, 1.2], [0.2, 7.0, -0.6, 1.0],
  ];
  for (const [x, y, z, r] of crowns) {
    parts.push(painted(new THREE.SphereGeometry(r, 6, 4).scale(1, 0.5, 1).translate(x, y, z), 0x2f4a2c));
  }
  return merge(parts);
}

function birch(): THREE.BufferGeometry {
  return merge([
    painted(new THREE.CylinderGeometry(0.08, 0.13, 4.5, 6).translate(0, 2.25, 0), 0xe8e4dc),
    painted(new THREE.SphereGeometry(1.1, 6, 5).scale(1, 1.4, 1).translate(0, 4.6, 0), 0x7d9a48),
  ]);
}

function heather(): THREE.BufferGeometry {
  return merge([
    painted(new THREE.SphereGeometry(0.55, 6, 4).scale(1.2, 0.45, 1).translate(0, 0.15, 0), 0x7b4f73),
    painted(new THREE.SphereGeometry(0.35, 5, 3).scale(1, 0.5, 1).translate(0.45, 0.12, 0.2), 0x8d5c86),
  ]);
}

function gorse(): THREE.BufferGeometry {
  const parts = [painted(new THREE.SphereGeometry(0.8, 6, 5).scale(1.1, 0.75, 1).translate(0, 0.5, 0), 0x3f5a2a)];
  // Yellow flowers dotted over the top
  const flowers: [number, number, number][] = [[0.4, 0.95, 0.3], [-0.5, 0.85, 0.2], [0.1, 1.05, -0.4], [-0.2, 0.9, 0.5], [0.6, 0.7, -0.3]];
  for (const [x, y, z] of flowers) {
    parts.push(painted(new THREE.DodecahedronGeometry(0.16, 0).translate(x, y, z), 0xf2c62a));
  }
  return merge(parts);
}

function bracken(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const frond = new THREE.ConeGeometry(0.28, 0.9, 4).scale(1, 1, 0.2);
    frond.rotateZ(0.6).rotateY(a).translate(Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2);
    parts.push(painted(frond, 0x9a6a34));
  }
  return merge(parts);
}

function boulder(): THREE.BufferGeometry {
  return painted(new THREE.DodecahedronGeometry(0.8, 0).scale(1.2, 0.7, 1).translate(0, 0.25, 0), 0x7f7f84);
}

function grassTuft(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, r] of [[0, 0, 0], [0.12, 0.05, 0.3], [-0.1, 0.08, -0.25]]) {
    parts.push(painted(new THREE.ConeGeometry(0.06, 0.55, 3).rotateZ(r).translate(x, 0.27, z), 0x8a9353));
  }
  return merge(parts);
}

interface PlantType {
  name: string;
  geo: THREE.BufferGeometry;
  /** Max instances per chunk */
  perChunk: number;
  shadow: boolean;
  scale: [number, number];
  /** Can this plant grow here? `rand` is a fresh random 0..1 for density thinning. */
  fits(h: number, slope: number, x: number, z: number, rand: number): boolean;
}

const PLANTS: PlantType[] = [
  {
    name: 'pine', geo: scotsPine(), perChunk: 28, shadow: true, scale: [0.8, 1.5],
    // Clustered stands in sheltered low and mid ground
    fits: (h, s, x, z) => h > 1.5 && h < 45 && s < 0.35 && octaveNoise(x, z, 2, 0.5, 2, 0.01) > 0.25,
  },
  {
    name: 'birch', geo: birch(), perChunk: 8, shadow: false, scale: [0.8, 1.2],
    fits: (h, s, _x, _z, r) => h > 1.5 && h < 30 && s < 0.3 && r < 0.35,
  },
  {
    name: 'heather', geo: heather(), perChunk: 30, shadow: false, scale: [0.7, 1.6],
    fits: (h, s) => h > 8 && h < 70 && s < 0.45,
  },
  {
    name: 'gorse', geo: gorse(), perChunk: 10, shadow: false, scale: [0.7, 1.3],
    fits: (h, s, _x, _z, r) => h > 2 && h < 35 && s < 0.35 && r < 0.5,
  },
  {
    name: 'bracken', geo: bracken(), perChunk: 24, shadow: false, scale: [0.8, 1.5],
    fits: (h, s) => h > 1 && h < 30 && s < 0.3,
  },
  {
    name: 'boulder', geo: boulder(), perChunk: 12, shadow: false, scale: [0.4, 2.0],
    // Anywhere dry, but much more common on steep or high ground
    fits: (h, s, _x, _z, r) => h > 0.3 && s < 0.7 && r < (s > 0.3 || h > 50 ? 0.9 : 0.2),
  },
  {
    name: 'grass', geo: grassTuft(), perChunk: 40, shadow: false, scale: [0.8, 1.6],
    fits: (h, s) => h > 0.6 && h < 40 && s < 0.4,
  },
];

/** Enough slots for every chunk inside the unload radius, plus a margin. */
const SLOTS = (() => {
  let n = 0;
  for (let z = -UNLOAD_RADIUS; z <= UNLOAD_RADIUS; z++) {
    for (let x = -UNLOAD_RADIUS; x <= UNLOAD_RADIUS; x++) if (x * x + z * z <= UNLOAD_RADIUS * UNLOAD_RADIUS) n++;
  }
  return n + 16;
})();

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function slopeAt(x: number, z: number): number {
  const dx = getTerrainHeightCached(x + 1, z) - getTerrainHeightCached(x - 1, z);
  const dz = getTerrainHeightCached(x, z + 1) - getTerrainHeightCached(x, z - 1);
  return 1 - 2 / Math.sqrt(dx * dx + dz * dz + 4);
}

/**
 * Highland plants, placed per terrain chunk. Each plant type is one big InstancedMesh;
 * every loaded chunk owns a fixed block of instances ("slot") that is filled when the chunk
 * loads and hidden again when it unloads. The same chunk always gets the same plants.
 */
export class Vegetation {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private freeSlots: number[] = [];
  private chunkSlots = new Map<string, number>();
  private dummy = new THREE.Object3D();
  private tint = new THREE.Color();

  constructor() {
    for (const p of PLANTS) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
      const mesh = new THREE.InstancedMesh(p.geo, mat, SLOTS * p.perChunk);
      mesh.name = p.name;
      mesh.castShadow = p.shadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // instances are spread across the whole view
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, HIDDEN);
        mesh.setColorAt(i, this.tint.setRGB(1, 1, 1));
      }
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    for (let s = SLOTS - 1; s >= 0; s--) this.freeSlots.push(s);
    this.updateDrawCounts();
  }

  /** Only draw instances up to the highest slot in use, so empty slots cost nothing. */
  private updateDrawCounts() {
    let top = -1;
    for (const s of this.chunkSlots.values()) top = Math.max(top, s);
    PLANTS.forEach((p, t) => { this.meshes[t].count = (top + 1) * p.perChunk; });
  }

  addChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    if (this.chunkSlots.has(key)) return;
    // Lowest free slot first, keeping used slots packed at the front
    this.freeSlots.sort((a, b) => b - a);
    const slot = this.freeSlots.pop();
    if (slot === undefined) return; // out of slots: chunk just has no plants
    this.chunkSlots.set(key, slot);

    PLANTS.forEach((p, t) => {
      const mesh = this.meshes[t];
      const rng = mulberry32(hash2(cx, cz) + t * 7919);
      const base = slot * p.perChunk;
      let placed = 0;
      for (let attempt = 0; attempt < p.perChunk * 2 && placed < p.perChunk; attempt++) {
        const x = cx * CHUNK_SIZE + (rng() - 0.5) * CHUNK_SIZE;
        const z = cz * CHUNK_SIZE + (rng() - 0.5) * CHUNK_SIZE;
        const r = rng();
        const h = getTerrainHeightCached(x, z);
        if (!p.fits(h, slopeAt(x, z), x, z, r)) continue;

        const s = p.scale[0] + rng() * (p.scale[1] - p.scale[0]);
        this.dummy.position.set(x, h - 0.05, z);
        this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        this.dummy.scale.set(s, s * (0.85 + rng() * 0.3), s);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(base + placed, this.dummy.matrix);
        const v = 0.85 + rng() * 0.25;
        mesh.setColorAt(base + placed, this.tint.setRGB(v, v * (0.95 + rng() * 0.1), v));
        placed++;
      }
      for (let i = placed; i < p.perChunk; i++) mesh.setMatrixAt(base + i, HIDDEN);
      this.markSlotDirty(mesh, base, p.perChunk);
    });
    this.updateDrawCounts();
  }

  removeChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const slot = this.chunkSlots.get(key);
    if (slot === undefined) return;
    this.chunkSlots.delete(key);
    PLANTS.forEach((p, t) => {
      const base = slot * p.perChunk;
      for (let i = 0; i < p.perChunk; i++) this.meshes[t].setMatrixAt(base + i, HIDDEN);
      this.markSlotDirty(this.meshes[t], base, p.perChunk);
    });
    this.freeSlots.push(slot);
    this.updateDrawCounts();
  }

  private markSlotDirty(mesh: THREE.InstancedMesh, base: number, n: number) {
    mesh.instanceMatrix.addUpdateRange(base * 16, n * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.addUpdateRange(base * 3, n * 3);
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
