import { contractRepo } from '../infrastructure/contractRepo';
import { subjectRepo, presetRepo, characterItemsRepo, itemRepo, activeContextsRepo } from '../infrastructure/repositories';
import { evaluateAssetContract } from '../scenario/evaluateAssetContract';
import { parseVerbalInputWithLLM } from '../adapters/llmAdapter';

// ─── Нарративное описание состояния ──────────────────────────────────────────

interface ConditionProgress {
    type: string;
    key?: string;
    operator: string;
    value: number;
    current: number | boolean;
    met: boolean;
    label: string;
}

export function buildStateDescription(subjectId: string): string {
    const core = subjectRepo.get(subjectId);
    if (!core) return 'Актив не найден.';

    const att = Math.round(core.attitude);
    const sens = Math.round(core.sensitivity);
    const cap = Math.round(core.capacity);
    const opn = Math.round(core.openness);
    const plas = Math.round(core.plasticity);
    const tens = Math.round(core.tension);

    const parts: string[] = [];

    if (att >= 85) parts.push('безоговорочно преданна и покорна');
    else if (att >= 65) parts.push('доверяет и подчиняется с готовностью');
    else if (att >= 45) parts.push('нейтральна, но не сопротивляется');
    else if (att >= 25) parts.push('не доверяет, сопротивляется воле');
    else parts.push('враждебна и отторгает любые воздействия');

    if (sens >= 80) parts.push('нервы обнажены до предела');
    else if (sens >= 60) parts.push('очень чувствительна');
    else if (sens >= 40) parts.push('нормально воспринимает стимулы');
    else parts.push('чувства притуплены');

    if (cap < 20) parts.push('почти истощена, на грани срыва');
    else if (cap < 40) parts.push('истощается, силы на исходе');
    else if (cap >= 70) parts.push('полностью собрана и устойчива');

    if (opn >= 85) parts.push('абсолютно открыта новому опыту');
    else if (opn >= 60) parts.push('принимает новые воздействия');
    else if (opn < 25) parts.push('замкнулась в себе');

    if (tens >= 90) parts.push('на грани разрядки');
    else if (tens >= 70) parts.push('сильно напряжена');
    else if (tens >= 40) parts.push('накапливается напряжение');

    if (plas >= 80) parts.push('разум податлив к изменениям');

    return parts.join(', ') + '.';
}

// ─── Прогресс контракта ───────────────────────────────────────────────────────

export function getContractProgress(subjectId: string, playerId: string): {
    contractTitle: string | null;
    contractDescription: string | null;
    conditions: ConditionProgress[];
    metAll: boolean;
} | null {
    const accepted = contractRepo.listForPlayer(playerId);
    const active = accepted.find(c => c.state === 'accepted');
    if (!active) return null;

    const core = subjectRepo.get(subjectId);
    if (!core) return null;

    const evaluation = evaluateAssetContract(active, core, {});
    const conditions: ConditionProgress[] = active.conditions.map((cond: any) => {
        let current: any = undefined;
        let label = '';
        if (cond.type === 'attitude') {
            current = Math.round(core.attitude);
            label = 'Покорность';
        } else if (cond.type === 'custom' && cond.key) {
            current = Math.round((core as any)[cond.key]);
            const labels: Record<string, string> = {
                sensitivity: 'Чувствительность',
                capacity: 'Выносливость',
                openness: 'Открытость',
                plasticity: 'Пластичность'
            };
            label = labels[cond.key] || cond.key;
        } else if (cond.type === 'flag' || cond.type === 'trait') {
            current = core.flags?.includes(cond.key || '') ? true : false;
            label = `Трейт: ${cond.key}`;
        }
        return {
            type: cond.type,
            key: cond.key,
            operator: cond.operator,
            value: cond.value,
            current,
            met: current !== undefined ? compareOp(current, cond.operator ?? '==', cond.value) : false,
            label
        };
    });

    return {
        contractTitle: active.title,
        contractDescription: active.description,
        conditions,
        metAll: evaluation.metRequirements
    };
}

// ─── Действие с эффектом ────────────────────────────────────────────────────

interface ActionEffect {
    id: string;
    label: string;
    valence: number;     // -1..1 (нормализованный)
    intensity: number;   // 0..1
    contact: number;     // 0..1
    sharpness: number;   // 0..1
    effect: string;      // человекочитаемое описание эффекта
}

