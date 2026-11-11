// Builds RU "what happens" labels for the hentai part of the Koikatsu library.
// Inputs are read-only: ../animations/catalog.json, scene translations, AnimationLoader names,
// data/library-annotations.jsonl (measured geometry). No clip is re-decoded here.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import {describeClip, normalizeSceneKey} from './hentai-semantics.mjs';
import {SCENES, VOCAB} from './hentai-taxonomy.mjs';

const base = path.resolve(import.meta.dirname, '..');
const bundle = path.resolve(base, '..');
const data = base + '/data';
const out = process.env.HENTAI_OUT_DIR || data;

const catalog = JSON.parse(fs.readFileSync(bundle + '/animations/catalog.json')).clips;
const sceneRu = JSON.parse(fs.readFileSync(bundle + '/animations/en_ru_scenes.json')).scenes;
const loader = JSON.parse(fs.readFileSync(bundle + '/animations/animloader_names.json'));
const loaderByEntry = Object.fromEntries(Object.entries(loader).map(([k, v]) => [k.replace(/^abdata\//, ''), v]));

const sceneInfo = {};
for (const [entry, ru] of Object.entries(sceneRu)) {
  const info = loaderByEntry[entry] || loaderByEntry[entry.replace('/male/', '/female/')] || {};
  sceneInfo[entry] = {sceneRu: ru, name: (info.name || '').replace(/&amp;/g, '&'), mode: info.mode || null, kind: info.kind || null};
}

const H_ZIPMOD = /kplug|omega|free_h|betterpenetration|khs|khh|pregnancy|h[-_ ]anim/i;
const CHARACTER_RIGS = new Set(['female', 'male', 'shared']);
function entryOf(c) {
  const o = c.origin || '';
  return o.includes('!') ? o.split('!')[1].replace(/^[/\s]*(?:abdata\/)?/, '') : null;
}
function zipmodOf(c) {
  const o = c.origin || '';
  return o.includes('!') ? o.split('!')[0].split('/').pop() : null;
}
function isHentaiClip(c) {
  if (!CHARACTER_RIGS.has(c.rig)) return false;
  if (c.category === 'h') return true;
  const entry = entryOf(c);
  if (entry && normalizeSceneKey(entry)) return true;
  if (entry && /^anim_imports\/kplug\//.test(entry)) return true;
  const z = zipmodOf(c);
  return Boolean(z && H_ZIPMOD.test(z));
}

const byId = new Map(catalog.map((c) => [c.id, c]));
const hIds = new Set(catalog.filter(isHentaiClip).map((c) => c.id));

function measuredOf(a) {
  const m = a?.anatomy?.metrics || {};
  const mean = (k) => (m[k] ? m[k].mean : null);
  const parts = a?.parts || {};
  const dyn = a?.dynamics || {};
  return {
    posture: a?.body?.posture || 'unknown',
    inclination: mean('body.inclination'),
    pelvisAboveFeet: mean('pelvis.aboveFeet'),
    hands: [parts.arms?.L?.position?.value || null, parts.arms?.R?.position?.value || null],
    legs: [
      {shape: parts.legs?.L?.shape?.value || null, flexion: mean('L.leg.flexion')},
      {shape: parts.legs?.R?.shape?.value || null, flexion: mean('R.leg.flexion')},
    ],
    tempo: dyn.level || 'unknown',
    speed: typeof dyn.endpointSpeedMax === 'number' ? dyn.endpointSpeedMax : null,
    dominant: dyn.dominant || null,
  };
}

const started = Date.now();
const fd = fs.openSync(out + '/hentai-labels.jsonl.tmp', 'w');
const labels = {};
const counts = {clips: 0, withScene: 0, withoutScene: 0, measured: 0, unmeasured: 0, bySide: {}, byBase: {}, byAct: {}, byArrangement: {}, byPhase: {}, byAgreement: {}, unknownAct: 0};
const sceneStats = {};
const groupStats = {};
let seen = 0;
let offset = 0;

for await (const line of readline.createInterface({input: fs.createReadStream(data + '/library-annotations.jsonl'), crlfDelay: Infinity})) {
  if (!line) continue;
  seen++;
  const a = JSON.parse(line);
  if (!hIds.has(a.id)) continue;
  const c = byId.get(a.id);
  const entry = entryOf(c) || (c.source && /^h\/anim\//.test(c.source) ? c.source : null);
  const info = entry ? sceneInfo[entry] || sceneInfo[entry.replace('/male/', '/female/')] || null : null;
  const measured = measuredOf(a);
  const record = describeClip({id: a.id, name: a.name || c.name, rig: a.rig || c.rig, category: c.category, entry, enInfo: info, measured});
  const lineText = JSON.stringify(record) + '\n';
  fs.writeSync(fd, lineText);
  const length = Buffer.byteLength(lineText);
  labels[a.id] = [record.scene?.key || null, record.base.id, record.act.map((x) => x.id), record.arrangement.map((x) => x.id), record.phase.id, record.participants, record.checks.baseAgreement, record.side, record.measured.posture || null, record.group?.id || null, offset, length, record.hscene ? record.hscene.bundle : null, record.hscene ? record.hscene.modes.join(',') : null];
  offset += length;
  counts.clips++;
  counts[record.scene ? 'withScene' : 'withoutScene']++;
  counts[a.quality?.measured ? 'measured' : 'unmeasured']++;
  counts.bySide[record.side] = (counts.bySide[record.side] || 0) + 1;
  for (const x of record.act) counts.byAct[x.id] = (counts.byAct[x.id] || 0) + 1;
  for (const x of record.arrangement) counts.byArrangement[x.id] = (counts.byArrangement[x.id] || 0) + 1;
  if (!record.act.length) counts.unknownAct++;
  counts.byBase[record.base.id] = (counts.byBase[record.base.id] || 0) + 1;
  counts.byPhase[record.phase.id] = (counts.byPhase[record.phase.id] || 0) + 1;
  counts.byAgreement[record.checks.baseAgreement] = (counts.byAgreement[record.checks.baseAgreement] || 0) + 1;
  const target = record.scene ? sceneStats[record.scene.key] || (sceneStats[record.scene.key] = {label: record.scene.label, base: record.base.id, clips: 0, posture: {}, incline: {}, agreement: {agree: 0, differs: 0, unmeasured: 0}, loops: {n: 0, posture: {}}}) : groupStats[record.group?.id || 'none'] || (groupStats[record.group?.id || 'none'] = {label: record.group?.label || 'без набора', clips: 0, posture: {}});
  target.clips++;
  if (record.measured.posture) target.posture[record.measured.posture] = (target.posture[record.measured.posture] || 0) + 1;
  if (record.scene) {
    if (record.checks.baseAgreement in target.agreement) target.agreement[record.checks.baseAgreement]++;
    if (record.measured.inclination !== null) {
      const band = Math.floor(record.measured.inclination / 15) * 15;
      target.incline[band] = (target.incline[band] || 0) + 1;
    }
    if (record.phase.id.startsWith('loop')) {
      target.loops.n++;
      if (record.measured.posture) target.loops.posture[record.measured.posture] = (target.loops.posture[record.measured.posture] || 0) + 1;
    }
  }
  if (counts.clips % 20000 === 0) console.log('labels', counts.clips, 'of', hIds.size, 'scanned', seen);
}
fs.closeSync(fd);
fs.renameSync(out + '/hentai-labels.jsonl.tmp', out + '/hentai-labels.jsonl');

const hash = crypto.createHash('sha256');
for (const f of ['hentai-taxonomy.mjs', 'hentai-semantics.mjs', 'build-hentai-labels.mjs']) hash.update(fs.readFileSync(import.meta.dirname + '/' + f));
hash.update(fs.readFileSync(bundle + '/animations/en_ru_scenes.json'));
hash.update(fs.readFileSync(bundle + '/animations/animloader_names.json'));
hash.update(fs.readFileSync(data + '/library-annotation-manifest.json'));
const fingerprint = hash.digest('hex');
const missingScenes = Object.keys(SCENES).filter((k) => !sceneStats[k]);

const compact = {
  format: 'hentai-labels-v1',
  fingerprint,
  complete: true,
  rowsFile: 'hentai-labels.jsonl',
  counts,
  vocab: VOCAB,
  scenes: Object.entries(sceneStats).map(([key, s]) => ({key, ...s})).sort((a, b) => b.clips - a.clips),
  groups: Object.entries(groupStats).map(([key, g]) => ({key, ...g})).sort((a, b) => b.clips - a.clips),
  labels,
};
fs.writeFileSync(out + '/hentai-labels.json.tmp', JSON.stringify(compact));
fs.renameSync(out + '/hentai-labels.json.tmp', out + '/hentai-labels.json');

const manifest = {
  format: 'hentai-labels-manifest-v1',
  fingerprint,
  complete: counts.clips === hIds.size,
  counts,
  sources: {
    catalog: 'animations/catalog.json',
    sceneTranslations: 'animations/en_ru_scenes.json',
    sceneNames: 'animations/animloader_names.json',
    measurements: 'data/library-annotations.jsonl',
  },
  scenes: {taxonomy: Object.keys(SCENES).length, measured: Object.keys(sceneStats).length, withoutClips: missingScenes},
  evidence: {
    scene: 'mod author scene name, translated in animations/en_ru_scenes.json; not a visual check',
    phase: 'clip name tokens; W/S/O letters are read as weak/strong/orgasm only because the measured endpoint speed rises in that order',
    act: 'scene name words, scene mode/kind, or native service tokens in the clip name',
    measured: 'sampled geometry of this clip: inclination, pelvis height above the lower foot, hands, knee flexion, tempo',
  },
  notMeasured: ['partner and contact identity', 'gaze and emotion', 'finger shapes and wrist direction', 'variant codes M/SS/WS/WF/SF/A', 'native position numbers 01_01 etc.'],
  seconds: (Date.now() - started) / 1000,
};
fs.writeFileSync(out + '/hentai-labels-manifest.json', JSON.stringify(manifest, null, 2));
console.log('H clips', hIds.size, 'labels', counts.clips, 'seconds', manifest.seconds.toFixed(1));
console.log(JSON.stringify({counts, scenes: manifest.scenes}, null, 2));
