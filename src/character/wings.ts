import * as THREE from 'three';

export type WingId = 'feathered' | 'bat' | 'butterfly' | 'dragon' | 'fairy' | 'angel';

export const WING_TYPES: { id: WingId; name: string; color: string }[] = [
  { id: 'feathered', name: 'Feathered', color: '#ffc21a' },
  { id: 'bat', name: 'Bat', color: '#4a3b5c' },
  { id: 'butterfly', name: 'Butterfly', color: '#ff7ac8' },
  { id: 'dragon', name: 'Dragon', color: '#3fa06b' },
  { id: 'fairy', name: 'Fairy', color: '#9fe8ff' },
  { id: 'angel', name: 'Angel', color: '#ffffff' },
];

/** Per-shape flap feel: multipliers on the base flap speed and angle. */
const FLAP: Record<WingId, { speed: number; angle: number }> = {
  feathered: { speed: 1, angle: 1 },
  bat: { speed: 1, angle: 1 },
  butterfly: { speed: 1.6, angle: 0.7 },
  dragon: { speed: 0.7, angle: 1.2 },
  fairy: { speed: 2, angle: 0.6 },
  angel: { speed: 0.7, angle: 1.2 },
};

/** One side's materials: main color plus a lighter and darker shade derived from it. */
interface SideMats {
  main: THREE.MeshStandardMaterial;
  light: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
}

function createSideMats(seeThrough: boolean): SideMats {
  const make = () => new THREE.MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.1,
    flatShading: true,
    side: THREE.DoubleSide,
    transparent: seeThrough,
    opacity: seeThrough ? 0.55 : 1,
  });
  return { main: make(), light: make(), dark: make() };
}

function setSideColor(m: SideMats, color: string) {
  m.main.color.set(color);
  m.light.color.set(color).offsetHSL(0, -0.1, 0.18);
  m.dark.color.set(color).offsetHSL(0.02, 0.05, -0.18);
}

/** Flat wing shape in the XZ plane. Points are (outward, backward); `s` mirrors outward to -x for the left side. */
function flatShape(points: [number, number][], s: number): THREE.ShapeGeometry {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(s * x, z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function ellipse(rx: number, rz: number, seg = 12): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  return pts;
}

function mesh(group: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

/** Builds one side's wing into `g`. Returns the meshes that flutter individually. */
function buildShape(type: WingId, g: THREE.Group, m: SideMats, s: number): THREE.Mesh[] {
  const flutter: THREE.Mesh[] = [];
  switch (type) {
    case 'feathered': {
      const count = 6;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const length = 0.3 + (1 - Math.abs(t - 0.3)) * 0.5;
        const width = 0.08 + (1 - t) * 0.06;
        const mat = i >= count - 2 ? m.dark : i >= count - 4 ? m.main : m.light;
        const f = mesh(g, new THREE.BoxGeometry(length, 0.02, width), mat, s * length * 0.5, 0, (i - count / 2) * 0.1);
        flutter.push(f);
      }
      break;
    }
    case 'angel': {
      for (let row = 0; row < 2; row++) {
        const count = 8;
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          const length = (0.55 + Math.sin(t * Math.PI) * 0.6) * (row === 0 ? 1 : 0.65);
          const mat = row === 0 ? m.main : m.light;
          const f = mesh(g, new THREE.BoxGeometry(length, 0.025, 0.13), mat,
            s * length * 0.5, row * 0.02, (i - count / 2) * 0.09 - 0.05);
          f.rotation.y = s * (t - 0.4) * 0.5;
          flutter.push(f);
        }
      }
      break;
    }
    case 'bat': {
      mesh(g, flatShape([[0, -0.08], [0.45, -0.22], [0.95, -0.12], [0.8, 0.12], [0.62, 0.3],
        [0.5, 0.18], [0.32, 0.36], [0.2, 0.22], [0, 0.32]], s), m.main);
      for (const [x, z] of [[0.95, -0.12], [0.62, 0.3], [0.32, 0.36]]) {
        const len = Math.hypot(x, z);
        const bone = mesh(g, new THREE.CylinderGeometry(0.015, 0.025, len, 4), m.dark, s * x / 2, 0.01, -z / 2);
        bone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(s * x, 0, -z).normalize());
      }
      mesh(g, new THREE.ConeGeometry(0.03, 0.1, 4), m.dark, s * 0.97, 0, 0.17).rotation.x = Math.PI / 2;
      break;
    }
    case 'dragon': {
      mesh(g, flatShape([[0, -0.12], [0.5, -0.32], [1.25, -0.2], [1.05, 0.12], [0.95, 0.42], [0.82, 0.24],
        [0.65, 0.52], [0.52, 0.3], [0.35, 0.55], [0.22, 0.32], [0, 0.42]], s), m.main);
      mesh(g, flatShape([[0, -0.12], [0.5, -0.32], [1.25, -0.2], [0.5, -0.22]], s), m.dark, 0, 0.01, 0);
      const claw = mesh(g, new THREE.ConeGeometry(0.05, 0.18, 4), m.light, s * 1.3, 0, 0.24);
      claw.rotation.set(Math.PI / 2, 0, s * -0.6);
      break;
    }
    case 'butterfly': {
      const upper = mesh(g, flatShape(ellipse(0.42, 0.3), s), m.main, s * 0.42, 0, 0.12);
      const lower = mesh(g, flatShape(ellipse(0.28, 0.22), s), m.dark, s * 0.3, -0.005, -0.28);
      mesh(g, flatShape(ellipse(0.1, 0.08), s), m.light, s * 0.55, 0.01, 0.18);
      mesh(g, flatShape(ellipse(0.06, 0.05), s), m.light, s * 0.32, 0.005, -0.3);
      flutter.push(upper, lower);
      break;
    }
    case 'fairy': {
      const a = mesh(g, flatShape(ellipse(0.5, 0.12), s), m.main, s * 0.48, 0, 0.1);
      a.rotation.y = s * 0.3;
      const b = mesh(g, flatShape(ellipse(0.38, 0.09), s), m.light, s * 0.36, -0.005, -0.15);
      b.rotation.y = s * -0.35;
      flutter.push(a, b);
      break;
    }
  }
  return flutter;
}

