import * as THREE from 'three';
import type { BlockQuery } from './block-query';

const BLOCK_SIZE = 1;

export type BlockType = 'dirt' | 'stone' | 'wood' | 'glass' | 'sand';

const BLOCK_COLORS: Record<BlockType, number> = {
  dirt: 0x8B6914,
  stone: 0x888899,
  wood: 0x9B7043,
  glass: 0x88CCEE,
  sand: 0xC2B280,
};

const BLOCK_TYPES: BlockType[] = ['dirt', 'stone', 'wood', 'glass', 'sand'];

/** Box test used to refuse placing a block where someone is standing. */
export type OccupiedCheck = (minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) => boolean;

/**
 * Player-placed blocks on a 1-unit grid. Cell (ix, iy, iz) is the solid box
 * x: ix±0.5, y: iy..iy+1, z: iz±0.5. Blocks are solid for everyone (see BlockQuery).
 */
export class BuildingSystem implements BlockQuery {
  group = new THREE.Group();
  private blocks = new Map<string, { mesh: THREE.Mesh; type: BlockType }>();
  /** Block heights (iy) in each (ix, iz) column, for fast "what can I stand on" lookups. */
  private columns = new Map<string, Set<number>>();
  private previewBlock: THREE.Mesh;
  /** Cell the preview is showing, or null when hidden. */
  private previewCell: [number, number, number] | null = null;
  private raycaster = new THREE.Raycaster();
  selectedType: BlockType = 'dirt';
  selectedIndex = 0;

  // Shared geometries and materials
  private blockGeo: THREE.BoxGeometry;
  private blockMats: Record<BlockType, THREE.MeshStandardMaterial>;

