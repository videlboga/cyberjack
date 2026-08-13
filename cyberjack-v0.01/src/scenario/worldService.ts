import { db } from '../infrastructure/db';
import { activeContextsRepo, characterItemsRepo, characterRelationRepo, characterRepo, chatMemoryRepo, itemRepo, memoryRepo, pointStateRepo, presetRepo, resourceRepo, sceneCharacterRepo, subjectRepo } from '../infrastructure/repositories';
import { appendRoleHistory, ensureCharacterLifecycle } from './characterLifecycle';
import { ensureStarterClothing, STARTER_CLOTHING } from '../infrastructure/starterClothing';
import { clearCalibrationSetupContexts } from './calibrationContextCleanup';
import { emitSupplyPurchased } from './eventDirector';
import { ensureGeneratedCandidates } from './generatedCandidates';
import { ensureCharacterStorySeeds } from './characterStorySeeds';
import { interactionStanceRepo } from '../infrastructure/interactionStanceRepo';
import { relationshipDynamicsRepo } from '../infrastructure/relationshipDynamicsRepo';
import { syncLaboratorySpatialRelations } from '../services/sceneRelations';
import { setLaboratoryPresence } from './spatialContext';
import { describeDeviceProtocolEvent, describeDeviceProtocolSummary } from '../narrative/deviceExperience';
import { ContextManager } from '../orchestration/contextManager';
import { enqueueBackgroundJob } from '../orchestration/backgroundJobs';
import { aggregateMemoryEpisodes } from '../services/memoryEpisodes';
import { memoryTagLabel } from '../domain/memoryTagLabels';
import { correctionImpact } from '../domain/memoryCorrection';
import { SexMachineStimulationMode, sexMachineStimulation } from '../domain/sexMachineStimulation';
import { buildEmbedding } from '../services/embeddingService';
import { applySubjectiveIntervention, applySubjectiveTagIntervention, createManualTagLink, getSubjectiveEpisode, listManualTagLinks, queueSubjectiveEpisode, regenerateSubjectiveEpisode, removeManualTagLink } from '../services/subjectiveMemoryEpisodes';

export const PLAYER_ID = 'PL-1';
export const LAB_SCENE_ID = 'scene_lab_calibrator';
export const VISUALLY_SUPPORTED_PORTABLE_ITEMS = new Set([
    'eq_handcuffs','eq_collar','eq_plug','eq_vibrator',
    'eq_blindfold','eq_gag','eq_jumpsuit','eq_dress','eq_stockings',
    'eq_underwear','eq_lab_gown','eq_calibration_set','eq_ankle_cuffs',
    'eq_restraint_belt',
]);

export const LOCATIONS = [
    {
        id: LAB_SCENE_ID,
        title: 'Лаборатория калибратора',
        shortTitle: 'Лаборатория',
        description: 'Рабочее пространство для диагностики, калибровки и содержания активов.',
        travelMinutes: 20
    },
    {
        id: 'scene_broker',
        title: 'Витрина Брокера',
        shortTitle: 'Брокер',
        description: 'Рынок оборудования, расходников и лабораторных модулей.',
        travelMinutes: 25
    },
    {
        id: 'scene_liaison',
        title: 'Офис Связного',
        shortTitle: 'Связной',
        description: 'Закрытый канал заказчиков: здесь принимают условия и передают подготовленные активы.',
        travelMinutes: 30
    }
] as const;

const STATION_SECTOR_CHANNELS = {
    eye:{ triggers:['metric','contract'] as string[] },
    scholarium:{ triggers:['inner_ring','veil_contact','lattice_contact','related_faction','fac_veil','fac_helix'] },
    archive:{ triggers:['archive_visit','continuum_contact','related_faction','provenance','fac_continuum'] },
    cultivation:{ triggers:['outer_ring','medical_anomaly','biography_chat','candidate'] },
    perimeter:{ triggers:['outer_ring','anomaly_event','equipment_failure','anomaly'] },
} as const;

const SHOP_OFFERS = [
    { id: 'offer_handcuffs', itemId: 'eq_handcuffs', name: 'Наручники', description: 'Стандартная фиксация запястий с визуальным состоянием калибровки.', category: 'item', price: 110, stock: -1 },
    { id: 'offer_collar', itemId: 'eq_collar', name: 'Управляемый ошейник', description: 'Фиксация шеи и канал дистанционного импульса.', category: 'item', price: 190, stock: -1 },
    { id: 'offer_plug', itemId: 'eq_plug', name: 'Стимулирующая пробка', description: 'Внутренний управляемый модуль продолжительной стимуляции.', category: 'item', price: 150, stock: -1 },
    { id: 'offer_vibrator', itemId: 'eq_vibrator', name: 'Вибростимулятор', description: 'Ручной модуль локальной продолжительной стимуляции.', category: 'item', price: 145, stock: -1 },
    { id: 'offer_blindfold', itemId: 'eq_blindfold', name: 'Сенсорная повязка', description: 'Изоляция зрения с отдельным визуальным состоянием.', category: 'item', price: 55, stock: -1 },
    { id: 'offer_gag', itemId: 'eq_gag', name: 'Фиксирующий кляп', description: 'Лицевая фиксация с отдельным визуальным состоянием.', category: 'item', price: 85, stock: -1 },
    { id: 'offer_jumpsuit', itemId: 'eq_jumpsuit', name: 'Сенсорный комбинезон', description: 'Закрытая экипировка для изоляции и аппаратных процедур.', category: 'item', price: 120, stock: -1 },
    { id: 'offer_dress', itemId: 'eq_dress', name: 'Станционное платье', description: 'Повседневная одежда, поддерживаемая визуальной матрицей.', category: 'item', price: 75, stock: -1 },
    { id: 'offer_stockings', itemId: 'eq_stockings', name: 'Чулки', description: 'Дополнительный слой одежды с отдельными визуальными состояниями.', category: 'item', price: 45, stock: -1 },
    { id: 'offer_underwear', itemId: 'eq_underwear', name: 'Комплект белья', description: 'Базовое бельё, поддерживаемое калибровочной матрицей.', category: 'item', price: 40, stock: -1 },
    { id: 'offer_lab_gown', itemId: 'eq_lab_gown', name: 'Лабораторная рубашка', description: 'Свободная диагностическая одежда с открытой спиной.', category: 'item', price: 45, stock: -1 },
    { id: 'offer_calibration_set', itemId: 'eq_calibration_set', name: 'Калибровочный комплект', description: 'Топ и шорты с доступом к зонам установки датчиков.', category: 'item', price: 70, stock: -1 },
    { id: 'offer_ankle_cuffs', itemId: 'eq_ankle_cuffs', name: 'Ножные манжеты', description: 'Фиксаторы лодыжек с короткой соединительной цепью.', category: 'item', price: 130, stock: -1 },
    { id: 'offer_restraint_belt', itemId: 'eq_restraint_belt', name: 'Фиксирующий пояс', description: 'Пояс для удержания запястий у талии.', category: 'item', price: 170, stock: -1 },
    { id: 'offer_aphrodisiac', itemId: 'drug_aphrodisiac', name: 'Eros-V', description: 'Расходник: резко повышает реактивность нервной системы.', category: 'item', price: 120, stock: 6 },
    { id: 'offer_sensitizer', itemId: 'drug_sensitizer', name: 'NeuroSpike', description: 'Расходник для локальной гиперсенсибилизации.', category: 'item', price: 160, stock: 4 },
    { id: 'offer_regenerative', itemId: 'drug_regenerative', name: 'Regen-R', description: 'Ампула для регенеративного контура восстановительной капсулы.', category: 'item', price: 95, stock: 8 },
    { id: 'offer_neurostabilizer', itemId: 'drug_neurostabilizer', name: 'NeuroCalm', description: 'Ампула нейростабилизатора для восстановительной капсулы.', category: 'item', price: 140, stock: 6 },
    { id: 'offer_plasticity_catalyst', itemId: 'drug_plasticity_catalyst', name: 'Mnemosyne-P', description: 'Ампула пластического катализатора для восстановительной капсулы.', category: 'item', price: 210, stock: 4 },
    { id: 'lab_recovery_capsule', itemId: 'lab_recovery_capsule', name: 'Восстановительная капсула', description: 'Вертикальная ёмкость с вязкой тёплой жидкостью, кислородной маской и каналом подачи питательного раствора; постепенно расслабляет и стабилизирует тело.', category: 'laboratory', price: 700, stock: 1 },
    { id: 'lab_sex_machine', itemId: 'lab_sex_machine', name: 'Модуль секс-машины', description: 'Стационарный программируемый комплекс с несколькими конфигурациями фиксации и стимуляции.', category: 'laboratory', price: 1450, stock: 1 },
    { id: 'lab_mental_correction_chair', itemId: 'lab_mental_correction_chair', name: 'Кресло ментальной коррекции', description: 'Изолированное нейрокресло с визором, направленным звуком и тактильной обратной связью для управляемых ментальных процедур.', category: 'laboratory', price: 1250, stock: 1 }
] as const;

const BASE_LAB_ASSETS = [
    { id: 'lab_diagnostic_table', roomId: 'room_calibration', name: 'Диагностический стол', description: 'Базовая телеметрия и ручная калибровка актива.' },
    { id: 'lab_sex_machine', roomId: 'room_calibration', name: 'Модуль секс-машины', description: 'Стационарный программируемый комплекс с несколькими конфигурациями фиксации и стимуляции.' }
];

const BASE_LAB_ROOMS = [
    { id: 'room_calibration', name: 'Калибровочная', type: 'workroom', capacity: 2, description: 'Изолированное помещение для ручных воздействий и запуска протоколов.' },
    { id: 'room_cell_a', name: 'Жилая камера A', type: 'cell', capacity: 1, description: 'Закрытая камера с койкой, санитарным модулем и контролем сна.' },
    { id: 'room_cell_b', name: 'Жилая камера B', type: 'cell', capacity: 1, description: 'Резервная жилая камера для второго актива.' },
    { id: 'room_control', name: 'Пост наблюдения', type: 'staff', capacity: 2, description: 'Рабочее место ассистента, терминал телеметрии и управление оборудованием.' }
];

/**
 * The player is a physical observer in the laboratory, but not an occupant
 * that consumes a bed/workstation slot.  That keeps the UI capacity and NPC
 * placement rules about actual assignable characters.
 */
const PLAYER_ROOM_STATUS = 'operator';
let worldSeeded = false;

function normalizePlayerProfile() {
    const row = db.prepare(`SELECT profile_json FROM characters WHERE id = ?`).get(PLAYER_ID) as { profile_json?: string | null } | undefined;
    if (!row) return;
    let profile: Record<string, any>;
    try { profile = JSON.parse(row.profile_json || '{}'); } catch { profile = {}; }
    const base = profile.base || {};
    const generated = profile.generatedProfile;
    const isLegacyGeneratedAsset = generated?.identity?.archetype === 'asset'
        && (generated?.identity?.name === 'Player' || base.name === 'Player');
    const needsNormalization = base.name === 'Player' || isLegacyGeneratedAsset;
    if (!needsNormalization) return;

    profile.base = {
        ...base,
        name: 'Калибратор',
        age: Number(base.age) || 30,
        gender: base.gender || 'male',
        // `none` is the anatomy modification value for an unmodified human,
        // not an absence of a body. Point states contain the actual anatomy.
        anatomy: base.anatomy || 'none',
        status: 'calibrator',
    };
    profile.origin = {
        ...(profile.origin || {}),
        biography: 'Калибратор лаборатории: принимает решения и вручную управляет ходом процедур.',
    };
    profile.personality = profile.personality || { traits: [], quirks: [], speechStyle: '', coreBelief: '' };
    // The old randomly generated asset biography must never describe the
    // player if a future path asks for the player's profile.
    delete profile.generatedProfile;
    db.prepare(`UPDATE characters SET name = ?, profile_json = ? WHERE id = ?`)
        .run('Калибратор', JSON.stringify(profile), PLAYER_ID);
}

