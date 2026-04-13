const fs = require('fs');

let file = fs.readFileSync('src/prompts/buildPromptPayload.ts', 'utf8');

const regex = /const relationsSection = relations\.length[\s\S]*?(?=return `\$\{name\}: \$\{knowledge\})/m;

const replacement = `const relationsSection = relations.length
        ? \`[Персонажи сцены]\\n\${relations
            .map(rel => {
                const targetIdToFind = rel.target?.id || rel.toId;
                const theirSceneChar = sceneCharactersData.find(sc => sc.character.id === targetIdToFind || sc.character.subjectId === rel.toId);
                const isNearby = mySceneChar && theirSceneChar && mySceneChar.slotId === theirSceneChar.slotId;
                const presenceToken = rel.present
                    ? (isNearby ? 'этот человек рядом, в одной зоне' : 'человек в этой же комнате, но в отдалении')
                    : 'его сейчас нет поблизости';

                const name = rel.target?.name || rel.toId;
                
                // Углубляем "знакомство"
                const familiarityLabel = (rel.familiarityLevel && rel.familiarityLevel > 0.7) 
                    ? 'я хорошо его знаю и помню его повадки' 
                    : (rel.familiarityLevel && rel.familiarityLevel > 0.3)
                    ? 'мы немного знакомы'
                    : rel.knows ? 'мы общались, но я мало что о нем знаю' : 'я почти не представляю, чего от него ждать';
                    
                const access = rel.canInteract
                    ? 'у меня есть прямой доступ к нему'
                    : 'нас разделяют физические барьеры';
                    
                const tone = describeAttitude(rel.attitude);
                const opennessLabel = (rel.openness && rel.openness > 70) 
                    ? 'я готов(а) ему открыться' 
                    : (rel.openness && rel.openness < 30) 
                    ? 'я совершенно закрыт(а) для него' 
                    : 'я держу нейтральную дистанцию';

                let result = \`\${name}: \${familiarityLabel}, \${presenceToken}, \${access}. По ощущениям \${tone}. В плане общения: \${opennessLabel}.\`;
                
                if (rel.generalOpinion) {
                    result += \` Мое мнение о нем: \${rel.generalOpinion}\`;
                }
                if (rel.recentMemories && rel.recentMemories.length > 0) {
                    result += \` Я помню, что: \${rel.recentMemories.join('; ')}.\`;
                }

                `;

file = file.replace(regex, replacement);

fs.writeFileSync('src/prompts/buildPromptPayload.ts', file);
