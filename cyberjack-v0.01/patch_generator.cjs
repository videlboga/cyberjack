const fs = require('fs');
let code = fs.readFileSync('src/orchestration/characterGenerator/types.ts', 'utf8');
code = code.replace(
    'assetReasons?: string[];\n}',
    'assetReasons?: string[];\n    baseModifiers?: Record<string, number>;\n    initialContexts?: string[];\n}'
);
fs.writeFileSync('src/orchestration/characterGenerator/types.ts', code);

let gen = fs.readFileSync('src/orchestration/characterGenerator/generator.ts', 'utf8');
if (!gen.includes('const baseModifiers')) {
    let newGen = gen.replace(
        "return {\n        tags,",
        `const baseModifiers: Record<string, number> = {};
    const initialContexts: string[] = [];
    for (const t of tags) {
        if (t.coreModifiers) {
            for (const [k, v] of Object.entries(t.coreModifiers)) {
                baseModifiers[k] = (baseModifiers[k] || 0) + v;
            }
        }
        if (t.initialContexts) {
            initialContexts.push(...t.initialContexts);
        }
    }
    return {
        tags,
        baseModifiers,
        initialContexts,`
    );
    fs.writeFileSync('src/orchestration/characterGenerator/generator.ts', newGen);
}
