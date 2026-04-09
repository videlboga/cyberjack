import fs from 'fs';
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

content = content.replace(/const _playerRepo = require\("\.\.\/infrastructure\/repositories"\)\.playerRepo;/g, 'const _playerRepo = playerRepo;');
content = content.replace(/const presetRepo = require\('\.\.\/infrastructure\/repositories'\)\.presetRepo;/g, "import { presetRepo } from '../infrastructure/repositories';");
content = content.replace(/const activeContextsRepo2 = require\('\.\.\/infrastructure\/repositories'\)\.activeContextsRepo;/g, "const activeContextsRepo2 = activeContextsRepo;");
content = content.replace(/const eventLogRepo = require\('\.\.\/infrastructure\/repositories'\)\.eventLogRepo;/g, "import { eventLogRepo } from '../infrastructure/repositories';");

// Clean duplicates of imports
let lines = content.split('\n');
let uniqueLines = [];
let seenImports = new Set();

for (let line of lines) {
    if (line.match(/^import \{.*?\} from '..\/infrastructure\/repositories';/)) {
        // Just let them be, or combine? It's fine to have multiple imports in TS for the same file, but we can do a quick check.
    }
    // Actually, simple replace is fine. 
}
content = content.replace(/const _playerRepo = playerRepo;\s*_playerRepo\.save/g, 'playerRepo.save');
fs.writeFileSync('src/orchestration/runGameTick.ts', content);
