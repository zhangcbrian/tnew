import * as THREE from 'three';
import { buildQuadruped } from './quadruped';
import {
  type Rig, type AvatarMats,
  ellipsoid, loft, sweep, limb, part, joint, eyes, bakeShading, newRig,
} from '../rig';

type V3 = [number, number, number];

const glossy = (color: number) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, vertexColors: true });

// ---------------------------------------------------------------- four-legged

export function otterAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.45, bodyR: 0.34, bodyY: 0.42, bodySquash: 0.85, chest: 1.05,
    neckLen: 0.22, neckR: 0.2, neckUp: 0.55,
    headR: 0.27, snoutLen: 0.1, snoutR: 0.14, snoutDown: 0.05,
    eyeR: 0.062, ears: 'round', earSize: 0.06,
    legR: 0.065, paw: 1.6, legSpread: 0.7,
    tail: 'thick', tailLen: 0.8, tailR: 0.12,
    bellyPatch: true, whiskers: true,
  });
}

export function dogAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.1, bodyR: 0.3, bodyY: 0.62,
    neckLen: 0.3, neckR: 0.14, neckUp: 0.9,
    headR: 0.24, snoutLen: 0.22, snoutR: 0.11,
    eyeR: 0.06, ears: 'floppy', earSize: 0.14,
    legR: 0.065, tail: 'curl', tailLen: 0.45, tailR: 0.055,
    bellyPatch: true,
    extras: (r, h) => {
      // Pink tongue peeking out
      part(r.head, ellipsoid(0.045, 0.012, 0.06, 16), r.mats.pink, [0, h.noseTip.y - 0.12, h.noseTip.z - 0.05], [0.3, 0, 0]);
    },
  });
}

export function foxAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.0, bodyR: 0.24, bodyY: 0.5,
    neckLen: 0.28, neckR: 0.12, neckUp: 0.7,
    headR: 0.2, snoutLen: 0.26, snoutR: 0.075, snoutDown: 0.05,
    eyeR: 0.05, irisColor: 0xc88a1a, ears: 'pointed', earSize: 0.11,
    legR: 0.045, legSpread: 0.55,
    tail: 'brush', tailLen: 0.8, tailR: 0.1, tailTip: true,
    bellyPatch: true, whiskers: true,
    extras: (r) => {
      // Dark "socks" on the lower legs
      for (const leg of r.legs) part(leg.knee!, limb(0.042, 0.04, 0.2), r.mats.dark, [0, -0.07, 0]);
    },
  });
}

export function bearAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.3, bodyR: 0.45, bodyY: 0.72, chest: 1.12,
    neckLen: 0.2, neckR: 0.27, neckUp: 0.3,
    headR: 0.3, snoutLen: 0.16, snoutR: 0.14, snoutDown: 0.1,
    eyeR: 0.05, ears: 'round', earSize: 0.1,
    legR: 0.12, paw: 1.3, legSpread: 0.6,
    tail: 'thick', tailLen: 0.12, tailR: 0.08,
    bellyPatch: true,
  });
}

export function pigAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.15, bodyR: 0.42, bodyY: 0.55, bodySquash: 0.95,
    neckLen: 0.12, neckR: 0.3, neckUp: 0.2,
    headR: 0.3, snoutLen: 0.12, snoutR: 0.16, snoutDown: 0,
    eyeR: 0.045, ears: 'pointed', earSize: 0.11,
    legR: 0.07, hooves: true, paw: 1.1,
    tail: 'curl', tailLen: 0.25, tailR: 0.025,
    extras: (r, h) => {
      // Flat pink snout disc with nostrils
      const disc = part(r.head, new THREE.CylinderGeometry(0.13, 0.14, 0.06, 32).rotateX(Math.PI / 2), r.mats.pink,
        [h.noseTip.x, h.noseTip.y - 0.02, h.noseTip.z - 0.02]);
      for (const s of [-1, 1]) part(disc, ellipsoid(0.025, 0.035, 0.02, 12), r.mats.dark, [s * 0.045, 0, 0.03]);
      // Ears flop forward a little
      for (const ear of r.ears) ear.rotation.x = 0.5;
    },
  });
}

