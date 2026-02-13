import * as THREE from 'three';
import { ThirdPersonCamera } from './third-person';
import { FirstPersonCamera } from './first-person';

export type CameraMode = 'third-person' | 'first-person';

export class CameraSystem {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'third-person';
  thirdPerson: ThirdPersonCamera;
  firstPerson: FirstPersonCamera;
  private transitioning = false;
  private transitionT = 0;
  private shakeIntensity = 0;
  private shakeDecay = 8;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.thirdPerson = new ThirdPersonCamera(this.camera);
    this.firstPerson = new FirstPersonCamera(this.camera);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  toggle() {
    this.mode = this.mode === 'third-person' ? 'first-person' : 'third-person';
    // Sync yaw between modes
    if (this.mode === 'first-person') {
      this.firstPerson.yaw = 0;
      this.firstPerson.pitch = 0;
    }
  }

  applyInput(mouseDelta: THREE.Vector2, scrollDelta: number) {
    if (this.mode === 'third-person') {
      this.thirdPerson.applyInput(mouseDelta, scrollDelta);
    } else {
      this.firstPerson.applyInput(mouseDelta);
    }
  }

  shake(intensity: number) {
    this.shakeIntensity = intensity;
  }

  update(dt: number, targetPos: THREE.Vector3, heading: number) {
    if (this.mode === 'third-person') {
      this.thirdPerson.update(dt, targetPos);
    } else {
      this.firstPerson.update(targetPos, heading);
    }

    // Apply camera shake
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.camera.position.z += (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
    }
  }

  get cameraYaw(): number {
    return this.mode === 'third-person'
      ? this.thirdPerson.cameraYaw
      : this.firstPerson.cameraYaw;
  }
}
