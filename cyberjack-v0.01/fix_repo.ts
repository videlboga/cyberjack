import fs from 'fs';

function replaceVars(file) {
    if (!fs.existsSync(file)) return;
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/playerRepo/g, 'resourceRepo');
    text = text.replace(/PlayerState/g, 'ResourceState');
    text = text.replace(/ensurePlayer/g, 'ensureCharacter');
    text = text.replace(/state\.player\b/g, 'state.resources');
    text = text.replace(/player: PlayerState/g, 'resources: ResourceState');
    fs.writeFileSync(file, text);
}

replaceVars('src/api/controllers/playerController.ts');
replaceVars('src/api/controllers/stateController.ts');
replaceVars('src/api/controllers/tickController.ts');
replaceVars('src/orchestration/sceneOrchestrator.ts');
replaceVars('src/orchestration/loadTickState.ts');
replaceVars('src/infrastructure/repositories.ts');
replaceVars('src/orchestration/runGameTick.ts');
replaceVars('src/scenario/checkActionAccess.ts');
replaceVars('src/domain/types.ts');
