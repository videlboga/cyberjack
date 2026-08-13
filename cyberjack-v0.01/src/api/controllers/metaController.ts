import { Request, Response } from 'express';
import { activeConfig, updateConfig } from '../../prompts/config';
import { ensureGeneratedProfile, regenerateGeneratedProfile } from '../../orchestration/characterGenerator/profileManager';
import { deleteCharacterById, generateCharacter, characterExists, listAllCharacters, getAllActionPresets } from '../../services/characterAdminService';

export function getConfig(req: Request, res: Response) {
    res.json({ success: true, config: activeConfig });
}

export function getVisualAssetReviews(req: Request, res: Response) {
    try {
        const assetPath = typeof req.query.assetPath === 'string' ? req.query.assetPath : '';
        const rows = assetPath
            ? db.prepare('SELECT * FROM visual_asset_reviews WHERE asset_path = ? ORDER BY updated_at DESC').all(assetPath)
            : db.prepare('SELECT * FROM visual_asset_reviews ORDER BY updated_at DESC').all();
        res.json({ success: true, reviews: (rows as any[]).map(row => ({
            id: row.id, assetPath: row.asset_path, characterId: row.character_id,
            decision: row.decision, issues: JSON.parse(row.issues_json || '[]'), note: row.note || '',
            metadata: JSON.parse(row.metadata_json || '{}'), createdAt: row.created_at, updatedAt: row.updated_at
        })) });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function saveVisualAssetReview(req: Request, res: Response) {
    try {
        const assetPath = String(req.body.assetPath || '').trim();
        const characterId = String(req.body.characterId || '').trim();
        const decision = String(req.body.decision || '').trim();
        if (!assetPath || !characterId || !['keep', 'rework', 'reject'].includes(decision)) {
            return res.status(400).json({ success: false, error: 'assetPath, characterId and a valid decision are required' });
        }
        const issues = Array.isArray(req.body.issues) ? req.body.issues.map(String) : [];
        const note = String(req.body.note || '').trim();
        const metadata = req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
        db.prepare(`
            INSERT INTO visual_asset_reviews (asset_path, character_id, decision, issues_json, note, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_path, character_id) DO UPDATE SET
              decision = excluded.decision, issues_json = excluded.issues_json,
              note = excluded.note, metadata_json = excluded.metadata_json,
              updated_at = CURRENT_TIMESTAMP
        `).run(assetPath, characterId, decision, JSON.stringify(issues), note, JSON.stringify(metadata));
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
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
            profile
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}


import { db } from '../../infrastructure/db';

export function getAllCharacters(req: Request, res: Response) {
    try {
        res.json({ success: true, characters: listAllCharacters() });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function deleteCharacter(req: Request, res: Response) {
    try {
        const { id } = req.params;
        deleteCharacterById(String(id));
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
}

export function generateCharacterEndpoint(req: Request, res: Response) {
    try {
        const subjectId = req.body.subjectId || `CharGen-${Date.now()}`;
        if (characterExists(subjectId)) {
            return res.status(409).json({ success: false, error: `Character ${subjectId} already exists` });
        }
        const result = generateCharacter({
            subjectId,
            name: req.body.name,
            age: req.body.age,
            gender: req.body.gender,
            anatomy: req.body.anatomy,
            seed: req.body.seed,
        });
        res.json({ success: true, ...result });
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
