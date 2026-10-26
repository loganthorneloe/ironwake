import { obstacleSolid, structureBoxes } from './destruction.js';
import { FIELD_ITEMS, FIELD_RELAYS } from './field-catalog.js';
export function drawMap(canvas, m, world = null, selfId = null) {
  const rect = canvas.getBoundingClientRect(),
    w = rect.width || 240,
    h = rect.height || 170,
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = '#101d22';
  c.fillRect(0, 0, w, h);
  const minX = Math.min(...m.rooms.map((p) => p.x)) - 280,
    minY = Math.min(...m.rooms.map((p) => p.y)) - 280,
    maxX = Math.max(...m.rooms.map((p) => p.x)) + 280,
    maxY = Math.max(...m.rooms.map((p) => p.y)) + 280,
    scale = Math.min((w - 20) / (maxX - minX), (h - 35) / (maxY - minY)),
    ox = (w - (maxX - minX) * scale) / 2 - minX * scale,
    oy = (h - 15 - (maxY - minY) * scale) / 2 - minY * scale;
  c.save();
  c.translate(ox, oy);
  c.scale(scale, scale);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = '#40574f';
  c.lineWidth = 240;
  for (const path of m.paths) {
    c.beginPath();
    path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  }
  for (const room of m.rooms) {
    c.fillStyle = '#40574f';
    c.fillRect(room.x - 240, room.y - 240, 480, 480);
  }
  for (const original of m.obstacles.filter((o) => !o.wall && obstacleSolid(m, o)))
    for (const o of structureBoxes(m, original)) {
      c.fillStyle = '#1c2c30';
      c.fillRect(o.x, o.y, o.w, o.h);
    }
  for (const p of m.platforms || []) {
    c.fillStyle = p.kind === 'perch' ? '#b9a7e777' : '#86c6e755';
    c.fillRect(p.x, p.y, p.w, p.h);
  }
  for (const r of m.ramps || []) {
    c.fillStyle = '#c4e3ef55';
    c.fillRect(r.x, r.y, r.w, r.h);
  }
  c.strokeStyle = '#c1d1b377';
  c.lineWidth = 12;
  c.setLineDash([25, 45]);
  for (const path of m.paths) {
    c.beginPath();
    path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  }
  c.setLineDash([]);
  const dot = (p, color, r = 55) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.fill();
  };
  dot(m.entry, '#8cbbb2');
  m.zones.forEach((z, i) => {
    dot(
      z,
      world && i < world.cleared ? '#a0dfb4' : z.boss ? '#f58d62' : '#d2af7e',
      z.boss ? 78 : 50,
    );
  });
  dot(m.exit, '#a0e7e5', 70);
  if (world) {
    for (const node of (world.field?.nodes || []).slice(0, 64)) {
      if (node.state === 'spent' || node.claimed?.includes(selfId)) continue;
      const relay = node.kind === 'relay',
        meta = relay ? FIELD_RELAYS[node.relayId] : FIELD_ITEMS[node.itemId];
      c.strokeStyle = meta?.color || '#edcd9a';
      c.lineWidth = 15;
      if (relay) {
        c.beginPath();
        c.moveTo(node.x, node.y - 55);
        c.lineTo(node.x, node.y + 55);
        c.moveTo(node.x - 42, node.y - 15);
        c.lineTo(node.x + 42, node.y - 15);
        c.stroke();
      } else c.strokeRect(node.x - 35, node.y - 30, 70, 60);
    }
    world.enemies.forEach((e) => dot(e, '#ff553c', 25));
    world.players.forEach((p) =>
      dot(
        p,
        p.hp <= 0 ? '#a56868' : p.id === selfId ? '#ffffff' : '#a4efc5',
        p.id === selfId ? 65 : 45,
      ),
    );
  }
  c.restore();
  c.font = '9px monospace';
  c.fillStyle = '#b2c4ba';
  c.fillText(world ? 'LEVEL MAP · WHITE = YOU' : 'INSERTION → 5 SECTORS → EXTRACTION', 10, h - 8);
}
