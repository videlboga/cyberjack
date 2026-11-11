export async function characterLibrary({container,apply,capture,onMetadata=()=>{}}){
 const root='./assets/characters/',index=await fetch(root+'index.json',{cache:'no-store'}).then(r=>r.json());
 const panel=document.createElement('details');panel.open=true;panel.style.cssText='padding:8px 10px;border-bottom:1px solid var(--line);flex-shrink:0';
 const title=document.createElement('summary');title.textContent='Персонажи · полные пресеты';
 const select=document.createElement('select');select.setAttribute('aria-label','Персонаж');
 for(const item of index.items){const o=document.createElement('option');o.value=item.id;o.disabled=item.status==='deferred';o.textContent=item.name+(item.status==='accepted'?' · зафиксирована':item.status==='deferred'?' · отложен':' · черновик');select.append(o);}
 const button=document.createElement('button');button.textContent='Примерить персонажа';
 const save=document.createElement('button');save.textContent='Сохранить персонажа JSON';
 const status=document.createElement('p');status.className='sub';status.textContent='Текущие сборки: тело, лицо, волосы, эмоции и дополнительные параметры.';
 const ref=document.createElement('img');ref.style.cssText='width:100%;max-height:220px;object-fit:contain';ref.alt='Портрет выбранного персонажа';
 select.onchange=()=>{const v=index.items.find(x=>x.id===select.value);status.textContent=v?.note||'Пользовательский проект';ref.hidden=!v;if(v)ref.src='./assets/face-references/'+v.id+'/neutral.png';};const initialId=new URLSearchParams(location.hash.slice(1)).get('character_id')||'custom';if(!index.items.some(x=>x.id===initialId)){const o=document.createElement('option');o.value=initialId;o.textContent='Пользовательский проект';select.append(o);}select.value=initialId;select.onchange();
 button.onclick=async()=>{button.disabled=true;select.disabled=true;try{const d=await fetch(root+select.value+'.json',{cache:'no-store'}).then(r=>r.json());await apply(d);status.textContent=d.name+' · '+(d.status==='accepted'?'зафиксированная сборка':d.note);}catch(e){status.textContent='Не удалось применить: '+e.message;}finally{button.disabled=false;select.disabled=false;}};
 save.onclick=()=>{try{const d=capture();const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=d.id+'-character.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);status.textContent='Сохранён проект: '+d.name;}catch(e){status.textContent=e.message;}};
 const input=document.createElement('input');input.type='file';input.accept='.json';input.setAttribute('aria-label','Загрузить персонажа JSON');input.onchange=async()=>{try{const d=JSON.parse(await input.files[0].text());if(d.format!=='cyberjack-character'||d.version!==1||typeof d.hash!=='string'||d.hash.length>100000)throw Error('Неверный формат персонажа');await apply(d);status.textContent='Загружен: '+d.name;}catch(e){status.textContent=e.message;}input.value='';};
 panel.append(title,select,button,save,input,status,ref);container.prepend(panel);
 // Metadata follows the applied character, independently of the library selection.
 let pending=null;try{pending=JSON.parse(sessionStorage.getItem('cyberjack-editor-project')||'null');}catch{sessionStorage.removeItem('cyberjack-editor-project');}
 if(pending&&new URLSearchParams(pending.hash).toString()===new URLSearchParams(location.hash.slice(1)).toString()){onMetadata(pending);sessionStorage.removeItem('cyberjack-editor-project');}
 else {const id=new URLSearchParams(location.hash.slice(1)).get('character_id');if(index.items.some(x=>x.id===id)){const response=await fetch(root+id+'.json',{cache:'no-store'});if(response.ok)onMetadata(await response.json());}}

}
