import fs from 'fs';
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

content = content.replace(/require\('\.\.\/scenario\/checkActionAccess'\)\.validateAction/g, 'checkActionAccess.validateAction');

// Wait, the import says: import { checkActionAccess } from '../scenario/checkActionAccess';
// Let's change the import to import * as checkActionAccess from '../scenario/checkActionAccess';
content = content.replace(/import \{ checkActionAccess \} from '\.\.\/scenario\/checkActionAccess';/, "import * as checkActionAccess from '../scenario/checkActionAccess';");

// Also there are other dynamic requires that vitest complains about? Let's fix them too.
content = content.replace(/require\('\.\.\/infrastructure\/repositories'\)\.playerRepo/g, 'require("../infrastructure/repositories").playerRepo');
fs.writeFileSync('src/orchestration/runGameTick.ts', content);
