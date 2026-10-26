import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newWorld,
  testPlatform,
  DEFAULT_BUILD,
  cleanBuild,
  setInput,
  step,
  RANGED,
  MELEE,
  ABILITIES,
  snapshot,
} from '../dist/core.js';
const make = (extra = {}) =>
  newWorld(testPlatform(), [{ id: 'p', build: { ...DEFAULT_BUILD, ...extra } }]);
test('legacy melee saves migrate into the melee slot and retain a ranged weapon', () => {
  const b = cleanBuild({ weapon: 'hammer' });
  assert.equal(b.weapon, 'carbine');
  assert.equal(b.melee, 'hammer');
  const c = cleanBuild({ weapon: 'plasma', melee: 'scythe' });
  assert.equal(c.weapon, 'plasma');
  assert.equal(c.melee, 'scythe');
  assert.equal(cleanBuild({ weapon: 'bogus', melee: 'bogus' }).melee, 'blade');
});
test('ranged patterns differ in count, speed, splash, piercing and fire interval', () => {
  const bullets = {};
  for (const weapon of Object.keys(RANGED)) {
    const w = make({ weapon }),
      p = w.players[0];
    w.enemies = [];
    setInput(w, 'p', { fire: true, angle: 0 });
    step(w, 0.01);
    if (weapon === 'rail')
      for (let i = 0; i < Math.round(RANGED.rail.charge / 0.01) - 1; i++) {
        setInput(w, 'p', { fire: true, angle: 0 });
        step(w, 0.01);
      }
    bullets[weapon] = w.bullets;
    assert.equal(
      p.shot,
      RANGED[weapon].rate * (weapon === 'rotary' ? 1 + (1 - 0.01 / 0.6) * 0.5 : 1),
    );
  }
  assert.equal(bullets.scatter.length, 9);
  assert.equal(bullets.rail[0].pierce, 3);
  assert.ok(bullets.plasma[0].stun > 0);
  assert.ok(bullets.plasma[0].splash < bullets.launcher[0].splash);
  assert.ok(bullets.rail[0].vx > bullets.plasma[0].vx);
  assert.ok(RANGED.rotary.rate < RANGED.carbine.rate);
});
test('dedicated melee input has independent recovery and does not fire a gun', () => {
  const w = make(),
    p = w.players[0];
  setInput(w, 'p', { melee: true });
  step(w, 0.01);
  assert.equal(p.shotCount, 0);
  assert.equal(p.meleeCount, 1);
  setInput(w, 'p', { melee: true, fire: true });
  step(w, 0.01);
  assert.equal(p.meleeCount, 1);
  assert.equal(p.shotCount, 1);
  assert.equal(p.activeSlot, 0);
});
test('target hits create replicated damage numbers and targets reset without attacking', () => {
  const w = make(),
    p = w.players[0],
    target = w.enemies[0];
  p.x = target.x;
  p.y = target.y + 70;
  setInput(w, 'p', { melee: true, angle: -Math.PI / 2 });
  step(w, 0.01);
  assert.equal(target.hp, target.max);
  setInput(w, 'p', { angle: -Math.PI / 2 });
  for (let i = 0; i < 5; i++) step(w, 0.05);
  assert.ok(target.hp < target.max);
  assert.ok(w.damageEvents.some((e) => e.amount > 0 && e.kind === 'melee'));
  assert.ok(snapshot(w, false).damageEvents.length);
  target.hp = 0;
  setInput(w, 'p', {});
  for (let i = 0; i < 50; i++) step(w, 0.05);
  assert.equal(target.hp, target.max);
  assert.equal(p.hp, 125);
  assert.equal(w.bullets.filter((b) => b.enemy).length, 0);
  assert.equal(w.damageEvents.length, 0);
});
test('shield lasts eight seconds; repair and EMP have larger areas', () => {
  const w = make({ ability: 'shield' }),
    p = w.players[0];
  setInput(w, 'p', { ability: true });
  step(w, 0.01);
  assert.equal(p.active, 8);
  setInput(w, 'p', {});
  for (let i = 0; i < 100; i++) step(w, 0.05);
  assert.ok(p.active > 2.9);
  assert.equal(ABILITIES.shield.radius, 220);
  assert.equal(ABILITIES.repair.duration, 8);
  assert.equal(ABILITIES.emp.radius, 320);
  const emp = make(),
    q = emp.players[0],
    t = emp.enemies[0];
  q.x = t.x;
  q.y = t.y + 300;
  setInput(emp, 'p', { ability: true });
  step(emp, 0.01);
  assert.equal(t.hp, t.max - 45);
  assert.ok(t.stun > 3.9);
  assert.ok(emp.damageEvents.some((e) => e.kind === 'emp'));
});

test('all guns sustain repeated fire without thermal pauses', () => {
  for (const weapon of Object.keys(RANGED)) {
    const w = make({ weapon }),
      p = w.players[0];
    w.enemies = [];
    for (let i = 0; i < 2400; i++) {
      const ready =
        weapon !== 'rail' ||
        p.hands.some((h) => h.item === 'rail' && h.shot <= 0 && !h.railCharging);
      setInput(w, 'p', { fire: ready });
      step(w, 0.01);
    }
    const expected = RANGED[weapon].moveRecharge
      ? 1
      : 24 / (RANGED[weapon].rate + (RANGED[weapon].charge || 0));
    assert.ok(p.shotCount >= expected * 0.85, weapon + ': ' + p.shotCount);
    assert.equal(p.overheated, undefined);
  }
});
test('every melee has one delayed contact per attack, replicated for guests', () => {
  for (const melee of Object.keys(MELEE).filter((id) => !MELEE[id].guard)) {
    const w = make({ melee }),
      p = w.players[0],
      e = w.enemies[0];
    p.x = e.x;
    p.y = e.y + 50;
    setInput(w, 'p', { melee: true, angle: -Math.PI / 2 });
    step(w, 0.001);
    assert.equal(e.hp, e.max);
    setInput(w, 'p', { angle: -Math.PI / 2 });
    for (let i = 0; i < 150; i++) step(w, 0.01);
    assert.equal(e.hp, e.max - MELEE[melee].damage, melee);
    assert.equal(p.meleeImpactCount, 1);
    assert.equal(snapshot(w, false).players[0].meleeImpactCount, 1);
  }
});
