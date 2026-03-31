import { buildDiagnostics } from '../diagnostics/buildDiagnostics';

export interface EventRecord {
    id: number;
    timestamp: string;
    action_type: string;
    action_payload: string; // JSON
    result_payload: string; // JSON
}

/**
 * Преобразует последние логи действий в семантический текст
 * для подачи ИИ. ИИ узнает, что только что произошло в движке.
 */
export function buildRecentEventsSummary(events: EventRecord[]): string {
    if (!events || events.length === 0) {
        return "No recent interactions.";
    }

    const lines = ["[Recent System Events]"];
    
    events.forEach(event => {
        try {
            const action = JSON.parse(event.action_payload).action; 
            const resultObj = JSON.parse(event.result_payload); // В БД лежит output.result, не весь TickOutput!
            
            // Восстанавливаем Mock TickOutput для Diagnostics
            const tickOutputMock = {
                result: resultObj,
                nextCore: resultObj.tickMeta?.inputs?.core || { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 } // mock or previous
            };
            
            const previousCore = resultObj.tickMeta?.inputs?.core || {
                sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50
            };

            // Передаем правильные 3 аргумента (action, previousCore, TickOutput)
            const diagnostics = action ? buildDiagnostics(action, previousCore, tickOutputMock as any) : null;
            
            const timeSpan = new Date(event.timestamp).toLocaleTimeString();
            const actionSemantic = diagnostics ? diagnostics.actionSummary : "Unknown system action";
            
            lines.push(`- [${timeSpan}] The player performed an action: "${actionSemantic}"`);
            
            if (diagnostics && diagnostics.reactionSummary !== "neutral/mixed reaction") {
                lines.push(`  Internal result: ${diagnostics.reactionSummary}`);
            }
        } catch (err: any) {
            lines.push(`- [${event.timestamp}] Failed to parse event log. Error: ${err.message}`);
        }
    });

    return lines.join('\n');
}
