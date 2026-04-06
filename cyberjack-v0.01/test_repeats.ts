import { db } from './src/infrastructure/db.ts';
import fetch from 'node-fetch';

async function test() {
    console.log('Testing repeated actions via API...');
    
    // Pick an existing subject (assumes DB has one, e.g., ST subject)
    const subject = db.prepare('SELECT id FROM subjects LIMIT 1').get() as { id: string };
    if (!subject) {
        console.log('No subject found');
        return;
    }
    const subjectId = subject.id;
    console.log(`Using subject: ${subjectId}`);
    
    // Pick an action and point from domain
    const actionId = 'slap'; // Assuming 'slap' exists
    const pointId = 'leg';   // Assuming 'leg' exists

    // Send 3 repeated actions
    for (let i = 1; i <= 3; i++) {
        console.log(`Sending action ${i}...`);
        const res = await fetch('http://localhost:3000/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectId,
                actionId,
                pointId
            })
        });
        const data = await res.json();
        console.log(`Response ${i}:`, data.aiResponse?.reply);
    }
    
    // Check chat memory in DB
    console.log('\nChecking chat memory:');
    const logs = db.prepare('SELECT role, content FROM chat_memory WHERE subject_id = ? ORDER BY id DESC LIMIT 5').all(subjectId) as any[];
    for (const log of logs.reverse()) {
        console.log(`[${log.role}] ${log.content}`);
    }
}

test().catch(console.error);
