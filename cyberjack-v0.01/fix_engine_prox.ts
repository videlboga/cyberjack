import * as fs from 'fs';

const content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');
const replaced = content.replace(
`    // 2. Scenario layer: доступность действия и ресурсы
    if (!checkActionAccess(payload.presetId, state.scene, state.player)) {
        throw new Error(\`Action "\${payload.presetId}" is not available in scene "\${state.scene.id}".\`);
    }`,
`    // 2. Scenario layer: доступность действия, ресурсы, локация
    const validation = require('../scenario/checkActionAccess').validateAction(
        payload.presetId, state.scene, state.player, payload.subjectId, payload.playerId
    );
    if (!validation.allowed) {
        throw new Error(validation.errorReason || \`Action "\${payload.presetId}" blocked by scenario.\`);
    }`
);

fs.writeFileSync('src/orchestration/runGameTick.ts', replaced);
