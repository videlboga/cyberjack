import {bodyTouchGoal} from './vrm-body-touch.mjs';
export function retainedBodyTouchGoals(state,step){
 const previous=state.bodyTouchGoals||state.constraints||[],next=step?.constraints||state.constraints||[];
 const contact=(goals,side)=>{const goal=bodyTouchGoal(goals,side);return goal?goals.filter(c=>c.feature===goal.key):[];};
 if(!step)return ['left','right'].flatMap(side=>contact(previous,side));
 return ['left','right'].flatMap(side=>contact(next,side).length?contact(next,side):step.legOnly||step.armOnly&&!step.armOnly.sides.includes(side)?contact(previous,side):[]);
}
export function withBodyTouchGoals(goals,contacts){const names=new Set(goals.map(c=>c.feature));return [...goals,...contacts.filter(c=>!names.has(c.feature))];}
