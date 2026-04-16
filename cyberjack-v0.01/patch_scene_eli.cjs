const Database = require('better-sqlite3');
const db = new Database('cyberjack.sqlite', { verbose: console.log });

const sceneId = 'eli-chamber';
const description = 'Изолятор Эли. Холодное помещение с металлическими стенами. Разделено на первичный шлюз и основную зону изоляции.';

const slots = [
    { id: 'sector_airlock', name: 'Шлюз', capacity: 2, tags: ['control', 'observation'] },
    { id: 'sector_isolation', name: 'Изолятор', capacity: 2, tags: ['core', 'restraint'] }
];

const availableActions = [
    "gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke",
    "deep_massage","licking","firm_grip","light_bite","hard_bite","pinch",
    "scratching","slap","hard_slap","needle_prick","belt_strike",
    "whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse",
    "hair_pull","spit","breath_blow","verbal_pressure","stare",
    "close_inspection","feint_strike","pose_kneeling","restraint_cuffs"
];

console.log('Inserting scene...');
db.prepare(`INSERT OR REPLACE INTO scenes (id, available_actions, description, slots) VALUES (?, ?, ?, ?)`).run(
    sceneId,
    JSON.stringify(availableActions),
    description,
    JSON.stringify(slots)
);

const sceneLayout = {
    bounds: { width: 1000, height: 650 },
    nodes: [
        { id: 'sector_airlock', label: 'Шлюз', x: 300, y: 320, type: 'sector' },
        { id: 'sector_isolation', label: 'Изолятор', x: 700, y: 320, type: 'sector' }
    ],
    edges: [
        { from: 'sector_airlock', to: 'sector_isolation', type: 'door' }
    ]
};

console.log('Inserting layout...');
db.prepare(`INSERT OR REPLACE INTO scene_layouts (scene_id, layout_json) VALUES (?, ?)`).run(
    sceneId,
    JSON.stringify(sceneLayout)
);

console.log('Placing Eli in isolation...');
const updateCharacterLocationStmt = db.prepare(`UPDATE characters SET current_scene_id = ? WHERE id = ?`);
const upsertSceneCharacterStmt = db.prepare(`INSERT OR REPLACE INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id) VALUES (?, ?, ?, ?, ?, ?)`);

// Eli in Isolation
upsertSceneCharacterStmt.run(sceneId, 'S-01', 'asset', 1, 'present', 'sector_isolation');
updateCharacterLocationStmt.run(sceneId, 'S-01');

// Someone else? Calibrator in airlock maybe, let's put C-Gamma there
upsertSceneCharacterStmt.run(sceneId, 'C-Gamma', 'calibrator', 1, 'present', 'sector_airlock');
updateCharacterLocationStmt.run(sceneId, 'C-Gamma');

console.log('Done!');
