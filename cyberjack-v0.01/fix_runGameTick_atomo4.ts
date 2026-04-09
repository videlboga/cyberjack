import fs from 'fs';
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

// Replace top imports
content = content.replace(/import \{ activeContextsRepo, playerRepo, sceneRepo \} from '\.\.\/infrastructure\/repositories';/, 
"import { activeContextsRepo, playerRepo, sceneRepo, presetRepo, eventLogRepo } from '../infrastructure/repositories';");

// Remove block-level invalid imports
content = content.replace(/import \{ presetRepo \} from '\.\.\/infrastructure\/repositories';/g, '');
content = content.replace(/import \{ eventLogRepo \} from '\.\.\/infrastructure\/repositories';/g, '');

content = content.replace(/const _playerRepo = playerRepo;/g, '');

fs.writeFileSync('src/orchestration/runGameTick.ts', content);
