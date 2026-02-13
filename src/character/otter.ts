import * as THREE from 'three';

export function createOtter(): THREE.Group {
  const otter = new THREE.Group();
  otter.name = 'otter';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2b4f72,
    roughness: 0.75,
    metalness: 0.08,
    flatShading: true,
  });

  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0x7a9cb8,
    roughness: 0.8,
    metalness: 0.05,
    flatShading: true,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.1,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.1,
  });

  const noseMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.6,
  });

  // Body - elongated sphere
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    bodyMat,
  );
  body.scale.set(1, 0.8, 1.6);
  body.position.set(0, 0.5, 0);
  body.castShadow = true;
  body.name = 'body';
  otter.add(body);

  // Belly
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 7, 5),
    bellyMat,
  );
  belly.scale.set(0.9, 0.7, 1.3);
  belly.position.set(0, 0.35, 0.05);
  belly.name = 'belly';
  otter.add(belly);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    bodyMat,
  );
  head.scale.set(1, 0.9, 1);
  head.position.set(0, 0.75, 0.65);
  head.castShadow = true;
  head.name = 'head';
  otter.add(head);

  // Cheeks
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 4),
      bellyMat,
    );
    cheek.position.set(side * 0.2, 0.68, 0.82);
    otter.add(cheek);
  }

  // Eyes
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 4),
      whiteMat,
    );
    eyeWhite.position.set(side * 0.15, 0.82, 0.9);
    otter.add(eyeWhite);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 4),
      darkMat,
    );
    pupil.position.set(side * 0.15, 0.82, 0.95);
    otter.add(pupil);

    // Eye shine
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 4, 3),
      whiteMat,
    );
    shine.position.set(side * 0.13, 0.84, 0.97);
    otter.add(shine);
  }

  // Nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 5, 4),
    noseMat,
  );
  nose.position.set(0, 0.73, 0.98);
  nose.scale.set(1.2, 0.8, 0.8);
  otter.add(nose);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 5, 4),
      bodyMat,
    );
    ear.position.set(side * 0.25, 0.92, 0.55);
    ear.scale.set(0.8, 0.6, 0.8);
    otter.add(ear);
  }

  // Front legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.35, 5),
      bodyMat,
    );
    leg.position.set(side * 0.3, 0.15, 0.35);
    leg.rotation.x = 0.2;
    leg.castShadow = true;
    leg.name = side === -1 ? 'legFL' : 'legFR';
    otter.add(leg);

    // Paw
    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 5, 4),
      bodyMat,
    );
    paw.position.set(side * 0.3, 0.02, 0.42);
    paw.scale.set(1, 0.5, 1.3);
    otter.add(paw);
  }

  // Back legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.35, 5),
      bodyMat,
    );
    leg.position.set(side * 0.3, 0.15, -0.35);
    leg.rotation.x = -0.2;
    leg.castShadow = true;
    leg.name = side === -1 ? 'legBL' : 'legBR';
    otter.add(leg);

    const paw = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 5, 4),
      bodyMat,
    );
    paw.position.set(side * 0.3, 0.02, -0.42);
    paw.scale.set(1.2, 0.5, 1.5);
    otter.add(paw);
  }

  // Tail - tapered cylinder
  const tail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.12, 0.8, 5),
    bodyMat,
  );
  tail.position.set(0, 0.4, -0.9);
  tail.rotation.x = -0.6;
  tail.castShadow = true;
  tail.name = 'tail';
  otter.add(tail);

  return otter;
}
