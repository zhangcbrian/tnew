import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Rig: the jointed skeleton every player animal is built on. Joints are plain
// Object3D pivots, so the animator only ever rotates/moves/scales them.
// ---------------------------------------------------------------------------

export type Gait = 'quad' | 'biped' | 'hop' | 'swim' | 'plod';

export interface Leg {
  /** Rotates the whole leg forward/back (x) */
  hip: THREE.Object3D;
  /** Bends the lower leg (x); absent for stubby legs */
  knee: THREE.Object3D | null;
  side: -1 | 1;
  front: boolean;
}

export interface Rig {
  /** Whole animal. Faces +Z, feet at y = 0, about 1 unit tall. */
  root: THREE.Group;
  /** Torso pivot: breathing, bob, waddle */
  body: THREE.Object3D;
  /** Head pivot: looking around, nodding */
  head: THREE.Object3D;
  legs: Leg[];
  /** Tail joints from base to tip */
  tail: THREE.Object3D[];
  ears: THREE.Object3D[];
  /** Flippers / arms that swing (penguin, dolphin) */
  arms?: THREE.Object3D[];
  /** Upper eyelids: scale.y 0 = open, 1 = closed */
  eyelids: THREE.Object3D[];
  gait: Gait;
  /** Where wings attach, in body-local space */
  wingAnchor: THREE.Vector3;
  mats: AvatarMats;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export interface AvatarMats {
  body: THREE.MeshPhysicalMaterial;
  belly: THREE.MeshPhysicalMaterial;
  /** Nose, claws, hooves: dark and glossy */
  dark: THREE.MeshPhysicalMaterial;
  /** Inner ears, tongue, paw pads */
  pink: THREE.MeshPhysicalMaterial;
  /** Horns, beaks, tusks: ivory */
  horn: THREE.MeshPhysicalMaterial;
  sclera: THREE.MeshPhysicalMaterial;
  iris: THREE.MeshPhysicalMaterial;
  pupil: THREE.MeshPhysicalMaterial;
  catchlight: THREE.MeshBasicMaterial;
  cornea: THREE.MeshPhysicalMaterial;
}

/** Soft, fuzzy fur: sheen gives the light rim that reads as fur. Vertex colors carry baked shading. */
function fur(color: string | number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0xffffff),
    vertexColors: true,
  });
}

export function createAvatarMats(body: string, belly: string, iris = 0x5a3a1a): AvatarMats {
  return {
    body: fur(body),
    belly: fur(belly),
    dark: new THREE.MeshPhysicalMaterial({ color: 0x1c1816, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3, vertexColors: true }),
    pink: new THREE.MeshPhysicalMaterial({ color: 0xe8a0a0, roughness: 0.6, sheen: 0.5, vertexColors: true }),
    horn: new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.45, clearcoat: 0.4, vertexColors: true }),
    sclera: new THREE.MeshPhysicalMaterial({ color: 0xf6f4ee, roughness: 0.3 }),
    iris: new THREE.MeshPhysicalMaterial({ color: iris, roughness: 0.4 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.2 }),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    cornea: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.18,
      clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
    }),
  };
}

// ---------------------------------------------------------------------------
// Smooth shapes
// ---------------------------------------------------------------------------

type V3 = [number, number, number];
const SEG = 32;

/** Smooth ellipsoid with radii (rx, ry, rz). */
export function ellipsoid(rx: number, ry: number, rz: number, seg = SEG): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)).scale(rx, ry, rz);
}

/**
 * A smooth body of revolution lying along +Z: `profile` is [z, radius] pairs from back to front.
 * Optional `squash` makes it oval in cross-section (y radius = radius * squash).
 */
export function loft(profile: [number, number][], squash = 1, seg = SEG): THREE.BufferGeometry {
  const pts = profile.map(([z, r]) => new THREE.Vector2(Math.max(r, 0.0001), z));
  const geo = new THREE.LatheGeometry(pts, seg);
  // Lathe revolves around Y; lay it along Z
  geo.rotateX(Math.PI / 2);
  geo.scale(1, squash, 1);
  geo.computeVertexNormals();
  return geo;
}

/** Tube along a smooth curve with a radius that changes along it (tails, necks, horns, limbs). */
export function sweep(points: V3[], radii: number[], radial = 16, steps = 24, squash = 1): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const frames = curve.computeFrenetFrames(steps, false);
  const pos: number[] = [];
  const index: number[] = [];
  const radiusAt = (t: number) => {
    const f = t * (radii.length - 1);
    const i = Math.min(Math.floor(f), radii.length - 2);
    const k = f - i;
    return radii[i] + (radii[i + 1] - radii[i]) * (k * k * (3 - 2 * k));
  };
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const c = curve.getPointAt(t);
    const n = frames.normals[s];
    const b = frames.binormals[s];
    const r = radiusAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r * squash;
      pos.push(c.x + n.x * cx + b.x * cy, c.y + n.y * cx + b.y * cy, c.z + n.z * cx + b.z * cy);
    }
  }
  for (let s = 0; s < steps; s++) {
    for (let j = 0; j < radial; j++) {
      const a = s * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, a + 1, b, b, a + 1, b + 1); // outward-facing
    }
  }
  // Round caps: a small sphere at each end (merged by the caller via `part` with the same material)
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Rounded capsule along Y, base at y = 0. */
export function capsule(r: number, len: number, seg = 20): THREE.BufferGeometry {
  return new THREE.CapsuleGeometry(r, len, 8, seg).translate(0, len / 2 + r, 0);
}

