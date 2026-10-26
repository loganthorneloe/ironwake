import * as T from './vendor/three.module.min.js';
import { impactLevel } from './impact-preferences.js';

const MAX_HITS = 36,
  SPARKS = 14;
const PALETTE = {
  precision: '#fff0a0',
  melee: '#a4ffff',
  blade: '#a4ffff',
  bladeWave: '#a4ffff',
  hammer: '#d7a5ff',
  lance: '#b0f5ff',
  claws: '#a4ffff',
  scythe: '#a4ffff',
  phaser: '#91ffc5',
  plasma: '#d2a2ff',
  overload: '#d2a2ff',
  scatter: '#e2b8ff',
  rotary: '#ff8195',
  carbine: '#9df6ff',
  rail: '#adf7ff',
  dynamo: '#ffe591',
};
export function burstGeometry(spikes = 9) {
  const vertices = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes,
      b = ((i + 1) * Math.PI) / spikes;
    const radius = (j) => (j % 2 ? 0.19 : 1 - (j % 6) * 0.065);
    vertices.push(
      0,
      0,
      0,
      Math.cos(a) * radius(i),
      Math.sin(a) * radius(i),
      0,
      Math.cos(b) * radius(i + 1),
      Math.sin(b) * radius(i + 1),
      0,
    );
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  return geometry;
}
export function addMuzzleBurst(parent, color) {
  const geometry = burstGeometry(7),
    materials = [
      new T.MeshBasicMaterial({ color: '#101524', side: T.DoubleSide, depthWrite: false }),
      new T.MeshBasicMaterial({ color, side: T.DoubleSide, depthWrite: false }),
      new T.MeshBasicMaterial({ color: '#fffbe8', side: T.DoubleSide, depthWrite: false }),
    ];
  materials.forEach((material, i) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.z = -0.26 - i * 0.015;
    mesh.scale.setScalar([1.15, 0.97, 0.55][i]);
    mesh.rotation.z = i * 0.18;
    parent.add(mesh);
  });
  parent.userData.disposeBurst = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  };
}

// Fixed-size instanced pools keep dense co-op volleys bounded.
export function createImpactPool(parent) {
  const star = burstGeometry(11),
    shard = new T.ConeGeometry(1, 1, 4),
    arc = new T.RingGeometry(0.88, 1, 28, 1, 0, Math.PI * 1.45),
    stamp = new T.Object3D(),
    tint = new T.Color(),
    fadedTint = new T.Color(),
    hotTint = new T.Color('#fff6df'),
    axis = new T.Vector3(0, 1, 0),
    direction = new T.Vector3(),
    local = new T.Vector3();
  const make = (geometry, count, color) => {
    const mesh = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({
        color,
        side: T.DoubleSide,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
      count,
    );
    mesh.frustumCulled = false;
    mesh.count = 0;
    parent.add(mesh);
    return mesh;
  };
  const ink = make(star, MAX_HITS, '#0e1420'),
    cores = make(star, MAX_HITS, '#ffffff'),
    white = make(star, MAX_HITS, '#fffdf3'),
    sparks = make(shard, MAX_HITS * SPARKS, '#ffffff'),
    slashes = make(arc, MAX_HITS * 2, '#ffffff');
  return {
    update(events, camera) {
      let hits = 0,
        pieces = 0,
        cuts = 0;
      const level = impactLevel();
      camera.getWorldDirection(direction);
      for (let i = events.length - 1; i >= 0 && hits < MAX_HITS; i--) {
        const event = events[i],
          age = Math.max(0, 1 - event.life);
        const melee =
            ['melee', 'hammer', 'lance', 'claws', 'scythe', 'dash'].includes(event.kind) ||
            event.weapon === 'melee',
          incoming = event.kind === 'incoming';
        const duration = melee ? 0.4 : 0.32;
        if (age > duration || event.kind === 'burn' || (event.kind === 'phaser' && event.id % 3))
          continue;
        const fade = Math.max(0, 1 - age / duration),
          power =
            Math.min(3.4, 0.8 + Math.sqrt(event.amount || 20) / 11) *
            (melee ? 1.45 : incoming ? 1.35 : 1),
          reach = (1 - Math.exp(-age * 24)) * power * 1.9;
        const x = event.x * 0.1,
          y = ((event.z ?? 65) - (incoming ? 0 : 28)) * 0.1,
          z = event.y * 0.1;
        tint.set(
          incoming
            ? event.weapon === 'guard'
              ? '#9ceaff'
              : '#ff995c'
            : PALETTE[event.kind] || '#ffd59b',
        );
        stamp.position.set(x, y, z);
        stamp.quaternion.copy(camera.quaternion);
        stamp.rotateZ(event.id * 2.399);
        const size =
          power * (age < 0.045 ? 1.9 : Math.max(0.01, 1 - age / 0.24)) * (0.45 + level * 0.55);
        stamp.scale.set(size * (melee ? 1.8 : 1.3), size, 0.01);
        stamp.updateMatrix();
        ink.setMatrixAt(hits, stamp.matrix);
        stamp.position.addScaledVector(direction, -0.025);
        stamp.scale.multiplyScalar(0.8);
        stamp.updateMatrix();
        cores.setMatrixAt(hits, stamp.matrix);
        cores.setColorAt(hits, tint);
        stamp.position.addScaledVector(direction, -0.025);
        stamp.scale.multiplyScalar(age < 0.055 ? 0.78 : 0.38);
        stamp.updateMatrix();
        white.setMatrixAt(hits, stamp.matrix);
        hits++;
        if (melee) {
          for (let j = 0; j < 2; j++) {
            stamp.position.set(x, y, z).addScaledVector(direction, -0.08 - j * 0.01);
            stamp.quaternion.copy(camera.quaternion);
            stamp.rotateZ(event.id * 2.399 + j * 1.8 + age * 4);
            const sweep = power * (0.45 + age * 5) * fade * (0.45 + level * 0.55);
            stamp.scale.set(sweep * (j ? 1.3 : 2.2), sweep * (j ? 0.45 : 0.32), 0.01);
            stamp.updateMatrix();
            slashes.setMatrixAt(cuts, stamp.matrix);
            slashes.setColorAt(cuts, fadedTint.copy(tint).multiplyScalar(fade));
            cuts++;
          }
        }
        for (let j = 0; j < SPARKS; j++) {
          const angle = (j * Math.PI * 2) / SPARKS + event.id * 0.7;
          local
            .set(Math.cos(angle), Math.sin(angle), 0.12 * Math.sin(j * 7))
            .applyQuaternion(camera.quaternion);
          stamp.position.set(x, y, z).addScaledVector(local, reach * (1 + (j % 3) * 0.4));
          stamp.quaternion.setFromUnitVectors(axis, local.normalize());
          const width = 0.055 * power * fade * level;
          stamp.scale.set(width, Math.max(0.01, fade * power * (j % 2 ? 1.1 : 2.5)), width);
          stamp.updateMatrix();
          sparks.setMatrixAt(pieces, stamp.matrix);
          sparks.setColorAt(pieces, j % 3 ? tint : hotTint);
          pieces++;
        }
      }
      for (const [mesh, count] of [
        [ink, hits],
        [cores, hits],
        [white, hits],
        [sparks, pieces],
        [slashes, cuts],
      ]) {
        mesh.count = count;
        mesh.visible = count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    dispose() {
      for (const mesh of [ink, cores, white, sparks, slashes]) {
        mesh.removeFromParent();
        mesh.material.dispose();
        mesh.dispose();
      }
      star.dispose();
      shard.dispose();
      arc.dispose();
    },
  };
}
