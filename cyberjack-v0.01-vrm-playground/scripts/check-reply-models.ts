import 'dotenv/config';
import { getModelAssignment } from '../src/adapters/modelAssignments';
const a = getModelAssignment('reply');
console.log('reply models:', JSON.stringify(a.models));
console.log('ttft:', a.ttftTimeoutMs, 'req:', a.requestTimeoutMs);
