import 'dotenv/config';
import { retrieve } from '../src/parser/semanticVerbalParser';
import '../src/infrastructure/db';

await retrieve('тест').catch(() => {});
for (const t of ['Тогда возьми его в рот', 'возьми в рот', 'соси']) {
    const c = await retrieve(t);
    console.log(`=== "${t}" actions ===`);
    console.log(c.actions.slice(0, 8).map(a => a.id).join(', '));
}
