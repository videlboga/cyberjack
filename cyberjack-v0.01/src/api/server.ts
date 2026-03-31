import express from 'express';
import cors from 'cors'; // <-- Добавил CORS
import { runGameTick } from '../orchestration/runGameTick';
import { CompiledAction } from '../domain/types';

const app = express();
app.use(express.json());
app.use(cors()); // Это решает многие проблемы политики безопастности

app.post('/api/tick', (req, res) => {
    try {
        const action: CompiledAction = req.body.action; 
        const subjectId = req.body.subjectId || 'sub_1';
        const playerId = req.body.playerId || 'player_1';
        const pointId = req.body.pointId || 'point_A';
        const sceneId = req.body.sceneId || 'scene_main';

        const result = runGameTick({
            subjectId,
            playerId,
            pointId,
            sceneId,
            action
        });

        res.json({ success: true, result });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/state', (req, res) => {
    res.json({ message: "Engine API running", note: "Database state sync will be implemented later" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
