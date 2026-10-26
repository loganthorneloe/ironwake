import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combatTrial,
  testPlatform,
  newWorld,
  DEFAULT_BUILD,
  setInput,
  step,
  snapshot,
} from '../dist/core.js';
import { objectiveStatus, taskStatus } from '../dist/hud-status.js';
const make = (n = 1) =>
  newWorld(
    combatTrial(),
    Array.from({ length: n }, (_, i) => ({ id: 'p' + i, build: DEFAULT_BUILD })),
  );
const run = (w, seconds, input) => {
  for (let i = 0; i < seconds * 60 && w.status === 'playing'; i++) {
    if (input) setInput(w, 'p0', input(w));
    step(w, 1 / 60);
  }
};
test('trial has exactly one opponent, a brief arming period, and no accidental extraction', () => {
  const w = make(),
    e = w.enemies[0],
    p = w.players[0];
  run(w, 0.4);
  assert.ok(e.y > -520);
  assert.equal(e.shotCount, 0);
  assert.equal(p.hp, 125);
  assert.equal(w.status, 'playing');
  assert.equal(w.extractTime, 0);
  assert.equal(w.enemies.length, 1);
  assert.equal(newWorld(testPlatform(), [{ id: 'p', build: DEFAULT_BUILD }]).enemies.length, 6);
});
test('opponent strafes, telegraphs, shoots from its weapon and can defeat an idle pilot', () => {
  const w = make(),
    e = w.enemies[0],
    p = w.players[0];
  let windup = false,
    bullet = false;
  const seen = new Set();
  for (let i = 0; i < 6000 && w.status === 'playing'; i++) {
    step(w, 1 / 60);
    windup ||= e.windup > 0;
    for (const b of w.bullets) {
      assert.ok(b.enemy);
      if (!seen.has(b.id)) {
        assert.ok(Math.hypot(b.origin.x - e.x, b.origin.y - e.y) > 20);
        seen.add(b.id);
      }
      bullet = true;
    }
  }
  assert.ok(windup && bullet);
  assert.notEqual(e.x, 0);
  assert.ok(e.shotCount > 0);
  assert.equal(w.status, 'lost');
  assert.equal(p.hp, 0);
});
test('opponent follows airborne pilots and EMP interrupts its attack', () => {
  const w = make(),
    e = w.enemies[0];
  run(w, 4, () => ({ fly: true }));
  assert.ok(e.altitude > 100);
  assert.ok(e.airborne);
  e.stun = 2;
  e.windup = 0.3;
  e.burst = 3;
  const shots = e.shotCount;
  run(w, 1, () => ({ fly: true }));
  assert.equal(e.shotCount, shots);
  assert.equal(e.windup, 0);
  assert.equal(e.burst, 0);
});
test('close opponent uses a sword and deals melee damage', () => {
  const w = make(),
    p = w.players[0],
    e = w.enemies[0];
  w.time = 4;
  e.x = p.x;
  e.y = p.y - 65;
  e.cd = 0;
  run(w, 0.6);
  assert.ok(e.meleeCount > 0);
  assert.ok(p.hp < 125);
});
test('players can destroy the opponent with real weapons and complete the trial', () => {
  const w = make(),
    e = w.enemies[0];
  e.speed = 0;
  run(w, 20, (w) => ({
    left: true,
    right: true,
    angle: Math.atan2(e.y - w.players[0].y, e.x - w.players[0].x),
    aimPoint: { x: e.x, y: e.y, z: e.altitude + 30 },
  }));
  assert.equal(w.status, 'won');
  assert.equal(w.kills, 1);
  assert.equal(w.enemies.length, 0);
  assert.equal(w.extractTime, 0);
  assert.equal(objectiveStatus(w, w.players[0]).team, 'AI mech defeated');
});
test('co-op scales one opponent and snapshots keep combat state for guests', () => {
  const solo = make(),
    w = make(4);
  assert.equal(w.enemies.length, 1);
  assert.ok(w.enemies[0].hp > solo.enemies[0].hp);
  run(w, 4);
  const remote = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(remote.mission.mode, 'trial');
  assert.equal(remote.enemies[0].shotCount, w.enemies[0].shotCount);
  assert.equal(remote.enemies[0].windup, w.enemies[0].windup);
  assert.equal(objectiveStatus(remote, remote.players[0]).team, 'Defeat the AI mech');
  assert.equal(taskStatus(solo, solo.players[0], 0).label, 'CONTACT ACTIVE');
});
