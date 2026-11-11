const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
// Move existing controls, preserving their listeners, values and IDs.
export function editorTabs(host,items,label){
 const nav=el('div',null,'editor-tabs');nav.setAttribute('role','tablist');nav.setAttribute('aria-label',label);
 const views=items.map(([name,node],i)=>{const id='editor-tab-'+(++editorTabs.serial),button=el('button',name);button.type='button';button.id=id;button.setAttribute('role','tab');button.setAttribute('aria-controls',id+'-pane');node.id||=id+'-pane';button.setAttribute('aria-controls',node.id);node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby',id);nav.append(button);return {button,node};});
 const select=i=>{views.forEach((v,j)=>{v.node.hidden=j!==i;v.button.setAttribute('aria-selected',String(j===i));v.button.tabIndex=j===i?0:-1;});const scroll=document.getElementById('editor-scroll');if(scroll)scroll.scrollTop=0;};
 nav.addEventListener('click',event=>{const i=views.findIndex(v=>v.button===event.target.closest('button'));if(i>=0)select(i);});
 views.forEach((v,i)=>{v.button.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%views.length;if(e.key==='ArrowLeft')next=(i+views.length-1)%views.length;if(e.key==='Home')next=0;if(e.key==='End')next=views.length-1;if(next!==undefined){e.preventDefault();select(next);views[next].button.focus();}});});
 host.append(nav,...views.map(v=>v.node));select(0);return {nav,select};
}
editorTabs.serial=0;
export function setupEditorLayout(){
 const $=id=>document.getElementById(id),panel=$('panel'),scroll=el('div',null,'editor-scroll');scroll.id='editor-scroll';
 const brand=el('header',null,'editor-brand');const save=$('save');brand.append(el('strong','Редактор персонажа'),save);save.textContent='Сохранить ссылку';
 panel.prepend(brand);panel.append(scroll);
 const character=el('section'),body=el('section'),face=el('section'),hair=el('section'),motion=el('section'),scene=el('section');scroll.append(character,body,face,hair,motion,scene);
 character.append(el('h2','Персонаж'),$('editor-character-slot'));
 const files=el('div',null,'editor-actions');files.append($('export-vrm'),$('vrm-download'));character.append(files);
 const reset=el('details');reset.append(el('summary','Сброс проекта'),$('reset'));character.append(reset);
 body.append(el('h2','Пропорции тела'),$('head'),$('list'));$('head').querySelector('b').hidden=true;$('q').placeholder='Поиск параметров тела';
 const head=$('head-panel');head.open=true;head.classList.add('editor-flat');face.append(el('h2','Лицо'),head);
 const appearance=$('face-appearance');appearance.open=true;appearance.classList.add('editor-flat');
 const portrait=$('portrait-panel');portrait.open=true;portrait.classList.add('editor-flat');scene.append(el('h2','Сцена и референсы'),portrait);
 const expressions=$('head-expressions').parentElement;expressions.open=true;expressions.classList.add('editor-flat');
 motion.append(el('h2','Мимика и взгляд'),$('head-neutral'),expressions,$('head-lookX').parentElement,$('head-lookY').parentElement);
 // File/library actions live with the character, rather than above every face slider.
 const faceFiles=el('details');faceFiles.append(el('summary','Сохранение и варианты лица'),$('face-library'),$('face-save'),$('face-download'),$('face-load').parentElement,$('face-json-preview'),$('face-message'));character.append(faceFiles);
 const form=el('div'),paint=el('div');paint.append(appearance);for(const child of [...head.children])if(child.tagName!=='SUMMARY')form.append(child);
 editorTabs(head,[['Форма',form],['Цвет и макияж',paint]],'Настройки лица');
 const hairPanel=$('hair-panel');hairPanel.open=true;hairPanel.classList.add('editor-flat');hair.append(el('h2','Волосы'),hairPanel);
 // Keep collision state beside the hair selector, above the long asset library.
 const selector=$('hair-style');selector.after($('hair-mesh-collision').parentElement,$('hair-collision-status'));
 const refs=$('reference-panel');refs.open=true;refs.classList.add('editor-flat');scene.append(refs,$('wire'),$('spin'));
 const colliderLabel=el('label',null,'row');const colliderToggle=el('input');colliderToggle.type='checkbox';colliderToggle.id='body-collider-overlay';colliderLabel.append(colliderToggle,document.createTextNode('Капсулы тела (бирюзовые)'));colliderLabel.title='Показать вспомогательные капсулы; точная поверхность тела отображается отдельно';scene.prepend(colliderLabel);
 const tabHost=el('div',null,'editor-navigation');panel.insertBefore(tabHost,scroll);
 const tabs=editorTabs(tabHost,[['Персонаж',character],['Тело',body],['Лицо',face],['Волосы',hair],['Мимика',motion],['Сцена',scene]],'Разделы редактора');
 // Tab panels share one scroll container. Navigation itself never scrolls away.
 for(const view of [character,body,face,hair,motion,scene])scroll.append(view);
 const foot=$('foot');document.body.append(foot);foot.classList.add('animation-dock');foot.setAttribute('aria-label','Управление анимацией');
 const number=el('input');number.type='number';number.min='0';number.max=$('timeline').max;number.step='.01';number.value=$('timeline').value;number.setAttribute('aria-label','Время танца в секундах');
 const seek=()=>{if(number.value==='')return;const value=Number(number.value);if(!Number.isFinite(value))return;const next=Math.max(0,Math.min(Number(number.max),value));if(Number($('timeline').value)===next)return;$('timeline').value=next;$('timeline').dispatchEvent(new Event('input',{bubbles:true}));};number.addEventListener('input',seek);number.addEventListener('change',seek);
 new MutationObserver(()=>{if(document.activeElement!==number)number.value=$('dance-time').textContent;}).observe($('dance-time'),{childList:true,characterData:true,subtree:true});
 foot.prepend(el('span','Анимация','dock-title'));$('rest').after(number);foot.querySelector('label').classList.add('dock-timeline');
}
