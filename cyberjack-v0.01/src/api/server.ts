import express from 'express';
import cors from 'cors';
import { activeConfig } from '../prompts/config';

import tickRoutes from './routes/tickRoutes';
import stateRoutes from './routes/stateRoutes';
import playerRoutes from './routes/playerRoutes';
import sceneRoutes from './routes/sceneRoutes';
import metaRoutes from './routes/metaRoutes';

const app = express();
app.use(express.json());
app.use(cors());

// Error handler for malformed JSON bodies (body-parser)
app.use((err: any, req: any, res: any, next: any) => {
    if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed')) {
        console.error('[API] Malformed JSON body:', err.message || err);
        return res.status(400).json({ success: false, error: 'Invalid JSON in request body' });
    }
    next(err);
});

app.use('/api', tickRoutes);
app.use('/api', stateRoutes);
app.use('/api', playerRoutes);
app.use('/api', sceneRoutes);
app.use('/api', metaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
