const fs = require('fs');
let code = fs.readFileSync('src/infrastructure/seed.ts', 'utf8');
// Replace everything between "const subjects = [" and "];" with our array
const startStr = "const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [";
const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf("];", startIdx);
if (startIdx === -1 || endIdx === -1) {
    console.log("Could not find subjects array boundaries.");
    process.exit(1);
}

const replacement = `const subjects: { id: string, name: string, state: any, profile: CharacterProfile }[] = [
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
`;

const newCode = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('src/infrastructure/seed.ts', newCode);
console.log("Success.");
