import fs from 'fs';
let content = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');

// The file is a mess, let's just rewrite the end of the `runGameTick` function carefully
// From `// 6. Save new state` down
let match = content.match(/(\/\/ 6\. Save new state[\s\S]*?)return\s+\{/);
if (match) {
    let replaced = match[1];
    // Remove all saveTickState and playerRepo.save
    replaced = replaced.replace(/saveTickState\(.*?\);/g, '');
    replaced = replaced.replace(/playerRepo\.save\(.*?\);/g, '');
    replaced = replaced.replace(/if\s*\(playerChanged\)\s*\{[\s\S]*?\}/g, '');
    replaced = replaced.replace(/if\s*\(state\.player\s*!==\s*stateBefore\.player\)\s*\{[\s\S]*?\}/g, '');

    // Now we append saveTickState at the end, right before return
    replaced += `\n    // 7. Save Atomically
    saveTickState(payload.subjectId, payload.pointId, payload.playerId, payload.presetId, compiledAction, engineOutput, tickId);
    
    // We already mutated state.player from scenarioResult, save it now that calculations are done
    if (scenarioResult.updatedPlayer !== state.player || true /* always save since scenarioResult might modify inner object */ ) {
        const _playerRepo = require('../infrastructure/repositories').playerRepo;
        _playerRepo.save(state.player);
    }
    
    `;
    
    content = content.replace(match[1], replaced);
    fs.writeFileSync('src/orchestration/runGameTick.ts', content);
    console.log("Fixed!");
}
