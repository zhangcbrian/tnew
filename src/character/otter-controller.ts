import * as THREE from 'three';
import { Wings } from './wings';
import { Animator } from './animator';
import { buildCharacter, DEFAULT_CHOICE, type CharacterChoice } from './character';
import { getTerrainHeightCached } from '../world/terrain';
import { damp, dampAngle } from '../utils/math-helpers';
import { disposeObject } from '../utils/dispose';
import { type BlockQuery, NO_BLOCKS } from '../world/block-query';

export type OtterState = 'IDLE' | 'WALK' | 'FLY' | 'FALL' | 'GAME_OVER';

const WALK_SPEED = 8;
const FLY_SPEED = 30;
const GRAVITY = 20;
const FLY_ASCEND_SPEED = 16;
const FLY_DESCEND_SPEED = 12;
const FALL_ACCEL = 15;
const MAX_FALL_SPEED = 60;
const TURN_SPEED = 8;
// Collision box against placed blocks
const HALF_WIDTH = 0.4;
const BODY_HEIGHT = 1.2;
/** Walking automatically climbs onto anything this high or lower. */
const STEP_UP = 0.5;

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

  private animator!: Animator;
  /** For working out climb and turn rates between frames */
  private lastY = 0;
  private lastHeading = 0;

  // Expose for camera
  get position(): THREE.Vector3 {
    return this.model.position;
  }

  constructor() {
    this.model = new THREE.Group();
    this.model.name = 'player';
    this.wings = this.attach(DEFAULT_CHOICE);

    this.model.position.set(0, getTerrainHeightCached(0, 0) + 0.1, 0);
  }

  /** Replace the player's animal, wings and colors, keeping position and state. */
  setCharacter(choice: CharacterChoice) {
    disposeObject(this.model);
    this.wings.dispose();
    this.model.clear();
    this.wings = this.attach(choice);
  }

  private attach(choice: CharacterChoice): Wings {
    const built = buildCharacter(choice.animal, choice.wings, choice.colors);
    this.model.add(built.group);

    this.animator = new Animator(built.rig, built.wings);

    return built.wings!;
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
    blocks: BlockQuery = NO_BLOCKS,
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

    // Position: move one axis at a time so walking into a block slides along it.
    // If we're somehow already overlapping a block, let any move through so we can get out.
    const pos = this.model.position;
    const stuck = this.bodyHits(blocks, pos.x, pos.y, pos.z);
    const nx = pos.x + this.velocity.x * dt;
    if (stuck || this.canMoveTo(blocks, nx, pos.z, pos.y, isFlying)) {
      pos.x = nx;
    } else {
      this.velocity.x = 0;
    }
    const nz = pos.z + this.velocity.z * dt;
    if (stuck || this.canMoveTo(blocks, pos.x, nz, pos.y, isFlying)) {
      pos.z = nz;
    } else {
      this.velocity.z = 0;
    }

    // Height: the ground is the terrain or the top of a block we're standing on
    const terrainH = this.groundAt(blocks, pos.x, pos.z, pos.y);

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
        const newY = damp(pos.y, this.flyHeight, 6, dt);
        // Flying up into the underside of a block stops the climb
        if (newY > pos.y && blocks.boxHits(pos.x - HALF_WIDTH, newY, pos.z - HALF_WIDTH, pos.x + HALF_WIDTH, newY + BODY_HEIGHT, pos.z + HALF_WIDTH)) {
          this.flyHeight = pos.y;
        } else {
          pos.y = newY;
        }
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

    // Animations
    this.animate(this.time, dt);
  }

  /** Terrain height, or the top of a block low enough to step onto from height y. */
  private groundAt(blocks: BlockQuery, x: number, z: number, y: number): number {
    return Math.max(getTerrainHeightCached(x, z), this.blockSupport(blocks, x, z, y + STEP_UP));
  }

  /** Does the body, standing at height y, overlap a block? */
  private bodyHits(blocks: BlockQuery, x: number, y: number, z: number): boolean {
    return blocks.boxHits(x - HALF_WIDTH, y + 0.05, z - HALF_WIDTH, x + HALF_WIDTH, y + BODY_HEIGHT, z + HALF_WIDTH);
  }

  /**
   * Can the body move to (x, z)? Walking checks at the height it would end up at there
   * (after climbing a slope or a small step), so we never get pushed up into a roof.
   */
  private canMoveTo(blocks: BlockQuery, x: number, z: number, y: number, flying: boolean): boolean {
    const bodyY = flying ? y : Math.max(y, this.groundAt(blocks, x, z, y));
    return !this.bodyHits(blocks, x, bodyY, z);
  }

  /** Highest block top under any corner of the player's footprint (at or below maxY). */
  private blockSupport(blocks: BlockQuery, x: number, z: number, maxY: number): number {
    let best = -Infinity;
    for (const dx of [-HALF_WIDTH, HALF_WIDTH]) {
      for (const dz of [-HALF_WIDTH, HALF_WIDTH]) {
        best = Math.max(best, blocks.supportHeight(x + dx, z + dz, maxY));
      }
    }
    return best;
  }

  /** Does the player's body overlap this box? Used to refuse placing a block on them. */
  overlaps(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const p = this.model.position;
    return p.x + HALF_WIDTH > minX && p.x - HALF_WIDTH < maxX
      && p.y + BODY_HEIGHT > minY && p.y < maxY
      && p.z + HALF_WIDTH > minZ && p.z - HALF_WIDTH < maxZ;
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

  private animate(_time: number, dt: number) {
    // Climb and turn rates drive flight posture (pitch, banking)
    const climb = dt > 0 ? (this.model.position.y - this.lastY) / dt : 0;
    let dh = this.heading - this.lastHeading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh)); // wrap so crossing ±π isn't a full spin
    const turn = dt > 0 ? dh / dt : 0;
    this.lastY = this.model.position.y;
    this.lastHeading = this.heading;
    const speed = Math.hypot(this.velocity.x, this.velocity.z) / WALK_SPEED;
    this.animator.update(dt, this.time, { speed, flying: this.state === 'FLY', climb, turn });
  }

  private animateIdle(_time: number) {
    this.animator.update(1 / 60, this.time, { speed: 0, flying: false, climb: 0, turn: 0 });
  }
}
