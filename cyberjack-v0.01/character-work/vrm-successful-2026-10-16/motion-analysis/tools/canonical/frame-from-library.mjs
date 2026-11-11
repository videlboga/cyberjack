// Кадр из библиотеки: положения суставов И мировые повороты костей.
//
// Повороты нужны, чтобы перенести не только направление, но и скрутку вокруг оси кости —
// иначе кисти и стопы встают «правильно в пространстве, но вывернуто».
//
// Своя FK здесь допустима только потому, что она СВЕРЯЕТСЯ с их же результатом:
// analyze() отдаёт мировые положения суставов, и если мои положения с ними совпадают,
// значит и повороты посчитаны тем же способом. Без этой сверки числам верить нельзя.
//
//   node tools/canonical/frame-from-library.mjs <clipId> <time> out.json
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {analyze, buildRig, decoder} from '../geometry.mjs';
import {Vector3, Quaternion, Matrix4} from 'three';

const [clipId, tArg, outPath] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '../../..');   // vrm-successful-2026-10-16
const catalog = JSON.parse(fs.readFileSync(root + '/animations/catalog.json', 'utf8')).clips;
const clip = catalog.find(c => c.id === clipId);
if (!clip) throw Error('unknown-clip');
const rigs = JSON.parse(fs.readFileSync(root + '/animations/source_rigs.json', 'utf8')).rigs;
const rigBones = rigs.find(r => r.name === (clip.rig === 'male' ? 'p_cm_body_00' : 'p_cf_body_bone')).bones;
const rig = buildRig(rigBones);
// основания пальцев нужны для плоскости ладони; buildRig тянет только цепочки из 22 суставов,
// поэтому достраиваем набор вручную — тем же правилом (кость + все её предки)
const FINGERS = ['index', 'middle', 'ring', 'little', 'thumb'];
const FINGER_BASES = [];
for (const cap of ['L', 'R']) {
  for (const f of FINGERS) {
    for (const k of ['01', '02', '03', '04']) {
      const n = `cf_j_${f}${k}_${cap}`;
      if (rigBones.some(b => b.name === n)) FINGER_BASES.push(n);
    }
  }
}
{
  const all = new Map(rigBones.map(b => [b.name, b]));
  for (const n of FINGER_BASES) {
    let b = all.get(n);
    while (b && !rig.needed.has(b.name)) {
      rig.needed.add(b.name);
      b = all.get(b.parent);
    }
  }
  const ordered = [];
  const add = b => {
    if (!b || ordered.some(x => x.name === b.name)) return;
    add(all.get(b.parent));
    ordered.push({...b, p: new Vector3(), q: new Quaternion(), s: new Vector3(1, 1, 1), m: new Matrix4(), world: new Matrix4()});
  };
  for (const n of rig.needed) add(all.get(n));
  rig.ordered = ordered;
  rig.map = new Map(ordered.map((b, i) => [b.name, i]));
  for (const b of ordered) b.pi = rig.map.get(b.parent) ?? -1;
}
const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(root + '/animations/' + clip.asset)));

const res = analyze(raw, rig, {preview: true});
if (!res.preview) throw Error('no-preview');
const {names, parents, frames} = res.preview;
const duration = res.duration;
const idx = Math.max(0, Math.min(frames.length - 1, Math.round((Number(tArg) / (duration || 1)) * (frames.length - 1))));
const time = (idx / Math.max(1, frames.length - 1)) * duration;

// ---- та же FK, что внутри analyze (их алгоритм), но с сохранением мировых поворотов
const dec = decoder(raw, rig.needed);
const grouped = new Map();
for (const b of dec.bindings) {
  if (!grouped.has(b.bone)) grouped.set(b.bone, []);
  grouped.get(b.bone).push(b);
}
for (const b of rig.ordered) {
  b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1, 1, 1]);
  for (const tr of grouped.get(b.name) || []) {
    const x = dec.sample(tr, time);
    if (!x.every(Number.isFinite)) continue;
    if (tr.attribute === 1) b.p.fromArray(x);
    if (tr.attribute === 2) {
      const len = Math.hypot(...x);
      if (len < 0.5 || len > 1.5) continue;
      b.q.fromArray(x).normalize();
    }
    if (tr.attribute === 3) b.s.fromArray(x);
  }
  b.m.compose(b.p, b.q, b.s);
  b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
}

