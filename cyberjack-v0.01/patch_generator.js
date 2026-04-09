const fs = require('fs');
const file = 'src/orchestration/characterGenerator/generator.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /const DEFAULT_LEVEL_COUNTS: Record<LoreLevel, number> = \{([\s\S]*?)\};/,
    `const DEFAULT_LEVEL_COUNTS: Record<LoreLevel, number> = {
    world: Math.max(CORE_WORLD_TARGET, CORE_WORLD_TAGS.length),
    faction: 2,
    origin: 2,
    persona: 2,
    physical: 1,
    psychological: 1,
    event: 2,
    trait: Math.max(CORE_TRAIT_TARGET + 1, 2)
};`
);

code = code.replace(
    /world: \[\],\s*faction: \[\],\s*origin: \[\],\s*event: \[\],\s*trait: \[\]/,
    `world: [],
        faction: [],
        origin: [],
        persona: [],
        physical: [],
        psychological: [],
        event: [],
        trait: []`
);

fs.writeFileSync(file, code);
