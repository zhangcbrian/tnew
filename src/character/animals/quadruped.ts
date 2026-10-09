import * as THREE from 'three';
import {
  type Rig, type Gait, type AvatarMats, type Leg,
  ellipsoid, loft, sweep, limb, pointedEar, part, joint, eyes, bakeShading, newRig,
} from '../rig';

type V3 = [number, number, number];

export type EarStyle = 'round' | 'pointed' | 'floppy' | 'long' | 'none';
export type TailStyle = 'thick' | 'brush' | 'thin' | 'curl' | 'pom' | 'tufted' | 'spiked' | 'none';

export interface QuadOptions {
  gait?: Gait;
  /** Torso: length, radius, center height, cross-section squash */
  bodyLen: number;
  bodyR: number;
  bodyY: number;
  bodySquash?: number;
  /** Chest is this much wider than hips (1 = same) */
  chest?: number;
  neckLen: number;
  neckR: number;
  /** Neck angle upward from horizontal, radians */
  neckUp: number;
  headR: number;
  /** Muzzle length and radius (0 = flat face) */
  snoutLen: number;
  snoutR: number;
  /** Muzzle angled down by this much */
  snoutDown?: number;
  eyeR: number;
  irisColor?: number;
  ears: EarStyle;
  earSize: number;
  legR: number;
  /** Paw / hoof size relative to legR */
  paw?: number;
  hooves?: boolean;
  /** Leg spread sideways as a fraction of bodyR */
  legSpread?: number;
  tail: TailStyle;
  tailLen: number;
  tailR: number;
  /** Tip of the tail in belly color (fox, deer...) */
  tailTip?: boolean;
  /** Muzzle, chest and belly in the belly color */
  bellyPatch?: boolean;
  whiskers?: boolean;
  /** Extra details added after the base build */
  extras?: (r: Rig, h: QuadHandles) => void;
}

/** Positions useful to `extras`, in the local space of each named joint. */
export interface QuadHandles {
  /** Front of the muzzle (head space) */
  noseTip: THREE.Vector3;
  /** Top of the head (head space) */
  headTop: THREE.Vector3;
  /** Tail base joint (in body space) */
  tailBase: THREE.Object3D | null;
  o: QuadOptions;
}

