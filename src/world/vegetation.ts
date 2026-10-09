import * as THREE from 'three';
import { CHUNK_SIZE } from './terrain';
import { PLANT_TYPES, type PlantData } from './chunk-gen';

/** Plants are grouped into tiles of TILE×TILE chunks so whole tiles can be skipped when off-screen. */
const TILE = 4;
const TILE_SIZE = TILE * CHUNK_SIZE;
/** Ground cover (grass, heather...) is only drawn when its tile is this close. */
const COVER_DISTANCE = 110;
/** Trees and rocks use full detail this close, a simple shape beyond. */
const NEAR_DISTANCE = 180;
/** Most tiles rebuilt per frame after chunks load or unload. */
const TILE_REBUILDS_PER_FRAME = 4;

interface TileMeshes {
  near: THREE.InstancedMesh;
  far: THREE.InstancedMesh | null;
}

interface Tile {
  tx: number;
  tz: number;
  /** Plant type index -> meshes */
  meshes: Map<number, TileMeshes>;
}

const tileOf = (c: number) => Math.floor(c / TILE);

/**
 * Plants for every landscape. Each chunk's plants arrive ready-made from the chunk workers;
 * they're grouped per tile and plant type into instanced meshes. Each frame, tiles behind the
 * camera are culled by Three.js, ground cover far away is hidden, and far trees and rocks
 * switch to simple shapes.
 */
export class Vegetation {
  group = new THREE.Group();
  private materials: THREE.MeshStandardMaterial[];
  private chunkPlants = new Map<string, PlantData[]>();
  private tiles = new Map<string, Tile>();
  private dirty = new Set<string>();

  constructor() {
    this.materials = PLANT_TYPES.map(() => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  }

  addChunk(cx: number, cz: number, plants: PlantData[]) {
    this.chunkPlants.set(`${cx},${cz}`, plants);
    this.dirty.add(`${tileOf(cx)},${tileOf(cz)}`);
  }

  removeChunk(cx: number, cz: number) {
    if (this.chunkPlants.delete(`${cx},${cz}`)) this.dirty.add(`${tileOf(cx)},${tileOf(cz)}`);
  }

  /** Rebuild changed tiles (a few per frame) and pick each tile's level of detail. */
  update(camera: THREE.Vector3) {
    let budget = TILE_REBUILDS_PER_FRAME;
    for (const key of this.dirty) {
      if (budget-- <= 0) break;
      this.dirty.delete(key);
      this.rebuildTile(key);
    }

    for (const tile of this.tiles.values()) {
      // Distance from the camera to the nearest point of the tile (ground plane)
      const x0 = tile.tx * TILE_SIZE - CHUNK_SIZE / 2;
      const z0 = tile.tz * TILE_SIZE - CHUNK_SIZE / 2;
      const dx = Math.max(x0 - camera.x, 0, camera.x - (x0 + TILE_SIZE));
      const dz = Math.max(z0 - camera.z, 0, camera.z - (z0 + TILE_SIZE));
      const d = Math.sqrt(dx * dx + dz * dz);
      for (const m of tile.meshes.values()) {
        if (m.far) {
          m.near.visible = d < NEAR_DISTANCE;
          m.far.visible = !m.near.visible;
        } else {
          m.near.visible = d < COVER_DISTANCE;
        }
      }
    }
  }

  private rebuildTile(key: string) {
    const [tx, tz] = key.split(',').map(Number);
    const old = this.tiles.get(key);
    if (old) {
      for (const m of old.meshes.values()) {
        this.group.remove(m.near);
        m.near.dispose(); // instance buffers only; geometry and material are shared
        if (m.far) {
          this.group.remove(m.far);
          m.far.dispose();
        }
      }
      this.tiles.delete(key);
    }

    // Gather this tile's chunks' plants by type
    const byType = new Map<number, PlantData[]>();
    for (let cz = tz * TILE; cz < (tz + 1) * TILE; cz++) {
      for (let cx = tx * TILE; cx < (tx + 1) * TILE; cx++) {
        const plants = this.chunkPlants.get(`${cx},${cz}`);
        if (!plants) continue;
        for (const p of plants) {
          if (!byType.has(p.type)) byType.set(p.type, []);
          byType.get(p.type)!.push(p);
        }
      }
    }
    if (byType.size === 0) return;

    const tile: Tile = { tx, tz, meshes: new Map() };
    for (const [t, parts] of byType) {
      const count = parts.reduce((a, p) => a + p.tints.length / 3, 0);
      const matrices = new Float32Array(count * 16);
      const tints = new Float32Array(count * 3);
      let i = 0;
      for (const p of parts) {
        matrices.set(p.matrices, i * 16);
        tints.set(p.tints, i * 3);
        i += p.tints.length / 3;
      }
      const { type } = PLANT_TYPES[t];
      const make = (geo: THREE.BufferGeometry, shadow: boolean) => {
        const mesh = new THREE.InstancedMesh(geo, this.materials[t], count);
        mesh.instanceMatrix = new THREE.InstancedBufferAttribute(matrices, 16);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(tints, 3);
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere(); // lets Three.js skip the tile when it's off-screen
        this.group.add(mesh);
        return mesh;
      };
      tile.meshes.set(t, {
        near: make(type.geo, type.shadow),
        far: type.far ? make(type.far, false) : null,
      });
    }
    this.tiles.set(key, tile);
  }
}
