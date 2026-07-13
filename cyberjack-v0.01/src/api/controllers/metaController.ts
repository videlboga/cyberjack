import { getBaseHumanAnatomy } from "../../domain/anatomy";
import { Request, Response } from 'express';
import { activeConfig, updateConfig } from '../../prompts/config';
import { generateCharacterContext } from '../../orchestration/characterGenerator/generator';
import { ensureGeneratedProfile, regenerateGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';

export function getConfig(req: Request, res: Response) {
    res.json({ success: true, config: activeConfig });
}

export function postConfig(req: Request, res: Response) {
    try {
        updateConfig(req.body.config);
        res.json({ success: true, config: activeConfig });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function getCharacterProfile(req: Request, res: Response) {
    try {
        const rawSubject = req.query.subjectId;
        const subjectId = typeof rawSubject === 'string' && rawSubject.trim().length > 0 ? rawSubject.trim() : 'S-01';
        const profile = ensureGeneratedProfile(subjectId);
        res.json({ success: true, subjectId, profile });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export async function getCharacterPrompt(req: Request, res: Response) {
    try {
        const querySubject = typeof req.query.subjectId === 'string' ? req.query.subjectId.trim() : '';
        const subjectId = req.method === 'GET' ? querySubject || 'S-01' : req.body.subjectId || 'S-01';
        const includeTags = Array.isArray(req.body.includeTags) ? req.body.includeTags : undefined;
        const excludeTags = Array.isArray(req.body.excludeTags) ? req.body.excludeTags : undefined;
        let seed = typeof req.body.seed === 'string' && req.body.seed.trim() ? req.body.seed.trim() : undefined;
        if (req.method === 'GET') {
            seed = typeof req.query.seed === 'string' && req.query.seed.trim() ? req.query.seed.trim() : undefined;
        }
        const profile = req.method === 'POST'
            ? regenerateGeneratedProfile(subjectId, { seed, includeTags, excludeTags })
            : ensureGeneratedProfile(subjectId);

        res.json({
            success: true,
            subjectId,
            seed: profile.seed,
            profile,
            ...profile
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}


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
        const subjectId = req.body.subjectId || `CharGen-${Date.now()}`;
        if (db.prepare('SELECT 1 FROM characters WHERE id = ? OR subject_id = ?').get(subjectId, subjectId)) {
            return res.status(409).json({ success: false, error: `Character ${subjectId} already exists` });
        }
        const seed = typeof req.body.seed === 'string' && req.body.seed.trim() ? req.body.seed.trim() : subjectId;
        const draft = generateCharacterContext({ seed });
        const identity = {
            name: req.body.name || draft.baseProfile!.name,
            age: Number(req.body.age ?? draft.baseProfile!.age),
            gender: req.body.gender || draft.baseProfile!.gender,
            anatomy: req.body.anatomy || draft.baseProfile!.anatomy,
            status: 'asset'
        };

        db.transaction(() => {
            db.prepare(`INSERT INTO characters (id, name, kind, subject_id, profile_json) VALUES (?, ?, 'subject', ?, ?)`)
                .run(subjectId, identity.name, subjectId, JSON.stringify({ base: identity }));
        })();

        const profile = regenerateGeneratedProfile(subjectId, { seed });
        const core = profile.mechanicalSeed.coreModifiers;
        const value = (key: string) => Math.max(0, Math.min(100, 50 + Number(core[key] || 0)));
        db.transaction(() => {
            db.prepare(`
                INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, preferences,
                    baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                subjectId, identity.name,
                value('sensitivity'), value('capacity'), value('openness'), value('plasticity'), value('attitude'),
                JSON.stringify(profile.mechanicalSeed.preferences),
                value('sensitivity'), value('capacity'), value('openness'), value('plasticity'), value('attitude')
            );
            const anatomyGender = identity.gender === 'other' ? 'androgynous' : identity.gender;
            const points = getBaseHumanAnatomy(anatomyGender, identity.anatomy === 'none' ? 'none' : undefined);
            const stmt = db.prepare(`INSERT INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`);
            for (const point of points) stmt.run(subjectId, point.id, point.sens, point.att, point.sens, point.att);
        })();

        res.json({ success: true, subjectId, profile });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}
export function getDiagnostics(req: any, res: any) { try { const fs = require('fs'); const prompt = fs.existsSync('prompt_snapshot.json') ? fs.readFileSync('prompt_snapshot.json', 'utf-8') : 'null'; const result = fs.existsSync('result_log.json') ? fs.readFileSync('result_log.json', 'utf-8') : 'null'; res.json({ success: true, prompt: prompt !== 'null' ? JSON.parse(prompt) : null, result: result !== 'null' ? JSON.parse(result) : null }); } catch (e) { res.status(500).json({ success: false, error: String(e) }); } }

import { presetRepo } from '../../infrastructure/repositories';

export function getActions(req: Request, res: Response) {
    try {
        const actions = presetRepo.getAllActionPresets();
        res.json(actions);
    } catch (e: any) {
        res.status(500).json({ error: String(e) });
    }
}
