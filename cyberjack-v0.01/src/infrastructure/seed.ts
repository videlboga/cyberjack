import { db } from './db';
import fs from 'fs';
import { getBaseHumanAnatomy } from '../domain/anatomy.js';
import { CharacterProfile } from '../domain/characterProfile.js';
import { CANON_LOCATIONS, CANON_PROFESSIONS } from '../domain/canon.js';
import { ensureAllStarterClothing } from './starterClothing.js';
import { characterRelationRepo } from './repositories.js';
import { reconcileAllCharacters } from '../scenario/characterState.js';
import { seedInterpretationTrees } from '../services/interpretationSeed.js';
import { loadActionPresets, upsertActionPresets } from './syncActionPresets.js';

console.log("Начинаем безопасное заполнение базы данных (без удаления существующих данных)...");

const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [
    {
        id: 'PL-1',
        name: 'Калибратор',
        state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 },
        profile: {
            base: { name: 'Калибратор', age: 30, gender: 'male', anatomy: 'none', status: 'calibrator' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Main character.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'S-AV-01',
        name: 'Мира',
        state: { sensitivity: 60, capacity: 50, openness: 100, plasticity: 100, attitude: 100 },
        profile: {
            base: { name: 'Мира', age: 24, gender: 'female', anatomy: 'none', status: 'asset' },
            origin: { birthplaceId: 'loc-004', professionId: 'prof-002', biography: 'S-AV-01', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    }
];

const insertSubjectStmt = db.prepare(`
    INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sensitivity = excluded.sensitivity,
        capacity = excluded.capacity,
        openness = excluded.openness,
        plasticity = excluded.plasticity,
        attitude = excluded.attitude
`);

const insertProfileStmt = db.prepare(`
    INSERT INTO characters (id, name, kind, subject_id, player_id, profile_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        subject_id = excluded.subject_id,
        player_id = excluded.player_id,
        profile_json = CASE
            WHEN characters.profile_json IS NULL OR characters.profile_json = '{}' THEN excluded.profile_json
            ELSE characters.profile_json
        END
`);

const rawItems = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/items.json', 'utf8'));
const rawTraits = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/traits.json', 'utf8'));

db.transaction(() => {

    console.log("Loading and validating JSON presets...");

    // Load Items
    const insertItemStmt = db.prepare('INSERT OR IGNORE INTO items (id, name, type, tags, description) VALUES (?, ?, ?, ?, ?)');
    for (const item of rawItems) {
        const validItem = item as any;
        insertItemStmt.run(validItem.id, validItem.name, validItem.type, JSON.stringify(validItem.tags || []), validItem.description || '');
    }

    // Load Traits
    const insertTraitStmt = db.prepare('INSERT OR IGNORE INTO traits (id, name, description, rules_json) VALUES (?, ?, ?, ?)');
    for (const trait of rawTraits) {
        const validTrait = trait as any;
        insertTraitStmt.run(
            validTrait.id,
            validTrait.name,
            validTrait.description || '',
            JSON.stringify(validTrait.rules)
        );
    }
    console.log("JSON presets loaded successfully!");

    console.log("Обновление субъектов...");
    for (const subject of subjects) {
        insertSubjectStmt.run(
            subject.id, subject.name,
            subject.state.sensitivity, subject.state.capacity, subject.state.openness, subject.state.plasticity, subject.state.attitude,
            subject.state.sensitivity, subject.state.capacity, subject.state.openness, subject.state.plasticity, subject.state.attitude
        );
        const isCalibrator = subject.profile.base.status === 'calibrator';
        const characterKind = isCalibrator ? 'calibrator' : 'subject';
        const playerId = isCalibrator ? subject.id : null;
        insertProfileStmt.run(
            subject.id, subject.name, characterKind, subject.id, playerId, JSON.stringify(subject.profile)
        );

        // Добавляем начальные ресурсы персонажам (особенно игроку PL-1)
        const insertRes = db.prepare(`
            INSERT INTO character_resources (character_id, resource_key, amount, max_amount, regen_rate)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(character_id, resource_key) DO UPDATE SET
                amount = excluded.amount
        `);
        
        console.log(`Inserting resources for ${subject.id}, isCalibrator: ${isCalibrator}`);
        if (isCalibrator) {
            // Только живой ресурс: credits. Energy/authority выведены из дизайна.
            insertRes.run(subject.id, 'credits', 1000, 1000000, 0);
            console.log(`Resources inserted for ${subject.id}`);
        }
    }

    // Стартовые предметы для игрока (Калибратор) — выведены из дизайна:
    // инструменты калибратора не раздаются стартом, одежда задаётся STARTER_CLOTHING.
    console.log('Starting items: none (retired)');
})();

ensureAllStarterClothing();

const insertPointStmt = db.prepare(`
    INSERT OR IGNORE INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
        label = excluded.label, values_json = excluded.values_json, provides_functions = excluded.provides_functions
`);

const insertSubjectPointStmt = db.prepare(`
    INSERT OR IGNORE INTO subject_point_states
    (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertSceneCharacterStmt = db.prepare(`
    INSERT INTO scene_characters (scene_id, character_id, role, can_act, presence_state, slot_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(scene_id, character_id) DO UPDATE SET
        role = excluded.role,
        can_act = excluded.can_act,
        presence_state = excluded.presence_state,
        slot_id = excluded.slot_id
`);

const updateCharacterLocationStmt = db.prepare(`
    UPDATE characters SET current_scene_id = ? WHERE id = ?
`);

const upsertSceneObjectStmt = db.prepare(`
    INSERT INTO scene_objects (id, scene_id, node_id, item_id, owner_id, state, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        scene_id = excluded.scene_id,
        node_id = excluded.node_id,
        item_id = excluded.item_id,
        owner_id = excluded.owner_id,
        state = excluded.state,
        metadata = excluded.metadata
`);

db.transaction(() => {
    const actions = loadActionPresets();
    upsertActionPresets(actions);

    const prototypeExpansionActions = [
        'pose_standing', 'pose_sitting', 'pose_kneeling', 'pose_lying_down', 'pose_all_fours', 'pose_spread_eagle',
        'act_apply_handcuffs', 'act_remove_handcuffs',
        'act_apply_collar', 'act_remove_collar', 'act_shock_collar',
        'eq_blindfold_apply', 'eq_blindfold_remove',
        'eq_gag_apply', 'eq_gag_remove',
        'act_insert_plug', 'act_activate_plug', 'act_deactivate_plug', 'act_remove_plug',
        'act_start_vibrator', 'act_adjust_vibration', 'act_stop_vibrator',
        'act_hold_exposure', 'act_end_exposure', 'act_present_feet', 'act_end_feet_presentation',
        'act_suspend_wrists', 'act_release_wrists',
        'act_self_stimulate',
        'act_start_penetration', 'act_increase_friction', 'act_decrease_friction', 'act_end_sexual_contact', 'act_sexual_climax',
        'act_connect_tens', 'act_start_electrostimulation', 'act_adjust_electrostimulation', 'act_stop_electrostimulation', 'act_disconnect_tens',
        'eq_clothe_jumpsuit', 'eq_clothe_jumpsuit_remove',
        'eq_clothe_underwear', 'eq_clothe_underwear_remove',
        'eq_clothe_dress', 'eq_clothe_dress_remove',
        'eq_clothe_stockings', 'eq_clothe_stockings_remove',
        'eq_clothe_lab_gown', 'eq_clothe_lab_gown_remove',
        'eq_clothe_calibration_set', 'eq_clothe_calibration_set_remove',
        'eq_clothe_costume', 'eq_clothe_costume_remove'
    ];
    const availableActions = Array.from(new Set([...actions.map(a => a.id), ...prototypeExpansionActions]));
    const availableActionsStr = JSON.stringify(availableActions);

    const insertSceneStmt = db.prepare('INSERT OR REPLACE INTO scenes (id, available_actions, description, slots, transitions, is_global_map) VALUES (?, ?, ?, ?, ?, ?)');

    insertSceneStmt.run(
        'scene_lab_calibrator', availableActionsStr, 'Каморка Калибратора. Темная, тесная комната, заставленная оборудованием.',
        JSON.stringify([]),
        JSON.stringify([{ toSceneId: 'scene_global_map', label: 'Выйти на Омнискрипт (Карта)', condition: null }]),
        0
    );
    upsertSceneObjectStmt.run(
        'calibrator_suspension_mount',
        'scene_lab_calibrator',
        'device:lab_diagnostic_table',
        'eq_suspension',
        'PL-1',
        'active',
        JSON.stringify({ label: 'Потолочный подвес диагностического стола' })
    );

    insertSceneStmt.run(
        'scene_broker', availableActionsStr, 'Витрина Брокера. Просторное помещение с ярким галогеновым светом.',
        JSON.stringify([
            { id: 'slot_broker_desk', name: 'Стол Брокера', capacity: 1, tags: ['control'] },
            { id: 'slot_display_1', name: 'Подиум 1', capacity: 1, tags: ['asset_display'] },
            { id: 'slot_display_2', name: 'Подиум 2', capacity: 1, tags: ['asset_display'] },
            { id: 'slot_display_3', name: 'Подиум 3', capacity: 1, tags: ['asset_display'] }
        ]),
        JSON.stringify([{ toSceneId: 'scene_global_map', label: 'Покинуть витрину (Карта)', condition: null }]),
        0
    );

    insertSceneStmt.run(
        'scene_liaison', availableActionsStr, 'Офис Связного. Здесь обсуждаются серые контракты.',
        JSON.stringify([
            { id: 'slot_liaison_desk', name: 'Стол Связного', capacity: 1, tags: ['control'] },
            { id: 'slot_client', name: 'Кресло клиента', capacity: 1, tags: [] }
        ]),
        JSON.stringify([{ toSceneId: 'scene_global_map', label: 'Покинуть офис (Карта)', condition: null }]),
        0
    );

    insertSceneStmt.run(
        'scene_global_map', availableActionsStr, 'Омнискрипт. Главный транзитный узел сектора.',
        JSON.stringify([]),
        JSON.stringify([
            { toSceneId: 'scene_lab_calibrator', label: 'Отправиться в свою лабораторию', condition: null },
            { toSceneId: 'scene_broker', label: 'Посетить витрину Брокера', condition: null },
            { toSceneId: 'scene_liaison', label: 'Назначить встречу со Связным', condition: null }
        ]),
        1
    );

    const placements = [
        { characterId: 'PL-1', role: 'calibrator', slotId: 'room:room_calibration', sceneId: 'scene_lab_calibrator', presenceState: 'present', canAct: true },
        { characterId: 'S-AV-01', role: 'asset', slotId: 'room:room_cell_a', sceneId: 'scene_lab_calibrator', presenceState: 'present', canAct: true }
    ];

    for (const placement of placements) {
        upsertSceneCharacterStmt.run(placement.sceneId, placement.characterId, placement.role, placement.canAct ? 1 : 0, placement.presenceState, placement.slotId);
        updateCharacterLocationStmt.run(placement.sceneId, placement.characterId);
    }

    console.log("Обновление точек (points) и связей...");
    for (const subject of subjects) {
        const points = getBaseHumanAnatomy(subject.profile.base.gender, subject.profile.base.anatomy);
        for (const p of points) {
            const vJson = JSON.stringify({ sens: p.sens, att: p.att });
            const pfJson = p.providesFunctions ? JSON.stringify(p.providesFunctions) : null;
            const tJson = p.tags ? JSON.stringify(p.tags) : null;
            
            insertPointStmt.run(p.id, p.label, vJson, p.parentId || null, pfJson, tJson);
            
            insertSubjectPointStmt.run(
                subject.id, p.id,
                p.sens, p.att, 0, 0,
                p.sens, p.att
            );
        }
    }
})();

// ── Единый механизм приведения персонажей к каноническому стартовому состоянию ──
// Применяет стартовые трейты к subjects.preferences, выставляет позу и одежду
// в active_contexts, обнуляет статистику subject_point_states (familiarity,
// exposure_count, локальные чувствительности) для всех сидируемых субъектов.
(() => {
    const npcRows = db.prepare("SELECT id FROM characters WHERE id != 'PL-1'").all() as { id: string }[];
    const npcIds = npcRows.map(r => r.id);
    const done = reconcileAllCharacters(npcIds, {
        pose: 'pose_standing',
        clothing: ['eq_clothe_underwear'],
        resetPoints: true,
    });
    console.log(`[Seed] Reconcile: приведено к канону ${done}/${npcIds.length} персонажей.`);
})();

// ── Seed character relations between NPCs in the same room ──
(() => {
    // NPC pairs that share a room and should have relations for proactive interactions
    const npcPairs = [
        // room_calibration: Sumi (diagnostic table) and GEN-02 (recovery capsule)
        { from: 'NPC-CAND-SUMI', to: 'NPC-CAND-GEN-02', attitude: 55, openness: 50 },
        // room_cell_b: NPC-CAND-01 and NPC-CAND-GEN-04
        { from: 'NPC-CAND-01', to: 'NPC-CAND-GEN-04', attitude: 40, openness: 30 },
        { from: 'NPC-CAND-GEN-04', to: 'NPC-CAND-01', attitude: 45, openness: 35 },
        // Cross-room: Lab assistant knows everyone
        { from: 'NPC-LAB-01', to: 'NPC-CAND-SUMI', attitude: 50, openness: 40 },
        { from: 'NPC-LAB-01', to: 'NPC-CAND-01', attitude: 50, openness: 40 },
        { from: 'NPC-LAB-01', to: 'NPC-CAND-GEN-02', attitude: 50, openness: 40 },
        { from: 'NPC-LAB-01', to: 'NPC-CAND-GEN-04', attitude: 50, openness: 40 },
        // S-AV-01 knows lab assistant
        { from: 'S-AV-01', to: 'NPC-LAB-01', attitude: 60, openness: 50 },
        { from: 'NPC-LAB-01', to: 'S-AV-01', attitude: 65, openness: 55 },
        // S-AV-01 knows Sumi (both calibration subjects)
        { from: 'S-AV-01', to: 'NPC-CAND-SUMI', attitude: 50, openness: 45 },
        { from: 'NPC-CAND-SUMI', to: 'S-AV-01', attitude: 50, openness: 45 },
    ];

    for (const pair of npcPairs) {
        characterRelationRepo.ensure(pair.from, pair.to, {
            knows: true,
            present: true,
            canInteract: true,
            attitude: pair.attitude,
            openness: pair.openness,
            plasticity: 50,
            baselineAttitude: pair.attitude,
            baselineOpenness: pair.openness,
            baselinePlasticity: 50,
            familiarityLevel: 1,
            generalOpinion: 'нейтрально',
            recentMemories: []
        });
    }
    console.log(`[Seed] Создано relations между NPC: ${npcPairs.length} пар.`);
})();

// Граф интерпретаций (майнд-мэп): глоссарий → факты, каркас дерева для субъектов.
try {
    seedInterpretationTrees();
    console.log('[Seed] Граф интерпретаций: факты + каркас дерева созданы.');
} catch (error: any) {
    console.warn('[Seed] Граф интерпретаций не создан:', error?.message || error);
}

console.log("Успешное завершение сидирования.");
