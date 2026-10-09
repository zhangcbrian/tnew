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

/** Per-shape feel: flap speed/angle multipliers, and whether the wing folds upright (insects) or back (birds, bats). */
const STYLE: Record<WingId, { speed: number; angle: number; upright: boolean; size: number }> = {
  feathered: { speed: 1, angle: 1, upright: false, size: 1 },
  bat: { speed: 1.1, angle: 1, upright: false, size: 1 },
  butterfly: { speed: 1.6, angle: 0.8, upright: true, size: 1 },
  dragon: { speed: 0.7, angle: 1.15, upright: false, size: 1.35 },
  fairy: { speed: 2.2, angle: 0.6, upright: true, size: 1 },
  angel: { speed: 0.7, angle: 1.15, upright: false, size: 1.45 },
};

/** One side's materials: main color plus a lighter and darker shade derived from it. */
interface SideMats {
  main: THREE.MeshPhysicalMaterial;
  light: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshPhysicalMaterial;
}

function createSideMats(type: WingId): SideMats {
  const make = () => {
    if (type === 'fairy') {
      // See-through with a rainbow shimmer
      return new THREE.MeshPhysicalMaterial({
        roughness: 0.15, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
        iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 800], clearcoat: 1, vertexColors: true,
      });
    }
    if (type === 'bat' || type === 'dragon' || type === 'butterfly') {
      return new THREE.MeshPhysicalMaterial({ roughness: 0.6, sheen: 0.4, side: THREE.DoubleSide, vertexColors: true });
    }
    // Feathers: soft sheen
    return new THREE.MeshPhysicalMaterial({ roughness: 0.75, sheen: 0.8, sheenRoughness: 0.5, side: THREE.DoubleSide, vertexColors: true });
  };
  return { main: make(), light: make(), dark: make() };
}

function setSideColor(m: SideMats, color: string) {
  m.main.color.set(color);
  m.light.color.set(color).offsetHSL(0, -0.08, 0.16);
  m.dark.color.set(color).offsetHSL(0.02, 0.05, -0.2);
}

// ---------------------------------------------------------------- shapes
// Wings are built for the right side (+X out, +Z forward) and mirrored for the left.

/** Paint a geometry with a vertex-color gradient (multiplies the material color). */
function shade(geo: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const p = geo.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

const solid = (geo: THREE.BufferGeometry) => shade(geo, () => 1);

/** A single feather: rounded, slightly cupped, lying along +X from its root. */
function feather(len: number, width: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 20, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const t = (x + 1) / 2; // 0 root .. 1 tip
    const w = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (1 - Math.pow(t, 6) * 0.6);
    p.setXYZ(i, t * len, p.getY(i) * 0.012 - Math.pow(p.getZ(i), 2) * 0.01, p.getZ(i) * width * 0.5 * w);
  }
  geo.computeVertexNormals();
  // Darker toward the tip, lighter at the root
  return shade(geo, (x) => 1 - (x / len) * 0.25);
}

/** A flat membrane from an outline in the XZ plane (x out, z forward), lightly cupped. */
function membrane(outline: THREE.Shape, cup = 0.04): THREE.BufferGeometry {
  const geo = new THREE.ShapeGeometry(outline, 24);
  geo.rotateX(Math.PI / 2); // shape (x, y) -> (x, 0, y): y in the shape becomes +z
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, -Math.sin(Math.min(Math.abs(p.getX(i)), 1) * Math.PI) * cup);
  geo.computeVertexNormals();
  return shade(geo, (x, _y, z) => 0.85 + 0.15 * Math.cos(z * 3) * (1 - Math.min(Math.abs(x), 1) * 0.4));
}

function bone(len: number, r0: number, r1: number): THREE.BufferGeometry {
  return solid(new THREE.CylinderGeometry(r1, r0, len, 10).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0));
}