/** A smooth, detailed four-legged animal on a Rig. Every quadruped avatar is built from this. */
export function buildQuadruped(m: AvatarMats, o: QuadOptions): Rig {
  const rig = newRig(o.gait ?? 'quad', m, o.bodyY);
  if (o.irisColor !== undefined) m.iris.color.set(o.irisColor);
  const { root, body } = rig;
  const sq = o.bodySquash ?? 0.9;
  const L = o.bodyLen;
  const R = o.bodyR;
  const chest = o.chest ?? 1.08;

  // ---- Torso: rounded rump, waist, deep chest ----
  part(body, loft([
    [-L * 0.5, 0.0], [-L * 0.47, R * 0.55], [-L * 0.38, R * 0.88], [-L * 0.2, R * 0.97],
    [0, R * 0.92], [L * 0.2, R * chest], [L * 0.36, R * chest * 0.95], [L * 0.46, R * 0.7], [L * 0.5, 0.0],
  ], sq, 40), m.body);
  if (o.bellyPatch) {
    // Lighter chest and belly, hugging the underside
    part(body, ellipsoid(R * 0.78, R * 0.6, L * 0.4, 32), m.belly, [0, -R * 0.38 * sq, L * 0.05]);
  }

  // ---- Neck and head ----
  const neckBase: V3 = [0, R * 0.45 * sq, L * 0.38];
  const nx = Math.cos(o.neckUp) * o.neckLen;
  const ny = Math.sin(o.neckUp) * o.neckLen;
  const neckEnd: V3 = [0, neckBase[1] + ny, neckBase[2] + nx];
  part(body, sweep([neckBase, [0, neckBase[1] + ny * 0.55, neckBase[2] + nx * 0.5], neckEnd],
    [o.neckR * 1.3, o.neckR * 1.15, o.neckR * 0.95], 24, 12), m.body);
  // Close the neck's ends with rounded joints so no open rim shows where it meets the head or body
  part(body, ellipsoid(o.neckR * 0.98, o.neckR * 0.98, o.neckR * 0.98, 24), m.body, neckEnd);
  part(body, ellipsoid(o.neckR * 1.3, o.neckR * 1.3, o.neckR * 1.3, 24), m.body, neckBase);

  const head = joint(body, neckEnd, 'head');
  rig.head = head;
  const hr = o.headR;
  part(head, ellipsoid(hr * 0.95, hr * 0.92, hr, 36), m.body, [0, hr * 0.15, hr * 0.15]);
  // Cheeks
  for (const s of [-1, 1]) part(head, ellipsoid(hr * 0.42, hr * 0.38, hr * 0.42, 24), m.body, [s * hr * 0.48, -hr * 0.05, hr * 0.42]);

  // Muzzle
  const snoutDown = o.snoutDown ?? 0.15;
  const noseTip = new THREE.Vector3(0, -hr * 0.05, hr * 0.9);
  if (o.snoutLen > 0) {
    const sz = hr * 0.75 + o.snoutLen * 0.5;
    const muzzleMat = m.body;
    part(head, sweep([[0, 0, hr * 0.45], [0, -o.snoutLen * snoutDown * 0.5, sz], [0, -o.snoutLen * snoutDown, hr * 0.6 + o.snoutLen]],
      [o.snoutR * 1.35, o.snoutR * 1.1, o.snoutR * 0.9], 24, 12, 0.85), muzzleMat, [0, -hr * 0.12, 0]);
    part(head, ellipsoid(o.snoutR * 0.9, o.snoutR * 0.78, o.snoutR * 0.7, 24), muzzleMat,
      [0, -hr * 0.12 - o.snoutLen * snoutDown, hr * 0.6 + o.snoutLen]);
    if (o.bellyPatch) {
      // Lighter chin and lower jaw
      part(head, sweep([[0, 0, hr * 0.4], [0, -o.snoutLen * snoutDown * 0.5, sz], [0, -o.snoutLen * snoutDown, hr * 0.5 + o.snoutLen]],
        [o.snoutR * 1.1, o.snoutR * 0.95, o.snoutR * 0.7], 24, 12, 0.6), m.belly, [0, -hr * 0.12 - o.snoutR * 0.35, 0]);
    }
    noseTip.set(0, -hr * 0.12 - o.snoutLen * snoutDown + o.snoutR * 0.25, hr * 0.6 + o.snoutLen + o.snoutR * 0.5);
  } else {
    part(head, ellipsoid(hr * 0.5, hr * 0.38, hr * 0.32, 24), o.bellyPatch ? m.belly : m.body, [0, -hr * 0.2, hr * 0.85]);
    noseTip.set(0, -hr * 0.05, hr * 1.12);
  }
  // Glossy nose
  part(head, ellipsoid(hr * 0.17, hr * 0.12, hr * 0.12, 20), m.dark, [noseTip.x, noseTip.y, noseTip.z]);
  // Mouth: a soft dark crease under the nose
  part(head, sweep([[-hr * 0.16, 0, 0], [0, -hr * 0.05, 0.01], [hr * 0.16, 0, 0]], [0.008, 0.012, 0.008], 6, 8), m.dark,
    [noseTip.x, noseTip.y - hr * 0.2, noseTip.z - hr * 0.08]);

  // Eyes sit on the head's surface, looking forward and a little outward
  const headC = new THREE.Vector3(0, hr * 0.15, hr * 0.15);
  const dir = new THREE.Vector3(0.42, 0.3, 0.86).normalize();
  const surf = new THREE.Vector3(dir.x * hr * 0.95, dir.y * hr * 0.92, dir.z * hr).add(headC);
  const eyeC = surf.addScaledVector(dir, -o.eyeR * 0.35);
  rig.eyelids.push(...eyes(head, m, eyeC.x, eyeC.y, eyeC.z, o.eyeR, m.body, 0.35));

  // ---- Ears ----
  const es = o.earSize;
  const headTop = new THREE.Vector3(0, hr * 1.0, hr * 0.1);
  if (o.ears !== 'none') {
    for (const s of [-1, 1] as const) {
      const ear = joint(head, [s * hr * 0.55, hr * 0.75, -hr * 0.05], 'ear');
      rig.ears.push(ear);
      if (o.ears === 'round') {
        part(ear, ellipsoid(es, es, es * 0.45, 20), m.body, [0, es * 0.5, 0]);
        part(ear, ellipsoid(es * 0.65, es * 0.65, es * 0.2, 16), m.pink, [0, es * 0.5, es * 0.25]);
      } else if (o.ears === 'pointed' || o.ears === 'long') {
        const h = o.ears === 'long' ? es * 3.2 : es * 1.6;
        ear.rotation.set(-0.15, 0, s * -0.25);
        part(ear, pointedEar(es * 0.8, h, es * 0.35), m.body);
        part(ear, pointedEar(es * 0.5, h * 0.78, es * 0.12), m.pink, [0, h * 0.06, es * 0.2]);
      } else {
        // Floppy: hangs down beside the head
        ear.position.set(s * hr * 0.75, hr * 0.55, 0);
        ear.rotation.set(0.1, 0, s * 0.35);
        part(ear, ellipsoid(es * 0.45, es * 1.3, es * 0.7, 20), m.body, [s * es * 0.2, -es * 1.0, 0]);
      }
    }
  }

  if (o.whiskers) {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const w = part(head, sweep([[0, 0, 0], [s * hr * 0.35, (k - 1) * hr * 0.06, -hr * 0.05], [s * hr * 0.75, (k - 1) * hr * 0.16, -hr * 0.12]],
        [0.006, 0.004, 0.002], 4, 8), m.horn);
      w.position.set(noseTip.x + s * hr * 0.12, noseTip.y - hr * 0.08, noseTip.z - hr * 0.12);
    }
  }

  // ---- Legs: hips on the root so feet stay planted while the torso bobs ----
  const spread = (o.legSpread ?? 0.62) * R;
  const hipY = o.bodyY - R * 0.35 * sq;
  const legLen = hipY;
  for (const [front, z] of [[true, L * 0.3], [false, -L * 0.3]] as const) {
    for (const s of [-1, 1] as const) {
      const hip = joint(root, [s * spread, hipY, z], 'leg');
      // Thigh / shoulder mass blending into the torso
      part(hip, ellipsoid(o.legR * 1.45, o.legR * 2.3, o.legR * 1.7, 24), m.body, [0, -o.legR * 0.9, front ? 0 : -o.legR * 0.3]);
      part(hip, limb(o.legR * 1.25, o.legR * 0.95, legLen * 0.5), m.body);
      const knee = joint(hip, [0, -legLen * 0.5, 0], 'knee');
      part(knee, limb(o.legR * 0.95, o.legR * 0.8, legLen * 0.5), m.body);
      const pr = o.legR * (o.paw ?? 1.2);
      if (o.hooves) {
        part(knee, new THREE.CylinderGeometry(pr * 0.85, pr, pr * 1.1, 20).translate(0, -legLen * 0.5 + pr * 0.55, 0), m.dark);
      } else {
        part(knee, ellipsoid(pr, pr * 0.62, pr * 1.3, 20), m.body, [0, -legLen * 0.5 + pr * 0.5, pr * 0.35]);
        // Little toes / claws
        for (let t = -1; t <= 1; t++) {
          part(knee, ellipsoid(pr * 0.16, pr * 0.12, pr * 0.22, 10), m.dark, [t * pr * 0.45, -legLen * 0.5 + pr * 0.18, pr * 1.45]);
        }
      }
      const leg: Leg = { hip, knee, side: s, front };
      rig.legs.push(leg);
    }
  }

  // ---- Tail: a chain of joints so it can sway with lag ----
  let tailBase: THREE.Object3D | null = null;
  if (o.tail !== 'none') {
    tailBase = buildTail(rig, body, m, o, [0, R * 0.35 * sq, -L * 0.47]);
  }

  rig.wingAnchor = new THREE.Vector3(R * 0.62, R * 0.6 * sq, L * 0.14);
  o.extras?.(rig, { noseTip, headTop, tailBase, o });
  bakeShading(root);
  return rig;
}

