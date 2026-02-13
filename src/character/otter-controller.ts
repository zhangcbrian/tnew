import * as THREE from 'three';
import { createOtter } from './otter';
import { Wings } from './wings';
import { getTerrainHeightCached } from '../world/terrain';
import { isOutsideBorder, getBorderRadius } from '../world/cactus-border';
import { damp, dampAngle } from '../utils/math-helpers';

export type OtterState = 'IDLE' | 'WALK' | 'FLY' | 'FALL' | 'GAME_OVER';

const WALK_SPEED = 8;
const FLY_SPEED = 30;
const GRAVITY = 20;
const FLY_ASCEND_SPEED = 16;
const FLY_DESCEND_SPEED = 12;
const FALL_ACCEL = 15;
const MAX_FALL_SPEED = 60;
const TURN_SPEED = 8;

export class OtterController {
  model: THREE.Group;
  wings: Wings;
  state: OtterState = 'IDLE';
  velocity = new THREE.Vector3();
  heading = 0; // Y rotation
  private flyHeight = 0;
  private fallSpeed = 0;
  private fallTime = 0;
  private time = 0;

  private body: THREE.Mesh | null = null;
  private tail: THREE.Mesh | null = null;
  private legFL: THREE.Mesh | null = null;
  private legFR: THREE.Mesh | null = null;
  private legBL: THREE.Mesh | null = null;
  private legBR: THREE.Mesh | null = null;

  // Expose for camera
  get position(): THREE.Vector3 {
    return this.model.position;
  }

  constructor() {
    this.model = createOtter();
    this.wings = new Wings(this.model);

    // Cache frequently-used sub-meshes to avoid per-frame scene graph searches.
    this.body = this.model.getObjectByName('body') as THREE.Mesh | null;
    this.tail = this.model.getObjectByName('tail') as THREE.Mesh | null;
    this.legFL = this.model.getObjectByName('legFL') as THREE.Mesh | null;
    this.legFR = this.model.getObjectByName('legFR') as THREE.Mesh | null;
    this.legBL = this.model.getObjectByName('legBL') as THREE.Mesh | null;
    this.legBR = this.model.getObjectByName('legBR') as THREE.Mesh | null;

    this.model.position.set(0, getTerrainHeightCached(0, 0) + 0.1, 0);
  }

  respawn() {
    this.model.position.set(0, getTerrainHeightCached(0, 0) + 0.1, 0);
    this.model.rotation.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.state = 'IDLE';
    this.fallSpeed = 0;
    this.fallTime = 0;
    this.flyHeight = 0;
    this.heading = 0;
    this.model.visible = true;
  }

