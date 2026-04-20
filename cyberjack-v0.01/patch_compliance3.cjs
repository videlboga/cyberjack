const fs = require('fs');
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf-8');

// For context changes
let searchCtx = `if (currentCompliance >= requiredCompliance) {
                    // If there is a playerId (actor), mark them as initiator; otherwise default to subject`;

let replaceCtx = `if (currentCompliance >= requiredCompliance) {
                    let reason = (state.relation?.attitude > 70) ? "охотно поддаваясь влиянию" : "с неохотой подчиняясь программированию";
                    if (state.core.attitude < 30) reason = "вынужденно и унизительно для себя";
                    // If there is a playerId (actor), mark them as initiator; otherwise default to subject`;

content = content.replace(searchCtx, replaceCtx);

let searchCtxMsg = `const forcedNarrative = \`Выполнено действие: \${actionPreset.label}. Примени это состояние.\`;`;
let replaceCtxMsg = `const forcedNarrative = \`[Система]: Актив принимает состояние "\${actionPreset.label}", \${reason}. Примени это состояние.\`;`;
content = content.replace(searchCtxMsg, replaceCtxMsg);


// For move
let searchMove = `if (subjCharPresence.slotId !== finalSlotId) {
                            sceneCharacterRepo.set(payload.sceneId, subjCharPresence.character.id, { slotId: finalSlotId });
                            const moveNarrative = \`Выполнено действие: Персонаж перемещается в зону "\${targetLabel}".\`;`;

let replaceMove = `if (subjCharPresence.slotId !== finalSlotId) {
                            sceneCharacterRepo.set(payload.sceneId, subjCharPresence.character.id, { slotId: finalSlotId });
                            let reason = (state.relation?.attitude > 70) ? "с готовностью" : "с неохотой, подчиняясь приказу";
                            const moveNarrative = \`[Система]: Актив перемещается в зону "\${targetLabel}", \${reason}.\`;`;

content = content.replace(searchMove, replaceMove);


fs.writeFileSync('src/orchestration/runGameTick.ts', content);
