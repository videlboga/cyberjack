import { db } from '../infrastructure/db';
import { characterItemsRepo, characterRepo, itemRepo, pointStateRepo, resourceRepo, sceneCharacterRepo, subjectRepo } from '../infrastructure/repositories';
import { appendRoleHistory, ensureCharacterLifecycle } from './characterLifecycle';
import { ensureStarterClothing, STARTER_CLOTHING } from '../infrastructure/starterClothing';

export const PLAYER_ID = 'PL-1';
export const LAB_SCENE_ID = 'scene_lab_calibrator';

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

const SHOP_OFFERS = [
    { id: 'offer_lab_gown', itemId: 'eq_lab_gown', name: 'Лабораторная рубашка', description: 'Свободная диагностическая одежда с открытой спиной.', category: 'item', price: 45, stock: -1 },
    { id: 'offer_calibration_set', itemId: 'eq_calibration_set', name: 'Калибровочный комплект', description: 'Топ и шорты с доступом к зонам установки датчиков.', category: 'item', price: 70, stock: -1 },
    { id: 'offer_ankle_cuffs', itemId: 'eq_ankle_cuffs', name: 'Ножные манжеты', description: 'Фиксаторы лодыжек с короткой соединительной цепью.', category: 'item', price: 130, stock: -1 },
    { id: 'offer_restraint_belt', itemId: 'eq_restraint_belt', name: 'Фиксирующий пояс', description: 'Пояс для удержания запястий у талии.', category: 'item', price: 170, stock: -1 },
    { id: 'offer_tens', itemId: 'eq_tens_unit', name: 'TENS-стимулятор', description: 'Переносной нейростимулятор для точных электрических воздействий.', category: 'item', price: 260, stock: -1 },
    { id: 'offer_speculum', itemId: 'eq_speculum', name: 'Медицинский расширитель', description: 'Инструмент для осмотра и продолжительной фиксации зоны.', category: 'item', price: 180, stock: -1 },
    { id: 'offer_aphrodisiac', itemId: 'drug_aphrodisiac', name: 'Eros-V', description: 'Расходник: резко повышает реактивность нервной системы.', category: 'item', price: 120, stock: 6 },
    { id: 'offer_sensitizer', itemId: 'drug_sensitizer', name: 'NeuroSpike', description: 'Расходник для локальной гиперсенсибилизации.', category: 'item', price: 160, stock: 4 },
    { id: 'lab_recovery_capsule', itemId: 'lab_recovery_capsule', name: 'Восстановительная капсула', description: 'Пассивно стабилизирует помещённый внутрь актив и создаёт восстановительный резерв.', category: 'laboratory', price: 700, stock: 1 },
    { id: 'lab_restraint_frame', itemId: 'lab_restraint_frame', name: 'Стационарная рама', description: 'Лабораторная фиксация для продолжительных автоматических протоколов.', category: 'laboratory', price: 850, stock: 1 },
    { id: 'lab_sensory_pod', itemId: 'lab_sensory_pod', name: 'Сенсорная капсула', description: 'Изолированный модуль для пассивных сенсорных программ.', category: 'laboratory', price: 1100, stock: 1 },
    { id: 'lab_sex_machine', itemId: 'lab_sex_machine', name: 'Модуль секс-машины', description: 'Стационарный программируемый комплекс с несколькими конфигурациями фиксации и стимуляции.', category: 'laboratory', price: 1450, stock: 1 }
] as const;

const BASE_LAB_ASSETS = [
    { id: 'lab_terminal', roomId: 'room_control', name: 'Терминал протоколов', description: 'Сборка и автоматический запуск последовательностей воздействий.' },
    { id: 'lab_diagnostic_table', roomId: 'room_calibration', name: 'Диагностический стол', description: 'Базовая телеметрия и ручная калибровка актива.' },
    { id: 'lab_background_loop', roomId: 'room_calibration', name: 'Фоновый контур', description: 'Простейшая автоматическая стимуляция во время ручной работы.' },
    { id: 'lab_sex_machine', roomId: 'room_calibration', name: 'Модуль секс-машины', description: 'Стационарный программируемый комплекс с несколькими конфигурациями фиксации и стимуляции.' },
    { id: 'lab_sensory_pod', roomId: 'room_calibration', name: 'Сенсорная капсула', description: 'Изолированный модуль для пассивных сенсорных программ.' }
];

