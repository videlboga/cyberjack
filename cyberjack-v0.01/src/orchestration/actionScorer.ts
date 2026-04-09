import { 
    subjectRepo, 
    pointStateRepo, 
    characterRelationRepo, 
    sceneRepo, 
    presetRepo 
} from '../infrastructure/repositories';

interface PreferenceData {
    points?: Record<string, number>;
    actions?: Record<string, number>;
    contexts?: Record<string, number>;
}

export interface ActionScoreResult {
    actionId: string;
    pointId: string;
    score: number;
    details: {
        baseScore: number;
        preferenceBonus: number;
        barrierPenalty: number;
    };
}

export class ActionScorer {
    /**
     * Оценивает все доступные действия в сцене для конкретного актора и цели.
     * Возвращает отсортированный по убыванию привлекательности список действий.
     */
    static scoreAvailableActions(
        sceneId: string, 
        actorId: string, 
        targetId: string,
        targetPointIds: string[] // Список ID точек, доступных для взаимодействия
    ): ActionScoreResult[] {
        const scene = sceneRepo.get(sceneId);
        if (!scene) return [];

        const actor = subjectRepo.get(actorId);
        const target = subjectRepo.get(targetId);
        const relation = characterRelationRepo.get(actorId, targetId);

        if (!actor || !target || !relation) return [];

        const preferences: PreferenceData = actor.preferences 
            ? JSON.parse(actor.preferences) 
            : {};
            
        const results: ActionScoreResult[] = [];

        // Получаем стейты всех точек цели
        const pointStates: Record<string, any> = {};
        for (const pid of targetPointIds) {
            const state = pointStateRepo.get(targetId, pid);
            if (state) pointStates[pid] = state;
        }

        for (const actionId of scene.availableActions) {
            const preset = presetRepo.getActionPreset(actionId);
            if (!preset) continue;

            const actionPrefBonus = (preferences.actions?.[actionId] || 0) * 10;
            
            // Если действие имеет определенные тэги, мы можем их проверить
            let contextBonus = 0;
            if (preset.tags && preferences.contexts) {
                for (const tag of preset.tags) {
                    contextBonus += (preferences.contexts[tag] || 0) * 5;
                }
            }

            for (const pointId of targetPointIds) {
                const pState = pointStates[pointId];
                if (!pState) continue;

                // 1. Отношения и базовое желание взаимодействовать
                // attitude > 50 означает симпатию. 
                const attitudeDiff = relation.attitude - 50;
                
                // 2. Предпочтения актора к точке
                const pointPrefBonus = (preferences.points?.[pointId] || 0) * 15;

                // 3. Барьер интимности цели
                const pointOpenness = pState.localOpenness ?? 50;
                const actorOpennessLevel = relation.openness ?? 0;
                
                // Насколько сильно актор "пробивает" интимность точки
                // Если барьер высок (pointOpenness < actorOpennessLevel значит барьер пробит)
                // Чем меньше localOpenness, тем интимнее точка. Если actorOpenness < (100 - localOpenness), то есть штраф.
                // Формула: Цель дает доступ (localOpenness). Актор имеет право (relation.openness).
                // Упрощенно: Интимность барьера = 100 - localOpenness (если 10, то интимность 90).
                // Штраф, если relation.openness не покрывает интимность.
                const intimacyBarrier = 100 - pointOpenness; 
                let barrierPenalty = 0;
                if (actorOpennessLevel < intimacyBarrier) {
                    barrierPenalty = (actorOpennessLevel - intimacyBarrier); // Отрицательное число
                }

                // TODO: Учесть plasticity для мягких/жестких действий (для этого нужно знать агрессивность actionPreset)

                const baseScore = attitudeDiff;
                const preferenceBonus = actionPrefBonus + contextBonus + pointPrefBonus;

                const totalScore = baseScore + preferenceBonus + barrierPenalty;

                results.push({
                    actionId,
                    pointId,
                    score: totalScore,
                    details: {
                        baseScore,
                        preferenceBonus,
                        barrierPenalty
                    }
                });
            }
        }

        // Сортируем от наиболее желанных к наименее
        return results.sort((a, b) => b.score - a.score);
    }
}
