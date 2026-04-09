const fs = require('fs');
const file = 'src/orchestration/characterGenerator/tagDefinitions.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /return \{\s*world: \[\],\s*faction: \[\],\s*origin: \[\],\s*event: \[\],\s*trait: \[\]\s*\};/,
    `return {
        world: [],
        faction: [],
        origin: [],
        persona: [],
        physical: [],
        psychological: [],
        event: [],
        trait: []
    };`
);

code = code.replace(
    /world: new Map\(\),\s*faction: new Map\(\),\s*origin: new Map\(\),\s*event: new Map\(\),\s*trait: new Map\(\)/,
    `world: new Map(),
        faction: new Map(),
        origin: new Map(),
        persona: new Map(),
        physical: new Map(),
        psychological: new Map(),
        event: new Map(),
        trait: new Map()`
);

fs.writeFileSync(file, code);
