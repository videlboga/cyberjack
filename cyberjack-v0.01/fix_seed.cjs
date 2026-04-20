const fs = require('fs');

const seedFile = 'src/infrastructure/seed.ts';
let code = fs.readFileSync(seedFile, 'utf8');

const splitPoint = "const labSceneId = 'lab';";
if (!code.includes(splitPoint)) {
    console.error("Could not find split point");
    process.exit(1);
}

const newScenesCode = `
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
        { characterId: 'S-ASSET-1', role: 'asset', slotId: 'slot_display_1', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'S-ASSET-2', role: 'asset', slotId: 'slot_display_2', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'S-ASSET-3', role: 'asset', slotId: 'slot_display_3', sceneId: 'scene_broker', presenceState: 'present', canAct: true },
        { characterId: 'C-LIAISON', role: 'npc', slotId: 'slot_liaison_desk', sceneId: 'scene_liaison', presenceState: 'present', canAct: true }
    ];

    for (const placement of placements) {
        upsertSceneCharacterStmt.run(placement.sceneId, placement.characterId, placement.role, placement.canAct ? 1 : 0, placement.presenceState, placement.slotId);
        updateCharacterLocationStmt.run(placement.sceneId, placement.characterId);
    }
`;

const lines = code.split(splitPoint);
const fileEnd = code.substring(code.indexOf('console.log("Обновление точек', lines[0].length));

const finalCode = lines[0] + newScenesCode + '\n    ' + fileEnd;
fs.writeFileSync(seedFile, finalCode);

const baseDataStr = fs.readFileSync(seedFile, 'utf8');

const updatedData = baseDataStr.replace(/const subjects: any\[\] = \[[\s\S]*?\];/i, "const subjects: any[] = [\n" +
    "    { id: 'PL-1', name: 'Калибратор', state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 }, profile: { base: { name: 'Калибратор', age: 30, gender: 'male', anatomy: 'none', status: 'calibrator' }, origin: { biopsy: 'Игрок' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } },\n" +
    "    { id: 'C-BROKER', name: 'Брокер', state: { sensitivity: 0, capacity: 100, openness: 10, plasticity: 0, attitude: 50 }, profile: { base: { name: 'Брокер', age: 45, gender: 'male', anatomy: 'default', status: 'npc' }, origin: { biography: 'Торговец' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } },\n" +
    "    { id: 'C-LIAISON', name: 'Связной', state: { sensitivity: 0, capacity: 100, openness: 10, plasticity: 0, attitude: 50 }, profile: { base: { name: 'Связной', age: 35, gender: 'female', anatomy: 'default', status: 'npc' }, origin: { biography: 'Корпорация' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } },\n" +
    "    { id: 'S-ASSET-1', name: 'Молчун', state: { sensitivity: 65, capacity: 30, openness: 20, plasticity: 40, attitude: 10 }, profile: { base: { name: 'Актив #144', age: 22, gender: 'male', anatomy: 'default', status: 'asset' }, origin: { biography: 'Глитч' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } },\n" +
    "    { id: 'S-ASSET-2', name: 'Рыжая', state: { sensitivity: 80, capacity: 60, openness: 70, plasticity: 50, attitude: 40 }, profile: { base: { name: 'Актив #890', age: 25, gender: 'female', anatomy: 'default', status: 'asset' }, origin: { biography: 'Эмпат' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } },\n" +
    "    { id: 'S-ASSET-3', name: 'Стальной', state: { sensitivity: 20, capacity: 90, openness: 10, plasticity: 10, attitude: 30 }, profile: { base: { name: 'Актив #02', age: 38, gender: 'male', anatomy: 'default', status: 'asset' }, origin: { biography: 'Охранник' }, personality: { traits: [] }, knowledge: { common: [], personal: [], secrets: [] }, memory: { knownCharacters: {}, scars: [] } } }\n" +
    "];"
);

fs.writeFileSync(seedFile, updatedData);