function buildTail(rig: Rig, body: THREE.Object3D, m: AvatarMats, o: QuadOptions, base: V3): THREE.Object3D {
  const segs = 4;
  const segLen = o.tailLen / segs;
  const lift: Record<TailStyle, number> = { thick: -0.35, brush: -0.15, thin: -0.25, curl: 0.5, pom: 0.6, tufted: -0.6, spiked: -0.2, none: 0 };
  let parent: THREE.Object3D = joint(body, base, 'tail');
  parent.rotation.x = Math.PI + lift[o.tail]; // point backward (-Z), raised (+) or lowered (-) by style
  const first = parent;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const bushy = o.tail === 'brush' ? 1 + Math.sin(t1 * Math.PI) * 0.9 : 1;
    const r0 = o.tailR * (1 - t0 * 0.7) * (o.tail === 'brush' ? 1 + Math.sin(t0 * Math.PI) * 0.9 : 1);
    const r1 = o.tailR * (1 - t1 * 0.7) * bushy;
    const tip = i === segs - 1 && o.tailTip;
    part(parent, sweep([[0, 0, 0], [0, 0, segLen * 0.5], [0, 0, segLen]], [r0, (r0 + r1) / 2, r1], 18, 8), tip ? m.belly : m.body);
    part(parent, ellipsoid(r1, r1, r1, 16), tip ? m.belly : m.body, [0, 0, segLen]);
    rig.tail.push(parent);
    if (o.tail === 'curl') parent.rotation.x += i > 0 ? -0.55 : 0;
    const next = joint(parent, [0, 0, segLen]);
    parent = next;
  }
  if (o.tail === 'pom') part(parent, ellipsoid(o.tailR * 2.2, o.tailR * 2.2, o.tailR * 2.2, 20), m.belly);
  if (o.tail === 'tufted') part(parent, ellipsoid(o.tailR * 1.6, o.tailR * 1.6, o.tailR * 2.6, 16), m.dark, [0, 0, o.tailR]);
  if (o.tail === 'spiked') part(parent, new THREE.ConeGeometry(o.tailR * 2.2, o.tailR * 3, 4).rotateX(Math.PI / 2).scale(1, 0.3, 1), m.horn, [0, 0, o.tailR]);
  return first;
}
