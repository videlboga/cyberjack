import fs from 'fs';
let code = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');
if (!code.includes('incrementTicks')) {
    code = code.replace("import { eventQueries } from '../infrastructure/eventQueries';", "import { eventQueries } from '../infrastructure/eventQueries';\nimport { activeContextsRepo } from '../infrastructure/repositories';");
    code = code.replace('saveTickState(payload.subjectId, payload.pointId, payload.presetId, compiledAction, engineOutput);', 
        'saveTickState(payload.subjectId, payload.pointId, payload.presetId, compiledAction, engineOutput);\n\n    // 6.5 Increment context durations (Escalation / Decay)\n    activeContextsRepo.incrementTicks(payload.sceneId);');
    fs.writeFileSync('src/orchestration/runGameTick.ts', code);
}
