// Project state keeps unknown extension keys so optional systems survive editing.
export function captureCharacterHash({previous='',id,parameters={},hair='',head='',feet='',ribbons=false,bundle=false,managedKeys=[]}){
 const p=new URLSearchParams(previous.replace(/^#/,''));
 for(const key of [...p.keys()])if(key==='head'||key==='hair'||key==='lookX'||key==='lookY'||key==='collision_mesh'||key==='ribbon_tryon'||key==='bundle_attach'||key==='foot_pose'||managedKeys.includes(key)||Object.hasOwn(parameters,key))p.delete(key);
 for(const [key,value]of Object.entries(parameters))if(value)p.set(key,String(value));
 for(const part of [hair,head,feet])for(const [key,value]of new URLSearchParams(part.replace(/^#/,'')))p.set(key,value);
 p.set('character_id',id);if(ribbons)p.set('ribbon_tryon','1');if(bundle)p.set('bundle_attach','1');return p.toString();
}
export function characterRuntime(hash){const p=new URLSearchParams(hash.replace(/^#/,''));return p.get('ribbon_tryon')==='1'?'mira-ribbons':p.get('bundle_attach')==='1'?'iona-bundle':'builtin';}
