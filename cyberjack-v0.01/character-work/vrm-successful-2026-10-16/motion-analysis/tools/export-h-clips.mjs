// Экспорт нативных H-клипов из каталога в формат внешних клипов (tracks: bone + rotations).
//
// Зачем: разметка VLM работает по контактным листам, а рендерер принимает обычные tracks.
// Нативные клипы лежат как дампы Unity (`koikatsu-native-v1`), их надо раскодировать.
//
// Запуск:
//   node tools/export-h-clips.mjs --out data/h-pilot.json --limit 12 \
//        [--need Idle --need Insert --need SLoop]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decoder } from './geometry.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const argsAll = (k) => {
  const out = [];
  process.argv.forEach((v, i) => { if (v === k) out.push(process.argv[i + 1]); });
  return out;
};

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'animations/catalog.json'), 'utf8'));
const needTokens = argsAll('--need');
const limit = Number(arg('--limit', 12));
const outPath = arg('--out', path.join(ROOT, 'motion-analysis/data/h-pilot.json'));

const hClips = catalog.clips.filter(c => c.category === 'h' && c.playable && c.rig === 'female' && c.asset);
const idsFile = arg('--ids', null);
const onlyIds = idsFile ? new Set(JSON.parse(fs.readFileSync(path.resolve(ROOT, idsFile), 'utf8'))) : null;

// равномерно по сценам: не больше 2 клипов из одного бандла
const picked = [];
const perSource = new Map();
const seenName = new Set();
if (onlyIds) {
  for (const c of hClips) if (onlyIds.has(c.id)) picked.push(c);
} else
for (const c of hClips) {
  if (needTokens.length && !needTokens.some(t => c.name.includes(t))) continue;
  if (seenName.has(c.name)) continue;        // одна и та же анимация в разных бандлах — не дублируем
  const n = perSource.get(c.source) || 0;
  if (n >= 2) continue;
  perSource.set(c.source, n + 1);
  seenName.add(c.name);
  picked.push(c);
  if (picked.length >= limit) break;
}

picked.length = Math.min(picked.length, limit);   // ограничение действует для обоих режимов
const clips = [];
for (const c of picked) {
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'animations', c.asset))));
  const meta = raw.meta;
  const duration = Number(meta.duration);
  const fps = Number(meta.sampleRate || meta.fps || 30);
  // декодеру нужен набор костей; берём всё, что есть в клипе
  const needed = new Set(meta.bindings.map(b => b.bone).filter(Boolean));
  const dec = decoder(raw, needed);
  const frames = Math.max(2, Math.round(duration * fps));
  const rotBindings = dec.bindings.filter(b => b.attribute === 2);
  // таз: в Koikatsu высота лежит в позиционном биндинге cf_j_hips. Без неё присед/лежание
  // «висят» на высоте стойки. Опорная высота — максимум по клипу, зажим от выбросов.
  const posBinding = dec.bindings.find(b => b.attribute === 1 && b.bone === 'cf_j_hips');
  let hipsY = null;
  if (posBinding) {
    const ys = [];
    for (let f = 0; f < frames; f++) ys.push(dec.sample(posBinding, f / fps)[1]);
    const ref = Math.max(...ys);
    hipsY = ys.map(y => Math.max(-0.9, Math.min(0.3, y - ref)));
  }
  const tracks = [];
  for (const b of rotBindings) {
    const rotations = [];
    for (let f = 0; f < frames; f++) {
      const t = f / fps;
      const q = dec.sample(b, t);
      rotations.push(q[0], q[1], q[2], q[3]);
    }
    const track = { bone: b.bone, rotations };
    if (b.bone === 'cf_j_hips' && hipsY) {
      track.translations = hipsY.flatMap(y => [0, Number(y.toFixed(5)), 0]);
      track.translationSpace = 'hips-world-offset';
    }
    tracks.push(track);
  }
  clips.push({
    id: c.id,
    name: c.name,
    label: `${c.name} · ${c.source}`,
    fps, duration, frames,
    dataset: 'koikatsu-h',
    source: c.source,
    tracks,
  });
  console.log(`  ${c.name}: ${tracks.length} треков, ${frames} кадров`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  format: 'koikatsu-generic-v1',
  coordinateSpace: 'Unity left-handed; quaternion xyzw',
  notes: 'H-клипы каталога, раскодированы geometry.mjs decoder; только повороты (in-place)',
  clips,
}, null, 1));
console.log(`\nклипов ${clips.length} → ${outPath}`);
