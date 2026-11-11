const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const guideColumns=Array.from({length:7},(_,i)=>-1+i/3);
export const guideRails=[['seam','Смыкание',0],['upperBody','Объём верхней',.5,'upper'],['upperEdge','Край верхней',1,'upper'],['lowerBody','Объём нижней',.5,'lower'],['lowerEdge','Край нижней',1,'lower']];
export const guideAnchors=guideRails.flatMap(([rail,label,t,band])=>guideColumns.flatMap((u,i)=>rail!=='seam'&&(i===0||i===6)?[]:[{key:rail+':'+i,label:label+' · '+(i+1),rail,u,t,band:band||'upper'}]));
const hat=x=>Math.abs(x)>=1?0:1-smooth(Math.abs(x));
export function guideDelta(u,t,band,edits={},expression={}){
 const neutral=[0,0,0],corrective=[0,0,0];
 for(const a of guideAnchors){if(a.rail!=='seam'&&a.band!==band)continue;const endpoint=a.u===-1||a.u===1,w=hat((u-a.u)*3)*(endpoint?1:hat((t-a.t)*2));if(!w)continue;
  for(let k=0;k<3;k++){neutral[k]+=(edits.neutral?.[a.key]?.[k]||0)*w*.001;for(const pose of ['happy','aa','ou'])corrective[k]+=(edits[pose]?.[a.key]?.[k]||0)*w*.001*(expression[pose]||0);}}
 const happy=expression.happy||0,aa=expression.aa||0,ou=expression.ou||0;
 // Identity offsets follow the expression's local stretch and eversion frame.
 return [neutral[0]*(1+.22*happy-.55*ou-.06*aa)+corrective[0],neutral[1]*(1+.25*ou-.35*happy*Math.abs(u))+corrective[1],neutral[2]*(1+.3*ou)/(1+.22*happy)+corrective[2]];
}
export function cleanGuideEdits(input){const out={};if(input===undefined)return out;if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Некорректные направляющие');const allowed=new Set(guideAnchors.map(a=>a.key));for(const pose of ['neutral','happy','aa','ou']){if(input[pose]===undefined)continue;if(!input[pose]||typeof input[pose]!=='object'||Array.isArray(input[pose]))throw Error('Некорректная поза');out[pose]={};for(const [key,v] of Object.entries(input[pose])){if(!allowed.has(key)||!Array.isArray(v)||v.length!==3||!v.every(x=>typeof x==='number'&&Number.isFinite(x)))throw Error('Некорректная точка');out[pose][key]=v.map(x=>Math.max(-3,Math.min(3,x)));}}return out;}
