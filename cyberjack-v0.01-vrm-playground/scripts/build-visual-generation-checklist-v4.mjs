import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const visualDir = path.join(root, 'src/infrastructure/data/visual');
const outputDir = path.join(root, 'docs/visual-assets');
const read = name => JSON.parse(fs.readFileSync(path.join(visualDir, name), 'utf8'));

const calibration = read('calibration-avatar-matrix.json');
const interactions = read('calibration-interaction-matrix.json');
const devices = read('device-visual-matrix.json');
const base = read('base-avatar-matrix.json');
const expanded = read('interaction-visual-matrix-expanded.json');
const characterSource = read('character-image-matrix.json');
const index = read('visual-asset-index-v4.generated.json');
const indexed = new Set(index.assets);
const characterById = new Map(characterSource.characters.map(character => [character.id, character]));
const basePoseIds = new Set(base.poses.map(entry => entry.id));

const extraPoseLegacy = {
  standing_exposed: ['exposure', 'standing'],
  sitting_spread: ['exposure', 'sitting_spread'],
  covering: ['exposure', 'covering'],
  feet_presented: ['foot', 'bare_presented']
};

const legacyWardrobeFor = clothing => ({
  nude: 'nude', underwear: 'underwear', dress: 'open_top', dress_stockings: 'stockings',
  jumpsuit: 'device_outfit', lab_gown: 'open_top', calibration_set: 'underwear'
})[clothing];

const legacyRestraintFor = equipmentPreset => ({
  none: 'free', blindfold: 'free', gag: 'free', blindfold_gag: 'free', collar: 'free',
  wrist_cuffs: 'wrists', wrist_cuffs_blindfold: 'wrists', ankle_cuffs: 'spread',
  wrist_ankle_cuffs: 'spread', restraint_belt: 'wrists', table_straps: 'spread',
  restraint_frame: 'spread', suspension: 'machine'
})[equipmentPreset];

const phaseForLegacyAffect = affect => ({
  receptive: 'sustain', guarded: 'sustain', high_positive: 'intense', high_negative: 'intense',
  subspace: 'intense', climax: 'peak'
})[affect];

const expandedVariant = (familyId, variantId) => expanded.families
  .find(family => family.id === familyId)?.variants.find(variant => variant.id === variantId);

const expandedCandidate = ({ slug, family, variant, clothing, equipmentPreset, affect, phase }) => {
  const wardrobe = legacyWardrobeFor(clothing);
  const restraint = legacyRestraintFor(equipmentPreset);
  const definition = expandedVariant(family, variant);
  if (!definition || !wardrobe || !restraint) return null;
  if (!definition.wardrobes.includes(wardrobe) || !definition.restraints.includes(restraint)) return null;
  if (!(definition.phases || expanded.axes.phases).includes(phase)) return null;
  if (!(expanded.affectsByPhase[phase] || []).includes(affect)) return null;
  const candidate = `/character-images/interactions-expanded/${slug}/${family}/${variant}/${wardrobe}__${restraint}__${affect}__${phase}.png`;
  return indexed.has(candidate) ? candidate : null;
};

const priorityForEquipment = preset => preset === 'none' ? 'P0'
  : preset === 'blindfold' ? 'P1'
    : ['gag', 'blindfold_gag'].includes(preset) ? 'P2'
      : ['wrist_cuffs', 'wrist_cuffs_blindfold'].includes(preset) ? 'P3'
        : ['ankle_cuffs', 'wrist_ankle_cuffs', 'restraint_belt'].includes(preset) ? 'P4'
          : ['table_straps', 'restraint_frame', 'suspension'].includes(preset) ? 'P5' : 'P6';

