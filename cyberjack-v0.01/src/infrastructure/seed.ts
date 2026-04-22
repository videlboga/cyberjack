import { db } from './db.ts';
import fs from 'fs';
import { ActionPresetSchema, ItemPresetSchema, TraitPresetSchema } from '../domain/schemas.js';
import { getBaseHumanAnatomy } from '../domain/anatomy.js';
import { CharacterProfile } from '../domain/characterProfile.js';
import { CANON_LOCATIONS, CANON_PROFESSIONS } from '../domain/canon.js';

console.log("Начинаем безопасное заполнение базы данных (без удаления существующих данных)...");

const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [
    {
        id: 'PL-1',
        name: 'Player',
        state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 },
        profile: {
            base: { name: 'Player', age: 30, gender: 'male', anatomy: 'none', status: 'calibrator' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Main character.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'C-BROKER',
        name: 'Шепот',
        state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 },
        profile: {
            base: { name: 'Шепот', age: 40, gender: 'male', anatomy: 'none', status: 'calibrator' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Торговец информацией.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'C-LIAISON',
        name: 'Куратор',
        state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 },
        profile: {
            base: { name: 'Куратор', age: 35, gender: 'female', anatomy: 'none', status: 'calibrator' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Представитель Корпорации.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'S-ASSET-1',
        name: 'Эли',
        state: { sensitivity: 50, capacity: 60, openness: 50, plasticity: 80, attitude: 50 },
        profile: {
            base: { name: 'Эли', age: 22, gender: 'female', anatomy: 'none', status: 'asset' },
            origin: { birthplaceId: 'loc-004', professionId: 'prof-002', biography: 'S-ASSET-1.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'S-ASSET-2',
        name: 'Никс',
        state: { sensitivity: 40, capacity: 50, openness: 60, plasticity: 30, attitude: 20 },
        profile: {
            base: { name: 'Никс', age: 28, gender: 'female', anatomy: 'none', status: 'asset' },
            origin: { birthplaceId: 'loc-002', professionId: 'prof-002', biography: 'S-ASSET-2.', coreTrauma: undefined },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    },
    {
        id: 'S-ASSET-3',
        name: 'Рэй',
        state: { sensitivity: 30, capacity: 40, openness: 70, plasticity: 40, attitude: 30 },
        profile: {
            base: { name: 'Рэй', age: 25, gender: 'male', anatomy: 'none', status: 'asset' },
            origin: { birthplaceId: 'loc-003', professionId: 'prof-002', biography: 'S-ASSET-3.', coreTrauma: undefined },
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
        name = excluded.name
`);

const insertProfileStmt = db.prepare(`
    INSERT INTO characters (id, name, kind, subject_id, player_id, profile_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kind = excluded.kind,
        subject_id = excluded.subject_id,
        player_id = excluded.player_id,
        profile_json = excluded.profile_json
`);

db.transaction(() => {

    console.log("Loading and validating JSON presets...");
    const rawActions = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/actions.json', 'utf8'));
    const rawItems = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/items.json', 'utf8'));
    const rawTraits = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/traits.json', 'utf8'));

    // Load Items
    const insertItemStmt = db.prepare('INSERT OR IGNORE INTO items (id, name, type, tags, description) VALUES (?, ?, ?, ?, ?)');
    for (const item of rawItems) {
        const validItem = item as any;
        insertItemStmt.run(validItem.id, validItem.name, validItem.type, JSON.stringify(validItem.tags || []), validItem.description || '');
    }

    // Load Actions
    const insertActionStmt = db.prepare(`
        INSERT INTO action_presets (id, label, type, tags, values_json, context_config_json, requires_item)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            type = excluded.type,
            tags = excluded.tags,
            values_json = excluded.values_json,
            context_config_json = excluded.context_config_json,
            requires_item = excluded.requires_item,
            model_url = excluded.model_url
    `);
    for (const act of rawActions) {
        const validAct = act as any;
        const valuesWithReqs = { ...(validAct.vector || {}), requireContexts: validAct.requireContexts || null, removeContexts: validAct.removeContexts || null };
        insertActionStmt.run(
            validAct.id,
            validAct.name,
            validAct.categories[0], // map first category as type
            JSON.stringify(validAct.tags),
            JSON.stringify(valuesWithReqs),
            validAct.contextConfig ? JSON.stringify(validAct.contextConfig) : null,
            (validAct as any).requiresItem || null,
            (validAct as any).model_url || (validAct as any).modelUrl || null
        );
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
    }
})();const insertPointStmt = db.prepare(`
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
    const actions = [
        // System and Context Effects
        { id: 'effect_apathy', label: 'Апатия / Отключение', type: 'condition', tags: ['condition', 'apathy'], values: { intensity_mult: 0.5, sharpness_mult: 0.5 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_chronic_apathy', label: 'Глубокий Срыв (Хроническая Апатия)', type: 'condition', tags: ['condition', 'apathy'], values: { intensity_mult: 0.5, sharpness_mult: 0.5 }, contextConfig: { duration: 10, occupiesPoints: [] } },
        { id: 'effect_subspace', label: 'Сабспейс (Податливость)', type: 'condition', tags: ['condition', 'subspace'], values: { valence: 0.2, sharpness_mult: 0.6 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_panic', label: 'Паническая Атака', type: 'condition', tags: ['condition', 'panic'], values: { valence: -0.3, sharpness_mult: 1.4 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_sensory_overload', label: 'Сенсорная Перегрузка', type: 'condition', tags: ['condition', 'overload'], values: { intensity_mult: 1.2, sharpness: 0.15 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_freeze', label: 'Тоническое Оцепенение', type: 'condition', tags: ['condition', 'freeze'], values: { contact_mult: 0.8 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_suggestibility', label: 'Смещение контроля', type: 'condition', tags: ['condition', 'submissive'], values: { valence: 0.15, sharpness_mult: 0.8 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_active_defiance', label: 'Активное Отторжение', type: 'condition', tags: ['condition', 'defiance'], values: { intensity_mult: 0.8, valence: -0.1 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_hyperesthesia', label: 'Гиперестезия', type: 'condition', tags: ['condition', 'hyperesthesia'], values: { intensity_mult: 1.3, sharpness_mult: 1.1 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_local_hyperesthesia', label: 'Локальная Гиперестезия', type: 'condition', tags: ['condition', 'hyperesthesia', 'local'], values: { intensity_mult: 1.5, sharpness_mult: 1.2 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_local_numbness', label: 'Локальное Онемение', type: 'condition', tags: ['condition', 'numbness', 'local'], values: { intensity_mult: 0.1, sharpness_mult: 0.1, contact_mult: 0.5 }, contextConfig: { duration: -1, occupiesPoints: [] } },

        // Standard actions
        { id: 'gentle_stroke', label: 'Мягкое поглаживание', values: { intensity: 0.2, valence: 0.6, contact: 0.4, sharpness: 0.1, novelty: 0.2 } },
        { id: 'tickle', label: 'Щекотка пальцами', values: { intensity: 0.4, valence: 0.2, contact: 0.3, sharpness: 0.4, novelty: 0.5 } },
        { id: 'light_kiss', label: 'Легкий поцелуй', values: { intensity: 0.2, valence: 0.7, contact: 0.5, sharpness: 0.05, novelty: 0.4 } },
        { id: 'deep_kiss', label: 'Страстный поцелуй', values: { intensity: 0.6, valence: 0.9, contact: 0.8, sharpness: 0.2, novelty: 0.6 } },
        { id: 'feather_stroke', label: 'Проведение перышком', values: { intensity: 0.1, valence: 0.5, contact: 0.1, sharpness: 0.0, novelty: 0.7 } },
        { id: 'deep_massage', label: 'Глубокий массаж', values: { intensity: 0.6, valence: 0.8, contact: 0.9, sharpness: 0.1, novelty: 0.3 } },
        { id: 'licking', label: 'Облизывание языком', values: { intensity: 0.3, valence: 0.6, contact: 0.5, sharpness: 0.05, novelty: 0.6 } },
        { id: 'firm_grip', label: 'Жесткий захват', values: { intensity: 0.7, valence: -0.2, contact: 0.8, sharpness: 0.3, novelty: 0.4 } },
        { id: 'light_bite', label: 'Легкий укус', values: { intensity: 0.4, valence: 0.4, contact: 0.4, sharpness: 0.6, novelty: 0.5 } },
        { id: 'hard_bite', label: 'Сильный укус', values: { intensity: 0.7, valence: -0.5, contact: 0.6, sharpness: 0.8, novelty: 0.5 } },
        { id: 'pinch', label: 'Щипок', values: { intensity: 0.5, valence: -0.4, contact: 0.2, sharpness: 0.8, novelty: 0.3 } },
        { id: 'scratching', label: 'Царапанье ногтями', values: { intensity: 0.4, valence: -0.2, contact: 0.3, sharpness: 0.8, novelty: 0.4 } },
        { id: 'slap', label: 'Легкий шлепок', values: { intensity: 0.5, valence: -0.3, contact: 0.6, sharpness: 0.7, novelty: 0.4 } },
        { id: 'hard_slap', label: 'Сильный удар ладонью', values: { intensity: 0.8, valence: -0.6, contact: 0.8, sharpness: 0.8, novelty: 0.5 } },
        { id: 'needle_prick', label: 'Укол иглой', values: { intensity: 0.4, valence: -0.7, contact: 0.1, sharpness: 1.0, novelty: 0.6 } },
        { id: 'belt_strike', label: 'Удар ремнем', values: { intensity: 0.7, valence: -0.7, contact: 0.5, sharpness: 0.9, novelty: 0.6 } },
        { id: 'whip_strike', label: 'Удар хлыстом', values: { intensity: 0.9, valence: -0.9, contact: 0.3, sharpness: 1.0, novelty: 0.5 } },
        { id: 'taser_shock', label: 'Разряд электрошокера', values: { intensity: 0.95, valence: -0.95, contact: 0.4, sharpness: 0.95, novelty: 0.8 } },
        { id: 'ice_cube', label: 'Прикладывание льда', values: { intensity: 0.6, valence: 0.1, contact: 0.4, sharpness: 0.6, novelty: 0.8 } },
        { id: 'hot_wax', label: 'Капля горячего воска', values: { intensity: 0.7, valence: -0.1, contact: 0.2, sharpness: 0.8, novelty: 0.8 } },
        { id: 'vibrator_pulse', label: 'Импульс вибратором', values: { intensity: 0.6, valence: 0.8, contact: 0.7, sharpness: 0.2, novelty: 0.7 } },
        { id: 'hair_pull', label: 'Рывок за волосы', values: { intensity: 0.6, valence: -0.4, contact: 0.5, sharpness: 0.7, novelty: 0.4 } },
        { id: 'spit', label: 'Плевок', values: { intensity: 0.3, valence: -0.8, contact: 0.2, sharpness: 0.8, novelty: 0.7 } },
        { id: 'breath_blow', label: 'Обдувание дыханием', values: { intensity: 0.1, valence: 0.4, contact: 0.05, sharpness: 0.1, novelty: 0.5 } },
        { id: 'verbal_pressure', label: 'Обычная беседа (скрытое)', values: { intensity: 0.1, valence: 0.0, contact: 0.0, sharpness: 0.0, novelty: 0.1 } },
        { id: 'stare', label: 'Пристальный взгляд', values: { intensity: 0.3, valence: -0.1, contact: 0.0, sharpness: 0.1, novelty: 0.2 } },
        { id: 'close_inspection', label: 'Относительно близкий осмотр', values: { intensity: 0.4, valence: -0.3, contact: 0.0, sharpness: 0.2, novelty: 0.4 } },
        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } },
        { id: 'pose_kneeling', label: 'Поза: На коленях', type: 'pose', tags: ['pose', 'dominance'], values: { intensity: 0.3, valence: -0.2, contact: 0.1, sharpness: 0.0, novelty: 0.2 }, contextConfig: { type: 'pose', occupiesPoints: ['global_pose', 'knees'], duration: -1 } },
        { id: 'context_defiant', label: 'Агрессивный бунт', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_fear_of_loss', label: 'Страх утраты', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.1, valence: -0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_glitch_prone', label: 'Нестабильность имплантов', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.1, valence: -0.1, contact: 0, sharpness: 0, novelty: 0.2 }, contextConfig: { duration: -1 } },
        { id: 'context_sensitive_skin', label: 'Гиперестезия', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.2, valence: 0, contact: 0.2, sharpness: 0.3, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_masochism', label: 'Мазохистская инверсия', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_pleasure_burn', label: 'Ожог удовольствием', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: -0.1, contact: 0, sharpness: 0.1, novelty: 0 }, contextConfig: { duration: -1 } }
    ];
    const upsertActionStmt = db.prepare(`
        INSERT INTO action_presets (id, label, type, tags, values_json, context_config_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label,
            type = excluded.type,
            tags = excluded.tags,
            values_json = excluded.values_json,
            context_config_json = excluded.context_config_json,
            model_url = excluded.model_url
    `);
    for (const act of actions) {
        const valJson = { ...(act as any).values || {}, requireContexts: (act as any).requireContexts || null, removeContexts: (act as any).removeContexts || null };
        upsertActionStmt.run(
            act.id,
            act.label,
            (act as any).type || 'physical',
            JSON.stringify((act as any).tags || []),
            JSON.stringify(valJson),
            (act as any).contextConfig ? JSON.stringify((act as any).contextConfig) : null,
            (act as any).model_url || (act as any).modelUrl || null
        );
    }

    
    const availableActionsStr = JSON.stringify(["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike","pose_kneeling","act_apply_handcuffs","act_remove_handcuffs","act_struggle_cuffs","act_suspend_wrists","act_release_wrists", "act_buy_active"]);

    const insertSceneStmt = db.prepare('INSERT OR REPLACE INTO scenes (id, available_actions, description, slots, transitions, is_global_map) VALUES (?, ?, ?, ?, ?, ?)');

    insertSceneStmt.run(
        'scene_lab_calibrator', availableActionsStr, 'Каморка Калибратора. Темная, тесная комната, заставленная оборудованием.',
        JSON.stringify([
            { id: 'slot_bed', name: 'Койка Калибратора', capacity: 1, tags: ['safe'] },
            { id: 'slot_terminal', name: 'Терминал Синдиката', capacity: 1, tags: ['control'] },
            { id: 'slot_table', name: 'Диагностический стол', capacity: 1, tags: ['core'] }
        ]),
        JSON.stringify([{ toSceneId: 'scene_global_map', label: 'Выйти на Омнискрипт (Карта)', condition: null }]),
        0
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
        { characterId: 'PL-1', role: 'calibrator', slotId: 'slot_terminal', sceneId: 'scene_lab_calibrator', presenceState: 'present', canAct: true },
        { characterId: 'C-BROKER', role: 'npc', slotId: 'slot_broker_desk', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'S-ASSET-1', role: 'asset', slotId: 'slot_table', sceneId: 'scene_lab_calibrator', presenceState: 'present', canAct: true },
        { characterId: 'S-ASSET-2', role: 'asset', slotId: 'slot_display_2', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'S-ASSET-3', role: 'asset', slotId: 'slot_display_3', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'C-LIAISON', role: 'npc', slotId: 'slot_liaison_desk', sceneId: 'scene_liaison', presenceState: 'present', canAct: true }
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

console.log("Успешное завершение сидирования.");
