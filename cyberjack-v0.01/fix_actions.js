const fs = require('fs');
let content = fs.readFileSync('src/infrastructure/seed.ts', 'utf-8');

const actionsArray = `const actions = [
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
    { id: 'feint_strike', label: 'Ложный замах', values: { intensity: 0.7, valence: -0.5, contact: 0.0, sharpness: 0.9, novelty: 0.5 } }
];`;

const regex = /const actions = \[.*?\];/s;
content = content.replace(regex, actionsArray);

const newSceneLine = `db.prepare(\`INSERT OR REPLACE INTO scenes (id, available_actions, description) VALUES ('lab', '["gentle_stroke","tickle","light_kiss","deep_kiss","feather_stroke","deep_massage","licking","firm_grip","light_bite","hard_bite","pinch","scratching","slap","hard_slap","needle_prick","belt_strike","whip_strike","taser_shock","ice_cube","hot_wax","vibrator_pulse","hair_pull","spit","breath_blow","verbal_pressure","stare","close_inspection","feint_strike"]', 'Темная калибровочная лаборатория корпорации. Кондиционер гонит морозный воздух по полу. На стенах блестят холодные светодиоды диагностов, вокруг операционного стола раскиданы хирургические инструменты и кабеля нейроинтерфейсов.')\`).run();`;
const sceneRegex = /db\.prepare\(\`INSERT OR REPLACE INTO scenes.*?\.run\(\);/s;
content = content.replace(sceneRegex, newSceneLine);

fs.writeFileSync('src/infrastructure/seed.ts', content);