export function horseAvatar(m: AvatarMats): Rig {
  const mane = glossy(0x2a1c14);
  return buildQuadruped(m, {
    bodyLen: 1.5, bodyR: 0.34, bodyY: 1.05,
    neckLen: 0.6, neckR: 0.15, neckUp: 1.0,
    headR: 0.19, snoutLen: 0.38, snoutR: 0.11, snoutDown: 0.35,
    eyeR: 0.055, ears: 'pointed', earSize: 0.06,
    legR: 0.07, hooves: true, paw: 1.25, legSpread: 0.55,
    tail: 'brush', tailLen: 0.75, tailR: 0.07,
    extras: (r, h) => {
      // Flowing mane along the top of the neck, and a forelock
      const L = h.o.bodyLen;
      const R = h.o.bodyR;
      const sq = 0.9;
      const up = h.o.neckUp;
      const base = new THREE.Vector3(0, R * 0.45 * sq, L * 0.38);
      const along = new THREE.Vector3(0, Math.sin(up), Math.cos(up)).multiplyScalar(h.o.neckLen);
      const top = new THREE.Vector3(0, Math.cos(up), -Math.sin(up)).multiplyScalar(h.o.neckR * 1.15);
      const pts: V3[] = [-0.1, 0.5, 1.05].map((t) => {
        const p = base.clone().addScaledVector(along, t).add(top);
        return [p.x, p.y, p.z];
      });
      part(r.body, sweep(pts, [0.05, 0.065, 0.04], 12, 16, 0.45), mane);
      part(r.head, ellipsoid(0.06, 0.05, 0.1, 16), mane, [0, 0.2, 0.1]);
      for (const seg of r.tail) seg.traverse((o) => { if (o instanceof THREE.Mesh) o.material = mane; });
    },
  });
}

export function dragonAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    bodyLen: 1.4, bodyR: 0.34, bodyY: 0.7,
    neckLen: 0.5, neckR: 0.14, neckUp: 0.8,
    headR: 0.22, snoutLen: 0.3, snoutR: 0.11, snoutDown: 0.05,
    eyeR: 0.06, irisColor: 0xe8b020, ears: 'none', earSize: 0,
    legR: 0.08, paw: 1.3,
    tail: 'spiked', tailLen: 1.2, tailR: 0.13,
    bellyPatch: true,
    extras: (r, h) => {
      // Swept-back horns
      for (const s of [-1, 1]) {
        part(r.head, sweep([[0, 0, 0], [s * 0.04, 0.12, -0.12], [s * 0.06, 0.18, -0.3]], [0.045, 0.03, 0.006], 12, 12), r.mats.horn,
          [s * 0.12, 0.2, 0.0]);
      }
      // Spines down the back and neck
      const L = h.o.bodyLen;
      for (let i = 0; i < 7; i++) {
        const z = L * 0.35 - i * L * 0.12;
        part(r.body, new THREE.ConeGeometry(0.045, 0.14, 12), r.mats.horn, [0, h.o.bodyR * 0.85, z], [-0.35, 0, 0]);
      }
      // Nostril smoke-holes
      for (const s of [-1, 1]) part(r.head, ellipsoid(0.015, 0.012, 0.01, 8), r.mats.dark, [s * 0.04, h.noseTip.y + 0.02, h.noseTip.z + 0.01]);
    },
  });
}

export function bunnyAvatar(m: AvatarMats): Rig {
  return buildQuadruped(m, {
    gait: 'hop',
    bodyLen: 0.72, bodyR: 0.28, bodyY: 0.38, bodySquash: 1, chest: 0.92,
    neckLen: 0.1, neckR: 0.18, neckUp: 0.8,
    headR: 0.22, snoutLen: 0.05, snoutR: 0.1, snoutDown: 0,
    eyeR: 0.065, ears: 'long', earSize: 0.085,
    legR: 0.055, paw: 1.7,
    tail: 'pom', tailLen: 0.05, tailR: 0.06,
    bellyPatch: true, whiskers: true,
    extras: (r) => {
      // Two little front teeth
      for (const s of [-1, 1]) part(r.head, new THREE.BoxGeometry(0.022, 0.035, 0.01), r.mats.sclera, [s * 0.013, -0.12, 0.27]);
    },
  });
}

