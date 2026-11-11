import assert from 'node:assert/strict';
import {nextRecoveryStage} from './command-planner.mjs';
const stage={constraints:[{feature:'hipHeight',min:.1,max:.2}],translation:[0,0],yaw:0,semantics:{query:'sit'}};
const failure={status:'unresolved',reason:'collision',source:{id:'a'},correction:{status:'applied',id:'b'}};
const first=nextRecoveryStage(stage,failure);assert(first.skipContextCorrection);assert.deepEqual(first.constraints,stage.constraints);
const second=nextRecoveryStage(first,failure);assert.deepEqual(second.rejectedSourceIds,['a']);assert(!second.skipContextCorrection);
const third=nextRecoveryStage(second,{...failure,source:{id:'c'},correction:null});assert.deepEqual(third.rejectedSourceIds,['a','c']);assert.equal(nextRecoveryStage(third,failure),null);
assert.equal(nextRecoveryStage(stage,{status:'ready'}),null);assert.equal(nextRecoveryStage({...stage,support:{}},failure),null);
console.log('PASS bounded local recovery retains goals, omits optional correction before changing source, prevents repeat candidates');
