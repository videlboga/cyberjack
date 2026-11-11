// Выгрузка поз из библиотеки клипов в один бинарный массив для обучения/латента.
// Читает те же каналы, что и geometry.mjs, но берёт канонический набор костей
// (все cf_j_* из референсного рига), поэтому вектор позы одинаков для всех клипов:
// отсутствующий канал остаётся в rest, а не подменяется нулём.
//
//   node tools/dataset/export-poses.mjs --reps --frames 24 --out data/dataset/poses-reps.bin
//   node tools/dataset/export-poses.mjs --limit 500 --frames 16 --out data/dataset/poses-500.bin
//
// Выход: <out>.bin (float32, кадр × кость × 4) и <out>.json (шапка: кости, клипы, кадры).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {decoder, buildRig} from '../geometry.mjs';

const here = import.meta.dirname;
const base = path.resolve(here, '../..');
const root = path.resolve(base, '..');
const argv = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));

const FRAMES = Number(argv.frames || 24);
const LIMIT = argv.limit ? Number(argv.limit) : Infinity;
const OUT = argv.out || 'data/dataset/poses.bin';
const RIGS = JSON.parse(fs.readFileSync(path.join(root, 'animations/source_rigs.json'), 'utf8')).rigs;
const CATALOG = JSON.parse(fs.readFileSync(path.join(root, 'animations/catalog.json'), 'utf8')).clips;
const byId = new Map(CATALOG.map(c => [c.id, c]));

// Канонический набор: тело и пальцы, без одежды/волос (cf_o_*, cf_s_*, cf_hair_*).
// Берём все cf_j_* референсного рига, не только цепочку из 21 сустава,
// иначе латент позы выучит лишь остов и потеряет кисти, стопы, живот и палец ноги.
const refRig = name => RIGS.find(r => r.name === name).bones;
const refs = {female: refRig('p_cf_body_bone'), male: refRig('p_cm_body_00')};
const BONES = refs.female.map(b => b.name).filter(n => n.startsWith('cf_j_'));
const boneIndex = new Map(BONES.map((n, i) => [n, i]));
const restQ = Object.fromEntries(refs.female.map(b => [b.name, Array.isArray(b.rotation) ? b.rotation : [0, 0, 0, 1]]));
const neededFor = () => new Set(BONES);

// Кого берём: представители групп (дедуп), либо первые N клипов каталога.
let ids;
if (argv.reps) {
  const clusters = JSON.parse(fs.readFileSync(path.join(base, 'data/clusters.json'), 'utf8'));
  ids = clusters.map(c => c.representative).filter(id => byId.has(id));
} else {
  ids = CATALOG.filter(c => c.rig !== 'object').map(c => c.id);
}
ids = ids.slice(0, LIMIT);
// Разбиение на части: полную библиотеку быстрее считать восемью процессами.
const [SHARD, SHARDS] = String(argv.shard || '0/1').split('/').map(Number);
if (SHARDS > 1) ids = ids.filter((_, i) => i % SHARDS === SHARD);

const framesMeta = [];
const rows = [];
let errors = 0, skipped = 0;

for (const id of ids) {
  const clip = byId.get(id);
  const rigName = clip.rig === 'male' ? 'male' : 'female';
  const needed = neededFor();
  let data;
  try {
    data = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'animations', clip.asset))));
  } catch { errors++; continue; }
  let dec;
  try { dec = decoder(data, needed); } catch { errors++; continue; }
  const grouped = new Map();
  for (const b of dec.bindings) {
    if (!grouped.has(b.bone)) grouped.set(b.bone, []);
    grouped.get(b.bone).push(b);
  }
  const duration = Number(clip.duration);
  if (!Number.isFinite(duration) || duration < 0) { errors++; continue; }
  // Сколько костей реально вращается: клипы с почти пустым телом не годятся как поза.
  const tracked = new Set(dec.bindings.filter(b => b.attribute === 2).map(b => b.bone));
  const bodyTracked = BONES.filter(n => tracked.has(n)).length;
  if (bodyTracked < BONES.length * 0.5) { skipped++; continue; }

  const n = duration <= 1e-6 ? 1 : FRAMES;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (duration * i) / (n - 1);
    const out = new Float32Array(BONES.length * 4);
    // rest по умолчанию: канал, которого нет в клипе, остаётся как в скелете
    for (let j = 0; j < BONES.length; j++) {
      const r = restQ[BONES[j]];
      out[j * 4] = r[0]; out[j * 4 + 1] = r[1];
      out[j * 4 + 2] = r[2]; out[j * 4 + 3] = r[3];
    }
    for (const [bone, list] of grouped) {
      const j = boneIndex.get(bone);
      if (j === undefined) continue;
      for (const tr of list) {
        if (tr.attribute !== 2 || tr.width !== 4) continue;
        const x = dec.sample(tr, t);
        if (!x.every(Number.isFinite)) continue;
        const len = Math.hypot(x[0], x[1], x[2], x[3]);
        if (len < 0.5 || len > 1.5) continue;
        out[j * 4] = x[0] / len; out[j * 4 + 1] = x[1] / len;
        out[j * 4 + 2] = x[2] / len; out[j * 4 + 3] = x[3] / len;
      }
    }
    // Знак кватерниона: сначала приводим к rest (иначе PCA усредняет q и −q,
    // и половина позы гасит другую), затем к предыдущему кадру.
    for (let j = 0; j < BONES.length; j++) {
      const r = restQ[BONES[j]];
      const dotRest = out[j * 4] * r[0] + out[j * 4 + 1] * r[1] + out[j * 4 + 2] * r[2] + out[j * 4 + 3] * r[3];
      if (dotRest < 0) for (let k = 0; k < 4; k++) out[j * 4 + k] *= -1;
    }
    if (i > 0) {
      const prev = rows[rows.length - 1];
      for (let j = 0; j < BONES.length; j++) {
        const dot = out[j * 4] * prev[j * 4] + out[j * 4 + 1] * prev[j * 4 + 1] + out[j * 4 + 2] * prev[j * 4 + 2] + out[j * 4 + 3] * prev[j * 4 + 3];
        if (dot < 0) for (let k = 0; k < 4; k++) out[j * 4 + k] *= -1;
      }
    }
    rows.push(out);
    framesMeta.push({id, name: clip.name, rig: rigName, time: Number(t.toFixed(4)), duration: Number(duration.toFixed(4)), bodyTracked});
  }
  if (rows.length % 2000 < FRAMES) process.stdout.write(`\r${ids.indexOf(id) + 1}/${ids.length} клипов, ${rows.length} поз   `);
}

const dir = path.dirname(path.resolve(base, OUT));
fs.mkdirSync(dir, {recursive: true});
const buf = Buffer.alloc(rows.length * BONES.length * 4 * 4);
let off = 0;
for (const r of rows) { Buffer.from(r.buffer, r.byteOffset, r.byteLength).copy(buf, off); off += r.byteLength; }
fs.writeFileSync(path.resolve(base, OUT), buf);
fs.writeFileSync(path.resolve(base, OUT).replace(/\.bin$/, '.json'), JSON.stringify({
  format: 'pose-dataset-v1', bones: BONES, frames: FRAMES, clips: ids.length,
  poses: rows.length, errors, skipped, data: path.basename(OUT), meta: framesMeta,
}));
console.log(`\nPOSES ${rows.length} из ${ids.length} клипов (ошибок ${errors}, пропущено ${skipped}), костей ${BONES.length}, файл ${path.resolve(base, OUT)}`);