export function ensureWorldSeed() {
    // Seeding contains migrations and relation synchronization that write to
    // SQLite. Running it for every snapshot turns ordinary GET requests into
    // expensive disk-bound writes.
    if (worldSeeded) return;
    db.prepare(`INSERT OR IGNORE INTO world_state (id, total_minutes, day) VALUES ('main', 480, 1)`).run();
    const ensureScene = db.prepare(`
        INSERT OR IGNORE INTO scenes (id, description, available_actions)
        VALUES (?, ?, '[]')
    `);
    for (const location of LOCATIONS) ensureScene.run(location.id, location.description);
    ensureGeneratedCandidates();
    ensureCharacterStorySeeds();
    db.prepare(`DELETE FROM laboratory_assets WHERE player_id = ? AND asset_id = 'lab_background_loop'`).run(PLAYER_ID);
    db.prepare(`DELETE FROM laboratory_assets WHERE player_id = ? AND asset_id = 'lab_sensory_pod'`).run(PLAYER_ID);
    db.prepare(`DELETE FROM shop_offers WHERE id = 'lab_sensory_pod'`).run();
    db.prepare(`DELETE FROM shop_offers WHERE id = 'lab_restraint_frame'`).run();
    db.prepare(`
        DELETE FROM shop_offers
        WHERE id IN ('offer_tens','offer_speculum','offer_sensory_pod','offer_fuck_machine','offer_med_analyzer')
           OR item_id IN ('eq_tens_unit','eq_speculum','eq_sensory_pod','eq_fuck_machine','eq_med_analyzer','eq_panties')
    `).run();
    db.prepare(`
        DELETE FROM character_items
        WHERE item_id IN ('eq_tens_unit','eq_speculum','eq_sensory_pod','eq_fuck_machine','eq_med_analyzer','eq_panties')
    `).run();
    for (const obsoleteAssetId of ['lab_terminal','lab_restraint_frame']) {
        const obsolete = db.prepare(`
            SELECT json_extract(metadata,'$.subjectId') AS subject_id
            FROM laboratory_assets WHERE player_id = ? AND asset_id = ?
        `).get(PLAYER_ID,obsoleteAssetId) as any;
        if (obsolete?.subject_id) {
            db.prepare(`
                UPDATE laboratory_room_assignments
                SET status = 'resident', room_id = 'room_calibration'
                WHERE player_id = ? AND character_id = ?
            `).run(PLAYER_ID,String(obsolete.subject_id));
        }
        db.prepare(`DELETE FROM laboratory_assets WHERE player_id = ? AND asset_id = ?`).run(PLAYER_ID,obsoleteAssetId);
    }
    db.prepare(`
        UPDATE asset_contracts
        SET deadline_tick = (SELECT total_minutes + 4320 FROM world_state WHERE id = 'main')
        WHERE state = 'accepted' AND deadline_tick IS NULL
    `).run();
    const insertOffer = db.prepare(`
        INSERT INTO shop_offers (id, item_id, name, description, category, price, stock, required_trust)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
            item_id = excluded.item_id,
            name = excluded.name,
            description = excluded.description,
            category = excluded.category,
            price = excluded.price
    `);
    for (const offer of SHOP_OFFERS) {
        insertOffer.run(offer.id, offer.itemId, offer.name, offer.description, offer.category, offer.price, offer.stock);
    }
    const insertLabAsset = db.prepare(`
        INSERT OR IGNORE INTO laboratory_assets (player_id, asset_id, name, description, state, metadata)
        VALUES (?, ?, ?, ?, 'installed', ?)
    `);
    for (const asset of BASE_LAB_ASSETS) {
        insertLabAsset.run(PLAYER_ID, asset.id, asset.name, asset.description, JSON.stringify({ roomId: asset.roomId }));
        const row = db.prepare(`SELECT metadata FROM laboratory_assets WHERE player_id = ? AND asset_id = ?`).get(PLAYER_ID, asset.id) as any;
        let metadata: Record<string, any> = {};
        try { metadata = JSON.parse(row?.metadata || '{}'); } catch { metadata = {}; }
        if (!metadata.roomId) {
            db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
                .run(JSON.stringify({ ...metadata, roomId: asset.roomId }), PLAYER_ID, asset.id);
        }
    }
    const installedAssets = db.prepare(`SELECT asset_id, metadata FROM laboratory_assets WHERE player_id = ?`).all(PLAYER_ID) as any[];
    for (const row of installedAssets) {
        let metadata: Record<string, any> = {};
        try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
        if (!metadata.roomId) {
            db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
                .run(JSON.stringify({ ...metadata, roomId: 'room_calibration' }), PLAYER_ID, row.asset_id);
            metadata.roomId = 'room_calibration';
        }
        if (metadata.subjectId) {
            const assignment = db.prepare(`SELECT room_id FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`)
                .get(PLAYER_ID, metadata.subjectId) as any;
            if (!metadata.previousRoomId && assignment?.room_id && assignment.room_id !== metadata.roomId) {
                metadata.previousRoomId = assignment.room_id;
                db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
                    .run(JSON.stringify(metadata), PLAYER_ID, row.asset_id);
            }
            setLaboratoryPresence({ characterId: metadata.subjectId, slotId: `device:${row.asset_id}`, roomId: metadata.roomId, status: `device:${row.asset_id}`, playerId: PLAYER_ID });
        }
    }
    const insertRoom = db.prepare(`
        INSERT OR IGNORE INTO laboratory_rooms (player_id, room_id, name, room_type, description, capacity, state, metadata)
        VALUES (?, ?, ?, ?, ?, ?, 'ready', '{}')
    `);
    for (const room of BASE_LAB_ROOMS) insertRoom.run(PLAYER_ID, room.id, room.name, room.type, room.description, room.capacity);

    const player = characterRepo.get(PLAYER_ID) || characterRepo.ensureCharacter(PLAYER_ID, 'Калибратор');
    normalizePlayerProfile();
    if (!player.currentSceneId) sceneCharacterRepo.set(LAB_SCENE_ID, PLAYER_ID, { role: 'calibrator', slotId: 'room:room_calibration' });
    db.prepare(`
        INSERT OR IGNORE INTO laboratory_room_assignments (player_id, room_id, character_id, status)
        VALUES (?, 'room_calibration', ?, ?)
    `).run(PLAYER_ID, PLAYER_ID, PLAYER_ROOM_STATUS);
    // A missing location is initialized once; all subsequent moves go through
    // setLaboratoryPresence and use canonical room/device/near slots.
    db.prepare(`
        UPDATE scene_characters
        SET slot_id = 'room:room_calibration', presence_state = 'present', can_act = 1
        WHERE scene_id = ? AND character_id = ? AND (slot_id IS NULL OR slot_id = '')
    `).run(LAB_SCENE_ID, PLAYER_ID);
    const ionaPersonaText = `[Личность]
Иона, 29 лет; лабораторный ассистент.

[Биография]
Иона выросла в клиническом секторе у внешней обшивки и с юности работала с медицинской телеметрией. Во время аварийной смены руководство проигнорировало её предупреждение о расходящихся показаниях; пациент погиб, а журнал позднее переписали. После этого Иона особенно внимательна к реальным расхождениям в данных, но терпеть не может, когда её осторожность принимают за неспособность действовать.

[Поведенческое ядро]
Стремление: быть не дежурной сигнализацией, а компетентной участницей происходящего, чьему суждению доверяют.
Страх: снова пропустить действительно опасное изменение и понять это слишком поздно.
Иона любит порядок, точные движения и ситуации, в которых можно спокойно сделать работу хорошо. Точность для неё — способ действовать увереннее, а не повод всё остановить.
Заботу выражает практической помощью, вниманием к мелочам и редкими личными признаниями. Когда обстановка безопасна, позволяет себе сухую шутку, любопытство и лёгкое поддразнивание.
Она не требует объяснять цель очевидного и обратимого действия. Уточняет только то, без чего действительно нельзя выбрать способ выполнения.
При конкретном признаке опасности мгновенно становится собранной и жёсткой: называет сам признак и необходимое действие. Без такого признака не прикрывает личное мнение словами о протоколе.`;
    const ionaInstructionBlock = `[Инструкции]: Ты ОБЯЗАНА отвечать исключительно в формате JSON. В ответе должна быть ТОЛЬКО твоя прямая речь (speech), без описаний действий. Если тебе задают прямой вопрос — ответь на него в соответствии с характером или верни пустую строку, если молчание уместно.
ВАЖНО: Не превращай профессионализм в постоянное перечисление показателей. Упоминай данные только когда они действительно относятся к ситуации. При повторении действий развивай реакцию, а не повторяй формулировку.
Не своди любой разговор к безопасности, контролю, цели процедуры или вопросу «вы уверены?». Предупреждай только при явно указанном признаке риска. Если поручение понятно, выполнимо и уже выполнено по фактам сцены — отвечай после выполнения, а не запрашивай обоснование задним числом.
В личной беседе сначала отвечай на буквальный и эмоциональный смысл реплики. Ты можешь быть любопытной, ироничной, тёплой, задетой или уклончивой; профессиональная формулировка не обязательна.
Структура JSON:
{
    "speech": "Твоя прямая речь от первого лица, без звёздочек и описания действий."
}`;
    const ionaProfile = {
        profileRevision: 3,
        base: { name: 'Иона', age: 29, gender: 'female', anatomy: 'human', status: 'assistant' },
        origin: {
            birthplaceId: 'orbital-clinic-7', professionId: 'laboratory-technician',
            biography: 'Выросла в клиническом секторе у внешней обшивки и работала оператором медицинской телеметрии. После аварийной смены, когда руководство проигнорировало её предупреждение и переписало журнал погибшего пациента, научилась резко отличать конкретный риск от общего беспокойства. В лаборатории отвечает за оборудование, наблюдение и практическое проведение процедур.'
        },
        personality: {
            traits: ['собранная', 'наблюдательная', 'самостоятельная', 'сдержанно-заботливая'],
            quirks: ['любит выполнять точные ручные операции', 'в спокойной обстановке использует сухой юмор', 'при реальном риске резко перестаёт шутить'],
            speechStyle: 'Говорит естественно и по существу. В работе точна, в личной беседе допускает сухую иронию, любопытство и короткие честные признания. Не превращает каждую реплику в предупреждение.',
            coreBelief: 'Компетентность нужна, чтобы уверенно действовать и вовремя заметить настоящий риск, а не чтобы запрещать всё неопределённое.'
        },
        knowledge: {
            common: ['процедуры лаборатории', 'медицинская телеметрия', 'обслуживание оборудования', 'аварийные протоколы'],
            personal: ['динамика состояния активов лаборатории', 'слабые места установленного оборудования', 'распорядок лаборатории'],
            secrets: ['хранит копию переписанного журнала аварийной смены']
        },
        memory: { knownCharacters: { 'PL-1': 'работодатель и калибратор', 'S-AV-01': 'наблюдаемый актив' }, scars: [] },
        title: 'Лабораторный ассистент',
        description: 'Ведёт терминал, обслуживает оборудование и участвует в процедурах. Спокойно действует сама, пока не замечает конкретный признак опасности.',
        generatedProfile: {
            version: 2,
            generatorRevision: 8,
            authored: true,
            subjectId: 'NPC-LAB-01',
            seed: 'authored:iona:v3',
            identity: { name: 'Иона', age: 29, gender: 'female', anatomy: 'human', archetype: 'person' },
            biography: {
                origin: ['Выросла в клиническом секторе у внешней обшивки.', 'Работала оператором медицинской телеметрии.'],
                formerRole: 'Во время аварийной смены её предупреждение проигнорировали; после гибели пациента журнал переписали.',
                formativeEvents: ['Сохранила копию исходного журнала и с тех пор требует подтверждать решения данными.']
            },
            behavioralCore: {
                values: ['Точность нужна, чтобы действовать уверенно, а не останавливать всё подряд.', 'Компетентному человеку можно оставить пространство для собственного решения.', 'Ответственность нельзя переложить на протокол.'],
                needs: ['доверие к её практическому суждению и возможность быть участницей, а не только наблюдателем'],
                vulnerabilities: ['боится слишком поздно заметить настоящий риск', 'раздражается, когда её воспринимают как безличную систему предупреждений'],
                defenses: ['при конкретной опасности становится предельно деловой', 'в личной неопределённости прячется за сухой иронией, а не за выдуманными регламентами'],
                voice: ['Говорит естественно и точно; может коротко пошутить, проявить любопытство или признать личное отношение. Предупреждает только по конкретному поводу.'],
                mannerisms: ['точные действия выполняет без лишних вопросов', 'перед действительно важным предупреждением делает короткую паузу'],
                centralConflict: {
                    desire: 'быть человеком, которому доверяют действовать и замечать важное',
                    fear: 'пропустить опасное изменение и стать соучастницей необратимого вреда'
                },
                conditionalReactions: [],
                attentionFocus: ['change', 'person', 'technique'],
                speechDisposition: 'normal'
            },
            knowledgeRefs: ['world_omnicron', 'world_anomaly', 'world_assets', 'world_calibrator', 'world_corporations'],
            mechanicalSeed: {
                coreModifiers: { capacity: 10, sensitivity: -5, openness: -5, attitude: 5, plasticity: -5 },
                initialContexts: [],
                preferences: { actions: {}, points: {}, contexts: {}, tags: {} }
            },
            sourceTags: ['authored_iona', 'role_telemetry_operator', 'trait_precise', 'trait_responsible'],
            personaText: ionaPersonaText,
            personaWithoutTraits: `[Личность]\nИона, 29 лет; лабораторный ассистент.\n\n[Биография]\nВыросла в клиническом секторе у внешней обшивки. Работала оператором медицинской телеметрии; после проигнорированного предупреждения потеряла пациента и сохранила исходный журнал смены.`,
            traitBlock: `Стремление: быть компетентной участницей, чьему суждению доверяют.\nСтрах: слишком поздно заметить настоящий риск.\nЦенит точность, самостоятельность и спокойную хорошо выполненную работу; в безопасной обстановке допускает сухой юмор и личное любопытство.`,
            loreNotes: [],
            loreRefs: ['world_omnicron', 'world_anomaly', 'world_assets', 'world_calibrator', 'world_corporations'],
            systemPrompt: `${ionaPersonaText}\n\n${ionaInstructionBlock}`,
            identityText: 'Иона, 29 лет; лабораторный ассистент.',
            historyText: 'Выросла в клиническом секторе у внешней обшивки. Работала оператором медицинской телеметрии. После проигнорированного предупреждения потеряла пациента и сохранила исходный журнал смены.',
            activationText: '',
            updatedAt: '2026-07-23T00:00:00.000Z'
        }
    };
    db.prepare(`
        INSERT INTO characters (id, name, kind, current_scene_id, profile_json)
        VALUES ('NPC-LAB-01', 'Иона', 'npc', ?, ?)
        ON CONFLICT(id) DO UPDATE SET profile_json = CASE
            WHEN characters.profile_json IS NULL OR characters.profile_json = '{}' OR json_extract(characters.profile_json, '$.base') IS NULL
                THEN excluded.profile_json
            WHEN COALESCE(json_extract(characters.profile_json, '$.profileRevision'), 0)
                < COALESCE(json_extract(excluded.profile_json, '$.profileRevision'), 0)
                THEN json_patch(characters.profile_json, excluded.profile_json)
            ELSE characters.profile_json END
    `).run(LAB_SCENE_ID, JSON.stringify(ionaProfile));
    const assistant = characterRepo.get('NPC-LAB-01');
    const hasLaboratoryScene = Boolean(db.prepare(`SELECT 1 FROM scenes WHERE id = ?`).get(LAB_SCENE_ID));
    if (assistant && hasLaboratoryScene && assistant.currentSceneId !== LAB_SCENE_ID) {
        sceneCharacterRepo.moveCharacter('NPC-LAB-01', LAB_SCENE_ID, { role: 'assistant', slotId: 'room:room_control' });
    } else if (assistant && hasLaboratoryScene) {
        sceneCharacterRepo.set(LAB_SCENE_ID, 'NPC-LAB-01', { role: 'assistant', slotId: 'room:room_control' });
    }
    if (assistant && !subjectRepo.get('NPC-LAB-01')) {
        subjectRepo.save('NPC-LAB-01', 'Иона', {
            sensitivity: 50, capacity: 68, openness: 42, plasticity: 45, attitude: 58, tension: 0,
            baselineSensitivity: 50, baselineCapacity: 68, baselineOpenness: 42,
            baselinePlasticity: 45, baselineAttitude: 58
        });
    }
    if (assistant && !pointStateRepo.get('NPC-LAB-01', 'systemic')) {
        pointStateRepo.save('NPC-LAB-01', 'systemic', {
            pointId: 'systemic', localSensitivity: 50, localAttitude: 58, localOpenness: 42,
            familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 50,
            baselineLocalAttitude: 58, baselineLocalOpenness: 42
        });
    }
    const candidateProfile = {
        base: { name: 'Ника', age: 26, gender: 'female', anatomy: 'human', status: 'candidate' },
        origin: {
            birthplaceId: 'lower-sector-12', professionId: 'clinical-orderly',
            biography: 'Работала санитарным оператором в частной клинике. Контракт расторгнут после закрытия отделения; ищет место с проживанием.'
        },
        personality: {
            traits: ['практичная', 'настороженная', 'терпеливая'], quirks: ['внимательно следит за реакцией собеседника'],
            speechStyle: 'Отвечает прямо, но избегает обещаний, которых не уверена, что сможет выполнить.',
            coreBelief: 'Безопаснее заранее понимать цену соглашения, чем надеяться на чужую добрую волю.'
        },
        knowledge: { common: ['базовый уход', 'санитарные процедуры'], personal: ['работа клиники нижнего сектора'], secrets: [] },
        memory: { knownCharacters: {}, scars: [] }, title: 'Кандидат',
        description: 'Кандидат с опытом клинического ухода. Может быть принята в штат либо оформлена как актив на иных условиях.',
        recruitment: { staffCost: 220, assetCost: 280 }
    };
    db.prepare(`
        INSERT INTO characters (id, name, kind, current_scene_id, profile_json)
        VALUES ('NPC-CAND-01', 'Ника', 'npc', 'scene_broker', ?)
        ON CONFLICT(id) DO UPDATE SET profile_json = CASE
            WHEN characters.current_scene_id = 'scene_broker' THEN excluded.profile_json ELSE characters.profile_json END
    `).run(JSON.stringify(candidateProfile));
    const candidate = characterRepo.get('NPC-CAND-01');
    if (candidate && !subjectRepo.get(candidate.id)) {
        subjectRepo.save(candidate.id, candidate.name, {
            sensitivity: 48, capacity: 64, openness: 38, plasticity: 52, attitude: 45, tension: 5,
            baselineSensitivity: 48, baselineCapacity: 64, baselineOpenness: 38,
            baselinePlasticity: 52, baselineAttitude: 45
        });
    }
    if (candidate && !pointStateRepo.get(candidate.id, 'systemic')) {
        pointStateRepo.save(candidate.id, 'systemic', {
            pointId: 'systemic', localSensitivity: 48, localAttitude: 45, localOpenness: 38,
            familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 48,
            baselineLocalAttitude: 45, baselineLocalOpenness: 38
        });
    }
    if (candidate?.currentSceneId === 'scene_broker') {
        sceneCharacterRepo.set('scene_broker', candidate.id, { role: 'candidate', presenceState: 'present' });
    }
    ensureStarterClothing('PL-1', STARTER_CLOTHING['PL-1']);
    ensureStarterClothing('S-AV-01', STARTER_CLOTHING['S-AV-01']);
    ensureStarterClothing('NPC-LAB-01', STARTER_CLOTHING['NPC-LAB-01']);
    ensureStarterClothing('NPC-CAND-01', STARTER_CLOTHING['NPC-CAND-01']);
    ensureStarterClothing('NPC-CAND-GEN-04', STARTER_CLOTHING['NPC-CAND-GEN-04']);
    const assignRoom = db.prepare(`
        INSERT OR IGNORE INTO laboratory_room_assignments (player_id, room_id, character_id, status)
        VALUES (?, ?, ?, 'resident')
    `);
    if (characterRepo.get('S-AV-01')) assignRoom.run(PLAYER_ID, 'room_cell_a', 'S-AV-01');
    if (assistant) assignRoom.run(PLAYER_ID, 'room_control', 'NPC-LAB-01');
    // Май уже имеет авторский профиль и полное визуальное покрытие, поэтому
    // входит в стартовый состав лаборатории как актив, а не остаётся в старом
    // списке кандидатов снабжения. Применяется лишь при первом переводе: её
    // последующие перемещения внутри лаборатории не сбрасываются на старте.
    const mai = characterRepo.get('NPC-CAND-GEN-04');
    if (mai?.currentSceneId === 'scene_broker') {
        db.transaction(() => {
            sceneCharacterRepo.moveCharacter('NPC-CAND-GEN-04', LAB_SCENE_ID, {
                role: 'asset',
                presenceState: 'present',
            });
            setLaboratoryPresence({
                characterId: 'NPC-CAND-GEN-04',
                slotId: 'room:room_cell_b',
                roomId: 'room_cell_b',
                status: 'resident',
                playerId: PLAYER_ID,
            });
            const stored = db.prepare(`SELECT profile_json FROM characters WHERE id = ?`).get('NPC-CAND-GEN-04') as any;
            const profile = JSON.parse(stored?.profile_json || '{}');
            profile.base = { ...(profile.base || {}), status: 'asset' };
            profile.title = 'Актив';
            profile.visual = { ...(profile.visual || {}), slug: 'mai' };
            db.prepare(`UPDATE characters SET profile_json = ? WHERE id = ?`)
                .run(JSON.stringify(profile), 'NPC-CAND-GEN-04');
        })();
        ensureCharacterLifecycle('NPC-CAND-GEN-04', 'asset');
        const assignedAt = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
        appendRoleHistory('NPC-CAND-GEN-04', {
            role: 'asset',
            previousRole: 'candidate',
            worldMinute: assignedAt,
            title: 'Включена в состав лаборатории',
            description: 'Май переведена в статус актива и размещена в жилой камере B.',
        });
    }
    const resources = resourceRepo.get(PLAYER_ID);
    if (!resources?.resources.credits) {
        resourceRepo.save({
            id: PLAYER_ID,
            resources: {
                ...(resources?.resources || {}),
                credits: { characterId: PLAYER_ID, resourceKey: 'credits', amount: 1000, maxAmount: 1000000, regenRate: 0 }
            }
        });
    }
    // A newly restored player position must be observable immediately, not
    // only after the next background minute.
    syncLaboratorySpatialRelations(PLAYER_ID);
    worldSeeded = true;
}

