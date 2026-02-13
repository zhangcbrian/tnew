import * as THREE from 'three';

const ROCKET_SPEED = 40;
const ROCKET_LIFETIME = 3;
const MAX_ROCKETS = 20;

interface Rocket {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  age: number;
  flame: THREE.Mesh;
  active: boolean;
}

export class RocketSystem {
  private rockets: Rocket[] = [];
  private scene: THREE.Scene;
  private reuseIdx = 0;

  private readonly rocketGeoBody = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6);
  private readonly rocketGeoNose = new THREE.ConeGeometry(0.08, 0.2, 6);
  private readonly rocketGeoFlame = new THREE.ConeGeometry(0.1, 0.35, 5);

  private readonly rocketMatBody = new THREE.MeshStandardMaterial({
    color: 0xcc3333,
    emissive: 0xaa2222,
    emissiveIntensity: 0.4,
    metalness: 0.6,
    roughness: 0.3,
  });
  private readonly rocketMatNose = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.8,
    roughness: 0.2,
  });
  private readonly rocketMatFlame = new THREE.MeshStandardMaterial({
    color: 0xff8800,
    emissive: 0xff6600,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.9,
  });

  private readonly tmpDir = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-bake static transforms on shared geometries.
    this.rocketGeoBody.rotateX(Math.PI / 2);
    this.rocketGeoNose.rotateX(Math.PI / 2);
    this.rocketGeoFlame.rotateX(-Math.PI / 2);
  }

  shoot(origin: THREE.Vector3, heading: number, pitch: number = 0) {
    let r: Rocket | undefined = undefined;

    // Prefer reusing an inactive rocket.
    for (let i = 0; i < this.rockets.length; i++) {
      if (!this.rockets[i].active) {
        r = this.rockets[i];
        break;
      }
    }

    if (!r && this.rockets.length < MAX_ROCKETS) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(this.rocketGeoBody, this.rocketMatBody);
      group.add(body);

      const nose = new THREE.Mesh(this.rocketGeoNose, this.rocketMatNose);
      nose.position.z = 0.4;
      group.add(nose);

      const flame = new THREE.Mesh(this.rocketGeoFlame, this.rocketMatFlame);
      flame.position.z = -0.45;
      group.add(flame);

      const light = new THREE.PointLight(0xff6600, 2, 8);
      light.position.z = -0.4;
      group.add(light);

      r = { mesh: group, velocity: new THREE.Vector3(), age: 0, flame, active: false };
      this.rockets.push(r);
    }

    // All rockets are active and we're at the cap: reuse via a ring index.
    if (!r) {
      r = this.rockets[this.reuseIdx];
      this.reuseIdx = (this.reuseIdx + 1) % this.rockets.length;
      if (r.active) this.scene.remove(r.mesh);
    }

    // Position and orient
    r.mesh.position.copy(origin);
    r.mesh.position.y += 0.5;
    r.mesh.rotation.set(0, heading, 0);

    // Velocity in the otter's forward direction
    this.tmpDir.set(
      Math.sin(heading),
      Math.sin(pitch),
      Math.cos(heading),
    ).normalize();

    this.scene.add(r.mesh);

    r.velocity.copy(this.tmpDir).multiplyScalar(ROCKET_SPEED);
    r.age = 0;
    r.active = true;
  }

  update(dt: number) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      if (!r.active) continue;
      r.age += dt;

      // Move
      r.mesh.position.addScaledVector(r.velocity, dt);

      // Flicker flame
      const flicker = 0.8 + Math.random() * 0.4;
      r.flame.scale.set(flicker, 0.7 + Math.random() * 0.6, flicker);

      // Remove expired
      if (r.age > ROCKET_LIFETIME) {
        this.scene.remove(r.mesh);
        r.active = false;
      }
    }
  }
}
