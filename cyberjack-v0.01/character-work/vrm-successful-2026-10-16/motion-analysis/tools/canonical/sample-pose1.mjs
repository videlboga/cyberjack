// Пакетная выборка поз в формат POSE1.
//
// Один процесс на всю выборку: каталог и риги читаются один раз, дальше только клипы.
// Для каждого клипа берётся один кадр (по умолчанию середина), считается FK, направления
// переводятся в анатомическую рамку REST-скелета — той же формулой, что в frame-to-pose.py.
//
//   node tools/canonical/sample-pose1.mjs 60 out.jsonl [clipId ...]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {analyze, buildRig, decoder} from '../geometry.mjs';
import {Vector3, Quaternion, Matrix4} from 'three';

const N = Number(process.argv[2] || 60);
const outPath = process.argv[3] || '/tmp/pose1-sample.jsonl';
const only = process.argv.slice(4);

const root = path.resolve(import.meta.dirname, '../../..');
const catalog = JSON.parse(fs.readFileSync(root + '/animations/catalog.json', 'utf8')).clips;
const rigs = JSON.parse(fs.readFileSync(root + '/animations/source_rigs.json', 'utf8')).rigs;

const SLOTS = {
  hips: ['cf_j_hips', 'cf_j_spine01'],
  spine: ['cf_j_spine01', 'cf_j_spine02'],
  chest: ['cf_j_spine02', 'cf_j_spine03'],
  upperChest: ['cf_j_spine03', 'cf_j_neck'],
  neck: ['cf_j_neck', 'cf_j_head'],
  head: ['cf_j_neck', 'cf_j_head'],
  leftUpperArm: ['cf_j_arm00_L', 'cf_j_forearm01_L'],
  leftLowerArm: ['cf_j_forearm01_L', 'cf_j_hand_L'],
  leftHand: ['cf_j_hand_L', 'cf_j_index01_L'],
  rightUpperArm: ['cf_j_arm00_R', 'cf_j_forearm01_R'],
  rightLowerArm: ['cf_j_forearm01_R', 'cf_j_hand_R'],
  rightHand: ['cf_j_hand_R', 'cf_j_index01_R'],
  leftUpperLeg: ['cf_j_thigh00_L', 'cf_j_leg01_L'],
  leftLowerLeg: ['cf_j_leg01_L', 'cf_j_foot_L'],
  leftFoot: ['cf_j_foot_L', 'cf_j_toes_L'],
  leftToes: ['cf_j_foot_L', 'cf_j_toes_L'],
  rightUpperLeg: ['cf_j_thigh00_R', 'cf_j_leg01_R'],
  rightLowerLeg: ['cf_j_leg01_R', 'cf_j_foot_R'],
  rightFoot: ['cf_j_foot_R', 'cf_j_toes_R'],
  rightToes: ['cf_j_foot_R', 'cf_j_toes_R'],
};

const ids = only.length ? only : pickIds(catalog, N);
const out = [];
for (const id of ids) {
  try {
    const r = poseFor(id);
    if (r) out.push(r);
  } catch (e) {
    console.log('SKIP', id, String(e.message).slice(0, 60));
  }
}
fs.writeFileSync(outPath, out.map(o => JSON.stringify(o)).join('\n') + '\n');
console.log('SAMPLE_OK', out.length, 'из', ids.length, '->', outPath);

