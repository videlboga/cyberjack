// src/utils/logExplainers.ts
export function explainPromptLog(entry: any): string {
    try {
        const subj = entry.forSubject || entry.subjectId || (entry.prompt && entry.prompt.subjectId) || '';
        const scene = entry.sceneId || (entry.prompt && entry.prompt.sceneId) || '';
        const prompt = entry.prompt || entry;
        const sys = (prompt.systemPrompt && String(prompt.systemPrompt)) || (prompt.narratorPrompt && String(prompt.narratorPrompt?.stateText)) || '';
        const short = sys.replace(/\s+/g, ' ').trim().slice(0, 240);
        const recent = (prompt.recentEvents && Array.isArray(prompt.recentEvents)) ? prompt.recentEvents.slice(-3).map((r:any)=>r.interpretation||r.type||JSON.stringify(r)).join('; ') : '';
        return `Тик для субъекта ${subj} в сцене ${scene}. Краткий системный промпт: "${short}${sys.length>240? '…' : ''}". Последние события: ${recent || 'нет заметных событий'}.`;
    } catch (e) {
        return 'Не удалось сформировать пояснение промпта.';
    }
}

export function explainOrchestratorDecision(entry: any): string {
    try {
        const tick = entry.tickId || entry.tick || '';
        const scene = entry.sceneId || '';
        const subject = entry.subjectId || '';
        const decs = entry.decisions || [];
        if (!decs.length) return `Оркестратор на тике ${tick} (сцена ${scene}) не выявил действий для субъекта ${subject}.`;
        const parts = decs.map((d:any) => {
            const mech = d.mechanicalAction ? ` действие:${d.mechanicalAction.actionId||d.mechanicalAction.action||''} цель:${d.mechanicalAction.targetId||d.mechanicalAction.target||''}` : '';
            const reason = d.reason ? ` причина: ${d.reason}` : '';
            return `${d.actorId || 'actor'} — ${d.kind || 'unknown'}${reason}${mech}`;
        });
        return `Оркестратор на тике ${tick} (сцена ${scene}) решил: ` + parts.join('; ');
    } catch (e) {
        return 'Не удалось сформировать пояснение оркестратора.';
    }
}

export function explainEngineState(entry: any): string {
    try {
        const tick = entry.tickId || '';
        const subj = entry.subjectId || '';
        const diffs = entry.diffs || entry.delta || {};
        const parts: string[] = [];
        if (diffs.core) {
            for (const k of Object.keys(diffs.core)) {
                const b = diffs.core[k].before;
                const a = diffs.core[k].after;
                parts.push(`core.${k}: ${String(b)} → ${String(a)}`);
            }
        }
        if (diffs.point) {
            for (const k of Object.keys(diffs.point)) {
                const b = diffs.point[k].before;
                const a = diffs.point[k].after;
                parts.push(`point.${k}: ${String(b)} → ${String(a)}`);
            }
        }
        const diag = entry.diagnostics ? ` Диагностика: ${entry.diagnostics.actionSummary || entry.diagnostics.reactionSummary || ''}` : '';
        return `Субъект ${subj}, тик ${tick}. Изменения состояния: ${parts.length ? parts.join('; ') : 'без изменений'}.${diag}`;
    } catch (e) {
        return 'Не удалось сформировать пояснение изменений состояния.';
    }
}

export default { explainPromptLog, explainOrchestratorDecision, explainEngineState };
