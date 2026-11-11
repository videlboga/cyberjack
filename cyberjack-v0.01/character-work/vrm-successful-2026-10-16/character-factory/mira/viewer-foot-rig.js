import {createNativeToeDeformer} from './native-toes.mjs?v=splay106';
import {createMidfootDeformer} from './foot-midfoot.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Foot channels are sampled independently: the coarse body sampler omits them.
export function sampleFootFrame(clip,time){
 if(typeof clip.sample==='function'){const frame=clip.sample(time);return {toe_angles_deg:frame.toe_angles_deg||{},midfoot_twist_deg:frame.midfoot_twist_deg||{}};}
 const f=clamp(time*clip.fps,0,clip.frames.length-1),i=Math.floor(f),j=Math.min(i+1,clip.frames.length-1),t=f-i;
 const blend=(a,b)=>{if(Array.isArray(a)||Array.isArray(b))return [0,1].map(k=>(a?.[k]||0)*(1-t)+(b?.[k]||0)*t);if(typeof a==='number'||typeof b==='number')return (a||0)*(1-t)+(b||0)*t;return Object.fromEntries([...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].map(k=>[k,blend(a?.[k],b?.[k])]));};
 return Object.fromEntries(['toe_angles_deg','midfoot_twist_deg'].map(k=>[k,blend(clip.frames[i][k],clip.frames[j][k])]));
}
export function cleanFootPose(value,names){
 const out={digits:{},splay:{},midfoot:{}};if(!value)return out;
 for(const [name,a]of Object.entries(value.digits||{})){if(!names.includes(name)||!Array.isArray(a)||a.length!==2||a.some(v=>!Number.isFinite(v)||v< -35||v>50))throw Error('Некорректная поза пальцев стоп');if(a.some(Boolean))out.digits[name]=[...a];}
 for(const [name,v]of Object.entries(value.splay||{})){if(!names.includes(name)||!Number.isFinite(v)||Math.abs(v)>20)throw Error('Некорректное разведение пальцев');if(v)out.splay[name]=v;}
 for(const [side,v]of Object.entries(value.midfoot||{})){if(!['left','right'].includes(side)||!Number.isFinite(v)||Math.abs(v)>8)throw Error('Некорректное скручивание стопы');if(v)out.midfoot[side]=v;}return out;
}
export function createFootRig(toeData,midfootData){
 const toes=createNativeToeDeformer(toeData),midfoot=createMidfootDeformer(midfootData),names=toeData.pairs.map(p=>p.name);let state=cleanFootPose(null,names),a,b;
 return {sample:sampleFootFrame,names,pairs:toeData.pairs,toes,midfoot,get state(){return structuredClone(state);},setState(value){state=cleanFootPose(value,names);},invalidate(){toes.invalidate();midfoot.invalidate();},
 readHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));state=cleanFootPose(p.has('foot_pose')?JSON.parse(p.get('foot_pose')):null,names);},
 hash(){const p=new URLSearchParams();if(Object.keys(state.digits).length||Object.keys(state.splay).length||Object.keys(state.midfoot).length)p.set('foot_pose',JSON.stringify(state));return p.toString();},
 apply(rest,frame={}){const motion=frame?.toe_angles_deg||{},twist=frame?.midfoot_twist_deg||{};if(!Object.keys(state.digits).length&&!Object.keys(state.splay).length&&!Object.keys(state.midfoot).length&&!Object.keys(motion).length&&!Object.keys(twist).length)return rest;
  if(!a||a.length!==rest.length){a=new Float64Array(rest.length);b=new Float64Array(rest.length);}
  const digits=Object.fromEntries(toeData.pairs.map(p=>{const f=motion.digits?.[p.name]??motion[p.side]??[0,0],m=state.digits[p.name]??[0,0];return [p.name,f.map((v,i)=>clamp(v+m[i],-35,50))];}));const splay=Object.fromEntries(names.map(name=>[name,clamp((motion.splay?.[name]||0)+(state.splay[name]||0),-20,20)]));toes.apply(rest,a,{digits,splay});return midfoot.apply(rest,a,b,Object.fromEntries(['left','right'].map(s=>[s,clamp((twist[s]||0)+(state.midfoot[s]||0),-8,8)])));
 }};
}
export async function installFootRig({host,hash,onChange}){
 const read=async n=>{const r=await fetch('./assets/feet/'+n,{cache:'no-store'});if(!r.ok)throw Error('Не загружен риг стоп: '+n);return r.json();};const [a,b]=await Promise.all([read('native-toes-centered.json?v=splay106'),read('foot-midfoot-data.json')]);const rig=createFootRig(a,b);rig.readHash(hash);
 const panel=document.createElement('details');panel.id='editor-foot-rig';const title=document.createElement('summary');title.textContent='Риг стоп · пальцы и свод';panel.append(title);const info=document.createElement('p');info.className='sub';info.textContent='Восстановлены исходные веса: 5 пальцев × 2 сустава на каждой стопе. Свод — отдельная региональная деформация.';panel.append(info);const inputs=[];
 for(const side of ['left','right']){const box=document.createElement('details');box.append(Object.assign(document.createElement('summary'),{textContent:side==='left'?'Левая стопа':'Правая стопа'}));
  for(const [j,p]of a.pairs.filter(p=>p.side===side).entries())for(let joint=0;joint<2;joint++)add(box,`${side==='left'?'Левая':'Правая'} стопа · палец ${j+1} · сустав ${joint+1}`,-35,50,()=>rig.state.digits[p.name]?.[joint]||0,v=>{const s=rig.state;s.digits[p.name]??=[0,0];s.digits[p.name][joint]=v;rig.setState(s);});
  add(box,`${side==='left'?'Левая':'Правая'} стопа · разведение пальцев`,-20,20,()=>rig.state.splay[a.pairs.find(p=>p.side===side).name]||0,v=>{const s=rig.state;for(const p of a.pairs.filter(p=>p.side===side))s.splay[p.name]=v;rig.setState(s);});
  add(box,`${side==='left'?'Левая':'Правая'} стопа · скручивание свода`,-8,8,()=>rig.state.midfoot[side]||0,v=>{const s=rig.state;s.midfoot[side]=v;rig.setState(s);});panel.append(box);
 }
 function add(box,label,min,max,get,set){const row=document.createElement('label');row.className='row';const text=document.createElement('span');text.textContent=label;const output=document.createElement('output'),input=document.createElement('input');Object.assign(input,{type:'range',min,max,step:.5,value:get()});input.setAttribute('aria-label',label);input.oninput=()=>{set(Number(input.value));output.textContent=input.value+'°';onChange();};row.append(text,output,input);box.append(row);inputs.push(()=>{input.value=get();output.textContent=input.value+'°';});}
 const reset=document.createElement('button');reset.textContent='Сбросить позу стоп';reset.onclick=()=>{rig.setState(null);rig.sync();onChange();};panel.append(reset);host.append(panel);rig.sync=()=>inputs.forEach(f=>f());rig.sync();return rig;
}