  constructor() {
    this.blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    this.blockMats = {} as Record<BlockType, THREE.MeshStandardMaterial>;
    for (const type of BLOCK_TYPES) {
      const isGlass = type === 'glass';
      this.blockMats[type] = new THREE.MeshStandardMaterial({
        color: BLOCK_COLORS[type],
        roughness: isGlass ? 0.1 : 0.8,
        metalness: isGlass ? 0.2 : 0.05,
        flatShading: true,
        transparent: isGlass,
        opacity: isGlass ? 0.4 : 1.0,
      });
    }

    // Preview block (ghost)
    this.previewBlock = new THREE.Mesh(
      this.blockGeo,
      new THREE.MeshStandardMaterial({
        color: BLOCK_COLORS[this.selectedType],
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.previewBlock.visible = false;
    this.group.add(this.previewBlock);

    this.raycaster.far = 20;
  }

  // ---- BlockQuery ----

  isSolid(x: number, y: number, z: number): boolean {
    return this.blocks.has(cellKey(Math.round(x), Math.floor(y), Math.round(z)));
  }

  supportHeight(x: number, z: number, maxY: number): number {
    const col = this.columns.get(`${Math.round(x)},${Math.round(z)}`);
    if (!col) return -Infinity;
    let best = -Infinity;
    for (const iy of col) {
      const top = iy + 1;
      if (top <= maxY && top > best) best = top;
    }
    return best;
  }

  boxHits(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    if (this.blocks.size === 0) return false;
    // Cells whose box strictly overlaps the query box
    for (let ix = Math.floor(minX - 0.5) + 1; ix < maxX + 0.5; ix++) {
      for (let iz = Math.floor(minZ - 0.5) + 1; iz < maxZ + 0.5; iz++) {
        const col = this.columns.get(`${ix},${iz}`);
        if (!col) continue;
        for (const iy of col) {
          if (iy + 1 > minY && iy < maxY) return true;
        }
      }
    }
    return false;
  }

  // ---- Building ----

  hidePreview() {
    this.previewBlock.visible = false;
    this.previewCell = null;
  }

  cycleBlock(direction: number) {
    this.selectedIndex = ((this.selectedIndex + direction) % BLOCK_TYPES.length + BLOCK_TYPES.length) % BLOCK_TYPES.length;
    this.selectedType = BLOCK_TYPES[this.selectedIndex];
    (this.previewBlock.material as THREE.MeshStandardMaterial).color.set(BLOCK_COLORS[this.selectedType]);
  }

  selectBlock(index: number) {
    if (index >= 0 && index < BLOCK_TYPES.length) {
      this.selectedIndex = index;
      this.selectedType = BLOCK_TYPES[this.selectedIndex];
      (this.previewBlock.material as THREE.MeshStandardMaterial).color.set(BLOCK_COLORS[this.selectedType]);
    }
  }

  /** Aim from the center of the screen at the ground (terrain meshes) or an existing block. */
  updatePreview(camera: THREE.Camera, playerPos: THREE.Vector3, ground: THREE.Object3D[]) {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const blockMeshes = [...this.blocks.values()].map((b) => b.mesh);
    const hits = this.raycaster.intersectObjects([...blockMeshes, ...ground], false);
    let cell: [number, number, number];

    if (hits.length > 0) {
      const hit = hits[0];
      const normal = (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone().transformDirection(hit.object.matrixWorld);
      if (blockMeshes.includes(hit.object as THREE.Mesh)) {
        // Next to the block that was hit, on the face we're looking at
        const p = hit.object.position;
        cell = [
          Math.round(p.x + Math.round(normal.x)),
          Math.round(p.y - 0.5 + Math.round(normal.y)),
          Math.round(p.z + Math.round(normal.z)),
        ];
      } else {
        // On the ground: the cell just above the hit point
        const p = hit.point.clone().addScaledVector(normal, 0.5);
        cell = [Math.round(p.x), Math.floor(p.y), Math.round(p.z)];
      }
    } else {
      // Nothing in reach: in front of the player
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const p = playerPos.clone().addScaledVector(dir, 5);
      cell = [Math.round(p.x), Math.floor(p.y), Math.round(p.z)];
    }

    this.previewCell = cell;
    this.previewBlock.position.set(cell[0], cell[1] + 0.5, cell[2]);
    this.previewBlock.visible = true;
  }

  /** Place a block at the preview cell, unless it's taken or someone is standing there. */
  placeBlock(occupied?: OccupiedCheck): boolean {
    if (!this.previewCell) return false;
    const [ix, iy, iz] = this.previewCell;
    const key = cellKey(ix, iy, iz);
    if (this.blocks.has(key)) return false;
    if (occupied?.(ix - 0.5, iy, iz - 0.5, ix + 0.5, iy + 1, iz + 0.5)) return false;

    const mesh = new THREE.Mesh(this.blockGeo, this.blockMats[this.selectedType]);
    mesh.position.set(ix, iy + 0.5, iz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    this.blocks.set(key, { mesh, type: this.selectedType });
    const colKey = `${ix},${iz}`;
    if (!this.columns.has(colKey)) this.columns.set(colKey, new Set());
    this.columns.get(colKey)!.add(iy);
    return true;
  }

  /** Remove a block the player is looking at */
  removeBlock(camera: THREE.Camera): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = this.raycaster.intersectObjects([...this.blocks.values()].map((b) => b.mesh), false);
    if (hits.length === 0) return false;

    const p = hits[0].object.position;
    const ix = Math.round(p.x);
    const iy = Math.round(p.y - 0.5);
    const iz = Math.round(p.z);
    const block = this.blocks.get(cellKey(ix, iy, iz));
    if (!block) return false;
    this.group.remove(block.mesh);
    this.blocks.delete(cellKey(ix, iy, iz));
    const col = this.columns.get(`${ix},${iz}`)!;
    col.delete(iy);
    if (col.size === 0) this.columns.delete(`${ix},${iz}`);
    return true;
  }

  get blockTypes(): BlockType[] {
    return BLOCK_TYPES;
  }
}

function cellKey(ix: number, iy: number, iz: number): string {
  return `${ix},${iy},${iz}`;
}
