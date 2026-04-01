import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { activeConfig } from './config';

export interface EventRecord {
    id: number;
    timestamp: string;
    action_type: string;
    action_payload: string; // JSON
    result_payload: string; // JSON
}

export function buildRecentEventsSummary(events: EventRecord[]): string {
    const cfg = activeConfig.perception;

    if (!events || events.length === 0) {
        return cfg.noEvents;
    }

    const lines = [cfg.recentEventsTitle];

    const groupedEvents: any[] = [];
    let waitCount = 0;
    
    for (const event of events) {
        try {
            const payloadData = JSON.parse(event.action_payload);
            const presetId = payloadData.presetId;
            if (presetId === 'wait') {
                waitCount++;
                continue;
            }
            if (waitCount > 0) {
                groupedEvents.push({ isWait: true, count: waitCount, timestamp: event.timestamp });
                waitCount = 0;
            }
            groupedEvents.push({ isWait: false, event, payloadData });
        } catch (e) {
            groupedEvents.push({ isWait: false, event });
        }
    }
    if (waitCount > 0) {
        groupedEvents.push({ isWait: true, count: waitCount, timestamp: events[events.length-1].timestamp });
    }

    groupedEvents.forEach(item => {
        if (item.isWait) {
            const timeSpan = new Date(item.timestamp).toLocaleTimeString();
            lines.push(`- [${timeSpan}] Прошло время: ожидание/бездействие (${item.count} тиков). Активные факторы среды продолжали влиять на твое состояние.`);
            return;
        }

        const event = item.event;
        try {
            
        const payloadData = item.payloadData || JSON.parse(event.action_payload); 
        
        if (event.action_type === 'context_change' || payloadData.presetId === 'context_change') {
            const timeSpan = new Date(event.timestamp).toLocaleTimeString();
            lines.push(`- [${timeSpan}] Изменение среды/состояния: ${payloadData.actionLabel}`);
            return;
        }

        const action = payloadData.action; 
 
            const aLabel = payloadData.actionLabel || payloadData.presetId || "воздействие"; 
            const pLabel = payloadData.pointLabel || payloadData.pointId || "тело";
            
            const resultObj = JSON.parse(event.result_payload);

            const tickOutputMock = {
                result: resultObj,
                nextCore: resultObj.tickMeta?.inputs?.core || { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 }
            };
            
            const previousCore = resultObj.tickMeta?.inputs?.core || {
                sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50
            };

            const diagnostics = action ? buildDiagnostics(action, previousCore, tickOutputMock as any) : null;
            
            const timeSpan = new Date(event.timestamp).toLocaleTimeString();
            const actionSemantic = diagnostics ? diagnostics.actionSummary : "неизвестное воздействие";
            
            lines.push(`- [${timeSpan}] ${cfg.actionPrefix} "${aLabel}" на точку "${pLabel}" (оценивается тобой как: ${actionSemantic})`);
            
            if (diagnostics && diagnostics.reactionSummary !== "нейтральная реакция") {
                lines.push(`  ${cfg.reactionPrefix} ${diagnostics.reactionSummary}`);
            }
        } catch (err: any) {
            lines.push(`- [${event.timestamp}] (Ошибка памяти: ${err.message})`);
        }
    });

    return lines.join('\n');
}
