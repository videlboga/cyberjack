// Ошибка стопы при разных вариантах карты: leg03 (голеностоп) vs foot (плюсна).
// Считаем, насколько уезжает носок, если выбросить поворот кости — в см и в долях роста.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {Quaternion, Vector3, Matrix4} from 'three';
import {buildRig, decoder} from './geometry.mjs';

const root = process.argv[2];
const rigFile = process.argv[3];
const limit = Number(process.argv[4] || 30);
const sr = JSON.parse(fs.readFileSync(rigFile, 'utf8'));
const rigBones = sr.rigs.find(r => r.name === 'p_cf_body_bone').bones;
const rig = buildRig(rigBones);
const byName = new Map(rigBones.map(b => [b.name, b]));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'animations/catalog.json'), 'utf8')).clips
  .filter(c => c.playable && c.rig === 'female');
const step = Math.max(1, Math.floor(catalog.length / limit));

// порядок костей от корня
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
for (const b of rigBones) add(b.name);

function fk(overrides) {
  // overrides: Map имя → Quaternion (локальный поворот вместо rest)
  const world = new Map();
  for (const name of order) {
    const b = byName.get(name);
    const q = overrides.get(name) || new Quaternion().fromArray(b.rotation);
    const p = new Vector3().fromArray(b.position);
    const m = new Matrix4().compose(p, q, new Vector3(1, 1, 1));
    const pw = b.parent ? world.get(b.parent) : new Matrix4();
    world.set(name, new Matrix4().multiplyMatrices(pw || new Matrix4(), m));
  }
  return world;
}
const pos = (w, n) => new Vector3().setFromMatrixPosition(w.get(n));

const variants = {
  truth: ['cf_j_leg03_L', 'cf_j_foot_L', 'cf_j_toes_L'],
  current_map: ['cf_j_foot_L', 'cf_j_toes_L'],            // leg03 выброшен
  proposed: ['cf_j_leg03_L', 'cf_j_toes_L'],              // foot выброшен
  composed: ['cf_j_leg03_L', 'cf_j_foot_L', 'cf_j_toes_L'] // foot вкомпонован в голеностоп
};

const acc = Object.fromEntries(Object.keys(variants).map(k => [k, {n: 0, toe: 0, footDir: 0}]));
const qmul = (a, b) => a.clone().multiply(b);

for (let i = 0; i < catalog.length; i += step) {
  const c = catalog[i];
  let data, dec;
  try {
    data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'animations', c.asset))));
    dec = decoder(data, rig.needed);
  } catch { continue; }
  const dur = Number(c.duration) || 0;
  if (!dur) continue;
  const t = dur * 0.4;
  const sample = name => {
    const tr = dec.bindings.find(b => b.bone === name && b.attribute === 2);
    if (!tr) return null;
    const v = dec.sample(tr, t);
    return v.every(Number.isFinite) ? new Quaternion().fromArray(v).normalize() : null;
  };
  const qLeg = sample('cf_j_leg03_L'), qFoot = sample('cf_j_foot_L'), qToe = sample('cf_j_toes_L');
  if (!qLeg || !qFoot || !qToe) continue;

  const build = keys => {
    const m = new Map();
    if (keys.includes('cf_j_leg03_L')) m.set('cf_j_leg03_L', qLeg);
    if (keys.includes('cf_j_foot_L')) m.set('cf_j_foot_L', qFoot);
    if (keys.includes('cf_j_toes_L')) m.set('cf_j_toes_L', qToe);
    if (keys.includes('composed')) m.set('cf_j_foot_L', qmul(qLeg, qFoot)); // приближение: стопа жёсткая
    return fk(m);
  };
  const truth = build(['cf_j_leg03_L', 'cf_j_foot_L', 'cf_j_toes_L']);
  const toeTruth = pos(truth, 'cf_j_toes_L');
  const footTruth = pos(truth, 'cf_j_foot_L').sub(pos(truth, 'cf_j_leg03_L')).normalize();
  const height = pos(truth, 'cf_j_head').y - pos(truth, 'cf_j_leg03_L').y;

  for (const [name, keys] of Object.entries({
    current_map: ['cf_j_foot_L', 'cf_j_toes_L'],
    proposed: ['cf_j_leg03_L', 'cf_j_toes_L'],
    composed: ['composed', 'cf_j_toes_L']
  })) {
    const w = build(keys);
    const toe = pos(w, 'cf_j_toes_L');
    const footDir = pos(w, 'cf_j_foot_L').sub(pos(w, 'cf_j_leg03_L')).normalize();
    acc[name].n++;
    acc[name].toe += toe.distanceTo(toeTruth) / height * 100;
    acc[name].footDir += footDir.angleTo(footTruth) * 180 / Math.PI;
  }
}

for (const [name, a] of Object.entries(acc)) {
  if (!a.n) { console.log(name, 'нет данных'); continue; }
  console.log(name.padEnd(12), 'клипов', a.n,
    '| носок уезжает на', (a.toe / a.n).toFixed(2), '% роста',
    '| ориентация плюсны врёт на', (a.footDir / a.n).toFixed(1) + '°');
}
