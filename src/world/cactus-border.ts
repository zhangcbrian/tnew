import * as THREE from 'three';
import { getTerrainHeightCached, HALF_WORLD } from './terrain';

const CACTUS_COUNT = 700;
const BORDER_RADIUS = HALF_WORLD * 0.92;
const BORDER_WIDTH = 15;

function createCactusGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Main trunk
  const trunk = new THREE.CylinderGeometry(0.3, 0.35, 3, 6);
  trunk.translate(0, 1.5, 0);
  geometries.push(trunk);

  // Top dome
  const topDome = new THREE.SphereGeometry(0.3, 5, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  topDome.translate(0, 3, 0);
  geometries.push(topDome);

  // Left arm
  const armL1 = new THREE.CylinderGeometry(0.18, 0.2, 1.0, 5);
  armL1.rotateZ(Math.PI / 2);
  armL1.translate(-0.8, 1.8, 0);
  geometries.push(armL1);

  const armL2 = new THREE.CylinderGeometry(0.16, 0.18, 1.2, 5);
  armL2.translate(-1.3, 2.4, 0);
  geometries.push(armL2);

  const armLDome = new THREE.SphereGeometry(0.16, 4, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  armLDome.translate(-1.3, 3.0, 0);
  geometries.push(armLDome);

  // Right arm (higher)
  const armR1 = new THREE.CylinderGeometry(0.18, 0.2, 0.8, 5);
  armR1.rotateZ(-Math.PI / 2);
  armR1.translate(0.7, 2.2, 0);
  geometries.push(armR1);

  const armR2 = new THREE.CylinderGeometry(0.16, 0.18, 1.5, 5);
  armR2.translate(1.1, 2.95, 0);
  geometries.push(armR2);

  const armRDome = new THREE.SphereGeometry(0.16, 4, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  armRDome.translate(1.1, 3.7, 0);
  geometries.push(armRDome);

  return mergeSimple(geometries);
}

function mergeSimple(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
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
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.getX(i) + vOff);
      }
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

export class CactusBorder {
  mesh: THREE.InstancedMesh;

  constructor() {
    const geometry = createCactusGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x2d6a2e,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, CACTUS_COUNT);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < CACTUS_COUNT; i++) {
      const angle = (i / CACTUS_COUNT) * Math.PI * 2;
      const radiusOffset = (Math.random() - 0.5) * BORDER_WIDTH;
      const r = BORDER_RADIUS + radiusOffset;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const h = getTerrainHeightCached(x, z);

      dummy.position.set(x, h, z);
      const scale = 0.8 + Math.random() * 0.7;
      dummy.scale.setScalar(scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);

      // Slight color variation
      const c = new THREE.Color(0x2d6a2e);
      c.offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      this.mesh.setColorAt(i, c);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export function isOutsideBorder(x: number, z: number): boolean {
  const dSq = x * x + z * z;
  const r = BORDER_RADIUS + BORDER_WIDTH * 0.5;
  return dSq > r * r;
}

export function getBorderRadius(): number {
  return BORDER_RADIUS + BORDER_WIDTH * 0.5;
}
