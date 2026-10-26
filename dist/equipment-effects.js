import * as T from './vendor/three.module.min.js';
import { ABILITIES, WEAPONS, equipmentFor } from './core.js?v=41';
import { impactLevel } from './impact-preferences.js';
import { ITEM_TINTS } from './item-models.js';
import { fieldModifiers } from './sortie-progression.js';
import { fieldArea } from './field-combat.js';

const up = new T.Vector3(0, 1, 0);
// Four fields and eight hands share three fixed instanced pools. No particles are allocated per frame.
export function createEquipmentFX(parent, { fieldScale = 1 } = {}) {
  const root = new T.Group();
  root.name = 'equipment-usage-effects';
  parent.add(root);
  const geometries = [
    new T.TorusGeometry(1, 0.018, 4, 64),
    new T.OctahedronGeometry(1, 0),
    new T.RingGeometry(0.9, 1, 40, 1, 0, Math.PI * 1.3),
  ];
  const capacities = [128, 640, 64],
    pools = geometries.map((geo, i) => {
      const m = new T.InstancedMesh(
        geo,
        new T.MeshBasicMaterial({
          transparent: true,
          opacity: i === 1 ? 0.8 : 0.55,
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
        capacities[i],
      );
      m.frustumCulled = false;
      m.count = 0;
      root.add(m);
      return m;
    });
  const boltPositions = new Float32Array(512 * 6),
    boltColors = new Float32Array(512 * 6),
    boltGeometry = new T.BufferGeometry();
  boltGeometry.setAttribute('position', new T.BufferAttribute(boltPositions, 3));
  boltGeometry.setAttribute('color', new T.BufferAttribute(boltColors, 3));
  boltGeometry.setDrawRange(0, 0);
  const bolts = new T.LineSegments(
    boltGeometry,
    new T.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  bolts.frustumCulled = false;
  root.add(bolts);
  let boltCount = 0;
  const shellGeometry = new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    shells = [];
  for (let i = 0; i < 4; i++) {
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      uniforms: {
        tint: { value: new T.Color('#78afff') },
        strength: { value: 0 },
        clock: { value: 0 },
        motion: { value: 1 },
      },
      vertexShader:
        'varying vec3 n;varying vec3 v;varying vec3 p;void main(){p=position;n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
      fragmentShader: `
   uniform vec3 tint;uniform float strength;uniform float clock;uniform float motion;varying vec3 n;varying vec3 v;varying vec3 p;
   void main(){
    float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.8);
    vec2 uv=vec2(atan(p.z,p.x)*7.64,acos(clamp(p.y,-1.,1.))*15.28);
    vec2 hex=vec2(1.732,3.);
    vec2 a=mod(uv,hex)-hex*.5;
    vec2 b=mod(uv-hex*.5,hex)-hex*.5;
    vec2 cell=dot(a,a)<dot(b,b)?a:b;
    cell=abs(cell);
    float edge=max(dot(cell,normalize(vec2(1.,1.732))),cell.x);
    float grid=smoothstep(.78,.85,edge);
    float scan=pow(max(0.,sin(p.y*28.-clock*2.*motion)),18.)*.09;
    float alpha=(.018+rim*.22+grid*.045+scan)*strength;
    gl_FragColor=vec4(tint,alpha);
   }`,
    });
    const shell = new T.Mesh(shellGeometry, material);
    shell.visible = false;
    root.add(shell);
    shells.push(shell);
  }
  const counts = [0, 0, 0],
    stamp = new T.Object3D(),
    color = new T.Color(),
    position = new T.Vector3(),
    end = new T.Vector3(),
    axis = new T.Vector3(),
    orientation = new T.Quaternion(),
    local = new T.Vector3();
  function bolt(ax, ay, az, bx, by, bz, tint, fade) {
    if (boltCount >= 512 || fade <= 0.005) return;
    const i = boltCount++ * 6;
    boltPositions.set([ax, ay, az, bx, by, bz], i);
    color.set(tint).multiplyScalar(fade);
    boltColors.set([color.r, color.g, color.b, color.r, color.g, color.b], i);
  }
  function put(pool, x, y, z, sx, sy, sz, tint, fade = 1, quaternion = null, angle = 0) {
    const i = counts[pool];
    if (i >= capacities[pool] || fade <= 0.005) return;
    stamp.position.set(x, y, z);
    stamp.scale.set(sx, sy, sz);
    stamp.quaternion.copy(quaternion || identity);
    if (angle) stamp.rotateZ(angle);
    stamp.updateMatrix();
    pools[pool].setMatrixAt(i, stamp.matrix);
    pools[pool].setColorAt(i, color.set(tint).multiplyScalar(Math.min(1, fade)));
    counts[pool]++;
  }
  const identity = new T.Quaternion(),
    horizontal = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  return {
    root,
    pools,
    shells,
    update(w, t, models) {
      counts.fill(0);
      boltCount = 0;
      const full = impactLevel() === 1,
        level = impactLevel(),
        motion = full ? 1 : 0,
        clock = w.time ?? t;
      shells.forEach((s) => (s.visible = false));
      for (const [index, p] of w.players.slice(0, 4).entries()) {
        if (p.hp <= 0) continue;
        const special = p.activeAbility || equipmentFor(p.build)[2],
          ability = ABILITIES[special];
        const x = p.x * 0.1,
          y = (p.altitude || 0) * 0.1 + 0.15,
          z = p.y * 0.1;
        if (p.active > 0 && ability) {
          const age = Math.max(0, ability.duration - p.active),
            radius = ability.radius * fieldArea(fieldModifiers(p)),
            r = radius * 0.1 * fieldScale,
            tint = ITEM_TINTS[special],
            fade = Math.min(1, p.active * 2, age * 5 + 0.15),
            burst = Math.max(0, 1 - age / 1.1);
          if (special === 'shield') {
            const shell = shells[index];
            shell.visible = true;
            shell.position.set(x, y, z);
            shell.scale.setScalar(r * Math.min(1, 0.12 + age * 3));
            shell.material.uniforms.clock.value = clock;
            shell.material.uniforms.strength.value = fade * (full ? 1 : 0.65);
            shell.material.uniforms.motion.value = motion;
            for (let j = 0; j < 3; j++) {
              const lat = [0.03, 0.42, 0.74][j],
                radius = r * Math.sqrt(1 - lat * lat);
              put(
                0,
                x,
                y + lat * r,
                z,
                radius,
                radius,
                radius,
                tint,
                fade * (j ? 0.26 : 0.7),
                horizontal,
              );
            }
            for (let j = 0; j < (full ? 18 : 6); j++) {
              const a = (j * Math.PI * 2) / (full ? 18 : 6) + clock * 0.12 * motion;
              put(
                1,
                x + Math.cos(a) * r,
                y + 0.25,
                z + Math.sin(a) * r,
                0.07,
                0.45,
                0.07,
                tint,
                fade,
              );
            }
            const hit = (w.damageEvents || []).find(
              (e) => e.target === p.id && e.kind === 'incoming' && e.life > 0.7,
            );
            if (hit) {
              const f = 1 - hit.life,
                reach = r * (0.12 + f * 2);
              put(
                0,
                x,
                y + r * 0.4,
                z,
                reach,
                reach,
                reach,
                '#c7ecff',
                (1 - f / 0.3) * level,
                horizontal,
              );
            }
          } else if (special === 'emp') {
            for (let j = 0; j < 3; j++) {
              const f = Math.min(1, Math.max(0, (age - j * 0.12) / 0.8));
              if (f > 0 && f < 1)
                put(
                  0,
                  x,
                  y + 0.2 + j * 0.4,
                  z,
                  r * f,
                  r * f,
                  r * f,
                  tint,
                  (1 - f) * level,
                  horizontal,
                );
            }
            // Branching electric spokes travel with the expanding leading edge.
            for (let j = 0; j < (full ? 32 : 8); j++) {
              const a = j * 2.399,
                reach = r * Math.min(1, age / 0.7),
                jag = Math.sin(j * 13 + Math.floor(age * 12)) * 0.5 * motion;
              put(
                1,
                x + Math.cos(a) * reach,
                y + 0.6 + jag,
                z + Math.sin(a) * reach,
                0.045,
                0.4 + burst * 1.6,
                0.045,
                tint,
                burst * level,
              );
            }
            for (let j = 0; j < (full ? 16 : 4); j++) {
              const a = j * 2.399,
                reach = r * Math.min(1, age / 0.7);
              let ax = x,
                ay = y + 3,
                az = z;
              for (let n = 1; n <= 6; n++) {
                const f = n / 6,
                  jag =
                    Math.sin(j * 7 + n * 13 + Math.floor(age * 10) * motion) *
                    (n === 6 ? 0 : 0.6) *
                    level,
                  bx = x + Math.cos(a) * reach * f + Math.sin(a) * jag,
                  bz = z + Math.sin(a) * reach * f - Math.cos(a) * jag,
                  by = y + 3 * (1 - f) + jag;
                bolt(ax, ay, az, bx, by, bz, tint, burst * level);
                ax = bx;
                ay = by;
                az = bz;
              }
            }
            for (const enemy of (w.enemies || [])
              .filter(
                (e) =>
                  e.hp > 0 &&
                  e.stun > 0 &&
                  Math.hypot(e.x - p.x, e.y - p.y, (e.altitude || 0) - (p.altitude || 0)) < radius,
              )
              .slice(0, 8)) {
              const ex = enemy.x * 0.1,
                ey = (enemy.altitude || 0) * 0.1 + 4,
                ez = enemy.y * 0.1;
              put(0, ex, ey, ez, 0.7, 0.7, 0.7, tint, 0.5 * fade * level, horizontal);
              for (let j = 0; j < (full ? 5 : 2); j++) {
                const a = j * 2.399 + Math.floor(clock * 8) * motion;
                bolt(
                  ex + Math.cos(a) * 0.7,
                  ey - 0.7,
                  ez + Math.sin(a) * 0.7,
                  ex + Math.cos(a + 1) * 0.9,
                  ey + 0.4,
                  ez + Math.sin(a + 1) * 0.9,
                  tint,
                  fade * level,
                );
              }
            }
            const corona = r * 0.2;
            put(0, x, y + 2, z, corona, corona, corona, tint, 0.2 * fade, horizontal);
          } else {
            put(0, x, y, z, r, r, r, tint, fade * 0.65, horizontal);
            put(0, x, y + 0.12, z, r * 0.92, r * 0.92, r * 0.92, tint, fade * 0.3, horizontal);
            for (let j = 0; j < (full ? 36 : 10); j++) {
              const f = (clock * 0.22 * motion + j / 36) % 1,
                a = j * 2.399 + clock * 0.2 * motion,
                reach = r * Math.sqrt(((j % 11) + 1) / 12),
                px = x + Math.cos(a) * reach,
                pz = z + Math.sin(a) * reach,
                py = y + f * 4.5;
              const size = 0.1 * (1 - f * 0.6),
                strength = fade * (1 - f) * 0.8;
              put(1, px, py, pz, size, size * 3, size, tint, strength);
              put(1, px, py, pz, size * 3, size, size, tint, strength);
            }
            // Visible flow reaches only living allies actually inside the spherical repair radius.
            for (const ally of w.players.slice(0, 4))
              if (ally.hp > 0) {
                end.set(ally.x * 0.1, (ally.altitude || 0) * 0.1 + 3, ally.y * 0.1);
                position.set(x, y + 4, z);
                if (
                  Math.hypot(
                    ally.x - p.x,
                    ally.y - p.y,
                    (ally.altitude || 0) - (p.altitude || 0),
                  ) >= radius
                )
                  continue;
                for (let j = 0; j < 4; j++) {
                  local.lerpVectors(position, end, (clock * 0.6 * motion + j / 4) % 1);
                  put(1, local.x, local.y, local.z, 0.09, 0.25, 0.09, tint, fade * 0.65);
                }
              }
            for (let j = 0; j < 3; j++) {
              const a = (j * Math.PI * 2) / 3 + clock * 0.4 * motion,
                dx = x + Math.cos(a) * 2,
                dy = y + 4 + Math.sin(clock * 2 * motion + j) * 0.2,
                dz = z + Math.sin(a) * 2;
              put(1, dx, dy, dz, 0.2, 0.12, 0.35, tint, fade);
              put(0, dx, dy + 0.13, dz, 0.38, 0.38, 0.38, tint, fade * 0.6, horizontal);
            }
          }
          // A short cast glyph links the field to the physical dorsal emitter.
          if (burst > 0)
            put(
              2,
              x,
              y + 4,
              z,
              1 + age * 4,
              1 + age * 4,
              1,
              tint,
              burst * level,
              horizontal,
              age * motion,
            );
        }
        const model = models?.get(p.id);
        if (!model?.userData.kits) continue;
        for (const kit of model.userData.kits) {
          const h = p.hands?.[kit.hand] || {},
            id = kit.item,
            tint = ITEM_TINTS[id],
            weapon = WEAPONS[id];
          if (!weapon) continue;
          kit.root.updateWorldMatrix(true, false);
          kit.root.getWorldQuaternion(orientation);
          kit.muzzle.getWorldPosition(position);
          const charge =
            id === 'rail' ? h.railCharge || 0 : id === 'dynamo' ? (h.motionCharge ?? 1) : 0;
          if (charge > 0) {
            for (let j = 0; j < 3; j++) {
              const size = (0.3 + j * 0.17) * (id === 'dynamo' ? 1.3 : 1);
              put(
                0,
                position.x,
                position.y,
                position.z,
                size,
                size,
                size,
                tint,
                charge * 0.65 * level,
                orientation,
                clock * (j % 2 ? 2 : -2) * motion,
              );
            }
            for (let j = 0; j < (full ? 10 : 3); j++) {
              const a = j * 2.399 + clock * 4 * motion;
              local
                .set(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.25 + j * 0.09)
                .applyQuaternion(orientation)
                .add(position);
              put(
                1,
                local.x,
                local.y,
                local.z,
                0.04,
                0.04,
                0.18,
                tint,
                charge * level,
                orientation,
              );
            }
          }
          if (h.shot > 0 && ['launcher', 'scatter', 'plasma'].includes(id)) {
            const f = 1 - Math.min(1, h.shot / weapon.rate),
              size = 0.3 + f * 1.5;
            put(
              0,
              position.x,
              position.y,
              position.z,
              size,
              size,
              size,
              tint,
              (1 - f) * 0.45 * level,
              orientation,
            );
          }
          if (id === 'rotary' && h.spin > 0) {
            const size = 0.7;
            put(
              2,
              position.x,
              position.y,
              position.z,
              size,
              size,
              size,
              tint,
              h.spin * 0.5 * level,
              orientation,
              clock * 8 * motion,
            );
          }
          if (id === 'flamer' && h.flame) {
            for (let j = 0; j < 3; j++) {
              const f = (clock * 2 * motion + j / 3) % 1;
              local
                .set(0, 0, -f * 2)
                .applyQuaternion(orientation)
                .add(position);
              const size = 0.25 + f * 0.7;
              put(
                0,
                local.x,
                local.y,
                local.z,
                size,
                size,
                size,
                tint,
                (1 - f) * 0.4 * level,
                orientation,
              );
            }
          }
          if (
            id === 'phaser' &&
            h.beam &&
            !h.beam.blocked &&
            [h.beam.x, h.beam.y, h.beam.z].every(Number.isFinite)
          ) {
            end.set(h.beam.x * 0.1, h.beam.z * 0.1, h.beam.y * 0.1);
            axis.subVectors(end, position);
            const length = axis.length();
            if (length < 0.001) continue;
            bolt(position.x, position.y, position.z, end.x, end.y, end.z, tint, level * 0.5);
            orientation.setFromUnitVectors(up, axis.normalize());
            for (let j = 0; j < (full ? 12 : 4); j++) {
              const f = (j / 12 + clock * (h.beam.hit ? -0.9 : 0.9) * motion) % 1,
                positive = (f + 1) % 1;
              local
                .set(
                  Math.cos(j + clock * 3 * motion) * 0.18,
                  (positive - 0.5) * length,
                  Math.sin(j + clock * 3 * motion) * 0.18,
                )
                .applyQuaternion(orientation)
                .addScaledVector(position, 0.5)
                .addScaledVector(end, 0.5);
              put(1, local.x, local.y, local.z, 0.05, 0.2, 0.05, tint, level, orientation);
            }
            if (h.beam.hit)
              put(0, end.x, end.y, end.z, 0.45, 0.45, 0.45, tint, 0.6 * level, horizontal);
          }
          if (weapon.melee && id !== 'guard' && h.meleeTime > 0) {
            const f = 1 - h.meleeTime / weapon.rate;
            if (f > 0.18 && f < 0.7) {
              kit.root.getWorldPosition(position);
              kit.root.getWorldQuaternion(orientation);
              const reach =
                id === 'scythe' ? 3.8 : id === 'hammer' ? 2.2 : id === 'lance' ? 1.3 : 2.6;
              put(
                2,
                position.x,
                position.y,
                position.z,
                reach,
                reach * 0.55,
                reach,
                tint,
                Math.sin(((f - 0.18) / 0.52) * Math.PI) * level,
                orientation,
                f * 3 * motion,
              );
            }
          }
          if (id === 'guard' && h.guarding) {
            kit.root.getWorldPosition(position);
            kit.root.getWorldQuaternion(orientation);
            put(
              0,
              position.x,
              position.y,
              position.z,
              1.6,
              1.4,
              1,
              tint,
              0.25 * level,
              orientation,
            );
          }
        }
      }
      boltGeometry.setDrawRange(0, boltCount * 2);
      boltGeometry.attributes.position.needsUpdate = true;
      boltGeometry.attributes.color.needsUpdate = true;
      bolts.visible = boltCount > 0;
      pools.forEach((mesh, i) => {
        mesh.count = counts[i];
        mesh.visible = counts[i] > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    },
    dispose() {
      for (const pool of pools) {
        pool.dispose();
        pool.material.dispose();
      }
      geometries.forEach((g) => g.dispose());
      boltGeometry.dispose();
      bolts.material.dispose();
      shellGeometry.dispose();
      shells.forEach((s) => s.material.dispose());
      root.removeFromParent();
    },
  };
}
