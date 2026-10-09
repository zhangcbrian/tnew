import * as THREE from 'three';
import { CHUNK_SIZE } from './terrain';

const SIZE = 1400;

export class Water {
  mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.PlaneGeometry(SIZE, SIZE);
    geometry.rotateX(-Math.PI / 2);

    // Dark, peaty loch water
    const material = new THREE.MeshStandardMaterial({
      color: 0x2f4a5a,
      transparent: true,
      opacity: 0.82,
      roughness: 0.12,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = -0.5;
    this.mesh.receiveShadow = true;
  }

  /** Water look of the current landscape (e.g. muddy rivers, icy Arctic lakes). */
  setColor(color: THREE.Color, opacity: number) {
    const m = this.mesh.material as THREE.MeshStandardMaterial;
    m.color.copy(color);
    m.opacity = opacity;
  }

  /** Bob gently and stay under the player (snapped to the chunk grid so it doesn't visibly slide). */
  update(time: number, playerX: number, playerZ: number) {
    this.mesh.position.x = Math.round(playerX / CHUNK_SIZE) * CHUNK_SIZE;
    this.mesh.position.z = Math.round(playerZ / CHUNK_SIZE) * CHUNK_SIZE;
    this.mesh.position.y = -0.5 + Math.sin(time * 0.5) * 0.15;
  }
}
