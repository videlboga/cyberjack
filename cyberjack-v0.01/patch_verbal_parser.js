const fs = require('fs');

let code = fs.readFileSync('src/parser/verbalParser.ts', 'utf8');

// We will inject a dynamic query for context actions
code = code.replace(
  "export async function parseVerbalInput(text: string): Promise<ParsedVerbalAction> {",
  `import { presetRepo } from '../infrastructure/repositories';\n\nexport async function parseVerbalInput(text: string): Promise<ParsedVerbalAction> {`
);

const oldPrompt = `    const messages = [
        {
            role: 'system',
            content: \`Ты — классификатор семантических параметров речи в симуляторе. В симуляторе сейчас можно изменять позу (на колени, ложись, звездой).
ЕСЛИ пользователь явно приказывает сменить позу или состояние (например "Встань на колени", "Ложись", "Рогатка", "Звездой"), тогда помимо параметров добавь поле "intent": "change_pose" и поле "targetContext": со значением "pose_kneeling", "pose_lying" или "pose_spread_eagle".

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
        { role: 'user', content: text }
    ];`;

const newPrompt = `    const contextPresets = presetRepo.getAllActionPresets().filter((p: any) => p.contextConfig || p.removeContexts);
    const validContextsString = contextPresets.map((p: any) => \`"\${p.label}" -> ID: "\${p.id}"\`).join('\\n');

    const messages = [
        {
            role: 'system',
            content: \`Ты — классификатор семантических параметров речи в симуляторе.
Твоя задача — классифицировать пользовательскую фразу по параметрам (от 0.0 до 1.0, кроме valence: от -1.0 до 1.0) и определить цель воздействия (pointId).
В симуляторе есть специальные действия/контексты:
\${validContextsString}

ЕСЛИ текст пользователя является прямым приказом применить одно из этих состояний (например, "на колени!", "надень наручники", "сними это немедленно", "встань"), добавь в JSON поле "intent": "activate_context" и поле "targetContext" со значением соответствующего ID (например, "force_kneel", "apply_cuffs", "remove_cuffs" и т.д.).

Формат ответа JSON:
{
  "intent": "activate_context" | "none",
  "targetContext": "action_id",
  "intensity": 0.0-1.0,
  "valence": -1.0..1.0,
  "contact": 0.0-1.0,
  "sharpness": 0.0-1.0,
  "novelty": 0.5,
  "pointId": "general"
}

Ответь ТОЛЬКО валидным JSON.\`
        },
        { role: 'user', content: text }
    ];`;

code = code.replace(oldPrompt, newPrompt);

// Also replace the parsing logic
const oldLogic = `        if (parsed.intent === 'change_pose' && parsed.targetContext) {
            commandIntent = { type: 'change_pose', targetPoseId: parsed.targetContext };
        } else if (parsed.intent === 'change_context' && parsed.targetContext) {
            // alias just in case
            commandIntent = { type: 'change_pose', targetPoseId: parsed.targetContext };
        }`;

const newLogic = `        if (parsed.intent === 'activate_context' && parsed.targetContext) {
            commandIntent = { type: 'activate_context', targetContextId: parsed.targetContext };
        } else if ((parsed.intent === 'change_pose' || parsed.intent === 'change_context') && parsed.targetContext) {
            commandIntent = { type: 'activate_context', targetContextId: parsed.targetContext };
        }`;

code = code.replace(oldLogic, newLogic);

fs.writeFileSync('src/parser/verbalParser.ts', code);