/** Tapered rounded limb along -Y from the joint: radius r0 at the top, r1 at the bottom. */
export function limb(r0: number, r1: number, len: number, seg = 18): THREE.BufferGeometry {
  return sweep([[0, 0, 0], [0, -len * 0.5, 0.01], [0, -len, 0]], [r0, (r0 + r1) / 2, r1], seg, 10);
}

/** A solid pointed ear: a flattened cone `w` wide at the base, `h` tall, `d` thick, base at y = 0. */
export function pointedEar(w: number, h: number, d: number, seg = 24): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(w, h, seg, 6).translate(0, h / 2, 0);
  // Round the tip slightly and flatten front-to-back
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    const bulge = 1 + Math.sin(t * Math.PI) * 0.25;
    p.setXYZ(i, p.getX(i) * bulge, p.getY(i), p.getZ(i) * (d / w) * bulge);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Assembly helpers
// ---------------------------------------------------------------------------

/** Add a mesh to `parent` with position / rotation / scale. Shadows on. */
export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  pos: V3 = [0, 0, 0],
  rot: V3 = [0, 0, 0],
  scale: V3 = [1, 1, 1],
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A named joint (pivot) at `pos` under `parent`. */
export function joint(parent: THREE.Object3D, pos: V3, name = ''): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...pos);
  g.name = name;
  parent.add(g);
  return g;
}

/**
 * A pair of glossy cartoon eyes on `head`, looking along +Z. Returns the eyelids for blinking.
 * x: half distance between eyes, r: eyeball radius, lidMat: usually the body fur.
 */
export function eyes(head: THREE.Object3D, m: AvatarMats, x: number, y: number, z: number, r: number, lidMat: THREE.Material, outward = 0.25): THREE.Object3D[] {
  const lids: THREE.Object3D[] = [];
  for (const side of [-1, 1] as const) {
    const eye = joint(head, [side * x, y, z]);
    eye.rotation.y = side * outward;
    part(eye, ellipsoid(r, r, r * 0.9, 24), m.sclera);
    part(eye, ellipsoid(r * 0.62, r * 0.62, r * 0.25, 24), m.iris, [0, 0, r * 0.72]);
    part(eye, ellipsoid(r * 0.34, r * 0.38, r * 0.2, 20), m.pupil, [0, 0, r * 0.84]);
    part(eye, ellipsoid(r * 0.14, r * 0.14, r * 0.08, 10), m.catchlight, [-side * r * 0.25, r * 0.3, r * 0.92]);
    part(eye, ellipsoid(r * 1.03, r * 1.03, r * 0.95, 24), m.cornea);
    // Upper eyelid: a dome that slides down over the eye when scaled in y
    const lid = joint(eye, [0, r * 1.02, 0]);
    part(lid, new THREE.SphereGeometry(r * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).translate(0, 0, 0), lidMat, [0, 0, 0], [0, 0, 0], [1, 1, 1]);
    lid.scale.y = 0.02;
    lids.push(lid);
  }
  return lids;
}

/**
 * Bake soft shading into vertex colors (multiplied with the material color, so recoloring still works):
 * darker on undersides and toward the ground, a touch brighter on top.
 */
export function bakeShading(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const n = new THREE.Vector3();
  const p = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.MeshPhysicalMaterial;
    if (!mat.vertexColors) return;
    const geo = o.geometry as THREE.BufferGeometry;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    normalMatrix.getNormalMatrix(o.matrixWorld);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const up = n.y * 0.5 + 0.5; // 0 facing down .. 1 facing up
      const ground = THREE.MathUtils.smoothstep(p.y, 0, 0.45);
      const v = 0.72 + 0.28 * up * (0.75 + 0.25 * ground);
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = Math.min(v * 1.04, 1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  });
}

/** Create an empty rig: root -> body. The builder sets head, legs, tail, wingAnchor... */
export function newRig(gait: Gait, mats: AvatarMats, bodyY: number): Rig {
  const root = new THREE.Group();
  const body = joint(root, [0, bodyY, 0], 'body');
  return { root, body, head: body, legs: [], tail: [], ears: [], eyelids: [], gait, mats, wingAnchor: new THREE.Vector3() };
}
