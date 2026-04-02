import fs from 'fs';

let content = fs.readFileSync('src/api/server.ts', 'utf8');

// The activeIds returned are now array of objects
content = content.replace(/const allActiveContexts = activeIds\.map\(aId => presetRepo\.getContextPreset\(aId\)\)\.filter\(Boolean\);/, 'const allActiveContexts = activeIds.map(a => presetRepo.getContextPreset(a.id)).filter(Boolean);');
content = content.replace(/for \(const aId of activeIds\) \{/g, 'for (const aObj of activeIds) {\n                    const aId = aObj.id;');

fs.writeFileSync('src/api/server.ts', content);