function pickIds(cat, n) {
  const step = Math.max(1, Math.floor(cat.length / n));
  const res = [];
  for (let i = 0; i < cat.length && res.length < n; i += step) res.push(cat[i].id);
  return res;
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(v) { const n = Math.hypot(...v) || 1; return v.map(c => c / n); }
function proj(v, ax) { const k = dot(v, ax); return v.map((c, i) => c - ax[i] * k); }

function poseFor(clipId) {
  const clip = catalog.find(c => c.id === clipId);
  if (!clip) throw Error('unknown-clip');
  const rigBones = rigs.find(r => r.name === (clip.rig === 'male' ? 'p_cm_body_00' : 'p_cf_body_bone')).bones;
  const rig = buildRig(rigBones);
  const all = new Map(rigBones.map(b => [b.name, b]));
  // основания пальцев: без них нечем задать направление кисти
  const FINGERS = ['index', 'middle', 'ring', 'little', 'thumb'];
  const FB = [];
  for (const cap of ['L', 'R']) for (const f of FINGERS) for (const k of ['01', '02', '03', '04']) {
    const n = `cf_j_${f}${k}_${cap}`;
    if (rigBones.some(b => b.name === n)) FB.push(n);
  }
  for (const n of FB) {
    let b = all.get(n);
    while (b && !rig.needed.has(b.name)) { rig.needed.add(b.name); b = all.get(b.parent); }
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

  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(root + '/animations/' + clip.asset)));
  const res = analyze(raw, rig, {preview: true});
  if (!res.preview) throw Error('no-preview');
  const {names, frames} = res.preview;
  const idx = Math.max(0, Math.min(frames.length - 1, Math.floor(frames.length / 2)));
  const time = res.duration * (idx / Math.max(1, frames.length - 1));

  const dec = decoder(raw, rig.needed);
  const grouped = new Map();
  for (const b of dec.bindings) {
    if (!grouped.has(b.bone)) grouped.set(b.bone, []);
    grouped.get(b.bone).push(b);
  }
  const fk = () => {
    for (const b of rig.ordered) {
      b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1, 1, 1]);
      for (const tr of grouped.get(b.name) || []) {
        const x = dec.sample(tr, time);
        if (!x.every(Number.isFinite)) continue;
        if (tr.attribute === 1) b.p.fromArray(x);
        if (tr.attribute === 2) { const len = Math.hypot(...x); if (len < 0.5 || len > 1.5) continue; b.q.fromArray(x).normalize(); }
        if (tr.attribute === 3) b.s.fromArray(x);
      }
      b.m.compose(b.p, b.q, b.s);
      b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
    }
  };
  const posOf = () => {
    const m = {};
    for (const b of rig.ordered) {
      const e = b.world.elements;
      m[b.name] = [e[12], e[13], e[14]];
    }
    return m;
  };

  fk();
  const pos = posOf();

  // REST: та же FK, но без каналов — только rest-значения костей
  for (const b of rig.ordered) { b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1, 1, 1]); b.m.compose(b.p, b.q, b.s); }
  for (const b of rig.ordered) b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
  const rest = posOf();
  // боковые оси в REST: нужны, чтобы приложение могло согласовать знак оси с собственной
  // rest-осью цели (у Koikatsu и у нашей модели X кости смотрят в разные стороны)
  const restX = {};
  for (const b of rig.ordered) {
    const e = b.world.elements;
    restX[b.name] = norm([e[0], e[1], e[2]]);
  }

  // анатомическая рамка по REST
  const a = norm(sub(rest['cf_j_thigh00_L'], rest['cf_j_thigh00_R']));
  const fr = norm(proj(sub(rest['cf_j_toes_L'], rest['cf_j_foot_L']), a));
  let u = norm(proj(sub(rest['cf_j_head'], rest['cf_j_hips']), a));
  u = norm(proj(u, fr));

  // Ориентация тела в пространстве — двумя направлениями: вверх (шея - позвоночник) и
  // в сторону (плечо L - плечо R). Никаких кватернионов костей: у источника и цели разные
  // rest-ориентации и разная левосторонность, направления такое переносят, кватернионы — нет.
  const up_c = norm(sub(pos['cf_j_neck'], pos['cf_j_spine02']));
  let lat_c = norm(sub(pos['cf_j_arm00_L'], pos['cf_j_arm00_R']));
  lat_c = norm(proj(lat_c, up_c));
  // вперёд = влево × вверх (правая тройка). Обратный порядок даёт левую тройку,
  // и тогда модель систематически встаёт спиной к камере.
  let fwd_c = cross(lat_c, up_c);
  fwd_c = norm(fwd_c);
  const toChar = v => [dot(v, a), dot(v, fr), dot(v, u)].map(c => Number(c.toFixed(4)));
  const rootLat = toChar(lat_c);
  const rootUp = toChar(up_c);

  const qOf = (n) => {
    const bb = rig.ordered[rig.map.get(n)];
    if (!bb) return null;
    const e = bb.world.elements;
    const m00=e[0],m01=e[4],m02=e[8],m10=e[1],m11=e[5],m12=e[9],m20=e[2],m21=e[6],m22=e[10];
    const tr=m00+m11+m22; let x,y,z,w;
    if (tr>0){const q=Math.sqrt(tr+1)*2; w=q/4; x=(m21-m12)/q; y=(m02-m20)/q; z=(m10-m01)/q;}
    else if (m00>m11&&m00>m22){const q=Math.sqrt(1+m00-m11-m22)*2; w=(m21-m12)/q; x=q/4; y=(m01+m10)/q; z=(m02+m20)/q;}
    else if (m11>m22){const q=Math.sqrt(1+m11-m00-m22)*2; w=(m02-m20)/q; x=(m01+m10)/q; y=q/4; z=(m12+m21)/q;}
    else {const q=Math.sqrt(1+m22-m00-m11)*2; w=(m10-m01)/q; x=(m02+m20)/q; y=(m12+m21)/q; z=q/4;}
    const L=Math.hypot(x,y,z,w);
    return [x/L,y/L,z/L,w/L].map(c=>Number(c.toFixed(5)));
  };
  // rest-повороты: та же FK без каналов
  const restQ = {};
  {
    const save = rig.ordered.map(b => [b.p.clone(), b.q.clone(), b.s.clone()]);
    for (const b of rig.ordered) { b.p.fromArray(b.position); b.q.fromArray(b.rotation); b.s.fromArray(b.scale || [1,1,1]); b.m.compose(b.p,b.q,b.s); }
    for (const b of rig.ordered) b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
    for (const b of rig.ordered) restQ[b.name] = qOf(b.name);
    rig.ordered.forEach((b,i) => { b.p.copy(save[i][0]); b.q.copy(save[i][1]); b.s.copy(save[i][2]); b.m.compose(b.p,b.q,b.s); });
    for (const b of rig.ordered) b.world.copy(b.pi < 0 ? b.m : rig.ordered[b.pi].world.clone().multiply(b.m));
  }

  const slots = {};
  for (const [slot, [h, tip]] of Object.entries(SLOTS)) {
    if (!pos[h] || !pos[tip]) continue;
    let d = sub(pos[tip], pos[h]);
    if (Math.hypot(...d) < 1e-6) d = sub(rest[tip], rest[h]);
    const dn = norm(d);
    // боковая ось кости из FK — это и есть скрутка. Без неё таз и грудная клетка крутятся вокруг
    // своей оси как попало: отсюда «вывернутые плечи и бёдра».
    const bb = rig.ordered[rig.map.get(h)];
    const be = bb ? bb.world.elements : null;
    const dch = [dot(dn, lat_c), dot(dn, fwd_c), dot(dn, up_c)].map(c => Number(c.toFixed(4)));
    let xch = null;
    if (be) {
      let xw = norm([be[0], be[1], be[2]]);
      xw = norm(proj(xw, dn));
      if (Math.hypot(...xw) > 0.5) xch = [dot(xw, lat_c), dot(xw, fwd_c), dot(xw, up_c)].map(c => Number(c.toFixed(4)));
    }
    let xrest = null;
    if (be && restX[h]) {
      const xr = norm(proj(restX[h], norm(sub(rest[tip], rest[h]))));
      xrest = [dot(xr, lat_c), dot(xr, fwd_c), dot(xr, up_c)].map(c => Number(c.toFixed(4)));
    }
    // направление в REST — нужно, чтобы построить rest-рамку кости без кватернионов
    const drest_w = norm(sub(rest[tip], rest[h]));
    const drest = [dot(drest_w, lat_c), dot(drest_w, fwd_c), dot(drest_w, up_c)].map(c => Number(c.toFixed(4)));
    slots[slot] = {d: dch, x: xch, drest, xrest};
  }
  return {format: 'POSE1', subject: {clip: clipId, name: clip.name, t: Number(time.toFixed(3)), source: 'koikatsu-cf_j'},
          frame: 'body: d in body frame (lat,fwd,up); rootLat/rootUp = body axes in character frame',
          rootLat, rootUp, srcBasis: {a: a.map(c=>Number(c.toFixed(5))), f: fr.map(c=>Number(c.toFixed(5))), u: u.map(c=>Number(c.toFixed(5)))},
          slots};
}