export class Wings {
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  private flap: { speed: number; angle: number };
  private matsL: SideMats;
  private matsR: SideMats;
  private flutterL: THREE.Mesh[];
  private flutterR: THREE.Mesh[];
  private baseRotZ: number[];

  constructor(
    parent: THREE.Group,
    type: WingId = 'feathered',
    anchorX = 0.45,
    anchorY = 0.65,
    leftColor = '#ffc21a',
    rightColor = leftColor,
  ) {
    this.flap = FLAP[type];
    this.matsL = createSideMats(type === 'fairy');
    this.matsR = createSideMats(type === 'fairy');
    this.setColors(leftColor, rightColor);

    this.leftWing = new THREE.Group();
    this.leftWing.position.set(-anchorX, anchorY, 0);
    this.leftWing.name = 'wingL';
    this.rightWing = new THREE.Group();
    this.rightWing.position.set(anchorX, anchorY, 0);
    this.rightWing.name = 'wingR';

    this.flutterL = buildShape(type, this.leftWing, this.matsL, -1);
    this.flutterR = buildShape(type, this.rightWing, this.matsR, 1);
    this.baseRotZ = this.flutterR.map((f) => f.rotation.z);

    parent.add(this.leftWing);
    parent.add(this.rightWing);
  }

  setColors(left: string, right: string) {
    setSideColor(this.matsL, left);
    setSideColor(this.matsR, right);
  }

  /** Detach both wings from their parent. */
  dispose() {
    this.leftWing.removeFromParent();
    this.rightWing.removeFromParent();
  }

  /** Animate wings. flapIntensity: 0=folded, 1=full flap */
  update(time: number, flapIntensity: number, isFlying: boolean) {
    const flapSpeed = (isFlying ? 8 : 3) * this.flap.speed;
    const flapAngle = flapIntensity * (isFlying ? 0.7 : 0.3) * this.flap.angle;
    const baseAngle = isFlying ? 0.2 : 0.8; // More spread when flying

    const flap = Math.sin(time * flapSpeed) * flapAngle;

    this.leftWing.rotation.z = baseAngle + flap;
    this.rightWing.rotation.z = -(baseAngle + flap);

    // Individual feather flutter
    for (let i = 0; i < this.flutterR.length; i++) {
      const flutter = Math.sin(time * flapSpeed + i * 0.15) * 0.1 * flapIntensity;
      this.flutterL[i].rotation.z = -this.baseRotZ[i] + flutter;
      this.flutterR[i].rotation.z = this.baseRotZ[i] - flutter;
    }
  }
}
