/**
 * Единый механизм создания изначального состояния мира.
 *
 * Централизует всё, что раньше было разбросано по ensureWorldSeed(),
 * generatedCandidates.ts и seed.ts: стартовое состояние мира (часы, сцены),
 * персонажей с базовыми параметрами, наполнение лаборатории (комнаты, ассеты,
 * одежда) и размещение персонажей по комнатам/позам.
 *
 * Чтобы изменить изначальное состояние — правь декларативные константы ниже
 * (WORLD_STATE, CHARACTERS, LAB_ROOMS, LAB_ASSETS, PLACEMENTS), а не код.
 */
import { db } from '../infrastructure/db';
import { characterRepo, subjectRepo, pointStateRepo, resourceRepo } from '../infrastructure/repositories';
import { setLaboratoryPresence } from './spatialContext';
import { ensureStarterClothing } from '../infrastructure/starterClothing';
import { STARTER_CLOTHING } from '../infrastructure/starterClothing';
import { ensureGeneratedCandidates } from './generatedCandidates';
import { ensureCharacterStorySeeds } from './characterStorySeeds';
import { seedAllBiographies } from '../services/seedBiography';
// Должны совпадать с worldService.ts (избегаем циклической зависимости).
const PLAYER_ID = 'PL-1';
const LAB_SCENE_ID = 'scene_lab_calibrator';

/** Стартовое состояние мира (часы, день). */
export const WORLD_STATE = {
    totalMinutes: 480,
    day: 1,
};

/** Стартовые сцены (локации). */
export const SCENES: { id: string; description: string }[] = [
    { id: 'scene_lab_calibrator', description: 'Лаборатория калибровки' },
    { id: 'scene_broker', description: 'Витрина Брокера' },
    { id: 'scene_liaison', description: 'Связной' },
];

/** Стартовые комнаты лаборатории. */
export const LAB_ROOMS: { id: string; name: string; type: string; capacity: number; description: string }[] = [
    { id: 'room_calibration', name: 'Калибровочная', type: 'workroom', capacity: 2, description: 'Изолированное помещение для ручных воздействий и запуска протоколов. Здесь расположены диагностический стол, кресло ментальной коррекции, восстановительная капсула и модуль секс-машины.' },
    { id: 'room_cell_a', name: 'Жилая камера A', type: 'cell', capacity: 2, description: 'Закрытая жилая камера: узкая койка с тонким матрасом, санитарный модуль за перегородкой, тусклое верхнее освещение и небольшая настенная панель с музыкой и регулировкой света. Воздух сухой, с лёгким запахом дезинфекции. Режим дня: подъём в 07:00, приёмы пищи в 08:00, 13:00 и 19:00, отбой в 23:00.' },
    { id: 'room_cell_b', name: 'Жилая камера B', type: 'cell', capacity: 2, description: 'Закрытая жилая камера: две койки с тонкими матрасами, санитарный модуль за перегородкой, тусклое верхнее освещение и настенная панель с музыкой и регулировкой света. Воздух сухой, с лёгким запахом дезинфекции. Режим дня: подъём в 07:00, приёмы пищи в 08:00, 13:00 и 19:00, отбой в 23:00.' },
    { id: 'room_cell_c', name: 'Жилая камера C', type: 'cell', capacity: 2, description: 'Закрытая жилая камера: две койки с тонкими матрасами, санитарный модуль за перегородкой, тусклое верхнее освещение и настенная панель с музыкой и регулировкой света. Воздух сухой, с лёгким запахом дезинфекции. Режим дня: подъём в 07:00, приёмы пищи в 08:00, 13:00 и 19:00, отбой в 23:00.' },
    { id: 'room_control', name: 'Пост наблюдения', type: 'staff', capacity: 2, description: 'Рабочее место ассистента: терминал телеметрии с данными активов, панель управления оборудованием, журнал событий лаборатории и список контрактов. Отсюда видно состояние всех активов и текущие процедуры.' },    { id: 'room_staff_living', name: 'Комната персонала', type: 'staff', capacity: 2, description: 'Жилая комната для персонала лаборатории: две койки с тонкими матрасами, санитарный модуль за перегородкой, тусклое верхнее освещение и настенная панель с музыкой и регулировкой света. Воздух сухой, с лёгким запахом дезинфекции. Режим дня: подъём в 07:00, приёмы пищи в 08:00, 13:00 и 19:00, отбой в 23:00.' },
];

