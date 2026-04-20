const fs = require('fs');
const content = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');

const replacement = `const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [
    {
        id: 'PL-1',
        name: 'Player',
        state: { sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 50 },
        profile: {
            base: { name: 'Player', age: 30, gender: 'male', anatomy: 'none', status: 'calibrator' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Main character.' },
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
            base: { name: 'Шепот', age: 40, gender: 'male', anatomy: 'none', status: 'npc' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Торговец информацией.' },
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
            base: { name: 'Куратор', age: 35, gender: 'female', anatomy: 'none', status: 'npc' },
            origin: { birthplaceId: 'loc-001', professionId: 'prof-001', biography: 'Представитель Корпорации.' },
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
            origin: { birthplaceId: 'loc-004', professionId: 'prof-002', biography: 'S-ASSET-1.' },
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
            origin: { birthplaceId: 'loc-002', professionId: 'prof-002', biography: 'S-ASSET-2.' },
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
            origin: { birthplaceId: 'loc-003', professionId: 'prof-002', biography: 'S-ASSET-3.' },
            personality: { traits: [], quirks: [], speechStyle: '', coreBelief: '' },
            knowledge: { common: [], personal: [], secrets: [] },
            memory: { knownCharacters: {}, scars: [] }
        }
    }
];`;

const oldSubjects = fs.readFileSync('old_subjects.txt', 'utf8');

const newContent = content.replace(oldSubjects.trim(), replacement);
if (content === newContent) {
    console.log("Failed to replace string.");
} else {
    fs.writeFileSync('src/infrastructure/seed.ts', newContent);
    console.log("Success.");
}