// ---------------------------------------------------------------- penguin (waddles)

export function penguinAvatar(m: AvatarMats): Rig {
  const orange = glossy(0xf09a2a);
  const rig = newRig('biped', m, 0.55);
  const { root, body } = rig;
  // Egg-shaped body, upright
  part(body, ellipsoid(0.36, 0.52, 0.32, 40), m.body);
  part(body, ellipsoid(0.3, 0.46, 0.22, 36), m.belly, [0, -0.03, 0.12]);
  const head = joint(body, [0, 0.5, 0.02], 'head');
  rig.head = head;
  part(head, ellipsoid(0.24, 0.23, 0.23, 36), m.body);
  part(head, ellipsoid(0.17, 0.15, 0.12, 28), m.belly, [0, -0.04, 0.13]); // white face
  part(head, new THREE.ConeGeometry(0.06, 0.18, 20).rotateX(Math.PI / 2).scale(1, 0.7, 1), orange, [0, -0.03, 0.27]);
  rig.eyelids.push(...eyes(head, m, 0.095, 0.05, 0.165, 0.052, m.body, 0.35));
  // Flippers (arms)
  rig.arms = [];
  for (const s of [-1, 1]) {
    const arm = joint(body, [s * 0.34, 0.2, 0], 'arm');
    part(arm, ellipsoid(0.05, 0.3, 0.12, 24), m.body, [s * 0.02, -0.25, 0], [0, 0, s * 0.15]);
    rig.arms.push(arm);
  }
  // Short legs and big orange feet
  for (const s of [-1, 1] as const) {
    const hip = joint(root, [s * 0.14, 0.12, 0], 'leg');
    part(hip, limb(0.05, 0.045, 0.1), m.body);
    part(hip, ellipsoid(0.09, 0.03, 0.15, 20), orange, [0, -0.1, 0.08]);
    rig.legs.push({ hip, knee: null, side: s, front: true });
  }
  const tail = joint(body, [0, -0.42, -0.25], 'tail');
  part(tail, new THREE.ConeGeometry(0.1, 0.18, 16).rotateX(-Math.PI / 2 - 0.6), m.body);
  rig.tail.push(tail);
  rig.wingAnchor = new THREE.Vector3(0.3, 0.15, 0);
  bakeShading(root);
  return rig;
}

// ---------------------------------------------------------------- dolphin (swims)

