import { getBaseHumanAnatomy } from "../../domain/anatomy";
import { Request, Response } from 'express';
import { activeConfig, updateConfig } from '../../prompts/config';
import { generateCharacterContext } from '../../orchestration/characterGenerator/generator';
import { composePromptSections } from '../../orchestration/characterGenerator/promptComposer';
import { ensureGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';

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
        const subjectId = req.body.subjectId || 'S-01';
        const includeTags = Array.isArray(req.body.includeTags) ? req.body.includeTags : undefined;
        const excludeTags = Array.isArray(req.body.excludeTags) ? req.body.excludeTags : undefined;
        let seed = typeof req.body.seed === 'string' && req.body.seed.trim() ? req.body.seed.trim() : undefined;
        if (req.method === 'GET') {
            const rawSubject = req.query.subjectId;
            const sub = typeof rawSubject === 'string' && rawSubject.trim().length > 0 ? rawSubject.trim() : 'S-01';
            seed = typeof req.query.seed === 'string' && req.query.seed.trim() ? req.query.seed.trim() : undefined;
        }
        
        const applyToSillyTavern = Boolean(req.body.applyToSillyTavern);

        const context = generateCharacterContext({ seed, includeTags, excludeTags });
        const narrative = context.narrative || { identityParagraphs: [], historyParagraphs: [], activationParagraphs: [] };
        const hasGeneratedNarrative = (narrative.identityParagraphs?.length || 0) > 0 || (narrative.historyParagraphs?.length || 0) > 0 || (narrative.activationParagraphs?.length || 0) > 0;
        
        const identityBlocks = narrative.identityParagraphs.length ? narrative.identityParagraphs : hasGeneratedNarrative ? [] : [activeConfig.character.identity];
        const historyBlocks = narrative.historyParagraphs.length ? narrative.historyParagraphs : hasGeneratedNarrative ? [] : [activeConfig.character.history];
        const activationBlocks = narrative.activationParagraphs || [];
        
        const sections = composePromptSections(context, {
            identity: activeConfig.character.identity,
            history: activeConfig.character.history,
            instructions: activeConfig.character.formatInstructions,
            identityBlocks,
            historyBlocks,
            activationBlocks,
            originBlocks: context.originStatements,
            assetBlocks: context.assetReasons
        });

        let stUpdate: { worldInfoName: string } | null = null;

        res.json({
            success: true,
            subjectId,
            seed: context.seed,
            tags: context.tags,
            grouped: context.grouped,
            personaNotes: context.personaNotes,
            personaText: sections.personaText,
            loreNotes: context.loreNotes,
            sections,
            stUpdate
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
        const profile = ensureGeneratedProfile(subjectId);

        // create character in db
        db.transaction(() => {
          db.prepare(`
            INSERT INTO subjects (id, name, sensitivity, capacity, openness, plasticity, attitude, baseline_sensitivity, baseline_capacity, baseline_openness, baseline_plasticity, baseline_attitude)
            VALUES (?, ?, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name
          `).run(subjectId, req.body.name || profile.personaText.split('\n')[1]?.replace('- Имя: ', '').trim() || subjectId);

          db.prepare(`
            INSERT INTO characters (id, name, kind, subject_id, profile_json) 
            VALUES (?, ?, 'subject', ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, profile_json = excluded.profile_json
          `).run(subjectId, req.body.name || profile.personaText.split('\n')[1]?.replace('- Имя: ', '').trim() || subjectId, subjectId, JSON.stringify(profile));
        const points = getBaseHumanAnatomy('female', undefined);
        const stmt = db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id, point_id, local_sensitivity, local_attitude, familiarity, exposure_count, baseline_local_sensitivity, baseline_local_attitude) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`);
        for (const p of points) stmt.run(subjectId, p.id, p.sens, p.att, p.sens, p.att);
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
