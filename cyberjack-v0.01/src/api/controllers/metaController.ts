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