export function dolphinAvatar(m: AvatarMats): Rig {
  const rig = newRig('swim', m, 0.48);
  const { root, body } = rig;
  // Sleek body: thick in front, tapering to the tail stock
  part(body, loft([
    [-0.6, 0.06], [-0.45, 0.16], [-0.2, 0.3], [0.05, 0.36], [0.3, 0.34], [0.45, 0.27], [0.55, 0.12], [0.58, 0.0],
  ], 0.92, 40), m.body);
  part(body, ellipsoid(0.26, 0.17, 0.5, 32), m.belly, [0, -0.17, 0.02]);
  // Head: melon + beak (rostrum)
  const head = joint(body, [0, 0.02, 0.42], 'head');
  rig.head = head;
  // Rounded melon blending into the body, then a long beak (rostrum) with a pale underside
  part(head, ellipsoid(0.24, 0.22, 0.26, 36), m.body, [0, 0.03, 0.02]);
  part(head, sweep([[0, -0.04, 0.15], [0, -0.06, 0.3], [0, -0.07, 0.42]], [0.11, 0.085, 0.06], 24, 12, 0.7), m.body);
  part(head, sweep([[0, -0.07, 0.12], [0, -0.09, 0.3], [0, -0.09, 0.41]], [0.1, 0.075, 0.05], 24, 12, 0.45), m.belly);
  part(head, sweep([[-0.1, -0.08, 0.2], [0, -0.1, 0.43], [0.1, -0.08, 0.2]], [0.006, 0.008, 0.006], 6, 12), m.dark); // smile
  rig.eyelids.push(...eyes(head, m, 0.17, 0.02, 0.17, 0.05, m.body, 1.0));
  part(head, ellipsoid(0.025, 0.012, 0.025, 10), m.dark, [0, 0.24, -0.05]); // blowhole
  // Dorsal fin and flippers
  part(body, new THREE.ConeGeometry(0.12, 0.3, 24).scale(0.35, 1, 1), m.body, [0, 0.38, -0.08], [-0.55, 0, 0]);
  rig.arms = [];
  for (const s of [-1, 1]) {
    const arm = joint(body, [s * 0.24, -0.12, 0.22], 'arm');
    part(arm, ellipsoid(0.22, 0.03, 0.09, 20), m.body, [s * 0.16, -0.05, -0.04], [0, s * 0.5, s * -0.4]);
    rig.arms.push(arm);
  }
  // Tail chain ending in a fluke
  let parent: THREE.Object3D = joint(body, [0, 0.0, -0.55], 'tail');
  parent.rotation.y = Math.PI;
  for (let i = 0; i < 3; i++) {
    const r0 = 0.08 - i * 0.02;
    part(parent, sweep([[0, 0, 0], [0, 0, 0.1], [0, 0, 0.2]], [r0, r0 - 0.01, r0 - 0.02], 16, 6, 0.8), m.body);
    rig.tail.push(parent);
    parent = joint(parent, [0, 0, 0.2]);
  }
  const fluke = new THREE.Shape();
  fluke.moveTo(0, 0);
  fluke.quadraticCurveTo(0.2, 0.05, 0.32, 0.2);
  fluke.quadraticCurveTo(0.15, 0.12, 0, 0.1);
  fluke.quadraticCurveTo(-0.15, 0.12, -0.32, 0.2);
  fluke.quadraticCurveTo(-0.2, 0.05, 0, 0);
  part(parent, new THREE.ExtrudeGeometry(fluke, { depth: 0.03, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, curveSegments: 16 })
    .rotateX(Math.PI / 2).translate(0, 0.015, -0.02), m.body);
  rig.wingAnchor = new THREE.Vector3(0.26, 0.22, 0.12);
  bakeShading(root);
  return rig;
}

// ---------------------------------------------------------------- frog (hops)

export function frogAvatar(m: AvatarMats): Rig {
  const rig = newRig('hop', m, 0.32);
  const { root, body } = rig;
  part(body, ellipsoid(0.42, 0.25, 0.46, 40), m.body, [0, 0, -0.05]);
  part(body, ellipsoid(0.36, 0.17, 0.4, 36), m.belly, [0, -0.1, 0.02]);
  // Spots
  for (const [x, z, r] of [[0.15, -0.15, 0.06], [-0.2, -0.05, 0.05], [0.05, 0.1, 0.045], [-0.08, -0.28, 0.05]] as const) {
    part(body, ellipsoid(r, r * 0.4, r, 16), m.dark, [x, 0.22, z]);
  }
  const head = joint(body, [0, 0.06, 0.3], 'head');
  rig.head = head;
  part(head, ellipsoid(0.36, 0.2, 0.28, 40), m.body);
  part(head, ellipsoid(0.32, 0.12, 0.24, 32), m.belly, [0, -0.08, 0.03]);
  // Wide smile
  part(head, sweep([[-0.3, 0, 0], [0, -0.04, 0.26], [0.3, 0, 0]], [0.008, 0.012, 0.008], 6, 20), m.dark, [0, -0.04, 0.0]);
  // Bulging eyes on top
  for (const s of [-1, 1]) part(head, ellipsoid(0.11, 0.1, 0.1, 24), m.body, [s * 0.18, 0.15, 0.05]);
  rig.eyelids.push(...eyes(head, m, 0.18, 0.18, 0.09, 0.085, m.body, 0.45));
  // Front legs: short and splayed. Back legs: big folded haunches.
  for (const s of [-1, 1] as const) {
    const fhip = joint(root, [s * 0.25, 0.22, 0.22], 'leg');
    part(fhip, limb(0.05, 0.04, 0.12), m.body, [0, 0, 0], [0, 0, s * 0.3]);
    const fknee = joint(fhip, [s * 0.04, -0.12, 0.02]);
    part(fknee, limb(0.04, 0.035, 0.1), m.body);
    part(fknee, ellipsoid(0.06, 0.015, 0.07, 16), m.belly, [0, -0.1, 0.04]);
    rig.legs.push({ hip: fhip, knee: fknee, side: s, front: true });

    const bhip = joint(root, [s * 0.3, 0.22, -0.25], 'leg');
    part(bhip, ellipsoid(0.13, 0.12, 0.22, 24), m.body, [s * 0.04, -0.03, 0.06]);
    const bknee = joint(bhip, [s * 0.06, -0.08, 0.2]);
    part(bknee, sweep([[0, 0, 0], [0, -0.06, -0.15], [0, -0.12, -0.3]], [0.06, 0.05, 0.04], 14, 8), m.body);
    part(bknee, ellipsoid(0.09, 0.015, 0.16, 18), m.belly, [0, -0.15, -0.18]);
    rig.legs.push({ hip: bhip, knee: bknee, side: s, front: false });
  }
  rig.wingAnchor = new THREE.Vector3(0.3, 0.15, -0.05);
  bakeShading(root);
  return rig;
}

