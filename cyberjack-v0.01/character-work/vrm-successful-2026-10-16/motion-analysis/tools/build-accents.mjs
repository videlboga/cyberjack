// Build the accent index for every clip: geometry from annotations, metadata from the H labels when present
// and from the clip title/name otherwise. Both inputs are streamed (the annotation file is over 1 GB).
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { accentFor, isRestPose, PARTS } from './accent.mjs';

const dir = path.resolve(import.meta.dirname, '..');
const data = dir + '/data';

async function* lines(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) if (line) yield line;
}

// Pass 1: metadata from the H layer.
const meta = new Map();
for await (const line of lines(data + '/hentai-labels.jsonl')) {
  const rec = JSON.parse(line);
  meta.set(rec.id, {
    // Scene and acts of THIS clip only: `text` and `hscene.positions` describe the whole bundle, so they
    // would apply every position's keywords to every clip of that bundle.
    sceneLabel: rec.scene?.label,
    sceneName: rec.scene?.name,
    actLabels: (rec.act || []).map((a) => a.label).join(' '),
    acts: (rec.act || []).map((a) => a.id),
    side: rec.side || null,
    clipName: rec.name || null,
  });
}

// Pass 2: geometry + metadata join, one record per clip.
const items = {};
const groups = Object.fromEntries(PARTS.concat('none', 'rest').map((p) => [p, []]));
const byScore = {};
let considered = 0;
let withHentai = 0;
for await (const line of lines(data + '/library-annotations.jsonl')) {
  const rec = JSON.parse(line);
  const m = rec.anatomy?.metrics;
  if (!m) continue;
  const fields = meta.get(rec.id) || { title: rec.title, sceneName: rec.name, clipName: rec.name };
  if (meta.has(rec.id)) withHentai++;
  const accent = accentFor(m, fields);
  // Rest-pose containers are layers, not poses: they get their own bucket so the filters can hide them.
  const rest = isRestPose(m);
  if (rest) groups.rest.push(rec.id);
  items[rec.id] = { part: accent.part, score: accent.score, detail: accent.detail, rest };
  groups[accent.part].push(rec.id);
  considered++;
  const bucket = Math.min(9, Math.floor(accent.score * 10));
  byScore[bucket] = (byScore[bucket] || 0) + 1;
}

fs.writeFileSync(data + '/accents.json', JSON.stringify({ format: 'accent-v1', weights: { geom: 0.6, meta: 0.4 }, items }));
fs.writeFileSync(data + '/accent-groups.json', JSON.stringify({ format: 'accent-groups-v1', groups }));
const manifest = {
  format: 'accent-v1',
  considered,
  withHentaiMetadata: withHentai,
  byAccent: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  scoreHistogram: byScore,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(data + '/accents-manifest.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