  update(
    dt: number,
    moveDir: THREE.Vector2,      // normalized WASD input
    wantFly: boolean,             // space held
    wantDescend: boolean,         // shift held
    cameraYaw: number,            // camera's horizontal angle
  ) {
    this.time += dt;

    if (this.state === 'GAME_OVER') {
      this.animateIdle(this.time);
      return;
    }

    if (this.state === 'FALL') {
      this.updateFalling(dt);
      return;
    }

    // Movement direction relative to camera
    const inputLen = moveDir.length();
    let moveX = 0;
    let moveZ = 0;

    if (inputLen > 0.01) {
      const angle = Math.atan2(moveDir.x, -moveDir.y) + cameraYaw;
      moveX = Math.sin(angle);
      moveZ = Math.cos(angle);
    }

    const isMoving = inputLen > 0.01;
    const isFlying = this.state === 'FLY';

    // State transitions
    if (wantFly && this.state !== 'FLY') {
      this.state = 'FLY';
      this.flyHeight = this.model.position.y + 2;
    } else if (this.state !== 'FLY') {
      if (isMoving && this.state === 'IDLE') {
        this.state = 'WALK';
      } else if (!isMoving && this.state === 'WALK') {
        this.state = 'IDLE';
      }
    }

    // Movement
    const speed = isFlying ? FLY_SPEED : WALK_SPEED;

    if (isMoving) {
      this.velocity.x = damp(this.velocity.x, moveX * speed, 14, dt);
      this.velocity.z = damp(this.velocity.z, moveZ * speed, 14, dt);

      // Turn otter to face movement direction
      const targetHeading = Math.atan2(moveX, moveZ);
      this.heading = dampAngle(this.heading, targetHeading, TURN_SPEED, dt);
    } else {
      this.velocity.x = damp(this.velocity.x, 0, 10, dt);
      this.velocity.z = damp(this.velocity.z, 0, 10, dt);
    }

    // Position
    this.model.position.x += this.velocity.x * dt;
    this.model.position.z += this.velocity.z * dt;

    // Height
    const terrainH = getTerrainHeightCached(this.model.position.x, this.model.position.z);

    if (this.state === 'FLY') {
      if (wantFly) {
        this.flyHeight += FLY_ASCEND_SPEED * dt;
      }
      if (wantDescend) {
        this.flyHeight -= FLY_DESCEND_SPEED * dt;
      }
      // Land when descending to ground level
      const minFlyH = terrainH + 0.5;
      if (this.flyHeight <= minFlyH) {
        this.flyHeight = 0;
        this.state = isMoving ? 'WALK' : 'IDLE';
      } else {
        this.model.position.y = damp(this.model.position.y, this.flyHeight, 6, dt);
      }
    } else {
      // Stick to terrain smoothly - no gravity bounce
      const targetY = terrainH + 0.1;
      this.model.position.y = damp(this.model.position.y, targetY, 18, dt);
      // Hard clamp so we never go below ground
      if (this.model.position.y < targetY) {
        this.model.position.y = targetY;
      }
      this.velocity.y = 0;
    }

    // Rotation
    this.model.rotation.y = this.heading;

    // Check border - bounce back instead of dying
    if (isOutsideBorder(this.model.position.x, this.model.position.z)) {
      const px = this.model.position.x;
      const pz = this.model.position.z;
      const dist = Math.sqrt(px * px + pz * pz);
      const nx = px / dist;
      const nz = pz / dist;

      // Push back inside
      const safeR = getBorderRadius() * 0.95;
      this.model.position.x = nx * safeR;
      this.model.position.z = nz * safeR;

      // Reflect velocity inward
      const bounceStrength = 15;
      this.velocity.x = -nx * bounceStrength;
      this.velocity.z = -nz * bounceStrength;

      // Face toward center
      this.heading = Math.atan2(-nx, -nz);
    }

    // Animations
    this.animate(this.time, dt);
  }

  private updateFalling(dt: number) {
    this.fallTime += dt;
    this.fallSpeed = Math.min(this.fallSpeed + FALL_ACCEL * dt, MAX_FALL_SPEED);
    this.model.position.y -= this.fallSpeed * dt;

    // Spin while falling
    this.model.rotation.x += dt * 2;
    this.model.rotation.z += dt * 1.5;

    // Wing panic
    this.wings.update(this.time + dt * 20, 1.0, true);

    if (this.fallTime > 1.5) {
      this.state = 'GAME_OVER';
    }
  }

  private animate(time: number, _dt: number) {
    const body = this.body;
    const tail = this.tail;
    const legFL = this.legFL;
    const legFR = this.legFR;
    const legBL = this.legBL;
    const legBR = this.legBR;

    switch (this.state) {
      case 'IDLE':
        this.animateIdle(time);
        break;
      case 'WALK':
        // Body bob
        if (body) body.position.y = 0.5 + Math.sin(time * 10) * 0.03;
        // Leg cycle
        if (legFL) legFL.rotation.x = Math.sin(time * 10) * 0.4 + 0.2;
        if (legFR) legFR.rotation.x = Math.sin(time * 10 + Math.PI) * 0.4 + 0.2;
        if (legBL) legBL.rotation.x = Math.sin(time * 10 + Math.PI) * 0.4 - 0.2;
        if (legBR) legBR.rotation.x = Math.sin(time * 10) * 0.4 - 0.2;
        if (tail) tail.rotation.z = Math.sin(time * 6) * 0.2;
        this.wings.update(time, 0.2, false);
        break;
      case 'FLY':
        // Tilt forward
        if (body) body.position.y = 0.5;
        // Legs tucked
        if (legFL) legFL.rotation.x = 0.5;
        if (legFR) legFR.rotation.x = 0.5;
        if (legBL) legBL.rotation.x = -0.5;
        if (legBR) legBR.rotation.x = -0.5;
        if (tail) tail.rotation.z = Math.sin(time * 4) * 0.15;
        this.wings.update(time, 1.0, true);
        break;
      default:
        this.animateIdle(time);
    }
  }

  private animateIdle(time: number) {
    const body = this.body;
    const tail = this.tail;
    if (body) body.position.y = 0.5 + Math.sin(time * 2) * 0.02;
    if (tail) tail.rotation.z = Math.sin(time * 3) * 0.15;
    this.wings.update(time, 0.1, false);
  }
}
