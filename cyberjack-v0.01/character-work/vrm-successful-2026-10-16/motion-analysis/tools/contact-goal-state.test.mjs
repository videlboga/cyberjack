import assert from 'node:assert/strict';import{retainedBodyTouchGoals,withBodyTouchGoals}from'../review/contact-goal-state.mjs';
const contacts=[{feature:'leftHandAt_buttocksDistance',min:0,max:.1},{feature:'rightHandAt_buttocksDistance',min:0,max:.1}],state={constraints:contacts},leg={legOnly:{sides:['left']},constraints:[{feature:'leftFootLateral',min:.2,max:.6}]};
const held=retainedBodyTouchGoals(state,leg);assert.deepEqual(held,contacts);
const after={constraints:leg.constraints,bodyTouchGoals:held};assert.deepEqual(retainedBodyTouchGoals(after),contacts);assert.deepEqual(retainedBodyTouchGoals(after,leg),contacts);
assert.equal(withBodyTouchGoals(contacts,held).length,2);assert.deepEqual(retainedBodyTouchGoals(after,{constraints:[{feature:'leftHandHeight',max:.04},{feature:'rightHandHeight',max:.04}]}),[]);
console.log('PASS skin contact goals survive repeated leg-only edits and idle; explicit new full arm movement releases them');
