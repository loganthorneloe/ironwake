import { impactLevel } from './impact-preferences.js';
import * as T from './vendor/three.module.min.js';
// Bounded, per-mech effects: original edge geometry is reused, with six pooled echoes.
export function createDashEffect(root) {
  const solids = [],
    edges = [];
  root.traverse((node) => {
    if (node.isMesh && !node.material.isMeshBasicMaterial && node.geometry?.attributes.position)
      solids.push(node);
    if (node.isLineSegments) edges.push({ node, material: node.material });
  });
  const edgeMaterial = new T.LineBasicMaterial({
    color: 0xff243b,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const shellMaterial = new T.MeshBasicMaterial({
    color: 0xff1735,
    side: T.BackSide,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const shells = solids.map((source) => {
    const shell = new T.Mesh(source.geometry, shellMaterial);
    shell.scale.setScalar(1.045);
    shell.visible = false;
    source.add(shell);
    return shell;
  });
  root.updateWorldMatrix(true, true);
  const inverse = new T.Matrix4().copy(root.matrixWorld).invert(),
    vertex = new T.Vector3(),
    positions = [];
  for (const source of solids) {
    const transform = new T.Matrix4().multiplyMatrices(inverse, source.matrixWorld),
      geometry = source.geometry,
      pa = geometry.attributes.position,
      indices = geometry.index;
    for (let i = 0; i < (indices?.count || pa.count); i++) {
      vertex.fromBufferAttribute(pa, indices ? indices.getX(i) : i).applyMatrix4(transform);
      positions.push(vertex.x, vertex.y, vertex.z);
    }
  }
  const echoGeometry = new T.BufferGeometry();
  echoGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  echoGeometry.computeBoundingSphere();
  const echoes = Array.from({ length: 6 }, () => {
    const mesh = new T.Mesh(
      echoGeometry,
      new T.MeshBasicMaterial({
        color: 0xff1424,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.NormalBlending,
      }),
    );
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    mesh.visible = false;
    root.add(mesh);
    return { mesh, life: 0, world: new T.Matrix4() };
  });
  const ribbonGeometry = new T.BufferGeometry(),
    ribbonPositions = new Float32Array(36 * 6 * 18),
    ribbonColors = new Float32Array(ribbonPositions.length);
  ribbonGeometry.setAttribute('position', new T.BufferAttribute(ribbonPositions, 3));
  ribbonGeometry.setAttribute('color', new T.BufferAttribute(ribbonColors, 3));
  ribbonGeometry.setDrawRange(0, 0);
  const ribbons = new T.Mesh(
    ribbonGeometry,
    new T.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      side: T.DoubleSide,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  ribbons.frustumCulled = false;
  root.add(ribbons);
  const light = new T.PointLight(0xff1435, 0, 22, 2);
  light.position.set(0, 3, 1.5);
  root.add(light);
  const anchors = [
    [-1.6, 4.6, 1],
    [1.6, 4.6, 1],
    [-1.1, 2.8, 1.3],
    [1.1, 2.8, 1.3],
    [-0.8, 0.9, 0.3],
    [0.8, 0.9, 0.3],
  ].map((v) => new T.Vector3(...v));
  const samples = [];
  let echoTimer = 0,
    echoIndex = 0,
    wasActive = false;
  return {
    update(player, dt) {
      const active = player.hp > 0 && player.moveKind === 'dash' && player.moveTime > 0;
      const level = impactLevel();
      shellMaterial.opacity = 0.45 + level * 0.45;
      ribbons.material.opacity = 0.35 + level * 0.5;
      for (const { node, material } of edges) node.material = active ? edgeMaterial : material;
      for (const shell of shells) shell.visible = active;
      light.intensity = active ? 22 : Math.max(0, light.intensity - dt * 85);
      root.updateWorldMatrix(true, true);
      inverse.copy(root.matrixWorld).invert();
      for (const echo of echoes) {
        echo.life = Math.max(0, echo.life - dt);
        echo.mesh.visible = echo.life > 0 && level === 1;
        echo.mesh.material.opacity = (0.38 * echo.life) / 0.36;
        echo.mesh.matrix.multiplyMatrices(inverse, echo.world);
      }
      for (const sample of samples) sample.life -= dt;
      while (samples[0]?.life <= 0) samples.shift();
      if (active) {
        if (!wasActive) echoTimer = 0;
        echoTimer -= dt;
        if (echoTimer <= 0) {
          const echo = echoes[echoIndex++ % echoes.length];
          echo.world.copy(root.matrixWorld);
          echo.life = 0.36;
          echo.mesh.visible = level === 1;
          echo.mesh.material.opacity = 0.38;
          echo.mesh.matrix.identity();
          echoTimer = 0.045;
        }
        samples.push({ points: anchors.map((p) => root.localToWorld(p.clone())), life: 0.5 });
        if (samples.length > 37) samples.shift();
      }
      let index = 0;
      for (let i = 1; i < samples.length; i++)
        for (let j = 0; j < anchors.length; j++) {
          const a = samples[i - 1],
            b = samples[i],
            av = a.points[j].clone().applyMatrix4(inverse),
            bv = b.points[j].clone().applyMatrix4(inverse);
          for (const [pt, side, life] of [
            [av, -1, a.life],
            [av, 1, a.life],
            [bv, 1, b.life],
            [av, -1, a.life],
            [bv, 1, b.life],
            [bv, -1, b.life],
          ]) {
            const fade = Math.max(0, life / 0.5),
              width = (j < 2 ? 0.55 : 0.34) * fade;
            ribbonPositions[index] = pt.x + side * width;
            ribbonPositions[index + 1] = pt.y + side * width * 0.3;
            ribbonPositions[index + 2] = pt.z;
            ribbonColors[index] = fade;
            ribbonColors[index + 1] = 0.012 * fade;
            ribbonColors[index + 2] = 0.045 * fade;
            index += 3;
          }
        }
      ribbonGeometry.setDrawRange(0, index / 3);
      ribbonGeometry.attributes.position.needsUpdate = true;
      ribbonGeometry.attributes.color.needsUpdate = true;
      ribbons.visible = index > 0;
      wasActive = active;
    },
    dispose() {
      for (const { node, material } of edges) node.material = material;
      for (const shell of shells) shell.removeFromParent();
      for (const echo of echoes) {
        echo.mesh.removeFromParent();
        echo.mesh.material.dispose();
      }
      ribbons.removeFromParent();
      light.removeFromParent();
      echoGeometry.dispose();
      ribbonGeometry.dispose();
      ribbons.material.dispose();
      edgeMaterial.dispose();
      shellMaterial.dispose();
    },
  };
}