// ---------------------------------------------------------------- turtle (plods)

export function turtleAvatar(m: AvatarMats): Rig {
  const rig = newRig('plod', m, 0.32);
  const { root, body } = rig;
  // Domed shell (body color) with raised plates (belly color) and a rim
  part(body, new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1.15), m.body);
  part(body, new THREE.TorusGeometry(0.5, 0.04, 12, 48).rotateX(Math.PI / 2).scale(1, 1, 1.15), m.body, [0, 0.01, 0]);
  // Raised plates sitting exactly on the dome (an ellipsoid with radii A, B, C), facing outward
  const A = 0.5, B = 0.35, C = 0.575;
  const spots: [number, number][] = [[0, 0], [0, 0.3], [0, -0.3], [0.25, 0.14], [-0.25, 0.14], [0.25, -0.16], [-0.25, -0.16], [0.36, -0.01], [-0.36, -0.01]];
  for (const [x, z] of spots) {
    const y = B * Math.sqrt(Math.max(0, 1 - (x / A) ** 2 - (z / C) ** 2));
    const n = new THREE.Vector3(x / (A * A), y / (B * B), z / (C * C)).normalize();
    const p = part(body, new THREE.CylinderGeometry(0.1, 0.12, 0.035, 6), m.belly, [x + n.x * 0.005, y + n.y * 0.005, z + n.z * 0.005]);
    p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  }
  part(body, ellipsoid(0.46, 0.07, 0.54, 32), m.belly, [0, -0.02, 0]); // underside
  const skin = m.belly;
  const head = joint(body, [0, 0.02, 0.6], 'head');
  rig.head = head;
  part(body, sweep([[0, 0, 0.42], [0, 0.03, 0.52], [0, 0.04, 0.6]], [0.1, 0.09, 0.085], 18, 8), skin);
  part(head, ellipsoid(0.13, 0.11, 0.16, 32), skin, [0, 0.03, 0.08]);
  part(head, sweep([[-0.08, 0, 0], [0, -0.02, 0.06], [0.08, 0, 0]], [0.005, 0.007, 0.005], 6, 10), m.dark, [0, -0.01, 0.17]);
  rig.eyelids.push(...eyes(head, m, 0.085, 0.07, 0.14, 0.042, skin, 0.5));
  for (const [front, z] of [[true, 0.3], [false, -0.3]] as const) {
    for (const s of [-1, 1] as const) {
      const hip = joint(root, [s * 0.36, 0.22, z], 'leg');
      part(hip, limb(0.08, 0.07, 0.2), skin);
      part(hip, ellipsoid(0.09, 0.04, 0.11, 16), skin, [0, -0.2, 0.03]);
      rig.legs.push({ hip, knee: null, side: s, front });
    }
  }
  const tail = joint(body, [0, 0, -0.56], 'tail');
  tail.rotation.y = Math.PI;
  part(tail, new THREE.ConeGeometry(0.04, 0.14, 12).rotateX(Math.PI / 2).translate(0, 0, 0.07), skin);
  rig.tail.push(tail);
  rig.wingAnchor = new THREE.Vector3(0.4, 0.3, 0.05);
  bakeShading(root);
  return rig;
}
