import * as T from './vendor/three.module.min.js';

// Small procedural masks avoid external assets, canvas uploads and render targets.
export function surfaceMask(scorched = false) {
  const size = 32,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = ((x + 0.5) / size) * 2 - 1,
        dy = ((y + 0.5) / size) * 2 - 1,
        radius = Math.hypot(dx, dy),
        angle = Math.atan2(dy, dx),
        edge = scorched ? 0.88 + Math.sin(angle * 7) * 0.06 + Math.cos(angle * 11) * 0.04 : 1,
        alpha = Math.max(0, 1 - radius / edge) ** (scorched ? 1.1 : 2),
        i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.colorSpace = T.NoColorSpace;
  texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// One draw call per pool. Per-instance opacity keeps airborne shadows soft and marks fading.
export function createSurfacePool(parent, capacity, texture, color, additive = false) {
  const geometry = new T.PlaneGeometry(2, 2),
    opacity = new T.InstancedBufferAttribute(new Float32Array(capacity), 1),
    material = new T.MeshBasicMaterial({
      color,
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  geometry.setAttribute('surfaceOpacity', opacity);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float surfaceOpacity; varying float vSurfaceOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSurfaceOpacity = surfaceOpacity;',
    );
    shader.fragmentShader = 'varying float vSurfaceOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= vSurfaceOpacity;',
    );
  };
  material.customProgramCacheKey = () => 'ironwake-surface-opacity-v1';
  const mesh = new T.InstancedMesh(geometry, material, capacity),
    stamp = new T.Object3D(),
    face = new T.Vector3(0, 0, 1);
  mesh.name = additive ? 'practical light pools' : 'ground contact';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.raycast = () => {};
  parent.add(mesh);
  return {
    mesh,
    begin() {
      mesh.count = 0;
    },
    put(x, y, z, radius, strength, angle = 0, normal = null) {
      if (mesh.count >= capacity || radius < 0.08 || strength <= 0.001) return;
      stamp.position.set(x, y, z);
      stamp.rotation.set(-Math.PI / 2, 0, angle);
      if (normal) {
        stamp.quaternion.setFromUnitVectors(face, normal);
        stamp.rotateZ(angle);
      }
      stamp.scale.set(radius, radius, 1);
      stamp.updateMatrix();
      mesh.setMatrixAt(mesh.count, stamp.matrix);
      opacity.setX(mesh.count++, strength);
    },
    end() {
      mesh.instanceMatrix.needsUpdate = opacity.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
