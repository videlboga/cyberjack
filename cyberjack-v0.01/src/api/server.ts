import express from 'express';
import cors from 'cors';
import { runGameTick } from '../orchestration/runGameTick';
import { db } from '../infrastructure/db';
import { sendToSillyTavern } from '../adapters/sillyTavernAdapter';
import { buildDiagnostics } from '../diagnostics/buildDiagnostics';
import { buildPromptPayload } from '../prompts/buildPromptPayload';
import { activeConfig, updateConfig } from '../prompts/config';
import { parseVerbalInput } from '../parser/verbalParser';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/tick', async (req, res) => {
    try {
        const { subjectId = 'S-01', playerId = 'PL-1', sceneId = 'lab', presetId, textMessage } = req.body;
        let pointId = req.body.pointId || 'general';

        // Optional text semantic classification
        let dynamicModifiers;
        if (textMessage) {
            dynamicModifiers = await parseVerbalInput(textMessage);
            if (dynamicModifiers.pointId) {
                // Пытаемся применить точку из LLM, если она существует в БД
                const pointExists = db.prepare('SELECT 1 FROM point_presets WHERE id = ?').get(dynamicModifiers.pointId);
                if (pointExists) {
                    pointId = dynamicModifiers.pointId;
                } else {
                    console.log(`[Server] Unknown pointId "${dynamicModifiers.pointId}" from LLM. Falling back to "general".`);
                    pointId = 'general';
                }
            }
        }

        // Run engine logic
        const engineOutput = runGameTick({
            subjectId,
            playerId,
            pointId,
            sceneId,
            presetId,
            playerIntensity: 1.0,
            dynamicModifiers
        });

        // Current Subject State query for UI
        const stateObj = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
        const pointObj = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get(subjectId, pointId);
        const fullState = { ...stateObj as object, point: pointObj };

    // Post-Tick Processes (Diagnostics & Prompts)
    // Use the pre-tick core stored in engineOutput.tickMeta.inputs.core when available.
    // Previously we passed the DB state (which was already updated) as the "previous" core,
    // producing zero deltas because previous === next. Use the engine's recorded inputs
    // to compute meaningful deltas.
    const action = engineOutput.tickMeta?.inputs?.action || {intensity:0, valence:0, contact:0, sharpness:0, novelty:0};
    const previousCore = engineOutput.tickMeta?.inputs?.core || (fullState as any);
    const diagnostics = buildDiagnostics(action, previousCore, engineOutput);
        const promptPayload = await buildPromptPayload(subjectId, engineOutput as any);

        // ST API Integration
        const {reply: stReply, sentMessages} = await sendToSillyTavern(promptPayload, textMessage);

        res.json({
            success: true,
            tickResult: engineOutput.result,
            state: fullState,
            diagnostics,
            reply: stReply,
            promptMessages: sentMessages,
            // expose classifier raw log for debugging
            classifierLog: dynamicModifiers?.raw ?? null,
            classifierModel: dynamicModifiers?.model ?? null
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/state', (req, res) => {
    const subjectId = req.query.subjectId || 'S-01';
    const pointId = req.query.pointId || 'hands';
    
    try {
        const stateObj = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subjectId);
        const pointObj = db.prepare('SELECT * FROM subject_point_states WHERE subject_id = ? AND point_id = ?').get(subjectId, pointId);
        const actions = db.prepare('SELECT id, label FROM action_presets').all();
        const points = db.prepare('SELECT p.id, p.label FROM point_presets p JOIN subject_point_states sps ON p.id = sps.point_id WHERE sps.subject_id = ?').all(subjectId);

        res.json({
            success: true,
            subject: { ...stateObj as object, point: pointObj },
            availableActions: actions,
            availablePoints: points
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({ success: true, config: activeConfig });
});

app.post('/api/config', (req, res) => {
    try {
        updateConfig(req.body.config);
        res.json({ success: true, config: activeConfig });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
