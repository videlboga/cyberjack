import 'dotenv/config';
import '../src/infrastructure/db';
import { getLaboratorySpatialContext } from '../src/scenario/spatialContext';
for (const who of ['NPC-CAND-GEN-02', 'S-AV-01', 'NPC-CAND-01']) {
    const s = getLaboratorySpatialContext(who, 'PL-1');
    console.log(who, '→ characterNames:', JSON.stringify(s?.characterNames), '| isolated:', s?.isolated, '| room:', s?.roomId);
}
