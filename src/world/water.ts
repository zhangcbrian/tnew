import * as THREE from 'three';
import { HALF_WORLD } from './terrain';

export class Water {
  mesh: THREE.Mesh;

  constructor() {
    const geometry = new THREE.PlaneGeometry(HALF_WORLD * 2.8, HALF_WORLD * 2.8);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
      color: 0x3a7ca5,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.y = -0.5;
    this.mesh.receiveShadow = true;
  }

  update(time: number) {
    // Gentle bob
    this.mesh.position.y = -0.5 + Math.sin(time * 0.5) * 0.15;
  }
}
