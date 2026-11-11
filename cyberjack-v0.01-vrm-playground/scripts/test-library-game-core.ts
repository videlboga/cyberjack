import '../src/infrastructure/seed';
import {readFileSync,writeFileSync} from 'node:fs';
import {subjectRepo,activeContextsRepo,presetRepo} from '../src/infrastructure/repositories';
import {db} from '../src/infrastructure/db';
import {ContextManager} from '../src/orchestration/contextManager';
import {runGameTick} from '../src/orchestration/runGameTick';
const results=JSON.parse(readFileSync('artifacts/vrm-natural-commands.json','utf8'));
const subject='TEST-LIBRARY-COMMANDS';
subjectRepo.save(subject,subject,{sensitivity:50,capacity:80,openness:50,plasticity:50,attitude:80,tension:0});
db.prepare(`INSERT OR IGNORE INTO subject_point_states (subject_id,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness) SELECT ?,point_id,local_sensitivity,local_attitude,local_openness,familiarity,exposure_count,baseline_local_sensitivity,baseline_local_attitude,baseline_local_openness FROM subject_point_states WHERE subject_id='S-AV-01'`).run(subject);
const apply=(id:string)=>ContextManager.applyContext(subject,id,presetRepo.getActionPreset(id)!);
const ids=()=>activeContextsRepo.getAllForSubject(subject).map(c=>c.actionId);
const checks=[];
for(const row of results){if(!row.intent)continue;db.prepare('DELETE FROM active_contexts WHERE subject_id=?').run(subject);apply('pose_sitting');
await runGameTick({subjectId:subject,playerId:'PL-1',sceneId:'scene_lab_calibrator',pointId:'systemic',presetId:'verbal_pressure',textMessage:row.text,skipPrompt:true,dynamicModifiers:{intensity:0,valence:0,contact:0,sharpness:0,novelty:0,commandIntent:row.intent} as any});
const expected=row.expected;checks.push({text:row.text,contexts:ids(),pass:expected?ids().includes(expected):ids().length===1});}
writeFileSync('artifacts/vrm-natural-core.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks,null,2));if(checks.some(x=>!x.pass))process.exitCode=1;
