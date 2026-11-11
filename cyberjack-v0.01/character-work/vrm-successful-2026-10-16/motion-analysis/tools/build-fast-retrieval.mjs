// Offline preparation; later server starts read the exact derived arrays.
import {warmCommandPlanner} from './command-planner.mjs';
const start=performance.now(),index=warmCommandPlanner();console.log(JSON.stringify({...index,elapsedMs:performance.now()-start}));
