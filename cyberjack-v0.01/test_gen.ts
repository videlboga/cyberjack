import { generateRandomCharacter } from './src/orchestration/canonGenerator.js';
const char = generateRandomCharacter('Тестовый Персонаж');
console.log(JSON.stringify(char, null, 2));
