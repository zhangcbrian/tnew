import * as THREE from 'three';
import { disposeObject } from '../utils/dispose';

interface View {
  el: HTMLElement;
  clip?: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
}

const SPIN_SPEED = 0.6;

/**
 * Draws many small spinning 3D previews with ONE WebGL context.
 * A transparent canvas covers the viewport; each view renders into its element's on-screen rectangle.
 */
export class PreviewRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private views: View[] = [];
  private running = false;
  private rafId = 0;
  private clock = new THREE.Clock();
  private grassGeo = new THREE.CylinderGeometry(1.4, 1.5, 0.12, 20);
  private grassMat = new THREE.MeshStandardMaterial({ color: '#5a9e3a', flatShading: true });

  private ensureRenderer(): THREE.WebGLRenderer {
    if (this.renderer) return this.renderer;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setClearColor(0x000000, 0);
    r.domElement.id = 'preview-canvas';
    document.body.appendChild(r.domElement);
    this.renderer = r;
    return r;
  }

  /** Show `object` spinning on a patch of grass inside `el`. Drawing is clipped to `clip`'s rectangle. */
  add(el: HTMLElement, object: THREE.Object3D, clip?: HTMLElement) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xcfefff, 0x556b2f, 1.4));
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.6);
    sun.position.set(3, 5, 4);
    scene.add(sun);

    const pivot = new THREE.Group();
    const grass = new THREE.Mesh(this.grassGeo, this.grassMat);
    grass.position.y = -0.06;
    pivot.add(grass);
    pivot.add(object);
    scene.add(pivot);

    // Frame the object: fit its bounding sphere in view.
    const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    const dist = Math.max(sphere.radius, 0.9) / Math.sin(THREE.MathUtils.degToRad(35 / 2)) * 1.05;
    const target = new THREE.Vector3(0, sphere.center.y * 0.8, 0);
    camera.position.set(0, target.y + dist * 0.35, dist);
    camera.lookAt(target);

    pivot.rotation.y = Math.random() * Math.PI * 2;
    this.views.push({ el, clip, scene, camera, pivot });
  }

  /** Remove all views (call before rebuilding a screen). */
  clear() {
    const shared = new Set<unknown>([this.grassGeo, this.grassMat]);
    for (const v of this.views) disposeObject(v.scene, shared);
    this.views = [];
  }

  start() {
    this.ensureRenderer().domElement.style.display = 'block';
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.clear();
    if (this.renderer) this.renderer.domElement.style.display = 'none';
  }

  private frame = () => {
    if (!this.running || !this.renderer) return;
    this.rafId = requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) r.setSize(w, h);

    r.setScissorTest(false);
    r.clear();
    r.setScissorTest(true);

    for (const v of this.views) {
      v.pivot.rotation.y += dt * SPIN_SPEED;
      if (!v.el.isConnected || v.el.offsetParent === null) continue;
      const rect = v.el.getBoundingClientRect();
      let left = rect.left, top = rect.top, right = rect.right, bottom = rect.bottom;
      if (v.clip) {
        const c = v.clip.getBoundingClientRect();
        left = Math.max(left, c.left);
        top = Math.max(top, c.top);
        right = Math.min(right, c.right);
        bottom = Math.min(bottom, c.bottom);
      }
      if (right <= left || bottom <= top || rect.width === 0) continue;

      // Viewport covers the whole card (no squish); scissor trims to the visible part.
      r.setViewport(rect.left, h - rect.bottom, rect.width, rect.height);
      r.setScissor(left, h - bottom, right - left, bottom - top);
      v.camera.aspect = rect.width / rect.height;
      v.camera.updateProjectionMatrix();
      r.render(v.scene, v.camera);
    }
  };
}

export const previewRenderer = new PreviewRenderer();
