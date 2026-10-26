import { contractFor, cleanSortieReport, FIELD_MODULES } from './sortie-progression.js';
import { cleanFieldUpgrades, cleanFieldItems } from './field-catalog.js';
import { MISSIONS, campaignRound } from './mission-catalog.js';
export const CAMPAIGN_VERSION = 2;
export const LANDINGS = [
  {
    id: 'beachhead',
    name: 'Central drop',
    code: 'A1',
    cell: '3-3',
    x: 850,
    y: 1050,
    detail: 'Land at the central extraction pad. Regroup before pushing into the arena.',
  },
  {
    id: 'west-approach',
    name: 'West drop',
    code: 'A2',
    cell: '2-4',
    x: 650,
    y: 1050,
    detail: 'Approach from the west side of the insertion corridor.',
  },
  {
    id: 'forward-drop',
    name: 'East drop',
    code: 'A3',
    cell: '4-3',
    x: 1050,
    y: 1050,
    detail: 'Approach from the east side of the insertion corridor.',
  },
];
const count = (n, max = 999999) => (Number.isSafeInteger(n) && n >= 0 ? Math.min(n, max) : 0);
export function cleanModules(values) {
  const result = [];
  for (const id of (Array.isArray(values) ? values : []).slice(0, 18))
    if (
      typeof id === 'string' &&
      Object.hasOwn(FIELD_MODULES, id) &&
      result.filter((v) => v === id).length < 3
    )
      result.push(id);
  return result;
}
export function newCampaign(seed) {
  return {
    version: 2,
    id: crypto.randomUUID(),
    seed: seed >>> 0,
    revision: 0,
    landing: 'beachhead',
    contract: 'frontline',
    sorties: 0,
    victories: 0,
    lastResult: null,
    lastReport: null,
    records: {},
    level: 0,
    runState: 'active',
    pilots: [],
  };
}
export function cleanCampaign(value) {
  if (
    !value ||
    ![1, 2].includes(value.version) ||
    typeof value.id !== 'string' ||
    value.id.length > 64 ||
    !Number.isInteger(value.seed)
  )
    return null;
  const level = value.version === 2 ? count(value.level, 9) : 0,
    pilots = [],
    records = {};
  for (const p of (Array.isArray(value.pilots) ? value.pilots : []).slice(0, 4)) {
    if (typeof p?.name !== 'string' || pilots.some((q) => q.name === p.name.slice(0, 16))) continue;
    const modules = cleanModules(p.modules);
    pilots.push({
      name: p.name.slice(0, 16),
      modules,
      upgrades: cleanFieldUpgrades(p.upgrades),
      items: cleanFieldItems(p.items),
      xp: count(p.xp, 1000000),
      credits: count(p.credits, 18 - modules.length),
    });
  }
  for (const mission of MISSIONS)
    for (const contract of ['frontline', 'overrun', 'siegebreaker']) {
      const key = mission.id + ':' + contract,
        n = value.records?.[key];
      if (Number.isSafeInteger(n) && n > 0 && n <= 999999) records[key] = n;
    }
  return {
    version: 2,
    id: value.id,
    seed: value.seed >>> 0,
    revision: count(value.revision),
    landing: LANDINGS.some((p) => p.id === value.landing) ? value.landing : 'beachhead',
    contract: contractFor(value.contract).id,
    sorties: count(value.sorties),
    victories: Math.min(count(value.victories), count(value.sorties)),
    lastResult: ['victory', 'defeat', 'withdrawal'].includes(value.lastResult)
      ? value.lastResult
      : null,
    lastReport: cleanSortieReport(value.lastReport),
    records,
    level,
    runState: level === 9 ? 'won' : value.runState === 'lost' ? 'lost' : 'active',
    pilots,
  };
}
export const landingFor = (c) => LANDINGS.find((p) => p.id === c?.landing) || LANDINGS[0];
export const profileFor = (campaign, name) =>
  campaign?.pilots?.find((p) => p.name === String(name).slice(0, 16)) || {
    name: String(name).slice(0, 16),
    modules: [],
    credits: 0,
  };
