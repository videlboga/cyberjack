const fs = require('fs');

const path = 'src/orchestration/sceneOrchestrator.ts';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `const targetPoints = ['general', 'head', 'face', 'neck', 'chest', 'back', 'left_arm', 'right_arm', 'slot_social'];`;

const newStr = `const targetPointRecords = pointStateRepo.getAllForSubject(targetId);
                            const targetPoints = targetPointRecords.map(p => p.pointId);
                            if (targetPoints.length === 0) targetPoints.push('general');`;

code = code.replace(targetStr, newStr);

const originalTargetLogic = `const targetId = actorId === subjectId ? playerId : subjectId;
                    if (targetId) {`;

const newTargetLogic = `const possibleTargets = presentSubjectIds.filter(id => id !== actorId);
                    const targetId = possibleTargets.length > 0
                        ? possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
                        : (actorId === subjectId ? playerId : subjectId);
                    
                    if (targetId) {`;

code = code.replace(originalTargetLogic, newTargetLogic);

fs.writeFileSync(path, code);
console.log('patched');
