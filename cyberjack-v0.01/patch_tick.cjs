const fs = require('fs');
let file = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

const matchStr = `saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);`;

const newStr = `saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);

    // [Async] Background update relations
    const bgUpdate = require('../workers/backgroundRelationUpdate');
    setTimeout(() => {
        bgUpdate.backgroundRelationUpdate(
            payload.subjectId, 
            payload.playerId, 
            payload.presetId, 
            engineOutput.result?.narrative || 'Взаимодействие',
            engineOutput.delta?.core?.attitude || 0
        );
    }, 100);`;

file = file.replace(matchStr, newStr);
fs.writeFileSync('src/orchestration/runGameTick.ts', file);