const rows = [];
const targetFileFor = targetAsset => path.join(root, 'public', targetAsset.replace(/^\//, ''));

for (const characterId of calibration.characters) {
  const character = characterById.get(characterId);
  for (const equipmentPreset of calibration.axes.equipmentPresets) {
    const compatiblePoses = calibration.equipmentCompatibility[equipmentPreset].includes('*')
      ? calibration.axes.poses : calibration.equipmentCompatibility[equipmentPreset];
    for (const pose of compatiblePoses) for (const clothing of calibration.axes.clothing) for (const affect of calibration.axes.affects) {
      const targetAsset = calibration.assetConvention
        .replace('$character', character.slug).replace('$pose', pose).replace('$clothing', clothing)
        .replace('$equipmentPreset', equipmentPreset).replace('$affect', affect);
      let exactLegacyAsset = null;
      let legacyCandidate = null;
      if (equipmentPreset === 'none' && basePoseIds.has(pose)) {
        const asset = `/character-images/rendered/${character.slug}/${pose}__${clothing}__none__${affect}.png`;
        if (indexed.has(asset)) exactLegacyAsset = asset;
      } else if (equipmentPreset === 'none' && extraPoseLegacy[pose]) {
        const [family, variant] = extraPoseLegacy[pose];
        const phase = phaseForLegacyAffect(affect);
        if (phase) legacyCandidate = expandedCandidate({ slug: character.slug, family, variant, clothing, equipmentPreset, affect, phase });
      }
      const generated = indexed.has(targetAsset);
      rows.push({
        matrix: 'calibration-avatar', priority: priorityForEquipment(equipmentPreset), characterId,
        character: character.name, characterSlug: character.slug, pose, clothing, equipmentPreset, affect,
        targetAsset, targetFile: targetFileFor(targetAsset),
        status: generated ? 'generated_v4' : exactLegacyAsset ? 'covered_by_exact_legacy' : 'missing_generate',
        exactLegacyAsset, legacyCandidate
      });
    }
  }
}

for (const characterId of interactions.characters) {
  const character = characterById.get(characterId);
  for (const family of interactions.families.filter(entry => !entry.future)) for (const variant of family.variants) {
    for (const clothing of interactions.clothing) for (const equipmentPreset of family.equipmentPresets) {
      for (const phase of interactions.phases) for (const affect of interactions.affectsByPhase[phase]) {
        const targetAsset = interactions.assetConvention
          .replace('$character', character.slug).replace('$family', family.id).replace('$variant', variant)
          .replace('$clothing', clothing).replace('$equipmentPreset', equipmentPreset)
          .replace('$affect', affect).replace('$phase', phase);
        const generated = indexed.has(targetAsset);
        const legacyCandidate = expandedCandidate({ slug: character.slug, family: family.id, variant, clothing, equipmentPreset, affect, phase });
        rows.push({
          matrix: 'calibration-interaction', priority: equipmentPreset === 'none' ? 'P7' : 'P8',
          characterId, character: character.name, characterSlug: character.slug, family: family.id, variant,
          clothing, equipmentPreset, affect, phase, targetAsset, targetFile: targetFileFor(targetAsset),
          status: generated ? 'generated_v4' : 'missing_generate', exactLegacyAsset: null, legacyCandidate,
        });
      }
    }
  }
}

for (const characterId of devices.characters) {
  const character = characterById.get(characterId);
  for (const device of devices.devices) for (const configuration of device.configurations) {
    const optional = devices.migration.optionalConfigurations.includes(`${device.id}/${configuration}`);
    const family = device.legacyFamily || device.id;
    for (const wardrobe of devices.wardrobes) for (const phase of devices.phases) for (const affect of devices.affectsByPhase[phase]) {
      const targetAsset = devices.assetConvention
        .replace('$character', character.slug).replace('$device', device.id).replace('$configuration', configuration)
        .replace('$wardrobe', wardrobe).replace('$affect', affect).replace('$phase', phase);
      const generated = indexed.has(targetAsset);
      const definition = expandedVariant(family, configuration);
      const legacyCandidate = definition && definition.wardrobes.includes(wardrobe) && definition.restraints.includes('machine')
        && (definition.phases || expanded.axes.phases).includes(phase) && (expanded.affectsByPhase[phase] || []).includes(affect)
        ? `/character-images/interactions-expanded/${character.slug}/${family}/${configuration}/${wardrobe}__machine__${affect}__${phase}.png`
        : null;
      rows.push({
        matrix: 'device', priority: optional ? 'P10' : 'P9', characterId, character: character.name,
        characterSlug: character.slug, device: device.id, configuration, clothing: wardrobe, affect, phase,
        targetAsset, targetFile: targetFileFor(targetAsset),
        status: generated ? 'generated_v4' : 'missing_generate', exactLegacyAsset: null,
        legacyCandidate: legacyCandidate && indexed.has(legacyCandidate) ? legacyCandidate : null,
        optional
      });
    }
  }
}

const summaryGroup = (keyFn, source = rows) => Object.fromEntries([...new Set(source.map(keyFn))].sort().map(key => {
  const group = source.filter(row => keyFn(row) === key);
  return [key, {
    total: group.length,
    generatedV4: group.filter(row => row.status === 'generated_v4').length,
    exactLegacyCovered: group.filter(row => row.status === 'covered_by_exact_legacy').length,
    missingGenerate: group.filter(row => row.status === 'missing_generate').length,
    withLegacyCandidate: group.filter(row => row.status === 'missing_generate' && row.legacyCandidate).length
  }];
}));

const summary = {
  version: 4,
  generatedAt: new Date().toISOString(),
  outputRoots: {
    calibrationAvatar: 'public/character-images/calibration-v4',
    calibrationInteraction: 'public/character-images/calibration-interactions-v4',
    device: 'public/character-images/devices-v4'
  },
  characterAppearance: Object.fromEntries(calibration.characters.map(characterId => {
    const character = characterById.get(characterId);
    return [character.slug, { characterId, name: character.name, appearanceTags: character.appearanceTags }];
  })),
  totals: {
    rows: rows.length,
    generatedV4: rows.filter(row => row.status === 'generated_v4').length,
    exactLegacyCovered: rows.filter(row => row.status === 'covered_by_exact_legacy').length,
    missingGenerate: rows.filter(row => row.status === 'missing_generate').length,
    withLegacyCandidate: rows.filter(row => row.status === 'missing_generate' && row.legacyCandidate).length
  },
  byMatrix: summaryGroup(row => row.matrix),
  byPriority: summaryGroup(row => row.priority),
  byCharacter: summaryGroup(row => row.characterSlug),
  byEquipmentPreset: summaryGroup(row => row.equipmentPreset || 'device-defined', rows.filter(row => row.matrix !== 'device'))
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'visual-generation-v4-checklist.json'), `${JSON.stringify(rows, null, 2)}\n`);
const missingRows = rows.filter(row => row.status === 'missing_generate');
fs.writeFileSync(path.join(outputDir, 'visual-generation-v4-missing.json'), `${JSON.stringify(missingRows, null, 2)}\n`);
const columns = [
  'matrix', 'priority', 'characterId', 'character', 'characterSlug', 'pose', 'family', 'variant',
  'device', 'configuration', 'clothing', 'equipmentPreset', 'affect', 'phase', 'status',
  'targetAsset', 'targetFile', 'exactLegacyAsset', 'legacyCandidate', 'optional'
];
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [columns.join(','), ...rows.map(row => columns.map(column => quote(row[column])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'visual-generation-v4-checklist.csv'), `${csv}\n`);
const missingCsv = [columns.join(','), ...missingRows.map(row => columns.map(column => quote(row[column])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'visual-generation-v4-missing.csv'), `${missingCsv}\n`);
fs.writeFileSync(path.join(outputDir, 'visual-generation-v4-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
