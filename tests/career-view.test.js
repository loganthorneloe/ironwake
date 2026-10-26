import test from 'node:test';
import assert from 'node:assert/strict';
import { CHASSIS } from '../dist/chassis.js';
import { newCareer, treeFor, unlockCareer, nodeStatus } from '../dist/career-progression.js';
import { careerStationMarkup } from '../dist/career-view.js';

const pilot = 'PILOT-ABCDEFGH',
  build = { chassis: 'vanguard' };
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const nodeCard = (html, id) => html.split(`data-career-node="${id}"`)[1]?.split('</li>')[0];

test('every chassis has three discoverable paths and shows only the selected chain in its station', () => {
  const career = newCareer(),
    before = JSON.stringify(career);
  for (const id of ['custom', ...Object.keys(CHASSIS)]) {
    const tree = treeFor('mech', id);
    for (const branch of tree.branches) {
      const html = careerStationMarkup({
        career,
        build,
        pilot,
        chassisId: id,
        branchId: branch.id,
      });
      assert.equal((html.match(/data-career-branch=/g) || []).length, 3, id);
      assert.equal((html.match(/data-career-node=/g) || []).length, 3, id);
      assert.match(html, new RegExp(`value="${id}" selected`), id);
      assert.equal((html.match(/ selected/g) || []).length, 1, id);
      for (const path of tree.branches) {
        assert.ok(html.includes(escape(path.name)), id);
        assert.ok(
          html.includes(`data-career-branch="${path.id}" aria-pressed="${path === branch}"`),
        );
        for (const node of path.nodes) {
          const card = nodeCard(html, node.id);
          if (path !== branch) {
            assert.equal(card, undefined);
            continue;
          }
          assert.ok(card, node.id);
          assert.ok(card.includes(escape(node.name)), node.id);
          assert.ok(card.includes(escape(node.description)), node.id);
          assert.ok(card.includes(`${node.cost} ${node.cost === 1 ? 'point' : 'points'}`), node.id);
          for (const required of node.requires) {
            const parent = tree.branches.flatMap((b) => b.nodes).find((n) => n.id === required);
            assert.ok(card.includes(escape(parent.name)), node.id + ' names its prerequisite');
          }
        }
      }
      assert.ok(html.includes(id === build.chassis ? 'EQUIPPED CHASSIS' : 'BROWSING CHASSIS'));
    }
  }
  assert.equal(JSON.stringify(career), before, 'Browsing does not modify career progression');
  assert.equal(build.chassis, 'vanguard', 'Browsing does not equip a chassis');
});

test('station offers available upgrades and explains locked prerequisites and point costs', () => {
  const career = newCareer(),
    tree = treeFor('mech', build.chassis);
  for (const branch of tree.branches) {
    const html = careerStationMarkup({ career, build, pilot, branchId: branch.id });
    for (const node of branch.nodes) {
      const status = nodeStatus(career, 'mech', build.chassis, node.id),
        card = nodeCard(html, node.id),
        button = card.match(/<button[^>]*data-career-unlock=[^>]*>/)[0];
      assert.equal(button.includes(' disabled'), !status.available, node.id);
      assert.ok(card.includes(status.available ? 'AVAILABLE' : 'LOCKED'), node.id);
      if (!status.available) assert.ok(card.includes(escape(status.reason)), node.id);
      assert.match(button, /aria-describedby="career-reason-mech-\d-\d"/);
    }
    assert.match(html, /data-career-reset disabled/);
    assert.match(html, /refund 0 points/);
    assert.match(
      html,
      /data-career-kind="mech" data-career-key="vanguard" data-career-revision="0"/,
    );
  }
});

test('purchased certifications show installed state and respec refunds points across paths', () => {
  let career = newCareer();
  const tree = treeFor('mech', build.chassis),
    node = tree.branches[0].nodes[0];
  career = unlockCareer(career, {
    kind: 'mech',
    key: build.chassis,
    nodeId: node.id,
    revision: career.revision,
  });
  const html = careerStationMarkup({ career, build, pilot }),
    card = nodeCard(html, node.id);
  assert.ok(card.includes('✓ INSTALLED'));
  assert.ok(card.includes('Permanent certification installed.'));
  assert.match(card, /<button[^>]* disabled>/);
  assert.doesNotMatch(html, /data-career-reset disabled/);
  assert.ok(html.includes(`refund ${node.cost} point`));
  assert.match(html, /class="career-points-available"><dt>Available points<\/dt><dd>0<\/dd>/);
  assert.match(html, /data-career-revision="1"/);
  const otherPath = careerStationMarkup({ career, build, pilot, branchId: tree.branches[1].id });
  assert.match(
    otherPath,
    /Respec chassis · refund 1 point/,
    'Respec applies to this chassis across every path',
  );
});

test('Archive training follows the pilot across mechs and has no global mech/pilot screen tabs', () => {
  const career = newCareer(),
    html = careerStationMarkup({ career, build, pilot, kind: 'pilot' });
  assert.equal(
    html,
    careerStationMarkup({
      career,
      build: { chassis: 'colossus' },
      pilot,
      kind: 'pilot',
      chassisId: 'needle',
    }),
  );
  assert.match(html, /ACTIVE PILOT/);
  assert.ok(html.includes(pilot));
  assert.doesNotMatch(html, /data-career-chassis|data-career-tab/);
  assert.match(html, /whichever mech you equip/);
  assert.match(html, /successful campaign extraction earns 1 more/);
  assert.match(html, /Saved on this browser across campaigns/);
  assert.match(html, /In-mission upgrades and run refits use their own rewards/);
  assert.match(html, /Respec pilot/);
  assert.match(html, /role="status" aria-live="polite" tabindex="-1"/);
  assert.doesNotMatch(html, /Built for the next drop|CAREER COMMAND|<h2/);
});

test('dynamic pilot text is escaped and invalid browser choices fall back to equipped chassis and first path', () => {
  const career = newCareer(),
    payload = 'PILOT-<script>"&\'boom</script>',
    html = careerStationMarkup({ career, build, pilot: payload, kind: 'pilot' });
  assert.ok(html.includes(escape(payload)));
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /"&'boom/);
  const fallback = careerStationMarkup({
    career,
    build,
    pilot,
    kind: 'missing',
    chassisId: '__proto__',
    branchId: '__proto__',
  });
  assert.match(fallback, /data-career-kind="mech"/);
  assert.match(fallback, /value="vanguard" selected/);
  assert.match(fallback, /EQUIPPED CHASSIS/);
  assert.match(fallback, /data-career-branch="role" aria-pressed="true"/);
  assert.match(careerStationMarkup({ career, pilot }), /value="custom" selected/);
});
