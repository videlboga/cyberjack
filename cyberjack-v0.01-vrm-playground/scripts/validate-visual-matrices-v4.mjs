import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const visualDir = path.join(root, 'src/infrastructure/data/visual');
const read = name => JSON.parse(fs.readFileSync(path.join(visualDir, name), 'utf8'));
const calibration = read('calibration-avatar-matrix.json');
const interactions = read('calibration-interaction-matrix.json');
const devices = read('device-visual-matrix.json');
const legacyBase = read('base-avatar-matrix.json');
const legacyExpanded = read('interaction-visual-matrix-expanded.json');
const characters = read('character-image-matrix.json').characters;
const index = read('visual-asset-index-v4.generated.json');
const assets = new Set(index.assets);
const errors = [];

const requireUnique = (values, label) => {
  const duplicate = values.find((value, position) => values.indexOf(value) !== position);
  if (duplicate) errors.push(`${label}: duplicate ${duplicate}`);
};

for (const [label, values] of [
  ['calibration poses', calibration.axes.poses],
  ['calibration clothing', calibration.axes.clothing],
  ['calibration affects', calibration.axes.affects],
  ['equipment presets', calibration.axes.equipmentPresets],
  ['interaction phases', interactions.phases],
  ['device phases', devices.phases],
]) requireUnique(values, label);

const slugs = new Map(characters.map(character => [character.id, character.slug]));
for (const characterId of calibration.characters) if (!slugs.has(characterId)) errors.push(`unknown calibration character ${characterId}`);
for (const preset of calibration.axes.equipmentPresets) {
  if (!calibration.equipmentCompatibility[preset]) errors.push(`missing compatibility for equipment ${preset}`);
}
for (const rule of calibration.contextPresetRules) {
  if (!calibration.axes.equipmentPresets.includes(rule.preset)) errors.push(`context rule uses unknown preset ${rule.preset}`);
}

let expectedBase = 0;
for (const characterId of legacyBase.characters) {
  const slug = slugs.get(characterId);
  for (const pose of legacyBase.poses) for (const clothing of legacyBase.clothing) for (const affect of legacyBase.states) {
    const asset = `/character-images/rendered/${slug}/${pose.id}__${clothing.id}__none__${affect.id}.png`;
    expectedBase += 1;
    if (!assets.has(asset)) errors.push(`missing base migration asset ${asset}`);
  }
}

let expectedExpanded = 0;
for (const characterId of legacyExpanded.characters) {
  const slug = slugs.get(characterId);
  for (const family of legacyExpanded.families) for (const variant of family.variants) {
    for (const phase of variant.phases || legacyExpanded.axes.phases) {
      for (const affect of legacyExpanded.affectsByPhase[phase] || []) {
        for (const wardrobe of variant.wardrobes) for (const restraint of variant.restraints) {
          const asset = `/character-images/interactions-expanded/${slug}/${family.id}/${variant.id}/${wardrobe}__${restraint}__${affect}__${phase}.png`;
          expectedExpanded += 1;
          if (!assets.has(asset)) errors.push(`missing expanded migration asset ${asset}`);
        }
      }
    }
  }
}

if (index.assets.some(asset => asset.includes('/rmbg_v1/'))) errors.push('runtime index includes archived rmbg_v1');
if (index.counts.rendered !== expectedBase) errors.push(`rendered count ${index.counts.rendered}, expected ${expectedBase}`);
if (index.counts.interactionsExpanded !== expectedExpanded) errors.push(`expanded count ${index.counts.interactionsExpanded}, expected ${expectedExpanded}`);

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  if (errors.length > 100) console.error(`...and ${errors.length - 100} more`);
  process.exit(1);
}

console.log({
  calibrationManifest: 'ok',
  interactionManifest: 'ok',
  deviceManifest: 'ok',
  indexedAssets: index.counts.total,
  migratedBaseAssets: expectedBase,
  migratedExpandedAssets: expectedExpanded,
  archivedAssetsIndexed: 0
});