const BASE_LAB_ROOMS = [
    { id: 'room_calibration', name: 'Калибровочная', type: 'workroom', capacity: 2, description: 'Изолированное помещение для ручных воздействий и запуска протоколов.' },
    { id: 'room_cell_a', name: 'Жилая камера A', type: 'cell', capacity: 1, description: 'Закрытая камера с койкой, санитарным модулем и контролем сна.' },
    { id: 'room_cell_b', name: 'Жилая камера B', type: 'cell', capacity: 1, description: 'Резервная жилая камера для второго актива.' },
    { id: 'room_control', name: 'Пост наблюдения', type: 'staff', capacity: 2, description: 'Рабочее место ассистента, терминал телеметрии и управление оборудованием.' }
];

export function ensureWorldSeed() {
    db.prepare(`INSERT OR IGNORE INTO world_state (id, total_minutes, day) VALUES ('main', 480, 1)`).run();
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
            db.prepare(`UPDATE laboratory_room_assignments SET room_id = ?, status = ? WHERE player_id = ? AND character_id = ?`)
                .run(metadata.roomId, `device:${row.asset_id}`, PLAYER_ID, metadata.subjectId);
            db.prepare(`UPDATE scene_characters SET slot_id = ? WHERE scene_id = ? AND character_id = ?`)
                .run(`device:${row.asset_id}`, LAB_SCENE_ID, metadata.subjectId);
        }
    }
    const insertRoom = db.prepare(`
        INSERT OR IGNORE INTO laboratory_rooms (player_id, room_id, name, room_type, description, capacity, state, metadata)
        VALUES (?, ?, ?, ?, ?, ?, 'ready', '{}')
    `);
    for (const room of BASE_LAB_ROOMS) insertRoom.run(PLAYER_ID, room.id, room.name, room.type, room.description, room.capacity);

    const player = characterRepo.get(PLAYER_ID) || characterRepo.ensureCharacter(PLAYER_ID, 'Калибратор');
    if (!player.currentSceneId) sceneCharacterRepo.set(LAB_SCENE_ID, PLAYER_ID, { role: 'calibrator', slotId: 'slot_terminal' });
    const ionaProfile = {
        base: { name: 'Иона', age: 29, gender: 'female', anatomy: 'human', status: 'assistant' },
        origin: {
            birthplaceId: 'orbital-clinic-7', professionId: 'laboratory-technician',
            biography: 'До найма работала оператором медицинской телеметрии. В лаборатории отвечает за протоколы, оборудование и непрерывное наблюдение за активами.'
        },
        personality: {
            traits: ['собранная', 'наблюдательная', 'осторожная'],
            quirks: ['перед ответом сверяется с показаниями терминала'],
            speechStyle: 'Говорит коротко и профессионально; при личных вопросах становится заметно осторожнее.',
            coreBelief: 'Любое вмешательство допустимо только тогда, когда его последствия можно измерить и удержать под контролем.'
        },
        knowledge: {
            common: ['процедуры лаборатории', 'телеметрия', 'обслуживание оборудования'],
            personal: ['текущее состояние Миры', 'распорядок лаборатории'],
            secrets: []
        },
        memory: { knownCharacters: { 'PL-1': 'работодатель и калибратор', 'S-AV-01': 'наблюдаемый актив' }, scars: [] },
        title: 'Лабораторный ассистент',
        description: 'Ведёт терминал, обслуживает оборудование и фиксирует последствия калибровочных процедур.'
    };
    db.prepare(`
        INSERT INTO characters (id, name, kind, current_scene_id, profile_json)
        VALUES ('NPC-LAB-01', 'Иона', 'npc', ?, ?)
        ON CONFLICT(id) DO UPDATE SET profile_json = CASE
            WHEN characters.profile_json IS NULL OR characters.profile_json = '{}' OR json_extract(characters.profile_json, '$.base') IS NULL
            THEN excluded.profile_json ELSE characters.profile_json END
    `).run(LAB_SCENE_ID, JSON.stringify(ionaProfile));
    const assistant = characterRepo.get('NPC-LAB-01');
    const hasLaboratoryScene = Boolean(db.prepare(`SELECT 1 FROM scenes WHERE id = ?`).get(LAB_SCENE_ID));
    if (assistant && hasLaboratoryScene && assistant.currentSceneId !== LAB_SCENE_ID) {
        sceneCharacterRepo.moveCharacter('NPC-LAB-01', LAB_SCENE_ID, { role: 'assistant', slotId: 'slot_terminal' });
    } else if (assistant && hasLaboratoryScene) {
        sceneCharacterRepo.set(LAB_SCENE_ID, 'NPC-LAB-01', { role: 'assistant', slotId: 'slot_terminal' });
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
    const assignRoom = db.prepare(`
        INSERT OR IGNORE INTO laboratory_room_assignments (player_id, room_id, character_id, status)
        VALUES (?, ?, ?, 'resident')
    `);
    if (characterRepo.get('S-AV-01')) assignRoom.run(PLAYER_ID, 'room_cell_a', 'S-AV-01');
    if (assistant) assignRoom.run(PLAYER_ID, 'room_control', 'NPC-LAB-01');
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
}

