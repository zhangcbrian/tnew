import * as THREE from 'three';

const EXPAND_DURATION = 1.2;
const MAX_RADIUS = 50;

export class ShockwaveEffect {
  group = new THREE.Group();

  private ring: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private active = false;
  private elapsed = 0;

  constructor() {
    const geometry = new THREE.TorusGeometry(1, 0.3, 8, 48);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(geometry, this.material);
    this.ring.rotation.x = -Math.PI / 2; // lie flat on XZ plane
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  trigger(x: number, y: number, z: number) {
    this.ring.position.set(x, y + 0.5, z);
    this.ring.scale.setScalar(0.01);
    this.material.opacity = 0.7;
    this.ring.visible = true;
    this.active = true;
    this.elapsed = 0;
  }

  update(dt: number) {
    if (!this.active) return;

    this.elapsed += dt;
    const t = this.elapsed / EXPAND_DURATION;

    if (t >= 1) {
      this.active = false;
      this.ring.visible = false;
      return;
    }

    const scale = t * MAX_RADIUS;
    this.ring.scale.setScalar(scale);
    this.material.opacity = 0.7 * (1 - t);
  }
}
