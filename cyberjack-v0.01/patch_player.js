const fs = require('fs');
const file = 'src/api/controllers/playerController.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    "import { ResourceState } from '../../domain/types';",
    "import { ResourceState } from '../../domain/types';\nimport { db } from '../../infrastructure/db';"
);

code = code.replace(
    "return { id: src.id, resources: flatResources };",
    `const inventoryRows = db.prepare(\`
        SELECT ci.item_id as id, i.name, i.type, i.description, ci.state, ci.charges
        FROM character_items ci
        JOIN items i ON ci.item_id = i.id
        WHERE ci.character_id = ?
    \`).all(src.id);
    
    return { id: src.id, resources: flatResources, inventory: inventoryRows };`
);

fs.writeFileSync(file, code);