interface SideParts {
  /** Shoulder: flaps and folds the whole wing */
  shoulder: THREE.Group;
  /** Wrist: folds the outer half */
  wrist: THREE.Group;
}

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0], rotY = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.y = rotY;
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Build one wing (right-handed). Returns its joints. */
function buildSide(type: WingId, m: SideMats): SideParts {
  const shoulder = new THREE.Group();
  const size = STYLE[type].size;
  const arm = 0.42 * size;
  const wrist = new THREE.Group();
  wrist.position.set(arm, 0, 0);
  shoulder.add(wrist);

  switch (type) {
    case 'feathered':
    case 'angel': {
      const big = type === 'angel';
      mesh(shoulder, bone(arm, 0.03 * size, 0.022 * size), m.main);
      // Coverts: short rounded feathers along the arm, two rows
      for (let row = 0; row < (big ? 3 : 2); row++) {
        const n = 6;
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * arm * 0.95;
          const len = (0.16 + row * 0.08) * size;
          // Rows overlap like roof tiles over the arm, pointing back
          mesh(shoulder, feather(len, 0.085 * size), row === 0 ? m.light : m.main, [x, 0.02 - 0.006 * row, 0.03], Math.PI / 2 - 0.2);
        }
      }
      // Secondaries along the arm, pointing back
      for (let i = 0; i < 6; i++) {
        const x = (i / 5) * arm * 0.9;
        mesh(shoulder, feather((0.34 + i * 0.025) * size, 0.1 * size), m.main, [x, -0.008, 0], Math.PI / 2 - 0.1 - i * 0.04);
      }
      // Primaries: long flight feathers fanned from the hand
      mesh(wrist, bone(0.16 * size, 0.022 * size, 0.014 * size), m.main);
      const prim = big ? 9 : 7;
      for (let i = 0; i < prim; i++) {
        const t = i / (prim - 1);
        const len = (0.42 + Math.sin(t * Math.PI * 0.8) * 0.18) * size;
        mesh(wrist, feather(len, 0.11 * size), t > 0.5 ? m.dark : m.main, [0.02 * size + t * 0.14 * size, -0.004 * i, 0], 0.12 + (1 - t) * 1.2);
      }
      break;
    }
    case 'bat':
    case 'dragon': {
      const dragon = type === 'dragon';
      mesh(shoulder, bone(arm, 0.018 * size, 0.013 * size), m.dark);
      // Inner membrane: body edge -> arm -> wrist, scalloped trailing edge
      const inner = new THREE.Shape();
      inner.moveTo(0, 0.02);
      inner.lineTo(arm, 0.01);
      inner.quadraticCurveTo(arm * 0.75, -0.18 * size, arm * 0.55, -0.32 * size);
      inner.quadraticCurveTo(arm * 0.3, -0.24 * size, 0, -0.34 * size);
      inner.lineTo(0, 0.02);
      mesh(shoulder, membrane(inner), m.main);
      // Hand: three finger bones and the membrane between them
      const fingers: [number, number][] = [[0.5, 0.05], [0.52, -0.25], [0.4, -0.5]].map(([x, z]) => [x * size, z * size]);
      for (const [fx, fz] of fingers) {
        const len = Math.hypot(fx, fz);
        mesh(wrist, bone(len, 0.012 * size, 0.004 * size), m.dark, [0, 0, 0], -Math.atan2(fz, fx));
      }
      const outer = new THREE.Shape();
      outer.moveTo(0, 0.01);
      outer.lineTo(fingers[0][0], fingers[0][1]);
      outer.quadraticCurveTo(fingers[0][0] * 0.8, (fingers[0][1] + fingers[1][1]) / 2 + (dragon ? 0.02 : 0.08), fingers[1][0], fingers[1][1]);
      outer.quadraticCurveTo(fingers[1][0] * 0.7, (fingers[1][1] + fingers[2][1]) / 2 + (dragon ? 0.02 : 0.08), fingers[2][0], fingers[2][1]);
      outer.quadraticCurveTo(fingers[2][0] * 0.4, fingers[2][1] * 0.6, -arm * 0.45, -0.32 * size);
      outer.lineTo(0, 0.01);
      mesh(wrist, membrane(outer), m.main);
      // Claw at the wrist
      const claw = mesh(wrist, solid(new THREE.ConeGeometry(0.025 * size, 0.09 * size, 10)), m.light, [0.02, 0.01, 0.05 * size]);
      claw.rotation.x = Math.PI / 2;
      if (dragon) {
        for (const [fx, fz] of fingers) {
          const spike = mesh(wrist, solid(new THREE.ConeGeometry(0.02 * size, 0.08 * size, 8)), m.light, [fx, 0, fz]);
          spike.rotation.z = -Math.PI / 2;
          spike.rotation.y = -Math.atan2(fz, fx);
        }
      }
      break;
    }
    case 'butterfly': {
      // Upper and lower lobes with a darker rim and pale spots
      const lobe = (rx: number, rz: number, ox: number, oz: number, mat: THREE.Material) => {
        const s = new THREE.Shape();
        s.absellipse(ox, oz, rx, rz, 0, Math.PI * 2, false, 0);
        const geo = membrane(s, 0.02);
        shade(geo, (x, _y, z) => {
          const d = Math.hypot((x - ox) / rx, (z - oz) / rz);
          return d > 0.82 ? 0.45 : 1 - d * 0.25;
        });
        return mesh(shoulder, geo, mat);
      };
      lobe(0.42, 0.3, 0.4, 0.14, m.main);
      lobe(0.28, 0.22, 0.28, -0.26, m.dark);
      mesh(shoulder, solid(new THREE.CircleGeometry(0.08, 20).rotateX(-Math.PI / 2)), m.light, [0.52, 0.006, 0.2]);
      mesh(shoulder, solid(new THREE.CircleGeometry(0.05, 16).rotateX(-Math.PI / 2)), m.light, [0.3, 0.006, -0.28]);
      break;
    }
    case 'fairy': {
      const blade = (len: number, w: number, angle: number, mat: THREE.Material) => {
        const s = new THREE.Shape();
        s.absellipse(len / 2, 0, len / 2, w / 2, 0, Math.PI * 2, false, 0);
        const g = membrane(s, 0.01);
        shade(g, (x) => 0.75 + 0.25 * (x / len));
        return mesh(shoulder, g, mat, [0, 0, 0], angle);
      };
      blade(0.95, 0.24, -0.25, m.main);
      blade(0.7, 0.18, 0.35, m.light);
      // Glittering veins
      for (const a of [-0.25, 0.35]) mesh(shoulder, bone(0.6, 0.006, 0.002), m.light, [0, 0.004, 0], a);
      break;
    }
  }
  return { shoulder, wrist };
}

