const fs = require('fs');

// Patch types.ts
let types = fs.readFileSync('src/orchestration/characterGenerator/types.ts', 'utf8');
if (!types.includes('coreModifiers?: Record<string, number>;')) {
    types = types.replace(
        "category?: string;\n}", 
        "category?: string;\n    coreModifiers?: Record<string, number>;\n    initialContexts?: string[];\n}"
    );
    fs.writeFileSync('src/orchestration/characterGenerator/types.ts', types);
}

// Patch tagDefinitions.ts
let tags = fs.readFileSync('src/orchestration/characterGenerator/tagDefinitions.ts', 'utf8');
if (!tags.includes('coreModifiers: raw.coreModifiers')) {
    tags = tags.replace(
        "category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : undefined",
        "category: typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : undefined,\n        coreModifiers: raw.coreModifiers,\n        initialContexts: Array.isArray(raw.initialContexts) ? raw.initialContexts : undefined"
    );
    fs.writeFileSync('src/orchestration/characterGenerator/tagDefinitions.ts', tags);
}
