import { destructionObjective } from './destruction-mission.js';
import { operationObjective } from './planet-mission.js?v=41';
import { AI_ARM_TIME } from './core.js?v=41';
export function taskStatus(w, p, yaw) {
  if (p.hp <= 0)
    return {
      warning: true,
      label: w.operation?.wipeAt != null ? 'EMERGENCY REDEPLOY' : 'MECH DISABLED',
      detail:
        w.operation?.wipeAt != null
          ? 'Recovery in ' +
            Math.max(0, Math.ceil((w.mission.raid ? 4 : 7) - w.time + w.operation.wipeAt)) +
            's'
          : 'Stay linked. A nearby ally can bring you back online.',
    };
  const heavy = w.operation?.heavyAlert;
  if (heavy && w.time < heavy.until)
    return {
      warning: true,
      heavy: true,
      label: w.time < heavy.landingAt ? 'HOSTILE MECH INBOUND' : heavy.name + ' LANDED',
      detail:
        w.time < heavy.landingAt
          ? heavy.name +
            ' · Impact in ' +
            Math.max(1, Math.ceil(heavy.landingAt - w.time)) +
            's · Clear the landing zone'
          : 'Heavy armor · Focus fire and keep moving',
    };
  if (w.hazards.some((h) => Math.hypot(h.x - p.x, h.y - p.y) < h.r))
    return {
      warning: true,
      label: 'INCOMING STRIKE',
      detail: 'Boost clear of the marked impact zone.',
    };
  if (
    w.enemies.some(
      (e) =>
        e.hp > 0 &&
        !e.training &&
        !e.species &&
        !e.objective &&
        Math.hypot(e.x - p.x, e.y - p.y) < 250 &&
        Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - yaw) < -0.25,
    )
  )
    return {
      warning: true,
      label: 'CONTACT BEHIND',
      detail: 'Turn or boost clear. Check your vicinity map.',
    };
  if (w.players.some((q) => q.id !== p.id && q.hp <= 0))
    return {
      warning: true,
      label: 'PILOT DOWN',
      detail: 'Move close to your ally to initiate recovery.',
    };
  if (w.mission.mode === 'trial' && w.time < AI_ARM_TIME)
    return {
      warning: true,
      label: 'CONTACT ACTIVE',
      detail: 'One hostile mech · Keep moving · Use both hands',
    };
  if (w.mission.mode === 'trial' && w.enemies.some((e) => e.windup > 0 && e.attackTarget === p.id))
    return {
      warning: true,
      label: 'INCOMING ' + (w.enemies[0].attackKind === 'melee' ? 'MELEE' : 'BURST'),
      detail: 'Boost away from the attack.',
    };
  if (w.siege)
    return w.siege.noticeUntil > w.time
      ? { notice: true, label: w.siege.notice, detail: 'DESTRUCTION PROTOTYPE / ' + w.mission.name }
      : { label: w.mission.name, detail: destructionObjective(w, p).teamDetail };
  if (w.mission.mode === 'trial')
    return {
      label: 'DEFEAT THE AI MECH',
      detail: 'Strafe, fly, and test your loadout in live combat.',
    };
  if (w.mission.mode === 'sandbox')
    return {
      label: 'TEST YOUR LOADOUT',
      detail: 'LMB left hand · RMB right hand · Space fly · E special',
    };
  if (w.operation) {
    if (w.operation.noticeUntil > w.time)
      return {
        notice: true,
        label: w.operation.notice,
        detail: w.mission.raid
          ? w.mission.name + ' · LEVEL ' + w.mission.sector
          : 'CINDERFALL · ' + (w.operation.phase + 1) + ' / 5 objectives',
      };
    return { label: w.mission.name, detail: operationObjective(w, p).teamDetail };
  }
  const zone = w.mission.zones[w.zoneIndex];
  if (w.encounter)
    return {
      label: zone?.boss ? 'WARDEN ENGAGED' : 'CLEAR THE SECTOR',
      detail: `${w.enemies.filter((e) => e.hp > 0).length} contacts remaining · Keep moving`,
    };
  if (zone)
    return {
      label: `ADVANCE TO SECTOR ${w.zoneIndex + 1}`,
      detail: `${zone.name} · ${Math.round(Math.hypot(zone.x - p.x, zone.y - p.y))}m to contact`,
    };
  return {
    label: w.extractTime > 0 ? 'EXTRACTING SQUAD' : 'REGROUP AT EXTRACTION',
    detail:
      w.extractTime > 0
        ? 'Hold your position inside the exit ring.'
        : 'Bring every surviving pilot to the exit.',
  };
}

