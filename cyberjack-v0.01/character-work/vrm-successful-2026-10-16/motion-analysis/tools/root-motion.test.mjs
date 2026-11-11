import assert from 'node:assert/strict';import {rootMotion} from './root-motion.mjs';
const preview=xs=>({duration:(xs.length-1)/10,frames:xs.map(x=>[[x,0,0]])});
assert.equal(rootMotion(preview([0,0,0,0,0])).events.length,0);
assert.equal(rootMotion(preview([0,.1,.2,.3,.4])).events.length,0);
const a=rootMotion(preview([0,0,0,3,3,3,3,6,6,6]));assert.equal(a.events.length,2);assert.equal(a.loopSeamDistance,6);assert.equal(a.rapidTransfer,true);console.log('PASS stationary, smooth motion, two rapid transfers and loop seam');
