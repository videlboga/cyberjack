// Полная сверка кэша признаков с расчётом: не выборка, а все строки.
// Если хоть одна величина расходится, кэш недействителен и его нельзя использовать.
import fs from 'node:fs';
import {descriptorFeatures} from '../review/command-pose.mjs';

const base = process.cwd();
const rows = fs.readFileSync(base + '/data/context-index.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const file = fs.readdirSync(base + '/data').find(f => /^context-features-.*\.bin$/.test(f));
if (!file) throw Error('кэша нет — сверять нечего');
const buf = fs.readFileSync(base + '/data/' + file);
const len = buf.readUInt32LE(4);
const head = JSON.parse(buf.toString('utf8', 8, 8 + len));
const off = 8 + len;
const K = head.keys.length;
const view = new Float64Array(buf.buffer, buf.byteOffset + off, rows.length * K);
let maxDiff = 0, bad = 0, checked = 0;
for (let i = 0; i < rows.length; i++) {
  const f = descriptorFeatures(rows[i].descriptor);
  for (let k = 0; k < K; k++) {
    const a = view[i * K + k], b = f[head.keys[k]];
    const d = Number.isFinite(b) ? Math.abs(a - b) : (Number.isFinite(a) ? Infinity : 0);
    if (d > maxDiff) maxDiff = d;
    if (d !== 0) bad++;
    checked++;
  }
}
console.log(JSON.stringify({file, rows: rows.length, keys: K, checked, mismatched: bad, maxDiff}));
console.log(bad === 0 ? 'FEATURES_IDENTICAL' : 'FEATURES_DIFFER');
