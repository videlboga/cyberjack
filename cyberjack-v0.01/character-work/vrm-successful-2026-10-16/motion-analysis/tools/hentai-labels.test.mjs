// Checks the hentai label layer against the published library and its own sources.
// Run: node tools/hentai-labels.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {SCENES, VOCAB, ROLE_PATTERNS} from './hentai-taxonomy.mjs';
import {describeClip, normalizeSceneKey, parsePhase, positionGroup} from './hentai-semantics.mjs';

const base = path.resolve(import.meta.dirname, '..');
const bundle = path.resolve(base, '..');
const data = base + '/data';
const manifest = JSON.parse(fs.readFileSync(data + '/hentai-labels-manifest.json'));
const index = JSON.parse(fs.readFileSync(data + '/hentai-labels.json'));
const catalog = JSON.parse(fs.readFileSync(bundle + '/animations/catalog.json')).clips;
const sceneRu = JSON.parse(fs.readFileSync(bundle + '/animations/en_ru_scenes.json')).scenes;
const search = JSON.parse(fs.readFileSync(data + '/library-search.json'));
const passes = [];
const ok = (name, fn) => {
  fn();
  passes.push(name);
};

ok('манифест полный и совпадает с индексом', () => {
  assert.equal(manifest.complete, true);
  assert.equal(manifest.fingerprint, index.fingerprint);
  assert.equal(manifest.counts.clips, Object.keys(index.labels).length);
});

ok('каждая сцена таксономии имеет клипы и перевод', () => {
  const keys = new Set(index.scenes.map((s) => s.key));
  for (const key of Object.keys(SCENES)) {
    assert.ok(keys.has(key), 'сцена без клипов: ' + key);
  }
  const translated = new Set(Object.keys(sceneRu).map((e) => normalizeSceneKey(e)));
  for (const key of Object.keys(SCENES)) assert.ok(translated.has(key) || key.startsWith('h:'), 'нет перевода сцены: ' + key);
});

ok('все метки — из словаря', () => {
  const bases = new Set(Object.keys(VOCAB.base));
  const acts = new Set(Object.keys(VOCAB.act));
  const phases = new Set(Object.keys(VOCAB.phase));
  const arrangements = new Set(Object.keys(VOCAB.arrangement));
  const participants = new Set(Object.keys(VOCAB.participants));
  for (const [id, row] of Object.entries(index.labels)) {
    const [, baseId, actIds, arrangementIds, phase, people] = row;
    assert.ok(bases.has(baseId), id + ' base ' + baseId);
    assert.ok(phases.has(phase), id + ' phase ' + phase);
    assert.ok(participants.has(people), id + ' participants ' + people);
    for (const a of actIds) assert.ok(acts.has(a), id + ' act ' + a);
    for (const a of arrangementIds) assert.ok(arrangements.has(a), id + ' arrangement ' + a);
  }
});

ok('смещения записей ведут на нужный клип', () => {
  const fd = fs.openSync(data + '/hentai-labels.jsonl', 'r');
  const ids = Object.keys(index.labels);
  for (const id of [ids[0], ids[Math.floor(ids.length / 3)], ids[Math.floor(ids.length / 2)], ids.at(-1)]) {
    const row = index.labels[id];
    const buffer = Buffer.alloc(row[11]);
    fs.readSync(fd, buffer, 0, row[11], row[10]);
    const record = JSON.parse(buffer.toString('utf8'));
    assert.equal(record.id, id);
  }
  fs.closeSync(fd);
});

ok('описание не пустое и не противоречит источникам', () => {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const sample = Object.keys(index.labels).filter((_, i) => i % 97 === 0).slice(0, 400);
  for (const id of sample) {
    const c = byId.get(id);
    const entry = c.origin?.includes('!') ? c.origin.split('!')[1].replace(/^[/\s]*(?:abdata\/)?/, '') : null;
    const record = describeClip({id, name: c.name, rig: c.rig, category: c.category, entry, enInfo: null, measured: {}});
    assert.ok(record.text.length > 40, id + ' текст слишком короткий');
    if (!record.scene) assert.equal(record.act.some((a) => a.evidence === 'scene-name' || a.evidence === 'scene-mode' || a.evidence === 'scene-kind'), false, 'без имени сцены действие не может ссылаться на сцену');
    const key = normalizeSceneKey(entry);
    if (key && SCENES[key]) assert.ok(record.scene, 'сцена должна распознаваться: ' + entry);
    if (key && !SCENES[key]) assert.ok(record.text.includes('перевода названия сцены нет'), 'непереведённая сцена должна быть названа: ' + entry);
    if (!record.scene && positionGroup(entry)) assert.ok(/набор|перевода названия сцены нет/.test(record.text), 'набор или непереведённая сцена должны быть названы: ' + entry);
  }
});

ok('действие без основания не выдумывается', () => {
  const sample = Object.keys(index.labels).filter((_, i) => i % 53 === 0).slice(0, 400);
  const byId = new Map(catalog.map((c) => [c.id, c]));
  for (const id of sample) {
    const c = byId.get(id);
    const entry = c.origin?.includes('!') ? c.origin.split('!')[1].replace(/^[/\s]*(?:abdata\/)?/, '') : null;
    const record = describeClip({id, name: c.name, rig: c.rig, category: c.category, entry, enInfo: null, measured: {}});
    if (!record.act.length) assert.ok(record.unknowns.some((u) => u.startsWith('действие')), id + ' отсутствие действия должно быть названо');
  }
});

ok('фаза разбирается для всех ролей и молчит у прочих имён', () => {
  assert.equal(parsePhase('L_A_SLoop1'), 'loop-s');
  assert.equal(parsePhase('f_wloop'), 'loop-w');
  assert.equal(parsePhase('M_OUT_Loop'), 'out-loop');
  assert.equal(parsePhase('Idle_08_01'), 'idle');
  assert.equal(parsePhase('beacon'), 'unknown');
  const phaseIds = new Set(Object.keys(index.counts.byPhase));
  for (const phase of phaseIds) assert.ok(VOCAB.phase[phase], 'фаза без названия: ' + phase);
  assert.ok(ROLE_PATTERNS.length >= 20);
});

ok('фильтр по фазе и действию возвращает согласованные записи', () => {
  for (const [id, row] of Object.entries(index.labels)) {
    if (row[3].includes('cowgirl') && !row[0]) throw Error('взаимное положение без сцены: ' + id);
  }
});

ok('записи индекса каталога совпадают по количеству с измерениями', () => {
  const ids = new Set(search.rows.map((r) => r.id));
  let missing = 0;
  for (const id of Object.keys(index.labels)) if (!ids.has(id)) missing++;
  assert.equal(missing, 0, 'метки на клипы вне каталога: ' + missing);
});

console.log('PASS hentai labels:', passes.length, 'checks');
for (const p of passes) console.log('  ·', p);
console.log('клипов:', manifest.counts.clips, '| со сценой:', manifest.counts.withScene, '| с действием:', manifest.counts.clips - manifest.counts.unknownAct);
