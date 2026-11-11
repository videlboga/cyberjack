import assert from'node:assert/strict';import{Object3D,Bone}from'three';import{createCooperativePoseSolve}from'../review/cooperative-pose-solve.mjs';
const scene=new Object3D(),bone=new Bone();scene.add(bone);let time=0;const task=createCooperativePoseSolve(scene,{budgetMs:2,now:()=>time++});const visible=task.capture();let completed=0;
function* trial(){for(let i=1;i<=12;i++){bone.position.x=i;yield;}return 42;}
task.start(trial(),'first',value=>{assert.equal(value,42);completed++;},visible);let ticks=0;while(task.pending){task.tick();ticks++;if(task.pending){assert.equal(bone.position.x,0);bone.position.y=123;}}assert.ok(ticks>1);assert.equal(completed,1);assert.equal(bone.position.x,12);assert.equal(bone.position.y,0);
const final=task.capture();task.start(trial(),'cancel',()=>assert.fail('Cancelled solve applied'),final);task.tick();task.cancel();assert.equal(bone.position.x,12);assert.equal(task.pending,false);
function* failure(){bone.position.x=-999;yield;throw Error('expected');}task.start(failure(),'error',()=>assert.fail(),final);assert.throws(()=>{while(task.pending)task.tick();},/expected/);assert.equal(bone.position.x,12);assert.equal(task.pending,false);
console.log('PASS budget slicing, invisible trials, exact continuation, cancellation and error rollback');
