import * as THREE from 'three';
import { getSurrealFactor } from './terrain';

const RAIN_COUNT = 8000;
const SNOW_COUNT = 4000;
const SPREAD = 120;
const HEIGHT = 80;

export class Weather {
  group = new THREE.Group();
  private rainMesh: THREE.Points;
  private snowMesh: THREE.Points;
  private rainPositions: Float32Array;
  private snowPositions: Float32Array;
  private rainSpeeds: Float32Array;
  private snowSpeeds: Float32Array;
  private intensity = 0;

  constructor() {
    // Rain
    this.rainPositions = new Float32Array(RAIN_COUNT * 3);
    this.rainSpeeds = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * SPREAD;
      this.rainPositions[i * 3 + 1] = Math.random() * HEIGHT;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      this.rainSpeeds[i] = 40 + Math.random() * 30;
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xaaccff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.rainMesh = new THREE.Points(rainGeo, rainMat);
    this.group.add(this.rainMesh);

    // Snow
    this.snowPositions = new Float32Array(SNOW_COUNT * 3);
    this.snowSpeeds = new Float32Array(SNOW_COUNT);
    for (let i = 0; i < SNOW_COUNT; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * SPREAD;
      this.snowPositions[i * 3 + 1] = Math.random() * HEIGHT;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      this.snowSpeeds[i] = 3 + Math.random() * 5;
    }

    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPositions, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    this.snowMesh = new THREE.Points(snowGeo, snowMat);
    this.group.add(this.snowMesh);
  }

  update(dt: number, time: number, playerX: number, playerY: number, playerZ: number) {
    // Weather intensity based on surreal factor (distance from center)
    const surreal = getSurrealFactor(playerX, playerZ);
    this.intensity = surreal;

    // Center particles around the player
    this.group.position.set(playerX, playerY, playerZ);

    // Rain visibility and animation
    const rainMat = this.rainMesh.material as THREE.PointsMaterial;
    rainMat.opacity = this.intensity * 0.7;
    this.rainMesh.visible = this.intensity > 0.05;

    if (this.rainMesh.visible) {
      const windX = Math.sin(time * 0.7) * 8 * this.intensity;
      const windZ = Math.cos(time * 0.5) * 6 * this.intensity;

      for (let i = 0; i < RAIN_COUNT; i++) {
        const speed = this.rainSpeeds[i] * this.intensity;
        this.rainPositions[i * 3] += windX * dt;
        this.rainPositions[i * 3 + 1] -= speed * dt;
        this.rainPositions[i * 3 + 2] += windZ * dt;

        // Reset when below ground
        if (this.rainPositions[i * 3 + 1] < -5) {
          this.rainPositions[i * 3] = (Math.random() - 0.5) * SPREAD;
          this.rainPositions[i * 3 + 1] = HEIGHT * (0.5 + Math.random() * 0.5);
          this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
        }

        // Wrap horizontally
        if (Math.abs(this.rainPositions[i * 3]) > SPREAD * 0.5) {
          this.rainPositions[i * 3] = -Math.sign(this.rainPositions[i * 3]) * SPREAD * 0.5 * Math.random();
        }
        if (Math.abs(this.rainPositions[i * 3 + 2]) > SPREAD * 0.5) {
          this.rainPositions[i * 3 + 2] = -Math.sign(this.rainPositions[i * 3 + 2]) * SPREAD * 0.5 * Math.random();
        }
      }
      (this.rainMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Snow visibility and animation
    const snowMat = this.snowMesh.material as THREE.PointsMaterial;
    snowMat.opacity = this.intensity * 0.9;
    this.snowMesh.visible = this.intensity > 0.1;

    if (this.snowMesh.visible) {
      for (let i = 0; i < SNOW_COUNT; i++) {
        const speed = this.snowSpeeds[i] * this.intensity;
        // Gentle swirl
        const swirl = Math.sin(time * 2 + i * 0.1) * 3 * this.intensity;
        this.snowPositions[i * 3] += swirl * dt;
        this.snowPositions[i * 3 + 1] -= speed * dt;
        this.snowPositions[i * 3 + 2] += Math.cos(time * 1.5 + i * 0.15) * 2 * this.intensity * dt;

        // Reset when below ground
        if (this.snowPositions[i * 3 + 1] < -5) {
          this.snowPositions[i * 3] = (Math.random() - 0.5) * SPREAD;
          this.snowPositions[i * 3 + 1] = HEIGHT * (0.5 + Math.random() * 0.5);
          this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
        }

        // Wrap horizontally
        if (Math.abs(this.snowPositions[i * 3]) > SPREAD * 0.5) {
          this.snowPositions[i * 3] = -Math.sign(this.snowPositions[i * 3]) * SPREAD * 0.45;
        }
        if (Math.abs(this.snowPositions[i * 3 + 2]) > SPREAD * 0.5) {
          this.snowPositions[i * 3 + 2] = -Math.sign(this.snowPositions[i * 3 + 2]) * SPREAD * 0.45;
        }
      }
      (this.snowMesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
