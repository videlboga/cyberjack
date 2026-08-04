import 'dotenv/config';
import { parseSemanticVerbalInput } from '../src/parser/semanticVerbalParser';

const characters = [
    { id: 'S-MIRA', name: 'Мира' },
    { id: 'S-NIKA', name: 'Ника' },
    { id: 'S-IONA', name: 'Иона' }
];
const cases = [
    'Ника, поцелуй Миру в губы',
    'Ника, подойди ближе',
    'Прекрати это',
    'Тебе нравится, когда гладят ступни?',
    'Я хочу поцеловать тебя',
    '*провожу рукой по её спине*',
    'Ты сегодня удивительно красивая',
    'Ненавижу, когда мне грубят'
];

for (const text of cases) {
    const parsed = await parseSemanticVerbalInput(
        text,
        'Лаборатория. Все перечисленные персонажи находятся рядом.',
        characters,
        'S-NIKA',
        'S-NIKA'
    );
    console.log(JSON.stringify({ text, intent: parsed.commandIntent, tone: { valence: parsed.valence, intensity: parsed.intensity, sharpness: parsed.sharpness }, mentions: parsed.semanticMentions, routing: parsed.routing, model: parsed.model }));
}
