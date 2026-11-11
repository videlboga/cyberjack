// Runtime access to the hentai label layer (data/hentai-labels.json + .jsonl).
// The compact index is loaded once; a single clip record is read from the JSONL by byte offset.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(import.meta.dirname, '../data');
const file = process.env.HENTAI_LABELS_STORE || dir + '/hentai-labels.json';
let cache = null;
let stamp = 0;
let fd;

export function hentaiManifest() {
  const p = dir + '/hentai-labels-manifest.json';
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : {format: 'hentai-labels-manifest-v1', complete: false};
}

export function hentaiIndex() {
  if (!fs.existsSync(file)) throw Error('Слой описаний ещё не собран');
  const s = fs.statSync(file).mtimeMs;
  if (!cache || s !== stamp) {
    const next = JSON.parse(fs.readFileSync(file));
    if (!next.complete) throw Error('Слой описаний ещё собирается');
    cache = next;
    stamp = s;
    if (fd !== undefined) fs.closeSync(fd);
    fd = fs.openSync(dir + '/' + (next.rowsFile || 'hentai-labels.jsonl'), 'r');
  }
  return cache;
}

const vocab = (group, id) => hentaiIndex().vocab?.[group]?.[id] || id || null;
const reviewFile = () => process.env.HENTAI_REVIEW_STORE || dir + '/hentai-reviews.json';
export function hentaiReviews() {
  return fs.existsSync(reviewFile()) ? JSON.parse(fs.readFileSync(reviewFile())) : {};
}
export function saveHentaiReview(input) {
  const index = hentaiIndex();
  const row = index.labels[input.id];
  if (!row) throw Error('У клипа нет слоя описаний');
  const bases = Object.keys(index.vocab.base);
  if (input.base && !bases.includes(input.base)) throw Error('Неизвестное положение тела');
  const acts = Array.isArray(input.acts) ? input.acts : [];
  const known = Object.keys(index.vocab.act);
  if (acts.some((a) => !known.includes(a))) throw Error('Неизвестное действие');
  const entry = {id: input.id, labelFingerprint: index.fingerprint, base: input.base || null, acts, phase: input.phase || null, note: String(input.note || '').slice(0, 2000), origin: 'human-review', updatedAt: new Date().toISOString()};
  const all = hentaiReviews();
  all[entry.id] = entry;
  fs.writeFileSync(reviewFile() + '.tmp', JSON.stringify(all, null, 2));
  fs.renameSync(reviewFile() + '.tmp', reviewFile());
  return entry;
}

export function hentaiSummary(id) {
  const index = hentaiIndex();
  const row = index.labels[id];
  if (!row) return null;
  const [sceneKey, base, acts, arrangements, phase, participants, agreement, side, posture, group, , , hsceneBundle, hsceneModes] = row;
  const review = hentaiReviews()[id];
  const valid = review && review.labelFingerprint === index.fingerprint;
  const effBase = valid && review.base ? review.base : base;
  const effActs = valid && review.acts?.length ? review.acts : acts;
  const effPhase = valid && review.phase ? review.phase : phase;
  const sceneStat = sceneKey ? index.scenes?.find((s) => s.key === sceneKey) : null;
  return {
    version: 'hentai-labels-v1',
    sceneKey,
    scene: sceneStat?.label || null,
    base: effBase,
    baseLabel: vocab('base', effBase),
    acts: effActs,
    actLabels: effActs.map((a) => vocab('act', a)),
    arrangements,
    arrangementLabels: arrangements.map((a) => vocab('arrangement', a)),
    phase: effPhase,
    phaseLabel: vocab('phase', effPhase),
    participants,
    agreement,
    side,
    measuredPosture: posture,
    group,
    groupLabel: group ? index.groups?.find((g) => g.key === group)?.label || group : null,
    hsceneBundle: hsceneBundle || null,
    hsceneModes: hsceneModes ? hsceneModes.split(',').map(Number) : null,
    sceneStat: sceneStat ? {clips: sceneStat.clips, loops: sceneStat.loops, posture: sceneStat.posture, agreement: sceneStat.agreement} : null,
    reviewed: Boolean(valid && (review.base || review.acts?.length || review.phase)),
    review: valid ? {base: review.base, acts: review.acts, phase: review.phase, note: review.note, updatedAt: review.updatedAt} : null,
  };
}

export function hentaiDetail(id) {
  const index = hentaiIndex();
  const row = index.labels[id];
  if (!row) return null;
  const offset = row[10];
  const length = row[11];
  if (!Number.isFinite(offset) || !Number.isFinite(length)) throw Error('Запись описания без смещения');
  const buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, offset);
  const record = JSON.parse(buffer.toString('utf8'));
  if (record.id !== id) throw Error('Слой описаний обновляется: повторите запрос');
  return {...record, sceneStat: hentaiSummary(id)?.sceneStat || null};
}

export function hentaiVocabulary() {
  const index = hentaiIndex();
  return {vocab: index.vocab, counts: index.counts, scenes: index.scenes, groups: index.groups, fingerprint: index.fingerprint};
}
