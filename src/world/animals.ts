import * as THREE from 'three';
import { getTerrainHeightCached, HALF_WORLD } from './terrain';

const DEER_COUNT = 60;
const RABBIT_COUNT = 100;
const BIRD_COUNT = 80;
const FISH_COUNT = 120;
const TURTLE_COUNT = 40;
const JELLYFISH_COUNT = 50;

const WATER_LEVEL = -0.5;
const WANDER_SPEED_SLOW = 1.5;
const WANDER_SPEED_FAST = 3.5;

interface Animal {
  x: number;
  y: number;
  z: number;
  scale: number;
  heading: number;
  speed: number;
  wanderTimer: number;
  wanderInterval: number;
  baseY: number;
  accum: number;
}

function createDeerGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.CylinderGeometry(0.3, 0.35, 1.2, 6);
  body.rotateZ(Math.PI / 2);
  body.translate(0, 0.8, 0);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.22, 5, 4);
  head.translate(0.7, 1.05, 0);
  geos.push(head);

  // Snout
  const snout = new THREE.CylinderGeometry(0.08, 0.1, 0.2, 4);
  snout.rotateZ(Math.PI / 2);
  snout.translate(0.9, 0.98, 0);
  geos.push(snout);

  // Legs
  for (const xOff of [-0.3, 0.3]) {
    for (const zOff of [-0.15, 0.15]) {
      const leg = new THREE.CylinderGeometry(0.06, 0.05, 0.7, 4);
      leg.translate(xOff, 0.35, zOff);
      geos.push(leg);
    }
  }

  // Antlers
  for (const side of [-1, 1]) {
    const antler = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 3);
    antler.translate(0.65, 1.35, side * 0.12);
    antler.rotateX(side * 0.3);
    geos.push(antler);
    const branch = new THREE.CylinderGeometry(0.015, 0.02, 0.2, 3);
    branch.rotateZ(side * 0.6);
    branch.translate(0.6, 1.5, side * 0.15);
    geos.push(branch);
  }

  // Tail
  const tail = new THREE.SphereGeometry(0.08, 4, 3);
  tail.translate(-0.65, 0.9, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createRabbitGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.2, 5, 4);
  body.scale(1, 0.8, 1.2);
  body.translate(0, 0.25, 0);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.14, 5, 4);
  head.translate(0.2, 0.38, 0);
  geos.push(head);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 4);
    ear.translate(0.18, 0.55, side * 0.06);
    geos.push(ear);
  }

  // Tail puff
  const tail = new THREE.SphereGeometry(0.06, 4, 3);
  tail.translate(-0.22, 0.28, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createBirdGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.12, 5, 4);
  body.scale(1, 0.8, 1.4);
  geos.push(body);

  // Head
  const head = new THREE.SphereGeometry(0.08, 4, 3);
  head.translate(0.15, 0.06, 0);
  geos.push(head);

  // Beak
  const beak = new THREE.ConeGeometry(0.03, 0.1, 3);
  beak.rotateZ(-Math.PI / 2);
  beak.translate(0.25, 0.04, 0);
  geos.push(beak);

  // Wings
  for (const side of [-1, 1]) {
    const wing = new THREE.BoxGeometry(0.02, 0.06, 0.25);
    wing.translate(0, 0.02, side * 0.18);
    geos.push(wing);
  }

  // Tail
  const tail = new THREE.BoxGeometry(0.02, 0.04, 0.1);
  tail.translate(-0.16, 0, 0);
  geos.push(tail);

  return mergeGeos(geos);
}

function createFishGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Body
  const body = new THREE.SphereGeometry(0.15, 5, 4);
  body.scale(1.8, 0.7, 0.8);
  geos.push(body);

  // Tail fin
  const tail = new THREE.BoxGeometry(0.02, 0.15, 0.12);
  tail.translate(-0.28, 0, 0);
  geos.push(tail);

  // Dorsal fin
  const dorsal = new THREE.BoxGeometry(0.12, 0.08, 0.02);
  dorsal.translate(0, 0.12, 0);
  geos.push(dorsal);

  return mergeGeos(geos);
}

function createTurtleGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Shell
  const shell = new THREE.SphereGeometry(0.25, 6, 4);
  shell.scale(1.2, 0.5, 1);
  shell.translate(0, 0.1, 0);
  geos.push(shell);

  // Head
  const head = new THREE.SphereGeometry(0.08, 4, 3);
  head.translate(0.28, 0.05, 0);
  geos.push(head);

  // Flippers
  for (const side of [-1, 1]) {
    const flipper = new THREE.BoxGeometry(0.2, 0.03, 0.08);
    flipper.translate(0.05, 0, side * 0.22);
    geos.push(flipper);
  }

  return mergeGeos(geos);
}

