import { db } from '../../src/infrastructure/db.js';

console.log("Создание персонажей и отношений...");

const subjects = [
    { id: 'S-01', name: 'Синтетик (Нейтраль/Пластика)', attitude: 50 },
    { id: 'S-02', name: 'Синтетик (Импульсив/Гиперчувствительная)', attitude: 40 }
];

const insertCharacterStmt = db.prepare('INSERT INTO characters (id, name, kind, subject_id, player_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, kind = excluded.kind');

db.transaction(() => {
    for (const subject of subjects) {
        insertCharacterStmt.run(subject.id, subject.name, 'subject', subject.id, null);
    }
    insertCharacterStmt.run('PL-1', 'Калибратор', 'player', null, 'PL-1');

    const npcCharacters = [
        { id: 'OBS-01', name: 'Наблюдатель Continuum Archive' },
        { id: 'VEIL-01', name: 'Связной Veil' }
    ];
    for (const npc of npcCharacters) {
        insertCharacterStmt.run(npc.id, npc.name, 'npc', null, null);
    }
})();

console.log("Настройка отношений...");
const relationStmt = db.prepare(`
    INSERT INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(from_id, to_id) DO UPDATE SET 
        knows = excluded.knows, present = excluded.present, can_interact = excluded.can_interact, attitude = excluded.attitude
`);

type RelationOptions = { knows?: boolean; present?: boolean; canInteract?: boolean; attitude?: number };

const addRelation = (fromId: string, toId: string, opts: RelationOptions = {}) => {
    relationStmt.run(
        fromId,
        toId,
        opts.knows === false ? 0 : 1,
        opts.present === false ? 0 : 1,
        opts.canInteract === false ? 0 : 1,
        opts.attitude ?? 50,
        opts.attitude ?? 50
    );
};

db.transaction(() => {
    for (const subject of subjects) {
        addRelation(subject.id, 'PL-1', { attitude: subject.attitude });
        addRelation('PL-1', subject.id, { attitude: 55 });
    }

    addRelation('S-01', 'S-02', { present: false, canInteract: false, attitude: 45 });
    addRelation('S-02', 'S-01', { present: false, canInteract: false, attitude: 40 });

    const awarenessPairs: Array<[string, string, RelationOptions]> = [
        ['S-01', 'OBS-01', { present: false, canInteract: false, attitude: 35 }],
        ['OBS-01', 'S-01', { present: false, canInteract: false, attitude: 60 }],
        ['PL-1', 'OBS-01', { attitude: 60 }],
        ['OBS-01', 'PL-1', { attitude: 65 }],
        ['S-02', 'VEIL-01', { present: false, canInteract: false, attitude: 30 }],
        ['VEIL-01', 'S-02', { present: false, canInteract: false, attitude: 55 }],
        ['PL-1', 'VEIL-01', { attitude: 45 }],
        ['VEIL-01', 'PL-1', { attitude: 50 }]
    ];
    for (const [fromId, toId, options] of awarenessPairs) {
        addRelation(fromId, toId, options);
    }
})();

console.log("Распределение персонажей по сценам...");
const assignSceneStmt = db.prepare(`
    INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(scene_id, character_id) DO UPDATE SET
        role = excluded.role, can_act = excluded.can_act, presence_state = excluded.presence_state
`);

const updateLocationStmt = db.prepare('UPDATE characters SET current_scene_id = ? WHERE id = ?');

const placeCharacter = (sceneId: string, characterId: string, role = 'participant', canAct = true, presenceState = 'present') => {
    assignSceneStmt.run(sceneId, characterId, role, canAct ? 1 : 0, presenceState);
    updateLocationStmt.run(sceneId, characterId);
};

db.transaction(() => {
    placeCharacter('lab', 'S-01', 'subject', true);
    placeCharacter('lab', 'PL-1', 'calibrator', true);
    placeCharacter('lab', 'OBS-01', 'observer', false);

    placeCharacter('lab_recovery', 'S-02', 'subject', true);
    placeCharacter('lab_recovery', 'VEIL-01', 'handler', false);
})();

console.log("Персонажи и отношения успешно обновлены!");
