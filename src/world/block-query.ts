/** Read-only view of the placed-block grid, used by everything that moves. */
export interface BlockQuery {
  /** Is there a block in the cell containing this point? */
  isSolid(x: number, y: number, z: number): boolean;
  /** Top of the highest block in the column at (x, z) whose top is at or below maxY; -Infinity if none. */
  supportHeight(x: number, z: number, maxY: number): number;
  /** Does this axis-aligned box overlap any block? */
  boxHits(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean;
}

/** A BlockQuery with no blocks, for before the building system exists. */
export const NO_BLOCKS: BlockQuery = {
  isSolid: () => false,
  supportHeight: () => -Infinity,
  boxHits: () => false,
};
