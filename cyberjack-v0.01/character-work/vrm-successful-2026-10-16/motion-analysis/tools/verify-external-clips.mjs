// Проверка экспортированных внешних клипов: FK на нашем риге по трекам файла.
// Печатает диапазоны сгиба колена/локтя, наклона корпуса и высоту голеностопа —
// то, что должно совпасть с измерениями источника (RIG_COMPAT_RU.md §3).
import fs from 'node:fs';
import path from 'node:path';
import {Quaternion, Vector3, Matrix4} from 'three';

const [rigFile, clipsFile] = process.argv.slice(2);
const rig = JSON.parse(fs.readFileSync(rigFile, 'utf8')).rigs.find(r => r.name === 'p_cf_body_bone').bones;
const byName = new Map(rig.map(b => [b.name, b]));
const order = [];
const seen = new Set();
function add(n) {
  if (!n || seen.has(n)) return;
  const b = byName.get(n);
  if (!b) return;
  seen.add(n);
  if (b.parent) add(b.parent);
  order.push(n);
}
for (const b of rig) add(b.name);

const clipDoc = JSON.parse(fs.readFileSync(clipsFile, 'utf8'));
const v3 = m => new Vector3().setFromMatrixPosition(m);
const ang = (a, b) => a.angleTo(b) * 180 / Math.PI;

for (const clip of clipDoc.clips) {
  const local = new Map();
  for (const t of clip.tracks) {
    const times = t.times, rot = t.rotations;
    // ключи уже на 30 fps, кадр = индекс
    for (let i = 0; i < times.length; i++) local.set(t.bone, new Quaternion().fromArray(rot, i*4).normalize());
  }
  const knee = [], elbow = [], lean = [], ankleY = [];
  const n = clip.tracks[0].times.length;
  for (let i = 0; i < n; i++) {
    const world = new Map();
    for (const name of order) {
      const b = byName.get(name);
      // локальный поворот i-го кадра берём из трека, иначе rest
      const tr = clip.tracks.find(t => t.bone === name);
      const q = tr ? new Quaternion().fromArray(tr.rotations, i*4).normalize()
                   : new Quaternion().fromArray(b.rotation);
      const m = new Matrix4().compose(new Vector3().fromArray(b.position), q, new Vector3(1,1,1));
      const pw = b.parent ? world.get(b.parent) : new Matrix4();
      world.set(name, new Matrix4().multiplyMatrices(pw, m));
    }
    const p = n2 => v3(world.get(n2));
    knee.push(ang(p('cf_j_leg01_L').sub(p('cf_j_thigh00_L')), p('cf_j_leg03_L').sub(p('cf_j_leg01_L'))));
    elbow.push(ang(p('cf_j_forearm01_L').sub(p('cf_j_arm00_L')), p('cf_j_hand_L').sub(p('cf_j_forearm01_L'))));
    const up = p('cf_j_neck').sub(p('cf_j_thigh00_L'));
    lean.push(Math.atan2(Math.hypot(up.x, up.z), up.y) * 180 / Math.PI);
    ankleY.push(p('cf_j_leg03_L').y);
  }
  const rng = a => [Math.round(Math.min(...a)), Math.round(Math.max(...a))];
  const restAnkle = new Vector3().fromArray(byName.get('cf_j_leg03_L').position).y;
  console.log(clip.id.padEnd(24), 'колено', JSON.stringify(rng(knee)), 'локоть', JSON.stringify(rng(elbow)),
    'наклон', JSON.stringify(rng(lean)), '| голеностоп y', Math.min(...ankleY).toFixed(3),
    '(rest', restAnkle.toFixed(3) + ')');
}
