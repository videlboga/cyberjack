// Deterministic RU description of a Koikatsu hentai clip.
// Evidence order: scene name (mod author's label) -> clip name (phase / service tokens) -> measured geometry.
// Nothing is inferred from a clip name beyond the documented tokens, and every claim keeps its source.
import {SCENES, VOCAB, ROLE_PATTERNS, TOKEN_ACTS, TOKEN_STYLES, VARIANT_CODES} from './hentai-taxonomy.mjs';
import {hsceneFor, jaRu} from './hscene-table.mjs';

const POSTURE_TO_BASE = {standing: 'standing', seated: 'seated', lying: 'lying', quadruped: 'quadruped', crouched: 'crouched', inverted: 'inverted', unknown: null};
const TEMPO_RU = {quiet: 'почти неподвижно', small: 'небольшие движения', active: 'активный темп', unknown: 'темп не измерен'};
const HANDS_RU = {'near-body': 'у тела', lowered: 'опущены', front: 'впереди', side: 'в стороне', behind: 'сзади', overhead: 'над головой', mixed: 'разные', up: 'подняты', down: 'внизу', horizontal: 'поперёк'};
const KIND_ACTS = {Mouth: 'oral', Breasts: 'titjob'};

// Coarse inclination bands only used to flag a visible mismatch with the scene's own wording.
// The number itself is always shown, so the reader can ignore the band.
const BANDS = {
  lying: [65, 180],
  'on-table': [65, 180],
  seated: [25, 95],
  kneeling: [0, 60],
  standing: [0, 45],
  'at-wall': [0, 50],
  lifted: [0, 180],
};

