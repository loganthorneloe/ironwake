import { CHASSIS, CHASSIS_CLASSES } from './chassis.js';
import { treeFor, careerProfile, availablePoints, nodeStatus } from './career-progression.js';

const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const pointLabel = (count) => `${count} ${count === 1 ? 'point' : 'points'}`;

function chassisOptions(selected, equipped) {
  return `<option value="custom"${selected === 'custom' ? ' selected' : ''}>Custom frame${equipped === 'custom' ? ' · equipped' : ''}</option>${Object.entries(
    CHASSIS_CLASSES,
  )
    .map(
      ([id, group]) =>
        `<optgroup label="${escape(group.name)}">${Object.values(CHASSIS)
          .filter((c) => c.size === id)
          .map(
            (c) =>
              `<option value="${c.id}"${selected === c.id ? ' selected' : ''}>${escape(c.name)}${equipped === c.id ? ' · equipped' : ''}</option>`,
          )
          .join('')}</optgroup>`,
    )
    .join('')}`;
}

// A station owns one discipline: chassis research at the Foundry, pilot training
// at the Archive. The surrounding hub remains visible and owns interaction range.
export function careerStationMarkup({
  career,
  build,
  pilot,
  kind = 'mech',
  chassisId,
  branchId,
} = {}) {
  kind = kind === 'pilot' ? 'pilot' : 'mech';
  const equipped = Object.hasOwn(CHASSIS, build?.chassis) ? build.chassis : 'custom';
  const selected =
      chassisId === 'custom' || Object.hasOwn(CHASSIS, chassisId) ? chassisId : equipped,
    key = kind === 'mech' ? selected : pilot;
  const tree = treeFor(kind, key) || treeFor(kind),
    profile = careerProfile(career, kind, key),
    points = availablePoints(career, kind, key),
    nodes = tree.branches.flatMap((branch) => branch.nodes);
  const branch = tree.branches.find((branch) => branch.id === branchId) || tree.branches[0],
    branchIndex = tree.branches.indexOf(branch),
    purchased = nodes.filter((node) => profile.unlocked.includes(node.id)),
    spent = purchased.reduce((sum, node) => sum + node.cost, 0);
  const identity =
    kind === 'mech' ? CHASSIS[selected]?.name || 'Custom frame' : pilot || 'Your pilot';
  return `<section class="career-station" aria-label="${kind === 'mech' ? 'Chassis research' : 'Pilot training'}" data-career-kind="${kind}" data-career-key="${escape(key)}" data-career-revision="${escape(career?.revision ?? 0)}">
  <div class="career-identity"><span class="career-kicker">${kind === 'mech' ? (selected === equipped ? 'EQUIPPED CHASSIS' : 'BROWSING CHASSIS') : 'ACTIVE PILOT'}</span>${kind === 'mech' ? `<label for="career-chassis">Research chassis</label><select id="career-chassis" data-career-chassis aria-describedby="career-scope">${chassisOptions(selected, equipped)}</select>` : `<h3>${escape(identity)}</h3>`}<p id="career-scope">${kind === 'mech' ? 'Each chassis keeps its own research. Browsing keeps your equipped mech.' : 'Training follows this callsign, whichever mech you equip.'}</p></div>
  <dl class="career-points" aria-label="Career points"><div class="career-points-available"><dt>Available points</dt><dd>${escape(points)}</dd></div><div><dt>Total earned</dt><dd>${escape(profile.earned)}</dd></div><div><dt>Installed</dt><dd>${purchased.length}<small> / ${nodes.length}</small></dd></div></dl>
  <nav class="career-paths" aria-label="${kind === 'mech' ? 'Chassis research' : 'Pilot training'} paths">${tree.branches.map((path, index) => `<button data-career-branch="${escape(path.id)}" aria-pressed="${path === branch}" aria-controls="career-active-path"><small>PATH ${String(index + 1).padStart(2, '0')}</small><span>${escape(path.name)}</span></button>`).join('')}</nav>
  <p class="career-feedback" role="status" aria-live="polite" tabindex="-1">Choose a path, then certify an available upgrade.</p>
  <div class="career-branch" id="career-active-path"><div class="career-path-heading"><h3>${escape(branch.name)}</h3><p>${escape(branch.description)}</p></div><ol class="career-nodes">${branch.nodes
    .map((node, rank) => {
      const status = nodeStatus(career, kind, key, node.id),
        state = status.unlocked ? 'unlocked' : status.available ? 'available' : 'locked',
        reasonId = `career-reason-${kind}-${branchIndex}-${rank}`;
      const prerequisites = node.requires.map((id) => nodes.find((n) => n.id === id)?.name || id);
      const reason = status.unlocked
        ? 'Permanent certification installed.'
        : status.available
          ? 'Ready to certify at this station.'
          : status.reason;
      return `<li class="career-node career-node-${state}" data-career-node="${escape(node.id)}">${rank ? '<span class="career-link" aria-hidden="true">↓</span>' : ''}<article><div class="career-node-meta"><span>RANK ${String(rank + 1).padStart(2, '0')}</span><span>${status.unlocked ? '✓ INSTALLED' : status.available ? '◇ AVAILABLE' : '▣ LOCKED'}</span></div><h4>${escape(node.name)}</h4><p class="career-effect">${escape(node.description)}</p><p class="career-requires">${prerequisites.length ? `Requires: ${prerequisites.map(escape).join(' + ')}` : 'Entry certification · no prerequisite'}</p><div class="career-node-action"><p id="${reasonId}">${escape(reason)}</p><button data-career-unlock="${escape(node.id)}" aria-describedby="${reasonId}"${status.available && !status.unlocked ? '' : ' disabled'}>${status.unlocked ? 'Installed' : `Certify · ${escape(pointLabel(node.cost))}`}</button></div></article></li>`;
    })
    .join('')}</ol></div>
  <footer class="career-footer"><button data-career-reset${purchased.length ? '' : ' disabled'}>Respec ${kind === 'mech' ? 'chassis' : 'pilot'} · refund ${escape(pointLabel(spent))}</button><p>Free respec keeps earned points. Start with 1 point; each successful campaign extraction earns 1 more for your deployed chassis and pilot, up to 18 per tree.</p><p>Saved on this browser across campaigns. In-mission upgrades and run refits use their own rewards.</p></footer>
 </section>`;
}
