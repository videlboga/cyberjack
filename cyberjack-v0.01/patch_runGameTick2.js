const fs = require('fs');
let code = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');
const oldStr = `    const bgUpdate = require('../workers/backgroundRelationUpdate');
    setTimeout(() => {
        bgUpdate.backgroundRelationUpdate(
            payload.subjectId,
            payload.playerId,
            payload.presetId,
            engineOutput.result?.narrative || 'Взаимодействие',
            engineOutput.delta?.core?.attitude || 0
        );
    }, 100);`;
const newStr = `    // bgUpdate async
    setTimeout(() => {
        import('../workers/backgroundRelationUpdate').then(m => {
            m.backgroundRelationUpdate(
                payload.subjectId,
                payload.playerId,
                payload.presetId,
                payload.presetId,
                engineOutput.delta?.core?.attitude || 0
            );
        }).catch(console.error);
    }, 100);`;
code = code.replace(oldStr, newStr);
fs.writeFileSync('src/orchestration/runGameTick.ts', code);
