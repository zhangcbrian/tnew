import * as THREE from 'three';
import { clamp } from '../utils/math-helpers';

export class FirstPersonCamera {
  yaw = 0;
  pitch = 0;
  private lookDir = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  applyInput(mouseDelta: THREE.Vector2) {
    this.yaw -= mouseDelta.x * 0.003;
    this.pitch = clamp(this.pitch - mouseDelta.y * 0.003, -1.2, 1.0);
  }

  update(headPos: THREE.Vector3, heading: number) {
    this.camera.position.set(headPos.x, headPos.y + 0.8, headPos.z);

    // Look direction
    this.lookDir.set(
      Math.sin(this.yaw + heading) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw + heading) * Math.cos(this.pitch),
    );

    this.camera.lookAt(
      this.camera.position.x + this.lookDir.x,
      this.camera.position.y + this.lookDir.y,
      this.camera.position.z + this.lookDir.z,
    );
  }

  get cameraYaw(): number {
    return this.yaw;
  }
}
