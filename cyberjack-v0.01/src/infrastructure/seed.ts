import { db } from './db.js';
import fs from 'fs';
import { ActionPresetSchema, ItemPresetSchema, TraitPresetSchema } from '../domain/schemas.js';
import { getBaseHumanAnatomy } from '../domain/anatomy.js';
import { CharacterProfile } from '../domain/characterProfile.js';
import { CANON_LOCATIONS, CANON_PROFESSIONS } from '../domain/canon.js';

console.log("Начинаем безопасное заполнение базы данных (без удаления существующих данных)...");

const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [
    {
        id: 'S-01',
        name: 'Синтетик (Мясо/Пластика)',
        state: { sensitivity: 50, capacity: 60, openness: 50, plasticity: 80, attitude: 50 },
        profile: {
            base: {
                name: 'S-01',
                age: 22,
                gender: 'female',
                anatomy: 'none',
                status: 'asset'
            },
            origin: {
                birthplaceId: CANON_LOCATIONS[3].id, // Жилые Блоки
                professionId: CANON_PROFESSIONS[1].id, // Актив
                coreTrauma: 'Потерял близкого человека, которого забрали Корпорации за долги в качестве Актива',
                biography: 'S-01 была конфискована корпорацией из Жилых Блоков после серии долгов матери. Память очищена, оставлены лишь послушные инстинкты.'
            },
            personality: {
                traits: ['Послушный', 'Сломленный'],
                quirks: ['Механически подчиняется любым приказам'],
                speechStyle: 'Прерывистая речь, частые заикания, тихий голос.',
                coreBelief: 'Главное — выжить и не оказаться на столе в лаборатории.'
            },
            knowledge: {
                common: ['Активы — это расходный материал для экспериментов; быть Активом — это пожизненный приговор к пыткам и стимуляции.'],
                personal: ['Я S-01, Актив-тестируемый.'],
                secrets: []
            },
            memory: {
                knownCharacters: {},
                scars: [] // Physical scars
            }
        }
    },
    {
        id: 'S-02',
        name: 'Райли (Бегающий Техник)',
        state: { sensitivity: 40, capacity: 50, openness: 60, plasticity: 30, attitude: 20 },
        profile: {
            base: {
                name: 'Райли',
                age: 28,
                gender: 'female',
                anatomy: 'none',
                status: 'asset'
            },
            origin: {
                birthplaceId: CANON_LOCATIONS[1].id, // Глубокие Уровни (Техник)
                professionId: CANON_PROFESSIONS[1].id, // Актив (теперь)
                coreTrauma: 'Была поймана за продажей корпоративных данных на черном рынке',
                biography: 'В прошлом инженер-распределитель энергии на нижних уровнях Пирамиды. Была поймана Калибраторами при попытке слива данных. Ее разум еще не очищен, так как эксперимент требует сознательных реакций.'
            },
            personality: {
                traits: ['Озлобленная', 'Наблюдательная', 'Саркастичная'],
                quirks: ['Желчно комментирует чужие действия'],
                speechStyle: 'Саркастичная, дерзкая, использует технический сленг и мат.',
                coreBelief: 'Знания - это оружие, и корпораты заплатят за то, что сделали со мной.'
            },
            knowledge: {
                common: [
                    'Мир управляется тремя Мегакорпорациями.',
                    'Калибраторы - это цепные псы корпораций, садисты со значками.',
                    'Универсальный стандарт боли был введен в 2071 году.'
                ],
                personal: [
                    'Я Райли, бывший инженер. Я помню чертежи энергетических щитов.',
                    'Я прятала кредиты в вентиляции сектора 4.'
                ],
                secrets: [
                    'Протокол очистки памяти можно заблокировать, если перегрузить импланты.'
                ]
            },
            memory: {
                knownCharacters: {},
                scars: []
            }
        }
    },
    {
        id: 'C-Gamma',
        name: 'Калибратор Гамма',
        state: { sensitivity: 20, capacity: 90, openness: 10, plasticity: 10, attitude: 90 },
        profile: {
            base: {
                name: 'Гамма',
                age: 44,
                gender: 'male',
                anatomy: 'cyber_implant_arm',
                status: 'calibrator'
            },
            origin: {
                birthplaceId: CANON_LOCATIONS[2].id, // Клиники Калибраторов
                professionId: CANON_PROFESSIONS[0].id, // Калибратор
                coreTrauma: undefined,
                biography: 'Наследственный Калибратор. Относится к Активам как к глине, которую надо размять перед учеными. Поставил кибер-руку для прецизионного подавления импульсов сопротивления.'
            },
            personality: {
                traits: ['Хладнокровный', 'Садист', 'Циничный'],
                quirks: ['Постоянно проверяет свои инструменты'],
                speechStyle: 'Сухой, профессиональный тон, без эмоций.',
                coreBelief: 'Через боль и наслаждение мы познаем истину Аномалии.'
            },
            knowledge: {
                common: ['Единственный способ взаимодействовать с Аномалией — вызывать у людей экстремальные эмоции, боль или удовольствие.'],
                personal: ['Специалист по настройке Активов. Регулирует чувствительность.'],
                secrets: ['Существует способ восстановить разум сломанного Актива, но Калибраторы держат его в секрете, чтобы не терять рынок.']
            },
            memory: {
                knownCharacters: {},
                scars: ['amputated left arm']
            }
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
    INSERT INTO characters (id, name, kind, subject_id, profile_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
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
        const validItem = ItemPresetSchema.parse(item);
        insertItemStmt.run(validItem.id, validItem.name, validItem.type, JSON.stringify(validItem.tags || []), validItem.description || '');
    }

    // Load Actions
    const insertActionStmt = db.prepare('INSERT OR IGNORE INTO action_presets (id, label, type, tags, values_json, context_config_json, requires_item) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const act of rawActions) {
        const validAct = ActionPresetSchema.parse(act);
        
        insertActionStmt.run(
            validAct.id,
            validAct.name,
            validAct.categories[0], // map first category as type
            JSON.stringify(validAct.tags),
            JSON.stringify(validAct.vector),
            validAct.contextConfig ? JSON.stringify(validAct.contextConfig) : null,
            validAct.requiresItem || null
        );
    }
    
    // Load Traits
    const insertTraitStmt = db.prepare('INSERT OR IGNORE INTO traits (id, name, description, rules_json) VALUES (?, ?, ?, ?)');
    for (const trait of rawTraits) {
        const validTrait = TraitPresetSchema.parse(trait);
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
        insertProfileStmt.run(
            subject.id, subject.name, 'subject', subject.id, JSON.stringify(subject.profile)
        );
    }
})();const insertPointStmt = db.prepare(`
    INSERT INTO point_presets (id, label, values_json, parent_id, provides_functions, tags) 
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
        label = excluded.label, values_json = excluded.values_json, provides_functions = excluded.provides_functions
`);

const insertSubjectPointStmt = db.prepare(`
    INSERT OR IGNORE INTO subject_point_states
    (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
    db.prepare(`INSERT OR IGNORE INTO character_resources (id, resources) VALUES ('PL-1', '{}')`).run();
    db.prepare(`INSERT OR IGNORE INTO characters (id, name, kind) VALUES ('PL-1', 'Калибратор', 'player')`).run();
    
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
        { id: 'restraint_cuffs', label: 'Скованность: Наручники', type: 'restraint', tags: ['restraint', 'bdsm'], values: { intensity: 0.4, valence: -0.4, contact: 0.5, sharpness: 0.2, novelty: 0.2 }, contextConfig: { duration: -1 } },
        { id: 'context_defiant', label: 'Агрессивный бунт', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_fear_of_loss', label: 'Страх утраты', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.1, valence: -0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_glitch_prone', label: 'Нестабильность имплантов', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.1, valence: -0.1, contact: 0, sharpness: 0, novelty: 0.2 }, contextConfig: { duration: -1 } },
        { id: 'context_sensitive_skin', label: 'Гиперестезия', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.2, valence: 0, contact: 0.2, sharpness: 0.3, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_masochism', label: 'Мазохистская инверсия', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_pleasure_burn', label: 'Ожог удовольствием', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: -0.1, contact: 0, sharpness: 0.1, novelty: 0 }, contextConfig: { duration: -1 } }
    ];
    for (const act of actions) {
        const valJson = { ...act.values, removeContexts: (act as any).removeContexts };
        db.prepare(`INSERT OR REPLACE INTO action_presets (id, label, type, tags, values_json, context_config_json) VALUES (?, ?, ?, ?, ?, ?)`).run(
            act.id, act.label, (act as any).type || 'physical', JSON.stringify((act as any).tags || []), JSON.stringify(valJson), (act as any).contextConfig ? JSON.stringify((act as any).contextConfig) : null
        );
    }

    db.prepare(`INSERT OR REPLACE INTO scenes (id, available_actions, description) VALUES ('lab', '["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike","pose_kneeling","restraint_cuffs"]', 'Темная калибровочная лаборатория корпорации. Кондиционер гонит морозный воздух по полу. На стенах блестят холодные светодиоды диагностов, вокруг операционного стола раскиданы хирургические инструменты и кабеля нейроинтерфейсов.')`).run();
    
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
