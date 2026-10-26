const DIRECT = new Set([
  'carbine',
  'precision',
  'scatter',
  'rail',
  'dynamo',
  'launcher',
  'plasma',
  'phaser',
  'flamer',
  'melee',
  'hammer',
  'dash',
  'emp',
  'bladeWave',
]);
export function recordTeamHit(w, e, amount, owner, kind) {
  if (
    amount < 8 ||
    !DIRECT.has(kind) ||
    e.training ||
    e.objective ||
    !w.players.some((p) => p.id === owner && p.hp > 0)
  )
    return null;
  const hits = (e.teamHits || []).filter(
    (h) => w.time - h.at <= 0.9 && w.players.some((p) => p.id === h.owner && p.hp > 0),
  );
  hits.push({ owner, amount, at: w.time });
  e.teamHits = hits.slice(-32);
  const owners = [...new Set(e.teamHits.map((h) => h.owner))];
  if (owners.length < 2 || e.teamHits.reduce((n, h) => n + h.amount, 0) < 60) return null;
  const finish = e.hp <= 0;
  if ((!finish && w.time < (e.comboReadyAt || 0)) || (finish && e.comboFinished)) return null;
  if (finish && w.time - (e.comboAt ?? -10) > 0.9 && w.time < (e.comboReadyAt || 0)) return null;
  e.comboAt = w.time;
  e.comboReadyAt = w.time + 2.4;
  if (finish) e.comboFinished = true;
  const reaction = {
    id: w.id++,
    kind: finish ? 'finish' : 'break',
    label: finish ? 'TEAM FINISH' : 'CROSS BREAK',
    at: w.time,
    x: e.x,
    y: e.y,
    z: (e.altitude || 0) + (e.bodyHeight || 58) * 0.7,
    owners,
    enemyId: e.id,
  };
  w.teamCombos ??= [];
  w.teamCombos.push(reaction);
  if (w.teamCombos.length > 12) w.teamCombos.shift();
  return reaction;
}
export function stepTeamCombos(w) {
  w.teamCombos = (w.teamCombos || []).filter((c) => w.time - c.at < 0.7);
}