function createJellyfishGeometry(): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];

  // Bell
  const bell = new THREE.SphereGeometry(0.2, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  bell.translate(0, 0, 0);
  geos.push(bell);

  // Tentacles
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const tentacle = new THREE.CylinderGeometry(0.01, 0.015, 0.4, 3);
    tentacle.translate(Math.cos(angle) * 0.1, -0.2, Math.sin(angle) * 0.1);
    geos.push(tentacle);
  }

  return mergeGeos(geos);
}

function mergeGeos(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIdx = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIdx += (g.index ? g.index.count : g.attributes.position.count);
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

export class Animals {
  group = new THREE.Group();

  private deerMesh: THREE.InstancedMesh;
  private rabbitMesh: THREE.InstancedMesh;
  private birdMesh: THREE.InstancedMesh;
  private fishMesh: THREE.InstancedMesh;
  private turtleMesh: THREE.InstancedMesh;
  private jellyfishMesh: THREE.InstancedMesh;

  private deerData: Animal[] = [];
  private rabbitData: Animal[] = [];
  private birdData: Animal[] = [];
  private fishData: Animal[] = [];
  private turtleData: Animal[] = [];
  private jellyfishData: Animal[] = [];

  private dummy = new THREE.Object3D();

  constructor() {
    // Deer
    this.deerMesh = this.createAnimalMesh(createDeerGeometry(), 0x8B6B4A, DEER_COUNT);
    this.placeLandAnimals(this.deerMesh, this.deerData, DEER_COUNT, 1.0, 0.8);

    // Rabbits
    this.rabbitMesh = this.createAnimalMesh(createRabbitGeometry(), 0xA89070, RABBIT_COUNT);
    this.placeLandAnimals(this.rabbitMesh, this.rabbitData, RABBIT_COUNT, 0.5, 0.6);

    // Birds
    this.birdMesh = this.createAnimalMesh(createBirdGeometry(), 0xCC4444, BIRD_COUNT);
    this.placeBirds(this.birdMesh, this.birdData, BIRD_COUNT);

    // Fish
    this.fishMesh = this.createAnimalMesh(createFishGeometry(), 0x44AACC, FISH_COUNT);
    this.placeWaterAnimals(this.fishMesh, this.fishData, FISH_COUNT, -1, -8);

    // Turtles
    this.turtleMesh = this.createAnimalMesh(createTurtleGeometry(), 0x556B2F, TURTLE_COUNT);
    this.placeWaterAnimals(this.turtleMesh, this.turtleData, TURTLE_COUNT, -0.5, -4);

    // Jellyfish
    const jfMat = new THREE.MeshStandardMaterial({
      color: 0xDD88FF,
      emissive: 0x550088,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.7,
    });
    this.jellyfishMesh = new THREE.InstancedMesh(createJellyfishGeometry(), jfMat, JELLYFISH_COUNT);
    this.placeWaterAnimals(this.jellyfishMesh, this.jellyfishData, JELLYFISH_COUNT, -2, -10);
    this.group.add(this.jellyfishMesh);
  }

  private createAnimalMesh(geo: THREE.BufferGeometry, color: number, count: number): THREE.InstancedMesh {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (mesh.instanceColor) mesh.instanceColor.setUsage(THREE.StaticDrawUsage);
    this.group.add(mesh);
    return mesh;
  }

  private placeLandAnimals(mesh: THREE.InstancedMesh, data: Animal[], count: number, scale: number, scaleVariance: number) {
    let placed = 0;
    for (let i = 0; i < count * 5 && placed < count; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.5;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.5;
      const h = getTerrainHeightCached(x, z);
      if (h < 1 || h > 25) continue;

      const s = scale * (scaleVariance + Math.random() * (1 - scaleVariance));
      const heading = Math.random() * Math.PI * 2;

      this.dummy.position.set(x, h, z);
      this.dummy.scale.setScalar(s);
      this.dummy.rotation.set(0, heading, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(placed, this.dummy.matrix);

      data.push({
        x,
        y: h,
        z,
        scale: s,
        heading,
        speed: WANDER_SPEED_SLOW + Math.random() * 1.5,
        wanderTimer: Math.random() * 5,
        wanderInterval: 3 + Math.random() * 5,
        baseY: h,
        accum: Math.random() * 0.1,
      });

      // Color variation
      const c = new THREE.Color((mesh.material as THREE.MeshStandardMaterial).color);
      c.offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.1);
      mesh.setColorAt(placed, c);

      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private placeBirds(mesh: THREE.InstancedMesh, data: Animal[], count: number) {
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.5;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.5;
      const h = getTerrainHeightCached(x, z);
      const flyH = Math.max(h, 5) + 5 + Math.random() * 20;
      const heading = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.5;

      this.dummy.position.set(x, flyH, z);
      this.dummy.scale.setScalar(s);
      this.dummy.rotation.set(0, heading, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);

      data.push({
        x,
        y: flyH,
        z,
        scale: s,
        heading,
        speed: WANDER_SPEED_FAST + Math.random() * 2,
        wanderTimer: Math.random() * 4,
        wanderInterval: 2 + Math.random() * 4,
        baseY: flyH,
        accum: Math.random() * 0.1,
      });

      const c = new THREE.Color(0xCC4444);
      c.offsetHSL(Math.random() * 0.3, 0, (Math.random() - 0.5) * 0.15);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private placeWaterAnimals(mesh: THREE.InstancedMesh, data: Animal[], count: number, minDepth: number, maxDepth: number) {
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.6;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.6;
      const h = getTerrainHeightCached(x, z);
      if (h > WATER_LEVEL) continue; // Must be underwater

      const depth = minDepth + Math.random() * (maxDepth - minDepth);
      const heading = Math.random() * Math.PI * 2;
      const s = 0.6 + Math.random() * 0.8;

      this.dummy.position.set(x, depth, z);
      this.dummy.scale.setScalar(s);
      this.dummy.rotation.set(0, heading, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(placed, this.dummy.matrix);

      data.push({
        x,
        y: depth,
        z,
        scale: s,
        heading,
        speed: WANDER_SPEED_SLOW + Math.random() * 1.0,
        wanderTimer: Math.random() * 6,
        wanderInterval: 4 + Math.random() * 6,
        baseY: depth,
        accum: Math.random() * 0.1,
      });

      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, time: number, playerPos: THREE.Vector3) {
    const px = playerPos.x;
    const pz = playerPos.z;
    this.updateGroup(this.deerMesh, this.deerData, dt, time, px, pz, 'land');
    this.updateGroup(this.rabbitMesh, this.rabbitData, dt, time, px, pz, 'land');
    this.updateGroup(this.birdMesh, this.birdData, dt, time, px, pz, 'bird');
    this.updateGroup(this.fishMesh, this.fishData, dt, time, px, pz, 'water');
    this.updateGroup(this.turtleMesh, this.turtleData, dt, time, px, pz, 'water');
    this.updateGroup(this.jellyfishMesh, this.jellyfishData, dt, time, px, pz, 'jellyfish');
  }

  private updateGroup(
    mesh: THREE.InstancedMesh,
    data: Animal[],
    dt: number,
    time: number,
    playerX: number,
    playerZ: number,
    type: 'land' | 'bird' | 'water' | 'jellyfish',
  ) {
    // Far-away updates can run at a lower tick rate without being noticeable.
    // Use accumulated dt so overall movement speed stays consistent.
    const nearSq = 70 * 70;
    const midSq = 160 * 160;
    const farSq = 320 * 320;

    let dirty = false;
    for (let i = 0; i < mesh.count; i++) {
      const a = data[i];
      const dxp = playerX - a.x;
      const dzp = playerZ - a.z;
      const distSq = dxp * dxp + dzp * dzp;

      let interval = 0;
      if (distSq > farSq) interval = 0.25;       // 4 Hz
      else if (distSq > midSq) interval = 1 / 12; // 12 Hz
      else if (distSq > nearSq) interval = 1 / 30; // 30 Hz

      let stepDt = dt;
      if (interval > 0) {
        a.accum += dt;
        if (a.accum < interval) continue;
        stepDt = Math.min(a.accum, 0.25);
        a.accum = 0;
      }

      // Wander: change direction periodically
      a.wanderTimer += stepDt;
      if (a.wanderTimer >= a.wanderInterval) {
        a.wanderTimer = 0;
        a.heading += (Math.random() - 0.5) * Math.PI * 1.2;
        a.wanderInterval = 2 + Math.random() * 6;
      }

      // Move forward
      const moveX = Math.sin(a.heading) * a.speed * stepDt;
      const moveZ = Math.cos(a.heading) * a.speed * stepDt;
      a.x += moveX;
      a.z += moveZ;

      // Keep in world bounds
      const worldR = HALF_WORLD * 0.85;
      const worldRSq = worldR * worldR;
      const dSq = a.x * a.x + a.z * a.z;
      if (dSq > worldRSq) {
        a.heading += Math.PI;
        a.x -= moveX * 2;
        a.z -= moveZ * 2;
      }

      // Height behavior
      if (type === 'land') {
        const th = getTerrainHeightCached(a.x, a.z);
        if (th < 0.5) {
          a.heading += Math.PI * 0.5;
        } else {
          a.y = th;
        }
      } else if (type === 'bird') {
        // Gentle bobbing in air
        a.y = a.baseY + Math.sin(time * 1.5 + i * 2) * 1.5;
      } else if (type === 'water') {
        // Swim with gentle vertical undulation
        a.y = a.baseY + Math.sin(time * 0.8 + i * 1.3) * 0.5;
      } else if (type === 'jellyfish') {
        // Pulsing up and down
        a.y = a.baseY + Math.sin(time * 0.5 + i * 0.7) * 2;
      }

      this.dummy.position.set(a.x, a.y, a.z);
      this.dummy.scale.setScalar(a.scale);
      this.dummy.rotation.set(0, a.heading, 0);

      // Birds tilt when turning
      if (type === 'bird') {
        this.dummy.rotation.z = Math.sin(time * 2 + i) * 0.15;
      }

      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      dirty = true;
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true;
  }
}
