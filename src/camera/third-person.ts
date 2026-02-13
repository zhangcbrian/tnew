import * as THREE from 'three';
import { clamp, expDampFactor } from '../utils/math-helpers';

export class ThirdPersonCamera {
  yaw = 0;
  pitch = -0.3;
  distance = 6;
  private targetPos = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  applyInput(mouseDelta: THREE.Vector2, scrollDelta: number) {
    // Mouse orbit
    this.yaw -= mouseDelta.x * 0.003;
    this.pitch = clamp(this.pitch - mouseDelta.y * 0.003, -1.2, 0.5);

    // Scroll zoom
    this.distance = clamp(this.distance + scrollDelta * 0.005, 2, 20);
  }

  update(dt: number, target: THREE.Vector3) {
    // Calculate camera position
    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(-this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    this.desiredPos.set(
      target.x + offsetX,
      target.y + 1 + offsetY,
      target.z + offsetZ,
    );

    // Smooth follow
    this.targetPos.lerp(this.desiredPos, expDampFactor(10, dt));
    this.camera.position.copy(this.targetPos);

    // Look at target (slightly above)
    this.lookTarget.copy(target);
    this.lookTarget.y += 0.8;
    this.camera.lookAt(this.lookTarget);
  }

  /** For otter controller: which way the camera faces horizontally */
  get cameraYaw(): number {
    return this.yaw;
  }
}