export const currentMission = (campaign) => MISSIONS[Math.min(8, campaign?.level || 0)];
export function registerPilot(campaign, name, rosterNames = []) {
  name = String(name).slice(0, 16);
  if (campaign.runState !== 'active' || campaign.pilots.some((p) => p.name === name))
    return campaign;
  const retained = [
    ...campaign.pilots.filter((p) => rosterNames.includes(p.name)),
    ...campaign.pilots.filter((p) => !rosterNames.includes(p.name)),
  ].slice(0, 3);
  return {
    ...campaign,
    revision: campaign.revision + 1,
    pilots: [
      ...retained,
      { name, modules: [], upgrades: [], items: [], xp: 0, credits: Math.min(18, campaign.level) },
    ],
  };
}
export function campaignMission(campaign) {
  const mission = campaignRound(
      currentMission(campaign).id,
      (campaign.seed + campaign.sorties * 997) >>> 0,
    ),
    offset = { beachhead: 0, 'west-approach': -160, 'forward-drop': 160 }[campaign.landing] || 0;
  mission.entry.x += offset;
  mission.contract = contractFor(campaign.contract).id;
  mission.campaign = {
    id: campaign.id,
    revision: campaign.revision,
    landing: campaign.landing,
    level: campaign.level,
    pilots: campaign.pilots,
  };
  return mission;
}
export function refitOffer(campaign, name) {
  const p = profileFor(campaign, name);
  if (campaign.runState !== 'active' || !p.credits) return [];
  return [
    ['power', 'breaker'],
    ['plating', 'repair'],
    ['thrusters', 'capacitor'],
  ]
    .map((group, i) => {
      const available = group.filter((id) => p.modules.filter((m) => m === id).length < 3);
      return available[(campaign.seed + p.modules.length * 7 + i) % available.length];
    })
    .filter(Boolean);
}
export function installRefit(campaign, name, request) {
  const p = profileFor(campaign, name);
  if (
    !request ||
    request.revision !== campaign.revision ||
    !refitOffer(campaign, name).includes(request.id)
  )
    return campaign;
  return {
    ...campaign,
    revision: campaign.revision + 1,
    pilots: campaign.pilots.map((q) =>
      q.name === p.name ? { ...q, credits: q.credits - 1, modules: [...q.modules, request.id] } : q,
    ),
  };
}
export function recordSortie(campaign, outcome, report = null) {
  const lastReport = cleanSortieReport(report);
  if (
    (lastReport?.missionId && lastReport.missionId !== currentMission(campaign).id) ||
    campaign.runState !== 'active'
  )
    return campaign;
  const won = outcome === 'victory',
    records = { ...campaign.records },
    level = campaign.level + (won ? 1 : 0),
    runState = won ? (level === MISSIONS.length ? 'won' : 'active') : 'lost';
  if (won && lastReport?.seconds > 0) {
    const key = currentMission(campaign).id + ':' + lastReport.contract;
    records[key] = Math.min(records[key] || Infinity, lastReport.seconds);
  }
  const present = (lastReport?.pilots || []).slice(0, 4).map((p) => {
    const previous = profileFor(campaign, p.name),
      modules = cleanModules(previous.modules),
      earned =
        won && runState === 'active'
          ? 1 +
            Math.min(
              1,
              Math.floor(
                (lastReport.salvageEarned ?? lastReport.salvage ?? 0) /
                  (220 * (1 + 0.4 * (lastReport.teamSize - 1))),
              ),
            )
          : 0;
    return {
      name: p.name.slice(0, 16),
      modules,
      upgrades: cleanFieldUpgrades(won ? p.upgrades : previous.upgrades),
      items: cleanFieldItems(won ? p.items : previous.items),
      xp: count(won ? p.xp : previous.xp, 1000000),
      credits: runState === 'active' ? Math.min(18 - modules.length, previous.credits + earned) : 0,
    };
  });
  const pilots = [
    ...present,
    ...campaign.pilots
      .filter((p) => !present.some((q) => q.name === p.name))
      .map((p) => ({ ...p, credits: runState === 'active' ? p.credits : 0 })),
  ].slice(0, 4);
  return {
    ...campaign,
    revision: campaign.revision + 1,
    sorties: campaign.sorties + 1,
    victories: campaign.victories + (won ? 1 : 0),
    lastResult: outcome,
    lastReport,
    records,
    level,
    runState,
    pilots,
  };
}
export function campaignCells(campaign) {
  return MISSIONS.map((mission, i) => ({
    id: mission.cell,
    col: Number(mission.cell.split('-')[0]),
    row: Number(mission.cell.split('-')[1]),
    x: 100 + (i % 3) * 210,
    y: 100 + Math.floor(i / 3) * 130,
    control:
      i < (campaign?.level || 0)
        ? 'allied'
        : i === (campaign?.level || 0) && campaign?.runState === 'active'
          ? 'contested'
          : 'hostile',
    mission,
    index: i,
  }));
}