function buildActionEffectList(subjectId: string): string {
    const actions = presetRepo.getAllActionPresets()
        .filter(a => a.type !== 'system' && a.type !== 'wait' && a.type !== 'condition')
        .filter(a => !a.contextConfig || a.type === 'pose');

    // Get active contexts on the subject
    const activeContextIds = activeContextsRepo.getAllForSubject(subjectId).map(c => c.actionId);

    return actions.map(a => {
        const v = a.vector || {};
        const val = (v.valence ?? 0);
        const int = (v.intensity ?? 0);
        const con = (v.contact ?? 0);
        const shp = (v.sharpness ?? 0);

        const effects: string[] = [];
        if (val > 0.3) effects.push('удовольствие↑, покорность↑, открытость↑');
        else if (val > 0) effects.push('лёгкое удовольствие, покорность чуть↑');
        else if (val < -0.5) effects.push('дискомфорт↑, покорность↓, выносливость↓');
        else if (val < 0) effects.push('дискомфорт, покорность↓');

        if (shp > 0.7) effects.push('перегрузка↑');
        if (con > 0.5) effects.push('контакт высокий');

        const reqItem = (a as any).requiresItem;
        if (reqItem) effects.push(`требует предмет: ${reqItem}`);

        // Check requireContexts
        const reqCtx = (a as any).vector?.requireContexts || (a as any).requireContexts;
        if (reqCtx && Array.isArray(reqCtx) && reqCtx.length > 0) {
            const missing = reqCtx.filter((ctx: string) => !activeContextIds.includes(ctx));
            if (missing.length > 0) {
                effects.push(`НЕДОСТУПНО (требует установленный контекст: ${missing.join(', ')})`);
            } else {
                effects.push('контекст выполнен');
            }
        }

        return `- "${a.id}": ${a.label} — ${effects.join(', ') || 'нейтрально'}`;
    }).join('\n');
}

// ─── LLM-генерация чипов ──────────────────────────────────────────────────────

export interface SuggestedChip {
    text: string;           // естественная фраза для чипа
    actionId?: string;      // ID действия (если механическое)
    pointId?: string;       // точка воздействия
    type: 'action' | 'verbal' | 'wait' | 'context';
    speech?: string;        // для verbal — что калибратор говорит (в кавычках)
    description?: string;   // RP-описание для *...* формата (без звёздочек)
}

