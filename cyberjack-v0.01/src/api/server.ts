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

app.use('/api', tickRoutes);
app.use('/api', stateRoutes);
app.use('/api', playerRoutes);
app.use('/api', sceneRoutes);
app.use('/api', metaRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Engine API] Running on http://localhost:${PORT}`);
});