/** Стартовые ассеты лаборатории (оборудование). */
export const LAB_ASSETS: { id: string; roomId: string; name: string; description: string }[] = [
    { id: 'lab_diagnostic_table', roomId: 'room_calibration', name: 'Диагностический стол', description: 'Базовая телеметрия и ручная калибровка актива.' },
    { id: 'lab_mental_correction_chair', roomId: 'room_calibration', name: 'Кресло ментальной коррекции', description: 'Управляемые ментальные процедуры.' },
    { id: 'lab_recovery_capsule', roomId: 'room_cell_b', name: 'Капсула восстановления', description: 'Восстановление после процедур.' },
    { id: 'cell_a_music_panel', roomId: 'room_cell_a', name: 'Настенная панель музыки', description: 'Небольшая панель с выбором фоновой музыки и регулировкой громкости. Можно включить.' },
    { id: 'cell_a_light_panel', roomId: 'room_cell_a', name: 'Панель освещения', description: 'Регулировка яркости и оттенка верхнего света в камере.' },
    { id: 'cell_b_music_panel', roomId: 'room_cell_b', name: 'Настенная панель музыки', description: 'Небольшая панель с выбором фоновой музыки и регулировкой громкости. Можно включить.' },
    { id: 'cell_b_light_panel', roomId: 'room_cell_b', name: 'Панель освещения', description: 'Регулировка яркости и оттенка верхнего света в камере.' },
    { id: 'cell_c_music_panel', roomId: 'room_cell_c', name: 'Настенная панель музыки', description: 'Небольшая панель с выбором фоновой музыки и регулировкой громкости. Можно включить.' },
    { id: 'cell_c_light_panel', roomId: 'room_cell_c', name: 'Панель освещения', description: 'Регулировка яркости и оттенка верхнего света в камере.' },
];

/**
 * Стартовое размещение персонажей по комнатам.
 * Поза по умолчанию — «стоит» (slotId = room:<room_id>).
 * Чтобы персонаж стоял в конкретной комнате, укажи roomId; чтобы лежал на
 * устройстве — slotId = device:<asset_id>.
 */
export const PLACEMENTS: { characterId: string; roomId: string; slotId?: string; role?: string }[] = [
    { characterId: 'PL-1', roomId: 'room_calibration', role: 'calibrator' },
    { characterId: 'S-AV-01', roomId: 'room_cell_a', role: 'asset' },
    { characterId: 'NPC-LAB-01', roomId: 'room_control', role: 'assistant' },
    { characterId: 'NPC-CAND-01', roomId: 'room_cell_c', role: 'asset' },
    { characterId: 'NPC-CAND-SUMI', roomId: 'room_cell_b', role: 'asset' },
    { characterId: 'NPC-CAND-GEN-02', roomId: 'room_control', role: 'asset' },
    { characterId: 'NPC-CAND-GEN-04', roomId: 'room_cell_b', role: 'asset' },
];

/**
 * Создаёт изначальное состояние мира. Идемпотентно (INSERT OR IGNORE):
 * повторные вызовы не перезаписывают существующее состояние.
 */
export function initWorld(): void {
    // 1. Мир: часы + сцены
    db.prepare(`INSERT OR IGNORE INTO world_state (id, total_minutes, day) VALUES ('main', ?, ?)`)
        .run(WORLD_STATE.totalMinutes, WORLD_STATE.day);
    const ensureScene = db.prepare(`INSERT OR IGNORE INTO scenes (id, description, available_actions) VALUES (?, ?, '[]')`);
    for (const scene of SCENES) ensureScene.run(scene.id, scene.description);

    // 2. Персонажи (кандидаты генерируются, сюжетные сиды применяются)
    ensureGeneratedCandidates();
    ensureCharacterStorySeeds();
    seedAllBiographies();

    // 3. Комнаты лаборатории
    const insertRoom = db.prepare(`INSERT OR IGNORE INTO laboratory_rooms (player_id, room_id, name, room_type, description, capacity, state, metadata) VALUES (?, ?, ?, ?, ?, ?, 'ready', '{}')`);
    for (const room of LAB_ROOMS) insertRoom.run(PLAYER_ID, room.id, room.name, room.type, room.description, room.capacity);

    // 4. Ассеты лаборатории
    const insertAsset = db.prepare(`INSERT OR IGNORE INTO laboratory_assets (player_id, asset_id, name, description, state, metadata) VALUES (?, ?, ?, ?, 'installed', ?)`);
    for (const asset of LAB_ASSETS) insertAsset.run(PLAYER_ID, asset.id, asset.name, asset.description, JSON.stringify({ roomId: asset.roomId }));

    // 5. Размещение персонажей (все стоят в своих комнатах)
    const assignRoom = db.prepare(`INSERT OR IGNORE INTO laboratory_room_assignments (player_id, room_id, character_id, status) VALUES (?, ?, ?, 'resident')`);
    for (const p of PLACEMENTS) {
        if (!characterRepo.get(p.characterId)) continue;
        assignRoom.run(PLAYER_ID, p.roomId, p.characterId);
        setLaboratoryPresence({
            characterId: p.characterId,
            slotId: p.slotId || `room:${p.roomId}`,
            roomId: p.roomId,
            status: 'resident',
            playerId: PLAYER_ID,
        });
    }

    // 6. Стартовая одежда
    for (const [cid, items] of Object.entries(STARTER_CLOTHING)) {
        ensureStarterClothing(cid, items);
    }

    // 7. Стартовые ресурсы игрока
    const resources = resourceRepo.get(PLAYER_ID);
    if (!resources?.resources.credits) {
        resourceRepo.save({
            id: PLAYER_ID,
            resources: {
                ...(resources?.resources || {}),
                credits: { characterId: PLAYER_ID, resourceKey: 'credits', amount: 1000, maxAmount: 1000000, regenRate: 0 },
            },
        });
    }
}
