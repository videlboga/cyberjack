import 'dotenv/config';
import { getModelAssignment } from '../src/adapters/modelAssignments';
const a = getModelAssignment('memory');
console.log('memory models:', JSON.stringify(a.models));
console.log('ttft:', a.ttftTimeoutMs, 'req:', a.requestTimeoutMs, 'maxTokens:', a.maxTokens);