/** Mirror a right-side wing into a left one (x -> -x), fixing triangle winding. */
function mirror(group: THREE.Object3D) {
  group.scale.x = -1;
}

// ---------------------------------------------------------------- Wings

export class Wings {
  leftWing: THREE.Group;
  rightWing: THREE.Group;
  private style: (typeof STYLE)[WingId];
  private matsL: SideMats;
  private matsR: SideMats;
  private left: SideParts;
  private right: SideParts;
  /** 0 = folded against the body, 1 = fully open (smoothed) */
  private openT = 0;

  constructor(
    parent: THREE.Object3D,
    type: WingId = 'feathered',
    anchorX = 0.45,
    anchorY = 0.65,
    leftColor = '#ffc21a',
    rightColor = leftColor,
    anchorZ = 0,
  ) {
    this.style = STYLE[type];
    this.matsL = createSideMats(type);
    this.matsR = createSideMats(type);
    this.setColors(leftColor, rightColor);

    this.right = buildSide(type, this.matsR);
    this.left = buildSide(type, this.matsL);
    this.rightWing = new THREE.Group();
    this.rightWing.name = 'wingR';
    this.rightWing.position.set(anchorX, anchorY, anchorZ);
    this.rightWing.add(this.right.shoulder);
    this.leftWing = new THREE.Group();
    this.leftWing.name = 'wingL';
    this.leftWing.position.set(-anchorX, anchorY, anchorZ);
    this.leftWing.add(this.left.shoulder);
    mirror(this.leftWing);

    parent.add(this.leftWing);
    parent.add(this.rightWing);
    this.applyPose(0, 0);
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

  /** Jump straight to a pose (previews): open 0..1, no flapping. */
  pose(open: number) {
    this.openT = open;
    this.applyPose(0, 0);
  }

  /**
   * Smoothly fold/unfold toward `open` (0..1) and flap with `flap` (0..1) strength.
   * Called every frame by the animator.
   */
  animate(dt: number, time: number, open: number, flap: number) {
    this.openT += (open - this.openT) * Math.min(1, dt * 5);
    const speed = 8 * this.style.speed;
    const beat = Math.sin(time * speed) * 0.75 * this.style.angle * flap * this.openT;
    this.applyPose(beat, time);
  }

  /** Old API: kept for callers that only know "flying or not". */
  update(time: number, flapIntensity: number, isFlying: boolean) {
    this.animate(1 / 60, time, isFlying ? 1 : 0.15, isFlying ? flapIntensity : 0);
  }

  private applyPose(beat: number, time: number) {
    const t = this.openT;
    for (const p of [this.left, this.right]) {
      if (this.style.upright) {
        // Insect wings: closed = held upright together over the back, open = spread flat
        p.shoulder.rotation.set(0, 0, THREE.MathUtils.lerp(1.45, 0.12, t) + beat);
        p.wrist.rotation.set(0, 0, 0);
      } else {
        // Bird/bat wings: closed = swept back and tucked along the body, open = spread out
        p.shoulder.rotation.set(
          THREE.MathUtils.lerp(0.25, 0, t),
          THREE.MathUtils.lerp(1.3, 0.12, t),
          THREE.MathUtils.lerp(0.25, 0.1, t) + beat,
          'YZX',
        );
        // Outer half lags the beat a little, so the tip whips
        const lag = Math.sin(time * 8 * this.style.speed - 0.6) * 0.25 * this.style.angle * t;
        // Folded: the hand tucks forward along the outside of the arm (a compact bird-style fold)
        p.wrist.rotation.set(0, THREE.MathUtils.lerp(-2.6, 0, t), beat !== 0 ? lag : 0);
      }
    }
  }
}
