import 'dotenv/config';
console.log("Starting server.ts...");
console.log('Importing express...'); import express from 'express'; console.log('express ok');

// Tests run in environments where @types/node may not be present for TS checks.
// Declare process to avoid a compile-time error here.
declare const process: any;
import cors from 'cors';
import http from 'http';
import path from 'path';
import { activeConfig } from '../prompts/config';
import { initWebSocket, broadcastEvent } from './socket';

import tickRoutes from './routes/tickRoutes';
import stateRoutes from './routes/stateRoutes';
import playerRoutes from './routes/playerRoutes';
import sceneRoutes from './routes/sceneRoutes';
import metaRoutes from './routes/metaRoutes';
import contractRoutes from './routes/contractRoutes';
import scenarioRoutes from './routes/scenarioRoutes';
import eventDirectorRoutes from './routes/eventDirectorRoutes';
import { ensureActionSpecialization } from '../infrastructure/actionSpecialization';
import { syncActionPresets } from '../infrastructure/syncActionPresets';
import { migrateCharacterLifecycles } from '../scenario/characterLifecycle';
import { setTimeFlowPaused, startTimeFlow } from '../scenario/timeFlow';
import { warmSemanticParser } from '../parser/semanticVerbalParser';

// Seed contracts on startup
try {
    await import('../infrastructure/seedContracts');
} catch (e: any) {
    console.warn('[Server] seedContracts failed (non-fatal):', e.message);
}

const app = express();
syncActionPresets();
ensureActionSpecialization();
migrateCharacterLifecycles();
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

// Any state-changing game interaction resumes world time. The dedicated time
// control is excluded because it must remain able to put the world on pause.
app.use('/api', (req: any, _res: any, next: any) => {
    if (req.method !== 'GET' && req.path !== '/scenario/time/flow') {
        setTimeFlowPaused(false);
    }
    next();
});

app.use('/api', tickRoutes);
app.use('/api', stateRoutes);
app.use('/api', playerRoutes);
app.use('/api', sceneRoutes);
app.use('/api', metaRoutes);
app.use('/api', contractRoutes);
app.use('/api', scenarioRoutes);
app.use('/api', eventDirectorRoutes);

// Serve generated scene images
app.use('/scene-images', express.static(path.resolve(process.cwd(), 'public', 'scene-images')));

app.get('/api/debug-env', (req: any, res: any) => {
    res.json({
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        keyPrefix: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.substring(0, 10) + '...' : 'none'
    });
});

app.get('/api/test-ws', (req: any, res: any) => {
    broadcastEvent('MOVE', { target: 'Box_350x250x300_Mesh', x: 0, y: 5, z: 0 });
    res.json({ success: true, message: 'Command sent to Unity' });
});

// Keep every API failure machine-readable. Without this, an unexpected route
// error can reach the client as an empty/HTML response and fail during JSON parsing.
app.use('/api', (err: any, req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);
    console.error('[API] Unhandled request error:', err);
    res.status(Number(err?.status) || 500).json({
        success: false,
        error: err?.message || 'Внутренняя ошибка сервера'
    });
});


const PORT = process.env.PORT || 3000;
// Start server only when not in test mode. When running tests we import `app` and
// let Supertest handle requests without starting a dedicated listener.
if (process.env.NODE_ENV !== 'test') {
    const server = http.createServer(app);
    initWebSocket(server);
    server.listen(PORT, () => {
        console.log(`[Engine API + WS] Running on http://localhost:${PORT}`);
        // Make HTTP available before background simulation and model warmup.
        startTimeFlow();
        void warmSemanticParser().catch(error => console.warn('[SemanticParser] warmup failed:', error?.message || error));
    });
}

export default app;
