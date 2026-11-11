import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'src/infrastructure/data/visual/interaction-visual-matrix.json');
const basePath = path.join(root, 'src/infrastructure/data/visual/character-image-matrix.json');
const actionsPath = path.join(root, 'src/infrastructure/data/presets/actions.json');
const itemsPath = path.join(root, 'src/infrastructure/data/presets/items.json');
const outputDir = path.join(root, 'docs/visual-assets');

const matrix = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const actions = JSON.parse(fs.readFileSync(actionsPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const phaseIds = new Set(matrix.phases.map((phase) => phase.id));
const actionIds = new Set(actions.map((action) => action.id));
const itemIds = new Set(items.map((item) => item.id));
const characterById = new Map(base.characters.map((character) => [character.id, character]));
const errors = [];

if (matrix.model !== 'sparse-interaction-overrides') errors.push('matrix.model must be sparse-interaction-overrides');
if (new Set(matrix.families.map((family) => family.id)).size !== matrix.families.length) errors.push('family ids must be unique');

for (const characterId of matrix.characters) {
  if (!characterById.has(characterId)) errors.push(`unknown character: ${characterId}`);
}

for (const family of matrix.families) {
  if (!family.variants?.length) errors.push(`${family.id}: variants are required`);
  if (new Set(family.variants.map((variant) => variant.id)).size !== family.variants.length) errors.push(`${family.id}: variant ids must be unique`);
  for (const variant of family.variants || []) {
    for (const phase of variant.phases || []) {
      if (!phaseIds.has(phase)) errors.push(`${family.id}.${variant.id}: unknown phase ${phase}`);
    }
  }
  for (const actionId of family.mechanics?.existingActionIds || []) {
    if (!actionIds.has(actionId)) errors.push(`${family.id}: existing action not found: ${actionId}`);
  }
  for (const itemId of family.mechanics?.existingItemIds || []) {
    if (!itemIds.has(itemId)) errors.push(`${family.id}: existing item not found: ${itemId}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const assets = [];
for (const characterId of matrix.characters) {
  const character = characterById.get(characterId);
  for (const family of matrix.families) {
    for (const variant of family.variants) {
      for (const phase of variant.phases) {
        assets.push({
          characterId,
          character: character.name,
          family: family.id,
          variant: variant.id,
          phase,
          coverage: family.coverage,
          optional: Boolean(variant.optional),
          relativePath: matrix.assetConvention
            .replace('$character', character.slug)
            .replace('$family', family.id)
            .replace('$variant', variant.id)
            .replace('$phase', phase),
        });
      }
    }
  }
}

fs.writeFileSync(path.join(outputDir, 'interaction-visual-checklist.json'), `${JSON.stringify(assets, null, 2)}\n`);
const mechanics = matrix.families.map((family) => ({
  family: family.id,
  coverage: family.coverage,
  existingActionIds: family.mechanics?.existingActionIds || [],
  plannedActionIds: family.mechanics?.plannedActionIds || [],
  existingItemIds: family.mechanics?.existingItemIds || [],
  plannedItemIds: family.mechanics?.plannedItemIds || [],
}));
fs.writeFileSync(path.join(outputDir, 'interaction-mechanics-map.json'), `${JSON.stringify(mechanics, null, 2)}\n`);

const summary = {
  version: matrix.version,
  model: matrix.model,
  families: matrix.families.length,
  variants: matrix.families.reduce((sum, family) => sum + family.variants.length, 0),
  assetsPerCharacter: assets.length / matrix.characters.length,
  totalPlannedAssets: assets.length,
  existingActionsLinked: mechanics.flatMap((entry) => entry.existingActionIds).length,
  plannedActions: mechanics.flatMap((entry) => entry.plannedActionIds).length,
  existingItemsLinked: mechanics.flatMap((entry) => entry.existingItemIds).length,
  plannedItems: mechanics.flatMap((entry) => entry.plannedItemIds).length,
};
fs.writeFileSync(path.join(outputDir, 'interaction-visual-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(summary);