// ---- сверка с их результатом: без неё своим поворотам верить нельзя
const mine = names.map(n => {
  const b = rig.ordered[rig.map.get(n)];
  return [b.world.elements[12], b.world.elements[13], b.world.elements[14]];
});
const spread = (arr, k) => Math.max(...arr.map(p => p[k])) - Math.min(...arr.map(p => p[k]));
const hMine = Math.max(...[0, 1, 2].map(k => spread(mine, k)));
const theirs = names.map((_, i) => frames[idx][i]);
const hTheirs = Math.max(...[0, 1, 2].map(k => spread(theirs, k)));
let maxDev = 0;
for (let i = 0; i < mine.length; i++) {
  for (let k = 0; k < 3; k++) maxDev = Math.max(maxDev, Math.abs(mine[i][k] / hMine - theirs[i][k] / hTheirs));
}
console.log('FK_SELFCHECK_MISMATCH', maxDev.toFixed(9));
if (!(maxDev < 1e-3)) {
  console.log('FK_SELFCHECK_FAILED');
  process.exit(1);
}

// ---- мировые повороты ядра и оснований пальцев
const extra = FINGER_BASES.filter(n => rig.map.has(n));
const want = [...names, ...extra];
const worldQ = {};
for (const n of want) {
  const e = rig.ordered[rig.map.get(n)].world.elements;
  const m00 = e[0], m01 = e[4], m02 = e[8], m10 = e[1], m11 = e[5], m12 = e[9], m20 = e[2], m21 = e[6], m22 = e[10];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4;
  }
  const len = Math.hypot(x, y, z, w);
  worldQ[n] = [x / len, y / len, z / len, w / len];
}

// ---- локальные повороты позы: нужны для переноса «как повёрнута кость», а не только куда смотрит
const localQ = {};
for (const n of want) {
  const b = rig.ordered[rig.map.get(n)];
  localQ[n] = [b.q.x, b.q.y, b.q.z, b.q.w];
}

// ---- положения суставов в позе покоя: по ним считается МАСШТАБ
// Масштаб нельзя брать из кадра: в согнутой позе расстояние таз->стопа короче, и множитель
// уезжает (сидя выходило 4.2 вместо 1.2). Rest — константа источника.
for (const b of rig.ordered) { b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1,1,1]); b.m.compose(b.p, b.q, b.s); }
for (const b of rig.ordered) b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
const restFrame = names.map(n => {
  const e = rig.ordered[rig.map.get(n)].world.elements;
  return [e[12] / hMine, e[13] / hMine, e[14] / hMine];
});
const iHips = names.indexOf('cf_j_hips'), iFoot = names.indexOf('cf_j_foot_L');
const restLeg = Math.hypot(
  restFrame[iHips][0] - restFrame[iFoot][0],
  restFrame[iHips][1] - restFrame[iFoot][1],
  restFrame[iHips][2] - restFrame[iFoot][2]);

// ---- мировые повороты в позе покоя: без них нельзя пересчитать скрутку
for (const b of rig.ordered) { b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1,1,1]); b.m.compose(b.p, b.q, b.s); }
for (const b of rig.ordered) b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
const restWorldQ = {};
for (const n of want) {
  const e = rig.ordered[rig.map.get(n)].world.elements;
  const m00 = e[0], m01 = e[4], m02 = e[8], m10 = e[1], m11 = e[5], m12 = e[9], m20 = e[2], m21 = e[6], m22 = e[10];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) {
    const s2 = Math.sqrt(tr + 1) * 2; w = s2 / 4; x = (m21 - m12) / s2; y = (m02 - m20) / s2; z = (m10 - m01) / s2;
  } else if (m00 > m11 && m00 > m22) {
    const s2 = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s2; x = s2 / 4; y = (m01 + m10) / s2; z = (m02 + m20) / s2;
  } else if (m11 > m22) {
    const s2 = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s2; x = (m01 + m10) / s2; y = s2 / 4; z = (m12 + m21) / s2;
  } else {
    const s2 = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s2; x = (m02 + m20) / s2; y = (m12 + m21) / s2; z = s2 / 4;
  }
  const len = Math.hypot(x, y, z, w);
  restWorldQ[n] = [x / len, y / len, z / len, w / len];
}

// положения оснований пальцев — по ним строится плоскость ладони и в источнике, и в цели
// ВАЖНО: положения ядра пишутся нормированными на рост (hMine), а extraPos раньше писался
// в сырых единицах. Из-за этого направление кисти считалось между двумя разными масштабами
// и получалось мусорным — отсюда «вывернутые кисти» во всех прогонах.
const extraPos = {};
for (const n of extra) {
  const e = rig.ordered[rig.map.get(n)].world.elements;
  extraPos[n] = [e[12] / hMine, e[13] / hMine, e[14] / hMine];
}
fs.writeFileSync(outPath, JSON.stringify({
  clip: clipId, name: clip.name, time: Number(time.toFixed(3)), height: hMine,
  names, parents, frame: frames[idx], worldQ, restWorldQ, localQ, extraPos, restFrame, restLeg, fkCheck: maxDev,
}));
console.log(JSON.stringify({clip: clip.name, joints: names.length, worldQ: Object.keys(worldQ).length, fkCheck: maxDev}));
console.log('FRAME_OK');
