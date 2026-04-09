import fs from 'fs';
import path from 'path';

function replaceInFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replacements
    content = content.replace(/players/g, 'character_resources');
    content = content.replace(/playerRepo\b/g, 'resourceRepo');
    content = content.replace(/PlayerState\b/g, 'ResourceState');
    content = content.replace(/state\.player\b/g, 'state.resources');
    content = content.replace(/\bplayer: state\.resources\b/g, 'resources: state.resources'); // handle { player: state.player }
    content = content.replace(/nextPlayer\b/g, 'nextResources');
    content = content.replace(/updatedPlayer\b/g, 'updatedResources');
    content = content.replace(/characterRepo\.ensurePlayer/g, 'characterRepo.ensureCharacter');
    
    // In scenarios
    content = content.replace(/applyResourceCosts\((.*?player.*?)\)/g, 'applyResourceCosts($1)');
    
    fs.writeFileSync(filePath, content);
}

const filesToUpdate = [
    'src/infrastructure/db.ts',
    'src/infrastructure/seed.ts',
    'src/infrastructure/repositories.ts',
    'src/domain/types.ts',
    'src/orchestration/loadTickState.ts',
    'src/orchestration/runGameTick.ts',
    'src/scenario/checkActionAccess.ts',
    'src/scenario/applyResourceCosts.ts',
    'src/scenario/runScenarioStep.ts',
    'test/vertical.test.ts',
    'test/orchestration.test.ts',
    'src/api/controllers/tickController.ts'
];

for (const file of filesToUpdate) {
    if (fs.existsSync(file)) {
        replaceInFile(file);
        console.log(`Updated ${file}`);
    } else {
        console.log(`Not found: ${file}`);
    }
}