export async function generateSuggestedChips(
    subjectId: string,
    playerId: string,
    recentEvents: string,
    sceneContext: string
): Promise<SuggestedChip[]> {
    const core = subjectRepo.get(subjectId);
    if (!core) return [];

    const stateDesc = buildStateDescription(subjectId);
    const contractProgress = getContractProgress(subjectId, playerId);

    // Действия с описанием их эффекта
    const actionEffects = buildActionEffectList(subjectId);

    // Инвентарь
    const inventory = characterItemsRepo.listFor(playerId);
    const inventoryStr = inventory.length
        ? inventory.map(i => {
            const info = itemRepo.get(i.itemId);
            return `- "${i.itemId}": ${info?.name || i.itemId}`;
        }).join('\n')
        : 'Инвентарь пуст.';

    // Прогресс контракта + что нужно
    let contractStr = 'Нет активного контракта.';
    let strategyHint = '';
    if (contractProgress) {
        const condStr = contractProgress.conditions.map(c =>
            `- ${c.label}: текущее=${c.current}, нужно ${c.operator} ${c.value} → ${c.met ? '✓ выполнено' : '✗ НЕ выполнено'}`
        ).join('\n');

        // Стратегия: что нужно сделать
        const unmet = contractProgress.conditions.filter(c => !c.met);
        if (contractProgress.metAll) {
            strategyHint = 'Все условия контракта выполнены. Актив готов к сдаче.';
        } else if (unmet.length > 0) {
            const hints: string[] = [];
            for (const c of unmet) {
                if (c.type === 'attitude' && c.operator === '>') {
                    hints.push(`Покорность ${c.current}/${c.value} — нужны приятные воздействия (поглаживания, похвала, поцелуи) для роста покорности`);
                }
                if (c.type === 'custom' && c.key === 'sensitivity' && c.operator === '>') {
                    hints.push(`Чувствительность ${c.current}/${c.value} — нужны воздействия повышающие чувствительность (повторяющиеся прикосновения, стимуляция)`);
                }
                if (c.type === 'custom' && c.key === 'capacity' && c.operator === '<') {
                    hints.push(`Выносливость ${c.current}/${c.value} — нужны жёсткие воздействия (удары, боль) для снижения выносливости`);
                }
                if (c.type === 'custom' && c.key === 'openness' && c.operator === '>') {
                    hints.push(`Открытость ${c.current}/${c.value} — нужны приятные воздействия для роста открытости`);
                }
                if (c.type === 'custom' && c.key === 'plasticity' && c.operator === '>') {
                    hints.push(`Пластичность ${c.current}/${c.value} — нужны новые/неожиданные воздействия для роста пластичности`);
                }
            }
            strategyHint = hints.join('; ');
        }

        contractStr = `Контракт: ${contractProgress.contractTitle}\nОписание: ${contractProgress.contractDescription}\nУсловия:\n${condStr}`;
    }

    const messages: any[] = [
        {
            role: 'system',
            content: `Ты — генератор подсказок для калибратора на станции Омникрон.
Калибратор готовит актив (человека) для сдачи по контракту фракции.

Состояние актива: ${stateDesc}

${contractStr}

Стратегия: ${strategyHint || 'Нет активного контракта — свободная калибровка.'}

Последние события: ${recentEvents || 'Нет.'}

Доступные действия и их эффект:
${actionEffects}

Инвентарь: ${inventoryStr}

Сгенерируй 3-4 чипа — конкретные действия которые калибратор может сделать прямо сейчас.

ПРАВИЛА:
1. text — естественная фраза что делает калибратор ("Погладить по щеке", "Сказать: хорошая девочка", "Подождать")
2. type "action" — физическое действие, обязательно actionId
3. type "verbal" — слова калибратора, поле speech = что именно сказать (без звёздочек, без описаний): "хорошая девочка", "расскажи мне всё"
4. type "wait" — подождать, без actionId
5. description — для action: RP-действие в звёздочках ("глажу по щеке"), для verbal: НЕ ЗАПОЛНЯТЬ
6. Чипы должны вести к цели контракта. Если нужно повысить покорность — приятные действия. Если снизить выносливость — жёсткие.
7. Если актив истощён (capacity < 30) — предложи подождать.
8. Не предлагай действия требующие предметы если инвентарь пуст.
9. Не предлагай действия помеченные "НЕДОСТУПНО" — у них не выполнены условия (нет нужного контекста/предмета).
10. speech для verbal — это прямая речь, короткая, естественная. НЕ техническое описание.

Примеры правильных чипов:
{"text": "Погладить по щеке", "actionId": "gentle_stroke", "pointId": "face", "type": "action", "description": "глажу по щеке"}
{"text": "Сказать: хорошая девочка", "type": "verbal", "speech": "хорошая девочка"}
{"text": "Подождать", "type": "wait"}
{"text": "Ударить по щеке", "actionId": "slap", "pointId": "face", "type": "action", "description": "шлёпаю по щеке"}

Ответь ТОЛЬКО валидным JSON массивом.`
        },
        { role: 'user', content: 'Сгенерируй чипы для следующего хода.' }
    ];

    try {
        const { parsed } = await parseVerbalInputWithLLM(messages);
        if (Array.isArray(parsed)) {
            return parsed.map((chip: any) => ({
                text: chip.text || '',
                actionId: chip.actionId || undefined,
                pointId: chip.pointId || undefined,
                type: chip.type || 'action',
                speech: chip.speech || undefined,
                description: chip.description || undefined
            })).filter((c: SuggestedChip) => c.text.length > 0);
        }
        return [];
    } catch (e: any) {
        console.error('[SuggestedChips] LLM generation failed:', e.message);
        return [];
    }
}

function compareOp(actual: any, operator: string, target: any): boolean {
    switch (operator) {
        case '>': return actual > target;
        case '<': return actual < target;
        case '>=': return actual >= target;
        case '<=': return actual <= target;
        case '==': return actual == target;
        case '!=': return actual != target;
        default: return actual === target;
    }
}