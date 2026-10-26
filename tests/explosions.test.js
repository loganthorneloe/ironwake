import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, testPlatform, setInput, step, snapshot, WEAPONS } from '../dist/core.js';
for (const weapon of ['launcher'])
  test(
    weapon + ' detonates once with replicated radius/altitude and per-victim damage numbers',
    () => {
      const w = newWorld(testPlatform(), [
        { id: 'p', build: { weapon, parts: { booster: 'heavy' } } },
      ]);
      const p = w.players[0];
      p.x = 0;
      p.y = 0;
      w.enemies = w.enemies.slice(0, 2).map((e, i) => ({ ...e, x: 250, y: i * 45, altitude: 40 }));
      setInput(w, 'p', { fire: true, angle: 0, aimPoint: { x: 250, y: 0, z: 72 } });
      step(w, 0.01);
      setInput(w, 'p', {});
      for (let i = 0; i < 180 && !w.effects.some((e) => e.kind === 'explosion'); i++) step(w, 0.01);
      const blast = w.effects.filter((e) => e.kind === 'explosion');
      assert.equal(blast.length, 1);
      assert.equal(blast[0].weapon, weapon);
      assert.equal(blast[0].r, WEAPONS[weapon].splash);
      assert.ok(blast[0].z > 40);
      assert.equal(w.damageEvents.length, 2);
      assert.ok(w.damageEvents.every((e) => e.amount > 0));
      const copy = JSON.parse(JSON.stringify(snapshot(w)));
      assert.deepEqual(
        copy.effects.filter((e) => e.kind === 'explosion'),
        blast,
      );
      const hp = w.enemies.map((e) => e.hp);
      for (let i = 0; i < 120; i++) step(w, 0.01);
      assert.equal(w.effects.filter((e) => e.kind === 'explosion').length, 0);
      assert.deepEqual(
        w.enemies.map((e) => e.hp),
        hp,
      );
    },
  );