// Personal instructions and shared mission progress stay visible independently of warnings.
export function objectiveStatus(w, p) {
  if (w.siege) return destructionObjective(w, p);
  if (w.operation) return operationObjective(w, p);
  const zones = w.mission.zones || [],
    zone = zones[w.zoneIndex],
    cleared = Math.min(zones.length, w.cleared || 0),
    progress = zones.length ? Math.round((cleared / zones.length) * 100) : null;
  if (w.mission.mode === 'trial') {
    const down = w.players.some((q) => q.id !== p.id && q.hp <= 0);
    return {
      personal:
        p.hp <= 0
          ? 'Wait for recovery'
          : down
            ? 'Recover your teammate'
            : 'Test your mech in combat',
      personalDetail:
        p.hp <= 0 || down
          ? 'A nearby ally can revive a disabled mech.'
          : 'Use both weapons. Boost clear of incoming fire.',
      team:
        w.status === 'won'
          ? 'AI mech defeated'
          : w.status === 'lost'
            ? 'Trial failed'
            : 'Defeat the AI mech',
      teamDetail:
        w.status === 'won'
          ? 'Combat trial complete.'
          : w.status === 'lost'
            ? 'Regroup and try again.'
            : '1 hostile · No reinforcements',
      progress: null,
    };
  }
  if (w.mission.mode === 'sandbox')
    return {
      personal: 'Test your mech',
      personalDetail: 'Try your weapons, flight, and special.',
      team: 'Free training',
      teamDetail: 'No shared mission in the test bay.',
      progress: null,
    };
  if (w.status === 'won')
    return {
      personal: 'Extraction complete',
      personalDetail: 'Your mech is clear of the combat zone.',
      team: 'Mission complete',
      teamDetail: `${cleared} / ${zones.length} sectors secured.`,
      progress: 100,
    };
  if (w.status === 'lost')
    return {
      personal: 'Mech disabled',
      personalDetail: 'Return to the workshop to regroup.',
      team: 'Mission failed',
      teamDetail: 'The squad is offline.',
      progress,
    };
  let personal =
    p.hp <= 0
      ? 'Wait for recovery'
      : zone
        ? w.encounter
          ? 'Engage hostiles'
          : `Reach ${zone.name}`
        : 'Reach extraction';
  let personalDetail =
    p.hp <= 0
      ? 'A nearby ally can revive you.'
      : zone
        ? w.encounter
          ? 'Use your loadout to help clear this sector.'
          : `${Math.round(Math.hypot(zone.x - p.x, zone.y - p.y))}m to the next sector.`
        : 'Land inside the extraction zone.';
  const down = w.players.find((q) => q.id !== p.id && q.hp <= 0);
  if (p.hp > 0 && down) {
    personal = 'Recover your teammate';
    personalDetail = 'Stay close to the downed mech to revive it.';
  }
  const contacts =
    w.enemies.filter((e) => e.hp > 0 && !e.training).length +
    (w.spawn?.length || w.pendingSpawns || 0);
  const team = zone
    ? w.encounter
      ? zone.boss
        ? 'Defeat the warden'
        : 'Clear the sector'
      : 'Advance together'
    : w.extractTime > 0
      ? 'Hold for extraction'
      : 'Regroup at extraction';
  const teamDetail = zone
    ? `${cleared} / ${zones.length} sectors secured${w.encounter ? ` · ${contacts} hostiles remaining` : ''}.`
    : w.extractTime > 0
      ? `${Math.max(0, 2 - w.extractTime).toFixed(1)}s until squad extraction.`
      : 'Bring every surviving pilot into the exit zone.';
  return { personal, personalDetail, team, teamDetail, progress };
}
export function ultimateStatus(p, ability, rechargeRate = 1) {
  if (!ability)
    return { state: 'unavailable', percent: 0, counter: '—', detail: 'NO ULTIMATE', ready: false };
  const remaining = Math.max(0, p.abilityCd || 0),
    seconds = remaining / (Number.isFinite(rechargeRate) && rechargeRate > 0 ? rechargeRate : 1),
    percent = Math.min(100, Math.max(0, Math.floor((1 - remaining / ability.cd) * 100 + 1e-7)));
  if (p.hp <= 0)
    return { state: 'offline', percent, counter: 'OFFLINE', detail: 'MECH DISABLED', ready: false };
  if (p.active > 0)
    return {
      state: 'active',
      percent,
      counter: seconds.toFixed(1) + 's',
      detail: 'ACTIVE · ' + p.active.toFixed(1) + 's',
      ready: false,
    };
  if (remaining > 0)
    return {
      state: 'charging',
      percent,
      counter: seconds.toFixed(1) + 's',
      detail: 'RECHARGING · ' + percent + '%',
      ready: false,
    };
  return {
    state: 'ready',
    percent: 100,
    counter: 'READY',
    detail: 'PRESS E TO ACTIVATE',
    ready: true,
  };
}

export function hullStatus(p, max) {
  const current = Math.max(0, Math.min(max, p.hp)),
    percent = Math.round((current / max) * 100);
  return {
    current: Math.ceil(current),
    max: Math.ceil(max),
    percent,
    state:
      p.hp <= 0 ? 'offline' : percent <= 25 ? 'critical' : percent <= 50 ? 'damaged' : 'online',
  };
}
