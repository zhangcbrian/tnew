import * as THREE from 'three';

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

export class BuildingSystem {
  group = new THREE.Group();
  private blocks = new Map<string, { mesh: THREE.Mesh; type: BlockType }>();
  private previewBlock: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  selectedType: BlockType = 'dirt';
  selectedIndex = 0;

  // Shared geometries and materials
  private blockGeo: THREE.BoxGeometry;
  private blockMats: Record<BlockType, THREE.MeshStandardMaterial>;
  private groundPlane: THREE.Mesh;

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

    // Invisible ground plane for raycasting
    const planeGeo = new THREE.PlaneGeometry(5000, 5000);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false });
    this.groundPlane = new THREE.Mesh(planeGeo, planeMat);
    this.groundPlane.position.y = 0;
    this.group.add(this.groundPlane);

    this.raycaster.far = 20;
  }

  hidePreview() {
    this.previewBlock.visible = false;
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

  /** Update preview position based on camera look direction */
  updatePreview(camera: THREE.Camera, playerPos: THREE.Vector3) {
    // Cast ray from center of screen
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Collect existing block meshes + ground for raycasting
    const targets: THREE.Object3D[] = [this.groundPlane];
    for (const { mesh } of this.blocks.values()) {
      targets.push(mesh);
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const hit = hits[0];
      const normal = hit.face?.normal ?? new THREE.Vector3(0, 1, 0);

      let placePos: THREE.Vector3;
      if (hit.object === this.groundPlane) {
        // Place on ground: snap to grid
        placePos = this.snapToGrid(hit.point);
        placePos.y = Math.floor(hit.point.y) + BLOCK_SIZE / 2;
      } else {
        // Place adjacent to existing block
        const worldNormal = normal.clone().transformDirection(hit.object.matrixWorld);
        placePos = this.snapToGrid(
          hit.object.position.clone().add(worldNormal.multiplyScalar(BLOCK_SIZE)),
        );
      }

      this.previewBlock.position.copy(placePos);
      this.previewBlock.visible = true;
    } else {
      // Place in front of player if nothing hit
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const placePos = this.snapToGrid(
        playerPos.clone().add(dir.multiplyScalar(5)),
      );
      this.previewBlock.position.copy(placePos);
      this.previewBlock.visible = true;
    }
  }

  /** Place a block at the preview position */
  placeBlock(): boolean {
    if (!this.previewBlock.visible) return false;

    const key = this.posKey(this.previewBlock.position);
    if (this.blocks.has(key)) return false;

    const mesh = new THREE.Mesh(this.blockGeo, this.blockMats[this.selectedType]);
    mesh.position.copy(this.previewBlock.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    this.blocks.set(key, { mesh, type: this.selectedType });
    return true;
  }

  /** Remove a block the player is looking at */
  removeBlock(camera: THREE.Camera): boolean {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const targets: THREE.Object3D[] = [];
    for (const { mesh } of this.blocks.values()) {
      targets.push(mesh);
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const key = this.posKey(hitMesh.position);
      const block = this.blocks.get(key);
      if (block) {
        this.group.remove(block.mesh);
        this.blocks.delete(key);
        return true;
      }
    }
    return false;
  }

  private snapToGrid(pos: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      Math.round(pos.x / BLOCK_SIZE) * BLOCK_SIZE,
      Math.round(pos.y / BLOCK_SIZE) * BLOCK_SIZE,
      Math.round(pos.z / BLOCK_SIZE) * BLOCK_SIZE,
    );
  }

  private posKey(pos: THREE.Vector3): string {
    return `${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`;
  }

  get blockTypes(): BlockType[] {
    return BLOCK_TYPES;
  }
}
