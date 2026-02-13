import * as THREE from 'three';
import { createTerrainChunk, CHUNK_SIZE, HALF_WORLD } from './terrain';

const CHUNKS_PER_SIDE = Math.ceil((HALF_WORLD * 2) / CHUNK_SIZE);
const HALF_CHUNKS = CHUNKS_PER_SIDE / 2;
const VIEW_DISTANCE = 500;
const VIEW_CHUNK_RADIUS = Math.ceil(VIEW_DISTANCE / CHUNK_SIZE) + 1;

type ChunkRecord = {
  cx: number;
  cz: number;
  key: string;
  mesh: THREE.Mesh;
};

export class ChunkManager {
  group = new THREE.Group();
  private chunks: Map<string, ChunkRecord> = new Map();
  private totalChunks: number;
  private generatedCount = 0;
  private lastVisCx = Number.NaN;
  private lastVisCz = Number.NaN;
  private visibleKeys = new Set<string>();

  constructor() {
    this.totalChunks = CHUNKS_PER_SIDE * CHUNKS_PER_SIDE;
  }

  get progress(): number {
    return this.generatedCount / this.totalChunks;
  }

  /** Generate a batch of chunks. Returns true when done. */
  generateBatch(batchSize: number): boolean {
    const startIdx = this.generatedCount;
    const endIdx = Math.min(startIdx + batchSize, this.totalChunks);

    for (let i = startIdx; i < endIdx; i++) {
      const cx = (i % CHUNKS_PER_SIDE) - HALF_CHUNKS;
      const cz = Math.floor(i / CHUNKS_PER_SIDE) - HALF_CHUNKS;
      const key = `${cx},${cz}`;

      if (!this.chunks.has(key)) {
        const mesh = createTerrainChunk(cx, cz);
        mesh.frustumCulled = true;
        this.chunks.set(key, { cx, cz, key, mesh });
        this.group.add(mesh);
      }
    }

    this.generatedCount = endIdx;
    return this.generatedCount >= this.totalChunks;
  }

  update(playerX: number, playerZ: number) {
    // Update visibility only when the player crosses chunk boundaries.
    const pcx = Math.floor((playerX + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    const pcz = Math.floor((playerZ + CHUNK_SIZE * 0.5) / CHUNK_SIZE);
    if (pcx === this.lastVisCx && pcz === this.lastVisCz) return;
    const firstVisUpdate = Number.isNaN(this.lastVisCx) || Number.isNaN(this.lastVisCz);
    this.lastVisCx = pcx;
    this.lastVisCz = pcz;

    const nextVisible = new Set<string>();
    for (let dz = -VIEW_CHUNK_RADIUS; dz <= VIEW_CHUNK_RADIUS; dz++) {
      for (let dx = -VIEW_CHUNK_RADIUS; dx <= VIEW_CHUNK_RADIUS; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;
        const rec = this.chunks.get(key);
        if (!rec) continue;
        rec.mesh.visible = true;
        nextVisible.add(key);
      }
    }

    for (const key of this.visibleKeys) {
      if (nextVisible.has(key)) continue;
      const rec = this.chunks.get(key);
      if (rec) rec.mesh.visible = false;
    }

    if (firstVisUpdate) {
      for (const [key, rec] of this.chunks) {
        if (nextVisible.has(key)) continue;
        rec.mesh.visible = false;
      }
    }

    this.visibleKeys = nextVisible;
  }
}
