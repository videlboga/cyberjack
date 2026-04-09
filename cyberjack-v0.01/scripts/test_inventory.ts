import Database from 'better-sqlite3';
import { characterItemsRepo, sceneObjectsRepo, characterRepo } from '../src/infrastructure/repositories';

console.log('Fetching characters...');
const characters = new Database('cyberjack.sqlite').prepare('SELECT * FROM characters').all();
console.log(characters);

const testChar = characters[0] as any;
if (!testChar) {
    console.log('No characters found!');
    process.exit(1);
}

console.log('Saving item for character', testChar.id);
characterItemsRepo.save({
    characterId: testChar.id,
    itemId: 'handcuffs',
    state: 'active',
    charges: 1
});

console.log('Listing items:');
console.log(characterItemsRepo.listFor(testChar.id));

sceneObjectsRepo.save({
    id: 'so-1',
    sceneId: 'lab',
    itemId: 'sensory_deprivation_pod'
});

console.log('Listing scene objects:');
console.log(sceneObjectsRepo.listForScene('lab'));

