import {faceControls} from './viewer-face.js?v=beauty12b';
import {cleanAppearance} from './viewer-face-appearance.js?v=mika32c';
const stable=value=>JSON.stringify(sort(value));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v;}
export class FaceHistory{
 constructor(initial,limit=60){this.states=[stable(initial)];this.index=0;this.limit=limit;this.group=null;}
 record(value,group=null){const next=stable(value);if(next===this.states[this.index])return false;this.states.length=this.index+1;if(group&&group===this.group&&this.index>0)this.states[this.index]=next;else{this.states.push(next);this.index++;}if(this.states.length>this.limit){this.states.shift();this.index--;}this.group=group;return true;}
 end(){this.group=null;}
 get canUndo(){return this.index>0;}
 get canRedo(){return this.index<this.states.length-1;}
 undo(){this.end();if(!this.canUndo)return null;return JSON.parse(this.states[--this.index]);}
 redo(){this.end();if(!this.canRedo)return null;return JSON.parse(this.states[++this.index]);}
}
export function cleanFaceProject(p){
 if(!p||p.format!=='cyberjack-face'||p.version!==1||p.base!=='mira-canonical-1'||!p.face||typeof p.face!=='object'||Array.isArray(p.face))throw Error('Нужен проект лица Mira версии 1');
 const face={};for(const [,key] of faceControls)if(p.face[key]!==undefined){if(typeof p.face[key]!=='number'||!Number.isFinite(p.face[key]))throw Error('Некорректный параметр '+key);face[key]=Math.max(-1,Math.min(1,p.face[key]));}
 return {format:'cyberjack-face',version:1,base:'mira-canonical-1',face,appearance:cleanAppearance(p.appearance||{})};
}
export class FaceLibrary{
 constructor(storage,key='cyberjack.face-library.v1'){this.storage=storage;this.key=key;this.entries=[];this.error=null;try{const raw=storage.getItem(key);if(raw){const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.entries)||data.entries.length>50)throw Error('Некорректный формат библиотеки');this.entries=data.entries.map(e=>{if(typeof e.id!=='string'||typeof e.name!=='string'||typeof e.created!=='string')throw Error('Некорректная запись библиотеки');return {id:e.id,name:e.name.slice(0,80),created:e.created,project:cleanFaceProject(e.project)};});}}catch(error){this.error=error.message;}}
 add(name,project,id,created){if(this.error)throw Error('Библиотека недоступна: '+this.error);name=name.trim().slice(0,80);if(!name)throw Error('Введите имя варианта лица');if(this.entries.length>=50)throw Error('В библиотеке уже 50 вариантов. Сохраните следующий вариант в JSON.');const entry={id,name,created,project:cleanFaceProject(project)},next=[entry,...this.entries];this.storage.setItem(this.key,JSON.stringify({version:1,entries:next}));this.entries=next;return entry;}
}
export class FaceWorkflow{
 constructor({head,sync,update,storage}){
  Object.assign(this,{head,sync,update});this.history=new FaceHistory(this.snapshot());this.restoring=false;this.group=null;this.$=id=>document.getElementById(id);const panel=this.$('head-panel');
  panel.addEventListener('pointerdown',e=>{if(e.target.dataset?.key?.startsWith('mouthCurve_'))this.group=e.target.closest('svg').id;},true);
  panel.addEventListener('input',e=>{this.group=e.target.id||null;},true);
  panel.addEventListener('change',()=>this.end());panel.addEventListener('pointerup',()=>this.end());panel.addEventListener('keyup',()=>this.end());panel.addEventListener('focusout',()=>this.end());panel.addEventListener('click',()=>this.end(),true);
  this.$('face-undo').onclick=()=>this.restore(this.history.undo());this.$('face-redo').onclick=()=>this.restore(this.history.redo());
  document.addEventListener('keydown',e=>{const el=e.target;if(el.isContentEditable||el.matches('textarea,input:not([type=range]):not([type=color]),select'))return;if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const key=e.key.toLowerCase();if(key==='z'){e.preventDefault();this.restore(e.shiftKey?this.history.redo():this.history.undo());}else if(key==='y'){e.preventDefault();this.restore(this.history.redo());}});
  try{this.library=new FaceLibrary(storage());}catch(error){this.library={entries:[],error:error.message};}
  this.$('face-library-save').onclick=()=>{try{if(!this.library.add)throw Error('Хранилище браузера недоступно');const entry=this.library.add(this.$('face-library-name').value,this.project(),crypto.randomUUID(),new Date().toISOString());this.list(entry.id);this.message('Сохранено: '+entry.name);}catch(error){this.message('Не удалось сохранить: '+error.message);}};
  this.$('face-library-load').onclick=()=>{const entry=this.library.entries.find(e=>e.id===this.$('face-library-select').value);if(!entry)return;this.end();Object.assign(head.settings,structuredClone({face:entry.project.face,appearance:entry.project.appearance}));update();sync();this.message('Открыто: '+entry.name);};
  this.$('face-library-select').onchange=()=>this.$('face-library-load').disabled=!this.$('face-library-select').value;
  this.list();this.buttons();if(this.library.error)this.message('Библиотека недоступна: '+this.library.error);
 }
 snapshot(){const s=this.head.settings;return structuredClone({face:s.face,appearance:s.appearance,expressions:s.expressions,lookX:s.lookX,lookY:s.lookY,materials:s.materials});}
 project(){return cleanFaceProject({format:'cyberjack-face',version:1,base:'mira-canonical-1',face:this.head.settings.face,appearance:this.head.settings.appearance});}
 observe(){if(!this.restoring)this.history.record(this.snapshot(),this.group);this.buttons();}
 end(){this.group=null;this.history.end();}
 restore(state){if(!state)return;this.restoring=true;this.end();try{Object.assign(this.head.settings,state);this.update();this.sync();}finally{this.restoring=false;this.buttons();}}
 buttons(){this.$('face-undo').disabled=!this.history.canUndo;this.$('face-redo').disabled=!this.history.canRedo;this.$('face-history-count').textContent=(this.history.index+1)+' / '+this.history.states.length;}
 message(value){this.$('face-library-status').textContent=value;}
 list(selected=''){const select=this.$('face-library-select');select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=this.library.entries.length?'Выберите вариант':'Пока нет сохранённых лиц';select.append(empty);for(const entry of this.library.entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name+' · '+entry.created.slice(0,10);select.append(option);}select.value=selected;this.$('face-library-load').disabled=!selected;}
}
