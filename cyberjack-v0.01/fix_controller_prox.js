const fs = require('fs');
let code = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');

// The block to remove:
/*
        // 1. Proximity Validation Constraints
        if (!textMessage && (req.body.presetId || req.body.actionId)) {
            const actionPresetId = req.body.presetId || req.body.actionId;
            const actionPreset = presetRepo.getActionPreset(actionPresetId);
            
            if (actionPreset && (actionPreset.type === 'physical' || actionPreset.contact > 0.3)) {
                const presentChars = sceneCharacterRepo.list(tickSceneId);
                const subjSceneChar = presentChars.find(sc => sc.character.subjectId === subjectId || sc.character.id === subjectId);
                const playerSceneChar = presentChars.find(sc => sc.character.playerId === playerId || sc.character.id === playerId);
                if (subjSceneChar && playerSceneChar && subjSceneChar.slotId && playerSceneChar.slotId && subjSceneChar.slotId !== playerSceneChar.slotId) {
                    return res.status(400).json({ success: false, error: 'Слишком далеко для физического воздействия. Сначала подойдите в нужную зону.' });
                }
            }
        }
*/
const pattern = /\/\/ 1\. Proximity Validation Constraints[\s\S]*?\}\n        \}\n/g;
code = code.replace(pattern, '');
fs.writeFileSync('src/api/controllers/tickController.ts', code);
