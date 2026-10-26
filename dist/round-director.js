import { missionTuning } from './mission-catalog.js';
import { awardSalvage, contractFor } from './sortie-progression.js';
const goal = {
  purge: 'Clear the depot',
  salvage: 'Recover and deliver cells',
  uplink: 'Upload at the marked relay',
  siege: 'Disable the siege batteries',
  sabotage: 'Destroy the heat exchangers',
  escort: 'Fuel and escort the crawler',
  hunt: 'Eliminate the siege leaders',
  core: 'Break the Crown Engine',
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  alive = (w) => w.players.filter((p) => p.hp > 0),
  combat = (e) => !e.objective && e.hp > 0;
export function initRound(w) {
  w.operation = {
    phase: 0,
    phaseAt: 0,
    nextWave: 1.2,
    nextStrike: 12,
    redeploys: 1,
    wipeAt: null,
    checkpoint: { ...w.mission.entry },
    wave: 0,
    notice: w.mission.name + ' / ' + goal[w.mission.spec.kind],
    noticeUntil: 8,
    cells: [],
    delivered: 0,
    crawler: { ...w.mission.route[0], segment: 0, progress: 0, fuel: 0 },
    extraction: 0,
    teamSize: w.players.length,
    upload: 0,
    terminal: 0,
    targets: [],
    bossSpawned: false,
  };
  w.encounter = true;
  for (const p of w.players) {
    p.altitude = 130;
    p.recoverUntil = 4;
  }
  const m = w.mission,
    spec = m.spec,
    tune = missionTuning(m.sector - 1, w.players.length),
    scale = tune.health * (1 + 0.55 * (w.players.length - 1));
  const target = (id, kind, p, hp, locked = false) => {
    const e = {
      id,
      type: 'objective',
      objective: true,
      objectiveKind: kind,
      x: p.x,
      y: p.y,
      altitude: p.z || 0,
      hp: hp * scale,
      max: hp * scale,
      r: 30,
      locked,
      stun: 0,
      speed: 0,
      roundTarget: true,
    };
    w.enemies.push(e);
    w.operation.targets.push(id);
  };
  if (['salvage', 'escort'].includes(spec.kind)) {
    w.operation.cells = m.points.map((p, i) => ({
      id: 'round-cell-' + i,
      ...p,
      state: 'sealed',
      carrier: null,
    }));
    for (const c of w.operation.cells) target('cache-' + c.id, 'cache', c, 340);
  } else if (spec.kind === 'siege') {
    m.points.slice(0, 2).forEach((p, i) => {
      target('round-relay-' + i, 'relay', { x: p.x, y: p.y - 170, z: 0 }, 300);
      target('round-battery-' + i, 'battery', p, 800, true);
    });
  } else if (spec.kind === 'sabotage')
    m.points.forEach((p, i) => target('round-coolant-' + i, 'coolant', p, 600));
  else if (spec.kind === 'uplink')
    m.points.forEach((p, i) => target('round-uplink-' + i, 'uplink', p, 1, true));
  else if (spec.kind === 'core') {
    m.points.slice(0, 2).forEach((p, i) => target('round-relay-' + i, 'coolant', p, 850));
  } else if (spec.kind === 'hunt')
    m.points.forEach((p, i) =>
      queue(w, 'tank', p, {
        elite: true,
        raidTarget: 'leader-' + i,
        health: 1300,
        wait: i * 2 + 2,
      }),
    );
}
function queue(w, type, p, { elite = false, raidTarget = null, health, wait = 2 } = {}) {
  if (raidTarget) {
    const cap = missionTuning(w.mission.sector - 1, w.players.length).cap;
    while (w.enemies.filter(combat).length + w.spawn.length >= cap) {
      const pending = w.spawn.findIndex((s) => !s.zone.raidTarget);
      if (pending >= 0) {
        w.spawn.splice(pending, 1);
        continue;
      }
      const fodder = w.enemies.findIndex((e) => combat(e) && !e.raidTarget);
      if (fodder < 0) break;
      w.enemies.splice(fodder, 1);
    }
  }
  w.spawn.push({
    time: w.time + wait,
    type,
    zone: {
      x: p.x,
      y: p.y,
      exact: true,
      operation: true,
      raid: true,
      elite,
      raidTarget,
      health,
      difficulty: missionTuning(w.mission.sector - 1, w.players.length),
    },
  });
}
function wave(w) {
  const o = w.operation,
    m = w.mission,
    spec = m.spec,
    tune = missionTuning(m.sector - 1, w.players.length),
    contract = contractFor(m.contract),
    pilots = alive(w);
  o.nextWave = w.time + ((spec.wave * contract.wave) / 5.5) * (o.overtime ? 0.8 : 1);
  if (!pilots.length || o.phase === 1) return;
  const space = tune.cap - w.enemies.filter(combat).length - w.spawn.length,
    amount = Math.min(space, tune.batch);
  if (amount <= 0) return;
  const near = m.portals.filter((port) => pilots.every((p) => distance(p, port) > 260));
  if (!near.length) {
    o.nextWave = w.time + 1;
    return;
  }
  for (let i = 0; i < amount; i++) {
    const port = near[(o.wave * 3 + i) % near.length],
      mix =
        contract.id === 'siegebreaker' && i % 4 === 0
          ? 'tank'
          : spec.mix[(o.wave + i) % spec.mix.length];
    queue(w, mix, port, { wait: 2 + i * 0.14 });
  }
  o.wave++;
}
function finishObjective(w) {
  const o = w.operation;
  o.phase = 1;
  o.phaseAt = w.time;
  o.shipAt = w.time + 8;
  o.notice = 'OBJECTIVE COMPLETE · Regroup at extraction';
  o.noticeUntil = w.time + 6;
  w.spawn = [];
  w.hazards = [];
  w.cleared = 2;
  w.zoneIndex = 2;
  awardSalvage(w, w.mission.spec.reward);
}
export function stepRound(w, dt, stats) {
  const o = w.operation,
    m = w.mission,
    spec = m.spec,
    pilots = alive(w),
    tune = missionTuning(m.sector - 1, w.players.length);
  if (w.status !== 'playing') return;
  for (const c of o.cells)
    if (c.state === 'carried' && !pilots.some((p) => p.id === c.carrier)) {
      const p = w.players.find((p) => p.id === c.carrier);
      if (p) {
        c.x = p.x;
        c.y = p.y;
      }
      c.state = 'loose';
      c.z = 0;
      c.carrier = null;
    }
  if (!pilots.length) {
    o.wipeAt ??= w.time;
    if (o.redeploys <= 0) {
      w.status = 'lost';
      return;
    }
    if (w.time - o.wipeAt >= 4) {
      o.redeploys--;
      w.enemies = w.enemies.filter((e) => e.objective || e.elite);
      w.bullets = [];
      w.hazards = [];
      w.enemyHazards = [];
      w.spawn = w.spawn.filter((s) => s.zone.raidTarget);
      w.players.forEach((p, i) => {
        p.hp = stats(p.build, p).hp;
        p.x = m.entry.x + (i % 2) * 90;
        p.y = m.entry.y - Math.floor(i / 2) * 90;
        p.altitude = 100;
        p.recoverUntil = w.time + 4;
      });
      o.wipeAt = null;
    }
    return;
  }
  o.wipeAt = null;
  if (o.phase === 1) {
    const onPad =
      w.time >= o.shipAt &&
      pilots.every((p) => distance(p, m.exit) < 200 && (p.altitude || 0) < 50);
    o.extraction = onPad ? o.extraction + dt : 0;
    w.extractTime = o.extraction;
    if (o.extraction >= 3) {
      w.status = 'won';
      w.cleared = 3;
      w.zoneIndex = 3;
    }
    return;
  }
  if (w.time >= o.nextWave) wave(w);
  o.overtime = w.time > spec.minutes * 60 + 45;
  if (m.sector >= 4 && w.time >= o.nextStrike) {
    for (const p of pilots.slice(0, m.sector >= 8 ? 4 : 2))
      w.hazards.push({ x: p.x, y: p.y, r: 100 + 5 * m.sector, time: 2.6 });
    o.nextStrike = w.time + Math.max(7, 19 - m.sector);
  }
  const kills = spec.kills + 8 * (w.players.length - 1),
    old = w.enemies.filter((e) => o.targets.includes(e.id) && e.hp > 0);
  let done = false;
  if (spec.kind === 'purge') done = w.kills >= kills;
  if (['salvage', 'escort'].includes(spec.kind)) {
    for (const c of o.cells) {
      if (c.state === 'sealed' && !w.enemies.some((e) => e.id === 'cache-' + c.id && e.hp > 0))
        c.state = 'loose';
      if (c.state === 'loose') {
        const p = pilots.find(
          (p) =>
            distance(p, c) < 100 &&
            Math.abs((p.altitude || 0) - c.z) < 80 &&
            !o.cells.some((q) => q.carrier === p.id),
        );
        if (p) {
          c.state = 'carried';
          c.carrier = p.id;
        }
      }
      if (c.state === 'carried') {
        const p = pilots.find((p) => p.id === c.carrier);
        if (p) {
          c.x = p.x;
          c.y = p.y;
          c.z = p.altitude || 0;
          if (distance(p, o.crawler) < 170 && (p.altitude || 0) < 70) {
            c.state = 'delivered';
            c.carrier = null;
            o.delivered++;
            o.crawler.fuel += 65;
            awardSalvage(w, 15);
          }
        }
      }
    }
    if (spec.kind === 'escort') {
      const c = o.crawler,
        route = m.route,
        escort = pilots.some((p) => distance(p, c) < 360);
      if (c.fuel > 0 && escort && c.segment < route.length - 1) {
        const target = route[c.segment + 1],
          d = distance(c, target),
          travel = Math.min(d, 85 * dt);
        c.x += ((target.x - c.x) / Math.max(d, 1)) * travel;
        c.y += ((target.y - c.y) / Math.max(d, 1)) * travel;
        c.fuel = Math.max(0, c.fuel - dt);
        if (d <= travel + 0.1) c.segment++;
      }
      c.progress = c.segment / (route.length - 1);
      done = c.segment === route.length - 1 && o.delivered === o.cells.length;
    } else done = o.delivered === o.cells.length;
  }
  if (spec.kind === 'uplink') {
    const point = m.points[o.terminal];
    if (point) {
      const held = pilots.some(
        (p) => distance(p, point) < 190 && Math.abs((p.altitude || 0) - (point.z || 0)) < 60,
      );
      o.upload = held ? o.upload + dt : o.upload;
      if (o.upload >= tune.hold) {
        const target = w.enemies.find((e) => e.id === 'round-uplink-' + o.terminal);
        if (target) target.hp = 0;
        o.terminal++;
        o.upload = 0;
        awardSalvage(w, 20);
      }
    }
    done = o.terminal === m.points.length;
  }
  if (spec.kind === 'siege') {
    for (let i = 0; i < 2; i++) {
      const b = w.enemies.find((e) => e.id === 'round-battery-' + i);
      if (b) b.locked = w.enemies.some((e) => e.id === 'round-relay-' + i && e.hp > 0);
    }
    done = old.length === 0;
  }
  if (spec.kind === 'sabotage') done = old.length === 0;
  if (spec.kind === 'hunt')
    done =
      !w.enemies.some((e) => e.raidTarget && e.hp > 0) &&
      !w.spawn.some((s) => s.zone.raidTarget) &&
      w.time > 8;
  if (spec.kind === 'core') {
    if (old.length === 0 && !o.bossSpawned) {
      queue(w, 'boss', m.reactor, {
        elite: true,
        raidTarget: 'crown-warden',
        health: 4000,
        wait: 3,
      });
      o.bossSpawned = true;
      o.notice = 'CROWN WARDEN · Break the final siege frame';
      o.noticeUntil = w.time + 6;
    }
    done =
      o.bossSpawned &&
      !w.enemies.some((e) => e.raidTarget && e.hp > 0) &&
      !w.spawn.some((s) => s.zone.raidTarget);
  }
  if (done && w.time >= spec.minimum) finishObjective(w);
}
export function roundMarkers(w, p) {
  const o = w.operation,
    m = w.mission;
  if (o.phase === 1)
    return [
      {
        ...m.exit,
        z: 100,
        name:
          w.time < o.shipAt
            ? 'EXTRACTION IN ' + Math.ceil(o.shipAt - w.time) + 's'
            : 'LAND TO EXTRACT',
      },
    ];
  if (m.spec.kind === 'uplink') {
    const point = m.points[o.terminal];
    return point
      ? [
          {
            ...point,
            z: point.z + 90,
            name: 'UPLOAD ' + (o.terminal + 1) + ' / ' + m.points.length,
          },
        ]
      : [];
  }
  if (o.cells.length) {
    const carrying = o.cells.some((c) => c.carrier === p?.id);
    return [
      ...(carrying || o.delivered === o.cells.length
        ? [
            {
              ...o.crawler,
              z: 100,
              name: carrying
                ? 'DELIVER CELL'
                : m.spec.kind === 'escort'
                  ? 'ESCORT CRAWLER'
                  : 'PUMP STATION',
            },
          ]
        : []),
      ...o.cells
        .filter((c) => ['sealed', 'loose'].includes(c.state) && !carrying)
        .map((c) => ({
          ...c,
          z: c.z + 90,
          name: c.state === 'sealed' ? 'BREAK CACHE' : 'RECOVER CELL',
        })),
    ];
  }
  const targets = w.enemies.filter((e) => e.hp > 0 && !e.locked && (e.roundTarget || e.raidTarget));
  return targets.length
    ? targets.map((e) => ({
        ...e,
        z: (e.altitude || 0) + 100,
        name: e.locked
          ? 'BREAK SHIELD RELAY'
          : e.raidTarget
            ? 'SIEGE LEADER'
            : 'DESTROY ' + e.objectiveKind.toUpperCase(),
      }))
    : [{ x: 1300, y: 1100, z: 100, name: 'CLEAR THE DEPOT' }];
}
export function roundObjective(w, p) {
  const o = w.operation,
    m = w.mission,
    spec = m.spec,
    tune = missionTuning(m.sector - 1, w.players.length),
    markers = roundMarkers(w, p),
    closest = [...markers].sort((a, b) => distance(a, p) - distance(b, p))[0];
  const fraction =
    spec.kind === 'purge'
      ? w.kills / (spec.kills + 8 * (w.players.length - 1))
      : spec.kind === 'uplink'
        ? (o.terminal + o.upload / tune.hold) / m.points.length
        : o.cells.length
          ? o.delivered / o.cells.length
          : o.targets.length
            ? 1 -
              w.enemies.filter((e) => e.hp > 0 && o.targets.includes(e.id)).length /
                o.targets.length
            : 0;
  const detail =
    o.phase === 1
      ? `${o.extraction.toFixed(1)} / 3s · All survivors must land`
      : spec.kind === 'uplink'
        ? `${o.terminal} / ${m.points.length} relays · ${o.upload.toFixed(0)} / ${tune.hold}s upload`
        : o.cells.length
          ? `${o.delivered} / ${o.cells.length} cells${spec.kind === 'escort' ? ' · ' + Math.round(o.crawler.progress * 100) + '% escort' : ''}`
          : spec.kind === 'purge'
            ? `${w.kills} / ${spec.kills + 8 * (w.players.length - 1)} hostiles`
            : `${w.enemies.filter((e) => e.hp > 0 && (e.roundTarget || e.raidTarget)).length} marked targets remaining`;
  return {
    personal: p.hp <= 0 ? 'Mech disabled' : closest?.name || 'Support your squad',
    personalDetail:
      p.hp <= 0
        ? 'Stay near an ally to recover'
        : closest
          ? `${Math.round(distance(p, closest))}m · Boost / fly to rotate`
          : 'Keep moving',
    team:
      w.status === 'won'
        ? 'Round secured'
        : w.status === 'lost'
          ? 'Run lost'
          : o.phase === 1
            ? 'Extract together'
            : goal[spec.kind],
    teamDetail: `${detail} · Level ${m.sector} · ${o.redeploys} redeploy${o.overtime ? ' · OVERTIME PRESSURE' : ''}`,
    progress:
      w.status === 'won'
        ? 100
        : o.phase === 1
          ? 80
          : Math.round(Math.max(0, Math.min(1, fraction)) * 75),
  };
}
