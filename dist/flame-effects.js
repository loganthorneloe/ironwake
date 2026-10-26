import * as T from './vendor/three.module.min.js';
const geometry = new T.IcosahedronGeometry(1, 0),
  stamp = new T.Object3D(),
  axis = new T.Vector3(0, 0, 1),
  direction = new T.Vector3(),
  color = new T.Color();
export function makeFlameEffect(parent) {
  const group = new T.Group(),
    material = new T.MeshBasicMaterial({
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: T.NormalBlending,
      vertexColors: false,
    }),
    particles = new T.InstancedMesh(geometry, material, 48);
  particles.frustumCulled = false;
  group.add(particles);
  parent.add(group);
  group.visible = false;
  return {
    group,
    update(start, end, t, active) {
      group.visible = active;
      if (!active) return;
      direction.copy(end).sub(start);
      const length = direction.length();
      group.position.copy(start);
      group.quaternion.setFromUnitVectors(axis, direction.normalize());
      for (let i = 0; i < 48; i++) {
        const f = (t * 3.8 + i / 48) % 1,
          angle = i * 2.399 + t * 0.8,
          radius = f * length * 0.25;
        stamp.position.set(
          (Math.sin(angle) * radius * (i % 3)) / 3,
          (Math.cos(angle) * radius * (i % 4)) / 4,
          f * length,
        );
        stamp.rotation.set(t * 4 + i, i, t * 2);
        const size = (0.08 + f * length * 0.11) * Math.min(1, (1 - f) * 5);
        stamp.scale.set(size, size, size * 1.65);
        stamp.updateMatrix();
        particles.setMatrixAt(i, stamp.matrix);
        color.set(f < 0.18 ? '#fff7d5' : f < 0.55 ? '#ffbe52' : f < 0.85 ? '#f56c2e' : '#8a382c');
        particles.setColorAt(i, color);
      }
      particles.instanceMatrix.needsUpdate = true;
      particles.instanceColor.needsUpdate = true;
    },
    dispose() {
      particles.dispose();
      material.dispose();
      group.removeFromParent();
    },
  };
}
