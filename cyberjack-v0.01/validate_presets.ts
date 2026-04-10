import fs from 'fs';
import { ActionPresetSchema, ItemPresetSchema, TraitPresetSchema } from './src/domain/schemas.js';

function validate() {
  let errors = 0;

  // 1. Read files
  const actions = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/actions.json', 'utf8'));
  const items = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/items.json', 'utf8'));
  const traits = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/traits.json', 'utf8'));

  const actionIds = new Set(actions.map((a: any) => a.id));
  const itemIds = new Set(items.map((i: any) => i.id));

  console.log(`Checking ${actions.length} actions, ${items.length} items, and ${traits.length} traits...`);

  // 2. Validate Items
  items.forEach((item: any, i: number) => {
    const result = ItemPresetSchema.safeParse(item);
    if (!result.success) {
      console.error(`Item [${item.id || 'idx ' + i}] Validation Failed:`, result.error.issues);
      errors++;
    }
  });

  // 3. Validate Traits
  traits.forEach((trait: any, i: number) => {
    const result = TraitPresetSchema.safeParse(trait);
    if (!result.success) {
      console.error(`Trait [${trait.id || 'idx ' + i}] Validation Failed:`, result.error.issues);
      errors++;
    }
  });

  // 4. Validate Actions & Cross-references
  actions.forEach((action: any, i: number) => {
    const result = ActionPresetSchema.safeParse(action);
    if (!result.success) {
      console.error(`Action [${action.id || 'idx ' + i}] Validation Failed:`, result.error.issues);
      errors++;
    } else {
      // Cross-referencing checks
      if (action.requiresItem && !itemIds.has(action.requiresItem)) {
        console.error(`Action [${action.id}] requiresItem "${action.requiresItem}", but it doesn't exist in items.json`);
        errors++;
      }
      
      if (action.requireContexts) {
        action.requireContexts.forEach((ctx: string) => {
          if (!actionIds.has(ctx)) {
            console.error(`Action [${action.id}] requireContexts "${ctx}", but action "${ctx}" doesn't exist.`);
            errors++;
          }
        });
      }

      if (action.removeContexts) {
        action.removeContexts.forEach((ctx: string) => {
          if (!actionIds.has(ctx)) {
            console.error(`Action [${action.id}] removeContexts "${ctx}", but action "${ctx}" doesn't exist.`);
            errors++;
          }
        });
      }
    }
  });

  if (errors > 0) {
    console.error(`\nValidation failed with ${errors} errors.`);
    process.exit(1);
  } else {
    console.log('\nAll presets are fully valid and cross-referenced correctly! ✨');
  }
}

validate();
