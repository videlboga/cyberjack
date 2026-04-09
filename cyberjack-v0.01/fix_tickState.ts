import fs from 'fs';

let content = fs.readFileSync('src/orchestration/loadTickState.ts', 'utf8');
content = content.replace(/player: ResourceState/g, 'resources: ResourceState');
content = content.replace(/const player = resourceRepo\.get/g, 'const resources = resourceRepo.get');
content = content.replace(/if \(\!player\) throw new Error\(`Player \$\{playerId\} not found`\);/g, 'if (!resources) throw new Error(`Resources for ${playerId} not found`);');
content = content.replace(/player, scene/g, 'resources, scene');
fs.writeFileSync('src/orchestration/loadTickState.ts', content);

let stContent = fs.readFileSync('src/orchestration/saveTickState.ts', 'utf8');
stContent = stContent.replace(/ensurePlayer/g, 'ensureCharacter');
fs.writeFileSync('src/orchestration/saveTickState.ts', stContent);

let rtContent = fs.readFileSync('src/scenario/runScenarioStep.ts', 'utf8');
rtContent = rtContent.replace(/player:/g, 'resources:');
rtContent = rtContent.replace(/updatedPlayer/g, 'updatedResources');
fs.writeFileSync('src/scenario/runScenarioStep.ts', rtContent);

let atContent = fs.readFileSync('src/orchestration/runGameTick.ts', 'utf8');
atContent = atContent.replace(/state\.player/g, 'state.resources');
atContent = atContent.replace(/updatedPlayer/g, 'updatedResources');
fs.writeFileSync('src/orchestration/runGameTick.ts', atContent);

let apiContent = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');
apiContent = apiContent.replace(/player/g, 'resources');
fs.writeFileSync('src/api/controllers/tickController.ts', apiContent);
