import { db } from './src/infrastructure/db';

db.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM event_logs;
    DELETE FROM active_contexts;
    DELETE FROM scene_characters;
    DELETE FROM scenes;
    DELETE FROM subject_point_states;
    DELETE FROM characters;
    DELETE FROM character_relations;
    DELETE FROM subjects;
    DELETE FROM players;
    DELETE FROM action_presets;
    PRAGMA foreign_keys = ON;
`);

db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'Test Subject', 60, 50, 40, 50, 50, 60, 50, 40, 50, 50);

db.prepare(`
    INSERT OR REPLACE INTO characters (id, name, kind, subject_id, current_scene_id)
    VALUES (?, ?, 'subject', ?, 'lab')
`).run('S-01', 'Test Subject', 'S-01');

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'hands', 40, 50, 0, 0, 40, 50);

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'body', 70, 50, 0, 0, 70, 50);

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'general', 55, 50, 0, 0, 55, 50);

db.prepare(`
    INSERT INTO players (id, resources)
    VALUES (?, ?)
`).run('PL-1', JSON.stringify({}));

db.prepare(`
    INSERT INTO scenes (id, available_actions)
    VALUES (?, ?)
`).run('lab', JSON.stringify(['soft_contact', 'sharp_impact', 'verbal_pressure']));

db.prepare(`
    INSERT INTO action_presets (id, label, values_json)
    VALUES (?, ?, ?)
`).run('soft_contact', 'Мягкий контакт', JSON.stringify({
    intensity: 0.3,
    valence: 0.7,
    contact: 0.8,
    sharpness: 0.1,
    novelty: 0.2
}));

db.prepare(`
    INSERT INTO action_presets (id, label, values_json)
    VALUES (?, ?, ?)
`).run('sharp_impact', 'Резкое воздействие', JSON.stringify({
    intensity: 0.8,
    valence: 0.2,
    contact: 0.9,
    sharpness: 0.9,
    novelty: 0.6
}));

db.prepare(`
    INSERT INTO action_presets (id, label, values_json)
    VALUES (?, ?, ?)
`).run('verbal_pressure', 'Словесное давление', JSON.stringify({
    intensity: 0.5,
    valence: 0.3,
    contact: 0.1,
    sharpness: 0.5,
    novelty: 0.3
}));

db.prepare(`
    INSERT OR REPLACE INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-02', 'Наблюдатель', 45, 55, 45, 40, 45, 45, 55, 45, 40, 45);

db.prepare(`
    INSERT OR REPLACE INTO characters (id, name, kind, subject_id, current_scene_id)
    VALUES (?, ?, 'subject', ?, 'lab')
`).run('S-02', 'Наблюдатель', 'S-02');

db.prepare(`
    INSERT OR REPLACE INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, baseline_attitude)
    VALUES (?, ?, 1, 1, 1, ?, ?)
`).run('S-01', 'S-02', 55, 50);

db.prepare(`
    INSERT OR REPLACE INTO character_relations (from_id, to_id, knows, present, can_interact, attitude, baseline_attitude)
    VALUES (?, ?, 1, 1, 1, ?, ?)
`).run('S-02', 'S-01', 40, 45);

db.prepare(`
    INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state)
    VALUES (?, ?, 'participant', 1, 'present')
`).run('lab', 'S-02');

console.log("Database seeded for milestone UI");
