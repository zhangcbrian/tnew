import * as THREE from 'three';
import { mulberry32, hash2 } from '../utils/noise';
import { getTerrainHeightCached, CHUNK_SIZE } from './terrain';
import { UNLOAD_RADIUS } from './chunk-manager';
import { BIOMES, biomeWeights, type Biome, type PlantType } from './biomes';

/** Most chunks a pool could ever need: every chunk inside the unload radius, plus a margin. */
const MAX_SLOTS = (() => {
  let n = 0;
  for (let z = -UNLOAD_RADIUS; z <= UNLOAD_RADIUS; z++) {
    for (let x = -UNLOAD_RADIUS; x <= UNLOAD_RADIUS; x++) if (x * x + z * z <= UNLOAD_RADIUS * UNLOAD_RADIUS) n++;
  }
  return n + 16;
})();
/** Slots each pool starts with; enough for its landscape to fill the view near a region edge. */
const INITIAL_SLOTS = 32;

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

function slopeAt(x: number, z: number): number {
  const dx = getTerrainHeightCached(x + 1, z) - getTerrainHeightCached(x - 1, z);
  const dz = getTerrainHeightCached(x, z + 1) - getTerrainHeightCached(x, z - 1);
  return 1 - 2 / Math.sqrt(dx * dx + dz * dz + 4);
}

/**
 * One plant type's instances. Chunks that grow at least one of this plant borrow a "slot"
 * (a fixed block of instances); only slots up to the highest one in use are drawn, so plants
 * from landscapes that aren't nearby cost nothing.
 */
class PlantPool {
  mesh: THREE.InstancedMesh;
  private material: THREE.MeshStandardMaterial;
  private capacity = 0;
  private free: number[] = [];
  private used = new Map<string, number>();

  constructor(readonly type: PlantType, readonly biome: Biome, private group: THREE.Group) {
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    // Start small: only landscapes near the player ever need slots. Grows on demand.
    this.mesh = this.createMesh(INITIAL_SLOTS);
    this.group.add(this.mesh);
  }

  private createMesh(slots: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.type.geo, this.material, slots * this.type.perChunk);
    mesh.name = this.type.name;
    mesh.castShadow = this.type.shadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // instances are spread across the whole view
    const white = new THREE.Color(1, 1, 1);
    for (let i = this.capacity * this.type.perChunk; i < slots * this.type.perChunk; i++) {
      mesh.setMatrixAt(i, HIDDEN);
      mesh.setColorAt(i, white);
    }
    for (let s = slots - 1; s >= this.capacity; s--) this.free.push(s);
    this.capacity = slots;
    return mesh;
  }

  /** Double the pool (up to MAX_SLOTS), keeping every instance already placed. */
  private grow(): boolean {
    if (this.capacity >= MAX_SLOTS) return false;
    const old = this.mesh;
    const oldCount = this.capacity * this.type.perChunk;
    const next = this.createMesh(Math.min(this.capacity * 2, MAX_SLOTS));
    (next.instanceMatrix.array as Float32Array).set((old.instanceMatrix.array as Float32Array).subarray(0, oldCount * 16));
    if (old.instanceColor && next.instanceColor) {
      (next.instanceColor.array as Float32Array).set((old.instanceColor.array as Float32Array).subarray(0, oldCount * 3));
    }
    this.group.remove(old);
    old.dispose(); // frees its instance buffers; geometry and material are shared and kept
    this.group.add(next);
    this.mesh = next;
    return true;
  }

  /** Write a chunk's instances (matrices + tints). Returns false if the pool is full. */
  fill(key: string, matrices: THREE.Matrix4[], tints: THREE.Color[]): boolean {
    if (this.free.length === 0 && !this.grow()) return false;
    this.free.sort((a, b) => b - a); // lowest free slot first, keeping used slots packed
    const slot = this.free.pop();
    if (slot === undefined) return false;
    this.used.set(key, slot);
    const per = this.type.perChunk;
    const base = slot * per;
    for (let i = 0; i < per; i++) {
      this.mesh.setMatrixAt(base + i, i < matrices.length ? matrices[i] : HIDDEN);
      if (i < tints.length) this.mesh.setColorAt(base + i, tints[i]);
    }
    this.markDirty(base, per);
    this.updateCount();
    return true;
  }

  release(key: string) {
    const slot = this.used.get(key);
    if (slot === undefined) return;
    this.used.delete(key);
    const per = this.type.perChunk;
    for (let i = 0; i < per; i++) this.mesh.setMatrixAt(slot * per + i, HIDDEN);
    this.markDirty(slot * per, per);
    this.free.push(slot);
    this.updateCount();
  }

  private updateCount() {
    let top = -1;
    for (const s of this.used.values()) top = Math.max(top, s);
    this.mesh.count = (top + 1) * this.type.perChunk;
    this.mesh.visible = this.mesh.count > 0;
  }

  private markDirty(base: number, n: number) {
    this.mesh.instanceMatrix.addUpdateRange(base * 16, n * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.addUpdateRange(base * 3, n * 3);
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

/**
 * Plants for every landscape, placed per terrain chunk. Near a region edge, each candidate spot
 * picks its landscape by the blend weights, so forests thin out into deserts gradually.
 * The same chunk always gets the same plants.
 */
export class Vegetation {
  group = new THREE.Group();
  private pools: PlantPool[] = [];
  private dummy = new THREE.Object3D();

  constructor() {
    for (const biome of BIOMES) {
      for (const type of biome.plants) {
        this.pools.push(new PlantPool(type, biome, this.group));
      }
    }
  }

  addChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;

    // Landscapes present anywhere in this chunk (center + corners)
    const present = new Set<Biome>();
    for (const [dx, dz] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      for (const { biome } of biomeWeights(x0 + dx * CHUNK_SIZE, z0 + dz * CHUNK_SIZE)) present.add(biome);
    }

    this.pools.forEach((pool, t) => {
      if (!present.has(pool.biome)) return;
      const type = pool.type;
      const rng = mulberry32(hash2(cx, cz) + t * 7919);
      const matrices: THREE.Matrix4[] = [];
      const tints: THREE.Color[] = [];
      for (let attempt = 0; attempt < type.perChunk * 2 && matrices.length < type.perChunk; attempt++) {
        const x = x0 + (rng() - 0.5) * CHUNK_SIZE;
        const z = z0 + (rng() - 0.5) * CHUNK_SIZE;
        const r = rng();
        const pick = rng();
        if (present.size > 1 && this.biomeAt(x, z, pick) !== pool.biome) continue;
        const h = getTerrainHeightCached(x, z);
        if (!type.fits(h, slopeAt(x, z), x, z, r)) continue;

        const s = type.scale[0] + rng() * (type.scale[1] - type.scale[0]);
        this.dummy.position.set(x, h - 0.05, z);
        this.dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        this.dummy.scale.set(s, s * (0.85 + rng() * 0.3), s);
        this.dummy.updateMatrix();
        matrices.push(this.dummy.matrix.clone());
        const v = 0.85 + rng() * 0.25;
        tints.push(new THREE.Color(v, v * (0.95 + rng() * 0.1), v));
      }
      if (matrices.length > 0) pool.fill(key, matrices, tints);
    });
  }

  removeChunk(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    for (const pool of this.pools) pool.release(key);
  }

  /** Pick one landscape at (x, z) in proportion to the blend weights. */
  private biomeAt(x: number, z: number, pick: number): Biome {
    const weights = biomeWeights(x, z);
    let acc = 0;
    for (const { biome, w } of weights) {
      acc += w;
      if (pick < acc) return biome;
    }
    return weights[weights.length - 1].biome;
  }
}
