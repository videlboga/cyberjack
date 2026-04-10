const fs = require('fs');
const file = 'src/orchestration/sceneOrchestrator.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `                        presetId: decision.mechanicalAction.actionId,
                        textMessage: structuredReply.speech
                    });
                } catch (err) {`;

const replacement = `                        presetId: decision.mechanicalAction.actionId,
                        textMessage: structuredReply.speech
                    });
                    const actionLabel = presetRepo.getActionPreset(decision.mechanicalAction.actionId)?.label || decision.mechanicalAction.actionId;
                    const actorName = subjectRepo.get(decision.actorId)?.name || decision.actorId;
                    const tgtId = decision.mechanicalAction.targetId || subjectId;
                    const targetName = subjectRepo.get(tgtId)?.name || tgtId;
                    const pointLabel = presetRepo.getPointPreset(decision.mechanicalAction.pointId)?.label || decision.mechanicalAction.pointId;
                    const notice = \`*(Сцена: \${actorName} применяет \${actionLabel} к \${targetName} (\${pointLabel}))*\`;
                    
                    if (tgtId !== decision.actorId) {
                        chatMemoryRepo.append(tgtId, 'user', notice);
                    }
                    chatMemoryRepo.append(decision.actorId, 'user', notice);

                } catch (err) {`;

code = code.replace(target, replacement);

fs.writeFileSync(file, code);