export function normalizeSceneKey(entry) {
  if (!entry) return null;
  const e = String(entry).replace(/^abdata\//, '');
  let m = /^anim_imports\/kplug\/(?:female|male)\/(\d\d_\d\d)\.unity3d$/.exec(e);
  if (m) return 'kplug:' + m[1];
  m = /^h\/anim\/(?:female|male)\/(.+)\.unity3d$/.exec(e);
  if (m) return 'h:' + m[1].replace(/_F$/, '');
  return null;
}

// Native Koikatsu clips carry no scene name; only the bundle number groups them.
export function positionGroup(entry) {
  if (!entry) return null;
  const m = /^h\/anim\/(female|male|parts)\/(\d\d_\d\d_?\d*)\.unity3d$/.exec(entry.replace(/^abdata\//, ''));
  if (m) return {id: 'h:' + m[2].replace(/_$/, ''), label: 'набор базовой игры ' + m[2].replace(/_$/, ''), side: m[1]};
  const k = /^anim_imports\/kplug\/(?:female|male)\/(\d\d_\d\d)\.unity3d$/.exec(entry.replace(/^abdata\//, ''));
  if (k) return {id: 'kplug:' + k[1], label: 'сцена KPlug ' + k[1], side: null};
  return null;
}

export function parsePhase(name) {
  const low = String(name || '').toLowerCase().replace(/^[lmsf]{1,2}_/, '');
  for (const [pattern, phase] of ROLE_PATTERNS) if (low.includes(pattern)) return phase;
  return 'unknown';
}

export function parseVariantCodes(name) {
  const parts = String(name || '').split('_').slice(1);
  const codes = parts.filter((p) => VARIANT_CODES.includes(p) || (p.length <= 3 && /^[A-Z]+$/.test(p) && p !== 'IN' && p !== 'OUT'));
  return [...new Set(codes)].slice(0, 4);
}

export function tokenActs(name) {
  const low = String(name || '').toLowerCase();
  const out = [];
  for (const [token, act] of Object.entries(TOKEN_ACTS)) if (low.includes(token) && !out.includes(act)) out.push(act);
  return out;
}

export function tokenStyles(name) {
  const low = String(name || '').toLowerCase();
  const out = [];
  for (const [token, style] of Object.entries(TOKEN_STYLES)) if (style && low.includes(token) && !out.includes(style)) out.push(style);
  return out;
}

export function sizeVariant(name) {
  const m = /^([LMS]{1,2})_/.exec(String(name || ''));
  return m ? m[1] : null;
}

const uniq = (xs) => [...new Set(xs)];
const label = (group, id) => VOCAB[group]?.[id] || id;

export function sceneOf(entry, enInfo) {
  const key = normalizeSceneKey(entry);
  const row = key ? SCENES[key] : null;
  if (!row) return null;
  const info = enInfo || {};
  return {
    key,
    row,
    label: info.sceneRu || null,
    en: info.name || null,
    mode: info.mode || null,
    kind: info.kind || null,
    participants: row.p || 'unknown',
  };
}

// input: {id,name,rig,category,entry,enInfo,measured:{posture,inclination,pelvisAboveFeet,hands:[L,R],legs:[L,R],tempo,speed,dominant}}
export function describeClip(input) {
  const {name, rig, category} = input;
  const scene = sceneOf(input.entry, input.enInfo);
  const row = scene?.row || null;
  const pathKey = normalizeSceneKey(input.entry);
  const untranslatedScene = pathKey && !SCENES[pathKey] ? pathKey : null;
  const group = scene ? null : positionGroup(input.entry);
  const hs = scene ? null : hsceneFor(input.entry);
  const phase = parsePhase(name);
  const codes = parseVariantCodes(name);
  const measured = input.measured || {};
  const posture = measured.posture && measured.posture !== 'unknown' ? measured.posture : null;
  const measuredBase = posture ? POSTURE_TO_BASE[posture] : null;

  const actEntries = [];
  const addAct = (id, evidence) => {
    if (!id || actEntries.some((a) => a.id === id)) return;
    actEntries.push({id, label: label('act', id), evidence});
  };
  for (const id of row?.a || []) addAct(id, 'scene-name');
  if (!actEntries.length && scene?.kind && KIND_ACTS[scene.kind]) addAct(KIND_ACTS[scene.kind], 'scene-kind');
  if (!actEntries.some((a) => a.id === 'intercourse') && scene?.mode === 'sonyu') addAct('intercourse', 'scene-mode');
  for (const id of tokenActs(name)) addAct(id, 'clip-name');

  const arrangements = (row?.r || []).filter((id) => id !== 'unknown').map((id) => ({id, label: label('arrangement', id)}));
  const style = uniq([...(row?.s || []), ...tokenStyles(name)]).map((id) => ({id, label: label('style', id), evidence: (row?.s || []).includes(id) ? 'scene-name' : 'clip-name'}));
  const sceneBase = row?.base && row.base !== 'unknown' ? row.base : null;

  let agreement = 'no-scene';
  let mismatch = null;
  if (sceneBase) {
    if (Number.isFinite(measured.inclination)) {
      const [lo, hi] = BANDS[sceneBase] || [0, 180];
      const inside = measured.inclination >= lo && measured.inclination <= hi;
      agreement = inside ? 'agree' : 'differs';
      if (!inside) mismatch = {expected: sceneBase, inclination: measured.inclination, band: [lo, hi]};
    } else if (measuredBase) {
      agreement = sceneBase === measuredBase ? 'agree' : 'differs';
    } else agreement = 'unmeasured';
  } else if (!measuredBase) agreement = 'unmeasured';

  const unknowns = [];
  if (!scene) unknowns.push(hs ? `точная позиция внутри набора: клип обслуживает ${hs.positions.length} позиций` : untranslatedScene ? 'сцена ' + untranslatedScene + ': перевода нет' : group ? 'позиция: номер набора не расшифрован' : 'позиция: у клипа нет распознанного имени сцены');
  if (!actEntries.length) unknowns.push('действие: имя клипа его не содержит');
  if (codes.length) unknowns.push('коды варианта ' + codes.join('/') + ': значение не расшифровано');
  unknowns.push('контакт с партнёром и распределение веса', 'направление взгляда и эмоции', 'форма пальцев и направление кистей');

  const record = {
    format: 'hentai-label-v1',
    id: input.id,
    name,
    side: rig,
    category: category || null,
    scene: scene ? {key: scene.key, label: scene.label, en: scene.en, mode: scene.mode, kind: scene.kind} : null,
    untranslatedScene,
    group,
    hscene: hs ? {
      bundle: hs.bundle,
      modes: hs.modes,
      modeLabels: hs.modeLabels,
      postureCodes: hs.postureCodes,
      partnerBundle: hs.partnerBundle,
      positionCount: hs.positions.length,
      positions: hs.positions.map((p) => ({mode: p.mode, id: p.id, ja: p.ja, ru: jaRu(p.ja).label, categories: p.categories})),
    } : null,
    base: sceneBase ? {id: sceneBase, label: VOCAB.base[sceneBase], evidence: 'scene-name'} : {id: 'unknown', label: VOCAB.base.unknown, evidence: 'none'},
    orientation: row?.orientation || null,
    arrangement: arrangements,
    act: actEntries,
    style,
    participants: scene?.participants || 'unknown',
    phase: {id: phase, label: label('phase', phase), evidence: 'clip-name'},
    variant: {codes, decoded: false},
    size: sizeVariant(name),
    measured: {
      source: 'geometry',
      posture,
      inclination: Number.isFinite(measured.inclination) ? measured.inclination : null,
      pelvisAboveFeet: Number.isFinite(measured.pelvisAboveFeet) ? measured.pelvisAboveFeet : null,
      hands: measured.hands || null,
      legs: measured.legs || null,
      tempo: measured.tempo || 'unknown',
      speed: Number.isFinite(measured.speed) ? measured.speed : null,
      dominant: measured.dominant || null,
    },
    checks: {baseAgreement: agreement, mismatch},
    unknowns,
    text: '',
    note: row?.note || null,
  };
  record.text = explain(record);
  return record;
}

export function explain(r) {
  const sceneActs = r.act.filter((a) => a.evidence !== 'clip-name');
  const clipActs = r.act.filter((a) => a.evidence === 'clip-name');
  const shownActLabels = new Set([...sceneActs, ...clipActs].map((a) => a.label));
  const parts = [];
  if (sceneActs.length) parts.push(sceneActs.map((a) => a.label).join(' + '));
  const actIds = new Set(r.act.map((a) => a.id));
  const arrangements = r.arrangement.filter((a) => !shownActLabels.has(a.label) && !actIds.has(a.id));
  if (arrangements.length) parts.push(arrangements.map((a) => a.label).join(', '));
  if (r.base.id !== 'unknown') parts.push(VOCAB.base[r.base.id] + (r.orientation ? ', ' + VOCAB.orientation[r.orientation] : ''));
  const usedLabels = new Set([...sceneActs.map((a) => a.label), ...arrangements.map((a) => a.label), ...(r.base.id !== 'unknown' ? [VOCAB.base[r.base.id]] : [])]);
  const styles = r.style.filter((s) => !usedLabels.has(s.label));
  if (styles.length) parts.push(styles.map((s) => s.label).join(', '));
  if (r.participants !== 'unknown') parts.push(VOCAB.participants[r.participants]);
  const clipPart = clipActs.length ? ` По имени клипа: ${clipActs.map((a) => a.label).join(', ')}.` : '';
  let scenePart;
  if (r.scene?.label) scenePart = `Сцена «${r.scene.label}»: ${parts.join('; ')}.` + clipPart;
  else if (r.hscene) {
    const names = r.hscene.positions.slice(0, 4).map((p) => p.ja + (p.ru && p.ru !== p.ja ? ` (${p.ru})` : ''));
    scenePart = `Набор H-сцены ${r.hscene.bundle}: ${r.hscene.modeLabels.join(', ')}; позиции набора (${r.hscene.positionCount}): ${names.join(', ')}${r.hscene.positionCount > names.length ? ' …' : ''}. Точная позиция по клипу не определяется: набор общий для всех его позиций.`;
    if (parts.length) scenePart += ` По имени клипа: ${parts.join('; ')}.`;
  }
  else if (r.group) scenePart = `${r.group.label}${r.untranslatedScene ? ' — перевода названия сцены нет' : ' (номер не расшифрован)'}. По имени клипа: ${parts.length ? parts.join('; ') : 'ничего не указано'}.`;
  else scenePart = `${r.untranslatedScene ? `Сцена ${r.untranslatedScene} — перевода названия сцены нет.` : 'Сцена не распознана.'} По имени клипа: ${parts.length ? parts.join('; ') : 'ничего не указано'}.`;

  const tempo = TEMPO_RU[r.measured.tempo] || r.measured.tempo;
  const phasePart = `Фаза: ${r.phase.label}${r.phase.id.startsWith('loop') && r.measured.tempo !== 'unknown' ? ` (${tempo})` : ''}.`;

  const facts = [];
  if (r.measured.inclination !== null) facts.push(`корпус ${Math.round(r.measured.inclination)}° от вертикали`);
  if (r.measured.pelvisAboveFeet !== null) facts.push(`таз ${r.measured.pelvisAboveFeet.toFixed(2)} роста над нижней стопой`);
  if (r.measured.hands?.every(Boolean)) facts.push(`кисти ${HANDS_RU[r.measured.hands[0]] || r.measured.hands[0]}${r.measured.hands[0] === r.measured.hands[1] ? '' : ' / ' + (HANDS_RU[r.measured.hands[1]] || r.measured.hands[1])}`);
  if (r.measured.legs?.every((l) => Number.isFinite(l?.flexion))) facts.push(`колени согнуты ${Math.round(r.measured.legs[0].flexion)}° / ${Math.round(r.measured.legs[1].flexion)}°`);
  if (r.measured.speed !== null) facts.push(`скорость ${r.measured.speed.toFixed(3)} роста/с`);
  const measuredPart = facts.length ? `Измерено: ${facts.join(', ')}.` : 'Измерения отсутствуют.';

  const checkPart = r.checks.mismatch
    ? ` Корпус в этом клипе ${Math.round(r.checks.mismatch.inclination)}° — это не похоже на «${VOCAB.base[r.checks.mismatch.expected]}» из названия сцены: у клипа другая конфигурация тела.`
    : '';
  const sidePart = r.side === 'male' ? ' Мужская сторона.' : '';
  return scenePart + ' ' + phasePart + ' ' + measuredPart + checkPart + sidePart;
}

export function summarize(r) {
  return {
    scene: r.scene?.label || null,
    sceneKey: r.scene?.key || null,
    group: r.group?.id || null,
    base: r.base.id,
    act: r.act.map((a) => a.id),
    arrangement: r.arrangement.map((a) => a.id),
    phase: r.phase.id,
    participants: r.participants,
    agreement: r.checks.baseAgreement,
    side: r.side,
    text: r.text,
  };
}
