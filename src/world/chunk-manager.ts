import * as THREE from 'three';
import { createTerrainChunk, forgetChunkHeights, CHUNK_SIZE } from './terrain';

const VIEW_DISTANCE = 500;
/** Chunks within this many chunks of the player are kept loaded. */
export const LOAD_RADIUS = Math.ceil(VIEW_DISTANCE / CHUNK_SIZE);
/** Chunks are only unloaded past this radius, so walking back and forth doesn't thrash. */
export const UNLOAD_RADIUS = LOAD_RADIUS + 2;

type ChunkRecord = {
  cx: number;
  cz: number;
  mesh: THREE.Mesh;
};

const keyOf = (cx: number, cz: number) => `${cx},${cz}`;

export function chunkCoord(v: number): number {
  return Math.floor((v + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
}

/**
 * Streams terrain chunks around the player: nearest missing chunks are built a few per
 * frame, far chunks are freed. Other systems hook in through onLoad / onUnload.
 */
export class ChunkManager {
  group = new THREE.Group();
  private chunks = new Map<string, ChunkRecord>();
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  /** Missing chunks within LOAD_RADIUS, nearest first. Rebuilt when the player changes chunk. */
  private queue: [number, number][] = [];

  constructor(
    private onLoad: (cx: number, cz: number) => void = () => {},
    private onUnload: (cx: number, cz: number) => void = () => {},
  ) {}

  get loadedCount(): number {
    return this.chunks.size;
  }

  setCallbacks(onLoad: (cx: number, cz: number) => void, onUnload: (cx: number, cz: number) => void) {
    this.onLoad = onLoad;
    this.onUnload = onUnload;
    // Let late subscribers catch up on chunks that already exist.
    for (const rec of this.chunks.values()) onLoad(rec.cx, rec.cz);
  }

  /** Build up to `budget` chunks within `radius` of (px, pz). Returns progress 0..1. */
  preload(px: number, pz: number, radius: number, budget: number): number {
    const pcx = chunkCoord(px);
    const pcz = chunkCoord(pz);
    let total = 0;
    let done = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        total++;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (this.chunks.has(keyOf(cx, cz))) {
          done++;
        } else if (budget > 0) {
          this.load(cx, cz);
          budget--;
          done++;
        }
      }
    }
    return done / total;
  }

  update(px: number, pz: number, budget = 2) {
    const pcx = chunkCoord(px);
    const pcz = chunkCoord(pz);

    if (pcx !== this.lastCx || pcz !== this.lastCz) {
      this.lastCx = pcx;
      this.lastCz = pcz;
      this.unloadFar(pcx, pcz);
      this.rebuildQueue(pcx, pcz);
    }

    while (budget > 0 && this.queue.length > 0) {
      const [cx, cz] = this.queue.shift()!;
      if (this.chunks.has(keyOf(cx, cz))) continue;
      this.load(cx, cz);
      budget--;
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

  private load(cx: number, cz: number) {
    const mesh = createTerrainChunk(cx, cz);
    this.chunks.set(keyOf(cx, cz), { cx, cz, mesh });
    this.group.add(mesh);
    this.onLoad(cx, cz);
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

  private rebuildQueue(pcx: number, pcz: number) {
    const r2 = LOAD_RADIUS * LOAD_RADIUS;
    const missing: [number, number, number][] = [];
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > r2) continue;
        if (this.chunks.has(keyOf(pcx + dx, pcz + dz))) continue;
        missing.push([pcx + dx, pcz + dz, d2]);
      }
    }
    missing.sort((a, b) => a[2] - b[2]);
    this.queue = missing.map(([cx, cz]) => [cx, cz]);
  }
}
