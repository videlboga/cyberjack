import { db } from './db';
import fs from 'fs';
import { getBaseHumanAnatomy } from '../domain/anatomy.js';
import { CharacterProfile } from '../domain/characterProfile.js';
import { CANON_LOCATIONS, CANON_PROFESSIONS } from '../domain/canon.js';
import { ensureAllStarterClothing } from './starterClothing.js';
import { characterRelationRepo } from './repositories.js';

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

const rawActions = JSON.parse(fs.readFileSync('src/infrastructure/data/presets/actions.json', 'utf8'));
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

    // Load Actions
    const insertActionStmt = db.prepare(`
        INSERT INTO action_presets (id, label, type, tags, values_json, context_config_json, requires_item, model_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        const valuesWithReqs = {
            ...(validAct.vector || {}),
            requireContexts: validAct.requireContexts || null,
            removeContexts: validAct.removeContexts || null,
            validTargets: validAct.validTargets || null,
            removeNarrative: validAct.removeNarrative || null
        };
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

        // Добавляем начальные ресурсы персонажам (особенно игроку PL-1)
        const insertRes = db.prepare(`
            INSERT INTO character_resources (character_id, resource_key, amount, max_amount, regen_rate)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(character_id, resource_key) DO UPDATE SET
                amount = excluded.amount
        `);
        
        console.log(`Inserting resources for ${subject.id}, isCalibrator: ${isCalibrator}`);
        if (isCalibrator) {
            insertRes.run(subject.id, 'energy', 100, 100, 1);
            insertRes.run(subject.id, 'credits', 1000, 1000000, 0);
            insertRes.run(subject.id, 'authority', 50, 100, 0);
            console.log(`Resources inserted for ${subject.id}`);
        }
    }

    // Стартовые предметы для игрока (Калибратор)
    const insertCharacterItemStmt = db.prepare(`
        INSERT OR IGNORE INTO character_items (character_id, item_id, state, charges, metadata)
        VALUES (?, ?, ?, ?, ?)
    `);
    // Базовое оборудование для лаборатории
    insertCharacterItemStmt.run('PL-1', 'eq_handcuffs', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_collar', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_vibrator', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_tens_unit', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_plug', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_blindfold', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_gag', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_jumpsuit', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_dress', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_stockings', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_underwear', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'eq_panties', 'active', -1, '{}');
    insertCharacterItemStmt.run('PL-1', 'drug_truth_serum', 'active', 3, '{}');
    insertCharacterItemStmt.run('PL-1', 'drug_painkiller', 'active', 3, '{}');
    console.log('Starting items added for PL-1');
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
    const actions = [
        // System and Context Effects
        { id: 'effect_apathy', label: 'Апатия / Отключение', type: 'condition', tags: ['condition', 'apathy'], values: { intensity_mult: 0.5, sharpness_mult: 0.5 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_chronic_apathy', label: 'Глубокий Срыв (Хроническая Апатия)', type: 'condition', tags: ['condition', 'apathy'], values: { intensity_mult: 0.5, sharpness_mult: 0.5 }, contextConfig: { duration: 10, occupiesPoints: [] } },
        { id: 'effect_subspace', label: 'Сабспейс (Податливость)', type: 'condition', tags: ['condition', 'subspace'], values: { valence: 0.2, sharpness_mult: 0.6 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_panic', label: 'Паническая Атака', type: 'condition', tags: ['condition', 'panic'], values: { valence: -0.3, sharpness_mult: 1.4 }, contextConfig: { duration: 30, durationUnit: 'minutes', occupiesPoints: [] } },
        { id: 'effect_sensory_overload', label: 'Сенсорная Перегрузка', type: 'condition', tags: ['condition', 'overload'], values: { intensity_mult: 1.2, sharpness: 0.15 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_freeze', label: 'Тоническое Оцепенение', type: 'condition', tags: ['condition', 'freeze'], values: { contact_mult: 0.8 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_suggestibility', label: 'Смещение контроля', type: 'condition', tags: ['condition', 'submissive'], values: { valence: 0.15, sharpness_mult: 0.8 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_active_defiance', label: 'Активное Отторжение', type: 'condition', tags: ['condition', 'defiance'], values: { intensity_mult: 0.8, valence: -0.1 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_hyperesthesia', label: 'Гиперестезия', type: 'condition', tags: ['condition', 'hyperesthesia'], values: { intensity_mult: 1.3, sharpness_mult: 1.1 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_local_hyperesthesia', label: 'Локальная Гиперестезия', type: 'condition', tags: ['condition', 'hyperesthesia', 'local'], values: { intensity_mult: 1.5, sharpness_mult: 1.2 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_local_numbness', label: 'Локальное Онемение', type: 'condition', tags: ['condition', 'numbness', 'local'], values: { intensity_mult: 0.1, sharpness_mult: 0.1, contact_mult: 0.5 }, contextConfig: { duration: -1, occupiesPoints: [] } },
        { id: 'effect_refractory', label: 'Рефрактерный период', type: 'condition', tags: ['condition', 'physiological', 'refractory'], values: { intensity_mult: 0.25, contact_mult: 0.8, novelty_mult: 0.25 }, contextConfig: { type: 'condition', duration: 3, occupiesPoints: [] } },

        // Standard actions
        { id: 'gentle_stroke', label: 'Мягкое поглаживание', validTargets: ['hair','face','neck','shoulders','chest','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks','vulva','penis'], values: { intensity: 0.2, valence: 0.6, contact: 0.4, sharpness: 0.1, novelty: 0.2 } },
        { id: 'tickle', label: 'Щекотка пальцами', validTargets: ['neck','belly','waist','inner_thighs','feet','buttocks','vulva','clitoris','penis','testicles','anus'], values: { intensity: 0.4, valence: 0.2, contact: 0.3, sharpness: 0.4, novelty: 0.5 } },
        { id: 'light_kiss', label: 'Короткий поцелуй', validTargets: ['face','lips','neck','shoulders','chest','nipples','belly','back','hands','inner_thighs','buttocks','vulva','clitoris','penis'], values: { intensity: 0.2, valence: 0.7, contact: 0.5, sharpness: 0.05, novelty: 0.4 } },
        { id: 'deep_kiss', label: 'Глубокий поцелуй', validTargets: ['lips'], values: { intensity: 0.6, valence: 0.9, contact: 0.8, sharpness: 0.2, novelty: 0.6 } },
        { id: 'feather_stroke', label: 'Проведение перышком', validTargets: ['head','hair','face','lips','neck','shoulders','chest','nipples','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks','vulva','clitoris','penis','testicles','anus','vagina','prostate'], values: { intensity: 0.16, valence: 0.5, contact: 0.18, sharpness: 0.02, novelty: 0.7 } },
        { id: 'deep_massage', label: 'Массаж', validTargets: ['shoulders','chest','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks'], values: { intensity: 0.48, valence: 0.5, contact: 0.82, sharpness: 0.2, novelty: 0.25 } },
        { id: 'licking', label: 'Провести языком', validTargets: ['lips','neck','nipples','inner_thighs','vulva','clitoris','penis','testicles','anus'], values: { intensity: 0.3, valence: 0.6, contact: 0.5, sharpness: 0.05, novelty: 0.6 } },
        { id: 'firm_grip', label: 'Крепко сжать', validTargets: ['shoulders','chest','waist','arms','hands','inner_thighs','legs','buttocks','penis','testicles'], values: { intensity: 0.7, valence: -0.2, contact: 0.8, sharpness: 0.3, novelty: 0.4 } },
        { id: 'light_bite', label: 'Игровой прикус', validTargets: ['lips','neck','shoulders','chest','nipples','inner_thighs','buttocks','vulva','clitoris','penis','testicles'], values: { intensity: 0.4, valence: 0.4, contact: 0.4, sharpness: 0.6, novelty: 0.5 } },
        { id: 'hard_bite', label: 'Болезненный укус', validTargets: ['lips','neck','shoulders','chest','inner_thighs','buttocks','vulva','clitoris','penis','testicles'], values: { intensity: 0.7, valence: -0.5, contact: 0.6, sharpness: 0.8, novelty: 0.5 } },
        { id: 'pinch', label: 'Ущипнуть', validTargets: ['chest','nipples','belly','waist','arms','inner_thighs','buttocks','vulva','clitoris','penis','testicles','anus'], values: { intensity: 0.5, valence: -0.4, contact: 0.2, sharpness: 0.8, novelty: 0.3 } },
        { id: 'scratching', label: 'Провести ногтями', validTargets: ['shoulders','chest','belly','back','arms','inner_thighs','legs','buttocks'], values: { intensity: 0.4, valence: -0.2, contact: 0.3, sharpness: 0.8, novelty: 0.4 } },
        { id: 'slap', label: 'Шлёпнуть', validTargets: ['face','chest','inner_thighs','buttocks'], values: { intensity: 0.5, valence: -0.3, contact: 0.6, sharpness: 0.7, novelty: 0.4 } },
        { id: 'hard_slap', label: 'Удар ладонью', validTargets: ['face','chest','inner_thighs','buttocks'], values: { intensity: 0.72, valence: -0.6, contact: 0.65, sharpness: 0.85, novelty: 0.5 } },
        { id: 'needle_prick', label: 'Укол иглой', validTargets: ['shoulders','arms','inner_thighs','legs','buttocks'], values: { intensity: 0.4, valence: -0.7, contact: 0.1, sharpness: 1.0, novelty: 0.6 } },
        { id: 'whip_strike', label: 'Удар хлыстом', validTargets: ['shoulders','chest','back','inner_thighs','legs','buttocks'], values: { intensity: 0.9, valence: -0.9, contact: 0.3, sharpness: 1.0, novelty: 0.5 } },
        { id: 'taser_shock', label: 'Разряд электрошокера', validTargets: ['shoulders','chest','belly','back','arms','inner_thighs','legs','buttocks'], values: { intensity: 0.95, valence: -0.95, contact: 0.4, sharpness: 0.95, novelty: 0.8 } },
        { id: 'ice_cube', label: 'Коснуться льдом', validTargets: ['head','hair','face','lips','neck','shoulders','chest','nipples','belly','back','waist','arms','hands','inner_thighs','legs','feet','buttocks','vulva','clitoris','penis','testicles','anus','vagina','prostate'], values: { intensity: 0.6, valence: 0.1, contact: 0.4, sharpness: 0.6, novelty: 0.8 } },
        { id: 'hot_wax', label: 'Капнуть воском', validTargets: ['shoulders','chest','belly','back','waist','arms','inner_thighs','legs','buttocks','vulva','clitoris','penis','testicles','anus'], values: { intensity: 0.7, valence: -0.1, contact: 0.2, sharpness: 0.8, novelty: 0.8 } },
        { id: 'vibrator_pulse', label: 'Дать импульс вибратором', requiresItem: 'eq_vibrator', validTargets: ['neck','chest','nipples','belly','inner_thighs','vulva','clitoris','penis','testicles','anus'], values: { intensity: 0.6, valence: 0.8, contact: 0.7, sharpness: 0.2, novelty: 0.7 } },
        { id: 'finger_insertion', label: 'Начать стимуляцию пальцами', type: 'physical', tags: ['intimate','penetration','continuous','manual'], validTargets: ['anus','vagina'], values: { intensity: 0.4, valence: 0.3, contact: 0.9, sharpness: 0.1, novelty: 0.6 }, removeContexts: ['act_start_penetration','act_increase_friction'], contextConfig: { type: 'sexual_interaction', activeLabel: 'Продолжительная стимуляция пальцами', duration: -1, modifiers: { intensity: 0.3, valence: 0.3, sharpness: 0.1, contact: 0.9, novelty: -0.1 } } },
        { id: 'act_start_oral_giving', label: 'Вставить в рот', type: 'physical', tags: ['intimate','sexual','oral','continuous','giving'], validTargets: ['lips'], values: { intensity: 0.45, valence: 0.35, contact: 0.9, sharpness: 0.08, novelty: 0.65 }, removeContexts: ['finger_insertion','act_start_penetration','act_increase_friction','act_deepen_oral'], contextConfig: { type: 'sexual_interaction', activeLabel: 'Продолжительный оральный контакт', duration: -1, modifiers: { intensity: 0.35, valence: 0.35, sharpness: 0.08, contact: 0.9, novelty: -0.1 } } },
        { id: 'act_deepen_oral', label: 'Засунуть в горло', type: 'physical', tags: ['intimate','sexual','oral','continuous','giving','intense'], validTargets: ['lips'], values: { intensity: 0.65, valence: 0.4, contact: 1, sharpness: 0.14, novelty: 0.25 }, contextConfig: { type: 'interaction_level', activeLabel: 'Глубокий оральный контакт', duration: -1, modifiers: { intensity: 0.2, valence: 0.05, sharpness: 0.06, contact: 0.05, novelty: -0.08 } } },
        { id: 'device_sensory_loop', label: 'Установить сенсорный контур', type: 'context', tags: ['equipment', 'passive'], values: { intensity: 0.05, valence: 0.1, contact: 0.2, sharpness: 0, novelty: 0.4 }, contextConfig: { type: 'equipment', activeLabel: 'Сенсорный контур', occupiesPoints: [], exclusiveWithinPoint: true, duration: -1, modifiers: {} } },
        { id: 'device_sensory_pulse', label: 'Импульс сенсорного контура', type: 'physical', tags: ['equipment', 'passive', 'stimulation'], values: { intensity: 0.25, valence: 0.5, contact: 0.8, sharpness: 0.05, novelty: 0.4 }, requireContexts: ['device_sensory_loop'] },
        { id: 'device_contrast_pulse', label: 'Контрастный импульс сенсорного контура', type: 'physical', tags: ['equipment', 'passive', 'contrast'], values: { intensity: 0.5, valence: 0.15, contact: 0.7, sharpness: 0.45, novelty: 0.75 }, requireContexts: ['device_sensory_loop'] },
        { id: 'hair_pull', label: 'Потянуть за волосы', validTargets: ['hair'], values: { intensity: 0.6, valence: -0.4, contact: 0.5, sharpness: 0.7, novelty: 0.4 } },
        { id: 'spit', label: 'Плевок', values: { intensity: 0.3, valence: -0.8, contact: 0.2, sharpness: 0.8, novelty: 0.7 } },
        { id: 'breath_blow', label: 'Обдать дыханием', validTargets: ['face','lips','neck','chest','nipples','belly','inner_thighs','vulva','clitoris','penis','anus'], values: { intensity: 0.16, valence: 0.4, contact: 0.12, sharpness: 0.08, novelty: 0.5 } },
        { id: 'verbal_pressure', label: 'Беседа', values: { intensity: 0.1, valence: 0.0, contact: 0.0, sharpness: 0.0, novelty: 0.1 } },
        { id: 'stare', label: 'Пристальный взгляд', values: { intensity: 0.3, valence: -0.1, contact: 0.0, sharpness: 0.1, novelty: 0.2 } },
        { id: 'close_inspection', label: 'Относительно близкий осмотр', values: { intensity: 0.4, valence: -0.3, contact: 0.0, sharpness: 0.2, novelty: 0.4 } },
        { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } },
        { id: 'pose_kneeling', label: 'Поза: На коленях', type: 'pose', tags: ['pose', 'dominance'], values: { intensity: 0.3, valence: -0.2, contact: 0.1, sharpness: 0.0, novelty: 0.2 }, removeContexts: ['act_hold_exposure', 'act_present_feet', 'act_suspend_wrists'], contextConfig: { type: 'pose', activeLabel: 'На коленях', occupiesPoints: ['global_pose'], duration: -1 } },
        { id: 'context_defiant', label: 'Агрессивный бунт', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_fear_of_loss', label: 'Страх утраты', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.1, valence: -0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_glitch_prone', label: 'Нестабильность имплантов', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.1, valence: -0.1, contact: 0, sharpness: 0, novelty: 0.2 }, contextConfig: { duration: -1 } },
        { id: 'context_sensitive_skin', label: 'Гиперестезия', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.2, valence: 0, contact: 0.2, sharpness: 0.3, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_masochism', label: 'Мазохистская инверсия', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_pleasure_burn', label: 'Ожог удовольствием', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: -0.1, contact: 0, sharpness: 0.1, novelty: 0 }, contextConfig: { duration: -1 } }
    ];
    const upsertActionStmt = db.prepare(`
        INSERT INTO action_presets (id, label, type, tags, values_json, context_config_json, model_url)
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
        const valJson = { ...(act as any).values || {}, requireContexts: (act as any).requireContexts || null, removeContexts: (act as any).removeContexts || null, validTargets: (act as any).validTargets || null, requiresItem: (act as any).requiresItem || null };
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

console.log("Успешное завершение сидирования.");
