import fs from 'fs';
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

// First remove save block at the bottom
const bottomSaveBlock = `    // 7. Save Atomically
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);
    
    // We already mutated state.player from scenarioResult, save it now that calculations are done
    if (scenarioResult.updatedPlayer !== state.player || true /* always save since scenarioResult might modify inner object */ ) {
        playerRepo.save(state.player);
    }
    
`;

content = content.replace(bottomSaveBlock, '');

// Now insert it right before buildDiagnostics / buildPromptPayload
const buildBlock = `    // 6.5 Update context strain (Escalation / Decay)

    const diagnostics = buildDiagnostics(`;

content = content.replace(buildBlock, `    // 7. Save Atomically (before prompt building)
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);
    
    if (scenarioResult.updatedPlayer !== state.player || true) {
        playerRepo.save(state.player);
    }

${buildBlock}`);

fs.writeFileSync('src/orchestration/runGameTick.ts', content);
