const fs = require('fs');
let code = fs.readFileSync('src/parser/verbalParser.ts', 'utf8');

const startIdx = code.indexOf('const messages = [');
const endIdx = code.indexOf(`{ role: 'user', content: text }`);

if (startIdx !== -1 && endIdx !== -1) {
  const newText = `const ctxList = presetRepo.getAllActionPresets()
        .filter(act => act.contextConfig)
        .map(act => \`- "\${act.id}": \${act.label}\`)
        .join('\\n');

    const messages = [
        {
            role: 'system',
            content: \`Ты — классификатор семантических параметров речи в симуляторе. В симуляторе сейчас можно изменять позу или применять состояние.
Текущий список доступных ID для контекстов/поз/скованности:
\${ctxList}

ЕСЛИ текст пользователя является прямым приказом применить одно из этих состояний (например, "на колени!", "надень наручники", "сними это немедленно", "встань"), добавь в JSON поле "intent": "activate_context" и поле "targetContext" со значением соответствующего ID контекста. ЕСЛИ требуют снять, используй intent  "deactivate_context" и соответствующий ID.
Твоя задача — классифицировать пользовательскую фразу по 5 параметрам (от 0.0 до 1.0, кроме valence: от -1.0 до 1.0) и определить цель воздействия (pointId).
{
  "intensity": 0.0-1.0,
  "valence": -1.0..1.0,
  "contact": 0.0-1.0,
  "sharpness": 0.0-1.0,
  "novelty": 0.5,
  "pointId": "general"
}

Ответь ТОЛЬКО валидным JSON.\`
        },
        `;
    code = code.substring(0, startIdx) + newText + code.substring(endIdx);
    fs.writeFileSync('src/parser/verbalParser.ts', code);
}
