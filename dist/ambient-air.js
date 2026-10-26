import * as T from './vendor/three.module.min.js';
import { environmentPalette } from './visual-quality.js';
import { surfaceMask } from './surface-pool.js';

// A sparse peripheral volume; no fog sheets, light shafts, screen overlay, or new lights.
export function createAmbientAir(parent, budget, { theme = 'scrapyard', hub = false } = {}) {
  const geometry = new T.BufferGeometry(),
    data = new Float32Array(budget.motes * 3),
    attribute = new T.BufferAttribute(data, 3),
    mask = surfaceMask(),
    material = new T.PointsMaterial({
      color: environmentPalette(theme).dust,
      map: mask,
      size: hub ? 0.12 : 0.16,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      sizeAttenuation: true,
    }),
    points = new T.Points(geometry, material);
  geometry.setAttribute('position', attribute);
  attribute.setUsage(T.DynamicDrawUsage);
  points.frustumCulled = false;
  points.raycast = () => {};
  points.name = 'peripheral industrial air';
  parent.add(points);
  return {
    points,
    update(time, x = 0, z = 0, reduced = false) {
      points.visible = !reduced;
      if (reduced) return;
      const phase = theme === 'foundry' || theme === 'reactor' ? 0.3 : -0.13;
      for (let i = 0; i < budget.motes; i++) {
        const angle = i * 2.399963 + time * 0.006,
          radius = (hub ? 20 : 22) + ((i * 17) % (hub ? 35 : 55)),
          j = i * 3;
        data[j] = x + Math.cos(angle) * radius;
        data[j + 1] = 5 + ((((i * 1.73 + time * phase) % 20) + 20) % 20);
        data[j + 2] = z + Math.sin(angle) * radius;
      }
      attribute.needsUpdate = true;
    },
    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      mask.dispose();
    },
  };
}
