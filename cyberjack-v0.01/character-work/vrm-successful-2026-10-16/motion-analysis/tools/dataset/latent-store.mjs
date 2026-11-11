// Читатель латента позы (PZL1) для рантайма: один бинарник вместо 281 МБ JSON.
//
//   import {openLatentStore} from './tools/dataset/latent-store.mjs';
//   const store = openLatentStore('data/dataset/poses-reps.pzl');
//   const hits = store.query(poseQuats, 100);      // кандидаты, отсортированы по метрике
//   store.explain(hits[0]);                        // {clip, name, frame, time}
//
// Проверка и замеры:
//   node tools/dataset/latent-store.mjs --store data/dataset/poses-reps.pzl --bin data/dataset/poses-reps.bin --check 200
import fs from 'node:fs';
import path from 'node:path';

export function openLatentStore(file) {
  const t0 = performance.now();
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'PZL1') throw Error('not-a-pose-latent-store');
  const headerLen = buf.readUInt32LE(4);
  const header = JSON.parse(buf.toString('utf8', 8, 8 + headerLen));
  const K = header.k, B4 = header.bonesCount * 4, N = header.poses;
  let off = 8 + headerLen;
  const f32 = (bytes) => { const a = new Float32Array(bytes / 4); for (let i = 0; i < a.length; i++) a[i] = buf.readFloatLE(off + i * 4); off += bytes; return a; };
  const mean = f32(B4 * 4), comp = f32(K * B4 * 4), scales = f32(K * 4);
  // Таблица «поза → клип/кадр». В полной библиотеке клипов 117 375, поэтому номер клипа u32.
  const wideTable = header.table === 'u32+u16';
  const table = new Uint32Array(N * 2);
  if (wideTable) {
    for (let i = 0; i < N; i++) { table[i * 2] = buf.readUInt32LE(off + i * 4); }
    off += N * 4;
    for (let i = 0; i < N; i++) { table[i * 2 + 1] = buf.readUInt16LE(off + i * 2); }
    off += N * 2;
  } else {
    for (let i = 0; i < N * 2; i++) { table[i] = buf.readUInt16LE(off); off += 2; }
  }
  const wide = header.dtype === 'int16';
  const codes = wide ? new Int16Array(N * K) : new Int8Array(N * K);
  const bytesPer = wide ? 2 : 1;
  // Прямое представление по памяти, если повезло с выравниванием (x86 — little-endian),
  // иначе поэлементное чтение. Разница на 40 тыс. поз — почти порядок по времени загрузки.
  if ((buf.byteOffset + off) % bytesPer === 0) {
    const view = Buffer.from(buf.buffer, buf.byteOffset + off, N * K * bytesPer);
    codes.set(wide ? new Int16Array(view.buffer, view.byteOffset, N * K) : new Int8Array(view.buffer, view.byteOffset, N * K));
  } else {
    for (let i = 0; i < N * K; i++) { codes[i] = wide ? buf.readInt16LE(off + i * 2) : buf.readInt8(off + i); }
  }
  const mul = header.mul || (wide ? 256 : 1);
  // Оси квантованы своим масштабом, поэтому расстояние в кодах надо взвешивать s².
  // Без этого «евклидово по кодам» — не та метрика, и ответы расходятся с точными.
  const scale2 = new Float64Array(K);
  for (let k = 0; k < K; k++) scale2[k] = scales[k] * scales[k];
  const sq = new Float64Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < K; k++) { const v = codes[i * K + k]; s += scale2[k] * v * v; } sq[i] = s; }
  const weights = Float32Array.from(header.weights || new Array(K).fill(1));
  const clipMeta = header.clipsMeta || {};

  function encode(pose) {
    // pose: Float32Array длины B4 (локальные кватернионы в порядке header.bones)
    const q = new Float64Array(K);
    for (let k = 0; k < K; k++) {
      let s = 0;
      const base = k * B4;
      for (let j = 0; j < B4; j++) s += (pose[j] - mean[j]) * comp[base + j];
      q[k] = (s * Math.sqrt(weights[k])) / scales[k];
    }
    return q;
  }

  // Отбор top-n без полной сортировки: куча на n, O(N·log n) вместо O(N log N).
  const dist = new Float64Array(N);
  function query(pose, n = 50) {
    const q = encode(pose);
    const qc = new Float64Array(K);
    let qs = 0;
    for (let k = 0; k < K; k++) {
      qc[k] = Math.max(-32767, Math.min(32767, Math.round(q[k] * mul)));
      qs += scale2[k] * qc[k] * qc[k];
    }
    for (let i = 0; i < N; i++) {
      const base = i * K;
      let dot = 0;
      for (let k = 0; k < K; k++) dot += scale2[k] * codes[base + k] * qc[k];
      dist[i] = qs + sq[i] - 2 * dot;
    }
    // max-куча размера n: корень — худший из выбранных
    const heap = [];
    const push = (i) => {
      heap.push(i);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (dist[heap[p]] >= dist[heap[c]]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
      }
    };
    const popRoot = () => {
      const last = heap.pop();
      if (!heap.length) return;
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1, r = l + 1;
        let m = p;
        if (l < heap.length && dist[heap[l]] > dist[heap[m]]) m = l;
        if (r < heap.length && dist[heap[r]] > dist[heap[m]]) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]]; p = m;
      }
    };
    const want = Math.min(n, N);
    for (let i = 0; i < N; i++) {
      if (heap.length < want) push(i);
      else if (dist[i] < dist[heap[0]]) { popRoot(); push(i); }
    }
    return heap.sort((a, b) => dist[a] - dist[b])
      .map(i => ({index: i, distance: Math.sqrt(Math.max(0, dist[i]))}));
  }

  function explain(hit) {
    const ci = table[hit.index * 2], frame = table[hit.index * 2 + 1];
    const id = header.clips[ci];
    const m = clipMeta[id] || {};
    const dur = m.duration || 0;
    const frames = header.clipFrames[ci] || 1;
    return {clip: id, name: m.name, frame, time: frames > 1 ? Number((dur * frame / (frames - 1)).toFixed(3)) : 0, distance: hit.distance};
  }

  return {
    header, K, poses: N, bytes: buf.byteLength, loadMs: Number((performance.now() - t0).toFixed(1)),
    mean, comp, scales, weights, codes, sq, table, encode, query, explain,
  };
}

