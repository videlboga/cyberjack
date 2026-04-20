

async function sendCommand(textMessage: string) {
    console.log(`\n--- SENDING COMMAND: "${textMessage}" ---`);
    try {
        const payload = {
            playerId: 'PL-1',
            subjectId: 'S-01',
            sceneId: 'lab',
            actionId: 'verbal_pressure',
            textMessage: textMessage
        };

        const response = await fetch('http://localhost:3000/api/tick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json();
        const bundle = data.bundle;
        
        if (bundle?.metadata?.addedContextNotes && bundle.metadata.addedContextNotes.length > 0) {
            console.log(`[Narratives from Engine]:`);
            bundle.metadata.addedContextNotes.forEach((n: string) => console.log(`  - ${n}`));
        } else {
            console.log(`[No immediate narratives returned]`);
        }
    } catch (err: any) {
        console.error("Fetch error:", err.message);
    }
}

async function runAll() {
    const commands = [
        // Kissing by displayed name and by inflected form
        "поцелуй Калибратор",
        "поцелуй Калибратора",
        // By explicit id
        "поцелуй PL-1",
        // Self-targeting
        "поцелуй меня",
        // Target another subject by their visible name
        "поцелуй Эли",
        // Move requests targeted at another character (by name and id)
        "подойди к Калибратор",
        "подойди к PL-1",
        // Action with anatomical point
        "поцелуй в губы Калибратор",
        // A non-sexual physical action to test other action presets
        "ударь PL-1",
        // Previous general tests
        "на колени!",
        "подойди ко мне"
    ];

    for (const cmd of commands) {
        await sendCommand(cmd);
    }
}

runAll();
