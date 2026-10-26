import { obstacleSolid, structureBoxes } from './destruction.js';
import { destructionMarkers } from './destruction-mission.js';
import { operationMarkers } from './planet-mission.js?v=41';
import { FIELD_ITEMS, FIELD_RELAYS } from './field-catalog.js';
export const MAP_RANGE = 650;
export function mapPoint(x, y, p, size = 180) {
  return {
    x: size / 2 + ((x - p.x) / MAP_RANGE) * (size / 2 - 10),
    y: size / 2 + ((y - p.y) / MAP_RANGE) * (size / 2 - 10),
  };
}
export function drawNearbyMap(canvas, w, p, yaw) {
  const size = 180,
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  const c = canvas.getContext('2d'),
    scale = 80 / MAP_RANGE;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, size, size);
  c.fillStyle = '#06180de8';
  c.fillRect(0, 0, size, size);
  c.save();
  c.beginPath();
  c.rect(0, 0, size, size);
  c.clip();
  c.strokeStyle = '#66e88c18';
  c.lineWidth = 1;
  for (let x = Math.floor((p.x - MAP_RANGE) / 200) * 200; x < p.x + MAP_RANGE; x += 200) {
    const v = mapPoint(x, p.y, p);
    c.beginPath();
    c.moveTo(v.x, 0);
    c.lineTo(v.x, size);
    c.stroke();
  }
  for (let y = Math.floor((p.y - MAP_RANGE) / 200) * 200; y < p.y + MAP_RANGE; y += 200) {
    const v = mapPoint(p.x, y, p);
    c.beginPath();
    c.moveTo(0, v.y);
    c.lineTo(size, v.y);
    c.stroke();
  }
  for (const original of [...(w.mission.obstacles || []), ...(w.mission.platforms || [])])
    for (const o of structureBoxes(w.mission, original)) {
      if (!obstacleSolid(w.mission, o)) continue;
      const q = mapPoint(o.x, o.y, p);
      c.fillStyle = o.z ? '#7cff9940' : '#7cff991b';
      c.strokeStyle = '#7cff9970';
      c.fillRect(q.x, q.y, o.w * scale, o.h * scale);
      c.strokeRect(q.x, q.y, o.w * scale, o.h * scale);
    }
  if (w.mission.spine) {
    c.strokeStyle = '#b3ef7e55';
    c.lineWidth = 3;
    c.beginPath();
    w.mission.spine.forEach((q, i) => {
      const v = mapPoint(q.x, q.y, p);
      i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y);
    });
    c.stroke();
  }
  const contact = (q, ally) => {
    const a = mapPoint(q.x, q.y, p);
    if (a.x < 6 || a.x > 174 || a.y < 6 || a.y > 174) return;
    c.save();
    c.translate(a.x, a.y);
    c.strokeStyle = ally ? '#b9ffc6' : '#63ff8a';
    c.fillStyle = c.strokeStyle;
    c.lineWidth = 1.5;
    if (ally) {
      c.beginPath();
      c.arc(0, 0, 3.5, 0, Math.PI * 2);
      c.stroke();
      if (q.hp <= 0) {
        c.beginPath();
        c.moveTo(-3, -3);
        c.lineTo(3, 3);
        c.moveTo(3, -3);
        c.lineTo(-3, 3);
        c.stroke();
      }
    } else {
      c.rotate(Math.PI / 4);
      c.strokeRect(-2.5, -2.5, 5, 5);
    }
    if (Math.abs((q.altitude || 0) - (p.altitude || 0)) > 35) {
      c.font = '9px monospace';
      c.fillText(q.altitude > p.altitude ? '+' : '−', 5, -5);
    }
    c.restore();
  };
  for (const e of w.enemies) if (e.hp > 0) contact(e, false);
  for (const q of w.players) if (q.id !== p.id) contact(q, true);
  // Square salvage containers and antenna-shaped relays remain distinguishable
  // without color. A pilot's claimed relay disappears from their local map.
  for (const node of (w.field?.nodes || []).slice(0, 64)) {
    if (node.state === 'spent' || node.claimed?.includes(p.id)) continue;
    const a = mapPoint(node.x, node.y, p);
    if (a.x < 7 || a.x > 173 || a.y < 7 || a.y > 173) continue;
    const relay = node.kind === 'relay',
      meta = relay ? FIELD_RELAYS[node.relayId] : FIELD_ITEMS[node.itemId];
    c.strokeStyle = meta?.color || '#edcd9a';
    c.lineWidth = 1.5;
    c.beginPath();
    if (relay) {
      c.moveTo(a.x, a.y + 4);
      c.lineTo(a.x, a.y - 4);
      c.moveTo(a.x - 3, a.y - 2);
      c.lineTo(a.x + 3, a.y - 2);
      c.moveTo(a.x - 4, a.y);
      c.lineTo(a.x, a.y - 5);
      c.lineTo(a.x + 4, a.y);
    } else {
      c.rect(a.x - 3.5, a.y - 3, 7, 6);
      c.moveTo(a.x - 1, a.y - 3);
      c.lineTo(a.x - 1, a.y + 3);
    }
    c.stroke();
  }
  if (w.operation || w.siege)
    for (const m of (w.siege ? destructionMarkers(w) : operationMarkers(w, p))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 4)) {
      const a = mapPoint(m.x, m.y, p),
        dx = a.x - 90,
        dy = a.y - 90,
        f = Math.min(1, 76 / Math.max(Math.abs(dx), Math.abs(dy), 1));
      c.fillStyle = '#ffe4a3';
      c.fillRect(90 + dx * f - 3, 90 + dy * f - 3, 6, 6);
    }
  c.save();
  c.translate(90, 90);
  c.rotate(yaw + Math.PI / 2);
  c.fillStyle = '#e2ffe6';
  c.shadowColor = '#6cff91';
  c.shadowBlur = 8;
  c.beginPath();
  c.moveTo(0, -6);
  c.lineTo(-4, 5);
  c.lineTo(0, 3);
  c.lineTo(4, 5);
  c.closePath();
  c.fill();
  c.restore();
  c.restore();
  c.fillStyle = '#8fe8a6';
  c.font = '10px monospace';
  c.fillText('N ↑', 8, 13);
  c.fillText('650m', 140, 171);
}
