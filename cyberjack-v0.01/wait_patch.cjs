const fs = require('fs');
const file = 'src/orchestration/sceneOrchestrator.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `    const orchestration = orchestrateSceneActors(bundle);
    let narratorReaction: string | null = null;`;

const replacement = `    const orchestration = orchestrateSceneActors(bundle);

    if (actionId === 'wait') {
        const hasProactive = orchestration.actorDecisions.some(d => d.kind === 'proactive');
        if (!hasProactive) {
            orchestration.actorDecisions = [];
        } else {
            orchestration.actorDecisions = orchestration.actorDecisions.filter(d => d.kind === 'proactive');
        }
        if (orchestration.narrator) {
            orchestration.narrator.enabled = false;
        }
    }

    let narratorReaction: string | null = null;`;

code = code.replace("    const orchestration = orchestrateSceneActors(bundle);\n    let narratorReaction: string | null = null;", replacement);

fs.writeFileSync(file, code);
