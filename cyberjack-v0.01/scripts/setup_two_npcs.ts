import { subjectRepo, pointStateRepo, characterRelationRepo, sceneCharacterRepo, resourceRepo } from '../src/infrastructure/repositories';
import { db } from '../src/infrastructure/db';

function setupTwoNpcs() {
    console.log('Setting up two NPCs for proactive simulation...');

    const npc1Id = 'S-NPC-1';
    const npc1Name = 'Элинор';
    const npc2Id = 'S-NPC-2';
    const npc2Name = 'Джейсон';

    db.prepare(`INSERT OR IGNORE INTO characters (id, name, kind, subject_id) VALUES (?, ?, 'subject', ?)`).run(npc1Id, npc1Name, npc1Id);
    db.prepare(`INSERT OR IGNORE INTO characters (id, name, kind, subject_id) VALUES (?, ?, 'subject', ?)`).run(npc2Id, npc2Name, npc2Id);

    const npc1Profile = { prompt: "Ты - Элинор, любопытная и смелая исследовательница. Тебе очень нравится Джейсон, ты постоянно пытаешься привлечь его внимание или пообщаться с ним." };
    const npc2Profile = { prompt: "Ты - Джейсон, немного задумчивый инженер. Ты тайно влюблен в Элинор и рад каждой её инициативе, но иногда стесняешься сделать первый шаг." };

    db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(npc1Profile), npc1Id);
    db.prepare('UPDATE characters SET profile_json = ? WHERE id = ?').run(JSON.stringify(npc2Profile), npc2Id);

    subjectRepo.save(npc1Id, npc1Name, { sensitivity: 60, capacity: 50, openness: 80, plasticity: 70, attitude: 60 });
    subjectRepo.save(npc2Id, npc2Name, { sensitivity: 50, capacity: 60, openness: 70, plasticity: 60, attitude: 60 });

    const points = ['systemic', 'slot_social', 'head', 'face', 'lips', 'neck', 'chest', 'back', 'left_arm', 'right_arm'];
    for (const pt of points) {
        pointStateRepo.save(npc1Id, pt, { localSensitivity: 50, localAttitude: 50 });
        pointStateRepo.save(npc2Id, pt, { localSensitivity: 50, localAttitude: 50 });
    }

    resourceRepo.save({ id: npc1Id, resources: { actionPoints: 9999, maxActionPoints: 100 } });
    resourceRepo.save({ id: npc2Id, resources: { actionPoints: 9999, maxActionPoints: 100 } });
    resourceRepo.save({ id: 'PL-1', resources: { credits: 0, authority: 0, timeBudget: 0, actionPoints: 1000, maxActionPoints: 1000 } });

    characterRelationRepo.ensure(npc1Id, npc2Id, { attitude: 90, openness: 100, plasticity: 100, knows: true, present: true, canInteract: true });
    characterRelationRepo.ensure(npc2Id, npc1Id, { attitude: 90, openness: 100, plasticity: 100, knows: true, present: true, canInteract: true });
    
    // They both should be neutral to Calibrator
    characterRelationRepo.ensure(npc1Id, 'PL-1', { attitude: 50, knows: true, present: true, canInteract: true });
    characterRelationRepo.ensure(npc2Id, 'PL-1', { attitude: 50, knows: true, present: true, canInteract: true });

    const sceneId = 'lab';
    sceneCharacterRepo.set(sceneId, npc1Id, { presenceState: 'present', canAct: true, slotId: 'slot_social' });
    sceneCharacterRepo.set(sceneId, npc2Id, { presenceState: 'present', canAct: true, slotId: 'slot_social' });
    
    // Ensure Calibrator is also present
    db.prepare(`INSERT OR IGNORE INTO characters (id, name, kind, player_id) VALUES ('PL-1', 'Калибратор', 'player', 'PL-1')`).run();
    sceneCharacterRepo.set(sceneId, 'PL-1', { presenceState: 'present', canAct: true, slotId: 'slot_console' });

    db.prepare('DELETE FROM active_contexts').run();
    db.prepare('DELETE FROM state_triggers').run();
    db.prepare('DELETE FROM chat_memory').run();
    db.prepare('DELETE FROM event_logs').run();

    console.log('Setup complete!');
}

setupTwoNpcs();
