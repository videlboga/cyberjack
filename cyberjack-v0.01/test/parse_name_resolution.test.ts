import assert from 'assert';
import { cleanNamePublic, stemRussianPublic, levenshteinPublic, resolveTargetName } from '../src/parser/verbalParser';

function run() {
    console.log('Running name normalization tests...');

    // cleanName
    assert.strictEqual(cleanNamePublic('Калибратор'), 'калибратор');
    assert.strictEqual(cleanNamePublic('  Калибратора! '), 'калибратора');
    assert.strictEqual(cleanNamePublic('Эли-Вокс'), 'эли вокс');

    // stem
    assert.strictEqual(stemRussianPublic('калибратор'), 'калибратор');
    assert.strictEqual(stemRussianPublic('калибратора'), 'калибратор');
    // note: crude stemmer may remove a final vowel -> 'эли' -> 'эл'
    assert.strictEqual(stemRussianPublic('эли'), 'эл');

    // levenshtein
    const d = levenshteinPublic('калибратор', 'калибраатор');
    console.log('levenshtein distance sample:', d);
    assert.ok(typeof d === 'number' && d >= 0);

    // resolveTargetName
    const sceneCharacters = [
        { id: 'PL-1', name: 'Калибратор' },
        { id: 'S-01', name: 'Эли' },
        { id: 'PL-2', name: 'Векc' }
    ];

    // exact id
    assert.strictEqual(resolveTargetName('PL-1', sceneCharacters), 'PL-1');
    // exact name
    assert.strictEqual(resolveTargetName('Калибратор', sceneCharacters), 'PL-1');
    // inflected
    assert.strictEqual(resolveTargetName('Калибратора', sceneCharacters), 'PL-1');
    // small typo
    const fuzzy = resolveTargetName('Калибраатор', sceneCharacters);
    console.log('fuzzy resolved:', fuzzy);
    assert.strictEqual(fuzzy, 'PL-1');

    // name that doesn't match should return original
    assert.strictEqual(resolveTargetName('некто', sceneCharacters), 'некто');

    console.log('All normalization tests passed.');
}

try {
    run();
    process.exit(0);
} catch (err) {
    console.error('Tests failed:', err);
    process.exit(2);
}
