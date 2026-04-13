import fs from 'fs';
let code = fs.readFileSync('src/api/controllers/metaController.ts', 'utf8');

const newCode = `

import { db } from '../../infrastructure/db';

export function getAllCharacters(req: Request, res: Response) {
    try {
        const rows = db.prepare('SELECT * FROM characters').all();
        res.json({ success: true, characters: rows.map((r: any) => ({ ...r, profile: r.profile_json ? JSON.parse(r.profile_json) : null })) });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function deleteCharacter(req: Request, res: Response) {
    try {
        const { id } = req.params;
        db.transaction(() => {
            db.prepare('DELETE FROM scene_characters WHERE character_id = ?').run(id);
            db.prepare('DELETE FROM character_resources WHERE character_id = ?').run(id);
            db.prepare('DELETE FROM subject_point_states WHERE subject_id = ?').run(id);
            db.prepare('DELETE FROM active_contexts WHERE subject_id = ?').run(id);
            db.prepare('DELETE FROM chat_memory WHERE subject_id = ?').run(id);
            db.prepare('DELETE FROM character_relations WHERE from_id = ? OR to_id = ?').run(id, id);
            db.prepare('DELETE FROM characters WHERE id = ?').run(id);
            db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
        })();
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function generateCharacterEndpoint(req: Request, res: Response) {
    try {
        const subjectId = req.body.subjectId || \`CharGen-\${Date.now()}\`;
        const profile = ensureGeneratedProfile(subjectId);

        // create character in db
        db.transaction(() => {
          db.prepare(\`
            INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
            VALUES (?, ?, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
          \`).run(subjectId, req.body.name || profile.personaText.split('\\n')[1]?.replace('- Имя: ', '').trim() || subjectId);

          db.prepare(\`
            INSERT INTO characters (id, name, kind, subject_id, profile_json) 
            VALUES (?, ?, 'subject', ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, profile_json = excluded.profile_json
          \`).run(subjectId, req.body.name || profile.personaText.split('\\n')[1]?.replace('- Имя: ', '').trim() || subjectId, subjectId, JSON.stringify(profile));
        })();

        res.json({ success: true, subjectId, profile });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}
`;

fs.writeFileSync('src/api/controllers/metaController.ts', code + newCode);
