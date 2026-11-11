// Typical item offset per (item, body area), taken from the item clips themselves: the median of their first
// frame positions in the parent bone's space. Used when a body clip has no paired item clip, so a prop does not
// fall back to the bone centre (inside the body).
import fs from 'node:fs';

const table = JSON.parse(fs.readFileSync('data/prop-links.json'));
const links = table.links;
const motion = table.motion;

const areaOf = (name) => {
  if (/kokan/i.test(name)) return 2;
  if (/mune/i.test(name)) return /_L$|muneL|mune.*L_/.test(name) && !/muneR/i.test(name) ? 0 : 1;
  if (/siriL/i.test(name)) return 4;
  if (/siriR/i.test(name)) return 5;
  if (/siri/i.test(name)) return 4;
  if (/anal/i.test(name)) return 3;
  return null;
};

// Object clips are named after the item family, and the prefab name follows the same convention.
const prefabFor = (stem, side) => {
  if (/^Denma/i.test(stem)) return 'p_item_denma_' + side;
  if (/^Vibe/i.test(stem)) return 'p_item_vibe';
  if (/^Rotor/i.test(stem)) return 'p_item_rotor_' + side;
  if (/^Sita/i.test(stem)) return 'p_tang';
  if (/^Te_/i.test(stem) || /^Te$/i.test(stem)) return side === 'R' ? 'p_handR' : 'p_handL';
  return null;
};

const buckets = new Map();
const LIMIT = 0.4; // metres: anything further from the bone is a different clip space, not a placement
const push = (prefab, area, point) => {
  if (!prefab || area === null || !point) return;
  if (Math.hypot(point[0], point[1], point[2]) > LIMIT) return;
  const key = `${prefab}|${area}`;
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push(point);
};

for (const [stem, sides] of Object.entries(links)) {
  const area = areaOf(stem);
  for (const [side, info] of Object.entries(sides)) {
    const track = motion[info.clipId];
    if (!track?.points?.length) continue;
    push(prefabFor(stem, side), area, track.points[0]);
  }
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const defaults = {};
for (const [key, points] of buckets) {
  const [prefab, area] = key.split('|');
  defaults[prefab] = defaults[prefab] || {};
  defaults[prefab][area] = [0, 1, 2].map((axis) => Number(median(points.map((p) => p[axis])).toFixed(4)));
  defaults[prefab][area + '_n'] = points.length;
}

fs.writeFileSync('data/item-defaults.json', JSON.stringify({
  format: 'item-defaults-v1',
  note: 'медиана первого кадра клипов предмета в системе родительской кости',
  defaults,
}, null, 0));

for (const [prefab, areas] of Object.entries(defaults)) {
  const rows = Object.entries(areas).filter(([k]) => !k.endsWith('_n'))
    .map(([area, p]) => `область ${area}: ${p.map((x) => (x * 100).toFixed(1)).join(' / ')} см (${areas[area + '_n']} клипов)`);
  console.log(prefab, '\n  ' + rows.join('\n  '));
}
