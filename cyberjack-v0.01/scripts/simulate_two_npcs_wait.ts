import { runGameTick } from '../src/orchestration/runGameTick';

const TicksToSimulate = 7;

async function main() {
    console.log(`=== STARTING TWO NPCS SIMULATION (${TicksToSimulate} TURNS) ===\n`);

    for (let i = 1; i <= TicksToSimulate; i++) {
        console.log(`--- TICK ${i} ---`);
        console.log(`[Time passes]: Player waits, giving initiative to NPCs.\n`);

        try {
            const resp = await fetch('http://localhost:3000/api/tick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId: 'S-NPC-1', // Target of wait, but orchestrator uses present chars
                    playerId: 'PL-1',
                    actionId: 'wait',
                    labelOverride: 'ожидает',
                    pointId: 'systemic',
                    sceneId: 'lab'
                })
            });

            if (!resp.ok) {
                console.log(`Status Error: ${resp.status} ${resp.statusText}`);
                const text = await resp.text();
                console.log(`Response text: ${text}`);
                continue;
            }

            const data = await resp.json();

            // Print actor replies via proactive logic
            if (data.actorReplies && data.actorReplies.length > 0) {
                for (const rep of data.actorReplies) {
                    console.log(`[${rep.actorId} (${rep.kind})]: "${rep.speech}"`);
                    if (rep.tone) {
                        console.log(`[Motiv]: ${rep.tone}\n`);
                    }
                }
            } else {
                console.log(`[No NPC replies]\n`);
            }

        } catch (e: any) {
            console.error(`Error during tick ${i}: ${e.message}`);
        }
    }

    console.log(`=== SIMULATION COMPLETE ===`);
}

main();
