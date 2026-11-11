const root='./assets/characters/',status=document.getElementById('status');
try{
 const index=await fetch(root+'index.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Не загружена библиотека');return r.json();});
 for(const item of index.items){const a=document.createElement('a');a.href='?character='+encodeURIComponent(item.id);a.textContent=item.name;a.style.cssText='display:inline-block;margin:8px 16px 8px 0';document.getElementById('characters').append(a);}
 const id=new URLSearchParams(location.search).get('character');
 if(id){if(!index.items.some(x=>x.id===id))throw Error('Неизвестный персонаж');const data=await fetch(root+id+'.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Не загружен персонаж');return r.json();});
 const p=new URLSearchParams(data.hash.replace(/^#/,''));p.set('character_id',id);sessionStorage.setItem('cyberjack-editor-project',JSON.stringify({...data,hash:p.toString()}));location.replace((p.get('ribbon_tryon')==='1'?'mira-ribbon-preview.html':'evanescia-keys.html')+'?editor=1#'+p.toString());}
 else status.textContent='Выберите персонажа. Откроется его текущая параметрическая сборка.';
}catch(e){status.textContent=e.message;}
