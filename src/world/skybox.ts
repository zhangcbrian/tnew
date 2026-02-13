import * as THREE from 'three';

export class Skybox {
  sky: THREE.Mesh;
  sunDirection = new THREE.Vector3();

  constructor() {
    // Procedural sky using a large sphere with gradient
    const geometry = new THREE.SphereGeometry(1500, 32, 15);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xaaddff) },
        sunColor: { value: new THREE.Color(0xffffee) },
        sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        offset: { value: 20 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
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
    this.sunDirection.copy((material.uniforms.sunDirection.value as THREE.Vector3));
  }
}
