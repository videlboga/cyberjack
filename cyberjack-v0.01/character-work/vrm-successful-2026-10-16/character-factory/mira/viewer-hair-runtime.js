// Old character links saved the guide asset but lost the runtime that replaces
// it with the accepted gathered hairstyle. Explicit choices still take priority.
export function usesAttachedHair(hash){
 const p=new URLSearchParams(hash.replace(/^#/,''));
 if(p.has('bundle_attach'))return p.get('bundle_attach')==='1';
 if(p.get('character_id')!=='iona')return false;
 try{return JSON.parse(p.get('hair_layers')||'[]').some(layer=>layer.asset==='IonaUnified-AllHair');}catch{return false;}
}
