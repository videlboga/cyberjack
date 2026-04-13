export async function backgroundRelationUpdate(
    fromId: string, 
    toId: string, 
    actionLabel: string, 
    narrativeResult: string,
    attitudeDelta: number
) {
    try {
        const { characterRelationRepo } = require('../infrastructure/repositories');
        const relation = characterRelationRepo.get(fromId, toId);
        if (!relation) return;

        // Повышаем знакомство, если был контакт
        const familiarityDelta = 0.05 + (Math.abs(attitudeDelta) / 100);

        let newOpinion = relation.generalOpinion || '';
        let newMemory = actionLabel + ': ' + narrativeResult;

        // Fetch llm
        const { callLLM } = require('../services/llmClient');
        if (callLLM) {
            const prompt = `Обнови общее мнение о персонаже (от 1-го лица, одно предложение). 
Текущее мнение: "${relation.generalOpinion || 'Нет мнения'}". 
Событие: "${actionLabel}". Реакция: "${narrativeResult}". Изменилось отношение на: ${attitudeDelta}.
Опиши свое мнение коротко (например: "Кажется, он стал мягче", "Мне не нравится, что он так делает", "Он меня немного пугает", "Я к нему постепенно привыкаю"). Без кавычек.`;
            
            const req = {
                messages: [
                    { role: 'system', content: 'Ты - генератор кратких впечатлений персонажа.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 30,
                temperature: 0.7
            };
            const tempRes = await callLLM(req, 'gpt-3.5-turbo');
            if (tempRes) {
                newOpinion = tempRes.replace(/["\n]/g, '').trim();
            }
        }

        characterRelationRepo.updateSocialStats(fromId, toId, {
            familiarityDelta,
            generalOpinion: newOpinion,
            newMemory: actionLabel
        });
        console.log(`[Background] Relations ${fromId}->${toId} updated. Familiarity +${familiarityDelta.toFixed(3)}`);
    } catch (e) {
        console.error('[Background] Failed to update relations asynchronously:');
    }
}
