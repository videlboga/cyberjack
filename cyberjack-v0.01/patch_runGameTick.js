const fs = require('fs');
let code = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');
code = code.replace(
`    // [Async] Background update relations
    const bgUpdate = require('../workers/backgroundRelationUpdate');
    setTimeout(() => {
        bgUpdate.backgroundRelationUpdate(
            payload.subjectId,
            payload.playerId,
            payload.presetId,
            engineOutput.result?.narrative || 'Взаимодействие',
            engineOutput.delta?.core?.attitude || 0
        );
    }, 100);`,
`    // [Async] Background update relations
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
    }, 100);`
);
fs.writeFileSync('src/orchestration/runGameTick.ts', code);
