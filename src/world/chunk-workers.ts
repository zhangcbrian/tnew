import type { ChunkData } from './chunk-gen';

/**
 * A few workers that build chunks in parallel. Requests go to the least busy worker;
 * finished chunks are collected until the chunk manager picks them up.
 */
export class ChunkWorkers {
  private workers: Worker[] = [];
  private busy: number[] = [];
  private done: ChunkData[] = [];

  constructor() {
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./chunk-worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<ChunkData>) => {
        this.busy[i]--;
        this.done.push(e.data);
      };
      this.workers.push(w);
      this.busy.push(0);
    }
  }

  /** Chunks currently being built across all workers. */
  get inFlight(): number {
    return this.busy.reduce((a, b) => a + b, 0);
  }

  get capacity(): number {
    return this.workers.length * 2;
  }

  request(cx: number, cz: number) {
    let best = 0;
    for (let i = 1; i < this.workers.length; i++) if (this.busy[i] < this.busy[best]) best = i;
    this.busy[best]++;
    this.workers[best].postMessage({ cx, cz });
  }

  /** Take up to `max` finished chunks. */
  take(max: number): ChunkData[] {
    return this.done.splice(0, max);
  }
}
