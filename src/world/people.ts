import * as THREE from 'three';
import { getTerrainHeightCached, getSurrealFactor, HALF_WORLD } from './terrain';

const PERSON_COUNT = 230;
const WANDER_SPEED = 1.0;
const CHASE_SPEED = 6.0;
const FLEE_RADIUS = 50;
const FLEE_GRAVITY = 18;
const FLEE_LAUNCH_UP = 55;
const FLEE_LAUNCH_OUT = 3;
const LFOLD_DURATION = 0.6;
const CRUMBLE_DURATION = 1.0;
const DEBRIS_PER_PERSON = 8;
const MAX_DEBRIS = 400;
const DEBRIS_GRAVITY = 12;
const DETECT_RANGE = 40;
const MOUNT_RANGE = 1.5;
const STACK_HEIGHT = 1.4;
const WATER_LEVEL = 0;
const DROWN_TIME = 10;
const DROWNING_ANIM_TIME = 3; // seconds of drowning animation before death

type PersonState = 'WANDER' | 'IDLE' | 'CHASE' | 'RIDING' | 'DROWNING' | 'DEAD' | 'FLEE';

interface Person {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  wanderTimer: number;
  wanderInterval: number;
  idleTimer: number;
  state: PersonState;
  stackSlot: number;
  scale: number;
  underwaterTimer: number;
  drowningTimer: number;
  drowningX: number;
  drowningZ: number;
  drowningY: number;
  accum: number;
  fleeTimer: number;
  fleeDuration: number;
  fleeHeading: number;
  fleeVx: number;
  fleeVy: number;
  fleeVz: number;
  fleePhase: number; // 0 = airborne, 1 = L-fold, 2 = crumble
}

interface Debris {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

function createPersonGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  const head = new THREE.SphereGeometry(0.18, 6, 5);
  head.translate(0, 1.55, 0);
  geos.push(head);

  const torso = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 6);
  torso.translate(0, 1.1, 0);
  geos.push(torso);

  const hips = new THREE.CylinderGeometry(0.22, 0.18, 0.2, 6);
  hips.translate(0, 0.75, 0);
  geos.push(hips);

  for (const side of [-1, 1]) {
    const upperArm = new THREE.CylinderGeometry(0.06, 0.055, 0.35, 4);
    upperArm.translate(side * 0.28, 1.15, 0);
    geos.push(upperArm);

    const lowerArm = new THREE.CylinderGeometry(0.055, 0.05, 0.3, 4);
    lowerArm.translate(side * 0.28, 0.85, 0);
    geos.push(lowerArm);

    const hand = new THREE.SphereGeometry(0.05, 4, 3);
    hand.translate(side * 0.28, 0.68, 0);
    geos.push(hand);
  }

  for (const side of [-1, 1]) {
    const upperLeg = new THREE.CylinderGeometry(0.08, 0.07, 0.4, 5);
    upperLeg.translate(side * 0.1, 0.5, 0);
    geos.push(upperLeg);

    const lowerLeg = new THREE.CylinderGeometry(0.07, 0.06, 0.35, 5);
    lowerLeg.translate(side * 0.1, 0.18, 0);
    geos.push(lowerLeg);

    const foot = new THREE.BoxGeometry(0.1, 0.05, 0.16);
    foot.translate(side * 0.1, 0.02, 0.03);
    geos.push(foot);
  }

  return mergeGeos(geos);
}

