console.log("Starting server.ts...");
console.log('Importing express...'); import express from 'express'; console.log('express ok');

// Tests run in environments where @types/node may not be present for TS checks.
// Declare process to avoid a compile-time error here.
declare const process: any;
import cors from 'cors';
import http from 'http';
import { activeConfig } from '../prompts/config';
import { initWebSocket, broadcastEvent } from './socket';

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
app.get('/api/test-ws', (req, res) => {
    broadcastEvent('MOVE', { target: 'Box_350x250x300_Mesh', x: 0, y: 5, z: 0 });
    res.json({ success: true, message: 'Command sent to Unity' });
});


const PORT = process.env.PORT || 3000;
// Start server only when not in test mode. When running tests we import `app` and
// let Supertest handle requests without starting a dedicated listener.
if (process.env.NODE_ENV !== 'test') {
    const server = http.createServer(app);
    initWebSocket(server);
    server.listen(PORT, () => {
        console.log(`[Engine API + WS] Running on http://localhost:${PORT}`);
    });
}

export default app;
