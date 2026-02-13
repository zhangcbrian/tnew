import * as THREE from 'three';
import { getTerrainHeightCached, getSurrealFactor, HALF_WORLD } from './terrain';

const FLOATING_COUNT = 800;
const CRYSTAL_COUNT = 500;

export class SurrealZone {
  group = new THREE.Group();
  private floatingShapes: THREE.InstancedMesh;
  private crystals: THREE.InstancedMesh;
  private time = 0;
  private floatingBaseY: Float32Array;
  private floatingX: Float32Array;
  private floatingZ: Float32Array;
  private floatingScale: Float32Array;
  private floatingRotSeed: Float32Array;
  private floatingRotSpeed: Float32Array;

  private readonly dummy = new THREE.Object3D();

  constructor() {
    // Floating geometric shapes
    const shapes = [
      new THREE.OctahedronGeometry(1, 0),
      new THREE.TetrahedronGeometry(1, 0),
      new THREE.IcosahedronGeometry(1, 0),
    ];
    const shapeGeo = shapes[0]; // We'll vary with instances

    const floatMat = new THREE.MeshStandardMaterial({
      color: 0xaa55ff,
      emissive: 0x331166,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.5,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    });

    this.floatingShapes = new THREE.InstancedMesh(shapeGeo, floatMat, FLOATING_COUNT);
    this.floatingShapes.castShadow = true;
    this.floatingShapes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floatingBaseY = new Float32Array(FLOATING_COUNT);
    this.floatingX = new Float32Array(FLOATING_COUNT);
    this.floatingZ = new Float32Array(FLOATING_COUNT);
    this.floatingScale = new Float32Array(FLOATING_COUNT);
    this.floatingRotSeed = new Float32Array(FLOATING_COUNT);
    this.floatingRotSpeed = new Float32Array(FLOATING_COUNT);

    let placed = 0;

    for (let i = 0; i < FLOATING_COUNT * 4 && placed < FLOATING_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = HALF_WORLD * (0.55 + Math.random() * 0.35);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (getSurrealFactor(x, z) < 0.3) continue;

      const h = getTerrainHeightCached(x, z);
      const floatHeight = h + 3 + Math.random() * 12;

      const scale = 0.3 + Math.random() * 1.5;
      this.floatingX[placed] = x;
      this.floatingZ[placed] = z;
      this.floatingScale[placed] = scale;
      this.floatingBaseY[placed] = floatHeight;
      this.floatingRotSeed[placed] = Math.random() * Math.PI * 2;
      this.floatingRotSpeed[placed] = 0.3 + (placed % 5) * 0.1;

      this.dummy.position.set(x, floatHeight, z);
      this.dummy.scale.setScalar(scale);
      this.dummy.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      this.dummy.updateMatrix();
      this.floatingShapes.setMatrixAt(placed, this.dummy.matrix);

      // Varied colors
      const hue = Math.random();
      const c = new THREE.Color().setHSL(hue, 0.8, 0.6);
      this.floatingShapes.setColorAt(placed, c);

      placed++;
    }

    this.floatingShapes.count = placed;
    this.floatingShapes.instanceMatrix.needsUpdate = true;
    if (this.floatingShapes.instanceColor) this.floatingShapes.instanceColor.needsUpdate = true;

    // Crystals sticking out of ground
    const crystalGeo = new THREE.ConeGeometry(0.4, 2.5, 5);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x00ddff,
      emissive: 0x004466,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 0.8,
    });

    this.crystals = new THREE.InstancedMesh(crystalGeo, crystalMat, CRYSTAL_COUNT);
    this.crystals.castShadow = true;
    this.crystals.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    placed = 0;
    for (let i = 0; i < CRYSTAL_COUNT * 4 && placed < CRYSTAL_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = HALF_WORLD * (0.5 + Math.random() * 0.4);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (getSurrealFactor(x, z) < 0.25) continue;

      const h = getTerrainHeightCached(x, z);
      if (h < 0) continue;

      this.dummy.position.set(x, h + 0.5, z);
      const scale = 0.5 + Math.random() * 1.5;
      this.dummy.scale.setScalar(scale);
      this.dummy.rotation.set(
        (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.4,
      );
      this.dummy.updateMatrix();
      this.crystals.setMatrixAt(placed, this.dummy.matrix);

      const c = new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.9, 0.6);
      this.crystals.setColorAt(placed, c);

      placed++;
    }

    this.crystals.count = placed;
    this.crystals.instanceMatrix.needsUpdate = true;
    if (this.crystals.instanceColor) this.crystals.instanceColor.needsUpdate = true;

    this.group.add(this.floatingShapes);
    this.group.add(this.crystals);
  }

  update(dt: number) {
    this.time += dt;

    // Animate floating shapes - bob and rotate
    for (let i = 0; i < this.floatingShapes.count; i++) {
      const y = this.floatingBaseY[i] + Math.sin(this.time * 0.8 + i * 0.5) * 1.5;
      const rotSpeed = this.floatingRotSpeed[i];
      const seed = this.floatingRotSeed[i];

      this.dummy.position.set(this.floatingX[i], y, this.floatingZ[i]);
      this.dummy.scale.setScalar(this.floatingScale[i]);
      this.dummy.rotation.set(
        this.time * rotSpeed * 0.5 + seed,
        this.time * rotSpeed + seed * 0.7,
        this.time * rotSpeed * 0.3 + seed * 1.3,
      );
      this.dummy.updateMatrix();
      this.floatingShapes.setMatrixAt(i, this.dummy.matrix);
    }
    this.floatingShapes.instanceMatrix.needsUpdate = true;
  }
}
