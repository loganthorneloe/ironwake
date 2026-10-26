// One working machine in its repair cradle. Original geometry, shared menu art direction.
export function createHangarEnvironment({ T, scene }) {
  const root = new T.Group();
  scene.add(root);
  const cube = new T.BoxGeometry(1, 1, 1),
    steel = new T.MeshStandardMaterial({ color: '#222b30', roughness: 0.8, metalness: 0.65 }),
    black = new T.MeshStandardMaterial({ color: '#0b1115', roughness: 0.93, metalness: 0.45 }),
    edge = new T.MeshStandardMaterial({ color: '#4c575a', roughness: 0.7, metalness: 0.7 }),
    ochre = new T.MeshStandardMaterial({ color: '#9c713c', roughness: 0.85, metalness: 0.25 });
  const block = (x, y, z, w, h, d, material = steel) => {
    const mesh = new T.Mesh(cube, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const luminous = (color) => new T.MeshBasicMaterial({ color }),
    cold = luminous('#729ca8'),
    warm = luminous('#e3ac6c');
  const beam = (a, b, r, material = steel) => {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.sub(start),
      m = new T.Mesh(new T.CylinderGeometry(r, r, delta.length(), 8), material);
    m.position.copy(start.addScaledVector(delta, 0.5));
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    m.castShadow = true;
    root.add(m);
    return m;
  };
  const cable = (points, r = 0.035) => {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      m = new T.Mesh(new T.TubeGeometry(curve, 32, r, 6, false), black);
    root.add(m);
    return m;
  };
  // Patched concrete, paint worn into the service lane, and oil beneath the machine.
  block(
    0,
    -0.22,
    0,
    65,
    0.4,
    60,
    new T.MeshStandardMaterial({ color: '#1b2428', roughness: 0.82, metalness: 0.18 }),
  );
  block(
    0,
    -0.005,
    0,
    9,
    0.035,
    10,
    new T.MeshStandardMaterial({ color: '#303638', roughness: 0.72, metalness: 0.42 }),
  );
  for (const x of [-4.35, 4.35]) {
    block(x, 0.025, 0, 0.065, 0.015, 10, ochre);
    for (let j = 0; j < 7; j++) {
      const stripe = block(x, 0.035, 3.4 - j * 0.3, 0.45, 0.016, 0.09, ochre);
      stripe.rotation.y = 0.55;
    }
  }
  for (const z of [-5, 5])
    for (const x of [-3.5, -1.8, 1.8, 3.5]) block(x, 0.03, z, 1.05, 0.02, 0.07, ochre);
  for (const [x, z, rx, rz] of [
    [2.1, 1.5, 1.5, 0.65],
    [-1.8, -2, 0.8, 1.3],
    [4.8, -1.3, 1.6, 0.45],
    [-5, 4, 2, 0.7],
  ]) {
    const shape = new T.Shape();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        r = 0.84 + Math.sin(i * 2.7 + x) * 0.1 + Math.cos(i * 1.3) * 0.07;
      i
        ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const oil = new T.Mesh(
      new T.ShapeGeometry(shape),
      new T.MeshStandardMaterial({
        color: '#0c171b',
        roughness: 0.28,
        metalness: 0.6,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    oil.rotation.x = -Math.PI / 2;
    oil.position.set(x, 0.028, z);
    oil.scale.set(rx, rz, 1);
    root.add(oil);
  }
  // The freight door is the warm source; its recess frames the distant dockyard.
  const outside = new T.ShaderMaterial({
    uniforms: {
      upper: { value: new T.Color('#baa180') },
      lower: { value: new T.Color('#69503a') },
    },
    vertexShader:
      'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 uvOut;uniform vec3 upper;uniform vec3 lower;void main(){vec3 c=mix(lower,upper,smoothstep(0.,1.,uvOut.y));c*=.6+.4*smoothstep(0.,.5,uvOut.x);gl_FragColor=vec4(c,1.);}',
    side: T.DoubleSide,
  });
  const opening = new T.Mesh(new T.PlaneGeometry(12, 10), outside);
  opening.position.set(-6.5, 4.7, 12);
  root.add(opening);
  block(-16, 7.7, 11, 8, 16, 1.7, black);
  block(10.8, 7.7, 11, 9, 16, 1.7, black);
  block(-3, 12.1, 11, 19, 1.2, 2.4, steel);
  block(3, 6.5, 11, 6.5, 13, 1.7, black);
  block(-6.5, 9.7, 10.6, 12.5, 1.1, 1.2, steel);
  for (let y = 7.6; y <= 9.2; y += 0.4) {
    block(-6.5, y, 10.7, 11.4, 0.32, 0.38, steel);
    block(-6.5, y - 0.17, 10.45, 11.4, 0.035, 0.1, edge);
  }
  for (const x of [-12.3, 6.3]) {
    block(x, 5.7, 10.4, 0.65, 11.4, 1.8, edge);
    block(x, 5.7, 9.45, 0.13, 11.1, 0.06, warm);
    for (let j = 0; j < 8; j++) block(x - 0.08, 0.8 + j * 1.5, 9.3, 0.9, 0.09, 0.08, black);
  }
  for (const [x, h, w] of [
    [-10, 2.5, 2],
    [-7, 1.6, 3],
    [-3, 3.3, 1.1],
    [0.2, 2, 2],
    [3.3, 4.2, 1.5],
  ])
    block(x, h / 2 - 0.3, 11.8, w, h, 0.4, new T.MeshBasicMaterial({ color: '#3f403b' }));
  beam([-10, 7.3, 11.5], [5, 7.3, 11.5], 0.06, black);
  beam([-4, 0, 11.4], [-4, 9, 11.4], 0.04, black);
  // Paired rails, bracing, a chain hoist, and a folded service arm form one repair gantry.
  for (const x of [-6.8, 6.8]) {
    block(x, 6.6, 3.5, 0.7, 13.2, 1.1, steel);
    block(x - 0.44, 6.6, 3.5, 0.18, 13.2, 1.5, black);
    block(x, 10, 1.2, 0.95, 0.45, 9.2, edge);
    for (const z of [-2, 0, 2, 4]) beam([x - 0.7, 9.7, z], [x + 0.7, 10.4, z + 0.8], 0.045, steel);
  }
  block(0, 10.45, 2.2, 14.6, 0.8, 1.15, steel);
  block(0, 10.03, 1.8, 14, 0.1, 0.1, ochre);
  for (let i = -6; i <= 6; i += 1.5) beam([i, 10.8, 1.7], [i + 0.65, 10.1, 1.7], 0.045, edge);
  block(1.9, 9.65, 2.15, 1.9, 0.75, 1.5, ochre);
  beam([1.9, 9.3, 2.1], [1.9, 6.8, 2.1], 0.045, black);
  const hook = new T.Mesh(new T.TorusGeometry(0.17, 0.05, 6, 12, Math.PI * 1.65), edge);
  hook.position.set(1.9, 6.7, 2.1);
  root.add(hook);
  beam([-6.5, 4.8, 3], [-4.6, 4.2, 2.4], 0.18, edge);
  beam([-4.6, 4.2, 2.4], [-4.1, 2.7, 2.5], 0.14, steel);
  block(-4.1, 2.5, 2.5, 0.65, 0.5, 0.8, black);
  cable(
    [
      [-6.6, 9.9, 2],
      [-5.2, 8, 2.4],
      [-5.5, 4.5, 2.1],
      [-6.2, 0.2, 1.5],
    ],
    0.08,
  );
  cable(
    [
      [6.8, 10.1, 0.8],
      [5.5, 9.7, -0.1],
      [4.9, 8.9, -0.5],
      [5.1, 7.2, -0.8],
    ],
    0.05,
  );
  cable(
    [
      [-6.1, 0.08, 1],
      [-4.8, 0.07, -0.4],
      [-5, 0.08, -2.8],
      [-7, 0.08, -4],
    ],
    0.055,
  );
  block(-7.3, 0.85, -1.5, 1.6, 1.7, 1.1, black);
  const console = block(-7.3, 1.8, -1.65, 1.6, 0.18, 1, steel);
  console.rotation.x = 0.2;
  block(-7.3, 1.93, -1.66, 0.85, 0.035, 0.55, cold);
  for (let i = 0; i < 3; i++) block(-7.6 + i * 0.3, 1.98, -1.4, 0.09, 0.035, 0.05, warm);
  // Ducts and practical lamps make the dark edges feel like the rest of a room.
  for (const z of [-3, 5, 10]) {
    block(0, 13, z, 31, 1.2, 0.7, black);
    beam([-15, 12.5, z], [0, 11.9, z], 0.11, steel);
  }
  block(7.5, 9, -3, 0.5, 0.4, 3.8, black);
  block(7.5, 8.76, -3, 0.25, 0.035, 3.5, cold);
  block(-9, 6, 4, 0.45, 0.5, 2, black);
  block(-8.76, 6, 4, 0.025, 0.21, 1.7, warm);
  const hemi = new T.HemisphereLight('#8fa8bb', '#070b0d', 0.3);
  scene.add(hemi);
  const key = new T.DirectionalLight('#a4c4dc', 2.2);
  key.position.set(7, 9, -6);
  key.target.position.set(0, 3, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -13,
    right: 13,
    top: 16,
    bottom: -7,
    near: 0.5,
    far: 45,
  });
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new T.DirectionalLight('#edb578', 1.8);
  rim.position.set(-8, 7, 10);
  rim.target.position.set(0, 3, 0);
  scene.add(rim, rim.target);
  const bounce = new T.PointLight('#7596a5', 4, 16, 2);
  bounce.position.set(3, 3, -4);
  scene.add(bounce);
  // Sparse suspended dust catches the sources. No image overlays or screen-space grain.
  const dustPositions = new Float32Array(180 * 3),
    dustBase = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const s = Math.sin(i * 127.1 + 17) * 43758.5453,
      f = s - Math.floor(s),
      q = Math.sin(i * 311.7 + 7) * 41234.361,
      p = q - Math.floor(q);
    dustBase[i * 3] = (f - 0.5) * 24;
    dustBase[i * 3 + 1] = p * 13;
    dustBase[i * 3 + 2] = ((i * 0.6180339) % 1) * 18 - 5;
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPositions, 3));
  const dustMat = new T.PointsMaterial({
    color: '#dac5a4',
    size: 0.025,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new T.Points(dustGeo, dustMat);
  root.add(dust);
  const shaftMat = new T.ShaderMaterial({
    uniforms: { color: { value: new T.Color('#b4b2a1') } },
    vertexShader:
      'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 uvOut;uniform vec3 color;void main(){float edge=pow(sin(uvOut.x*3.14159),2.);float fade=sin(uvOut.y*3.14159);gl_FragColor=vec4(color,edge*fade*.022);}',
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  for (const [x, z, angle] of [
    [-5, 5, -0.4],
    [-2, 7, -0.25],
  ]) {
    const shaft = new T.Mesh(new T.PlaneGeometry(4, 16), shaftMat);
    shaft.position.set(x, 6, z);
    shaft.rotation.set(-0.32, angle, 0.42);
    root.add(shaft);
  }
  scene.userData.bayLights = [];
  scene.userData.bayStrips = [];
  scene.traverse((o) => {
    if (o.isLight) scene.userData.bayLights.push({ light: o, intensity: o.intensity });
    if (
      (o.isMesh && (o.material?.isMeshBasicMaterial || o.material?.isShaderMaterial)) ||
      o === dust
    )
      scene.userData.bayStrips.push(o);
  });
  return {
    update(t, powered = true) {
      dust.visible = powered;
      for (let i = 0; i < 180; i++) {
        dustPositions[i * 3] = dustBase[i * 3] + Math.sin(t * 0.08 + i) * 0.35;
        dustPositions[i * 3 + 1] = (dustBase[i * 3 + 1] + t * 0.025) % 13;
        dustPositions[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.06 + i) * 0.2;
      }
      dustGeo.attributes.position.needsUpdate = true;
    },
    root,
  };
}
const inspectionMaterials = new WeakMap();
export function finishHangarMech({ T, model }) {
  const outlines = [];
  model.traverse((o) => {
    if (o.isLineSegments) outlines.push(o);
    if (!o.isMesh || !o.material?.isMeshToonMaterial) return;
    const original = o.material;
    if (!inspectionMaterials.has(original))
      inspectionMaterials.set(
        original,
        new T.MeshStandardMaterial({
          color: original.color,
          vertexColors: original.vertexColors,
          roughness: 0.62,
          metalness: 0.3,
        }),
      );
    o.material = inspectionMaterials.get(original);
  });
  for (const outline of outlines) outline.removeFromParent();
}
export function restHangarMech(model) {
  const u = model.userData;
  for (let i = 0; i < u.arms.length; i++) {
    const arm = u.arms[i],
      kit = u.kits[i],
      long = kit.item === 'blade' || kit.item === 'lance' || kit.item === 'scythe';
    arm.rotation.set(0.025, 0, i ? 0.06 : -0.06);
    arm.userData.elbow.rotation.x = 0.07;
    kit.root.rotation.set(
      kit.item === 'guard' ? 0 : long ? -0.45 : -0.72,
      long ? (i ? 1.05 : -1.05) : 0,
      0,
    );
    kit.muzzle.visible = false;
    kit.trail.visible = false;
    if (kit.shieldFX) kit.shieldFX.visible = false;
  }
}
export function createHomeBattle({ T, makeMech, disposeMech, animateMech, chassisFor }) {
  const scene = new T.Scene();
  scene.background = new T.Color('#080d11');
  scene.fog = new T.Fog('#080d11', 23, 65);
  const bay = createHangarEnvironment({ T, scene }),
    camera = new T.PerspectiveCamera(34, 1, 0.1, 120);
  let model,
    key = '',
    lastTime = -1;
  return function draw(renderer, canvas, t, build) {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    const next = JSON.stringify(build);
    if (key !== next) {
      key = next;
      if (model) {
        scene.remove(model);
        disposeMech(model);
      }
      model = makeMech(build);
      finishHangarMech({ T, model });
      scene.add(model);
    }
    if (
      renderer.domElement.width !== Math.round(width * renderer.getPixelRatio()) ||
      renderer.domElement.height !== Math.round(height * renderer.getPixelRatio())
    )
      renderer.setSize(width, height, false);
    const scale = chassisFor(build).scale,
      aspect = width / height,
      portrait = aspect < 0.85,
      fit = portrait ? 1.23 : 1,
      dt = lastTime < 0 ? 0.016 : Math.min(0.05, Math.max(0, t - lastTime));
    lastTime = t;
    camera.aspect = aspect;
    camera.setViewOffset(width, height, -width * (portrait ? 0.08 : 0.17), 0, width, height);
    camera.position.set(
      (6.3 + Math.sin(t * 0.07) * 0.12) * scale,
      2.7 * scale,
      -12.1 * scale * fit,
    );
    camera.lookAt(0, 2.9 * scale, 0);
    camera.updateProjectionMatrix();
    animateMech(
      model,
      { x: 0, y: 0, altitude: 0, hp: 100, angle: -Math.PI / 2, hands: [{}, {}] },
      dt,
      t,
    );
    restHangarMech(model);
    model.userData.body.rotation.x = Math.sin(t * 0.37) * 0.004;
    model.userData.head.rotation.y = 0.08 + Math.sin(t * 0.13) * 0.018;
    bay.update(t);
    renderer.render(scene, camera);
  };
}
