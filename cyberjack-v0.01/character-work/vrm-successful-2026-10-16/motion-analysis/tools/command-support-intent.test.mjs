import assert from 'node:assert/strict';import {validateIntent,validateRequestGeometry} from './command-language.mjs';
const plan=cs=>({stages:[{constraints:cs}]}),knees={features:{leftKneeHeight:.02,rightKneeHeight:.02,leftKnee:100,rightKnee:100}};
assert.throws(()=>validateRequestGeometry(plan([{feature:'chestUp',max:-.2}]),'Отклониться назад',knees),/положительного/);
assert.throws(()=>validateRequestGeometry(plan([{feature:'chestUp',min:.2}]),'Отклониться назад',knees),/коленях/);
assert.throws(()=>validateRequestGeometry(plan([{feature:'leftKneeHeight',max:.04}]),'Встать на четвереньки',{}),/кисти/);
const constraints=[{feature:'chestUp',min:.2},...['left','right'].map(side=>({feature:side+'KneeHeight',max:.05}))];assert.equal(validateRequestGeometry(plan(constraints),'Отклониться назад',knees).stages.length,1);
const out=validateIntent({summary:'На колени',stages:[{description:'На колени',constraints}]});assert(out.stages[0].constraints.find(c=>c.feature==='kneeSeparation').min>=.04);console.log('PASS signed lean, preserve kneeling support, both hands for all fours, anatomical knee clearance');