// ---------------------------------------------------------------- проверка и замеры
if (process.argv[1] && process.argv[1].endsWith('latent-store.mjs')) {
  const arg = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
    if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1]]);
    return a;
  }, []));
  const store = openLatentStore(arg.store || 'data/dataset/poses-reps.pzl');
  console.log(`PZL ${arg.store}: поз ${store.poses}, k ${store.K}, ${(store.bytes / 1e6).toFixed(2)} МБ, ` +
    `загрузка ${store.loadMs} мс, ${store.header.dtype}`);
  if (arg.bin) {
    const head = JSON.parse(fs.readFileSync(String(arg.bin).replace(/\.bin$/, '.json'), 'utf8'));
    const data = fs.readFileSync(arg.bin);
    const B = head.bones.length, N = head.poses;
    const poses = new Float32Array(data.buffer, data.byteOffset, N * B * 4);
    const coreIdx = head.bones.map((b, i) => (store.header.core.includes(b) ? i : -1)).filter(i => i >= 0);
    const NQ = Number(arg.check || 200);
    const rnd = (n) => Math.floor(Math.random() * n);
    let sameSet = 0, recallAll = 0, tStore = 0, tExact = 0;
    for (let t = 0; t < NQ; t++) {
      const q = rnd(N);
      const pose = poses.subarray(q * B * 4, (q + 1) * B * 4);
      // точный ответ: средний угол по суставам тела против всех поз
      const t0 = performance.now();
      const truth = new Set();
      const d = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        let s = 0;
        for (const j of coreIdx) {
          const a = i * B * 4 + j * 4, b = q * B * 4 + j * 4;
          const dot = Math.abs(poses[a] * poses[b] + poses[a + 1] * poses[b + 1] + poses[a + 2] * poses[b + 2] + poses[a + 3] * poses[b + 3]);
          s += 2 * Math.acos(Math.min(1, dot));
        }
        d[i] = s / coreIdx.length;
      }
      Array.from({length: N}, (_, i) => i).sort((a, b) => d[a] - d[b]).slice(1, 11).forEach(i => truth.add(i));
      tExact += performance.now() - t0;
      const t1 = performance.now();
      const hits = store.query(pose, 101).map(h => h.index).filter(i => i !== q);   // сам запрос в ответ не входит
      tStore += performance.now() - t1;
      // доводка кандидатов точной метрикой и проверка, что топ-10 совпал
      // Две разные вещи, которые нельзя смешивать:
      //   recallAll — все 10 настоящих соседей попали в кандидаты (это и есть замена перебора);
      //   sameSet   — после точной доводки набор из 10 совпал буквально (ломается на ничьих
      //               и почти одинаковых позах, которых в библиотеке много).
      // Поштучный recall: строгий «все 10 в пуле» ломается на ничьих — в библиотеке
      // много почти одинаковых поз, и сравнение с Python идёт только по поштучному.
      recallAll += Array.from(truth).filter(i => hits.includes(i)).length / truth.size;
      const refined = hits.slice().sort((a, b) => d[a] - d[b]).slice(0, 10);
      if (new Set(refined).size === 10 && refined.every(i => truth.has(i))) sameSet++;
    }
    console.log(`проверка на ${NQ} запросах (пул 100): настоящих соседей найдено ${(100 * recallAll / NQ).toFixed(1)}%; ` +
      `набор после доводки совпал буквально в ${(100 * sameSet / NQ).toFixed(1)}%`);
    console.log(`время: отбор ${(tStore / NQ).toFixed(1)} мс, полный перебор ${(tExact / NQ).toFixed(1)} мс ` +
      `(ускорение ${(tExact / tStore).toFixed(1)}×)`);
    console.log(`на 161 077 кадров: отбор ≈ ${(tStore / NQ * 161077 / N).toFixed(0)} мс`);
  }
}
