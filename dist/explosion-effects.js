import * as T from './vendor/three.module.min.js';
import { impactLevel } from './impact-preferences.js';
import { burstGeometry } from './impact-effects.js';

const MAX_BURSTS = 18,
  FIRE = 16,
  CLOUDS = 12,
  SPARKS = 24;
// Ink, hot core, smoke, debris and pressure arcs batch across all explosions.
export function createExplosionPool(parent) {
  const rock = new T.IcosahedronGeometry(1, 0),
    arc = new T.RingGeometry(0.91, 1, 32, 1, 0, Math.PI * 1.45),
    star = burstGeometry(12),
    stamp = new T.Object3D(),
    direction = new T.Vector3(),
    up = new T.Vector3(0, 1, 0),
    color = new T.Color();
  function layer(geometry, count, opacity = 1) {
    const material = new T.MeshBasicMaterial({
      color: '#ffffff',
      transparent: opacity < 1,
      opacity,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const mesh = new T.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.count = 0;
    parent.add(mesh);
    return mesh;
  }
  const ink = layer(rock, MAX_BURSTS * FIRE),
    fire = layer(rock, MAX_BURSTS * FIRE),
    cloud = layer(rock, MAX_BURSTS * CLOUDS, 0.46),
    sparks = layer(rock, MAX_BURSTS * SPARKS),
    pressure = layer(arc, MAX_BURSTS * 5, 0.75),
    flash = layer(star, MAX_BURSTS);
  pressure.material.blending = T.AdditiveBlending;
  const put = (mesh, index, tint) => {
    stamp.updateMatrix();
    mesh.setMatrixAt(index, stamp.matrix);
    color.set(tint);
    mesh.setColorAt(index, color);
  };
  return {
    update(events, camera) {
      let flames = 0,
        smoke = 0,
        shards = 0,
        arcs = 0,
        flashes = 0,
        bursts = 0;
      const level = impactLevel();
      cloud.material.opacity = 0.15 + level * 0.09;
      for (let i = events.length - 1; i >= 0 && bursts < MAX_BURSTS; i--) {
        const e = events[i];
        if (e.kind !== 'explosion') continue;
        bursts++;
        const max = Math.max(0.01, e.max || 0.8),
          age = Math.max(0, max - e.life),
          progress = Math.min(1, age / max),
          fade = 1 - progress;
        const slam = e.weapon === 'slam',
          plasma = e.weapon === 'plasma' || slam,
          radius = Math.max(0.5, e.r * 0.1) * (0.85 + level * 0.7) * (slam ? 0.68 : 1),
          spread = 1 - Math.exp(-age * 21),
          seed = e.id || 0;
        const x = e.x * 0.1,
          y = Math.max(0.25, (e.z || 0) * 0.1),
          z = e.y * 0.1;
        for (let j = 0; j < FIRE; j++) {
          const angle = j * 2.39996 + seed * 0.71,
            lift = Math.sin(j * 6.73 + seed) * (slam ? 0.15 : 0.65);
          direction.set(Math.cos(angle), lift, Math.sin(angle)).normalize();
          stamp.position
            .set(x, y, z)
            .addScaledVector(direction, radius * spread * (j === 0 ? 0 : 0.18 + (j % 4) * 0.12));
          stamp.rotation.set(slam ? 0 : angle, age * (j % 2 ? 2 : -2), slam ? 0 : angle * 0.3);
          const size =
            radius *
            (j === 0 ? 0.64 : 0.32) *
            Math.max(0.05, spread) *
            Math.pow(fade, 0.8) *
            (j % 2 ? 0.88 : 1.12) *
            (0.8 + level * 0.2);
          stamp.scale.set(
            size * 1.14,
            size * (slam ? 0.3 : plasma ? 0.8 : 1.2) * 1.14,
            size * 1.14,
          );
          put(ink, flames, '#17202c');
          stamp.scale.multiplyScalar(0.86);
          put(
            fire,
            flames,
            age < 0.06
              ? '#fffbe6'
              : plasma
                ? j % 3
                  ? '#b17dff'
                  : '#f2caff'
                : age < 0.19
                  ? j % 3
                    ? '#ffdf86'
                    : '#fff6ce'
                  : j % 3
                    ? '#f57639'
                    : '#ffb64f',
          );
          flames++;
        }
        // Smoke animates on twos, with a stepped, drawn-cel silhouette.
        const celAge = Math.floor(age * 24) / 24;
        for (let j = 0; j < CLOUDS; j++) {
          const angle = j * 2.39996 + seed * 0.6,
            reach = radius * (slam ? 0.7 + progress * 0.55 : 0.32 + progress * 0.65);
          stamp.position.set(
            x + Math.cos(angle) * reach,
            y + celAge * radius * (slam ? 0.12 : 0.3 + (j % 3) * 0.1),
            z + Math.sin(angle) * reach,
          );
          stamp.rotation.set(angle, celAge * (j % 2 ? 1 : -1), angle * 0.3);
          const size =
            radius *
            (0.13 + progress * 0.26) *
            Math.sin(progress * Math.PI) *
            (0.9 + (j % 3) * 0.15) *
            (slam ? 0.55 : 1);
          stamp.scale.set(size, size * 0.85, size);
          put(
            cloud,
            smoke,
            plasma ? (j % 2 ? '#4e385d' : '#78628b') : j % 2 ? '#293340' : '#58636b',
          );
          smoke++;
        }
        for (let j = 0; j < SPARKS; j++) {
          const angle = j * 2.399 + seed;
          direction.set(Math.cos(angle), 0.15 + (j % 5) * 0.23, Math.sin(angle)).normalize();
          stamp.position
            .set(x, y, z)
            .addScaledVector(direction, radius * spread * (0.65 + (j % 6) * 0.22));
          stamp.position.y -= age * age * radius * 0.65;
          stamp.quaternion.setFromUnitVectors(up, direction);
          const width = radius * 0.014 * fade * level;
          stamp.scale.set(width, width * (j % 3 ? 18 : 32), width);
          put(sparks, shards, plasma ? '#e4c9ff' : j % 3 ? '#ffe8b5' : '#17202c');
          shards++;
        }
        for (let j = 0; j < 5; j++) {
          stamp.position.set(
            x,
            j < 3 || slam ? Math.max(0.18, y - radius * 0.15) + j * 0.06 : y,
            z,
          );
          stamp.rotation.set(j < 3 || slam ? -Math.PI / 2 : j * 0.8, 0, j * Math.PI * 0.7 + seed);
          stamp.scale.setScalar(
            Math.max(0.01, radius * (0.15 + spread * (1.2 + j * 0.12)) * (1 - progress * 0.35)),
          );
          put(pressure, arcs, plasma ? '#cbaaff' : '#f4d4a2');
          color.multiplyScalar(fade * level);
          pressure.setColorAt(arcs, color);
          arcs++;
        }
        if (level === 1 && !slam && age < 0.085 && camera) {
          stamp.position.set(x, y, z);
          stamp.quaternion.copy(camera.quaternion);
          stamp.rotateZ(seed * 2.399);
          const size = radius * 1.9 * (1 - age / 0.085);
          stamp.scale.set(size * 1.5, size, 0.01);
          put(flash, flashes, '#fff6d5');
          flashes++;
        }
      }
      for (const [mesh, count] of [
        [ink, flames],
        [fire, flames],
        [cloud, smoke],
        [sparks, shards],
        [pressure, arcs],
        [flash, flashes],
      ]) {
        mesh.count = count;
        mesh.visible = count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [ink, fire, cloud, sparks, pressure, flash]) {
        mesh.removeFromParent();
        mesh.material.dispose();
        mesh.dispose();
      }
      rock.dispose();
      arc.dispose();
      star.dispose();
    },
  };
}
