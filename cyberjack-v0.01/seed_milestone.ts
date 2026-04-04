import { db } from './src/infrastructure/db';

db.exec('DELETE FROM subjects; DELETE FROM subject_point_states; DELETE FROM players; DELETE FROM scenes; DELETE FROM action_presets;');

db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'Test Subject', 60, 50, 40, 50, 50, 60, 50, 40, 50, 50);

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'hands', 40, 50, 0, 0, 40, 50);

db.prepare(`
    INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run('S-01', 'body', 70, 50, 0, 0, 70, 50);

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

console.log("Database seeded for milestone UI");
