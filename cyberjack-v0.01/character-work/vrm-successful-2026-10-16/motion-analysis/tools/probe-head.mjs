import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {buildRig, analyze} from './geometry.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = JSON.parse(fs.readFileSync(root + '/animations/catalog.json')).clips;
const rigs = JSON.parse(fs.readFileSync(root + '/animations/source_rigs.json')).rigs;
const by = {female: buildRig(rigs.find((r) => r.name === 'p_cf_body_bone').bones), male: buildRig(rigs.find((r) => r.name === 'p_cm_body_00').bones)};
by.shared = by.female;

const pick = process.argv.slice(2);
const ids = pick.length ? pick : catalog.filter((c) => c.rig === 'female' && c.category !== 'map').slice(0, 6).map((c) => c.id);
const rows = [];
for (const id of ids) {
  const c = catalog.find((x) => x.id === id);
  if (!c || !by[c.rig]) { console.log(id, 'skip'); continue; }
  const data = JSON.parse(zlib.gunzipSync(fs.readFileSync(root + '/animations/' + c.asset)));
  const r = analyze(data, by[c.rig], {anatomy: true});
  if (r.status !== 'ok') { console.log(id, c.name, r.status); continue; }
  const m = r.anatomy.metrics;
  const head = r.anatomy.atoms.filter((a) => a.property.startsWith('head.'));
  rows.push({id, name: c.name, yaw: m['head.yaw'], pitch: m['head.pitch'], atoms: head.map((a) => `${a.property}=${a.value} ${a.start}-${a.end}s`) });
  console.log(c.name.padEnd(22), 'yaw', JSON.stringify(m['head.yaw']), 'pitch', JSON.stringify(m['head.pitch']));
  if (head.length) console.log('   atoms:', head.slice(0, 4).map((a) => `${a.property}=${a.value} ${a.start}-${a.end}s`).join('; '));
}
fs.writeFileSync(path.resolve(import.meta.dirname, '../data/head-yaw-probe.json'), JSON.stringify(rows, null, 2));
