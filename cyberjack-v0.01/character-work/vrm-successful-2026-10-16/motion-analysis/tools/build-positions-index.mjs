// One index record per H position: what to draw (female/male base clips), which layers belong to it and
// which props the scene declares. Everything is resolved against the library, so the viewer only needs ids.
import fs from 'node:fs';

const data = 'data';
const catalog = JSON.parse(fs.readFileSync('../animations/catalog.json')).clips;
const byName = new Map();
for (const c of catalog) if (!byName.has(c.name)) byName.set(c.name, c);

const bases = JSON.parse(fs.readFileSync(data + '/position-bases.json')).positions;
const props = JSON.parse(fs.readFileSync(data + '/position-props.json')).positions;
const links = JSON.parse(fs.readFileSync(data + '/layer-links.json')).clips;

// clip name -> positions, inverted: position key -> layer clip ids
const layersByPosition = new Map();
for (const [clipName, info] of Object.entries(links)) {
  const clip = byName.get(clipName);
  if (!clip) continue;
  for (const pos of info.positions) {
    const key = `${pos.side}/${pos.mode}/${pos.id}`;
    if (!layersByPosition.has(key)) layersByPosition.set(key, []);
    layersByPosition.get(key).push({ id: clip.id, name: clip.name, duration: clip.duration });
  }
}

// How many positions list each clip: generic loops appear in dozens of controllers, while the clips that
// actually pose this scene appear in one or two. Specificity is the only signal the data gives us.
const clipFrequency = new Map();
for (const record of Object.values(bases)) {
  for (const name of new Set(record.clips || [])) clipFrequency.set(name, (clipFrequency.get(name) || 0) + 1);
}

const score = (name) => (/idle/i.test(name) ? 3 : 0) + (/loop/i.test(name) ? 1 : 0) - (/touch|orgasm/i.test(name) ? 2 : 0);
const pickClip = (names, rig) => {
  const candidates = names.map((n) => byName.get(n)).filter((c) => c && (!rig || c.rig === rig));
  if (!candidates.length) return null;
  candidates.sort((a, b) => score(b.name) - score(a.name) || a.name.localeCompare(b.name));
  const c = candidates[0];
  return { id: c.id, name: c.name, duration: c.duration };
};

// Male side: the partner is drawn from the male base controller's clips, which are in the library under rig male.
const maleProps = props.filter((p) => p.male?.animFile).map((p) => ({ mode: p.mode, id: p.id, controller: p.male.animFile, props: p.male }));
const items = {};
for (const record of Object.values(bases)) {
  const key = `${record.side}/${record.mode}/${record.id}`;
  const prop = props.find((p) => p.mode === record.mode && p.id === record.id) || {};
  const layers = (layersByPosition.get(key) || []).filter((l, i, arr) => arr.findIndex((x) => x.id === l.id) === i);
  // Position-specific clips describe this scene; the base controller's list is shared by a whole bundle,
  // so picking from it gave the same idle to hundreds of positions.
  const ownClips = (record.clips || [])
    .map((n) => byName.get(n))
    .filter((c) => c && c.rig !== 'male')
    .sort((a, b) => (clipFrequency.get(a.name) || 0) - (clipFrequency.get(b.name) || 0) || (b.duration || 0) - (a.duration || 0));
  const ownBase = ownClips.length ? { id: ownClips[0].id, name: ownClips[0].name, duration: ownClips[0].duration } : null;
  const layerFreq = (name) => clipFrequency.get(name) || 0;
  const defaultLayer = [...layers].sort((a, b) => layerFreq(a.name) - layerFreq(b.name) || (b.duration || 0) - (a.duration || 0))[0] || null;
  items[key] = {
    key,
    defaultLayer,
    mode: record.mode,
    id: record.id,
    side: record.side,
    nameJa: record.nameJa,
    controller: record.controller,
    baseController: record.baseController,
    base: pickClip(record.baseClips, record.side === 'male' ? 'male' : 'female'),
    layers,
    partner: record.side === 'male' ? null : (() => {
      const link = maleProps.find((m) => m.mode === record.mode && m.id === record.id);
      if (!link) return null;
      const maleBase = bases[`male/${record.mode}/${record.id}`];
      const layerNames = maleBase ? maleBase.clips : [];
      const layers = layerNames.map((n) => byName.get(n)).filter((c) => c && c.rig === 'male').map((c) => ({ id: c.id, name: c.name, duration: c.duration }));
      const pick = pickClip(layerNames, 'male');
      return { controller: link.controller, base: pick, layers: layers.filter((l, i, a) => a.findIndex((x) => x.id === l.id) === i), props: link.props };
    })(),
    props: {
      item: prop.female?.item || prop.male?.item || null,
      hit: prop.female?.hit || null,
      hitObject: prop.female?.hitObject || null,
      neck: prop.female?.neck || null,
      camera: prop.female?.camera || null,
      partner: prop.male?.animFile || null,
      useDesk: prop.useDesk ?? null,
      useChair: prop.useChair ?? null,
    },
  };
}

fs.writeFileSync(data + '/positions-index.json', JSON.stringify({ format: 'positions-index-v1', positions: items }));
const list = Object.values(items);
console.log('позиций в индексе:', list.length, '| с базовым клипом:', list.filter((p) => p.base).length, '| со слоями:', list.filter((p) => p.layers.length).length, '| с предметом:', list.filter((p) => p.props.item).length);
const sample = list.find((p) => p.layers.length && p.base);
console.log('пример:', JSON.stringify({ key: sample.key, name: sample.nameJa, base: sample.base, layers: sample.layers.slice(0, 3), props: sample.props }, null, 0).slice(0, 400));