function mergeGeos(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vOff = 0;
  for (const g of geometries) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (nor) {
        normals[(vOff + i) * 3] = nor.getX(i);
        normals[(vOff + i) * 3 + 1] = nor.getY(i);
        normals[(vOff + i) * 3 + 2] = nor.getZ(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) indices.push(g.index.getX(i) + vOff);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(i + vOff);
    }
    vOff += pos.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

const PALETTE = [
  0xcc4444, 0x4466aa, 0x44aa66, 0xaa8844, 0x886644,
  0xddaa44, 0x8844aa, 0xdd7744, 0x448888, 0x666666,
];

export class People {
  group = new THREE.Group();

  private mesh: THREE.InstancedMesh;
  private data: Person[] = [];
  /** Ordered list of person indices currently riding, bottom to top */
  private riderStack: number[] = [];

  private debrisMesh: THREE.InstancedMesh;
  private debrisData: Debris[] = [];
  private debrisNext = 0; // ring-buffer index for recycling

  private dummy = new THREE.Object3D();
  private colorTmp = new THREE.Color();

  constructor() {
    const geometry = createPersonGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0xcc8866,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, PERSON_COUNT);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.StaticDrawUsage);

    // Debris particle system
    const debrisGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const debrisMat = new THREE.MeshStandardMaterial({
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, MAX_DEBRIS);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.count = MAX_DEBRIS;
    // Initialise all debris offscreen
    this.dummy.position.set(0, -9999, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let d = 0; d < MAX_DEBRIS; d++) {
      this.debrisMesh.setMatrixAt(d, this.dummy.matrix);
      this.debrisMesh.setColorAt(d, new THREE.Color(0x888888));
      this.debrisData.push({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0, active: false });
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;

    let placed = 0;
    for (let i = 0; i < PERSON_COUNT * 5 && placed < PERSON_COUNT; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.4;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.4;
      const surreal = getSurrealFactor(x, z);
      if (surreal > 0.6) continue;

      const h = getTerrainHeightCached(x, z);
      if (h < 1 || h > 20) continue;

      const heading = Math.random() * Math.PI * 2;
      const scale = 0.8 + Math.random() * 0.4;

      this.dummy.position.set(x, h, z);
      this.dummy.scale.setScalar(scale);
      this.dummy.rotation.set(0, heading, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, this.dummy.matrix);

      const c = new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      c.offsetHSL((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.1);
      this.mesh.setColorAt(placed, c);

      this.data.push({
        x,
        y: h,
        z,
        heading,
        speed: WANDER_SPEED * (0.6 + Math.random() * 0.8),
        wanderTimer: Math.random() * 6,
        wanderInterval: 3 + Math.random() * 5,
        idleTimer: Math.random() * 4,
        state: Math.random() > 0.5 ? 'WANDER' : 'IDLE',
        stackSlot: -1,
        scale,
        underwaterTimer: 0,
        drowningTimer: 0,
        drowningX: 0,
        drowningZ: 0,
        drowningY: 0,
        accum: Math.random() * 0.1,
        fleeTimer: 0,
        fleeDuration: 0,
        fleeHeading: 0,
        fleeVx: 0,
        fleeVy: 0,
        fleeVz: 0,
        fleePhase: 0,
      });

      placed++;
    }

    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);
    this.group.add(this.debrisMesh);
  }

  update(dt: number, time: number, otterPos: THREE.Vector3, otterHeading: number) {
    const detectSq = DETECT_RANGE * DETECT_RANGE;
    const mountSq = MOUNT_RANGE * MOUNT_RANGE;
    const nearSq = 70 * 70;
    const midSq = 160 * 160;
    const farSq = 320 * 320;

    let dirty = false;
    for (let i = 0; i < this.mesh.count; i++) {
      const p = this.data[i];

      if (p.state === 'DEAD') continue;

      if (p.state === 'DROWNING') {
        const dx = otterPos.x - p.drowningX;
        const dz = otterPos.z - p.drowningZ;
        const distSq = dx * dx + dz * dz;

        let interval = 0;
        if (distSq > farSq) interval = 0.25;
        else if (distSq > midSq) interval = 1 / 12;
        else if (distSq > nearSq) interval = 1 / 30;

        let stepDt = dt;
        if (interval > 0) {
          p.accum += dt;
          if (p.accum < interval) continue;
          stepDt = Math.min(p.accum, 0.25);
          p.accum = 0;
        }

        this.updateDrowning(i, p, stepDt, time);
        dirty = true;
        continue;
      }

      if (p.state === 'RIDING') {
        this.updateRiding(i, p, time, otterPos, otterHeading);
        const rideY = otterPos.y + 0.8 + p.stackSlot * STACK_HEIGHT * p.scale;
        if (this.checkDrowning(i, p, dt, rideY, otterPos)) continue;
        dirty = true;
        continue;
      }

      const dx = otterPos.x - p.x;
      const dz = otterPos.z - p.z;
      const distSq = dx * dx + dz * dz;

      // LOD tick rate: always full-rate in/near interactions, otherwise decimate by distance.
      let interval = 0;
      if (p.state === 'CHASE' || distSq <= detectSq) {
        interval = 0;
      } else if (distSq > farSq) interval = 0.25;
      else if (distSq > midSq) interval = 1 / 12;
      else if (distSq > nearSq) interval = 1 / 30;

      let stepDt = dt;
      if (interval > 0) {
        p.accum += dt;
        if (p.accum < interval) continue;
        stepDt = Math.min(p.accum, 0.25);
        p.accum = 0;
      }

      if (this.checkDrowning(i, p, stepDt, p.y, undefined)) continue;

      if (p.state === 'FLEE') {
        this.updateFlee(i, p, stepDt);
        dirty = true;
        continue;
      }

      if (p.state !== 'CHASE' && distSq < detectSq) {
        p.state = 'CHASE';
      }

      if (p.state === 'CHASE') {
        this.updateChase(i, p, stepDt, time, otterPos, otterHeading, distSq, mountSq, dx, dz);
      } else if (p.state === 'WANDER') {
        this.updateWander(i, p, stepDt);
      } else {
        this.updateIdle(i, p, stepDt);
      }
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    this.updateDebris(dt);
  }

  /** Returns true if person just started drowning (caller should skip further updates) */
  private checkDrowning(i: number, p: Person, dt: number, y: number, otterPos: THREE.Vector3 | undefined): boolean {
    if (y < WATER_LEVEL) {
      p.underwaterTimer += dt;
      if (p.underwaterTimer >= DROWN_TIME) {
        this.startDrowning(i, p, otterPos);
        return true;
      }
    } else {
      p.underwaterTimer = 0;
    }
    return false;
  }

  private startDrowning(i: number, p: Person, otterPos: THREE.Vector3 | undefined) {
    const wasRiding = p.state === 'RIDING';
    p.state = 'DROWNING';
    p.drowningTimer = 0;

    if (wasRiding) {
      // Record position at otter before removing from stack
      p.drowningX = otterPos ? otterPos.x : 0;
      p.drowningZ = otterPos ? otterPos.z : 0;
      p.drowningY = otterPos ? otterPos.y + 0.8 + p.stackSlot * STACK_HEIGHT * p.scale : 0;
      this.removeFromStack(i);
    } else {
      // Use current position
      p.drowningX = p.x;
      p.drowningZ = p.z;
      p.drowningY = p.y;
    }
  }

  private removeFromStack(personIdx: number) {
    const idx = this.riderStack.indexOf(personIdx);
    if (idx === -1) return;
    this.riderStack.splice(idx, 1);
    // Reassign slots for all remaining riders so the stack compacts
    for (let s = 0; s < this.riderStack.length; s++) {
      this.data[this.riderStack[s]].stackSlot = s;
    }
  }

  private updateDrowning(i: number, p: Person, dt: number, time: number) {
    p.drowningTimer += dt;

    if (p.drowningTimer >= DROWNING_ANIM_TIME) {
      p.state = 'DEAD';
      this.updateDead(i);
      return;
    }

    const t = p.drowningTimer / DROWNING_ANIM_TIME; // 0 -> 1

    // Bob up and down frantically, sinking over time
    const bobSpeed = 12 - t * 6; // slows down as they weaken
    const bobAmount = 0.3 * (1 - t); // smaller bobs as they sink
    const sinkAmount = t * 2.5; // sink below water
    const y = p.drowningY + Math.sin(time * bobSpeed + i) * bobAmount - sinkAmount;

    // Flail side to side
    const flailX = Math.sin(time * 8 + i * 2) * 0.15 * (1 - t);
    const flailZ = Math.cos(time * 7 + i * 3) * 0.15 * (1 - t);

    // Rock/tilt as they struggle
    const tiltX = Math.sin(time * 6 + i) * 0.5 * (1 - t * 0.5);
    const tiltZ = Math.cos(time * 5 + i * 1.5) * 0.4 * (1 - t * 0.5);

    // Shrink slightly near the end
    const shrink = p.scale * (1 - t * 0.3);

    this.dummy.position.set(
      p.drowningX + flailX,
      y,
      p.drowningZ + flailZ,
    );
    this.dummy.scale.setScalar(shrink);
    this.dummy.rotation.set(tiltX, p.heading, tiltZ);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private updateDead(i: number) {
    this.dummy.position.set(0, -9999, 0);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private updateChase(
    i: number, p: Person, dt: number, time: number,
    otterPos: THREE.Vector3, otterHeading: number,
    distSqToOtter: number, mountSq: number, dx: number, dz: number,
  ) {
    if (distSqToOtter < mountSq) {
      p.state = 'RIDING';
      this.riderStack.push(i);
      p.stackSlot = this.riderStack.length - 1;
      this.updateRiding(i, p, time, otterPos, otterHeading);
      return;
    }

    p.heading = Math.atan2(dx, dz);
    const moveX = Math.sin(p.heading) * CHASE_SPEED * dt;
    const moveZ = Math.cos(p.heading) * CHASE_SPEED * dt;
    p.x += moveX;
    p.z += moveZ;

    const th = getTerrainHeightCached(p.x, p.z);
    if (th >= 0.5) {
      p.y = th;
    }

    this.dummy.position.set(p.x, p.y, p.z);
    this.dummy.scale.setScalar(p.scale);
    this.dummy.rotation.set(0, p.heading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private updateRiding(
    i: number, p: Person, time: number,
    otterPos: THREE.Vector3, otterHeading: number,
  ) {
    const stackY = otterPos.y + 0.8 + p.stackSlot * STACK_HEIGHT * p.scale;

    const swayX = Math.sin(time * 2.0 + p.stackSlot * 0.7) * 0.05 * (p.stackSlot + 1);
    const swayZ = Math.cos(time * 1.7 + p.stackSlot * 1.1) * 0.05 * (p.stackSlot + 1);

    this.dummy.position.set(
      otterPos.x + swayX,
      stackY,
      otterPos.z + swayZ,
    );
    this.dummy.scale.setScalar(p.scale);
    this.dummy.rotation.set(0, otterHeading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  private updateWander(i: number, p: Person, dt: number) {
    const moveX = Math.sin(p.heading) * p.speed * dt;
    const moveZ = Math.cos(p.heading) * p.speed * dt;
    p.x += moveX;
    p.z += moveZ;

    const worldR = HALF_WORLD * 0.65;
    const worldRSq = worldR * worldR;
    const dSq = p.x * p.x + p.z * p.z;
    if (dSq > worldRSq) {
      p.heading += Math.PI;
      p.x -= moveX * 2;
      p.z -= moveZ * 2;
    }

    const th = getTerrainHeightCached(p.x, p.z);
    if (th < 0.5) {
      p.heading += Math.PI * 0.5;
      p.x -= moveX;
      p.z -= moveZ;
    } else {
      p.y = th;
    }

    p.wanderTimer += dt;
    if (p.wanderTimer >= p.wanderInterval) {
      p.wanderTimer = 0;
      p.heading += (Math.random() - 0.5) * Math.PI;
      p.wanderInterval = 3 + Math.random() * 5;
      if (Math.random() < 0.35) {
        p.state = 'IDLE';
        p.idleTimer = 2 + Math.random() * 5;
      }
    }

    this.dummy.position.set(p.x, p.y, p.z);
    this.dummy.scale.setScalar(p.scale);
    this.dummy.rotation.set(0, p.heading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  repelAll(originX: number, originZ: number) {
    const radiusSq = FLEE_RADIUS * FLEE_RADIUS;

    // Dismount all riders first — launch them from their riding position
    while (this.riderStack.length > 0) {
      const riderIdx = this.riderStack.pop()!;
      const rp = this.data[riderIdx];
      rp.stackSlot = -1;
      rp.x = originX + (Math.random() - 0.5) * 2;
      rp.z = originZ + (Math.random() - 0.5) * 2;
      rp.y = getTerrainHeightCached(rp.x, rp.z);
      this.launchPerson(rp, originX, originZ);
    }

    // Launch nearby ground people into the air
    for (let i = 0; i < this.mesh.count; i++) {
      const p = this.data[i];
      if (p.state === 'DEAD' || p.state === 'DROWNING' || p.state === 'FLEE' || p.state === 'RIDING') continue;

      const dx = p.x - originX;
      const dz = p.z - originZ;
      const distSq = dx * dx + dz * dz;
      if (distSq > radiusSq) continue;

      this.launchPerson(p, originX, originZ);
    }
  }

  private launchPerson(p: Person, originX: number, originZ: number) {
    p.state = 'FLEE';
    p.fleePhase = 0; // airborne
    p.fleeTimer = 0;

    const dx = p.x - originX;
    const dz = p.z - originZ;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const nx = dx / dist;
    const nz = dz / dist;

    // Closer to center = stronger blast
    const strength = 1 - Math.min(dist / FLEE_RADIUS, 1);
    const outSpeed = FLEE_LAUNCH_OUT * (0.7 + strength * 0.6);
    const spread = (Math.random() - 0.5) * 0.4;

    p.fleeVx = (nx + spread) * outSpeed;
    p.fleeVz = (nz + spread) * outSpeed;
    p.fleeVy = FLEE_LAUNCH_UP * (0.8 + Math.random() * 0.4);
    p.fleeHeading = Math.atan2(nx, nz);
  }

  private updateFlee(i: number, p: Person, dt: number) {
    if (p.fleePhase === 0) {
      // Phase 0: Airborne arc with gravity
      p.fleeVy -= FLEE_GRAVITY * dt;
      p.x += p.fleeVx * dt;
      p.z += p.fleeVz * dt;
      p.y += p.fleeVy * dt;

      p.fleeTimer += dt;
      const spin = p.fleeTimer * 8;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.scale);
      this.dummy.rotation.set(spin, p.fleeHeading, spin * 0.7);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // Check landing
      const th = getTerrainHeightCached(p.x, p.z);
      if (p.y <= th && p.fleeVy < 0) {
        p.y = th;
        p.fleePhase = 1; // L-fold
        p.fleeTimer = 0;
      }
    } else if (p.fleePhase === 1) {
      // Phase 1: L-fold — body slams and folds forward like an L
      p.fleeTimer += dt;
      const t = Math.min(p.fleeTimer / LFOLD_DURATION, 1);

      // Fold from upright (-PI/2 face-down) to over-folded (-2.6 rad, past vertical)
      const foldAngle = -Math.PI / 2 - t * 1.1;
      // Squash vertically as the body crumples
      const squashY = p.scale * (1 - t * 0.4);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(p.scale, squashY, p.scale);
      this.dummy.rotation.set(foldAngle, p.fleeHeading, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      if (t >= 1) {
        p.fleePhase = 2; // crumble
        p.fleeTimer = 0;
        // Get person's color for debris
        this.mesh.getColorAt(i, this.colorTmp);
        this.spawnDebris(p.x, p.y, p.z, this.colorTmp);
      }
    } else {
      // Phase 2: Crumble — person shrinks to nothing, debris flies
      p.fleeTimer += dt;
      const t = Math.min(p.fleeTimer / CRUMBLE_DURATION, 1);

      const shrink = p.scale * (1 - t);
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(shrink);
      this.dummy.rotation.set(-2.6, p.fleeHeading, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      if (t >= 1) {
        p.state = 'DEAD';
        this.updateDead(i);
      }
    }
  }

  private spawnDebris(x: number, y: number, z: number, color: THREE.Color) {
    for (let j = 0; j < DEBRIS_PER_PERSON; j++) {
      const idx = this.debrisNext;
      this.debrisNext = (this.debrisNext + 1) % MAX_DEBRIS;

      const d = this.debrisData[idx];
      d.active = true;
      d.x = x + (Math.random() - 0.5) * 0.5;
      d.y = y + 0.3 + Math.random() * 0.8;
      d.z = z + (Math.random() - 0.5) * 0.5;
      d.vx = (Math.random() - 0.5) * 6;
      d.vy = 3 + Math.random() * 5;
      d.vz = (Math.random() - 0.5) * 6;
      d.life = 0;
      d.maxLife = 1.5 + Math.random() * 1.0;

      // Slight color variation per chunk
      const c = color.clone();
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
      this.debrisMesh.setColorAt(idx, c);
    }
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
  }

  private updateDebris(dt: number) {
    let dirty = false;
    for (let i = 0; i < MAX_DEBRIS; i++) {
      const d = this.debrisData[i];
      if (!d.active) continue;

      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
        dirty = true;
        continue;
      }

      d.vy -= DEBRIS_GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      // Bounce off ground
      const th = getTerrainHeightCached(d.x, d.z);
      if (d.y < th && d.vy < 0) {
        d.y = th;
        d.vy *= -0.3;
        d.vx *= 0.6;
        d.vz *= 0.6;
      }

      const t = d.life / d.maxLife;
      const size = 0.12 * (1 - t * 0.7); // shrink over time
      const spin = d.life * 10;

      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.scale.setScalar(size / 0.12); // relative to base geo size
      this.dummy.rotation.set(spin, spin * 0.7, spin * 1.3);
      this.dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, this.dummy.matrix);
      dirty = true;
    }
    if (dirty) this.debrisMesh.instanceMatrix.needsUpdate = true;
  }

  private updateIdle(i: number, p: Person, dt: number) {
    p.idleTimer -= dt;
    if (p.idleTimer <= 0) {
      p.state = 'WANDER';
      p.heading += (Math.random() - 0.5) * Math.PI;
      p.wanderTimer = 0;
    }

    this.dummy.position.set(p.x, p.y, p.z);
    this.dummy.scale.setScalar(p.scale);
    this.dummy.rotation.set(0, p.heading, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }
}
