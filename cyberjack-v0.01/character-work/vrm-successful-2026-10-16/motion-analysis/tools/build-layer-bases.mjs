// Suggest a base pose for every layer clip: the base controller of the clip's position lists the clips that
// carry the pose (S_Idle / M_Idle / L_Idle and their family), so one of them can serve as the base in a mix.
import fs from 'node:fs';

const data = 'data';
const catalog = JSON.parse(fs.readFileSync('../animations/catalog.json')).clips;
const byName = new Map();
for (const c of catalog) if (!byName.has(c.name)) byName.set(c.name, c);

const links = JSON.parse(fs.readFileSync(data + '/layer-links.json')).clips;
const positions = JSON.parse(fs.readFileSync(data + '/position-bases.json')).positions;

const score = (name) => {
  let s = 0;
  if (/idle/i.test(name)) s += 3;
  if (/loop/i.test(name)) s += 1;
  if (/^[SML]_/.test(name)) s += 1; // S/M/L are size variants of the same pose family
  if (/touch|orgasm|out/i.test(name)) s -= 2;
  return s;
};

const out = {};
for (const [clipName, info] of Object.entries(links)) {
  const clip = byName.get(clipName);
  if (!clip) continue;
  const candidates = [];
  for (const pos of info.positions) {
    const key = `${pos.side}/${pos.mode}/${pos.id}`;
    const record = positions[key];
    if (!record) continue;
    for (const name of record.baseClips || []) {
      const c = byName.get(name);
      if (c && c.rig === clip.rig) candidates.push({ clipId: c.id, name: c.name, position: pos.nameJa, mode: pos.mode, positionId: pos.id, score: score(name) });
    }
  }
  if (!candidates.length) continue;
  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const best = candidates[0];
  out[clip.id] = { baseClip: best.clipId, baseName: best.name, position: best.position, mode: best.mode, positionId: best.positionId, alternatives: candidates.slice(1, 4).map((c) => c.name) };
}
fs.writeFileSync(data + '/layer-bases.json', JSON.stringify({ format: 'layer-bases-v1', items: out }));
const total = Object.keys(out).length;
console.log('слоёв с предложенной базой:', total);
for (const id of ['cf6a6b058e68bd52fe4e69c2']) console.log(id, JSON.stringify(out[id]));
