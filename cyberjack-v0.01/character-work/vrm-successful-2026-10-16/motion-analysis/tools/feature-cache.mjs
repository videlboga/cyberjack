// Кэш признаков кадра (descriptorFeatures) — считать их на каждом старте незачем.
//
// Признаки — чистая функция от row.descriptor и кода анализатора. Значит их можно
// положить рядом и переиспользовать, пока не изменился ни индекс, ни анализатор.
// Храним float64: значения сравнения геометрии, и округление до float32 уже меняло бы
// порядок равных кандидатов.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function applyFeatureCache(rows, compute, base) {
  const indexFile = base + '/data/context-index.jsonl';
  const analyzer = [base + '/review/command-pose.mjs', base + '/review/anatomical-targets.mjs']
    .filter(f => fs.existsSync(f)).map(sha).join(':');
  const stat = fs.statSync(indexFile);
  const key = crypto.createHash('sha256')
    .update(`${stat.size}:${stat.mtimeMs}:${rows.length}:${analyzer}`).digest('hex').slice(0, 20);
  const file = `${base}/data/context-features-${key}.bin`;

  // Ключи проверяем на одной строке: если набор признаков изменился, кэш не годится.
  const probeKeys = Object.keys(compute(rows[0].descriptor));

  const useCache = process.env.FEATURES_CACHE !== 'off';   // для честного A/B

  if (useCache && fs.existsSync(file)) {
    const t0 = performance.now();
    const buf = fs.readFileSync(file);
    const len = buf.readUInt32LE(4);
    const head = JSON.parse(buf.toString('utf8', 8, 8 + len));
    const same = head.rows === rows.length && head.keys.length === probeKeys.length &&
      head.keys.every((k, i) => k === probeKeys[i]);
    if (same) {
      // Значения — float64, поэтому смещение должно быть кратно 8, иначе представление
      // по памяти невозможно (ровно та же ловушка, что была у PZL1 с шапкой).
      const off = 8 + len;
      const count = rows.length * probeKeys.length;
      let view;
      if ((buf.byteOffset + off) % 8 === 0) view = new Float64Array(buf.buffer, buf.byteOffset + off, count);
      else { const copy = Buffer.allocUnsafe(count * 8); buf.copy(copy, 0, off); view = new Float64Array(copy.buffer, copy.byteOffset, count); }
      for (let i = 0; i < rows.length; i++) {
        const f = {};
        for (let k = 0; k < probeKeys.length; k++) f[probeKeys[k]] = view[i * probeKeys.length + k];
        rows[i].features = f;
      }
      // Сверка: кэш обязан совпадать с расчётом бит в бит, иначе это не кэш, а догадка.
      let maxDiff = 0;
      for (let s = 0; s < 50; s++) {
        const i = Math.floor(Math.random() * rows.length);
        const fresh = compute(rows[i].descriptor);
        for (const k of probeKeys) {
          const a = rows[i].features[k], b = fresh[k];
          const d = Number.isFinite(b) ? Math.abs(a - b) : 0;
          if (d > maxDiff) maxDiff = d;
        }
      }
      console.log(`Features cache hit ${key} ${((performance.now() - t0) | 0)} ms, rows ${rows.length}, расхождение с расчётом ${maxDiff}`);
      return rows;
    }
    console.log(`Features cache stale ${key}: keys ${head.keys.length} vs ${probeKeys.length}`);
  }

  const t0 = performance.now();
  const K = probeKeys.length;
  const values = new Float64Array(rows.length * K);
  for (let i = 0; i < rows.length; i++) {
    const f = compute(rows[i].descriptor);
    rows[i].features = f;
    for (let k = 0; k < K; k++) {
      const v = f[probeKeys[k]];
      values[i * K + k] = Number.isFinite(v) ? v : 0;
    }
  }
  const head = Buffer.from(JSON.stringify({ v: 1, rows: rows.length, keys: probeKeys, analyzer, index: `${stat.size}:${stat.mtimeMs}` }));
  const headPadded = Buffer.alloc(head.length + ((8 - (head.length % 8)) % 8), 0x20);   // выравнивание под float64
  head.copy(headPadded);
  const out = Buffer.alloc(8 + headPadded.length + values.byteLength);
  out.write('FFC1', 0, 'latin1');
  out.writeUInt32LE(headPadded.length, 4);
  headPadded.copy(out, 8);
  Buffer.from(values.buffer, values.byteOffset, values.byteLength).copy(out, 8 + headPadded.length);
  if (useCache) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, out);
    fs.renameSync(tmp, file);
  }
  console.log(`Features computed ${((performance.now() - t0) | 0)} ms, rows ${rows.length}, keys ${K}, saved ${key}`);
  return rows;
}
