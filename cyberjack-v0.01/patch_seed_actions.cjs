const fs = require('fs');
const file = 'src/infrastructure/seed.ts';
let code = fs.readFileSync(file, 'utf8');

const anchor = "id: 'restraint_cuffs', label: 'Скованность: Наручники', type: 'restraint'";
const newContexts = `, contextConfig: { duration: -1 } },
        { id: 'context_defiant', label: 'Агрессивный бунт', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_fear_of_loss', label: 'Страх утраты', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0.1, valence: -0.2, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_glitch_prone', label: 'Нестабильность имплантов', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.1, valence: -0.1, contact: 0, sharpness: 0, novelty: 0.2 }, contextConfig: { duration: -1 } },
        { id: 'context_sensitive_skin', label: 'Гиперестезия', type: 'condition', tags: ['physical', 'condition'], values: { intensity: 0.2, valence: 0, contact: 0.2, sharpness: 0.3, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_masochism', label: 'Мазохистская инверсия', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: 0, contact: 0, sharpness: 0, novelty: 0 }, contextConfig: { duration: -1 } },
        { id: 'context_pleasure_burn', label: 'Ожог удовольствием', type: 'condition', tags: ['mental', 'condition'], values: { intensity: 0, valence: -0.1, contact: 0, sharpness: 0.1, novelty: 0 }, contextConfig: { duration: -1 } }`;

code = code.replace(/, contextConfig: \{ type: 'restraint', occupiesPoints: \['wrists_front'\], duration: -1 \} \}/, newContexts);
fs.writeFileSync(file, code);
