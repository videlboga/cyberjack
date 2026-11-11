// Embedded webviews can all report visibilityState='visible'. Coordinate the
// expensive animation/render loops explicitly across same-origin viewers.
export function createViewerActivity(){
 if(typeof BroadcastChannel!=='function')return {get active(){return !document.hidden;}};
 const channel=new BroadcastChannel('cyberjack-active-viewer-v1'),id=crypto.randomUUID();let owner=id,lastInteraction=0,closed=false;
 const banner=document.createElement('button');banner.textContent='Вьювер на паузе · продолжить здесь';banner.style.cssText='position:fixed;left:12px;top:86px;z-index:1100;padding:8px 12px;background:#25374e;color:white;border:1px solid #6986aa;border-radius:6px;cursor:pointer';banner.hidden=true;document.body.append(banner);
 const hosts=[window];try{if(window.top!==window&&window.top.location.origin===location.origin)hosts.push(window.top);}catch{}
 function publish(){const active=owner===id&&!document.hidden;banner.hidden=active;for(const host of hosts)host.document.documentElement.dataset.cjViewerActive=String(active);}
 function claim(){if(closed)return;owner=id;lastInteraction=Date.now();publish();channel.postMessage({type:'claim',id});}
 function interact(){if(owner!==id||Date.now()-lastInteraction>1000)claim();}
 channel.onmessage=({data})=>{if(!data||typeof data.id!=='string'||data.id===id)return;if(data.type==='claim'||data.type==='owner'){owner=data.id;publish();}else if(data.type==='hello'&&owner===id)channel.postMessage({type:'owner',id});};
 for(const host of hosts){host.addEventListener('pointerdown',interact,true);host.addEventListener('pointermove',interact,{capture:true,passive:true});host.addEventListener('keydown',interact,true);host.addEventListener('focus',claim);}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)claim();else publish();});banner.onclick=claim;
 window.addEventListener('pagehide',event=>{if(!event.persisted){closed=true;channel.close();}});
 window.addEventListener('pageshow',()=>{if(!closed)claim();});
 claim();
 return {get active(){return owner===id&&!document.hidden;}};
}
