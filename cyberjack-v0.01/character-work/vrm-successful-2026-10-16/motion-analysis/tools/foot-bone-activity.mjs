// Активность костей стопы: leg03 (голеностоп) vs foot (плюсна) vs toes.
// Показывает, какая кость несёт артикуляцию стопы в реальных клипах.
import {buildRig, decoder} from './geometry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.argv[2];
const rigFile = process.argv[3];
const limit = Number(process.argv[4] || 40);
const sr = JSON.parse(fs.readFileSync(rigFile, 'utf8'));
const rig = buildRig(sr.rigs.find(r => r.name === 'p_cf_body_bone').bones);
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'animations/catalog.json'), 'utf8'));
const clips = catalog.clips.filter(c => c.playable && c.rig === 'female');
const step = Math.max(1, Math.floor(clips.length / limit));

const BONES = ['cf_j_leg03_L', 'cf_j_foot_L', 'cf_j_toes_L', 'cf_j_leg03_R', 'cf_j_foot_R', 'cf_j_toes_R'];
const acc = Object.fromEntries(BONES.map(b => [b, {clips: 0, travel: 0, max: 0}]));
const angle = (a, b) => {
  const d = Math.min(1, Math.abs(a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]));
  return 2 * Math.acos(d) * 180 / Math.PI;
};

for (let i = 0; i < clips.length; i += step) {
  const c = clips[i];
  let data;
  try { data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'animations', c.asset)))); } catch { continue; }
  let dec;
  try { dec = decoder(data, rig.needed); } catch { continue; }
  const dur = Number(c.duration) || 0;
  if (!dur) continue;
  const n = 25;
  for (const bone of BONES) {
    const tr = dec.bindings.find(b => b.bone === bone && b.attribute === 2);
    if (!tr) continue;
    let prev = null, total = 0, maxStep = 0;
    for (let k = 0; k < n; k++) {
      const q = dec.sample(tr, dur * k / (n - 1));
      if (!q.every(Number.isFinite)) continue;
      if (prev) { const a = angle(prev, q); total += a; maxStep = Math.max(maxStep, a); }
      prev = q;
    }
    acc[bone].clips++; acc[bone].travel += total; acc[bone].max = Math.max(acc[bone].max, maxStep);
  }
}
for (const bone of BONES) {
  const a = acc[bone];
  if (!a.clips) { console.log(bone, 'нет треков'); continue; }
  console.log(bone, 'клипов', a.clips, '| средний суммарный поворот', (a.travel / a.clips).toFixed(1) + '°',
    '| макс. шаг', a.max.toFixed(1) + '°');
}
