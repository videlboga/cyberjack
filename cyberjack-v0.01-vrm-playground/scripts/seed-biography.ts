import 'dotenv/config';
import '../src/infrastructure/seed';
import { seedAllBiographies } from '../src/services/seedBiography';
import { db } from '../src/infrastructure/db';

const written = seedAllBiographies();
console.log('biography-атомов записано:', written);

const rows = db.prepare(`
    SELECT subject_id, COUNT(*) as cnt FROM memory_embeddings WHERE type='biography' GROUP BY subject_id
`).all() as Array<{ subject_id: string; cnt: number }>;
for (const row of rows) console.log(`${row.subject_id}: ${row.cnt}`);
