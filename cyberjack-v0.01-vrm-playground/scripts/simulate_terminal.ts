
const SERVER_URL = 'http://localhost:3000/api/tick';
const PLAYER_ID = 'PL-1';
const SUBJECT_ID = 'S-GEN-1';
const SCENE_ID = 'lab';

const ACTIONS = [
    { presetId: 'stare', pointId: 'face', textMessage: 'Я хочу рассмотреть каждый миллиметр твоего лица.' },
    { presetId: 'gentle_stroke', pointId: 'hand', textMessage: 'Расслабься, не нужно напрягаться.' },
    { presetId: 'verbal_pressure', pointId: 'face', textMessage: 'Почему ты не отвечаешь мне? Я хочу услышать правду.' },
    { presetId: 'light_kiss', pointId: 'face', textMessage: 'Молчать больше нет смысла.' },
    { presetId: 'close_inspection', pointId: 'torso', textMessage: 'Покажи, что ты скрываешь.' }
];

async function runSimulation(turns: number) {
    console.log(`=== STARTING TERMINAL SIMULATION (${turns} TURNS) ===\n`);

    for (let i = 0; i < turns; i++) {
        const action = ACTIONS[i % ACTIONS.length];
        console.log(`\n\x1b[36m--- TURN ${i + 1} ---\x1b[0m`);
        console.log(`\x1b[33m[Player Action]:\x1b[0m ${action.presetId} on \x1b[35m${action.pointId}\x1b[0m`);
        if (action.textMessage) console.log(`\x1b[32m[Player says]:\x1b[0m "${action.textMessage}"`);

        const payload = {
            subjectId: SUBJECT_ID,
            pointId: action.pointId,
            presetId: action.presetId,
            actionId: action.presetId,
            playerId: PLAYER_ID,
            sceneId: SCENE_ID,
            textMessage: action.textMessage
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
            // Handle reply format
            let charSpeech = data.reply;
            if (typeof charSpeech === 'object') {
                charSpeech = charSpeech.speech || JSON.stringify(charSpeech);
            }
            
            if (narrator) console.log(`\n\x1b[90m[Narrator]: ${narrator}\x1b[0m`);
            if (charSpeech) console.log(`\n\x1b[31m[${SUBJECT_ID} says]:\x1b[0m "${charSpeech}"`);
            
            // Extract state
            const ap = data.resources?.resources?.actionPoints;
            const open = data.state?.openness;
            const att = data.state?.attitude;
            const plasticity = data.state?.plasticity;
            console.log(`\n[State Update]: AP: ${ap}, Openness: ${open?.toFixed(2)}, Attitude: ${att?.toFixed(2)}, Plasticity: ${plasticity?.toFixed(2)}`);

        } catch (error) {
            console.error('Simulation step failed:', error);
        } // No wait if last turn
    }
    
    console.log(`\n=== SIMULATION COMPLETE ===`);
}

runSimulation(5);
