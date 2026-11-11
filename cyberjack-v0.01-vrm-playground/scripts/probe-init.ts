import 'dotenv/config';
import '../src/infrastructure/seed';
import { ensureWorldSeed } from '../src/scenario/worldService';
import { db } from '../src/infrastructure/db';

// Run the canonical world seed and check placements.
ensureWorldSeed();
const rows = db.prepare(`SELECT character_id, slot_id FROM scene_characters WHERE scene_id='scene_lab_calibrator' ORDER BY character_id`).all() as any[];
for (const r of rows) {
    console.log(`${r.character_id}: ${r.slot_id}`);
}
