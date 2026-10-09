import * as THREE from 'three';

/** Free the GPU geometry and materials of everything under `root`, except anything in `keep`. */
export function disposeObject(root: THREE.Object3D, keep: Set<unknown> = new Set()) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!keep.has(obj.geometry)) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) if (!keep.has(m)) m.dispose();
  });
}
