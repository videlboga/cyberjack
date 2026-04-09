const fs = require('fs');

let content = fs.readFileSync('src/api/controllers/tickController.ts', 'utf8');

// Replace ST imports
content = content.replace(/import \{ sendToSillyTavern, sendNarratorDescription \} from '\.\.\/\.\.\/adapters\/sillyTavernAdapter';/g, "import { sendToLLM } from '../../adapters/llmAdapter';\nimport { buildUserPromptForCurrentTick } from '../../prompts/openRouterPromptBuilder';");

// Replace applyGeneratedContextToSillyTavern import
content = content.replace(/import \{ applyGeneratedContextToSillyTavern \} from '\.\.\/\.\.\/adapters\/sillyTavernManager';\n/g, "");

// In processWait
content = content.replace(/const waitMessage = \`\[Прошло времени: \$\{ticks\} тиков\. Ничего нового не произошло\. Ответь, только если хочешь что-то сказать в пустоту\.\]\`;[\s\S]*?stReply = stRes\.reply;/, `const waitMessage = \`[Прошло времени: \${ticks} тиков. Ничего нового не произошло. Ответь, только если хочешь что-то сказать в пустоту.]\`;
            const systemPrompt = lastBundle.prompt.systemPrompt;
            const fullPrompt = systemPrompt + "\\n\\n" + buildUserPromptForCurrentTick({ actorName: 'Среда', actionDescription: waitMessage });
            const stRes = await sendToLLM(fullPrompt);
            stReply = { speech: stRes.reply };`);
            
content = content.replace(/promptMessages = stRes\.sentMessages;[\s\S]*?if \(stReply && typeof stReply === 'object' && \(stReply as any\)\.speech\) \{/, `promptMessages = stRes.sentMessages;
            if (stReply.speech) {`);
            
content = content.replace(/assistantText: typeof stReply === 'object' \? stReply\.speech : ''/, `assistantText: stReply.speech`);            

// processTick
content = content.replace(/\/\/ 4\. SillyTavern Communication \(External Adapter\)[\s\S]*?const chatHistory = chatMemoryRepo\.getRecent[\s\S]*?\}\)\);/g, `// 4. LLM Generation`);

content = content.replace(/const narratorRes = await sendNarratorDescription\(promptPayload\.narratorPrompt\);[\s\S]*?narratorReaction = narratorRes\?\.reaction \|\| null;/, `const narratorRes = await sendToLLM(promptPayload.narratorPrompt.instructions);
                narratorReaction = narratorRes?.reply || null;`);

// inner loop of tick
content = content.replace(/const \{ reply, sentMessages \} = await sendToSillyTavern\([\s\S]*?\);[\s\S]*?const structuredReply =[\s\S]*?\{ speech: String\(reply \|\| ''\) \};\n/g, `
                    const actorNameText = actorName || 'Неизвестный';
                    const pointNameText = pointLabel || 'Тело';
                    
                    const acuteIntensity = bundle.output.result?.experiencedIntensity || 0;
                    let acuteSensation;
                    if (acuteIntensity > 70) {
                        acuteSensation = \`Острая вспышка перегрузки в области "\${pointNameText}" прошивает твой разум. Почти невыносимо.\`;
                    }
                    
                    const finalPromptStr = \`\${currentPayload.systemPrompt}\\n\\n\${buildUserPromptForCurrentTick({
                        actorName: actorNameText,
                        actionDescription: userMsgOverride || \`Применяет воздействие: \${actionLabel}\`,
                        acuteSensation
                    })}\`;

                    const { reply, sentMessages } = await sendToLLM(finalPromptStr);
                    const structuredReply = { speech: reply || '' };
`);

content = content.replace(/let userMsgOverride = autoUserMessage \|\| undefined;\n/g, `let userMsgOverride = autoUserMessage || undefined;\n                    let currentHistory: any; // unused\n`);

content = content.replace(/currentHistory = chatMemoryRepo\.getRecent[\s\S]*?\}\)\);/g, ``);

fs.writeFileSync('src/api/controllers/tickController.ts', content, 'utf8');
