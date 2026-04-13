const fs = require('fs');
const file = 'src/api/controllers/stateController.ts';
let code = fs.readFileSync(file, 'utf-8');

code = code.replace(
    /categories: preset\?\.categories \|\| \['physical'\],\s*tags: preset\?\.tags \|\| \[\]\s*\};/g,
    `categories: preset?.categories || ['physical'],
                    tags: preset?.tags || [],
                    type: preset?.type || 'physical',
                    requiresItem: preset?.requiresItem || null
                };`
);

fs.writeFileSync(file, code);
