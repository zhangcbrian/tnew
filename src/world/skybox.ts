import * as THREE from 'three';

export class Skybox {
  sky: THREE.Mesh;
  sunDirection = new THREE.Vector3();

  constructor() {
    // Procedural sky using a large sphere with gradient
    const geometry = new THREE.SphereGeometry(900, 32, 15);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x5f8fc2) },
        bottomColor: { value: new THREE.Color(0xc9d6e0) },
        sunColor: { value: new THREE.Color(0xfff3dc) },
        sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        offset: { value: 20 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          // Direction from the sky's center (which follows the camera)
          vWorldPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          vec3 sky = mix(bottomColor, topColor, t);

          // Sun glow
          vec3 dir = normalize(vWorldPosition);
          float sunDot = max(dot(dir, sunDirection), 0.0);
          float sunGlow = pow(sunDot, 64.0) * 1.5;
          float sunHalo = pow(sunDot, 8.0) * 0.3;
          sky += sunColor * (sunGlow + sunHalo);

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.sky = new THREE.Mesh(geometry, material);
    // Sky must not be fogged and must always surround the camera.
    material.fog = false;
    this.sky.frustumCulled = false;
    this.sunDirection.copy((material.uniforms.sunDirection.value as THREE.Vector3));
  }

  /** Keep the sky centered on the camera so it never ends in an endless world. */
  update(cameraPos: THREE.Vector3) {
    this.sky.position.copy(cameraPos);
  }
}
