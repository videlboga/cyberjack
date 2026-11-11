import {poseTools} from '../review/command-pose.mjs';
import {motionTiming,phraseTransition} from './motion-phrasing.mjs';
export function coordinatePoseChange(bank,state,step){const t=poseTools(bank),a=t.unpack(state.pose),b=t.unpack(step.pose),af=t.features(a),bf=t.features(b),legChange=Math.max(Math.abs(af.leftKnee-bf.leftKnee),Math.abs(af.rightKnee-bf.rightKnee))>25,armChange=['L','R'].some(s=>['shoulder','arm00','forearm01','hand'].some(n=>a[t.m.index.get('cf_j_'+n+'_'+s)].q.angleTo(b[t.m.index.get('cf_j_'+n+'_'+s)].q)>.15));if(!armChange||(!legChange&&!step.objectContacts?.length))return null;
 const timing=motionTiming(t,a,b),handSupport=step.objectContacts?.some(c=>c.kind==='hand')||['left','right'].some(s=>bf[s+'HandHeight']<.04&&af[s+'HandHeight']>.12),frames=phraseTransition(t,a,b,{handSupport,releaseArms:legChange&&!handSupport});
 return {motion:{frames,duration:timing.duration,loop:false,noMargins:true,source:{name:'Согласование рук и изменения опоры'},coordinated:true,phrasing:{...timing,handSupport,policy:'overlapping preparation, body transfer and settling'}},duration:timing.duration,transition:'Подготовка рук, перенос корпуса, завершение позы'};
}
