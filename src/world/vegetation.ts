import * as THREE from 'three';
import { octaveNoise } from '../utils/noise';
import { getTerrainHeightCached, getSurrealFactor, HALF_WORLD } from './terrain';

const TREE_COUNT = 3500;
const BUSH_COUNT = 5000;
const ROCK_COUNT = 2500;
const GRASS_COUNT = 12000;

function createTreeGeometry(type: number): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const geometries: THREE.BufferGeometry[] = [];

  if (type === 0) {
    // Conifer
    const trunk = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
    trunk.translate(0, 1, 0);
    geometries.push(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.ConeGeometry(1.2 - i * 0.3, 1.5, 6);
      cone.translate(0, 2.5 + i * 1.0, 0);
      geometries.push(cone);
    }
  } else if (type === 1) {
    // Round tree
    const trunk = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6);
    trunk.translate(0, 1.25, 0);
    geometries.push(trunk);
    const canopy = new THREE.SphereGeometry(1.5, 6, 5);
    canopy.translate(0, 3.5, 0);
    geometries.push(canopy);
  } else if (type === 2) {
    // Birch-like
    const trunk = new THREE.CylinderGeometry(0.1, 0.15, 3, 6);
    trunk.translate(0, 1.5, 0);
    geometries.push(trunk);
    const canopy = new THREE.SphereGeometry(1.0, 5, 4);
    canopy.scale(1, 1.3, 1);
    canopy.translate(0, 3.8, 0);
    geometries.push(canopy);
  } else {
    // Mushroom tree (surreal)
    const trunk = new THREE.CylinderGeometry(0.3, 0.2, 3, 6);
    trunk.translate(0, 1.5, 0);
    geometries.push(trunk);
    const cap = new THREE.SphereGeometry(1.8, 7, 4);
    cap.scale(1, 0.4, 1);
    cap.translate(0, 3.5, 0);
    geometries.push(cap);
  }

  return mergeGeometries(geometries);
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Simple merge: combine all positions, normals into one buffer
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIndices += (g.index ? g.index.count : g.attributes.position.count);
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices: number[] = [];
  let vertOffset = 0;
  let idxOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);
      if (nor) {
        normals[(vertOffset + i) * 3] = nor.getX(i);
        normals[(vertOffset + i) * 3 + 1] = nor.getY(i);
        normals[(vertOffset + i) * 3 + 2] = nor.getZ(i);
      }
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.getX(i) + vertOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + vertOffset);
      }
    }
    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(indices);
  return merged;
}

function createBushGeometry(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.6, 5, 4);
  g.scale(1, 0.7, 1);
  g.translate(0, 0.3, 0);
  return g;
}

function createRockGeometry(): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.5, 0);
  g.scale(1, 0.6, 0.9);
  g.translate(0, 0.2, 0);
  return g;
}

function createGrassGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.08, 0.5, 3);
  g.translate(0, 0.25, 0);
  return g;
}

export class Vegetation {
  group = new THREE.Group();

  constructor() {
    this.generateTrees();
    this.generateBushes();
    this.generateRocks();
    this.generateGrass();
  }

  private generateTrees() {
    const treeTypes = 4;
    const countPerType = Math.ceil(TREE_COUNT / treeTypes);

    for (let t = 0; t < treeTypes; t++) {
      const geometry = createTreeGeometry(t);
      const isSurreal = t === 3;

      // Colors based on type
      let color: THREE.Color;
      if (t === 0) color = new THREE.Color(0x2d5a27);
      else if (t === 1) color = new THREE.Color(0x3a7a32);
      else if (t === 2) color = new THREE.Color(0x5a9a3a);
      else color = new THREE.Color(0xcc44cc);

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.8,
        metalness: 0.05,
        flatShading: true,
      });

      if (isSurreal) {
        material.emissive = new THREE.Color(0x440044);
        material.emissiveIntensity = 0.3;
      }

      const instancedMesh = new THREE.InstancedMesh(geometry, material, countPerType);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < countPerType * 3 && placed < countPerType; i++) {
        const x = (Math.random() - 0.5) * HALF_WORLD * 1.8;
        const z = (Math.random() - 0.5) * HALF_WORLD * 1.8;
        const surreal = getSurrealFactor(x, z);

        // Only place surreal trees in surreal zones and vice versa
        if (isSurreal && surreal < 0.3) continue;
        if (!isSurreal && surreal > 0.7) continue;

        const density = octaveNoise(x, z, 2, 0.5, 2, 0.015);
        if (density < 0.1) continue;

        const h = getTerrainHeightCached(x, z);
        if (h < 1 || h > 25) continue;

        dummy.position.set(x, h, z);
        const scale = 0.7 + Math.random() * 0.8;
        dummy.scale.setScalar(scale);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(placed, dummy.matrix);

        // Tint individual instances
        if (!isSurreal) {
          const tint = new THREE.Color(color);
          tint.offsetHSL(
            (Math.random() - 0.5) * 0.05 + surreal * 0.3,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
          );
          instancedMesh.setColorAt(placed, tint);
        }

        placed++;
      }

      instancedMesh.count = placed;
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      this.group.add(instancedMesh);
    }
  }

  private generateBushes() {
    const geometry = createBushGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a6a2f,
      roughness: 0.9,
      flatShading: true,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, BUSH_COUNT);
    mesh.castShadow = true;
    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < BUSH_COUNT * 3 && placed < BUSH_COUNT; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.8;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.8;
      const h = getTerrainHeightCached(x, z);
      if (h < 0.5 || h > 20) continue;

      dummy.position.set(x, h, z);
      dummy.scale.setScalar(0.5 + Math.random() * 1.0);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);

      const surreal = getSurrealFactor(x, z);
      const c = new THREE.Color(0x3a6a2f);
      c.offsetHSL(surreal * 0.4, 0, (Math.random() - 0.5) * 0.1);
      mesh.setColorAt(placed, c);

      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  private generateRocks() {
    const geometry = createRockGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x888899,
      roughness: 0.95,
      flatShading: true,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, ROCK_COUNT);
    mesh.castShadow = true;
    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < ROCK_COUNT * 3 && placed < ROCK_COUNT; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.8;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.8;
      const h = getTerrainHeightCached(x, z);
      if (h < 0) continue;

      dummy.position.set(x, h, z);
      dummy.scale.set(0.3 + Math.random() * 1.2, 0.3 + Math.random() * 0.8, 0.3 + Math.random() * 1.2);
      dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.3);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  private generateGrass() {
    const geometry = createGrassGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a8c3f,
      roughness: 0.9,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, GRASS_COUNT);
    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < GRASS_COUNT * 2 && placed < GRASS_COUNT; i++) {
      const x = (Math.random() - 0.5) * HALF_WORLD * 1.6;
      const z = (Math.random() - 0.5) * HALF_WORLD * 1.6;
      const h = getTerrainHeightCached(x, z);
      if (h < 0.5 || h > 15) continue;

      dummy.position.set(x, h, z);
      dummy.scale.set(0.8 + Math.random(), 0.5 + Math.random() * 1.5, 0.8 + Math.random());
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);

      const surreal = getSurrealFactor(x, z);
      const c = new THREE.Color(0x4a8c3f);
      c.offsetHSL(surreal * 0.3, 0, (Math.random() - 0.5) * 0.05);
      mesh.setColorAt(placed, c);

      placed++;
    }

    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }
}
