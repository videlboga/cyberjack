import 'dotenv/config';
import '../src/infrastructure/seed';
import {parseSemanticVerbalInput} from '../src/parser/semanticVerbalParser';
import {writeFileSync} from 'node:fs';
const cases=[['Сядь, пожалуйста','pose_sitting'],['Подними обе руки вверх','posture_arms_up'],['Опусти руки','posture_arms_down'],['Вытяни руки перед собой','posture_arms_front'],['Поверни голову налево','posture_head_left'],['Не поднимай руки',null],['Я подниму руки',null]] as const;
const results=[];
for(const [text,expected] of cases){try{const parsed=await parseSemanticVerbalInput(text,'Лаборатория. Мира сидит, руки свободны.',[{id:'S-AV-01',name:'Мира'}],'S-AV-01','S-AV-01');const intent=parsed.commandIntent;const actual=intent.type==='activate_context'?intent.targetContextId:intent.type==='change_pose'?intent.targetPoseId:null;results.push({text,expected,actual,pass:actual===expected,intent,model:parsed.model});console.log(JSON.stringify(results.at(-1)))}catch(e){results.push({text,expected,pass:false,error:String(e)});console.error(String(e))}}
writeFileSync('artifacts/vrm-natural-commands.json',JSON.stringify(results,null,2));if(results.some(x=>!x.pass))process.exitCode=1;
