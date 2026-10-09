import { generateChunk, type ChunkData } from './chunk-gen';

/** Builds chunks off the main thread. Request: { cx, cz }. Reply: ChunkData (buffers transferred). */
self.onmessage = (e: MessageEvent<{ cx: number; cz: number }>) => {
  const data: ChunkData = generateChunk(e.data.cx, e.data.cz);
  const transfer: ArrayBuffer[] = [data.heights.buffer, data.normals.buffer, data.colors.buffer];
  for (const p of data.plants) transfer.push(p.matrices.buffer, p.tints.buffer);
  (self as unknown as Worker).postMessage(data, transfer);
};