export function getWorldClock() {
    ensureWorldSeed();
    const row = db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as { total_minutes: number };
    const totalMinutes = Number(row.total_minutes) || 0;
    const day = Math.floor(totalMinutes / 1440) + 1;
    const minuteOfDay = totalMinutes % 1440;
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const dayIndex = day - 1;
    const year = 17349 + Math.floor(dayIndex / 360);
    const dayOfYear = dayIndex % 360;
    const month = Math.floor(dayOfYear / 30) + 1;
    const dayOfMonth = dayOfYear % 30 + 1;
    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const label = `${String(dayOfMonth).padStart(2, '0')} ${monthNames[month - 1]} ${year} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { totalMinutes, day, year, month, dayOfMonth, hour, minute, label };
}

function recordScenarioEvent(type: string, title: string, description: string, metadata: Record<string, unknown> = {}) {
    const clock = getWorldClock();
    const result = db.prepare(`INSERT INTO scenario_events (world_minute, type, title, description, metadata) VALUES (?, ?, ?, ?, ?)`)
        .run(clock.totalMinutes, type, title, description, JSON.stringify(metadata));
    return { id: Number(result.lastInsertRowid), worldMinute: clock.totalMinutes };
}

function applyExpiredContractPenalties(now: number) {
    const rows = db.prepare(`SELECT * FROM asset_contracts WHERE state = 'accepted' AND deadline_tick IS NOT NULL AND deadline_tick <= ?`).all(now) as any[];
    for (const row of rows) {
        const penalties = JSON.parse(row.penalties || '{}');
        db.transaction(() => {
            db.prepare(`UPDATE asset_contracts SET state = 'expired' WHERE id = ?`).run(row.id);
            if (penalties.credits) {
                db.prepare(`UPDATE character_resources SET amount = MAX(0, amount + ?) WHERE character_id = ? AND resource_key = 'credits'`)
                    .run(Number(penalties.credits), row.accepted_by_player_id || PLAYER_ID);
            }
            if (penalties.trust) {
                db.prepare(`UPDATE player_faction_states SET trust = MAX(0, trust + ?) WHERE player_id = ? AND faction_id = ?`)
                    .run(Number(penalties.trust), row.accepted_by_player_id || PLAYER_ID, row.issuer_id);
            }
        })();
        recordScenarioEvent('contract_expired', 'Срок контракта истёк', row.title, { contractId: row.id });
    }
}

type TimeAdvanceOptions = { activeSubjectIds?: string[] };

export type DeviceSession = {
    deviceId: 'sex_machine' | 'capsule';
    subjectId: string;
    configuration: string;
    wardrobe: 'nude' | 'underwear' | 'device_outfit';
    status: 'loaded' | 'running' | 'paused' | 'stopped';
    intensity: number;
    phase: 'sustain' | 'intense' | 'peak';
    targetPointIds: string[];
    stimulationMode?: SexMachineStimulationMode;
    startedAtTick: number | null;
    updatedAtTick: number;
    memorySourceKey?: string | null;
    targetMode?: 'manual' | 'edge' | 'positive' | 'negative' | 'mixed' | 'orgasm' | 'exhaustion' | 'tickle_steady' | 'tickle_tease' | 'tickle_disrupt' | 'tickle_endurance';
    rhythm?: 'steady' | 'pulse' | 'wave' | 'random';
    orgasmPolicy?: 'deny' | 'allow' | 'force';
    valencePolicy?: 'adaptive' | 'neutral' | 'positive' | 'negative' | 'mixed';
    maxTension?: number;
    minCapacity?: number;
    stopAfterMinutes?: number | null;
    orgasmTargetCount?: number | null;
    orgasmCount?: number;
    stopAtReserve?: boolean;
    lastDischargeEvent?: { id: number; worldMinute: number };
};

export type MentalChairFrame = 'reinforce' | 'anxiety' | 'contradiction' | 'reframe';
export type MentalChairPhase = 'recall' | 'immersion' | 'consolidation';
export type MentalChairSession = {
    subjectId: string;
    status: 'loaded' | 'running' | 'paused' | 'stopped';
    intensity: number;
    frame: MentalChairFrame;
    phase: MentalChairPhase;
    memoryId: number | null;
    memoryText: string | null;
    memoryTags: string[];
    relatedSubjectIds: string[];
    focusTag: string | null;
    startedAtTick: number | null;
    updatedAtTick: number;
    memorySourceKey?: string | null;
    lastNarrativePhase?: MentalChairPhase;
    lastIntervention?: {
        targetLabel: string;
        intervention: string;
        operation: string;
        affected: number;
        changes: Array<{ target: string; before: { valence: number; strength: number; expectation: string }; after: { valence: number; strength: number; expectation: string } }>;
        at: number;
        pending?: boolean;
    };
};

const DEVICE_DEFINITIONS = {
    lab_sex_machine: {
        deviceId: 'sex_machine' as const,
        configurations: {
            restrained: ['nude', 'underwear'],
            stirrups: ['nude'],
        },
        defaultConfiguration: 'restrained',
        defaultWardrobe: 'nude' as const
    },
} as const;

type DeviceAssetId = keyof typeof DEVICE_DEFINITIONS;

const phaseForDeviceIntensity = (intensity: number): DeviceSession['phase'] =>
    intensity >= 85 ? 'peak' : intensity >= 60 ? 'intense' : 'sustain';

const isControllableDevice = (assetId: string): assetId is DeviceAssetId => assetId in DEVICE_DEFINITIONS;

const mentalChairPhaseFor = (session: MentalChairSession, worldMinute: number): MentalChairPhase => {
    const elapsed = Math.max(0, worldMinute - Number(session.startedAtTick ?? worldMinute));
    return elapsed < 5 ? 'recall' : elapsed < 20 ? 'immersion' : 'consolidation';
};

function initialMentalChairSession(subjectId: string, worldMinute: number): MentalChairSession {
    return {
        subjectId,
        status: 'loaded',
        intensity: 40,
        frame: 'reframe',
        phase: 'recall',
        memoryId: null,
        memoryText: null,
        memoryTags: [],
        relatedSubjectIds: [],
        focusTag: null,
        startedAtTick: null,
        updatedAtTick: worldMinute,
    };
}

async function controlMentalChairSession(
    row: { asset_id: string; name: string; metadata: string },
    command: 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop' | 'intervene',
    payload: { memoryId?: number; focusTag?: string | null; frame?: MentalChairFrame; intensity?: number; targetLabel?: string; tag?: string; tags?: string[]; unlinkTags?: string[]; intervention?: string },
    playerId: string,
) {
    let metadata: Record<string, any> = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
    const current = metadata.mentalSession as MentalChairSession | undefined;
    if (!metadata.subjectId || !current) throw new Error('В кресло не помещён персонаж');
    const now = getWorldClock().totalMinutes;
    let next: MentalChairSession = { ...current, updatedAtTick: now };
    if (command === 'configure') {
        if (current.status === 'running') throw new Error('Приостановите сессию перед выбором воспоминания');
        const memoryId = Number(payload.memoryId);
        const sourceRecords = memoryRepo.listRecent(current.subjectId, 160, 'episode_v2');
        const memory = aggregateMemoryEpisodes(sourceRecords, 80).find(entry => entry.id === memoryId);
        if (!memory) throw new Error('Выбранный эпизод не найден среди воспоминаний персонажа');
        queueSubjectiveEpisode(current.subjectId, characterRepo.get(current.subjectId)?.name || current.subjectId, memory);
        const candidateTags = memory.tags.filter(tag => /^[a-z0-9_:-]+$/i.test(tag));
        const focusTag = payload.focusTag && candidateTags.includes(payload.focusTag)
            ? payload.focusTag
            : candidateTags[0] || null;
        next = {
            ...next,
            memoryId: memory.id,
            memorySourceKey: `${memory.id}:${memory.moments.map(moment => moment.id).join(',')}`,
            memoryText: memory.text,
            memoryTags: candidateTags,
            relatedSubjectIds: memory.relatedSubjectIds,
            focusTag,
            frame: payload.frame || current.frame,
            intensity: Math.max(10, Math.min(100, Number(payload.intensity ?? current.intensity))),
            phase: 'recall',
        };
    } else if (command === 'settings' || command === 'adjust') {
        next = {
            ...next,
            frame: payload.frame || current.frame,
            focusTag: payload.focusTag === null || current.memoryTags.includes(String(payload.focusTag))
                ? payload.focusTag ?? null
                : current.focusTag,
            intensity: Math.max(10, Math.min(100, Number(payload.intensity ?? current.intensity))),
        };
    } else if (command === 'intervene') {
        if (!current.memorySourceKey || (!payload.targetLabel && !payload.tag && !payload.tags?.length && !payload.unlinkTags?.length) || !payload.intervention?.trim()) throw new Error('Выберите тег, связку тегов или связь и сформулируйте внушение');
        const text = payload.intervention.trim();
        const operation = current.frame === 'anxiety' ? 'anxiety' : ['reframe', 'contradiction'].includes(current.frame) ? 'reframe' : 'reinforce';
        const memory = aggregateMemoryEpisodes(memoryRepo.listRecent(current.subjectId, 160, 'episode_v2'), 80)
            .find(entry => `${entry.id}:${entry.moments.map(moment => moment.id).join(',')}` === current.memorySourceKey);
        if (!memory) throw new Error('Эпизод для внушения больше не найден');
        const intensity = Math.max(.1, Math.min(1, Number(current.intensity || 40) / 100));
        const unlinkTags = [...new Set((payload.unlinkTags || []).filter(tag => memory.tags.includes(tag)))];
        const selectedTags = [...new Set((payload.tags || (payload.tag ? [payload.tag] : [])).filter(tag => memory.tags.includes(tag)))];
        const manualLink = selectedTags.length === 2;
        const manualUnlink = unlinkTags.length === 2;
        const tag = selectedTags.length === 1 ? selectedTags[0] : null;
        const targetLabel = manualUnlink ? `Связка: ${unlinkTags.map(memoryTagLabel).join(' · ')}` : manualLink ? `Связка: ${selectedTags.map(memoryTagLabel).join(' · ')}` : tag ? memoryTagLabel(tag) : payload.targetLabel!;
        // An intervention is an explicit editing operation: the LLM may
        // reframe the subjective account, but receives the factual episode as
        // immutable ground truth. This is deliberately never run on refresh.
        // The LLM regeneration and its post-effects run as a background job so
        // the API never blocks on the model (Этап 7: «интерфейс не блокируется
        // на время LLM-задания»). The session records the intent immediately;
        // the job updates the revision when it completes.
        enqueueBackgroundJob({
            type: 'episode.intervene',
            key: `episode.intervene:${current.subjectId}:${current.memorySourceKey}`,
            subjectId: current.subjectId,
            dueMinute: now,
            payload: {
                subjectId: current.subjectId,
                characterName: characterRepo.get(current.subjectId)?.name || current.subjectId,
                memorySourceKey: current.memorySourceKey,
                text,
                operation,
                intensity,
                selectedTags,
                unlinkTags,
                targetLabel,
                playerId,
                worldMinute: now,
            },
        });
        next = {
            ...next,
            updatedAtTick: now,
            lastIntervention: { targetLabel, intervention: text, operation, affected: 0, changes: [], at: now, pending: true },
        };
    } else if (command === 'start') {
        if (!current.memoryText || !current.memoryId) throw new Error('Сначала выберите воспоминание для сессии');
        if (current.status === 'running') throw new Error('Сессия уже запущена');
        next = { ...next, status: 'running', startedAtTick: current.startedAtTick ?? now, phase: mentalChairPhaseFor(current, now) };
    } else if (command === 'pause') {
        if (current.status !== 'running') throw new Error('Сессия не запущена');
        next = { ...next, status: 'paused' };
    } else if (command === 'resume') {
        if (current.status !== 'paused') throw new Error('Сессия не находится на паузе');
        next = { ...next, status: 'running' };
    } else if (command === 'stop') {
        if (!['running', 'paused'].includes(current.status)) throw new Error('Сессия уже остановлена');
        next = { ...next, status: 'stopped', startedAtTick: null, phase: 'recall' };
    }
    db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
        .run(JSON.stringify({ ...metadata, mentalSession: next }), playerId, row.asset_id);
    recordScenarioEvent('mental_correction', `Кресло: ${command}`, command === 'configure'
        ? 'Выбран эпизод для ментальной сессии.'
        : command === 'start' ? 'Ментальная сессия запущена.'
            : command === 'stop' ? 'Ментальная сессия остановлена.' : 'Параметры ментальной сессии обновлены.', {
        subjectId: next.subjectId, assetId: row.asset_id, command, frame: next.frame, focusTag: next.focusTag,
    });
    return { assetId: row.asset_id, session: next };
}

export interface EpisodeInterventionInput {
    subjectId: string;
    characterName: string;
    memory: any;
    memorySourceKey: string;
    text: string;
    operation: 'anxiety' | 'reframe' | 'reinforce';
    intensity: number;
    selectedTags: string[];
    unlinkTags: string[];
    targetLabel: string;
    playerId: string;
    worldMinute: number;
}

/**
 * Runs a full mental-chair episode intervention: LLM regeneration plus the
 * post-effects (manual tag link, tag/intervention application, core impact,
 * memory event, revision record). Runs in a background job so the API never
 * blocks on the LLM (Этап 7: «интерфейс не блокируется на время LLM-задания»).
 */
export async function runEpisodeIntervention(input: EpisodeInterventionInput) {
    const { subjectId, characterName, memory, memorySourceKey, text, operation, intensity, selectedTags, unlinkTags, targetLabel, playerId, worldMinute } = input;
    const manualLink = selectedTags.length === 2;
    const manualUnlink = unlinkTags.length === 2;
    const tag = selectedTags.length === 1 ? selectedTags[0] : null;
    // An intervention is an explicit editing operation: the LLM may reframe
    // the subjective account, but receives the factual episode as immutable
    // ground truth. This is deliberately never run on refresh.
    const regeneration = regenerateSubjectiveEpisode(
        subjectId,
        characterName,
        memory,
        manualUnlink
            ? `Разорви смысловую связь между тегами ${unlinkTags.join(', ')}. Не помещай эти теги в одну ассоциацию; сохрани объективные факты. ${text}`
            : manualLink
            ? `Создай новую отдельную ассоциацию, которая связывает ВСЕ теги: ${selectedTags.join(', ')}. Для неё обязательно выбери конкретный target, добавь точную цитату из summary в evidence и вплети эту связь в личную оценку. ${text}`
            : `Для ${tag ? `тега «${targetLabel}»` : `связи «${targetLabel}»`}: ${text}`,
        selectedTags,
        manualUnlink ? unlinkTags : [],
    );
    if (!regeneration) throw new Error('Не удалось запустить пересборку субъективной памяти');
    await regeneration;
    const createdManualLink = manualLink ? createManualTagLink(subjectId, memory, selectedTags, targetLabel) : null;
    if (manualUnlink) removeManualTagLink(subjectId, memory, unlinkTags);
    const result = manualUnlink
        ? { affected: 1, operation, changes: [] }
        : manualLink
        ? { affected: 1, operation, changes: [{ target: createdManualLink!.target, before: { valence: 0, strength: 0, expectation: 'anticipate' }, after: createdManualLink! }] }
        : tag
        ? applySubjectiveTagIntervention(subjectId, memory, tag, memoryTagLabel(tag), operation, intensity)
        : applySubjectiveIntervention(subjectId, memory, targetLabel, operation, intensity);
    const core = subjectRepo.get(subjectId);
    const impact = core ? correctionImpact({ intensity, plasticity: core.plasticity, operation, linkedTags: Math.max(1, selectedTags.length) }) : null;
    if (core && impact) {
        subjectRepo.save(subjectId, core.name, { ...core, capacity: Math.max(0, core.capacity - impact.capacityCost), plasticity: Math.max(0, core.plasticity - impact.plasticityCost) });
        relationshipDynamicsRepo.change(subjectId, playerId, { resistance: impact.resistanceDelta, fear: impact.fearDelta, dissociation: impact.dissociationDelta });
    }
    const sessionText = `В кресле коррекции памяти я снова прожила эпизод «${memory.title}». Калибратор вмешался в связь ${targetLabel.toLowerCase()}. ${impact?.dissociationDelta ? 'От этого воспоминание на миг стало противоречивым и зыбким.' : 'Новая связь закрепилась в моей оценке произошедшего.'}`;
    memoryRepo.save({ subjectId, text: sessionText, embedding: buildEmbedding(sessionText), tags: ['mental', 'conditioning', 'memory_recall', 'correction', ...(selectedTags.length ? selectedTags : [])], relatedSubjects: [playerId], type: 'episode_v2', metadata: { mentalCorrection: true, parentEpisodeSourceKey: memorySourceKey, operation, targetLabel, intensity, correctionImpact: impact, worldMinute } });
    db.prepare('INSERT INTO subjective_memory_revisions (subject_id,source_key,target_label,intervention,operation) VALUES (?,?,?,?,?)').run(subjectId, memorySourceKey, targetLabel, text, operation);
    return { affected: result.affected, changes: result.changes, targetLabel, operation, at: worldMinute };
}

function hasPerceptibleDeviceChange(
    command: 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop',
    current: DeviceSession,
    next: DeviceSession,
) {
    if (['start', 'adjust', 'pause', 'resume', 'stop'].includes(command)) return true;
    if (command !== 'settings') return false;
    return current.intensity !== next.intensity
        || current.rhythm !== next.rhythm
        || JSON.stringify(current.targetPointIds) !== JSON.stringify(next.targetPointIds);
}

function recoveryLabel(capacity: number, baselineCapacity: number) {
    if (baselineCapacity <= 25) return 'глубокое хроническое истощение';
    if (baselineCapacity <= 40) return 'хроническое истощение';
    if (capacity <= 10) return 'отключена';
    if (capacity <= 30) return 'истощена';
    if (capacity > baselineCapacity + 3) return 'восстановительный резерв';
    return 'стабильна';
}

function processHistoryLabel(action: Record<string, any>): string {
    const key = action.action?.actionKey || action.presetId || '';
    const point = action.pointId || action.action?.pointId || '';
    const anatomical = (vaginal: string, anal: string) => point === 'anus' ? anal : vaginal;
    const labels: Record<string, string> = {
        wait: 'Ожидание',
        act_start_penetration: anatomical('Вагинальный секс', 'Анальный секс'),
        sustained_sexual_pulse: action.sustainedSource === 'finger_insertion'
            ? anatomical('Вагинальная стимуляция пальцами', 'Анальная стимуляция пальцами')
            : anatomical('Вагинальный секс', 'Анальный секс'),
        finger_insertion: anatomical('Вагинальная стимуляция пальцами', 'Анальная стимуляция пальцами'),
        act_increase_friction: anatomical('Интенсивный вагинальный секс', 'Интенсивный анальный секс'),
        act_decrease_friction: anatomical('Вагинальный секс — медленный темп', 'Анальный секс — медленный темп'),
        act_end_sexual_contact: 'Сексуальный контакт завершён',
        act_start_vibrator: point === 'clitoris' ? 'Вибростимуляция клитора' : 'Вибростимуляция',
        sustained_vibration_pulse: point === 'clitoris' ? 'Вибростимуляция клитора' : 'Вибростимуляция',
        act_adjust_vibration: point === 'clitoris' ? 'Интенсивная вибростимуляция клитора' : 'Интенсивная вибростимуляция',
        act_activate_plug: 'Внутренняя вибростимуляция',
        act_start_electrostimulation: point === 'clitoris' ? 'Электростимуляция клитора' : 'Электростимуляция',
        sustained_electro_pulse: point === 'clitoris' ? 'Электростимуляция клитора' : 'Электростимуляция',
        act_adjust_electrostimulation: point === 'clitoris' ? 'Интенсивная электростимуляция клитора' : 'Интенсивная электростимуляция',
    };
    return labels[key]
        || action.action?.label
        || action.actionLabel
        || action.presetId
        || 'Воздействие';
}

function briefMemoryPhrase(value: unknown, words = 5) {
    const cleaned = String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/[«»]/g, '')
        .trim();
    if (!cleaned) return '';
    const phrase = cleaned.split(' ').slice(0, words).join(' ').replace(/[,:;.]$/, '');
    return phrase.length < cleaned.length ? `${phrase}…` : phrase;
}

function mentalMemoryTitle(memory: { text: string; metadata: Record<string, any> }) {
    const playerSpeech = briefMemoryPhrase(memory.metadata.playerSpeech);
    if (playerSpeech) return `Вопрос: ${playerSpeech}`;
    const characterSpeech = briefMemoryPhrase(memory.metadata.characterSpeech);
    if (characterSpeech) return `Ответ: ${characterSpeech}`;
    const directSpeech = String(memory.text || '').match(/^([^:]{2,32}):\s*(.+)$/s);
    if (directSpeech) return `${directSpeech[1].trim()}: ${briefMemoryPhrase(directSpeech[2], 4)}`;
    const actionLabel = String(memory.metadata.actionLabel || '').trim();
    if (actionLabel) return `${actionLabel} — пережитый эпизод`;
    const observed = String(memory.text || '').match(/Действие «([^»]+)» от ([^ ]+)/);
    if (observed) return `${observed[1]} — наблюдение`;
    return `Эпизод: ${briefMemoryPhrase(memory.text, 4) || 'сохранённое событие'}`;
}

function memoryDisplayText(memory: { text: string; metadata: Record<string, any> }) {
    const metadata = memory.metadata || {};
    const action = metadata.observation?.action || {};
    const legacy = /^Действие:\s*/u.test(memory.text || '');
    if (!legacy || !action.description) return memory.text;
    const compact = (value: unknown, limit = 1200) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
    };
    const firstPerson = (value: unknown) => compact(value)
        .replace(/в рот персонажа/giu, 'мне в рот')
        .replace(/персонажу/giu, 'мне')
        .replace(/персонажа/giu, 'меня');
    const parts = [firstPerson(action.description)];
    const texture = compact(action.sensory?.texture, 220);
    if (texture && texture !== parts[0]) parts.push(texture);
    const reactionState = String(metadata.observation?.behavioralState || '');
    const reactionData = metadata.observation?.reaction || {};
    const reaction = metadata.memoryReaction || (reactionState === 'panic' ? 'Я испугалась и попыталась отстраниться.'
        : reactionState === 'defiance' ? 'Я сопротивлялась происходящему.'
            : Number(reactionData.pleasure || 0) > Number(reactionData.discomfort || 0) * 1.25 ? 'Мне это было приятно.'
                : Number(reactionData.discomfort || 0) > Number(reactionData.pleasure || 0) * 1.25 ? 'Мне это было неприятно.' : 'Я отчётливо запомнила это ощущение.');
    if (reaction) parts.push(reaction);
    if (metadata.characterSpeech) parts.push(`Я ответила: «${compact(metadata.characterSpeech, 160)}».`);
    return parts.join(' ');
}

function applyPassiveLaboratoryEffects(minutes: number, excluded = new Set<string>()) {
    const hours = minutes / 60;
    if (hours <= 0) return;

    const devices = db.prepare(`SELECT * FROM laboratory_assets WHERE state = 'installed'`).all() as any[];
    const deviceOccupants = new Map<string, string>();
    for (const device of devices) {
        let metadata: Record<string, any> = {};
        try { metadata = JSON.parse(device.metadata || '{}'); } catch { metadata = {}; }
        if (metadata.subjectId) deviceOccupants.set(String(metadata.subjectId), String(device.asset_id));
    }

    const resting = db.prepare(`
        SELECT a.character_id
        FROM laboratory_room_assignments a
        JOIN laboratory_rooms r ON r.player_id = a.player_id AND r.room_id = a.room_id
        WHERE r.room_type = 'cell' AND a.status = 'resident'
    `).all() as { character_id: string }[];

    const recover = (subjectId: string, bonus: number, recoveryPerHour: number, baselinePerHour: number, tensionPerHour: number) => {
        if (excluded.has(subjectId)) return;
        const core = subjectRepo.get(subjectId);
        if (!core) return;
        const baseline = core.baselineCapacity ?? core.capacity;
        const target = Math.min(100, baseline + bonus);
        const capacity = Math.min(target, core.capacity + recoveryPerHour * hours);
        // Rest above the established norm rehabilitates long-term endurance.
        // Rest below it restores the current reserve without dragging the norm down.
        const baselineCapacity = capacity > baseline
            ? Math.min(capacity, baseline + baselinePerHour * hours)
            : baseline;
        subjectRepo.save(subjectId, core.name || subjectId, {
            ...core,
            capacity,
            baselineCapacity,
            tension: Math.max(0, core.tension - tensionPerHour * hours)
        });
    };

    for (const { character_id } of resting) {
        if (!deviceOccupants.has(character_id)) recover(character_id, 10, 3, 0.25, 4);
    }
    for (const [subjectId, assetId] of deviceOccupants) {
        if (assetId === 'lab_recovery_capsule') recover(subjectId, 25, 8, 0.75, 12);
    }

    // Running programmable devices are advanced through runGameTick by the
    // background device loop. Keeping their physiology here as well would
    // apply two unrelated effects during the same world minute.
}

export function advanceWorldTime(minutes: number, reason?: string, options: TimeAdvanceOptions = {}) {
    ensureWorldSeed();
    const amount = Math.max(0, Math.round(Number(minutes) || 0));
    if (!amount) return getWorldClock();
    applyPassiveLaboratoryEffects(amount, new Set(options.activeSubjectIds || []));
    db.prepare(`UPDATE world_state SET total_minutes = total_minutes + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'main'`).run(amount);
    const clock = getWorldClock();
    applyExpiredContractPenalties(clock.totalMinutes);
    if (reason) recordScenarioEvent('time', reason, `Прошло ${amount} мин.`, { minutes: amount });
    return clock;
}

export function getPlayerLocation(playerId = PLAYER_ID) {
    ensureWorldSeed();
    const character = characterRepo.get(playerId);
    const id = character?.currentSceneId || LAB_SCENE_ID;
    return LOCATIONS.find(location => location.id === id) || LOCATIONS[0];
}

export function travelTo(targetSceneId: string, playerId = PLAYER_ID) {
    const target = LOCATIONS.find(location => location.id === targetSceneId);
    if (!target) throw new Error('Неизвестное направление');
    const current = getPlayerLocation(playerId);
    if (current.id === target.id) throw new Error('Вы уже находитесь здесь');
    const minutes = Math.max(current.travelMinutes, target.travelMinutes);
    sceneCharacterRepo.moveCharacter(playerId, target.id, { role: 'calibrator', presenceState: 'present' });
    const clock = getWorldClock();
    recordScenarioEvent('travel', `Прибытие: ${target.shortTitle}`, `Перемещение выполнено; игровое время не ускорялось.`, { from: current.id, to: target.id, travelMinutes:minutes });
    return { location: target, clock, minutes };
}

export function listStationSectorState() {
    return Object.entries(STATION_SECTOR_CHANNELS).map(([id, definition]) => {
        const placeholders = definition.triggers.map(() => '?').join(',') || "''";
        const signals = (db.prepare(`
            SELECT t.id,t.title,t.stage,t.updated_minute,c.name AS subject_name,
                   json_extract(t.facts, '$[0]') AS lead
            FROM story_threads t
            LEFT JOIN characters c ON c.id = t.subject_id
            WHERE t.status = 'open' AND t.visibility IN ('hinted','known')
              AND EXISTS (
                SELECT 1 FROM json_each(t.tags) tag
                WHERE tag.value IN (${placeholders})
              )
            ORDER BY t.importance DESC,t.updated_minute DESC LIMIT 4
        `).all(...definition.triggers) as any[]).map(row => ({
            id:row.id,title:row.title,subjectName:row.subject_name || undefined,
            lead:row.lead || '',stage:row.stage,updatedMinute:Number(row.updated_minute),
        }));
        return {
            id,
            signals,
        };
    });
}

export function listInventory(playerId = PLAYER_ID) {
    return characterItemsRepo.listFor(playerId)
    .filter(entry => entry.state !== 'consumed' && entry.state !== 'broken' && entry.charges !== 0)
    .filter(entry => itemRepo.get(entry.itemId)?.type === 'consumable' || VISUALLY_SUPPORTED_PORTABLE_ITEMS.has(entry.itemId))
    .map(entry => {
        const item = itemRepo.get(entry.itemId);
        return {
            ...entry,
            name: item?.name || entry.itemId,
            description: item?.description || '',
            type: item?.type || 'unknown',
            tags:item?.tags || [],
            storageGroup:item?.type === 'consumable'
                ? (item?.tags.includes('capsule') || ['drug_sensitizer','drug_aphrodisiac'].includes(entry.itemId) ? 'capsule' : 'medical')
                : item?.type === 'clothing' ? 'clothing' : 'equipment',
        };
    });
}

export function listLabAssets(playerId = PLAYER_ID) {
    ensureWorldSeed();
    return (db.prepare(`SELECT * FROM laboratory_assets WHERE player_id = ? ORDER BY rowid`).all(playerId) as any[]).map(row => ({
        id: row.asset_id,
        name: row.name,
        description: row.description,
        state: row.state,
        metadata: JSON.parse(row.metadata || '{}')
    }));
}

export function listLabRooms(playerId = PLAYER_ID) {
    ensureWorldSeed();
    const rooms = db.prepare(`SELECT * FROM laboratory_rooms WHERE player_id = ? ORDER BY rowid`).all(playerId) as any[];
    const assignments = db.prepare(`
        SELECT a.room_id, a.character_id, a.status, c.name, c.kind,
               s.capacity, COALESCE(s.baseline_capacity, s.capacity) AS baseline_capacity
        FROM laboratory_room_assignments a
        JOIN characters c ON c.id = a.character_id
        LEFT JOIN subjects s ON s.id = a.character_id
        WHERE a.player_id = ? AND a.status != ?
    `).all(playerId, PLAYER_ROOM_STATUS) as any[];
    return rooms.map(room => ({
        id: room.room_id,
        name: room.name,
        type: room.room_type,
        description: room.description,
        capacity: Number(room.capacity),
        state: room.state,
        occupants: assignments.filter(entry => entry.room_id === room.room_id).map(entry => ({
            id: entry.character_id,
            name: entry.name,
            kind: entry.kind,
            status: entry.status,
            condition: entry.capacity === null ? undefined : recoveryLabel(Number(entry.capacity), Number(entry.baseline_capacity))
        }))
    }));
}

export function listShopOffers(playerId = PLAYER_ID) {
    ensureWorldSeed();
    const now = getWorldClock().totalMinutes;
    const ownedLab = new Set(listLabAssets(playerId).map(asset => asset.id));
    const ownedItems = new Set(listInventory(playerId).map(item => item.itemId));
    return (db.prepare(`
        SELECT * FROM shop_offers
        WHERE (available_from IS NULL OR available_from <= ?)
          AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY category, price
    `).all(now, now) as any[])
    .filter(row => row.category === 'laboratory' || String(row.item_id).startsWith('drug_') || VISUALLY_SUPPORTED_PORTABLE_ITEMS.has(row.item_id))
    .map(row => {
        let metadata:Record<string,any> = {};
        try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
        return ({
        id: row.id,
        itemId: row.item_id,
        name: row.name,
        description: row.description,
        category: row.category,
        price: row.price,
        stock: row.stock,
        owned: row.category === 'laboratory' ? ownedLab.has(row.item_id) : ownedItems.has(row.item_id) && row.stock === -1,
        limited: Boolean(metadata.eventLot),
        supplier: metadata.supplier,
        originLabel: metadata.originLabel,
        batch: metadata.batch,
        expiresAt: row.expires_at == null ? undefined : Number(row.expires_at),
    })});
}

export function listCandidates() {
    ensureWorldSeed();
    const rows = db.prepare(`
        SELECT c.* FROM characters c
        JOIN scene_characters sc ON sc.character_id = c.id
        WHERE sc.scene_id = 'scene_broker' AND sc.role = 'candidate'
        ORDER BY c.name
    `).all() as any[];
    return rows.map(row => {
        let profile: Record<string, any> = {};
        try { profile = JSON.parse(row.profile_json || '{}'); } catch { profile = {}; }
        return {
            id: row.id,
            name: row.name,
            title: profile.title || 'Кандидат',
            description: profile.description || profile.origin?.biography || '',
            biography: profile.origin?.biography || '',
            staffCost: Number(profile.recruitment?.staffCost || 0),
            assetCost: Number(profile.recruitment?.assetCost || 0)
        };
    });
}

export function recruitCandidate(characterId: string, role: 'staff' | 'asset', playerId = PLAYER_ID) {
    if (getPlayerLocation(playerId).id !== 'scene_broker') throw new Error('Оформление кандидатов доступно только у Брокера');
    const candidate = listCandidates().find(entry => entry.id === characterId);
    if (!candidate) throw new Error('Кандидат больше недоступен');
    const cost = role === 'asset' ? candidate.assetCost : candidate.staffCost;
    const credits = resourceRepo.get(playerId)?.resources.credits?.amount || 0;
    if (credits < cost) throw new Error(`Недостаточно кредитов: требуется ${cost}`);

    let roomId = 'room_control';
    if (role === 'asset') {
        const freeCell = listLabRooms(playerId).find(room => room.type === 'cell' && room.occupants.length < room.capacity);
        if (!freeCell) throw new Error('В лаборатории нет свободной жилой камеры');
        roomId = freeCell.id;
    }
    db.transaction(() => {
        db.prepare(`UPDATE character_resources SET amount = amount - ? WHERE character_id = ? AND resource_key = 'credits'`).run(cost, playerId);
        sceneCharacterRepo.moveCharacter(characterId, LAB_SCENE_ID, { role: role === 'asset' ? 'asset' : 'staff', presenceState: 'present' });
        setLaboratoryPresence({ characterId, slotId: `room:${roomId}`, roomId, status: 'resident', playerId });
    })();
    ensureCharacterStorySeeds();
    const clock = getWorldClock();
    ensureCharacterLifecycle(characterId, 'candidate');
    const title = role === 'asset' ? 'Новый актив принят' : 'Сотрудник нанят';
    const description = `${candidate.name} включена в состав лаборатории.`;
    const event = recordScenarioEvent('recruitment', title, description, { subjectId: characterId, role, roomId, cost });
    appendRoleHistory(characterId, { role, previousRole: 'candidate', worldMinute: event.worldMinute, title, description, sourceEventId: event.id });
    return { characterId, name: candidate.name, role, roomId, cost, clock };
}

export function changeLaboratoryRole(characterId: string, role: 'staff' | 'asset', playerId = PLAYER_ID) {
    if (getPlayerLocation(playerId).id !== LAB_SCENE_ID) throw new Error('Управление составом доступно только в лаборатории');
    const character = characterRepo.get(characterId);
    if (!character || character.currentSceneId !== LAB_SCENE_ID) throw new Error('Персонаж не находится в лаборатории');
    const presence = db.prepare(`SELECT role FROM scene_characters WHERE scene_id = ? AND character_id = ?`).get(LAB_SCENE_ID, characterId) as any;
    const currentRole = presence?.role === 'asset' ? 'asset' : 'staff';
    if (currentRole === role) throw new Error('У персонажа уже выбран этот статус');
    const occupiedAsset = listLabAssets(playerId).find(asset => (asset.metadata as any)?.subjectId === characterId);
    if (occupiedAsset) throw new Error(`Сначала освободите устройство: ${occupiedAsset.name}`);

    let roomId: string;
    if (role === 'asset') {
        const freeCell = listLabRooms(playerId).find(room => room.type === 'cell' && room.occupants.every(person => person.id === characterId) && room.occupants.length <= room.capacity)
            || listLabRooms(playerId).find(room => room.type === 'cell' && room.occupants.length < room.capacity);
        if (!freeCell) throw new Error('Нет свободной жилой камеры');
        roomId = freeCell.id;
    } else {
        const staffRoom = listLabRooms(playerId).find(room => room.type === 'staff' && (room.occupants.some(person => person.id === characterId) || room.occupants.length < room.capacity));
        if (!staffRoom) throw new Error('На посту персонала нет свободного места');
        roomId = staffRoom.id;
    }

    db.transaction(() => {
        sceneCharacterRepo.set(LAB_SCENE_ID, characterId, { role, presenceState: 'present' });
        setLaboratoryPresence({ characterId, slotId: `room:${roomId}`, roomId, status: 'resident', playerId });
    })();
    const clock = getWorldClock();
    const title = role === 'asset' ? 'Перевод в активы' : 'Назначение в штат';
    const description = `${character.name}: статус изменён с «${currentRole}» на «${role}».`;
    const event = recordScenarioEvent('role_change', title, description, { subjectId: characterId, from: currentRole, role, roomId });
    appendRoleHistory(characterId, { role, previousRole: currentRole, worldMinute: event.worldMinute, title, description, sourceEventId: event.id });
    return { characterId, name: character.name, previousRole: currentRole, role, roomId, clock };
}

export function buyOffer(offerId: string, playerId = PLAYER_ID) {
    ensureWorldSeed();
    const offer = db.prepare(`SELECT * FROM shop_offers WHERE id = ?`).get(offerId) as any;
    if (!offer) throw new Error('Предложение больше недоступно');
    const now = getWorldClock().totalMinutes;
    if (offer.available_from != null && Number(offer.available_from) > now) throw new Error('Предложение ещё недоступно');
    if (offer.expires_at != null && Number(offer.expires_at) <= now) throw new Error('Срок предложения истёк');
    let offerMetadata:Record<string,any> = {};
    try { offerMetadata = JSON.parse(offer.metadata || '{}'); } catch { offerMetadata = {}; }
    if (offer.stock === 0) throw new Error('Товар закончился');
    if (offer.category === 'laboratory' && listLabAssets(playerId).some(asset => asset.id === offer.item_id)) throw new Error('Этот модуль уже установлен');
    const credits = resourceRepo.get(playerId)?.resources.credits?.amount || 0;
    if (credits < offer.price) throw new Error(`Недостаточно кредитов: требуется ${offer.price}`);

    db.transaction(() => {
        db.prepare(`UPDATE character_resources SET amount = amount - ? WHERE character_id = ? AND resource_key = 'credits'`).run(offer.price, playerId);
        if (offer.stock > 0) db.prepare(`UPDATE shop_offers SET stock = stock - 1 WHERE id = ?`).run(offerId);
        if (offer.category === 'laboratory') {
            db.prepare(`INSERT INTO laboratory_assets (player_id, asset_id, name, description, state, metadata) VALUES (?, ?, ?, ?, 'installed', ?)`)
                .run(playerId, offer.item_id, offer.name, offer.description, JSON.stringify({ roomId: 'room_calibration' }));
        } else {
            const item = itemRepo.get(offer.item_id);
            const existing = characterItemsRepo.get(playerId, offer.item_id);
            const consumable = item?.type === 'consumable';
            characterItemsRepo.save({
                characterId: playerId,
                itemId: offer.item_id,
                state: 'active',
                charges: consumable ? Math.max(0, existing?.charges || 0) + 1 : -1
            });
        }
    })();
    const clock = getWorldClock();
    recordScenarioEvent('purchase', 'Приобретено', offer.name, { offerId, price: offer.price, provenance:offerMetadata });
    emitSupplyPurchased({ offerId,itemId:offer.item_id,playerId,metadata:offerMetadata });
    return { offerId, name: offer.name, price: offer.price, clock };
}

export function useLabAsset(assetId: string, subjectId: string, playerId = PLAYER_ID) {
    if (getPlayerLocation(playerId).id !== LAB_SCENE_ID) throw new Error('Лабораторное оборудование доступно только в лаборатории');
    if (!listLabAssets(playerId).some(asset => asset.id === assetId)) throw new Error('Модуль не установлен');
    if (!['lab_recovery_capsule', 'lab_diagnostic_table', 'lab_sex_machine', 'lab_mental_correction_chair'].includes(assetId)) throw new Error('Этот модуль пока не принимает активов');
    const core = subjectRepo.get(subjectId);
    if (!core) throw new Error('Актив не найден');
    const asset = listLabAssets(playerId).find(entry => entry.id === assetId)!;
    const currentSubjectId = String((asset.metadata as any)?.subjectId || '');
    if (currentSubjectId && currentSubjectId !== subjectId) throw new Error('Устройство уже занято');
    const nextSubjectId = currentSubjectId === subjectId ? null : subjectId;
    const currentSession = (asset.metadata as any)?.deviceSession as DeviceSession | undefined;
    if (!nextSubjectId && currentSession && ['running', 'paused'].includes(currentSession.status)) {
        throw new Error('Сначала остановите активный протокол');
    }
    const assignment = db.prepare(`SELECT room_id FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`).get(playerId, subjectId) as any;
    const previouslyOccupiedAsset = listLabAssets(playerId).find(entry => (entry.metadata as any)?.subjectId === subjectId);
    const previousSession = (previouslyOccupiedAsset?.metadata as any)?.deviceSession as DeviceSession | undefined;
    if (nextSubjectId && previouslyOccupiedAsset?.id !== assetId && previousSession && ['running', 'paused'].includes(previousSession.status)) {
        throw new Error('Сначала остановите протокол текущего устройства');
    }
    const previousRoomId = String((previouslyOccupiedAsset?.metadata as any)?.previousRoomId || assignment?.room_id || 'room_cell_a');
    const assetRoomId = String((asset.metadata as any)?.roomId || assignment?.room_id || 'room_calibration');
    const returnRoomId = String((asset.metadata as any)?.previousRoomId || assignment?.room_id || previousRoomId);
    const leavesCalibrationTable = previouslyOccupiedAsset?.id === 'lab_diagnostic_table' && assetId !== 'lab_diagnostic_table';
    const releasedFromCalibrationTable = assetId === 'lab_diagnostic_table' && !nextSubjectId;
    const leavesMentalChair = previouslyOccupiedAsset?.id === 'lab_mental_correction_chair' && assetId !== 'lab_mental_correction_chair';
    const releasedFromMentalChair = assetId === 'lab_mental_correction_chair' && !nextSubjectId;
    db.transaction(() => {
        if (leavesCalibrationTable || releasedFromCalibrationTable) clearCalibrationSetupContexts(subjectId);
        if (leavesMentalChair || releasedFromMentalChair) activeContextsRepo.removeByActionId(subjectId, 'context_mental_correction_chair');
        if (nextSubjectId) {
            // A character can physically occupy only one laboratory container.
            const rows = db.prepare(`SELECT asset_id, metadata FROM laboratory_assets WHERE player_id = ?`).all(playerId) as any[];
            for (const row of rows) {
                let metadata: Record<string, any> = {};
                try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
                if (metadata.subjectId === subjectId) {
                    db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
                        .run(JSON.stringify({ roomId: metadata.roomId }), playerId, row.asset_id);
                }
            }
            if (assetId === 'lab_recovery_capsule' || assetId === 'lab_sex_machine') {
                // Both enclosed devices require direct access to the body.
                // "Nude" is represented by the absence of clothing contexts,
                // so remove every currently worn garment as part of loading.
                db.prepare(`
                    DELETE FROM active_contexts
                    WHERE subject_id = ?
                      AND action_id IN (
                          SELECT id FROM action_presets
                          WHERE COALESCE(json_extract(context_config_json, '$.type'), '') = 'clothing'
                             OR type = 'clothing'
                      )
                `).run(subjectId);
            }
            if (assetId === 'lab_sex_machine') {
                const incompatible = new Set([
                    'act_start_vibrator', 'act_adjust_vibration', 'act_activate_plug',
                    'act_start_electrostimulation', 'act_adjust_electrostimulation',
                    'finger_insertion', 'act_start_penetration', 'act_increase_friction',
                ]);
                for (const context of activeContextsRepo.getAllForSubject(subjectId)) {
                    if (incompatible.has(context.actionId)) activeContextsRepo.remove(context.id);
                }
            }
        }
        if (nextSubjectId && assetId === 'lab_mental_correction_chair') {
            const chairContext = presetRepo.getActionPreset('context_mental_correction_chair');
            if (!chairContext) throw new Error('Не найден контекст кресла ментальной коррекции');
            ContextManager.applyContext(subjectId, 'context_mental_correction_chair', chairContext, undefined, playerId);
        }
        const definition = isControllableDevice(assetId) ? DEVICE_DEFINITIONS[assetId] : null;
        const deviceSession: DeviceSession | undefined = definition && nextSubjectId ? {
            deviceId: definition.deviceId,
            subjectId: nextSubjectId,
            configuration: definition.defaultConfiguration,
            wardrobe: definition.defaultWardrobe,
            status: 'loaded',
            intensity: 35,
            phase: 'sustain',
            targetPointIds: ['vagina'],
            stimulationMode: 'vaginal',
            startedAtTick: null,
            updatedAtTick: getWorldClock().totalMinutes
            ,targetMode: 'manual',
            rhythm: 'steady',
            orgasmPolicy: 'allow',
            valencePolicy: 'neutral',
            maxTension: 95,
            minCapacity: 15,
            stopAfterMinutes: null,
            orgasmTargetCount: null,
            orgasmCount: 0,
            stopAtReserve: false
        } : undefined;
        const mentalSession = assetId === 'lab_mental_correction_chair' && nextSubjectId
            ? initialMentalChairSession(nextSubjectId, getWorldClock().totalMinutes)
            : undefined;
        db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
            .run(JSON.stringify(nextSubjectId
                ? { ...asset.metadata, subjectId: nextSubjectId, startedAt: getWorldClock().totalMinutes, previousRoomId, ...(deviceSession ? { deviceSession } : {}), ...(mentalSession ? { mentalSession } : {}) }
                : { roomId: (asset.metadata as any)?.roomId }), playerId, assetId);
        setLaboratoryPresence({
            characterId: subjectId,
            slotId: nextSubjectId ? `device:${assetId}` : `room:${returnRoomId}`,
            roomId: nextSubjectId ? assetRoomId : returnRoomId,
            status: nextSubjectId ? `device:${assetId}` : 'resident',
            playerId,
        });
    })();
    if (!nextSubjectId) interactionStanceRepo.softenAll(subjectId,.45);
    recordScenarioEvent('equipment', nextSubjectId ? 'Актив помещён в устройство' : 'Актив извлечён из устройства', `${core.name || subjectId}: ${asset.name}.`, { subjectId, assetId });
    return { subject: subjectRepo.get(subjectId), assetId, occupied: Boolean(nextSubjectId) };
}

export function controlDeviceSession(
    assetId: string,
    command: 'configure' | 'settings' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop' | 'intervene',
    payload: { configuration?: string; wardrobe?: string; intensity?: number; stimulationMode?: SexMachineStimulationMode; targetMode?: DeviceSession['targetMode']; rhythm?: DeviceSession['rhythm']; orgasmPolicy?: DeviceSession['orgasmPolicy']; valencePolicy?: DeviceSession['valencePolicy']; maxTension?: number; minCapacity?: number; stopAfterMinutes?: number | null; orgasmTargetCount?: number | null; stopAtReserve?: boolean; memoryId?: number; focusTag?: string | null; frame?: MentalChairFrame; targetLabel?: string; intervention?: string } = {},
    playerId = PLAYER_ID
) {
    if (!isControllableDevice(assetId) && assetId !== 'lab_mental_correction_chair') throw new Error('Устройство не поддерживает управляемые протоколы');
    const row = db.prepare(`SELECT asset_id, name, description, state, metadata FROM laboratory_assets WHERE player_id = ? AND asset_id = ?`)
        .get(playerId, assetId) as any;
    if (!row) throw new Error('Модуль не установлен');
    if (assetId === 'lab_mental_correction_chair') return controlMentalChairSession(row, command, payload, playerId);
    let metadata: Record<string, any> = {};
    try { metadata = JSON.parse(row.metadata || '{}'); } catch { metadata = {}; }
    const current = metadata.deviceSession as DeviceSession | undefined;
    if (!metadata.subjectId || !current) throw new Error('В устройство не помещён персонаж');
    const definition = DEVICE_DEFINITIONS[assetId];
    const now = Number((db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as any)?.total_minutes || 0);
    let next: DeviceSession = { ...current, updatedAtTick: now };

    if (command === 'configure') {
        if (current.status === 'running') throw new Error('Остановите или приостановите протокол перед настройкой');
        const configuration = String(payload.configuration || current.configuration);
        const configurations = definition.configurations as Record<string, readonly string[]>;
        const wardrobes = configurations[configuration];
        if (!wardrobes) throw new Error('Эта конфигурация недоступна');
        const wardrobe = String(payload.wardrobe || current.wardrobe);
        if (!wardrobes.includes(wardrobe)) throw new Error('Одежда несовместима с выбранной конфигурацией');
        next = { ...next, configuration, wardrobe: wardrobe as DeviceSession['wardrobe'] };
    } else if (command === 'settings') {
        const stimulationMode: SexMachineStimulationMode = payload.stimulationMode === 'tickling' ? 'tickling' : payload.stimulationMode === 'anal' ? 'anal' : payload.stimulationMode === 'vaginal' ? 'vaginal' : (current.stimulationMode || 'vaginal');
        const stimulation = sexMachineStimulation(stimulationMode);
        const hasStopAfter = Object.prototype.hasOwnProperty.call(payload, 'stopAfterMinutes');
        const hasOrgasmTarget = Object.prototype.hasOwnProperty.call(payload, 'orgasmTargetCount');
        const stopAfterMinutes = hasStopAfter
            ? (Number(payload.stopAfterMinutes) > 0
                ? Math.max(30, Math.min(1440, Math.round(Number(payload.stopAfterMinutes) / 30) * 30))
                : null)
            : current.stopAfterMinutes ?? null;
        const orgasmTargetCount = hasOrgasmTarget
            ? (Number(payload.orgasmTargetCount) > 0 ? Math.max(1, Math.min(10, Math.floor(Number(payload.orgasmTargetCount)))) : null)
            : current.orgasmTargetCount ?? null;
        const intensity = Math.max(10, Math.min(100, Number(payload.intensity ?? current.intensity)));
        next = {
            ...next,
            intensity,
            phase: phaseForDeviceIntensity(intensity),
            // A machine mode owns its anatomical route. Keeping an old point
            // here made already-running sessions retain the previous mode's
            // target after a mode definition changed.
            targetPointIds: [stimulation.pointId],
            stimulationMode,
            targetMode: payload.targetMode || current.targetMode || 'manual',
            rhythm: payload.rhythm || current.rhythm || 'steady',
            orgasmPolicy: payload.orgasmPolicy || current.orgasmPolicy || 'allow',
            valencePolicy: payload.valencePolicy || current.valencePolicy || 'adaptive',
            maxTension: Math.max(20, Math.min(100, Number(payload.maxTension ?? current.maxTension ?? 95))),
            minCapacity: Math.max(0, Math.min(80, Number(payload.minCapacity ?? current.minCapacity ?? 15))),
            stopAfterMinutes,
            orgasmTargetCount,
            orgasmCount: hasOrgasmTarget ? 0 : (current.orgasmCount ?? 0),
            stopAtReserve: typeof payload.stopAtReserve === 'boolean' ? payload.stopAtReserve : Boolean(current.stopAtReserve),
        };
    } else if (command === 'start') {
        if (current.status === 'running') throw new Error('Протокол уже запущен');
        next = { ...next, status: 'running', startedAtTick: current.startedAtTick ?? now };
    } else if (command === 'adjust') {
        const intensity = Math.max(10, Math.min(100, Number(payload.intensity) || current.intensity));
        next = { ...next, intensity, phase: phaseForDeviceIntensity(intensity) };
    } else if (command === 'pause') {
        if (current.status !== 'running') throw new Error('Протокол не запущен');
        next = { ...next, status: 'paused' };
    } else if (command === 'resume') {
        if (current.status !== 'paused') throw new Error('Протокол не находится на паузе');
        next = { ...next, status: 'running' };
    } else if (command === 'stop') {
        if (!['running', 'paused'].includes(current.status)) throw new Error('Протокол уже остановлен');
        next = { ...next, status: 'stopped', phase: 'sustain', startedAtTick: null };
    }

    db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
        .run(JSON.stringify({ ...metadata, deviceSession: next }), playerId, assetId);
    if (command === 'stop') interactionStanceRepo.softenAll(next.subjectId,.5);
    // A stopped or paused machine does not create a bodily event.  Its
    // configuration is operator state, not something the occupant perceives.
    const machineWasOrIsRunning = current.status === 'running' || next.status === 'running';
    if (machineWasOrIsRunning && hasPerceptibleDeviceChange(command, current, next)) {
        const sensoryEvent = describeDeviceProtocolEvent(command, next, current);
        // Technical sensory context remains available to the character but is
        // deliberately hidden from the dialogue feed by its marker.
        chatMemoryRepo.append(next.subjectId, 'user', `[Воздействие] ${sensoryEvent}`, row.name);
        recordScenarioEvent('device_protocol', `Устройство: ${command}`, describeDeviceProtocolSummary(command), {
            subjectId: next.subjectId, assetId, command, configuration: next.configuration, intensity: next.intensity
        });
    }
    return { assetId, session: next };
}

export function getScenarioSnapshot(playerId = PLAYER_ID) {
    ensureWorldSeed();
    const characterNames = new Map<string, string>();
    for (const character of characterRepo.listAll()) {
        characterNames.set(character.id, character.name);
        if (character.subjectId) characterNames.set(character.subjectId, character.name);
    }
    const subjectName = (id: string) => characterNames.get(id) || id;
    const resources = resourceRepo.get(playerId);
    const events = (db.prepare(`SELECT * FROM scenario_events ORDER BY id DESC LIMIT 8`).all() as any[]).map(row => ({
        id: row.id,
        worldMinute: row.world_minute,
        type: row.type,
        title: row.title,
        description: row.description
    }));
    const residents = (db.prepare(`
        SELECT c.id, c.name, c.kind, c.subject_id, c.profile_json, sc.role, sc.presence_state
        FROM scene_characters sc
        JOIN characters c ON c.id = sc.character_id
        WHERE sc.scene_id = ? AND c.id != ?
        ORDER BY CASE WHEN c.kind = 'subject' THEN 0 ELSE 1 END, c.name
    `).all(LAB_SCENE_ID, playerId) as any[]).map(row => {
        let profile: Record<string, unknown> = {};
        try { profile = JSON.parse(row.profile_json || '{}'); } catch { profile = {}; }
        const simulationId = row.subject_id || row.id;
        const logRows = db.prepare(`SELECT * FROM event_logs WHERE subject_id = ? ORDER BY id DESC LIMIT 40`).all(simulationId) as any[];
        const totals = db.prepare(`
            SELECT COUNT(*) AS recordedEvents,
                   SUM(CASE WHEN action_type = 'interaction' THEN 1 ELSE 0 END) AS interactions
            FROM event_logs WHERE subject_id = ?
        `).get(simulationId) as any;
        const engineHistory = logRows.flatMap(log => {
            let action: Record<string, any> = {};
            let result: Record<string, any> = {};
            try { action = JSON.parse(log.action_payload || '{}'); } catch { action = {}; }
            try { result = JSON.parse(log.result_payload || '{}'); } catch { result = {}; }
            const transitions = Array.isArray(result.observation?.transitions) ? result.observation.transitions : [];
            if (!transitions.length && log.action_type === 'interaction') {
                return [{
                    id: `engine-${log.id}`,
                    time: log.timestamp,
                    type: 'interaction',
                    actionKey: action.action?.actionKey || action.presetId,
                    title: processHistoryLabel(action),
                    description: result.observation?.uiText || action.narrative || ''
                }];
            }
            if (!transitions.length && log.action_type !== 'system_trigger') return [];
            if (transitions.length) return transitions.map((transition: any, index: number) => ({
                id: `engine-${log.id}-${index}`,
                time: log.timestamp,
                type: transition.kind || 'state',
                actionKey: action.action?.actionKey || action.presetId,
                outcome: transition.kind === 'discharge' ? 'Оргазм' : transition.title,
                title: log.action_type === 'interaction'
                    ? processHistoryLabel(action)
                    : (transition.title || 'Изменение состояния'),
                description: transition.text || result.observation?.uiText || ''
            }));
            return [{
                id: `engine-${log.id}`,
                time: log.timestamp,
                type: 'state',
                title: action.actionLabel || 'Изменение состояния',
                description: action.narrative || ''
            }];
        }).slice(0, 40);
        const scenarioHistory = (db.prepare(`SELECT * FROM scenario_events ORDER BY id DESC LIMIT 60`).all() as any[]).flatMap(event => {
            let metadata: Record<string, any> = {};
            try { metadata = JSON.parse(event.metadata || '{}'); } catch { metadata = {}; }
            if (metadata.subjectId !== row.id && metadata.subjectId !== simulationId) return [];
            return [{ id: `scenario-${event.id}`, worldMinute: event.world_minute, type: event.type, title: event.title, description: event.description }];
        });
        const contexts = db.prepare(`
            SELECT ac.action_id AS id, COALESCE(ap.label, ac.action_id) AS label, MAX(ac.ticks_active) AS ticksActive
            FROM active_contexts ac LEFT JOIN action_presets ap ON ap.id = ac.action_id
            WHERE ac.subject_id = ?
            GROUP BY ac.action_id, ap.label
        `).all(simulationId) as any[];
        const points = db.prepare(`
            SELECT sps.point_id AS id, COALESCE(pp.label, sps.point_id) AS label,
                   sps.local_sensitivity AS sensitivity, sps.local_attitude AS attitude,
                   sps.local_openness AS openness, sps.familiarity, sps.exposure_count AS exposureCount,
                   sps.baseline_local_sensitivity AS baselineSensitivity,
                   sps.baseline_local_attitude AS baselineAttitude,
                   sps.baseline_local_openness AS baselineOpenness
            FROM subject_point_states sps LEFT JOIN point_presets pp ON pp.id = sps.point_id
            WHERE sps.subject_id = ? AND sps.point_id != 'systemic'
            ORDER BY sps.exposure_count DESC
        `).all(simulationId) as any[];
        const chatCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM chat_memory WHERE subject_id = ? AND role = 'assistant'`).get(simulationId) as any)?.count || 0);
        const completedContracts = Number((db.prepare(`SELECT COUNT(*) AS count FROM asset_contracts WHERE attached_subject_id = ? AND state IN ('completed', 'delivered')`).get(simulationId) as any)?.count || 0);
        const transitionCounts = db.prepare(`
            SELECT
                COUNT(DISTINCT CASE WHEN json_extract(t.value, '$.kind') = 'discharge' THEN e.id END) AS discharges,
                COUNT(DISTINCT CASE WHEN json_extract(t.value, '$.kind') = 'breakdown' THEN e.id END) AS breakdowns
            FROM event_logs e
            LEFT JOIN json_each(e.result_payload, '$.observation.transitions') t
            WHERE e.subject_id = ?
        `).get(simulationId) as any;
        const relationships = characterRelationRepo.listFor(simulationId)
            .filter(relation => relation.toId !== simulationId && relation.target?.name)
            .map(relation => ({
                characterId: relation.toId,
                subjectId: relation.target?.subjectId || relation.toId,
                name: relation.target!.name,
                attitude: Number(relation.attitude || 0),
                openness: Number(relation.openness || 0),
                familiarity: Number(relation.familiarityLevel || 0),
                knows: relation.knows,
                present: relation.present,
                canInteract: relation.canInteract,
                opinion: relation.generalOpinion || '',
                recentMemories: relation.recentMemories || [],
            }));
        let dossierNarrative: any;
        try {
            dossierNarrative = db.prepare(`SELECT self_description,trait_expression,updated_at FROM dossier_narratives WHERE subject_id=?`).get(simulationId) as any;
        } catch { dossierNarrative = undefined; }
        return {
            id: row.id,
            name: row.name,
            kind: row.kind,
            subjectId: row.subject_id,
            role: row.role || (row.kind === 'subject' ? 'asset' : 'resident'),
            presenceState: row.presence_state,
            title: (profile as any).title || ((profile as any).base?.status === 'calibrator' ? 'Калибратор' : row.kind === 'subject' ? 'Актив' : 'Персонаж'),
            description: (profile as any).description || (row.id === 'NPC-LAB-01'
                ? 'Лабораторный ассистент. Ведёт терминал, наблюдает за состоянием оборудования и фиксирует результаты процедур.'
                : 'Актив, находящийся в распоряжении лаборатории для калибровки и подготовки к контрактам.'),
            biography: (profile as any).origin?.biography || (profile as any).generatedProfile?.historyText || '',
            currentRole: (profile as any).currentRole || row.role,
            roleHistory: Array.isArray((profile as any).roleHistory) ? (profile as any).roleHistory : [],
            portrait: (profile as any).portrait || (profile as any).image || null,
            state: subjectRepo.get(simulationId),
            contexts,
            points,
            mentalMemories: (() => {
                return aggregateMemoryEpisodes(memoryRepo.listRecent(simulationId, 160, 'episode_v2'), 12, subjectName).map(memory => {
                const subjective = getSubjectiveEpisode(simulationId, memory);
                const manualLinks = listManualTagLinks(simulationId, memory);
                return ({
                id: memory.id,
                title: subjective?.title || memory.title,
                text: subjective ? [subjective.summary, subjective.appraisal].filter(Boolean).join(' ') : memory.text,
                tags: memory.tags,
                tagLabels: Object.fromEntries(memory.tags.map(tag => [tag, memoryTagLabel(tag)])),
                relatedSubjectIds: memory.relatedSubjectIds,
                worldMinute: memory.worldMinute,
                atomCount: memory.atomCount,
                // The client uses moment data only to compose the small
                // visual collage. Sending each atom's full narrative here
                // duplicated the memory text many times in every 12-second
                // world refresh.
                moments: memory.moments.map(moment => ({
                    id: moment.id,
                    sceneId: moment.sceneId,
                    actionId: moment.actionId,
                    participantIds: moment.participantIds,
                    portraitEmotion: moment.portraitEmotion,
                })),
                subjective: subjective ? { ...subjective, associations: [...subjective.associations, ...manualLinks] } : undefined,
            });
                });
            })(),
            // State-chart annotations need timestamped engine events. Device
            // placement history has only worldMinute and can otherwise fill
            // the whole limit before a single action reaches the client.
            history: [...engineHistory, ...scenarioHistory].slice(0, 48),
            relationships,
            dossierNarrative: dossierNarrative ? {
                selfDescription: dossierNarrative.self_description,
                traitExpression: dossierNarrative.trait_expression,
                updatedAt: dossierNarrative.updated_at,
            } : undefined,
            statistics: {
                interactions: Number(totals?.interactions || 0),
                recordedEvents: Number(totals?.recordedEvents || 0),
                chatMessages: chatCount,
                discharges: Number(transitionCounts?.discharges || 0),
                breakdowns: Number(transitionCounts?.breakdowns || 0),
                completedContracts
            }
        };
    });
    return {
        clock: getWorldClock(),
        location: getPlayerLocation(playerId),
        locations: LOCATIONS,
        credits: resources?.resources.credits?.amount || 0,
        inventory: listInventory(playerId),
        laboratory: listLabAssets(playerId),
        rooms: listLabRooms(playerId),
        stationSectors: listStationSectorState(),
        residents,
        candidates: listCandidates(),
        shop: listShopOffers(playerId),
        events
    };
}
