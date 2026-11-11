import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'src/infrastructure/data/visual/interaction-visual-matrix-expanded.json');
const sparseSource = path.join(root, 'src/infrastructure/data/visual/interaction-visual-matrix.json');
const baseSource = path.join(root, 'src/infrastructure/data/visual/character-image-matrix.json');
const outputDir = path.join(root, 'docs/visual-assets');
const matrix = JSON.parse(fs.readFileSync(source, 'utf8'));
const sparse = JSON.parse(fs.readFileSync(sparseSource, 'utf8'));
const base = JSON.parse(fs.readFileSync(baseSource, 'utf8'));

const ids = list => new Set(list.map(entry => typeof entry === 'string' ? entry : entry.id));
const wardrobeIds = ids(matrix.axes.wardrobes);
const restraintIds = ids(matrix.axes.restraints);
const affectIds = ids(matrix.axes.affects);
const phaseIds = ids(matrix.axes.phases);
const characterById = new Map(base.characters.map(character => [character.id, character]));
const sparseFamilyById = new Map(sparse.families.map(family => [family.id, family]));
const errors = [];
const rows = [];

for (const characterId of matrix.characters) {
  const character = characterById.get(characterId);
  if (!character) { errors.push(`unknown character ${characterId}`); continue; }
  for (const family of matrix.families) {
    const sparseFamily = sparseFamilyById.get(family.id);
    if (!sparseFamily) { errors.push(`unknown family ${family.id}`); continue; }
    const sparseVariants = ids(sparseFamily.variants);
    for (const variant of family.variants) {
      if (!sparseVariants.has(variant.id)) errors.push(`${family.id}: unknown variant ${variant.id}`);
      const phases = variant.phases || matrix.axes.phases;
      for (const wardrobe of variant.wardrobes) if (!wardrobeIds.has(wardrobe)) errors.push(`${family.id}.${variant.id}: unknown wardrobe ${wardrobe}`);
      for (const restraint of variant.restraints) if (!restraintIds.has(restraint)) errors.push(`${family.id}.${variant.id}: unknown restraint ${restraint}`);
      for (const phase of phases) {
        if (!phaseIds.has(phase)) { errors.push(`${family.id}.${variant.id}: unknown phase ${phase}`); continue; }
        const affects = matrix.affectsByPhase[phase] || [];
        for (const affect of affects) {
          if (!affectIds.has(affect)) { errors.push(`${family.id}.${variant.id}: unknown affect ${affect}`); continue; }
          for (const wardrobe of variant.wardrobes) for (const restraint of variant.restraints) {
            const relativePath = matrix.assetConvention
              .replace('$character', character.slug).replace('$family', family.id).replace('$variant', variant.id)
              .replace('$wardrobe', wardrobe).replace('$restraint', restraint).replace('$affect', affect).replace('$phase', phase);
            rows.push({ characterId, character: character.name, family: family.id, variant: variant.id, wardrobe, restraint, affect, phase, optional: Boolean(variant.optional), relativePath });
          }
        }
      }
    }
  }
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'interaction-visual-expanded-checklist.json'), `${JSON.stringify(rows, null, 2)}\n`);
const csvColumns = ['characterId', 'character', 'family', 'variant', 'wardrobe', 'restraint', 'affect', 'phase', 'optional', 'relativePath'];
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [csvColumns.join(','), ...rows.map(row => csvColumns.map(column => csvCell(row[column])).join(','))].join('\n');
fs.writeFileSync(path.join(outputDir, 'interaction-visual-expanded-checklist.csv'), `${csv}\n`);
const byFamily = matrix.families.map(family => ({
  family: family.id,
  combinationsPerCharacter: rows.filter(row => row.characterId === matrix.characters[0] && row.family === family.id).length,
  totalAssets: rows.filter(row => row.family === family.id).length
}));
const summary = {
  version: matrix.version,
  model: matrix.model,
  characters: matrix.characters.length,
  families: matrix.families.length,
  combinationsPerCharacter: rows.length / matrix.characters.length,
  totalPlannedAssets: rows.length,
  sparseFallbackAssets: sparse.families.reduce((sum, family) => sum + family.variants.reduce((n, variant) => n + variant.phases.length, 0), 0) * matrix.characters.length,
  byFamily
};
fs.writeFileSync(path.join(outputDir, 'interaction-visual-expanded-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