export function getWorldClock() {
    ensureWorldSeed();
    const row = db.prepare(`SELECT total_minutes FROM world_state WHERE id = 'main'`).get() as { total_minutes: number };
    const totalMinutes = Number(row.total_minutes) || 0;
    const day = Math.floor(totalMinutes / 1440) + 1;
    const minuteOfDay = totalMinutes % 1440;
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    return { totalMinutes, day, hour, minute, label: `День ${day} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
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
    protocolId: string;
    targetPointIds: string[];
    startedAtTick: number | null;
    updatedAtTick: number;
};

const DEVICE_DEFINITIONS = {
    lab_sex_machine: {
        deviceId: 'sex_machine' as const,
        configurations: {
            stirrups: ['nude', 'device_outfit'],
            restrained: ['nude', 'underwear'],
            suspended: ['nude', 'device_outfit'],
            milking: ['nude', 'device_outfit'],
            hmd: ['nude', 'device_outfit'],
            mind_control: ['nude', 'device_outfit']
        },
        defaultConfiguration: 'restrained',
        defaultWardrobe: 'underwear' as const
    },
    lab_sensory_pod: {
        deviceId: 'capsule' as const,
        configurations: {
            hmd: ['nude', 'device_outfit'],
            machine: ['nude', 'device_outfit'],
            electric: ['nude', 'device_outfit']
        },
        defaultConfiguration: 'hmd',
        defaultWardrobe: 'device_outfit' as const
    }
} as const;

type DeviceAssetId = keyof typeof DEVICE_DEFINITIONS;

const phaseForDeviceIntensity = (intensity: number): DeviceSession['phase'] =>
    intensity >= 85 ? 'peak' : intensity >= 60 ? 'intense' : 'sustain';

const isControllableDevice = (assetId: string): assetId is DeviceAssetId => assetId in DEVICE_DEFINITIONS;

function recoveryLabel(capacity: number, baselineCapacity: number) {
    if (baselineCapacity <= 25) return 'глубокое хроническое истощение';
    if (baselineCapacity <= 40) return 'хроническое истощение';
    if (capacity <= 10) return 'отключена';
    if (capacity <= 30) return 'истощена';
    if (capacity > baselineCapacity + 3) return 'восстановительный резерв';
    return 'стабильна';
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

    for (const device of devices) {
        if (!isControllableDevice(String(device.asset_id))) continue;
        let metadata: Record<string, any> = {};
        try { metadata = JSON.parse(device.metadata || '{}'); } catch { metadata = {}; }
        const session = metadata.deviceSession as DeviceSession | undefined;
        if (!session || session.status !== 'running' || excluded.has(session.subjectId)) continue;
        const core = subjectRepo.get(session.subjectId);
        if (!core) continue;
        const power = Math.max(0, Math.min(1, session.intensity / 100));
        const deviceMultiplier = session.deviceId === 'sex_machine' ? 1 : session.configuration === 'electric' ? 0.9 : 0.7;
        subjectRepo.save(session.subjectId, core.name || session.subjectId, {
            ...core,
            tension: Math.min(100, core.tension + (6 + 16 * power) * deviceMultiplier * hours),
            capacity: Math.max(0, core.capacity - (2 + 8 * power) * deviceMultiplier * hours)
        });
        const now = getWorldClock().totalMinutes + minutes;
        const nextSession = { ...session, phase: phaseForDeviceIntensity(session.intensity), updatedAtTick: now };
        db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
            .run(JSON.stringify({ ...metadata, deviceSession: nextSession }), device.player_id, device.asset_id);
    }
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
    const clock = advanceWorldTime(minutes);
    recordScenarioEvent('travel', `Прибытие: ${target.shortTitle}`, `Дорога заняла ${minutes} мин.`, { from: current.id, to: target.id });
    return { location: target, clock, minutes };
}

export function listInventory(playerId = PLAYER_ID) {
    return characterItemsRepo.listFor(playerId).map(entry => {
        const item = itemRepo.get(entry.itemId);
        return { ...entry, name: item?.name || entry.itemId, description: item?.description || '', type: item?.type || 'unknown' };
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
        WHERE a.player_id = ?
    `).all(playerId) as any[];
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
    const ownedLab = new Set(listLabAssets(playerId).map(asset => asset.id));
    const ownedItems = new Set(listInventory(playerId).map(item => item.itemId));
    return (db.prepare(`SELECT * FROM shop_offers ORDER BY category, price`).all() as any[]).map(row => ({
        id: row.id,
        itemId: row.item_id,
        name: row.name,
        description: row.description,
        category: row.category,
        price: row.price,
        stock: row.stock,
        owned: row.category === 'laboratory' ? ownedLab.has(row.item_id) : ownedItems.has(row.item_id) && row.stock === -1
    }));
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
        db.prepare(`DELETE FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`).run(playerId, characterId);
        db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, 'resident')`)
            .run(playerId, roomId, characterId);
    })();
    const clock = advanceWorldTime(30);
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
        db.prepare(`DELETE FROM laboratory_room_assignments WHERE player_id = ? AND character_id = ?`).run(playerId, characterId);
        db.prepare(`INSERT INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, 'resident')`)
            .run(playerId, roomId, characterId);
    })();
    const clock = advanceWorldTime(20);
    const title = role === 'asset' ? 'Перевод в активы' : 'Назначение в штат';
    const description = `${character.name}: статус изменён с «${currentRole}» на «${role}».`;
    const event = recordScenarioEvent('role_change', title, description, { subjectId: characterId, from: currentRole, role, roomId });
    appendRoleHistory(characterId, { role, previousRole: currentRole, worldMinute: event.worldMinute, title, description, sourceEventId: event.id });
    return { characterId, name: character.name, previousRole: currentRole, role, roomId, clock };
}

export function buyOffer(offerId: string, playerId = PLAYER_ID) {
    if (getPlayerLocation(playerId).id !== 'scene_broker') throw new Error('Покупки доступны только у Брокера');
    ensureWorldSeed();
    const offer = db.prepare(`SELECT * FROM shop_offers WHERE id = ?`).get(offerId) as any;
    if (!offer) throw new Error('Предложение больше недоступно');
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
    const clock = advanceWorldTime(10);
    recordScenarioEvent('purchase', 'Приобретено', offer.name, { offerId, price: offer.price });
    return { offerId, name: offer.name, price: offer.price, clock };
}

export function useLabAsset(assetId: string, subjectId: string, playerId = PLAYER_ID) {
    if (getPlayerLocation(playerId).id !== LAB_SCENE_ID) throw new Error('Лабораторное оборудование доступно только в лаборатории');
    if (!listLabAssets(playerId).some(asset => asset.id === assetId)) throw new Error('Модуль не установлен');
    if (!['lab_recovery_capsule', 'lab_diagnostic_table', 'lab_sensory_pod', 'lab_sex_machine'].includes(assetId)) throw new Error('Этот модуль пока не принимает активов');
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
    db.transaction(() => {
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
            protocolId: 'standard',
            targetPointIds: ['systemic'],
            startedAtTick: null,
            updatedAtTick: getWorldClock().totalMinutes
        } : undefined;
        db.prepare(`UPDATE laboratory_assets SET metadata = ? WHERE player_id = ? AND asset_id = ?`)
            .run(JSON.stringify(nextSubjectId
                ? { ...asset.metadata, subjectId: nextSubjectId, startedAt: getWorldClock().totalMinutes, previousRoomId, ...(deviceSession ? { deviceSession } : {}) }
                : { roomId: (asset.metadata as any)?.roomId }), playerId, assetId);
        db.prepare(`UPDATE laboratory_room_assignments SET room_id = ?, status = ? WHERE player_id = ? AND character_id = ?`)
            .run(nextSubjectId ? assetRoomId : returnRoomId, nextSubjectId ? `device:${assetId}` : 'resident', playerId, subjectId);
        db.prepare(`UPDATE scene_characters SET slot_id = ? WHERE scene_id = ? AND character_id = ?`)
            .run(nextSubjectId ? `device:${assetId}` : `room:${returnRoomId}`, LAB_SCENE_ID, subjectId);
    })();
    recordScenarioEvent('equipment', nextSubjectId ? 'Актив помещён в устройство' : 'Актив извлечён из устройства', `${core.name || subjectId}: ${asset.name}.`, { subjectId, assetId });
    return { subject: subjectRepo.get(subjectId), assetId, occupied: Boolean(nextSubjectId) };
}

export function controlDeviceSession(
    assetId: string,
    command: 'configure' | 'start' | 'adjust' | 'pause' | 'resume' | 'stop',
    payload: { configuration?: string; wardrobe?: string; intensity?: number; protocolId?: string; targetPointIds?: string[] } = {},
    playerId = PLAYER_ID
) {
    if (!isControllableDevice(assetId)) throw new Error('Устройство не поддерживает управляемые протоколы');
    const row = db.prepare(`SELECT asset_id, name, description, state, metadata FROM laboratory_assets WHERE player_id = ? AND asset_id = ?`)
        .get(playerId, assetId) as any;
    if (!row) throw new Error('Модуль не установлен');
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
        next = { ...next, configuration, wardrobe: wardrobe as DeviceSession['wardrobe'], protocolId: String(payload.protocolId || current.protocolId) };
    } else if (command === 'start') {
        if (current.status === 'running') throw new Error('Протокол уже запущен');
        next = { ...next, status: 'running', startedAtTick: current.startedAtTick ?? now };
    } else if (command === 'adjust') {
        if (!['running', 'paused'].includes(current.status)) throw new Error('Сначала запустите протокол');
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
    recordScenarioEvent('device_protocol', `Устройство: ${command}`, `${row.name}: ${next.configuration}, интенсивность ${next.intensity}%.`, {
        subjectId: next.subjectId, assetId, command, configuration: next.configuration, intensity: next.intensity
    });
    return { assetId, session: next };
}

export function getScenarioSnapshot(playerId = PLAYER_ID) {
    ensureWorldSeed();
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
            if (!transitions.length && log.action_type !== 'system_trigger') return [];
            if (transitions.length) return transitions.map((transition: any, index: number) => ({
                id: `engine-${log.id}-${index}`,
                time: log.timestamp,
                type: transition.kind || 'state',
                title: transition.title || 'Изменение состояния',
                description: transition.text || result.observation?.uiText || ''
            }));
            return [{
                id: `engine-${log.id}`,
                time: log.timestamp,
                type: 'state',
                title: action.actionLabel || 'Изменение состояния',
                description: action.narrative || ''
            }];
        }).slice(0, 16);
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
                   sps.local_openness AS openness, sps.familiarity, sps.exposure_count AS exposureCount
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
            history: [...scenarioHistory, ...engineHistory].slice(0, 16),
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
        residents,
        candidates: listCandidates(),
        shop: listShopOffers(playerId),
        events
    };
}
