import * as THREE from 'three';

const FEATHER_COUNT = 6;

export class Wings {
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  private feathersL: THREE.Mesh[] = [];
  private feathersR: THREE.Mesh[] = [];

  constructor(parent: THREE.Group) {
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xff8c00,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.leftWing = new THREE.Group();
    this.leftWing.position.set(-0.45, 0.65, 0);
    this.leftWing.name = 'wingL';

    this.rightWing = new THREE.Group();
    this.rightWing.position.set(0.45, 0.65, 0);
    this.rightWing.name = 'wingR';

    for (let i = 0; i < FEATHER_COUNT; i++) {
      const t = i / (FEATHER_COUNT - 1);
      const length = 0.3 + (1 - Math.abs(t - 0.3)) * 0.5;
      const width = 0.08 + (1 - t) * 0.06;

      const geo = new THREE.BoxGeometry(length, 0.02, width);
      let mat: THREE.MeshStandardMaterial;
      if (i >= FEATHER_COUNT - 2) {
        mat = orangeMat;  // outer 2 feathers
      } else if (i >= FEATHER_COUNT - 4) {
        mat = yellowMat;  // next 2 feathers
      } else {
        mat = whiteMat;   // innermost feathers
      }

      const featherL = new THREE.Mesh(geo, mat);
      featherL.position.set(-length * 0.5, 0, (i - FEATHER_COUNT / 2) * 0.1);
      featherL.rotation.z = 0.1;
      this.leftWing.add(featherL);
      this.feathersL.push(featherL);

      const featherR = new THREE.Mesh(geo, mat);
      featherR.position.set(length * 0.5, 0, (i - FEATHER_COUNT / 2) * 0.1);
      featherR.rotation.z = -0.1;
      this.rightWing.add(featherR);
      this.feathersR.push(featherR);
    }

    parent.add(this.leftWing);
    parent.add(this.rightWing);
  }

  /** Animate wings. flapIntensity: 0=folded, 1=full flap */
  update(time: number, flapIntensity: number, isFlying: boolean) {
    const flapSpeed = isFlying ? 8 : 3;
    const flapAngle = flapIntensity * (isFlying ? 0.7 : 0.3);
    const baseAngle = isFlying ? 0.2 : 0.8; // More spread when flying

    const flap = Math.sin(time * flapSpeed) * flapAngle;

    this.leftWing.rotation.z = baseAngle + flap;
    this.rightWing.rotation.z = -(baseAngle + flap);

    // Individual feather flutter
    for (let i = 0; i < FEATHER_COUNT; i++) {
      const offset = i * 0.15;
      const flutter = Math.sin(time * flapSpeed + offset) * 0.1 * flapIntensity;
      this.feathersL[i].rotation.z = 0.1 + flutter;
      this.feathersR[i].rotation.z = -0.1 - flutter;
    }
  }
}
