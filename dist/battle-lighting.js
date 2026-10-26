import * as T from './vendor/three.module.min.js';
import { environmentPalette, shadowAnchor } from './visual-quality.js';

export function createBattleLighting(scene, sun, budget) {
  const hemisphere = scene.children.find((o) => o.isHemisphereLight),
    fill = new T.DirectionalLight('#86b8cf', 0.45);
  fill.position.set(40, 28, 55);
  scene.add(fill);
  sun.shadow.mapSize.set(budget.shadowSize, budget.shadowSize);
  sun.shadow.intensity = 0.78;
  return {
    setMission(m) {
      // Preserve the space-station and workshop palette; outdoor sorties share Anchorage light.
      const outside = m.mode === 'operation' || m.destructible;
      const palette = environmentPalette(m.spec?.theme);
      sun.color.set(outside ? palette.key : '#e5edff');
      hemisphere.color.set(outside ? palette.sky : '#aacaff');
      hemisphere.groundColor.set(outside ? palette.ground : '#18243f');
      fill.visible = outside;
      sun.intensity = outside ? 2.15 : 2.4;
    },
    update(x, z) {
      const focus = shadowAnchor(x, z, budget.shadowSize);
      sun.target.position.set(focus.x, focus.y, focus.z);
      sun.position.set(focus.x - 50, focus.y + 85, focus.z - 45);
    },
  };
}
