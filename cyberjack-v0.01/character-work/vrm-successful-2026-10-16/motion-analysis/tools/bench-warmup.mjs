
import {warmCommandPlanner} from './command-planner.mjs';
const t=performance.now();
const r=warmCommandPlanner();
console.log('WARM ms', Math.round(performance.now()-t), JSON.stringify(r));
