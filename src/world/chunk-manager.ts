import * as THREE from 'three';
import { buildChunkGeometry, storeChunkHeights, forgetChunkHeights, terrainMaterial, CHUNK_SIZE } from './terrain';
import { ChunkWorkers } from './chunk-workers';
import type { ChunkData, PlantData } from './chunk-gen';

const VIEW_DISTANCE = 500;
/** Chunks within this many chunks of the player are kept loaded. */
export const LOAD_RADIUS = Math.ceil(VIEW_DISTANCE / CHUNK_SIZE);
/** Chunks are only unloaded past this radius, so walking back and forth doesn't thrash. */
export const UNLOAD_RADIUS = LOAD_RADIUS + 2;

/** Terrain detail by distance: every vertex near the player, every 2nd / 4th further out. */
function lodStep(dxChunks: number, dzChunks: number): number {
  const d = Math.sqrt(dxChunks * dxChunks + dzChunks * dzChunks) * CHUNK_SIZE - CHUNK_SIZE / 2;
  if (d < 200) return 1;
  if (d < 350) return 2;
  return 4;
}

/** Most finished chunks turned into meshes per frame (GPU uploads), and LOD rebuilds per frame. */
const APPLY_PER_FRAME = 3;
const LOD_REBUILDS_PER_FRAME = 4;

type ChunkRecord = {
  cx: number;
  cz: number;
  mesh: THREE.Mesh;
  data: ChunkData;
  step: number;
};

const keyOf = (cx: number, cz: number) => `${cx},${cz}`;

export function chunkCoord(v: number): number {
  return Math.floor((v + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
}

/**
 * Streams terrain chunks around the player. Chunks are built by web workers (nearest first);
 * the main thread only uploads finished ones, a few per frame, and frees far chunks.
 * Other systems hook in through onLoad / onUnload.
 */
export class ChunkManager {
  group = new THREE.Group();
  private chunks = new Map<string, ChunkRecord>();
  private requested = new Set<string>();
  private workers = new ChunkWorkers();
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  private lastRadius = 0;
  /** Missing chunks within LOAD_RADIUS, nearest first. Rebuilt when the player changes chunk. */
  private queue: [number, number][] = [];
  /** Chunks whose detail level needs rebuilding after the player moved. */
  private lodQueue: string[] = [];

  constructor(
    private onLoad: (cx: number, cz: number, plants: PlantData[]) => void = () => {},
    private onUnload: (cx: number, cz: number) => void = () => {},
  ) {}

  get loadedCount(): number {
    return this.chunks.size;
  }

  setCallbacks(onLoad: (cx: number, cz: number, plants: PlantData[]) => void, onUnload: (cx: number, cz: number) => void) {
    this.onLoad = onLoad;
    this.onUnload = onUnload;
    // Let late subscribers catch up on chunks that already exist.
    for (const rec of this.chunks.values()) onLoad(rec.cx, rec.cz, rec.data.plants);
  }

  /** Load the area within `radius` chunks of (px, pz). Returns progress 0..1 (call every frame). */
  preload(px: number, pz: number, radius: number): number {
    this.update(px, pz, radius, 8);
    const pcx = chunkCoord(px);
    const pcz = chunkCoord(pz);
    let total = 0;
    let done = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        total++;
        if (this.chunks.has(keyOf(pcx + dx, pcz + dz))) done++;
      }
    }
    return done / total;
  }

  update(px: number, pz: number, radius = LOAD_RADIUS, applyBudget = APPLY_PER_FRAME) {
    const pcx = chunkCoord(px);
    const pcz = chunkCoord(pz);

    if (pcx !== this.lastCx || pcz !== this.lastCz || radius !== this.lastRadius) {
      this.lastCx = pcx;
      this.lastCz = pcz;
      this.lastRadius = radius;
      this.unloadFar(pcx, pcz);
      this.rebuildQueue(pcx, pcz, radius);
      this.lodQueue = [...this.chunks.keys()];
    }

    // Keep the workers fed, nearest chunks first
    while (this.queue.length > 0 && this.workers.inFlight < this.workers.capacity) {
      const [cx, cz] = this.queue.shift()!;
      const key = keyOf(cx, cz);
      if (this.chunks.has(key) || this.requested.has(key)) continue;
      this.requested.add(key);
      this.workers.request(cx, cz);
    }

    // Upload finished chunks; drop any the player has already left behind
    for (const data of this.workers.take(applyBudget)) {
      const key = keyOf(data.cx, data.cz);
      this.requested.delete(key);
      const dx = data.cx - pcx;
      const dz = data.cz - pcz;
      if (this.chunks.has(key) || dx * dx + dz * dz > UNLOAD_RADIUS * UNLOAD_RADIUS) continue;
      this.load(data, pcx, pcz);
    }

    // Re-detail chunks whose distance band changed
    let rebuilds = LOD_REBUILDS_PER_FRAME;
    while (rebuilds > 0 && this.lodQueue.length > 0) {
      const rec = this.chunks.get(this.lodQueue.pop()!);
      if (!rec) continue;
      const step = lodStep(rec.cx - pcx, rec.cz - pcz);
      if (step === rec.step) continue;
      rec.mesh.geometry.dispose();
      rec.mesh.geometry = buildChunkGeometry(rec.data, step);
      rec.step = step;
      rebuilds--;
    }
  }

  /** Terrain meshes in the 3x3 chunks around (px, pz), for raycasting. */
  nearbyMeshes(px: number, pz: number): THREE.Mesh[] {
    const pcx = chunkCoord(px);
    const pcz = chunkCoord(pz);
    const out: THREE.Mesh[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const rec = this.chunks.get(keyOf(pcx + dx, pcz + dz));
        if (rec) out.push(rec.mesh);
      }
    }
    return out;
  }

  private load(data: ChunkData, pcx: number, pcz: number) {
    const step = lodStep(data.cx - pcx, data.cz - pcz);
    const mesh = new THREE.Mesh(buildChunkGeometry(data, step), terrainMaterial);
    mesh.position.set(data.cx * CHUNK_SIZE, 0, data.cz * CHUNK_SIZE);
    mesh.receiveShadow = true;
    storeChunkHeights(data.cx, data.cz, data.heights);
    this.chunks.set(keyOf(data.cx, data.cz), { cx: data.cx, cz: data.cz, mesh, data, step });
    this.group.add(mesh);
    this.onLoad(data.cx, data.cz, data.plants);
  }

  private unloadFar(pcx: number, pcz: number) {
    const r2 = UNLOAD_RADIUS * UNLOAD_RADIUS;
    for (const [key, rec] of this.chunks) {
      const dx = rec.cx - pcx;
      const dz = rec.cz - pcz;
      if (dx * dx + dz * dz <= r2) continue;
      this.group.remove(rec.mesh);
      rec.mesh.geometry.dispose(); // material is shared
      forgetChunkHeights(rec.cx, rec.cz);
      this.chunks.delete(key);
      this.onUnload(rec.cx, rec.cz);
    }
  }

  private rebuildQueue(pcx: number, pcz: number, radius: number) {
    const r2 = radius * radius;
    const missing: [number, number, number][] = [];
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        const key = keyOf(pcx + dx, pcz + dz);
        if (this.chunks.has(key) || this.requested.has(key)) continue;
        missing.push([pcx + dx, pcz + dz, d2]);
      }
    }
    missing.sort((a, b) => a[2] - b[2]);
    this.queue = missing.map(([cx, cz]) => [cx, cz]);
  }
}
