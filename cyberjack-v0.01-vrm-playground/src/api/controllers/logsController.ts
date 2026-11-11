import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { readJsonLog } from '../../utils/fileLogs';

const ROOT = process.cwd();

export async function getPrompts(req: Request, res: Response) {
    try {
        const p = path.resolve(ROOT, 'prompt_snapshot.json');
        if (!fs.existsSync(p)) return res.json({ success: true, prompts: null });
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        const compact: Record<string, string> = {};
        if (parsed && parsed.subjects) {
            for (const k of Object.keys(parsed.subjects)) {
                compact[k] = parsed.subjects[k].personaText || parsed.subjects[k].systemPrompt || '';
            }
        }
        // also include recent generated prompt payloads (per-tick) if available
        const recentPayloads = readJsonLog('prompt_payloads.jsonl', 200);
        res.json({ success: true, prompts: { raw: parsed, compact, recentPayloads } });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e) });
    }
}

function tailLines(text: string, maxLines = 200) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= maxLines) return lines.join('\n');
    return lines.slice(lines.length - maxLines).join('\n');
}

export async function getEngineLog(req: Request, res: Response) {
    try {
        const p = path.resolve(ROOT, 'nohup-api.log');
        if (!fs.existsSync(p)) return res.json({ success: true, log: null });
        const raw = fs.readFileSync(p, 'utf-8');
        // also include structured engine state changes
        const stateChanges = readJsonLog('engine_state.jsonl', 200);
        return res.json({ success: true, log: tailLines(raw, 400), stateChanges });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e) });
    }
}

export async function getOrchestratorLog(req: Request, res: Response) {
    try {
        // return structured orchestration decision log first, fallback to grep from nohup
        const decisions = readJsonLog('orchestrator_decisions.jsonl', 300);
        const p = path.resolve(ROOT, 'nohup-api.log');
        let payload = '';
        if (fs.existsSync(p)) {
            const raw = fs.readFileSync(p, 'utf-8');
            const lines = raw.split(/\r?\n/);
            const matches = lines.filter(l => /orchestrat|Orchestrat|sceneOrchestrator|orchestration|runGameTick/i.test(l));
            payload = matches.length ? matches.slice(-300).join('\n') : tailLines(raw, 200);
        }
        return res.json({ success: true, decisions, raw: payload });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e) });
    }
}
