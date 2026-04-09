
const SERVER_URL = 'http://localhost:3000/api/tick';
const PLAYER_ID = 'PL-1';
const SUBJECT_ID = 'S-GEN-1';
const SCENE_ID = 'lab';

async function runAutoSimulation(turns: number) {
    console.log(`=== STARTING PROACTIVE NPC SIMULATION (${turns} TURNS) ===\n`);

    for (let i = 0; i < turns; i++) {
        console.log(`\n\x1b[36m--- TICK ${i + 1} ---\x1b[0m`);
        console.log(`\x1b[33m[Time passes]:\x1b[0m Player waits, giving initiative to NPC.`);

        const payload = {
            subjectId: SUBJECT_ID,
            pointId: "general",
            presetId: "wait",
            actionId: "wait",
            playerId: PLAYER_ID,
            sceneId: SCENE_ID,
            textMessage: ""
        };

        try {
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.error) {
                console.error(`Status Error:`, data.error);
                continue;
            }

            const narrator = data.narratorReaction;
            let charSpeech = data.reply;
            if (typeof charSpeech === 'object' && charSpeech !== null) {
                charSpeech = charSpeech.speech || JSON.stringify(charSpeech);
            }
            
            if (narrator) console.log(`\n\x1b[90m[Narrator]: ${narrator}\x1b[0m`);
            
            if (data.actorReplies && data.actorReplies.length > 0) {
                data.actorReplies.forEach((r: any) => {
                    const isProactive = r.kind === 'proactive';
                    const color = isProactive ? '\x1b[35m' : '\x1b[34m';
                    console.log(`\n${color}[${r.actorId} (${r.kind})]:\x1b[0m "${r.speech}"`);
                    if (r.tone && isProactive) console.log(`  \x1b[90m[Motiv]: ${r.tone}\x1b[0m`);
                });
            } else if (charSpeech) {
               console.log(`\n\x1b[34m[${SUBJECT_ID} (reactive)]:\x1b[0m "${charSpeech}"`);
            }
            
            const open = data.state?.openness;
            const att = data.state?.attitude;
            const plasticity = data.state?.plasticity;
            console.log(`\n[State Update]: Openness: ${open?.toFixed(2)}, Attitude: ${att?.toFixed(2)}, Plasticity: ${plasticity?.toFixed(2)}`);

        } catch (error) {
            console.error('Simulation step failed:', error);
        }

        if (i < turns - 1) {
            await new Promise(r => setTimeout(r, 4500));
        }
    }
    
    console.log(`\n=== SIMULATION COMPLETE ===`);
}

runAutoSimulation(7);
