import 'dotenv/config';
import assert from 'node:assert/strict';
import { parseSemanticVerbalInput } from '../src/parser/semanticVerbalParser';
for (const text of ['Подними руки', 'Поверни голову налево', 'ложись']) {
 const result=await parseSemanticVerbalInput(text,'Лаборатория. Мира сидит. Руки свободны.',[{id:'S-AV-01',name:'Мира'}],'S-AV-01','S-AV-01');
 const expected:Record<string,string>={'Подними руки':'posture_arms_up','Поверни голову налево':'posture_head_left','ложись':'pose_lying_down'};
 assert.equal((result.commandIntent as any).targetContextId || (result.commandIntent as any).targetPoseId,expected[text]);
 console.log(JSON.stringify({text,commandIntent:result.commandIntent}));
}
